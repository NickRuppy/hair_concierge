# Personal Plan Stage 2 — Verfeinerung implementation plan

**Status:** approved by Nick on 2026-08-07 for subagent-driven standalone implementation before the later Stage-1/Stage-3 plug-in; customer journey, responsive mockup, independent delivery boundary, counterpart reviews, and standalone-to-integration walkthrough are confirmed

**Outcome:** after the user has received the immutable quiz-only Bedarfsplan, collect every remaining high-signal general behavior and context fact in one light, resumable flow, compute a separate immutable refined need version backstage, and hand the user directly into Stage 3 without showing a refinement result, delta, or explanation

**Final integration depends on:** the Stage-1 Personal Plan domain and persistence contracts from `plans/2026-08-06-personal-plan-stage1-bedarf-implementation.md` and the stable Stage-3 entry contract. The standalone Stage-2 build deliberately does not import, copy, or modify the active uncommitted Stage-1 worktree.

**Product authority:** `plans/2026-08-07-personal-plan-five-stage-product-journey.md`

**Reviewed visual evidence:** `plans/mockups/2026-08-07-personal-plan-stage2-refinement-flow.html`

**Sequencing note:** the current planning base intentionally does not contain the in-progress Stage-1 files. The active Stage-1 worktree was inspected during planning and currently exposes the named `PlanHeatToolUseEvent`, `PlanRoutineContext`, `PlanProfile`, and initial snapshot shapes, including every tool/route value used below, but all of that implementation remains untracked and has no stable persistence/version layer. Stage 2 therefore starts from fresh `origin/main` as a standalone contract/UI build. A later integration milestone implements narrow adapters against the reviewed Stage-1 and Stage-3 heads; it never copies the dirty Stage-1 tree into Stage 2.

## 0. Independent construction boundary

Nick chose independent construction on 2026-08-07 so Stage 2 can be built while Stage 1 remains unfinished and Stage 3 is being specified. “Built” and “integrated” are separate completion states.

Nick explicitly accepts the bounded rework risk of constructing against local Stage-2 ports before Stage-1/Stage-3 contracts are frozen. The release valve is narrow: if integration would require a user-visible behavior change or cannot satisfy a port with an adapter, stop and return to planning rather than silently bending the standalone contract.

### Milestone A — standalone Stage 2, authorized now

Build and verify:

- the canonical Stage-2 answer schemas and vocabularies;
- a small integration-neutral trigger context rather than imports from Stage-1 internals;
- the deterministic question registry, conditional path, completion rules, and descendant pruning;
- stable Heat-event identities and the event-level frequency/protection projection;
- the client draft/session state machine and a typed gateway interface;
- the reviewed production UI components, save/resume/error/revision-conflict states, and neutral Stage-3 bridge;
- a development/test-only fixture gateway and preview route that make the real UI runnable and browser-testable without claiming production persistence;
- exhaustive pure, component, accessibility, and browser fixtures for the approved journey.

Milestone A may return an opaque fixture `refinedVersionId` and Stage-3 href only inside the preview gateway. It does not compute a real refined need plan, write Supabase, update `hair_profiles`, expose production APIs, or activate the customer route.

### Milestone B — Stage 1/2/3 plug-in, explicitly deferred

After Stage 1 and the Stage-3 entry contract are stable:

- implement an adapter from the immutable Stage-1 version into the Stage-2 trigger context;
- replace the preview gateway with authenticated draft persistence and GET/PATCH/complete APIs;
- add `personal_plan_refinement_drafts`, extend `personal_plan_versions`, and implement RLS/immutability/concurrency;
- call the real refined computation and conservative legacy-profile projection on completion;
- bind the returned refined version to the Stage-3 draft and implement whole-draft invalidation;
- run the full Stage-1→2→3 browser and database contract before any production activation.

Milestone B consumes Milestone A's ports; it must not rewrite the question logic or UI. If real integration cannot satisfy a port without changing user-visible behavior, stop and return to planning.

## 1. Compact implementation contract

### Scope

- build the complete conditional Stage-2 question path and its two-section UI independently of unfinished Stage-1 code;
- model save/resume/revision behavior behind a typed gateway and exercise it through a development/test fixture adapter;
- compute the authoritative path, validation, trigger pruning, and Heat-event projection from explicit integration-neutral context;
- render the neutral bridge into Stage 3, without showing any changed recommendations or refinement result;
- define stable ports for the later Stage-1 refined computation, Supabase draft store, and Stage-3 handoff;
- keep the standalone preview unavailable to paid production traffic and clearly separate fixture completion from real persistence.

### Verification

- deterministic question-path, pruning, normalization, Heat-event, and draft-state fixtures;
- gateway contract tests covering save, resume, revision conflict, retry, and fixture completion;
- component and browser coverage for every meaningful conditional branch, save/retry/resume, Back behavior, accessibility, and 375px/desktop containment;
- proof that the standalone build imports no unfinished Stage-1 code, performs no Supabase/profile writes, and shows no refined result.

### Stop conditions

Stop and return to planning if implementation requires any of the following:

