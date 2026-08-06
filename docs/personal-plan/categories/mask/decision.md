---
category: mask
document_type: decision
status: confirmed
decision_version: 3
last_reviewed_at: 2026-08-06
current_runtime_revision_reviewed: f245db8e1159dc729fdc84659592cd667b92617c
evidence_file: docs/personal-plan/categories/mask/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/mask.ts
test_surface: tests/personal-plan/categories/mask.test.ts
---

# Personal Plan Mask decision

## Authority and current status

This document records the confirmed Personal Plan decisions for ordinary rinse-out hair masks. It follows `docs/personal-plan/categories/category-design-framework.md` and replaces `plans/mask-recommendation-spec.md` as the Personal Plan product-policy record. The older plan remains useful only as legacy-engine input until its rules have been explicitly accepted, adapted, or rejected here.

The category-owned decisions are complete. Final plan-wide function ownership and shared card-level reason salience remain deferred shared dependencies. The missing protocol authority and its verified catalog enrichment are explicit launch blockers, not unresolved Mask policy.

## Intended three-stage decision

- **Stage 1:** decide `basis | optional | not_needed`, the ordinary intensive rinse-out care target, its functions, and total regular or as-needed cadence.
- **Stage 2:** evaluate every owned or submitted Mask, choose at most one scheduled primary, return an exact verified recommendation when needed, and keep pending, shopping, acquired, declined, inactive, or informed-override products in their honest shared lifecycle states.
- **Stage 3:** allocate the total Mask cadence to eligible intensive-care washes and compile the confirmed in-hand primary using verified product directions or the bounded category fallback. A product with a critical protocol gap never enters a precise executable recipe.

## Current-behavior treatment

| Current truth | Treatment | Personal Plan result |
|---|---|---|
| The legacy engine makes Mask relevant from medium-or-higher derived damage, a planned intervention, or an explicit request. | `adapt` | Replace broad damage relevance with the confirmed strong-need/exposure tier rules below. Explicit interest cannot override the underlying need tier. |
| Legacy target weight uses thickness plus density and returns no target when either is absent. | `adapt` | Thickness anchors formula weight; explicit weighed-down sensitivity may shift it. Density and length affect amount and distribution. |
| Legacy `DamageAssessment` supplies structural, heat, and mechanical lanes plus `repairPriority`. | `adapt` | Reimplement the confirmed shared policy in the plan-owned `PlanDamageAssessment`; its medium boundary intentionally follows the confirmed Personal Plan mapping rather than verbatim legacy parity. Do not call the legacy engine at runtime. |
| Legacy Mask fit already has independent weight, balance, and repair-intensity comparisons and axis-level regression tests. | `adapt` | Preserve useful thresholds at the plan-owned Mask seam, add strict thickness, functional coverage, protocol completeness, and honest `unknown` semantics. |
| `product_mask_specs.concentration` is the live storage field; the legacy Mask fit also declares a dead optional `repair_level` TypeScript branch and evaluates `repair_level ?? concentration`. | `adapt` | Make the existing storage field nullable without a breaking rename in this milestone, expose it only as canonical `repairSupportLevel` at the plan-owned domain boundary, and delete the dead Mask `repair_level` branch. |
| The live catalog has no shared product-application protocol table or equivalent structured Mask protocol authority. | `missing` | Add the shared protocol structure, research the critical product facts, and keep Mask activation blocked until coverage is verified. |
| Chat request context, intervention actions, and legacy ranking scores can independently change current behavior. | `reject` | They are prior art only and cannot become a second Personal Plan authority. |

## Canonical inputs and missing-data behavior

Consume the complete saved Personal Plan quiz envelope directly:

- thickness, density, length, texture, surface, and elasticity;
- chemical treatments;
- current concerns `dry_lengths`, `hair_damage`, `breakage`, `split_ends`, `tangling`, `frizz_flyaways`, `low_shine`, `low_volume_or_weighed_down`, and `lost_shape` where the mappings below use them;
- goals for moisture, surface/frizz, strength/ends, shine, volume balance, shape/definition, and manageability;
- heat and mechanical behavior through the shared `PlanDamageAssessment`;
- personal wash frequency;
- owned/submitted product identity, lifecycle state, current reported use, and the verified product facts defined below.

`concernRecurrence` may raise confidence and explanation salience for its matching concern, but it does not create or promote Mask need and does not change cadence. `hair_loss_or_thinning` is not a Mask inclusion signal; it routes through the shared hair-loss safety boundary rather than cosmetic Mask optimization.

Canonical V3 keeps `hair_damage`, `breakage`, and `split_ends` separate. Historical V2 `breakage_or_split_ends` is normalized once upstream to `split_ends`; Mask never guesses that it meant breakage and never consumes the lossy offer/canonical projection.

Missing semantics:

- an explicit `currentConcerns = []` is a valid answer with no concern-derived Mask signal;
- an absent or invalid concern/treatment answer creates no inferred signal; other known rules may still decide the tier, and the missing fact remains in confidence/reason metadata;
- missing thickness blocks a confident weight target and exact Stage-2 fit; missing elasticity follows the shared required clarification rather than inferring a protein/moisture direction;
- missing wash frequency is an input blocker for an exact regular cadence and executable allocation, while the known need tier remains visible;
- a missing product row, pending identity, or missing required core fact produces product-level `unknown`; it never changes the person-side need tier;
- do not add a Mask-specific onboarding question unless a required saved input is genuinely absent and the answer can change tier, target, cadence, fit, safety, or application.

