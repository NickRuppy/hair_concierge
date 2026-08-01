# Payment monitor runtime repair

## Outcome

The local macOS payment monitor completes against the production endpoint, reports privacy-safe provider failure categories when it cannot complete, and reliably delivers monitor failures to Sentry before the serverless request ends.

This is backend/operator-only work. It changes no checkout UI, payment authorization, webhook handling, billing state, or entitlement behavior, so no user-facing mockup is required.

## Confirmed failure

- The authenticated production endpoint returns `500 monitor_failed` after roughly 13 seconds.
- The result contains one provider error and one incomplete provider scan.
- The local trigger aborts after 10 seconds even though the server route has a 40-second work budget.
- PayPal renewal history is fetched one subscription at a time. Production currently has 38 PayPal subscription rows, so the candidate cap does not bound wall-clock duration.
- No `payment_monitor_failed` issue arrived in Sentry after the failed production runs.
- The authenticated response exposes only aggregate counters, so the local operator cannot identify which provider/reason failed.

## Repair

1. Give the local trigger a 50-second request budget so it encloses the 40-second server budget and response overhead.
2. Fetch PayPal provider rows with bounded concurrency, abort timed-out requests, and share in-flight OAuth token acquisition while preserving the existing coverage of historical subscriptions.
3. Return and log only the closed, privacy-safe monitor failure fields: provider, reason, and error family.
4. Await a bounded Sentry flush before returning a monitor failure from the serverless route.
5. Keep the LaunchAgent unloaded until a manual authenticated production run succeeds.

## Verification

- Focused trigger, route, integrity-runtime, and observability tests.
- Typecheck and repository readiness checks.
- Independent code review.
- After explicit ship authorization: production deployment, authenticated manual run returning `200 completed`, Sentry delivery smoke, then LaunchAgent bootstrap/kickstart and log verification.

## Stop boundary

Prepare a verified review-ready branch. Do not commit, push, open a PR, merge, deploy, or load the LaunchAgent without explicit authorization.
