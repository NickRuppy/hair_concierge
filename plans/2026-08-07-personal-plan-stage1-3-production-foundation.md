# Personal Plan Stages 1–3 — production foundation

**Status:** implementation in progress; architecture chosen, six counterpart passes reconciled, state-H evidence approved, the production-integration journey signed off by Nick on 2026-08-08, and consolidated Task 0 approved by Nick on 2026-08-08

**Outcome:** replace the development-only, fixture/in-memory Stage 1 → 2 → 3 preview with an authenticated, owner-scoped and resumable production foundation that preserves one living Personal Plan per user, produces immutable need and portfolio versions, keeps owned-product identity reusable, and hands one atomic Stage-4 routine proposal forward without silently changing an active plan.

## 1. Source context

This plan is the production-integration authority that joins the already approved stage contracts. It explicitly supersedes their fixture-era persistence/table naming, while their deterministic domain, UI and user-journey decisions remain authoritative:

- Stage 1: `plans/2026-08-06-personal-plan-stage1-bedarf-implementation.md`
- Stage 2: `plans/2026-08-07-personal-plan-stage2-refinement-implementation.md`
- Stage 3: `plans/2026-08-07-personal-plan-stage3-products-implementation.md`
- Cross-stage journey: `plans/2026-08-07-personal-plan-five-stage-product-journey.md`
- Stage-1 visual authority: `plans/mockups/2026-08-06-personal-plan-stage1-density-states.html`
- Stage-2 visual authority: `plans/mockups/2026-08-07-personal-plan-stage2-refinement-flow.html`
- Stage-3 visual authority: `plans/mockups/2026-08-07-personal-plan-stage3-products-flow.html`
- Ten category authorities: `docs/personal-plan/categories/*/decision.md`

The integrated preview is committed at `572e8f82`. It proves the approved order and interaction contracts but deliberately has no production persistence, real intake mutation, production customer route or Stage-4 activation.

The untracked sibling authority at `.worktrees/personal-plan-stage4-routine/plans/2026-08-07-personal-plan-stage4-routine-implementation.md` was read-only source evidence for immutable Routine versions, whole-proposal confirmation, pending attention and source-fingerprint semantics. Nick approved consolidation option 1 on 2026-08-08. This plan now retains the minimal Stage-4 backend prerequisite in the current worktree and supersedes the sibling plan's proposal to create `personal_plans`. There is no sibling commit, reviewed-head or cross-worktree implementation dependency; the sibling worktree and its untracked plan/mockup remain untouched.

The uncommitted deferred plan at `.worktrees/multi-product-owned-inventory/plans/2026-08-06-multi-product-owned-inventory.md` contains no implementation to transfer. Its proposal to widen legacy `user_product_usage` is superseded by this plan's explicit `user_products` ownership boundary; it remains an untouched historical planning artifact.

## 2. Chosen direction

Use one stable Personal Plan aggregate per user and apply one rule throughout the system:

> Version computed decisions; keep product identities reusable; mutate only drafts, current library state and the active-version pointer.

The production model has four boundaries:

1. `personal_plans` is the one stable living-plan identity for an authenticated user.
2. Stage 1/2 create immutable need snapshots; Stage 3 creates immutable product-portfolio snapshots.
3. `user_products` is a reusable owned-product library. It contains product identity and ownership state, never plan-specific role, frequency, fit verdict or user decision.
4. Stage-specific drafts are mutable and revisioned. Completion freezes a new immutable version. The consolidated minimal Stage-4 backend adds active/pending Routine pointers to this same plan root; no proposal changes the active routine until the user confirms the whole successor.

The existing `user_product_usage` table remains a legacy compatibility projection. Its one-row-per-user/category constraint makes it unsuitable as the source of truth for multi-product inventory or versioned plan decisions.

## 3. Confirmed architecture and product decisions

### Living plan and version lifecycle

- There is exactly one `personal_plans` row per user.
- A later reassessment or material source change creates successor versions under the same plan; it never creates a second user-facing plan. Rollout one accepts only the single qualifying paid quiz/artifact and does not invent a second-purchase flow.
- Purchase and source-artifact provenance remain attached to the need version that consumed them.
- Payloads in completed need, portfolio and routine versions are immutable.
- The stable plan row may update its current initial/refined need heads and its consolidated Stage-4 Routine/source revisions and pointers only through guarded database transitions.
- A later proposal is confirmed as one whole successor. The UI may highlight changed categories, but it cannot activate a mixture of version fragments.
- V1 has no plan picker, parallel plans, hard-delete UI or history-restore UI. A future restore creates a successor from an old version; it never reopens that version in place.

### Product-library boundary

- `user_products` stores products actually in the user's possession, including an in-hand product that is still awaiting Product Intake review.
- Planned recommendations and shopping-list items are not owned products. They enter `user_products` only after the user explicitly confirms acquisition.
- A catalog-search result does not create a user product until the user selects it and confirms ownership.
- Product identity may resolve from pending submission to an exact catalog product, but historical portfolio rendering uses its frozen identity snapshot rather than joining mutable current library data.
- Roles, actual and recommended frequency, criterion results, fit verdict, choice state and executable status live in the portfolio version.
- Direct library additions/removals update the library immediately and create or refresh a successor proposal. The active plan remains unchanged until confirmation.
- Owned products are archived, not hard-deleted, when referenced by any immutable plan version.

### Pending review, purchases and later changes

- A pending product is non-executable and never receives a confident fit verdict.
- Pending review is local: other categories continue and Stage 3 may complete with an explicit gap.
- When review resolves, the library identity is updated and a successor portfolio/routine proposal is generated. The active plan remains unchanged until the user confirms.
- Opening a purchase link is not acquisition. The recommendation remains on the shopping list.
- Once the user confirms that a planned product was bought, the system adds or links the owned product and generates a successor proposal; it does not replace the active product automatically.
- Stage 4 owns durable successor-request/proposal persistence, coalescing, retry and legacy projection because the first active routine and first proposal consumer exist there. The confirmed behavior remains mandatory: only one unconfirmed successor may be current, newer facts supersede the older proposal, and the active routine remains unchanged until whole-version confirmation.

### Rollout and category readiness

- The first production cohort is new eligible Personal Plan buyers only.
- Existing customers remain on the current journey until a separate migration plan is approved. No old plan is reconstructed from incomplete data.
- Every one of the ten Stage-1 categories must have a real Stage-3 capture, matching, pending-intake, verdict and honest-gap path before production activation.
- A genuine per-user `no suitable candidate` result is allowed and remains visible. An implementation-wide unsupported category is an activation blocker and may not be hidden or presented as a user-specific no-match.
- Stage 1–3 activation remains behind the global server-owned Personal Plan app flag. Rollout-one enrollment is recorded once by the qualifying purchase ID linked when the plan is created; no redundant single-value cohort column becomes a second authority. Live access remains independently governed on every request by the existing entitlement boundary: refund/reversal/dispute revokes access without deleting the plan or its history.

## 4. Data model

The model deliberately combines relational identity with immutable, schema-versioned `jsonb` snapshots. Important identities and lifecycle references retain foreign keys; nested rule evidence, explanations and typed computed output remain one atomic snapshot rather than becoming a table per criterion.

All new exposed tables:

- include an indexed `user_id` ownership column;
- enable RLS;
- grant owner reads only;
- reject direct client mutation of immutable rows;
- use server-owned, authenticated completion transitions;
- include database-level immutability and cross-owner guards because service-role access bypasses RLS.

All `user_id` columns in this model reference `public.profiles(id)`, matching `user_product_usage` and `product_submissions`. The UUID must equal the authenticated `auth.users.id`; the prepared-artifact owner is validated against that same UUID at the service boundary.

### `personal_plans`

Stable aggregate root:

- `id uuid primary key`;
- `user_id uuid not null unique`;
- `enrollment_purchase_source_id uuid null` as copied provenance without a foreign key; rollout-one creation requires the exact qualifying purchase, while a later approved migration may create a plan through a different controlled source without changing table shape. Purchase `paid_at` remains the enrollment timestamp authority, and refund/erasure never rewrites the copied source ID;
- `current_initial_need_version_id uuid null`;
- `current_refined_need_version_id uuid null`;
- `active_routine_version_id uuid null` and `pending_routine_proposal_id uuid null`, installed only after their referenced tables exist and both using `ON DELETE RESTRICT`;
- `revision bigint not null default 0` for Routine pointer/proposal compare-and-set;
- `source_revision bigint not null default 0` for same-transaction trusted-source invalidation;
- `last_evaluated_source_fingerprint text null` and `last_rejected_auto_fingerprint text null`;
- created/updated timestamps.

Only guarded server transitions may change current pointers or revisions. Purchases and prepared-result artifacts are sources for versions, not alternate plan identities.

### `personal_plan_need_versions`

Immutable Stage-1/2 snapshots:

- `id`, `user_id`, `personal_plan_id`;
- `kind = 'initial' | 'refined'`;
- `parent_need_version_id` — null for initial, required and initial-kind for refined;
- source `prepared_artifact_source_id uuid` as copied provenance without a foreign key, plus durable lead/purchase provenance supported by the existing entitlement boundary;
- `schema_version`, `computation_version`, `input_hash`;
- canonical validated `input_snapshot jsonb`;
- canonical computed `output_snapshot jsonb`;
- created timestamp;
- partial unique initial key `(personal_plan_id, input_hash) where kind = 'initial'`;
- partial unique refined key `(personal_plan_id, parent_need_version_id, input_hash) where kind = 'refined'`.

The hash preimage is canonical schema version + computation version + normalized `input_snapshot`; refined hashes additionally include `parent_need_version_id`. A refined retry therefore cannot reuse a version derived from another initial parent.

Every persisted snapshot is decoded through an explicit `(schema_version, computation_version)` registry. A version unknown to the running application returns typed `unsupported_snapshot_version`, leaves current pointers/drafts untouched and is operationally visible; it is never silently coerced through the newest decoder.

This replaces the ambiguous use of a generic `personal_plan_versions.scope = initial_need/refined_need`: these rows are need/assessment versions, not complete final plan versions. The stable plan pointers select the current working initial and refined need while active routine history retains its own exact source references.

### `personal_plan_refinement_drafts`

Mutable Stage-2 session:

- `id`, `user_id`, `personal_plan_id`, `base_initial_need_version_id`;
- answer/path `schema_version`;
- canonical validated answers and completed question IDs in bounded `jsonb`/array fields;
- `revision bigint` for optimistic concurrency;
- `status = 'in_progress' | 'complete' | 'stale'`, preserving the shipped Stage-2 contract;
- `result_refined_need_version_id uuid null`, set only on successful completion; multiple completed drafts may point to the same idempotently reused immutable version;
- timestamps;
- one `in_progress` draft per plan/base initial version; completed and stale drafts do not occupy the editable slot.

Saving a parent answer prunes invalid descendants. Completion revalidates the whole authoritative path, inserts or reuses the refined version on `(personal_plan_id, parent_need_version_id, input_hash) where kind = 'refined'`, and records that exact ID on the completing draft and plan pointer in the same transaction. Re-editing Stage 2 creates a new in-progress draft against the same initial version; an identical recomputation may intentionally point to the same immutable refined version, while changed input creates a successor. The prior completed draft remains historical and its unfinished Stage-3 descendant becomes stale. A successor initial need marks any unfinished refinement draft stale. The production Stage-2 contract intentionally widens the fixture union with `stale`, and load creates a fresh draft while completed versions remain historical. This table is post-payment need refinement; existing `personal_plan_quiz_drafts` remains the pre-payment quiz-resume store and is never reused here.

### `user_products`

Reusable current owned-product library:

- `id`, `user_id`, `category text not null references public.product_categories(key) on delete restrict`;
- `catalog_product_id uuid null`;
- frozen user-entered `brand_text` and `product_name_text` fallback;
- `identity_status = 'matched' | 'pending_review' | 'needs_more_info' | 'text_only'`;
- `ownership_status = 'owned' | 'archived'`;
- intake source and timestamps;
- checks that identity-status/link combinations are valid;
- `unique (id, user_id, category)` for owner/category-consistent composite foreign keys;
- dedupe constraints that prevent duplicate live ownership records for the same exact catalog product without forbidding multiple distinct products in one category.

This table carries neither frequency nor semantic role. `product_submissions.user_product_id` is the single intake association direction; Product Intake approval resolves the same stable row rather than creating a mutual back-pointer or replacing historical plan references.

### `personal_plan_product_drafts`

Mutable Stage-3 session:

- `id`, `user_id`, `personal_plan_id`, `refined_need_version_id`;
- contract and category-authority versions;
- `revision bigint`, pass/cursor and canonical bounded draft payload;
- `status = 'active' | 'completed' | 'stale'`, matching the shipped `Stage3DraftStatus` contract;
- timestamps;
- one non-stale draft per refined need version.

Captured products reference `user_products`. Planned recommendations reference exact catalog identities without becoming owned inventory. Editing Stage 2 creates a new refined need version and marks the entire unfinished Stage-3 draft stale; no field-level transplant occurs.

### `personal_plan_portfolio_versions`

Immutable Stage-3 completion header:

- `id`, `user_id`, `personal_plan_id`, `refined_need_version_id`;
- source product draft ID and source revision;
- `schema_version`, category-authority version map and `content_hash`;
- canonical bounded `snapshot jsonb` matching `ProposedProductPortfolio`, with database constraint `octet_length(snapshot::text) <= 524288`;
- created timestamp;
- unique source product draft ID and unique `(personal_plan_id, refined_need_version_id, content_hash)`.

The snapshot includes validated stable user-product/catalog IDs, category resolutions, owned products, planned purchases, pending products and uncovered roles. Pending, planned, inactive, unassigned and uncovered entries are never executable. Rollout one deliberately does not add a second portfolio-item index table: Stage 4 loads the version atomically by ID, pending resolution keys from `product_submissions.user_product_id`, and owned products are archive-only. Add a relational item index later only for a measured query or integrity need. Structural runtime schemas remain bounded; the named database constraint is the single byte-size authority. Its violation maps to typed internal `snapshot_too_large`, preserves the draft for retry, and blocks activation until the contract/cap mismatch is corrected; users are never asked to remove valid plan data.

### Consolidated minimal Stage-4 backend

This plan owns only the Stage-4 persistence and transition boundary required to make Stage-3 completion real. Full Routine compilation UX, editor/detail surfaces, attention-dot UI, source-reconciliation worker and Stage-5 rendering remain outside this prerequisite. The production Stage-3 composition root supplies a server-compiled candidate through a typed compiler port; SQL never invents Routine semantics. Until that compiler is integrated, only deterministic tests/dev seams may supply a candidate and the global feature flag remains off.

#### `personal_plan_routine_versions`

Immutable candidate/active Routine snapshots:

- `id`, `user_id`, `personal_plan_id`, nullable `parent_routine_version_id`;
- `source_refined_need_version_id`, `source_portfolio_version_id`, `source_product_draft_id` and `source_product_draft_revision`;
- `schema_version`, `compiler_version`, bounded `authority_versions jsonb`;
- `source_fingerprint`, `payload_hash`, canonical bounded `payload jsonb` and created timestamp;
- owner/plan-consistent composite foreign keys with `ON DELETE RESTRICT`;
- unique `(personal_plan_id, source_portfolio_version_id, payload_hash)` so lost-response retries reuse the same immutable candidate;
- database immutability trigger rejecting update/delete for every role, including service role.

The semantic hash excludes generated `id`/`createdAt`; the SQL transition injects those storage identities into the stored canonical payload after recomputing the hash from the bounded semantic payload supplied by the trusted server compiler.

#### `personal_plan_routine_proposals`

Whole-version proposal lifecycle:

- `id`, `user_id`, `personal_plan_id`, nullable `base_routine_version_id`, required `candidate_routine_version_id`;
- `origin = 'stage3_completion' | 'editor' | 'source_sync' | 'acquisition' | 'product_review'`;
- `status = 'pending' | 'accepted' | 'rejected' | 'superseded'`;
- `source_revision`, `source_fingerprint`, `proposal_fingerprint`, bounded canonical `delta jsonb`, `direct_operation_keys text[]` and timestamps;
- owner/plan-consistent `RESTRICT` foreign keys;
- one pending proposal per plan and an idempotent initial-proposal key for the same plan/candidate/fingerprint.

Initial Stage-3 completion always uses `base_routine_version_id = null`, updates only `pending_routine_proposal_id`, and never updates `active_routine_version_id`. A separate guarded whole-proposal confirmation is the only transition that can move the active pointer.

#### `personal_plan_routine_source_change_outbox`

Durable coalesced successor work:

- `id`, `user_id`, `personal_plan_id`, `source_kind`, `source_key` and unique `(personal_plan_id, source_kind, source_key)`;
- monotonically increasing `observed_revision` and `processed_revision` with `0 <= processed_revision <= observed_revision`;
- `status = 'pending' | 'processing'`, `available_at`, `attempt_count`, lease fields, `last_error_code`, first/last-observed and processed timestamps;
- owner reads for diagnostics, no client mutation, and service-only enqueue/claim/finish transitions.

`personal_plan_enqueue_routine_source_change` runs in the source-fact transaction. It increments the plan's `source_revision`, inserts or bumps the one coalesced row, and never changes either Routine pointer. A source arriving while the row is processing only advances `observed_revision`; the finisher returns it to `pending` when its claimed revision is behind, otherwise records `processed_revision`. The initial producer set is Stage-2/3 guarded completion, direct `user_products` create/update/archive, acquisition, and every Product Intake transition that changes the linked `user_products` identity/status. Product/spec lifecycle triggers may call the same helper when their exact plan-reference lookup lands; polling timestamps and TypeScript compensation are not accepted producers.

### Existing `product_submissions` extension

- add nullable `user_product_id` with an owner/category-consistent foreign key;
- retain the existing `user_product_usage_id` relation for legacy onboarding/chat callers;
- widen the database/type source vocabulary with `personal_plan` and require exactly one association path (`user_product_usage_id` xor `user_product_id`) for newly created associated submissions;
- keep `frequency_range` required: Stage-3 capture supplies the user's exact-product frequency even though reusable `user_products` deliberately does not store frequency;
- add a parallel partial unique index allowing at most one open submission per `user_product_id` for `pending_review | researching | ready_for_review | needs_more_info`;
- require new Personal Plan Stage-3 intake to use `user_product_id` and never consume or replace the legacy one-per-category slot;
- update all four Product Intake review transition functions and all four existing integrity triggers (`validate_product_submission_foundation`, `validate_user_product_usage_submission_link`, `protect_user_product_usage_review_fields`, `validate_product_submission_status_link`) plus the new user-product protection/link trigger so approval, match, more-info and rejection preserve a valid association on either path;
- allow approval/match to resolve the linked `user_products` row without rewriting historical portfolio versions; the Stage-4 proposal service later consumes that source change.

### Legacy compatibility

- Do not remove or widen `user_product_usage` during the first production foundation.
- Stage 4 owns any confirmed-routine projection of the one compatible primary category usage required by legacy consumers.
- `scalp_care` has no legacy category representation and is never projected into `user_product_usage`; its canonical Personal Plan state remains available through new read models only.
- Multiple products, pending identity, portfolio roles and plan history remain authoritative only in the new model.
- Add parity/consumer tests before any later legacy-table removal.

## 5. Transaction and concurrency boundaries

### Stage 1 compute/resume

1. Authenticate and validate new-buyer cohort plus current entitlement, then resolve the owned prepared artifact.
2. Normalize and compute Stage 1 before opening the write transaction.
3. The guarded transition does `INSERT ... ON CONFLICT (user_id) DO NOTHING`, then locks the one `personal_plans` row with `SELECT ... FOR UPDATE` and verifies its immutable enrollment provenance.
4. In that same transaction, insert/reuse the immutable initial need by input hash and update `current_initial_need_version_id` only if the source is still current.
5. A retry or concurrent first request returns the same plan and need version.

### Stage 2 save/complete

- PATCH requires `expectedRevision`; stale writes return `409 revision_conflict` with the reloadable canonical state.
- Completion locks the draft and plan, recomputes the complete question path, inserts/reuses the refined need version and updates the current refined pointer before marking the draft completed.
- Any failure rolls back every completion effect.

### Stage 3 save/complete

- Every mutation requires `expectedRevision` and server-side path validation.
- Search candidates enter neither inventory nor draft until explicit selection.
- Fallback intake creates/links a stable `user_products` row plus the existing private Product Intake submission, without consuming the legacy one-per-category slot.
- Completion is one Stage-4-owned `SECURITY DEFINER` database function. It locks the draft/plan/referenced identities, revalidates ownership and expected revision, inserts the immutable portfolio version plus candidate Routine version/proposal, and marks the product draft completed before committing. Any error rolls back the whole SQL transaction.
- This foundation owns the canonical portfolio payload and the typed `RoutineProposalStager` RPC signature/return contract. The TypeScript adapter performs exactly one RPC call; it never inserts the portfolio first, opens a client-side transaction or attempts compensating deletion of immutable rows.
- The production `/complete` composition root remains unavailable until a real server compiler supplies the bounded candidate payload. A fixture/test compiler may prove contract/idempotency behavior, but it is never selected in production. This removes the circular dependency without allowing a portfolio-only completion state.

