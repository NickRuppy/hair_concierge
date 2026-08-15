# Personal Plan five-chapter mobile transitions

## Outcome and source context

Turn the successful `/plan-bereit` journey overview into the shared chapter transition for all five Personal Plan stages. Each forward boundary shows the same five-stage map with completed, current, and future states; the current chapter changes along with a short heading and one bottom action. At 320 × 700 through 400 × 822, the stages use the available height without page scrolling or a dead lower field.

The earlier shipped plan intentionally placed the journey overview only at `/plan-bereit`. Nick's new direction supersedes that decision: all five chapters should now use this transition pattern.

## Chosen direction

Build one shared, state-driven chapter component rather than five copied page implementations or five new routes. It receives the current stage, title, supporting line, CTA label, and existing callback. The shared journey overview receives `currentStage`: earlier stages render as completed in the Chaarlie plum palette, the current stage is emphasized, and all future stages share one neutral treatment.

Use the chapter only during forward progression. Direct visits and saved-session resumes to `/routine` and `/anwendung` continue to open their content immediately, so customers are not forced through a decorative interstitial every time they return.

## Scope and non-goals

- In scope: responsive chapter layout; completed/current/future stage states; Stage 1 ready entry; Stage 2 invitation; Stage 3 product bridge; Stage 4 routine handoff; Stage 5 application handoff; bottom CTA actions; transition analytics at the existing action boundaries; focused regression and browser coverage.
- Preserve: five-stage order and German vocabulary, existing Personal Plan header/progress semantics, existing route destinations, existing page-transition animation mechanism, loading/error/recovery behavior, Stage 2 back behavior, Stage 3 saved-authority checks, Stage 4 blocking-basis guard, cookie-banner clearance, and all existing data authority.
- No new routes: the Stage 4 chapter appears after Stage 3 reaches `ready_for_routine`; the Stage 5 chapter is a local forward-transition mode triggered from Routine.
- No replay on direct/resume visits: `/routine` and `/anwendung` remain immediate destinations when entered directly or revisited.
- Non-goals: changing recommendation logic, product/routine/application content, API contracts, persistence, migrations, feature flags, desktop content redesign, deployment, or production activation.

## Chapter contract and copy

| Stage | Entry boundary | Heading | Supporting line | Bottom CTA |
| --- | --- | --- | --- | --- |
| 1 Idealplan | successful `/plan-bereit` | `Wir haben deinen Idealplan erstellt.` | `Jetzt machen wir ihn mit deinem Alltag und deinen Produkten wirklich zu deinem.` | `Idealplan ansehen` |
| 2 Feinschliff | first entry into Stage 2 | `Jetzt geben wir deinem Plan den Feinschliff.` | `Ein paar kurze Fragen passen ihn an deinen Alltag an.` | `Feinschliff starten` |
| 3 Produkte | completed Stage 2 bridge | `Jetzt gleichen wir deine Produkte ab.` | `So wird aus dem Idealplan deine konkrete Produktauswahl.` | `Produkte erfassen` |
| 4 Routine | Stage 3 returns `ready_for_routine` | `Deine Produktauswahl steht.` | `Jetzt ordnen wir alles zu deiner persönlichen Routine.` | `Routine ansehen` |
| 5 Anwendung | eligible Routine CTA | `Deine Routine steht.` | `Jetzt zeigen wir dir, wie du alles richtig anwendest.` | `Anwendung ansehen` |

Every variant shows the same five cards and closes with `Für schönes, gesundes Haar.` Past stages use a checkmark, the current stage uses its number and active plum treatment, and future stages use one consistent neutral treatment. No additional eyebrow, status pill, disclaimer, or secondary subtitle is introduced.

## Target map

