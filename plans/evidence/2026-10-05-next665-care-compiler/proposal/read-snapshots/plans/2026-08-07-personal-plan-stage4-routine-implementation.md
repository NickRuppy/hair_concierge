# Personal Plan Stage 4 — Routine implementation plan

**Status:** approved for implementation; visual evidence approved; counterpart review reconciled; final designed-user-journey sign-off confirmed

**Outcome:** turn the immutable Stage-2 refined need version and Stage-3 proposed product portfolio into one calm, persistent `Routine` page. The user confirms an exact whole-routine snapshot, may later edit it globally, and must explicitly accept or reject every fully recomputed successor before the active Routine changes.

**Foundation authority amendment 2026-08-08:** Task 0 is satisfied by draft PR #339 at reviewed/pushed head `7d5db46ad7a6c559cc6b3b1a27dc28c8d59551bc`. Stage 4 is stacked on that exact head. The foundation now owns the canonical `personal_plans` aggregate, immutable need/portfolio/Routine versions, `personal_plan_routine_proposals`, the coalescing source-change outbox, active/pending pointers, owner/RLS contracts, `user_products` multi-product identity, the deterministic initial candidate compiler, the one-RPC Stage-3 completion stager, and the guarded confirmation transition. All earlier instructions in this plan to create a second root, duplicate those tables, introduce a second compiler/stager authority, import dirty prerequisite worktrees, or block on Milestone-B persistence are superseded.

Stage 4 must reuse and extend those authorities. Its remaining backend scope is successor intent/edit compilation, semantic diffing, reject/no-change/supersede/source-reconciliation transitions, typed owner-scoped read and attention APIs, acquisition recomputation, and customer-facing Routine behavior. Existing foundation table names and RPCs remain canonical; any additive migration must extend them rather than replace them. The global Stage-4 gate remains exact-true and off, Stage 5 remains out of scope, and no fixture-backed path may serve production.

## 1. Outcome and source context

Stage 4 answers one question: **Which product and purpose assignments belong in the Routine I have chosen?** It does not answer how to execute a wash or styling day; that remains Stage 5 (`Anwendungsplan`).

Authoritative inputs:

- `plans/2026-08-07-personal-plan-five-stage-product-journey.md` — integrated five-stage product boundary and the Stage-4/5 split.
- `plans/2026-08-07-personal-plan-stage3-products-implementation.md` — integrated Stage-3 completion and `ProposedProductPortfolio` contract.
- `plans/mockups/2026-08-07-personal-plan-stage4-routine-flow.html` — approved responsive Stage-4 planning evidence.
- Current legacy seams on the #339 stack base: `src/app/routine/page.tsx`, `src/components/routine/**`, `src/lib/routines/**`, `/api/routine/**`, `user_product_usage`, and the authenticated `Header` Routine destination.

The Stage-4 task worktree is `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-stage4-routine` on `codex/personal-plan-stage4-routine`, stacked by fast-forward on the exact #339 head `7d5db46ad7a6c559cc6b3b1a27dc28c8d59551bc`. The two pre-existing untracked Stage-4 artifacts were fingerprinted before and after the stack operation and preserved byte-for-byte. Stage 5 remains isolated and untouched.

## 2. Chosen direction

### Product model

- There is one Routine, not separate “current” and “future” routines.
- The overview is grouped exactly in Stage-1 order: `Deine Basis`, then `Optional`.
- Each product-purpose assignment is its own card. One Oil covering pre-wash and dry finish therefore produces two adjacent Oil cards.
- Cards lead with purpose, then category and exact product, then cadence/trigger and exceptional state.
- Same-category cards share a subtle category tint. Text, chips, and accessible labels carry every meaning; colour is never the only signal.
- Product fit education remains in the product detail. Overview cards show concise status only.

### Two independent status axes

The compiler must not collapse expert assessment and user choice into one status:

```ts
type RoutineSystemAssessment = "basis" | "optional" | "not_recommended"

type RoutineItemState = {
  systemAssessment: RoutineSystemAssessment
  inclusion: "included" | "excluded"
  availability: "owned" | "planned" | "pending_review" | "none"
  fitDecision: "standard" | "informed_override"
}
```

Examples:

| System assessment | User state       | Visible meaning                                                  |
| ----------------- | ---------------- | ---------------------------------------------------------------- |
| `basis`           | included + owned | active Basis assignment                                          |
| `basis`           | excluded + none  | `Empfohlen, aber nicht eingeplant` and retained in `Deine Basis` |
| `optional`        | planned          | optional assignment marked `Geplant`                             |
| `not_recommended` | included + owned | `Nicht empfohlen · von dir eingeplant` in `Optional`             |
| any               | pending review   | `Noch in Prüfung`; never executable                              |

Untouched `not_recommended` categories remain hidden. A category moves between `Deine Basis` and `Optional` only in a successor version and only becomes visible in that new location after confirmation.

### Confirmation and later changes

- Initial Stage-3 completion creates a proposal, never an active Routine.
- `Routine bestätigen` atomically makes the exact candidate version active.
- The user remains on Routine. Stage 4 exposes the accepted immutable Routine-version port for Stage 5, but does not render an `Anwendungsplan` link until Stage 5 supplies its real route; Stage 4 never invents or auto-navigates to that route.
- Later edits use one global `Routine bearbeiten` mode. There are no per-card edit buttons in the overview.
- Individual editor controls validate immediately, but `Änderungen prüfen` submits the whole edit batch for a complete deterministic recomputation across every category and role.
- The review sheet shows `Von dir geändert`, `Dadurch außerdem angepasst`, and an unchanged count. Acceptance activates the whole successor atomically.
- Rejection keeps the prior active Routine byte-for-byte unchanged. An identical automatically generated proposal is remembered and not immediately recreated; an explicit future user edit may intentionally propose the same outcome again.

### Non-interruptive attention

- A pending successor never opens a modal on another page and never redirects the user.
- The shared Routine destination exposes a small dot while a proposal is pending.
- On intentional entry to Routine, the contextual sheet opens. `Später` dismisses it only for the current visit; the dot and pending proposal remain.
- Leaving and reopening Routine shows the sheet again. Only explicit acceptance or rejection clears the pending state and dot.
- The reviewed bottom navigation illustrates the eventual shell placement. This implementation owns a reusable Routine-attention contract and badge and wires it into the current Routine navigation destination. Redesigning all authenticated navigation into the mocked three-tab bottom bar is a separate workstream.

## 3. Scope and non-goals

### In scope

- immutable Routine versions and proposal lifecycle;
- initial Stage-3 → Stage-4 proposal creation;
- deterministic whole-Routine compilation, canonical hashing, cross-category arbitration, and semantic diffing;
- persistent central Routine rendering for Personal Plan users;
- Basis/Optional grouping and one card per product-purpose assignment or explicit uncovered purpose;
- active, excluded, planned, pending, informed-override, and deliberately non-recommended states;
- exact product detail, price/availability freshness, affiliate disclosure, and outbound shop action;
- one global editor for category inclusion, supported product assignments, valid semantic roles, and cadence overrides;
- planned-product `Ich habe es schon gekauft` as an explicit inventory/acquisition fact followed by a successor proposal, not automatic activation;
- non-interruptive proposal attention, persistent dot, entry sheet, accept/reject, and stale-conflict recovery;
- Stage-5 handoff by immutable active Routine version ID;
- owner-only persistence, idempotent transitions, analytics, rollout gate, and legacy compatibility.

### Non-goals

