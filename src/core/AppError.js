'use strict';

/**
 * Canonical error codes used across the HMS backend.
 * Each code maps to a stable HTTP status.
 */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR:             'validation_error',
  PERMISSION_DENIED:            'permission_denied',
  NOT_FOUND:                    'not_found',
  INVALID_WORKFLOW_TRANSITION:  'invalid_workflow_transition',
  DUPLICATE_RECORD:             'duplicate_record',
  RECORD_LOCKED:                'record_locked',
  APPROVAL_REQUIRED:            'approval_required',
  IDEMPOTENCY_CONFLICT:         'idempotency_conflict',
  INTERNAL_ERROR:               'internal_error',
});

/**
 * Map from error code to default HTTP status.
 */
const CODE_TO_STATUS = Object.freeze({
  [ERROR_CODES.VALIDATION_ERROR]:            400,
  [ERROR_CODES.PERMISSION_DENIED]:           403,
  [ERROR_CODES.NOT_FOUND]:                   404,
  [ERROR_CODES.INVALID_WORKFLOW_TRANSITION]: 409,
  [ERROR_CODES.DUPLICATE_RECORD]:            409,
  [ERROR_CODES.RECORD_LOCKED]:               409,
  [ERROR_CODES.APPROVAL_REQUIRED]:           422,
  [ERROR_CODES.IDEMPOTENCY_CONFLICT]:        409,
  [ERROR_CODES.INTERNAL_ERROR]:              500,
});

/**
 * AppError — structured application error.
 * All service-layer errors must use this class.
 */
class AppError extends Error {
  /**
   * @param {string} code     - One of ERROR_CODES values
   * @param {string} message  - Human-readable message
   * @param {object} [details] - Optional extra context
   */
  constructor(code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = CODE_TO_STATUS[code] ?? 500;
    this.details = details;
  }

  /**
   * Converts to a safe JSON response body.
   * @returns {object}
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== null ? { details: this.details } : {}),
      },
    };
  }
}

module.exports = { AppError, ERROR_CODES, CODE_TO_STATUS };
