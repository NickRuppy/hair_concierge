# Payment monitor internal-test enrichment

## Outcome

Prevent historical production QA checkouts from triggering the real-customer Sentry alert when provider metadata predates the `is_internal_test` marker.

## Implementation

1. Carry the checkout's existing `funnel_session_id` only inside the server-side reconciliation hint.
2. Resolve `funnel_sessions.is_internal_test` by that exact ID during the local-state lookup.
3. Promote the finding to `isInternalTest: true` when either provider metadata or the exact local funnel session marks it as QA.
4. Keep the mismatch visible in Sentry for diagnosis; the active alert rule continues to exclude internal tests.

## Verification

- Unit coverage for generic reconciliation promotion and Stripe runtime enrichment.
- Payment integrity, monitor route, and observability test suites.
- Typecheck, lint, and production build.
- Production monitor proof after deployment.
