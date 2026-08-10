---
category: bondbuilder
document_type: decision
status: confirmed
decision_version: 2
last_reviewed_at: 2026-08-09
current_main_revision_reviewed: f245db8e
production_schema_reviewed_at: 2026-08-06
evidence_file: docs/personal-plan/categories/bondbuilder/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/bondbuilder.ts
test_surface: tests/personal-plan/categories/bondbuilder.test.ts
---

# Personal Plan Bondbuilder decision

## Authority and current status

This document is the confirmed implementation specification for the Personal Plan Bondbuilder category. It follows `docs/personal-plan/categories/category-design-framework.md`. External evidence is isolated in `evidence.md`; current CareBalance, recommendation-engine, Routine, Chat, and catalog behavior are prior art only.

The category-owned policy is complete. Shared Stage-2 lifecycle UI, shared day-type scheduling UI, shared reason-card salience, and structured protocol backfill remain named dependencies or launch gates rather than category blockers.

## Category charter

Bondbuilder is a specialized, protocol-specific treatment for materially compromised hair, especially after strong chemical processing or when several independent strong damage indicators are present. Its purpose is to support the strength and resilience of stressed hair fibre; it is not ordinary daily conditioning.

Stage ownership:

- **Stage 1:** decide `basis | optional | not_needed`, emit the target type and function, and set total cadence to the product-directed course contract.
- **Stage 2:** evaluate every exact owned, pending, or candidate Bondbuilder; select one primary; surface format differences; reconcile keep, shopping, inactive, and override states.
- **Stage 3:** compile only the confirmed in-hand primary using its exact verified product protocol and course cadence.

Non-jobs and exclusions:

- ordinary moisture, softness, frizz control, shine, detangling, or baseline length care;
- Heat protection or prevention of damaging handling;
- treatment of scalp symptoms or hair loss;
- diagnosis of broken bonds, protein deficiency, or structural damage;
- repair of existing split ends or guaranteed permanent reconstruction;
- automatic replacement of Conditioner, Leave-in, Mask, or trimming;
- treating generic “protein,” “repair,” or “strengthening” marketing as Bondbuilder proof.

## Current-behavior treatment

| Area | Current truth | Treatment | Gap or implication |
|---|---|---|---|
| Lossless quiz input | Current `main` and production V3 preserve `hair_damage`, `breakage`, and `split_ends` separately; the source planning worktree is intentionally stale here and still contains historical V2 `breakage_or_split_ends` | `reuse` V3; migrate V2 to `split_ends` only at the historical boundary | Never treat this worktree's stale V2 source as production truth, collapse V3, or consume the lossy offer/canonical projection |
| Shared damage model | Current `DamageAssessment` has structural, heat, and mechanical lanes plus repair and Bondbuilder priorities | `adapt` into plan-owned `PlanDamageAssessment` | One shared assessment; no Bondbuilder-only damage score |
| Legacy inclusion | Intervention/CareBalance logic uses `bondBuilderPriority` and product/request-dependent relevance | `reject` as Stage-1 authority | Need is independent of ownership, request, and product availability |
| Legacy target | User profile is split into chemical-crosslink and peptide lanes | `reject` | Mechanism is not a person-side target |
| Legacy fit | Intensity-only fit can yield `ideal`; selector adds mechanism-lane score | `reject` | Exact fit requires role, lifecycle, strict suitability, and protocol; mechanism does not rank |
| Catalog lifecycle | `active/discontinued`, `replaced_by`, and `add_on_for` exist and have tests | `reuse` | Standalone primary eligibility remains distinct from companion status |
| Bondbuilder specs | Intensity, application mode, mechanism axis, treatment mode, format, and protocol enum exist | `adapt` | Descriptive facts are useful; the enum/prose hint is not an executable structured protocol |
| Product selector | Owned products can remain assessable; discontinued/replaced and add-on rows are excluded from primary recommendations | `reuse/adapt` | Keep lifecycle behavior, remove automatic mechanism routing and severe-case add-on promotion |
| Multiple products | Current engine can show several products but does not own the confirmed one-primary policy | `missing` | Stage 2 must require a primary when several are owned |
| Plan runtime/test | No plan-owned Bondbuilder module or category fixture suite exists | `missing` | Implement only under `src/lib/personal-plan/**` after Stage-1 prerequisites pass |

## Canonical inputs and missing-data behavior

Stage 1 consumes only lossless person facts that can change tier or explanation:

