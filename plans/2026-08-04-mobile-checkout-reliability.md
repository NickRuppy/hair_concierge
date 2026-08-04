# Mobile checkout reliability

## Outcome and source context

Make the paid-social mobile checkout reliable across Instagram and Facebook in-app browsers: payment controls cannot accidentally dismiss the sheet, browser/system Back cannot throw a completed customer into a fresh quiz, a slow provider leaves the checkout open with a recovery path, and every checkout attempt has a privacy-safe lifecycle that can be distinguished from a real payment attempt.

This plan consolidates four production investigations from 3 August 2026:

- `019fc799-b8de-740c-a232-52da0498d267` — confirmed payment-control drag dismissal on iPhone/Instagram; reproduced at the 80/81 px boundary and 5/5 at 100 px;
- `019fc796-8870-70d5-9f1d-eb682099fa5a` — separate iPhone/Instagram silent return with the same no-selection/no-provider-attempt signature, consistent with the confirmed drag defect;
- `019fc78a-ed89-701e-8713-2ca3fdcc7803` — confirmed browser-history escape to `/lp/haarplan`; reproduced 10/10 in the incident profile and also in desktop Chromium and mobile WebKit;
- `019fc77b-caf6-7949-add1-a7d2da324e8a` — provider session creation succeeded, but no provider-ready or submit evidence exists; the replay claim remains inconclusive and establishes an observability/recovery gap rather than a third proven close defect.

Provider/backend reconciliation found a created prepared session in all four cases, but client-side typed proof differs: the membership cases emitted `checkout_started`, `019fc799…` emitted ready option exposure, and `019fc796…` has no typed preparation/readiness event. There was no PaymentIntent, charge, purchase, entitlement error, or evidence of a Stripe/PayPal outage. The shared boundary is the mobile offer overlay and its client lifecycle.

A subsequent live-state audit materially sharpened the risk without proving that the four recordings share one root cause. PR #313 reached production at 18:58:52 UTC on 2 August. After that deployment Stripe created nine live €29.99 one-time Checkout Sessions; all nine remained `prepared`, unclaimed and unpaid. Preparation therefore reached Stripe, but current instrumentation cannot prove whether each client received, mounted or successfully claimed the response. No further external purchase of either offer occurred after the 19:05 subscription that was subsequently refunded and canceled. This is a high-severity suspected one-time regression at the preparation-to-client/claim boundary, not proof of universal server rejection or a single outage explaining the confirmed gesture and history defects.

### Four-session evidence reconciliation

| Session | Replay Vision claim | Typed/reproduced truth | Planning consequence |
| --- | --- | --- | --- |
| `019fc799…` | Wallets stayed loading and card clicks closed checkout | PayPal and Apple Pay each emitted `offer_payment_option_viewed` on the first and third openings; no method selection or provider attempt followed. A payment-control-origin drag closes the pristine overlay 5/5 at 100 px, with the exact 80/81 px boundary. | Confirmed app-owned gesture defect. Fix in Slice 1; no provider change. |
| `019fc796…` | The customer clicked **Mit Karte bezahlen** and checkout closed | The replay omits the decisive touch. Stripe preparation succeeded, but no option-view, method-selection or payment-attempt event followed. The card reveal control currently emits no dedicated click transition. | Corroborates the gesture scope but remains individually inconclusive. Add a pre-state-change card/payment-surface transition so future cases are provable. |
| `019fc78a…` | A subscription click failed and reset the quiz | `checkout_started` completed, then a same-session `$pageview` navigated from the result to `/lp/haarplan` 161 ms later. Browser/system Back reproduces this 10/10; explicit checkout exits do not. | Confirmed history-ownership defect. Fix in Slice 1 and preserve the prepared session when Back only hides checkout. |
| `019fc77b…` | The customer clicked the paid subscription CTA and the modal closed | `offer_checkout_opened -> checkout_started(automatic_mount)` proves session/client-secret creation only. No `provider_ready`, visible click, method-selection, confirmation or provider outcome evidence exists. | Keep the case inconclusive. Add readiness/recovery evidence first; do not ship timeout behavior from this recording alone. |

The scanner assigned 0.7–0.8 confidence to all four narratives, but its click/loading/failure claims exceed the evidence. Provider iframe content and missing replay pointers are not negative proof. Typed lifecycle and provider/backend truth must outrank visual inference.

## Chosen direction

Keep the existing one-time and membership offers live while delivering one reliability initiative in two reviewable code slices plus one guarded operational activation. Slice 1 is the urgent correction for the two confirmed defects, the silent one-time boundary and the minimum preparation/client lifecycle needed to prove the remaining failure; it must be reviewable/releasable independently and is not held behind the inconclusive provider-readiness case:

1. **Correctness and classification** — restrict payment-overlay drag to its visible handle; make the overlay own one same-URL browser-history entry; preserve the valid prepared attempt when checkout is deliberately hidden and reopened for the same plan; turn silent `prepared_checkout_unavailable` / `provider_locked` control outcomes into explicit recovery states; record ordered lifecycle and dismissal reasons.
2. **Provider recovery** — add deterministic stalled-ready and load-error fixtures; keep ready alternatives available; after a measured per-provider deadline, show a persistent German retry state without closing the overlay or implying that a payment failed.
3. **Operational interpretation** — add a bounded PostHog unresolved-boundary view/monitor and update Replay Vision's checkout scanner so it can claim a click, provider failure, or payment attempt only when the lifecycle evidence supports it.

The implementation does not attempt to eliminate provider or WebView failures. It guarantees that app-owned state cannot silently disappear, recoverable provider failures remain recoverable, and inconclusive recordings remain explicitly inconclusive. Nick explicitly chose continued live traffic and an urgent independent Slice 1 rather than pausing either offer or bundling the full recovery/operations scope.

## Scope and non-goals

In scope:

- one-time and membership Personal Plan offer overlays;
- mobile payment-sheet drag origin;
- same-URL history ownership while checkout is open;
- stable attempt/session identity across deliberate close and reopen of the same selected plan, with an incrementing open index rather than a new attempt;
- Stripe Elements, Apple Pay and PayPal readiness, load-error, timeout and retry presentation;
- PostHog-only lifecycle telemetry and bounded Sentry breadcrumbs/tags;
- Replay Vision checkout-scanner classification and a low-noise unresolved-boundary monitor;
- Chromium, mobile WebKit and physical in-app-browser verification.

Constraints:

- preserve prices, plan selection, attribution, payment consent, provider idempotency, webhook, purchase, entitlement and fulfillment semantics;
- preserve the existing business `checkout_started` contracts during the urgent fix so attribution and historical reporting do not silently change; current one-time and membership emission points are not comparable preparation milestones and must not be used as such;
- add arm-consistent diagnostic preparation/client/claim stages instead of redefining `checkout_started`; these stages are PostHog-only and do not route to Meta or Customer.io;
- emit business `offer_checkout_opened` / Meta InitiateCheckout once per customer attempt. Same-attempt reopen emits only the PostHog lifecycle `resumed`, so attribution is preserved without a colliding Meta event ID;
- preserve explicit X, backdrop, handle, Escape and plan-change exits, including the existing confirmation once the customer has engaged with payment;
- preserve normal browser Back after checkout is closed;
- never include email, raw result/resume tokens, provider secrets, payment details, provider session IDs, or free text in telemetry;
- Supabase/provider truth remains authoritative for payments; PostHog is diagnostic.

Non-goals:

- no Stripe, PayPal, Apple Pay, pricing, billing, database or entitlement redesign;
- no new checkout implementation and no global change to non-payment bottom sheets;
- no claim that every abandonment is a product defect;
- no claim that all four recordings are one provider outage or that successful Stripe preparation proves healthy client rendering/claiming; the post-#313 one-time boundary remains an urgent suspected regression until the new lifecycle and controlled production check resolve it;
- no automatic provider retry, automatic payment action, modal trap, or removal of deliberate dismissal;
- no production payment, scanner, dashboard or alert mutation during implementation without its explicit guarded activation step.

## Target map

Core interaction and state:

- `src/components/ui/bottom-sheet.tsx` — add a default-off handle-only drag-origin mode and typed dismissal-origin reporting while retaining the boolean open contract for existing consumers.
- `src/components/checkout/offer-payment-overlay.tsx` — enable handle-only drag; widen `OfferPaymentOverlayDismissalReason` and its reducer/render-action/`onDismissRequest` consumers so X, backdrop, handle, Escape, system Back and plan change retain distinct fixed origins; own checkout-history guarding; normalize them into the existing pristine/engaged dismissal policy.
- `src/components/quiz/result-offer-pricing.tsx` — separate visibility from prepared attempt state for one-time and membership variants; retain attempt/session state across same-plan hide/reopen; invalidate only on plan change, explicit retry that requires rotation, or terminal completion.
- `src/lib/analytics/checkout-attempt.ts` — extend the existing claim/controller pattern with explicit hide/resume/end semantics, a presentation `openIndex` for both pricing flows, and exactly-once lifecycle claims; do not add a parallel lifecycle controller module.
- new `src/lib/checkout/offer-checkout-history.ts` — pure same-URL history sentinel/state-machine helpers, including suppression when an explicit close consumes the sentinel, restoration when Back-triggered confirmation is cancelled, and cleanup on route navigation/page teardown. Use `pushPersonalPlanQuizHistoryState` only as prior art: checkout state has its own branded sentinel and must not consume quiz-step entries.
- mounting surfaces to verify explicitly: both production `/result/[leadId]` render paths (`PersonalPlanOffer` and the legacy direct `ResultOfferPricing` fallback), the offer-page lab, and the currently unreferenced `QuizResultOfferPage` shell. The production result route does not co-mount `PersonalPlanQuiz`'s existing `popstate` owner; a fixture still proves that foreign history state is ignored rather than consumed.

