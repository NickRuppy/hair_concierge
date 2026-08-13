# Chaarlie Compared with Web-App Latency and Post-Payment Best Practices

**Date:** 2026-08-13<br>
**Assessment target:** production `main` at `ef0ecfb81271a00762d4984c9638d6db28c7d8f6`<br>
**Benchmark:** `docs/research/web-app-latency-post-payment-best-practices-2026-08-13.md`<br>
**Method:** read-only source, tests, deployment metadata, Vercel runtime evidence, and Supabase metadata/advisors. No payment was initiated, no customer row was read, and no production state was changed.

## Executive conclusion

Chaarlie has a stronger correctness foundation than its current latency profile suggests. It verifies both providers server-side, uses stable provider idempotency keys, keeps payment and entitlement states distinct, exposes honest `paid_pending` recovery, prevents the browser return from granting itself access, and has broad regression coverage.

It does not yet meet the most important architectural practices for a fast and failure-tolerant post-payment flow:

1. The current Vercel production functions run in `iad1` while the Supabase project is in `eu-west-1`. Every uncached database round trip therefore crosses the Atlantic.
2. Authenticated requests pass through a broad proxy that performs auth, entitlement, profile, hair-profile, and routing-frontier reads; paid pages then repeat part of that work.
3. Stripe and PayPal webhooks synchronously execute fulfilment before returning `2xx`. One-time fulfilment includes account linking, confirmation delivery, plan generation, and evidence writes on that path.
4. Payment receipt, entitlement state, fulfilment job, and outbox state are not committed in one short transaction.
5. Existing timing events are useful but do not form a correlated provider-return-to-usable-plan trace or percentile SLO.

The most likely high-leverage performance sequence is therefore: **co-locate compute and data, remove duplicated proxy/page reads, durably acknowledge webhooks before secondary work, make the critical database transition atomic, then measure the complete paid handoff.** UI polish should follow those changes rather than precede them.

## Overall comparison matrix

