'use strict';

/**
 * PR #3 - Production-Grade Backend Foundation
 * Backend workflow tests using in-memory adapters.
 *
 * Tests cover all mandatory HMS workflows:
 *   health check, login/demo auth, patient registration,
 *   order creation, payment posting, cashier session open/close,
 *   specimen collection, lab result encode/validate/approve/release.
 *
 * NOTE: In-memory adapters are for development/test only.
 * PostgreSQL persistence is implemented in PR #4.
 */

const assert = require('assert');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

// Test password and its bcrypt hash for auth fixtures
const TEST_PASSWORD = 'password123';const { AppContext } = require('../src/core/AppContext');

const { AppError, ERROR_CODES } = require('../src/core/AppError');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../src/core/permissions');
const { assertLabTransition } = require('../src/core/workflow');

const { InMemoryUserRepository } = require('../src/repositories/memory/InMemoryUserRepository');
const { InMemoryAuditLogRepository } = require('../src/repositories/memory/InMemoryAuditLogRepository');
const { InMemoryPatientRepository } = require('../src/repositories/memory/InMemoryPatientRepository');
const { InMemoryOrderRepository } = require('../src/repositories/memory/InMemoryOrderRepository');
const { InMemoryInvoiceRepository } = require('../src/repositories/memory/InMemoryInvoiceRepository');
const { InMemoryPaymentRepository } = require('../src/repositories/memory/InMemoryPaymentRepository');
const { InMemoryCashierSessionRepository } = require('../src/repositories/memory/InMemoryCashierSessionRepository');
const { InMemoryLabResultRepository } = require('../src/repositories/memory/InMemoryLabResultRepository');

const { AuditService } = require('../src/services/AuditService');
const { AuthService } = require('../src/services/AuthService');
const { HealthService } = require('../src/services/HealthService');
const { PatientService } = require('../src/services/PatientService');
const { OrderService } = require('../src/services/OrderService');
const { BillingService } = require('../src/services/BillingService');
const { LabService } = require('../src/services/LabService');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-test';
const BRANCH_ID = 'branch-main';

/**
 * Build an AppContext for a given userId and role.
 * Use 'superadmin' to get all permissions.
 * Use empty array for no permissions.
 */
function makeCtx({ userId = 'user-1', roles = ['superadmin'] } = {}) {
  const permissions = roles.flatMap(r => ROLE_PERMISSIONS[r] || []);
  return new AppContext({
    requestId: randomUUID(),
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    userId,
    roles,
    permissions,
    ipAddress: '127.0.0.1',
    deviceInfo: 'test-runner',
  });
}

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

// ---------------------------------------------------------------------------
// Bootstrap shared services
// ---------------------------------------------------------------------------

const auditLogRepo = new InMemoryAuditLogRepository();
const auditService = new AuditService({ auditLogRepo });

const userRepo = new InMemoryUserRepository();
const patientRepo = new InMemoryPatientRepository();
const orderRepo = new InMemoryOrderRepository();
const invoiceRepo = new InMemoryInvoiceRepository();
const paymentRepo = new InMemoryPaymentRepository();
const cashierSessionRepo = new InMemoryCashierSessionRepository();
const labResultRepo = new InMemoryLabResultRepository();

const authService = new AuthService({ userRepo, auditService });
const healthService = new HealthService();
const patientService = new PatientService({ patientRepo, auditService });
const orderService = new OrderService({ orderRepo, invoiceRepo, auditService });
const billingService = new BillingService({ invoiceRepo, paymentRepo, cashierSessionRepo, auditService });
const labService = new LabService({ labResultRepo, auditService });

// Seed a test user (passwordHash = plaintext for demo per AuthService docs)
const TEST_USER_ID = randomUUID();
  const testPasswordHash = bcrypt.hashSync(TEST_PASSWORD, 10);
