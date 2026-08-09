# Personal Plan — five-stage production consolidation

**Status:** implementation consolidated and review-ready; evidence review and designed-user-journey sign-off confirmed by Nick on 2026-08-08; the 2026-08-09 deadline decision remains `NO_ACTIVATION`

**Worktree authority:** `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-stage5-integrated` on `codex/personal-plan-stage5-integrated`, based on `3885138ebd54`

**Outcome:** make the production Personal Plan a truthful, continuous and resumable journey from a ready one-time purchase through Bedarf, refinement, exact products, Routine and Anwendung, while preserving the legacy journey for pre-cutoff users and keeping every release flag off by default.

## 1. Implementation contract

- **Outcome:** connect the already-built five stages without redesigning their signed individual experiences, remove fixture authority from the customer Stage-3 path, and enforce one server-owned journey frontier so an eligible owner is never admitted into a disabled or unready downstream stage.
- **Scope:** checkout-success routing, the short delayed-provisioning surface, Stage-1/2/3 handoffs, Stage-2 evidence projection, Stage-3 server authority and UI intents, Stage-4 acceptance/analytics/handoff, entitlement-scoped Personal Plan navigation, Stage-5 recovery, and one persisted production-shaped Stage-1-to-5 browser proof.
- **Verification:** test-first focused contracts for each slice; all Personal Plan unit/API/database/browser suites; typecheck, lint and production build with flags off; responsive signed-journey review; `ready-check`; then one whole-tree `request-code-review`.
- **Stop:** a verified review-ready handoff only. Do not commit, push, open a PR, merge, deploy, write production data, change production configuration, or activate a feature flag without separate authorization.

## 2. Source context and authority order

This plan is the integration authority for seams between the five approved stages. It does not replace a stage's settled internal behavior except where this document names a verified integration defect or a newly approved cross-stage rule.

1. This consolidation plan owns cross-stage entry, authority transfer, navigation, gating and end-to-end verification.
2. `plans/2026-08-07-personal-plan-five-stage-product-journey.md` owns the five-stage product order and the approved refinement journey.
3. `plans/2026-08-07-personal-plan-stage1-3-production-foundation.md` owns the Personal Plan aggregate, immutable Stage-1/2/3 versions, Stage-3 CAS draft, Product Intake boundary and atomic Stage-3-to-4 persistence.
4. `plans/2026-08-06-personal-plan-stage1-bedarf-implementation.md`, `plans/2026-08-07-personal-plan-stage2-refinement-implementation.md`, `plans/2026-08-07-personal-plan-stage3-products-implementation.md`, `plans/2026-08-07-personal-plan-stage4-routine-implementation.md`, and `plans/2026-08-08-personal-plan-stage5-application-implementation.md` retain authority inside their respective stages where they do not conflict with this plan.
5. `docs/personal-plan/categories/*/decision.md` and the shipped deterministic category modules remain the category-policy authorities. Stage 3 may adapt those facts to exact products; it may not replace them with a generic fit score.

### Reviewed design evidence

- `plans/mockups/2026-08-08-personal-plan-full-journey-review.html` is the signed continuous-journey evidence.
- `plans/mockups/2026-08-08-personal-plan-connected-handoffs.html` is the signed handoff, delayed-provisioning, navigation and legacy-coexistence evidence.
- Nick reviewed this evidence and explicitly signed off the designed journey on 2026-08-08. Implementation must match the shown information hierarchy and German copy, including the compact recovery states. The HTML is evidence, not production source code.

## 3. Settled decisions

There are no open product or UX decisions in this plan. Implementation must not reopen the following choices.

### Entry and cohort behavior

- A normal ready Personal Plan buyer enters `/plan-start` after payment/account activation.
- `/plan-bereit` remains only the short waiting surface for the rare case where payment is verified but entitlement or prepared-plan provisioning is not yet ready. Its polling success automatically continues to `/plan-start`; its explicit final CTA is **`Plan ansehen`**.
- A transient wait must never send a paid buyer back to pricing or ask them to repurchase. Recovery keeps the canonical lead/purchase identity.
- Legacy and pre-cutoff users retain the current legacy `/plan-bereit`/onboarding/Routine journey and legacy navigation. No historical plan is reconstructed from incomplete data.
- Cohort resolution is server-owned, based on the qualifying purchase and the existing `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF`; the browser cannot opt itself into the new journey.

### Stage 1 to Stage 2

The Stage-1 transition uses exactly:

- **Body:** `Als Nächstes verfeinern wir deinen Plan mit ein paar gezielten Fragen.`
- **CTA:** `Plan verfeinern`

The CTA enters the persisted Stage-2 refinement flow. Stage 1 does not skip directly to products.

### Stage-2 evidence semantics

- Reuse the existing towel-technique question. Technique `rough_rubbing` maps to **moderate mechanical exposure** in the refined plan. Technique `gentle_press`, or an absent technique because material is `no_towel`, adds no mechanical-exposure fact.
- Towel material is not a proxy for technique. `no_towel` continues to suppress the technique question.
- `rough_rubbing` alone cannot create a Basis Mask. It is one cumulative/exposure fact that may strengthen a Mask decision only with the existing independently observed need signals.
- Frequent ordinary airflow may contribute to cumulative Mask exposure. It never creates a Heat Protectant need.
- Event-specific `ordinary_airflow`, `airflow_shaping` and `direct_contact_heat` remain distinct. Do not collapse their frequency or protection facts into a maximum, average or generic heat score.

### Stage-3 authority and heat-carrier behavior

- The production client no longer constructs fixture verdicts, criterion results, recommendation products, authority IDs or decisions.
- Server-owned, category-discriminated authority adapters consume the exact Stage-1 category decisions, the plan-wide coverage ledger, Stage-2 refined facts, owned/pending product identities and typed catalog/category-spec facts.
- There is no generic score. Each adapter returns named, versioned category rules and explicit criterion outcomes. Missing evidence remains `unknown`; it is never coerced to a match, mismatch, recommendation or user-specific no-match.
- The browser submits a semantic user action against a server-issued decision subject. The server reloads the owner-scoped draft, validates the expected revision and authoritative subject, re-evaluates the category, validates that the action is currently allowed, and constructs the persisted `Stage3ProductDecision` itself.
- The server fixes `categoryCursor` advancement: completing a capture category advances to the next incomplete category in `orderedCategories`; after the last capture category, the pass changes to `product_decisions` and the cursor becomes `null`. Reopening a category restores that category as the cursor and invalidates only its dependent decisions.
- An independently required Leave-in whose verified product facts say it provides compatible protection for the user's required heat route may carry the heat-protection job. Render it once and retain the coverage relationship.
- If a suitable standalone Heat Protectant is already confirmed for the job, preserve it; do not silently replace it with a Leave-in merely to reduce item count.
- Heat exposure alone never creates a Leave-in need. A heat-capable Leave-in can carry heat only after Leave-in independently qualifies.
- Stage-3 completion truthfully offers **`Routine öffnen`** and links to the staged proposal on `/routine`. It does not imply that the Routine is active.

### Stage 4, Stage 5 and navigation

- A Routine proposal becomes active only after explicit whole-proposal confirmation. No extra Stage-4 success page is added.
- After successful confirmation, the Routine surface exposes the signed Anwendung entry in place. It does not interpose another completion screen.
- Personal Plan owners in the admitted rollout see the signed navigation in this exact order: **Chat · Routine · Anwendung · Profil**.
- The Personal Plan navigation is entitlement-, cohort-, feature- and frontier-scoped. Legacy/non-owner navigation remains visually and behaviorally unchanged.
- Stage-4 analytics are structural, bounded, PostHog-only and sent only when current cookie consent has `analytics: true`. Refusing, clearing or not yet choosing analytics consent yields a no-op without affecting the journey.
- A failed Routine acceptance remains visibly retryable against the current server proposal. A refresh must not close the sheet or lose the retry affordance while the proposal is still pending.
- An invalid or currently unavailable bookmarkable Anwendung day recovers to the available Anwendung overview with an explanation and retry/back action. Refreshing the same permanently invalid day URL is not the only recovery.

## 4. Scope and non-goals

### In scope

- truthful post-payment destination for ready and delayed-provisioning Personal Plan buyers;
- a monotone server-owned journey frontier and fail-closed route/API/navigation matrix;
- the approved Stage-1 transition copy and persisted Stage-2 entry;
- removal of stale Stage-2 `/plan-start/produkte` handoff authority;
- refined mechanical/ordinary-airflow evidence without changing the signed question flow;
- a versioned Stage-3 authority snapshot in the existing CAS draft JSON;
- ten category-discriminated exact-product adapters and server-side action validation;
- correct Stage-3 capture cursor advancement and truthful Routine handoff;
- retryable Stage-4 proposal acceptance, consent-safe analytics and Stage-5 CTA;
- entitlement-scoped Personal Plan navigation without changing legacy navigation;
- actionable direct-day recovery in Stage 5;
- one authenticated, persisted, production-shaped Stage-1-to-5 browser test.

