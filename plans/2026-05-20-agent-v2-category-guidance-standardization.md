# AgentV2 Full Context Transformation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Track progress by updating the checkbox steps in this plan.

**Goal:** Transform all legacy Hair Concierge context into the new AgentV2 guidance architecture without losing behavioral value.

**Architecture:** Category-first absorption into fewer richer guidance packages. Categories own category behavior. `base.general_advice.v1` owns broad conceptual reasoning with separate concern and goal sections. Tools/catalog own product truth. Validators own grounding and contract consistency.

**Tech Stack:** TypeScript, Node test runner with `tsx`, AgentV2 guidance markdown/JSON packages, Zod contracts, static guidance compiler tests, AgentV2 eval fixtures, manual/LLM compare runs.

## Current Status - 2026-05-27

This plan is **implementation-complete for the context transformation itself**, but **not final-closeout complete**.

Done:

- Category migrations for wash/length-care, reset/scalp-adjacent, and finish/repair families are complete.
- Feedback rounds for shampoo, conditioner, leave-in, mask, deep-cleansing shampoo, dry shampoo, peeling, oil, and bondbuilder were integrated using schema-supported AgentV2 contract values.
- Base guidance consolidation was completed in later repair work: broad general advice, product grounding, routine thresholds, safety boundaries, answer contract, and tone/format were tightened.
- `source-map.md` has complete legacy markdown coverage: `73/73` rows represented with final migration statuses.
- Runtime/validator repair work from later sessions stabilized routine/product-detail/safety quality gates.
- Latest documented deterministic bundle passed: `373/373`.
- Current dirty deep-cleansing product evidence work has focused verification passing: `169/169` across seed, recommendation-engine, selection, and product-tool tests.
- Final targeted AgentV2 closeout suite passed after the base duplication review: `217/217`.

Not done:

- The latest model-backed 46-case live regression could not complete because OpenAI API quota returned `429`; rerun is required once quota is available.
- Current dirty deep-cleansing reset/product evidence changes still need review and commit/hand-off.
- Legacy guidance and migration docs should not be archived here; create the follow-up archive plan after final acceptance.
- The branch is currently behind `origin/main`; reconcile before PR/merge.

Use `docs/agent-v2-guidance-migration/open-regression-failures.md` as the current regression ledger. Older phase summaries remain useful history, but some earlier failure counts are superseded by the May 26 repair pass.

---

## Spec Link

- Guidance standard: `docs/agent-v2-guidance-migration/category-guidance-standard.md` defines the reusable category/base guidance shape and permission model.
- Decision map: `docs/agent-v2-guidance-migration/request-interpretation-decision-map.html` explains why `request_interpretation` stays narrow and how `care_category` differs from loaded guidance.
- Conditioner pilot review: `docs/agent-v2-guidance-migration/conditioner-pilot-side-by-side-review.md` is the approved example for rich category absorption plus base leftovers.
- Migration source map: `docs/agent-v2-guidance-migration/source-map.md` is the migration ledger for every legacy source row.
- Existing active guidance: `data/agent-v2/guidance/**` is the runtime target context.
- Legacy source material: `data/agent-guidance/**` is the non-runtime source material to mine before archiving.

## User Situation

The GPT-5.4 migration needs model-readable context that is richer than the current compressed AgentV2 category docs, but still governed. We already lost useful nuance once by over-compressing, so the migration must preserve all behavioral value from the legacy guidance while avoiding a return to many tiny routing-like files.

The conditioner pilot settled the pattern: fold category-relevant content into the category first, move only true leftovers into base buckets, keep broad guidance concise, and verify with tests/evals.

## Promised End-State

