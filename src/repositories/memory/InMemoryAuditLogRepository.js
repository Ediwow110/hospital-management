'use strict';

const { AppError, ERROR_CODES } = require('../../core/AppError');

/**
 * InMemoryAuditLogRepository
 *
 * IMMUTABILITY RULE:
 *   Audit logs are INSERT-ONLY.
 *   No update or delete methods are exposed on this class.
 *   In PR #4, a PostgreSQL trigger will enforce this at the DB level.
 */
class InMemoryAuditLogRepository {
  constructor() {
    /** @type {object[]} */
    this._logs = [];
  }

  /**
   * @param {object} entry
   * @param {AppContext} context
   * @param {*} [tx]
   * @returns {Promise<object>}
   */
  async insert(entry, context, tx) {
    const log = {
      id:           entry.id,
      tenantId:     context.tenantId,
      branchId:     context.branchId,
      actorUserId:  context.userId,
      action:       entry.action,
      entityType:   entry.entityType,
      entityId:     entry.entityId,
      payload:      entry.payload ?? null,
      ipAddress:    context.ipAddress ?? '',
      deviceInfo:   context.deviceInfo ?? '',
      createdAt:    new Date().toISOString(),
    };
    this._logs.push(log);
    return { ...log };
  }

  async listByTenant(tenantId, context, filters = {}, pagination = {}, tx) {
    if (tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant audit access denied');
    }
    return this._logs.filter(l => l.tenantId === tenantId);
  }

  async listByEntity(entityId, context, filters = {}, pagination = {}, tx) {
    return this._logs.filter(
      l => l.entityId === entityId && l.tenantId === context.tenantId
    );
  }
}

module.exports = { InMemoryAuditLogRepository };