### Non-goals

- redesigning an approved stage or adding a Stage-4 success page;
- routing Personal Plan customers through a Labs or fixture gateway;
- activating any Personal Plan, Stage-4 or Stage-5 flag;
- migrating legacy/pre-cutoff users into the new Personal Plan;
- changing payment provider semantics, entitlement policy, pricing or refund behavior;
- changing Product Intake image/upload semantics or mutating `user_product_usage`;
- inventing new category policy, generic scoring, product claims or fallback recommendations;
- adding calendar, completion, adherence or day-history persistence to Stage 5;
- adding a database migration merely to route pages or store a duplicate journey step;
- publication, production writes or deployment.

## 5. Architecture

### 5.1 One server-owned journey frontier

Add a single server-only resolver in `src/lib/personal-plan/journey-access.ts`. It combines entitlement, purchase cohort, global app release, Stage-4 release, Stage-5 rollout, owner-scoped persisted heads and pending/active Routine pointers. It returns no private snapshot payloads:

```ts
type PersonalPlanJourneyStage = "stage1" | "stage2" | "stage3" | "stage4" | "stage5"

type PersonalPlanJourneyAccess =
  | { kind: "legacy" }
  | { kind: "paid_pending"; recoveryHref: string }
  | {
      kind: "personal_plan"
      frontier: PersonalPlanJourneyStage
      allowed: Readonly<Record<PersonalPlanJourneyStage, boolean>>
      nextHref: "/plan-start" | "/routine" | "/anwendung"
      personalPlanId: string
    }
```

`frontier` is the highest contiguous stage the owner can truthfully enter from persisted server facts. It is monotone with respect to completed immutable versions and accepted Routine state: editing an earlier stage may mark a downstream draft/proposal stale, but it never fabricates access or erase immutable history. The current editable surface may move back to Stage 2 or 3 for a successor while the accepted Stage-4/5 version remains available until a new whole proposal is confirmed.

The resolver applies this fail-closed matrix:

| Request/surface          | Required facts                                                                                | Failure behavior                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| new journey entry        | active entitlement, new-buyer cohort, global app flag                                         | legacy route when pre-cutoff; disabled/not-ready recovery when cohort-eligible but flag off |
| Stage 1                  | eligible owner and prepared source                                                            | `/plan-bereit` only for genuine provisioning delay; otherwise owner-safe recovery           |
| Stage 2                  | Stage 1 current immutable need                                                                | redirect to Stage 1                                                                         |
| Stage 3                  | current completed refined need and Stage-3 authority availability for every required category | redirect to Stage 2 or return typed unavailable; never load fixture policy                  |
| Stage 4 proposal         | completed authoritative Stage-3 draft and Stage-4 flag                                        | Stage-3 handoff remains honest and retryable                                                |
| Stage 5                  | accepted active Routine, global app flag, Stage-4 flag and Stage-5 rollout                    | Routine recovery; never expose application content                                          |
| Personal Plan navigation | same entitlement/cohort plus route-specific allowed state                                     | render only reachable tabs; legacy header otherwise                                         |

All `/api/personal-plan/**` handlers continue to perform their own owner, entitlement, expected-revision and source-revision validation. The frontier is orchestration, not a replacement for API authorization.

### 5.2 Entry routing without a routing migration

`src/lib/billing/checkout-success-redirect.ts` remains the pure destination policy. Widen its typed Personal Plan destination so a ready new-cohort buyer resolves to `/plan-start`, while a verified paid-pending activation resolves to `/plan-bereit?lead=…`. `src/app/welcome/page.tsx` supplies actual activation state and cohort facts; it must not infer readiness from the presence of a lead alone.

`src/app/plan-bereit/page.tsx`, `status/route.ts`, `personal-plan-ready-client.tsx` and `transition.ts` remain the short delayed-provisioning path. On a ready poll response they navigate to `/plan-start`. The explicit accessible fallback is `Plan ansehen`. Legacy/pre-cutoff readiness retains its existing destination.

No database column is needed for the current route. Purchase time/source, lead quiz kind, entitlement state, cutoff and existing Personal Plan aggregate facts already decide the destination.

### 5.3 Stage-2 refined evidence

Extend the existing projection rather than adding questions:

- `src/lib/personal-plan/refinement/stage1-adapter.ts` adds the currently missing projection from `towel.technique === "rough_rubbing"` to a named moderate mechanical-exposure signal. Any other or absent technique produces no mechanical-exposure fact; `no_towel` is a material whose signed question path leaves technique absent.
- `src/lib/personal-plan/needs.ts` consumes the normalized mechanical signal and represents ordinary airflow separately from qualifying heat.
- `src/lib/personal-plan/categories/mask.ts` may count frequent ordinary airflow as cumulative Mask exposure and may count rough rubbing as moderate mechanical exposure, while keeping the existing exposure-only guard: neither fact alone creates Basis Mask.
- `src/lib/personal-plan/categories/heat-protectant.ts` retains `ordinary_airflow -> not_needed`.
- `src/lib/personal-plan/categories/leave-in.ts` retains the independent-care prerequisite for heat application.

The refined snapshot remains immutable and versioned. Re-editing Stage 2 creates/reuses a refined version through the existing transition and stales its unfinished Stage-3 descendant.

### 5.4 Stage-3 authority snapshot in existing CAS JSON

The required source facts already exist in the immutable refined need output: `InitialNeedPlanSnapshot.decisions`, `coverage`, normalized assessments and category authority versions. Therefore this plan does **not** add a Stage-3 authority table or SQL migration.

Extend the versioned `personal_plan_product_drafts.payload` contract with a bounded server-created snapshot:

```ts
type Stage3AuthoritySnapshotV1 = {
  schemaVersion: 1
  refinedNeedVersionId: string
  refinedInputHash: string
  categoryDecisions: PlanCategoryDecision[]
  coverage: PlanPortfolioCoverageFact[]
  orderedCategories: PersonalPlanCategory[]
  authorityVersions: Record<PersonalPlanCategory, string>
}
```

The server builds it when creating the draft by decoding the exact current refined version through its existing version registry. It validates that ordered requirements, decisions and coverage refer to the same category set. The snapshot is included in the existing bounded JSON and guarded by the existing draft revision/source CAS. It is not accepted from the browser.

An old draft without a valid authority snapshot returns typed `stale_authority_snapshot`; with all flags off and no supported customer activation, it may be replaced by a new draft against the same refined version. It is never silently upgraded from client data.

If implementation evidence proves the current JSON cannot safely retain a required fact, stop before a migration. The evidence must name the exact missing persisted fact, why it cannot be deterministically recovered from the immutable refined version plus existing product/category facts, and the minimum relational integrity requirement. Only then may a separately reviewed migration be proposed. Any new Data-API-visible table must have explicit grants, RLS, owner policies, integrity constraints and local pgTAP coverage. Routing alone is never sufficient justification.

### 5.5 Category-discriminated server adapters

Create `src/lib/personal-plan/products/authority/` as the only production Stage-3 evaluation boundary:

- `contracts.ts` defines the discriminated server input/output and semantic action intents;
- `catalog-facts.ts` loads only typed, active catalog identities and the category-specific spec rows needed by the requested category;
- `evaluate.ts` dispatches exhaustively by `PersonalPlanCategory` and rejects missing adapters;
- `categories/shampoo.ts`, `conditioner.ts`, `leave-in.ts`, `heat-protectant.ts`, `oil.ts`, `mask.ts`, `scalp-care.ts`, `dry-shampoo.ts`, `bondbuilder.ts`, and `deep-cleansing-shampoo.ts` adapt their signed category authority, Stage-1 decision, coverage fact and exact category specs into named criteria and allowed actions.

The exhaustive discriminants are the existing canonical keys: `shampoo`, `conditioner`, `leave_in`, `heat_protectant`, `oil`, `mask`, `scalp_care`, `dry_shampoo`, `bondbuilder`, and `deep_cleansing_shampoo`. Customer labels and filenames may use readable German/English names; persisted and TypeScript discriminants must use these exact keys.

Each adapter returns one of:

```ts
type Stage3AuthorityEvaluation =
  | {
      status: "known"
      subjectKey: string
      criteria: NamedCriterion[]
      verdict: Stage3FitVerdict
      allowedActions: Stage3ActionKind[]
    }
  | { status: "pending"; subjectKey: string; reason: "product_intake_pending" }
  | { status: "unknown"; subjectKey: string; missingFacts: string[] }
  | { status: "unsupported"; category: PersonalPlanCategory; reason: string }
```

