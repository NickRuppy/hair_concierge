Verification complete. Writing the report.

---

**Verdict:** Don't ship to subagents yet — five blockers, each of which produces a *silently* broken funnel (no crash, no failing test).

---

## Lean shape

**Irreducible goal:** One landing URL → one sticky package, traced through Supabase from first touch to paid purchase, without touching the shared quiz.

**Cut or defer**

| Item | Why |
|---|---|
| `FUNNEL_META_CUSTOM_DATA_ENABLED` (plan L340, L618) | Future-proofing theater: a disabled flag guarding code that doesn't exist, for a decision not yet made. The allowlist in `src/lib/billing/analytics-destinations/meta-capi.ts:41-55` *is already* the capability boundary. |
| `landing_variant` / `offer_variant` columns (plan L112-113) | Both are `'default'` for every v1 package, and Non-Goals forbid variants. One-more-field drift. Add when the second variant exists. |
| `anonymous_id text not null` (plan L110) | Appears nowhere else in the plan and nowhere in the repo (`rg anonymous_id src/ supabase/` → zero hits). An ownerless `NOT NULL` column that no task populates. |
| `id uuid primary key` **and** `event_id uuid not null unique` (plan L177-178) | Two identity columns on `funnel_events`. Collapse to one. |
| Browser `purchase_completed` enrichment (plan L320) | Dead code — see High-confidence #4. |
| Task 8's Customer.io/PostHog adapter work for billing | Already free — see Smaller. |

**Hard tradeoff the plan is avoiding:** *Who owns package state — the cookie or the database?* The plan asserts both and gets neither. The proxy is told to enforce "first campaign wins" and "one-time organic upgrade" (L216-217, Task 3), but the cookie holds only a UUID (L214) and the proxy has no DB access. This surfaces as Blocker 3.

---

## Prior art

| Mechanism | Canonical shape | Plan status |
|---|---|---|
| First-party attribution cookie | Signed/HMAC'd value so the server can verify it minted it (Segment `ajs_anonymous_id`, PostHog `distinct_id`) | **Missing invariant.** Unsigned UUID. "Validate a proxy-issued session id" (L249) is unimplementable — a bare UUID is unforgeable-but-unverifiable. |
| Idempotent event insert | Deterministic idempotency key derived from a business key + unique constraint | **Missing invariant.** See Blocker 4. |
| Outbox for cross-service writes | Outbox, not dual-write; retries only where they're load-bearing | **Matches.** Correctly reuses `billing_analytics_outbox` for purchases and explicitly refuses to build a general one (L45, L199). Good judgment. |
| Multi-destination event router | Typed event map, per-destination adapter, per-destination filtering | **Matches** — the repo already has exactly this shape (`events.ts` / `routes.ts` / `destinations/*`). |
| Schema migration | Expand → backfill → contract; reversible; flag-gated | Additive-only, so reversible by drop. But the flag's **default is never stated** — see High-confidence #6. |
| Funnel-step addition | Centralised constant + **baseline measurement** + kill-switch | Kill-switch present. **No baseline step**: nothing measures the current funnel before instrumenting it, so post-launch numbers have nothing to compare against. |
| Consent gate per category | Gate non-essential trackers before load (TTDSG § 25) | Adds a *third* pre-consent tracker. Memory `project_cookie_consent_gating.md` records that PostHog and Meta Pixel are still ungated. The plan acknowledges this (L676) and defers — which makes the flag default load-bearing. |

---

## Blockers

**1. `/lp/[slug]` is not a public route — every anonymous ad click gets redirected away.**
`src/lib/supabase/middleware.ts:99-129` builds `isPublicRoute` from a fixed prefix list. `/lp/scalp-check` matches nothing. At `:131`, `if (!user && !isPublicRoute)` redirects, and `getUnauthenticatedRedirectTarget` (`src/lib/auth/unauthenticated-redirect.ts:37`) returns `"/quiz"` for a first-time visitor. The redirect also drops `url.search` (`middleware.ts:139-140`), so `utm_*` and `fbclid` are destroyed. A returning visitor with the `hc_returning` cookie goes to `/auth?reason=session_expired` instead. I simulated the predicate against both paths to confirm.
*Fix:* add `/lp` to `publicRoutes` **and** to `isPublicMarketingRoute` (`middleware.ts:50-54`) in Task 6. The plan never touches this file.

**2. `/api/funnel/session` is not a public route — and it fails *silently*.**
Same predicate; `/api/funnel/session` → `isPublicRoute: false`. An anonymous browser `POST` receives a 307 to `/quiz`, `fetch` transparently follows it, and the response resolves with `ok: true` and an HTML body. The plan's "best-effort, swallow failures" contract (L273, L487) means nothing is ever logged. Result: **zero `funnel_sessions` rows for anonymous traffic** — i.e. all of it — while the feature appears healthy.
*Fix:* add `/api/funnel` to `publicRoutes` and to `fastPublicRoutes` (`middleware.ts:55-62`).

