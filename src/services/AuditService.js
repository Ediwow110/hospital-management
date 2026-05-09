'use strict';

const { randomUUID } = require('crypto');

/**
 * AuditService — records sensitive business actions.
 *
 * In PR #3: in-memory audit log.
 * In PR #4: durable PostgreSQL audit log with insert-only trigger.
 *
 * Security events (permission denied, failed login) MUST be written
 * outside any business transaction so they persist even on rollback.
 */
class AuditService {
  /**
   * @param {{ auditLogRepo: import('../repositories/interfaces/AuditLogRepository') }} repos
   */
  constructor({ auditLogRepo }) {
    this._repo = auditLogRepo;
  }

  /**
   * Record a business audit event.
   * @param {AppContext} context
   * @param {string} action          - e.g. 'patient.create'
   * @param {string} entityType      - e.g. 'Patient'
   * @param {string} entityId
   * @param {object} [payload]       - sanitized payload (no PII/PHI unredacted in logs)
   * @param {*} [tx]                 - bind to business transaction when appropriate
   * @returns {Promise<object>}
   */
  async record(context, action, entityType, entityId, payload = {}, tx = null) {
    return this._repo.insert({
      id: randomUUID(),
      action,
      entityType,
      entityId,
      payload,
    }, context, tx);
  }

  /**
   * Record a security event.
   * Must NOT be passed a tx — security events persist regardless of business tx outcome.
   * @param {object} securityCtx     - partial context (may not have full AppContext on auth failure)
   * @param {string} action
   * @param {object} [payload]
   */
  async recordSecurityEvent(securityCtx, action, payload = {}) {
    const ctx = {
      tenantId:   securityCtx.tenantId  || 'unknown',
      branchId:   securityCtx.branchId  || 'unknown',
      userId:     securityCtx.userId    || 'anonymous',
      ipAddress:  securityCtx.ipAddress || '',
      deviceInfo: securityCtx.deviceInfo || '',
    };
    return this._repo.insert({
      id: randomUUID(),
      action,
      entityType: 'SecurityEvent',
      entityId:   securityCtx.userId || 'anonymous',
      payload,
    }, ctx, null /* no tx — intentional */);
  }

  /**
   * @param {AppContext} context
   * @param {object} filters
   * @param {object} pagination
   * @returns {Promise<Array>}
   */
  async list(context, filters = {}, pagination = {}) {
    const { PERMISSIONS } = require('../core/permissions');
    const { AppError, ERROR_CODES } = require('../core/AppError');
    if (!context.can(PERMISSIONS.AUDIT_VIEW)) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'audit.view permission required');
    }
    return this._repo.listByTenant(context.tenantId, context, filters, pagination);
  }
}

module.exports = { AuditService };