- Every active product category in `data/agent-v2/guidance/categories/` has the new rich guidance form.
- Every relevant legacy markdown source in `data/agent-guidance/**` has a final migration decision in `source-map.md`.
- Category-relevant overlay/playbook/routine/topic content is folded into each affected category.
- Cross-category leftovers are folded into the correct base package.
- `base.general_advice.v1` contains separate `Concern Logic` and `Goal Logic` sections, plus category comparison, usage/application, and technique logic.
- `base.general_advice.v1` is broadly loaded for advice, product recommendation, and routine turns.
- `request_interpretation.care_category: none` explicitly means no single primary accountability category; it can coexist with multiple loaded category packages.
- Product facts, exact claims, cadence, availability, lifecycle, compatibility, and protocols remain tool/catalog-grounded.
- Static tests, eval fixtures, and family-level manual/LLM compare runs verify that the transformed guidance preserves value.
- Legacy `data/agent-guidance/**` archiving is left as a follow-up after this transformation is accepted.

## Strategic Decisions

- **Internal migration first:** migrate the guidance we already have before doing external evidence research.
- **Evidence exception:** use external evidence only when existing guidance touches medically adjacent or high-overclaim areas such as scalp irritation, hair loss, oil/growth, dandruff, or structural repair claims.
- **Full transformation:** all categories and all relevant legacy docs are transformed; no category gets a quick pass.
- **Source-map ledger rows:** every source gets visible keep/compress/move/drop/source-of-truth decisions in `source-map.md`, but only complex pilots need full side-by-side review docs.
- **Category-first ownership:** category-specific implications go into categories before broad base buckets.
- **Purposeful duplication:** duplicate distilled operational rules into every category whose behavior they change; never duplicate whole legacy prose blocks or examples.
- **Goals and concerns stay separate:** both live inside `base.general_advice.v1` for now as separate sections.
- **Broad general-advice loading:** auto-load `base.general_advice.v1` for `general_advice`, `product_recommendation`, and `routine` turns.
- **Balanced comparisons:** load all relevant category packages, but use `care_category: none` when no single category is the primary answer accountability.
- **Family checkpoints:** pause after each category family with a short summary and verification results.
- **Archiving later:** archive legacy guidance and migration artifacts in a follow-up cleanup, not inside this plan.

## Source-Of-Truth Model

| Lane | Path | Runtime? | Role During Migration | Post-Migration Treatment |
|---|---:|---:|---|---|
| Active AgentV2 guidance | `data/agent-v2/guidance/**` | Yes | Target source of truth | Keep active |
| Legacy source material | `data/agent-guidance/**` | No / legacy only | Mine for behavioral value | Archive later |
| Migration audit trail | `docs/agent-v2-guidance-migration/**` | No | Track decisions and review artifacts | Archive or retain as history later |
| Verification | `tests/**`, `data/agent-v2/evals/**` | Indirectly | Prevent regression and value loss | Keep active where useful |

## Grounding Rule

Every new operational rule in category or base markdown must trace to either:

- a legacy source path captured in a `source-map.md` ledger row, or
- a global rule already stated in `docs/agent-v2-guidance-migration/category-guidance-standard.md`.

If a rule has no legacy anchor and is not in the standard, do not add it during this migration. Put uncertain ideas in the checkpoint summary as open review items instead.

## Ledger Entry Format

The ledger is `docs/agent-v2-guidance-migration/source-map.md`. Do not create per-source ledger files.

For each legacy source in scope, update its row:

- `AgentV2 target`: package IDs or `catalog/tool source of truth`.
- `Status`: one of the final statuses listed in Phase 5.
- `Notes`: one concise line naming what was kept, compressed, moved, dropped, and which target section owns the value.

Acceptance: every category/base rule added in a phase can be traced back to at least one updated ledger row or to the guidance standard.

## JSON Metadata Contract

Every guidance `.json` file must parse against `AgentV2GuidancePackageSchema` in `src/lib/agent-v2/contracts.ts`. Use `data/agent-v2/guidance/categories/conditioner.json` as the category example and `data/agent-v2/guidance/categories/bondbuilder.json` as the existing pilot reference.

For transformed packages, update:

- `hard_rules` for deterministic prohibitions and required behavior.
- `soft_rubrics` for answer-quality steering.
- `required_grounding` for tool/catalog dependencies.
- `ask_when` for one-follow-up policies.
- `markdown_path` when a file path changes.

