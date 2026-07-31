# Mobile quiz and offer motion/styling polish

## Outcome and source context

Make the existing personal-plan quiz and offer feel more modern, responsive, and intentional on mobile by implementing the two reviewed styling/motion rounds without shortening, reordering, or rewriting the funnel.

The plan is based on:

- the current `origin/main` implementation at `30ce958f95f6142555f1c3c95dfeef3da6ce42aa`, including the merged one-time personal-plan pricing experiment;
- the rendered personal-plan journey and current component/state seams;
- Nick's approval of both interactive motion/styling mockups on 2026-07-31;
- the explicit constraint that the quiz questions, order, loading commitments, offer sections, copy, pricing, and payment behavior stay intact.

Current implementation evidence:

- Quiz navigation changes the screen immediately and keeps the sticky header mounted, but the screen body has no directional transition.
- Option cards already have selected, hover, and focus states, but no mobile press compression or selected-check settle.
- The quiz already auto-advances single-choice answers after 260 ms, leaving room for a short press/selection response before navigation.
- The progress bar animates, but section milestones do not have a one-time completion settle.
- The final profile summary is static even though its four personalized fields are a natural payoff moment.
- `ResultOfferPricing` now branches between the membership selector and a fixed €29.99 one-time offer. The offer page owns the sticky CTA, so a narrow variant-aware summary callback can synchronize either branch without moving checkout ownership.
- FAQ analytics currently rely on native `<details>` `toggle` events.
- The checkout overlay always asks for confirmation, although the enhanced Stripe and PayPal paths expose enough interaction seams to distinguish an untouched checkout from an engaged one.
- There is no animation framework in the application. The existing UI uses scoped CSS/Tailwind motion and has a reduced-motion block with explicit selectors; every new animation must be registered there rather than assumed to be covered globally.

## Chosen direction

Use a restrained, component-local motion system built with CSS/Tailwind and small React state seams. Do not add Framer Motion or another runtime dependency.

1. Quiz navigation
   - Keep `ScreenHeader` fixed while the content uses a shared-axis transition.
   - Forward navigation: old content fades and shifts 6-8 px left while new content fades and shifts in from the right.
   - Back navigation: reverse the direction.
   - Switch application state immediately; retain the outgoing layer only as a short, inert visual layer so animation never delays navigation, analytics, history, or autosave.
   - This intentionally differs from the prototype's single-container 160 ms delayed swap. Production uses two overlapping layers because delaying `setScreen`, history, analytics, and scroll would change funnel behavior.
   - Freeze the previously rendered React element before state changes; do not re-render the outgoing layer from the new `screen`/`answers` state.
   - The outgoing layer is `inert`, `aria-hidden`, pointer-inactive, removed after the exit duration, and excluded entirely under reduced motion.
   - During overlap, preserve unique DOM IDs and a single exposed heading/landmark tree. Add a browser assertion for duplicate IDs rather than assuming all question variants are ID-free.
   - Duration: 160 ms exit and 200 ms entry with a calm ease-out curve.

2. Selection and payoff feedback
   - Give all quiz option-card variants a 90-120 ms `scale(0.985)` press response, a smoother border/background transition, and a small selected-check settle.
   - Preserve the current 260 ms single-choice auto-advance. The interaction response completes before the next screen begins.
   - Give the multi-select CTA count a one-time 180 ms bump/crossfade when the count changes, without moving the button.
   - Give the analysis bridge's existing portrait/card a single 400-480 ms settle on entry.
   - Reveal the four final profile-summary fields 70 ms apart; no ongoing motion.
   - When a quiz section is completed, animate the newly completed progress marker once over 300-400 ms; never loop or pulse.

