---
category: oil
document_type: decision
status: confirmed
decision_version: 1
last_reviewed_at: 2026-08-05
evidence_file: docs/personal-plan/categories/oil/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/oil.ts
test_surface: tests/personal-plan/categories/oil.test.ts
---

# Personal Plan Oil decision

## Authority and status

This document records the confirmed Personal Plan decisions for products consumers identify as hair oil or hair serum. It follows `docs/personal-plan/categories/category-design-framework.md`.

The category charter, supported fibre roles, role inclusion, functional-benefit vocabulary, captured scalp-use boundary, owned-product role question, wash-day cadence and application, owned-product allocation, product schema, layered fit, reconciliation lifecycle, safety/claim boundaries, cross-category ownership, structured reasoning, fixtures, and launch gate are confirmed. Optional/non-wash allocation is deliberately owned by the later day-type specification and is a hard pre-launch gate; catalog backfill remains an implementation dependency.

## Current-behavior treatment

The current product does not have one coherent Oil policy:

- CareBalance emits a weekly Oil baseline for every profile and raises it for coarse, curly/coily, dry, or frizzy profiles;
- the routine planner is pre-wash-first and proactively activates Oil for dryness, damage, split ends, or roughness;
- Chat requires a requested purpose and maps pre-wash, Styling finish, and light finish to legacy subtypes;
- `product_oil_eligibility` stores thickness, purpose, subtype, and ingredient flags but no stable product-level format, weight, application stage, scalp suitability, or Heat-protection facts.

Treatment for the Personal Plan:

| Current behavior | Treatment |
|---|---|
| Clarify actual use role before evaluating an owned Oil | `reuse/adapt` into the confirmed conditional single-select question |
| Exact purpose candidates outrank generic subtype candidates | `reuse` as a matching principle after canonical role facts exist |
| Legacy `natural | styling | dry_oil` subtype acts as purpose | `reject`; format/subtype and routine role are separate facts |
| CareBalance weekly Oil cadence | `reject` as authority; role-specific cadence must be defined |
| Routine damage/split-end pre-wash activation | `reject` as authority; inclusion must be grilled by role |
| Scalp/growth/dandruff suppression | `reuse` as a conservative recommendation boundary |
| Current inconsistent weight-risk predicates | `reject`; define one plan-owned rule |

## Category charter

“Hair oil” is one consumer/catalog category with several semantic roles. Roles represent materially different application events and may overlap in one verified product.

Supported hair-fibre roles:

```ts
type OilFibreRole =
  | 'pre_wash_fibre_treatment'
  | 'leave_on_fibre_conditioning'
  | 'dry_finish'
```

- `pre_wash_fibre_treatment`: applied through lengths before shampoo and rinsed out;
- `leave_on_fibre_conditioning`: applied sparingly to damp lengths before Styling or drying;
- `dry_finish`: applied sparingly to dry lengths or ends for a finishing effect.

Role boundaries:

- detangling is a functional benefit inside damp leave-on care, not a fourth role;
- Heat protection is a hard verified product capability, not an Oil role and never inferred from Oil ingredients;
- overnight or hot-oil use is a product-specific pre-wash protocol variant, not another role;
- pure oil, blended oil, silicone/oil serum, and dry oil are formats, not roles;
- a single verified product may support more than one fibre role, but one owned-product onboarding answer records only the user's selected current use.

## Canonical inputs and role ownership

Use the lossless `PersonalPlanQuizAnswers` envelope as authority. Do not compute Oil need from the lossy offer adapter or the legacy normalized concern vocabulary.

Relevant goals are:

- `moisture`;
- `frizz_surface`;
- `shine`;
- `strength_ends`;
- `manageability_styling`;
- `shape_definition` only as a boundary with Styling;
- `volume_balance` as a potential weight/load sensitivity;
- `scalp_balance` only as a scalp-role boundary; it never creates a fibre role and does not suppress legitimate lengths/ends use.

Relevant current concerns are:

- `dry_dull_lengths`;
- `frizz_flyaways`;
- `low_shine`;
- `breakage_or_split_ends`;
- `tangling`;
- `lost_shape` only as a boundary with Styling;
- `low_volume_or_weighed_down` as a weight/load sensitivity;
- `scalp_imbalance` only as a scalp-role boundary; it never creates a fibre role and does not suppress legitimate lengths/ends use.

Corroborating profile and exposure inputs are `hairSurface`, `chemicalTreatments`, `elasticResponse`, thickness, density, and hair length. Scalp oiliness and scalp concerns never create a supported Oil role, but they also do not suppress an independently valid lengths/ends role. Only a shared safety exclusion, a product reaction, or an adverse scalp response suppresses assignment.

`materialStructuralVulnerability` is a narrow shared `PlanDamageAssessment` fact, not an alias for its combined `structuralLevel` or `repairPriority`. Its `present` field is `true` only when at least one independent driver is present:

- a non-natural chemical treatment (`colored`, `lightened`, `permed`, or `chemically_straightened`); or
- `elasticResponse = snaps`.

Surface roughness, breakage, split ends, dry lengths, Heat, and mechanical stress do not set this fact. Those signals may still influence their own documented rules, but they cannot corroborate themselves through the combined damage score. Oil consumes the shared fact and its driver IDs; it never reconstructs a category-local damage score.

### `pre_wash_fibre_treatment`

Primary job: formula- and protocol-qualified reduction of wash-associated fibre stress for vulnerable lengths.

- strongest observed signals: `breakage_or_split_ends`, or `dry_dull_lengths` combined with `hairSurface = rough`;
- goal-only support: `strength_ends` and `moisture`;
- independent corroboration: non-natural chemical treatment or `elasticResponse = snaps`;
- supporting context that cannot independently promote the role: rough surface and long/very-long hair;
- never describe the role as repairing existing split ends, rebuilding fibre, or replacing Conditioner, Mask, or Bondbuilder.

### `leave_on_fibre_conditioning`

Primary cosmetic job: short-term surface smoothing, softness, and flyaway/frizz reduction on damp hair. Detangling and manageability are supporting rather than exclusive Oil jobs.

- observed signals: `frizz_flyaways`, `dry_dull_lengths`, and secondarily `tangling`;
- goal support: `frizz_surface`, `shine`, and `manageability_styling`;
- corroboration: rough surface, textured hair, and chemical treatment;
- Leave-in normally owns persistent damp-hair conditioning and detangling more directly, so this Oil role is normally supporting/optional rather than the first category chosen;
- Heat protection requires a separate verified finished-product capability.

### `dry_finish`

Primary job: immediate cosmetic shine, surface polish, flyaway control, and a more finished appearance through dry lengths or ends.

