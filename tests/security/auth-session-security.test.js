'use strict';

const assert = require('assert');
const { randomUUID } = require('crypto');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'security-hardened-staging-foundation-secret-1234567890';
process.env.STORAGE_ADAPTER = 'memory';

const { buildContainer } = require('../../src/config/container');
const { buildApp } = require('../../src/api/app');
const { hashPassword } = require('../../src/auth/hash');
const { SECURITY_EVENT_TYPES } = require('../../src/services/SecurityAuditService');

function tenantCtx(tenantId) {
  return {
    tenantId,
    branchId: 'branch-main',
    userId: 'system',
    roles: ['superadmin'],
    permissions: new Set(),
    can: () => true,
    hasRole: () => true,
  };
}

async function jsonFetch(baseUrl, path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return { status: response.status, body: payload, headers: response.headers };
}

(async () => {
  const container = buildContainer();
  const app = buildApp(container);
  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const adminLogin = await jsonFetch(baseUrl, '/auth/login', {
      method: 'POST',
      body: { email: 'admin@demo.local', password: 'admin123', tenantId: 'demo-tenant' },
    });
    assert.strictEqual(adminLogin.status, 200);
    const tenantAToken = adminLogin.body.token;

    const receptLogin = await jsonFetch(baseUrl, '/auth/login', {
      method: 'POST',
      body: { email: 'recept@demo.local', password: 'recept123', tenantId: 'demo-tenant' },
    });
    assert.strictEqual(receptLogin.status, 200);

    const patient1 = await jsonFetch(baseUrl, '/patients', {
      method: 'POST',
      token: tenantAToken,
      body: { firstName: 'Patient', lastName: 'One', dateOfBirth: '1990-01-01', sex: 'F' },
    });
    assert.strictEqual(patient1.status, 201);

    const patient2 = await jsonFetch(baseUrl, '/patients', {
      method: 'POST',
      token: tenantAToken,
      body: { firstName: 'Patient', lastName: 'Two', dateOfBirth: '1991-02-01', sex: 'M' },
    });
    assert.strictEqual(patient2.status, 201);

    await container.repos.userRepo.save({
      id: patient1.body.id,
      email: 'patient1@demo.local',
      passwordHash: await hashPassword('patientpass123'),
      name: 'Patient One Portal User',
      roles: ['patient'],
      branchId: 'branch-main',
      status: 'active',
    }, tenantCtx('demo-tenant'));

    const patientLogin = await jsonFetch(baseUrl, '/auth/login', {
      method: 'POST',
      body: { email: 'patient1@demo.local', password: 'patientpass123', tenantId: 'demo-tenant' },
    });
    assert.strictEqual(patientLogin.status, 200);

    const idorAttempt = await jsonFetch(baseUrl, `/patients/${patient2.body.id}`, {
      token: patientLogin.body.token,
    });
    assert.ok([403, 404].includes(idorAttempt.status));

    const tenantB = tenantCtx('tenant-b');
    const patientB = await container.repos.patientRepo.save({
      id: randomUUID(),
      mrn: 'PB-SEC-001',
      firstName: 'Tenant',
      lastName: 'B',
      dateOfBirth: '1988-08-08',
      branchId: 'branch-main',
      status: 'active',
    }, tenantB);

    const orderB = await container.repos.orderRepo.save({
      id: randomUUID(),
      patientId: patientB.id,
      branchId: 'branch-main',
      items: [{ description: 'X-Ray', qty: 1, unitPrice: 100 }],
      total: 100,
      status: 'Pending',
      createdBy: 'system',
    }, tenantB);

    const invoiceB = await container.repos.invoiceRepo.save({
      id: randomUUID(),
      orderId: orderB.id,
      patientId: patientB.id,
      branchId: 'branch-main',
      total: 100,
      balance: 100,
      status: 'Unpaid',
      isLocked: false,
    }, tenantB);

    const labB = await container.repos.labResultRepo.save({
      id: randomUUID(),
      orderId: orderB.id,
      patientId: patientB.id,
      branchId: 'branch-main',
      testName: 'CBC',
      status: 'Encoded',
      resultData: { wbc: 5 },
    }, tenantB);

    const crossTenantPatient = await jsonFetch(baseUrl, `/patients/${patientB.id}`, { token: tenantAToken });
    assert.strictEqual(crossTenantPatient.status, 403);

    const crossTenantOrder = await jsonFetch(baseUrl, `/orders/${orderB.id}`, { token: tenantAToken });
    assert.strictEqual(crossTenantOrder.status, 403);

    const crossTenantInvoice = await jsonFetch(baseUrl, `/billing/invoices/${invoiceB.id}`, { token: tenantAToken });
    assert.strictEqual(crossTenantInvoice.status, 403);

    const crossTenantLab = await jsonFetch(baseUrl, `/lab/results/${labB.id}`, { token: tenantAToken });
    assert.strictEqual(crossTenantLab.status, 403);

    const adminDenied = await jsonFetch(baseUrl, '/admin/users', { token: receptLogin.body.token });
    assert.strictEqual(adminDenied.status, 403);
    assert.strictEqual(adminDenied.body.error, 'FORBIDDEN');
    assert.ok(adminDenied.body.message);

    const logoutResult = await jsonFetch(baseUrl, '/auth/logout', { method: 'POST', token: tenantAToken });
    assert.strictEqual(logoutResult.status, 200);

    const revokedTokenUse = await jsonFetch(baseUrl, `/patients/${patient1.body.id}`, { token: tenantAToken });
    assert.strictEqual(revokedTokenUse.status, 401);
    assert.strictEqual(revokedTokenUse.body.error, 'UNAUTHORIZED');

    const failedAttempts = [];
    for (let i = 0; i < 6; i += 1) {
      failedAttempts.push(await jsonFetch(baseUrl, '/auth/login', {
        method: 'POST',
        body: { email: 'admin@demo.local', password: 'bad-password', tenantId: 'demo-tenant' },
      }));
    }

    assert.strictEqual(failedAttempts[5].status, 429);
    assert.strictEqual(failedAttempts[5].body.error, 'TOO_MANY_REQUESTS');
    assert.ok(failedAttempts[5].body.retryAfter > 0);

    const securityEvents = container.services.securityAuditService._repo.all();
    const eventTypes = securityEvents.map(event => event.eventType);
    assert.ok(eventTypes.includes(SECURITY_EVENT_TYPES.LOGIN_SUCCESS));
    assert.ok(eventTypes.includes(SECURITY_EVENT_TYPES.LOGIN_FAILURE));
    assert.ok(eventTypes.includes(SECURITY_EVENT_TYPES.LOGIN_LOCKOUT));
    assert.ok(eventTypes.includes(SECURITY_EVENT_TYPES.TOKEN_REVOKED));
    assert.ok(eventTypes.includes(SECURITY_EVENT_TYPES.PERMISSION_DENIED));
    assert.ok(eventTypes.includes(SECURITY_EVENT_TYPES.CROSS_TENANT_ACCESS_ATTEMPT));

    console.log('Security integration tests passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})();
