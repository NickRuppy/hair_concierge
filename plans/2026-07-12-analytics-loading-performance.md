# Analytics Loading Performance Plan

## Goal

Reduce the initial JavaScript and simulated mobile LCP cost of Chaarlie's public pages while preserving tracking coverage on landing, quiz, offer/result, and authenticated surfaces. The intentional analytics changes are removing vendor pageviews and the false `landing_viewed` milestone from Methodik/404, plus making Meta, Customer.io, and PostHog capture independently of cookie-consent state. Preserve all other event contracts, authentication, checkout, and user-facing funnel behavior.

## Context

Fresh local Lighthouse runs on the production build reported SEO 100 but simulated mobile LCP around 5-7 seconds. The LCP element was text on all measured pages. Observed local LCP was much faster (roughly 0.1-0.23 seconds), while the simulated model penalized a first-load client payload of roughly 1.7-1.9 MB uncompressed.

The current public provider graph eagerly imports Meta, Customer.io, PostHog, authenticated identification, Supabase auth, funnel bootstrap, and shared application code. Public content therefore ships code that is not needed to render the first screen. This plan changes when heavy destination code loads, not what Chaarlie tracks.

Current official guidance supports keeping third-party scripts out of the critical rendering path and loading analytics after the page becomes interactive:

- https://nextjs.org/learn/seo/third-party-scripts
- https://nextjs.org/docs/app/guides/production-checklist
- https://web.dev/articles/optimizing-content-efficiency-loading-third-party-javascript

## Agreed Decisions

1. Landing, quiz, and offer/result retain complete Meta, Customer.io, PostHog, and first-party funnel tracking.
2. Methodik retains lightweight first-party funnel continuity only. Legal and 404 pages remain tracking-free; do not add a new funnel request to them.
3. Tracking events are captured immediately by Chaarlie and queued in memory while destination SDKs load immediately after first paint. Do not defer them to an arbitrary multi-second or browser-idle delay.
4. The memory queue is the only new browser queue. Do not add `localStorage`, `sessionStorage`, IndexedDB, or a new server outbox for browser vendor events.
5. Important funnel milestones continue to use the existing `/api/funnel/session` `keepalive` persistence and stable event IDs. Existing server-side billing/outbox delivery remains unchanged.
6. Keep the existing typed `trackAppEvent(...)` entrance and event/payload contracts. Do not create a parallel public analytics API or move orchestration to a tag manager.
7. Use the four-phase rollout below. Verify each phase before extending the mechanism to the next surface.
8. The balanced first-pass acceptance bar is sufficient. Do not broaden into a quiz/auth redesign solely to force every page below 2.5 seconds.
9. Meta, Customer.io, PostHog, and first-party funnel tracking capture events from the beginning regardless of cookie-consent state. This intentionally removes Meta's current marketing-consent gate and Customer.io's current analytics-consent gate; PostHog and first-party behavior remain always-on.
10. Vendor SDKs still initialize immediately after first paint rather than in the critical render path. Events captured before readiness wait in short-lived memory queues and flush once in FIFO order. "Capture from the beginning" does not guarantee vendor delivery when a visitor closes the page before the SDK becomes ready; the first-party funnel record remains the durable source for important milestones.
11. Methodik preserves first-party session/package continuity but stops emitting `landing_viewed`; annotate the effective date because the landing-to-quiz denominator and Methodik-first `entry_path` attachment timing will change. Legal pages remain tracking-free, and the 404 page becomes tracking-free.
12. Do not add a kill switch or dual loading path. Phase gates are the safety mechanism; unexpected production regressions use a normal code revert and redeploy.
13. Keep Sentry initialization and error coverage unchanged. Attribute its bytes, but treat any Sentry optimization as a separately approved follow-up even if it limits this pass's performance gain.
14. The separate offer-conversion task is still brainstorming and does not block this plan. Avoid editing offer presentation/variant components unless a tracking contract cannot otherwise be preserved; rebase and re-verify if that task ships first.
15. The no-consent-gate posture is an explicit owner decision with acknowledged compliance risk. This implementation makes no compliance claim and does not redesign cookie-banner copy or consent UX.
16. Use a reliability-first Meta exception on the post-payment `/welcome` return flow: `Purchase` may initialize Meta immediately rather than waiting for the shared post-paint coordinator. Make the preceding `Subscribe` event queue-capable and mark it as tracked only after actual dispatch, so the immediate Purchase initialization flushes both conversion events in FIFO order. All acquisition pages keep the post-first-paint loading rule.