- strongest observed signal: `low_shine`;
- additional observed support: `frizz_flyaways`;
- goal support: `shine` and `frizz_surface`;
- corroboration: dry/rough lengths, texture, and chemical treatment;
- Styling owns hold and lasting wave/curl definition; Oil may only polish or support apparent definition.

### Load and scalp boundaries

- `low_volume_or_weighed_down`, fine thickness, and low density do not universally prohibit a suitable lightweight Oil; they downshift target weight and amount and may reduce the role tier when the benefit is only optional;
- oily scalp, scalp imbalance, or another scalp concern prohibits scalp Oil guidance but does not automatically prohibit carefully separated lengths/ends use;
- product placement and dose must make the lengths/scalp separation explicit.
- a valid low-shine, frizz, or pre-wash fibre role remains eligible when a scalp concern coexists; its instructions explicitly keep the product on lengths/ends and away from the scalp.

Never credit ordinary Oil with scalp balance, dandruff/irritation treatment, hair growth, reduced shedding, volume creation, durable hold/definition, existing split-end repair, structural reconstruction, or unverified Heat protection.

### Confirmed starting hierarchy

- `dry_finish` may become `basis` when Oil is the most direct category for an actual low-shine or localized finishing problem;
- `pre_wash_fibre_treatment` may become `basis` for sufficiently vulnerable lengths when the exact product is qualified for that protocol and rationale;
- `leave_on_fibre_conditioning` normally remains `optional` because Leave-in has stronger default ownership of damp conditioning and detangling;
- the role-specific truth tables below are authoritative. Compute every role independently, retain every included role, and set the aggregate category tier to the strongest role tier (`basis` before `optional` before `not_needed`). Do not suppress a second legitimate Basis role merely to cap the number of Oil occurrences; reuse one verified product across roles when possible and otherwise keep the separate jobs explicit.
- the same rule applies to the rare triple-role case: independently justified pre-wash, damp smoothing, and dry-finish roles may all remain `basis` around one wash. Product assignment should reuse one verified multi-role product where it is genuinely the best fit, but must not weaken a job or demote a role merely to reduce bottles or occurrences.

## Role inclusion

Compute each supported role independently. The strongest included role later determines the aggregate Oil category tier; product ownership never creates the underlying role need.

Define the shared `healthyManageableLengths` guard once before any role consumes it. It passes only when all of the following are confirmed:

- no `dry_dull_lengths` concern;
- no `tangling` concern;
- no `breakage_or_split_ends` concern;
- `hairSurface` is not `rough`;
- `materialStructuralVulnerability.present = false` in the shared `PlanDamageAssessment`;
- no `lost_shape` concern;
- no `shape_definition` goal.

Frizz/flyaway or low-shine signals themselves do not fail this guard because they are the intended cosmetic targets.

### `dry_finish`

| Rule ID | Condition | Role tier | Reason |
|---|---|---|---|
| `oil.dry_finish.low_shine` | `currentConcerns` contains `low_shine` | `basis` | Oil is a direct category for immediate cosmetic shine and finishing polish. |
| `oil.dry_finish.shine_goal_direct` | `goals` contains `shine`, current `low_shine` is absent, and the healthy/manageable-lengths guard below passes | `basis` | In an otherwise uncomplicated portfolio, Oil is the most direct minimal product for the requested finishing job. |
| `oil.dry_finish.shine_goal_support` | `goals` contains `shine` without current `low_shine`, but the healthy/manageable-lengths guard does not pass | `optional` | Conditioner or Leave-in owns the broader care need; Oil remains incremental finishing support. |
| `oil.dry_finish.frizz_flyaways` | `currentConcerns` contains `frizz_flyaways` and no Basis rule matches | `optional` | Oil may polish flyaways, but the quiz does not distinguish localized flyaways from distributed frizz or shape loss. |
| `oil.dry_finish.frizz_goal` | `goals` contains `frizz_surface` and no Basis rule matches | `optional` | Surface finishing support; Leave-in or Styling may own the main job. |
| `oil.dry_finish.dry_rough_support` | `currentConcerns` contains `dry_dull_lengths` or `hairSurface = rough`, without a stronger dry-finish rule | `optional` | Finish support only; Conditioner/Leave-in own general conditioning. |
| `oil.dry_finish.no_job` | No rule above matches | `not_needed` | No confirmed dry-finish job. |

Precedence and boundaries:

1. `low_shine` always makes the role `basis`; a matching `shine` goal raises explanation priority but does not create a new tier;
2. a shine goal without a current low-shine concern becomes `basis` only when the healthy/manageable-lengths guard passes;
3. frizz/flyaways always makes `dry_finish` optional by itself, even when the matching goal is also selected; a direct healthy/manageable anti-frizz job belongs to the damp smoothing role instead;
4. `low_volume_or_weighed_down`, fine thickness, or low density does not erase a real `low_shine` need; it changes target weight, amount, and product fit;
5. `lost_shape`, `shape_definition`, `breakage_or_split_ends`, `strength_ends`, tangling, scalp inputs, and volume goals alone do not create a dry-finish role;
6. product format or ownership never upgrades the role tier.

### `pre_wash_fibre_treatment`

Use the shared `PlanDamageAssessment` to recognize a material chemical/structural vulnerability rather than scoring the same treatment answers again inside Oil.

For the goal-led optional rule, `preWashVulnerabilitySignal` means at least one of: `breakage_or_split_ends`; `dry_dull_lengths` together with `hairSurface = rough`; or `materialStructuralVulnerability.present = true`. Long hair, a goal by itself, and general frizz do not satisfy this signal.

| Rule ID | Condition | Role tier | Reason |
|---|---|---|---|
| `oil.pre_wash_fibre_treatment.breakage_corroborated` | `currentConcerns` contains `breakage_or_split_ends` and `materialStructuralVulnerability.present = true` | `basis` | Observed vulnerable ends/fibre plus independent corroboration supports a qualified preventive pre-wash role. |
| `oil.pre_wash_fibre_treatment.dry_rough_treated` | `dry_dull_lengths`, `hairSurface = rough`, and `materialStructuralVulnerability.present = true` | `basis` | Dry/rough lengths plus material treatment exposure justify stronger wash-associated support. |
| `oil.pre_wash_fibre_treatment.breakage_alone` | `breakage_or_split_ends` without a Basis corroborator | `optional` | Possible preventive support without enough evidence for a confident baseline. |
| `oil.pre_wash_fibre_treatment.dry_rough` | `dry_dull_lengths` plus `hairSurface = rough` without material structural vulnerability | `optional` | Conditioner/Leave-in/Mask own general care; pre-wash Oil may add support. |
| `oil.pre_wash_fibre_treatment.structural_exposure_only` | `materialStructuralVulnerability.present = true` without an observed pre-wash concern | `optional` | Exposure alone does not prove that another category is required. |
| `oil.pre_wash_fibre_treatment.goal_corroborated` | `goals` contains `strength_ends` or `moisture` plus `preWashVulnerabilitySignal`, with no Basis rule | `optional` | Goal-led support with corroboration. |
| `oil.pre_wash_fibre_treatment.no_job` | No rule above matches | `not_needed` | No confirmed pre-wash fibre-treatment job. |

