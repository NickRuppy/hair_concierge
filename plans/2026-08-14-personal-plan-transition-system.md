# Personal Plan seamless transition system

## Outcome and source context

The Personal Plan should feel like one continuous product after payment. Opening a day from the Anwendung overview must use the application guidance already delivered to the browser instead of recomputing the same ten-day plan. Other transitions should reuse the same motion language only where it explains navigation truthfully.

Approved evidence:

- [Interactive Anwendung transition prototype](./artifacts/application-day-transition/prototype.html)
- [Selected mobile horizontal push](./artifacts/application-day-transition/mobile-push-detail.png)
- [Rejected sheet comparison](./artifacts/application-day-transition/mobile-sheet-detail.png)
- [Full post-payment transition audit](./artifacts/application-day-transition/journey-transition-audit.html)
- [Desktop audit capture](./artifacts/application-day-transition/journey-transition-audit.png)
- [Mobile audit capture](./artifacts/application-day-transition/journey-transition-audit-mobile.png)

Nick selected Variant A, approved the page-by-page recommendation, and asked that the rest of the post-payment Personal Plan be checked for suitable reuse. Evidence review: **confirmed**.

## Chosen direction

Use three related but distinct behaviors. The Personal Plan Journey header remains fixed; only the content surface moves.

1. **Depth push** for already available subviews within one task:
   - forward: outgoing content moves to `translateX(-24%)` and `opacity: 0.72`; incoming content moves from `translateX(100%)` to `0`;
   - reverse: the directions invert;
   - duration: `360ms` with `cubic-bezier(.2,.78,.2,1)` for translation and `260ms ease` for outgoing opacity;
   - applies to Bedarfsplan Basis/Optional, Stage 2 question navigation, and Anwendung overview/day.
2. **Quiet stage advance** for a genuine move between Personal Plan stages:
   - the successfully mounted destination uses a quiet `24px` one-sided entrance plus opacity over `220ms ease-out` while the meaningful source or bridge is held during asynchronous work;
   - Stage 3 uses opacity only so its fixed confirmation action is never captured by a transformed ancestor;
   - cross-route destinations use the same bounded entrance only after successful content mounts; loading or recovery fallbacks do not animate as successful navigation;
   - explicit full prefetch is used only after the destination is authoritative and safe to read.
3. **Hold state** while saving, bootstrapping, compiling, or recovering:
   - keep the current meaningful surface visible with local pending/error feedback when that state is client-controlled;
   - never slide into a loading skeleton or error view;
   - do not invent a readiness signal that the backend does not provide.

Use stable React, browser history, and Next.js App Router primitives already present in the repository. Do not enable experimental React View Transitions, add an animation dependency, or build a global route-animation framework.

Delivery is ordered in two reviewable slices:

- **Slice 1:** shared local-motion primitives and the three client-held depth transitions.
- **Slice 2:** authority-aware stage transitions and cross-route client navigation.

Slice 1 is safe to ship independently. Slice 2 consumes the motion contract from Slice 1 and must be reviewed as a separate commit/PR-sized change even if both are implemented in the same task worktree.

Within Slice 1, Anwendung's no-refetch navigation is the load-bearing behavior and the depth animation is layered on top. Zero duplicate compile/RSC navigation remains an independent acceptance requirement even if motion needs to be narrowed for focus, history, or reduced-motion correctness.

## Scope and non-goals

### In scope

- Reuse the already compiled `ApplicationPageView.days` for overview-to-day navigation.
- Preserve `/anwendung/[dayType]` deep links, direct server rendering, reload behavior, browser Back/Forward, and accessible link semantics.
- Add directional transitions to Bedarfsplan Basis/Optional and Stage 2 question navigation.
- Keep Stage 1 visible while an explicitly requested fresh Stage 2 session loads; do not create a Stage 2 draft merely because Stage 1 was viewed.
- Keep the Stage 2 bridge visible while Stage 3 bootstraps, then quietly advance when authoritative Stage 3 data is ready.
- Replace Stage 3's full-document `/routine` handoff with App Router client navigation after a successful completion receipt.
- Keep `/plan-start` on the default partial Link prefetch because its server page can materialize Stage 1; use full prefetch only for `/anwendung` when its journey CTA is valid and the compile is a safe read. Mark intentional stage navigation so direct visits and global navigation do not receive directional entrance motion.
- Honor `prefers-reduced-motion`, focus movement, scroll behavior, keyboard activation, and screen-reader announcements.
- Add regression and browser coverage for data reuse, navigation direction, history, slow targets, failures, and absence of unexpected writes.