The frozen write boundary is the service-only function
`personal_plan_complete_product_draft_and_stage_routine(p_user_id uuid, p_personal_plan_id uuid, p_product_draft_id uuid, p_expected_draft_revision bigint, p_portfolio_schema_version integer, p_portfolio_snapshot jsonb, p_routine_schema_version integer, p_routine_compiler_version text, p_routine_authority_versions jsonb, p_routine_source_fingerprint text, p_routine_payload jsonb, p_proposal_delta jsonb) returns jsonb`.

The authenticated route derives `p_user_id`; the function is revoked from `PUBLIC`, `anon` and `authenticated`, granted only to `service_role`, fixes an empty `search_path`, schema-qualifies every relation, locks the owner plan/draft and revalidates every supplied source/reference. This service-only boundary is required because the caller supplies the server-compiled candidate payload; a browser must not be able to forge deterministic Routine output. SQL computes the portfolio/routine/proposal hashes, generates storage IDs, inserts or reuses all three immutable records, completes the draft and advances only the pending pointer/revision.

Stable outcomes are:

- `completed` or `already_completed`, each returning `portfolioVersionId`, `routineVersionId`, `routineProposalId` and the new plan `revision`;
- `revision_conflict` with `currentRevision`;
- `stale_source` with `currentRefinedNeedVersionId`;
- `invalid_source` with a bounded structural `reasonCode`;
- `snapshot_too_large`.

Transport/database unavailability is mapped by the TypeScript adapter to `temporarily_unavailable`; it is not persisted as an SQL outcome. A replay after a lost response returns the same three IDs.

### Successor proposals

The consolidated Stage-4 backend owns durable successor requests after the initial proposal exists. It consumes library mutations and Product Intake resolution as source changes, while a later compiler/worker recomputes from validated current facts, supersedes older unconfirmed proposals and preserves the active version until whole-version confirmation. Stages 1–3 expose stable user-product and immutable portfolio references without rewriting history.

The separate service-only confirmation function is
`personal_plan_confirm_routine_proposal(p_user_id uuid, p_personal_plan_id uuid, p_proposal_id uuid, p_expected_revision bigint) returns jsonb`.
It locks the plan/proposal, requires the proposal to be the current pending proposal, verifies its base still equals the active version and its stored `source_revision` still equals the plan's current `source_revision`, then atomically marks it accepted, moves `active_routine_version_id`, clears the pending pointer and increments `revision`. Stable outcomes are `accepted`, `already_accepted`, `revision_conflict`, `stale_proposal`, `stale_source` and `invalid_source`. No other function may activate a Routine.

Task 0 is therefore complete inside this authority. The obsolete sibling `personal_plans` ownership and sibling commit/review stop gate are superseded; this worktree owns the root, Routine backend and outbox. Production entry still remains inert behind the disabled global flag until the server compiler and complete authorized Stage-1–3 composition are verified.

## 6. Server API and security boundary

Production routes remain under protected `/api/personal-plan/**` and customer pages under `/plan-start/**`.

- `GET|POST /api/personal-plan/stage-1` — load/create current initial need.
- `GET|PATCH /api/personal-plan/stage-2` — resume/save refinement draft.
- `POST /api/personal-plan/stage-2/complete` — freeze refined need.
- `GET|PATCH /api/personal-plan/stage-3` — resume/mutate product draft.
- `GET /api/personal-plan/stage-3/search` — authenticated bounded catalog search.
- `POST /api/personal-plan/stage-3/intake` — existing manual/photo intake through the new user-product association.
- `POST /api/personal-plan/stage-3/complete` — atomic portfolio + Stage-4 proposal handoff.
- later library endpoints operate on `user_products`; Stage 4 consumes those source changes and never edits portfolio versions.

Every route:

- derives `user_id` from the authenticated server session;
- checks entitlement, cohort and feature flag before protected data loading;
- accepts only opaque IDs and validates ownership again in the database transition;
- returns typed product-safe errors rather than database messages or full private snapshots;
- applies explicit per-user limits through `src/lib/rate-limit.ts::checkRateLimit` to Stage-3 search, intake and mutation routes. A genuine denied bucket returns `429` and computes conservative `Retry-After` from that route's configured `windowMs`; helper error `service_unavailable` returns typed `503` with no `Retry-After`;
- never exposes service-role credentials to the browser.

RLS supplies owner reads and defense in depth. Completion functions use explicit grants, fixed search paths, internal authorization checks and the narrowest privileges needed. Immutable tables reject update/delete even when application code is wrong.

## 7. Scope and non-goals

### In scope

- production schema, RLS, immutability, indexes and local database-contract tests;
- stable one-plan identity and new-buyer cohort enrollment derived from a qualifying paid one-time purchase;
- Stage-1 immutable need persistence;
- Stage-2 revisioned draft and refined-need completion;
- multi-product owned library and Stage-3 draft/portfolio persistence;
- separate owned-product catalog search and authority-filtered recommendation selection, plus existing Product Intake association without legacy-slot conflicts;
- all-ten-category runtime readiness gates;
- atomic Stage-3 completion → Stage-4 proposal port;
- protected production APIs and signed-off Stage 1–3 UI wiring;
- observability, rollback and integrated verification.

### Non-goals

- changing category policy or deterministic recommendation rules;
- redesigning the signed-off Stage 1, 2 or 3 experience;
- implementing Stage-4 routine compilation/UI or Stage-5 application pages inside this plan;
- migrating existing customers in the first rollout;
- rebuilding the legacy chat recommendation engine;
- automatic plan changes after purchase, pending resolution or direct library edits;
- generic event sourcing or fully relational criterion/evidence tables;
- removing `user_product_usage` in this release;
- a self-service Personal Plan history deletion/redaction UI. Before activation, the existing account-erasure path must be extended and database-tested against every new Personal Plan table; the product cannot claim account erasure coverage until that gate passes;
- push, PR, merge, deploy, feature-flag activation or production data writes without separate authorization.

## 8. Target map

### Persistence and database

- four uniquely generated Supabase migrations under `supabase/migrations/`, in this fixed dependency order:
  1. `personal_plan_stage1_3_foundation` — the six Stage-1–3 tables, current-need pointer FKs, RLS, immutability and Stage-1/2/draft compare-and-set primitives;
  2. `personal_plan_routine_backend` — immutable Routine versions, proposals, source-change outbox, active/pending pointer FKs, source/revision fields, enqueue/claim/finish, atomic completion and separate confirmation functions;
  3. `personal_plan_product_intake_user_products` — `product_submissions.user_product_id`, user-product-native intake functions, reconciled integrity/review transitions and same-transaction outbox producers;
  4. `personal_plan_category_readiness` — additive Heat Protectant/Scalp Care category rows, structured spec/protocol tables, grants/RLS and the Product Intake approval dispatcher required to write those schemas. This migration contains no catalog-product/spec backfill, legacy-row reconciliation or other production-data enrichment;
- new pgTAP/database contract under `supabase/tests/`;
- generated/local database types only to the repository's chosen narrow convention; no unrelated repo-wide type churn;
- extend the existing Product Intake review functions and every relevant integrity trigger with the parallel `user_product_id` association and resolution seam.

### Domain and persistence adapters

- `src/lib/personal-plan/persistence/` — plan/need repositories, hash/idempotency and typed row adapters;
- `src/lib/personal-plan/refinement/` — production gateway implementing the existing Stage-2 port;
- `src/lib/personal-plan/products/gateway.ts` — extract the integration-neutral `Stage3ProductsGateway`; the fixture and production gateways implement this same interface;
- `src/lib/personal-plan/products/` — inventory, distinct owned-search/recommendation selectors, intake adapters, portfolio persistence payload and completion coordinator;
- `src/lib/personal-plan/routine-proposal-stager.ts` — narrow atomic handoff interface consumed by Stage 3 and implemented against the consolidated migration-two RPC;
- explicit legacy `user_product_usage` projection adapter kept outside the canonical domain.

### Routes and UI wiring

- protected pages under `src/app/plan-start/` with newly implemented Stage-1 Basis/Optional/category-card/unavailable components built from the reviewed HTML; Stage-2/3 reuse their existing reviewed components through production adapters;
- protected APIs under `src/app/api/personal-plan/`;
- `src/lib/auth/route-classification.ts` and `src/lib/supabase/middleware.ts` for protected/subscription-required prefixes without triggering legacy onboarding redirects too early;
- `src/lib/personal-plan/release.ts` — new server-only `isPersonalPlanAppV1Enabled()` and `getPersonalPlanNewBuyerCohortCutoff()` readers;
- retain the Labs routes and their fixture adapters as development/CI contract harnesses; they are currently imported by Node and Playwright suites and are not optional in this release.

### Tests and operational checks

- existing `tests/personal-plan/**`, Stage-2 and Stage-3 contract suites;
- `scripts/test-personal-plan-db.sh`, package script `test:personal-plan-db`, `supabase/tests/personal_plan_stage1_3_foundation.sql`, and `.github/workflows/ci.yml` job `personal-plan-db-contract`;
- new production gateway/API/security tests, including protected + subscription-required route classification;
- new Playwright journey for `/plan-start` from new-buyer entry through Stage-3 handoff;
- CI database-contract job using the repository's local Supabase harness;
- pre-activation catalog/protocol readiness audit for all ten categories.

## 9. Designed user journey

This production foundation does not change the already approved visible journey. It makes the same journey durable and safe.

1. A newly eligible Personal Plan buyer finishes payment and opens the protected plan entry.
2. The server creates or resumes the user's one living plan and immutable quiz-only initial need version.
3. The user sees the signed-off Stage-1 Basis page and, when applicable, Optional page. Refresh/back/reopen restores the same snapshot.
4. The transition explains that the initial plan is now being made personal. Stage 2 asks only the relevant follow-up questions, saving each answer. Network failure offers retry; a concurrent edit reloads the canonical newer draft rather than overwriting it.
5. Completing Stage 2 freezes the refined need and opens Stage 3. Returning to and changing Stage 2 later makes an unfinished Stage-3 draft stale and restarts product work against the successor refined need.
6. Stage 3 captures exact owned products category by category. The user may select catalog products, submit an unknown product for review, enter multiple products where allowed, or state that a role is uncovered.
7. Stage 3 explains fit and asks for explicit keep/override/plan decisions. Pending review affects only its product; individual no-candidate cases remain honest visible gaps.
8. Completion freezes one portfolio and creates the Stage-4 proposal atomically. Nothing has changed the active routine yet.
9. Stage 4, implemented by its owning workstream, presents the whole routine proposal. Only explicit confirmation makes it active.
10. Later pending resolution, confirmed purchase or direct library edit saves the source change and offers one successor plan. The previous active plan remains usable until the whole successor is confirmed.

