'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryInvoiceRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
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
