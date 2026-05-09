'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryNotificationRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
    return record;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryNotificationRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByUser(userId, context, filters = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.userId === userId
    );
  }
}

module.exports = { InMemoryNotificationRepository };
