# Overlap Stripe client loading with one-time checkout preparation

## Outcome and evidence

Reduce the time until all one-time checkout methods are usable by starting the cached Stripe.js client load at the moment the customer explicitly opens checkout, in parallel with the existing server preparation. Do not pre-create or reorder any Stripe Session, PayPal Order, provider ownership, consent, payment, or recovery work.

Production evidence from 2026-08-07 is directional because the sample is small:

- seven real one-time checkout opens and six Stripe preparations;
- median Stripe prepared response: 2.53 s after checkout open;
- median prepared-response-to-provider-ready gap: 1.09 s;
- median total Stripe provider readiness: roughly 3.62 s;
- PayPal SDK readiness: 1.75 s median.

Code evidence:

- membership checkout already calls `getOfferStripePromise()` inside its explicit `openCheckout` path;
- one-time `PersonalPlanOneTimeCheckout` mounts only after the explicit open creates `attemptId`, but currently does not start the loader when it mounts;
- one-time Stripe.js therefore starts only after that child receives a prepared client secret and renders `StripeOfferElementsCheckout`;
- `getOfferStripePromise` is a module-level singleton backed by `@stripe/stripe-js/pure`; repeated calls reuse the same promise and a rejected load clears the cache for retry;
- the old `GuidedStorySupport` warm path is currently imported nowhere in `src/`, so it does not already close this gap; removing that separately tested dead component is out of scope here.

### Implementation contract

- **Outcome:** Stripe.js network/bootstrap work begins on explicit one-time checkout open and overlaps the server prepare request; the later Elements mount reuses the same promise.
- **Constraints:** no loader call before explicit open; no Stripe Session or PayPal Order prewarm; no server-route, consent, provider ownership, idempotency, capture, account, recovery, copy, markup, layout, or `/welcome` change; no new analytics event.
- **Non-goals:** Vercel region movement, dead-query cleanup, PayPal SDK behavior, asynchronous fulfillment, or provider redesign.
- **Stop condition:** stop on any pre-open Stripe request, duplicate loader invocation, payment/recovery regression, increased provider-load failure, or lack of measurable readiness benefit.
- **Done when:** Nick approves the timing storyboard/journey; Claude has no unreconciled blocker; focused/full verification passes; a cold-browser trace proves the Stripe.js request starts before the prepare response; and production evidence supports keeping the overlap.

Branch gate is already satisfied: planning is isolated in `.worktrees/payment-checkout-performance` on `codex/payment-checkout-performance`, while the primary checkout remains on `main`. Re-run `.agents/skills/branch-gate/SKILL.md` before implementation handoff.

## Options considered

### A. Explicit-open Stripe.js overlap — selected

In `PersonalPlanOneTimeCheckout`, place a warm effect immediately before the existing Stripe prepare effect. The child mounts only after an explicit one-time checkout open creates `attemptId`, and it already owns the exact eligibility predicates used by both the prepare request and eventual Elements child:

```tsx
useEffect(() => {
  if (!canStartPayment || !stripeCheckoutMounted) return
  warmOfferStripe()
}, [canStartPayment, stripeCheckoutMounted])
```

The existing child continues calling `getOfferStripePromise()` when it mounts; that call receives the cached promise.

**Easier:** reuses the existing named helper and the child's existing `canStartPayment`/`stripeCheckoutMounted` predicates; no duplicated parent guard or hook dependency; no business/payment state change.  
**Harder:** Stripe.js newly downloads for an eligible explicit-open attempt whose prepare response ultimately becomes unavailable or PayPal-locked. Attempts that reach the prepared child already download it today. Because the current loader uses Stripe's default advanced-fraud-signals behavior, this also moves that provider bootstrap earlier and extends it to those otherwise-unprepared attempts.  
**Residual risk:** the extra concurrent download could contend with PayPal or reject before the prepared child renders. The singleton must reset after rejection, and PayPal readiness is a release guardrail. The earlier fraud-signal surface is a pre-publication owner decision; silently disabling it would change the payment fraud posture and is outside this performance change.

### B. Copy-only reassurance — rejected

Claude review showed the contradictory parent copy exists for only about 0.8 s median and `paypalReady` can be stale on same-attempt recovery remounts. It would not address the longer 1.09 s sequential Stripe client phase.

### C. Server and region changes — deferred

The recently hardened Stripe route is not touched for a marginal dead read. A global `dub1` move risks chat/auth/webhook/cron latency and lacks a true chat TTFT guardrail. Both require separate plans.

### Settled safety decisions

