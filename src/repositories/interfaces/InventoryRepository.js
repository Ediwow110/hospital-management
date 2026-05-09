'use strict';

/**
 * @interface InventoryRepository
 *
 * LEDGER RULE:
 *   Stock quantity changes MUST be represented as stock_movements rows.
 *   No unexplained quantity mutation.
 *
 * @typedef {object} InventoryRepository
 * @property {function(string, AppContext, tx=): Promise<object|null>} findItemById
 * @property {function(object, AppContext, tx=): Promise<object>} saveItem
 * @property {function(object, AppContext, tx=): Promise<object>} saveMovement
 * @property {function(string, AppContext, object, tx=): Promise<Array>} listMovementsByItem
 * @property {function(string, AppContext, tx=): Promise<number>} getCurrentStock
 */
module.exports = {};
