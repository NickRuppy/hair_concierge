# Chaarlie Styling — MINI re-check r10

**1491/1500 user-facing cells agree (99.4%); 91/100 products fully agree. Lock: FAIL.**

A/B field-cell classifications: **a=1, b=1, c=0, d=7**. 8 unresolved user-facing disagreement cells (1 rule gaps, 0 packet issues, 7 owner questions); clear lane errors and calculation-log differences do not block.

A = Claude Opus; B = Codex. No preference for B. The request lists 15 field columns and refers to 16 records from the earlier MINI. r10 contains 100 records; all are scored. Route is one composite field preserving destination, held/committed state and boundary reason; application_moment is primary only.

Rules/quotes pinned at scoring time to HEAD **`dcaff25e6406783b6853ecdd3b942303b8362157`** (R9-P). 100/143 screened products selected; bijective cohort/id-map/packet/scope joins verified and 303 frozen artifact hashes checked. Inclusion reasons and exact screen evidence are retained per product in diff.json.

## Ruling effects

| Ruling | Product | Expected | A | B | A / B landed |
|---|---|---|---|---|---|
| R9-Q1 | Balea Styling Spray Volumenpuder Pure Styling | {"required_secondary":"texture"} | {"secondary_jobs":["hold_fix","texture"]} | {"secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R9-Q2 | NEQI Diamond Glass Styling Spray All | {"primary_job":"sleek"} | {"primary_job":"sleek"} | {"primary_job":"sleek"} | yes / yes |
| R9-Q2 | NEQI Diamond Glass Styling Spray All | {"required_secondary":"shine"} | {"secondary_jobs":["frizz_control","shine"]} | {"secondary_jobs":["frizz_control","shine"]} | yes / yes |
| R9-F | got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | {"required_secondary":"frizz_control"} | {"secondary_jobs":["frizz_control"]} | {"secondary_jobs":["frizz_control"]} | yes / yes |
| R8-Q1 | Big Hair Day | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | N/A | N/A | not in cohort |
| R8-H | Moroccanoil Glättende Creme (Smoothing Lotion) | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | yes / yes |
| R8-Q2 | Balea Haarpuder Volumen (Pomegranate) | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Balea Styling Spray Volumenpuder Pure Styling | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | BALI GENTS VOLUMIZING STYLING POWDER | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":[]} | {"primary_job":"volume","secondary_jobs":["texture"]} | yes / yes (other secondary unresolved) |
| R8-Q2 | got2b Styling Puder Volumen Powderfull | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | {"primary_job":"volume","secondary_jobs":[]} | yes / yes (other secondary unresolved) |
| R8-Q2 | Kevin.Murphy Powder.Puff Volume | {"primary_job":null,"texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes (suppression only) |
| R8-Q2 | Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["texture"]} | yes / yes (other secondary unresolved) |
| R8-Q2 | Schwarzkopf taft Haarpuder VOLUMEN | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | {"primary_job":"volume","secondary_jobs":[]} | yes / yes (other secondary unresolved) |
| R8-Q2 | Redken Powder Grip | "The named two-job exception is absent from r10; no regression pass claimed." | N/A | N/A | not in cohort |

R9-Q1 Balea’s other-typed texture promise: **PASS**. This does not settle 7 ungraded-hold splits. NEQI All’s R9-Q2 primary sleek + secondary shine: **PASS**. R9-F gotGloss frizz secondary: **PASS**. R8-H Moroccanoil border route: **PASS**. R8-Q1 Big Hair Day and Redken Powder Grip: **not in r10**.

R8-Q2: **6/6 applicable powder primaries** pass in both, **3/3 explicit texture/grip secondaries** pass in both; 1 formula-blocked powder passes suppression only. 4 powders still have a hold/structured-look secondary dispute. This is a pass for the tested powder-noun rule, not full powder-profile agreement.

### Full screened ruling reach

| Ruling screen | Products | Primary agree | Secondary agree | a / b / c / d cells |
|---|---|---|---|---|
| R9-Q1 | 65 | 65/65 | 60/65 | 1 / 0 / 0 / 4 |
| R9-Q2 | 54 | 54/54 | 47/54 | 1 / 1 / 0 / 5 |
| R9-F | 1 | 1/1 | 1/1 | 0 / 0 / 0 / 0 |

Groups overlap. These are all reached records, including lexical false positives and suppressed profiles. Screen membership does not assign a job; the named oracle checks and individual adjudications decide the reported effects. Exact candidate lines/types and inclusion reasons are in diff.json.

## Every user-facing disagreement

### Balea Sea Salt Texture Spray — secondary_jobs: d

`balea-sea-salt-texture-spray` · `sty-806a42c466`. A=["hold_fix"]; B=[]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “Sorgt für Textur & natürlichen Halt / flexiblen Halt” (C2_house_brand, hold); “flexiblen Halt und... griffige Struktur, die für ein natürliches Finish sorgt” (C2_house_brand, other).

**Owner question:** Should Balea Sea Salt Texture Spray show a hold/fixing secondary for its captured Sorgt für Textur & natürlichen Halt / flexiblen Halt even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### BALI GENTS VOLUMIZING STYLING POWDER — secondary_jobs: b

`bali-gents-haarpuder-volumizing-styling-powder` · `sty-2a14243cc4`. A=[]; B=["texture"]. **Both readings defensible; no lane declared right.**

B reads natürlich strukturierten Look as an explicit texture result; A requires a texture/grip promise and omits it. The standard maps texture/grip but does not explicitly map strukturiert. R6-T/R7-Q2 exclude generic definition only; they do not settle this texture synonym. The C3 Griffigkeit line cannot decide the cell.

Rules: `plans/styling-concept/02-rulings.md:162` (R8-Q2, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406). Affected section: §6.10 texture vocabulary and explicit-result threshold. Frozen C1/C2 evidence: “Leichtigkeit trifft auf maximales Volumen! Das Volumizing Styling Powder ist die perfekte Lösung für sofortige Fülle und einen natürlich strukturierten Look.” (C2, promise).

**Recommendation:** Include an explicit structured-look result as texture when its formula gate passes (Silica Silylate r2 here), subject to owner amendment. No primary change: Puder/Powder remains volume.

**Fix:** Add a normative texture vocabulary entry explicitly deciding whether strukturiert/strukturierter Look is a texture-result promise, distinguishing styling result from feel-only or collection wording; synchronize §6.10 and property set §2.12 before a targeted replay.

### got2b Styling Puder Volumen Powderfull — secondary_jobs: d

`got2b-styling-puder-volumen-powderfull` · `sty-933cbace73`. A=["hold_fix"]; B=[]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “Für sichtbar volleres Haar mit natürlichem Halt.” (C2, promise); “natürlichem Halt” (C2, hold).

**Owner question:** Should got2b Styling Puder Volumen Powderfull show a hold/fixing secondary for its captured natürlichem Halt even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) — secondary_jobs: d

