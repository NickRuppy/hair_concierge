# Stage 3 budget and recommendation refresh

Status: implemented and locally verified; no blocking introduced review findings; publication not authorized.
Revision: 4, 2026-10-16 (implementation and verification receipt).
Branch: `codex/stage3-budget-refresh-state`.
Baseline: `412ec3bd7ac8e8c06d3595291ff39f24ce29d426` (`origin/main` at creation).

## Outcome and contract

Extract the budget-save and recommendation-refresh coordination from the Stage 3 product-selection component into a small, explicitly modeled controller. A saved budget and recommendations that are safe to act on must remain distinct facts. Keep the current experience and recommendation semantics. The proposal explicitly includes applying latest-request admission to the post-save refresh, where the baseline lacks that check; do not describe that seam as a purely mechanical extraction or a reproduced bug fix.

Nick selected this scope after a read-only assessment and requested: “Okay, let's start with the budget and recommendation refresh in product selection. Can you put together a concrete plan for that?” Nick subsequently requested: “Okay, please go ahead and implement the budget and recommendation refresh plan.” This authorizes implementation and verification of this proposal, including the disclosed post-save guard; publication remains separately authorized.

- **Outcome:** one owner for budget authority, save/refresh lifecycle, and async-result admission; the existing component renders those states and keeps its product-selection responsibilities.
- **Constraints:** preserve surfaces, German copy, action availability, loading/error feedback, timing, request ordering, saved choices, recovery behavior, and all server-side authority.
- **Non-goals:** quiz, chat, ranking/allocation changes, new budget options, API/schema/storage changes, a general workflow framework, XState adoption, whole-component decomposition, and rewriting capture/finalization recovery.
- **Done when:** the ownership map, state/event contract, integration sequence, meaningful tests, compatibility checks, and counterpart findings are explicit enough for implementation without new product decisions.

## Evidence and chosen direction

Current owners (line references describe the baseline):

| Surface                              | Evidence                                                                | Consequence                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget context and lifecycle         | `src/components/personal-plan-products/stage3-products-flow.tsx:414`    | Required/active budget refs, save status, pending bundles, preview status, and preview counters are maintained separately.                     |
| Budget envelope interpretation       | Same file, `:1724`                                                      | `undefined` means no new information; `null` clears the requirement, not necessarily an already-known saved budget. Preserve this distinction. |
| Save then refresh                    | Same file, `:1913` and `:1958`                                          | A successful save is retained when the following refresh fails; confirming the same answer retries loading, without saving again.              |
| Projection of pending choices        | Same file, `:1998` and `:3329`                                          | A budget affects all review bundles; only still-allowed local choices survive. Current choice-preview responses have generation guards.        |
| Navigation/reset and resume          | Same file, `:1599`, `:3023`, `:3455`, `:3494`                           | Draft changes, returning to capture, restored choices, and conflict recovery participate in freshness.                                         |
| Domain state machine                 | `src/lib/personal-plan/products/state-machine.ts:1052`                  | Already governs draft progress and completion blockers. Keep this authority.                                                                   |
| Projection policy and reconciliation | `src/components/personal-plan-products/stage3-preview-projection.ts:43` | Reuse existing pure policy and reconciliation helpers; do not duplicate product or Oil/Heat rules.                                             |

Choose ordinary TypeScript discriminated unions and a pure reducer, with a small React controller for effects. Keeping the scattered setters would leave the coordination problem in place; replacing the entire journey or adding a state-machine library would exceed this bounded extraction. These are technical implementation defaults, not new product behavior.

## State, ownership, and effects contract

Use three explicit, related parts of one controller state. This is intentionally not one global phase: budget editing, background projection, and the host journey have different navigation rules.

1. **Budget authority:** `optional`, `required { suggestion }`, or `saved { value }`. Derive requirement and budget-active predicates from this union. An absent envelope preserves state; a null envelope changes `required` to `optional` but preserves `saved`; a saved envelope records its echoed value; a required envelope removes saved authority and preserves the unsaved answer as today.
2. **Budget save:** `idle`, `saving { request }`, or `failed { reason: conflict | unavailable }`. A refresh after a successful save cannot demote the budget to unsaved or cause the same answer to be posted again.
3. **Review lifecycle:** keep explicit substates for primary bundle loading (`idle`, `loading`, `ready`, or `failed`) and pending-choice projection (`idle`, `loading`, or `failed`). Requests carry a token and purpose. Primary loading includes initial/re-entry loading and refresh after a budget save. Projection keeps the accepted bundle snapshot while it runs: with a budget, choices/submission are blocked; without a budget, Oil/Heat previews remain advisory with their existing non-blocking failure policy. Do not collapse these into a global loading state that changes today's Back or rendering behavior.

