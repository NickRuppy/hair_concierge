# Scan flow lower-state removal — preservation crosscheck

Read-only comparison: baseline `21e0e41f:tests/scan-flow-state.test.ts`, current `tests/scan-flow-state.test.ts` and `tests/scan-flow-ui.test.tsx`, current reducer `src/lib/scan/scan-flow-state.ts`, and scanner harness/flow wiring. The current diff removes 16 full lower-state declarations and de-exports `camera_live`/`isSheetOpen`; it does not change the reducer behavior other than removing the uncalled public action and private helper export.

## Exact donor → keeper mapping

| Removed baseline declaration | Current actual keeper / observation | Result |
| --- | --- | --- |
| confirm-window remains scanning | UI `:362-397` drives a camera decode and asserts viewfinder remains through delay before result | verified |
| `resolving_sheet_due` raises skeleton | UI `:362-439` reaches delayed resolve and observes skeleton/settlement; `:399-439` verifies timer/auxiliary interleave | verified |
| unknown resolve opens unknown sheet | UI unknown-sheet submit/recovery owner `:536-575` mounts from actual resolved unknown payload | verified |
| stale submitted cannot reopen viewfinder | UI `:536-572` dismissal path | verified |
| auxiliary search/wishlist opens over scanner | UI `:480-535`, `:879-925` observe live scanner/search lifecycle | verified |
| cancelSubmit late success dropped | UI `:968-1029` drives real dismissal then delayed success; no pending step | verified |
| cancelSubmit late failure dropped | UI `:1031-1088` drives real dismissal then delayed rejection; no error | verified |
| saved state applies to shown result | UI `:683-716` completes save and asserts A update/B isolation | verified |
| camera unavailable reason | parameterized UI `:745-790` asserts unavailable state, reason and retry affordance for all three reasons | verified |
| camera stalled distinct | UI `:1153` asserts actual flow tile state `stalled` | verified |
| `camera_live` recovery action | action had no production dispatcher after current `camera_retry` path; UI retry keeper under unavailable flow owns delivered recovery. De-export is safe; no lost user contract. | verified (dead action) |
| exported `isSheetOpen` truth table | helper is now private at reducer `:603`; the only production consequence is `isDetectionPaused` at `:612-619`, observed in UI (e.g. Premium sheet `:2813-2814`) and sheet flows. No external caller. | verified (private implementation) |
| silent reveal skips unblur | UI `:2817-2835` supplies masked result with spent credit, sees request/result and literal `revealAnimates === false`; this is the main control currently being run by main. | verified |
| category appended after resolved result | UI proactive tests scan actual result flow and consume category history at `:3315-3355` / fatigue sequence `:3355+` | verified |
| free session #2 fires Wiederkehrer | UI `:3315-3331` asserts delivered pitch and CTA | verified |
| session #1/#3+ do not fire Wiederkehrer | UI `:3333-3353` asserts both negative inputs | verified |

## Wiring/harness check and limits

`ScanFlow` derives `revealAnimatesAlternatives = scanRevealAnimates(state)` at `src/components/scan/scan-flow.tsx:946` and passes it to the result sheet at `:1104`; the UI harness reads that real card prop. It therefore reaches the reducer decision, not a copied expected boolean. The silent keeper’s `{ productId: "p-a" }` request is the same same-product background re-serve input as the donor, with an independent delivered assertion (`revealAnimates:false`) and no CTA invocation.

`camera_live` is absent from current `ScanFlow` dispatches; retry dispatches `camera_retry` at `scan-flow.tsx:711`, and the reducer maps it to `camera:{status:"live"}` at `scan-flow-state.ts:551-552`. `isSheetOpen` is referenced only by `isDetectionPaused`, so its direct truth table was implementation-only after export removal.

No lost case or false-passing keeper found. No transfer/new declaration/seam is needed. I did not run the control or any runner; the main session reported the return-`!silent` mutation control in progress, and this report does not claim its result. No source/test/provider/env/DB change was made.
