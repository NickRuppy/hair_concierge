# Verification

## Goal

Make the rewrite safe to move quickly by validating the engine continuously, not only at the end.

## Verification Principles

- Verify shared layers before full chat integration.
- Prefer fixture-driven assertions over manual inspection alone.
- Every major recommendation path should have a trace we can inspect.
- Tests should validate both outputs and reasons.

## Test Layers

### Layer Tests

Focused tests for:
- normalization
- `damage_assessment`
- `care_need_assessment`
- `intervention_planner`
- category consumers

### Golden Fixtures

Create a curated fixture matrix that covers:
- all hair textures
- thickness and density combinations
- low, medium, and high damage profiles
- heat-protected vs unprotected heat use
- low-stress vs high-stress mechanical habits
- key scalp states
- routine inventory gaps and overload cases

Each fixture should assert:
- key shared outputs
- key reason codes
- key category actions

### End-to-End Checks

Reuse and extend existing repo tooling where helpful:
- chat eval scenarios
- QA validation scenarios
- build/typecheck/lint

## Trace Requirement

The new engine should emit enough structured trace detail that we can answer:
- why was this category relevant
- why was this product action chosen
- what missing inputs reduced confidence
- what conflicts were detected

If a decision cannot be traced, it is not ready.

## Cutover Checklist

Before replacing the legacy path, confirm:
- domain contracts are stable
- shared layer tests pass
- category fixtures pass
- end-to-end chat flows are acceptable
- no critical contradiction cases remain unexplained

Current cutover status:
- completed
- orchestrator now builds a single recommendation-engine runtime and uses it as the request-time source of truth
- product selection now runs through engine selectors for the implemented categories
- response composition consumes engine category decisions directly
- assistant `rag_context` and debug traces now persist `engine_trace`
- admin debug tooling exposes the persisted engine trace

Current verification runs:
- `npm run typecheck`
- `npx tsx --test tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-planner.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-selection.test.ts tests/recommendation-engine-routine.test.ts tests/admin-product-support-specs.test.ts`
- `npx playwright test tests/chat-debug-trace.spec.ts tests/conditioner-reranker.spec.ts tests/shampoo-flow.spec.ts --reporter=line`

## Fast Feedback Loop

During implementation, the minimum repeatable loop should be:
1. add or update fixtures
2. implement logic
3. inspect trace output
4. run targeted tests
5. only then move to the next category or layer

This keeps speed high without turning the rewrite into guesswork.