## Constraints

- Apply the agreed no-consent-gate behavior consistently to Meta, Customer.io, and PostHog. Consent state may still be recorded accurately in existing payload fields, but it must not suppress, delay, reset, or replay analytics events.
- Preserve event names, payload keys, destination routing, event IDs, package attribution, UTM/click context, and destination-specific ordering.
- Preserve Meta Pixel and Meta CAPI behavior, Customer.io page/identify/event behavior, and PostHog page/register/identify/event behavior.
- Preserve quiz retake auth, lead capture, result/offer, Stripe/PayPal checkout, and authenticated app behavior.
- One destination failing must not block another destination or any user workflow.
- No database migrations.
- No tag manager, service worker, web-worker/Partytown experiment, or new analytics vendor.
- No optimization claims based on one Lighthouse run. Compare medians from three equivalent runs.
- If implementation reveals a new product, consent, attribution, reliability, or rollout decision, stop and align with Nick before choosing.

## Non-Goals

- Redesigning the full authenticated provider tree.
- Changing analytics taxonomy or adding new marketing events.
- Replacing browser analytics with a universal server-side event system.
- Solving the homepage CLS issue in this plan.
- Guaranteeing production Core Web Vitals from localhost lab results.
- Removing commercially important tracking to improve a score.
- Redesigning or making legal claims about the existing cookie-consent experience.

## Target Architecture

### Public content boundary

Methodik renders without importing vendor SDKs or authenticated identification. A small first-party bootstrap preserves the existing funnel session/package context without importing PostHog as a side effect. Legal routes already have the desired zero-tracking boundary and must remain unchanged. The 404 page must stop inheriting `LandingTracking` while preserving its header, footer, and true-404 behavior.

### Funnel tracking boundary

Landing, quiz, and offer/result keep calling `trackAppEvent(...)`. The facade creates one cleaned event envelope and routes it to destination runtimes. A destination runtime either dispatches immediately when ready or appends the event to its in-memory FIFO queue. Except for the approved Meta Purchase checkout-return path, event capture must not start a vendor loader before the shared post-paint coordinator releases it; after release, each loader starts at most once.

### Destination readiness and ordering

- Meta: retain the existing pixel stub, event adapter, event IDs, and CAPI behavior, but remove consent as a loading/sending gate. Start the pixel loader after first paint and initialize it as enabled regardless of cookie state. Preserve the current pending behavior for pageviews and standard events, and extend it so `trackCustom` funnel events queue before readiness and flush once with their existing event IDs; today the real queue gap is custom events, not pageviews. Do not revoke, clear, or reinitialize Meta solely because the banner state changes. Its current standard-event queue is unbounded; preserve that scope in this pass rather than introducing a second Meta queue policy. The one loader exception is `trackMetaPurchaseConfirmed(...)` on the post-payment return flow: it may initialize Meta immediately, which must flush the queue before dispatching Purchase.
- Customer.io: dynamically import `@customerio/cdp-analytics-browser` after first paint without waiting for consent. Use a thin bounded FIFO only to bridge initial `page`, `identify`, `track`, and `reset` calls to dynamic-import/client readiness; after `AnalyticsBrowser.load()` resolves, rely on the SDK's own buffering. Preserve the original call order, including identify-before-event when identity is available.
- PostHog: preserve today's always-load coverage, but dynamically import `posthog-js` after first paint. Flush only after both the SDK is ready and the first-party bootstrap promise has settled; the bootstrap already catches failures to `null`. Register funnel context first when present, identify when applicable, then flush the complete queue once in FIFO order. This expected ordering improvement may enrich early buffered events with stable funnel context, but must not change event names or counts during a successfully loaded visit; the accepted close-before-readiness gap remains explicit.
- First-party funnel: continue recording important milestones immediately through `/api/funnel/session` with stable IDs and `keepalive`; do not wait for vendor readiness.

