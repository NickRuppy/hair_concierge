# Cross-stage Back-navigation consistency

## Outcome and source context

Make Back navigation coherent across Idealplan, Feinschliff, Produkte, Routine, and Anwendung by placing every reversible page/step Back action in the shared top-left journey header. Preserve existing state/write guards and correct the first-Feinschliff return so it goes to the actual Idealplan page the customer came from.

Current inventory:

- Idealplan Optional uses bottom-left `Zur Basis`.
- Feinschliff already uses the shared header correctly.
- Produkte mixes the shared header with inline top-left page Back icons.
- Routine editor uses a bottom `Abbrechen`; Routine sheets/details are overlays with local dismissal.
- Anwendung day uses inline `Alle Tage`; Anwendung overview has no explicit route back to Routine.

## Chosen direction

Variant A, confirmed by Nick: one shared header arrow for every reversible page-like state, including Routine editing and Anwendung day detail. Bottom docks contain forward/decision actions only. True stage roots without a safe parent omit Back. Modal and sheet dismissal remains local. Preserve link semantics where Back is a route: the header contract is `onBack` XOR (`backHref` plus optional anchor click handler), with `backDisabled` available in both modes. Stateful Product Back remains disabled during in-flight writes. Keep the stronger discriminated union so invalid button/link combinations fail at compile time. The shared control uses the confirmed mobile best-practice treatment: a 48×48 CSS px target, 24 px arrow, permanent low-contrast plum surface/border, and the existing `rounded-xl` product radius so its shape matches other compact controls.

## Scope and non-goals

In scope:

- Idealplan Optional → Basis in the shared header.
- Existing Feinschliff header pattern as the canonical reference, with the first question returning to the Stage 1 page that launched it (Optional when present/visited, otherwise Basis).
- Product-kind, capture, role, inventory-review, and fit-review callbacks moved to `Stage3Shell`; existing recovery suppression remains unchanged.
- Routine editor header Back with immediate unsaved-change confirmation in a modal bottom sheet whose body is separately renderable/testable.
- Anwendung overview → Routine as a real header Link; Anwendung day → overview as a header Link whose existing click handler preserves local transition/history semantics.

Non-goals:

- No Routine-overview → Products Back: `/plan-start` is not a safe read-only previous-stage route after completion.
- No Back arrow on Idealplan Basis or Routine overview. Non-ready Anwendung states keep their explicit recovery CTA and do not add a duplicate header Back.
- No clickable progress steps, new router/history model, analytics changes, stage re-opening, or modal/sheet close redesign outside the Routine dirty-confirmation defect and the confirmed first-Feinschliff return correction. The shared arrow is hierarchical Up navigation: on Stages 1–4 it reverses client state while hardware/browser Back may leave `/plan-start`. That divergence is explicitly accepted here; browser-history modeling is a separate larger project.
- The Routine dirty guard covers the new shared header arrow. Browser Back, tab close, and unrelated route changes remain unchanged and are not given a new `beforeunload` guard in this change.
- Keep Product alternative-carousel controls (`Vorherige Alternative`) unchanged; they are not journey Back.
- No containment/safe-area work; that belongs to the separate repair plan.

## Target map

