# Result Tracking Reliability — Implementation Plan

**Status:** Ready for implementation; Claude review incorporated
**Date:** 2026-07-16
**Base:** fresh `origin/main` at `78dc6a62343b1d346a5abd89573b59cd53034a3a` (PR #224)
**Evidence:** production quiz completion, network probes, repository tracing, and focused analytics tests run against this exact revision
**Independent review:** Claude Code reviewed the plan read-only twice on 2026-07-16. Accepted findings below cover both SDK page arguments, both affected FIFO assertions, an injectable real-loader regression, `sectionIndex` continuity, the repository's actual observer-test boundary, and the supported verification command. Final code review identified full-query URLs as a privacy blocker across browser analytics: the implementation therefore uses a shared value-constrained result-query allowlist, PostHog property sanitization, Meta page-view suppression on credential-bearing URLs, and checkout-return URL scrubbing before conversion events. Suggestions to reopen consent or treat app-value-stack as pending were rejected against current repository evidence: always-capture was an explicit owner decision, and app-value-stack is already the live canonical offer. `ready-check` is an available Codex workflow skill even though it is not an npm script.

## Goal Contract

**Outcome:** Make the canonical `/result/[leadId]` journey reliably observable: Customer.io receives the real dynamic page path and lifecycle events, PostHog retains granular offer engagement, and Meta retains conversion milestones without duplicating noisy interaction events.

**In scope:**

- repair the Customer.io browser SDK handoff;
- prevent Customer.io, PostHog, and Meta from receiving credential-bearing auth/payment-return URLs;
- add regression coverage for the SDK's thenable load result and queued page/event delivery;
- make the dynamic result URL construction directly testable;
- complete stable PostHog section coverage for the app-value-stack hero and testimonials;
- preserve engaged-section behavior and verify FAQ/section delivery through browser QA;
- run focused tests, typecheck, lint/build as appropriate, local browser QA, independent code review, and the repo ready-check.

**Out of scope:**

- checkout, billing, pricing, or server-side subscription lifecycle changes;
- sending section views or FAQ opens to Customer.io or Meta;
- new analytics vendors, dashboards, Customer.io campaign/page definitions, or consent-policy changes;
- offer copy, layout, routing, recommendation logic, or deployment;
- staging, committing, pushing, opening/merging a PR, or cleanup without separate authorization.

**Done when:** a production-shaped Customer.io loader test proves that the installed client is the SDK client rather than its `[client, context]` tuple; the full canonical result path is covered by a pure URL test; the app-value-stack section inventory includes hero and testimonials; the existing engagement observer tests pass and browser QA confirms FAQ/section delivery; all relevant repository checks pass; Claude and Codex review findings are resolved or explicitly rejected with evidence.

**Stop conditions:** stop for owner input only if fixing delivery requires changing consent behavior, sending granular engagement to another vendor, changing the canonical URL contract, or changing production credentials/configuration.

**Existing consent posture:** preserve the explicitly approved always-capture policy recorded in `plans/2026-07-12-analytics-loading-performance.md`, `plans/2026-07-13-offer-page-tracking-expansion.md`, and `docs/funnel-attribution.md`. This repair restores intended delivery; it does not reopen or silently change that policy.

## Locked Analytics Boundary

| Signal                                                                          | Destination                                           | Reason                                                  |
| ------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Page view with `/result/[leadId]?entry=...`                                     | Customer.io, PostHog; Meta PageView remains unchanged | Journey/lifecycle context and standard page measurement |
| `offer_viewed`, section views, CTA clicks, FAQ opens, plan interactions         | PostHog                                               | Detailed product analytics without lifecycle noise      |
| Quiz completion, pricing view, checkout start, purchase/subscription milestones | Existing routed destinations                          | Preserve current conversion attribution contract        |

No event-route expansion is part of this fix.

## Implementation

### 1. Repair the Customer.io SDK handoff

First narrow the local port in `src/lib/customerio-tracking.ts` so it is structurally compatible with the real SDK without a cast:

- change both the page category and page name parameters from `string | null` to `string | undefined` so the real SDK client satisfies the local port under strict function variance;
- dispatch pages with `client.page(undefined, operation.path, operation.properties)`;
- update both affected FIFO-order expectations in `tests/analytics-runtime.test.ts` and `tests/customerio-tracking.test.ts`, and retain a page-properties assertion.

Then update `src/lib/analytics/runtime/customerio.ts` so the browser loader awaits the SDK's PromiseLike result and extracts the first tuple item:

```ts
const loaded = AnalyticsBrowser.load({ cdnURL, writeKey })
const [client] = await loaded
return client
```

Do not return the thenable from an `async` function: JavaScript promise assimilation converts it to `[Analytics, Context]`, which is the current production failure. Preserve the EU/custom CDN option, single-flight runtime, queue behavior, and production-safe failure isolation.

Export an injectable `createCustomerIoBrowserLoader` whose inputs include `writeKey`, `cdnURL`, browser availability, and `importSdk`. The module-level runtime uses production defaults; tests inject a fake SDK module. Keep SDK-specific typing local to the runtime module and do not use `as CustomerIoBrowserClient`. Awaiting the SDK load intentionally discards the SDK's own pre-init buffer because this repository already owns ordering and bounds through its FIFO; a blocked/rejected CDN load continues to disable that queue.

### 2. Add a production-shaped Customer.io regression

Start by adding the regression against `createCustomerIoBrowserLoader`; it should fail to compile before that real loader seam exists. Use a fake PromiseLike SDK load result that resolves to `[client, context]`. Assert that:

- the helper resolves the actual client;
- the real loader seam returns the client rather than the tuple;
- `createCustomerIoRuntime` installs that client once;
- queued page and track operations flush through callable `page()` and `track()` methods in order;
- the existing loader-rejection test continues to disable the queue without affecting other analytics destinations.

This test must fail on the current implementation for the same reason observed in production.

### 3. Make canonical page paths testable

Create a shared analytics URL sanitizer and expose the Customer.io path builder from `src/providers/customerio-provider.tsx`: pathname plus only explicitly safe, value-constrained result query parameters, without a trailing `?`. Preserve `entry=quiz_completion` and `focus=routine|unlock-plan`; drop all other query parameters and all fragments. Use it in Customer.io and the explicit PostHog page view, and add focused assertions for:

- `/result/<lead-id>?entry=quiz_completion`;
- a path without query parameters;
- stable output when the same pathname/query inputs are repeated.
- removal of auth recovery codes, emails, Stripe session IDs, PayPal tokens, nested `next` URLs, and arbitrary values smuggled under safe keys.

Configure PostHog's supported `before_send` hook to apply the same sanitizer to automatic current/referrer/session-entry URL properties, including nested `$set`/`$set_once` initial URLs. Disable unused browser feature-flag requests so first-touch credentials cannot bypass that event hook. Meta cannot override the browser URL attached by the pixel: skip PageView on known credential-bearing queries/fragments, then scrub `/welcome` with `history.replaceState` and emit its PageView before checkout conversion events. Preserve UTM/fbclid PageViews and the current server-side funnel attribution path.

Keep the existing component-level `lastPageViewRef` dedupe guard unchanged; it is not claimed as a pure-helper assertion. Do not change route generation or add lead IDs as separate Customer.io traits in this task. The canonical path itself is the contract being protected.

### 4. Complete stable PostHog section coverage

Add `hero` and `testimonials` to `OfferSectionId` in `src/lib/analytics/events.ts` and tag the corresponding sections in:

- `src/funnels/offers/app-value-stack.tsx`;
- `src/components/quiz/app-value-stack-proof.tsx`.

Update the existing exact ordered inventory in `tests/result-offer-page.test.tsx`. Because inserting these sections changes every following DOM-derived `sectionIndex`, bump `OFFER_REVISION` from `product_led_v1` to `product_led_v2`; this preserves comparison through the existing `offer_revision` property. Section ID remains the primary analysis key. Keep CTA source typing on `OfferSectionId` and keep these events routed only to PostHog.

### 5. Verify FAQ and engaged-section behavior without inventing test infrastructure

Run `tests/offer-section-engagement.test.ts`, which directly proves the 25% visibility, 750 ms dwell, document-visibility, cleanup, and once-only observer semantics. The repository has no jsdom/browser-effect harness, and `OfferTrackingProvider` does not inject observer dependencies, so do not add source-regex tests that pretend to prove runtime effects or add a DOM test framework for this repair.

Inspect `src/components/quiz/offer-tracking-provider.tsx` to retain its shared `[data-offer-section]` observer path, FAQ open guard, and CTA interaction indexing unchanged. Then use local browser QA to prove:

- the new exact section inventory emits with DOM-order indices under `product_led_v2`;
- `faq` and `final_cta` emit after the engagement threshold;
- opening the same FAQ twice emits one `offer_faq_opened` event during the stable offer context;
- a CTA retains its source section and interaction index.

If browser QA exposes a reproducible provider defect, preserve that repro and make the smallest fix. Otherwise, do not change `offer-tracking-provider.tsx` beyond the `OFFER_REVISION` bump; treat the earlier production gap as a canary batching/observation problem and document the stronger post-deploy verification procedure.

## Verification

1. Red/green the new Customer.io tuple regression.
2. Run the focused analytics and offer suite:
   `npx tsx --test tests/analytics-tracking.test.ts tests/analytics-runtime.test.ts tests/acquisition-funnel-tracking.test.ts tests/customerio-tracking.test.ts tests/customerio-funnel-attribution.test.ts tests/offer-section-engagement.test.ts tests/result-offer-pricing-tracking.test.ts tests/result-offer-page.test.tsx` plus any new provider test.
3. Run `npm run ci:verify` using the repository's supported Node 22 runtime.
4. Start the worktree app and complete a local quiz. Confirm the canonical result URL, Customer.io page call, Meta PageView/ViewContent, PostHog `offer_viewed`, all section IDs, one FAQ open, and CTA payloads.
5. Run Claude Code read-only whole-branch review; verify every finding against code/tests.
6. Run the Hair Concierge `ready-check` and retain its report.
7. Stop before git publication or deployment. A post-deploy live canary is required after separately authorized merge/deploy: inspect Customer.io delivery requests plus PostHog/Meta events on the canonical production URL.

## Risks and Controls

- **SDK typing drift:** isolate tuple extraction and pin behavior with a production-shaped test.
- **PII in page URLs:** the current canonical route already contains the opaque lead ID; do not add names, email, or quiz answers to page properties.
- **Observer false negatives in browser probes:** use deterministic component tests and a post-deploy canary that waits for engagement thresholds and flush/navigation.
- **Duplicate analytics:** retain provider dedupe and once-per-mount section/FAQ guards; do not widen event routes.
- **Stale-base regression:** all implementation and checks run in the isolated worktree created directly from `origin/main` at PR #224.
