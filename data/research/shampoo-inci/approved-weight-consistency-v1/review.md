# Approved shampoo weight audit

## Executive Summary

- **Yes, the new system reaches different conclusions for many approved products.** Weight changes for 36 of 50 formulas, always upwards; 14 remain in the same band.
- **This is not evidence that 36 approvals were wrong.** The new mechanism-counting rule creates a systematic upward shift that needs calibration before replacing the baseline.
- **Your approvals are preserved.** This is a separate read-only comparison of the approved formulas, not a new product review or a database update.

## The comparison uses the exact formulas you approved

The baseline is the saved release from 26 August 2026: 50 approved products and one blocked entry. The release was rebuilt and its hash matched; approval and formula links remain valid. Each approved product contributes one row. Only weight potential is recalculated with the frozen shampoo-weight-v1 policy; all other properties and approvals remain unchanged. The analysis date is 27 August 2026.

A changed label means that two rule versions disagree. It does not identify which version is empirically more accurate.

## The shift is systematic, not a few isolated exceptions

Twenty products move from low to moderate, fifteen from moderate to high, and one from low to high. No product moves down. The chart counts all 50 approved products, including unchanged bands. This is an impact screen, not a recommended bulk update.

### Weight-label transitions

50 approved formulas; stored label compared with the new provisional rule

| Transition | Products |
| --- | ---: |
| low → moderate | 20 |
| moderate → high | 15 |
| moderate → moderate | 8 |
| low → low | 5 |
| high → high | 1 |
| low → high | 1 |

## The low-weight group shrinks from 26 products to five

High-weight classifications rise from one to seventeen. A shift of this size could materially change later fine-hair matching if weight is used there. No matching replay or user recommendation was changed in this pass; that consequence still needs explicit testing.

### Weight distribution

| Weight | Approved | New provisional |
| --- | --- | --- |
| low | 26 | 5 |
| moderate | 23 | 28 |
| high | 1 | 17 |

## A conditioning clue is being treated as a weight threshold

Nineteen of the twenty low-to-moderate changes have exactly one substantial route: a recognized cationic polymer. The rule counts that route at any ingredient-list position. Examples include Guhl Kopfhaut Sensitive, Salthouse Anti Juckreiz and Balea Ultra Sensitive. Their older reasoning allowed light conditioning without assigning moderate weight.

Sante Glossy Shine is the remaining low-to-moderate case: two weak route kinds—protein plus refatting—now reach moderate automatically. The key calibration question is whether these patterns establish noticeable weight, rather than simply some conditioning potential.

## More repeatable does not automatically mean more accurate

