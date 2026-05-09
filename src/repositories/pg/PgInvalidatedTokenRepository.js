'use strict';

class PgInvalidatedTokenRepository {
  constructor({ pool }) {
    this._pool = pool;
  }

  async invalidate(record) {
    await this._pool.query(
      `INSERT INTO invalidated_tokens (jti, invalidated_at, tenant_id, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (jti) DO NOTHING`,
      [record.jti, record.invalidatedAt || new Date().toISOString(), record.tenantId, record.userId]
    );
    return { ...record };
  }

  async isInvalidated(jti) {
    const { rows } = await this._pool.query(
      'SELECT 1 FROM invalidated_tokens WHERE jti = $1 LIMIT 1',
      [jti]
    );
    return rows.length > 0;
  }
}

module.exports = { PgInvalidatedTokenRepository };
