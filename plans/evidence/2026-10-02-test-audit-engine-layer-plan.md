# Recommendation-engine layer second pass

Read-only review of exactly the nine proposed sites from `/tmp/test-audit-engine-layer-challenge.md`; no runner, mutation, provider, database, environment, or repository edit. I reread the candidate declaration bodies/tables, their named survivors, the persistence runtime/category/selection path, request parser, category evaluators, selection metadata and the old ledger. The base DAG is real: `buildRecommendationEngineRuntimeFromPersistence` adapts persisted profile/routine input then derives context, damage, care, plan and `buildCategoryRecommendationSet` (`src/lib/recommendation-engine/runtime.ts:126-180`); production chat and routine callers use it. Selection invokes the same category evaluators and exposes `fit_status` in delivered `recommendation_meta`.

## Result

**7 conditional C, 1 R correction, 1 F, no D.** The challenge’s proposed C5 is unsound; it would drop a unique benefit-fit observation. The other seven can be transferred into named, existing runtime/selection declarations without adding a declaration or counting a table loop.

| Original site | Result | Existing keeper and exact transfer |
|---|---|---|
| categories:75 | C | selection:300. Both use `SEVERE_DAMAGE_PROFILE` + no routine. Extend the existing persisted-runtime keeper with the complete category outputs at categories:85-127: shampoo target; conditioner target including `activeDamageDrivers`; mask target including fine/medium/null intensity; leave-in need/styling/relationship/benefit ordering; oil false. Keep selection:300’s actual insufficient-pool fallback assertion. |
| categories:406 | C | selection:593. Replace its fabricated decision with `buildRecommendationRequestContext({ requestedCategory: "mask", message: "Welche intensive Maske passt zu mir?" })` and `buildRecommendationEngineRuntimeFromPersistence(LOW_DAMAGE_PROFILE, [], requestContext).categories.mask`. Assert parsed `intensive`, optional/relevant, medium repair, and uplift note before reranking. The request parser maps this at `request-context.ts:416-419`; selection then observes the same medium-over-low result/caveat. |
| categories:549 | C | selection:513. The direct test’s operative axes are protein / medium need / medium weight versus high concentration; `evaluateMaskFit` uses only weight, repair/concentration and balance (`mask.ts:322-365`), so selection’s normal/medium target metadata adds no untested branch. Add `high.recommendation_meta.fit_status === "supportive"` while retaining medium-first and actual `sparsam` delivery. |
| categories:643 | C | selection:670. Both derive the same severe persisted target. The category spec with `suitable_thicknesses: ["fine"]` and selection candidate’s default all-thickness array both produce exact fine thickness under `evaluateLeaveInFit` (`leave-in.ts:455-462`). Add selected ideal’s emitted `fit_status === "supportive"`; retain first-ID/category checks. |
| categories:690 | **R (correction)** | Do **not** cut/transfer. It uniquely proves `leave_in_benefits_mismatch` for a replacement-only/no-heat/no-benefits spec. In selection:670 that candidate also independently fails high heat protection and heat styling preparation (`leave-in.ts:463-488,507-516`), so changing only benefit matching leaves its output excluded. An ID-list or status transfer cannot detect this exact broken owner. |
| categories:812 | C | selection:1219. Both use LOW profile overridden oily+dandruff and no routine. Transfer the full generated target (`scalpRoute:dandruff, shampooBucket:schuppen, secondaryBucket:dehydriert-fettig, cleansingIntensity:regular`) plus thermal protection `none`; preserve selection’s treatment-first rank and both delivered matched buckets. Remove now-unused `buildShampooCategoryDecision` import from the categories test if this test is removed; no production cleanup. |
| categories:1342 | C | selection:2764. Inputs are byte-equivalent LOW profile plus Gentle Shampoo and Daily Conditioner at weekly_3_4x. Extend its existing runtime assertions with inactive bondbuilder/deep-cleansing/dry-shampoo/peeling; it already asserts conditioner keep and mask/leave-in/oil false. |
| selection:104 | C | selection:300. Both use severe persisted runtime and the same ideal/mismatch conditioner specs. S300’s mismatch score .95 rather than .88 does not cross a source threshold: score is base plus fixed fit adjustments, then acceptable/fallback partition (`selection.ts:654-740`). Add first ID `ideal` and first metadata category `conditioner` to S300 while retaining second mismatch fallback. |
| selection:2718 | F | Repair the claim/title to “prefers peeling-type alignment when scalp focus is shared.” Both fixtures have `scalp_type_focus: "oily"` (lines 2738-2747); only `peeling_type` differs. Preserve the actual type-preference assertion. No removal credit. |