- compiling day types, application order, quantities, wait times, or instructions; Stage 5 owns these;
- a general redesign of Chat, Today, Tracker, Profile, or authenticated navigation;
- replacing or weakening the legacy `user_product_usage` one-row-per-category contract;
- treating `user_product_usage` as the canonical Stage-4 Routine;
- re-running Stage-3 fit education in Routine cards;
- making a shop click mean “owned”, purchased, or active;
- making planned or pending products executable in Stage 5;
- adding speculative LLM recomputation. Routine compilation is deterministic and authority-versioned;
- inventing a heavy-Conditioner-removes-Oil rule. The compiler considers every encoded intercategory dependency, but a concrete consequence is emitted only when the reviewed category/portfolio authority and frozen product facts support it;
- silently converting an external product-review result into an active Routine change;
- production activation before Stage-1–3 Milestone-B persistence and live category/catalog gates are available.

## 4. Authoritative contracts and invariants

### 4.1 Stage-3 input

The production adapter consumes the immutable refined need snapshot and Stage-3 output by ID, loading both server-side after ownership checks. Browser input never supplies trusted portfolio JSON.

```ts
type Stage3CompleteResponse = {
  status: "ready_for_routine"
  personalPlanId: string
  refinedVersionId: string
  productPortfolioVersionId: string
  routineProposalId: string
  next: { stage: 4; href: string }
}
```

The Stage-3 `ProposedProductPortfolio` remains the decision source for owned assignments, planned purchases, pending products, explicit overrides, and uncovered roles. Stage 4 does not reinterpret a Stage-3 choice. It combines that choice with the matching refined category decision, frozen product-decision facts, and versioned category/portfolio authority needed to calculate display tier, purpose, cadence, and cross-category consequences.

Milestone-B integration must expose these server-loadable facts for each portfolio item:

- immutable `portfolioVersionId`, `refinedVersionId`, and `sourceDraftRevision`;
- category, semantic role, decision key, choice state, and verdict;
- exact catalog product or pending-submission identity;
- product-specific reported frequency and any accepted user override;
- criterion/product-fact projection used for the verdict, or an immutable reference to it;
- category authority version and recommendation rule IDs.

For planned purchases, the production Stage-3 contract must carry the exact catalog `productId` in addition to `recommendationId` and `displayName`. A purchasable “exact recommendation” without a product ID cannot safely load price, availability, affiliate disclosure, identity, or later acquisition. If no exact eligible catalog identity exists, Stage 3 must emit an uncovered/no-safe-match state rather than a purchasable planned item. This is a required Task-0 contract correction to the current fixture type.

Current Stage-3 fixture output does not yet persist all production evidence or multi-product submission associations. That is an explicit integration prerequisite, not a field for Stage 4 to guess from product names or current catalog state.

### 4.2 Canonical Routine intent

Each immutable Routine version contains both the compiled result and the user intent needed to recompute a successor. Inventory truth remains separate.

```ts
type RoutineIntentV1 = {
  schemaVersion: 1
  categories: Array<{
    category: PersonalPlanCategory
    inclusion: "included" | "excluded"
    inclusionSource: "stage3" | "user_edit"
    assignments: Array<{
      assignmentKey: string
      role: Stage3SemanticRole
      productRef:
        | { kind: "owned"; capturedProductId: string; productId: string }
        | { kind: "planned"; plannedPurchaseId: string; productId: string | null }
        | { kind: "pending_review"; capturedProductId: string; submissionId: string }
        | { kind: "none" }
      cadenceOverride: ProductFrequency | null
      fitDecision: "standard" | "informed_override"
    }>
  }>
}
```

Rules:

- `assignmentKey` is stable across recomputations for the same category/role/user-intent assignment; it is not a React index.
- Removing a category changes `inclusion`; it does not delete owned inventory, intake submissions, or Stage-3 history.
- Adding a non-recommended supported category creates explicit user intent while retaining `systemAssessment: "not_recommended"`.
- A product may fill several roles; the intent stores each role assignment and the result renders each separately.
- A cadence override records the user’s chosen cadence separately from the system target. The expert target and its authority version remain available for later comparison.
- Editor product selection distinguishes existing owned/captured products, exact catalog products planned for purchase, and unresolved intake. Selecting a catalog result never asserts ownership; an unknown product returns through the Stage-3 intake boundary.

### 4.3 Immutable compiled version

```ts
type PersonalPlanRoutineVersionV1 = {
  schemaVersion: 1
  planId: string
  versionId: string
  parentVersionId: string | null
  source: {
    refinedVersionId: string
    productPortfolioVersionId: string
    sourceFingerprint: string
    compilerVersion: string
    authorityVersions: Record<string, string>
  }
  intent: RoutineIntentV1
  sections: Array<{
    key: "basis" | "optional"
    itemKeys: string[]
  }>
  items: RoutineItemV1[]
  createdAt: string
}

type RoutineItemV1 = {
  itemKey: string
  assignmentKey: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole
  purposeKey: string
  roleOrder: number
  state: RoutineItemState
  product:
    | { kind: "owned"; capturedProductId: string; productId: string; displayName: string }
    | { kind: "planned"; plannedPurchaseId: string; productId: string | null; displayName: string }
    | { kind: "pending_review"; submissionId: string; displayName: string }
    | { kind: "none"; displayName: null }
  cadence: {
    recommended: PlanFrequencyTarget | null
    userOverride: ProductFrequency | null
    displayKey: string
  }
  sourceDecisionKeys: string[]
  authorityRuleIds: string[]
  executable: boolean
}
```

`PlanFrequencyTarget` is now integrated at `src/lib/personal-plan/types.ts` by the #339 foundation and remains the cadence authority. The current legacy Routine’s `CareBalanceFrequencyTargetInput` remains a compatibility/read-model type; Stage 4 does not substitute it for the richer Personal Plan cadence contract.

`executable` is true only when the assignment is included, in hand, identity-resolved, and valid for its role. Planned, pending, uncovered, and excluded assignments are always false. An informed owned override may remain executable because the user explicitly accepted it in Stage 3; its limitation stays available in detail and downstream safety boundaries still apply.

The payload is canonicalized before hashing:

- section order is always Basis then Optional;
- category order is `STAGE1_CATEGORY_ORDER`;
- same-category items use authority-owned role order, then stable assignment key;
- object keys and unordered evidence IDs are canonicalized;
- timestamps are excluded from semantic equality;
- the same trusted inputs produce the same payload hash and delta.

### 4.4 Full recomputation pipeline

`compilePersonalPlanRoutine()` is a pure deterministic function under `src/lib/routines/personal-plan/` and is developed test-first:

1. validate and canonicalize the refined snapshot, frozen Stage-3 portfolio/evidence, relevant product-review projection, authority versions, active intent, and edit operations;
2. apply all direct edit operations to a candidate intent without changing the active version;
3. recompute the complete category portfolio from the refined profile and current trusted facts;
4. run all versioned intercategory arbitration for the union of Stage-1 categories and user-added supported categories;
5. resolve every semantic role to included/excluded, owned/planned/pending/none, cadence target/override, and executable state;
6. project all cards, including recommended-but-excluded and explicit uncovered-role cards;
7. sort canonically and create the semantic payload hash;
8. compare against the active version and create a delta.

The compiler never short-circuits to the edited category. A direct Conditioner change can therefore alter an Oil assignment, but only through an explicit tested authority rule. The initial dependency fixture uses an already encoded portfolio rule, such as a Basis Leave-in demoting duplicate damp-smoothing Oil coverage; the user’s Conditioner/Oil example becomes a fixture only after its product-fact and cross-category authority is reviewed and implemented upstream.

### 4.5 Delta contract