- a general user question not present in the approved ordered contract;
- a new budget, ingredient, routine-length, free-text inventory, or unsupported category input;
- a visible Stage-2 result or initial-versus-refined delta;
- exact product identity or exact-product frequency before Stage 3;
- field-level invalidation of a Stage-3 draft;
- a diagnostic or treatment claim for painful, burning, or inflamed scalp symptoms;
- importing or copying files from the dirty Stage-1 worktree;
- adding a production persistence/API implementation before the Stage-1/Stage-3 integration milestone;
- enabling the production Stage-1 CTA before a working Stage-3 destination exists.

## 2. Chosen user experience

Stage 2 is a focused questionnaire, not a second result screen. It uses the reviewed one-decision-per-page interaction, continuous save feedback, and only two stable progress labels:

1. `Was du heute benutzt`
2. `Wie du dein Haar behandelst`

It never displays `Frage X von Y`, because the path length changes as parents are answered. The category checklist and natural multi-selects remain on single scrollable pages. The only compound pages are:

- towel material plus its conditional handling choice; and
- one selected Heat event's frequency plus its Heat-protection consistency.

The final bridge says, in working copy, `Jetzt schauen wir uns deine Produkte an.` Its primary action enters Stage-3 Pass 1, `Produkte erfassen`. Stage 2 does not show the refined plan, what changed, or why. The first refined result belongs after all Stage-3 product capture and decisions are complete.

### Designed user journey

The customer journey remains exactly the signed-off sequence in sections 3 and 10: immutable Stage-1 result → two-section Stage-2 questionnaire with conditional follow-ups and recovery → neutral Stage-3 bridge with no intermediate result. Independent construction changes only how the implementation is assembled. Milestone A runs that journey with deterministic fixture context in a guarded preview; Milestone B replaces the gateway/context providers, not the rendered journey or client state semantics.

### Planning evidence

`plans/mockups/2026-08-07-personal-plan-stage2-refinement-flow.html` answered whether the complete conditional path could remain light, chronological, recoverable, and visually coherent without a result between Stages 2 and 3. Nick approved its 16-state mobile/desktop direction on 2026-08-07 and then confirmed the final entry-to-handoff walkthrough. The independent-build amendment introduces no new customer surface, copy, timing, or feedback; the same artifact remains the visual authority.

## 3. Exact ordered question contract

The server owns this order and every trigger. The client must not independently infer a different path.

| Order | Question ID and canonical answer                                                  | Trigger                                                                                                   | Consequence                                                                                                                                      |
| ----- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1    | `current_product_categories`                                                      | everyone                                                                                                  | Defines Stage-3 Pass-1 inventory and current category coverage without implying fit                                                              |
| A2    | `wet_wash_frequency`                                                              | everyone                                                                                                  | Supplies the general wet-wash rhythm for refined Shampoo comparison, Dry-Shampoo bridge eligibility, Mask placement, and later load calculations |
| A3    | `scalp_irritation_detail`                                                         | paid quiz contains `irritated`                                                                            | Keeps mild cosmetic guidance conservative or pauses it for painful/burning/inflamed symptoms                                                     |
| A4    | `dry_shampoo_bridge_preference`                                                   | the partial refined computation exposes the bridge opportunity and current categories exclude Dry Shampoo | Resolves accept/decline; existing use is normalized to acceptance without asking                                                                 |
| A5    | `dry_shampoo_visible_hair_color`                                                  | current Dry Shampoo use or accepted bridge                                                                | Supplies later tint/residue matching only                                                                                                        |
| A6    | `oil_purposes`                                                                    | Oil selected                                                                                              | Creates distinct semantic Oil roles; Stage 3 captures one primary active Oil per purpose                                                         |
| B1    | `towel_material` plus conditional `towel_technique`                               | everyone; technique omitted for `no_towel`                                                                | Supplies mechanical/frizz context and later handling guidance without inferring technique from material                                          |
| B2    | `drying_routes`                                                                   | everyone                                                                                                  | Captures air-drying and/or the ordinary/forming airflow routes                                                                                   |
| B3    | `additional_heat_tools`                                                           | everyone                                                                                                  | Completes Heat events without repeating dryer or diffuser                                                                                        |
| B4…n  | `heat_events[event_id]` with `frequency` and conditional `protection_consistency` | once per selected heated event; protection omitted only for ordinary airflow                              | Preserves per-event exposure and protection coverage; never collapses all events into one answer                                                 |
| B5    | `night_protection`                                                                | everyone                                                                                                  | Supplies later application guidance; explicit none differs from unanswered                                                                       |

### Canonical vocabularies

```ts
type Stage2ProductCategory =
  | "shampoo"
  | "conditioner"
  | "leave_in"
  | "heat_protectant"
  | "oil"
  | "mask"
  | "scalp_care"
  | "dry_shampoo"
  | "bondbuilder"
  | "deep_cleansing_shampoo"

type WetWashFrequency = ProductFrequency | "does_not_wash"

type ScalpIrritationDetail = "mild_sensitive_or_itchy" | "burning_painful_or_inflamed"

type DryShampooBridgePreference = "accept" | "decline"
type DryShampooVisibleHairColor = "light_blonde" | "brown" | "dark"

type OilPurpose = "prewash_lengths" | "damp_leave_on" | "dry_finish" | "scalp"

type DryingRoute = "air_dry" | "ordinary_blow_dry" | "diffuser_or_airflow_shaping"

type AdditionalHeatTool =
  | "dryer_brush"
  | "hot_air_styler"
  | "straightener"
  | "curling_or_wave_iron"
  | "thermal_rollers"

type HeatProtectionConsistency = "always" | "sometimes" | "no" | "unsure"

type Stage2HeatEventSource =
  | "ordinary_blow_dry"
  | "diffuser_airflow_shaping"
  | "dryer_brush"
  | "hot_air_styler"
  | "straightener"
  | "curling_or_wave_iron"
  | "thermal_rollers"

type Stage2HeatEventTool =
  | "hair_dryer"
  | "dryer_brush"
  | "hot_air_styler"
  | "straightener"
  | "curling_iron"
  | "other"

type Stage2HeatEventRoute = "ordinary_airflow" | "airflow_shaping" | "direct_contact_heat"

type NightProtection =
  | "silk_satin_pillow"
  | "silk_satin_bonnet"
  | "loose_tied"
  | "pineapple"
  | "length_tip_accessory"
```