### Non-goals

- No changes to Stage 1–5 recommendation logic, application compiler output, cadence, product authority, exact-product/family guidance, or fail-closed rules.
- No redesign of cards, copy, navigation, Journey header, Routine drawers, Stage 3 comparison, or application instructions.
- No blanket animation across Stage 3 phases or global app navigation.
- No database migration, production data write, feature flag, payment-provider work, deployment, or activation.
- No promise that a dynamic cross-route destination is already available when the framework has no authoritative readiness signal. A real loading/recovery state remains visible and unanimated.
- No claim that synthetic post-payment testing covers Stripe, PayPal, webhooks, settlement, or customer payment state.

## Authoritative motion and navigation contract

| Situation                                          | Motion                                    | URL/history                                          | Loading/error behavior                                                                                                         |
| -------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Bedarfsplan Basis → Optional                       | Depth push forward                        | Remains `/plan-start`; local history is not added    | Both views are local; no loader                                                                                                |
| Optional → Basis                                   | Depth push reverse                        | Remains `/plan-start`                                | Restore the relevant scroll position                                                                                           |
| Stage 2 next/previous question                     | Depth push by ordered question index      | Remains `/plan-start`                                | Existing optimistic save continues; save failure reverses to the submitted question and shows its existing error               |
| Anwendung overview → day                           | Depth push forward                        | Native `history.pushState` to `/anwendung/[dayType]` | No RSC request, no application recompile, no loading shell                                                                     |
| Anwendung day → overview / browser Back            | Depth push reverse                        | Native history returns to `/anwendung`               | Restore overview state and focus                                                                                               |
| Direct `/anwendung/[dayType]`                      | No artificial entry motion                | Server route remains canonical                       | Existing fail-closed recovery remains                                                                                          |
| Stage 1 → Stage 2                                  | Hold, then quiet stage advance            | Remains `/plan-start`                                | Create/load Stage 2 only after CTA; Stage 1 shows pending/error locally                                                        |
| Stage 2 → Stage 3                                  | Hold bridge, then quiet stage advance     | Remains `/plan-start`                                | Bridge remains visible during bootstrap; failure remains recoverable there                                                     |
| `/plan-bereit` → Stage 1                           | Quiet entrance on successful target mount | App Router push to `/plan-start`                     | Default partial route prefetch only; do not execute the materializing page before activation; real fallback remains unanimated |
| Stage 3 → Routine                                  | Quiet entrance on successful target mount | App Router replace to `/routine`                     | Navigate only after valid completion receipt; no `window.location.replace`                                                     |
| Routine → Anwendung                                | Quiet entrance on successful target mount | App Router push to `/anwendung`                      | Full prefetch only when Stage 5 CTA is valid; real fallback remains unanimated                                                 |
| Loading, unavailable, conflict, retry, or recovery | None                                      | Existing canonical location                          | Preserve current truthful feedback and recovery action                                                                         |
| Global app navigation                              | None or existing neutral behavior         | Existing App Router navigation                       | Do not imply journey direction                                                                                                 |

For reduced motion, all transforms and animated opacity changes are removed while URL, focus, scroll, pending, and error behavior remains identical.

## Target map

### Shared motion and intentional stage navigation

- Create a small local transition component under `src/components/personal-plan-journey/`, exported from `src/components/personal-plan-journey/index.ts`:
  - local depth/stage transition keyed by semantic view ID and direction;
  - focus handoff after the incoming view is stable;
  - no external dependency.
- Add a small intentional-stage-navigation helper under `src/lib/personal-plan/`:
  - records a short-lived, destination-bound navigation intent in `sessionStorage` immediately before App Router navigation;
  - consumes it once on the matching target;
  - ignores missing, stale, mismatched, reload, direct-entry, and global-navigation cases.
