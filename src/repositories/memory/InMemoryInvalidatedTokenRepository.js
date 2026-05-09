'use strict';

class InMemoryInvalidatedTokenRepository {
  constructor() {
    this._tokens = new Map();
  }

  async invalidate(record) {
    const entity = {
      jti: record.jti,
      tenantId: record.tenantId,
      userId: record.userId,
      invalidatedAt: record.invalidatedAt || new Date().toISOString(),
    };
    this._tokens.set(entity.jti, entity);
    return { ...entity };
  }

  async isInvalidated(jti) {
    return this._tokens.has(jti);
  }
}

module.exports = { InMemoryInvalidatedTokenRepository };