## Category charter

An ordinary Mask provides periodic, higher-intensity rinse-out care for the lengths. It does not replace the baseline role of Conditioner across the portfolio and it does not provide the persistent post-wash care owned by Leave-in.

V1 excludes:

- color-depositing masks;
- scalp masks;
- protocol-specific Bondbuilders and bond treatments;
- products whose primary job is Styling rather than rinse-out care.

At category level, Mask is normally additional to Conditioner. Within one concrete intensive-care wash, the Mask may replace Conditioner or be combined with it only according to the verified product relationship and protocol.

## Inclusion and need tier

### Canonical inclusion signals

Strong observed needs:

- `dry_lengths`;
- `hairSurface = rough`;
- `hair_damage`;
- `breakage`;
- `tangling`.

Supporting observed need:

- `split_ends`: it may make Mask `optional` and refine repair-support targeting and explanation, but it is not a strong observed need and never implies that a Mask repairs existing splits.

Meaningful exposures:

- any non-natural chemical treatment: `colored`, `permed`, `chemically_straightened`, or `lightened`;
- `heatLevel >= moderate` from the shared `PlanDamageAssessment`;
- `mechanicalLevel >= moderate` from the shared `PlanDamageAssessment`.

### Deterministic tier mapping

| Rule ID | Condition | Tier |
|---|---|---|
| `mask.inclusion.two_observed_needs` | At least two independent strong observed needs | `basis` |
| `mask.inclusion.observed_plus_exposure` | At least one strong observed need and at least one meaningful exposure | `basis` |
| `mask.inclusion.one_observed_need` | Exactly one strong observed need and no Basis rule | `optional` |
| `mask.inclusion.split_ends_supporting` | `currentConcerns` contains `split_ends` and no Basis rule | `optional` |
| `mask.inclusion.exposure_only` | One or more meaningful exposures without a strong observed need | `optional` |
| `mask.inclusion.slightly_uneven_surface` | `hairSurface = slightly_uneven` and no Basis rule | `optional` |
| `mask.inclusion.non_balanced_elasticity` | Elasticity is `snaps` or `stretches_stays` and no Basis rule | `optional` |
| `mask.inclusion.goal_only` | Moisture or strength goal exists without a stronger inclusion rule | `optional` |
| `mask.inclusion.coily_only` | `texture = coily` without a stronger inclusion rule | `optional` |
| `mask.inclusion.no_job` | No Basis or optional rule matches | `not_needed` |

Precedence and deduplication:

1. any named Basis rule wins;
2. otherwise any named optional rule wins;
3. otherwise return `not_needed`;
4. two exposures without an observed need remain optional;
5. arbitrary weak optional signals do not add up to Basis;
6. `split_ends` does not combine with an exposure or another supporting signal to create Basis; otherwise it would behave as a strong observed need;
7. goals, texture, and elasticity guide target direction but do not count as the strong second signal;
8. chemical treatment contributes once through the shared assessment and may also appear as a user-facing reason, but is not added again as a score;
9. ownership never changes the underlying need tier.

Frizz, shine, definition, volume, scalp goals, and curly or wavy texture alone do not create Mask need.

## Shared repair architecture

The Personal Plan computes one shared `PlanDamageAssessment`. Conditioner, Leave-in, and Mask consume the same person-side `repairPriority` rather than calculating category-local repair scores.

The confirmed shared mapping is:

- `high` when the structural lane is high/severe or heat is severe;
- `medium` when any structural, heat, or mechanical lane is moderate or higher;
- `low` otherwise.

Products expose the independent capability `repairSupportLevel: low | medium | high`.

Category ownership is:

- Conditioner: regular baseline repair support;
- Leave-in: supporting repair only;
- Mask: periodic intensive ordinary repair support when included;
- Bondbuilder: later specialized structural protocol.

Two medium-support products do not add arithmetically to high support. Chemical-treatment signals are not double-counted. A high repair target can determine which Mask would fit if used, but does not by itself promote the category from optional to Basis.

Examples:

- lightened hair without an observed need: optional Mask with high repair-support target;
- lightened hair plus roughness, dryness, breakage, or tangling: Basis Mask with high repair-support target;
- reported `hair_damage` plus a meaningful exposure: Basis Mask; `hair_damage` alone remains optional;
- split ends alone or split ends plus exposure: optional Mask; Spliss may refine the target and explanation but never counts as a strong observed need;
- color treatment alone: optional Mask with medium repair-support target;
- strong dryness and roughness without structural damage: Basis Mask with moisture-led care direction and low/medium repair support.

## Target product profile

Use the same independent target axes as Conditioner:

```ts
interface MaskTargetProfile {
  weight: 'light' | 'medium' | 'rich'
  careDirection: 'moisture' | 'balanced' | 'protein'
  repairSupportLevel: 'low' | 'medium' | 'high'
  functionalNeeds: MaskFunctionalNeed[]
}

type MaskFunctionalNeed =
  | 'smoothing_frizz_control'
  | 'detangling_slip'
  | 'shine'
```

