# Ads quiz progressive loading

## Outcome and source context

Make the fresh ads entry at `/lp/haarplan` visibly usable with substantially less critical-path JavaScript. The first hair-texture question remains server-rendered and visually identical while the existing full Personal Plan quiz downloads only after the first paint or immediately when needed.

Source evidence:

- The completed landing optimization is committed at `16f90820` and leaves the ads route at about 275 KiB initial JavaScript gzip.
- The ads route still carries about 60 KiB more initial JavaScript gzip than `/`.
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx` is 3,081 lines and statically contains the first question, all later screens, email handling, preparation, draft/resume behavior, and result handoff.
- Warm paired traces showed only about 7 ms server-response difference between `/` and `/lp/haarplan`; the stable ads LCP gap is therefore not primarily route TTFB.
- The first texture image is already parser-discovered, preloaded, high-priority, correctly sized, and not a supported remaining image optimization.
- A Sentry-blocked control did not materially improve ads LCP. A prior isolated CSS prototype improved median LCP by only about 0.1 seconds.

## Chosen direction

Introduce a small fresh-entry client boundary that server-renders the exact current texture question and keeps the full quiz in a separate dynamic chunk.

1. Every visitor goes through one entry boundary. It defines the full quiz with `React.lazy(() => import(...))`, the exact primitive proven by the disposable Next 16/Turbopack prototype. Server-resumed visitors render that lazy child immediately inside `Suspense`; fresh visitors do not render or request it until the post-paint, local-draft, or interaction trigger. The prototype proved this preserves restored-screen SSR for the resumed branch without requesting its continuation chunk on the fresh branch. Production wiring must re-prove both HTML and request conditions before broader refactoring proceeds.
2. Fresh visitors receive only the shared frame and texture question in the initial client graph.
3. After the first paint, the browser starts importing the full quiz in a background task. A click or discovery of a valid local draft starts the same single-flight import immediately.
4. If the full quiz is ready before interaction, it replaces the shell with the identical texture screen. Every full quiz mounted after a fresh shell—not only an early-click handoff—receives and consumes a one-shot initial texture screen-view suppression flag because the shell already emitted that view. Returning to texture later still emits the normal event.
5. The shell owns the initial texture `personal_plan_quiz_screen_viewed` event after local-draft discovery establishes that the visitor is fresh. It also owns the synchronous `quiz_started` milestone and app event when texture is clicked, preserving current timing even if the continuation later fails. If the import is not ready, the shell immediately shows the selected state and hands one typed bootstrap value, selection timestamp, and the already-emitted click flag to the full quiz. The full quiz seeds `quizStartedRef`, preserves the existing minimum 400 ms selected-state feedback, and then advances to thickness. The shell never writes a local or server draft; only the authoritative full quiz persists answers after restoration is resolved.
6. A valid local or server draft always wins over a fresh shell selection, matching the existing restoration authority.
7. If the dynamic import fails, the selected first screen remains visible and the entry retries automatically with capped exponential backoff. There is no retry button. Quiet background-prefetch failures remain invisible; only a visitor already waiting after a selection sees a passive loading status. Retries pause while offline or hidden and resume immediately on `online` or visibility return, without discarding the selection or creating parallel requests. Because browsers cache a rejected module URL within the current document, the selected-answer path may perform one automatic document refresh using one-time `sessionStorage` recovery state; it never writes or impersonates an authoritative quiz draft. The refresh is bounded to once so a persistent CDN failure cannot create a reload loop. Jitter is deliberately omitted because each browser retries one same-origin asset independently; the 10-second cap and online/visibility pauses already bound request pressure.

This boundary is preferred over splitting every later screen independently: the latter is a larger refactor and leaves the large controller, imports, and shared data on the initial path. It is preferred over making the route static because warm TTFB is already close to organic and return/resume/field-test routing is server-owned. CSS isolation remains a later cleanup opportunity rather than part of this change.

## Scope and non-goals

In scope:

- Fresh-entry shell for the texture question.
- A single typed handoff for an early texture selection.
- Immediate full-quiz loading for server resume, valid local draft, or first interaction.
- Post-first-paint background loading for an untouched fresh entry.
- Exact-once entry and screen-view analytics ownership.
- Automatic dynamic-import recovery with capped backoff, offline/visibility awareness, and no user action.
- Bundle-boundary, state-handoff, browser-journey, and repeated performance verification.

Must remain unchanged:

- German copy, images, layout, header, progress treatment, selection feedback, and 400 ms auto-advance floor.
- Question order, answer schema, draft precedence, browser history, cross-browser resume, plan preparation, email capture, result routing, and field-test behavior.
- `quiz_started` event name and payload, `personal_plan_quiz_screen_viewed` semantics, funnel milestone ownership, and absence of answer payloads from screen-view events.
- Organic `/` behavior and bundle.
- Sentry, PostHog, Customer.io, Meta, cookies, consent, and server route semantics.

Non-goals:

- No static/cached fork of `/lp/haarplan`.
- No CSS isolation, image replacement, question redesign, copy change, or animation redesign.
- No per-screen lazy-loading architecture beyond the fresh-entry boundary.
- No database, API, feature-flag, analytics-schema, deployment, or production changes.

## Target map

- `src/funnels/landing/personal-plan-quiz.tsx`: render the new entry boundary for every path while retaining the funnel registry contract. Update the existing source-level test that currently hard-codes direct `<PersonalPlanQuiz>` rendering.
- `src/components/personal-plan-quiz/personal-plan-quiz-entry.tsx` (new): small client orchestrator for local-draft detection, post-paint loading, single-flight import, early-selection state, automatic backoff recovery, and online/visibility triggers.
- `src/components/personal-plan-quiz/personal-plan-quiz-first-screen.tsx` (new): shared first-screen frame and texture question used by both the lightweight shell and full quiz; it must not import the full quiz, later question data, email logic, or late-screen icons.
- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`: consume the shared first-screen view and accept an optional typed fresh-entry bootstrap without duplicating analytics, restoration, history, or transition logic.
- `src/components/personal-plan-quiz/texture-question.ts` (new): own the texture options and first-question configuration so the shell cannot import the 755-line all-question `quiz-data.ts`; the full quiz imports this same authority rather than duplicating option copy.
- `src/lib/analytics/runtime/post-paint.ts`: reuse the established scheduler; change only if a tested cancellation/single-flight seam is genuinely missing.
- `tests/personal-plan-quiz-progressive-entry.test.tsx` (new): shell, import scheduling, draft bypass, early-click handoff, exact-once analytics ownership, automatic backoff, offline/visibility, and recovery tests.
- `tests/landing-client-import-boundary.test.ts`: assert the fresh ads entry cannot statically reach the full quiz or later-screen dependencies.
- `tests/personal-plan-quiz-funnel-entry.test.ts`: retain the behavioral source contracts, replace the direct `<PersonalPlanQuiz>` source expectation with the progressive entry, and add typed handoff assertions.
- Browser/performance evidence under transient `tmp/`; only the chosen plan and reviewed mockup remain durable.

