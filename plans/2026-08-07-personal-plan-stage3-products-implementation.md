# Personal Plan Stage 3 — Products implementation plan

**Status:** standalone Milestone A implemented and verified; the development-only Stage 1 → 2 → 3 integration slice is implemented locally against the real refined Stage-1 recomputation and remains fixture/in-memory-backed; production persistence, catalog mutation, customer-route activation, and Stage-4 activation remain deferred

**Production-persistence authority:** `plans/2026-08-07-personal-plan-stage1-3-production-foundation.md` supersedes this plan's Milestone-B table name and broad production-integration bullets. This plan remains authoritative for Stage-3 domain contracts, state machine, portfolio semantics, signed-off UI and user journey; the foundation plan must extract a neutral gateway without changing those behaviors.

**Outcome:** turn the immutable Stage-2 refined need plan into an exact, explainable product portfolio by first identifying what the customer owns and how they use it, then resolving each relevant category as keep, informed override, planned replacement, pending review, or honest gap; hand the resulting proposal directly to Stage 4 without silently activating or changing a routine

**Product authority:** the ten category decisions under `docs/personal-plan/categories/*/decision.md` in the active Stage-1 implementation worktree, including its currently uncommitted Heat Protectant decision, with the approved five-stage journey as the cross-stage authority. Those documents use their own category-local three-stage vocabulary (`Bedarf → Produkte → Anwendung`); in this cross-journey plan, their category-local Product Stage maps to journey Stage 3 and their Application Stage maps to journey Stages 4–5.

**Reviewed visual evidence:** `plans/mockups/2026-08-07-personal-plan-stage3-products-flow.html`

**Final integration depends on:** the stable Stage-1 category contracts, Stage-2 `Stage2CompleteResponse`, and the Stage-4 routine-proposal/confirmation contract. The standalone build deliberately does not copy files from the in-progress Stage-1 or Stage-2 worktrees.

## 0. Independent construction boundary

Stage 3 can be constructed while Stages 1 and 2 are still in progress, but standalone construction and cross-stage integration are separate completion states.

### Milestone A — standalone Stage 3

Build and verify:

- integration-neutral inputs representing a refined need version and ordered category requirements;
- the two-pass product-session state machine and deterministic completion gates;
- product search, exact selection, frequency capture, fallback-intake, and semantic-role assignment behind typed gateways;
- category verdict projections and choice transitions behind category-authority adapters;
- the approved mobile-first production components and a guarded fixture preview;
- a stable proposed-product-portfolio output for Stage 4;
- deterministic, component, accessibility, and browser fixtures for the approved journey and recovery states.

Milestone A uses fixture IDs, an in-memory gateway, and explicit stub category-authority results. It owns the local ten-category and semantic-role types because the neighboring branches do not yet expose stable source contracts. It does not create production tables or APIs, write `user_product_usage`, submit real intake records, call recommendation commerce links, activate `/plan-start/produkte`, or create an active routine.

### Milestone B — integration

The first development-only integration slice is complete:

- Stage 2 exposes an explicit completion callback instead of a fixture-only dead-end;
- the completed Stage-2 session is converted into `PlanRoutineContext` and recomputes the deterministic Stage-1 plan with `projection: 'refined_post_plan'`;
- a pure adapter converts that refined snapshot into `Stage3EntryContext`, preserving the refined rendered category order;
- the combined Labs journey replaces the `Produkte erfassen` placeholder with the real Stage-3 capture → role → fit flow;
- editing a completed Stage-2 answer invalidates the old handoff, and an unfinished Stage-3 draft restarts as a whole against the successor `refinedVersionId`;
- the standalone Stage-2 and Stage-3 Labs routes remain available and compatible.

This slice deliberately remains development-only and fixture/in-memory-backed. It does not add Supabase persistence, mutate real intake, activate a production customer route, or activate Stage 4.

### Remaining Milestone B — production integration, deferred

Once the neighboring contracts are stable:

- adapt the real refined Stage-2 version into the Stage-3 entry context;
- add authenticated, RLS-protected product-session and immutable portfolio-version persistence;
- reuse the live catalog lookup and existing product-intake submission workflow;
- bind category authorities to exact products and role assignments;
- produce the real Stage-4 routine proposal and successor-proposal events;
- project compatible confirmed ownership back to legacy product-usage consumers without losing Stage-3 multiplicity;
- run database and browser coverage across Stage 2 completion, Stage 3, Stage 4 confirmation, later intake resolution, and successor confirmation.

Milestone B must consume the standalone ports. If an adapter cannot satisfy a port without changing user-visible behavior or category policy, stop and return to planning.

## 1. Compact implementation contract

### Scope

- authenticated users entering from a completed immutable Stage-2 refined version;
- Pass 1: category inventory, search-first exact product identification, product-specific frequency, fallback intake, and semantic role assignment where the category requires it;
- Pass 2: category/product comparison, short fit rationale, direct recommendation for uncovered roles, price/availability context, and explicit user decisions;
- resumable drafts, optimistic concurrency, deterministic invalidation, and local pending-review behavior;
- a versioned Stage-4 product-portfolio proposal that distinguishes in-hand, override, planned purchase, pending review, inactive, unassigned, and uncovered states;
- the approved five-screen mobile journey, including loading, empty, error, conflict, resume, and recovery states.

### Non-goals