The new queues must be bounded and short-lived. Use a conservative fixed maximum and drop the oldest pending item with a development warning if the bound is exceeded, preserving newer and potentially higher-value conversion events; do not create unbounded memory growth. The exact bound is an implementation detail unless evidence shows it could affect a real funnel journey. In a browser environment, trigger vendor loaders from one client-side coordinator using a double `requestAnimationFrame` after provider mount; the first frame is allowed to paint before the second callback starts vendor loading. The only sanctioned early release is Meta Purchase on the post-payment return flow. Keep `typeof window` guards for Node/SSR imports.

## Phase 0: Baseline And Red-Capable Feedback Loop

Before behavioral edits:

1. Run a clean production build from the task worktree.
2. Capture route-bundle statistics for `/`, `/methodik`, `/quiz`, and the reachable offer/result surface.
   For runtime offer measurement, use an existing non-production test lead ID from the approved local/E2E environment. Do not create or mutate shared data solely for Lighthouse; if no test lead is available, record offer runtime measurement as blocked and rely on route-bundle data plus contract/browser tests that do not require a new write.
3. Run three mobile Lighthouse measurements for `/`, `/methodik`, and `/quiz` using identical settings; record medians for LCP, CLS, TBT, and SEO.
4. Build focused runtime tests, extending the destination-spy pattern in `tests/analytics-tracking.test.ts`, that prove the stable acquisition invariants: event names, destination routing, payloads, IDs, and ordering. Record current consent behavior as a behavioral baseline but do not encode the gates as permanent invariants because Phase 2 intentionally removes them. Keep source-boundary assertions until the provider restructuring occurs, then replace brittle assertions in the phase that changes those modules. The runtime tests must fail if an eligible destination silently drops a queued event or changes ordering.
5. Attribute the first-load bytes to PostHog, Customer.io, Supabase/auth, Sentry, and shared framework code before optimizing. Use `.next/diagnostics/route-bundle-stats.json` to enumerate each route's initial chunk paths, then search those emitted chunk contents for vendor package/module markers and total the matching file sizes. Record shared or ambiguous chunks separately rather than guessing attribution. Customer.io remains in the agreed lazy-loading scope, but the attribution determines how much improvement should reasonably be credited to it.
6. Record the baseline commands and values in the implementation handoff or plan checklist.
7. Protect `$pageview` alongside typed application events in the PostHog baseline. It currently bypasses `trackAppEvent(...)` and must not be lost while the SDK is loading.

Gate: do not begin optimization until the bundle and tracking feedback loops can detect the intended change and a tracking regression.

## Phase 1: Public Boundary

Objective: make Methodik and the 404 page lightweight without touching funnel-page delivery; prove that legal pages already meet the target boundary.

Likely files:

- `src/providers/route-providers.tsx`
- `src/components/editorial/editorial-shell.tsx`
- `src/app/not-found.tsx`
- `src/lib/funnel/client.ts`
- new narrowly scoped public-context provider/module under `src/providers/` or `src/lib/funnel/`
- `tests/acquisition-funnel-tracking.test.ts`
- `tests/editorial-pages.test.tsx`

Tasks:

