# Scanner cutover plan — revised after independent self-challenge

Read-only preparation, 2026-10-02, checkout `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, HEAD `21e0e41f`. This plan supersedes the 19-ready-cut conclusion in `/tmp/test-audit-scanner-layer-judgment.md`; that report retains exact names, callers, history and full-read accounting. No repository edits or runners were performed here.

**Final exact proposed reduction: 16 declarations, not 19.** Eleven have sufficient current proof; five require assertion transfers first. Three previous candidates revert to R. Reducer declarations would decrease 72 -> 56; UI declarations remain 104. This is additional to the seven UI cuts already applied, with no recounting or declaration regrouping. The parent owns integration, counterpart plan review, preservation review, all execution and final coverage proof.

## Outcome, scope, invariants

Retire the redundant reducer outcome/predicate assertions while preserving the live component delivery owner and independently reachable reducer guards. Change only `tests/scan-flow-state.test.ts`, `tests/scan-flow-ui.test.tsx`, and `src/lib/scan/scan-flow-state.ts`. Delete no whole file; add no production seam, new test declaration, fixture table or architectural abstraction.

Keep the real reducer and all live actions. Remove only the never-dispatched `camera_live` action union member/switch alias; make `isSheetOpen` private while retaining its implementation for `isDetectionPaused`. The 19-row report documents repository-wide callers and introduction history for both.

State and UI line numbers below refer to the current pre-cut files. Use exact names from the previous report when editing, not shifted line numbers.

## Self-challenge of all 19 original rows

| State line | Final mark | Literal assertion review and keeper |
|---|---|---|
| 132 | D | UI:362 observes scanning before deadline, then resolving from the token-bearing timer, then result. A wrong/missing token or kind prevents that actual timer/result dispatch from owning the slot. State:107 retains the exact active-request shape; no separate false-flag payload is externally consumed. |
| 140 | D | UI:362 awaits the actual timer while fetch remains deferred and requires the resolving sheet. Not a copied timer action. |
| 177 | C -> D after T1 | **Gap:** UI:595 currently proves child existence and outgoing identifier, not preservation of the entire unknown receipt/categories. Child is not rendered by this harness. Transfer exact receipt forwarding to the child before removal. |
| 262 | C -> D after T2 | **Gap:** UI:536 does not inspect submitting after the late success. State:320 proves close-time reset only, not that the late completion cannot set busy again. Transfer the post-completion busy assertion. |
| 356 | D | UI:778 search-open and UI:3127 wishlist-open props are each computed from exact auxiliary equality. Both exercise production callback -> reducer -> child. |
| 375 | **R** | **Gap:** every cited UI path explicitly supplies timeout/camera/manual; none dispatches an omitted searchReason. Keep the existing default-input assertion. Do not expose dispatch or narrow the optional action merely to delete a test. |
| 431 | C -> D after T3 | **Gap:** UI:961 checks submitting=false before settling the abandoned request, but only sheet visibility afterward. Transfer the final busy assertion. |
| 444 | D | UI:1023 checks error null and submitting false after the late failed fetch. The response still reaches real submit_failed; it is not discarded by an earlier request guard. |
| 512 | D | UI:692 already deep-compares exact savedState, including managedByScan, after the real onSavedStateChange callback. |
| 561 | C -> D after T4 | **Literal gap:** UI notices/retry labels distinguish all three reasons, but the existing assertions do not explicitly pin the recorded status/reason that the browser harness consumes. Add checks against the already-existing root data attributes for each existing reason row; no extra seam. |
| 570 | C -> D after T5 | **Literal gap:** restart copy strongly implies stalled, but the stored status itself is not asserted. Add the existing root data-scan-camera status assertion to UI:1140. |
| 584 | D + dead action removal | No runtime dispatcher, scanner callback, serialized protocol or dynamic action path ever uses camera_live. Only its type, switch alias and test exist; same at introduction 255ffa87. Real retry keeps State:574 and UI:1164. No replacement proof required for the dead action. |
| 592 | D + unexport helper | State:611 exercises the helper for all step kinds through its sole production consumer isDetectionPaused. Its auxiliary-alone false assertion is not independently observed by any caller: that consumer ORs auxiliary != none. No public helper contract survives once private. |
| 777 | D | UI:2808 already checks exact revealed alternatives and false animation. Retained State:828 deep-compares silent=true pending state with token/product, and exercises competing tokens; State:734 retains the explicit reveal contrast. No pending-state assertion is lost wholesale. |
| 960 | D | Retained State:982 deep-compares exact accumulated history after two real resolved actions. Same single append implementation, no distinct result branch in the deleted test (its actual input is not_needed only). |
| 1064 | D | UI:3297 proves exact active card ID. **Correction to earlier reasoning:** mere UI suppression does not prove the exact recorded winner; retained State:1219 explicitly asserts proactiveTriggerShown=wiederkehrer immediately after the same free/session2 resolve. State:1140 also checks both exact fields. |
| 1079 | D | UI:3315 exercises storage-derived sessions 1 and 3 and requires no proactive card. Card rendering is direct conditional on result+activeProactiveTrigger; the real result is established by scanInto and these fixtures cannot qualify other triggers. |
| 1093 | **R** | **Gap:** UI:3335 proves second card absent but not that the original proactiveTriggerShown remains wiederkehrer *after* that resolve. Setting it null after suppressing the current card could allow a third pitch while UI stays green. The remount tests do not close this gap: a null in-memory value skips persistence, leaving the old storage record intact. Keep this direct budget-preservation invariant. |
| 1187 | **R** | **Gap:** existing remount tests prove non-null suppression for a previously stored wiederkehrer; they do not prove exact kategorien_luecke survives hydration AND the following masked resolve. A coercion/overwrite of a non-null budget can pass those UI checks. Keep the direct identity/preservation assertion rather than inventing a new UI scenario solely for pruning. |

Final removal lines: **132, 140, 177, 262, 356, 431, 444, 512, 561, 570, 584, 592, 777, 960, 1064, 1079**.

## Mandatory transfers before removal

- **T1 / UI:595:** hoist the existing inline identified unknown HTTP fixture into a local immutable `identifiedUnknownResult`, return it from the fake endpoint, and before calling onSubmit assert `requireByType(flow.tree, ScanUnknownFlow, "ScanUnknownFlow").props.unknown` deep-equals that complete fixture. This independently checks identifier, category options and identified metadata supplied by the server; it does not compute expected output with the reducer/helper under test.
- **T2 / UI:536:** after resolving the deferred submit and settling, assert the always-mounted `ScanSearchSheet`'s `submitting` prop is false. That prop reads the shared real reducer busy field even though the unknown step was dismissed. Keep existing closed-sheet and unconditional analytics assertions.
- **T3 / UI:961:** after the late pending receipt settles, assert the search sheet's `submitting` prop remains false. Keep the pre-cancel true control, close-time false check and both final visibility checks.
- **T4 / UI:740 generated camera tests:** after onUnavailable and settle, assert `(flow.tree as AnyElement).props["data-scan-camera"] === "unavailable"` and `["data-scan-camera-reason"] === tileCase.reason` for each of the existing denied/no_camera/insecure cases. Keep distinct notice and retry assertions. Existing data attributes are consumed by Playwright; do not add an introspection prop.
- **T5 / UI:1140:** after onStalled and settle, assert root `data-scan-camera === "stalled"`. Keep Scanner absence, stalled notice, restart button, no auxiliary and no fallback event.

These transfers add assertions to their existing owning scenarios; no test-count reduction is achieved by merging unrelated declarations. Tests at State:375/:1093/:1187 stay untouched.

## Two F repairs in the same bounded cutover

- UI:3044 `T16 flag off: the bookmark never fetches a Merkliste count, even for a premium session`: replace the throw-only wishlist route stub with a counter plus a valid nonempty listing. Assert zero wishlist calls after settling; retain absent-badge assertion. A thrown mock is swallowed by flow:377-402 and is not a no-call oracle.
- UI:3070 `T16 free tier + merklisteEnabled: never fetches a Merkliste count and the bookmark still opens the Premium sheet`: same external counter/valid-listing approach; assert zero calls after mount and again after tapping/settling if using a single final assertion, preserving the actual interaction interval. Keep lock, absent count, Premium context and no-navigation assertions.

Do not count these F repairs as deletions. UI:3127's flag-off routing test has the same throw setup, but its asserted contract is routing. Leave it or use a harmless response stub; do not cite it as zero-fetch proof.

## Guards and layers that must remain

Keep direct stale resolve/timer tests State:149/:159/:189/:200/:219: production checks isCurrent before resolve dispatch, so UI cannot independently prove every reducer guard. Conversely submit success/failure in the nominated cuts still dispatch after cancellation (flow:832/:879/:905/:906); the UI actually reaches the guarded reducer.

Keep State:531/:546 wrong-product/no-result saved_state_changed: Flow rejects before dispatch. Keep State:734/:828 reveal product and same-product token races, :889 revealed-state reset, :909 already-visible free pitch reset on upgrade, :456 old submit token arriving while a new submit is still pending, :183 pending from resolve rather than from submit. Preserve all remaining R scopes in the original report, especially auth/access/request-version/privacy behavior.

Preserve UI:455's post-render pending decode, :399 confirm-window auxiliary dismissal, :992 already_in_catalog cancellation, :595 privacy/correlation, :1118 identifier-free submit; :1835 HTTP200-unavailable AND :2558 HTTP429; :2010 terminal prefill and :1611 exactly one recovery CTA; :1470 retailer GTIN callback AND :837 real Flow resolution payload; :2581 independent live-catalog/retailer mapped identities. No lower-layer/mock response claim replaces a server producer contract or real browser lifecycle.

## Execution and mutation acceptance (commands NOT RUN here)

After the parent's active runner has stopped, pin source hashes and run native baseline on the unedited slice:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/scan-flow-state.test.ts tests/scan-flow-ui.test.tsx tests/scan-use-latest-request.test.ts
```

