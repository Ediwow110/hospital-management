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
 *   - Tenant-scoped user lookup isolation (cross-tenant collision prevention)
 *   - Missing tenantId throws validation error — no silent cross-tenant fallback
 */

const assert = require('assert');
const { randomUUID } = require('crypto');
const { Pool } = require('pg');
const { withTransaction } = require('../src/infrastructure/transaction');
const { PgUserRepository } = require('../src/repositories/pg/PgUserRepository');
const { PgAuditLogRepository } = require('../src/repositories/pg/PgAuditLogRepository');
const { PgLabResultRepository } = require('../src/repositories/pg/PgLabResultRepository');
const { createPgRepositories } = require('../src/repositories/pg-repositories');

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
    failures.push({ name: name, error: err.message });
  }
}

async function seedTenant(planId, label) {
  var slug = label + '-' + randomUUID().slice(0, 8);
  var tenantRes = await pool.query(
    'INSERT INTO tenants (name, slug, plan_id) VALUES ($1, $2, $3) RETURNING id',
    [label + ' Tenant', slug, planId]
  );
  var tenantId = tenantRes.rows[0].id;
  var code = label.slice(0, 2).toUpperCase() + randomUUID().slice(0, 4).toUpperCase();
  var branchRes = await pool.query(
    'INSERT INTO branches (tenant_id, name, code) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, label + ' Branch', code]
  );
  var branchId = branchRes.rows[0].id;
  return { tenantId: tenantId, branchId: branchId };
}

async function seedFixtures() {
  var planRes = await pool.query(
    'INSERT INTO plans (name, features) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
    ['integration-test-plan', '{}']
  );
  var planId = planRes.rows[0].id;
  var main = await seedTenant(planId, 'integration-main');
  var tenantId = main.tenantId;
  var branchId = main.branchId;
  var email = 'actor-' + randomUUID().slice(0, 8) + '@test.local';
  var userRes = await pool.query(
    'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [tenantId, branchId, 'Integration Actor', email, '$2b$10$placeholder', 'superadmin']
  );
  var userId = userRes.rows[0].id;
  return { planId: planId, tenantId: tenantId, branchId: branchId, userId: userId };
}

