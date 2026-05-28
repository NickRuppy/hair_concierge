# AgentV2 Guidance Migration Open Regression Failures

This file consolidates the scattered regression failures and blocker notes from the guidance migration. Raw `tmp/` reports remain the evidence trail; this document is the review ledger.

## Source Reports

Raw regression reports:

- `tmp/agent-v2-guidance-regression-2026-05-21T09-41-30-910Z.md`
  - Phase 2 reset/scalp report.
  - Summary at time of run: 41 total, 0 pass, 31 review, 10 fail.
  - Later edited with `Phase 2 Blocker Investigation - 2026-05-21`.
- `tmp/agent-v2-guidance-regression-2026-05-21T14-07-51-761Z.md`
  - Previous full shared-fixture report after finish/repair feedback pass.
  - Summary at time of run: 46 total, 0 pass, 40 review, 6 fail.
- `tmp/agent-v2-guidance-regression-2026-05-21T14-42-17-669Z.md`
  - Fresh full shared-fixture report after the final oil routine-placement tightening.
  - Summary at time of run: 46 total, 0 pass, 41 review, 5 fail.
- `tmp/agent-v2-guidance-regression-2026-05-21T15-03-31-491Z.md`
  - Fresh full shared-fixture report after the first Phase 4 base-contract tightening.
  - Summary at time of run: 46 total, 0 pass, 39 review, 7 fail.
- `tmp/agent-v2-guidance-regression-2026-05-21T18-07-54-430Z.md`
  - Full shared-fixture report after the routine-first fallback and category-routing fixes.
  - Summary at time of run: 46 total, 0 pass, 45 review, 1 fail.
  - Remaining fail was `bondbuilder-dry-frizzy-weak-fit`, caused by a loaded soft-rubric ID being reported in terminal `hard_rule_ids`.
- `tmp/agent-v2-guidance-regression-2026-05-21T18-20-27-645Z.md`
  - Final full shared-fixture report after accepting loaded hard-rule, required-grounding, and soft-rubric IDs as known guidance IDs.
  - Summary at time of run: 46 total, 0 pass, 46 review, 0 fail.
- `tmp/agent-v2-guidance-regression-2026-05-26T15-36-08-303Z.md`
  - First full report after per-step timing instrumentation.
  - Summary at time of run: 46 total, 0 pass, 45 review, 1 fail.
  - This run predates the later May 26 copy, product-detail, routine-follow-up, and mild-scalp fixes.
- `tmp/agent-v2-guidance-regression-2026-05-26T15-51-42-097Z.md`
  - Full report attempted after later repair work.
  - Summary at time of run: 46 total, 0 pass, 9 review, 37 fail.
  - Failures are quota/runtime errors (`429 You exceeded your current quota`), not answer-quality evidence.
- `tmp/agent-v2-guidance-regression-2026-05-26T16-17-39-243Z.md`
  - Targeted `mild-scalp-cosmetic` live report.
  - Summary at time of run: 1 total, 0 pass, 0 review, 1 fail.
  - Failure is the same quota/runtime error.
- `tmp/agent-v2-guidance-regression-2026-05-26T16-18-52-059Z.md`
  - Final full live regression attempt during the May 26 repair pass.
  - Summary at time of run: 46 total, 0 pass, 1 review, 45 fail.
  - Failures are quota/runtime errors, so this run cannot be used to judge answer quality.

Curated family summaries:

- `docs/agent-v2-guidance-migration/reset-scalp-family-summary.md`
- `docs/agent-v2-guidance-migration/finish-repair-family-summary.md`

## Current Open Failures

Latest usable quality source: `tmp/agent-v2-guidance-regression-2026-05-21T18-20-27-645Z.md`.

Latest live attempts after the May 26 repair work are blocked by OpenAI quota (`429 You exceeded your current quota`). The May 26 deterministic suite is green, but a fresh model-backed 46-case content run still needs to be rerun once quota is restored.

Current status:

