-- Migration 006: Inventory - Items, Batches, Stock Movements (Ledger)
-- Depends on: 001, 002
-- LEDGER RULE: stock_movements is append-only. Current stock derived from ledger sum
-- or maintained via a transaction-safe balance column updated within the same tx.

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  unit TEXT NOT NULL DEFAULT 'pcs',
  reorder_level INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','discontinued')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, branch_id, item_code)
);

CREATE TABLE IF NOT EXISTS stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  batch_no TEXT NOT NULL,
  expiry_date DATE,
  quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  unit_cost NUMERIC(14,4),
  supplier TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, inventory_item_id, batch_no)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  stock_batch_id UUID REFERENCES stock_batches(id),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('receive','dispense','adjust','transfer_in','transfer_out','write_off','physical_count','return')),
  quantity INT NOT NULL,   -- positive = in, negative = out
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,    -- 'order', 'purchase_order', 'adjustment', etc.
  reference_id UUID,
  performed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Intentionally no updated_at: ledger rows are immutable after insert
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON inventory_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_inventory_item_id ON stock_batches(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_item_id ON stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);