- `src/components/personal-plan-journey/journey-header.tsx`: discriminated callback-or-Link Back rendering, `backDisabled`, anchor click interception, and accessible labels.
- `src/components/personal-plan-journey/chapter-transition.tsx`: inventory the already-canonical Stage 2 invitation and Stage 4 transition header Backs; no relocation is needed.
- `src/components/personal-plan-start/plan-start-flow.tsx` and `need-plan-screen.tsx`: `PlanStartHeader` passthrough, Optional header Back, forward-only footer, and an explicit `FlowStep` return-step handoff to the parent journey.
- `src/components/personal-plan-refinement/refinement-question.tsx` and `refinement-flow.tsx`: canonical question/invitation/resume header behavior and return to the recorded Stage 1 source page.
- `src/components/personal-plan-products/index.tsx`: remove production page Back rendering from `ProductKindReviewScreen`, `ProductCaptureScreen`, `SemanticRoleAssignment`, and fallback `Zurück zur Suche`; delete the uncalled test-only `Stage3Transition` rather than retain an obsolete inline pattern; leave alternative carousel controls untouched.
- `src/components/personal-plan-products/product-fit-comparison.tsx`: remove `Zurück zur vorherigen Prüfung` plus the in-content `Zurück zu meinen Produkten` recovery duplicates; keep both `Vorherige Alternative` carousel controls.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: extend both `Stage3Shell` and the local `shell()` helper with `backDisabled`; pass exact callbacks and existing disabled expressions for product kinds, capture, roles, `Stage3InventoryDispositionReview`, and fit review; pending-recovery screens remain Back-free as today.
- `src/components/routine/personal-plan/routine-editor.tsx`: `min-h-dvh` page wrapper, shared Stage 4 header, remove bottom `Abbrechen`, reuse its guarded cancellation, extract `RoutineDiscardConfirmBody`, and replace the off-screen appended alert with an immediate `role="dialog"` BottomSheet confirmation that restores focus to the header trigger when dismissed.
- `src/components/routine/personal-plan/personal-plan-routine-client.tsx`: preserve editor ownership/mode callback and overlay boundaries.
- `src/components/application/application-page.tsx` and `application-day.tsx`: header Link/click behavior, explicit production/lab Routine destination input, and removal of inline `Alle Tage`.
- `src/app/labs/personal-plan-routine-editor/page.tsx`: gate-protected deterministic Routine-editor fixture used only to prove the dirty Back sheet in a real browser.
- `tests/personal-plan-transition-motion.test.tsx`: update the intentional `data-application-navigation="overview"`/inline-link contract.
- `tests/personal-plan-start.spec.ts`, `personal-plan-mobile-action.spec.ts`, `personal-plan-stage1-2-3.spec.ts`, `personal-plan-stage3-flow.test.tsx`, `personal-plan-stage3-components.test.tsx`, `personal-plan-product-fit-comparison.test.tsx`, `personal-plan-stage4-interaction-ui.test.tsx`, new `personal-plan-routine-editor.spec.ts`, `personal-plan-stage5-view-adapter.test.ts`, and `personal-plan-application-transition.spec.ts`.

## Designed user journey

1. **Idealplan:** Basis is the stage root and has no Back. Optional shows one top-left header arrow labeled accessibly `Zur Basis`; the bottom dock contains only the forward CTA.
2. **Feinschliff:** when no question has yet been completed, the first question's header arrow returns to the Idealplan page that launched it—Optional when the customer continued from Optional, otherwise Basis. Later questions return to the previous question. If a resumed session navigates back from its first unresolved question, it returns to the existing Resume screen; that screen now has the same header arrow to the recorded Idealplan source. The existing invitation and chapter-transition Back remains in the shared header. Existing save and transition behavior is unchanged.
3. **Produkte:** the first product step returns to Feinschliff; later category/role/review states return to their existing reversible product state. Exactly one 48 px header Back is visible and it remains disabled while the corresponding write is in flight. Pending recovery remains Back-free. In-content journey Back duplicates are removed, including the recovery cards whose escape is the accessible header control; retry/forward actions and alternative-carousel arrows remain inside the comparison.
4. **Routine:** overview is a stable root and has no Back. The page-like editor uses a sticky header arrow to return to Routine on mobile and desktop; the footer contains only the primary review action. With unsaved changes, tapping Back opens an immediate modal sheet: `Weiter bearbeiten` keeps edits; `Änderungen verwerfen` clears them and returns. Product detail/proposal sheets keep their local overlay dismissal.
5. **Anwendung:** ready overview has a real header Link back to Routine, supplied as an explicit `routineBackHref` (production defaults to `/routine`; the lab supplies its own fixture-safe destination). A day detail uses the same header location to return to the overview; normal clicks retain local no-request transitions, while modifier/middle-click behavior retains the canonical overview URL. Deep links, reload, browser Back/Forward, focus, and scroll restoration remain intact. Non-ready states keep their explicit recovery CTA without a duplicate header Back.
6. Completion: all page-like reversible states use the same top-left location; roots and overlays follow the documented exceptions, with no duplicate journey Back control.