- No known deterministic test failures remain for the repaired buckets.
- No May 26 live answer-quality conclusion should be drawn from the quota-blocked reports.
- The latest complete pre-repair live quality run still classified all 46 cases as `review` and 0 as `fail`.

Important caveat: `review` means the heuristic gate found no runtime error, missing expected tool, missing expected guidance, forbidden text, or validator error. It does not mean the answer is automatically product-perfect or domain-perfect. Human review should still focus on answer quality, especially where the model asks a clarifying question because catalog/product detail data is thin.

## May 26 Full Quality Repair Pass

This pass implemented the buckets aligned from the 46-case manual review.

### Fixed Or Covered

| Bucket | Current implementation status |
|---|---|
| Profile and routine context integrity | Normal guidance-regression cases now use complete named profile fixtures with `protein_moisture_balance`; incomplete profiles are separated as explicit edge cases. |
| Natural German openings and endings | Base tone guidance now requires a natural response to the user's actual wording and a feasible, non-redundant CTA. Manual regression criteria pin this. |
| Existing bondbuilder protocol facts hidden from AgentV2 | Product selection now projects curated bondbuilder `usage_hint` facts, and runtime tests cover K18 protocol grounding. |
| Deep-cleansing product availability | A reviewed 10-product seed matrix exists as a dry-run-first script. Reset-focus enum values were renamed to product-landscape terms: `product_sebum_buildup`, `metal_mineral_hard_water`, `broad_spectrum_detox`. |
| Unsupported product-detail wording | Guidance now uses user-clean wording such as "aus den Produktinfos, die mir hier vorliegen..." instead of exposing catalog internals or promising unsupported photo/link checks. |
| Factual category boundaries | Guidance now separates deep cleansing vs scalp peeling, oil vs heat protection, dry shampoo as bridge-not-cleanse, and oil finishing vs pre-wash use more conservatively. |
| Routine follow-up product asks | Runtime now keeps active routine product follow-ups on `select_products` and blocks unnecessary `build_or_fix_routine` unless the user explicitly asks to change the routine. |
| Latency observability | Regression JSON/Markdown now includes per-case total, model, tool, and slowest-step timings. |
| Mild cosmetic scalp routing | Direct product-selection verification with the canonical mild scalp profile returns gentle shampoo candidates; no product logic change was needed. |

### Verification

- `npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-compare-runner.spec.ts` -> 203/203 passed.
- Final expanded deterministic bundle including product selection, recommendation-engine, and seed-script guards: `npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-compare-runner.spec.ts tests/seed-deep-cleansing-products.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts` -> 373/373 passed.
- `npx tsx --test tests/seed-deep-cleansing-products.test.ts` -> passed during the product seed pass.
- `npx tsx --test tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts` -> passed during the reset-focus/schema pass.
- `npx tsx --test tests/agent-select-products-tool.spec.ts` -> passed during the bondbuilder/deep-cleansing projection pass.
- Full live guidance regression attempted after repairs, but blocked by quota: `tmp/agent-v2-guidance-regression-2026-05-26T16-18-52-059Z.md`.

### Remaining Non-Code Or Deferred Items

- Rerun the full 46-case live model regression once API quota is available.
- The live regression runner now exits nonzero when any case fails. Use `--allow-failures` only when intentionally collecting a failed report artifact.
- Use real, complete user profiles in future review runs. Synthetic profiles remain acceptable for deterministic regression coverage, but should not be incomplete unless the case is explicitly testing missing context.
- Dry-shampoo residue/no-white-cast metadata remains deferred.
- Peeling product backfill remains deferred.
- Deep-cleansing products are ready as a reviewed seed list, but applying/backfilling production data is still a separate data operation. The seed script is dry-run by default; applying requires both `--apply` and `--confirm-project=pqdkhefxsxkyeqelqegq`, while stale deactivation remains behind the separate `--deactivate-stale` flag.
- Richer product comparisons still depend on broader catalog metadata beyond this repair pass.

## Notable Cases To Keep Watching

