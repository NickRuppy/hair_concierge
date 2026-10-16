# Regular quiz navigation state machine

Status: approved implementation, 2026-10-16; base `f3b78e81`. Personal Plan is a separate planned change. Nick explicitly selected regular quiz implementation next; there is no dependency on implementing Personal Plan first. Worktree `.worktrees/regular-quiz-state-machine`, branch `codex/regular-quiz-state-machine`.

## Outcome and scope

Centralize regular `/quiz` navigation, answer commits, lead-capture position, restore/reset, and delayed question advance in a reducer behind the existing Zustand store. Preserve the store as the React subscription mechanism. Make transition intent explicit so the shell does not guess restore versus navigation from object identity.

Keep current organic/scanner screen order, progress, German copy, question timing, Back and browser Forward-bounce behavior, local answer staging, storage schema/write timing, partner/discovery identity locks, migration/email-return entry, lead submission, preparation/result destinations, analytics, field-test and consent behavior. No new library, database/API migration, auth, paid-access, ranking, or cosmetic change. Async email checks/lead submission, preparation requests, and entry fetch state remain their existing owners. This proposal hardens stale delayed navigation; it does not claim a reproduced production bug.

Done when all production navigation/restore commands pass through the state owner, delayed callbacks have lifecycle/position admission, and current journey compatibility is executable and browser-verified.

## Evidence and chosen contract

`src/lib/quiz/store.ts` owns numeric step, lead substep/mode and answers, but commands mutate independently. `screen-order.ts` is already the authoritative package-dependent order: retain it. `src/app/quiz/page.tsx` directly replaces store state for migration and email-return initialization. `quiz-shell.tsx` infers restore by simultaneous step/answers identity changes; atomic answer-and-advance would break that heuristic unless it is replaced in the same change.

`quiz-question.tsx` single selection schedules an uncancelled generic goNext. `quiz-scalp-question.tsx` owns type/gate/condition phases with delayed phase and screen transitions. These are stale-callback risk seams, not runtime reproduction evidence. The scalp Back handler and browser-history provider cooperate on in-place history entries and must be integrated together.

### Machine and adapter

Add `src/lib/quiz/journey-state.ts` as a pure reducer for current store domain state, plus runtime navigation revision and explicit transition metadata in subscribable Zustand state `{id, kind: forward | back | restore | init | reset | package, from, to}`. Position includes lead substep where relevant. Existing `QuizStep` numbers, screen-order helpers, answer shape, identity modes, draft projection, and storage keys stay unchanged. Runtime metadata is never saved.

Store commands dispatch typed events: answer commit; answer-and-advance; next; previous quiz step; lead-substep change; lead identity mode; package resolution/fallback; restore progress; initialize migration; initialize return; reset. Replace page-level setState calls with owned commands. Preserve distinction between previous quiz step and lead-substep Back: existing lead-capture component overrides and identity locks continue to decide which domain event applies. Do not make goBack implicitly unwind the lead substep and then also unwind it in the browser provider.

`store.ts` executes reducer transitions synchronously and exposes existing production command/selector API where still needed. Extend with atomic commands used by migrated callers; no competing navigation state in hooks. Persist at existing forward/terminal/reset/restore boundaries only: do not start autosaving email/name, saving every keystroke, or saving Back navigation. The existing Zustand subscribe callback reads `nextState.transition` and `previousState.transition`; no ref-only metadata channel. Shell consumes explicit transition ID/kind, preserving snapshots and animations for accepted navigation and suppressing them for initialization/restore/reset/package remapping. Preserve progress motion from the accepted previous position.

Add `src/components/quiz/use-quiz-delayed-action.ts` for component-owned scheduled callbacks. Admission checks active mount, store navigation revision and source position, and local operation ID. It cancels on replacement/unmount and invalidates on local Back; obsolete callbacks are rejected even if the same numeric step reappears. Preserve regular quiz first-selection lock (unlike Personal Plan replacement policy). Standard single-select questions keep two temporal operations: commit the answer immediately and schedule an owned advance, then perform only next on the admitted timer. Atomic answer-and-advance is for explicit Weiter submission of standard multi-select answers and concerns/primary-concern completion; these already commit their locally staged answers immediately before goNext. Goals are different: each toggle currently updates the store, and Weiter only tracks the selection and advances. Preserve that immediate-toggle policy; goals uses plain next. Move the callers and replace the shell heuristic in the same integration task. No single-select answer is withheld until its timer fires. Multi-select staging remains local until Weiter.

