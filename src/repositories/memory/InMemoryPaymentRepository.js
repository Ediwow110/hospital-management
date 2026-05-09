'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryPaymentRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
    return record;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryPaymentRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByInvoice(invoiceId, context, tx) {
    return this._all().filter(
      r => r.invoiceId === invoiceId && r.tenantId === context.tenantId
    );
  }

  async listBySession(sessionId, context, tx) {
    return this._all().filter(
      r => r.cashierSessionId === sessionId && r.tenantId === context.tenantId
    );
  }
}

module.exports = { InMemoryPaymentRepository };