Provider readiness and recovery:

- `src/components/checkout/stripe-offer-elements-checkout.tsx` — emit readiness/load/confirmation transitions; add a per-option readiness watchdog and local Retry while leaving already-ready alternatives usable.
- `src/components/checkout/payment-method-checkout.tsx` — propagate PayPal readiness, selection, load failure and retry transitions for membership checkout.
- `src/components/checkout/personal-plan-one-time-checkout.tsx`, `paypal-one-time-button.tsx`, and `paypal-subscription-button.tsx` — propagate the same bounded readiness/recovery contract where the provider SDK exposes it. Add an app-owned PayPal mount-start callback before waiting for `onReady`; provider-script failure remains a separate load-error signal. The silent `prepared_checkout_unavailable` and `provider_locked` control outcomes are fixed in Slice 1, not gated on readiness timing.
- `src/components/checkout/offer-payment-overlay-lab.tsx` — add deterministic history, drag, provider-stall, load-error, retry and lifecycle fixtures; no real provider calls.

Analytics and operations:

- `src/lib/analytics/events.ts`, `routes.ts`, `destinations/posthog.ts`, and analytics tests — add one PostHog-only `offer_checkout_lifecycle` diagnostic event with a fixed transition/reason vocabulary and elapsed time; preserve existing business milestones and destinations.
- `src/lib/observability/checkout.ts` and tests — add privacy-safe breadcrumbs/tags for readiness timeout and classified close; expected dismissal is not a Sentry issue.
- `docs/analytics/offer-page-tracking.md` — document the lifecycle grain, identity, privacy, ordering and query semantics.
- `docs/operations/payment-failure-monitoring.md` — add unresolved-boundary reconciliation and clarify that it is not payment-failure or revenue-loss proof.
- new `docs/operations/replay-vision-checkout-scanner.md` — retain the approved scanner prompt/rules, evidence hierarchy, credit/sampling guard, operational activation and rollback receipt.

Regression surfaces:

- new `tests/offer-payment-overlay-mobile-gesture.spec.ts`;
- new `tests/result-offer-checkout-history.spec.ts`;
- `tests/offer-payment-overlay.spec.ts` and `tests/offer-payment-overlay.test.tsx`;
- `tests/checkout-attempt.test.ts` and a new lifecycle unit suite;
- `tests/stripe-offer-elements-checkout.test.tsx`, `tests/payment-method-checkout.test.tsx`, and one-time checkout tests;
- `tests/analytics-tracking.test.ts` and `tests/checkout-observability.test.ts`;
- `playwright.config.ts` — change the local WebKit project's `testMatch` to an array that retains `personal-plan-mobile-action.spec.ts` and adds the focused gesture/history specs; configure an explicit iPhone-like device/viewport rather than relying on its current desktop defaults.

## Designed user journey

1. A paid-social customer completes the quiz, reaches their existing result and opens **Sicher bezahlen** for either the one-time Haarplan or a membership plan.
2. The overlay opens on the same result URL and owns one temporary same-URL browser-history entry. The selected plan, result identity, offer scroll position, funnel session and prepared provider attempt remain stable.
3. Payment options initialize:
   - every ready option becomes usable and independently visible;
   - an unavailable wallet does not block PayPal or card;
   - a tap or downward movement beginning on any payment option, input, button, link or provider iframe interacts with or scrolls checkout but never starts dismissal;
   - only a downward gesture beginning on the visible handle may use swipe-to-dismiss.
4. Before payment engagement in the Express overlay, a deliberate X, backdrop, handle swipe, Escape or first system Back hides checkout to the same result position and records its exact reason. This `dismissed` transition is non-terminal. Reopening the unchanged plan emits `resumed`, increments `openIndex`, resumes the same attempt and does not create a second provider session. The legacy/non-Express membership branch retains its current always-confirm dismissal behavior.
5. After payment engagement, every dismissal mechanism—including system Back—shows **Zahlung abbrechen?**. Choosing **Weiter bezahlen** restores the open overlay and its history guard without losing entered fields. Choosing **Zahlung abbrechen** returns to the same result and preserves the selected plan while discarding provider-owned form input according to the existing copy.
6. A second browser/system Back after checkout is closed performs ordinary browser navigation. It must never be consumed by a stale checkout sentinel.
7. If one provider does not become ready within its measured deadline or emits a load error:
   - the overlay stays open;
   - other ready payment methods stay usable;
   - the affected surface says, for example, **Kartenzahlung lädt länger als erwartet** and offers **Kartenzahlung erneut laden**;
   - Retry rotates only the provider-session attempt when the existing idempotency rules require it;
   - no UI or event calls this a failed payment because the customer has not submitted one.
