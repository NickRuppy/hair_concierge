# Funnel Attribution Infrastructure Implementation Plan

> **For implementation:** Follow this plan task-by-task, keep the checkbox status current, and state the compact execution contract below before code edits. Use formal Goal mode only if Nick explicitly requests it.

**Goal:** Add the infrastructure for campaign-matched funnel packages so one explicit entry URL starts or continues one coherent package journey, the shared quiz stays unchanged, and Supabase can trace a browser across multiple journeys from first touch through paid purchase.

**Chosen direction:** Infrastructure first. Use `funnel_sessions` plus append-only `funnel_events`, a package registry, and a signed proxy-owned browser context that keeps one 90-day visitor ID while explicit entry URLs create coherent package sessions. Preserve current analytics/billing integrations. Do not create real marketing variants yet; ship only the default package plus one placeholder `/lp/...` package to prove routing.

**Claude review status:** Reviewed with Claude Code during initial and final hardening passes. The final verdict was "approve with revisions"; all accepted technical revisions are incorporated:

- Decide cookie write location now: use the existing `src/proxy.ts` Next proxy hook. Do not add `middleware.ts`; Next 16 rejects both files together.
- Add a master kill-switch before touching checkout paths.
- Add `src/lib/analytics/routes.ts` and per-destination adapter work to the analytics tasks.
- Do not assume unknown funnel fields pass through PostHog, Customer.io, or Meta adapters.
- Do not add funnel metadata to Meta's existing consent-bypassed browser purchase path without an explicit privacy/product decision.

Explicitly rejected/deferred review suggestions:

- Keep `funnel_events`; Nick explicitly chose raw, replayable Supabase event history.
- Keep `landing_variant` and `offer_variant`; independent variants are a near-term requirement.
- Keep `FUNNEL_META_CUSTOM_DATA_ENABLED`; it controls package-key-only forwarding after Meta Test Events validation.
- Keep the 15-minute pending-touch cookie; Nick explicitly chose accurate fast-navigation UTM/`fbclid` capture.
- Defer production enablement, not implementation, until the German pre-consent cookie classification/legal basis is reviewed.

Claude's recommendation to cut `funnel_events` was a scope tradeoff, not a technical blocker. After explicit review on 2026-07-10, Nick chose to keep both tables: `funnel_sessions` for convenient funnel reporting and `funnel_events` for the detailed, auditable action history used to drive downstream forwarding.

## Product Decisions

- `/` always remains the default homepage and starts or continues a `default_organic` journey; it never redirects to an older campaign landing page.
- Direct `/quiz` continues the current signed journey when one exists, otherwise it starts `default_organic`.
- Campaign traffic uses `/lp/<slug>` URLs. Each slug maps to exactly one funnel package.
- No `?package=` or package-selection query parameters in v1.
- UTM parameters and `fbclid` are reporting metadata only; they do not select the package.
- The signed browser context persists for 90 days and keeps one stable `visitorId` while allowing multiple package-specific `sessionId` journeys.
- Visiting an explicit entry URL whose package differs from the active package starts a new session under the same visitor ID. Re-entering the same package URL continues that package session.
- The proxy owns the active journey through one signed, tamper-resistant context cookie containing `visitorId`, `sessionId`, and `packageKey`; Supabase remains the reporting source of truth.
- A separate signed, `HttpOnly` transfer cookie may hold compact unsaved first-touch fields for at most 15 minutes; it is deleted immediately after a successful Supabase write and never controls package selection.
- Quiz remains shared and visually unchanged.
- Initial package content is placeholder/reused. Real 2-4 ad packages come later.
- Every funnel session snapshots both `landing_variant` and `offer_variant` because independent variants of each are an explicit near-term requirement; later registry edits must not rewrite what a visitor actually saw.
- Price/plan-ID variants are out of v1 scope, but the package model should not block them later.
- Stripe Checkout and PayPal checkout intents must carry `funnel_session_id` and `funnel_package_key`; confirmed purchases use that metadata as their primary attribution source.
- Meta receives routed funnel events and stable event IDs under the existing consent posture. `funnel_package_key` is additionally sent when `FUNNEL_META_CUSTOM_DATA_ENABLED=true`; the raw funnel session ID always remains internal.
- Normal funnel events forward immediately on a best-effort basis. Only server-confirmed billing events use the existing automatic retry outbox; v1 adds no general analytics worker or delivery queue.
- Supabase is the canonical attribution source. Customer.io, PostHog, Meta Pixel/CAPI are destinations.

## Non-Goals

- Do not write final ad/landing/offer copy variants.
- Do not build an admin/CMS UI for package creation.
- Do not add randomized A/B assignment.
- Do not implement price tests or create new Stripe prices / PayPal plans.
- Do not change quiz question order, quiz UX, recommendation logic, or billing entitlement behavior.
- Do not change Meta consent posture.
- Do not build a general-purpose analytics retry worker or delivery queue.
- Do not make `/lp/...` pages SEO-indexable by default.

## Source Context

Relevant current files:

- `src/app/page.tsx`: root landing renders the landing sections plus `LandingTracking`.
- `src/providers/route-providers.tsx`: central public/app provider wiring for Meta, Customer.io, PostHog.
- `src/providers/posthog-provider.tsx`: manual `$pageview` capture.
- `src/lib/analytics/events.ts`: typed browser analytics event map.
- `src/lib/analytics/routes.ts`: closed route table with `satisfies Record<AppEventName, AppEventRoute>`.
- `src/lib/analytics/track-app-event.ts`: client event dispatcher.
- `src/lib/analytics/destinations/{posthog,customerio,meta}.ts`: destination adapters with per-event mapping.
- `src/app/quiz/page.tsx`: quiz start/step analytics.
- `src/components/quiz/quiz-results.tsx`: quiz completion analytics and result/offer transition.
- `src/components/quiz/quiz-lead-capture.tsx`: lead capture POST and `quiz_lead_captured`.
- `src/app/api/quiz/lead/route.ts`: lead insert/dedupe and Customer.io quiz sync.
- `src/app/result/[leadId]/page.tsx`: persistent result/offer route with existing `noindex` metadata pattern.
- `src/components/quiz/quiz-result-offer-page.tsx`: offer shell.
- `src/components/quiz/result-offer-pricing.tsx`: offer pricing view and checkout start analytics.
- `src/app/api/stripe/create-checkout-session/route.ts`: Stripe checkout creation, currently resolves `lead_id`.
- `src/lib/stripe/checkout-session-params.ts`: Stripe Checkout `metadata`, currently only `lead_id`.
- `src/app/api/paypal/create-subscription-intent/route.ts`: PayPal intent creation.
- `src/lib/paypal/checkout-intents.ts`: PayPal intent row already has `metadata`.
- `src/app/api/stripe/webhook/route.ts`, `src/lib/paypal/webhook-handlers.ts`: billing analytics event creation.
- `src/lib/billing/analytics-outbox.ts`: server-side billing analytics outbox. Payload is effectively write-once per `event_key`.
- `src/lib/billing/analytics-destinations/meta-capi.ts`: Meta CAPI delivery with an explicit `custom_data` allowlist.
- `src/proxy.ts`: existing Next proxy hook; currently handles `www.chaarlie.de` redirect and Supabase auth session refresh via `updateSession(request)`.
- `src/lib/supabase/middleware.ts`: auth/public-route classifier called by `src/proxy.ts`; new landing and funnel API prefixes must be explicitly public and fast or anonymous traffic is redirected.
- `tests/analytics-tracking.test.ts`, `tests/acquisition-funnel-tracking.test.ts`, `tests/stripe-checkout-session-params.spec.ts`, `tests/payment-method-checkout.test.tsx`, `tests/billing-analytics-destinations.test.ts`: focused existing test anchors.

## Target Architecture

### Package Registry

Create `src/lib/funnel/packages.ts`:

```ts
type FunnelPackage = {
  key: string
  slug: string | null
  channel: "organic" | "meta" | "internal"
  status: "active" | "placeholder" | "archived"
  landingVariant: string
  offerVariant: string
}
```

Required v1 packages:

- `default_organic`: `slug: null`, `channel: "organic"`, `landingVariant: "default"`, `offerVariant: "default"`.
- `scalp_check_placeholder`: `slug: "scalp-check"`, `channel: "meta"`, placeholder status, default landing/offer variants.

Use English keys/slugs for operator ergonomics. Keep all user-facing UI copy in German.

### Supabase Attribution Tables

Create one additive migration:

`supabase/migrations/20260711120000_funnel_attribution.sql` or the next unused timestamped migration filename. Recheck immediately before implementation because migrations may land in parallel.

Table: `public.funnel_sessions`

Recommended columns:

- `id uuid primary key` (the signed context cookie's current `sessionId`)
- `visitor_id uuid not null` (the signed context cookie's stable 90-day browser identifier; links multiple sessions without a separate visitor table)
- `package_key text not null`
- `landing_slug text`
- `channel text not null`
- `landing_variant text not null default 'default'`
- `offer_variant text not null default 'default'`
- `entry_path text`
- `entry_url text`
- `referrer text`
- `first_touch jsonb not null default '{}'::jsonb`
- `first_seen_at timestamptz not null default now()`
- `last_seen_at timestamptz not null default now()`
- `landing_viewed_at timestamptz`
- `quiz_started_at timestamptz`
- `quiz_completed_at timestamptz`
- `lead_captured_at timestamptz`
- `offer_viewed_at timestamptz`
- `checkout_started_at timestamptz`
- `purchase_completed_at timestamptz`
- `lead_id uuid references public.leads(id) on delete set null`
- `user_id uuid references public.profiles(id) on delete set null`
- `purchase_provider text`
- `purchase_reference text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`first_touch` preserves the entry that created each package journey. Original and latest browser-level sources are derived by ordering `funnel_sessions` for the same `visitor_id`, rather than overwriting an earlier journey. Example compact fields:

```json
{
  "utm_source": "meta",
  "utm_medium": "paid_social",
  "utm_campaign": "scalp_july",
  "utm_content": "creative_03",
  "fbclid": "...",
  "referrer": "..."
}
```

Indexes:

- `funnel_sessions(visitor_id, first_seen_at)`
- `funnel_sessions(package_key, first_seen_at desc)`
- `funnel_sessions(lead_id)`
- `funnel_sessions(user_id)`
- `funnel_sessions(purchase_provider, purchase_reference)`
- optional partial indexes for milestone reporting only if query plans need them later.

Security:

- Enable RLS.
- Add no anon read/write policies in v1. Service-role/admin server code writes rows.
- Do not add direct browser writes to this table.

Table: `public.funnel_events`

Purpose:

- Keep one append-only row for every recorded funnel action.
- Preserve action order and repeated actions that the session summary intentionally collapses.
- Supply a stable, unique event ID for idempotent forwarding to Customer.io, Meta, PostHog, or the existing billing analytics path.
- Make forwarding discrepancies auditable without inferring events later from session timestamps.

Required event fields:

- `event_id text primary key`
- `funnel_session_id uuid not null references public.funnel_sessions(id) on delete cascade`
- `package_key text not null`
- `event_name text not null`
- `occurred_at timestamptz not null default now()`
- `lead_id uuid references public.leads(id) on delete set null`
- `checkout_provider text`
- `checkout_reference text`
- `properties jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Event rules:

- Generate `event_id` once for each genuine occurrence and reuse that exact value for the Supabase write, routed destinations, and any retry of that occurrence.
- Browser occurrences use `crypto.randomUUID()` converted to text. Server-confirmed billing occurrences reuse the existing stable billing `event_key`.
- Insert with `on conflict (event_id) do nothing`; receiving the same event ID again returns success without creating another row or forwarding duplicate meaning.
- A genuinely repeated action, such as a later offer view or a second checkout attempt, receives a new event ID and remains visible as a separate event.
- Treat the action fields as append-only; do not rewrite event meaning after insertion.
- Store `package_key` on the event as its compact, immutable package identifier.
- Use the related `funnel_sessions` row as the canonical full package/campaign snapshot.
- Do not repeat `landing_variant`, `offer_variant`, or complete campaign details on every event.
- Update the corresponding first-occurrence timestamp on `funnel_sessions` when an event is recorded.
- Do not periodically scan session timestamps and invent downstream events from them.
- Forward normal routed events immediately on a best-effort basis.
- Preserve stable event IDs so recorded events can be reconciled or deliberately replayed later without duplication.
- Do not add automatic retry/delivery-state machinery for non-billing events in v1.
- Continue using the existing billing analytics outbox for critical server-confirmed purchase delivery and retries.

Atomic recording:

- The migration must create one service-role-only Postgres function, `record_funnel_event(...)`, that inserts the event and updates the corresponding first-occurrence timestamp on `funnel_sessions` in one transaction.
- If `event_id` already exists, the function returns the existing event outcome without changing the session summary again.
- Revoke execute access from `public`, `anon`, and `authenticated`; only server-owned code may call the function.

### Proxy Cookie And Session Ownership

Update the existing `src/proxy.ts`.

The proxy owns first-party visitor continuity and the active package journey for:

- `/`
- `/lp/:slug`
- `/quiz`

Cookie rules:

- Cookie name: `chaarlie_funnel_session`.
- Value: a versioned, base64url-encoded payload containing `{ visitorId, sessionId, packageKey, issuedAt }` plus an HMAC signature created with Web Crypto so it works in the proxy runtime.
- `visitorId` and the first `sessionId` are generated by the proxy with `crypto.randomUUID()`; every `packageKey` must resolve through the package registry.
- Signing secret: `FUNNEL_COOKIE_SIGNING_SECRET`, required only when `FUNNEL_ATTRIBUTION_ENABLED=true`.
- Attributes: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, TTL: 90 days.
- On `/` or `/lp/:slug`, resolve the package from the current URL. If it differs from the active package, preserve `visitorId` and mint a new `sessionId` for the new journey.
- If the explicit entry URL resolves to the same package, preserve the existing `sessionId` so refreshes and same-package returns do not fragment one journey.
- On direct `/quiz`, continue a valid active journey; if none exists, mint a `default_organic` session.
- Never redirect `/` to a prior campaign URL solely because of cookie history.
- Invalid, expired, or tampered signatures are treated as no valid assignment; never trust an unsigned package selector from the browser.
- Use one long-lived signed context cookie only. Do not add a second client-readable package cookie.

Pending-touch transfer cookie:

- Cookie name: `chaarlie_funnel_touch`.
- Value: a versioned HMAC-signed payload containing `visitorId`, `sessionId`, `capturedAt`, entry path, an allowlisted/truncated UTM set, `fbclid`, and a compact referrer value.
- Attributes: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, TTL: 15 minutes.
- The proxy sets it on the relevant `/`, `/lp/:slug`, or direct `/quiz` entry when touch data still needs to cross into the server write path.
- Enforce strict per-field lengths and a conservative total payload-size limit before signing; discard excess/unrecognized query fields.
- The funnel API validates that both IDs match the signed context cookie, writes the session's first-touch fields only when absent, includes every new entry's compact touch fields on its `landing_viewed` event, and deletes the transfer cookie after success.
- Lead and checkout server paths may consume the same pending touch as a recovery path if the browser milestone call did not finish first.
- The transfer cookie never selects a package and adds no navigation wait or additional network request.

Proxy integration rules:

- Preserve the current `www.chaarlie.de` redirect.
- Preserve the current `updateSession(request)` behavior.
- Await `updateSession(request)` first, then attach any newly minted/refreshed funnel cookies to that final response object so they survive both normal responses and auth redirect responses.
- Do not add `middleware.ts`; this repo already has `src/proxy.ts`, and Next 16 throws `E900` if both proxy and middleware files are present.
- Apply funnel cookie logic only for `/`, `/lp/:slug`, and `/quiz` inside the existing broader proxy matcher.

Why proxy:

- `page.tsx` cannot write cookies.
- Proxy keeps `/` static and avoids forcing the ad landing page into dynamic rendering.
- Fast `/lp/... -> /quiz` clicks still carry the package through the cookie even if client analytics has not loaded.

Master kill-switch:

- Add `FUNNEL_ATTRIBUTION_ENABLED`.
- Create an edge-safe leaf module `src/lib/funnel/flags.ts` exposing `isFunnelAttributionEnabled()`; an unset flag evaluates to `false`.
- Keep cookie signing/parsing in an edge-safe `src/lib/funnel/cookie.ts`. Neither `src/proxy.ts` nor these leaf modules may import the admin Supabase client.
- When disabled, proxy and server helpers should return/pass through without breaking landing, quiz, checkout, or purchase flows.
- When enabled without `FUNNEL_COOKIE_SIGNING_SECRET`, fail attribution closed and surface a server-side configuration error without breaking the visible funnel.
- Verification must include checkout with the flag off.

### Server Helpers And API

Create `src/lib/funnel/server.ts`.

Responsibilities:

- Resolve package by pathname/slug.
- Parse and preserve each journey's first-touch fields; derive original/latest touch by ordering sessions for the same visitor ID.
- Validate and parse the proxy-issued signed context cookie.
- Validate and consume the short-lived pending-touch cookie only when its visitor/session IDs match the context cookie.
- Upsert `funnel_sessions`.
- Mark milestone timestamps idempotently with "first timestamp wins" semantics:
  - `landing_viewed_at`
  - `quiz_started_at`
  - `quiz_completed_at`
  - `lead_captured_at`
  - `offer_viewed_at`
  - `checkout_started_at`
  - `purchase_completed_at`
- Attach `lead_id` and `user_id`; checkout events carry provider-specific attempt references, while the session summary stores only the successful `purchase_provider` and `purchase_reference`.
- Insert idempotent `funnel_events` rows with stable `event_id` values.
- Load attribution by session ID, lead ID, or provider-specific checkout/purchase reference.

Create `src/app/api/funnel/session/route.ts`.

Responsibilities:

- Accept a small milestone payload such as `{ eventId, milestone: "landing_viewed" }`.
- Accept only the explicit funnel milestone allowlist and reject unknown names, oversized bodies, invalid UUID browser event IDs, and oversized properties.
- Infer visitor ID, session ID, and package key from the validated signed cookie.
- Consume first-touch fields from the validated transfer cookie and clear it after a successful write.
- Preserve repeated same-package entry touches in `landing_viewed` event properties without overwriting the session's original `first_touch`.
- Reuse `checkRateLimit` from `src/lib/rate-limit.ts` with a funnel-specific per-signed-session limit. Rate-limit failure may reject the write, but must never block the visible funnel.
- Record the event and matching summary milestone through the transactional `record_funnel_event(...)` RPC using the admin client.
- Return compact context to the browser when needed:
  - `funnelSessionId`
  - `funnelPackageKey`

The API is a best-effort operational write. It must never block or crash the visible funnel.

### Client Context

Create `src/lib/funnel/client.ts` and a tiny component if needed.

Responsibilities:

- Store/read a non-sensitive current funnel context returned by `/api/funnel/session`.
- Expose `getCurrentFunnelContext()` for analytics calls.
- Generate one `eventId` per genuine browser occurrence and pass the same ID to `/api/funnel/session` and each routed analytics destination.
- Keep the same `eventId` for any retry of that occurrence; create a new ID only for a genuinely new occurrence.
- Best-effort call `/api/funnel/session` on:
  - landing view
  - quiz start
  - quiz completion
  - offer view
  - checkout start

Do not make client storage the canonical assignment. The proxy cookie and Supabase row are canonical.

### Field Name Contract

Use this naming consistently:

| Meaning | TypeScript event | Supabase | PostHog | Customer.io | Stripe/PayPal metadata | Meta CAPI |
| --- | --- | --- | --- | --- | --- | --- |
| event id | `funnelEventId` | `funnel_events.event_id` | `$insert_id` | destination event id when supported | not required | `event_id` |
| session id | `funnelSessionId` | `id` | `funnel_session_id` | `funnel_session_id` | `funnel_session_id` | not sent in v1 |
| package key | `funnelPackageKey` | `package_key` | `funnel_package_key` | `funnel_package_key` | `funnel_package_key` | `funnel_package_key` when flag-enabled |

`landingVariant` and `offerVariant` intentionally stay on `funnel_sessions` even though the placeholder packages initially use `default`. Independent landing and offer variants are part of the planned package model, and the session columns preserve the exact historical combination shown. They are not repeated in browser events, `funnel_events`, or payment metadata in v1. PostHog and Customer.io receive the stable event ID, session ID, and package key where routed; Stripe and PayPal metadata receive the session ID and package key. Meta always receives the stable event ID needed for deduplication and may receive the package key behind the explicit flag, but never receives the raw funnel session ID.

### Analytics Contract

Add optional funnel fields to relevant `AppEventMap` payloads:

- `funnelEventId?: string | null`
- `funnelSessionId?: string | null`
- `funnelPackageKey?: string | null`

Apply to:

- `quiz_started`
- `quiz_completed`
- `quiz_lead_captured`
- new `offer_viewed`
- `pricing_viewed`
- `checkout_started`

Add `offer_viewed` to:

- `src/lib/analytics/events.ts`
- `src/lib/analytics/routes.ts`

Recommended route:

```ts
offer_viewed: { customerio: false, meta: false, posthog: true }
```

Do not add `landing_viewed` as an `AppEventMap` event in v1. Use `$pageview` plus `funnel_sessions.landing_viewed_at`.

Destination mapping requirements:

- PostHog: register funnel context once with `posthog.register({ funnel_session_id, funnel_package_key })` when context is available. Register it again whenever an explicit entry starts a new package session. Perform `funnelEventId -> $insert_id` extraction and camelCase funnel-envelope removal at the `postHogDestination.track()` boundary after/beside event-specific mapping, because existing per-event mappers reconstruct and drop unknown fields. Registered context supplies the snake_case session/package properties.
- Customer.io: centrally merge `funnel_event_id`, `funnel_session_id`, and `funnel_package_key` at the destination `track()` boundary after event-specific mapping. Do not rely on unknown-field pass-through or a nonexistent switch default.
- Meta Pixel/CAPI: preserve the current consent posture and route approved standard/custom funnel events with stable event IDs for deduplication.
- Thread `funnelEventId` through the Meta Pixel wrappers for every routed funnel event as Meta's `eventID`. This is the only permitted funnel-related expansion in `src/lib/meta-pixel.ts`; do not pass visitor/session IDs there.
- Implement `FUNNEL_META_CUSTOM_DATA_ENABLED`, default `false`. When enabled, explicitly allowlist `funnel_package_key` as Meta custom data; never expose `funnel_session_id`.
- Validate the package-key parameter in Meta Test Events before enabling it in production, then retain the flag as an independent rollback control.
- Do not add package/session fields to the existing consent-bypassed browser purchase call. The flag may enrich eligible consent-gated Pixel events and the existing server CAPI payload only.

### Lead Attachment

Extend lead capture:

- Client sends no trusted package selector.
- `/api/quiz/lead` infers session id from cookie or accepts a session id only after validation against the cookie/session helper.
- Attach the funnel session to newly inserted or deduped lead.
- Mark `lead_captured_at`.
- Include `funnel_package_key` and `funnel_session_id` in Customer.io server-side quiz sync traits/events.
- Preserve lead dedupe and marketing consent behavior.

For deduped recent leads:

- Attach the current funnel session to the reused lead without mutating any earlier session's package or first-touch data.
- Multiple sessions may reference the same deduped lead; this is expected and preserves separate organic/campaign journeys.

### Offer View

Result/offer surfaces should resolve package context from:

1. Current validated funnel session when it belongs to the active lead journey.
2. Otherwise the most recently attached `funnel_sessions` row for the lead.
3. `default_organic` fallback.

Tasks:

- Pass package context into the offer shell/pricing components.
- Fire `offer_viewed` once per offer view using a ref guard.
- Mark `offer_viewed_at` in `funnel_sessions`.
- Keep current offer UI/copy unchanged for default placeholder variant.

### Checkout And Purchase Attribution

Decision: compact funnel metadata at checkout creation is required for clean paid-purchase attribution. Payment webhooks must not depend on the browser cookie still being available.

Stripe:

- Extend checkout creation to infer funnel context from cookie/session and/or `leadId`.
- Extend `buildStripeCheckoutSessionParams` input to include metadata object.
- Build metadata so funnel keys survive even when `leadId` is null:
  - `lead_id` when present
  - `funnel_session_id`
  - `funnel_package_key`
- Keep metadata values short and non-sensitive.

PayPal:

- Store the same compact funnel metadata in `paypal_checkout_intents.metadata`.
- Carry it into billing analytics payload when PayPal webhook creates purchase/subscription analytics.

Billing analytics:

- Use checkout metadata first. Do not rely on a later DB lookup as the primary source because `billing_analytics_outbox` payload is write-once per `event_key`.
- DB fallback is acceptable only when checkout metadata is missing.
- Keep every checkout attempt in `funnel_events` with `checkout_provider` and `checkout_reference`.
- On confirmed payment, mark `purchase_completed_at` and set the successful `purchase_provider` plus `purchase_reference` on `funnel_sessions`.
- Preserve current event-key dedupe behavior.
- Keep server-side Meta purchase event ID behavior unchanged.

## Task Checklist

### Task 1: Package registry

Files:

- Create `src/lib/funnel/packages.ts`
- Create `tests/funnel-packages.test.ts`

Steps:

- [x] Define `FunnelPackage` and package list.
- [x] Export `DEFAULT_FUNNEL_PACKAGE_KEY = "default_organic"`.
- [x] Add `getFunnelPackageBySlug`, `getFunnelPackageByKey`, and `resolveDefaultFunnelPackage`.
- [x] Test default package, placeholder slug, and unknown slug behavior.

### Task 2: Supabase session and event tables

Files:

- Create `supabase/migrations/20260711120000_funnel_attribution.sql` or the next unused timestamp after rechecking `origin/main`.
- Add migration text tests if following the local SQL assertion pattern is practical.

Steps:

- [x] Create `funnel_sessions`.
- [x] Create append-only `funnel_events` linked to `funnel_sessions`.
- [x] Make `event_id text` the single primary key for idempotent recording and forwarding.
- [x] Add service-role-only `record_funnel_event(...)` RPC for transactional event insert plus first-occurrence session milestone update.
- [x] Test duplicate event ID, new repeated occurrence, and rollback/atomicity behavior against a running Postgres instance.
- [x] Add indexes.
- [x] Enable RLS with no anon policies.
- [x] Add table/column comments explaining first-party operational attribution.
- [x] Verify the migration includes both reporting-summary and detailed-event requirements.

### Task 3: Proxy cookie ownership and kill-switch

Files:

- Update `src/proxy.ts`
- Create `src/lib/funnel/flags.ts`
- Create `src/lib/funnel/cookie.ts`
- Create/update tests for source-level proxy behavior if no proxy test harness exists.

Steps:

- [x] Add an edge-safe `FUNNEL_ATTRIBUTION_ENABLED` helper whose unset/default state is `false`.
- [x] Implement versioned HMAC signing and validation for `{ visitorId, sessionId, packageKey, issuedAt }` using `FUNNEL_COOKIE_SIGNING_SECRET`.
- [x] Implement the separately versioned 15-minute signed pending-touch payload with an allowlisted/truncated field set and total-size limit.
- [x] Match `/`, `/lp/:slug`, and `/quiz`.
- [x] Resolve package from path without query-param package selection.
- [x] Set one signed context cookie when missing/invalid.
- [x] Preserve `visitorId` and mint a new `sessionId` whenever `/` or `/lp/:slug` explicitly selects a package different from the active package.
- [x] Preserve the active `sessionId` for refreshes and same-package re-entry.
- [x] Never redirect `/` to a previously assigned campaign landing page.
- [x] Reject tampered, expired, unknown-package, and unsigned cookie values.
- [x] Ensure pending-touch data is accepted only when its signed visitor/session IDs match the context cookie and is cleared after persistence.
- [x] Verify a missing signing secret fails attribution closed without breaking the visible funnel.
- [x] Keep `/` statically renderable.
- [x] Verify flag-off behavior leaves requests unchanged.
- [x] Preserve existing `www` redirect and Supabase `updateSession(request)` behavior.
- [x] Attach funnel `Set-Cookie` values to the final response returned by `updateSession`, including redirect responses; test both redirect and non-redirect paths.
- [x] Do not add `middleware.ts`.

**Stop gate:** After Task 3, run focused tests and inspect generated response/cookie behavior before touching lead capture or checkout.

### Task 4: Server helpers and API route

Files:

- Create `src/lib/funnel/server.ts`
- Create `src/app/api/funnel/session/route.ts`
- Update `src/lib/rate-limit.ts`
- Create `tests/funnel-server.test.ts`

Steps:

- [x] Implement package/session resolution.
- [x] Preserve each session's entry in `first_touch` from the validated pending-touch cookie.
- [x] Expose original/latest-touch reporting by ordering sessions for the same `visitor_id`; never rewrite older session attribution.
- [x] Add lead/checkout recovery consumption so a fast CTA click cannot lose pending touch fields before the landing milestone request completes.
- [x] Call `record_funnel_event(...)` so event insertion and first-occurrence milestone marking are atomic.
- [x] Ensure repeated calls with the same `eventId` return success without duplicate rows.
- [x] Implement lead/user/checkout attachment helpers.
- [x] Implement API route accepting a producer-supplied `eventId` for best-effort session/event writes.
- [x] Add `FUNNEL_EVENT_RATE_LIMIT` using the existing Supabase-backed limiter and key it by validated signed session ID.
- [x] Enforce event-name allowlisting, body/property size limits, and browser event-ID validation before service-role writes.
- [x] Test invalid/tampered cookie, unknown milestone, oversized payload, rate-limited, and rate-limit-service-unavailable responses; all client callers must treat these as non-blocking tracking failures.
- [x] Unit-test helpers with fake Supabase client.

### Task 5: Client context and analytics enrichment

Files:

- Create `src/lib/funnel/client.ts`
- Add a tiny provider/component if needed.
- Update `src/providers/route-providers.tsx` only if provider-level context is the cleanest integration point.

Steps:

- [x] Fetch current context from `/api/funnel/session`.
- [x] Expose `getCurrentFunnelContext()`.
- [x] Generate each browser occurrence ID once and reuse it across the Supabase API call, PostHog `$insert_id`, and other routed destinations.
- [x] Mark landing/quiz/offer/checkout milestones best-effort.
- [x] Ensure failures are swallowed and do not affect the visible funnel.

### Task 6: `/lp/[slug]` route

Files:

- Create `src/app/lp/[slug]/page.tsx`
- Optionally create `src/app/lp/layout.tsx`
- Update `src/lib/supabase/middleware.ts`
- Reuse/extract root landing composition from `src/app/page.tsx`.
- Reuse `LandingTracking` from `src/providers/route-providers.tsx`.
- Update `tests/acquisition-funnel-tracking.test.ts`.
- Update/add middleware tests following `tests/paypal-middleware-public.test.ts`.

Steps:

- [x] Add `/lp` to both gates in `src/lib/supabase/middleware.ts`: the early `isPublicMarketingRoute` fast path and the later `publicRoutes` redirect-defense list.
- [x] Add `/api/funnel` to both the early `fastPublicRoutes` path and the later `publicRoutes` redirect-defense list.
- [x] Refactor the relevant `.startsWith(...)` list checks in both gates to `pathMatchesRoutePrefix` so unrelated prefixes are not accidentally public.
- [x] Resolve slug to package.
- [x] Unknown slug should `notFound()`.
- [x] Render the current landing shell for placeholder packages.
- [x] Mount `<LandingTracking />` exactly once on every valid `/lp/[slug]` response so Meta Pixel, Customer.io, and PostHog initialize just as they do on `/`.
- [x] Set `robots: { index: false, follow: false }`, following `src/app/result/[leadId]/page.tsx`.
- [x] Ensure CTAs go to `/quiz` without package query params.
- [x] Preserve the existing `prefetch={false}` behavior on every reused `/quiz` landing CTA.
- [x] Extend `tests/acquisition-funnel-tracking.test.ts` to assert the campaign landing route mounts `LandingTracking` and the three public analytics providers remain in that component.
- [x] Verify an anonymous `GET /lp/scalp-check?utm_source=meta&fbclid=test` returns the landing response without an auth redirect and preserves the request attribution fields for capture.
- [x] Verify an anonymous `POST /api/funnel/session` returns the expected JSON response rather than a followed redirect/HTML page.

### Task 7: Default organic on `/` and direct `/quiz`

Files:

- Update `src/app/page.tsx`
- Update `src/app/quiz/page.tsx` or `src/app/quiz/layout.tsx`
- Update `tests/acquisition-funnel-tracking.test.ts`

Steps:

- [x] Ensure `/` starts or continues `default_organic` and never redirects to an older campaign landing page.
- [x] Ensure direct `/quiz` continues the current valid session, or starts `default_organic` when none exists.
- [x] Ensure `/lp/:slug` starts a new linked session when its package differs from the active package and continues the session when it matches.
- [x] Verify Package A -> direct `/` -> Package B produces three sessions with one shared `visitor_id` and exact per-session first touches against a running Postgres instance.

### Task 8: Typed analytics and destination adapters

Files:

- Update `src/lib/analytics/events.ts`
- Update `src/lib/analytics/routes.ts`
- Update `src/lib/analytics/track-app-event.ts`
- Update `src/lib/analytics/destinations/posthog.ts`
- Update `src/lib/analytics/destinations/customerio.ts`
- Update `src/lib/analytics/destinations/meta.ts` only as needed to route approved events and preserve stable event IDs.
- Update `src/lib/meta-pixel.ts` only to accept/pass the random event occurrence ID for quiz, lead, pricing, and checkout wrappers. Do not enrich it with internal visitor/session IDs or package fields.
- Update `tests/analytics-tracking.test.ts`

Steps:

- [x] Add optional `funnelEventId`, `funnelSessionId`, and `funnelPackageKey` for internal/PostHog/Customer.io routing.
- [x] Add `offer_viewed` to `events.ts` and `routes.ts`.
- [x] Register current funnel context centrally with PostHog once it resolves.
- [x] Refresh the registered PostHog context whenever an explicit entry creates a new package session.
- [x] Keep server-confirmed PostHog events explicitly attributed.
- [x] Centrally map `funnelEventId` to PostHog `$insert_id` and strip camelCase funnel envelope fields before event-specific/default payloads are sent.
- [x] Centrally add snake_case funnel envelope fields to routed Customer.io payloads after event-specific mapping.
- [x] Thread `funnelEventId` through every routed Meta funnel wrapper as Pixel `eventID`, including quiz start/completion, lead, pricing, and checkout; preserve existing purchase/subscribe dedup behavior.
- [x] Verify Meta receives stable event IDs, never receives the raw funnel session ID, and receives package key only when `FUNNEL_META_CUSTOM_DATA_ENABLED=true`.
- [x] Preserve current browser `purchase_completed` route behavior; do not add dead non-Meta browser enrichment, because the server outbox remains the PostHog/Customer.io purchase source.
- [x] Test that no route-table type gap is introduced.

### Task 9: Lead attachment and Customer.io traits

Files:

- Update `src/lib/quiz/validators.ts`
- Update `src/components/quiz/quiz-lead-capture.tsx`
- Update `src/app/api/quiz/lead/route.ts`
- Update `src/lib/customerio/quiz-sync.ts` and/or quiz trait builder.
- Update relevant Customer.io quiz tests.

Steps:

- [x] Validate/infer funnel session id.
- [x] Attach session to new and deduped leads.
- [x] Mark `lead_captured_at`.
- [x] Include `funnel_session_id` and `funnel_package_key` in Customer.io server-side quiz sync.
- [x] Follow repo TDD expectations for `src/lib/quiz/` changes.

### Task 10: Offer view tracking

Files:

- Update `src/components/quiz/quiz-results.tsx`
- Update `src/app/result/[leadId]/page.tsx`
- Update `src/app/result/[leadId]/result-client.tsx`
- Update `src/components/quiz/quiz-result-offer-page.tsx`
- Add/adjust result-offer tests.

Steps:

- [x] Load package context from current session or lead-attached session.
- [x] Fallback to `default_organic`.
- [x] Fire `offer_viewed` once per offer view with a ref guard.
- [x] Mark `offer_viewed_at`.
- [x] Keep current offer copy/UI unchanged.

### Task 11: Checkout metadata

Files:

- Update `src/components/quiz/result-offer-pricing.tsx`
- Update `src/components/checkout/paypal-subscription-button.tsx`
- Update `src/app/pricing/page.tsx` only as needed to preserve the current identity gate.
- Update `src/app/pricing/pricing-cards.tsx` for lead-carrying/authenticated pricing checkout attribution.
- Update `src/app/api/stripe/create-checkout-session/route.ts`
- Update `src/lib/stripe/checkout-session-params.ts`
- Update `src/app/api/paypal/create-subscription-intent/route.ts`
- Update `src/lib/paypal/checkout-intents.ts` only if types need refinement.
- Update checkout tests.

Steps:

- [x] Include funnel metadata in checkout-start events.
- [x] Ensure the PayPal subscription button records/enriches `checkout_started` and `checkout_started_at` just like the Stripe/result pricing entry points; keep server-side PayPal intent metadata authoritative.
- [x] Preserve `origin/main` behavior that redirects anonymous `/pricing` visits without a lead to `/quiz`; attribution must not reopen a dead-end anonymous checkout path.
- [x] Mark `checkout_started_at`.
- [x] Include compact funnel metadata in Stripe Checkout Session metadata even when `leadId` is null.
- [x] Include compact funnel metadata in PayPal checkout intent metadata.
- [x] Preserve access-conflict and identity-required behavior.
- [x] Verify checkout works with `FUNNEL_ATTRIBUTION_ENABLED=false`.

### Task 12: Purchase analytics

Files:

- Update `src/app/api/stripe/webhook/route.ts`
- Update `src/lib/paypal/webhook-handlers.ts`
- Update `src/lib/billing/analytics-destinations/meta-capi.ts` only for explicit custom-data allowlist work.
- Update billing/PayPal/Stripe analytics tests.

Steps:

- [x] Add `funnel_session_id` and `funnel_package_key` to billing analytics outbox payloads from checkout metadata first.
- [x] Preserve current billing event dedupe keys.
- [x] Preserve current Meta event ID behavior.
- [x] Add explicit Meta CAPI allowlist handling for `funnel_package_key` behind `FUNNEL_META_CUSTOM_DATA_ENABLED`, default off.
- [x] Verify flag-off omits the package key, flag-on includes it, and both modes omit the raw session ID.
- [ ] Validate the flag-on payload in Meta Test Events before production enablement.
- [x] Preserve all checkout attempts in `funnel_events` with provider/reference fields.
- [x] Mark `purchase_completed_at`, `purchase_provider`, and `purchase_reference` from the successful Stripe or PayPal confirmation.

### Task 13: Docs and reporting query

Files:

- Create `docs/funnel-attribution.md`

Steps:

- [x] Document package naming and URL shape.
- [x] Document how to add the first real packages.
- [x] Document funnel milestones:
  `landing_viewed_at -> quiz_started_at -> quiz_completed_at -> lead_captured_at -> offer_viewed_at -> checkout_started_at -> purchase_completed_at`.
- [x] Include starter SQL for package-level conversion from `funnel_sessions`.
- [x] Explain that Meta campaign/ad data and Chaarlie package data answer different questions.
- [x] Add a dated pre-enable baseline section covering the same available metrics in current PostHog/Customer.io and Stripe/PayPal reporting: quiz starts, quiz completions, leads, checkout starts, and confirmed purchases.
- [x] Record the exact baseline time window, event definitions, source systems, and known gaps so post-enable comparisons use like-for-like definitions.

## Verification

Required before claiming implementation ready:

- [x] Before enabling attribution, save the dated current-system baseline for quiz starts, quiz completions, leads, checkout starts, and purchases.

- [x] `npx tsx --test tests/funnel-packages.test.ts tests/funnel-server.test.ts`
- [x] `npx tsx --test tests/analytics-tracking.test.ts tests/acquisition-funnel-tracking.test.ts`
- [x] `npx tsx --test tests/stripe-checkout-session-params.spec.ts tests/payment-method-checkout.test.tsx`
- [x] Relevant PayPal and billing analytics tests touched by Tasks 11-12.
- [x] `npm run ci:verify`
- [x] Manual flag-off smoke: with `FUNNEL_ATTRIBUTION_ENABLED=false`, landing, quiz, and checkout still work.
- [ ] Browser smoke with `npm run dev:worktree` (in-app browser backend unavailable in the implementation environment; HTTP smokes passed):
  - visit `/`
  - visit `/lp/scalp-check?utm_source=meta&fbclid=test` in an anonymous browser and verify a 200 response, no auth redirect, and a signed `Set-Cookie`
  - immediately continue to `/quiz` and verify the pending touch is still written to Supabase without delaying navigation
  - verify the campaign landing emits the expected Meta/PostHog page view under the existing consent behavior
  - start quiz
  - complete lead capture with a test email
  - verify result/offer renders
  - start checkout in test mode if local env supports it
- [x] Supabase production DB smoke completed in rollback-only transactions on 2026-07-11:
  - funnel session created
  - detailed funnel events recorded with unique event IDs
  - lead attached
  - milestone timestamps recorded
  - checkout metadata includes package/session identifiers
- [ ] Post-enable reconciliation smoke for the same bounded test window:
  - compare Supabase milestone/event counts with existing PostHog/Customer.io event counts
  - compare Supabase confirmed purchases with Stripe/PayPal confirmations and the billing analytics outbox
  - document expected consent/ad-blocker differences rather than forcing destination counts to equal Supabase

## Review Gates

- Initial and final Claude plan reviews have run read-only; accepted findings are incorporated and owner decisions are recorded above.
- The plan was rechecked against `origin/main` after the final review; implementation must start from fresh `origin/main`, not this planning worktree's older base.
- After implementation, run a code review gate before commit/push/PR.
- Stop before committing, pushing, creating a PR, applying production migrations, or changing live Stripe/PayPal price/plan IDs unless the user explicitly approves.

## Implementation Execution Contract For Later

When the user approves implementation, state and follow this compact contract without creating a formal Goal unless explicitly requested:

```text
Implement plans/2026-07-09-funnel-attribution-infrastructure.md in a repo-local worktree on branch codex/funnel-attribution-infrastructure. Keep the plan checklist updated, preserve unrelated changes, run the listed focused tests plus ci:verify, run a review gate after checks, and stop before staging, committing, pushing, opening a PR, applying production migrations, or changing live payment plans.
```

## Open Risks And Explicit Decisions

- **Pre-consent first-party attribution:** Nick approved the product behavior of storing minimal first-party visitor/session context before marketing consent, with a 90-day browser lifetime. Before production enablement, separately review and document the German privacy classification/legal basis; industry experimentation practice alone does not establish that UUID-linked tracking is strictly necessary. Do not treat this product approval as permission to broaden Meta/browser marketing tracking.
- **Meta custom data:** Implement package-key-only Meta custom data behind `FUNNEL_META_CUSTOM_DATA_ENABLED`, default off until Meta Test Events validation. The raw funnel session ID stays internal. Preserve the current consent posture and never enrich the existing consent-bypassed browser purchase call with funnel fields.
- **Original/latest touch vs active journey:** The 90-day `visitorId` links multiple immutable package sessions. Explicit `/` and `/lp/:slug` entries may start a new session when the requested package differs; original/latest reporting orders sessions instead of overwriting attribution. Result/checkout continuation stays tied to the relevant session.
- **Client write loss:** Bouncers or blocked JS may not create a Supabase row. The signed proxy cookie still preserves visitor/current-session context, and lead/checkout paths can recover pending touch data later.
- **Signing-secret rotation:** V1 uses one active `FUNNEL_COOKIE_SIGNING_SECRET`; rotating it invalidates existing anonymous visitor/session context and safely creates new context. Multi-key rotation is deferred unless operational requirements justify it.
- **Checkout metadata limits:** Stripe metadata is string-only and size-limited. Keep only compact identifiers there; use Supabase as the rich source of truth.
- **Purchase sample size:** With 1,500-3,500 weekly visitors, paid purchase conclusions may need multiple weeks. Use quiz starts, lead capture, offer views, and checkout starts as earlier diagnostic metrics without over-optimizing to weak samples.
