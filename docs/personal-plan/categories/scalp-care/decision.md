---
category: scalp_care
document_type: decision
status: confirmed
decision_version: 1
last_reviewed_at: 2026-08-06
evidence_file: docs/personal-plan/categories/scalp-care/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/scalp-care.ts
test_surface: tests/personal-plan/categories/scalp-care.test.ts
---

# Personal Plan Scalp Care decision

## Authority and status

This document records the confirmed deterministic product policy for cosmetic Scalp Care in the Personal Plan. It follows `docs/personal-plan/categories/category-design-framework.md` and separates external evidence from product decisions.

The category policy is complete. Remaining work is implementation, shared Personal Plan integration, catalog verification, protocol normalization, and migration. Those gaps block launch but are not open category-policy questions.

After implementation, the plan-owned Scalp Care module, its tests, shared role assignments, and verified catalog/application-protocol data become runtime authority.

## Category charter

Scalp Care accounts for cosmetic products applied primarily to the scalp or roots for one of four jobs:

```ts
type ScalpCareRole =
  | 'scalp_comfort'
  | 'scalp_flake_oil_adjunct'
  | 'density_claim_tonic'
  | 'scalp_exfoliant'
```

Canonical category and label:

- category key: `scalp_care`;
- German label: `Kopfhautpflege`;
- all four roles belong to one category;
- `serum`, `tonic`, `lotion_or_fluid`, `oil`, and `scrub` are presentation formats, not categories or recommendation triggers;
- a market term such as `Peeling` maps to the `scalp_exfoliant` role, not a separate canonical product category;
- medicines remain outside cosmetic Scalp Care.

The category is not:

- a diagnosis or treatment plan;
- a replacement for appropriate Shampoo in dandruff-like or oily-scalp care;
- a replacement for Deep Cleansing Shampoo's general product/residue reset;
- a reason to infer active thinning from stable low density;
- a universal essential step;
- permission to infer efficacy, rinse behavior, or cadence from the word `Serum`.

## Stage responsibilities

| Stage | Scalp Care responsibility |
|---|---|
| Stage 1 — Bedarf | Decide whether contextual optional Scalp Care is relevant, which role or roles are present, whether clarification or safety suppression applies, and the qualitative product-directed cadence. No role is `basis`. |
| Stage 2 — Produkte | Keep every owned product visible, assess one selected product per relevant role, suppress duplicate purchases for jobs already covered elsewhere, and recommend an exact verified cosmetic only for an uncovered job. |
| Stage 3 — Anwendung | Compile exact product instructions into wash-day or non-wash-day steps without inventing cadence, contact time, amount, rinse behavior, interactions, or extra wash events. |

## Canonical inputs and derived facts

### User inputs

| Input | Values used | Decision it may change |
|---|---|---|
| `scalpOiliness` | `oily`, `balanced`, `dry`, missing | `scalp_flake_oil_adjunct`, `scalp_comfort`, or no oiliness-derived role |
| `scalpConcerns[]` | `oily_dandruff`, `dry_dandruff`, `irritated` | flake/oil role, comfort support, or conditional clarification |
| `scalpIrritationState` | `mild_sensitive_or_itchy`, `burning_painful_or_inflamed`, missing | comfort permission, cosmetic safety suppression, or `clarification_required` |
| `currentConcerns[]` | `hair_loss_or_thinning` | `density_claim_tonic` |
| Reported product use | category/product identity, application target, reported frequency | shared `scalpBuildupAssessment` |
| Owned-product inventory | exact rows and review/lifecycle state | Stage-2 visibility and role-relative reconciliation only |
| Main-product selection per role | selected owned product ID, or missing when several same-role products exist | Stage-2 analysed product or `primary_product_selection_required` |
| Known product reaction or exact contraindication | present/absent/unknown | product mismatch and execution pause |
| Shared product preferences | budget/availability only when actually collected | candidate tie-breaking after suitability |

Product ownership never creates or removes the underlying Stage-1 need. An owned product remains visible in Stage 2 even when Stage 1 returns `not_needed`.

### Conditional irritation clarification

When `scalpConcerns` contains `irritated`, onboarding asks immediately after the scalp-concern screen:

> **Wie fühlt sich die Reizung aktuell an?**

- `mild_sensitive_or_itchy` → `Leicht empfindlich oder gelegentlich juckend`
- `burning_painful_or_inflamed` → `Brennend, schmerzhaft oder deutlich entzündet`

Stable contract:

- screen ID: `scalp_irritation_detail`;
- durable answer field: `scalpIrritationState`;
- answer required only when `irritated` is selected;
- either answer continues through the existing post-scalp onboarding route;
- deselecting `irritated` clears the stored detail;
- a stored detail without `irritated` is invalid and is cleared during draft editing or rejected at final validation;
- legacy/incomplete `irritated` input without the detail returns typed `clarification_required` and permits no exact cosmetic recommendation;
- draft/resume and final submission preserve the answer because it changes safety and recommendation behavior.

### Shared scalp-buildup assessment

Scalp Care consumes one shared structured assessment and does not maintain a second Reset score:

