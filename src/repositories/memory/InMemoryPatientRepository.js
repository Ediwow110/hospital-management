'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryPatientRepository extends InMemoryStore {
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record || record.tenantId !== context.tenantId) return null;
    return record;
  }

  async findByMRN(mrn, context, tx) {
    return this._all().find(
      r => r.mrn === mrn && r.tenantId === context.tenantId
    ) ?? null;
  }

  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryPatientRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  async listByBranch(branchId, context, filters = {}, pagination = {}, tx) {
    return this._all().filter(
      r => r.tenantId === context.tenantId && r.branchId === branchId
    );
  }

  /**
   * Returns only { id, tenantId } for the given record id, without tenant scoping.
   * MUST NOT return PHI. Used exclusively for CROSS_TENANT_ACCESS_ATTEMPT detection.
   * Never call this from a user-facing read path.
   * @param {string} id
   * @returns {{ id: string, tenantId: string } | null}
   */
  findTenantIdByIdUnscopedForSecurityCheck(id) {
    const record = this._get(id);
    if (!record) return null;
    return { id: record.id, tenantId: record.tenantId };
  }
}

module.exports = { InMemoryPatientRepository };