`guhl-foehn-spray-langzeit-volumen` · `sty-02f0cfb2b1`. A=["hold_fix"]; B=[]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “Natürliches Volumen und 48h Halt zauberst du ganz leicht” (C1, promise); “48h Halt” (C1, hold); “Verleiht 48h Halt und lebendiges Volumen” (C1, duration).

**Owner question:** Should GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) show a hold/fixing secondary for its captured 48h Halt even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### Moroccanoil Trockenes Texturspray (Dry Texture Spray) — secondary_jobs: d

`moroccanoil-dry-texture-spray` · `sty-cb4b7abd66`. A=["hold_fix","volume"]; B=["volume"]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “lang anhaltender Halt / flexibler Halt” (C2, hold); “Arganölbasiertes Dry Texture Spray für mühelose Undone-Looks mit langem Halt” (C2, other); “Texturspray mit trockenem Finish für müheloses Volumen und lang anhaltenden Halt” (C2, other); “flexiblen Halt und ein leicht griffiges, trockenes Finish” (C2, other).

**Owner question:** Should Moroccanoil Trockenes Texturspray (Dry Texture Spray) show a hold/fixing secondary for its captured lang anhaltender Halt / flexibler Halt even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) — secondary_jobs: d

`moroccanoil-textur-und-volumenpuder` · `sty-3d056fb98b`. A=["hold_fix","texture"]; B=["texture"]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “Das Moroccanoil Textur- & Volumenpuder sorgt für sofortiges Volumen, hebt die Strähnen an und verbessert jeden Style am Ansatz. Dieser leistungsstarke Puder verleiht Grip und Textur für müheloses Styling, maximales, konzentriertes Volumen und lang anhaltenden, flexiblen Halt.” (C2, promise); “• 48 Stunden lang anhaltender Lift1” (C2, promise); “lang anhaltenden, flexiblen Halt” (C2, hold); “48 Stunden lang anhaltender Lift1” (C2, duration).

**Owner question:** Should Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) show a hold/fixing secondary for its captured lang anhaltenden, flexiblen Halt even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### Moroccanoil Volumizing Spray (Volumizing Mist) — secondary_jobs: d

`moroccanoil-volumizing-spray` · `sty-94246ae5dc`. A=["hold_fix","texture"]; B=["texture"]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “Bringen Sie Leben in feines, stumpfes Haare mit dem Volumizing Spray. Dieser schwerelose, körperbildende Nebel hebt die Haare für einen Look, der bis zu 50% voller ist, während er Bewegung und spürbaren Halt vom Ansatz bis zur Spitze aufrecht erhält. Die Arganöl-infundierte Formel enthält Reis-Aminosäuren, um das Haar zu stärken, sowie Totes Meersalz, um Volumen mit sprungkräftiger Textur aufzubauen. Anhaltendes Volumen bis zu 72 Stunden.” (C2, promise); “spürbaren Halt vom Ansatz bis zur Spitze” (C2, hold); “Anhaltendes Volumen bis zu 72 Stunden.” (C2, duration).

**Owner question:** Should Moroccanoil Volumizing Spray (Volumizing Mist) show a hold/fixing secondary for its captured spürbaren Halt vom Ansatz bis zur Spitze even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### Schwarzkopf taft Haarpuder VOLUMEN — secondary_jobs: d

`schwarzkopf-taft-haarpuder-volumen` · `sty-db908b4e5c`. A=["hold_fix"]; B=[]. **Both readings defensible; no lane declared right.**

A reads an explicit ungraded hold result as hold_fix under the later ANY-C1/C2 expansion. B preserves the strength-word/brand-number eligibility restriction. The text broadens source line types, repeats the graded-hold condition and excludes bare duration, but does not explicitly decide whether ungraded Halt is a result promise. Both readings have a defensible basis; neither is proven wrong.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406); `plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406). Affected section: §6.10 R9-Q1 versus RG3-16 / R4-H(5). Frozen C1/C2 evidence: “Halt für bis zu 24 Stunden” (C2, hold); “Halt für bis zu 24 Stunden” (C2, duration).

**Owner question:** Should Schwarzkopf taft Haarpuder VOLUMEN show a hold/fixing secondary for its captured Halt für bis zu 24 Stunden even though no strength word or brand number is stated? Does this also apply when the same wording is typed finish/other, and when it states a duration?

**Recommendation:** Approve explicit positive hold-result wording from any C1/C2 line as hold_fix when the formula gate passes, irrespective of strength; keep hold_level null without a valid strength claim. Exclude duration-only phrases without a stated hold/result and negated hold. Until the owner settles this distinction, retain the split as unresolved.

**Fix:** After the owner decision, synchronize §6.10/RG3-16, the R4-H(5) exception, property set §2.12 and examples; specify positive ungraded hold versus duration-only wording and rerun every affected product. Do not change the separate hold-level rules.

### Schwarzkopf taft Styling Balm LOCKEN Halt 3 — secondary_jobs: a

`schwarzkopf-taft-styling-balm-locken-halt-3` · `sty-43f9770452`. A=["frizz_control","hold_fix"]; B=["hold_fix","volume"]. **Lane B is right; A is wrong.** Correct value: ["hold_fix","volume"].

The name’s Halt 3 supplies hold_fix before claim lines. R9-Q1 says ANY C1/C2 claim line: C2 Sprungkraft, even typed flexibility, explicitly maps to volume and precedes the Anti-Frizz finish line. PVP r4 passes both hold and volume gates. The two slots are hold_fix, volume; the later frizz candidate has no free slot. The text clearly decides this cell.

Rules: `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406). Frozen C1/C2 evidence: “HALT 3” (C1, hold); “Halt 3” (C2, hold); “Sprungkraft” (C2, flexibility); “definierte Locken, Anti-Frizz-Effekt” (C2, finish).

**Fix:** Correct lane A’s derived secondary jobs to hold_fix, volume; preserve frozen lane files.

## Hold check

**100/100 authoritative hold values agree**; 39 numeric levels emitted and 61 null/null. Raw storage: 100/100 agree. Independent packet-derived claim/scale/suppression oracle: **100/100 correct in both**, 0 failures. Ungraded hold can leave hold_level null regardless of the unresolved hold_fix secondary question.

C1/C2 claim-only scales/words, numbers before words, conflicting strengths median rounded up, then lane-specific profile-emission gate. No number from formula or duration. Strength vocabulary does not decide secondary eligibility.