## Designed user journey

1. A new ads visitor opens `/lp/haarplan` and sees the same header, progress indicator, four texture cards, copy, and images as today. There is no loader, placeholder, or layout shift.
2. Once that first screen has painted, the remaining quiz begins downloading quietly. Nothing visible changes when it becomes ready.
3. The visitor selects a texture. The chosen card responds immediately. If the remaining quiz is already ready, the existing 400 ms transition advances to thickness exactly as today.
4. If the visitor clicks unusually quickly and the remaining quiz is still downloading, the chosen card stays selected instead of showing a spinner or blank screen. As soon as loading finishes—and never before the existing 400 ms feedback floor—the quiz advances to thickness with that answer retained.
5. A visitor with a valid server-resume snapshot bypasses the fresh entry and opens the authoritative restored screen. A visitor with a valid local draft triggers immediate full-quiz loading and is restored according to the existing local-versus-server precedence. No stale shell choice overwrites a saved journey.
6. Field-test entrants see the same banner and use the same progressive behavior unless the server has already routed them to the existing-session notice.
7. If the continuation chunk fails during quiet preloading, nothing alarming appears and the browser retries automatically. If the visitor has already selected an answer and is waiting, the selected card remains visible and a passive status appears: “Einen Moment – wir laden automatisch weiter. Deine Auswahl bleibt erhalten.” Retries continue with a delay capped at 10 seconds while the page is visible and online; returning online or refocusing the page triggers an immediate attempt. If the browser has cached the failed module URL, the page preserves the answer in one-time session state and refreshes itself once to issue a genuinely fresh request. A persistent failure never creates a reload loop. The visitor never has to press a recovery button.
8. From thickness onward, the existing Personal Plan quiz owns every screen, back action, save/resume action, preparation step, email step, and result transition unchanged.