`MaskTargetProfile` is person-side Stage-1 output. Exact product protocol is deliberately not part of it. `careDirection` and `repairSupportLevel` are the canonical plan-domain names used by Leave-in; existing Conditioner `balance` / `repairLevel` and database `balance_direction` / `concentration` fields are storage/legacy mappings, not distinct concepts.

### Weight

Thickness is the anchor:

- fine = `light`;
- normal = `medium`;
- coarse = `rich`.

`currentConcerns` containing `low_volume_or_weighed_down` shifts the target one level lighter, clamped at `light`; a `volume_balance` goal alone does not. Density and length change amount and sectioning rather than formula weight. Damage does not make the target richer; a light Mask may still provide high repair support.

### Care direction

Reuse the contextual Conditioner mapping:

- `stretches_stays` anchors protein-oriented;
- `snaps` anchors moisture-oriented;
- `stretches_bounces` anchors balanced.

Other profile inputs may corroborate or neutralize this direction. Elasticity is a contextual cosmetic heuristic, not a diagnosis of a literal protein or moisture deficiency.

Every ordinary Mask is already a deep-conditioning product by category. Do not add redundant exclusive product types such as `deep_conditioning` versus `protein_strengthening`; protein-oriented support is represented by `careDirection = protein`, while smoothing, shine, slip, and detangling remain functional capabilities.

### Exact-product selection order

1. safety and strict suitable-thickness gate;
2. target weight;
3. care direction;
4. repair-support level;
5. required and supporting functional benefits;
6. verified protocol, budget, and availability.

High repair support does not imply a protein-oriented product.

## Functional needs and product properties

Mask follows the same layered model as Conditioner and Leave-in:

1. direct product properties and core axes represent fundamental suitability;
2. flat functional benefits represent legitimate user jobs not already encoded by those properties;
3. core fit always takes precedence over benefit count;
4. a product may expose several benefits without one artificial `primaryFunction` hierarchy.

The following are direct properties or core axes and must not be duplicated as functional benefits:

- intensive conditioning is implicit in the ordinary Mask category;
- moisture/balanced/protein orientation is `careDirection`;
- repair or strengthening intensity is `repairSupportLevel`;
- formula richness is `weight`;
- curl/coily positioning is represented through verified texture suitability plus weight;
- color-care positioning is represented through verified color-treated suitability unless a future separately substantiated color-retention capability is required;
- exact contact time, multi-use behavior, Conditioner relationship, placement, and rinse behavior belong to product protocol.

The confirmed V1 Mask `functionalBenefits[]` vocabulary is:

- `smoothing_frizz_control`;
- `detangling_slip`;
- `shine`.

These benefits are non-exclusive. Do not introduce separate tags for hydration, moisture, nourishment, softness, dry-hair care, protein Mask, curl Mask, or color Mask: those labels are represented more faithfully through the core axes and suitability facts above.

User need mapping:

- `hairSurface = rough` makes `smoothing_frizz_control` a required Mask function;
- frizz concern or surface/frizz goal may make it a supporting function after Mask is included through a legitimate Mask rule, but frizz alone does not create Mask need;
- tangling makes `detangling_slip` required;
- low-shine concern or shine goal makes `shine` supporting after Mask is included, but shine alone does not create Mask need;
- dry lengths and moisture goals affect `careDirection` rather than creating a duplicate moisture benefit;
- breakage, split ends, chemical treatment, and strength goals affect shared `repairPriority` and the target `repairSupportLevel` rather than creating a duplicate repair benefit.

Where the shared functional priority applies, retain `3` for a current problem plus matching goal, `2` for a current problem, and `1` for a goal only. A function that helped make Mask `basis` is required for an `ideal` primary product. A supporting function improves coverage, ranking, and explanation but does not rescue a core mismatch.

Product tagging rules:

- manufacturer positioning may establish that a benefit is explicitly claimed, but is not proof of efficacy;
- full formulation context may corroborate care direction, repair support, and likely weight, but one ingredient never establishes a product benefit or weight;
- missing benefit evidence means unverified, not verified absence;
- reject ordinary-Mask capabilities for hair growth, anti-hair-loss, scalp treatment, split-end healing, permanent damage reversal, rebuilding from within, or permanent cuticle sealing.

### Canonical Mask repair-support migration

The current `product_mask_specs.concentration` field uses the same `low | medium | high` values and is `NOT NULL`. The plan-owned domain calls this capability `repairSupportLevel`; Personal Plan does not expose “concentration” as a second product concept.

Use the safe non-breaking rollout:

1. in the first Mask catalog migration before Stage-2 product reconciliation, retain the physical column name `concentration`, drop only its `NOT NULL` constraint, and preserve every existing row value one-to-one; separately fingerprint the 35 current active recommended rows as the launch cohort;
2. map `concentration` to canonical `repairSupportLevel` only in the new `src/lib/personal-plan/**` catalog boundary. The plan-owned runtime, payloads, reasons, and tests never expose the legacy name;
3. delete the dead optional Mask `repair_level` TypeScript field and `repair_level ?? concentration` branch from the legacy fit only when that consumer is deliberately updated; do not search for or migrate a nonexistent Mask database `repair_level` column;
4. update validators, generated types, admin/intake readers, the `SECURITY DEFINER` product-intake approval functions, intake JSON row handling, and every script writer to accept a nullable stored value before any reviewed product may be set to `null`;
5. use `null` for an unreviewed repair-support value, producing `unknown` / `noch in Prüfung` rather than an optimistic match;
6. reverify the preserved values during the Mask workstream of the shared cross-category follow-up enrichment PR; any value that lacks adequate finished-product support becomes `null` rather than a guessed level;
7. add nullable constrained `functional_benefits` only in the enrichment change that supplies reviewed values; do not ship an all-null field that changes no output. Exact application facts remain solely in the shared protocol authority;
8. assign the physical rename to `repair_support_level` to the shared cross-category follow-up enrichment workstream, not Stage 1. Use a repository-wide expand/backfill/contract rollout that includes the legacy engine, approval RPCs, generated types, admin/intake consumers, intake JSON rows, validators, selectors, tests, and every script writer. Temporary compatibility during deployment is transport safety, never a second editable product authority. The workstream is complete only after the new consumers and value fingerprints are verified and the legacy column can be contracted safely.

The Mask catalog facts for Stage 2 are shared `suitable_thicknesses`, `weight`, `balance_direction`, nullable `concentration` mapped to domain `repairSupportLevel`, and only genuinely necessary shared exclusion/explanation facts. Verified `functional_benefits` join that set when their enrichment lands. `ingredient_flags` may remain catalog research metadata but is not a direct Personal Plan fit or benefit authority; its later keep/drop cleanup is outside this category runtime.

## Product facts and fit verdict

Mask reuses the confirmed Conditioner fit thresholds. The category adds only the Mask-specific protocol facts defined below; it does not create a second fit philosophy.

### Required product facts for core fit

- resolved product identity and review lifecycle;
- safety and strong exclusions;
- verified `suitableThicknesses`;
- `weight: light | medium | rich`;
- `careDirection: moisture | balanced | protein`;
- `repairSupportLevel: low | medium | high`;
- verified `functionalBenefits[]` where available.

### Layer 1 — strict suitability

- shared `suitableThicknesses = null` means not verified; a non-empty verified array must contain the user's thickness;
- a verified thickness exclusion or safety conflict is `mismatch`;
- missing suitability is `unknown`; empty arrays are invalid for active recommendable products, and legacy empty arrays remain `unknown` until researched and migrated;
- pending or unresolved product identity remains `unknown` and cannot enter an executable recipe.

### Layer 2 — core formula fit

| Axis | Exact | Supportive | Mismatch |
|---|---|---|---|
| `weight` | Same level | One level lighter or richer | Two levels apart |
| `careDirection` | Same direction | Either target or product is `balanced` | Direct `moisture` versus `protein` opposition |

Thickness remains the strict eligibility gate; weight answers the separate question of how light or rich the complete formula should be.

### Layer 3 — need coverage

Repair support is directional:

- exact product and target level = exact;
- product one level below target = supportive;
- product two levels below target = mismatch;
- product above target = supportive because it is more repair-focused than necessary, never an exact match.

Functional benefits refine an otherwise suitable product:

- verified coverage of every required Mask function permits `ideal`;
- partial or unverified material functional coverage produces `supportive` unless the need is explicitly covered elsewhere;
- supporting benefits improve ranking and explanation;
- benefits never rescue a strict or core mismatch.

### Aggregate verdict

| Engine result | User-facing verdict | Rule |
|---|---|---|
| `ideal` | `passt sehr gut` | Strict gates pass, core axes and repair target are exact, and required functions are verified or explicitly covered elsewhere. |
| `supportive` | `passt mit Einschränkung` | No hard mismatch exists, but at least one core axis is a near-match, repair is above/one level below target, or material functional coverage is partial/unverified. |
| `mismatch` | `wechseln empfohlen` | Verified thickness exclusion, safety conflict, two-level weight mismatch, direct required care-direction opposition, or repair two levels below target. |
| `unknown` | `noch in Prüfung` | Identity is pending or a required strict/core field is unavailable. |

Precedence is unresolved identity/pending review, safety and exclusions, strict thickness, hard core/repair mismatch, missing required data, supportive deviations, then ideal. Retain every axis-level fact for expanded explanation.

Evaluate every owned Mask independently. For a new purchase, recommend an ideal product when available. A supportive product may be proposed only if no ideal candidate exists and its limitation is explicit. Never promote a known mismatch or unknown product as the confident recommendation.

Candidate selection is deterministic:

1. filter unresolved identity, safety conflicts, strict mismatches, core mismatches, and critical protocol gaps out of confident new recommendations;
2. prefer `ideal` over `supportive`;
3. compare target weight, care direction, repair-support level, required-function coverage, supporting-function coverage, verified protocol completeness, budget, and availability in that order;
4. preserve the confirmed primary when it has the same complete ranking tuple as the best candidate; if another candidate has a strictly better tuple, create a proposed successor rather than silently switching;
5. use a stable product identifier only as the final deterministic tie-break. It must not be presented as a quality difference.

If no valid candidate remains, return `Empfehlung wird geprüft` and preserve the exact exclusion or missing-fact reasons.

## Stage 2 reconciliation and lifecycle

Mask uses the shared product-state machinery with these category-local outcomes:

- an owned `ideal` Mask may be confirmed as primary; an owned `supportive` Mask may remain primary with its limitation visible when no better owned choice is selected;
- an owned `mismatch` is offered for deactivation or replacement and may remain only as an informed override; an owned `unknown` remains visible but unscheduled while review is pending;
- when Mask is `not_needed`, an owned product is labelled unnecessary for the proposed routine; the user may deactivate it or retain an informed override, but it is never scheduled automatically;
- one exact valid new recommendation may enter `shopping`; opening an affiliate link does not mean acquisition and changes no plan or ownership state;
- a reported acquisition moves the item to owned inventory and previews the affected Mask assignment, but it does not enter the active plan until the successor snapshot is confirmed;
- declining a recommendation leaves the active plan unchanged; inactive, declined, pending, and unassigned alternatives remain visible outside executable recipes;
- changing the primary, override, eligible active-product set, or total cadence creates a proposed successor and requires confirmation. The immutable active plan never mutates in place.

## Product protocol facts and application fallback

Verified exact-product directions override the category fallback. Store the following Mask-relevant facts in the shared `product_application_protocols` authority, keyed by `(product_id, role_key = 'mask')`, rather than creating a second category-local protocol store:

- application hair state;
- placement and explicit scalp permission;
- amount guidance when available;
- contact-time minutes or verified range;
- rinse requirement;
- Conditioner sequence;
- multi-use behavior;
- any product-specific maximum-frequency cap;
- explicit support for heat-cap or overnight use.

Use the exact Conditioner sequence values:

```ts
type MaskConditionerSequence =
  | 'replaces_conditioner'
  | 'mask_then_conditioner'
  | 'conditioner_then_mask'
```

An ordinary Mask remains a rinse-out lengths product. `multiUse` records verified additional uses but does not change how its assigned Mask occurrence is compiled.

### Safe category fallback

When exact directions do not specify otherwise:

1. use after the final shampoo rinse;
2. gently squeeze excess water from the hair without rough handling;
3. apply through lengths and ends and avoid deliberate scalp application;
4. start with a small amount and add enough for even coverage without inventing pumps, grams, or millilitres;
5. divide into manageable sections when long, dense, coarse, curly/coily, tangled hair or difficult coverage makes that useful; do not prescribe a fixed section count;
6. distribute gently and finger-detangle when detangling is an assigned need;
7. rinse thoroughly after the verified contact time.

### Critical versus non-critical protocol gaps

- Missing exact amount uses the conservative coverage fallback and does not block scheduling.
- Missing hair state uses the post-shampoo wet-hair fallback unless the known product format conflicts with it.
- Missing scalp permission defaults to lengths/ends only.
- Missing heat-cap or overnight permission means those techniques are unsupported and omitted.
- Missing multi-use evidence means ordinary rinse-out use only.
- Missing contact time or Conditioner sequence is a critical role-level protocol gap: preserve otherwise valid core fit, show the Mask occurrence as `unknown`, and keep it out of the precise executable recipe until reviewed.
- A verified product-specific maximum frequency caps the category cadence. Missing maximum-frequency metadata does not increase cadence and does not replace the confirmed conservative category recommendation.

For a new recommendation, choose only a product whose critical Mask protocol is verified. An owned product with a critical gap remains visible as `noch in Prüfung`; the user may follow its packaging independently, but the Personal Plan does not fabricate a precise recipe.

Only a confirmed in-hand primary compiles into Stage-3 steps. Shopping, pending, acquired-but-unconfirmed, inactive, declined, override-only, and unassigned alternative products do not compile. Optional Mask use may be selected only with a confirmed in-hand fitting Mask; it does not create an automatic occurrence.

## Safety, response, and overclaim boundaries

- burning, itching, rash, swelling, or another clear reaction triggers stop-use guidance and suppresses product optimization;
- persistent scalp symptoms are outside an ordinary length Mask and route to appropriate scalp/professional guidance;
- hair loss, unusual shedding, or patchy thinning is not treated as breakage or a Mask need and follows the shared hair-loss safety route;
- heavy, coated, limp, greasy, or sticky results are handled by reducing amount first, then cadence, then choosing a lighter Mask if needed;
- stiff, brittle, rougher, or more tangled results trigger a pause and reassessment of care direction, repair support, amount, and frequency; do not diagnose “protein overload” from the response;
- do not recommend scalp, overnight, or heated application without explicit verified product support;
- do not exceed the confirmed category cadence or a stricter verified product cap;
- do not automatically prescribe stronger cleansing in response to heaviness or coating;
- never claim split-end healing, permanent reconstruction, permanent cuticle sealing, replacement of lost nutrients, or reversal of existing structural damage;
- category explanations may promise temporary conditioning, softness, slip, manageability, smoothing, shine, and verified repair support without claiming biological repair.

## Conditioner and Leave-in relationship

- Conditioner remains the baseline after eligible washes.
- Leave-in owns persistent post-wash care.
- Mask owns periodic intensity.
- A Basis Mask therefore normally appears alongside Conditioner in the portfolio, not instead of the Conditioner category.
- On a specific intensive-care wash, the verified product protocol determines whether the Mask replaces Conditioner, is followed by Conditioner, or is used after Conditioner.

