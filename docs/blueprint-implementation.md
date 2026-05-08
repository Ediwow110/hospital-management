# Hospital Management System Blueprint Implementation

Source blueprint: Hospital Management System All-in-One Product, Technical, UI/UX, Security, and Implementation Blueprint, v1.0, 2026-05-08.

## Product Direction

This project is a workflow-first healthcare operations platform. It must prioritize patient flow, financial control, clinical traceability, inventory control, compliance, auditability, and management visibility.

The system must avoid uncontrolled free-form chat, video calls, AI diagnosis, hard-coded pricing, shared generic accounts, and permanent deletion of sensitive records.

## MVP Scope

The first releasable version must include:

- Patient management
- Services and packages
- Orders
- Billing and cashier payments
- Queueing
- Laboratory result encoding and printing
- Inventory basics
- Sales reports
- User roles and granular permissions
- Audit logs

The MVP must not include AI assistant features, free-form chat, video calls, full payroll, full accounting/general ledger, or full laboratory machine integration.

## Phase Roadmap

| Phase | Focus | Included capabilities |
| --- | --- | --- |
| 0 | Foundation | Authentication, roles, permissions, branches, audit engine, numbering engine, file storage, notifications, settings, backup, error logging |
| 1 | Revenue Core / MVP | Patient registration, services/packages, orders, billing, payments, receipt printing, sales reports, basic queueing |
| 2 | Laboratory Core | Lab orders, specimen collection, result encoding, validation, approval, release, QR verification, amendments |
| 3 | Operations Core | Inventory, procurement, referral management, approval center, notifications, reports and analytics |
| 4 | Clinical Core | EMR, vitals, doctor notes, prescriptions, certificates, patient portal |
| 5 | Enterprise Core | HR, attendance, multi-branch, corporate/HMO billing, integrations, system health monitoring |

## First Screens

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

## First Demo Script

1. Register patient
2. Create CBC order
3. Accept payment
4. Print queue ticket
5. Collect sample
6. Encode result
7. Approve result
8. Print result with QR
9. View sales report
10. View audit log

## Implemented Prototype Controls

The static app now implements the blueprint as workflow simulation rather than raw CRUD:

- Login enforces strong demo password length and MFA for high-risk roles.
- Role permissions are checked before sensitive patient, billing, laboratory, inventory, HR, report, backup, and notification actions.
- Global search, patient filters, report exports, audit filters, queue actions, result print/verification, notification actions, and settings buttons are wired.
- Sensitive actions require a reason through a confirmation modal: void, refund, merge, archive, result amendment, inventory adjustment, HR offboarding, backup restore, and sensitive exports.
- Maker-checker approvals prevent a requester from approving their own refund, void, amendment, inventory adjustment, merge, or role/access change.
- Payment posting blocks overpayment unless the explicit overpayment setting is enabled, locks paid invoices, and creates queue tickets only after full payment.
- Laboratory status transitions are controlled: Pending Collection -> Collected -> Received -> Processing -> Encoded -> Validated -> Approved -> Released.
- Released results are locked; amendment approval creates a new version and marks the prior result superseded.
- Result-ready notifications are privacy-safe and blocked until release.
- Inventory receiving captures supplier, batch, expiry, and quantity; expired stock issue is blocked without override workflow.
- HR offboarding routes through access deactivation approval.
- Audit logging records login/logout, permission denials, patient access, billing events, lab workflow events, exports, prints, downloads, notifications, backup, and health checks.

## Roles

Roles are permission bundles, not hard-coded logic. Clinical access for administrators is still audited.

