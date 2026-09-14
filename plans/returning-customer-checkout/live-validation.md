# Live checkout validation and speed comparison

Nick requested this follow-up when authorizing commit, push and draft PR publication on 2026-09-14. Run the user simulation against the verified production deployment after the migration-first release. Publication is not evidence that the change is live.

## Before-release evidence

Production was rechecked during publication: `chaarlie.de` still resolves to READY deployment `dpl_H9jHvejxqs9NSrzpxAxj9XFHUVpT`, commit `5a3e33f1f641a8693209017ad25c4c9c69870df2`; refreshed `origin/main` matches. The live `/reactivate` page redirects the available signed-out browser to `/auth?next=%2Freactivate`, so no controlled PayPal button-ready or click-to-approval timing could be collected from this session. Login-page loading is not a checkout-speed baseline.

The [telemetry baseline probe](speed-baseline.md) also found no paired PayPal load-start/ready observations: the current-production window has no matching events; the older historical window has 10 ready events but no load-start events. These counts describe instrumentation coverage, not latency.

The required migration `20260913202413_membership_reactivation_stripe_context.sql` remains unapplied. Production records the earlier partner migration as `20260913185745_partner_access_fresh_start`; the repository timestamp differs, with equivalent function bodies verified in the production baseline receipt. Use the surgical migration-first sequence, not a blanket migration push.

## Repeatable speed measurements

Measure the old paywall and reactivation separately, using the same browser/device, network, subscription interval and account eligibility before and after. Record deployment SHA, UTC timestamp, cache state and sample count. Prefer mobile Safari and desktop Chrome. Do not compare local development timings with production.

| Measurement | Start | End | Meaning |
| --- | --- | --- | --- |
| PayPal readiness | PayPal UI starts loading / provider_load_started | PayPal button is rendered and enabled / provider_ready | SDK and embed loading |
| Click to approval screen | User clicks PayPal | PayPal approval screen is usable | Includes the application intent request and provider creation; excludes user login/decision time |
| Intent request | Browser sends create-subscription-intent | Response received | Application-side contribution to click delay |
| Recovery response | User clicks Status prüfen | Resumed destination or pending message becomes visible | Existing-attempt status check, not a fresh payment |

For readiness, collect three cold and three warm loads per available browser/surface and report individual values, median and range. For payment and recovery, report only the valid test attempts actually exercised. Never start extra subscriptions or reset uncertain attempts merely to increase the sample size. Record failures/timeouts alongside successful timings; do not calculate optimistic speed from successful samples alone. A small sample is descriptive, not statistical proof of no regression.

Use browser network timings or existing lifecycle timestamps. In telemetry, pair events from the same checkout attempt and open index, and subtract elapsed values: provider_ready alone can include earlier customer think time. Keep historical telemetry separate from controlled browser measurements. A new post-release observation with no comparable pre-release sample must be labeled unpaired.

## User simulation after release

Use a designated test identity with expired access and a stable login email. The existing affected customer attempts stay analysis-only. Establish the provider-test setup before payment actions; this document does not authorize a live charge or production account seeding.

1. Verify the migration and exact deployed SHA before entering checkout.
2. Exercise returning-customer purchase eligibility on the old paywall and `/reactivate`, recording the speed measurements above. Check that current paid/manual/partner access prevents a second purchase.
3. Exercise an expired sign-in session: the explicit German sign-in action retains interval and destination; signing in does not submit payment.
4. Exercise recovery with designated test attempts: preserve the original provider and interval, resume the existing payment when known, and keep an uncertain outcome pending. Check Status prüfen and Problem melden without contacting affected customers.
5. For any separately authorized completed provider payment, verify webhook-confirmed access on the original login account, independent of billing email; verify no duplicate subscription. A simulation that stops before payment cannot claim this coverage.
6. Review mobile copy/layout and Sentry/runtime errors for the test window. Record completed steps, blocked steps, measured timings and before/after differences in the release receipt.

The local provider-mocked tests, PGlite SQL checks and Claude review remain useful pre-release evidence. They do not replace real-provider or independent PostgreSQL connection verification.
