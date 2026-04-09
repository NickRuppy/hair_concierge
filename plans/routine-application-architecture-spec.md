# Routine / Application Recommendation Architecture

## Quick Read

- Build a new **routine/application layer** beside the current product-category logic.
- Keep **chat as the first consumer**. No saved routine artifact in v1.
- Organize recommendations by **hair texture + goals/problems together**.
- Start from a **minimal base routine** and expand only when **need + goals** justify it.
- Store **deterministic rules in code/structured data** and **longform routine content in markdown/RAG**.
- Treat scalp routines as **in scope**, but keep them conservative and non-medical.

## Decisions Locked

1. `routine_preference` should be removed from the future logic model.
2. Routine breadth is controlled by **need + goals**, not by a user preference toggle.
3. `current_routine_products` is used for **gap analysis**, not just prompt flavor.
4. `mechanical_stress_factors` affects both **behavior guidance** and **care intensity**.
5. `styling_tools` should increase the stress/protection signal.
6. Routine modules may be **instruction-only** or **product-linked**.
7. Routine/application content should live in **rules + markdown**, not mostly prompt-only and not DB-managed first.

## Background Logic By Input Layer

### 1. Diagnostic Quiz Layer

#### `hair_texture`
- Broad routine family selector.
- Strong signal for styling/application behavior.
- Most important for wavy/curly/coily routines.

#### `thickness`
- Strong weight/intensity signal.
- Controls layering tolerance, amount guidance, and richness.

#### `cuticle_condition`
- Repair burden signal.
- Helps decide when protective or repair-focused modules are needed.

#### `protein_moisture_balance`
- Core conditioner/mask direction signal.
- Should also shape routine-level moisture vs protein emphasis.

#### `chemical_treatment`
- Raises repair/protection intensity.
- Important for mask cadence and post-wash protection logic.

#### `scalp_type`
- Cleansing pattern signal.
- Influences scalp maintenance routine and deep-clean/clarify framing.

#### `scalp_condition`
- Enables conservative scalp branches.
- Must drive caveats and when scalp routines take priority over cosmetic goals.

### 2. Goals Page

#### `desired_volume`
- Real routine-shaping input.
- Affects product weight, styling approach, and how much smoothing/oiling is acceptable.

#### `goals`
- Co-primary organizer with `hair_texture`.
- Activates and prioritizes modules.
- Cosmetic goals are allowed to expand a routine when meaningful.

#### `routine_preference`
- Do not use in future composition logic.
- Existing stored values can be ignored until cleanup/removal work happens.

### 3. Profile Page

#### `density`
- Secondary structural signal.
- Helps decide how much layering/weight the hair can tolerate.

#### `mechanical_stress_factors`
- Must affect both:
  - product/care intensity
  - explicit behavior-change modules and warnings

### 4. Routine Page

#### `wash_frequency`
- Cadence signal.
- Used for routine timing and how often certain modules can appear.

#### `heat_styling`
- Protection/application signal.
- Helps decide whether the routine needs heat-related modules.

#### `post_wash_actions`
- Strong application-technique selector.
- Should branch into air-dry / non-heat styling / heat styling routine variants.

#### `current_routine_products`
- Gap-analysis input.
- Used to decide whether to add, swap, reinforce, or skip a step.

### 5. Secondary / Supplemental Inputs

#### `styling_tools`
- Should contribute to stress/protection logic.
- Does not need tool-specific complexity in v1; presence is already useful.

#### `products_used`
- Soft enricher only.
- Helps avoid repetition or obvious contradictions.

#### `additional_notes`
- Soft enricher only.
- Can refine wording or exclusions, not gate routine composition.

#### memory / conversation history
- Soft enricher only.
- Useful for preferences, negative product experiences, and stable behavior context.

## Target Architecture

### Core Internal Types

#### `RoutineContext`
- Normalized view of `HairProfile` plus derived signals.
- Contains no prose, only structured decision inputs.

Suggested contents:
- organizers: texture family, active goals/problems
- burden signals: repair, stress, scalp, volume sensitivity
- behavior signals: wash cadence, post-wash path, heat usage
- inventory signals: current routine gaps / overlaps
- enrichers: notes, memory, current products

#### `RoutineModule`
- One reusable rule/content unit.
- Can be:
  - `instruction_only`
  - `product_linked`

Each module should declare:
- when it applies
- what it adds
- how important it is
- caveats / safety notes
- optional linked categories or products

#### `RoutineStep`
- Ordered chat-facing unit.
- Includes:
  - step name
  - instructions
  - optional cadence
  - optional category/product attachment
  - optional caveat
  - reason tags for synthesis

#### `RoutinePlan`
- Internal composed plan for prompt consumption.
- Chat-only in v1.
- Not persisted in DB in v1.

### Composition Flow

1. Build `RoutineContext` from profile + derived signals.
2. Start from a minimal base routine.
3. Activate additional modules from:
   - scalp needs
   - repair/protection burden
   - texture family
   - explicit goals
4. Run gap analysis against `current_routine_products`.
5. Produce a `RoutinePlan` for synthesis.
6. Feed the plan into chat generation alongside citations and any matched products.

## V1 Module Families

Seed the first version with a small, composable library:

1. Minimal wash-day base
2. Pre-wash oiling
3. Deep-clean / clarify reset
4. Mask order and cadence
5. Air-dry finish
6. Heat-style finish
7. Mechanical-stress protection
8. Conservative scalp support branches

Each module should be able to exist without product attachment if needed.

## Content Strategy

### Rules / Structured Layer
- Keep module applicability and composition rules in code or structured JSON.
- This is the deterministic layer.

### Markdown / RAG Layer
- Keep Tom-style longform routine explanations in markdown.
- Ingest through the existing markdown pipeline.
- Add metadata so content can be retrieved by:
  - routine topic
  - module family
  - hair texture
  - scalp state
  - problem / goal

### Authoring Principle
- Adding a new routine topic should usually mean:
  - add or extend a module
  - add markdown content
- It should not require new pipeline surgery every time.

## Integration Boundaries

### Use the new layer for:
- `routine_help`
- category `routine`
- category-specific application guidance where order/technique matters

### Keep existing product pipelines for:
- shampoo
- conditioner
- mask
- leave-in
- oil

The new routine layer should complement those systems, not replace product eligibility/ranking.

## Test / Acceptance Checklist

- `RoutineContext` derivation is deterministic for all onboarding/profile fields.
- `routine_preference` has no effect on routine composition.
- `current_routine_products` changes composition via gap analysis.
- `mechanical_stress_factors` add both care-intensity and behavior modules.
- `styling_tools` increase stress/protection behavior.
- scalp routines compose conservatively from `scalp_type` / `scalp_condition`.
- modules can be composed with or without product attachment.
- category-specific application guidance reuses shared module logic.
- markdown retrieval can pull routine content by topic/module metadata.

## Deferred / Not In V1

- No saved routine object.
- No routine card UI.
- No admin-managed routine database.
- No requirement that every routine step points to a product.
- No medical treatment logic for scalp beyond conservative, clearly bounded advice.
