const assert = require('assert');
const rules = require('../src/core/production-rules');

const manager = {
  id: 'u-manager',
  role: 'manager',
  tenantId: 'tenant-a',
  branchIds: ['branch-1']
};

const cashier = {
  id: 'u-cashier',
  role: 'cashier',
  tenantId: 'tenant-a',
  branchIds: ['branch-1']
};

function testTenantAndBranchIsolation() {
  assert.strictEqual(rules.canAccessRecord(manager, { tenantId: 'tenant-a', branchId: 'branch-1' }, 'report.export'), true);
  assert.strictEqual(rules.canAccessRecord(manager, { tenantId: 'tenant-b', branchId: 'branch-1' }, 'report.export'), false);
  assert.strictEqual(rules.canAccessRecord(manager, { tenantId: 'tenant-a', branchId: 'branch-2' }, 'report.export'), false);
}

function testWorkflowEngine() {
  assert.strictEqual(rules.canTransition('labResult', 'Encoded', 'Validated'), true);
  assert.strictEqual(rules.canTransition('labResult', 'Encoded', 'Released'), false);
  assert.strictEqual(rules.canTransition('invoice', 'Paid', 'Refunded'), true);
  assert.throws(() => rules.assertTransition('order', 'Voided', 'Paid'), /cannot move/);
}

function testDangerousReasonRules() {
  assert.throws(() => rules.requireReason('payment.refund', ''), /requires a reason/);
  assert.strictEqual(rules.requireReason('patient.view', ''), true);
}

function testApprovalEngine() {
  const approval = rules.buildApprovalRequest({
    id: 'APR-1',
    type: 'refund',
    module: 'billing',
    recordType: 'invoice',
    recordId: 'INV-1',
    reason: 'Duplicate payment',
    requestedByUserId: cashier.id,
    tenantId: 'tenant-a',
    branchId: 'branch-1'
  });
  assert.strictEqual(rules.canReviewApproval(cashier, approval, 'billing.refund.approve'), false);
  assert.strictEqual(rules.canReviewApproval(manager, approval, 'billing.refund.approve'), true);
  const approved = rules.applyApprovalDecision({
    approval,
    reviewer: manager,
    approved: true,
    reason: 'Verified duplicate payment',
    requiredPermission: 'billing.refund.approve',
    now: '2026-05-08T00:00:00.000Z'
  });
  assert.strictEqual(approved.status, 'Approved');
  assert.strictEqual(approved.reviewedByUserId, manager.id);
}

function testAuditEngine() {
  const event = rules.createAuditEvent({
    id: 'AUD-1',
    user: manager,
    module: 'billing',
    action: 'payment.refund',
    recordType: 'invoice',
    recordId: 'INV-1',
    oldValues: { status: 'Paid' },
    newValues: { status: 'Refunded' },
    reason: 'Approved duplicate payment refund',
    ipAddress: '127.0.0.1',
    deviceInfo: 'test',
    now: '2026-05-08T00:00:00.000Z'
  });
  assert.strictEqual(event.userId, manager.id);
  assert.strictEqual(event.reason, 'Approved duplicate payment refund');
  assert.strictEqual(Object.isFrozen(event), true);
  event.reason = 'mutated';
  assert.strictEqual(event.reason, 'Approved duplicate payment refund');
}

function testPaymentIdempotencyAndLocks() {
  const invoice = { status: 'Unpaid', balance: 450, isLocked: false };
  assert.strictEqual(rules.validatePayment({ invoice, amount: 450, idempotencyKey: 'pay-1' }).ok, true);
  assert.strictEqual(rules.validatePayment({ invoice, amount: 450 }).ok, false);
  assert.strictEqual(rules.validatePayment({ invoice, amount: 451, idempotencyKey: 'pay-2' }).ok, false);
  assert.strictEqual(rules.validatePayment({ invoice, amount: 451, idempotencyKey: 'pay-2', overpaymentEnabled: true }).ok, true);
  assert.strictEqual(rules.validatePayment({ invoice, amount: 100, idempotencyKey: 'pay-1', priorIdempotencyKeys: new Set(['pay-1']) }).ok, false);
  assert.strictEqual(rules.validatePayment({ invoice: { status: 'Voided', balance: 100, isLocked: true }, amount: 10, idempotencyKey: 'pay-3' }).ok, false);
}

function testNotificationPrivacy() {
  assert.strictEqual(rules.isNotificationPrivacySafe('Your laboratory result is available. Please log in securely.'), true);
  assert.strictEqual(rules.isNotificationPrivacySafe('CBC result: Hemoglobin 13.5 g/dL'), false);
  assert.strictEqual(rules.redactMedicalContent('Diagnosis: pneumonia'), 'A new secure document is available in your patient portal.');
}

function testNumberingAndFeatureFlags() {
  assert.strictEqual(rules.buildNumber({ prefix: 'LAB', year: 2026, nextValue: 42 }), 'LAB-2026-000042');
  const tenant = { id: 'tenant-a', featureFlags: ['enable_lis', 'enable_inventory'] };
  assert.strictEqual(rules.featureEnabled(tenant, 'enable_lis'), true);
  assert.throws(() => rules.requireFeature(tenant, 'enable_ai'), /not enabled/);
}

testTenantAndBranchIsolation();
testWorkflowEngine();
testDangerousReasonRules();
testApprovalEngine();
testAuditEngine();
testPaymentIdempotencyAndLocks();
testNotificationPrivacy();
testNumberingAndFeatureFlags();

console.log('All production rule tests passed.');
