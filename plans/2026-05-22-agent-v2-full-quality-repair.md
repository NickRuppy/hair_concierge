# AgentV2 Full Quality Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the full set of quality issues found in the 46-prompt AgentV2 guidance regression manual review, including eval setup, German conversational quality, product metadata grounding, factual category guidance, and routine/tool latency.

**Architecture:** Keep AgentV2 model-native: guidance and tool contracts steer the model, deterministic code enforces product/routine truth, and evals prove the behavior. Do not add a new intent router. Improve the context/tool surface where the model lacks facts, tighten answer-quality guidance where the model has enough context but poor conversational habits, and clean the regression harness so quality findings are not caused by invalid fixture profiles.

**Tech Stack:** TypeScript, Next.js, OpenAI Responses API, Zod contracts, AgentV2 guidance markdown/JSON packages, Node test runner with `tsx`, Compare Lab/guidance regression JSON fixtures.

## Execution Status - 2026-05-26

Implemented in the `codex/gpt-54-responses-migration-plan` worktree:

- Eval/profile setup repaired: normal 46-case guidance-regression runs now use complete named synthetic profiles, with incomplete profiles separated into explicit edge cases.
- German opening/ending and feasible CTA guidance tightened across base packages and pinned in manual regression criteria.
- Bondbuilder product protocol projection added through grounded `usage_hint` facts, with runtime coverage for K18-style product protocol answers.
- Deep-cleansing reset focus schema renamed around actual product landscape lanes and a reviewed 10-product dry-run seed matrix added.
- Unsupported product-detail wording cleaned up so user-facing answers do not leak catalog internals or promise unsupported photo/link verification.
- Deep cleansing vs peeling, oil heat-protection, dry-shampoo bridge, oil role, conditioner/CWC, leave-in, and bondbuilder copy/fit guidance patched.
- Active routine product follow-ups now stay on `select_products`; routine rebuild tooling is blocked unless the user asks to change the routine.
- Trace timing now records model/tool latency in the regression JSON and Markdown output.
- Mild cosmetic scalp routing was verified directly against product selection; no product logic change was required.

Verification:

- `npx tsx --test tests/agent-v2-contracts.spec.ts tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts tests/agent-v2-compare-runner.spec.ts` -> 203/203 passed.
- Expanded deterministic bundle including product selection, recommendation-engine, and seed-script guards -> 373/373 passed.
- Product seed and recommendation-engine focused suites passed during their task passes.
- Full live 46-case guidance regression was attempted after repairs, but OpenAI API quota returned `429 You exceeded your current quota`; rerun is still required for final model-backed content confidence.
- The live regression runner now exits nonzero when report failures are present; use `--allow-failures` only for exploratory failed-report collection.
- The deep-cleansing seed apply path is guarded by project confirmation: `--apply --confirm-project=pqdkhefxsxkyeqelqegq`. Stale deactivation still requires the additional `--deactivate-stale` flag.

Current ledger: `docs/agent-v2-guidance-migration/open-regression-failures.md`.

---

## Spec Link

- Approved direction: user manual review of all 46 latest guidance-regression prompts and follow-up alignment in this thread.
- Evidence report: `tmp/agent-v2-guidance-regression-2026-05-21T18-20-27-645Z.md`
- Machine-readable report: `tmp/agent-v2-guidance-regression-2026-05-21T18-20-27-645Z.json`
- Failure/review ledger before this plan: `docs/agent-v2-guidance-migration/open-regression-failures.md`
- Existing earlier routine-first plan, now superseded for broader quality work: `plans/2026-05-21-agent-v2-routine-first-regression-fixes.md`

## User Situation

The latest shared fixture has no hard validator failures, but the user manually reviewed all 46 replies and found many quality problems that still matter in production:

- some replies used a hidden/incomplete synthetic profile and therefore sounded wrong;
- openings and endings felt canned or redundant;
- CTAs sometimes offered actions the system cannot satisfy from current data;
- some product facts exist in code but are not visible to AgentV2;
- other product facts are genuinely missing from catalog specs and need source-backed metadata/backfill, not only better prompting;
- some factual category boundaries need stronger evidence-grounded guidance;
- routine-context follow-ups sometimes call expensive routine tooling when a cheaper product/context path would be enough.

## Promised End-State

- Normal regression cases use complete, valid profile context; explicit incomplete-profile cases are separated and named as edge cases.
- German answers open naturally from the user's actual wording and end with a useful, feasible, non-redundant CTA.
- AgentV2 can answer bondbuilder product protocol questions from curated product metadata when that metadata exists.
- Review-critical product metadata gaps are either source-backed and exposed through product tools, or explicitly documented as unavailable with clean user-facing fallback wording.
- Deep cleansing vs peeling, oil vs heat protection, scalp peeling, and dry shampoo guidance stay conservative and evidence-grounded.
- Routine-context product follow-ups reuse active routine context and avoid `build_or_fix_routine` unless the user asks to change routine state.
- Regression traces expose enough timing/tool detail to debug future latency spikes.
- The 46-case eval plus focused tests pass, and the user-review issues are reflected in updated fixture criteria.

