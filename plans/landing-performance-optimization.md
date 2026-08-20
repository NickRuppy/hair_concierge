# Landing performance optimization

## Outcome and source context

Materially reduce the critical-path JavaScript on both active landing experiences while preserving their visible journeys and browser error reporting:

- Organic landing: `/`
- Ads landing: `/lp/haarplan`

The production audit measured simulated-mobile LCP around 4.1-4.7 seconds. The initial image-priority implementation completed the LCP-image discovery contract but did not reduce bytes. A disposable route-aware Sentry prototype then identified the eager browser SDK as the largest supported opportunity.

Current local production payload:

| Route | Initial JS gzip | Sentry shared chunk gzip |
| --- | ---: | ---: |
| `/` | 399 KiB | 166 KiB |
| `/lp/haarplan` | 459 KiB | 166 KiB |

## Chosen direction

Keep the explicit image preload/high-priority change and move the Sentry browser SDK behind a dynamic import.

- On `/` and `/lp/haarplan`, cross two animation frames using the existing `scheduleAfterFirstPaint` helper, then release the import in the next task. The extra task boundary is required because a live Chromium trace showed that two frames alone could begin the SDK request just before recorded first paint.
- On every other route, start the dynamic import immediately so authenticated, result, offer, and checkout-adjacent surfaces retain the earliest practical full SDK initialization.
- Match only normalized `/` and `/lp/haarplan`; `/quiz`, `/lp/haarplan/angebot`, result, authenticated, and checkout-adjacent routes remain on the immediate dynamic-import path.
- Reuse `createBoundedFifo` and deliberately mirror the proven `createPostHogRuntime` lazy-loader shape rather than extracting a speculative shared abstraction. Ten entries is deliberate: the two-frame window should normally contain zero or one error, while ten contains a startup error storm without unbounded retention. Capture `ErrorEvent.error` (falling back to an `Error` from its message) and `PromiseRejectionEvent.reason` (wrapping safe string reasons and using a generic `Error` for arbitrary non-error values). The first buffered error force-starts the shared SDK load promise instead of waiting for the scheduler.
- Route React render/hydration failures from `global-error.tsx` through the same Sentry-free coordinator facade. This force-starts the SDK and queues the boundary exception even when React catches it before it can reach `window.onerror`.
- After the dynamic module has loaded, remove the temporary global listeners immediately before synchronous Sentry initialization, then flush the buffer through `captureException`. Preserve browser-global errors as unhandled with `mechanism.type` of `onerror` or `onunhandledrejection`; keep root React-boundary capture handled, matching its previous explicit-capture classification and avoiding an artificial release-health shift. Import the scrubbers directly from the Sentry-free `src/lib/observability/sentry-scrubbing.ts` module rather than the checkout re-export that value-imports Sentry.
- Export a stable `onRouterTransitionStart` wrapper immediately because Next snapshots the hook once at startup. Forward it once Sentry is ready; navigation starts before readiness are intentionally not synthesized.
- If the SDK import or initialization terminally fails, remove the lightweight listeners, clear the buffer, and emit only the existing development-only warning behavior. Never let observability delay or break the product.
- A hidden landing tab deliberately waits until it becomes visible and the two animation frames run; any error during the hidden interval force-starts the SDK. No timeout loads 166 KiB for a page the user has never viewed.
- Apply the lazy path uniformly to both agreed landing routes. The paid funnel receives the same exception preservation as organic, but both routes accept that pre-init breadcrumbs and the beginning of sampled page-load performance transactions cannot be reconstructed.

This is preferred over `bundleSizeOptimizations.excludeTracing`, which changed the landing payload by only 56 gzip bytes under the current Turbopack build. It is also preferred over removing Sentry, which would discard valuable checkout and product-flow error reporting.

## Scope and non-goals

In scope:

- Route-aware dynamic loading of `@sentry/nextjs` from `instrumentation-client.ts`.
- A bounded, privacy-compatible buffer for exceptions raised before Sentry is ready.
- Root React error-boundary reporting through that same coordinator.
- Stable late forwarding for router-transition instrumentation.
- Existing LCP-image preload/high-priority changes on both landing surfaces.
- Regression, bundle, production-build HTML, and repeated Lighthouse verification.

Non-goals:

- No server/edge Sentry, DSN, sampling-rate, Replay, source-map, or proxy changes.
- No analytics consent/timing changes for Meta, Customer.io, PostHog, or funnel attribution.
- No cached/static ads-route fork in this implementation.
- No quiz code splitting, CSS isolation, font changes, or payment-provider loading changes.
- No UI, copy, question order, answer schema, resume behavior, submission, result routing, or checkout changes.
- No deployment, feature flag, production write, or `llms.txt` work.

## Target map