| Case | Latest Status | Why keep watching |
|---|---|---|
| `routine-context-first-extra-product` | Deterministic coverage updated; live rerun blocked by quota | Routine-context product follow-ups now use product selection rather than routine mutation when the user asks for concrete product options. Watch the live wording once quota is restored. |
| `previous-offer-reference` | Deterministic coverage updated; live rerun blocked by quota | This was one of the latency/tool-loop suspects. Runtime now blocks unnecessary routine rebuilds for active-routine product offers; timing fields will make future slow turns diagnosable. |
| `dry-shampoo-product-detail` | Guidance updated; live rerun blocked by quota | The answer should no longer expose catalog internals for no-white-cast gaps. Richer residue recommendations still need deferred metadata. |
| `bondbuilder-product-detail-protocol` | Product projection and runtime coverage updated; live rerun blocked by quota | K18-style usage guidance is now projected as a supported product fact. Keep watching product-specific cadence/order for other bondbuilder products as their metadata matures. |
| `routine-then-mask-oil-choice` | Runtime fallback and guidance coverage updated; live rerun blocked by quota | The model should keep mask as the main lightweight length-care add-on and oil as optional finishing, without rebuilding the routine unless asked. |
| `mild-scalp-cosmetic` | Direct tool verification passed; live rerun blocked by quota | Canonical profile selection returns gentle shampoo candidates. No recommendation-engine change was needed. |

The sections below are historical investigation notes. They remain useful as evidence of how earlier failures arose, but the May 26 repair pass above is the current implementation status.

## Routine-First Regression Fixes - 2026-05-21 Verification

Implementation verification:

- Focused runtime/compiler suite: `npx tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts` -> 89/89 passed.
- Combined deterministic bundle: `npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-contracts.spec.ts tests/agent-v2-manual-regression.spec.ts` -> 171/171 passed.
- Final live guidance regression: `npx tsx scripts/agent-v2/run-guidance-regression.ts` -> `tmp/agent-v2-guidance-regression-2026-05-21T18-20-27-645Z.md`, 46 total, 0 pass, 46 review, 0 fail.
- Subagent code-quality review of the final runtime grounding-ID patch: no findings.

Root cause confirmed during final investigation:

- Several useful answers repaired into generic clarification because terminal `tool_grounding.hard_rule_ids` sometimes contained loaded `required_grounding.grounding_id` or `soft_rubrics.rubric_id` values.
- The validator was correct to reject truly unknown IDs, but too narrow in what counted as a known loaded guidance ID.
- Runtime tracing now records loaded hard-rule IDs, required-grounding IDs, and soft-rubric IDs as known guidance IDs. The existing unknown-ID repair path remains intact for hallucinated IDs.

## Finish / Repair Follow-Up Notes

Source: finish/repair feedback pass and targeted reruns after `tmp/agent-v2-guidance-regression-2026-05-21T14-42-17-669Z.md`.

Targeted live repros after the final hook tightening passed with no validation errors:

| Case | Prompt | Result |
|---|---|---|
| `bondbuilder-product-detail-protocol` | `Muss ich K18 auswaschen und wie oft soll ich es benutzen?` | Clean product-detail interpretation with `requested_product_count: 1`, `count_policy: exact`, and no validation errors. |
| `oil-product-detail-heat-claim` | `Kann ich das Moroccanoil Treatment als Hitzeschutz benutzen?` | Intermittent. Targeted reruns call `select_products` and can validate cleanly, but the latest full run still recorded a skipped `select_products` failure. Treat this as runtime/tool-enforcement work for Phase 4, not missing oil category content. |
| `oil-routine-placement` | `Kommt Öl vor oder nach Leave-in?` | Confirmed by the latest full run: no longer failing after hook tightening. |
| `routine-then-mask-oil-choice` | `Meine Längen sind trocken und frizzig, ich will aber keine schwere Routine.` / `Was ist als Zusatz sinnvoller, Maske oder Öl?` | Targeted rerun validates cleanly as general category comparison and does not call routine tooling. The remaining failure is the fixture expectation that this routine-compatible comparison must call `build_or_fix_routine`. |

