# Launch Readiness Checklist

Use this as the working checklist before inviting the 100-user beta group.

## Already Covered In Repo

- CI quality gates: typecheck, lint, build, deterministic contract tests, Playwright smoke, live chat smoke, retrieval gate.
- Security CI: dependency review and CodeQL.
- App rate limits: chat, quiz lead capture, quiz analysis, checkout password setup, and checkout magic-link sending.
- Billing tests: Stripe webhook handlers, entitlement gating, duplicate/idempotent webhook handling, PayPal subscription server flows.
- Sentry setup: server/client error capture, tracing sample rate, replay-on-error.
- Security headers: CSP report-only, frame blocking, content-type sniffing protection, referrer policy, permissions policy.
- Launch stress tooling: k6 smoke/average/spike/safety/soak profiles and Lighthouse mobile wrapper.

## Must Do Before Inviting Users

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
- Confirm OpenAI project usage/rate/cost limits for the expected beta window.
- Confirm Supabase spend cap and project limits are acceptable for launch day.
- Confirm Sentry alerts route somewhere visible during launch.
- Confirm Vercel firewall behavior before running more production load from one IP.

## Strong Follow-Ups

- Investigate homepage mobile LCP. Current first Lighthouse baseline: LCP 5320ms, CLS 0.000, TBT 81ms.
- Decide whether CSP can move from report-only to enforced after reviewing reports.
- Add a synthetic production smoke monitor for `/`, `/quiz`, `/auth`, `/pricing`, and `/chat` auth redirect behavior.
- Add a dedicated paid production test user for authenticated k6 chat smoke with very low volume.
- Run average-load and spike k6 profiles from a distributed runner or with slower think time to avoid single-IP Vercel mitigation.

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
