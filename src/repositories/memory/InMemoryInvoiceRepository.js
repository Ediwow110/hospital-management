'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

class InMemoryInvoiceRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant invoice access denied', {
        crossTenant: true,
        entityType: 'invoice',
        entityId: id,
      });
    }
    return record;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryInvoiceRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByPatient(patientId, context, filters = {}, pagination = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.patientId === patientId
    );
  }

  async findByOrderId(orderId, context, tx) {
    return this._all().find(
      r => r.orderId === orderId && r.tenantId === context.tenantId
    ) ?? null;
  }
}

module.exports = { InMemoryInvoiceRepository };
