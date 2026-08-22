# Billing Integrity Cleanup — Implementation Plan (2026-08-22)

Diagnosis of record: [billing-subscriptions-integrity-2026-08-22.md](./billing-subscriptions-integrity-2026-08-22.md). Worktree `billing-integrity` on `codex/billing-integrity` (base a75554e2 = origin/main tip). Backend-only: no surface, copy, timing, or user-visible feedback changes for legitimately paying users; the only behavior change is that stale internal/test accounts lose unpaid premium access.

## Locked decisions (Nick, 2026-08-22)

1. Old Stripe account (`…K0IN8ErFeg…`) was **test-only, never production** → all 33 old-account rows downgrade without refund/migration concerns.
2. Courtesy access after cleanup: **Nick + Jonas + Tom** via `manual_access_grants` (agency contacts + st***@eidenschink.de drop out; re-grantable anytime).
3. Grace window for expired-`active` rows: **1 day**. Mitigation for the strictness: the nightly reconcile fetches provider truth, so a late webhook self-heals before real lockout; if support pings ever show wrong lockouts, widen the window (config constant, one-line change).
4. Stripe webhook config: **verification script in PR 2** (reads endpoint config via Stripe API, alarms if required events missing) — no manual dashboard dependency.
5. Seed strategy (PR 4): **branch DB for CI + fixed flagged synthetic accounts for prod smoke + TTL auto-purge as backstop**.

## PR 1 — Truth predicate + canonical view

- Migration: `billing_subscriptions_classified` view with computed `is_test` and `is_current` booleans + `billing_subscriptions_current` view (`is_test = false AND is_current = true`).
  - `is_test`: any of `metadata ? 'qa_seed'|'ci_seed'|'is_internal_test'|'seeded_by'|'local_test'|'seed_source'`, `metadata->>'source' IN ('chat_eval_ci','local_dev_login_clean_test','codex_link_card_test')`, provider id contains `K0IN8ErFeg`, `metadata->>'checkout_session_id' LIKE 'cs_test_%'`, or `metadata ? 'backfilled_from_profiles'`.
  - `is_current`: `entitlement_status IN ('active','past_due') AND current_period_end >= now() - interval '1 day'`, OR (`canceled` AND `cancel_at_period_end` AND `current_period_end > now()`).
- Standardize seed writers on one canonical key `metadata.seed_source` (update the writers listed in PR 4 to add it; keep old markers recognized in the view).
- Tests: SQL-level expectations via a small script or existing migration-test pattern; unit test for any TS helper added.

## PR 2 — Enforcement + reconciliation

- `src/lib/billing/subscriptions.ts`: `hasCurrentBillingAccess` (≈:282) + `hasCurrentLegacyProfileAccess` (≈:294) deny `active`/`past_due` rows whose `current_period_end` is more than the 1-day grace in the past. TDD: red tests first (suite runs via npm scripts — server-only shim, never bare `npx tsx --test`).
- `src/lib/billing/entitlements.ts` `reconcileExpiredBillingEntitlements` (≈:33-72): add expired-`active` branch — fetch provider truth (`stripe.subscriptions.retrieve` / PayPal GET subscription), refresh `current_period_end` when provider says active, else flip `entitlement_status='canceled'` + `mirrorBillingSubscriptionToProfile`. Follow the `paid-access-monitor` branch pattern (`src/app/api/billing/reconcile/route.ts:165-173`: counters, telemetry, deadline).
- `src/lib/stripe/webhook-handlers.ts` `handleSubscriptionUpdated` (≈:330): fall back to lookup by `provider_subscription_id` when customer-id → profile lookup misses; log loudly instead of silent 200 no-op.
- Webhook-config verification: script (`scripts/billing/verify-stripe-webhook-config.ts` or a reconcile-route step) listing the endpoint's `enabled_events` via Stripe API; alert (Sentry capture + reconcile response field) if `customer.subscription.updated/deleted`, `invoice.payment_succeeded/failed` are missing.

## PR 3 — One-time data cleanup (reversible; applies only after PRs 1-2 are merged + deployed)

- Backup: `billing_subscriptions_backup_20260822 AS SELECT *`; same for affected `profiles` rows (subscription columns).
- 33 old-account rows → `entitlement_status='canceled'` + metadata `{cleanup_reason:'stripe_account_cutover_internal', prior_entitlement_status:'active'}`; mirror profile downgrades.
- 28 fabricated-seed rows → DELETE (reference nothing real at any provider).
- `manual_access_grants` for Nick, Jonas, Tom (verify existing grants first — table already has 55 rows; no duplicates).
- Verification queries in the PR description: expired-active count = 0; `billing_subscriptions_current` count = external truth (~24 at time of writing); paywall smoke for one granted user + one cleaned user.
- Data changes to production run only after Nick's explicit go on the exact SQL (paste the statements in chat before applying).

## PR 4 — Seed guardrails

- CI/Playwright → Supabase **branch database** (branching available on project `pqdkhefxsxkyeqelqegq`): wire env in CI so specs never point at prod. Writers to touch: `tests/tracker-page.spec.ts:293`, `tests/profile-page-smoke.spec.ts:75`, `tests/quiz-onboarding-e2e.spec.ts:128`, `tests/profile-editorial-v3.spec.ts:60`, `tests/mobile-ux.spec.ts:353`, `scripts/eval-chat/client.ts:140`, `src/lib/dev/local-login.ts`.
- Fixed synthetic accounts for prod smoke: small permanent set, flagged via `metadata.seed_source='synthetic_smoke'`, excluded by the PR-1 view, documented in README/docs.
- Backstop: nightly reconcile purges rows with `seed_source` (non-synthetic) older than 24h; spec cleanup wrapped in `finally`.

## Order & verification

PR 1 → PR 2 → deploy → PR 3 (data) → PR 4. Each PR: `npm install` in worktree first run, `npm run ci:verify`, targeted suites, Codex whole-branch review before push (repo standard), squash-merge. Sentry check post-deploy (CLAUDE.local.md).
