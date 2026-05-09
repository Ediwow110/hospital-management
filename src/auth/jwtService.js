'use strict';

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const BANNED_SECRETS = ['demo-secret', 'changeme', 'secret', 'password', 'jwt-secret', 'mysecret'];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || BANNED_SECRETS.includes(secret.toLowerCase())) {
    throw new Error('JWT_SECRET is missing, too short, or is a placeholder value');
  }
  return secret;
}

function signAccessToken(user, options = {}) {
  const secret = getJwtSecret();
  const jti = uuidv4();
  const payload = {
    sub: user.id || user.userId,
    userId: user.id || user.userId,
    tenantId: user.tenantId,
    branchId: user.branchId || null,
    roles: user.roles || [],
    jti,
  };
  const signOptions = {
    expiresIn: options.expiresIn || process.env.JWT_EXPIRY || '15m',
    issuer: process.env.JWT_ISSUER || 'hospital-management',
    ...options,
  };
  return { token: jwt.sign(payload, secret, signOptions), jti };
}

function verifyAccessToken(token) {
  const secret = getJwtSecret();
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: process.env.JWT_ISSUER || 'hospital-management',
    });
    if (!decoded.userId && !decoded.sub) throw new Error('Token missing userId/sub');
    if (!decoded.tenantId) throw new Error('Token missing tenantId');
    if (!decoded.jti) throw new Error('Token missing jti');
    return decoded;
  } catch (err) {
    const error = new Error(err.message || 'Invalid token');
    error.code = 'INVALID_TOKEN';
    throw error;
  }
}

module.exports = { signAccessToken, verifyAccessToken };
