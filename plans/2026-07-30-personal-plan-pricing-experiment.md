# Personal-plan pricing experiment

**Status:** Approved for implementation
**Worktree:** `.worktrees/personal-plan-pricing-experiment`
**Branch:** `codex/personal-plan-pricing-experiment`
**Implementation base:** current `origin/main` at `7445a465`
**Implementation authorization:** confirmed by Nick on 2026-07-31; stop before provider-console changes, deployment, real charges, public flag enablement, commit, push, PR, or merge unless separately authorized.

## Outcome and source context

Run a controlled offer test only at the end of the new, longer personal-plan quiz:

- Variant A keeps the current updated offer page and its three membership plans.
- Variant B uses the same updated offer page, but its pricing section contains only one personal plan for a one-time payment of **€29.99**.
- A visitor sees one variant, never a combined membership-plus-one-time selector.
- During this initial demand test, either purchase grants the same existing application access. Product differentiation is deferred until sales justify it.

The obsolete combined mockup and dirty implementation worktree remain untouched only as a code reference. Their mixed presentation, Boolean flag plumbing, and “Oder” separator are not implementation inputs.

Source artifacts:

- Reviewed earlier combined-layout feedback and clarified scope from this task
- Exclusive-variant mockup:
  [`plans/mockups/2026-07-30-personal-plan-pricing-experiment.html`](mockups/2026-07-30-personal-plan-pricing-experiment.html)
- Reusable commerce reference worktree:
  `.worktrees/one-time-offer-plan` at stale base `72c71d75`

## Chosen direction

Use one shared personal-plan offer page with a server-resolved pricing mode:

- base/fallback identity: `personal-plan-v1`
- experiment membership arm: `personal-plan-membership-v1`
- experiment one-time arm: `personal-plan-one-time-v1`
- internal pricing mode: `"membership" | "one_time"`
- experiment flag: `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED`, strict default off
- internal production-QA flag: `PERSONAL_PLAN_ONE_TIME_QA_ENABLED`, strict default off

Keep `meta_personal_plan_v1` and `personal-plan-v1` in the generic funnel package registry. Do not create duplicate URLs or duplicate full-page components. The result route resolves and persists the arm before recording `offer_viewed`; the shared offer component changes only its pricing section.

Deploy the implementation dark before public assignment. With the experiment flag off, ordinary visitors continue to receive the current membership offer. A short-lived, server-signed QA token bound to one exact personal-plan lead may select the one-time arm only while the separate QA flag is enabled. An unlinked or `noindex` URL alone is not an access boundary.

The legacy guided-story offer experiment stays independent and unchanged:

- `guided-story-locked`
- `guided-story-founder-letter`
- `guided-story-potential`

Its routes, resolver, flag, attribution, tests, and live traffic are regression gates, not edit targets.

Settled implementation tradeoffs:

- Support both Stripe and PayPal in both arms so payment-method availability does not confound the pricing-model test.
- Port the already-built full refund/reversal/dispute revocation for both providers; do not replace it with a manual-only workflow.
- Do not promise a new voluntary 14-day guarantee for the one-time plan. Confirm the statutory withdrawal and immediate-performance consent flow before launch.
- Keep a separate personal-plan resolver rather than extracting a shared experiment abstraction during this test; isolation lowers regression risk to the live legacy experiment.

## Scope and non-goals

### In scope

- Sticky, server-assigned 50/50 experiment for personal-plan sessions that have not viewed the offer
- Membership-only and one-time-only pricing sections in the shared updated offer
- €29.99 one-time Stripe Checkout payment flow
- €29.99 PayPal Orders v2 create/capture flow
- Durable one-time purchase record and access entitlement
- Completion/recovery after redirect, login, webhook, or experiment flag changes
- Full refund, reversal, and dispute revocation
- Variant-aware analytics and experiment reporting
- Provider validation/runbook, legal copy, and automated/browser coverage

### Non-goals

- No edits to the old quiz or its three-arm founder-letter/percentage/locked experiment
- No combined page that shows one-time and membership together
- No different in-product package behavior yet
- No PayPal subscription Product or Plan for the one-time purchase
- No generic commerce framework or broad offer-registry refactor
- No permanent public preview route, guessable query switch, or browser-trusted one-time override
- No provider resource creation, flag enablement, deployment, production write, commit, push, PR, or merge in this phase
- No destructive cleanup of the old dirty worktree or user-owned mockups

