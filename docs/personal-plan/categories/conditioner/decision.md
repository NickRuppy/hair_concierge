---
category: conditioner
document_type: decision
status: confirmed
decision_version: 1
last_reviewed_at: 2026-08-03
evidence_file: docs/personal-plan/categories/conditioner/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/conditioner.ts
test_surface: tests/personal-plan/categories/conditioner.test.ts
---

# Personal Plan Conditioner decision

## Authority

This document is the confirmed implementation specification for Conditioner-specific behavior. The final cross-category ownership matrix and shared presentation rules remain deliberately deferred until all categories are specified. After implementation, the Personal Plan Conditioner module, tests, and verified catalog/protocol data become runtime authority.

## Intended user decision

The Personal Plan should tell the user:

- whether rinse-out Conditioner belongs in their Bedarfsplan;
- what formula weight, care direction, and repair support they need;
- how often the Conditioner need occurs;
- whether each owned Conditioner fits;
- which product or confirmed rotation covers the need;
- how to apply the selected product safely and precisely.

## Confirmed inclusion

| Rule ID | Condition | Need tier |
|---|---|---|
| `conditioner.inclusion.length_basis` | Hair length is `short`, `medium`, `long`, or `very_long` | `basis` |
| `conditioner.inclusion.very_short_optional` | Hair is `very_short` and a material length-care signal exists | `optional` |
| `conditioner.inclusion.very_short_not_needed` | Hair is `very_short` without a material length-care signal | `not_needed` |

Very short hair is not an automatic basis case. The following deterministic threshold is confirmed.

For `very_short`, return `optional` when either condition is true:

1. at least one strong care signal exists; or
2. at least two supporting care signals exist.

Strong care signals:

- `hairSurface = rough`;
- `currentConcerns` contains `dry_lengths`, `tangling`, `hair_damage`, `breakage`, or `split_ends`;
- `elasticResponse = snaps`;
- `chemicalTreatments` contains `lightened`, `permed`, or `chemically_straightened`.

Supporting care signals:

- `hairSurface = slightly_uneven`;
- `elasticResponse = stretches_stays`;
- `chemicalTreatments` contains `colored`;
- `texture` is `curly` or `coily`;
- `currentConcerns` contains `frizz_flyaways`;
- `goals` contains `moisture`, `frizz_surface`, `strength_ends`, or `shape_definition`.

Deduplicate repeated evidence for the same underlying answer before counting. Thickness, density, scalp inputs, shine, low-volume/weighed-down concern, and `volume_balance` alone do not trigger inclusion; they may influence target type or another category after Conditioner is included. Product ownership never changes the need tier.

## Target product profile

Conditioner target fit has three independent axes:

1. `weight`: `light | medium | rich`;
2. `balance`: `moisture | balanced | protein`;
3. `repairLevel`: `low | medium | high`.

A light Conditioner may still have high repair support. Repair need must not automatically make the recommended formula heavier.

### Weight

| Rule ID | Inputs | Decision |
|---|---|---|
| `conditioner.weight.thickness` | fine / normal / coarse hair diameter | Start at light / medium / rich respectively. |
| `conditioner.weight.volume_up` | Explicit `low_volume_or_weighed_down`, or `volume_balance` outside the control branch | Shift one level lighter. |
| `conditioner.weight.control` | `volume_balance` with coarse, curly/coily, or definition-led wavy hair | Shift one level richer. |
| `conditioner.weight.amount_not_formula` | Length or density changes | Adjust amount/distribution rather than formula weight by itself. |
| `conditioner.weight.no_shampoo_compensation` | Shampoo is too harsh | Correct the Shampoo or recipe; do not permanently compensate by making Conditioner richer. |

Deterministic precedence:

1. `thickness` sets the baseline: fine = `light`, normal = `medium`, coarse = `rich`.
2. Explicit `currentConcerns = low_volume_or_weighed_down` wins and shifts one level lighter.
3. Otherwise, if `goals = volume_balance`:
   - coarse, curly, or coily hair takes the control direction and shifts one level richer;
   - wavy hair takes the control direction only when `goals = shape_definition` or `currentConcerns = lost_shape` is also present;
   - all remaining profiles take the volume/lightness direction and shift one level lighter.
4. Clamp at `light` and `rich`; apply at most one shift.

Examples:

- fine + `volume_balance` = `light`;
- normal + `volume_balance` = `light`;
- normal + curly + `volume_balance` = `rich`;
- fine + curly + `volume_balance` = `medium`;
- normal + wavy + `volume_balance` = `light`;
- normal + wavy + definition + `volume_balance` = `rich`;
- coarse + explicit weighed-down concern = `medium`.

Density and length affect amount/distribution only. Damage, chemical treatment, surface, and elasticity affect balance/repair rather than formula weight. Shampoo cleansing intensity does not alter the permanent Conditioner weight target.

### Balance

Retain the home elasticity answer as a contextual heuristic, not a diagnosis:

- `stretches_stays`: protein-oriented signal;
- `snaps`: moisture-oriented signal;
- `stretches_bounces`: balanced signal.

Contextualize it with chemical treatment, surface condition, dryness, roughness, tangling, breakage, and goals. Conflicting or weak inputs produce a balanced/conservative direction rather than a false deficiency claim.

Count independent context groups, not repeated labels for the same answer:

- moisture context: `dry_lengths` or `tangling`; `frizz_flyaways`; `moisture` or `frizz_surface` goal; `rough` or `slightly_uneven` surface;
- protein/strength context: the structural-concern group (`hair_damage`, `breakage`, or `split_ends`); `strength_ends` goal; `lightened`, `permed`, or `chemically_straightened`; `colored` as supporting rather than decisive context.

Deterministic precedence:

1. `elasticResponse` is the anchor.
2. For `stretches_bounces`, move from `balanced` to one direction only when at least two independent context groups support that direction and fewer than two support the opposite direction; otherwise remain `balanced`.
3. For `snaps`, remain moisture-oriented unless at least two independent protein/strength context groups oppose it and no moisture context group corroborates it; then soften to `balanced`.
4. For `stretches_stays`, remain protein-oriented unless at least two independent moisture context groups oppose it and no protein/strength context group corroborates it; then soften to `balanced`.
5. Context may reinforce or neutralize the elasticity direction; it never flips directly from moisture to protein or from protein to moisture.
6. Missing elasticity is a required clarification rather than an inferred direction.

This output is a Conditioner care direction, not a diagnosis of moisture or protein deficiency.

### Repair

The current runtime `DamageAssessment` is the confirmed starting point, not a runtime dependency. The Personal Plan copies the useful rules into its plan-owned `PlanDamageAssessment` and tests parity deliberately.

Reuse these parts:

- separate structural, heat, and mechanical lanes;
- explicit scored levels and a derived repair priority;
- active damage drivers, protective factors, missing inputs, and confidence;
- the existing `repairPriority -> low | medium | high` Conditioner target shape;
- chemical-treatment and heat-exposure rules where the Personal Plan has equivalent lossless inputs.

Confirmed Personal Plan adaptation:

- Hair surface retains the runtime structural contribution: `smooth = 0`, `slightly_uneven = 2`, `rough = 4`.
- The current V3 concerns now map losslessly to the existing runtime strengths: `breakage = 4`, `hair_damage = 3`, and `split_ends = 2`; their combined contribution remains capped at `5`.
- Chemical treatments retain the existing capped contribution, with Personal Plan `lightened` mapped explicitly to the runtime bleach lane:
  - `natural = 0`;
  - `colored = 2`;
  - `permed = 2`;
  - `colored + permed = 3`;
  - `chemically_straightened = 3`;
  - `lightened = 4` and takes precedence over the lower chemical-treatment weights.
