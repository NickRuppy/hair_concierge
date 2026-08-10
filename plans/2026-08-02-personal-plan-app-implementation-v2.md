# Personal Plan App V1 — Implementation Plan

**Status:** not implementation-ready; dedicated plan-engine architecture selected, detailed Shampoo, Conditioner, Leave-in, Mask, Oil, Deep Cleansing, and Dry Shampoo specifications confirmed, remaining category grilling in progress

**Outcome:** deliver the paid personal-plan promise as a deterministic three-stage plan and a lightweight daily-use app

**Computation source:** `plans/2026-08-02-personal-plan-computation-spec.md`

**Visual sources:** journey v12 in `plans/mockups/2026-07-30-promise-product-journey.html` and selected Option 1 in `plans/mockups/2026-08-01-day-type-calendar-logging-options.html`

## 1. Chosen direction

Build the personal plan as a **versioned confirmed plan** with one dedicated deterministic plan engine:

- `src/lib/personal-plan/` computes category need, product type, frequency, and reasons without calling CareBalance or the legacy recommendation runtime;
- useful current rules and pure fit helpers may be recycled into that clean boundary, while existing catalog/product specs remain shared data;
- plan-owned category target/fit logic judges owned products and selects one exact alternative per uncovered role, deduplicating when one verified product covers several roles;
- `user_product_usage` remains the active/pending product inventory;
- a new pure compiler turns the confirmed portfolio into an ordered day-type library and seven-day suggestion band;
- the existing routine tracker remains the log store;
- the first completed computation is a proposed version; user confirmation makes that exact version active and immutable;
- later relevant changes create a proposed successor with a visible delta while the current version stays active.

The offer artifact's `locked_plan` is preview/provenance input, not the final recommendation authority. Chat is an optional consumer, not part of plan computation.

## 2. Scope

### In scope

- required post-payment inputs that are still missing, without repeating the quiz-result analysis;
- stage 1 as the first paid output: personal category needs, target product type, reason, and frequency;
- stage 2: owned/pending product reconciliation, exact recommendation, non-blocking override, and shopping list;
- stage 3: generated day-type library, precise runbooks where verified, seven-day suggestion band, and one-tap exact-day logging;
- `Heute`, `Produkte`, and a tracker-grounded `Fortschritt` tab;
- profile/product/catalog changes that alter user behavior create proposed successors and always require explicit confirmation;
- personal-plan-only feature flag and entitlement gate;
- deterministic tests, visual verification, analytics, and rollback behavior.

### Non-goals

- styling-product recommendations in V1; leave no generic `styling` placeholder;
- Chat as recommendation or mutation authority;
- symptom-diagnosis or treatment of persistent/severe scalp or hair-loss conditions;
- fabricated before/after progress scores or causal “this product worked” claims;
- step-level completion and per-product log tracking;
- fixed calendar appointments or notifications;
- profile-page visual redesign;
- legacy-buyer migration;
- Customer.io campaign creation;
- automatic purchase detection from an affiliate-link click.

### Category-specification checkpoint

| Category | Current status | Implementation authority |
|---|---|---|
| Shampoo | Detailed behavior confirmed: inclusion, scalp-concern precedence, role splitting, cadence, owned-product handling, catalog selection, response check, and escalation | `docs/personal-plan/categories/shampoo/decision.md` plus its linked evidence and the cross-category computation spec |
| Conditioner | Detailed category behavior confirmed: inclusion, target axes, functional needs, event cadence, multi-product allocation, layered product-fit verdicts, application guidance, fallbacks, and fixtures. Shared reason salience and cross-category function ownership are intentionally deferred until every category is specified. | `docs/personal-plan/categories/conditioner/decision.md` plus its linked evidence |
| Leave-in | Detailed wash-day and heat-event behavior confirmed: inclusion and ownership boundaries, target axes, care/heat combination, narrow Conditioner replacement, occurrence cadence, primary/secondary allocation, role-relative fit, application fallback, safety, and fixtures. Between-wash refresh and final shared ownership/presentation remain explicitly deferred. | `docs/personal-plan/categories/leave-in/decision.md` plus its linked evidence |
| Mask | Detailed behavior confirmed: inclusion, target axes, functions, cadence bands, one-primary allocation, layered fit, verified protocols, fallbacks, safety, reasoning, and fixtures. | `docs/personal-plan/categories/mask/decision.md` plus its linked evidence |
| Oil | Detailed wash-day behavior confirmed: three independent roles, inclusion, use-case presentation, functional benefits, every-wash Basis cadence, chronological role-based product assignment without primary/secondary ranking, role-relative weight/dosage fit, reconciliation, application, safety, ownership, and fixtures. Optional/non-wash allocation belongs to the later day-type spec and is a hard pre-launch gate; live catalog backfill remains an implementation dependency. | `docs/personal-plan/categories/oil/decision.md` plus its linked evidence |
| Deep Cleansing | Detailed behavior confirmed: Reset-load inputs and scoring, Basis/Optional thresholds, every-third/every-fourth-wash substitution cadence, scalp pause boundary, residue/mineral roles, minimal product facts, layered fit, one-product allocation, application fallback, reasoning, and fixtures. Colour compatibility remains an explicit catalog backfill rather than an inferred fact. | `docs/personal-plan/categories/deep-cleansing/decision.md` plus its linked evidence |
| Dry Shampoo | Detailed behavior confirmed: Optional-only inclusion and conditional bridge question, sequence-based cadence guard, separate fit/cadence/pause outputs, minimal Drogerie-oriented product facts, soft sensitivity/tint/direction fit, one-active-product allocation, late-bound tint resolution, four format protocols, reasoning, and fixtures. Exact product backfill and powder-format verification remain catalog work. | `docs/personal-plan/categories/dry-shampoo/decision.md` plus its linked evidence |
| Remaining V1 categories | Inclusion and broad behavior are still provisional until grilled with Nick | To be added category by category |

This commit is a stable planning checkpoint, not authorization to implement the whole app. Shampoo, Conditioner, Leave-in, Mask, Oil, Deep Cleansing, and Dry Shampoo are confirmed category specifications; implementation starts only after the remaining categories, the reviewed journey, and the final plan review are complete.

## 3. Architectural invariants

