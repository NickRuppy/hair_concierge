# Personal Plan post-payment UX hardening

## Progress

- [x] Live production journey reviewed at deployed commit `679c493602f12e128b5b6114066c75209cb39d8a`.
- [x] Product direction and question-copy principles reviewed with Nick.
- [x] Legacy quiz copy cross-check completed; tested scalp wording retained.
- [x] Current deployed-tree implementation seams mapped by three read-only explorers.
- [x] Counterpart plan review and blocker-driven bounded re-review completed; all findings reconciled.
- [x] Task 1 — safe authenticated confirmation-link replay.
- [x] Task 2 — single Stage 1 → Stage 2 handoff and immediate Stage 2 resume.
- [x] Task 3 — clean Stage 2 → Stage 3 entry without duplicate initial loading.
- [x] Task 4 — immediate Stage 3 save feedback.
- [x] Task 5 — bounded question-context copy corrections.
- [x] Final ready-check, browser journey, and whole-branch review completed.

## Outcome and source context

After payment, an authenticated Personal Plan customer moves from email confirmation into the saved five-stage journey without replaying a stale auth error, encountering duplicated stage invitations, or waiting through unexplained serial loaders. Stage 3 actions acknowledge a click immediately. The already-approved question-context refinements are applied surgically without redesigning the quiz flow, removing image cards, changing question order, or changing answer semantics.