- Add narrowly named motion styles/keyframes to `src/app/globals.css` or colocated CSS, including `prefers-reduced-motion` handling.
- Add focused component/unit tests in a new `tests/personal-plan-transition-motion.test.tsx` or the nearest existing Personal Plan journey test.

### Slice 1 consumers

- `src/components/application/application-page.tsx`
- `src/components/application/application-overview.tsx`
- `src/components/application/application-day-card.tsx`
- `src/components/application/application-day.tsx`
- `src/components/personal-plan-start/plan-start-flow.tsx`
- `src/components/personal-plan-start/need-plan-screen.tsx`
- `src/components/personal-plan-refinement/refinement-flow.tsx`
- `src/components/personal-plan-refinement/refinement-question.tsx`
- `tests/personal-plan-stage5-view-adapter.test.ts`
- `tests/personal-plan-stage5-route.test.tsx`
- `tests/personal-plan-stage2-refinement-ui.test.tsx`
- `tests/personal-plan-ready-transition.test.ts`
- Browser coverage under the existing Personal Plan Playwright journey suite.

### Slice 2 consumers

- `src/app/plan-bereit/personal-plan-ready-client.tsx`
- `src/components/personal-plan-start/plan-start-flow.tsx`
- `src/components/personal-plan-refinement/refinement-flow.tsx`
- `src/components/personal-plan-refinement/refinement-bridge.tsx`
- `src/components/personal-plan-products/stage3-products-flow.tsx`
- `src/components/routine/personal-plan/routine-page.tsx`
- `src/components/routine/personal-plan/personal-plan-routine-client.tsx`
- `src/components/application/application-page.tsx`
- Existing `/plan-start`, Stage 2, Stage 3, Routine, and Stage 5 component/route tests.
- `scripts/personal-plan/measure-read-only-transitions.mjs` and `tests/personal-plan-read-only-transition-benchmark.test.ts` if the authenticated sampler can add the interaction without weakening its write block.

Exact test-file placement may consolidate with existing suites, but production behavior must remain owned by the listed components rather than a new global router layer.

## Designed user journey

User-journey sign-off: **confirmed by Nick on 2026-08-15 after the final post-review walkthrough**.

### Entry and Plan Bereit

1. A legitimately entitled user reaches `/plan-bereit`; current readiness, missing-fact, retry, and support behavior remains unchanged.
2. The Bedarfsplan Link may use Next.js's default partial route-shell prefetch, but must not force a full `/plan-start` server resolve before activation because that page can materialize Stage 1.
3. On activation, the CTA exposes local pending feedback when necessary. The target animates with the quiet stage entrance only when real Stage 1 content mounts; a genuine loading or recovery fallback remains unanimated.

### Stage 1 Bedarfsplan

1. Basis appears exactly as today.
2. Continuing to Optional uses the selected horizontal depth push; the shared Journey header stays fixed.
3. Back reverses the direction and restores the prior surface rather than visibly rebuilding it.
4. Continuing to Feinschliff starts Stage 2 loading only after the explicit CTA. Stage 1 remains present with local pending feedback.
5. If Stage 2 cannot load, Stage 1 remains readable and offers retry; no empty or skeleton destination slides in.
6. Once the first question is ready, the content makes the quiet stage advance to Feinschliff.

### Stage 2 Feinschliff

1. Forward questions enter from the right; Back enters from the left.
2. The next question can still appear optimistically while the previous answer saves, and the header continues to report save status.
3. If saving fails, the flow returns in reverse to the submitted question, preserves its answer, and shows the existing recoverable error.
4. The final answer keeps the current completion and conflict safeguards.
5. While Stage 3 bootstraps, the completion bridge stays on screen with a pending status instead of being replaced by a full loading screen.
6. Bootstrap success advances quietly to Produkte. Bootstrap failure remains on the bridge with retry/back behavior.

### Stage 3 Produkte and Stage 4 Routine

1. Stage 3 internal capture, comparison, confirmation, and recovery behavior remains visually and semantically unchanged.
2. Final completion still requires the canonical successful completion receipt.
3. After that receipt, the app records an intentional Routine handoff and uses App Router replacement rather than reloading the document.
4. A truthful loading/recovery fallback does not receive a successful stage animation. When Routine content mounts from the intentional handoff, it receives the quiet stage entrance once.
5. Direct visits, reloads, and global navigation to Routine do not receive directional journey motion.

