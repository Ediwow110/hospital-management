const assert = require('assert');
const { ERROR_CATALOG, AppError, toErrorResponse } = require('../src/core/app-error');
const { PERMISSIONS, PERMISSION_CODES } = require('../src/core/permissions');
const { createInMemoryStore } = require('../src/infrastructure/in-memory-store');
const { createInMemoryRepositories } = require('../src/repositories/in-memory-repositories');
const { REPOSITORY_INTERFACES, assertRepositoryInterfaces } = require('../src/repositories/interfaces');

function testErrorCatalog() {
  [
    'validation_error',
    'permission_denied',
    'not_found',
    'invalid_workflow_transition',
    'duplicate_record',
    'record_locked',
    'approval_required',
    'idempotency_conflict',
    'cashier_session_closed',
    'payment_conflict',
    'result_already_released',
    'internal_error'
  ].forEach(code => assert.ok(ERROR_CATALOG[code], `${code} missing from error catalog`));
  const response = toErrorResponse(new AppError('invalid_workflow_transition', 'Blocked'), 'req_test');
  assert.strictEqual(response.status, 409);
  assert.strictEqual(response.body.error.code, 'invalid_workflow_transition');
  assert.ok(!response.body.error.stack);
}

function testPermissionConstants() {
  [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.BILLING_PAYMENT_CREATE,
    PERMISSIONS.LAB_RESULT_RELEASE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.ADMIN_ROLE_CHANGE
  ].forEach(permission => assert.ok(PERMISSION_CODES.includes(permission), `${permission} missing from permission constants`));
}

function testRepositoryContracts() {
  const repositories = createInMemoryRepositories(createInMemoryStore());
  assert.strictEqual(assertRepositoryInterfaces(repositories), true);
  Object.keys(REPOSITORY_INTERFACES).forEach(name => assert.ok(repositories[name], `${name} repository missing`));
}

testErrorCatalog();
testPermissionConstants();
testRepositoryContracts();

console.log('All architecture foundation tests passed.');
