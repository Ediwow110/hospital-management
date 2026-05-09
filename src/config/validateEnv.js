'use strict';

const BLOCKED_SECRETS = new Set([
  'demo-secret',
  'changeme',
  'secret',
  'password',
  'test',
  '12345',
  'admin',
]);

function validateEnv() {
  const errors = [];
  const jwtSecret = process.env.JWT_SECRET || '';
  const normalizedSecret = jwtSecret.trim().toLowerCase();

  if (!jwtSecret) {
    errors.push('JWT_SECRET is required.');
  } else {
    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long.');
    }
    if (BLOCKED_SECRETS.has(normalizedSecret)) {
      errors.push('JWT_SECRET uses an obvious placeholder value.');
    }
  }

  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const adapter = (process.env.STORAGE_ADAPTER || 'memory').toLowerCase();
  const requiresDatabase = (nodeEnv === 'production' || nodeEnv === 'staging') && adapter === 'postgres';

  if (requiresDatabase && !process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required when STORAGE_ADAPTER=postgres in production/staging.');
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[ENV] ${error}`);
    }
    throw new Error('Environment validation failed.');
  }
}

module.exports = { validateEnv };
