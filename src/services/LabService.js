'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');
const { assertLabTransition } = require('../core/workflow');

class LabService {
  constructor({ labResultRepo, auditService, securityAuditService }) {
    this._repo = labResultRepo;
    this._audit = auditService;
    this._securityAudit = securityAuditService;
  }

  async _getResult(id, context) {
    const result = await this._repo.findById(id, context);
    if (!result) {
      const raw = typeof this._repo._get === 'function' ? this._repo._get(id) : null;
      if (raw && raw.tenantId !== context.tenantId && this._securityAudit) {
        await this._securityAudit.log('CROSS_TENANT_ACCESS_ATTEMPT', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { labResultId: id, targetTenantId: raw.tenantId },
        });
      }
      throw new AppError(ERROR_CODES.NOT_FOUND, `Lab result ${id} not found`);
    }
    return result;
  }

  async _transition(id, toStatus, permission, action, context) {
    if (!context.can(permission)) {
      await this._audit.recordSecurityEvent(context, `${action}.denied`, { id });
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: permission, id },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, `${permission} required`);
    }
    const result = await this._getResult(id, context);
    assertLabTransition(result.status, toStatus);
    const updated = { ...result, status: toStatus, updatedAt: new Date().toISOString() };
    const saved = await this._repo.save(updated, context);
    await this._audit.record(context, action, 'LabResult', id, { from: result.status, to: toStatus });
    return saved;
  }

  async createResult(data, context) {
    if (!data.orderId) throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'orderId required');
    if (!data.testName) throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'testName required');

    const result = {
      id: randomUUID(),
      orderId: data.orderId,
      patientId: data.patientId,
      branchId: context.branchId,
      testName: data.testName,
      status: 'Pending Collection',
      createdAt: new Date().toISOString(),
    };

    const saved = await this._repo.save(result, context);
    await this._audit.record(context, 'lab_result.create', 'LabResult', result.id, { testName: data.testName });
    return saved;
  }

  async collectSpecimen(id, context) {
    return this._transition(id, 'Collected', PERMISSIONS.LAB_RESULT_ENCODE, 'lab_result.collect', context);
  }

  async encodeResult(id, data, context) {
    if (!context.can(PERMISSIONS.LAB_RESULT_ENCODE)) {
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: PERMISSIONS.LAB_RESULT_ENCODE, id },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, `${PERMISSIONS.LAB_RESULT_ENCODE} required`);
    }
    const result = await this._getResult(id, context);
    assertLabTransition(result.status, 'Encoded');

    const updated = {
      ...result,
      status: 'Encoded',
      resultData: data.resultData,
      encodedBy: context.userId,
      encodedAt: new Date().toISOString(),
    };
    const saved = await this._repo.save(updated, context);
    await this._audit.record(context, 'lab_result.encode', 'LabResult', id, {});
    return saved;
  }

  async validateResult(id, context) {
    return this._transition(id, 'Validated', PERMISSIONS.LAB_RESULT_VALIDATE, 'lab_result.validate', context);
  }

  async approveResult(id, context) {
    return this._transition(id, 'Approved', PERMISSIONS.LAB_RESULT_APPROVE, 'lab_result.approve', context);
  }

  async releaseResult(id, context) {
    return this._transition(id, 'Released', PERMISSIONS.LAB_RESULT_RELEASE, 'lab_result.release', context);
  }

  async requestAmendment(id, data, context) {
    if (!context.can(PERMISSIONS.LAB_RESULT_AMEND_REQUEST)) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, `${PERMISSIONS.LAB_RESULT_AMEND_REQUEST} required`);
    }

    const result = await this._getResult(id, context);

    if (result.status !== 'Released') {
      throw new AppError(
        ERROR_CODES.INVALID_WORKFLOW_TRANSITION,
        `Amendment only allowed on Released results. Current status: ${result.status}`
      );
    }

    await this._repo.saveVersion({
      id: randomUUID(),
      labResultId: id,
      status: result.status,
      resultData: result.resultData,
      supersededAt: new Date().toISOString(),
      supersededBy: context.userId,
      reason: data.reason || 'amendment_requested',
    }, context);

    const updated = {
      ...result,
      status: 'Amended',
      amendReason: data.reason,
      amendRequestedBy: context.userId,
      updatedAt: new Date().toISOString(),
    };

    const preamble = { ...result, status: 'Amended' };
    this._repo._set(id, { ...preamble, tenantId: context.tenantId, updatedAt: new Date().toISOString() });
    const final = await this._repo.save({ ...updated }, context);

    await this._audit.record(context, 'lab_result.amendment_requested', 'LabResult', id, { reason: data.reason });

    return final;
  }
}

module.exports = { LabService };