## Scope Boundaries

In scope:

- AgentV2 eval fixture/context setup for the guidance migration regression.
- AgentV2 answer quality guidance for German openings, endings, CTAs, and impossible offers.
- Product projection/tool contract changes for bondbuilder usage protocol metadata.
- Source-backed product metadata and minimum backfill for review-critical gaps: bondbuilder protocols and deep-cleansing product/spec availability. Dry-shampoo residue/no-white-cast and peeling product backfill are deliberately deferred.
- User-facing unsupported-claim wording for dry shampoo, heat protection, chelating/color-safe, and other product details that remain unsourced after the metadata pass.
- Guidance refinements for deep cleansing, peeling, oil, dry shampoo, leave-in, bondbuilder, conditioner, and routine basics where the manual review found quality issues.
- Runtime/tool guidance and validator tests that prevent unnecessary routine-tool calls for routine-context product deep dives.
- Trace instrumentation for per-turn/per-tool latency.

Out of scope:

- Dry-shampoo residue/no-white-cast metadata.
- Peeling product backfill.
- Exhaustive catalog enrichment beyond the review-critical fields and products needed to close this 46-prompt quality pass.
- Any product claim that cannot be backed by curated source/product metadata.
- Building saved routine persistence/update UX beyond noting it as a future product direction.
- Medical diagnosis or treatment logic.
- UI changes.

## Root Cause Buckets

| Bucket | Root Cause | Fix Style |
|---|---|---|
| Eval/context setup | One hardcoded synthetic profile has invalid/incomplete canonical fields and is reused for all 46 cases. | Harness/fixture cleanup plus tests. |
| Conversational German | Guidance says to end practically but does not define natural opening/ending quality or feasible CTA boundaries. | Base tone/product/general guidance plus eval criteria. |
| Existing metadata hidden | Bondbuilder `usage_hint` exists but is not projected to AgentV2 product facts. | Tool projection and contract tests. |
| Missing metadata | Bondbuilder protocols are hidden, deep-cleansing products are placeholder/empty, and some product-detail claims remain unsupported. | Source-backed bondbuilder protocol projection, reviewed deep-cleansing seed/backfill, and graceful unsupported-claim copy where still unsourced. |
| Category evidence gaps | Some guidance over-compresses scalp/fibre, peeling/reset, and oil/heat protection distinctions. | Evidence-grounded category guidance. |
| Routine latency/tool overuse | Active routine context is sticky, and follow-up product asks can still trigger `build_or_fix_routine`. | Runtime/guidance tests for context reuse and product-only follow-up path. |
| Observability | Reports show total latency and actual tools but not enough per-step timing. | Trace timing fields and report output. |

## Manual Review Bucket Coverage

| User bucket | Covered by |
|---|---|
| Profile And Routine Context Integrity | Task 1 eval/profile cleanup, Task 7 routine context reuse, Task 9 category-specific fit polish, Task 10 mild scalp routing. |
| Bad Or Redundant Closing Sentences | Task 2 natural opening/ending and feasible CTA contract, plus fixture criteria for affected cases. |
| Unnatural German Transitions And Copy | Task 2 tone contract and Task 9 category-specific German copy polish. |
| Product Catalog / Metadata Gaps | Task 3 bondbuilder projection, Task 4 reviewed deep-cleansing seed/backfill, Task 5 unsupported-claim wording after metadata pass. Dry-shampoo residue and peeling products are deferred. |
| Bondbuilder Protocol Is Under-Specified | Task 3 projection plus Task 4 protocol fields/source/cadence compatibility where schema is missing. |
| Factual Hair-Care Boundary Questions | Task 6 evidence-grounded category boundaries, with external evidence kept separate from internal ranking logic. |
| Internal-System Leakage | Task 5 unsupported-claim wording and Task 2 feasible CTA guardrails. |
| Latency / Tool Loop Cost | Task 7 routine context reuse and Task 8 per-step timing instrumentation. |

## Execution Strategy

Do not use all 46 cases as the inner development loop. Preserve all 46 as the full regression suite, but run smaller suites while implementing so the team can get fast signal without drowning in manual review.

| Suite | Size | Purpose | When To Run |
|---|---:|---|---|
| Focused smoke | 10 cases | Fast signal for the active repair pass | After each task or small task group |
| Bucket suite | 5-10 cases per bucket | Validate one failure family in depth | After finishing a bucket |
| Full regression | 46 cases | Final confidence across the migration fixture | At major checkpoints and before handoff |

Focused smoke case IDs:

```json
[
  "conditioner-specific-fit",
  "conditioner-exact-two",
  "routine-basics-build",
  "conditional-balance-comparison",
  "oil-education-finish-as-prewash",
  "frizz-color-damage-routine",
  "bondbuilder-product-detail-protocol",
  "previous-offer-reference",
  "routine-then-mask-oil-choice",
  "deep-cleansing-specific-products"
]
```

