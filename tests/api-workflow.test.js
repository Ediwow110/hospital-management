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

async function main() {
  await testProductionHappyPath();
  await testProductionFailurePaths();
  console.log('All API workflow tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
