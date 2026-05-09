'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { ROLE_PERMISSIONS } = require('../core/permissions');
const { AppContext } = require('../core/AppContext');

/**
 * AuthService — JWT-based authentication with bcrypt password verification.
 * PR #9: replaced demo-token/Buffer.from auth with proper JWT + bcrypt.
 * Still uses in-memory repos; PostgreSQL deferred to PR #4+.
 */
class AuthService {
  /**
   * @param {{ userRepo: object, auditService: object }} deps
   */
  constructor({ userRepo, auditService }) {
    this._userRepo = userRepo;
    this._audit = auditService;
    // PR #4: move JWT_SECRET to environment variable with proper key management
    this._jwtSecret = process.env.JWT_SECRET || 'hms-demo-secret-change-in-production';
    this._jwtExpiry = process.env.JWT_EXPIRY || '8h';
  }

  /**
   * Login with bcrypt password verification and JWT token generation.
   *
   * @param {string} email
   * @param {string} password
   * @param {string} tenantId
   * @param {string} ipAddress
   * @param {string} [deviceInfo]
   * @returns {Promise<{ token: string, user: object }>}
   */
  async login(email, password, tenantId, ipAddress, deviceInfo = '') {
    const demoCtx = new AppContext({
      requestId: randomUUID(),
      tenantId,
      branchId: 'system',
      userId: 'system',
      roles: ['system'],
      permissions: [],
    });

    const user = await this._userRepo.findByEmail(email, demoCtx);

    if (!user || !user.passwordHash) {
      // Security event: persisted outside any business transaction
      await this._audit.recordSecurityEvent(
        { tenantId, userId: email, ipAddress, deviceInfo },
        'auth.login_failed',
        { email, reason: 'invalid_credentials' }
      );
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid credentials');
    }

    if (user.status !== 'active') {
      await this._audit.recordSecurityEvent(
        { tenantId, userId: user.id, ipAddress, deviceInfo },
        'auth.login_failed',
        { email, reason: 'account_inactive' }
      );
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Account is not active');
    }

    // bcrypt verification (not plaintext comparison)
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await this._audit.recordSecurityEvent(
        { tenantId, userId: user.id, ipAddress, deviceInfo },
        'auth.login_failed',
        { email, reason: 'invalid_credentials' }
      );
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid credentials');
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId,
        roles: user.roles,
        iat: Date.now(),
      },
      this._jwtSecret,
      { expiresIn: this._jwtExpiry }
    );

    await this._audit.record(
      new AppContext({
        requestId: randomUUID(),
        tenantId,
        branchId: user.branchId || 'system',
        userId: user.id,
        roles: user.roles,
        permissions: [],
      }),
      'auth.login_success',
      { email, ipAddress, deviceInfo }
    );

    return { token, user: { ...user, passwordHash: undefined } };
  }

  /**
   * Verify JWT token and return decoded payload.
   *
   * @param {string} token
   * @returns {Promise<object>}
   */
  async verifyToken(token) {
    try {
      const payload = jwt.verify(token, this._jwtSecret);
      const permissions = (payload.roles || []).flatMap((r) => ROLE_PERMISSIONS[r] || []);
      return { ...payload, permissions };
    } catch (err) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Invalid or expired token');
    }
  }

  /**
   * Logout (currently no server-side revocation).
   * PR #4+: implement revocation table for server-side token invalidation.
   *
   * @param {string} token
   * @param {object} context
   * @returns {Promise<void>}
   */
  async logout(token, context) {
    await this._audit.record(context, 'auth.logout', { userId: context.userId });
    // PR #4+: add token to revocation list in PostgreSQL
  }
}

module.exports = { AuthService };