Recovery and variants:

- unauthenticated users follow the existing sign-in boundary; unentitled users follow the existing access boundary; authenticated non-cohort/flag-off requests to `/plan-start` render the proposed compact unavailable/error-card treatment in place with `Zum Profil` and `Support` actions, while APIs return typed `404 personal_plan_not_available`. They never redirect through `/chat`, `/routine`, legacy onboarding or quiz;
- paid but not yet generated/delivered one-time purchases retain the existing middleware behavior: pages go to `/plan-bereit`, APIs return `409 activation_pending`; an access-check failure retains the existing `/reactivate?reason=access_check_unavailable` or typed `503` behavior;
- disabling the flag mid-journey makes routes unavailable as above but preserves every version/draft; re-enabling resumes the same state. Atomic Stage-3 completion means no frozen portfolio can exist without its Stage-4 proposal;
- temporary compute/database failures preserve the last durable version/draft and provide retry;
- stale revision reloads canonical progress;
- a stale Stage-2 draft caused by a successor initial need is replaced by a fresh draft; stale answers remain historical and are not shown as current;
- all ten category adapters must be operational, but a specific user may receive an honest uncovered role;
- pending images/research retain existing private storage and retention controls;
- existing customers remain on the legacy journey in rollout one.

Completion is reached when Stage 3 has frozen the portfolio and the Stage-4 proposal ID exists. Activation remains a separate explicit Stage-4 confirmation.

## 10. Planning evidence

No new journey layout is required for this persistence/integration plan. The signed-off Stage 1–3 layouts and existing `/plan-bereit`, profile, support, sign-in and access surfaces are reused unchanged. The proposed compact Stage-1 unavailable treatment is now recorded as mockup state H and requires Nick's review together with Section 9's newly concrete routing/recovery behavior—paid-pending, non-cohort, flag-off, revision conflict and stale-draft handling.

Evidence review status:

- Stage-1 mockup: confirmed by Nick on 2026-08-07;
- Stage-2 mockup and final journey: confirmed in its owning plan;
- Stage-3 mockup and final journey: confirmed in its owning plan;
- integrated fixture preview at `/labs/personal-plan-stage-1-2`: reviewed during integration;
- compact unavailable state H and the production integration journey in Section 9: confirmed by Nick on 2026-08-08.

## 11. Ordered implementation tasks

Task 0 is an orchestrator-owned authority reconciliation and was completed by the approved consolidation recorded below before migrations. Tasks 1/1B froze the shared role/contracts. Category readiness remains an activation prerequisite, but this implementation stays in one authorized worktree: disjoint workers may own files, not sibling plan roots. Task 8's real Scalp Care database fixture still waits for a canonical `scalp_care` category row; Task 9 and the production composition root require all ten authorities to be present.

| Lane | Owned tasks | Landing rule |
|---|---|---|
| Current authorized worktree (`codex/personal-plan-stage1-2-integration`) | 0–11 plus the consolidated minimal Stage-4 backend | One aggregate root and plan authority; no sibling commit or review prerequisite. |
| Database schema worker | generated migrations only | Starts after Task-0 contract freeze; main session integrates and verifies. |
| Database harness worker | pgTAP/script/package/CI files only | May run beside schema implementation against the frozen contract. |
| Application-contract worker | typed adapters/repositories and focused tests only | No migration or shared plan edits. |
| Final integration | composition, full diff, ready-check and request-code-review | Main session only; global flag remains off. |

### Task 0 — Reconcile the Stage-4 owner and atomic SQL boundary

**Owner:** main orchestrator; completed in this plan before migration/runtime edits.

**Consumes:** this foundation, Nick's consolidation-option-1 approval and read-only sibling Stage-4 plan/mockup evidence.

**Produces:** this single reconciled plan authority and one frozen completion/outbox contract.

- Supersede the sibling plan's competing `personal_plans` creation; do not edit or depend on its untracked files.
- Extend this foundation's one root with the exact pointers/revisions in Section 4 and own `personal_plan_routine_versions`, `personal_plan_routine_proposals` and `personal_plan_routine_source_change_outbox` here.
- Freeze the service-only atomic completion and separate confirmation signatures/outcomes in Section 5.
- Freeze same-transaction source-change enqueue/coalescing and the migration order in Sections 4/8.
- Remove the sibling commit/review/head dependency. The current worktree, plan and final exact-tree review are the only implementation authority.

**Complete:** 2026-08-08. This plan now describes one root, non-overlapping table ownership, one SQL completion transaction, a separate activation transaction and the durable successor outbox, with no cross-worktree or TypeScript pseudo-transaction.

### Task 1 — Freeze production contracts and persistence seams

**Consumes:** current Stage-1 snapshot, Stage-2 session/handoff, Stage-3 `Stage3EntryContext`, `Stage3ProductDraft` and `ProposedProductPortfolio` contracts.

**Produces:** canonical database row schemas, Zod/runtime adapters, `RoutineProposalStager` interface, version/hash rules and a table-driven persistence contract suite.

**Precondition already repaired during planning:** the stale literal expectation in `tests/ci-workflow-orchestration.test.ts` now matches the three-spec Stage-3 Playwright command and its focused five-test run passes. Re-run it at implementation start and stop if baseline has drifted red.

- Rename the persistence-level generic Stage-1/2 version concept to `NeedVersion`; do not rename approved user-facing stage/domain terminology.
- Introduce `hashPersonalPlanNeedVersionInput`; do not reuse the quiz-envelope-only `hashSupportedPersonalPlanQuizEnvelope`. The need-version hash includes schema/computation and parent context as defined in Section 4.
- Add explicit snapshot decoder registries keyed by schema/computation version; unknown versions map to `unsupported_snapshot_version` and never fall through to the newest schema.
- Define the reusable `UserProduct` identity contract independently from portfolio decisions.
- Extract `Stage3ProductsGateway` from the fixture-specific module; both fixture and production adapters implement load/create, search, mutate, invalidate and complete through that neutral interface.
- Preserve Stage-3 `requestToken` end to end: the stateless server echoes it unchanged and the client applies a result only when it still equals the latest issued token. The production server does not pretend to maintain cross-request ordering state.
- Reconcile Stage-3 draft status to the shipped `active | stale | completed` vocabulary and choose `personal_plan_portfolio_versions` as the single persistence name.
- Define exact draft mutation/completion outcomes including revision conflict, stale source, idempotent completion and temporarily unavailable.
- Extend `Stage2RefinementErrorCode` and the Stage-3 gateway error contract with the exact typed unavailable/snapshot outcomes used by the protected APIs; no route invents an untyped error outside the shared unions.
- Cite the existing migration guard that requires legacy `(user_id, category)` uniqueness; do not duplicate it with a new test or widen that table.

**Complete when:** every field crossing Stage 1 → 2 → 3 → 4 has one owner and test fixture; no persistence adapter imports fixture IDs or hardcoded catalog assumptions.

### Task 1B — Replace fixture role authorities with the canonical category-role contract

**Consumes:** refined `InitialNeedPlanSnapshot`, canonical `PlanProductRole`, the ten category decision authorities and current Stage-3 fixture contracts.

**Produces:** one production role vocabulary and versioned category-role registry used by both fixture and production Stage-3 entry.

- Make `PlanProductRole` the canonical Stage-3 semantic-role type. Retire the parallel generic `Stage3SemanticRole` vocabulary (`category_primary`, `category_coverage`, fixture scalp/heat aliases) from persisted contracts; shampoo primary/secondary remains a frequency-derived assignment, not a substitute semantic job.
- Build `Stage3CategoryRequirement.requiredRoles` from each refined `PlanCategoryDecision.roles`, validated against a production `CATEGORY_ROLE_POLICIES` registry. The registry defines allowed roles/multiplicity and explicit non-fixture authority versions; it never supplies the user's required roles.
- Replace `CATEGORY_AUTHORITY_STUBS` in `stage2-entry-adapter.ts`, state-machine fallbacks and portfolio provenance. Fixture catalog availability stays an injected fixture concern and no `stage3.fixture.*` version may enter a production payload.
- Port all ten category schemas/consumers/tests. Scalp Care carries `scalp_comfort | scalp_flake_oil_adjunct | density_claim_tonic | scalp_exfoliant`; Heat Protectant carries `pre_heat_protection` plus its qualifying-route metadata; Oil carries only its three confirmed fibre roles, never the excluded scalp-oil role.
- Make search ordering uniformly client-owned: fixture and production gateways always echo the token, `stage3-products-flow.tsx` discards any response whose token differs from `searchToken.current`, and remove the `ignored` response variant plus the fixture's `highestSearchRequestToken` memory.

**Complete when:** table-driven fixtures prove each emitted Stage-1 role is accepted by exactly its category, absent/not-needed roles are never invented, authority versions are production values, Scalp/Heat/Oil roles match their signed authorities, and fixture/production gateway conformance no longer depends on server memory.

### Task 2A — Add schema, RLS and immutable storage

**Consumes:** Task-1/1B contracts and current prepared-artifact/Product Intake schema.

**Produces:** generated migration and typed storage primitives.

- Create the migration with the Supabase CLI after checking the current migration head.
- Add the six Stage-1–3 production tables in migration one with necessary composite foreign keys/indexes, owner RLS and immutable guards. Add the three consolidated Routine backend tables/pointers/functions in migration two. Task 8 owns migration three for Product Intake so no half-integrated association can exist. The approved Task-5/6 schema amendment owns migration four and remains strictly additive/data-free.
- Store `prepared_artifact_source_id` without a foreign key so the existing superseded-artifact purge cannot mutate immutable need history or fail on `RESTRICT`; the copied input snapshot remains the durable evidence.
- Choose guarded current-need pointers under a `personal_plans FOR UPDATE` lock rather than mutable `is_current/status` flags on immutable need rows. Database functions are the only pointer writers; FK, owner and concurrency tests prove no dangling/cross-plan/racing head can be installed.
- Prove cross-user reads/writes, direct immutable updates/deletes and forged child ownership fail.