3. Offer and checkout polish
   - In the membership arm, smooth the selected pricing card, radio indicator, displayed price, and CTA-label change without changing card size or layout. Do not invent selection motion for the one-time arm's single fixed product.
   - Keep the sticky offer CTA as the current `Angebot ansehen` with pricing-navigation analytics until pricing is actually observed.
   - The real product uses a top-right header pill rather than the prototype's full-width footer. Reserve a fixed 9 rem mobile footprint (`w-36`, growing to `w-40` from `sm`) from the first render and keep the same height in both states. Before pricing it centers `Angebot ansehen`; after pricing it crossfades to two compact lines:
     - membership: selected plan + price, then `Zur Zahlung`;
     - one-time: `Haarplan · 29,99 €`, then `Zur Zahlung`.
   - This keeps the current variant's product/price information while fitting beside the wordmark at 320 px without row reflow.
   - Once pricing is reached, persistently morph that fixed header control and change its click/analytics semantics to checkout.
   - Keep selected-plan data synchronized through optional callbacks from `ResultOfferPricing`; do not lift or duplicate checkout state.
   - Animate FAQ open/close height and chevron rotation with a small controlled native-`<details>` component:
     - intercept the `<summary>` activation;
     - on open, set `details.open = true`, measure summary/full heights, and animate to the full height;
     - on close, keep the element open during the height animation and set `details.open = false` only on completion;
     - cancel/restart from the current computed height on rapid toggles;
     - toggle immediately under reduced motion.
   - This retains the native `toggle` event consumed by `OfferTrackingProvider`; do not copy the prototype's non-`<details>` button/grid markup.
   - Close an untouched checkout immediately. Show the existing discard confirmation only after a payment field changes or a Stripe/Apple Pay/PayPal provider flow is initiated.

4. Motion accessibility
   - Under `prefers-reduced-motion: reduce`, remove transforms, stagger delays, and decorative exit layers. State changes, focus, scrolling, and checkout behavior remain immediate.
   - Motion communicates response and direction only. Do not add continuous pulses, parallax, animated gradients, shimmer, or page-wide reveal cascades.

Implementation packaging:

- Slice A / PR 1: quiz motion, selection/payoff feedback, pricing-selector motion, sticky CTA morph, FAQ disclosure, reduced-motion foundation, and their browser oracles.
- Slice B / PR 2: pristine-versus-engaged checkout dismissal for both membership and one-time payment paths, with its own payment-safety tests and review.
- Both slices are required to complete this plan. The split is a review/risk boundary, not a scope reduction.

## Scope and non-goals

In scope:

- directional transitions across the existing personal-plan quiz screens;
- option-card press/selection feedback for thumbnail, image, portrait, grid, and text cards;
- multi-select CTA count feedback;
- one-time section milestone, analysis-bridge, and final profile-summary motion;
- plan-selector selection/price/CTA polish;
- context-aware sticky offer CTA after pricing is reached;
- smooth personal-plan FAQ disclosure;
- conditional checkout-exit confirmation based on actual payment engagement;
- reduced-motion behavior and focused regression coverage;
- mobile-first verification at 320, 360, 375, and 390 CSS px plus desktop sanity checks.

Non-goals:

- no removal, addition, shortening, reordering, or copy change to quiz questions;
- no change to the three loading commitments, their timing contract, or the preparation/result sequence;
- no removal, addition, reordering, or copy change to offer sections or FAQs;
- no pricing, reference-price, subscription, product, entitlement, email, result, provider, or payment-session change;
- no change to pricing-experiment assignment, one-time consent/legal copy, one-time versus membership commerce semantics, or arm-specific guarantee visibility;
- no new animation library;
- no continuous attention animation or automatic scroll hijacking;
- no analytics event rename or reinterpretation;
- no deployment, production flag change, real payment, merge, or publication in this planning task.
- no claim that motion alone is a conversion fix; treat conversion impact as a hypothesis to measure separately from the visible UX/optics improvement.

## Target map

- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
  - Add a local direction-aware screen-transition wrapper.
  - Set transition direction inside the existing `goNext` and `goBack` seams while preserving browser-history behavior.
  - Apply shared press/selection motion to both `OptionCard` layouts.
  - Key the multi-select CTA count for a stable one-time update animation.
  - Add one-time section-marker, analysis-bridge, and final profile-summary classes/data attributes.
  - Detect the newly completed section from the prior/current section indices and retain a ref-backed set of settled indices so the completed dot animates once rather than replaying on every screen render or back/forward revisit.
  - Keep `MidpointProfileScreen`'s existing timed reveal and `LoadingScreen`'s existing commitment flow unchanged.
