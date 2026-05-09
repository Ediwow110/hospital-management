# Migrations

## Status: PR #4 (PostgreSQL Persistence Foundation)

This directory is the placeholder for PostgreSQL migration files.

**PR #3** introduces the backend runtime with in-memory storage only.
**PR #4** will add:

- A migration runner (`src/db/migrate.js`)
- Raw SQL migration files (`migrations/001_platform.sql`, etc.)
- `npm run migrate` script
- `npm run test:integration` against a real PostgreSQL instance
- `docker-compose.test.yml` for disposable test DB
- GitHub Actions CI with PostgreSQL service

## Planned Migration Files (PR #4)

```
migrations/
  001_platform.sql          -- tenants, branches, plans, feature_flags
  002_access.sql            -- users, roles, permissions, role_permissions, user_roles
  003_patients.sql          -- patients, patient_identifiers, appointments, queue_entries
  004_orders_billing.sql    -- orders, order_items, invoices, invoice_line_items, payments, cashier_sessions
  005_laboratory.sql        -- lab_results, lab_result_versions
  006_inventory.sql         -- inventory_items, stock_batches, stock_movements
  007_governance.sql        -- audit_logs (with insert-only trigger), approval_requests,
                            --   approval_decisions, notifications, notification_templates,
                            --   report_exports, settings
```

## Rules (enforced in PR #4)

- All tenant-owned business tables will have `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
- `audit_logs` will have a PostgreSQL trigger rejecting `UPDATE` and `DELETE`.
- Released lab results will be blocked by a repository-level guard in the PostgreSQL adapter.
- Stock changes will only occur through `stock_movements` rows.
- All migrations are raw SQL (no ORM auto-generation).
- Migrations run in CI (`npm run migrate` before `npm test`).

## Current State

The existing `database/schema.sql` and `database/seed.sql` are reference documents
from the static prototype phase. They are not yet applied by a migration runner.
PR #4 will formalize these into numbered migration files.
