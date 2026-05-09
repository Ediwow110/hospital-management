'use strict';

/**
 * @interface ApprovalRepository
 *
 * @typedef {object} ApprovalRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listPending
 */
module.exports = {};
