# Oil engine — first eight-product review

2026-10-01. Two independent blind-then-unblind lanes completed. This sheet uses a separately identified main working derivation, with every estimate/gap visible. Published DE declarations were frozen; physical batches were not verified. No gold key, efficacy accuracy or usable intake engine is claimed.

## What OLAPLEX/K18 meant

They are two test products with conflicting published declarations. OLAPLEX uses the 21-entry local list corroborated by maker/local brand pages; its conflicting 25-entry pharmacy list remains separate. K18 uses the 17-entry local list corroborated by another local retailer and the UK maker; a global 22-entry declaration remains separate. Lists were never combined. Scope/source receipts are in `scope-review-notes.md` and `source-packet.json`.

## Independent results

| Field | Exact raw agreement | Both substantive | Gaps |
| --- | --- | --- | --- |
| Base | 8/8 | 8/8 | A: 0; B: 0 unknown |
| Weight | 7/8 | 7/7 | A: 1; B: 0 unknown |
| Penetration potential | 8/8 | 8/8 | A: 0; B: 0 unknown |
| Build-up estimate | 8/8 | 5/5 | A: 3; B: 3 unknown |
| Dispenser | 8/8 | 7/7 | A: 1; B: 1 unknown |
| Heat claim gate | 8/8 | 8/8 | A: 0; B: 0 unknown |
| UV filter + claim gate | 8/8 | 8/8 | A: 0; B: 0 unknown |
| Supported-use set | 7/8 | 7/8 | One shared empty set; one role-set disagreement |
| Advertised-oil prominence | 14/14 | 13/13 | A: 1; B: 1 unknown |
| Five ingredient flags | 40/40 | 40/40 | All exact matches checked |

Across 118 field/hero comparisons, 116 agree. Excluding explicit unknown values, 111/112 agree; the reviewed empty OGX use set is still counted and is an unresolved-coverage issue. The 80 mutually policy-unknown fit cells per lane are excluded. Agreement measures repeatability, not correctness. The 32 formula estimates have 31/32 raw agreement and 28/28 agreement where both assign a substantive value.

The 56 boolean cells have 15 positives and 41 negatives in each lane, with 15/15 positive-conditioned and 41/41 negative-conditioned agreement. Mineral oil and drying alcohol have **zero positive examples**; those positive paths were not exercised. No light-weight, trace or absent-hero case emerged. The eight developmental formulas cannot serve as unseen holdout.

## Main review of both disagreements

1. **NEQI Opulent Oil weight: A unknown / B medium.** Both see an aqueous conditioning-polymer/humectant matrix. A treats unknown polymer load and polyether role as decisive; B estimates intermediate residual load. Main prefers **medium, low confidence, estimated** for the working sheet under OE14, retaining A’s uncertainty signal. This is a proposed working judgment, not reference truth or thickness eligibility.
2. **Living Proof damp leave-on use: A includes it / B retains dry finish only.** The captured direction item combined general damp/dry instructions and a separate after-heat-styling option. B correctly keeps those scenarios separate; A’s combined scenario risks importing retention/dose across them. Main recovered a separate manufacturer FAQ instruction to apply to damp hair before a styler/heat protector. That coherent scenario supports damp leave-on under the unchanged method. It is saved as `post-seal-source-amendment-v0.1.1.json`; the main working derivation adds it with dose/time unestablished. Independent outputs/scores are unchanged.

## Working property sheet

Formula base, weight, penetration/build-up and non-absent oil prominence are **estimates**, with low/moderate confidence. Heat/UV adopt the approved evidence gates; Nein means no accepted positive under that gate. It is not a tested absence of protection. Packaging/directions remain observations.

| Produkt | Basis | Gewicht | Eindringen | Build-up |
| --- | --- | --- | --- | --- |
| Biopark Cosmetics Organic Coconut Oil (100 ml) | Reines Pflanzenöl | Reichhaltig | Eindringpotenzial | Erhöht |
| NEQI Smooth Strength Rosemary Oil (75 ml) | Pflanzenölmischung | Reichhaltig | Eindringpotenzial | Offen |
| OLAPLEX No.7 Bonding Oil (30 ml) | Gemischte Basis | Mittel | Oberflächenbetont | Gering |
| OGX Coconut Miracle Oil Extra Strength Penetrating Oil (100 ml) | Silikonbetont | Mittel | Oberflächenbetont | Erhöht |
| Living Proof No Frizz Vanishing Oil (50 ml) | Ester/Alkan-betont | Mittel | Oberflächenbetont | Erhöht |
| K18 Molecular Repair Hair Oil (30 ml) | Ester/Alkan-betont | Mittel | Oberflächenbetont | Offen |
| NEQI Opulent Oil Hair Serum (75 ml) | Wasserbasiert | Mittel * | Oberflächenbetont | Offen |
| Kérastase Soleil Huile Sirène (150 ml) | Wasserbasiert | Mittel | Oberflächenbetont | Erhöht |

* NEQI Opulent: provisional main estimate; independent weight disagreement retained above.

