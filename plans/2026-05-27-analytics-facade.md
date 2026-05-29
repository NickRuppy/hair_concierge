# Analytics Facade Implementation Plan

Spec: [2026-05-27-analytics-facade-design.md](../docs/superpowers/specs/2026-05-27-analytics-facade-design.md)

## User Situation

PostHog, Meta Pixel, and Customer.io are now all wired into product flows. The tracking works, but screens directly import vendor helpers, so each screen knows too much about destination routing, payload differences, and consent behavior.

## Promised End State

Core tracked product events go through a typed `trackAppEvent(eventName, payload)` facade. Product code emits app-owned business events, while the analytics layer handles PostHog, Customer.io, and Meta routing behind a small, explicit, testable boundary.

## Target File Map

Create:

```txt
src/lib/analytics/events.ts
src/lib/analytics/routes.ts
src/lib/analytics/track-app-event.ts
src/lib/analytics/destinations/posthog.ts
src/lib/analytics/destinations/customerio.ts
src/lib/analytics/destinations/meta.ts
tests/analytics-tracking.test.ts
```

Update:

```txt
src/app/quiz/page.tsx
src/components/quiz/quiz-lead-capture.tsx
src/components/quiz/quiz-results.tsx
src/app/pricing/pricing-cards.tsx
src/components/quiz/result-offer-pricing.tsx
src/app/welcome/checkout-return-analytics.tsx
src/app/result/[leadId]/result-client.tsx
src/components/onboarding/onboarding-flow.tsx
src/hooks/use-chat.ts
src/components/chat/chat-message.tsx
src/components/quiz/quiz-goals.tsx
```

Reuse:

```txt
src/lib/meta-pixel.ts
src/lib/customerio-tracking.ts
src/providers/posthog-provider.tsx
src/lib/cookie-consent.ts
```

## Scope Boundaries

Implement a client-side analytics facade only.

Keep vendor initialization providers as they are.

Keep existing event names unless a vendor adapter already maps to a vendor-specific name.

Do not add server-side Customer.io, PostHog, Meta CAPI, GTM, or a new cookie category.

Do not send post-purchase product usage, chat, recommendation, onboarding, result-page, or result-sharing events to Meta.

Do not migrate provider-owned pageviews, SDK initialization, identify, consent grant/revoke, or reset behavior into this facade.

Do not add new app event names. This plan does intentionally add new event-destination pairs for existing events; those expansions are listed below.

## Routing Contract

Meta receives acquisition funnel events through successful purchase/subscription:

```txt
quiz_started
quiz_step_viewed
quiz_completed
quiz_lead_captured
pricing_viewed
checkout_started
subscription_started
purchase_completed
```

PostHog and Customer.io receive all currently tracked app events in this migration:

```txt
quiz_started
quiz_step_viewed
quiz_goals_selected
quiz_completed
quiz_lead_captured
pricing_viewed
checkout_started
subscription_started
purchase_completed
result_page_viewed
result_shared
onboarding_completed
first_chat_message
chat_product_recommendation_shown
```

This migration widens destination coverage for these existing events:

| Event | Current Gap | Target Change |
| --- | --- | --- |
| `quiz_started` | no PostHog call today | add PostHog |
| `pricing_viewed` | no PostHog call today | add PostHog |
| `checkout_started` | no PostHog call today | add PostHog |
| `subscription_started` | no PostHog call today | add PostHog |
| `purchase_completed` | no PostHog call today | add PostHog |
| `first_chat_message` | no Customer.io call today | add Customer.io |
| `onboarding_completed` | no Customer.io call today | add Customer.io |
| `quiz_goals_selected` | no Customer.io call today | add Customer.io, but keep Meta off |

## Facade Contract

Use this call shape everywhere:

```ts
trackAppEvent("checkout_started", {
  interval: selectedInterval,
  leadId,
  source: "pricing_page",
})
```

Do not introduce object-style calls such as `trackAppEvent({ type, payload })` or generated helpers such as `appEvents.checkoutStarted(...)` in this pass.

The facade API lives in `src/lib/analytics/track-app-event.ts`.

