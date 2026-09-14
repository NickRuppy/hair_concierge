# Leave-In Gold Set — Candidates, Identities, INCI Captures

Synthesized 2026-09-03 by the orchestrator from six research lanes (archetypes 1–3, 4+11, 5–7, 8–10, 12, corrected 11). Identity + formula capture only — **no product has been classified**. Capture date for all INCIs: 2026-09-03. Existing DB spec values are legacy heuristics, not ground truth.

Source tiers: T1 = manufacturer German/EU page · T2 = exact-pack German retailer page · T3 = aggregator/secondary (flagged, needs re-verification before E1 status).

## Summary — recommended pick per archetype slot

| # | Archetype | Recommended pick | GTIN | Identity status |
| --- | --- | --- | --- | --- |
| 1 | Ultra-light detangling spray | alverde Leave-In Sprühkur Express 7in1, 75 ml | 4066447919387 | verified (T1 dm.de) |
| 2 | Mainstream milk/lotion | Balea Professional Magical Water Aqua Hyaluron, 200 ml | 4067796166644 | verified (T1 dm.de); positioning note below |
| 3 | Rich cream dry/damaged | Cantu Leave-In Haarkur Repair Creme, 453 g | 810006945430 | verified (T1 dm.de) + **provisional_conflict** (EU vs US formula) |
| 4 | Two-phase spray | alverde Nutri-Care 2-Phasen-Sprühkur Bio-Mandel/Bio-Argan, 75 ml | 4066447105032 | GTIN cross-checked (OpenFoodFacts + dm URL); INCI T3 only |
| 5 | Silicone-rich smoother | EVO Head Mistress Cuticle Sealer, 150 ml | 9349769013144 (single-source) | INCI T1 (evohair.com); GTIN needs 2nd source |
| 6 | Silicone-free cationic/polymeric | Curlsmith Hydrate & Plump Leave-In, 237 ml | not found | INCI T2/T3 (lockenbox.com); availability verified Douglas/Flaconi |
| 7 | Curl cream with hold polymer | Maria Nila Curlicue Cream, 100 ml | not found | INCI T1 (marianila.com); PVP pos. 4 confirmed |
| 8 | Heat-protective primer | Schwarzkopf Gliss Sprüh-Conditioner Express-Repair Ultimate Repair, 200 ml | 4015100813494 | verified (T2 dm.de, full DOM capture) |
| 9 | Protein/surface-repair | Redken Extreme Anti-Snap, 250 ml | 0884486453402 (low-conf) | INCI T2 (douglas.de); GTIN from marketplace |
| 10 | Bond-repair claim | Olaplex No.6 Bond Smoother, 100 ml | unresolved (2 conflicting codes) | INCI T2 (douglas.de) |
| 11 | Sensitive/fragrance-free fiber leave-in | Balea Leichtkämmspray Pure Styling, 200 ml | 4067796148855 | verified (T2 dm.de, "Ohne Parfüm" badge) |
| 12 | Boundary / source-conflict | Kevin Murphy Young.Again Oil, 100 ml | 9339341020356 (single-source) | 3 INCI sources + **provisional_conflict** (HICC EU/US) |

GTIN-certain alternate for slot 10 if barcode certainty decides: Pantene Pro-V Miracles Molecular Bond Repair Wunder Haarcreme, 90 ml, GTIN 8700216637374 (T2 dm.de, fully verified; chemically distinct P&G bond technology — good mechanism diversity).

## Per-slot detail

### 1 — alverde NATURKOSMETIK Leave-In Sprühkur Express 7in1 (75 ml, 2,75 €, dm-Art. 3090444)
INCI (T1, dm.de): Aqua, Helianthus Annuus Hybrid Oil*, Alcohol* denat., Glycerin, Dicaprylyl Ether, Pentylene Glycol, Inulin, Isoamyl Laurate, Levulinic Acid, Sodium Levulinate, Ricinus Communis Seed Oil*, Arginine, Hydrolyzed Corn Protein, Hydrolyzed Wheat Protein, Hydrolyzed Soy Protein, Lactic Acid, Tocopherol, Helianthus Annuus Seed Oil*, Lactobacillus Ferment, Glucose, Fructose, Sucrose, Parfum**, Geraniol**, Limonene**, Terpineol**, Geranyl Acetate**, Citrus Aurantium Bergamia Peel Oil**, Linalyl Acetate**, Vanillin**, Citrus Limon Peel Oil**, Juniperus Virginiana Oil** (*bio, **äth. Öle)
Fit: true no-LGN hydroalcoholic spray, no cationic surfactant, silicone-free naturkosmetik. Alternates: It's a 10 Miracle Leave-In Lite (better fine-hair marketing; T3 INCI, no DE GTIN, salon-shop channel only); Isana Express-Sprühkur Anti-Frizz (200 ml, GTIN 4305615627434, T1 rossmann.de — silicone-spray architecture). Rejected for slot: Isana Professional Leave-In Conditioner Hyaluron & Panthenol (GTIN 4305615946733) — spray pump but genuine LGN pair → architecture is emulsion (usable as an archetype-2 alternate or FORM stress case). Note: Isana is Rossmann's brand, not dm's (catalog assumption corrected).

