'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');

class OrderService {
  constructor({ orderRepo, invoiceRepo, auditService, securityAuditService }) {
    this._orders = orderRepo;
    this._invoices = invoiceRepo;
    this._audit = auditService;
    this._securityAudit = securityAuditService;
  }

  async createOrder(data, context) {
    if (!context.can(PERMISSIONS.ORDER_CREATE)) {
      await this._audit.recordSecurityEvent(context, 'order.create.denied', {});
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: PERMISSIONS.ORDER_CREATE },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'order.create permission required');
    }

    if (!data.patientId) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'patientId required');
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'items array required');
    }

    const orderId = randomUUID();
    const invoiceId = randomUUID();

    const total = data.items.reduce((sum, i) => sum + (i.qty * i.unitPrice), 0);

    const order = {
      id: orderId,
      patientId: data.patientId,
      branchId: context.branchId,
      items: data.items,
      total,
      status: 'Pending',
      createdBy: context.userId,
      createdAt: new Date().toISOString(),
    };

    const invoice = {
      id: invoiceId,
      orderId,
      patientId: data.patientId,
      branchId: context.branchId,
      total,
      balance: total,
      status: 'Unpaid',
      isLocked: false,
      createdAt: new Date().toISOString(),
    };

    const savedOrder = await this._orders.save(order, context);
    const savedInvoice = await this._invoices.save(invoice, context);

    await this._audit.record(context, 'order.create', 'Order', orderId, { total });
    await this._audit.record(context, 'invoice.create', 'Invoice', invoiceId, { orderId, total });

    return { order: savedOrder, invoice: savedInvoice };
  }
}

module.exports = { OrderService };
