-- Migration 009: Tenant DB Guards & Clinical/Financial Integrity
-- PR #9: Tenant Repository Hardening & DB-Level Clinical/Financial Guards
-- Not production-ready. Tenant-hardened staging foundation.

-- ============================================================
-- PART 1: Lab Result Immutability Trigger
-- Released lab results must not be directly updated at the DB level.
-- Application workflow must use the amendment path.
-- ============================================================

CREATE TABLE IF NOT EXISTS lab_result_versions (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_result_id   UUID            NOT NULL,
  tenant_id       UUID            NOT NULL,
  version_data    JSONB           NOT NULL,
  versioned_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  versioned_by    UUID,
  CONSTRAINT fk_lab_result_versions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lab_result_versions_lab_result_id
  ON lab_result_versions (lab_result_id);

CREATE INDEX IF NOT EXISTS idx_lab_result_versions_tenant_id
  ON lab_result_versions (tenant_id);

-- Immutability trigger function
CREATE OR REPLACE FUNCTION prevent_released_lab_result_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Block direct UPDATE if the existing (OLD) row has status Released.
  -- Safe amendment workflow must first write a version row,
  -- then INSERT a new row with status Amended (not UPDATE).
  IF OLD.status IN ('Released', 'released', 'APPROVED_RELEASED') THEN
    RAISE EXCEPTION
      'released_lab_result_immutable: lab result % (tenant %) has status % and cannot be directly updated. Use the amendment workflow.',
      OLD.id, OLD.tenant_id, OLD.status
    USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_released_lab_result_update ON lab_results;

CREATE TRIGGER trg_prevent_released_lab_result_update
  BEFORE UPDATE ON lab_results
  FOR EACH ROW
  EXECUTE FUNCTION prevent_released_lab_result_update();

-- ============================================================
-- PART 2: Invoice/Payment Idempotency & Overpayment Guard
-- Prevent double-payment and invoice overpayment.
-- ============================================================

-- Idempotency key on payments to prevent double-submit
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON payments (tenant_id, invoice_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Overpayment guard trigger function
CREATE OR REPLACE FUNCTION prevent_invoice_overpayment()
RETURNS TRIGGER AS $$
DECLARE
  invoice_balance  NUMERIC;
  paid_so_far      NUMERIC;
  pending_amount   NUMERIC;
BEGIN
  -- Lock the invoice row to prevent concurrent payment races
  SELECT balance_due INTO invoice_balance
    FROM invoices
    WHERE id = NEW.invoice_id AND tenant_id = NEW.tenant_id
    FOR UPDATE;

  IF invoice_balance IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found for tenant %', NEW.invoice_id, NEW.tenant_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO paid_so_far
    FROM payments
    WHERE invoice_id = NEW.invoice_id
      AND tenant_id = NEW.tenant_id
      AND status = 'Posted';

  pending_amount := paid_so_far + NEW.amount;

  IF pending_amount > invoice_balance THEN
    RAISE EXCEPTION
      'invoice_overpayment: payment of % would exceed invoice balance % (already paid: %) for invoice % tenant %',
      NEW.amount, invoice_balance, paid_so_far, NEW.invoice_id, NEW.tenant_id
    USING ERRCODE = 'P0003';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_invoice_overpayment ON payments;

CREATE TRIGGER trg_prevent_invoice_overpayment
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_overpayment();

-- ============================================================
-- PART 3: Tenant Scope Enforcement
-- All tenant-owned tables must have tenant_id in lookups.
-- Add WHERE tenant_id constraints to critical join paths
-- via check constraints where NOT NULL already enforced.
-- ============================================================

-- Ensure tenant_id is NOT NULL on all tenant-owned tables
ALTER TABLE patients      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE orders        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments      ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE lab_results   ALTER COLUMN tenant_id SET NOT NULL;

-- Add partial indexes to enforce tenant-scoped uniqueness on natural keys
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_mrn_tenant
  ON patients (mrn, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_no_tenant
  ON invoices (invoice_no, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lab_results_lab_no_tenant
  ON lab_results (lab_no, tenant_id);

-- ============================================================
-- PART 4: Role Permissions Table
-- Tenant-specific role permission grants.
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID            NOT NULL,
  role_name     VARCHAR(64)     NOT NULL,
  permission    VARCHAR(128)    NOT NULL,
  granted_by    UUID,
  granted_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_permissions_tenant_role_perm
    UNIQUE (tenant_id, role_name, permission),
  CONSTRAINT fk_role_permissions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_tenant_role
  ON role_permissions (tenant_id, role_name);

-- Seed baseline role permissions for HMS roles
INSERT INTO role_permissions (tenant_id, role_name, permission)
SELECT
  t.id,
  rp.role_name,
  rp.permission
FROM tenants t
CROSS JOIN (
  VALUES
    ('admin',      'patients:read'),
    ('admin',      'patients:write'),
    ('admin',      'orders:read'),
    ('admin',      'orders:write'),
    ('admin',      'invoices:read'),
    ('admin',      'invoices:write'),
    ('admin',      'payments:read'),
    ('admin',      'payments:write'),
    ('admin',      'lab_results:read'),
    ('admin',      'lab_results:write'),
    ('admin',      'users:manage'),
    ('admin',      'roles:manage'),
    ('doctor',     'patients:read'),
    ('doctor',     'patients:write'),
    ('doctor',     'orders:read'),
    ('doctor',     'orders:write'),
    ('doctor',     'lab_results:read'),
    ('nurse',      'patients:read'),
    ('nurse',      'orders:read'),
    ('nurse',      'lab_results:read'),
    ('cashier',    'invoices:read'),
    ('cashier',    'payments:read'),
    ('cashier',    'payments:write'),
    ('receptionist','patients:read'),
    ('receptionist','patients:write'),
    ('receptionist','orders:read'),
    ('manager',    'patients:read'),
    ('manager',    'orders:read'),
    ('manager',    'invoices:read'),
    ('manager',    'payments:read'),
    ('manager',    'lab_results:read'),
    ('manager',    'users:manage')
) AS rp(role_name, permission)
ON CONFLICT (tenant_id, role_name, permission) DO NOTHING;

-- ============================================================
-- PART 5: Cashier Session Guards
-- Prevent concurrent close race conditions.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_double_cashier_session_close()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent closing an already-closed session
  IF OLD.status = 'Closed' AND NEW.status = 'Closed' THEN
    RAISE EXCEPTION
      'cashier_session_already_closed: session % (tenant %) is already closed',
      OLD.id, OLD.tenant_id
    USING ERRCODE = 'P0004';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_double_cashier_session_close ON cashier_sessions;

CREATE TRIGGER trg_prevent_double_cashier_session_close
  BEFORE UPDATE ON cashier_sessions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_cashier_session_close();