```ts
type ScalpBuildupAssessment = {
  state: 'present' | 'absent' | 'unknown'
  sourceFacts: Array<{
    usageId: string
    category: string
    applicationTarget: 'scalp_or_roots' | 'lengths_only' | 'unknown'
    contributionType:
      | 'dry_shampoo'
      | 'residue_prone_leave_on'
      | 'cleanser_or_rinse_off'
      | 'unknown'
    reportedFrequency: ProductFrequency | 'as_needed' | null
  }>
}
```

Deterministic derivation:

| Rule ID | Condition | Output |
|---|---|---|
| `scalp_care.buildup.root_regular` | At least one reported product is applied to scalp/roots, is verified as Dry Shampoo or a residue-prone leave-on, and is used `weekly_1x`, `weekly_2x`, `weekly_3_4x`, `weekly_5_6x`, or `daily_1x` | `state = present`; retain every qualifying product/frequency reason fact. |
| `scalp_care.buildup.dry_shampoo_target` | A verified Dry Shampoo is used at least weekly | Treat its application target as scalp/roots and contribution type as `dry_shampoo`. |
| `scalp_care.buildup.cleanser_exclusion` | Shampoo, Deep Cleansing Shampoo, rinse-off exfoliant, or another cleanser/rinse-off product is applied to the scalp | It does not contribute product-load buildup merely because it touches the scalp. |
| `scalp_care.buildup.length_only` | Reported products are verified as lengths-only | They do not create scalp buildup. |
| `scalp_care.buildup.as_needed_unknown_rate` | A scalp/root product is reported only as `as_needed` and no qualifying regular exposure exists | Do not infer repeated buildup from that frequency alone. |
| `scalp_care.buildup.missing_facts` | A possibly relevant product lacks verified target or reported frequency and no qualifying exposure exists | `state = unknown`; do not trigger exfoliation. |
| `scalp_care.buildup.oiliness_not_load` | Oily scalp exists without qualifying product exposure | Oiliness does not change this assessment to `present`. |

Low Shampoo frequency and `low_volume_or_weighed_down` may remain corroborating shared Reset facts but do not independently create scalp buildup. Ordinary Shampoo, Deep Cleansing Shampoo, rinse-off Scalp Care, and other cleansing steps are explicitly excluded from the qualifying load set. The assessment must expose source facts rather than only a scalar so the category can distinguish residue-prone scalp/root exposure from cleanser contact and length-only load.

### Inputs deliberately not used for inclusion

- stable `density = low`;
- `goals[]` containing `scalp_balance` without a current issue;
- `concernRecurrence`;
- `previousAttempts`;
- uninterpreted `currentConcernsOtherText`;
- hair texture, thickness, length, surface, elasticity, chemical treatment, routine style, or daily-time answers.

These facts do not safely establish Scalp Care need, prior appropriate treatment, response, diagnosis, or product efficacy.

## Stage 1 — inclusion, roles, and cadence

### Need tier and precedence

Scalp Care is optional-only in V1.

| Rule ID | Inputs/condition | Output | Precedence/confidence |
|---|---|---|---|
| `scalp_care.inclusion.never_basis` | Any cosmetic Scalp Care profile | Never return `basis`. | Hard V1 ceiling; evidence and captured response history do not support a universal essential step. |
| `scalp_care.safety.pause_all` | `scalpIrritationState = burning_painful_or_inflamed`, or a known active burning/pain/open/weeping/swollen/pustular/reaction state | Return internal safety pause; suppress all proactive cosmetic roles and exact recommendations. | Highest precedence. Owned products remain visible in reconciliation with do-not-use/pause guidance. |
| `scalp_care.clarification.irritation` | `irritated` selected and `scalpIrritationState` missing | Return `clarification_required('scalp_irritation_detail')`. | Before role computation. Do not guess. |
| `scalp_care.role.comfort` | `scalpOiliness = dry`, or `scalpIrritationState = mild_sensitive_or_itchy` | Add `scalp_comfort`. | Optional; does not diagnose a barrier condition. |
| `scalp_care.role.flake_oil_adjunct` | `scalpOiliness = oily`, `oily_dandruff`, or `dry_dandruff` | Add `scalp_flake_oil_adjunct`. | Optional supporting role; Shampoo remains primary for dandruff-like flakes and ordinary oil control. |
| `scalp_care.role.dry_flake_comfort` | `dry_dandruff` | Also add supporting `scalp_comfort`. | One category result; not two automatic purchases. |
| `scalp_care.role.density_claim` | `currentConcerns` contains `hair_loss_or_thinning` | Add `density_claim_tonic`. | Optional, cosmetic, uncertainty-aware; stable low density alone does not trigger it. |
| `scalp_care.role.exfoliant` | `scalpBuildupAssessment.state = present` and no safety pause | Add `scalp_exfoliant`. | Optional; oiliness and lengths-only load do not trigger it. |
| `scalp_care.inclusion.optional_union` | One or more roles remain after precedence | Return one `optional` category with a stable deduplicated role set. | Roles are ordered comfort, flake/oil, density, exfoliant for deterministic serialization. |
| `scalp_care.inclusion.none` | No role remains | Return `not_needed`; omit the proactive Stage-1 card. | An owned product is still retained for Stage 2. |

Missing `scalpOiliness`, an `unknown` buildup assessment, and absent optional signals add no role. They do not default to `balanced` or `present`.

### Functional needs and plan-wide ownership