The event payload contract lives in `src/lib/analytics/events.ts` as an `AppEventMap`, with `AppEventName = keyof AppEventMap`.

Destination adapters live under `src/lib/analytics/destinations/` and call the existing vendor helpers.

## Provider Ownership

Provider components stay responsible for SDK lifecycle and passive provider events:

- `PostHogClientProvider` keeps PostHog init, identity, and `$pageview`.
- `MetaPixelProvider` keeps Meta init, consent grant/revoke, and `PageView`.
- `CustomerIoProvider` keeps Customer.io init, pageviews, identify, reset, and client lifecycle.

The facade is dispatch-only. It routes product events and may read route/consent state, but it must not move provider setup responsibilities into product-event tracking.

## Consent Decision

Preserve current PostHog dispatch behavior. Do not add a new analytics-consent gate for PostHog app events in this facade PR.

Customer.io keeps its existing browser-client gating. Meta keeps its existing marketing-consent gating.

Consent alignment for PostHog provider/pageview behavior is a separate privacy cleanup, not part of this implementation.

## Naming Decisions

Use app-owned canonical event names at call sites.

For result sharing, use canonical app event `result_shared` for both quiz-result and public-result contexts. The PostHog adapter may preserve the current historical PostHog name `quiz_result_share_clicked` for quiz-result shares if preserving dashboard continuity is more important than immediate PostHog naming cleanup.

Provider pageview events stay outside the facade.

## Tasks

- [ ] Create `src/lib/analytics/events.ts`.
  - Define `AppEventMap` with typed payloads for the routed events.
  - Use app-owned payload field names such as `leadId`, `stepName`, `stepNumber`, `source`, `interval`, `checkoutSessionId`, `currency`, `value`, and `method`.
  - Exclude raw email, chat text, free-text quiz answers, and sensitive derived details.
  - Export `AppEventName = keyof AppEventMap`.

- [ ] Create `src/lib/analytics/routes.ts`.
  - Define an `eventRoutes` table keyed by `AppEventName`.
  - Route PostHog and Customer.io broadly.
  - Route Meta only to acquisition funnel events through purchase/subscription.
  - Include the vendor-specific Meta event mapping where existing helpers require it.

- [ ] Create `src/lib/analytics/destinations/posthog.ts`.
  - Wrap `posthog.capture`.
  - Normalize app payload keys into the current PostHog property style when needed.
  - Keep failures best-effort and development-visible.

- [ ] Create `src/lib/analytics/destinations/customerio.ts`.
  - Wrap `trackCustomerIoEvent`.
  - Normalize camelCase app payload keys to the existing Customer.io snake_case fields.
  - Preserve Customer.io's current no-op behavior when consent or client setup prevents dispatch.

- [ ] Create `src/lib/analytics/destinations/meta.ts`.
  - Reuse existing helpers in `src/lib/meta-pixel.ts` rather than rewriting Pixel calls.
  - Map app events to current Meta standard/custom behavior:
    - `quiz_started` -> `trackMetaQuizStarted`
    - `quiz_step_viewed` -> `trackMetaQuizStepViewed`
    - `quiz_completed` -> `trackMetaQuizCompleted`
    - `quiz_lead_captured` -> `trackMetaLeadCaptured`
    - `pricing_viewed` -> `trackMetaPricingViewed`
    - `checkout_started` -> `trackMetaCheckoutStarted`
    - `subscription_started` -> `trackMetaSubscriptionConfirmed`
    - `purchase_completed` -> `trackMetaPurchaseConfirmed`
  - Keep Meta skipped for non-funnel events.

- [ ] Create `src/lib/analytics/track-app-event.ts`.
  - Export `trackAppEvent<E extends AppEventName>(eventName: E, payload: AppEventMap[E])`.
  - Remove `undefined` values once at the facade boundary.
  - Read route config and dispatch to each destination through a safe wrapper.
  - Return a compact delivery result for tests and optional development debugging, such as `{ posthog: boolean, customerio: boolean, meta: boolean }`.
  - Do not throw from vendor failures.
  - Wrap each destination dispatch independently. Do not use fail-fast orchestration where one vendor failure prevents later vendor dispatches.

