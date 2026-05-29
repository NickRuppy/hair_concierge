# CareBalance Routine Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `hair-care-expert` or equivalent evidence review before changing domain rules, `category-specific-recommendation` or equivalent deterministic category work when implementing each category, and `superpowers:test-driven-development` during implementation. Use `superpowers:subagent-driven-development` for execution because the tasks are separable. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete replacement-grade routine product-category and frequency intelligence layer that can be tested in full beside the current planner before any old planner removal.

**Architecture:** Build `EffectiveCareContext` as the single care-context input: saved profile/routine plus explicit current-turn facts declared by Agent V2 through a tool. Build deterministic `careBalance` evaluators that emit one row per strong product category with one decisive action, canonical English reason codes, confidence, and category-specific cadence policy. During the first implementation pass, `careBalance` runs in full side-by-side mode: observable in runtime/debug/Compare Lab traces and consumable as non-authoritative framing, while the existing planner remains the production authority. Only after golden cases prove parity or improvement should a later promotion pass replace and remove overlapping old planner logic.

**Tech Stack:** Next.js, TypeScript, Node test runner via `tsx --test`, Supabase SQL migrations, existing recommendation-engine runtime, Agent V2 Responses runtime/tool loop, Compare Lab eval fixtures.

---

## Execution Base

Implement this plan from the Agent V2 worktree:

```text
/Users/nick/AI_work/hair_conscierge/.worktrees/gpt-54-responses-migration-plan
```

Reason: `careBalance` is intended to extend and ultimately power the Agent V2 model/tool/runtime path. The earlier influencer-feedback worktree contains committed copy/autosave fixes, but this recommendation/frequency intelligence should be built against the Agent V2 branch so `set_current_care_context`, tool traces, and Agent V2 evals can be implemented in the same architecture.

Before executing, classify the existing dirty Agent V2 changes and avoid mixing unrelated in-progress guidance/eval work into careBalance commits.

## Preflight Order

Before starting the `careBalance` implementation tasks, finish two independent prep slices as separate commits:

1. Deep-cleansing catalog/taxonomy slice:
   - real reviewed deep-cleansing products;
   - reset-focus taxonomy cleanup;
   - seed safety checks and migration;
   - selection/tool tests for user-facing reset labels.
2. Thermal rollers vocabulary slice:
   - add `thermal_rollers` as a canonical styling tool;
   - German label and onboarding heat-tool option;
   - validator coverage and database migration;
   - heat exposure tests that `careBalance` can consume later.

These prep slices should happen before the CareBalance promotion gate, but they are not themselves planner replacement work. Keep them in separate commits so product-data/migration issues can be reverted without touching the recommendation architecture.

## Settled Product Decisions

- This is a full replacement-grade candidate, not an advisory-only patch.
- The first implementation pass must not rip out the old planner. It should make `careBalance` testable in full form beside the old planner.
- Promotion to production authority is a separate gate after golden cases, manual Compare Lab review, and focused regression tests show the new layer is good enough.
- The layer owns product-category and frequency actions, not exact SKU selection.
- It evaluates all strong categories, including categories the user does not currently use.
- It emits one decisive category action per row. Nuance lives in `contextReasonCodes`.
- It does not veto product recommendations. If the user explicitly asks for a category, `select_products` can still recommend products, but `careBalance` changes framing, caveats, usage guidance, and soft ranking preferences.
- Structured outputs stay canonical English. German rendering happens in the agent final answer layer.
- Current-turn facts are declared by Agent V2 via `set_current_care_context`, not extracted by a separate pre-agent backend model.
- Current-turn facts are turn-local unless a separate profile-learning flow persists them.
- Debug/eval traces must expose `careBalance` rows as first-class output.

## Scope Boundaries

In scope:

- Strong routine categories: `shampoo`, `conditioner`, `leave_in`, `mask`, `oil`, `heat_protectant`, `bondbuilder`, `deep_cleansing_shampoo`, `dry_shampoo`, `peeling`.
- Category presence, absence, frequency, and category-level action.
- Saved profile/routine and explicit current-turn overrides.
- Soft product-ranking hints where existing metadata supports them.
- Heat exposure refinement, including `thermal_rollers`.
- Deep-cleansing frequency and vulnerability rules.

Out of scope:

- Ingredient-level fit, INCI concentration inference, exact formulation reasoning, and SKU-level ingredient scoring.
- Persisting current-turn corrections to the profile automatically.
- Medical scalp treatment logic beyond conservative cosmetic guidance and escalation caveats.
- Replacing the product ranking engine wholesale.

