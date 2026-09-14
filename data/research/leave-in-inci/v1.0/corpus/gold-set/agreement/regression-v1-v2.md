# Agreement diff — REGRESSION ref-key v1 vs ref-key v2 (2026-09-03)

Compared 363 value fields · 303 agree · **60 disagree** (83.5% agreement)

| Slot | Field | Reference | Blind |
|---|---|---|---|
| 1 | dim.WT | `"high"` | `"moderate"` |
| 1 | dim.ROLE | `["post_wash","refresh"]` | `["ends_only","post_wash","refresh"]` |
| 1 | profile.usage_role | `["post_wash","refresh"]` | `["ends_only","post_wash","refresh"]` |
| 2 | g0 | `"excluded_other_form"` | `"in_category"` |
| 3 | dim.HEAT | `"claim_only"` | `"not_claimed"` |
| 3 | dim.ROLE | `["post_wash"]` | `[]` |
| 3 | profile.scalp_application_fit | `"conditional"` | `"avoid"` |
| 3 | profile.usage_role | `["post_wash"]` | `[]` |
| 3 | heat.binary | `true` | `false` |
| 4 | dim.WT | `"high"` | `"moderate"` |
| 4 | dim.ROLE | `["post_wash","refresh"]` | `["ends_only","post_wash","refresh"]` |
| 4 | profile.weight_potential | `"high"` | `"moderate"` |
| 4 | profile.usage_role | `["post_wash","refresh"]` | `["ends_only","post_wash","refresh"]` |
| 4 | hair_thickness_fit.fine | `"caution"` | `"conditional"` |
| 4 | hair_thickness_fit.medium | `"conditional"` | `"recommended"` |
| 4 | texture_fit.straight | `"conditional"` | `"recommended"` |
| 4 | texture_fit.wavy | `"conditional"` | `"recommended"` |
| 4 | texture_fit.curly | `"conditional"` | `"recommended"` |
| 5 | dim.SLIP | `"high"` | `"moderate"` |
| 5 | dim.HEAT | `"claim_only"` | `"not_claimed"` |
| 5 | dim.R2 | `"candidate"` | `"none_visible"` |
| 5 | dim.ROLE | `["heat_styling","post_wash","refresh"]` | `[]` |
| 5 | profile.scalp_application_fit | `"unknown"` | `"avoid"` |
| 5 | profile.usage_role | `["heat_styling","post_wash","refresh"]` | `[]` |
| 5 | focus.secondary | `["heat_styling"]` | `[]` |
| 5 | heat.binary | `true` | `false` |
| 6 | dim.SFR | `"moderate"` | `"high"` |
| 6 | dim.ROLE | `["curl_styling","post_wash"]` | `[]` |
| 6 | profile.scalp_application_fit | `"unknown"` | `"avoid"` |
| 6 | profile.usage_role | `["curl_styling","post_wash"]` | `[]` |
| 6 | focus.primary | `"curl_definition"` | `"general"` |
| 7 | g0 | `"excluded_styling_first"` | `"provisional_boundary"` |
| 8 | care_direction | `"unknown"` | `"moisture"` |
| 8 | profile.scalp_application_fit | `"unknown"` | `"avoid"` |
| 9 | dim.SLIP | `"high"` | `"moderate"` |
| 9 | care_direction | `"unknown"` | `"protein"` |
| 9 | profile.scalp_application_fit | `"unknown"` | `"avoid"` |
| 9 | damage_fit.healthy | `"recommended"` | `"conditional"` |
| 9 | damage_fit.highly_damaged | `"conditional"` | `"recommended"` |
| 10 | dim.R2 | `"candidate"` | `"none_visible"` |
| 10 | dim.ROLE | `["heat_styling","post_wash","refresh"]` | `["post_wash"]` |
| 10 | profile.scalp_application_fit | `"unknown"` | `"avoid"` |
| 10 | profile.usage_role | `["heat_styling","post_wash","refresh"]` | `["post_wash"]` |
| 10 | focus.secondary | `["heat_styling","repair"]` | `[]` |
| 10 | damage_fit.healthy | `"conditional"` | `"recommended"` |
| 10 | damage_fit.highly_damaged | `"recommended"` | `"conditional"` |
| 11 | dim.PERS | `"volatile_or_water_soluble"` | `"neutral_non_volatile"` |
| 11 | profile.persistence | `"low"` | `"moderate"` |
| 11 | focus.primary | `"volume_lightness"` | `"detangling"` |
| 11 | focus.secondary | `[]` | `["volume_lightness"]` |
| 13 | g0 | `"in_category"` | `"provisional_boundary"` |
| 13 | dim.FORM | `"aqueous_or_hydroalcoholic_solution"` | `"unknown"` |
| 13 | dim.SLIP | `"high"` | `"moderate"` |
| 13 | dim.PERS | `"permanent_cationic"` | `"neutral_non_volatile"` |
| 13 | dim.HOLD | `"incidental_film"` | `"meaningful_hold_route"` |
| 13 | dim.R2 | `"candidate"` | `"none_visible"` |
| 13 | care_direction | `"unknown"` | `"moisture"` |
| 13 | profile.product_form | `"aqueous_solution"` | `"unknown"` |
| 13 | profile.persistence | `"high"` | `"moderate"` |
| 13 | profile.hold_support | `"incidental"` | `"meaningful"` |

Disagreements by slot: {"1":3,"2":1,"3":5,"4":9,"5":8,"6":5,"7":1,"8":2,"9":5,"10":7,"11":4,"13":10}
By field: {
 "dim.WT": 2,
 "dim.ROLE": 6,
 "profile.usage_role": 6,
 "g0": 3,
 "dim.HEAT": 2,
 "profile.scalp_application_fit": 6,
 "heat.binary": 2,
 "profile.weight_potential": 1,
 "hair_thickness_fit.*": 2,
 "texture_fit.*": 3,
 "dim.SLIP": 3,
 "dim.R2": 3,
 "focus.secondary": 3,
 "dim.SFR": 1,
 "focus.primary": 2,
 "care_direction": 3,
 "damage_fit.*": 4,
 "dim.PERS": 2,
 "profile.persistence": 2,
 "dim.FORM": 1,
 "dim.HOLD": 1,
 "profile.product_form": 1,
 "profile.hold_support": 1
}
