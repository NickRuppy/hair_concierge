# Meta event ownership and deduplication

## Outcome and source context

Chaarlie's Meta dataset should expose a small, semantically accurate funnel with deliberate ownership and reliable browser/server deduplication:

- `Lead` means the quiz answers, email, and consent choice were successfully persisted.
- the primary optimization conversion, **Offer Page Viewed**, is a Meta custom conversion scoped to `ViewContent` with the exact rule `content_name = quiz_result_offer_view` and occurs only on the first offer display reached directly from quiz completion in that browser funnel session.
- `Purchase` and `Subscribe` remain authoritative billing outcomes with matching browser and server copies.
- `PageView` and other anonymous intent events remain browser-only.
- `CompleteRegistration` and the Meta custom `QuizCompleted` event are retired because neither represents a distinct Chaarlie conversion once `Lead` and Offer Page Viewed are separated.

Source context:

- Live Events Manager review on 2026-07-17 showed strong browser match parameters but low browser/server event coverage: PageView 25.79% and Lead 8.89%, compared with Meta's displayed 75% recommendation.
- The live dataset receives CAPI copies of non-billing events even though the repository's direct CAPI adapter currently handles billing events only.
- Meta's official guidance recommends a redundant Pixel+CAPI setup for important website conversions and deduplication using matching event name plus Event ID: <https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events>.
- Meta's CAPI parameter guidance requires `event_source_url` for website events and recommends `event_id` for deduplication: <https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event>.

## Chosen direction

Use the Meta Pixel for anonymous navigation and intent. Use matching Pixel+CAPI copies for the three valuable conversion milestones that benefit from redundant delivery:

| Chaarlie milestone | Meta representation | Source ownership | Deduplication ID |
| --- | --- | --- | --- |
| Page load | `PageView` | Pixel only | none |
| Quiz start | `QuizStarted` | Pixel only | existing funnel event ID if retained |
| Successful quiz/email submission | `Lead` | Pixel + direct first-party CAPI | existing `funnelEventId` |
| First offer view after quiz completion | `ViewContent`, `content_name=quiz_result_offer_view` | Pixel + direct first-party CAPI | privacy-safe deterministic `metaEventId` derived from stable lead/funnel identity and shared with the same-domain CAPI request |
| Checkout start | `InitiateCheckout` | Pixel only | existing checkout attempt event ID |
| Successful initial payment | `Purchase` | Pixel + billing CAPI | Stripe Checkout Session ID or `paypal:<subscription_id>` |
| Successful subscription activation | `Subscribe` | Pixel + billing CAPI | same provider-stable activation ID |

Create a Meta custom conversion named **Offer Page Viewed** with source event **`ViewContent`** and the exact rule **`content_name` equals `quiz_result_offer_view`** after the new event has arrived in production. The unique value and explicit event scope ensure existing `InitiateCheckout(content_name=quiz_result_offer)` and `ViewContent(content_name=quiz_result_offer_pricing)` events cannot qualify. Changing an active ad set's optimization event remains a separate cutover decision because it can affect paid delivery and spend.

Offer Page Viewed is intentionally distinct from Lead even though Chaarlie redirects automatically after lead creation: Lead proves the quiz/email record was saved, while Offer Page Viewed proves the offer rendered successfully. The latter is the stronger delivery signal Nick selected for future Meta optimization; redirect failures and pre-render exits remain Leads but not offer views.

The unexplained non-billing CAPI source must be identified before the new direct Lead and offer-view CAPI senders are enabled. Lead and offer-view delivery ship behind separate default-off server flags, `META_CAPI_LEAD_ENABLED` and `META_CAPI_OFFER_VIEW_ENABLED`, so code can be deployed and verified without creating a third event copy. If that source cannot be controlled, the live CAPI cutover remains blocked rather than introducing another sender.

Execution is split into two review units:

