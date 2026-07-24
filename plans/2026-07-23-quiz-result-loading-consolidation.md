# Quiz-to-result loading consolidation

## Outcome and source context

The production walkthrough after PR #238 exposed a redundant transition between quiz lead capture
and the canonical result route:

1. `QuizAnalysis` runs a three-step animation and waits for
   `MEIN HAARPROFIL ANSEHEN`.
2. The click mounts `QuizResults`, which renders a second
   `Dein Ergebnis wird geöffnet` loading state before redirecting to `/result/[leadId]`.

Outcome: retain one useful personalized analysis/loading moment, then open the result
automatically without an intermediate CTA or visibly different second loader.

## Chosen direction

Keep the existing analysis step and its analytics identity, but make it advance automatically
instead of exposing a reveal CTA. Extract the current analysis UI into a pure presentational child
that can also be rendered by `QuizResults` during its access/redirect checks. The visible screen
therefore remains continuous even though the existing internal step boundary is preserved.

After the analysis presentation completes, `QuizAnalysis` calls the existing `goNext` once.
`QuizResults` then performs its existing access resolution, result-artifact triggering, analytics,
and result-route selection without replacing the analysis UI with another loader:

- non-subscribed or signed-out lead: replace the URL with the canonical result route;
- signed-in lead with access: reveal the existing entitled result/continue experience;
- missing lead or unrecoverable state: replace the loader with the existing explicit recovery UI.

Remove the manual `MEIN HAARPROFIL ANSEHEN` gate and the distinct
`Dein Ergebnis wird geöffnet` and `Wir prüfen deinen Zugang` spinners. Keep the existing analysis
heading, subcopy, and progress-row copy. Do not introduce a second loading component.

## Scope and non-goals

In scope:

- the transition after lead capture and consent;
- ownership and timing of the analysis animation;
- automatic navigation to the canonical result route;
- regression tests for routing, entitlement, analytics, email trigger, and recovery behavior;
- German loading copy shown in the reviewed mockup.

Non-goals:

- quiz questions, answers, lead persistence, or consent behavior;
- result-page storytelling, recommendations, pricing, checkout, or analytics destinations;
- shortening or bypassing required server access checks;
- changing result-email delivery semantics;
- changing the entitled-user `MEINE ROUTINE STARTEN` action;
- adding speculative progress APIs or backend jobs.

## Target map

- `src/app/quiz/page.tsx`
  - no step-order change; retain the `analysis` and `results` funnel identities.
- `src/components/quiz/quiz-results.tsx`
  - render the shared analysis presentation rather than a distinct access/result-opening spinner
    while preserving its current redirect guard, access checks, side effects, entitled-user
    branch, and recovery branch.
- `src/components/quiz/quiz-analysis.tsx`
  - keep timer ownership, automatically call `goNext`, and extract a pure presentational child
    reused by `QuizResults`;
  - accept a continuation/completed mode that disables the entry animation and safely omits the
    name prefix when no name is present.
- `tests/quiz-result-routing.e2e.spec.ts`
- `tests/quiz-onboarding-e2e.spec.ts`
- `tests/auth-intake-routing.e2e.spec.ts`
- `tests/stripe-subscription-e2e.spec.ts`
  - remove the reveal-button interaction and assert automatic routing/reveal.
- `tests/editorial-pages.test.tsx`
  - keep the source-path copy assertion aligned if the progress-row copy moves into a new file.
- focused unit/component tests around the transition readiness gate, destination selection, and
  missing-lead recovery.

## Designed user journey

Actor: a quiz completer who has supplied a name, email, and consent choice.

1. The lead is persisted as it is today.
2. One analysis screen appears:
   - `{NAME}, DEIN PROFIL WIRD ERSTELLT`
   - `Einen Moment noch...`
   - the existing three progress rows.
3. The screen never asks for another click. After the existing checklist animation completes, it
   advances automatically into the access/route-resolution phase.
4. While Chaarlie resolves access and prepares the destination, the same completed analysis visual
   remains on screen. It does not change into `Wir prüfen deinen Zugang` or
   `Dein Ergebnis wird geöffnet`, and it does not replay the entry animation.