- These are conservative V1 proxy weights for deterministic prioritization, not experimentally calibrated units or a claim that every treatment within one label causes identical damage. `chemically_straightened = 3` is the accepted generalized value; V1 does not ask for straightening chemistry, processing heat, repetition, or overlap.
- The home elasticity response remains a contextual balance and corroboration signal. It is preserved in reasons and confidence but does not add standalone structural-damage points for Conditioner repair intensity.
- Heat and mechanical stress retain their separate runtime lanes. Either lane may raise Conditioner repair support to `medium`, because existing damage still benefits from conditioning, but the plan must also emit the more direct Heat-protection or behavior recommendation.
- Mechanical stress alone never creates a `high` Conditioner repair target and Conditioner is never credited as resolving rough towel use, damaging brushing, or absent night protection.

Deterministic Conditioner repair mapping:

1. `high` when structural damage is `high` or `severe`, or heat damage is `severe`;
2. otherwise `medium` when any structural, heat, or mechanical lane is `moderate` or higher;
3. otherwise `low`.

This intentionally keeps the current runtime's useful medium-repair response to material mechanical stress while separating care from prevention.

Conditioner remains the regular baseline even when the shared assessment also recommends Mask, Bondbuilder, Heat protection, or behavioral changes. Those additions do not remove Conditioner from the Bedarfsplan and Conditioner must not be credited as resolving the separate heat-protection or mechanical-behavior job.

## Functional needs and plan-wide coverage

Conditioner fit keeps its three core axes (`weight`, `balance`, and `repairLevel`) and adds a flat set of verified functional capabilities. The V1 Conditioner vocabulary is:

- `volume_support`;
- `frizz_smoothing`;
- `shine`;
- `detangling_slip`;
- `definition_support`;
- `color_protection`.

The user/category decision exposes `functionalNeeds[]`; a researched product exposes `functionalBenefits[]`. A product may contain several benefits. There is no product-level primary/secondary benefit hierarchy in V1. A missing benefit is unverified and earns no matching bonus; it does not prove that the product lacks the benefit.

Each functional need receives one deterministic priority:

- `3`: current problem plus the matching goal;
- `2`: current problem only;
- `1`: goal only.

Core Conditioner fit always wins over benefit count. Selection precedence is safety/exclusions, core `weight`/`balance`/`repairLevel` fit, functional-benefit coverage, plan-wide coverage, then deterministic ownership/budget/availability tie-breakers. A richer or otherwise mismatching Conditioner must not win merely because it lists more benefits.

Confirmed `volume_support` mapping:

- activate for straight or wavy hair when `currentConcerns` contains `low_volume_or_weighed_down` or `goals` contains `volume_balance`;
- do not activate it for curly/coily hair, where balanced volume is handled through weight, control, and definition rather than a generic volume benefit;
- fine hair or low density alone do not create this functional need;
- when active, it reinforces the one-step-lighter Conditioner target already defined in the weight rules;
- user-facing wording promises preservation of lightness/volume, not root lift.

Confirmed remaining mappings:

- `frizz_smoothing`: activate from `frizz_flyaways` and/or `frizz_surface`; concern plus goal receives priority `3`, concern only `2`, goal only `1`.
- `shine`: activate from `low_shine` and/or `shine` using the same `3 / 2 / 1` pairing.
- `detangling_slip`: activate from `tangling`. `manageability_styling` raises it to priority `3` only when `tangling` is also present; the goal alone does not infer a detangling problem.
- `definition_support`: activate from `lost_shape` and/or `shape_definition` only for wavy, curly, coily, or explicitly permed hair. Texture alone does not assume that the user wants definition.
- `color_protection`: activate from `chemicalTreatments = colored`. `lightened` without `colored` does not activate this separate functional need; its structural-repair effect is already handled by `repairLevel`. When both are selected, `colored` activates color protection and `lightened` supplies the stronger repair signal. The current Personal Plan quiz has no matching color-protection goal, so this is a current-condition need rather than a problem-plus-goal pair.