**Complete when:** migration diff/list checks are clean, generated/local types agree, and a fresh local reset creates the owner-scoped immutable schema without warnings.

### Task 2B — Add the database and Personal Plan CI harness

**Consumes:** Task-2A migration and existing test scripts/workflow.

**Produces:** one runnable local DB contract command and CI coverage for every Personal Plan suite.

- Add `scripts/test-personal-plan-db.sh`, package script `test:personal-plan-db`, `supabase/tests/personal_plan_stage1_3_foundation.sql`, and CI job `personal-plan-db-contract`. The script owns local start/reset, `npm exec -- supabase test db ... --local`, result propagation and safe local cleanup.
- Scope the Docker-backed CI job to migrations, Supabase tests, Personal Plan persistence or Product Intake contract changes, with a 15-minute timeout and recorded runtime; it is not a nightly-only substitute for migration PR verification.
- This is the repository's first active pgTAP CI harness; run the existing `supabase/tests/waitlist_signup_outbox.sql` in the same Supabase test command rather than leaving it orphaned, and keep Personal Plan failures attributable by test file.
- Update `test:personal-plan` to discover root tests plus each named nested directory used by this implementation, and include `npm run test:personal-plan` in `test:contracts`; prove the CI workflow test expects both commands.
- Update the literal workflow assertions in `tests/ci-workflow-orchestration.test.ts` alongside `.github/workflows/ci.yml`; do not treat its expected failure as unrelated CI churn.
- Make recursive `tests/personal-plan/**/*.test.ts` discovery the canonical runner input, append the reviewed legacy root suites explicitly, and add a sentinel that compares every repository test filename matching `personal-plan*.test.ts` with the runner's resolved set. A newly named Personal Plan persistence/API suite therefore fails CI when omitted instead of relying on reviewer memory.

**Complete when:** the local DB command passes from a fresh reset and CI demonstrably executes both the existing category suites and the new persistence/API contracts.

### Task 2C — Add guarded completion and compare-and-set transitions

**Consumes:** Task-1 runtime contracts and Task-2A tables.

**Produces:** idempotent Stage-1/2 completion and Stage-3 draft/portfolio primitives.

- Implement functions with fixed search paths, explicit grants and ownership checks. The consolidated initial proposal transaction is exercised through Task 9's `RoutineProposalStager` contract and the real migration-two function.
- Every draft mutation performs one atomic compare-and-set (`UPDATE ... WHERE id = p_id AND revision = p_expected_revision`) and returns the new row/revision; zero updated rows map to typed `revision_conflict`. Never use read-then-write concurrency checks.
- Enforce structural limits in runtime schemas and one database byte cap using `octet_length(snapshot::text) <= 524288`; map the named constraint to the typed `snapshot_too_large` preservation path rather than duplicating a subtly different client byte calculation.
- Exercise the exact `octet_length(snapshot::text)` boundary in pgTAP at 524288 bytes and one byte above; the API contract proves the rejected completion preserves the editable draft.

**Complete when:** pgTAP/API contracts prove idempotent retry, stale-revision rejection, concurrent completion, guarded heads, immutable rows and atomic rollback.

### Task 3 — Persist Stage 1 and enroll only new buyers

**Consumes:** paid prepared artifact, access/entitlement boundary, Stage-1 compute and Task-2 plan/need repository.

**Produces:** protected Stage-1 production API, purchase-enrolled rollout-one plan and resumable initial need snapshot.

- Add `src/lib/personal-plan/release.ts` with `PERSONAL_PLAN_APP_V1_ENABLED` and an explicit new-buyer cutoff reader.
- Before implementation begins, run a read-only aggregate audit of qualifying `personal_plan_once` purchases and fulfillment states so the cohort predicate is grounded in current production shape; no customer rows or identifiers enter the plan artifact.
- Replace the production `PERSONAL_PLAN_STAGE3_ENABLED` helper with this one global app gate and retarget—not delete—`tests/personal-plan-stage3-release.test.ts`: keep its `isPersonalPlanStage3LabEnabled` coverage and replace only the retired production-flag assertions. Labs keep their separate CI/dev-only access switch. No production route evaluates two Personal Plan rollout flags.
- Enroll only a `billing_one_time_purchases` row with `product_kind = 'personal_plan_once'`, `status = 'paid'`, `paid_at >= cutoff`, and the existing active one-time fulfillment/confirmation state. Persist its ID as enrollment provenance. Subscription access, manual grants and older paid rows do not create a rollout-one plan.
- After enrollment, use the existing live entitlement state on every protected request. Refund/reversal/dispute follows the existing unentitled redirect/API response while preserving the dormant plan for audit/recovery; enrollment provenance is not rewritten.
- Read ISO-8601 UTC cutoff from required server environment variable `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF`; missing, unparsable or non-UTC values fail closed and create no plan.
- Copy the validated attached paid artifact into the immutable need snapshot before a later legitimate source supersession; attached artifacts are not treated as expiry-purged.
- Classify `/plan-start/**` and `/api/personal-plan/**` as protected and subscription/access-required without adding them to the legacy post-onboarding redirect class.
- Keep the existing production path unchanged when disabled or ineligible.
- Render the compact in-place unavailable state for authenticated page requests that are disabled or outside rollout-one enrollment; return typed `404 personal_plan_not_available` from APIs and write nothing. Add middleware/browser proof that neither path hops into legacy quiz/onboarding.
- Build the missing production Stage-1 UI from `plans/mockups/2026-08-06-personal-plan-stage1-density-states.html`: Basis page, conditional Optional page, fold-up category card, paused state, transition, load/retry state and newly added H unavailable state. There is no existing Stage-1 production component to reuse.
- Implement the previously stubbed read-only packshot selector behind the frozen Stage-1 preview boundary. It may return only a verified, eligible, current best candidate from the planned-recommendation selector; it never changes need/category tier. When no valid image-backed candidate exists, the card uses its reviewed text-first layout and does not invent an icon or unverified product.

**Complete when:** route-classification/middleware, auth, exact purchase-cohort, artifact, idempotency, Stage-1 component and browser refresh/resume tests prove the same initial version returns; Basis/Optional/no-preview/unavailable states match the reviewed artifact, while subscription/manual-grant/old-purchase and flag-off fixtures create no plan data.

### Task 4 — Replace the Stage-2 fixture gateway with revisioned persistence

**Consumes:** initial need version and existing Stage-2 gateway port.

**Produces:** real GET/PATCH/complete routes and current refined need pointer.

- Preserve question-path pruning, explicit empty arrays, save retry and revision-conflict behavior.
- Validate every submitted answer against the current authoritative question.
- Complete only from the fully recomputed path; project legacy profile compatibility after the refined version is durable.
- Extend the Stage-2 session/gateway schema deliberately with `stale`; when its source initial need changes, mark the unfinished draft stale and make the next load create a fresh in-progress draft without showing stale answers as current.

**Complete when:** gateway conformance, API, concurrency and browser recovery tests pass with the same visible Stage-2 flow.

### Task 5 — Enable Heat Protectant across identity, intake and catalog layers

**Consumes:** `docs/personal-plan/categories/heat-protectant/{decision,evidence}.md` and the shared category/readiness infrastructure.

**Produces:** one production-supported `heat_protectant` identity/intake/spec/validator path with verified launch products and protocols.

This is an independently executable file-ownership lane in the current worktree after Task 1B. It may run in parallel with Tasks 2–4/7 and Task 6 because Task 1B already owns shared role files; Task 9 and activation wait for its reviewed result.

- Promote the category from known-unsupported to supported in `src/lib/product-identity/index.ts`, display labels and all exhaustive category maps.
- Enable the `product_categories` row for catalog and intake.
- Verify the already-landed Task-1B policy exposes canonical `pre_heat_protection`; this category lane does not edit the shared role registry. Qualifying blow-dry/hot-tool routes remain target metadata rather than two invented product roles.
- Add the category's structured spec table/contract, approval validator, admin/intake serialization and generated/local type changes required by its decision authority.
- Backfill and verify the confirmed active exact packages, including binary verified Heat capability and application protocols; pending Balea remains ineligible until approved.
- Extend `product-intake:check-readiness` and category-specific database/domain fixtures.

**Complete when:** exact/manual/photo intake, approval/match/reject, owned search, recommendation eligibility and protocol readiness pass without a cast or fallback to another category.

### Task 6 — Enable Scalp Care across identity, intake and catalog layers

**Consumes:** `docs/personal-plan/categories/scalp-care/decision.md`, `plans/2026-08-06-personal-plan-scalp-care-category.md` and shared category/readiness infrastructure.

**Produces:** one production-supported `scalp_care` identity/intake/spec/validator path preserving its four role vocabulary and medical boundary.

This is an independently executable file-ownership lane in the current worktree after Task 1B. It may run in parallel with Tasks 2–5/7 because Task 1B already owns shared role files; its `product_categories` row must land before Task 8 runs Scalp Care FK/intake fixtures, and Task 9/activation wait for its reviewed result.

Scalp Care is the larger lane: unlike Heat Protectant, it is absent from the current identity vocabulary and must be added to known/supported keys, aliases, labels and every exhaustive supported-category record before its intake/spec/catalog work begins. Do not estimate or assign it as a symmetric one-line enablement.

- Add canonical identity/display/category rows and enable catalog/intake support.
- Verify the already-landed Task-1B policy exposes all four canonical roles; this category lane does not edit shared contracts/state-machine files or retain the two fixture-only aliases.
- Add `primary_role`, `presentation_format`, `rinse_mode` and verified application-instruction storage/validation exactly as the authority specifies; do not invent secondary efficacy fields.
- Extend intake schemas, exhaustive review validators, admin serialization, approval functions, generated/local types and readiness scripts.
- Backfill and verify the launch products, role coverage and protocols; retain limited-evidence and escalation copy boundaries.
- Add end-to-end role, pending, no-safe-candidate and cross-category coverage fixtures.

**Complete when:** all four roles can be captured, reviewed, searched, matched and represented honestly, and the category readiness audit no longer reports fixture-only/unsupported.

### Task 7 — Build reusable multi-product inventory and distinct Stage-3 search adapters

**Consumes:** refined need, all ten supported product categories, existing catalog, `UserProduct` contract.

**Produces:** owner-scoped `user_products`, owned-product catalog search, recommendation selection and stable product-draft identities.