`current_product_categories`, `oil_purposes`, `drying_routes`, `additional_heat_tools`, and `night_protection` use arrays with stable code-owned ordering. Explicit none is represented by a completed empty array plus page completion, not a fake category or sentinel inside the array. UI none choices are exclusive.

The category screen contains exactly the ten values above. It has no `Other`, Styling, Serum, Scrub, or free text. It groups categories into Stage-1 relevant and remaining supported categories for presentation only; no category is preselected merely because the plan recommends it.

Milestone A owns the local `Stage2HeatEventSource`, `Stage2HeatEventTool`, and `Stage2HeatEventRoute` unions above; it imports no absent Stage-1 plan type. The Heat-event projection creates the exact stable ID `heat:${source}` from the seven-value Stage-2 source enum, never from `tool`, `route`, array position, or a random client ID. This keeps ordinary blow-dry and diffuser distinct despite their shared `hair_dryer` tool, and keeps `thermal_rollers` distinct from any future source that may also map to `other`. Milestone B adapts these local events into the landed `PlanHeatToolUseEvent` contract. The mapping is:

| Stage-2 source             | `tool`           | `route`               |
| -------------------------- | ---------------- | --------------------- |
| ordinary blow-dry          | `hair_dryer`     | `ordinary_airflow`    |
| diffuser / airflow shaping | `hair_dryer`     | `airflow_shaping`     |
| dryer brush                | `dryer_brush`    | `airflow_shaping`     |
| hot-air styler             | `hot_air_styler` | `airflow_shaping`     |
| straightener               | `straightener`   | `direct_contact_heat` |
| curling/wave iron          | `curling_iron`   | `direct_contact_heat` |
| thermal rollers            | `other`          | `direct_contact_heat` |

Air-drying is retained as application context but does not create a Stage-2 Heat event. Every generated event has its own `ProductFrequency`. `protectionConsistency` is required for `airflow_shaping` and `direct_contact_heat` and absent for `ordinary_airflow`. No maximum or average frequency is used by the Personal Plan computation.

## 4. Answer and path model

Use one schema-versioned canonical object rather than page-specific database columns:

```ts
type PersonalPlanRefinementAnswersV1 = {
  currentProductCategories?: Stage2ProductCategory[]
  wetWashFrequency?: WetWashFrequency
  scalpIrritationDetail?: ScalpIrritationDetail
  dryShampooBridgePreference?: DryShampooBridgePreference
  dryShampooVisibleHairColor?: DryShampooVisibleHairColor
  oilPurposes?: OilPurpose[]
  towel?: {
    material: TowelMaterial
    technique?: TowelTechnique
  }
  dryingRoutes?: DryingRoute[]
  additionalHeatTools?: AdditionalHeatTool[]
  heatEvents?: Record<
    string,
    {
      frequency: ProductFrequency
      protectionConsistency?: HeatProtectionConsistency
    }
  >
  nightProtection?: NightProtection[]
}
```

Optional means not answered or not relevant; it never means a silently accepted default. A completed empty multi-select is distinguishable because the draft also stores its completed question IDs. Do not infer completion from array presence alone.

The pure path function returns:

```ts
type Stage2PathState = {
  orderedQuestionIds: Stage2QuestionId[]
  requiredQuestionIds: Stage2QuestionId[]
  completedQuestionIds: Stage2QuestionId[]
  firstUnresolvedQuestionId: Stage2QuestionId | null
  prunedAnswerKeys: Stage2AnswerKey[]
}
```

It receives a small `Stage2TriggerContext` plus the canonical draft. Milestone A fixtures supply the context directly; Milestone B derives it from the immutable Stage-1 version and partial need computation. The UI and path module never recreate Dry-Shampoo eligibility rules. The active Stage-1 worktree currently exposes `dry_shampoo_bridge_preference` as a deferred fact, but the integration task must re-confirm that contract on the landed head. Parent edits synchronously remove answers that are no longer relevant:

- `dryShampooBridgeEligibility = 'unknown'` behaves like `ineligible` for routing: when Dry Shampoo is not already selected it suppresses A4 and A5, and prunes any stale bridge/colour answers; it never renders a recommendation-dependent question without a positive trigger;

- removing Oil removes `oilPurposes`;
- removing Dry Shampoo and declining or losing bridge eligibility removes visible root colour;
- changing `irritated` eligibility removes irritation detail;
- selecting `no_towel` removes towel technique;
- removing a drying route or Heat tool removes its event detail;
- exclusive none clears the other values on that page.

