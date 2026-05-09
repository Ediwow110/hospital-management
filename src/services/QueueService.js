'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { assertAppointmentTransition } = require('../core/workflow');

class QueueService {
  constructor({ auditService }) {
    this._audit = auditService;
    /** @type {Map<string, object>} in-memory queue */
    this._queue = new Map();
  }

  async checkin(data, context) {
    if (!data.patientId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId required');
    }

    const entry = {
      id:         randomUUID(),
      patientId:  data.patientId,
      branchId:   context.branchId,
      status:     'Checked In',
      checkedInAt: new Date().toISOString(),
    };

    this._queue.set(entry.id, entry);
    await this._audit.record(context, 'queue.checkin', 'QueueEntry', entry.id, { patientId: data.patientId });
    return entry;
  }

  async transition(entryId, toStatus, context) {
    const entry = this._queue.get(entryId);
    if (!entry || entry.branchId !== context.branchId) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Queue entry ${entryId} not found`);
    }

    assertAppointmentTransition(entry.status, toStatus);

    const updated = { ...entry, status: toStatus, updatedAt: new Date().toISOString() };
    this._queue.set(entryId, updated);
    await this._audit.record(context, 'queue.transition', 'QueueEntry', entryId, { from: entry.status, to: toStatus });
    return updated;
  }
}

module.exports = { QueueService };
