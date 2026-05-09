'use strict';
/**
 * Transaction wrapper for PostgreSQL.
 *
 * Usage:
 *   const { withTransaction } = require('./transaction');
 *   const result = await withTransaction(pool, async (tx) => {
 *     await repo.save(entity, context, tx);
 *     await auditRepo.insert(event, context, tx);
 *     return result;
 *   });
 *
 * Rules:
 * - Acquires a pg client from the pool.
 * - Issues BEGIN before the callback.
 * - Issues COMMIT on success.
 * - Issues ROLLBACK on any thrown error, then rethrows.
 * - Releases the client in finally — always.
 * - The tx object passed to the callback IS the pg Client. Repositories bind
 *   queries to tx.query() when tx is provided instead of using the pool.
 *
 * The in-memory adapter ignores tx silently.
 */
async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback error */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
