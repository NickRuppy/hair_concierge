# Leave-In production adapter

Version: leave-in-production-adapter-v1

Status: projection_ready

Product: Balea Professional Brilliant Blond Hair Sealer Leave-in Serum (ea88a333-b11c-45c3-bbda-c51f912ee56f)

## product_leave_in_specs

- Format: serum
- Weight: rich
- Roles: replacement_conditioner
- Heat protection: true (binary only, AD-6)
- Heat activation: not_required (AD-7)
- Care benefits: anti_frizz
- Functional benefits: smooth_anti_frizz, heat_protect
- Ingredient flags: silicones, polymers, oils, proteins, humectants
- Application stage: towel_dry, dry_hair
- Care direction: balanced
- Repair support level: low
- Plan roles: post_wash_leave_in, pre_heat_application

## product_leave_in_fit_specs

- Weight: rich
- Conditioner relationship: replacement_capable
- Care benefits: heat_protect, detangle_smooth

## product_leave_in_eligibility

Suitable thicknesses: coarse

| Thickness | Need bucket | Styling context |
| --- | --- | --- |
| coarse | heat_protect | heat_style |
| coarse | moisture_anti_frizz | air_dry |
| coarse | moisture_anti_frizz | non_heat_style |

Required protocol roles: post_wash_leave_in, pre_heat_protection

## Retained research-only properties

- persistence_removal_class_detail
- hold_route_detail_beyond_three_state
- smoothing_route_detail
- damage_fit
- texture_fit
- cautions_de
- hinweise
- tail_marker_trace
- assumption_notes

## Warnings

- care_direction is uncertain and affects a mapped production field; review the projection before approval.
- conditioning_potential is uncertain and affects a mapped production field; review the projection before approval.
- heat_protection_evidence_state is uncertain and affects a mapped production field; review the projection before approval.
- persistence_removal_class is uncertain and affects a mapped production field; review the projection before approval.
- weight_potential is uncertain and affects a mapped production field; review the projection before approval.
- weight_residue_potential is uncertain and affects a mapped production field; review the projection before approval.
- AD-5: fine, medium carry a non-recommended fit and are excluded from the matcher.
