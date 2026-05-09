const { rolePermissions } = require('./production-rules');

function createAppContext({
  requestId,
  method,
  path,
  routePattern,
  user,
  headers = {},
  ipAddress = null,
  idempotencyKey = null
}) {
  const selectedBranchId = headers['x-branch-id'] || headers['X-Branch-Id'] || user?.branchIds?.[0] || null;
  return Object.freeze({
    requestId,
    tenantId: headers['x-tenant-id'] || headers['X-Tenant-Id'] || user?.tenantId || null,
    branchId: selectedBranchId,
    userId: user?.id || null,
    roles: user?.role ? [user.role] : [],
    permissions: user?.role ? rolePermissions(user.role) : [],
    ipAddress,
    deviceInfo: headers['user-agent'] || headers['User-Agent'] || null,
    idempotencyKey,
    method,
    path,
    routePattern,
    operation: `${method} ${routePattern || path}`,
    user
  });
}

function fallbackContext({ user, idempotencyKey = null, operation = 'service.operation' }) {
  return Object.freeze({
    requestId: 'service_request',
    tenantId: user?.tenantId || null,
    branchId: user?.branchIds?.[0] || null,
    userId: user?.id || null,
    roles: user?.role ? [user.role] : [],
    permissions: user?.role ? rolePermissions(user.role) : [],
    ipAddress: null,
    deviceInfo: null,
    idempotencyKey,
    method: 'SERVICE',
    path: operation,
    routePattern: operation,
    operation,
    user
  });
}

function idempotencyCacheKey(context, operationName) {
  const parts = [
    context.tenantId || 'tenant:none',
    context.branchId || 'branch:none',
    context.userId || 'user:none',
    context.method || 'method:none',
    context.path || 'path:none',
    context.routePattern || 'route:none',
    operationName || context.operation || 'operation:none',
    context.idempotencyKey || 'key:none'
  ];
  return parts.map(part => encodeURIComponent(String(part))).join(':');
}

module.exports = {
  createAppContext,
  fallbackContext,
  idempotencyCacheKey
};
