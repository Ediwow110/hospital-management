'use strict';

const express = require('express');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');

/**
 * buildRouter — wires all API routes.
 * Services are injected via the container. Router never imports repos directly.
 *
 * @param {{ services: object }} container
 * @returns {express.Router}
 */
function buildRouter(container, authenticate, buildLoginRateLimiter) {
  const router = express.Router();
  const { services } = container;
  const auth = authenticate(services.authService);
  const loginRateLimiter = buildLoginRateLimiter(services.securityAuditService);

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------
  router.get('/health', (req, res) => {
    res.json(services.healthService.check());
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
  router.post('/auth/login', loginRateLimiter, async (req, res, next) => {
    try {
      const { email, password, tenantId } = req.body;
      if (!email || !password || !tenantId) {
        return res.status(400).json({ error: { code: 'validation_error', message: 'email, password, tenantId required' } });
      }
      const result = await services.authService.login(
        email, password, tenantId,
        req.ip || '', req.headers['user-agent'] || ''
      );
      res.json(result);
    } catch (err) {
      if (err instanceof AppError && err.code === ERROR_CODES.PERMISSION_DENIED) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: err.message });
      }
      next(err);
    }
  });

  router.post('/auth/logout', auth, async (req, res, next) => {
    try {
      await services.authService.logout(req.context);
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // -------------------------------------------------------------------------
  // Patients
  // -------------------------------------------------------------------------
  router.post('/patients', auth, async (req, res, next) => {
    try {
      const patient = await services.patientService.registerPatient(req.body, req.context);
      res.status(201).json(patient);
    } catch (err) { next(err); }
  });

  router.get('/patients/:id', auth, async (req, res, next) => {
    try {
      const patient = await services.patientService.getPatient(req.params.id, req.context);
      res.json(patient);
    } catch (err) { next(err); }
  });

  // -------------------------------------------------------------------------
  // Orders
  // -------------------------------------------------------------------------
  router.post('/orders', auth, async (req, res, next) => {
    try {
      const result = await services.orderService.createOrder(req.body, req.context);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/orders/:id', auth, async (req, res, next) => {
    try {
      const result = await services.orderService.getOrder(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  // -------------------------------------------------------------------------
  // Billing — Payments
  // -------------------------------------------------------------------------
  router.post('/billing/invoices/:id/payments', auth, async (req, res, next) => {
    try {
      const result = await services.billingService.postPayment(req.params.id, req.body, req.context);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.get('/billing/invoices/:id', auth, async (req, res, next) => {
    try {
      const result = await services.billingService.getInvoice(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  // -------------------------------------------------------------------------
  // Billing — Cashier Sessions
  // -------------------------------------------------------------------------
  router.post('/billing/cashier-sessions', auth, async (req, res, next) => {
    try {
      const session = await services.billingService.openSession(req.body, req.context);
      res.status(201).json(session);
    } catch (err) { next(err); }
  });

  router.post('/billing/cashier-sessions/:id/close', auth, async (req, res, next) => {
    try {
      const session = await services.billingService.closeSession(req.params.id, req.body, req.context);
      res.json(session);
    } catch (err) { next(err); }
  });

  // -------------------------------------------------------------------------
  // Lab
  // -------------------------------------------------------------------------
  router.post('/lab/specimens/:id/collect', auth, async (req, res, next) => {
    try {
      const result = await services.labService.collectSpecimen(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/lab/results/:id/encode', auth, async (req, res, next) => {
    try {
      const result = await services.labService.encodeResult(req.params.id, req.body, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/lab/results/:id/validate', auth, async (req, res, next) => {
    try {
      const result = await services.labService.validateResult(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/lab/results/:id/approve', auth, async (req, res, next) => {
    try {
      const result = await services.labService.approveResult(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.post('/lab/results/:id/release', auth, async (req, res, next) => {
    try {
      const result = await services.labService.releaseResult(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  router.get('/lab/results/:id', auth, async (req, res, next) => {
    try {
      const result = await services.labService.getResult(req.params.id, req.context);
      res.json(result);
    } catch (err) { next(err); }
  });

  // -------------------------------------------------------------------------
  // Audit
  // -------------------------------------------------------------------------
  router.get('/audit', auth, async (req, res, next) => {
    try {
      const logs = await services.auditService.list(req.context);
      res.json({ data: logs });
    } catch (err) { next(err); }
  });

  router.get('/admin/users', auth, async (req, res, next) => {
    try {
      if (!req.context.can(PERMISSIONS.ADMIN_ROLE_CHANGE)) {
        throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'admin.role.change permission required');
      }
      res.json({ data: [] });
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = { buildRouter };