- `chemicalTreatments[]`: `colored | lightened | permed | chemically_straightened | natural`;
- `currentConcerns[]`: `hair_damage`, `breakage`, and supporting-only `split_ends`;
- `hairSurface`: `rough` is corroborating-only context and never qualifies or escalates a tier by itself;
- `elasticResponse`: `snaps` is a strong indicator; `stretches_stays` is context only;
- `goals`: `strength_ends` is context only;
- shared `PlanDamageAssessment` lane facts, drivers, confidence, and missing inputs for deduplication and plan-wide explanation.

The plan profile preserves quiz-native `lightened`. When parity logic is copied from the existing damage assessment, the plan-owned adapter maps it explicitly to the legacy `bleached` driver; that internal rename never changes the saved source fact or customer-facing reason.

Do not consume thickness, density, length, texture, volume sensitivity, product ownership, current Bondbuilder frequency, budget, exclusions, or format preference for Stage-1 need. They belong to product selection, application, or explanation and never create inherent need.

Input semantics:

- Current V3 separate concerns are authoritative.
- Historical V2 `breakage_or_split_ends` migrates deterministically to `split_ends`. This intentionally chooses the less escalatory interpretation: it adds supporting context but never becomes a strong Bondbuilder indicator. The accepted limitation is that genuine historical breakage may be under-prioritized; V3 facts are never changed by this migration.
- An explicitly empty V3 concern list is valid and contributes no indicators.
- Missing required chemical-treatment, surface, elasticity, or concern data after validation returns the shared typed incomplete-profile/clarification state; do not guess.
- `chemicalTreatments = ['natural']` means no declared chemical-treatment trigger. Invalid mixtures containing `natural` plus a treatment are rejected by shared validation.
- Missing Stage-2 product facts do not change Stage-1 tier.

## Stage 1 inclusion and need tier

### Strong observed indicators and corroborating context

Count each distinct canonical fact once:

1. `currentConcerns` contains `breakage`;
2. `currentConcerns` contains `hair_damage`;
3. `elasticResponse = snaps`.

`hairSurface = rough` is corroborating-only. It may be emitted beside a qualifying independent observation such as `breakage`, but it cannot create an optional route alone, satisfy a chemical-plus-damage rule, or count toward the two-indicator Basis rule. `split_ends`, `strength_ends`, `stretches_stays`, Heat exposure, and a derived `repairPriority` are also not additional strong indicators. A derived assessment cannot corroborate a raw fact that created it.

`hairSurface = slightly_uneven` retains the shared assessment's moderate structural contribution but is deliberately not a strong Bondbuilder inclusion indicator. Assessment parity and category eligibility therefore remain separate, explicit decisions.

### Deterministic tier mapping

| Rule ID | Exact trigger | Tier | Confidence |
|---|---|---|---|
| `bondbuilder.inclusion.lightened` | `chemicalTreatments` contains `lightened` | `basis` | calibrated product policy |
| `bondbuilder.inclusion.chemical_straightening` | contains `chemically_straightened` | `basis` | calibrated product policy |
| `bondbuilder.inclusion.colored_and_permed` | contains both `colored` and `permed` | `basis` | calibrated product policy |
| `bondbuilder.inclusion.colored_with_damage` | contains `colored` and at least one qualifying strong observed indicator | `basis` | calibrated product policy |
| `bondbuilder.inclusion.permed_with_damage` | contains `permed` and at least one qualifying strong observed indicator | `basis` | calibrated product policy |
| `bondbuilder.inclusion.two_strong_indicators` | at least two distinct strong observed indicators | `basis` | calibrated non-chemical route |
| `bondbuilder.inclusion.colored_only` | contains `colored`; no Basis rule matches | `optional` | calibrated product policy |
| `bondbuilder.inclusion.permed_only` | contains `permed`; no Basis rule matches | `optional` | calibrated product policy |
| `bondbuilder.inclusion.one_strong_indicator` | exactly one strong observed indicator; no Basis rule matches | `optional` | calibrated non-chemical route |
| `bondbuilder.inclusion.no_job` | no Basis or optional rule matches | `not_needed` | deterministic fallback |

Precedence and deduplication:

1. any Basis rule wins;
2. otherwise any optional rule wins;
3. otherwise `not_needed`;
4. one chemical treatment contributes once even when it also helped create shared repair priority;
5. a high `repairPriority` plus `breakage` is still one underlying indicator when breakage created that priority;
6. `breakage + split_ends` remains exactly one strong indicator and therefore `optional` without another rule;
7. `rough` alone is `not_needed`; `rough + breakage` remains one strong indicator and therefore `optional`;
8. severe Heat alone does not create Basis or optional Bondbuilder need; Heat protection and source control remain primary;
9. ownership never changes the need tier.

The chemical proxy weights used by `PlanDamageAssessment` remain conservative and capped: one `colored` or `permed` stressor contributes `2`; `colored + permed` contributes `3`, not `4`; `chemically_straightened` contributes `3`; and quiz-native `lightened` maps to the legacy `bleached` lane at `4` and takes precedence. These are not calibrated damage measurements and not a second Bondbuilder threshold.

## Stage 1 target and presentation

Bondbuilder has one semantic role in V1:

```ts
type BondbuilderRole = 'specialized_bond_treatment'
type BondbuilderCadenceMode = 'product_protocol_course'
```

Target output:

- category: `Bondbuilder`;
- type label: `Bond-Kur`;
- concise function copy: `Stärkt beanspruchte Verbindungen im Haar`;
- required internal function: `support_stressed_hair_resilience`;
- cadence mode: `product_protocol_course`;
- cadence copy: `Nach Produktprotokoll`.

The target is mechanism-neutral. `disulfide_crosslink` and `peptide_chain` remain descriptive exact-product facts and never become person-side roles, required functions, or user-damage diagnoses.

Stage 1 does not target formula weight, protein/moisture direction, mechanism, treatment mode, or product format. The V1 product-weight hypothesis is explicitly rejected; fine hair and `low_volume_or_weighed_down` do not rank or demote a Bondbuilder.

## Structured Stage-1 reason facts

Emit all matching facts deterministically; the shared presentation pass chooses at most two decisive facts for the collapsed card.

| Reason fact | Source | Role |
|---|---|---|
| `bondbuilder.reason.lightened` | `lightened` | decisive Basis trigger |
| `bondbuilder.reason.chemical_straightening` | `chemically_straightened` | decisive Basis trigger |
| `bondbuilder.reason.colored_and_permed` | both treatments | decisive Basis trigger |
| `bondbuilder.reason.colored` | `colored` | decisive optional or Basis context |
| `bondbuilder.reason.permed` | `permed` | decisive optional or Basis context |
| `bondbuilder.reason.breakage` | `breakage` | strong observed indicator |
| `bondbuilder.reason.hair_damage` | `hair_damage` | strong observed indicator |
| `bondbuilder.reason.rough_surface` | `rough` | corroborating-only detail; never decisive or tier-changing |
| `bondbuilder.reason.snaps` | `snaps` | strong observed indicator |
| `bondbuilder.reason.split_ends_context` | `split_ends` | supporting-only context; never decisive |
| `bondbuilder.reason.strength_goal_context` | `strength_ends` | explanation-only context |
| `bondbuilder.reason.heat_prevention_primary` | material Heat without independent route | plan-wide boundary/context |

Reason facts preserve canonical source identity and whether each fact actually changed the tier. Final two-fact salience and German reason templates remain a shared dependency, consistent with Conditioner, Leave-in, and Mask.

## Adjacent-category ownership

- **Conditioner** remains baseline post-shampoo length care and regular repair support. Bondbuilder never removes its category need; an exact Bondbuilder protocol may alter Conditioner order or omit it for one treatment occurrence.
- **Leave-in** owns persistent post-wash care and may support repair, but never claims primary structural repair. K18-like protocol treatments belong to Bondbuilder even though they remain in the hair.
- **Mask** owns periodic intensive ordinary conditioning. Bondbuilder owns specialized protocol treatment. The same raw damage facts may make both categories relevant under their own confirmed rules, but each module consumes the shared facts once and must not add derived scores together.
- **Heat protectant** and behavior guidance own prevention for Heat exposure. Heat alone does not turn Bondbuilder into Basis.
- **Oil** may reduce friction or support pre-wash/finishing care but does not satisfy the Bondbuilder role.
- **Trimming** remains the durable response to existing split ends.

Bondbuilder is complementary, not a default substitute. Product-count minimization never removes a legitimate baseline or intensive-care job merely because one product advertises several benefits.

## Cadence and occurrence ownership

Bondbuilder is the deliberate category exception whose exact total cadence is product-protocol-directed:

| Rule ID | Condition | Decision |
|---|---|---|
| `bondbuilder.cadence.stage1_protocol` | tier is `basis` or accepted `optional` | Emit symbolic total cadence `product_protocol_course`; do not invent a universal weekly number. |
| `bondbuilder.cadence.bind_primary` | one confirmed in-hand primary has a verified protocol | Bind the category total to that exact product's verified initial/maintenance course. |
| `bondbuilder.cadence.cover_total` | a primary is bound | Assign the complete category course to that one primary; no rotation or split. |
| `bondbuilder.cadence.no_product` | product is shopping, pending, or no primary is selected | Keep the need/proposal visible but compile zero executable occurrences. |
| `bondbuilder.cadence.protocol_gap` | critical course facts are missing | Return a visible protocol-data gap and compile zero precise occurrences. |
| `bondbuilder.cadence.successor` | selected primary or bound course changes | Create a proposed successor plan and require confirmation. |

Current reported product frequency remains an inventory fact and never becomes the recommended course. Tier expresses how important the category is; it does not rewrite the selected product's verified directions.

There is no universal V1 reassessment date. When the verified protocol has an initial and maintenance phase, its phase boundary may create a product-directed reassessment prompt. The shared check-in UI and successor-plan mechanics are deferred; any cadence change remains proposed until confirmed.

## Multiple products and primary selection

- Users may upload and retain several Bondbuilders.
- Evaluate every owned or submitted product independently.
- Exactly one confirmed primary receives the complete category cadence and compiles into Stage 3.
- If several are owned and no primary is saved, return `primary_selection_required`; a full ranking is unnecessary.
- Other fitting owned products remain visible as unassigned alternatives. They receive no cadence and do not enter recipes.
- Do not invent K18/OLAPLEX rotation, complementary mechanism coverage, or a per-product split.
- Changing the primary creates a proposed successor plan and requires confirmation.
- Pending, shopping, declined, inactive, and override products remain visible through shared lifecycle mechanics but never silently enter executable steps.

## Canonical product facts and semantics

The shared product identity/lifecycle record plus a canonical Bondbuilder spec must provide:

| Fact | Required meaning | Missing semantics |
|---|---|---|
| resolved identity/category | exact reviewed standalone Bondbuilder or companion | unresolved/pending = `unknown` |
| lifecycle and relationships | `active`, `discontinued`, `replaced_by`, `add_on_for` | missing lifecycle/relationship audit = `unknown` |
| safety/exclusions | verified product/user conflict facts | known conflict = `mismatch`; unverified strong gate = `unknown` |
| `suitableThicknesses` | verified non-empty suitability array | `null`/missing = `unknown`; `[]` invalid for active recommendation; exclusion = `mismatch` |
| `bondRepairIntensity` | descriptive `maintenance | intensive` | missing = data gap; not a V1 person-side ranking axis |
| `applicationMode` | `pre_shampoo | post_wash_leave_in` | missing = critical protocol/format gap |
| `treatmentMode` | `rinse_out | leave_in` | missing = critical protocol gap |
| `productFormat` | verified format | missing prevents format-preference selection but not need computation |
| `bondRepairAxis` | descriptive mechanism vocabulary | missing does not reduce person fit; never inferred from name or ingredient |
| exact structured protocol | source-backed application, order, timing, course, and Conditioner interaction | missing critical fields = `unknown` for executable primary |

The current `usage_protocol` enum may migrate as a product-family identifier, but the prose helper is not a structured executable protocol. Finished-product identity and manufacturer directions are required; do not infer protocol from format, brand family, mechanism, or treatment mode.

## Stage 2 role-relative fit

Evaluate every product through these layers:

### Layer 1 — safety and strict eligibility

- resolved reviewed identity;
- active lifecycle for a new primary recommendation;
- no `replaced_by` outgoing relationship;
- no verified safety, exclusion, or suitable-thickness conflict;
- `suitableThicknesses` contains the user's thickness.

### Layer 2 — standalone role

- a standalone Bondbuilder can fill `specialized_bond_treatment`;
- an `add_on_for` product is companion-only and cannot fill the primary role alone;
- a generic Mask, Leave-in, protein product, or “repair” product without verified Bondbuilder identity is a role mismatch.

### Layer 3 — protocol completeness