- no separate Stage-3 result page;
- no active routine creation or silent routine mutation;
- no catalog research/review cockpit or intake approval implementation;
- no seller ranking, checkout, price-history, stock guarantee, or acquisition inference from an outbound click;
- no new category policy or hair-care claim outside the confirmed category authorities;
- no automatic rotation or artificial frequency split for multiple suitable products;
- no redesign of Stage 4 beyond the typed handoff and pending/gap commentary it must receive;
- no expansion to unsupported free-text categories, styling inventory, or speculative ingredient analysis.

Current-main catalog taxonomy supports eight of the ten Personal Plan categories. `heat_protectant` is explicitly catalog-unsupported and `scalp_care` has no catalog identity key or recommendation engine. They remain in the Stage-3 domain because they are confirmed Personal Plan categories, but Milestone A represents them with fixtures only. Milestone B must land catalog taxonomy, owned-assessment lookup support, and authority-backed recommendation capability before either can use live search/recommendation. Until then they may not be silently omitted, mapped to another category, or presented as recommendable.

### Verification

- pure state-machine and category-policy fixtures for every choice/lifecycle transition;
- gateway contract tests for search, save/resume, intake fallback, revision conflicts, completion, and invalidation;
- component and browser tests at 375px and desktop for the full happy path and critical recovery paths;
- database contract/RLS tests in Milestone B;
- proof that Stage 3 never treats a search result as an owned product before selection, an outbound click as acquisition, a pending product as executable, or a portfolio proposal as an active routine.

### Stop conditions

Stop and return to planning if implementation requires:

- changing a confirmed category authority or inventing missing product facts;
- treating an unknown or pending product as a confident recommendation;
- choosing one global primary Oil or flattening Oil purposes;
- forcing one primary Conditioner when several suitable owned Conditioners may remain interchangeable;
- persisting multiple owned products only through the legacy one-row-per-category table;
- field-level salvage after the underlying refined version changes;
- activating or modifying a routine without explicit whole-routine confirmation;
- exposing the standalone fixture gateway to production traffic.
- activating Scalp Care or Heat Protectant live search/recommendation before their catalog and authority adapters exist.

## 2. Chosen experience and planning evidence

Stage 3 uses two internal passes but presents one continuous, unnumbered customer flow with a short contextual transition before each change in activity:

1. `Produkte finden` identifies exact owned products and their real use; role assignment remains inside the same natural flow.
2. `Produkte prüfen` resolves fit and the next action category by category.

The UI never exposes `Pass 1`, `Pass 2`, `Teil 1 von 2`, stage numbers, or a two-step explainer. Those are implementation concepts only.

The visual artifact answered the hierarchy, copy, and mobile-density questions. Nick approved it on 2026-08-07 after these revisions:

- Page 1 is one search field with ranked catalog suggestions; photo/manual intake appears only after `Nicht dabei? Produkt hinzufügen`.
- Page 2 assigns semantic roles only for role-bearing categories, especially Oil; one product may cover several Oil purposes.
- Page 3 uses the selected comparison-table variant with three short criteria and one-line explanations of why each matters.
- Page 4 is a compact positive confirmation, pairing each need with the selected product's fit and keeping the CTA visible on mobile.
- Page 5 is a short transition into Stage 4; pending commentary belongs on the affected Routine category, not in transition copy.
- The artifact's compact critical-state appendix covers loading, no result/intake fallback, save retry, and revision-conflict resume without adding new hierarchy or explanatory copy.
- Before capture, a short screen says that the products the user actually uses will now be identified. After capture and role assignment, a second short screen says that those found products will now be checked for fit. Neither transition exposes pass/stage numbering or explains the system model.

**Evidence review status:** confirmed by Nick on 2026-08-07 for journey order, information hierarchy, transition purpose/copy, category pages, mobile containment, and critical-state behavior. Nick explicitly described the transition styling as poor but acceptable for the planning artifact. Therefore the HTML is behavioral/layout evidence, not pixel authority: production must inherit the existing onboarding shell, typography, spacing, button, and transition conventions and must not copy the mockup's centered bordered transition cards literally. This styling constraint does not reopen the confirmed journey; any meaningful production hierarchy or interaction change does.

Rejected Page-3 variants and redundant copy are intentionally discarded. The HTML mockup remains the durable evidence; transient render images are not part of the implementation artifact.

## 3. Cross-stage ports

### Stage-2 entry

The integrated route accepts only the completed Stage-2 server handoff:

```ts
type Stage2CompleteResponse = {
  status: 'complete'
  personalPlanId: string
  refinedVersionId: string
  next: {
    stage: 3
    pass: 'product_capture'
    href: '/plan-start/produkte'
  }
}
```

The browser carries identifiers and navigation only. Stage 3 loads the immutable refined version server-side, verifies ownership and completion, and derives its entry context through an adapter:

```ts
type Stage3EntryContext = {
  schemaVersion: 1
  personalPlanId: string
  refinedVersionId: string
  orderedCategories: Stage3CategoryRequirement[]
  inventoryPrompts: Stage3InventoryPrompt[]
}

type Stage3CategoryRequirement = {
  category: PersonalPlanCategory
  requiredRoles: Stage3SemanticRole[]
  needSummary: string
  authorityVersion: string
}
```

Milestone A defines the missing local primitives rather than assuming upstream source code:

