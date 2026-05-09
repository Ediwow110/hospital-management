'use strict';

const express = require('express');
const { buildRouter } = require('./router');
const { attachRequestId, errorHandler } = require('./middleware');
const { createAuthMiddleware } = require('../middleware/authenticate');

function buildApp(container) {
  const app = express();

  app.use(express.json());
  app.use(attachRequestId);

  const authMiddleware = createAuthMiddleware(container);
  const router = buildRouter(container, authMiddleware);
  app.use('/', router);

  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
