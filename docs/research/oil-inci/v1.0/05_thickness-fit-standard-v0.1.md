# Oil thickness fit — research standard v0.1

Prepared 2026-10-05. Status: **approved local research thickness-fit policy under OE42**. Nick accepted finalizing the complete revised table and its source-specific scenario handling after OE40/OE41 and the six-product example check. All cells and scenario rules below are settled for this research layer. This does not establish measured sensory accuracy, an intake adapter or production eligibility. The earlier proposal and candidate check remain preserved.

## Purpose and evidence ceiling

This is a practical preference estimate from formula weight plus exact supported application context. It considers both excessive load and a finish that may be less substantial than wanted. It is not only a weight-down compatibility table. Neither diameter nor approximate oil weight guarantees conditioning adequacy or establishes a universal optimum. The light/coarse condition is Nick's chosen preference prior, not a demonstrated deficiency of light oils on coarse hair.

Direct product properties stay unchanged. Fit does not revise a formula's weight or penetration/build-up. Unknown build-up is a visible research gap rather than a negative fit verdict. The [external evidence review](../../../../plans/oil-inci/research/build-up-and-thickness-fit-proposal-2026-10-05.md) supports conservative, explicitly approximate guidance; it does not empirically validate the matrix.

## Approved retained-fibre matrix

Apply only to a source-established `leave_on_fibre_conditioning` or `dry_finish` role:

| Formula weight | Fine | Normal | Coarse |
| --- | --- | --- | --- |
| light | suitable | suitable | conditional |
| medium | conditional | suitable | suitable |
| rich | conditional | conditional | suitable |
| unknown | unknown | unknown | unknown |

- `Suitable`: a reasonable thickness/weight preference under the stated supported use, without guaranteeing performance or being the best choice.
- Medium/fine and rich/fine or normal `conditional`: greater load/flattening concern; use a controlled application within published directions and the explicitly supported site. No invented numeric dose or permission to apply at the roots/ends.
- Light/coarse `conditional`: the finish may be less substantial than desired. It remains an option when a lighter finish is wanted. This is not a claim of measured insufficient conditioning, and must not trigger a fabricated instruction to increase dose or layer products.
- `Unknown`: missing usable weight or application context. No omission/null default or conversion to suitable.

Retain weight confidence, authority and nearest alternative. Derived fit cannot have stronger evidential confidence than its inputs. Sensitivity to the alternative weight is reported separately, not averaged into an invented weight class.

## Approved scenario rules

1. For an explicit `pre_wash_fibre_treatment` followed by shampoo, do not restrict any thickness based on formula weight alone. Suitable values mean no weight-only exclusion under that wash-out context, not guaranteed removal or benefit. An unknown weight may still leave this limited no-exclusion judgment possible because weight is not the gate; incomplete identity or unestablished directions still block derivation.
2. A `scalp_application` role has unknown fibre-thickness fit, with `scalp_role_not_fibre_fit`. No scalp tolerance, safety or growth judgment follows.
3. Split each scenario by supported role. A scenario that explicitly includes hair and scalp can establish a fibre pre-wash assessment and a separate unknown scalp assessment; do not collapse them.
4. Missing or contradictory removal/context remains unknown. Use published dose/time/stage/site/removal exactly; do not use marketing to create directions.
5. Keep all verdicts at role/scenario level. A pre-wash permission cannot erase a conditional retained finish. No product-wide eligibility array is emitted.
6. Curl and damage policies remain undefined. No repair, moisture/protein direction or new dryness field is added.

## Research application and provenance

The current classification standard v0.2 references this policy. Apply it after direct properties and exact directions have been completed, at role/scenario level. Preserve record-level completeness gates. Legacy product-wide fit remains unknown where scenarios differ or no aggregation policy exists; its historical reason must not override the approved role-specific overlay. Curl and damage remain policy_not_defined.

The [approved six-product overlay](../../../../data/research/oil-inci/v1.0/corpus/exploratory/thickness-fit-approved-v0.1/approved-scenario-overlay.json) uses the same frozen round-6 v0.1.1 sources and weight carry-in as the candidate check. Fit results, conditions, sources, authority, confidence and alternative sensitivity are identical. Only per-row policy_status and cell_decision are promoted to OE42. Historic reason identifiers containing the candidate prefix are retained for provenance; policy_status determines current approval status.

[OE42 authority and verification](../../../../plans/oil-inci/research/thickness-fit-oe42-finalization-2026-10-05.md). Future derivations must freeze sources and policy identity and follow the same scope/confidence boundaries. No universal product eligibility or production write follows from this approved research policy.
