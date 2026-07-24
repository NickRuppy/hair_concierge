# Quiz result preparation and portrait reveal

## Outcome and source context

The first loading-consolidation implementation removed the reveal button but retained the internal
step change from quiz analysis to quiz results. Because `QuizShell` uses different layouts for
those two steps, the transition still visibly flickers even when both steps render similar inner
content.

The replacement should keep one stable preparation surface after consent, perform the real
result-preparation work there, and reveal a user-controlled button only when the destination is
known. Clicking the button opens the final result directly without mounting an intermediate
results loader.

Source artifacts:

- rejected first iteration:
  [loading consolidation plan](./2026-07-23-quiz-result-loading-consolidation.md)
- selected visual direction:
  [personalized portrait reveal](./mockups/2026-07-24-quiz-result-preparation-redesign.html)

## Chosen direction

Use **A · Persönlicher Reveal**.

After the lead endpoint succeeds, keep the user on quiz step 10 and render one stable preparation
screen in the existing quiz shell. During this screen:

- resolve the same texture/length/treatment portrait asset used in Chapter 1;
- settle the client auth session and existing signed-in access check;
- record `quiz_completed` once;
- start best-effort result-artifact delivery;
- prefetch the canonical result URL for the stored lead.

The screen uses a short progressive reveal, but it does not pretend that an external AI analysis
is running: `/api/quiz/analyze` is retired and the result is deterministically derived from the
quiz answers. Once the lead ID exists, the client auth/access check has settled, the canonical
destination is available, and the minimum visual sequence has completed, the state changes in
place to `Deine Haaranalyse ist bereit` and reveals `Meine Haaranalyse ansehen`.

The button navigates directly from step 10 to
`/result/[leadId]?entry=quiz_completion`. It must not call `goNext()` or mount the step-11 shell
first. The result route remains responsible for server-side lead loading, authenticated-access
resolution, funnel attribution, and rendering either the guided-story offer or the entitled
result. Retake state and its safe `returnTo` destination must be threaded through the result route
so an entitled retake still returns to the originating profile flow.

The result route still performs the final server-side auth/access validation after the click. The
client-side preparation check is a readiness and UX signal, not a security boundary. No separate
loader is shown while this final validation completes.

The client-side access check is bounded to five seconds. A stalled or failed check never traps the
user because the result route performs the authoritative validation after the reveal click.

## Scope and non-goals

In scope:

- the post-consent preparation and reveal experience;
- the loading/ready copy and selected portrait visual;
- ownership of result prefetch, `quiz_completed`, and result-artifact triggering;
- relocation of the existing client auth/access preparation check into the stable step-10 surface;
- removal of the normal step-10-to-step-11 transition;
- explicit recovery when a restored state has no lead ID;
- regression coverage for ordinary and entitled result destinations.

Non-goals:

- changing quiz questions, consent, or lead persistence;
- introducing an AI analysis call or reviving `/api/quiz/analyze`;
- changing the guided-story result chapters, pricing, checkout, or access rules;
- blocking result access on email delivery;
- changing detailed offer-page engagement tracking; that work continues in its own worktree;
- deleting step 11 until restored-state compatibility is understood and tested.

## Target map

- `src/components/quiz/quiz-analysis.tsx`
  - replace the auto-advance implementation with the preparation/loading/ready state;
  - render the personalized portrait through a marker-free artwork surface that shares Chapter
    1's asset resolver, body composition, and fallback behavior;
  - expose the canonical result link only in the ready state;
  - keep timers deterministic and cancellable.
- `src/components/quiz/quiz-results.tsx`
  - remove it from the normal post-consent route;
  - relocate `quiz_completed` and result-artifact ownership without duplicating either side
    effect;
  - retain only explicitly tested legacy/restored behavior or simplify it after callers are
    proven absent.
- `src/app/quiz/page.tsx`
  - keep step 10 as the normal terminal quiz step before result navigation;
  - prevent the standard flow from mounting step 11.
- `src/app/quiz/quiz-shell.tsx`
  - no loading-state shell switch in the normal flow;
  - preserve existing result-shell behavior only for any still-supported legacy step-11 entry.
- `src/lib/quiz/store.ts`
  - preserve draft compatibility and define what happens if a stored step points at the retired
    intermediate results state.
- `src/lib/quiz/portrait-config.ts`
- `src/lib/quiz/hair-portrait-assets.ts`
- `src/components/quiz/hair-portrait.tsx`
  - extract or expose a marker-free artwork composition that retains the shared SVG body for
    assets without their own body; no second asset mapping.
- `src/app/result/[leadId]/page.tsx`
- `src/app/result/[leadId]/result-client.tsx`
  - preserve validated retake and `returnTo` context through the canonical result route and into
    the entitled onboarding link.
- `tests/quiz-analysis.test.tsx`
- `tests/editorial-pages.test.tsx`
- `tests/quiz-result-routing.e2e.spec.ts`
- `tests/auth-intake-routing.e2e.spec.ts`
- `tests/quiz-onboarding-e2e.spec.ts`
- `tests/stripe-subscription-e2e.spec.ts`
- result-page/retake contract tests covering the preserved return destination.

