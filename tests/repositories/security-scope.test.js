'use strict';

const assert = require('assert');
const { randomUUID } = require('crypto');

const { InMemoryPatientRepository } = require('../../src/repositories/memory/InMemoryPatientRepository');
const { InMemoryOrderRepository } = require('../../src/repositories/memory/InMemoryOrderRepository');
const { InMemoryInvoiceRepository } = require('../../src/repositories/memory/InMemoryInvoiceRepository');
const { InMemoryCashierSessionRepository } = require('../../src/repositories/memory/InMemoryCashierSessionRepository');
const { ERROR_CODES, AppError } = require('../../src/core/AppError');

function ctx(tenantId) {
  return {
    tenantId,
    branchId: 'branch-main',
    userId: 'test-user',
    roles: ['superadmin'],
    permissions: new Set(),
    can: () => true,
    hasRole: () => true,
  };
}

(async () => {
  const patientRepo = new InMemoryPatientRepository();
  const orderRepo = new InMemoryOrderRepository();
  const invoiceRepo = new InMemoryInvoiceRepository();
  const cashierRepo = new InMemoryCashierSessionRepository();

  const tenantA = ctx('tenant-a');
  const tenantB = ctx('tenant-b');

  const patientA = await patientRepo.save({ id: randomUUID(), mrn: 'PA-001', branchId: 'branch-main' }, tenantA);
  await patientRepo.save({ id: randomUUID(), mrn: 'PB-001', branchId: 'branch-main' }, tenantB);

  const fromTenantA = await patientRepo.findById(patientA.id, tenantA);
  assert.strictEqual(fromTenantA.id, patientA.id);

  const byNumberTenantA = await patientRepo.findByNumber('PB-001', tenantA);
  assert.strictEqual(byNumberTenantA, null);

  let denied = false;
  try {
    await patientRepo.findById(patientA.id, tenantB);
  } catch (err) {
    denied = true;
    assert.ok(err instanceof AppError);
    assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
  }
  assert.ok(denied);

  const orderA = await orderRepo.save({ id: randomUUID(), patientId: patientA.id, branchId: 'branch-main' }, tenantA);
  await invoiceRepo.save({ id: randomUUID(), orderId: orderA.id, patientId: patientA.id, branchId: 'branch-main' }, tenantA);

  const orderLookup = await orderRepo.findById(orderA.id, tenantA);
  assert.strictEqual(orderLookup.id, orderA.id);

  let orderDenied = false;
  try {
    await orderRepo.findById(orderA.id, tenantB);
  } catch (err) {
    orderDenied = true;
    assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
  }
  assert.ok(orderDenied);

  const invoice = await invoiceRepo.findByOrderId(orderA.id, tenantA);
  assert.ok(invoice);

  let invoiceDenied = false;
  try {
    await invoiceRepo.findById(invoice.id, tenantB);
  } catch (err) {
    invoiceDenied = true;
    assert.strictEqual(err.code, ERROR_CODES.PERMISSION_DENIED);
  }
  assert.ok(invoiceDenied);

  const session = await cashierRepo.save({ id: randomUUID(), number: 'CS-001', userId: 'cashier-a', branchId: 'branch-main', status: 'Open' }, tenantA);
  const sameTenantSession = await cashierRepo.findByIdOrNumber(session.id, tenantA);
  assert.strictEqual(sameTenantSession.id, session.id);

  const crossTenantSession = await cashierRepo.findByIdOrNumber('CS-001', tenantB);
  assert.strictEqual(crossTenantSession, null);

  let blockedWithoutTenant = false;
  try {
    await invoiceRepo.findById(invoice.id);
  } catch {
    blockedWithoutTenant = true;
  }
  assert.ok(blockedWithoutTenant);

  console.log('Repository tenant scope tests passed.');
})();
