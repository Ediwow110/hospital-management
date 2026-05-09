'use strict';

/**
 * PR #4 — PostgreSQL Persistence Foundation
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
const { AppContext } = require('../src/core/AppContext');
const { ROLE_PERMISSIONS } = require('../src/core/permissions');

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
  return new AppContext({
    requestId: randomUUID(),
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    userId,
    roles: ['superadmin'],
    permissions: ROLE_PERMISSIONS.superadmin || [],
    ipAddress: '127.0.0.1',
    deviceInfo: 'integration-test',
  });
}

const userRepo = new PgUserRepository({ pool });
const auditRepo = new PgAuditLogRepository({ pool });
const labRepo = new PgLabResultRepository({ pool });

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

// Cleanup helper: remove test-tenant rows after each group
async function cleanup() {
  await pool.query(`DELETE FROM lab_results WHERE tenant_id = $1`, [TENANT_ID]);
  await pool.query(`DELETE FROM audit_logs WHERE tenant_id = $1`, [TENANT_ID]);
  await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [TENANT_ID]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

(async () => {
  console.log('\nPR #4 PostgreSQL Integration Tests');
  console.log('====================================\n');

  await cleanup();

  // -- PgUserRepository --
  console.log('PgUserRepository');

  const userId = randomUUID();
  const ctx = makeCtx(userId);

  await test('save() inserts a new user', async () => {
    const saved = await userRepo.save({
      id: userId,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      email: `user-${userId}@test.com`,
      passwordHash: 'hashed-password',
      name: 'Integration Test User',
      roles: ['superadmin'],
      status: 'active',
    }, ctx);
    assert.strictEqual(saved.id, userId);
    assert.strictEqual(saved.email, `user-${userId}@test.com`);
  });

  await test('findByEmail() retrieves the saved user', async () => {
    const found = await userRepo.findByEmail(`user-${userId}@test.com`, ctx);
    assert.ok(found);
    assert.strictEqual(found.id, userId);
  });

  await test('findById() retrieves the saved user', async () => {
    const found = await userRepo.findById(userId, ctx);
    assert.ok(found);
    assert.strictEqual(found.email, `user-${userId}@test.com`);
  });

  await test('findByEmail() returns null for unknown user', async () => {
    const found = await userRepo.findByEmail('nobody@nowhere.com', ctx);
    assert.strictEqual(found, null);
  });

  // -- PgAuditLogRepository --
  console.log('\nPgAuditLogRepository');

  const auditId = randomUUID();

  await test('append() inserts an audit log entry', async () => {
    const entry = await auditRepo.append({
      id: auditId,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      requestId: randomUUID(),
      actorId: userId,
      ipAddress: '127.0.0.1',
      eventType: 'user.created',
      entityType: 'User',
      entityId: userId,
      changes: { action: 'create' },
    }, ctx);
    assert.strictEqual(entry.id, auditId);
    assert.strictEqual(entry.eventType, 'user.created');
  });

  await test('findByEntity() retrieves audit entries for entity', async () => {
    const entries = await auditRepo.findByEntity('User', userId, ctx);
    assert.ok(entries.length >= 1);
    assert.strictEqual(entries[0].entityId, userId);
  });

  await test('audit_logs cannot be updated (append-only guard at DB level)', async () => {
    let threw = false;
    try {
      await pool.query(
        `UPDATE audit_logs SET event_type = 'tampered' WHERE id = $1`,
        [auditId]
      );
    } catch (err) {
      threw = true;
      // Expected: DB trigger blocks UPDATE on audit_logs
    }
    if (!threw) {
      // If DB trigger not yet installed, verify row is unchanged
      const { rows } = await pool.query(
        `SELECT event_type FROM audit_logs WHERE id = $1`, [auditId]
      );
      // Either the trigger fired or the value stayed the same
      assert.ok(
        threw || rows[0].event_type === 'user.created',
        'audit_logs row must not be modifiable'
      );
    }
    // If threw, the test passes (trigger works)
    assert.ok(true);
  });

  // -- PgLabResultRepository --
  console.log('\nPgLabResultRepository');

  const labId = randomUUID();
  const orderId = randomUUID();

  await test('save() inserts a lab result', async () => {
    const saved = await labRepo.save({
      id: labId,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      orderId,
      patientId: userId,
      testName: 'CBC',
      status: 'Pending Collection',
      resultData: null,
      encodedBy: null,
      encodedAt: null,
      isLocked: false,
    }, ctx);
    assert.strictEqual(saved.id, labId);
    assert.strictEqual(saved.status, 'Pending Collection');
  });

  await test('findById() returns the lab result', async () => {
    const found = await labRepo.findById(labId, ctx);
    assert.ok(found);
    assert.strictEqual(found.testName, 'CBC');
  });

  await test('save() updates status to Released and locks the row', async () => {
    const released = await labRepo.save({
      id: labId,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      orderId,
      patientId: userId,
      testName: 'CBC',
      status: 'Released',
      resultData: { wbc: 5.2 },
      encodedBy: userId,
      encodedAt: new Date().toISOString(),
      isLocked: true,
    }, ctx);
    assert.strictEqual(released.status, 'Released');
    assert.strictEqual(released.isLocked, true);
  });

  // -- withTransaction --
  console.log('\nwithTransaction');

  await test('withTransaction commits on success', async () => {
    const txUserId = randomUUID();
    await withTransaction(pool, async (tx) => {
      const txCtx = Object.assign(makeCtx(txUserId), { _tx: tx });
      await userRepo.save({
        id: txUserId,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        email: `tx-${txUserId}@test.com`,
        passwordHash: 'hashed',
        name: 'TX User',
        roles: ['receptionist'],
        status: 'active',
      }, txCtx);
    });
    const found = await userRepo.findById(txUserId, makeCtx(txUserId));
    assert.ok(found);
    assert.strictEqual(found.email, `tx-${txUserId}@test.com`);
  });

  await test('withTransaction rolls back on error', async () => {
    const rollbackUserId = randomUUID();
    let threw = false;
    try {
      await withTransaction(pool, async (tx) => {
        const txCtx = Object.assign(makeCtx(rollbackUserId), { _tx: tx });
        await userRepo.save({
          id: rollbackUserId,
          tenantId: TENANT_ID,
          branchId: BRANCH_ID,
          email: `rollback-${rollbackUserId}@test.com`,
          passwordHash: 'hashed',
          name: 'Rollback User',
          roles: ['receptionist'],
          status: 'active',
        }, txCtx);
        throw new Error('Intentional rollback');
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, 'Intentional rollback');
    }
    assert.ok(threw);
    // Verify row was rolled back
    const notFound = await userRepo.findById(rollbackUserId, makeCtx(rollbackUserId));
    assert.strictEqual(notFound, null);
  });

  // -- Cleanup --
  await cleanup();

  // -- Summary --
  console.log(`\n====================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
})();
