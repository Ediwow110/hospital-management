'use strict';

/**
 * PgUserRepository
 *
 * PostgreSQL implementation of the user repository contract.
 * All SQL is isolated here; services must not import pg directly.
 *
 * PR #4 — PostgreSQL Persistence Foundation.
 */

class PgUserRepository {
  /**
   * @param {{ pool: import('pg').Pool }} deps
   */
  constructor({ pool }) {
    this._pool = pool;
  }

  /**
   * @param {string} email
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object|null>}
   */
  async findByEmail(email, context) {
    const client = context._tx || this._pool;
    const { rows } = await client.query(
      `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId",
              email, password_hash AS "passwordHash", full_name AS "name",
              role AS "roles", status
       FROM users
       WHERE email = $1 AND tenant_id = $2
       LIMIT 1`,
      [email, context.tenantId]
    );
    return rows[0] || null;
  }

  /**
   * @param {string} id
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object|null>}
   */
  async findById(id, context) {
    const client = context._tx || this._pool;
    const { rows } = await client.query(
      `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId",
              email, password_hash AS "passwordHash", full_name AS "name",
              role AS "roles", status
       FROM users
       WHERE id = $1 AND tenant_id = $2
       LIMIT 1`,
      [id, context.tenantId]
    );
    return rows[0] || null;
  }

  /**
   * @param {object} user
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object>}
   */
  async save(user, context) {
    const client = context._tx || this._pool;
    const { rows } = await client.query(
      `INSERT INTO users (id, tenant_id, branch_id, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         status = EXCLUDED.status
       RETURNING id, tenant_id AS "tenantId", branch_id AS "branchId",
                 email, password_hash AS "passwordHash", full_name AS "name",
                 role AS "roles", status`,
      [
        user.id,
        user.tenantId,
        user.branchId,
        user.email,
        user.passwordHash,
        user.name,
        user.roles,
        user.status,
      ]
    );
    return rows[0];
  }
}

module.exports = { PgUserRepository };
