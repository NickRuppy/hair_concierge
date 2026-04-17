# Profile Signal Cleanup Implementation Plan

**Goal:** Remove the stale persisted profile mirrors (`mechanical_stress_factors`, `post_wash_actions`, `answered_fields`), switch optional onboarding arrays to native null semantics, and align wash-day logic to the approved three-stage model.

**Architecture:** The persistence layer keeps only atomic user answers. Shared recommendation logic reads canonical assessments (`damage.mechanicalLevel`) plus atomic profile fields. Wash-day styling context is derived on read from stage 2 (`drying_method`) and stage 3 (`styling_tools`, `heat_styling`, `uses_heat_protection`) instead of from a persisted compatibility field.

**Key Decisions Locked In**

- `drying_method` becomes a single-select dominant route: `DryingMethod | null`
- `night_protection`, `styling_tools`, and `current_routine_products` become nullable:
  - `null` = not answered yet
  - `[]` = explicit none
- `Nichts davon` and `Ohne Nachtschutz speichern` both persist `night_protection = []`
- `non_heat_styling` is dropped from persisted profile state
- `DamageAssessment.mechanicalLevel` is the only shared mechanical severity signal

## Implementation Order

### 1. Red Tests For New Semantics

Write failing tests for the two semantic changes that can silently regress:

- unknown `night_protection` must not be treated like explicit lack of night protection
- stage-based styling context must come from `drying_method` and heat-tool inputs, not `post_wash_actions`

Primary files:

- `tests/recommendation-engine-foundation.test.ts`
- `tests/leave-in-decision.spec.ts`

### 2. Persistence, Types, and Validation

Update the canonical profile contracts first so removed fields cannot leak back in.

Files:

- `supabase/migrations/<new cleanup migration>.sql`
- `src/lib/types.ts`
- `src/lib/validators/index.ts`
- `src/lib/recommendation-engine/types.ts`
- `src/lib/recommendation-engine/adapters/from-persistence.ts`
- `src/lib/recommendation-engine/normalize.ts`

Changes:

- drop `post_wash_actions`
- drop `mechanical_stress_factors`
- drop `answered_fields`
- change `drying_method` from `DryingMethod[]` to `DryingMethod | null`
- change `night_protection`, `styling_tools`, `current_routine_products` to nullable arrays

### 3. Onboarding And Profile Editing

Remove backward-compat writes and make the UI persist only the new source-of-truth fields.

Files:

- `src/components/onboarding/onboarding-flow.tsx`
- `src/lib/onboarding/store.ts`
- `src/lib/onboarding/backward-compat.ts`
- `src/lib/onboarding/answered-fields.ts`
- `src/app/profile/page.tsx`
- `src/lib/profile/section-config.ts`

Changes:

- convert `drying_method` onboarding step to single-select
- change prompt to the dominant-route wording (`hauptsaechlich` / `meistens`)
- stop writing `post_wash_actions`
- stop writing `mechanical_stress_factors`
- stop writing `answered_fields`
- load and display nullable `night_protection`

### 4. Shared Derivation Helpers

Introduce one small helper module for wash-day and mechanical behavior interpretation so RAG, routines, and engine logic use the same rules.

Candidate file:

- `src/lib/profile/signal-derivations.ts`

Responsibilities:

- derive leave-in styling context from:
  - `drying_method`
  - `styling_tools`
  - `heat_styling`
- detect direct mechanical-stress behavior signals from:
  - `towel_technique`
  - `brush_type`
  - `night_protection`
- distinguish `night_protection = null` from `night_protection = []`

### 5. Recommendation Engine Migration

Move every engine consumer off the deprecated mirrors.

Files:

- `src/lib/recommendation-engine/assessments/damage.ts`
- `src/lib/recommendation-engine/planner/intervention.ts`
- `src/lib/recommendation-engine/categories/leave-in.ts`
- `src/lib/recommendation-engine/categories/shared.ts`

Changes:

- preserve `nightProtection: null` through normalization
- only score `missing_night_protection` when the field was explicitly answered as `[]`
- derive leave-in and bond-builder styling context from stage 2 + stage 3 inputs
- remove `postWashActions` / `mechanicalStressFactors` from normalized profile

### 6. Legacy Routine And RAG Migration

Replace direct mirror reads in the older logic paths.

Files:

- `src/lib/rag/leave-in-decision.ts`
- `src/lib/rag/conditioner-decision.ts`
- `src/lib/rag/mask-reranker.ts`
- `src/lib/rag/synthesizer.ts`
- `src/lib/routines/planner.ts`
- `src/lib/routines/brush-tools.ts`
- `src/lib/suggested-prompts.ts`

Changes:

- replace `deriveMechanicalStressLevel(profile.mechanical_stress_factors ?? [])`
  with direct behavior checks or shared damage assessment logic
- replace `post_wash_actions` logic with stage-based drying / heat styling helpers
- update summaries and prompts to reference real stored fields only

### 7. Fixture, Test, And Eval Cleanup

Repair every fixture that still encodes the removed properties.

Files:

- `tests/recommendation-engine-foundation.fixtures.ts`
- `tests/routine-planner.spec.ts`
- `tests/conditioner-reranker.spec.ts`
- `tests/mask-flow.spec.ts`
- `tests/oil-flow.spec.ts`
- `tests/shampoo-flow.spec.ts`
- `tests/chat-debug-trace.spec.ts`
- `tests/profile-page-smoke.spec.ts`
- `tests/quiz-onboarding-e2e.spec.ts`
- `scripts/eval-chat/types.ts`
- `scripts/eval-chat/fixtures.ts`

### 8. Verification

Minimum verification before close-out:

- targeted red/green runs for the new semantics
- `npm run typecheck`
- targeted Playwright and node tests for touched flows

Suggested command set:

- `npx playwright test tests/leave-in-decision.spec.ts`
- `tsx --test tests/recommendation-engine-foundation.test.ts`
- `tsx --test tests/routine-planner.spec.ts`
- `npm run typecheck`

## Notes

- This is a real model cleanup, not a compatibility layer.
- Old test data can be discarded; no backfill path is required.
- The highest-risk regression is falsely treating `null` as explicit none inside damage and behavior guidance.
