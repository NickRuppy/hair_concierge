# Conditioner Research and Classification Standard v1.6-rc1

Status: revised 12-product nine-property comparison recalibration candidate
Version: 1.6-rc1
Scope: conventional short-contact rinse-out conditioners, Germany/EU
Normative source: this Markdown file

## 1. Purpose

This standard converts an exact product and exact formula into an auditable research record. It separates:

1. formula observations;
2. plausible direct Conditioner routes and properties;
3. finished-product evidence;
4. profile-specific fit.

It does not turn ingredient names into universal good/bad labels and does not replace a formulation test, consumer study, clinical evaluation, or production catalog decision.

## 2. Category and identity gates

Classification stops before formula analysis unless all of the following are known:

- exact catalog product UUID;
- exact brand and product name;
- Germany/EU market;
- pack size or an explicit unknown;
- one reliable identifier or a documented identity-research gap;
- dated exact-market formula source;
- raw INCI;
- product-form status;
- source/formula conflicts.

Allowed identity states:

- `verified`
- `verified_with_minor_source_difference`
- `provisional_formula_conflict`
- `provisional_identity_conflict`
- `insufficient_information`
- `excluded_product_form`

Excluded forms are leave-ins, masks/deep treatments, co-washes, color-depositing conditioners, two-phase sprays, medicated/scalp treatments, salon chemistry, and multi-use products permitting materially different rinse-out and leave-on behavior.

A GTIN may survive reformulation. Formula identity and product identity are related but separate. A conflict that changes only one property makes that property `unknown`; it blocks the whole analysis only when the dominant architecture cannot be resolved.

## 3. Evidence scale

| Level | Meaning | Permitted use |
|---|---|---|
| E0 | Product name, marketing claim, unsupported secondary statement, or no usable evidence | Record claim only; no direct property |
| E1 | Verified exact-formula observation: ingredient present/absent, literal rank, declared exposure | Formula fact only |
| E2 | Plausible architecture or mechanism inference from the complete formula and product form | Candidate route/direct-property potential, always provisional |
| E3 | Exact finished product tested instrumentally under a stated protocol | Endpoint-specific product property |
| E4 | Controlled human-use or blinded trained-sensory evidence for the exact product | Endpoint-specific product/user-perception evidence |
| E5 | Strong replicated or consensus finished-product evidence relevant to use | Strong endpoint-specific conclusion |

INCI-only classification never exceeds E2. Reviewer agreement measures repeatability of the rules, not truth.

EU Article 19 permits descending order above 1%, while ingredients below 1% may appear in any order. The under-1% boundary is not visible. Never infer exact percentages, ratios, pH, molecular weight, droplet size, deposition amount, viscosity, manufacturing process, or active dose from a consumer list.

## 4. Evidence record

Every direct property contains:

- `value`
- `decision_type`
- `confidence`
- `evidence_level`
- `evidence_scope`
- `rationale`
- `formula_observations[]`
- `product_inferences[]`
- `supporting_signals[]`
- `counter_signals[]`
- `derived_from[]`
- `profile_fact_ids[]`
- `source_ids[]`
- `shared_mechanism_ids[]`
- `review_status`

Formula observations state what is literally present. Product inferences state what might follow. A derived fit without both `derived_from` and `profile_fact_ids` is invalid.

## 5. Route dictionary

### R1 — Cationic/fatty-alcohol conditioning base

Candidate evidence: a verified long-chain cationic quat or protonatable amidoamine plus a long-chain fatty alcohol in a confirmed rinse-out product.

Permitted E2 statement: “contains a conventional cationic conditioning-base pattern.”

Do not infer actual lamellar phase, viscosity, deposited amount, combing force, sensory richness, rinseability, buildup, or user fit. An acid beside an amidoamine supports the candidate context but does not prove protonation or final pH.

### R2 — Silicone surface-film/lubrication route

Candidate evidence: verified silicone ingredient(s) considered within the full deposition architecture.

Permitted E1/E2 statement: “contains a possible silicone surface-film/lubrication route.”

Silicone presence does not prove heavy finish, buildup, fine-hair mismatch, superior shine, repair, persistence, or deposition. Silicone-free does not prove lightness or low residue.

### R3 — Cationic-polymer deposition/film route

Candidate evidence: verified cationic polymer such as a Polyquaternium or cationic guar.

Permitted E1/E2 statement: “contains a possible cationic-polymer deposition modifier.”

