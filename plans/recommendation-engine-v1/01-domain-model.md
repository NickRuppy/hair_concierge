# Domain Model

## Goal

Define the clean internal model for Recommendation Engine V1 before implementation spreads logic across the codebase.

## Design Principles

- The engine should code against domain entities, not directly against current DB table shapes.
- Persistence, UI, and chat are input/output concerns around the engine, not the engine itself.
- Shared assessments must be computed once and consumed everywhere.
- Category logic should add category-specific behavior, not redefine core state.

## Core Boundary

The engine boundary starts at normalized recommendation input and ends at structured recommendation output.

Outside the boundary:
- Supabase tables
- onboarding storage
- profile forms
- chat message transport
- final prose generation

Inside the boundary:
- normalized profile and routine input
- shared assessments
- intervention planning
- category recommendation decisions
- trace/debug explanations

## Canonical Engine Entities

### NormalizedProfile

Single normalized view of all profile and onboarding inputs the engine is allowed to consume.

Includes:
- hair structure inputs
- scalp inputs
- structural damage inputs
- heat inputs
- mechanical habit inputs
- goals
- concerns
- wash and styling context

### RoutineInventory

Structured representation of the user's current routine inventory.

Contains per-category items with:
- category
- product name when known
- frequency band when known
- presence state

Engine rule:
- the engine reasons over `RoutineInventoryItem` as a domain type
- the storage table name is an adapter concern until we intentionally lock the persistence rewrite

### Shared Assessments

Shared layers defined by the PRD:
- `damage_assessment`
- `care_need_assessment`
- `intervention_planner`

These are engine-native objects, not prompt-only summaries.

### Category Decisions

Each category reads from shared outputs and emits:
- relevance
- fit
- conflict
- recommended action
- reason codes

## Source Inputs

Raw intake can continue coming from the existing product surfaces:
- quiz
- onboarding
- profile page
- current routine inventory persistence

Current engine-first assumption:
- `hair_profiles` remains the raw persisted profile source during Phase 1
- `user_product_usage` remains the raw persisted routine-inventory source during Phase 1
- the new engine should depend on normalized engine inputs, not on those storage shapes directly

Important rule:
- we keep the existing user-facing collection surfaces unless the PRD explicitly requires new intake
- we do not let legacy storage naming leak into the new engine contracts

## Domain Names We Should Lock Early

- `NormalizedProfile`
- `RoutineInventoryItem`
- `DamageAssessment`
- `CareNeedAssessment`
- `InterventionPlan`
- `CategoryDecision`
- `EngineTrace`

These names should stay stable once implementation starts.

## What This Prevents

Without this layer, the rewrite will drift into:
- DB-shaped logic
- duplicated category rules
- prompt-defined behavior
- hard-to-test orchestration code

This file exists to prevent that drift.
