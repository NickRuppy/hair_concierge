# Shampoo classification operational amendment — v1.4-draft

Policy ID: `shampoo-classification-v1.4-draft`

Analysis model version: `shampoo-inci-v1.4-draft`

Protocol key: `v2`

State: internal research overlay; v1.3 remains frozen

## Why this amendment exists

Holdout-v1 showed that the v1.3 formula engine could produce structurally valid records, but repeatability was not yet good enough for automatic new-product classification: exact agreement was 48/70 decisions (68.6%) and `focusSecondary` agreed in only 1/10 products. The problem was not the source hierarchy or the ingredient standard; it was operator ambiguity around focus, usage and net deposition.

This amendment makes those four decisions more repeatable. It does **not** claim clinical truth, exact ingredient percentages or guaranteed user outcomes. It gives researchers a consistent 80/20 rule set for direct product properties, which later fit logic can consume separately.

## Inherited rules that do not change

- Exact German identity and formula resolution remain manufacturer-first with exact-pack evidence winning for the exact GTIN when available.
- Product truth and derived user fit remain separate layers.
- Claims may explain intended use or evidence scope, but may not override an incompatible formula.
- Every property keeps its own evidence record: value, confidence, rationale, supporting formula facts, counter-signals and sources.
- `dandruffSupport` remains locked: a complete normalized INCI with **Piroctone Olamine** or **Climbazole** is `supported`; a complete formula without either is `not_supported`; incomplete, opaque or materially unresolved formula evidence is `unknown`. Tea tree oil, mint, “anti-flake” or scalp-comfort positioning does not upgrade this property to `supported`.

## Required v2 decision trace

For post-unblind v2 research, record the following under `blind-pass.json.ruleApplication`. The trace is research-process evidence and is required only for v2+ holdout/new-product runs.

```json
{
  "policyVersion": "shampoo-classification-v1.4-draft",
  "focusPrimary": {
    "claimDirection": "volume|shine|repair|clarifying|scalp_active|gentle|general|null",
    "formulaCompatible": true,
    "formulaRoute": "one concise route explanation",
    "decisionReason": "why this final primary focus was selected"
  },
  "focusSecondary": {
    "defaultEmptyConsidered": true,
    "selectedValues": [],
    "claimDirections": [],
    "independentFormulaRoutes": [],
    "distinctFromPrimary": true,
    "exception": "none|explicit_multi_benefit_two_routes"
  },
  "usageRole": {
    "defaultRole": "regular",
    "trigger": "none|explicit_frequent_non_strong|strong_plus_reset_intent|explicit_deep_cleansing|recognized_active_problem_led",
    "triggerEvidence": [],
    "rationale": "why the default stayed or why a non-default role is justified"
  },
  "weightPotential": {
    "formulaRoutes": [
      {
        "kind": "silicone|cationic_polymer|lipid_butter_oil|protein_film|humectant_refatting",
        "strength": "weak|substantive",
        "ingredientPosition": "early|mid|late_or_sub1|unknown",
        "evidence": "ingredient/system evidence"
      }
    ],
    "competingSignals": [],
    "confidenceLimit": "formula_identity|ingredient_position|sub1_uncertainty|competing_signals|none"
  }
}
```

Before claims are unblinded, freeze the formula-only packet with a separate receipt:

```json
{
  "preUnblindReceipt": {
    "schemaVersion": "shampoo-research-pre-unblind-receipt-v1",
    "payloadHash": "sha256(candidate_id, rawInci, formulaArchitecture, scoreRanges, properties, propertyRationales, propertyConfidence, formulaObservations, counterSignals)"
  }
}
```

This receipt deliberately excludes `ruleApplication` and `finalDelta`, because both are post-unblind fields. `triggerEvidence` is empty for `regular` and must contain at least one concise evidence string for every non-default usage trigger.

## 1. Primary focus

Primary focus is the product's dominant intended role after claims and formula have been reconciled.

Rule: **claims select the intended direction; formula gates whether that direction is credible.**

| Situation | Primary focus |
| --- | --- |
| A clear product name, hero claim or category points to one role and the formula has a compatible route | Use that role. |
| Multiple claims exist, but one dominates the name, range, category or instructions | Use the dominant role if formula-compatible. |
| The formula has a strong route, but the product is not positioned around that route | Usually keep the positioned role; mention the route as evidence or trade-off. |
| Claims are unsupported, contradictory or too generic | `general`. |
| A recognized anti-dandruff active is present and the product is problem-led for dandruff/scalp flakes | `scalp_active`. |
| The product is explicitly deep-cleansing/reset/clarifying and the formula supports strong cleansing or reset architecture | `clarifying`. |

Allowed values stay unchanged: `volume`, `shine`, `repair`, `clarifying`, `scalp_active`, `gentle`, `general`.

Examples:

- A shine shampoo with light conditioning and low weight can still be `shine` if the brand positions it for gloss and the formula has a plausible smoothing, acidic, film or cuticle-alignment route. It does not need high conditioning.
- A strong-cleaning everyday repair shampoo is not automatically `clarifying`; if the dominant claim is repair and the formula has credible conditioning or film support, `repair` can remain primary while cleansing strength records the stronger chassis.

## 2. Secondary focus

Secondary focus is optional. Empty is the default and should be common.

Include a secondary value only when all three are true:

1. there is a distinct secondary manufacturer/product-positioning signal;
2. there is an independent compatible formula route;
3. the value is not merely another way of saying the primary focus, `cleansingStrength`, `conditioningLevel` or `weightPotential`.

Ordinarily allow at most one secondary value.

Two secondary values are allowed only with exception `explicit_multi_benefit_two_routes`, and require:

