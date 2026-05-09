'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');

function buildRouter(container, authenticate) {
  const router = express.Router();
  const { services, repos } = container;
  const auth = authenticate;
  const invalidatedTokenRepository = repos.invalidatedTokenRepository;

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: req => {
      const tenantId = req.body?.tenantId || req.headers['x-tenant-id'] || 'unknown';
      const email = req.body?.email || 'unknown';
      const ip = req.ip || req.connection?.remoteAddress || 'unknown';
      return `${tenantId}:${email}:${ip}`;
    },
    handler: async (req, res) => {
      const tenantId = req.body?.tenantId || req.headers['x-tenant-id'] || null;
      const email = req.body?.email || null;
      try {
        await services.securityAuditService.log('LOGIN_LOCKOUT', {
          tenantId,
          subject: email,
          ip: req.ip,
          payload: { reason: 'Rate limit exceeded on login' },
        });
      } catch (_) {}
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Too many failed login attempts. Try again in 15 minutes.',
        retryAfter: 15 * 60,
      });
    },
    skipSuccessfulRequests: true,
    standardHeaders: false,
    legacyHeaders: false,
  });

  router.get('/health', (req, res) => {
    res.json(services.healthService.check());
  });

  router.post('/auth/login', loginLimiter, async (req, res, next) => {
    try {
      const { email, password, tenantId } = req.body;
      if (!email || !password || !tenantId) {
        return res.status(400).json({ error: { code: 'validation_error', message: 'email, password, tenantId required' } });
      }
      const result = await services.authService.login(
        email,
        password,
        tenantId,
        req.ip || '',
        req.headers['user-agent'] || ''
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', auth, async (req, res) => {
    try {
      const { jti, userId, tenantId, exp } = req.auth;
      const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 15 * 60 * 1000);
      await invalidatedTokenRepository.revoke({ jti, tenantId, userId, expiresAt, reason: 'logout' });
      await services.securityAuditService.log('TOKEN_REVOKED', { tenantId, userId, subject: jti, ip: req.ip });
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Logout failed' });
    }
  });

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

  router.post('/orders', auth, async (req, res, next) => {
    try {
      const result = await services.orderService.createOrder(req.body, req.context);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

  router.post('/billing/invoices/:id/payments', auth, async (req, res, next) => {
    try {
      const result = await services.billingService.postPayment(req.params.id, req.body, req.context);
      res.status(201).json(result);
    } catch (err) { next(err); }
  });

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

  router.get('/audit', auth, async (req, res, next) => {
    try {
      const logs = await services.auditService.list(req.context);
      res.json({ data: logs });
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = { buildRouter };