## Target map

### Experiment assignment

- Add `src/lib/funnel/personal-plan-pricing-experiment.ts`
  - finite arm family, deterministic 50/50 assignment, pricing-mode mapping
- Extend `src/lib/funnel/server.ts`
  - add an isolated personal-plan resolver
  - validate the lead-bound internal QA token before any one-time override
  - atomically mark accepted QA sessions as internal test traffic
  - do not change `resolveGuidedStoryOfferExperiment`
- Extend `src/lib/funnel/flags.ts`
  - add the strict default-off experiment and production-QA flags
- Add a narrow server-only QA-token helper and operator script
  - HMAC-sign the purpose, lead ID, one-time arm, and expiry using a server-only secret
  - accept the token only once its lead/session/package constraints are verified
  - after validation, redirect to the clean result URL so the token does not remain in browser history or referrers
  - do not add a browser endpoint that issues tokens
- Update `src/app/result/[leadId]/page.tsx`
  - resolve the personal-plan arm before `recordLeadOfferView`
  - keep the legacy guided-story branch unchanged
- Update `src/app/result/[leadId]/result-client.tsx`
  - pass the resolved arm to the shared personal-plan offer
- Update `src/lib/analytics/offer-section-order.ts`
  - give all personal-plan identities the same section ordering
- Keep `src/funnels/packages.json` unchanged

### Exclusive offer UI

- Update `src/components/personal-plan-offer/personal-plan-offer.tsx`
  - accept the resolved `offerVariant`
  - map only the one-time arm to one-time pricing
  - pass the resolved arm to `OfferTrackingProvider`
- Update `src/components/quiz/result-offer-pricing.tsx`
  - accept exclusive `pricingMode`
  - membership mode renders the current three plans
  - one-time mode renders only the approved €29.99 card and CTA
- Add or adapt a narrow one-time pricing component under `src/components/checkout/`
- Adapt `payment-method-checkout.tsx` and `stripe-offer-elements-checkout.tsx`
  - preserve current Apple Pay/prewarm behavior from latest `main`
  - branch only the provider request and legally required purchase copy
- Do not port the old `oneTimeOfferEnabled` or `personalPlanOneTimeOfferEnabled` props.

### One-time commerce and entitlement

Selectively port and re-review from `.worktrees/one-time-offer-plan`:

- `src/lib/billing/offer-products.ts`
- one-time types in `src/lib/billing/types.ts`
- `src/lib/billing/purchases.ts`
- `supabase/migrations/20260730140000_billing_one_time_purchases.sql`
- one-time access additions in `src/lib/billing/subscriptions.ts`
- Stripe:
  - `src/lib/stripe/checkout-session-params.ts`
  - `src/lib/stripe/checkout-activation.ts`
  - one-time webhook branches and create-session request contract
- PayPal Orders:
  - `src/lib/paypal/order-intents.ts`
  - `src/lib/paypal/order-activation.ts`
  - create-order and capture-order routes
  - one-time PayPal button
- completion/recovery changes in auth and welcome routes
- neutral duplicate-access dialog copy

Do not copy entire overlapping files from the stale worktree. Reapply focused changes onto latest `main`, especially around the recently updated pricing order and Apple Pay prewarm lifecycle.

### Analytics, legal, and operations

- Adapt analytics types to support `interval: "one_time"` without pretending it is a subscription interval.
- Emit exclusive `availableIntervals`:
  - membership: `month`, `quarter`, `year`
  - one-time: `one_time`