The canonical product protocol represents this relationship with the exact `MaskConditionerSequence` values defined above:

- `replaces_conditioner`: the Mask replaces Conditioner for that wash;
- `mask_then_conditioner`: Conditioner follows the Mask;
- `conditioner_then_mask`: the Mask follows Conditioner.

## Frequency and day allocation

### Confirmed architecture

Mask cadence is category-owned and is not a universal “every third wash” rule.

| Rule ID | Condition | Output |
|---|---|---|
| `mask.cadence.optional_as_needed` | Tier is `optional` | `cadenceMode = as_needed`; keep it out of the automatic schedule and expose the optional intensive-care template. |
| `mask.cadence.basis_high` | Basis need strength is `high` | Base target `1× pro Woche`. |
| `mask.cadence.basis_standard` | Basis need strength is `standard` | Base target `alle 2 Wochen`. |
| `mask.cadence.weight_sensitive` | `currentConcerns` contains `low_volume_or_weighed_down` | Reduce the base target one step: weekly to every two weeks, or every two weeks to every three weeks. Fine thickness or a `volume_balance` goal alone changes product weight, not cadence. |
| `mask.cadence.eligible_wash` | One Mask occurrence is due | Attach it to the closest already-eligible wash; never create an extra wash. |
| `mask.cadence.product_cap` | Verified product maximum is stricter | Cap the category recommendation; product directions never increase category cadence. |
| `mask.cadence.successor` | Total cadence changes | Create a proposed successor and require confirmation. |

- an optional Mask is not inserted into the automatic schedule;
- it remains available in an optional `Intensivpflege-Waschtag` template;
- user-facing fallback: “Bei Bedarf, wenn sich deine Längen trocken, rau oder schwer kämmbar anfühlen.”;
- `basis` Mask uses `cadenceMode = regular` and must become an exact executable cadence in Stage 3;
- the Mask occurrence attaches to an already-eligible wash and never creates an additional wash;
- the current reported Mask frequency and the recommended plan frequency remain separate facts.

An eligible wash is a confirmed wet-wash event with a final Shampoo rinse, no conflicting safety/protocol rule, and enough room for the verified Mask/Conditioner sequence. Mask never creates the wash event.

The recommendation itself is computed from:

1. Mask-need strength;
2. the required shared personal wash frequency;
3. the explicit `low_volume_or_weighed_down` concern.

The V3 Personal Plan quiz does not currently collect wash frequency. The shared post-payment setup must therefore add the already-required wash-frequency question from the computation specification, including an explicit `does_not_wash` value. A uniquely resolved current Shampoo `user_product_usage.frequency_range` may prefill the answer, but inventory cannot be the sole source because a user may own no resolved Shampoo. Until this shared input exists, a Basis tier may be shown but exact Mask cadence and Stage-3 allocation are typed-blocked; the engine must not silently substitute the user's current Mask frequency.

The exact selected product does not create the recommended cadence. Verified product instructions are a compatibility and safety constraint: they may cap a recommendation or make a special-protocol product unsuitable for the ordinary Mask role, but they do not increase the category cadence. Missing ordinary-product cadence metadata therefore does not force a fabricated product-led recommendation.

Stage presentation:

- Stage 1 may show `Basis · regelmäßig` or `Optional · bei Bedarf`;
- Stage 2 confirms a compatible exact product;
- Stage 3 renders the exact cadence in natural language, for example `1× pro Woche`, `alle 2 Wochen`, or its equivalent placement on eligible washes.

### Exact regular cadence

Compute Mask-need strength deterministically:

| Need strength | Definition | Base target |
|---|---|---|
| `high` | At least two strong observed needs, or one strong observed need plus a high shared repair priority | `1× pro Woche` |
| `standard` | Any other Basis route, normally one observed need plus a meaningful exposure | `alle 2 Wochen` |

An explicit `low_volume_or_weighed_down` concern reduces cadence one step: `high → alle 2 Wochen`, `standard → alle 3 Wochen`. Prefer a lightweight Mask as the first response to fine hair; fine thickness alone does not reduce cadence. Wash frequency then places the target on the closest eligible wash without adding washes. When the base interval is faster than the available wash cadence, allocate Mask to every eligible wash and expose the achievable cadence rather than claiming the unattainable base target. When several washes are available inside one target interval, choose the wash closest to the interval; an exact tie uses the later wash as the conservative choice. Preserve both the category base target and achieved wash-linked cadence in reason facts.

These numeric bands are Personal Plan product-policy calibration, not a claim that research proves one universal Mask interval. Later check-ins may propose a lower or higher successor cadence based on the user's recorded response, but any material plan change requires confirmation.

## Situational use

Optional Mask can be surfaced inside the intensive-care day after meaningful temporary load or when lengths feel dry, rough, or difficult to detangle. Do not add onboarding questions for occasional shows, styling events, swimming, or similar situations that the plan cannot reliably observe.

Clarifying or heavy Styling does not automatically mandate a Mask. Conditioning remains expected; the optional Mask is relevant when vulnerable lengths or an actual rough/dry/tangled response exists. Prevention and behavior guidance remain primary for heat and mechanical stress.

Do not explain Mask use as “putting nutrients back” or permanent repair.

## Multiple products and allocation

