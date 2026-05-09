'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');

function attachRequestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

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

module.exports = { attachRequestId, errorHandler };