### Stage 4 Routine and Stage 5 Anwendung

1. Routine and its product drawers remain unchanged.
2. When `Anwendung ansehen` is valid, `/anwendung` is explicitly prefetched because the compile is read-only and authority has already made the CTA reachable.
3. Activating the CTA records an intentional Stage 5 handoff. A real fallback remains truthful and unanimated; successful Anwendung content enters quietly once.
4. The Anwendung overview shows the existing vertically stacked day shelves.
5. Selecting any day immediately pushes the already delivered day detail in from the right, updates the deep-link URL without an RSC request, and moves focus to the day heading after motion.
6. `Alle Tage`, browser Back, and keyboard navigation reverse the motion and return to the overview. Browser Forward reopens the same day without recomputation.
7. A direct day URL still resolves server-side, validates the day, and preserves existing unavailable/fail-closed behavior.

### Device and accessibility variants

- Mobile and desktop use the same direction and timing; desktop content remains inside its existing max-width rather than sliding across the entire monitor.
- Keyboard activation follows link/button semantics and focus never lands in outgoing inert content.
- Screen readers receive the new heading/view after navigation, not duplicate announcements from both animated layers.
- `prefers-reduced-motion: reduce` performs immediate swaps with the same history, pending, focus, and recovery behavior.

### Completion state

The user can move from the ready page through Bedarfsplan, Feinschliff, Produkte, Routine, Anwendung overview, and a specific day without avoidable full-page reloads or repeated application compilation. Genuine server work and recovery remain visible and truthful.

## Planning evidence

### Anwendung prototype

- **Question:** Does a horizontal push or a raised sheet better communicate moving from the day overview into a specific guide?
- **Decision criterion:** immediate guidance, continuous spatial relationship, natural reverse navigation, and calm rather than decorative motion.
- **Finding:** horizontal push feels like one surface and reverses naturally; the sheet reads as a modal overlay.
- **Selected:** Variant A, horizontal push.
- **Rejected:** Variant B, sheet.
- **Disposition:** commit prototype and comparison screenshots as durable decision evidence; production code must be rewritten.
- **Evidence review:** confirmed by Nick.

### Full transition audit

- **Question:** Where else in the post-payment Personal Plan does the same effect improve comprehension without misrepresenting loading or authority?
- **Decision criterion:** reuse only when navigation direction is meaningful and either destination data is local or successful target mounting can be distinguished from loading/recovery.
- **Finding:** exact depth push fits three local surfaces; major stages need a quieter readiness-aware entrance; Stage 3 internal states, drawers, global navigation, loading, and errors should not receive the effect.
- **Selected:** three-state motion language and two ordered delivery slices.
- **Disposition:** commit interactive audit and desktop/mobile captures.
- **Evidence review:** confirmed by Nick.

### Next.js history spike

- **Question:** Can native history cross `/anwendung` and `/anwendung/[dayType]` route segments on a `force-dynamic` App Router surface without an RSC request on the initial push, browser Back, or browser Forward?
- **Shape:** disposable local Next.js logic/UI route using `usePathname`, two dynamic route segments, and a Playwright request trace.
- **Decision criterion:** `pushState`, Back, and Forward must all update the canonical pathname while emitting zero requests carrying an RSC header or targeting the spike route.
- **Finding:** on the repository's Next.js 16.2.4 runtime, all three navigation actions updated `usePathname` and the request trace was empty.
- **Selected:** keep native history as the Task 2 mechanism and add the same zero-RSC assertion to production browser coverage. Follow the repository's `quiz-browser-history.tsx` listener shape where relevant, while preserving link semantics.
- **Rejected:** accepting an overview refetch on Back or collapsing canonical day URLs into a query-only/single-route contract; neither is required by the observed runtime.
- **Disposition:** discard the temporary spike route; retain this result and reproduce it against the real Anwendung journey during implementation verification.

## Ordered tasks

### Task 1 — Add the bounded Personal Plan motion foundation

**Consumes:** the authoritative motion values and navigation table in this plan.

