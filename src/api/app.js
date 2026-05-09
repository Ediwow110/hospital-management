'use strict';

const express = require('express');
const { buildRouter } = require('./router');
const { attachRequestId, authenticate, errorHandler } = require('./middleware');

/**
 * buildApp — constructs the Express application.
 * Separates app creation from server listen so tests can use it directly.
 *
 * @param {object} container - DI container from buildContainer()
 * @returns {express.Application}
 */
function buildApp(container) {
  const app = express();

  app.use(express.json());
  app.use(attachRequestId);
  app.locals.services = container.services;

  const router = buildRouter(container, authenticate);
  app.use('/', router);

  app.use(errorHandler);

  return app;
}

module.exports = { buildApp };
