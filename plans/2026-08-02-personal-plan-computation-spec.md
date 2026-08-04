# Personal Plan Computation Specification

**Status:** computation grilling in progress; Stage 1 shape and the detailed Shampoo, Conditioner, and Leave-in categories are confirmed, remaining category and cross-category passes are pending
**Scope:** deterministic computation behind the reviewed three-stage personal-plan journey
**Visual direction:** `plans/mockups/2026-07-30-promise-product-journey.html` and selected calendar Option 1 in `plans/mockups/2026-08-01-day-type-calendar-logging-options.html`

## 1. Outcome

After the paid onboarding, the same saved inputs must deterministically produce:

1. the product categories this person needs, may benefit from, or does not need;
2. the exact owned product verdict and one exact recommended product per included category;
3. the products currently active in the person's real plan versus products that remain on the shopping list;
4. a small ordered library of personal day types with recommended frequencies and precise instructions;
5. a seven-day plan band that uses those day types and lets the user log one exact day type for a date.

The computation must be explainable, repeatable, and independent of Chat. Chat may consume the result while it exists, but it is not an authority or a required runtime dependency.

### Product-surface boundary

- The pre-purchase quiz result owns the analysis reveal.
- The post-purchase product does not compute or render a second analysis-summary page.
- After any genuinely missing inputs are collected, Stage 1 directly renders the category decisions from this pipeline as the Bedarfsplan.
- Profile evidence is exposed through each category's concise reason and optional detail, so the explanation travels with the recommendation it supports.

## 2. Chosen architecture

Use one dedicated personal-plan computation pipeline. It may recycle proven rules and pure helpers from the current recommendation engine, but it does not call CareBalance or the legacy runtime as an authority:

```text
saved quiz + completed onboarding + current product inventory
  -> one lossless PlanProfile + PlanPreferenceContext
  -> one personal-plan need assessment
  -> category modules compute need + product type + target frequency + reasons
  -> exact-product fit and catalog selection
  -> confirmed portfolio + stable shopping recommendations
  -> new pure day-type compiler
  -> generated library + seven-day projection
```

### Clean dependency boundary

- New `src/lib/personal-plan/` code is the single authority for the personal plan.
- `src/lib/personal-plan/input.ts` creates the lossless computation input.
- `src/lib/personal-plan/needs.ts` calculates shared damage, care, reset, and cadence signals once.
- `src/lib/personal-plan/categories/*.ts` contains one explicit deterministic rule per category. Each rule returns the category's need tier, required product type, frequency, reason evidence, and missing-input requirements in one pass.
- `src/lib/personal-plan/compute.ts` calls those category rules and assembles one result. There is no rules DSL, plugin system, second planner, or UI-side inference.
- Proven pure helpers or fit rules may be imported when doing so creates no dependency on the chat/runtime orchestration. Otherwise the small relevant rule is copied into the plan domain with parity tests and then owned there.
- The current recommendation runtime and CareBalance remain unchanged compatibility code for existing Routine/Chat consumers until those consumers are intentionally retired or migrated. The personal plan does not read their output, and changes do not have to be kept bidirectionally synchronized.
- Existing catalog records and structured category specs remain the product-data authority.
- `user_product_usage` remains the authority for current and pending products the user says they use or own.
- The existing product-intake and pending-review flow remains the authority for unknown submitted products.
- Existing `routine_logs` and tracker UI remain the calendar/logging authority.

### What “lossless canonical profile” means

The personal-plan quiz uses funnel-specific answer names. “Canonical” means translating those answers once into a stable `PlanProfile` used by every personal-plan category. “Lossless” means that translation must retain every answer that can change a category, target type, frequency, confidence, or explanation:

- do not truncate selected concerns or goals;
- do not silently replace an unanswered field with a neutral answer;
- preserve distinct signals such as breakage versus split ends and scalp type versus scalp condition;
- retain the original quiz answer/evidence identifiers for the user-facing “Warum bei dir?” explanation, even when the plan profile uses a normalized equivalent;
- keep non-hair constraints in a small separate plan context instead of forcing them into `HairProfile`.

The resulting computation input has three deliberately small layers:

1. `PlanProfile`: canonical hair/scalp facts, concerns, goals, exposures, and current routine inventory used by every personal-plan category rule;
2. `PlanPreferenceContext`: routine style, time budget, product budget, strong exclusions, and explicit user choices; these may change practicality or exact-product selection but do not erase a genuine hair need;
3. immutable source evidence: the submitted personal-plan answers and completed-onboarding answers used to explain and version the decision, not as a second recommendation engine.

The current personal-plan offer adapter is not lossless: it keeps at most three concerns and five goals and collapses some distinct personal-plan concepts into legacy labels. The post-payment plan path must not use that lossy projection. It builds `PlanProfile` directly from the full saved answers and completed-onboarding inputs while preserving reason provenance.

### One personal-plan need assessment

The current deterministic engine contains useful prior logic for these reusable intermediate judgments:

- `DamageAssessment`: structural, heat, and mechanical stress; repair priority; balance direction; bondbuilder priority; confidence and missing inputs;
- `CareNeedAssessment`: hydration, smoothing, detangling, definition support, thermal protection, and volume direction;
- `ResetAssessment`: buildup/reset pressure, reset focus, overload risk, and cautions based on current products, frequency, scalp, and explicit reset signals;
- `ShampooCadenceAssessment`: scalp-led target wash-frequency range, modified conservatively for fiber fragility and meaningful routine load.

The personal-plan implementation recycles the useful rules into one `PlanNeedAssessment` computed once in `src/lib/personal-plan/needs.ts`. Category modules consume this assessment plus the complete `PlanProfile`; they do not call CareBalance, the legacy `InterventionPlan`, or Chat request context. The page only renders the saved decisions and never recomputes them.

### Confirmed plan-wide functional coverage

Goals and current problems belong to the whole plan, not independently to one product category. Product categories expose the jobs they can perform; the portfolio computation coordinates those capabilities without making category modules call or recursively optimize one another.

Use one deterministic two-pass coverage ledger:

