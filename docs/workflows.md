# Workflow and Status Lifecycles

Statuses are controlled state machines. The UI must never expose arbitrary status dropdowns for sensitive workflows.

## Lab Result Lifecycle

Pending Collection -> Collected -> Received -> Processing -> Encoded -> Validated -> Approved -> Released

Exception statuses: Rejected, Cancelled, Amended, Superseded.

Rules:

- Only med-tech or authorized lab staff can collect, receive, process, and encode.
- Validation and approval require lab approver permission.
- Released results cannot be edited directly.
- Amendments create a new version and mark the older result as superseded.
- Critical results require notification, acknowledgement, and audit logging.

## Order Lifecycle

Draft -> Pending Payment -> Paid/Partially Paid -> In Progress -> Completed

Exception statuses: Cancelled, Voided.

Rules:

- Voided orders cannot be paid.
- Sensitive status changes require reason and audit logging.
- Discounts, voids, and refunds use maker-checker approval when thresholds require it.

## Invoice Lifecycle

Draft -> Unpaid -> Partially Paid -> Paid -> Closed

Exception statuses: Refunded, Voided, Cancelled.

Rules:

- Payments cannot exceed invoice balance unless overpayment is enabled.
- Paid invoices and issued receipts are locked.
- Corrections go through void, reversal, or refund workflows.
- Receipt numbers are never reused.

## Inventory Request Lifecycle

Requested -> Reviewed -> Approved -> Ordered -> Received -> Stocked

Rules:

- Inventory adjustments require reason.
- Expired inventory cannot be issued without override.
- Receiving must capture supplier, batch number, expiry date, quantity, and receiving staff.

## Leave Request Lifecycle

Submitted -> Reviewed -> Approved/Rejected

Rules:

- Approval must be performed by an authorized user other than the requester.
- HR offboarding must trigger login deactivation and permission revocation.

## Patient Record Lifecycle

Active -> Inactive/Archived/Merged/Deceased

Rules:

- Patient identity edits require reason and audit logging.
- Patient merge requires request and approval.
- Records are archived, merged, or deactivated instead of permanently deleted.

## Critical Workflows to Implement

1. Patient registration to payment
2. Lab order to result release
3. Billing to cashier closing
4. Inventory receiving to stock issuance
5. Employee onboarding to system access
6. Result amendment flow
7. Refund and void approval flow

## Prototype Workflow Implementation

### Patient Registration to Payment

1. Reception or admin registers a patient.
2. The system generates a `P-YYYY-000001` patient number and flags duplicate risk.
3. Staff selects services or packages.
4. The system creates an order, locks service names/prices/versions into the order items, and creates an invoice.
5. Cashier posts payment.
6. The payment engine blocks overpayment unless enabled in settings.
7. Fully paid invoices are locked and trigger queue tickets for downstream services.
8. Registration, order, invoice, and payment actions are audit-logged.

### Lab Order to Result Release

1. A paid lab order creates a queue ticket.
2. Med-tech collects specimen and moves the lab order to Collected.
3. Lab receives specimen and moves it to Received.
4. Processing starts only after receipt.
5. Med-tech encodes result values.
6. Authorized lab approver validates the encoded result.
7. Authorized approver approves the validated result.
8. Authorized user releases the approved result.
9. Released result is locked, a private patient document is created, and a privacy-safe notification is queued.
10. Result print/download is allowed only after release and is audit-logged.

### Billing to Cashier Closing

1. Cashier posts payments against open invoices.
2. Paid invoices and receipts are locked.
3. Voids and refunds require reason and approval.
4. Cashier closing calculates expected cash from opening cash plus posted cash payments.
5. Closing records actual cash, short/over, remarks, and audit entry.

### Inventory Receiving to Stock Issuance

1. Inventory staff receives stock with supplier, batch, expiry, and quantity.
2. The stock engine classifies stocked, low stock, expiring, and expired items.
3. Stock issue decrements quantity only when stock exists.
4. Expired stock issue is blocked and audit-logged.
5. Inventory adjustments require reason and approval.

### Employee Offboarding to Access Revocation

1. HR requests offboarding with reason.
2. The system marks the employee as offboarding.
3. Access revocation is routed through role/access approval.
4. Approval marks the linked user inactive.
5. The offboarding request and access change are audit-logged.

### Amendment Flow

1. Released result cannot be edited.
2. Authorized requester submits amendment request with reason and `AMEND` keyword.
3. Approval creates a new result version.
4. Prior result is marked Superseded.
5. New version returns to encoded/validation/approval/release workflow.

### Refund and Void Approval Flow

1. Requester submits reason for void or refund.
2. Approval request is created.
3. The same requester cannot approve or reject their own request.
4. Authorized manager can approve or reject.
5. Approved voids update the order/invoice state; approved refunds lock the refunded invoice state.
6. Every step is audit-logged.