```ts
type PersonalPlanCategory =
  | 'shampoo'
  | 'conditioner'
  | 'leave_in'
  | 'heat_protectant'
  | 'oil'
  | 'mask'
  | 'scalp_care'
  | 'dry_shampoo'
  | 'bondbuilder'
  | 'deep_cleansing_shampoo'

type Stage3SemanticRole =
  | ShampooRole
  | OilPurpose
  | ScalpCareRole
  | HeatProtectionRole
  | CategoryPrimaryRole

type Stage3InventoryPrompt = {
  category: PersonalPlanCategory
  allowsMultiple: boolean
  allowsExplicitNone: true
}
```

Task 1 also defines every referenced projection type: `Stage3CatalogCandidate`, `Stage3CriterionResult`, `Stage3Recommendation`, `Stage3CategoryResolution`, `Stage3OwnedProduct`, `Stage3PlannedPurchase`, `Stage3PendingProduct`, `Stage3UncoveredRole`, `Stage3CategoryProgress`, and `Stage3BlockingReason`. Their fields must be derived from the canonical models below; they are not loose UI-only objects.

The entry adapter, not the client, owns category order, role requirements, and need summaries. The client cannot infer a requirement from UI labels.

### Refined-version invalidation

Every draft is keyed to `refinedVersionId`. If Stage 2 is edited after a Stage-3 draft has begun:

1. preserve any already confirmed immutable portfolio version and active routine history;
2. mark the unfinished Stage-3 draft stale;
3. warn that product decisions must be checked against the updated needs;
4. discard the whole unfinished draft after explicit acknowledgement;
5. restart at Pass 1 from the new refined version.

No field-level invalidation or silent answer transplant is allowed in V1.

### Stage-4 output

Stage 3 does not render a complete result. Its completion transaction freezes a portfolio version and asks the Stage-4 adapter to create a routine proposal:

```ts
type Stage3CompleteResponse = {
  status: 'ready_for_routine'
  personalPlanId: string
  refinedVersionId: string
  productPortfolioVersionId: string
  routineProposalId: string
  next: {
    stage: 4
    href: string
  }
}
```

The portfolio version contains enough evidence for Stage 4 to render available steps and honest gaps without reinterpreting Stage-3 decisions:

```ts
type ProposedProductPortfolio = {
  schemaVersion: 1
  portfolioVersionId: string
  personalPlanId: string
  refinedVersionId: string
  sourceDraftRevision: number
  categoryResolutions: Stage3CategoryResolution[]
  ownedProducts: Stage3OwnedProduct[]
  plannedPurchases: Stage3PlannedPurchase[]
  pendingProducts: Stage3PendingProduct[]
  uncoveredRoles: Stage3UncoveredRole[]
  createdAt: string
}
```

Stage 4 is the first complete product-aware result. The user must explicitly confirm the whole routine before it becomes the active persistent version.

## 4. Canonical Stage-3 model

### Draft/session

```ts
type Stage3Pass = 'product_capture' | 'product_decisions' | 'ready_for_routine'

type Stage3ProductDraft = {
  schemaVersion: 1
  authorityVersions: Partial<Record<PersonalPlanCategory, string>>
  draftId: string
  userId: string
  personalPlanId: string
  refinedVersionId: string
  revision: number
  pass: Stage3Pass
  orderedCategories: PersonalPlanCategory[]
  categoryCursor: string | null
  products: Stage3CapturedProduct[]
  roleAssignments: Stage3RoleAssignment[]
  decisions: Stage3ProductDecision[]
  completedCaptureCategories: PersonalPlanCategory[]
  completedDecisionKeys: string[]
  createdAt: string
  updatedAt: string
}
```

The server owns the canonical draft and allowed transition. Client actions include the last observed `revision`; stale writes receive a typed conflict and the latest server draft.

Each category decision is invalidated against its own `authorityVersions[category]`. There is no draft-global authority version that can hide drift in one category.

### Product identity

```ts
type Stage3ProductIdentity =
  | {
      kind: 'catalog_product'
      productId: string
      displayName: string
      category: PersonalPlanCategory
    }
  | {
      kind: 'pending_submission'
      submissionId: string
      usageId: string | null
      displayName: string
      category: PersonalPlanCategory
      reviewStatus: 'pending_review' | 'needs_more_info'
    }

type Stage3CapturedProduct = {
  capturedProductId: string
  identity: Stage3ProductIdentity
  frequencyRange: ProductFrequency
  ownership: 'owned'
  source: 'catalog_search' | 'intake_fallback' | 'existing_inventory'
}
```

Search suggestions are candidates, not ownership. A product enters the draft only after the user selects it and supplies its required frequency. The fallback flow reuses current photo/manual intake and may return either an exact catalog match or a pending submission.

### Roles and multiplicity

```ts
type Stage3RoleAssignment = {
  capturedProductId: string
  category: PersonalPlanCategory
  roles: Stage3SemanticRole[]
}
```

Role rules come from category authority:

- Oil is assigned per purpose; one product may cover multiple purposes, each purpose has at most one active in-hand product, and there is no global primary Oil.
- Shampoo uses role allocation only when the confirmed refined requirement contains distinct Shampoo roles; the eventual primary is derived from greatest planned use, not asked as an arbitrary label.
- Scalp Care uses one main product per role and blocks completion when several candidates share a role without a selection.
- Conditioner may keep several suitable owned products as interchangeable; it must not invent a primary or per-product frequency split.
- Bondbuilder and Mask may have one scheduled primary with other suitable products visible but unassigned.
- Deep Cleansing and Dry Shampoo retain additional products as saved/unranked rather than rotating them.
- Heat Protectant may reuse a verified fitting Leave-in or Oil; a false/unknown heat-protection capability cannot cover the role.