async function runTests() {
  console.log('Running PostgreSQL integration tests...');

  var fixtures;
  try {
    fixtures = await seedFixtures();
  } catch (err) {
    console.error('Fixture seeding failed:', err.message);
    await pool.end();
    process.exit(1);
  }

  var tenantId = fixtures.tenantId;
  var branchId = fixtures.branchId;
  var userId = fixtures.userId;
  var planId = fixtures.planId;

  console.log('--- Repository instantiation ---');

  await test('PgUserRepository instantiates', async function() {
    var r = new PgUserRepository({ pool: pool });
    assert.ok(r);
  });

  await test('PgAuditLogRepository instantiates', async function() {
    var r = new PgAuditLogRepository({ pool: pool });
    assert.ok(r);
  });

  await test('PgLabResultRepository instantiates', async function() {
    var r = new PgLabResultRepository({ pool: pool });
    assert.ok(r);
  });

  console.log('--- User CRUD via parameterized SQL ---');

  var testUserId;
  await test('INSERT user', async function() {
    var email = 'crud-' + randomUUID().slice(0, 8) + '@test.local';
    var res = await pool.query(
      'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role',
      [tenantId, branchId, 'CRUD User', email, '$2b$10$ph', 'nurse']
    );
    assert.strictEqual(res.rows[0].role, 'nurse');
    testUserId = res.rows[0].id;
  });

  await test('SELECT user by id', async function() {
    var res = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
      [testUserId, tenantId]
    );
    assert.strictEqual(res.rows.length, 1);
  });

  await test('UPDATE user role', async function() {
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['doctor', testUserId]);
    var res = await pool.query('SELECT role FROM users WHERE id = $1', [testUserId]);
    assert.strictEqual(res.rows[0].role, 'doctor');
  });

  console.log('--- audit_logs immutability trigger ---');

  var auditLogId;
  await test('INSERT audit_log row', async function() {
    var payload = JSON.stringify({ test: true });
    var res = await pool.query(
      'INSERT INTO audit_logs (tenant_id, branch_id, actor_user_id, action, entity_type, payload) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, action',
      [tenantId, branchId, userId, 'test.action', 'user', payload]
    );
    assert.ok(res.rows[0].id);
    auditLogId = res.rows[0].id;
  });

  await test('UPDATE audit_log blocked by trigger', async function() {
    var threw = false;
    try {
      await pool.query('UPDATE audit_logs SET action = $1 WHERE id = $2', ['tampered', auditLogId]);
    } catch (err) {
      threw = true;
      assert.ok(
        err.message.includes('immutable') || err.message.includes('audit'),
        'Expected immutability error, got: ' + err.message
      );
    }
    assert.ok(threw, 'UPDATE on audit_logs must throw');
  });

  await test('DELETE audit_log blocked by trigger', async function() {
    var threw = false;
    try {
      await pool.query('DELETE FROM audit_logs WHERE id = $1', [auditLogId]);
    } catch (err) {
      threw = true;
    }
    assert.ok(threw, 'DELETE on audit_logs must throw');
  });

  console.log('--- withTransaction commit and rollback ---');

  await test('withTransaction commits', async function() {
    var email = 'txn-commit-' + randomUUID().slice(0, 8) + '@test.local';
    await withTransaction(pool, async function(client) {
      await client.query(
        'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
        [tenantId, branchId, 'Txn Commit', email, '$2b$10$ph', 'nurse']
      );
    });
    var res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.strictEqual(res.rows.length, 1, 'committed row must exist');
  });

  await test('withTransaction rolls back on error', async function() {
    var email = 'txn-rollback-' + randomUUID().slice(0, 8) + '@test.local';
    try {
      await withTransaction(pool, async function(client) {
        await client.query(
          'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)',
          [tenantId, branchId, 'Txn Rollback', email, '$2b$10$ph', 'nurse']
        );
        throw new Error('deliberate rollback');
      });
    } catch (err) {
      assert.strictEqual(err.message, 'deliberate rollback');
    }
    var res = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    assert.strictEqual(res.rows.length, 0, 'rolled-back row must not exist');
  });

  // -----------------------------------------------------------------------
  // Tenant-scoped user lookup isolation
  // SECURITY: proves multi-tenant authentication cannot cross tenant boundaries.
  // Same email existing in two tenants must never collide during lookup.
  // -----------------------------------------------------------------------
  console.log('--- Tenant-scoped user lookup isolation ---');

  var tenantAInfo;
  var tenantBInfo;
  await test('Seed tenant A and tenant B with same email', async function() {
    tenantAInfo = await seedTenant(planId, 'tenant-a-iso');
    tenantBInfo = await seedTenant(planId, 'tenant-b-iso');

    var sharedEmail = 'shared-' + randomUUID().slice(0, 8) + '@iso.test.local';
    tenantAInfo.sharedEmail = sharedEmail;
    tenantBInfo.sharedEmail = sharedEmail;

    var resA = await pool.query(
      'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [tenantAInfo.tenantId, tenantAInfo.branchId, 'User A', sharedEmail, '$2b$10$phA', 'nurse', 'active']
    );
    var resB = await pool.query(
      'INSERT INTO users (tenant_id, branch_id, full_name, email, password_hash, role, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [tenantBInfo.tenantId, tenantBInfo.branchId, 'User B', sharedEmail, '$2b$10$phB', 'doctor', 'active']
    );
    tenantAInfo.userId = resA.rows[0].id;
    tenantBInfo.userId = resB.rows[0].id;

    assert.ok(tenantAInfo.userId, 'tenant A user must be created');
    assert.ok(tenantBInfo.userId, 'tenant B user must be created');
    assert.notStrictEqual(tenantAInfo.userId, tenantBInfo.userId, 'tenant A and B users must have different IDs');
  });

  await test('Tenant A context returns only tenant A user', async function() {
    var repos = createPgRepositories(pool);
    var ctxA = { tenantId: tenantAInfo.tenantId };
    var user = await repos.users.findActiveByEmail(tenantAInfo.sharedEmail, ctxA);
    assert.ok(user, 'tenant A lookup must return a user');
    assert.strictEqual(user.tenantId, tenantAInfo.tenantId, 'returned user must belong to tenant A');
    assert.strictEqual(user.id, tenantAInfo.userId, 'returned user ID must match tenant A user');
  });

  await test('Tenant B context returns only tenant B user', async function() {
    var repos = createPgRepositories(pool);
    var ctxB = { tenantId: tenantBInfo.tenantId };
    var user = await repos.users.findActiveByEmail(tenantBInfo.sharedEmail, ctxB);
    assert.ok(user, 'tenant B lookup must return a user');
    assert.strictEqual(user.tenantId, tenantBInfo.tenantId, 'returned user must belong to tenant B');
    assert.strictEqual(user.id, tenantBInfo.userId, 'returned user ID must match tenant B user');
  });

  await test('Tenant A context must not return tenant B user', async function() {
    var repos = createPgRepositories(pool);
    var ctxA = { tenantId: tenantAInfo.tenantId };
    var user = await repos.users.findActiveByEmail(tenantAInfo.sharedEmail, ctxA);
    assert.ok(user, 'tenant A lookup must return a result');
    assert.notStrictEqual(
      user.id,
      tenantBInfo.userId,
      'tenant A context MUST NOT return tenant B user — cross-tenant auth isolation failure'
    );
  });

  await test('Tenant B context must not return tenant A user', async function() {
    var repos = createPgRepositories(pool);
    var ctxB = { tenantId: tenantBInfo.tenantId };
    var user = await repos.users.findActiveByEmail(tenantBInfo.sharedEmail, ctxB);
    assert.ok(user, 'tenant B lookup must return a result');
    assert.notStrictEqual(
      user.id,
      tenantAInfo.userId,
      'tenant B context MUST NOT return tenant A user — cross-tenant auth isolation failure'
    );
  });

  await test('Missing tenantId throws validation error — no silent cross-tenant fallback', async function() {
    var repos = createPgRepositories(pool);
    var threw = false;
    var errCode;
    try {
      await repos.users.findActiveByEmail('anyone@test.local', null);
    } catch (err) {
      threw = true;
      errCode = err.code;
    }
    assert.ok(threw, 'Missing tenantId must throw — must not silently return cross-tenant results');
    assert.strictEqual(errCode, 'validation_error', 'Error code must be validation_error, got: ' + errCode);
  });

  await test('Empty context object without tenantId throws validation error', async function() {
    var repos = createPgRepositories(pool);
    var threw = false;
    try {
      await repos.users.findActiveByEmail('anyone@test.local', {});
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'validation_error');
    }
    assert.ok(threw, 'Empty context without tenantId must throw');
  });

  // Print results BEFORE pool.end() so exit code is correct regardless of cleanup.
  console.log('='.repeat(60));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  var exitCode = failures.length > 0 ? 1 : 0;
  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach(function(f) { console.log('  - ' + f.name + ': ' + f.error); });
  } else {
    console.log('All PostgreSQL integration tests passed.');
  }

  // Best-effort pool close; CI container is ephemeral.
  try { await pool.end(); } catch (e) { void e; }
  process.exit(exitCode);
}

runTests().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
