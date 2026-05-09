'use strict';

/**
 * AppContext — carried through every service call.
 * Represents the authenticated request scope.
 *
 * Fields:
 *   requestId      - unique per HTTP request (uuid)
 *   tenantId       - tenant owning this request
 *   branchId       - branch within tenant
 *   userId         - authenticated actor
 *   roles          - string[]
 *   permissions    - Set<string>
 *   ipAddress      - originating IP
 *   deviceInfo     - user-agent or device descriptor
 *   idempotencyKey - optional caller-provided idempotency key
 */
class AppContext {
  /**
   * @param {object} params
   * @param {string} params.requestId
   * @param {string} params.tenantId
   * @param {string} params.branchId
   * @param {string} params.userId
   * @param {string[]} params.roles
   * @param {string[]} params.permissions
   * @param {string} [params.ipAddress]
   * @param {string} [params.deviceInfo]
   * @param {string} [params.idempotencyKey]
   */
  constructor({
    requestId,
    tenantId,
    branchId,
    userId,
    roles = [],
    permissions = [],
    ipAddress = '',
    deviceInfo = '',
    idempotencyKey = null,
  }) {
    if (!requestId) throw new Error('AppContext: requestId required');
    if (!tenantId) throw new Error('AppContext: tenantId required');
    if (!branchId) throw new Error('AppContext: branchId required');
    if (!userId) throw new Error('AppContext: userId required');

    this.requestId = requestId;
    this.tenantId = tenantId;
    this.branchId = branchId;
    this.userId = userId;
    this.roles = Array.isArray(roles) ? roles : [roles];
    this.permissions = new Set(Array.isArray(permissions) ? permissions : [permissions]);
    this.ipAddress = ipAddress;
    this.deviceInfo = deviceInfo;
    this.idempotencyKey = idempotencyKey;
  }

  /**
   * Returns true if context has the given permission string.
   * @param {string} permission
   * @returns {boolean}
   */
  can(permission) {
    return this.permissions.has(permission);
  }

  /**
   * Returns true if context has any of the given roles.
   * @param {string[]} roleList
   * @returns {boolean}
   */
  hasRole(...roleList) {
    return roleList.some(r => this.roles.includes(r));
  }
}

module.exports = { AppContext };