The controller also owns the current monotonic request sequence and whether a saved budget still needs its post-save refresh, derived from the post-save loading/failed state. Do not keep independent host flags mirroring these facts. Safe-to-act predicates combine accepted primary reviews, budget authority, projection state, and the host's existing finalization/recovery guards; some fetch completing is insufficient.

The host continues to own `FlowPhase`, the budget answer/screen/return target, whether the budget step has appeared in journey progress, product capture, local choices/history, review bundles, presentation selections, pending-write recovery, analytics, and routine handoff. Those are data or separate workflows, not alternative sources of budget-refresh readiness.

Controller interface:

- Inputs: initial budget envelope, current draft identity/revision, gateway operations, and production callbacks for reading choice snapshots, applying accepted review results, canonical conflict reconciliation, and the existing error surface.
- Commands: `applyEnvelope`, `saveBudget`, `refreshAfterBudgetSave`, `previewChoices`, and `invalidateReviews` with the new draft/choice context.
- View: budget authority and existing `Stage3BudgetSaveStatus` adapter, authority-load status, preview blocking/failure predicates, and whether an unchanged answer requires refresh rather than a new save. The adapter still reports `saving` throughout save plus post-save refresh, preserving current input/Back disabling.
- Internal events: envelope received; save requested/succeeded/failed; refresh requested/succeeded/failed; context invalidated; conflict rebased; disposed. Effects invoke existing gateway/helper functions; the reducer performs no fetch, storage, navigation, analytics, or time-based work.

**Admission boundary:** every async path that can publish budget-related reviews must consult this controller before any host setters, storage writes, navigation, or completion continuation. Checking only inside the reducer after a caller has already written stale bundles is insufficient. Use one monotonic request token, not additional budget/choice version counters or a composite identity. Preserve the gateway's existing draft identity and `expectedRevision` inputs. Increment the token synchronously at every current generation-invalidation site and when a new save/review operation replaces the old one; success, failure, and cleanup can settle only the currently owned token. A disposed controller accepts nothing. Transport cancellation is optional and is never the correctness guard.

**Explicit proposed hardening:** `reloadBundlesAfterBudgetSave:2004` currently increments the generation, but `:2017` publishes the response without rechecking it. The new controller checks admission there before publishing and before the `loadBundlesForSavedBudget:1971` continuation. This is proposed technical stale-response hardening within the selected refresh scope, not proof of a currently reachable product defect. The baseline disables the budget inputs and Back while saving/refreshing (`:1389`, `:1879`, `:1893`, `:1914`, `:1959`); no normal interactive supersede sequence on this path was demonstrated in this planning turn. Preserve that disabling and request order. If characterization demonstrates additional user-visible behavior requiring repair, record and resolve that specific change before implementing it. This plan does not authorize silently broadening recovery policy.

**Exact authority-load ownership:** remove the host's writable `authorityStatus` state. All current assignments move behind controller events; the host only reads its compatibility selector. This status still means the existing primary loader/gate is settled, not permission to act independent of the budget/projection predicates.

| Baseline writer in `stage3-products-flow.tsx`         | Controller event/result                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Initialization `:544`                                 | Initialize primary load to `ready` with bootstrap, otherwise `idle`.                                                   |
| `resumeLoadedDraft:1627`, `prepareDecisionPhase:1837` | `primary_bypassed` for the need-revision checkpoint; host retains domain navigation.                                   |
| `holdDecisionsForBudget:1758`                         | `budget_required`; clear bundles and settle primary loader to `ready`, while the budget authority blocks review entry. |
| `loadDecisionReviewBundles:1773`                      | `primary_bypassed` for inventory-only/no-fit-review; preserve empty bundles and budget-gate bypass.                    |
| `loadDecisionReviewBundles:1776`                      | `primary_requested` with an admitted token.                                                                            |
| `loadDecisionReviewBundles:1815`                      | `primary_accepted`, after synchronous bundle commit.                                                                   |
| `reloadBundlesAfterBudgetSave:2005`, `:2019`          | Post-save `primary_requested` / `primary_accepted`; no direct host status writes.                                      |
| `applyReopenedDraft:3045`                             | `capture_reopened`; invalidate token and set primary loader to `idle`.                                                 |

