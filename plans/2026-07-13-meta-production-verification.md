# Meta Production Tracking Verification Plan

## Goal

Make the existing Meta tracking path usable for the current closed-cohort production test:

- load the browser Pixel and send `PageView` from the first visit regardless of the cookie-banner choice;
- include the coherent funnel package key on supported browser and server Meta events;
- prove the Stripe `Purchase` browser event and Meta CAPI event use the same Stripe Checkout Session ID for deduplication.

## Chosen Direction

The Meta Pixel provider initializes unconditionally. It no longer reads or reacts to the marketing-consent value. The existing cookie banner and consent storage remain unchanged for other integrations.

This is an explicit product decision for the current production test, despite the known German/EU consent risk. It is not represented as legal compliance and does not introduce a fake consent state or a special test-traffic marker.

## Scope

1. Simplify `src/providers/meta-pixel-provider.tsx` so route page views call `initMetaPixel()` and then `grantMetaPixelConsent()` unconditionally before tracking. Preserve page-view deduplication. The grant call remains necessary because the existing Meta helper layer uses it to enable standard and custom event dispatch internally.
2. Add a focused provider contract test proving the provider no longer imports `@/lib/cookie-consent` or listens for `COOKIE_CONSENT_CHANGE_EVENT`, while requiring the unconditional init-then-grant sequence. The required Meta helper call is not treated as cookie-banner consent coupling.
3. Preserve `src/lib/meta-pixel.ts` consent helpers for compatibility with existing tests/callers; do not rewrite purchase deduplication or event wrappers.
4. Update `docs/funnel-attribution.md` to state the actual production Pixel behavior and package-key configuration.
5. Configure production Meta package-key flags, and inspect/configure the existing CAPI environment without exposing secrets. Set `NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED=true` before triggering the fresh production build because public environment values are inlined at build time; the server flag remains runtime configuration.
6. Deploy the reviewed change, verify `PageView` and a funnel event in Meta, then verify Stripe Purchase browser/server deduplication. Stop before submitting a real payment for explicit confirmation.

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
- Meta Test Events or Events Manager shows the Stripe browser and server `Purchase` events sharing one event ID and being deduplicated.

## Review And Stop Gates

- Run a read-only Claude plan review before edits and classify its findings.
- Run a read-only Claude whole-branch review after checks and before any push.
- Stop before staging, commit, push, PR creation, or real payment unless the user separately authorizes that action.
