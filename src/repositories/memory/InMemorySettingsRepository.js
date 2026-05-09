'use strict';

class InMemorySettingsRepository {
  constructor() {
    /** @type {Map<string, object>} key = `${tenantId}::${key}` */
    this._store = new Map();
  }

  _key(key, tenantId) {
    return `${tenantId}::${key}`;
  }

  async get(key, tenantId, context, tx) {
    return this._store.get(this._key(key, tenantId)) ?? null;
  }

  async set(key, tenantId, value, context, tx) {
    const entry = { key, tenantId, value, updatedAt: new Date().toISOString() };
    this._store.set(this._key(key, tenantId), entry);
    return entry;
  }

  async listByTenant(tenantId, context, tx) {
    return [...this._store.values()].filter(e => e.tenantId === tenantId);
  }
}

module.exports = { InMemorySettingsRepository };
