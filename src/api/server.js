'use strict';

/**
 * HMS Backend Entry Point — PR #3
 *
 * Starts the Express server with in-memory storage.
 * PostgreSQL persistence is deferred to PR #4.
 *
 * Usage:
 *   node src/api/server.js
 *   STORAGE_ADAPTER=memory PORT=3000 node src/api/server.js
 */

const { buildContainer } = require('../config/container');
const { validateEnv } = require('../config/validateEnv');
const { buildApp } = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);

try {
  validateEnv();
  const container = buildContainer();
  const app = buildApp(container);

  app.listen(PORT, () => {
    console.log(`[HMS] Server started on port ${PORT}`);
    console.log(`[HMS] Storage adapter: ${process.env.STORAGE_ADAPTER || 'memory'}`);
    console.log(`[HMS] Health: http://localhost:${PORT}/health`);
    console.log('[HMS] NOTE: In-memory storage is demo/test only. PostgreSQL deferred to PR #4.');
  });
} catch (err) {
  console.error('[HMS] Failed to start server:', err.message);
  process.exit(1);
}
