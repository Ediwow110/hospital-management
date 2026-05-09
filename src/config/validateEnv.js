'use strict';

const BANNED_SECRETS = ['demo-secret', 'changeme', 'secret', 'password', 'jwt-secret', 'mysecret', ''];

function validateEnv() {
  const errors = [];

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required but not set');
  } else if (jwtSecret.length < 32) {
    errors.push(`JWT_SECRET must be at least 32 characters (got ${jwtSecret.length})`);
  } else if (BANNED_SECRETS.includes(jwtSecret.toLowerCase().trim())) {
    errors.push('JWT_SECRET is a known placeholder value and cannot be used');
  }

  const env = process.env.NODE_ENV;
  const storageAdapter = process.env.STORAGE_ADAPTER;
  if ((env === 'production' || env === 'staging') && storageAdapter === 'postgres') {
    if (!process.env.DATABASE_URL) {
      errors.push('DATABASE_URL is required when STORAGE_ADAPTER=postgres in production/staging');
    }
  }

  if (errors.length > 0) {
    console.error('[validateEnv] FATAL: Server refused to start due to environment validation failures:');
    errors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  }
}

module.exports = { validateEnv };