```ts
type RoutineProposalDeltaV1 = {
  schemaVersion: 1
  direct: RoutineDeltaEntry[]
  consequential: RoutineDeltaEntry[]
  unchangedItemCount: number
}

type RoutineDeltaEntry = {
  changeKey: string
  itemKey: string | null
  kind:
    | "added"
    | "removed"
    | "product_changed"
    | "cadence_changed"
    | "status_changed"
    | "section_changed"
  before: RoutineDeltaSummary | null
  after: RoutineDeltaSummary | null
  explanationKey: string
  authorityRuleIds: string[]
}
```

- A delta is `direct` when its semantic item/field is the target of a submitted editor operation.
- Every other semantic difference is `consequential` even if it is in the same category.
- Cosmetic copy, current price, availability, image URL, and card colour changes do not create a Routine proposal.
- A source change that produces no semantic delta records the evaluated source fingerprint and creates no dot.

### 4.6 Persistence and atomicity

The foundation already supplies the three owner-scoped Routine backend tables. Stage 4 extends these exact authorities additively; it does not create the generic replacement table names from the earlier draft below:

#### `personal_plans`

- stable `id`, unique `user_id`, created/updated timestamps;
- nullable `active_routine_version_id` and `pending_routine_proposal_id`;
- monotonically increasing `revision`;
- monotonically increasing trusted-fact `source_revision`;
- `last_evaluated_source_fingerprint`;
- nullable `last_rejected_auto_fingerprint`.

#### `personal_plan_routine_versions`

- `id`, `user_id`, `personal_plan_id`, nullable `parent_routine_version_id`;
- source refined/portfolio IDs, schema/compiler/authority versions;
- canonical `payload jsonb`, `payload_hash`, created timestamp;
- no updates or deletes. A trigger rejects mutation of an existing row, including through service role unless the migration is intentionally changed.

#### `personal_plan_routine_proposals`

- `id`, `user_id`, `personal_plan_id`, nullable `base_routine_version_id`, required `candidate_routine_version_id`;
- `origin`: `stage3_completion | editor | source_sync | acquisition | product_review`;
- `status`: `pending | accepted | rejected | superseded`;
- source and proposal fingerprints;
- canonical delta JSON and direct operation keys;
- created/resolved timestamps;
- one pending proposal per plan.

The existing `personal_plan_routine_source_change_outbox` is the sole durable source-reconciliation queue. `personal_plans` pointers and their `RESTRICT` foreign keys already exist. Version/proposal history is not cascade-deleted by ordinary product or inventory changes.

Read policy allows an authenticated user to select only their own plan, versions, and proposals via the owning `personal_plans.user_id`. Direct client insert/update/delete is revoked. `SECURITY DEFINER` transition functions set `search_path`, derive `auth.uid()`, lock the plan row, validate every referenced version/proposal belongs to that plan, and return typed JSON results.

Required transitions:

1. **Stage proposal** — checks the expected active version and plan revision, inserts the immutable candidate version and pending proposal, and updates the pending pointer/revision in one transaction. Same semantic proposal is idempotent.
2. **Accept proposal** — requires the proposal to be the current pending proposal, its base to equal the current active version, and its source fingerprint still to be current; moves the active pointer to the candidate, marks accepted, clears pending/rejection fingerprint, and increments revision.
3. **Reject proposal** — leaves active untouched, marks rejected, clears pending, records the automatic proposal fingerprint when applicable, and increments revision.
4. **Supersede stale pending** — when trusted source facts change again before review, a newly compiled candidate may replace the pending proposal; the old proposal is marked superseded. An acceptance against the old ID receives a typed conflict and never changes active state.
5. **Record no semantic change** — updates only `last_evaluated_source_fingerprint` after verifying the active version and revision.

Initial proposal has `base_version_id = null`. It offers `Routine bestätigen`, `Routine bearbeiten`, and a route back to products; it does not offer “reject and keep old” because no active Routine exists yet.

Opening the editor before first confirmation seeds it from the current pending candidate intent. A successful recomputation supersedes that pending proposal with another `base_version_id = null` proposal. After activation, the editor always seeds from the active version. The client never edits a persisted version payload in place.

### 4.7 Source synchronization and cheap attention reads

Relevant changes may arrive through Stage 2, Stage 3, acquisition, or product-review resolution. V1 avoids both a new background worker and expensive recomputation on unrelated page loads:

- Stage-3 completion stages the first proposal explicitly.
- Editor and acquisition actions recompute synchronously and stage a successor.
- Stage-2/3 completion and product-review resolution are required source-writer integrations: after their own successful transaction, they invoke the idempotent `reconcileRoutineAfterSourceChange(planId)` service. Failure is logged and never rolls back the truthful upstream fact or mutates the active Routine; Routine-entry sync is the deterministic recovery path. A review result never activates the candidate.
- The authenticated shell performs only a cheap owner-scoped read of `personal_plans.pending_proposal_id` through the attention endpoint. It does not compile, diff, or inspect product facts on Chat, Today, Tracker, or Profile loads.
- A reusable authenticated `syncRoutineProposal()` compares the active version’s source fingerprint with the latest refined version, portfolio version, relevant captured-product/submission resolutions, catalog identity lifecycle, and authority versions. It runs on Routine entry and inside known source-changing workflows, not on every authenticated navigation.
- Routine entry invokes sync before loading the view, providing a safety net if an upstream writer integration was temporarily unavailable. In that recovery case, the proposal and sheet appear on Routine entry even if the dot could not be lit beforehand.

This gives the dot on the next authenticated navigation/load after the source-changing workflow has staged a proposal, without polling, push notifications, cron, or a modal on the current page. If a pending proposal already exists and source facts changed again, sync supersedes it before review. If the user is looking at a now-stale sheet, accept returns `409 stale_proposal` and reloads the current proposal. Editor submission uses the distinct `409 stale_active_version` code when its observed active version/revision has changed.

## 5. Target map

Exact names may be adjusted only for an existing repository convention discovered after the Stage-1–3 branches integrate; behavior and ownership stay fixed.

### Contracts and deterministic logic

- `src/lib/routines/personal-plan/contracts.ts` — Zod schemas and types for intent, version, item, edit operations, proposal, delta, view, and typed errors.
- `src/lib/routines/personal-plan/compiler.ts` — complete deterministic recomputation pipeline.
- `src/lib/routines/personal-plan/canonicalize.ts` — stable order, semantic hash payload, and source fingerprint.
- `src/lib/routines/personal-plan/diff.ts` — direct/consequential delta classifier.
- `src/lib/routines/personal-plan/editor.ts` — allowed operation validation and intent application.
- `src/lib/routines/personal-plan/display.ts` — German purpose/status/cadence display keys and category tint tokens; no recommendation policy.
- `src/lib/personal-plan/products/routine-adapter.ts` — Stage-2/3 immutable-source adapter. This may land with Stage-3 Milestone B if that workstream owns the production transaction.

### Persistence and server orchestration

- `supabase/migrations/<timestamp>_personal_plan_routine_versions.sql` — tables, indexes, RLS, immutability, transition functions, and grants.
- generated Supabase types updated through the repository’s normal generation workflow when available.
- `src/lib/routines/personal-plan/repository.ts` — typed owner-scoped reads and RPC mapping.
- `src/lib/routines/personal-plan/proposal-service.ts` — compile/stage/sync/accept/reject orchestration.
- `src/lib/routines/personal-plan/load-routine-view.ts` — active/proposal view projection plus product detail references.
- `src/lib/routines/personal-plan/acquisition.ts` — explicit owned transition through Stage-3 inventory persistence followed by recomputation.