- Keep the arm persisted once on `funnel_sessions.offer_variant`.
- Add an explicit `is_internal_test` session marker, set only after successful server-side QA-token validation. Exclude these sessions from experiment allocation, dashboards, conversion, and revenue reporting.
- Attribute client funnel milestones by joining their `funnel_session_id` to that session; do not add or assume an `offer_variant` column on every `funnel_events` row.
- Carry the same session/arm context into checkout and purchase activation. Attribute post-purchase success, failure, refund, reversal, and dispute through the existing billing analytics/outbox path, which is separate from funnel milestones.
- Update `scripts/analytics/personal-plan-offer-dashboard.ts` to compare only the two treatment arms. Keep historical base sessions outside the experiment denominator.
- Update AGB §§4, 5, and 9 plus the payment-processor wording in Datenschutz.
- Add/adapt:
  - `scripts/stripe/validate-personal-plan-once-price.ts`
  - `docs/personal-plan-one-time-provider-setup.md`
  - PayPal webhook provisioning for Orders v2 payment events

### Legal implementation baseline

This is an implementation constraint, not final legal advice. German counsel must approve the final classification, checkout copy, AGB, Widerrufsbelehrung, and confirmation email before launch.

- Default: a consumer distance contract has a 14-day statutory withdrawal right under [BGB §312g](https://www.gesetze-im-internet.de/bgb/__312g.html) and [§355](https://www.gesetze-im-internet.de/bgb/__355.html).
- Do not rely on personalization alone. The personalized-goods exception in §312g(2) no. 1 is not a safe basis for a digitally generated plan.
- Operationally treat the paid deliverable as a one-off service. The closely analogous CJEU judgment [C-641/19 PE Digital](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A62019CJ0641) held that a personalized report generated from a questionnaire was not digital content for the special withdrawal exception.
- For a paid service, [BGB §356(5) no. 2](https://www.gesetze-im-internet.de/bgb/__356.html) requires, before performance begins:
  - express request/consent to start during the withdrawal period;
  - acknowledgment that the right expires upon full performance;
  - actual full performance before treating the right as expired.
- Also satisfy the digital-content fallback in §356(6) no. 2: express consent, acknowledgment of loss when provision begins, and the required contract confirmation.
- Obtain consent through a required, unchecked control separate from AGB/privacy. A preselected box or an AGB clause is insufficient; one clear statement may combine the request and acknowledgment.
- Give the consumer a durable-medium contract confirmation under [BGB §312f](https://www.gesetze-im-internet.de/bgb/__312f.html) containing the exact consent text before generation/delivery begins.
- Keep the payment action compliant with [BGB §312j](https://www.gesetze-im-internet.de/bgb/__312j.html), including “Zahlungspflichtig bestellen” or equally unambiguous wording.
- Withdrawal-right expiry does not remove statutory defect/nonconformity rights or prevent Stripe, PayPal, and card-network disputes.

## Designed user journey

### Entry and assignment

1. A visitor completes the new longer personal-plan quiz and reaches `/result/<leadId>`.
2. The server recognizes `quiz_kind = "personal_plan"`.
3. If the experiment is enabled and the session is an eligible, unviewed `personal-plan-v1` session, the server deterministically assigns and atomically persists one of the two treatment arms.
4. The server resolves the final stored arm before it records `offer_viewed`.
5. Reloads and return visits keep the same arm.

Already-viewed `personal-plan-v1` sessions remain on the membership fallback and are not retroactively enrolled. Missing sessions, persistence failures, foreign packages, or unexpected variants also render the membership fallback and do not enter the experiment denominator.

### Variant A — membership

1. The visitor sees the existing updated personal-plan offer page.
2. The pricing section shows the current monthly, quarterly, and annual plans.
3. A short sentence explains: “Mit der Mitgliedschaft erhältst du fortlaufende Unterstützung und Anpassungen deines Plans.”
4. The visitor selects a plan and opens the current payment overlay.
5. Stripe or PayPal creates a recurring subscription through the unchanged existing flow.
6. On successful activation, the visitor receives the current application access.

### Variant B — one time

1. The visitor sees the identical updated personal-plan offer page.
2. The pricing section shows only:
   - “Einmalige Erstellung”
   - “Persönlicher Haarplan”
   - “Auf dein Haar, deine Ziele und Bedürfnisse abgestimmt”
   - “Komplette Routine mit passenden Produkten”
   - “Analyse deiner aktuellen Pflege”
   - “€29,99”
   - CTA “Haarplan für €29,99 freischalten”
3. There are no membership plans, no “Oder”, no membership-support disclaimer, and no newly invented 14-day guarantee promise.
4. The visitor opens the same payment overlay.
5. The overlay uses purchase language:
   - “Zahlungspflichtig bestellen — €29,99”
   - “Einmalige Erstellung eines persönlichen Haarplans für €29,99. Kein Abonnement.”
6. Before any Apple Pay, PayPal, or card action is enabled, the visitor must actively check the immediate-performance request and withdrawal acknowledgment. The control is unchecked and separate from AGB/privacy.
   - “Ich verlange ausdrücklich die sofortige Erstellung meines Haarplans. Mir ist bekannt, dass mein Widerrufsrecht nach vollständiger Erstellung und Bereitstellung erlischt.”
7. Stripe uses Checkout `mode=payment`; PayPal uses Orders v2 create/capture. Neither creates a subscription.
8. After trusted provider confirmation, the application stores the consent evidence and provides the contract confirmation on a durable medium.
9. Only then does plan generation/delivery begin. Completion and first access are recorded as delivery evidence.
10. The application records a paid one-time purchase and grants the same current application access.

### Error and recovery behavior

- New one-time initiation is allowed only when the server verifies the personal-plan lead/session belongs to `personal-plan-one-time-v1`; the browser cannot unlock it by sending `purchaseKind`.
- A duplicate active membership or paid one-time entitlement shows neutral “Aktiver Zugang” copy and prevents another checkout.
- If the experiment flag is disabled after checkout starts, a valid existing Stripe Session or PayPal Order can still complete and recover. The kill switch stops new initiation only.
- Provider errors keep the visitor on the offer/overlay with the existing retry behavior and no entitlement.
- Provider initiation rejects a missing, unchecked, stale, or differently worded consent record server-side; a browser Boolean alone is not trusted.
- If durable-medium contract confirmation cannot be provided, do not start generation or reveal the plan.
- A repeated webhook, callback, reload, or capture request is idempotent.
- Full refund, reversal, or dispute changes the purchase to non-entitling and removes one-time access. This existing reference implementation is retained for Stripe and PayPal rather than replaced with a manual-only path.
- Partial refunds are not an offered self-service path in this test. If one occurs at provider level, keep access, record the refunded amount/event, and flag it for manual review; only a full refund removes access.
- The initial low-volume test accepts the residual race where two simultaneous cross-provider checkouts in separate tabs could both charge before the unique paid-entitlement constraint rejects the second record. The runbook must describe manual reconciliation/refund; do not build a generalized reservation system yet.

### Completion

The visitor lands in the same authenticated personal-plan experience as a membership buyer. During this test, the background package is intentionally identical; the billing record and management semantics remain truthful and distinct.

### Production dark launch

1. Merge and deploy with both `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=false` and `PERSONAL_PLAN_ONE_TIME_QA_ENABLED=false`.
2. Create and validate the live Stripe Price plus the required production PayPal webhook events. Configure the production environment and redeploy if the environment change requires it.
3. Explicitly enable only the QA flag. Public experiment assignment remains disabled.
4. An operator completes the real personal-plan quiz with a fresh, non-entitled QA identity and generates a short-lived signed URL for that exact `/result/<leadId>`.
5. The server validates the signature, purpose, expiry, lead, session, package, and current offer state, persists the QA assignment, then redirects to the clean result URL. A missing, expired, malformed, or foreign-lead token falls back to the membership offer.
6. A valid token persists the one-time arm and `is_internal_test=true` before `offer_viewed`. The normal one-time checkout authorization and provider callbacks then run unchanged.
7. Run deliberate live Stripe and PayPal purchases. These are real charges in provider live mode; use controlled payment methods and reconcile/refund them according to the runbook.
8. Confirm provider events, consent evidence, confirmation delivery, entitlement, refund/reversal behavior, and analytics exclusion. Confirm there are no non-internal one-time sessions or purchases, then disable the QA flag.
9. Only after that production acceptance passes, separately enable `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED=true`. New eligible visitors are assigned 50/50 on the existing result route; no new public URL is exposed.

Disabling either flag stops new assignment/initiation only. A checkout already created under a valid persisted arm must still complete, recover, or be refunded safely.

No Stripe test-mode or PayPal sandbox checkout is part of this rollout. Unit, contract, route, webhook-fixture, and browser tests still run before merge, but the first provider-to-provider payment acceptance is deliberately performed with controlled real transactions in production. The residual risk is that a live-provider configuration defect will first appear during internal production QA; the public assignment gate and signed lead-bound QA access contain the audience, not the transaction risk.

## Mockup evidence

- Artifact:
  [`plans/mockups/2026-07-30-personal-plan-pricing-experiment.html`](mockups/2026-07-30-personal-plan-pricing-experiment.html)
- Direction shown: one shared page with review-only variant/device toggles; each real visitor sees exactly one pricing section.
- Incorporated feedback:
  - one-time is not more prominent than membership
  - no combined selector and no “Oder”
  - one-time means one plan creation, not perpetual Chaarlie access language
  - the one-time card explains the deliverable instead of repeating “Einmalige Erstellung”: personalization around hair/goals/needs, a complete routine, product selection, and analysis of current care
  - the deliverable is presented as three compact included rows rather than one compressed sentence
  - the shared header navigation uses the neutral singular-compatible label “Angebot ansehen”
  - the mobile one-time CTA stays on one line
  - the two required consent statements are visually separated with more readable line-height
  - €29.99 experiment price
  - membership-only support/adjustment sentence
  - existing accent/CTA colors reused
  - no voluntary 14-day one-time guarantee is promised before legal validation of the digital-plan withdrawal flow
  - one-time payment actions remain disabled until the user actively accepts the immediate-performance/withdrawal acknowledgment
  - the withdrawal acknowledgment is shortened while retaining the explicit early-start request and loss-on-complete-performance statement
- Browser-checked:
  - membership view exposes only three recurring plans
  - one-time view exposes only the €29.99 one-time plan
  - desktop and mobile checkout layouts render the shortened consent copy
  - Apple Pay, PayPal, and card remain disabled until the checkbox is selected
- Mockup review status: **confirmed by Nick on 2026-07-31**
- Designed-journey sign-off: **confirmed by Nick on 2026-07-31**

## Ordered tasks

### 1. Lock experiment behavior with tests

- Add unit tests for deterministic two-arm allocation, strict flag parsing, finite arm mapping, and base fallback.
- Add QA-gate tests for exact lead binding, expiry, tampering, foreign package/session, clean-URL redirect, strict flag-off fallback, and internal-test marking.
- Add resolver tests for:
  - eligible assignment and CAS persistence
  - concurrent-winner readback
  - missing-session/write-failure fallback
  - viewed base preservation
  - treatment stickiness after flag-off
  - unviewed treatment rollback
  - rollback race/failure
  - foreign package/variant no-op
- Add route-order coverage proving resolution happens before `offer_viewed`.
- Add a section-order test proving the base identity and both experiment identities all use `PERSONAL_PLAN_SECTION_ORDER`.
- Run existing guided-story experiment tests unchanged.

Completion criterion: the new experiment is isolated, sticky, rollback-safe, and the old three-arm experiment has no behavior change.

### 2. Add the one-time purchase data contract

- Apply the purchases/order-intents migration with service-only access and uniqueness/index constraints.
- Before applying or merging, confirm no migration at or after the proposed `20260730140000` timestamp has landed on `main`; renumber if necessary.
- Add the server-owned `personal_plan_once` product definition at €29.99 EUR.
- Add typed purchase CRUD and access checks; only `paid` entitles.
- Verify the central gates `hasCurrentAppAccess`, `assertCanStartCheckout`, and `assertCanStartCheckoutForEmail`; add focused regression coverage for both directions: membership owner attempting one-time checkout and one-time buyer attempting membership checkout.

Completion criterion: database and application tests prove a paid one-time purchase grants access, while pending/refunded/reversed/disputed rows do not.

### 3. Implement Stripe payment mode

- Extend the create-session contract with a discriminated one-time purchase request.
- Authorize the request against the persisted one-time experiment arm. Make this an explicit acceptance check: never port the reference route's browser-trusted `purchaseKind` behavior.
- Create Checkout in `payment` mode using only the configured Stripe Price.
- On activation validate:
  - session mode/status/payment status
  - amount `2999`
  - currency `eur`
  - line-item Price ID
  - product-kind metadata
  - stable Checkout Session, PaymentIntent, and Charge references
- Make redirect, auth recovery, webhook activation, and repeated delivery idempotent.
- Map full refunds and disputes back to the purchase.
- Reconcile latest-main Apple Pay prewarm explicitly: for the one-time arm it must prepare a valid `mode=payment` flow and must not create or leak subscription-shaped state.

Completion criterion: focused Stripe tests reject wrong mode, amount, currency, Price, unpaid sessions, replay conflicts, and forged browser input; valid sessions grant one access exactly once.

### 4. Implement PayPal Orders v2

- Authorize order creation against the persisted one-time experiment arm.
- Create a server-owned €29.99 EUR purchase unit; do not create a Billing Product/Plan.
- Capture and validate order/payee/amount/currency/status before granting access.
- Persist order and capture references and make capture/webhook/auth recovery idempotent.
- Subscribe to and handle Orders/Payments v2 capture completed, refunded, reversed, and relevant dispute events.

Completion criterion: PayPal contract and webhook tests prove valid capture and recovery, reject tampering, and revoke access on full refund/reversal/dispute.

### 5. Render the exclusive pricing modes

- Pass the resolved variant through the result route/client to `PersonalPlanOffer`.
- Map the one-time arm to `pricingMode="one_time"`; every other identity safely maps to membership.
- Implement the reviewed one-time-only pricing block and purchase-language checkout.
- Preserve latest membership order, CTA tokens, Apple Pay prewarm, PayPal/card availability, and responsive behavior.
- Remove all obsolete combined flag/prop/“Oder” paths from the ported code.

Completion criterion: component tests and desktop/mobile browser checks match the approved mockup and never render both commercial models together.

### 6. Complete attribution, legal, and runbook work

- Attribute funnel milestones through the immutable session join and post-purchase/refund events through billing analytics/outbox; do not conflate those two event systems.
- Exclude fallback base sessions from treatment comparison.
- Add conversion and revenue-per-valid-offer-view reporting.
- Exclude `is_internal_test=true` sessions and their linked purchases from all experiment denominators and revenue metrics.
- Apply counsel-approved one-time checkout, AGB, withdrawal, and privacy wording.
- Add a versioned, server-validated immediate-performance consent record bound to the lead/user/order and exact displayed text.
- Send the durable-medium confirmation before plan generation/delivery; record confirmation provider ID/status/time.
- Record plan generation start/completion, content/version hash, delivery, and first-access evidence. Document privacy basis, retention, and data minimization for IP/user-agent evidence if collected.
- Document flag enable/disable behavior, completion safety, refunds, and cross-provider race reconciliation.
- Add the operator-only signed-link command and document token expiry, rotation, log/referrer exposure precautions, and QA cleanup.
- Add Stripe Price validation and PayPal webhook preflight commands.

Completion criterion: analytics queries group both arms correctly, legal-copy tests pass, and the provider runbook can be followed without guessing.

### 7. Run repository readiness and review gates

- Run formatting, lint, typecheck, focused suites, full tests, and production build.
- Apply the migration to an isolated/local or approved test environment and verify RLS/access behavior.
- Validate provider request/response behavior with local contract tests and recorded webhook fixtures; do not perform sandbox checkout.
- Browser-test both arms on desktop and mobile, including Stripe, PayPal, close/retry, return, login recovery, duplicate access, and flag-off completion.
- Browser-test the production-QA path locally: unsigned/expired/wrong-lead tokens fail closed; a valid token marks internal traffic and reaches only the one-time arm.
- Run `ready-check`.
- Run `request-code-review`, including the mandatory external counterpart whole-branch review.

Completion criterion: the exact branch head has current automated, browser, provider-contract, migration, and review evidence with no unresolved P0/P1 findings. Live provider acceptance remains an explicit post-merge production-QA gate before public assignment.

## Provider setup timing

Do not create provider resources during planning.

### During implementation

- Build and verify the provider contracts with mocks, recorded fixtures, route tests, and webhook tests.
- Do not create a Stripe test-mode Price and do not run a PayPal sandbox checkout.

### After merge and production deployment

- Create or verify the **Stripe live-mode** Product “Chaarlie Persönlicher Haarplan” and one active, non-recurring **€29.99 EUR** Price.
- Store its ID as `STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE` and run the production validator to confirm active, non-recurring, `2999`, and `eur`.
- For PayPal, create **no Product and no Plan**. Verify the production REST app and webhook include the required Orders/Payments v2 capture, refund, reversal, and dispute events.
- Add production environment values through the existing secret-management path and redeploy if required.
- Run the live-resource validators and webhook inventory preflight before exposing the internal QA arm.
- With explicit approval, enable only `PERSONAL_PLAN_ONE_TIME_QA_ENABLED`, generate a short-lived lead-bound link, and run controlled real-money Stripe and PayPal acceptance purchases.
- Verify those sessions and purchases are marked internal and absent from experiment reporting.
- Query production attribution before public launch and require zero non-internal `personal-plan-one-time-v1` sessions or purchases while public assignment is disabled.
- Disable the QA flag after acceptance.
- Enable `PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED` only as a separate, explicit launch action after production acceptance passes.

Nick should be asked to perform or approve the provider-console and real-charge steps only after the implementation is merged and dark-deployed. No live transaction may be initiated without action-time confirmation of the exact provider, amount, and payment method.

## Verification

### Automated

- Experiment unit/resolver/route ordering tests
- Existing `tests/offer-experiment.test.ts` unchanged
- Exclusive offer rendering and analytics tests
- Billing purchase/access/auth/welcome tests
- Stripe session, activation, route, webhook, refund, and dispute tests
- PayPal Orders/capture/webhook/refund/reversal tests
- Legal copy tests
- `npx prettier --check <task-owned files>`
- focused node tests with `npx tsx --test <focused test files>`
- full node suite with `npm run test:node`
- webhook/activation browser-contract specs under the existing `test:playwright:contracts` runner, then `npm run test:playwright:contracts`
- `npm run ci:verify` for typecheck, lint, and production build
- `git diff --check`

### Manual/browser

- Membership arm, desktop and mobile
- One-time arm, desktop and mobile
- No combined option at any viewport
- Correct price and legally required CTA copy
- unchecked consent blocks Apple Pay, PayPal, and card initiation
- checked consent reaches the server with exact versioned text; tampered or missing consent is rejected
- contract confirmation is provided before plan generation/delivery
- delivery/access evidence is retained and linked to the provider transaction
- Stripe card and available wallet paths
- PayPal Orders path
- close, retry, provider failure, redirect return, login recovery
- duplicate entitlement protection
- started checkout completion after flag disable

### Migration/live-state

- local/approved test migration applies cleanly
- one paid entitlement per product/user
- service-only writes and expected read boundaries
- Stripe live Price validator passes before internal production QA
- PayPal production webhook event inventory passes before internal production QA
- no production resource or flag change without explicit approval
- public experiment remains off throughout production QA
- invalid or disabled QA access always falls back to membership and cannot initiate a one-time purchase
- internal QA sessions and purchases are excluded from experiment reporting
- zero non-internal one-time assignments or purchases exist before public enablement

### Evidence-sensitive review

- Verify the statutory digital-plan withdrawal/early-performance consent flow before production enablement. Do not add a voluntary one-time money-back promise without a separate explicit decision.
- Review experiment denominators from raw assigned/viewed/purchased rows before trusting dashboard conversion.

## Review and handoff

- The fresh worktree contains only the new mockup and this plan until visual/journey sign-off.
- The old dirty combined worktree is preserved for selective reference and is not a merge source.
- After sign-off, use the repository `implementation-loop` with bounded worker ownership and main-session integration.
- Serialize shared billing and checkout ownership: data/access foundations first, provider state machines next, exclusive UI/prewarm integration after those seams are stable. Do not assign parallel writers to `billing/types.ts`, `billing/subscriptions.ts`, `payment-method-checkout.tsx`, or `stripe-offer-elements-checkout.tsx`.
- Before push, run the repository readiness checks and one external counterpart whole-branch review.
- Stop before provider live resources, deployment, flag enablement, production migration, commit, push, PR, or merge unless Nick explicitly authorizes the corresponding action.