1. **Category-local pass:** each category computes its own need tier, core target, cadence, candidate fit, and the plan-level functional needs it can resolve or support. No category claims exclusive ownership yet.
2. **Portfolio pass:** start with included categories and their best core-fit assignments, record the functional needs already covered, then inspect remaining needs in priority order. Add or prioritize another eligible category only when it materially covers an unmet need. Stop when all material needs are covered, no valid category can cover the remainder, or only explicitly optional support remains.

The coverage distinction is intentionally small:

- `primary`: the category can genuinely perform the job;
- `supporting`: the category can help but must not be presented as the complete solution when stronger primary coverage is required.

Functional-need priority is derived once from the lossless profile:

- `3`: a current problem and a matching goal;
- `2`: a current problem without the matching goal;
- `1`: a goal without the current problem.

Selection precedence is:

1. safety, exclusions, and hard eligibility;
2. the category's core product fit;
3. functional-benefit coverage within that valid core fit;
4. plan-wide coverage, preferring an already-included sufficient product over an unnecessary extra product;
5. deterministic tie-breakers such as current ownership, explicit user choice, budget, and availability.

This is not a combinatorial product optimizer. Category modules stay independently testable, and `compute.ts` performs one ordered coverage pass over their outputs. The same product may cover several needs, and the plan must not add a second product merely to duplicate an already-satisfied function. Several products are appropriate only when they have distinct plan jobs or the user explicitly confirms a rotation.

The final primary/supporting ownership matrix is completed after Conditioner, Leave-in, Mask, Oil, and later Styling have each been specified. Until then, each category decision records only the functions that category can legitimately resolve or support; it must not invent behavior for an unfinished category.

### New logic to add

- a plan-version builder over the dedicated plan result;
- explicit category rules and missing exact-product support, especially heat protectant;
- a small product application-protocol layer;
- a pure day-type compiler and seven-day projector;
- minimal saved state for stable shopping recommendations and explicit user choices.

### Explicitly do not duplicate

- no `plan_products` copy of active `user_product_usage` rows;
- no separate `plan_day_logs` table;
- no second mutable day-type authority; the exact confirmed day types are retained inside their immutable plan version so the approved plan remains reopenable;
- no dependency on the current Chat recommendation orchestration;
- no dependency on `RecommendationEngineRuntime`, CareBalance, or the legacy `InterventionPlan`;
- no use of the offer-page `locked_plan` as the final plan authority. It is preview/provenance input only; the dedicated personal-plan engine recomputes from completed onboarding data.

## 3. Input contract and present gaps

### Required computation inputs

- canonical hair/scalp diagnostics: texture, thickness, density, length, surface/cuticle, elasticity/balance, chemical treatments, scalp type/condition;
- goals and current concerns;
- required current shampoo/wash frequency, including an explicit `does_not_wash` choice rather than using absence to mean “never”;
- heat tools, heat frequency, drying method;
- routine preference and time budget;
- budget and strong product exclusions;
- current products, their frequency, match status, and catalog/product-spec records;
- a conditional scalp-safety/recent-reaction answer when `scalpConcerns[]` contains `irritated`;
- an observed buildup answer only when the hidden buildup assessment is `likely` or `strong` and no equivalent symptom evidence already exists;
- explicit user choices made during product reconciliation.

### Gaps that must be closed before compilation

- `user_product_usage` currently enforces `UNIQUE (user_id, category)`, and the product-intake lifecycle explicitly assumes one inventory slot per category. Multiple primary/secondary products require a migration that removes that category-slot constraint, preserves the composite row-identity constraint used by submission foreign keys, prevents duplicate links to the same catalog/submission identity, and updates all category-upsert/intake functions to address an exact usage row rather than “the category row.”
- The current personal-plan-to-profile adapter truncates concerns to three and goals to five. The post-payment plan engine must bypass this lossy projection and consume all saved selections.
- The adapter currently collapses `manageability_styling` into a generic frizz goal. Preserve its source meaning for explanations and add only the smallest canonical need dimension required for a decision; do not disguise it as a stronger frizz signal.
- `concernRecurrence` applies to one selected concern. It may strengthen the priority/confidence and explanation of that matching need, but it does not create a product-category need by itself.
- The paid quiz currently shows `dailyTime`, but keeps it in ephemeral client state; it is not part of the canonical submission or profile projection.
- Budget and strong exclusions are planned but not yet canonical inputs.
- The post-payment onboarding must capture shampoo cadence, heat behavior, and any other plan input not already captured by the paid quiz. The irritation and buildup follow-ups below are required only when their deterministic trigger is present; unaffected users never see them.
- Styling products stay outside V1 computation. They remain a named first-class follow-up, not a generic `styling` placeholder in the V1 plan.

If a required input is missing, the compiler returns a typed clarification requirement. It must not invent a value.

## 4. Canonical output contracts

```ts
type PlanNeedTier = "basis" | "optional" | "not_needed"

interface PlanCategoryDecision {
  category: InventoryCategory
  needTier: PlanNeedTier
  roles: PlanProductRole[]
  reasonCodes: string[]
  explanation: string
  confidence: "low" | "medium" | "high"
}

interface PlanProductRole {
  key: string // stable semantic role, e.g. shampoo_everyday
  purposeKey: string // semantic job, e.g. everyday or dandruff_control
  title: string
  needTier: Exclude<PlanNeedTier, "not_needed">
  targetProfile: unknown
  frequencyTarget: PlanFrequencyTarget | null
  frequencyRule: "fixed" | "remaining_category_events" | "product_directed"
  reasonCodes: string[]
  explanation: string
}

type ProductChoiceState =
  | "owned_active"
  | "owned_override"
  | "recommended_active"
  | "shopping"
  | "pending_review"
  | "not_selected"

interface PlanPortfolioEntry {
  category: InventoryCategory
  need: PlanCategoryDecision
  roleAssignments: PlanRoleAssignment[]
  productPlacements: PlanProductPlacement[]
  unassignedUsageIds: string[]
  warningCodes: string[]
}

interface PlanRoleAssignment {
  roleKey: string
  activeUsageIds: string[]
  activeProductFits: Array<{
    usageId: string
    productId: string | null
    fit: CategoryFitStatus | null
  }>
  recommendedProductId: string | null
  choiceState: ProductChoiceState
  rotationPolicy: "single" | "alternate"
}

interface PlanProductPlacement {
  usageId: string
  roleKeys: string[]
  plannedFrequency: PlanFrequencyTarget | null
  position: "primary" | "secondary"
}

type PlanDayTypeKey =
  | "wash"
  | "intensive_care_wash"
  | "clarifying_wash"
  | "refresh"
  | "care_without_wash"
  | "rest"

interface CompiledDayType {
  id: string // stable: base key + deterministic recipe signature
  key: PlanDayTypeKey
  title: string
  focusLabel: string | null
  frequency: ProductFrequency
  steps: CompiledDayStep[]
  estimatedMinutes: number | null
  reasonCodes: string[]
}

interface SevenDayProjection {
  startDate: string
  days: Array<{
    date: string
    suggestedDayTypeId: string
    reasonCodes: string[]
  }>
}
```