Implement the smallest reusable local transition wrapper and intentional cross-route navigation marker. The local wrapper must retain outgoing and incoming content only for the bounded animation, mark outgoing content inert/hidden from accessibility, coordinate heading focus after entry, and become an immediate swap under reduced motion. The navigation marker must be destination-bound, single-use, time-bounded, and safe when storage is unavailable.

Add tests for forward/reverse classes, reduced motion behavior, outgoing accessibility exclusion, matching/stale/mismatched intent consumption, and storage failure.

**Produces:** tested `depth` and target-entry contracts plus intentional navigation intent. Quiet local stage changes reuse the target-entry treatment after the destination is ready rather than retaining a second animated layer.

**Complete when:** focused tests prove the exact motion contract without an external dependency or global route interception.

### Task 2 — Make Anwendung day navigation local, deep-linkable, and no-refetch

**Consumes:** Task 1 depth transition and the server-delivered `ApplicationPageView.days`.

Derive the selected day from the canonical pathname while accepting the server-provided initial deep-link selection. Preserve real link semantics, but intercept same-document eligible day/overview navigation to update native history and local selection. Invalid or unavailable days must remain server-owned recovery cases. Ensure `popstate`/`usePathname` changes drive reverse/forward motion without calling the Anwendung resolver again.

Match the bounded history/listener pattern already used by `src/components/quiz/quiz-browser-history.tsx`; its precedent is within one route, so retain the cross-segment zero-RSC browser assertion proven by the planning spike. Reuse the existing pushState-observation approach from `src/components/quiz/result-offer-pricing.tsx` if it fits without coupling unrelated code.

Update component and browser tests for overview → day → Back → Forward, direct deep link, refresh, invalid day, the single-rest-day `no_complete_day` shape, `day_unavailable`, keyboard activation, focus, reduced motion, and zero RSC/application resolver requests for push/Back/Forward. Verify all ten day-specific links use the same path.

**Produces:** immediate overview/day navigation with canonical URLs and no duplicate compile.

**Complete when:** browser evidence shows the selected day guide appears from already loaded data and push/Back/Forward neither render `anwendung/loading.tsx` nor request a new application RSC payload. This no-refetch acceptance stands independently of the decorative depth animation.

### Task 3 — Add depth continuity to Bedarfsplan and Stage 2 questions

**Consumes:** Task 1 depth transition; existing Basis/Optional view state; Stage 2 ordered question path and optimistic save behavior.

Animate Basis/Optional forward and reverse while preserving existing optional image preload and scroll behavior. Animate Stage 2 questions based on ordered index. Do not change answer values, branching, analytics identities, save CAS, or completion logic. When the existing optimistic save fails, return to the submitted question in reverse, preserve its local answer, and render the current error/retry state.

Add tests for Basis/Optional direction, first/last question boundaries, conditional question jumps, Back, save success, save failure rollback, revision conflict, focus, and reduced motion.

**Produces:** consistent local depth motion for Stage 1 and Stage 2.

**Complete when:** deterministic tests prove motion follows semantic order while persistence and recovery outputs are unchanged.

### Task 4 — Make local Stage 1→2 and Stage 2→3 handoffs readiness-aware

**Consumes:** Task 1 target-entry treatment; Stage 2 gateway; existing Stage 2 bridge and Stage 3 bootstrap.

On the explicit Stage 1 CTA, load Stage 2 while retaining Stage 1 with local pending feedback; seed `RefinementFlow` only after success. This action must not move the Stage 2 request earlier into passive Stage 1 viewing. For Stage 2 completion, replace the live `autoHandoff && onHandoff` loading-shell branch at `refinement-flow.tsx:487-507` with the already approved bridge hold: keep `RefinementBridge` mounted with its pending state while `handleHandoff` bootstraps Stage 3, then apply the quiet local stage advance after `installNewStage3Bootstrap`. This deliberately makes the meaningful bridge visible for the bootstrap dwell instead of flashing a full loading shell. Preserve bridge retry/back behavior and server-frontier reload recovery.

Refactor `plan-start-flow.tsx`'s mutually exclusive stage early returns so the meaningful bridge remains mounted during bootstrap and the successful Stage 3 content receives the bounded 220ms entrance. Do not keep inactive stages mounted after the handoff.