`unsupported` is a launch blocker, not a user-specific `no suitable product` answer. `unknown` remains visible and non-executable. Adapters may share parsing helpers but must not share a generic numeric score or a catch-all recommendation rule.

`src/lib/personal-plan/products/production-persistence-gateway.ts` changes its mutation boundary from client-authored `record_decision` data to a semantic intent containing the draft ID, expected revision, authoritative `subjectKey`, action kind and only the minimal action-specific identifier. On every mutation the server:

1. resolves the authenticated owner and entitlement;
2. loads and validates the CAS draft and authority snapshot;
3. loads current owned/pending/catalog facts for the subject;
4. dispatches the category adapter;
5. verifies the requested action is in `allowedActions` and matches the evaluated subject;
6. constructs the full decision, named criteria, authority references and product snapshot;
7. saves with expected draft/source revision, returning typed conflict/stale/unknown outcomes.

`src/components/personal-plan-products/stage3-products-flow.tsx` renders server-returned projections and sends only those semantic intents. Delete all production imports or constructions derived from `fixture-gateway.ts`, `makeDecision`, fixture product IDs, fixture recommendation records and client-authored authority rules. Labs may retain fixture gateways in Labs-only composition.

### 5.6 Coverage and carrier resolution

Carrier resolution occurs after an exact product has category-specific known facts:

1. Start from the Stage-1 plan-wide coverage ledger; do not infer required jobs from captured product marketing claims.
2. Resolve the independently required Leave-in category.
3. If its selected exact product has verified compatible heat-protection coverage for every required route, mark the heat job as supported by that same assignment.
4. If a suitable standalone Heat Protectant is already confirmed, preserve its explicit user decision and assignment.
5. If neither carrier is verified, keep Heat Protectant uncovered/unknown or recommend through the Heat Protectant adapter only when the Heat category independently qualifies.
6. Never add Leave-in because heat exists. Never mark planned, pending, inactive or unknown products executable.

The immutable Stage-3 portfolio and Stage-4 candidate retain both the physical product identity and all supported semantic roles so Stage 5 renders a multi-role Leave-in once with its heat note.

### 5.6a Exact product-load resolution inside Stage 3

Stage 2 may retain the categories and Oil purposes the user reports, but category ownership alone is not Reset-load evidence. Do not assume that a reported Dry Shampoo, Leave-in or Oil is used weekly. The signed Deep-Cleansing and Scalp-Care frequency rules resolve only after Stage 3 has persisted the exact captured product frequencies.

After every capture category is complete and before product decisions are evaluated, the server computes a bounded `Stage3ProductLoadResolutionV1` overlay from the canonical draft. The overlay:

- is created only from server-loaded captured category, frequency and confirmed Oil-purpose facts;
- retains the refined need version and input hash as its immutable base;
- contains only supplemental or upgraded `deep_cleansing_shampoo` and `scalp_care` decisions, requirements and authority versions;
- has its own canonical captured-frequency fingerprint;
- is recomputed and invalidated by any later capture edit;
- is never accepted from the browser.

Use the already signed category rules verbatim: Dry Shampoo contributes regular or frequent Reset load according to its captured cadence; Leave-in and `dry_finish` Oil contribute only from at-least-weekly use; low wet-wash cadence and `low_volume_or_weighed_down` remain corroborating rather than independent signals; Scalp Care adds `scalp_exfoliant` only for verified at-least-weekly scalp/root exposure. Pending intake products may contribute only the user-confirmed category, purpose and cadence facts that are already authoritative; unknown identity facts never create another role or fit claim.

The immutable base authority snapshot remains unchanged. Stage-3 evaluation uses `effectiveDecisions = base decisions + overlay`, the completed portfolio freezes the overlay and fingerprint, and the initial Routine compiler may resolve a category from either the base refined decision or the frozen overlay. The existing single completion RPC remains the only Stage-3→4 write boundary. The portfolio contract may advance its JSON schema version, but no new relational table or client-authored decision path is introduced.

### 5.7 Stage-3 cursor and handoff

`src/lib/personal-plan/products/state-machine.ts::completeCaptureCategory` derives the next incomplete category from `orderedCategories` after applying the current completion. It sets `categoryCursor` to that category, or to `null` when capture is complete. The transition to `product_decisions` and the cursor update happen in the same revision.

`src/components/personal-plan-products/stage3-products-flow.tsx::PortfolioHandoff` renders `Routine öffnen` only after the server completion RPC has returned stable portfolio, Routine-version and proposal IDs. The CTA uses the returned `/routine` handoff. It must never state that the proposal is already active.

### 5.8 Stage-4 confirmation, analytics and Anwendung handoff

`src/components/routine/personal-plan/personal-plan-routine-client.tsx` keeps the proposal sheet open and retryable after a failed accept. Reload results decide the state:

- pending same proposal: show the error and active retry button;
- proposal already accepted after a lost response: show the active Routine and Anwendung CTA;
- superseded/conflict: show the current proposal and conflict copy;
- reload unavailable: retain the last pending proposal and retry affordance.

`src/components/routine/personal-plan/routine-proposal-sheet.tsx` receives an explicit retry state; `busy` prevents duplicate requests only during the request and never becomes a terminal disabled state.

Wrap Stage-4 analytics in a consent-aware port in `src/lib/personal-plan/routine/analytics.ts`. It reads `loadConsent()` at event time and tracks only when `analytics === true`; it listens to the existing consent-change event only if a long-lived provider needs cached state. Do not queue pre-consent Routine events for later replay. Keep the current structural event schemas and PostHog-only routing.

Once an accepted active Routine exists and Stage 5 is reachable, `src/components/routine/personal-plan/routine-page.tsx` renders the signed Anwendung CTA. There is no additional success route.

### 5.9 Entitlement-scoped Personal Plan shell

Add:

- `src/components/layout/personal-plan-navigation.tsx` for the signed four-tab navigation and reachable/active states;
- `src/components/layout/authenticated-app-shell.tsx` to choose Personal Plan navigation versus the existing `Header` from server-resolved access;
- `src/lib/personal-plan/navigation-access.ts` for a narrow presentation model derived from `journey-access.ts`.

Compose the server-resolved shell in `src/app/chat/layout.tsx`, `src/app/routine/layout.tsx`, `src/app/anwendung/layout.tsx`, and `src/app/profile/layout.tsx`, then remove the now-duplicated page-level `<Header>` calls from the exact page/loading/client files listed in section 6. The legacy branch of the shell renders the existing `Header` once, in the same visual position; the admitted branch renders the signed Personal Plan navigation once. This is a relocation of ownership, not a legacy-header redesign.

Resolve the narrow navigation model through a request-scoped cached server helper so the shell and page do not repeat equivalent owner/entitlement reads during one render. A navigation-resolver exception degrades to the legacy `Header` for shared Chat/Profile presentation, because navigation must never take down the established application. That presentation fallback does **not** authorize or substitute legacy Stage-4/5 content: `/routine`, `/anwendung` and every API still apply their own fail-closed owner/frontier checks and scoped unavailable states.

The shell may show only stages permitted by the fail-closed matrix. It must not perform owner reads in the client, flash Anwendung while eligibility is unknown, or replace legacy navigation for a positively resolved non-admitted user. Add a regression proving `navigation resolver throws -> one legacy Header, usable page content, no Personal Plan tab`. Update fixed-bottom spacing consumers such as `src/components/chat/chat-input.tsx` to use the existing Personal Plan shell padding variable only when the new shell is present.

### 5.10 Stage-5 direct-day recovery

`src/app/anwendung/page.tsx` must distinguish a valid overview failure from an invalid/unavailable requested day. Extend `ApplicationPageView` with a bounded recovery state carrying a safe overview target, not raw error details. `src/components/application/application-state.tsx` offers `Zur Übersicht` for an invalid/unavailable day and `Erneut laden` for a transient overall failure. `src/app/anwendung/[dayType]/page.tsx` continues to validate the typed day key and never echoes arbitrary input.

The accepted Routine is unchanged by every Stage-5 recovery action.

## 6. Exact file and test map

The lists below are implementation ownership, not permission to broaden scope. A file not named here requires main-session reconciliation before edit.

### Entry, frontier and navigation