### 2 — Balea PROFESSIONAL Magical Water Aqua Hyaluron (200 ml)
INCI (T1, dm.de): Alcohol Denat., Aqua, Myristyl Alcohol, Propylene Glycol, Glycerin, Behentrimonium Chloride, Cetrimonium Chloride, Aloe Barbadensis Leaf Juice Powder, Hydrolyzed Hyaluronic Acid, Parfum, Isopropyl Alcohol, Citric Acid, Sodium Hydroxide
Fit: genuine LGN pair (Myristyl Alcohol + Behentrimonium/Cetrimonium) — the emulsion architecture this slot needs. Tension noted: packaged as a "9-Sekunden Magical Water," not a classic milk bottle; positioning is broad/general. Alternate: Garnier Fructis Leave-In Creme Aloe Air Dry 400 ml (GTIN 3600542117593, T1 dm.de) — more classic mainstream "cream" positioning but gel-cream/associative-thickener architecture (Sorbitan Oleate + PPG-1 Trideceth-6 + PEG-150/Decyl Alcohol/SMDI, PQ-37 only cationic), and a naming-lineage assumption vs the catalog's "Hair Food" entry (Hair Food leave-in branding appears retired in DE).

### 3 — Cantu Leave-In Haarkur Repair Creme (453 g, 6,95 €, dm)
INCI Version A (T1, dm.de, German pack, authoritative): Aqua, Canola Oil, Cetearyl Alcohol, Glycerin, Behentrimonium Methosulfate, Butyrospermum Parkii (Shea) Butter†, Olea Europaea Fruit Oil, Riboflavin, Niacin, Pantothenic Acid, Pyridoxine, Folic Acid, Cyanocobalamin, Biotin, Leuconostoc/Radish Root Ferment Filtrate, Panthenol, Citrus Sinensis Fruit Extract, Salvia Officinalis Leaf Extract, Urtica Dioica Extract, Aloe Barbadensis Leaf Juice, Achillea Millefolium Extract, Actinidia Chinensis Fruit Extract, Rosmarinus Officinalis Leaf Extract, Sodium Hyaluronate, Hydrogenated Ethylhexyl Olivate, Hydrogenated Olive Oil Unsaponifiables, Parfum, Phenoxyethanol, Ethylhexylglycerin, Polyquaternium-10, Disodium EDTA, Pentaerythrityl Tetracaprylate/Tetracaprate, Sodium Benzoate, Citric Acid, Cetrimonium Chloride, Benzyl Alcohol, Benzyl Salicylate, Citral, Coumarin, Hexyl Cinnamal, Limonene, Linalool, Sodium Hydroxide, Helianthus Annuus Seed Oil, Lecithin, Ascorbyl Palmitate, Tocopherol, Propylene Glycol, Potassium Sorbate, Lactic Acid, Tetrasodium Glutamate Diacetate, Tetramethyl Acetyloctahydronaphthalenes
**provisional_conflict:** a genuinely different US-market formula (Dicetyldimonium Chloride / Diheptyl Succinate / Silk Amino Acids etc.) circulates under different GTIN 810006943405 — EU-vs-US reformulation, both recorded in the lane report; dm.de Version A is authoritative for this gold set. Rich-LGN architecture, excellent fit. Alternate: being MAJOR MOISTURE Leave-In Conditioner 354 ml (EAN 4895248005988, hagel-shop.de with GPSR importer — genuine DE distribution, specialty channel only).