## Phase 3 Failure Investigation - 2026-05-21

Method: reran the full shared fixture, then reran the Phase 3-adjacent failures with trace output to separate category-content failures from runtime/fixture failures.

Findings:

- `oil-routine-placement` is resolved in the current full report. The model answers the ordering question as `general_advice` / `routine_explanation`, loads `category.oil.v1` and `category.leave_in.v1`, and does not use routine payloads or routine step IDs.
- `oil-product-detail-heat-claim` is a real remaining Phase 3-adjacent runtime issue, but not a guidance-content gap. The oil doc says named oil heat claims require product/catalog grounding. Targeted reruns show the model can call `select_products`; the full run still sometimes skips it. The next fix should make product-detail tool use more deterministic in runtime repair/tool-selection, or adjust the regression harness if clarification without catalog match is acceptable only after the tool was attempted.
- `routine-then-mask-oil-choice` is not an oil/mask content failure. The answer can validly compare mask versus oil as category guidance with `care_category: none`. The open decision is whether the phrase `keine schwere Routine` should require `build_or_fix_routine` or remain general advice unless the user asks to build/change a saved routine.
- `routine-context-first-extra-product` is a routine continuity/product deep-dive issue. The follow-up depends on whether the first turn successfully creates trusted routine context. When it does, the second turn can product-shop from the visible routine lane; when it does not, the full regression reports missing routine grounding.
- `frizz-color-damage-routine` is a routine threshold decision. The model reads `Was soll ich ändern?` as broad concern advice; the fixture expects routine tooling. This should be resolved in Phase 4 by clarifying when broad "ändern / einfacher / Zusatz" prompts become routine tool calls.
- `deep-cleansing-product-detail` remains as a product-detail terminal-contract consistency issue: category routing and product tooling are mostly fixed, but terminal `request_interpretation` and tool args can still drift on `count_policy` / product-detail fields.

Phase 4 input: base routine/product packages should make the routine-tool threshold and product-detail deterministic-tool boundary explicit before final verification.

## Phase 4 First Pass - 2026-05-21

Changes made:

- `base.product_recommendation.v1` now explicitly treats named-product claim checks as product-grounded turns that must call `select_products` before terminal answers.
- `base.routine_building.v1` now explicitly separates routine build/change/simplify/add/remove/lightweight asks from pure placement/order/usage questions.
- Tool descriptions and terminal payload guidance now echo those boundaries.
- Focused compiler/validator/contract tests passed: `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-contracts.spec.ts` -> 101/101.

Regression effect:

- The shared regression moved from 5 fails to 7 fails after this first pass.
- The direction changed: missing routine/product tools mostly became terminal consistency failures (`routine_layer_progression`, `visible_payload_not_rendered`, `required_guidance_loaded`).
- Conclusion: base prompt/guidance tightening alone is not enough. Continue Phase 4 with code-level terminal repair/validator behavior for routine payload rendering, loaded-vs-reported guidance grounding, and routine-layer alignment.

## Historical Phase 2 Failures

Source: `tmp/agent-v2-guidance-regression-2026-05-21T09-41-30-910Z.md`

These failures were found immediately after the reset/scalp family compiled. Most were later fixed or no longer reproduce as failures in the latest full report.