- Modify `src/lib/billing/checkout-success-redirect.ts`
- Modify `src/app/welcome/page.tsx`
- Modify `src/app/plan-bereit/page.tsx`
- Modify `src/app/plan-bereit/status/route.ts`
- Modify `src/app/plan-bereit/personal-plan-ready-client.tsx`
- Modify `src/app/plan-bereit/transition.ts`
- Add `src/lib/personal-plan/journey-access.ts`
- Add `src/lib/personal-plan/navigation-access.ts`
- Add `src/components/layout/authenticated-app-shell.tsx`
- Add `src/components/layout/personal-plan-navigation.tsx`
- Modify `src/app/chat/layout.tsx`, `src/app/routine/layout.tsx`, `src/app/anwendung/layout.tsx`, `src/app/profile/layout.tsx`
- Modify `src/app/chat/page.tsx`, `src/app/chat/[conversationId]/page.tsx`, `src/app/routine/page.tsx`, `src/app/anwendung/page.tsx`, `src/app/anwendung/loading.tsx`, `src/app/profile/page.tsx`, and `src/components/routine/routine-page-client.tsx` only to remove/replace their page-level Header ownership and pass the resolved shell model where required
- Modify `src/components/chat/chat-input.tsx` only for verified bottom-shell spacing
- Tests: `tests/checkout-success-redirect.test.ts`, `tests/personal-plan-one-time-checkout.test.tsx`, `tests/personal-plan-ready-transition.test.ts`, `tests/paid-pending-access-callers.test.ts`, new `tests/personal-plan-journey-access.test.ts`, replace the old negative assertions in `tests/personal-plan-stage5-navigation.test.tsx`, add the navigation-resolver exception regression there, and retain `tests/routine-routing-nav.test.ts`

### Stage 1 and Stage 2

- Modify `src/components/personal-plan-start/plan-start-flow.tsx`
- Modify `src/lib/personal-plan/refinement/session.ts`
- Modify `src/lib/personal-plan/persistence/stage2-refinement-service.ts`
- Modify `src/lib/personal-plan/refinement/fixture-gateway.ts` only to keep Labs contract parity; it remains Labs-only
- Modify `src/lib/personal-plan/refinement/stage1-adapter.ts`
- Modify `src/lib/personal-plan/needs.ts`
- Modify `src/lib/personal-plan/categories/mask.ts`
- Verify without policy broadening: `src/lib/personal-plan/categories/heat-protectant.ts`, `src/lib/personal-plan/categories/leave-in.ts`
- Tests: `tests/personal-plan-start-ui.test.tsx`, `tests/personal-plan-stage2-session.test.ts`, `tests/personal-plan/persistence/stage2-refinement-service.test.ts`, `tests/personal-plan-stage1-stage2-adapter.test.ts`, `tests/personal-plan/needs.test.ts`, `tests/personal-plan/categories/mask.test.ts`, `tests/personal-plan/categories/heat-protectant.test.ts`, `tests/personal-plan/categories/leave-in.test.ts`, and production-shaped updates to `tests/personal-plan-start.spec.ts`

### Stage-3 authority, state and handoff

- Modify `src/lib/personal-plan/products/contracts.ts`
- Modify `src/lib/personal-plan/products/stage2-entry-adapter.ts`
- Modify `src/lib/personal-plan/products/state-machine.ts`
- Modify `src/lib/personal-plan/products/production-persistence-gateway.ts`
- Modify `src/lib/personal-plan/products/stage3-persistence-supabase.ts`
- Add `src/lib/personal-plan/products/authority/contracts.ts`
- Add `src/lib/personal-plan/products/authority/catalog-facts.ts`
- Add `src/lib/personal-plan/products/authority/evaluate.ts`
- Add the ten modules under `src/lib/personal-plan/products/authority/categories/` named in section 5.5
- Modify `src/app/api/personal-plan/stage-3/route.ts`
- Modify `src/components/personal-plan-products/stage3-products-flow.tsx`
- Keep `src/lib/personal-plan/products/fixture-gateway.ts` and Labs routes out of production composition
- Tests: `tests/personal-plan-stage3-contracts.test.ts`, `tests/personal-plan-stage2-stage3-adapter.test.ts`, `tests/personal-plan-stage3-state-machine.test.ts`, `tests/personal-plan/products/production-persistence-gateway.test.ts`, new `tests/personal-plan/products/stage3-persistence-supabase.test.ts`, new `tests/personal-plan/products/stage3-authority.test.ts`, `tests/personal-plan-stage3-components.test.tsx`, `tests/personal-plan-stage3-flow.test.tsx`, `tests/personal-plan-stage3-gateway.test.ts`, `tests/personal-plan-api-stage3.test.ts`, and `tests/personal-plan-stage1-2-3.spec.ts`

### Stage 4 and Stage 5

- Modify `src/lib/personal-plan/routine/analytics.ts`
- Modify `src/components/routine/personal-plan/personal-plan-routine-client.tsx`
- Modify `src/components/routine/personal-plan/routine-proposal-sheet.tsx`
- Modify `src/components/routine/personal-plan/routine-page.tsx`
- Modify `src/app/anwendung/page.tsx`
- Modify `src/app/anwendung/[dayType]/page.tsx`
- Modify `src/components/application/application-types.ts`
- Modify `src/components/application/application-state.tsx`
- Modify `src/components/application/application-page.tsx`
- Tests: `tests/personal-plan-stage4-analytics.test.ts`, `tests/personal-plan-stage4-interaction-ui.test.tsx`, `tests/personal-plan-stage4-ui.test.tsx`, `tests/personal-plan-stage4-routine.spec.ts`, `tests/personal-plan-stage5-route.test.tsx`, `tests/personal-plan-stage5-german-copy.test.ts`, `tests/personal-plan-stage5-application.spec.ts`

### Integrated browser and CI contract

- Add `tests/personal-plan-stage1-5.spec.ts`
- Add `scripts/test-personal-plan-stage1-5-browser.sh`
- Modify `package.json` with `test:playwright:personal-plan-stage1-5`
- Modify `.github/workflows/ci.yml` so the integrated Personal Plan path invokes the persisted test without secrets or production access
- Modify `scripts/ci/path-rules.mjs` and its focused tests only if the new script/test is not already selected by current Personal Plan path rules

## 7. Dependency-ordered implementation tasks

### Task 0 — freeze contracts and red tests

**Owner:** main session.

1. Confirm this plan, the signed mockups and the ten category authorities are still present on the implementation HEAD.
2. Add red tests for the frontier matrix, exact Stage-1 copy, Stage-2 next destination, mechanical/airflow rules, Stage-3 authority snapshot, semantic-action rejection, cursor advancement, heat-carrier cases, acceptance retry, analytics consent, Personal Plan navigation and direct-day recovery.
3. Freeze the Stage-3 authority snapshot and semantic-action schemas before implementation.
4. Reconfirm no SQL migration is required.

**Green gate:** contract tests fail for the intended missing behavior and do not fail because of broken fixtures or unrelated repository state.

### Task 1 — Stage-2 evidence projection

**Depends on:** Task 0.

Implement the named mechanical and ordinary-airflow semantics in the existing Stage-2-to-plan projection and category policy inputs. Do not touch Stage-3 authority code.

**Green gate:** focused adapter/needs/Mask/Heat Protectant/Leave-in tests prove all six boundaries: rough rubbing is moderate, gentle/no towel add none, rough rubbing alone is not Basis Mask, frequent ordinary airflow may contribute to Mask, ordinary airflow never creates Heat Protectant, and heat alone never creates Leave-in.

### Task 2 — server-owned Stage-3 authority

**Depends on:** Tasks 0 and 1. **Hard prerequisite for every Stage-3 UI decision and the integrated E2E.**

Implement authority snapshot creation/validation, typed category fact reads, ten exhaustive adapters, semantic action intents and server construction of decisions. Delete the production client's power to submit verdicts or recommendations.

**Green gate:** all ten category adapters have deterministic known/pending/unknown/unsupported fixtures; forged verdicts/actions/subject keys are rejected; unknown remains unknown; stale revision/source/snapshot fails closed; product facts are category-discriminated; Leave-in/heat carrier tests pass; production imports contain no fixture decision construction.

### Task 3 — Stage-3 UI, cursor and Routine handoff

**Depends on:** Task 2.

Render server projections, send semantic intents, advance/reopen the capture cursor correctly, and render the post-completion `Routine öffnen` CTA only after stable completion IDs return.

**Green gate:** component/state/API tests cover forward movement, resume, conflict, pending intake, unknown, unsupported, edit invalidation, last-category transition, failed completion and truthful proposal handoff.

### Task 4 — entry, Stage-1/2 seams and frontier

**Depends on:** Task 0; may run after Task 2 contracts are stable, but main integrates it after Task 3 so no route admits users to fixture Stage 3.

Implement the new ready/pending/legacy destination policy, exact Stage-1 copy, Stage-2 transition with no stale `/plan-start/produkte`, and the server frontier/gate matrix. Keep the global flag off.