| Function | Trigger priority | Scalp Care coverage | Adjacent owner and boundary |
|---|---:|---|---|
| scalp comfort | `2` for a current dry/mild-itch signal | supporting | Appropriate gentle/targeted Shampoo owns the primary route where it adequately covers the job. |
| flake/oil support | `2` for current oiliness or flakes | supporting | Targeted Shampoo is primary for dandruff-like flakes and ordinary oil management. |
| cosmetic density support | `2` for `hair_loss_or_thinning` | primary within the current cosmetic portfolio | This ownership describes the available product job, not proven treatment efficacy. |
| scalp/root residue reset | `2` for qualifying current product exposure | primary only for the uncovered scalp/root-specific job | Deep Cleansing owns the general hair/product Reset. One source signal must not create two duplicate purchases. |

No goal-only input creates a priority-1 Scalp Care role in V1. Final card reason salience and cross-category presentation remain shared mechanics.

### Stage-1 frequency target

Stage 1 expresses role pattern, not a fabricated exact schedule:

| Role | Stage-1 wording | Meaning |
|---|---|---|
| `scalp_comfort` | `Optional · Bei Bedarf – nach Produktangabe` | Products range from as-needed/overnight to daily. |
| `scalp_flake_oil_adjunct` | `Optional · Regelmäßig nach Produktangabe` | Daily/regular label use is common where stated. |
| `density_claim_tonic` | `Optional · Regelmäßig nach Produktangabe` | Daily or near-daily use is common; this does not prove efficacy. |
| `scalp_exfoliant` | `Optional · Gelegentlich nach Produktangabe` | Exact timed pre-wash directions and repeat cadence are product-specific. |

For multiple roles, the category carries a role-keyed frequency target. The collapsed card may summarize `Nach Produktangabe`; its detail view preserves each role's wording. Stage 1 never converts `optional` into “use whenever you feel like it.”

## Stage 2 — product facts, fit, and selection

### Canonical Scalp Care product facts

```ts
type ScalpCarePresentationFormat =
  | 'serum'
  | 'tonic'
  | 'lotion_or_fluid'
  | 'oil'
  | 'scrub'
  | 'other'
  | 'unknown'

type ScalpCareRinseMode = 'leave_on' | 'rinse_off'

interface ProductScalpCareSpec {
  productId: string
  primaryRole: ScalpCareRole | null
  presentationFormat: ScalpCarePresentationFormat
  rinseMode: ScalpCareRinseMode | null
  applicationInstructions: string | null
}
```

Field semantics:

- `primaryRole` is the only deterministic coverage role in V1;
- product names and ingredients never infer role;
- `presentationFormat` records form only; `other` means reviewed outside-vocabulary form, while `unknown` means not yet verified;
- rinse mode is structured and never inferred from format;
- `applicationInstructions` is the single sourced Product Intake field containing every exact direction stated by the manufacturer/package;
- before execution, the planned shared role-keyed `product_application_protocols` authority must normalize the relevant stated cadence, stage, hair/scalp state, placement, contact time, rinse action, replacements, and exclusions; this authority does not exist in the current runtime yet;
- protocol normalization is shared scheduling infrastructure, not additional Scalp-Care-specific intake fields;
- missing critical non-cadence instructions fail closed rather than being borrowed from another product; repeat cadence alone uses the explicit Hair Concierge `as_needed` fallback defined in Stage 3.

Do not add V1 fields for secondary role, ingredient/exfoliation method, regulatory status, evidence state, protocol status, or separate amount/contact/wash-timing columns. Medicines are rejected at the category boundary. A future verified physical or hybrid exfoliant may justify an explicit subtype only when it changes deterministic behavior.

### Layered fit model

Fit is assessed relative to one required role.

1. **Eligibility and safety:** verified identity, cosmetic category, lifecycle, no known reaction/contraindication, and no active safety pause.
2. **Core role fit:** exact verified `primaryRole` match.
3. **Protocol readiness:** known/reviewed format, rinse mode, and complete safety-critical exact directions. Missing repeat cadence alone is executable through the explicit `as_needed` fallback.
4. **Verdict and limitation:** explicit non-critical limitations and the density role's category-level evidence limitation remain visible.

| Verdict | Deterministic meaning |
|---|---|
| `ideal` / `passt sehr gut` | Verified cosmetic Scalp Care identity; exact primary-role match; no known safety conflict; reviewed format; complete critical protocol; no relevant limitation. |
| `supportive` / `passt mit Einschränkung` | Exact role and safety/protocol gates pass, but one explicit product- or user-specific non-critical suitability limitation remains. Limited role-level efficacy evidence alone does not change this fit verdict. |
| `mismatch` / `wechseln empfohlen` | Wrong category, wrong verified primary role, known reaction, verified contraindication, or medicine misclassified as cosmetic Scalp Care. |
| `unknown` / `noch in Prüfung` | Pending identity/lifecycle or missing/conflicting primary role, format, rinse mode, or critical non-cadence protocol fact. Missing repeat cadence alone does not create `unknown`. Unknown never becomes an optimistic pass. |

Presentation format has no fit preference order. A tonic is not better or worse than a serum because of format alone. Ingredient presence does not raise role confidence or evidence confidence.