`estimatedMinutes` is `null` when any blocking/wait duration is unknown. The UI then says “Dauer laut Produkt” instead of showing fabricated precision.

### Multiple products within one category

- An included category contains one or more semantic product roles. Roles are not new catalog categories; they describe distinct jobs such as `everyday` or `dandruff_control`.
- `primary` and `secondary` are product placements, not permanent role names. After role assignment and frequency allocation, the product used most frequently in the currently proposed plan becomes the category's `primary` product; remaining active products are `secondary`.
- The same product may cover multiple roles; aggregate its planned use before deriving its placement.
- Primary/secondary placement may change when the confirmed usage plan changes. That change appears in the proposed-plan delta and never silently rewrites the active plan.
- Equal-frequency tie-breaker: retain the active plan's current primary. For a new plan with different semantic roles, the broader everyday/default role wins the tie; for equal products rotating within the same role, retain the product the user selected first. Any later change still requires proposed-plan confirmation.
- The engine evaluates every owned product in the category against every role and builds a deterministic fit matrix.
- The same verified product may satisfy multiple roles. The UI and plan must not force a second purchase when one product demonstrably fulfils both jobs.
- A role may contain multiple active owned products when the user intentionally rotates equally suitable products. Rotation is an explicit assignment, not inferred merely because two products exist.
- Products that are not assigned to a role remain visible in Stage 2 as unassigned. They are never silently inserted into day instructions.
- The default result recommends the cleanest valid assignment; the user may keep or reassign a product through the existing non-blocking override behavior.
- A pending product cannot satisfy a role until reviewed. It remains visible as `pending_review`, while the role is shown as unresolved or covered by another verified product.
- Conditioner is the V1 category-specific exception to fixed per-product allocation: recommend at most one new exact Conditioner, but allow several separately evaluated suitable owned Conditioners to remain active as interchangeable choices for the same post-wash role. Conditioner cadence remains category-level and no primary/secondary frequency split is invented.

### Total category cadence and product allocation

- Category computation owns the total required cadence. Product assignments partition that total; they do not create additional category events.
- For three planned wash events, valid Shampoo allocations include one product `3`, two products `2 + 1`, or three products `1 + 1 + 1`.
- The sum of active product assignments must cover the computed total exactly unless a documented recipe intentionally uses more than one product in the same event.
- Conditioner keeps the same category-total invariant but not a forced product split: there is one Conditioner occurrence after each eligible wash, and any one confirmed suitable active Conditioner may fill that occurrence.
- Current inventory frequency and recommended plan-assignment frequency remain separate facts.
- Any change to total cadence or its product allocation creates a proposed successor and requires confirmation before changing the active plan.

## 5. Category computation

Each personal-plan category module directly returns `needTier`, target product type, target frequency, reason evidence, confidence, and missing inputs. Product presence must not determine whether a category is inherently needed.

| Category | V1 category rule | Existing reuse | Required gap work |
|---|---|---|---|
| Shampoo | `basis` for every user. The category explains the required shampoo type and frequency; deep cleansing remains a separate category. | Shampoo cadence, scalp route/bucket, thickness-aware selection, target profile, fit, reranking. | Make the basis decision independent of whether shampoo is currently present; expose complete type/frequency reasons. |
| Conditioner | `basis` for `short`, `medium`, `long`, and `very_long` hair. For `very_short` hair it is never automatic basis: return `optional` only when a material length-care need exists, otherwise `not_needed`. | Conditioner target profile and fit are strong; cadence mirrors wash cadence. | Copy the useful target/fit logic into the clean plan category boundary and implement the confirmed length-led inclusion. |
| Leave-in | Follow the exact corroboration matrix in `docs/personal-plan/categories/leave-in/decision.md`: direct detangling, named care-signal combinations, coily texture, material chemical treatment, and recurring heat plus a real care signal can create `basis`; weaker single signals remain `optional`; heat alone does not create Leave-in need. | Mature target/fit metadata, including application stage and Conditioner relationship. | Implement the confirmed plan-owned thresholds, role-relative fit, and portfolio-level heat coverage without forcing a combined product when a suitable separate Heat protectant already covers the event. |
| Mask | `basis` for material intensive care/damage need; `optional` for lighter support; otherwise `not_needed`. | Target weight, repair, balance, need strength, role, target cadence. | Define plan-owned absent-category thresholds rather than copying the current overuse-only behavior. |
| Heat protectant | `basis` with meaningful direct/cumulative heat; no automatic need for airflow-only drying. | Existing heat-classification logic and leave-in metadata can inform the new rule. | Add a first-class plan category target, fit evaluator, catalog selector, and product metadata. |
| Bondbuilder | `basis` only at high structural-repair priority; `optional` at consider-level if product fit/protocol is known. | Damage priority, target intensity/application mode, protocol fields. | Fit must include application/protocol compatibility, not intensity alone. |
| Deep-cleansing shampoo | `basis` for likely/strong reset need; `optional` for possible reset need; otherwise `not_needed`. | Reset assessment, vulnerability-aware cadence, target/fit/reranking. | Emit absent-category need; stop using a generic fixed “every 5-6 washes” instruction. |
| Dry shampoo | Never a health/care requirement. `optional` only as an explicit between-wash bridge that suits the scalp context. | Conservative bridge logic, fit/reranking, cadence ceiling. | Separate convenience from care need in user-facing explanation. |
| Peeling | `optional` only with a specific scalp-reset case and no irritation contraindication; otherwise `not_needed`. | Reset and irritation caution, target/fit/reranking. | Application mode/timing metadata; medical-adjacent copy boundary. |
| Oil | `optional` and purpose-specific (finish or pre-wash), never a generic hydration requirement. | Purpose-specific target/selector and current usage cautions. | Define plan-owned, purpose-gated inclusion and cadence. |