Charge density, molecular weight, formula interactions, substrate, use frequency, and rinse determine behavior. Never map the family directly to buildup.

R3 is a deposition modifier, not automatically a temporary repair-film result. Do not populate `repair_surface_film` from a cationic polymer alone.

### R4 — Lipid/emollient relubrication route

Candidate evidence: verified oil, butter, ester, hydrocarbon, ceramide, or related emollient in formula context.

Permitted E1/E2 statement: “contains a possible emollient/relubrication route.”

A hero oil in the uncertain tail is not a richness score. Fatty alcohols used in the base are not counted again as hero oils.

### R5 — Temporary protein/film-support route

Candidate evidence: hydrolyzed protein, amino-acid derivative, peptide, or non-cationic film former with plausible delivery context.

Permitted E1/E2 statement: “contains a possible temporary protein/film-support route.”

Ingredient presence does not prove penetration, structural repair, strength, breakage reduction, or a “protein need.” Upgrade requires exact-product evidence and a defined endpoint.

R5 requires a plausible fibre-substantive film route in formula context. A generic gum, starch, or viscosity signal that may primarily control bottle rheology is not sufficient by itself.

### R6 — Acid/buffer/chelator context

Candidate evidence: verified acid, buffer, or chelator.

Permitted E1 statement: presence; E2 statement: possible pH-control or metal/hard-water robustness context.

Do not infer final pH, cuticle sealing, color retention, metal removal, detox, repair, or bleaching safety.

### R7 — Bond-claim review route

Candidate evidence: an exact product claim plus a named or explicitly described chemistry and product-level substantiation.

A recognized maleate or gluconamide/gluconate system may open a `bond_claim_review` flag. Formula-only evidence remains E1/E2 and does not prove new bonds, internal repair, or strength. Routine-level evidence is not attributed to the Conditioner.

### R8 — Fragrance/scalp exposure route

`Parfum`, `Fragrance`, `Aroma`, declared fragrance allergens, and clearly aromatic essential oils are exposure signals.

Allowed values:

- `fragrance_declared`
- `aromatic_or_allergen_exposure`
- `no_listed_fragrance_signal`
- `unknown`

“No listed signal” is not allergy-safe, hypoallergenic, or guaranteed fragrance-free. Labelling thresholds and incomplete/conflicting formulas prevent those claims. Root/scalp suitability requires application directions and exposure context; discomfort, rash, dermatitis, infection, hair loss, and disease require abstention/professional evaluation.

## 6. Shared mechanisms and double counting

Use these mechanism IDs:

- `M1_DEPOSITION_SURFACE_LUBRICATION`: cationic base, cationic polymer, silicone, lipids.
- `M2_TEMPORARY_FILM_SUPPORT`: proteins, peptides, film formers.
- `M3_OPTICAL_ALIGNMENT_FILM`: shine caused through alignment or surface film.
- `M4_CLAIM_ONLY_PROPRIETARY`: claim without product-specific substantiation.

Several ingredients may raise confidence in one mechanism. They do not create several independent technologies. One mechanism cannot independently score conditioning, smoothing, shine, repair, and body without endpoint-specific evidence.

## 7. Direct properties

Formula-only values describe potential, not measured performance.