1. `src/lib/personal-plan/compute.ts` is the single personal-plan computation entry point.
2. Plan-owned category modules return inclusion, need tier, target type, frequency, and reasons directly.
3. Plan-owned target/fit/selection logic owns exact product suitability while reusing the shared catalog and product specs.
4. `user_product_usage` owns active and pending products.
5. `routine_logs` owns history.
6. The same versioned inputs and computation version produce the same proposed plan.
7. A confirmed plan version is immutable and remains active until the user confirms a successor.
8. Relevant changes create a proposed version; they never silently rewrite the active version.
9. Historical logs never change during recomputation and retain their plan-version context.
10. Shopping recommendations stay stable until explicitly replaced, removed, or acquired.
11. Only confirmed-in-hand products produce executable steps.
12. Verified product instructions override category defaults; unknown timing stays visibly unknown.
13. Deterministic scheduling receives `startDate` and `timeZone` as explicit inputs; pure computation never reads the system clock.
14. Category computation owns the total cadence; the sum of active product assignments covers that total exactly and never increases it implicitly.
15. Current product frequency and recommended plan-assignment frequency are distinct versioned facts.

CareBalance and the legacy recommendation runtime may be inspected for proven rules, but no Personal Plan task calls them as its recommendation authority. Each confirmed category is implemented once inside the dedicated plan-owned module boundary; shared catalog data and genuinely generic pure helpers may still be reused.

## 4. Persistence properties confirmed so far

The earlier one-row mutable `personal_plan_states` proposal is superseded. The chosen model requires:

- one logical personal plan per user;
- immutable plan versions with at most one active version and optionally one proposed successor;
- enough versioned input, decision, product, category, day-type, and instruction data to reopen the exact plan the user confirmed even after code or catalog data changes;
- an explicit link from a proposed version to the active version it would replace;
- confirmation/rejection timestamps and the reason the proposal was created;
- current product inventory to remain owned by `user_product_usage`, without treating later inventory changes as edits to an older plan version.

The exact relational-versus-JSON representation remains an implementation decision. It must preserve immutable versions and must not collapse back into a mutable current-state row.

### `product_application_protocols`

Zero or more verified rows per product, keyed by `(product_id, role_key)`, with stage, hair state, placement, amount guidance, phases/contact time, rinse behavior, replacement/exclusion categories, evidence URL, and verification timestamp. Category defaults remain in code for roles whose category authority permits a fallback. Every verified supported Oil role requires its matching protocol row before it can enter an executable recipe. V1 deliberately does not add a protocol-authoring UI: seed the small verified role-specific set required for launched recommendations, and treat broader catalog enrichment/admin authoring as a follow-up.

### `routine_logs`

Add nullable plan-version and exact-day-type references. Keep existing `day_type` for legacy behavior and wash-rhythm math.

The migration must also drop/recreate the hardened service-role-only `replace_routine_log(...)` function with a nullable `p_plan_day_type_id`, preserve every existing payload, ownership, date, revision, and product-reference guard, return the exact recipe id in the day payload, revoke the old signature, and re-grant only the intended signature. A column-only migration is insufficient because direct authenticated table writes are revoked.

Canonical mapping to the existing tracker family:

| Personal plan key | Existing `day_type` |
|---|---|
| `wash` | `wash` |
| `intensive_care_wash` | `wash` |
| `clarifying_wash` | `clarifying` |
| `refresh` | `styling_only` |
| `care_without_wash` | `treatment_only` |
| `rest` | `none` |

Do not create a second mutable product inventory, day-log store, or check-in system. Immutable plan-version snapshots may contain product and day-type data because they are historical prescription records, not competing current-state authorities.

## 5. Target map

### Existing files to extend

- `src/lib/personal-plan-quiz/types.ts`
- `src/lib/personal-plan-quiz/persistence.ts`
- `src/lib/personal-plan-quiz/draft.ts`
- `src/lib/quiz/link-to-profile.ts`
- `src/lib/routines/load-routine-artifact-data.ts`
- `src/lib/tracking/types.ts`
- `src/lib/tracking/rhythm.ts`
- `src/lib/tracking/api-handlers.ts`
- `src/lib/billing/checkout-success-redirect.ts` or the current `/plan-bereit` success CTA seam after re-audit
- `src/lib/funnel/flags.ts` for the server-only feature-flag accessor
- the current auth/entitlement middleware seam

### Existing sources to inspect or extract from, not call as Personal Plan authority

- `src/lib/recommendation-engine/types.ts`
- `src/lib/recommendation-engine/contracts.ts`
- `src/lib/recommendation-engine/care-balance/evaluators.ts`
- `src/lib/recommendation-engine/care-balance/frequency-targets.ts`
- `src/lib/recommendation-engine/categories/index.ts`
- `src/lib/recommendation-engine/selection.ts`

### New computation files

- `src/lib/personal-plan/types.ts`
- `src/lib/personal-plan/compute.ts`
- `src/lib/personal-plan/categories/shampoo.ts`
- `src/lib/personal-plan/categories/deep-cleansing.ts`
- `src/lib/personal-plan/categories/dry-shampoo.ts`
- `tests/personal-plan/categories/shampoo.test.ts`
- `tests/personal-plan/categories/deep-cleansing.test.ts`
- `tests/personal-plan/categories/dry-shampoo.test.ts`
- `src/lib/personal-plan/check-ins.ts`
- `src/lib/personal-plan/protocols.ts`
- `src/lib/personal-plan/day-types.ts`
- `src/lib/personal-plan/schedule.ts`
- `src/lib/personal-plan/recompute.ts`
- `src/lib/personal-plan/persistence.ts`

### Durable category knowledge

- `docs/personal-plan/categories/README.md`
- `docs/personal-plan/categories/<category>/evidence.md`
- `docs/personal-plan/categories/<category>/decision.md`

Each category is checkpointed after its evidence and product decisions are reconciled. These files preserve evidence, rationale, and implementation intent; they do not replace runtime code, tests, catalog data, or verified product protocols.

### New product surfaces

- `src/app/plan-start/page.tsx`
- `src/components/personal-plan-start/**`
- `src/app/api/personal-plan/**`
- `src/components/personal-plan-app/**`
- `src/app/heute/**`
- `src/app/produkte/**`
- `src/app/fortschritt/**`

### Tests

