# Mask v1.0 property set (v0 — ruled shape, pre-calibration)

Status: ruled by Nick 2026-09-04 (Phase 2 checkpoint); values and thresholds remain provisional
until the first calibration set is reviewed ("first set, then adjust" caveat).
Charter: `00_category_charter.md`. Evidence basis: `planning-evidence/2026-09-04-mask-formulation-evidence.md`.

## Ruled shape: conditioner-parity nine-field comparison profile

The Mask comparison profile keeps the Conditioner v1.6 nine-field shape and vocabulary,
re-anchored within the mask category. Anchors and thresholds are earned per property in the
Phase 3 standard; nothing is copied silently.

| # | Property | Values | Decision type | Projects to (fixed targets) |
|---|---|---|---|---|
| 1 | `conditioning_level` | low / moderate / high | structured judgment | `product_mask_specs.concentration` (low/medium/high) |
| 2 | `weight_potential` | low / moderate / high | structured judgment | `weight` (light/medium/rich) |
| 3 | `care_direction` | protein / moisture / balanced | structured judgment | `balance_direction` |
| 4 | `repair_support_level` | low / medium / high | structured judgment; `high` gated on deterministic named bond chemistry | `repair_support_level` |
| 5 | `primary_focus` | conditioner focus vocabulary **+ `moisture`** (ruled by Nick 2026-09-04) | structured judgment (forced headline) | via benefits mapping |
| 6 | `secondary_focus` | 0–2 values from the same vocabulary | structured judgment | via benefits mapping |
| 7 | `hair_thickness_fit` | subset of fine/normal/coarse | derived deterministic policy from weight | `suitable_thicknesses` |
| 8 | `damage_fit` | subset of healthy/moderately_damaged/highly_damaged | derived policy (specialist-route rule) | research-only (no current consumer) |
| 9 | `texture_fit` | subset of straight/wavy/curly/coily | derived policy | research-only (no current consumer) |

`ingredient_flags` (silicones/polymers/oils/proteins/humectants) are deterministic presence
flags from the normalized complete INCI and project directly; they are not a judgment field.

### D1 ruling — `concentration` semantics

`concentration` is the mask twin of Conditioner's `conditioning_level`: overall
conditioning/treatment intensity relative to the mask category, from structural INCI position
only (cationic count and rank, fatty-alcohol rank, lipid-above-tail breadth). Ingredients after
the fragrance/preservative block contribute nothing. Extremes require multiple independent
structural signals; unresolvable cases fall back to moderate + `uncertain_fields` (NEQI
fallback pattern). Repair stays owned by `repair_support_level`. Note (production, not
research): matching currently consumes `concentration` as a repair-need proxy
(`mask_concentration_is_temporary_repair_level_proxy`); whether production later matches
repair need against `repair_support_level` instead is a production-policy question outside
this project.

### D5 ruling — `moisture` focus value (Nick, 2026-09-04)

The mask focus vocabulary is Conditioner v1.6's eight values plus `moisture`:
`moisture / lightness / detangling / smoothing / repair / shine / curl_support / color_care / general`.
Guard (tested 2026-09-04 on four real formulas): glycerin alone never qualifies — `moisture`
requires at least two further distinct humectants above the fragrance/preservative tail
(panthenol, hyaluronate, aloe, urea, glycols, betaine, sodium PCA, …) and no richer
special-purpose route winning. Intensive conditioning alone never qualifies (category
baseline). Discrimination evidence: Balea Aqua Hyaluron 3in1 (4 humectants above tail, no
protein/bond/silicone routes) and Guhl 30 sek Feuchtigkeit (3 humectants, no competing route)
clear it; Gliss Bonding (glycerin #3 but repair routes win) and Pantene Bond (no cluster)
correctly fail. E2 wording: "humectant-forward comparative direction", never proven hydration.
Provenance note: Mask is the first engine with `moisture` as a focus value. Shampoo explicitly
declined one (holdout-v3 operator clarification folds moisture into repair/general — correct
for a cleanser, where humectant presence is weak evidence); conditioner v1.6 and the leave-in
v0.3 draft have none. Production precedent: leave-in `care_benefits` carries `moisture` live on
30 products, plus `care_direction: moisture`.
Adapter note: `moisture` focus has no counterpart in `functional_benefits` (fixed vocabulary);
the moisture identity projects through `balance_direction`, so no adapter change is needed.

### D2 ruling — benefits via hierarchy

`primary_focus`/`secondary_focus` are researched with the Conditioner focus discipline
(shared-mechanism gates, distinctiveness thresholds, anti-double-counting; shine never a free
add-on of the smoothing film). The adapter derives flat `functional_benefits` deterministically
from hierarchy + supported capabilities: smoothing → `smoothing_frizz_control`, detangling →
`detangling_slip`, shine → `shine`. Gloss/lamination masks (charter F4) route through the shine
threshold with claim corroboration; there is no separate lamination property (evidence §7).

### D4 ruling — overload handling

Heavy protein payload is trace evidence + an internal counter-signal (confidence cap on
`care_direction`, human-review trigger). It is never a comparison field or user-facing verdict.
Parked out of scope (Nick, 2026-09-04): a routine-level protein-stacking heads-up (warning when
protein-focused products combine across one routine) belongs to the production/fit layer as its
own later decision.

## Trace-level additions (beneath the comparison profile)

- `bond_route` ∈ { maleate, gluconamide, peptide, none } — deterministic, by named INCI above
  the sub-1% tail. Citric acid, "Bond" naming, and hydrolyzed protein alone never qualify.
  Gates `repair_support_level: high`.
- Protein-payload counter-signal record (per D4).
- `multi_use` envelope flag + uncovered modes (charter F1).

## Explicitly protocol-only (zero classification credit — evidence-inherited)

Dwell time (7-second segment marked unknown, never extrapolated), heat assist, cadence,
amount. All remain sourced protocol metadata under TPL-MASK/P5.

## Not formula-inferable (trace-only or absent)

Buildup/cumulative residue, dwell efficacy, heat benefit, penetration depth, rinse behavior,
and the mask-vs-conditioner category itself (metadata/directions decide at G0, per evidence §1).

## Watch-list for the first-set review (Nick's iterate caveat)

1. `damage_fit` — possibly fully derivable from conditioning level + repair route; could become
   a computed row.
2. `primary_focus: lightness` — may go unused in this category (Nick acknowledged 2026-09-04).

`texture_fit` is off the watch-list: Nick ruled 2026-09-04 that it is needed down the line for
user-profile matching even though mask matching does not consume it today.