| Product | A / B | Packet-derived expected A / B | Captured level |
|---|---|---|---|
| ALCINA Ansatz Volumen Spray Aerosol | 3 / 3 | 3 / 3 | 3 |
| ALCINA Föhn Lotion | 1 / 1 | 1 / 1 | 1 |
| ALCINA Styling Mousse Aerosol | 2 / 2 | 2 / 2 | 2 |
| alverde NATURKOSMETIK Beach Waves Spray Seaside Balance | null / null | null / null | null |
| alverde NATURKOSMETIK Locken Refresh-Spray | null / null | null / null | null |
| AUSSIE WORK THAT CURL LEAVE-IN CREAM | null / null | null / null | null |
| Balea Finishing Spray Glow & Care | null / null | null / null | null |
| Balea Föhnlotion Volume Effect | null / null | null / null | null |
| Balea Glattspray Anti-Frizz | null / null | null / null | null |
| Balea Haarpuder Volumen (Pomegranate) | 3 / 3 | 3 / 3 | 3 |
| Balea Haarserum Anti-Frizz Glatt & Glossy | null / null | null / null | null |
| Balea Styling Glow Wax | null / null | null / null | null |
| Balea Styling WAX STICK | null / null | null / null | null |
| Balea Leave-In Spray Sea Salt Care & Define | null / null | null / null | null |
| Balea Locken Crunchgel | null / null | null / null | null |
| Balea Locken Revitalizing Spray | null / null | null / null | null |
| Balea MEN Pomade Haar & Bart 2in1 | 2 / 2 | 2 / 2 | 2 |
| Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray) | null / null | null / null | null |
| Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray | null / null | null / null | null |
| Balea PROFESSIONAL Haarserum Glow & Shine | null / null | null / null | null |
| Balea PROFESSIONAL Styling Cream Traumlocken | 2 / 2 | 2 / 2 | 2 |
| Balea Styling Spray Volumenpuder Pure Styling | 1 / 1 | 1 / 1 | 1 |
| Balea Sea Salt Texture Spray | null / null | null / null | null |
| Balea Styling Creme Power Flex (Forming Cream Power Flex) | null / null | null / null | null |
| Balea Fixierungsbürste Styling Finishing Stick | 1 / 1 | 1 / 1 | 1 |
| Balea Styling Locken Lotion | null / null | null / null | null |
| BALI CURLS HYDRATING CURL CREAM | null / null | null / null | null |
| BALI CURLS Leave-In Spray Curl Defining (Curl Defining Spray) | null / null | null / null | null |
| Bali Curls Sleek Stick Brows & Edges | 3 / 3 | 3 / 3 | 3 |
| BALI CURLS Haargel Strong Hold Flaxseed | 4 / 4 | 4 / 4 | 4 |
| BALI CURLS Volumizing Curl Spray | null / null | null / null | null |
| BALI GENTS VOLUMIZING STYLING POWDER | null / null | null / null | null |
| BALI GENTS Matt Paste | 3 / 3 | 3 / 3 | 3 |
| BALI GENTS Sea Salt Spray | null / null | null / null | null |
| Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel | null / null | null / null | "UNMAPPED" (unmapped; profile blocked) |
| Gard Haarspray extrastark (Pumpspray, ohne Treibgas) | 4 / 4 | 4 / 4 | 4 |
| GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray | null / null | null / null | null |
| got2b Anti-Frizz Lotion Schmusekatze | null / null | null / null | null |
| got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | null / null | null / null | null |
| got2b Schutz-engel Hitzeschutz Spray | null / null | null / null | null |
| got2b Kleber 4 Brows & Edges 2in1 Stylinggel | 3 / 3 | 3 / 3 | 3 |
| got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) | null / null | null / null | null |
| got2b (Schwarzkopf) Styling Mattpaste Strand Matte | 2 / 2 | 2 / 2 | 2 |
| got2b (Schwarzkopf) Styling Paste iStyler Texture Clay | 4 / 4 | 4 / 4 | 4 |
| got2b Styling Puder Volumen Powderfull | null / null | null / null | null |
| got2b Trocken SHAMPOO Extra Volumen | null / null | null / null | null |
| GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) | null / null | null / null | null |
| GUHL LOCKEN PFLEGE & STYLING 3in1 LOCKENCREME, KUR & SPÜLUNG | null / null | null / null | null |
| GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY | null / null | null / null | null |
| John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray | null / null | null / null | null |
| John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | null / null | null / null | null |
| John Frieda Frizz Ease Zauberformel Seiden-Finish Creme | null / null | null / null | null |
| John Frieda Volume Lift Ansatz-Booster | null / null | null / null | null |
| Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) | 3 / 3 | 3 / 3 | 3 |
| Kevin.Murphy Powder.Puff Volume | null / null | null / null | 1 |
| KMS Thermashape 2-in-1 Spray | 4 / 4 | 4 / 4 | 4 |
| KMS Thermashape Straightening Creme | null / null | null / null | null |
| L'Oréal Men Expert Barber Club Styling Pomade Bart & Haar mit ätherischem Zedernholzöl | null / null | null / null | null |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt | 4 / 4 | 4 / 4 | 4 |
| L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt | 3 / 3 | 3 / 3 | 3 |
| Maria Nila Curlicue Cream (Stylingcreme) | 2 / 2 | 2 / 2 | 2 |
| Moroccanoil Anti-Frizz Schild-Spray (Frizz Shield Spray) | null / null | null / null | null |
| Moroccanoil Trockenes Texturspray (Dry Texture Spray) | null / null | null / null | null |
| Moroccanoil Glättende Creme (Smoothing Lotion) | null / null | null / null | null |
| Moroccanoil Root Boost | null / null | null / null | null |
| Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | null / null | null / null | null |
| Moroccanoil Volumizing Spray (Volumizing Mist) | null / null | null / null | null |
| NEQI Diamond Glass Styling Spray All | null / null | null / null | null |
| NEQI Diamond Glass Ultimate Styling Spray | null / null | null / null | null |
| Schwarzkopf Professional OSiS Dust It | 3 / 3 | 3 / 3 | 3 |
| Schwarzkopf Professional OSiS Flatliner | null / null | null / null | 1 |
| Schwarzkopf Professional OSiS Sparkler | 0 / 0 | 0 / 0 | 0 |
| Schwarzkopf Professional OSiS Super Shield | null / null | null / null | 0 |
| Redken One United All-in-One Multi-Benefit Treatment | null / null | null / null | null |
| Redken Wax Spray (Redken Spray Wax) | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY | null / null | null / null | null |
| Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) | 1 / 1 | 1 / 1 | 1 |
| Schwarzkopf taft Haarpuder VOLUMEN | null / null | null / null | null |
| Schwarzkopf taft Haarspray GLANZ Halt 4 | 3 / 3 | 3 / 3 | 3 |
| Schwarzkopf taft Haarspray POWER Halt 5 | 4 / 4 | 4 / 4 | 4 |
| Schwarzkopf Taft Haargel MATT WAX Halt 5 | 4 / 4 | 4 / 4 | 4 |
| Schwarzkopf taft Haargel POWER Halt 5 | 4 / 4 | 4 / 4 | 4 |
| Schwarzkopf taft Styling Balm LOCKEN Halt 3 | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf taft Texturspray Aloe Boost | null / null | null / null | null |
| Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine | null / null | null / null | null |
| syoss Curl Cream Gel | null / null | null / null | null |
| Syoss Glaze Topcoat | null / null | null / null | null |
| syoss Haarspray Max Hold | 4 / 4 | 4 / 4 | 4 |
| Syoss Max Hold Wax | 4 / 4 | 4 / 4 | 4 |
| Syoss Schaumfestiger Volume | 3 / 3 | 3 / 3 | 3 |
| Wella Professionals EIMI Glam Mist Shinespray | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Nutricurls Fresh Up | null / null | null / null | 1 |
| Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) | null / null | null / null | 1 |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray | 3 / 3 | 3 / 3 | 3 |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo) | null / null | null / null | 1 |
| Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm | 1 / 1 | 1 / 1 | 1 |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt | 2 / 2 | 2 / 2 | 2 |