Product fit and efficacy confidence are separate axes. A verified cosmetic density product may therefore be `ideal` / `passt sehr gut` for the requested role while the adjacent `limited_evidence` statement explains that the expected effect is uncertain and can vary individually. The evidence statement is never hidden, but it does not convert a suitable product into a fit limitation.

### Uncovered-job gate

| Rule ID | Condition | Result |
|---|---|---|
| `scalp_care.coverage.no_duplicate_purchase` | Selected Shampoo or Deep Cleansing allocation adequately covers the triggered comfort, flake/oil, or general Reset job | Keep the optional reason and any compatible owned product, but create no new Scalp Care purchase for that job. |
| `scalp_care.coverage.density_unique` | Density role is triggered and no safety pause applies | Treat the cosmetic density-support job as uncovered in the current portfolio and seek one eligible exact product. |
| `scalp_care.coverage.scalp_reset_only` | Qualifying scalp/root exposure remains materially uncovered after Deep Cleansing allocation | Permit one exfoliant candidate. |
| `scalp_care.coverage.dry_flake_no_double_purchase` | `scalp_comfort` was added only as support for `dry_dandruff` and the flake/oil role already has an assigned or recommended product | Do not create a second comfort purchase. Keep comfort as an explanatory/supporting fact. A separately triggered dry-scalp or mild-itch comfort job may still be evaluated independently. |
| `scalp_care.coverage.no_safe_candidate` | Every candidate is mismatch, unknown, unsafe, or unavailable | Keep the job visibly unresolved; never fill the slot with a weak or unknown candidate. |

### Exact selection and tie-breaking

For each uncovered role:

1. if exactly one product is owned for the role, assign and assess it as the main product;
2. if several products are owned for the same role and no main product has been selected, return a shared conditional `primary_product_selection_required` state; save/show every product and assess none automatically;
3. after the user chooses the role's main product, assess only that product;
4. a safe `ideal` or `supportive` owned product counts as adequate and suppresses a replacement purchase for the same role;
5. do not replace an adequate owned product for a marginal upgrade, stronger marketing claim, presentation format, or small price difference;
6. for a new recommendation, prefer `ideal` over `supportive`;
7. when no ideal candidate exists, a supportive candidate may be offered with its limitation because the category is optional; it is never forced;
8. compare exact role, product-specific safety/contraindications, protocol completeness and practicality, then current Drogerie availability and an actually collected budget preference;
9. verified finished-product evidence may break a remaining density-role tie; otherwise do not invent efficacy differences;
10. curated catalog priority and then stable product ID resolve a final tie.

Opening a shopping link does not mark acquisition. Availability and budget never rescue a mismatch or unknown product.

### Multiple products and role assignment

- Owned inventory supports several `scalp_care` rows.
- At most one product is analysed and actively assigned per relevant role.
- Additional same-role products remain saved, visible, and unassigned; V1 does not rank, rotate, or schedule them.
- When several same-role products exist, the shared product flow requires the user to select that role's main product before analysis. There is no first-entered fallback and no automatic best-fit comparison across all owned siblings.
- The user may later select a different owned product for analysis; changing the assignment creates a proposed successor plan.
- Different uncovered roles may each receive one analysed product.
- One product has one verified primary role in V1 and therefore does not silently cover another role from package copy.
- A second Scalp Care product requires a second material uncovered job, not merely a second quiz signal.
- If a submitted replacement is pending, the previously confirmed active product remains active until a reviewed successor is confirmed.

The shared owned-inventory cardinality change is a launch prerequisite. It is not implemented by this category document.

## Product reconciliation and plan lifecycle

| Reconciliation state | Condition | Saved/proposed behavior |
|---|---|---|
| `keep_and_use` | Selected owned product is `ideal` or adequate `supportive` and its protocol is executable | Keep active; no same-role shopping recommendation. |
| `keep_pending_protocol` | Product appears role-compatible but identity, rinse behavior, contact/rinse requirements, or another critical non-cadence protocol fact remains unresolved and no safety conflict is known | Keep visible as owned/pending; do not schedule and do not recommend a duplicate solely because review is incomplete. Missing repeat cadence alone uses the confirmed `as_needed` fallback and does not create this state. |
| `do_not_use` | Mismatch, known reaction, active safety conflict, contraindication, or medicine/cosmetic misclassification | Keep the inventory/context record but create no cosmetic execution. Show the material reason and appropriate boundary. |
| `replace_recommended` | The job remains uncovered because the selected owned product is materially mismatched, unsafe, or remains non-executable after reasonable review | Add one verified replacement proposal for that role. Existing active plan remains unchanged until confirmation. |
| `new_recommendation` | Triggered material job is uncovered and no owned product adequately covers it | Add one eligible exact product proposal for that role. |

Shared lifecycle rules apply:

- pending products never become confident recommendations or executable steps;
- acquisition is explicit and previews assignment/recipe changes;
- a material change creates a proposed successor;
- the active plan remains unchanged until confirmation;
- removing or declining a recommendation is explicit;
- affiliate-link opening is not purchase evidence.

## Stage 3 — application and day compilation

### Cadence invariant

Scalp Care owns one role-specific occurrence budget per active role, derived from the exact verified protocol. Product assignment distributes that role's occurrences and never increases them implicitly. Reported current use and recommended plan use remain separate facts.

