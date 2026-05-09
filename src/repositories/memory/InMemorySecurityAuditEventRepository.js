'use strict';

class InMemorySecurityAuditEventRepository {
  constructor() {
    this._events = [];
  }

  async insert(event) {
    this._events.push({ ...event });
    return { ...event };
  }

  all() {
    return [...this._events];
  }
}

module.exports = { InMemorySecurityAuditEventRepository };
