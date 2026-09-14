# Production baseline revalidation — 2026-09-13

## Current release

- Verified twice through Vercel's `chaarlie.de` alias; last check 19:55:21 UTC (21:55:21 CEST).
- Deployment `dpl_H9jHvejxqs9NSrzpxAxj9XFHUVpT`, READY, production, ready at 19:08:35 UTC.
- Deployed commit `5a3e33f1f641a8693209017ad25c4c9c69870df2`, [PR #537](https://github.com/NickRuppy/hair_concierge/pull/537), Partnerzugang robust: Zugang beim Claim, Neustart für bestehende Konten.
- Current `origin/main`, clean root main and task branch match that commit. The task branch was fast-forwarded from `f8c28328`; all task plan/evidence files were preserved. No production changes were made.

## What changed since our original diagnosis

The shipped partner-access change creates the free-access grant at invitation claim and fixes existing partners being routed through quiz/chat to reactivation before the grant existed. Partner journey resolution is user-bound and handles former moderators with an active partner grant. Partner fresh-start resets onboarding/plan state, not Stripe customer/subscription references.

Our checkout defects remain: the Stripe and PayPal initiation routes, reactivation checkout component, Stripe activation resolver and reservation helpers are unchanged between the original baseline and deployed commit. The missing-customer failure, Stripe `setAll` no-op, and account mapping by provider email/customer therefore remain in this release. The old paywall already permits expired accounts; no new eligibility bypass is required.

Update verification fixtures: an expired returning account must have no current billing, one-time access or active manual/partner grant. Active partners, including former moderators with an independent partner grant, must reach their account without provider creation. Keep existing user- and email-based manual-access guards. This refines coverage without changing the approved journey.

## Live database verification — read-only

Project `pqdkhefxsxkyeqelqegq` has migration history entry `20260913185745`, name `partner_access_fresh_start`. Repository filename is `20260913120000_partner_access_fresh_start.sql`: timestamps differ. Both new nullable timestamptz columns (`fresh_start_at`, `fresh_start_decided_at`) exist. All four function bodies exactly match the repository migration via MD5 of `pg_proc.prosrc` versus the local dollar-quoted bodies:

| Function | Matching body fingerprint |
| --- | --- |
| private.partner_access_fresh_start | 336cc2026430650164f4b20a1d1a7fd9 |
| public.complete_partner_access_claim | b5ed23c0b4e006041c0d25ca908c9e52 |
| public.activate_partner_access | 2cac739cd8cea151de124af419a9e8c8 |
| public.reactivate_partner_access | 30d3bffb2f799df7079826c8eabf2b52 |

Claim has the new six-argument signature including `p_fresh_start boolean`; no old five-argument overload was returned. All four functions have fixed empty search paths, service-role execute enabled, and anon/authenticated execute denied. We did not invoke any of these mutation functions or exercise production resets/triggers. Do not replay the repository-named migration merely because its filename timestamp is absent from history. Check/reconcile migration identity before a future deployment migration command; no history repair is part of this check.

## Post-deploy observability and limits

Window: 2026-09-13 19:08:35–19:52:22 UTC.

- Sentry production issue query `lastSeen:>2026-09-13T19:08:35Z`: no matching issues at read time.
- Vercel runtime error clusters for Stripe creation, PayPal intent, partner claim and partner activate: none.
- Current-deployment runtime log counts: `/` 43, `/lp/scan` 2, `/robots.txt` 2. No checkout/partner API requests in returned groups. Absence of errors does not establish those flows were exercised or fixed.

No real checkout, invitation claim, account reset, payment retry, customer contact or provider mutation was performed. Existing cases remain diagnostic only, as requested.

## Local checks against the exact production head

Node 22 focused suite: 148/148 passed in 4.17 seconds. Files: reactivation-checkout-metadata, stripe-checkout-session-route-contract, stripe-offer-elements-checkout, profile-subscription-reactivation, auth-middleware-personal-plan-routine, freemium-enforcement-matrix.

The isolated route diagnostic in `evidence/diagnostic-replay.cjs missing` still exits 1 as expected, reproducing `resource_missing(param=customer)` with reservation `provider_selected`, no provider reference, one mocked provider call and unknown failure classification. It uses the current route with mocked database/provider, not a live charge or proof about an individual's payment state.

## Planning disposition

Nick approved the displayed mockup and complete journey with “Okay looks good,” conditional on this fresh production check. The checked release does not alter the approved recovery behavior. Preserve that approval and record this revalidation separately; no new journey approval is required for adding partner-grant fixtures. The plan is now based on the verified production release. Implementation/publication/production actions have not occurred.
