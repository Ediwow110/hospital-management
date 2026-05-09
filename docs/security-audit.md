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

These controls are prototype-level safeguards. A production implementation must enforce the same rules again on the server, in the database, and at the file storage boundary.

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


## PR #9: Tenant Repository Hardening & DB-Level Clinical/Financial Guards

**Scope**: Tenant isolation and database-level data integrity across the persistence layer.

**Status**: Tenant-hardened staging foundation. Not production-ready.

### Implemented and Verified

- **Tenant-scoped repository lookups**: All repository `findById`, `findByMRN`, `findByInvoiceNumber`, `findByOrderNumber`, `findByReceiptNumber`, `findByLabNumber`, `findByItemCode` methods require `context.tenantId` and throw `PERMISSION_DENIED` for cross-tenant access. Missing `tenantId` throws `VALIDATION_ERROR`.

- **Cross-tenant isolation tests**: `tests/tenant.test.js` verifies that tenantA cannot access tenantB records across all domains: patients, orders, invoices, payments, cashier sessions, lab results, inventory, approvals, notifications.

- **Lab result immutability (app-layer)**: `InMemoryLabResultRepository.save()` throws `RECORD_LOCKED` with marker `released_lab_result_immutable` when attempting to directly update a lab result with status `Released`. Amendment workflow via `saveVersion()` is the safe path.

- **Lab result immutability (DB-level)**: Migration `009_tenant_db_guards.sql` adds PostgreSQL trigger `prevent_released_lab_result_update()` that blocks direct UPDATE of lab_results rows where `OLD.status IN ('Released', 'released', 'APPROVED_RELEASED')`. Raises exception `released_lab_result_immutable`.

- **Payment idempotency**: Migration adds `idempotency_key` column to `payments` table with unique index on `(tenant_id, invoice_id, idempotency_key)` to prevent double-submit.

- **Invoice overpayment guard (DB-level)**: Migration adds PostgreSQL trigger `prevent_invoice_overpayment()` that locks the invoice row (`FOR UPDATE`), sums existing Posted payments, and raises exception `invoice_overpayment` if new payment would exceed `balance_due`.

- **Cashier session locking (DB-level)**: Migration adds PostgreSQL trigger `prevent_double_cashier_session_close()` that raises exception `cashier_session_already_closed` if attempting to close an already-closed session.

- **role_permissions table**: Migration creates `role_permissions` table with `(tenant_id, role_name, permission)` uniqueness and seeds baseline permissions for HMS roles (admin, doctor, nurse, cashier, receptionist, manager).

- **Tenant-scoped uniqueness**: Migration enforces unique indexes on `(mrn, tenant_id)`, `(invoice_no, tenant_id)`, `(lab_no, tenant_id)` to prevent cross-tenant key collisions.

- **Architecture guardrails**: `tests/tenant.test.js` verifies that no service imports `pg` directly and no service contains raw SQL (excluding comments).

- **Test coverage**: `tests/tenant.test.js` runs cross-tenant isolation tests for all repository domains, missing tenantId safety, lab result immutability, payment/cashier concurrency contract validation, and architecture guardrails.

### Known Production Gaps (Required Before Production)

- **PostgreSQL repository implementations**: All repositories are in-memory only. Full PostgreSQL implementations with the same tenant-scoped guarantees are deferred to PR #4.

- **PostgreSQL integration tests**: Concurrency tests for payment double-submit, cashier concurrent close, and lab result trigger immutability require a real PostgreSQL instance. Deferred to PR #4.

- **MFA / OTP**: Not implemented. Required for admin, manager, doctor, HR, and finance roles before production.

- **Refresh tokens**: No refresh token rotation. Access tokens expire but cannot be renewed without re-login. Implement refresh token with revocation before production.

- **Encryption at rest**: PHI fields (patient name, DOB, contact) are not encrypted at rest. Required before production.

- **TLS enforcement**: Must be enforced at the reverse proxy / load balancer level before production. Not configured in this PR.

- **HIPAA / data retention policy**: Audit log retention and purge policy not implemented. Required before production deployment in healthcare context.

- **Break-glass emergency access**: Not implemented. Required for clinical emergency workflows.

- **Automated secret rotation**: `JWT_SECRET` rotation without downtime not implemented. Required for production key management.

- **Distributed rate-limit store**: Login rate limiting is in-memory only. Distributed store (Redis) required for multi-instance production deployment.

- **Full backup/restore drill**: Not implemented. Required for production disaster recovery.