## Manual/LLM Compare Contract

Command:

```bash
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Fixture:

- `data/agent-v2/evals/guidance-migration-regression.json`

Report output:

- `tmp/agent-v2-guidance-regression-*.json`
- `tmp/agent-v2-guidance-regression-*.md`

Pass criteria:

- `fail = 0`.
- Every `review` case for the current family is manually inspected.
- Current-family answers are equivalent or better against the legacy-source expectations captured in the case `quality_criteria`.
- Any accepted differences are recorded in the family checkpoint summary.
- Any rejected regression triggers the abort criterion below.

Add family cases only when that family is in or before the current phase, so the shared command remains usable at each checkpoint.

## Abort Criterion

If a family checkpoint shows a regression the user does not accept, stop before the next phase. Open a fix sub-task on the current family, update the source-map notes/evals/tests as needed, and rerun the family checkpoint before moving forward.

## Mandatory Category Backbone

Each category markdown must include these governance and content sections:

- `Role In Hair Concierge`
- `Use When`
- `Best Fit`
- `Weak Fit / Not The Best Lever`
- `Realistic Benefit`
- `Category Boundaries`
- `Agent Interpretation Hooks`
- `Agent May Decide`
- `Code And Tools Decide`
- `Required Grounding`
- `Safety Boundary`
- `German Answer Shape`
- `Do Not`

Category-specific sections are allowed and encouraged when they carry value, for example `CWC/OWC Conditioner Logic`, `Oil Role Logic`, `Reset Lane Logic`, or `Protein/Moisture Logic`.

## Carry-Forward Rules From First Batch Review

Apply these rules to every remaining category family. They came from the shampoo / conditioner / leave-in / mask review and are now part of the migration contract.

- Use only schema-supported terminal values in `Agent Interpretation Hooks`. Do not invent new values such as `category_assessment`, `category_comparison`, `product_comparison`, `routine_guidance`, `add_step`, `replace_step`, `change_step`, or `suspected_trigger_category` unless the contract is changed first.
- Split "Welche Art von ..." / "Was fuer ein ..." category-type questions from "Welches ..." / "Nenn mir ..." / "Empfiehl mir ..." concrete product asks.
- Add a `product_detail` hook for named products and product-specific claim checks in every category.
- Split routine placement/explanation from routine mutation. Placement and usage questions use `primary_intent: routine_explanation`, `routine_intent: none`, and no routine tool unless current routine state is needed. Saved/current routine changes use `primary_intent: routine_mutation` and require `build_or_fix_routine`.
- Use `care_category: none` for safety-boundary answers. If the user links symptoms to a category, preserve the suspected trigger in `evidence_quote` or the safety wording instead of adding unsupported contract fields.
- Keep exact cadence, timing, temperature, compatibility, scalp use, protocol, and product-specific role/claim language grounded in product metadata.
- Let category prose give flexible general guidance only. For example, "gelegentlich", "bei Bedarf", "alle paar Waeschen" can be category education; exact product protocol cannot.
- Update each category JSON with matching `hard_rules`, `required_grounding`, `ask_when`, and `soft_rubrics` for these rules.
- Add or update tests/eval cases that pin these distinctions for the family before calling the family checkpoint ready.

## Target File Map

Category guidance:

- `data/agent-v2/guidance/categories/shampoo.md/.json`
- `data/agent-v2/guidance/categories/conditioner.md/.json` already transformed as pilot
- `data/agent-v2/guidance/categories/leave-in.md/.json`
- `data/agent-v2/guidance/categories/mask.md/.json`
- `data/agent-v2/guidance/categories/oil.md/.json`
- `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md/.json`
- `data/agent-v2/guidance/categories/dry-shampoo.md/.json`
- `data/agent-v2/guidance/categories/peeling.md/.json`
- `data/agent-v2/guidance/categories/bondbuilder.md/.json` consistency pass only unless gaps appear

Base guidance:

- `data/agent-v2/guidance/base/general-advice.md/.json`
- `data/agent-v2/guidance/base/product-recommendation.md/.json`
- `data/agent-v2/guidance/base/routine-building.md/.json`
- `data/agent-v2/guidance/base/safety-boundaries.md/.json`
- `data/agent-v2/guidance/base/advisor-rules.md/.json`
- `data/agent-v2/guidance/base/answer-contract.md/.json`
- `data/agent-v2/guidance/base/tone-and-format.md/.json`

Runtime loading:

- `src/lib/agent-v2/tools/guidance-tool.ts`
- `src/lib/agent-v2/guidance/package-index.ts` only if package IDs or metadata expectations change

Migration docs:

- `docs/agent-v2-guidance-migration/source-map.md`
- `docs/agent-v2-guidance-migration/category-guidance-standard.md`
- short family checkpoint summaries under `docs/agent-v2-guidance-migration/`

Tests and evals:

- `tests/agent-v2-guidance-compiler.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `tests/agent-v2-contracts.spec.ts`
- `tests/agent-v2-responses-runtime.spec.ts`
- `tests/agent-v2-manual-regression.spec.ts`
- `data/agent-v2/evals/guidance-migration-regression.json`
- `data/agent-v2/evals/request-interpretation-regression.json`