| Property | Values | Formula-only ceiling | Required false-signal rule | Abstain when |
|---|---|---|---|---|
| `conditioning_deposition_potential` | lower / moderate / higher / unknown | E2 | count architecture, not ingredient points | formula or product form unresolved |
| `wet_slip_detangling_potential` | lower / moderate / higher / unknown | E2 | wet evidence is not dry evidence | architecture ambiguous or only claim evidence |
| `dry_combability_potential` | lower / moderate / higher / unknown | E2 | never upgrade from wet-combing data alone | no dry endpoint or coherent film/lubrication route |
| `surface_lubrication_softness_potential` | lower / moderate / higher / unknown | E2 | friction proxy is not perceived softness | only bottle rheology or claim evidence |
| `smoothing_frizz_control_potential` | lower / moderate / higher / unknown | E2 | deposition route is not weatherproof frizz control | humidity/use protocol absent for hard claim |
| `shine_potential` | lower / moderate / higher / unknown | E2 | shine is not repair; alignment/film may share M3 | only hero ingredient or claim |
| `weight_deposition_potential` | lower / moderate / higher / unknown | E2 | silicone-free is not light; viscosity is not weight | full architecture unavailable |
| `rinse_behavior` | quick / balanced / tenacious / unknown | E0 from INCI; E3/E4 tested | research-trace endpoint only; never project it into the lean profile | no exact finished-product rinse protocol |
| `cumulative_residue_risk` | lower / indeterminate / higher | E0 from one use; E3 repeated-cycle | one-use deposition is not buildup | no repeated apply/rinse/wash/removal evidence |
| `body_lightness_potential` | likely_preserving / balanced / likely_depositing / unknown | E2 | name/volume claim is not body evidence | architecture conflicts or no corroboration |
| `repair_lubrication_protection` | none_visible / candidate / tested / unknown | E2 | manageability/breakage protection is not structural repair | endpoint undefined |
| `repair_surface_film` | none_visible / candidate / tested / unknown | E2 | temporary film is not cortex regeneration | route depends only on protein/keratin name |
| `bond_specific_support` | claim_only / chemistry_candidate / product_tested / unknown | E2 | “bond/plex/repair” name is E0 | chemistry or substantiation absent |
| `color_chemical_damage_protection` | general_conditioning / candidate / product_tested / unknown | E2 | acid/chelator is not anti-fade proof | no color endpoint |
| `fragrance_scalp_exposure` | route R8 values | E1 | exposure is not diagnosis | incomplete/conflicting INCI |

A direct property may be `higher` at E2 only when multiple independent, endpoint-relevant formula observations support the route and no material counter-signal exists. One shared mechanism must not upgrade several endpoints as if it were several independent observations. The rationale must say “potential” and preserve the cap.

## 8. Finished-product methods

- Wet slip: peak force and total work on controlled wet tresses.
- Dry combability: peak force and total work after controlled drying/humidity.
- Friction/lubrication: specified fibre/probe tribology with orientation, load, speed, humidity.
- Softness: blinded trained sensory, optionally paired with haptic/friction proxies.
- Shine: fixed-geometry goniophotometry/lustre plus blinded visual assessment.
- Rinse behavior: water volume/time to a predefined visual and clean-touch endpoint.
- Cumulative residue: repeated apply/rinse/wash cycles plus deposition and functional endpoint, including a removal arm.
- Body/lightness: tress volume/projected width or bundle compression plus blinded assessment.
- Breakage protection: repeated combing fragments/break counts under a defined comparator.

Every E3/E4 record names exact formula/version, substrate, damage state, dose, contact time, rinse, drying, environment, sample size, comparator, endpoint, and result. Evidence for a shampoo, leave-in, routine, or different formula cannot upgrade this product.

## 9. Candidate full profile

The calibrated pilot produces one complete product-level prior for each eligible rinse-out Conditioner. It is a practical research projection, not a permanent claim that the product is universally suitable for every user in a listed group. Final recommendations still combine product behavior with the user's damage, thickness, texture, routine, dosage, desired finish, and scalp context.

The exact pilot output is:

- `conditioning_level`: low / moderate / high
- `weight_potential`: low / moderate / high
- `care_direction`: protein / moisture / balanced
- `repair_support_level`: low / medium / high
- `primary_focus`: lightness / detangling / smoothing / repair / shine / curl_support / color_care / general
- `secondary_focus`: zero to two distinct values from the `primary_focus` vocabulary, excluding `general`
- `hair_thickness_fit`: non-empty ordered subset of fine / medium / coarse
- `damage_fit`: non-empty ordered subset of healthy / moderately_damaged / highly_damaged
- `texture_fit`: non-empty ordered subset of straight / wavy / curly / coily

The three multi-value fit fields are broad product priors. They are arrays because one Conditioner may be practical for more than one hair group.

`usage_role` and `scalp_application_fit` are deliberately excluded from the comparison profile. Within this category, conventional rinse-out Conditioners are used after washing and ordinarily applied to wet or damp hair before rinsing. The pilot showed that “regular” versus “frequent” and “whole hair” versus “lengths and ends” mostly reproduced direction wording rather than meaningful product-performance differences. Preserve exact frequency, placement, amount, contact time, and rinse directions as protocol metadata instead. A specialist scalp, leave-in, mask, or intensive-treatment protocol belongs to its applicable product-form boundary or module.

Every profile also carries one concise `uncertain_fields` list and `assumption_notes`. These are reviewer aids, not a taxonomy Nick must adjudicate value by value.

## 10. Pragmatic projection rules