Implementation priority:

1. Eval/profile context integrity. Fix this first because bad test context poisons every later quality judgment.
2. Bondbuilder protocol projection. This is a concrete existing-data-not-exposed problem.
3. Natural German opening/ending and feasible CTA guidance. This is frequent and highly user-visible.
4. Deep-cleansing seed matrix review and reset-focus enum cleanup. This is product-data heavy and should pass through Nick's seed-list review before apply.
5. Factual category boundary guidance. Patch deep cleansing vs peeling, oil heat protection, oil default purpose, and color/bleach/bondbuilder fit after the evidence decisions are encoded.
6. Routine context and latency. Fix routine-tool overuse after correctness/copy foundations are in place, unless latency blocks testing.
7. Trace timing. Add this before final handoff so future slow cases are diagnosable.

## Target File Map

Eval/context setup:

- Modify: `scripts/agent-v2/run-guidance-regression.ts`
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `tests/agent-v2-manual-regression.spec.ts`
- Optional modify: `src/lib/agent-v2/compare/run-agent-v2.ts`

Conversational guidance:

- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
- Modify: `data/agent-v2/guidance/base/general-advice.md`
- Modify: `data/agent-v2/guidance/base/general-advice.json`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md`
- Modify: `data/agent-v2/guidance/base/product-recommendation.json`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts` only if runtime terminal guidance needs an always-loaded copy of the CTA contract.

Product projection and metadata grounding:

- Modify: `src/lib/agent-v2/tools/select-products-projection.ts`
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `src/lib/recommendation-engine/selection.ts` only if current metadata does not consistently attach `usage_hint`.
- Modify: `src/lib/bondbuilder/usage-protocols.ts` only if protocol labels need clearer user-facing copy.
- Test: `tests/agent-v2-product-selection.spec.ts` if present, otherwise add focused coverage to the closest existing AgentV2 product/projection test.

Product catalog/spec backfill:

- Modify: `src/lib/bondbuilder/constants.ts`
- Modify: `src/lib/bondbuilder/usage-protocols.ts`
- Modify: `scripts/seed-bondbuilder-products.ts`
- Modify: `src/lib/deep-cleansing-shampoo/constants.ts`
- Modify: `scripts/seed-deep-cleansing-products.ts`
- Modify/Create: Supabase migration under `supabase/migrations/` because the deep-cleansing `reset_focus` enum names should be corrected before the schema calcifies.
- Test: product spec/backfill tests closest to the existing category seed/backfill coverage.

Category guidance:

- Modify: `data/agent-v2/guidance/categories/bondbuilder.md/.json`
- Modify: `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/categories/peeling.md/.json`
- Modify: `data/agent-v2/guidance/categories/oil.md/.json`
- Modify: `data/agent-v2/guidance/categories/dry-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/categories/leave-in.md/.json`
- Modify: `data/agent-v2/guidance/categories/conditioner.md/.json`
- Modify: `data/agent-v2/guidance/categories/shampoo.md/.json` only for mild cosmetic scalp route wording.

Routine context and latency:

