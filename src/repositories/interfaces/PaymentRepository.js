'use strict';

/**
 * @interface PaymentRepository
 *
 * @typedef {object} PaymentRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, tx=): Promise<Array>} listByInvoice
 * @property {function(string, AppContext, tx=): Promise<Array>} listBySession
 */
module.exports = {};
