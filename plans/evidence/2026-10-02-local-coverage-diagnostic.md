# Final129 local coverage diagnostic — 2026-10-02

Read-only comparison of `/tmp/test-audit-baseline/coverage-final.json` with
`/tmp/test-audit-retirement-final129-proof/coverage-final.json`. For every raw
per-file metric below -2.00pp, I compared `git show HEAD:<path>` (the pre-prune
source) to the applied worktree source and inspected Istanbul function/branch
maps. No runner, provider, or repository file was touched.

## Result

No metric identifies a newly-uncovered surviving live branch or function. Each
loss is caused by removal of already-covered dead code, plus esbuild-generated
module/export mapping entries changing with the export list. This is a local
attribution conclusion only: the governing global and fixed-original-denominator
comparison remains the parent proof.

| Owner and metric | Before -> after | Changed source / coverage attribution | Residual live coverage check | Keeper gap |
| --- | --- | --- | --- | --- |
| `src/lib/waitlist/tokens.ts` branches | 13/15 (86.66%) -> 7/9 (77.77%), -8.89pp | `HEAD` removed `issueWaitlistSurveyToken` (`:3-6`) and `verifyWaitlistSurveyToken` (`:12-16`). Their two source branch maps were covered; four of the six denominator changes are generated line-1 import/export maps. | Retained `hashWaitlistSurveyToken` is now `:3-5`; its source branch remains executed (after count 5; pre-removal count 11). | None from coverage. |
| `src/funnels/landing/registry.ts` branches | 11/14 (78.57%) -> 7/10 (70.00%), -8.57pp | `HEAD` removed only `hasLandingVariant` (`:11-13`); its source branch was covered. The remaining three denominator entries are generated export mapping changes. | Live `renderLandingVariant` stays at actual `:6-9`; its render branch is still covered (4) and its null alternative remains intentionally uncovered (0), exactly as before. | None. |
| `src/lib/onboarding/goal-flow.ts` branches | 18/22 (81.81%) -> 12/16 (75.00%), -6.82pp | `HEAD` removed `deriveVolumeFromGoals` (`:7-11`), including all five source branch entries; their pre-removal counts were nonzero. One remaining denominator change is generated mapping. | Actual `getAvailableGoals` (`:7-9`) and `getAvailableGoalLabel` (`:11-13`) retain their source branches and coverage counts. | None. |
| `src/lib/personal-plan/direct-acceptance/defaults.ts` branches | 15/17 (88.24%) -> 10/12 (83.33%), -4.90pp | `HEAD` removed `directAcceptanceAssumptions` (`:59-91`), including the two conditional spread paths and associated source branches; all were covered. The fifth lost denominator entry is generated mapping. | Actual `buildDirectAcceptanceStage2Defaults` (`:37-44`) remains covered (function execution 51, pre 55); its only source branch remains covered. | None. |
| `src/lib/personal-plan/direct-acceptance/defaults.ts` functions | 10/14 (71.43%) -> 8/12 (66.67%), -4.76pp | Same removed `directAcceptanceAssumptions`: the function and its synthetic export getter were both covered (6). | `buildDirectAcceptanceStage2Defaults` remains covered, including its actual definition. | None. |
| `src/lib/personal-plan/types.ts` branches | 11/13 (84.62%) -> 8/10 (80.00%), -4.62pp | `HEAD` removed `canonicalizeInitialSnapshotPayload` (`:547-549`), whose source map was covered (3); the other two lost entries are emitted export/module map entries. | Remaining exported constants/types have the same live coverage class; no executable replacement branch was edited. | None. |
| `src/lib/personal-plan/refinement/module-scope.ts` functions | 26/27 (96.30%) -> 25/27 (92.59%), -3.70pp | **No source diff** for this file. The after map marks only the synthetic line-1 `deriveStage2EntryMode` export getter unexecuted (0), whereas before it had 3 hits. | The actual unchanged function at `:221-224` remains executed 14 times (pre 17), so this is not a lost execution of the Stage-2 entry-mode behavior. | None; do not retain a dead test solely to hit an esbuild getter. |
| `src/lib/recommendation-engine/chat.ts` functions | 20/31 (64.52%) -> 18/29 (62.07%), -2.45pp | `HEAD` removed `getShampooProfileCompleteness` (`:290-303`); both its exported getter and actual function were covered (2 each), accounting for the two covered/total removals. | Actual `getShampooMissingProfileFields` moved to `:273-288` and remains covered (28 actual executions; pre 30). | None. |
| `src/lib/personal-plan/products/inventory-search.ts` functions | 24/26 (92.31%) -> 9/10 (90.00%), -2.31pp | The old in-memory catalog/search/creation implementation (`HEAD :14-243`) was removed. Its covered functions supplied most denominator removal; synthetic export changes account for the rest. | Actual validation seam `normalizeOwnedProductSearchQuery` at `:14-20` remains covered (6 actual executions; pre 12). | None from coverage; retain only the real Stage-3 persistence/route contract separately. |
| `src/components/checkout/stripe-offer-elements-checkout.tsx` functions | 36/46 (78.26%) -> 32/42 (76.19%), -2.07pp | `HEAD` removed `hasApplePayMethod` (`:242-246`) and `reconcilePaymentElementApplePayAvailability` (`:346-355`). Each actual helper and generated export getter was covered (2 and 5 respectively), producing four covered/total removals. | Actual `getApplePayAvailability` (`:240-244`) and `getChangedApplePayAvailability` (`:246-254`) retain their prior execution counts (4/5 source-level; live body remains present). | None. |

## Scope limit and validation

The conclusions above concern only changed coverage attribution. They do not
replace the implementation's focused behavior checks. After the frozen proof,
rerun the established full test/coverage command and compare both global
percentage and fixed-original-denominator counters; no test-only export should
be restored merely to improve transformed-module coverage math.