Keep the existing system-error surface for failed primary loads. Its compatibility selector remains non-ready until acceptance; budget-preview failures retain their separate “Erneut prüfen” route. No caller may retain a second authority-status setter. Synchronous bypass events are not generic `setReady` commands: their current domain preconditions remain checked by their production callers.

Use one synchronous controller transition/admission snapshot for same-tick commands and callback guards; its React state is the rendered projection. This is the only permitted mutable mirror for this lifecycle. Do not depend on a render occurring before rejecting a duplicate save or superseded response.

**Accepted-result commit:** after ownership is checked, apply the existing reconciliation result through a synchronous production callback, then publish readiness in the same React update turn. There must be no await between admission, bundle/choice updates, and readiness. If applying the result throws, keep the operation failed/blocked. The controller must not expose an independently writable `setReady` escape hatch.

**Conflicts:** preserve the current canonical-draft reload, allowed-choice retention, user-visible acknowledgement, and one re-projection attempt. A rebase invalidates the earlier request and starts a fresh identity; an older finally block cannot settle the replacement. Do not add retry loops, backoff, or conflict-policy changes.

## Transition and compatibility table

| Trigger                                                             | Required result                                                                                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter decisions with a required budget                              | Open the existing budget step; no review choices become available.                                                                                             |
| Submit an incomplete answer                                         | No save, same screen. Capped answers still require the flexibility question; uncapped answers do not.                                                          |
| Submit a complete changed budget                                    | Admit one save; keep current disabling and loading feedback.                                                                                                   |
| Save fails or returns profile conflict                              | Keep the answer and existing retry copy; no review transition.                                                                                                 |
| Save succeeds                                                       | Record the echoed saved budget immediately, then refresh with current pending intents. Remain blocked until accepted reviews are applied.                      |
| Post-save refresh fails                                             | Keep the saved value and answer. Preserve the existing system error acknowledgement followed by Continue/Back retrying refresh only.                           |
| Confirm the same saved budget with fresh reviews                    | Return to review without a save or reload, as today.                                                                                                           |
| Confirm the same saved budget with pending/failed post-save refresh | Retry refresh, never save again.                                                                                                                               |
| Choose a product with an active budget                              | Project the whole proposal; disable choices and auto-submit until current projection settles. Preserve Back availability during this projection.               |
| Budget projection fails                                             | Keep choices and show “Passung wird aktualisiert.” / “Erneut prüfen”; submission remains blocked until retry succeeds.                                         |
| Projection changes offered products                                 | Preserve still-allowed choices and order; reopen any invalid choice using the existing helpers. Do not accept new server defaults on the user's behalf.        |
| Restore local choices on resume                                     | Refresh them under the current budget before they can drive completion.                                                                                        |
| Return to capture, change local choices, rebase, or dispose         | Invalidate obsolete results, including failure/finally callbacks. Never resurrect an old review or clear a newer operation's block.                            |
| No budget-dependent review                                          | Preserve the legacy advisory Oil/Heat merge/failure behavior and inventory-only bypass.                                                                        |
| Budget becomes required during completion                           | Reuse the existing continuation: retain decisions, ask for budget, refresh, and resume completion only after acceptance. Do not move write-recovery ownership. |

## Files and integration boundary