1. Split the editorial/public-context composition from the module that imports authenticated and vendor providers.
2. Ensure Methodik and 404 pages do not import Meta, Customer.io, PostHog, Supabase auth, or authenticated identification through transitive module imports.
3. Preserve the existing first-party funnel session/package continuity where it is already applicable.
4. Replace Methodik's current `LandingTracking` behavior with context-only bootstrap. Do not POST `landing_viewed`; record both the expected event-volume change and the fact that a Methodik-first pending touch now attaches its `entry_path` to the next real milestone, such as `quiz_started`.
5. Keep legal pages tracking-free and unchanged. Make the 404 page tracking-free by removing its transitive `LandingTracking` import without changing presentation or adding `/api/funnel/session` calls.
6. Keep cookie settings, 404 status/noindex behavior, header, and footer unchanged.
7. Verify route bundles and browser behavior before proceeding.

Phase gate:

- Methodik/404 vendor and auth chunks are absent from their initial route graph; legal pages remain clean.
- First-party context continuity tests pass.
- No funnel page behavior changes yet.

## Phase 2: Landing Validation

Objective: prove queued, after-first-paint vendor loading on the landing page before applying it to conversion steps.

Likely files:

- `src/app/page.tsx`
- `src/app/lp/[slug]/page.tsx`
- `src/funnels/landing/default.tsx`
- `src/funnels/landing/registry.ts`
- `src/lib/analytics/track-app-event.ts`
- `src/lib/analytics/destinations/posthog.ts`
- `src/lib/analytics/destinations/customerio.ts`
- `src/lib/analytics/destinations/meta.ts`
- `src/providers/posthog-provider.tsx`
- `src/providers/customerio-provider.tsx`
- `src/providers/meta-pixel-provider.tsx`
- `src/providers/funnel-context-bootstrap.tsx`
- `src/components/feedback/feedback-widget.tsx`
- `src/providers/route-providers.tsx`
- `src/lib/customerio-tracking.ts`
- `src/lib/meta-pixel.ts`
- new destination-runtime/queue modules under `src/lib/analytics/`
- analytics and acquisition tests under `tests/`

Tasks:

1. Introduce small, typed, bounded in-memory FIFOs for PostHog and Customer.io calls behind the existing analytics interfaces. Extend Meta's existing pending-event mechanism to include custom events while preserving its existing pageview/standard-event handling, remove consent as its dispatch gate, preserve event IDs, and do not create a parallel public Meta API.
2. Make the PostHog and Customer.io SDK imports dynamic and single-flight. Module import alone must not initialize either vendor. Meta remains script-injected through its existing adapter.
3. Start vendor loaders from the shared double-`requestAnimationFrame` coordinator immediately after first paint. Do not use a long fixed timeout or idle-only strategy. Preserve the explicitly approved immediate Meta Purchase release only on the post-payment return path.
4. Keep first-party milestone persistence synchronous from the caller's perspective and independent of vendor readiness.
5. Gate the PostHog flush on both SDK readiness and settlement of the first-party bootstrap promise. Register context first when the settled result is present, then flush the complete queue once in FIFO order; a failed bootstrap must settle to `null` and must not block delivery. Preserve Meta's existing event-ID behavior.
6. Preserve Customer.io `page`/`identify`/`track`/`reset` ordering, including identify-before-event when identity exists.
7. Preserve destination failure isolation and add explicit loader-failure tests.
8. Break the static `useAuth` import chain in public PostHog and Customer.io page tracking so landing/Methodik do not ship Supabase auth merely to support authenticated identification elsewhere.
9. Replace the synchronous exported PostHog singleton with an explicit readiness/proxy contract used by the PostHog destination, pageview provider, funnel registration, and feedback widget. The proxy must queue `capture`, `identify`, `register`, and `reset` calls until ready, with `reset` FIFO-ordered relative to `identify`; only `get_session_id` may return `undefined` before readiness. Preserve feedback submission when no PostHog session ID is available and preserve session ID capture once ready.
10. Verify absent, accepted, denied, changed, and revoked consent states all retain the same always-capture destination matrix without duplicate initialization, queue clearing, reset, or replay. Also test SDK load failure, fast navigation, and a fast-bounce fixture that documents the accepted vendor-delivery gap.
11. Verify both the default `/` landing and a registered `/lp/[slug]` variant use the same optimized tracking runtime without moving tracking into contributor-owned variant components.
12. Add a Meta readiness test covering `PageView`, one standard event, and one `trackCustom` funnel event before pixel readiness, then assert one FIFO flush with unchanged `eventID` values. This closes the existing custom-event queue gap exposed by deferred loading.
13. Add PostHog bootstrap-success and bootstrap-failure tests proving that context registration precedes one FIFO flush when available and that a caught bootstrap failure still releases the queue.