Journey sign-off: **confirmed by Nick on 2026-08-20**, including automatic recovery without a visitor-triggered retry.

## Planning evidence

- [`evidence/landing-performance-ad-surface.jpg`](evidence/landing-performance-ad-surface.jpg): current production-shaped mobile first screen and exact-parity target. Decision answered: the progressive boundary must not create a new landing design.
- [`evidence/ads-quiz-progressive-loading-error.svg`](evidence/ads-quiz-progressive-loading-error.svg): delayed-continuation recovery wireframe. Decision answered: preserve the selected first question and communicate quiet automatic recovery without asking the visitor to fix a technical failure.
- Disposable logic prototype question: can one `React.lazy` boundary exclude its continuation from a fresh entry while SSR-rendering it for a server-resumed entry under Next 16/Turbopack?
- Decision criterion: fresh HTML and browser requests contain the shell but no continuation request; resumed HTML contains the restored continuation and its browser trace requests the isolated continuation chunk.
- Finding: the fresh path rendered `data-prototype-state="fresh-shell"` and never requested `0t77wwgxg3d4i.js`; `?resume=1` server-rendered `data-prototype-state="restored-continuation"` and requested that chunk. The universal lazy boundary therefore preserves resume SSR while keeping the fresh continuation deferred.
- Prototype disposition: **discarded**. All three prototype route files were removed; production behavior must be written test-first.
- Selected direction: exact visual parity in the normal path; the only new visible state is a passive automatic-recovery status after a selected visitor has actually been kept waiting.
- Evidence-review status: **confirmed by Nick on 2026-08-20** for exact normal-state parity and the passive automatic-recovery status.

## Ordered tasks

### 1. Lock the entry and ownership contracts with failing tests

Add tests for a dependency-injected progressive-entry coordinator before production wiring:

- one shared import promise for post-paint, click, draft, scheduled retry, online, and visibility triggers;
- server resume bypasses the shell;
- valid local draft force-loads the full quiz and remains authoritative;
- fresh entry renders the exact texture view without reaching the full module statically;
- early click retains texture and timestamp until handoff;
- import failure clears the failed attempt without creating parallel loads, keeps the first screen, and schedules a fresh attempt with exponential backoff capped at 10 seconds;
- hidden or offline state pauses timers; `online` and visible-state return trigger an immediate attempt;
- quiet prefetch failure shows no warning, while a selected visitor waiting beyond the tested delay sees the passive automatic-recovery status with no button;
- unmount cancels scheduled work without updating abandoned state;
- the shell emits the fresh texture screen view only after no valid local draft is found;
- the shell emits `quiz_started` synchronously on click with the existing payload, and the handoff seeds `quizStartedRef` plus a one-shot initial-screen-view suppression flag so neither event duplicates across shell-to-full replacement;
- every fresh shell-to-full replacement carries the one-shot initial-screen-view suppression flag, including idle-ready replacement before any click;
- the one-shot screen-view suppression does not suppress a later genuine back-navigation view of texture.
- the shell performs no local or server draft write; a same-tick discovered draft beats the shell selection and only the full quiz resumes persistence after restoration.

