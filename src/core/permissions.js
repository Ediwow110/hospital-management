const PERMISSIONS = Object.freeze({
  PATIENT_VIEW: 'patient.view',
  PATIENT_CREATE: 'patient.create',
  PATIENT_UPDATE: 'patient.update',
  PATIENT_ARCHIVE: 'patient.archive',
  PATIENT_MERGE_REQUEST: 'patient.merge.request',
  PATIENT_MERGE_APPROVE: 'patient.merge.approve',
  ORDER_CREATE: 'order.create',
  ORDER_CANCEL: 'order.cancel',
  ORDER_VOID_REQUEST: 'order.void.request',
  ORDER_VOID_APPROVE: 'order.void.approve',
  BILLING_PAYMENT_CREATE: 'billing.payment.create',
  BILLING_REFUND_REQUEST: 'billing.refund.request',
  BILLING_REFUND_APPROVE: 'billing.refund.approve',
  BILLING_PAYMENT_VOID_REQUEST: 'billing.payment.void.request',
  BILLING_PAYMENT_VOID_APPROVE: 'billing.payment.void.approve',
  CASHIER_SESSION_OPEN: 'cashier.session.open',
  CASHIER_SESSION_CLOSE: 'cashier.session.close',
  LAB_RESULT_ENCODE: 'lab.result.encode',
  LAB_RESULT_VALIDATE: 'lab.result.validate',
  LAB_RESULT_APPROVE: 'lab.result.approve',
  LAB_RESULT_RELEASE: 'lab.result.release',
  LAB_RESULT_AMEND_REQUEST: 'lab.result.amend.request',
  LAB_RESULT_AMEND_APPROVE: 'lab.result.amend.approve',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_RECEIVE: 'inventory.receive',
  INVENTORY_ADJUST_REQUEST: 'inventory.adjust.request',
  INVENTORY_ADJUST_APPROVE: 'inventory.adjust.approve',
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',
  AUDIT_VIEW: 'audit.view',
  ADMIN_ROLE_CHANGE: 'admin.role.change',
  SYSTEM_HEALTH_VIEW: 'system.health.view'
});

const PERMISSION_CODES = Object.freeze(Object.values(PERMISSIONS));

module.exports = {
  PERMISSIONS,
  PERMISSION_CODES
};