**Green gate:** ready new buyer resolves to `/plan-start`; delayed provisioning stays on the short waiting surface then automatically/explicitly continues via `Plan ansehen`; pre-cutoff stays legacy; direct route/API attempts beyond the frontier fail closed.

### Task 5 — Stage-4/5 handoffs, consent, navigation and recovery

**Depends on:** Tasks 3 and 4.

Implement acceptance retry, consent-aware structural analytics, in-place Anwendung CTA, scoped four-tab navigation and direct-day overview recovery. Do not add a success page or change Stage-5 compiler/persistence semantics.

**Green gate:** a failed accept followed by success works; lost-response/same-pending/superseded paths remain retryable; no Stage-4 event fires before analytics consent; admitted owners get the signed nav without a loading flash; legacy users keep the old header; unavailable direct day can reach the overview.

### Task 6 — persisted production-shaped Stage-1-to-5 proof

**Depends on:** Tasks 1–5 and Task 6a. It must not begin before the Stage-3 authority and exact product-load overlay are green.

Add one authenticated browser journey using the isolated local Supabase baseline and production route/API composition:

1. seed a qualifying new-buyer purchase, entitlement and prepared Personal Plan source;
2. prove the ready path enters `/plan-start` and separately exercise the delayed `/plan-bereit` continuation;
3. traverse Bedarf basis then optional when present;
4. answer refinement, including one mechanical/airflow fixture;
5. capture owned, planned, pending and unknown product cases through server authority;
6. complete Stage 3 and open the pending Routine;
7. fail one acceptance attempt, retry, then explicitly accept the whole proposal;
8. open Anwendung from the Routine/nav, open a bookmarkable day and recover from an unavailable day;
9. reload/resume at Stage 2, Stage 3, Routine and Anwendung checkpoints;
10. assert cross-owner and beyond-frontier requests do not expose or mutate the plan.

The test must not call Labs routes, connect to production, depend on live secrets or pre-enable repository defaults. Its isolated test-server command explicitly supplies `PERSONAL_PLAN_APP_V1_ENABLED=true`, `PERSONAL_PLAN_STAGE2_ENABLED=true`, `PERSONAL_PLAN_STAGE3_ENABLED=true`, `PERSONAL_PLAN_STAGE4_ENABLED=true`, and `PERSONAL_PLAN_STAGE5_ROLLOUT=all` only for that process, alongside its local Supabase URLs/keys. Repository and deployment defaults remain off before and after the command.

**Green gate:** the new test passes against an isolated reset database and all existing Stage-1/2/3/4/5 browser regressions remain green.

### Task 6a — exact Stage-3 product-load overlay

**Depends on:** Tasks 2 and 3. It lands before the final Task-6 rerun.

Implement the signed §5.6a boundary as one server-authoritative slice:

- keep Stage-2 product categories/Oil purposes as inventory-routing facts only; never score ownership as weekly use;
- include current-only reported categories as inventory capture requirements without rendering them in the Stage-1 need plan;
- compute exact Deep-Cleansing and Scalp-Care additions/upgrades only from the canonical captured frequencies after capture is complete;
- store the bounded overlay/fingerprint in the draft, prune it after capture edits, and freeze it into the completed portfolio;
- evaluate base plus supplemental requirements without mutating the refined snapshot or accepting client decisions;
- compile the initial Routine from either the immutable refined decision or the frozen supplemental decision.

Owned implementation surface:

- `src/lib/personal-plan/products/product-load-resolution.ts` (new pure resolver);
- `src/lib/personal-plan/needs.ts` and `src/lib/personal-plan/refinement/stage1-adapter.ts` (retain inventory facts but remove the temporary ownership-as-frequency proxy);
- `src/lib/personal-plan/products/contracts.ts`;
- `src/lib/personal-plan/products/stage2-entry-adapter.ts`;
- `src/lib/personal-plan/products/state-machine.ts`;
- `src/lib/personal-plan/products/authority/snapshot.ts`;
- `src/lib/personal-plan/products/production-persistence-gateway.ts`;
- `src/lib/personal-plan/products/portfolio.ts`;
- `src/lib/personal-plan/routine-candidate-compiler.ts`;
- only the corresponding Stage-3/portfolio/compiler tests named below.

The draft field is server-created and optional at decode so a pre-activation draft without it can be deterministically recomputed from its own captured facts; it is never accepted as a client mutation. If the portfolio JSON advances to schema version 2, Stage-4 read/compile contracts must explicitly accept already-written v1 fixtures and the new v2 shape. No new table is introduced. A SQL migration is required only if the existing service-role-only completion RPC cannot safely validate/store the selected additive JSON shape; implementation evidence must prove that need before writing one.

**Green gate:** exact documented frequency thresholds add/upgrade only the two allowed categories; current-only categories are captured without fabricated roles; pending products contribute only confirmed category/purpose/cadence facts; edits invalidate/recompute the overlay; server evaluation and Routine compilation reject a client-authored or stale overlay; v1 portfolio compatibility remains covered.

### Task 7 — whole-tree readiness and review

**Depends on:** Task 6.

Run the complete verification contract on the exact final tree, inspect the full diff and update the implementation receipt. Invoke `ready-check` and then exactly one meaningful whole-tree `request-code-review`; reconcile supported findings without reopening settled decisions.

**Green gate:** no required check is skipped, every review finding is resolved/rejected with evidence, the canonical tree fingerprint is recorded, and all flags remain off.

## 8. Disjoint worker decomposition

The main session owns architecture, Task 0, contract reconciliation, integration order, shared-file conflict resolution, the full diff, final verification and readiness. Every worker is told it is not alone in the repository, must preserve other task-owned changes, must not reset/revert/stash, and must return `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT` or `BLOCKED` with files, tests and evidence.

| Worker                      | Owned write scope                                                                                                                      | Non-goals                                                                        | Acceptance checks                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Stage-2 evidence worker     | `refinement/stage1-adapter.ts`, `needs.ts`, Mask tests and related Stage-2 evidence tests                                              | no Stage-3, UI, routing or migrations                                            | Task-1 focused green gate                             |
| Stage-3 authority worker    | `products/authority/**`, Stage-3 contract/persistence gateway files and authority tests                                                | no browser UI, checkout routing, Routine UI or migrations                        | Task-2 green gate; exhaustive ten-category dispatcher |
| Stage-3 UI worker           | `stage3-products-flow.tsx`, `state-machine.ts`, Stage-3 UI/state/API tests                                                             | no authority policy invention, checkout/nav/Stage-4 changes                      | Task-3 green gate using server projections only       |
| Entry/frontier worker       | checkout-success, welcome, plan-bereit, journey-access, Stage-1 copy, Stage-2 href and their tests                                     | no Stage-3 authority, Routine/Application UI or SQL                              | Task-4 green gate                                     |
| Stage-4/5 shell worker      | Routine acceptance/analytics/CTA, application recovery, new shell/nav, layouts, the named page-level Header removals and related tests | no Stage-3, category policy, compiler/persistence or legacy Header internals     | Task-5 green gate                                     |
| Integrated E2E worker       | new Stage-1-to-5 spec/script and only necessary package/CI path contracts                                                              | no runtime semantics or fixture substitution                                     | Task-6 green gate after all runtime slices land       |
| Stage-3 product-load worker | product-load resolver plus the named Stage-3 draft/portfolio/compiler contracts and focused tests                                      | no Stage-2 proxy score, UI redesign, generic score or new table without evidence | Task-6a green gate before the final integrated rerun  |

Parallel writers must have disjoint file ownership. `products/contracts.ts`, `production-persistence-gateway.ts`, `stage3-products-flow.tsx`, `journey-access.ts`, shared layouts and `package.json` are integration-sensitive and may have only one active writer. If a worker discovers a needed edit outside scope, it returns the exact dependency rather than editing it.

## 9. Test-first gates

### Focused red/green sequence

1. `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-journey-access.test.ts tests/checkout-success-redirect.test.ts tests/personal-plan-ready-transition.test.ts tests/paid-pending-access-callers.test.ts`
2. `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage1-stage2-adapter.test.ts tests/personal-plan/needs.test.ts tests/personal-plan/categories/mask.test.ts tests/personal-plan/categories/heat-protectant.test.ts tests/personal-plan/categories/leave-in.test.ts`
3. `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan/products/stage3-authority.test.ts tests/personal-plan-stage3-contracts.test.ts tests/personal-plan/products/production-persistence-gateway.test.ts tests/personal-plan/products/stage3-persistence-supabase.test.ts`
4. `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-state-machine.test.ts tests/personal-plan-stage3-components.test.tsx tests/personal-plan-stage3-flow.test.tsx tests/personal-plan-api-stage3.test.ts`
5. `node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage4-analytics.test.ts tests/personal-plan-stage4-interaction-ui.test.tsx tests/personal-plan-stage4-ui.test.tsx tests/personal-plan-stage5-navigation.test.tsx tests/personal-plan-stage5-route.test.tsx tests/personal-plan-stage5-german-copy.test.ts`
6. `npm run test:playwright:personal-plan-stage1-5`

