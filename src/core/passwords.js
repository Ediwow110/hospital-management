const crypto = require('crypto');
const { AppError } = require('./app-error');

const DEFAULT_SCRYPT_PARAMS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64
});

function hashPassword(password, options = {}) {
  assertPasswordInput(password);
  const params = { ...DEFAULT_SCRYPT_PARAMS, ...(options.params || {}) };
  const salt = options.salt || crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(password, salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p
  }).toString('base64url');
  return ['scrypt', params.N, params.r, params.p, params.keyLength, salt, hash].join('$');
}

function verifyPassword(password, storedHash) {
  assertPasswordInput(password);
  if (!isPasswordHash(storedHash)) return false;
  const [, n, r, p, keyLength, salt, expectedHash] = storedHash.split('$');
  const params = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    keyLength: Number(keyLength)
  };
  const actual = crypto.scryptSync(password, salt, params.keyLength, {
    N: params.N,
    r: params.r,
    p: params.p
  });
  const expected = Buffer.from(expectedHash, 'base64url');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function isPasswordHash(value) {
  if (typeof value !== 'string') return false;
  const parts = value.split('$');
  return parts.length === 7 && parts[0] === 'scrypt' && parts.slice(1, 5).every(part => Number.isInteger(Number(part)) && Number(part) > 0);
}

function assertPasswordInput(password) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new AppError('validation_error', 'Password must contain at least 12 characters', 422);
  }
}

module.exports = {
  DEFAULT_SCRYPT_PARAMS,
  hashPassword,
  verifyPassword,
  isPasswordHash
};