## Evidence Stance To Preserve

- Blow dryer/diffuser-only routines are not equivalent to direct-contact hot tools. They can still damage hair with high heat, close distance, or repeated exposure, but should not automatically trigger a hard standalone heat-protectant add step.
- Direct-contact hot tools are high heat exposure.
- Warmluftbuerste / hot-air multi-styler used solo is moderate by default and escalates with high frequency, damage, chemical treatment, or cumulative heat combinations.
- Ceramic/metal thermal rollers are heat-retaining accessories. Solo use is moderate; combined with Warmluftbuerste, multi-tool, or direct hot tools is high cumulative exposure.
- Stronger clarifying/deep-cleansing shampoo is occasional. `3_4x`, `5_6x`, and `daily` are overuse/caution for everyone. `1_2x` is caution-worthy for dry scalp, dry lengths, damage, color/bleach, curly/coily, or rough cuticle.
- Conditioner usually follows wash cadence.
- Dry shampoo bridges washes but does not clean the scalp.
- Peeling/exfoliation should be conservative and scalp-condition-sensitive.

## Target File Map

| Path                                                              | Responsibility                                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/recommendation-engine/contracts.ts`                      | Add care-balance enums/schemas and `thermal_rollers`-adjacent contract support where needed.                                                                                             |
| `src/lib/recommendation-engine/types.ts`                          | Add `EffectiveCareContext`, current-turn fact types, care-balance row types, cadence-policy unions, and selection-hint types.                                                            |
| `src/lib/recommendation-engine/effective-care-context.ts`         | Build saved effective context and apply Agent V2 current-turn facts with provenance/conflicts.                                                                                           |
| `src/lib/recommendation-engine/care-balance/shared.ts`            | Shared frequency, vulnerability, heat exposure, wash-cadence, and reason-code helpers.                                                                                                   |
| `src/lib/recommendation-engine/care-balance/index.ts`             | Build the full `CareBalanceSet` in stable category order.                                                                                                                                |
| `src/lib/recommendation-engine/care-balance/*.ts`                 | One deterministic evaluator per strong category.                                                                                                                                         |
| `src/lib/recommendation-engine/planner/intervention.ts`           | Keep the old planner authoritative in the first pass; add comparison/projection helpers only when needed for side-by-side evaluation.                                                    |
| `src/lib/recommendation-engine/runtime.ts`                        | Build `EffectiveCareContext`, `careBalance`, side-by-side comparison output, and the existing final intervention plan.                                                                   |
| `src/lib/recommendation-engine/selection.ts`                      | Apply care-balance soft ranking hints where metadata is reliable.                                                                                                                        |
| `src/lib/agent/tools/select-products.ts`                          | Pass effective context/careBalance into runtime and expose row-specific caveats in tool output.                                                                                          |
| `src/lib/agent/tools/build-or-fix-routine.ts`                     | Surface care-balance rows as category/frequency framing in side-by-side mode; keep existing routine mutation behavior authoritative until promotion.                                     |
| Agent V2: `src/lib/agent-v2/runtime/responses-agent.ts`           | Add turn-local current care fact state and pass effective context to tools. If Agent V2 is not merged into this branch yet, implement this task in the Agent V2 worktree before merging. |
| Agent V2: `src/lib/agent-v2/tools/tool-definitions.ts`            | Add `set_current_care_context` tool schema.                                                                                                                                              |
| Agent V2: `src/lib/agent-v2/validation/final-answer-validator.ts` | Validate tool evidence quotes and prevent fabricated current-turn facts.                                                                                                                 |
| Agent V2 prompt/guidance files                                    | Teach the agent when to call `set_current_care_context` and how to render careBalance in German.                                                                                         |
| `src/lib/vocabulary/profile-labels.ts`                            | Add `thermal_rollers` if not already present in the target branch.                                                                                                                       |
| `src/components/onboarding/screens/heat-tools-screen.tsx`         | Add Thermo-Lockenwickler option if not already present in the target branch.                                                                                                             |
| `supabase/migrations/*_add_thermal_rollers_styling_tool.sql`      | Normalize known aliases and add/check styling-tool vocabulary constraint.                                                                                                                |
| `tests/recommendation-engine-care-balance.test.ts`                | Golden row tests for all strong categories.                                                                                                                                              |
| `tests/recommendation-engine-care-balance-comparison.test.ts`     | Old planner vs careBalance comparison tests before promotion.                                                                                                                            |
| `tests/recommendation-engine-selection.test.ts`                   | Soft ranking-hint regressions.                                                                                                                                                           |
| `tests/agent-v2-current-care-context.spec.ts`                     | Agent V2 current-turn fact tool and effective-context tests.                                                                                                                             |
| `tests/agent-select-products-tool.spec.ts`                        | Product-answer caveat/framing tests.                                                                                                                                                     |
| `tests/agent-routine-tool.spec.ts`                                | Routine action tests using careBalance rows.                                                                                                                                             |
| `tests/agent-compare-runner.spec.ts` and Compare Lab fixtures     | Golden conversation eval coverage.                                                                                                                                                       |

## Core Types

Implement the core enums as a separate care-balance vocabulary instead of reusing old planner action enums:

```ts
export const CARE_BALANCE_RECOMMENDATIONS = [
  "add",
  "increase_frequency",
  "keep",
  "decrease_frequency",
  "remove",
  "no_action",
  "needs_more_info",
] as const

export const CARE_BALANCE_STATUSES = [
  "missing_needed",
  "underused",
  "matched",
  "overused",
  "unnecessary",
  "not_relevant",
  "needs_more_info",
  "safety_caution",
] as const

export const CARE_BALANCE_STRENGTHS = ["low", "medium", "high"] as const
```

Each row follows this shape:

```ts
export interface CareBalanceRow<
  TPolicy extends CareBalanceCadencePolicy = CareBalanceCadencePolicy,
> {
  category: InventoryCategory
  present: boolean
  currentFrequency: ProductFrequency | null
  primaryStatus: CareBalanceStatus
  recommendation: CareBalanceRecommendation
  recommendationStrength: CareBalanceStrength
  confidence: ConfidenceLevel
  decisiveReasonCodes: CareBalanceReasonCode[]
  contextReasonCodes: CareBalanceReasonCode[]
  cadencePolicy: TPolicy
  selectionHints: CareBalanceSelectionHint[]
}
```

Use category-specific cadence policies:

```ts
export type CareBalanceCadencePolicy =
  | {
      kind: "match_wash_frequency"
      washFrequency: WashFrequency | null
      expected: "after_every_wash" | "most_washes"
    }
  | {
      kind: "match_heat_exposure"
      heatExposureTier: HeatExposureTier
      relevantTools: StylingTool[]
      expected: "with_meaningful_heat" | "optional_for_airflow_only"
    }
  | {
      kind: "occasional_reset"
      resetNeed: ResetLevel
      cautionAtOrAbove: ProductFrequency
      vulnerableCautionAtOrAbove: ProductFrequency | null
    }
  | {
      kind: "bridge_between_washes"
      washFrequency: WashFrequency | null
      expected: "short_bridge_only"
    }
  | {
      kind: "need_based_support"
      supportNeed: DamageLevel
      loadSensitive: boolean
      suggestedBand: ProductFrequency | null
    }
  | {
      kind: "protocol_based"
      priority: BondBuilderPriority
      suggestedBand: ProductFrequency | null
    }
  | { kind: "baseline_cleansing"; washFrequency: WashFrequency | null }
  | { kind: "not_applicable" }
```

## Category Rule Matrix

| Category                 | Missing useful category                                                                                           | Underuse                                                                                  | Matched                                                           | Overuse/unnecessary                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shampoo`                | Add when absent.                                                                                                  | Usually no increase action unless wash cadence/routine conflict leaves cleansing unclear. | Present and cadence plausible.                                    | Decrease/caution for daily or very frequent washing with dry scalp, dry lengths, curly/coily, color/bleach, rough cuticle, or damage.                                      |
| `conditioner`            | Add for most users who wash hair, especially dry/tangled/frizzy/damaged/long/curly.                               | Increase when frequency is below wash cadence and length-care signals exist.              | Frequency roughly matches wash cadence.                           | Decrease only when frequent use aligns with flat/greasy/load signals and little length-care need; otherwise prefer usage caveat rather than category removal.              |
| `leave_in`               | Add for dryness, frizz, tangling, curl definition, damage, or heat-styling support.                               | Increase when used rarely but active support need is moderate/high.                       | Plausible use for need without buildup pressure.                  | Decrease when frequent use coincides with buildup, flatness, greasy roots, low-density/fine hair pressure, or reset need.                                                  |
| `mask`                   | Add for high dryness/damage/repair need.                                                                          | Increase when used rarely and damage/dryness need is high.                                | `1_2x` can count as coverage for most need states.                | Decrease at `3_4x+` when need is not severe, or when buildup/flatness/greasy pressure is present.                                                                          |
| `oil`                    | Add for dry/coarse/curly lengths, shine/finish, friction reduction, or pre-wash protection when load risk is low. | Increase only when current frequency is rare and support need is clear.                   | Light/as-needed use with dry-length benefit and no load pressure. | Decrease for daily/`5_6x`, or `3_4x+` with buildup, flatness, oily scalp, low density/fine hair, or reset pressure.                                                        |
| `heat_protectant`        | Add when high/cumulative heat exposure exists and protection is absent.                                           | Increase when present but frequency does not plausibly match meaningful heat exposure.    | Matches high/direct/cumulative heat exposure.                     | No action for airflow-only blow dryer/diffuser unless damage/frequency makes a caveat useful; remove only when category is clearly irrelevant and present creates clutter. |
| `bondbuilder`            | Add when bond-builder priority is `recommend`; consider when `consider`.                                          | Increase when priority is `recommend` and frequency is sparse versus protocol.            | Protocol/frequency plausible for damage state.                    | Decrease/remove when priority is `none` and current use adds unnecessary routine complexity.                                                                               |
| `deep_cleansing_shampoo` | Add when reset need is likely/strong and absent.                                                                  | Increase only from rarely/absent to occasional when buildup pressure exists.              | Occasional use with buildup/reset need.                           | Decrease at `3_4x+` for everyone; decrease/caution at `1_2x` for dry/damaged/color/bleach/curly/coily/rough-cuticle profiles.                                              |
| `dry_shampoo`            | Add only for between-wash bridge with oily/flat roots and no buildup/irritation hard stop.                        | Increase rarely, only as short bridge when wash cadence and scalp context support it.     | Occasional bridge use.                                            | Decrease for frequent use, scalp irritation/dryness, buildup/reset pressure, or when used as a wash replacement.                                                           |
| `peeling`                | Add only for scalp/buildup need where scalp is not dry/irritated.                                                 | Increase from rare only with oily scalp/buildup/flake context and low irritation risk.    | Conservative occasional use.                                      | Decrease/remove for dry/irritated scalp or `3_4x+`; caution even at lower frequency if irritation is active.                                                               |

## Success Standard

The new setup is better than the old setup when golden tests show it:

- detects missing useful categories;
- detects overuse and unnecessary categories;
- handles frequencies/cadence correctly;
- considers categories the user does not currently use;
- preserves old planner wins for damage, bondbuilder, reset/buildup, and dry-shampoo cautions;
- handles explicit current-turn facts;
- produces reason codes that let Agent V2 answer with more grounded category logic;
- gives product recommendations with smarter caveats and soft ranking hints when the user asks for a product in a risky category.

---

## Task 1: Add CareBalance Contracts And Effective Context

**Files:**

- Modify: `src/lib/recommendation-engine/contracts.ts`
- Modify: `src/lib/recommendation-engine/types.ts`
- Create: `src/lib/recommendation-engine/effective-care-context.ts`
- Test: `tests/recommendation-engine-care-balance.test.ts`

- [ ] **Step 1: Add failing type/constructor tests**

Add tests that assert a saved profile/routine becomes an `EffectiveCareContext`, that current-turn routine facts override only the turn, and that conflicts keep provenance.

```ts
test("effective care context applies explicit current-turn routine frequency", () => {
  const saved = buildRuntimeFixture({
    routine: [{ category: "oil", product_name: "Oil", frequency_range: "rarely" }],
  })

  const context = buildEffectiveCareContext(saved.rawInput, [
    {
      kind: "routine_frequency",
      category: "oil",
      frequency: "daily",
      evidenceQuote: "Ich benutze Oel aktuell taeglich",
    },
  ])

  assert.equal(context.normalized.routineInventory.oil?.frequencyBand, "daily")
  assert.equal(context.currentTurnFacts.length, 1)
  assert.equal(context.conflicts[0]?.fieldPath, "routine.oil.frequency")
})
```

- [ ] **Step 2: Implement care-balance contracts**

Add care-balance constants/schemas to `contracts.ts` and exported types to `types.ts`. Keep old `RECOMMENDATION_ACTIONS` unchanged until `careBalance` is promoted in a later pass.

- [ ] **Step 3: Implement `buildEffectiveCareContext`**

Create `effective-care-context.ts` with:

```ts
export function buildEffectiveCareContext(
  rawInput: RawRecommendationInput,
  currentTurnFacts: CurrentCareFact[] = [],
): EffectiveCareContext
```

Rules:

- start from `normalizeRecommendationInput(rawInput)`;
- profile overrides replace the normalized field for this turn;
- array profile augments de-dupe canonical values;
- routine presence `false` clears the category item for this turn;
- routine presence `true` creates a present item with null product/frequency if absent;
- routine frequency updates the category item and creates it if needed;
- each changed field records source provenance and saved-vs-current conflict when values differ.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance.test.ts
```

Expected: effective-context tests pass.

Commit:

```bash
git add src/lib/recommendation-engine/contracts.ts src/lib/recommendation-engine/types.ts src/lib/recommendation-engine/effective-care-context.ts tests/recommendation-engine-care-balance.test.ts
git commit -m "feat(recommendations): add effective care context"
```

## Task 2: Add Shared CareBalance Helpers

**Files:**

- Create: `src/lib/recommendation-engine/care-balance/shared.ts`
- Test: `tests/recommendation-engine-care-balance.test.ts`

- [ ] **Step 1: Write helper tests for frequency and heat tiers**

Add tests for:

- `compareFrequencyBands("1_2x", "3_4x") < 0`;
- vulnerable deep-cleansing profiles caution at `1_2x`;
- `blow_dryer` only is `airflow`;
- `hot_air_brush` only is `moderate`;
- `thermal_rollers` only is `moderate`;
- `hot_air_brush + thermal_rollers` is `high_cumulative`;
- any direct hot tool is `high_direct`.

- [ ] **Step 2: Implement shared helpers**

Create helpers:

```ts
export type HeatExposureTier = "none" | "airflow" | "moderate" | "high_direct" | "high_cumulative"

export function classifyHeatExposure(profile: NormalizedProfile): {
  tier: HeatExposureTier
  relevantTools: StylingTool[]
  reasonCodes: CareBalanceReasonCode[]
}

export function hasDeepCleansingVulnerability(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): boolean

export function compareFrequencyBands(
  left: ProductFrequency | null,
  right: ProductFrequency | null,
): -1 | 0 | 1 | null
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance.test.ts
```

Commit:

```bash
git add src/lib/recommendation-engine/care-balance/shared.ts tests/recommendation-engine-care-balance.test.ts
git commit -m "feat(recommendations): add care balance helpers"
```

## Task 3: Add Thermal Rollers As A Canonical Heat Tool

**Files:**

- Modify: `src/lib/vocabulary/profile-labels.ts`
- Modify: `src/components/onboarding/screens/heat-tools-screen.tsx`
- Modify: `src/components/ui/icon.tsx`
- Create: `supabase/migrations/20260522xxxxxx_add_thermal_rollers_styling_tool.sql`
- Test: `tests/hair-profile-validators.test.ts`
- Test: `tests/profile-page-smoke.spec.ts`

- [ ] **Step 1: Add failing validator/UI tests**

Assert `styling_tools: ["thermal_rollers"]` validates, renders as `Thermo-Lockenwickler`, and appears on the heat-tools screen.

- [ ] **Step 2: Add vocabulary and UI option**

Add:

```ts
thermal_rollers: "Thermo-Lockenwickler"
```

Use German option copy:

```ts
"Keramik- oder Metallwickler, die mit Foehnwaerme aufgeheizt werden."
```

- [ ] **Step 3: Add DB migration**

Normalize known aliases and add the check constraint as `NOT VALID` first. Validate only after a production audit query is clean.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/hair-profile-validators.test.ts
npx playwright test tests/profile-page-smoke.spec.ts --project=chromium
```

Commit:

```bash
git add src/lib/vocabulary/profile-labels.ts src/components/onboarding/screens/heat-tools-screen.tsx src/components/ui/icon.tsx supabase/migrations tests/hair-profile-validators.test.ts tests/profile-page-smoke.spec.ts
git commit -m "feat(onboarding): add thermal rollers heat tool"
```

## Task 4: Implement Category Evaluators

**Files:**

- Create: `src/lib/recommendation-engine/care-balance/index.ts`
- Create: `src/lib/recommendation-engine/care-balance/shampoo.ts`
- Create: `src/lib/recommendation-engine/care-balance/conditioner.ts`
- Create: `src/lib/recommendation-engine/care-balance/leave-in.ts`
- Create: `src/lib/recommendation-engine/care-balance/mask.ts`
- Create: `src/lib/recommendation-engine/care-balance/oil.ts`
- Create: `src/lib/recommendation-engine/care-balance/heat-protectant.ts`
- Create: `src/lib/recommendation-engine/care-balance/bondbuilder.ts`
- Create: `src/lib/recommendation-engine/care-balance/deep-cleansing-shampoo.ts`
- Create: `src/lib/recommendation-engine/care-balance/dry-shampoo.ts`
- Create: `src/lib/recommendation-engine/care-balance/peeling.ts`
- Test: `tests/recommendation-engine-care-balance.test.ts`

- [ ] **Step 1: Add golden row tests for every category**

Use one test per decisive behavior:

- conditioner missing with dry/tangled lengths -> `add`;
- conditioner rare vs `3_4x` wash cadence -> `increase_frequency`;
- oil daily with buildup/flatness -> `decrease_frequency`;
- leave-in absent with frizz/tangling -> `add`;
- mask `3_4x` with buildup pressure -> `decrease_frequency`;
- heat protectant absent with flat iron -> `add`;
- heat protectant absent with blow dryer only -> `no_action`;
- heat protectant rare with hot-air brush plus thermal rollers -> `increase_frequency`;
- bondbuilder absent with high bond priority -> `add`;
- deep cleansing `3_4x` -> `decrease_frequency`;
- deep cleansing `1_2x` plus dry/damaged/color/curly vulnerability -> `decrease_frequency`;
- dry shampoo daily with reset pressure -> `decrease_frequency`;
- peeling present with irritated scalp -> `decrease_frequency`;
- shampoo absent -> `add`.

- [ ] **Step 2: Implement evaluators one by one**

Each evaluator must:

- return exactly one row;
- use category-local reason-code constants;
- put action-winning reasons in `decisiveReasonCodes`;
- put non-winning nuance in `contextReasonCodes`;
- never emit product IDs or product-specific claims;
- add `selectionHints` only when the hint can be consumed by existing metadata.

- [ ] **Step 3: Implement `buildCareBalanceSet`**

Return stable category order:

```ts
const CARE_BALANCE_CATEGORY_ORDER = [
  "shampoo",
  "conditioner",
  "leave_in",
  "mask",
  "oil",
  "heat_protectant",
  "bondbuilder",
  "deep_cleansing_shampoo",
  "dry_shampoo",
  "peeling",
] as const
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance.test.ts
```

Commit:

```bash
git add src/lib/recommendation-engine/care-balance tests/recommendation-engine-care-balance.test.ts
git commit -m "feat(recommendations): evaluate routine care balance"
```

## Task 5: Integrate CareBalance Into Runtime In Side-By-Side Mode

**Files:**

- Modify: `src/lib/recommendation-engine/runtime.ts`
- Modify: `src/lib/recommendation-engine/planner/intervention.ts`
- Modify: `src/lib/rag/debug-trace.ts`
- Test: `tests/recommendation-engine-care-balance-comparison.test.ts`
- Test: `tests/recommendation-engine-planner.test.ts`

- [ ] **Step 1: Add side-by-side comparison tests**

For old planner wins, assert careBalance matches or improves:

- missing conditioner remains detected;
- bondbuilder high-priority remains detected;
- dry shampoo overuse remains detected;
- peeling overuse remains detected;
- deep cleansing frequency vulnerability is better than old planner;
- blow-dryer-only heat protection is better than old planner.

- [ ] **Step 2: Add `careBalance` to runtime**

`RecommendationEngineRuntime` should include:

```ts
effectiveContext: EffectiveCareContext
careBalance: CareBalanceSet
legacyPlanComparison?: CareBalanceLegacyComparison
```

- [ ] **Step 3: Add a non-authoritative intervention projection from careBalance**

Add a small adapter for comparison/debug output only:

```ts
export function projectInterventionPlanFromCareBalance(balance: CareBalanceSet): InterventionPlan
```

Mapping:

- `add`, `increase_frequency`, `keep`, `decrease_frequency`, `remove` become plan steps;
- `no_action`, `needs_more_info` do not become active plan steps;
- `behavior_change_only` remains available only for behavior rows outside category balance.

- [ ] **Step 4: Keep the old planner authoritative during transition**

The runtime may include both the legacy plan and the care-balance projection in debug output, but production behavior must continue to use the existing `plan` field until a later promotion pass. The side-by-side runtime shape should read:

```text
raw input -> EffectiveCareContext -> assessments -> careBalance + legacy planner -> comparison/debug/tool framing
```

Do not delete or shrink the old planner in this task.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance-comparison.test.ts tests/recommendation-engine-planner.test.ts
```

Commit:

```bash
git add src/lib/recommendation-engine/runtime.ts src/lib/recommendation-engine/planner/intervention.ts src/lib/rag/debug-trace.ts tests/recommendation-engine-care-balance-comparison.test.ts tests/recommendation-engine-planner.test.ts
git commit -m "feat(recommendations): run care balance beside planner"
```

## Task 6: Feed CareBalance Into Product Selection And Routine Tools

**Files:**

- Modify: `src/lib/recommendation-engine/selection.ts`
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `src/lib/agent/tools/build-or-fix-routine.ts`
- Test: `tests/recommendation-engine-selection.test.ts`
- Test: `tests/agent-select-products-tool.spec.ts`
- Test: `tests/agent-routine-tool.spec.ts`

- [ ] **Step 1: Add product-answer tests for risky requested categories**

Example oil case:

```ts
test("select_products still recommends oil when requested but carries decrease-frequency framing", async () => {
  const result = await runSelectProductsFixture({
    requestedCategory: "oil",
    routine: [{ category: "oil", product_name: "Oil", frequency_range: "daily" }],
    profile: { concerns: ["flat_roots"], scalp_type: "oily" },
  })

  assert.equal(result.runtime.careBalance.rows.oil.recommendation, "decrease_frequency")
  assert.match(JSON.stringify(result.answerContext), /decrease_frequency/)
})
```

- [ ] **Step 2: Add soft ranking hints**

Consume only reliable hints:

- oil overuse/load -> boost lighter/non-heavy oil fits if metadata exists;
- heat protectant high/cumulative exposure -> boost stronger heat-protection products if metadata exists;
- conditioner flat/greasy load -> boost lighter conditioner fits if metadata exists;
- deep cleansing vulnerability -> boost gentle/color-safe reset products if metadata exists.

Do not hard-filter unless existing product metadata already encodes the constraint as a hard suitability flag.

- [ ] **Step 3: Update routine tool side-by-side output**

`build_or_fix_routine` should expose careBalance rows as category/frequency framing, caveats, and comparison data, while keeping existing routine mutation behavior authoritative until the promotion pass. The German final wording still belongs to the agent; the tool returns canonical actions, reason codes, and compact usage hints.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts
```

Commit:

```bash
git add src/lib/recommendation-engine/selection.ts src/lib/agent/tools/select-products.ts src/lib/agent/tools/build-or-fix-routine.ts tests/recommendation-engine-selection.test.ts tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts
git commit -m "feat(recommendations): use care balance in product and routine tools"
```

## Task 7: Add Agent V2 Current-Turn Fact Tool

**Files:**

- Modify: `src/lib/agent-v2/tools/tool-definitions.ts`
- Modify: `src/lib/agent-v2/runtime/responses-agent.ts`
- Modify: `src/lib/agent-v2/validation/final-answer-validator.ts`
- Modify: Agent V2 prompt/guidance files in `src/lib/agent-v2/**`
- Test: `tests/agent-v2-current-care-context.spec.ts`

If Agent V2 files are still in `.worktrees/gpt-54-responses-migration-plan`, execute this task there and port the recommendation-engine pieces after the Agent V2 branch merges.

- [ ] **Step 1: Add tool schema tests**

Test that `set_current_care_context` accepts:

- explicit profile override: "Actually my hair is fine";
- routine frequency: "I use dry shampoo daily";
- routine absence: "I do not use conditioner";
- heat tool/frequency: "I use a flat iron twice a week";
- rejects evidence quotes that do not appear in the latest user message.

- [ ] **Step 2: Add `set_current_care_context` tool**

The tool input should be a discriminated union:

```ts
type CurrentCareFactInput =
  | { kind: "profile_override"; field: ProfileFactField; value: unknown; evidenceQuote: string }
  | { kind: "profile_augment"; field: ProfileArrayFactField; value: string; evidenceQuote: string }
  | {
      kind: "routine_presence"
      category: InventoryCategory
      present: boolean
      evidenceQuote: string
    }
  | {
      kind: "routine_frequency"
      category: InventoryCategory
      frequency: ProductFrequency
      evidenceQuote: string
    }
  | { kind: "context_signal"; code: string; evidenceQuote: string }
```

- [ ] **Step 3: Mutate turn-local effective context**

When the tool runs:

- validate evidence quote against the latest user message;
- store facts in turn state;
- rebuild `EffectiveCareContext`;
- pass the same effective context to `careBalance`, `select_products`, and `build_or_fix_routine`;
- do not persist anything to the database.

- [ ] **Step 4: Update Agent V2 instructions**

Teach the model:

- call `set_current_care_context` before care/product/routine tools when the user explicitly corrects or adds profile/routine facts;
- do not override durable profile facts from symptoms like "my hair gets flat fast";
- use context signals for symptoms/cautions;
- final answer should acknowledge meaningful conflict naturally in German.

- [ ] **Step 5: Run Agent V2 tests**

Run:

```bash
npx tsx --test tests/agent-v2-current-care-context.spec.ts
```

Commit:

```bash
git add src/lib/agent-v2 tests/agent-v2-current-care-context.spec.ts
git commit -m "feat(agent-v2): add turn-local care context facts"
```

## Task 8: Add Golden Evals And Debug Trace Surfaces

**Files:**

- Modify: `src/lib/agent/compare/scenarios.ts`
- Modify: `src/lib/agent/compare/types.ts`
- Modify: `src/lib/agent/compare/run-agentic-tool-loop.ts`
- Modify: `src/components/labs/agent-compare-lab.tsx`
- Test: `tests/agent-compare-runner.spec.ts`
- Test: `tests/agent-compare-product-trace.spec.ts`

- [ ] **Step 1: Add golden scenarios**

Add scenarios for:

- daily oil with flat/buildup asking for oil product;
- missing conditioner with dry/tangled lengths;
- rare conditioner and `3_4x` shampoo cadence;
- blow dryer only asking about heat protection;
- flat iron twice weekly with no heat protectant;
- hot-air brush plus thermal rollers;
- deep cleansing `1_2x` plus dry/damaged/color/curly vulnerability;
- daily dry shampoo as wash replacement;
- peeling with irritated scalp;
- current-turn correction overriding saved routine.

- [ ] **Step 2: Expose careBalance in traces**

Trace must include:

- full rows by category;
- effective-context facts and conflicts;
- old-vs-new comparison while the old planner still exists;
- selection hints consumed by product ranking.

- [ ] **Step 3: Run compare tests**

Run:

```bash
npx tsx --test tests/agent-compare-runner.spec.ts tests/agent-compare-product-trace.spec.ts
```

Commit:

```bash
git add src/lib/agent/compare src/components/labs/agent-compare-lab.tsx tests/agent-compare-runner.spec.ts tests/agent-compare-product-trace.spec.ts
git commit -m "test(agent): add care balance golden eval traces"
```

## Task 9: Final Verification And Promotion Gate

**Files:**

- All files touched above

- [ ] **Step 1: Run full focused verification**

Run:

```bash
npx tsx --test tests/recommendation-engine-care-balance.test.ts tests/recommendation-engine-care-balance-comparison.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-planner.test.ts tests/recommendation-engine-selection.test.ts
npx tsx --test tests/agent-select-products-tool.spec.ts tests/agent-routine-tool.spec.ts tests/agent-compare-runner.spec.ts tests/agent-compare-product-trace.spec.ts
npm run typecheck
npm run lint
```

- [ ] **Step 2: Manual review in Compare Lab**

Run the golden scenarios and inspect:

- one row exists for every strong category;
- the decisive action is obvious from reason codes;
- product requests still produce products when asked;
- risky categories are framed with frequency/caution guidance;
- current-turn overrides are visible and not persisted;
- German answer text is natural and not code-shaped.

- [ ] **Step 3: Decide whether the new layer is ready for promotion**

After golden cases pass, record whether `careBalance` is ready to become the production authority. Do not delete or shrink old category-specific intervention logic in this implementation pass. If the new layer is good enough, write a follow-up promotion/removal plan that replaces old planner reads with `careBalance` and then deletes overlapping logic.

- [ ] **Step 4: Ready check**

Because this touches recommendation logic, trust, onboarding vocabulary, and agent behavior, run `ready-check` before handoff.

- [ ] **Step 5: Commit final cleanup**

Commit:

```bash
git add src tests plans
git commit -m "test(recommendations): verify care balance promotion gate"
```

## Deployment Notes

- Run the earlier onboarding-copy migration after merge/deploy; it is already committed in the previous influencer-feedback work.
- For `thermal_rollers`, run the production audit query for unknown `styling_tools` values before validating the DB check constraint.
- Do not persist Agent V2 current-turn facts until a separate profile-learning flow is designed and approved.
- Ingredient-level reasoning remains backlog and should be planned separately after category/frequency intelligence is stable.