### Shampoo behavior — confirmed detailed category specification

The confirmed category decision is `docs/personal-plan/categories/shampoo/decision.md`; its external evidence and catalog audit remain separate in the linked `evidence.md`. This section retains the shared contracts, detailed behavior, and regression fixtures that connect Shampoo to the wider Personal Plan compiler.

#### Category decision and precedence

- Shampoo is always `basis`, whether or not the user currently owns one.
- The category answers four deterministic questions: what the everyday shampoo must do, whether a separate dandruff-control role is required, how many total wet-wash events are suitable, and which exact owned or recommended products fill those roles.
- Inputs are the lossless `scalpOiliness`, complete multi-select `scalpConcerns[]`, current shampoo frequency, current shampoo inventory, thickness, strong exclusions, budget, and fiber-compatibility signals. The collapsed legacy `scalp_condition` is never authoritative.
- Precedence is: professional-care/red-flag boundary; specific `scalpConcerns[]`; known exclusions and recent-reaction answer; scalp oiliness; current frequency; thickness-aware exact-product eligibility; then fiber gentleness/compatibility and explanatory goals.
- Generic concerns and goals may strengthen priority or explanation, but never override a more specific scalp answer, create a dandruff role, or change the numerical cadence by themselves.
- Deep-cleansing shampoo remains a distinct category. It never replaces the shampoo basis decision.

#### Stable shampoo output

```ts
type ShampooRoleKey = "shampoo_everyday" | "shampoo_dandruff"
type ShampooFollowUpAnswer = "clearly_improved" | "unchanged" | "worse"

interface ShampooCategoryDetail {
  needTier: "basis"
  roles: Array<{
    key: ShampooRoleKey
    targetProfile: {
      scalpRoute: "oily" | "balanced" | "dry" | "dandruff" | "irritated"
      shampooBucket: "dehydriert-fettig" | "normal" | "trocken" | "schuppen" | "irritationen"
      cleansingIntensity: "gentle" | "regular"
      requiresSensitiveProfile: boolean
    }
    frequencyRule: "remaining_category_events" | "product_directed"
    reasonCodes: string[]
  }>
  baseFrequencyRange: PlanFrequencyTarget
  resolvedFrequency: ProductFrequency
  techniqueConstraintCodes: string[]
  checkIn: null | {
    kind: "dandruff_response"
    dueAfterDays: 21
    answer: ShampooFollowUpAnswer | null
  }
  escalationState: "none" | "medicinal_product_proposed" | "professional_care"
}
```

The runtime may use the existing product-frequency vocabulary and fit types. It must not create a second mutable shampoo data model merely to mirror existing catalog specs.

#### Concern-to-role mapping

| Specific input | Stage 1 requirement | Stage 2 exact-product constraint | Stage 3 and follow-up |
|---|---|---|---|
| No scalp concern | One `shampoo_everyday` role based on scalp oiliness and hair compatibility. | Select from the matching oily/balanced/dry route plus thickness and exclusions. | Use at the resolved total wet-wash cadence. |
| `oily_dandruff` | Add `shampoo_dandruff`; retain `shampoo_everyday` only for remaining washes or when one product cannot fill both jobs. | The dandruff candidate must come from the evidence-gated `schuppen` bucket. | Use according to the selected product directions within the confirmed wash plan; schedule the 21-day response check. |
| `dry_dandruff` (`Trockene Schuppen`) | Keep one gentle, dry-scalp-compatible `shampoo_everyday` role; do not infer oily dandruff or a medical diagnosis. | Prefer the verified `trocken` route and preserve exclusions. | No fabricated treatment phase; reassess if persistent or worsening. |
| `irritated` without dandruff | Keep one gentle `shampoo_everyday` role with irritation-compatible constraints. | Select from existing `irritationen` products; no anti-dandruff active is required merely because irritation exists. | Stop/swap a suspected trigger, use gently if tolerated, and show the safety boundary. |
| `oily_dandruff + irritated` | Retain `shampoo_dandruff` and require a sensitive anti-dandruff profile; keep an everyday role only when needed for remaining washes. | Candidate must satisfy `schuppen` plus verified sensitive-suitability/exclusion checks. Balea med Anti-Schuppen Ultra Sensitive is the current clearest catalog example, not an unconditional hard-coded winner. | Schedule the 21-day response check; do not intensify because irritation exists. |
| `dry_dandruff + irritated` | One stricter gentle everyday role can cover both. | Require dry-scalp and irritation compatibility. | No dandruff-treatment escalation unless a targeted dandruff concern is independently present. |
| `oily_dandruff + dry_dandruff` | Targeted dandruff role plus a gentle everyday role when the selected dandruff product cannot safely fill both. | Evaluate one-product coverage first, otherwise recommend one exact product per role. | Allocate both within the total wet-wash budget. |
| All three | Preserve the targeted role, dry-scalp constraint, and irritation safety constraint. | Require a treatment-capable anti-dandruff product for the targeted role and the strictest compatible everyday assignment. | Check at 21 days; worsening bypasses cosmetic escalation. |

An explicitly empty `scalpConcerns[]` is valid. Missing `scalpOiliness`, missing `scalpConcerns`, or missing current wash frequency after paid onboarding returns a typed clarification requirement rather than a guessed route.

#### Catalog invariant and exact-product selection