- Modify: `data/agent-v2/guidance/base/routine-building.md/.json`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md/.json`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts` only if the validator currently forces routine tooling where active routine step IDs would be sufficient.
- Modify: `src/lib/agent-v2/runtime/trace.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `scripts/agent-v2/run-guidance-regression.ts`

Verification and docs:

- Modify: `tests/agent-v2-guidance-compiler.spec.ts`
- Modify: `tests/agent-v2-final-answer-validator.spec.ts`
- Modify: `tests/agent-v2-responses-runtime.spec.ts`
- Modify: `tests/agent-v2-contracts.spec.ts`
- Modify: `tests/agent-v2-manual-regression.spec.ts`
- Modify: `docs/agent-v2-guidance-migration/open-regression-failures.md`
- Optional create: `docs/agent-v2-guidance-migration/full-quality-repair-summary.md`

## External Evidence Notes

External evidence was used only for category-boundary questions, not for internal product ranking:

- Shampoo/deep cleansing: shampoo can cleanse scalp and hair fibre; user guidance may focus application on scalp/roots, but deep cleansing is not scalp-only.
- Dry shampoo: absorbs oil but does not replace washing; repeated use can create buildup.
- Heat protection: do not treat plain oil as heat protectant unless the product has a specific supported heat-protection claim.
- Peeling: keep scalp peeling occasional, gentle, scalp-directed, and avoid escalation for active irritation, pain, persistent itch/flakes, or hair-loss-adjacent symptoms.

Implementation should keep citations in planning/docs if referenced, but user-facing answers should remain concise German advice, not citation-heavy.

## Task 1: Clean The Eval Context Before Judging Product Logic

**Files:**
- Modify: `scripts/agent-v2/run-guidance-regression.ts`
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Modify: `tests/agent-v2-manual-regression.spec.ts`

- [ ] **Step 1: Add a failing fixture-context test**

Add or update a test that loads the guidance regression fixture and asserts normal cases use a complete canonical profile. The test should fail on the current hardcoded setup because `scalp_type: "normal"`, `scalp_condition: "normal"`, missing `protein_moisture_balance`, and non-canonical wash frequency are not acceptable for normal cases.

Run:

```bash
npx tsx --test tests/agent-v2-manual-regression.spec.ts
```

Expected before implementation: FAIL on canonical profile/context assertions.

- [ ] **Step 2: Introduce named synthetic profile fixtures**

Replace the single implicit hardcoded profile with named profiles such as:

```ts
const GUIDANCE_REGRESSION_PROFILES = {
  completeFineWavyColored: {
    hair_texture: "wavy",
    thickness: "fine",
    density: "medium",
    scalp_type: "balanced",
    scalp_condition: null,
    concerns: ["dryness", "frizz"],
    goals: ["less_frizz", "shine", "easy_routine"],
    chemical_treatment: ["colored"],
    wash_frequency: "daily",
    protein_moisture_balance: "moisture_needed"
  },
  mildCosmeticScalp: {
    hair_texture: "straight",
    thickness: "fine",
    density: "medium",
    scalp_type: "balanced",
    scalp_condition: "irritated",
    concerns: ["mild_itch"],
    goals: ["calm_scalp"],
    chemical_treatment: [],
    wash_frequency: "every_2_3_days",
    protein_moisture_balance: "balanced"
  }
} as const
```

Adjust names to the actual canonical contract in `src/lib/profile` / AgentV2 contracts before committing.

- [ ] **Step 3: Mark incomplete-profile cases explicitly**

In `data/agent-v2/evals/guidance-migration-regression.json`, add an explicit profile/context key for normal vs missing-field cases. Conditioner protein/moisture edge cases should say that missing data is intentional; normal product-fit cases should not silently use an incomplete profile.

- [ ] **Step 4: Verify profile-driven replies no longer fail for fake reasons**

Run:

```bash
npx tsx --test tests/agent-v2-manual-regression.spec.ts
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected: the regression still produces 46 reviewable cases, but context-related review notes are no longer caused by invalid profile fields.

## Task 2: Add A Natural German Opening And Feasible CTA Contract

**Files:**
- Modify: `data/agent-v2/guidance/base/tone-and-format.md`
- Modify: `data/agent-v2/guidance/base/tone-and-format.json`
- Modify: `data/agent-v2/guidance/base/general-advice.md/.json`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md/.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `data/agent-v2/evals/guidance-migration-regression.json`

- [ ] **Step 1: Add compiler tests for the new guidance clauses**

Assert the compiled guidance contains these concepts:

- natural opening must answer the user's wording, not default to `Ja` or `Dann`;
- ending must be useful, feasible, and non-redundant;
- CTA must not offer a product/property/action that current tools cannot answer;
- CTA may ask a material question, offer a grounded next action, or bridge back to the routine.

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
```

Expected before guidance change: FAIL because the clauses are absent.

- [ ] **Step 2: Update `tone-and-format.md`**

Add a section:

```markdown
## Natural Conversation Frame

Open as if you listened to the exact user message. Do not start with a bare `Ja`, `Dann`, or a template transition unless it naturally follows from the previous turn. A good opening either answers the question directly or briefly mirrors the user's concern in normal German.

End with one conversational next step only when it is useful. The next step must be feasible with current profile context, product metadata, catalog tools, or a single answerable user input. Do not offer to check a photo, link, exact no-white-cast claim, heat-protection claim, chelating/color-safe claim, or product protocol unless the current system can actually ground that answer.

Do not ask to answer the same question again. If the answer already chose between two products or categories, the CTA should move to a genuinely different useful next step, such as routine placement, dosage, or a material missing input.
```

- [ ] **Step 3: Add matching JSON rubrics**

Add soft rubrics for:

- `tone.natural_opening`
- `tone.feasible_cta`
- `tone.non_redundant_ending`

Keep exact IDs consistent with existing JSON style.

- [ ] **Step 4: Update fixture quality criteria for affected cases**

Add quality criteria to cases called out in the manual review, including:

- `mask-versus-conditioner-education`
- `bondbuilder-brand-comparison-grounded`
- `deep-cleansing-product-detail`
- `dry-shampoo-product-detail`
- `oil-education-finish-as-prewash`
- `leave-in-spray-vs-cream`
- `oil-growth-safety-boundary`
- `peeling-scalp-buildup`

The criteria should pin feasible, non-redundant CTAs rather than exact wording.

- [ ] **Step 5: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts
```

Expected: PASS.

## Task 3: Surface Bondbuilder Product Usage Protocols To AgentV2

**Files:**
- Modify: `src/lib/agent-v2/tools/select-products-projection.ts`
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `data/agent-v2/guidance/categories/bondbuilder.md/.json`
- Test: closest product selection/projection test, plus `tests/agent-v2-responses-runtime.spec.ts`

