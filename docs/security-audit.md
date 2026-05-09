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

- ## Staging Foundation — PR #5: Auth, Session & Security Hardening

This section documents what was implemented, verified, and what remains as known production gaps.

### Implemented and Verified

- **bcrypt password hashing**: `hashPassword` / `verifyPassword` via bcryptjs, salt rounds >= 12. No plaintext comparison anywhere in active code paths.
- **JWT authentication**: `signAccessToken` / `verifyAccessToken` via jsonwebtoken. Payload includes `userId`, `tenantId`, `branchId`, `roles`, `iat`, `exp`, `jti`. `jwt.decode` is not used for authentication.
- **Token revocation**: `POST /auth/logout` writes `jti` + `tenantId` to `invalidated_tokens`. Auth middleware checks revocation using tenant-scoped `isRevoked(jti, tenantId)` before granting access.
- **Rate limiting**: Login endpoint rate-limited per `tenantId:email:ip`. 5 failures within 15 minutes returns HTTP 429. Lockout writes a `LOGIN_LOCKOUT` security event.
- **Security audit events**: `SecurityAuditService` logs `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGIN_LOCKOUT`, `PERMISSION_DENIED`, `CROSS_TENANT_ACCESS_ATTEMPT`, `TOKEN_REVOKED` to in-memory store (migration to Postgres in PR #4).
- **Cross-tenant isolation**: Patient and order lookups are tenant-scoped. Cross-tenant access attempts detected via `findTenantIdByIdUnscopedForSecurityCheck` and logged as `CROSS_TENANT_ACCESS_ATTEMPT`.
- **Env validation**: `validateEnv` called before server starts. Missing, short, or placeholder `JWT_SECRET` fails hard with a non-zero exit. `DATABASE_URL` required when `STORAGE_ADAPTER=postgres`.
- **node_modules guard**: `.gitignore` excludes `node_modules/`. CI fails if any tracked `node_modules` files are detected.
- **CI security guards**: CI greps `src/` and `tests/` for demo-token patterns, plaintext password comparison, and `jwt.decode` usage in auth paths. Any match fails the build.
- **Migration**: `migrations/008_auth_security.sql` defines `invalidated_tokens` (tenant-scoped) and `security_audit_events` tables with required indexes.
- **Test coverage**: `tests/security.test.js` covers login/JWT verification, token revocation, login failure audit events, rate-limit contract, tenant isolation (IDOR), wrong-role permission denial, and cross-tenant access attempt logging.

### Known Production Gaps (Required Before Production)

- **PostgreSQL repository implementations**: All repositories are in-memory only. Postgres adapters with the same tenant-scoped guarantees are deferred to PR #4.
- **MFA / OTP**: Not implemented. Required for admin, manager, doctor, HR, and finance roles before production.
- **Refresh tokens**: No refresh token rotation. Access tokens expire but cannot be renewed without re-login. Implement refresh token with revocation before production.
- **Session device tracking**: Device fingerprint stored in audit events but not enforced as a session constraint. Full device/session management deferred.
- **Encryption at rest**: PHI fields (patient name, DOB, contact) are not encrypted at rest. Required before production.
- **TLS enforcement**: Must be enforced at the reverse proxy / load balancer level before production. Not configured in this PR.
- **HIPAA / data retention policy**: Audit log retention and purge policy not implemented. Required before production deployment in healthcare context.
- **Postgres security_audit_events persistence**: In-memory only in this PR. Must persist to Postgres with tenant_id index and retention TTL before production.
- **Break-glass emergency access**: Not implemented. Required for clinical emergency workflows.
- **Automated secret rotation**: `JWT_SECRET` rotation without downtime not implemented. Required for production key management.

Run `npm test` to check the implemented rule helpers and static action wiring. Browser/UAT testing should still walk through each role because UI tests do not replace server-side authorization tests in production.