`moisture` and `strength_ends` influence the core balance/repair axes and are not duplicated as functional benefits. `scalp_balance` is outside the Conditioner role. `manageability_styling` remains contextual and is not silently collapsed into a generic frizz or detangling signal.

Conditioner participates in the shared two-pass portfolio coverage ledger:

1. the Conditioner module computes core fit and the functions a valid Conditioner can cover;
2. the portfolio pass credits those functions, then routes material uncovered needs to another eligible category rather than forcing one Conditioner to solve everything.

For example, a lightweight Conditioner may cover volume preservation and shine while a Leave-in supplies the stronger definition job. Conversely, if one core-fit Conditioner already covers two legitimate Conditioner functions, the plan does not add another product merely to duplicate them.

The final primary-versus-supporting ownership of each function is locked only after the adjacent categories are specified. The already-confirmed boundary is that Conditioner provides the primary in-shower detangling step, while persistent post-wash or between-wash detangling routes primarily to Leave-in.

## Frequency and product allocation

| Rule ID | Condition | Decision |
|---|---|---|
| `conditioner.cadence.after_wash` | An eligible Shampoo wash event is planned | Create one Conditioner need after the final Shampoo rinse. |
| `conditioner.cadence.double_shampoo_once` | The event contains two Shampoo passes | Use one Conditioner step after the final rinse, not after each pass. |
| `conditioner.cadence.cover_total` | One or more Conditioners are active | The category has one Conditioner occurrence per eligible wash; any one active suitable Conditioner can fill it. |
| `conditioner.cadence.interchangeable` | Several suitable owned Conditioners are intentionally kept active | Treat them as interchangeable choices for the same role; do not invent a fixed rotation or per-product frequency. |
| `conditioner.cadence.successor` | Total cadence or the eligible active Conditioner set changes | Create a proposed successor plan and require confirmation. |

Example: three eligible wash events create three Conditioner occurrences. If suitable owned Conditioners A and B are both active, the user may choose either at each occurrence—for example more volume support on one wash and more shine on another. The plan does not prescribe A `2` + B `1` unless a later product-specific feature explicitly introduces such scheduling.

Current product frequency belongs to the user's inventory state. Recommended product frequency belongs to the confirmed plan assignment.

## Multiple products

- The user product library may contain several Conditioners.
- Evaluate every matched Conditioner against the same confirmed target profile.
- Recommend at most one new exact Conditioner purchase.
- One suitable product is enough to cover all Conditioner occurrences.
- Several suitable owned Conditioners may remain active as interchangeable choices after the user confirms them; no primary/secondary placement or fixed frequency split is required.
- Judge every owned Conditioner separately and surface the functions each suitable product is strongest at.
- An unsuitable owned Conditioner may remain visible as an override or inactive product, but it is not silently treated as interchangeable with suitable products.
- Unassigned, shopping, rejected, or pending products remain visible but never enter executable day recipes.

## Product fit verdict

Use a layered verdict rather than one undifferentiated binary match.

### Layer 1 — strict suitability

- Shared `suitable_thicknesses = null` means not verified and therefore `unknown`; a non-empty verified array must contain the user's `thickness`.
- A verified exclusion is a hard mismatch even when the formula weight looks close.
- Empty arrays are invalid for active recommendable products. Legacy empty arrays remain `unknown` until researched and migrated; they are never an implicit match or a verified exclusion.
- Strong exclusions, unresolved identity, pending review, and safety constraints are applied before formula fit.

### Layer 2 — core formula fit

| Axis | `exact` | `supportive` | `mismatch` |
|---|---|---|---|
| `weight` | same `light / medium / rich` level | one level lighter or richer | two levels apart |
| `balance` | same `moisture / balanced / protein` direction | either target or product is `balanced` | direct `moisture` versus `protein` opposition |

Thickness remains a separate strict product-suitability gate. Weight answers the different question of how light or rich the formula should be for this complete profile.

### Layer 3 — need coverage

