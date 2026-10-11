# Round 1 report — v1.6 candidate calibration (2026-10-09)

Two sealed Opus lanes (A, B) classified the same 19 frozen, blinded packets (13 gold + 6 unseen) using only the v1.6 candidate standard (lane copy without the Guhl Hyaluron+ worked example). Records: `lane-a/`, `lane-b/`. Comparison script: `compare.py`.

## Lane vs lane

296/304 compared fields agree (97.4%): 8 direct properties + fine/normal/coarse fit + weight + primary/secondary target + cleansing intensity + deep-cleanser listing, per product.

| Product | Field | Lane A | Lane B |
| --- | --- | --- | --- |
| G02 H&S DERMAXPRO Beruhigende Pflege | conditioningLevel | high | moderate |
| G02 | scalpComfortTarget | targeted | not_targeted |
| G02 | fit.coarse | ideal | acceptable |
| G05 Wahre Schätze Sanfte Hafermilch | conditioningLevel | moderate | high |
| G05 | fit.coarse | acceptable | ideal |
| U1 Balea Tiefenreinigung | cleansingStrength | strong | moderate |
| U1 | cleansingIntensity | clarifying | regular |
| U1 | deepCleanserListing | flagged | not_flagged |

Review flags were not compared; they depend on each lane's `neighboringAlternative` convention (see ambiguities).

## Lane consensus vs earlier adjudicated v1.4 values (C50 products, fields where both lanes agree)

61/81 match (75.3%). The 20 differences:

- **Weight lighter than before (toward recommending):** G01 Guhl Anti Schuppen moderate→low, G08 Cantu moderate→low, G09 Syoss Intense Curls high→moderate, G12 Balea Ultimate Volume moderate→low, G13 Lavera moderate→low.
- **Cleansing strong → moderate:** G02, G04, G08 — consistent with the new C1 rule (sulfate base buffered by betaine = moderate, from holdout-v3).
- **Focus:** G03, G05, G13 `gentle`→ scalp_active/moisture (v1.5 retires `gentle`); G04 scalp_active→general; G06 scalp_active→clarifying; G09 general→moisture; G11 shine→moisture.
- **Other:** G06 usage regular→frequent; G08 usage alternating→regular; G09 conditioning moderate→high; U6 cleansing moderate→low, conditioning moderate→high.

Interpretation: high lane-to-lane agreement does not show the rules are right. Both lanes drift the same way on weight, toward lighter, which would make more products "ideal" for fine hair. The weight section of the merged standard does not reproduce the earlier dedicated weight adjudications (weight-final-rerun v1–v3).

## Procedure note

The 6 unseen products were classified in this round together with the gold set. They remain valid unseen tests only as long as no rule fix is tuned on them. The U1 disagreement and the deep-cleansing ambiguities (U1, U2) touch the rules, so the final unseen check should use fresh products (e.g. from Track B) instead.

## Ambiguities

Both lanes reported ~30 under-specified rules each (C1 scope, neighbor convention, D1/§9 reset precedence, E2/E4 scalp lexicon, S-SECONDARY, I3, etc.). Lane B list: `lane-b-ambiguities.md`. Lane A's list is in the session handback; it overlaps heavily.
