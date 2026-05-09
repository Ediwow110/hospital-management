'use strict';
/**
 * Storage adapter factory.
 *
 * Reads STORAGE_ADAPTER env variable:
 *   memory  -> in-memory repositories (demo/test default)
 *   postgres -> PostgreSQL repositories (staging/production)
 *
 * RULE: production/staging must set STORAGE_ADAPTER=postgres explicitly.
 * The memory adapter must never silently serve as a production fallback.
 * If STORAGE_ADAPTER is unset, default is 'memory' (safe for local/demo/CI unit tests).
 * If STORAGE_ADAPTER=postgres but DATABASE_URL is missing, throw immediately — no silent fallback.
 */
const { createInMemoryRepositories } = require('../repositories/in-memory-repositories');
const { createPgRepositories } = require('../repositories/pg-repositories');
const { getPool } = require('./db-pool');
const { createDevStore } = require('../services/dev-store');

function createRepositories(store) {
  const adapter = process.env.STORAGE_ADAPTER || 'memory';

  if (adapter === 'postgres') {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'STORAGE_ADAPTER=postgres requires DATABASE_URL to be set. ' +
        'Refusing to start without a durable database connection.'
      );
    }
    const pool = getPool();
    return createPgRepositories(pool);
  }

  if (adapter === 'memory') {
    const devStore = store || createDevStore();
    return createInMemoryRepositories(devStore);
  }

  throw new Error(`Unknown STORAGE_ADAPTER value: "${adapter}". Valid values: memory, postgres`);
}

module.exports = { createRepositories };