Scalp disclosure keeps its existing component-owned local phase and animation UI. Route its callbacks through the delayed-action owner; local phase changes/Back invalidate their operation ID even when store step remains 6. Apply related scalp answer clears in one reducer command, preserving existing undefined/false distinctions. No new persisted scalp substep or browser entry. Only the existing three delayed operations use the scheduled-action owner: type-to-gate, no-issue-to-next, condition-selection-to-next. The yes-to-condition transition remains immediate, with its existing history push; invalidate any obsolete local operation without introducing a delay. Existing registered Back override remains the authority for type/gate/condition descent; each accepted forward phase adds exactly one current in-place history entry.

## Current journey compatibility

- Organic and scan_v1 follow screen-order.ts. Inserts do not add question progress or quiz_step_viewed events.
- Single selection advances after the same delay. Back/reset/restore/package change/disposal rejects obsolete callbacks; a first accepted selection remains locked as currently intended.
- Scalp type → issue gate → optional condition preserves progressive disclosure, answer clearing, in-place browser entries and reverse Back order.
- Regular lead capture remains name → email → consent. Partner/discovery remains locked identity → consent, with no hidden identity history entries.
- Local draft restore normalizes foreign-package steps and preserves running package authority. Migration entry and email-return reset retain their different identity-reset semantics, initial inert gate and failure/retry copy.
- Preparation continues to canonical result routing; legacy results/auth transitions remain compatible. No field-test completion may fall through to paid checkout.

No surface/copy/nominal timing/feedback changes, so no redesign mockup is required. Browser comparison is required during implementation. Any newly proposed recovery/validation/navigation policy change needs its own decision; do not hide it in reducer defaults.

## Decision coverage

Status: confirmed. Nick approved this regular-quiz implementation on 2026-10-16 after the detailed proposal and simple behavior/benefit explanation.

Confirmed with Nick: both quizzes, separate changes (2026-10-16 scope answer). Inherited: screen-order/draft/identity contracts above, current consent/entry/completion behavior. Confirmed with the implementation request: bounded navigation/answer extraction and stale timer rejection; retain separate async submission/preparation/entry owners. Implementation defaults: plain reducer behind Zustand, explicit transition metadata, small lifecycle timer adapter, existing phase UI retained. Open consequential assumptions: none. Coverage acknowledgement: Nick explicitly requested implementation of this regular quiz plan after the detailed proposal and benefit explanation. Internal revalidation: source inspected at f3b78e81 and final implementation/verification reviewed; counterpart availability is reported below.

## Ordered tasks

### 1. Reducer and store integration

Consumes current store contracts and screen-order helpers; produces `journey-state.ts` and reducer-backed `store.ts` commands, with unchanged persisted draft format.

Test-first for deterministic quiz logic. Extend `tests/quiz-draft.test.ts` where it already owns persistence/reset/package restore; add `tests/quiz-journey-state.test.ts` only for atomic transitions/answer reconciliation not already proved. Preserve exact behavior of signed package resolution, missing-package fallback, resetting identity and retaining package, lead-capture Back command semantics, terminal draft clearing, and atomic concern/scalp updates.

Done when production store commands have one state authority and existing persistence contract tests remain green.

### 2. Migrate all navigation consumers as one coherent integration

Consumes reducer store commands/transition metadata; produces shell, page, standard/scalp question integration and delayed-action hook. Update `src/app/quiz/quiz-shell.tsx`, `src/app/quiz/page.tsx`, `src/components/quiz/quiz-question.tsx`, `quiz-scalp-question.tsx`, and `quiz-browser-history.tsx` where required. Audit `quiz-goals.tsx`, `quiz-concerns-question.tsx`, scan inserts, lead-capture, welcome, preparation, legacy `quiz-results.tsx`, funnel package provider and identity context adapters for command usage; change only the callers required by the contract. Before removing the shell object-identity heuristic, verify all four existing replacement paths emit suppressing metadata: store.restoreDraft (restore), store.reset (reset), page migration initialization (init), and page email-return initialization (init). Package remapping also emits its own non-animated kind. Existing commands emit metadata as soon as Task 1 lands so the intermediate store remains compatible with unconverted callers. Do not rewrite email submission or page fetch orchestration.