- application state/stage, rinse mode, Conditioner relationship, waiting/contact time, and course cadence are critical;
- amount may use only a safe non-numeric label fallback when the official directions genuinely permit it; never fabricate pumps or grams;
- missing critical protocol keeps the product visible but out of precise recipes.

Aggregate verdict:

| Engine result | German verdict | Exact rule |
|---|---|---|
| `ideal` | `passt sehr gut` | Strict gates pass; product is an active standalone Bondbuilder; critical exact protocol is verified. |
| `supportive` | `passt mit Einschränkung` | Product is a verified companion/add-on for the selected primary but cannot cover the role alone. |
| `mismatch` | `wechseln empfohlen` | Verified safety/thickness conflict, wrong category/role, discontinued/replaced primary, or another known strict conflict. |
| `unknown` | `noch in Prüfung` | Identity/pending state, strict suitability, lifecycle audit, or critical protocol is unresolved. |

Precedence is known safety stop; unresolved identity/pending; lifecycle/relationship; strict thickness/exclusion; role; critical protocol; supportive companion; ideal. Every verdict retains its exact facts and limitation.

Need and fit remain separate. A fitting owned product at `not_needed` is “not necessary but compatible”: Stage 2 may offer removal or informed continuation. “Not recommended” is reserved for an actual mismatch or safety issue. Exact reusable UI/state transitions remain owned by the shared Stage-2 specification.

## Stage 2 exact recommendation and format preference

The current launch set contains three equally eligible primary concepts when all gates and exclusions pass:

- Epres Bond Repair Treatment — pre-shampoo spray;
- K18 Leave-In Molecular Repair Hair Mask — post-wash leave-in treatment;
- OLAPLEX Nº.3PLUS Complete Repair Treatment — pre-shampoo cream.

Selection rules:

1. filter safety, lifecycle, strict suitability, role, availability, and critical protocol gaps;
2. preserve an already-saved primary while it remains ideal and the user's preference has not changed;
3. when the user expresses a format/application preference, prefer the ideal product matching `applicationMode + productFormat`;
4. otherwise return the remaining ideal products as an equal shortlist; do not manufacture a winner;
5. mechanism, treatment marketing, damage type, product weight, formula richness, claimed repair pathway, and price do not rank the shortlist in V1;
6. budget may remove unavailable choices but does not make a surviving product intrinsically better;
7. if no ideal product survives, return `Empfehlung wird geprüft`; never promote supportive, mismatch, or unknown as the confident standalone recommendation.

Stage 2 may describe a product as pre-shampoo spray, pre-shampoo cream, or post-wash leave-in treatment. Exact “when and how” instructions remain Stage 3.

OLAPLEX Nº.0 is a verified `add_on_for` companion, not a primary. It is not automatically added for severe damage. The discontinued legacy Nº.3 row is not primary-eligible when its replacement relationship is active; lifecycle authority wins over stale recommendation flags.

## Stage 3 occurrence and application boundary

There is no generic Bondbuilder application fallback. A precise occurrence requires the selected in-hand primary and its verified exact protocol.

Required structured protocol fields:

```ts
interface BondbuilderProtocol {
  protocolKey: string
  applicationStage: 'pre_shampoo' | 'post_shampoo'
  hairState: 'dry_unwashed' | 'wet' | 'towel_dried'
  placement: 'lengths_and_ends' | 'product_directed'
  amountGuidance: string | null
  waitSeconds: number | null
  rinseMode: 'rinse' | 'leave_in'
  conditionerSequence:
    | 'normal_after_treatment_wash'
    | 'omit_conditioner_before_treatment'
    | 'product_directed'
  initialCourse: {
    eventCountMin: number | null
    eventCountMax: number | null
    frequency: string
  } | null
  maintenanceCourse: string | null
  maximumFrequency: string | null
  incompatibleSameDayCategories: string[]
  sourceUrl: string
  verifiedAt: string
}
```

Compilation rules:

- pre-shampoo protocols attach to an `intensive_care_wash`; they do not create an extra Shampoo wash;
- post-shampoo treatment protocols attach to an eligible wash in their verified order;
- the exact protocol controls dry/wet/towel-dried state, placement, distribution, amount, wait/contact time, rinse/leave-in behavior, Shampoo/Conditioner sequence, and initial/maintenance cadence;
- if Mask and Bondbuilder protocols are incompatible, compile separate stable intensive-care recipe variants without increasing the total wash budget;
- only `owned_active`, `owned_override`, or confirmed acquired products may compile;
- an informed override remains visibly limited and still requires a complete protocol;
- missing critical protocol or missing primary produces no precise executable step.