If the exact protocol states `as needed`, Stage 3 creates an optional trigger rather than a fabricated weekly count. If an otherwise executable product in any of the four roles omits only its repeat cadence, Hair Concierge also creates an optional `as_needed` trigger. That cadence is labeled as a category fallback (`cadenceSource = 'category_fallback'`), never as a manufacturer instruction. Missing rinse behavior, necessary contact time for a timed rinse-off product, placement, or another safety-critical application fact still blocks execution.

### Compilation rules

| Rule ID | Condition | Compiled behavior |
|---|---|---|
| `scalp_care.protocol.exact_authority` | Verified role-keyed product protocol exists | Use its exact cadence, stage, scalp state, placement, contact time, rinse action, and stated amount guidance. |
| `scalp_care.protocol.missing_cadence_fallback` | Exact application steps are safe and complete but repeat cadence is not stated | Compile `as_needed` for any Scalp Care role and record `cadenceSource = 'category_fallback'`; do not attribute it to the product label. |
| `scalp_care.protocol.no_other_fabrication` | A critical non-cadence instruction is missing | Show a protocol-data gap; do not infer it from format, role, a sibling product, or market convention. |
| `scalp_care.protocol.leave_on` | `rinseMode = leave_on` | Attach to the exact wash-day or non-wash-day application window stated by the protocol. Daily/near-daily products may populate the existing `care_without_wash`/daily-care recipe on non-wash days; they do not create wet washes. |
| `scalp_care.protocol.rinse_off` | `rinseMode = rinse_off` | Place on an existing wash day at the exact pre-/post-Shampoo stage; rinse as stated. |
| `scalp_care.protocol.exfoliant_pre_shampoo` | Active `scalp_exfoliant` protocol specifies the reviewed Drogerie pattern | Apply to scalp, respect exact contact time, rinse/wash with Shampoo, then resume already-planned after-wash care. It does not replace Shampoo or add a wash event. |
| `scalp_care.protocol.no_reset_stack` | Exfoliant and Deep Cleansing or another intensive scalp-active step would occupy the same wash | Do not co-schedule by default. Use separate eligible events or leave a visible interaction gap unless exact compatibility is verified. |
| `scalp_care.protocol.no_unverified_leave_on_stack` | Two leave-ons require the same application window and compatibility/order is not verified | Do not silently layer them. Separate windows when both exact protocols permit; otherwise keep the second assignment unresolved. |
| `scalp_care.protocol.safety_precedes` | Active safety pause or product reaction exists | Suppress execution regardless of fit or label cadence. |

The only category-wide protocol fallback is repeat cadence `as_needed` when every other critical direction is complete. There is no category-wide amount, massage duration, drop count, section count, contact time, course length, rinse behavior, placement, or application-state fallback. Exact directions own these details. General presentation may say “direkt auf die Kopfhaut” only when that placement is verified for the exact product.

## Safety, medicine, and overclaim boundaries

### Cosmetic stop and pause signals

Cosmetic Scalp Care optimization and execution are suppressed for:

- burning or pain;
- pronounced active redness/rash or swelling;
- open, weeping, crusted, or pustular areas;
- a known product reaction;
- another exact-product contraindication.

Persistent or recurrent scaly/itchy/red symptoms remain Shampoo-led and may need assessment. The quiz must not diagnose dandruff cause, eczema, psoriasis, dermatitis, infection, or a damaged barrier.

### Hair-loss boundary

`hair_loss_or_thinning` is sufficient to create the optional density role. V1 does not add another hair-loss onboarding question. Copy must not characterize the case as gradual, diffuse, cosmetic-only, or diagnosed.

Sudden, patchy, unexplained, painful, burning-associated, or inflamed hair loss requires the shared assessment boundary. The cosmetic role may not delay that route.

Confirmed adjacent limitation copy:

> **Kann bei dünner werdendem Haar unterstützen. Die Studienlage ist noch begrenzt, der Nutzen kann individuell variieren.**

The limitation remains adjacent to an exact density recommendation. Forbidden claims include “stoppt Haarausfall,” “lässt Haare nachwachsen,” “wirkt garantiert,” unsupported “klinisch bewiesen,” or any diagnosis.

### Medicine boundary

Medicinal scalp topicals, including regulated minoxidil products, do not enter `ProductScalpCareSpec`, candidate ranking, or cosmetic protocols. They remain visible only through the separate medication/health-context route until a separately approved medical integration exists.

### Other forbidden rules

- no ingredient-as-proof inference;
- no automatic acid recommendation for oily scalp;
- no rule that acid is universally gentler than physical exfoliation;
- no DIY salt, sugar, or acid scalp treatment;
- no universal exfoliation cadence;
- no automatic benefit from high alcohol content;
- no claim that Serum is essential because Shampoo contact time is insufficient.

## Structured reasoning payload

The category module preserves deterministic facts; presentation may verbalize but not change them.