- `product_shampoo_specs.shampoo_bucket = 'schuppen'` is an evidence-gated catalog invariant: before approval, the product must have both a verified anti-dandruff claim and a verified effective anti-dandruff active in the current German/EU formula. The current active recommended cohort was audited and all eight products contain Piroctone Olamine.
- Runtime selection may therefore trust `schuppen` as treatment-capable catalog eligibility. Do not add a second `anti_dandruff_active` boolean as another runtime source of truth.
- Ingredient/claim source and formula verification date stay with catalog research/review provenance. A reformulation triggers product re-review; it does not complicate the per-user plan payload.
- Existing irritated products that happen to contain Piroctone Olamine remain in `irritationen` unless they were separately approved for a dandruff claim. Ingredient presence alone does not silently broaden their role.
- Candidate selection filters to active Chaarlie recommendations, the required bucket/route, thickness eligibility, budget, strong exclusions, recent-reaction constraints, and safe fit. It ranks only `ideal` or `supportive` candidates inside an already treatment-capable role; a merely soothing product cannot satisfy `shampoo_dandruff`.
- If no safe exact candidate survives, return `not_selected` with “Empfehlung wird geprüft.” Never fall back to an unsuitable shampoo or to Chat.
- A pending product stays visible but cannot satisfy a role until review is complete.

#### Current products, multiple shampoos, and placement

- Evaluate every owned shampoo against every required shampoo role.
- One verified product may fill both roles. Do not force a second purchase when it demonstrably fulfils both jobs.
- Two owned shampoos do not automatically imply a rotation. Activate both only when each has an assigned role or the user explicitly confirms an equal-fit rotation.
- Total shampoo events come from the resolved shampoo cadence. A product-directed dandruff protocol consumes events first; the everyday role receives the remaining events.
- When two equal-fit products intentionally share one role, alternate them across eligible events rather than giving each the full category frequency.
- After allocation, the product with the highest planned frequency is `primary`; other active products are `secondary`. A dandruff shampoo may therefore be primary during the initial response period and later become secondary.
- A primary/secondary change is included in a proposed-plan delta and requires confirmation. It never silently rewrites the active plan.
- A mismatching owned product may remain `owned_override`; advice is non-blocking. The exact better product remains on the shopping list until explicitly removed or acquired.

#### Total wet-wash cadence

- `low`: preferred `weekly_1x`, allowed range `biweekly_1x` to `weekly_1x`.
- `medium`: preferred `weekly_2x`, allowed range `weekly_1x` to `weekly_3_4x`.
- `high`: preferred `weekly_3_4x`, allowed range `weekly_2x` to `weekly_5_6x`.
- Scalp oiliness sets the base band: oily = `high`, balanced = `medium`, dry = `low`.
- `dry_dandruff` and `irritated` change product gentleness and technique, not the numerical base band.
- `oily_dandruff` adds the targeted role and follow-up; it does not hard-code total cadence to `high`.
- If current frequency is inside the suitable range, retain it. If outside, recommend the nearest boundary rather than forcing the preferred midpoint.
- Goals never change cadence. Product ownership or category count alone never changes cadence.
- Stacked fragility changes product/technique constraints and may favor the lower edge only in a genuine tie with no scalp/treatment conflict.
- `does_not_wash` is a valid explicit source answer. It maps to `less_than_monthly` only for comparison; the recommended target still comes from scalp needs.
- A selected exact product's verified directions override category defaults. When the directions require a temporary cadence change, show the delta and obtain confirmation instead of silently altering the plan.

#### Cleansing pressure and clarification handoff

- Dry shampoo is a bridge, not a wet wash. After one use another bridge may remain possible if comfortable; after two, the next executable event is a wet wash. At three or more uses, or with itching/burning/tenderness/buildup, do not schedule another dry-shampoo bridge.
- If a recurring pattern would exceed two bridges between wet washes, propose only the extra wet wash needed to satisfy that ceiling, with user confirmation. Do not permanently move the scalp-led band.
- Product load creates `cleansing_adequacy_check` only from meaningful exposure, placement, frequency, and an observed residue outcome. Owning multiple products or using length-only products is insufficient.
- Ordinary oil/dirt/dry-shampoo accumulation makes a normal wash due. Persistent coated, waxy, dull, limp, tacky, or visible residue despite normal cleansing may replace one normal wash with `clarifying_wash`.
- Clarifying is always a substitution inside the wash budget. Irritated, dry, heavily treated, or fragile profiles require stronger residue evidence and a gentler compatible product.
- A suspected product reaction produces stop/swap guidance, never stronger or more frequent cleansing.
- The hidden buildup likelihood and its thresholds belong to the later deep-cleansing category spec; shampoo emits only the conditional handoff.

#### Dandruff response check and medicinal escalation

- Confirming a cosmetic `shampoo_dandruff` product schedules one `dandruff_response` check 21 days after that plan version becomes active. The initial product remains active at the resolved wash cadence and follows its label/verified directions.
- The check asks whether symptoms are `clearly_improved`, `unchanged`, or `worse`.
- `clearly_improved`: keep the current product and plan. If the exact product has a verified maintenance direction that changes frequency, present it as a proposed successor for confirmation.
- `unchanged`: keep the current active plan while proposing a stronger medicinal anti-dandruff product, such as a reviewed ketoconazole 2% shampoo, with a clear pharmacy/medical caveat. The exact item may enter the shopping list only after the user accepts the recommendation; it is not treated as acquired or active.
- `worse`, or any red-flag answer at any point: set `professional_care`; do not automatically recommend or activate a stronger product.
- Acquiring a medicinal product triggers a proposed plan successor containing its verified product-specific frequency, duration, contact time, rinse instructions, and maintenance. Only user confirmation replaces the prior shampoo assignment.
- Opening a purchase link never counts as purchase, acquisition, plan confirmation, or symptom improvement.
- User-facing escalation copy stays advisory: “Deine Schuppen sind nach drei Wochen nicht deutlich besser geworden. Deshalb empfehlen wir dir jetzt ein stärkeres medizinisches Anti-Schuppen-Shampoo. Lass dich zur Anwendung bitte in der Apotheke oder ärztlich beraten.”

#### Stage outputs

- Stage 1 fold-up: `Was dein Shampoo können sollte`, resolved target type, `Wie oft`, and `Warum bei dir?`. It describes roles and needs, not a product verdict.
- Stage 2 repeats that target job, compares every owned/pending shampoo, names one exact safe recommendation per unresolved role, and captures keep/switch/alternative decisions.
- Stage 3 uses only confirmed in-hand products. Shopping and pending products never appear in executable day instructions.
- Reason codes must remain concise and traceable, including at minimum scalp oiliness, each selected specific scalp concern, retained/changed cadence, treatment/fragility gentleness, dry-shampoo pressure, and any unresolved or professional-care state.

