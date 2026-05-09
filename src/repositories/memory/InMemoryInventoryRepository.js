'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryInventoryRepository.${method}: context.tenantId is required`
    );
  }
}

class InMemoryInventoryRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant inventory access denied');
    }
    return record;
  }

  async findByItemCode(code, context, tx) {
    requireTenantId(context, 'findByItemCode');
    return this._all().find(r => r.itemCode === code && r.tenantId === context.tenantId) ?? null;
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryInventoryRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByBranch');
    return this._all().filter(r => r.tenantId === context.tenantId && r.branchId === branchId);
  }

  async findStockBatchById(batchId, context, tx) {
    requireTenantId(context, 'findStockBatchById');
    const record = this._get(batchId);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant stock batch access denied');
    }
    return record;
  }
}

module.exports = { InMemoryInventoryRepository };
