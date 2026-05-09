-- Migration 005: Laboratory - Orders, Results, Versions
-- Depends on: 001, 002, 003, 004
-- IMMUTABILITY RULE: released lab_results rows may not be directly updated.
-- Corrections must create a lab_result_versions row and amend via the service layer.

CREATE TABLE IF NOT EXISTS lab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  order_id UUID REFERENCES orders(id),
  lab_no TEXT NOT NULL,
  test_code TEXT NOT NULL,
  test_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ordered'
    CHECK (status IN ('ordered','specimen_collected','in_progress','resulted','released','cancelled')),
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  requested_by UUID REFERENCES users(id),
  specimen_collected_at TIMESTAMPTZ,
  specimen_collected_by UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, lab_no)
);

CREATE TABLE IF NOT EXISTS lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lab_order_id UUID NOT NULL REFERENCES lab_orders(id),
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','verified','released','amended','superseded')),
  result_data JSONB NOT NULL DEFAULT '{}',
  normal_range JSONB,
  flags JSONB,
  interpretation TEXT,
  resulted_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  released_by UUID REFERENCES users(id),
  resulted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only amendment history. Original released row is marked superseded, not deleted.
CREATE TABLE IF NOT EXISTS lab_result_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lab_result_id UUID NOT NULL REFERENCES lab_results(id),
  version INT NOT NULL,
  snapshot_data JSONB NOT NULL,
  amendment_reason TEXT NOT NULL,
  amended_by UUID NOT NULL REFERENCES users(id),
  amended_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DB-level guard: released lab_results cannot be directly updated.
-- Only status transitions to 'amended' or 'superseded' via the amendment path are allowed.
CREATE OR REPLACE FUNCTION prevent_released_lab_result_direct_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow only: releasing (draft/verified -> released), amending (released -> amended), superseding (released/amended -> superseded)
  IF OLD.status = 'released' THEN
    IF NEW.status NOT IN ('amended', 'superseded') THEN
      RAISE EXCEPTION 'lab_result_immutable: released lab result id=% cannot be directly updated. Use amendment workflow.', OLD.id;
    END IF;
    -- Prevent changing result data on a released row
    IF NEW.result_data IS DISTINCT FROM OLD.result_data THEN
      RAISE EXCEPTION 'lab_result_immutable: result_data cannot be changed on released lab result id=%. Create an amendment.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_released_lab_result_update ON lab_results;
CREATE TRIGGER trg_prevent_released_lab_result_update
  BEFORE UPDATE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION prevent_released_lab_result_direct_update();

CREATE INDEX IF NOT EXISTS idx_lab_orders_tenant_id ON lab_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lab_orders_patient_id ON lab_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_lab_order_id ON lab_results(lab_order_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_is_current ON lab_results(is_current);
