'use strict';

class InMemoryInvalidatedTokenRepository {
  constructor() {
    this._store = new Map();
  }

  async revoke({ jti, tenantId, userId, expiresAt, reason }) {
    this._store.set(jti, { jti, tenantId, userId, expiresAt, revokedAt: new Date(), reason });
  }

  async isRevoked(jti) {
    return this._store.has(jti);
  }

  async cleanup() {
    const now = new Date();
    for (const [jti, record] of this._store) {
      if (record.expiresAt && record.expiresAt < now) this._store.delete(jti);
    }
  }
}

class PostgresInvalidatedTokenRepository {
  constructor(db) {
    this.db = db;
  }

  async revoke({ jti, tenantId, userId, expiresAt, reason }) {
    await this.db.query(
      `INSERT INTO invalidated_tokens (id, jti, tenant_id, user_id, expires_at, reason)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
       ON CONFLICT (jti) DO NOTHING`,
      [jti, tenantId, userId, expiresAt, reason || 'logout']
    );
  }

  async isRevoked(jti) {
    const result = await this.db.query('SELECT 1 FROM invalidated_tokens WHERE jti = $1', [jti]);
    return result.rows.length > 0;
  }
}

module.exports = { InMemoryInvalidatedTokenRepository, PostgresInvalidatedTokenRepository };