## Required controls before a C is applied

- C75: mutate real category output separately for conditioner balance, mask weight and leave-in benefit order; transferred literal assertions must fail.
- C406: make parser ignore *intensive* wording, then make mask concentration uplift return low; keeper must fail in each case.
- C549: alter high concentration’s medium-need classification away from supportive and suppress its sparsam tradeoff; each must fail.
- C643: change actual derived heat-safe product fit from supportive or remove the exact fine membership; keeper’s emitted metadata must fail.
- C812: change real shampoo route or cleansing intensity while retaining bucket ranking; full transferred target must fail.
- C1342: activate any transferred quiet category at its real builder; S2764 must fail.
- C104: reverse acceptable/fallback ordering or sort combined results by base score; S300 first-ID/fallback assertions must fail.
- F2718: verify only type mutation changes rank. A scalp-focus mismatch must be added to a separate future test before claiming that different contract.

## Limits and source cleanup

The seven C sites require editing their named existing keepers only; no new test site or quota-only table regrouping. The only cleanup unlocked is the categories-test import of `buildShampooCategoryDecision`, used solely by C812 in the inspected file. No category evaluator/export is obsolete: `categories/index.ts:21-54` builds all category decisions and runtime callers remain live. I did not audit the remaining 98 retained declarations beyond the challenge’s cited comparison scope.

CI routes both files through `package.json:49` `test:node` and `.github/workflows/ci.yml:158`. History remains active (including `6be9b148` binary heat and `cb6fb1b3` chemical taxonomy), reinforcing the retained null/legacy/chemical branches rather than these exact duplicated transfers.


## Chosen execution contract

Scope is the seven conditional transfers above plus the narrow peeling title repair. Transfer complete assertions into existing real runtime/selection keepers, run both complete native files green with all original tests still present, then remove precisely seven AST declarations. No production evaluator or export is deleted. Main is the sole checkout writer; other agents are read-only, and every native/c8/mutation process must exit before the next edit. Then run actual-owner fault controls with byte restoration and green reruns, independently review preservation, and include this batch in the whole-suite coverage/check gate. Stop a candidate if its actual old behavior is no longer observable at the stronger keeper. Credit is seven declarations at most, not input rows.

C690 remains pending a reason-code delivery review: the second pass identifies a distinct benefit mismatch reason; until its consumer and independent fault are resolved, retain it. This decision makes the seven-cut plan concrete without accepting an unsupported eighth cut. Publication and production state changes are outside the request.

Confirmed decision coverage is inherited from [the campaign contract](../2026-10-01-test-audit-pruning.md). No unresolved consequential choice affects this seven-cut batch. C690 is retained while its independent reason consumer is investigated; no routine audit permission is renewed. Counterpart review found no hard defect. Main adopts its explicit ordering and C75 transcription safeguard:

1. For each site, transfer the complete existing assertion block and exact input into the named keeper. C75 is the largest transfer: copy categories:85–127 intact, replacing only the observed damage owner with `runtime.damage`.
2. Run both complete native files with all donors still present; every transferred keeper must pass before any donor is removed.
3. Delete the seven donors, format, run both complete files again, then serialize actual-source faults and byte-exact restorations; a lost contract means repairing the keeper or retaining its donor.
4. Independent preservation, whole-suite coverage, typecheck/lint/build and whole-branch review follow. The analytical ledger is not proof that these executions already happened.
