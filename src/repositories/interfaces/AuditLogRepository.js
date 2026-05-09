'use strict';

/**
 * @interface AuditLogRepository
 *
 * IMMUTABILITY RULE:
 *   audit_logs are INSERT-ONLY.
 *   No update or delete methods are exposed.
 *   In PR #4, a DB trigger will enforce this at the database level.
 *
 * @typedef {object} AuditLogRepository
 * @property {function(object, AppContext, tx=): Promise<object>} insert
 *   insert(entry, context, tx?): creates a new immutable audit log entry.
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByTenant
 *   listByTenant(tenantId, context, filters, pagination, tx?)
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByEntity
 *   listByEntity(entityId, context, filters, pagination, tx?)
 */
module.exports = {};
