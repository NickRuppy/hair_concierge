# Profile Signal Architecture Spec

## Status

Target-state spec for replacing three problematic profile signals:

- `mechanical_stress_factors`
- `post_wash_actions`
- `answered_fields`

This version is aligned to the current product concept as a **three-stage wash-day pipeline**:

1. immediate drying after washing
2. how the hair gets fully dry
3. optional heated styling after the hair is mostly dry

The goal is a clean long-term model, not a compatibility layer around legacy profile fields.

## Decision Summary

1. Remove persisted `mechanical_stress_factors`.
2. Remove persisted `post_wash_actions`.
3. Remove persisted `answered_fields`.
4. Keep `DamageAssessment.mechanicalLevel` as the canonical shared mechanical severity signal.
5. Keep wash-day behavior modeled as three stages, not as one mixed compatibility field.
6. Do **not** add `after_wash_styling_mode`.
7. Keep the stage-3 styling model as:
   - `styling_tools`
   - `heat_styling`
   - `uses_heat_protection`
8. Replace `answered_fields` with native null semantics:
   - `null` = unknown / not yet answered
   - `[]` = explicitly none
   - non-empty array = explicit positive answer

## Why This Change Exists

The current model has three architectural problems:

1. It persists derived compatibility fields that can drift from their source answers.
2. It mixes three different concepts inside `post_wash_actions`:
   - drying route
   - heated exposure
   - styling context
3. It collapses `unknown` and `explicit none` into the same stored value, then recreates the distinction through `answered_fields`.

The result is duplicated logic, stale state risk, and an engine boundary that no longer reflects the real source-of-truth answers.

## Design Principles

- Persist only atomic user answers or truly irreducible choices.
- Keep the wash-day model aligned to how the product already thinks about the flow.
- Derive shared recommendation signals inside the engine, not in persisted profile mirrors.
- Keep the engine contract honest: no compatibility fields that the shared layers no longer need.
- Encode `unknown` versus `explicit none` at the field level.
- Keep user-facing questions in German.

## Product Model: Three-Stage Wash-Day Pipeline

### Stage 1: Immediate Drying

Question family:

- What touches the hair right after washing?

Persisted fields:

- `towel_material`
- `towel_technique`

Interpretation:

- This is the immediate post-shower handling stage.
- It is mainly about friction and breakage risk.
- It belongs in mechanical damage assessment and behavior guidance.

### Stage 2: Drying Route

Question family:

- How does the hair become dry?

Persisted field:

- `drying_method`

Recommended target shape:

```ts
type DryingMethod = "air_dry" | "blow_dry" | "blow_dry_diffuser"
```

Important recommendation:

- `drying_method` should become a **single dominant value**, not a multi-select array.

Why:

- the product concept is singular: what is the main route to get the hair dry?
- the current multi-select UI allows contradictory answers like air-dry plus blow-dry as equal primary states
- a dominant route is easier for recommendation fit, explanation, and QA

German question:

`Wie trocknest du dein Haar meistens?`

Options:

- `Lufttrocknen`
- `Föhnen`
- `Föhnen mit Diffusor`

### Stage 3: Optional Heated Styling

Question family:

- Once the hair is mostly dry, do you use heated tools to style it?

Persisted fields:

- `styling_tools`
- `heat_styling`
- `uses_heat_protection`

Interpretation:

- This is optional.
- This is not the same thing as drying.
- This is the stage that captures thermal styling behavior.

Important clarification:

- `styling_tools` in practice is already a heat-tool list.
- The current field name is slightly broader than the actual values, but the conceptual role is already stage-3 heat styling.

## What Changes in the Data Model

### Remove

- `mechanical_stress_factors`
- `post_wash_actions`
- `answered_fields`

### Keep

- `towel_material`
- `towel_technique`
- `drying_method`
- `styling_tools`
- `heat_styling`
- `uses_heat_protection`
- `brush_type`
- `night_protection`
- `current_routine_products`