- explicit multi-benefit positioning;
- two independent formula routes;
- both values distinct from the primary focus and from each other;
- a written reason for why one secondary value would hide a material product role.

This limit also applies to independent second labels. If a second label selects two values, its `properties.focusSecondary` record must include `exception`, matching `claimDirections` and two distinct `independentFormulaRoutes`, as well as its value and rationale. A second label may not repeat its primary focus.

Invalid secondary usage:

| Invalid pattern | Use instead |
| --- | --- |
| `general` as a secondary value | Leave secondary empty. |
| Adding `shine` because a repair formula may smooth hair | Keep `repair` primary or secondary only if shine is separately positioned and formula-routed. |
| Adding `gentle` because cleansing is not strong | Record cleansing strength and scalp exposure facts. |
| Adding `repair` for any protein or panthenol trace | Use only when claim plus route are both meaningful. |
| Adding `clarifying` only because cleansing is strong | Use `cleansingStrength: strong`; non-default usage requires the usage trigger table below. |

## 3. Usage role

Usage role defaults to `regular`. Do not over-specialize ordinary shampoos.

| Final value | Required trigger | Notes |
| --- | --- | --- |
| `regular` | `none` | Default for normal shampoos, including many strong-cleansing products when no reset/clarifying/oily-root intent is present. |
| `frequent` | `explicit_frequent_non_strong` | Requires explicit daily/frequent/mild-use positioning and non-strong cleansing. |
| `alternating` | `strong_plus_reset_intent` | Requires strong cleansing plus clarifying/reset/buildup/oily-root intent or architecture. Strong cleansing alone is not enough. |
| `occasional_reset` | `explicit_deep_cleansing` | For explicit deep-cleansing/reset products, usually outside the regular-shampoo cohort. |
| `treatment` | `recognized_active_problem_led` | For problem-led recognized active routes, especially anti-dandruff products using Piroctone Olamine or Climbazole. |

If a product is both active-led and positioned for regular use, prefer `treatment` when the recognized active route is the reason to choose it. The fit layer can still recommend a cadence later.

## 4. Weight potential

Historical v1.4-draft/v2 rule below. The route-count calibration remains reproducible under [the explicit `shampoo-weight-v1` route policy](./weight-potential-calibration.md), but it is superseded for new conclusions by [the structured whole-formula `shampoo-weight-final-v1` method](./weight-potential-final-method.md). Preserve this section and existing v2 traces for reproducibility; do not rewrite prior labels in place.

Weight potential is a net deposition-architecture call. It is not an ingredient-count score, and strong cleansing does not automatically cancel an intentional deposition route.

| Value | Architecture threshold | Typical evidence |
| --- | --- | --- |
| `low` | No substantive persistent route and fewer than two distinct weak route kinds. | Humectants only; late protein/panthenol; light botanical extracts; no silicone, cationic polymer, meaningful lipid/butter/oil or persistent film system. |
| `moderate` | One substantive route, or at least two distinct weak/late route kinds that plausibly add light residue. | Silicone alone; cationic guar/polyquat route; meaningful lipid/refatting route; protein film plus another weak route kind; 2-in-1 claim with one credible deposition route. |
| `high` | At least two distinct substantive route kinds. | Silicone plus cationic bridge; rich lipid/butter/oil route plus cationic deposition support; clearly rich 2-in-1 conditioning system with multiple persistent routes. |

Route kinds for v2 traces are:

- `silicone`
- `cationic_polymer`
- `lipid_butter_oil`
- `protein_film`
- `humectant_refatting`

Group ingredients that contribute to the same route kind; multiple late proteins or multiple humectants are not separate votes. This keeps the threshold architectural rather than an ingredient-count score.

Strength and position guidance:

| Route signal | Default strength |
| --- | --- |
| Early or mid silicone, cationic polymer, fatty alcohol/lipid/oil system with deposition support | `substantive` |
| Late or likely sub-1% protein, panthenol, humectant, botanical oil/extract without bridge | `weak` |
| Ingredient class known, position unclear | use `unknown` position and cap confidence |

Confidence caps:

| Situation | Max confidence for weight call |
| --- | --- |
| Current German manufacturer formula or exact-pack evidence; routes are clear | high for low/high boundaries, moderate-to-high for moderate |
| Preferred retailer formula only | moderate unless corroborated |
| Route depends on likely sub-1% ingredients or unknown positions | moderate |
| Strong competing signals, e.g. rich 2-in-1 claim but sparse INCI route | moderate |
| Material formula conflict | low or block the product; do not force a high-confidence call |

Final-rerun operating notes:

- In the frozen 50-product run, `complete: true` is an upstream release-eligibility assertion: each classifiable member has a canonical, approved full-INCI artifact and no material formula conflict. A future source without that complete-formula guarantee must be blocked or marked incomplete; a non-empty ingredient string alone is not evidence of completeness.
- The full-cohort report flags a directional-shift review when at least ten labels change and at least 75% of those changes move in the same direction. The flag requires an audit of the shared reasoning pattern and must never be used to tune labels toward a target distribution.

## 5. Repeatability checks

Holdout-v2 and future runs using this overlay should report:

- exact agreement across the same seven judgment properties;
- formula-derived `dandruffSupport` separately;
- default versus non-default distributions for `focusSecondary` and `usageRole`;
- non-default agreement diagnostics so a default-heavy pass is visible.

The pass bar remains the v1 threshold unless explicitly changed later: at least 75% exact agreement overall, at least 60% per judged property, and zero unresolved identity or audit failures.

Passing means the operator rules are repeatable enough for the next research gate. It does not mean the model is clinically validated or ready for user-facing activation.
