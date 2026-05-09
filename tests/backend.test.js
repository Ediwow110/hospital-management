'use strict';

/**
 * PR #3 — Production-Grade Backend Foundation
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

const AppContext = require('../src/core/AppContext');
const { AppError, ERROR_CODES } = require('../src/core/AppError');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../src/core/permissions');
const { assertLabTransition, assertCashierTransition } = require('../src/core/workflow');

const InMemoryUserRepository = require('../src/repositories/memory/InMemoryUserRepository');
const InMemoryAuditLogRepository = require('../src/repositories/memory/InMemoryAuditLogRepository');
const InMemoryPatientRepository = require('../src/repositories/memory/InMemoryPatientRepository');
const InMemoryOrderRepository = require('../src/repositories/memory/InMemoryOrderRepository');
const InMemoryInvoiceRepository = require('../src/repositories/memory/InMemoryInvoiceRepository');
const InMemoryPaymentRepository = require('../src/repositories/memory/InMemoryPaymentRepository');
const InMemoryCashierSessionRepository = require('../src/repositories/memory/InMemoryCashierSessionRepository');
const InMemoryLabResultRepository = require('../src/repositories/memory/InMemoryLabResultRepository');
const InMemoryInventoryRepository = require('../src/repositories/memory/InMemoryInventoryRepository');
const InMemoryNotificationRepository = require('../src/repositories/memory/InMemoryNotificationRepository');
const InMemoryApprovalRepository = require('../src/repositories/memory/InMemoryApprovalRepository');
const InMemorySettingsRepository = require('../src/repositories/memory/InMemorySettingsRepository');

const AuditService = require('../src/services/AuditService');
const AuthService = require('../src/services/AuthService');
const HealthService = require('../src/services/HealthService');
const PatientService = require('../src/services/PatientService');
const OrderService = require('../src/services/OrderService');
const BillingService = require('../src/services/BillingService');
const LabService = require('../src/services/LabService');
const InventoryService = require('../src/services/InventoryService');

// ─── Test Helpers ────────────────────────────────────────────────────────────

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

function makeCtx({ tenantId = 'tenant-1', branchId = 'branch-1', userId = 'u-test', roles = ['superadmin'] } = {}) {
  const perms = roles.flatMap(r => ROLE_PERMISSIONS[r] || []);
  return new AppContext({
    requestId: randomUUID(),
    tenantId,
    branchId,
    userId,
    roles,
    permissions: perms,
  });
}

function buildDeps() {
  const userRepo = new InMemoryUserRepository();
  const auditRepo = new InMemoryAuditLogRepository();
  const patientRepo = new InMemoryPatientRepository();
  const orderRepo = new InMemoryOrderRepository();
  const invoiceRepo = new InMemoryInvoiceRepository();
  const paymentRepo = new InMemoryPaymentRepository();
  const cashierRepo = new InMemoryCashierSessionRepository();
  const labRepo = new InMemoryLabResultRepository();
  const inventoryRepo = new InMemoryInventoryRepository();
  const notifRepo = new InMemoryNotificationRepository();
  const approvalRepo = new InMemoryApprovalRepository();
  const settingsRepo = new InMemorySettingsRepository();

  const auditService = new AuditService({ auditLogRepo: auditRepo });
  const authService = new AuthService({ userRepo, auditService });
  const healthService = new HealthService();
  const patientService = new PatientService({ patientRepo, auditService });
  const orderService = new OrderService({ orderRepo, invoiceRepo, patientRepo, auditService });
  const billingService = new BillingService({ invoiceRepo, paymentRepo, cashierRepo, auditService });
  const labService = new LabService({ labResultRepo: labRepo, auditService });
  const inventoryService = new InventoryService({ inventoryRepo, approvalRepo, auditService });

  // Seed demo user (dev/test only — plaintext hash, PR #4 replaces with bcrypt)
  const seedCtx = makeCtx({ userId: 'system', roles: ['superadmin'] });
  userRepo.save({
    id: 'u-admin',
    tenantId: 'tenant-1',
    email: 'admin@hospital.local',
    passwordHash: 'HmsDemo2026!',
    roles: ['superadmin'],
    isActive: true,
  }, seedCtx);

  return { authService, healthService, patientService, orderService, billingService, labService, inventoryService, auditService };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

async function runSuite() {
  const { authService, healthService, patientService, orderService, billingService, labService } = buildDeps();
  const ctx = makeCtx();

  // 1. Health Check
  console.log('\n[1] Health Check');
  await test('health check returns status ok', async () => {
    const result = await healthService.check();
    assert.strictEqual(result.status, 'ok');
  });

  // 2. Login / Demo Auth
  console.log('\n[2] Login / Demo Auth');
  let sessionUserId;
  await test('demo login succeeds with correct credentials', async () => {
    const result = await authService.login('admin@hospital.local', 'HmsDemo2026!', 'tenant-1', '127.0.0.1');
    assert.ok(result.token, 'token must be returned');
    sessionUserId = result.user.id;
  });

  await test('login fails with wrong password', async () => {
    try {
      await authService.login('admin@hospital.local', 'wrong-password', 'tenant-1', '127.0.0.1');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError, 'must throw AppError');
      assert.strictEqual(err.code, ERROR_CODES.UNAUTHORIZED);
    }
  });

  await test('login fails with unknown user', async () => {
    try {
      await authService.login('noone@hospital.local', 'pass', 'tenant-1', '127.0.0.1');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.UNAUTHORIZED);
    }
  });

  // 3. Patient Registration
  console.log('\n[3] Patient Registration');
  let patient;
  await test('registers a new patient successfully', async () => {
    patient = await patientService.registerPatient({
      firstName: 'Maria',
      lastName: 'Santos',
      dateOfBirth: '1991-03-14',
      sex: 'female',
      phone: '09171234567',
    }, ctx);
    assert.ok(patient.id, 'patient must have id');
    assert.ok(patient.mrn, 'patient must have MRN');
    assert.strictEqual(patient.firstName, 'Maria');
  });

  await test('patient registration requires permission', async () => {
    const noPermCtx = makeCtx({ userId: 'u-noperm', roles: [] });
    try {
      await patientService.registerPatient({
        firstName: 'X', lastName: 'Y', dateOfBirth: '2000-01-01',
      }, noPermCtx);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
  });

  await test('patient registration requires firstName, lastName, dateOfBirth', async () => {
    try {
      await patientService.registerPatient({ firstName: 'Only' }, ctx);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.VALIDATION_ERROR);
    }
  });

  // 4. Order Creation
  console.log('\n[4] Order Creation');
  let order;
  await test('creates an order for a patient', async () => {
    order = await orderService.createOrder({
      patientId: patient.id,
      items: [{ serviceId: 'svc-cbc', description: 'CBC', price: 250 }],
    }, ctx);
    assert.ok(order.id, 'order must have id');
    assert.strictEqual(order.patientId, patient.id);
  });

  await test('order creation requires ORDER_CREATE permission', async () => {
    const noPermCtx = makeCtx({ userId: 'u-noperm', roles: [] });
    try {
      await orderService.createOrder({ patientId: patient.id, items: [] }, noPermCtx);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
  });

  // 5. Payment Posting
  console.log('\n[5] Payment Posting');
  let cashierSession;
  await test('opens a cashier session', async () => {
    cashierSession = await billingService.openCashierSession({ openingBalance: 5000 }, ctx);
    assert.ok(cashierSession.id);
    assert.strictEqual(cashierSession.status, 'open');
    assert.strictEqual(cashierSession.openedBy, ctx.userId);
  });

  let payment;
  await test('posts a payment against an invoice', async () => {
    // Get invoice created with the order
    const invoice = await billingService.getInvoiceByOrder(order.id, ctx);
    assert.ok(invoice, 'invoice must exist');
    payment = await billingService.postPayment({
      invoiceId: invoice.id,
      cashierSessionId: cashierSession.id,
      amount: invoice.totalAmount,
      method: 'cash',
    }, ctx);
    assert.ok(payment.id);
    assert.strictEqual(payment.status, 'posted');
  });

  // 6. Cashier Session Close (owner-only)
  console.log('\n[6] Cashier Session Close');
  await test('owner can close their cashier session', async () => {
    const closed = await billingService.closeCashierSession(cashierSession.id, { closingBalance: 5250 }, ctx);
    assert.strictEqual(closed.status, 'closed');
  });

  await test('non-owner cannot close a session opened by another user', async () => {
    const otherCtx = makeCtx({ userId: 'u-other', roles: ['superadmin'] });
    const session2 = await billingService.openCashierSession({ openingBalance: 0 }, ctx);
    try {
      await billingService.closeCashierSession(session2.id, { closingBalance: 0 }, otherCtx);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
    }
  });

  // 7. Specimen Collection
  console.log('\n[7] Specimen Collection');
  let labResult;
  await test('creates a lab result in Pending Collection state', async () => {
    labResult = await labService.createResult({
      orderId: order.id,
      patientId: patient.id,
      testName: 'CBC',
    }, ctx);
    assert.ok(labResult.id);
    assert.strictEqual(labResult.status, 'Pending Collection');
  });

  await test('collects specimen (transitions to Collected)', async () => {
    labResult = await labService.collectSpecimen(labResult.id, { specimenId: 'SP-001' }, ctx);
    assert.strictEqual(labResult.status, 'Collected');
  });

  // 8. Lab Result: Encode / Validate / Approve / Release
  console.log('\n[8] Lab Result Workflow');
  await test('encodes result (Collected -> Encoded)', async () => {
    labResult = await labService.encodeResult(labResult.id, { values: { wbc: '7.2', rbc: '4.5' } }, ctx);
    assert.strictEqual(labResult.status, 'Encoded');
  });

  await test('validates result (Encoded -> Validated)', async () => {
    labResult = await labService.validateResult(labResult.id, ctx);
    assert.strictEqual(labResult.status, 'Validated');
  });

  await test('approves result (Validated -> Approved)', async () => {
    labResult = await labService.approveResult(labResult.id, ctx);
    assert.strictEqual(labResult.status, 'Approved');
  });

  await test('releases result (Approved -> Released)', async () => {
    labResult = await labService.releaseResult(labResult.id, ctx);
    assert.strictEqual(labResult.status, 'Released');
  });

  await test('released results cannot be directly updated (immutability)', async () => {
    try {
      // Attempt invalid transition from Released
      await labService.encodeResult(labResult.id, { values: { wbc: '9.0' } }, ctx);
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, ERROR_CODES.WORKFLOW_VIOLATION);
    }
  });

  // 9. Workflow: Invalid Transitions Return Typed Errors
  console.log('\n[9] Typed Workflow Errors');
  await test('invalid lab transition returns WORKFLOW_VIOLATION AppError', async () => {
    try {
      assertLabTransition('Pending Collection', 'Released');
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError, 'must be AppError not generic Error');
      assert.strictEqual(err.code, ERROR_CODES.WORKFLOW_VIOLATION);
    }
  });

  await test('valid lab transitions are allowed', () => {
    assert.doesNotThrow(() => assertLabTransition('Pending Collection', 'Collected'));
    assert.doesNotThrow(() => assertLabTransition('Collected', 'Encoded'));
    assert.doesNotThrow(() => assertLabTransition('Encoded', 'Validated'));
    assert.doesNotThrow(() => assertLabTransition('Validated', 'Approved'));
    assert.doesNotThrow(() => assertLabTransition('Approved', 'Released'));
  });

  // 10. Architecture: Service Layer Uses Repo Contracts Only
  console.log('\n[10] Architecture Guardrails');
  await test('service files do not import pg directly', () => {
    const fs = require('fs');
    const path = require('path');
    const servicesDir = path.join(__dirname, '../src/services');
    const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(servicesDir, file), 'utf8');
      assert.ok(
        !content.includes("require('pg')") && !content.includes('require("pg")'),
        `${file} must not import pg directly — use repository contracts`
      );
    }
  });

  await test('in-memory store is explicitly marked development/test only', () => {
    const fs = require('fs');
    const path = require('path');
    const storeFile = path.join(__dirname, '../src/repositories/memory/InMemoryStore.js');
    const content = fs.readFileSync(storeFile, 'utf8');
    const hasMarker = content.includes('demo') || content.includes('test') || content.includes('NOT') || content.includes('durable');
    assert.ok(hasMarker, 'InMemoryStore.js must be explicitly marked as non-durable dev/test adapter');
  });

  // ─── Results ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