1. **Phase A:** sender inventory, semantic cleanup, Lead/offer-view deduplication, PageView ownership, custom conversion, and documentation.
2. **Phase B:** PayPal browser/server Purchase and Subscribe parity. Stripe's already-aligned Checkout Session ID behavior remains protected during Phase A.

## Scope and non-goals

### In scope

- identify the active non-billing CAPI sender and determine how to stop its PageView and conversion mirroring;
- establish and test the event ownership matrix above;
- retire Meta `CompleteRegistration` and custom `QuizCompleted` while preserving internal `quiz_completed` analytics;
- add direct CAPI delivery for Lead and the initial quiz-completion offer view using matching browser/server IDs;
- make PayPal Purchase/Subscribe browser IDs match server IDs;
- add missing website attribution parameters to CAPI payloads when already available (`event_source_url`, `_fbp`, `_fbc`, IP/user agent for request-bound events);
- verify Stripe and PayPal separately in Meta Test Events;
- create the Offer Page Viewed custom conversion after its production source event exists;
- document the canonical event matrix and operator verification procedure.

### Non-goals

- no cookie-consent or legal-policy changes in this task;
- this deferral explicitly accepts that first-party CAPI adds hashed email and request metadata to the Meta transfer; the existing email-marketing consent flag must not be repurposed as advertising consent;
- no new user-facing UI, copy, timing, navigation, or checkout behavior;
- no attempt to raise anonymous PageView Event Match Quality by collecting additional identity data;
- no fake `value` or `currency` for non-commerce events;
- no active campaign/ad-set optimization change without a separate explicit cutover confirmation;
- no replacement of PostHog, Customer.io, funnel attribution, or the billing analytics outbox;
- no generic multi-vendor analytics platform, new durable outbox, or supplemental CAPI retry loop for Lead/offer copies; Pixel is the fallback and these server copies are best-effort.

## Target map

- `src/lib/meta-pixel.ts`
  - remove the Meta `CompleteRegistration` plus `QuizCompleted` dual emission;
  - add the canonical offer-view `ViewContent` helper;
  - preserve existing Purchase/Subscribe dedupe behavior.
- `src/lib/analytics/routes.ts`
  - stop routing `quiz_completed` to Meta;
  - keep `offer_viewed` on its internal destinations and do not route it generically to Meta, so revisits remain observable without becoming primary Meta conversions.
- `src/lib/analytics/destinations/meta.ts`
  - retain no generic `offer_viewed` mapping; the claimed primary conversion uses the dedicated Pixel helper instead.
- `src/lib/analytics/page-url.ts`
  - add a new verified-domain aggregate-offer-URL export that never exposes the lead ID embedded in `/result/<leadId>`; do not alter the existing helper used by other destinations.
- `src/components/quiz/offer-tracking-provider.tsx`
  - derive one explicit privacy-safe deterministic browser `metaEventId` from the stable lead/funnel/offer identity, separate from the internal `funnelEventId`;
  - claim the conversion once per stable lead/funnel session before sending either copy;
  - send the Pixel event and call the same-domain CAPI endpoint with that identical `metaEventId` only after the claim succeeds.
- `src/lib/analytics/offer-engagement.ts`
  - reuse/factor its claim-key pattern through a separately named `localStorage` offer-view claim so the primary view does not consume the later engagement claim;
  - key the claim with stable `leadId` plus funnel-session/variant context rather than the per-mount event ID, making it one-per-browser/funnel rather than one-per-tab;
  - fail closed for this primary conversion when storage is unavailable or throws, preventing reload duplicates at the cost of missing that Meta event.
- new `src/app/api/analytics/meta-offer-view/route.ts`
  - accept only a valid UUID `metaEventId`, stable lead ID, and the allowed quiz-completion entry context from the browser;
  - verify the lead against server-owned funnel/quiz-completion evidence rather than trusting the browser's `entryContext` string alone;
  - follow the bounded-body, dependency-injection, and lead/IP rate-limit shape of the existing `offer-engaged` route;
  - load matchable lead fields server-side, construct a safe aggregate source URL, and send CAPI best-effort behind `META_CAPI_OFFER_VIEW_ENABLED`;
  - never send from the result page's server render, so refreshes cannot create server-only conversions.
