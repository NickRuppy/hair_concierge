# R1 - Leave-in heat protection (binary) and pre-heat stage, 9 products

Researched 2026-10-09. Read-only: SELECT-only DB access, no repo edits outside this folder, no commits. Contract: `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` (§2.4 claims freeze, §2.4.1 rules 1-7, §3.1.1 tail marker, §5 L9 + tail-member rule, §7.8, §7.13, §13.2/13.3) and `docs/product-intake-leave-in-production-adapter.md`.

## Headline

- **All 9 products carry a C1/C2 heat-protection claim today**, so the engine rule gives `provides_heat_protection = true` for all 9. The six Group-A rows with `false` are wrong (claim not captured when they were curated, mostly from non-German sources); Group B `true` rows are confirmed.
- **No product has a retailer-only heat claim**, so no product is forced to DROP on claim authority. Two claims are softer than the rest and need a human tier call: Pantene Bonding (page-only claim, current pack silent) and Pantene HEAT&GLOW (claim read off a retailer-hosted pack photo; P&G press release unreachable).
- **Only Urban Alchemy has an L9 member above the tail** (hydrolyzed wheat protein, rank 13 vs Phenoxyethanol rank 15) -> `formula_plausible`. The other eight are `claim_only` with the mandatory 'claim looks formula-unsupported' review note.
- **`application_stage` must stay a pure transcription.** Directions contain pre_heat for HEAT&GLOW (Föhnen, um zu aktivieren) and arguably Urban Alchemy; for the other seven they are silent about heat, so pre_heat cannot be added. Those seven pass the Stage-3 pre-heat evaluator only with commit `23a83cfa`.
- **New fact vs the gold set:** olaplex.de now exists as a German-language DACH Olaplex storefront, so Olaplex's claim is a plain C2 (was `C2_cross_market_verified` under T14). Engine output unchanged.

## Summary table

| product (id8) | claim found? tier | L9 above tail? | pre_heat in directions? | hp projection (trace) | KEEP / DROP | open question |
|---|---|---|---|---|---|---|
| 9b664b11 Alcina Hyaluron 2.0 | Yes, C2 (alcina.com/de-de) | No | No (feuchtes Haar) | true (claim_only); DB false -> true | KEEP (hp->true) | needs 23a83cfa |
| 9f94c225 Neqi Build Boost Leave-In Balm | Yes, C2 (neqi-hair.com DE) | No | No (stage unstated) | true (claim_only); false -> true | KEEP (hp->true) | 'Nach der Haarwäsche' -> towel_dry?; 23a83cfa |
| e6896862 Neqi Moisture Mystery | Yes, C2 (neqi-hair.com DE, 230°C) | No | No (stage unstated) | true (claim_only); false -> true | KEEP (hp->true) | same; 23a83cfa |
| 35a372b6 Pantene Bonding Leave-In | Yes, C2 page-only (haircode.io = P&G DE); pack silent | No | Ambiguous ('Als Hitzeschutz für nasses Haar') | true (claim_only); false -> true | KEEP, conditional | accept haircode.io as C2? page-only claim ok? stage += dry_hair (+pre_heat?) |
| e781ca9e Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW | Yes, C1 pack photo (230°C) + C3 dm | No | YES (Föhnen, um zu aktivieren) | true (claim_only); false -> true | KEEP (hp->true, stage += pre_heat, dry_hair) | accept dm-hosted packshot as C1 |
| 45f4fe15 Urban Alchemy Repair & Revive Leave-In Spray | Yes, C2 (urban-alchemy.com DE) | YES (Hydrolyzed wheat protein r13 < marker r15) | Arguable (Föhnen, stylen oder Luft) | true (formula_plausible); false -> true | KEEP (hp->true, stage += pre_heat if accepted) | option-list direction -> pre_heat? |
| 5dc2fae3 Gliss Ultimate Repair Sprüh-Conditioner | Yes, C2 (schwarzkopf.de, 230°C) | No | No (handtuchtrocken/trocken) | true (claim_only); unchanged | KEEP, no change | needs 23a83cfa |
| 4e99706a Olaplex No.6 Bond Smoother | Yes, C2 (olaplex.de, 232°C) | No | No (saubere, feuchte Haar) | true (claim_only); unchanged | KEEP, no change | needs 23a83cfa |
| 2b7db7e3 Redken Extreme Anti-Snap | Yes, C2 (redken.eu/de-de) | No | No (handtuchtrocken) | true (claim_only); unchanged | KEEP, no change | needs 23a83cfa; GTIN conflict inherited |

### Evaluator outcome for `pre_heat_application` after the proposed DB values

| product | current main evaluator (needs hp true AND stage has pre_heat) | with 23a83cfa (needs hp true + verified protocol) |
|---|---|---|
| 9b664b11 Alcina Hyaluron 2.0 | fails (stage) | passes |
| 9f94c225 Neqi Build Boost Leave-In Balm | fails (stage) | passes |
| e6896862 Neqi Moisture Mystery | fails (stage) | passes |
| 35a372b6 Pantene Bonding Leave-In | passes only if pre_heat added after human OK | passes |
| e781ca9e Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW | passes (stage += pre_heat) | passes |
| 45f4fe15 Urban Alchemy Repair & Revive Leave-In Spray | passes only if pre_heat accepted | passes |
| 5dc2fae3 Gliss Ultimate Repair Sprüh-Conditioner | fails (stage) | passes |
| 4e99706a Olaplex No.6 Bond Smoother | fails (stage) | passes |
| 2b7db7e3 Redken Extreme Anti-Snap | fails (stage) | passes |

## Relevance of commit 23a83cfa