- Implement owned-product search over all active products in the requested canonical category, independent of `is_chaarlie_recommended`; it identifies what the user owns.
- Keep authority-filtered planned-recommendation selection separate and restricted to active eligible/recommended candidates; it finds what Chaarlie proposes.
- Normalize a trimmed search query of 2–120 characters, return at most eight stable-ordered candidates per request and expose no pagination in V1. Reject shorter/longer input before catalog access; the client may refine the query instead of receiving an unbounded result set.
- Search first; create inventory only after explicit selection/ownership, preserving the `requestToken` stale-response contract.
- Support multiple products/category and multi-role products without primary/secondary columns on identity.
- Enforce duplicate exact-product ownership idempotently while permitting genuinely distinct siblings.

**Complete when:** recommended and non-recommended owned products are both discoverable in capture, only eligible products enter recommendations, and exact/no-result/multi-product/duplicate/cross-user/search-order contracts pass for the nine currently representable category rows plus an injected canonical Scalp Care contract fixture. The real all-ten database suite is an explicit Task-9 prerequisite after Task 6 lands; Task 7 does not fake a live `scalp_care` row or block its parallel lane.

### Task 8 — Integrate Product Intake without consuming legacy category slots

**Consumes:** `user_products`, `product_submissions`, private upload controls and the four review SECURITY DEFINER transitions plus consistency trigger.

**Produces:** manual/photo pending identity linked to one stable user product, with safe approval/match/more-info/reject lifecycle.

- Add `product_submissions.user_product_id` with `(id, user_id, category)` composite ownership integrity while retaining the legacy usage relation.
- Add `personal_plan` to the database and TypeScript submission-source vocabularies; new Personal Plan submissions link through exactly one `user_product_id` path and carry the Stage-3 captured `frequency_range`.
- Add a new atomic `product_intake_create_submission_for_user_product` transition and repository method that creates/locks the pending owned identity and submission without reading or writing `user_product_usage`; add an exact-ID cancel/archive counterpart for that path.
- Keep `product_intake_replace_usage_with_matched_product`, `product_intake_replace_usage_with_pending_submission` and `product_intake_cancel_usage_for_category` explicitly legacy-only. Stage 3 catalog matches create/link `user_products` directly and never call the legacy replacement functions.
- Update `product_intake_link_existing_product`, `product_intake_request_more_info`, `product_intake_reject_submission`, `product_intake_approve_reviewed_product`, and every relevant integrity trigger for either valid association path.
- Reconcile all four existing Product Intake integrity triggers, especially `validate_product_submission_status_link`, so successful closure requires the linked `user_products` row to carry the approved identity and unsuccessful closure cannot leave it executable. Add the corresponding user-product review-field protection trigger; do not weaken the legacy usage checks.
- Add the parallel one-open-submission partial unique index for `user_product_id` and deterministic conflict mapping.
- Resolve approved/matched submissions onto the same `user_products` row; more-info remains pending and rejection archives/non-executes it without rewriting frozen portfolios.
- Preserve private bucket, validation, retention and notification behavior.
- Keep the migration reversible at the application-contract level: retain legacy functions unchanged, add new overloads/functions rather than repurposing their signatures, and verify rollback to the previous app ignores nullable new columns safely while the feature flag remains off.

**Complete when:** fresh Stage-3 multi-product submissions no longer conflict with `UNIQUE (user_id, category)` in legacy usage, every review transition preserves ownership/category integrity, and direct/cross-user/forged associations fail in database and API tests.

### Task 9 — Persist Stage-3 drafts and coordinate atomic Stage-4 handoff

**Consumes:** Task 1B, Tasks 5–8, Stage-3 state machine, category authorities and `RoutineProposalStager`.

**Produces:** real Stage-3 gateway, canonical immutable portfolio payload and a completion coordinator that cannot finish without a Stage-4 proposal ID.

- Implement load/create/mutate/complete against revisioned product drafts.
- Recompute role/decision completion server-side; client completion flags are advisory only.
- Freeze the full validated identity/decision evidence once in the bounded portfolio-version snapshot; do not add a parallel portfolio-item persistence model in rollout one.
- Exclude non-executable states from routine coverage while preserving their gaps.
- Call the one consolidated `SECURITY DEFINER` completion RPC through `RoutineProposalStager`; it inserts portfolio + Routine version + proposal and marks the draft completed in one database transaction. The TypeScript coordinator performs no preceding write and no compensation.
- Keep the production completion composition root disabled until the server Routine candidate compiler is integrated; fixture/test compiler injection remains test/dev only.
- Use the exact migration-two function and table names frozen by Task 0; do not create parallel roots or a second portfolio model.

**Complete when:** after the reviewed Stage-4 function is integrated, persistence/gateway/database conformance tests cover all choice states, pending locality, stale refined source, lost response, concurrent completion, rollback and exact Stage-4 handoff through the real SQL transition.

### Task 10 — Wire the protected production journey and observability

**Consumes:** production gateways, signed-off components, feature/cohort gate and Stage-4 proposal route.

**Produces:** `/plan-start` Stage 1 → 2 → 3 journey for the new-buyer cohort with privacy-safe operational events.

- Replace fixture gateways only at the production composition root; retain pure domain/state-machine tests.
- Refactor reused Personal Plan flow components to receive a typed analytics port instead of importing `trackAppEvent` directly. Labs may inject their existing development adapter; the production composition root injects a no-op until the shared analytics-consent gate exists. Add a production-root test proving none of the existing Stage-3 event calls reaches PostHog, Customer.io or Meta.
- Do not add new ungated client analytics events in this slice. Operational launch evidence comes from payload-free server logs/metrics.
- Add server operational logs/metrics for completion latency, conflicts, temporarily unavailable, pending intake and proposal-staging failure without answer/product payload leakage. Rollout targets are p95 under 1.5 seconds for load/save and under 3 seconds for completion, measured as server duration; breach pauses cohort expansion rather than failing deterministic CI.
- Keep flag-off rollback as application disablement; retain inert additive tables and immutable history.
- Retain every existing Personal Plan Labs route and fixture adapter as a required test harness.
- Do not activate or expose the production composition root until the consolidated database stager, source-change outbox and production Routine candidate compiler are integrated; landing inert flag-off code is permitted, a customer-visible Stage-3 dead end is not.

**Complete when:** the integrated production-shaped Playwright suite passes at mobile/desktop, no customer route uses a fixture gateway, and the flag/cohort kill switch is proven.

### Task 11 — Run activation preflight, review and bounded rollout

**Consumes:** verified implementation and ten-category readiness receipts.

**Produces:** review-ready branch receipt; no deployment or activation without separate authorization.

- Run full Node, component, browser, database, type, lint, build and repository verification.
- Run through the repo-owned `.agents/skills/implementation-loop`, which invokes `ready-check` and then exactly one `request-code-review` whole-branch pass over `git diff origin/main...HEAD`; reconcile findings on the exact reviewed head.
- Verify exact product/catalog/protocol launch gates for all ten categories.
- Browser-review the complete new-buyer journey including pending, no-match, revision conflict and retry.
- Record the feature-flag/cohort activation and rollback runbook.
- Extend and database-test the existing account-erasure path against every new Personal Plan table before activation; ordinary application roles still cannot mutate/delete immutable history.
- Rollout one intentionally has no percentage ramp: after Nick's explicit activation authorization, the global flag admits only post-cutoff new buyers. Disable immediately on any ownership/integrity breach, three consecutive completion failures, or either documented p95 breach; saved drafts/versions remain resumable after re-enable.

**Complete when:** ready-check and request-code-review pass on the exact head, the designed journey still matches the reviewed artifacts, and publication remains the explicit stop point.

## 12. Verification

### Automated

- all existing Stage-1 category/portfolio fixtures;
- all Stage-2 path/session/gateway/component fixtures;
- all Stage-3 state-machine/portfolio/gateway/component fixtures;
- production gateway conformance against the same fixture-gateway contract;
- local Postgres tests through `test:personal-plan-db` for RLS, ownership, immutability, foreign keys, guarded current pointers, hash idempotency, revision conflict, concurrent completion and atomic rollback;
- Product Intake resolution and multi-product association regressions;
- route/auth/entitlement/cohort/flag tests;
- Heat Protectant and Scalp Care identity/intake/spec/validator/readiness tests;
- separate owned-search versus planned-recommendation selector tests;
- Playwright mobile and desktop new-buyer journeys;
- `npm run test:node`, relevant Playwright suites, `npm run typecheck`, targeted ESLint, production build and `npm run ci:verify`.

### Manual/browser

- new-buyer entry, Stage-1 Basis/Optional, Stage-2 conditional paths and Stage-3 exact/pending/no-match paths;
- refresh/back/reopen at every stage;
- offline/transient save error and retry;
- second-device revision conflict;
- Stage-2 edit invalidates only unfinished Stage 3;
- Stage-3 completion cannot activate a routine;
- existing buyers remain on the legacy journey outside `/plan-start`; a direct ineligible or flag-off `/plan-start` visit and any mid-journey disablement render state H without sending the user through legacy onboarding;
- 320px/375px and desktop containment against approved artifacts.

### Migration/live-state preflight

- Supabase changelog/docs and CLI help refreshed before schema implementation;
- migration created by CLI, tested from fresh local reset and listed cleanly;
- RLS/advisors reviewed and ownership columns indexed;
- read-only production aggregates confirm the planned migration/backfill assumptions immediately before rollout;
- no production schema/data mutation in planning or review.

### Evidence-sensitive review

- category authority tests distinguish unsupported-category activation failure from honest user-specific no-match;
- pending products stay non-executable and claims remain conservative;
- exact recommendation/product preview remains downstream of deterministic need, never a second category authority;
- no analytics event includes quiz answers, product photos, raw criterion explanations or free-text product data.

## 13. Review and handoff

### Planning findings ledger

