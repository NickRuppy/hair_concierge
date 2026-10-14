# Recommendation categories + selection — second-layer reassessment

## Scope and denominator

Current AST inventory is **99 declarations**: 47 in `tests/recommendation-engine-categories.test.ts` and 52 in `tests/recommendation-engine-selection.test.ts`. The exact per-site R ledger is machine-readable in `/tmp/test-audit-recommendation-engine-categories-selection-second-layer-sites.json` (line, literal title, mark, risk class for all 99).

I started from the previous complete owner receipt (`/tmp/test-audit-recommendation-engine-current-complete-ledger.md`) and the historical engine union plan/preservation record, then inspected the current AST inventory, current diff, category/selection public owner exports, runtime assembly and live callers. The current diff already removes historical duplicate callbacks and moves their assertions into the named keepers; those removals are not re-credited. Current test files are modified by the parent campaign, so their current hashes are listed below rather than compared to an outdated receipt.

## New second-layer question and result

**Question:** can a direct category-policy/fit test be retired because a selection reranker uses the decision, or can a selection assertion be retired because a direct policy test creates a similar target?

**Answer: no new whole-callback union. R99 / F0 / C0 / D0.** The two layers have complementary readsets and oracles:

- Categories invokes direct target constructors and fit evaluators (`build*CategoryDecision`, `evaluate*Fit`) over profile/request/damage/care/plan facts. The 47 current callbacks partition mask, conditioner, leave-in, oil, reset, dry-shampoo, bondbuilder and peeling predicates, including explicit language, absent/legacy fields, safety redirects, hard mismatch, caveat and relevance paths.
- Selection invokes `rerank*ProductsWithEngine` with a category decision **plus** candidates, catalog specs, ownership/assessment data, limits and lifecycle state. Its 52 callbacks observe primary eligibility, ranking, fallback partition, metadata and emitted product ordering. A correct direct target is insufficient to preserve candidate eligibility/order/metadata; a correct reranker result is insufficient to establish a category’s exact predicate or redirect.

The only tempting shared vector remains the quiet-profile baseline conditioner comparison: category policy directly evaluates the quiet category set, whereas selection first goes through `buildRecommendationEngineRuntimeFromPersistence` and adapter/effective-context assembly before it reranks. The prior union ledger records this input/readset distinction, and current title inventory retains only the selection facade form. It is not an exact keeper for any remaining direct category callback.

## Owner and caller closure

`src/lib/recommendation-engine/runtime.ts:126-175` composes persisted input adapter, effective context, damage/care/reset/cadence/CareBalance/plan and `buildCategoryRecommendationSet`. The categories index exports all current constructors/evaluators (`src/lib/recommendation-engine/categories/index.ts:21,57-65`). `src/lib/recommendation-engine/selection.ts:113,315,626-1920` owns product primary eligibility, legacy thickness enrichment, and each category reranker.

Production reaches that assembly through the AgentV2 production chat pipeline, product-selection tool and routine data/API paths; selection’s returned metadata is used by the product selection tool. The package Node lane and current CI owner were recorded in the prior complete ledger. No exported category/selection function found in scope has only test importers, so there is no test-only source seam.

## Exact retention groups

The attached JSON is the per-declaration ledger. It groups as follows without treating a group as deletion credit:

| current sites | retained independent observation |
|---:|---|
| Categories 74–354 (13 sites) | target relevance/action/weight for mask, leave-in and baseline conditioner under distinct explicit-language, perm/straightening, heat and fine-hair predicates. |
| Categories 379–651 (13 sites) | direct evaluator unknown/legacy backfill, thickness/balance/weight/repair and heat mismatch/caveat contracts. |
| Categories 688–956 (11 sites) | normalized oil-purpose and safety/medical/overload/non-oil redirect policy; these must remain before product ranking. |
| Categories 975–1167 (10 sites) | support/reset/dry-shampoo/bondbuilder/peeling activation and safety predicates. |
| Selection 104–655 (13 sites) | conditioner/mask candidate ranking, threshold, fallback and specs/assessment limits. |
| Selection 690–1203 (8 sites) | leave-in heat, hard gate, fallback, explicit format, separate-protection and relation metadata. |
| Selection 1242–1561 (7 sites) | shampoo bucket, legacy intensity, eligible/mismatch fill and owned assessment behavior. |
| Selection 1616–1967 (9 sites) | oil purpose/bridge/eligibility/load/caveat/fallback ordering. |
| Selection 2007–2792 (15 sites) | bondbuilder lifecycle/add-on/protocol, reset, dry-shampoo, peeling and quiet-runtime selection behavior. |

## Current evidence, history and limits

- Current hashes: categories `88634ed04e464d2925a3876b0b880541cbaa889271fe0935ae75d4934812ca34`; selection `efdc0984eed7877a2adba773b561629776e9b14be2166a6fd163377f9615c86c`.
- Relevant history: `53e9f096` foundation; `3c396bd3` engine hardening; `312af79a` usage cadence; `cb6fb1b3` chemical taxonomy; `6be9b148` binary-only heat rule. The current diff contains the already-approved historical union removals/transfers; this audit grants them no new count.
- No test, mutation, coverage, provider, database, environment or repository write was performed. I inspected current owner/caller closure and the complete prior body receipt, but did not claim a new native proof. If a later source change affects these owners, the existing focused command is `node --import ./tests/server-only-register.cjs --import tsx --test tests/recommendation-engine-selection.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-care-balance.test.ts`.