Precedence and boundaries:

1. either Basis rule wins, otherwise any optional rule wins, otherwise return `not_needed`;
2. goal-only, long/very-long hair alone, generic frizz, low shine, tangling, definition, volume, and scalp signals never create this role;
3. product ownership never changes the role tier;
4. the role is computed before exact selection, but only a product with verified pre-shampoo lengths use may fill it;
5. ingredient names alone do not qualify a product or permit a coconut-oil/protein-loss rationale;
6. user-facing explanation frames prevention/support around washing and never claims repair of existing split ends or structural reconstruction.

### `leave_on_fibre_conditioning`

This internal key represents the damp smoothing/pre-style use case. It does not transfer general persistent conditioning or detangling ownership away from Leave-in.

| Rule ID | Condition | Role tier | Reason |
|---|---|---|---|
| `oil.leave_on_fibre_conditioning.coily_frizz_layer` | `texture = coily` plus `frizz_flyaways` concern or `frizz_surface` goal | `basis` | Leave-in remains the broad conditioning Basis; a fitting damp Oil is a deliberate second Basis layer for additional smoothing, applied after Leave-in. |
| `oil.leave_on_fibre_conditioning.frizz_direct` | `frizz_flyaways` concern or `frizz_surface` goal plus `healthyManageableLengths` | local `basis` candidate | A light damp Oil/serum is the direct minimal product for smoothing and flyaway control when no broader conditioning or shape job is present. The portfolio pass makes the final ownership decision below. |
| `oil.leave_on_fibre_conditioning.frizz_support` | `frizz_flyaways` concern or `frizz_surface` goal, but the healthy/manageable guard fails | `optional` | Leave-in or Styling owns the broader care or shape need; Oil may add surface smoothing. |
| `oil.leave_on_fibre_conditioning.dry_rough_support` | `dry_dull_lengths` concern or `hairSurface = rough`, with no stronger damp rule | `optional` | Leave-in owns persistent care; Oil is only a supporting layer. |
| `oil.leave_on_fibre_conditioning.tangling_support` | `tangling` concern, with no stronger damp rule | `optional` | Leave-in owns broad detangling; a suitable Oil may add slip but is not the primary solution. |
| `oil.leave_on_fibre_conditioning.no_job` | No rule above matches | `not_needed` | No confirmed damp smoothing/pre-style job. |

Precedence and boundaries:

1. the coily-plus-frizz layered rule wins first; otherwise the direct healthy/manageable frizz rule wins, otherwise any supporting rule wins, otherwise return `not_needed`;
2. shine alone routes to `dry_finish`, not this damp role;
3. `lost_shape` or `shape_definition` alone routes to Leave-in/Styling rather than Oil;
4. Heat protection is never inferred and remains a separate verified product capability;
5. fine or load-sensitive hair changes target weight and amount; it does not erase a direct role automatically.
6. coily texture alone does not create an Oil role. In the explicit coily-plus-frizz case, Oil complements rather than replaces the independently required Leave-in and follows it in the application order.

Portfolio arbitration for the non-coily direct-frizz rule:

1. Category-local Oil emits a `basis` candidate for the material frizz/smoothing job; it does not import or call Leave-in rules.
2. The portfolio pass inspects the target functions of already-Basis categories, independent of owned-product availability.
3. If a Basis Leave-in target already owns `smooth_anti_frizz` as a required primary function, it covers the material frizz job and damp Oil is finalized as `optional` support.
4. If no already-Basis target fully owns the material frizz job, damp Oil remains `basis`.
5. Coily plus frizz bypasses this demotion and deliberately retains Leave-in Basis followed by damp Oil Basis.
6. Stage 2 must find an exact product that fulfils every required function assigned to its target. An owned product missing that function does not rewrite Stage 1 ownership; it receives the appropriate verdict and the role remains unresolved until a valid product is confirmed.
7. When two portfolios cover the same material jobs equally well and pass the same core fit, prefer the portfolio with fewer products. Never consolidate at the cost of required functional coverage or strict fit.

### Input invariants and unknown product facts

The persisted V2 Personal Plan envelope validates `texture`, `thickness`, `density`, `goals`, `currentConcerns`, `hairLength`, `hairSurface`, `elasticResponse`, and `chemicalTreatments` before plan computation. An explicitly empty `currentConcerns` array is valid; absence is not. Category code therefore does not implement unreachable partial-profile fallbacks or infer these values.

`chemicalTreatments` always contains at least one value. A non-natural treatment means the array contains at least one of `colored`, `lightened`, `permed`, or `chemically_straightened`; mere non-emptiness never counts because `natural` is itself a valid required answer.

Nullable product facts remain legitimate. Missing strict product role, thickness suitability, weight for a leave-on role, or critical protocol facts produce `noch in Prüfung` for that product without changing the computed category need.

## Multiple role presentation and product assignment

Several Oil roles may be included for the same user. Stage 1 still renders one `Haaröl` category card and shows every included role as a concise use-case pill:

- `Vor der Haarwäsche` for `pre_wash_fibre_treatment`;
- `In feuchtem Haar vor dem Styling` for `leave_on_fibre_conditioning`;
- `Als Finish in trockenem Haar` for `dry_finish`.

The role list communicates jobs, not the number of bottles. Stage 2 resolves products per included role:

1. evaluate owned and recommended products independently against each role;
2. reuse one product when its verified facts, fit, and protocol satisfy several roles;
3. otherwise assign separate products to the roles rather than selecting a weaker multi-use product merely to reduce product count;
4. a `basis` role must receive an exact valid assignment or remain visibly unresolved;
5. an `optional` role may show a concrete optional recommendation, but it enters the shopping list and living plan only when the user actively adds and confirms it;
6. product ownership never creates a role, and extra owned Oils remain evaluated but unassigned unless the user confirms their use.

Stage 3 compiles each confirmed product according to the role-specific occurrence and protocol. One product covering several roles therefore appears in each applicable instruction; separate products appear only in their assigned use cases.

## Wash-day occurrences and cadence