userRepo._set(TEST_USER_ID, {
  id: TEST_USER_ID,
  tenantId: TENANT_ID,
  branchId: BRANCH_ID,
  email: 'admin@test.com',
    passwordHash: testPasswordHash,
  name: 'Test Admin',
  roles: ['superadmin'],
  status: 'active',
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

(async () => {
  console.log('\nPR #3 Backend Workflow Tests');
  console.log('==============================\n');

  // -- Health Check --
  console.log('Health Check');
  await test('health check returns status ok', async () => {
    const result = healthService.check();
    assert.strictEqual(result.status, 'ok');
    assert.ok(result.timestamp);
  });

  // -- Auth --
  console.log('\nAuth');
  await test('login with valid credentials returns token and user', async () => {
    const result = await authService.login(
      'admin@test.com',
      TEST_PASSWORD,
      TENANT_ID,
      '127.0.0.1',
      'test-runner'
    );
    assert.ok(result.token);
    assert.strictEqual(result.user.email, 'admin@test.com');
  });

  await test('login with wrong password throws PERMISSION_DENIED', async () => {
    let threw = false;
    try {
      await authService.login('admin@test.com', 'wrongpass', TENANT_ID, '127.0.0.1');
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
    assert.ok(threw, 'Expected error to be thrown');
  });

  await test('verifyToken returns valid AppContext', async () => {
    const { token } = await authService.login('admin@test.com', TEST_PASSWORD, TENANT_ID, '127.0.0.1');
    const ctx = authService.verifyToken(token, randomUUID(), '127.0.0.1');
    assert.ok(ctx instanceof AppContext);
    assert.strictEqual(ctx.tenantId, TENANT_ID);
  });

  // -- Patient Registration --
  console.log('\nPatient Registration');
  const adminCtx = makeCtx({ userId: TEST_USER_ID, roles: ['superadmin'] });

  let patient;
  await test('register patient succeeds with required fields', async () => {
    patient = await patientService.registerPatient({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      sex: 'F',
      phone: '555-0100',
    }, adminCtx);
    assert.ok(patient.id);
    assert.ok(patient.mrn);
    assert.strictEqual(patient.firstName, 'Jane');
  });

  await test('register patient fails without permission', async () => {
    const noPermCtx = makeCtx({ userId: 'nobody', roles: [] });
    let threw = false;
    try {
      await patientService.registerPatient({ firstName: 'X', lastName: 'Y', dateOfBirth: '2000-01-01' }, noPermCtx);
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
    assert.ok(threw);
  });

  await test('register patient fails with missing required fields', async () => {
    let threw = false;
    try {
      await patientService.registerPatient({ firstName: 'No' }, adminCtx);
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.VALIDATION_ERROR);
    }
    assert.ok(threw);
  });

  // -- Order Creation --
  console.log('\nOrder Creation');

  let order;
  let invoice;
  await test('createOrder returns order and invoice', async () => {
    assert.ok(patient, 'Prerequisite: patient must exist');
    const result = await orderService.createOrder({
      patientId: patient.id,
      items: [
        { description: 'CBC', qty: 1, unitPrice: 500 },
        { description: 'Urinalysis', qty: 2, unitPrice: 200 },
      ],
    }, adminCtx);
    order = result.order;
    invoice = result.invoice;
    assert.ok(order.id);
    assert.ok(invoice.id);
    assert.strictEqual(order.status, 'Pending');
    assert.strictEqual(invoice.status, 'Unpaid');
    assert.strictEqual(invoice.total, 900);
  });

  await test('createOrder fails without permission', async () => {
    const noPermCtx = makeCtx({ userId: 'nobody', roles: [] });
    let threw = false;
    try {
      await orderService.createOrder(
        { patientId: 'pid', items: [{ description: 'X', qty: 1, unitPrice: 10 }] },
        noPermCtx
      );
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
    assert.ok(threw);
  });

  // -- Cashier Session --
  console.log('\nCashier Session');

  const cashierUserId = 'cashier-1';
  const cashierCtx = makeCtx({ userId: cashierUserId, roles: ['superadmin'] });

  let session;
  await test('open cashier session succeeds', async () => {
    session = await billingService.openSession({ startingCash: 5000 }, cashierCtx);
    assert.ok(session.id);
    assert.strictEqual(session.status, 'Open');
    assert.strictEqual(session.userId, cashierUserId);
  });

  await test('open second session for same user throws DUPLICATE_RECORD', async () => {
    let threw = false;
    try {
      await billingService.openSession({ startingCash: 1000 }, cashierCtx);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, ERROR_CODES.DUPLICATE_RECORD);
    }
    assert.ok(threw);
  });

  // -- Payment Posting --
  console.log('\nPayment Posting');

  await test('postPayment reduces invoice balance', async () => {
    assert.ok(invoice, 'Prerequisite: invoice must exist');
    assert.ok(session, 'Prerequisite: session must exist');
    const result = await billingService.postPayment(invoice.id, {
      amount: 500,
      method: 'cash',
      cashierSessionId: session.id,
    }, adminCtx);
    assert.ok(result.invoice);
    assert.strictEqual(result.invoice.balance, 400);
    assert.strictEqual(result.invoice.status, 'Partially Paid');
  });

  await test('postPayment pays invoice in full', async () => {
    assert.ok(invoice, 'Prerequisite: invoice must exist');
    const result = await billingService.postPayment(invoice.id, {
      amount: 400,
      method: 'cash',
      cashierSessionId: session.id,
    }, adminCtx);
    assert.strictEqual(result.invoice.status, 'Paid');
    assert.strictEqual(result.invoice.balance, 0);
  });

  await test('postPayment on Paid invoice throws error', async () => {
    assert.ok(invoice, 'Prerequisite: invoice must exist');
    let threw = false;
    try {
      await billingService.postPayment(
        invoice.id,
        { amount: 1, method: 'cash', cashierSessionId: session.id },
        adminCtx
      );
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AppError);
    }
    assert.ok(threw);
  });

  // -- Cashier Session Close (owner-only) --
  console.log('\nCashier Session Close');

  await test('non-owner cannot close cashier session', async () => {
    assert.ok(session, 'Prerequisite: session must exist');
    const otherCtx = makeCtx({ userId: 'other-user', roles: ['receptionist'] });
    let threw = false;
    try {
      await billingService.closeSession(session.id, { closingCash: 5500 }, otherCtx);
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
    assert.ok(threw);
  });

  await test('owner can close own cashier session', async () => {
    assert.ok(session, 'Prerequisite: session must exist');
    const closed = await billingService.closeSession(session.id, { closingCash: 5500 }, cashierCtx);
    assert.strictEqual(closed.status, 'Closed');
    assert.ok(closed.closedAt);
  });

  // -- Lab Workflow --
  console.log('\nLab Workflow');

  let labResult;
  await test('createResult creates lab result in Pending Collection', async () => {
    assert.ok(order, 'Prerequisite: order must exist');
    labResult = await labService.createResult({
      orderId: order.id,
      patientId: patient.id,
      testName: 'CBC',
    }, adminCtx);
    assert.ok(labResult.id);
    assert.strictEqual(labResult.status, 'Pending Collection');
  });

  await test('collectSpecimen transitions to Collected', async () => {
    assert.ok(labResult, 'Prerequisite: lab result must exist');
    labResult = await labService.collectSpecimen(labResult.id, adminCtx);
    assert.strictEqual(labResult.status, 'Collected');
  });

  await test('encodeResult transitions to Encoded', async () => {
    assert.ok(labResult, 'Prerequisite: lab result must exist');
    labResult = await labService.encodeResult(labResult.id, {
      resultData: { wbc: 5.2, rbc: 4.8, hgb: 13.5 },
    }, adminCtx);
    assert.strictEqual(labResult.status, 'Encoded');
    assert.ok(labResult.resultData);
  });

  await test('validateResult transitions to Validated', async () => {
    assert.ok(labResult, 'Prerequisite: lab result must exist');
    labResult = await labService.validateResult(labResult.id, adminCtx);
    assert.strictEqual(labResult.status, 'Validated');
  });

  await test('approveResult transitions to Approved', async () => {
    assert.ok(labResult, 'Prerequisite: lab result must exist');
    labResult = await labService.approveResult(labResult.id, adminCtx);
    assert.strictEqual(labResult.status, 'Approved');
  });

  await test('releaseResult transitions to Released', async () => {
    assert.ok(labResult, 'Prerequisite: lab result must exist');
    labResult = await labService.releaseResult(labResult.id, adminCtx);
    assert.strictEqual(labResult.status, 'Released');
  });

  await test('invalid lab transition throws typed error', async () => {
    let threw = false;
    try {
      assertLabTransition('Released', 'Collected');
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.INVALID_WORKFLOW_TRANSITION);
    }
    assert.ok(threw);
  });

  // -- Summary --
  console.log(`\n==============================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('==============================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