- **commit:** 23a83cfa fix(leave-in): accept verified heat use without label timing (unmerged; only on codex/catalog-assessment-completeness; main HEAD 404db24f lacks it)
- **change:** Deletes the evaluator branch that returns mismatch 'Die Anwendung vor Hitze ist nicht bestätigt.' when role=pre_heat_application and application_stage lacks pre_heat; pre_heat_application now needs only providesHeatProtection=true + verified_complete protocol (+ the shared checks). Adds a test; implements Nick's 2026-09-18 ruling in plans/2026-09-17-scan-assessment-catalog-completeness.md.
- **relevant to group B:** YES, decisive. Gliss, Olaplex, Redken have hp=true on a C2 claim and directions that are silent about heat (towel_dry/dry_hair only). §7.13 forbids inferring pre_heat, so the DB cannot be made to pass under the old evaluator without violating the contract; with 23a83cfa they pass with no DB change.
- **relevant to group A:** Partly. It does nothing for hp=false (still 'Hitzeschutz ist nicht verifiziert'); the Group-A fix is hp false->true from the claim research. After that, Alcina, Neqi Build Boost, Neqi Moisture Mystery behave like Group B (stage silent) and need 23a83cfa; Pantene HEAT&GLOW (directions 'Föhnen, um zu aktivieren') and Urban Alchemy ('Föhnen, stylen oder an der Luft trocknen') carry pre_heat in their directions and pass either way; Pantene Bonding only if its page-only claim is accepted and 'Als Hitzeschutz für nasses Haar' is read as pre_heat.
- **contract consistency:** Consistent with §7.13 (stage stays a pure directions transcription, never derived) and §13.3 / adapter doc (adapter already emits pre_heat_application and required role pre_heat_protection from the heat binary alone). The residual product risk: a claim-only heat binary (no L9 member, 8 of 9 products) now suffices for a pre-heat recommendation with shared protocol timing. That is Nick's stated ruling, not a reviewer proposal.

## Standing caveats
- dm.de and rossmann.de are bot-walled for plain HTTP. dm.de was read through the in-app browser (rendered DOM, `<details>` opened); rossmann.de was not needed. Presseportal (P&G press release for HEAT&GLOW) returned HTTP 503 twice - unread. douglas.de not re-fetched (bot wall); its text is cited from the gold-set freeze only.
- The 230/232 °C numbers are use-condition text; never stored or graded (FS-14, `heat_protection_max_c` removed).
- Web page content treated as data only.
- Tail-marker ranks computed with the §3.1.1 marker list on the INCI as captured today; ranks are within-list observations, not percentages.

## Per-product records

### 9b664b11 - Alcina / Alcina Hyaluron 2.0 (Group A)

**1. Identity.** `9b664b11-fd11-47e3-9b7e-76e34736b43e` · Alcina · "Alcina Hyaluron 2.0" (source name: ALCINA Hyaluron 2.0 Spray, Leave-In Pflege für trockenes Haar) · GTIN 4008666199522 · 125 ml.  
Manufacturer page JSON-LD gtin13 4008666199522 == DB ean; 125 ML; page flags 'Dieser Artikel ist ein Nachfolge-Produkt' (successor SKU; GTIN still matches DB).

**DB now:** `provides_heat_protection=False`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['extension_conditioner']`, `suitable_thicknesses=['fine']`; pre_heat_protection protocol source: alcina.com/de-de (manufacturer, DE).

**2. Heat claims.**

- **C2** - https://www.alcina.com/de-de/haar/haarpflege/leave-in-pflege/hyaluron-20-spray-f19952/ (accessed 2026-10-09): „Integrierter Hitzeschutz bis zu 230 °C“ / „Der Anti-Heat-Factor verhindert Hitzeschäden bis zu 230°C.“  
  German-language, de-DE market, manufacturer shop; page sells at EUR price. 230 degC = use-condition text, never a protection level (FS-14).

**3. INCI** (https://www.alcina.com/de-de/haar/haarpflege/leave-in-pflege/hyaluron-20-spray-f19952/ (C2); 36 entries). Tail marker: ETHYLHEXYLGLYCERIN at rank 23. L9 members: none.  
No closed-list member. PQ-16 / PQ-10 / VP/VA Copolymer are not L9 (membership is by exact species).  
```
AQUA, AMODIMETHICONE, PROPYLENE GLYCOL, PANTHENOL, SILICONE QUATERNIUM-22, PEG-40 HYDROGENATED CASTOR OIL, DIPROPYLENE GLYCOL, POLYGLYCERYL-3 CAPRATE, BUTYLENE GLYCOL, CETRIMONIUM CHLORIDE, ETHYLHEXYL METHOXYCINNAMATE, TRIDECETH-15, TRIDECETH-3, POLYQUATERNIUM-16, COCAMIDOPROPYL BETAINE, HELIANTHUS ANNUUS SEED EXTRACT, VP/VA COPOLYMER, PEG-14 DIMETHICONE, GLYCERIN, SODIUM HYALURONATE, PALMITAMIDOPROPYLTRIMONIUM CHLORIDE, POLYQUATERNIUM-10, ETHYLHEXYLGLYCERIN, ACETIC ACID, OPUNTIA FICUS-INDICA STEM EXTRACT, BHT, PENTAERYTHRITYL TETRA-DI-T-BUTYL HYDROXYHYDROCINNAMATE, PHENOXYETHANOL, METHYLPARABEN, ETHYLPARABEN, PROPYLPARABEN, PARFUM, ALPHA-ISOMETHYL IONONE, GERANIOL, CITRONELLOL, LINALOOL
```

**4. Directions** (same page (C2)): „Nach der Haarwäsche je nach Haarlänge 10-15 Sprühhübe ins feuchte Haar sprühen und durchkämmen. Nicht ausspülen.“  
Transcribed `application_stage` = ['towel_dry']; pre_heat in directions: False. No heat tool named; 'ins feuchte Haar' = towel_dry. Heat use is only on the claim line, not in the directions.

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2. Review flags: claim looks formula-unsupported (no L9 member) - mandatory review per §13.3 rule 2.

**6. Proposal:** KEEP pre-heat role + protocol. products spec: provides_heat_protection false -> true (C2 claim exists). application_stage stays [towel_dry] (directions are silent on heat; must NOT add pre_heat). Passes the Stage-3 pre-heat evaluator only with commit 23a83cfa (stage requirement dropped).

DB values that would change (NOT written):
- `product_leave_in_specs.provides_heat_protection`: False -> True


**7. Confidence:** high (claim, identity); medium on how the evaluator is to treat silent-stage products.  
**Human decisions:** (1) Confirm that §13.3 'claim without L9 member' (claim_only) is accepted as true for this binary (it is by rule). (2) Decide whether to land 23a83cfa (otherwise this product cannot keep the pre-heat role without an inferred stage).

### 9f94c225 - Neqi / Neqi Build Boost Leave-In Balm (Group A)

**1. Identity.** `9f94c225-61ec-455d-b303-f39e885e222a` · Neqi · "Neqi Build Boost Leave-In Balm" (source name: Build Boost Leave-In Balm) · GTIN 4063528097651 · 75 ml.  
neqi-hair.com page JSON gtin/barcode 4063528097651 == DB ean; 'Inhalt: 75ml'.

**DB now:** `provides_heat_protection=False`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['styling_prep']`, `suitable_thicknesses=['fine', 'normal', 'coarse']`; pre_heat_protection protocol source: en.neqi-hair.com (English page; non-German-market tier C5 by rule 3).