The Personal Plan recommends at most one ordinary Mask for every user. One sufficiently suitable Mask is expected to cover the category target; do not recommend a second purchase merely to add another Mask benefit or care direction.

Allocation rules:

1. one confirmed suitable Mask is the `primary` and receives the complete scheduled Mask cadence;
2. evaluate every additional owned or submitted Mask independently through the same product-fit model;
3. a fitting additional owned Mask may remain visible and usable as an unassigned alternative, but the engine does not invent a rotation or divide cadence between the products;
4. an additional Mask never increases total category frequency;
5. the user may manually choose another fitting owned Mask for an occurrence or confirm it as the new primary;
6. changing the scheduled primary creates a proposed successor plan and requires confirmation;
7. pending products remain visible but cannot be scheduled until their facts are reviewed;
8. a mismatch may remain owned under an informed override, but is not recommended or automatically compiled into the routine.

Primary/secondary allocation is therefore not required for ordinary Masks in V1: there is one scheduled primary plus independently evaluated unassigned owned alternatives. The UI may call these alternatives “Weitere Masken” rather than implying that the plan recommends a deliberate secondary rotation.

## Structured reasoning payload

The deterministic engine owns every Mask decision. A later presentation layer, including an LLM, may verbalize these facts but may not change the tier, target, cadence, selected product, fit verdict, protocol, uncertainty, or safety boundary.

Preserve:

- inclusion tier, matched rule IDs, decisive observed needs, and meaningful exposures;
- `standard | high` Mask-need strength and the exact cadence derivation;
- optional/on-demand state and situational trigger copy where applicable;
- target weight, care direction, repair-support level, and their decisive inputs;
- functional needs, shared `3 / 2 / 1` priorities, and required/supporting status;
- every owned/recommended product's strict gate, axis fits, benefit coverage, aggregate verdict, and missing facts;
- selected primary, unassigned alternatives, pending products, informed overrides, and proposed changes;
- shopping, acquired-but-unconfirmed, inactive, and declined product states;
- verified product protocol, fallback steps, critical protocol gaps, and Conditioner sequence;
- relevant plan-wide coverage, uncertainty, response guidance, and safety boundaries.

Shared card-level reason salience remains deferred until every category is specified. The full payload must support a deterministic German fallback explanation.

## Confirmed fixture matrix

1. `mask-no-job`: no observed need, exposure, elasticity signal, or Mask-relevant goal = `not_needed`.
2. `mask-one-observed-need`: dry lengths alone = `optional`, `as_needed`, no automatic occurrence.
3. `mask-two-observed-needs`: dry lengths plus rough surface = `basis`, high need, weekly base cadence.
4. `mask-observed-plus-moderate-exposure`: tangling plus moderate mechanical stress = `basis`, standard need, every-two-weeks base cadence.
5. `mask-observed-plus-high-repair`: rough surface plus high repair priority = `basis`, high need, weekly base cadence.
6. `mask-high-fine-weight-sensitive`: high need plus fine thickness and `low_volume_or_weighed_down` = light target and cadence reduced to every two weeks; fine thickness alone would not reduce cadence.
7. `mask-standard-weight-sensitive`: standard need plus `low_volume_or_weighed_down` = cadence reduced to every three weeks.
8. `mask-exposure-only`: chemical, heat, or mechanical exposure without an observed need = `optional`, never Basis from stacked exposures alone.
9. `mask-elasticity-only`: non-balanced elasticity = `optional`; it guides care direction without diagnosing deficiency.
10. `mask-lightened-only`: optional Mask, high repair-support target if chosen, no automatic schedule.
11. `mask-lightened-rough`: Basis, high repair support, observed-plus-high-repair cadence.
12. `mask-strict-thickness-exclusion`: otherwise attractive Mask is `mismatch`.
13. `mask-thickness-metadata-missing`: otherwise attractive Mask is `unknown`.
14. `mask-balanced-bridge`: strict gate passes and balanced care direction bridges moisture/protein as `supportive`.
15. `mask-repair-one-level-low`: supportive limitation.
16. `mask-repair-two-levels-low`: mismatch.
17. `mask-higher-repair-than-needed`: supportive rather than ideal or mismatch.
18. `mask-required-benefit-unverified`: core fit passes but material functional coverage is unverified = supportive.
19. `mask-one-primary-two-owned`: one primary receives the complete cadence; second fitting owned Mask remains independently evaluated and unassigned.
20. `mask-pending-product`: visible as `noch in Prüfung`, excluded from precise recipes.
21. `mask-missing-contact-time`: core fit retained, Mask occurrence protocol unknown, no invented waiting time.
22. `mask-missing-conditioner-sequence`: no invented Conditioner order; occurrence stays out of precise recipes.
23. `mask-verified-protocol`: exact contact time and Conditioner sequence override category fallback.
24. `mask-generic-application`: safe wet-hair lengths/ends fallback with adaptive sectioning and no false amount precision.
25. `mask-heavy-response`: amount, then cadence, then product weight is adjusted in that order.
26. `mask-adverse-reaction`: stop-use guidance suppresses optimization.
27. `mask-no-valid-candidate`: mismatch/unknown products are not promoted as a confident purchase recommendation.
28. `mask-optional-intensive-day`: optional Mask remains selectable in `Intensivpflege-Waschtag` but does not enter the automatic sequence.
29. `mask-hair-damage-only`: `hair_damage` alone = `optional` as one strong observed need.
30. `mask-hair-damage-plus-exposure`: `hair_damage` plus a meaningful exposure = `basis`.
31. `mask-split-ends-only`: `split_ends` alone = `optional`, supporting-only, no repair claim.
32. `mask-split-ends-plus-exposure`: `split_ends` plus a meaningful exposure remains `optional`; the exposure does not promote the supporting signal to Basis.
33. `mask-normalized-split-only`: a profile already normalized to `split_ends` follows the supporting-only route; the shared input-adapter test, not Mask, owns historical V2 migration.
34. `mask-missing-thickness`: need tier remains explainable, weight target and exact fit are blocked pending clarification.
35. `mask-missing-elasticity`: no care-direction diagnosis; clarification is required before exact fit.
36. `mask-missing-wash-frequency`: Basis tier remains visible, exact regular cadence and executable allocation remain blocked.
37. `mask-base-cadence-faster-than-washes`: weekly base target plus one wash every ten days allocates Mask to every eligible wash and reports the achievable cadence.
38. `mask-cadence-placement-tie`: two equally close eligible washes choose the later wash.
39. `mask-stable-primary-tie`: an equally ranked candidate does not replace the confirmed primary.
40. `mask-shopping-not-owned`: affiliate opening and shopping state do not compile a product into Stage 3.
41. `mask-acquired-awaiting-confirmation`: acquisition previews the successor assignment; the active plan remains unchanged until confirmation.
42. `mask-not-needed-owned-override`: owned Mask is shown as unnecessary, unscheduled by default, and may remain only through informed override.
43. `mask-hair-loss-only`: `hair_loss_or_thinning` alone creates no Mask need and preserves the shared safety route.
44. `mask-concern-recurrence-only`: recurrence changes confidence/reason salience only and cannot promote tier or cadence.

