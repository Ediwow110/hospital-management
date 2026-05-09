'use strict';

/**
 * PERMISSIONS — canonical permission constants.
 * Import from here only. Do not use raw strings in services.
 */
const PERMISSIONS = Object.freeze({
  // Patient
  PATIENT_VIEW:                 'patient.view',
  PATIENT_CREATE:               'patient.create',
  PATIENT_UPDATE:               'patient.update',

  // Orders
  ORDER_CREATE:                 'order.create',

  // Billing
  BILLING_PAYMENT_CREATE:       'billing.payment.create',
  BILLING_REFUND_REQUEST:       'billing.refund.request',
  BILLING_REFUND_APPROVE:       'billing.refund.approve',

  // Lab
  LAB_RESULT_ENCODE:            'lab.result.encode',
  LAB_RESULT_VALIDATE:          'lab.result.validate',
  LAB_RESULT_APPROVE:           'lab.result.approve',
  LAB_RESULT_RELEASE:           'lab.result.release',
  LAB_RESULT_AMEND_REQUEST:     'lab.result.amend.request',
  LAB_RESULT_AMEND_APPROVE:     'lab.result.amend.approve',

  // Inventory
  INVENTORY_ADJUST_REQUEST:     'inventory.adjust.request',
  INVENTORY_ADJUST_APPROVE:     'inventory.adjust.approve',

  // Reporting
  REPORT_EXPORT:                'report.export',

  // Audit
  AUDIT_VIEW:                   'audit.view',

  // Admin
  ADMIN_ROLE_CHANGE:            'admin.role.change',
});

/**
 * ROLE_PERMISSIONS — default permission sets per role.
 * These are defaults only. Production should load from DB.
 */
const ROLE_PERMISSIONS = Object.freeze({
  superadmin: Object.values(PERMISSIONS),

  branch_manager: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.BILLING_PAYMENT_CREATE,
    PERMISSIONS.BILLING_REFUND_REQUEST,
    PERMISSIONS.BILLING_REFUND_APPROVE,
    PERMISSIONS.LAB_RESULT_ENCODE,
    PERMISSIONS.LAB_RESULT_VALIDATE,
    PERMISSIONS.LAB_RESULT_APPROVE,
    PERMISSIONS.LAB_RESULT_RELEASE,
    PERMISSIONS.LAB_RESULT_AMEND_REQUEST,
    PERMISSIONS.LAB_RESULT_AMEND_APPROVE,
    PERMISSIONS.INVENTORY_ADJUST_REQUEST,
    PERMISSIONS.INVENTORY_ADJUST_APPROVE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_VIEW,
  ],

  receptionist: [
    PERMISSIONS.PATIENT_VIEW,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.PATIENT_UPDATE,
    PERMISSIONS.ORDER_CREATE,
  ],

  cashier: [
    PERMISSIONS.BILLING_PAYMENT_CREATE,
    PERMISSIONS.BILLING_REFUND_REQUEST,
  ],

  medtech: [
    PERMISSIONS.LAB_RESULT_ENCODE,
    PERMISSIONS.LAB_RESULT_VALIDATE,
    PERMISSIONS.LAB_RESULT_AMEND_REQUEST,
  ],

  pathologist: [
    PERMISSIONS.LAB_RESULT_APPROVE,
    PERMISSIONS.LAB_RESULT_RELEASE,
    PERMISSIONS.LAB_RESULT_AMEND_APPROVE,
  ],

  inventory_staff: [
    PERMISSIONS.INVENTORY_ADJUST_REQUEST,
  ],
});

module.exports = { PERMISSIONS, ROLE_PERMISSIONS };