| File                                                                                  | Planned change                                                                                                                                                               |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/personal-plan-products/stage3-budget-refresh-state.ts` (new)          | Pure state/event types, initialization, transitions, and selectors for the above contract.                                                                                   |
| `src/components/personal-plan-products/use-stage3-budget-refresh-controller.ts` (new) | Production effect/admission owner; receives the actual gateway operations and synchronous commit callbacks.                                                                  |
| `src/components/personal-plan-products/stage3-products-flow.tsx`                      | Wire the controller; replace budget authority/save/preview refs and statuses and scattered generation manipulation; preserve rendering and host workflow ownership.          |
| `src/components/personal-plan-products/stage3-preview-projection.ts`                  | Reuse policy/reconciliation functions. Remove/migrate the generation comparison only if the new production owner fully replaces it; preserve other helper contracts.         |
| `tests/personal-plan-stage3-flow.test.tsx`                                            | Primary observable lifecycle proof through the existing custom component/hook harness and injected gateway. Extend its fixtures for deferred async ordering.                 |
| `tests/personal-plan-stage3-budget-refresh-dom.test.tsx` (new)                        | Small real React lifecycle proof using `tests/helpers/dom.ts` and Testing Library: callback publication/batching and disposal/remount behavior of the production controller. |
| `tests/personal-plan-stage3-preview-projection.test.ts`                               | Retain policy/merge/choice-retention proof; migrate the predicate-only stale-generation assertion to the integration owner if its production helper disappears.              |

Keep `stage3-budget-api.ts`, `stage3-budget-step.tsx`, copy, gateway wire contracts, server loaders, allocation rules, domain state machine, and persistence formats unchanged unless a mechanically required type-only import adjustment is demonstrated. No new production exports just for tests.

Review publication paths in `loadDecisionReviewBundles`, `reloadDecisionBundle`, `prepareDecisionPhase`, `continueBudget`, `loadBundlesForSavedBudget`, `reloadBundlesAfterBudgetSave`, `previewLocalDecisionBundles`, `restoreStage3ReviewDraft`, `reconcileReviewedChoicesAfterConflict`, `resumeLoadedDraft`, and `applyReopenedDraft`. Invalidation callers include ordinary/grouped local decisions, backtracking, restored-draft rejection, batch submission, and canonical conflict handling. Inventory these before editing so a direct async setter cannot bypass ownership.

## Ordered implementation tasks

### 1. Freeze observable behavior and prove the async test boundary

Consumes: this contract and baseline tests. Produces: an entry/publication/invalidation map and the lifecycle acceptance cases in the existing component harness.

- Re-read all budget lifecycle test cases around `tests/personal-plan-stage3-flow.test.tsx:6284` through its final budget tests. Reuse existing cases for save failure, budget editing, retained choices, completion continuation, failed reload, failed projection, and conflict recovery. This is a custom hook-dispatcher harness (`:533`), not a real React mount; if the implementation uses `useReducer`, add faithful dispatcher support in that test harness without mocking the production reducer or bypassing its admission logic.
- Add one deferred-promise integration scenario, table-driven for stale success and stale rejection/finally: start a projection, use real Back/change actions to supersede it and start the next projection, settle the obsolete one while the next remains pending, and assert the current review stays blocked with no submission; settle the new one and assert its visible defaults/choices survive any late obsolete outcome.
- Cover the post-save refresh publication/continuation boundary explicitly: defer its response, then dispose the real React owner and remount with another context; settling the old response must invoke no old commit, storage, navigation, or completion callback. Use the production controller's callback interface, not test-only exports. One real React case also observes that a synchronous commit callback runs before the rendered safe-to-act state changes; it does not repeat the full budget journey. This checks React scheduling/cleanup that the custom dispatcher cannot prove. Any newly exposed baseline defect beyond the explicitly proposed post-save admission hardening follows the scope rule below.
- Establish characterization before refactoring. Retained behavior cases should pass on baseline. A scenario for the explicitly proposed post-save admission hardening may expose the missing guard; label it as new hardening proof rather than an existing behavior receipt. If a new scenario exposes another reproducible baseline bug, record its exact trigger and stop treating that repair as behavior-neutral; resolve the scope under `diagnosing-bugs` before folding it into this change.

Done when: retained lifecycle cases describe current behavior; deferred-order cases and the concrete real React lifecycle fixture are ready to exercise the production controller in Task 2, with no source-text assertions or test-only controller seams. Do not add placeholder imports for not-yet-created production modules; land the new hook-dependent cases together with their owner in Task 2.

### 2. Implement and integrate the state owner

Consumes: the state/event and callback contract plus Task 1's entry/publication map. Produces: the new reducer/controller used by the real Stage 3 component.

- Introduce the state model, production hook, and Task 1's hook-dependent real React cases together; initialize from the current envelope/bootstrap behavior, including absent/null envelopes and inventory-only flows.
- Route budget save and post-save loading through it. Preserve the saved-value/refresh distinction, same-answer shortcut, current recovery acknowledgement, answer retention, and same-tick duplicate admission guard.
- Route pending-choice previews and all affected review publication/invalidation paths through the same owner. Reuse existing policy/reconciliation helpers and preserve legacy advisory mode.
- Derive render/auto-submit predicates from controller selectors alongside the host's existing write-recovery/finalization guards. Keep navigation permissions distinct from choosing/submitting permissions.
- Keep conflict and completion continuations explicit callbacks, accepted only for the current context. Remove superseded refs, setters, and helper aliases in the same task; no transitional second source of truth may remain in the final diff.

Done when: the component uses the new controller in production, no in-scope async path writes before admission, no superseded finally can unblock a replacement request, and all Task 1 behavior passes. New modules must stay limited to this lifecycle rather than taking over the journey.

### 3. Verify compatibility and review the integrated extraction

Consumes: final integrated content. Produces: command/content/environment receipts and a whole-branch review-ready handoff.

- Run the focused owner/sibling checks below, then the required combined checks once on final content. Do not run broad overlapping suites locally to reconfirm unchanged evidence.
- Contextually verify the existing budget/review UI on mobile and desktop, including real Back controls and error recovery, without changing copy or presentation.
- Use `ready-check` and the repository's `request-code-review` router within `implementation-loop`; include Claude's read-only whole-branch review before any authorized push. Evaluate structural ownership, not only test counts.
- Revalidate decision coverage; a discovered behavior change or broader architecture dependency returns only that choice for resolution.

Done when: contract cases pass, production callers own every new abstraction, the final diff removes the obsolete coordination, required reviews are reconciled, and no new consequential assumption is hidden.

## Verification ownership and commands

Existing primary owners:

- `tests/personal-plan-stage3-flow.test.tsx`: component/hook-harness lifecycle tests, notably failed reload at `:6909`, blocked failed projection at `:6948`, and conflict re-projection at `:6991`.
- `tests/personal-plan-stage3-budget-refresh-dom.test.tsx`: production controller under real React; independently owns batching/publication and cleanup/remount admission, which the existing custom harness cannot verify. Follow the existing jsdom setup pattern in `tests/personal-plan-routine-budget-gate-dom.test.tsx` and import DOM globals before React DOM/Testing Library. Assert public callbacks/view behavior, not internal reducer state.
- `tests/personal-plan-stage3-budget.test.tsx`: budget answers, approved copy, render rules, and comparison presentation; do not duplicate lifecycle cases here.
- `tests/personal-plan-stage3-preview-projection.test.ts`: whole-budget versus legacy merge policy and allowed-choice retention; its current generation predicate alone is not lifecycle proof.
- `tests/personal-plan-stage3-state-machine.test.ts` and `tests/personal-plan-stage3-category-capture-controller.test.tsx`: unchanged domain/capture boundary checks for affected integration.

Apply `test-audit` before adding/changing cases: name the observable invariant and credible regression, explain why the existing owner misses it, and use the production boundary. Do not add a parallel reducer suite that mirrors every component test. Additional reducer-only cases need a distinct invariant that cannot be economically exercised at the existing owner.

During implementation, use `npm run verification:plan -- --files <changed paths>` for focused routing; new module paths may require owner review. Before a heavy check inspect `~/.local/bin/coding-check --status`. Use the already-gated focused command, for example:

```sh
npm run test:focused -- tests/personal-plan-stage3-flow.test.tsx tests/personal-plan-stage3-preview-projection.test.ts tests/personal-plan-stage3-budget.test.tsx tests/personal-plan-stage3-budget-refresh-dom.test.tsx
```

Final local verification: focused owner/sibling files above (reuse receipts if unchanged), `npm run typecheck`, `npm run lint`, targeted formatting, and `git diff --check`, serialized through repository launchers. Respect the existing test loader/shims and two-worker limit; do not wrap already-gated commands again. Focused owners suffice locally because this extraction changes no server/domain contracts; complete Node plus nested Personal Plan coverage remains in hosted CI (`test:node` plus `test:personal-plan:nested`, avoiding the overlapping broad `test:personal-plan`), together with required build/Playwright gates after publication is separately authorized.

Browser verification: use `docs/local-qa-access.md`, `npm run dev:worktree`, and the existing Stage 3 lab or authenticated local journey. Check (a) required capped/uncapped budget, (b) edit and same-answer return, (c) slow/failed post-save refresh with answer retention, (d) projection failure/retry and Back during pending refresh, and (e) resume with local choices. Use the existing injected gateway harness for deterministic async order/failure proof; do not introduce production failure toggles or rely on real-network timing. Browser checks verify actual control wiring and presentation; the component tests own race ordering.

No migration, production data write, deployment, live activation, or new analytics instrumentation is required. Rollback is code-only to the prior controller wiring; storage and APIs remain compatible. During this planning turn run only document/reference/diff checks, not application verification, and do not claim implementation checks passed.

## Decision coverage, evidence, and handoff

- **Decision coverage:** confirmed for implementation of this plan.
- **Confirmed with Nick:** start with budget and recommendation refresh in product selection; quiz and chat are outside this task; produce a concrete plan.
- **Inherited from evidence or contract:** current budget options and copy; save-versus-refresh recovery semantics; full-proposal budget projection; retained-choice rules; server authority; existing legacy advisory mode; existing UI feedback and navigation permissions. Sources are the code and named lifecycle tests above.
- **Implementation defaults:** plain TypeScript reducer plus a production React controller; one request-generation token; preserve existing gateway/helpers; explicitly proposed admission guard on the post-save response/continuation; component-boundary tests plus a distinct real React lifecycle case; no new library or general framework. This is the concrete proposed implementation, not a claim Nick already approved unseen changes.
- **Open consequential assumptions:** none. If implementation evidence requires changed UX, timing, recovery policy, ranking, storage, or API behavior, resolve that change before implementing it.
- **Undiscussed consequential assumptions affecting this handoff:** none.
- **Coverage acknowledgement:** Nick's planning request and subsequent explicit implementation instruction quoted above; commit, push, deployment, and production writes remain outside scope.
- **Internal revalidation:** revision 4 carries the explicit implementation authorization above; source and lifecycle checks preserve the approved boundary. Planning revision 2 checked against baseline `412ec3bd`, current lifecycle tests, exact authority-status writers, budget-input/Back guards, the custom dispatcher, and repository workflow/verification contracts. Counterpart findings reconciled below. The proposed post-save guard is explicitly disclosed; no reachable baseline stale-publish bug is claimed.
- **User-facing evidence:** no mockup/prototype required for this internal extraction; no surface, copy, timing, or user-visible feedback changes are proposed. Existing user journey is specified in the transition table and verified contextually during implementation. Separate design/journey sign-off is not applicable.

### Review ledger

Counterpart: Claude Opus 4.8, effort `high`, 2026-10-16, read-only and terminal. Revision 1 verdict: “Approve with revisions”; no hard technical blocker. Revision 2 resolves the supported specification issues; no repeat review requested solely to obtain a cleaner approval sentence.

| ID  | Type                                | Evidence                                                                                                                            | Decision                                                                                                                                                                                                                                                                                                                                    | Plan change                                                                                                                                | Revalidation                                                                                           |
| --- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| R1  | Scope transparency / risk tradeoff  | Post-save preview publishes without a generation recheck at `:2017`; current budget controls and Back are disabled through refresh. | Accepted explicit disclosure and characterization requirement. The guard is part of the proposed refresh controller, not a silently approved UX/recovery change or a confirmed live bug. Rejected the claim that a hypothetical unproven stale path alone requires a new product-policy choice before a planning proposal can be presented. | Name the precise seam, proposed guard, unproven reachability, preserved lockout, and scope gate for other discovered behavior changes.     | Read `:1389`, `:1879`, `:1893`, `:1914`, `:1958`, and `:1998`; no live/runtime reproduction attempted. |
| R2  | Plan defect                         | `authorityStatus` has shared gating consumers and ten initialization/setter locations.                                              | Accepted.                                                                                                                                                                                                                                                                                                                                   | Give every writer an exact controller event; host retains no writable freshness mirror; distinguish primary load from advisory projection. | Enumerated all `setAuthorityStatus` references and consumers at `:982`, `:1016`, `:1441`.              |
| R3  | Maintainability tradeoff            | Existing counter plus gateway revision already covers current identity needs.                                                       | Accepted routine simplification.                                                                                                                                                                                                                                                                                                            | Remove extra budget/choice counters and composite identity; retain one token and existing gateway revision checks.                         | Current invalidation sites and request inputs inspected.                                               |
| S1  | Verification clarification          | Focused local checks versus full Node/nested coverage.                                                                              | Accepted.                                                                                                                                                                                                                                                                                                                                   | State the hosted CI complement explicitly.                                                                                                 | `package.json` and `docs/coding-verification.md`.                                                      |
| S2  | Orchestrator self-review / test gap | Existing flow harness simulates hooks and lacks `useReducer`; it cannot prove actual React batching or unmount.                     | Accepted.                                                                                                                                                                                                                                                                                                                                   | Describe the harness accurately, support actual reducer dispatch if needed, and add one distinct real React lifecycle owner.               | Inspected harness `:533` and existing budget DOM-test setup.                                           |

Accepted specification corrections are reflected above. Deferred findings: none. Decisions required from Nick to finish this planning proposal: none. Nick subsequently approved implementation of the concrete proposal including the disclosed post-save admission guard.

### Artifact disposition and stop point

- This plan: **commit** with the eventual implementation PR after explicit publication authorization; currently leave it as an uncommitted task-worktree artifact.
- Transient Claude review: **discard** after findings are incorporated and summarized in this plan.
- No mockup/prototype artifact.
- Root checkout remains clean on `main`; retain this task worktree for the approved next step.
- Next action: complete `implementation-loop`, verification, and review. Stop before commit, push, merge, deployment, or production activation unless separately authorized.

## Execution receipt (2026-10-16)

### Delivered and implementation adjustments

- Replaced the host's budget-authority/save/primary-load/projection flags and generation refs with the pure reducer and production controller. Gateway/API/schema/ranking/copy files remain unchanged.
- Latest-request checks run before host bundle/choice/storage publication and post-save continuation. Same-answer retry retains a saved budget and retries the failed read; same-turn duplicate saves are rejected synchronously.
- The controller renders reducer state via `useState` and uses one synchronous lifecycle snapshot for callback admission; a `useReducer` dispatcher shim was therefore unnecessary. The save callback ref updates in `useLayoutEffect`, after commit rather than during render.
- Existing controls disable choices and budget editing while a projection is pending. Instead of invoking disabled callbacks to fabricate overlapping user actions, real React controller tests cover request replacement success/failure and disposal/remount. A component test independently covers enabled Back while choices remain blocked.
- Corrected the existing custom flow harness to attach each effect cleanup to its own hook record. Its old first-matching-record search could attach controller disposal to an unrelated effect. The existing rejected-search test failed consistently with the added layout effect and passed after this test-support repair.
- That faithful cleanup exposed an introduced bootstrap-restart problem: resetting the once flag on every bootstrap dependency cleanup could clear pending projection blocking. Reset now occurs only on mount cleanup / StrictMode replay. The existing expensive-pick projection test proved red before this correction and green afterward.
- Removed the superseded generation-comparison helper and its predicate-only test; production async-owner tests now provide stronger executable proof. No test-only production exports were introduced.

### Verification collected

- Baseline before source edits: 121/121 focused flow, budget, and projection tests passed.
- New Back-during-projection characterization passed against baseline source in a temporary sibling module; a React import was added only to the throwaway copy to satisfy its standalone JSX transformation. Copies were discarded.
- Admission mutation proof: temporarily replacing the controller's current-request predicate with `true` caused all three selected disposal/stale-success/stale-failure tests to fail on obsolete callbacks. Exact source was restored. The guard itself was unchanged by later lifecycle refinements.
- Corrected final owner/sibling check: 169/169 tests passed across flow, budget, projection policy, real React controller lifecycle, domain state machine, and category capture controller (`/tmp/stage3-budget-corrected-final-tests.log`).
- Typecheck passed before the last layout/bootstrap cleanup refinements; final compiler receipt passed after those refinements. Full lint initially caught a render-phase ref assignment; after commit-phase correction, full lint passed with 0 errors and 27 existing warnings. Final full lint passed again after the mount-cleanup refinement, with the same 0 errors and 27 existing warnings.
- Browser: local task server on `http://localhost:3275/labs/personal-plan/stage-3?scenario=budget-required`, using only the in-memory lab gateway. Desktop: required 15 EUR budget plus flexibility, save-to-review, edit to strict 5 EUR, refreshed alternatives/notice and no automatic over-budget selection. Mobile 390x844: budget answer retention, uncapped choice skips the follow-up, and same-answer confirmation returns to the existing review. Original German UI and controls remained intact. Failure ordering/retries/resume use the deterministic component/DOM tests rather than real-network timing or production failure toggles.
- Browser runtime fallback: the browser-use IAB client could not discover its backend; CUA's IAB surface successfully ran the walkthrough. Temporary viewport reset, tab closed, and task dev server stopped through its terminal lifecycle.
- Browser screenshots are archived outside Git at `/Users/nick/.codex/visualizations/2026/10/16/01a14428-e18a-7c31-9347-018a11c73d18/budget-refresh-desktop.png` and `budget-refresh-mobile.png` in that directory.
- No production reads/writes, migration, activation, commit, push, PR, merge, or deployment performed. Full hosted CI remains unrun because publication is not authorized.

