const assert = require('assert');
const { createRouter } = require('../src/api/router');
const { createInMemoryStore } = require('../src/infrastructure/in-memory-store');

function post(router, path, userId, key, body = {}) {
  return router.handle({
    method: 'POST',
    path,
    headers: { 'x-user-id': userId, 'idempotency-key': key },
    rawBody: JSON.stringify(body)
  });
}

function get(router, path, userId) {
  return router.handle({
    method: 'GET',
    path,
    headers: { 'x-user-id': userId }
  });
}

async function testProductionHappyPath() {
  const store = createInMemoryStore();
  const router = createRouter(store);

  const login = await router.handle({
    method: 'POST',
    path: '/auth/login',
    rawBody: JSON.stringify({ email: 'admin@hospital.local', password: 'HmsDemo2026!', mfaVerified: true })
  });
  assert.strictEqual(login.status, 200);
  assert.ok(login.body.accessToken);

  const patient = await post(router, '/patients', 'u-reception', 'patient-key-0001', {
    firstName: 'Maria',
    lastName: 'Santos',
    birthdate: '1991-03-14',
    sex: 'female',
    mobile: '09171234567'
  });
  assert.strictEqual(patient.status, 201);
  assert.strictEqual(patient.body.data.patientNo, 'P-2026-000001');

  const order = await post(router, '/orders', 'u-reception', 'order-key-0001', {
    patientId: patient.body.data.id,
    items: [{ serviceId: 'svc-cbc', quantity: 1 }]
  });
  assert.strictEqual(order.status, 201);
  assert.strictEqual(order.body.data.invoice.invoiceNo, 'INV-2026-000001');

  const payment = await post(router, `/billing/invoices/${order.body.data.invoice.id}/payments`, 'u-cashier', 'payment-key-0001', {
    paymentMode: 'Cash',
    amount: 450
  });
  assert.strictEqual(payment.status, 201);
  assert.strictEqual(payment.body.data.invoice.status, 'Paid');
  assert.strictEqual(store.queueTickets.length, 1);

  const duplicatePayment = await post(router, `/billing/invoices/${order.body.data.invoice.id}/payments`, 'u-cashier', 'payment-key-0001', {
    paymentMode: 'Cash',
    amount: 450
  });
  assert.deepStrictEqual(duplicatePayment.body, payment.body);

  const labOrder = store.labOrders[0];
  const labResult = store.labResults[0];
  assert.strictEqual((await post(router, `/lab/orders/${labOrder.id}/collect`, 'u-medtech', 'collect-key-001')).status, 200);
  assert.strictEqual((await post(router, `/lab/orders/${labOrder.id}/receive`, 'u-medtech', 'receive-key-001')).status, 200);
  assert.strictEqual((await post(router, `/lab/orders/${labOrder.id}/process`, 'u-medtech', 'process-key-001')).status, 200);
  const encoded = await post(router, `/lab/results/${labResult.id}/encode`, 'u-medtech', 'encode-key-001', {
    items: [{ analyte: 'Hemoglobin', resultValue: '13.5', unit: 'g/dL', referenceRange: '12.0-16.0' }]
  });
  assert.strictEqual(encoded.status, 200);
  assert.strictEqual(encoded.body.data.status, 'Encoded');

  assert.strictEqual((await post(router, `/lab/results/${labResult.id}/validate`, 'u-pathologist', 'validate-key-001')).body.data.status, 'Validated');
  assert.strictEqual((await post(router, `/lab/results/${labResult.id}/approve`, 'u-pathologist', 'approve-key-001')).body.data.status, 'Approved');
  assert.strictEqual((await post(router, `/lab/results/${labResult.id}/release`, 'u-pathologist', 'release-key-001')).body.data.status, 'Released');
  assert.strictEqual(store.notifications[0].body, 'Your laboratory result is available. Please log in securely.');

  const health = await get(router, '/admin/health', 'u-admin');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.status, 'ok');
  assert.ok(store.auditLogs.length >= 10);
}

