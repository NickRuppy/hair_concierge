# Weight potential: reproducible route rules

Policy: `shampoo-weight-v1`. Status: internal calibration, not production activation.

For new weight-calibration passes this replaces only section 4 of the [v1.4-draft amendment](./operational-amendment.md). Other properties, historical audits, approvals and v1/v2 validators remain unchanged. A current run must name this policy explicitly; never relabel historical records in place.

## What this predicts

Relative potential to leave noticeable conditioning residue that reduces movement or root lift after rinsing. It is not a measured buildup rate, a quality rating, or a prediction for every hair type. Cleansing strength, scalp support, product positioning and personal fit are separate inputs/outputs, not votes in this classification.

## Evidence versus operational choices

Primary research supports cationic-polymer conditioning and formulation-dependent silicone deposition. Polymer chemistry and blend composition affect deposition; ingredient presence does not establish the deposited amount. See [Jordan et al., 2009](https://pubmed.ncbi.nlm.nih.gov/19450423/) and [Lepilleur et al., 2011](https://pubmed.ncbi.nlm.nih.gov/21635845/). A model-surface study also found that surfactant ratios, salt and polymer presence changed oil adhesion; this is mechanism evidence, not a finished-shampoo weight test ([Stanimirova et al., 2019](https://arxiv.org/abs/1905.10997)).

The route-count thresholds and position window below are **explicit internal heuristics**, not thresholds established by those papers. Their purpose is reproducible broad classification. Laboratory deposition/combability is not identical to perceived heaviness. This evidence check is why we retain uncertainty instead of assigning invented concentration percentages or accuracy estimates.

## 1. Extract facts, not a conclusion

Use the canonical normalized INCI array. Positions are 1-based including water; bilingual aliases within one token remain one ingredient. Record actual ingredient names and positions for every route. Do not split an INCI such as `PEG-18 Glyceryl Oleate/Cocoate` at its slash. No brand, repair/volume claim, old label or cleanser label is needed.

The **prominent window is positions 1–10**. This is a repeatability convention, not evidence of being above 1%. Repeat the calculation at windows 8 and 12 to expose sensitivity. Ingredients outside the window are not automatically ineffective; the cationic-polymer exception below is explicit.

## 2. Recognition rows and strength rules

| Route | Recognized evidence in this policy | Substantive rule | Otherwise |
| --- | --- | --- | --- |
| `cationic_polymer` | Guar Hydroxypropyltrimonium Chloride; Hydroxypropyl Guar Hydroxypropyltrimonium Chloride; Polyquaternium-7; Polyquaternium-10; Hydroxypropyl Oxidized Starch PG-Trimonium Chloride | Presence of one recognized polymer, at any position. These are purpose-specific conditioning/deposition clues. Multiple polymers remain **one route**. | Unlisted cationic polymers are a recognition gap, not automatically substantive. |
| `silicone` | Dimethicone; Dimethiconol; Amodimethicone; Bis-Aminopropyl Dimethicone | At least one listed nonvolatile silicone inside the prominent window. | Recognized silicone only outside the window = weak. Other silicone types require review, not an assumed equivalent. |
| `lipid_refatting` | Nonvolatile botanical seed/kernel/fruit oils and butters; Hydrogenated Castor Oil; Cetyl/Stearyl/Cetearyl/Behenyl Alcohol; Dicaprylyl Ether; Octyldodecanol; refatters listed below | At least one **payload** oil/butter/fatty alcohol/emollient inside the prominent window **and** a recognized cationic-polymer route. An isolated refatter is not a payload for this rule. | Any eligible lipid/refatter without both conditions = weak. Multiple oils/refatters still form **one route**. |
| `protein_film` | Ingredients explicitly naming protein or keratin; Hydrolyzed Silk; includes cationic proteins such as Hydroxypropyltrimonium Lemon Protein | No automatic substantive assignment in this INCI-only policy. Neither early position nor multiple proteins establishes a heavy persistent film. | Recognized protein(s) = one weak route. Amino acids, biotin and panthenol are not protein film. |

**Payload recognition:** botanical names ending in `oil` with seed/kernel/fruit/pulp wording, plus common `Cocos Nucifera Oil`, `Olea Europaea Oil`, `Persea Gratissima Oil`, and `Argania Spinosa Oil`; botanical names ending in `butter`; the specifically named oil, fatty alcohol and emollient entries above. Parenthetical common-name aliases may be removed for recognition, never for the stored physical fingerprint. Essential/fragrance oils are excluded first: citrus peel, mint/mentha, lavender/lavandula, eucalyptus, rosemary/rosmarinus, tea tree/melaleuca, clove/eugenia, cinnamon/cinnamomum, thyme/thymus, sage/salvia, patchouli/pogostemon and ylang/cananga oils. Any other oil without a recognized payload pattern is an unresolved function, not a forced payload.

**Weak refatters:** Glyceryl Oleate, PCA Glyceryl Oleate, PEG-7 Glyceryl Cocoate, PEG-18 Glyceryl Oleate/Cocoate, Hydrogenated Palm Glycerides Citrate, Lecithin, Ascorbyl Palmitate. They join the lipid route; they never become a second `humectant_refatting` vote. Several weak refatters do not become substantive by counting them.

**Do not count as persistent routes by themselves:** glycerin, panthenol, betaine, sugars, glycols, hyaluronate, urea, botanical extracts, free amino acids, acids, salts, fragrance, Glycol Distearate/Stearate (pearlizers), PEG-40 Hydrogenated Castor Oil and Laureth solubilizers, PEG-120 Methyl Glucose Dioleate (thickening cue), rinse-off surfactants. These may have useful functions; absence of a weight vote is not absence of a cosmetic effect.

**Recognition gaps:** an unlisted silicone/siloxane, polyquaternium/quaternium, trimonium material, oil/butter/wax, conditioning amine, or opaque polymer/conditioning complex must appear in `unresolvedIngredients`. Empty/incomplete INCI is not a low-weight result. A cationic protein is counted only as protein, not again as a polymer. Generic `polymer`, `complex` or `blend` is unresolved, not a known route. Keep unrecognized functions visible; do not extend the dictionary after seeing the paired rerun answers.

## 3. Deterministic label

Count **distinct route kinds**, not ingredients or mechanisms mentioned in prose:

- `high`: at least two substantive route kinds.
- `moderate`: exactly one substantive kind, or at least two weak kinds with no substantive kind.
- `low`: no substantive kind and fewer than two weak kinds.

If any potentially weight-relevant ingredient remains unresolved, retain the computable **provisional** band but mark `needs_review` and cap confidence. For absent/incomplete formula, return no classification (`null`), never `low`.

Strong cleansing does not subtract a route. A silicone and its carrier are not multiple silicone routes. A cationic polymer has its own conditioning role, but multiple cationic polymers are not multiple votes. These rules classify architecture; they do not claim the exact deposition amount or long-term buildup.

### Synthetic anchors (not the test products)

| Formula pattern | Result | Reason |
| --- | --- | --- |
| Cleansing base + glycerin + panthenol | low | No persistent route identified. |
| Cleansing base + one late oil | low | One weak lipid route. |
| Cleansing base + late protein + late oil | moderate | Two different weak routes. |
| Cleansing base + late PQ-10 | moderate | One purpose-specific polymer route, despite late position. |
| Cleansing base + early seed oil + late PQ-10 | high | Supported prominent lipid payload plus polymer route. |
| Cleansing base + PQ-10 + several late proteins | moderate | One substantive polymer and one weak protein route. |
| Cleansing base + early dimethicone + PQ-10 | high | Two substantive route kinds. |
| Cleansing base + PQ-10 + only PEG-40 Hydrogenated Castor Oil | moderate | Solubilizer is not an oil-payload vote. |

## 4. Confidence without inflation

Keep two judgments separate:

- **Rule-application confidence:** high only when INCI is complete, no recognition gaps exist, and windows 8/10/12 give the same label; moderate when the window changes the label; low with unresolved relevant ingredients. It describes reproducibility under this heuristic, not proven product performance.
- **Product confidence:** at most moderate for INCI-only weight prediction, further capped by formula identity (low identity => low). Complete current-pack evidence improves identity, not measured weight accuracy. Missing finished-product performance evidence stays visible.

No percentages are assigned to confidence. Two agreeing agents do not upgrade the product confidence. Report recognition gaps, window sensitivity and source identity separately so a strong operational rule is not confused with strong empirical validation.

## 5. Same-ten paired rerun

Read the exact ten IDs from the frozen holdout-v2 manifest. Use the existing formulas, not newly fetched/reformulated substitutes. Two fresh labelers receive anonymized INCI and this policy but no previous labels, evaluator code or each other's decisions. Each returns value, route evidence/strength, excluded ingredients, unresolved ingredients and a German explanation. Freeze both answers before comparison.

Report labeler-labeler agreement, agreement with the rule evaluator, old/new labels, confidence and distribution separately. This is calibration on familiar products, not a new holdout, independent source research or measured accuracy. All seven other properties remain unchanged. Route extraction completeness must be reviewed even when final labels agree. No silent adjudication to improve the result.
