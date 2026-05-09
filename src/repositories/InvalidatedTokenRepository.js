'use strict';

class InMemoryInvalidatedTokenRepository {
  constructor() {
    this._store = new Map();
  }

  async revoke({ jti, tenantId, userId, expiresAt, reason }) {
    this._store.set(jti, { jti, tenantId, userId, expiresAt, revokedAt: new Date(), reason });
  }

  /**
   * Check if a token jti has been revoked.
   * Requires tenantId for multi-tenant correctness.
   * @param {string} jti
   * @param {string} tenantId
   * @returns {Promise<boolean>}
   */
  async isRevoked(jti, tenantId) {
    if (!jti || !tenantId) return false;
    const record = this._store.get(jti);
    if (!record) return false;
    return record.tenantId === tenantId;
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
       ON CONFLICT (tenant_id, jti) DO NOTHING`,
      [jti, tenantId, userId, expiresAt, reason || 'logout']
    );
  }

  /**
   * Check if a token jti has been revoked for this tenant.
   * Scoped by both jti AND tenant_id to prevent cross-tenant jti collisions.
   * @param {string} jti
   * @param {string} tenantId
   * @returns {Promise<boolean>}
   */
  async isRevoked(jti, tenantId) {
    if (!jti || !tenantId) return false;
    const result = await this.db.query(
      `SELECT 1
       FROM invalidated_tokens
       WHERE jti = $1
         AND tenant_id = $2
       LIMIT 1`,
      [jti, tenantId]
    );
    return result.rows.length > 0;
  }
}

module.exports = { InMemoryInvalidatedTokenRepository, PostgresInvalidatedTokenRepository };