- `instrumentation-client.ts`: remove the eager runtime import; retain type-safe configuration; start the route-aware loader; expose the stable router-transition wrapper.
- `src/lib/observability/sentry-client-runtime.ts`: Sentry-free coordinator and singleton facade for route timing, bounded early-error and React-boundary capture, SDK readiness, failure isolation, flushing, and router forwarding. Mirror `createPostHogRuntime` and reuse `createBoundedFifo`; do not extract a new generic runtime abstraction.
- `src/lib/observability/sentry-scrubbing.ts`: existing Sentry-free source for the checkout scrubbers; import directly and do not change behavior.
- `src/app/global-error.tsx`: remove the static Sentry import and report through the coordinator facade so React-caught hydration/render failures force-load, queue, scrub, and flush correctly.
- `src/lib/analytics/runtime/post-paint.ts`: reuse unchanged unless tests expose a missing scheduler seam.
- `tests/instrumentation-client.test.ts`: preserve the current scrubber/configuration contract and the required explicit-client signature.
- `tests/sentry-client-runtime.test.ts`: coordinator timing, buffer, error conversion, failure, concurrency, and router-forwarding coverage.
- `tests/analytics-runtime.test.ts`: reuse the existing two-frame scheduler contract; add nothing unless its public behavior changes.
- `src/funnels/landing/organic-refresh.tsx` and `src/components/personal-plan-quiz/personal-plan-quiz.tsx`: retain the already implemented image-loading contract.
- `tests/organic-funnel-surface.test.tsx` and `tests/personal-plan-quiz-funnel-entry.test.ts`: retain image-loading regression coverage.

## Designed user journey

There is no visual or interaction change. The retained mobile screenshots are exact-parity evidence.

1. An organic visitor opens `/`. The same hero, profile image, copy, sections, tracking, and CTA behavior appear. The LCP image remains immediately discoverable and high priority. A lightweight listener protects errors during startup; the full Sentry browser SDK begins loading after the first paint.
2. An ads visitor opens `/lp/haarplan`. The same first quiz question, images, navigation, draft/resume behavior, and tracking appear. The current LCP image remains immediately discoverable and high priority. Sentry follows the same post-paint loading path.
3. If either landing throws before Sentry is ready, including a React hydration/render failure caught by the root error boundary, the error is retained in the bounded in-memory buffer and immediately starts the SDK load. It is sent through the existing scrubbers after initialization with the prior handled/unhandled classification preserved. The page never waits for Sentry.
4. If Sentry cannot load, the landing remains usable. Temporary listeners and buffered values are cleared; no user-facing warning or blocking fallback appears.
5. On authenticated, result, offer, checkout-adjacent, and other non-landing routes, the dynamic Sentry import starts immediately. Existing application behavior remains unchanged, and buffered early errors flush when the SDK is ready.
6. A landing opened in a background tab does not download Sentry until it becomes visible and completes two animation frames. An error while hidden still force-starts it.
7. Once Sentry is ready, later client-side route transitions use the normal Sentry router hook. Completion is the same visible page or journey state the user receives today.

Journey sign-off: **confirmed** by Nick on 2026-08-20, including the accepted loss of pre-init breadcrumbs and early sampled page-load trace detail.

## Planning evidence

- [`evidence/landing-performance-organic-surface.jpg`](evidence/landing-performance-organic-surface.jpg): current organic mobile surface; selected direction requires exact visual parity.
- [`evidence/landing-performance-ad-surface.jpg`](evidence/landing-performance-ad-surface.jpg): current flag-on ads mobile entry; selected direction requires exact visual parity.
- Disposable logic prototype question: can Sentry leave the hydration-critical bundle without deleting error reporting code?
- Decision criterion: at least a 20% initial-JS reduction on both landings plus a repeatable LCP/TBT improvement large enough to justify the observability trade-off.
- Finding: initial JS fell 399 -> 235 KiB gzip on `/` (41%) and 459 -> 295 KiB on `/lp/haarplan` (36%). Three-run median LCP improved 4.22 -> 3.24 s and 4.68 -> 3.60 s respectively; median TBT improved 104 -> 41 ms and 59 -> 40 ms. One ads prototype run remained slow, so the plan requires repeated final-tree verification and makes no guaranteed production claim.
- Prototype disposition: **discarded**. Production behavior must be reimplemented test-first.
- Evidence review: **confirmed** for the exact-parity screenshots and prototype results shown to Nick.

## Ordered tasks

### 1. Define the Sentry client-runtime contract test-first

Add failing tests for a small dependency-injected coordinator shaped after `createPostHogRuntime` and backed by the existing `createBoundedFifo` before production code:

- `/` and `/lp/haarplan` schedule SDK loading through the provided post-paint scheduler.
- Exact normalized matching is required: `/quiz` and `/lp/haarplan/angebot` start SDK loading immediately.
- Early `error` and `unhandledrejection` values are captured in FIFO order with a hard limit of ten; overflow drops the oldest value.
- The first early error bypasses the remaining post-paint delay and starts the shared load promise.
- Error events store the underlying `error`; rejection events store the underlying `reason`; safe fallbacks never serialize arbitrary objects.
- React-boundary capture queues the exception, force-starts loading, and remains available even if no `window` event fires.
- After module load, successful startup removes temporary listeners before synchronous initialization, flushes each buffered exception exactly once with the correct browser-unhandled or React-boundary-handled mechanism, and forwards later router transitions.
- Import/init rejection never throws into the product, removes temporary listeners, clears retained values, and does not flush them.
- Concurrent start calls share one load promise and initialize only once.

Completion criterion: the named runtime test fails on its behavioral assertions before the coordinator exists and passes without importing the real browser SDK.

### 2. Integrate route-aware Sentry loading without weakening privacy

Refactor `instrumentation-client.ts` so `@sentry/nextjs` is type-only at the static boundary and runtime-loaded by the coordinator. Change `initializeSentryClient` to require the dynamically loaded client explicitly. Import checkout scrubbers directly from `sentry-scrubbing.ts`. Keep the current DSN, environment, PII setting, sampling rates, Replay-off settings, Meta bridge filter, checkout scrubbers, and breadcrumb scrubber unchanged. Export the immediate stable router-transition wrapper required by Next/Sentry. Guard the browser startup call with `typeof window !== "undefined"` so Node imports remain valid. Replace `global-error.tsx`'s static Sentry import with the coordinator capture facade; do not call `captureException` on an uninitialized dynamically imported SDK.

Consumes: the coordinator contract from task 1.

Produces: one route-aware Sentry startup path with the existing configuration and scrubbers.

Add a source-level regression assertion that neither `instrumentation-client.ts` nor `global-error.tsx` value-imports `@sentry/nextjs`; retain the production-build script inspection as the stronger byte-level proof.

Add a static-value-import graph walk over the two landing route trees, root layout/error boundary, and instrumentation entry so a future transitive client import of `@sentry/nextjs` fails the top-level Node suite before it can restore the heavy initial chunk.

Completion criterion: existing scrubber tests pass, new runtime tests pass, React-boundary errors reach the coordinator, source assertions prohibit both static imports, build output contains no Sentry browser SDK in the initial landing scripts, and non-landing routes request the SDK immediately.

### 3. Verify image priority and final-tree performance together

Retain the current image changes and rerun the full supported evidence chain:

- Focused landing and instrumentation tests.
- Personal Plan nested tests.
- `npm run ci:verify`.
- Local production HTML/resource inspection for both landing routes.
- Initial script gzip accounting for both routes.
- At least three simulated-mobile Lighthouse runs per route against the unchanged baseline and the final tree. Reuse `npm run perf:mobile` with `LH_BASE_URL` pointed at the local production server, `LH_PATHS=/,/lp/haarplan`, `LH_FAIL_ON_THRESHOLD=0`, and an outer three-run loop. Set a distinct `LH_OUTPUT_DIR=tmp/lighthouse/run-$i` for each iteration; report medians and every run, including outliers.
- Browser checks that both mobile surfaces remain visually unchanged and functional, with no console errors caused by the loader.
- A forced fake import/init failure in automated tests proving Sentry cannot block the page.

Completion criterion: both routes retain one correct high-priority LCP image; initial JS falls at least 20% on each route; no journey regression appears; the final performance result is reported honestly even if Lighthouse variance reduces the prototype gain.

## Verification

Automated:

- `node --import ./tests/server-only-register.cjs --import tsx --test tests/landing-client-import-boundary.test.ts tests/instrumentation-client.test.ts tests/sentry-client-runtime.test.ts tests/sentry-client-filter.test.ts tests/analytics-runtime.test.ts tests/organic-funnel-surface.test.tsx tests/personal-plan-quiz-funnel-entry.test.ts`
- `npm run test:personal-plan:nested`
- `npm run ci:verify`

Manual/browser:

- Production-build `/` and `/lp/haarplan` with `PERSONAL_PLAN_QUIZ_V1_ENABLED=true` at the retained mobile viewport, using `localhost` for browser verification.
- Landing initial-script lists and gzip totals; confirm Sentry is a later dynamic chunk.
- Non-landing request trace confirming immediate SDK import.
- Later navigation trace confirming router-transition forwarding after readiness.
- Three Lighthouse runs per route, with per-run values and medians retained in the readiness receipt.

Required release follow-up if deployment is later authorized:

- Compare landing-route client error/event volume before and after deployment so a silent observability drop cannot pass unnoticed. Deployment readiness is not complete without this check being assigned and observed.
- Confirm release-health handled/unhandled proportions remain comparable; the implementation deliberately preserves the root-boundary classification used before this change.
- Compare field LCP/INP by route in Speed Insights; do not treat the local Lighthouse delta as production proof.

