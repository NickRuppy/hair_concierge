# Organic quiz mobile parity

## 2026-08-05 approved parity expansion

Nick reviewed the implemented mobile pass against the Personal Plan quiz and approved expanding this task beyond the original narrow mobile scope. This section overrides the older non-goals and target statements below where they conflict.

The regular quiz now keeps its existing compact header/progress and question inventory while adopting the newer quiz's equivalent interaction patterns:

- replace the desktop split screen with one centered question column;
- use the newer elevated standard option cards and multi-select controls, including the fixed mobile action, selected-count label, and arrow;
- retain the scalp progressive-disclosure question and treatment descriptions;
- personalize goals by selected texture and read goal and concern choices from the shared Personal Plan option sources;
- remove motivation/feedback copy from equivalent question screens;
- map browser/system Back to the previous quiz screen, including in-place scalp phases;
- silently restore a valid same-browser local draft at its exact saved screen instead of showing a resume prompt;
- replace the consent sheet with the newer quiz's full in-flow yes/no choice while preserving the same consent value and submission behavior;
- replace the old portrait/checklist preparation view with a smooth percentage and `Heute` / `Nach 7 Tagen` / `Nach 4 Wochen` timeline, while preserving the existing readiness wait and minimum dwell;
- preserve the previously approved result/offer behavior and every existing answer property, submission, computation, attribution, and checkout contract.

Concern harmonization uses `getConcernOptions(texture)` as the single UI source, keeps `hair_damage` and `frizz_flyaways` separate, removes `Nichts davon`, and retains `Etwas anderes` as a 120-character free-text note. The linked concern task `019f705d-2020-7020-8f8f-00cb99d1fb34` owns the shared addition of `hair_loss_or_thinning` and its complete normalization, assessment, profile, storage, and projection contract; once that shared source lands, the option appears in this regular screen without another UI fork.

Expanded acceptance evidence includes centered desktop geometry, new card and action styling, forward transition/progress behavior, browser Back, silent local resume, full consent, preparation/loading, texture-aware goals and concerns, Chromium and mobile WebKit coverage, reduced motion, and preservation of the offer handoff. The stop point remains a local review-ready preview; commit, push, PR, merge, deployment, and production writes remain separate approvals.

## Outcome and source context

Apply the already-shipped mobile presentation rules from the Personal Plan quiz to the regular `/quiz` flow where the two journeys have equivalent interaction needs. The source comparison was performed on production at 390 × 844 on 2026-08-04:

- fresh regular quiz first image question: the existing 93.5px info strip is present, the full instruction is unchanged, the first card row ends at about 684px, and the second row ends at about 962px;
- after the info strip is dismissed, the second card row still ends at about 849px, just outside the 844px visual viewport;
- regular treatment step: the first explicit `Weiter` action is ordinary document flow at approximately `top = 848px`, below the 844px viewport;
- Personal Plan multi-select: the visible action stays at approximately `top = 784px`, inside a fixed viewport footer, while the option list scrolls behind it;
- Personal Plan mobile source uses a body portal for bottom actions to avoid transformed transition ancestors, with Safe Area padding and a desktop inline counterpart.

Planning contract:

- Outcome: mobile users can see the complete first image-choice set and always reach explicit multi-select actions without hunting below the fold.
- Constraints: preserve all questions, answer/property values, normalization, persistence, scoring, lead capture, analytics, result computation, offer behavior, and desktop content.
- Non-goals: no new stage header, intermediate screen, copy rewrite, form/consent redesign, Personal Plan change, offer-page change, or production deployment.
- Done when: the reviewed target is implemented and verified at 390 × 844 and 375 × 667 in forward/back motion, normal and reduced-motion modes, with no hidden last option, duplicate accessible action, horizontal overflow, or desktop regression. At 390 × 844, all four texture choices fit with the existing info strip and complete production instruction present; at 375 × 667 the complete set may scroll.

## Chosen direction

Use the Personal Plan mobile rules only at equivalent seams:

1. Compact only the regular quiz's true `grid` image cards on mobile so their image, label, and selection control match the newer quiz's first-frame density. Hide the descriptive line below `sm`; keep it unchanged on larger screens and available through the existing accessible description. Do not apply this rule to the `thumbnail` thickness question, whose visible descriptions are the discriminator.
2. Center and tighten mobile question titles/instructions, as requested in the mobile-parity brief, while retaining the current left-aligned desktop layout. Keep the existing info strip and full question copy unchanged.
3. Add one regular-quiz mobile bottom-action component using the proven `createPortal(..., document.body)` pattern. Mobile and short-height views get the fixed, Safe-Area-aware action; ordinary desktop keeps the existing inline action.
4. Apply it only to the existing primary multi-select actions: chemical treatment, concerns, and goals. Motivation and the concerns `Nichts davon` recovery remain in document flow. A dedicated clearance element is rendered as the final flow child so the footer never covers the end of the screen and its height stays stable.
5. Keep progress, back navigation, transition direction, and 260ms selection timing unchanged.