| Benchmark practice | Status | Chaarlie evidence and interpretation |
|---|---|---|
| Durable purchase identity before provider work | **Partial** | PayPal order intents and one-time consent records provide durable identities. Stripe one-time checkout also binds an immutable consent to the Session. Stripe subscription checkout does not share one common pre-provider payment-attempt state machine. |
| Provider-side idempotency | **Meets** | Stripe derives Checkout idempotency keys from stable attempt/reservation identities; PayPal creation and capture use stable `PayPal-Request-Id` values. |
| Signed raw-body webhook ingress | **Meets** | Stripe verifies the raw body with `constructEvent`; PayPal verifies the raw event through PayPal's verification endpoint. |
| Idempotent event processing | **Partial** | A unique `(provider, provider_event_id)` insert prevents duplicate event IDs, but the ledger has no explicit received/processing/completed state or lease, and there is no general logical object-transition dedupe. |
| Fast durable acknowledgement | **Misses** | Both webhook routes run the full handler before `2xx`; durable receipt is not separated from fulfilment. |
| Atomic payment-to-entitlement transition | **Misses** | Purchase, job, account binding, confirmation, delivery evidence, analytics outbox, and completion are sequential calls rather than one transaction around the authoritative state change. |
| Payment truth separated from entitlement truth | **Meets** | One-time purchase state, fulfilment job state, and access state distinguish `paid_pending`, active, refunded/reversed, and failure conditions. |
| Browser return is not payment authority | **Meets** | `/welcome` re-retrieves and validates Stripe state; PayPal recovery retrieves an already captured order and does not capture from the return page. |
| Honest delayed/pending UX | **Meets** | The one-time return and `/plan-bereit` use bounded polling, explicit pending/transient/timeout states, retry, and support recovery. `/plan-bereit` is capped at 20 attempts every 1.5 seconds. |
| Reconciliation is a normal subsystem | **Partial** | A daily billing reconcile cron, leased fulfilment retries, payment-integrity checks, and paid-but-not-active monitoring exist. Production enablement of the feature-flagged retry/analytics branches was not confirmed. |
| Refund, reversal, and dispute semantics | **Partial** | Provider events update purchase/subscription state, but the intended entitlement behavior for an already delivered one-time plan is not explicit enough to call fully verified. |
| Server-first rendering | **Partial** | `/plan-bereit` and `/plan-start` enter through Server Components and Stage 1 is preloaded server-side, but the first `/plan-bereit` authority result is re-fetched by a client effect after hydration. |
| Avoid request waterfalls | **Partial** | Several independent reads use `Promise.all`; `/plan-start` still serializes auth, journey access, Stage 1 preload, and refinement loading. The broad proxy also runs before page-level work. |
| Stream a useful shell around slow work | **Partial** | Pending UI exists after hydration, but `/welcome`, `/plan-bereit`, and `/plan-start` have no route loading boundary or Suspense shell. `/routine` and `/anwendung` do. |
| Intentional caching | **Meets** | Payment/readiness/access responses correctly use dynamic rendering and `private, no-store`; non-authoritative assets and route code use standard Next.js caching/lazy-loading patterns. |
| Compute close to the primary database | **Misses** | Current production deployment metadata reports `iad1`; Supabase reports `eu-west-1`. |
| Efficient Postgres query shapes and indexes | **Partial** | Core billing uniqueness/indexes and short `SKIP LOCKED` claims are present. Live advisors still report several payment-related unindexed foreign keys and inefficient RLS `auth.uid()` evaluation. |
| Safe, efficient RLS and RPC permissions | **Partial** | Billing tables use RLS and service-only access patterns. Live metadata shows a permission drift on a `SECURITY DEFINER` PayPal reset RPC; details are below. |
| Correlated latency/error observability | **Partial** | Sentry tracing is sampled at 10%, Vercel logs contain privacy-safe operation durations, and payment failures use typed signals. There is no complete return -> receipt -> entitlement -> usable-plan trace or p50/p95/p99 dashboard. |
| Regression and recovery testing | **Meets** | The focused audit suite passed 80/80 tests across webhook handling, fulfilment retry, purchase/access invariants, payment integrity, and checkout routing. |
| Proven production SLO | **Unknown** | Current evidence is too sparse for a defensible post-payment p50/p95/p99, mobile Web Vitals, cold/warm split, or provider-segmented SLO. |

## Current post-payment flow

### Stripe subscription

The app creates an idempotent Checkout Session. On return, `/welcome` re-verifies the Session and subscription and performs account/profile/billing activation. The signed webhook independently performs activation and lifecycle updates. This is correct in authority terms, but both return and webhook can perform substantial synchronous work and multiple database calls.

### Stripe one-time Personal Plan

The app stores consent, creates an idempotent Session, verifies provider payment on webhook or return/status recovery, upserts a unique purchase, creates and claims a fulfilment job, binds an account, links source data, sends confirmation, generates/finalizes the plan, records evidence, and only then exposes active access. This is robustly fail-closed, but too much of it is coupled to the webhook/return critical path.

### PayPal one-time Personal Plan

The app creates a durable order intent, uses idempotent provider create/capture calls, binds the capture, and can activate from either the capture return or a verified `PAYMENT.CAPTURE.COMPLETED` webhook. Browser recovery cannot capture a new payment. The main concern is synchronous webhook processing and a currently recurring malformed/unlinked webhook failure pattern.

### PayPal subscription

A durable checkout intent precedes provider subscription creation. Verified webhooks retrieve current provider state, update provider-neutral billing/access records, and process renewal/failure/cancellation/expiry. The flow has strong state coverage but shares the same ingress and transaction limitations.

## Live performance evidence

### Region placement

- Current production deployment `dpl_4cDq86tTPpSNkcwg6Eiwxq4SvsLL` is Ready at the assessed `main` SHA and reports region `iad1`.
- Supabase project `pqdkhefxsxkyeqelqegq` is `ACTIVE_HEALTHY` in `eu-west-1`, running PostgreSQL 17.6.1.
- The repository contains no `preferredRegion` setting; `vercel.json` only defines cron schedules.