Live state:

- None. No database, Sentry project setting, flag, analytics, deployment, or production write.

## Review and handoff

- Worktree: `.worktrees/landing-performance-optimization`
- Branch: `codex/landing-performance-optimization`, based on `origin/main` at `f019782c`.
- Counterpart plan review: **reconciled**.
- Evidence review: **confirmed**.
- User-journey sign-off: **confirmed**.
- Artifact disposition: plan, two parity screenshots, source, and tests are **commit**; disposable prototype, Lighthouse scratch reports, and counterpart output are **discard** unless a review finding makes one durable.
- Counterpart findings ledger: accepted direct scrubber import, Node guard, named/gated runtime test, exact route matching, stable-hook rationale, safe error conversion with browser source location, previous root-boundary handled classification, listener removal before init, failure cleanup, source and transitive graph import guards, per-run Lighthouse output, flag-on environment, required post-deploy volume check, and first-class `global-error.tsx` integration for React-caught failures. Reuse `createBoundedFifo` and mirror `createPostHogRuntime`; do not extract a generic abstraction. Rejected expanding the scope to `/quiz`; it is a separate client entry after the organic landing and does not affect either landing's LCP. Rejected retry/kill-switch infrastructure because terminal loader failure was explicitly accepted, an initial-chunk failure previously broke hydration rather than merely observability, and either recovery still depends on a later deploy or navigation. Rejected a browser-runtime factory extraction because the coordinator is dependency-injected and the sole production wiring has direct built-browser trace evidence. Chosen direction: use the uniform lazy path for both landings, keep the ten-entry buffer, force-load on first error, allow hidden tabs to wait for visibility, and accept loss of pre-init breadcrumbs and the beginning of sampled landing pageload transactions in exchange for the measured landing gain.
- Residual risks: a short window exists before the full SDK is initialized; the bounded buffer and root boundary path preserve exceptions but not all Sentry breadcrumbs or the beginning of browser performance transactions. A terminal SDK failure clears the fallback buffer and leaves no further client reporting for that page lifetime. Background tabs do not initialize full Sentry until visible unless an error occurs. Lab gains may overstate production field gains.
- Stop point: verified, review-ready local implementation. No commit, push, PR, deploy, or production write without later authorization.

## Implementation and verification receipt

- Test-first red proof: `tests/sentry-client-runtime.test.ts` ran against an inert coordinator skeleton and failed all six behavioral contracts; the separate post-paint task-boundary test failed because the callback still ran directly inside the frame scheduler. The final graph guard was mutation-checked by temporarily adding a static Sentry import to the ads landing client graph; it failed with the exact import trail and passed after restoration.
- Green focused proof: the final landing, import-graph, instrumentation, Sentry-filter, analytics-runtime, and Personal Plan entry suite passes 50/50 with initialization-failure, task-boundary, source-location, classification, singleton-registration, and transitive bundle-boundary coverage.
- Production build: `PERSONAL_PLAN_QUIZ_V1_ENABLED=true npm run build` passed. The 165 KiB gzip Sentry SDK chunk is absent from both landing initial-script lists.
- Initial JS gzip: `/` is 215 KiB versus the recorded 399 KiB baseline (46% lower); `/lp/haarplan` is 275 KiB versus 459 KiB (40% lower).
- Runtime trace: `/` first paint 308 ms, Sentry request 327 ms; `/lp/haarplan` first paint 172 ms, request 176 ms; immediate control `/quiz` request 53 ms, first paint 68 ms. No browser errors or framework overlays; the ads quiz advanced from hair pattern to thickness.
- Three-run Lighthouse: `/` LCP 3101/3092/3099 ms (median 3099 ms), TBT median 57 ms, CLS 0, SEO 100. `/lp/haarplan` LCP 3539/3538/3557 ms (median 3539 ms), TBT median 58 ms, CLS 0, SEO 66. Versus the recorded medians, LCP improved by about 1.12 seconds organic and 1.14 seconds ads. The ads SEO score is reported as an existing route/indexability audit dimension and was not changed in this scope.
- Broader verification: `npm run test:personal-plan:nested` passed 571/571. `PERSONAL_PLAN_QUIZ_V1_ENABLED=true npm run ci:verify` passed typecheck, lint with four pre-existing warnings and zero errors, and production build.
- Final code review: counterpart review found no coordinator state-machine defect and independently confirmed the bundle boundary, privacy configuration, Next 16 image contract, Sentry mechanism typing, and focused suite. Supported classification, fallback fidelity, graph-guard, singleton-warning, test-isolation, and formatting findings were incorporated and their affected tests refreshed.
- Scratch disposition: `tmp/lighthouse/final-run-*` and the agent-browser screenshot are transient verification output and are discarded from the review tree.
