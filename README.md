# Hospital Management System

A workflow-first healthcare operations platform for patient management, diagnostics,
billing, inventory, reporting, permissions, and auditability.

---

## Current State: PostgreSQL Persistence Foundation (PR #4)

PR #3 introduced the production-grade backend foundation:
8-service architecture (`AuditService`, `AuthService`, `BillingService`, `HealthService`,
`InventoryService`, `LabService`, `OrderService`, `PatientService`, `QueueService`),
repository contracts, in-memory dev/test adapter, `AppContext`, `AppError`/error catalog,
permission constants, workflow/status guards, and backend tests.

PR #4 adds the PostgreSQL persistence foundation on top of PR #3:
- Migrations 001–007 (forward-only, no DROP TABLE in forward migrations)
- Infrastructure layer: `db-pool`, `transaction`, `adapter-factory`, `migrate`
- Dedicated Pg repositories for core paths: `PgUserRepository`, `PgAuditLogRepository`, `PgLabResultRepository`
- Contract-compatible Pg stubs for remaining namespaces (require follow-up hardening)
- Append-only `audit_logs` (DB trigger rejects UPDATE and DELETE)
- Tenant-scoped user lookup (missing `tenantId` throws `validation_error`)
- PostgreSQL CI service with `pg_isready` health check and migration step
- Integration tests against live PostgreSQL

> **This system is NOT production-ready.**
> It is a staging-ready PostgreSQL persistence foundation.
> See `migrations/README.md` for the full list of hardening items required before production use.

---

## What Is Implemented

- Bootstrap 5 staff interface covering registration → order → billing/payment → queue
  → specimen custody → result encoding/validation/approval/release → QR/print preview
  → reports/audit
- Production-level additions from the Strong Production-Level Plan: patient identity
  headers, tenant/SaaS tables, feature flags, API handoff, production rule tests,
  and deployment acceptance gates
- Service-layer production rule module `src/core/production-rules.js` for tenant
  isolation, approval, workflow, payment, notification, and audit checks
- Dependency-injected Node backend: 8 individual service files, repository contracts,
  in-memory dev/test store, and Express API adapter
- Machine-readable production API contract: `api/production-openapi.json`
- Machine-readable permission matrix: `docs/permission-matrix.json`
- Deployment and rollback runbook: `docs/deployment-runbook.md`
- PostgreSQL migrations 001–007 (forward-only raw SQL)
- Node-based regression tests for critical business rules, architecture guardrails,
  workflow guards, and PostgreSQL integration

---

## Repository Structure

```text
.
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/app.js
├── api/
│   └── production-openapi.json
├── database/
│   ├── schema.sql              -- reference only (not applied by migration runner)
│   └── seed.sql                -- reference only
├── migrations/
│   ├── 001_platform_tenants.sql
│   ├── 002_access_users_roles.sql
│   ├── 003_patients_appointments_queue.sql
│   ├── 004_orders_billing.sql
│   ├── 005_laboratory.sql
│   ├── 006_inventory.sql
│   └── 007_governance.sql
├── src/
│   ├── api/
│   │   ├── router.js
│   │   └── server.js
│   ├── core/
│   │   ├── AppContext.js
│   │   ├── AppError.js
│   │   ├── app-error.js
│   │   ├── passwords.js
│   │   ├── permissions.js
│   │   ├── production-rules.js
│   │   └── validation.js
│   ├── infrastructure/
│   │   ├── adapter-factory.js
│   │   ├── db-pool.js
│   │   ├── in-memory-store.js
│   │   ├── migrate.js
│   │   └── transaction.js
│   ├── repositories/
│   │   ├── interfaces.js
│   │   ├── in-memory-repositories.js
│   │   ├── pg-repositories.js
│   │   └── pg/
│   │       ├── PgUserRepository.js
│   │       ├── PgAuditLogRepository.js
│   │       └── PgLabResultRepository.js
│   └── services/
│       ├── AuditService.js
│       ├── AuthService.js
│       ├── BillingService.js
│       ├── HealthService.js
│       ├── InventoryService.js
│       ├── LabService.js
│       ├── OrderService.js
│       ├── PatientService.js
│       └── QueueService.js
├── docs/
│   ├── blueprint-implementation.md
│   ├── deployment-runbook.md
│   ├── permission-matrix.json
│   ├── production-technical-spec.md
│   ├── security-audit.md
│   └── workflows.md
└── tests/
    ├── acceptance-checklist.md
    ├── api-workflow.test.js
    ├── architecture-foundation.test.js
    ├── backend.test.js
    ├── integration.test.js
    ├── production-coverage.test.js
    ├── production-rules.test.js
    └── rules.test.js
```

---

## Running The Static Interface

Open `index.html` in a browser. Uses Bootstrap Icons, Bootstrap, and Chart.js from CDN.

Demo login values shown on screen:
- Email: `admin@hospital.local`
- Password: `HmsDemo2026!`
- Demo role: `Admin / Super Admin`

Demo flow:
1. Register patient → 2. Create order → 3. Accept payment → 4. Print receipt
→ 5. Print queue ticket → 6. Encode result → 7. Validate result
→ 8. Approve result → 9. Release and print result → 10. View reports → 11. View audit log

---

## Running The API Backend

```bash
npm install
npm run start:api
```

Default adapter: in-memory (dev/test only).
Set `STORAGE_ADAPTER=postgres` and `DATABASE_URL` to use PostgreSQL.

---

## Running Migrations

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/hms
npm run migrate
```

---

## Tests

```bash
# Syntax checks
npm run check

# Unit + workflow + architecture tests (no DB required)
npm test

# PostgreSQL integration tests (requires DATABASE_URL)
npm run test:integration
```

---

## Build Rules

- Workflow-first, not feature-first.
- Roles are permission bundles, not hard-coded behavior.
- No permanent deletion for sensitive clinical, billing, inventory, HR, or audit records.
- Sensitive edits require permission, reason, and audit logging.
- Released lab results cannot be edited directly; amendments create new versions.
- Email/SMS notifications must not expose medical content.
- Paid invoices and issued receipts are locked.
- Production deployment requires backup and rollback planning.

## Delayed / Out of Scope

AI assistant features, free-form chat, video calls, full payroll, full
accounting/general ledger, and full laboratory machine integration are intentionally
delayed until core workflows, permissions, audits, portal, and reporting are stable.
