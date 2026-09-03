# Conditioner v1.4-rc1 calibration disagreement log

> Historical calibration record. The original blind and direct-property evidence below remains immutable provenance. v1.5 Damage Fit metrics are historical. v1.6 has an independent 22/22 comparison for its two new properties, but no fresh de-novo nine-property repeatability result.

Status: revised Stage A clean-room calibration complete
Date: 2026-08-25
Standard: conditioner-classification-standard.v1.4-rc1

## Independence receipt

The first attempted blind run is rejected because it inherited proposed-key context. It is preserved as `calibration-reviewer-b-invalid.json` with `usable_for_agreement_metrics=false`.

Reviewer C was started with zero inherited turns and read only:

- the frozen `v1.0-rc1` standard;
- `calibration-pilot-formulas.json`;
- the blank blind-review packet.

Its accepted artifact records `prohibited_files_accessed=false` and `inherited_key_context=false`. Reviewer C did not read the proposed key, the invalid run, this disagreement log, or the stress results.

## Final metrics

| Metric | Result |
|---|---:|
| Pilot packets | 12 |
| Eligible formula comparisons | 11 |
| G0 boundary exclusions | 1, matched |
| Direct-property cells | 176 |
| Exact agreement | 157 / 176 = 89.2% |
| Ordinal cells with scores on both sides | 122 |
| Adjacent agreement | 122 / 122 = 100.0% |
| Ordinal mean absolute difference | 0.139 |
| Maximum ordinal difference | 1 band |
| Material disagreements | 0 |

The metrics are repeatability evidence, not proof that either reviewer has measured product performance.

## Historical direct-property dashboard

This 176-cell dashboard is preserved as provenance from the earlier direct-property calibration. It includes the then-researched `usage_role`; v1.4 does not project that field into the current comparison profile.

| Property | Exact | Adjacent | Maximum distance |
|---|---:|---:|---:|
| conditioning_deposition_potential | 10/11 | 11/11 | 1 |
| wet_slip_detangling_potential | 10/11 | 11/11 | 1 |
| dry_combability_potential | 10/11 | 11/11 | 1 |
| surface_lubrication_softness_potential | 8/11 | 11/11 | 1 |
| smoothing_frizz_control_potential | 9/11 | 11/11 | 1 |
| shine_potential | 9/11 | 11/11 | 1 |
| weight_deposition_potential | 9/11 | 11/11 | 1 |
| body_lightness_potential | 9/11 | 11/11 | 1 |
| repair_lubrication_protection | 11/11 | 11/11 | 0 |
| repair_surface_film | 8/11 | 11/11 | 1 |
| bond_specific_support | 9/11 | 1/1 scored | 0 |
| color_chemical_damage_protection | 11/11 | 11/11 | 0 |
| rinse_behavior | 11/11 | not ordinal | n/a |
| cumulative_residue_risk | 11/11 | not ordinal | n/a |
| fragrance_scalp_exposure | 11/11 | not ordinal | n/a |
| usage_role | 11/11 | not ordinal | n/a |

## Accepted answer-key corrections

1. All eligible `usage_role` values became `unknown`: the blind packet omitted authoritative directions, so the proposed key had exceeded E1 evidence.
2. Balea Med and Frizz Ease `repair_surface_film` became `none_visible`: R3 cationic-polymer and R4 emollient routes do not automatically establish R5.
3. Hair Food Aloe moved five architecture properties to higher/likely-depositing: its high-list oil/emollient cluster and amidoamine/fatty-alcohol base are two independent, endpoint-relevant observations.

The comparison was recomputed after these corrections; Reviewer C values were not changed.

## Remaining non-exact cells

All 19 remaining cells are enumerated in `calibration-agreement.json`. Their coded causes are:

- legitimate one-band threshold uncertainty for Balea Med;
- generic-repair versus bond-specific claim-scope ambiguity for Frizz Ease and Guhl Panthenol;
- bottle-rheology or tail-signal overextension for Hair Food Aloe, Bali Curls, and Guhl Bond+ R5 film candidates;
- one overconfident softness inference for Guhl Panthenol;
- shared-mechanism double counting across several Jean&Len and Guhl Bond+ endpoints.

No remaining difference changes Gate G0, breaks the E2 formula ceiling, asserts rinse or cumulative residue from INCI, turns repair into structural restoration, or crosses more than one ordinal band.

