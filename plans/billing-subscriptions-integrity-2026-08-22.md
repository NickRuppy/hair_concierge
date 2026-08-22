# Billing Subscription Data Integrity — Diagnosis Report (2026-08-22, read-only)

Investigation by a dedicated read-only session (SELECT-only queries + repo code reading). No data modified. Fix package below is a proposal awaiting Nick's approval; open questions at the end block the cleanup PR.

## 1. Verdicts per zombie category

### A. The 30 "real-looking" expired-but-active rows: NOT lapsed customers — Stripe-account-cutover leftovers plus unmarked test seeds

Key discovery: **there are two Stripe accounts in the data.** Subscription ids encode the account: `sub_1T…K0IN8ErFeg…` (old Hair-Concierge-era account) vs `sub_1T…GiGHTGZcKB…` (current live account, first row 2026-06-02, all with `cs_live_` checkout sessions). The 36 expired-active rows split:

| Sub-category | Count | Evidence |
|---|---|---|
| Old Stripe account (`…K0IN8ErFeg…`), `backfilled_from_profiles: true` | 20 | All created by the 2026-05-27 backfill migration (`supabase/migrations/20260527_add_billing_subscriptions.sql`); 18 of 20 have `updated_at` frozen at backfill timestamp `2026-05-27 19:42:57` — no webhook ever touched them |
| Fabricated seed ids (`eval-chat-*`, `sub_tracker_*`, `sub_night_*`, `sub_localdev_*`, `local_dev_clean_access`, `sub_clean_*`, `sub_local_link_card_*`, `sub_routine_real_*`, `sub_tabs_active_*`) | 16 | Metadata: `ci_seed`, `qa_seed`, `source: chat_eval_ci`, `seeded_by`, `local_test` — seeds use ~5 different metadata key conventions |

**Who the 20 old-account rows belong to (masked):** 14 × `ni***@gmail.com` (Nick's own aliases), 1 e2e test account, `jo***@influencerascension.com` (+ `jo***@ascendaudience.com` in the non-expired set — marketing-agency contacts), `to***@gmx.de` (created 2026-05-19, matches Tom's review window), `jo***@icloud.com` (likely Jonas), `st***@eidenschink.de`. All accounts created 2026-02-12 – 2026-05-20 (pre-rebrand era).

