# Engine seven-cut preservation review

Read-only review in `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, 2026-10-02. **No assertion-preservation gap found in the seven applied cuts.** The first 18 controls have now been supplemented by two actual-owner controls resolving the earlier evaluator and ordering evidence limits. Final count: **20 caught controls and 40 clean surrounding runs**, across 12 restored source files. No repository edits, test executions, mutations, environment loads, provider calls, or database operations were performed by this reviewer.

## Scope and accounting

Reviewed the temporary and durable engine layer plans, exact cuts JSON, both complete file diffs against HEAD, all seven deleted declaration bodies, named retained keeper bodies and their fixtures, actual runtime/category/evaluator/reranker paths, control specification and actual executor, every recorded red log, and before/after TAP receipts. This is a bounded preservation review, not a fresh audit of all remaining declarations or every line of the large selection module.

`/tmp/test-audit-engine-cuts.json` contains exactly six declarations in `tests/recommendation-engine-categories.test.ts` and one in `tests/recommendation-engine-selection.test.ts`. There is no replacement declaration or table-row credit. The peeling title repair has zero removal credit. The unique benefits-reason test remains.

Actual complete two-file TAP receipts:

| Receipt | Pass | Fail | Skip |
|---|---:|---:|---:|
| `/tmp/test-audit-engine-before/tests.tap` | 107 | 0 | 0 |
| `/tmp/test-audit-engine-transferred/tests.tap` | 107 | 0 | 0 |
| `/tmp/test-audit-engine-after/tests.tap` | 100 | 0 | 0 |
| `/tmp/test-audit-engine-typed-after/tests.tap` | 100 | 0 | 0 |

The current keeper adds discriminant assertions before accessing the mask/leave-in metadata union. `highMetadata?.category === "mask"` and `idealMetadata?.category === "leave_in"` narrow the same values whose `fit_status` remains asserted as `supportive`. These changes occurred after the first 18 controls; the typed-after run is green. I do not claim those 18 controls were rerun on the narrowed syntax.

## Exact preservation decisions

Original donor lines below refer to HEAD; keeper lines refer to the reviewed current tree.

- **C75, severe category outputs → selection:263, insufficient-coverage fallback keeper.** The severe persisted profile and empty routine flow through the real persistence runtime. The complete donor assertion block is retained: shampoo relevant/action/full target; conditioner relevant/action/full target including fine thickness, medium weight, high repair and damage-driver forwarding; mask relevant/action/full target including need 3, fixed role, null request intensity, fine/medium metadata; leave-in relevant/action, heat bucket, heat styling, replacement relationship and ordered benefits; oil inactive. Expected literals were copied, not recomputed from category outputs. The `activeDamageDrivers` comparison still uses the independently returned damage assessment, now `runtime.damage`; this is the donor's existing cross-layer forwarding oracle, not a new independent damage-calculation oracle. Existing mismatch fallback assertions remain.
- **C406, explicit intensive low-need mask → selection:608.** The keeper now uses the actual request parser with `Welche intensive Maske passt zu mir?`, LOW profile, empty routine, and actual runtime mask decision instead of its former fabricated decision. It positively checks parsed intensive, relevant/optional, medium repair, intensive request and uplift note before the actual medium-over-low ranking. Both parser and uplift owner controls fail at the transferred expectations. Existing delivery/caveat assertions remain.
- **C549, high concentration supportive → selection:524.** The donor's protein balance, medium need, medium target weight and high product concentration are preserved. Donor null thickness/density versus keeper normal/medium does not open an independent branch: exact medium weight returns before the fine/density handling. The same actual high-concentration/medium-need branch produces `supportive` and the `mask_high_intensity_use_sparingly_caveat` reason. The retained `sparsam` text is derived specifically from that reason, not a generic fixture string. Current selection:560–565 asserts high-product supportive metadata and the actual sparsam delivery while retaining medium-first and private-reason absence checks.
- **C643, canonical leave-in fit → selection:692.** Both use the severe runtime target. The retained ideal product's replacement and styling roles, heat protection, repair/anti-frizz benefits, medium weight and towel-dry/pre-heat stages preserve the operative axes. The donor's fine-only suitability and keeper's all-thickness suitability both include the actual fine target and therefore take the same exact-thickness branch. Extra format/empty ingredient flags and explicit false heat activation do not change the evaluated branch for this fixture. The actual reranker calls `evaluateLeaveInFit`, then delivers its status in metadata. Current selection:732–735 requires the selected ideal product's leave-in metadata and `supportive` status. This logically preserves the donor scalar oracle. The first control changes metadata delivery; the supplemental control independently faults the actual evaluator and fails this same transferred status assertion.
- **C812, dandruff treatment/rotation target → selection:1243.** LOW profile overridden with oily scalp and dandruff plus empty routine is preserved. The full literal target is asserted: dandruff route, schuppen primary bucket, dehydriert-fettig secondary bucket, regular cleansing; thermal need remains none. Existing treatment-first rank and delivered matched buckets for both products remain. The now-unused test import is removed; the production export still has real callers through category assembly.
- **C1342, quiet category outputs → selection:2792.** The LOW profile and Gentle Shampoo/Daily Conditioner weekly_3_4x routine are equivalent inputs. Existing conditioner relevant/keep and mask/leave-in/oil inactive observations remain. All four formerly missing observations were transferred explicitly: bondbuilder, deep-cleansing shampoo, dry shampoo and peeling inactive. Each actual builder was independently faulted and each corresponding assertion failed.
- **S104, conditioner fit over semantic score → selection:263.** Ideal/mismatch specs and severe runtime remain. The keeper's mismatch semantic score .95 instead of donor .88 strengthens the same contrast; source uses additive fit adjustments followed by acceptable/fallback partition, with no intervening threshold on those two raw values. The transferred first ID `ideal` and first category `conditioner` are present alongside existing length, second mismatch and fallback-copy assertions. The first recorded control breaks partition cardinality; the supplemental control preserves cardinality and fails the transferred first-ID assertion by reversing the final groups.

**Retained distinction:** original C690 is current categories:578. It still asserts mismatch plus `leave_in_benefits_mismatch` for the no-benefits product. The overlapping selection candidate has independent heat/preparation failures, so exclusion alone would not preserve the benefits reason. Retaining this declaration is justified.

**F title repair:** current selection:2746 says peeling-type alignment is preferred when scalp focus is shared. Both products have oily scalp focus; only their peeling types differ. The ranking/type assertions are unchanged. The executor filters out the `F` specification entry, so no F control was executed; neither scalp-axis sensitivity nor an additional removal is claimed.

## Actual controls: 20 caught, 40 clean surrounding runs

`/tmp/test-audit-engine-mutations/receipt.json` has **18** controls, each one selected case before/red/after: before pass 1, red fail 1, after pass 1. All red logs contain the intended assertion failure and stack in the keeper; none is a loader, parser, harness or typecheck error. Log names are `<id>-{before,red,after}.log` in that directory.

| Control ID | Actual red observation |
|---|---|
| C75-shampoo-target-route | null rather than balanced route in transferred target |
| C75-conditioner-target-balance | protein rather than moisture |
| C75-mask-target-weight | null rather than light |
| C75-leavein-benefit-order | reversed ordered benefits |
| C75-oil-not-relevant | true rather than false |
| C406-request-parser-intensive | null rather than intensive |
| C406-mask-intensive-uplift | low rather than medium |
| C549-high-concentration-supportive | high product filtered out: undefined rather than supportive, not a direct mismatch-string comparison |
| C549-sparsam-tradeoff-delivery | empty delivery fails sparsam regex |
| C643-leavein-emitted-supportive | ideal rather than supportive in delivered metadata |
| C812-shampoo-target-route | balanced rather than dandruff |
| C812-shampoo-cleansing-intensity | gentle rather than regular |
| C812-thermal-none | low rather than none |
| C1342-bondbuilder-quiet | true rather than false |
| C1342-deep-cleansing-quiet | true rather than false |
| C1342-dry-shampoo-quiet | true rather than false |
| C1342-peeling-quiet | true rather than false |
| S104-conditioner-acceptable-partition | existing length assertion sees 3 rather than 2; transferred first-ID assertion is not the failing oracle |

The executor reads actual owner source, validates unique anchors within the named TypeScript function, runs native Node with the server-only registration and tsx imports, changes one source anchor, restores original bytes in finally, then runs the clean case. The real C406 scope is corrected to `inferMaskIntensityRequestFromMessage` by the executor. Selected native command shape is `node --import ./tests/server-only-register.cjs --import tsx --test --test-name-pattern='^<exact name>$' tests/recommendation-engine-selection.test.ts`.

The receipt covers **12** distinct production files. I independently hashed every current owner and checked equality with each receipt's original/restored hash and the frozen source record under `/tmp/test-audit-engine-original/`. No permanent owner change remains from these controls. The files are shampoo, conditioner, mask, leave-in, oil, bondbuilder, deep-cleansing-shampoo, dry-shampoo and peeling category owners, request-context, care-needs and selection. Complete hashes remain in the frozen `hashes.json`; all 18 control receipt comparisons are true.

## Supplemental controls: earlier evidence limits resolved

Independently read `/tmp/test-audit-engine-supplemental.cjs`, both complete red logs, the before/after logs and `/tmp/test-audit-engine-supplemental/receipt.json`. Each selects exactly one native case, changes one unique anchor scoped to the named actual function, restores bytes in finally, then reruns clean. Both are assertion failures, not harness failures:

| Control | Actual owner and fault | Actual failure |
|---|---|---|
| `conditioner-order-preserve-count` | `rerankConditionerProductsWithEngine`: final concatenation changes `[...acceptable, ...fallback]` to `[...fallback, ...acceptable]`; the same products and limit remain | Transferred first-ID assertion at selection test:341 sees `mismatch` instead of `ideal`. This closes the prior cardinality-only control limitation. |
| `leavein-actual-fit-supportive` | `evaluateLeaveInFit`: its unique final `supportive` status becomes `ideal`; emitted metadata code is untouched | Transferred status assertion at selection test:734 sees `ideal` instead of `supportive`. This closes the prior metadata-only control limitation. |

Both supplemental before/after runs have pass 1, fail 0 and skip 0; both reds have pass 0 and fail 1. Current source hashes independently match each supplemental receipt's original/restored hash and the earlier frozen originals: selection `ff08159b2568b8d466593bfd4afb7182d3a9d559cd45bef820877bcae6100053`; leave-in `2f152a32b7eecf621a2383d1439ba3e5f9b05ce9fee15e52d038af7e80d91124`. Tests were not changed for these supplemental controls. The typed keeper is exercised directly by the supplemental leave-in failure.

Totals are **20 actual-owner controls, 20 intended failed selected cases, 40 passing surrounding selected cases, and 12 distinct byte-restored source files**. There is no pending control from the two concerns raised in this preservation review.

## Remaining verification limits

The controls are representative faults, not proof of every target field, all fit axes or all arbitrary bypasses. In particular the supplemental evaluator control faults its final classification rather than every individual fit axis. The peeling title repair has no separately executed mutation and makes no scalp-axis claim. No whole-suite coverage/check/build outcome is independently established by this bounded report. Main reports the whole-239 proof completed with the same 26 failure names and coverage within the campaign threshold; that is main-owned evidence, not a test execution or independent full-suite review by this reviewer.

Production reachability is real: category assembly invokes these builders, persisted runtime invokes assembly, selector entrypoints (e.g. `selectConditionerProductsWithEngine`) and routine planner consume runtime output. Tests supply input profiles/spec maps but do not stub the reviewed category/evaluator decisions. CI's Node command includes both files (`package.json:49`, `.github/workflows/ci.yml:158`). Recent owner history includes binary heat protection (`6be9b148`) and chemical taxonomy (`cb6fb1b3`); none authorizes dropping distinct retained heat/legacy/benefit branches. Source cleanup is limited to the unused test import; no live owner/export is retired.

Final verdict: **no preservation gap found in the seven cuts. Their actual former assertions remain at the real runtime/selection boundaries; all 20 controls fail for their intended reasons and restore cleanly. The two earlier evaluator/ordering evidence limits are resolved.**