```ts
type ScalpCareReasonFact = {
  id:
    | 'scalp_care.reason.dry_scalp'
    | 'scalp_care.reason.mild_sensitive_or_itchy'
    | 'scalp_care.reason.oily_scalp'
    | 'scalp_care.reason.oily_dandruff'
    | 'scalp_care.reason.dry_dandruff'
    | 'scalp_care.reason.hair_loss_or_thinning'
    | 'scalp_care.reason.scalp_root_product_load'
    | 'scalp_care.reason.covered_by_shampoo'
    | 'scalp_care.reason.covered_by_deep_cleansing'
    | 'scalp_care.reason.uncovered_density_job'
    | 'scalp_care.reason.limited_density_evidence'
    | 'scalp_care.reason.owned_product_retained'
    | 'scalp_care.reason.protocol_incomplete'
    | 'scalp_care.reason.primary_product_selection_required'
    | 'scalp_care.reason.category_cadence_fallback'
    | 'scalp_care.reason.no_valid_candidate'
    | 'scalp_care.reason.irritation_clarification_required'
    | 'scalp_care.reason.cosmetic_safety_pause'
  evidence: Array<{ source: 'quiz' | 'setup' | 'inventory' | 'assessment' | 'catalog'; key: string }>
  values: Record<string, string | number | boolean>
}
```

The payload also preserves:

- tier and ordered role set;
- qualitative role cadence and exact-product cadence source;
- buildup source facts, not only a boolean;
- role coverage status and adjacent owner;
- selected owned product ID and selection source (`single_owned` or `user_selected`);
- per-product verdict, matched facts, limitations, missing facts, and safety state;
- reconciliation action and proposed-plan delta;
- protocol readiness and interaction gaps.

The shared presentation pass chooses at most two primary card facts later. It may not hide the adjacent density-evidence limitation.

## Current behavior classification

| Current behavior | Classification | Personal Plan action |
|---|---|---|
| Exact owned-product identity, lifecycle, pending state, and shared plan proposal/confirmation mechanics | `reuse` | Use the shared mechanics without a Scalp-specific state machine. |
| Deep Cleansing product-usage/Reset reason facts | `adapt` | Expose source-level scalp/root target and frequency facts; do not copy the scalar Reset score. |
| Legacy persistence mapping `serum -> peeling` and `scrub -> peeling` | `reject` | Treat legacy values as compatibility inputs requiring role reconciliation; canonical identity is `scalp_care`. |
| Legacy `derivePeelingType` choosing acid for dry/irritated scalp and physical Scrub for oily scalp | `reject` | Unsupported and potentially unsafe; format/method is not inferred from scalp type. |
| Legacy Peeling fit by `scalp_type_focus` plus `acid_serum | physical_scrub` | `reject` | Replace with exact primary-role fit, safety, and protocol readiness. |
| Legacy CareBalance universal monthly/biweekly Peeling target band | `reject` | Exact product directions own cadence; no family-wide interval. |
| Legacy irritation caution when a Peeling is present | `adapt` | Replace with the durable allow-versus-pause clarification and hard safety precedence. |
| Current one-row-per-user/category ownership model | `missing` | Shared many-row owned inventory and separate role assignment are required before launch. |
| Current Product Intake Scalp Care spec and exact protocols | `missing` | Add the lean four-fact spec and shared normalized protocol records. |

## Deterministic fixture matrix