This is a confirmed topology mismatch, not a measured causal percentage. It is nevertheless the strongest systemic latency candidate because the post-payment and authenticated-app paths are dominated by uncached Supabase calls.

### Database versus end-to-end time

Live cumulative `pg_stat_statements` metadata shows core database execution itself is generally fast for common billing queries: a full billing-subscription-by-user read averages about 0.08 ms, a selected entitlement read about 0.16 ms, and webhook-ledger insertion about 8.04 ms. These values exclude HTTP, TLS, proxy, authentication, and transatlantic network time.

Current production logs contain individual—not percentile—samples of the Personal Plan entitlement guard around 918-1,055 ms, a routine attention read around 1,141 ms, and an application-page resolver around 1,215 ms. The gap between database execution and application-observed duration supports measuring network, middleware, and repeated-call overhead before attempting broad SQL micro-optimization.

### Proxy and repeated work

`src/proxy.ts` matches almost every non-static request. For authenticated paid routes, `src/lib/supabase/middleware.ts` performs:

1. `auth.getUser()`;
2. subscription access and one-time access checks;
3. profile and hair-profile reads;
4. Personal Plan routing-frontier loading.

`/plan-bereit` and `/plan-start` then repeat auth/access/journey decisions in the page. With the current cross-region placement, each repeated request is especially expensive.

### Webhook delivery failures

Vercel's grouped production errors for the last seven days show 104 PayPal webhook handler failures in two clusters:

- 78 occurrences: capture webhook missing a capture ID;
- 26 occurrences: refund/reversal missing a subscription link.

They were last seen on 2026-08-13 on an earlier production deployment. The relevant handler files have not changed between that deployment SHA and the assessed `main` SHA. The handler releases the event claim and returns `500`, so repeated provider delivery is plausible and should be investigated immediately. The counts do not prove 104 affected purchases or customers; they may include repeated delivery of the same malformed events.

Sentry independently shows the unresolved production issue `HAIR-CONCIERGE-4K`, `Payment signal: payment_webhook_processing_failed`, with 42 events in the last 24 hours and a PayPal/webhook/unknown-truth classification. That corroborates an active processing problem while still not establishing customer impact or payment truth.

## UX assessment

The state model is one of Chaarlie's strongest areas. It distinguishes checking, paid-pending, source-pending, missing source facts, ready, forbidden, transient error, and timeout. A buyer is not sent back to pricing merely because fulfilment is converging, and retry/support affordances exist.

The taxonomy is conservative but not complete against the benchmark: provider `requires_action`, provider-processing, unknown provider truth, refund/reversal, and failed settlement are not all first-class customer-visible states. Several safely collapse into pending, revoked, or support escalation. Reload and endpoint retries are idempotent, but this audit did not complete an authenticated reload/back/multi-tab replay for every provider outcome.

The performance limitation is when the useful state becomes visible. `/plan-bereit` does server-side auth/access/enrollment work, then the hydrated client immediately performs another `POST /plan-bereit/status` before showing its first authoritative actionable result. There is also no `loading.tsx` or Suspense boundary on the three immediate handoff routes. The recommended shape is:

1. stream or server-render the first confirmed status;
2. poll only when that first result is genuinely pending;
3. keep the existing bounded timeout and recovery states;
4. measure return-to-first-trustworthy-message and return-to-usable-plan separately.

## Adjacent security finding

Live ACL metadata shows `public.reset_expired_uncaptured_paypal_order(text,text,timestamptz)` is `SECURITY DEFINER` and explicitly executable by `anon`, `authenticated`, and `service_role`. The migration in source revokes `PUBLIC` and grants only `service_role`. The function itself checks `auth.role() = 'service_role'` and uses a fixed search path, so this audit did **not** establish an authorization bypass. It is still a confirmed production permission drift and unnecessary public attack surface; it should be reconciled and re-verified outside the performance backlog.