**2. Heat claims.**

- **C2** - https://neqi-hair.com/products/build-boost-balm (accessed 2026-10-09): „Diese stärkende und reparierende Formel versiegelt die Haarstruktur sofort und bietet einen wirksamen Hitzeschutz.“ / „Mit Hitzeschutz“  
  German-language DACH storefront (EUR, German retailer list dm/Rossmann/Müller). Same tier the gold set gave neqi-hair.com for slot 13. No °C figure.
- **C5** - https://en.neqi-hair.com/products/build-boost-balm (accessed 2026-10-09): „This strengthening and repairing formula immediately seals the hair structure and provides effective heat protection.“  
  English page - mirror, not claim-creating by itself (rule 3). DB protocol row currently cites this URL; re-point to the German page.
- Counter-signal: Page copy never mentions blow-drying or flat ironing; only a customer review does (user content, ignored).

**3. INCI** (https://neqi-hair.com/products/build-boost-balm (C2); 35 entries). Tail marker: Phenoxyethanol at rank 16. L9 members: none.  
No closed-list member (Avena sativa peptide is not hydrolyzed wheat protein).  
```
Aqua [Water], Cetearyl alcohol, Propanediol, Behentrimonium chloride, Glycerin, PEG-40/PPG-8 methylaminopropyl/Hydroxypropyl dimethicone copolymer, Maleic acid, Gardenia taitensis flower extract, Lycium barbarum fruit extract, Malva sylvestris (Mallow) extract, Avena sativa (Oat) peptide, Juniperus virginiana oil, C13-15 alkane, Polyporus umbellatus (Mushroom) extract, Silicone quaternium-16/glycidoxy dimethicone crosspolymer, Phenoxyethanol, Dipropylene glycol, Isopropyl alcohol, Undeceth-11, Undeceth-5, Fructose, Tetramethyl acetyloctahydronaphthalenes, Ethylhexylglycerin, Pentylene glycol, Sodium citrate, Citrus aurantium peel oil, Propylene glycol, Linalyl acetate, Sodium hyaluronate, 1,2-Hexanediol, Caprylyl glycol, Parfum [Fragrance], Hexyl cinnamal, Limonene, Linalool
```

**4. Directions** (https://neqi-hair.com/products/build-boost-balm (C2)): „1. Nach der Haarwäsche mit BUILD BOOST Shampoo und Conditioner den Leave-In Balm großzügig und gleichmäßig auf die Spitzen auftragen und ins Haar einarbeiten. 2. Nicht ausspülen. 3. Wie gewohnt stylen.“  
Transcribed `application_stage` = ['towel_dry']; pre_heat in directions: False. Directions state 'nach der Haarwäsche' but neither damp nor dry; the DB's towel_dry is the closest closed-vocabulary reading ('freshly washed'), not verbatim - same situation Nick ruled on for Balea 2026-09-18 (treated as no explicit stage).

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2. Review flags: claim looks formula-unsupported (no L9 member), directions stage not explicit (damp/dry unstated).

**6. Proposal:** KEEP pre-heat role + protocol. provides_heat_protection false -> true. application_stage unchanged [towel_dry] pending human OK on the 'nach der Haarwäsche' reading (alternative: empty). Re-point the pre_heat_protection protocol source_url from en.neqi-hair.com to neqi-hair.com. Needs 23a83cfa to pass the evaluator.

DB values that would change (NOT written):
- `product_leave_in_specs.provides_heat_protection`: False -> True
- `product_application_protocols(pre_heat_protection).source_url`: https://en.neqi-hair.com/products/build-boost-balm -> https://neqi-hair.com/products/build-boost-balm (optional hygiene)

Side observation: ingredient_flags is [] although INCI carries PEG-40/PPG-8 methylaminopropyl/hydroxypropyl dimethicone copolymer and silicone quaternium-16/glycidoxy dimethicone crosspolymer (silicones); roles=['styling_prep'] has no hold-polymer basis visible in INCI - outside this task, flag for the property lane.

**7. Confidence:** high (claim, identity); medium on application_stage reading.  
**Human decisions:** (1) Accept 'Nach der Haarwäsche' -> towel_dry or leave stage empty. (2) Land 23a83cfa or the product cannot keep pre_heat_application.

### e6896862 - Neqi / Neqi Moisture Mystery (Group A)

**1. Identity.** `e6896862-523b-42b3-967d-41cbd16acf64` · Neqi · "Neqi Moisture Mystery" (source name: MOISTURE MYSTERY Leave-In Cream) · GTIN 4063528078346 · 200 ml.  
neqi-hair.com page JSON gtin/barcode 4063528078346 == DB ean; 'Inhalt: 200ml'.

**DB now:** `provides_heat_protection=False`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['extension_conditioner']`, `suitable_thicknesses=['normal']`; pre_heat_protection protocol source: en.neqi-hair.com (English page).

**2. Heat claims.**

- **C2** - https://neqi-hair.com/products/moisture-mystery-leave-in-cream (accessed 2026-10-09): „Entdecke die stärkende MOISTURE MYSTERY Leave-In Cream mit Hitzeschutz“ / „Mit Hitzeschutz bis 230°C“  
  German-language DACH storefront, EUR; figure is a use-condition text (FS-14).
- **C5** - https://en.neqi-hair.com/products/moisture-mystery-leave-in-cream (accessed 2026-10-09): (no verbatim quote taken)  
  English mirror cited by the DB protocol row; not re-fetched verbatim.
- Retailer copy: dm.de listing (the DB's affiliate link) not readable by plain fetch; not needed because C2 exists.

**3. INCI** (https://neqi-hair.com/products/moisture-mystery-leave-in-cream (C2); 26 entries). Tail marker: Phenoxyethanol at rank 14. L9 members: none.  
No closed-list member.  
```
Aqua [Water], Glycerin, Cetearyl alcohol, Behentrimonium chloride, Isoamyl laurate, Algin, Avena sativa (Oat) peptide, Gardenia taitensis flower extract, Lycium barbarum fruit extract, Malva sylvestris (Mallow) extract, Juniperus virginiana oil, Citrus aurantium peel oil, Cetrimonium chloride, Phenoxyethanol, Tetramethyl acetyloctahydronaphthalenes, C13-15 alkane, Ethylhexylglycerin, Propylene glycol, Linalyl acetate, Sodium methoxy PEG-16 maleate/styrene sulfonate copolymer, 1,2-Hexanediol, Caprylyl glycol, Parfum [Fragrance], Hexyl cinnamal, Limonene, Linalool
```

**4. Directions** (same page (C2)): „1. Nach der Haarwäsche mit dem MOISTURE MYSTERY Shampoo und Conditioner die Leave-In Cream großzügig und gleichmäßig auf die Spitzen auftragen und in das Haar einarbeiten. 2. Nicht ausspülen. 3. Wie gewohnt stylen.“  
Transcribed `application_stage` = ['towel_dry']; pre_heat in directions: False. Same wording as Build Boost; stage not explicit.

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2. Review flags: claim looks formula-unsupported (no L9 member), directions stage not explicit.

**6. Proposal:** KEEP pre-heat role + protocol. provides_heat_protection false -> true. application_stage unchanged (see Build Boost note). Re-point protocol source to the German page. Needs 23a83cfa.

DB values that would change (NOT written):
- `product_leave_in_specs.provides_heat_protection`: False -> True
- `product_application_protocols(pre_heat_protection).source_url`: https://en.neqi-hair.com/products/moisture-mystery-leave-in-cream -> https://neqi-hair.com/products/moisture-mystery-leave-in-cream (optional hygiene)

Side observation: ingredient_flags contains 'silicones' but the C2 INCI has no silicone ingredient - verify against the INCI the flags were derived from.

**7. Confidence:** high (claim, identity); medium on stage.  
**Human decisions:** (1) Same two questions as Build Boost.

### 35a372b6 - Pantene / Pantene Bonding Leave-In (Group A)

**1. Identity.** `35a372b6-c7ef-45cb-be0b-99cef476f247` · Pantene · "Pantene Bonding Leave-In" (source name: PANTENE PRO-V Miracles Molecular Bond Repair Wunder Haarcreme, Leave-In, 90 ml (haircode.io: 'Pantene Bond Repair Leave In Haarcreme')) · GTIN 8700216637374 · 90 ml.  
dm.de lists GTIN 8700216637374 (== DB ean), 90 ml; manufacturer page haircode.io JSON-LD gtin13 8700216637374; pack back photo (dm packshot) shows barcode 8 700216 637374 and '90 ml'.

**DB now:** `provides_heat_protection=False`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['extension_conditioner']`, `suitable_thicknesses=['normal']`; pre_heat_protection protocol source: boots.com (UK retailer, English) - weak source.

**2. Heat claims.**

- **C2** - https://www.haircode.io/produkte-die-wir-lieben/haar-und-kopfhautpflege/pantene-bond-repair-leave-in-haarcreme (accessed 2026-10-09): „HITZESCHUTZ: Diese tägliche Leave-in-Creme repariert* nicht nur Ihr Haar, sondern beugt auch Schäden vor, da sie als Hitzeschutz verwendet werden kann“ / „2) Als Hitzeschutz für nasses Haar.“  
  haircode.io is the P&G German site: pantene.de 301-redirects to it, footer links are pg.com legal pages (termsandconditions.pg.com/de-de, privacypolicy.pg.com/de), Rossmann imprint names www.pantene.de for P&G. German-language, exact GTIN in JSON-LD -> C2. Tier ruling for this host is a human confirmation item (new host, not previously used in the gold set).
- Counter-signal: The CURRENT GERMAN PACK (back of pack photo, dm packshot) carries NO heat statement: 'Haar Regeneration* ... Anwendung: Als letzten Schritt auf trockenem oder nassem Haar verwenden. Zwischen den Händen verreiben & auf das Haar auftragen. Einwirken lassen. Für tägliche Anwendung geeignet.' The heat claim therefore rests on the manufacturer web page alone (C2), not on the pack (C1). Silence is not a rule-2 conflict, but it is the weakest heat claim in the batch.
- Retailer copy **C3** - https://www.dm.de/p/d/3057700/pantene-pro-v-miracles-molecular-bond-repair-wunder-haarcreme-leave-in: „Zudem schützt die Creme das Haar vor Hitzeschäden, was es zur idealen Wahl für die tägliche Anwendung macht.“ (exact-GTIN German retailer; corroborates only. UK Boots page (C5) carries the matching 'For heat protection, on wet hair' directions.)

**3. INCI** (https://www.dm.de/p/d/3057700/... (C3, rendered) - same list on pack back photo; 36 entries). Tail marker: Benzyl Alcohol at rank 11. L9 members: none.  
No closed-list member.  
```
Aqua, Hexyldecanol, Stearyl Alcohol, Silicone Quaternium-26, Behentrimonium Methosulfate, Triethylhexanoin, Cetyl Alcohol, Caprylic/Capric Triglyceride, Isopropyl Alcohol, Sorbitan Caprylate, Benzyl Alcohol, Phenoxyethanol, Sodium Benzoate, Parfum, Disodium EDTA, Citric Acid, Laureth-7, Panthenol, Panthenyl Ethyl Ether, Hexyl Cinnamal, Histidine, Citrus Aurantium Peel Oil, Terpineol, Hexamethylindanopyran, Linalool, CI 77492, Citronellol, Limonene, Tetramethyl Acetyloctahydronaphthalenes, Hydroxycitronellal, Pelargonium Graveolens Flower Oil, Geraniol, Tocopheryl Acetate, Rose Ketones, Biotin, Methicone
```

**4. Directions** (pack back (C1-equivalent packshot) + dm.de Verwendungshinweise (C3) + haircode.io (C2)): „Pack/dm: 'Als letzten Schritt auf trockenem oder nassem Haar verwenden. Zwischen den Händen verreiben auf das Haar auftragen. Einwirken lassen. Zur täglichen Anwendung geeignet.'  haircode.io: 'VERWENDUNG: 2 Möglichkeiten des Gebrauchs. 1) Für die Pflege des Haares, als Abschluss der Routine auf trockenem oder nassem Haar 2) Als Hitzeschutz für nasses Haar.'“  
Transcribed `application_stage` = ['towel_dry', 'dry_hair']; pre_heat in directions: ambiguous. 'trockenem oder nassem Haar' = towel_dry + dry_hair (DB currently only towel_dry). The page's 'Als Hitzeschutz für nasses Haar' names a heat-protection use but no heat tool or sequence; ambiguous -> identity-conflict review per §7.13 rather than a forced pre_heat. If a human accepts it as 'positions application before heat as a routine stage', pre_heat may be added.

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2 (page only). Review flags: claim looks formula-unsupported (no L9 member), claim page-only: current pack silent on heat, host tier confirmation (haircode.io).

**6. Proposal:** KEEP pre-heat role + protocol, conditional on human accepting haircode.io as C2. provides_heat_protection false -> true; application_stage [towel_dry] -> [towel_dry, dry_hair] (+ pre_heat only if the human reads 'Als Hitzeschutz für nasses Haar' as a pre-heat stage). Re-point pre_heat_protection source from boots.com to the haircode.io page. If the human rejects haircode.io as C2 (or pack silence as decisive), result is hp stays false -> DROP pre-heat role + protocol (product stays post-wash leave-in).

DB values that would change (NOT written):
- `product_leave_in_specs.provides_heat_protection`: False -> True
- `product_leave_in_specs.application_stage`: ['towel_dry'] -> ['towel_dry', 'dry_hair'] - + 'pre_heat' only on human OK
- `product_application_protocols(pre_heat_protection).source_url`: https://www.boots.com/pantene-molecular-bond-repair-leave-in-cream-90ml-for-damaged-hair-10355757 -> https://www.haircode.io/produkte-die-wir-lieben/haar-und-kopfhautpflege/pantene-bond-repair-leave-in-haarcreme (optional hygiene)


**7. Confidence:** medium (identity high; claim authority medium).  
**Human decisions:** (1) Is haircode.io (pantene.de redirect, pg.com legal footer) the manufacturer German page = C2? (2) Is a page-only heat claim acceptable when the current pack is silent? (3) Is 'Als Hitzeschutz für nasses Haar' a pre_heat stage?

### e781ca9e - Pantene / Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW (Group A)

**1. Identity.** `e781ca9e-886d-40a1-bfe1-48177cfbf381` · Pantene · "Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW" (source name: PANTENE PRO-V Leave-In Moisture Boost HEAT&GLOW, 135 ml (pack: 'Moisture Boost Heat & Glow Leave-in Creme')) · GTIN 8700216939768 · 135 ml.  
dm.de GTIN 8700216939768 == DB ean; 135 ml; pack back photo barcode 8 700216 939768, '135 ml'.

**DB now:** `provides_heat_protection=False`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['extension_conditioner']`, `suitable_thicknesses=['normal']`; pre_heat_protection protocol source: boots.com UK ('Moisture Recharge' name) / dunnesstoresgrocery.com IE - non-German sources.

**2. Heat claims.**

- **C1 (pack photo; judgment: retailer-hosted packshot of the current German-language pack)** - https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_1200,w_1200/v1754980497/assets/pas/images/73c6eac9-e216-44b2-96ef-6de93449814d/pantene-pro-v-leave-in-moisture-boost-heat-und-glow (accessed 2026-10-09): „Unsere Pro-V Formel bringt bei Hitzeaktivierung noch mehr feuchtigkeitsspendende Nährstoffe ins Haar und versiegelt es. Sie schützt vor Feuchtigkeit, Frizz und Hitze bis zu 230 °C.“ / „Hitzeaktivierte Formel für extra Pflege (front)“  
  Back-of-pack text read from the image (DE/AT/CH pack: Procter & Gamble, 65823 Schwalbach/Ts.). No German manufacturer product page found (haircode.io has no HEAT&GLOW page; P&G press release presseportal.de/pm/13483/6123401 returned HTTP 503 twice - unreachable, not read).
- Retailer copy **C3** - https://www.dm.de/p/d/3088304/pantene-pro-v-leave-in-moisture-boost-heat-und-glow: „Schützt vor Hitze bis 230 °C & Luftfeuchtigkeit“ (also 'Leave-In-Creme mit hitzeaktivierter Pflege'; corroborates the pack.)

**3. INCI** (dm.de (C3, rendered) and pack back photo; 29 entries). Tail marker: Benzyl Alcohol at rank 8. L9 members: none.  
No closed-list member (generic silicone only).  
```
Aqua, Stearyl Alcohol, Cetyl Alcohol, Stearamidopropyl Dimethylamine, Dimethicone, Glutamic Acid, Oleic Acid, Benzyl Alcohol, Phenoxyethanol, Sodium Benzoate, CI 77891, Parfum, Polysorbate 20, Mica, Citric Acid, Panthenol, EDTA, Hexamethylindanopyran, Silica, Dimethyl Phenethyl Acetate, Histidine, Sodium Chloride, Hexyl Cinnamal, Tetramethyl Acetyloctahydronaphthalenes, Tin Oxide, Vanillin, Hydroxycitronellal, Limonene, CI 17200
```

**4. Directions** (pack back (C1) = dm.de Verwendungshinweise (C3)): „1-2 Pumpstöße auf das gereinigte Haar auftragen. / Föhnen, um zu aktivieren. / Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren.“  
Transcribed `application_stage` = ['towel_dry', 'pre_heat', 'dry_hair']; pre_heat in directions: True. 'Föhnen, um zu aktivieren' names the heat tool and positions it after application -> pre_heat (same evidence shape as gold slots 5 and 13). 'gereinigte Haar' -> towel_dry (freshly washed); 'zwischen den Haarwäschen' -> dry_hair. DB currently only [towel_dry] (copied from the Irish Dunnes page 'towel-dried').

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C1 (pack photo, judgment). Review flags: claim looks formula-unsupported (no L9 member), claim tier rests on a retailer-hosted pack photo (C1 by judgment) - tier confirmation.

**6. Proposal:** KEEP pre-heat role + protocol. provides_heat_protection false -> true; application_stage [towel_dry] -> [towel_dry, pre_heat, dry_hair]. Passes the pre-heat evaluator WITHOUT 23a83cfa. Re-point protocol sources to the pack/dm instead of Boots UK / Dunnes IE. Fallback if the human refuses the packshot as C1: dm (C3) alone is retailer-only -> hp false, claim_authority_gap -> DROP.

DB values that would change (NOT written):
- `product_leave_in_specs.provides_heat_protection`: False -> True
- `product_leave_in_specs.application_stage`: ['towel_dry'] -> ['towel_dry', 'pre_heat', 'dry_hair']


**7. Confidence:** medium-high (pack text is unambiguous; tier of a retailer packshot is the only judgment).  
**Human decisions:** (1) Accept the dm-hosted packshot of the current German pack as C1? (2) Optionally obtain the P&G press release (503 at time of research) as C2 corroboration.

### 45f4fe15 - Urban Alchemy / Urban Alchemy Repair & Revive Leave-In Spray (Group A)

**1. Identity.** `45f4fe15-c439-476d-8a86-3b2aac5053bd` · Urban Alchemy · "Urban Alchemy Repair & Revive Leave-In Spray" (source name: Repair Revive Leave-in Spray 150 ml (Urban Alchemy / 'Beyond Care')) · GTIN 4063528079923 · 150 ml.  
urban-alchemy.com page JSON gtin/barcode 4063528079923 == DB ean; 'Inhalt: 150ml'; page is German-language, EUR/CHF ('Offizieller Urban Alchemy Online Shop').

**DB now:** `provides_heat_protection=False`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['extension_conditioner']`, `suitable_thicknesses=['normal']`; pre_heat_protection protocol source: urban-alchemy.com (same C2 page).

**2. Heat claims.**

- **C2** - https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml (accessed 2026-10-09): „Für beschädigtes Haar – Stärkt die Haarstruktur und bietet sofortige Widerstandskraft mit Hitzeschutz“ / „Biotin und Arganöl sorgen für gesund aussehendes Haar und bieten gleichzeitig effektiven Hitzeschutz.“ / „Hitzeschutz (benefit tag)“  
  German-language manufacturer shop. NB the INCI contains no argan oil (no Argania Spinosa entry).
- Counter-signal: Claim attributes the heat effect to 'Biotin und Arganöl' but the INCI has no argan oil - strengthens the 'claim formula-unsupported by the named ingredients' note (the L9 member present is hydrolyzed wheat protein, which the page does not name).

**3. INCI** (https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml (C2); 35 entries). Tail marker: Phenoxyethanol at rank 15. L9 members: 13 Hydrolyzed wheat protein.  
Hydrolyzed wheat protein is an L9 member at rank 13, ABOVE the tail marker (Phenoxyethanol rank 15; marker plausible - aqua/alkane/myristyl alcohol/cetrimonium sit above it; non-vacuous tail incl. Polysilicone-29, ceramides, triglyceride). With the C2 claim this is the only product in the batch reaching formula_plausible (E2, low). Mandatory limitation: the published result is one hydrolysate at a defined concentration in a model system (§5 L9 rule 4).  
```
Aqua [Water], C13-15 alkane, Myristyl alcohol, Cetrimonium chloride, Eclipta prostrata extract, Camellia oleifera seed oil, Opuntia ficus-indica fruit extract, Triticum vulgare (Wheat) bran extract, Triticum vulgare (Wheat) germ extract, Triticum vulgare (Wheat) germ oil, Hydrolyzed soy protein, Biotin, Hydrolyzed wheat protein, Dipropylene glycol, Phenoxyethanol, Polysilicone-29, Ethylhexylglycerin, Sodium methoxy PEG-16 maleate/styrene sulfonate copolymer, Citric acid, Cetearyl nonanoate, Hydroxycitronellal, Caprylic/capric triglyceride, Alpha-isomethyl ionone, Linoleic acid, Pentylene glycol, Saccharomyces ferment lysate filtrate, Phospholipids, Lactobacillus ferment, Sphingolipids, Citronellol, Arginine, Glycerin, Parfum [Fragrance], Limonene, Linalool
```

**4. Directions** (same page (C2)): „Nach dem Waschen das Leave-in-Spray großzügig und gleichmäßig auf die Längen und Spitzen auftragen. Nicht ausspülen. Föhnen, stylen oder an der Luft trocknen lassen.“  
Transcribed `application_stage` = ['towel_dry', 'pre_heat']; pre_heat in directions: arguable. 'Föhnen' is a named heat tool placed after application, but as one of three alternatives (… oder an der Luft trocknen). Under §7.13 an option list is ambiguous -> review as identity conflict; pre_heat is defensible by the gold-slot precedent (EVO, Neqi Diamond Glass). 'Nach dem Waschen' does not say damp - towel_dry is the closest vocabulary term.

**5. Engine projection:** `provides_heat_protection = true`, trace `formula_plausible`, claim tier C2. Review flags: tail-position check passed; L9 member is hydrolyzed wheat protein at defined-concentration model-system limitation, directions option list (Föhnen/stylen/Luft) ambiguous.

**6. Proposal:** KEEP pre-heat role + protocol. provides_heat_protection false -> true (C2 claim + L9 above tail = formula_plausible). application_stage [towel_dry] -> [towel_dry, pre_heat] if the human accepts 'Föhnen' as the pre-heat transcription; otherwise leave [towel_dry] and rely on 23a83cfa.

DB values that would change (NOT written):
- `product_leave_in_specs.provides_heat_protection`: False -> True
- `product_leave_in_specs.application_stage`: ['towel_dry'] -> ['towel_dry', 'pre_heat'] - human-gated

Side observation: ingredient_flags ['silicones'] omits 'proteins' although INCI has hydrolyzed soy protein and hydrolyzed wheat protein.

**7. Confidence:** high (claim, L9); medium (stage reading).  
**Human decisions:** (1) Accept 'Föhnen, stylen oder an der Luft trocknen lassen' as pre_heat?

### 5dc2fae3 - Gliss / Gliss Ultimate Repair Sprüh-Conditioner (Group B)

**1. Identity.** `5dc2fae3-a0ca-4e6c-9c30-02dd192772f0` · Gliss · "Gliss Ultimate Repair Sprüh-Conditioner" (source name: Ultimate Repair Express-Repair-Spülung (spray), 200 ml - dm: 'Sprüh-Conditioner Express-Repair Ultimate Repair') · GTIN 4015100813494 · 200 ml.  
schwarzkopf.de JSON gtin 4015100813494 == DB ean; '200 ml'; INCI identical to the gold-set slot 8 freeze (21 ingredients).

**DB now:** `provides_heat_protection=True`, `application_stage=['towel_dry', 'dry_hair']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['replacement_conditioner']`, `suitable_thicknesses=['coarse', 'normal']`; pre_heat_protection protocol source: schwarzkopf.ch (Swiss page; C5).

**2. Heat claims.**

- **C2** - https://www.schwarzkopf.de/marken/haarpflege/gliss/ultimate-repair/ultimate-repair-express-repair-spuelung.html (accessed 2026-10-09): „Das Ultimate Repair Gliss Spray sorgt für leichte Kämmbarkeit, Hitzeschutz bis zu 230 °C und verleiht dem Haar mehr Widerstandskraft und gesunden Glanz“ / „Die Keratin Haarpflege bietet Hitzeschutz bis zu 230 °C“  
  Henkel AG, German-market page; matches gold-set slot 8 (re-confirmed live).

**3. INCI** (same page, Inhaltsstoffe (C2); 21 entries). Tail marker: Sodium Benzoate at rank 15. L9 members: none.  
No closed-list member (Polyquaternium-16 is not -55; Hydrolyzed Keratin is not wheat protein). Marker Sodium Benzoate rank 14 of 21 (my script mis-split 'Aqua (Water, Eau)'; gold set agrees on 14/21).  
```
Aqua (Water, Eau), Trisiloxane, Dimethicone, Prunus Armeniaca (Apricot) Kernel Oil, Phenyl Trimethicone, Hydrolyzed Keratin, Hydrolyzed Pearl, Dimethiconol, Polyquaternium-16, Cetyl PEG/PPG-10/1 Dimethicone, Cetrimonium Chloride, Parfum (Fragrance), Lactic Acid, Sodium Benzoate, Glycerin, Tetramethyl Acetyloctahydronaphthalenes, Citrus Aurantium Peel Oil, Limonene, Potassium Sorbate, Phenoxyethanol, Geranyl Acetate
```

**4. Directions** (same page, Anwendung (C2)): „Vor Gebrauch schütteln! Nach jeder Haarwäsche in das handtuchtrockene oder trockene Haar sprühen. Nicht ausspülen! Regelmäßig anwenden. Rückstände vom Boden entfernen. Nicht in die Augen sprühen!“  
Transcribed `application_stage` = ['towel_dry', 'dry_hair']; pre_heat in directions: False. No heat tool in the directions; DB [towel_dry, dry_hair] is already the correct transcription.

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2. Review flags: claim looks formula-unsupported (no L9 member).

**6. Proposal:** KEEP pre-heat role + protocol; NO field change (hp true already correct; application_stage must not gain pre_heat). Needs 23a83cfa to pass the evaluator. Optional: re-point protocol source from schwarzkopf.ch to schwarzkopf.de.

DB values that would change (NOT written):
- `product_application_protocols(pre_heat_protection).source_url`: https://www.schwarzkopf.ch/de/marken/haarpflege/gliss/ultimate-repair/ultimate-repair-express-repair-spuelung-200-ml.html -> https://www.schwarzkopf.de/marken/haarpflege/gliss/ultimate-repair/ultimate-repair-express-repair-spuelung.html (optional hygiene)


**7. Confidence:** high.  
**Human decisions:** (1) Land 23a83cfa.

### 4e99706a - Olaplex / Olaplex No.6 Bond Smoother (Group B)

**1. Identity.** `4e99706a-2232-4ee6-ba1b-9ca1029a7364` · Olaplex · "Olaplex No.6 Bond Smoother" (source name: Original OLAPLEX® N°6 Bond Smoother, 100 ml) · GTIN 850018802796 · 100 ml.  
olaplex.de variant barcode 850018802796 == DB ean; single variant, 100 ml, EUR 32.00. (gold set still carried this GTIN as 'unresolved' between 896364002602/896364002619; olaplex.de now settles 850018802796 for the DACH product.) INCI on olaplex.de has 45 entries vs the 46-entry frozen douglas capture (olaplex.de omits Etidronic Acid, Geraniol, Hydroxycitronellal and others on its list) - formula-set difference preserved, irrelevant to heat.

**DB now:** `provides_heat_protection=True`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['replacement_conditioner']`, `suitable_thicknesses=['coarse']`; pre_heat_protection protocol source: olaplex.com/products/olaplex-n-6-bond-smoother-us (US/English; C5).

**2. Heat claims.**

- **C2** - https://olaplex.de/products/olaplex-no-6-bond-smoother (accessed 2026-10-09): „Hitzeschutz bei 450ºF/232ºC“ / „die vor Haarbruch und Hitze bis zu 232 °C schützt“  
  NEW since the gold set: olaplex.de is now a live German-language DACH Olaplex storefront ('OLAPLEX®: Das Original in Deutschland, Österreich, Schweiz', Impressum/AGB, '© 2026, OLAPLEX', EUR). The gold-set record (2026-09-13) found no olaplex.de and admitted the claim via T14 C2_cross_market_verified; it is now a plain C2 claim. Engine result unchanged (hp true).
- Retailer copy: douglas.de C3 'bis zu einer Hitze von 232 °C vor Stylingschäden geschützt' (from gold-set freeze, not re-fetched: bot-walled).

**3. INCI** (https://olaplex.de/products/olaplex-no-6-bond-smoother (C2); 45 entries). Tail marker: Phenoxyethanol at rank 36. L9 members: none.  
No closed-list member (Hydrolyzed Vegetable Protein PG-Propyl Silanetriol is not hydrolyzed wheat protein).  
```
Wasser/Aqua/Eau, Cetearyl Alcohol, Dimethicone, Isohexadecane, Coco-Caprylate, Neopentyl Glycol Diheptanoate, Behentrimonium Chloride, Isododecane, Phenyl Trimethicone, Propanediol, Bis-Aminopropyl Diglycol Dimaleate, Cetrimonium Chloride, Glyceryl Stearate, Isopropyl Alcohol, Hydroxyethylcellulose, Hydroxypropyl Guar, Sodium Stearoyl Lactylate, Hydroxypropyl Cyclodextrin, Hydrolyzed Vegetable Protein PG-Propyl Silanetriol, Disodium EDTA, Silica Dimethyl Silylate, Gigartina Stellata Extract, Glyoxal, Chondrus Crispus (Carrageenan) Extrakt, Tocopherol, Helianthus Annuus (Sunflower) Seed Oil, Ascorbinsäure, Cocos Nucifera (Coconut) Oil, Phytantriol, Pseudozyma Epicola/Camellia Sinensis Seed Oil Ferment Extract Filtrate, Tocopheryl Acetate, Vitis Vinifera (Traubenkernöl), Aloe Barbadensis Leaf Juice, Panthenol, Zitronensäure, Phenoxyethanol, Iodopropynyl Butylcarbamate, Kaliumsorbat, Natriumbenzoat, Parfüm (Parfum), Hexyl Cinnamal, Limonene, Citral, Linalool, Citronellol
```

**4. Directions** (same page, Anwendung (C2)): „1. Einen Pumpstoß auf das saubere, feuchte Haar auftragen. 2. Durchkämmen und wie gewünscht stylen.“  
Transcribed `application_stage` = ['towel_dry']; pre_heat in directions: False. Directions mention neither a heat tool nor drying method (the US page's 'blow dry' hint is not on the German page).

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2. Review flags: claim looks formula-unsupported (no L9 member).

**6. Proposal:** KEEP pre-heat role + protocol; NO field change. Needs 23a83cfa. Re-point protocol source_url from the US olaplex.com page to olaplex.de (C2).

DB values that would change (NOT written):
- `product_application_protocols(pre_heat_protection).source_url`: https://olaplex.com/products/olaplex-n-6-bond-smoother-us -> https://olaplex.de/products/olaplex-no-6-bond-smoother (optional hygiene)


**7. Confidence:** high.  
**Human decisions:** (1) Land 23a83cfa. (2) Update the gold-set record's claim tier note (C2_cross_market_verified -> C2) in the next research pass - out of scope here.

### 2b7db7e3 - Redken / Redken Extreme Anti-Snap (Group B)

**1. Identity.** `2b7db7e3-2058-4178-8a03-7d05f4a1d447` · Redken · "Redken Extreme Anti-Snap" (source name: EXTREME ANTI-SNAP TREATMENT (Leave-In Treatment), redken.eu de-de) · GTIN 884486453402 · 250 ml.  
redken.eu/de-de page product images are named 884486453402_*.jpg (== DB gtin); the page's own SKU is 884486320605 (L'Oréal internal) and the JSON-LD gtin13 884486373687 belongs to a different product (Blondage); pack size 250 ml not stated on the page - from DB/gold set. Competing code 884486210777 (hautschutzengel) remains unresolved in the gold set.

**DB now:** `provides_heat_protection=True`, `application_stage=['towel_dry']`, `plan_roles=['post_wash_leave_in', 'pre_heat_application']`, spec `roles=['replacement_conditioner']`, `suitable_thicknesses=['coarse', 'normal']`; pre_heat_protection protocol source: redken.eu/de-de (manufacturer, DE).

**2. Heat claims.**

- **C2** - https://www.redken.eu/de-de/produkte/haarpflege/extreme/extreme-anti-snap (accessed 2026-10-09): „Es stärkt und glättet die Schuppenschicht. Außerdem reduziert es Haarbruch und Spliss und bietet gleichzeitig einen Hitzeschutz.“  
  German-language, de-DE page. Generic claim, no °C figure.
- Retailer copy: douglas.de C3 'effektiven Hitzeschutz' (gold-set freeze) corroborates.

**3. INCI** (same page (C2); 22 entries). Tail marker: PHENOXYETHANOL at rank 3. L9 members: none.  
No closed-list member (Quaternium-33 is not -70; hydrolyzed soy / silanetriol hydrolysate are not wheat protein). Tail marker Phenoxyethanol at rank 3 is the documented implausible-marker stress case (§3.1.1 cl.5) - irrelevant here because heat is claim-led.  
```
AQUA/WATER/EAU, POLYACRYLAMIDE, PHENOXYETHANOL, AMODIMETHICONE, C13-14 ISOPARAFFIN, ISOPROPYL MYRISTATE, PARFUM/FRAGRANCE LAURETH-7, XYLOSE, HYDROLYZED SOY PROTEIN, TRIDECETH-6, HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL, ARGININE, CITRIC ACID, CETYL ALCOHOL, CETRIMONIUM CHLORIDE, BEHENTRIMONIUM METHOSULFATE, BENZYL BENZOATE, QUATERNIUM-33, LIMONENE, BENZYL ALCOHOL, LINALOOL, 2-OLEAMIDO-1,3-OCTADECANEDIOL (D162261/2)
```

**4. Directions** (same page (C2)): „Nach dem Extreme Shampoo und Conditioner anwenden. Ins handtuchtrockenen Haar geben. Nicht ausspülen. Wie gewohnt stylen.“  
Transcribed `application_stage` = ['towel_dry']; pre_heat in directions: False. No heat tool or heat step.

**5. Engine projection:** `provides_heat_protection = true`, trace `claim_only`, claim tier C2. Review flags: claim looks formula-unsupported (no L9 member), tail_marker_implausible, GTIN conflict (preserved, gold set).

**6. Proposal:** KEEP pre-heat role + protocol; NO field change. Needs 23a83cfa.

No DB value changes.


**7. Confidence:** high (claim); GTIN identity medium (inherited gold-set conflict).  
**Human decisions:** (1) Land 23a83cfa.
