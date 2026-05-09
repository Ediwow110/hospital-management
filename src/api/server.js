'use strict';

const { validateEnv } = require('../config/validateEnv');
const { buildContainer } = require('../config/container');
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
  });
} catch (err) {
  console.error('[HMS] Failed to start server:', err.message);
  process.exit(1);
}
