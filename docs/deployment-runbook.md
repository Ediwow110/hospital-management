# Production Deployment Runbook

This runbook turns the production blueprint deployment section into an executable release checklist.

## Environments

- `local`: developer-only, non-production data.
- `development`: shared integration environment.
- `staging`: production-like data shape, production-like integrations in sandbox mode.
- `production`: live tenant data.
- `backup-restore`: isolated restore verification environment.

## Pre-Deployment Gates

1. Release notes are written and include migration impact.
2. Database migration has been reviewed and has a rollback path.
3. Current production backup is completed, encrypted, and recorded.
4. Latest backup has a documented restore test.
5. Maintenance mode decision is recorded for disruptive releases.
6. Feature flags for new modules are reviewed by tenant and edition.
7. Smoke test plan is ready.
8. On-call owner and rollback owner are assigned.

## Deployment Steps

1. Enable maintenance mode if the migration or release is disruptive.
2. Run database backup.
3. Run migrations through the migration tool only.
4. Deploy application build.
5. Restart queue workers.
6. Verify background jobs can process email, SMS, PDF, export, import, and backup jobs.
7. Disable maintenance mode after smoke tests pass.
8. Monitor errors, failed jobs, backups, integrations, report exports, and login attack indicators.

## Post-Deployment Smoke Tests

- Login succeeds for MFA and non-MFA staff roles.
- Permission-denied paths are visible and audit-logged.
- Patient registration creates patient number and timeline event.
- Order creation locks service price/version.
- Payment posting creates receipt and blocks duplicate idempotency key.
- Receipt print is audit-logged.
- Queue ticket can be called and completed.
- Specimen can move through collection and receipt.
- Result can be encoded, validated, approved, released, and printed.
- Released result cannot be edited directly.
- Report export creates a background job and audit record.
- Email/SMS result-ready notification contains no medical result details.
- Backup status and failed jobs appear on system health.

## Rollback Rules

- Roll back application code first if the database remains compatible.
- If migration rollback is required, take a fresh backup before rollback.
- Never edit production data manually without an approved correction script.
- Record rollback reason, owner, affected tenants, and audit evidence.

## Go / No-Go Criteria

No-go if any of these are true:

- Backup failed or restore status is unknown.
- Migration failed or rollback path is not verified.
- Billing totals do not reconcile.
- Released lab result can be edited directly.
- Permission checks fail for critical roles.
- Audit logs do not capture sensitive actions.
- Patient portal or QR verification exposes medical content publicly.
- Queue workers or failed-job monitoring are unavailable.