## Scope Boundaries

In scope:

- Migrating legacy topics, overlays, playbooks, and routine implications into AgentV2 guidance.
- Updating category/base markdown and JSON rubrics.
- Updating `load_advisor_guidance` selection so `base.general_advice.v1` loads broadly.
- Updating tests and eval fixtures for category behavior, broad concern/goal logic, comparison semantics, and grounding.
- Family checkpoint summaries and manual/LLM compare checks.

Out of scope:

- Product catalog/ranking changes.
- New concern package family.
- New runtime overlay system.
- Archiving legacy files in this same implementation.
- External haircare research, except for high-risk/medical/overclaim checks.
- UI changes.

## Phase 0: Lock Harness And Loading Semantics

**Progress 2026-05-21:** Implemented. Focused verification has passed in later family checkpoints; the original red phase for new tests is historical and cannot be re-established without reverting work.

**Files:**
- `tests/agent-v2-guidance-compiler.spec.ts`
- `tests/agent-v2-final-answer-validator.spec.ts`
- `src/lib/agent-v2/tools/guidance-tool.ts`
- `data/agent-v2/evals/request-interpretation-regression.json`

- [x] Add hybrid section-contract tests for the mandatory category backbone. Do not require every optional template section.
- [x] Add metadata tests for category JSON: hard rules, soft rubrics, source paths, and grounding expectations.
- [x] Add tests proving balanced comparisons can load multiple category packages while terminal `care_category` remains `none`.
- [x] Add tests proving broad concern/goal prompts can use `care_category: none` without blocking category guidance loading.
- [x] **Load-bearing runtime change:** update `selectGuidancePackageIds` so `base.general_advice.v1` loads for `general_advice`, `product_recommendation`, and `routine` answer modes.
- [x] Verify the compare runner command works and writes `tmp/agent-v2-guidance-regression-*.md`:

```bash
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

- [x] Run the focused tests and confirm new tests fail before implementation where applicable:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts
```

## Phase 1: Wash / Length-Care Family

**Progress 2026-05-27:** Complete. Category transformation completed and reviewed. Later shared regression/repair work supersedes the original family-only failure table. The checkpoint summary exists and can remain historical; final pass/fail status is now tracked in `open-regression-failures.md`.

**Categories:**
- `shampoo`
- `leave-in`
- `mask`
- `conditioner` already transformed; use as reference and regression anchor

**Legacy sources to mine first:**
- `data/agent-guidance/topics/shampoo/*`
- `data/agent-guidance/topics/leave-in/*`
- `data/agent-guidance/topics/mask/*`
- relevant overlays: `dry-lengths`, `fine-hair`, `low-density-weight-sensitive`, `curly-hair`, `coily-hair`, `tangling-detangling`, `mechanical-stress`, `protein-moisture-balance`, `heat-styling`, `chemical-or-color-treated`
- relevant playbooks: `usage-and-application`, `category-comparison`, `recommend-products`, `troubleshoot-hair-issue`
- relevant routine docs where category behavior changes