Current official protocol examples are retained in `evidence.md` for research provenance. They must be represented as structured, reviewed product facts before launch rather than parsed from prose at runtime.

## Safety, response, and overclaim boundaries

- Known reactions or safety conflicts precede optimization and trigger stop-use guidance.
- Sudden, unexplained, persistent, or worsening breakage/hair loss routes to cautious professional guidance rather than a stronger cosmetic recommendation.
- Existing split ends are not repaired; trimming and prevention remain the durable response.
- Do not diagnose broken bonds, porosity, protein deficiency/overload, or chemical damage from quiz observations.
- Do not claim permanent reconstruction, “repair from within,” permanent cuticle sealing, guaranteed prevention of future breakage, or biological repair.
- Do not generalize all protein, peptide, acid, amino-acid, or “repair” products into Bondbuilder efficacy.
- Product mechanism and manufacturer claims require exact finished-product provenance and never substitute for role/protocol verification.
- Heavy, coated, stiff, dry, brittle, or more tangled response triggers pause and product/protocol reassessment; do not diagnose the cause.
- Heat reduction and verified Heat protection remain primary for Heat exposure.

## Deterministic rule-to-fixture contract

Every hard rule above maps to at least one fixture:

1. `bondbuilder-lightened-basis`: lightened, no observed indicator → `basis`, protocol-directed cadence.
2. `bondbuilder-straightened-basis`: chemically straightened → `basis`.
3. `bondbuilder-colored-only`: colored only → `optional`.
4. `bondbuilder-permed-only`: permed only → `optional`.
5. `bondbuilder-colored-permed`: colored + permed → `basis`.
6. `bondbuilder-colored-breakage`: colored + breakage → `basis`.
7. `bondbuilder-permed-rough`: permed + rough surface → `optional`; roughness does not satisfy the chemical-plus-damage rule.
8. `bondbuilder-breakage-only`: breakage only → `optional`.
9. `bondbuilder-breakage-rough`: breakage + rough surface → `optional`; roughness corroborates without counting twice.
10. `bondbuilder-hair-damage-snaps`: hair damage + snapping → `basis`.
11. `bondbuilder-breakage-split`: breakage + split ends → `optional`; split is supporting-only.
12. `bondbuilder-split-only`: split ends only → `not_needed`.
13. `bondbuilder-strength-goal-only`: strength/ends goal only → `not_needed` with context fact only.
14. `bondbuilder-stretches-stays-only`: no tier effect.
15. `bondbuilder-severe-heat-only`: `not_needed`; Heat protection reason remains primary.
16. `bondbuilder-high-repair-dedup`: high repair priority derived from breakage plus that same breakage → one strong indicator, `optional`.
17. `bondbuilder-v2-combined-migration`: historical combined concern → `split_ends`; supporting context only and no strong indicator.
18. `bondbuilder-lea-untreated-rough`: natural, untreated, rough surface, no breakage/hair damage/snapping → `not_needed`, no Stage-1 card, and no chemical-stress copy.
19. `bondbuilder-missing-required-profile`: typed incomplete-profile state.
20. `bondbuilder-equal-shortlist`: Epres, K18, and Nº.3PLUS all pass with no preference → equal ideal shortlist.
21. `bondbuilder-format-preference`: verified pre-wash spray preference selects Epres from otherwise equal ideal candidates.
22. `bondbuilder-mechanism-neutral`: peptide/crosslink values do not change person fit or rank.
23. `bondbuilder-weight-ignored`: fine/volume-sensitive profile does not rank or demote the same eligible candidates.
24. `bondbuilder-addon-supportive`: Nº.0 is supportive companion and cannot fill primary alone.
25. `bondbuilder-discontinued-replaced`: legacy Nº.3 is mismatch/not primary-eligible despite stale flags.
26. `bondbuilder-pending-product`: visible `unknown`, excluded from recipe.
27. `bondbuilder-missing-protocol`: core role retained as unknown; no executable occurrence.
28. `bondbuilder-no-valid-candidate`: return `Empfehlung wird geprüft`.
29. `bondbuilder-two-owned-primary-required`: both visible/evaluated; no recipe until one primary is selected.
30. `bondbuilder-two-owned-one-primary`: primary receives complete course; other remains unassigned; no rotation.
31. `bondbuilder-owned-not-needed-continue`: need remains `not_needed`; fitting product may remain only through informed continuation.
32. `bondbuilder-owned-mismatch-override`: limitation persists and protocol must still be complete.
33. `bondbuilder-shopping-no-recipe`: recommendation visible; no execution before acquisition confirmation.
34. `bondbuilder-acquired-successor`: acquisition/primary binding previews a successor and requires confirmation.
35. `bondbuilder-k18-protocol`: exact no-Conditioner/wait/leave-in course compiles from verified facts.
36. `bondbuilder-olaplex-protocol`: exact pre-shampoo/rinse/Shampoo/Conditioner course compiles.
37. `bondbuilder-epres-protocol`: exact dry-unwashed spray/wait/wash course compiles.
38. `bondbuilder-mask-incompatible`: separate intensive-care variants; total wash cadence unchanged.
39. `bondbuilder-adverse-reaction`: optimization suppressed and stop-use guidance emitted.
40. `bondbuilder-stable-recompute`: unchanged facts retain tier, equal-shortlist status, and saved ideal primary.

