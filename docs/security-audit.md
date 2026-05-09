# Security, Privacy, and Audit Controls

Healthcare software must be able to answer: who accessed what, when, from where, and what did they change?

## Authentication

- Strong password policy
- MFA for admin, manager, doctor, HR, and finance users
- OTP for patient portal access
- Session timeout
- Device and session tracking
- Failed login lockout
- Rate limiting for login, OTP, and password reset

## Authorization

- Role-based access control
- Branch-based access
- Department-based access
- Patient assignment-based access
- Approval-based access
- Break-glass emergency access with temporary permission and required reason

## Audit Log Minimum Fields

- id
- user_id
- user_role
- tenant_id
- branch_id
- module
- action
- record_type
- record_id
- old_values
- new_values
- ip_address
- device_info
- reason
- created_at

## Audit Actions to Track

- Login, logout, and failed login
- Patient viewed and edited
- Report exported
- Result encoded, approved, released, and amended
- Payment created, voided, and refunded
- Discount applied
- Inventory adjusted
- User role changed
- Document printed or downloaded

## Data Protection Rules

- Encrypt traffic in transit.
- Encrypt sensitive data and backups at rest.
- Keep file storage private.
- Use signed temporary download URLs.
- Log downloads and print actions.
- Enforce data retention policy.
- Never expose public file paths containing patient details.

## Messaging Privacy

Email and SMS may notify, but must not expose medical content. Sensitive content stays inside the secured portal.

Examples:

| Unsafe | Safer |
| --- | --- |
| Your HIV test result is ready. | A new secure document is available in your patient portal. |
| CBC result: Hemoglobin 13.5. | Your laboratory result is available. Please log in securely. |
| Diagnosis: pneumonia. | A secure clinical document is available for review. |

## Implemented Prototype Safeguards

- High-risk demo roles require MFA before login.
- Permission checks are centralized in the client-side prototype for patient, billing, lab, inventory, HR, report, notification, backup, and audit actions.
- Denied permissions create audit records instead of failing silently.
- Sensitive actions use reason-required confirmation modals.
- Very risky actions require a keyword, such as `VOID` or `AMEND`.
- Maker-checker approvals prevent requesters from approving their own requests.
- Result print/download is blocked until release.
- Result-ready notifications are blocked until release and use privacy-safe text.
- Sensitive exports require a reason and are audit-logged.
- Runtime UI errors are logged to the audit trail in the prototype.
- Production rule tests cover tenant isolation, branch isolation, immutable audit payloads, idempotency keys for payment writes, notification privacy, and feature flag gating.

These controls are prototype-level safeguards. A production implementation must enforce the same rules again on the server, in the database, and at the file storage boundary.

## Production Additions

- Add `tenant_id` scoping for SaaS-owned data and reject cross-tenant reads/writes.
- Require `Idempotency-Key` for payment, refund, void, result release, inventory movement, export, import, and backup/restore writes.
- Store API tokens hashed with explicit scopes and tenant ownership.
- Store integration, webhook, email, SMS, failed-job, backup, and system-health logs.
- Mask patient identity on public QR verification and lower-privilege report views.
- Enforce private file storage with signed URLs and download/print audit logs.

## Testing Requirements

- Receptionist cannot approve lab results.
- Cashier cannot amend diagnosis or lab result.
- Med-tech cannot refund payment.
- Patient cannot view another patient's result.
- Released result cannot be edited without amendment.
- Voided order cannot be paid.
- Expired inventory cannot be issued without override.
- Cashier cannot approve own refund.
- Report export is logged and permission-checked.

Run `npm test` to check the implemented rule helpers and static action wiring. Browser/UAT testing should still walk through each role because UI tests do not replace server-side authorization tests in production.
