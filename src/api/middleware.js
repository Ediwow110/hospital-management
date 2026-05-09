'use strict';

const { randomUUID } = require('crypto');
const rateLimit = require('express-rate-limit');
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

function buildLoginRateLimiter(securityAuditService) {
  const windowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const buildLoginRateKey = req => {
    const tenantId = (req.body && req.body.tenantId) || 'unknown-tenant';
    const email = (req.body && req.body.email) || 'unknown-email';
    const ip = req.ip || '';
    return `${tenantId}::${String(email).toLowerCase()}::${ip}`;
  };
  return rateLimit({
    windowMs,
    max: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: buildLoginRateKey,
    handler: async (req, res) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      await securityAuditService.log(SECURITY_EVENT_TYPES.LOGIN_LOCKOUT, {
        tenantId: (req.body && req.body.tenantId) || 'unknown-tenant',
        userId: (req.body && req.body.email) || null,
        ipAddress: req.ip || '',
        metadata: {
          key: buildLoginRateKey(req),
          retryAfter,
        },
      });
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many failed login attempts. Try again later.',
        retryAfter,
      });
    },
  });
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

module.exports = { attachRequestId, authenticate, buildLoginRateLimiter, errorHandler };
