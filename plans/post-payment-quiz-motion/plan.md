# Use quiz motion after payment

Status: implemented on 2026-08-28 following confirmed evidence review and designed-user-journey sign-off. Final verification and review receipts are recorded separately. Publication remains unauthorized.

## Outcome and source context

Nick likes the pre-payment quiz transitions and dislikes the large sliding/cut-off transitions after payment. Adopt the existing quiz motion for existing post-payment screen transitions and stage arrivals, leaving the quiz itself unchanged.

Base: `2ae521b5` on `codex/post-payment-quiz-motion`, worktree `.worktrees/post-payment-quiz-motion`. This includes the recent Plan/Feinschliff flow cleanup; do not restore retired chapter flows. Root housekeeping was separately authorized: two local `.git/info/exclude` patterns preserve launch configuration and generated intake images without committing them. All 13 files present at cleanup were verified unchanged by SHA-256.

## Chosen direction

Reuse the existing `personalPlanScreenEnterForward`, `personalPlanScreenEnterBack`, `personalPlanScreenExitForward`, and `personalPlanScreenExitBack` CSS keyframes. Preserve the post-payment React transition component and its scroll, history, focus and portal ownership behavior. Do not transplant the quiz's serialized-DOM mechanism or introduce router-wide transition machinery.

Authoritative motion contract:

| Event                              | Behavior                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Forward screen change              | Incoming opacity 0 → 1, translateX(+8px → 0), 200 ms ease-out; outgoing opacity 1 → 0, translateX(0 → -7px), 160 ms ease-out; simultaneous |
| Back screen change                 | Same timing/fade, reversed translation signs                                                                                               |
| Lifetime and focus                 | Remove outgoing view and focus incoming heading after 200 ms; reduced motion skips retention and focuses without an animation delay        |
| Existing directional stage arrival | Incoming-only quiz fade/+8px over 200 ms; no fabricated outgoing page across a route load                                                  |
| Existing Stage 3 fade arrival      | Keep fade-only entry, shortened to 200 ms; no new internal phase animation                                                                 |
| Reduced motion                     | No animated movement; preserve navigation, saving, scroll and focus semantics                                                              |

Render the outgoing layer absolutely above the transition root so it does not preserve the previous screen's height. Keep the current incoming layer in normal flow. Retain the transition root's existing `overflow-x: clip` for viewport safety: a browser sample of the proposed 8px motion with this removed widened a 390px document to 398px mid-animation. With the small fade and existing content padding, retaining the boundary avoids overflow without bringing back the full-width opaque slide. Verify text, focus rings and shadows within this boundary at mobile/desktop widths. Freeze nested outgoing entrance animations so option cards cannot replay on remount. These adjustments mirror the relevant quiz visual behavior without replacing post-payment state ownership.

Meaningful approach comparison resolved from source: a CSS-only distance change would retain the old lifetime/height behavior; copying the quiz component would replace established scroll/portal contracts. Reusing the keyframes inside the post-payment component, with its lifetime/layout adapted, is the chosen bounded path.

## Scope and non-goals

In scope: Plan Basis ↔ Optional, every Feinschliff question ↔ question (linear and module entries), Anwendung overview ↔ day, and existing post-payment stage-arrival effects in Plan, Feinschliff, Produkte, Routine and Anwendung.

Unchanged: question copy/order/branching; progress; answer persistence; optimistic save and failure recovery; route history/deep links; stage/module eligibility; portal ownership; product capture and recommendation logic; billing/auth; checkout and product-detail overlays; quiz/result/offer behavior. No new animation for previously immediate product-phase swaps, saved/loading status changes, Routine editor swaps, or network loading/error shells. Those are separate interactions, not existing sliding transitions. No database, provider, analytics, deployment or production writes.

## Target map