Produces: a typed `FreshPersonalPlanQuizEntry` handoff containing only texture and selection time, plus explicit analytics/restoration ownership.

Completion criterion: tests fail against the current eager component and fully describe the race between local restoration, early interaction, idle-ready replacement, and dynamic readiness. The idle-ready test observes one texture screen view before and after replacement; the same-tick draft race proves the draft wins and the shell made no persistence call.

### 2. Extract an import-safe, exact-parity first screen

Move only the frame and texture-question presentation needed for the fresh screen into modules that do not statically import the full quiz or later question configuration. Reuse the same component from the full quiz so normal shell replacement cannot drift visually. Keep the current first texture image preload/fetch-priority contract.

Consumes: the view and ownership contract from task 1.

Produces: one shared first-screen component and a graph assertion proving that the fresh entry excludes full quiz, email deliverability, plan preparation, hair portraits, and late-screen icon dependencies. The graph test also follows the shell-owned `createFunnelEventId`, `recordBrowserFunnelMilestone`, and `trackAppEvent` imports to prove timely analytics ownership does not reopen a path to the full quiz or all-question data.

Completion criterion: current surface regression tests pass, the new graph test passes, and rendered shell/full screenshots have no measurable geometry or copy difference at 390x844 and 375x667.

### 3. Wire progressive loading and lossless handoff

Add the universal entry orchestrator with the proven `React.lazy` + `Suspense` primitive. Before broader wiring, add a built-route test proving resumed HTML contains the restored screen server-side while fresh HTML and its initial browser request list omit the continuation chunk. Render the lazy child immediately when a server resume snapshot exists; otherwise render the fresh shell and reuse the post-paint scheduler. Start the same import immediately for local draft or interaction and pass the early selection into the existing quiz controller. The shell retains current analytics timing; every fresh-shell replacement suppresses only the full quiz's first texture screen-view, while an early-click handoff additionally seeds `quizStartedRef`. The shell never persists a draft. Preserve restoration precedence even if a local draft is discovered during an early selection race, then let the full quiz exclusively own persistence, history, and auto-advance.

Consumes: `FreshPersonalPlanQuizEntry` and shared first-screen component.

Produces: a fresh path with a dynamic continuation chunk and an immediate authoritative resume path.

Completion criterion: the SSR/request proof and all race, restoration, analytics, and transition tests pass; idle-ready and early-click replacements each emit one initial texture screen view, no duplicated click event or lost answer occurs, and a same-tick local draft wins without any shell draft write.

### 4. Add automatic continuation-load recovery

Catch dynamic-import failure inside the entry orchestrator. Retain the current texture choice and schedule a fresh loader attempt using exponential backoff capped at 10 seconds. Maintain only one timer and one active promise; pause while offline or hidden, then retry immediately on `online` or visibility return. Quiet prefetch failures stay invisible. If a selected visitor is still waiting after the tested threshold, expose only the reviewed passive German recovery status—never a button, blank state, or reload loop. Since a rejected module import is cached by the browser for the life of that document, allow exactly one automatic document refresh backed by one-time session recovery state; the full quiz remains the only draft authority. Report only the first failure to the normal error path without emitting one Sentry event per retry or putting Sentry back on the initial critical path.

Consumes: the entry coordinator and reviewed failure mockup.

Produces: one non-destructive, automatic recovery path requiring no visitor action.

