'use strict';

/**
 * @interface OrderRepository
 *
 * @typedef {object} OrderRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByPatient
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByBranch
 */
module.exports = {};