## Designed user journey

Actor: a quiz completer who has entered a name and email and answered the consent choice.

1. The lead is persisted through the existing endpoint. The user does not leave the quiz shell
   during this request.
2. One preparation screen appears:
   - `Deine Angaben sind gespeichert`
   - `{Name}, wir stellen deine Haaranalyse zusammen.`
   - `Wir verbinden deine Angaben zu Haar, Zielen und Problemen.`
   - the personalized portrait selected from the same quiz answers as Chapter 1, inside the
     reviewed circular progress treatment.
3. Three concise rows reveal in order:
   - `Deine wichtigsten Haar-Themen werden priorisiert`
   - `Passende Produkte und Routine-Schritte werden zusammengestellt`
   - `Deine persönliche Begleitung mit Chaarlie wird vorbereitet`
4. While the rows progress, the client resolves the portrait, settles the auth session and existing
   signed-in access check, emits `quiz_completed`, starts best-effort result-artifact delivery, and
   prefetches the canonical result route. The rows are storytelling, not a claim that three
   discrete backend analysis jobs are running. Email delivery failure never blocks the reveal.
5. The same screen changes in place to:
   - `{Name}, deine Haaranalyse ist bereit.`
   - `Deine wichtigsten Prioritäten und Routine-Bausteine warten auf dich.`
   - one button: `Meine Haaranalyse ansehen`
   - no summary pills.
6. The user clicks the button once. The browser navigates directly to the canonical result URL;
   no intermediate quiz-results component, spinner, automatic scroll, or shell swap is rendered.
7. The result route determines access as it does today:
   - ordinary new lead: guided-story offer, Chapter 1;
   - entitled signed-in lead: existing result view with `MEINE ROUTINE STARTEN`.
   - entitled retake: the onboarding continuation retains its validated `returnTo` destination.
   - the route securely revalidates access even though the client preparation check already
     settled; the existing preparation screen remains visible until the result renders.
8. Before rendering name-dependent preparation copy, the component checks for a valid lead ID. If
   it is missing, it does not run an endless animation. It shows a clear recovery action that
   returns the user to the email/consent step without losing quiz answers. A blank name never
   renders a leading comma or malformed heading.
9. If result-artifact delivery fails, navigation remains available. If the result route itself
   cannot resolve the lead, the existing result-route not-found/recovery behavior remains the
   source of truth.

Completion is the fully loaded personalized result. No pricing or checkout action occurs during
preparation.

## Mockup evidence

- Reviewed direction:
  [A · Persönlicher Reveal](./mockups/2026-07-24-quiz-result-preparation-redesign.html)
- Direction selection: **confirmed by Nick on 2026-07-24**.
- Feedback incorporated:
  - removed the two summary pills;
  - rewrote the three rows to match analysis, routine/products, and ongoing Chaarlie support;
  - specified that production uses the same personalized portrait resolver as Chapter 1 rather
    than the fixed mockup sample.
- Updated mockup review status: **confirmed by Nick on 2026-07-24**.

## Ordered tasks

1. Establish the transition regression guard.
   - Add tests proving the normal flow never calls `goNext()` from preparation and never mounts
     the step-11 loading shell.
   - Prove the canonical destination retains `entry=quiz_completion`.
   - Completion: the old auto-advance implementation fails the new contract.

2. Create one preparation coordinator.
   - Resolve the portrait synchronously from quiz answers; do not derive and discard the full
     guided-story preview.
   - Move the existing client auth/profile settling and signed-in server-access check from the
     intermediate results surface into preparation.
   - Move `quiz_completed` to one guarded preparation-side effect.
   - Move result-artifact triggering to one guarded best-effort effect after a lead ID exists.
   - Start canonical result-route prefetch without relying on a private Next.js completion API.
   - Keep a minimum visual sequence separate from actual readiness; do not label individual rows
     as backend job progress.
   - Abort and settle the non-authoritative client access check after five seconds.
   - Completion: unit tests prove the ready state waits for settled access, one analytics emission,
     one artifact request, one prefetch, and complete timer cleanup.

3. Implement the reviewed loading and ready states.
   - Reuse the selected portrait artwork, including shared body composition and image fallback;
     do not render Chapter 1 marker buttons on the loading screen.
   - Use the approved copy and remove summary pills.
   - Keep the layout stable between loading and ready states on mobile and desktop.
   - Respect reduced motion by completing the checklist without staggered animation or artificial
     dwell.
   - Completion: component tests and screenshots match the approved mobile mockup at 320 and 375,
     while desktop screenshots retain the real two-panel quiz shell.

4. Navigate directly to the canonical result.
   - Render a link or button from step 10 that pushes the canonical result route directly.
   - Do not change the store to step 11 before navigation.
   - Let the result route retain server-side access and funnel ownership.
   - Thread validated retake and `returnTo` query state through the result route and its entitled
     onboarding link.
   - Completion: no intermediate result loader or shell transition appears in recorded browser
     playback.