8. When the customer taps the app-owned **Mit Karte bezahlen** reveal control, `payment_surface_selected` is recorded before local state changes. Provider readiness is recorded immediately from the SDK callback; the existing `offer_payment_option_viewed` remains a separate 750 ms visibility/exposure event and is not used as a readiness proxy. When the customer engages and confirms, lifecycle ordering is `payment_surface_selected? -> payment_engaged -> confirm_started`; existing `checkout_started`, provider/backend outcome, purchase, return and entitlement events remain authoritative rather than being duplicated into the lifecycle event.
9. If the customer leaves or a recording is incomplete, the resulting attempt is either classified by its explicit dismissal/resume/timeout/error/completion/end event or reported as an unresolved checkout boundary. Replay Vision must not invent a button click, trust search, or provider failure.

Decision checkpoint: Nick confirmed continued live traffic, the independent urgent Slice 1, the recommended handle-only dismissal/first-Back behavior, and the complete user journey on 4 August 2026.

## Planning evidence

- Combined rendered review: [`plans/artifacts/2026-08-04-mobile-checkout-reliability-review.html`](artifacts/2026-08-04-mobile-checkout-reliability-review.html).
- The first panel incorporates the confirmed 80/81 px drag boundary and selected handle-only behavior.
- The second incorporates the 10/10 browser-history reproduction and shows the existing engaged-dismissal confirmation rather than a new modal concept.
- The third makes the new per-provider stalled-ready recovery state concrete while preserving ready alternatives and keeping checkout open.
- The lifecycle strip records the selected diagnostic grain; business and provider truth remain separate.
- Selected direction: deliberate exits remain possible; accidental payment-surface gestures cannot close; the first Back is checkout-owned; provider stalls recover in place; all cases are classified through one attempt ID.
- Second-pass evidence review: live event trails were reconciled against all four work sessions. This added non-terminal dismiss/resume semantics, app-side `openIndex` mapped to PostHog `open_index`, a dedicated card/payment-surface selection transition, and separate SDK-ready versus 750 ms option-exposure meaning.
- Third-pass evidence review: post-#313 provider, funnel, billing and analytics truth confirmed nine prepared-but-unclaimed one-time sessions, no later external purchase, different one-time/membership `checkout_started` emission points, and removal of preparation telemetry. This upgraded the one-time boundary to an urgent suspected regression while rejecting universal server rejection and the claim that all four recordings have one cause.
- Evidence-review status: **confirmed by Nick on 4 August 2026**; the reviewed direction is handle-only drag, checkout-owned first Back, in-place provider recovery, and attempt-scoped diagnostics.

## Ordered tasks

### Slice 1 — correctness and classification

1. Add failing `@ci` reproductions before changing behavior:
   - 81–120 px downward gestures beginning on Apple Pay, PayPal, card controls and provider-frame containers currently close a pristine overlay;
   - browser/system Back from the open loading overlay currently leaves `/result/[lead]` and reaches `/lp/haarplan`;
   - close/reopen of an unchanged plan currently rotates attempt/session identity;
   - a reused/mismatched preparation-token control outcome can currently leave the one-time payment surface blank without a recovery.
   Completion: each exact production boundary is red on current `main`, while stationary taps, 80 px movement, explicit X/backdrop/handle close, and normal Back with no overlay remain control cases.
