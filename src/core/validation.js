const { AppError } = require('./app-error');

function requireFields(body, fields) {
  const missing = fields.filter(field => body[field] == null || body[field] === '');
  if (missing.length) {
    throw new AppError('validation_failed', `Missing required fields: ${missing.join(', ')}`, 422, { missing });
  }
}

function requireIdempotencyKey(headers, actionName) {
  const key = headers['idempotency-key'] || headers['Idempotency-Key'];
  if (!key || String(key).trim().length < 12) {
    throw new AppError('idempotency_key_required', `${actionName} requires Idempotency-Key header`, 400);
  }
  return String(key).trim();
}

function normalizeMoney(value, field = 'amount') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('validation_failed', `${field} must be greater than zero`, 422);
  }
  return Number(amount.toFixed(2));
}

function parseJsonBody(rawBody) {
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new AppError('invalid_json', 'Request body must be valid JSON', 400);
  }
}

module.exports = {
  requireFields,
  requireIdempotencyKey,
  normalizeMoney,
  parseJsonBody
};