V1 derives Oil cadence from the user's wash frequency rather than computing a separate weekly Oil number.

For every role classified as `basis`:

- `pre_wash_fibre_treatment` appears before every compatible wash;
- `leave_on_fibre_conditioning` appears once on damp hair after every compatible wash;
- `dry_finish` appears once after every compatible wash when the hair is dry or the wash-day Styling process is complete.

`Basis` means the plan confidently recommends the step; it does not block logging or force compliance. Stage 3 renders it as a recommended step in each compatible wash-day recipe.

For a role classified as `optional`, do not invent a separate weekly frequency at the category layer. The later day-type compiler decides whether the accepted role appears as an optional step on every compatible wash day or only on particular day types. Until then, preserve the role tier and product assignment without scheduling a numeric cadence.

Oil can also serve as between-wash bridge care or finishing support. Leave-in has the same unresolved cross-category need. Do not exclude that behavior, force it into a wash-day role, or infer a daily cadence inside this category. The later day-type specification must define the shared non-wash-day event, category ownership, eligible products, triggers, cadence, and application instructions before the complete Personal Plan may launch.

## Multiple owned and assigned Oils

The inventory may contain any number of owned Oils, but the confirmed plan assigns at most one product to each included Oil role.

1. Evaluate every owned Oil independently against every included role.
2. Prefer one verified product across several roles when it satisfies each role without weakening fit.
3. Use different products when the best pre-wash and leave-on/finish products differ; do not force a multi-use compromise merely to reduce the bottle count.
4. Do not label assigned Oils as `primary`, `secondary`, `Öl 1`, or `Öl 2`. Their semantic role and chronological place are the useful distinction.
5. Order assigned products by the earliest role they perform: pre-wash, damp leave-on, then dry finish. When one product covers several roles, show one Stage-2 product card with every assigned role pill and order it by its earliest role.
6. Stage 3 repeats the product at every assigned chronological step; the single Stage-2 card does not collapse its executable occurrences.
7. Additional owned Oils remain evaluated and visible under `Weitere Haaröle`, but stay unassigned and never enter executable recipes automatically.
8. A fitting additional Oil may be shown as an alternative for a role. The user can confirm a swap, but V1 does not create automatic same-role rotation or a frequency split between interchangeable Oils.

## Confirmed product data model

Replace the legacy row-level subtype/purpose authority with one product-level Oil specification:

```ts
type UnverifiedOilFact = null

interface ProductOilSpec {
  productId: string
  supportedRoles: OilFibreRole[] | UnverifiedOilFact
  formulaFamily: 'pure_oil' | 'oil_blend' | 'oil_serum' | UnverifiedOilFact
  weight: 'light' | 'medium' | 'rich' | UnverifiedOilFact
  functionalBenefits: OilFunctionalBenefit[] | UnverifiedOilFact
  providesHeatProtection: boolean | UnverifiedOilFact
  ingredientFlags: OilIngredientFlag[] | UnverifiedOilFact
}
```

Use the existing shared product record as the single authority for identity, category, nullable `suitableThicknesses`, lifecycle, recommendation status, price, and purchase link. Do not duplicate those facts inside `ProductOilSpec`.

Store this one-to-one specification in the canonical `product_oil_specs` table. This is the first-principles name: it matches the existing product-level category convention and describes reusable Oil facts rather than one consumer's eligibility projection. Do not extend `product_oil_eligibility`: its live synchronization trigger deletes and regenerates rows from broad `products` arrays, so it cannot safely own curated facts.

Repository history previously used and conditionally dropped an empty table with this name. The implementation migration therefore begins with a live-schema preflight: if `product_oil_specs` exists, inspect its columns and preserve/export every row before adapting or replacing the schema; if it does not exist, create it normally. Never drop or overwrite a populated historical table merely because the current migration chain expects it to be absent.

Every supported role also requires a verified `(product_id, role_key)` record in the shared `product_application_protocols` authority. That record owns stage, hair state, placement, rinse versus leave-in behavior, phases, amount guidance, and contact time. Do not duplicate exact directions inside the Oil specification. A role listed as supported without its critical verified protocol remains `noch in Prüfung` for executable use.

### Field semantics

- `null` means the fact has not been verified. For arrays, a non-null empty array means the product was reviewed and verified to support none of those values. Never interpret absent data as a verified negative.
- `supportedRoles` is the authoritative product eligibility for pre-wash, damp smoothing/pre-style, and dry finish. Formula name or ingredients never infer a role. `null` produces `noch in Prüfung`; a verified array excluding the assigned role produces `wechseln empfohlen` for that role.
- `formulaFamily` describes the formula as a pure Oil, Oil blend, or Oil/serum system. It supports the Stage-2 product comparison and protocol explanation but never establishes suitability by itself.
- `weight` is the canonical formula-feel axis. It contributes to damp and dry leave-on fit, amount, and explanation. The pre-wash evaluator ignores it because that product is shampooed out. Missing weight is `noch in Prüfung` for a leave-on role but does not block a verified pre-wash role.
- shared nullable `suitableThicknesses` remains the strict product-suitability gate for every role. `null` means not verified; a non-empty verified array containing the user's thickness passes; a non-empty verified array excluding it is a mismatch. Empty arrays are invalid for active recommendable products and must not act as either unknown or wildcard. `weight` refines a fitting leave-on product and must not double-count the same thickness evidence as a second hard rejection.
- `functionalBenefits` contains only the three confirmed independently useful product jobs not already represented by role, formula family, weight, or Heat protection. `null` means unverified; `[]` means reviewed with no supported listed benefits.
- `providesHeatProtection` is a tri-state storage fact around a binary finished-product capability: `true` verified yes, `false` verified no, `null` unverified. Do not store maximum temperature or Heat-activation fields, infer the value from formula/ingredients, or create a fourth Oil role.
- `ingredientFlags` use the existing constrained `OilIngredientFlag` enum only for verified explanation and shared exclusion checks. They never establish a role, weight, functional benefit, or Heat protection by themselves.
- `scalp_use` remains user-specific inventory context and is not stored as a supported product role.

## Functional benefits

Use one deliberately small, shared product-benefit vocabulary:

```ts
type OilFunctionalBenefit =
  | 'shine'
  | 'smoothing_frizz_control'
  | 'slip_manageability'
```

| Benefit | User need it may serve | Applicable role | Boundary |
|---|---|---|---|
| `shine` | `low_shine` concern or `shine` goal | primarily `dry_finish`, secondarily a verified damp role | Cosmetic surface shine, not hydration or repair. |
| `smoothing_frizz_control` | `frizz_flyaways` concern or `frizz_surface` goal | `leave_on_fibre_conditioning` or `dry_finish` | Includes surface smoothing, flyaway/anti-static control, and product-qualified humidity claims; not hold or lasting definition. |
| `slip_manageability` | primarily `tangling`, secondarily rough-feeling lengths | supporting benefit in `leave_on_fibre_conditioning` | Includes softness and easier combing; Leave-in retains primary ownership of broad detangling. |

