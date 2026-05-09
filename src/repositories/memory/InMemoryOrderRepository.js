'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryOrderRepository.${method}: context.tenantId is required`
    );
  }
}

class InMemoryOrderRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        'Cross-tenant order access denied'
      );
    }
    return record;
  }

  async findByOrderNumber(orderNo, context, tx) {
    requireTenantId(context, 'findByOrderNumber');
    return (
      this._all().find(
        r => r.orderNo === orderNo && r.tenantId === context.tenantId
      ) ?? null
    );
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryOrderRepository.save: entity.id required');
    const record = {
      ...entity,
      tenantId: context.tenantId,
      updatedAt: new Date().toISOString()
    };
    return this._set(entity.id, record);
  }

  async listByPatient(patientId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByPatient');
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.patientId === patientId
    );
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByBranch');
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }
}

module.exports = { InMemoryOrderRepository };