- [ ] **Step 1: Add a failing projection test**

Create or update a test with a selected K18/OLAPLEX/Epres bondbuilder result that has `metadata.usage_hint`. Assert the AgentV2 projection includes a user-facing supported claim or protocol field that contains the exact use guidance.

Expected before implementation: FAIL because the projection currently surfaces labels such as `usage_protocol` but not the human-readable `usage_hint`.

- [ ] **Step 2: Project usage hints as grounded product facts**

Expose bondbuilder usage guidance in one of these forms:

```ts
supported_claims: [
  {
    claim_id: "bondbuilder.usage_hint",
    label_de: "Anwendung",
    value_de: metadata.usage_hint,
    source: "catalog"
  }
]
```

or a dedicated projection field if the existing contract already has a better place for exact protocol facts. Do not expose raw internal protocol IDs as the main user-facing fact.

- [ ] **Step 3: Tighten bondbuilder guidance**

Update `category.bondbuilder.v1`:

- product-specific protocol, timing, cadence, wash-out, cleanse-after, and booster pairing must come from product metadata;
- if a named product has a projected usage hint, use it directly;
- if no usage hint exists, give only category-level placement and state that exact cadence/protocol is not grounded.

- [ ] **Step 4: Add response-runtime coverage**

Add a stubbed runtime case for:

```text
Muss ich K18 auswaschen und wie oft soll ich es benutzen?
```

Expected final answer behavior:

- calls `load_advisor_guidance`;
- calls `select_products` with `product_request_kind: "product_detail"` and `care_category: "bondbuilder"`;
- says K18 is not rinsed out only if the selected product projection contains the usage hint;
- does not ask the user whether it can answer the protocol if the protocol is already grounded.

- [ ] **Step 5: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts
```

Expected: PASS.

## Task 4: Add Bondbuilder Protocol Metadata And Reviewed Deep-Cleansing Seed Backfill

**Files:**
- Modify: `src/lib/bondbuilder/constants.ts`
- Modify: `src/lib/bondbuilder/usage-protocols.ts`
- Modify: `scripts/seed-bondbuilder-products.ts`
- Modify: `src/lib/deep-cleansing-shampoo/constants.ts`
- Modify: `scripts/seed-deep-cleansing-products.ts`
- Modify/Create: Supabase migration under `supabase/migrations/` for reset-focus enum rename if needed
- Test: closest existing product spec/backfill tests, plus AgentV2 product projection tests

- [ ] **Step 1: Inventory current spec capacity before changing schema**

Check the current spec tables/types for deep cleansing and bondbuilder. Do not add dry-shampoo residue/no-white-cast fields and do not add peeling products in this pass.

Expected inventory result:

- bondbuilder needs exact protocol facts visible to AgentV2: wash out or leave in, before/after conditioner, waiting time, cadence, compatibility caveats, source;
- deep cleansing needs real active products/specs instead of temporary Hair Concierge placeholders;
- deep-cleansing `reset_focus` should use the improved migration-era enum names:
  - `product_sebum_buildup`
  - `metal_mineral_hard_water`
  - `broad_spectrum_detox`

- [ ] **Step 2: Add source fields for protocol/claims where needed**

For bondbuilder protocol constants, add source/protocol fields if the existing shape cannot carry the facts. For deep-cleansing products, keep source URLs and notes in the seed/review matrix only; do not add source/provenance columns to Supabase in this pass.

```ts
type ProductClaimSource = {
  label: string
  url?: string
  checked_at: string
}

type BondbuilderUsageProtocol = {
  rinsed_out: boolean
  placement_de: string
  wait_time_de?: string
  cadence_de?: string
  compatibility_de?: string
  source: ProductClaimSource
}
```

Use existing project naming/style if a similar source/provenance type already exists.

- [ ] **Step 3: Backfill bondbuilder protocols first**

Backfill K18, OLAPLEX, Epres, and any existing active bondbuilder examples with product-specific usage facts. Each fact must come from curated product metadata or a source captured in the constants/seed notes.

Do not use brand-level assumptions for every product in a line.

- [ ] **Step 4: Rename deep-cleansing reset-focus enum before seeding real products**

Rename the reset-focus values in TypeScript, migrations/check constraints, tests, and seed constants:

```ts
type ResetFocus =
  | "product_sebum_buildup"
  | "metal_mineral_hard_water"
  | "broad_spectrum_detox"