| Produkt | Abgabe | Hitzeschutz | UV-Schutz | Etablierte Anwendungen |
| --- | --- | --- | --- | --- |
| Biopark Cosmetics Organic Coconut Oil (100 ml) | Andere: Tiegel | Nein | Nein | Vorwäsche am Haar, Leave-on am Haar, Finish im trockenen Haar, Kopfhaut |
| NEQI Smooth Strength Rosemary Oil (75 ml) | Pipette | Nein | Nein | Vorwäsche am Haar, Kopfhaut |
| OLAPLEX No.7 Bonding Oil (30 ml) | Dosierte Tropfen | Ja | Nein | Leave-on am Haar, Finish im trockenen Haar |
| OGX Coconut Miracle Oil Extra Strength Penetrating Oil (100 ml) | Offen | Nein | Nein | Noch keine etabliert; Beibehaltung/Auswaschen offen |
| Living Proof No Frizz Vanishing Oil (50 ml) | Pipette | Nein | Nein | Leave-on am Haar, Finish im trockenen Haar |
| K18 Molecular Repair Hair Oil (30 ml) | Pipette | Ja | Nein | Leave-on am Haar, Finish im trockenen Haar |
| NEQI Opulent Oil Hair Serum (75 ml) | Pumpe | Ja | Nein | Leave-on am Haar |
| Kérastase Soleil Huile Sirène (150 ml) | Spray | Nein | Ja | Leave-on am Haar, Finish im trockenen Haar |

| Produkt | Silikone | Mineralöl | Austrocknender Alkohol | Duftstoffe/Allergene | Kopfhautaktive Botanicals |
| --- | --- | --- | --- | --- | --- |
| Biopark Cosmetics Organic Coconut Oil (100 ml) | Nein | Nein | Nein | Nein | Nein |
| NEQI Smooth Strength Rosemary Oil (75 ml) | Nein | Nein | Nein | Ja | Ja |
| OLAPLEX No.7 Bonding Oil (30 ml) | Ja | Nein | Nein | Ja | Nein |
| OGX Coconut Miracle Oil Extra Strength Penetrating Oil (100 ml) | Ja | Nein | Nein | Ja | Nein |
| Living Proof No Frizz Vanishing Oil (50 ml) | Nein | Nein | Nein | Ja | Nein |
| K18 Molecular Repair Hair Oil (30 ml) | Nein | Nein | Nein | Ja | Nein |
| NEQI Opulent Oil Hair Serum (75 ml) | Nein | Nein | Nein | Ja | Nein |
| Kérastase Soleil Huile Sirène (150 ml) | Ja | Nein | Nein | Ja | Nein |

The fragrance flag denotes declared fragrance/allergen exposure, including preservative-use Benzyl Alcohol; it does not mean every flagged product is intentionally perfumed. Botanical flag is presence/watch-out only, without growth/tolerance or scalp-use inference.

| Produkt | Beworbene Öle — qualitative Einordnung |
| --- | --- |
| Biopark Cosmetics Organic Coconut Oil (100 ml) | coconut oil: tragende Basis |
| NEQI Smooth Strength Rosemary Oil (75 ml) | rosemary oil: offen; castor oil: tragende Basis; sweet almond oil: tragende Basis |
| OLAPLEX No.7 Bonding Oil (30 ml) | Sunflower seed oil: ergänzend |
| OGX Coconut Miracle Oil Extra Strength Penetrating Oil (100 ml) | coconut oil: ergänzend |
| Living Proof No Frizz Vanishing Oil (50 ml) | sea buckthorn oil: ergänzend; jojoba oil: ergänzend; watermelon oil: ergänzend; babassu oil: ergänzend; moringa oil: ergänzend |
| K18 Molecular Repair Hair Oil (30 ml) | Avocado oil: ergänzend; Sunflower oil: ergänzend |
| NEQI Opulent Oil Hair Serum (75 ml) | Keine beworbenen Einzelöle im geprüften produktspezifischen Abschnitt |
| Kérastase Soleil Huile Sirène (150 ml) | babassu oil: ergänzend |

**Fit:** every product retains fine/normal/coarse thickness, straight/wavy/curly/coily texture and healthy/moderately_damaged/highly_damaged damage rows as unknown with `policy_not_defined`. No universal-fit or production eligibility is inferred.

## Gaps and recommended next steps

1. **Adopt the narrow function evidence in a new dictionary revision.** The targeted follow-up found supplier evidence for Castor Isostearate Succinate as a hydrophobic film-forming polymer and PPG-3 Caprylyl Ether as an ether emollient/conditioning auxiliary. This resolves generic role gaps, not concentration, retail grade or measured buildup. Preserve the frozen v0.1 seed and re-derive affected products in v0.2; evidence is in `plans/oil-inci/research/round1-functional-gap-followup.md`.
2. **Clarify the few operational anchors.** NEQI Opulent needs a repeatable medium-versus-light approximation; rich plant-oil blend vs persistent coating still needs a stated build-up anchor. Rosemary at rank 4 is present/scalp-flagged, but frozen auxiliary role cannot enter leading/supporting/trace under this method: retain unknown and clarify aromatic-hero prominence without making up an amount. OGX needs explicit retention context and observable outlet; both shared gaps remain visible.
3. **Run a broader contrast round after that revision.** Include genuine low-residual/light candidates and positive mineral-oil/drying-alcohol controls; reserve new formulas for later untouched holdout. The first round did not exercise those paths.
4. **Then settle thickness/texture/damage fit.** Fit, legacy mapping, inherited base descriptions, runtime/Lab/adapter, production checks and activation remain later decisions; first-round agreement does not clear those gates.

## Verification and provenance

Main verified input SHA256 seals, all 286 ingredient-ledger rows across two lanes, 80 exact-match flag assessments, all boolean gates, hero key/rank parity, use-set/scenario unions, fit keys and blind-to-final preservation. Sources/new amendments were inspected separately from the sealed classifications. Both lanes report no forbidden web, peer, identity or repository access. `comparison.json`, `blind-stage-seal.json` and `completion-receipt.json` contain exact denominators and hashes. No application/production test or finished-product performance test is claimed.

Original records and frozen inputs are immutable. `main-working-records-v0.1.1.json` is an explicitly separate adjudication from lane B plus one source amendment, not a third blind lane or gold reference.