- `src/app/globals.css`
  - Add narrowly named personal-plan quiz/offer keyframes and reduced-motion overrides.
  - Keep durations in four tiers: press 90-120 ms, ordinary UI 160-220 ms, milestone 300-400 ms, payoff 400-500 ms.
- `src/components/checkout/subscription-plan-selector.tsx`
  - Smooth selected-card/radio states and key the selected CTA label/price transition inside a fixed-size container.
  - Add only optional selection reporting if required by `ResultOfferPricing`; keep existing usages backward compatible.
- `src/components/quiz/result-offer-pricing.tsx`
  - Add optional `onPricingReached` and variant-aware checkout-summary callbacks to the shared public props.
  - Call them from both `PersonalPlanOneTimePricing` and `MembershipResultOfferPricing`; the one-time branch reports its canonical fixed product while the membership branch reports the selected interval.
  - Reuse each branch's existing once-visible pricing observer rather than create a competing scroll observer.
  - Track checkout engagement per checkout attempt in both branches and reset it on confirmed close, plan reset, or a new attempt.
  - Pass the engagement requirement to the overlay and the first-interaction callback through the applicable payment stack.
- `src/components/personal-plan-offer/personal-plan-offer.tsx`
  - Store the once-reached pricing state and latest selected plan summary.
  - Give the existing top-right sticky CTA a fixed 9 rem mobile width (`w-36 sm:w-40`) and stable height, then morph its content in place. Do not add a second sticky footer.
  - Keep `data-offer-destination="pricing"` and `scrollToPersonalPlanPricing()` before pricing; use `destination="checkout"` and `openCheckout()` afterwards.
  - Attach `data-offer-selected-interval` only for membership. Do not fake an interval for the one-time arm; its existing offer context retains `commerceKind="one_time"`/`purchaseKind="personal_plan_once"` semantics downstream.
  - Extract an isolated controlled animated FAQ item using measured-height animation while retaining `<details data-offer-faq>`, `<summary>`, and native open/toggle semantics.
- `src/components/checkout/payment-method-checkout.tsx`
  - Forward a first-engagement callback from Stripe/Payment Element and call it when a PayPal or card/provider flow is explicitly selected.
- `src/components/checkout/stripe-offer-elements-checkout.tsx`
  - Mark engagement on the first Payment Element `onChange` event where `event.empty === false`, and before an express/payment confirmation claim.
  - Preserve wallet availability, provider-lock, preparation, and confirmation logic.
- `src/components/checkout/personal-plan-one-time-checkout.tsx`
  - Mark engagement when the required consent checkbox is changed, when the Stripe choice is opened, or when Stripe/PayPal payment interaction starts.
  - Route the checkout-content `Zahlung schließen` control through the overlay's same dismissal policy instead of bypassing it.
  - Preserve the consent gate, legal copy/version, fixed €29.99 product, disabled payment placeholders, duplicate-access behavior, and one-time analytics.
- `src/components/checkout/offer-payment-overlay.tsx`
  - Add a pure confirmation-policy helper or equivalent prop-driven branch.
  - For a pristine checkout, route close directly to `onConfirmedAbort` and plan change directly to `onConfirmedPlanChange`.
  - For an engaged checkout, retain the current inert background, alert dialog, copy, focus behavior, and continue/abort paths.
  - Expose the existing `requestDismissal("close")` action to nested one-time checkout content through a narrowly scoped render action or equivalent local API; do not let the internal close button call `closeCheckout()` directly.
- Focused tests:
  - `tests/personal-plan-option-card-layout.test.ts`
  - `tests/personal-plan-quiz-funnel-entry.test.ts`
  - `tests/personal-plan-offer-page.test.tsx`
  - `tests/subscription-plan-selector.test.tsx`
  - `tests/result-offer-pricing-tracking.test.ts`
  - `tests/offer-payment-overlay.test.tsx`
  - `tests/stripe-offer-elements-checkout.test.tsx`
  - `tests/mobile-ux.spec.ts`
  - `tests/offer-payment-overlay.spec.ts`

## Designed user journey

Actor: a consumer using the personal-plan funnel, primarily on a mobile viewport.

