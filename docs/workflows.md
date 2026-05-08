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
