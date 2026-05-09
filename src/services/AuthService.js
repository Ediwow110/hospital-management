'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { ROLE_PERMISSIONS } = require('../core/permissions');
const { AppContext } = require('../core/AppContext');

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
  constructor({ userRepo, auditService }) {
    this._userRepo = userRepo;
    this._audit = auditService;
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

    if (!user || user.passwordHash !== password) {
      // Security event: persisted outside any business tx
      await this._audit.recordSecurityEvent(
        { tenantId, userId: email, ipAddress, deviceInfo },
        'auth.login.failed',
        { email, reason: 'invalid_credentials' }
      );
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid credentials');
    }

    if (user.status !== 'active') {
      await this._audit.recordSecurityEvent(
        { tenantId, userId: user.id, ipAddress, deviceInfo },
        'auth.login.failed',
        { email, reason: 'account_inactive' }
      );
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Account is not active');
    }

    // Demo token: base64(userId:tenantId:timestamp) — NOT secure, PR #4 replaces
    const token = Buffer.from(
      JSON.stringify({ userId: user.id, tenantId, roles: user.roles, iat: Date.now() })
    ).toString('base64');

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
  decodeToken(token, requestId, ipAddress, deviceInfo = '') {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
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
      });
    } catch {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid or expired token');
    }
  }
}

module.exports = { AuthService };