Benefit priority follows the shared three-level category convention:

1. current problem plus matching goal = priority `3`;
2. current problem without the matching goal = priority `2`;
3. goal without the current problem = priority `1`.

This priority ranks matching products only after role inclusion and category ownership are settled. A higher count of secondary benefits never compensates for the wrong role, a failed `suitableThicknesses` gate, unsuitable leave-on weight, or missing Heat protection where Heat protection is required. Prefer the candidate that covers the highest-priority need while preserving core fit; use lower-priority benefits as tie-breakers.

Catalog interpretation:

- award a benefit only when supported by verified finished-product facts;
- an absent benefit is `unverified`, not proof that the product cannot provide it, unless the catalog explicitly records a verified negative;
- do not derive benefits from an ingredient name, formula family, Oil subtype, or marketing category alone.

Deliberately merge or reject the following candidates:

- merge softness into `slip_manageability`;
- merge flyaway and anti-static control into `smoothing_frizz_control`; include humidity resistance only when the finished product makes a verified claim;
- reject moisture/hydration as an Oil benefit because surface coating is not internal hydration;
- reject general repair, strengthening, split-end repair, anti-breakage, and color-protection benefits as category-wide capabilities;
- retain narrow pre-wash fibre evidence inside role eligibility and reasoning rather than inventing a generic `repair` benefit;
- retain Heat protection only in `providesHeatProtection`;
- do not add curl/wave definition. Oil may make curls look more grouped by smoothing frizz, but Styling owns durable definition and hold. Breaking or softening a cast with Oil is an application technique within `dry_finish`, not a product benefit.

## Layered product fit

Evaluate an Oil separately for each assigned role and use the shared user-facing verdicts:

1. unresolved identity, pending review, or an unverified required role/thickness/protocol fact -> `noch in Prüfung`;
2. verified unsupported assigned role, failed shared `suitableThicknesses` gate, safety conflict, or confirmed persistent severe load mismatch -> `wechseln empfohlen`;
3. core gates pass but leave-on weight or the highest-priority functional need is only adjacent -> `passt mit Einschränkung`;
4. role, thickness, role-specific weight, protocol, and highest-priority functional need align -> `passt sehr gut`.

Missing Heat protection only prevents the product from covering a required Heat-protection occurrence. It does not make the Oil unsuitable for a separate pre-wash, damp-care, or dry-finish role.

### Leave-on weight and effective dosage

`suitableThicknesses` and `weight` are independent checks:

- `suitableThicknesses` is the researched general hair-diameter eligibility;
- `weight` is the intrinsic formula load for a particular damp or dry leave-on use;
- dosage and placement determine how much of that intrinsic load reaches the hair in practice.

Use this starting selection matrix for `leave_on_fibre_conditioning` and `dry_finish`:

| Profile | Ideal weight for a new recommendation | Adjacent weight | High load-risk weight |
|---|---|---|---|
| fine thickness | `light` | `medium` | `rich` |
| normal thickness | `light`, `medium` | `rich` | — |
| coarse thickness | `medium`, `rich` | `light` | — |

When `low_volume_or_weighed_down` is present, narrow the ideal target to the lightest normally ideal weight for that thickness rather than forcing every profile to `light`:

| Profile | Ideal with load sensitivity | Adjacent | High load risk |
|---|---|---|---|
| fine thickness | `light` | `medium` | `rich` |
| normal thickness | `light` | `medium` | `rich` |
| coarse thickness | `medium` | `light`, `rich` | — |

For coarse hair, `light` is adjacent because it may under-serve the assigned Oil job rather than because it creates overload. Preserve volume primarily through minimal effective dosage, lengths/ends-only placement, root avoidance, and the later Styling recommendation. Do not use density or hair texture as an independent hard weight gate in V1.

Dosage rules:

- evaluate product fit at the lowest effective recommended dose and the correct lengths/ends placement, not at the user's potentially excessive current dose;
- when selecting a new recommendation, prefer the profile's ideal weight whenever a valid candidate exists rather than intentionally recommending a heavier compromise;
- an owned adjacent or high-risk weight remains initially usable when role and `suitableThicknesses` pass. Give it `passt mit Einschränkung` plus a precise minimal-dose and lengths/ends-only adjustment instead of demanding an immediate replacement;
- recommend a switch when the product fails `suitableThicknesses`, when the user confirms that overload persists at the correct minimal dose, or when the amount must become so small that the product no longer performs its assigned job;
- verified finished-product directions and role-specific fine-hair suitability may override the generic weight heuristic, but the product then remains at most `passt mit Einschränkung` until user response confirms it does not overload the hair;
- when a fundamentally fitting product currently feels heavy, first reduce amount and keep it away from the roots. Once the user confirms good performance without overload, the living-plan verdict may be upgraded; if overload persists, change it to `wechseln empfohlen`.

The pre-wash role ignores leave-on weight because the product is shampooed out. Its amount and contact time still follow the verified product protocol.

## Role-specific application

Product-specific verified directions always override the category fallback. A product without enough verified directions for its assigned role remains `noch in Prüfung`; do not invent precise amounts or contact times merely to complete the recipe.

### `pre_wash_fibre_treatment`

Confirmed fallback sequence:

1. apply before washing to dry, unwashed hair;
2. distribute through the lengths and ends that need support, keeping it off the scalp;
3. use enough for even coverage according to the verified product protocol; a rich or heavy formula is acceptable because this role is rinsed out;
4. leave it on for the product-specific verified contact time;
5. shampoo it out as part of the same wash-day recipe, then continue with the planned Conditioner/Mask steps.

Pre-wash fit ignores leave-on weight and load sensitivity. It still requires verified pre-wash role support and a usable rinse-out protocol. Do not automatically add a stronger Shampoo, double Shampoo, or clarifying step solely because pre-wash Oil is present. If the correct amount repeatedly remains difficult to remove, adjust the amount or assigned product rather than escalating cleansing by default.

### `leave_on_fibre_conditioning`

Confirmed fallback sequence:

1. after washing, begin on damp rather than dripping-wet hair;
2. if a separate Leave-in is planned, apply the Leave-in first;
3. start with the smallest product-appropriate amount and distribute it through the lengths and ends, keeping it away from the roots;
4. loosely section the hair when that improves even distribution; do not prescribe a fixed section count;
5. leave the Oil in and continue with the planned Styling or drying steps;
6. if this exact Oil also provides the required verified Heat protection, follow its product-specific Heat-protection protocol before the Heat event.

