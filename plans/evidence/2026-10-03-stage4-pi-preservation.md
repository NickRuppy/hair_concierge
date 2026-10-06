# Applied Stage4 + Product Intake preservation review (current302)

## Scope and current fingerprint

Read-only crosscheck only: the seven Stage4 files named in the staged driver, their five affected owner paths, and the one Product Intake HTML-renderer declaration/keeper. I did not execute a runner, mutate source, or inspect unrelated campaign cohorts.

Current test hashes:

- `tests/personal-plan-stage4-source-sync-api.test.ts` `6c9b6ddf54b3c289d8d83ce0e8ac65ba22fccdaa96c006c27371512923bfd601`
- `tests/personal-plan-stage4-persistence.test.ts` `d224c8d93d581c74d26313b27c64cc62733e7149b8eafd79ecc58d301da2c3df`
- `tests/personal-plan-stage4-api.test.ts` `958ad518422c2d68d28f93ef64cc2cbb158279a9ae6312050a4d453146e783fb`
- `tests/personal-plan-stage4-product-detail-api.test.ts` `09872292c513a0e464461a50164dc6ff7b57af3a9d249b74b97d4352e147e4aa`
- `tests/personal-plan-stage4-compiler.test.ts` `4f8f1dfb0f780bf3197f3436e410f64ad9ad8ac2d80b968f513a292c6547fd8d`
- `tests/personal-plan-stage4-acquisition-api.test.ts` `b57abfdc4917b1383b1f2d1f7712552556b38f85c4845fa91b9189206ee065c5`
- `tests/personal-plan-stage4-source-reconciler.test.ts` `45f4321ed5f84f90800e9ff77e7ed73819edee57be8ab1bb5cfb6fcdb2592813` (unchanged by this batch)
- `tests/product-intake-review-app.test.ts` `d417964c7b7927add94c237665468bb3adb8d0cdcbcb284c2be9de12ddf45268`

The Stage4 receipt records 13 source faults, each with identical source before/restored SHA; the old-control receipt records the two deliberately insufficient originals. The PI receipt records restoration after both controls. These are recorded results, independently checked here by reading each receipt and red TAP assertion; I did not reproduce them.

## Stage4 verdict: preservation supported

The two deletions are backed by same-input keepers and the literal observations are present in current bodies.

| applied item | current keeper and exact retained observation | actual owner/control result |
|---|---|---|
| C1 removed `two changed claims stage one complete deterministic successor delta` | `source-sync-api:1284` reverses the same two claims, loads the same two owned products and captures `stage`; it retains `sourceKey === user-product-a`, sorted direct `[item-0,item-1]`, empty consequential, changed fingerprint and two null finish receipts at 1349–1357. | `createRoutineSourceSyncService` owns selection/delta/staging. Five valid mutations each fail the claimed assertion: wrong selected key (`b` vs `a`), missing direct item-1, leaked four consequential entries, stale fingerprint, and two `source_revision_conflict` finish codes. The captured source path therefore reaches, rather than merely mocks, each transferred oracle. |
| C2 removed `reused exact identity still synchronizes an explicit acquisition source event` | `acquisition-api:20–30` keeper calls actual `acquire` and checks exact `load → owned:plan-a:oil:product-oil → sync` once and returned recorded/staged/no-retry result. | `createRoutineAcquisitionService.acquire` calls `loadPlannedItem`, `recordOwned`, then `sync` (`acquisition.ts:29–48`). Omit-sync and duplicate-sync faults red the keeper with the expected call arrays. The removed opaque receipt spelling has no read by that service. |

The repaired retained checks also reach their intended owner conditions:

- F4 (`persistence:398–422`) records `assumptionsActive("owner")` before it throws, while retaining accepted result and sole confirm RPC. In `createRoutineProposalService`, the failing/omitted reader is deliberately an unknown state that retains the assumption (`proposal-service.ts:115–125`). The bypass and wrong-owner faults red `["owner"]`; the old version passed the bypass fault.
- F6 uses the actual attention dependency surface (there is no client in `PersonalPlanRoutineAttentionRouteDeps`, `attention/route.ts:15–19`). Its bounded `{hasPendingProposal}` response reds when journey facts leak and when the disabled flag is bypassed. This is a valid removal of an impossible fake-client receipt.
- F7 retains the *routine GET* factory receipt, where the source only creates the admin client after enabled/auth/journey Stage4 gates (`routine/route.ts:27–47`). Its `constructed === false` reds if the factory is moved before the failing journey load. Separately, the attention call uses an actual Stage3 journey with `hasPendingRoutineProposal: true`; weakening the attention frontier redacts the expected false response. The old fixture omitted this pending fact and passed the same bypass, so the input repair is material.
- F2/F3/F5/F8/F9 only narrow titles; their callback bodies remain. F8 still executes planned/no-plan/forged product routes, and F9 still applies replacement before cadence against the stable assignment key. No new deletion credit is implied.

All 13 keeper red logs have a specific assertion mismatch (not a generic process failure): five C1, omitted/duplicated C2 sync, missing/wrong F4 owner read, leaked/bypassed F6 output, early F7 read-client construction, and weakened F7 frontier. Receipt before/red/after is green/red/green for each; the recorded batch also says 26 surrounding focused tests stayed green and the parent’s formatted 14-file focused run had 287 passing cases.

## Product Intake C1 verdict: supported, narrow

The single deleted declaration was `review app can bulk approve all properties` from the baseline at `tests/product-intake-review-app.test.ts:1209`. It had only two render-string checks: private callback spelling `saveAllPropertiesApproved` and visible text `Alle Eigenschaften passen`.

The same `renderAppHtml()` input appears in the retained `review app explains broken images and final image metadata` at current `tests/product-intake-review-app.test.ts:1026`; it retains the exact visible label at line 1063. The current renderer emits that button at `scripts/product-intake/review-app.ts:3138`, wires the private listener at 3188, and defines the bulk loop at 3433–3458. A consistent private callback rename makes the deleted donor fail but leaves the retained label keeper green; changing the public label makes the keeper fail. The receipt restores bytes after both controls.

This establishes only the duplicate label transfer and the donor’s private-name sensitivity. It does **not** prove click/POST-loop behavior, and neither the deleted donor nor retained keeper did. The removal therefore must not be described as execution coverage for `saveAllPropertiesApproved`; no renderer or operator source cleanup is unlocked. The older script remains an executable review-app path, so this is one declaration deletion only.

## Limits and conclusion

Independent preservation verdict: **supported for the two Stage4 cuts and the one narrowly described PI render declaration; no meaningful lost oracle found within this bounded scope.**

This is not a full native/coverage rerun, provider/DB/browser proof, whole-Stage4 audit, or a claim about unrelated Product Intake app routes. The focused 287-pass result, 13 mutations, surrounding greens, and byte restoration are parent-recorded evidence; only the receipts, literal assertion mismatches, current input fixtures, and production owner paths were independently read here.
