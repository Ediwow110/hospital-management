'use strict';

/**
 * @interface SettingsRepository
 *
 * @typedef {object} SettingsRepository
 * @property {function(string, string, AppContext, tx=): Promise<object|null>} get
 *   get(key, tenantId, context, tx?)
 * @property {function(string, string, any, AppContext, tx=): Promise<object>} set
 *   set(key, tenantId, value, context, tx?)
 * @property {function(string, AppContext, tx=): Promise<Array>} listByTenant
 */
module.exports = {};