Done when normal atomic answer-and-next transitions animate, restore does not animate, obsolete standard/scalp callbacks cannot navigate or push an entry, and browser Back fires one semantic action.

### 3. Verify actual lifecycle and browser boundaries

Consumes integrated components; produces `tests/quiz-delayed-navigation-dom.test.tsx` using real React and actual Zustand store with controllable timers. Primary cases: standard single selection then Back; store reset/restore before old callback; same-screen leave/re-entry; scalp Back within step 6 before delayed gate/next; unmount/StrictMode. Force-deliver stale callbacks to prove admission rather than only cancellation, with one mutation red check. Assert rendered step/phase and browser entry count. Do not add source-string grep tests or test-only production exports.

Sibling owners: `quiz-screen-order.test.ts`, `quiz-draft.test.ts`, `legacy-quiz-browser-history.test.ts`, `quiz-funnel-package-context.test.tsx`, `quiz-email-return-entry.test.ts`, and relevant lead/preparation tests selected by verification:plan. Route heavy checks through shared launcher; inspect coding-check status. Final typecheck/lint/format/diff once, plus ready-check and request-code-review. Hosted CI retains full gates.

Browser desktop and 390px mobile: organic and scan_v1 progression; Back during delay; scalp issue/no-issue paths and in-place Back; lead substeps; partner/discovery locked identity; local draft across package change; migration/email-return fixtures, preparation/result navigation, field-test completion boundary. Use existing local QA fixtures, no real lead email dispatch or production writes. Keep browser Forward bounce unchanged.

Done when event compatibility, stale callbacks, shell animation intent and browser history integration all pass, and no blocking review finding remains.

## Review, risk, and disposition

Self-review complete: store/persistence authority, distinct local scalp phase, shell atomic-update trap, identity variants, and two test boundaries covered. Counterpart review reconciled below. Risks: shell transition timing, duplicate browser entries, stale local phase callbacks, and accidental new persistence writes; verify at component/store/browser boundaries above.

Plan is a commit artifact for its own eventual PR. Created `.worktrees/regular-quiz-state-machine` from fresh main f3b78e81 and transferred this plan; source evidence revalidated before edits. Personal Plan source changes must not be bundled. Transient review output is discard after its findings are summarized. No prototype needed. Implementation authorized by the Execution authorization below; publication remains separately authorized.

## Rollback and counterpart disposition

Approved rollout posture: one structural cutover per PR, using normal pre-merge CI/preview validation and revert of that PR as the rollback. No dual state owners or runtime cutover flag. No persisted schema changes means existing drafts remain readable by the previous code. If verification exposes a real rollout hazard requiring a flag or changed recovery policy, stop dependent work and bring that changed choice back to Nick. Deployment is separately authorized. Task 1 retains the current public commands; Task 2 moves consumers coherently and must finish green before publication. This receipt covers only the regular quiz change.

Claude Opus 4.8, high, read-only terminal review, 2026-10-16: approve with revisions. Main verified and reconciled the findings:

| ID  | Type                   | Evidence                                                                                                     | Decision                              | Plan change                                                                                                                       | Revalidation                                                             |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R1  | defect / clarity       | Single-select commits before delay; multi-select commits and immediately advances in quiz-question.tsx:90-92 | accepted                              | Name exact immediate answer-and-advance callers; retain two temporal single-select operations and existing immediate goal toggles | Inspected standard question, goals and concerns callers                  |
| R2  | scope/product decision | Structural cutover has no stated rollback                                                                    | accepted with implementation approval | State per-PR revert, no schema changes, no dual owners; included in proposal approval                                             | Existing draft/API contract stays compatible; deploy still separate      |
| R3  | defect / clarity       | Shell subscribe receives next/previous store state                                                           | accepted                              | Put transition metadata in subscribable runtime state                                                                             | Verified subscribe callback signature in quiz-shell.tsx                  |
| R4  | defect / coverage      | Four replacement paths currently depend on identity heuristic                                                | accepted                              | Explicit prerequisites before removing heuristic, with init kind                                                                  | Verified store restore/reset and page migration/return state replacement |
| R5  | defect / audit clarity | Legacy results goNext consumer; provider/helper path ambiguity; synchronous scalp yes path                   | accepted                              | Add results audit, full component provider path already listed; keep yes synchronous                                              | Verified named production callers; only three scalp timers scheduled     |