- Category-unit tests live under `tests/personal-plan/categories/*.test.ts`; plan-wide integration, persistence, scheduling, and artifact tests retain the repository's flat `tests/personal-plan-*.test.ts` convention. Task 2 must extend `test:node` with the nested category glob while preserving the existing flat glob.
- `tests/personal-plan-category-artifacts.test.ts`
- `tests/personal-plan-compute.test.ts`
- `tests/personal-plan-shampoo-selection.test.ts`
- `tests/personal-plan-shampoo-check-ins.test.ts`
- `tests/personal-plan-day-types.test.ts`
- `tests/personal-plan-schedule.test.ts`
- `tests/personal-plan-recompute.test.ts`
- focused Personal Plan tests plus regression coverage for current CareBalance, selection, routine, tracking, billing redirect, and entitlement behavior;
- one personal-plan golden-path Playwright test plus mobile screenshots at 375 px.

Exact route/component filenames may be adjusted to current repository conventions during implementation, but the computation seams and ownership boundaries above are fixed.

## 6. Designed user journey

### Entry

1. A paid `personal_plan` buyer reaches the existing payment-ready/polling state.
2. With `PERSONAL_PLAN_APP_V1_ENABLED` off, existing behavior is unchanged.
3. With it on, the CTA opens `/plan-start`.
4. The flow does not repeat the quiz-result analysis or add a separate “your analysis” reveal. If a computation input is still missing, it asks only that question with a short local explanation; otherwise the first screen is the Stage 1 Bedarfsplan.

Server access uses the existing `hasCurrentAppAccess` authority, which already covers current subscriptions, active one-time personal-plan purchases, and manual grants. Product-audience eligibility additionally requires a `personal_plan_prepared_artifact` linked to the same user (and then the corresponding logical personal-plan record). This keeps legacy subscribers out without inventing another entitlement system.

### Required inputs

5. The flow collects or confirms each missing computation input at the point where it is needed: wash cadence, heat behavior, routine/time preference, budget, strong exclusions, and current products.
6. Existing canonical answers are prefilled and never asked again without a reason.
7. Product entry reuses the current onboarding choice: select from catalog or submit a new product for review.
8. A submitted unknown product appears immediately as pending; the user can continue.

### Stage 1 — what the hair needs

9. The Bedarfsplan is the first paid output. The stage indicator `Bedarf · Produkte · Alltag` provides orientation without a separate explanation screen.
10. “Deine Basis” contains every category Hair Concierge confidently recommends for this person, including goal-driven categories. Cards reuse the live routine-page shell: image/placeholder tile, category label, status color, target product type, frequency meter, concise reason, and detail affordance.
11. At this stage green means the category and target product type confidently fit the person's needs; it does not claim that a specific product fits. Genuine extras reuse the routine page's inset suggestion treatment and `Vorgeschlagen` badge in a small section below the basis. If there are no optional categories, the section is omitted entirely.
12. `not_needed` categories are omitted from the ideal portfolio, except an already-owned unnecessary/overused product can appear later in reconciliation.

### Stage 2 — which exact products do the job

13. Categories remain in the same order as Stage 1.
14. Each category card repeats its target job or confirmed use-case pills, shows the user's product/pending state, and names one exact recommendation per uncovered role when safe catalog matches exist. Only Shampoo, Leave-in, and Oil may expose several simultaneous roles in V1; one verified product is reused across roles when suitable.
15. A fitting owned product gets a short positive verdict.
16. A mismatch, absent product, or recommendation change folds open into the fuller comparison and decision UI.
17. The user can:
    - keep the owned product;
    - accept the recommended alternative for the shopping list;
    - choose another validated alternative;
    - submit a different product for review.
18. Keeping a mismatch is allowed and stored as an override with advice; it does not block the plan.
19. Opening the shop link does nothing to ownership. The exact recommendation remains on the shopping list.

### Stage 3 — how to use the confirmed portfolio

20. After choices are confirmed, the compiler uses only in-hand products.
21. The user lands on `Heute`: the selected seven-day band is first, followed by the ordered day-type library with frequency on every card.
22. A day-type card opens an exact step list: order, product, active work, waiting time, application detail, and rinse/leave-in behavior where verified.
23. If exact timing is not verified, the UI says “Dauer laut Produkt” and links the source/directions where available; it never invents minutes.
24. The user selects a date, chooses/accepts a day type, and logs it with one tap.

### Returning use

25. `Heute` opens directly; the full confirmed Bedarfsplan remains reopenable without replaying onboarding.
26. `Produkte` contains “Meine Produkte” and “Einkaufsliste.”
27. Marking a recommendation as acquired creates a proposed successor and delta; confirmation updates `user_product_usage` and activates the new immutable version atomically.
28. `Fortschritt` shows tracker-grounded rhythm/history only. It does not claim physical improvement until a later evidence-backed outcome model exists.

### Errors and recovery

- Missing required input: return the exact field and reopen its question; retain completed answers.
- No safe exact catalog match: show “Empfehlung wird geprüft”; do not promote a mismatch/unknown fallback.
- Pending product: continue with other categories and exclude it from executable steps.
- Protocol missing: retain the product and generic safe order, but do not claim exact duration.
- Save/finalize failure: keep local progress and offer retry.
- Acquisition/apply failure: leave both inventory and shopping state unchanged.
- Any change to categories, active products, frequencies, day types, order, application, or safety instructions: create a proposed successor, show the delta, and require confirmation.
- Non-behavioral catalog metadata such as corrected images, links, spelling, or explanatory formatting may update without a plan revision.
- Medical-adjacent red flag: suppress stronger cosmetic escalation and show the professional-care boundary.

### Completion

The plan is complete when all required inputs and category decisions are persisted, the initial version computes without blocking clarification, the user confirms it, and `/heute` renders that exact active version with at least one executable in-hand day type or an honest empty/pending state.

## 7. Mockup evidence

- Promise/product journey v12: removes the duplicate quiz-analysis frame, starts the paid output directly with a routine-card-derived Bedarfsplan, combines all confident recommendations into one basis, keeps genuine optional extras on that same page, separates need categories from exact products, adds budget/exclusions, removes styling from V1, and keeps unowned/pending products out of executable days.
- Page decision 1: the standalone post-purchase analysis recap is removed. Its useful context moves into the reason on each Bedarfsplan category card. Missing required inputs may still be asked before the plan can render.
- Page decision 2: the Bedarfsplan has no separate goal-recommendation tier and no second optional screen. It renders `basis` plus an optional section only when optional categories exist.
- Page decision 3: the Bedarfsplan reuses the live routine page's card shell, frequency meter, green confident-fit treatment, and inset `Vorgeschlagen` treatment. The visual language is continuous across stages, while its subject becomes more specific: category/type fit in Stage 1, actual product fit in Stage 2.
- Calendar/logging alternatives: Option 1 (seven-day band + ordered library + per-date log) explicitly selected.
- Internal key correction: `intensive_care_wash`; user-facing label `Intensiv-Pflegetag`.
- Runbook experiment: rejected timeline visualization was reverted; retain the prior foldable step/table display.
- Pending-product flow: reuse current onboarding/catalog-or-submit and existing review state.