### API and route composition

- `src/app/api/personal-plan/routine/route.ts` — load active/initial/pending Routine view.
- `src/app/api/personal-plan/routine/attention/route.ts` — cheap read-only pending-proposal state for navigation.
- `src/app/api/personal-plan/routine/sync/route.ts` — idempotent source reconciliation used on Routine entry and by trusted source-changing workflows.
- `src/app/api/personal-plan/routine/proposals/route.ts` — submit a complete editor operation batch and stage a candidate.
- `src/app/api/personal-plan/routine/proposals/[proposalId]/resolve/route.ts` — accept/reject.
- `src/app/api/personal-plan/routine/planned-items/[itemKey]/acquire/route.ts` — explicit “owned” fact and successor proposal.
- `src/app/routine/page.tsx` — new server-owned resolver: current main contains only a three-line render of the client-fetching `RoutinePageClient`; implementation adds auth/plan lookup, renders the Personal Plan page when a plan/proposal exists, and still renders that unchanged legacy client for non-plan users.
- Existing `/api/routine/**` stays the legacy mutation surface and is not called from the Personal Plan editor.

### UI

- `src/components/routine/personal-plan/routine-page.tsx` and focused client boundary.
- `routine-section.tsx`, `routine-item-card.tsx`, and `routine-status.tsx` — purpose-first overview.
- `routine-product-detail.tsx` — exact product, fit detail link/content, price freshness, affiliate disclosure, outbound action, and owned action.
- `routine-editor.tsx` — one global editor, local validation, product/category/role/cadence controls, and dirty-exit confirmation.
- `routine-proposal-sheet.tsx` — first confirmation, successor notice, semantic delta, accept/reject, stale/error states.
- `src/components/layout/routine-attention.tsx` or equivalent provider/hook — reusable dot contract wired into current `Header` Routine links; future bottom navigation consumes this component.
- Current `RoutineCard`, drawer, shaping, and API components remain available for users without a Personal Plan and may share only presentation helpers that do not blur the data model.

### Tests and evidence

- `tests/personal-plan-stage4-contracts.test.ts`
- `tests/personal-plan-stage4-compiler.test.ts`
- `tests/personal-plan-stage4-diff.test.ts`
- `tests/personal-plan-stage4-persistence.test.ts`
- `tests/personal-plan-stage4-api.test.ts`
- `tests/personal-plan-stage4-ui.test.tsx`
- `tests/personal-plan-stage4-routing-nav.test.ts`
- `tests/personal-plan-stage4-analytics.test.ts`
- `tests/personal-plan-stage4.spec.ts` plus `test:playwright:personal-plan-stage4` included in the appropriate contract CI path.
- Existing `tests/routine-*.test.ts(x)` remain regression coverage for the legacy route.

## 6. Designed user journey

### Actor and entry condition

The actor is an authenticated Personal Plan customer. Stage 2 has frozen a refined need version and Stage 3 has frozen a complete-enough proposed product portfolio containing owned choices, planned purchases, pending products, explicit overrides, and honest gaps.

### First proposal

1. Stage-3 completion atomically freezes the portfolio and stages the initial Routine proposal, then returns the typed Stage-4 href.
2. Routine opens with `Deine Routine steht` and the complete proposal. Cards are grouped `Deine Basis` then `Optional` in Stage-1 order.
3. Every assignment leads with its purpose. Planned purchases read `Geplant`; pending products read `Noch in Prüfung`; uncovered recommended roles stay visible; deliberately included non-recommended categories are marked honestly.
4. The user may open product detail without changing anything. The detail preserves the Stage-3 decision/limitation, while time-sensitive price and availability are loaded as current commerce data rather than frozen fit facts.
5. `Routine bestätigen` activates exactly this immutable version. No planned purchase becomes owned and no pending product becomes executable.
6. The page stays in place and confirms the active Routine. A later Stage-5 change may add `Anwendungsplan ansehen` by consuming the accepted version-ID port; this Stage-4 branch does not invent that route.
7. If the user is not ready, they may leave. The proposal remains pending and the Routine navigation destination keeps its dot. Returning reopens the proposal. They may also enter the global editor or return to the products stage; there is no meaningless “keep previous” rejection when no previous version exists.

### Active Routine

1. Reopening Routine loads the active immutable snapshot rather than recomputing the cards live.
2. The page shows one global `Routine bearbeiten` action. Overview cards are navigational/details, not miniature editors.
3. Tapping a planned product opens detail with price, freshness, availability, affiliate disclosure, and `Zum Produkt`.
4. An outbound shop click opens the seller and records only a privacy-safe structural event. It does not mutate inventory, plan, proposal, or active version.
5. `Ich habe es schon gekauft` explicitly records the product as owned through the Stage-3 inventory boundary, fully recomputes the Routine, and creates a successor proposal. The active Routine remains unchanged until acceptance.

### Global editing and recomputation

1. `Routine bearbeiten` opens one editor for the complete Routine. It states that the active version remains unchanged until confirmation.
2. Basis and Optional preserve the overview hierarchy. The user can:
   - replace or assign a supported product;
   - include or exclude a supported category;
   - assign a product to valid semantic roles;
   - set a supported cadence override.
3. Removing a recommended category keeps it in the relevant overview section as `Empfohlen, aber nicht eingeplant`; it does not erase an owned product from inventory.
4. Adding a non-recommended category places it under Optional as `Nicht empfohlen · von dir eingeplant` after confirmation. Untouched non-recommended categories remain hidden.
5. Invalid role/product/category combinations are explained beside the control and do not destabilize other edits.
6. The editor keeps a local operation batch. A failed save/recompute retains it for retry. Navigating away with unreviewed edits asks whether to discard them; V1 does not create a separate server-side edit-draft table.
7. `Änderungen prüfen` submits the batch with the observed active version and plan revision.
8. The server recomputes every category and dependency. If the semantic result is unchanged, it reports that there is nothing to accept and keeps the active Routine.
9. Otherwise one responsive sheet/modal shows:
   - `Von dir geändert` for direct operations;
   - `Dadurch außerdem angepasst` for all other semantic consequences;
   - how many assignments are unchanged.
10. `Zurück zum Bearbeiten` returns to the same operation batch. `Änderungen verwerfen` discards the candidate/editor batch and keeps active unchanged.
11. `Änderungen übernehmen` atomically activates the entire candidate version. A failure or stale conflict leaves active unchanged and reloads the latest source/proposal before another acceptance attempt.

### Externally generated successor

1. A relevant Stage-2/3, acquisition, or intake-review source changes.
2. The active Routine remains exactly as confirmed. No modal appears on the user’s current page.
3. The source-changing workflow performs full recomputation and stages a semantic successor; on the next authenticated navigation/load, the cheap attention read sees the pending pointer and displays a dot. Routine entry reconciles source drift as a safety net.
4. When the user intentionally opens Routine, a sheet says that a new proposal exists and that the active Routine is unchanged.
5. `Später` closes the sheet for that visit only. The dot persists. Leaving and returning opens the sheet again.
6. `Änderungen prüfen` opens the same direct/consequential delta view. For source-generated proposals, the “direct” group is labelled by the source fact change and the consequential group contains compiler effects.
7. Accept activates the entire successor and clears the dot.
8. Reject marks the proposal rejected, clears the dot, and leaves the prior active version unchanged. The same automatic proposal fingerprint is suppressed until relevant inputs change; a later explicit editor action may intentionally propose the same composition.

### Error and recovery states