- `src/components/personal-plan-journey/journey-overview.tsx`: accept `currentStage`, render completed/current/future visual and accessibility states, and distribute rows through available height.
- `src/components/personal-plan-journey/chapter-transition.tsx` plus barrel export: own the reusable full-viewport shell, short hero, journey map, goal strip, fixed mobile action dock, loading/disabled action state, optional back action, and error slot.
- `src/app/plan-bereit/personal-plan-ready-client.tsx`: render the Stage 1 chapter with the existing Idealplan action and readiness behavior.
- `src/components/personal-plan-refinement/refinement-flow.tsx`: replace only the first-entry `InvitationShell` with Stage 2 chapter presentation; preserve resume and load/error shells.
- `src/components/personal-plan-refinement/refinement-bridge.tsx`: render Stage 3 chapter presentation around the existing continue/back/error contract.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: replace the successful automatic routine open with a Stage 4 chapter state; its CTA calls the existing validated `openRoutine`. Keep the existing retry/recovery state when opening fails or a handoff is invalid.
- `src/components/routine/personal-plan/routine-page.tsx` and its owning client only as needed: intercept an eligible forward click into a local Stage 5 chapter mode; its CTA uses the existing marked navigation to `/anwendung`. Direct route entry and back navigation remain unchanged.
- Focused component and Playwright contracts for all five stages, direct-entry bypass, action routing, recovery, no-scroll, and header/CTA visibility.

## Designed user journey

1. After the quiz result is ready, Stage 1 shows the five-chapter map with Idealplan active. `Idealplan ansehen` opens the existing Idealplan content.
2. On first forward entry into refinement, Stage 2 shows Idealplan checked and Feinschliff active. `Feinschliff starten` begins the existing question flow; the existing secondary/back action returns to the Idealplan. A resumed, partially answered refinement skips this chapter and continues at the first unresolved question.
3. After the last refinement answer is safely stored, Stage 3 shows stages 1–2 checked and Product-Check active. `Produkte erfassen` uses the existing preparation request and enters `/plan-start`; while it is working the CTA is disabled, and existing inline errors remain recoverable without losing the saved refinement.
4. After Stage 3 has a valid `ready_for_routine` handoff, Stage 4 shows stages 1–3 checked and Routine active instead of navigating automatically. `Routine ansehen` validates and consumes the same handoff, records the existing open event once, and opens `/routine`. Invalid or failed opens retain the current recoverable `Routine öffnen` state.
5. In an eligible Routine, the existing application action first opens the Stage 5 chapter locally. Stages 1–4 are checked and Anwendung is active. `Anwendung ansehen` performs the existing marked navigation to `/anwendung`. If the Routine has a blocking basis gap, the Stage 5 transition remains unavailable exactly as today.
6. Returning directly to `/routine` or `/anwendung`, refreshing either route, or reopening saved content does not replay a transition. The customer lands on the content she requested.
7. At every chapter, the progress header, two-line-or-shorter heading, five distinct cards, healthy-hair goal, and CTA fit into 320 × 700, 390 × 844, and 400 × 822 without document scrolling. Short phones contract to safe minimums; taller phones distribute extra height across the cards.

## Loading, error, recovery, and navigation states

- Stage 1 readiness loading/error states remain separate from the successful chapter.
- Stage 2 resume/load/save-error behavior remains separate from the first-entry chapter.
- Stage 3 continue pending disables the bottom CTA and announces progress; current inline error text and back-to-last-question action remain available.
- Stage 4 does not appear until the server-provided handoff passes its existing identity and destination checks. Failed navigation keeps the recoverable saved state rather than marking the stage complete locally.
- Stage 5 is only reachable when `canOpenApplication` is true. Back/cancel from the local chapter returns to Routine without changing persisted data; direct `/anwendung` visits bypass it.
- The existing transition marker/animation utility remains the sole route animation mechanism; the shared chapter component does not introduce a second animation system.

## Planning evidence

