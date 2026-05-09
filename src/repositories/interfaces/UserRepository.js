'use strict';

/**
 * @interface UserRepository
 *
 * Contract for user persistence.
 * All methods are scoped to tenantId in context.
 * tx is an optional transaction handle; in-memory adapter may ignore it.
 */

/**
 * @typedef {object} UserRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findById
 * @property {function(string, AppContext, tx=): Promise<object|null>} findByEmail
 * @property {function(object, AppContext, tx=): Promise<object>} save
 * @property {function(object, AppContext, object, tx=): Promise<Array>} list
 */

// This file is a contract definition only.
// See src/repositories/memory/InMemoryUserRepository.js for implementation.
module.exports = {};