Only reviewed direct properties may produce the nine-property comparison profile. Authoritative directions remain required protocol metadata but do not create comparison properties. Current catalog labels never break a tie.

### 10.1 Lean behavior

- `conditioning_level` maps `conditioning_deposition_potential`: lower → low, moderate → moderate, higher → high.
- `weight_potential` normally maps `weight_deposition_potential`: lower → low, moderate → moderate, higher → high. When a formula-only `higher` result is already conflict-tagged, exact-product intended finish materially contradicts it, and no finished-product evidence resolves the conflict, use `moderate` as the lean matching fallback and keep `weight_potential` uncertain. Do not encode unresolved uncertainty as a restrictive `high` value that automatically removes fine hair from the broad fit prior.
- `rinse_behavior` remains available only in the detailed research trace for exact finished-product testing. It is not inferred from ingredients and is not projected into the lean profile; `weight_potential` is the retained ingredient-informed deposition signal.

### 10.2 Care direction and repair support

- `care_direction` describes the formula's comparative care emphasis, not a diagnosis of a user's protein or moisture need. Use `protein` only when an identifiable R5 protein/peptide/keratin film-support route is materially present in the formula context and is more than ordinary conditioning. Use `moisture` when the coherent conditioning, humectant, and emollient/softness architecture is the material direction without a dominant protein-film route. Use `balanced` only for a substantive mixed protein-plus-moisture architecture; it is not an uncertainty bucket or a label for an otherwise neutral conventional conditioner. Formula-only calls remain E2, and humectant or protein name presence alone is insufficient.
- `repair_support_level` describes the formula's comparative temporary damage-support route, not measured repair efficacy or structural restoration. `low` is ordinary conditioning/lubrication only. `medium` requires a distinct temporary protein/peptide/keratin fibre-film route. `high` requires a materially stronger named bond route visible in the reviewed formula. Generic silicone, oil, panthenol, ceramide, cationic polymer, generic repair naming, ordinary R1 conditioning, or finished-product positioning without a corresponding formula route does not exceed `low`. Formula-only calls remain E2; `high` is still comparative formula potential, not proof of bond repair.

### 10.3 Focus hierarchy

`primary_focus` is a forced research-review headline, not the sole future production truth. It remains required for every future Conditioner database-research record in this program, together with zero to two useful `secondary_focus` values, because the hierarchy makes products comparable. Preserve all supported direct properties for possible later flat functional-benefit mapping; those capabilities do not replace the hierarchy unless a separate production-integration decision explicitly changes the contract.

1. Exclude baseline conditioning from the hierarchy. A conventional R1 base supports conditioning and wet slip but does not automatically make `detangling` the product's distinctive main purpose.
2. Group evidence by shared mechanism before comparing endpoints. Several ingredients may strengthen M1 without creating several independent technologies.
3. Evaluate special-purpose routes first: lightness, repair, curl support, and color care must clear their route-specific thresholds below.
4. Prefer `smoothing` when dry surface control is the clearest practical differentiator and the architecture extends beyond an ordinary R1 base.
5. Permit `detangling` as primary only when slip/combability is itself distinctive: wet-slip support is clearly stronger than competing routes, or exact tangling/combability positioning corroborates it, and no richer special-purpose route wins.
6. Use `general` when the product is a capable conventional Conditioner but no specific focus clears the differentiator threshold.
7. Official positioning may corroborate but never create a route. Current catalog values never break a tie.
8. Mark `primary_focus` uncertain when two plausible purposes remain unresolved.

Route anchors:

- `lightness` requires low weight plus likely-preserving body;
- `detangling` requires distinctive wet-slip/combability support, not merely R1 presence;
- `smoothing` requires the clearest dry-comb, softness, surface-lubrication, or frizz-control route beyond the ordinary base;
- `shine` requires a distinct optical route or exact-product evidence and is not added when it is merely the expected result of the smoothing film;
- `repair` requires a distinct R5/R7 route or exact-product damage endpoint evidence. R2 silicone alone, panthenol, oils, ceramides, cationic polymers, biotin, generic repair naming, and `bond_specific_support=claim_only` cannot set repair;
- `curl_support` requires high slip plus compatible weight/body architecture, with curl/coily positioning only as corroboration;
- `color_care` requires at least a formula candidate plus compatible exact-product positioning or product-tested evidence.