async function testProductionFailurePaths() {
  const store = createInMemoryStore();
  const router = createRouter(store);

  const noIdempotency = await router.handle({
    method: 'POST',
    path: '/patients',
    headers: { 'x-user-id': 'u-reception' },
    rawBody: JSON.stringify({ firstName: 'A' })
  });
  assert.strictEqual(noIdempotency.status, 400);
  assert.strictEqual(noIdempotency.body.error.code, 'idempotency_key_required');

  const mfaBlocked = await router.handle({
    method: 'POST',
    path: '/auth/login',
    rawBody: JSON.stringify({ email: 'admin@hospital.local', password: 'HmsDemo2026!' })
  });
  assert.strictEqual(mfaBlocked.status, 401);
  assert.strictEqual(mfaBlocked.body.error.code, 'mfa_required');

  const patient = await post(router, '/patients', 'u-reception', 'patient-key-0002', {
    firstName: 'Ana',
    lastName: 'Reyes',
    birthdate: '1990-01-01',
    sex: 'female',
    mobile: '09170000000'
  });
  const crossTenantUser = { ...store.users.find(user => user.id === 'u-reception'), id: 'u-other', tenantId: 'tenant-other' };
  store.users.push(crossTenantUser);
  const blockedOrder = await post(router, '/orders', 'u-other', 'order-key-0002', {
    patientId: patient.body.data.id,
    items: [{ serviceId: 'svc-cbc' }]
  });
  assert.strictEqual(blockedOrder.status, 404);
  assert.strictEqual(blockedOrder.body.error.code, 'patient_not_found');
}

