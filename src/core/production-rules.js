const ROLE_PERMISSIONS = Object.freeze({
  super_admin: ['*'],
  client_admin: ['tenant.manage', 'report.export', 'audit.view'],
  branch_admin: ['branch.manage', 'report.export', 'audit.view', 'approval.review'],
  manager: ['report.view', 'report.export', 'approval.review', 'billing.refund.approve', 'order.void.approve', 'system.health.view', 'notification.send'],
  department_manager: ['report.view', 'approval.review'],
  receptionist: ['patient.view', 'patient.create', 'patient.update', 'patient.merge.request', 'appointment.create', 'order.create', 'queue.manage'],
  cashier: ['billing.payment.create', 'billing.refund.request', 'billing.payment.void.request', 'order.void.request', 'cashier.close', 'report.view'],
  nurse: ['patient.view', 'clinical.vitals.create'],
  doctor: ['patient.view', 'clinical.encounter.create', 'clinical.note.create', 'order.create'],
  med_tech: ['patient.view', 'lab.result.encode', 'lab.result.amend.request'],
  pathologist: ['patient.view', 'lab.result.validate', 'lab.result.approve', 'lab.result.release', 'lab.result.amend.approve'],
  radiology_staff: ['patient.view', 'radiology.report.create'],
  pharmacist: ['patient.view', 'pharmacy.dispense', 'inventory.view'],
  inventory_staff: ['inventory.view', 'inventory.receive', 'inventory.transfer', 'inventory.adjust.request'],
  procurement_staff: ['inventory.view', 'procurement.request', 'procurement.po.create'],
  hr_staff: ['hr.employee.view', 'hr.employee.update', 'hr.leave.review'],
  hr_manager: ['hr.employee.view', 'hr.employee.update', 'hr.offboard.request', 'hr.leave.approve', 'report.view'],
  patient: ['portal.own_records.view'],
  auditor: ['audit.view', 'report.view']
});

const WORKFLOWS = Object.freeze({
  labResult: {
    'Pending Collection': ['Collected', 'Cancelled', 'Rejected'],
    Collected: ['Received', 'Rejected'],
    Received: ['Processing', 'Rejected'],
    Processing: ['Encoded', 'Rejected'],
    Encoded: ['Validated', 'Rejected'],
    Validated: ['Approved', 'Rejected'],
    Approved: ['Released', 'Rejected'],
    Released: ['Amended', 'Superseded'],
    Amended: ['Superseded'],
    Superseded: []
  },
  invoice: {
    Draft: ['Unpaid', 'Cancelled'],
    Unpaid: ['Partially Paid', 'Paid', 'Voided', 'Cancelled'],
    'Partially Paid': ['Paid', 'Refunded', 'Voided'],
    Paid: ['Closed', 'Refunded', 'Voided'],
    Closed: ['Refunded'],
    Refunded: [],
    Voided: [],
    Cancelled: []
  },
  order: {
    Draft: ['Pending Payment', 'Cancelled'],
    'Pending Payment': ['Paid', 'Partially Paid', 'Cancelled', 'Voided'],
    'Partially Paid': ['Paid', 'Cancelled', 'Voided'],
    Paid: ['In Progress', 'Voided'],
    'In Progress': ['Completed', 'Cancelled'],
    Completed: [],
    Cancelled: [],
    Voided: []
  },
  inventory: {
    Requested: ['Approved', 'Rejected'],
    Approved: ['Ordered', 'Cancelled'],
    Ordered: ['Received', 'Cancelled'],
    Received: ['Stocked'],
    Stocked: ['Issued', 'Adjusted', 'Disposed'],
    Issued: [],
    Adjusted: ['Stocked'],
    Disposed: [],
    Rejected: [],
    Cancelled: []
  },
  leaveRequest: {
    Submitted: ['Reviewed', 'Rejected'],
    Reviewed: ['Approved', 'Rejected'],
    Approved: ['Posted to attendance'],
    Rejected: [],
    'Posted to attendance': []
  }
});

const DANGEROUS_ACTIONS = new Set([
  'payment.void',
  'payment.refund',
  'order.void',
  'result.amend',
  'patient.archive',
  'patient.merge',
  'user.role.change',
  'user.deactivate',
  'inventory.adjust',
  'backup.restore',
  'patient.export'
]);

function rolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(user, permission) {
  const permissions = rolePermissions(user.role);
  return permissions.includes('*') || permissions.includes(permission);
}

function assertTenantScope(user, record) {
  if (!record || record.tenantId == null) return true;
  if (user.tenantId == null) return false;
  return String(user.tenantId) === String(record.tenantId);
}

function assertBranchScope(user, record) {
  if (!record || record.branchId == null || user.branchScope === 'all') return true;
  if (!user.branchIds || !user.branchIds.length) return false;
  return user.branchIds.map(String).includes(String(record.branchId));
}

function canAccessRecord(user, record, permission) {
  return hasPermission(user, permission) && assertTenantScope(user, record) && assertBranchScope(user, record);
}

function canTransition(workflowName, fromStatus, toStatus) {
  const workflow = WORKFLOWS[workflowName];
  return Boolean(workflow && workflow[fromStatus] && workflow[fromStatus].includes(toStatus));
}

function assertTransition(workflowName, fromStatus, toStatus) {
  if (!canTransition(workflowName, fromStatus, toStatus)) {
    throw new Error(`${workflowName} cannot move from ${fromStatus} to ${toStatus}`);
  }
  return true;
}