### 4 — alverde NATURKOSMETIK Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan (75 ml, dm-exclusive)
INCI (T3, CodeCheck/INCIBeauty cross-verified — dm.de bot-blocked; re-verify from pack before E1): Aqua, Glycine Soja Oil*, Alcohol*, Glycerin, Sodium Lactate, Betaine, Argania Spinosa Kernel Oil*, Prunus Amygdalus Dulcis Seed Extract*, Hippophae Rhamnoides Fruit Extract*, Caprylyl/Capryl Glucoside, Tocopheryl Acetate, Sodium Phytate, Parfum**, Linalool**, Limonene**, Coumarin**
Fit: genuine unemulsified two-phase (no LGN pair, oil phase + aqueous phase, "vor Gebrauch gut schütteln"). Alternates: Balea Hitzeschutzspray 2-Phasen 200 ml (GTIN 4058172163937 — textbook hydrocarbon/water split, but heat-protectant positioning); Balea Professional Sprüh-Conditioner Express Oil Repair Intensiv 150 ml (GTIN 4066447785470 — borderline: PEG-12 Dimethicone dispersant, provisional). **Rejected as fake two-phase:** René Furterer Okara "Bi-Phase" — contains Laureth-4 + PEG/PPG-14/4 Dimethicone (solubilized emulsion wearing two-phase branding). An older alverde 2-Phasen variant (Aloe/Hibiskus 150 ml) is discontinued — do not confuse SKUs.

### 5 — EVO Head Mistress Cuticle Sealer (150 ml)
INCI (T1 evohair.com + T3 corroboration): Aqua, Dimethicone, Cyclopentasiloxane, Polyacrylamide, Dimethiconol, Phenoxyethanol, Parfum, Panthenol, C13-14 Isoparaffin, Laureth-7, Benzophenone-4, Hydrolyzed Quinoa, Macadamia Ternifolia Seed Oil, Quaternium-80, Benzoic Acid, Dehydroacetic Acid, Sodium Hydroxide, Butylene Glycol, Ethylhexylglycerin, Potassium Sorbate, Limonene, Hexyl Cinnamal, Linalool, Geraniol, Citral
Fit: three silicones in top 5, no LGN pair — unambiguous silicone-dominant smoother. DE availability: Flaconi, Douglas, hagel-shop. **Demoted from this slot:** Color WOW Money Mist — Dimethicone at position 27/32; architecturally a cationic-emulsion/protein leave-in (Behentrimonium + Cetyl/Stearyl LGN, PQ-55 pos. 5) whose "glossy" marketing outpaces its silicone content → excellent **adversarial marketing-vs-formula case** instead (INCI in lane report; T1 colorwowhair.com global page; note PQ-55 is on the heat-evidence L9 list). "Money Masque" is rinse-off — out of scope.

