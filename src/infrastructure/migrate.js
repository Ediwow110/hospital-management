'use strict';
/**
 * Migration runner.
 * Usage: node src/infrastructure/migrate.js
 * Env: DATABASE_URL required.
 *
 * Strategy:
 * - Reads all *.sql files from migrations/ in lexicographic order.
 * - Tracks applied migrations in a schema_migrations table.
 * - Each migration runs in its own transaction; if it fails, it rolls back and halts.
 * - Forward-only. No down migrations.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigrations(databaseUrl) {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let applied = 0;
    for (const filename of files) {
      const existing = await client.query(
        'SELECT id FROM schema_migrations WHERE filename = $1',
        [filename]
      );
      if (existing.rows.length > 0) {
        console.log(`[migrate] skip (already applied): ${filename}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
      console.log(`[migrate] applying: ${filename}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename]
        );
        await client.query('COMMIT');
        applied++;
        console.log(`[migrate] applied: ${filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration failed: ${filename}\n${err.message}`);
      }
    }
    console.log(`[migrate] done. ${applied} migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch(err => {
    console.error('[migrate] FATAL:', err.message);
    process.exit(1);
  });
}

module.exports = { runMigrations };
