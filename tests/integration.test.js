'use strict';

/**
 * PR #4 - PostgreSQL Persistence Foundation
 * Integration tests using a live PostgreSQL container.
 *
 * Requires DATABASE_URL env variable.
 * Run after migrations with: npm run test:integration
 *
 * Tests assert:
 *   - Pg repositories load and are constructible
 *   - withTransaction commits and rolls back correctly
 *   - audit_logs are immutable (DB trigger enforced)
 *   - Basic user CRUD via parameterized SQL
 */

const assert = require('assert');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { withTransaction } = require('../src/infrastructure/transaction');
const { PgUserRepository } = require('../src/repositories/pg/PgUserRepository');
const { PgAuditLogRepository } = require('../src/repositories/pg/PgAuditLogRepository');
const { PgLabResultRepository } = require('../src/repositories/pg/PgLabResultRepository');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log('  PASS  ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL  ' + name + ': ' + err.message);
    failed++;
    failures.push({ name, error: err.message });
  }
}

async function seedFixtures() {
  const planRes = await pool.query(
    "INSERT INTO plans (name, features) VALUES ($1, '{}') ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
    ['integration-test-plan']
  );
  const planId = planRes.rows[0].id;
  const slug = 'integration-' + randomUUID().slice(0, 8);
  const tenantRes = await pool.query(
    'INSERT INTO tenants (name, slug, plan_id) VALUES ($1, $2, $3) RETURNING id',
    ['Integration Tenant', slug, planId]
  );
  const tenantId = tenantRes.rows[0].id;
  const code = 'INTB' + randomUUID().slice(0, 4).toUpperCase();
  const branchRes = await pool.query(
    'INSERT INTO branches (tenant_id, name, code) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, 'Integration Branch', code]
  );
  const branchId = branchRes.rows[0].id;
  const email = 'actor-' + randomUUID().slice(0, 8) + '@test.local';
  const userRes = await pool.query(
    'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [tenantId, branchId, 'Integration Actor', email, '$2b$10$placeholder', 'superadmin']
  );
  const userId = userRes.rows[0].id;
  return { planId, tenantId, branchId, userId };
}

async function cleanup(tenantId) {
  try { await pool.query('DELETE FROM approval_requests WHERE tenant_id = $1', [tenantId]); } catch (_) {}
  try { await pool.query('DELETE FROM audit_logs WHERE tenant_id = $1', [tenantId]); } catch (_) {}
  await pool.query('DELETE FROM users WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM branches WHERE tenant_id = $1', [tenantId]);
  await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
}

async function runTests() {
  console.log('\nRunning PostgreSQL integration tests...');

  let fixtures;
  try {
    fixtures = await seedFixtures();
  } catch (err) {
    console.error('Fixture seeding failed:', err.message);
    await pool.end();
    process.exit(1);
  }

  const { tenantId, branchId, userId } = fixtures;

  console.log('--- Repository instantiation ---');

  await test('PgUserRepository instantiates', async () => {
    const r = new PgUserRepository({ pool });
    assert.ok(r);
  });

  await test('PgAuditLogRepository instantiates', async () => {
    const r = new PgAuditLogRepository({ pool });
    assert.ok(r);
  });

  await test('PgLabResultRepository instantiates', async () => {
    const r = new PgLabResultRepository({ pool });
    assert.ok(r);
  });

  console.log('\n--- User CRUD via parameterized SQL ---');

  let testUserId;
  await test('INSERT user with parameterized SQL', async () => {
    const email = 'crud-' + randomUUID().slice(0, 8) + '@test.local';
    const res = await pool.query(
      'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role',
      [tenantId, branchId, 'CRUD User', email, '$2b$10$ph', 'nurse']
    );
    assert.strictEqual(res.rows[0].role, 'nurse');
    testUserId = res.rows[0].id;
  });

  await test('SELECT user by id', async () => {
    const res = await pool.query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2', [testUserId, tenantId]);
    assert.strictEqual(res.rows.length, 1);
  });

  await test('UPDATE user role', async () => {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['doctor', testUserId]);
    const res = await pool.query('SELECT role FROM users WHERE id = $1', [testUserId]);
    assert.strictEqual(res.rows[0].role, 'doctor');
  });

  console.log('\n--- audit_logs immutability trigger ---');

  let auditLogId;
  await test('INSERT audit_log row', async () => {
    const res = await pool.query(
      "INSERT INTO audit_logs (tenant_id, branch_id, actor_user_id, action, entity_type, payload) VALUES ($1, $2, $3, $4, $5, '{""test\"":true}') RETURNING id, action",
      [tenantId, branchId, userId, 'test.action', 'user']
    );
    assert.ok(res.rows[0].id);
    auditLogId = res.rows[0].id;
  });

  await test('UPDATE audit_log is blocked by trigger', async () => {
    let threw = false;
    try {
      await pool.query('UPDATE audit_logs SET action = $1 WHERE id = $2', ['tampered', auditLogId]);
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('immutable') || err.message.includes('audit'), 'Expected immutability error: ' + err.message);
    }
    assert.ok(threw, 'UPDATE on audit_logs must throw');
  });

  await test('DELETE audit_log is blocked by trigger', async () => {
    let threw = false;
    try {
      await pool.query('DELETE FROM audit_logs WHERE id = $1', [auditLogId]);
    } catch (err) {
      threw = true;
    }
    assert.ok(threw, 'DELETE on audit_logs must throw');
  });

  console.log('\n--- withTransaction commit and rollback ---');

  await test('withTransaction commits', async () => {
    const email = 'txn-commit-' + randomUUID().slice(0, 8) + '@test.local';
    await withTransaction(pool, async (client) => {
      await client.query(
        'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenantId, branchId, 'Txn Commit', email, '$2b$10$ph', 'nurse']
      );
    });
    const res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.strictEqual(res.rows.length, 1, 'committed row must exist');
  });

  await test('withTransaction rolls back on error', async () => {
    const email = 'txn-rollback-' + randomUUID().slice(0, 8) + '@test.local';
    try {
      await withTransaction(pool, async (client) => {
        await client.query(
          'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
          [tenantId, branchId, 'Txn Rollback', email, '$2b$10$ph', 'nurse']
        );
        throw new Error('deliberate rollback');
      });
    } catch (err) {
      assert.strictEqual(err.message, 'deliberate rollback');
    }
    const res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.strictEqual(res.rows.length, 0, 'rolled-back row must not exist');
  });

  await cleanup(tenantId);
  await pool.end();

  console.log('\n' + '='.repeat(60));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(function(f) { console.log('  - ' + f.name + ': ' + f.error); });
    process.exit(1);
  } else {
    console.log('All PostgreSQL integration tests passed.');
  }
}

runTests().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