The primary research supports formulation-dependent deposition and conditioning; it does not validate our fixed route counts as a measurement of heaviness. [Lepilleur et al.](https://pubmed.ncbi.nlm.nih.gov/21635845/) studied how formulation composition changes deposition and sensory conditioning.

Our inference is that the recognition rules can be useful while the translation into low/moderate/high weight still needs calibration. The previous 10/10 researcher agreement demonstrated reproducibility on ten shared formulas, not universal correctness.

## Dictionary coverage and cutoff sensitivity need separate handling

Twelve products contain an ingredient the current dictionary does not resolve. Four of these change label and eight retain their previous label. These overlap with the 36 changed and 14 unchanged products—they are not twelve additional products.

Some gaps are naming or formatting coverage, such as soybean-oil aliases or citrus-oil suffixes; others are unlisted conditioning polymers. Eight products also change band when the prominence window moves between the first 8, 10 and 12 ingredients. Those windows are proxies, not concentration boundaries.

A same-band result is therefore not always a complete pass, and a computable new band is not necessarily ready for approval.

## Review the property differences, not every product from scratch

The table preserves every approved baseline alongside the provisional result and its route evidence. Changed products are listed first; dictionary gaps and window sensitivity remain visible. No row below is an automatically accepted correction.

### All 50 approved products

| Product | Approved weight | New provisional weight | Review note | New rule evidence |
| --- | --- | --- | --- | --- |
| Guhl Kopfhaut Sensitive | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #9; lipid_refatting weak: glyceryl oleate #10 |
| Salthouse Anti Fett | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #6 |
| Langhaarmädchen Beautiful Curls Shampoo | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #17; lipid_refatting weak: glyceryl oleate #11 |
| Hask Shampoo Argan Oil | moderate | high | Changed | cationic_polymer substantive: polyquaternium-10 #9, polyquaternium-7 #10; lipid_refatting substantive: argania spinosa (argan) kernel oil #7, dicaprylyl ether #12, glyceryl oleate #14 |
| Salthouse Anti Juckreiz | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #7 |
| OGX Renewing | moderate | high | Changed | silicone substantive: amodimethicone #9; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #10; lipid_refatting substantive: argania spinosa kernel oil #6, hydrogenated castor oil #11 |
| Sebamed Anti Schuppen | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl oxidized starch pg-trimonium chloride #13 |
| Syoss Intense Curls | moderate | high | Changed | silicone substantive: dimethicone #8, amodimethicone #12; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #13; lipid_refatting weak: peg-7 glyceryl cocoate #5, hydrogenated castor oil #15, prunus armeniaca (apricot) kernel oil #21; protein_film weak: hydrolyzed keratin #6 |
| Sebamed Urea 5% | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl oxidized starch pg-trimonium chloride #15; lipid_refatting weak: helianthus annuus seed oil #21 |
| Sante Glossy Shine | low | moderate | Changed | lipid_refatting weak: glyceryl oleate #14, pca glyceryl oleate #19, hydrogenated palm glycerides citrate #22, lecithin #27, ascorbyl palmitate #28; protein_film weak: hydrolyzed corn protein #10, hydrolyzed wheat protein #11, hydrolyzed soy protein #12 |
| Pantene Anti Schuppen | moderate | high | Changed | silicone substantive: dimethiconol #6, dimethicone #11; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #13 |
| Guhl Anti Schuppen | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #9; lipid_refatting weak: glyceryl oleate #7 |
| Sebamed Anti Schuppen Plus | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl oxidized starch pg-trimonium chloride #6 |
| L'Oréal Paris Elvital Glycolic Gloss Shampoo | moderate | high | Changed | silicone substantive: dimethicone #6, amodimethicone #24; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #7 |
| Guhl Kraft & Fülle | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #6; lipid_refatting weak: glyceryl oleate #7, lecithin #17 |
| Balea Ultra Sensitive | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #12; lipid_refatting weak: ascorbyl palmitate #10, glyceryl oleate #11, hydrogenated palm glycerides citrate #13, lecithin #14 |
| Syoss Intense Fullness Shampoo | moderate | high | Changed | silicone substantive: dimethicone #8, amodimethicone #12; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #13; lipid_refatting weak: peg-7 glyceryl cocoate #5, hydrogenated castor oil #15, prunus armeniaca (apricot) kernel oil #21; protein_film weak: hydrolyzed keratin #6 |
| OGX Keratin Oil | moderate | high | Changed | silicone substantive: amodimethicone #10; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #11; lipid_refatting substantive: argania spinosa kernel oil #7, hydrogenated castor oil #12; protein_film weak: hydrolyzed keratin #6 |
| Hask Curl Care Shampoo | moderate | high | Changed | cationic_polymer substantive: polyquaternium-10 #13, polyquaternium-7 #15, guar hydroxypropyltrimonium chloride #18; lipid_refatting substantive: cocos nucifera (coconut) oil #7, argania spinosa (argan) kernel oil #8, hydrogenated palm glycerides citrate #14, glyceryl oleate #16 |
| Guhl Frische und Leichtigkeit | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #8; lipid_refatting weak: glyceryl oleate #6, ascorbyl palmitate #14 |
| Balea Professional Ultimate Volume | low | moderate | Changed | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #10; protein_film weak: hydrolyzed wheat protein #6 |
| Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege | moderate | high | Changed | silicone substantive: dimethiconol #7, dimethicone #13; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #14 |
| Langhaarmädchen Lovely Long | moderate | high | Changed | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #8; lipid_refatting substantive: argania spinosa kernel oil #7, hydrogenated castor oil #16; protein_film weak: hydrolyzed wheat protein #6 |
| Sebamed Every-Day Shampoo | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl oxidized starch pg-trimonium chloride #11 |
| Balea Aqua Hyaluron | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #10; lipid_refatting weak: glyceryl oleate #9, hydrogenated palm glycerides citrate #15, lecithin #16, ascorbyl palmitate #17 |
| Balea Kopfhaut Sensitive Shampoo | low | moderate | Changed | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #14; protein_film weak: hydrolyzed keratin #12 |
| Balea Med Anti Schuppen | low | moderate | Changed | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #8; lipid_refatting weak: glyceryl oleate #13, hydrogenated palm glycerides citrate #15 |
| Syoss Intense Volume Shampoo | low | moderate | Changed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #18; lipid_refatting weak: glyceryl oleate #10, peg-7 glyceryl cocoate #12, hydrogenated castor oil #16; protein_film weak: hydrolyzed keratin #5 |
| Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege | moderate | high | Changed; Cutoff-sensitive | silicone substantive: dimethiconol #9, dimethicone #10; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #17 |
| Head & Shoulders Anti Schuppen Sensitive | moderate | high | Changed; Cutoff-sensitive | silicone substantive: dimethiconol #10, dimethicone #14; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #12 |
| Pantene Grow Abundance | moderate | high | Changed; Cutoff-sensitive | silicone substantive: dimethiconol #10, dimethicone #14; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #11 |
| Nivea Shampoo&Conditioner 2in1 | moderate | high | Changed; Cutoff-sensitive | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #9; lipid_refatting substantive: dicaprylyl ether #10, glyceryl oleate #11, hydrogenated castor oil #14 |
| Salthouse Anti Schuppen | low | moderate | Changed; Dictionary: citrus sinensis peel oil expressed | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #6; lipid_refatting weak: litsea cubeba fruit oil #18 |
| Cantu Shampoo Locken Pflege | moderate | high | Changed; Dictionary: polyquaternium-39; Cutoff-sensitive | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #15; lipid_refatting substantive: butyrospermum parkii (shea) butter #10 |
| Pantene Hydra Glow Shampoo | low | high | Changed; Dictionary: polyquaternium-6 | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #15; lipid_refatting substantive: stearyl alcohol #6, cetyl alcohol #9 |
| Dejan Garz Shampoo | low | moderate | Changed; Dictionary: quaternium-80 | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #10; lipid_refatting weak: glyceryl oleate #8, hydrogenated palm glycerides citrate #11, lecithin #15, ascorbyl palmitate #16 |
| Swiss-O-Par Teebaumöl | low | low | Same band | lipid_refatting weak: peg-7 glyceryl cocoate #6 |
| Sante Sensitive Care | low | low | Same band | protein_film weak: hydrolyzed corn protein #13, hydrolyzed wheat protein #14, hydrolyzed soy protein #15 |
| Pantene Pro-V Volumen Pur | low | low | Same band | No counted deposition route |
| Schauma Anti Schuppen | moderate | moderate | Same band | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #11; lipid_refatting weak: glyceryl oleate #8, hydrogenated castor oil #13, peg-7 glyceryl cocoate #16 |
| Balea 2 in 1 Urea 5% | moderate | moderate | Same band | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #17; lipid_refatting weak: ascorbyl palmitate #11, glyceryl oleate #13, hydrogenated palm glycerides citrate #18, lecithin #19 |
| Hair Biology Revitalize & Soothe | high | high | Same band; Cutoff-sensitive | silicone substantive: dimethiconol #10, dimethicone #13; cationic_polymer substantive: guar hydroxypropyltrimonium chloride #15 |
| Lavera Basis Sensitiv | moderate | moderate | Same band; Dictionary: citrus aurantium peel oil**, citrus limon (lemon) peel oil**, citrus aurantium bergamia (bergamot) peel oil**, lavandula oil/extract**; Cutoff-sensitive | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #21; lipid_refatting weak: helianthus annuus (sunflower) seed oil #11, cetearyl alcohol #15, pca glyceryl oleate #16 |
| Wahre Schätze Sanfte Hafermilch | moderate | moderate | Same band; Dictionary: glycine soja oil/soybean oil, peg-60 hydrogenated castor oil | cationic_polymer substantive: hydroxypropyl guar hydroxypropyltrimonium chloride #19, polyquaternium-7 #22; lipid_refatting weak: dicaprylyl ether #13 |
| Guhl Hyaluron+ | moderate | moderate | Same band; Dictionary: hydrogenated vegetable oil | cationic_polymer substantive: guar hydroxypropyltrimonium chloride #9; lipid_refatting weak: glyceryl oleate #8 |
| Neqi Moisture Mystery | low | low | Same band; Dictionary: juniperus virginiana oil | lipid_refatting weak: peg-18 glyceryl oleate/cocoate #5 |
| Neqi Volume Victory | low | low | Same band; Dictionary: juniperus virginiana oil, polyquaternium-11 | lipid_refatting weak: peg-18 glyceryl oleate/cocoate #5 |
| Monday Haircare Volume Kraft & Fülle Shampoo | moderate | moderate | Same band; Dictionary: polyquaternium-11; Cutoff-sensitive | cationic_polymer substantive: polyquaternium-10 #13, hydroxypropyl guar hydroxypropyltrimonium chloride #20, polyquaternium-7 #21; lipid_refatting weak: cocos nucifera (coconut) oil #11, glyceryl oleate #15 |
| OGX Biotin & Collagen | moderate | moderate | Same band; Dictionary: starch hydroxypropyltrimonium chloride | silicone substantive: amodimethicone #10; lipid_refatting weak: glyceryl oleate #12, hydrogenated palm glycerides citrate #16, lecithin #19, ascorbyl palmitate #27 |
| OGX Rosemary | moderate | moderate | Same band; Dictionary: starch hydroxypropyltrimonium chloride | silicone weak: amodimethicone #11; lipid_refatting weak: glyceryl oleate #15, lecithin #16, hydrogenated palm glycerides citrate #23, ascorbyl palmitate #29 |

## Keep approvals intact and calibrate the boundary first

1. Retain the approved release as the baseline and keep this comparison as a separate version.
2. Revisit the automatic moderate-weight floor for a single conditioning polymer and the automatic upgrade from two weak routes. Do not force the outcome to reproduce the old distribution.
3. Resolve ingredient aliases and missing polymer families without treating a missing dictionary entry as evidence of low weight.
4. Use representative light, rich, silicone-containing and boundary formulas to test the revised rule against independently established product behavior where available.
5. Rerun the full approved cohort. Ask for approval only on evidence-backed changed properties, then separately replay profile matching before any production rollout.

## What still needs an answer

Which evidence should distinguish lightweight conditioning from a meaningful loss of movement or root lift? Are early silicones or fatty alcohols plus a polymer sufficient for high weight in each formula, or are some serving mainly formulation roles? Those are model-calibration questions; neither the old labels nor the new deterministic output are a gold standard.

## Limits of this audit

This pass verifies weight-rule consistency and preserves the original formulas. It does not refresh manufacturer pages, measure deposition or heaviness, rerun every other research property, or determine the final impact on personal recommendations. Product confidence is not raised merely because the rule is deterministic. There are no approval or live-data changes.
