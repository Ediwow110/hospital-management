'use strict';

const { randomUUID } = require('crypto');

const SECURITY_EVENT_TYPES = Object.freeze({
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGIN_LOCKOUT: 'LOGIN_LOCKOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CROSS_TENANT_ACCESS_ATTEMPT: 'CROSS_TENANT_ACCESS_ATTEMPT',
  TOKEN_REVOKED: 'TOKEN_REVOKED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
});

class SecurityAuditService {
  constructor({ adapter = 'memory', repo = null }) {
    this._adapter = adapter;
    this._repo = repo;
  }

  async log(eventType, context = {}) {
    if (!Object.prototype.hasOwnProperty.call(SECURITY_EVENT_TYPES, eventType)) {
      throw new Error(`Unsupported security event type: ${eventType}`);
    }

    const event = {
      id: randomUUID(),
      eventType,
      tenantId: context.tenantId || 'unknown',
      userId: context.userId || null,
      ipAddress: context.ipAddress || '',
      metadata: context.metadata || {},
      createdAt: new Date().toISOString(),
    };

    if (this._adapter === 'postgres' && this._repo) {
      await this._repo.insert(event);
      return event;
    }

    console.warn('[SECURITY_AUDIT_EVENT]', JSON.stringify(event));
    if (this._repo) {
      await this._repo.insert(event);
    }
    return event;
  }
}

module.exports = { SecurityAuditService, SECURITY_EVENT_TYPES };