- **Placement:** child-mount warm effect, because it reuses the exact existing eligibility predicates and sits immediately beside the prepare effect it overlaps.
- **Call form:** existing `warmOfferStripe()` helper, with no loader/helper rewrite.
- **Rollback:** isolated revert-and-redeploy, not a new runtime flag; a flag would add more production branching than the one-effect optimization.
- **Release evidence:** conservatively block release until 10 matched pre-period samples exist; use 10 post samples for a provisional read and 20 samples or day 14 for the keep/revert decision. Low traffic alone does not trigger revert; correctness and business-outcome guardrails do.
- **Prior outage:** do not assume the Aug-2 one-time outage is closed from latency data alone. Immediately before release, reconfirm current checkout health with a fresh real walkthrough plus Sentry, provider, funnel, `billing_one_time_purchases`, paid-access, and activation-outbox evidence. An independent outage pauses rollout and is contained/investigated separately rather than being attributed automatically to this optimization.
- **Preconnect:** considered but deferred; adding an offer-page resource hint is a separate markup/network-policy change and is unnecessary to test the better-grounded explicit-open overlap first.
- **Warm-attempt observability:** accept that a rejected speculative warm is intentionally silent and is only visible indirectly if the authoritative child retry delays/fails provider readiness. Do not add a new lifecycle event for an optimization that does not own payment state; use ready p95, the automated failure case, Sentry, and the child/provider error path as guardrails.
- **Stripe fraud signals:** the successful prepared-child path already loads Stripe.js before provider choice today, but the overlap advances that bootstrap and adds it to eligible opens that end in prepare-unavailable, duplicate-access, or PayPal-lock states. Treat Stripe's default advanced fraud signals as unchanged provider behavior, not as a newly approved legal classification. Publication requires an explicit owner decision to accept this limited expansion or to replace the overlap with a lower-gain connection-only optimization; do not disable fraud signals implicitly.

## Exact behavior and invariants

### Before

1. Customer explicitly opens one-time checkout.
2. PayPal SDK and the Stripe server prepare request begin.
3. After the server returns a client secret, `StripeOfferElementsCheckout` renders.
4. Only then does its `stripe={getOfferStripePromise()}` call start/reuse Stripe.js.
5. Stripe Elements/Apple Pay becomes ready after the additional client phase.

### After

1. Customer explicitly opens one-time checkout, a new app-owned attempt is created, and `PersonalPlanOneTimeCheckout` mounts with that `attemptId`.
2. Its new warm effect starts Stripe.js using the same `canStartPayment` and `stripeCheckoutMounted` predicates already used by the checkout.
3. The existing Stripe prepare effect runs immediately after it, so client loading and server preparation overlap; PayPal SDK behavior remains unchanged.
4. The server returns its client secret in the same way and with the same state/ownership semantics.
5. `StripeOfferElementsCheckout` mounts with the same `getOfferStripePromise()` singleton, now already resolved or in flight.
6. Stripe Elements/Apple Pay continues its normal provider readiness checks.

Hard invariants:

- no new loader call in parent render-time code, page mount, pricing visibility, hover, scroll, or prefetch paths;
- no loader start before `openCheckout` accepts a new explicit attempt and mounts `PersonalPlanOneTimeCheckout` with `checkoutAttemptId`;
- current production has no separate client-side consent checkbox: the existing server `prepare` already begins at this explicit CTA/open boundary and creates/reuses the one-time consent record. The client loader moves to that same boundary, never earlier. If a separate consent gate is reintroduced, pause and re-review placement;
- hidden same-attempt resume keeps the child mounted and does not rerun the warm effect unless an existing eligibility predicate actually changes; the existing child loader call remains authoritative for later retry;
- disabled Stripe Elements, a missing publishable key, or missing `leadId`/`funnelSessionId` does not start the loader;
- loader failure does not change checkout state/response, claim a provider, or block PayPal;
- all PR #337 unavailable/provider-lock/Back/down-swipe/recovery behavior remains unchanged.

## Target map

- `src/components/checkout/personal-plan-one-time-checkout.tsx`
  - import and call the existing `warmOfferStripe()` helper in a guarded effect immediately before the existing prepare effect;
  - use the already-computed `canStartPayment` and `stripeCheckoutMounted` predicates exactly; do not duplicate their underlying inputs;
  - preserve `stripe={getOfferStripePromise()}` in the prepared child so it reuses or retries the singleton;
  - make no parent, server, provider-state, copy, or layout change.
- `tests/personal-plan-one-time-checkout.test.tsx`
  - isolate the warm effect through its own dependency-list boundary rather than slicing through the following prepare effect;
  - assert the exact guard-before-warm sequence, assert the warm call textually precedes the prepare call, and use an in-memory unguarded mutation probe so the contract cannot pass on guard text from another effect;
  - preserve the child `stripe={getOfferStripePromise()}`, no-prewarm, stable PayPal slot, provider ownership, unavailable, and recovery contracts.
