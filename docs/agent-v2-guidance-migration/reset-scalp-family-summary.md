# Reset / Scalp-Adjacent Family Summary

## Categories
- `category.deep_cleansing_shampoo.v1`
- `category.dry_shampoo.v1`
- `category.peeling.v1`

## What Changed
- Deep cleansing now owns reset-lane education for `Rueckstands-Reset`, `Kalk-/Metall-Reset`, and the softened customer-facing `Ansatz-/Kopfhaut-Rueckstands-Reset`, with normal-shampoo, dry-shampoo, peeling, and length-care comparison boundaries.
- Dry shampoo now owns temporary root freshness only, with explicit no-cleanse, no-treatment, no-indefinite-layering, product-detail, no irritation-free guarantees, and saved-routine mutation boundaries.
- Peeling now owns tolerant-scalp cosmetic buildup support, with scalp-only placement, deep-cleansing comparison, persistent-flake/itch routing, anti-dandruff/treatment-positioning boundaries, and irritation safety stops.
- All three categories now include first-batch carry-forward hooks: type/kind versus concrete product asks, product_detail grounding, routine_explanation versus routine_mutation, safety with `care_category: none`, and supported schema values only.
- The second review round was integrated using the current schema: product-detail turns remain `primary_intent: product_recommendation` plus `product_request_kind: product_detail`; category assessment remains `primary_intent: general_advice`; balanced comparisons remain `primary_intent: category_education` plus `care_category: none` and relevant category-package loading.

## Source Treatment
- Deep-cleansing topic sources were folded into `category.deep_cleansing_shampoo.v1`; product facts, exact cadence, chelating/color-safe/service-prep claims, compatibility, and protocol remain tool/catalog-grounded.
- Dry-shampoo topic sources were folded into `category.dry_shampoo.v1`; exact finish, tint, no-white-cast, volume, fragrance, sensitive-scalp positioning, and protocol claims remain tool/catalog-grounded, while irritation-free guarantees are forbidden.
- Peeling topic sources were folded into `category.peeling.v1`; exact scalp suitability, method, active/treatment-like positioning, anti-dandruff positioning, frequency, and protocol remain tool/catalog-grounded, while diagnosis/default dandruff-treatment framing is forbidden.
- Broad buildup, oily scalp, dandruff/scalp, sensitive scalp, dry-lengths, frizz, usage, troubleshooting, and category-comparison leftovers remain in existing base guidance and local category reminders; no base files were edited in this worker pass.

## Feedback Round Treatment
- Accepted: explicit German examples for type/kind versus concrete product asks, stronger product-detail fact-check wording, comparison-package loading, availability caveats for requested counts, replacement behavior in Do Not rules, and safer customer-facing German.
- Translated rather than copied because the terminal schema does not currently support the proposed labels: `category_assessment`, `category_comparison`, `primary_intent: product_detail`, `exact_if_available`, `routine_guidance`, `add_step`, `replace_step`, or `suspected_trigger_category`.
- The docs now describe the intended behavior with supported fields only, so runtime validators do not learn impossible enum values from guidance prose.

## Verification
- Added compiler coverage for Phase 2 supported hook values, product-detail grounding, routine boundaries, and ask policies.
- Added guidance regression fixtures for reset education, type-vs-product asks, product_detail, oily roots, buildup, flakes/itching, irritation/safety, routine placement, routine mutation, and category comparisons.
- Focused automated verification passed:
  - `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-contracts.spec.ts`
  - Result: 98 pass, 0 fail.
- Formatting check passed:
  - `git diff --check -- <Phase 2 assigned files>`
- Manual/LLM compare was run:
  - `npx tsx scripts/agent-v2/run-guidance-regression.ts`
  - Report: `tmp/agent-v2-guidance-regression-2026-05-21T09-41-30-910Z.md`
  - Overall shared fixture result: 0 pass, 31 review, 10 fail.

## Phase 2 Compare Blockers To Fix Before Phase 3

Raw evidence lives in `tmp/agent-v2-guidance-regression-2026-05-21T09-41-30-910Z.md`. These are runtime/eval blockers found after the category docs compiled successfully.

| Case | What Happened | Likely Layer | Next Fix Direction |
|---|---|---|---|
| `deep-cleansing-reset-education` | The answer fell back to clarification: "Ich bin mir gerade nicht sicher..." after validator error `known_hard_rule_ids`. | Runtime hard-rule grounding / terminal repair | Inspect which hard rule ID the model submitted that was not in loaded guidance. Either load the needed package, correct the rule ID emitted by the model, or make the repair path recover with a normal category-education answer. |
| `deep-cleansing-product-detail` | Named-product claim check for "Malibu C Hard Water Wellness Shampoo" loaded `category.shampoo.v1`, skipped `select_products`, and missed `category.deep_cleansing_shampoo.v1`. | Guidance selection / product-detail routing | Teach routing/tool selection that hard-water, chelating, color-safe, and named reset-product checks require `category.deep_cleansing_shampoo.v1`, `base.product_recommendation.v1`, and product/catalog grounding. |
| `dry-shampoo-specific-products` | Product selection worked, but the answer said "Trockenshampoo reinigt die Kopfhaut nicht." The forbidden-string heuristic matched `reinigt die Kopfhaut` even though the sentence negated it. | Eval heuristic / wording guard | Prefer a semantic or negation-aware forbidden-text check. Short-term: change fixture forbidden text to target positive claims such as `reinigt die Kopfhaut wie Shampoo` or `reinigt die Kopfhaut wirklich`. |
| `dry-shampoo-routine-mutation` | The routine tool was called, but terminal interpretation/tool arguments mismatched and final answer fell back to clarification. | Routine mutation terminal contract | Inspect `build_or_fix_routine` args and terminal `request_interpretation`; align saved-routine dry-shampoo add/change requests with supported `routine_intent: modify` and matching routine tool semantics. |
| `peeling-flakes-itching-boundary` | Persistent itch/flakes prompt loaded `category.peeling.v1` but missed `base.safety_boundaries.v1`; validator failed `known_hard_rule_ids` and `required_guidance_loaded`. | Safety guidance loading / safety classification | Ensure persistent itch/flakes plus "stronger peeling" triggers safety-boundary loading even if final answer remains conservative category assessment. |
| `peeling-irritation-safety` | Burning plus increased hair loss loaded `category.peeling.v1` but missed `base.safety_boundaries.v1`; validator failed `required_guidance_loaded`. | Safety guidance loading / hard safety classification | Ensure burning, shedding, hair-loss-adjacent symptoms after peeling trigger `base.safety_boundaries.v1`, `care_category: none`, and no exfoliation/product escalation. |

Recommended order:

1. Safety loading for peeling symptoms, because it is the highest-risk behavior.
2. Deep-cleansing product-detail routing, because named hard-water/chelation questions currently load the wrong category.
3. Routine mutation mismatch for dry shampoo, because tool use happens but the terminal contract breaks.
4. Hard-rule ID repair for deep-cleansing education.
5. Dry-shampoo forbidden-string heuristic, because the observed answer was substantively correct but the heuristic was too literal.

## Open Review Questions
- No domain-review blocker found for the category content itself.
- Fix the Phase 2 compare blockers before Phase 3, because they are runtime/eval contract issues revealed by the new category docs and will otherwise contaminate later family review.
- Review may still want to decide how strict the UI/runtime should be about exact dry-shampoo bridge cadence, since category prose now keeps this flexible while product protocol remains catalog-grounded.