**Why they never expire-updated:** the webhook endpoint follows `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, cut over to the new account ~June 2. Events for old-account subscriptions never arrive anymore. Corroboration from `billing_webhook_events` (443 rows): only 19 `customer.subscription.updated` + 3 `invoice.payment_succeeded` Stripe events since May 27 — consistent with ~8 live-account subs, wildly inconsistent with 33 old-account subs renewing. `invoice.payment_succeeded`/`checkout.session.expired` first appear 2026-08-01/02 → the endpoint's enabled-events list was expanded only in August.

**Test-mode proof:** 7 old-account rows created 2026-05-28 carry `checkout_session_id: cs_test_…` (Stripe test mode). 27 of all 33 old-account rows belong to Nick's own email aliases.

### B. Genuine lapse with retained entitlement — but for internal accounts, not paying customers

Entitlement enforcement never checks `current_period_end` for `active`/`past_due` rows:

- `hasCurrentBillingAccess` — `src/lib/billing/subscriptions.ts:282-292`: `if (OPEN_ENTITLEMENTS.has(row.entitlement_status)) return true` — period end only consulted for `canceled` rows.
- Feeds `findCurrentBillingSubscriptionForUser` → `hasCurrentAppAccess` (subscriptions.ts:202) → paywall in `src/lib/supabase/middleware.ts:105-113`.
- Legacy fallback `hasCurrentLegacyProfileAccess` (subscriptions.ts:294-301) has the same shape; `profiles.subscription_status` is still `'active'` for all 20 zombie users → both layers grant access.
- Nightly cron (`vercel.json`: `/api/billing/reconcile` at 02:15) → `reconcileExpiredBillingEntitlements` (`src/lib/billing/entitlements.ts:33-72`) **only scans `entitlement_status='canceled'`** — expired `active` rows are structurally invisible, and it never consults Stripe/PayPal.
- Secondary bug: `handleSubscriptionUpdated` (`src/lib/stripe/webhook-handlers.ts:330-331`) silently returns (200) without touching `billing_subscriptions` when no profile matches `stripe_customer_id` — a renewal event can no-op.

### C. No external paying customer in the zombie set

Zero live-account Stripe or PayPal rows are expired-active. PayPal renewals demonstrably work (rows I-8E6YKRWKVL61, I-UE956UVY65UV advanced `updated_at` on 2026-08-03).

## 2. Does anyone have premium without paying?

**No external paying-then-lapsed customer has free access.** But 33 old-account rows + 28 fabricated/seed rows grant unpaid premium to internal/test accounts; ~6 are non-team humans (`to***@gmx.de`, `jo***@icloud.com`, `st***@eidenschink.de`, agency contacts). Whether any ever paid real money on the old Stripe account only that account's dashboard can confirm.

**True paying base (2026-08-22): ~24 genuinely external subs — 2 monthly, 18 quarterly, 4 yearly (PayPal 18, Stripe live 6) ≈ €273 normalized MRR.** The prior 40/€445 estimate still included 12 fabricated seeds, 13 old-account rows (7 `cs_test_` quarterlies expiring Aug 28–31; 6 backfilled incl. all 3 Stripe "year" rows = Nick's own), 1 PayPal internal test, and 3 of Nick's own live-mode purchases (`sub_1TzOHE…`, `sub_1Tz0KJ…`, `I-0PUR66…`).

## 3. Proposed fix package (ordered, small PRs — nothing applied)

**PR 1 — Truth predicate + canonical view.** Migration creating `billing_subscriptions_current` (or `_classified` with computed `is_test`/`is_current` booleans). Truth predicate: `entitlement_status in ('active','past_due') OR (canceled AND cancel_at_period_end AND period_end > now())`, AND `current_period_end` not more than a grace window (~3 days) past, AND no test marker. Test marker = any of `metadata ? 'qa_seed'|'ci_seed'|'is_internal_test'|'seeded_by'|'local_test'`, `metadata->>'source' in ('chat_eval_ci','local_dev_login_clean_test','codex_link_card_test')`, or non-provider-shaped/old-account ids (suffix `K0IN8ErFeg` listed explicitly). Standardize all seed writers to one canonical key (`metadata.seed_source`).

**PR 2 — Enforcement + reconciliation.** (a) `hasCurrentBillingAccess` + `hasCurrentLegacyProfileAccess`: deny `active` rows whose `current_period_end` is past the grace window. (b) Extend `reconcileExpiredBillingEntitlements` with an expired-`active` branch: fetch provider truth (`stripe.subscriptions.retrieve` / PayPal GET), refresh period end if provider says active, else flip to `canceled` + `mirrorBillingSubscriptionToProfile`. Follow the `paid-access-monitor` pattern in `src/app/api/billing/reconcile/route.ts:165-173`. (c) Fix silent no-op in `handleSubscriptionUpdated`: fall back to lookup by `provider_subscription_id`; log/alert instead of quiet return.

**PR 3 — One-time cleanup (reversible).** Backup first (`create table billing_subscriptions_backup_20260822 as select *`, plus affected `profiles` columns). Then: 33 old-account rows → `canceled` with `cleanup_reason` metadata; 28 fabricated-seed rows → delete; mirror profile downgrades. Team members keeping access get `manual_access_grants` rows (checked at subscriptions.ts:227). Verify: expired-active count → 0.

**PR 4 — Seed guardrails.** Writers: `tests/tracker-page.spec.ts:293`, `tests/profile-page-smoke.spec.ts:75`, `tests/quiz-onboarding-e2e.spec.ts:128`, `tests/profile-editorial-v3.spec.ts:60`, `tests/mobile-ux.spec.ts:353`, `scripts/eval-chat/client.ts:140`, `src/lib/dev/local-login.ts` — all service-role against prod. Cleanup calls skipped on crashes (8 leftover `sub_tracker_*` rows prove it). Short term: nightly auto-purge of canonical-marker rows older than 24h + `finally`-wrapped spec cleanup. Proper: point CI at a Supabase branch database.

## 4. Blast radius — current readers showing wrong data

- `src/lib/supabase/middleware.ts` — paywall grants access to all 61 test/zombie rows
- `src/app/api/billing/access/route.ts`, `src/app/api/billing/membership/route.ts` — membership UI shows "aktiv" for zombie holders
- `src/app/api/admin/users/route.ts:73-77` — admin metrics inflated (40 vs ~24 real)
- `src/app/api/billing/change-plan/route.ts`, `src/app/api/paypal/cancel-subscription/route.ts`, `src/app/api/billing/change-plan/paypal/{cancel,return}/route.ts` — operate on polluted set; `assertCanStartCheckout` (subscriptions.ts:145) blocks re-purchase for zombie holders
- `src/app/api/tracker/*`, `src/lib/tracking/api-handlers.ts`, `src/app/plan-bereit/*`, `src/app/pricing/page.tsx`, `src/app/reactivate/page.tsx`, `src/app/result/[leadId]/page.tsx` — same predicate
- Analytics: `billing_analytics_events` outbox is event-driven (historical events fine), but any MRR/subscriber count queried from `billing_subscriptions` is wrong

## 5. Open questions only Nick can answer (block PR 3)

1. **Old Stripe account** (`…K0IN8ErFeg…`): ever live with real charges (April–May window)? Any subs there still billing (esp. `st***@eidenschink.de`, `to***@gmx.de`, `jo***@icloud.com`)? If yes → migrate or refund, not just downgrade.
2. **Stripe webhook endpoint:** confirm enabled events include `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed` (ledger suggests some enabled only ~Aug 1).
3. **Who keeps courtesy access** after cleanup (Jonas, Tom, agency contacts?) — encode as `manual_access_grants`.
4. **Grace window** for period-end checks (proposal: 3 days); should `past_due` be time-boxed too?
5. CI → Supabase branch DB now, or 24h auto-purge as accepted interim?