This is the middle scope between two rejected extremes: CTA-only would leave the first-frame image question visibly denser than the newer quiz; a full Personal Plan header/stage-rail transplant would change the regular flow's identity and information architecture without solving an observed problem.

## Scope and non-goals

In scope:

- mobile typography/spacing for the regular question surfaces;
- mobile image-grid density for texture and hair-length choices;
- the existing mobile info strip, full question text, and visible thickness descriptions;
- portaled sticky actions for treatment, concerns, and goals;
- bottom scroll clearance, Safe Area handling, and mobile/desktop visibility boundaries;
- focused mobile geometry, first-frame, accessibility, motion, and desktop regression tests.

Out of scope:

- question, option, answer-property, and computation changes;
- lead name/email/consent layout changes;
- scalp progressive-disclosure behavior changes;
- preparation/loading and result/offer changes;
- tracking, cookies, checkout, billing, or migrations;
- changes to `src/components/personal-plan-quiz/**`.

## Target map

- `src/components/quiz/quiz-mobile-bottom-action.tsx`
  - add the hydration-safe desktop-inline/mobile-portal action primitive with stable `data-quiz-bottom-action` attributes;
  - intentionally duplicate the small client-ready portal seam instead of extracting the module-private Personal Plan implementation and changing that shipped flow;
  - keep the fixed footer through the regular shell's `md` split at 768px, and on short-height views below 701px; constrain it to the right-hand quiz column at `md+`, keep its inner width aligned to the regular shell's 540px content width, and reserve Safe Area-aware scroll padding on the document scroller while it is active.
- `src/components/quiz/quiz-question.tsx`
  - use the bottom action for the treatment multi-select, apply the reviewed mobile title/instruction density, and place clearance after motivation.
- `src/components/quiz/quiz-concerns-question.tsx`
  - portal only the primary action; keep the none-of-these recovery and motivation in flow, then place clearance last; preserve desktop order and custom-note validation.
- `src/components/quiz/quiz-goals.tsx`
  - use the bottom action without changing selection behavior or goal copy, with clearance after the final motivation.
- `src/components/quiz/quiz-option-card.tsx`
  - match Personal Plan mobile card density only when `visualLayout === "grid"`; hide grid descriptions visually below `sm` while retaining accessible descriptions; leave `thumbnail` and `row` descriptions visible.
- `src/app/quiz/quiz-shell.tsx`
  - match the newer quiz's narrow-screen content padding on question surfaces while preserving the existing lead-capture and preparation spacing, desktop panel width, and desktop spacing.
- `tests/legacy-quiz-mobile-action.spec.ts`
  - add 390 × 844, 375 × 667, and 1280 × 700 geometry coverage, including the info strip/full instruction, short-height grid density, thumbnail-description visibility, treatment/concerns final-content clearance, explicit textarea focus, saved-note Back behavior, column containment, forward/back transition, and one accessible action.
- `playwright.config.ts`
  - include the new geometry spec in the existing iPhone/WebKit mobile-action project so Safe Area and visual-viewport behavior are not Chromium-only.

## Designed user journey

1. A visitor enters the regular quiz on a narrow phone, either fresh or from the existing resume prompt.
2. On the first image question, the existing info strip and complete instruction remain. The heading and instruction are visually centered and compact; all four texture choices are visible in the first 390 × 844 viewport. Each choice keeps the same image, label, accessible description, selection value, and 260ms auto-advance. On a 375 × 667 phone the cards use the newer quiz's short-height density and the options scroll normally.
3. The thickness thumbnail question keeps its visible explanatory text on mobile.
4. Ordinary single-select questions continue to advance immediately and show no fixed bottom action.
5. On treatment, concerns, and goals, the primary action remains attached to the usable viewport bottom above the device Safe Area. It begins disabled under the current rules and becomes enabled after a valid selection or note.
6. The user can scroll the complete option list behind the action. Motivation and the concerns recovery stay in the scrollable content, and final-child clearance ensures every element can be brought fully above the footer. Opening the concerns note does not change footer height.
7. Forward/back transitions move only question content; the fixed action does not jump with the animated layer, duplicate, or trap focus. Reduced-motion behavior remains quiet.
8. Name, email, consent, preparation, result, offer, and desktop layouts behave exactly as today.

There are no new error, loading, empty, or completion states. Existing draft recovery, email correction, optional consent, and none-of-these recovery behavior remain the fallbacks.

User-journey sign-off: **confirmed by Nick on 2026-08-05** — implement the newer quiz's mobile best practices directly, including the compact first frame and fixed bottom action.

## Planning evidence

- Rendered current/target comparison: `plans/mockups/2026-08-04-organic-quiz-mobile-parity.html`
- Production measurements: with the 93.5px info strip present, texture card rows end at about 684px and 962px; after dismissal the second row still ends at about 849px. The regular treatment action begins at about 848px. The Personal Plan viewport action occupies approximately 784–832px.
- Decision answered: whether to port only the sticky CTA or the complete observed Personal Plan mobile density pattern.
- Selected direction: compact first-frame image grid plus sticky explicit multi-select actions; no header or flow redesign.
- Evidence review: **confirmed by Nick on 2026-08-05**; no further standalone mock-up iteration requested.

