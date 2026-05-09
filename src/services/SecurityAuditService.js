'use strict';

const VALID_EVENT_TYPES = [
  'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGIN_LOCKOUT',
  'PERMISSION_DENIED', 'CROSS_TENANT_ACCESS_ATTEMPT', 'TOKEN_REVOKED',
];

class SecurityAuditService {
  constructor(db, adapter) {
    this.db = db;
    this.adapter = adapter || 'memory';
    this._memoryLog = [];
  }

  async log(eventType, context = {}) {
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      console.warn(`[SecurityAudit] Unknown event type: ${eventType}`);
      return;
    }

    const event = {
      eventType,
      tenantId: context.tenantId || null,
      branchId: context.branchId || null,
      actorUserId: context.userId || context.actorUserId || null,
      subject: context.subject || null,
      ipAddress: context.ip || context.ipAddress || null,
      deviceInfo: context.deviceInfo || null,
      payload: context.payload || {},
      createdAt: new Date(),
    };

    if (this.adapter === 'postgres' && this.db) {
      await this.db.query(
        `INSERT INTO security_audit_events
         (id, tenant_id, branch_id, actor_user_id, event_type, subject, ip_address, device_info, payload, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [
          event.tenantId,
          event.branchId,
          event.actorUserId,
          event.eventType,
          event.subject,
          event.ipAddress,
          event.deviceInfo,
          JSON.stringify(event.payload),
        ]
      );
    } else {
      this._memoryLog.push(event);
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[SecurityAudit] ${eventType}`, JSON.stringify(event));
      }
    }
  }

  getMemoryLog() {
    return this._memoryLog;
  }

  clearMemoryLog() {
    this._memoryLog = [];
  }
}

module.exports = { SecurityAuditService, VALID_EVENT_TYPES };
