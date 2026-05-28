# AgentV2 Full Context Transformation Summary

Date: 2026-05-27

## Status

The AgentV2 context transformation is complete for the guidance architecture and category/base content migration.

Final live model-backed acceptance is still pending because the latest 46-case guidance regression attempts were blocked by OpenAI API quota (`429`). Those quota-blocked reports are not answer-quality evidence.

## What Changed

The migration moved legacy context from many small topic, overlay, routine, and playbook files into fewer richer AgentV2 guidance packages:

- product categories own category behavior and boundaries;
- `base.general_advice.v1` owns broad concern, goal, comparison, usage, technique, and troubleshooting logic;
- `base.product_recommendation.v1` owns product grounding, count, product-card, comparison, unsupported-claim, and no-claims-from-names behavior;
- `base.routine_building.v1` owns routine construction, active-routine follow-up, mutation permission, and routine return behavior;
- `base.safety_boundaries.v1` owns medical/scalp/hair-loss boundary handling;
- tools/catalog own product truth, exact product claims, protocol, availability, lifecycle, compatibility, and saved routine state;
- validators own grounding, terminal-contract consistency, safety, product-card permission, and side-effect permission.

The transformation kept the "fewer richer" direction: category-relevant value was folded into categories first, and only true cross-category leftovers were folded into base packages.

## Migrated Families

### Wash / Length-Care

Packages:

- `category.shampoo.v1`
- `category.conditioner.v1`
- `category.leave_in.v1`
- `category.mask.v1`

Summary:

- Shampoo owns scalp/root cleansing, rinse-down, wash rhythm, dry-length mismatch, residue-vs-reset boundaries, and scalp safety stops.
- Conditioner owns rinse-out baseline length care, CWC/OWC local logic, protein/moisture fit relevance, hair-thickness/weight logic, and conditioner-vs-lookalike boundaries.
- Leave-in owns leave-on booster and simplification logic, heat-protection grounding, conditioner-replacement caution, fine/low-density dosing, and fragrance/sensitivity caveats.
- Mask owns periodic extra-care logic, conditioner boundary, protein/moisture role, flexible cadence, usage-order caution, and repair overclaim limits.

### Reset / Scalp-Adjacent

Packages:

- `category.deep_cleansing_shampoo.v1`
- `category.dry_shampoo.v1`
- `category.peeling.v1`

Summary:

- Deep cleansing owns occasional reset logic, clarifying/chelating/reset distinctions, normal residue vs true reset, hard-water/mineral claims, color-safety grounding, and scalp/length reset boundaries.
- Dry shampoo owns temporary root freshness only, with no-cleanse, no-treatment, no indefinite layering, product-detail grounding, no irritation-free guarantees, and saved-routine mutation boundaries.
- Peeling owns tolerant-scalp cosmetic buildup support, scalp-only placement, symptom routing, deep-cleansing comparison, anti-dandruff/treatment-positioning boundaries, and irritation safety stops.

### Finish / Repair

Packages:

- `category.oil.v1`
- `category.bondbuilder.v1`

Summary:

- Oil owns finish/tips, pre-wash length protection, cautious scalp-comfort use, wash-out technique, weight/buildup caution, growth/repair overclaim limits, and essential-oil boundaries.
- Bondbuilder owns true structural-repair fit, lookalike boundaries, technology-lane explanation, product-example caveats, exact protocol grounding, and safety stop rules.

## Source Map

`docs/agent-v2-guidance-migration/source-map.md` represents all legacy markdown files:

- `73/73` legacy markdown rows represented.
- Final statuses are assigned across category, base general, base routine, base product, and safety targets.
- No legacy context source is left as an unmapped migration input.

## Contract Decisions Preserved

- `request_interpretation.care_category: none` means no single primary accountability category. It can coexist with multiple loaded category packages for balanced comparisons, broad concerns, routine turns, and safety turns.
- Agent guidance uses only schema-supported terminal values. Proposed but unsupported labels such as `category_assessment`, `category_comparison`, `primary_intent: product_detail`, `exact_if_available`, `routine_guidance`, `add_step`, `replace_step`, and `suspected_trigger_category` were translated into supported contract language.
- Type/kind education is separated from concrete product asks.
- Named product and product-claim checks require product grounding.
- Routine placement/explanation is separated from saved/current routine mutation.
- Safety-boundary answers use `care_category: none`; suspected product/category triggers are preserved in evidence or safety wording instead of unsupported schema fields.
- Exact cadence, temperature, protocol, compatibility, scalp use, product role, and product-specific claims require product metadata.

## Later Repair Work

After the category migration, later sessions repaired runtime and quality-gate issues surfaced by regression review:

- complete named regression profiles replaced incomplete generic fixtures;
- German openings/endings and feasible CTAs were tightened;
- bondbuilder usage hints are projected as grounded product facts;
- product-detail wording avoids internal catalog leakage;
- routine-context product follow-ups stay on product selection instead of unnecessary routine rebuilds;
- safety, product-detail, routine, hard-rule, required-grounding, and soft-rubric ID handling were stabilized;
- regression traces now include per-case timing details;
- a reviewed deep-cleansing seed matrix and reset-focus enum rename were added as current dirty product-evidence work.

## Verification

Documented deterministic verification:

- `npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-compare-runner.spec.ts` -> `203/203` passed.
- Expanded deterministic bundle including product selection, recommendation-engine, and seed-script guards -> `373/373` passed.
- Current dirty deep-cleansing evidence focused suite on 2026-05-27:

```bash
npx tsx --test tests/seed-deep-cleansing-products.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts
```

Result: `169/169` passed.

- Final targeted AgentV2 closeout suite after base duplication review on 2026-05-27:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-guidance-compiler.spec.ts
```

Result: `217/217` passed.

- `git diff --check` passed on 2026-05-27.

Latest usable live quality report:

- `tmp/agent-v2-guidance-regression-2026-05-21T18-20-27-645Z.md`
- Result at that point: `46` total, `46` review, `0` fail.

Latest live model-backed attempts after the May 26 repair pass:

- `tmp/agent-v2-guidance-regression-2026-05-26T15-51-42-097Z.md`
- `tmp/agent-v2-guidance-regression-2026-05-26T16-17-39-243Z.md`
- `tmp/agent-v2-guidance-regression-2026-05-26T16-18-52-059Z.md`

Those reports are quota-blocked (`429`) and should not be used as answer-quality evidence.

## Remaining Before Final Acceptance

- Rerun the final 46-case live model regression once quota is available.
- Manually inspect the highest-risk live cases after that run:
  - product-detail and catalog-thin clarification quality;
  - routine-first answer quality;
  - safety/category boundary prose.
- Review and either commit or split the current deep-cleansing reset/product evidence changes.
- Reconcile the branch with `origin/main` before PR or merge.

## Deferred Follow-Ups

- Apply/backfill deep-cleansing production data after review. The seed script is dry-run by default and requires `--apply --confirm-project=pqdkhefxsxkyeqelqegq`; stale deactivation additionally requires `--deactivate-stale`.
- Dry-shampoo residue/no-white-cast metadata remains deferred.
- Peeling product backfill remains deferred.
- Richer product comparisons depend on broader catalog metadata.
- Archive or relocate legacy `data/agent-guidance/**` and migration audit artifacts only after final acceptance.