2. Add payment-overlay handle-only drag mode and typed close-origin reporting. Gate the pending drag candidate at pointer-down so both the captured-drag branch and the existing pointer-up fallback are protected. Keep the option default-off for the shared primitive and enable it only in `OfferPaymentOverlay`. Completion: payment surfaces cannot initiate dismissal; the handle retains the existing 80/81 px threshold; `product-detail-drawer.tsx`, `routine-drawer.tsx`, and `log-day-card.tsx` preserve their current default drag behavior.
3. Implement the same-URL history guard as a testable state machine. Opening pushes exactly one sentinel; explicit close consumes it without leaving the result; Back consumes it and requests dismissal; cancelling a Back-triggered confirmation restores exactly one sentinel; teardown leaves none. Completion: first Back is checkout-owned, second Back after close is normal, and no popstate loop or duplicate entry occurs in Chromium/WebKit fixtures.
4. Separate overlay visibility from preparation identity for both one-time and membership flows. For the one-time path, keep a still-valid cached preparation/client secret mounted but hidden across same-plan dismiss/resume; reuse the current `visible`-driven wallet reset; rotate the preparation ID and credential once when the cached preparation is absent, inside its 30 s expiry margin, invalid, or explicitly failed. Never resend a mismatched token for an old preparation ID. For membership, separate `checkoutInterval` visibility from the prepared checkout/session-attempt state rather than relying on today's single nullable value. Completion: same-plan dismiss/resume preserves the customer attempt and creates at most one provider session while valid; expiry/control-outcome fixtures rotate exactly once; plan change creates the expected new scope; hidden-mount wallet readiness remains safe.
5. Add an arm-consistent PostHog-only diagnostic lifecycle by extending the existing checkout-attempt claim pattern. Required preparation/client stages are `preparation_started`, `prepared_response_received`, `client_mounted` and `claimed`; required interaction/recovery stages are `opened`, `provider_ready`, `payment_surface_selected`, `payment_engaged`, `confirm_started`, `dismissed`, `resumed`, `recovery_presented` and `attempt_ended`. Existing business `checkout_started`, `offer_payment_method_selected`, `checkout_start_failed`, provider truth and purchase events keep their current meanings and destinations; dashboards must not compare the one-time and membership business `checkout_started` events as if they were the same preparation boundary. A pristine same-plan `dismissed` event is non-terminal; `resumed` reuses its attempt ID and increments app-side `openIndex` (mapped to `open_index` only in PostHog). An engaged, confirmed abort records `dismissed` followed by terminal `attempt_ended` with `customer_aborted` so the existing discard-input promise remains true. `recovery_presented` carries a fixed timeout/load/control/confirmation reason; plan change and page teardown emit `attempt_ended` with fixed reasons, while provider-preparation expiry rotates inside the same customer attempt. Client lifecycle never labels teardown as successful completion: provider return, purchase and entitlement events remain authoritative. Required bounded context includes attempt ID, open index, commerce kind, provider/option where known, presentation, elapsed milliseconds, last state and fixed dismissal/recovery/end reason. Completion: the one-time and membership fixtures prove the ordered preparation-to-client-to-claim boundary; claims are unique per attempt + transition + provider/reason + open index; every fixture produces privacy-safe diagnostics; and existing Meta/Customer.io routing is unchanged.
6. Route X, backdrop, handle, Escape, system Back and plan change through the normalized dismissal contract before any state reset. Completion: each reason is recorded once with its last lifecycle state; expected closes do not create Sentry issues; engaged confirmation remains identical across origins.
7. Eliminate the silent one-time control-outcome boundary independently of readiness timing. A valid `prepared_checkout_unavailable` response shows a specific in-overlay recovery and rotates preparation identity once; `provider_locked` keeps or switches to the owning provider and creates no competing session. Add a reused/mismatched preparation-token fixture that is red before changing the hide/resume seam. Completion: neither outcome renders blank, closes checkout, claims a payment failure, or waits for the Slice 2 timing sample; ready alternatives stay usable and request-count assertions prove the rotation/lock rules.

### Slice 2 — provider readiness and recovery

8. Add deterministic fixtures for successful client-secret/session creation followed by: ready, never-ready, SDK load error, retry-then-ready, and confirmation failure. Cover both membership and one-time seams where behavior differs. Stripe starts timing at `onLoaderStart`; PayPal starts at the new app-owned button-component mount callback before SDK `onReady`; neither starts when the overlay opens or while the one-time card surface is hidden. Completion: never-ready is red because current UI lacks classified recovery; all fixtures prohibit automatic overlay close.
9. Deploy Slice 1 telemetry before choosing new never-ready watchdog deadlines. Record immediate, exactly-once SDK readiness separately for Payment Element and PayPal, segmented at least by provider surface and browser class. Preserve the existing Apple Pay 5 s initial-response / 10 s checkout-loading availability fallback and classify ordinary wallet unavailability separately from load failure. Collect at least 50 external mounts per provider surface or seven full days, whichever comes first. Set a provisional provider deadline to `clamp(2 × observed p95 readiness, 10_000 ms, 20_000 ms)`; if fewer than 50 mounts exist after seven days, use a conservative `15_000 ms` guarded default and record the low-sample status. Completion: the Slice 2 receipt records sample size, p95, browser split, chosen milliseconds and fallback status; the timer is scoped by attempt/provider/mount and cancelled on ready, retry, close or unmount.
10. Add the reviewed in-place recovery UI. A stalled or failed option shows specific German copy and Retry, while independently ready alternatives remain enabled. Reuse and extend `shouldRotateStripeSessionAttemptOnRetry` rather than reimplementing its existing network/provider-response/invalid-payload rules:
   - same-plan hide/reopen preserves `checkoutAttemptId`, provider preparation and client secret;
   - a transport/network retry reuses the same provider-session idempotency scope because the server may already have succeeded;
   - provider-response failure, invalid payload, SDK load failure after a valid response, or `prepared_checkout_unavailable` preserves the customer attempt but rotates the provider-session/preparation scope;
   - `provider_locked` switches to the already owning provider and creates no competing session;
   - an explicit plan change or terminal completion ends the attempt.
   Completion: no stall, error, retry or provider rerender closes checkout or emits `payment_engaged`/`confirm_started` without user action, and request-count assertions prove the identity rule for each branch.
11. Harden submit ordering and failure presentation. Method selection and `confirm_started` precede the provider call; confirmation errors remain inside checkout with a retryable action and one classified recovery. Completion: double-clicks, late callbacks, provider cancellation and cross-provider locks retain current fencing and never emit duplicate transitions.

### Slice 3 — operational activation

