const { HmsService } = require('../services/hms-service');
const { toErrorResponse } = require('../core/app-error');
const { parseJsonBody, requireIdempotencyKey } = require('../core/validation');

function createRouter(store) {
  const service = new HmsService(store);
  const routes = [
    route('POST', '/auth/login', request => service.authenticate({ ...request.body, ipAddress: request.ipAddress, deviceInfo: request.headers['user-agent'] })),
    route('POST', '/patients', request => service.registerPatient({ user: request.user, body: request.body, idempotencyKey: request.idempotencyKey })),
    route('POST', '/orders', request => service.createOrder({ user: request.user, body: request.body, idempotencyKey: request.idempotencyKey })),
    route('POST', '/billing/invoices/:id/payments', request => service.postPayment({ user: request.user, invoiceId: request.params.id, body: request.body, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/orders/:id/collect', request => service.collectSpecimen({ user: request.user, labOrderId: request.params.id, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/orders/:id/receive', request => service.receiveSpecimen({ user: request.user, labOrderId: request.params.id, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/orders/:id/process', request => service.processSpecimen({ user: request.user, labOrderId: request.params.id, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/results/:id/encode', request => service.encodeLabResult({ user: request.user, labResultId: request.params.id, body: request.body, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/results/:id/validate', request => service.validateLabResult({ user: request.user, labResultId: request.params.id, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/results/:id/approve', request => service.approveLabResult({ user: request.user, labResultId: request.params.id, idempotencyKey: request.idempotencyKey })),
    route('POST', '/lab/results/:id/release', request => service.releaseLabResult({ user: request.user, labResultId: request.params.id, idempotencyKey: request.idempotencyKey })),
    route('POST', '/approval-requests', request => service.requestApproval({ user: request.user, ...request.body, idempotencyKey: request.idempotencyKey })),
    route('POST', '/inventory/receiving', request => service.receiveInventory({ user: request.user, body: request.body, idempotencyKey: request.idempotencyKey })),
    route('POST', '/reports/:code/export', request => service.exportReport({ user: request.user, code: request.params.code, body: request.body, idempotencyKey: request.idempotencyKey })),
    route('GET', '/admin/health', request => service.health({ user: request.user })),
    route('GET', '/audit/logs', request => service.auditSearch({ user: request.user }))
  ];

  async function handle({ method, path, headers = {}, rawBody = '', user = null, ipAddress = null }) {
    const requestId = headers['x-request-id'] || `req_${Date.now()}`;
    try {
      const match = matchRoute(routes, method, path);
      if (!match) return { status: 404, body: { error: { code: 'not_found', message: 'Route not found', request_id: requestId } } };
      const body = ['POST', 'PATCH', 'PUT'].includes(method) ? parseJsonBody(rawBody) : {};
      const requiresIdempotency = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) && path !== '/auth/login';
      const idempotencyKey = requiresIdempotency ? requireIdempotencyKey(headers, `${method} ${path}`) : null;
      const resolvedUser = user || resolveUserFromHeaders(store, headers);
      if (path !== '/auth/login' && !resolvedUser) {
        return { status: 401, body: { error: { code: 'unauthenticated', message: 'Authentication is required', request_id: requestId } } };
      }
      const result = await match.handler({
        method,
        path,
        headers,
        body,
        params: match.params,
        user: resolvedUser,
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
  if (path.includes('request') || path.includes('export') || path.includes('backups')) return 202;
  if (path === '/patients' || path === '/orders' || path.includes('/payments') || path === '/inventory/receiving') return 201;
  return 200;
}

module.exports = {
  createRouter,
  matchRoute
};
