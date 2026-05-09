'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

class InMemoryOrderRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant order access denied', {
        crossTenant: true,
        entityType: 'order',
        entityId: id,
      });
    }
    return record;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryOrderRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByPatient(patientId, context, filters = {}, pagination = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.patientId === patientId
    );
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }
}

module.exports = { InMemoryOrderRepository };