The implementation and original review base is the deployed commit `679c493602f12e128b5b6114066c75209cb39d8a`, which was the head of parent PR [#344](https://github.com/NickRuppy/hair_concierge/pull/344) during implementation. PR #344 has since merged into `main`. Publication therefore rebases the single hardening commit onto fresh `origin/main` and revalidates that rebased tree before opening a draft PR against `main`; it must not publish the historical parent stack again.

## Chosen direction

1. Treat an expired or already-consumed confirmation link as a safe history replay only when a valid authenticated session already exists and the sanitized destination is a Personal Plan continuation (`/plan-bereit` or `/plan-start`). Extract a dependency-injected confirm handler so this behavior is directly testable. Stamp password-recovery redirects with `/auth/update-password` so PKCE success/failure can never enter the Personal Plan replay shortcut.
2. Keep one lean Stage 1 → Stage 2 handoff. On the publication base, the final Stage 1 CTA already enters the first Stage 2 question directly; remove the now-unused older transition instead of restoring another invitation screen.
3. Keep the existing Stage 2 completion bridge as the single Stage 2 → Stage 3 opening, but hand its already-built Stage 3 bootstrap into the Stage 3 client so the same resource is not loaded twice.
4. Carry the server-resolved Stage 2 resume session into the client and show the existing resume language immediately; do not make the customer wait through Stage 1 loading followed by Stage 2 loading.
5. Show a disabled in-flight state immediately for both normal Stage 3 role saving and “Ich habe dafür kein Produkt”. Restore the actionable screen and existing error recovery if persistence fails.
6. Apply only the approved ambiguity-reducing question copy. Preserve the legacy-tested scalp-type wording and descriptions, current multi-select scalp concerns, image cards, option order, persisted values, branching, and analytics identities.

## Scope and non-goals

### In scope

- Authenticated Personal Plan `/auth/confirm` history replay, a testable confirm-handler seam, explicit PKCE recovery destination stamping, and defense-in-depth query cleanup whenever middleware routes an authenticated visitor away from `/auth`.
- The production `/plan-start` Stage 1, Stage 2, and Stage 3 client handoffs and initial loading behavior.
- Immediate Stage 3 feedback for the normal role-save and no-owned-product paths.
- Approved copy-only refinements in the Personal Plan question screens and authenticated onboarding questions.
- Focused regression tests and authenticated desktop/mobile browser evidence.

### Non-goals

- No changes to checkout, payment ownership, purchase activation, entitlement rules, feature flags, migrations, catalog data, recommendation logic, Stage 4, or Stage 5.
- No changes to the legacy pre-payment `/quiz` flow; it is copy prior art only.
- No removal or redesign of image cards, option cards, layouts, question order, answer values, draft/submission versions, analytics event identities, or multi-select behavior.
- No reversion to the legacy scalp yes/no gate or single-main-concern branch.
- No change to password-recovery product behavior: verified recovery continues to `/auth/update-password`, while expired recovery remains on the forced auth recovery surface. The internal recovery link gains an explicit `next=/auth/update-password` discriminator because PKCE callbacks do not reliably carry `type=recovery`.
- No change to explicit onboarding `returnTo` behavior.
- No commit, push, PR, merge, deployment, production write, or flag activation in this implementation run.

## Target map

| Surface             | Likely files                                                                                                                                                                                                                                                          | Planned boundary                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmation replay | `src/app/auth/confirm/route.ts`, `src/components/auth/auth-form.tsx`, `src/lib/supabase/middleware.ts`, `tests/auth-post-checkout-routes.spec.ts`, focused middleware/auth tests                                                                                      | Extract `handleAuthConfirm(request, deps)`. On failed verification, replay only an authenticated, allowlisted Personal Plan destination. Stamp recovery `redirectTo` with `/auth/update-password`. When authenticated intake routing redirects from `/auth`, clear the source query; re-add only `lead` when the destination is `/onboarding`, and add nothing for `/quiz` or `/chat`. |
| Stage 1 → 2 handoff | `src/components/personal-plan-start/plan-start-flow.tsx`, `tests/personal-plan-start-ui.test.tsx`, `tests/personal-plan-start-resume.test.tsx`                                                                                                                        | Preserve current main's direct Stage 1 CTA → first Stage 2 question behavior and remove the obsolete `PlanStartTransition` export/component. The CTA is the single handoff; resume and secondary-exit behavior remain intact.                                                                                                                                                          |
| Stage 2 resume      | `src/app/plan-start/page.tsx`, `src/components/personal-plan-start/plan-start-flow.tsx`, `src/components/personal-plan-start/index.tsx`, `src/components/personal-plan-refinement/refinement-flow.tsx`, Stage 2 session types and resume tests                        | Return and pass both `personalPlanId` and the passive server-loaded `Stage2RefinementSession`. For a server-selected Stage 2/3 journey, bypass `PlanStartProductionGate`'s Stage 1 fetch and render immediate resume context. Refresh only after actions or stale-state recovery. Delete the unused `PlanStartTransition` export/component assertions.                                 |
| Stage 2 → 3 entry   | `plan-start-flow.tsx`, `refinement-flow.tsx`, `src/components/personal-plan-products/stage3-products-flow.tsx`, `tests/personal-plan-stage1-2-3.spec.ts`, Stage 3 flow tests                                                                                          | Build and retain the current-main `Stage3Bootstrap`, including the authority draft and evaluations. Pass that exact bootstrap to `Stage3ProductsFlow` and skip its mount GET for both bridge entry and direct Stage 3 resume.                                                                                                                                                          |
| Stage 3 feedback    | `stage3-products-flow.tsx`, `src/components/personal-plan-products/index.tsx`, `tests/personal-plan-stage3-flow.test.tsx`                                                                                                                                             | Add one action-in-flight state shared by normal role saving and no-product saving; disable repeat actions, show approved German status copy, and retain existing error/revision recovery.                                                                                                                                                                                              |
| Question context    | `src/components/personal-plan-quiz/quiz-data.ts`, `src/components/personal-plan-quiz/personal-plan-quiz.tsx`, `src/components/onboarding/onboarding-flow.tsx`, `src/components/onboarding/screens/heat-tools-screen.tsx`, focused Personal Plan/onboarding copy tests | Copy only. Preserve legacy-tested scalp copy and all question/image/card mechanics.                                                                                                                                                                                                                                                                                                    |

## Designed user journey

Evidence review: **confirmed**. User-journey sign-off: **confirmed on 2026-08-09**, including the correction that image cards remain unchanged and the implementation focus stays on the post-payment journey.

1. A paid customer opens the emailed confirmation link. On first use, the link verifies and continues to its server-owned Personal Plan destination exactly as today.
2. If browser Back replays the consumed Personal Plan confirmation URL while the customer is still authenticated, the page does not show “link expired” and does not carry `error=link_expired` into onboarding. Only `/plan-bereit` and `/plan-start` qualify for this shortcut; other forged or unrelated destinations retain normal auth handling.
3. A new Stage 1 customer completes the Bedarfsplan, chooses `Plan verfeinern`, and arrives at the first Stage 2 question. There is no extra standalone transition or invitation screen.
4. A returning Stage 2 customer immediately sees that the saved refinement is being opened and continues at the first unresolved question. They do not wait through a Stage 1 loader followed by a Stage 2 loader.
5. After Stage 2 completion, the customer sees one concise bridge confirming that answers were saved and that products come next. Activating its CTA opens Stage 3 without a second initial Stage 3 request/loading cycle.
6. In Stage 3, selecting the normal continue action immediately changes the surface to `Produkte werden gespeichert`. Selecting `Ich habe dafür kein Produkt` immediately changes it to `Alles klar – dafür hast du noch kein Produkt.` with `Wird gespeichert`. While either request is active, duplicate actions are disabled.
7. If Stage 3 persistence fails or detects a revision conflict, the existing error/retry recovery returns; the UI does not falsely advance.
8. Questions with genuine ambiguity gain one short answer-focused sentence. The scalp-type screen keeps its proven wording and descriptions; its scalp-concern follow-up remains multi-select. Image cards, question order, and functional transition screens remain unchanged and lean.
9. Completion continues through the existing Stage 3, Routine, and Anwendung boundaries; this change does not alter later-stage availability or activation.

### Meaningful variants and recovery

- Verified password recovery remains `/auth/update-password`; failed recovery links carry the explicit recovery destination and `force=login`, so they remain on the auth recovery surface rather than being treated as harmless navigation replay.
- The explicit PKCE recovery discriminator applies to newly sent password-reset emails. Already-sent legacy recovery emails have no embedded destination; this slice cannot reconstruct their purpose after the provider consumes or rejects the code, so they retain the existing fallback behavior during that short migration window.
- A signed-out visitor with an expired confirmation link still receives the existing auth recovery UI and can request a new link with the sanitized destination preserved.
- Paid-pending, subscription-denied, foreign-session, and authority-unavailable paths retain their current fail-closed routing.
- A completed Stage 2 session whose current Stage 3 authority is unavailable remains on the existing completion bridge until the authority becomes available.

## Planning evidence

- [`plans/mockups/2026-08-09-personal-plan-post-payment-ux.html`](mockups/2026-08-09-personal-plan-post-payment-ux.html) — reviewed lean states for authenticated replay, the two stage handoffs, resume feedback, Stage 3 saving, and bounded question context. Selected direction: one functional message per state, with no extra cards or explanatory panels.
- [`plans/mockups/2026-08-09-personal-plan-question-guidance.html`](mockups/2026-08-09-personal-plan-question-guidance.html) — reviewed before/after question copy in the existing card layout. Selected direction: one answer-focused helper only when ambiguity requires it; the scalp tab records the explicit decision to preserve the tested copy unchanged.
- Legacy copy source: `src/components/quiz/quiz-scalp-question.tsx`. Decision: preserve the tested scalp-type title, helper, and behavioral option descriptions while keeping the richer Personal Plan multi-select scalp-concern structure.
- Feedback incorporated: shorter auth/transition copy; no “Wir markieren die Lücke”; no image/card removal; no broad quiz-flow redesign; active routine time excludes passive drying/waiting; recurrence uses a natural recent frame; prior-attempts measures routine effectiveness.

Artifact disposition: the HTML mockup and this plan are **commit** artifacts. Transient screenshots and counterpart output remain outside the repository and are **discard** artifacts after verification.

## Authoritative German copy decisions

The implementation may make grammatical interpolation adjustments for the chosen concern label, but must not invent additional teaching copy.

| Surface and exact source                                                  | Approved copy or rule                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated replay                                                      | `Dein Plan wird geöffnet.`                                                                                                                                                                                                                                                                               |
| Stage 1 → 2                                                               | Use the final Stage 1 CTA as the sole handoff into the first Stage 2 question; remove the obsolete repeated transition.                                                                                                                                                                                  |
| Stage 2 resume                                                            | `Wir laden deine Verfeinerung.` / `Du machst bei der ersten offenen Frage weiter.`                                                                                                                                                                                                                       |
| Stage 2 → 3                                                               | `Antworten gespeichert` / `Jetzt kommen deine Produkte.`                                                                                                                                                                                                                                                 |
| Stage 3 normal save                                                       | `Produkte werden gespeichert`                                                                                                                                                                                                                                                                            |
| Stage 3 no product                                                        | `Alles klar – dafür hast du noch kein Produkt.` / `Wird gespeichert`                                                                                                                                                                                                                                     |
| `thickness` — `quiz-data.ts:401-429`                                      | `Wenn du unsicher bist: Rolle ein einzelnes trockenes Haar zwischen Daumen und Zeigefinger.` Keep the `Nähfaden` option descriptions. The duplicate profile-editor phrasing is outside this quiz-only correction and remains unchanged.                                                                  |
| `current_problems` — `personal-plan-quiz.tsx:2626-2670`                   | `Wähle alles aus, was du aktuell bemerkst.` This removes the premature recurrence assumption before the separate recurrence question.                                                                                                                                                                    |
| `admission_recurrence` — `personal-plan-quiz.tsx:1316-1327`               | Add the supported eyebrow prop `Zurück zu deinen Haarthemen`; concern-specific title `Wie oft bemerkst du …?`; subtitle `Denk daran, wie es in letzter Zeit meistens war.` This is an intentional copy insertion in an existing layout slot, not a hierarchy/layout change.                              |
| `previous_attempts` — `quiz-data.ts:618-630`                              | Title `Wie gut haben deine bisherigen Versuche funktioniert?`; helper `Denk an Produkte, einzelne Schritte und deine bisherige Routine.` Existing values and option meanings remain unchanged. This covers `little_targeted_trial` without duplicating frozen `routine_clarity` or `result_reliability`. |
| `daily_time` — `personal-plan-quiz.tsx:1504-1532`, `quiz-data.ts:722-727` | Title `Wie viel aktive Zeit möchtest du an einem typischen Pflegetag einplanen?`; helper `Trocknen und Warten zählen nicht mit.` Visible option labels drop `pro Tag`; stored values remain unchanged.                                                                                                   |
| Heat tools — `heat-tools-screen.tsx:63-86`                                | `Wähle alles aus, was du zumindest gelegentlich nutzt.` The omission of the sibling prefix `Mehrfachauswahl möglich` is intentional because the sentence itself supplies the selection scope.                                                                                                            |
| Towel material — `onboarding-flow.tsx:861-876`                            | `Wähle, was dein nasses Haar meistens berührt.` Replace the promotional causal claim with answer guidance.                                                                                                                                                                                               |
| Towel technique — `onboarding-flow.tsx:878-895`                           | Remove the redundant `Rubbeln oder sanft ausdrücken?` subtitle; the question and options are sufficient.                                                                                                                                                                                                 |
| Drying method — `onboarding-flow.tsx:897-912`                             | `Wähle, was du nach dem Waschen meistens machst.` Replace the broad heat claim with answer guidance.                                                                                                                                                                                                     |
| `scalp_oiliness` and `scalp_concerns` — `quiz-data.ts:566-616`            | Preserve current title, helper, option descriptions, order, values, and multi-select behavior verbatim.                                                                                                                                                                                                  |

## Ordered tasks

### Task 1 — Make authenticated confirmation replay safe

**Consumes:** sanitized `next` from `resolveAuthRedirectPath`, current Supabase session, confirmation type, existing middleware intake redirect.

**Produces:** an authenticated failed non-recovery replay redirects cleanly to sanitized `next`; stale auth query parameters cannot leak through middleware intake redirects.

1. Extract `handleAuthConfirm(request, deps)` from `GET`, following the dependency-injected neighbouring auth handlers. The dependency surface supplies session exchange/OTP verification, `getUser`, profile linking, and redirect construction while `GET` retains production wiring.
2. Add failing handler tests for authenticated consumed Personal Plan replay, signed-out expiry with sanitized `next`, forged/internal-but-unallowlisted destinations, and verified/failed PKCE and OTP recovery.
3. Stamp `resetPasswordForEmail` with `redirectTo=/auth/confirm?next=/auth/update-password`; classify both `type=recovery` and that sanitized destination as recovery. A failed recovery redirects to `/auth?error=link_expired&force=login&next=%2Fauth%2Fupdate-password`.
4. Add focused middleware regression proof for every authenticated `/auth` intake outcome (`/quiz`, `/onboarding`, `/chat`). Exact rule: when the source pathname is `/auth`, clear the entire source query; when the destination is `/onboarding`, re-add only the source `lead`; for `/quiz` and `/chat`, re-add nothing. Do not change query handling for a source `/quiz`, including retake mode.
5. Implement the Personal Plan replay allowlist for `/plan-bereit` and `/plan-start`, including their safe query strings, without altering checkout destination derivation, `plan-bereit`, or onboarding `returnTo`.

Completion: focused auth tests pass, an authenticated replay reaches `/plan-start` without `error`, and signed-out/recovery variants retain their current recovery semantics.

### Task 2 — Collapse Stage 1 → 2 and bootstrap Stage 2 resume

**Consumes:** server-selected `PlanStartPageState`, passive `loadExistingStage2RefinementSession`, existing `InvitationShell` and `ResumeShell`.

**Produces:** one direct Stage 1 CTA handoff into the first Stage 2 question plus server-provided `personalPlanId` and a serializable initial Stage 2 session for returning customers.

1. Extend `resolvePlanStartPageState` to return the server-authoritative `personalPlanId` with the passive Stage 2 session for Stage 2/3 selections; pass both as stable primitives/props.
2. Add failing UI/resume tests proving the fresh path has no standalone transition/invitation and a Stage 2 resumer renders before any Stage 1 GET. The later Stage 3 CTA must still have `personalPlanId`.
3. Remove the `step: "transition"` customer state: the final `NeedPlanScreen.onNext` calls `onContinueToRefinement` directly. Delete `PlanStartTransition`, its barrel export, and direct component assertions if no production consumer remains.
4. Let `PlanStartProductionGate` bypass its Stage 1 fetch only when the server supplied a valid later-stage selection plus `personalPlanId`. Pass the passive session into `RefinementFlow` as initial state and skip its unconditional mount load/duplicate start-or-resume analytics when that session is present. Retain its revision-conflict reload (`refinement-flow.tsx:283-316`).
5. Preserve `RefinementFlow.onSecondaryExit` and Stage 3 back navigation by lazy-loading the Stage 1 ready view model on the first explicit entry into the Stage 1 branch. Show the existing Stage 1 loading/error states for that user-initiated fallback only; cache the result for subsequent back navigation.

Completion: fresh Stage 1 completion enters the first Stage 2 question through one CTA; resume immediately identifies the saved refinement and first unresolved question; existing authority/access guards remain unchanged.

### Task 3 — Keep one Stage 2 → 3 bridge and one Stage 3 initial load

**Consumes:** completed Stage 2 response, authority-validated Stage 3 bootstrap, existing completion bridge.

**Produces:** both completion-bridge entry and direct Stage 3 resume pass one validated `Stage3Bootstrap` to `Stage3ProductsFlow`.

1. Use current main's `loadPlanStartStage3Bootstrap`/`buildStage3Bootstrap` contract so the validated entry context, authority draft, and evaluations remain one typed handoff.
2. Pass the optional bootstrap into `Stage3ProductsFlow`; initialize from it and skip the mount load/evaluation GET when the complete bootstrap is present. Preserve the existing caught error and recovery paths for refined-version mismatch or gateway failure.
3. Add failing integration assertions for both completion bridge CTA → Stage 3 and direct Stage 3 resume, each with exactly one Stage 3 load-or-create request. Keep stable prop identity so the effect cannot refire from an intermediate reconstructed object.
4. Preserve background refresh/revision-conflict behavior after user actions and the authority-unavailable completion fallback.

Completion: Stage 2 completion still pauses on the approved bridge, its CTA opens Stage 3, and the initial Stage 3 resource is loaded exactly once.

### Task 4 — Add immediate Stage 3 persistence feedback

**Consumes:** `saveRolesAndContinue`, `markCurrentRoleGap`, existing mutation/revision/error machinery.

**Produces:** one shared action-in-flight state that blocks duplicate actions and renders path-specific status copy.

1. Add failing component tests for immediate feedback and duplicate-click prevention on both save paths.
2. Wire the existing `Stage3SaveState` value `saving` so the status styling is truthful, then render the deliberately distinct normal `Produkte werden gespeichert` and no-product `Alles klar – dafür hast du noch kein Produkt.` / `Wird gespeichert` messages as soon as the action begins. Disable conflicting controls until the atomic category finalization settles.
3. On failure, clear the pending state and expose the existing error/retry behavior; on success, advance from the persisted cursor as today.

Completion: both actions acknowledge immediately, issue the current-main atomic `finalize_capture_category` mutation once, and retain current persistence semantics and revision recovery.

### Task 5 — Apply the bounded question-context copy

**Consumes:** the authoritative copy table above and current component structures.

**Produces:** ambiguity-reducing German copy only; no structural, semantic, persistence, or analytics change.

1. Add/update focused source/component assertions for the exact approved strings and for unchanged scalp copy.
2. Apply the Personal Plan and authenticated-onboarding copy changes without touching image/card rendering, question order, stored values, branching, or multi-select handlers.
3. Verify representative question screens at mobile and desktop widths, including the preserved scalp cards.

Completion: every approved string is present, the `previous_attempts` title/helper fits all four unchanged options without duplicating sibling questions, legacy-tested scalp copy remains exact, and structural source/test fingerprints show no quiz-flow or card changes.

## Verification

### Automated

- `npx playwright test tests/auth-post-checkout-routes.spec.ts --project=chromium`
- `node --import ./tests/server-only-register.cjs --import tsx --test tests/auth-intake-state.test.ts tests/auth-unauthenticated-redirect.test.ts` plus the focused middleware test file introduced or extended by Task 1.
- `npm run test:personal-plan` covering `personal-plan-start-resume`, `personal-plan-start-ui`, `personal-plan-stage2-refinement-ui`, `personal-plan-stage3-flow`, and the focused quiz/onboarding copy assertions.
- `npm run test:node` so onboarding copy assertions outside the Personal Plan glob execute; explicitly confirm `tests/personal-plan-quiz-funnel-entry.test.ts` ran because it fingerprints both Personal Plan quiz source files.
- `npm run test:playwright:personal-plan-stage3` covering `tests/personal-plan-stage1-2-3.spec.ts` and the production-shaped Stage 1–3 flow.
- `npm run test:playwright:personal-plan-stage1-5` when the local DB harness and required test environment are available; record an explicit skip and reason otherwise.
- `npm run ci:verify`
- `npm exec -- prettier --check <every task-owned changed source, test, plan, and mockup file>` and `git diff --check`.
- Run the repository-provided `ready-check` skill on the final changed-path manifest; its selected commands supersede this minimum when broader impact is detected.

### Manual/browser

- Authenticated desktop and mobile replay of an already-consumed confirmation URL: no expired-link flash/query and correct plan continuation.
- Fresh Stage 1 completion: one CTA handoff into the first Stage 2 question and no standalone transition/invitation.
- Stage 2 resume: immediate saved-state context and continuation at the first unanswered question.
- Stage 2 completion: one bridge and one Stage 3 initial load.
- Stage 3 normal save and no-product save: immediate pending feedback, disabled repeat action, success advance, and failure recovery.
- Representative 390 px and desktop question screens: approved helper copy, unchanged image/card layout, and exact preserved scalp wording.

### Live-state and rollout

- No migration or production data check is required because the plan changes no schema or persisted value.
- Deployment, production smoke, and flags remain outside this run and require separate authorization.
- PR #344 merged on 2026-08-10. Commit the reviewed hardening patch on its original base, rebase that single task commit onto fresh `origin/main`, re-run the affected verification/review identity, and open the draft PR against `main`. Never publish the historical parent stack again.

## Findings ledger

| ID  | Type                   | Evidence                                                                                                                                                      | Decision                 | Plan change                                                                                                                             | Revalidation                                                                |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| F01 | defect                 | Live replay reached `/auth?error=link_expired`; middleware clones that query when routing authenticated users to onboarding.                                  | accepted                 | Handle valid-session replay in confirmation route and clear stale auth query on intake redirect.                                        | Route and middleware regression tests plus browser replay.                  |
| F02 | defect                 | The original base had redundant Stage 1 and Stage 2 handoff screens; merged PR #344 now enters the first Stage 2 question directly.                           | incorporated on rebase   | Preserve the direct CTA handoff and remove the obsolete `PlanStartTransition` component/export.                                         | Fresh Stage 1 → 2 UI test and browser journey.                              |
| F03 | defect                 | Server-selected Stage 2 resume still performs Stage 1 client loading and Stage 2 client loading serially.                                                     | accepted                 | Pass passive server session as initial client state.                                                                                    | Resume test asserts immediate context/no Stage 1 fetch.                     |
| F04 | defect                 | Stage 3 entry loads/creates once in `PlanStartFlow` and again when `Stage3ProductsFlow` mounts.                                                               | accepted                 | Pass the authority-validated initial draft into Stage 3.                                                                                | Exactly-one-load integration assertion.                                     |
| F05 | defect                 | Stage 3 normal save and no-product save lack immediate in-flight feedback.                                                                                    | accepted                 | Shared action pending state with path-specific approved copy.                                                                           | Component tests for both actions and retry.                                 |
| F06 | tradeoff               | Legacy scalp copy may influence choice order, but prior cohort review did not establish a broken default and Nick explicitly selected it as tested prior art. | accepted                 | Preserve it verbatim; do not reorder or rewrite in this slice.                                                                          | Exact-copy regression assertion and rendered check.                         |
| F07 | scope/product decision | Reverting to the legacy single-main-scalp-concern branch would discard current multi-signal data.                                                             | rejected by Nick         | Keep current multi-select.                                                                                                              | Existing state/flow tests remain green.                                     |
| F08 | scope/product decision | Image cards and broad quiz-flow redesign were not the intended target.                                                                                        | rejected by Nick         | Copy-only question changes; structural UI is a non-goal.                                                                                | Diff review and browser comparison.                                         |
| C01 | defect                 | The confirm route directly owns production dependencies, so authenticated replay cannot be covered by the named test suite.                                   | accepted                 | Extract dependency-injected `handleAuthConfirm`.                                                                                        | Handler tests execute failed/successful PKCE and OTP paths.                 |
| C02 | defect                 | PKCE recovery callbacks do not reliably include `type=recovery`.                                                                                              | accepted                 | Stamp and classify `next=/auth/update-password`; force the auth error surface on expiry.                                                | Success and failure recovery tests.                                         |
| C03 | defect                 | Passing only Stage 2 session still leaves the unconditional Stage 1 GET and loses `personalPlanId` needed by Stage 3 entry.                                   | accepted                 | Server supplies both session and plan id; later-stage server selection bypasses Stage 1 GET.                                            | Resume test plus Stage 3 CTA assertion.                                     |
| C04 | defect                 | `loadPlanStartStage3Entry` discards the draft, and narrowing omits `authorityEvaluations`; bridge-only coverage misses direct resume.                         | accepted                 | Return the widened authority draft and cover both entry paths.                                                                          | Exactly-one-GET assertions for bridge and direct resume.                    |
| C05 | defect                 | Stage 3 can display `Wird gespeichert` with the hard-coded `saved` visual state.                                                                              | accepted                 | Wire existing `Stage3SaveState="saving"`.                                                                                               | Component state/style assertion.                                            |
| C06 | tradeoff               | Auth replay could become a same-origin open redirect for any forged confirm URL.                                                                              | accepted with narrowing  | Replay shortcut allowlists only `/plan-bereit` and `/plan-start`; all other paths retain auth recovery.                                 | Allowlist/unsafe-path handler matrix.                                       |
| C07 | tradeoff               | Global auth changes have no feature flag.                                                                                                                     | accepted with narrowing  | No new flag; bounded destination allowlist, recovery discriminator, direct tests, and revertable task commit are the rollback boundary. | Auth suite and manual replay before publication.                            |
| C08 | tradeoff               | Question-copy rows were insufficiently pinned and could accidentally edit scalp or adjacent question constructs.                                              | accepted                 | Pin every row to question id and source range; preserve scalp by exact assertion.                                                       | Focused copy tests and diff review.                                         |
| C09 | scope/product decision | Counterpart suggested deferring towel/drying guidance. Nick had already approved the full bounded copy pass after reviewing all questions.                    | rejected                 | Keep the approved rows; explain that they replace broad causal claims with answer guidance without structural changes.                  | Rendered onboarding checks.                                                 |
| C10 | defect claim           | Counterpart reported `ready-check` and `request-code-review` unavailable by inspecting the wrong Claude skill surface.                                        | rejected                 | Retain the repository-provided Codex gates that are available in this session; also run `npm run ci:verify`.                            | Final gate receipts.                                                        |
| C11 | defect                 | Server-seeded Stage 2 still had an unconditional mount load that could reset an active question and duplicate analytics.                                      | accepted                 | Skip the mount load/analytics when a valid initial session is present; keep conflict-driven reload.                                     | Resume interaction and event-count assertions.                              |
| C12 | defect                 | Bypassing Stage 1 loading removed the ready view model required by Stage 2/3 back navigation.                                                                 | accepted                 | Lazy-load and cache Stage 1 only on explicit fallback entry.                                                                            | Back-navigation loading/success/error tests.                                |
| C13 | resolved upstream      | The original base wrote Stage 3 no-product roles sequentially. Current `main` now exposes atomic `finalize_capture_category`.                                 | incorporated on rebase   | Preserve current-main atomic finalization and layer pending/duplicate-click feedback onto it.                                           | Atomic mutation, conflict/reload, pending-state, and duplicate-click tests. |
| C14 | maintainability        | Final counterpart review noted that the initial Stage 3 draft ref is retained after first consumption.                                                        | accepted without change  | Current parent state keeps the entry context stable for the component mount; clearing the ref is not required for this bounded journey. | Whole-branch review confirmed no current behavioral defect.                 |
| C15 | environment            | The isolated Stage 1–5 harness starts its temporary Supabase stack but the pinned CLI does not export the script's expected `API_URL`.                        | recorded, not code-fixed | Keep the harness failure outside this UX slice; the Stage 1–3 browser pack and all deterministic contracts remain required and green.   | Retry reproduced before browser execution; temporary stack cleaned up.      |

## Final verification receipt

- Publication rebase: the single task commit is based on `52047e8f`, including merged PR #352's Stage 2 atomic completion recovery, Stage 3 decision batching/timing, and atomic category finalization.
- Auth route and middleware contracts: 45/45 focused Playwright route cases passed; focused middleware cleanup cases passed.
- Repository Node contracts: `npm run test:node` passed on the publication tree.
- Personal Plan contracts: 930/930 passed on the publication tree.
- Stage 1–3 browser pack passed against current main's direct Stage 1 → Stage 2 question entry, seeded resume, authoritative Stage 3 bootstrap handoff, and responsive containment.
- Production verification: `npm run ci:verify` passed typecheck, lint (0 errors; four pre-existing warnings), and the Next.js production build.
- Formatting and patch hygiene: every task-owned source, test, plan, and mockup passed Prettier; `git diff --check` passed.
- Rendered evidence: recurrence at 1280 px plus preserved scalp cards and active-time guidance at 390 px rendered without horizontal overflow.
- Authenticated consumed-link replay was not exercised against production or a seeded customer account in this local-only run. The dependency-injected handler and middleware matrix cover the behavior directly; an authenticated smoke remains a pre-publication check.
- The isolated Stage 1–5 browser harness was attempted twice. The retry created and cleaned its temporary Supabase stack but stopped before browser execution because `API_URL` was unset by the pinned local CLI.
- The original internal and Claude reviews reported no blockers. Publication re-review found and fixed three rebase-only regressions before the final full verification: Stage 2 atomic completion recovery, seeded direct-entry mode, and Stage 3 decision batching/timing.

## Review and handoff

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-post-payment-ux`
- Branch: `codex/personal-plan-post-payment-ux`
- Original implementation/review base: deployed commit `679c493602f12e128b5b6114066c75209cb39d8a`
- Publication base: fresh `origin/main` at `52047e8f` after merged PR #352.
- Planning evidence review: **confirmed**.
- Designed user-journey sign-off: **confirmed**.
- Execution owner: the main Codex session integrates worker output and invokes the Codex-side repository skills; Claude remains a read-only counterpart and is not expected to invoke `.agents` skills.
- Required gates: one Claude plan review plus the blocker-driven bounded re-review before implementation; `ready-check`, `npm run ci:verify`, and `request-code-review` on the final tree.
- Authorized stop point: commit, push, and draft PR only. Do not merge, deploy, write production data, alter flags, or clean up the worktree without separate authorization.
