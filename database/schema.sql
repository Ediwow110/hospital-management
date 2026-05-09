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

-- Blueprint expansion tables for the remaining MVP and next-priority domains.

CREATE TABLE departments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (branch_id, code)
);

CREATE TABLE rooms (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    department_id BIGINT REFERENCES departments(id),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(160) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (branch_id, code)
);

CREATE TABLE numbering_sequences (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT REFERENCES branches(id),
    sequence_key VARCHAR(80) NOT NULL,
    prefix VARCHAR(24) NOT NULL,
    year INTEGER NOT NULL,
    next_value BIGINT NOT NULL DEFAULT 1 CHECK (next_value > 0),
    locked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, sequence_key, year)
);

CREATE TABLE patient_contacts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    contact_type VARCHAR(40) NOT NULL,
    full_name VARCHAR(180) NOT NULL,
    mobile VARCHAR(40),
    email VARCHAR(255),
    relationship VARCHAR(80),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_identifiers (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    identifier_type VARCHAR(80) NOT NULL,
    identifier_value VARCHAR(160) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (identifier_type, identifier_value)
);

CREATE TABLE patient_consents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    consent_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'signed',
    signed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    document_file_id BIGINT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE files (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    owner_type VARCHAR(80) NOT NULL,
    owner_id VARCHAR(120) NOT NULL,
    category VARCHAR(80) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    version INTEGER NOT NULL DEFAULT 1,
    is_private BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    replaced_by_file_id BIGINT REFERENCES files(id),
    replace_reason TEXT,
    uploaded_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE patient_consents
    ADD CONSTRAINT fk_patient_consents_file
    FOREIGN KEY (document_file_id) REFERENCES files(id);

CREATE TABLE patient_documents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    file_id BIGINT NOT NULL REFERENCES files(id),
    document_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    expiry_date DATE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    department_id BIGINT REFERENCES departments(id),
    room_id BIGINT REFERENCES rooms(id),
    appointment_no VARCHAR(32) NOT NULL UNIQUE,
    appointment_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'booked',
    reason TEXT,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE queue_tickets (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    appointment_id BIGINT REFERENCES appointments(id),
    order_id BIGINT REFERENCES orders(id),
    ticket_no VARCHAR(32) NOT NULL UNIQUE,
    station VARCHAR(80) NOT NULL,
    priority BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    called_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE encounters (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    doctor_id BIGINT REFERENCES users(id),
    encounter_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    chief_complaint TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE vitals (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    encounter_id BIGINT NOT NULL REFERENCES encounters(id),
    height_cm NUMERIC(6,2),
    weight_kg NUMERIC(6,2),
    temperature_c NUMERIC(4,1),
    blood_pressure VARCHAR(20),
    pulse_rate INTEGER,
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    recorded_by BIGINT REFERENCES users(id),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clinical_notes (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    encounter_id BIGINT NOT NULL REFERENCES encounters(id),
    note_type VARCHAR(80) NOT NULL,
    note_text TEXT NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE diagnoses (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    encounter_id BIGINT NOT NULL REFERENCES encounters(id),
    code VARCHAR(40),
    description TEXT NOT NULL,
    diagnosis_type VARCHAR(40) NOT NULL DEFAULT 'working',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescriptions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    encounter_id BIGINT NOT NULL REFERENCES encounters(id),
    prescription_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    issued_by BIGINT REFERENCES users(id),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_locked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE prescription_items (
    id BIGSERIAL PRIMARY KEY,
    prescription_id BIGINT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name VARCHAR(180) NOT NULL,
    dosage VARCHAR(120) NOT NULL,
    frequency VARCHAR(120) NOT NULL,
    duration VARCHAR(120),
    instructions TEXT
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE packages (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE package_items (
    id BIGSERIAL PRIMARY KEY,
    package_id BIGINT NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    service_id BIGINT REFERENCES services(id),
    product_id BIGINT REFERENCES products(id),
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    item_name VARCHAR(180) NOT NULL,
    item_version INTEGER NOT NULL,
    CHECK (service_id IS NOT NULL OR product_id IS NOT NULL)
);

CREATE TABLE price_versions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    item_type VARCHAR(40) NOT NULL,
    item_id BIGINT NOT NULL,
    version INTEGER NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    reason TEXT NOT NULL,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (item_type, item_id, version)
);

CREATE TABLE discounts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    discount_type VARCHAR(80) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'applied',
    requested_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS NULL OR requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE refunds (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    payment_id BIGINT NOT NULL REFERENCES payments(id),
    refund_no VARCHAR(32) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    requested_by BIGINT NOT NULL REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE cashier_sessions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    cashier_id BIGINT NOT NULL REFERENCES users(id),
    session_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    opening_cash NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
    expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(12,2),
    short_over NUMERIC(12,2),
    remarks TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    CHECK (cashier_id IS DISTINCT FROM approved_by)
);

CREATE TABLE specimens (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    lab_order_id BIGINT NOT NULL REFERENCES lab_orders(id),
    specimen_no VARCHAR(32) NOT NULL UNIQUE,
    specimen_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_collection',
    collected_by BIGINT REFERENCES users(id),
    collected_at TIMESTAMPTZ,
    received_by BIGINT REFERENCES users(id),
    received_at TIMESTAMPTZ,
    rejected_by BIGINT REFERENCES users(id),
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT
);

CREATE TABLE lab_result_approvals (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    lab_result_id BIGINT NOT NULL REFERENCES lab_results(id),
    approval_step VARCHAR(40) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    requested_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS NULL OR requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE result_amendments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    original_result_id BIGINT NOT NULL REFERENCES lab_results(id),
    amended_result_id BIGINT REFERENCES lab_results(id),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    patient_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    contact_name VARCHAR(180),
    mobile VARCHAR(40),
    email VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE stock_batches (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
    supplier_id BIGINT REFERENCES suppliers(id),
    batch_no VARCHAR(80) NOT NULL,
    expiry_date DATE,
    quantity_on_hand NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'stocked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inventory_item_id, batch_no)
);

CREATE TABLE purchase_requests (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    request_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'requested',
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL REFERENCES users(id),
    reviewed_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    CHECK (requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    supplier_id BIGINT REFERENCES suppliers(id),
    purchase_request_id BIGINT REFERENCES purchase_requests(id),
    po_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'ordered',
    total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    created_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CHECK (created_by IS NULL OR created_by IS DISTINCT FROM approved_by)
);

CREATE TABLE receiving_records (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    purchase_order_id BIGINT REFERENCES purchase_orders(id),
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
    supplier_id BIGINT REFERENCES suppliers(id),
    receiving_no VARCHAR(32) NOT NULL UNIQUE,
    batch_no VARCHAR(80) NOT NULL,
    expiry_date DATE,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    received_by BIGINT REFERENCES users(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    remarks TEXT
);

CREATE TABLE employees (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    employee_no VARCHAR(32) NOT NULL UNIQUE,
    user_id BIGINT REFERENCES users(id),
    department_id BIGINT REFERENCES departments(id),
    full_name VARCHAR(180) NOT NULL,
    position VARCHAR(120) NOT NULL,
    employment_status VARCHAR(32) NOT NULL DEFAULT 'active',
    hired_at DATE,
    separated_at DATE,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE shifts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    starts_at TIME NOT NULL,
    ends_at TIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    UNIQUE (branch_id, code)
);

CREATE TABLE attendance_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    shift_id BIGINT REFERENCES shifts(id),
    log_date DATE NOT NULL,
    time_in TIMESTAMPTZ,
    time_out TIMESTAMPTZ,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    undertime_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_minutes INTEGER NOT NULL DEFAULT 0,
    source VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (employee_id, log_date)
);

CREATE TABLE leave_requests (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    leave_type VARCHAR(80) NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL REFERENCES users(id),
    reviewed_by BIGINT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS DISTINCT FROM reviewed_by)
);

CREATE TABLE training_records (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    training_name VARCHAR(180) NOT NULL,
    provider VARCHAR(180),
    completed_on DATE,
    expires_on DATE,
    file_id BIGINT REFERENCES files(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE license_records (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    license_type VARCHAR(80) NOT NULL,
    license_no VARCHAR(120) NOT NULL,
    issued_on DATE,
    expires_on DATE NOT NULL,
    file_id BIGINT REFERENCES files(id),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_templates (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    template_code VARCHAR(80) NOT NULL,
    provider VARCHAR(80) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    privacy_safe_body TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_code, version)
);

CREATE TABLE sms_templates (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    template_code VARCHAR(80) NOT NULL,
    privacy_safe_body TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_code, version)
);

CREATE TABLE notification_logs (
    id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT REFERENCES notifications(id),
    channel VARCHAR(32) NOT NULL,
    provider VARCHAR(80),
    status VARCHAR(32) NOT NULL,
    provider_message_id VARCHAR(180),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    report_code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    category VARCHAR(80) NOT NULL,
    required_permission VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE imports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    import_type VARCHAR(80) NOT NULL,
    file_id BIGINT REFERENCES files(id),
    status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
    total_rows INTEGER NOT NULL DEFAULT 0,
    success_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    error_summary TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE backup_jobs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    job_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    backup_type VARCHAR(40) NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT true,
    storage_key TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    restore_tested_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE system_health_checks (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    check_code VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_tickets_status ON queue_tickets (status, station);
CREATE INDEX idx_appointments_patient ON appointments (patient_id, appointment_at);
CREATE INDEX idx_encounters_patient ON encounters (patient_id, status);
CREATE INDEX idx_files_owner ON files (owner_type, owner_id);
CREATE INDEX idx_specimens_status ON specimens (status);
CREATE INDEX idx_stock_batches_expiry ON stock_batches (expiry_date);
CREATE INDEX idx_purchase_requests_status ON purchase_requests (status);
CREATE INDEX idx_employees_status ON employees (employment_status);
CREATE INDEX idx_license_records_expiry ON license_records (expires_on);
CREATE INDEX idx_notification_logs_status ON notification_logs (status);
CREATE INDEX idx_backup_jobs_status ON backup_jobs (status);

-- Strong production-level additions from the May 08, 2026 production plan.
-- These tables make tenant isolation, feature packaging, API handoff, imports,
-- background jobs, reporting, templates, and missing clinical operations explicit.

CREATE TABLE tenants (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE branches
    ADD COLUMN tenant_id BIGINT REFERENCES tenants(id);

ALTER TABLE users
    ADD COLUMN tenant_id BIGINT REFERENCES tenants(id);

ALTER TABLE audit_logs
    ADD COLUMN tenant_id BIGINT REFERENCES tenants(id);

ALTER TABLE approval_requests
    ADD COLUMN tenant_id BIGINT REFERENCES tenants(id);

CREATE TABLE subscription_plans (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    subscription_plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, subscription_plan_id)
);

CREATE TABLE feature_flags (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE tenant_feature_flags (
    tenant_id BIGINT NOT NULL REFERENCES tenants(id),
    feature_code VARCHAR(80) NOT NULL REFERENCES feature_flags(code),
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, feature_code)
);

CREATE TABLE patient_emergency_contacts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    full_name VARCHAR(180) NOT NULL,
    relationship VARCHAR(80) NOT NULL,
    mobile VARCHAR(40) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_dependents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    dependent_patient_id BIGINT NOT NULL REFERENCES patients(id),
    relationship VARCHAR(80) NOT NULL,
    authorization_status VARCHAR(32) NOT NULL DEFAULT 'active',
    authorized_by BIGINT REFERENCES users(id),
    authorized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (patient_id IS DISTINCT FROM dependent_patient_id)
);

CREATE TABLE patient_timeline_events (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    patient_id BIGINT NOT NULL REFERENCES patients(id),
    event_type VARCHAR(80) NOT NULL,
    event_title VARCHAR(180) NOT NULL,
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_type VARCHAR(80),
    source_id VARCHAR(120),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_merge_requests (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    source_patient_id BIGINT NOT NULL REFERENCES patients(id),
    target_patient_id BIGINT NOT NULL REFERENCES patients(id),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (source_patient_id IS DISTINCT FROM target_patient_id),
    CHECK (requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE appointment_services (
    id BIGSERIAL PRIMARY KEY,
    appointment_id BIGINT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id BIGINT NOT NULL REFERENCES services(id),
    service_name VARCHAR(180) NOT NULL,
    service_version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE queue_events (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    queue_ticket_id BIGINT NOT NULL REFERENCES queue_tickets(id),
    event_type VARCHAR(80) NOT NULL,
    station VARCHAR(80),
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by BIGINT REFERENCES users(id),
    reason TEXT
);

CREATE TABLE doctor_schedules (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    doctor_id BIGINT NOT NULL REFERENCES users(id),
    department_id BIGINT REFERENCES departments(id),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    starts_at TIME NOT NULL,
    ends_at TIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE department_schedules (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    department_id BIGINT NOT NULL REFERENCES departments(id),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    starts_at TIME NOT NULL,
    ends_at TIME NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE operating_hours (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    opens_at TIME NOT NULL,
    closes_at TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (branch_id, day_of_week)
);

CREATE TABLE holidays (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT REFERENCES branches(id),
    holiday_date DATE NOT NULL,
    name VARCHAR(180) NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, holiday_date)
);

CREATE TABLE medical_certificates (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    encounter_id BIGINT NOT NULL REFERENCES encounters(id),
    certificate_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    template_version INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    issued_by BIGINT REFERENCES users(id),
    issued_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE clinical_attachments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    encounter_id BIGINT NOT NULL REFERENCES encounters(id),
    file_id BIGINT NOT NULL REFERENCES files(id),
    attachment_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_order_items (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    lab_order_id BIGINT NOT NULL REFERENCES lab_orders(id),
    service_id BIGINT REFERENCES services(id),
    test_code VARCHAR(80) NOT NULL,
    test_name VARCHAR(180) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_collection',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE specimen_events (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    specimen_id BIGINT NOT NULL REFERENCES specimens(id),
    event_type VARCHAR(80) NOT NULL,
    old_status VARCHAR(32),
    new_status VARCHAR(32),
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by BIGINT REFERENCES users(id),
    reason TEXT
);

CREATE TABLE lab_result_versions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    lab_result_id BIGINT NOT NULL REFERENCES lab_results(id),
    version INTEGER NOT NULL,
    status VARCHAR(32) NOT NULL,
    snapshot JSONB NOT NULL,
    reason TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (lab_result_id, version)
);

CREATE TABLE lab_templates (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    template_code VARCHAR(80) NOT NULL,
    name VARCHAR(180) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_code, version)
);

CREATE TABLE lab_template_items (
    id BIGSERIAL PRIMARY KEY,
    lab_template_id BIGINT NOT NULL REFERENCES lab_templates(id) ON DELETE CASCADE,
    analyte VARCHAR(120) NOT NULL,
    unit VARCHAR(60),
    reference_range VARCHAR(120),
    display_order INTEGER NOT NULL DEFAULT 0,
    critical_low NUMERIC(12,4),
    critical_high NUMERIC(12,4),
    UNIQUE (lab_template_id, analyte)
);

CREATE TABLE critical_result_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    lab_result_item_id BIGINT NOT NULL REFERENCES lab_result_items(id),
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    notified_user_id BIGINT REFERENCES users(id),
    acknowledged_by BIGINT REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    who_was_informed TEXT,
    action_taken TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE qc_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    department_id BIGINT REFERENCES departments(id),
    qc_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'passed',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    performed_by BIGINT REFERENCES users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoice_items (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    order_item_id BIGINT REFERENCES order_items(id),
    item_name VARCHAR(180) NOT NULL,
    item_version INTEGER NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    line_total NUMERIC(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - discount_amount) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_methods (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    requires_reference BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE payment_allocations (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    payment_id BIGINT NOT NULL REFERENCES payments(id),
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (payment_id, invoice_id)
);

CREATE TABLE void_requests (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    module VARCHAR(80) NOT NULL,
    record_type VARCHAR(120) NOT NULL,
    record_id VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    reason TEXT NOT NULL,
    requested_by BIGINT NOT NULL REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE cashier_closing_reports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    cashier_session_id BIGINT NOT NULL REFERENCES cashier_sessions(id),
    report_no VARCHAR(32) NOT NULL UNIQUE,
    cash_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    ewallet_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    bank_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    card_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    refunds_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    voids_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(12,2) NOT NULL DEFAULT 0,
    short_over NUMERIC(12,2) NOT NULL DEFAULT 0,
    generated_by BIGINT REFERENCES users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts_receivable (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id),
    account_type VARCHAR(80) NOT NULL,
    account_name VARCHAR(180) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    amount_due NUMERIC(12,2) NOT NULL CHECK (amount_due >= 0),
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory_categories (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    requires_expiry BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(32) NOT NULL DEFAULT 'active'
);

CREATE TABLE stock_adjustments (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    stock_batch_id BIGINT REFERENCES stock_batches(id),
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
    adjustment_type VARCHAR(80) NOT NULL,
    quantity NUMERIC(12,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    requested_by BIGINT NOT NULL REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS DISTINCT FROM approved_by)
);

CREATE TABLE purchase_order_items (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    inventory_item_id BIGINT NOT NULL REFERENCES inventory_items(id),
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
    line_total NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);

CREATE TABLE physical_counts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    count_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    counted_by BIGINT REFERENCES users(id),
    reviewed_by BIGINT REFERENCES users(id),
    variance_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    counted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE employee_documents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    file_id BIGINT NOT NULL REFERENCES files(id),
    document_type VARCHAR(80) NOT NULL,
    expiry_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE leave_balances (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    leave_type VARCHAR(80) NOT NULL,
    year INTEGER NOT NULL,
    earned NUMERIC(8,2) NOT NULL DEFAULT 0,
    used NUMERIC(8,2) NOT NULL DEFAULT 0,
    remaining NUMERIC(8,2) GENERATED ALWAYS AS (earned - used) STORED,
    UNIQUE (employee_id, leave_type, year)
);

CREATE TABLE hr_incidents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    incident_type VARCHAR(80) NOT NULL,
    severity VARCHAR(40),
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    reported_by BIGINT REFERENCES users(id),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payroll_exports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    export_no VARCHAR(32) NOT NULL UNIQUE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'generated',
    file_id BIGINT REFERENCES files(id),
    generated_by BIGINT REFERENCES users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_exports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    report_id BIGINT REFERENCES reports(id),
    branch_id BIGINT REFERENCES branches(id),
    export_format VARCHAR(20) NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'queued',
    file_id BIGINT REFERENCES files(id),
    requested_by BIGINT NOT NULL REFERENCES users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE saved_report_filters (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    report_id BIGINT NOT NULL REFERENCES reports(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(180) NOT NULL,
    filters JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE print_templates (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    template_code VARCHAR(80) NOT NULL,
    template_type VARCHAR(80) NOT NULL,
    name VARCHAR(180) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (template_code)
);

CREATE TABLE template_versions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    print_template_id BIGINT NOT NULL REFERENCES print_templates(id),
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (print_template_id, version)
);

CREATE TABLE generated_documents (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    template_version_id BIGINT NOT NULL REFERENCES template_versions(id),
    owner_type VARCHAR(80) NOT NULL,
    owner_id VARCHAR(120) NOT NULL,
    file_id BIGINT REFERENCES files(id),
    status VARCHAR(32) NOT NULL DEFAULT 'generated',
    generated_by BIGINT REFERENCES users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    notification_id BIGINT REFERENCES notifications(id),
    provider VARCHAR(80) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(180) NOT NULL,
    status VARCHAR(32) NOT NULL,
    provider_message_id VARCHAR(180),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sms_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    notification_id BIGINT REFERENCES notifications(id),
    provider VARCHAR(80) NOT NULL,
    recipient_mobile VARCHAR(40) NOT NULL,
    privacy_safe_body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    provider_message_id VARCHAR(180),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    integration_code VARCHAR(80) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL,
    payload JSONB,
    response_status INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api_tokens (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    tenant_id BIGINT REFERENCES tenants(id),
    name VARCHAR(180) NOT NULL,
    token_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE external_integrations (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    tenant_id BIGINT REFERENCES tenants(id),
    integration_code VARCHAR(80) NOT NULL,
    integration_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by BIGINT REFERENCES users(id),
    updated_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, integration_code)
);

CREATE TABLE failed_jobs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    queue_name VARCHAR(80) NOT NULL,
    job_type VARCHAR(120) NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE system_health_logs (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    component VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL,
    metric_value VARCHAR(120),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE radiology_orders (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    order_item_id BIGINT REFERENCES order_items(id),
    radiology_no VARCHAR(32) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMPTZ,
    technician_id BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE radiology_reports (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    radiology_order_id BIGINT NOT NULL REFERENCES radiology_orders(id),
    report_text TEXT NOT NULL,
    impression TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    file_id BIGINT REFERENCES files(id),
    encoded_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (encoded_by IS NULL OR encoded_by IS DISTINCT FROM approved_by)
);

CREATE TABLE pharmacy_medications (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    product_id BIGINT REFERENCES products(id),
    generic_name VARCHAR(180) NOT NULL,
    brand_name VARCHAR(180),
    dosage_form VARCHAR(80) NOT NULL,
    strength VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pharmacy_dispenses (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    prescription_item_id BIGINT REFERENCES prescription_items(id),
    medication_id BIGINT REFERENCES pharmacy_medications(id),
    stock_batch_id BIGINT REFERENCES stock_batches(id),
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'dispensed',
    dispensed_by BIGINT REFERENCES users(id),
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referrers (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    branch_id BIGINT REFERENCES branches(id),
    referrer_code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    referrer_type VARCHAR(80) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_transactions (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    referrer_id BIGINT NOT NULL REFERENCES referrers(id),
    order_id BIGINT REFERENCES orders(id),
    invoice_id BIGINT REFERENCES invoices(id),
    rebate_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rebate_amount >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_payouts (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    referrer_id BIGINT NOT NULL REFERENCES referrers(id),
    payout_no VARCHAR(32) NOT NULL UNIQUE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'submitted',
    requested_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_by IS NULL OR requested_by IS DISTINCT FROM approved_by)
);

CREATE INDEX idx_branches_tenant ON branches (tenant_id);
CREATE INDEX idx_users_tenant ON users (tenant_id);
CREATE INDEX idx_patient_timeline_patient ON patient_timeline_events (patient_id, event_at);
CREATE INDEX idx_queue_events_ticket ON queue_events (queue_ticket_id, event_at);
CREATE INDEX idx_specimen_events_specimen ON specimen_events (specimen_id, event_at);
CREATE INDEX idx_lab_result_versions_result ON lab_result_versions (lab_result_id, version);
CREATE INDEX idx_report_exports_status ON report_exports (status);
CREATE INDEX idx_failed_jobs_queue ON failed_jobs (queue_name, failed_at);
CREATE INDEX idx_system_health_logs_component ON system_health_logs (component, checked_at);