```

Mapping rules from product landscape research:

- `product_sebum_buildup`: styling residue, dry-shampoo residue, sebum/oil, dull/heavy/coated/flat feeling.
- `metal_mineral_hard_water`: explicit metal, mineral, hard-water, copper/iron/lead, chlorine, swimmer, or green-tone specialization.
- `broad_spectrum_detox`: explicitly covers product/sebum buildup plus at least one broader environmental/mineral/pollution/hard-water claim.

Keep `color_treated_suitability` separate. It is a compatibility axis, not a reset focus.

- [ ] **Step 5: Build a reviewed deep-cleansing seed matrix**

Replace temporary Hair Concierge placeholder deep-cleansing seeds with a real, reviewable 10-product matrix. Optimize for both German availability/popularity and reset-lane coverage. Include source URLs and source notes for user review, but persist only app-needed fields to the DB:

- `scalp_type_focus`
- `reset_intensity`
- `reset_focus`
- `color_treated_suitability`

Use these source thresholds:

- Retailer page is enough for product existence, German availability, price, affiliate link, and basic listing.
- Official brand/product page or source-backed page is required for stronger claims such as color-safe, hard-water, metal/mineral, chelating, chlorine, sulfate-free, or exact use protocol.
- `color_treated_suitability: "suitable"` requires explicit source-backed color-safe, color-treated, or chemically treated suitability. Do not infer this from "gentle" or "sulfate-free" alone.

- [ ] **Step 6: Add dry-run review gate before applying seed**

The seed script must dry-run by default and print a matrix with:

- brand/product
- retailer URL
- source URL/claim note
- price when available
- `scalp_type_focus`
- `reset_intensity`
- `reset_focus`
- `color_treated_suitability`
- short reason for each mapping

Do not apply the seed until Nick reviews the matrix.

- [ ] **Step 7: Apply after review and verify product metadata**

After review approval, run the seed with `--apply`. Run the closest available product/backfill tests. If no focused test exists, add one that proves:

- bondbuilder selected products expose source-backed protocol facts;
- deep-cleansing catalog availability matches the reviewed seed matrix;
- reset-focus mappings use the new enum names.

Then run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-responses-runtime.spec.ts
```

Expected: PASS.

## Task 5: Patch Product-Detail Unsupported-Claim Wording

**Files:**
- Modify: `data/agent-v2/guidance/base/product-recommendation.md/.json`
- Modify: `data/agent-v2/guidance/categories/dry-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/categories/oil.md/.json`
- Modify: `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md/.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `data/agent-v2/evals/guidance-migration-regression.json`

- [ ] **Step 1: Add guidance compiler assertions**

Assert unsupported product-detail guidance contains:

- do not expose raw phrases such as `Im Katalog ist kein Claim hinterlegt`;
- translate missing metadata into user-facing language;
- do not invite photo/link checks unless the product can actually process them;
- offer generic attributes or ask for a supported exact variant only when that would help.

- [ ] **Step 2: Update product recommendation guidance**

Add wording like:

```markdown
For unsupported product-detail claims, do not expose catalog internals. Say what can be safely confirmed and what cannot. Prefer: `Das kann ich fuer diese Variante nicht sicher versprechen. Sicher beruecksichtigen kann ich aktuell ...` Avoid: `Im Katalog ist kein Claim hinterlegt.`
```

- [ ] **Step 3: Update category-specific unsupported examples**

Dry shampoo:

- no-white-cast/residue needs explicit metadata;
- without it, answer with uncertainty and color/format facts only.

Oil:

- plain oil is not heat protection unless the selected product has an explicit supported heat-protection claim;
- recommend a real heat protectant before heat and oil as finish after styling when not grounded.

Deep cleansing:

- chelating/color-safe claims need product metadata;
- no link/photo CTA unless image/link ingestion is actually available.

- [ ] **Step 4: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts tests/agent-v2-manual-regression.spec.ts
```

Expected: PASS.

## Task 6: Evidence-Ground Deep Cleansing, Peeling, Oil, And Dry Shampoo Boundaries

