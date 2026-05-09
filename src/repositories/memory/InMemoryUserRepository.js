'use strict';

const { InMemoryStore } = require('./InMemoryStore');

/**
 * InMemoryUserRepository
 * Implements UserRepository interface.
 * Scopes reads/writes to context.tenantId.
 */
class InMemoryUserRepository extends InMemoryStore {
  /**
   * @param {string} id
   * @param {AppContext} context
   * @param {*} [tx] - ignored in memory adapter
   * @returns {Promise<object|null>}
   */
  async findById(id, context, tx) {
    const record = this._get(id);
    if (!record) return null;
    if (record.tenantId !== context.tenantId) return null; // cross-tenant guard
    return record;
  }

  /**
   * @param {string} email
   * @param {AppContext} context
   * @param {*} [tx]
   * @returns {Promise<object|null>}
   */
  async findByEmail(email, context, tx) {
    const record = this._all().find(
      r => r.email === email && r.tenantId === context.tenantId
    );
    return record ?? null;
  }

  /**
   * @param {object} entity
   * @param {AppContext} context
   * @param {*} [tx]
   * @returns {Promise<object>}
   */
  async save(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryUserRepository.save: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    return this._set(entity.id, record);
  }

  /**
   * @param {object} filters
   * @param {AppContext} context
   * @param {*} [tx]
   * @returns {Promise<Array>}
   */
  async list(filters, context, tx) {
    return this._all().filter(r => r.tenantId === context.tenantId);
  }
}

module.exports = { InMemoryUserRepository };
