'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryCashierSessionRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
    return record;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryCashierSessionRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async findOpenByUser(userId, context, tx) {
    return this._all().find(
      r => r.userId === userId &&
           r.tenantId === context.tenantId &&
           r.status === 'Open'
    ) ?? null;
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }

  async findByIdOrNumber(value, context, tx) {
    const byId = this._get(value);
    if (byId) {
      return byId.tenantId === context.tenantId ? byId : null;
    }
    const byNumber = this._all().find(r => r.number === value);
    if (!byNumber) return null;
    return byNumber.tenantId === context.tenantId ? byNumber : null;
  }
}

module.exports = { InMemoryCashierSessionRepository };
