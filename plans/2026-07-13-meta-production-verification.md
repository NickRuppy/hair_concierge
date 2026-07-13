# Meta Production Tracking Verification Plan

## Goal

Make the existing Meta tracking path usable for the current closed-cohort production test:

- queue browser events from the first visit regardless of the cookie-banner choice, then initialize
  the Pixel after first paint and flush them in order;
- include the coherent funnel package key on supported browser and server Meta events;
- prove the Stripe `Purchase` browser event and Meta CAPI event use the same Stripe Checkout Session ID for deduplication.

## Chosen Direction

The Meta provider queues route events immediately. The shared analytics runtime initializes the Pixel
unconditionally after first paint and flushes queued events in FIFO order. Neither layer reads or
reacts to the marketing-consent value. The existing cookie banner and consent storage remain
unchanged.

This is an explicit product decision for the current production test, despite the known German/EU consent risk. It is not represented as legal compliance and does not introduce a fake consent state or a special test-traffic marker.

## Scope

1. Preserve `src/providers/meta-pixel-provider.tsx` route page-view deduplication and let events queue
   before runtime readiness. Keep SDK initialization in `AnalyticsRuntimeCoordinator` after first
   paint.
2. Preserve the post-paint runtime contract tests while proving the Meta path has no cookie-consent
   imports or marketing-consent gate.
3. Keep the queue-based `src/lib/meta-pixel.ts` runtime and extend only the package-key and Purchase
   deduplication payloads required for attribution.
4. Update `docs/funnel-attribution.md` to state the actual production Pixel behavior and package-key configuration.
5. Configure production Meta package-key flags, and inspect/configure the existing CAPI environment without exposing secrets. Set `NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED=true` before triggering the fresh production build because public environment values are inlined at build time; the server flag remains runtime configuration.
6. Deploy the reviewed change, verify the non-payment funnel in Meta and Supabase, and create a Stripe
   checkout without submitting payment. Leave browser/server Purchase deduplication for the owner's
   controlled purchase.

## Non-Goals

- No PayPal verification.
- No cookie-banner redesign or consent-policy implementation.
- No new campaign parameters, traffic markers, experiments, or funnel variants.
- No change to Stripe prices, products, checkout behavior, or billing entitlements.
- No real purchase without action-time confirmation.
- No environment kill switch. The accepted rollback is a code revert and production redeploy.

## Verification

- Focused analytics/provider tests pass.
- Meta CAPI destination tests pass, including package-key gating and Stripe Checkout Session ID reuse.
- Typecheck and lint pass for the changed surface; build passes before production deployment.
- Production browser requests show the correct Pixel ID, `PageView`, and `funnel_package_key` where supported, independent of the banner choice.
- The Pixel ID in browser network requests equals the CAPI `META_PIXEL_ID`; browser/server deduplication is invalid if the destinations differ.
- A controlled owner purchase remains the final check that Meta receives browser and server
  `Purchase` with the same Stripe Checkout Session ID and deduplicates them.

## Review And Stop Gates

- Run a read-only Claude plan review before edits and classify its findings.
- Run a read-only Claude whole-branch review after checks and before any push.
- Stop before staging, commit, push, PR creation, or real payment unless the user separately authorizes that action.
