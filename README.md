# Hospital Management System

A workflow-first healthcare operations platform for patient management, diagnostics, billing, inventory, reporting, permissions, and auditability.

This repository is initialized from the Hospital Management System all-in-one blueprint dated 2026-05-08.

## What Is Implemented Now

This first commit set establishes the project foundation requested by the blueprint:

- Static Bootstrap 5 staff interface for the first screens
- Interactive demo flow for patient registration to CBC result print preview
- PostgreSQL schema for first required tables and next-priority operational tables
- Seed data for roles, granular permissions, starter services, and numbering prefixes
- Documentation for implementation scope, workflows, security, audit controls, and acceptance tests

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

The static app also includes reports and audit log screens because the blueprint makes those MVP requirements.

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

Use the seeded login values shown on the screen, then select **Run CBC demo** or manually follow this flow:

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

## Database

The schema is written for PostgreSQL 15+ and includes:

- First required tables: users, roles, permissions, patients, services, orders, order_items, invoices, payments, audit_logs
- Supporting access tables: branches, role_permissions, user_roles
- Next priority tables: lab_orders, lab_results, lab_result_items, inventory_items, stock_movements, approval_requests, notifications, settings

Important constraints are represented in the schema, including soft-delete fields, audit fields, locked invoices/results, and maker-checker checks that prevent users from approving their own requests.

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
