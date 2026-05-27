# Analytics Facade Design

## Reader Line

Product surfaces should emit app-owned business events through one typed analytics facade. Vendor-specific delivery to PostHog, Customer.io, and Meta belongs behind that facade.

## User Situation

The app now tracks the core funnel with PostHog, Meta Pixel, and Customer.io. The current implementation works, but product screens call vendor helpers directly. This makes event changes expensive, makes payload consistency harder, and spreads consent/routing decisions across unrelated UI files.

## Promised End State

After this cleanup, migrated product code calls `trackAppEvent(eventName, payload)` for existing tracking events. The analytics layer owns event contracts, destination routing, consent gates, payload normalization, and vendor error isolation.

## Facade API

Product code should use one public API:

```ts
trackAppEvent("quiz_completed", {
  hairTexture,
  leadId,
  scalpCondition,
  scalpType,
  thickness,
})
```

The function should live in `src/lib/analytics/track-app-event.ts` and use a per-event TypeScript payload map from `src/lib/analytics/events.ts`.

Do not use object-style event calls or generated helper methods in this pass. The goal is a small, direct call-site contract that remains easy to search and easy to type.

Destination adapters under `src/lib/analytics/destinations/` should import existing vendor helpers, including `posthog`, `trackCustomerIoEvent`, and Meta helpers from `src/lib/meta-pixel.ts`.

## Destination Philosophy

PostHog receives broad product analytics events.

Customer.io receives broad lifecycle and campaign-relevant events.

Meta receives acquisition funnel events through successful purchase or subscription, including quiz step progression. Meta does not receive post-purchase usage, chat, recommendation, onboarding, or result-sharing events.

## Target Event Routing

This table is the target after the facade migration. It intentionally widens destination coverage for some event names that already fire today. It does not introduce new app event names, but it does add new event-destination pairs for better shared funnel visibility.

| Event | PostHog | Customer.io | Meta |
| --- | --- | --- | --- |
| `quiz_started` | yes | yes | yes |
| `quiz_step_viewed` | yes | yes | yes |
| `quiz_goals_selected` | yes | yes | no |
| `quiz_completed` | yes | yes | yes |
| `quiz_lead_captured` | yes | yes | yes |
| `pricing_viewed` | yes | yes | yes |
| `checkout_started` | yes | yes | yes |
| `subscription_started` | yes | yes | yes |
| `purchase_completed` | yes | yes | yes |
| `result_page_viewed` | yes | yes | no |
| `result_shared` | yes | yes | no |
| `onboarding_completed` | yes | yes | no |
| `first_chat_message` | yes | yes | no |
| `chat_product_recommendation_shown` | yes | yes | no |

## Destination Expansion

The implementation plan must call out these expansions explicitly so dashboard owners are not surprised:

| Event | New Destination Coverage |
| --- | --- |
| `quiz_started` | add PostHog |
| `pricing_viewed` | add PostHog |
| `checkout_started` | add PostHog |
| `subscription_started` | add PostHog |
| `purchase_completed` | add PostHog |
| `first_chat_message` | add Customer.io |
| `onboarding_completed` | add Customer.io |

`quiz_goals_selected` also gains Customer.io coverage, but stays out of Meta because selected goals can move closer to user preference or concern detail than Meta needs for acquisition optimization.

## Privacy And Payload Rules

The facade must not send raw email addresses, chat text, free-text quiz answers, or sensitive derived details to vendor payloads.

Payloads should use app-owned names at the call site. Destination adapters may translate names to vendor-specific fields.

Undefined payload values should be removed before dispatch.

Vendor failures must be best-effort and must not break product flows.

Each destination dispatch should be isolated in its own `try/catch`. A Meta failure must not prevent PostHog or Customer.io dispatch, and the facade must not use fail-fast orchestration for vendor calls.

## Provider Ownership

The facade is dispatch-only. Providers still own SDK initialization, pageviews, consent grants/revokes, identify, reset, and lifecycle setup:

- `PostHogClientProvider` owns PostHog init, identity, and `$pageview`.
- `MetaPixelProvider` owns Meta init, consent grant/revoke, and `PageView`.
- `CustomerIoProvider` owns Customer.io init, pageviews, identify, reset, and client lifecycle.

The facade may read current route/consent state at dispatch time, but it must not move provider responsibilities into product-event dispatch.

## Consent Decision

This cleanup preserves current PostHog dispatch behavior. The facade should not add a new analytics-consent gate for PostHog app events.

Customer.io keeps its existing browser-client gating. Meta keeps its existing marketing-consent gating.

Consent alignment for PostHog provider/pageview behavior is a separate privacy cleanup, not part of this implementation.

## Scope Boundaries

This cleanup is client-side only. Server-side analytics for durable business truth events is a later project.

Existing event names stay mostly as-is. This project does not perform a naming convention migration.

Existing vendor helpers stay in place where useful. The facade should call them rather than rewriting SDK setup.

The cookie/privacy copy should not change unless implementation discovers a new consent behavior.

## Non-Goals

Do not introduce GTM, Segment, or Customer.io-as-router in this pass.

Do not add new app event names beyond the currently tracked set unless a tiny adapter-only mapping is required to preserve existing behavior. Destination expansion for existing event names is in scope and is documented above.

Do not migrate pageview providers or vendor initialization providers unless needed for the facade to work.

Do not send post-purchase product usage, chat, recommendation, onboarding, or result-sharing events to Meta.
