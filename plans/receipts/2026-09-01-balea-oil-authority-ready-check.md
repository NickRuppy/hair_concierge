# Balea and Oil authority ready-check receipt

- Branch: `codex/balea-urea-everyday-protocol`
- Base: `7fddf869` (`origin/main` after PR #495)
- Reviewed functional head: `aabfb89e`
- Functional content fingerprint: `25c3bb4e1e3c091f60ebc979812d2e9ef0572ee8ada202c5f043965ddfe57628`

The fingerprint covers the sorted path-and-content-hash manifest for all 27 changed functional, data, migration, plan and verification paths against the recorded base. This receipt and the final code-review receipt are excluded from their own fingerprint.

## Outcomes checked

- Balea 2 in 1 Urea 5% receives one exact ordinary `shampoo_everyday` protocol without claiming literal daily frequency.
- The generated Stage 5 V2 artifact contains 308 reviewed and composable rows, including the approved K18 live carry-forward and 17 Oil authority inserts plus one exact replacement.
- The disposition-resolution path is service-role-only, exact-state guarded and transactionally locked. Duplicate product resolutions are rejected before apply, and a blocked dry run exits nonzero.
- The already-applied disposition-resolution migration is aligned with production migration version `20260901140744`.
- The Oil V2 reconciliation remains fail-closed after an Oil authority receipt, while a fresh database with neither protocol nor receipt safely replays the migration as a no-op.
- CI now verifies the generated Stage 5 application artifact is fresh. The Postgres harness validates the real batch-body SHA-256 instead of a constant digest stub.
- Live read-only production checks confirmed the disposition-resolution function is owned by `postgres`, has the required table privileges, and is executable only by `service_role` among application roles.

## Fresh verification

- `npm run test:personal-plan-stage5` — 288/288 passed.
- `npm run typecheck` — passed.
- `npm run personal-plan:application-audit` — 308/308 composable, zero blockers.
- `npm run lint` — zero errors; five pre-existing repository warnings.
- `git diff --check` — passed.

## Release gate

This branch is review-ready, not production-applied. Merge does not itself authorize the ordered production writes: Oil authority reconciliation, Balea protocol apply, Stage 5 V2 artifact apply, exact disposition resolution and subsequent barcode backfills remain separately fingerprinted, preflighted steps.
