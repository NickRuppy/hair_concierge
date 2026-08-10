# Personal Plan test owner ready-check

Date: 2026-08-10
Branch: `codex/personal-plan-test-owner`
Base: `origin/main` at `97d1fc1b344a22f9e6eb2ec2cb01600bdc660db3`
Rebased source fingerprint excluding receipts: `af42d77d9bd2686af50fb3df0a3e2584e2d3f6d3d65787d168047ef808178890`

## Verdict

Ready for code review and draft publication. Not ready for deployment or production owner creation: migration `20260810140000_personal_plan_test_owner.sql` is intentionally unapplied, and no production mutation was performed.

## Verified behavior

- Fixed owner only: `personal-plan-qa@hairconscierge.test`; no arbitrary email/user-id input or impersonation route.
- Production preparation/reset require `--apply`, the exact project confirmation, and `ALLOW_PERSONAL_PLAN_TEST_OWNER_PRODUCTION_WRITE=1`.
- One-time auth is consumed through the real `/auth/confirm` route, verifies the exact owner, opens `/plan-start`, writes mode-`0600` storage state, and accepts only `https://chaarlie.de` in production.
- The admin client accepts only the exact `https://pqdkhefxsxkyeqelqegq.supabase.co` production origin, and auth-state is written only after the rendered `Deine Basis` Stage 1 marker is visible.
- Atomic source preparation leaves no Customer.io outbox row and carries internal-test payment/funnel markers.
- The owner remains `is_admin=false`; an exact `tester` grant/enrollment provides only Personal Plan rollout access.
- Explicit reset preserves the paid source while erasing downstream Personal Plan progress.
- Legacy UX-audit helpers no longer contain or print a reusable password and refuse remote Supabase URLs.

## Verification evidence

- Focused policy tests: 7/7 passed.
- `npm run test:personal-plan`: 1011/1011 passed on the final base.
- `npm run test:personal-plan-db`: 9 files, 246 assertions passed, including 22 new owner-RPC assertions and progress/reset/source-preservation coverage.
- `npm run typecheck`: passed on the final base.
- `npm run lint`: passed with zero errors and four unrelated existing warnings.
- `npm run build`: passed on the final base.
- `npm run test:playwright:personal-plan-stage1-5`:
  - new non-admin reusable-owner prepare/replay/auth/reset test passed 1/1 in 3.3 seconds;
  - existing persisted journey passed 2/2 in 29.8 seconds on the final base;
  - final warm timing from the production-server harness: ready first-poll p95 221 ms, Stage 1 p95 153 ms, Stage 3 p95 265 ms; Stage 1 client reads 0 and Stage 3 reads per navigation 1;
  - earlier final-base attempts exposed noisy existing 5-second local waits and performance samples (`/plan-bereit` p95 2255 ms; Stage 3 p75 1764 ms). Test-only waits for successful Stage 3/Routine transitions now allow 15 seconds without weakening the persisted-state assertions or performance thresholds.
- After rebasing over PR #355, the harness retains its bounded production build/server, failure log, and Stage 3 handoff diagnostics while adding the reusable-owner suite before the persisted journey.
- The Stage 3 CI browser command now pins its dev-only gate on the child server and waits for the guarded `/labs/personal-plan/stage-3` route itself before starting Playwright; its workflow contract passed 12/12 and the exact browser command passed 15/15 locally after reproducing CI's transient guarded-route 404.
- Supabase migration listing showed production applied through `20260810120016`; `20260810140000` is not applied.
- Formatting/syntax checks and `git diff --check`: passed. Changed-file secret scan found only the deliberate fake `service-secret` unit-test value.

## Boundaries

- No production account, auth link, data row, migration, deployment, or external-provider call was created.
- The draft must call out the unapplied migration and the two noisy local performance-gate samples.
- A temporary Playwright storage-state file is generated only during an authorized operator run and must be deleted after the browser context closes.
