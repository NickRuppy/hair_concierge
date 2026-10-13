# Leave-In production adapter

Version: leave-in-production-adapter-v1

Status: projection_ready

Product: Bali Curls Bonding Repair Leave-In Cream N°3 (694c4568-9235-4893-ab54-96a75b3c4f27)

## product_leave_in_specs

- Format: cream
- Weight: medium
- Roles: replacement_conditioner
- Heat protection: true (binary only, AD-6; activation required: false)
- Care benefits: moisture, anti_frizz
- Functional benefits: moisture_softness, smooth_anti_frizz, heat_protect
- Ingredient flags: polymers, humectants
- Application stage: towel_dry
- Care direction: moisture
- Repair support level: low
- Plan roles: post_wash_leave_in, pre_heat_application

## product_leave_in_fit_specs

- Weight: medium
- Conditioner relationship: replacement_capable
- Care benefits: heat_protect, detangle_smooth

## product_leave_in_eligibility

Suitable thicknesses: normal, coarse

| Thickness | Need bucket | Styling context |
| --- | --- | --- |
| normal | heat_protect | heat_style |
| normal | moisture_anti_frizz | air_dry |
| normal | moisture_anti_frizz | non_heat_style |
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
- heat_protection_evidence_state is uncertain and affects a mapped production field; review the projection before approval.
- weight_potential is uncertain and affects a mapped production field; review the projection before approval.
- AD-5: fine carry a non-recommended fit and are excluded from the matcher.
