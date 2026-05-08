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