Product-specific verified directions override the fallback order. A heavy feel should first trigger a smaller amount and more conservative placement; persistent overload at the correct dose triggers the living-plan fit reassessment defined above.

### `dry_finish`

Confirmed fallback sequence:

1. wait until the hair is fully dry and the planned Styling process is complete;
2. start with the smallest product-appropriate amount and spread it between the palms;
3. apply to the ends first, then use only the residue on the lengths, surface frizz, or individual flyaways;
4. keep the product away from the roots;
5. for waves/curls with a Styling cast, scrunch gently only after the hair is fully dry and do not rake through the finished shape;
6. treat this as one wash-day finishing occurrence rather than assuming automatic daily reapplication.

Product-specific verified directions override the fallback. Any separate use between washes belongs to the deferred shared Oil/Leave-in bridge-care event rather than being silently added to the wash-day cadence.

## Reconciliation and exact recommendation

Reuse the shared owned, pending, shopping, acquired, and informed-override lifecycle without an Oil-specific state machine. Apply it separately to every included Oil role.

- `passt sehr gut`: keep and assign the owned product to the role;
- `passt mit Einschränkung`: explain the exact limitation, propose the amount/application adjustment or fitting alternative, and require confirmation before changing the living plan;
- `wechseln empfohlen`: provide one exact verified alternative for the uncovered role. The user may keep the owned Oil as a confirmed non-blocking override; the plan continues to show the limitation and retains the alternative on the shopping list;
- `noch in Prüfung`: keep the pending product visible but exclude it from executable recipes until identity, role support, fit, and critical protocol facts are reviewed. Supply one exact verified alternative for any uncovered `basis` role rather than fabricating instructions for the pending product.

Clicking a purchase link never changes the living-plan assignment. Keep the recommendation in the shopping lifecycle and ask whether the product was acquired; replace the current assignment only after the user confirms it. A confirmed acquired product is evaluated again before assignment.

If one product covers several roles, reconcile each role independently. A product may therefore remain assigned for one role while receiving `wechseln empfohlen` or `noch in Prüfung` for another. Optional-role recommendations enter the shopping list and executable plan only after the user actively adds and confirms them.

## Safety, response, and claim boundaries

- Apply the shared allergy, ingredient-exclusion, and safety gates before Oil role or fit evaluation.
- Keep ordinary Oil recommendations and category fallbacks on the hair lengths/ends rather than the scalp.
- Never credit or present an Oil as Heat protection unless the exact finished product has verified `providesHeatProtection = true` and a compatible protocol.
- When the user has a Heat occurrence, the confirmed plan must cover it through this verified Oil capability or another verified Heat-protection product; ordinary Oil never substitutes for the missing capability.
- Irritation, scalp breakouts, or persistent heavy residue triggers stop/reassessment guidance rather than stronger efficacy claims or automatic clarifying escalation.
- Do not claim that ordinary Oil internally hydrates hair, repairs existing split ends, reconstructs bonds, grows hair, treats dandruff/scalp disease, or creates lasting curl/wave definition.
- Limit positive reasoning to the verified role and product facts: cosmetic shine, surface smoothing/frizz control, slip/manageability, and qualified preventive/supportive pre-wash use.
- Product-specific marketing never overrides these boundaries; uncertain claims remain unverified.

## Cross-category ownership

| Job | Primary owner | Oil boundary |
|---|---|---|
| Rinse-out baseline conditioning | Conditioner | Oil does not replace Conditioner. |
| Persistent post-wash care and broad detangling | Leave-in | Oil is normally supporting. |
| Damp anti-frizz smoothing for otherwise healthy/manageable lengths | Oil or Leave-in | Oil may be the single `basis` leave-on when no broader care or shape job exists. |
| Immediate dry shine, surface polish, and localized flyaways | Oil | Oil is the primary owner. |
| Qualified support against wash-associated fibre stress | Pre-wash Oil | Oil owns the pre-wash role but complements rather than replaces Shampoo and Conditioner. |
| Occasional intensive care | Mask | Oil does not replace Mask. |
| Heat protection | Exact verified Heat-protection product | Oil covers the occurrence only when the finished Oil is explicitly verified. |
| Hold, cast creation, and lasting curl/wave definition | Styling | Oil may smooth the finished surface or soften/break an existing dry cast; it does not create hold. |
| Scalp treatment, dandruff/irritation care, or hair-loss support | Later scalp-care/medical boundary | Ordinary Oil is excluded from recommendation ownership. |

The governing rule is that Oil replaces a separate Leave-in only in the narrow uncomplicated non-coily damp-smoothing case. For coily hair plus frizz, both Leave-in and damp Oil are Basis: Leave-in provides broader conditioning and Oil follows as a smoothing layer. Otherwise Oil adds a qualified pre-wash or finishing role around the core Conditioner/Leave-in/Mask/Styling portfolio without displacing the primary owner.

### Legacy migration treatment

The live catalog currently stores `natuerliches-oel`, `styling-oel`, and `trocken-oel` plus the derived purposes `pre_wash_oiling`, `styling_finish`, and `light_finish`. These values are migration hints rather than the new authority:

1. **Expand:** preflight any historical `product_oil_specs`, preserve and migrate compatible rows, then create/adapt the canonical table with nullable constrained fields and role-keyed protocol rows without changing legacy readers. Before changing any shared Oil `suitableThicknesses`, snapshot and fingerprint every `product_oil_eligibility` row, including `oil_purpose` and `ingredient_flags`. Replace its destructive synchronization trigger with a compatibility-safe version: `null` thickness performs no destructive rewrite, and verified non-null changes reconcile eligibility keys while preserving curated metadata. In the same guarded change set, update the live `match_products` SQL contract, TypeScript matcher, validators, products API, shared/generated product types, Product Intake serializers, and admin form to preserve nullable unknown rather than coercing it to `[]`, crashing, or treating it as a match. Assert row counts, metadata fingerprints, and null/pass/mismatch behavior at every consumer seam after the migration.
2. **Backfill:** research active Oils and write curated specs/protocols to the new tables. Treat legacy subtype, purpose, and ingredient flags as migration hints; verify them before writing canonical facts. Personal Plan reads only the new authority; `null` stays visibly unverified. During coexistence, Product Intake writes the new canonical spec and the minimum legacy projection needed by existing app-side readers.
3. **Contract:** after the app-side recommendation-engine and product-matching readers of `product_oil_eligibility` are retired, drop `trg_sync_product_oil_eligibility`, its synchronization/expansion functions, and `product_oil_eligibility`. The legacy embedding RPC has already been removed and is not a remaining cutover dependency.