### Fit and decision axes

Product evidence and user choice remain separate:

```ts
type Stage3FitVerdict =
  | 'ideal'
  | 'supportive'
  | 'mismatch'
  | 'unknown'

type Stage3ChoiceState =
  | 'owned_active'
  | 'owned_override'
  | 'planned_purchase'
  | 'pending_review'
  | 'inactive'
  | 'unassigned'

type Stage3ProductDecision = {
  decisionKey: string
  category: PersonalPlanCategory
  role: Stage3SemanticRole | null
  capturedProductId: string | null
  verdict: Stage3FitVerdict
  choiceState: Stage3ChoiceState
  criterionResults: Stage3CriterionResult[]
  recommendation: Stage3Recommendation | null
  limitationAcknowledged: boolean
}
```

Working German labels are:

| Canonical verdict | User label |
| --- | --- |
| `ideal` | `Passt sehr gut` |
| `supportive` | `Passt mit Einschränkung` |
| `mismatch` | `Wechseln empfohlen` |
| `unknown` | `Noch in Prüfung` |

`unknown` is never converted to a positive verdict. Pending products remain local to their category/role and cannot become executable routine products.

### Choice transitions

- `Weiterverwenden` on a fitting owned product → `owned_active` (or an authority-defined interchangeable/unassigned owned state).
- `Mein Produkt behalten` on a mismatch → `owned_override`, only after the limitation remains visible and is acknowledged.
- `Empfehlung einplanen` → selected recommendation becomes `planned_purchase`; the mismatching owned product becomes `inactive` or `unassigned`, and the role remains an honest gap until acquisition.
- `Noch nicht entscheiden` → no active selection; role remains uncovered and can be resumed.
- pending identity → `pending_review`; other categories continue.
- later acquisition is an explicit user action that creates a successor proposal; an outbound seller click does not change state.
- later review resolution creates a proposed successor portfolio/routine; it never silently changes the active routine.

## 5. Product search, intake, and recommendation reuse

### Search-first identity

The existing `/api/products` endpoint is insufficient as the direct Stage-3 contract because it searches only `name`, exposes only Chaarlie-recommended products, and does not return the richer ambiguity states needed for owned-product identity. `lookupProductCandidate` is also an exact/ambiguous identity resolver, not a partial-query search endpoint. Implement a new authenticated Stage-3 catalog-query path for search-as-you-type, then use the existing normalization/brand-resolution primitives and `lookupProductCandidate` only to validate the selected/full identity before capture.

```ts
type Stage3CatalogSearchResult = {
  query: string
  category: PersonalPlanCategory
  candidates: Stage3CatalogCandidate[]
  totalCapped: boolean
}
```

Requirements:

- wait 250 ms, require two trimmed characters, return at most eight candidates, and cancel/ignore stale requests;
- query all active identity candidates using existing `intake_dedupe` eligibility because ownership is not established until selection; after explicit capture, assess the selected product through `owned_assessment` with verified-spec context; do not conflate either with `general_recommendation` eligibility;
- rank exact brand/product identity before looser candidates;
- constrain/validate category while allowing the identity resolver to surface a category mismatch;
- display only facts present in catalog data;
- selection is explicit and idempotent.

The fallback action is always visible after a query when the intake feature is enabled; it is not controlled by an unspecified search-response flag.

### Existing fallback intake

`Nicht dabei? Produkt hinzufügen` opens the existing onboarding intake form/field components through a Stage-3 adapter. It preserves current upload validation, manual/photo schemas, feature flag, service-owned writes, review status, and cancel/replace guards.

The legacy intake implementation currently assumes one `user_product_usage` row per category and throws a conflict unless replacement is confirmed; the migration also asserts that this uniqueness remains. Stage 3 must not call it once per captured product, replace siblings, or drop that legacy invariant. Milestone B uses a new Stage-3 portfolio-item/submission association while leaving existing onboarding/chat usage behavior intact. That association must reuse review-queue and resolution machinery without requiring a legacy usage slot for each captured product. Until this is implemented and database-tested, multi-product fallback intake is an integration blocker.

### Direct recommendation

Each uncovered role receives one primary recommendation only when the category authority and verified product facts support it. A small bounded alternative set may be shown when it represents a real tradeoff. Recommendations:

- reuse the deterministic category-specific engines and general-recommendation eligibility;
- record authority/rule IDs and criterion evidence;
- never use legacy suitability arrays as the final verdict;
- exclude unknown facts from positive claims;
- show current price and availability with freshness/source context when available;
- show seller detail and affiliate disclosure at or before the outbound action;
- never infer acquisition, active ownership, or routine use from opening the link.

If there is no safely supported match, show an honest uncovered role rather than a low-confidence product.

## 6. Persistence and lifecycle

Milestone B adds dedicated Stage-3 persistence rather than expanding `user_product_usage` into the canonical portfolio model:

- `personal_plan_product_drafts`: one mutable draft per user/refined version, schema/decision version, revision, pass/cursor, canonical JSON payload, stale/completed timestamps;
- `personal_plan_product_portfolio_versions`: immutable completed portfolio payload, refined-version foreign key, source draft/revision, created timestamp;
- a narrow portfolio-item/submission association for multi-product intake linkage and later resolution, without changing legacy `user_product_usage` uniqueness;
- optional further normalized rows only where required for queries or referential integrity; avoid mirroring the full JSON model twice.

Required invariants:

- RLS limits reads/writes to the owner; completion and version freezing are server-controlled;
- only one open draft per user/refined version;
- completion is idempotent for the same draft revision;
- completed portfolio versions are immutable;
- every catalog product and submission identity is owner/category validated;
- every role and decision key belongs to the server-derived entry context;
- pending/planned/uncovered states never appear as executable products;
- legacy projections are derived after completion and cannot erase sibling products or role distinctions;
- intake resolution appends a successor proposal event against the relevant immutable portfolio, not an in-place rewrite.

`user_product_usage` remains a compatibility/read model for existing onboarding/profile/routine consumers until they migrate. Its one-row-per-category constraint makes it unsuitable as Stage 3's source of truth.

## 7. Server-owned path and completion rules

The server returns a projection describing the next canonical page. It—not the component tree—decides which category/product/role is unresolved.

```ts
type Stage3PathState = {
  pass: Stage3Pass
  orderedStepKeys: string[]
  completedStepKeys: string[]
  firstUnresolvedStepKey: string | null
  categorySummaries: Stage3CategoryProgress[]
  canCompleteCapture: boolean
  canCreatePortfolio: boolean
  blockingReasons: Stage3BlockingReason[]
}
```

Pass 1 completes only when:

- every server-requested inventory category is explicitly answered, including explicit no-product;
- every selected owned product has exact or pending identity and product-specific frequency;
- every required semantic role is assigned or explicitly uncovered;
- category multiplicity constraints are satisfied.

Pass 2 completes when every non-pending decision key has an explicit allowed choice and every pending/uncovered role has an honest stored state. A pending category does not block progress into Stage 4.

Portfolio creation excludes pending, planned, inactive, and unassigned products from executable routine coverage. It may still complete with gaps, provided those gaps are explicit and Stage 4 can render them.

## 8. Designed user journey

### Entry and resume

1. Stage 2 completes and navigates to `/plan-start/produkte` with opaque identifiers.
2. The server verifies the user/refined version and loads or creates the matching draft.
3. A short unnumbered transition says: `Welche Produkte nutzt du? Jetzt finden wir die Produkte, die du wirklich benutzt.`
4. A returning user resumes at the first unresolved server-owned step, with a compact `Gespeichert` status; the transition is not replayed on every resume unless Part 1 has not begun.
5. An unavailable or stale refined version shows a recoverable explanation and returns to the owning plan, never a blank flow.
6. The user may leave at any time; completed mutations are saved and the plan overview provides `Produkte fortsetzen`. Leaving never completes or activates anything.

### Pass 1 — capture

1. The user sees the next category inventory prompt.
2. They type brand/product into one search field and see ranked candidates.
3. Selecting a candidate confirms the exact identity; the user supplies how often this exact product is used.
4. They can add another product in the same category or explicitly finish the category.
5. If the product is absent, `Nicht dabei? Produkt hinzufügen` opens photo/manual intake. A match returns to capture; an unresolved submission appears as `In Prüfung` and the user continues.
6. For role-bearing categories, the user assigns products to the required purposes. One Oil may be checked for several purposes.
7. Invalid/ambiguous assignments stay local with a direct correction; saved earlier categories remain intact.

### Pass 2 — decisions

1. After all capture and required role assignment, a short unnumbered transition says: `Wie gut passen deine Produkte? Jetzt schauen wir uns die gefundenen Produkte an und prüfen, wie gut sie zu deinem Haar passen.`
2. Stage 3 presents categories in server-owned order.
3. A fitting product receives the compact positive page: the need, a need-versus-fit table, and `Weiterverwenden`.
4. A mismatch receives the selected comparison-table page: three concise criteria, why each matters, what the owned product provides, and the recommended alternative.
5. The primary actions make product ownership unambiguous: `Empfehlung einplanen` applies to the named recommendation; `Mein Produkt behalten` applies to the named owned product and keeps the limitation visible.
6. Price/availability accompany the recommendation. Seller and affiliate details appear with the outbound action.
7. A pending identity reads `Noch in Prüfung`, blocks only that product/category, and does not imply fit.
8. No safe match produces an honest uncovered role and allows the rest of the plan to proceed.
9. `Anderes Produkt wählen` returns to the relevant Pass-1 category, preserves other categories, and invalidates only that category's unconfirmed decisions after acknowledgement.

### Transition and Stage 4

1. After the last resolvable decision, Stage 3 freezes the immutable portfolio and creates the Stage-4 proposal in one idempotent server transaction.
2. A short transition says the routine is ready and opens Stage 4.
3. Stage 4 shows the complete routine proposal, marking pending/uncovered categories in place, for example `Noch in Prüfung` on Scalp Care.
4. Only the user's explicit whole-routine confirmation creates the active routine version.

### Later change

1. Marking a planned product as acquired, or resolving an intake review, does not alter the active routine.
2. The server produces a successor portfolio/routine proposal describing the affected category.
3. The user explicitly confirms that successor before it becomes active; the prior version remains in history.

## 9. UI/component target map

Milestone A creates integration-neutral modules under:

- `src/lib/personal-plan/products/` — schemas, state machine, path/completion logic, portfolio projection, category adapter contracts, fixture gateway;
- `src/components/personal-plan-products/` — shell, search/results, frequency, intake adapter boundary, role assignment, fit/mismatch/pending pages, transition, save/error/conflict states;
- the transition component renders both unnumbered context changes from server-owned step state; it is not duplicated as page-specific copy and never exposes internal pass numbering;
- transition presentation reuses current onboarding layout primitives and design tokens; the mockup's literal bordered-card styling is non-authoritative;
- `src/app/labs/personal-plan-stage-3/` — guarded standalone preview using the real components and fixture gateway;
- `tests/personal-plan-stage3-*.test.ts(x)` — pure, gateway, component, and artifact tests;
- `tests/personal-plan-stage3.spec.ts` — responsive Playwright journey and recovery coverage, paired with a new explicit `test:playwright:personal-plan-stage3` script included by `test:contracts`.

Milestone B adds:

- authenticated `/plan-start/produkte` server/client composition;
- `src/app/api/personal-plan/products/**` route handlers;
- Supabase migrations and generated types;
- adapters to Stage 2, category authorities, catalog/intake, and Stage 4;
- integration and database/RLS tests.

Do not place category verdict policy in React components or API route files.

## 10. Ordered implementation tasks

### Task 1 — freeze integration-neutral contracts and fixtures

- add schemas/types for entry context, draft, identity, roles, verdicts, choices, path state, and portfolio output;
- define the ten-category union, semantic-role unions, and every named projection type locally;
- encode fixture category requirements covering Shampoo, Conditioner, Oil, Scalp Care, and Heat Protectant edge cases;
- add contract tests rejecting illegal identity/choice/role combinations.

**Check:** deterministic schema tests pass; no Stage-1/2 worktree import exists.

### Task 2 — implement the pure two-pass state machine

- implement server-owned ordered steps, descendant pruning, multiplicity checks, allowed decision transitions, and completion gates;
- implement whole-draft refined-version invalidation;
- implement portfolio projection that excludes non-executable states.

**Check:** table-driven fixtures cover all verdict/choice states, category multiplicity rules, pending locality, gaps, revision conflicts, and idempotent completion.

### Task 3 — define and implement the fixture gateway

- expose load/create, search, mutate, resume, conflict, and complete operations;
- simulate latency/errors and opaque version/proposal IDs;
- ensure the fixture adapter performs no Supabase or production-network writes.

**Check:** gateway contract suite passes against the fixture implementation.

### Task 4 — build Pass 1 production components

- build mobile shell/progress/save state;
- build the approved unnumbered product-identification orientation and ensure resume does not replay it after capture has begun;
- style it through the current onboarding shell and transition conventions rather than porting the planning artifact's literal card treatment;
- build one-field search and ranked explicit selection;
- implement the 250 ms / two-character / eight-result fixture query behavior and exact-identity validation boundary;
- build exact-product frequency and multi-product category controls;
- build the fallback-intake boundary and pending representation;
- build semantic-role assignment with Oil multi-role support.

**Check:** component/accessibility tests plus 375px browser happy path, no-result fallback, pending, multi-product, and role-validation paths.

### Task 5 — build Pass 2 and transition components

- build the approved unnumbered fit-check transition, fit confirmation, selected comparison table, recommendation/override actions, price/availability, unknown/gap state, and short Stage-4 transition;
- apply the same existing-surface styling rule to both contextual transitions and verify they feel continuous with the surrounding onboarding flow;
- keep product/action ownership clear in accessible names and visible headings;
- preserve sticky CTA visibility without covering content or requiring excessive scrolling.

**Check:** component/accessibility tests plus 375px/desktop screenshots and browser actions for fit, mismatch, override, planned purchase, unknown, and no-safe-match states.

### Task 6 — harden standalone preview

- compose the approved end-to-end fixture journey;
- add refresh/resume, Back, offline/save retry, stale revision, and stale refined-version demonstrations;
- guard the route from production.

**Check:** complete browser suite and production-route guard test.

### Task 6a — add typed analytics and release controls

- extend `src/lib/analytics/events.ts` and `src/lib/analytics/routes.ts` with the privacy-safe structural events from Section 12;
- route events through `trackAppEvent`; never call destinations directly from Stage-3 components;
- add a `personal_plan_stage3_enabled` entry flag/kill-switch independent of other stages, default off outside explicit preview/test users;
- document rollback as disabling Stage-3 entry while preserving drafts and immutable versions;
- set a search interaction budget: cached/healthy responses should return within 500 ms p95, with non-blocking retry/error UI above that.

**Check:** event-schema/routing tests, payload privacy assertions, flag-off route behavior, and no direct PostHog/Meta calls.

### Task 7 — integrate persistence and real gateways (Milestone B)

- add migrations/RLS/immutability and authenticated handlers;
- adapt Stage-2 entry, category authorities, catalog lookup, intake lifecycle, and recommendation engines;
- resolve multi-product fallback intake without abusing the legacy category slot;
- create immutable portfolio + Stage-4 proposal transactionally;
- add later acquisition/review successor-proposal handling and compatibility projections.

**Check:** migration/RLS tests, API contracts, idempotency/revision tests, and no silent routine mutation.

### Task 8 — integrated journey verification and activation

- run Stage 2 → Stage 3 → Stage 4 confirmation with exact, pending, mismatch, override, planned, and uncovered paths;
- test Stage-2 edit invalidation and later intake/acquisition successor confirmation;
- verify responsive, accessibility, analytics/privacy, and legacy projection behavior;
- activate the production CTA only when a working Stage-3 destination and Stage-4 proposal consumer exist.
- roll out Stage 3 behind its own flag/kill-switch before any broader five-stage activation.

**Check:** repository ready-check and full browser/database receipt.

## 11. Verification matrix