**Files:**
- Modify: `data/agent-v2/guidance/categories/deep-cleansing-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/categories/peeling.md/.json`
- Modify: `data/agent-v2/guidance/categories/oil.md/.json`
- Modify: `data/agent-v2/guidance/categories/dry-shampoo.md/.json`
- Modify: `data/agent-v2/guidance/base/general-advice.md/.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `data/agent-v2/evals/guidance-migration-regression.json`

- [ ] **Step 1: Add or tighten eval criteria**

For `deep-cleansing-vs-peeling-comparison`, `peeling-type-vs-product`, `dry-shampoo-bridge`, and `oil-product-detail-heat-claim`, add criteria that test the factual boundaries rather than exact prose.

- [ ] **Step 2: Patch deep cleansing vs peeling**

Guidance should say:

- product/mineral film through lengths or hard-water feel points more toward reset/clarifying/chelating shampoo;
- scalp-local residue/oily-root buildup on tolerant skin may point to gentle occasional scalp peeling;
- persistent itch, redness, burning, pain, repeated flakes, or shedding goes to safety boundary, not stronger peeling;
- shampoo application can focus on scalp/roots, but deep-cleansing shampoo is not conceptually scalp-only.

- [ ] **Step 3: Patch oil heat-protection guidance**

Guidance should say:

- assume finishing oil by default for broad oil use unless user says scalp/pre-wash/growth;
- plain oil is not a heat protectant without product-specific support;
- for heat styling, use a product with explicit heat-protectant claim before heat; oil can be used sparingly after styling or as pre-wash length protection when appropriate.

- [ ] **Step 4: Patch dry shampoo bridge wording**

Guidance should say:

- dry shampoo absorbs oil between washes;
- it does not replace cleansing;
- if the user needs it frequently, frame it as a bridge or sign to adjust wash rhythm/root routine, not as proof they should simply "wash normally" in a rude or circular way.

- [ ] **Step 5: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected: the relevant cases remain review/no-fail and manual inspection confirms the factual boundaries.

## Task 7: Improve Routine Context Reuse And Reduce Unnecessary Routine Tool Calls

**Files:**
- Modify: `data/agent-v2/guidance/base/routine-building.md/.json`
- Modify: `data/agent-v2/guidance/base/product-recommendation.md/.json`
- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts` only if needed
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-final-answer-validator.spec.ts`

- [ ] **Step 1: Add failing runtime tests**

Add a multi-turn stub case:

```text
Turn 1: Meine Haare sind trocken und frizzig. Was soll ich aendern?
Turn 2: Ja, zeig mir passende Produkte dafuer.
```

Expected turn 2 behavior:

- keeps `routine_context.active: true`;
- calls `select_products`;
- does not call `build_or_fix_routine` unless the latest user message asks to change the routine;
- includes a return path to the active routine.

Expected before implementation: FAIL if `build_or_fix_routine` is still called on the product-only follow-up.

- [ ] **Step 2: Tighten tool descriptions and terminal guidance**

Make the distinction explicit:

- first-turn build/change/simplify/lighten requests call `build_or_fix_routine`;
- short follow-up product asks inside an active routine reuse visible routine context and call `select_products` only;
- category comparisons inside an active routine may be `general_advice` with routine context active when no routine mutation is requested.

- [ ] **Step 3: Adjust validator only if it blocks the desired path**

If validation requires current-turn routine tool output for routine-context product recommendations, allow active routine `visible_steps` to ground the referenced step/category. Keep routine tool required for actual routine payloads and mutations.

- [ ] **Step 4: Verify latency-sensitive scenarios**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-final-answer-validator.spec.ts
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected:

- `previous-offer-reference` no longer uses `build_or_fix_routine` on the product follow-up;
- routine mutation cases still use `build_or_fix_routine`;
- placement-only cases do not use `build_or_fix_routine`;
- no validator failures.

## Task 8: Add Per-Step Latency And Tool Timing To Regression Traces

**Files:**
- Modify: `src/lib/agent-v2/runtime/trace.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/compare/run-agent-v2.ts`
- Modify: `scripts/agent-v2/run-guidance-regression.ts`
- Test: `tests/agent-v2-responses-runtime.spec.ts`
- Test: `tests/agent-v2-compare-runner.spec.ts`

- [ ] **Step 1: Add a failing trace-shape test**

Assert trace output includes model-step timing and executable tool timing, for example:

```ts
expect(trace.model_steps[0]).toHaveProperty("latency_ms")
expect(trace.tool_calls[0]).toHaveProperty("latency_ms")
```

Expected before implementation: FAIL because only total turn/case latency is currently available.

- [ ] **Step 2: Measure model response calls**

Wrap each `client.responses.create` call with `performance.now()` and record `latency_ms` on the corresponding trace model step.

- [ ] **Step 3: Measure executable tools**

Wrap `load_advisor_guidance`, `select_products`, and `build_or_fix_routine` execution in the runtime loop and record `latency_ms` in `trace.tool_calls`.

- [ ] **Step 4: Expose timing in reports**

Update the markdown/JSON report to show the slowest cases with tool timing. Keep the report compact enough to review manually.

- [ ] **Step 5: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-responses-runtime.spec.ts tests/agent-v2-compare-runner.spec.ts
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected: PASS, and the report includes enough detail to distinguish model latency from tool latency.

## Task 9: Category-Specific Copy And Fit Polish From Manual Review

**Files:**
- Modify: `data/agent-v2/guidance/categories/conditioner.md/.json`
- Modify: `data/agent-v2/guidance/categories/bondbuilder.md/.json`
- Modify: `data/agent-v2/guidance/categories/leave-in.md/.json`
- Modify: `data/agent-v2/guidance/categories/oil.md/.json`
- Modify: `data/agent-v2/guidance/base/general-advice.md/.json`
- Test: `tests/agent-v2-guidance-compiler.spec.ts`
- Test: `data/agent-v2/evals/guidance-migration-regression.json`

- [ ] **Step 1: Add eval criteria for the small copy failures**

Pin these review notes as quality criteria:

- CWC mention should briefly explain what CWC means and why it protects lengths.
- Bondbuilder types should not present `Booster / Service-Pflege` as a normal consumer-facing third type.
- Avoid odd German copy such as `starkes Schnappen`, `Air-Dry-Routine`, or `Actives stapeln`.
- Color-treated dry/frizzy routine should consider whether structural repair/bondbuilder is relevant without forcing it.
- Oil education should use user concerns/goals when distinguishing finish vs pre-wash.

- [ ] **Step 2: Patch CWC/OWC guidance**

When mentioning CWC, include a short explanation:

```text
CWC heisst Conditioner-Shampoo-Conditioner: etwas Conditioner schuetzt die Laengen vor dem Shampoo, danach pflegt Conditioner noch einmal gezielt.
```

Keep OWC as heavier and less default for fine/weight-sensitive hair.

- [ ] **Step 3: Patch bondbuilder type wording**

Use:

- true bondbuilder treatments vs look-alike repair marketing;
- rinse-out/pre-shampoo treatments vs leave-in structural care when product metadata supports it;
- booster/add-on products only as system-specific exceptions, not a standard third consumer type.

- [ ] **Step 4: Patch awkward German vocabulary**

Update guidance examples/rubrics to prefer:

- `starkes Brechen`, `bruechige Laengen`, or `gummiartig` depending on the context;
- `Routine beim Lufttrocknen` instead of `Air-Dry-Routine`;
- `nicht zu viele starke Kopfhaut-Wirkstoffe kombinieren` instead of `Actives stapeln`.

- [ ] **Step 5: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-guidance-compiler.spec.ts
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected: affected cases stay review/no-fail and manual inspection confirms the copy is natural.

## Task 10: Mild Scalp Cosmetic Product Recommendation Routing

**Files:**
- Modify: `scripts/agent-v2/run-guidance-regression.ts`
- Modify: `data/agent-v2/evals/guidance-migration-regression.json`
- Optional modify: `src/lib/recommendation-engine/categories/shampoo.ts`
- Optional modify: `src/lib/agent/tools/select-products.ts`
- Test: product selection or shampoo category tests

- [ ] **Step 1: Separate fixture issue from product logic**

First rerun the mild scalp case with a canonical mild cosmetic scalp profile. If products appear, treat the prior failure as eval setup only.

- [ ] **Step 2: Add request-context route only if still needed**

If the profile is valid but the prompt wording `leicht juckig, nicht rot` still cannot produce gentle cosmetic shampoo options, add conservative request-context handling so mild cosmetic scalp wording can route to gentle/irritation-aware shampoo without medical escalation.

- [ ] **Step 3: Verify**

Run:

```bash
npx tsx --test tests/agent-v2-final-answer-validator.spec.ts tests/agent-v2-manual-regression.spec.ts
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected: mild cosmetic scalp prompt can recommend grounded gentle shampoos when catalog data supports them, or gives a clear safety-compatible fallback when not.

