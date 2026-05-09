# Migrations

## Status: PR #4 (PostgreSQL Persistence Foundation)

PR #4 establishes the PostgreSQL persistence foundation and adapter wiring.
Dedicated Pg repository classes are provided for core user/audit/lab paths
(`PgUserRepository`, `PgAuditLogRepository`, `PgLabResultRepository`).
Remaining repository namespaces (`patients`, `orders`, `invoices`, `payments`,
`cashierSessions`, `inventory`, `approvals`, `notifications`, `idempotency`, `roles`)
are contract-compatible Pg stubs. They satisfy repository interface contracts
but require follow-up hardening before production use.

> **This PR does NOT make the system production-ready.**
> It is a staging-ready PostgreSQL persistence foundation.

---

## Migration Files

```
migrations/
  001_platform_tenants.sql         -- tenants, branches, plans, feature_flags
  002_access_users_roles.sql       -- users, roles, role_permissions
  003_patients_appointments_queue.sql -- patients, appointments, queue_entries
  004_orders_billing.sql           -- orders, invoices, payments, cashier_sessions
  005_laboratory.sql               -- lab_orders, lab_results
  006_inventory.sql                -- inventory_items, stock_movements
  007_governance.sql               -- audit_logs (append-only trigger), approvals,
                                   --   notifications, idempotency_keys
```

## Rules

- All tenant-owned business tables have `tenant_id UUID NOT NULL REFERENCES tenants(id)`.
- `audit_logs` has a PostgreSQL trigger rejecting `UPDATE` and `DELETE` (append-only).
- Released lab result immutability is currently enforced at the application/workflow
  layer only. A DB-level trigger or constraint is required before production use.
- Stock changes occur only through `stock_movements` rows.
- All migrations are raw SQL (no ORM auto-generation).
- Forward-only migrations — no `DROP TABLE` in forward migration files.
- Migrations run in CI (`npm run migrate` before `npm run test:integration`).

---

## Follow-up Hardening Required Before Production

The following items are known production gaps. They MUST be addressed
before this system handles real patient or financial data.

- [ ] Add `tenant_id` scoping to all stub `findByIdOrNumber` queries
      (patients, orders, invoices, cashierSessions currently lack tenant filtering)
- [ ] Confirm or add `role_permissions` table migration
      (`roles.listRolePermissions` references this table — verify it is created in 002)
- [ ] Harden patient, order, invoice, payment, cashierSession, inventory Pg repositories
      (full CRUD, tenant-scoped lookups, proper error handling)
- [ ] Replace demo-token auth with signed JWT (RS256 or HS256, configurable expiry)
- [ ] Replace plaintext password comparison with bcrypt or argon2id hash verification
- [ ] Add DB-level trigger/constraint for released lab result immutability
      (currently application-layer only via workflow guard)
- [ ] Add login rate limiting (per tenant+email key, back off after N failures)
- [ ] Add environment secret validation on startup
      (system must not boot in production with default/demo secrets)
- [ ] Add IDOR and cross-tenant denial tests
      (patient A context must not fetch patient B records across all entity types)
- [ ] Add token expiry validation and session revocation support

---

## Cashier Session Close Owner Verification

`cashierSessions.findActiveByCashier` is tenant+branch+cashier-scoped:
```sql
WHERE tenant_id = $1 AND branch_id = $2 AND cashier_id = $3 AND status = 'Open'
```
A cashier can only retrieve (and therefore close) their own open session.
A different cashier in the same branch returns `null` for sessions they do not own.

---

## Audit Log Immutability

`007_governance.sql` installs a `prevent_audit_log_mutation()` trigger that raises
an exception on any `UPDATE` or `DELETE` against `audit_logs`. The integration test
suite (`tests/integration.test.js`) proves both operations are rejected by the DB.
Application code exposes only `audit.create` and `audit.searchByTenant` — no
update or delete paths exist.

---

## Released Lab Result Protection (Current Gap)

Released lab result immutability is currently enforced at the application/workflow
layer via `canTransitionLab` guards. A DB-level trigger or constraint preventing
`UPDATE` on rows with `status = 'Released'` is required before production use.
This is documented as a follow-up hardening item above.