Rules: `docs/research/styling-inci/v1.0/styling-classification-standard.md:841` (§7.2, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:838` (§7.2, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:842` (§7.2, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:850` (§7.3, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:854` (§7.3, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:858` (§7.3, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:867` (§7.4, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:870` (§7.4, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:882` (§7.4, pinned dcaff25e6406); `docs/research/styling-inci/v1.0/styling-classification-standard.md:606` (§4.7, pinned dcaff25e6406). Cantu’s firm hold is unlisted strength vocabulary but its formula conflict suppresses the profile; no speculative translation is used. Kevin.Murphy Powder Puff’s sanfter Halt maps to 1 but is likewise suppressed. Non-Styling raw values remain in diff.json.

## Latent ambiguities and reported concerns — non-blocking

16 lane-A hypothetical alternatives concern products with complete user-facing agreement. These are not added to a/b/c/d disagreement counts. They need no owner answer to score this comparison.

- **ALCINA Styling Mousse Aerosol:** Lane-A note: Matches worked §11.12 (PQ-11 r5 alone -> ambiguous; buildup limb 1 literal, PH2-5). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Balea Finishing Spray Glow & Care:** Lane-A note: frizz_control from humidity line 'effektiven Anti-Frizz Effekt' (explicit anti-frizz word, RG4-17). '... bleibt das Haar glatt und kontrolliert' read as a smooth whole-hair result -> sleek (consistent with 'glattes Finish'/'seidig glattes Haar' readings; gate wax_lipid) — AMBIGUOUS (user-facing; a lane may read it as the anti-frizz result only). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Balea Glattspray Anti-Frizz:** Lane-A note: Cetrimonium Chloride r5 with no fatty alcohol -> no family. finish 'natürlicher Glanz' -> natürlich (PH1-5). Blow-dry and flat iron optional ('Für noch mehr Glätte') -> damp_before_drying. Zone: towel-dried hair 'dabei den Ansatz aussparen' read as lengths — AMBIGUOUS (user-facing; a lane may read all). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Balea Styling Spray Volumenpuder Pure Styling:** Lane-A note: T_S absent: whole list above tail. Alcohol denat. r4 is outside the first 3 -> no note. Secondaries in packet order: hold line 'leichter Halt' (strength word -> hold_fix, gate via particulate) then other line 'griffige Textur direkt am Ansatz' -> texture (R9-Q1 worked example). AMBIGUOUS (user-facing): the R9-Q1 worked example names only texture; whether the typed hold line also yields hold_fix (RG-12/RG3-16) changes secondary_jobs. Zone roots (required site Ansatz; lengths optional, R6-T(1)). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Balea Fixierungsbürste Styling Finishing Stick:** Lane-A note: Weight medium via Hydroxypropyl Guar HPTC r7 (family e); buildup limb 1. Primary frizz_control from 'fixiert Babyhaare und Frizz' (taming flyaways); AMBIGUOUS (user-facing): 'fixiert' could be read as the job-bearing fixing verb -> hold_fix primary. 'perfektes Finish' names no finish grade. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Bali Curls Sleek Stick Brows & Edges:** Lane-A note: Acrylates Crosspolymer-3 r2 is FX-U (PVP r3 keeps hold present). Primary sleek from the one-job name; AMBIGUOUS (user-facing): a lane reading 'Sleek' as edge look rather than a whole-style sleek job may take the C2 lead 'Präziser Halt' -> hold_fix primary. Secondaries: 'Präziser Halt ... in Form' -> hold_fix, 'Babyhaare' -> frizz_control. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **got2b (Schwarzkopf) Styling Mattpaste Strand Matte:** Lane-A note: Structuring waxes WL-1/WL-2 (rich members) + IPM -> rich; buildup limb 2. Petrolatum is not in the oils flag. 'Surfer-Styles' / 'Strand' read as no explicit texture job (AMBIGUOUS, user-facing: a lane could read 'Strand'/'Surfer' as the beach texture look). Directions: paste in palms, zerzausen/zwirbeln on dry hair first-named -> dry_restyle, also damp. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **John Frieda Frizz Ease Zauberformel Seiden-Finish Creme:** Lane-A note: Weight rich: families a (Avocado r3 rich, esters) + d (Phenyl Trimethicone r4). AMBIGUOUS (user-facing primary): if 'Seiden-Finish' is not read as a one-job name, the lead is C2 'Glättet abstehende Haare, ...' -> primary frizz_control, secondary shine. Directions: cream rubbed in palms and distributed in dry hair (RG3-7) -> dry_restyle; 'besonders auf abstehende Härchen' is an emphasis inside a whole-hair instruction -> all. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **KMS Thermashape Straightening Creme:** Lane-A note: Matches worked §11.17. hold_fix secondary from C2 'Formt das Haar mit Hitze-Tools zu gewünschten Styles' (shaping wording -> hold_fix, gate via fixative_film) — AMBIGUOUS (user-facing; R9-Q1 reading). heat_activated yes from C2 'WÄRME-AKTIVIERUNG'. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt:** Lane-A note: T_S Hydroxycitronellal r4 = allergen above Parfum r28 -> unresolved; R2 marker Benzyl Alcohol r12 (PR-1 above Parfum); both readings give the same F values. flexibility from 'Stylen, Ausbürsten, wieder Stylen'. finish from C2 'mehr Glanz' (glänzend). volume secondary from C2 finish-typed line 'natürlichen Haarschwung' (Schwung -> volume, R9-Q1) — AMBIGUOUS (user-facing secondary). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Moroccanoil Anti-Frizz Schild-Spray (Frizz Shield Spray):** Lane-A note: Heat-activated smoothing film present (Polysilicone-29 r3, Silicone Quaternium-18 r4; C2 'hitzeaktivierte Spray') but R6-Q1 limb 2 needs care only at/after the first preservative; argan oil r5 sits above it. AMBIGUOUS (user-facing route) only if a lane counts argan as part of the film system. No Styling values. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Moroccanoil Root Boost:** Lane-A note: PQ-7 r12 below T_S would add family e + buildup limb 1 -> candidate_below_tail. 'starke Textur' -> texture secondary; 'kontrolliert statische Aufladung' not read as frizz_control (AMBIGUOUS, user-facing second secondary). finish 'natürlich aussehendes Finish' -> natürlich. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **NEQI Diamond Glass Ultimate Styling Spray:** Lane-A note: Primary null per R7-F (promise lines: styling + heat protection + heat-activated polymers + water repellence + shorter drying, no vocabulary job). Secondaries from the C2 finish line 'glänzend (Glass-Hair-Effekt, spiegelglatt, ultimativer Glanz)' under R9-Q1: sleek (spiegelglatt, matches subtype, R9-Q2) and shine; frizz_control ('Starker Anti-Frizz-Effekt', other line) is a third candidate, not taken. Order sleek/shine is AMBIGUOUS (calculation-only unless order is user-facing). heat_activated yes from C2 'hitzeaktivierte Polymere'. Silicone Quaternium-18 r11 below T_S would fire buildup limb 1 -> candidate_below_tail. finish glänzend from typed C2 finish line. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Schwarzkopf Professional OSiS Flatliner:** Lane-A note: AMBIGUOUS (user-facing route): if 'Flatliner' were read as a one-job sleek name, the lead would be sleek (li_function yes) -> 3.4(iii) -> D6 fails on Polyglyceryl-3 Betainate Acetate r2 (CA-1 care) -> leave_in; not Styling under either reading. No Styling values. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Schwarzkopf Professional OSiS Sparkler:** Lane-A note: frizz_control from C2 (pdf) 'Es reduziert Frizz und entwirrt'. Directions: spray on dry hair, 'Die Haare nach Bedarf stylen' read as a named shaping act -> dry_restyle (RG2-8); AMBIGUOUS (user-facing): optional styling could be read as spray-only -> dry_finish. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **wellaflex Schaumfestiger Locken & Wellen, Starker Halt:** Lane-A note: hold_fix = name product noun Schaumfestiger (name job words first, RG4-17/RG3-16). volume from C1 line 'Locken mit Sprungkraft' (typed flexibility) under R9-Q1 'any C1/C2 claim line' — AMBIGUOUS (user-facing): a lane limiting R9-Q1 to promise/finish/other types would leave only hold_fix. PQ-16 r10 below T_S would add a cationic-polymer family + buildup limb 1 -> candidate_below_tail. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.

- **Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray) (lane B):** Additional emollients below the capped marker can be described as continuing the core base or as tail extras. These records use the core-continuation reading for marker status. Their routes and absence of Styling profiles are unchanged. Agreed values or calculation-log ordering; does not independently create a blocker.
- **GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY (lane B):** Additional emollients below the capped marker can be described as continuing the core base or as tail extras. These records use the core-continuation reading for marker status. Their routes and absence of Styling profiles are unchanged. Agreed values or calculation-log ordering; does not independently create a blocker.
- **NEQI Diamond Glass Ultimate Styling Spray (lane B):** Ultimate has no primary vocabulary job. Its typed finish gives shine followed by parenthetical smooth wording. Explicit secondary text order is used: shine, sleek. Subtype-first adjective ordering would reverse the same supported members. Agreed values or calculation-log ordering; does not independently create a blocker.
- **Balea Styling Spray Volumenpuder Pure Styling (lane B):** The worked sentence mentions texture without enumerating the earlier eligible lighter-hold claim. The explicit general order and formula gate give hold_fix, texture; the example is interpreted as abbreviated. Agreed values or calculation-log ordering; does not independently create a blocker.

Balea’s abbreviated R9 worked example names texture but does not explicitly ban the earlier graded hold secondary; both select hold_fix + texture under the general order. NEQI Ultimate’s same shine/sleek set has different storage order only; the inherited set normalization keeps that separate. Neither concern resolves or conceals an actual selected-member split.

## User-facing agreement

| Field | Agree / all | Disagree | Agreement |
|---|---|---|---|
| route | 100/100 | 0 | 100% |
| subtype | 100/100 | 0 | 100% |
| hold_level | 100/100 | 0 | 100% |
| weight | 100/100 | 0 | 100% |
| finish | 100/100 | 0 | 100% |
| flexibility | 100/100 | 0 | 100% |
| target_zone | 100/100 | 0 | 100% |
| application_moment | 100/100 | 0 | 100% |
| primary_job | 100/100 | 0 | 100% |
| secondary_jobs | 91/100 | 9 | 91% |
| provides_heat_protection | 100/100 | 0 | 100% |
| heat_activated | 100/100 | 0 | 100% |
| alcohol_note | 100/100 | 0 | 100% |
| buildup_note | 100/100 | 0 | 100% |
| neutral_fact | 100/100 | 0 | 100% |

### Products fully agreeing

- ALCINA Ansatz Volumen Spray Aerosol (`alcina-ansatz-volumen-spray-aerosol`).
- ALCINA Föhn Lotion (`alcina-foehn-lotion`).
- ALCINA Styling Mousse Aerosol (`alcina-styling-mousse-aerosol`).
- alverde NATURKOSMETIK Beach Waves Spray Seaside Balance (`alverde-beach-waves-spray-seaside-balance`).
- alverde NATURKOSMETIK Locken Refresh-Spray (`alverde-locken-refresh-spray`).
- AUSSIE WORK THAT CURL LEAVE-IN CREAM (`aussie-leave-in-creme-work-that-curl`).
- Balea Finishing Spray Glow & Care (`balea-finishing-spray-glow-und-care`).
- Balea Föhnlotion Volume Effect (`balea-foehnlotion-volume-effect`).
- Balea Glattspray Anti-Frizz (`balea-glattspray-anti-frizz`).
- Balea Haarpuder Volumen (Pomegranate) (`balea-haarpuder-volumen-pomegranate`).
- Balea Haarserum Anti-Frizz Glatt & Glossy (`balea-haarserum-anti-frizz-glatt-und-glossy`).
- Balea Styling Glow Wax (`balea-haarwachs-glow-wax`).
- Balea Styling WAX STICK (`balea-haarwachs-styling-stick`).
- Balea Leave-In Spray Sea Salt Care & Define (`balea-leave-in-spray-sea-salt-care-define`).
- Balea Locken Crunchgel (`balea-locken-crunchgel`).
- Balea Locken Revitalizing Spray (`balea-locken-revitalizing-spray`).
- Balea MEN Pomade Haar & Bart 2in1 (`balea-men-pomade-haar-bart-2in1`).
- Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray) (`balea-professional-definier-spray-traumlocken`).
- Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray (`balea-professional-glow-und-shine-finishing-spray`).
- Balea PROFESSIONAL Haarserum Glow & Shine (`balea-professional-haarserum-glow-und-shine`).
- Balea PROFESSIONAL Styling Cream Traumlocken (`balea-professional-styling-cream-traumlocken`).
- Balea Styling Spray Volumenpuder Pure Styling (`balea-pure-styling-volumenpuder-spray`).
- Balea Styling Creme Power Flex (Forming Cream Power Flex) (`balea-styling-creme-power-flex`).
- Balea Fixierungsbürste Styling Finishing Stick (`balea-styling-finishing-stick`).
- Balea Styling Locken Lotion (`balea-styling-locken-lotion`).
- BALI CURLS HYDRATING CURL CREAM (`bali-curls-hydrating-curl-cream`).
- BALI CURLS Leave-In Spray Curl Defining (Curl Defining Spray) (`bali-curls-leave-in-spray-curl-defining`).
- Bali Curls Sleek Stick Brows & Edges (`bali-curls-sleek-stick-brows-and-edges`).
- BALI CURLS Haargel Strong Hold Flaxseed (`bali-curls-strong-hold-flaxseed-gel`).
- BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`).
- BALI GENTS Matt Paste (`bali-gents-matt-paste`).
- BALI GENTS Sea Salt Spray (`bali-gents-sea-salt-spray`).
- Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel (`cantu-shea-butter-extra-hold-edge-stay-gel`).
- Gard Haarspray extrastark (Pumpspray, ohne Treibgas) (`gard-haarspray-extrastark-pumpspray`).
- GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray (`garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`).
- got2b Anti-Frizz Lotion Schmusekatze (`got2b-anti-frizz-lotion-schmusekatze`).
- got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) (`got2b-gotgloss-glanz-spray`).
- got2b Schutz-engel Hitzeschutz Spray (`got2b-hitzeschutzspray-schutzengel`).
- got2b Kleber 4 Brows & Edges 2in1 Stylinggel (`got2b-kleber-4-brows-and-edges-2in1-stylinggel`).
- got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) (`got2b-lockenspray-refresher-curlz`).
- got2b (Schwarzkopf) Styling Mattpaste Strand Matte (`got2b-styling-mattpaste-strand-matte`).
- got2b (Schwarzkopf) Styling Paste iStyler Texture Clay (`got2b-styling-paste-istyler-texture-clay`).
- got2b Trocken SHAMPOO Extra Volumen (`got2b-trockenshampoo-extra-volumen`).
- GUHL LOCKEN PFLEGE & STYLING 3in1 LOCKENCREME, KUR & SPÜLUNG (`guhl-locken-pflege-und-styling-3in1`).
- GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY (`guhl-styling-spray-locken-pflege-und-styling-2in1`).
- John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray (`john-frieda-frizz-ease-3-tage-glatt-styling-spray`).
- John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray (`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray`).
- John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`).
- John Frieda Volume Lift Ansatz-Booster (`john-frieda-volume-lift-ansatz-booster`).
- Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`).
- Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`).
- KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`).
- KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`).
- L'Oréal Men Expert Barber Club Styling Pomade Bart & Haar mit ätherischem Zedernholzöl (`loreal-men-expert-barber-club-styling-pomade`).
- L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt (`loreal-paris-elnett-haarspray-extra-starker-halt`).
- L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`).
- Maria Nila Curlicue Cream (Stylingcreme) (`maria-nila-curlicue-cream`).
- Moroccanoil Anti-Frizz Schild-Spray (Frizz Shield Spray) (`moroccanoil-anti-frizz-schild-spray`).
- Moroccanoil Glättende Creme (Smoothing Lotion) (`moroccanoil-glaettende-creme-smoothing-lotion`).
- Moroccanoil Root Boost (`moroccanoil-root-boost`).
- NEQI Diamond Glass Styling Spray All (`neqi-diamond-glass-styling-spray-all`).
- NEQI Diamond Glass Ultimate Styling Spray (`neqi-diamond-glass-ultimate-styling-spray`).
- Schwarzkopf Professional OSiS Dust It (`osis-dust-it`).
- Schwarzkopf Professional OSiS Flatliner (`osis-flatliner`).
- Schwarzkopf Professional OSiS Sparkler (`osis-sparkler`).
- Schwarzkopf Professional OSiS Super Shield (`osis-super-shield`).
- Redken One United All-in-One Multi-Benefit Treatment (`redken-one-united-all-in-one-multi-benefit-treatment`).
- Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`).
- Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY (`schwarzkopf-professional-osis-curl-retouch`).
- Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 (`schwarzkopf-taft-foehn-spray-volumen-halt-3`).
- Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`).
- Schwarzkopf taft Haarspray GLANZ Halt 4 (`schwarzkopf-taft-haarspray-glanz-halt-4`).
- Schwarzkopf taft Haarspray POWER Halt 5 (`schwarzkopf-taft-haarspray-power-halt-5`).
- Schwarzkopf Taft Haargel MATT WAX Halt 5 (`schwarzkopf-taft-matt-wax-halt-5`).
- Schwarzkopf taft Haargel POWER Halt 5 (`schwarzkopf-taft-power-haargel-halt-5`).
- Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`).
- Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine (`schwarzkopf-taft-x-gliss-silky-shine-shine-coat`).
- syoss Curl Cream Gel (`syoss-curl-cream-gel-3in1`).
- Syoss Glaze Topcoat (`syoss-glaze-topcoat`).
- syoss Haarspray Max Hold (`syoss-haarspray-max-hold`).
- Syoss Max Hold Wax (`syoss-professional-performance-max-hold-power-wax`).
- Syoss Schaumfestiger Volume (`syoss-schaumfestiger-volume`).
- Wella Professionals EIMI Glam Mist Shinespray (`wella-eimi-glam-mist-shine-spray`).
- Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) (`wella-eimi-nutricurls-curl-shaper`).
- Wella Professionals EIMI Nutricurls Fresh Up (`wella-eimi-nutricurls-fresh-up`).
- Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) (`wella-eimi-smooth-thermal-image`).
- Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`).
- Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) (`wella-eimi-texture-ocean-spritz`).
- Wella Professionals EIMI Volume Dry Me (Trockenshampoo) (`wella-eimi-volume-dry-me`).
- Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm (`wella-professionals-eimi-flowing-form`).
- wellaflex Schaumfestiger Locken & Wellen, Starker Halt (`wellaflex-schaumfestiger-locken-und-wellen-starker-halt`).

## Normalization and calculation log

- route is compared as {destination,state,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.
- application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not research-trace wrappers.
- buildup/alcohol notes: false, {fired:false}, not_fired and does_not_fire -> does_not_fire; true, {fired:true}, fired and fires -> fires. null remains null.
- Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.
- neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.
- Empty secondary_jobs/d8b_flags and null are equivalent only without a Styling profile (§4.7). Optional non-Styling observations are excluded only with explicit informational_and_non_authoritative:true, at record level or in notes. Route and subtype remain scoreable; held profiles are never masked. Raw values and each exclusion remain in the normalization audit.
- confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.

Calculation log: 1051/1800 cells agree; 749 differences, none blocking. Raw/normalized user fields, all exclusions, log differences and secondary storage-order differences are retained in diff.json. No held profile is masked.

## Lock predicate

| Criterion | Result |
|---|---|
| Every user-facing A/B disagreement is a proven lane error against a clear rule | FAIL |
| No unresolved user-facing rule gaps (b), packet issues (c), or owner questions (d) | FAIL |

**FAIL: 8 unresolved user-facing disagreement cells (1 rule gaps, 0 packet issues, 7 owner questions); clear lane errors and calculation-log differences do not block.**

- Known-product targeted MINI r10, not new unseen validation or a full 143-product revalidation.
- R8-Q1 Big Hair Day and Redken Powder Grip are absent; no two-lane regression pass is inferred for absent records.
- Agreement and passing named effects do not resolve ambiguous ungraded-hold eligibility. Both-defensible readings are d/b, never fabricated lane errors.
- Reported hypothetical alternatives on agreed values are separate non-blocking observations under the requested lock comparison.
- Older lexicons are pinned and fingerprinted as provenance; v0.5 and the governing ledger are the current authority.
- No frozen inputs corrected, no lock reinstated, no commit, no catalog or production action.

## Pinned governing quotations

`plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned dcaff25e6406)