**Still required before user-facing implementation begins:** finish the page-by-page review of journey v12 at 375 px and get Nick's explicit sign-off on the full journey, including budget/exclusion, optional-present/optional-empty Bedarfsplan states, confirmed-product-only day, and tracker-grounded progress states.

**Mockup review status:** confirmed for the three-stage hierarchy and selected logging direction; updated v12 source is ready, visual review pending.

**Designed-user-journey sign-off:** pending.

## 8. Ordered tasks

### Phase A — input and recommendation foundations

#### Task 1 — Persist every required computation input

**Files:** personal-plan quiz types/persistence/draft, profile projection, post-payment onboarding schemas, tests.

- Move `dailyTime` from ephemeral-only state into the versioned canonical submission and prepared artifact.
- Add validated budget and strong-exclusion fields to the proposal input state until/unless they gain a broader profile owner; snapshot them into every confirmed version.
- Confirm existing profile projection covers all runtime inputs; add the smallest post-payment questions for missing wash/heat/routine fields.
- Validate mandatory user thickness before invoking plan computation. Do not add per-category fallback or inference branches for this unreachable state; nullable product thickness suitability remains a separate catalog concern.
- Preserve backwards parsing for already-created V3 artifacts.
- Create the shared `PlanDamageAssessment` type and derive its `materialStructuralVulnerability` fact from non-natural chemical treatment and brittle snapping only. Preserve the exact existing drivers from `getChemicalTreatmentDamageDrivers(...)` in `src/lib/profile/chemical-treatment.ts` (`bleached_hair`, `colored_hair`, `permed_hair`, `chemically_straightened_hair`) and `brittle_snap_pattern` from `proteinMoistureBalance = snaps` in `src/lib/recommendation-engine/assessments/damage.ts`; do not derive it from the combined structural level, repair priority, surface roughness, or breakage/split-end concerns.
- Test old artifacts, new artifacts, resume, and projection.

**Complete when:** one typed server-side input object contains every field required by category and day-type computation; no required value is read only from client state.

#### Task 2 — Implement the confirmed shampoo module test-first

**Files:** `docs/personal-plan/categories/shampoo/decision.md`, `src/lib/personal-plan/categories/shampoo.ts`, `tests/personal-plan/categories/shampoo.test.ts`, `src/lib/personal-plan/types.ts`, and shared frequency helpers only where they are genuinely category-independent.

- Consume the lossless canonical inputs used by the confirmed shampoo specification, including scalp oiliness, specific scalp concerns, current wash frequency, dry-shampoo use, product load, fragility, goals, exclusions, and the user's current shampoo inventory.
- Always include shampoo in the basis and compute one or two explicit roles: `shampoo_everyday` and, only for `oily_dandruff`, `shampoo_dandruff`.
- Port or copy the useful cadence arithmetic into the dedicated module without calling CareBalance or the legacy recommendation runtime.
- Preserve the confirmed low/medium/high cadence bands, nearest-boundary behavior, `does_not_wash` handling, dry-shampoo bridge, and deep-cleansing handoff.
- Return typed clarification needs and stable reason codes instead of composing UI copy inside the engine.
- Enforce the category-cadence invariant: active Shampoo assignment frequencies sum to the resolved total wash cadence, whether one, two, or three products cover it.
- Write the sixteen shampoo regression fixtures in the computation spec before the implementation; keep current Chat and routine behavior unchanged.
- In this task, extend `npm run test:node` to include `tests/personal-plan/categories/*.test.ts`; do not postpone test discovery until later category work. Run the Shampoo file explicitly and through the aggregate command.

**Complete when:** all shampoo fixtures pass, equivalent versioned inputs produce stable output, and the module has no runtime dependency on Chat, CareBalance, or a lossy profile adapter.

#### Task 3 — Close exact-product gaps

**Files:** category decisions/fit, selection, catalog queries, shared product/admin/intake types, one guarded product-thickness migration, tests.

