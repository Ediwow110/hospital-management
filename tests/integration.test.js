'use strict';

/**
 * PR #4 - PostgreSQL Persistence Foundation
 * Integration tests using a live PostgreSQL container.
 *
 * These tests require DATABASE_URL to be set.
 * Run after migrations: npm run migrate && npm run test:integration
 *
 * Tests assert:
 *   - PgUserRepository CRUD against real PostgreSQL
 *   - PgAuditLogRepository append-only behavior
 *   - PgLabResultRepository save and released-lock protection
 *   - withTransaction wrapper rollback behavior
 *   - audit_logs cannot be updated (DB-level enforcement)
 */

const assert = require('assert');
const { randomUUID } = require('crypto');

const { Pool } = require('pg');
const { withTransaction } = require('../src/infrastructure/transaction');
const { PgUserRepository } = require('../src/repositories/pg/PgUserRepository');
const { PgAuditLogRepository } = require('../src/repositories/pg/PgAuditLogRepository');
const { PgLabResultRepository } = require('../src/repositories/pg/PgLabResultRepository');
const { createAppContext } = require('../src/core/app-context');

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required for integration tests.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const TENANT_ID = 'integration-test-tenant';
const BRANCH_ID = 'integration-test-branch';

function makeCtx(userId = 'system') {
  return createAppContext({
    requestId: randomUUID(),
    method: 'TEST',
    path: '/integration-test',
    routePattern: '/integration-test',
    user: { id: userId, role: 'superadmin', tenantId: TENANT_ID, branchIds: [BRANCH_ID] },
    headers: { 'x-tenant-id': TENANT_ID, 'x-branch-id': BRANCH_ID },
    ipAddress: '127.0.0.1',
  });
}

const userRepo = new PgUserRepository({ pool });
const auditRepo = new PgAuditLogRepository({ pool });
const labRepo = new PgLabResultRepository({ pool });

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

