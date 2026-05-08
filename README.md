# Hospital Management System

A workflow-first healthcare operations platform for patient management, diagnostics, billing, inventory, reporting, permissions, and auditability.

This repository is initialized from the Hospital Management System all-in-one blueprint dated 2026-05-08.

## What Is Implemented Now

This implementation converts the blueprint into a static, testable HMS prototype plus database and implementation artifacts:

- Bootstrap 5 staff interface covering the first screens plus inventory, HR/access, approvals, notifications, patient portal, cashier closing, settings, backup, and health views
- Controlled demo flow for registration -> order -> billing/payment -> queue -> specimen custody -> result encoding/validation/approval/release -> QR/print preview -> reports/audit
- Client-side permission, workflow, approval, notification, audit, payment, and inventory guardrails for prototype validation
- PostgreSQL schema for the first required tables, next-priority operational tables, and expanded blueprint domains
- Seed data for roles, granular permissions, demo users, services, packages, inventory, providers, report catalog, templates, and numbering sequences
- Node-based regression tests for critical business rules and unwired static actions

## First Screens Covered

1. Login
2. Main dashboard
3. Patient list
4. Register patient
5. Patient profile
6. Create order
7. Billing/payment screen
8. Queue monitor
9. Lab result encoding
10. Result print preview

The static app also includes reports, audit log, approval center, inventory basics, HR offboarding/access, privacy-safe notifications, patient portal, cashier closing, settings, backup, and health screens because the blueprint treats those as workflow or governance requirements.

## Repository Structure

```text
.
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/app.js
├── database/
│   ├── schema.sql
│   └── seed.sql
├── docs/
│   ├── blueprint-implementation.md
│   ├── security-audit.md
│   └── workflows.md
└── tests/
    └── acceptance-checklist.md
```

## Running The Prototype

Open `index.html` in a browser. The prototype uses Bootstrap Icons, Bootstrap, and Chart.js from CDN.

Use the seeded login values shown on the screen:

- Email: `admin@hospital.local`
- Password: `HmsDemo2026!`
- Demo role: `Admin / Super Admin`

Then select **Run CBC demo** or manually follow this flow:

1. Register patient
2. Create CBC order
3. Accept payment
4. Print queue ticket
5. Encode result
6. Validate result
7. Approve result
8. Print result preview
9. View reports
10. View audit log

## Tests

Run the rule and wiring checks with:

```bash
npm test
```

The tests cover numbering formats, permission denials, maker-checker approval rules, controlled laboratory transitions, overpayment blocking, status class mapping, inventory status rules, and static `data-action` button wiring.

## Database

The schema is written for PostgreSQL 15+ and includes:

- First required tables: users, roles, permissions, patients, services, orders, order_items, invoices, payments, audit_logs
- Supporting access tables: branches, role_permissions, user_roles
- Next priority tables: lab_orders, specimens, lab_results, lab_result_items, inventory_items, stock_batches, stock_movements, employees, notifications, approval_requests, settings, files
- Expanded blueprint domains: departments, rooms, appointments, queue tickets, encounters, vitals, clinical notes, diagnoses, prescriptions, products, packages, price versions, discounts, refunds, cashier sessions, suppliers, purchase requests, purchase orders, receiving records, attendance, leave, training, licenses, templates, reports, imports, backups, and health checks

Important constraints are represented in the schema, including soft-delete fields, audit fields, locked invoices/results, versioned prices/packages, private files, specimen chain of custody, cashier closing, backup jobs, and maker-checker checks that prevent users from approving their own requests.

## Build Rules From The Blueprint

- Workflow-first, not feature-first.
- Roles are permission bundles, not hard-coded behavior.
- No permanent deletion for sensitive clinical, billing, inventory, HR, or audit records.
- Sensitive edits require permission, reason, and audit logging.
- Released lab results cannot be edited directly; amendments create new versions.
- Email/SMS notifications must not expose medical content.
- Paid invoices and issued receipts are locked.
- Production deployment requires backup and rollback planning.

## Delayed Features

The blueprint intentionally delays AI assistant features, free-form chat, video calls, full payroll, full accounting/general ledger, and full laboratory machine integration until the core workflows, permissions, audits, portal, and reporting are stable.