- `src/app/api/quiz/lead/route.ts`
  - queue a matching CAPI Lead after a successful insert or deduplicated lead update only when the request supplied a valid browser `funnelEventId`;
  - keep the route's server fallback ID for internal compatibility but never use that fallback for CAPI because no Pixel event can share it;
  - keep Meta failure isolated from the quiz response.
- new standalone server Meta module under `src/lib/analytics/`, implemented with the Lead and offer routes
  - own hashing, `_fbp`/`_fbc` validation, server payload construction, safe `event_source_url`, timeout, and test-event code;
  - leave the working billing Meta adapter and revenue outbox untouched in Phase A; extract shared primitives later only if proven duplication warrants it.
- Stripe checkout creation and webhook analytics surfaces
  - carry validated Meta browser/click IDs and source URL into the billing event payload;
  - preserve Checkout Session ID as the browser/server Purchase ID.
- PayPal checkout intent, activation, and webhook analytics surfaces
  - carry validated Meta browser/click IDs and source URL;
  - standardize Purchase/Subscribe ID as `paypal:<subscription_id>` on both browser and server.
- tests likely including `tests/meta-pixel.test.ts`, `tests/analytics-tracking.test.ts`, `tests/billing-analytics-destinations.test.ts`, Stripe checkout/webhook tests, PayPal checkout/webhook tests, and focused lead/result route tests.
- `src/components/quiz/result-offer-pricing.tsx` and its analytics tests
  - preserve `content_name=quiz_result_offer_pricing` while proving the custom conversion's equality rule cannot count it.
- extend the existing `docs/analytics/offer-page-tracking.md` contract instead of creating a parallel document.

## Designed user journey

There are no end-user surface changes.

1. A visitor enters through an ad or another source and browses Chaarlie. The browser Pixel sends PageView and intent events; the server does not mirror anonymous PageViews.
2. The visitor completes the quiz, submits their email, and accepts or declines marketing consent. Chaarlie persists the lead first. After success:
   - the browser sends `Lead` with the existing funnel event ID;
   - the server sends `Lead` with the same event name and ID plus available matching data;
   - Meta deduplicates the pair into one Lead;
   - if the server CAPI call fails, the quiz still succeeds and the Pixel remains the fallback.
3. Chaarlie opens the canonical offer route with `entry=quiz_completion`. Once the offer is successfully rendered, the browser claims the primary conversion once for that stable lead/funnel session and derives one privacy-safe deterministic `metaEventId`:
   - the browser sends `ViewContent` with `content_name=quiz_result_offer_view` and that ID;
   - the browser calls Chaarlie's same-domain endpoint, which sends CAPI with the same event and ID;
   - Meta deduplicates the pair into one Offer Page Viewed conversion.
4. Reloading, navigating back, or opening the same result in another tab normally fails the already-held browser/funnel claim, so neither a new Pixel copy nor a new CAPI request is sent. Two exactly simultaneous tabs may race the browser claim, but both derive the same `metaEventId`, so Meta deduplicates them. If browser storage is unavailable, the primary Meta conversion fails closed. Opening a saved result, clicking a result email, or returning from the routine may still be measured internally as `offer_viewed`, but never qualifies for the primary Meta conversion.
5. The visitor starts checkout. The browser sends `InitiateCheckout`; provider metadata retains the available Meta click/browser identifiers for the later authoritative outcome.
6. After successful Stripe or PayPal activation, the billing webhook creates the durable CAPI Purchase/Subscribe event. The browser confirmation sends the matching event when the return/activation flow is available. Both use the same provider-stable event ID and Meta counts one conversion.
7. If the customer closes the browser before returning, the billing CAPI event still records the purchase. If CAPI delivery temporarily fails, the existing billing outbox retries it.
8. The operator sees Lead, Offer Page Viewed, and Purchase as distinct funnel milestones. Active campaigns remain unchanged until Nick separately approves switching an ad set to Offer Page Viewed.