- `plans/evidence/plan-ready-mobile-fill/chapter-transition-mockup.html?stage=1..5`: responsive real-layout mockup for all five current-stage variants.
- `plans/evidence/plan-ready-mobile-fill/chapter-transition-stage-{1..5}-400x822.png`: exact viewport captures showing progress accumulation, completed/current/future stages, short copy, goal strip, and fixed CTA.
- `plans/evidence/plan-ready-mobile-fill/viewport-fill-320x700.png` and `viewport-fill-400x822.png`: original height-allocation proof.
- `plans/evidence/plan-ready-mobile-fill/production-chapter-board-400x822.png`: fresh production-component captures of all five implemented variants at 400 × 822.
- Decisions answered: use one shared component, show chapters only at forward boundaries, add intentional Stage 4 and Stage 5 handoff taps, preserve direct/resume access, and distribute card height responsively.
- Evidence review: confirmed by Nick on 2026-08-15 after reviewing the five-screen 400 × 822 board.
- User-journey sign-off: confirmed by Nick on 2026-08-15 with “Yes please.”
- Implementation status: complete and verified on 2026-08-15; see `plans/evidence/plan-ready-mobile-fill/verification-receipt.md`.
- Whole-branch review: no blocking findings; see `plans/evidence/plan-ready-mobile-fill/review-receipt.md`.

## Ordered tasks

1. Add focused component tests for the shared chapter state matrix and responsive class contract. Completion: tests distinguish past/current/future stages, current `aria-current`, stage-specific copy/actions, and fluid overview sizing.
2. Implement the shared chapter transition and height-aware journey overview. Completion: all five mockup variants come from one production component, with no duplicated stage map or second animation system.
3. Migrate the existing Stage 1, Stage 2, and Stage 3 entry surfaces without changing their load/resume/error contracts. Completion: callbacks, disabled state, back behavior, and analytics remain wired to their current owners.
4. Add the Stage 4 explicit ready handoff using the existing validated completion object and recovery state. Completion: Stage 3 no longer auto-opens Routine after success; the user proceeds through `Routine ansehen` exactly once.
5. Add the Stage 5 local forward-transition mode behind `canOpenApplication`. Completion: eligible Routine users see the chapter before application; direct/resumed Application users do not.
6. Run focused tests, affected Personal Plan suites, static checks, and browser journeys. Completion: existing authority/recovery contracts remain green and all transition actions reach the same destinations.
7. Capture all five production variants at 320 × 700, 390 × 844, and 400 × 822. Completion: no document scroll, CTA fully visible, heading at most two lines, distinct stage cards fill the available area, and cookie clearance is correct.

## Verification

- Automated: shared journey/chapter component tests; Stage 1 ready-page tests; Stage 2 refinement tests; Stage 3 journey and handoff tests; Routine/Application transition tests; typecheck; lint; `git diff --check`.
- Browser: forward journey through all five chapter transitions; direct/resume bypass at Stage 2, Routine, and Anwendung; Stage 3 continue failure/retry; invalid/failed Routine handoff recovery; Routine blocking-basis guard; back/cancel from Stage 5.
- Responsive: exact measurements at 320 × 700, 390 × 844, and 400 × 822 for all five variants, including page scroll height, card dimensions, CTA visibility, two-line heading maximum, and cookie-banner offset.
- Accessibility: one `aria-current="step"`, semantic ordered list, meaningful progress labels, disabled/busy action state, visible focus treatment, and live error/status announcements.
- No migration, live-state, medical, billing, or production-data checks are in scope.

## Review and handoff

- Branch/worktree: `codex/plan-ready-mobile-fill` in `.worktrees/plan-ready-mobile-fill`, created from fresh `origin/main`.
- After mockup evidence review and explicit journey sign-off, execute through `implementation-loop`, including `ready-check` and `request-code-review`.
- Run one read-only Claude plan review before implementation and one meaningful whole-branch review before publication; Codex verifies all findings locally.
- Artifact disposition: plan, selected HTML mockup, implementation, tests, receipts, and final production captures commit; transient reviewer output and local preview processes discard.
- Stop before commit, push, PR, merge, deployment, or production writes unless separately authorized.