- Make shared `products.suitable_thicknesses` nullable end to end: `null` is unverified, a non-empty array is the verified suitable set, and membership determines pass versus mismatch for the user's thickness. Reject new empty arrays for active recommendable products.
- Audit existing empty arrays before enforcement. Before converting unresolved rows to `null`, snapshot and fingerprint all legacy `product_oil_eligibility` rows including `oil_purpose` and `ingredient_flags`; replace its destructive sync trigger so `null` performs no destructive rewrite and verified list changes preserve curated metadata. Convert unresolved rows to `null`, backfill reviewed products to non-empty arrays, assert legacy row/metadata preservation, and update admin/intake labels and serializers so “Noch nicht geprüft” is distinct from verified thickness choices rather than coerced to `[]`.
- Update every verified nullable-thickness consumer in the same guarded migration/change set: the `match_products` SQL return/filter contract, `src/lib/recommendation-engine/selection.ts` (including every `.length`, `.includes`, and `.filter` site on the legacy production path), `src/lib/product-matching/matcher.ts`, `src/lib/product-matching/product-list-chunks.ts`, `src/lib/validators/index.ts`, `src/app/api/products/route.ts`, shared/generated product types, Product Intake serializers, and `src/app/admin/products/page.tsx`. Null must remain `unknown`, never be coerced to `[]`, never throw in `.includes`, and never become a wildcard. Recommendation-scoped thickness filters exclude unknown products from confident matches; owned-product assessment may retain them only with the explicit `unknown` verdict. Add regression tests at each consumer seam, including the flag-unprotected legacy selector.
- Apply the shared three-outcome thickness contract to Conditioner, Leave-in, Mask, and Oil. Keep Shampoo's stricter role/bucket eligibility where applicable. Add regression coverage that null is unknown, membership passes, exclusion mismatches, and no Personal Plan selector treats null/empty as a wildcard.
- Add first-class heat-protectant target, structured specs, fit evaluator, selector, and recommendation metadata.
- Extend bondbuilder fit to application/protocol compatibility.
- Ensure integrated leave-in heat protection satisfies the heat job without a duplicate recommendation.
- Add one canonical `product_oil_specs` table with nullable constrained supported roles, formula family, weight, the three confirmed functional benefits, tri-state verified Heat protection, and constrained `OilIngredientFlag` values. The name deliberately follows the shared product-level category convention and is not Personal-Plan-specific. Preflight the live schema because repository history previously used this name: preserve/export and migrate any surviving rows before adapting the schema; never drop a populated historical table. Treat legacy Oil subtype, purpose, and ingredient flags as migration hints and research/backfill active products before selection. Personal Plan reads canonical facts only from `product_oil_specs`; retain `product_oil_eligibility` as a compatibility projection for its named existing readers, then explicitly drop its trigger/functions/table when those readers are retired.
- Extend Product Intake Oil validation, approval upserts, and readiness checks to require/write `product_oil_specs` in V1. During coexistence it also maintains the minimum legacy eligibility projection required by current app-side readers. Role-specific protocol review remains separate; a newly approved Oil cannot enter an executable recipe until its required protocol is verified.
- Replace Personal Plan use of the legacy Deep Cleansing intensity/focus shape with the confirmed minimal product spec: nullable verified `supportedResetRoles[]`, `targetScalpTypes[]`, and tri-state `suitableForColorTreatedHair`. Do not use or migrate `reset_intensity` into Personal Plan matching. Backfill the five active orientation products from the confirmed category decision and leave colour compatibility unknown until an exact source verifies it.
- Replace the legacy Dry Shampoo product shape with the confirmed minimal Drogerie-oriented spec: `stylingEffect`, `hairColorFit`, nullable `scalpSensitivityFit`, nullable descriptive `fragranceFree`, constrained four-value `format`, and nullable `noVisibleResidueClaim`. Keep core root refresh implicit to verified category membership; do not add cleansing strength, generic functional benefits, a separate aerosol boolean, or dormant fragrance/aerosol filters. Backfill only reviewed launch products; keep the exact powder candidate unknown until verified and do not add the supplied high-end row in V1.
- Enforce: exact recommendation must be `ideal` or `supportive`; otherwise return pending/no-safe-match.
- Preserve the existing owned product in assessment candidate scope even when it would not be a general recommendation.
- Treat the reviewed `schuppen` catalog bucket as the current treatment-capable cosmetic first line; do not create a second runtime `anti_dandruff_active` authority.
- For every shampoo role, apply category/role eligibility first and then thickness, budget, strong exclusions, irritation/sensitivity, lifecycle, and safe-fit filters.
- For combined dandruff and irritation, rank a sensitive treatment-capable dandruff product; Balea med Anti-Schuppen Ultra Sensitive is the clearest current example when it passes the person's remaining constraints, not a universal hardcoded winner.

**Complete when:** every required V1 role either returns one safe exact SKU or an explicit unresolved state; one SKU may cover several roles, and no mismatch/unknown is labeled as the recommendation.

Global Personal Plan activation has an Oil data gate: the launch fixture matrix must have at least one verified ideal/supportive candidate and complete critical protocol for every supported Oil role and supported thickness/load target. Long-tail owned Oils may remain pending, but a Basis role may not launch without a verified exact alternative. Do not add an Oil-specific flag, category allowlist, or silent Oil omission; Oil ships as part of the complete plan.

#### Task 4 — Add verified application protocols

**Files:** one migration, `src/lib/personal-plan/protocols.ts`, server protocol loader, tests.

- Create role-keyed `product_application_protocols` with strict RLS/write authority consistent with catalog specs; use `(product_id, role_key)` as the stable uniqueness boundary.
- Implement conservative category defaults.
- Add product overrides for stage, phases, rinse mode, replacements, exclusions, source, and verification time.
- Reuse current leave-in and bondbuilder structured fields as imported defaults where sufficient.
- Seed only the verified overrides required by launch recommendations and golden-path fixtures.
- Schedule the cosmetic dandruff response check for 21 days after confirmed use begins. A medicinal protocol may enter the plan only after the user accepts the escalation recommendation, acquires the product, and confirms the proposed successor.
- Seed a medicinal example only after its exact German product identity, package directions, cautions, and evidence source have been reviewed; do not infer a universal medicinal contact time or course.
- Keep protocol authoring UI and full product-intake integration out of V1. Products without an override use safe category defaults and visibly unknown product-specific timing only when their category authority permits it; unresolved critical Oil role/timing facts remain `noch in Prüfung` and out of executable recipes.

**Complete when:** the compiler can distinguish generic defaults, verified exact instructions, unknown timing, cosmetic dandruff care, and a separately confirmed medicinal escalation protocol, including Olaplex-like pre-shampoo and K18-like post-shampoo/exclusive protocols.

### Phase B — versioned plan computation and persistence

#### Task 5 — Add versioned plan state and tracker extension

**Files:** one migration, generated DB types, RLS tests.

- Implement one logical plan with immutable proposed/active/rejected versions; finalize the smallest concrete schema only after the update-confirmation policy is decided.
- Add nullable plan-version and exact-day-type references to `routine_logs` without changing legacy row validity.
- Redefine the hardened `replace_routine_log` RPC with the nullable plan references; preserve all existing guards, revision/idempotency behavior, revokes, and grants.
- Implement and test the canonical personal-plan-key to legacy-tracker-family mapping from §4.
- Gate plan creation and every app/API route on both `hasCurrentAppAccess` and a linked personal-plan prepared artifact; an existing plan satisfies the audience half on returning requests.
- Do not create duplicated mutable product/day-log/check-in authorities.

**Complete when:** authenticated users can read their own state, server-controlled mutations are ownership-scoped, and existing tracker writes remain valid unchanged.

#### Task 6 — Build the category/portfolio computation

**Files:** `types.ts`, `compute.ts`, confirmed category modules, `tests/personal-plan/categories/*.test.ts`, selection, check-in scheduling, `package.json` test wiring.