| ID | Type | Evidence | Decision | Plan change/revalidation |
|---|---|---|---|---|
| `PF-1` | architecture | Existing `user_product_usage` enforces one row per user/category while Stage 3 permits multiple products and roles | accepted | Added canonical `user_products`; legacy table is projection only. |
| `PF-2` | complexity | Fully normalized criterion/reason tables would duplicate versioned TypeScript contracts | rejected | Relationalize identity/lifecycle; persist computed output as bounded schema-versioned JSONB snapshots. |
| `PF-3` | naming | Generic `personal_plan_versions` containing only initial/refined need would be confused with complete plan/routine versions | accepted | Chose explicit `personal_plan_need_versions`. |
| `PF-4` | lifecycle | Updating a pending identity could make historical views appear changed if rendered through live joins | accepted | The canonical portfolio-version JSON freezes identity/decision evidence, and resolution creates a successor proposal. |
| `PF-5` | rollout | Stage 1 can emit ten categories while Heat Protectant/Scalp Care were fixture-only in the Stage-3 milestone | accepted | All-ten-category production support is an activation gate; no hiding or category-wide fake no-match. |
| `PF-6` | scope | Automatically migrating existing customers requires uncertain reconstruction | rejected for rollout one | New eligible buyers only; migration receives a later plan. |
| `PF-7` | consistency | Independent category confirmation could create mixed-version routines | rejected | One whole successor is confirmed atomically. |
| `PF-8` | reliability | Pending resolution and library changes may succeed while successor generation fails | accepted, ownership moved | Source facts remain durable; Stage 4 owns retryable/coalescing successor generation and keeps the active plan unchanged. |
| `PF-9` | scope defect | Heat Protectant and Scalp Care are unsupported across identity, intake, spec and review layers, not merely missing catalog rows | accepted | Added separate Tasks 5 and 6; all-ten readiness remains a hard activation gate. |
| `PF-10` | infrastructure defect | No Personal Plan database harness/CI job currently exists | accepted | Task 2B creates the script, package command, SQL test and named CI job before relying on them. |
| `PF-11` | contract defect | Stage-3 status/table/gateway/search-token names drifted from the shipped standalone contract | accepted | Task 1 extracts the neutral gateway, fixes names/status, and makes stale search suppression explicitly client-owned with a server-echoed `requestToken`. |
| `PF-12` | security defect | Personal Plan route prefixes currently classify as unknown/fail-open | accepted | Task 3 explicitly adds protected/subscription-required classification plus middleware tests. |
| `PF-13` | cohort defect | General app access includes subscriptions/manual grants and cannot define new one-time buyers | accepted | Cohort requires the exact paid `personal_plan_once` purchase, active fulfillment state and cutoff. |
| `PF-14` | duplication | Portfolio item identity/decision snapshots duplicated the canonical portfolio JSON | accepted and simplified further | Rollout one has no item table; the bounded immutable portfolio payload is the sole frozen evidence snapshot. |
| `PF-15` | scope | Successor queue and legacy confirmation projection have no producer/consumer before Stage 4 | accepted | Deferred both implementations to Stage 4 while preserving the confirmed lifecycle contract here. |
| `PF-16` | concurrency tradeoff | Partial unique current flags would add mutable lifecycle state to immutable need rows | rejected | Use plan-row locks plus guarded pointer-only DB functions, FKs and race tests; clients cannot write pointers directly. |
| `PF-17` | stale external claim | Counterpart cited an older checkout-outage memory without live verification | deferred to activation preflight | It does not alter the architecture; verify current checkout/fulfillment health from live sources immediately before rollout. |
| `PF-18` | duplicate foundation | The deferred multi-product plan widens `user_product_usage`, while the current Stage-4 plan still proposes creating its own `personal_plans` root | superseded/reconcile before implementation | Keep legacy usage unchanged, make `user_products` canonical here, and amend Stage 4 to extend this aggregate and own only Routine/successor lifecycle. |
| `PF-19` | Product Intake seam | Submission source, required frequency, review functions and four existing integrity triggers all assume the legacy association | accepted | Add `personal_plan`, supply captured frequency, enforce one association path and reconcile every function/trigger for `user_product_id`. |
| `PF-20` | retention defect | Superseded prepared artifacts are hard-deleted, so an immutable FK would either block purge or mutate history | accepted | Persist the copied source UUID as provenance without a foreign key; snapshots remain durable evidence. |
| `PF-21` | CI defect | `test:contracts` does not currently execute `test:personal-plan` | accepted | Task 2B adds explicit discovery, a sentinel and CI wiring before new suites count as verification. |
| `PF-22` | concurrency/contract | Draft revision checks need atomic compare-and-set; Stage-2 status and search-token ownership drifted | accepted | Task 1/2C use client-owned search ordering, explicitly extend Stage-2 with `stale`, and require database compare-and-set transitions. |
| `PF-23` | rollout/test harness | A pre-existing Stage-3 production flag would compete with the global app gate, while Labs routes are imported by active tests | accepted | One production flag replaces the unused Stage-3 helper; Labs remain required dev/CI fixtures. |
| `PF-24` | lean persistence | Back-pointers and a portfolio-item table are derivable and have no rollout-one query | accepted | Versions uniquely reference source drafts; omit draft completion back-pointers and item index until a measured consumer exists. |
| `PF-25` | dependency evidence | The reviewer could not see Stage 4 from the integration worktree | superseded by approved consolidation | Read-only sibling evidence is incorporated here; no sibling implementation dependency remains. |
| `PF-26` | unsupported claim | `trackAppEvent` is not a general consent-aware facade | accepted | Add no new ungated client analytics; use payload-free server observability until shared consent gating exists. |
| `PF-27` | operational gap | Non-cohort response, payload limits and latency targets were implicit | accepted | Add typed redirect/API behavior, a flat 512-KiB snapshot cap with typed preservation, and rollout p95 targets. |
| `PF-28` | settled product scope | Reviewer proposed shipping eight categories or splitting the two missing categories out of the launch gate | rejected | Nick already chose all categories ready at launch; Heat/Scalp run as parallel lanes but remain Task-9/activation prerequisites. |
| `PF-29` | authority defect | Stage 3 derives required roles from fixture stubs whose vocabulary diverges from canonical Stage-1 category roles | accepted | Task 1B makes `PlanProductRole` canonical, derives requirements from the refined need, versions real role policies and forbids fixture provenance in production. |
| `PF-30` | intake creation defect | Existing pending/matched creation RPCs always consume `user_product_usage`, and no open-submission uniqueness exists for user products | accepted | Task 8 adds user-product-native create/cancel transitions, keeps legacy RPCs legacy-only and adds the partial unique index. |
| `PF-31` | draft lifecycle | Stage-2 fixture status has no stale state, although successor initial need must invalidate unfinished answers | accepted, deliberate contract extension | Task 4 updates every session/gateway/schema consumer; next load starts fresh and never displays stale answers as current. |
| `PF-32` | cross-workstream atomicity | A customer-visible Stage-3 path without Stage 4 would dead-end, and later source changes need a durable request | accepted with strict activation order | Foundation may land inert only; Stage-4 stager and same-transaction source-change outbox must exist before the global flag or later library/resolution mutation surfaces are enabled. |
| `PF-33` | access recovery | Paid-pending, access-check failure and mid-journey flag disablement were not narrated | accepted | Section 9 preserves existing `/plan-bereit`/reactivation outcomes and resumes durable state when re-enabled. |
| `PF-34` | redundant authority | Single-value cohort state and mutual product/submission back-pointers would create second authorities | accepted | Enrollment purchase provenance defines rollout eligibility; only submissions point to user products. |
| `PF-35` | workflow mismatch | Reviewer could not see repo-owned `implementation-loop`/`request-code-review` and proposed a different finish agent | rejected | Root `AGENTS.md` and available repo skills are authoritative; Task 11 names the required implementation/review path. |
| `PF-36` | transaction defect | A TypeScript coordinator cannot span multiple Supabase RPC transactions or compensate by deleting immutable rows | accepted | Task 0/9 freeze one Stage-4-owned SQL function that inserts portfolio/Routine/proposal and completes the draft atomically; TypeScript calls exactly one RPC. |
| `PF-37` | lifecycle/idempotency | Completed Stage-2 drafts blocked re-edit, refined hashes omitted their parent, and user-product category domain was implicit | accepted | Unique only in-progress drafts, parent-aware refined keys/preimages, and canonical `product_categories` FK are explicit. |
| `PF-38` | entitlement semantics | Enrollment provenance and live mutable purchase status were conflated | accepted | Creation records the qualifying purchase once; every request still applies live entitlement, so refund/reversal/dispute revokes access but preserves history. |
| `PF-39` | dependency ownership | Stage-4 reconciliation existed only as a gate and category lanes contended on shared role files | accepted and superseded in part | Task 0 is consolidated here; Task 1B owns shared roles, and later workers use disjoint file ownership inside this worktree. |
| `PF-40` | handoff detail | Derived payload caps, old release tests, typed unavailable errors and literal CI assertions could surprise executors | accepted | Use a flat cap and name the exact error/test/workflow updates in Tasks 1–3. |
| `PF-41` | recovery defect | Redirecting flag-off/non-cohort one-time buyers to `/chat` would trigger legacy quiz/onboarding intake redirects | accepted | Render the compact unavailable treatment in `/plan-start` with profile/support exits; API stays typed 404 and tests forbid a second hop. |
| `PF-42` | analytics defect | Reused Stage-3 components already call ungated `trackAppEvent` at real interaction points | accepted | Inject an analytics port into reused Personal Plan flows and use a production no-op until shared consent gating exists. |
| `PF-43` | unreachable completion | Task 9 could not verify the real atomic function while it depended on the sibling Stage-4 plan/function | superseded by approved consolidation | Migration two and the real stager now belong to this plan/worktree; the global flag remains off until the compiler and full journey verify. |
| `PF-44` | precision gaps | Search `ignored`, cutoff name, enrollment provenance and JSON size expression remained ambiguous | accepted | Remove `ignored`, name the UTC env variable, copy enrollment source ID without an FK, and make database text-octet size the single byte authority. |
| `PF-45` | rollout/infrastructure | First pgTAP CI cost and whole-cohort flag ownership were implicit | accepted | Scope the 15-minute DB job to relevant changes; Nick explicitly activates the post-cutoff cohort and documented integrity/failure/latency thresholds disable it. |
| `PF-46` | baseline defect | The CI workflow contract test still expected the former two-spec Stage-3 command | accepted and repaired during planning | Updated the literal to the current three-spec command; the focused five-test suite passes. |
| `PF-47` | implementation gap | Signed-off Stage-1 cards and packshot selection existed only in the HTML/fixture boundary | accepted | Task 3 explicitly builds the production Stage-1 UI and verified read-only selector; no existing component or fake product art is assumed. |
| `PF-48` | recovery evidence | The compact in-place unavailable state was described but absent from the visual authority | accepted | Added state H to the Stage-1 HTML; its final visual review is the remaining mockup gate. |
| `PF-49` | parallel-lane conflict | Task 7 could not require a live Scalp Care row before its sibling category lane landed | accepted | Task 7 proves nine real categories plus an injected canonical Scalp contract; Task 9 owns the real all-ten database gate. |
| `PF-50` | idempotency defect | A unique source-draft link conflicted with valid reuse of an identical refined version | accepted | Completion stores a nullable result pointer on each draft and reuses the parent-aware immutable refined version transactionally. |
| `PF-51` | provenance/retention | A purchase FK would couple immutable plan history to mutable purchase retention | accepted | Store copied purchase-source provenance without an FK; live access still comes from entitlement, and account-erasure integration is an activation gate. |
| `PF-52` | boundedness/race | First-plan creation, snapshot decoding and product search still had implicit edge behavior | accepted | Specify insert-on-conflict plus row lock, decoder registries, and a 2–120 character/eight-result search boundary. |