Phase gate:

- Landing sends the same destination event matrix and payloads as baseline except for the explicitly approved removal of Meta and Customer.io consent suppression.
- Queued events flush once and in order.
- Meta pageviews, standard events, and custom funnel events survive the readiness window with unchanged event IDs.
- Vendor SDKs are absent from the critical initial chunk graph and load after first paint regardless of consent state.
- Vendor chunks are absent from the initial landing graph and first-load JavaScript for `/` improves by at least 15% before extending verification to quiz/offer. The final target remains 25% after all phases.

If the phase changes event counts, IDs, payloads, consent behavior, or attribution beyond the explicitly approved policy and Methodik corrections, stop for user alignment instead of continuing.

## Phase 3: Funnel Extension

Objective: verify and harden the shared runtime on quiz and offer/result without changing auth or checkout behavior. Phase 2 changes shared analytics modules, so these surfaces are already affected; do not create a second funnel runtime.

Likely files:

- `src/app/quiz/quiz-shell.tsx`
- `src/app/result/layout.tsx`
- `src/app/result/[leadId]/page.tsx`
- `src/app/result/[leadId]/result-client.tsx`
- `src/app/welcome/checkout-return-analytics.tsx`
- `src/app/welcome/welcome-client.tsx` (verification-only unless wiring must change to preserve the tracking contract)
- `src/app/pricing/pricing-cards.tsx` (verification-only unless a contract test requires a narrow change)
- `src/funnels/offers/default.tsx` (verification-only)
- `src/funnels/offers/registry.ts` (verification-only)
- `src/providers/route-providers.tsx`
- analytics call sites only if required to preserve existing contracts
- `tests/acquisition-funnel-tracking.test.ts`
- `tests/analytics-tracking.test.ts`
- `tests/result-offer-page.test.tsx`
- relevant e2e smoke specs

Tasks:

1. Exercise the Phase 2 runtime on quiz and offer/result; do not fork a quiz-specific queue.
2. Keep `AuthProvider` wherever quiz retake, result, offer, or checkout behavior requires it.
3. Verify the complete sequence: landing view (including an `/lp/[slug]` campaign URL), quiz start, quiz steps, quiz completion, lead capture, the existing server-side `offer_viewed` record, client offer analytics governed by the current event matrix, pricing/checkout start, and purchase/subscription confirmation.
4. Verify funnel event ID, package key, source, interval, value/currency, and checkout session ID contracts according to the existing `eventRoutes` matrix. Do not invent a Customer.io purchase event where routing intentionally disables it.
5. Exercise Stripe and PayPal-adjacent paths without changing payment behavior.
6. Confirm authenticated and unauthenticated navigation remains identical.
7. Do not redesign offer presentation or variant ownership. If the separate offer-conversion task begins implementation before this phase, rebase onto it and rerun the tracking matrix rather than editing around it in parallel.
8. Verify the `/welcome` checkout-return sequence explicitly: `Subscribe` enters the Meta queue without setting its session marker, `Purchase` performs the sanctioned immediate Meta initialization, the queue flushes Subscribe before Purchase, and markers are written only after actual dispatch. Also verify the no-purchase fallback releases a queued Subscribe through the normal post-paint coordinator.

Phase gate:

- Complete funnel tracking matrix matches baseline.
- Funnel contributor boundaries remain intact: package variants select presentation while shared route/provider code owns tracking.
- No auth, quiz, offer, or checkout regression.
- Destination failure does not interrupt the UI or other destinations.
- Browser Subscribe and Purchase retain FIFO order, event IDs/deduplication, and readiness survival on the checkout-return path.

## Phase 4: Measure And Stop

1. Run a clean production build and capture the Next route-bundle statistics.
2. Compare first-load JavaScript for the target routes with Phase 0.
3. Run three equivalent mobile Lighthouse measurements per target and compare medians.
4. Run the full Node test suite and `npm run ci:verify`.
5. Run desktop/mobile browser smoke for landing, Methodik, quiz, result/offer, consent-state independence, and checkout entry.
6. Run a final whole-branch correctness/structural review and verify every finding locally.
7. Prepare a post-deploy measurement checklist for destination event volumes, PostHog ingestion, Sentry health, and field Core Web Vitals. Explicitly expect Methodik vendor pageviews and false `landing_viewed` milestones to drop to zero, and annotate the accepted possibility of a small vendor-only pageview drop from visitors who leave before deferred SDK readiness. Neither change should be reported as a conversion lift. Deployment and production checks remain separately authorized.

Balanced acceptance bar:

- At least 25% less initial JavaScript on landing and Methodik.
- Material improvement on quiz/offer initial loading without requiring an auth redesign.
- Target median mobile Lighthouse LCP below 3 seconds on measured public pages; if the target is missed but the agreed bundle/critical-path change is proven, report the remaining cause and seek a separate scope decision.
- SEO remains 100 on the measured public pages.
- Existing event/destination/payload/order contracts remain intact apart from the explicitly approved no-consent-gate policy.
- No user-facing auth, funnel, offer, or checkout regression.

## Verification Matrix

### Consent states

- No saved consent: Meta, Customer.io, PostHog, and first-party tracking capture immediately; vendor loaders begin after first paint and flush queued events once.
- Existing accepted or denied consent: the same destination matrix loads and sends; the stored state may remain available as truthful event metadata but is not a dispatch gate.
- Consent changes during the page: no destination initializes twice, drops or replays an already flushed event, clears its queue, or resets identity solely because consent changed.
- Revoked consent: the cookie setting changes as it does today, but analytics delivery remains active under the explicitly approved current policy.

### Reliability states

- Destination already ready.
- Destination loading with multiple queued events.
- Loader resolves successfully.
- Loader rejects or vendor global/API is unavailable.
- One destination fails while others succeed.
- Rapid route navigation.
- Duplicate initialization attempt.
- Queue bound reached in a test fixture.
- Page closes before vendor readiness: first-party milestones remain persisted; a queued vendor event may be lost and is an accepted 80/20 tradeoff.

### Funnel contracts

- Landing and campaign package context.
- Quiz start/step/completion.
- Lead capture and Customer.io identity ordering.
- Offer/pricing view.
- Checkout start and Meta event ID.
- Purchase/subscription server-side continuity.

## Review And Handoff

- Implementation may continue in this isolated worktree after explicit approval, provided it is refreshed against then-current `origin/main` before code edits. Do not create another worktree unless freshness or overlap requires it.
- Use a mixed execution model only if file ownership can be kept disjoint; the analytics runtime and provider composition are tightly coupled and should have one primary owner.
- Run the repo-specific `ready-check` skill after Phase 4 and `request-code-review` on the exact final fingerprint.
- Run the repository-required read-only external second-opinion review when available. If unavailable, disclose it and use the configured Codex review lane; do not silently waive review.
- Four Claude review rounds completed during hardening. The final policy-delta review approved the architecture with targeted revisions for the Meta checkout-return path and deterministic PostHog flushing; those revisions are incorporated above and grounded against the current provider/helper code.
- Stop before staging, commit, push, PR, merge, deployment, or cleanup unless separately authorized.

