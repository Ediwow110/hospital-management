'use strict';

const { InMemoryStore } = require('./InMemoryStore');

class InMemoryInventoryRepository {
  constructor() {
    this._items = new Map();
    this._movements = [];
  }

  async findItemById(id, context, tx) {
    const item = this._items.get(id);
    if (!item || item.tenantId !== context.tenantId) return null;
    return item;
  }

  async saveItem(entity, context, tx) {
    if (!entity.id) throw new Error('InMemoryInventoryRepository.saveItem: entity.id required');
    const record = { ...entity, tenantId: context.tenantId, updatedAt: new Date().toISOString() };
    this._items.set(entity.id, record);
    return { ...record };
  }

  /**
   * saveMovement — stock ledger entry. Every quantity change goes through here.
   */
  async saveMovement(entity, context, tx) {
    if (!entity.id) throw new Error('saveMovement: entity.id required');
    if (entity.quantity === undefined) throw new Error('saveMovement: quantity required');
    if (!entity.reason) throw new Error('saveMovement: reason required');
    const movement = {
      ...entity,
      tenantId: context.tenantId,
      actorUserId: context.userId,
      createdAt: new Date().toISOString(),
    };
    this._movements.push(movement);
    return { ...movement };
  }

  async listMovementsByItem(itemId, context, filters = {}, tx) {
    return this._movements.filter(
      m => m.itemId === itemId && m.tenantId === context.tenantId
    );
  }

  /**
   * getCurrentStock — derived from ledger movements.
   */
  async getCurrentStock(itemId, context, tx) {
    const movements = await this.listMovementsByItem(itemId, context, {}, tx);
    return movements.reduce((sum, m) => sum + (m.quantity || 0), 0);
  }
}

module.exports = { InMemoryInventoryRepository };