- `src/app/globals.css`: keep quiz rules/keyframes untouched; replace post-payment depth selectors with the quiz keyframes; remove obsolete depth keyframes; adjust outgoing layout and nested animation freeze; retain viewport clipping and update stage arrival rules. The existing reduced-motion rules already cover these layers/classes and must remain unchanged unless verification identifies a real gap.
- `src/components/personal-plan-journey/view-transition.tsx`: use semantic variant `quiz` (only supported variant), lifetime 200 ms; preserve scroll snapshot/restoration, sequence-safe cleanup, initial-mount focus, `aria-hidden`, `inert`, outgoing context and history-restoration ownership.
- `src/components/personal-plan-journey/stage-entrance.tsx`: change the `220` timer at line 39 to `200` with the CSS entry duration/distance; preserve destination-bound, single-use intent and direct-load behavior.
- Stage-arrival viewport boundary: clipping must be on a stationary outer wrapper, not the translated element. Wrap the existing ref-bearing animated element in `PersonalPlanStageEntrance` with a simple `overflow-x: clip` boundary; do the same around the locally animated Stage 2 wrapper in `refinement-flow.tsx`. Keep the Journey header and body-portal action outside the moving element. This is required by measured 398px stage-entry overflow at a 390px viewport, not a new routing abstraction. Stage 3's opacity-only entrance needs no translation boundary change.
- Consumers: `src/components/personal-plan-start/plan-start-flow.tsx`, `src/components/personal-plan-refinement/refinement-flow.tsx`, `src/components/application/application-page.tsx`; change variant only, without changing workflow state handling. Update the development `src/app/labs/personal-plan-view-transition/programmatic-transition-lab.tsx` consumer too.
- Existing Stage 3 shell (`personal-plan-products/index.tsx`) already uses the stage-fade class; no new state transition wrapper.
- Existing transition/browser tests listed below; update old variant expectations without weakening the surrounding assertions.

Selector contract: post-payment layers expose `data-transition-direction="forward" | "reverse"`, not the quiz's `data-personal-plan-transition-direction="forward" | "back"`. New post-payment rules must keep targeting `.personal-plan-view-transition-incoming/-outgoing[data-transition-direction=...]` and map `reverse` explicitly to the existing Back keyframes. Do not copy the quiz selectors verbatim. The variant changes to `quiz`; direction tokens do not change.

## Designed user journey

1. A customer enters their Plan after payment, or resumes a saved module. Where a stage already animates in, its content fades in with the small quiz movement; direct loads retain existing initial-mount rules. Header/navigation remains in its current place.
2. On Plan subpages, Next and Back use the short overlapping quiz fade. Cards, choices and next destinations do not change.
3. In Feinschliff the customer selects an answer and taps Weiter. The next question appears with the short fade while the answer saves as before. The mobile action stays attached to the viewport; only one active action exists. The customer may use the next question according to the existing save guards.
4. Back reverses the small movement, restores the previous answer and recorded scroll position, and focuses the visible heading. A new question starts at its existing top position. Long → short and short → long changes must not leave an old-height gap or introduce clipping/scrollbars.
5. Save failure continues to return to the submitted question with the existing error and retry. No error/loading content is treated as a successful new stage. Successful module completion returns to the existing destination; no new screen or waiting period is added.
6. Existing entries into Produkte/Routine/Anwendung use the aligned short entrance behavior. Produkte keeps its fade-only stage arrival and existing internal content swaps. Anwendung day opening and Back use the same small bidirectional fade, with deep links and browser history intact.
7. Desktop keeps the existing inline action placement. System reduced-motion settings suppress animations without changing answers, navigation, focus or availability.

Journey sign-off: confirmed on 2026-08-28 after the preview and final walkthrough, including stage arrivals. Nick: “Yeah it's definitely better in the proposition, like in the quiz. Let's do that.”

## Planning evidence

Question: does the quiz's small overlapping fade remove the disliked full-width/cut-off effect in the actual refinement layout, with its stable header, mobile action and long content?

Shape: interactive UI prototype. Static screenshots alone cannot demonstrate the motion difference. Decision criterion: Nick can compare forward/back on identical fixture questions and confirms the proposed motion and above scope.

- Reviewed development URL: `http://localhost:3750/labs/post-payment-quiz-motion` (retired after approval). Actual implementation can be exercised at `/labs/personal-plan-stage-2?scenario=module-products` on the same task server.
- Durable prototype source: [archived prototype source](./prototype/motion-preview.tsx.txt), retained as text alongside the archived development-only route; neither is part of production compilation.
- Current source captures and proposed view: `evidence/` (screenshots are decision context, not timing proof). The [short video](./evidence/motion-demo.webm) shows current then proposed forward/back. Use the top-right Quiz-Stil/Aktuell menu to switch styles on the same real screen, replay forward/back or stage entry, or restart. No iframe embedding or security-header changes.
- The preview uses the existing Stage 2 in-memory gateway; it makes no customer-data writes. Proposed CSS references the real quiz keyframes and renders the real RefinementFlow.
- Prototype limit: the existing JS focus/retention timer still runs for 360 ms, even though the proposed visual animation finishes at the new timing. Production implementation must rewrite the lifetime to the contract and verify it. The preview's reduced-motion toggle simulates the visual setting, not full accessibility proof.
- Browser exploration: proposed forward/back and current/proposed switching work in Chromium; settled 390px mobile and 1280px desktop widths have no overflow and mobile has one action. A mid-animation check found 398px overflow when clipping was removed; the prototype and plan now retain that safety boundary and passed a six-case Chromium/WebKit recheck at widths 375/390/1280, including reduced motion. See [verification receipt](./evidence/verification.md).
- Evidence-review status: confirmed on 2026-08-28. Nick reviewed the in-app motion preview and selected the quiz-style proposal; no further design correction requested.