## Ordered tasks

1. Add failing mobile first-frame and action-geometry browser tests.
   - Keep the current production measurements above as planning evidence, not as a committed permanently failing assertion.
   - Add the target oracle for full texture-option visibility at 390 × 844 with the info strip and full instruction present, visible thumbnail descriptions, exactly one visible/actionable footer, final-content clearance, and fixed placement at 390 × 844 and 375 × 667.
   - Reuse the geometry invariants from `tests/personal-plan-mobile-action.spec.ts`: footer outside the transition root, action bottom aligned to the visual viewport, and one visible action.
   - Complete when the target assertions fail before production changes for the expected geometry only.
2. Add the shared mobile bottom action.
   - Duplicate the Personal Plan hydration-safe body-portal seam with regular-quiz data attributes, Safe Area padding, a 540px inner width, and a desktop inline copy.
   - Switch from fixed to inline at the regular shell boundary (`min-width: 768px` and `min-height: 701px`).
   - Complete when only one copy is visible and accessible at every breakpoint and during transitions.
3. Apply the action to the three equivalent multi-select surfaces.
   - Treatment retains its current selection/normalization and `Weiter` behavior.
   - Concerns portals only the primary action; its none-of-these recovery, note editor, and motivation stay in flow, and custom-note validation is preserved.
   - Goals keeps current texture-dependent options and selection tracking.
   - Put mobile clearance after the last flow child on every screen, not inside the action component.
   - Complete when the existing answers and navigation tests remain unchanged, the footer height is stable on concerns, textarea focus remains usable, and the mobile geometry tests pass.
4. Apply the reviewed compact mobile presentation.
   - Center/tighten mobile headings and instructions across question surfaces without changing copy or the info strip.
   - Compact only `grid` image cards below `sm`, keep their descriptions visually present at `sm+`, retain accessible descriptions on mobile, and leave `thumbnail` descriptions visible.
   - Complete when all four texture options fit the 390 × 844 first viewport, 375 × 667 remains usable by scrolling, and desktop matches the existing content density.
5. Run the implementation readiness and review gates.
   - Exercise fresh/resume, forward/back, treatment, scalp, concerns, goals, lead capture, preparation, and result handoff at narrow mobile size.
   - Run focused tests, `npm run ci:verify`, `ready-check`, and `request-code-review` with one read-only Claude whole-branch review.
   - Complete when no supported blocking finding remains on one canonical fingerprint.

## Verification

Automated:

- new Chromium and iPhone/WebKit mobile geometry/first-frame spec at 390 × 844 and 375 × 667;
- existing legacy quiz motion and email-deliverability browser specs;
- relevant legacy quiz Node/static tests;
- full `npm run test:node`, typecheck, lint, and production build according to `ready-check` scope.

Manual/browser:

- fresh and resumed entry;
- texture first frame, thickness thumbnail, hair-length grid;
- treatment disabled/enabled footer and final option clearance;
- concerns with selections, custom note focus/keyboard interaction, and none-of-these recovery;
- texture-dependent goals;
- forward/back during the 200ms screen motion;
- reduced motion;
- 390 × 844, 375 × 667, short-height landscape, and ordinary desktop;
- keyboard-open name/email behavior remains unchanged, and focused concerns notes stay usable with the fixed action;
- no horizontal overflow, duplicate accessible footer, hidden content, console errors, or transformed fixed-position containment.

Rollout:

- no feature flag or kill switch: this is a bounded CSS/layout change with no schema or behavior fork, so rollback is the exact PR revert;
- release timing remains a separate ship/merge decision after current production health is checked; this plan does not bundle unrelated checkout work.

Live state:

- production is a read-only current-state reference;
- no migration, production write, activation, merge, or deployment is authorized by this plan.

## Review and handoff

- Branch: `codex/organic-quiz-mobile-parity`
- Worktree: `.worktrees/organic-quiz-mobile-parity`
- Evidence review: confirmed 2026-08-05
- Designed-journey sign-off: confirmed 2026-08-05
- Counterpart plan review: complete and reconciled; accepted the grid-only description gate, final-child clearance, stable concerns footer, WebKit coverage, and production-faithful evidence. Rejected the suggestion to remove mobile centering because the user explicitly requested parity with the newer quiz, and rejected the claim that `ready-check` / `request-code-review` must be npm scripts because they are repository workflow skills.
- Counterpart code review: complete; its supported short-desktop footer, saved-note focus, document-scroll-padding, formatting, and boundary-coverage findings were fixed and reverified. The WebKit project remains an explicit local automated lane rather than an unclaimed CI guarantee.
- Artifacts: plan and rendered HTML comparison intend to commit; browser research tabs and transient review output will be discarded.
- Stop point: verified review-ready branch after evidence review, implementation, counterpart reconciliation, and explicit journey sign-off; no publication implied.