12. Update the analytics/operations documentation and create a dry-run/read-only PostHog query for unresolved boundaries: an opened attempt with no later ready, classified dismissal, recovery, confirmation or end inside the agreed window. Completion: synthetic fixtures classify correctly; the query calls them unresolved boundaries, not failed payments, and filters `is_internal_test` explicitly.
13. Update the Replay Vision checkout scanner in PostHog after the code events are live. Evidence priority is provider/backend truth, typed lifecycle events, then visible replay. An app-owned card reveal requires `payment_surface_selected`; a submit requires visible interaction or `payment_engaged` plus `confirm_started`; an iframe not rendered in replay and a missing pointer are unknown, not failure or absence; replay-only inference is `inconclusive`. Preserve the existing credit budget through bounded sampling and record before/after prompt fingerprints. Completion: the four source cases receive the evidence-backed classifications from this plan without invented clicks or provider failures.
14. Activate a low-noise monitor only after a read-only baseline. Group by attempt, suppress expected internal tests, and require Stripe/Supabase/Sentry reconciliation before escalating customer impact. Completion: one synthetic unresolved attempt alerts once; deliberate dismissal and ordinary long reading do not; rollback instructions and ownership are recorded.

## Verification

Automated:

- focused Chromium gesture matrix at 80/81/100/120 px from handle and interactive descendants;
- mobile WebKit gesture and history suites;
- history state-machine unit tests plus browser tests for open, explicit close, Back, cancel-confirmation, confirm-abort, reopen, plan change, component teardown and second Back;
- route/history ownership tests for both production result render paths, the lab, ignored foreign quiz history state, and Next route/page teardown;
- one-time and membership attempt/session reuse tests asserting at most one provider-session request for same-plan reopen;
- valid cached preparation, 30 s expiry-margin rotation, mismatched/replayed token `unavailable`, hidden-mount wallet visibility and provider-lock request-count fixtures;
- lifecycle transition ordering, exactly-once claims, bounded property vocabulary and secret/identity exclusion;
- lifecycle hide/resume semantics: same attempt ID, monotonic app-side `openIndex` mapped to PostHog `open_index`, non-terminal `dismissed`, and one terminal `attempt_ended`;
- Meta/business-event invariant: `offer_checkout_opened` once per attempt; PostHog-only `resumed` for later presentations;
- dedicated card/payment-surface selection before the local reveal state change, plus immediate SDK-ready events distinct from 750 ms option exposure;
- ready, never-ready, load-error, retry-then-ready, confirmation-error and late-callback provider fixtures;
- existing provider lock, Apple Pay timeout/fallback, PayPal cancellation, checkout success, payment integrity, analytics routing and offer tracking suites;
- `npm run typecheck`, focused tests, `npm run ci:verify`, then the repository-owned `implementation-loop`, which invokes the available `ready-check` and `request-code-review` skills.

Manual/browser:

- incident viewports: iPhone/Instagram 393×852 and 402×874; Android/Facebook 360×650; Android/Instagram 375×705;
- one-time and quarterly membership variants;
- stationary taps and downward movement from Apple Pay, PayPal, card, inputs, links, disabled/loading buttons and provider-frame containers;
- X, backdrop, handle, Escape and system Back before/after payment engagement;
- same result route, exact offer scroll restoration, selected plan, entered-field preservation on **Weiter bezahlen**, and ordinary second Back;
- provider ready, unavailable wallet, one stalled option with another ready, all-option load failure, Retry and confirmation error;
- production `/result/[leadId]` Personal Plan and legacy fallback surfaces plus the guarded offer-page lab; confirm the unreferenced `QuizResultOfferPage` is not treated as live without a caller;
- accessibility: focus trap/restore, alert/status announcements, inert background, 320×568 containment, reduced motion and keyboard Escape.

Physical-device residual checks before readiness is claimed:

- eligible iPhone Safari and Instagram in-app browser for native Apple Pay and touch/pointer behavior;
- Android Chrome plus a real or cloud-hosted Instagram/Facebook WebView for system Back and provider iframe loading;
- use test-mode/no-submit paths; automation does not prove native wallet availability.

Live-state checks after separately authorized deployment:

- bounded no-submit smoke confirms options remain mounted, lifecycle ordering and absence of secrets;
- read-only sample confirms dismissal reasons and provider-ready timings before choosing/confirming the monitor threshold;
- reconcile any unresolved boundary with provider session/PaymentIntent, Supabase billing/purchase/access and Sentry before describing revenue impact;
- no live scanner/dashboard/alert mutation until exact project/title/fingerprint and rollback checks pass.

## Review and handoff