The shared session transition validates and prunes before the gateway saves a state and returns the authoritative next question. The fixture gateway and later production server must call that same pure transition. The client advances from the returned session; it does not maintain a second conditional path implementation.

## 5. Computation contract

### Standalone dependency ports — Milestone A

The independent build owns only facts it can truthfully define without Stage 1:

```ts
type Stage2TriggerContext = {
  relevantCategories: Stage2ProductCategory[]
  hasReportedIrritatedScalp: boolean
  dryShampooBridgeEligibility: "unknown" | "eligible" | "ineligible"
}

type Stage2RefinementSession = {
  schemaVersion: 1
  pathVersion: string
  revision: number
  status: "in_progress" | "complete"
  triggerContext: Stage2TriggerContext
  answers: PersonalPlanRefinementAnswersV1
  completedQuestionIds: Stage2QuestionId[]
  path: Stage2PathState
}

interface Stage2RefinementGateway {
  load(): Promise<Stage2RefinementSession>
  saveAnswer(input: {
    questionId: Stage2QuestionId
    answer: unknown
    expectedRevision: number
  }): Promise<Stage2RefinementSession>
  complete(input: { expectedRevision: number }): Promise<{
    refinedVersionId: string
    nextHref: "/plan-start/produkte"
  }>
}
```

The fixture gateway is deterministic and development/test-only. It may simulate save failure and revision conflict, but it cannot import Supabase clients, mutate profiles, compute recommendations, or be selected when `NODE_ENV = 'production'`. Its opaque `refinedVersionId` proves only the UI handoff shape.

### Deferred shared computation material — Milestone B

During integration, Stage 2 generalizes the landed Stage-1 engine boundary without weakening the approved Stage-1 snapshot contract.

### Shared computation material

Extract a pure internal `computeNeedMaterial` that accepts the quiz envelope, projection kind, and typed routine context and returns the normalized profile, assessments, decisions, coverage, rendered order, and deferred facts. Keep the public Stage-1 wrapper and every Stage-1 golden fixture unchanged.

Do not let a refined call return a snapshot with `snapshotKind: 'initial_need'`. Add a distinct wrapper and type:

```ts
type RefinedNeedPlanSnapshot = {
  schemaVersion: 1
  snapshotKind: "refined_need"
  computationVersion: string
  inputHash: string
  createdAt: string
  baseInitialVersionId: string
  sourceQuiz: SupportedPersonalPlanQuizEnvelope
  refinementAnswers: PersonalPlanRefinementAnswersV1
  profile: PlanProfile
  assessments: PlanNeedAssessment
  decisions: PlanCategoryDecision[]
  coverage: PlanPortfolioCoverageFact[]
  renderedOrder: Stage1Category[]
  deferredFacts: PlanMissingFactId[]
}
```

The refined `inputHash` covers the base initial-version ID, answer schema version, canonical completed answers, and computation version. It must not be the Stage-1 quiz-only hash. The persisted answer snapshot is fully validated and pruned before hashing.

The routine projection sets:

- `shampooFrequency` from `wetWashFrequency`;
- `heatToolUse` from the event projection, including an empty known set when no heated routes/tools are selected;
- `dryShampooBridgePreference` to `accept` when Dry Shampoo is already selected, otherwise to the explicit bridge answer where relevant;
- `scalpIrritationState` from the conditional answer; generalize the shared type with an explicit known `not_reported` value for a quiz without `irritated` rather than inventing a mild symptom or retaining a false missing fact;
- the new event-level Heat-protection facts and Stage-2 behavioral constraints in the refined snapshot without flattening them into old booleans.

`current_product_load` remains typed unknown after Stage 2 because category selection alone does not reveal exact product identity, placement, or frequency. Stage 3 supplies those facts. Deep-Cleansing and Scalp-Care decisions may therefore stay honestly provisional where their authorities require exact product load.

The Stage-2 completion response contains IDs and navigation state, not decisions or deltas:

```ts
type Stage2CompleteResponse = {
  status: "complete"
  personalPlanId: string
  refinedVersionId: string
  next: { stage: 3; pass: "product_capture"; href: "/plan-start/produkte" }
}
```

The browser must not receive a renderable refined result payload from the completion route. Stage 3 will read the refined version server-side through its own endpoint.

## 6. Persistence and concurrency

**Milestone B only.** Milestone A models these semantics through `Stage2RefinementSession`, the gateway contract, and deterministic fixture behavior; it adds no migration, Supabase adapter, authenticated route, or profile write.

### `personal_plan_refinement_drafts`

Add one mutable current draft per logical Personal Plan:

- `id uuid primary key`;
- `personal_plan_id uuid not null unique` with owner relationship through `personal_plans`;
- `base_initial_version_id uuid not null`;
- `schema_version integer not null`;
- `path_version text not null`;
- `answers jsonb not null default '{}'`;
- `completed_question_ids text[] not null default '{}'`;
- `current_question_id text null`;
- `revision bigint not null default 0` for optimistic concurrency;
- `status text not null check ('in_progress', 'complete')`;
- `completed_refined_version_id uuid null`;
- created, updated, and completed timestamps.

