'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryPatientRepository.${method}: context.tenantId is required`
    );
  }
}

class InMemoryPatientRepository extends InMemoryStore {
  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        'Cross-tenant patient access denied'
      );
    }
    return record;
  }

  async findByMRN(mrn, context, tx) {
    requireTenantId(context, 'findByMRN');
    return (
      this._all().find(
        r => r.mrn === mrn && r.tenantId === context.tenantId
      ) ?? null
    );
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryPatientRepository.save: entity.id required');
    const record = {
      ...entity,
      tenantId: context.tenantId,
      updatedAt: new Date().toISOString()
    };
    return this._set(entity.id, record);
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByBranch');
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }

  /**
   * SECURITY ONLY: returns tenantId without scoping.
   * Use only for cross-tenant detection logging. Never return patient data via this path.
   */
  findTenantIdByIdUnscopedForSecurityCheck(id) {
    const record = this._get(id);
    return record ? (record.tenantId ?? null) : null;
  }
}

module.exports = { InMemoryPatientRepository };
