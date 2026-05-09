'use strict';

/**
 * @interface InvoiceRepository
 *
 * @typedef {object} InvoiceRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, object, object, tx=): Promise<Array>} listByPatient
 * @property {function(string, AppContext, tx=): Promise<object|null>} findByOrderId
 */
module.exports = {};
