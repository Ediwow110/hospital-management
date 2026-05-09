'use strict';

/**
 * @interface CashierSessionRepository
 *
 * @typedef {object} CashierSessionRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, tx=): Promise<object|null>} findOpenByUser
 *   findOpenByUser(userId, context, tx?): finds the active session for a cashier
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByBranch
 */
module.exports = {};