Overall journey sign-off: **confirmed by Nick on 2026-08-16**, including full coherence across all page-like states, the dirty-editor confirmation, and the clearer 48 px top-left control with the existing button shape.

## Planning evidence

- [Cross-stage Back variants](./artifacts/2026-08-15-cross-stage-back-navigation-variants.html) — Variant A selected and evidence review confirmed by Nick on 2026-08-15.
- [Routine dirty-editor Back confirmation](./artifacts/2026-08-15-routine-editor-back-confirmation.html) — evidence review confirmed by Nick on 2026-08-16.
- [Current inconsistent Back inventory](./artifacts/2026-08-16-current-back-navigation-inventory.html) — reviewed by Nick before selecting full coherence.
- [Mobile Back position and target-size comparison](./artifacts/2026-08-16-back-control-mobile-best-practice.html) — top-left 48 px variant B confirmed by Nick on 2026-08-16; `rounded-xl` retains the existing product shape.

## Ordered tasks

1. **Harden the shared header contract.** Add a discriminated `onBack` XOR (`backHref` + optional `onBackLinkClick`) contract plus `backDisabled`. A route Back renders a real Link; stateful Back remains a button. Increase the permanently reserved symmetric grid slots to 48 px; render a 48×48 `rounded-xl` target with a 24 px arrow, permanent plum-ice surface/border, and distinct hover/pressed/disabled/focus-visible states so arrow appearance does not shift the centered brand. Keep a destination-specific accessible label. Add focused header tests. Completion: link, intercepted-link, callback, disabled, and absent modes are explicit, type-safe, visually aligned, and meet the cross-platform touch-target decision.
2. **Move Stage 1 and correct every Stage 2 return surface.** Extend production-owned `PlanStartHeader` with the Back props. Change `PlanStartFlow` to accept `initialStep?: FlowStep` and `onContinueToRefinement(sourceStep: FlowStep)`; let `PlanStartCustomerJourney` retain `stage1ReturnStepRef`, pass it back as `initialStep` after `onSecondaryExit`, and record it before entering Stage 2. When `step === "optional"`, move the existing reverse-direction + `setStep("basis")` callback into the header and remove footer Back. Add `onSecondaryExit` to `ResumeShell` so resume/invitation/question surfaces all expose the canonical header path while preserving the existing first-unresolved-question → Resume behavior. Inventory the two existing `PersonalPlanChapterTransition` Backs. Update the containment plan's Stage 1 tests from a two-button to a forward-only footer without weakening width/safe-area assertions. Completion: Stages 1–2 match the selected pattern, the brand slot stays stable, and Basis, Optional, fresh-question, resumed-question, Resume, and invitation returns are covered.
3. **Move all production Stage 3 page Back controls.** Grow `Stage3Shell` and local `shell()` with `backDisabled`; route product-kind, capture, role, inventory-review (`Stage3InventoryDispositionReview`), and fit-review callbacks plus their exact current disabled expressions through them. Remove inline page Back controls and fallback/recovery duplicates that perform the same journey navigation. Delete the uncalled test-only `Stage3Transition`; keep pending-recovery suppression, analytics, local-choice restoration, retry/forward actions, and both alternative-carousel controls. Completion: every reversible production state exposes exactly one enabled/disabled 48 px header Back as appropriate and all state-machine/analytics tests remain green.
4. **Move Routine editor Back and fix dirty confirmation visibility.** Give the editor a `min-h-dvh` page wrapper and sticky shared header, remove bottom `Abbrechen`, and route header Back through the existing dirty guard. Extract a statically testable `RoutineDiscardConfirmBody` and render it inside a `role="dialog"` `BottomSheet`; use `Weiter bearbeiten` and `Änderungen verwerfen`, Esc/backdrop keep editing, and restore focus to the header trigger. Add a small gate-protected Routine-editor lab fixture plus `personal-plan-routine-editor.spec.ts` so a 320 px browser test makes an edit, taps Back, and asserts the portaled sheet is immediately visible above the viewport bottom. Keep other Routine sheets/details local. Completion: clean Back returns immediately; dirty Back keeps or discards edits only through the visible modal sheet; Node tests assert the body directly and Playwright proves portal visibility/focus.
5. **Move Anwendung Back while preserving links/history.** Ready overview supplies an explicit `routineBackHref` real header link; production defaults to `/routine`, while the lab passes a fixture-safe value. Non-ready states omit it and keep their recovery CTA. Day supplies the canonical overview href plus the existing `openOverview` anchor handler in the header; remove inline `Alle Tage`. Add ordinary-click, modifier/middle-click, deep-link, reload, Back/Forward, focus, scroll, and zero-extra-RSC coverage. Replace the old transition markup assertion with separate assertions that content remains inside the bounded depth-transition surface while the navigation Link intentionally lives in the stable header. Completion: all link/history contracts stay green.
6. **Verify the full journey.** Run focused component/state tests, the new Routine editor browser spec, Stage 1–3 and Anwendung Chromium journeys, mobile WebKit header geometry where covered, `npm run ci:verify`, then have the Codex main session invoke `.agents/skills/ready-check/SKILL.md` and final whole-tree review. Capture the five-stage mobile walkthrough and classify artifacts.

