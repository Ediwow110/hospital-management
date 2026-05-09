'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

class InMemoryLabResultRepository extends InMemoryStore {
  constructor() {
    super();
    this._versions = new Map();
  }

  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
    return record;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryLabResultRepository.save: entity.id required');

    const existing = this._get(entity.id);
    if (existing && existing.status === 'Released') {
      throw new AppError(
        ERROR_CODES.RECORD_LOCKED,
        'Released lab result cannot be directly updated. Create an amendment.',
        { id: entity.id, currentStatus: 'Released' }
      );
    }

    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async saveVersion(entity, context, tx) {
    if (!entity.labResultId) throw new Error('saveVersion: entity.labResultId required');
    if (!this._versions.has(entity.labResultId)) {
      this._versions.set(entity.labResultId, []);
    }
    const version = { ...entity, createdAt: new Date().toISOString() };
    this._versions.get(entity.labResultId).push(version);
    return version;
  }

  async listByOrder(orderId, context, filters = {}, tx) {
    return this._all().filter(
      r => r.orderId === orderId && r.tenantId === context.tenantId
    );
  }
}

module.exports = { InMemoryLabResultRepository };
