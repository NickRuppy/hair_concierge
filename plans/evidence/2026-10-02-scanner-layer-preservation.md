# Scanner layer preservation review

Read-only independent review, 2026-10-02. Checkout: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; comparison HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`. This report supersedes the erroneous claim in the cutover plan that `scanInto` itself establishes a successful result.

**Verdict: no remaining preservation gap found in the revised 16-declaration cut after the positive-result repair observed at UI lines 3337 and 3348.** One real gap was found during review and repaired by the parent. This verdict concerns assertion preservation in this bounded slice, not global coverage or whole-branch readiness. I performed no repository edits, tests, mutation runs, or provider calls.

## Scope and exact accounting

The receipt `/tmp/test-audit-scanner-layer-cuts.json` exactly matches the 16 lost declarations in `tests/scan-flow-state.test.ts` against original HEAD: 72 -> 56 declarations, no new state declarations. The earlier seven UI consolidations are not credited again. The two F repairs and positive-result strengthening add assertions inside existing declarations. Three initially proposed reducer removals remain byte-identical to HEAD (listed below).

The reviewed permanent source change removes only the unused `camera_live` action member/switch alias and makes `isSheetOpen` private. The parent subsequently ran temporary source mutations; those were explicitly excluded from this review. Source-owner reasoning uses original HEAD and the permanent diff inspected before mutation execution.

## Gap found and repaired

The removed state test at original line 1079 directly resolves sessions 1 and 3 and checks `activeProactiveTrigger === null`. Its UI keeper, `F4: session 1 (no prior record) and session 3+ never show Wiederkehrer`, originally only checked no `ScanProactiveTriggerCard` after `scanInto`. That helper dispatches a decode, waits and settles; it does not assert success. A session-specific exception in the real resolved owner can be caught by `ScanFlow.resolve`, returning to scanning with no card. The old UI negative could therefore pass while the direct state test failed.

The actual current keeper at `tests/scan-flow-ui.test.tsx:3330` now asserts `cardProps(sessionOne.tree).result.product.productId === "p-a"` at line 3337 and the equivalent sessionThree assertion at line 3348, before each absent-pitch check. `cardProps` requires the actual result child. Both session branches now establish the successful result to which the negative pitch assertion applies. Restoring the reducer declaration was a valid alternative; strengthening the existing owner scenario is sufficient and keeps the revised reduction at 16.

The parent reported a planned session-specific throw mutation to validate this repair. That run is not assumed complete in this report.

## All 16 removed declarations: meaningful assertion preservation

State references in the first column are original HEAD; UI and retained state references are the reviewed current files. Exact removed names and offsets remain in the JSON receipt.

| Removed state line / contract | Actual remaining proof and assessment |
|---|---|
| 132, confirm window keeps scanning | UI:362 exercises the real decode callback, request and timer: sheet stays closed before the delay, resolving appears while the response is pending, and the eventual result renders. Retained State:98/:107 assertions pin active request kind/token. No independent current-request guard is removed. |
| 140, current resolving timer opens skeleton | Same UI:362 requires the actual token-bearing timer to expose the resolving sheet with a deferred response. Direct stale-timer and result-already-shown guards remain at State:123/:133. |
| 177, full unknown receipt opens unknown step | T1 at UI:596/:620 compares the actual `ScanUnknownFlow.props.unknown` deeply with the complete identified unknown HTTP fixture. It preserves the base identifier/categories plus source, DAN, name, brand, image and suggested category. `json(...)` crosses serialization; this is not an object compared with itself. Privacy/correlation and the outgoing submit payload assertions remain. |
| 262, dismissed unknown late success stays closed and not busy | UI:536/:565 requires the step sheet to stay closed after the deferred response; T2 at :572 reads the always-mounted search child's shared real `submitting` field and requires false after completion. The request's real submitted action still dispatches after dismissal, reaching the reducer guard. Existing exactly-once event/correlation checks remain. |
| 356, search and wishlist auxiliary identity | UI:782 opens the actual search and UI:3142 opens the actual in-flow wishlist via production callbacks; their open props derive from separate exact auxiliary values. The test did not assert omitted-reason defaults; that distinct test remains. |
| 431, cancelled search late success remains scanning, auxiliary closed and not busy | UI:965 proves true busy before cancellation, closed/not-busy immediately afterward, then closed result and search sheets after deferred success. T3 at :994 requires final false busy after that completion, not merely at close time. |
| 444, cancelled search late failure leaves error null and not busy | UI:1028 reaches the failed response after dismissal and explicitly requires search closed, submitting false and submitError null at :1048-1051. This exercises the actual submit_failed reducer guard; it is not hidden by an earlier resolve-generation check. |
| 512, correct saved-state update | UI:694 delivers the real onSavedStateChange callback and checks exact `{state: "merkliste", managedByScan: true}`, plus the flow behavior. Wrong-product/no-result direct guards remain because Flow can reject those before reducer dispatch. |
| 561, unavailable camera stores each reason | T4 in UI:742 checks existing root data-scan-camera=unavailable and data-scan-camera-reason for denied, no_camera and insecure. Separate notices, retry affordances, search reason and analytics remain. These are production root attributes, not new test-only state exposure. |
| 570, stalled is distinct camera state | T5 at UI:1145/:1150 requires existing root status=stalled; Scanner absence, restart notice/button, no auxiliary fallback and no fallback analytics remain. Object-shape extras with no consumer are not treated as a distinct public contract. |
| 584, camera_live recovery | The action has no non-test dispatch/callback/serialized caller, including its introduction. Its removal retires the dead seam with its test. Live camera_retry behavior remains in the direct state test and UI:1170 actual remount/retry path. |
| 592, isSheetOpen predicate | Now-private helper's sole non-test consumer is isDetectionPaused. Retained State:473 covers every step kind, bare scanning, both auxiliaries, saving and combinations. The old auxiliary-only false result is not separately consumed: the only caller also ORs auxiliary presence. |
| 777, silent reveal state/results/animation | UI:2814 checks exact revealed alternatives, false reveal animation and request/product identity. Retained State:669 pins exact silent pending state with product/token and same-product competing token outcomes; State:595 preserves the explicit-animation contrast. No copied-state UI fixture substitutes for these direct guard assertions. |
| 960, category appended to history | State:813 applies actual resolves and deeply requires the accumulated two-entry history. The deleted test's actual fixture exercised not_needed only despite its broader title; the same append is already required by the retained exact history assertion. |
| 1064, free session 2 active and recorded winner | UI:3312 requires exact active Wiederkehrer and its routine gate context. State:1021 explicitly requires recorded proactiveTriggerShown=wiederkehrer immediately after the same free/session-2 resolve. No claim that absent UI alone proves stored fatigue identity. |
| 1079, session 1 and 3 have no pitch | UI:3330 derives both session counts from real storage inputs, now requires a rendered p-a result for each, and then requires no proactive card. The newly added positive controls close the swallowed-error false pass described above. |

No unrelated auxiliary unknown no-error fields are credited to a child-existence assertion. In particular, removed State:177 asserted the full unknown step/receipt, not submission busy/error; those submission contracts remain directly tested or explicitly observed by the separate UI failure/cancellation scenarios.

## Three intentionally retained independent contracts

All three restored bodies were compared with original HEAD and are unchanged:

- State:323, `auxiliary_opened: the search sheet remembers why it was opened`: the omitted searchReason default is independent of UI paths that explicitly supply manual/camera/timeout.
- State:895, `fatigue: once a proactive trigger has fired, a later resolve's own card is suppressed`: pins original recorded winner after the second resolve. Merely hiding the second card or remounting from old storage cannot prove that in-memory preservation.
- State:989, `fatigue_hydrated: re-seeds an empty budget from a persisted value (simulates a remount)`: pins exact kategorien_luecke identity both after hydration and following masked resolve. Non-null UI suppression is weaker.