Owner-scoped RLS permits reads but not arbitrary client writes. All writes pass through the authenticated server route. A draft always points to the exact immutable Stage-1 version it refines; it is never hydrated from legacy onboarding/profile fields. Old-onboarding users answer the new path from the beginning. Only this draft resumes.

Each page save supplies the complete answer for one question plus `expectedRevision`. In one transaction the server locks the draft, rejects stale revisions with `409 revision_conflict`, validates the submitted question against the authoritative current path, overwrites that question's answer, prunes descendants, increments the revision, and returns the canonical draft summary plus next question. PATCH has no separate mutation-ID store: after a lost response, the retry receives `409`, reloads the canonical draft, and recognizes the already-saved full answer. Completion, where duplicate insertion matters, remains content-hash idempotent.

Completion locks the draft and plan, recomputes the complete path, rejects unresolved relevant questions, computes the refined snapshot, and inserts or reuses the immutable refined version by hash. Only then does it mark the draft complete. A failed snapshot insert cannot leave a completed draft.

### `personal_plan_versions`

Extend the Stage-1 constraint and persistence adapter to support `scope = 'refined_need'`. The row remains immutable and stores the validated refinement-answer snapshot alongside its computation snapshots. Enforce one current refined proposal with a partial unique index over `personal_plan_id` where `scope = 'refined_need' and status = 'proposed'`; a changed completed draft supersedes the previous refined version in the same transaction. Re-completing identical canonical answers returns the existing version.

Stage 1 is never superseded by Stage 2. `initial_need` and `refined_need` have independent current-version constraints.

### Stable Stage-3 invalidation contract

Stage 3 must key every mutable product draft to `refined_version_id`, never only to `personal_plan_id`. Before Stage 3 has started, a Stage-2 edit reopens the refinement draft normally and creates a successor refined version on completion.

Once an unfinished Stage-3 draft exists, editing Stage 2 requires the explicit warning approved in the journey. Confirmation discards the entire unfinished Stage-3 draft and restarts Stage-3 Pass 1 against the successor refined version. Cancellation leaves Stage 2 and Stage 3 unchanged. Do not implement field-level dependency invalidation.

This Stage-2 milestone defines the foreign-key/version invariant and response shape. The Stage-3 milestone implements its draft table, warning transaction, and discard. Until that exists, the public feature gate prevents a user from reaching the cross-stage edit state.

## 7. Legacy profile compatibility projection

**Milestone B only.** The standalone build retains the mapping as an integration contract but does not execute it.

The refined version is the Personal Plan source of truth. Do not copy old onboarding answers into the new draft, and do not force the richer new model into lossy legacy fields as if those fields were authoritative.

**Chosen compatibility behavior:** Nick confirmed the conservative overwrite on 2026-08-07. It is preferable to retaining stale legacy onboarding values for the live Chat consumers. Chat may warn more conservatively when a richer answer cannot be represented, while the refined Personal Plan version retains the event-level truth. Adding a second event-level profile schema and migrating Chat in this milestone is rejected as disproportionate scope.

After a successful Stage-2 completion, update only this explicit compatibility projection in the same server transaction or a transactionally invoked database function:

- overwrite `towel_material`, `towel_technique`, and `night_protection` exactly;
- overwrite `styling_tools` with an explicitly lossy compatibility projection from drying routes plus additional Heat tools: map ordinary blow-dry to `blow_dryer`, diffuser to `diffuser`, dryer brush to `hot_air_brush`, hot-air styler to `multi_tool`, straightener to `flat_iron`, curling/wave iron conservatively to `curling_iron`, and thermal rollers exactly; the refined event model remains authoritative;
- set legacy `drying_method` only when exactly one new drying route maps unambiguously; otherwise clear it instead of inventing a dominant route;
- clear legacy `brush_type`, because detangling context is not a brush inventory;
- derive legacy `heat_styling` from the highest-frequency heated event solely for existing consumers;
- derive legacy `uses_heat_protection = true` only when every qualifying selected Heat event is answered `always`; otherwise set it to `false` as a conservative compatibility value;
- project explicitly completed empty `nightProtection` to legacy `[]`, never `null`, so explicit none remains distinguishable from a missing profile fact.

The Personal Plan engine and new Stage-2 UI never read those lossy aggregate fields back. Tests label the Heat aggregates as compatibility behavior. Any existing consumer that needs event-level accuracy must migrate to the refined version in a separately scoped change.

Do not mutate current routine products or create product-usage rows from the Stage-2 category checklist. Stage 3 owns exact identity, exact-product frequency, active-product state, and one primary Oil per purpose.

## 8. API contract

**Milestone B only.** Milestone A's UI talks exclusively to the injected `Stage2RefinementGateway`; the preview route must not expose production-shaped API handlers backed by fixture data.

Implement a narrow authenticated route family:

- `GET /api/personal-plan/stage-2` returns access state, the canonical draft summary, the current question, and display-safe Stage-1 category grouping;
- `PATCH /api/personal-plan/stage-2` saves the complete answer for one currently relevant question with `expectedRevision`;
- `POST /api/personal-plan/stage-2/complete` validates the whole path and creates/reuses the refined version.

Every route requires:

- the Personal Plan feature entitlement;
- ownership of the logical plan;
- a ready immutable Stage-1 version;
- the Stage-2 route flag for UI access.