Decision coverage revalidated: Nick approved regular quiz hardening and revert-only posture with the implementation request; Personal Plan remains a separate change. Undiscussed consequential assumptions affecting this proposal: none. No technical blocker remains in the revised specification; no repeated review for wording-only clarity. Review output is discard after this ledger.

Main rejected the reviewer's incidental suggestion that goals is a staged answer-and-advance caller: `quiz-goals.tsx:37-48` commits on every toggle and Weiter calls goNext only. The revised contract explicitly preserves this behavior.

## Execution authorization

Coverage acknowledgement: “Okay, please go ahead and implement the state machine plan for the regular quiz.” This approves the bounded extraction, obsolete-callback rejection, and per-PR revert posture already proposed. Undiscussed consequential assumptions affecting this handoff: none. Internal revalidation: fresh origin/main remains f3b78e81; original source seams match. Implementation only; publication remains separate. Earlier pending/planning statements above are historical proposal context, superseded by this authorization.

## Implementation and verification receipt — 2026-10-16

Implemented all three tasks on `codex/regular-quiz-state-machine`, base `f3b78e81edd0af404f5f4ef82ef48348fe9483d0`. One pure reducer now owns domain transitions behind the existing Zustand API; the store extends that canonical state type. Page initialization uses domain commands. Multi-select and concern submission commit answers plus navigation atomically. Standard single-select still commits immediately before its settle delay. The shell reads subscribable transition intent, and standard/scalp delayed actions have synchronous first-selection admission, lifecycle ownership and revision/source fencing. Scalp disclosure UI remains local; browser provider and screen-order contracts needed no production edits. Goals, lead submission, preparation, result routes and identity adapters retain their public command usage.

Decision coverage: **confirmed**. Original acknowledgement: Nick explicitly requested implementation of the regular quiz plan after selecting both quizzes as separate changes. Internal final revalidation: implemented only regular quiz, no new product choices, no dependency/schema/API/storage/copy changes; stale callback rejection and revert-only posture match the approved proposal. Undiscussed consequential assumptions affecting this handoff: **none**.

### Automated evidence

- Baseline selected quiz siblings: 48/48 passed.
- Actual-component red proof before hook integration: 8/8 timer cases failed at obsolete or repeated navigation, not fixture/import errors. These exercise real React, actual store, question/scalp components and browser provider.
- Reducer red proof: neutralizing atomic advancement made the atomic concern transition assertion fail (8 instead of 12); restored source passed.
- Final combined focused suite: **137/137 passed**, spanning new reducer and 10 DOM cases plus draft, screen order, browser history, funnel package, email return, primary concern, lead capture, preparation, main-problem sheet, draft gate, motion tokens and field-test UI. `npm run test:focused --` with the 14 named owner/sibling files in the final tool receipt.
- Timer admission mutation: replacing the callback guard with false made **9/10 DOM tests fail**, including disposal, Back, same-screen restore/reset/re-entry/package and duplicate callback delivery; restored source passed. Same-turn first-selection latch has a distinct batched-click test.
- `tests/legacy-quiz-motion.spec.ts` Chromium, one worker, against local port 3776: **3/3 passed**, including new atomic multi-select forward-animation/draft-restore case, existing forward/Back motion/progress and mobile landing overflow. Restoring the old identity heuristic made the new test fail because the outgoing transition was absent (null capture); source restored and 3/3 passed again. An initial fixture attempt was corrected because the fresh-quiz helper deliberately clears storage on every load; the new case independently seeds the production draft format and reloads without that helper. No production code was changed for a fixture failure.
- Final `npm run typecheck` passed. Final `npm run lint` passed with 0 errors and 28 existing warnings, with no introduced quiz warning. Targeted Prettier and `git diff --check` passed on all 12 intended files. Task server stopped normally after browser checks.

