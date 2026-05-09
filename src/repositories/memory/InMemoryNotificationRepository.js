'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR,
      `InMemoryNotificationRepository.${method}: context.tenantId is required`);
  }
}

class InMemoryNotificationRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId)
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant notification access denied');
    return record;
  }
  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryNotificationRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }
  async listByRecipient(userId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByRecipient');
    return this._all().filter(r => r.recipientId === userId && r.tenantId === context.tenantId);
  }
  async markRead(id, context, tx) {
    requireTenantId(context, 'markRead');
    const record = await this.findById(id, context, tx);
    if (!record) return null;
    return this._set(id, { ...record, read: true, updatedAt: new Date().toISOString() });
  }
}

module.exports = { InMemoryNotificationRepository };