5. When the destination is known:
   - the ordinary new lead is taken directly to `/result/[leadId]?entry=quiz_completion`;
   - an entitled signed-in user sees the existing result view and still chooses
     `MEINE ROUTINE STARTEN` to continue to onboarding.
6. If the lead ID is missing or routing cannot become valid, the analysis screen is replaced by
   the existing clear error state with `Ergebnis neu laden`.
7. Completion is the fully loaded personalized result/offer page. No checkout is initiated.

Meaningful variants:

- marketing consent yes/no does not change the transition;
- signed-out and non-entitled users use the canonical result route;
- signed-in entitled users who have just completed the quiz see the same analysis visual during
  the brief access check, then preserve the current access-aware path;
- returning/reloaded invalid state retains explicit recovery instead of looping.
- if a restored transition temporarily has no name, the heading renders without a malformed empty
  name prefix.

## Mockup evidence

- Reviewed artifact:
  [current versus proposed transition](./mockups/2026-07-23-quiz-result-loading-consolidation.html)
- Selected direction: one continuous analysis state followed by automatic result reveal.
- Feedback incorporated: remove the unnecessary intermediate click and consolidate two perceived
  loading screens.
- Mockup review status: **confirmed by Nick on 2026-07-23**.

## Ordered tasks

1. Make the analysis step advance automatically.
   - Preserve the current three-step copy and animation.
   - Replace the exact `MEIN HAARPROFIL ANSEHEN` CTA with a guarded one-shot `goNext` after the
     checklist completes; retain the completed frame for **300 ms** rather than requiring input.
   - Clean up timers on unmount.
   - Completion: fake-timer tests prove one automatic advance, the 300 ms dwell, and no update
     after unmount.

2. Reuse the analysis presentation during route resolution.
   - Extract a pure `QuizAnalysisView` (or equivalent) from the existing component.
   - Render its completed state from `QuizResults` anywhere that currently shows
     `Wir prüfen deinen Zugang` or `Dein Ergebnis wird geöffnet`.
   - Disable `animate-fade-in-up` (or equivalent entry motion) in the continuation render so the
     internal step remount is not visible.
   - Omit the dynamic name prefix when `lead.name` is blank; never render a leading comma.
   - Reuse the existing `resultRedirectRef` and cancelled access-check effect; do not add a second
     redirect state machine.
   - Completion: there is exactly one visual post-consent loading surface in the DOM and no
     re-animation at the internal step boundary.

3. Update browser contracts by path.
   - Remove only interactions with `MEIN HAARPROFIL ANSEHEN`.
   - For signed-out/non-entitled cases, assert automatic canonical routing.
   - For signed-in entitled cases, assert automatic reveal of the existing result view, then keep
     the existing `MEINE ROUTINE STARTEN` interaction for onboarding.
   - Update `editorial-pages.test.tsx` only if extraction changes the file owning the asserted copy.
   - Assert the canonical result URL, `entry=quiz_completion`, retained lead data, and absence of
     `MEIN HAARPROFIL ANSEHEN`, `Dein Ergebnis wird geöffnet`, and
     `Wir prüfen deinen Zugang`.
   - Completion: all affected E2E flows pass for ordinary, authenticated, and subscription cases.

## Verification

Automated:

- focused transition unit/component tests;
- affected quiz result, onboarding, auth-intake, and subscription E2E tests;
- `npm run ci:verify`.

Manual/browser:

- complete a fresh production-like quiz at mobile width with a unique synthetic lead;
- confirm one analysis screen, no manual reveal click, and no second spinner;
- confirm direct arrival at the personalized guided-story result;
- repeat with consent yes/no where practical;
- confirm missing-lead recovery remains actionable;
- confirm no console warnings/errors or horizontal overflow.

Live-state:

- no migration or production-data change;
- after deployment, repeat the fresh-lead production walkthrough without initiating checkout.

## Review and handoff