- Worktree: `.worktrees/mobile-checkout-reliability`
- Branch: `codex/mobile-checkout-reliability`
- Delivery shape: keep both offers live; urgently deliver two code slices reviewed sequentially, then one guarded PostHog operational activation. Slice 1 includes the two confirmed defects, the silent one-time control-outcome recovery and the minimum preparation/client/claim lifecycle; it may be published and released independently after its own explicit authorization. Slice 2 follows after the readiness sample/timeout gate. Slice 3 remains in this initiative because the requested outcome includes fixing the scanner's overclaims, but live configuration writes remain separately authorized.
- Counterpart plan review: complete twice; latest Claude verdict **approve with revisions**. Verified material findings are reconciled below.
- Findings ledger:

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| CR-1 | scope/product decision | Reviewer linked a prior Aug-2 one-time initialization incident to a possible current P0 outage | accepted with correction after new evidence | Reframed as an urgent suspected one-time preparation-to-client/claim regression; retained the separate confirmed gesture/history causes and rejected universal server rejection | Post-#313 Stripe status, external purchase truth, route semantics and all four session trails |
| ND-1 | scope/product decision | Continued paid traffic versus containment while the suspected one-time boundary remains unresolved | accepted, user decision | Keep both offers live and prioritize the independently releasable Slice 1; no ad, allocation or feature-flag mutation | Decision checkpoint plus release receipt |
| ND-2 | scope/product decision | Bundle all recovery/operations work versus urgent staged delivery | accepted, user decision | Ship correctness/control-outcome/minimum lifecycle first; measured readiness recovery and operational activation follow | Slice-specific verification and authorization receipts |
| ND-3 | scope/product decision | Mobile dismissal and browser-Back behavior | accepted, user decision | Use handle-only drag; retain deliberate exits; require the existing confirmation after engagement; first Back is checkout-owned and second Back is normal | Reviewed artifact plus final journey walkthrough |
| EA-1 | defect | Nine post-#313 live one-time sessions reached Stripe as `prepared` but none became `claimed` or paid | accepted | Added preparation/client/claim stages to Slice 1 and upgraded urgency without claiming a universal provider outage | Controlled no-submit journey plus provider/funnel reconciliation |
| EA-2 | measurement defect | One-time and membership `checkout_started` fire at different boundaries | accepted | Preserve business contracts but prohibit cross-arm preparation comparison; add arm-consistent diagnostics | Analytics routing and ordering tests |
| EA-3 | defect | Preparation telemetry ended at the #313 deployment | accepted | Restore bounded diagnostic evidence for successful response receipt, mount, claim and silent control outcomes | PostHog event contract tests and live no-submit receipt |
| CR-2 | defect | `prepared_checkout_unavailable` and `provider_locked` remain real control outcomes and can lack a useful visible recovery | accepted | Added both to Slice 1 fixtures, lifecycle classification, UI recovery and request-count checks | Red fixture before implementation; focused one-time tests after |
| CR-3 | tradeoff | Bundling unproven provider-stall hardening could delay the two confirmed fixes | accepted | Slice 1 is independently reviewable/releasable; Slice 2 waits for measured readiness data | Separate receipts and authorization boundaries |
| CR-4 | tradeoff | No production `provider_ready` distribution exists before Slice 1 | accepted | Added the per-provider 50-mount/seven-day gate, segmented p95 formula, 10–20 s clamp and 15 s low-sample fallback | Post-release read-only sample recorded in Slice 2 receipt |
| CR-5 | defect | Retry identity wording did not tell an implementer when to reuse versus rotate | accepted | Added explicit network/provider/control-outcome/plan-change rules | Route/request-count and idempotency tests |
| CR-6 | defect | Reviewer claimed `implementation-loop`, `ready-check`, and `request-code-review` do not exist | rejected | Kept the repository-owned workflow and clarified that these are skills, not package scripts | Verified `.agents/skills/implementation-loop` and personal skill paths |
| CR-7 | defect | Handle-only protection must gate pointer-down to cover both dismissal branches | accepted | Named exact pointer-down seam and both branches | 80/81/100/120 px browser matrix |
| CR-8 | scope clarity | “Representative” non-payment sheets was ambiguous | accepted | Named all three other shared BottomSheet consumers | Focused regression checks |
| OA-1 | semantic defect | The plan called dismissal terminal while requiring the same attempt to resume | accepted | Made dismissal non-terminal; added `resumed`, app-side `openIndex`/PostHog `open_index` and terminal `attempt_ended` semantics | Lifecycle unit suite plus close/reopen request-count browser test |
| OA-2 | observability defect | The app-owned **Mit Karte bezahlen** reveal control currently marks engagement and changes state but emits no dedicated selection event | accepted | Added `payment_surface_selected` before state mutation without overloading provider-method selection | One-time checkout component and analytics-order tests |
| OA-3 | measurement defect | `offer_payment_option_viewed` requires 750 ms visibility and therefore cannot stand in for provider readiness | accepted | Added immediate SDK `provider_ready`; retained viewed as a separate exposure metric | Ready-before-view and short-lived-ready fixture |
| OA-4 | rollout defect | A generic overlay-open watchdog could time out an unmounted card surface, and p99 from 50 observations is effectively a maximum | accepted | Start per-provider timers at actual mount; preserve Apple Pay's existing fallback; use segmented p95 with a provisional low-sample rule | Timer-origin unit tests and Slice 2 measurement receipt |
| CR2-1 | defect | One-time client analytics cannot itself prove successful preparation, and `prepared_checkout_unavailable` can currently render silently | accepted with correction | Clarified that backend reconciliation—not typed client telemetry—proved the four created sessions; moved unavailable/locked recovery into Slice 1 | Control-outcome red fixtures plus provider/backend reconciliation |
| CR2-2 | defect | Same-plan resume could replay an invalid preparation ID/token or retain an expired client secret | accepted | Added valid-cache/30 s margin rules, single rotation, token mismatch and hidden-mount fixtures | Route contract and one-time request-count tests |
| CR2-3 | defect | History ownership was underspecified across production, lab and quiz history state | accepted | Enumerated result render paths/lab; referenced the existing quiz sentinel as prior art; require foreign-state and teardown tests | Browser and state-machine fixtures |
| CR2-4 | defect | Current dismissal reasons collapse X, backdrop, Escape and drag into `close` | accepted | Named the dismissal-reason union, reducer, render actions and consumers as contract changes | Overlay unit tests plus origin matrix |
| CR2-5 | defect | Existing WebKit project selects one file and has desktop defaults | accepted | Require an additive `testMatch` array and explicit iPhone-like device/viewport | Playwright config inspection and local WebKit run |
| CR2-6 | scope defect | The original lifecycle duplicated existing business/provider events | accepted with later evidence correction | Kept one fixed PostHog-only lifecycle and existing business milestones, then restored four explicit preparation/client/claim stages after post-#313 evidence showed that boundary was otherwise unobservable | Analytics ordering/routing tests plus controlled preparation-to-claim fixture |
| CR2-7 | attribution defect | Re-emitting `offer_checkout_opened` on resume could collide with Meta's attempt-based event ID | accepted | Business open is once per attempt; repeat presentations use PostHog-only `resumed` | Meta/PostHog destination tests |
| CR2-8 | defect | PayPal exposes `onReady` but no current timer-start callback | accepted | Add app-owned PayPal component mount-start; keep script failure distinct | Never-ready and script-failure component fixtures |
| CR2-9 | tradeoff | Reviewer proposed a static 15 s timeout immediately instead of measuring readiness | rejected | Keep the evidence gate because the Android case is unproven and customer-facing timeout timing is not required for Slice 1 correctness | Slice 1 live sample before Slice 2 |
| CR2-10 | scope/product decision | Reviewer proposed removing scanner/monitor work from this initiative | rejected | Keep it as a separately authorized operational slice because scanner accuracy is part of the requested end-to-end fix | Independent Slice 3 activation receipt |
- Evidence review: **confirmed by Nick on 4 August 2026**.
- User-journey sign-off: **confirmed by Nick on 4 August 2026** after the complete entry, dismissal/Back, resume, loading/recovery, alternative-provider and successful-payment journey was walked through.
- Artifact disposition: combined plan and rendered HTML **commit**; investigation scratch scripts, copied production identifiers beyond the plan, screenshots generated only for chat, and transient reviewer output **discard**.
- Residual risks: native wallet and social-WebView gesture/history behavior still need device validation; client PostHog may be absent on abrupt exit, so an unresolved boundary remains diagnostic rather than a durable payment ledger; provider-specific readiness deadlines require measured evidence.
- Stop point: Slice 1 implementation is review-ready in the task worktree. Commit/push/PR, merge, deployment and PostHog activation remain separately authorized.