| Area | Required evidence |
| --- | --- |
| Schemas/state machine | unit fixtures for every legal/illegal transition and category multiplicity rule |
| Search | two-character boundary, eight-result cap, exact, ambiguous, no-result, category mismatch, stale request, active `intake_dedupe` identity candidates, then verified `owned_assessment` after capture |
| Intake | matched and pending outcomes, upload/manual recovery, multi-product association, cancel/replace safety |
| Decisions | ideal/supportive/mismatch/unknown; keep/override/plan/pending/uncovered |
| Portfolio | executable filtering, immutable version, idempotent completion, role gaps, evidence provenance |
| Persistence | owner RLS, cross-user rejection, revision conflict, stale refined version, immutable completed rows |
| Stage 4 handoff | proposal creation, pending/gap rendering data, no active routine before confirmation |
| Later lifecycle | acquisition/review creates successor; explicit confirmation; prior active version unchanged |
| UI | keyboard/screen reader, German copy, both unnumbered context transitions, no visible pass/stage framing, no unwanted replay on resume, approved loading/no-result/save-retry/conflict states, leave/resume, 375px and desktop containment, and browser evidence that transitions reuse the existing onboarding visual language rather than the mockup's provisional card styling |
| Regression | onboarding/chat intake, profile inventory, existing routine loaders, recommendation eligibility |

Run the focused Node/component tests, `npm run test:playwright:personal-plan-stage3`, `npm run test:contracts`, and `npm run ci:verify`, then the repo `ready-check` before claiming review readiness.

## 12. Analytics, privacy, and operational constraints

Track only structural funnel events and opaque IDs through the existing typed analytics router (`src/lib/analytics/events.ts`, `routes.ts`, and `track-app-event.ts`): stage/pass/step key, search-result count band, selected-candidate position, fallback opened, decision type, save/retry/conflict, completion, and handoff. Do not send raw search queries, product names, uploaded image paths, free text, criterion evidence, or health-adjacent profile details to analytics.

Uploaded images and pending submissions retain the existing private-bucket, ownership, retention, and review controls. Stage-3 persistence references submission IDs; it does not copy image paths or researched payloads into the portfolio.

Price/availability uses existing `price_eur` and `price_checked_at` where present and must be treated as time-sensitive display data with source/freshness metadata, not frozen as a product-fit fact. Portfolio evidence stores the product/rule decision, not a promise that a seller remains available.

## 13. Review and handoff

Before implementation:

1. reconcile this plan against one read-only Claude counterpart review — complete 2026-08-07;
2. record accepted/rejected findings in the findings ledger below — complete 2026-08-07;
3. walk Nick through the final designed journey in Section 8 — complete 2026-08-07;
4. obtain explicit journey sign-off, including the critical-state appendix — complete 2026-08-07;
5. preserve the transition styling as explicitly provisional and use existing onboarding conventions in production — confirmed 2026-08-07.

After implementation, `implementation-loop` owns execution, `ready-check`, and the meaningful whole-branch counterpart review before any `ship-it` request.

**Artifact disposition:** commit this plan and its HTML mockup as durable decision evidence. The mockup's flow and copy placement are authoritative; its transition styling is not. Discard the transient screenshots and Claude report from the system temporary directory.

## 14. Findings ledger

| ID | Source | Finding | Disposition | Plan change / evidence |
| --- | --- | --- | --- | --- |
| C1 | Claude | Core local types and projection types were referenced but not explicitly owned | accepted | Task 1 now defines the ten-category/role primitives and every named projection |
| C2 | Claude | Scalp Care and Heat Protectant are not live catalog-supported on current main | accepted | Added explicit Milestone-B catalog/engine blocker; retained both confirmed Personal Plan categories in fixture domain |
| C3 | Claude | Reported nine category decisions and no Heat Protectant authority | rejected | Active Stage-1 worktree contains ten decision files including uncommitted `heat-protectant/decision.md`; status is now explicit |
| C4 | Claude | `lookupProductCandidate` cannot back partial search | accepted | Added a new bounded query path; existing resolver is used only after selection/full identity |
| C5 | Claude | Eligibility terminology was inaccurate | accepted | Plan now names the existing `owned_assessment` mode on `isProductEligibleForMode` |
| C6 | Claude | Proposed browser spec path would not run | accepted | Added a flat spec plus explicit Playwright script wired into `test:contracts` |
| C7 | Claude | Reported repo workflow skills missing | rejected | `implementation-loop`, `ready-check`, and `ship-it` exist under `.agents/skills` and are mandated by `AGENTS.md` |
| C8 | Claude | Category-local three-stage language collides with journey Stage 3 | accepted | Added an explicit numbering translation at the authority boundary |
| C9 | Claude | Missing rollout flag, analytics ownership, exact search bounds, and per-category authority drift | accepted | Added Task 6a, concrete search limits, existing analytics-router targets, and per-category authority versions |
| C10 | Claude | Critical recovery states were not in reviewed evidence | accepted | Mockup extended with compact loading/no-result/save-retry/conflict states and included in Nick's confirmed final sign-off |
| C11 | Claude | Multi-product intake conflict is enforced, not a simple overwrite risk | accepted | Chose a new Stage-3 portfolio-item association; legacy uniqueness remains intact |
| C12 | Claude | Recommended reducing standalone scope to contracts/state/search only | rejected | Nick explicitly wants parallel implementation and has approved the full standalone UI journey; adapters and production activation remain deferred |
| U1 | Nick | The two-part order needs context before capture and before fit decisions | accepted | Added two concise transition screens; role assignment remains within Part 1 and category decisions remain paired within Part 2 |
| U2 | Nick | Showing `Teil 1/2` and a two-step map exposes the internal model and confuses the user | accepted | Removed all visible pass/stage numbering and phase pills; retained only natural identification and fit-check transitions |
| U3 | Nick | Transition styling is poor but acceptable for the plan | accepted | Journey signed off; plan now forbids literal styling reuse and requires production transitions to inherit existing onboarding visual conventions |
| R1 | Final code review | Preview/CI route classification used a phantom hyphenated path instead of the real nested route | accepted | Corrected both route gates to `/labs/personal-plan/stage-3` and moved the environment assertions onto that served path |
| R2 | Final code review | The explicit CI lab flag is redundant under the current `next dev` browser script | rejected | Retained the narrow default-off flag for parity with other lab routes and for non-development CI/preview runners; the corrected route-classification tests cover it |