Completion criterion: forced first-failure/second-success browser test proves that the built browser issues a fresh chunk request and reaches thickness with the original selection and no duplicate analytics; persistent failure remains single-flight, respects the 10-second cap and online/visibility pauses, and never blanks, reload-loops, or asks the visitor to recover it.

### 5. Prove material performance without accepting a cosmetic split

Run the unchanged verification environment against `16f90820` and the final tree:

- focused and nested Personal Plan tests;
- `PERSONAL_PLAN_QUIZ_V1_ENABLED=true npm run ci:verify`;
- production-build HTML/script graph inspection for fresh, server-resumed, and local-draft entry paths;
- gzip accounting for initial scripts and the deferred continuation;
- at least five alternating simulated-mobile Lighthouse runs per tree on `/lp/haarplan`, retaining every run and medians;
- throttled browser tests with the continuation artificially delayed beyond a fast click;
- 390x844 and 375x667 screenshot comparison, keyboard activation, browser back, reload/local resume, cross-browser resume, field-test banner, email preparation, and result transition.

Acceptance gate:

- remove at least 30 KiB gzip from fresh-entry initial JavaScript relative to `16f90820`;
- improve median simulated-mobile LCP by at least 200 ms;
- no regression greater than 50 ms median TBT, no CLS regression, and no first-click blank/spinner;
- exact normal-path visual parity and exact-once analytics;
- organic `/` initial scripts and journey remain unchanged.

If either byte or LCP threshold fails, stop before publication and report the split as non-material rather than lowering the gate.

## Verification

Automated:

- New progressive-entry unit/component tests with delayed, failed, automatically retried, offline/visible, and concurrent import controls.
- Existing `tests/personal-plan-quiz-funnel-entry.test.ts` and landing import-boundary suite.
- `npm run test:personal-plan:nested`.
- `PERSONAL_PLAN_QUIZ_V1_ENABLED=true npm run ci:verify`.

Manual/browser:

- Fresh load, fast click before continuation readiness, idle-loaded click, quiet prefetch failure, selected-wait automatic recovery, offline/visible recovery, local draft, server resume, field-test, back/reload, completion, email, and result handoff.
- Mobile screenshot parity at 390x844 and 375x667; desktop smoke at 1440x900.
- Five-run alternating baseline/final Lighthouse measurement and built-script gzip accounting.

Live state:

- None. Production field proof, deployment, and analytics monitoring require separate authorization.

## Implementation and verification receipt

- Combined branch versus current `origin/main`: fresh ads entry initial JavaScript `458,555` → `235,839` bytes gzip (`-222,716` bytes / about `-217.5 KiB`, `-48.6%`) and 19 → 16 initial scripts. The progressive-quiz boundary itself accounts for about `38.4 KiB`; the remainder comes from the preceding Sentry deferral commit shipped in the same branch.
- Five alternating simulated-mobile Lighthouse pairs on the exact rebased application tree: median LCP `4,686` → `3,381 ms` (`-1,305 ms`, about `-27.8%`), median TBT `59` → `50 ms` (`-9 ms`), CLS `0` → `0`.
- The full quiz continuation is absent from fresh HTML, starts after first paint, and server-resume proof HTML contains the authoritative restored thickness screen before hydration.
- Production-browser forced first-failure/second-success proofs passed for both an early fresh selection and a valid local draft: each performed one bounded automatic document refresh, issued a second chunk request, retained authoritative state, and reached thickness without a retry control.
- Persistent-failure proof remained on the first screen with the passive German status, exactly one automatic refresh, no reload loop, and no user-triggered retry.
- Normal first-screen screenshots were pixel-identical at 375×667 and differed by only 48 channels with maximum delta 2 at 390×844 (sub-pixel rasterization only); keyboard selection, in-quiz back, reload/local restore, and server-resume hydration passed.
- Organic `/` behavior is unchanged while its initial JavaScript drops from `399,062` → `216,628` bytes gzip (`-182,434` bytes / about `-178.2 KiB`, `-45.7%`) with the same 15-script count, primarily from the Sentry deferral.
- Focused progressive-entry/funnel/boundary/Sentry suite, all 1,872 Personal Plan tests, typecheck, repository lint (0 errors; 4 pre-existing warnings), and clean production build passed on the rebased tree.
- Counterpart code review found no primary-path blocking defect. Its local-draft failure-recovery finding was accepted and fixed. Its server-resume initial-script failure concern remains a low-probability residual: a component-level recovery cannot execute if that component's hydration chunk is the failed asset, and adding route-global chunk recovery is outside this deferred fresh-entry boundary. Its request for executable component-level analytics race tests remains a test-architecture follow-up; the current guards are source-contract tests plus production-browser handoff evidence.