5. Harden recovery and restoration.
   - Define step-11 draft migration or legacy behavior.
   - Return a missing-lead preparation state to lead capture without clearing quiz answers.
   - Keep result-artifact failures non-blocking.
   - Evaluate missing lead ID before name-dependent copy and retain the empty-name guard.
   - Completion: restored/missing-lead tests reach an actionable state and do not loop.

6. Update affected tracking and browser contracts.
   - Preserve `quiz_completed` routing and payload.
   - Preserve `offer_viewed` only after the final result route renders.
   - Ensure the separate offer-tracking worktree knows the intermediate step is no longer part of
     the normal path before it finalizes its taxonomy.
   - Update `tests/editorial-pages.test.tsx` for the approved preparation copy.
   - Update every affected E2E to wait for the ready state, assert absence of auto-navigation,
     click `Meine Haaranalyse ansehen`, and then assert the canonical destination.
   - Completion: analytics source tests and ordinary/entitled Playwright flows pass.

## Verification

Automated:

- focused preparation/timer/portrait resolver tests;
- analytics contract tests for `quiz_completed`, result artifacts, and offer-view separation;
- ordinary new-lead and signed-in entitled Playwright flows;
- entitled retake coverage proving its validated `returnTo` survives the result route;
- reduced-motion and restored/missing-lead coverage;
- `npm run test:node`;
- `npm run ci:verify`.

Manual/browser:

- fresh mobile and desktop quiz completion;
- confirm no shell/layout flicker during preparation or after the ready reveal;
- confirm the portrait matches Chapter 1 for straight, wavy, curly, and coily examples and for
  short/long lengths, including the shared body composition;
- confirm the three rows, ready headline, and CTA do not reflow unexpectedly;
- confirm one click reaches the personalized result with no intermediate loader;
- confirm entitled access still ends at `MEINE ROUTINE STARTEN`;
- inspect console, horizontal overflow, focus movement, and reduced-motion behavior.

Live-state:

- no migration or production-data write;
- result-artifact delivery must be rechecked in an environment with Customer.io server credentials;
- after deployment, run one fresh synthetic lead through production without starting checkout.

## Review and handoff

- Continue in the existing isolated worktree
  `codex/quiz-result-loading-consolidation-plan`; do not mix in the tracking worktree.
- The first auto-advance implementation remains uncommitted and may be replaced once this plan is
  fully approved.
- Required gates: updated mockup review, counterpart plan review, designed-user-journey sign-off,
  `implementation-loop`, `ready-check`, and the single routed code review.
- Mockup review: **confirmed**.
- Designed user-journey sign-off: **confirmed by Nick on 2026-07-24**, including the preparation
  screen's auth/access work and the final server-side revalidation after the reveal click.
- Stop before commit, push, PR, merge, deployment, or production verification until separately
  authorized.
- Residual risk: Next.js route prefetch is an optimization, not a durable completion signal. The
  UX must remain stable even when navigation still needs a short server round trip after the
  button click.
- Rollback: ordinary code revert; no runtime feature flag for this bounded terminal-step change.

## Counterpart review findings

| ID  | Type             | Evidence                                                       | Decision | Plan change                                                                                                          | Revalidation                                              |
| --- | ---------------- | -------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| R1  | defect           | Editorial source test pins the retired loading copy            | accepted | Named `tests/editorial-pages.test.tsx` and its expected-copy update explicitly                                       | focused source test plus CI                               |
| R2  | defect           | Six quiz/result E2E paths assume auto-navigation and old copy  | accepted | Named every affected spec and the required ready-state click contract                                                | ordinary, entitled, retake, and manual subscription paths |
| R3  | defect           | Direct result navigation could drop entitled-retake `returnTo` | accepted | Preserve validated retake context through the result page and entitled onboarding href                               | entitled retake E2E                                       |
| R4  | defect           | Bare WebP assets omit Chapter 1's shared body on most lengths  | accepted | Reuse a marker-free version of the complete portrait artwork composition                                             | portrait screenshots and component tests                  |
| R5  | defect           | Restored step 10 has no lead ID or name                        | accepted | Gate missing lead before preparation copy and preserve empty-name handling                                           | restored/missing-lead tests                               |
| R6  | tradeoff         | Full guided-story preview would be computed and discarded      | accepted | Resolve only the portrait in preparation; result route remains preview owner                                         | source review and result tests                            |
| R7  | product decision | Exact loading subcopy was not pinned in the plan               | accepted | Pinned the mockup's loading and ready copy in the designed journey                                                   | updated mockup review                                     |
| R8  | tradeoff         | Prefetch does not expose a reliable completion signal          | accepted | Use public Link/router prefetch only and keep navigation robust without treating prefetch as a hard readiness oracle | throttled browser walkthrough                             |