| Role | Primary access |
| --- | --- |
| Client / Patient | Own portal only: appointments, queue, billing, released documents, own/dependent records |
| Receptionist | Patient registration, appointments, queue, basic orders, basic profile updates |
| Cashier | Invoices, payments, receipts, cashier sessions; no clinical result editing |
| Nurse / Clinical Staff | Vitals, nursing notes, assigned patient data |
| Doctor | Encounters, notes, diagnosis, prescriptions, order requests, own patients |
| Med-Tech | Sample collection/receiving, result encoding, laboratory workflow |
| Pathologist / Lab Approver | Validate, approve, release, and amend lab results under policy |
| Radiology Staff | Imaging workflow, technician notes, report handling |
| Pharmacist | Dispensing, medication stock, returns, pharmacy reports |
| Inventory Staff | Stock movement, receiving, physical count, purchase requests |
| HR Staff / HR Manager | Employees, attendance, leave, licenses, training, offboarding |
| Manager / Branch Manager | Reports, approvals, operational dashboards, exception reviews |
| Admin / Super Admin | Configuration, roles, branches, settings, system controls |

## Granular Permission Examples

- patient.view
- patient.create
- patient.update
- patient.archive
- patient.merge.request
- patient.merge.approve
- order.create
- order.void.request
- order.void.approve
- order.discount.apply
- order.discount.approve
- lab.result.encode
- lab.result.validate
- lab.result.approve
- lab.result.release
- lab.result.amend.request
- lab.result.amend.approve
- billing.payment.create
- billing.payment.void.request
- billing.payment.void.approve
- billing.refund.request
- billing.refund.approve
- cashier.close
- inventory.receive
- inventory.transfer
- inventory.adjust.request
- inventory.adjust.approve
- report.view
- report.export
- audit.view
- user.role.change.request
- user.role.change.approve

Hard rule: a user cannot approve their own request. This applies to refunds, voids, discounts, amendments, inventory adjustments, patient merges, and role changes.

## Governance Engines

The codebase should keep these engines explicit and reusable:

- Permission engine
- Audit engine
- Approval engine
- Notification engine
- Numbering engine
- Template engine
- Workflow/status engine
- Reporting engine
- File management engine
- Settings engine
- Backup engine

## Database Coverage

The PostgreSQL schema covers the first required tables and the blueprint expansion areas:

- Access and configuration: users, roles, permissions, role permissions, user roles, branches, departments, rooms, settings, numbering sequences.
- Patient flow: patients, contacts, identifiers, consents, documents, appointments, queue tickets.
- Revenue cycle: services, products, packages, package items, price versions, orders, order items, invoices, payments, discounts, refunds, cashier sessions.
- LIS: lab orders, specimens, lab results, lab result items, lab approvals, result amendments.
- Inventory and procurement: inventory items, stock batches, stock movements, suppliers, purchase requests, purchase orders, receiving records.
- HR: employees, shifts, attendance logs, leave requests, training records, license records.
- Communications and files: notifications, email templates, SMS templates, notification logs, files.
- Governance and operations: approval requests, audit logs, reports, imports, backup jobs, system health checks.

The schema intentionally keeps price/package versions, locked financial documents, private file references, soft-delete fields, reason fields, and maker-checker constraints visible because those are failure-prone healthcare controls.

## Required Business Rules

- A released lab result cannot be edited directly.
- A payment cannot exceed invoice balance unless overpayment is enabled.
- A voided order cannot be paid.
- A cashier cannot approve their own refund.
- A med-tech cannot approve their own result if dual approval is enabled.
- A service price change does not affect existing orders.
- A patient merge requires approval.
- No sensitive action can bypass audit logging.
- No production deployment can proceed without a backup.

## Regression Guardrails

`npm test` executes focused checks for:

- Race-safe number format helpers used by the prototype.
- Role permission denials for receptionist, cashier, manager, and super admin paths.
- Maker-checker self-approval blocking.
- Laboratory workflow transition restrictions.
- Payment balance and voided invoice restrictions.
- Inventory status calculation.
- Static button/action wiring, so visible buttons do not silently do nothing.

## Reason-Required Actions

- Void order/payment
- Refund
- Manual discount
- Edit patient identity
- Merge patient
- Reject sample
- Amend result
- Inventory adjustment
- Deactivate user
- Change user role
- Restore backup
- Export sensitive patient data