- `tests/personal-plan-offer-motion.spec.ts`
  - add a small `blockStripeSdk(page)` route helper and call it only in the server-failure pristine-dismissal test, existing-access 409 test, and terminal PayPal recovery test, which would otherwise gain a new live-CDN dependency despite never reaching prepared Stripe today;
  - use one Stripe SDK script predicate that accepts the mutable release train or `/v3/` plus an optional query string; ignore Stripe's additional fraud-signal iframe requests and do not pin `/dahlia/`;
  - add the SDK-script counter to the dedicated no-provider-before-open test and retain its 500 ms settle window;
  - while its Stripe prepare route is deliberately held pending, assert zero matching script requests before the CTA and exactly one after the click and before `releaseStripePreparation()`; this test intentionally chooses PayPal, so the later Stripe response remains stale/provider-locked and it must preserve its existing PayPal recovery assertions rather than claim prepared-child coverage;
  - fulfill the held-prepare test's matching SDK script locally because that test proves request order, not real CDN execution;
  - add a separate failure/retry case that aborts the first matching warm request, allows the authoritative child call to load the real SDK on its second request, keeps PayPal visible, and reaches the card control without a second checkout attempt;
  - preserve real prepared-child/Elements coverage in the independent `one-time card selection is single-flight and keeps PayPal available before claim` test, which must remain unblocked, plus all existing card, PayPal, and overlay assertions.
- `tests/offer-client-loader.test.ts`, `tests/acquisition-funnel-tracking.test.ts`, and `tests/result-offer-pricing-cold-checkout.spec.ts`
  - remain unchanged; they retain singleton/retry, separate dead-support warm, and synthetic-fixture contracts respectively. The cold-checkout fixture's old one-time consent assertion is stale relative to production and must not be edited or treated as evidence in this task.
- `.gitignore`
  - retain the narrow exception that tracks the reviewed PNG timing storyboard; no broader image-ignore policy changes.
- `plans/mockups/2026-08-07-checkout-readiness-before-after.html` and `.png`
  - timing storyboard only: current sequential vs proposed overlapped work with identical UI states.

## Designed user journey

### Entry

1. The result/offer page performs no new Stripe loader work from this change.
2. The customer presses `Haarplan für €29,99 freischalten`.
3. The same checkout sheet opens with the same copy, provider order, controls, and focus behavior.

### Loading

1. Stripe.js begins loading at explicit open while the existing server prepare request is still in flight.
2. PayPal remains independent and can become usable first.
3. No fake Apple Pay control, readiness claim, success/pending state, or provider ownership appears.
4. When the prepared response arrives, the Stripe child reuses the already-started promise rather than beginning the client bootstrap from zero.

### Failure/recovery

1. If Stripe.js rejects early, the checkout sheet is already open and the loader cache resets so the later child may retry through the same loader contract.
2. On a persistent Stripe CDN failure, the warm attempt can fail before prepare completes and the authoritative child can make one later retry; this can delay the Stripe error compared with today. The failure test must prove that PayPal remains visible/usable during that retry and that no third payment attempt or checkout state is created.
3. PayPal remains otherwise independent; any measurable PayPal readiness regression vetoes the optimization.
4. Stripe server timeout, unavailable, provider-locked, retry, Back/down-swipe, and same-attempt resume paths retain the same app-owned attempt and credentials.

### Completion

Provider selection, claim/binding, capture, duplicate-account handling, activation, `/welcome`, and access remain unchanged.

User-journey sign-off: **confirmed by Nick on 2026-08-07**.

## Planning evidence

- `plans/mockups/2026-08-07-checkout-readiness-before-after.html`
- `plans/mockups/2026-08-07-checkout-readiness-before-after.png`

The storyboard shows the same checkout surface and exact provider sequence. Only the start time of Stripe.js client loading changes.

Evidence-review status: **confirmed by Nick on 2026-08-07**.

## Ordered tasks

### 1. Add red source contracts

- In `tests/personal-plan-one-time-checkout.test.tsx`, isolate the exact warm effect through its dependency-list boundary.
- Assert that `warmOfferStripe()` is guarded by `canStartPayment` and `stripeCheckoutMounted`, occurs before `void fetchClientSecret()`, and that an in-memory unguarded mutation fails the contract.
- Retain the separate `GuidedStorySupport`, loader singleton/retry, and synthetic cold-fixture tests unchanged; removing dead support code is out of scope.
- Keep loader singleton/retry tests and every payment safety test green.

