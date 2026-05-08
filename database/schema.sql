-- Hospital Management System core schema
-- Dialect: PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE branches (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(24) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(180) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    mfa_required BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(120) NOT NULL UNIQUE,
    module VARCHAR(80) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id BIGINT REFERENCES branches(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id, branch_id)
);

CREATE TABLE patients (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    patient_no VARCHAR(32) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    birthdate DATE NOT NULL,
    sex VARCHAR(32) NOT NULL CHECK (sex IN ('female', 'male', 'other', 'undisclosed')),
    mobile VARCHAR(40),
    email VARCHAR(255),
    address TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    duplicate_risk BOOLEAN NOT NULL DEFAULT false,
    merged_into_patient_id BIGINT REFERENCES patients(id),
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE services (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    department VARCHAR(80) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    result_template_code VARCHAR(80),
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    order_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    payment_status VARCHAR(32) NOT NULL DEFAULT 'unpaid',
    requested_by BIGINT REFERENCES users(id),
    void_requested_by BIGINT REFERENCES users(id),
    void_approved_by BIGINT REFERENCES users(id),
    void_reason TEXT,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CHECK (void_requested_by IS NULL OR void_requested_by IS DISTINCT FROM void_approved_by)
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    service_id BIGINT NOT NULL REFERENCES services(id),
    service_name VARCHAR(180) NOT NULL,
    service_version INTEGER NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    line_total NUMERIC(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount_amount) STORED,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    order_id BIGINT NOT NULL REFERENCES orders(id),
    invoice_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
    total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    receipt_no VARCHAR(32) NOT NULL UNIQUE,
    payment_mode VARCHAR(40) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'posted',
    reference_no VARCHAR(120),
    void_requested_by BIGINT REFERENCES users(id),
    void_approved_by BIGINT REFERENCES users(id),
    void_reason TEXT,
    cashier_id BIGINT REFERENCES users(id),
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CHECK (void_requested_by IS NULL OR void_requested_by IS DISTINCT FROM void_approved_by)
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT REFERENCES users(id),
    user_role VARCHAR(120),
    branch_id BIGINT REFERENCES branches(id),
    module VARCHAR(80) NOT NULL,
    action VARCHAR(120) NOT NULL,
    record_type VARCHAR(120) NOT NULL,
    record_id VARCHAR(120) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    device_info TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_orders (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    order_item_id BIGINT NOT NULL REFERENCES order_items(id),
    lab_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(40) NOT NULL DEFAULT 'pending_collection',
    barcode_value VARCHAR(80) NOT NULL UNIQUE,
    collected_by BIGINT REFERENCES users(id),
    collected_at TIMESTAMPTZ,
    received_by BIGINT REFERENCES users(id),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_results (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    lab_order_id BIGINT NOT NULL REFERENCES lab_orders(id),
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(40) NOT NULL DEFAULT 'encoded',
    encoded_by BIGINT REFERENCES users(id),
    encoded_at TIMESTAMPTZ,
    validated_by BIGINT REFERENCES users(id),
    validated_at TIMESTAMPTZ,
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    released_by BIGINT REFERENCES users(id),
    released_at TIMESTAMPTZ,
    amendment_reason TEXT,
    supersedes_result_id BIGINT REFERENCES lab_results(id),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (encoded_by IS NULL OR encoded_by IS DISTINCT FROM approved_by)
);

CREATE TABLE lab_result_items (
    id BIGSERIAL PRIMARY KEY,
    lab_result_id BIGINT NOT NULL REFERENCES lab_results(id) ON DELETE CASCADE,
    analyte VARCHAR(120) NOT NULL,
    result_value VARCHAR(120) NOT NULL,
    unit VARCHAR(60),
    reference_range VARCHAR(120),
    flag VARCHAR(20),
    is_critical BOOLEAN NOT NULL DEFAULT false,
    comments TEXT
);

CREATE TABLE inventory_items (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL,
    unit_of_measure VARCHAR(40) NOT NULL,
    reorder_level NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE stock_movements (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
    movement_type VARCHAR(40) NOT NULL,
    batch_no VARCHAR(80),
    expiry_date DATE,
    quantity NUMERIC(12,2) NOT NULL,
    reason TEXT,
    requested_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS NULL OR requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE approval_requests (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    module VARCHAR(80) NOT NULL,
    request_type VARCHAR(80) NOT NULL,
    record_type VARCHAR(120) NOT NULL,
    record_id VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL REFERENCES users(id),
    reviewed_by BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS DISTINCT FROM reviewed_by)
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    recipient_user_id BIGINT REFERENCES users(id),
    recipient_patient_id BIGINT REFERENCES patients(id),
    channel VARCHAR(32) NOT NULL,
    template_code VARCHAR(80) NOT NULL,
    subject VARCHAR(180),
    privacy_safe_body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    sent_at TIMESTAMPTZ,
    failed_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE settings (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT REFERENCES branches(id),
    key VARCHAR(120) NOT NULL,
    value JSONB NOT NULL,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, key)
);

CREATE INDEX idx_patients_name ON patients (last_name, first_name);
CREATE INDEX idx_orders_patient_status ON orders (patient_id, status);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_audit_logs_record ON audit_logs (record_type, record_id);
CREATE INDEX idx_lab_orders_status ON lab_orders (status);
CREATE INDEX idx_approval_requests_status ON approval_requests (status);
