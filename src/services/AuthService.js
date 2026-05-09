'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { ROLE_PERMISSIONS } = require('../core/permissions');
const { AppContext } = require('../core/AppContext');
const { verifyPassword } = require('../auth/hash');
const { signAccessToken, verifyAccessToken } = require('../auth/jwtService');

class AuthService {
  constructor({ userRepo, auditService, securityAuditService }) {
    this._userRepo = userRepo;
    this._audit = auditService;
    this._securityAudit = securityAuditService;
  }

  async login(email, password, tenantId, ipAddress, deviceInfo = '') {
    const demoCtx = new AppContext({
      requestId: randomUUID(),
      tenantId,
      branchId: 'system',
      userId: 'system',
      roles: ['system'],
      permissions: [],
      ipAddress,
      deviceInfo,
    });

    const user = await this._userRepo.findByEmail(email, demoCtx);
    const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordValid) {
      await this._audit.recordSecurityEvent(
        { tenantId, userId: email, ipAddress, deviceInfo },
        'auth.login.failed',
        { email, reason: 'invalid_credentials' }
      );
      if (this._securityAudit) {
        await this._securityAudit.log('LOGIN_FAILURE', { tenantId, subject: email, ip: ipAddress, deviceInfo });
      }
      throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid email or password');
    }

    if (user.status !== 'active') {
      await this._audit.recordSecurityEvent(
        { tenantId, userId: user.id, ipAddress, deviceInfo },
        'auth.login.failed',
        { email, reason: 'account_inactive' }
      );
      if (this._securityAudit) {
        await this._securityAudit.log('LOGIN_FAILURE', { tenantId, userId: user.id, subject: email, ip: ipAddress, deviceInfo });
      }
      throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'Account is not active');
    }

    const { token } = signAccessToken(user);

    await this._audit.record(
      new AppContext({
        requestId: randomUUID(),
        tenantId,
        branchId: user.branchId || 'system',
        userId: user.id,
        roles: user.roles,
        permissions: (user.roles || []).flatMap(r => ROLE_PERMISSIONS[r] || []),
      }),
      'auth.login.success',
      'User',
      user.id,
      { email }
    );

    if (this._securityAudit) {
      await this._securityAudit.log('LOGIN_SUCCESS', { tenantId, userId: user.id, ip: ipAddress, deviceInfo });
    }

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    };
  }

  decodeToken(token, requestId, ipAddress, deviceInfo = '') {
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid or expired token');
    }

    const permissions = (payload.roles || []).flatMap(r => ROLE_PERMISSIONS[r] || []);
    return new AppContext({
      requestId,
      tenantId: payload.tenantId,
      branchId: payload.branchId || 'default',
      userId: payload.userId || payload.sub,
      roles: payload.roles || [],
      permissions,
      ipAddress,
      deviceInfo,
    });
  }
}

module.exports = { AuthService };