User-journey sign-off: **confirmed by Nick on 2026-07-17 with the instruction to implement the plan using explorer and worker subagents**.

## Mockup evidence

No mockup is required because the work changes only analytics emission, Meta configuration, and operator diagnostics. The rendered Chaarlie UI and customer journey remain unchanged.

Mockup review status: **not applicable**.

## Ordered tasks

### 1. Prove and inventory every live Meta sender

This is a live, read-only operator/browser task owned by Codex with Nick's signed-in session; it is not delegated to a code implementer.

- Use Meta Test Events to trigger uniquely identifiable PageView, Lead, offer-view, and checkout events.
- Record source, event name, event ID, URL, integration, and timestamp for browser and server copies.
- Inspect Meta integration management, Business integrations, Vercel integration/env names, and any DNS/CAPI Gateway path.
- Account for the repository's known billing-only server event names (`Purchase`, `Subscribe`, `PaymentFailed`, `RefundCompleted`, and subscription lifecycle events) so they are not mistaken for the unexplained sender.
- Identify the exact control that can disable or exclude the unexplained PageView and non-billing conversion copies.
- Do not change the production integration during this discovery task.

Completion criterion: every live server event is mapped to a named sender/configuration and the safe cutover action is documented. If the sender cannot be controlled, stop and request direction before adding another CAPI source.

Implementation evidence, 2026-07-17:

- Meta lists three connected integrations for the Chaarlie dataset: **Conversions API Gateway** (`Chaarlie`, active), **Meta Pixel**, and direct **Conversions API**.
- The Gateway is the previously unexplained source that mirrors browser events; its dataset integration is `Conversions API Gateway for Pixel 988892550357504`.
- The Gateway settings control is disabled in the available Meta UI and its domain table exposes no controllable exclusion, so production enablement of either new first-party flag remains blocked.
- The event table's **Used by** column is empty for `CompleteRegistration` and `QuizCompleted`, and the business has no custom conversions. Retiring those redundant browser events therefore has no observed active paid-delivery dependency.

### 2. Encode the canonical event contract in tests

- Add failing tests for the chosen event matrix before implementation.
- Prove `quiz_completed` continues to reach internal destinations but not Meta.
- Prove the dedicated claimed path emits one Meta `ViewContent` with `content_name=quiz_result_offer_view` and the canonical Event ID while the ordinary internal `offer_viewed` route remains Meta-free.
- Prove existing `ViewContent(content_name=quiz_result_offer_pricing)` and `InitiateCheckout(content_name=quiz_result_offer)` cannot satisfy the Offer Page Viewed event-plus-parameter contract.
- Prove saved-result/email/routine-return offer views do not produce the primary Meta conversion.
- Prove reload/back/second-tab navigation in the same browser/funnel produces neither a second Pixel copy nor a second offer-view CAPI request, including fail-closed storage-error behavior.
- Prove PageView has no server routing.

Completion criterion: focused tests fail for the current incorrect behavior and precisely describe the intended source/event matrix.

### 3. Implement direct CAPI primitives and correct Lead/offer semantics

