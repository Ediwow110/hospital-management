'use strict';

/**
 * HealthService — liveness/readiness check.
 * PR #4 will add DB connectivity check.
 */
class HealthService {
  check() {
    return {
      status: 'ok',
      version: '0.3.0',
      storageAdapter: process.env.STORAGE_ADAPTER || 'memory',
      timestamp: new Date().toISOString(),
      note: 'In-memory storage. PostgreSQL deferred to PR #4.',
    };
  }
}

module.exports = { HealthService };