Other retained guard distinctions remain material: stale resolve/timer actions can be prefiltered by Flow's request ownership, unlike late submit success/failure; saved-state wrong-product actions can also be prefiltered; reveal product/token races need direct owner proof. No additional cuts are proposed here.

## F repairs and observation intervals

UI:3050 now increments an external wishlistCalls counter for `/api/scan/wishlist` and returns a valid nonempty listing. The zero-call assertion at :3065 observes mount plus settle. It cannot be satisfied merely because the production catch swallowed a stub exception. The absent-badge assertion also remains.

UI:3081 uses the same independent counter and valid listing. Its final zero-call assertion at :3105 observes the entire mount, settle, bookmark click and post-click settle interval. Locked state, absent badge, exact Premium context and no navigation remain. A single final monotonic counter assertion covers that full interval; a duplicate assertion before the click is unnecessary.

UI:3142's separate routing scenario still has a throw-only stub, but it is not cited as evidence of zero requests. The F repairs receive zero deletion credit.

## Verification, review depth and limits

During the preceding layer pass I fully read both scanner UI/state test files, ScanFlow, ScanSearchSheet, scan-flow-state, use-latest-request, verdict-access, trigger rules, session-marker, motion-loader, scan route and page client, plus use-latest-request tests. This preservation pass compared the full relevant permanent diff, all 16 removed bodies against original HEAD, complete affected keeper/transfer bodies, the three restored bodies, the two F repairs and the final session-result repair. Exact receipt accounting was checked statically: 72 -> 56, 16 removed, zero added, matching removal names.

Scanner callback interface/forwarding and useScannerLoop recovery were sampled; browser scan-flow.spec was inventoried and its camera section read, not fully reviewed. Other search-motion/intake suites were inventoried only and were not used as deletion proof. API/auth/persistence suites were not reviewed or pruned. The UI harness executes the real reducer/component callbacks but does not render child components or reproduce real ReactDOM lifecycle timing; the retained browser/lifecycle/producer contracts are not replaced by this review.

The parent reports the transferred focused suite green (186 cases), post-cut focused suite green (170 cases), and nine expected-red actual-owner mutations restored byte-identically. I did not rerun or independently inspect those execution logs in this review. The session-specific throw control, post-repair focused run, typecheck, full-suite result and global coverage comparison belong to the parent's final proof; no future result is assumed here.

Changed by this reviewer: only this `/tmp` report. Final preservation finding count: **zero open; one repaired during review**. Net supported scanner layer reduction remains **16 declarations**.