### Code review disposition

The repository router applied correctness and structural maintainability lenses; structural review applies because this is a state/async-ownership change. Claude Opus 4.8 (`high`) reviewed the uncommitted source/tests once, read-only and terminal. Main inspected the complete changed source, production callers, and tests; later layout-effect, mount-cleanup, and test-harness delta corrections were verified locally.

- C1: **rejected as an introduced regression**, retained as a verified pre-existing limitation. Replayed conflict followed by canonical-review reload failure against baseline `412ec3bd` and the final implementation using the same component fixture and faithful hook harness. Both displayed “Passung wird geprüft.” with no retry action; both assertions passed (`/tmp/stage3-budget-conflict-comparison.log`). The baseline primary-load check precedes the projection-failure retry branch, so the reviewer's claim that the baseline exposed “Erneut prüfen” was false. No recovery-policy expansion was implemented. Throwaway baseline modules included their original projection helper and were discarded after the probe completed.
- C2: zero-intent previews invalidate their request token. Retained intentionally: a result for choices that no longer exist must not publish; normal choice changes already invalidate. No additional counter or retry behavior was added.
- C3: outer post-save error catch is redundant when the controller's admitted `onFailure` handles the error. Non-blocking defensive code retained; it does not duplicate the callback or bypass admission.

### Remaining receipt work

