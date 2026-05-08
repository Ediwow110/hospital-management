const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const schemaSql = fs.readFileSync(path.join(root, 'database/schema.sql'), 'utf8');
const openapi = JSON.parse(fs.readFileSync(path.join(root, 'api/production-openapi.json'), 'utf8'));
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'docs/permission-matrix.json'), 'utf8'));

function assertTablesExist() {
  const requiredTables = [
    'tenants',
    'subscription_plans',
    'tenant_feature_flags',
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'user_roles',
    'branches',
    'departments',
    'settings',
    'audit_logs',
    'approval_requests',
    'notifications',
    'files',
    'patients',
    'patient_identifiers',
    'patient_contacts',
    'patient_emergency_contacts',
    'patient_documents',
    'patient_consents',
    'patient_dependents',
    'patient_timeline_events',
    'patient_merge_requests',
    'appointments',
    'appointment_services',
    'queue_tickets',
    'queue_events',
    'doctor_schedules',
    'department_schedules',
    'operating_hours',
    'holidays',
    'encounters',
    'vitals',
    'clinical_notes',
    'diagnoses',
    'prescriptions',
    'prescription_items',
    'medical_certificates',
    'clinical_attachments',
    'lab_orders',
    'lab_order_items',
    'specimens',
    'specimen_events',
    'lab_results',
    'lab_result_items',
    'lab_result_versions',
    'lab_result_approvals',
    'lab_templates',
    'lab_template_items',
    'critical_result_logs',
    'qc_logs',
    'orders',
    'order_items',
    'invoices',
    'invoice_items',
    'payments',
    'payment_methods',
    'payment_allocations',
    'discounts',
    'refunds',
    'void_requests',
    'cashier_sessions',
    'cashier_closing_reports',
    'accounts_receivable',
    'inventory_items',
    'inventory_categories',
    'stock_batches',
    'stock_movements',
    'stock_adjustments',
    'suppliers',
    'purchase_requests',
    'purchase_orders',
    'purchase_order_items',
    'receiving_records',
    'physical_counts',
    'employees',
    'employee_documents',
    'attendance_logs',
    'shifts',
    'leave_requests',
    'leave_balances',
    'training_records',
    'license_records',
    'hr_incidents',
    'report_exports',
    'saved_report_filters',
    'print_templates',
    'template_versions',
    'generated_documents',
    'email_logs',
    'sms_logs',
    'webhook_logs',
    'api_tokens',
    'external_integrations',
    'failed_jobs',
    'system_health_logs',
    'backup_jobs',
    'radiology_orders',
    'radiology_reports',
    'pharmacy_medications',
    'pharmacy_dispenses',
    'referrers',
    'referral_transactions',
    'referral_payouts'
  ];
  const missing = requiredTables.filter(table => !new RegExp(`CREATE TABLE ${table} \\(`).test(schemaSql));
  assert.deepStrictEqual(missing, []);
}

function assertApiGroupsExist() {
  const requiredTags = [
    'auth',
    'users',
    'roles',
    'patients',
    'appointments',
    'queue',
    'orders',
    'billing',
    'lab',
    'inventory',
    'hr',
    'reports',
    'notifications',
    'admin',
    'audit'
  ];
  const tags = new Set();
  Object.values(openapi.paths).forEach(pathItem => {
    Object.values(pathItem).forEach(operation => {
      (operation.tags || []).forEach(tag => tags.add(tag));
    });
  });
  const missing = requiredTags.filter(tag => !tags.has(tag));
  assert.deepStrictEqual(missing, []);
}

function assertDangerousApiControls() {
  const violations = [];
  Object.entries(openapi.paths).forEach(([route, pathItem]) => {
    Object.entries(pathItem).forEach(([method, operation]) => {
      if (!operation['x-dangerous-action']) return;
      const controls = operation['x-controls'] || [];
      const parameterNames = (operation.parameters || []).map(parameter => parameter.name || parameter.$ref || '');
      if (!controls.includes('audit')) violations.push(`${method.toUpperCase()} ${route}: missing audit control`);
      if (!parameterNames.some(name => name.includes('IdempotencyKey'))) violations.push(`${method.toUpperCase()} ${route}: missing idempotency header`);
      if (!controls.includes('reason') && !['/billing/invoices/{id}/payments', '/lab/results/{id}/approve', '/lab/results/{id}/release', '/admin/backups'].includes(route)) {
        violations.push(`${method.toUpperCase()} ${route}: missing reason control`);
      }
    });
  });
  assert.deepStrictEqual(violations, []);
}

function assertComponentsExist() {
  const requiredRequestBodies = [
    'LoginRequest',
    'UserRequest',
    'PatientRequest',
    'OrderRequest',
    'PaymentRequest',
    'LabEncodeRequest',
    'ReceivingRequest',
    'ReportExportRequest',
    'NotificationRequest',
    'ReasonRequest'
  ];
  const missing = requiredRequestBodies.filter(name => !openapi.components.requestBodies[name]);
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(openapi.components.responses.Error.content['application/json'].schema.$ref, '#/components/schemas/ErrorResponse');
}

function assertPermissionMatrixCoverage() {
  assert.ok(matrix.roles.includes('receptionist'));
  assert.ok(matrix.roles.includes('cashier'));
  assert.ok(matrix.roles.includes('med_tech'));
  assert.ok(matrix.roles.includes('pathologist'));
  assert.ok(matrix.roles.includes('super_admin'));
  const actions = new Map(matrix.actions.map(action => [action.action, action]));
  [
    'Register patient',
    'Create service order',
    'Accept payment',
    'Void payment',
    'Refund payment',
    'Encode lab result',
    'Approve lab result',
    'Amend released result',
    'Adjust inventory',
    'Offboard employee',
    'Export report',
    'Change roles',
    'Restore backup'
  ].forEach(action => assert.ok(actions.has(action), `${action} missing`));
  matrix.actions.filter(action => action.requiresApproval).forEach(action => {
    assert.ok(action.requiresReason, `${action.action} approval should require reason`);
    assert.ok(action.auditRequired, `${action.action} approval should require audit`);
  });
}

function assertRunbookExists() {
  const runbook = fs.readFileSync(path.join(root, 'docs/deployment-runbook.md'), 'utf8');
  ['Pre-Deployment Gates', 'Post-Deployment Smoke Tests', 'Rollback Rules', 'Go / No-Go Criteria'].forEach(section => {
    assert.ok(runbook.includes(section), `${section} missing`);
  });
}

assertTablesExist();
assertApiGroupsExist();
assertDangerousApiControls();
assertComponentsExist();
assertPermissionMatrixCoverage();
assertRunbookExists();

console.log('All production coverage checks passed.');