## Ordered tasks

### 1. Replace shared post-payment screen motion

Consumes: existing quiz keyframes and current post-payment state/scroll/portal component. Produces: `variant="quiz"` behavior matching the authoritative contract for all three production consumers and the programmatic lab.

Extend `tests/personal-plan-transition-motion.test.tsx` and `tests/personal-plan-application-transition.spec.ts` first with meaningful motion/lifetime assertions plus existing scroll/history/focus checks. Implement the CSS/component/consumer changes as one coherent slice. Do not alter quiz keyframes. Preserve outgoing isolation and ensure nested entry animations do not replay. A transition replaced mid-flight must not let stale cleanup clear the new view or steal focus.

Completion: forward/back browser checks demonstrate the actual quiz keyframes, outgoing invisibility by its exit endpoint, retention cleanup and heading focus at the contract lifetime, and no motion under reduced motion. The outgoing layer does not determine document height. Header/CTA remains singular and usable.

### 2. Align existing stage arrivals and verify the complete scope

Consumes: task 1 contract/keyframes. Produces: existing stage-arrival classes and intent cleanup aligned with that contract, without adding stage/route transitions where none existed.

Extend the natural stage-arrival coverage in `tests/personal-plan-stage1-2-3.spec.ts` and transition tests as needed; preserve one-use/destination intent. Verify direct URL loads, refreshed pages, local module entry and real route entry separately. Entry into Stage 3 stays fade-only. Remove obsolete motion selectors/keyframes and update their tests/callers.

Completion: affected arrivals use the chosen motion once, browser reloads do not fabricate an old page, and successful/failing handoffs retain their existing behavior.

The stationary stage-entry boundary must pass intermediate-frame overflow and action geometry checks. Clipping the translated element itself is insufficient; the prototype's initial stage replay measured 398px at a 390px viewport before the stationary-boundary correction.

## Verification

Automated checks during implementation:

- Existing `tests/personal-plan-transition-motion.test.tsx` and `tests/personal-plan-stage2-refinement-ui.test.tsx` with focused new assertions where behavior changed; use repository test runner and fixtures.
- Browser: `personal-plan-application-transition.spec.ts`, `personal-plan-stage2-refinement.spec.ts`, `personal-plan-stage1-2-3.spec.ts`; extend rather than duplicate the suite. Include Plan Basis/Optional coverage in the existing appropriate suite.
- Regression: `legacy-quiz-motion.spec.ts` and `personal-plan-mobile-action.spec.ts` to confirm the source quiz and viewport action contracts remain unchanged.
- Chromium and WebKit: forward/back, long/short screens, mobile widths 375/390, desktop 1280, normal/reduced motion; check intermediate and settled geometry, exact one visible mobile action, no horizontal overflow, no old-height tail, and no focus on outgoing content.
- Exercise normal selection, slow save, save failure/retry, rapid navigation allowed by current guards, programmatic navigation, browser Back, scroll restoration, and direct/reloaded Anwendung day URLs. Do not manufacture payment/auth state.
- Typecheck (non-incremental when producing a clean verification receipt), changed-source lint, formatting, relevant tests and `git diff --check`; run repo `ready-check` and its required final `request-code-review` through implementation-loop.

Manual checks: Nick reviews the comparison, including forward/back and long content; implementation gets fresh rendered browser evidence in actual affected Labs flows. Distinguish visual/fixture proof from authenticated production/payment proof. No production verification is required or implied for a motion-only change.

## Review and handoff

- One read-only terminal counterpart plan review via `claude-plan-review`, effort high, outside the repo. Reviewer must not edit files or dispatch another reviewer. Codex verifies findings; scope/risk tradeoffs remain owner decisions.
- Counterpart review completed on 2026-08-28 using Claude Opus 4.8, high effort. Verdict: approve with revisions. It reviewed the earlier draft before the independently measured clipping correction; that correction and the verified findings below are now incorporated. No new architecture or second review pass was needed.
- User evidence review and designed-journey sign-off: confirmed on 2026-08-28. Execute through implementation-loop; stop before publication.
- Scope rationale: the current user request is applied to existing screen and stage-entry motion, not expanded into a new global router or product workflow redesign.
- Risks: old-vs-new height ownership may affect scroll clamping; animation changes can expose transformed-ancestor CTA issues; retained React trees can restart nested animations; browser focus timers must remain sequence-safe. These are explicit browser acceptance checks above.
- Artifact disposition: commit this plan, the planning source, and selected before/after screenshots as durable decision evidence; add narrowly scoped image allow-rules to an evidence-local `.gitignore`. Discard the temporary `src/app/labs/post-payment-quiz-motion` route before production readiness, keeping the reproduction instructions/source in plans. Discard scratch browser scripts and temporary review output after the verified finding summary is recorded. Never promote prototype CSS directly to production.
- Publication: not authorized. No commit/push/PR/merge/deploy/production action until its own user gate.