`repairLevel` is directional and secondary to strict suitability plus weight/balance:

- exact product and target level = `exact`;
- product one level below target = `supportive`;
- product two levels below target = `mismatch` because it materially under-serves the repair need;
- product above target = `supportive`, never `exact`: the product may remain usable when thickness, weight, and balance fit, but it is more repair-focused than necessary.

Functional benefits describe how completely an otherwise suitable product serves the person's goals. Verified matching benefits improve the product-level explanation and ranking. A missing benefit cannot rescue a core mismatch; missing functional metadata is shown as unverified and never becomes a hard mismatch by itself.

### Aggregate verdict and precedence

| Engine result | User-facing verdict | Rule |
|---|---|---|
| `ideal` | `passt sehr gut` | Strict thickness/safety gates pass; core axes are exact; repair is exact; material functional needs are verified or explicitly covered elsewhere in the plan. |
| `supportive` | `passt mit Einschränkung` | Strict gates pass and no hard mismatch exists, but at least one axis is a documented near-match, repair is above/below the exact target without being severely underpowered, or functional goal coverage is partial/unverified. |
| `mismatch` | `wechseln empfohlen` | Verified thickness exclusion, extreme weight mismatch, direct balance opposition, repair two levels below need, strong exclusion, or safety conflict. |
| `unknown` | `noch in Prüfung` | Product identity is pending or a required strict/core field is unavailable. |

Precedence is: unresolved identity/pending review; safety and strong exclusions; strict thickness; hard core/repair mismatch; missing required data; supportive deviations; ideal. Each product retains the axis-level facts so the UI can explain the verdict rather than showing only the label.

### Owned products versus a new recommendation

- Judge every uploaded/owned Conditioner independently and show its exact strengths, limitations, mismatches, and unknowns.
- Several `ideal` or `supportive` owned Conditioners may remain active as interchangeable choices.
- A mismatching owned product may remain as a user-confirmed non-blocking override, but the plan continues to show the limitation and better exact recommendation.
- For a new purchase, choose an `ideal` product when one satisfies exclusions, budget, and availability. A `supportive` product may be recommended only when no ideal candidate exists, with its limitation stated explicitly.
- Never present a known `mismatch` or `unknown` product as the confident new recommendation. If no valid candidate exists, return `Empfehlung wird geprüft`.

## Application rules

| Rule ID | Inputs/condition | Guidance |
|---|---|---|
| `conditioner.application.ends` | fine or straight hair | Focus on the ends; keep amount/lightness conservative. |
| `conditioner.application.full_length` | dry, curly, or coily hair | Cover the full hair length while avoiding deliberate scalp treatment. |
| `conditioner.application.mid_ends` | no stronger placement signal | Apply through mid-lengths and ends. |
| `conditioner.application.section_if_needed` | long, dense, thick, curly/coily, or tangled hair where coverage is difficult | Divide into manageable sections; no fixed section count. |
| `conditioner.application.detangle` | Detangling is needed | Finger-detangle first; if needed, use a wide-tooth comb gently from ends upward. |
| `conditioner.application.label_protocol` | Verified product directions exist | Product amount, dwell, and rinse directions override category fallback. |
| `conditioner.application.no_false_precision` | Exact product directions are unavailable | Use enough for even coverage, add incrementally, rinse thoroughly, and do not invent pumps/minutes. |
| `conditioner.application.no_cold_seal_claim` | Water temperature is explained | Avoid very hot water; do not claim a cold rinse seals the cuticle. |

Sectioning, gently removing excess runoff water, and distributing product between the hands can be optional technique guidance. They are not universal performance requirements.

## Detangling and Leave-in boundary

Conditioner supplies baseline in-shower slip. When the user's main unresolved job is persistent post-wash detangling, Leave-in is the primary additional category to assess. The confirmed Leave-in replacement of rinse-out Conditioner remains the explicit fine-and-very-short exception defined by the Leave-in category; it is not a default Conditioner rule.

