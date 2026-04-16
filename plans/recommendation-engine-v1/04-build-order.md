# Build Order

## Goal

Sequence the full V1 rewrite so we move fast without losing control.

Important rule:
- every phase below belongs to V1
- these are implementation phases, not reduced scopes

## Phase 0: Freeze and Translate

Deliverables:
- execution pack completed
- canonical names locked
- unresolved strategic decisions listed explicitly
- new engine folder structure agreed

Exit criteria:
- we can point to one file for domain model
- one file for contracts
- one file for category consumption
- one file for verification

Why first:
- the rewrite will thrash if code starts before the internal language is stable

## Phase 1: Engine Foundation

Deliverables:
- `src/lib/recommendation-engine/` scaffolded
- raw-intake adapters from current persistence created
- normalization layer created
- initial engine types and Zod schemas created
- fixture matrix created
- `damage_assessment` implemented

Exit criteria:
- raw intake can be normalized into a stable engine input
- `damage_assessment` is testable in isolation
- fixtures cover representative profile combinations

Why here:
- every later recommendation depends on normalized input and shared damage state

## Phase 2: Care Need Layer

Deliverables:
- `care_need_assessment` implemented
- care reason codes implemented
- trace output extended

Exit criteria:
- care-direction needs derive cleanly from normalized input plus damage state
- layer tests pass on the fixture matrix

Why here:
- this keeps downstream category logic from inventing its own need model

## Phase 3: Intervention Planner

Deliverables:
- `intervention_planner` implemented
- action precedence rules implemented
- contradiction guards implemented
- routine inventory reasoning implemented

Exit criteria:
- planner emits structured actions consistently
- planner decisions are explainable from trace output
- key contradiction cases are covered by tests

Why here:
- action logic should exist once, centrally, before category consumers branch

## Phase 4: Category Consumers

Deliverables:
- all V1 category consumers implemented
- category-specific fit/conflict logic implemented
- product metadata consumption aligned with the PRD

Execution order:
1. conditioner
2. mask
3. leave_in
4. routine
5. shampoo
6. oil
7. bondbuilder, deep cleansing, dry shampoo, peeling

Exit criteria:
- every V1 category consumes shared outputs rather than bypassing them
- category tests and fixture assertions are passing

Why here:
- we want one coherent engine, not ten separate mini-engines

## Phase 5: Integration and Cutover

Deliverables:
- new engine wired into orchestration/chat integration
- response composition reads structured engine output
- old engine path removed or clearly retired after verification

Exit criteria:
- end-to-end flows pass
- debug traces are visible enough for internal QA
- cutover checklist from [05-verification.md](./05-verification.md) is green

Why last:
- orchestration should present stable engine decisions, not define them