Typed non-200 outcomes include `not_authenticated`, `not_entitled`, `stage_1_incomplete`, `invalid_answer`, `question_not_current`, `revision_conflict`, `incomplete_refinement`, and `temporarily_unavailable`. Do not return raw database messages or quiz/answer payloads in errors.

Back navigation edits the existing draft; it does not create a browser-only fork. A parent edit is saved and pruned before the new forward path is shown. Refresh and a second device always resolve from server state.

## 9. UI target map

### New files

- `src/app/labs/personal-plan-stage-2/page.tsx`, following the existing Labs convention and guarded with `notFound()` unless `NODE_ENV === 'development'`;
- `src/components/personal-plan-refinement/refinement-flow.tsx`
- `src/components/personal-plan-refinement/refinement-question.tsx`
- `src/components/personal-plan-refinement/refinement-options.tsx`
- `src/components/personal-plan-refinement/refinement-bridge.tsx`
- `src/lib/personal-plan/refinement/types.ts`
- `src/lib/personal-plan/refinement/question-path.ts`
- `src/lib/personal-plan/refinement/heat-events.ts`
- `src/lib/personal-plan/refinement/session.ts`
- `src/lib/personal-plan/refinement/gateway.ts`
- `src/lib/personal-plan/refinement/fixture-gateway.ts`, imported only by the preview route and tests;
- focused pure/component/browser tests alongside the existing test conventions.

Keep save error, resume, compound towel, and repeated Heat-event states inside the flow/question components until reuse is proven. Do not create a component per question.

Reuse `src/components/quiz/quiz-option-card.tsx`, `src/components/ui/icon.tsx`, `src/components/ui/info-tip.tsx`, and existing quiz/Personal Plan CSS tokens as read-only presentation dependencies. Build the Stage-2 shell, progress, grouped inventory, compound pages, save/retry dock, and gateway-bound progression inside the new Stage-2 components. Do not directly reuse or refactor `src/components/onboarding/screens/*`: those screens own legacy auto-advance, non-empty selection assumptions, aggregate Heat fields, and onboarding-store progression that conflict with the approved flow. This evidence-backed choice avoids live-onboarding regression churn while preserving the same visual language.

### Existing files to extend

- shared `ProductFrequency`, towel, night-protection, and styling-tool vocabularies only where values are genuinely identical.

Milestone A does not edit Stage-1 Personal Plan files, database types, route classification, the Stage-1 CTA, production analytics routing, or Supabase migrations. Milestone B locates and extends those surfaces from the then-current integrated head.

Reuse the live onboarding's proven option-card and mobile shell visual language where practical, but do not mount or extend its Zustand onboarding store. The Personal Plan draft is server-owned, versioned, and separate from legacy onboarding completion.

## 10. Page behavior and states

The numbered behavior is the production target. In Milestone A, the guarded preview route injects deterministic trigger/session fixtures for ready, conditional, save-error, revision-conflict, resume, and complete states. It must visibly identify itself as a preview in development tooling without adding preview language inside the customer component.

1. Entry checks Stage 1. An absent/incomplete Stage-1 version redirects to the Stage-1 recovery path, never to a partial Stage-2 form.
2. A new draft begins at the invitation, then A1. A resumed draft opens at the first unresolved relevant question and shows a brief `Weiter verfeinern` state.
3. A page's primary action is disabled until its answer is locally valid. It shows an in-place saving state and advances only after the canonical server response.
4. A save failure keeps the selected answer on screen, explains that nothing was lost locally, and offers retry. Navigating away before a successful retry must not claim the page is saved.
5. A `409` reloads the canonical server draft, explains that newer progress was found, and resumes without overwriting it.
6. Back returns to the previous question in the current computed path. Editing and continuing persists the new path and prunes obsolete descendants.
7. Severe irritation shows a short safety boundary: cosmetic scalp recommendations will be paused and medical assessment may be appropriate. It does not diagnose or prescribe.
8. Completion renders only the neutral Stage-3 bridge. No need cards, tier changes, comparison, confetti result, or delta copy appears.
9. The user may exit and reopen Stage 1 at any point. They cannot bypass incomplete Stage 2 to begin Stage 3.

The reviewed mockup covers invitation, every ordered page type, conditional Dry-Shampoo and Oil pages, save error, resume, and the neutral bridge at mobile and desktop widths. Production copy may be polished without changing the reviewed hierarchy, question meaning, or boundary.

## 11. Analytics and privacy

Milestone A exposes code-owned UI telemetry callbacks and verifies that no answer values are passed to them, but it does not register or dispatch production analytics events. Event registration and consent-aware routing belong to Milestone B.

Milestone B registers these consent-gated client events; Milestone A's callback names align with them but dispatch nowhere. No callback/event may include raw answers, product names, free text, or health detail:

- `personal_plan_stage2_started`
- `personal_plan_stage2_question_viewed` with a coarse non-sensitive page family and section only
- `personal_plan_stage2_answer_saved` with the same coarse page family only
- `personal_plan_stage2_save_failed` with typed error code
- `personal_plan_stage2_resumed`
- `personal_plan_stage2_completed`
- `personal_plan_stage2_bridge_viewed`

Do not send exact question IDs for conditional health-context pages, selected categories, irritation choice, root colour, Heat tools, or frequencies to analytics properties. Server logs use opaque plan/version IDs and typed error codes.

