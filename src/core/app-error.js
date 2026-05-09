const ERROR_CATALOG = Object.freeze({
  validation_error: { status: 422 },
  validation_failed: { status: 422 },
  invalid_json: { status: 400 },
  unauthenticated: { status: 401 },
  invalid_credentials: { status: 401 },
  mfa_required: { status: 401 },
  permission_denied: { status: 403 },
  feature_disabled: { status: 403 },
  not_found: { status: 404 },
  invalid_workflow_transition: { status: 409 },
  duplicate_record: { status: 409 },
  record_locked: { status: 409 },
  result_locked: { status: 409 },
  approval_required: { status: 409 },
  idempotency_key_required: { status: 400 },
  idempotency_conflict: { status: 409 },
  cashier_session_required: { status: 409 },
  cashier_session_open: { status: 409 },
  cashier_session_closed: { status: 409 },
  payment_conflict: { status: 409 },
  payment_blocked: { status: 409 },
  result_already_released: { status: 409 },
  dual_approval_required: { status: 409 },
  internal_error: { status: 500 }
});

class AppError extends Error {
  constructor(code, message, status = ERROR_CATALOG[code]?.status || 400, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isAppError(error) {
  return error instanceof AppError;
}

function toErrorResponse(error, requestId = 'req_unknown') {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          request_id: requestId,
          details: error.details
        }
      }
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred.',
        request_id: requestId
      }
    }
  };
}

module.exports = {
  ERROR_CATALOG,
  AppError,
  isAppError,
  toErrorResponse
};
