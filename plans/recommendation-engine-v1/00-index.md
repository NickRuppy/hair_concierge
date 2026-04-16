# Recommendation Engine V1 Execution Pack

## Purpose

This folder translates the V1 PRD into an implementation guide for the backend rewrite.

Source-of-truth split:
- [page-by-page-intake-review.md](../page-by-page-intake-review.md) is the product and recommendation spec.
- This execution pack is the build guide for turning that spec into code.

## Working Rules

- Full PRD scope equals V1 scope. Build phases are sequencing only, not scope cuts.
- The old recommendation engine is reference material only, not an architecture to preserve.
- We keep the app shell that already works: auth, quiz UX, onboarding UX, profile UI, chat transport.
- We rebuild the core recommendation backend behind a new engine boundary.
- Engine-first is the chosen implementation path:
  - current persisted intake stays in place for now
  - adapters normalize that intake into the new engine contracts
  - persistence cleanup happens after the new engine shape is stable
- Strategic decisions pause implementation briefly so we can align directly with the user.

## Why One Main Worktree

We are doing this in one dedicated worktree on one rewrite branch because the core pieces are tightly coupled:
- domain model
- shared assessments
- intervention planner
- category consumers
- integration boundary

Splitting those into multiple long-lived worktrees too early would create merge churn on the same files and slow the rewrite down. Side worktrees are fine later for small isolated spikes, but the main rewrite should stay integrated in one place.

## File Map

- [01-domain-model.md](./01-domain-model.md): canonical engine entities and boundaries
- [02-engine-contracts.md](./02-engine-contracts.md): stable internal interfaces and trace shape
- [03-category-consumption.md](./03-category-consumption.md): how each recommendation category consumes shared layers
- [04-build-order.md](./04-build-order.md): implementation phases, deliverables, exit criteria
- [05-verification.md](./05-verification.md): fixture strategy, tests, QA, cutover checks
- [06-product-property-backfill.md](./06-product-property-backfill.md): canonical fit properties and catalog backfill plan

## Delivery Model

The implementation sequence is:
1. Freeze the domain model and engine contracts.
2. Build the shared assessment layers.
3. Build the intervention planner.
4. Build category consumers on top of the shared layers.
5. Integrate the new engine into chat and cut over.

This sequence exists to keep the logic coherent. It does not reduce V1 scope.

## Status Snapshot

Current progress against the execution plan:

- Phase 0 `Freeze and Translate`: completed
  - execution pack exists
  - domain/contracts/category consumption/verification docs are in place
- Phase 1 `Engine Foundation`: completed
  - new engine module exists under `src/lib/recommendation-engine/`
  - persistence adapter, normalization, contracts, fixtures, and `damage_assessment` are implemented
- Phase 2 `Care Need Layer`: completed
  - `care_need_assessment` is implemented and covered by tests
- Phase 3 `Intervention Planner`: completed
  - `intervention_planner` exists with structured actions, deferred actions, and baseline contradiction handling
- Phase 4 `Category Consumers`: completed
  - conditioner, mask, leave-in, shampoo, oil, routine, and support/reset categories are implemented or materially integrated
  - category-fit evaluation is implemented for the fit-driven categories and oil now runs through normalized request-context logic
  - support/reset planner and category-consumer logic now exist for `bondbuilder`, `deep_cleansing_shampoo`, `dry_shampoo`, and `peeling`
  - support-category product-spec plumbing now exists end-to-end:
    - migration tables
    - TS constants/types
    - validator support
    - admin create/edit hydration
  - engine-aware product reranking/selection is implemented for shampoo, conditioner, mask, leave-in, and oil
  - remaining runtime integrations are now complete for the core backfilled categories:
    - leave-in selection reads the canonical fit mirror table
    - shampoo reranking reads backfilled `cleansing_intensity`
    - oil selection prefers exact `oil_purpose` eligibility before falling back to subtype
  - direct engine-side reranking/selection is now also wired for `bondbuilder`, `deep_cleansing_shampoo`, `dry_shampoo`, and `peeling`
  - support-category selectors are intentionally no-data-safe: if the catalog/spec tables are still empty, they return no products instead of breaking the pipeline
  - routine planning now reads engine-native category decisions for its core category context instead of reconstructing legacy decision helpers
  - routine product attachments now use the new engine selectors instead of the legacy per-category rerankers
  - shampoo rotation logic is now modeled explicitly for primary vs secondary bucket handling
  - oil purpose is now modeled as normalized request context, with fallback to stored routine purpose when available
  - core live-category backfill is complete for conditioner, mask, leave-in, shampoo, and oil
  - support-category schema is in place for `bondbuilder`, `deep_cleansing_shampoo`, `dry_shampoo`, and `peeling`, but those catalog tables are still empty
- Phase 5 `Integration and Cutover`: completed
  - conversation orchestration now builds one shared recommendation-engine runtime per request and uses it as the decision source of truth
  - product selection is now engine-first and engine-only for the implemented categories rather than trying legacy decision paths first
  - response composition now receives the engine category decision directly
  - assistant `rag_context` now persists both `category_decision` and `engine_trace`
  - chat debug traces now persist and expose the full engine trace alongside the compact category decision
  - admin conversation debug output now shows `engine_trace` explicitly in the decision snapshot

## Verification Snapshot

Implemented and green:
- foundation tests
- planner tests
- category-consumer tests
- engine-selection tests
- engine-routine tests
- support-category schema tests
- chat debug trace Playwright checks
- shampoo/conditioner Playwright regression checks
- `npm run typecheck`

Current verification gap:
- catalog backfill is still ongoing for some newer category-fit properties, so some selectors remain intentionally silent until product-spec rows exist

## Current Focus

The current rewrite focus is:
- continue catalog backfill on the newly added structured fields
- support-category selectors are live, but they will stay intentionally silent until catalog/spec rows exist
- monitor the new engine-only path and close remaining catalog metadata gaps that still surface `category_fit = unknown`

## Original Starting Point

The next work should begin with Phase 0 and Phase 1 from [04-build-order.md](./04-build-order.md):
- lock naming and contract boundaries
- define the fixture matrix
- scaffold the new engine module tree
- implement normalization and `damage_assessment`

## Decision Interview Rule

When a decision changes scope, schema direction, or core architecture, stop and align directly before coding forward. Examples:
- persistence rewrite now vs adapter-first
- final canonical naming for routine inventory storage
- whether to replace the old engine all at once or run both briefly behind a switch during verification