A secondary focus may add a distinct user endpoint even when it shares part of a mechanism, but it must add useful matching information. Do not spend a secondary slot on moderate shine that only reuses the primary smoothing route. The complete rationale and examples are in `04_focus-selection-decision-guide.md`.

### 10.4 Fit priors

- `hair_thickness_fit`: low weight includes fine and medium; moderate weight includes fine, medium, and coarse; high weight includes medium and coarse. This is a desired-finish/dosage prior, not a universal exclusion.
- `damage_fit`: low conditioning maps to `healthy`; moderate conditioning maps to `healthy` plus `moderately_damaged`; and general high conditioning without a qualifying specialist route also maps to `healthy` plus `moderately_damaged`. Add `highly_damaged` only when high conditioning is accompanied by (a) a distinct protein, peptide, or keratin fibre-film route, (b) named bond chemistry, (c) exceptional corroborated protection, or (d) a relevant exact-product test. Generic silicone, oil, panthenol, ceramide, cationic polymer, repair naming, or a generic lubrication candidate alone does not qualify. This is a broad product prior, not a repair-efficacy claim.
- `texture_fit`: low-weight/lightness architecture supports straight and wavy; balanced architecture supports straight, wavy, and curly; high-slip, high-deposition architecture supports wavy, curly, and coily. Curl branding alone never determines the result.
When evidence conflicts, follow the canonical source hierarchy, choose one documented formula/directions basis, complete the profile, and list the affected field in `uncertain_fields`. Only G0 product-form exclusions omit the profile.

Current live `protein_moisture_balance`, `repair_level`, weight, and ingredient flags are comparison-only historical data. They cannot determine a new classification or break a tie. A later production-matching proposal may derive compatible user-balance rows from the researched `care_direction`, but must not represent product direction as a proven user deficiency.

## 11. Gates

- G0 Boundary: excluded/multi-use products do not classify.
- G1 Identity/formula: follow the canonical source hierarchy, preserve the conflict, and complete a provisional research profile from the best available exact-market evidence.
- G2 Evidence firewall: observation → direct property → profile fit; no shortcuts.
- G3 Anti-double-counting: one shared mechanism counts once unless endpoint-specific evidence separates it.
- G4 Evidence cap: formula-only ≤ E2; claim-only E0.
- G5 Conflict: preserve source conflicts and lower the smallest affected scope.
- G6 Medical: no diagnosis, treatment, hair-loss lifecycle, inflammation, infection, or structural-regeneration suitability.
- G7 Review freshness: review fingerprints must match identity, formula, analysis, and standard. Each newly written profile field uses a deterministic **unsalted** SHA-256 fingerprint of its canonical field evidence/value payload. During hydration, the Lab may recognize a legacy salted fingerprint only when the current field payload and stored review version reproduce it. Equality proves that the field content is unchanged and preserves its approval; changed content reopens. New decisions persist only the unsalted hash. The whole-profile fingerprint remains versioned and binds the canonical nine-property profile plus `standard_version`; it is intentionally not a substitute for the per-field fingerprints. Advancing to v1.6 opens `care_direction` and `repair_support_level` for every eligible product; approvals for unchanged existing seven fields remain valid.

## 12. Human review triggers

Require targeted review for:

- product-form ambiguity;
- formula-source conflict;
- absent exact-market formula or identifier;
- proprietary bond/repair claim;
- root/scalp application;
- fragrance-free/hypoallergenic implication;
- multi-product or routine-level efficacy evidence;
- a directional detailed-trace rinse-behavior or buildup value;
- a proposed hard user-fit rule;
- any attempt to replace current production fields.

## 13. Calibration rule

Blind reviewers receive this standard and locked formula/source packets but not the proposed key. Compare exact agreement, adjacent agreement, mean absolute difference, maximum difference, systematic drift, completion, and coded causes. Every difference is explained as source ambiguity, missing evidence, rule ambiguity, double counting, overconfidence, or legitimate uncertainty.

Systemic rule changes require pilot rerun. Product-specific uncertainty remains uncertainty. The v1.5 Damage Fit comparison is historical provenance. For v1.6, independent Reviewer G completed `care_direction` and `repair_support_level` with 22/22 exact agreement against the accepted key. The active 94/99 pre-adjudication, 85/99 post-adjudication, and 68/77 non-focus composite preserves frozen Reviewer F values for the earlier seven fields and appends Reviewer G only for the new two; it is not a fresh de-novo nine-property blind rerun and cannot establish full v1.6 repeatability.