#### Shampoo regression fixtures

1. Balanced scalp, no concerns, current `weekly_2x`, one fitting shampoo: one everyday role, retained cadence, owned product active.
2. Oily scalp, no concerns, current `weekly_1x`: one everyday role, nearest suitable boundary proposed rather than preferred midpoint.
3. Targeted dandruff, fitting owned `schuppen` product: dandruff role assigned, 21-day check scheduled, no unnecessary purchase.
4. Targeted dandruff plus irritation, no fitting owned product: select a sensitive treatment-capable catalog product; Balea med Anti-Schuppen Ultra Sensitive is the reference candidate when eligible.
5. Irritation without dandruff: choose from `irritationen`; no dandruff role, treatment check, or medicinal escalation.
6. Dry flakes without targeted dandruff: gentle dry-scalp everyday role; no `schuppen` requirement.
7. One product valid for everyday plus dandruff: one usage row fills both roles.
8. Separate everyday and dandruff products: allocate within total cadence and derive primary from planned use.
9. Two equal-fit everyday shampoos with no explicit rotation: choose the deterministic best assignment and leave the other unassigned.
10. Pending shampoo: visible pending state, role unresolved or covered by another verified product.
11. All candidates excluded or unsafe: no exact recommendation; return reviewed-unresolved copy.
12. Three-week result `unchanged`: medicinal item proposed, old product remains active, shopping/acquisition requires confirmation.
13. Result `worse` or red flags: professional-care state, no automatic stronger-product recommendation.
14. Purchase link opened: no product or plan mutation.
15. Missing scalp or cadence input: typed clarification; explicit `does_not_wash` remains valid.
16. Same versioned inputs and catalog snapshot: byte-stable shampoo result.

### Confirmed conditioner inclusion

- `short` (chin/jaw length), `medium`, `long`, and `very_long`: always `basis`.
- `very_short`: never automatic basis; `optional` only with a material care signal, otherwise `not_needed`.
- The exact conditioner weight/direction still adapts to thickness, density, texture, surface, elasticity/balance, chemical treatment, damage, concerns, goals, and volume direction.
- Conditioner remains the post-shampoo baseline in V1. Mask, Bondbuilder, Oil, or another treatment does not replace it by default. The confirmed Leave-in exception may suppress it only for fine and very-short hair when a material Leave-in job exists and the exact product is verified as replacement-capable.

### Confirmed Leave-in inclusion

- The exact authority is `docs/personal-plan/categories/leave-in/decision.md`; this overview must not broaden its explicit truth table.
- `basis`: explicit tangling; dry/dull lengths corroborated by rough surface, moisture goal, tangling, or care-led frizz; lightened, permed, or chemically straightened hair; coily texture; or recurring heat (`daily`, `several_weekly`, `once_weekly`) plus a qualifying Leave-in care signal.
- `optional`: a single weaker care signal such as dry/dull lengths, rough surface, moisture goal, ambiguous frizz, or curly texture; colored hair alone; definition/lost shape without a care need; shine alone; manageability goal without tangling; or repair/strength concern without stronger treatment or a care-led basis trigger.
- `not_needed`: no relevant job; wavy texture alone; or heat exposure without a legitimate Leave-in care signal. Heat-only need belongs to Heat protectant.
- Aggregate by explicit precedence: any named basis rule wins, otherwise any named optional rule wins, otherwise `not_needed`. Do not promote arbitrary pairs of optional signals.
- Leave-in is always supporting for repair. Its `basis` status for materially chemically treated hair reflects ongoing leave-on care/protection, not primary repair ownership or a permanent-repair claim.
- A combined care/heat Leave-in and a suitable care Leave-in plus separate Heat protectant are both valid portfolios. Prefer product minimization when it fits, but never force consolidation of an already-suitable two-product setup.

### Need-tier mapping

- `basis`: Hair Concierge confidently recommends this category for this person. It may answer essential maintenance, a current condition, or a stated goal; those reasons do not create separate visual tiers.
- `optional`: may provide extra support or convenience, but the need/evidence is not strong enough to place it confidently in the plan.
- `not_needed`: excluded from the ideal plan; an already-owned product can still be shown with advice to pause or use only on demand.

The personal-plan category result exposes this directly; the UI must not infer it from product ownership or an `add` action.
There is deliberately no separate `recommended` need tier: every confident recommendation belongs to `basis`.

## 6. Exact-product reconciliation and shopping state

For each included category and each of its product roles:

1. Build the role target profile.
2. Evaluate every matched owned product against the role.
3. Select one exact `ideal` or `supportive` catalog recommendation. Never present `mismatch` or `unknown` as a confident exact recommendation.
4. Produce the cleanest valid role assignment, including one verified product covering multiple roles or an explicitly confirmed rotation where applicable.
5. Show the need-versus-product comparison.
6. Save the user's choice:
   - a fitting owned product remains active;
   - accepting a recommended product before purchase keeps the current product active and puts the exact recommendation on the shopping list;
   - keeping a mismatching owned product creates `owned_override` with non-blocking advice;
   - a submitted unknown product remains `pending_review` and cannot be judged yet;
   - no safe catalog match produces “Empfehlung wird geprüft,” not a fallback disguised as certainty.

The exact recommended product stays on the shopping list until the user explicitly removes it or marks it as acquired. Opening an affiliate link is not purchase confirmation.

When the user marks it acquired, show a preview of the affected product entry and day-type recipes. Only after confirmation is `user_product_usage` changed and the recommendation marked fulfilled.

### Confirmed versioning model

The initial computation creates a proposed plan. Confirmation makes that exact result an immutable active version. A later relevant change computes a proposed successor and a delta; the previous version remains active until the user confirms the successor.

Persistence therefore needs:

- one logical plan header per user with an active-version reference;
- immutable version records containing the computation/input version, explicit user decisions, resolved product/category portfolio, compiled day types, instructions, and seven-day starting projection needed to reopen what was confirmed;
- proposed/active/rejected/superseded lifecycle state and a link from each proposal to the version it would replace;
- current product truth to stay in `user_product_usage`, while each immutable plan version records the product facts/identifiers used in that prescription.