Add T1-T5 and the two F repairs first. Run that same command. Then remove only the 16 exact state declarations, the isSheetOpen test import/export and camera_live member/label. Run the identical native command again, followed by `npm run typecheck` and `git diff --check`. Existing node:test/CI registration already includes both files; no routing edit. Parent completes the applicable changed gate, independent preservation review and full coverage comparison.

Perform each mutation separately on the actual owner, run only the designated keeper (native `--test-name-pattern` before the file argument), verify the expected assertion fails, restore source byte-for-byte and verify clean hash. Never leave one mutation while applying the next:

| Contract | Actual owner mutation | Required keeper failure |
|---|---|---|
| T1 complete unknown payload | In state `stepForResult`, make only unknown_product return an unknown object with `categories: []`, preserving its identifier/identified fields. | UI:595 new deepEqual fails on categories; existing identifier/analytics can otherwise stay green. |
| T2 late busy after return | In reducer submitted's `!owns` return only, return `{...state, submitting: true}` instead of state; do not open pending. | UI:536 new final busy assertion fails even though old final visibility/event checks remain green. |
| T3 late busy after auxiliary cancel | Same separate isolated submitted stale-return mutation as T2. | UI:961 new final busy assertion fails; old pre-completion busy check alone would miss it. |
| T4 unavailable record | In camera_unavailable, store a wrong reason such as no_camera for denied. | UI generated denied keeper fails exact root reason (and existing notice), proving real storage/render path. |
| T5 stalled record | In camera_stalled, store live instead. | UI:1140 fails new root status and existing tile/Scanner assertions. |
| F flag-off no network | In Flow wishlist-count mount effect, remove only `!merklisteEnabled` from its early-return guard. | Repaired UI:3044 zero-call assertion fails; restore. |
| F free no network | In same effect, remove only `tier === "free"` from the guard. | Repaired UI:3070 zero-call assertion fails; restore. |
| Current resolving timer | Make current resolving_sheet_due return state after its ownership guard. | UI:362 must fail missing resolving sheet. |
| Correct saved-state delivery | Return unchanged state after both saved_state_changed ownership guards. | UI:692 must fail exact savedState. |

The two F mutations can optionally first demonstrate that the old throw-only oracle stays green; do not interpret such a control as product correctness. T4/T5 mutations may fail earlier existing assertions too: that is valid behavior proof, not a claim that only the new literal assertion detects the mutation. The T1/T2/T3 mutations isolate the preservation gaps found here.

Completion requires native before/after green, expected mutant reds with verified restoration, no unintended source changes, and the parent's final global coverage within the user's allowed two-point tolerance. This plan does not claim those results. No provider call, deployment, publication or production write is part of the cutover.