Add tests proving no Stage 2 request before CTA, one request after CTA, retained Stage 1 on failure, retained bridge during bootstrap, one Stage 3 bootstrap, successful advance, and unchanged recovery behavior.

**Produces:** local readiness-aware stage transitions within `/plan-start`.

**Complete when:** no full-screen interstitial replaces a meaningful Stage 1 or bridge surface during these handoffs.

### Task 5 — Replace avoidable cross-route seams with intentional App Router handoffs

**Consumes:** Task 1 navigation intent/target entrance; valid readiness CTA, Stage 3 completion receipt, and Routine Stage 5 reachability.

Keep the Plan Bereit `/plan-start` Link on default partial prefetch; do not set `prefetch={true}` because a full dynamic prefetch can execute the materializing Stage 1 page before the CTA is activated. Use `prefetch={true}` on `/anwendung` only when `canOpenApplication` is true and the compile remains read-only. Mark those journey CTAs as intentional stage navigation. The live Stage 3 path currently omits `onOpenRoutine` and therefore reaches the `window.location.replace(ready.next.href)` fallback; supply a `plan-start-flow.tsx` handler that records intent and calls `router.replace('/routine')` only after the existing receipt validation. Consume matching intent on Stage 1, Routine, and Anwendung successful page roots to apply the target entrance once. Loading, unavailable, direct, reload, expired, mismatched, and global-nav paths must not animate as successful progress.

Do not delay navigation by a guessed timer or treat `router.prefetch()` as a completion promise. Preserve the current loading boundaries as truthful fallbacks unless focused browser evidence proves a narrower boundary change safe.

Add tests for valid/invalid receipt, App Router replacement, prefetch eligibility, target-only intent consumption, direct/reload/global navigation, real loading fallback, and reduced motion.

**Produces:** no full-document Stage 3→Routine handoff and bounded quiet entrances for intentional cross-route stage progress.

**Complete when:** network/navigation tests prove no document reload, while slow/failing targets remain truthful and recoverable.

### Task 6 — Extend journey-level performance and browser proof

**Consumes:** Tasks 2–5 behavior.

Extend the existing read-only transition benchmark only if it can preserve its strict write-block contract. Add a day-click measurement from an already loaded overview, count application RSC/resolver requests, and record time from activation to visible/focused day heading. Add browser coverage for the post-payment stage handoffs using fixture or synthetic application state, clearly separated from provider/payment coverage.

Required acceptance assertions:

- Anwendung day activation performs zero application writes and zero second application compile/RSC request.
- Day heading is visible from preloaded data within one animation budget after activation on a warmed overview.
- Stage 2 question saves remain exactly one existing request each.
- Stage 3 completion remains exactly one authority completion path and then uses client navigation.
- No stage animation is applied to loading, unavailable, conflict, or retry states.
- Reduced-motion tests observe no transform duration.

**Produces:** repeatable performance and end-to-end evidence for both slices.

**Complete when:** focused browser tests, the safe sampler where applicable, and the Personal Plan verification suite pass without production writes.

## Verification

### Automated

- Focused Node/React suites covering the touched Stage 1, Stage 2, Stage 3, Routine, and Stage 5 components.
- `npm run test:personal-plan`.
- Relevant Personal Plan Playwright journeys at mobile and desktop viewports.
- `npm run typecheck` and scoped lint during implementation, then the repository's full `npm run ci:verify` finish gate and `ready-check` through `implementation-loop`.
- Regression assertions for native history, direct deep links, App Router navigation, no full document reload, no duplicate application resolver request, accessibility exclusion, focus, scroll, and reduced motion.

### Manual/browser

- Review at approximately `375×812`, `430×900`, and a desktop viewport.
- Operate Basis/Optional, Stage 2 forward/back/error rollback, Stage 2 bridge bootstrap, Stage 3→Routine, Routine→Anwendung, and Anwendung overview/day/Back/Forward.
- Repeat with reduced motion and an intentionally throttled target route.
- Confirm the Journey header remains visually stable and desktop motion stays within the content container.
- Confirm direct `/anwendung/[dayType]` refresh and invalid-day recovery.

### Live-state and migration

- No migration or production write is required.
- If authenticated production-shaped proof is requested later, use an isolated synthetic field-test identity and the existing read-only/write-blocked sampler. Do not use a customer session.
- Do not claim payment-provider coverage from synthetic application-state proof.