1. The visitor opens the quiz. The current sticky header, section labels, progress, questions, and order are unchanged.
2. On touch-down, an option card compresses very slightly. On selection, its border/background and check indicator settle immediately.
3. For single-choice questions, the existing 260 ms auto-advance remains. The selected state is visibly acknowledged before the current screen exits.
4. The next screen enters from the direction of travel while the header stays fixed. Browser back or the header back button uses the mirrored transition and still returns to the exact prior conditional screen.
5. Multi-select choices do not auto-advance. Each changed count updates inside the fixed CTA with a single subtle bump; disabled/enabled behavior and the current wording remain unchanged.
6. When a section boundary is crossed, the newly completed marker fills and settles once. There is no repeated pulse while the visitor remains on later questions.
7. The existing analysis bridge gets one short visual settle. The existing midpoint profile and loading commitments continue with their current timings and behavior.
8. On the final profile-summary screen, the existing image and copy remain unchanged while the four personalized rows appear 70 ms apart. The CTA and subsequent daily-time/loading/email sequence stay exactly where they are.
9. On the offer page, the sticky CTA initially retains the current `Angebot ansehen` copy. Clicking it scrolls to and focuses pricing and remains a navigation interaction, not checkout intent.
10. The first time pricing becomes visible, the fixed-width top-right sticky CTA permanently changes for that page view:
    - membership visitors see the currently selected plan/price plus `Zur Zahlung`;
    - one-time visitors see `Haarplan · 29,99 €` plus `Zur Zahlung`.
    Changing a membership plan updates both the pricing CTA and sticky CTA without changing the header row's width or height.
11. Clicking the morphed sticky CTA opens the same checkout branch as that arm's pricing CTA. Membership reports its selected interval; one-time keeps its canonical one-time commerce metadata and does not invent an interval.
12. Opening or closing an FAQ smoothly animates the measured native disclosure height and chevron. Keyboard activation, native `<details open>` state, and the existing once-per-FAQ `toggle` analytics remain intact.
13. If checkout is opened and the visitor closes it before changing the one-time consent, entering payment information, choosing Stripe, or starting a provider flow, it closes immediately and returns focus to the initiating CTA.
14. If the one-time consent was changed, a Payment Element field has changed, Stripe was chosen, or Apple Pay/PayPal/Stripe has been initiated, every close route—including the one-time checkout's internal close control—shows the current discard confirmation. `Weiter bezahlen` returns focus to checkout; confirmed abort/change follows the current reset/focus behavior.
15. If the enhanced Payment Element is unavailable and the legacy embedded iframe cannot expose field-level dirtiness, the fallback remains conservative and retains confirmation once payment interaction cannot be safely distinguished. It must never discard possible inputs silently.
16. With reduced motion enabled, the same journey and feedback states appear essentially instantly without directional shifts, scaling, stagger, or settling animation.

Recovery and edge states:

- Rapid repeated taps cannot enqueue multiple quiz transitions or checkout opens.
- A back action during the single-choice delay clears the existing timer as it does today.
- Conditional admission screens still use the recorded history rather than array index assumptions.
- A plan change during checkout keeps the current provider-lock restrictions.
- Checkout waiting, provider errors, retry, duplicate subscription, Apple Pay availability, and PayPal cancellation retain their current behavior.
- FAQ content remains fully readable if animation CSS fails.

## Mockup evidence

- [Approved core motion/styling prototype](./mockups/2026-07-31-quiz-motion-styling.fragment.html)
- [Approved expanded navigation/offer/FAQ/checkout prototype](./mockups/2026-07-31-quiz-motion-styling-expanded.fragment.html)
- Both artifacts are preserved as the exact reviewed interactive fragments. They are intentionally host fragments rather than production components.
- Feedback incorporated:
  - implement both styling rounds;
  - keep the complete quiz and offer;
  - use restrained, modern motion rather than decorative animation.
- Mockup review: **confirmed by Nick on 2026-07-31**.
- User-journey sign-off: **confirmed by Nick on 2026-07-31 through the explicit request to hand the reconciled plan into the normal Codex implementation workflow**.

## Ordered tasks

