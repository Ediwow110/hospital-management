'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryCashierSessionRepository.${method}: context.tenantId is required`
    );
  }
}

class InMemoryCashierSessionRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        'Cross-tenant cashier session access denied'
      );
    }
    return record;
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryCashierSessionRepository.save: entity.id required');
    const record = {
      ...entity,
      tenantId: context.tenantId,
      updatedAt: new Date().toISOString()
    };
    return this._set(entity.id, record);
  }

  async findOpenByUser(userId, context, tx) {
    requireTenantId(context, 'findOpenByUser');
    return (
      this._all().find(
        r =>
          r.userId === userId &&
          r.tenantId === context.tenantId &&
          r.status === 'Open'
      ) ?? null
    );
  }

  async findActiveByCashier(userId, context, tx) {
    return this.findOpenByUser(userId, context, tx);
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByBranch');
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }
}

module.exports = { InMemoryCashierSessionRepository };
