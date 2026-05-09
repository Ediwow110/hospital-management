## HMS PR Merge Gate

Before merging a major HMS change, confirm each gate or explain why it is not applicable.

- [ ] `npm run check` passes.
- [ ] `npm test` passes.
- [ ] SQL sanity is clean: migrations/schema parse and required tables, foreign keys, audit fields, and non-hard-delete controls are present where applicable.
- [ ] HTML wiring is clean: critical screens exist, navigation links resolve, and dangerous-action modals are connected.
- [ ] OpenAPI parses and executable routes are represented.
- [ ] Permission checks are explicit for every write/action endpoint touched by this PR.
- [ ] Audit assertions exist for sensitive patient, billing, LIS, inventory, HR, report export, or admin behavior touched by this PR.
- [ ] Idempotent writes have route/user/branch/tenant scoped idempotency behavior where applicable.
- [ ] Billing, lab result release/amendment, inventory movement, approval decisions, and role/security changes have typed failure paths.

Do not claim this HMS is production-ready unless persistence, security hardening, staging deployment, backup/restore, rollback, and smoke tests are proven for the target environment.