1. Add failing Slice A behavior contracts for transition direction, sticky CTA semantics, FAQ behavior, and motion accessibility.
   - Complete when the current implementation fails the new focused assertions for the intended reasons.
   - Put direction selection and variant-aware sticky-CTA state behind pure helpers that `node:test` can exercise; add the dismissal/engagement policy helper with Slice B.
   - Use Playwright for rendered animation, focus/inert behavior, FAQ timing, sticky-header geometry, and complete click behavior. Static markup/source assertions remain only structural guards and are not behavior oracles.
2. Implement the quiz screen-transition layer and reduced-motion foundation.
   - Keep outgoing content inert, `aria-hidden`, and pointer-inactive.
   - Freeze the prior rendered node before the current child changes; never derive the outgoing visual from new `screen`/`answers` state.
   - Assert no duplicate DOM IDs and only one accessibility-exposed heading/landmark tree during overlap.
   - Do not delay `setScreen`, history, analytics, persistence, or scroll reset.
   - Complete when forward/back navigation, rapid input, conditional history, and the timer-driven `plan_loading` → `email_capture` transition pass with and without reduced motion.
3. Implement option, multi-select, milestone, bridge, and profile-summary feedback.
   - Apply shared classes to both option-card branches.
   - Do not modify midpoint or loading timing constants.
   - Complete when every card layout responds consistently and one-time motion does not replay on unrelated rerenders.
4. Implement plan-selector and sticky-offer CTA synchronization.
   - Reuse the branch-local pricing visibility observers and canonical product data.
   - In the membership branch, attach `onPricingReached` to the always-on `pricingRef` observer used for `pricing_viewed`; do not use the prewarm-gated `pricingCtaRef` observer.
   - In the one-time branch, call the same shared callback from its existing always-on `pricingRef` observer and report the canonical `PERSONAL_PLAN_ONCE_PRODUCT` summary.
   - Preserve pricing-navigation versus checkout-intent analytics before and after the morph.
   - Complete when the initial state, fixed one-time product, and all three membership intervals render the correct two-line header content, variant-correct data attributes, and action without overflow at 320 px.
5. Implement the animated FAQ disclosure with retained accessibility and analytics.
   - Keep native `<details>` semantics and the same open `toggle` observed by `OfferTrackingProvider`.
   - Animate between measured summary/full heights, keep `open` true until close animation completes, and restart from the current computed height after a rapid reversal.
   - Complete when mouse, touch, Enter, and Space open/close smoothly; rapid toggles settle correctly; and reduced motion is instant.
6. Start Slice B from refreshed main after Slice A is review-ready/merged, add failing payment-safety contracts, then implement conditional checkout-exit confirmation.
   - Add an attempt-scoped `checkoutEngaged` signal.
   - Prop-drill one optional first-engagement callback across Stripe checkout → payment-method checkout → result-offer pricing → overlay; do not add a new global context for this local state.
   - In membership, mark it when Payment Element reports `empty === false` or on explicit provider selection/initiation, not provider readiness or technical prewarm.
   - In one-time checkout, additionally mark it on consent change and Stripe-choice activation, and route the nested close control through the overlay dismissal action.
   - Preserve a conservative confirmation fallback when an embedded provider cannot expose whether input exists.
   - Complete when pristine close/plan-change is immediate, engaged close/plan-change confirms, continuing preserves input, and confirmed dismissal resets state.
7. Run focused automated and real-browser verification for each slice, then the repository readiness/review gates independently.
   - Slice A is complete when there is no functional, responsive, accessibility, analytics, or reduced-motion regression and no unresolved review blocker.
   - Slice B is complete when pristine/engaged behavior is verified for membership and one-time paths, possible provider input is never silently discarded, and no payment/consent/analytics regression or unresolved review blocker remains.

## Verification

Automated:

- Unit/component tests for:
  - forward/back transition-direction selection;
  - unchanged 260 ms auto-advance and history/timer behavior;
  - all option-card layouts retaining their width/selector contracts;
  - selected-plan CTA labels for month, quarter, and year;
  - one-time fixed-product summary plus selected-plan CTA labels for month, quarter, and year;
  - sticky CTA destination/selected-interval/one-time semantics before and after pricing;
  - FAQ count, copy, native open state, and analytics hook;
  - pristine versus engaged overlay dismissal for both `close` and `plan_change`;
  - Payment Element/provider initiation marking engagement exactly once;
  - one-time consent/Stripe-choice engagement and the nested close control using the overlay policy;
  - unchanged provider lock, prewarm, checkout-attempt, and analytics contracts.