### 2. Add the one guarded call

- Import the existing `warmOfferStripe()` helper and add the guarded effect immediately before the existing prepare effect in `PersonalPlanOneTimeCheckout`.
- Reuse `canStartPayment` and `stripeCheckoutMounted`; do not add a second guard definition or change `PersonalPlanOneTimePricing`.
- Make no server, provider-state, UI, or analytics change.

### 3. Verify structural overlap and user flow

Start the worktree server and copy the exact `http://localhost:PORT` value it prints:

```bash
npm run dev:worktree
```

In a second terminal, use that printed port literally. Do not rerun `--print-port` after the server has started because it will return the next free port. Run the existing real-offer browser suite for UI and recovery regressions:

```bash
PLAYWRIGHT_BASE_URL="http://localhost:<printed-port>" \
  npx playwright test tests/personal-plan-offer-motion.spec.ts \
  --project=chromium
```

Do not use the synthetic `payment-cold-checkout` or `payment-overlay` fixtures as evidence for this change: they do not mount `PersonalPlanOneTimePricing` or call the production loader. The source/unit contracts prove placement and failure isolation; the following cold preview trace against the actual component proves the network overlap.

The new child-mount warm call makes previously server-failed one-time lab cases eligible to request Stripe.js. Keep those three named failure/recovery cases deterministic with the scoped `blockStripeSdk(page)` helper. Do not put the abort route in `openPersonalPlanLab`: the prepared and card cases must retain their current real Stripe.js coverage. In the held-prepare PayPal uncertainty test, the request counter is the automated overlap proof and must pass before the prepare promise is released.

Run focused and full repository gates:

```bash
node --import ./tests/server-only-register.cjs --import tsx --test \
  tests/acquisition-funnel-tracking.test.ts \
  tests/offer-client-loader.test.ts \
  tests/personal-plan-one-time-checkout.test.tsx
npm run test:node
npm run ci:verify
```

Cold-browser actual-component proof on preview, independent of the source-contract tests:

- fresh browser context and disabled cache;
- confirm no `js.stripe.com` request attributable to this change before checkout open;
- click the real one-time checkout CTA;
- record that the Stripe.js request begins after the click and before `/api/stripe/create-checkout-session` returns;
- record the cold Stripe.js request duration and derive the addressable client-load share before setting the final performance threshold;
- confirm the later child uses the single cached loader promise and no duplicate Stripe.js script request appears;
- inspect desktop and 390×844, PayPal-first-ready, Stripe failure, retry, Back/down-swipe, and eligible Safari Apple Pay.

### 4. Review, release, and keep/revert decision

- Run `npm run ci:verify`, then the repo skills `.agents/skills/ready-check/SKILL.md` and `.agents/skills/request-code-review/SKILL.md`. The Claude lane must invoke `codex:codex-rescue` read-only on `git diff origin/main...HEAD` exactly as required by `CLAUDE.md`; the Codex orchestrator separately runs the read-only Claude whole-branch review before push.
- Publish only after explicit authorization.
- Reconcile PostHog, Sentry, Vercel, provider, purchase/access/account/fulfillment state after the next authorized walkthrough.

Before release, collect a matched pre-period with at least 10 comparable one-time opens for both the Stripe primary metric and PayPal guardrail and complete the explicit post-#337 health gate above. Release is blocked until both exist. Use existing `offer_checkout_lifecycle` events:

- select Stripe `provider_ready` events with `commerce_kind='one_time'`, `provider='stripe'`, and `option='card_and_more'` for the primary metric so Apple Pay/browser mix cannot change the ready population;
- report eligible `option='apple_pay'` attempts as a separate secondary, non-gating series;
- select Stripe `prepared_response_received` events separately without an `option` filter because that transition carries no option;
- join the two event legs by `checkout_attempt_id` and `open_index`, then compare `provider_ready.elapsed_ms - prepared_response_received.elapsed_ms` and total `provider_ready.elapsed_ms`;
- separately filter `provider='paypal'` and compare total `provider_ready.elapsed_ms` plus `provider_load_timeout`/`provider_load_error` rates;
- exclude backgrounded/not-visible attempts consistently from both periods, or report them separately;
- report sample size, p50, p95, missing responses/timeouts, and provider-load failures for matched pre/post windows.

Keep rules:

- structural network overlap is proven;
- no correctness, provider-load error, or provider-load timeout regression for either provider;
- after at least 10 comparable post-change `card_and_more` samples, Stripe response-to-ready p50 meets the derived improvement threshold provisionally; confirm at 20 samples or day 14, whichever comes first;
- after at least 10 comparable post-change PayPal samples, PayPal provider-ready p50 is no worse than both 200 ms and 10% above the matched pre-period, and its load error/timeout rate does not increase by more than two percentage points; confirm at 20 samples or day 14;
- otherwise revert as unnecessary or harmful bandwidth/work.

