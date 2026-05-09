'use strict';

const { randomUUID } = require('crypto');
const { AppError, ERROR_CODES } = require('../core/AppError');
const { PERMISSIONS } = require('../core/permissions');
const { assertInvoiceTransition } = require('../core/workflow');

class BillingService {
  constructor({ invoiceRepo, paymentRepo, cashierSessionRepo, auditService, securityAuditService }) {
    this._invoices = invoiceRepo;
    this._payments = paymentRepo;
    this._sessions = cashierSessionRepo;
    this._audit = auditService;
    this._securityAudit = securityAuditService;
  }

  async openSession(data, context) {
    if (!context.can(PERMISSIONS.BILLING_PAYMENT_CREATE)) {
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: PERMISSIONS.BILLING_PAYMENT_CREATE },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'billing.payment.create required to open session');
    }

    const existing = await this._sessions.findOpenByUser(context.userId, context);
    if (existing) {
      throw new AppError(ERROR_CODES.DUPLICATE_RECORD, 'Cashier already has an open session', { sessionId: existing.id });
    }

    const session = {
      id: randomUUID(),
      userId: context.userId,
      branchId: context.branchId,
      startingCash: data.startingCash ?? 0,
      status: 'Open',
      openedAt: new Date().toISOString(),
    };

    const saved = await this._sessions.save(session, context);
    await this._audit.record(context, 'cashier_session.open', 'CashierSession', session.id, {});
    return saved;
  }

  async closeSession(sessionId, data, context) {
    const session = await this._sessions.findById(sessionId, context);
    if (!session) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Session ${sessionId} not found`);
    }

    const isOwner = session.userId === context.userId;
    const isManager = context.hasRole('branch_manager', 'superadmin');
    if (!isOwner && !isManager) {
      await this._audit.recordSecurityEvent(context, 'cashier_session.close.denied', { sessionId });
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: 'cashier_session.close', sessionId },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'Only the session owner can close this session');
    }

    if (session.status !== 'Open') {
      throw new AppError(
        ERROR_CODES.INVALID_WORKFLOW_TRANSITION,
        `Session is already ${session.status}`,
        { sessionId, currentStatus: session.status }
      );
    }

    const payments = await this._payments.listBySession(sessionId, context);
    const expectedCash = session.startingCash + payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const updated = {
      ...session,
      status: 'Closed',
      closedAt: new Date().toISOString(),
      expectedCash,
      actualCash: data.actualCash ?? null,
      variance: data.actualCash != null ? data.actualCash - expectedCash : null,
    };

    const saved = await this._sessions.save(updated, context);
    await this._audit.record(context, 'cashier_session.close', 'CashierSession', sessionId, { expectedCash });
    return saved;
  }

  async postPayment(invoiceId, data, context) {
    if (!context.can(PERMISSIONS.BILLING_PAYMENT_CREATE)) {
      await this._audit.recordSecurityEvent(context, 'billing.payment.create.denied', { invoiceId });
      if (this._securityAudit) {
        await this._securityAudit.log('PERMISSION_DENIED', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { action: PERMISSIONS.BILLING_PAYMENT_CREATE, invoiceId },
        });
      }
      throw new AppError(ERROR_CODES.PERMISSION_DENIED, 'billing.payment.create permission required');
    }

    const invoice = await this._invoices.findById(invoiceId, context);
    if (!invoice) {
      const raw = typeof this._invoices._get === 'function' ? this._invoices._get(invoiceId) : null;
      if (raw && raw.tenantId !== context.tenantId && this._securityAudit) {
        await this._securityAudit.log('CROSS_TENANT_ACCESS_ATTEMPT', {
          tenantId: context.tenantId,
          userId: context.userId,
          payload: { invoiceId, targetTenantId: raw.tenantId },
        });
      }
      throw new AppError(ERROR_CODES.NOT_FOUND, `Invoice ${invoiceId} not found`);
    }

    if (invoice.isLocked) {
      throw new AppError(ERROR_CODES.RECORD_LOCKED, 'Invoice is locked');
    }

    if (['Paid', 'Voided', 'Refunded'].includes(invoice.status)) {
      throw new AppError(
        ERROR_CODES.INVALID_WORKFLOW_TRANSITION,
        `Cannot post payment on invoice with status '${invoice.status}'`
      );
    }

    if (!data.amount || data.amount <= 0) {
      throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'amount must be positive');
    }

    const overpaymentEnabled = false;
    if (!overpaymentEnabled && data.amount > invoice.balance) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `Payment amount ${data.amount} exceeds balance ${invoice.balance}`,
        { balance: invoice.balance }
      );
    }

    const newBalance = invoice.balance - data.amount;
    const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

    assertInvoiceTransition(invoice.status, newStatus);

    const payment = {
      id: randomUUID(),
      invoiceId,
      cashierSessionId: data.cashierSessionId || null,
      amount: data.amount,
      method: data.method || 'cash',
      postedBy: context.userId,
      createdAt: new Date().toISOString(),
    };

    const updatedInvoice = {
      ...invoice,
      balance: newBalance,
      status: newStatus,
      isLocked: newStatus === 'Paid',
    };

    await this._payments.save(payment, context);
    await this._invoices.save(updatedInvoice, context);

    await this._audit.record(context, 'billing.payment.post', 'Payment', payment.id, {
      invoiceId, amount: data.amount, newBalance, newStatus,
    });

    return { payment, invoice: updatedInvoice };
  }
}

module.exports = { BillingService };