Baseline/final conflict comparison completed (2/2 probes passed). Final `npm run typecheck` and `npm run lint` passed on the corrected source; lint has 0 errors and 27 existing warnings. Targeted Prettier and `git diff --check` passed. Base/HEAD is `412ec3bd7ac8e8c06d3595291ff39f24ce29d426`, branch `codex/stage3-budget-refresh-state`; root is clean on `main`. The canonical all-content fingerprint is computed in the final tool receipt from the sorted relative-path/content-hash manifest after saving this document (kept outside the document to avoid a self-referential hash). The durable plan and all seven source/test files are **commit** artifacts for eventual authorized publication. Transient logs/reviews/copies are **discard** artifacts once findings and results are summarized here; screenshot evidence is **archive** outside Git. No unresolved task-owned artifacts may remain.

### Final readiness decision

No blocking introduced correctness or structural findings. Decision coverage remains confirmed against Nick's explicit implementation instruction, with no undiscussed consequential assumption. User-facing design/journey approval remains not applicable: no surface/copy/options/ranking/recovery-policy change was introduced. The disclosed post-save stale-response hardening is implemented and mutation-tested.

All three implementation tasks are complete. Automated proof is the final 169-test owner/sibling receipt plus full typecheck, full lint, formatting, and diff checks; environment is local Node v22.12.0 with the repository loader/shims and shared verification slot. Browser proof is the task worktree's Next development build and in-memory lab walkthrough on desktop and mobile. Full hosted Node/nested/Playwright/build gates remain unrun pending separately authorized publication; no production equivalence or activation claim is made.

Residual limitation: the conflict-then-canonical-reload-failure loading screen without a retry action was reproduced in both baseline and final code. It is an existing recovery gap outside this extraction, not a newly introduced regression or a silently accepted new recovery policy. No new unresolved scope decision blocks the delivered extraction.

Artifact disposition is complete: plan plus seven source/test files are retained uncommitted for eventual authorized **commit**; screenshots are **archive** evidence outside Git; transient reviews, logs, baseline copies, and debug probes are **discard** after this summary. No task-owned artifact is unresolved. Task dev server and browser tab were closed normally. No commit, push, PR, merge, deployment, or production write performed.