The Stripe improvement threshold is the smaller of 20% of the matched pre-period response-to-ready p50 or 50% of the cold-trace Stripe.js request duration. This keeps the required gain within the measured addressable client-load budget while still rejecting noise.

Business-outcome kill condition uses the actual server-side one-time sources, not the client/PostHog `purchase_completed` event (which is not emitted for `personal_plan_once`):

- numerator A: canonical `funnel_events` rows with `event_name='purchase_completed'`, emitted by the real server path `deliverBillingAnalyticsToFunnel` → `recordFunnelPurchaseFromSession`;
- numerator B/source of truth: `billing_one_time_purchases` rows with `product_kind='personal_plan_once'` and `status='paid'`, reconciled to active paid access and the one-time activation outbox record;
- denominator: unique eligible one-time `offer_checkout_opened` events for the same matched time window, reported separately if analytics delivery is incomplete.

Thresholds:

- at 1 hour, 24 hours, and daily through day 7, report unique eligible one-time checkout opens, completed one-time purchases, and paid-access rows for matched pre/post windows;
- treat zero purchases or a large conversion-rate drop in these small samples as an escalation signal requiring provider/Supabase reconciliation and a fresh walkthrough, not an automatic revert; the sample is too small for a reliable conversion threshold;
- hard revert only when that escalation reproduces a checkout-open/payment failure, provider/load guardrail breach, or paid-payment-without-access inconsistency introduced after deployment;
- the release owner (the Codex shipping task) records the 1-hour and 24-hour checks and one day-7 check; if 20 samples are still unavailable, continue to day 14 for the final performance read instead of reverting solely for low traffic.

Any new reproducible checkout-open failure, material provider guardrail breach, or paid-payment/access inconsistency triggers revert-and-redeploy of this isolated commit. No runtime flag or new tracking event is added.

## Regression matrix

| Surface                               | Required proof                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| No pre-open loader start              | One-time source contract + cold network trace                                         |
| Explicit-open single loader start     | Source contract + held-prepare Playwright request-order assertion + manual cold trace |
| Singleton reuse/rejection retry       | Loader unit tests + first-request-abort/authoritative-child-retry Playwright case     |
| No Session/Order prewarm              | Existing no-prewarm route/component tests                                             |
| Stable PayPal / ownership / recovery  | Existing Node suites + PayPal production guardrail                                    |
| Actual readiness improvement          | Existing lifecycle event deltas                                                       |
| Wallet eligibility                    | Eligible Safari/device only                                                           |
| Production correctness and conversion | PostHog/Sentry/provider/Supabase reconciliation with numeric kill conditions          |

No paid production probe is required merely to increase performance samples.

## Claude review ledger

The 2026-08-07 read-only Opus/high reviews confirmed the production sequencing gap and minimal optimization. Revisions removed the invalid synthetic-fixture proof; moved warming into a child-mount effect beside the prepare effect; reused the child's existing eligibility predicates and existing `warmOfferStripe()` helper; added exact non-empty source anchors and a held-prepare Playwright script-order assertion; scoped CDN blocking only to tests that would otherwise gain a new dependency; retained real Elements coverage; joined the unoptioned prepare leg to the optioned ready leg correctly; corrected the improvement formula to the addressable bound; added PayPal guardrails; and based business monitoring on the real server funnel path and Supabase sources without a noisy automatic conversion threshold. The final code review then caught a vacuous guard assertion; it was replaced with an effect-bounded, mutation-checked contract. The same pass required an automated warm-failure/child-retry proof and surfaced the earlier Stripe fraud-signal bootstrap as an explicit pre-publication owner tradeoff.

Final Claude verdict: **production change sound and minimal; test revisions required**. Codex verified the findings locally and incorporated the guard-test and browser-proof revisions. No engineering blocker remains after those tests pass. The Stripe fraud-signal timing/scope tradeoff remains an explicit owner decision before publication.

## Approval state

- Timing storyboard reviewed by Nick: **yes**.
- Designed journey confirmed by Nick: **yes**.
- Claude final plan review reconciled: **yes**.
- Implementation authorized: **yes, local verified branch only**.
- Earlier Stripe fraud-signal bootstrap accepted for publication: **pending explicit owner decision**.

Implementation may proceed through local verification and review. Commit/push remain blocked on the fraud-signal tradeoff decision; deployment, production writes, and cleanup remain separately gated.