### Evidence-sensitive review

- Compare implementation screenshots/video against the approved horizontal prototype and transition audit.
- Reject any implementation that animates a skeleton/error as successful progress, moves the Journey header, changes recommendation authority, or makes global navigation directional.

### Implementation evidence — 2026-08-15

- The real Anwendung component is covered by a development-only server-addressable lab, including direct `/labs/personal-plan-application/[dayType]` entry and reload. The overview/day/Back/Forward browser path emits zero RSC requests after the overview is loaded and restores the saved scroll position for each semantic view.
- The Stage 1 browser path proves no Stage 2 request occurs before the CTA, exactly one request begins after activation, and failure retains the Bedarfsplan with retry.
- The shared transition tests cover retained inert outgoing content, semantic forward/reverse direction, stable incoming component identity, focus handoff, per-view scroll restoration, reduced motion, and destination-bound intent consumption.
- Implementation captures are retained beside the approved prototype as `implementation-mobile-detail.png` and `implementation-desktop-detail.png`.
- Verification passed on the final integrated base: 17/17 focused Chromium journeys, 1,596/1,596 Personal Plan tests, TypeScript, lint with four pre-existing warnings and no errors, and the optimized Next.js production build.
- The full `/anwendung` prefetch remains intentional: it exchanges an additional safe read and framework prefetch telemetry for the approved authoritative preload. This cost should be monitored if the Routine CTA becomes visible substantially earlier or application compilation becomes materially more expensive.
- Native history across the two Next.js route segments is covered on Next.js 16.2.4, including direct reload. That framework coupling remains a focused upgrade risk and should be rechecked on a Next.js major/minor upgrade.

## Findings ledger

