# Can hold strength be estimated from the INCI? (Styling, round 2)

Date: 2026-10-09. Question from the founder: ~half of the products state no hold strength (7 of 10 gels); could the app say something "based on the ingredients also"?

**Answer in one line: no numeric or per-level estimate. A formula-based plausibility check for the internal review queue is defensible. A user-facing coarse band ("eher leicht / eher stark") is not, on the evidence we have.**

Evidence tiers used below: **established** (supplier/peer-reviewed/regulatory, or reproducible from our data), **convention** (formulator practice, consistent across sources but not a measured law), **guesswork** (plausible, untested).

---

## 1. What the INCI can and cannot tell a formulator

### 1.1 Why the INCI is a weak instrument for hold

| Limit | Tier | Consequence |
|---|---|---|
| Concentration is invisible. EU order is descending only above 1%; below 1% any order. Between ~1% and ~10% the order says little about the actual %. | established (labelling rule) | "Rank 3" can be 2% or 8%. |
| Grade is invisible. PVP K-30 vs K-90 (or VP/VA 60/40 vs 30/70) are the same INCI word. Supplier guides state that stiffness and tack rise with K-value. | established (Ashland styling guide, via search excerpt; not opened in full) | Two products with "PVP" at rank 4 can differ a lot in stiffness. |
| Neutralisation degree, solvent/water ratio, propellant and plasticiser levels all modify film hardness. Suppliers say hold depends on "total formulation". | established (Nouryon/Amphomer datasheet; JCS series on hairspray) | Hold is a product property, not an ingredient property. |
| Manufacturer hold numbers are brand ladders, not physical units. Henkel gels use a separate 4–14 scale; the same "Haltegrad 3" word means "mittel" at Taft and "stark" at Syoss (our own round-2 notes). | established (our data) | The label we would validate against is itself noisy. |

### 1.2 Signals that plausibly relate to hold, and how much weight each deserves

| Signal | What is known | Tier |
|---|---|---|
| **Fixative polymer present at all** (PVP, VP/VA, acrylates family, VA/crotonates, polyurethane-14, PQ-11/-16/-46, VP/DMAPA acrylates, PVM/MA esters, etc.) | These are the film formers that supply set/hold in gels, mousses, sprays. No fixative above the preservative/fragrance tail means the product is unlikely to rely on a polymer film. | established |
| **Polymer family and rigidity** | Hard/high-modulus, somewhat hydrophobic resins (octylacrylamide/acrylates, VA/crotonates, AMP-acrylates) are the classic "strong, humidity-resistant" hairspray chemistry; PVP/VA is described as more flexible and less raspy than PVP K-30; PQ-11/-16 are mousse/conditioning-type fixatives with softer, modest hold and build-up risk. | convention (supplier positioning; no head-to-head numbers in sources found) |
| **Typical use levels** (solids) | PVP K-30 0.25–6%; PVP K-90 0.25–3% (Ashland guide). PVP/VA 0.5–6% (Ashland). Gel fact sheets: PVP ~4–7% in hair gels. Amphomer-type acrylates 2–7% (supplier slide). 55%-VOC aerosol sprays: polymer 2–8%, patent-preferred 2–4%. PQ-11 mousse ~2% (BASF Luviquat document); reseller says >2% gets tacky. | convention; no source gives a clean "light vs. strong" % split. The split ~2–3% light / ~4–6% firm is a formulator rule of thumb, not a published threshold. |
| **Number of distinct fixatives** | Formulators do combine a rigid and a flexible polymer (patents on polymer synergy, "ratio" claims). More than one polymer is *consistent with* a harder-hold design but does not prove it. | guesswork (as a predictor) |
| **Rank relative to the ~1% tail line** | Rank above the first preservative/fragrance only proves "probably >1%". It cannot separate 1.5% from 8%. | established as a limit; useful only as a floor |
| **Plasticisers / humectants** (triethyl citrate, glycerin, PEG, panthenol, propylene glycol) | They soften the film and cut brittleness; high humectant load plausibly lowers hold and humidity resistance. Also add comfort. Direction known, size unknown, and they are also used for skin feel. | convention (direction), guesswork (as a score) |
| **Carbomer / acrylates crosspolymer** | These are thickeners (rheology), not fixatives. Formulators say a thickener alone gives body/shine but not hold; nonionic PVP/VP-VA is added because carbomer tolerates ionic fixatives poorly. A gel "with carbomer" is therefore not evidence of hold. | established |
| **Alcohol denat. high in the list** | Mostly a solvent/drying aid (and for sprays a VOC-limited carrier). Fast drying helps set but it does not indicate strength. | convention |
| **Natural film formers** (hydrolysed corn/potato starch, carrageenan, flaxseed, xanthan/gellan) | Real film/gel formers ("crunch" cast), but concentration and rigidity are unknown; no comparable supplier ranking vs. synthetic polymers found. | guesswork for any ranking against synthetic polymers |
| **Waxes/clays (molding)** | Hold in pastes/pomades comes from structure (waxes, petrolatum, kaolin, silica) with or without PVP. Polymer count is the wrong axis there. | convention |

