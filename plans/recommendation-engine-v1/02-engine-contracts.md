# Engine Contracts

## Goal

Lock the internal interfaces of the new engine before large-scale implementation begins.

## Contract Principles

- Contracts must be TypeScript-first and validated with Zod where they cross boundaries.
- Contracts should favor explicit enums and reason codes over free-form text.
- The chat layer should receive structured outputs and turn them into user-facing German copy.
- Debug traces are part of the contract, not an afterthought.

## Top-Level Flow

```ts
RawRecommendationInput
  -> normalizeRecommendationInput()
  -> buildDamageAssessment()
  -> buildCareNeedAssessment()
  -> buildInterventionPlan()
  -> buildCategoryDecisions()
  -> composeEngineOutput()
```

## Required Core Types

### Input Contracts

- `RawRecommendationInput`
- `NormalizedProfile`
- `RoutineInventoryItem`
- `RoutineInventory`
- `RecommendationRequestContext`

### Shared Assessment Contracts

- `DamageAssessment`
- `CareNeedAssessment`
- `InterventionPlan`

### Category Contracts

- `CategoryId`
- `CategoryDecision`
- `CategoryRecommendationSet`

### Integration Contracts

- `RecommendationEngineOutput`
- `EngineTrace`

## Reason Code Policy

Every important recommendation decision should be backed by stable reason codes.

Reason codes are used for:
- tests
- debug traces
- future analytics
- final explanation composition

Examples:
- `high_structural_damage`
- `missing_heat_protection`
- `underused_conditioner_for_wash_cadence`
- `leave_in_conflicts_with_volume_goal`

## Trace Contract

Each engine run should emit a trace object that answers:
- what inputs were used
- what derived values were computed
- why each category was considered relevant or not
- why each action was selected
- which inputs were missing

This trace should be easy to inspect in tests and during debugging.

## Request-Context Rule

If a category needs current-turn intent, the engine must not receive raw conversation text.

Instead:
- the conversation layer normalizes raw text into structured request context
- the engine consumes only explicit enum/flag inputs

Current V1 example:
- `oil` may consume `requestContext.oilPurpose`
- if request purpose is missing, `oil` may fall back to stored routine purpose
- if both are missing, `oil` should ask for clarification rather than guess

## Contract Stability Rule

Once these contracts are implemented, changes to them should be treated as architectural changes, not casual refactors.

That protects the rewrite from shape drift while category work is in flight.
