const { HmsService } = require('../services/hms-service');
const { createAppContext } = require('../core/app-context');
const { toErrorResponse } = require('../core/app-error');
const { parseJsonBody, requireIdempotencyKey } = require('../core/validation');

function createRouter(store) {
  const service = new HmsService(store);
  const routes = [
    route('POST', '/auth/login', request => service.authenticate({ ...request.body, ipAddress: request.ipAddress, deviceInfo: request.headers['user-agent'] })),
    route('POST', '/auth/logout', request => service.logout({ context: request.context })),
    route('POST', '/auth/mfa/verify', request => service.verifyMfa({ ...request.body })),
    route('GET', '/users', request => service.listUsers({ context: request.context })),
    route('POST', '/users', request => service.createUser({ context: request.context, body: request.body })),
    route('POST', '/users/:id/deactivate', request => service.deactivateUser({ context: request.context, targetUserId: request.params.id, body: request.body })),
    route('POST', '/roles/:id/permissions', request => service.requestRolePermissionChange({ context: request.context, roleId: request.params.id, body: request.body })),
    route('GET', '/patients', request => service.searchPatients({ context: request.context })),
    route('POST', '/patients', request => service.registerPatient({ context: request.context, body: request.body })),
    route('POST', '/patients/:id/archive', request => service.archivePatient({ context: request.context, patientId: request.params.id, body: request.body })),
    route('POST', '/patients/merge-requests', request => service.requestPatientMerge({ context: request.context, body: request.body })),
    route('POST', '/appointments', request => service.createAppointment({ context: request.context, body: request.body })),
    route('POST', '/queue/:id/call', request => service.callQueueTicket({ context: request.context, queueTicketId: request.params.id })),
    route('POST', '/orders', request => service.createOrder({ context: request.context, body: request.body })),
    route('POST', '/orders/:id/void-request', request => service.requestOrderVoid({ context: request.context, orderId: request.params.id, body: request.body })),
    route('POST', '/billing/cashier-sessions', request => service.openCashierSession({ context: request.context, body: request.body })),
    route('POST', '/billing/cashier-sessions/:id/close', request => service.closeCashierSession({ context: request.context, sessionId: request.params.id, body: request.body })),
    route('POST', '/billing/invoices/:id/payments', request => service.postPayment({ context: request.context, invoiceId: request.params.id, body: request.body })),
    route('POST', '/billing/payments/:id/refund-request', request => service.requestRefund({ context: request.context, paymentId: request.params.id, body: request.body })),
    route('POST', '/lab/orders/:id/collect', request => service.collectSpecimen({ context: request.context, labOrderId: request.params.id })),
    route('POST', '/lab/orders/:id/receive', request => service.receiveSpecimen({ context: request.context, labOrderId: request.params.id })),
    route('POST', '/lab/orders/:id/process', request => service.processSpecimen({ context: request.context, labOrderId: request.params.id })),
    route('POST', '/lab/results/:id/encode', request => service.encodeLabResult({ context: request.context, labResultId: request.params.id, body: request.body })),
    route('POST', '/lab/results/:id/validate', request => service.validateLabResult({ context: request.context, labResultId: request.params.id })),
    route('POST', '/lab/results/:id/approve', request => service.approveLabResult({ context: request.context, labResultId: request.params.id })),
    route('POST', '/lab/results/:id/release', request => service.releaseLabResult({ context: request.context, labResultId: request.params.id })),
    route('POST', '/lab/results/:id/amend-request', request => service.requestResultAmendment({ context: request.context, labResultId: request.params.id, body: request.body })),
    route('POST', '/approval-requests', request => service.requestApproval({ context: request.context, ...request.body })),
    route('POST', '/inventory/receiving', request => service.receiveInventory({ context: request.context, body: request.body })),
    route('POST', '/inventory/stock-adjustments', request => service.requestInventoryAdjustment({ context: request.context, body: request.body })),
    route('POST', '/hr/employees/:id/offboard', request => service.offboardEmployee({ context: request.context, employeeId: request.params.id, body: request.body })),
    route('POST', '/reports/:code/export', request => service.exportReport({ context: request.context, code: request.params.code, body: request.body })),
    route('POST', '/notifications/send', request => service.sendNotification({ context: request.context, body: request.body })),
    route('POST', '/admin/backups', request => service.runBackup({ context: request.context })),
    route('POST', '/admin/restore-requests', request => service.requestRestore({ context: request.context, body: request.body })),
    route('GET', '/admin/health', request => service.health({ context: request.context })),
    route('GET', '/audit/logs', request => service.auditSearch({ context: request.context }))
  ];

  async function handle({ method, path, headers = {}, rawBody = '', user = null, ipAddress = null }) {
    const requestId = headers['x-request-id'] || `req_${Date.now()}`;
    try {
      const match = matchRoute(routes, method, path);
      if (!match) return { status: 404, body: { error: { code: 'not_found', message: 'Route not found', request_id: requestId } } };
      const body = ['POST', 'PATCH', 'PUT'].includes(method) ? parseJsonBody(rawBody) : {};
      const requiresIdempotency = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && !path.startsWith('/auth/');
      const idempotencyKey = requiresIdempotency ? requireIdempotencyKey(headers, `${method} ${path}`) : null;
      const resolvedUser = user || resolveUserFromHeaders(store, headers);
      const authWithoutSession = ['/auth/login', '/auth/mfa/verify'].includes(path);
      if (!authWithoutSession && !resolvedUser) {
        return { status: 401, body: { error: { code: 'unauthenticated', message: 'Authentication is required', request_id: requestId } } };
      }
      const context = createAppContext({
        requestId,
        method,
        path: path.split('?')[0],
        routePattern: match.pattern,
        user: resolvedUser,
        headers,
        ipAddress,
        idempotencyKey
      });
      const result = await match.handler({
        method,
        path,
        headers,
        body,
        params: match.params,
        user: resolvedUser,
        context,
        idempotencyKey,
        ipAddress
      });
      return {
        status: method === 'POST' && path !== '/auth/login' ? statusForPost(path) : 200,
        body: result
      };
    } catch (error) {
      return toErrorResponse(error, requestId);
    }
  }

  return {
    handle,
    routes,
    service
  };
}

function route(method, pattern, handler) {
  return {
    method,
    pattern,
    handler,
    parts: pattern.split('/').filter(Boolean)
  };
}

function matchRoute(routes, method, path) {
  const parts = path.split('?')[0].split('/').filter(Boolean);
  for (const routeItem of routes) {
    if (routeItem.method !== method || routeItem.parts.length !== parts.length) continue;
    const params = {};
    const matched = routeItem.parts.every((part, index) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = decodeURIComponent(parts[index]);
        return true;
      }
      return part === parts[index];
    });
    if (matched) return { ...routeItem, params };
  }
  return null;
}

function resolveUserFromHeaders(store, headers) {
  const userId = headers['x-user-id'];
  if (!userId) return null;
  return store.users.find(user => user.id === userId && user.status === 'active') || null;
}

function statusForPost(path) {
  if (path === '/auth/logout') return 204;
  if (
    path.includes('request') ||
    path.includes('export') ||
    path.includes('backups') ||
    path.includes('deactivate') ||
    path.includes('permissions') ||
    path.includes('archive') ||
    path.includes('stock-adjustments') ||
    path.includes('offboard') ||
    path === '/notifications/send'
  ) return 202;
  if (path === '/patients' || path === '/users' || path === '/appointments' || path === '/orders' || path.includes('/payments') || path === '/billing/cashier-sessions' || path === '/inventory/receiving') return 201;
  return 200;
}

module.exports = {
  createRouter,
  matchRoute
};