- **Not authenticated:** normal authenticated route handling redirects to sign-in; no plan data is returned.
- **Missing or foreign source version:** Stage-3 handoff fails closed and returns to the owning stage with a recoverable message.
- **Compiler/source mismatch:** no proposal is inserted; the active snapshot remains usable and the user can retry after sources refresh.
- **Stale editor revision:** return `409 stale_active_version` with the latest view; keep the local batch and ask the user to review/reapply it.
- **Superseded proposal:** return `409 stale_proposal`; active remains unchanged and the latest proposal is loaded.
- **Acceptance write failure:** active pointer and proposal status remain unchanged because the RPC is atomic; the sheet stays retryable.
- **Rejected proposal:** active stays available; the rejection never rewrites inventory or refined need truth.
- **Pending/no product:** the card remains honest and non-executable; other cards and Stage-4 confirmation are not blocked.
- **Personal Plan read or proposal recovery failure:** show a scoped reload/retry state, never the legacy live projection as if it were the confirmed Personal Plan. A dedicated Stage-3 continuation route is not invented in this Stage-4 workstream.
- **Stage-4 kill switch:** users with an active version retain a read-only snapshot; new proposal/edit/activation actions are disabled with a compact retry-later state. Users without a Stage-4 plan continue to the legacy Routine.

### Completion and Stage-5 handoff

Stage 4 completes when `personal_plans.active_routine_version_id` points to the explicitly accepted immutable version and the page renders that same ID. The documented Stage-5 input port is that server-owned active version ID. Stage 5 may compile only `executable: true` assignments from that version; planned, pending, excluded, and uncovered assignments stay visible as gaps/context but never become steps.

## 7. Planning evidence

### Reviewed artifact

`plans/mockups/2026-08-07-personal-plan-stage4-routine-flow.html`

**Question answered:** can Routine feel like one calm central product blueprint while still making global editing, planned products, full recomputation, and later change review understandable without putting edit controls on every card?

**States shown:** first proposal, active Routine, planned-product detail, global editor, direct/consequential delta sheet, and non-interruptive later-proposal notice; mobile and desktop views are available in the artifact.

**Selected direction:** purpose-first cards, Basis/Optional Stage-1 hierarchy, separate card per product-role assignment, one global editor, complete recomputation at review, one responsive proposal sheet, and a persistent Routine-navigation dot.

**Feedback incorporated:**

- no per-category edit affordance wasting card space;
- Routine is a central page;
- no interruption outside Routine;
- dismissing the proposal sheet does not clear the dot;
- rejection keeps the prior active Routine;
- full recomputation captures intercategory dependencies;
- overview cards show status rather than repeating Stage-3 fit education;
- same-category role cards remain separate and visually related;
- planned product detail contains commerce information, but purchase/ownership requires an explicit separate action;
- confirmation stays on Routine and only offers the Stage-5 destination.

**Evidence-review status:** approved by Nick on 2026-08-07 (`Sounds good, that works.`).

**Authority boundary:** hierarchy, interaction ownership, information placement, and state behavior are authoritative. Production must use existing Routine/onboarding primitives and accessibility conventions rather than copying artifact CSS literally. The mockup’s three-tab bottom navigation is placement evidence for the attention dot, not authorization to redesign every authenticated page in this task.

**Artifact checks:** one HTML file; six selectable states; inline JavaScript parses; Prettier and `git diff --check` pass. The artifact is committed with the plan. Temporary browser screenshots/traces are discarded.

**Designed-user-journey sign-off:** confirmed by Nick on 2026-08-07 through the instruction to start implementation after the counterpart-reviewed walkthrough. The earlier visual approval alone did not satisfy this gate; the later implementation instruction does.

## 8. Ordered implementation tasks

This remains one implementation workstream because the compiler/persistence foundation has no safe user-facing activation without the confirmation, successor, and legacy-routing UI. To keep review size controlled, the branch has two internal review gates: **Foundation gate** after Tasks 0–3 (flag off; contracts, compiler, persistence, and initial API only) and **Complete-journey gate** after Tasks 4–8. Do not delegate or start Task 1 until Task 0 passes. Do not open a separately shippable foundation PR that could be activated without the complete journey.

Typed analytics and the read-only attention badge remain V1 requirements because they verify the approved no-interruption behavior and make the bounded internal rollout observable. They do not run recomputation on unrelated pages and they remain behind the same Stage-4 gate.

### Task 0 — freeze integrated prerequisite contracts (**complete on #339**)

**Consumes:** reviewed Stage-1 `InitialNeedPlanSnapshot`, Stage-2 refined-version persistence, Stage-3 contracts/portfolio, and Stage-3 Milestone-B production persistence.

**Work:**

- preserve the reviewed #339 authority at `7d5db46ad7a6c559cc6b3b1a27dc28c8d59551bc` as the exact Stage-4 stack base;
- resolve duplicate locally owned Personal Plan types so Stage 4 imports one canonical ten-category/order/role vocabulary;
- ensure Stage-3 production persistence supports multiple captured products per category without changing legacy `user_product_usage` uniqueness;
- expose immutable portfolio decision evidence and an idempotent Stage-3-completion → Stage-4-proposal transaction boundary;
- pin adapter contract tests before building UI.

**Produces:** server-loadable `refinedVersionId` and `productPortfolioVersionId`, canonical category/role types, and a callable initial proposal service.

**Completion check:** passed on #339 head `7d5db46ad7a6c559cc6b3b1a27dc28c8d59551bc`. The canonical plans/types, owner-scoped immutable versions, `user_products` multi-product authority, exact planned `productId`, real Stage-3 completion transaction, initial compiler/stager, foreign-user/RLS coverage, and default-off production flag are present. Stage 4 remains forbidden from falling back to invented or fixture-only contracts.

### Task 1 — extend the canonical compiler with successor intent, edits, hash, and semantic diff test-first

**Consumes:** Task-0 immutable source adapters.

**Work:**

- add Zod schemas/types for intent, items, versions, operations, deltas, views, and typed conflicts;
- write table-driven compiler tests before implementation;
- implement full category/role recomputation and versioned cross-category arbitration;
- implement stable section/category/role order and canonical hashes;
- implement direct versus consequential delta classification;
- project planned/pending/excluded/non-recommended states without making them executable.

**Produces:** `compilePersonalPlanRoutine(input)`, `applyRoutineEdits(intent, operations)`, `canonicalizeRoutineVersion(payload)`, and `diffRoutineVersions(before, after, directKeys)`.

**Completion check:** focused tests prove deterministic replay, whole-snapshot operation application, one product/multiple roles, several products in one category, Stage-1 order, Basis/Optional movement, recommended exclusion, deliberate non-recommended inclusion, planned/pending/gap non-executability, cadence override separation, and no-semantic-change behavior. No new cross-category product rule is introduced without an owning authority and fixture.

### Task 2 — extend the owner-only immutable persistence with successor transitions

**Consumes:** Task-1 version/proposal schemas and hashes.

**Work:**

- retain the existing three Routine tables, indexes, RLS, grants, immutable-version trigger, unique plan/pending constraints, and guarded initial/confirm transitions;
- add only the missing successor-stage, reject, and no-semantic-change transitions against the existing optimistic plan/source revisions;
- implement initial, successor, accept, reject, supersede, and no-semantic-change transitions;
- add typed repository/RPC adapters; never trust client user IDs or plan ownership.

**Produces:** atomic persistence functions returning `created | existing | accepted | rejected | stale_active_version | stale_proposal | forbidden | invalid_source` outcomes.

**Completion check:** disposable-database/RLS tests cover two users, cross-plan references, direct write denial, immutable payload denial through both authenticated and service-role paths, duplicate completion, concurrent accept/reject, rollback on injected error, old-proposal acceptance, and prior-version retention. The service-role test proves the trigger still fires even though service role bypasses RLS.

