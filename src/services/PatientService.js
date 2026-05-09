'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');

class PatientService {
  constructor({ patientRepo, auditService, securityAuditService }) {
    this._repo = patientRepo;
    this._audit = auditService;
    this._securityAudit = securityAuditService;
  }

  async registerPatient(data, context) {
    if (!context.can(PERMISSIONS.PATIENT_CREATE)) {
      await this._audit.recordSecurityEvent(context, 'patient.create.denied', { data });
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: PERMISSIONS.PATIENT_CREATE },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'patient.create permission required');
    }

    if (!data.firstName || !data.lastName || !data.dateOfBirth) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'firstName, lastName, dateOfBirth required');
    }

    const id = randomUUID();
    const mrn = `P-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    const patient = {
      id,
      mrn,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      sex: data.sex || null,
      phone: data.phone || null,
      email: data.email || null,
      branchId: context.branchId,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const saved = await this._repo.save(patient, context);

    await this._audit.record(context, 'patient.create', 'Patient', id, { mrn });

    return saved;
  }

  async getPatient(id, context) {
    if (!context.can(PERMISSIONS.PATIENT_VIEW)) {
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: PERMISSIONS.PATIENT_VIEW, patientId: id },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'patient.view permission required');
    }

    const patient = await this._repo.findById(id, context);
    if (!patient) {
      const raw = typeof this._repo._get === 'function' ? this._repo._get(id) : null;
      if (raw && raw.tenantId !== context.tenantId && this._securityAudit) {
        await this._securityAudit.log('CROSS_TENANT_ACCESS_ATTEMPT', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { patientId: id, targetTenantId: raw.tenantId },
        });
      }
      throw new AppError(ERROR_CODES.NOT_FOUND, `Patient ${id} not found`);
    }

    return patient;
  }
}

module.exports = { PatientService };