**Category rewrite done contract:** each rewritten category has all mandatory backbone sections, at least one category-specific section where legacy value requires it, every operational rule anchored to `source-map.md` or the standard, matching JSON hard rules / soft rubrics / required grounding / ask policies, first-batch carry-forward hooks, and eval coverage for education, type-vs-product ask, product detail, comparison, routine explanation vs mutation, and safety where relevant.

- [x] Update `source-map.md` ledger rows for every source mapped to this family before or during the rewrite.
- [x] Rewrite `category.shampoo.v1`. Done = category rewrite contract met, with scalp/root cleansing, rinse-down, dry-length steering, wash rhythm, and scalp safety boundaries.
- [x] Rewrite `category.leave_in.v1`. Done = category rewrite contract met, with leave-on booster/simplification logic, heat-protection grounding, fine/low-density dosing, and conditioner replacement boundaries.
- [x] Rewrite `category.mask.v1`. Done = category rewrite contract met, with periodic extra-care logic, conditioner boundary, protein/moisture role, cadence caution, and repair overclaim limits.
- [x] Update the relevant `.json` files with hard rules, soft rubrics, required grounding, and ask policies.
- [x] Fold remaining broad goal/concern/technique value into `base.general_advice.v1` only after category ownership is exhausted.
- [x] Update eval fixtures for product asks, category education, balanced comparisons, broad concerns/goals, and safety boundaries.
- [x] Update `source-map.md` statuses from `considered for V0` to final migration decisions, with notes naming target sections.
- [x] Add a short checkpoint summary: `docs/agent-v2-guidance-migration/wash-length-care-family-summary.md`.
- [x] Run automated checks:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-contracts.spec.ts
```

- [x] Run the Manual/LLM Compare Contract command and record pass/review/fail counts plus accepted/rejected diffs. Current state: shared regression and later full-quality repair runs exist; current pass/fail ledger lives in `open-regression-failures.md` rather than the older family summary.
- [x] Pause for user review before Phase 2.

## Phase 2: Reset / Scalp-Adjacent Family

**Progress 2026-05-21:** Category transformation completed, reviewed, and blocker pass completed. Original Phase 2 regression blockers were investigated in `tmp/agent-v2-guidance-regression-2026-05-21T09-41-30-910Z.md`; remaining latest failures are routine/tool-boundary issues tracked in `docs/agent-v2-guidance-migration/open-regression-failures.md`.

**Categories:**
- `deep-cleansing-shampoo`
- `dry-shampoo`
- `peeling`

**Legacy sources to mine first:**
- `data/agent-guidance/topics/deep-cleansing/*`
- `data/agent-guidance/topics/dry-shampoo/*`
- `data/agent-guidance/topics/peeling/*`
- relevant overlays: `buildup-risk`, `oily-scalp`, `dandruff-scalp`, `sensitive-scalp`, `dry-lengths`, `frizz-control`
- relevant playbooks: `usage-and-application`, `troubleshoot-hair-issue`, `category-comparison`

**Category rewrite done contract:** each rewritten category has all mandatory backbone sections, at least one category-specific section where legacy value requires it, every operational rule anchored to `source-map.md` or the standard, matching JSON hard rules / soft rubrics / required grounding / ask policies, first-batch carry-forward hooks, and eval coverage for education, type-vs-product ask, product detail, comparison, routine explanation vs mutation, and safety where relevant.

- [x] Update `source-map.md` ledger rows for every source mapped to this family before or during the rewrite.
- [x] Rewrite `category.deep_cleansing_shampoo.v1`. Done = category rewrite contract met, with clarifying/chelating/reset distinctions, normal-residue vs reset boundaries, flexible cadence caution, buildup clues, non-repair boundaries, named-product/claim grounding, and comparison hooks against normal shampoo, peeling, and chelating/reset logic.
- [x] Rewrite `category.dry_shampoo.v1`. Done = category rewrite contract met, with temporary freshness bridge logic, no-cleanse boundary, buildup caution, scalp symptom routing, named-product/claim grounding, and exact-use/protocol grounding.
- [x] Rewrite `category.peeling.v1`. Done = category rewrite contract met, with tolerant-scalp/buildup use, symptom routing, exfoliation boundaries, non-treatment claims, named-product/claim grounding, and exact scalp-use/frequency/protocol grounding.
- [x] Update `.json` files with hard rules, soft rubrics, required grounding, and ask policies.
- [x] Fold remaining broad concern and safety leftovers into `base.general_advice.v1` or `base.safety_boundaries.v1`.
- [x] Update eval fixtures for reset education, type-vs-product asks, product detail, oily roots, buildup, flakes/itching, irritation, routine placement, routine mutation, and category comparisons.
- [x] Update `source-map.md` statuses, with notes naming target sections.
- [x] Add a short checkpoint summary: `docs/agent-v2-guidance-migration/reset-scalp-family-summary.md`.
- [x] Run automated checks:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-contracts.spec.ts
```

- [x] Run the Manual/LLM Compare Contract command and record pass/review/fail counts plus accepted/rejected diffs in the checkpoint summary.
- [x] Pause for user review before Phase 3.

## Phase 3: Finish / Repair Family

**Progress 2026-05-27:** Complete. Category transformation completed and feedback integrated for `oil` and `bondbuilder`. The earlier five-failure Phase 3 report was investigated and fed into Phase 4/routine-first repair work. Later runtime/validator repair commits resolved the known hard failures; current caveats are live-regression quota blockage and final human quality review, not missing finish/repair category content.

**Categories:**
- `oil`
- `bondbuilder` consistency pass

**Legacy sources to mine first:**
- `data/agent-guidance/topics/hair-oiling/*`
- `data/agent-guidance/topics/bond-builder/*`
- relevant overlays: `damage-repair`, `chemical-or-color-treated`, `frizz-control`, `dry-lengths`, `heat-styling`, `protein-moisture-balance`, `hair-loss-or-thinning-guardrail`, `sensitive-scalp`
- relevant playbooks: `compare-or-decide`, `recommend-products`, `usage-and-application`, `troubleshoot-hair-issue`

**Category rewrite done contract:** each rewritten category has all mandatory backbone sections, at least one category-specific section where legacy value requires it, every operational rule anchored to `source-map.md` or the standard, matching JSON hard rules / soft rubrics / required grounding / ask policies, first-batch carry-forward hooks, and eval coverage for education, type-vs-product ask, product detail, comparison, routine explanation vs mutation, and safety where relevant.

- [x] Update `source-map.md` ledger rows for every source mapped to this family before or during the rewrite.
- [x] Rewrite `category.oil.v1`. Done = category rewrite contract met, with finish/tips, pre-wash length protection, cautious scalp comfort, wash-out technique, named-product/claim grounding, exact scalp-use/protocol grounding, growth/repair overclaim boundaries, and weight/buildup caution.
- [x] Check `category.bondbuilder.v1` against the final standard and conditioner-pilot decisions. Done = category rewrite contract remains met after patching only real gaps, especially product-detail hooks, type-vs-product asks, routine explanation vs mutation, safety `care_category: none`, and exact protocol/technology-lane/claim grounding.
- [x] Update `.json` files with hard rules, soft rubrics, required grounding, and ask policies.
- [x] Move high-risk scalp/hair-loss/oil-growth leftovers into `base.safety_boundaries.v1`.
- [x] Update eval fixtures for oil role distinctions, type-vs-product asks, product detail, routine placement, growth claims, repair overclaims, Bondbuilder comparisons, exact protocol claims, and safety prompts.
- [x] Update `source-map.md` statuses, with notes naming target sections.
- [x] Add a short checkpoint summary: `docs/agent-v2-guidance-migration/finish-repair-family-summary.md`.
- [x] Run automated checks:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-contracts.spec.ts
```

- [x] Run the Manual/LLM Compare Contract command and record pass/review/fail counts plus accepted/rejected diffs in the checkpoint summary.
- [x] Investigate Phase 3 failures and document whether each is category-content, product-detail runtime, or routine-threshold work.
- [x] Pause for user review before Phase 4.

## Phase 4: Base Package Consolidation

**Progress 2026-05-27:** Substantially complete. The first base-contract pass was followed by routine-first and full-quality repair work. Later sessions tightened `base.general_advice.v1`, `base.product_recommendation.v1`, `base.routine_building.v1`, `base.safety_boundaries.v1`, `base.answer_contract.v1`, and `base.tone_and_format.v1`, plus tool descriptions, terminal guidance, validator behavior, and regression criteria. Earlier terminal/routine alignment failures are now superseded by the May 26 repair ledger. Remaining Phase 4 work is closeout review, not new base architecture.

**Files:**
- `data/agent-v2/guidance/base/general-advice.md/.json`
- `data/agent-v2/guidance/base/product-recommendation.md/.json`
- `data/agent-v2/guidance/base/routine-building.md/.json`
- `data/agent-v2/guidance/base/safety-boundaries.md/.json`
- `data/agent-v2/guidance/base/advisor-rules.md/.json`
- `data/agent-v2/guidance/base/answer-contract.md/.json`
- `data/agent-v2/guidance/base/tone-and-format.md/.json`

- [x] Add separate `Concern Logic` and `Goal Logic` sections to `base.general_advice.v1`, citing source-map rows or the standard.
- [x] Verify `base.general_advice.v1` has category comparison, usage/application, technique, and troubleshooting sections; if missing, add them citing source-map rows or the standard.
- [x] Verify `base.product_recommendation.v1` has sections for product grounding, count policy, product-card permission, comparison claims, and no-claims-from-names rules; if missing, add them citing source-map rows or the standard.
- [x] Verify `base.routine_building.v1` has sections for routine construction, active routine follow-up, mutation permission, and routine-return behavior; if missing, add them citing source-map rows or the standard.
- [x] Verify `base.safety_boundaries.v1` has sections for medical/scalp/hair-loss boundaries and hard redirects; if missing, add them citing source-map rows or the standard.
- [x] Verify `base.answer_contract.v1` documents `care_category: none` as no single primary accountability category; if missing, add it citing the decision map and standard.
- [x] Final review only: trim duplicated broad prose from base if it still creates bloat or conflicting ownership. Reviewed on 2026-05-27; trimmed duplicate routine threshold prose and softened base mask cadence wording so exact protocol remains product-metadata-grounded.
- [x] Update JSON rubrics/hard rules to match the final base package responsibilities.
- [x] Add/update tests proving broad general advice is loaded for product recommendation and routine turns.
- [x] Run automated checks. Latest documented deterministic suites:

- `npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-compare-runner.spec.ts` -> `203/203` passed.
- Expanded deterministic bundle including product selection, recommendation-engine, and seed-script guards -> `373/373` passed.
- Current dirty deep-cleansing evidence work focused suite -> `169/169` passed.

Original Phase 4 command:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-manual-regression.spec.ts
```

## Phase 5: Final Source Map And Regression Verification

**Progress 2026-05-27:** Partially complete. Source-map coverage and deterministic repair verification are complete. Final summary, final live model-backed regression, and final handoff recording remain open. Latest live regression attempts on May 26 are quota-blocked (`429`) and must not be interpreted as answer-quality failures.

- [x] Verify every `data/agent-guidance/**/*.md` row in `source-map.md` has a final status:
  - `migrated_to_category`
  - `migrated_to_base_general`
  - `migrated_to_base_routine`
  - `migrated_to_base_product`
  - `migrated_to_safety`
  - `catalog_or_tool_source_of_truth`
  - `duplicate_removed`
  - `rejected_with_reason`
  - `deferred_with_reason`
- [x] Add a final summary: `docs/agent-v2-guidance-migration/final-transformation-summary.md`.
- [x] Run final full targeted AgentV2 verification after the current dirty deep-cleansing evidence changes are either committed or intentionally excluded. Current result:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-guidance-compiler.spec.ts
```