## 15. Milestone A implementation receipt

Implemented on `codex/personal-plan-stage3-products` as a standalone, fixture-backed preview. Production persistence, real catalog/intake adapters, Stage-2 activation, and Stage-4 routine activation remain Milestone B and were not added.

### Delivered behavior

- typed Stage-3 contracts, category authorities, capture/decision state machine, descendant pruning, portfolio projection, optimistic revisions, and idempotent completion;
- a deterministic fixture gateway with bounded search, stale-response protection, explicit failure injection, pending intake, category reopen/removal, and completion handoff;
- the signed-off mobile-first journey: short unnumbered capture and fit transitions, search before fallback, exact-product frequency capture, multi-product Conditioner support, exact Oil-purpose assignment, fit/mismatch/pending/gap decisions, and a typed final proposal;
- product-owned mismatch actions, concise criterion explanations, fixed mobile decision actions, privacy-safe structural analytics, and a production-guarded lab route;
- a dedicated 375 px/desktop Playwright journey wired into the contract CI path.

### Orchestration and review evidence

- explorers mapped domain contracts, onboarding/UI reuse, and route/analytics/browser integration before implementation;
- bounded workers owned the domain, gateway, stateless components, release/analytics infrastructure, and browser/CI packaging; the orchestrator integrated and corrected their outputs;
- the central flow composition was reclaimed by the orchestrator after two delegated attempts stalled, without broadening the approved scope;
- simulated-user review found and fixed premature frequency/add-another controls and below-fold mismatch actions; the rerun kept all three product-owned actions visible at 375 px.

### Verification completed before final review

- focused Stage-3 domain, gateway, component, route, analytics, release, and workflow tests;
- full Node test suite: 2,768 passing;
- agent contract suite and Playwright contract suite passing;
- Stage-3 Playwright journey: 2 passing against the existing task-worktree dev server;
- exact-tree typecheck, ESLint, and production build passing in an isolated copy because the existing dev server owned the task worktree's `.next` lock;
- production build emitted the guarded `/labs/personal-plan/stage-3` route and 102 static pages.

The self-hosting Stage-3 npm wrapper was not run directly in the task worktree because terminating the existing dev server was outside this loop's authority. Its underlying browser suite passed against that server, and the package/CI orchestration is covered by repository tests. The fixture preview keeps drafts only in memory; durable refresh/resume and real recovery across browser reloads remain part of Milestone B persistence.

**Artifact disposition:** keep this plan and the reviewed HTML mockup as durable PR evidence. No generated screenshots, temporary build copy, Claude report, or browser traces are retained in the repository.

## 16. Development-only Stage 1 → 2 → 3 integration receipt

Integrated locally on `codex/personal-plan-stage1-2-integration` without adding production persistence, a customer route, real intake mutation, Stage-4 activation, publication, or deployment.

### Delivered integration behavior

- the Stage-2 bridge now exposes an explicit, retryable handoff action while retaining its standalone preview behavior;
- the server-side Labs adapter validates the completed handoff, derives `PlanRoutineContext`, recomputes the refined deterministic Stage-1 plan, and converts the resulting rendered order into `Stage3EntryContext`;
- the combined Labs journey replaces the placeholder with the real Stage-3 capture → role → fit flow;
- returning to Stage 2 preserves the completed refinement; editing it creates a successor refined version and remounts Stage 3 with a fresh whole draft;
- the adapter rejects initial projections, blank opaque IDs, and an impossible empty rendered category list;
- handoff failures expose recoverable German UI and emit only a coarse privacy-safe telemetry event.

### Verification and review

- focused Stage-1/2/3 adapter, flow, and component tests: 20 passing after the final review delta;
- full Node suite: 2,821 passing before the narrow final review delta, whose affected tests were rerun;
- combined Stage-1→3, standalone Stage-2, and standalone Stage-3 Playwright contract: 12 passing at mobile and desktop coverage;
- `npm run ci:verify`: typecheck, lint with four pre-existing warnings, and production build passing;
- `git diff --check`: passing;
- independent Claude correctness/structural review found one CI coverage gap and one diagnostic gap; both were fixed, and its residual empty-plan risk was converted into a tested fail-fast guard;
- the existing Personal Plan Playwright contract script now runs all three browser specs in CI.

**Artifact disposition:** keep this plan, reviewed mockups, source stabilization commits, and the local integration delta as task-owned implementation evidence. Keep the counterpart report and canonical manifest in the system temporary directory only. No generated browser traces or screenshots are retained.
