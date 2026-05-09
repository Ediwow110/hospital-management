'use strict';

const { AppContext } = require('../core/AppContext');
const { ROLE_PERMISSIONS } = require('../core/permissions');
const { verifyAccessToken } = require('../auth/jwtService');

function createAuthMiddleware(container) {
  return async function authenticate(req, res, next) {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' });
      }

      const token = authHeader.slice(7);
      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
      }

      const tokenRepo =
        (typeof container.resolve === 'function' && container.resolve('invalidatedTokenRepository')) ||
        (container.repos && container.repos.invalidatedTokenRepository);

      if (tokenRepo) {
        const isRevoked = await tokenRepo.isRevoked(decoded.jti, decoded.tenantId);
        if (isRevoked) {
          return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token has been revoked' });
        }
      }

      req.auth = {
        userId: decoded.userId || decoded.sub,
        tenantId: decoded.tenantId,
        branchId: decoded.branchId || null,
        roles: decoded.roles || [],
        jti: decoded.jti,
        exp: decoded.exp,
      };

      const permissions = req.auth.roles.flatMap(role => ROLE_PERMISSIONS[role] || []);
      req.context = new AppContext({
        requestId: req.requestId,
        tenantId: req.auth.tenantId,
        branchId: req.auth.branchId || 'default',
        userId: req.auth.userId,
        roles: req.auth.roles,
        permissions,
        ipAddress: req.ip || '',
        deviceInfo: req.headers['user-agent'] || '',
      });

      next();
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Authentication error' });
    }
  };
}

module.exports = { createAuthMiddleware };