### Launch-readiness gate

Do not activate the complete Personal Plan through `PERSONAL_PLAN_APP_V1_ENABLED` until the curated launch catalog provides at least one verified `ideal` or `supportive` candidate plus its complete critical protocol for every supported Oil role and supported thickness/load target in the launch fixture matrix. Common budget and strong-exclusion paths must either retain a verified candidate or deliberately produce the explicit no-safe-match state; they may not fall through to an unverified recommendation.

Oil is part of the complete promised plan, not an independently enabled module. Do not add an Oil-specific feature flag, category allowlist, or silent omission state. Long-tail owned Oils may remain `noch in Prüfung`, but every computed Basis role must still have one verified exact alternative before global launch. Treat this as a pre-activation data gate rather than adding a second speculative runtime recommendation engine or silently weakening the fit rules.

Instrument the shared Personal Plan selection boundary with privacy-safe aggregate facts for category, role, final tier, product verdict, and unresolved-reason code. Do not include user identity, free text, or exact owned-product identity in the aggregate event. Launch fixtures require zero unresolved Oil Basis roles. After activation, alert on any non-zero unresolved-Basis rate or unexpected increase in `noch in Prüfung`; if the complete-plan promise is no longer met, use the one global `PERSONAL_PLAN_APP_V1_ENABLED` rollback rather than hiding Oil independently.

- research `natuerliches-oel` as `pure_oil` or `oil_blend`; retain pre-wash only when verified directions support it;
- research `styling-oel` as `oil_blend` or `oil_serum` and verify damp use, dry finish, or both;
- treat `trocken-oel` as a likely light-weight signal, then research its formula family and supported roles independently;
- migrate thickness eligibility to the shared nullable `suitableThicknesses` authority and resolve any disagreement rather than retaining subtype-per-thickness rows;
- research legacy empty arrays before migration: convert unresolved values to `null`, verified products to a non-empty list, and never silently reinterpret an old empty array as “fits nobody”;
- review every active Oil for the binary Heat-protection fact as part of the migration. The present Oil schema contains no verified Heat field, so no current product receives Heat credit automatically.
- extend Product Intake readiness/approval for Oil so newly approved products write `product_oil_specs`; maintain the minimum legacy compatibility projection only while its named app-side readers remain live. A product without a verified role-specific application protocol remains non-executable until that separate review is complete.

## Scalp-use boundary

`scalp_use` is accepted only as an owned-product inventory classification. It is not a supported Personal Plan Oil role and does not create a scalp Oil recommendation or executable Oil occurrence.

Do not use ordinary Oil to recommend:

- scalp cleansing or build-up removal;
- treatment of flakes, dandruff, seborrheic dermatitis, itching, or irritation;
- hair growth, density improvement, or reduced shedding;
- scalp “detox” or medically adjacent treatment.

A future genuine rinse-off cleansing-oil category would require an emulsifying/surfactant system, scalp-cleansing directions, and product-level substantiation. It is not represented by ordinary carrier oils in V1.

## Conditional owned-product question

Ask this question only when the user adds or confirms an owned Oil product:

> **Wofür verwendest du dieses Öl hauptsächlich?**

Single-select options:

| Stored value | German option |
|---|---|
| `pre_wash_fibre_treatment` | `Vor der Haarwäsche in den Längen` |
| `leave_on_fibre_conditioning` | `In feuchtem Haar vor dem Styling` |
| `dry_finish` | `Als Finish in trockenem Haar` |
| `scalp_use` | `Auf der Kopfhaut` |

Confirmed interaction rules:

- exactly one choice is required;
- do not offer `Anders` or `Weiß nicht`;
- do not offer secondary or “also sometimes” roles;
- do not ask a follow-up question after `scalp_use`;
- the answer records current product use and never lets the user decide what the Personal Plan believes they need;
- the plan independently computes which supported Oil role, if any, belongs in the ideal plan;
- `scalp_use` keeps the product visible in inventory but excludes it from role recommendations and executable hair-fibre recipes.

## Structured reasoning payload

The deterministic Oil module must retain enough structured facts for Stage 1, Stage 2, Stage 3, tests, analytics, and a later verbalization layer. Stable rule and adjustment IDs come from checked constant tables rather than arbitrary prose. At minimum return:

```ts
interface PlanEvidenceRef {
  source: 'concern' | 'goal' | 'profile' | 'assessment'
  key: string
  sourceAnswerId: string | null
}

type OilRuleId = (typeof OIL_ROLE_RULES)[number]['id']

type OilAdjustmentId =
  | 'reduce_to_minimal_dose'
  | 'apply_lengths_ends_only'
  | 'avoid_roots'
  | 'confirm_overload_response'

interface OilPlanDecisionFacts {
  categoryTier: 'basis' | 'optional' | 'not_needed'
  roleEvaluations: Array<{
    role: OilFibreRole
    localTier: 'basis' | 'optional' | 'not_needed'
    finalTier: 'basis' | 'optional' | 'not_needed'
    portfolioAdjustmentId: 'covered_by_basis_leave_in' | null
    matchedRuleIds: OilRuleId[]
    observedSignals: PlanEvidenceRef[]
    goalSignals: PlanEvidenceRef[]
    corroboratingSignals: PlanEvidenceRef[] // includes materialStructuralVulnerability.drivers
    ownership: 'required' | 'supporting'
  }>
  target: {
    idealLeaveOnWeights: Array<'light' | 'medium' | 'rich'>
    loadSensitive: boolean
    prioritizedBenefits: Array<{
      benefit: OilFunctionalBenefit
      priority: 1 | 2 | 3
    }>
  }
  productEvaluations: Array<{
    productId: string
    lifecycleState: ProductChoiceState
    roleVerdicts: Array<{
      role: OilFibreRole
      verdict: CategoryFitStatus
      hardGateFacts: string[]
      fitFacts: string[]
      limitationFacts: string[]
      adjustmentIds: OilAdjustmentId[]
    }>
  }>
  assignments: Array<{
    role: OilFibreRole
    activeUsageIds: string[] // invariant: zero or one usage for each Oil role in V1
    recommendedProductId: string | null
    choiceState: ProductChoiceState
    chronologicalOrder: 1 | 2 | 3
  }>
  safetyFlags: string[]
}
```

`categoryTier` is the strongest final included role tier. The presentation layer may turn these facts into concise German reasoning, but it may not change role inclusion, tier, product verdict, assignment, cadence, safety boundary, or proposed successor-plan action.