> | R9-Q1 | **Secondary jobs may come from ANY C1/C2 claim line — promise, finish or other-typed — for every product** (owner); pure feel lines without a result („fühlt sich weich an") never count. Replaces the Puder-only „R9 clarification" written by Claude after round 9 without a ruling (flagged by the independent review) and widens RG2-16/RG4-17 accordingly. E.g. Balea Volumenpuder Pure Styling „griffige Textur direkt am Ansatz" ⇒ texture secondary. |

`plans/styling-concept/02-rulings.md:165` (R9-Q2, pinned dcaff25e6406)

> | R9-Q2 | **When several result adjectives stand together, the one matching the named look or subtype leads; otherwise the first** (owner). NEQI Diamond Glass All („intensiv glänzenden, glatten ‚Glass Hair'-Effekt", heat-activated smoothing styler) ⇒ primary `sleek`, secondary `shine`. Vocabulary note: `sleek` = smooth/straight overall look (shape); `shine` = gloss (surface). |

`plans/styling-concept/02-rulings.md:166` (R9-F, pinned dcaff25e6406)

> | R9-F | **got2b gotGloss Glanz Spray: capture gap fixed** — got2b.de (C2) states „Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle." (verified 2026-10-14); the line was missing from the claims packet ⇒ add as C2 promise ⇒ `frizz_control` secondary. Round 8's „lane error" on this cell was a packet issue (c). |

`plans/styling-concept/02-rulings.md:167` (R9-P, pinned dcaff25e6406)

> | R9-P | **Process fix (Claude, from the independent review):** scoring scripts quote rule text verbatim and broke on every doc edit (H1). From now on each scorer pins the exact doc/ledger git revision it scores against and reads quotes from that revision, so past rounds stay reproducible. round-8's PASS is annotated: its Big Hair Day (13) and Balea MEN Powder (2) cells were owner questions (d), later settled by R8-Q1/R8-Q2. |

`plans/styling-concept/02-rulings.md:161` (R8-Q1, pinned dcaff25e6406)

> | R8-Q1 | **L'Oréal Elvital Big Hair Day „Erfrischendes Volumen Spray" ⇒ Dry Shampoo (volume direction)** (owner, after an INCI comparison with the catalog's dry shampoos: same build — propellant + alcohol + oil-absorbing powders near the top (Cellulose r3, Perlite r4), no hold polymer, applied to dry roots; closest to got2b Trockenshampoo Extra Volumen; C1 „Bis zu 48h frischeres Haargefühl"). Reading: a refresh-between-washes promise in the Dry Shampoo sense next to volume is the refresh + volume tie (§4.2 tie precedence) even when the name leads with volume. The Claude-side check of round-8 reclassified this split from „lane error" to an owner question. |

`plans/styling-concept/02-rulings.md:162` (R8-Q2, pinned dcaff25e6406)

> | R8-Q2 | **The product noun „Puder"/„Powder" names the `volume` job** (owner, after a cohort check: all 10 hair powders promise volume, 7 also texture/grip, almost always alongside volume). Texture/grip counts as a secondary job where a C1/C2 line promises it; a name that itself names grip (Redken „Powder Grip") is a two-job name and falls to its lead line. Other product nouns keep their §4.2/R4-Q7 mapping. |

`plans/styling-concept/02-rulings.md:163` (R8-H, pinned dcaff25e6406)

> | R8-H | **Moroccanoil Glättende Creme: R7-Q2 governs over the stale §4.2 mixed example** — „Definition" for „krauses Haar" with a separate „Ideal für lockiges Haar" is not a curl-definition promise ⇒ not care + definition ⇒ the border rules route it (Leave-in); the stale example is removed (Claude housekeeping from R7-Q2). |

`plans/styling-concept/02-rulings.md:140` (R4-H, pinned dcaff25e6406)

> | R4-H | **Housekeeping for v0.5 §13.4 (Claude, from the rulings' own logic; all calculation-log or already-ruled):** (1) no opaque `registry_row` pointer is added — registry rows are matched by brand + pack name (R4-Q6); (2) the Taft Gel Wax D8b flag is internal only (R4-L) and follows §7.5 as written; (3) where a promise line has no recorded position, §4.2 step 2 reads packet order; (4) Bumble and bumble „brilliantine" is a one-job C1 name under R4-Q1 (shine) — consistent with its registry row; (5) typed hold lines are secondary-job candidates only through the §6.10 hold_fix rule (RG3-16). The Leave-in addendum draft (v1.2) is updated after lock for R4-Q4 and the §4.1(d) rows. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:773` (§6.10, pinned dcaff25e6406)

> | Decision | Structured judgment: primary = the job the C1/C2 lead promise (§4.2 order) states; secondaries = up to two further jobs the C1/C2 claims state explicitly. **Primary `[RG-11]`:** the first **job-bearing** phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to `hold_fix`. **A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead's subject („Intensiver Halt für …", „Starker Halt –") the lead states `hold_fix` `[RG2-4]`** (`syoss-professional-performance-max-hold-power-wax`: „Intensiver Halt für glatte und glänzende … Looks" ⇒ `hold_fix`). **A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states `definition`; shaping without a curl/wave noun stays `hold_fix` `[RG2-5]`** (`syoss-curl-cream-gel-3in1` „Locken zu formen und zu definieren" ⇒ `definition`). **Job vocabulary `[RG2-6, RG2-7; R6-T (3)]`:** Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`; **an adjective before a job phrase is not a separate job `[R7-Q1]`** (Wellaflex „für schwungvolle, definierte Locken“ ⇒ primary `definition`). (Elastizität is a flexibility word, §6.9, never a job); taming or smoothing flyaways, „abstehende Haare/Härchen" or „Babyhaare" ⇒ `frizz_control`; `sleek` only for a smooth or straight result of the whole style („glatte Looks", „Sleek-Look") (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` „Glättet abstehende Haare" ⇒ `frizz_control`). **Definition `[R6-T (3), R7-Q2]`: a curl/wave word in the product's own confirmed name supplies `definition` (with §4.2's Beach Waves texture and curl-revival refresh exceptions); in descriptive sentences an explicit promise to define or shape curls/waves is required. „Definition“/„Define“ for a non-curl look and a result phrase such as „definierter Look“ never supply `definition`** (`alverde-beach-waves-spray-seaside-balance`: no definition secondary). **Secondaries `[RG-12; RG2-16, ruled „open" by R2-T]`:** any job word of this vocabulary stated in any C1/C2 claim line, including `promise`, `finish` and `other` — including the RG-12 mappings: a C1/C2 hold claim with a strength word ⇒ `hold_fix`; an anti-frizz/flyaway word ⇒ `frizz_control`; a shine word ⇒ `shine`; an explicit curl/wave definition promise ⇒ `definition` — and also volume, texture, sleek and refresh words; taken in claim order, at most two, after the primary; pure feel-only lines, ingredient callouts and bare duration wording without a result never state a job. **Masked or numeric hold claims and name job words `[RG3-16]`:** a hold claim with a strength word **or a brand number** states `hold_fix` — a masked strength in the blind packet („[CLAIM] Halt") or a bare Haltegrad still states the job, because the mask hides the grade, not the job; **job words of the confirmed name count as secondaries** after the primary, in name order, **before** the claim lines (still at most two). **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review. **Order, gate and refill `[RG4-17]`** (closes RG2-16's „open"): list the eligible candidates in order — the confirmed name's job words first (after the primary, in name order), then any C1/C2 claim line (including `promise`, `finish` and `other`) in packet order, each line's job words in text order — and take the first two; apply the formula gate; when the gate drops one, **refill from the next eligible candidate** (still at most two). **Humidity and bare duration wording with no result never state a job; an explicit anti-frizz word in them does** („Schutz vor Frizz & Feuchtigkeit" ⇒ `frizz_control`; „hält bis zu 72 h" ⇒ none). **A fixing verb without a strength word** („fixiert die Frisur zuverlässig") **states `hold_fix` as a secondary and sets no level `[RG4-12]`** (`balea-overnight-wellenspray`). **A technology, formula or complex label is never a job `[RG4-10]`** („POWER-SHINE-TECHNOLOGIE" states no `shine`). **Brand line / collection names never supply any job `[R7-Q3]`** (Frizz Ease, Traumlocken, Volume Lift, Diamond Sleek, Glow & Shine, Nutricurls …); the product's own name words decide (§4.2). **Names `[R4-Q2, R4-Q7, R7-Q2, R8-Q2]`:** Puder/Powder states `volume`. **R9-Q1:** For every product, any explicit job/result promise from any C1/C2 claim line, including `promise`, `finish` and `other`, supplies a secondary subject to the usual order and formula gate; a pure feel-only line with no result never does. Redken „Powder Grip“ is a two-job name (volume + texture) and the lead line decides primary. Other product-noun mappings stay unchanged: „Glaze", „Topcoat", „Gloss" state `shine`; „Beach Waves" / „Strandwellen" / „beachy" state `texture`; a molding/hold product noun (Wachs/Wax, Paste, Clay, Gel, Pomade, Fiber, Haarspray) states `hold_fix` and its shine or strength qualifier states no second job; a true word for a different job beside it (Texture, Volume, Curl; Grip beside Powder) makes a two-job name (`got2b-styling-paste-istyler-texture-clay`: primary `hold_fix` from the lead C2 line, secondary `texture` from the name) |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:774` (§6.10, pinned dcaff25e6406)

> | Worked example (R9-Q1) | Balea Styling Spray Volumenpuder Pure Styling ⇒ primary `volume`, secondary `texture`: the C1/C2 line „griffige Textur direkt am Ansatz“, typed `other` in the claims packet, promises a texture result and therefore counts. |

`plans/styling-concept/02-rulings.md:113` (R3-L, pinned dcaff25e6406)

> | R3-L | **Lock criterion „lanes agree" (PH1-11) means resolved, not identical.** Styling v1.0 may lock when every remaining A/B disagreement is resolved — either a lane error proven against a clear rule, or the rule gap behind it closed — **and** a final confirmation round shows only lane errors and no new rule gaps. Literal identity of both lanes on every value is not required. |

`plans/styling-concept/02-rulings.md:131` (R4-L, pinned dcaff25e6406)

> | R4-L | **Lock scope under R3-L: only differences in user-facing fields block the lock** — route/recommendability (incl. held vs committed, evidence gate), subtype, hold level, weight, finish, flexibility, target zone, application moment, primary and secondary jobs, heat protection, user-shown notes. Differences confined to the **calculation log** (reason code, rule path, internal review triggers, confidence, internal flags, lexicon placements that move no value) do not block: they are fixed in the text and documented, without a further round. Example: Bali Curls Sleek Stick — both lanes agree on every user field; only reason code and rule path differ. |

## Reproduction

Run `node data/research/styling-inci/v1.0/round-10/diff.js --summary` twice at the same HEAD and unchanged inputs. Compare SHA-256 of diff.json and report.md. Later replay: add `--rules-revision=dcaff25e6406783b6853ecdd3b942303b8362157`. Only the sibling diff.json/report.md are written; no timestamps/randomness/absolute paths. Script/input hashes and every quoted source revision are recorded.

diff.json SHA-256: `f7ba86f444f78d5910aa78342aa6a70767882e688630c3dc9fdbe1133f096b82`.