### 1.3 Known counterexamples (same INCI, different stated level)
- Taft Haarspray Classic (Halt 3 → Chaarlie 2) and Glanz (Halt 4 → 3): identical INCI in our data. Taft Power (Halt 5 → 4) adds one polymer (Vinyl Caprolactam/VP/DMAEMA).
- Elnett Normal vs Extra stark: identical INCI per the brief. **Not in our dataset** (only Extra stark is); I could not verify this independently.
- Data-quality caveat: retailer pages frequently carry one shared INCI for a range. Before treating Classic/Glanz as "provably identical", check the pack.

---

## 2. Analysis on our data (calibration-set-r2.json, INCI from the sample files)

Method: parse INCI order; "tail" = first preservative or Parfum; fixative = polymer in a hand-made list (PVP, VP/VA, acrylates copolymers without "crosspolymer", polyurethane-14, PQ-11/-16/-46, VA/crotonates, VCap/VP/DMAEMA, VP/DMAPA acrylates, PVM/MA, PSS); starch/carrageenan/flax counted separately as "natural". Carbomer and acrylates crosspolymers are **not** counted as fixatives. 68 Styling records; 36 have a stated level (all hold levels are manufacturer claims, mapped to 0–4). Scripts are in the session scratchpad, not in the repo.

### 2.1 Labelled products per subtype (the sample size problem)

| Subtype | Total | With stated level 0–4 | Levels |
|---|---|---|---|
| gel | 10 | **3** | 3, 4, 4 |
| hairspray | 6 | 6 | 2, 3, 4, 4, 4, 4 |
| molding | 11 | 9 | 1, 2, 2, 2, 3, 3, 4, 4, 4 |
| blowdry_lotion | 8 | 5 | 0, 1, 2, 2, 3 |
| mousse | 5 | 4 | 2, 2, 3, 3 |
| other subtypes | 28 | ~9 | mostly 0 (shine/smoothing) |

**For gels, the subtype the founder cares about, there are three labelled points. Nothing can be tested there.** The three labelled gels are: Taft Power (PVP, rank 4, alcohol, carbomer; level 4), Bali Curls Sleek Stick (PVP rank 3 + acrylates crosspolymer-3 + carbomer; level 3), Bali Curls Strong Hold Flaxseed (no synthetic polymer, carrageenan + glycerin + flaxseed; level 4).

### 2.2 Does any feature track the stated level within a subtype?

| Subtype (n) | # synthetic fixatives above tail vs level (Spearman) | Reading |
|---|---|---|
| hairspray (6) | +0.49 | Weak, driven by Taft Power (2 polymers, level 4) and Gard (2 polymers, level 4); but Syoss Max Hold and Elnett Extra reach level 4 with **one** polymer. |
| molding (9) | +0.41 (waxes: +0.26) | Weak; 5 of 9 have no synthetic fixative at all (hold from waxes), including level-4 Taft Matt Wax. |
| blowdry_lotion (5) | +0.57 | Weak, n=5. Alcina Ansatz spray (3) and Alcina Föhn-Lotion (1) have the *same* two polymer families. |
| mousse (4) | **-0.94** | Inverted: the two starch-only mousses (Taft Halt 4, Syoss Haltegrad 4) are stated level 3; the two synthetic-polymer mousses (Wellaflex, Alcina) are level 2. Largely a brand-scale artefact (Henkel numbers vs Wella dots). |
| gel (3) | not computable | n=3. |

Pooled, after centring by subtype (n=27): rho ≈ +0.23. With n this small, none of these is distinguishable from noise; I report them to show **there is no usable signal**, not a weak one.

### 2.3 A candidate rule, tested honestly

Rule: "two or more distinct synthetic fixatives above the tail = eher stark".

| | stated ≥3 | stated ≤2 |
|---|---|---|
| rule says "stark" (≥2 fixatives) | 3 | 3 |
| rule says "nicht stark" | 13 | 9 |

Precision 3/6 = 50% (coin flip), recall 3/16 = 19%. It misses most strong products: 13 of 16 products stated ≥3 have fewer than two synthetic fixatives (waxes, starches, single polymers). **Fails.**

