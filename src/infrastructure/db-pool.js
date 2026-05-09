'use strict';
/**
 * PostgreSQL connection pool singleton.
 * The pool is created lazily on first call to getPool().
 * Only valid when STORAGE_ADAPTER=postgres and DATABASE_URL is set.
 *
 * Services must NEVER import this file directly.
 * Only PostgreSQL repository adapters and the transaction wrapper use this.
 */
const { Pool } = require('pg');

let _pool = null;

function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set. Cannot create PostgreSQL pool.');
    }
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    _pool.on('error', (err) => {
      console.error('[db-pool] unexpected idle client error:', err.message);
    });
  }
  return _pool;
}

async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { getPool, closePool };