## Replacement boundary

In V1, the Conditioner module contributes its normal post-shampoo occurrence unless the confirmed Leave-in exception applies: `thickness = fine`, `hair_length = very_short`, a material Leave-in/conditioning job exists, and the exact Leave-in is verified as replacement-capable. Mask, Bondbuilder, Oil, or another treatment does not replace Conditioner by default. Product-specific ordering may change where Conditioner appears, but does not silently remove the Conditioner need.

## Structured reasoning payload

The deterministic engine owns the decision and emits structured explanation facts. A later presentation layer may turn those facts into longer natural-language reasoning, including with an LLM, but it must not change the category tier, target, fit verdict, selected product, frequency, uncertainty, or safety boundary.

The Conditioner payload must preserve:

- inclusion decision and decisive hair-length/care evidence;
- target `weight`, `balance`, and `repairLevel` with their strongest supporting inputs;
- activated functional needs, their priorities, and whether Conditioner provides primary or supporting coverage;
- frequency source: one occurrence after each eligible wash;
- for each owned/recommended product, exact matches, limitations, mismatches, and unknown fields;
- relevant plan-wide coverage already supplied by another category;
- explicit user overrides and interchangeable-product choices;
- uncertainty, missing inputs, and applicable safety boundaries.

Reason salience and the final user-facing explanation format are deliberately deferred to the shared cross-category presentation pass after all category specifications are complete. They are not a Conditioner-specific decision and do not block this category specification. The structured payload must be sufficient for a deterministic template fallback even if no LLM explanation is generated.

## Safety and overclaim boundaries

- Conditioner is not scalp cleansing, scalp treatment, or root-oil control.
- Do not promise permanent split-end repair or structural damage reversal.
- Burning, itching, rash, swelling, or persistent scalp symptoms suppress optimization and trigger stop-product/professional guidance.
- Do not infer product weight, protein/moisture role, repair level, fragrance status, or exact protocol from the name.

## Initial fixture matrix

1. `conditioner-very-short-no-care-signal`: `not_needed`.
2. `conditioner-very-short-chemical-dryness`: `optional` with a light targeted profile.
3. `conditioner-fine-dry-lengths`: light weight, moisture/balanced direction, one use after each eligible wash.
4. `conditioner-coarse-curly-damaged`: rich or context-adjusted weight, high repair support, full-length/sectioned guidance.
5. `conditioner-volume-up`: one-level-lighter adjustment without deleting Conditioner.
6. `conditioner-two-products-three-washes`: both suitable products remain interchangeable; three total occurrences, no invented per-product split.
7. `conditioner-one-product-three-washes`: the one suitable product can fill all three occurrences.
8. `conditioner-pending-product`: visible as pending, excluded from day recipes.
9. `conditioner-owned-mismatch-kept`: `owned_override` remains executable with non-blocking advice.
10. `conditioner-double-shampoo`: one Conditioner step after the final rinse.
11. `conditioner-label-protocol`: exact verified product directions override category fallback.
12. `conditioner-sensitive-scalp-reaction`: no product escalation; safety guidance.
13. `conditioner-strict-thickness-exclusion`: otherwise close product is `mismatch`.
14. `conditioner-thickness-metadata-missing`: otherwise exact product is `unknown`.
15. `conditioner-higher-repair-than-needed`: strict/core fit passes; verdict is `supportive`, not `ideal` or `mismatch`.
16. `conditioner-high-repair-need-low-product`: repair is two levels below need; verdict is `mismatch`.
17. `conditioner-balanced-bridge`: strict gate passes and balance bridge produces `supportive`.

## Deferred cross-category dependencies

- After the adjacent categories are specified, lock whether Conditioner is `primary` or `supporting` for each shared function in the cross-category ownership matrix.
- In the shared presentation pass, define which two or three deterministic facts receive card-level salience when several weight, balance, repair, and functional signals apply; retain the remaining facts in expanded detail.