- Compose plan-owned category modules into `PlanCategoryDecision[]`; do not adapt or call runtime CareBalance as the authority.
- Run the confirmed two-pass functional-coverage ledger: category modules expose their local core fit plus primary/supporting capabilities, then `compute.ts` fills material uncovered plan needs in deterministic priority order without a combinatorial optimizer.
- Arbitrate the non-coily direct-frizz overlap at target level: a Basis Leave-in target with required `smooth_anti_frizz` coverage demotes damp Oil from local Basis candidate to final Optional; otherwise Oil retains Basis. Preserve the explicit coily-plus-frizz two-layer Basis exception. Do not let owned-product availability rewrite Stage-1 category ownership.
- Add table-driven portfolio arbitration fixtures that compare competing category targets job by job. Choose the strongest full fit; use fewer products only as a tie-breaker between equally complete, equally fitting portfolios. Include exact-product failure without Stage-1 re-arbitration.
- Keep multi-role output narrow: only confirmed Shampoo, Leave-in, and Oil rules may create several simultaneous use-case assignments in V1. Do not convert benefits, formats, or speculative future category variants into additional roles.
- Keep Conditioner category-specific allocation simple: at most one new exact recommendation; several suitable owned products may be confirmed as interchangeable for the same category cadence without an invented per-product rotation.
- Implement the confirmed Oil role truth tables, per-role fit, chronological role assignment without primary/secondary ranking, reconciliation lifecycle, structured reasoning, and the confirmed table-driven plus interaction fixtures at `tests/personal-plan/categories/oil.test.ts`.
- Implement the confirmed Deep Cleansing Reset-load score, exact need/cadence bands, single-product fit and allocation, safety pause, structured reasoning, Shampoo substitution, and single-pass application fallback at `tests/personal-plan/categories/deep-cleansing.test.ts`. Keep `reset_intensity` and ingredient-derived strength out of the Personal Plan path.
- Implement the confirmed Dry Shampoo Optional-only inclusion, conditional bridge question, separate product-fit/cadence/pause outputs, one-active-product rule, soft direction/sensitivity/tint fit, late-bound tint resolution, four format protocols, and sequence guard at `tests/personal-plan/categories/dry-shampoo.test.ts`. After two logged Dry Shampoo occurrences since the last wet wash, suggest the wet wash next; do not invent a mandatory weekly occurrence.
- Extend `npm run test:node` so all `tests/personal-plan/categories/*.test.ts` files run alongside the existing root test suite. Run the Oil file explicitly plus the updated `npm run test:node` and `npm run ci:verify` before completion.
- Keep all three Oil role evaluations in category-specific reasoning, but emit only Basis/Optional roles into the shared plan. Use `every_eligible_wash` for Basis Oil occurrences and `deferred_day_type` for accepted optional roles until their day-type placement is confirmed.
- Preserve the confirmed rare triple-Basis Oil case. The selector may reuse a fully fitting multi-role product, but neither product-count minimization nor a category-level occurrence cap may demote an independently justified role.
- Reconcile owned matched, pending, absent, override, shopping, and acquired states.
- Keep exact recommendation stable from saved choices unless invalid/discontinued/excluded.
- Produce compact German explanation data from reason codes; UI copy remains a presentation mapping.
- Schedule and resolve the 21-day shampoo response check without mutating the active version: clear improvement keeps the current role/product, no clear improvement proposes medicinal escalation, and worsening/red flags route to professional care.

**Complete when:** the same versioned input fixture yields byte-stable category and portfolio output, independent of Chat, and the result can be embedded unchanged in an immutable plan version.

#### Task 7 — Compile day-type recipes test-first

**Files:** `day-types.ts`, `protocols.ts`, fixtures/tests.

- Implement base keys and stable recipe signatures.
- Use only in-hand products.
- Build wash, intensive-care, clarifying, refresh, no-wash-care, and rest according to eligibility rules.
- Compile every Basis Oil role into every compatible wash recipe: verified pre-wash Oil before Shampoo, damp Oil after Leave-in when both exist, and dry-finish Oil after drying/Styling. Do not create a separate intensive day merely because pre-wash Oil is Basis.
- Keep optional Oil placement and shared Oil/Leave-in between-wash bridge care out of automatic scheduling until the day-type specification confirms them. Treat that confirmation as mandatory before enabling the complete Personal Plan, not as a post-launch follow-up.
- Treat specialized wash recipes as substitutions inside shampoo cadence.
- Split incompatible treatments into focused variants.
- Separate active time, wait time, and unknown time.