Result on 2026-05-27: `217/217` passed.

- [ ] Run the final Manual/LLM Compare Contract command for all migrated guidance prompts once OpenAI API quota is available. Latest attempts wrote quota-blocked reports, so this remains open:

```bash
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

- [ ] Review final live regression output for missing legacy value, over-broad base guidance, ungrounded product claims, safety regressions, and product-card permission mistakes.
- [ ] Update tests/evals for any accepted behavioral decisions from the compare run.

Additional closeout before final acceptance:

- [ ] Review and either commit or split out the current deep-cleansing reset/product evidence changes.
- [x] Remove or ignore `data/agent-v2/guidance/.DS_Store`.
- [ ] Reconcile this branch being behind `origin/main` before PR/merge.

## Phase 6: Follow-Up Archive Plan

**Progress 2026-05-27:** Not started, intentionally. Do not archive in this plan. Create a follow-up cleanup plan after transformation acceptance, final live regression rerun, and branch reconciliation.

The follow-up should:

- move or mark `data/agent-guidance/**` as archived source material
- move or archive `docs/agent-v2-guidance-migration/**` review artifacts as appropriate
- adjust tests that currently require `source-map.md` to reference every active legacy file
- keep enough audit trail for worst-case recovery

## Verification Checklist

Current verification status:

- Focused current dirty-work suite run on 2026-05-27:

```bash
npx tsx --test tests/seed-deep-cleansing-products.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts
```

Result: `169/169` passed.

- Final targeted AgentV2 suite run on 2026-05-27:

```bash
npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-guidance-compiler.spec.ts
```

Result: `217/217` passed.

- Source-map status verification on 2026-05-27: `73` legacy rows, `0` invalid statuses.
- `git diff --check` passed on 2026-05-27.
- Latest documented expanded deterministic bundle from the May 26 repair pass: `373/373` passed.
- Latest live model-backed regression attempts are blocked by OpenAI quota (`429`) and remain the main verification gap.

Automated:

- `npx tsx --test tests/agent-v2-guidance-compiler.spec.ts`
- `npx tsx --test tests/agent-v2-final-answer-validator.spec.ts`
- `npx tsx --test tests/agent-v2-contracts.spec.ts`
- `npx tsx --test tests/agent-v2-responses-runtime.spec.ts`
- `npx tsx --test tests/agent-v2-compare-runner.spec.ts`
- `npx tsx --test tests/agent-v2-manual-regression.spec.ts`

Manual/LLM compare:

- command: `npx tsx scripts/agent-v2/run-guidance-regression.ts`
- fixture: `data/agent-v2/evals/guidance-migration-regression.json`
- run after each category family
- include concrete product asks, category education, balanced comparisons, broad concerns, goals, routine follow-ups, and safety prompts
- pass requires `fail = 0`; manually inspect `review` cases
- record result summary, accepted diffs, and rejected regressions in the family checkpoint doc

Review:

- user reviews each family checkpoint before the next family starts
- final user review before follow-up archive planning

## Execution Handoff

Next recommended skill: `superpowers:subagent-driven-development` for family batches, with disjoint write scopes per worker. The wash/length-care family has already served as the pilot pattern; continue with the remaining families instead of reworking the plan shape again.

- worker 1: `deep-cleansing-shampoo.md/.json`
- worker 2: `dry-shampoo.md/.json`
- worker 3: `peeling.md/.json`
- next batch worker 1: `oil.md/.json`
- next batch worker 2: `bondbuilder.md/.json` consistency pass
- main agent: source-map, base package consolidation, schema-vocabulary sanity, test/eval integration, family summaries, and verification

Workers must not edit the same category/base files concurrently. Base package edits should be coordinated after category diffs are reviewed.