- Build a narrow standalone Lead/offer request constructor and transport; do not refactor the working billing Meta adapter in Phase A.
- Validate/hash customer fields according to Meta's parameter contract.
- Support `event_name`, `event_time`, `event_id`, `action_source=website`, a narrow verified-domain `/result` source URL, user data, custom data, test-event code, and timeout. Supplemental Lead/offer sends have no retry loop.
- Never log raw email, name, IP, `_fbp`, `_fbc`, access token, or full request bodies.
- Remove Meta emission from `quiz_completed`; keep Customer.io, PostHog, and funnel milestones intact.
- Remove `CompleteRegistration` and custom `QuizCompleted` browser sends.
- Remove `CompleteRegistration` from the Meta event type union once no caller remains.
- Before removal, prove no active ad set, audience, or custom conversion depends on either event; otherwise stop for a paid-delivery decision.
- Add browser and default-off server CAPI `Lead` using the successful lead-save `funnelEventId`, but send the server copy only when the browser request supplied that valid UUID.
- Add `ViewContent(content_name=quiz_result_offer_view)` only on the dedicated quiz-completion path. After a stable `localStorage` claim succeeds, derive one privacy-safe deterministic `metaEventId` from the stable lead/funnel/offer identity, pass it to both Pixel and the same-domain offer-view endpoint, and use it as the CAPI `event_id`.
- Keep the internal `funnelEventId` and Meta-only `metaEventId` explicitly separate; never call either an ambiguous offer-view ID.
- The offer-view endpoint validates the UUID, verifies recent server-owned quiz/funnel evidence for that lead, loads matching data by lead ID, rate-limits abuse, and no-ops while `META_CAPI_OFFER_VIEW_ENABLED=false`.
- The result page's server render never sends CAPI. The browser/funnel claim gates both browser and endpoint calls, so remounts, reloads, and second tabs cannot create server-only copies.
- Keep Meta failure off the customer-critical response/render path.

Completion criterion: billing destination tests still pass; focused payload/transport tests cover validation, timeouts, redaction, and Meta errors; one user action yields matching browser/server identifiers; and no revisit produces either copy of the primary offer conversion.

### 4. Phase B: normalize PayPal conversion deduplication separately

- Keep Stripe Checkout Session ID as the matching Purchase/Subscribe ID.
- Define and test `paypal:<subscription_id>` as the canonical PayPal browser/server ID.
- Add an explicit safe token-to-subscription resolution so the return browser can obtain the same canonical ID; do not derive it from the current hashed return token.
- Ensure PayPal's successful activation surface has the plan, interval, currency, and value required for the browser Purchase and emits browser `Subscribe`, which is currently absent.
- Populate `payload.meta_event_id` for PayPal server events so the existing CAPI ID preference uses the same canonical value instead of a sale/source-object ID.
- Carry validated `_fbp`, `_fbc`, and event-source URL from checkout creation into the server billing event for both providers.
- Preserve the existing durable billing outbox and idempotency behavior.

Completion criterion: provider-specific contract tests show one browser and one server Purchase and Subscribe with identical name/ID and matching value/currency where applicable, while webhook retries remain idempotent. Phase B is reviewed and shipped independently after Phase A evidence is stable.

### 5. Deploy disabled, cut over the live sender, and enable direct conversion CAPI

This is an operator task. Codex may inspect and test through Nick's signed-in browser, but any production integration switch remains a separate explicit approval gate.

- Deploy new non-billing CAPI behavior with both production flags off.
- Re-run Meta Test Events to prove no unintended browser changes.
- Present the exact external Meta/gateway setting change for approval.
- After approval, disable the unexplained top-funnel mirroring and enable `META_CAPI_LEAD_ENABLED` and `META_CAPI_OFFER_VIEW_ENABLED` in one controlled cutover. If the old sender cannot be disabled or excluded, do not enable either new sender.
- Verify no third copy appears.

Completion criterion: PageView is browser-only; Lead and the initial offer view each produce exactly one deduplicated conversion from matching Pixel+CAPI copies.

### 6. Create and validate the Offer Page Viewed conversion

This is an operator task performed in Meta after production source events exist; it is not part of the code implementer's completion gate.

- After Meta receives the canonical event, create a custom conversion named Offer Page Viewed with source event **`ViewContent`** and filter **`content_name` equals `quiz_result_offer_view`**.
- Do not alter active campaigns or ad sets.
- Validate that a fresh quiz completion triggers it and a saved-result/email revisit does not.

Completion criterion: the custom conversion is active and testable, with no campaign delivery change.

### 7. Document and monitor