### Browser evidence and limits

Task server `http://localhost:3776/quiz`; CUA in-app browser after browser-use plugin failed backend discovery. Desktop: first answer advances, thickness answer immediately followed by Back returns to texture and stays. Mobile 390x844: normal questions, staged chemical multi-select/Weiter, scalp type/gate/condition, immediate yes, in-place Back, no-issue delayed advance interrupted by Back, and reload restoring the persisted scalp screen. Temporary viewport reset and browser tab closed. Mobile screenshot archived outside Git at `/Users/nick/.codex/visualizations/2026/10/16/01a14428-e18a-7c31-9347-018a11c73d18/regular-quiz-mobile.png`.

No complete live lead/email/result/field-test activation journey or signed scanner-cookie browser session was submitted. Those unchanged boundaries use focused sibling contract tests; no deployment or production writes were performed. Full hosted CI and application build remain for publication. Do not claim production end-to-end equivalence from these local checks.

### Review disposition

Main applied request-code-review's normal correctness and structural maintainability lenses (state model/concurrency and eight production files trigger the structural lens). Inspected complete source, all direct store callers and page initialization, shell subscriber, scalp phase and browser-history semantics, serialization/write boundaries and executable tests. **No blocking findings in the main review.** Simplified duplicate store state declarations to extend the canonical reducer state type. Verified missing-package fallback stays key-only rather than silently normalizing its screen; server-resolved package commands retain normalization.

Required external second-opinion attempt via claude-plan-review, model Opus 4.8, high, read-only terminal: **not completed**. CLI returned “You've hit your weekly limit · resets 3am (Europe/Berlin).” This is a review availability blocker, not an approval or a code finding. Do not publish as fully reviewed or claim counterpart approval until this lane can run. No automatic fallback, alternative billing or second reviewer was invoked. Main normal/structural review and verification are complete; final counterpart/publication gate remains open.

Artifacts: plan, eight source files, two new Node test files and one browser test edit are **commit** artifacts for eventual authorized publication. Mobile screenshot is **archive** outside Git. Transient local logs/reviewer quota output, mutation copies and generated test artifacts are **discard** after recording evidence; generated tracked test-results metadata restored byte-for-byte to HEAD. No task-owned unresolved artifact. No commit, push, PR, merge or deployment performed.

The canonical final content fingerprint is computed from the sorted relative-path/content-SHA256 manifest in the final tool receipt, after this plan is saved, to avoid self-reference. Main verification/review identify that same content; counterpart receipt is explicitly missing.

## Publication review update — 2026-10-16

Nick explicitly authorized “an adversarial code review with Codex … and then push,” substituting Codex for the quota-blocked Claude lane. This supersedes the missing-counterpart publication blocker above; Claude approval is not claimed.

An independent read-only Codex reviewer applied correctness and structural lenses to all 12 files at `f3b78e81..9be78ac15ea163922b842977f7938011a733f12c` and relevant callers. Independently confirmed the verified fingerprint `2a00c741f2972a5140997d523856828640c3d36f1b02eba1cd18d4e6ff029bc9`. Verdict: **No blocking findings. No blocking structural findings.** Main inspected the handback and reconciled it with the existing source/tests.

Review covered timer lifecycle/revision/source fencing, same-turn selection, scalp phase Back/history, atomic answer commits, persistence and metadata exclusion, shell animation/restore, package and identity initialization, goals/scan inserts and preparation/result callers. Potential same-screen local-answer restoration and repeated immediate scalp-yes history issues were identified as baseline behavior, not introduced regressions. No supported code correction was required.

Residual limits remain the documented unexecuted full lead/activation/signed-scanner journeys and pending hosted CI. GitHub main advanced to `264cbd5a` in separate consultation-admin files with no overlap in this branch's changed files. No rebase or unrelated changes were absorbed.

Final delta after the independent review: this documentation receipt only; application/test bytes remain unchanged. Main revalidated that delta; existing application checks remain applicable. The authorized actions are commit, push and draft PR creation. Merge, deployment and production writes remain separate.