### Task 3 — preserve Stage-3 completion and implement Routine read/sync APIs

**Consumes:** Task-0 Stage-3 completion transaction; Task-1 compiler; Task-2 repository.

**Work:**

- retain the existing one-RPC operation that freezes the Stage-3 portfolio and stages the initial proposal;
- implement owner-scoped Routine view loading;
- implement source fingerprinting and idempotent sync for upstream changes;
- expose a separate cheap attention read that returns only whether the owner has a pending proposal;
- preserve the Stage-2/3 source writers and reconcile exact planned-product acquisition. Product-review identity resolution remains retryable until the upstream fit-decision authority can compile a new portfolio decision; Stage 4 never guesses that decision from identity alone;
- supersede a stale pending proposal before rendering review;
- preserve current `/api/routine/**` as the legacy path;
- define Personal Plan route resolution without falling back to legacy when a plan exists but is temporarily incomplete.

**Produces:** `Stage3CompleteResponse` with a real proposal ID, `GET /api/personal-plan/routine`, `GET /api/personal-plan/routine/attention`, and `POST /api/personal-plan/routine/sync`.

**Completion check:** API tests prove initial proposal/no activation, repeat completion idempotency, active snapshot stability, no-delta sync, proposal-producing sync, rejected-fingerprint suppression, source-change re-enablement, and typed auth/conflict failures.

### Task 4 — implement global edit, acquisition, and proposal-resolution services

**Consumes:** current active version/revision and Task-1 edit/compiler functions.

**Work:**

- accept only bounded typed operations: include/exclude category, assign/remove/replace supported product, assign valid role, set/clear cadence override;
- validate catalog/submission/portfolio references server-side;
- recompute the whole Routine and stage one candidate;
- implement accept/reject endpoints over atomic RPCs;
- make `Ich habe es schon gekauft` update the Stage-3 owned-product boundary explicitly, then recompute a successor;
- keep shop clicks mutation-free.

**Produces:** proposal creation/resolution/acquisition endpoints and typed conflict responses.

**Completion check:** API/service tests prove invalid role/category/product rejection, inventory-not-Routine separation, whole-Routine consequence generation, acquisition-not-activation, accept/reject semantics, stale proposal recovery, and no partial active-pointer writes.

### Task 5 — build the approved central Routine UI

**Consumes:** Task-3 Routine view and Task-4 mutations.

**Work:**

- render the first proposal, active snapshot, Basis/Optional sections, purpose-first cards, stable category tints, and all exceptional states;
- keep category tints in quiet surface tokens; preserve existing plum for selected/focus states and coral for CTA/accent use rather than turning either brand action colour into category identity;
- use separate cards for every role assignment and keep same-category cards adjacent;
- implement accessible product detail using current catalog price/availability and affiliate helpers without freezing commerce data into semantic versions;
- build the one global editor, inline validation, dirty-exit confirmation, and retry-preserved local operation batch;
- build responsive first-confirmation, notice, and direct/consequential review sheet/modal;
- keep the user on Routine after activation and leave the accepted-version input port for the later Stage-5 route;
- retain current legacy Routine client for users without a Personal Plan.

**Produces:** production `/routine` Personal Plan experience matching the reviewed artifact’s hierarchy and behavior.

**Completion check:** component tests cover copy/status combinations, card order and duplication, palette-token ownership, keyboard/focus behavior, modal labels, initial/no-active variant, editor actions, no-change result, error/retry, accept/reject, and legacy fallback. No overview card contains an edit button.

### Task 6 — add persistent attention without interruption or global-nav redesign

**Consumes:** Task-3 read-only attention response and Task-5 proposal sheet.

**Work:**

- add a shared attention provider/hook that performs only the cheap pending-pointer read on authenticated navigation/load;
- display an accessible dot on every currently rendered Routine navigation destination;
- open the proposal sheet only on Routine entry, not when attention changes on another page;
- make `Später` current-visit-only and preserve the dot/pending pointer;
- reopen on later Routine entry; clear only after accepted/rejected response;
- leave a stable prop/hook contract for the later three-tab bottom navigation.

**Produces:** `RoutineAttentionState { hasPendingProposal: boolean }` and reusable badge UI.

**Completion check:** routing/component/browser tests prove no modal or redirect elsewhere, dot persistence after dismissal/navigation, sheet reappearance on reentry, clearing after accept/reject, and accessible non-colour label. Existing desktop/mobile header navigation remains otherwise unchanged.

### Task 7 — add typed analytics, rollout control, and operational safety

**Consumes:** UI/service outcomes; never raw product/profile content.

**Work:**

- add PostHog-only typed events through `events.ts`, `routes.ts`, `track-app-event.ts`, and the PostHog destination mapper:
  - `personal_plan_routine_viewed` with view state only;
  - `personal_plan_routine_editor_opened` with item-count bands only;
  - `personal_plan_routine_recomputed` with origin, outcome, and direct/consequential/unchanged counts;
  - `personal_plan_routine_proposal_resolved` with initial/successor, origin, and accept/reject;
  - `personal_plan_routine_shop_clicked` with planned/active placement only;
  - `personal_plan_routine_acquisition_recorded` with proposal-created/no-change outcome.
- do not emit product names, queries, category/profile facts, evidence text, prices, URLs, submission IDs, or version/user IDs;
- add an exact-true Stage-4 entry/edit gate, default off outside explicit preview/test audience;
- name the server-owned gate `PERSONAL_PLAN_STAGE4_ENABLED`; only the exact string `"true"` enables new entry and mutations;
- when disabled after activation, preserve owner-readable active versions and disable mutations rather than showing a misleading live legacy Routine;
- document rollback and proposal backlog inspection.

**Produces:** privacy-safe measurement and reversible activation.

**Completion check:** typed analytics tests exercise every event/destination mapping and privacy blacklist; flag tests cover no-plan legacy, eligible proposal, and read-only active-plan kill-switch states.

### Task 8 — verify the integrated Stage-2 → accepted-Routine boundary journey

**Consumes:** all prior tasks and reviewed mockup acceptance criteria.

**Work:**

- run the complete Stage-3 completion → first Routine confirmation → accepted immutable Routine boundary;
- cover fitting owned products, informed override, planned purchase, pending review, uncovered role, same product/multiple roles, several same-category products, and deliberately non-recommended inclusion;
- cover edit-induced intercategory consequence, source-generated successor, dismissal persistence, reject, accept, stale conflict, and acquisition;
- verify 375 px and desktop, keyboard/screen reader, focus return, no content coverage, loading/error/retry, and no interruption outside Routine;
- verify Personal Plan and legacy Routine users side by side;
- verify the active version ID is the documented future Stage-5 execution source without implementing Stage 5.
- add the `test:playwright:personal-plan-stage4` package script and register its flat spec in the agreed contract CI path before Section 9 invokes it.

**Produces:** ready-check evidence and review-ready branch; no publication.

**Completion check:** all verification in Section 9 passes, artifact disposition is complete, `implementation-loop` has run its `ready-check` and whole-branch `request-code-review`, and the branch stops for explicit `ship-it` authorization.

## 9. Verification

### Automated checks

- Focused deterministic tests:
  - `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage4-*.test.ts tests/personal-plan-stage4-*.test.tsx`
- Legacy routine regression:
  - existing `tests/routine-api.test.ts`, `routine-page-ui.test.tsx`, `routine-data-loader.test.ts`, `routine-card-state-derivation.test.ts`, `routine-routing-nav.test.ts`, and `routine-category-contract.test.ts`.
