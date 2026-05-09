'use strict';

/**
 * @interface PatientRepository
 *
 * Contract for patient persistence.
 * All queries are scoped by tenantId from context.
 * Cross-tenant access MUST be rejected at the repository level.
 *
 * @typedef {object} PatientRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(string, AppContext, tx=): Promise<object|null>} findByMRN
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByBranch
 *   listByBranch(branchId, context, filters, pagination, tx?)
 */
module.exports = {};