## Verification

Automated:

- Focused Node suites named in the target map.
- `npm run test:playwright:personal-plan-stage3:journey` for Stage 1–3 and transition coverage.
- The existing `npm run test:playwright:personal-plan-stage3:journey` command owns `personal-plan-application-transition.spec.ts` and supplies its complete gate/environment contract; do not run that file with a bare development-server command.
- Run the new Routine editor Playwright spec through the same gate-protected development-server environment.
- `npm run ci:verify`.

Manual/browser:

- 320×700, 375×667, and 390×844 walkthrough of every journey state listed above.
- Confirm exactly one top-left journey Back when reversible, none on Idealplan Basis/Routine overview, carousel arrows retained, dirty Routine confirmation immediately visible, and Application link/history behavior preserved.

## Review and handoff

- Worktree/branch: `.worktrees/mobile-action-containment`, `codex/mobile-action-containment` from current `origin/main`.
- Execution order: after the containment repair plan in the same worktree; independently reviewable and revertible.
- Counterpart review: completed with Claude Opus/high on 2026-08-15; accepted the missing Stage 1 handoff shape, resumed-Feinschliff path, Stage 3 inventory/disabled seams, chapter-transition inventory, lab-safe Anwendung input, Routine browser owner, and runnable verification correction. Rejected the simpler nullable header API because the XOR prevents invalid states; accepted hierarchical Up versus hardware Back and header-only dirty guarding as explicit scope decisions. The `ready-check` concern was a false positive: the repository owns it at `.agents/skills/ready-check/SKILL.md`.
- Final code review: Claude Opus/high on 2026-08-16 identified three supported defects, all repaired and reverified: the WebKit lab gate is now test-local, header Back links preserve `prefetch={false}`, and Basis-only rendering cannot expose a no-op refinement CTA. The Routine browser spec is now owned by the normal journey command, and Stage 3 Back labels are destination-specific.
- Stop: verified review-ready worktree; no commit, push, PR, merge, deploy, production write, or cleanup.
- Artifacts: plan, HTML evidence, and regression coverage commit; ignored PNG and transient counterpart output discard after review.
