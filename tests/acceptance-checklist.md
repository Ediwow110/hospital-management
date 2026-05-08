# Acceptance Test Checklist

Use this checklist for UAT and regression testing against the blueprint.

## Demo Workflow

- [ ] Staff user signs in with MFA requirement visible.
- [ ] Receptionist registers a patient.
- [ ] System creates a patient number in `P-YYYY-000001` format.
- [ ] Staff creates a CBC order.
- [ ] System creates an order number in `ORD-YYYY-000001` format.
- [ ] Cashier posts a payment.
- [ ] System creates an invoice and receipt number.
- [ ] Queue ticket is created after payment.
- [ ] Med-tech encodes result values.
- [ ] Authorized approver validates and approves the result.
- [ ] Result print preview shows lab number and QR verification placeholder.
- [ ] Sales report updates are visible.
- [ ] Audit log records each sensitive action.

## Permission Tests

- [ ] Receptionist cannot approve lab result.
- [ ] Cashier cannot amend diagnosis or lab result.
- [ ] Med-tech cannot refund payment.
- [ ] Patient cannot view another patient's result.
- [ ] Released result cannot be edited without amendment request.
- [ ] Cashier cannot approve their own refund.
- [ ] User cannot approve their own void, discount, amendment, inventory adjustment, merge, or role-change request.
- [ ] Report export is permission-checked and audit-logged.

## Billing Tests

- [ ] Payment cannot exceed invoice balance unless overpayment is enabled.
- [ ] Voided order cannot be paid.
- [ ] Paid invoice is locked.
- [ ] Receipt numbers are never reused.
- [ ] Price changes do not alter historical invoices.

## Laboratory Tests

- [ ] Lab order follows Pending Collection -> Collected -> Received -> Processing -> Encoded -> Validated -> Approved -> Released.
- [ ] Released result cannot be directly edited.
- [ ] Amendment creates a new result version and supersedes the prior version.
- [ ] Critical result requires notification and acknowledgement.
- [ ] Result download or print is audit-logged.

## Inventory Tests

- [ ] Receiving captures supplier, batch number, expiry date, quantity, and receiving staff.
- [ ] Expired stock cannot be issued without override.
- [ ] Inventory adjustment requires reason and approval.
- [ ] Low stock and expiring stock alerts appear on dashboards and reports.

## Security Tests

- [ ] Login, logout, and failed login are audit-logged.
- [ ] Patient view and edit actions are audit-logged.
- [ ] Sensitive exports require permission and reason.
- [ ] Email/SMS notifications do not expose medical content.
- [ ] Private files are not exposed through public patient-detail URLs.
- [ ] Backup exists before production deployment.

## UI Wiring Tests

- [ ] Every visible button either performs a workflow action, opens a screen/modal, submits a form, or is disabled when unavailable.
- [ ] Global search moves to the patient list and filters matching records.
- [ ] Patient list filters by status and search term.
- [ ] Document preview, QR verification, print, export, notification, and health check actions create audit entries.
- [ ] Permission-denied actions display a visible message and create an audit entry.

## Automated Regression

- [ ] `npm test` passes.
- [ ] JavaScript syntax check passes with `node --check assets/js/app.js`.
- [ ] Static action wiring check reports no missing `data-action` handlers.
- [ ] SQL files pass basic quote and parenthesis balance checks.
