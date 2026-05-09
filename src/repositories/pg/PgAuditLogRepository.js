'use strict';

/**
 * PgAuditLogRepository
 *
 * PostgreSQL implementation of the audit log repository.
 * audit_logs are append-only — no UPDATE or DELETE is permitted here.
 * The database enforces this via a trigger in 007_governance.sql.
 *
 * All SQL is isolated here; services must not import pg directly.
 *
 * PR #4 — PostgreSQL Persistence Foundation.
 */

class PgAuditLogRepository {
  /**
   * @param {{ pool: import('pg').Pool }} deps
   */
  constructor({ pool }) {
    this._pool = pool;
  }

  /**
   * Append an audit event. Never updates existing rows.
   *
   * @param {object} entry
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object>}
   */
  async append(entry, context) {
    const client = context._tx || this._pool;
    const { rows } = await client.query(
      `INSERT INTO audit_logs
         (id, tenant_id, branch_id, request_id, actor_id, ip_address,
          event_type, entity_type, entity_id, changes, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id, tenant_id AS "tenantId", branch_id AS "branchId",
                 request_id AS "requestId", actor_id AS "actorId",
                 ip_address AS "ipAddress", event_type AS "eventType",
                 entity_type AS "entityType", entity_id AS "entityId",
                 changes, occurred_at AS "occurredAt"`,
      [
        entry.id,
        entry.tenantId,
        entry.branchId,
        entry.requestId,
        entry.actorId,
        entry.ipAddress,
        entry.eventType,
        entry.entityType,
        entry.entityId,
        JSON.stringify(entry.changes || {}),
      ]
    );
    return rows[0];
  }

  /**
   * List audit log entries for an entity.
   * Forward-only (ORDER BY occurred_at ASC) to support audit trail review.
   *
   * @param {string} entityType
   * @param {string} entityId
   * @param {import('../../core/AppContext').AppContext} context
   * @returns {Promise<object[]>}
   */
  async findByEntity(entityType, entityId, context) {
    const client = context._tx || this._pool;
    const { rows } = await client.query(
      `SELECT id, tenant_id AS "tenantId", branch_id AS "branchId",
              request_id AS "requestId", actor_id AS "actorId",
              ip_address AS "ipAddress", event_type AS "eventType",
              entity_type AS "entityType", entity_id AS "entityId",
              changes, occurred_at AS "occurredAt"
       FROM audit_logs
       WHERE tenant_id = $1
         AND entity_type = $2
         AND entity_id = $3
       ORDER BY occurred_at ASC`,
      [context.tenantId, entityType, entityId]
    );
    return rows;
  }
}

module.exports = { PgAuditLogRepository };