- Full repository checks:
  - `npm run test:node`
  - `npm run test:contracts`
  - `npm run test:playwright:personal-plan-stage4`
  - `npm run ci:verify`
- `git diff --check` and plan/mockup Prettier check.

### Compiler fixture matrix

| Fixture                        | Required proof                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| Initial complete portfolio     | no active pointer before confirmation; Basis/Optional Stage-1 order                 |
| One product, several roles     | separate adjacent cards, stable keys, no duplicate inventory fact                   |
| Several products, one category | all supported assignments survive; no legacy category-slot overwrite                |
| Recommended exclusion          | category retained with `Empfohlen, aber nicht eingeplant`; inventory untouched      |
| User-added non-recommended     | Optional card with explicit user inclusion; no system-tier rewrite                  |
| Planned/pending/uncovered      | visible, non-executable, confirmable Routine                                        |
| Informed override              | limitation provenance retained; executable only when owned/included                 |
| Cadence override               | recommended target retained separately; direct cadence delta                        |
| Cross-category rule            | edit in A causes tested consequence in B after full recompute                       |
| Same semantic result           | no proposal/dot despite source fingerprint change                                   |
| Rejected auto proposal         | identical fingerprint suppressed; changed source or explicit edit can propose again |
| Stale pending                  | old proposal superseded; old accept cannot change active                            |

### Migration and auth checks

- Apply the migration to a disposable local/branch database before any shared environment.
- Verify table and function grants explicitly for `anon`, `authenticated`, and `service_role`.
- Use two authenticated users to prove owner reads and cross-user denial through both tables and RPCs.
- Attempt payload update/delete and foreign/cross-plan pointer injection.
- Run concurrent proposal/accept/reject calls and inspect pointers/statuses after each race.
- Verify rollback leaves all historical versions readable and no partially activated state.
- No production migration or data backfill is authorized by this plan.

### Manual/browser checks

- Review at 375 px, a representative larger mobile width, and desktop.
- First proposal: scroll order, each exceptional status, detail open/close, confirm, and stay in place; verify that no speculative Stage-5 CTA is present.
- Active: cards have detail navigation only; global edit is singular and obvious.
- Editor: add/remove category, replace product, valid/invalid role, cadence, dirty exit, save failure and retry.
- Delta: direct/consequential grouping, unchanged count, return to editor, discard, accept, stale conflict.
- Later proposal: dot elsewhere without modal; Routine entry sheet; `Später`; navigate away/back; reject and accept branches.
- Product detail: price/availability freshness, affiliate disclosure, external link, explicit acquisition; verify outbound click has no state mutation.
- Keyboard: logical tab order, dialog focus trap, Escape/close behavior consistent with “Später”, focus restoration, and accessible dot/status labels.
- Screen reader: purpose-first card names include category/product/status/cadence without relying on tint.
- Legacy user: existing Routine behavior and mutation endpoints remain unchanged.

### Evidence-sensitive review

- Compare production screenshots against the approved artifact for hierarchy, not literal CSS.
- Re-run simulated-user review for a first-time confirmer and a returning user with a pending successor.
- Any change to global-versus-card editing, Basis/Optional hierarchy, separate role cards, no-interruption behavior, dot-clearing rule, rejection semantics, or full recomputation reopens planning evidence review.
- Any new cross-category domain rule requires its owning category/portfolio authority and deterministic fixtures; Stage 4 may not create policy in React or API handlers.

## 10. Rollout, risks, and recovery

### Rollout

1. Merge prerequisite persistence/contracts while Stage-4 entry remains off.
2. Apply migration to a disposable database and then the intended non-production environment; verify RLS and transition receipts.
3. Enable internal/preview users with Stage-3 completion and compare active/proposal pointers to rendered state.
4. Run the integrated browser and simulated-user review.
5. Enable the bounded Personal Plan audience only after the Stage-3 live catalog/intake blockers are cleared.

### Primary risks and mitigations

| Risk                                                                  | Mitigation                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Current Routine is a mutable live projection                          | New plan users render immutable versions; legacy path remains isolated                            |
| Stage-1–3 foundation changes while this branch is stacked             | exact #339 base identity is recorded; rebase/review is required before publication                |
| Multi-product category conflicts with `user_product_usage` uniqueness | Dedicated Stage-3 portfolio-item persistence; legacy invariant untouched                          |
| Full recompute changes an unrelated category unexpectedly             | versioned authority rules, direct/consequential delta, explicit confirmation, regression fixtures |
| Source changes while user reviews                                     | source fingerprint + current-pending check + typed stale conflict                                 |
| Dismissal accidentally clears attention                               | dismissal is client visit state only; DB pointer remains pending                                  |
| Rejected proposal loops forever                                       | rejected automatic fingerprint suppression; explicit edits remain allowed                         |
| Commerce data drifts                                                  | excluded from semantic hash/delta; freshness shown in detail                                      |
| Kill switch hides confirmed plan                                      | active version stays read-only; no misleading legacy fallback                                     |
| Stage 5 executes future products                                      | explicit `executable` predicate and version-ID contract tests                                     |

### Recovery

- Turning off Stage-4 mutations preserves plans, versions, and proposals.
- The prior active version is always retained after successor activation and can be inspected for support; automatic rollback UI is not in V1.
- A corrective rollback requires a new explicit successor proposal or an operator procedure reviewed separately; implementation must not mutate historical payloads or repoint active state ad hoc.
- Failed migration/application stops activation. No destructive cleanup or backfill is part of this task.

## 11. Review and handoff

### Planning gates

- Visual evidence review: **confirmed 2026-08-07**.
- Read-only counterpart plan review: **completed and reconciled 2026-08-07**.
- Final designed-user-journey walkthrough: **confirmed 2026-08-07**.
- Explicit journey sign-off: **confirmed 2026-08-07** through Nick’s instruction to start implementation after the reviewed walkthrough.

Implementation may now begin through `implementation-loop`. The transient counterpart report remains outside the repository and is discarded after planning handoff.

### Implementation and publication gates

- Use the existing task worktree/branch; re-run `branch-gate` before persistent implementation edits if branch state changes.
- `implementation-loop` owns execution, test-first deterministic logic, integration, `ready-check`, and meaningful whole-branch `request-code-review`.
- Stop at review-ready. Commit/push/draft PR requires explicit `ship-it`; merge is separate authorization.
- Migration application, feature activation, and production writes remain separately authorized operations.

### Artifact disposition

| Artifact                                             | Disposition                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| This implementation plan                             | commit                                                                                       |
| Approved HTML mockup                                 | commit                                                                                       |
| Deterministic/compiler fixtures and tests            | commit with implementation                                                                   |
| Migration/RLS verification scripts that are reusable | commit with implementation                                                                   |
| Counterpart review report                            | discard from repository after findings are reconciled; keep transiently outside the worktree |
| Browser screenshots/traces/build output              | discard unless one is intentionally selected as durable PR evidence                          |
| Adjacent dirty-worktree files                        | do not copy; integrate reviewed commits only                                                 |

## 12. Findings ledger