## Prioritized action order

### Immediate operational checks

1. Investigate the two recurring PayPal webhook error clusters in provider delivery history and determine whether they are malformed provider variants, mapping defects, or repeatedly retried historical events.
2. Reconcile and verify the PayPal reset RPC grants. Treat this as permission drift, not as a latency optimization.
3. Confirm whether one-time fulfilment retry and analytics-outbox dispatch are enabled in production.
4. Shorten or supplement the paid-without-entitlement operational alert. The current paid-access monitor's default grace is 60 minutes, while the benchmark proposes escalation after 5 minutes.

### P1: highest expected latency and reliability return

1. Move the Vercel function region to an EU region close to Supabase, or move the primary data region as part of an explicit infrastructure decision. Measure before and after with identical flows.
2. Slim the broad proxy path and remove duplicated auth/access/frontier reads while preserving fail-closed routing.
3. Replace claim-then-synchronous-webhook processing with durable receipt plus a leased worker. Return `2xx` after signature verification, durable receipt, and the smallest authoritative state transition.
4. Add one short database RPC/transaction for provider truth, logical transition guard, purchase/entitlement state, fulfilment job, and outbox insertion. Keep provider HTTP outside that transaction.
5. Correlate provider return, webhook receipt, paid row, entitlement ready, `/plan-bereit` ready, CTA, and first usable `/plan-start` render with privacy-safe IDs and timestamps.

### P2: post-payment rendering

1. Server-render or stream the first `/plan-bereit` authority result; reserve client polling for true pending convergence.
2. Add loading/Suspense shells to `/welcome`, `/plan-bereit`, and `/plan-start` so server work does not block all useful feedback.
3. Remove the duplicate first-time-destination lookup in the Stripe one-time return path.
4. Add explicit deadlines around provider retrieval and return-path activation dependencies.

### P3: later-journey polish

1. Review raw Stage 3 product images and known host configuration; this is not on the immediate payment-return path.
2. Apply advisor-confirmed covering indexes only after checking real join/delete workloads.
3. Replace per-row RLS `auth.uid()` calls with init-plan-friendly `(select auth.uid())` where the live advisor identifies the issue.

## Measurement plan required before claiming success

Instrument and report at least:

- provider return -> first trustworthy confirmation;
- provider success -> durable webhook receipt;
- durable receipt -> paid record;
- paid record -> entitlement ready;
- return -> `/plan-bereit` ready;
- return -> first usable `/plan-start` render;
- webhook p50/p95/p99, timeout rate, retry count, and oldest pending lease;
- proxy/auth/Supabase/provider durations with cold/warm and region tags;
- mobile and desktop Web Vitals for `/welcome`, `/plan-bereit`, and `/plan-start`;
- provider and instant-versus-delayed payment segmentation.

Suggested starting targets should come from the benchmark report, but Chaarlie should not adopt a pass/fail SLO until a representative production baseline exists.

## Verification receipt

- Current root checkout remained clean on `main` at `ef0ecfb8`.
- Focused payment/recovery suite: **80 passed, 0 failed**.
- Current production deployment SHA and region were verified through Vercel deployment metadata.
- Supabase health, region, PostgreSQL version, advisors, function ACL, and aggregated query statistics were checked read-only.
- No provider payment, refund, replay, entitlement grant, migration, environment change, deployment, or customer-row read was performed.

## Remaining unknowns

- Actual post-payment p50/p95/p99 and mobile Web Vitals.
- Vercel Fluid Compute and instance/concurrency settings not exposed by the inspected repository/deployment evidence.
- Production values of retry/outbox feature flags.
- Provider dashboard delivery status and whether the 104 errors are repeated deliveries of a small number of events.
- Real authenticated, non-PII end-to-end provider -> webhook -> entitlement -> browser replay after the current deployment.
- Detailed Sentry traces and provider-to-entitlement span correlation beyond the confirmed issue aggregate.