## Catalog, data, implementation, and launch gates

### Current catalog orientation

Read-only live inspection on 2026-08-06 established:

- Epres Bond Repair Treatment, K18 Leave-In Molecular Repair Hair Mask, and OLAPLEX Nº.3PLUS Complete Repair Treatment are the active standalone primary set and currently pass all-thickness suitability;
- OLAPLEX Nº.0 is an `add_on_for` companion;
- legacy OLAPLEX Nº.3 is discontinued/replaced and must not remain primary-eligible;
- all three active primaries are currently `intensive`; this does not establish a person-side intensity-routing rule.

### Gates

1. Implement the V3 lossless adapter and the explicit historical migration `breakage_or_split_ends -> split_ends`; never apply that migration to V3 or use the lossy offer/canonical projection.
2. Copy/adapt the shared damage assessment into `src/lib/personal-plan/**` with parity tests and raw-fact deduplication.
3. Audit `product_bondbuilder_specs` and all active Bondbuilder rows against canonical field/null semantics.
4. Create a new selector inside `src/lib/personal-plan/**` that preserves lifecycle/relationship authority without mechanism-lane, intensity-only, auto-add-on, or marketing-score routing. Do not change the legacy recommendation selector as part of this category implementation.
5. For Stage 3, create or extend the shared structured product-protocol authority and backfill verified executable protocols for Epres, K18, and Nº.3PLUS. This is not a Stage-1 policy or engine prerequisite.
6. Synchronize schema, generated types, validators, intake/admin readers, catalog selectors, and tests for any protocol-model change.
7. Add the plan-owned module and every fixture above at `tests/personal-plan/categories/bondbuilder.test.ts`.
8. Add cross-category fixtures for Conditioner retention, Leave-in supporting-only repair, Mask/Bondbuilder non-double-counting, Heat-prevention precedence, and incompatible intensive-care recipes.
9. Keep exact Stage-2 lifecycle transitions and shared check-in UI in their shared specifications; verify Bondbuilder state behavior there before launch.
10. Apply the V2 migration once in the shared lossless normalization boundary so every category consumes the same migrated `split_ends` fact; do not duplicate category-local migration logic.
11. Keep the paid-user feature flag off until the relevant stage's modules, portfolio fixtures, data gates, and reviewed journey gates pass. Stage-1 confirmation and engine implementation do not wait for Stage-3 protocol rows; executable Stage-3 launch does.

## Deferred shared dependencies

- final two-fact reason salience and German reason templates across all categories;
- generic owned/pending/shopping/acquired/declined/override transitions and their UI;
- shared primary-selection and proposed-successor confirmation mechanics;
- day-type shell, schedule placement, check-in UI, and recipe rendering;
- final cross-category primary/supporting function ownership matrix.

These are implementation or launch dependencies, not unresolved Bondbuilder product-policy choices.

## Stop-gate result

Category policy is confirmed: charter, inputs, tiers, precedence, target, cadence, multiple-product behavior, product fact semantics, fit verdicts, selection, Stage-3 protocol boundary, safety, reason facts, fixtures, and gates are explicit. No category-local blocker remains.

The category is not implementation-ready or launch-ready by itself. Stage-1 implementation still waits for all prerequisite category checkpoints and the shared living-plan gates; Stage 3 additionally waits for structured protocol backfill.
