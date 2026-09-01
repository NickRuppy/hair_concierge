# Scanner catalog coverage — final integration review

## Scope

Exact `origin/main...HEAD` review after integrating current `main`, including scanner telemetry, E17–E19 GTIN batches, K18 readiness ordering, and the E18 oil disposition re-entry.

Canonical content fingerprint: `e37953cc19b65d63fc5bce442d01195cfb764fb006029e9b73912135743a4f6f` over the sorted 132-path manifest relative to `origin/main`, excluding this self-referential receipt.

## Counterpart review

Claude Opus 4.8 at `high` found one deploy blocker: K18 readiness and scan-event retention both used migration version `20260901090000`. The production migration ledger already contains that version for the applied K18 readiness wave, so K18 retains `20260901090000`. Nick selected the telemetry V2 policy of 30-day raw retention plus 12-month anonymous aggregates, so the redundant, unapplied 90-day anonymization migration is removed. A repository-wide uniqueness regression now prevents another duplicate version.

The review found no barcode ownership, E17–E19 executor, guarded-apply, or telemetry correctness defect. The retention-policy conflict is resolved; only the 30-day raw-event lifecycle and 12-month anonymous aggregates remain.

The focused final review found one stale launch-check query for the removed job. The runbook now verifies the surviving `scan-resolve-retention-daily-v1` job instead.

## Verification

- `npm run typecheck`
- `npm run ci:verify`: typecheck, lint with 0 errors and 5 pre-existing warnings, and production build passed
- scanner unit and migration contract suite: 128/128
- scanner identifier and disposition Postgres suite: 33/33
- K18 readiness Postgres suite: 4/4
- `npm run test:personal-plan-stage5`: 289/289
- `npm run personal-plan:application-audit`: 308/308
- Supabase migration-version uniqueness: pass
- focused final telemetry/privacy suite: 45/45
- `git diff --check`: pass

## Migration state

- Remote production already records the canonical-GTIN executor waves through E16, including K18 readiness at `20260901090000`.
- The telemetry V2 expansion `20260826093828`, E17 `20260901143000`, E18 `20260901150000`, E19 `20260901153000`, and E18 oil disposition re-entry `20260901162000` are unapplied.
- The conflicting 90-day retention migration was never applied and is deleted from the proposed tree.
- Do not use a blind `supabase db push`; merge/deployment needs the documented migration-first sequence and exact guarded batch applies.

No production apply is part of this branch publication. E17–E19 remain exact, separately gated database operations.