### Required remaining gates

1. **Completed and reconciled:** six read-only Claude/Opus-high review passes grounded the architecture and repository seams; accepted findings are recorded in `PF-19`–`PF-52`, while settled product scope and the repo workflow remain authoritative in `PF-28`/`PF-35`.
2. **Completed:** Nick reviewed and approved mockup state H and confirmed the Section-9 production integration journey on 2026-08-08.
3. **Completed:** Task 0 consolidated the Stage-4 backend authority into this plan and superseded the sibling prerequisite recorded in `PF-18`/`PF-25`/`PF-43`.
4. Commit the retained plan only with Nick's authorization or as part of the later approved implementation branch handoff.
5. Begin implementation through `implementation-loop`; do not treat the fixture-preview receipt as production readiness.

### Worktree and artifact disposition

- Worktree: `.worktrees/personal-plan-stage1-2-integration`
- Branch: `codex/personal-plan-stage1-2-integration`
- This plan: **commit** with the production-foundation implementation work.
- Existing approved mockups and stage plans: **commit/retain** as source authorities.
- Counterpart transient output: **discard** after findings are reconciled into the ledger.
- Fixture Labs routes: **retain** as development/CI contract harnesses in this implementation.

### Stop point

Planning stops after counterpart reconciliation and explicit production-integration journey sign-off. Implementation may then start on the guarded worktree. Commit/push/PR/merge/deploy/flag activation and production writes remain separate authorizations.

## 14. Implementation receipt — 2026-08-08 resumed after consolidation

### Completed dependency-safe slice

- Re-ran the branch gate in `.worktrees/personal-plan-stage1-2-integration`; the linked worktree and `codex/personal-plan-stage1-2-integration` branch were correct, and every handed-off dirty task artifact was preserved.
- Completed Tasks 1/1B and implemented the Tasks-2A/2B/2C schema, CI harness, owner/RLS and compare-and-set contracts in four ordered migrations. Nick approved replacing the serial migration-zero replay gate with a production-shaped transition gate on 2026-08-08: a sanitized schema-only snapshot of the linked production `public` schema is loaded into an isolated disposable Supabase project, followed by a pre-transition reference seed and every repository migration newer than the recorded production head. The authoritative metadata fixes that head at `20260803122000`, records project/capture/schema-only provenance, and pins baseline SHA-256 `0a02ede4a8b62cf89ff199a86b8c2404e87c48096d6766a7eb97daddddf12478`; the harness fails before Docker on any mismatch. Today's derived transition is exactly the four Personal Plan migrations, whose presence and relative order are asserted. No customer, catalog-product or production row data is copied. Both database test files execute and pass 93/93 assertions. The gate exposed and fixed one genuine production-schema compatibility defect in the new Routine migration: `uuid_generate_v4()` is schema-qualified as `extensions.uuid_generate_v4()`, matching the current production extension placement. Clean replay from migration zero remains separate repository-infrastructure debt and is not used as evidence for this deployment transition.
- Implemented authenticated, exact-purchase/cohort-scoped Stage-1 persistence and the signed `/plan-start` result states. Stage 2 now recomputes from the immutable initial snapshot, persists revisioned drafts/refined versions and supports successor re-edit without overwriting history.
- Implemented the reusable Stage-3 production persistence/search/intake gateways, strict protected APIs, owner-scoped multi-product capture, Product Intake association/cancellation, immutable portfolio handoff, payload-free server operations and a production-default no-op analytics port. Intake request fingerprints and stable user-product IDs make retries idempotent; every post-intake Stage-3 failure is either guardedly rolled back or returned as same-key `compensation_pending`, including resumable photo finalization. Lost completion responses replay the frozen result through one RPC without TypeScript compensation.
- Consolidated the minimal Stage-4 backend in this worktree: active/pending Routine pointers, immutable Routine versions, whole-proposal confirmation and the durable coalescing source-change outbox. The deterministic production compiler evaluates the immutable refined needs and portfolio, passes the locked plan's expected source revision to the one-RPC stager, and rejects stale compilation before any write. Staging acknowledges only the exact source revision included in the candidate, preserving unrelated, newer and leased outbox work. Completion can set only a pending proposal; no code path activates a Routine implicitly.
- Added the approved fourth additive category-readiness migration and application contracts for Heat Protectant and Scalp Care. It intentionally contains no launch-product, catalog-spec or protocol fact backfill, so all-ten-category launch readiness remains unproved and activation remains blocked.
- Added explicit account-erasure coverage for every new owner-scoped table while preserving immutable history outside the exact service-only erasure transaction.
- Wired the signed production `/plan-start` journey in place: Bedarf Basis, Optional where present, Stage-2 refinement, then authoritative Stage-3 roles/fit/product capture. It uses only the authenticated production APIs, preserves resume/re-edit/conflict/pending-intake/recovery boundaries, and never imports the Labs fixture gateway. A development-only CI route seam exercises that production composition with authenticated owner-shaped API fixtures; it cannot classify `/plan-start` as development outside `NODE_ENV=development` plus the two explicit CI environment gates.
- The final review found that manual fallback capture had been assigning `weekly_2x` without asking. The signed Stage-3 authority already required product-specific frequency, so the fallback now displays the same explicit frequency picker, refuses submission without a selection, persists the selected value exactly, and has focused plus Chromium regression coverage.
- Kept the global feature flag off by default. The production route and APIs remain protected, owner-scoped and entitlement-scoped, and no Routine activation path is exposed by this work.

Verification on the receipt-complete tree is recorded below. The production-shaped database transition gate and the refreshed application/browser gates pass; catalog/protocol launch facts remain insufficient for activation, so the global flag stays off. `ready-check` and the repository's normal plus structural review lanes completed on the whole task tree. The single read-only Claude counterpart review found no blocking auth, RLS, API or migration defect; its one supported data-quality finding was fixed and the affected gates were rerun.

### Task-0 consolidation receipt

Nick approved consolidation option 1 on 2026-08-08. Task 0 is now complete in this authority: the current worktree owns the single `personal_plans` root, the Stage-1–3 persistence model, and the minimal Stage-4 Routine/version/proposal/outbox backend. The sibling Stage-4 plan/mockup was used only as read-only evidence; its competing root and its commit/review prerequisite are superseded, and the sibling worktree remains untouched.

Before the foundation migration generation, fresh read-only explorers rechecked existing Routine/proposal seams, Supabase/RLS/atomic-function and pgTAP patterns, and Product Intake source-change transitions. Sections 4, 5, 8 and Task 0 freeze the exact tables, pointer FKs, service-only completion/confirmation signatures and outcomes, durable coalescing rules and producer boundary.

On 2026-08-08, the Task-5/6 readiness audit proved that the frozen first three migrations had no owner for their shared category/spec/protocol schema. Nick approved a fourth additive `personal_plan_category_readiness` migration. This evidence-based Task-0 amendment preserves the first three migrations unchanged and explicitly excludes launch-product inserts, catalog/spec enrichment, legacy-row reconciliation and every other production-data write.

### Verification receipt and remaining activation gates

- focused CI path/workflow contract: covered by the passing full Node suite, including the updated Personal Plan DB/browser command expectations;
- focused transition-preparer and CI routing contracts: 18/18 passed, including baseline hash mismatch, future migration discovery, required ordering, malformed/duplicate version failure and helper-path routing;
- `npm run test:node`: 2,876/2,876 passed;
- `npm run test:personal-plan`: 509/509 passed;
- focused Stage-3 fallback/component regression: 11/11 passed after first proving the fabricated-frequency behavior red;
- focused Personal Plan Product Intake contracts: 12/12 passed, including mutation failure, guarded rollback, compensation-pending retry and photo replay finalization;
- self-hosted Stage-1/2/3 Chromium contract: 15/15 passed, including the production `/plan-start` composition with authenticated owner-shaped Stage-1/2/3 API fixtures;
- `npm run typecheck`: passed;
- `npm run lint`: passed with four pre-existing warnings and zero errors;
- `PERSONAL_PLAN_APP_V1_ENABLED=false npm run build`: passed;
- `npm run test:personal-plan-db`: passed 93/93 assertions against the isolated production-shaped transition database (verified sanitized current-production schema; pre-transition Shampoo, Conditioner and unsupported Heat Protectant references; then every post-head repository migration). The pgTAP contract proves Heat Protectant takes the production-shaped update branch and Scalp Care the insert branch;
- `PERSONAL_PLAN_APP_V1_ENABLED=false npm run ci:verify`: passed;
- Personal Plan pgTAP executed all 89 planned assertions; the existing waitlist outbox file executed four more assertions in the same run;
- `git diff --check`: passed.

The all-ten-category audit separates code correctness from activation data. Conditioner has documented active recommendations but needs final re-verification. Mask lacks the production repair-support/protocol model and its product enrichment. Oil has only the pre-heat protocol. Bondbuilder lacks protocol storage/validation/readers and reviewed protocol facts for the named launch products. Heat Protectant has schema support but still needs the six reviewed packages and keeps the pending/ineligible Balea item excluded. Scalp Care has schema support but no verified launch-product/role coverage. Shampoo, Dry Shampoo, Deep Cleansing and Leave-in still need their documented launch-data/protocol audits. The fourth migration is schema-only and no production application-protocol reader is being claimed.

The remaining activation gate is the reviewed launch products/specs/protocols for all ten categories. Clean replay from migration zero remains tracked separately as repository-infrastructure debt; it does not block proving that these four migrations apply to the current production schema. The investigated `00001_initial_schema.sql` and HAI-124 replay defects are not retained Personal Plan PR content: their task-local edits were precisely reversed to merge-base content, and any future repair belongs to separate repository migration-history work. Task 11 is review-ready on this exact tree, but the global flag stays off. Plan/mockup authorities and implementation artifacts remain task-owned PR content; the transient Claude report remains outside the repository and is discarded after findings integration. Commit/push/PR/merge/deploy/production writes remain outside this authorization.
