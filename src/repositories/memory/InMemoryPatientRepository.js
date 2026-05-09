'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

class InMemoryPatientRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant patient access denied');
    }
    return record;
  }

  async findByMRN(mrn, context, tx) {
    return this._all().find(
      r => r.mrn === mrn && r.tenantId === context.tenantId
    ) ?? null;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryPatientRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }
}

module.exports = { InMemoryPatientRepository };