## Rule disposition

The calibrated v1.0 standard clarifies that:

- directions must be present in the reviewed packet to assign an E1 usage role;
- R3 cannot populate `repair_surface_film` by itself;
- generic gums, starches, and bottle-rheology signals do not establish R5 by themselves;
- a shared mechanism cannot be counted as several endpoint-relevant observations.

These are evidence-firewall clarifications, not a new scientific mechanism. The five adversarial stress cases still pass, so no systemic rule change is required.

## Historical nine-field profile recalibration and current projection

The lean profile now excludes `rinseability`. Actual `rinse_behavior` remains a detailed research endpoint and stays `unknown` without exact finished-product testing. Bali Curls 75 ml was reanalysed from the manufacturer formula, confirmed by an exact-EAN retailer; the dm transcription is source history and the Flaconi formula belongs to a different EAN.

Reviewer F independently completed the then-current nine-field profile for the same 11 eligible products. It received only the standard, formula packet, direction packet, blank profile packet, and reviewed direct-property evidence; it did not receive the accepted profile key or earlier reviewer/agreement artifacts. v1.4 removes `usage_role` and `scalp_application_fit` from comparison because they collapsed to category defaults or label wording. Exact directions remain protocol metadata.

| Metric | Result |
|---|---:|
| Eligible complete profiles | 11 / 11 |
| Matched leave-in exclusion | 1 / 1 |
| Historical profile cells | 99 |
| Historical Reviewer F blind baseline | 94 / 99 = 94.9% |
| Current retained comparison cells | 77 |
| Retained Reviewer F blind baseline | 72 / 77 = 93.5% |
| Current accepted key | 70 / 77 = 90.9% |
| Current non-focus fields | 53 / 55 |
| Focus differences | 5 cells across 3 products |
| Human policy overrides | 2 NEQI non-focus cells |
| Five named recalibration products | primary and secondary focus exact |
| Systemic rule changes | 0 |

Five differences are hierarchy judgments within `primary_focus` or `secondary_focus`: Cantu Conditioner Cream, Jean&Len Colorglow, and Bali Curls. Reviewer F matches Hair Food Aloe, NEQI Volume Victory, John Frieda Wunder-Reparatur, Guhl Panthenol 2in1, and OGX Biotin & Collagen on focus. Nick approved the accepted curl, shine, and repair boundaries. Two later NEQI differences are explicit human policy overrides: moderate weight instead of high, and fine hair restored to the broad thickness prior. A fresh blind rerun is required before calling that new fallback independently repeatable.

The current seven-field results are reported separately from both the historical nine-field artifact and the historical 176-cell direct-property calibration; they do not alter those provenance metrics.

## Historical v1.5 Damage Fit addendum

Nick approved a stricter comparative threshold after reviewing the Lab. General high conditioning no longer includes `highly_damaged` without a distinct protein/peptide/keratin film route, named bond chemistry, exceptional corroborated protection, or relevant exact-product testing. Generic silicone, oil, panthenol, ceramide, cationic polymer, repair naming, and generic lubrication candidates remain insufficient.

- Eight profiles now map to `healthy` + `moderately_damaged`.
- NEQI (oat peptide), OGX (hydrolyzed collagen), and Bond+ (named bond pair) retain `moderately_damaged` + `highly_damaged`.
- The accepted key versus the frozen Reviewer F baseline is 63/77 overall and 46/55 on non-focus fields.
- The seven Damage Fit differences are explicit human adjudications. A fresh blind rerun was required before claiming v1.5 repeatability; v1.6 now requires a nine-property rerun.

## v1.6 extension status

`care_direction` (`protein` / `moisture` / `balanced`) and `repair_support_level` (`low` / `medium` / `high`) are new v1.6 comparison fields. Independent Reviewer G completed them for all 11 eligible formulas with 22/22 exact agreement against the accepted key. The active composite retains frozen Reviewer F values for the historical seven fields and appends only Reviewer G's two fields: 94/99 pre-adjudication, 85/99 post-adjudication, and 68/77 non-focus. It is not a de-novo nine-property blind output, so the historical evidence in this log cannot establish full v1.6 repeatability. Product care direction is not a diagnosed user deficiency, and formula-only repair support remains E2 rather than structural repair.