| Fixture ID | Input/setup | Expected result |
|---|---|---|
| `SC-01` | balanced scalp, no concerns, no hair loss, no qualifying product load, no owned Scalp Care | Stage 1 `not_needed`; no proactive card. |
| `SC-02` | dry scalp | optional `scalp_comfort`; as-needed/product-directed summary. |
| `SC-03` | oily scalp only | optional `scalp_flake_oil_adjunct`; no exfoliant role. |
| `SC-04` | `oily_dandruff` | optional flake/oil adjunct; Shampoo primary reason retained. |
| `SC-05` | `dry_dandruff` | one optional category with flake/oil plus comfort roles; no automatic second purchase. |
| `SC-05B` | `dry_dandruff`; flake/oil role assigned; comfort exists only through the dry-flake supporting rule | no second comfort purchase. |
| `SC-06` | `irritated` with missing detail | typed `clarification_required`; no exact Scalp Care recommendation. |
| `SC-07` | `irritated` plus mild sensitive/itchy answer | optional comfort role. |
| `SC-08` | burning/painful/inflamed answer plus hair-loss concern and flakes | proactive roles suppressed; safety pause wins; owned products remain visible as non-executable. |
| `SC-09` | `hair_loss_or_thinning` | optional density role; cosmetic uncertainty facts retained. |
| `SC-10` | stable low density only | no density role. |
| `SC-11` | scalp-balance goal only | no role. |
| `SC-12` | Dry Shampoo at least weekly | buildup present; optional exfoliant unless safety/coverage gate suppresses purchase. |
| `SC-13` | weekly Leave-in and finishing Oil verified lengths-only | no scalp buildup/exfoliant role. |
| `SC-14` | oily scalp without qualifying product exposure | flake/oil adjunct only; no exfoliant. |
| `SC-15` | scalp/root product reported only `as_needed` with no rate | buildup does not become present; no exfoliant from that fact alone. |
| `SC-16` | possible root product with missing target/frequency | buildup unknown; no exfoliant; missing reason retained. |
| `SC-17` | several qualifying root products | one exfoliant role with all source facts; no duplicate role/card. |
| `SC-18` | owned comfort serum but balanced/no trigger | Stage 1 remains `not_needed`; Stage 2 still shows and assesses the product. |
| `SC-19` | comfort trigger and selected Shampoo adequately covers comfort | optional reason retained; no new Scalp Care comfort purchase. |
| `SC-20` | scalp/root reset trigger fully covered by Deep Cleansing | no duplicate exfoliant purchase. |
| `SC-21` | hair-loss trigger, no safety pause | density job remains uncovered and enters exact candidate selection. |
| `SC-22` | verified owned comfort product, correct role, complete protocol, no limitation | `ideal`, `keep_and_use`, no replacement. |
| `SC-23` | verified cosmetic density product, exact role/safety/protocol fit, no product-specific limitation | `ideal` plus separate adjacent `limited_evidence`; may be kept/recommended. |
| `SC-24` | verified product's primary role differs from required role | `mismatch`; does not cover the role. |
| `SC-25` | medicinal topical entered as cosmetic Scalp Care | `mismatch`/category exclusion; separate medication route. |
| `SC-26` | pending identity or primary role | `unknown`; visible, not executable or confidently recommended. |
| `SC-27` | `presentationFormat = unknown` on active candidate | `unknown` until reviewed format/other is set. |
| `SC-28` | missing rinse mode, required contact/rinse behavior, placement, or another critical non-cadence instruction | `unknown`, `keep_pending_protocol`; no executable step. |
| `SC-29` | known reaction to exact product | `mismatch`, `do_not_use`, execution paused. |
| `SC-30` | no ideal new candidate but one supportive safe candidate | may offer supportive candidate with limitation; never force it. |
| `SC-31` | uncovered role with only mismatch/unknown/unavailable candidates | explicit no-valid-match state. |
| `SC-32` | two owned products for same role, no assignment | `primary_product_selection_required`; both remain saved/visible and neither is analysed automatically. |
| `SC-33` | explicit selection changes same-role product | proposed successor; active assignment unchanged until confirmation. |
| `SC-34` | comfort and density are independently uncovered with two products | one category, two role assignments, at most one analysed product per role. |
| `SC-35` | acquired shopping recommendation | preview assignment/recipe delta; activate only after confirmation. |
| `SC-36` | daily density protocol across wash and non-wash days | exact daily occurrences compile without adding wet washes. |
| `SC-37` | verified exfoliant 15–20 minute pre-Shampoo protocol with cadence | place before Shampoo on an existing wash; no extra wash. |
| `SC-38` | exfoliant and Deep Cleansing target same wash without compatibility | do not co-schedule; separate or leave interaction unresolved. |
| `SC-39` | two daily leave-ons require same window, compatibility unknown | do not stack automatically; separate only if protocols permit. |
| `SC-40` | otherwise complete product in any Scalp Care role omits repeat cadence | compile `as_needed` with `cadenceSource = 'category_fallback'`, not a weekly quota or manufacturer claim. |
| `SC-41` | same canonical inputs, inventory ordering, catalog, and version | byte-stable tier, role order, selection, reasons, and proposal payload. |
| `SC-42` | selected owned mismatch leaves the role uncovered and one eligible replacement exists | `replace_recommended`; active plan unchanged until confirmation. |
| `SC-43` | every compatible role signal is present without a safety pause | one `optional` category; `scalp_care.inclusion.never_basis` remains true. |

Every rule above must map to at least one named test fixture. Implementation follows test-first development at `tests/personal-plan/categories/scalp-care.test.ts`.

## Launch and data gates

### Category-local catalog/data gates

- Add canonical `scalp_care` identity and `ProductScalpCareSpec` support to Product Intake.
- Verify at least one active Drogerie candidate per role with exact identity, cosmetic status, known/reviewed format, rinse mode, and complete critical protocol. The working eight-product research set is not automatically the launch set.
- Density recommendations must render the adjacent limited-evidence statement.
- Pending/unverified products remain `unknown`; no ingredient or product name may fill missing structured facts.
- Normalize approved exact directions into role-keyed shared application protocols without adding duplicate Scalp-Care-specific columns.

### Shared implementation dependencies

- Implement the approved shared multi-product plan first: remove the one-row-per-user/category invariant, retain exact-row mutation semantics, and add role-relative plan assignments only in the later Personal Plan layer.
- Add the shared conditional main-product selector: when more than one owned product competes for a role, require the user to choose that role's main product; save all siblings and analyse only the selected product. Scalp Care invokes this separately for each relevant role.
- Represent `as_needed` as a non-comparable sibling in a shared `ReportedProductFrequency = ProductFrequency | 'as_needed'` contract. Do not insert it into the ordered numeric `PRODUCT_FREQUENCIES` metadata or pass it to `isProductFrequencyAtLeast`; add dedicated normalization/storage/UI handling so existing frequency arithmetic cannot order it accidentally.
- Add the durable `scalp_irritation_detail` screen/answer to the lossless quiz, persistence, resume, projections, and versioned profile. Bump the submission envelope to version 4 and keep Customer.io/outbox compatibility for in-flight versions 2 and 3 during the transition.
- Compute quiz progress from the reachable screen sequence or an equivalent monotonic conditional-step contract; do not divide by a flat screen list that includes a skipped conditional screen.
- Gate the new conditional screen with `PERSONAL_PLAN_SCALP_IRRITATION_DETAIL_ENABLED`, default off. If it is disabled, Scalp Care cannot launch for users whose `irritated` answer lacks the clarification; use conservative safety pause rather than silently guessing. This is an input-flow rollback control, not a second Scalp Care recommendation architecture.
- Extend the Stage-1 category set and shared output to include `scalp_care` and role-keyed product-directed cadence.
- Expose scalp/root product-usage reason facts from the shared Reset/product-load assessment.
- Add the portfolio coverage rule that prevents duplicate Shampoo/Deep Cleansing/Scalp Care purchases.
- Create the currently planned—but not yet implemented—role-keyed `product_application_protocols` table, RLS/write authority, loader, seeds, compiler, and conservative interaction handling.
- Make nested `tests/personal-plan/categories/*.test.ts` files part of the actual Node test command before relying on the declared test surface; `ci:verify` alone is not the category-test gate.