| ID  | Source | Finding                                                                                          | Disposition      | Plan change / evidence                                                                                                                              |
| --- | ------ | ------------------------------------------------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | Nick   | Full recomputation is required because categories can affect one another                         | accepted         | Compiler always recomputes the complete union and the delta separates direct from consequential changes                                             |
| U2  | Nick   | Editing should be global or at most section-level; cards should not waste space on edit controls | accepted         | One top-level editor; overview cards are detail navigation only                                                                                     |
| U3  | Nick   | Routine is a central persistent page                                                             | accepted         | `/routine` resolves the immutable Personal Plan experience and remains reopenable                                                                   |
| U4  | Nick   | Pending changes must never interrupt another task/page                                           | accepted         | Attention dot only; sheet opens on Routine entry                                                                                                    |
| U5  | Nick   | Dismissal must not clear the dot; accept/reject must be explicit                                 | accepted         | Pending pointer survives `Später`; only resolution clears it                                                                                        |
| U6  | Nick   | Rejection keeps the previous Routine                                                             | accepted         | Reject transition never moves `active_version_id` and suppresses identical automatic reproposal                                                     |
| U7  | Nick   | Preserve Stage-1 order and Basis/Optional distinction                                            | accepted         | Canonical section/category ordering and assessment/user-choice separation                                                                           |
| U8  | Nick   | A user may add/remove categories without rewriting the recommendation                            | accepted         | Inclusion is user intent; system assessment remains independent                                                                                     |
| U9  | Nick   | Same category/purpose assignments should remain separate cards and may share visual colour       | accepted         | One item per assignment, adjacent canonical order, redundant non-colour status                                                                      |
| U10 | Nick   | The easiest change review is one popup showing what changed                                      | accepted         | One responsive proposal sheet/modal with direct, consequential, unchanged, and whole-version actions                                                |
| U11 | Nick   | First confirmation stays on Routine                                                              | accepted         | Activation renders in place; the later Stage-5 route can attach through the active-version port without auto-navigation                             |
| U12 | Nick   | Approved the Stage-4 visual evidence                                                             | accepted         | Evidence status confirmed; final journey sign-off was completed separately by the later implementation instruction                                  |
| C1  | Claude | Full compilation on every authenticated navigation would add unnecessary latency                 | accepted         | Split cheap pending-pointer attention reads from sync; compile only in source writers and on Routine entry                                          |
| C2  | Claude | Consider deferring analytics from V1                                                             | rejected         | Privacy-safe structural events are small, follow the existing router, and are required to observe the bounded rollout and no-interruption flow      |
| C3  | Claude | The plan is too large to treat every task as one undifferentiated execution batch                | accepted in part | Added Foundation and Complete-journey internal review gates; retained one workstream because the hidden foundation is not independently activatable |
| C4  | Claude | Stage-1–3 are an external sequencing gate, not ordinary setup                                    | satisfied        | #339 supplied the reviewed production foundation at the recorded exact base head; Stage 4 extends that authority without fallback contracts         |
| C5  | Claude | The named Stage-4 Playwright command does not exist yet                                          | accepted         | Task 8 explicitly owns adding and registering the script before verification invokes it                                                             |
| C6  | Claude | `/routine/page.tsx` currently has no server resolver                                             | accepted         | Target map now calls out the real three-line client render and the additive legacy-client branch                                                    |
| C7  | Claude | `PlanFrequencyTarget` was absent on the former main base                                         | satisfied        | #339 integrated it at `src/lib/personal-plan/types.ts`; Stage 4 retains that authority instead of the legacy CareBalance shape                      |
| C8  | Claude | Category tints must not appropriate existing action/selection brand colours                      | accepted         | Task 5 reserves coral/plum semantics and verifies quiet category surface tokens                                                                     |
| C9  | Claude | Immutability must be proved through service role as well as authenticated access                 | accepted         | Task-2 database check now explicitly tests trigger enforcement with service role                                                                    |
| C10 | Claude | Stale editor and stale proposal error codes could drift                                          | accepted         | Contract fixes `stale_active_version` for editor submission and `stale_proposal` for proposal acceptance                                            |
| C11 | Claude | A percentage rollout rung is not specified                                                       | rejected         | V1 is intentionally exact-flag plus bounded preview/test audience; broader or percentage rollout is a later release decision                        |
| C12 | Claude | Journey sign-off remained open at review time                                                    | satisfied        | Nick subsequently confirmed the reviewed journey and explicitly authorized implementation                                                           |

## 13. Implementation outcome and authority amendments (2026-08-08)

Stage 4 was implemented on `codex/personal-plan-stage4-routine` from exact #339 head `7d5db46ad7a6c559cc6b3b1a27dc28c8d59551bc`. The branch extends the foundation's existing aggregate, immutable Routine versions, proposal lifecycle, compiler/stager, source-revision outbox, and owner/RLS boundaries. It does not introduce a second persistence root, fixture-backed production path, or Stage-5 implementation. Both pre-existing planning artifacts remained in place; the approved HTML mockup remains byte-identical to its pre-stack fingerprint.

Implemented scope:

- central owner-scoped `/routine` read model with strict global-plus-Stage-4 release composition;
- Basis/Optional purpose-first cards, separate same-category assignments, global edit, frozen product detail, and honest planned/pending/excluded states;
- first confirmation plus non-blocking successor review, current-visit `Später`, explicit accept/reject, persistent navigation attention, and active-snapshot stability;
- whole-snapshot edit application and semantic direct/consequential delta generation without adding a new category-policy rule;
- additive successor, rejection, supersession, source-revision, acquisition, and service-only database transitions;
- exact planned-product acquisition as one owner-locked source transaction, followed by a pending successor rather than activation;
- structural PostHog-only analytics, bounded APIs, retry/conflict recovery, and a disposable authenticated Stage-4 browser harness registered in the contract path.

Final implementation clarifications:

- A newly acquired product has `frequencyRange: null` until the person reports actual usage. Recommended Routine cadence stays separate and is not rewritten as observed behavior.
- Product-review identity resolution is not itself a new Stage-3 fit decision. Those events remain retryable until the upstream authority exposes a fit-redecision/portfolio-recompile seam; Stage 4 does not guess or acknowledge them as complete.
- Full recomputation means every submitted operation is applied to the complete immutable Routine snapshot and every resulting item change is diffed. No heavy-conditioner/removes-oil or other cross-category policy was invented because no reviewed authority fixture currently owns one.
- The future Stage-5 port is `personal_plans.active_routine_version_id` plus the accepted immutable payload's `executable` predicate. No speculative `Anwendungsplan` route or CTA is included here.
- The authenticated browser proof covers desktop and 375 px for the core initial-confirm/edit/review/later/reentry/reject journey. The broader exceptional-state matrix is covered by deterministic API, compiler, component, migration, and RLS tests rather than pretending every combination is a browser scenario.

Verification completed on the uncommitted review tree:

- focused Stage-4 TypeScript/component/API suite: 51/51 passed;
- disposable database transition: 4 SQL files, 167 pgTAP assertions passed;
- authenticated isolated Stage-4 Chromium journey: 1/1 passed with reviewed initial, successor, and mobile captures;
- shared Playwright contracts: 201/201 passed; Stage-1–3 browser journeys: 15/15 passed;
- repository node suite: 2,926/2,926 passed; agent suite: 967/967 passed with loopback-only placeholder configuration;
- `npm run ci:verify`: typecheck, lint, and production build passed; lint retained four unrelated existing warnings and no errors;
- feature flags remain off by default; no production write, migration application, deployment, commit, push, PR, or activation was performed.

The single whole-tree Claude review ran read-only against the recorded pre-fix implementation fingerprint. Its six validated findings were resolved locally: rejected-proposal restaging, mixed/deferred source batches, complete multi-claim deltas, cadence clearing, consumer-safe errors, and terminal invalid-source handling. The review also prompted tighter current-commerce filtering, honest affiliate/freshness presentation, and direct acquisition classification. The amended tree was rechecked through the affected focused, database, browser, type, lint, and build lanes; no second counterpart pass was run.