## Review and handoff

- Worktree: `.worktrees/landing-performance-optimization`.
- Branch: `codex/landing-performance-optimization`, continuing from committed baseline `16f90820`.
- Counterpart plan review: **reconciled**. The accepted findings are recorded below; the LCP-metric tradeoff was rejected for the stated product reason.
- Evidence review: **confirmed**.
- User-journey sign-off: **confirmed**.
- Artifact disposition: this plan and both reviewed evidence assets are **commit** with the eventual implementation; benchmark reports, generated build output, and counterpart report are **discard** after findings are reconciled.
- Implementation authorization: **confirmed by Nick on 2026-08-20** after counterpart plan review.
- Stop point: verified, review-ready local tree. No commit of this implementation, push, PR, deployment, or production change is authorized yet.

### Counterpart findings ledger

| ID | Type | Evidence | Decision | Plan change | Revalidation |
| --- | --- | --- | --- | --- | --- |
| C1 | defect | A static full-quiz import can keep it in the route client graph | accepted | One universal lazy boundary owns fresh and resume paths | Disposable Next 16 prototype proved fresh exclusion and resumed SSR |
| C2 | defect | Existing funnel-entry test expects direct `<PersonalPlanQuiz>` rendering | accepted | Target map and task 3 explicitly replace that expectation | Focused source-contract test during implementation |
| C3 | defect | Current texture screen-view effect has no handoff idempotency guard | accepted | Shell owns initial event; bootstrap seeds a one-shot suppression flag | Delayed-import and back-navigation event-count tests |
| C4 | tradeoff | Delaying entry analytics until the full chunk resolves can lose or delay events | accepted | Shell owns screen view after draft check and synchronous click milestone/event | Import-failure test still records one click event |
| C5 | tradeoff | A client-only resume path could lose restored SSR | accepted | Use the same `React.lazy` boundary, rendered immediately for resume | Prototype HTML and browser request trace passed |
| C6 | tradeoff | JS reduction might help interactivity more than image LCP | rejected | Keep >=200 ms median LCP as a hard gate because visible landing speed is the requested outcome; TBT/CLS remain guardrails | Five alternating baseline/final runs; stop if LCP gate fails |
| U1 | scope/product decision | Nick rejected user-triggered recovery as poor UX | accepted | Replace the manual retry CTA with quiet automatic backoff and a passive waiting status only after selection | Updated recovery mockup and designed journey pending confirmation |
| C7 | defect | Idle-ready replacement could emit the texture screen view twice without a click bootstrap | accepted | Every fresh shell-to-full mount carries a one-shot initial-view suppression flag | Added idle-ready exact-once test and preserved later back-view events |
| C8 | tradeoff | Resume SSR depends on the lazy primitive after prototype disposal | accepted | Pin the prototype-proven `React.lazy` plus `Suspense` boundary and re-prove restored HTML plus fresh request exclusion before broader wiring | Built-route proof is a task-3 prerequisite |
| C9 | defect | Shell persistence could race and circularly become its own restored draft | accepted | Shell never writes drafts; authoritative full quiz owns persistence after restoration | Same-tick draft-wins test asserts no shell persistence call |