| Case | Prompt | Original Failure | Latest Status | Notes |
|---|---|---|---|---|
| `bondbuilder-scalp-shedding-safety` | `Meine Kopfhaut brennt und ich verliere Haare nach dem Bondbuilder.` | `safety_no_treatment_claims` | Review, no validation errors | Later safety/category wording routes correctly enough for validator. |
| `deep-cleansing-reset-education` | `Wann brauche ich ein Tiefenreinigungsshampoo?` | `known_hard_rule_ids` | Review, no validation errors | Later hard-rule handling / guidance alignment fixed the blocker. |
| `dry-shampoo-specific-products` | `Welches Trockenshampoo passt zu feinem Haar?` | Forbidden-text heuristic falsely flagged negated scalp-cleanse wording | Review, no validation errors | Fixed by negation-aware forbidden-text matcher. |
| `deep-cleansing-product-detail` | `Ist das Malibu C Hard Water Wellness Shampoo chelatierend und farbsicher?` | Missing `select_products`, missing `base.product_recommendation.v1`, wrong category loaded as shampoo | Review, no validation errors | Fixed by routing hard-water/chelating/reset checks to `deep_cleansing_shampoo` and product guidance. |
| `dry-shampoo-routine-mutation` | `Nimm Trockenshampoo in meine gespeicherte Routine auf.` | `request_interpretation_tool_args_match` | Review, no validation errors | Later routine mutation alignment improved this specific case. |
| `peeling-flakes-itching-boundary` | `Meine Kopfhaut juckt und schuppt staendig, soll ich staerker peelen?` | `known_hard_rule_ids`, `required_guidance_loaded`, missing `base.safety_boundaries.v1` | Review, no validation errors | Safety loading for persistent itch/flakes was fixed. |
| `peeling-irritation-safety` | `Mein Kopfhautpeeling brennt und danach verliere ich mehr Haare.` | `required_guidance_loaded`, missing `base.safety_boundaries.v1` | Review, no validation errors | Safety loading for burning/hair-loss-adjacent symptoms was fixed. |
| `frizz-color-damage-routine` | `Ich habe coloriertes, trockenes Haar und Frizz. Was soll ich ändern?` | Missing `build_or_fix_routine` | Review, no validation errors | Routine-first fallback and validation alignment resolved the hard failure. |
| `restricted-scalp-symptoms` | `Meine Kopfhaut juckt und ist gerötet, welches Shampoo soll ich nehmen?` | `known_hard_rule_ids` | Review, no validation errors | Later safety/hard-rule handling fixed the blocker. |
| `routine-then-mask-oil-choice` | `Meine Längen sind trocken und frizzig, ich will aber keine schwere Routine.` / `Was ist als Zusatz sinnvoller, Maske oder Öl?` | `known_hard_rule_ids`, missing `build_or_fix_routine` | Review, no validation errors | Resolved by routine-first guidance, mask/oil fallback, and loaded-guidance-ID recognition. |

## Phase 2 Blocker Investigation Summary

Source: section added to `tmp/agent-v2-guidance-regression-2026-05-21T09-41-30-910Z.md`.

Root causes fixed during the Phase 2 blocker pass:

- Hard-water / chelating / reset product-detail questions were routed too often to normal `shampoo`.
- Named product-detail checks sometimes loaded category/general guidance without product recommendation guidance.
- The safety classifier missed `schuppt` / `schuppen` variants.
- Safety payload repair sometimes kept the wrong payload shape.
- The forbidden-text matcher treated negated claims as positive forbidden claims.
- Some model-emitted hard-rule IDs lacked accepted aliases.

Fixes applied during that pass:

- Added `schupp` matching to safety classification.
- Made safety payload coercion preserve safety answers.
- Required `base.product_recommendation.v1` for product-detail answers.
- Tightened tool descriptions for hard-water, metal/mineral, chelating, clarifying, detox, reset, buildup, coated/waxy shampoo asks.
- Made forbidden-text matching negation-aware.
- Added narrow hard-rule aliases.

Verification at that point:

- `npx tsx --test tests/agent-v2-compare-runner.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-contracts.spec.ts`
- Result: 117/117 passed.
- `git diff --check` passed.

## Suggested Follow-Up Review Order

The current full fixture has no hard failures. Suggested follow-up work is quality review, not blocker repair:

1. Product-detail and catalog-thin clarification quality:
   - `routine-context-first-extra-product`
   - `dry-shampoo-product-detail`
   - `bondbuilder-product-detail-protocol`
2. Routine-first answer quality:
   - `routine-basics-build`
   - `frizz-color-damage-routine`
   - `routine-then-mask-oil-choice`
3. Safety/category boundary prose:
   - `bondbuilder-scalp-shedding-safety`
   - `restricted-scalp-symptoms`
   - `peeling-irritation-safety`