### Migration and compatibility gate

- Use expand → backfill/reconcile → contract for legacy `serum`, `scrub`, and `peeling` values.
- In the expand phase, insert the `product_categories(key = 'scalp_care')` parent row before any usage-row update.
- Preflight the composite foreign keys between `product_submissions` and `user_product_usage` that include `category`. Update parent/child category values atomically where permitted or drop/recreate the affected composite constraints around the guarded backfill; do not run a parent-only update that can violate them.
- Re-verify the earlier read-only count before writing. Preserve the 19 usage rows observed on 2026-08-06 if the fresh preflight matches; do not guess role or format. Unresolved rows become conservative unknown/pending records.
- Remove legacy serum/scrub-to-Peeling decision authority only after all readers/writers are migrated and regression-tested.
- Retire `product_peeling_specs` from Personal Plan authority; preserve compatibility until its recommendation selector and admin read/write consumers are removed.

Concrete identity integration must update `CanonicalProductCategoryKey`, `SUPPORTED_PRODUCT_CATEGORY_KEYS`, and `ProductIntakeCategoryKey` together. A static audit must account for every active `product_peeling_specs` query before contraction.

### Verification, rollout, and rollback

- Implement all `SC-*` fixtures and cross-category Shampoo/Deep Cleansing coverage fixtures.
- Add migration/FK/RLS/cardinality tests, Product Intake validation tests, protocol tests, conditional-flow/progress/version tests, and deterministic proposal tests.
- Capture a privacy-safe aggregate baseline for quiz completion around the existing scalp-concern step before enabling the conditional screen. After enablement, compare conditional-screen reach/completion and total quiz completion without logging raw answers, symptom text, or product identity.
- Keep Scalp Care recommendation launch behind the shared Personal Plan feature flag; do not add a separate Scalp Care runtime architecture. The dedicated input-screen flag exists only so the live quiz step can be disabled without killing the entire funnel.
- Track privacy-safe category/role/tier/verdict/reason IDs only—never raw symptoms, free text, product names, or health context in analytics.
- Roll back exposure through the shared feature flag/application rollback while retaining additive catalog/inventory data; do not use destructive production down migrations.

## Required implementation sequence

There is no recognition-only interim Scalp Care launch. Nick explicitly chose the complete canonical architecture rather than an intermediate product model. Execute only after the shared prerequisites are available:

1. implement and verify many-row owned inventory without changing legacy recommendation cardinality;
2. add the conditional quiz field, version/projection compatibility, monotonic progress, measurement, and its dedicated rollback flag;
3. expand canonical identity, Product Intake, and `ProductScalpCareSpec`, then reconcile legacy rows behind guarded constraints;
4. create the shared role-assignment and normalized product-protocol authorities and verify the launch-product facts;
5. implement Stage-1 Scalp Care need/role/buildup behavior and portfolio deduplication test-first;
6. implement Stage-2 selected-product fit, lifecycle, and exact recommendation behavior;
7. implement Stage-3 exact protocol compilation and interaction handling;
8. run every category, cross-category, migration, quiz, protocol, and journey fixture before enabling the shared Personal Plan flag.

The category waits for this sequence. No partial V0 is exposed to users.

## Deferred dependencies and confirmation

### Category blockers

None. Nick confirmed the category architecture, four roles, optional-only policy, input mapping, conditional irritation clarification, hair-loss route, uncovered-job behavior, limited-evidence density recommendation, one selected product per role, product-directed cadence, lean intake fields, and deferred exfoliation subtype on 2026-08-06. The follow-up interview also confirmed that density fit and efficacy evidence remain separate, same-role main-product selection is user-driven and role-relative, and missing repeat cadence falls back to a clearly attributed Hair Concierge `as_needed` rule for all four roles.

### Catalog/data gaps

- exact launch-product identity and protocol verification;
- known-format verification for the two working exfoliants;
- complete cadence verification for incomplete public directions;
- `ProductScalpCareSpec` and protocol backfill;
- reversible reconciliation of legacy usage rows.

### Shared cross-category dependencies

- multi-product owned inventory and role assignment;
- non-comparable shared reported-frequency support for `as_needed`;
- Stage-1 category/output expansion;
- scalp/root buildup reason facts;
- portfolio coverage/deduplication;
- quiz clarification persistence;
- shared reason salience and final German card templates.

These dependencies block implementation/launch, not the confirmed category policy.