### Reshape

#### `drying_method`

Current shape:

```ts
DryingMethod[]
```

Target shape:

```ts
DryingMethod | null
```

Reason:

- This field should model the dominant stage-2 drying route, not every behavior the user has ever done.

### Explicitly Drop

Drop the `non_heat_styling` concept from persisted profile state.

Reason:

- it is not currently asked in onboarding
- it is not part of the three-stage product concept you described
- it only exists today as a partial enum artifact inside `post_wash_actions`

If non-heat styling later becomes important enough to persist, it should be added as a dedicated product question, not smuggled inside a derived compatibility field.

## Canonical Meaning After This Change

### Mechanical Stress

Shared engine meaning:

- `DamageAssessment.mechanicalLevel` is the canonical severity signal.

Behavior guidance meaning:

- behavior-specific advice reads atomic inputs directly:
  - `towel_technique`
  - `brush_type`
  - `night_protection`

No replacement persisted mechanical aggregate is introduced.

Why:

- severity belongs in the shared assessment layer
- behavior-specific intervention belongs in the behavior layer
- a persisted mirror duplicates both and drifts

### Wash-Day Context

Replace direct reads of `post_wash_actions` with explicit stage-aware derivation from:

- `drying_method`
- `styling_tools`
- `heat_styling`
- `uses_heat_protection`

Recommended helpers:

```ts
type DryingContext = "air_dry" | "blow_dry" | "diffuser" | null
type HeatStylingContext = "none" | "heat_tools" | null
type LeaveInStylingContext = "air_dry" | "heat_style" | null
```

Suggested derivation rules:

#### `DryingContext`

From `drying_method`:

- `air_dry` -> `"air_dry"`
- `blow_dry` -> `"blow_dry"`
- `blow_dry_diffuser` -> `"diffuser"`
- `null` -> `null`

#### `HeatStylingContext`

From stage 3:

- if `heat_styling` is not `never` and not `null`, return `"heat_tools"`
- else if `styling_tools` contains non-diffuser heated tools, return `"heat_tools"`
- else return `"none"`

#### `LeaveInStylingContext`

For leave-in fit only:

1. if `HeatStylingContext === "heat_tools"`, return `"heat_style"`
2. else if `drying_method === "air_dry"`, return `"air_dry"`
3. else if `drying_method === "blow_dry"` or `drying_method === "blow_dry_diffuser"`, return `"heat_style"`
4. else return `null`

Important consequence:

- there is no longer a persisted `non_heat_style` profile state
- if a category truly needs that distinction in the future, it should be asked explicitly at that time

## Null Semantics

`answered_fields` exists only because the current schema uses `NOT NULL DEFAULT '{}'` for optional array inputs.

Target rule:

- `null` means the app does not know yet
- `[]` means the user explicitly answered none
- non-empty arrays mean explicit positive answers

This cleanup should apply native null semantics to all optional fields in scope that need explicit-none support:

- `styling_tools`
- `night_protection`
- `current_routine_products`

Single-value fields already support this pattern naturally:

- `drying_method`
- `brush_type`
- `towel_technique`
- `towel_material`

Important engine implication:

- `null` must never be treated as negative evidence
- example:
  - `nightProtection === null` means unknown
  - `nightProtection === []` means explicit lack of night protection

## Dependency Inventory

### Persistence and Schema

These areas depend directly on the current fields and must change:

- `supabase/migrations/20260307152000_leave_in_specs_and_profile_fields.sql`
- `supabase/migrations/20260322120000_add_mechanical_stress.sql`
- `supabase/migrations/20260324120000_add_answered_fields.sql`
- `supabase/migrations/20260408_onboarding_v2.sql`
- `src/lib/types.ts`
- `src/lib/validators/index.ts`

### Onboarding and Profile Editing

Current write paths that must be redesigned:

- `src/components/onboarding/onboarding-flow.tsx`
  - currently derives and writes `post_wash_actions`
  - currently derives and writes `mechanical_stress_factors`
  - currently merges and writes `answered_fields`
