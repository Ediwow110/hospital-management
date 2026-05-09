'use strict';

/**
 * @interface NotificationRepository
 *
 * @typedef {object} NotificationRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(string, AppContext, object, tx=): Promise<Array>} listByUser
 */
module.exports = {};