Before step 6, run the Task-6a focused contract set:

`node --import ./tests/server-only-register.cjs --import tsx --test tests/personal-plan-stage3-state-machine.test.ts tests/personal-plan-stage3-gateway.test.ts tests/personal-plan-stage3-portfolio.test.ts tests/personal-plan/products/production-persistence-gateway.test.ts tests/personal-plan-routine-candidate-compiler.test.ts`

Test files named above but not yet present are created in their owning task before running that command. Each red must represent the intended missing behavior; after green, run the adjacent existing regression set before integration.

### Whole-tree verification on the exact final content

Run in this order:

1. `npm run test:personal-plan-db`
2. `npm run test:personal-plan`
3. `npm run test:personal-plan-stage5`
4. `npm run test:playwright:personal-plan-stage3`
5. `npm run test:playwright:personal-plan-stage4`
6. `npm run test:playwright:personal-plan-stage5`
7. `npm run test:playwright:personal-plan-stage1-5`
8. focused checkout/welcome/auth/legacy navigation contract tests named in section 6
9. focused CI path/workflow contract tests
10. CI-equivalent `quality-core`, including `npm run funnel:check` and `npm run test:contracts`; record conditional skips as skipped, not green
11. `npm run typecheck`
12. `npm run lint`
13. production build with `PERSONAL_PLAN_APP_V1_ENABLED`, `PERSONAL_PLAN_STAGE2_ENABLED`, `PERSONAL_PLAN_STAGE3_ENABLED`, `PERSONAL_PLAN_STAGE4_ENABLED` and `PERSONAL_PLAN_STAGE5_ROLLOUT` absent/off
14. `git diff --check`
15. manual authenticated browser walkthrough at 320 px, 390 px and desktop widths against the signed mockup states, including keyboard/focus, loading, conflict, pending, unknown, retry and legacy variants
16. `ready-check`
17. `request-code-review`

Record exact commands, pass counts, skipped checks, final fingerprint, changed-path count and flag values in the durable receipt. A skipped database or browser test is a readiness blocker, not a pass.

## 10. Data and category launch gates

### Database gate

- Expected implementation has no migration. The current Stage-3 draft JSON, immutable refined snapshots and CAS transitions are sufficient.
- Existing Personal Plan migrations and pgTAP must still pass from the production-transition baseline.
- If an exact missing persisted fact is proven, stop and amend this plan before generating SQL. Do not edit historical migrations, remote history or production data as a workaround.
- No normal local/CI verification connects to production.

### Ten-category authority gate

Before activation, create and review one versioned ten-category readiness receipt from read-only catalog/spec/protocol audit commands. The repository does **not** currently contain a `personal_plan_category_readiness` relation, so no implementation or release receipt may claim that it does. Each category entry must link the signed category decision, required catalog spec columns, exact-product authority adapter, Product Intake path and Stage-5 protocol coverage:

1. Shampoo
2. Conditioner
3. Leave-in
4. Heat Protectant
5. Oil
6. Mask
7. Scalp Care
8. Dry Shampoo
9. Bondbuilder
10. Deep Cleansing

For each category, the audit must prove known-fit, known-mismatch, pending-intake, unknown/missing-fact and honest-gap behavior. A category is launchable only when its receipt entry is supported and its adapter/catalog/protocol evidence agrees. The receipt must preserve the exact query/evidence source and review date; adding a database readiness relation is a separate future architecture choice, not a prerequisite for the read-only audit. Do not activate, hide, relabel or silently fall back for an unsupported category. Data-enrichment gaps are reported separately from code correctness.

### Release gate

- Repository defaults remain `PERSONAL_PLAN_APP_V1_ENABLED=false/absent`, `PERSONAL_PLAN_STAGE2_ENABLED=false/absent`, `PERSONAL_PLAN_STAGE3_ENABLED=false/absent`, `PERSONAL_PLAN_STAGE4_ENABLED=false/absent` and `PERSONAL_PLAN_STAGE5_ROLLOUT=off/absent`.
- No flag is enabled merely because tests pass.
- Activation requires a separately authorized deployment, production migration review if any migration was later approved, catalog/protocol readiness for all ten categories, production smoke proof, monitoring and an explicit rollout decision.

## 11. Designed user journey acceptance

1. **Ready purchase:** after authenticated activation the new-cohort buyer reaches `/plan-start`; the legacy buyer keeps the legacy destination.
2. **Delayed provisioning:** the buyer sees the compact `/plan-bereit` waiting story, can retry safely, and continues automatically or with `Plan ansehen` once ready.
3. **Stage 1 Bedarf:** Basis categories appear first, optional categories only when present. The completion message says `Als Nächstes verfeinern wir deinen Plan mit ein paar gezielten Fragen.` and `Plan verfeinern` opens Stage 2.
4. **Stage 2 refinement:** the user answers the signed adaptive questions. Back/edit prunes invalid descendants; conflict reload preserves recoverability. Completing Stage 2 enters Stage 3 directly, with no `/plan-start/produkte` route.
5. **Stage 3 products:** categories advance in order. Owned, planned, pending and unknown cases remain distinct. The server supplies all fit/recommendation authority. Editing Stage 2 stales the unfinished Stage-3 draft. Completion stages, but does not activate, a Routine proposal.
6. **Stage-3 handoff:** `Routine öffnen` opens `/routine` and the whole proposal.
7. **Stage 4 Routine:** the user reviews all changes and explicitly accepts. Failure keeps a real retry. Acceptance reveals the Routine and its Anwendung entry without another success page.
8. **Navigation:** admitted owners see `Chat · Routine · Anwendung · Profil`; only reachable destinations appear. Legacy customers keep the legacy header.
9. **Stage 5 Anwendung:** the overview shows only complete executable days from the accepted Routine. A day URL is bookmarkable; an unavailable day offers the overview, while a transient overall error offers reload. Nothing here mutates the Routine.
10. **Resume and safety:** reloads resume persisted state; owner/entitlement/CAS boundaries hold at every stage; a disabled downstream flag never strands a user on an exposed but unusable surface.

## 12. Risks and contained responses

| Risk                                                 | Required containment                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Client still smuggles fixture authority              | source/import contract test plus server semantic-intent validation; production gateway constructs every decision          |
| Stage-1/2 and Stage-3 category sets drift            | snapshot creation validates exact decisions, coverage and ordered categories against the same refined version             |
| New adapter labels missing data as no-match          | explicit `unknown` and `unsupported` outcomes; no generic fallback                                                        |
| Heat-capable Leave-in double-renders or invents need | carrier tests cover independent Leave-in need, compatible route, preserved standalone product and heat-only negative case |
| Frontier becomes a second authorization system       | every API retains owner/entitlement/CAS checks; frontier carries only reachability                                        |
| Earlier edit appears to revoke accepted Routine      | immutable active Routine stays available until successor confirmation; only unfinished descendants stale                  |
| Analytics fires without consent                      | event-time consent gate, no pre-consent queue/replay and consent tests                                                    |
| Navigation leaks a disabled stage                    | server presentation model and loading/legacy regression tests                                                             |
| E2E passes on fixture composition                    | test asserts production routes, real persistence/RPCs and absence of Labs calls                                           |
| A migration is added for convenience                 | mandatory stop-and-amend gate naming the unrecoverable persisted fact                                                     |

## 13. Counterpart plan-review reconciliation

Exactly one read-only Claude plan review ran at high effort on 2026-08-08 after this plan was first materialized. The main session checked every finding against the repository before revising the plan.

- **Accepted — navigation ownership blocker:** the existing route layouts own providers, while page/loading/client components currently render `Header`. Sections 5.9, 6 and 8 now name the actual Header call sites so implementation cannot double-render legacy navigation.
- **Accepted — shared-path failure behavior:** navigation-resolution exceptions now have an explicit presentation-only legacy fallback and regression. Stage/API authorization remains fail closed.
- **Accepted — category discriminant:** the plan now freezes all ten canonical keys, including `deep_cleansing_shampoo`.
- **Accepted — towel typing:** `no_towel` is correctly recorded as a material that yields absent technique; only `rough_rubbing | gentle_press` are technique values.
- **Accepted — isolated browser flags:** the integrated harness must enable App V1 and Stages 2–4, plus Stage 5 for all test users, only in its local test-server process while repository/deployment defaults stay off.
- **Accepted — navigation read cost:** the plan now requires a request-scoped cached server resolver.
- **Reconciled without scope change — delivery size:** Stage-3 authority remains the hard, single-writer prerequisite before Stage-3 UI, entry admission and E2E. The current no-publication stop makes a separately published increment inappropriate; the dependency order and review checkpoints provide the supported isolation.