**3. The proxy cannot enforce package stickiness with a UUID-only cookie.**
Cookie value is `crypto.randomUUID()` (L214). Task 3 then requires the proxy to "allow a one-time `default_organic` → first-campaign upgrade" and "preserve the first non-default campaign package." The proxy runs at the edge with no DB read, so it cannot know the current package. L231's claim — *"Fast `/lp/... -> /quiz` clicks still carry the package through the cookie even if client analytics has not loaded"* — is **false as specified**; the cookie carries no package. L218 demotes a package cookie to an optional client-side nicety, which is exactly backwards.
*Fix:* decide explicitly. Either put `package_key` in a signed cookie (proxy owns stickiness), or mint only the UUID in the proxy and move all upgrade/stickiness logic into `src/lib/funnel/server.ts` (DB owns it, enforced on first API write). Not both.

**4. "Insert events idempotently by `event_id`" is a no-op with a random UUID.**
L189 and Task 2's "Enforce unique `event_id` values for idempotent recording." Random v4 UUIDs never collide, so the unique constraint never fires and no insert is ever deduplicated. The plan specifies no derivation rule for `event_id` anywhere.
*Fix:* derive it deterministically (e.g. `uuid_v5(funnel_session_id + event_name + occurrence_ordinal)`) or add a natural unique constraint on `(funnel_session_id, event_name, occurred_at)`. Without this, `funnel_events`' stated purpose — "stable, unique event ID for idempotent forwarding" (L171) — does not hold.

**5. `/lp/[slug]` never mounts the tracking pixels.**
`src/app/layout.tsx` wraps children in no analytics providers; `/` gets them only because `src/app/page.tsx:15` renders `<LandingTracking />`, which is what mounts `MetaPixelProvider`, `CustomerIoProvider`, and `PostHogClientProvider` (`src/providers/route-providers.tsx:53-61`). Task 6 says "render the current landing shell" and never mentions `LandingTracking` or a `PublicFlowProviders` layout. The paid-traffic landing page — the one page that most needs Meta Pixel `PageView` and `fbclid` capture — would ship with no pixel. `tests/acquisition-funnel-tracking.test.ts:18-19` only asserts against `src/app/page.tsx`, so nothing catches it.

---

## High-confidence issues

1. **`first_touch`, `campaign_touch`, `entry_path`, `entry_url`, `referrer` have no producer.** Only the proxy sees the landing URL and `Referer`; only `/api/funnel/session` can write to Supabase. The API route sees its *own* URL, not the landing URL. No task defines the transport. On a fast `/lp/x → /quiz` click before JS loads, the campaign params are lost permanently.

2. **Cross-table write has no transaction.** Task 4 requires inserting `funnel_events` and updating the matching `funnel_sessions` timestamp "in the same server-owned operation" (L469). `supabase-js` cannot do multi-statement transactions. This needs a Postgres RPC (`create function record_funnel_event(...)`), or the two tables drift on partial failure — which is precisely the reconciliation failure `funnel_events` exists to prevent.

3. **`$insert_id` is in the contract table but in no task.** L298 maps `funnelEventId → $insert_id`, but `postHogDestination.track` (`src/lib/analytics/destinations/posthog.ts:59`) passes properties straight to `posthog.capture`, and no Task 8 step assigns `$insert_id`. Without it, PostHog's dedupe is inert.

4. **Browser `purchase_completed` enrichment is dead code, and the plan contradicts itself.** `src/lib/analytics/routes.ts:15` routes it `{customerio: false, meta: true, posthog: false}`. L320 says to add funnel fields "only for non-Meta destinations" — there are none. L543 then correctly says "server outbox remains the PostHog purchase source." Delete L320's bullet.

5. **`offer_viewed` will emit both casings.** `toPostHogPayload` (`posthog.ts:52-53`) falls through to `default: return payload` for any unhandled event, so `offer_viewed` sends camelCase `funnelSessionId` — while `posthog.register()` (L337) simultaneously attaches snake_case `funnel_session_id`. Two properties, same value, different names, forever.

6. **`FUNNEL_ATTRIBUTION_ENABLED` has no stated default.** L676 says production enablement requires a separate German privacy review. An unset env var must therefore evaluate to **false**. Unspecified, this is the classic `?? 'classic'` footgun: it ships on.

7. **`isFunnelAttributionEnabled()` in `src/lib/funnel/server.ts` (L236) poisons the edge bundle.** `server.ts` must import `createAdminClient` (`src/lib/supabase/admin.ts:1-13`, which reads `SUPABASE_SERVICE_ROLE_KEY`) to upsert sessions. Importing that module from `src/proxy.ts` pulls the service-role client into the edge runtime. Put the flag in a leaf module (`src/lib/funnel/flags.ts`).