## 12. Deterministic test matrix

### Pure path and schema tests

- neutral path with no optional conditionals;
- Oil selected versus removed, including descendant pruning;
- existing Dry Shampoo skips the bridge question, implies acceptance, and asks root colour;
- eligible non-user accepts versus declines the bridge;
- ineligible bridge omits both preference and colour;
- unknown bridge eligibility omits both preference and colour and prunes stale conditional answers;
- irritated quiz adds exactly the two-level clarification;
- `no_towel` removes technique;
- multiple drying routes and tools create stable, ordered, separate events;
- ordinary airflow requires frequency but not protection consistency;
- airflow shaping and direct-contact events require both answers;
- event removal prunes only that event detail;
- exclusive none behavior for categories, tools, detangling, and night pages;
- exactly ten accepted product categories and rejection of unsupported values/free text;
- complete empty array differs from unanswered;
- old profile/onboarding values never prefill a new draft;
- stable order does not change when conditional pages are inserted or removed.

### Refined computation fixtures

**Milestone B.** Retain these as integration acceptance criteria; do not fake them in the standalone build.

- Stage-1 snapshot canonical bytes remain unchanged after Stage-2 computation;
- refined snapshot has `snapshotKind = 'refined_need'` and a distinct hash;
- wet-wash rhythm resolves the Shampoo comparison without pretending exact Shampoo usage is known;
- existing Dry Shampoo normalizes to accepted bridge behavior;
- decline removes bridge need without showing a result in Stage 2;
- mild versus severe irritation takes the approved conservative/paused paths;
- per-event Heat frequency changes Heat tier/cadence correctly;
- `always`, `sometimes`, `no`, and `unsure` remain distinguishable for coverage;
- ordinary airflow alone does not automatically create Heat-protection need;
- current product load remains unknown until Stage 3;
- Oil purposes survive as separate Stage-3 role requirements;
- identical canonical answers are idempotent; a changed answer produces a successor refined version.

Port every Stage-2-owned category fixture identified by the Stage-1 implementation authority, preserving its stable fixture name and rule IDs. Do not broaden Stage 2 into owned-product verdict fixtures; those belong to Stage 3.

### Persistence and route tests

**Milestone B.** Milestone A covers the equivalent interaction semantics through gateway/session contract tests, not database or authorization claims.

- owner can read only their draft/version; anonymous and cross-user access fails;
- direct client insert/update of draft and versions fails under RLS;
- stale revision returns `409` and cannot overwrite newer progress;
- a lost PATCH response followed by stale-revision retry reloads the already-saved canonical answer without applying it twice;
- completion rejects an incomplete recomputed path even if the client claims completion;
- concurrent completion produces one current refined version;
- immutable refined snapshot fields reject updates;
- changed completion supersedes only the prior refined version, never Stage 1;
- profile compatibility projection happens only with successful completion;
- feature-off and missing-Stage-1 states fail closed.

### Component and browser tests

- guarded preview fixture enters invitation/A1 and is unavailable in production mode;
- section label changes at B1 and no numeric total is shown;
- every conditional branch from the reviewed mockup;
- save error/retry and second-device revision conflict;
- refresh/resume at the first unresolved question;
- Back, parent edit, pruning, and forward path;
- focus placement, keyboard selection, `aria-pressed`, exclusive-none announcement, and error announcement;
- no horizontal overflow and usable sticky action at 375px, 768px, and desktop;
- final bridge contains no refined cards, delta, result explanation, or serialized decisions;
- the bridge appears only after fixture completion and exposes only the opaque handoff shape; preview browser tests assert the href but do not navigate to the intentionally absent Stage-3 route;
- no production API, analytics, profile write, Stage-1 CTA, or customer route is activated.

## 13. Delivery sequence

Create a fresh `codex/personal-plan-stage2-implementation` worktree from current `origin/main`. The standalone branch never imports or cherry-picks the dirty Stage-1 worktree. Keep the preview route development/test-only and stop Milestone A at a verified local review-ready branch.

### Standalone Slice A — answer, event, and path domain

**Consumes:** this plan's exact question/vocabulary contract plus current shared onboarding/frequency vocabularies from `origin/main`.

**Owns:** `types.ts`, `heat-events.ts`, `question-path.ts`, and their red-first deterministic tests. The Dry-Shampoo trigger is an injected `Stage2TriggerContext` fact, never a duplicated recommendation rule.

**Produces:** canonical answers, stable event IDs/projection, path state, trigger context, completion validation, and pruning functions.

**Acceptance:** every approved path/pruning/empty-versus-unanswered/Heat-event fixture passes; unsupported values fail validation; no React, gateway, persistence, or Stage-1 import.

### Standalone Slice B — session state and gateway contract

**Consumes:** Slice A's pure transition contracts.

**Owns:** `session.ts`, `gateway.ts`, `fixture-gateway.ts`, and contract tests for load, save, retry, revision conflict, resume, parent-edit pruning, and fixture completion.

**Produces:** one injected async interface used unchanged by preview and future production adapters.

**Acceptance:** deterministic fixture scenarios produce the same canonical sessions as the pure transition; the fixture adapter is impossible to select in production; no Supabase/API/profile/analytics code.

### Standalone Slice C — reviewed UI and preview harness

**Consumes:** Slice B's gateway and the approved 16-state mockup.

