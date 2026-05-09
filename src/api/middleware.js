'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');

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
  return function (req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: { code: 'unauthenticated', message: 'Authorization header required' },
      });
    }

    try {
      req.context = authService.decodeToken(
        token,
        req.requestId,
        req.ip || '',
        req.headers['user-agent'] || ''
      );
      next();
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.httpStatus).json(err.toJSON());
      }
      return res.status(401).json({
        error: { code: 'unauthenticated', message: 'Invalid token' },
      });
    }
  };
}

/**
 * errorHandler — converts AppError and unexpected errors to structured JSON.
 */
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
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