`roleEvaluations` always contains all three supported Oil roles so exclusion reasoning remains inspectable. Only evaluations with `basis` or `optional` become shared `PlanProductRole` entries; `not_needed` never enters product assignment or scheduling. Basis Oil roles use `frequencyRule = every_eligible_wash`. Optional Oil roles use `frequencyRule = deferred_day_type` and a `null` frequency target until the confirmed day-type layer places them. The day compiler owns concrete occurrence IDs; the category module does not emit them.

Oil assignments reuse the shared `PlanRoleAssignment.activeUsageIds` and `ProductChoiceState` contracts rather than introducing Oil-specific lifecycle labels. Oil allows at most one assigned usage per role in V1, so `activeUsageIds` has length zero or one. An unresolved role has no active usage or recommended product and uses `not_selected`; shopping/pending/override states retain their existing shared meaning.

## Regression fixture contract

Use one parameterized rule-table matrix that exercises every Oil role-rule row and asserts its stable rule ID, local tier, final tier, and evidence references. Add the following named interaction and boundary fixtures at `tests/personal-plan/categories/oil.test.ts`. Run them with `npx tsx --test tests/personal-plan/categories/oil.test.ts`. The implementation also extends `npm run test:node` to include `tests/personal-plan/categories/*.test.ts`; `npm run ci:verify` does not execute Node tests, so readiness requires both commands.

1. `oil-fine-low-shine`: fine, otherwise healthy, observed low shine -> dry finish `basis`, light target, every-wash finish occurrence;
2. `oil-fine-healthy-frizz`: healthy/manageable fine hair with frizz only -> damp smoothing `basis`, dry finish `optional`, no automatic pre-wash role;
3. `oil-treated-dry-rough`: coarse, materially treated, dry and rough -> pre-wash `basis`, damp and dry support `optional`;
4. `oil-definition-only`: wavy/curly shape-definition goal or lost shape without an Oil job -> all Oil roles `not_needed`, Styling ownership retained;
5. `oil-fine-owned-rich-trial`: fitting owned rich leave-on Oil for fine hair -> `supportive` with minimal-dose adjustment, not an immediate forced replacement;
6. `oil-fine-rich-persists`: overload persists at the correct minimal dose -> `mismatch` and exact lighter alternative;
7. `oil-thickness-exclusion`: failed `suitableThicknesses` -> `mismatch` regardless of benefits or ownership;
8. `oil-pending-basis`: pending owned product remains visible and excluded from recipes; one verified alternative covers the unresolved Basis role;
9. `oil-scalp-use-only`: scalp-use answer remains inventory context and produces no Oil recipe;
10. `oil-one-product-multiple-roles`: one verified product covers pre-wash plus dry finish and is assigned to both occurrences;
11. `oil-separate-role-products`: different best products fill pre-wash and finish; Stage 2 orders them by earliest role without primary/secondary labels and Stage 3 places both chronologically;
12. `oil-no-heat-credit`: otherwise ideal Oil without verified Heat protection remains ideal for its Oil role but cannot cover the Heat occurrence;
13. `oil-prewash-heavy-allowed`: rich/heavy verified pre-wash Oil is not penalized by leave-on weight;
14. `oil-product-protocol`: verified exact-product directions override the relevant category application fallback;
15. `oil-load-sensitive-weight`: `low_volume_or_weighed_down` selects the lightest normally ideal weight per thickness: fine/normal -> `light`, coarse -> `medium`; heavier options are demoted and coarse `light` remains adjacent rather than ideal;
16. `oil-two-basis-roles`: uncomplicated shine plus frizz may retain dry-finish and damp-smoothing Basis roles; aggregate tier is Basis and one valid multi-role product is preferred without suppressing either job;
17. `oil-safety-suppression`: a shared allergy/exclusion or adverse response suppresses assignment and emits the correct safety fact;
18. `oil-no-valid-candidate`: no ideal/supportive verified candidate leaves the role unresolved with `Empfehlung wird geprüft` rather than promoting mismatch/unknown;
19. `oil-deterministic-recompute`: identical versioned profile, inventory, catalog, and explicit choices produce byte-stable Oil facts and assignments;
20. `oil-breakage-alone`: breakage without chemical treatment or brittle snapping -> pre-wash `optional`, never self-corroborated through the combined structural score;
21. `oil-breakage-chemical-confirmed`: breakage plus a non-natural chemical treatment -> pre-wash `basis` with the shared chemical driver in its reasoning facts;
22. `oil-breakage-snap-confirmed`: breakage plus `elasticResponse = snaps` -> pre-wash `basis` even without chemical treatment;
23. `oil-scalp-concern-with-length-job`: scalp irritation or oily scalp plus independently valid low-shine lengths -> retain dry finish, keep placement on lengths/ends, and emit no scalp-treatment claim;
24. `oil-adverse-scalp-response`: a confirmed Oil-related scalp breakout, irritation, allergy, or shared safety exclusion -> suppress that product assignment and emit stop/reassessment guidance;
25. `oil-coily-frizz-layer`: coily texture plus frizz concern/goal -> Leave-in remains Basis and damp Oil is also Basis after Leave-in; coily texture alone still creates no Oil role.
26. `oil-three-basis-roles`: independently corroborated pre-wash vulnerability plus coily/frizz damp smoothing plus observed low shine -> all three roles remain `basis`; assignment minimizes bottles only when one product fully fits several roles, and Stage 3 retains all three chronological occurrences.

The parameterized matrix explicitly includes `oil.dry_finish.shine_goal_support`, `oil.pre_wash_fibre_treatment.structural_exposure_only`, `oil.pre_wash_fibre_treatment.goal_corroborated`, and `oil.leave_on_fibre_conditioning.tangling_support`; do not duplicate those simple rows as bespoke fixtures.

Shared portfolio tests additionally compare competing category targets for the same job: Leave-in-only anti-frizz coverage, Oil retaining uncovered anti-frizz ownership, the coily two-layer exception, exact-product failure without Stage-1 re-arbitration, and equal-coverage tie-breaking by fewer products. These tests assert that product minimization never defeats stronger target fit or required functional coverage.

Shared portfolio/versioning tests—not this category module—own optional opt-in, purchase-link non-mutation, acquisition, informed override, and proposed-successor delta behavior. Keep the Oil role IDs in those shared fixtures where useful, but do not reimplement the lifecycle inside Oil.

## Pre-launch dependencies

- the later day-type specification must confirm optional wash-day allocation and the shared Oil/Leave-in non-wash bridge-care occurrence before global Personal Plan activation; this is sequencing, not a post-launch omission;
- catalog backfill for exact supported roles, weight, benefits, Heat protection, and application protocols;
