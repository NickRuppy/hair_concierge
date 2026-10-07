# Repeatable owner testing — research, not an approved rollout

2026-09-15. Nick asked for first-principles comparison before accepting a one-use live owner exception. No test deployment, live exception, identity reset or provider mutation is authorized by this research request.

## Findings

The physical-card shortage is avoidable. Stripe provides test card numbers (for example 4242 4242 4242 4242 with a future expiry and any three-digit CVC) for test-key integrations. PayPal creates simulated buyer and merchant accounts; a buyer need not have a real card. Both can be reused for repeated testing. Stripe's current testing page explicitly says that its Services Agreement prohibits testing in live mode with real payment details. A proposed app-level exception cannot change provider behavior or make a live card into a test card.

Sources, checked 2026-09-15:
- https://docs.stripe.com/testing
- https://docs.stripe.com/sandboxes
- https://docs.stripe.com/billing/testing/test-clocks
- https://developer.paypal.com/sandbox-testing/accounts
- https://developer.paypal.com/credit-card-number-generator

Stripe test clocks can advance subscription/invoice lifecycle and generate webhook events. Chaarlie also has database and application time-based access rules: advancing Stripe time alone does not advance those clocks. Complete lifecycle tests must control corresponding app time in the isolated environment or use aligned fixtures. PayPal behavior is tested with its sandbox and repository event/clock fixtures; do not claim it has Stripe-equivalent time travel.

## Options

| Option | What it proves | Changes needed | Limits |
| --- | --- | --- | --- |
| Existing local lab scenarios and a test user | UI, access-state display, error copy, product workflows | Small: reusable fresh/trial/paid/expired/failed fixtures and reliable reset controls; existing dev login/labs already exist | Does not prove provider authorization or full activation/webhook flow; existing generic dev login does not establish Personal Plan enrollment |
| Protected test deployment with provider sandboxes (recommended for repeatable checkout QA) | Actual app checkout, authorization, webhooks, signup/login and subscription state transitions against simulated providers | Medium: same release/build path, isolated Supabase data/Auth, Stripe sandbox and PayPal sandbox credentials, matching test catalog/coupons, separate webhook secrets, verified auth return URLs, seed/reset scripts, controlled jobs/email/analytics | Not real bank settlement; external configurations can drift unless kept aligned and checked |
| Owner exception on the live application | Live app UI and configuration with specially permitted owner behavior | A robust implementation needs verified owner identity, bounded issuance and audit, checkout binding, replay/concurrency rules, customer-data separation and lifecycle-safe cleanup | Creates real agreements, does not simulate declines or fast renewals, deviates from real eligibility checks, and conflicts with Stripe's documented guidance for repeated real-card testing. Do not adopt as the routine payment-testing setup |

## Recommended shape

Use existing local scenarios for quick development plus one protected browser-accessible test deployment for the full checkout. Reuse the same production commit and business rules, including trial reuse protection. Test data and provider objects are separate from production. Do not dynamically mix live/test credentials per browser query or unverified email within the public production app.

Give the owner stable test logins and a "fresh test run" operation scoped to isolated test data. Support both a clean run and a deliberate repeat-trial rejection scenario; do not permanently exempt the owner from the very policy under test. Reset must handle canonical profiles, leads, auth, enrollments, identity claims, provider subscriptions and queued jobs coherently, rather than delete only a card claim. Avoid deleting customer data; use a separate test project and test provider namespaces. Simulated provider objects and billing facts must never reach production entitlements, customer messages or revenue reporting.

The existing code already exposes deployment-level Stripe configuration, `PAYPAL_ENVIRONMENT=sandbox`, trial runtime merchant/mode namespaces and test-history markers. The repository has development-only login and lab pages. This is therefore configuration plus a reusable fixture/reset workflow and verification, not a separate product implementation. Read-only repository inspection found no complete staging provisioning/reset workflow. The local Supabase configuration references an absent `supabase/seed.sql`, and the documented everyday local workflow uses production Supabase. The existing dev-login fixture only grants legacy paid access; it does not seed the Personal Plan enrollment/lead/artifact chain. There is also no integrated app/provider test-clock control. No cloud inventory was changed or exhaustively checked, so this does not establish that no remote test project exists. Do not call the remaining setup one environment-variable change or promise an exact delivery estimate yet.

The current `.env.local` was copied by worktree creation and may point to real services. Localhost alone is not isolation. Verify environment provenance before every writing test. Prefer a separate Supabase test project (or verified isolated local instance), no production customer-data copy, and explicit safe email/job/analytics destinations.

## Decision needed

Choose whether to set up a shared browser-accessible test environment now or keep that as a follow-up and use existing local UI scenarios for the error repair. Earlier live-only shipping authorization does not imply approval to create a new environment. No need for a new physical card either way for simulated testing.

## Related product gap

The error-flow audit found that a denied/unactivated trial has no confirmed self-service paid recovery path: anonymous `/pricing` redirects to the quiz; after login, blocked/released enrollments project to an uncertain/support state. The message repair should offer truthful support and existing login, not promise a working paid checkout. Adding the missing self-service path is an independent product scope choice.

## Repository verification

Read-only environment audit confirmed configurable Supabase browser/server/admin clients, Stripe keys/catalog, PayPal sandbox API base and signed webhook verification. The trial runtime checks Stripe/PayPal mode agreement. `docs/local-qa-access.md` contains a narrow Stripe local checkout recipe but warns about real Supabase data and unproven internal-test analytics suppression. A protected test environment also needs provider webhook access through its deployment protection; do not globally remove protection just to receive webhooks.