## Slice 1 implementation receipt — 4 August 2026

- Implemented the approved handle-only gesture boundary, same-URL browser-Back guard, resumable same-plan checkout state, terminal engaged abort, provider-session reuse/rotation rules, visible one-time control-outcome recovery, and privacy-safe PostHog lifecycle seams.
- Preserved existing business analytics meanings and provider/payment truth. Client teardown is never labeled as purchase completion.
- Deliberate scope boundary: Slice 2 measured provider-readiness watchdogs and Slice 3 live PostHog scanner/monitor activation were not implemented. No production configuration, payment, deployment or other live state was changed.
- Automated verification: full Node suite `2611/2611`; focused final lifecycle controller suite `3/3`; final checkout overlay browser suite `58/58` across Chromium and mobile WebKit; `npm run ci:verify` passed typecheck, lint and production build with four pre-existing unrelated lint warnings.
- Review: required correctness and structural counterpart review completed. Its final Back-confirmation interleaving finding was fixed by restoring the sentinel from actual ownership state and suppressing competing dismissal reasons; exact browser and lifecycle regression tests were added.
- Durable artifacts: this plan and its rendered review HTML stay with the change. Transient reviewer reports and generated test output are discarded.
- Residual checks: native Apple Pay, physical Instagram/Facebook WebViews and a production no-submit smoke remain unverified because Slice 1 has not been deployed. They are release validation, not evidence of a current local test failure.
