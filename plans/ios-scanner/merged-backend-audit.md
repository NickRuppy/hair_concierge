# Merged backend audit — PR #531

2026-09-11 · **Complete: one bounded read-only source audit.**

[PR #531](https://github.com/NickRuppy/hair_concierge/pull/531) merged at `2026-09-11T13:25:21Z`, merge/source SHA `469d41f5e81f44702c94829c0ed312e732b01172`. Its only change is `docs/freemium-parked.md`; earlier program code is included in the audited main baseline. Root checkout was clean. Planning documents remain in `codex/ios-scanner-plan`; that worktree has not been rebased or implementation-integrated.

## Evidence boundary

- Verified now: GitHub merge receipt, merged source and SQL definitions, 19 targeted unit tests.
- The merged parking memo reports that web freemium is disabled, endpoints deployed and five program migrations applied in production. These are recorded operational reports, **not fresh independent Vercel/deployment/database checks**. Source checks establish how flags gate behavior, not the current live environment value.
- No production flags, configuration, database, accounts, emails or deployments were changed. The PR watcher is PAUSED; do not repeat this broad audit. Normal implementation checks of changed code, migration order and isolated integration remain necessary.

## Reuse and required adaptations

Source paths below are relative to the repository at the pinned SHA, not the older planning-worktree HEAD.

| Area | Verified source | Plan consequence |
|---|---|---|
| Web flag boundary | `src/lib/entitlements/flag.ts`; `src/app/api/auth/free-registration/route.ts:47-56`; `src/lib/supabase/middleware.ts:99-104,156` | Native admission/auth must work independently of web freemium activation. Keep existing web route and payment guards intact. Never trust a caller-supplied platform string as authorization. |
| Regular quiz | `src/lib/personal-plan/input.ts:93-134`; `src/lib/personal-plan/compute-stage1.ts:67-105` | Reuse the existing legacy-quiz source builder, validated supported-source parser and deterministic calculation. The ordinary organic quiz lacks the parked program's prepared-artifact handoff; implement the approved native/organic owner-bound claim. Do not fabricate prepared artifacts, detailed answers or enrollment. |
| Free signup bootstrap | `src/app/auth/confirm/route.ts:310-371`; `src/lib/personal-plan/persistence/free-snapshot-service.ts:147-174` | Reuse suitable lower-level claim/owner/rate-limit helpers, but provide native code/link, bearer bootstrap and typed readiness/retry handling. The parked service refuses paid users and requires an attached prepared artifact; it is not a universal bootstrap for ordinary quiz users. |
| Snapshot persistence | `src/lib/personal-plan/persistence/free-snapshot-supabase.ts:93-103`; `supabase/migrations/20260828104243_personal_plan_paid_migration_admission.sql:687-730` | The existing RPC inserts a personal-plan container with null enrollment. A different enrollment can fail; a changed input/head stales drafts, clears the refined head and increments plan revision. Do not reuse this writer for general native login/profile refresh. Implement the already-planned scanner-context publication contract without mutating paid-plan/routine state. |
| Existing paid context | `src/lib/scan/profile-context.ts:35-95`; `src/lib/freemium/plan-provisioning-supabase.ts:113-137` | Read compatible refined/initial snapshots under approved D2 precedence. A parked purchase path's enrollment promotion does not establish compatibility with all existing production purchase paths. Use one shared scanner-context loader and calculation authority; a derived scanner context is not another user profile or independent algorithm. |
| Answer editing | `src/app/api/profile/route.ts:31-71` | Current web PUT updates hair answers without publishing derived context. Native bearer endpoints and consistent source-revision/context publication remain T2 work. Preserve applicable detailed answers and paid routines; distinguish failed reads from missing profiles. |
| Product results | `src/app/api/scan/resolve/route.ts:407-490,523`; `src/lib/scan/types.ts:42-60` | Extract shared domain evaluation/presentation. Do not call the paid web HTTP wrapper or inherit flag-on masking, reveal limits or automatic Merkliste saving. Native alternatives still need comparison rows and the approved max-five ordering; no UI redesign. |

## Concrete implementation contract

**T1:** native auth/admission and regular-quiz binding use the shared account and completed owner-bound source, without relying on the parked web registration endpoint or a prepared Personal Plan artifact. Scanner admission waits for ready context; source errors offer retry.

**B2/T2:** reuse calculation and legacy source normalization, plus compatible existing paid snapshots read-only. Add the planned versioned scanner-context publication adapter/persistence and unify scanner reads. Do not route native edits through `personal_plan_create_or_reuse_initial_need`. This implements the previously approved no-paid-mutation and D2 requirements; it is not approval for a parallel profile or copied engine. Exact schema and transactions must satisfy local migration, owner, concurrency and source-precedence tests before integration.

Required integration fixtures: completed regular-quiz free user with no prepared artifact; existing refined paid user; owner mismatch; missing versus failed source read; duplicate bootstrap; concurrent native edit/web refinement; failed compute with no partial write; unchanged paid enrollment/refined heads/routines; later legitimate paid purchase; web flag-off parity and existing flag-on behavior; native scan never saves a web list item. Do not claim these integration fixtures passed merely because the current unit suite passed.

**T3/T4:** expose the approved full native result via bearer routes, sharing catalog/assessment authority. Keep all approved purchase-only UI and alternatives. No paywall, save action or activation of web freemium is required.

## Verification performed

At the pinned clean root, one run:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test \
  tests/personal-plan/persistence/free-snapshot-service.test.ts \
  tests/scan-profile-context.test.ts \
  tests/freemium-admission-middleware.test.ts
```

**19 passed, 0 failed.** These are unit/dependency-fixture tests, not live schema/deployment evidence or native end-to-end tests. No simulator or camera was started.

B0's source audit is complete. Backend implementation, real isolated database integration and final joined journey reconciliation remain; the co-founder policy questions stay parked outside independent first-build work. No new product vote arises from this audit.