## Measurement Commands

- Build and route bundles: `npm run build`; inspect `.next/diagnostics/route-bundle-stats.json`, map each route's initial chunk paths to vendor markers by searching emitted chunk contents, total file sizes, and preserve an explicit shared/ambiguous bucket.
- Lighthouse: run `npm run perf:mobile` against the local production server with `LH_BASE_URL`, `LH_PATHS`, `LH_OUTPUT_DIR`, and `LH_FAIL_ON_THRESHOLD=0` set explicitly. Run three equivalent passes and calculate medians; the existing script's default 2.5-second threshold is stricter than this plan's 3-second first-pass target, so record raw values rather than treating one threshold failure as a plan failure.
- Tests: focused analytics/acquisition tests after each phase, then `npm run test:node` and `npm run ci:verify` at the final gate. With a local server running, execute the user-flow smoke explicitly as `PLAYWRIGHT_BASE_URL=<local-url> npx playwright test tests/e2e-smoke.spec.ts --project=chromium`.

## Review Classification

Accepted from the completed review rounds, owner decisions, and final local verification:

- Legal pages are already tracking-free; remove them from the implementation workstream.
- Keep Meta's existing queue and model new destination queues on that prior art.
- Make the approved no-consent-gate behavior explicit and test it across all destinations.
- Include the feedback widget and all synchronous PostHog singleton consumers.
- Explicitly break the public `useAuth` to Supabase bundle chain.
- Replace brittle source-regex coverage with runtime queue/order/failure tests.
- Treat Phase 3 as verification of shared Phase 2 changes.
- Name measurement commands, campaign URLs, routed purchase contracts, and post-deploy checks.
- Correct Methodik's false `landing_viewed` milestone and document the expected metric-volume delta.
- State the no-kill-switch/revert-only rollback posture explicitly.
- Require the PostHog proxy to queue pageviews, registration, identification, and captures until ready.
- Keep Sentry unchanged and make the offer variant files verification-only.
- Provide the non-production lead rule for offer runtime measurement and the non-failing Lighthouse baseline command.
- Include `reset` in the PostHog proxy, define double `requestAnimationFrame` as the post-paint trigger, scope dynamic imports to PostHog/Customer.io, and name the chunk-content byte-attribution method.
- Accept and annotate the rare fast-bounce vendor-delivery gap and Methodik-first `entry_path` timing shift.
- Keep Customer.io's added queue as a thin readiness bridge and rely on its SDK buffering after `AnalyticsBrowser.load()`.
- Extend Meta readiness buffering to `trackCustom` events; pageviews already use the standard-event queue. Preserve Meta Purchase as a sanctioned immediate loader release on checkout return, make Subscribe queue-capable, and write deduplication markers only after actual dispatch.
- Wait for both PostHog SDK readiness and first-party bootstrap settlement before one ordered flush; register context first when present and release normally when bootstrap resolves to `null`.
- Add the checkout-return files to Phase 3, narrow Phase 0 tests to stable invariants, and define queue overflow as drop-oldest with a development warning.

Rejected/deferred:

- Do not make Customer.io lazy loading conditional on a byte threshold. Loading vendor code after first paint is already an agreed architecture decision; Phase 0 attribution sets expectations rather than reopening that scope.
- Do not preserve Meta's or Customer.io's current consent gates. The owner explicitly chose always-capture behavior for all three vendor destinations and accepted that compliance risk; a future consent-remediation initiative remains separate.
- Do not add a runtime kill switch or fallback loading path. The user explicitly chose testing plus normal revert/redeploy over dual-path complexity because there are currently no active users.
- Do not optimize Sentry in this pass. Attribute its cost and report it, but defer any change to a separately approved initiative.
- Reject the handoff review's claim that `ready-check` is unavailable. It exists as the repo-specific user skill at `~/.codex/skills/ready-check/SKILL.md` and remains the correct final verification router.
