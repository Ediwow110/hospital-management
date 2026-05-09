'use strict';

class PgSecurityAuditEventRepository {
  constructor({ pool }) {
    this._pool = pool;
  }

  async insert(event) {
    await this._pool.query(
      `INSERT INTO security_audit_events
       (id, event_type, tenant_id, user_id, ip_address, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        event.id,
        event.eventType,
        event.tenantId,
        event.userId,
        event.ipAddress,
        JSON.stringify(event.metadata || {}),
        event.createdAt,
      ]
    );
    return { ...event };
  }
}

module.exports = { PgSecurityAuditEventRepository };