### Verified findings ledger

| ID  | Type                                   | Evidence                                                                                 | Decision                         | Plan change                                                                                     | Revalidation                                                                                                                        |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R1  | defect / instruction precision         | Actual dev consumer is under `src/app/labs/...`, not a components-relative path          | accepted                         | Exact path supplied above                                                                       | Source verified; consumer passes `variant="depth"` at line 31                                                                       |
| R2  | defect / implementation trap           | Layer attributes are `data-transition-direction` and reverse token is `reverse`          | accepted                         | Explicit selector/token map above                                                               | Verified in view-transition.tsx lines 193/209; preview uses correct mapping and browser sees expected keyframes                     |
| R3  | defect / coupled values                | Stage-entrance cleanup literal is 220                                                    | accepted                         | Exact timer and synchronized CSS change named                                                   | Source verified at stage-entrance.tsx:39                                                                                            |
| R4  | tradeoff superseded by measured defect | Removing clipping widened 390px to 398px during animation                                | accepted: keep existing boundary | Plan/prototype retain clipping; no user scope change                                            | Six browser/viewport checks pass after correction                                                                                   |
| R5  | scope/product decision                 | Aligning existing stage arrivals is wider than replacing the three large-slide consumers | accepted by Nick                 | Explicitly included in journey, preview replay, and final confirmation request; not implemented | Confirmed by Nick after the preview and final journey walkthrough on 2026-08-28                                                     |
| R6  | scope / unnecessary work               | Existing reduced-motion selectors cover layers and stage classes                         | accepted                         | Preserve current rules; add none speculatively                                                  | Browser-emulated reduced motion passed in Chromium/WebKit                                                                           |
| R7  | false-positive claim                   | Reviewer described mobile fixed CTA as a descendant of the transformed layer             | rejected                         | Preserve portal contract and test it; no speculative CTA rewrite                                | refinement-question.tsx:697 portals to document.body and line 673 omits outgoing dock; browser has exactly one mobile portal action |

Subsequent local finding R8 (defect, accepted): stage entry also widened 390px to 398px because the whole clip-bearing wrapper moved. The plan now specifies a stationary outer boundary; the prototype demonstrates that correction. This needs actual route/local-entry verification in production implementation. The stage-arrival scope was subsequently confirmed by Nick on 2026-08-28.

Transient Claude report was summarized here and is discarded after verification. Do not treat the review or fixture checks as final production code approval.

## Implementation outcome

- Reused the unchanged quiz keyframes in Plan Basis/Optional, Feinschliff questions, Anwendung overview/day and the programmatic transition Lab. Incoming/cleanup/focus now use 200 ms; outgoing uses 160 ms. Reverse maps to the existing Back keyframes.
- Existing shared and local stage arrivals use the same 8 px / 200 ms entrance inside stationary horizontal clipping boundaries. Stage 3 keeps its opacity-only arrival, shortened to 200 ms. No new transition triggers were introduced.
- Outgoing layers are absolute, inert, hidden from assistive technology and omitted from mobile portal ownership. Nested outgoing animations are frozen. The existing scroll snapshot, sequence cleanup, history ownership, reduced-motion and focus paths are preserved.
- During implementation, an additional browser guard proved that absolute positioning alone still left a document-height tail: 2,424 px during the transition vs 1,224 px afterward. The outgoing layer is now bounded to the incoming container height with `max-height: 100%` and `overflow: clip`; document height is 1,224 px both during and after. This completes the approved no-old-height-tail requirement without changing incoming content layout.
- The temporary comparison route is removed. Historical source and reproduction limitations remain in `prototype/`; inspect the actual implementation at `/labs/personal-plan-stage-2?scenario=module-products`, `/labs/personal-plan-start`, and `/labs/personal-plan-application`.
- Fresh rendered evidence is distinct from the planning preview: `evidence/implementation-matrix.json`, `evidence/implementation-local-entry.json`, and `evidence/implemented-frequency-mobile.png`. The screenshot hides only Next.js development chrome.
- Verification covers fixture/component behavior, not authenticated production access, real payment providers or webhooks. No production writes were performed.