No counterpart finding introduced a genuine unresolved user decision. No second counterpart pass is required for these grounded technical corrections.

## 14. Completion receipt requirements

Implementation is `DONE` only when:

- every task green gate and whole-tree verification gate passes on the same final tree;
- Stage-3 authority landed before the integrated E2E;
- the browser proof is persisted, authenticated, owner-scoped and production-shaped;
- all ten categories have separate code-correctness and data-readiness receipts;
- signed copy/navigation/handoffs and recovery states match the reviewed evidence;
- legacy/pre-cutoff regressions pass;
- all flags are confirmed off;
- `ready-check` and the single whole-tree `request-code-review` are reconciled;
- the handoff lists exact files, commands, counts, fingerprint and remaining activation blockers;
- no commit, push, PR, merge, deploy, flag activation or production write occurred.

Use `DONE_WITH_CONCERNS` only for a non-blocking, explicitly evidenced activation/data follow-up. Use `NEEDS_CONTEXT` for a genuine unresolved product or architecture decision. Use `BLOCKED` when a required verification gate cannot run or a category lacks the semantic authority needed for safe implementation; never replace that authority with fixture logic.

## 15. 2026-08-09 deadline-aware launch gate

### Customer outcome and clock

- Customers must be able to purchase at **10:00 CEST** and receive a concrete Personal Plan output after purchase.
- The internal scope decision is taken at **09:00 CEST**. Verification may continue until approximately **09:20 CEST**, but publication, migration, deployment, smoke testing and monitoring still require real time before 10:00.
- Passing unit tests or a local mockup is not launch proof. Commit, push, PR, merge, migration, deployment and flag activation remain separate explicit actions.

### Scope decision

Use the largest truthful scope whose complete gate is green at the cutoff:

1. **Full five-stage scope:** eligible only if the entire Section 9 contract, final review and all ten category catalog/spec/protocol activation gates pass. Any missing category-data gate makes this scope ineligible even when the code is correct.
2. **Stage 1 + Stage 2 launch slice (preferred fallback):** the buyer receives the quiz-based Bedarfsplan immediately, can answer the signed refinement questions, and then sees the recomputed refined Bedarfsplan as the completion result. Products, Routine and Anwendung are not shown or linked.
3. **Stage 1-only emergency slice:** if the Stage-2 completion-result adaptation cannot clear its gate in time, the buyer receives the quiz-based Basis/Optional Bedarfsplan and the refinement CTA is absent. This is preferable to exposing an unfinished downstream journey.
4. **No new Personal Plan activation:** if even the Stage-1 purchase-to-result path, migrations, access boundaries, build, review, deploy and smoke test cannot be proven, keep the new app flag off. The purchase funnel must not promise a post-payment surface that is unavailable.

| Decision          | App V1         | Stage 2        | Stage 3        | Stage 4        | Stage 5 rollout |
| ----------------- | -------------- | -------------- | -------------- | -------------- | --------------- |
| `FULL_FIVE_STAGE` | `true`         | `true`         | `true`         | `true`         | `all`           |
| `STAGE1_2`        | `true`         | `true`         | `false/absent` | `false/absent` | `off/absent`    |
| `STAGE1_ONLY`     | `true`         | `false/absent` | `false/absent` | `false/absent` | `off/absent`    |
| `NO_ACTIVATION`   | `false/absent` | `false/absent` | `false/absent` | `false/absent` | `off/absent`    |

`PERSONAL_PLAN_STAGE5_ROLLOUT=internal` is not customer activation and cannot support `FULL_FIVE_STAGE`.

### Required architecture for the Stage 1 + Stage 2 slice

- Use explicit server-owned downstream gates: `PERSONAL_PLAN_STAGE2_ENABLED` and `PERSONAL_PLAN_STAGE3_ENABLED`, both defaulting to false/absent. Do not infer downstream launchability from UI state or catalog fixtures.
- The journey frontier permits Stage 1 and Stage 2 for the new cohort while the Stage-3 gate is off; all Stage-3 APIs and links fail closed.
- Stage-2 completion still persists the immutable refined need version. With Stage 3 disabled, `/plan-start` must render that refined Bedarfsplan using the signed Stage-1 Basis/Optional card hierarchy and concise completion copy; it must not render `Produkte erfassen` or a dead next-step CTA. `STAGE1_2` remains ineligible until focused contracts and browser proof demonstrate this terminal result, because the current implementation still attempts the Stage-3 handoff after refinement completion.
- When Stage 3 is later enabled, the same persisted refined version resumes the already-designed Stage-3 exact-product flow. No duplicate plan, migration fork or lossy compatibility layer is introduced.
- Stage-4 and Stage-5 flags remain off. Navigation exposes only destinations actually reachable for the admitted cohort. Legacy/pre-cutoff users retain the legacy journey.

### Launch-slice verification checklist

Run and record these on the exact launch-slice tree:

1. Database transition harness: `npm run test:personal-plan-db`.
2. Stage-1/2 deterministic and API contracts: the Section 9 focused commands for journey access, checkout/welcome/readiness, Stage-1 computation, Stage-1→2 adapter, Stage-2 session/edit/pruning/completion and owner/CAS behavior.
3. New browser proof at 390 px plus desktop: authenticated purchase/activation → `/plan-start` → Basis/Optional Bedarfsplan → refinement → persisted refined Bedarfsplan completion; reload resumes; delayed provisioning continues from `/plan-bereit`; pre-cutoff remains legacy.
4. Negative browser/API proof: no Stage-3 CTA, direct Stage-3/4/5 route and API attempts fail closed, and the global/downstream flags default off.
5. Focused checkout, welcome, auth, navigation and CI path/workflow contracts, plus the CI `quality-core` surface (`funnel:check` and `test:contracts`) and `personal-plan-db-contract`; conditional skips are recorded as skipped.
6. `npm run typecheck` and `npm run lint`.
7. Production build with `PERSONAL_PLAN_APP_V1_ENABLED`, `PERSONAL_PLAN_STAGE2_ENABLED`, `PERSONAL_PLAN_STAGE3_ENABLED`, `PERSONAL_PLAN_STAGE4_ENABLED` and `PERSONAL_PLAN_STAGE5_ROLLOUT` absent/off.
8. `git diff --check`, canonical manifest fingerprint and task-owned artifact classification.
9. `ready-check` and one whole-tree `request-code-review`, reconciled on the same fingerprint.
10. Only after separate authorization: commit/push/PR/merge, apply and verify required additive migrations before code deployment, deploy with all flags off, production smoke test an owner-scoped test purchase, then enable only the approved scope and monitor checkout, readiness and `/plan-start` errors.

### 09:00 decision record

Record one of `FULL_FIVE_STAGE`, `STAGE1_2`, `STAGE1_ONLY`, or `NO_ACTIVATION` with:

- exact tree fingerprint and reviewed commit SHA;
- green/failed/skipped commands and browser evidence;
- migration state and production-schema compatibility evidence;
- enabled/disabled flag values;
- remaining category-data gates;
- who authorized merge, migration, deployment and activation;
- rollback action and first monitoring checkpoint.

Do not compress the release gates to hit the clock. Reduce scope instead.

**Decision at 09:00 CEST: `NO_ACTIVATION` for the new Personal Plan at 10:00.**

- No exact release tree fingerprint or reviewed commit SHA exists yet. The broad integrated tree remains dirty and is evidence-only; the clean Stage-1-only task is still in implementation/verification.
- `FULL_FIVE_STAGE` is ineligible because its browser journey is red and the ten-category data/protocol gate is incomplete. `STAGE1_2` is ineligible because the terminal refined-result renderer is not implemented or browser-proven. `STAGE1_ONLY` is not yet database/browser/build/ready-check/review-ready.
- The production-shaped integrated database harness is green, but that is not a receipt for the separate clean Stage-1 release tree. No new migration has been applied to production.
- All new Personal Plan flags remain off/absent. No merge, migration, deployment or activation authorization has been requested or exercised.
- Rollback action is therefore unnecessary for the new Personal Plan: preserve the current production behavior and use the separately owned existing-routine fallback for the 10:00 customer outcome.
- Continue the clean Stage-1 and full consolidation tasks after the deadline, preserving the full verification contract. Reconsider activation only from a reviewed exact head with migration, deployment, production smoke and monitoring time explicitly reserved.