- Focused red/green command during implementation:
  - `npx tsx --test tests/personal-plan-option-card-layout.test.ts tests/personal-plan-quiz-funnel-entry.test.ts tests/personal-plan-offer-page.test.tsx tests/personal-plan-one-time-checkout.test.tsx tests/personal-plan-pricing-experiment.test.ts tests/subscription-plan-selector.test.tsx tests/result-offer-pricing-tracking.test.ts tests/offer-payment-overlay.test.tsx tests/stripe-offer-elements-checkout.test.tsx`
- Repository gates before readiness handoff:
  - `npm run test:node`
  - `npm run ci:verify`

Mandatory Playwright gate:

- Preconditions:
  - `.env.local` exists in the worktree and contains `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` for `tests/mobile-ux.spec.ts`;
  - local lab access is enabled through the repository's existing development environment;
  - no real provider payment is submitted.
- Extend `/labs/offer-page?variant=personal-plan` to accept a test-only pricing-arm query so the same real `PersonalPlanOffer` component can exercise membership and one-time surfaces without production data.
- Terminal 1:
  - run `npm run dev:worktree -- --print-port` and record the returned task port;
  - start `PERSONAL_PLAN_QUIZ_V1_ENABLED=true NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED=true NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED=true npm run dev:worktree`.