## Catalog, data, and launch gate

Mask uses three explicit gates:

1. the pure Stage-1 need/target/cadence computation may land without a product-spec migration, consistent with the shared Stage-1 scope;
2. the shared cross-category follow-up enrichment workstream owns the safe `concentration` to `repair_support_level` expand/backfill/contract migration, complete consumer audit, and reviewed repair-support values before Stage-2 Mask product reconciliation is enabled;
3. before Stage-3 recipes or Mask recommendations are activated, that same follow-up workstream must add the shared `product_application_protocols` structure and verify the critical Mask protocol for all 35 products that are currently active and recommended.

Read-only production verification on 2026-08-06 found exactly 35 Mask rows matching `category_key = 'mask'`, `lifecycle_status = 'active'`, `is_active = true`, and `is_chaarlie_recommended = true`. All 35 have `product_mask_specs`, populated `concentration`, populated `balance_direction`, and non-empty `suitable_thicknesses`. Production currently has no structured product-protocol table or equivalent Mask protocol authority, so none of the critical application coverage below is assumed complete.

The minimum launch-blocking protocol package for every one of those 35 products is:

- verified product identity and source provenance;
- verified contact time or contact-time range;
- verified `MaskConditionerSequence`;
- verified rinse behavior.

Hair state, placement, amount, sectioning, scalp permission, heat-cap or overnight support, multi-use behavior, and maximum-frequency caps are enriched where the exact product supplies them. The conservative category fallbacks remain valid only for the explicitly non-critical gaps defined above; they do not replace contact time or Conditioner sequence.

Until all 35 critical packages pass review, the new Mask recommendation path remains inert. Individual incomplete products remain `unknown` / `noch in Prüfung` and cannot be compiled into a precise executable recipe. The shared cross-category follow-up enrichment PR must report Mask coverage counts, missing fields, source provenance, and deterministic protocol-validation results rather than activating on an assumed catalog default.

## Deferred shared dependencies

- final primary/supporting ownership across Conditioner, Leave-in, Mask, Oil, Bondbuilder, and Styling; this blocks final plan-wide coverage allocation, not the Mask category computation;
- shared two-to-three-fact card salience and German presentation templates; this blocks final presentation, not deterministic Mask outputs;
- shared lifecycle/persistence mechanics must implement the local Stage-2 outcomes above before Stage-2 activation;
- the shared day-type compiler must place the category-owned occurrences without changing their total cadence;
- the shared post-payment setup/input contract must add canonical wash frequency with explicit `does_not_wash`; this blocks exact Stage-1 cadence and every regular Stage-3 Mask allocation, not the person-side inclusion tier;
- execution of the shared follow-up enrichment workstream—including the safe repair-support rename, consumer/RPC/writer migration, reviewed values, and all-35 protocol gate—blocks Stage-2 Mask reconciliation and Mask recommendation launch as specified above.

## Stop-gate result

Category policy for Stage 1, Stage 2, and Stage 3 is confirmed. No Mask-local product decision remains open. Exact cadence implementation is gated on the shared wash-frequency setup input. The shared follow-up enrichment workstream owns the repair-support rename and complete consumer audit before Stage 2; launch is additionally gated on verified critical protocol coverage for all 35 active recommended Mask products. Shared portfolio ownership, lifecycle mechanics, day-type compilation, and presentation remain named dependencies and may not be reimplemented as Mask-local authorities.
