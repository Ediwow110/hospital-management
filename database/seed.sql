-- Baseline seed data for the HMS MVP

INSERT INTO branches (code, name) VALUES
('MAIN', 'Main Branch')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (code, name, description, is_system) VALUES
('patient', 'Client / Patient', 'Own portal access only.', true),
('receptionist', 'Receptionist', 'Patient registration, appointments, queue, and basic order creation.', true),
('cashier', 'Cashier', 'Invoices, payments, receipts, and cashier sessions.', true),
('nurse', 'Nurse / Clinical Staff', 'Vitals, nursing notes, and assigned patient data.', true),
('doctor', 'Doctor', 'Encounters, notes, diagnoses, prescriptions, and order requests.', true),
('med_tech', 'Med-Tech', 'Sample collection, receiving, result encoding, and laboratory workflow.', true),
('lab_approver', 'Pathologist / Lab Approver', 'Validate, approve, release, and amend laboratory results.', true),
('radiology_staff', 'Radiology Staff', 'Imaging workflow, technician notes, and reports.', true),
('pharmacist', 'Pharmacist', 'Dispensing, medication stock, returns, and pharmacy reports.', true),
('inventory_staff', 'Inventory Staff', 'Stock movement, receiving, physical count, and purchase requests.', true),
('hr_manager', 'HR Staff / HR Manager', 'Employees, attendance, leave, licenses, training, and offboarding.', true),
('branch_manager', 'Manager / Branch Manager', 'Reports, approvals, dashboards, and exception reviews.', true),
('super_admin', 'Admin / Super Admin', 'Configuration, roles, branches, settings, and system controls.', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, module, description) VALUES
('patient.view', 'patients', 'View patient records.'),
('patient.create', 'patients', 'Create patient records.'),
('patient.update', 'patients', 'Update patient records.'),
('patient.archive', 'patients', 'Archive patient records.'),
('patient.merge.request', 'patients', 'Request patient record merge.'),
('patient.merge.approve', 'patients', 'Approve patient record merge.'),
('order.create', 'orders', 'Create orders.'),
('order.void.request', 'orders', 'Request order void.'),
('order.void.approve', 'orders', 'Approve order void.'),
('order.discount.apply', 'orders', 'Apply order discount.'),
('order.discount.approve', 'orders', 'Approve order discount.'),
('lab.result.encode', 'laboratory', 'Encode laboratory results.'),
('lab.result.validate', 'laboratory', 'Validate laboratory results.'),
('lab.result.approve', 'laboratory', 'Approve laboratory results.'),
('lab.result.release', 'laboratory', 'Release laboratory results.'),
('lab.result.amend.request', 'laboratory', 'Request released result amendment.'),
('lab.result.amend.approve', 'laboratory', 'Approve released result amendment.'),
('billing.payment.create', 'billing', 'Create invoice payments.'),
('billing.payment.void.request', 'billing', 'Request payment void.'),
('billing.payment.void.approve', 'billing', 'Approve payment void.'),
('billing.refund.request', 'billing', 'Request refund.'),
('billing.refund.approve', 'billing', 'Approve refund.'),
('cashier.close', 'billing', 'Close cashier session.'),
('inventory.receive', 'inventory', 'Receive inventory.'),
('inventory.transfer', 'inventory', 'Transfer inventory.'),
('inventory.adjust.request', 'inventory', 'Request inventory adjustment.'),
('inventory.adjust.approve', 'inventory', 'Approve inventory adjustment.'),
('report.view', 'reports', 'View reports.'),
('report.export', 'reports', 'Export reports.'),
('audit.view', 'audit', 'View audit logs.'),
('user.role.change.request', 'users', 'Request user role change.'),
('user.role.change.approve', 'users', 'Approve user role change.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO services (branch_id, code, name, department, price, result_template_code)
SELECT b.id, service_code, service_name, department, price, template_code
FROM branches b
CROSS JOIN (VALUES
    ('CBC', 'Complete Blood Count', 'Laboratory', 450.00, 'cbc'),
    ('FBS', 'Fasting Blood Sugar', 'Laboratory', 180.00, 'chemistry_basic'),
    ('URINALYSIS', 'Urinalysis', 'Laboratory', 150.00, 'urinalysis'),
    ('XRAY-CHEST', 'Chest X-Ray', 'Radiology', 650.00, 'radiology_report')
) AS s(service_code, service_name, department, price, template_code)
WHERE b.code = 'MAIN'
ON CONFLICT (code) DO NOTHING;

INSERT INTO settings (branch_id, key, value)
SELECT id, 'numbering.prefixes', '{"patient":"P","order":"ORD","invoice":"INV","receipt":"OR","lab":"LAB","employee":"EMP","purchase_order":"PO"}'::jsonb
FROM branches
WHERE code = 'MAIN'
ON CONFLICT (branch_id, key) DO NOTHING;

-- Baseline role-permission assignments. Super admin receives every permission.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('patient.view', 'patient.create', 'patient.update', 'order.create')
WHERE r.code = 'receptionist'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('billing.payment.create', 'billing.payment.void.request', 'billing.refund.request', 'cashier.close', 'report.view')
WHERE r.code = 'cashier'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('lab.result.encode', 'lab.result.amend.request')
WHERE r.code = 'med_tech'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('lab.result.validate', 'lab.result.approve', 'lab.result.release', 'lab.result.amend.approve')
WHERE r.code = 'lab_approver'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('inventory.receive', 'inventory.transfer', 'inventory.adjust.request')
WHERE r.code = 'inventory_staff'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('report.view', 'report.export', 'audit.view', 'order.void.approve', 'billing.refund.approve', 'inventory.adjust.approve')
WHERE r.code = 'branch_manager'
ON CONFLICT DO NOTHING;

-- Additional permissions and baseline data for the expanded blueprint prototype.

INSERT INTO permissions (code, module, description) VALUES
('hr.employee.update', 'hr', 'Update employee lifecycle and offboarding state.'),
('notification.send', 'notifications', 'Send privacy-safe in-app, email, or SMS notifications.'),
('backup.run', 'backup', 'Run encrypted backup jobs.'),
('backup.restore.request', 'backup', 'Request restore workflow with reason and audit log.'),
('clinical.encounter.create', 'clinical', 'Create clinical encounters.'),
('clinical.note.create', 'clinical', 'Create locked clinical notes.'),
('file.download', 'files', 'Download private files with audit logging.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('hr.employee.update', 'user.role.change.request', 'report.view')
WHERE r.code = 'hr_manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('notification.send', 'backup.run', 'backup.restore.request', 'file.download')
WHERE r.code = 'branch_manager'
ON CONFLICT DO NOTHING;

INSERT INTO users (branch_id, email, password_hash, full_name, status, mfa_required)
SELECT b.id, user_email, '$2b$12$replace-with-real-hash-before-production', full_name, 'active', mfa_required
FROM branches b
CROSS JOIN (VALUES
    ('admin@hospital.local', 'A. Reyes', true),
    ('reception@hospital.local', 'R. Cruz', false),
    ('cashier@hospital.local', 'C. Gomez', true),
    ('medtech@hospital.local', 'M. Santos', false),
    ('approver@hospital.local', 'D. Lim', true),
    ('inventory@hospital.local', 'I. Navarro', false),
    ('hr@hospital.local', 'H. Ramos', true),
    ('manager@hospital.local', 'B. Mercado', true)
) AS seed_users(user_email, full_name, mfa_required)
WHERE b.code = 'MAIN'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role_id, branch_id)
SELECT u.id, r.id, b.id
FROM branches b
JOIN users u ON u.branch_id = b.id
JOIN (VALUES
    ('admin@hospital.local', 'super_admin'),
    ('reception@hospital.local', 'receptionist'),
    ('cashier@hospital.local', 'cashier'),
    ('medtech@hospital.local', 'med_tech'),
    ('approver@hospital.local', 'lab_approver'),
    ('inventory@hospital.local', 'inventory_staff'),
    ('hr@hospital.local', 'hr_manager'),
    ('manager@hospital.local', 'branch_manager')
) AS assignments(user_email, role_code) ON assignments.user_email = u.email
JOIN roles r ON r.code = assignments.role_code
WHERE b.code = 'MAIN'
ON CONFLICT DO NOTHING;

INSERT INTO departments (branch_id, code, name)
SELECT b.id, department_code, department_name
FROM branches b
CROSS JOIN (VALUES
    ('FRONTDESK', 'Front Desk'),
    ('LAB', 'Laboratory'),
    ('RAD', 'Radiology'),
    ('PHARM', 'Pharmacy'),
    ('FIN', 'Finance'),
    ('HR', 'Human Resources')
) AS departments_seed(department_code, department_name)
WHERE b.code = 'MAIN'
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO rooms (branch_id, department_id, code, name)
SELECT b.id, d.id, room_code, room_name
FROM branches b
JOIN departments d ON d.branch_id = b.id
JOIN (VALUES
    ('LAB', 'LAB-01', 'Specimen Collection'),
    ('LAB', 'LAB-02', 'Result Encoding'),
    ('FIN', 'CASH-01', 'Cashier 1'),
    ('FRONTDESK', 'REC-01', 'Reception 1')
) AS room_seed(department_code, room_code, room_name) ON room_seed.department_code = d.code
WHERE b.code = 'MAIN'
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO numbering_sequences (branch_id, sequence_key, prefix, year, next_value)
SELECT b.id, sequence_key, prefix, 2026, 1
FROM branches b
CROSS JOIN (VALUES
    ('patient', 'P'),
    ('order', 'ORD'),
    ('invoice', 'INV'),
    ('receipt', 'OR'),
    ('lab', 'LAB'),
    ('queue', 'Q'),
    ('employee', 'EMP'),
    ('purchase_order', 'PO'),
    ('approval', 'APR'),
    ('notification', 'NTF')
) AS numbering(sequence_key, prefix)
WHERE b.code = 'MAIN'
ON CONFLICT (branch_id, sequence_key, year) DO NOTHING;

INSERT INTO suppliers (code, name, contact_name, mobile, email)
VALUES
('PRIME-DIAG', 'Prime Diagnostics Supply', 'Supply Desk', '09170000010', 'orders@primediag.local'),
('MEDSUP-PH', 'MedSupply PH', 'Account Manager', '09170000011', 'sales@medsupply.local')
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_items (branch_id, code, name, category, unit_of_measure, reorder_level)
SELECT b.id, item_code, item_name, category, uom, reorder_level
FROM branches b
CROSS JOIN (VALUES
    ('CBC-REAGENT', 'CBC Reagent', 'Laboratory reagents', 'kit', 10.00),
    ('VACUTAINER', 'Vacutainer Tube', 'Lab consumables', 'piece', 20.00),
    ('RAPID-KIT', 'Rapid Test Kit', 'Laboratory reagents', 'kit', 5.00)
) AS inventory_seed(item_code, item_name, category, uom, reorder_level)
WHERE b.code = 'MAIN'
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (branch_id, code, name, category, price)
SELECT b.id, product_code, product_name, category, price
FROM branches b
CROSS JOIN (VALUES
    ('MED-PARA', 'Paracetamol 500mg', 'Medicine', 5.00),
    ('MASK-SURG', 'Surgical Mask', 'Medical supplies', 3.00)
) AS product_seed(product_code, product_name, category, price)
WHERE b.code = 'MAIN'
ON CONFLICT (code) DO NOTHING;

INSERT INTO packages (branch_id, code, name, price)
SELECT b.id, 'EXEC-PKG', 'Executive Wellness Package', 1800.00
FROM branches b
WHERE b.code = 'MAIN'
ON CONFLICT (code) DO NOTHING;

INSERT INTO package_items (package_id, service_id, item_name, item_version)
SELECT p.id, s.id, s.name, s.version
FROM packages p
JOIN services s ON s.code IN ('CBC', 'FBS', 'URINALYSIS')
WHERE p.code = 'EXEC-PKG'
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (template_code, provider, subject, privacy_safe_body)
VALUES
('result_ready', 'Amazon SES', 'Secure document available', 'Your laboratory result is available. Please log in securely.'),
('appointment_reminder', 'Amazon SES', 'Appointment reminder', 'You have an upcoming appointment. Please log in to your portal for details.'),
('marketing_package', 'Mailrelay', 'Health package available', 'A new health package is available. No medical content is included in this message.')
ON CONFLICT (template_code, version) DO NOTHING;

INSERT INTO sms_templates (template_code, privacy_safe_body)
VALUES
('result_ready', 'A new secure document is available in your patient portal.'),
('queue_update', 'Your queue status has changed. Please check the clinic monitor or portal.'),
('otp', 'Use this one-time code to continue secure portal access.')
ON CONFLICT (template_code, version) DO NOTHING;

INSERT INTO reports (report_code, name, category, required_permission)
VALUES
('sales_daily', 'Daily Sales', 'Sales', 'report.view'),
('billing_collections', 'Collections by Payment Mode', 'Billing', 'report.view'),
('lab_turnaround', 'Laboratory Turnaround Time', 'Laboratory', 'report.view'),
('inventory_low_stock', 'Low Stock Critical Items', 'Inventory', 'report.view'),
('hr_license_expiry', 'License Expiry', 'HR', 'report.view'),
('audit_sensitive_access', 'Sensitive Access Audit', 'Audit', 'audit.view')
ON CONFLICT (report_code) DO NOTHING;

INSERT INTO employees (branch_id, employee_no, user_id, department_id, full_name, position, employment_status, hired_at)
SELECT b.id, 'EMP-2026-000001', u.id, d.id, 'Maria Santos', 'Med-Tech', 'active', DATE '2024-01-15'
FROM branches b
JOIN users u ON u.email = 'medtech@hospital.local'
JOIN departments d ON d.branch_id = b.id AND d.code = 'LAB'
WHERE b.code = 'MAIN'
ON CONFLICT (employee_no) DO NOTHING;

INSERT INTO settings (branch_id, key, value)
SELECT id, 'security.controls', '{"mfa_roles":["super_admin","cashier","doctor","hr_manager","branch_manager"],"session_timeout_minutes":15,"overpayment_enabled":false,"dual_lab_approval":true}'::jsonb
FROM branches
WHERE code = 'MAIN'
ON CONFLICT (branch_id, key) DO NOTHING;

INSERT INTO settings (branch_id, key, value)
SELECT id, 'notification.providers', '{"transactional_primary":"Amazon SES","transactional_fallback":"Postmark","marketing":"Mailrelay"}'::jsonb
FROM branches
WHERE code = 'MAIN'
ON CONFLICT (branch_id, key) DO NOTHING;

-- Production-level SaaS packaging, templates, payment methods, health, and handoff data.

INSERT INTO tenants (code, name)
VALUES ('demo-clinic', 'Demo Clinic Tenant')
ON CONFLICT (code) DO NOTHING;

UPDATE branches
SET tenant_id = tenants.id
FROM tenants
WHERE branches.code = 'MAIN'
  AND tenants.code = 'demo-clinic'
  AND branches.tenant_id IS NULL;

UPDATE users
SET tenant_id = tenants.id
FROM tenants
WHERE tenants.code = 'demo-clinic'
  AND users.tenant_id IS NULL;

INSERT INTO subscription_plans (code, name, description)
VALUES
('starter_clinic', 'Starter Clinic', 'Patients, orders, billing, receipts, and basic reports.'),
('diagnostic_center', 'Diagnostic Center', 'Starter plus LIS, queue, inventory, result printing, and QR verification.'),
('advanced_clinic', 'Advanced Clinic', 'Diagnostic Center plus appointments, EMR, prescriptions, patient portal, and notifications.'),
('enterprise', 'Enterprise', 'Advanced plus multi-branch, HR, procurement, corporate billing, analytics, and integrations.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO tenant_subscriptions (tenant_id, subscription_plan_id, status)
SELECT t.id, p.id, 'active'
FROM tenants t
JOIN subscription_plans p ON p.code = 'enterprise'
WHERE t.code = 'demo-clinic'
ON CONFLICT (tenant_id, subscription_plan_id) DO NOTHING;

INSERT INTO feature_flags (code, name, description)
VALUES
('enable_lis', 'LIS', 'Laboratory workflow and result release.'),
('enable_emr', 'EMR', 'Clinical encounters, notes, prescriptions, and certificates.'),
('enable_hr', 'HR', 'Employee, attendance, leave, training, and licenses.'),
('enable_inventory', 'Inventory', 'Inventory, procurement, stock batches, and physical counts.'),
('enable_patient_portal', 'Patient Portal', 'Patient OTP access, requests, billing, and released documents.'),
('enable_sms', 'SMS', 'SMS notification channel.'),
('enable_multi_branch', 'Multi-branch', 'Tenant-specific branch operations.'),
('enable_referrals', 'Referrals', 'Referral partner and rebate tracking.'),
('enable_pharmacy', 'Pharmacy', 'Medication catalog and dispensing.'),
('enable_radiology', 'Radiology', 'Radiology reports and attachments.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO tenant_feature_flags (tenant_id, feature_code, enabled)
SELECT t.id, f.code, true
FROM tenants t
CROSS JOIN feature_flags f
WHERE t.code = 'demo-clinic'
ON CONFLICT (tenant_id, feature_code) DO NOTHING;

INSERT INTO payment_methods (code, name, requires_reference)
VALUES
('cash', 'Cash', false),
('gcash', 'GCash', true),
('maya', 'Maya', true),
('bank_transfer', 'Bank Transfer', true),
('credit_card', 'Credit Card', true),
('hmo', 'HMO', true),
('corporate', 'Corporate Account', true),
('employee_deduction', 'Employee Deduction', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO inventory_categories (code, name, requires_expiry)
VALUES
('lab_reagents', 'Laboratory reagents', true),
('lab_consumables', 'Lab consumables', true),
('medicines', 'Medicines', true),
('medical_supplies', 'Medical supplies', true),
('office_supplies', 'Office supplies', false),
('equipment', 'Equipment', false),
('maintenance', 'Maintenance items', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO print_templates (template_code, template_type, name)
VALUES
('lab_result_standard', 'lab_result', 'Standard Laboratory Result'),
('receipt_standard', 'receipt', 'Official Receipt'),
('invoice_standard', 'invoice', 'Invoice'),
('prescription_standard', 'prescription', 'Prescription'),
('medical_certificate_standard', 'medical_certificate', 'Medical Certificate'),
('queue_ticket_standard', 'queue_ticket', 'Queue Ticket'),
('barcode_label_standard', 'barcode_label', 'Specimen Barcode Label'),
('purchase_order_standard', 'purchase_order', 'Purchase Order'),
('employee_certificate_standard', 'employee_certificate', 'Employee Certificate')
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO template_versions (print_template_id, version, content, created_by)
SELECT pt.id, 1, 'Versioned production template placeholder for ' || pt.name, u.id
FROM print_templates pt
LEFT JOIN users u ON u.email = 'admin@hospital.local'
ON CONFLICT (print_template_id, version) DO NOTHING;

INSERT INTO lab_templates (template_code, name, version, created_by)
SELECT 'cbc', 'Complete Blood Count', 1, u.id
FROM users u
WHERE u.email = 'admin@hospital.local'
ON CONFLICT (template_code, version) DO NOTHING;

INSERT INTO lab_template_items (lab_template_id, analyte, unit, reference_range, display_order, critical_low, critical_high)
SELECT lt.id, analyte, unit, reference_range, display_order, critical_low, critical_high
FROM lab_templates lt
CROSS JOIN (VALUES
    ('Hemoglobin', 'g/dL', '12.0-16.0', 1, 7.0, 20.0),
    ('WBC', '10^9/L', '4.0-10.0', 2, 2.0, 30.0),
    ('Platelet', '10^9/L', '150-400', 3, 20.0, 1000.0)
) AS items(analyte, unit, reference_range, display_order, critical_low, critical_high)
WHERE lt.template_code = 'cbc'
  AND lt.version = 1
ON CONFLICT (lab_template_id, analyte) DO NOTHING;

INSERT INTO operating_hours (branch_id, day_of_week, opens_at, closes_at, is_closed)
SELECT b.id, day_no, TIME '08:00', TIME '17:00', false
FROM branches b
CROSS JOIN generate_series(1, 6) AS day_no
WHERE b.code = 'MAIN'
ON CONFLICT (branch_id, day_of_week) DO NOTHING;

INSERT INTO external_integrations (tenant_id, integration_code, integration_type, status, config)
SELECT t.id, integration_code, integration_type, 'active', config::jsonb
FROM tenants t
CROSS JOIN (VALUES
    ('amazon_ses', 'email', '{"purpose":"transactional_primary"}'),
    ('postmark', 'email', '{"purpose":"transactional_fallback"}'),
    ('sms_provider', 'sms', '{"purpose":"otp_and_notifications"}'),
    ('qr_verification', 'verification', '{"public_result_details":"masked"}'),
    ('private_file_storage', 'storage', '{"signed_urls":true}')
) AS integrations(integration_code, integration_type, config)
WHERE t.code = 'demo-clinic'
ON CONFLICT (tenant_id, integration_code) DO NOTHING;

INSERT INTO system_health_logs (component, status, metric_value, details)
VALUES
('application', 'ok', 'online', '{"checked_by":"seed"}'::jsonb),
('database', 'ok', 'reachable', '{"checked_by":"seed"}'::jsonb),
('storage', 'ok', 'private', '{"checked_by":"seed"}'::jsonb),
('backup', 'ok', 'encrypted', '{"restore_test_required":true}'::jsonb),
('email', 'ok', 'configured', '{"provider":"Amazon SES"}'::jsonb),
('sms', 'ok', 'configured', '{"privacy_safe_templates":true}'::jsonb),
('queue_workers', 'ok', 'idle', '{"failed_jobs":0}'::jsonb),
('pdf_generation', 'ok', 'available', '{"templates_versioned":true}'::jsonb);

INSERT INTO referrers (branch_id, referrer_code, name, referrer_type)
SELECT b.id, 'REF-DEMO-001', 'Demo Referral Partner', 'clinic'
FROM branches b
WHERE b.code = 'MAIN'
ON CONFLICT (referrer_code) DO NOTHING;

INSERT INTO settings (branch_id, key, value)
SELECT id, 'feature.flags', '{"enable_lis":true,"enable_emr":true,"enable_hr":true,"enable_inventory":true,"enable_patient_portal":true,"enable_sms":true,"enable_multi_branch":true,"enable_referrals":true,"enable_pharmacy":true,"enable_radiology":true}'::jsonb
FROM branches
WHERE code = 'MAIN'
ON CONFLICT (branch_id, key) DO NOTHING;