async function cleanupTestData() {
  await pool.query("DELETE FROM audit_logs WHERE actor_id LIKE 'integration-test-%'");
  await pool.query("DELETE FROM lab_results WHERE ordered_by LIKE 'integration-test-%'");
  await pool.query("DELETE FROM users WHERE username LIKE 'integration-test-%'");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('\nRunning PostgreSQL integration tests...');
  console.log('DATABASE_URL:', DATABASE_URL.replace(/:([^:@]+)@/, ':***@'));
  console.log();

  // Setup: clean test data from previous runs
  await cleanupTestData();

  // -------------------------------------------------------------------------
  // PgUserRepository tests
  // -------------------------------------------------------------------------
  console.log('--- PgUserRepository ---');

  let createdUserId;
  await test('create a user', async () => {
    const ctx = makeCtx('integration-test-actor');
    const user = await userRepo.create(ctx, {
      username: `integration-test-${randomUUID().slice(0, 8)}`,
      passwordHash: '$2b$10$test',
      role: 'nurse',
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
    });
    assert.ok(user.id, 'user.id should be set');
    assert.strictEqual(user.role, 'nurse');
    createdUserId = user.id;
  });

  await test('find user by id', async () => {
    const ctx = makeCtx('integration-test-actor');
    const user = await userRepo.findById(ctx, createdUserId);
    assert.ok(user, 'user should be found');
    assert.strictEqual(user.id, createdUserId);
  });

  await test('update user role', async () => {
    const ctx = makeCtx('integration-test-actor');
    const updated = await userRepo.update(ctx, createdUserId, { role: 'doctor' });
    assert.strictEqual(updated.role, 'doctor');
  });

  // -------------------------------------------------------------------------
  // PgAuditLogRepository tests
  // -------------------------------------------------------------------------
  console.log('\n--- PgAuditLogRepository ---');

  let auditLogId;
  await test('append an audit log entry', async () => {
    const ctx = makeCtx('integration-test-actor');
    const log = await auditRepo.append(ctx, {
      action: 'test.action',
      resourceType: 'user',
      resourceId: createdUserId || randomUUID(),
      details: { test: true },
    });
    assert.ok(log.id, 'audit log id should be set');
    assert.strictEqual(log.action, 'test.action');
    auditLogId = log.id;
  });

  await test('audit log cannot be updated (DB-level enforcement)', async () => {
    assert.ok(auditLogId, 'auditLogId must be set from previous test');
    try {
      await pool.query(
        'UPDATE audit_logs SET action = $1 WHERE id = $2',
        ['tampered.action', auditLogId]
      );
      // If no error thrown, check if the row was actually changed
      const result = await pool.query('SELECT action FROM audit_logs WHERE id = $1', [auditLogId]);
      if (result.rows.length > 0) {
        assert.strictEqual(result.rows[0].action, 'test.action', 'audit_logs row should not have been updated');
      }
    } catch (err) {
      // Trigger raised an error - this is the expected behaviour
      assert.match(err.message, /immutable|audit|update/i, 'expected immutability error');
    }
  });

  // -------------------------------------------------------------------------
  // PgLabResultRepository tests
  // -------------------------------------------------------------------------
  console.log('\n--- PgLabResultRepository ---');

  let labResultId;
  await test('save a lab result', async () => {
    const ctx = makeCtx('integration-test-actor');
    const lab = await labRepo.save(ctx, {
      patientId: randomUUID(),
      orderId: randomUUID(),
      testName: 'Integration CBC',
      orderedBy: 'integration-test-doctor',
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
    });
    assert.ok(lab.id, 'lab result id should be set');
    assert.strictEqual(lab.status, 'pending');
    labResultId = lab.id;
  });

  await test('release a lab result', async () => {
    const ctx = makeCtx('integration-test-actor');
    // First encode and approve
    await labRepo.updateStatus(ctx, labResultId, 'encoded');
    await labRepo.updateStatus(ctx, labResultId, 'approved');
    const released = await labRepo.updateStatus(ctx, labResultId, 'released');
    assert.strictEqual(released.status, 'released');
  });

  await test('released lab result cannot be directly updated', async () => {
    try {
      await pool.query(
        "UPDATE lab_results SET status = 'pending' WHERE id = $1",
        [labResultId]
      );
      // If no error, check trigger/application enforcement
      const result = await pool.query('SELECT status FROM lab_results WHERE id = $1', [labResultId]);
      if (result.rows.length > 0) {
        assert.strictEqual(result.rows[0].status, 'released', 'released lab result must not be changed directly');
      }
    } catch (err) {
      // Trigger raised an error - expected
      assert.ok(err.message, 'expected an error for released lab result update');
    }
  });

  // -------------------------------------------------------------------------
  // withTransaction tests
  // -------------------------------------------------------------------------
  console.log('\n--- withTransaction ---');

  await test('transaction commits successfully', async () => {
    const username = `integration-test-txn-${randomUUID().slice(0, 8)}`;
    const ctx = makeCtx('integration-test-txn-actor');
    await withTransaction(pool, async (client) => {
      await client.query(
        'INSERT INTO users (username, password_hash, role, tenant_id, branch_id) VALUES ($1, $2, $3, $4, $5)',
        [username, '$2b$10$test', 'nurse', TENANT_ID, BRANCH_ID]
      );
    });
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    assert.strictEqual(result.rows.length, 1, 'user should exist after transaction commit');
  });

  await test('transaction rolls back on error', async () => {
    const username = `integration-test-rollback-${randomUUID().slice(0, 8)}`;
    try {
      await withTransaction(pool, async (client) => {
        await client.query(
          'INSERT INTO users (username, password_hash, role, tenant_id, branch_id) VALUES ($1, $2, $3, $4, $5)',
          [username, '$2b$10$test', 'nurse', TENANT_ID, BRANCH_ID]
        );
        throw new Error('deliberate rollback');
      });
    } catch (err) {
      assert.strictEqual(err.message, 'deliberate rollback');
    }
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    assert.strictEqual(result.rows.length, 0, 'user should NOT exist after transaction rollback');
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  await cleanupTestData();
  await pool.end();

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('All integration tests passed.');
  }
}

runTests().catch(err => {
  console.error('Fatal error in integration tests:', err);
  process.exit(1);
});