8. **`/lp` misses the fast path.** Even once Blocker 1 is fixed, adding `/lp` only to `publicRoutes` still forces a `supabase.auth.getUser()` network roundtrip (`middleware.ts:88-90`) on every ad landing request. `/` avoids this via the early return at `:63-65`. Add `/lp` there too — this is the p95 latency of your paid landing page.

9. **`/api/funnel/session` is an unauthenticated service-role writer with no rate limit.** `HttpOnly` + `SameSite=Lax` stops browser JS, not `curl`. Any client can supply an arbitrary UUID cookie and mint unbounded `funnel_sessions` rows. An HMAC-signed cookie (see Prior art) makes L249's "validate" step actually implementable.

10. **Migration filename is inconsistent across the plan:** `20260709160000_funnel_sessions.sql` (L104) vs `20260709160000_funnel_attribution.sql` (L421). Memory `project_product_intake_deep_review.md` records a duplicate-migration-version P0 from a prior cycle. Pick one. (The timestamp itself is free — latest is `20260708133700_billing_analytics_outbox.sql`.)

11. **`checkout_session_id` is one column for two providers.** It holds a Stripe session id *or* a PayPal intent id, and a user can start checkout more than once. Every other field is "first-timestamp-wins" (L250); this one's semantics are unstated.

---

## Smaller / nice-to-haves

- **Meta leak-safety already holds by construction.** `metaDestination.track` (`src/lib/analytics/destinations/meta.ts:14-56`) destructures named fields per case, and `customData` (`meta-capi.ts:41-55`) is an explicit allowlist. Unknown funnel fields cannot reach Meta. Task 8/12's "verify Meta does not receive…" is a cheap regression test, not implementation work — scope it as such.
- **Billing destination adapter work is unnecessary.** `posthog-server.ts` and `analytics-destinations/customerio.ts` both spread `...event.payload`, so `funnel_session_id` / `funnel_package_key` flow automatically once added to the outbox payload, and `sanitizePayload` (`analytics-outbox.ts:355-366`) doesn't block them. Task 12 over-scopes.
- **`toCustomerIoPayload` has no `default:` case** (`destinations/customerio.ts:5-77`). It returns `undefined` for any unmapped event. Harmless while `offer_viewed` is `customerio: false`, but flipping that route later silently sends `undefined` as properties.
- **`tests/acquisition-funnel-tracking.test.ts:36-53`** requires every `/quiz` `<Link>` in the landing components to carry `prefetch={false}`. `/lp/[slug]` reuses those components, so it's satisfied — but Task 6 should say so rather than leave a subagent to rediscover it.
- **Two plan claims I verified and they're correct:** the outbox payload really is write-once per `event_key` (`insertOrFindOutboxEvent`, `analytics-outbox.ts:171-178` returns the *existing* row on `23505`), so L395's insistence on checkout-metadata-first is right. And `buildStripeCheckoutSessionParams` really does drop metadata wholesale when `leadId` is null (`checkout-session-params.ts:34`), so L385's "survive even when `leadId` is null" is a real catch.
- **Next 16 `proxy.ts` + `middleware.ts` conflict is real.** `node_modules/next/dist/server/config.js` throws ``Both ${MIDDLEWARE_FILENAME} file … and ${PROXY_FILENAME} file … are detected``. L224 stands.
- **Verification commands work.** `tsx@^4.21.0` is in `devDependencies`, and `tests/stripe-checkout-session-params.spec.ts:1-2` uses `node:test`, so `npx tsx --test` runs it. Consider `npm run test:node` for consistency with the repo script.

---

## Bottom line

The plan's *strategy* is sound and unusually well-grounded — the outbox reuse, the Meta consent posture, the write-once payload analysis, and the `proxy.ts`-vs-`middleware.ts` call are all correct and verified against the code. The problem is that it was written against `src/app/` and `src/lib/analytics/` without ever opening `src/lib/supabase/middleware.ts`, and that one omission takes out both new routes: the ad landing page redirects anonymous visitors to `/quiz`, and the session API silently 307s into an HTML page that `fetch` reports as success. Combined with the UUID-only cookie that can't carry the package it's supposed to make sticky, and an idempotency key that can never collide, a subagent executing this verbatim would produce a green `ci:verify`, a green browser smoke test on `/` — and an attribution system that records nothing for real traffic.

Fix Blockers 1–5, state the flag's default as `false`, and move `isFunnelAttributionEnabled()` out of `server.ts`. Everything else on the list is a revision, not a re-shape. Task order is otherwise valid and the stop-gate after Task 3 is well-placed — though it should now read *"verify an anonymous request to `/lp/scalp-check` returns 200 with a `Set-Cookie`, not a 307."*

Want me to spec the cookie-ownership decision (signed package cookie vs. DB-owned stickiness) as a side-by-side so you can settle Blocker 3 before implementation starts?
