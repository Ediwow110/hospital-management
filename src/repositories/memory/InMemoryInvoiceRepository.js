'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryInvoiceRepository.${method}: context.tenantId is required`
    );
  }
}

class InMemoryInvoiceRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        'Cross-tenant invoice access denied'
      );
    }
    return record;
  }

  async findByInvoiceNumber(invoiceNo, context, tx) {
    requireTenantId(context, 'findByInvoiceNumber');
    return (
      this._all().find(
        r => r.invoiceNo === invoiceNo && r.tenantId === context.tenantId
      ) ?? null
    );
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryInvoiceRepository.save: entity.id required');
    const record = {
      ...entity,
      tenantId: context.tenantId,
      updatedAt: new Date().toISOString()
    };
    return this._set(entity.id, record);
  }

  async listByPatient(patientId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByPatient');
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.patientId === patientId
    );
  }

  async findByOrderId(orderId, context, tx) {
    requireTenantId(context, 'findByOrderId');
    return (
      this._all().find(
        r => r.orderId === orderId && r.tenantId === context.tenantId
      ) ?? null
    );
  }
}

module.exports = { InMemoryInvoiceRepository };
