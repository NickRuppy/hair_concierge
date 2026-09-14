# Agreement diff — reference key vs blind review (2026-09-03)

Compared 363 value fields · 313 agree · **50 disagree** (86.2% agreement)

| Slot | Field | Reference | Blind |
|---|---|---|---|
| 1 | dim.FORM | `"two_phase"` | `"unknown"` |
| 1 | dim.ROLE | `["post_wash","refresh"]` | `["post_wash"]` |
| 1 | profile.product_form | `"two_phase"` | `null` |
| 1 | profile.scalp_application_fit | `"avoid"` | `"unknown"` |
| 1 | profile.usage_role | `["post_wash","refresh"]` | `["post_wash"]` |
| 2 | g0 | `"excluded_other_form"` | `"in_category"` |
| 3 | dim.HEAT | `"claim_only"` | `"not_claimed"` |
| 3 | dim.ROLE | `["post_wash"]` | `["ends_only","post_wash"]` |
| 3 | profile.scalp_application_fit | `"conditional"` | `"unknown"` |
| 3 | profile.usage_role | `["post_wash"]` | `["ends_only","post_wash"]` |
| 3 | focus.primary | `"general"` | `"detangling"` |
| 3 | heat.binary | `true` | `false` |
| 4 | profile.scalp_application_fit | `"avoid"` | `"unknown"` |
| 4 | texture_fit.straight | `"conditional"` | `"unknown"` |
| 4 | texture_fit.wavy | `"conditional"` | `"unknown"` |
| 4 | texture_fit.curly | `"conditional"` | `"unknown"` |
| 4 | texture_fit.coily | `"conditional"` | `"unknown"` |
| 5 | dim.SLIP | `"high"` | `"moderate"` |
| 5 | dim.R2 | `"candidate"` | `"none_visible"` |
| 5 | profile.scalp_application_fit | `"unknown"` | `"avoid"` |
| 6 | dim.SFR | `"moderate"` | `"high"` |
| 6 | dim.PERS | `"permanent_cationic"` | `"neutral_non_volatile"` |
| 6 | profile.persistence | `"high"` | `"moderate"` |
| 6 | focus.secondary | `[]` | `["detangling","smoothing"]` |
| 8 | dim.FORM | `"emulsion"` | `"unknown"` |
| 8 | dim.WT | `"moderate"` | `"high"` |
| 8 | dim.PERS | `"permanent_cationic"` | `"neutral_non_volatile"` |
| 8 | dim.DOSE | `"moderate"` | `"high"` |
| 8 | care_direction | `"unknown"` | `"moisture"` |
| 8 | profile.product_form | `"emulsion"` | `null` |
| 8 | profile.weight_potential | `"moderate"` | `"high"` |
| 8 | profile.persistence | `"high"` | `"moderate"` |
| 8 | focus.secondary | `[]` | `["detangling"]` |
| 8 | hair_thickness_fit.fine | `"conditional"` | `"caution"` |
| 8 | hair_thickness_fit.medium | `"recommended"` | `"conditional"` |
| 8 | texture_fit.straight | `"recommended"` | `"conditional"` |
| 8 | texture_fit.coily | `"conditional"` | `"recommended"` |
| 9 | care_direction | `"unknown"` | `"balanced"` |
| 9 | focus.primary | `"smoothing"` | `"repair"` |
| 9 | focus.secondary | `["repair"]` | `["smoothing"]` |
| 10 | dim.ROLE | `["heat_styling","post_wash","refresh"]` | `["post_wash","refresh"]` |
| 10 | profile.scalp_application_fit | `"unknown"` | `"conditional"` |
| 10 | profile.usage_role | `["heat_styling","post_wash","refresh"]` | `["post_wash","refresh"]` |
| 10 | focus.secondary | `["heat_styling","repair"]` | `["detangling","repair"]` |
| 11 | care_direction | `"moisture"` | `"unknown"` |
| 13 | dim.FORM | `"aqueous_or_hydroalcoholic_solution"` | `"microemulsion"` |
| 13 | dim.SLIP | `"high"` | `"moderate"` |
| 13 | dim.SFR | `"moderate"` | `"high"` |
| 13 | profile.product_form | `"aqueous_solution"` | `"microemulsion"` |
| 13 | focus.secondary | `[]` | `["smoothing"]` |

Disagreements by slot: {"1":5,"2":1,"3":6,"4":5,"5":3,"6":4,"8":13,"9":3,"10":4,"11":1,"13":5}
By field: {
 "dim.FORM": 3,
 "dim.ROLE": 3,
 "profile.product_form": 3,
 "profile.scalp_application_fit": 5,
 "profile.usage_role": 3,
 "g0": 1,
 "dim.HEAT": 1,
 "focus.primary": 2,
 "heat.binary": 1,
 "texture_fit.*": 6,
 "dim.SLIP": 2,
 "dim.R2": 1,
 "dim.SFR": 2,
 "dim.PERS": 2,
 "profile.persistence": 2,
 "focus.secondary": 5,
 "dim.WT": 1,
 "dim.DOSE": 1,
 "care_direction": 3,
 "profile.weight_potential": 1,
 "hair_thickness_fit.*": 2
}