function isDangerousAction(action) {
  return DANGEROUS_ACTIONS.has(action);
}

function requireReason(action, reason) {
  if (isDangerousAction(action) && !String(reason || '').trim()) {
    throw new Error(`${action} requires a reason`);
  }
  return true;
}

function canReviewApproval(user, approval, requiredPermission) {
  if (!hasPermission(user, requiredPermission)) return false;
  if (!approval || !approval.requestedByUserId) return false;
  return String(user.id) !== String(approval.requestedByUserId);
}

function buildApprovalRequest({ id, type, module, recordType, recordId, reason, requestedByUserId, tenantId, branchId }) {
  requireReason(typeToDangerousAction(type), reason);
  return {
    id,
    type,
    module,
    recordType,
    recordId,
    status: 'Submitted',
    reason,
    requestedByUserId,
    tenantId,
    branchId,
    reviewedByUserId: null,
    reviewedAt: null,
    decisionReason: null
  };
}

function typeToDangerousAction(type) {
  return {
    refund: 'payment.refund',
    payment_void: 'payment.void',
    order_void: 'order.void',
    result_amendment: 'result.amend',
    patient_archive: 'patient.archive',
    patient_merge: 'patient.merge',
    role_change: 'user.role.change',
    user_deactivate: 'user.deactivate',
    inventory_adjustment: 'inventory.adjust',
    backup_restore: 'backup.restore',
    patient_export: 'patient.export'
  }[type] || type;
}

function applyApprovalDecision({ approval, reviewer, approved, reason, requiredPermission, now = new Date().toISOString() }) {
  if (!canReviewApproval(reviewer, approval, requiredPermission)) {
    throw new Error('Approval reviewer is not allowed');
  }
  return {
    ...approval,
    status: approved ? 'Approved' : 'Rejected',
    reviewedByUserId: reviewer.id,
    reviewedAt: now,
    decisionReason: reason || null
  };
}

function createAuditEvent({ id, user, module, action, recordType, recordId, oldValues = null, newValues = null, reason, ipAddress, deviceInfo, now = new Date().toISOString() }) {
  requireReason(action, reason);
  if (!user || !user.id) throw new Error('Audit user is required');
  if (!module || !action || !recordType || !recordId) throw new Error('Audit target is incomplete');
  return Object.freeze({
    id,
    userId: user.id,
    userRole: user.role,
    tenantId: user.tenantId || null,
    branchId: user.branchIds?.[0] || null,
    module,
    action,
    recordType,
    recordId,
    oldValues,
    newValues,
    reason: reason || null,
    ipAddress: ipAddress || null,
    deviceInfo: deviceInfo || null,
    createdAt: now
  });
}

function validatePayment({ invoice, amount, overpaymentEnabled = false, idempotencyKey, priorIdempotencyKeys = new Set() }) {
  if (!idempotencyKey) return { ok: false, reason: 'Idempotency key is required for payment writes' };
  if (priorIdempotencyKeys.has(idempotencyKey)) return { ok: false, reason: 'Duplicate payment submission blocked' };
  if (!invoice) return { ok: false, reason: 'Invoice is required' };
  if (['Voided', 'Cancelled', 'Refunded'].includes(invoice.status)) return { ok: false, reason: `Invoice is ${invoice.status}` };
  if (invoice.isLocked && invoice.balance <= 0) return { ok: false, reason: 'Invoice is locked' };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'Payment amount must be greater than zero' };
  if (amount > invoice.balance && !overpaymentEnabled) return { ok: false, reason: 'Payment exceeds invoice balance' };
  return { ok: true, reason: 'Payment accepted' };
}

function redactMedicalContent(message) {
  const unsafePattern = /\b(hiv|diagnosis|pneumonia|hemoglobin|cbc result|positive|negative|mg\/dl|g\/dl)\b/i;
  return unsafePattern.test(String(message || ''))
    ? 'A new secure document is available in your patient portal.'
    : message;
}

function isNotificationPrivacySafe(message) {
  return redactMedicalContent(message) === message;
}

function buildNumber({ prefix, year, nextValue }) {
  if (!prefix || !year || !Number.isInteger(nextValue) || nextValue < 1) {
    throw new Error('Invalid numbering sequence input');
  }
  return `${prefix}-${year}-${String(nextValue).padStart(6, '0')}`;
}

function featureEnabled(tenant, featureFlag) {
  if (!tenant || !tenant.featureFlags) return false;
  return tenant.featureFlags.includes(featureFlag);
}

function requireFeature(tenant, featureFlag) {
  if (!featureEnabled(tenant, featureFlag)) {
    throw new Error(`Feature ${featureFlag} is not enabled for tenant`);
  }
  return true;
}

module.exports = {
  ROLE_PERMISSIONS,
  WORKFLOWS,
  DANGEROUS_ACTIONS,
  rolePermissions,
  hasPermission,
  assertTenantScope,
  assertBranchScope,
  canAccessRecord,
  canTransition,
  assertTransition,
  isDangerousAction,
  requireReason,
  canReviewApproval,
  buildApprovalRequest,
  applyApprovalDecision,
  createAuditEvent,
  validatePayment,
  redactMedicalContent,
  isNotificationPrivacySafe,
  buildNumber,
  featureEnabled,
  requireFeature
};