- `src/lib/onboarding/backward-compat.ts`
  - currently defines both derivation helpers
- `src/app/profile/page.tsx`
  - currently still carries the old fields in local profile shape

### Recommendation Engine

Current engine-boundary dependencies:

- `src/lib/recommendation-engine/types.ts`
- `src/lib/recommendation-engine/adapters/from-persistence.ts`
- `src/lib/recommendation-engine/normalize.ts`
- `src/lib/recommendation-engine/assessments/damage.ts`
- `src/lib/recommendation-engine/assessments/care-needs.ts`
- `src/lib/recommendation-engine/categories/leave-in.ts`
- `src/lib/recommendation-engine/categories/shared.ts`
- `src/lib/recommendation-engine/chat.ts`

Key target-state rule:

- the engine contract should no longer carry `mechanical_stress_factors` or `post_wash_actions`

### Legacy and Transitional Logic Still on Live Paths

These modules currently still consume the old signals and must be migrated or retired:

- `src/lib/routines/planner.ts`
- `src/lib/routines/brush-tools.ts`
- `src/lib/rag/mask-reranker.ts`
- `src/lib/rag/conditioner-decision.ts`
- `src/lib/rag/leave-in-decision.ts`
- `src/lib/rag/synthesizer.ts`
- `src/lib/suggested-prompts.ts`

### Tests That Must Be Updated

Current direct test dependencies include:

- `tests/recommendation-engine-foundation.fixtures.ts`
- `tests/recommendation-engine-foundation.test.ts`
- `tests/leave-in-decision.spec.ts`
- `tests/routine-planner.spec.ts`
- `tests/quiz-onboarding-e2e.spec.ts`
- `tests/mask-flow.spec.ts`
- `tests/shampoo-flow.spec.ts`
- `tests/conditioner-reranker.spec.ts`
- `tests/chat-debug-trace.spec.ts`
- `tests/oil-flow.spec.ts`
- `tests/suggested-prompts.test.ts`
- `tests/profile-page-smoke.spec.ts`

### Docs and Historical Plans

These are not runtime blockers but should be updated or superseded to prevent future confusion:

- `plans/routine-application-architecture-spec.md`
- `plans/mask-recommendation-spec.md`
- `plans/chat-smart-starters-v1-spec.md`
- `plans/page-by-page-intake-review.md`
- `docs/quiz-onboarding-data-collection-inventory.md`
- `docs/quiz-onboarding-question-ux-review.md`
- `docs/quiz-onboarding-ux-audit-review.md`

## Required Runtime Changes

### 1. Engine Contract Cleanup

- remove `post_wash_actions` and `mechanical_stress_factors` from:
  - `HairProfile`
  - `RawHairProfileInput`
  - `NormalizedProfile`
- keep the wash-day stages as:
  - stage 1: towel fields
  - stage 2: `drying_method`
  - stage 3: heat styling fields

### 2. Damage Assessment

Keep:

- `mechanicalLevel`
- `activeDamageDrivers`

Do not add a new public `mechanicalDrivers` property in this cleanup.

Reason:

- `mechanicalLevel` already solves the shared severity problem
- `activeDamageDrivers` already exists for traceability
- behavior modules can read atomic fields directly if they need exact causes

But update the mechanical scoring logic for null semantics:

- if `nightProtection === null`, treat as missing input
- if `nightProtection === []`, treat as explicit lack of protection

### 3. Wash-Day Derivation

Add stage-aware helpers near the engine boundary that derive:

- `DryingContext`
- `HeatStylingContext`
- `LeaveInStylingContext`

from:

- `drying_method`
- `styling_tools`
- `heat_styling`
- `uses_heat_protection`

All category logic should read those helpers, not raw compatibility arrays.

### 4. Routine and Behavior Logic

Replace `mechanical_stress_factors` reads as follows:

- care-intensity checks
  - use `damage.mechanicalLevel`
- behavior-specific recommendations
  - use `towel_technique`
  - use `brush_type`
  - use `night_protection`

### 5. Missing-State Handling

Replace logic that currently treats empty arrays as negative evidence when the field might simply be unknown.

Example areas to review explicitly:

- `damage.ts`
- `intervention.ts`
- `suggested-prompts.ts`
- `synthesizer.ts`
- onboarding/profile completeness heuristics

## UI and Question Flow Changes

### Replace Current `post_wash_actions` Modeling

Current state:

- `drying_method` writes part of `post_wash_actions`
- heat-tool selection writes another part of `post_wash_actions`
- `non_heat_styling` exists in the enum but is not actually collected in onboarding

Target state:

- remove `post_wash_actions` entirely
- stop deriving any compatibility array from wash-day inputs
- keep the three stages separate and explicit

### Stage 2 Drying UX

Recommended change:

- make `drying_method` a single-select question

Reason:

- it should represent the dominant route to dry the hair
- this matches the product concept you described better than the current multi-select UI

### Stage 3 Styling UX

No new dedicated question is required in this cleanup.

We already collect:

- heat tools
- heat frequency
- heat protection

That is enough to model the optional heated-styling stage cleanly.

### Non-Heat Styling

This proposal intentionally does **not** add a new non-heat styling field.

Reason:

- that concept is not part of the current three-stage intake design
- it is currently only a broken leftover enum value
- adding a new field would widen the product scope rather than cleaning the model

If later evidence shows we truly need non-heat styling as a persistent recommendation signal, it should be introduced as a dedicated future intake question.

## Non-Goals

- No attempt to preserve old `post_wash_actions` or `mechanical_stress_factors` rows
- No temporary compatibility layer that stays in the engine contract long-term
- No new persisted aggregate mechanical property
- No new `after_wash_styling_mode` field
- No expansion of product catalog fit tables as part of this cleanup

## Implementation Order

1. Add new nullability rules and reshape `drying_method` to a single value.
2. Remove `answered_fields` and replace it with native null semantics.
3. Update onboarding and profile editing to write only stage-based source-of-truth fields.
4. Remove `post_wash_actions` and `mechanical_stress_factors` from persistence contracts.
5. Clean the engine contracts and normalization layer.
6. Switch shared-fit logic to stage-aware derivations and `mechanicalLevel`.
7. Update routine and legacy RAG helpers.
8. Update tests and docs.
9. Drop the removed columns.

## Verification Matrix

### Unit and Engine

- `tests/recommendation-engine-foundation.test.ts`
  - mechanical level still derives correctly
  - unknown vs explicit none does not over-penalize
- `tests/recommendation-engine-planner.test.ts`
  - wash-day support still routes correctly

### Category and Legacy Surfaces

- `tests/leave-in-decision.spec.ts`
- `tests/routine-planner.spec.ts`
- `tests/suggested-prompts.test.ts`
- `tests/conditioner-reranker.spec.ts`
- `tests/mask-flow.spec.ts`

### Onboarding and Profile

- `tests/quiz-onboarding-e2e.spec.ts`
  - stage 1, stage 2, and stage 3 fields persist correctly
  - explicit none is preserved via null/array semantics, not metadata
- profile edit regression
  - changing towel, drying, or styling questions cannot leave stale derived fields because those fields no longer exist

### Debug and Trace

- `tests/chat-debug-trace.spec.ts`
  - trace still exposes mechanical severity and useful damage drivers
  - trace no longer exposes deprecated compatibility fields

## Expected End State

At the end of this cleanup:

- the profile schema stores only source-of-truth wash-day answers
- the engine computes shared mechanical severity from atomic inputs
- the engine derives wash-day context from the three explicit stages instead of from `post_wash_actions`
- unknown versus explicit none is encoded natively in field values
- there is no `answered_fields`, `post_wash_actions`, or `mechanical_stress_factors` left in the live system