**Owns:** question flow, invitation, section progress, save/retry/resume, neutral bridge, privacy-safe callback contract, responsive/a11y/browser tests, and the guarded preview harness.

**Produces:** production-quality reusable UI components plus a guarded development/test preview page.

**Acceptance:** browser flow matches the reviewed artifact and ordered contract at mobile/desktop sizes; all meaningful conditional and recovery fixtures pass; callbacks expose no answer values; the preview is unavailable in production mode; no production route or CTA changes.

### Deferred Integration Slice D — Stage 1/2/3 adapters

**Consumes:** the reviewed Stage-1 head, stable Stage-3 entry contract, and standalone ports from Slices A–C.

**Owns:** real trigger-context adapter, refined computation wrapper, Supabase draft/version migration and RLS, authenticated API gateway, compatibility projection, analytics registration, production route/CTA, Stage-3 version binding, and database/end-to-end tests.

**Acceptance:** every deferred computation/persistence fixture in section 12 passes; the standalone domain/UI require no behavior rewrite; Stage 1 stays immutable; production activation remains separately gated.

Stage-3 planning then consumes `refinedVersionId`, implements Pass 1 exact product/frequency capture, recomputes exact-product load, and only after its full decision pass exposes the first refined result.

## 14. Rollout, rollback, and observability

- Milestone A has no customer rollout. The preview route resolves only in development/test and returns `notFound()` for production builds/runs.
- Internal/review access exercises the complete fixture flow through the neutral bridge without Supabase or profile writes.
- Do not direct paid production users into Stage 2 until Stage-3 Pass 1 is deployed and the Stage-2→3 end-to-end journey has passed review.
- Milestone A rollback is code-only and removes no customer state because it creates none.
- Production feature flags, runtime monitoring, immutable version retention, and forward-safe schema rollback begin only in Milestone B.

## 15. Explicit non-goals

- any Stage-3 exact-product search, identity capture, product frequency, fit verdict, recommendation, shopping-list, or keep/switch action;
- any visible refined result before Stage 3 completes;
- Stage-4 Routine or Stage-5 Anwendungsplan UI/compiler work;
- budget, price tier, ingredient preference/exclusion, routine length, desired time, free-text inventory, or unsupported categories;
- generic buildup, general medical history, or new hair-loss questions;
- product-purpose primaries beyond the approved Oil-purpose handoff;
- legacy-onboarding migration, prefill, or partial reconfirmation;
- field-level Stage-3 invalidation;
- changing category evidence authorities, adding catalog claims, or changing product-fit thresholds;
- Milestone-A Supabase migrations, authenticated API handlers, profile projection, real refined computation, production analytics dispatch, or customer-route activation;
- production activation, deployment, or data backfill.

## 16. Review gates before implementation

- [x] exact product grilling completed with Nick;
- [x] reviewable responsive mockup built and technically exercised;
- [x] Nick approved the mockup's visual/interaction direction;
- [x] Claude counterpart review completed at high effort and reconciled;
- [x] final designed-user-journey walkthrough completed;
- [x] Nick explicitly signed off the Stage-2 journey and implementation plan on 2026-08-07.
- [x] independent-build amendment reviewed by the Claude counterpart at high effort and reconciled;
- [x] standalone-to-integration journey explicitly confirmed by Nick on 2026-08-07.

### Counterpart-review reconciliation

The read-only Claude review returned `approve with revisions`. The plan incorporated every grounded correctness issue:

- made the unmerged Stage-1 dependency a hard sequencing gate and required an export/schema reconciliation on the landed head;
- split the oversized domain milestone into refined-computation and question-path PRs;
- removed the unsupported client mutation-ID idempotency promise and specified canonical `409` recovery for full-answer PATCHes;
- aligned `dry_shampoo_visible_hair_color` with the overarching journey authority;
- relabeled and specified the legacy tool/profile mapping as deliberately lossy;
- named the partial unique index for the current refined proposal and the explicit-empty Night projection;
- required the A4 Dry-Shampoo trigger and Heat tool enum to be reverified against landed Stage 1;
- resolved the only product tradeoff in favor of the conservative legacy-profile overwrite confirmed by Nick.

The review's report that Stage-1 files were absent from this planning worktree was correct for this branch but not evidence that the contracts had never been drafted: they were inspected in the separate active Stage-1 worktree. The plan therefore treats them as observed planning evidence, not a stable dependency, until Stage 1 lands.

### Independent-build amendment review reconciliation

The second read-only Claude review returned `approve with revisions`. Reconciliation:

- accepted and specified source-keyed Heat-event IDs as `heat:${source}`;
- accepted and defined local Stage-2 Heat source/tool/route unions, with Stage-1 adaptation deferred;
- accepted and specified that unknown Dry-Shampoo eligibility suppresses A4/A5 and prunes stale answers;
- accepted the established `src/app/labs/*` development-preview convention and made Stage-3 href tests non-navigating;
- accepted the bounded integration-rework risk already chosen by Nick;
- resolved the UI reuse tradeoff through direct code inspection: reuse shared option/icon/info/CSS primitives, but keep Stage-2 composition separate from legacy onboarding screens/store;
- retained the unchanged signed-off customer journey; only the standalone-to-integration implementation journey remains to confirm before worker dispatch.