Post-deadline update: the clean Stage-1-only task is now locally review-ready, but the 10:00 decision does not change. Its frozen-base receipt reports Node 537/537, DB/RLS/RPC 33/33 with no new security-advisor errors, browser 2/2 mobile/desktop, typecheck, flags-off build, lint with 0 errors/4 unrelated warnings, and fingerprint `41973c4cd0eda458ba06b6d3b3a9a40dd812993842e05cfe9aefc5a4027f99d4`. Exactly one whole-tree counterpart review was reconciled. The browser proof still intercepts the Stage-1 API snapshot; an authenticated journey against the applied production-shaped database, refresh against the newer `origin/main`, and the separately authorized publication/migration/deploy/activation sequence remain mandatory.

### Live verification record before the 09:00 gate

As of **08:52 CEST**:

- The production-shaped database transition harness is green: 5 SQL files, 185 assertions, no production connection or write.
- The integrated Stage-1-only flag/frontier/UI contract is green in the consolidation tree: 40 focused Node tests, TypeScript, scoped lint and diff hygiene. This tree is evidence only; it is not a release candidate because it still contains the broad dirty Stage 1–5 consolidation.
- The core Personal Plan Node suites are green: `test:personal-plan` 810/810 and `test:personal-plan-stage5` 106/106.
- Focused checkout/welcome/auth/navigation contracts are green at 93/93; CI path/workflow contracts are green at 17/17. Typecheck, lint (0 errors, 4 pre-existing warnings), the all-flags-unset production build and `git diff --check` are green. `funnel:check` and `test:contracts` have not yet run, so CI-equivalent `quality-core` is not claimed.
- The full authenticated Stage 1→5 production-shaped browser harness is green at 2/2. It covers the ready buyer, paid-pending containment, all four Stage-3 product states, Routine conflict/retry and explicit acceptance, Anwendung overview/day/recovery, persisted reload/resume, and foreign-session denial. During the red-to-green sequence it caught and fixed the Bondbuilder zero-candidate verdict, catalog `knownReaction` authority, Conditioner fixture facts, uncovered-role planned-purchase invariant, Routine retry locator scope, and foreign-login synchronization; each semantic fix has focused regression evidence.
- The isolated Stage-3 browser command did not reach assertions because the worktree has no local Supabase URL/key environment. Stage 4 and Stage 5 isolated browser suites were therefore not run in that lane; this is recorded as a blocked precondition, not a pass.
- Dirty-scope audit found 150 paths: 146 durable Stage 1–5 implementation/test paths, 3 durable plan/mockup artifacts, 1 generated `test-results/.last-run.json`, and 0 suspicious/unrelated paths. There are no staged files, migration edits, merge markers or literal secrets. A final durable receipt and generated-artifact restoration remain required.
- `funnel:check` is green. The stable-tree `test:contracts` rerun is not yet green: its first `test:node` segment reported 3,082/3,083 passing with one truncated failure, so downstream agent/browser contract segments did not run. The single failure is under read-only diagnosis and remains a readiness blocker.
- The ten-category catalog/spec/protocol gate is still incomplete, so `FULL_FIVE_STAGE` is not eligible for customer activation even if the remaining browser assertion becomes green.
- A separate clean Stage-1-only release-isolation task is active from current `origin/main`: Codex task `019fe53a-d16b-7ce2-9460-8886da2d680f`. It must produce its own migration, browser, build, ready-check and review receipt before it can become a release candidate.
- Preliminary release decision: **do not publish the dirty integrated tree or stale draft PR #339**. If the clean Stage-1-only task is not review-ready with deployment time remaining, record `NO_ACTIVATION` for 10:00 and keep the new Personal Plan flags off.

### Post-deadline final-verification update

- The historical 09:00 `NO_ACTIVATION` decision remains unchanged; the separately owned existing-Routine fallback is outside this task.
- The integrated production-shaped Stage 1→5 journey is green at 2/2, including paid-pending containment, all Stage-3 decision states, Routine retry/acceptance, Anwendung recovery, reload/resume and foreign-session denial.
- The complete CI-equivalent contract chain is green on the current tree with CI placeholder secrets: Node 3,083/3,083; Personal Plan 813/813; Agent 967/967; Playwright contracts 201/201; Stage 3 15/15; Stage 4 1/1; Stage 5 2/2.
- The standalone Stage-3 proof follows the signed transition order and proves successor-refinement restart. Stage 4 and Stage 5 independently pass against their disposable production-shaped database harnesses.
- Typecheck, lint, the all-flags-unset build, final diff hygiene, scope/fingerprint audit, ready-check and the single whole-tree counterpart review are complete on the post-review tree. The tree is review-ready, but remains activation-ineligible.
- `FULL_FIVE_STAGE` remains activation-ineligible until the ten-category launch catalog/spec/protocol gate is complete and a refreshed exact release head receives separate migration, deployment and activation authorization.

### Post-review reconciliation

- The counterpart review found no Critical or High defect. Its supported `/plan-bereit` redirect finding was fixed so the explicit CTA remains usable.
- Two supported lower-severity journey findings were fixed without architecture changes: later Stage-3 capture categories no longer expose a no-op Back control, and the enabled Stage-1 refinement CTA no longer looks disabled.
- Product-load handling remains intentionally split: Stage 2 does not invent verified use frequency from ownership, while Stage 3 captures exact frequency and freezes the authority overlay before Routine compilation.
- Focused SQL review confirmed owner scoping, CAS/source revision, idempotent replay and exact outbox acknowledgement. One possible unreferenced immutable successor portfolio after suppression is non-blocking audit clutter and remains a later cleanup concern.
- The post-fix exact-tree proof is green: parallel and serial Node 3,084/3,084; Personal Plan 814/814; Agent 967/967; Playwright contracts 201/201; Stage 3 15/15; Stage 4 1/1; Stage 5 2/2; full production-shaped Stage 1→5 2/2; typecheck; lint with 0 errors/4 unrelated warnings; all-flags-unset build; and diff hygiene. The legacy ingestion guard test now supplies its own harmless child-process placeholders instead of racing on a mutable inherited environment.
- Current `origin/main` is three commits ahead. A read-only merge-tree audit found no predicted content conflict and only one committed-path overlap (`src/lib/analytics/events.ts`), but publication still requires a separately authorized clean stacked refresh and complete affected re-verification.

### 2026-08-09 launch-candidate refresh

- A separate local launch candidate now exists at `.worktrees/personal-plan-launch-candidate` on `codex/personal-plan-launch-candidate`. It keeps the complete Stage 1–5 commit ancestry, merges current `origin/main` at `e8f8b7e9` without conflict, and overlays the reviewed dirty consolidation. The merge is intentionally stopped before commit; PR #339, PR #341, the original integrated worktree, production, and all feature flags remain untouched.
- The three incoming `main` changes—same-browser result return, the legacy-offer Wistia surface, and onboarding-to-Routine redirect—were reviewed against the five-stage journey. Their focused integration contracts pass 49/49 and no semantic conflict remains.
- A live read-only production audit is recorded in [the ten-category receipt](./receipts/2026-08-09-personal-plan-ten-category-readiness.md). Production migration history ends at `20260808100536_add_personal_plan_result_returns`; all seven additive Personal Plan Stage 1–5 migrations are unapplied. The new Heat Protectant, Scalp Care, exact-product protocol, and Stage-5 application-guidance relations are absent.
- The live launch cohorts are: Shampoo 49, Conditioner 43, Leave-in 42, Oil 41, Mask 35, Dry Shampoo 10, Bondbuilder 4, Deep Cleansing 0, Heat Protectant 0, and Scalp Care 0. Existing legacy spec coverage is recorded separately from the missing canonical Personal Plan/protocol coverage; no catalog or Product Intake write occurred.
- The refresh found and fixed one bounded code gap test-first: the Bondbuilder authority loader now reuses existing `product_relationships` so `add_on_for` companions remain supportive while active products without that relationship remain standalone. The focused authority regression passes 14/14.
- Exact refreshed-candidate proof is green: Node 3,116/3,116; Personal Plan 838/838; production-shaped database 185/185 across five SQL files; full authenticated Stage 1→5 browser 2/2; typecheck; lint; `funnel:check`; flags-off production build; and diff hygiene. The database harness initially hit auxiliary-container health failures while Docker, Node, and the production build ran concurrently; the unchanged harness passed when rerun alone, so database verification must remain a serial launch gate.
- `FULL_FIVE_STAGE` remains blocked by the ten-category catalog/spec/protocol gate. `STAGE1_2` remains blocked because the terminal refined-Bedarfsplan result is not implemented. `STAGE1_ONLY` is structurally viable without catalog/protocol enrichment, but still requires the foundation migration, a valid `PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF`, an exact Stage-1 release receipt, and separate publication/migration/deployment/smoke/activation authorization.
- No commit, push, PR mutation, merge, production migration, catalog write, deployment, smoke test, or flag activation occurred in this launch-preparation pass.
