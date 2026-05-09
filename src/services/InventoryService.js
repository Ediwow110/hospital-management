'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');

/**
 * InventoryService
 *
 * LEDGER RULE:
 *   All stock quantity changes MUST go through saveMovement().
 *   No direct quantity mutation without a movement record.
 *   Adjustments require reason and actor.
 */
class InventoryService {
  constructor({ inventoryRepo, auditService }) {
    this._repo = inventoryRepo;
    this._audit = auditService;
  }

  async getItem(id, context) {
    const item = await this._repo.findItemById(id, context);
    if (!item) throw new AppError(ERROR_CODES.NOT_FOUND, `Inventory item ${id} not found`);
    const currentStock = await this._repo.getCurrentStock(id, context);
    return { ...item, currentStock };
  }

  /**
   * Record a stock movement (the ONLY way to change stock).
   * @param {object} data - { itemId, quantity (signed), reason, source }
   * @param {AppContext} context
   */
  async recordMovement(data, context) {
    if (!context.can(PERMISSIONS.INVENTORY_ADJUST_REQUEST)) {
      await this._audit.recordSecurityEvent(context, 'inventory.adjust.denied', {});
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'inventory.adjust.request required');
    }

    if (!data.itemId) throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'itemId required');
    if (data.quantity === undefined) throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'quantity required');
    if (!data.reason) throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'reason required');

    const item = await this._repo.findItemById(data.itemId, context);
    if (!item) throw new AppError(ERROR_CODES.NOT_FOUND, `Item ${data.itemId} not found`);

    const movement = {
      id:       randomUUID(),
      itemId:   data.itemId,
      quantity: data.quantity,
      reason:   data.reason,
      source:   data.source || 'manual',
    };

    const saved = await this._repo.saveMovement(movement, context);
    await this._audit.record(context, 'inventory.movement', 'StockMovement', movement.id, {
      itemId: data.itemId, quantity: data.quantity, reason: data.reason,
    });

    return saved;
  }
}

module.exports = { InventoryService };
