'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { SECURITY_EVENT_TYPES } = require('../services/SecurityAuditService');

/**
 * attachRequestId — stamps every request with a unique requestId.
 */
function attachRequestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * authenticate — decodes the demo bearer token into AppContext.
 * PR #4: replace with real JWT verification.
 */
function authenticate(authService) {
  return async function (req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authorization header required' });
    }

    try {
      req.context = await authService.decodeToken(
        token,
        req.requestId,
        req.ip || '',
        req.headers['user-agent'] || ''
      );
      next();
    } catch (err) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: err.message || 'Invalid or expired token' });
    }
  };
}

/**
 * errorHandler — converts AppError and unexpected errors to structured JSON.
 */
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    if (err.code === ERROR_CODES.PERMISSION_DENIED) {
      const securityAuditService = req.app?.locals?.services?.securityAuditService;
      const eventType = err.details && err.details.crossTenant
        ? SECURITY_EVENT_TYPES.CROSS_TENANT_ACCESS_ATTEMPT
        : SECURITY_EVENT_TYPES.PERMISSION_DENIED;
      if (securityAuditService) {
        securityAuditService.log(eventType, {
          tenantId: req.context?.tenantId || 'unknown',
          userId: req.context?.userId || 'anonymous',
          ipAddress: req.ip || '',
          metadata: {
            path: req.path,
            method: req.method,
            message: err.message,
            details: err.details || {},
          },
        }).catch(() => {});
      }
      return res.status(403).json({ error: 'FORBIDDEN', message: err.message });
    }
    return res.status(err.httpStatus).json(err.toJSON());
  }
  console.error('[HMS] Unhandled error:', err);
  return res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    },
  });
}

module.exports = { attachRequestId, authenticate, errorHandler };