Other single features (rank of first fixative, alcohol denat. in the top 3, humectant ahead of the fixative, wax count) show no consistent direction either; the tabulation is in the numbers above. Taft sprays have first-fixative rank 5 at every level (2, 3, 4).

### 2.4 Identical / near-identical INCI with different stated levels

| Pair | INCI difference | Stated levels |
|---|---|---|
| Taft Classic vs Taft Glanz (hairspray) | none | 2 vs 3 |
| Taft Classic vs Taft Power | + VCap/VP/DMAEMA copolymer | 2 vs 4 |
| Taft Classic vs Syoss Max Hold (hairspray) | Syoss lacks triethyl citrate and isopropyl myristate (plasticisers), otherwise the same acrylates polymer | 2 vs 4 (different brand ladders) |
| Elnett Normal vs Extra (from the brief) | none | Normal vs Extra stark |
| Alcina Föhn-Lotion vs Alcina Ansatz-Spray | same polymer families (VP/VA + PQ-11 vs PQ-46); different carrier (alcohol vs DME) | 1 vs 3 |

Reading: the one polymer-count difference (Taft Power) points the "expected" way; the identical-INCI pairs show the label can move without any formula change; Syoss shows a level-4 spray with the *fewest* plasticisers, which is consistent with, but does not prove, "less plasticiser = stiffer film" (n=1, guesswork).

### 2.5 What the unlabelled gels would get (illustrative only, not recommendations)