- Implementation should start in a fresh worktree from `origin/main`.
- Run `implementation-loop`, including `ready-check` and the single routed code review.
- Counterpart plan review: **completed and reconciled**.
- Mockup review: **confirmed**.
- Designed user-journey sign-off: **confirmed** — no button is shown between the completed
  analysis/loading screen and the automatically opened result page. Result-page chapter and
  pricing CTAs remain unchanged.
- Stop before commit/push/PR until implementation verification is complete; merge and deployment
  remain separate authorizations.
- Residual risk: consolidating the UI must not bypass signed-in access resolution or duplicate the
  result-artifact email/analytics effects.
- Rollback: a normal code revert; no runtime feature flag is warranted for this bounded client-side
  transition change.

## Counterpart review findings

| ID  | Type                   | Evidence                                                                        | Decision | Plan change                                                                                                            | Revalidation                          |
| --- | ---------------------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| C1  | defect                 | Entitled users still need `MEINE ROUTINE STARTEN` after analysis                | accepted | Tests are split by anonymous and entitled paths; only the analysis reveal CTA is removed                               | affected auth/subscription E2E        |
| C2  | tradeoff               | Removing the analysis step would drop its funnel event and add draft/store work | accepted | Keep the existing internal steps and `analysis` event; consolidate only the visible surface                            | analytics assertion plus funnel smoke |
| C3  | defect                 | `Wir prüfen deinen Zugang` is a third visible loader                            | accepted | Fold both access-check and redirect-loading branches into the shared analysis visual                                   | component and browser assertion       |
| C4  | tradeoff               | `QuizResults` already has redirect and cancellation guards                      | accepted | Reuse the existing refs/effects; no parallel transition state machine                                                  | focused repeated-render test          |
| C5  | scope/product decision | Mockup proposed new analysis copy without an explicit decision                  | rejected | Keep current heading, subcopy, and progress-row copy                                                                   | existing copy assertions remain       |
| C6  | defect                 | Extracting the progress copy can break `editorial-pages.test.tsx`               | accepted | Add the test to the target map and keep its source assertion aligned                                                   | focused editorial test plus CI        |
| C7  | defect                 | The internal step remount could replay `animate-fade-in-up`                     | accepted | Add an explicit completed continuation mode with entry animation disabled                                              | browser check at the step boundary    |
| C8  | defect                 | Restored state can briefly have an empty lead name                              | accepted | Shared view omits the name prefix when blank                                                                           | focused component test                |
| C9  | tradeoff               | Entitled quiz completers also see the shared analysis during access resolution  | accepted | Treat the analysis as appropriate because they have just completed the quiz; preserve the entitled destination and CTA | authenticated E2E                     |
| C10 | tradeoff               | No runtime kill switch                                                          | accepted | Use ordinary revert-only rollback for this bounded UI change                                                           | PR rollback note                      |

## Implementation receipt

Status: **implemented and verified locally on 2026-07-23; Nick's hands-on walkthrough is pending**.

- The checklist now advances once after its final row has remained visible for 300 ms.
- `QuizResults` preserves the completed checklist while resolving access or routing, without
  replaying entry motion or exposing either retired loader.
- The shared view remains constrained to the effective width of the original quiz column, so the
  internal step change does not cause a desktop layout jump.
- Timer tests cover the three completion steps, the final dwell, one-shot advance, and cleanup.
- Anonymous and signed-in entitled Playwright flows both passed against
  `http://localhost:3491`.
- `npm run test:node` passed all 1,708 tests before the final contained width/timer-test revision;
  the affected focused suite then passed all 18 tests.
- `npm run ci:verify` passed on the final source tree (four pre-existing lint warnings, zero
  errors).
- The final read-only Claude review's two material findings—the desktop width jump and missing
  cleanup test—were fixed and revalidated.
- A broader legacy quiz-to-onboarding persistence test reached the existing onboarding product
  questionnaire, then stalled on its disabled Conditioner-frequency continuation. That downstream
  questionnaire issue is outside this transition; the anonymous and entitled transition paths
  themselves passed their focused E2E coverage.
