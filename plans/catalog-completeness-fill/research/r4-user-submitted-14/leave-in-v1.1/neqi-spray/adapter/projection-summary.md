# Leave-In production adapter

Version: leave-in-production-adapter-v1

Status: projection_ready

Product: Diamond Glass Ultimate Styling Spray (leave-in-gold-set-slot-13)

## product_leave_in_specs

- Format: spray
- Weight: medium
- Roles: replacement_conditioner, styling_prep
- Heat protection: true (binary only, AD-6; activation required: false)
- Care benefits: anti_frizz
- Functional benefits: smooth_anti_frizz, heat_protect
- Ingredient flags: silicones, humectants
- Application stage: towel_dry, pre_heat
- Care direction: balanced
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

- product_form is uncertain and affects a mapped production field; review the projection before approval.
- conditioning_level is uncertain and affects a mapped production field; review the projection before approval.
- weight_potential is uncertain and affects a mapped production field; review the projection before approval.
- hold_support is uncertain and affects a mapped production field; review the projection before approval.
- care_direction is uncertain and affects a mapped production field; review the projection before approval.
- focus is uncertain and affects a mapped production field; review the projection before approval.
- fragrance_scalp_exposure is uncertain in a retained research-only field; it does not change the current production projection.
- AD-5: fine carry a non-recommended fit and are excluded from the matcher.
