'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR,
      `InMemoryApprovalRepository.${method}: context.tenantId is required`);
  }
}

class InMemoryApprovalRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId)
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant approval access denied');
    return record;
  }
  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryApprovalRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }
  async listPendingByTarget(targetType, targetId, context, tx) {
    requireTenantId(context, 'listPendingByTarget');
    return this._all().filter(r => r.targetType === targetType && r.targetId === targetId &&
      r.tenantId === context.tenantId && r.status === 'Pending');
  }
  async listByApprover(approverId, context, tx) {
    requireTenantId(context, 'listByApprover');
    return this._all().filter(r => r.approverId === approverId && r.tenantId === context.tenantId);
  }
}

module.exports = { InMemoryApprovalRepository };