async function testProductionApiSurfaceControls() {
  const store = createInMemoryStore();
  const router = createRouter(store);

  const mfa = await router.handle({
    method: 'POST',
    path: '/auth/mfa/verify',
    rawBody: JSON.stringify({ challengeId: 'u-admin', otp: '123456' })
  });
  assert.strictEqual(mfa.status, 200);
  assert.strictEqual(mfa.body.mfaVerified, true);

  const users = await get(router, '/users', 'u-admin');
  assert.strictEqual(users.status, 200);
  assert.ok(users.body.data.length >= 1);

  const createdUser = await post(router, '/users', 'u-admin', 'create-user-0001', {
    email: 'named.user@hospital.local',
    fullName: 'Named User',
    roleCodes: ['receptionist'],
    branchIds: ['branch-main']
  });
  assert.strictEqual(createdUser.status, 201);

  const deactivation = await post(router, `/users/${createdUser.body.data.id}/deactivate`, 'u-admin', 'deactivate-user-001', {
    reason: 'User access no longer needed'
  });
  assert.strictEqual(deactivation.status, 202);
  assert.strictEqual(deactivation.body.approvalRequest.type, 'user_deactivate');

  const roleChange = await post(router, '/roles/role-cashier/permissions', 'u-admin', 'role-change-0001', {
    permissionCodes: ['billing.payment.create'],
    reason: 'Reduce cashier permissions after access review'
  });
  assert.strictEqual(roleChange.status, 202);

  const patientA = await post(router, '/patients', 'u-reception', 'surface-patient-a', {
    firstName: 'Surface',
    lastName: 'One',
    birthdate: '1988-01-01',
    sex: 'female',
    mobile: '09170000001'
  });
  const patientB = await post(router, '/patients', 'u-reception', 'surface-patient-b', {
    firstName: 'Surface',
    lastName: 'Two',
    birthdate: '1989-01-01',
    sex: 'female',
    mobile: '09170000002'
  });
  assert.strictEqual((await get(router, '/patients', 'u-reception')).body.data.length, 2);

  const appointment = await post(router, '/appointments', 'u-reception', 'appointment-0001', {
    patientId: patientA.body.data.id,
    appointmentAt: '2026-05-10T09:00:00.000Z',
    serviceIds: ['svc-cbc']
  });
  assert.strictEqual(appointment.status, 201);
  assert.strictEqual(store.notifications[0].templateCode, 'appointment_created');

  const merge = await post(router, '/patients/merge-requests', 'u-reception', 'merge-request-001', {
    sourcePatientId: patientA.body.data.id,
    targetPatientId: patientB.body.data.id,
    reason: 'Duplicate identity found during registration review'
  });
  assert.strictEqual(merge.status, 202);

  const archive = await post(router, `/patients/${patientB.body.data.id}/archive`, 'u-admin', 'archive-patient-001', {
    reason: 'Record archived by administrator after duplicate review'
  });
  assert.strictEqual(archive.status, 202);

  const order = await post(router, '/orders', 'u-reception', 'surface-order-0001', {
    patientId: patientA.body.data.id,
    items: [{ serviceId: 'svc-cbc', quantity: 1 }]
  });
  const payment = await post(router, `/billing/invoices/${order.body.data.invoice.id}/payments`, 'u-cashier', 'surface-payment-01', {
    paymentMode: 'Cash',
    amount: 450
  });
  const ticket = store.queueTickets[0];
  const called = await post(router, `/queue/${ticket.id}/call`, 'u-reception', 'queue-call-0001');
  assert.strictEqual(called.body.data.status, 'Called');

  const voidRequest = await post(router, `/orders/${order.body.data.order.id}/void-request`, 'u-cashier', 'order-void-0001', {
    reason: 'Patient requested cancellation before processing'
  });
  assert.strictEqual(voidRequest.status, 202);

  const refund = await post(router, `/billing/payments/${payment.body.data.payment.id}/refund-request`, 'u-cashier', 'refund-request-01', {
    reason: 'Duplicate patient payment verified'
  });
  assert.strictEqual(refund.status, 202);

  const cashierClose = await post(router, '/billing/cashier-sessions/cashier-session-1/close', 'u-cashier', 'cashier-close-01', {
    actualCash: 5450,
    remarks: 'Cash matched expected collections'
  });
  assert.strictEqual(cashierClose.status, 200);
  assert.strictEqual(cashierClose.body.data.status, 'Closed');

  const labOrder = store.labOrders[0];
  const labResult = store.labResults[0];
  await post(router, `/lab/orders/${labOrder.id}/collect`, 'u-medtech', 'surface-collect1');
  await post(router, `/lab/orders/${labOrder.id}/receive`, 'u-medtech', 'surface-receive1');
  await post(router, `/lab/orders/${labOrder.id}/process`, 'u-medtech', 'surface-process1');
  await post(router, `/lab/results/${labResult.id}/encode`, 'u-medtech', 'surface-encode1', {
    items: [{ analyte: 'Hemoglobin', resultValue: '13.5' }]
  });
  await post(router, `/lab/results/${labResult.id}/validate`, 'u-pathologist', 'surface-validate1');
  await post(router, `/lab/results/${labResult.id}/approve`, 'u-pathologist', 'surface-approve1');
  await post(router, `/lab/results/${labResult.id}/release`, 'u-pathologist', 'surface-release1');
  const amendment = await post(router, `/lab/results/${labResult.id}/amend-request`, 'u-medtech', 'amend-request-01', {
    reason: 'Correct reference range after supervisor review'
  });
  assert.strictEqual(amendment.status, 202);

  const receiving = await post(router, '/inventory/receiving', 'u-admin', 'inventory-rec-001', {
    inventoryItemId: 'inv-cbc-reagent',
    supplierId: 'supplier-1',
    batchNo: 'BATCH-2026-500',
    expiryDate: '2027-01-01',
    quantity: 5
  });
  assert.strictEqual(receiving.status, 201);

  const adjustment = await post(router, '/inventory/stock-adjustments', 'u-admin', 'inventory-adj-001', {
    inventoryItemId: 'inv-cbc-reagent',
    quantity: -1,
    reason: 'Physical count variance verified'
  });
  assert.strictEqual(adjustment.status, 202);

  const offboard = await post(router, '/hr/employees/employee-1/offboard', 'u-admin', 'offboard-0001', {
    reason: 'Employee resignation completed and access must be revoked'
  });
  assert.strictEqual(offboard.status, 202);

  const exportJob = await post(router, '/reports/sales/export', 'u-admin', 'report-export-001', {
    format: 'csv',
    filters: { date: '2026-05-09' },
    reason: 'Management reconciliation'
  });
  assert.strictEqual(exportJob.status, 202);

  const notification = await post(router, '/notifications/send', 'u-admin', 'notification-001', {
    recipientType: 'patient',
    recipientId: patientA.body.data.id,
    templateCode: 'result_ready',
    body: 'CBC result: Hemoglobin 13.5 g/dL'
  });
  assert.strictEqual(notification.status, 202);
  assert.strictEqual(store.notifications.at(-1).body, 'A new secure document is available in your patient portal.');

  const backup = await post(router, '/admin/backups', 'u-admin', 'backup-run-0001');
  assert.strictEqual(backup.status, 202);

  const restore = await post(router, '/admin/restore-requests', 'u-admin', 'restore-req-001', {
    backupId: backup.body.job.id,
    reason: 'Restore drill requested by administrator'
  });
  assert.strictEqual(restore.status, 202);

  const audit = await get(router, '/audit/logs', 'u-admin');
  assert.strictEqual(audit.status, 200);
  assert.ok(audit.body.data.length >= 20);

  const logout = await router.handle({
    method: 'POST',
    path: '/auth/logout',
    headers: { 'x-user-id': 'u-admin' },
    rawBody: '{}'
  });
  assert.strictEqual(logout.status, 204);
}

async function main() {
  await testProductionHappyPath();
  await testProductionFailurePaths();
  await testProductionApiSurfaceControls();
  console.log('All API workflow tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
