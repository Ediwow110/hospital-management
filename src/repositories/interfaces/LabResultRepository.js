'use strict';

/**
 * @interface LabResultRepository
 *
 * IMMUTABILITY RULE:
 *   Released lab results MUST NOT be directly updated.
 *   Corrections MUST create a lab_result_versions row.
 *   This rule is enforced at service AND repository level.
 *
 * @typedef {object} LabResultRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 *   save() MUST reject if status === 'Released' and entity already exists in store.
 * @property {function(object, AppContext, tx=): Promise<object>} saveVersion
 *   saveVersion() creates a version snapshot (lab_result_versions).
 * @property {function(string, AppContext, object, tx=): Promise<Array>} listByOrder
 */
module.exports = {};