## Task 11: Final Regression Review And Documentation

**Files:**
- Modify: `docs/agent-v2-guidance-migration/open-regression-failures.md`
- Optional create: `docs/agent-v2-guidance-migration/full-quality-repair-summary.md`
- Test: full deterministic suite and live guidance regression

- [ ] **Step 1: Run deterministic suite**

Run:

```bash
npx tsx --test \
  tests/agent-v2-contracts.spec.ts \
  tests/agent-v2-final-answer-validator.spec.ts \
  tests/agent-v2-responses-runtime.spec.ts \
  tests/agent-v2-guidance-compiler.spec.ts \
  tests/agent-v2-manual-regression.spec.ts \
  tests/agent-v2-compare-runner.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full live guidance regression**

Run:

```bash
npx tsx scripts/agent-v2/run-guidance-regression.ts
```

Expected:

- 46 total cases;
- 0 hard fails;
- no missing expected tools/guidance;
- timing report present;
- manual review queue is smaller and focused on genuine catalog gaps or taste decisions.

- [ ] **Step 3: Manually inspect the highest-risk cases**

Inspect:

- `previous-offer-reference`
- `routine-basics-build`
- `routine-then-mask-oil-choice`
- `bondbuilder-product-detail-protocol`
- `bondbuilder-types-no-hallucinated-product-forms`
- `dry-shampoo-product-detail`
- `deep-cleansing-product-detail`
- `deep-cleansing-vs-peeling-comparison`
- `oil-product-detail-heat-claim`
- `mild-scalp-cosmetic`

Expected: each case is either clearly improved or explicitly documented as a catalog/data backlog item.

- [ ] **Step 4: Update docs**

Update `open-regression-failures.md` with:

- what was fixed;
- what remains catalog enrichment/backlog;
- latest report path;
- deterministic test results;
- manual review notes.

- [ ] **Step 5: Required readiness check before shipping**

Because this touches recommendations, copy, and trust, run the repo `ready-check` skill before shipping or handing off for PR.

## Execution Notes

- Use `superpowers:subagent-driven-development` for implementation because tasks are separable: eval setup, tone guidance, metadata projection, category guidance, routine latency, observability, and final verification.
- Use TDD for runtime/projection/validator changes.
- Treat guidance-only copy changes as compiler-test-first where possible.
- Do not stage or revert unrelated dirty files already present in this worktree.
- Do not claim product capabilities that are missing from current catalog metadata; add backlog notes instead.