### 6 — Curlsmith Hydrate & Plump Leave-In (237 ml)
INCI (T2/T3 lockenbox.com; 41 ingredients, verbatim in lane report): Water, Dicaprylyl Carbonate, Cetearyl Alcohol, Coco-Caprylate/Caprate, Ricinus Communis Seed Oil, Behentrimonium Chloride, Glycerin, Panthenol, Butyrospermum Parkii Butter, Simmondsia Chinensis Seed Oil, Guar Hydroxypropyltrimonium Chloride, Polyquaternium-10, [botanical extract block], Isopropyl Alcohol, Pentylene Glycol, Tocopherol, Maltodextrin, Cyclodextrin, PVP, Guar Gum, Gluconate, Phytic Acid, Phenoxyethanol, Potassium Sorbate, Sodium Benzoate, Hydroxycitronellal, Citronellol
Checks: silicone-free PASS (full-list scan); cationic strength PASS (Behentrimonium #6 + Guar-HPTC #11 + PQ-10 #12). DE availability: Douglas ("Haarstyling-Liquid", €25) + Flaconi + lockenbox. **Failed this slot's checks:** both Garnier Fructis Air Dry variants (silicone-free but PQ-37 in sub-1% tail / no cationic polymer at all — the line is humectant/fatty-alcohol led).

### 7 — Maria Nila Curlicue Cream (100 ml, "Colour Guard Complex" sub-brand)
INCI (T1 marianila.com): Aqua, Propylene Glycol, Glycerin, PVP, Cetyl Alcohol, Helianthus Annuus Seed Extract, Chamomilla Recutita Flower Extract, Polysorbate 20, Butylene Glycol, Carbomer, Quaternium-95, Propanediol, Ethylhexylglycerin, Triethanolamine, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate, Phenoxyethanol, Parfum
Check: fixative PASS — PVP at position 4 (before the fatty alcohol) + Carbomer/TEA system; genuine hold chemistry. DE: Douglas + Flaconi. **Failed this slot:** Paul Mitchell Full Circle Leave-In (zero hold polymer, Cyclopentasiloxane pos. 4 — conditioning cream in curl branding → strong **adversarial hold-vs-conditioning case**); Maria Nila Coils & Curls Oil In Cream (conditioning quats only, no fixative — remains a slot-3-style rich-cream alternate). Catalog name "Coils & Curls Curl Cream" does not exist.

### 8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair (200 ml, 4,95 €, dm-Art. 1430908)
INCI (T2 dm.de, DOM capture): Aqua, Trisiloxane, Dimethicone, Prunus Armeniaca Kernel Oil, Phenyl Trimethicone, Hydrolyzed Keratin, Hydrolyzed Pearl, Dimethiconol, Polyquaternium-16, Cetyl PEG/PPG-10/1 Dimethicone, Cetrimonium Chloride, Parfum, Lactic Acid, Sodium Benzoate, Glycerin, Tetramethyl Acetyloctahydronaphthalenes, Citrus Aurantium Peel Oil, Limonene, Potassium Sorbate, Phenoxyethanol, Geranyl Acetate
Claim: "Hitzeschutz bis 230 Grad" — explicit pre-blow-dry positioning; no L9 member in INCI (interesting HEAT sanity-check case). Alternates: Wella Ultimate Repair Protective Leave-In 140 ml (T1 wella.com DE INCI captured; GTIN unverified; catalog's "Thermal Image" name outdated); Redken One United 150 ml (T2 douglas.de INCI; "25-in-1" → also the **adversarial 10-in-1 case**; GTIN 884486219312 from non-DE sources).

### 9 — Redken Extreme Anti-Snap Leave-In Treatment (250 ml, Douglas Art. 117080)
INCI (T2 douglas.de): Aqua, Polyacrylamide, Phenoxyethanol, Amodimethicone, Arginine, Citric Acid, C13-14 Isoparaffin, Isopropyl Myristate, Parfum, Laureth-7, Xylose, Hydrolyzed Soy Protein, Trideceth-6, Hydrolyzed Vegetable Protein PG-Propyl Silanetriol, Cetyl Alcohol, Cetrimonium Chloride, Behentrimonium Methosulfate, Benzyl Benzoate, Quaternium-33, Limonene, Benzyl Alcohol, Linalool, Potassium Sorbate, 2-Oleamido-1,3-Octadecanediol
Fit: explicit protein/anti-breakage positioning with named protein actives; secondary heat claim. **Catalog issues found:** HASK Keratin 5-in-1 delisted at dm and absent from all Tier-2 retailers (Amazon-only → flag discontinued-in-DE); Curlsmith "Weightless Protein" renamed "Feather-Light Protein Cream" (DTC/specialty channel, INCI T3 only, hold 4/10 styler-coded).

### 10 — Olaplex No.6 Bond Smoother (100 ml, Douglas Art. 1111439)
INCI (T2 douglas.de; 47 ingredients, verbatim in lane report): Water, Cetearyl Alcohol, Dimethicone, Isohexadecane, Coco-Caprylate, Neopentyl Glycol Diheptanoate, Behentrimonium Chloride, Isododecane, Phenyl Trimethicone, Propanediol, **Bis-Aminopropyl Diglycol Dimaleate**, Parfum, Cetrimonium Chloride, … (full list in lane report)
Fit: the patented bond-active in a classic LGN cream; heat claim "bis 232 °C" as secondary (use-condition, per standard §13). GTIN unresolved (two conflicting codes, Douglas exposes none). Alternates: Olaplex No.9 Bond Protector 90 ml (same active, lightweight aqueous serum); **Pantene Molecular Bond Repair Haarcreme 90 ml — GTIN 8700216637374 fully verified at dm, distinct P&G bond tech** (recommended if GTIN certainty decides); Bali Curls Bonding Repair Leave-In Cream N°3 150 ml (GTIN 4262391991732 multi-retailer confirmed, T1 INCI, "Everbond" proprietary claim; minor shea-marketing-vs-INCI mismatch). **Catalog error:** "Olaplex No.5 Leave-In" does not exist as a leave-in — No.5 is the rinse-out conditioner; flag catalog row for identity review (ruling #4: research flag only). **K18 naming:** DE product is "Leave-In Molecular Repair Hair Mask" (not "Mist"); 4-minute timed application = boundary note.

### 11 — Balea Leichtkämmspray Pure Styling (200 ml, dm-Art. 3042625)
INCI (T2 dm.de): Aqua, Betaine, Propylene Glycol, Cetrimonium Chloride, Inulin, Panthenol, Hydroxyacetophenone, 1,2-Hexanediol, Caprylyl Glycol, Citric Acid, Sodium Hydroxide
Fit: the only product found (of ~20 checked) that is BOTH explicitly fragrance-free (no Parfum/essential oils; dm badge "Ohne Parfüm") AND a genuine no-rinse fiber leave-in ("Produkt muss nicht wieder ausgespült werden"). Minor note: secondary marketing claim of scalp benefit via Inulin, but application is general hair — stays in-category. **Market finding:** the fragrance-free leave-in segment is genuinely thin in DE; full 11-product rejection ledger in the lane report (i+m Freistil = rinse-off; Bioturm/alverde/lavera/Urtekram/Klorane/nouni/Isana = Parfum or essential oils; Urtekram No Perfume = rinse-off). **Rejected out-of-boundary from the original lane (scalp products, per charter §A):** Ducray Sensinol SOS Spray, Eucerin DermoCapillaire Tonikum (GTIN 4005800036620), Balea med Kopfhaut Tonikum Ultra Sensitive (GTIN 4066447890105), Balea Professional Kopfhautpflege Serum Sensitive — retained as boundary examples only.

### 12 — Kevin Murphy Young.Again Oil (100 ml)
Three INCI sources captured (T3 + 2× T2 German retailers; verbatim in lane report). All agree: **Cyclopentasiloxane leads, Water mid-list (~pos. 15)** → anhydrous-serum architecture despite leave-in usage role = the exact G0 boundary test. **provisional_conflict:** international listing contains HICC (EU-restricted allergen) absent from both German retailer lists — consistent with EU reformulation. GTIN 9339341020356 single-source. Secondary boundary/identity case: **Neqi Diamond Glass Ultimate Styling Spray** 180 ml (GTIN 4063528094575) — clean consistent INCI, but dm names it "Leave-In Spray" while brand + Galeria say "Styling Spray", and a sibling SKU (GTIN 4063528078469) sits one ingredient away → the name-based-misclassification and near-duplicate-GTIN trap. Keep both: KM tests the architecture rule, Neqi tests identity discipline.

## Adversarial stress-test pool (3–5 needed; selection at calibration)

1. **Hold-vs-conditioning:** Paul Mitchell Full Circle Leave-In (curl branding, zero hold polymer).
2. **Marketing-vs-formula (lightweight/silicone):** Color WOW Money Mist (silicone-gloss marketing, trace silicone, cationic LGN reality; PQ-55 presence makes its HEAT reading non-trivial).
3. **Heat claim without L9 member:** Gliss Ultimate Repair (230 °C claim) or Herbal Essences/It's a 10 from catalog pool.
4. **10-in-1 shared mechanisms:** Redken One United "25-in-1".
5. **Boundary/GTIN trap:** Neqi Diamond Glass Ultimate (if not used in slot 12).

## Conflict & correction ledger (for catalog follow-up, ruling #4 — research flags only)

1. Cantu: EU/US formula split under different GTINs — DB should pin the DE GTIN 810006945430.
2. "Olaplex No.5 Leave-In" catalog row: no such leave-in SKU exists — identity review needed.
3. HASK Keratin 5-in-1: delisted at dm, no Tier-2 DE availability — discontinued-in-DE candidate.
4. Curlsmith "Weightless Protein Leave-In Conditioner": renamed "Feather-Light Protein Cream".
5. Wella "Thermal Image": outdated name — current is "Ultimate Repair Protective Leave-In".
6. K18 "Hair Mist": DE-sold SKU is the "Leave-In Molecular Repair Hair Mask".
7. Kevin Murphy Young.Again Oil + all serum/oil_replacement rows: boundary-suspect per charter (G0), pending the recategorization decision.
8. Isana attributed to dm in earlier notes: it is Rossmann's brand.
9. Maria Nila "Coils & Curls Curl Cream": does not exist; hold-bearing SKU is "Curlicue Cream".

## Verification gaps before formula freeze (Phase 2 entry tasks)

- Re-verify T3-only INCIs from pack or manufacturer feed: slot 4 (alverde 2-Phasen), slot 6 (Curlsmith), Curlsmith Feather-Light, It's a 10 Lite.
- GTIN second-source needed: slots 5, 9, 10, 12 (Douglas exposes no GTINs for salon brands; use physical pack or brand data feed).
- dm.de bot-blocks automated fetches — dm-sourced captures came from DOM/snippet routes; spot-check top picks against physical packs where possible.
- Formula fingerprints (SHA-256 per standard §2.4) to be computed at classification time from the frozen INCI strings.
