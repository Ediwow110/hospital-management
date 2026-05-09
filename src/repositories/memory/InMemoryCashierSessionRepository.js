'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryCashierSessionRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
    return record;
  }

  async findByIdOrNumber(idOrNumber, context, tx) {
    const byId = this._get(idOrNumber);
    if (byId && byId.tenantId === context.tenantId) return byId;
    const byNumber = this._all().find(
      r => r.number === idOrNumber && r.tenantId === context.tenantId
    );
    return byNumber ?? null;
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
}

module.exports = { InMemoryCashierSessionRepository };
