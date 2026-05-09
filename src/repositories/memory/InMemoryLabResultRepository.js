'use strict';

const { InMemoryStore } = require('./InMemoryStore');
const { AppError, ERROR_CODES } = require('../../core/AppError');

function requireTenantId(context, method) {
  if (!context || !context.tenantId) {
    throw new AppError(
      ERROR_CODES.VALIDATION_ERROR,
      `InMemoryLabResultRepository.${method}: context.tenantId is required`
    );
  }
}

/**
 * IMMUTABILITY RULE (app-layer):
 *   save() rejects if the existing record has status Released.
 *   Use saveVersion() for the amendment workflow.
 *   DB-level trigger in migrations/009_tenant_db_guards.sql enforces the same rule.
 */
class InMemoryLabResultRepository extends InMemoryStore {
  constructor() {
    super();
    this._versions = new Map();
  }

  async findById(id, context, tx) {
    requireTenantId(context, 'findById');
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Cross-tenant lab result access denied');
    }
    return record;
  }

  async findByLabNumber(labNo, context, tx) {
    requireTenantId(context, 'findByLabNumber');
    return this._all().find(r => r.labNo === labNo && r.tenantId === context.tenantId) ?? null;
  }

  async save(entity, context, tx) {
    requireTenantId(context, 'save');
    if (!entity.id) throw new Error('InMemoryLabResultRepository.save: entity.id required');
    const existing = this._get(entity.id);
    if (existing && existing.status === 'Released') {
      throw new AppError(
        ERROR_CODES.RECORD_LOCKED,
        'released_lab_result_immutable: Released lab results cannot be directly modified. Use the amendment workflow.'
      );
    }
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async saveVersion(entity, context, tx) {
    requireTenantId(context, 'saveVersion');
    if (!entity.id) throw new Error('saveVersion: entity.id required');
    const existing = this._get(entity.id);
    if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND, 'Lab result not found for amendment');
    const versions = this._versions.get(entity.id) || [];
    versions.push({ ...existing, versionedAt: new Date().toISOString() });
    this._versions.set(entity.id, versions);
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByOrder(orderId, context, tx) {
    requireTenantId(context, 'listByOrder');
    return this._all().filter(r => r.orderId === orderId && r.tenantId === context.tenantId);
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    requireTenantId(context, 'listByBranch');
    return this._all().filter(r => r.tenantId === context.tenantId && r.branchId === branchId);
  }

  findTenantIdByIdUnscopedForSecurityCheck(id) {
    const record = this._get(id);
    return record ? (record.tenantId ?? null) : null;
  }
}

module.exports = { InMemoryLabResultRepository };
