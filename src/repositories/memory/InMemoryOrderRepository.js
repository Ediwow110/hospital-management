'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryOrderRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
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