**Complete when:** the day-type subset of the computation fixtures (#2, #3, #4, #6, #7, #8, #13, and #15) passes, total wash cadence never exceeds the shampoo target, and every step is traceable to an active product plus protocol/default source.

#### Task 8 — Build seven-day computation and proposed-version deltas

**Files:** `schedule.ts`, `recompute.ts`, tests.

- Convert frequency targets to deterministic spacing using existing frequency metadata.
- Project guidance for explicitly supplied `startDate` and `timeZone`; never read the clock inside pure scheduling code and do not persist appointments.
- Order library cards by first projected occurrence with canonical tie-breakers.
- Produce a complete proposed successor plus a structured delta against the active version.
- Never mutate or replace the active version during preview.
- Require explicit confirmation for every behavior-changing delta; only non-behavioral metadata may update outside versioning.

**Complete when:** date/time-zone fixtures and computation-spec recompute fixtures (#10, #12, #13, #14) are stable, refresh sits between washes, and historical logs never enter mutation output.

#### Task 9 — Add versioned plan APIs

**Files:** `persistence.ts`, authenticated `/api/personal-plan/**` routes, tests.

- `GET`: return the active version plus any proposed successor and its delta.
- `PATCH choices`: update onboarding/proposal inputs without editing an active version.
- `POST finalize`: require no blocking clarification, confirm the initial immutable version, return `/heute`.
- `POST revision-preview`: compute and persist an idempotent proposed successor without changing the active version.
- `POST revision-confirm` / `POST revision-reject`: atomically activate or reject the proposal; confirmation retires the previous active version without mutating it.
- Use idempotency for initial confirmation and revision decisions.

**Complete when:** API contract tests and remaining end-to-end computation fixtures (#1, #5, #9, #11, #12) prove auth, ownership, stale-revision rejection, retry safety, and no mutation on preview/shop-link open.

### Phase C — reviewed onboarding journey

#### Task 10 — Render and re-review the completed mockup

**Files:** existing promise-product HTML and rendered screenshots.

- Add one compact budget/strong-exclusion input state before exact recommendations.
- Remove the standalone quiz-analysis recap; the reviewed entry state is the Bedarfsplan itself.
- Validate the in-page optional-present and optional-empty Bedarfsplan states plus budget/exclusion states against the implemented input contract.
- Preserve selected Option 1 calendar and reverted foldable runbook.
- Render critical 375 px states and obtain explicit review.
- Walk through the full designed journey and obtain sign-off before Task 11.

**Complete when:** mockup review and designed-user-journey sign-off are recorded as confirmed in this plan.

#### Task 11 — Implement plan-start shell and Stage 1

**Files:** `/plan-start`, plan-start components, feature flag/entitlement guards.

- Reuse/extract the production routine card's presentational shell, palette, badge, tile, and frequency-meter primitives. Do not coerce category-level decisions into the existing product-level `RoutineUiCard` status union.
- Implement contextual missing-input questions where required, then open directly on the unified basis and the conditional in-page optional section.
- Put the relevant profile-to-need explanation inside each category card; do not build a second analysis-summary screen or a standalone three-step explainer.
- Keep all UI text German and explanations concise/foldable.
- Never render exact product recommendations before budget/exclusions are known.

**Complete when:** 375 px screenshot comparison matches the reviewed states and keyboard/screen-reader navigation works.

#### Task 12 — Implement Stage 2 reconciliation

**Files:** product-stage components, product lookup/intake reuse, choice APIs.

- Preserve Stage 1 category order and repeat each target job.
- Use short success cards for clear fits; use expanded comparison only for swap/add/pending cases.
- Reuse catalog selection and pending product flow.
- Add stable shopping-list choice without mutating ownership.
- Allow advised override.

**Complete when:** fixtures exercise fitting, swap, absent, pending, no-safe-match, alternative, and override states without Chat.

#### Task 13 — Finalize and transition to the app

**Files:** finished screen, finalize call, payment-ready CTA/redirect seam, tests.

- Show the confirmed in-hand portfolio and shopping count.
- Persist final choices and land on `/heute`.
- Feature flag off preserves the legacy transition and destination.
- Retry failures without losing local state.

**Complete when:** a paid personal-plan test user completes the full flow, refreshes mid-flow, retries a simulated error, and reaches the same projection.

### Phase D — daily-use app

#### Task 14 — App shell and `Heute`

**Files:** app shell/tab bar, `/heute`, day-type detail/runbook, tracker API extension.

- Implement the selected seven-day band and ordered library.
- Open exact foldable instructions per recipe.
- Log coarse day family plus exact recipe id with one tap.
- Reuse current rhythm/calendar utilities where possible.
- Do not reintroduce the rejected timeline/process diagram.

**Complete when:** log/reload/delete behavior matches the existing tracker's reliability and the exact recipe appears on the selected date.

#### Task 15 — `Produkte` and shopping acquisition

**Files:** `/produkte`, acquisition preview/confirm UI.

- Segment “Meine Produkte” and “Einkaufsliste.”
- Keep exact recommendation after affiliate-link click.
- Mark acquired only through explicit user action.
- Show the proposed-version delta and require confirmation before changing active usage or activating the successor.

**Complete when:** shop click, cancel, preview, failed apply, successful apply, and discontinued recommendation cases are verified.

#### Task 16 — Tracker-grounded `Fortschritt`

**Files:** `/fortschritt`, existing rhythm/history projections.

- Show logged day history, wash rhythm, and current target range.
- Show neutral consistency language only.
- Remove old draft's invented diagnostic 0–10 progress bars and check-in score mutations from V1.

**Complete when:** all displayed metrics derive from persisted tracker logs and current cadence targets, with no causal outcome claim.

### Phase E — rollout and verification

#### Task 17 — Analytics and flag boundaries

- Add server-only `isPersonalPlanAppV1Enabled()` in `src/lib/funnel/flags.ts`; pass any client-visible branch as server-rendered state rather than reading `process.env` in client code.
- Extend the existing typed `trackAppEvent`/`AppEventMap`/`eventRoutes` analytics facade and its destination-level consent/PII filtering; do not create a parallel Personal Plan analytics path.
- Track onboarding start/step, category choice, initial plan confirmed, revision proposed/confirmed/rejected, day logged, shopping link opened, and acquisition confirmed.
- Never send product names, free text, or medical-adjacent answers as analytics properties.
- Prove flag-off and non-personal-plan users retain current behavior.

**Complete when:** event contract tests and a development PostHog inspection show exactly one event per intended action.

#### Task 18 — Full readiness loop

- Run focused unit/integration tests after every deterministic slice.
- Run repository `ci:verify` and relevant tracker/recommendation suites.
- Restart dev server before deep-lib browser verification.
- Run the golden path at 375 px plus pending, no-match, override, save-error, acquire-error, and returning-user paths.
- Compare screenshots to reviewed references.
- Run `ready-check`, then `request-code-review`; resolve verified findings.
- Run one Claude whole-plan review before implementation and one whole-branch review before publication.

**Complete when:** all required checks pass, the reviewed journey is reproducible, and remaining risks are explicitly listed.

## 9. Verification matrix

### Automated

- category-artifact traceability: every implemented category has evidence/decision files, matching `decisionVersion`, resolvable runtime/test links, and mapped fixture IDs;
- pure computation fixture tests from the computation spec;
- all sixteen confirmed shampoo fixtures, including specific scalp-answer precedence, single/dual role output, primary/secondary changes, cadence boundaries, and clarification states;
- shampoo catalog-selection tests for dandruff, dry flakes, irritation, combined dandruff/irritation, exclusions, no-safe-match, and stable accepted alternatives;
- 21-day shampoo check-in tests for improved, unchanged, worse/red-flag, shopping, acquired, and successor-confirmation states;
- existing CareBalance/category/selection regression suites remain green even though the Personal Plan does not call them at runtime;
- JSON schema and old-artifact compatibility;
- RLS/auth/entitlement API tests;
- tracker legacy + exact-recipe logging tests;
- idempotent finalize/acquire-confirm tests;
- feature-flag and redirect tests;
- analytics contract tests;
- privacy-safe aggregate selection telemetry tests for category, role, final tier, verdict, and unresolved reason; launch fixtures assert zero unresolved Basis roles and no event includes user identity, free text, or exact owned-product identity;
- `npm run ci:verify` and the repository's relevant recommendation/tracker suites.

### Manual/browser

- 375 px first-time onboarding, optional present/absent, all product verdicts;
- pending product continues safely;
- no safe catalog match remains unresolved;
- `Heute` band, library, detail fold, one-tap logging, reload;
- shopping link does not mark acquired;
- acquisition preview/cancel/confirm;
- returning user skips explanation;
- German copy, loading, empty, retry, and offline-like failure states;
- flag-off legacy journey.

### Migration/live-state

- unique migration version and generated types;
- RLS with two-user isolation fixtures;
- existing `routine_logs` rows remain valid;
- no backfill required for legacy users;
- product protocol rows are catalog-review controlled;
- no production writes or feature activation during implementation.

### Evidence-sensitive review

- every hard category rule and safety boundary reviewed against the computation spec;
- `schuppen` catalog membership remains evidence-gated during product review; no incidental ingredient match silently changes a product's clinical claim or category;
- the cosmetic-to-medicinal shampoo escalation preserves exact directions, user confirmation, and the professional-care boundary;
- product-specific order/duration requires a verified protocol source;
- medically adjacent copy remains caveated;
- no progress/outcome claim exceeds tracker evidence.

## 10. Rollout, review, and handoff

- Flag: `PERSONAL_PLAN_APP_V1_ENABLED`.
- Category rollout: all confirmed categories, including Oil, ship as one complete product behind that global flag. There are no category-specific enablement switches.
- Observe unresolved Basis roles and `unknown`/`noch in Prüfung` recommendation rates after activation. A complete-plan regression rolls back the global flag; it never silently suppresses Oil.
- Audience: entitled `personal_plan` buyers only.
- Rollback: disable flag; existing onboarding/routine/tracker data remains intact.
- Worktree: this planning worktree is behind current `main` and contains the committed/in-progress planning stream. Before implementation, preserve/commit the approved artifacts and start execution from a freshly synchronized task worktree or safely rebase after the branch gate; do not implement against the stale snapshot.
- Publication is not authorized by this plan. Implementation stops at review-ready handoff.

### Artifact disposition

- `plans/2026-08-02-personal-plan-computation-spec.md`: **commit**.
- `plans/2026-08-02-personal-plan-app-implementation-v2.md`: **commit now as the living category-by-category planning checkpoint; it is not implementation-ready until the open gates are closed**.
- `docs/personal-plan/categories/README.md`: **commit** as the category evidence/decision convention.
- `docs/personal-plan/categories/shampoo/evidence.md` and `decision.md`: **commit** as the confirmed Shampoo evidence and product-policy checkpoint.
- `docs/personal-plan/categories/conditioner/evidence.md` and `decision.md`: **commit** as the confirmed Conditioner evidence and product-policy checkpoint.
- `docs/personal-plan/categories/leave-in/evidence.md` and `decision.md`: **commit** as the confirmed Leave-in evidence and product-policy checkpoint.
- `docs/personal-plan/categories/mask/evidence.md` and `decision.md`: **commit** as the confirmed Mask evidence and product-policy checkpoint.
- `docs/personal-plan/categories/oil/evidence.md` and `decision.md`, plus `docs/oil-recommendation-data-path.md`: **commit** as the confirmed Oil evidence/product policy and temporary legacy-reader migration map.
- `docs/personal-plan/categories/deep-cleansing/evidence.md` and `decision.md`: **commit** as the confirmed Deep Cleansing evidence and product-policy checkpoint.
- `docs/personal-plan/categories/dry-shampoo/evidence.md` and `decision.md`: **commit** as the confirmed Dry Shampoo evidence and product-policy checkpoint.
- reviewed HTML mockups and selected option mockup: **commit**.
- rendered reference screenshots: **commit** if still the visual comparison oracle.
- superseded 2026-07-30 plan: **commit** with superseded notice for provenance, or **discard** before PR if Nick prefers a single plan artifact; decide before implementation handoff.
- transient counterpart review output: **discard** after verified findings are incorporated.

## 11. Open gates

1. Complete the same detailed specification pass for every remaining V1 category; styling remains explicitly deferred. Afterward, lock shared reason salience and the cross-category function-ownership matrix.
2. Visually review the updated v12 states at 375 px: routine-derived Bedarfsplan cards, budget/exclusions, optional-present/optional-empty Bedarfsplan, confirmed-product-only days, and tracker-grounded progress.
3. Confirm the final designed-user-journey walkthrough.
4. Run the required whole-plan counterpart review after the category specifications are complete and incorporate only verified findings.
5. Decide whether to retain the superseded plan in the PR or discard it.
6. Decide the long-term recommendation-engine boundary: whether the legacy engine remains the permanent Chat/Routine authority or the plan-owned category modules become a convergence target.
7. Decide whether catalog-platform work in Task 3 ships as a separately reviewed prerequisite PR or remains inside the app implementation sequence; its legacy readers are not protected by the Personal Plan feature flag.
8. Before persistence/API work begins, choose the smallest confirmed-plan model and close tracker/auth contracts: immutable successor graph versus one active plan plus confirmed diff, prospective versus retrospective seven-day logging, the tracker RPC rollback path, and the Personal Plan-specific auth/intake route.
9. Reconcile the separately owned Hair Tools planning artifacts into or out of V1 only after that parallel work is handed back; this Oil checkpoint deliberately does not modify them.

No user-facing implementation begins before gates 1–4 and the applicable architecture gates 6–8 are confirmed.

## 12. Latest counterpart-review ledger

The 2026-08-05 Opus/high read-only review correctly judged the complete app plan not implementation-ready. That is consistent with this document's checkpoint status.

| Finding | Type | Decision | Plan treatment |
|---|---|---|---|
| Nullable thickness consumers were under-enumerated | defect | accepted | Task 3 now names SQL, matcher, validator, API, types, intake, and admin seams plus consumer-level regression tests. |
| `server-draft.ts` did not exist | defect | accepted | Target map now points to the existing `draft.ts`. |
| Nested category tests were undiscoverable until a later task | defect | accepted | `test:node` wiring moved into the first Shampoo implementation task. |
| Personal Plan analytics risked bypassing the existing typed facade | defect | accepted | Task 17 must extend `trackAppEvent`/`AppEventMap`/`eventRoutes` and destination-level filtering. |
| `PlanDamageAssessment` wording implied an existing runtime type | defect | accepted | Task 1 now explicitly creates the shared type and driver references. |
| `ready-check` was reported missing | defect | rejected | It is an available Codex workflow skill; the reviewer searched only the Claude skill directory. |
| Tracker date/RPC rollback, auth routing, persistence scope, engine convergence, and catalog-workstream separation | tradeoff / scope decision | needs user decision | Preserved as explicit open gates 6–8; no implementation handoff is claimed. |
| Hair Tools artifacts were absent from this plan | scope decision | deferred | They are parallel user-owned work and remain untouched until handback; open gate 9 records reconciliation. |

Transient review output remains outside the repository and is discarded after these verified findings are incorporated.