| Product (no stated level) | Fixative picture | A naive estimator would say |
|---|---|---|
| Balea Styling Creme Power Flex | alcohol, PVP rank 3, PQ-11, VP/DMAEMA, carbomer | "stark" |
| Syoss Curl Creme-Gel 3in1 | PVP rank 2-3, acrylates/hydroxyesters copolymer | "stark" (Syoss' English page says "hold 5"; DE page says nothing and the formula was reformulated) |
| Balea Haargel Hair Jelly | PVP at rank 6 behind glycerin, carbomer | "leichter" |
| Balea Locken Crunchgel, Bali Leave-in Curl Spray, Langhaarmädchen Lockenspray | hydrolysed corn starch +/- xanthan, gellan | unknown (natural film former, no calibration) |
| Cantu Extra Hold Edge Stay Gel | **no** fixative at all (ceteareth-25, PEG-7 glyceryl cocoate, glycerin, shea butter) despite "Extra Hold" (retailer claim only, C3) | would flag the claim, but the hold mechanism may be invisible to us |

Two of five rows are "unknown". Of the other three, we have no label to check against.

---

## 3. Recommendation

### 3.1 Verdict by use

| Use | Verdict | Why |
|---|---|---|
| A. Numeric Chaarlie hold level (0–4) from formula | **No** | No signal in our data (section 2); concentration and grade invisible (section 1); violates the repo rule that hold is captured, never derived. |
| B. Coarse user-facing band ("eher leicht / eher stark"), gels only | **No, not now** | n=3 labelled gels; the best candidate rule scored 50% precision on the pooled set; natural-film gels (3 of 10) have no calibration. Showing it would read as a product property. Expected error: at best a coin flip on current evidence. |
| C. Internal plausibility check that flags a claim for human review | **Yes, narrowly** | A flag costs a reviewer a look, not a user a wrong answer. Rules below. |
| D. Neutral ingredient facts shown to users, without a strength inference | **Yes** | Factual and checkable (e.g. "enthält Filmbildner wie PVP"). |

### 3.2 Rules for C (internal, review queue only; never user-facing, never changes the level)

All three rules are `convention`-tier and are *flags*, not corrections. They never set, raise or lower `proposed_hold_level`.

1. **No-mechanism flag.** Claim says "stark/extra/max/Halt ≥3" (any tier) AND the product has no fixative polymer, no natural film former (starch/carrageenan/flax/gum) and no wax/clay/structuring solid above the tail → `claim_formula_check: no_visible_hold_agent`. Example in our set: Cantu "Extra Hold" (C3 claim). This fits the existing `claim_formula_conflict` route used for Elnett Hitzeschutz.
2. **Form-mismatch flag.** Hold ≥2 claimed on a product whose subtype is a shine/smoothing/refresher and which has no fixative → check the subtype assignment (these are mostly already level 0).
3. **Sibling-identity note.** Two products of one brand with identical INCI but different stated levels → note on the record "Stufe laut Hersteller; Formel identisch" and verify the INCI against the pack. This also catches retailer INCI copy errors (Taft Classic/Glanz).

Expected behaviour on our data: rule 1 would fire on at most 1 of 68 records (Cantu); rule 3 on 1 pair (Taft). Low volume, which is the point: it is a safety net, not a classifier. False-positive risk: hold agents invisible to the parser (an unlisted polymer name, wax in a name I did not map); keep a human in the loop.

### 3.3 Rules for D (user-facing, German, factual)

Allowed: "Enthält Stylingpolymere (z. B. PVP, VP/VA) – sie sorgen für den Halt." Allowed: "Die Stärke des Halts lässt sich aus der Inhaltsstoffliste nicht ablesen." When there is no manufacturer level: "Keine Herstellerangabe zum Halt" in the existing hold slot, as now.
Not allowed: any word that sounds like a level ("leichter/stärkerer Halt laut Formel"), any ranking of two products by formula, any statement about concentration ("viel/wenig Polymer"), any comparison between a synthetic and a natural film former.

Caveat for D: the sentence should be shown only for ingredient families with established function (the synthetic fixatives above). For starch/flax/carrageenan say "enthält pflanzliche Filmbildner", again without strength.

### 3.4 What data would make a real estimate defensible

| Need | Why | Rough size |
|---|---|---|
| Per-product user ratings of felt hold ("wie stark hält es?", 1–5 or after-3-hours) | Replaces the noisy brand ladders as the label; lets us test whether formula features predict anything | ≥30 ratings per product, ≥10 products per subtype, gels first; 300–500 ratings per subtype |
| Instrumental or panel data (curl retention at high humidity, stiffness) | Only way to anchor on a physical quantity | external, costly; probably out of scope |
| Manufacturer polymer % or hold-grade for a few anchor products | Breaks the "concentration invisible" limit for calibration | ask 5–10 brands, many will decline |
| More labelled gels (target ≥15 with C1/C2 level) | Current n=3 | within brand ladders that actually print a level (Taft gel 4–14 scale needs its legend first) |

Until then, the scale stays claim-only; D plus C is the maximum defensible formula contribution.

---

## 4. Open risks
- Our features were built by hand on 36 labelled products; a different parser could shift a few cells, but not the conclusion (no signal anywhere near usable precision).
- Retailer INCIs may be range-level copies; Classic/Glanz may not be truly identical.
- The Elnett identical-INCI claim comes from the brief, not from our data.
- Several use-level numbers come from search excerpts of supplier documents (Ashland guide, Nouryon, BASF) that I could not open in full; they are "convention" tier and must not be cited as exact.
- Some supplier datasheets are login-gated; a formulation chemist review would harden section 1.2.
- Any user-facing formula band would sit next to manufacturer numbers and invite the reading "Chaarlie says". That brand risk outweighs the benefit at this accuracy.

## Sources (secondary access via search; none opened in full unless noted)
- Ashland, Hair Care Styling Selection eGuide (use levels and K-value statements; excerpt only): https://c-3347-20130129-www-ashland-com.i.icims.com/file_source/Ashland/Industries/Personal and Home Care/PHC17-1019_Hair Care_Styling Selection eGuide_Interactive_Spreads_101017.pdf
- Ashland PVP/VA datasheets (SpecialChem): https://www.specialchem.com/cosmetics/product/ashland-pvp-va-e-635
- Nouryon Amphomer datasheet / formulation notes (neutralisation, 2–7% range, reduced solids = softer hold): https://www.specialchem.com/cosmetics/product/nouryon-amphomer
- Octylacrylamide/Acrylates copolymer overview (Wella): https://wellacompany.com/learn-more-about-our-ingredients/octylacrylamide-acrylates-butylaminoethyl-methacrylate-copolymer
- BASF Luviquat HM 552 document (PQ-11 2%, PQ-16 2.2% in a standard mousse): https://promo.basf.com/campaign/Projetos/CaringForYou/Documentos/Geral/Luviquat%C2%AE%20HM%20552.pdf
- Journal of Cosmetic Science hair-styling/hairspray series (dynamic hairspray analysis, stiffness; titles only, not read in full): https://library.scconline.org/v052n05/28 ; https://library.scconline.org/v056n05/56 ; https://library.scconline.org/v056n05/57
- 55% VOC hairspray formulation constraints (patent US5094838): https://patents.google.com/patent/US5094838
- Hair gel patent (carbomer + PVP structure): https://patents.google.com/patent/US5032391
- Lubrizol/personal-care-magazine hard-hold gel formula (carbomer 0.25% + PVP K-30 solution): https://www.personalcaremagazine.com/formulation-details/285/hard-hold-and-long-lasting-styling-gel
- PVP fact sheet (reseller, low trust, 4–7% in gels): https://makingcosmetics.com/on/demandware.static/-/Sites-makingcosmetics-master/default/dw92afe328/fact-sheets/fact-sheet-pvp2.pdf
- Forum/reseller material (flaking, thickener-vs-fixative) used as secondary context only.
