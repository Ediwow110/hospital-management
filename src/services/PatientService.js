'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');

class PatientService {
  constructor({ patientRepo, auditService }) {
    this._repo = patientRepo;
    this._audit = auditService;
  }

  /**
   * Register a new patient.
   * @param {object} data
   * @param {AppContext} context
   * @returns {Promise<object>}
   */
  async registerPatient(data, context) {
    if (!context.can(PERMISSIONS.PATIENT_CREATE)) {
      await this._audit.recordSecurityEvent(context, 'patient.create.denied', { data });
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
      firstName:    data.firstName,
      lastName:     data.lastName,
      dateOfBirth:  data.dateOfBirth,
      sex:          data.sex || null,
      phone:        data.phone || null,
      email:        data.email || null,
      branchId:     context.branchId,
      status:       'active',
      createdAt:    new Date().toISOString(),
    };

    const saved = await this._repo.save(patient, context);

    await this._audit.record(context, 'patient.create', 'Patient', id, { mrn });

    return saved;
  }

  /**
   * Get patient by ID. Enforces tenant scope.
   * @param {string} id
   * @param {AppContext} context
   * @returns {Promise<object>}
   */
  async getPatient(id, context) {
    if (!context.can(PERMISSIONS.PATIENT_VIEW)) {
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'patient.view permission required');
    }
    const patient = await this._repo.findById(id, context);
    if (!patient) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Patient ${id} not found`);
    }
    return patient;
  }
}

module.exports = { PatientService };
