# Mask target alias: bounded follow-up

Verdict: the shared target is a real test-input isolation defect. A one-line fresh-target clone is justified as zero-quota maintenance. **There is no demonstrated clean-source verdict mismatch, existing false fail, or whole-suite false pass.** Current full and isolated tests can legitimately both pass while entering different branches. No test, owner, mutation, compiler or staging driver was executed during this follow-up.

## Exact observed alias and contracts

`tests/personal-plan/products/stage3-authority.test.ts:283` returns `TARGETS[category]` by reference. The default Mask target has repairSupportLevel medium. `knownFacts("mask")` independently creates a fresh spec with medium repair, light weight and moisture direction; it does not derive repair from TARGETS. Expected verdicts, product IDs, fingerprints and actions in the three callbacks are literal. This is shared INPUT contamination, not a shared expected-value oracle.

- Line1300, `Mask selects the best image-backed supportive candidate regardless of need tier`: changes the referenced repair target to high. Its rich/high candidate has one caution from weight, while rich/low has a second caution from repair. It asserts supportive, fixed one-caution recommendation ID/fingerprint, actions, basis-tier eligibility and exclusion of missing-image candidates. Its expected behavior requires high as explicitly assigned. It leaves TARGETS.mask high afterward.
- Line1367, `Mask v4 preserves catalog merchandising order among equally fitting candidates`: does not override repair. In isolation it receives medium; after the prior callback it receives high. Both candidates remain fresh medium facts. It asserts ideal, first merchandising ID and first fingerprint. The actual owner allows one-level shortfall, so medium-vs-high remains pass, just like medium-vs-medium. The clean literal outcomes therefore agree, but the equality branch is covered only when isolated or moved before the mutator.
- Line2547, `Mask uncovered-role recommendation ranks in a supportive candidate for a required tier`: explicitly sets high and uses a rich/high candidate. Fixed supportive verdict, candidate ID, exact supportive rule ID and actions remain correct in either order. It again leaves the default high. The later existing ideal-vs-supportive callback consequently inherits high too, although changing it is outside this bounded repair.

Supporting helper check: the R12 `maskCareDirectionInput` helper already makes its own copy before overriding careDirection/repair. It does not leak its27 table rows. The earlier `strongerThanRequestedInput` is itself structuredClone(idealInput), so its low assignment likewise does not leak. No new broad fixture cleanup is warranted.

## Actual owner reasoning and meaningful fault

`authority/categories/mask.ts:44–74` has an exact-equality fast pass, then a repair-specific rule: stronger product passes; one-step weaker passes; larger shortfall cautions. `evaluateProduct` aggregates any caution to supportive. Candidate ordering uses verdict, target overlap from actual comparison dimensions, caution count and catalog order. Medium/high and medium/medium both currently reach ideal, but through different branches.

The proposed source control is in actual `axisResult`, not the fixture:

```diff
-  if (product === target)
+  if (product === target && criterionId !== "mask.repair_support")
```

Keep the existing return and subsequent logic. A matched repair axis wrongly falls through to distance0 and becomes caution. A one-step lower product still passes. This is a credible regression in the category's equality/compatibility handling. It is valid source text by inspection, uniquely anchored; compilation and intended reds are pending main.

Predicted discriminating proof, with the actual same file and exact selected names:

| Tree/source | Selected tests | Expected result, not yet executed |
|---|---|---|
| Old fixture, clean source | mutator1300 + merchandising1367 | Both pass |
| Old fixture, clean source | isolated merchandising1367 | Pass |
| Old fixture, equality fault | mutator1300 + merchandising1367 | Both pass: target high leaked; merchandising takes untouched distance1 branch |
| Old fixture, equality fault | isolated merchandising1367 | Literal `verdict === "ideal"` fails with supportive |
| Repaired fixture, equality fault | mutator1300 + merchandising1367 | Mutator passes; merchandising literal ideal fails with supportive |
| Repaired fixture, restored source | three named callbacks, then full authority file | Green expected, no declaration change |

Why the first mutator should stay green under this fault: rich/high now has two cautions rather than one, but still wins by two rendered target overlaps (moisture+high repair) versus one for rich/low. Both remain supportive; fixed IDs/fingerprint/actions are unchanged. Actual `candidateDimensionCoverage` derives overlaps from fixed target/product axis positions, not the changed criterion pass count. This rationale was read, not executed.

**Do not report old full-file mutant green.** Other earlier equality fixtures and R12 cases can catch the fault, so the whole file may be red even when this merchandising assertion is masked. The bounded evidence is per-case order-dependent fault sensitivity. There is no need to claim a whole-suite blind spot to justify correcting accidental input aliasing. Also do not describe expected constants as generated from the owner; they are independent literals.

Exact native selected argv and source anchor/hash are in `/tmp/test-audit-stage3-mask-fixture-control.json`. Main should run the selected old clean/fault controls before applying the repair, restore source byte-exact, apply fixture repair, repeat the same real fault, then restore and run clean three/full. Source/test snapshots and exact failure stack must be retained. Harness/type/module errors do not count. No reorder implementation is needed because isolated-vs-pair selection demonstrates the branch difference with unchanged declarations.

## Narrow staged repair

`/tmp/test-audit-stage3-mask-fixture-edit.cjs` supports main-only `check` and `apply`. Changes:

1. In `input`, change only `target: state === "unsupported" ? null : TARGETS[category]` to a `structuredClone(TARGETS[category])` value. Unsupported remains null. Every call gets its own test target, including existing Mask mutators. No assertions, inputs requested by a callback, product code, category policy or declarations are removed or rewritten.
2. Update the now-stale R12 helper comment, preserving its existing explicit clone. This is comment-only; that callback/helper behavior remains byte-identical otherwise. No redundant-code cleanup.

Central clone is preferred to adding copies to only the two mutators because `input` is the factory supplying an independently editable target. The change is one expression and leaves category constants, knownFacts and all test callbacks intact. There is no new fixture-generation abstraction or test declaration.

Snapshot manifest: `/tmp/test-audit-stage3-mask-fixture-baseline/manifest.json`. The driver accepts only exact pinned original, Stage3-transferred or Stage3-cut authority trees already present in the previous guarded check artifacts. It rejects unknown bytes and is not a general patcher. All callbacks must remain byte-identical, AST count58 or57 unchanged, only two exact anchors may differ, and source is rechecked immediately before write. Check stages/parses in memory and writes only /tmp. This follow-up prepared the script and verified exact text anchors through Python; **the script has not been run**.

Prefer main applying this after the five-C driver finishes its cut: applying it earlier invalidates that driver's exact expected authority hash. Do not bypass either hash guard; integrate deliberately if a different sequence is chosen. Parent remains sole writer/operator.

## Risk and disposition

Recommend the small zero-credit repair before the final freeze if convenient. It removes real order sensitivity without changing a normative expected value. Deferral is not an unavoidable material product/coverage risk on current evidence: the complete authority suite already contains independent equality fixtures, the three current literal outputs remain correct, and no production source changes are proposed. Do not expand this into policy repair, new declarations, or a blanket test-helper rewrite.

Full reads in this follow-up: the three named callback bodies, input/common/knownFacts helpers, actual Mask owner, comparator, supporting rendered overlap logic, and existing R12 isolation helper. The adjacent later callback was read only to bound the leak; it is not a new owned audit/cut. Prior179-site ledger remains the separate full-cohort read. Main reports full seven-file367 green; this agent did not rerun it.