- [ ] Migrate quiz funnel call sites.
  - Replace direct PostHog, Customer.io, and Meta calls in `src/app/quiz/page.tsx`.
  - Replace direct calls in `src/components/quiz/quiz-lead-capture.tsx`.
  - Replace direct calls in `src/components/quiz/quiz-results.tsx`.
  - Replace `quiz_goals_selected` in `src/components/quiz/quiz-goals.tsx` with `trackAppEvent`.

- [ ] Migrate pricing and checkout call sites.
  - Replace direct calls in `src/app/pricing/pricing-cards.tsx`.
  - Replace direct calls in `src/components/quiz/result-offer-pricing.tsx`.
  - Replace direct calls in `src/app/welcome/checkout-return-analytics.tsx`.

- [ ] Migrate lifecycle and engagement call sites.
  - Replace direct calls in `src/app/result/[leadId]/result-client.tsx`.
  - Replace quiz-result share tracking in `src/components/quiz/quiz-results.tsx` with canonical `result_shared`; preserve or explicitly map the existing PostHog `quiz_result_share_clicked` name in the PostHog adapter.
  - Replace direct calls in `src/components/onboarding/onboarding-flow.tsx`.
  - Replace direct calls in `src/hooks/use-chat.ts`.
  - Replace direct calls in `src/components/chat/chat-message.tsx`.

- [ ] Keep provider-level pageviews and identity setup untouched.
  - Leave `PostHogClientProvider`, `MetaPixelProvider`, and `CustomerIoProvider` responsible for setup, consent syncing, pageviews, and identity.
  - Do not move SDK initialization into the facade.
  - Leave PostHog `$pageview` and Meta `PageView` outside `trackAppEvent`.

- [ ] Add tests in `tests/analytics-tracking.test.ts`.
  - Test that `quiz_step_viewed` routes to PostHog, Customer.io, and Meta.
  - Test that `purchase_completed` routes to all three.
  - Test that `first_chat_message` routes to PostHog and Customer.io but not Meta.
  - Test that `result_shared` routes to PostHog and Customer.io but not Meta.
  - Test that `undefined` payload values are stripped.
  - Test that destination exceptions do not throw from `trackAppEvent`.
  - Test that one destination exception does not prevent the remaining destinations from being attempted.

- [ ] Add a final direct-import audit.
  - Use `rg` to confirm migrated product files no longer import `posthog`, `trackMeta...`, or `trackCustomerIoEvent`.
  - Allow vendor imports only inside providers, destination adapters, and existing vendor helper modules.

## Verification

Automated:

```bash
npm run test:node -- tests/analytics-tracking.test.ts tests/customerio-tracking.test.ts tests/meta-pixel.test.ts
npm run typecheck
npm run lint
```

Manual/browser:

```bash
npm run dev:worktree
```

Then in the browser:

- Open the quiz with analytics and marketing consent accepted.
- Start the quiz and advance at least one step.
- Confirm network calls still reach PostHog, Customer.io, and Meta for funnel events.
- Complete lead capture and confirm Lead/Customer.io/PostHog calls still happen.
- Open a result/share or chat/product recommendation path and confirm Meta is not called for non-funnel events.

## Architecture Check

Before shipping, run `request-code-review` because this touches shared analytics boundaries and many product call sites.

The review should specifically check:

- product screens emit app events only;
- destination routing matches the table above;
- Meta does not receive post-purchase usage, chat, onboarding, recommendation, or result-sharing events;
- payloads do not include raw email, chat text, free-text quiz answers, or sensitive derived details;
- vendor failures remain best-effort.

## Execution Handoff

Use `branch-gate` first.

Then implement in a repo-local worktree from current `origin/main`, preferably:

```bash
npm run worktree:new -- analytics-facade
```

Use `superpowers:subagent-driven-development` only if splitting implementation by destination adapters and call-site migration. Otherwise use `superpowers:executing-plans` because the task sequence is tightly coupled.
