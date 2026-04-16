# Category Consumption

## Goal

Define how all V1 recommendation categories consume the shared engine layers.

## Shared Consumption Rule

Categories must consume shared outputs first and add category-specific logic second.

Shared-first inputs:
- `DamageAssessment`
- `CareNeedAssessment`
- `InterventionPlan`
- `RoutineInventory`

Category-specific inputs:
- thickness and density where needed
- scalp state where needed
- texture and goals where needed
- product metadata where needed
- normalized request context where a category truly depends on current-turn intent

## V1 Categories

All of these belong to V1 scope:
- shampoo
- conditioner
- leave_in
- mask
- oil
- bondbuilder
- deep_cleansing_shampoo
- dry_shampoo
- peeling
- routine

## Consumption Expectations

### Conditioner

Consumes:
- repair priority
- balance direction
- weight fit
- routine presence and cadence

### Mask

Consumes:
- damage severity
- mask need strength
- balance direction
- thickness-weight fit

### Leave-in

Consumes:
- hydration, smoothing, detangling, definition, and thermal support needs
- repair uplift from shared damage state
- texture and goal interactions

### Shampoo

Consumes:
- scalp hierarchy first
- cleanse/reset logic
- conflict checks against dryness and damage

### Oil

Consumes:
- request purpose first
- stored routine purpose second
- clarification when purpose is still missing
- weight/conflict signals
- smoothing and finish context

Special rule:
- oil may read normalized request context
- oil must not read raw conversation text directly
- shared layers can influence whether oil is sensible, but must not turn oil into a pseudo-repair category

### Support Categories

Support categories consume the shared layers plus reset/scalp logic:
- bondbuilder
- deep_cleansing_shampoo
- dry_shampoo
- peeling

Support-category specifics:
- `bondbuilder`
  - structural-treatment consumer, not a mask subtype
  - anchored in `bond_builder_priority` plus structural damage context
  - can coexist with mask when the structural case is strong
  - fit is driven by `bond_repair_intensity` and `application_mode`
- `deep_cleansing_shampoo`
  - occasional reset consumer inside the scalp/reset lane
  - anchored in derived `buildup_reset_need`, not oily scalp alone
  - must stay conservative under dryness/irritation/damage pressure
  - fit is driven by `scalp_type_focus`
- `dry_shampoo`
  - bridge-category consumer, not a cleansing replacement
  - anchored in between-wash need and scalp/oil pattern
  - overuse/de-escalation matters as much as activation
  - fit is driven by `scalp_type_focus`
- `peeling`
  - scalp/reset consumer with stronger irritation guardrails than deep-cleansing shampoo
  - anchored in `buildup_reset_need` plus scalp-specific need
  - must de-escalate under dryness or irritation risk
  - fit is driven by `scalp_type_focus` and `peeling_type`

### Routine

Routine is the broadest consumer.

It should explain:
- what the hair needs
- what should change in the routine
- why those changes matter

Implementation note:
- the routine planner may keep separate topic-activation or educational heuristics
- but the core category context and attached products should come from the shared engine outputs rather than legacy per-category mini-engines

## Implementation Order

Implementation order is about dependencies, not scope:
1. conditioner
2. mask
3. leave_in
4. routine
5. shampoo
6. oil
7. support categories

This order lets us prove the shared-layer architecture on the categories most shaped by the PRD before finishing the rest of V1.