The exact table/JSON split remains an implementation decision. It must support exact historical rendering without recomputing an old version through newer code or catalog data.

## 7. Product application protocol

### Evidence boundary

- Safe category defaults can define relative order and application area.
- Exact amount, wait time, rinse/leave-in behavior, replacement behavior, and product-specific incompatibilities follow verified product directions.
- Product directions override category defaults. Olaplex No.3 and K18 are a concrete reason: both are marketed as repair treatments, but one is used before shampoo/conditioner while the other is used after shampoo, before conditioner, and left in for a defined time.
- When a verified exact protocol is absent, do not invent minutes. The plan may use a conservative generic instruction and visibly say that exact timing follows the label.

### Minimal protocol model

Use category defaults in code plus one cross-category product override table:

```ts
type ApplicationStage =
  | "pre_wash"
  | "cleanse"
  | "post_cleanse_rinse_out"
  | "post_wash_damp"
  | "pre_heat"
  | "dry_finish"
  | "scalp_refresh"

interface ProductApplicationProtocol {
  productId: string
  stage: ApplicationStage
  phases: Array<{
    verb: string
    activeSeconds: number | null
    waitSeconds: number | null
    detail: string
  }>
  rinseMode: "rinse" | "leave_in" | "not_applicable"
  replacesCategories: InventoryCategory[]
  excludesSameDayCategories: InventoryCategory[]
  sourceUrl: string
  verifiedAt: string
}
```

This is intentionally smaller than a universal routine DSL. Category defaults provide the normal sequence; product overrides only encode what must differ.

### Conservative category defaults

- shampoo: wet hair; apply to scalp; massage; rinse;
- conditioner: after shampoo; lengths/ends; rinse after a short product-directed dwell;
- rinse-out mask: after shampoo in the verified product-directed order; it does not replace Conditioner by default in V1;
- leave-in: after wash on the stage supported by its structured metadata; do not rinse;
- heat protectant: before the heat event, covering exposed hair;
- deep-cleansing shampoo: replaces normal shampoo in that wash, followed by appropriate length conditioning;
- dry shampoo: scalp/root bridge, product-directed wait, brush/comb out; never replaces washing with shampoo and water;
- oil: use only for the selected purpose; dry finish and pre-wash oiling are different protocols;
- bondbuilder and peeling: no generic exact timeline without verified protocol metadata.

Medical boundary: persistent/severe flaking, marked irritation, pain, sores, or hair loss does not produce a more aggressive cosmetic day type; it produces a professional-care caveat.

## 8. Deterministic day-type compiler

The compiler consumes only products confirmed in the user's hands (`owned_active`, `owned_override`, or acquired `recommended_active`). Shopping and pending-review products never appear as executable instructions.

### Recipe construction

1. Create the normal `wash` template from active shampoo plus applicable conditioner/leave-in/heat-protection/finish products.
2. Replace a normal wash occurrence with `clarifying_wash` when an active deep-cleansing product has a non-zero target cadence.
3. Create one or more `intensive_care_wash` recipes for active mask, bondbuilder, or deliberately selected pre-wash oil protocols.
4. Pack intensive treatments into one recipe only when verified protocol metadata says their stages and exclusions are compatible.
5. If two intensive treatments are incompatible, generate two variants with the same base key and different stable recipe ids/focus labels, for example `intensive_care_wash:bondbuilder` and `intensive_care_wash:mask`.
6. Create `refresh` only when an active product has a valid dry-hair/root-refresh protocol and the user has a real between-wash use case.
7. Create `care_without_wash` only when an active product genuinely has a stand-alone no-wash treatment protocol. Do not use it for pre-wash products that end in a wash.
8. Always expose `rest` as a loggable state, but not as a product routine.

### Frequency allocation

- The shampoo target is the total wash-event budget.
- Active Shampoo assignments must sum to that exact total. A single product may cover all events, or several explicitly assigned products may divide them.
- `clarifying_wash` and `intensive_care_wash` are normally substitutions inside that wash budget, not extra washes.
- No compiled wash subtype may make total planned washes exceed the shampoo target.
- A specialized recipe's cadence is capped by both its anchor product target and total wash cadence.
- When multiple compatible anchor products share a recipe, use the highest required occurrence rate and mark less-frequent steps as scheduled variants only if a distinct recipe is not clearer.
- For V1, prefer a distinct recipe over conditional “every second time” steps; exact recipes are easier to understand and log.
- `refresh` is allocated only between wash events and must not displace a due wash.
- The seven-day projection is derived from frequency midpoints and deterministic spacing; it is guidance, not a hard calendar booking.

### Stable ordering

Order the library by the first projected occurrence from today; ties use:

1. `wash`
2. `intensive_care_wash`
3. `clarifying_wash`
4. `refresh`
5. `care_without_wash`
6. `rest`

Within a recipe, sort by protocol stage, then explicit product protocol order, then category fallback order. Never sort steps alphabetically.

### Time budget behavior

- Time budget does not suppress a safety-critical or basis step.
- When a plan exceeds the saved time preference, keep the essential recipe and move optional additions into a separate optional recipe or mark them optional.
- Blocking wait time and active application time are separate. The UI can show overlap only when the protocol explicitly permits it.
- No duration is displayed as exact unless it comes from a verified product protocol or a supported category default.

## 9. Logging and recomputation

Keep `routine_logs` as the logging authority. Extend it with nullable plan-version and exact-day-type references while retaining the existing coarse `day_type` for legacy tracker behavior and wash-rhythm calculations.

V1 plan logging stores:

- date;
- coarse day family for existing rhythm math;
- active plan version at the time of logging;
- exact generated recipe id.

It does not require step completion or per-product logging.

### Recompute triggers

Compute a proposed successor when any of these changes:

- relevant profile/onboarding input;
- product added, removed, matched, or review resolved;
- product frequency changed;
- category choice changed;
- shopping recommendation marked acquired and confirmed.

The API computes a complete proposed version plus a structured delta:

```ts
interface PlanRecomputeDelta {
  categoryChanges: Array<{ category: InventoryCategory; before: string; after: string }>
  addedDayTypes: string[]
  removedDayTypes: string[]
  changedDayTypes: string[]
}
```

Every change to categories, active products, frequencies, day types, step order, application, or safety instructions creates a proposed successor and requires explicit confirmation. Non-behavioral metadata such as corrected images, links, spelling, or explanatory formatting may update automatically because it does not change what the user should do.

Historical logs are immutable snapshots of what the user logged and retain the version context active at the time. A proposed successor changes neither past logs nor the active plan; confirmation activates the new version.

## 10. Research findings translated into rules

External evidence and current internal behavior are kept distinct:

- Durable category research and confirmed product decisions live in paired files under `docs/personal-plan/categories/<category>/evidence.md` and `decision.md`.
- During planning, a confirmed decision file is the category implementation specification. After implementation, `src/lib/personal-plan/**`, tests, catalog/spec data, and verified product protocols are runtime authority.
- Existing AgentV2 guidance packages may later consume a curated operational projection. Raw evidence notes are never loaded as executable recommendation policy.

- Dermatology guidance supports shampooing the scalp rather than scrubbing the full hair length and applying conditioner after washing; this supports safe category defaults, not a universal exact amount or dwell time.
- Cosmetic-science review literature describes rinse-out conditioners as post-shampoo products with short dwell, but exact timing remains formulation/product dependent.
- Official Olaplex and K18 directions materially differ, so treatment order and minutes must be product-specific data rather than inferred from the category name.
- Dry shampoo is a temporary bridge and does not remove the material that shampoo and water remove; it must not count as a wash replacement.
- Clarifying frequency depends on formula, buildup, hair/scalp context, and product directions. Recycle the current reset/vulnerability rule into the personal-plan need assessment rather than using the generic “every 5-6 washes” copy.
- Limited laboratory evidence supports coconut oil for reducing protein loss/porosity in some pre-/post-wash contexts. It does not justify treating every hair oil or every user as needing pre-oiling.
- Heat damage depends on exposure conditions. The product should give conservative behavior guidance, but exact heat-protectant claims and temperature ceilings require verified product data.

Sources:

- American Academy of Dermatology, “Tips for healthy hair”: https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips
- American Academy of Dermatology, “How to treat dandruff”: https://www.aad.org/public/everyday-care/hair-scalp-care/scalp/treat-dandruff
- American Academy of Dermatology, dry shampoo guidance: https://www.aad.org/public/everyday-care/hair-scalp-care/hair/dry-shampoo-best-results
- Gavazzoni Dias et al., hair-care physicochemistry review: https://pmc.ncbi.nlm.nih.gov/articles/PMC9921463/
- Olaplex official FAQ: https://olaplex.com/pages/frequently-asked-questions
- K18 official product directions: https://www.k18hair.com/en-ca/products/leave-in-molecular-repair-hair-mask-50-ml
- Rele and Mohile, coconut/mineral/sunflower oil hair-damage study: https://pubmed.ncbi.nlm.nih.gov/12715094/
- Lee et al., hair-shaft damage from heat and drying: https://pmc.ncbi.nlm.nih.gov/articles/PMC3229938/
- Personal Plan Shampoo evidence: `docs/personal-plan/categories/shampoo/evidence.md`
- Personal Plan Conditioner evidence: `docs/personal-plan/categories/conditioner/evidence.md`
- Personal Plan Leave-in evidence: `docs/personal-plan/categories/leave-in/evidence.md`

## 11. Test matrix

The implementation plan must include pure fixture tests for at least:

1. no current products: dynamic ideal categories plus shopping recommendations; no executable product recipes;
2. simple owned shampoo + conditioner: one wash recipe, no invented optional categories;
3. Leave-in inclusion boundaries: dry/dull lengths alone `optional`; dry/dull plus rough surface `basis`; coily alone `basis`; curly alone `optional`; wavy alone `not_needed`;
4. recurring heat plus a qualifying Leave-in care signal: Leave-in `basis`; integrated verified heat protection covers the heat role without a duplicate requirement;
5. suitable care Leave-in plus suitable separate Heat protectant: both roles covered and no consolidation switch; meaningful heat without verified protection produces a required Heat-protectant role and exact recommendation or pending state;
6. clarifying need: clarifying subtype replaces a normal wash and does not increase total wash cadence;
7. vulnerable hair/scalp: conservative clarifying cadence;
8. incompatible bondbuilder and mask protocols: two intensive-care recipe variants;
9. pending submitted product: visible in product stage, excluded from executable steps;
10. mismatching product kept by override: warning retained, product remains executable;
11. shopping link opened: no portfolio mutation;
12. acquired recommendation confirmed: inventory changes and affected recipe delta preview applies;
13. time-budget pressure: basis steps remain; optional work moves out;
14. versioning: a relevant change creates a proposed successor, the active version and historical logs stay unchanged before confirmation, and confirmation activates the successor;
15. medical-adjacent scalp flags: cosmetic escalation is suppressed and caveat emitted.

## 12. Bedarfsplan hierarchy decision

The Bedarfsplan has only two visible levels on one page:

- `basis`: every confident recommendation, including categories that directly support a stated goal;
- `optional`: genuinely additional support, shown as clearly marked cards in a small section below the basis.

There is no separate “Für dein Ziel empfohlen” tier and no separate optional screen. If computation returns no optional categories, the optional section is omitted entirely. The Stage 2 treatment of optional cards—automatic reconciliation versus explicit opt-in—remains the next page-level decision.

### Routine-card visual semantics

Reuse the current routine page's card shell instead of introducing a second category-card design:

- a green Stage 1 card means the category and target product type confidently fit this person's needs;
- an inset grey/plum card with `Vorgeschlagen` means a genuinely optional category;
- the headline is the target product type, followed by the concise profile-linked reason and target frequency;
- opening the card reveals the full reasoning;
- Stage 2 preserves the same shell but changes the subject of the verdict from category/type fit to the fit of a specific owned or recommended product.

The shared presentation must not collapse the two computation concepts into one type: `PlanCategoryDecision` remains category-level, while `PlanPortfolioEntry.activeProductFit` remains product-level.