- Extend `docs/analytics/offer-page-tracking.md` with the canonical event matrix, IDs, payload ownership, test procedure, and rollback switches.
- After deployment, schedule an operator follow-up for the next seven days or at least ten Leads plus provider-specific test purchases, whichever provides more useful evidence; this observation window is not a branch-readiness gate.
- Track delivery recency, Meta diagnostics, Event Match Quality for valuable events, deduplication coverage, CAPI failures, and billing outbox status.
- Treat PageView EMQ as informational rather than a target.

Completion criterion: no active semantic/currency diagnostic remains for retired quiz events, dual-source conversion coverage trends toward Meta's displayed 75% benchmark, and operator evidence is retained.

## Verification

### Automated

- focused Meta Pixel and analytics-routing tests;
- standalone Lead/offer CAPI payload/transport tests;
- lead route success, dedupe, and Meta-failure isolation tests;
- offer-view endpoint validation, disabled-flag, rate-limit, matching-data, and Meta-failure isolation tests;
- offer-entry-context routing tests;
- Stripe checkout metadata, webhook, browser Purchase, and billing destination tests;
- PayPal checkout intent, activation, webhook, browser Purchase, and billing destination tests;
- `npm run test:node` for the repository Node test suite;
- `npm run ci:verify` as the repository-wide verification command;
- relevant full test command from `ready-check`.

### Manual/browser

- complete a fresh quiz from a Meta Test Events-launched browser;
- verify one browser plus one server Lead with matching name/ID;
- verify one deduplicated `ViewContent` with `content_name=quiz_result_offer_view`;
- reload/back/open saved result and confirm neither Pixel nor the same-domain CAPI endpoint creates another primary conversion;
- complete Stripe and PayPal sandbox/test checkouts and verify matching browser/server Purchase IDs, value, and currency;
- verify PageView remains browser-only.

### Live state

- identify and screenshot/export the old non-billing CAPI sender before any cutover;
- confirm the new server sender is disabled before deployment and enabled only after the old mirroring is disabled;
- verify custom conversion creation without changing an ad set;
- review Events Manager after enough real traffic to avoid conclusions from two purchases or a single day.

### Evidence-sensitive review

- do not claim duplicate counting solely from low Event Coverage;
- distinguish a low anonymous PageView match score from delivery failure;
- verify all counterpart findings against current `origin/main` and tests;
- do not treat Meta recommendation cards as semantic requirements when the underlying event is not a revenue action.

## Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| B1 | defect | Existing pricing `ViewContent` shares the proposed prefix and checkout uses the old value exactly | accepted | Use unique `quiz_result_offer_view` and scope the conversion to `ViewContent` plus exact equality | collision tests and Meta Test Events |
| B2 | defect | PayPal browser hashes the return token while server falls back to a sale/source-object ID | accepted | Explicit token-to-subscription resolution and `meta_event_id`; Phase B | PayPal activation/webhook contract tests |
| B3 | defect | PayPal browser skips `subscription_started` | accepted | Add browser Subscribe in Phase B | PayPal browser/server event test |
| B4 | defect | Mounted-view ref resets on reload/remount | accepted | Session claim gates both Pixel and same-domain CAPI request | reload/back browser and endpoint test |
| B5 | defect | Missing offer envelope causes browser to mint a different ID | accepted | Use one explicit browser `metaEventId` for both copies, independent of the internal envelope | null-context and access-variant tests |
| H1 | defect | Raw result path contains durable lead ID | accepted | Send aggregate verified-domain offer URL | payload redaction test |
| H2 | defect | Inventory could misclassify known billing lifecycle CAPI events | accepted | Name known billing events in inventory | live source ledger |
| H3 | defect | `npm run ci:verify` does not execute tests | accepted | Run both `npm run test:node` and `npm run ci:verify` | ready-check evidence |
| T1 | scope/product decision | Server CAPI creates an additional Meta transfer path | deferred per user instruction | Keep consent/legal changes out of scope; do not reuse email-marketing consent as advertising consent | residual risk recorded at handoff |
| T2 | scope/product decision | Retiring events may starve an active dependent ad set | accepted as hard preflight | Block removal if a dependency exists | live Meta dependency inspection |
| T3 | tradeoff | PayPal parity has independent uncertainty | accepted | Split Phase B into a separate review unit | Phase A review then Phase B plan check |
| T4 | tradeoff | Old sender may be visible but uncontrollable | accepted | Block live enablement if it cannot be disabled/excluded | cutover checklist |
| B6 | defect | A CAPI send from the force-dynamic result server render would mint a new event on every reload | accepted | Move offer CAPI behind the browser's successful session claim and call a same-domain endpoint | reload asserts no Pixel and no endpoint call |
| B7 | defect | `offerViewId` and `funnelEventId` made “offer-view ID” ambiguous | accepted | Define a separate `metaEventId`; never reuse the ambiguous label | naming and identifier contract tests |
| B8 | defect | Lead route currently mints a fallback ID that no browser event shares | accepted | Send Lead CAPI only for a valid browser-supplied UUID | missing/invalid ID route tests |
| B9 | defect | Offer conversion could disappear when the optional funnel-attribution envelope is absent | accepted | Make Meta `metaEventId` and claim independent of the envelope | disabled-funnel-attribution test |
| H4 | maintainability | Existing session-claim code is useful prior art but represents engagement, not viewing | accepted | Reuse/factor its storage pattern with a distinct primary-view key | claim isolation test |
| T5 | review-environment limitation | Counterpart could not resolve Codex-local workflow skills | rejected after verification | Keep the repository-required `implementation-loop`; it owns `ready-check` and `request-code-review` | skill files verified locally |
| B10 | defect | Generic `offer_viewed` routing conflicts with a claim-gated dedicated send and would re-fire on revisits | accepted | Keep internal routing Meta-free; emit the primary Meta pair only from the claimed provider path | router plus revisit tests |
| B11 | defect | `sessionStorage` is per-tab and its existing helper fails open | accepted | Use a distinct `localStorage` claim keyed by stable lead/funnel context and fail closed | reload, second-tab, and storage-error tests |
| B12 | defect | Browser-supplied `entryContext` is not authoritative | accepted | Verify recent lead-owned quiz/funnel evidence server-side before CAPI send | forged-context endpoint test |
| H5 | maintainability | Refactoring the working billing CAPI adapter adds revenue-path risk to Phase A | accepted | Build standalone non-billing transport and leave billing untouched | billing regression tests |
| T6 | product decision | Lead automatically redirects to the offer, so the two milestones will often be near 1:1 | accepted per Nick's chosen model | Keep both: Lead means persisted data; Offer Page Viewed means successful offer render and is the intended optimization target | funnel drop-off comparison |
| T7 | legal/product decision | New CAPI sends hashed email and request metadata server-side | deferred per Nick's instruction | Record the escalation; make no consent-policy change and do not reuse email-marketing consent | explicit handoff risk |
| B13 | defect | `localStorage` claims are not atomic across two exactly simultaneous tabs | accepted | Derive the same privacy-safe Meta ID from stable lead/funnel/offer identity so Meta can deduplicate a claim race | concurrent-derivation test |

## Review and handoff

- Planning/Phase A implementation worktree: `.worktrees/meta-event-quality`
- Branch: `codex/meta-event-quality`, based on fresh `origin/main` at `99632b1`
- Required execution workflow: `implementation-loop`, which owns `ready-check` and `request-code-review`.
- Required counterpart review: Claude plan review reconciled before implementation; one Claude whole-branch review before push as routed by repository instructions.
- Mockup review: not applicable.
- User-journey sign-off: confirmed 2026-07-17.
- Phase B PayPal parity uses a separate implementation branch/review unit after Phase A; the overall chosen event model remains unchanged.
- External production integration cutover and any active-ad-set optimization change are separate approval gates.
- Stop point: review-ready local branch. Commit, push, draft PR, Meta integration cutover, campaign changes, merge, and deployment require their respective workflow/approval boundaries.
