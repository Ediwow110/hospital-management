'use strict';

/**
 * InMemoryStore — shared base for all in-memory repositories.
 * Each repository instance gets its own Map keyed by record ID.
 * NOT thread-safe. NOT durable. For demo/test only.
 */
class InMemoryStore {
  constructor() {
    /** @type {Map<string, object>} */
    this._store = new Map();
  }

  _get(id) {
    return this._store.get(id) ?? null;
  }

  _set(id, record) {
    this._store.set(id, { ...record });
    return { ...record };
  }

  _all() {
    return [...this._store.values()];
  }

  _delete(id) {
    this._store.delete(id);
  }

  _clear() {
    this._store.clear();
  }
}

module.exports = { InMemoryStore };
