-- Migration 004: Orders, Billing, Cashier Sessions
-- Depends on: 001, 002, 003

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  order_no TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('lab','radiology','pharmacy','procedure','package','consult')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','in_progress','completed','cancelled','voided')),
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  requesting_provider_id UUID REFERENCES users(id),
  department TEXT,
  notes TEXT,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  voided_by UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_no)
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  item_code TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  discount NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  order_id UUID REFERENCES orders(id),
  invoice_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','partial','paid','cancelled','written_off')),
  subtotal NUMERIC(14,4) NOT NULL DEFAULT 0,
  discount_total NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(14,4) NOT NULL DEFAULT 0,
  grand_total NUMERIC(14,4) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PHP',
  notes TEXT,
  issued_at TIMESTAMPTZ,
  due_date DATE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  order_item_id UUID REFERENCES order_items(id),
  description TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,4) NOT NULL,
  discount NUMERIC(14,4) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cashier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  session_no TEXT NOT NULL,
  cashier_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Closed')),
  opening_cash NUMERIC(14,4) NOT NULL DEFAULT 0,
  expected_cash NUMERIC(14,4),
  actual_cash NUMERIC(14,4),
  cash_variance NUMERIC(14,4),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id),
  close_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, session_no)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  cashier_session_id UUID REFERENCES cashier_sessions(id),
  payment_no TEXT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','gcash','maya','hmo','check','transfer','other')),
  amount NUMERIC(14,4) NOT NULL CHECK (amount > 0),
  reference_no TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','voided')),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  voided_by UUID REFERENCES users(id),
  posted_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payment_no)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_patient_id ON orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_cashier_id ON cashier_sessions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_status ON cashier_sessions(status);
