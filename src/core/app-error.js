class AppError extends Error {
  constructor(code, message, status = 400, details = null) {
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
  AppError,
  isAppError,
  toErrorResponse
};