- Terminal 2, using that exact port:
  - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<task-port> npx playwright test tests/mobile-ux.spec.ts tests/personal-plan-offer-motion.spec.ts tests/offer-payment-overlay.spec.ts --project=chromium`
- `tests/personal-plan-offer-motion.spec.ts` is a new focused browser oracle for both pricing arms, sticky CTA semantics/geometry, pricing selection, FAQ animation/analytics-visible state, and reduced motion.
- This Playwright command is mandatory for readiness. `npm run test:node` and `npm run ci:verify` do not execute these `.spec.ts` browser tests.

Real browser:

- Use the real personal-plan quiz plus the existing offer/payment-overlay lab rather than detached production-component replicas.
- Viewports: 320x568, 360x800, 375x812, 390x844, and one desktop viewport.
- Quiz states:
  - text, image, thumbnail, portrait, grid, single-select, multi-select, analysis bridge, midpoint profile, final profile summary, daily time, loading, email, forward, and back.
- Offer states:
  - both pricing arms; before pricing; pricing reached; all three membership choices; fixed one-time product; FAQ open/close; checkout waiting/open; untouched close; consent-changed close; Stripe-choice close; entered-card close; provider-started close; continue payment; confirmed abort; membership plan change; provider error/retry.
- Reduced motion:
  - repeat representative quiz, pricing, FAQ, and checkout interactions with `page.emulateMedia({ reducedMotion: "reduce" })`.
- Assertions:
  - the fixed header does not jump;
  - the fixed 9 rem mobile CTA and wordmark fit at 320 px in both CTA states;
  - outgoing quiz content cannot receive focus or pointer input;
  - no transition causes horizontal overflow or a mobile layout shift;
  - CTA height/width remains stable while its content changes;
  - no repeating animation remains after 600 ms;
  - focus is restored to the correct control after FAQ/checkout interactions;
  - keyboard and screen-reader state (`aria-pressed`, `aria-expanded`, `open`, live status) remains truthful.

Live-state and payment safety:

- Use local fixtures/mocks only; do not submit a real payment.
- No migration, database write, provider configuration change, production flag change, or analytics schema change.
- Verify that technical checkout prewarm/readiness does not count as user input.
- Verify that a price-navigation CTA is still not reported as checkout intent.
- Verify the one-time arm never emits a membership interval and the membership arm never inherits one-time commerce/purchase metadata.

## Review and handoff

- Planning/implementation worktree: `.worktrees/quiz-motion-styling`
- Branch: `codex/quiz-motion-styling`
- Base reviewed for planning: current `origin/main` at `30ce958f95f6142555f1c3c95dfeef3da6ce42aa`
- Required implementation workflow after explicit approval:
  - Slice A uses this worktree/branch and `implementation-loop`, including its `ready-check` and `request-code-review` gates plus the required read-only whole-branch Claude review before push.
  - Slice B gets a separate `codex/checkout-dismissal-polish` worktree/branch from refreshed main and runs the same gates independently.
- Artifact disposition:
  - commit this plan and the two approved mockup fragments with the Slice A implementation PR; Slice B references the merged plan and records only any payment-specific amendment it needs;
  - keep counterpart-review output transient unless a material finding needs to be recorded in this plan;
  - discard temporary screenshots/test traces after verification unless they are needed as review evidence.
- Main residual risks:
  - overlapping screen layers must not duplicate focusable/accessibility content;
  - native FAQ height animation must survive rapid toggles and mobile Safari;
  - field-level dirtiness is not reliably observable inside every legacy cross-origin embedded checkout, so safety wins over silent discard in that fallback;
  - sticky CTA morphing must preserve the analytics distinction between pricing navigation and checkout intent.
  - the newly merged one-time arm has its own consent and nested close paths; both must participate in engagement/dismissal policy without changing legal or commerce semantics.
- Counterpart-plan review reconciliation:
  - **Accepted:** explicitly document the production two-layer transition versus the prototype's delayed swap.
  - **Accepted:** choose a measured-height native-`<details>` technique so FAQ analytics survive.
  - **Accepted:** target the real top-right CTA with a fixed two-line footprint and 320 px browser verification rather than copying the prototype's nonexistent footer; the final mobile width is 9 rem after the refreshed review.
  - **Accepted:** make pure helpers and Playwright the behavior oracles; retain source/static-markup checks only as structural guards.
  - **Accepted:** use the always-on pricing observer, mark Payment Element engagement only when non-empty, and run the repository's full test/verification commands before readiness.
  - **Accepted after current-main refresh:** cover both the membership and newly merged one-time pricing/checkout paths without mixing commerce metadata.
  - **Accepted:** split payment-dismissal behavior into Slice B / PR 2 while retaining it as required scope.
  - **Accepted:** make the exact three-spec Playwright command, environment/server prerequisites, and real `PersonalPlanOffer` lab seam a mandatory gate.
  - **Accepted:** freeze the outgoing React node, assert duplicate-ID/accessibility-tree safety, and include loading's timer-driven transition.
  - **Accepted:** reduce the reserved mobile sticky-CTA width from 10 rem to 9 rem and keep 320 px geometry as the oracle.
  - **Rejected:** reduce the approved forward/back treatment to enter-only motion. The two-layer design retains the full approved directional feedback without delaying product state and has explicit inert/ARIA/removal safeguards.
- Open product decisions: **none**. The approved mockups and current journey settle the visual direction.
- Mockup-review status: **confirmed on 2026-07-31**.
- User-journey sign-off status: **confirmed on 2026-07-31**.
- Planning stop point: complete. Hand off Slice A to `implementation-loop`; retain Slice B as required follow-up scope behind its separate payment-safety branch/review boundary.

## Slice A implementation receipt

- Implemented on `codex/quiz-motion-styling` in the approved existing task worktree.
- Scope stayed within Slice A. No checkout-dismissal policy, payment behavior, funnel content, pricing, consent/legal copy, or commerce semantics changed; Slice B was not started.
- The production two-layer transition freezes a sanitized visual DOM snapshot rather than remounting the outgoing React screen. Its browser oracle waits for the quiz's existing client draft-readiness point before interacting, so it tests real hydrated motion rather than server markup.
- The native FAQ disclosure adopts a browser-restored `open` state after hydration, suppresses only that known attribute mismatch, and retains native `toggle` analytics.
- Final automated verification on the implementation tree:
  - `npm run test:node`: 2,132 passed;
  - `npm run ci:verify`: passed typecheck, lint, and production build with four pre-existing unrelated warnings and no errors;
  - mandatory Chromium command: 48 passed across the specified quiz, offer-motion, and payment-overlay specs.
- The exact-tree readiness and review receipts are reported in the implementation handoff; transient test traces and counterpart-review output are not retained in the repository.
