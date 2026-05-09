'use strict';

const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { ROLE_PERMISSIONS } = require('../core/permissions');
const { AppContext } = require('../core/AppContext');
const { verifyPassword } = require('../auth/hash');
const { SECURITY_EVENT_TYPES } = require('./SecurityAuditService');
const REQUIRED_TOKEN_FIELDS = ['userId', 'tenantId', 'branchId', 'roles', 'jti', 'iat', 'exp'];

/**
 * AuthService — demo login only.
 *
 * WARNING: This uses plaintext password comparison for demo purposes.
 * PR #4 must replace this with bcrypt hash comparison against PostgreSQL users table.
 * Do NOT use this in any internet-facing environment.
 */
class AuthService {
  /**
   * @param {{ userRepo: object, auditService: object }} deps
   */
  constructor({ userRepo, auditService, securityAuditService, invalidatedTokenRepo }) {
    this._userRepo = userRepo;
    this._audit = auditService;
    this._securityAudit = securityAuditService;
    this._invalidatedTokens = invalidatedTokenRepo;
    this._jwtSecret = process.env.JWT_SECRET;
    if (!this._jwtSecret) {
      throw new Error('JWT_SECRET is required');
    }
    this._jwtExpiry = process.env.JWT_EXPIRES_IN || '1h';
  }

  /**
   * Demo login.
   * Returns a synthetic session token (not a real JWT).
   * PR #4: replace with signed JWT + refresh token.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} tenantId
   * @param {string} ipAddress
   * @param {string} [deviceInfo]
   * @returns {Promise<{ token: string, user: object }>}
   */
  async login(email, password, tenantId, ipAddress, deviceInfo = '') {
    const systemCtx = {
      tenantId,
      branchId: 'system',
      userId:   'system',
      ipAddress,
      deviceInfo,
    };

    const demoCtx = new AppContext({
      requestId:  randomUUID(),
      tenantId,
      branchId:   'system',
      userId:     'system',
      roles:      ['system'],
      permissions: [],
    });

    const user = await this._userRepo.findByEmail(email, demoCtx);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      // Security event: persisted outside any business tx
      await this._securityAudit.log(SECURITY_EVENT_TYPES.LOGIN_FAILURE, {
        tenantId,
        userId: email,
        ipAddress,
        metadata: { email, reason: 'invalid_credentials' },
      });
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid credentials');
    }

    if (user.status !== 'active') {
      await this._securityAudit.log(SECURITY_EVENT_TYPES.LOGIN_FAILURE, {
        tenantId,
        userId: user.id,
        ipAddress,
        metadata: { email, reason: 'account_inactive' },
      });
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Account is not active');
    }

    const jti = randomUUID();
    const token = jwt.sign({
      userId: user.id,
      tenantId,
      branchId: user.branchId || 'default',
      roles: user.roles || [],
      jti,
    }, this._jwtSecret, { expiresIn: this._jwtExpiry });

    await this._audit.record(
      new AppContext({
        requestId:   randomUUID(),
        tenantId,
        branchId:    user.branchId || 'system',
        userId:      user.id,
        roles:       user.roles,
        permissions: (user.roles || []).flatMap(r => ROLE_PERMISSIONS[r] || []),
      }),
      'auth.login.success',
      'User',
      user.id,
      { email }
    );

    await this._securityAudit.log(SECURITY_EVENT_TYPES.LOGIN_SUCCESS, {
      tenantId,
      userId: user.id,
      ipAddress,
      metadata: { email, branchId: user.branchId || 'default' },
    });

    return {
      token,
      user: {
        id:       user.id,
        email:    user.email,
        name:     user.name,
        roles:    user.roles,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    };
  }

  /**
   * Decode demo token into AppContext.
   * PR #4: replace with JWT verification.
   * @param {string} token
   * @param {string} requestId
   * @param {string} ipAddress
   * @param {string} [deviceInfo]
   * @returns {AppContext}
   */
  async decodeToken(token, requestId, ipAddress, deviceInfo = '') {
    try {
      const payload = jwt.verify(token, this._jwtSecret);
      const hasAllRequiredFields = REQUIRED_TOKEN_FIELDS.every(field => payload[field]);
      if (!hasAllRequiredFields || !Array.isArray(payload.roles)) {
        throw new Error('Invalid token payload');
      }
      if (this._invalidatedTokens && await this._invalidatedTokens.isInvalidated(payload.jti)) {
        throw new Error('Token revoked');
      }
      const permissions = (payload.roles || []).flatMap(r => ROLE_PERMISSIONS[r] || []);
      return new AppContext({
        requestId,
        tenantId:    payload.tenantId,
        branchId:    payload.branchId || 'default',
        userId:      payload.userId,
        roles:       payload.roles || [],
        permissions,
        ipAddress,
        deviceInfo,
        tokenJti: payload.jti,
      });
    } catch {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid or expired token');
    }
  }

  async logout(context) {
    if (!context.tokenJti) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Missing token identifier');
    }
    await this._invalidatedTokens.invalidate({
      jti: context.tokenJti,
      tenantId: context.tenantId,
      userId: context.userId,
      invalidatedAt: new Date().toISOString(),
    });
    await this._securityAudit.log(SECURITY_EVENT_TYPES.TOKEN_REVOKED, {
      tenantId: context.tenantId,
      userId: context.userId,
      ipAddress: context.ipAddress,
      metadata: { jti: context.tokenJti },
    });
  }
}

module.exports = { AuthService };
