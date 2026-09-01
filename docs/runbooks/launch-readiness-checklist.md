# Launch Readiness Checklist

Use this as the working checklist before the public influencer launch.

## Already Covered In Repo

- CI quality gates: typecheck, lint, build, deterministic contract tests, Playwright smoke, live chat smoke, retrieval gate.
- Security CI: dependency review and CodeQL.
- App rate limits: chat, quiz lead capture, quiz analysis, checkout password setup, and checkout magic-link sending.
- Billing tests: Stripe webhook handlers, entitlement gating, duplicate/idempotent webhook handling, PayPal subscription server flows.
- Sentry setup: server/client error capture, tracing sample rate, replay-on-error.
- Security headers: CSP report-only, frame blocking, content-type sniffing protection, referrer policy, permissions policy.
- Launch traffic tooling: fail-closed read-only non-production landing profiles, a separate one-iteration read-only production smoke, and Lighthouse mobile wrapper.

## Must Do Before Launch

- Merge and deploy the returning-mobile-user hotfix.
- Run one manual mobile happy path on production:
  - landing -> quiz -> result -> pricing;
  - test checkout -> welcome -> password or magic link;
  - onboarding -> chat;
  - close browser/app -> reopen `/chat`;
  - logout -> login again.
- Run Stripe test subscription golden path with real test checkout, not only webhook fixture triggers.
- Confirm production Stripe webhook endpoint is registered, live, and receiving events.
- Confirm Supabase Auth email limits and custom SMTP/deliverability settings for invite bursts.
- Confirm OpenAI project usage/rate/cost limits for the expected launch window.
- Confirm Supabase spend cap and project limits are acceptable for launch day.
- Confirm Sentry alerts route somewhere visible during launch.
- Confirm Vercel firewall visibility and ordinary-user behavior without generating production load.
- Confirm the influencer forecast does not materially exceed the historical peak hour of 152 landing pageviews, 61 quiz starts, and 27 leads.
- Record that write-path and 2x/5x capacity are not experimentally proven on the simpler launch path.

## Scan

- Confirm the scan nav entry is live in production.
- Run one manual end-to-end scan on production: open scan, scan a known EAN, confirm the result screen.
- Run the unknown-EAN path end to end: submit an unresolved barcode, complete the operator loop (`docs/scan-attempt-log.md` — queue, review/approve, notify-pending), confirm the resulting chat notification arrives.
- Confirm Sentry shows `scan.route`-tagged events for the scan API routes (`src/lib/observability/scan.ts`).
- Confirm PostHog is receiving `scan_started` and `scan_result_shown` events.
- After a few days of production traffic, run the miss-ranking query (`docs/scan-attempt-log.md`) and review the results.
- Confirm the retention job is scheduled: `select * from cron.job where jobname = 'scan_resolve_events_anonymize';` returns a row.

## Strong Follow-Ups

- Investigate homepage mobile LCP. Current first Lighthouse baseline: LCP 5320ms, CLS 0.000, TBT 81ms.
- Decide whether CSP can move from report-only to enforced after reviewing reports.
- Add a synthetic production smoke monitor for `/`, `/quiz`, `/auth`, `/pricing`, and `/chat` auth redirect behavior.
- Add a dedicated paid production test user for authenticated k6 chat smoke with very low volume.
- Provision a fully isolated environment and reopen write-capacity testing before any future forecast materially above the historical envelope.
- Investigate shared-IP contention if monitoring or real-user evidence shows legitimate 429s; do not weaken the production limiter pre-emptively.

## Stop-Go Criteria

Go only if:

- production happy path works on mobile;
- returning paid user resume works after browser/app close;
- Stripe test subscription grants entitlement and login access;
- Sentry has no fresh high-volume production errors;
- smoke k6 passes with 0% failures;
- no Vercel edge mitigation is active for normal browsing.

Pause if:

- auth/email sends return 429s during manual tests;
- checkout succeeds but entitlement is delayed or missing;
- chat returns repeated OpenAI errors/timeouts;
- Vercel returns `x-vercel-mitigated: deny` for normal human browsing;
- Sentry shows a new user-facing error cluster.