| ID   | Type                   | Evidence                                                                                                                                                                | Decision | Plan change                                                                                                                                                         | Revalidation                                                                  |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| F-01 | defect                 | Application overview already receives all day steps, while `/anwendung/[dayType]` reruns the full resolver                                                              | accepted | Task 2 requires local history/state and zero duplicate resolver request                                                                                             | Browser network assertion and direct-link test                                |
| F-02 | tradeoff               | Exact horizontal push across every stage would animate truthful server waiting as navigation success                                                                    | accepted | Separate depth, quiet stage, and hold behaviors                                                                                                                     | Slow-target browser test                                                      |
| F-03 | scope/product decision | Stage 3 contains many authority/recovery modes with different semantics                                                                                                 | deferred | No blanket Stage 3 internal animation; only final route handoff is in scope                                                                                         | Confirm no unexpected Stage 3 diff                                            |
| F-04 | tradeoff               | Stage 2 GET uses `gateway.load()` and currently starts only after the Feinschliff CTA; moving it into passive viewing would change request timing without a user action | accepted | Keep the Stage 2 request after the explicit Feinschliff CTA while holding Stage 1                                                                                   | Request-before-CTA test                                                       |
| F-05 | defect                 | In the live `autoHandoff && onHandoff` path, the bridge is unreachable and a full loading shell is returned during Stage 3 bootstrap                                    | accepted | Render the approved bridge hold with pending/error state and use a bounded shared transition container for Stage 3 entry                                            | Bootstrap success/failure and coexistence tests                               |
| F-06 | defect                 | Stage 3 uses `window.location.replace` after completion                                                                                                                 | accepted | App Router replace after receipt validation                                                                                                                         | No-document-navigation test                                                   |
| F-07 | tradeoff               | App Router prefetch has no completion promise and dynamic fallbacks remain possible                                                                                     | accepted | Never use guessed delays; animate successful target mount only                                                                                                      | Throttled navigation test                                                     |
| F-08 | defect                 | `/plan-start` can call the Stage 1 `loadOrCreate` path, so forced full prefetch is not a passive read                                                                   | accepted | Keep default partial Link prefetch and execute the page only after activation                                                                                       | Assert no Stage 1 materialization request caused by rendering Plan Bereit CTA |
| F-09 | implementation risk    | Next globally handles browser history and Anwendung is `force-dynamic`, so Back/Forward could have defeated the zero-refetch guarantee                                  | resolved | Disposable Next 16.2.4 spike proved push/Back/Forward across route segments update `usePathname` with zero RSC requests; retain a real-journey regression assertion | Anwendung browser request trace for all three actions                         |
| F-10 | correctness            | The live Stage 3 flow omits `onOpenRoutine`, making `window.location.replace` the actual completion path                                                                | accepted | Supply the receipt-gated App Router handler from `plan-start-flow.tsx` rather than only changing a fallback in isolation                                            | Valid/invalid receipt and no-document-navigation tests                        |
| F-11 | edge cases             | Anwendung also renders `no_complete_day` and `day_unavailable` shapes, not only the ten-day ready overview                                                              | accepted | Keep non-ready states server-owned and add focused history/deep-link coverage                                                                                       | Single-rest-day and unavailable-day tests                                     |
| F-12 | implementation defect  | A transformed Stage 3 root creates a containing block for its fixed confirmation action                                                                                 | resolved | Use the quiet opacity-only target treatment for Stage 3 while retaining the standard entrance elsewhere                                                            | Computed Stage 3 transform assertion and mobile browser journey               |
| F-13 | implementation defect  | Copying Next's private history state into native Anwendung entries can make `usePathname` reconciliation stale                                                           | resolved | Store only the bounded Anwendung marker and derive selection from the route-aware pathname                                                                          | Push/Back/Forward pathname and zero-RSC browser assertions                     |
| F-14 | implementation defect  | The site-wide `scroll-behavior: smooth` makes `behavior: auto` history restoration asynchronous                                                                         | resolved | Request an immediate scroll restoration before focus handoff and retain a scroll position per semantic view                                                         | Mobile overview/day Back/Forward scroll assertion                             |
| F-15 | implementation defect  | Keying the incoming transition layer by semantic view remounts persistent mobile controls                                                                               | resolved | Keep the incoming layer identity stable and suppress duplicate outgoing-layer controls through transition context                                                   | Component identity and mobile dock/browser assertions                         |
| F-16 | tradeoff               | Full Routine-to-Anwendung prefetch can add a safe application read and telemetry even when the CTA is not activated                                                     | accepted | Retain the explicitly approved authoritative preload while limiting it to a valid Stage 5 CTA; document the residual cost                                            | Prefetch eligibility tests and future performance monitoring                  |
| F-17 | implementation defect  | A fixed Bedarfsplan action bar becomes relative to a transformed transition layer and disappears below the viewport during motion                                      | resolved | Render one current-layer action bar through a body portal and suppress the outgoing duplicate                                                                        | Mobile browser assertion pins one action bar to the viewport during motion    |
| F-18 | implementation defect  | `decodeURIComponent` throws for a malformed Anwendung day segment during client render                                                                                  | resolved | Treat malformed encoding like an unknown route segment and retain the overview/server-owned fallback                                                                 | Render regression with an invalid percent sequence                            |

The first Claude Opus 4.8 review attempt on 2026-08-14 was blocked by the connected account's weekly usage limit before any review content was produced; no fallback model was substituted. The rerun on 2026-08-15 returned **approve with revisions**. Its factual findings were verified against the refreshed repository, F-09 was resolved with the disposable runtime spike, and the accepted revisions are incorporated above. The temporary reviewer output and spike route are discarded.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/application-day-transition`
- Branch: `codex/application-day-transition`
- Baseline: refreshed to `origin/main` commit `23626d7d` before implementation handoff.
- Evidence review: **confirmed**.
- User-journey sign-off: **confirmed by Nick on 2026-08-15**.
- Counterpart plan review: **complete; Claude Opus 4.8 approved with revisions, verified and reconciled on 2026-08-15**.
- Slice 1 and Slice 2 require separate diff/verification checkpoints; Slice 2 must not weaken a Slice 1 no-refetch guarantee.
- Durable plan, prototype, audit, and selected/rejected comparison captures: **commit with eventual PR**.
- Counterpart review output: **discard after findings are reconciled**, unless a specific excerpt becomes necessary evidence.
- No commit, push, draft PR, merge, deployment, migration, production write, or activation is authorized by plan approval alone.
- After user-journey sign-off, hand implementation to `implementation-loop`; it owns test-first execution, `ready-check`, and `request-code-review`.
