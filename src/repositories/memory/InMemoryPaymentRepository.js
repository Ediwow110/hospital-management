'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryPaymentRepository.${method}: context.tenantId is required`
    );
  }
}

class InMemoryPaymentRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        'Cross-tenant payment access denied'
      );
    }
    return record;
  }

  async findByReceiptNumber(receiptNo, context, tx) {
    requireTenantId(context, 'findByReceiptNumber');
    return (
      this._all().find(
        r => r.receiptNo === receiptNo && r.tenantId === context.tenantId
      ) ?? null
    );
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryPaymentRepository.save: entity.id required');
    const record = {
      ...entity,
      tenantId: context.tenantId,
      updatedAt: new Date().toISOString()
    };
    return this._set(entity.id, record);
  }

  async listByInvoice(invoiceId, context, tx) {
    requireTenantId(context, 'listByInvoice');
    return this._all().filter(
      r => r.invoiceId === invoiceId && r.tenantId === context.tenantId
    );
  }

  async listBySession(sessionId, context, tx) {
    requireTenantId(context, 'listBySession');
    return this._all().filter(
      r => r.cashierSessionId === sessionId && r.tenantId === context.tenantId
    );
  }

  async sumByInvoice(invoiceId, context, tx) {
    requireTenantId(context, 'sumByInvoice');
    const payments = await this.listByInvoice(invoiceId, context, tx);
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }
}

module.exports = { InMemoryPaymentRepository };
