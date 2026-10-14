# Chaarlie Styling — MINI re-check r12

**1331/1335 user-facing cells agree (99.7%); 85/89 products fully agree. Lock: FAIL.**

a/b/c/d = **1 / 2 / 0 / 1**. 3 unresolved user-facing cells (2 rule-gap, 0 packet-issue, 1 owner-question); proven lane errors and calculation log never block.

A = Claude Opus; B = Codex, with no preference for B. Task/cohort specifies 89 products; the phrase 16 records is stale. The explicit list contains 15 comparison columns. Route is composite (destination, held/committed state, boundary reason), so all requested user-facing dimensions remain visible. All 89 products are scored; application_moment is primary only.

Rules pinned to **`0fab88de2b6de599589a0d63967320b9480154c2`**, the scoring-time HEAD (R9-P). 89/143 screened products selected; cohort/id-map/scope/packet binding verified and 270 frozen artifact hashes checked. Exact inclusion reasons are retained in diff.json.

Styling/held profiles alone: 911/915 cells agree (99.56%), 57/61 products. Non-Styling/null values remain in the full-cohort denominator above.

## Ruling effects

| Ruling | Real product | Expected | A | B | A / B landed |
|---|---|---|---|---|---|
| R11-Q1 | Balea PROFESSIONAL Styling Cream Traumlocken | {"volume_secondary":false} | {"secondary_jobs":["frizz_control","hold_fix"]} | {"secondary_jobs":["frizz_control","shine"]} | yes / yes |
| R11-Q1 | Schwarzkopf taft Styling Balm LOCKEN Halt 3 | {"volume_secondary":false} | {"secondary_jobs":["frizz_control","hold_fix"]} | {"secondary_jobs":["frizz_control","hold_fix"]} | yes / yes |
| R11-Q2 | Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | {"primary_job":"definition","secondary_jobs":["frizz_control","hold_fix"]} | {"primary_job":"definition","secondary_jobs":["frizz_control","hold_fix"]} | {"primary_job":"definition","secondary_jobs":["frizz_control","hold_fix"]} | yes / yes |
| R11-Q2 | syoss Curl Cream Gel | {"primary_job":"definition","secondary_jobs":[]} | {"primary_job":"definition","secondary_jobs":[]} | {"primary_job":"definition","secondary_jobs":[]} | yes / yes |
| R8-Q1 | L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | yes / yes |
| R8-H | Moroccanoil Glättende Creme (Smoothing Lotion) | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | yes / yes |
| R9-F | got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | {"required_secondary":"frizz_control"} | {"secondary_jobs":["frizz_control"]} | {"secondary_jobs":["frizz_control"]} | yes / yes |
| R8-Q2 | Balea Styling Spray Volumenpuder Pure Styling | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Redken Powder Grip | "Named two-job exception is absent from r12; no fresh regression pass is claimed." | N/A | N/A | not in cohort |

**R11-Q1 — Balea PROFESSIONAL Styling Cream Traumlocken:** Curl-quality volume is WEAK; no volume should displace compatible STRONG jobs. Other secondary membership remains unresolved; this is only the volume-strength effect. Rules: `plans/styling-concept/02-rulings.md:170` (R11-Q1, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:802` (§6.10, pinned 0fab88de2b6d).

**R11-Q1 — Schwarzkopf taft Styling Balm LOCKEN Halt 3:** Curl-quality Sprungkraft is WEAK; hold and frizz fill the two stronger secondary slots. Rules: `plans/styling-concept/02-rulings.md:170` (R11-Q1, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:802` (§6.10, pinned 0fab88de2b6d).

**R11-Q2 — Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream):** Curl Shaper (Defining Gel Cream) names one definition job; forms add no name hold job. Explicit frizz and numbered hold still supply secondaries. Rules: `plans/styling-concept/02-rulings.md:171` (R11-Q2, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:478` (§4.2, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:804` (§6.10, pinned 0fab88de2b6d).

**R11-Q2 — syoss Curl Cream Gel:** Curl Cream Gel names definition once; form words add no hold secondary and duration is not a hold promise. Rules: `plans/styling-concept/02-rulings.md:171` (R11-Q2, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:478` (§4.2, pinned 0fab88de2b6d).

**R8-Q1 — L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray):** Freshness between washes beside volume gives Dry Shampoo with a volume direction. Rules: `plans/styling-concept/02-rulings.md:161` (R8-Q1, pinned 0fab88de2b6d).

**R8-H — Moroccanoil Glättende Creme (Smoothing Lotion):** Generic definition of krauses Haar with separate curl suitability is not curl definition; not mixed, then border rules give Leave-in. Rules: `plans/styling-concept/02-rulings.md:163` (R8-H, pinned 0fab88de2b6d).

**R9-F — got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray):** Required result is an eligible, supported secondary; other eligible members may occupy the remaining slot. Rules: `plans/styling-concept/02-rulings.md:166` (R9-F, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:794` (§6.10, pinned 0fab88de2b6d).

**R8-Q2 — Balea Styling Spray Volumenpuder Pure Styling:** Own confirmed powder name contributes volume; a true second job in its name falls to its own lead. Check promised texture from this product, never borrow it from other powders. Rules: `plans/styling-concept/02-rulings.md:162` (R8-Q2, pinned 0fab88de2b6d); `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned 0fab88de2b6d); `plans/styling-concept/02-rulings.md:168` (R10-Q1, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:804` (§6.10, pinned 0fab88de2b6d).

R8-H explicitly checks the not-mixed, border-rule Leave-in outcome. R8-Q2 checks every powder actually in r12; Redken Powder Grip and other absent powders are N/A, not fresh regression passes. R11-Q1 checks weak curl-quality volume exclusion; R11-Q2 checks one definition primary and absence of form-derived hold.

### Full ruling reach

| Scope screen | Products | Primary agree | Secondary agree | a / b / c / d cells |
|---|---|---|---|---|
| R11-Q1 | 23 | 23/23 | 20/23 | 1 / 2 / 0 / 0 |
| R11-Q2 | 85 | 85/85 | 81/85 | 1 / 2 / 0 / 1 |

Screens overlap and include conservative false positives, non-Styling and blocked records. Inclusion is not a classification oracle.

## Every user-facing disagreement

a = proven clear-rule lane error; b = operational wording gap, with section and fix; c = packet issue; d = unsettled owner choice. Both-defensible readings are b/d. Counts are field cells, and secondary arrays are unordered sets.

### Balea Finishing Spray Glow & Care — secondary_jobs: d

`balea-finishing-spray-glow-und-care` · `sty-8560f07b6f`. A=["frizz_control","sleek"]; B=["frizz_control"]. **Both readings defensible; neither lane is declared right.**

The C2 humidity line promises Anti-Frizz Effekt and says “bleibt das Haar auch bei hoher Luftfeuchtigkeit glatt und kontrolliert”. A treats Haar … glatt as a WEAK whole-style smooth result; B retains only the anti-frizz job. R9-Q1 and step 1 admit result words from humidity lines, so the typed field cannot exclude sleek. But vocabulary restricts sleek to “a smooth or straight result of the whole style”; the line does not explicitly distinguish maintained flyaway/frizz smoothness from overall shape. A has a basis in the whole-hair subject, B in the anti-frizz context and the whole-style restriction. No rule clearly separates those readings. The free slot and wax_lipid r6 would permit sleek if admitted.

Affected section: §6.10 steps 1, 2 and 4; property set §2.12.

Exact governing text:

`docs/research/styling-inci/v1.0/styling-classification-standard.md:801` (§6.10, pinned 0fab88de2b6d)

> 1. **Collect every job signal.** Read the confirmed product's own name (apply standard §4.2 step 1 / R11-Q2: a form inside a job-bearing compound supplies no second name job), then **all C1/C2 claim lines** in packet order and each line in text order: `promise`, `finish`, `other`, `hold`, `flexibility`, `humidity`, `duration` and every other captured type are eligible. A field's type does not hide a job word: „Sprungkraft“ in a `flexibility` line is a `volume` signal (Taft Styling Balm Locken). Exclude pure feel-only lines without a result, ingredient/technology callouts, brand/collection names and words that fail this section’s vocabulary rules. Apply the existing authority/name-fallback rules; C3/C4 retailer copy never gains claim authority. Record the quoted signal, job, tier, source position and strength for the classification trace.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:802` (§6.10, pinned 0fab88de2b6d)

> 2. **Classify each signal, not the whole line.** **STRONG** = an explicit job promise, a strength word or brand number attached to the job, or an eligible job word in the confirmed product name. **WEAK** = a passing job mention without strength/emphasis, or a look description. A look description remains WEAK when merely describing a result; an explicit emphasized job promise is STRONG. A line may contain both classes. **Volume-specific strength `[R11-Q1]`: volume words (Volumen, Fülle, Schwung, Sprungkraft, Spannkraft) are STRONG only when volume itself is promised**, such as „für mehr Volumen“ or „Fülle am Ansatz“. A curl-quality description („Locken voller Sprungkraft“, or bare „Sprungkraft“ on a curl product) is WEAK even when another job in the same line is explicitly promised or emphasized. „für definierte Locken voller Sprungkraft“ therefore gives STRONG definition but WEAK volume; the verb „verleiht“ or the word „für“ alone cannot upgrade curl-quality wording to STRONG volume. Earlier R7-Q1 exclusions still apply: an adjective before a definition phrase supplies no separate job. Balea Pro Styling Cream Traumlocken and Taft Styling Balm Locken may fill only a free secondary slot with this WEAK volume signal, after compatible STRONG jobs. Duration or flexibility alone does not provide hold strength. **RG3-16's “hold_fix needs a strength word or number” now defines a STRONG hold signal; a bare hold mention is a WEAK hold signal**, rather than being excluded. An explicit fixing promise still supplies STRONG `hold_fix` without a grade (RG4-12). A masked strength/number still identifies a hold job, but determine its strength from the unmasked C claim packet; a generic mask is not itself strength evidence. Signal strength is an ordering label, never a hold level: no qualifying hold strength/number still gives `chaarlie_hold_level: null` under §7.2.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:804` (§6.10, pinned 0fab88de2b6d)

> 4. **Fill at most two secondary slots.** Exclude the primary's job. Stable-partition the collected signals into STRONG first, then WEAK: within STRONG, confirmed-name jobs retain name order before claim signals; within each strength class, claim order means packet order and then text order within a line (RG4-17). Walk all STRONG candidates before any WEAK candidate, deduplicating jobs as they are considered (a later STRONG mention therefore takes precedence over an earlier WEAK mention of the same job). Apply the unchanged formula gate to every candidate; drop and record failures, and continue to refill from the next candidate. Only when fewer than two compatible STRONG jobs remain may WEAK jobs fill free slots, in their original order. A primary formula conflict retains the primary and flags review. No third secondary is emitted.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:791` (§6.10, pinned 0fab88de2b6d)

> | Primary and vocabulary | **Primary `[RG-11]`:** the first **job-bearing** phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to `hold_fix`. **A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead's subject („Intensiver Halt für …", „Starker Halt –") the lead states `hold_fix` `[RG2-4]`** (`syoss-professional-performance-max-hold-power-wax`: „Intensiver Halt für glatte und glänzende … Looks" ⇒ `hold_fix`). **A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states `definition`; shaping without a curl/wave noun stays `hold_fix` `[RG2-5]`** (`syoss-curl-cream-gel-3in1` „Locken zu formen und zu definieren" ⇒ `definition`). **Job vocabulary `[RG2-6, RG2-7; R6-T (3)]`:** Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`; **an adjective before a job phrase is not a separate job `[R7-Q1]`** (Wellaflex „für schwungvolle, definierte Locken“ ⇒ primary `definition`). (Elastizität is a flexibility word, §6.9, never a job); taming or smoothing flyaways, „abstehende Haare/Härchen" or „Babyhaare" ⇒ `frizz_control`; `sleek` only for a smooth or straight result of the whole style („glatte Looks", „Sleek-Look") (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` „Glättet abstehende Haare" ⇒ `frizz_control`). **Definition `[R6-T (3), R7-Q2]`: a curl/wave word in the product's own confirmed name supplies `definition` (with §4.2's Beach Waves texture and curl-revival refresh exceptions); in descriptive sentences an explicit promise to define or shape curls/waves is required. „Definition“/„Define“ for a non-curl look and a result phrase such as „definierter Look“ never supply `definition`** (`alverde-beach-waves-spray-seaside-balance`: no definition secondary).  **R10-Q2:** „Struktur“ / „strukturiert“ ⇒ `texture`; a look description is WEAK. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 0fab88de2b6d)

> | Formula compatibility | **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review.  |

Frozen evidence: “Finishing Spray” (C2_house_brand, promise); “Mit pflegendem Camelinaöl” (C2_house_brand, promise); “Hinterlässt ein seidiges Haargefühl” (C2_house_brand, promise); “perfektes Finish; strahlender Hingucker; beeindruckenden Glanz” (C2_house_brand, finish); “Mit einem effektiven Anti-Frizz Effekt bleibt das Haar auch bei hoher Luftfeuchtigkeit glatt und kontrolliert” (C2_house_brand, humidity); “sorgt für ein perfektes Finish und verwandelt das Haar in einen strahlenden Hingucker” (C2_house_brand, other).

**Owner question:** For Balea Finishing Spray Glow & Care, should “das Haar … glatt und kontrolliert” under an Anti-Frizz promise show a separate smoothing job, or only the frizz-control job?

**Recommendation:** Require an explicit overall look/shape anchor for a separate sleek job in an anti-frizz humidity sentence; then retain B’s frizz_control-only set. This is a proposed clarification, not a proven A error.

**Fix:** Clarify §6.10 vocabulary and property set §2.12 whether Haar bleibt glatt in an anti-frizz/humidity claim is a whole-style sleek signal, or requires an explicit overall look/straightening anchor; add both positive and negative examples and replay the reached profiles.

### Balea Locken Crunchgel — secondary_jobs: b

`balea-locken-crunchgel` · `sty-112c5c2fc5`. A=["frizz_control","volume"]; B=["frizz_control","texture"]. **Both readings defensible; neither lane is declared right.**

R11-Q1 clearly makes curl-quality Sprungkraft WEAK. The remaining split is texture strength: “Das Haar erhält eine flexible Struktur” has an explicit result verb, supporting B’s STRONG job-promise reading, but the result itself is a descriptive flexible-structure look, supporting A’s WEAK reading. R10-Q2 admits Struktur as texture and makes a look description weak; step 2 also calls an explicit job promise strong. Neither settles this verb-plus-look construction. With WEAK texture, the earlier WEAK volume fills the remaining slot (A); with STRONG texture, it precedes WEAK volume (B). Natural film r3 supports both; shine fails its gate.

Affected section: §6.10 steps 1, 2 and 4; property set §2.12.

| Exact phrase | Job | A strength | B strength | Trace basis |
|---|---|---|---|---|
| Mit Anti-Frizz-Effekt | frizz_control | STRONG | NOT_RECORDED | A states STRONG; B selects frizz but does not supply a strength label. |
| Für definierte Locken voller Sprungkraft | volume | WEAK | WEAK | Both traces call curl-quality volume weak. |
| Das Haar erhält eine flexible Struktur und einen schönen Glanz | texture | WEAK | STRONG | A reads flexible Struktur as a look; B explicitly calls texture strong. |

NOT_RECORDED means no explicit strength trace; output alone does not prove a per-line label.

Exact governing text:

`docs/research/styling-inci/v1.0/styling-classification-standard.md:801` (§6.10, pinned 0fab88de2b6d)

> 1. **Collect every job signal.** Read the confirmed product's own name (apply standard §4.2 step 1 / R11-Q2: a form inside a job-bearing compound supplies no second name job), then **all C1/C2 claim lines** in packet order and each line in text order: `promise`, `finish`, `other`, `hold`, `flexibility`, `humidity`, `duration` and every other captured type are eligible. A field's type does not hide a job word: „Sprungkraft“ in a `flexibility` line is a `volume` signal (Taft Styling Balm Locken). Exclude pure feel-only lines without a result, ingredient/technology callouts, brand/collection names and words that fail this section’s vocabulary rules. Apply the existing authority/name-fallback rules; C3/C4 retailer copy never gains claim authority. Record the quoted signal, job, tier, source position and strength for the classification trace.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:802` (§6.10, pinned 0fab88de2b6d)

> 2. **Classify each signal, not the whole line.** **STRONG** = an explicit job promise, a strength word or brand number attached to the job, or an eligible job word in the confirmed product name. **WEAK** = a passing job mention without strength/emphasis, or a look description. A look description remains WEAK when merely describing a result; an explicit emphasized job promise is STRONG. A line may contain both classes. **Volume-specific strength `[R11-Q1]`: volume words (Volumen, Fülle, Schwung, Sprungkraft, Spannkraft) are STRONG only when volume itself is promised**, such as „für mehr Volumen“ or „Fülle am Ansatz“. A curl-quality description („Locken voller Sprungkraft“, or bare „Sprungkraft“ on a curl product) is WEAK even when another job in the same line is explicitly promised or emphasized. „für definierte Locken voller Sprungkraft“ therefore gives STRONG definition but WEAK volume; the verb „verleiht“ or the word „für“ alone cannot upgrade curl-quality wording to STRONG volume. Earlier R7-Q1 exclusions still apply: an adjective before a definition phrase supplies no separate job. Balea Pro Styling Cream Traumlocken and Taft Styling Balm Locken may fill only a free secondary slot with this WEAK volume signal, after compatible STRONG jobs. Duration or flexibility alone does not provide hold strength. **RG3-16's “hold_fix needs a strength word or number” now defines a STRONG hold signal; a bare hold mention is a WEAK hold signal**, rather than being excluded. An explicit fixing promise still supplies STRONG `hold_fix` without a grade (RG4-12). A masked strength/number still identifies a hold job, but determine its strength from the unmasked C claim packet; a generic mask is not itself strength evidence. Signal strength is an ordering label, never a hold level: no qualifying hold strength/number still gives `chaarlie_hold_level: null` under §7.2.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:804` (§6.10, pinned 0fab88de2b6d)

> 4. **Fill at most two secondary slots.** Exclude the primary's job. Stable-partition the collected signals into STRONG first, then WEAK: within STRONG, confirmed-name jobs retain name order before claim signals; within each strength class, claim order means packet order and then text order within a line (RG4-17). Walk all STRONG candidates before any WEAK candidate, deduplicating jobs as they are considered (a later STRONG mention therefore takes precedence over an earlier WEAK mention of the same job). Apply the unchanged formula gate to every candidate; drop and record failures, and continue to refill from the next candidate. Only when fewer than two compatible STRONG jobs remain may WEAK jobs fill free slots, in their original order. A primary formula conflict retains the primary and flags review. No third secondary is emitted.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:791` (§6.10, pinned 0fab88de2b6d)

> | Primary and vocabulary | **Primary `[RG-11]`:** the first **job-bearing** phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to `hold_fix`. **A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead's subject („Intensiver Halt für …", „Starker Halt –") the lead states `hold_fix` `[RG2-4]`** (`syoss-professional-performance-max-hold-power-wax`: „Intensiver Halt für glatte und glänzende … Looks" ⇒ `hold_fix`). **A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states `definition`; shaping without a curl/wave noun stays `hold_fix` `[RG2-5]`** (`syoss-curl-cream-gel-3in1` „Locken zu formen und zu definieren" ⇒ `definition`). **Job vocabulary `[RG2-6, RG2-7; R6-T (3)]`:** Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`; **an adjective before a job phrase is not a separate job `[R7-Q1]`** (Wellaflex „für schwungvolle, definierte Locken“ ⇒ primary `definition`). (Elastizität is a flexibility word, §6.9, never a job); taming or smoothing flyaways, „abstehende Haare/Härchen" or „Babyhaare" ⇒ `frizz_control`; `sleek` only for a smooth or straight result of the whole style („glatte Looks", „Sleek-Look") (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` „Glättet abstehende Haare" ⇒ `frizz_control`). **Definition `[R6-T (3), R7-Q2]`: a curl/wave word in the product's own confirmed name supplies `definition` (with §4.2's Beach Waves texture and curl-revival refresh exceptions); in descriptive sentences an explicit promise to define or shape curls/waves is required. „Definition“/„Define“ for a non-curl look and a result phrase such as „definierter Look“ never supply `definition`** (`alverde-beach-waves-spray-seaside-balance`: no definition secondary).  **R10-Q2:** „Struktur“ / „strukturiert“ ⇒ `texture`; a look description is WEAK. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 0fab88de2b6d)

> | Formula compatibility | **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review.  |

`plans/styling-concept/02-rulings.md:170` (R11-Q1, pinned 0fab88de2b6d)

> | R11-Q1 | **Volume words are a STRONG signal only when volume itself is promised** („für mehr Volumen", „Fülle am Ansatz"); a description of curl quality („Locken voller Sprungkraft", „Sprungkraft" on a curl product) is a WEAK signal (owner). E.g. Balea Pro Styling Cream Traumlocken, Taft Styling Balm Locken ⇒ volume only fills a free secondary slot. |

`plans/styling-concept/02-rulings.md:169` (R10-Q2, pinned 0fab88de2b6d)

> | R10-Q2 | **„Struktur"/„strukturiert" is a texture word** (owner); as a look description („natürlich strukturierter Look", Bali Gents Haarpuder) it is a weak texture signal under R10-Q1. |

Frozen evidence: “Haargel für definierte Locken” (C2_house_brand, promise); “Mit Anti-Frizz-Effekt, ohne zu beschweren” (C2_house_brand, promise); “Rezeptur mit Panthenol & Betain” (C2_house_brand, promise); “einen schönen Glanz” (C2_house_brand, finish); “Für definierte Locken voller Sprungkraft” (C2_house_brand, other); “Das Haar erhält eine flexible Struktur und einen schönen Glanz” (C2_house_brand, other).

**Owner question:** For Balea Locken Crunchgel, should “Das Haar erhält eine flexible Struktur” count as an explicit strong texture promise, or as a weak look description, leaving the earlier curl-bounce volume signal in the second slot?

**Recommendation:** Treat explicit hair-result verbs plus a texture noun as STRONG texture; reserve WEAK for descriptive look fragments. This proposed clarification would select B’s set, but is not current scoring authority.

**Fix:** Clarify §6.10 step 2 and property set §2.12 whether result verbs (erhält/verleiht) turn hair-look descriptions such as flexible Struktur into STRONG promises, with contrasting examples independent of claim type; replay the reached set.

### Balea PROFESSIONAL Styling Cream Traumlocken — secondary_jobs: b

`balea-professional-styling-cream-traumlocken` · `sty-42c1c3e170`. A=["frizz_control","hold_fix"]; B=["frizz_control","shine"]. **Both readings defensible; neither lane is declared right.**

Both now respect R11-Q1: curl-quality Sprungkraft is WEAK and does not displace compatible STRONG jobs. R11-Q1 does not decide shine strength. A reads NATÜRLICHEM GLANZ in the formula-for-curls result sentence as a WEAK look description; B explicitly calls shine STRONG but does not identify its exact source. The emphasized LEISTUNGSSTARKE FORMEL FÜR … NATÜRLICHEM GLANZ supports the explicit emphasized promise reading in step 2, while the same step’s look-description sentence supports A. If shine is STRONG, its earlier claim precedes graded hold; if WEAK, strong frizz and mittlerer Halt occupy the two slots. Shine passes wax_lipid r4, hold passes VP/VA r3; neither is a formula error. “Perfekt definierte, glänzende Locken” must separately respect R7-Q1 adjective exclusions and is not automatically B’s source.

Affected section: §6.10 steps 1, 2 and 4; property set §2.12.

| Exact phrase | Job | A strength | B strength | Trace basis |
|---|---|---|---|---|
| Schützt effektiv vor Frizz | frizz_control | STRONG | STRONG | A labels strong; B explicitly says strong frizz. |
| LEISTUNGSSTARKE FORMEL FÜR DEFINIERTE, LEBENDIGE LOCKEN VOLLER SPRUNGKRAFT UND NATÜRLICHEM GLANZ | shine | WEAK | STRONG (source not specified) | A explicitly labels gloss weak; B says strong shine without naming the exact source, so this is a plausible source, not an attributed per-line trace. |
| Halt: mittlerer Halt | hold_fix | STRONG | NOT_RECORDED | Strength word clearly makes hold strong; B does not trace its hold exclusion. |

NOT_RECORDED means no explicit strength trace; output alone does not prove a per-line label.

Exact governing text:

`docs/research/styling-inci/v1.0/styling-classification-standard.md:801` (§6.10, pinned 0fab88de2b6d)

> 1. **Collect every job signal.** Read the confirmed product's own name (apply standard §4.2 step 1 / R11-Q2: a form inside a job-bearing compound supplies no second name job), then **all C1/C2 claim lines** in packet order and each line in text order: `promise`, `finish`, `other`, `hold`, `flexibility`, `humidity`, `duration` and every other captured type are eligible. A field's type does not hide a job word: „Sprungkraft“ in a `flexibility` line is a `volume` signal (Taft Styling Balm Locken). Exclude pure feel-only lines without a result, ingredient/technology callouts, brand/collection names and words that fail this section’s vocabulary rules. Apply the existing authority/name-fallback rules; C3/C4 retailer copy never gains claim authority. Record the quoted signal, job, tier, source position and strength for the classification trace.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:802` (§6.10, pinned 0fab88de2b6d)

> 2. **Classify each signal, not the whole line.** **STRONG** = an explicit job promise, a strength word or brand number attached to the job, or an eligible job word in the confirmed product name. **WEAK** = a passing job mention without strength/emphasis, or a look description. A look description remains WEAK when merely describing a result; an explicit emphasized job promise is STRONG. A line may contain both classes. **Volume-specific strength `[R11-Q1]`: volume words (Volumen, Fülle, Schwung, Sprungkraft, Spannkraft) are STRONG only when volume itself is promised**, such as „für mehr Volumen“ or „Fülle am Ansatz“. A curl-quality description („Locken voller Sprungkraft“, or bare „Sprungkraft“ on a curl product) is WEAK even when another job in the same line is explicitly promised or emphasized. „für definierte Locken voller Sprungkraft“ therefore gives STRONG definition but WEAK volume; the verb „verleiht“ or the word „für“ alone cannot upgrade curl-quality wording to STRONG volume. Earlier R7-Q1 exclusions still apply: an adjective before a definition phrase supplies no separate job. Balea Pro Styling Cream Traumlocken and Taft Styling Balm Locken may fill only a free secondary slot with this WEAK volume signal, after compatible STRONG jobs. Duration or flexibility alone does not provide hold strength. **RG3-16's “hold_fix needs a strength word or number” now defines a STRONG hold signal; a bare hold mention is a WEAK hold signal**, rather than being excluded. An explicit fixing promise still supplies STRONG `hold_fix` without a grade (RG4-12). A masked strength/number still identifies a hold job, but determine its strength from the unmasked C claim packet; a generic mask is not itself strength evidence. Signal strength is an ordering label, never a hold level: no qualifying hold strength/number still gives `chaarlie_hold_level: null` under §7.2.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:804` (§6.10, pinned 0fab88de2b6d)

> 4. **Fill at most two secondary slots.** Exclude the primary's job. Stable-partition the collected signals into STRONG first, then WEAK: within STRONG, confirmed-name jobs retain name order before claim signals; within each strength class, claim order means packet order and then text order within a line (RG4-17). Walk all STRONG candidates before any WEAK candidate, deduplicating jobs as they are considered (a later STRONG mention therefore takes precedence over an earlier WEAK mention of the same job). Apply the unchanged formula gate to every candidate; drop and record failures, and continue to refill from the next candidate. Only when fewer than two compatible STRONG jobs remain may WEAK jobs fill free slots, in their original order. A primary formula conflict retains the primary and flags review. No third secondary is emitted.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:791` (§6.10, pinned 0fab88de2b6d)

> | Primary and vocabulary | **Primary `[RG-11]`:** the first **job-bearing** phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to `hold_fix`. **A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead's subject („Intensiver Halt für …", „Starker Halt –") the lead states `hold_fix` `[RG2-4]`** (`syoss-professional-performance-max-hold-power-wax`: „Intensiver Halt für glatte und glänzende … Looks" ⇒ `hold_fix`). **A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states `definition`; shaping without a curl/wave noun stays `hold_fix` `[RG2-5]`** (`syoss-curl-cream-gel-3in1` „Locken zu formen und zu definieren" ⇒ `definition`). **Job vocabulary `[RG2-6, RG2-7; R6-T (3)]`:** Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`; **an adjective before a job phrase is not a separate job `[R7-Q1]`** (Wellaflex „für schwungvolle, definierte Locken“ ⇒ primary `definition`). (Elastizität is a flexibility word, §6.9, never a job); taming or smoothing flyaways, „abstehende Haare/Härchen" or „Babyhaare" ⇒ `frizz_control`; `sleek` only for a smooth or straight result of the whole style („glatte Looks", „Sleek-Look") (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` „Glättet abstehende Haare" ⇒ `frizz_control`). **Definition `[R6-T (3), R7-Q2]`: a curl/wave word in the product's own confirmed name supplies `definition` (with §4.2's Beach Waves texture and curl-revival refresh exceptions); in descriptive sentences an explicit promise to define or shape curls/waves is required. „Definition“/„Define“ for a non-curl look and a result phrase such as „definierter Look“ never supply `definition`** (`alverde-beach-waves-spray-seaside-balance`: no definition secondary).  **R10-Q2:** „Struktur“ / „strukturiert“ ⇒ `texture`; a look description is WEAK. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 0fab88de2b6d)

> | Formula compatibility | **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review.  |

`plans/styling-concept/02-rulings.md:170` (R11-Q1, pinned 0fab88de2b6d)

> | R11-Q1 | **Volume words are a STRONG signal only when volume itself is promised** („für mehr Volumen", „Fülle am Ansatz"); a description of curl quality („Locken voller Sprungkraft", „Sprungkraft" on a curl product) is a WEAK signal (owner). E.g. Balea Pro Styling Cream Traumlocken, Taft Styling Balm Locken ⇒ volume only fills a free secondary slot. |

Frozen evidence: “Für definierte lebendige Locken” (C2_house_brand, promise); “Schützt effektiv vor Frizz” (C2_house_brand, promise); “Verbesserte Geschmeidigkeit” (C2_house_brand, promise); “Anti-Statik-Formel verhindert Frizz” (C2_house_brand, promise); “Perfekt definierte, glänzende Locken und Hitzeschutz bis 220 °C” (C1, promise); “PFLEGE-FORMEL MIT SHEABUTTER UND KERATIN” (C1, promise); “LEISTUNGSSTARKE FORMEL FÜR DEFINIERTE, LEBENDIGE LOCKEN VOLLER SPRUNGKRAFT UND NATÜRLICHEM GLANZ” (C1, promise); “SCHWUNGVOLL. DEFINIERT. VERWÖHNT.” (C1, promise); “Anti-Statik-Formel schützt effektiv vor Frizz, für definierte Locken und gewelltes Haar.” (C1, promise); “Locken-Forming-System für Geschmeidigkeit und verbesserte Kämmbarkeit.” (C1, promise); “Halt: mittlerer Halt” (C2_house_brand, hold); “perfekt definierte und glänzende Locken” (C2_house_brand, finish); “BIS ZU 24h DEFINIERTE LOCKEN” (C1, duration); “Hitzeschutz bis zu 220 °C” (C2_house_brand, heat_protection); “Hitzeschutz bis 220 °C” (C1, heat_protection).

**Owner question:** For Balea PROFESSIONAL Styling Cream Traumlocken, does “LEISTUNGSSTARKE FORMEL FÜR … LOCKEN … UND NATÜRLICHEM GLANZ” promise strong shine, taking the second slot before hold, or describe a weak gloss look?

**Recommendation:** Treat trailing natural-gloss description as WEAK unless gloss itself is explicitly emphasized or promised by its own action phrase; then A’s frizz_control + hold_fix follows. This is proposed wording, not an approved amendment.

**Fix:** Clarify §6.10 step 2 and property set §2.12 for formula-for/result-noun shine wording, including whether emphasis on FORMEL transfers to a trailing NATÜRLICHEM GLANZ signal. Preserve the volume-only R11-Q1 exception and require source-specific strength traces before replay.

### BALI CURLS Volumizing Curl Spray — secondary_jobs: a

`bali-curls-volumizing-curl-spray-refreshing` · `sty-6882ed2a83`. A=["texture","volume"]; B=["definition","volume"]. **Lane A is right; lane B is wrong.** Correct: ["texture","volume"].

The confirmed name is Volumizing Curl Spray and the C2 lead says erfrischt deine Locken, with revival directions. §4.2 explicitly says a curl word is “definition, or refresh when the product revives curls”; §6.10 retains “curl-revival refresh exceptions”. Both select refresh as primary. B nevertheless reintroduces the same curl word as a STRONG definition secondary; the explicit exception makes it refresh, then step 4 excludes the primary’s job. A keeps name-volume and the Beachlook texture result. Magnesium Sulfate r2 supports both compatible secondaries. “Für Locken, Wellen & alle Haartypen geeignet” is suitability, not a descriptive promise to define/shape curls.

Affected section: §6.10 steps 1, 2 and 4; property set §2.12.

Exact governing text:

`docs/research/styling-inci/v1.0/styling-classification-standard.md:801` (§6.10, pinned 0fab88de2b6d)

> 1. **Collect every job signal.** Read the confirmed product's own name (apply standard §4.2 step 1 / R11-Q2: a form inside a job-bearing compound supplies no second name job), then **all C1/C2 claim lines** in packet order and each line in text order: `promise`, `finish`, `other`, `hold`, `flexibility`, `humidity`, `duration` and every other captured type are eligible. A field's type does not hide a job word: „Sprungkraft“ in a `flexibility` line is a `volume` signal (Taft Styling Balm Locken). Exclude pure feel-only lines without a result, ingredient/technology callouts, brand/collection names and words that fail this section’s vocabulary rules. Apply the existing authority/name-fallback rules; C3/C4 retailer copy never gains claim authority. Record the quoted signal, job, tier, source position and strength for the classification trace.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:802` (§6.10, pinned 0fab88de2b6d)

> 2. **Classify each signal, not the whole line.** **STRONG** = an explicit job promise, a strength word or brand number attached to the job, or an eligible job word in the confirmed product name. **WEAK** = a passing job mention without strength/emphasis, or a look description. A look description remains WEAK when merely describing a result; an explicit emphasized job promise is STRONG. A line may contain both classes. **Volume-specific strength `[R11-Q1]`: volume words (Volumen, Fülle, Schwung, Sprungkraft, Spannkraft) are STRONG only when volume itself is promised**, such as „für mehr Volumen“ or „Fülle am Ansatz“. A curl-quality description („Locken voller Sprungkraft“, or bare „Sprungkraft“ on a curl product) is WEAK even when another job in the same line is explicitly promised or emphasized. „für definierte Locken voller Sprungkraft“ therefore gives STRONG definition but WEAK volume; the verb „verleiht“ or the word „für“ alone cannot upgrade curl-quality wording to STRONG volume. Earlier R7-Q1 exclusions still apply: an adjective before a definition phrase supplies no separate job. Balea Pro Styling Cream Traumlocken and Taft Styling Balm Locken may fill only a free secondary slot with this WEAK volume signal, after compatible STRONG jobs. Duration or flexibility alone does not provide hold strength. **RG3-16's “hold_fix needs a strength word or number” now defines a STRONG hold signal; a bare hold mention is a WEAK hold signal**, rather than being excluded. An explicit fixing promise still supplies STRONG `hold_fix` without a grade (RG4-12). A masked strength/number still identifies a hold job, but determine its strength from the unmasked C claim packet; a generic mask is not itself strength evidence. Signal strength is an ordering label, never a hold level: no qualifying hold strength/number still gives `chaarlie_hold_level: null` under §7.2.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:804` (§6.10, pinned 0fab88de2b6d)

> 4. **Fill at most two secondary slots.** Exclude the primary's job. Stable-partition the collected signals into STRONG first, then WEAK: within STRONG, confirmed-name jobs retain name order before claim signals; within each strength class, claim order means packet order and then text order within a line (RG4-17). Walk all STRONG candidates before any WEAK candidate, deduplicating jobs as they are considered (a later STRONG mention therefore takes precedence over an earlier WEAK mention of the same job). Apply the unchanged formula gate to every candidate; drop and record failures, and continue to refill from the next candidate. Only when fewer than two compatible STRONG jobs remain may WEAK jobs fill free slots, in their original order. A primary formula conflict retains the primary and flags review. No third secondary is emitted.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:791` (§6.10, pinned 0fab88de2b6d)

> | Primary and vocabulary | **Primary `[RG-11]`:** the first **job-bearing** phrase of the lead promise; product nouns (Gel, Gelee, Paste, Wachs) and strength phrases („mit mittlerem Halt") are not job-bearing unless nothing else is; shaping/forming wording maps to `hold_fix`. **A strength phrase is not job-bearing when it qualifies a product noun or follows another job phrase („Gel mit mittlerem Halt"); when the hold is the lead's subject („Intensiver Halt für …", „Starker Halt –") the lead states `hold_fix` `[RG2-4]`** (`syoss-professional-performance-max-hold-power-wax`: „Intensiver Halt für glatte und glänzende … Looks" ⇒ `hold_fix`). **A curl/wave noun with a shaping or setting verb („Locken formen", „Curl Shaper", „Wellen über Nacht") states `definition`; shaping without a curl/wave noun stays `hold_fix` `[RG2-5]`** (`syoss-curl-cream-gel-3in1` „Locken zu formen und zu definieren" ⇒ `definition`). **Job vocabulary `[RG2-6, RG2-7; R6-T (3)]`:** Schwung, Sprungkraft, Spannkraft, Fülle ⇒ `volume`; **an adjective before a job phrase is not a separate job `[R7-Q1]`** (Wellaflex „für schwungvolle, definierte Locken“ ⇒ primary `definition`). (Elastizität is a flexibility word, §6.9, never a job); taming or smoothing flyaways, „abstehende Haare/Härchen" or „Babyhaare" ⇒ `frizz_control`; `sleek` only for a smooth or straight result of the whole style („glatte Looks", „Sleek-Look") (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` „Glättet abstehende Haare" ⇒ `frizz_control`). **Definition `[R6-T (3), R7-Q2]`: a curl/wave word in the product's own confirmed name supplies `definition` (with §4.2's Beach Waves texture and curl-revival refresh exceptions); in descriptive sentences an explicit promise to define or shape curls/waves is required. „Definition“/„Define“ for a non-curl look and a result phrase such as „definierter Look“ never supply `definition`** (`alverde-beach-waves-spray-seaside-balance`: no definition secondary).  **R10-Q2:** „Struktur“ / „strukturiert“ ⇒ `texture`; a look description is WEAK. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 0fab88de2b6d)

> | Formula compatibility | **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review.  |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:482` (§4.2, pinned 0fab88de2b6d)

> **R7 job reading (R7-F, R7-Q1, R7-Q2).** If the eligible lead supplies no primary-vocabulary job but a later eligible C1/C2 promise line does, that line's first job is primary in the §4.2 order; only when all such lines supply none is `primary_job: null` emitted (§6.10). An adjective before a job phrase is not a separate job: Wellaflex „für schwungvolle, definierte Locken“ promises `definition`, not an earlier volume job. A curl/wave word in the product's own confirmed name supplies `definition` („Killer.Curls“, „Curl Cream“, „Lockencreme“, „Locken & Wellen“), subject to the existing Beach Waves texture exception and explicit curl-revival `refresh` reading. In descriptive sentences, definition needs an explicit promise to define/shape curls or waves; „Definition“/„Define“ for a non-curl look never supplies it (Bali Gents Sea Salt Spray „Griffigkeit und Definition“; Balea Leave-in Spray Sea Salt Care & Define). This does not bypass the one-job name test, R4-Q7 qualifiers, care + definition tie, formula checks or registry rulings.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:478` (§4.2, pinned 0fab88de2b6d)

> 1. the **job word of the confirmed product name**, when it names exactly one (Lockencreme ⇒ definition; Hitzeschutzspray ⇒ heat protection; Finishing-Spray / Glanzspray ⇒ finish). **A name with two or more job words does not decide; go to step 2** `[R1-H1]` (Elnett „Stylingspray Hitzeschutz 3 Tage Glatt" ⇒ pack front „Hitze Styling-Spray, glatt 3 Tage, starker Halt" ⇒ styling result, as PH1-14 rules). **Product noun Puder/Powder `[R8-Q2]`:** Puder/Powder names `volume`, including Haarpuder and Volumenpuder; it never defaults to `hold_fix` or `texture`. Texture/grip promised in a C1/C2 line is an eligible secondary under §6.10. Redken „Powder Grip“ itself names two jobs — Powder = `volume`, Grip = `texture` — so step 2/3 decides the lead; other product nouns retain their mappings.  **Job-bearing form compounds `[R11-Q2]`: a form word — Gel, Cream, Creme, Gelee, Lotion, Spray, Schaum — inside a compound name that already names the job is the form, not a second job.** Wella EIMI Nutricurls „Curl Shaper (Defining Gel Cream)“ names definition once: Curl, Shaper and Defining express that job, while Gel/Cream are forms ⇒ primary `definition`. Likewise „Curl Cream Gel“ ⇒ one definition job. Apply this before counting distinct name jobs; form words do not create an additional name-derived `hold_fix` secondary in §6.10. A product-type noun still supplies its earlier default when it is the only job noun; true distinct job words still invoke step 2/3. Earlier authority, collection exclusions, qualifiers, care + definition ties, formula gates and registry rulings remain in force. **Counting the name's job words `[RG2-21, RG2-5]`:** the product-type noun (Haarspray, Gel, Wachs, Puder, Schaumfestiger) names the job when it is the only job noun, and a shine or strength qualifier in the same name is not a second job (`schwarzkopf-taft-haarspray-glanz-halt-4` „Haarspray Glanz Halt 4" ⇒ one job, hold, so `hairspray`, as §5 says); name job words that name the same job count as one (Curl + Defining + Shaper on a curl product; „Glanz-Spray … Silky Shine"). **Which name words are job words `[RG3-1]`:** a **curl or wave word** in the product's own name (Locken-, Curl, Curls, Wellen-, Wave/Waves) is a curl job word `[R7-Q2]` — definition, or refresh when the product revives curls; a **salt noun** (Salzspray, Sea Salt Spray) names texture; a **product noun used as a form in a compound with another product noun** (Wax Spray, Spray Wax, Sprühwachs, Gel-Spray) names the form, not a job — go to step 2/3. Round-3 outcomes (historical, subject to the R7 amendment above): `bali-curls-volumizing-curl-spray-refreshing` („Volumizing Curl Spray": two job words ⇒ first C2 line, revival ⇒ held `refresher`); `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` (name has hold + definition; the C1 phrase „für schwungvolle, definierte Locken“ ⇒ primary `definition` under R7-Q1 ⇒ 3.4 (iii)); `kevin-murphy-killer-curls` (two job words ⇒ the C2 hold line leads ⇒ primary `hold_fix`; the route stays D7 `curl_cream`, held); `jean-und-len-sea-salt-spray` (salt noun ⇒ texture); `redken-wax-spray` (Wax Spray names the form ⇒ first C2 line „Texturierendes Sprühwachs" ⇒ texture ⇒ `texture_spray`, §5). **Product noun vs qualifier, also inside a compound `[R4-Q7]`:** a product-type noun in the name (Wachs/Wax, Paste, Clay, Gel, Pomade, Fiber, Haarspray) names the job (molding or hold); a **shine or strength qualifier** in the name (Glanz, Glow, Shine, Strong, Power) is the finish or the grade, **never a second job — also inside a compound** (as „Haarspray Glanz"). Two product nouns of the same job count once. Subject to R11-Q2 above (a form in a job-bearing compound is not a job), a **true job word naming a different job** beside a job-bearing product noun (Texture beside Paste/Clay; Grip beside Powder) makes two jobs ⇒ the name decides nothing ⇒ the lead line decides (step 2/3). The RG3-1 form compound stays for a product noun joined with a dispensing-form noun (Wax Spray, Sprühwachs, Gel-Spray: the spray is the form). Cases: `schwarzkopf-taft-gel-wax-glanz-halt-2` („Gel Wax Glanz": Gel and Wax name one job, Glanz is the finish) ⇒ `molding`, primary `hold_fix`, finish `glänzend`, and its D8b flag is kept internally (R4-Q7; §7.5); `got2b-styling-paste-istyler-texture-clay` („Styling Paste … Texture Clay": Paste/Clay + the job word Texture ⇒ two jobs) ⇒ the C2 line „… ultra krassem Halt" leads ⇒ primary `hold_fix`, `texture` secondary; `balea-haarwachs-glow-wax` (Glow is a qualifier) ⇒ `hold_fix`. **Look names and shine nouns `[R4-Q2]`:** „Beach Waves", „Strandwellen", „beachy" name the **salt-spray texture look** ⇒ `texture` (`li_function: no`), not curl definition; RG3-1's wave nouns cover curl/wave definition and revival products („Wellen-Spray", „Wellenauffrischer"), not beach-look names (`alverde-beach-waves-spray-seaside-balance` ⇒ texture ⇒ 3.4 (ii) ⇒ committed `salt_spray`). „Glaze", „Topcoat" and „Gloss" are shine job nouns (with the R2-Q3 list: Glanz, Shine, Gloss, Finish) ⇒ `syoss-glaze-topcoat` („Glaze Topcoat": one job, shine; R3-Q3 lets the one-job name win) ⇒ `styling_result` ⇒ 3.5 ⇒ committed `shine_finish`. Slogans in a name („Big Hair Day", „Salon Blow-Out") name no job and are skipped (RG2-17). **Shop-title fallback `[R3-Q2]`:** the confirmed name is the pack name (C1) or the brand's German-page name (C2). When **neither** shows the product name, the **product-type noun of the retailer's product title** (Hitzeschutzspray, Öl, Serum, Haarspray, Gel, Wachs …; dm „syoss **Hitzeschutzspray** Keratin") serves as the confirmed-name job word for this step and for D2 (§4.3 3.1), with review `name_from_retailer_title`, **provided the type noun agrees across the retailer titles captured `[R3-H4 (d)]`** — two titles with different type nouns (e.g. „Hitzeschutzspray" vs „Haarspray") give no fallback: the name decides nothing, the lead falls to steps 2–3, review `retailer_title_type_noun_conflict` (R1-H1's two-job-word rule covers two nouns in **one** name). **Every other word of a retailer title never counts** (R2-H1, the C3 rule): qualifiers, variant names, ingredient words and any second noun stay C3 traces. The real pack names of the products concerned are captured (29 confirmed names were retailer-title only in round 3, node, `round-3/diff.json` `packet_checks.confirmed_name_tier_C3`; P3-7, R3-T), and a captured pack or brand-page name replaces the fallback (the round-4 freeze replaces it from `capture/packnames-r7.json` wherever A3/A11 confirm a name, §4.6). Cases: `syoss-hitzeschutzspray-keratin-heat` ⇒ heat protection ⇒ 3.3 (§11.21); `loreal-elvital-haaroel-oel-magique-alle-haartypen`, `john-frieda-haarserum-frizz-ease-der-baendiger`, `garnier-fructis-sleek-and-stay-heat-activated-serum` ⇒ „Öl"/„Serum" ⇒ D2 by the letter (§4.6);

Frozen evidence: “Das vegane VOLUMIZING CURL SPRAY mit Reisprotein und Ylang-Ylang-Extrakt erfrischt deine Locken und verleiht einen wundervollen und voluminösen Beachlook. Der einzigartige Duft bringt dir das Sommergefühl aus Bali direkt nach Hause in dein Badezimmer.” (C2, promise); “Curly Method konform” (C2, promise); “Mit natürlichen & pflegenden Inhaltsstoffen” (C2, promise); “Für Locken, Wellen & alle Haartypen geeignet” (C2, promise); “wundervollen und voluminösen Beachlook” (C2, finish).

**Fix:** Correct lane B secondary_jobs to the unordered set texture + volume; record the revival-name exception in its signal trace. No rule amendment is needed.

## Hold check

**89/89 authoritative hold values agree**; 31 numeric levels emitted; 58 null/null. Raw agreement 89/89. Independent packet-derived claim/scale/suppression check: **89/89 correct in both**, 0 failures.

C1/C2 claim-only scales/words, numbers before words, conflicting strengths median rounded up, then lane-specific profile-emission gate. No number from formula or duration. Strength vocabulary does not decide secondary eligibility.

| Product | A / B | Expected A / B | Captured level |
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
| Balea Styling Glow Wax | null / null | null / null | null |
| Balea Leave-In Spray Sea Salt Care & Define | null / null | null / null | null |
| Balea Locken Crunchgel | null / null | null / null | null |
| Balea Locken Revitalizing Spray | null / null | null / null | null |
| Balea Overnight Wellenspray | null / null | null / null | null |
| Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray) | null / null | null / null | null |
| Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray | null / null | null / null | null |
| Balea PROFESSIONAL Styling Cream Traumlocken | 2 / 2 | 2 / 2 | 2 |
| Balea Styling Spray Volumenpuder Pure Styling | 1 / 1 | 1 / 1 | 1 |
| Balea Sea Salt Texture Spray | null / null | null / null | null |
| Balea Styling Creme Power Flex (Forming Cream Power Flex) | null / null | null / null | null |
| Balea Styling Locken Lotion | null / null | null / null | null |
| Balea Styling Spray Ultra Volumen | 4 / 4 | 4 / 4 | 4 |
| BALI CURLS HYDRATING CURL CREAM | null / null | null / null | null |
| BALI CURLS Leave-In Spray Curl Defining (Curl Defining Spray) | null / null | null / null | null |
| BALI CURLS Haargel Strong Hold Flaxseed | 4 / 4 | 4 / 4 | 4 |
| BALI CURLS Volumizing Curl Spray | null / null | null / null | null |
| BALI GENTS Sea Salt Spray | null / null | null / null | null |
| cantu SHEA BUTTER COCONUT CURLING CREAM | null / null | null / null | null |
| Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel | null / null | null / null | "UNMAPPED" |
| GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray | null / null | null / null | null |
| GARNIER FRUCTIS LOCKEN METHODE SHAPE REFRESH STEP 4 FEUCHTIGKEITS-BOOST SPRAY | null / null | null / null | null |
| got2b Anti-Frizz Lotion Schmusekatze | null / null | null / null | null |
| got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | null / null | null / null | null |
| got2b Schutz-engel Hitzeschutz Spray | null / null | null / null | null |
| got2b Kleber 4 Brows & Edges 2in1 Stylinggel | 3 / 3 | 3 / 3 | 3 |
| got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) | null / null | null / null | null |
| GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) | null / null | null / null | null |
| GUHL LOCKEN PFLEGE & STYLING 3in1 LOCKENCREME, KUR & SPÜLUNG | null / null | null / null | null |
| GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY | null / null | null / null | null |
| HASK curls defining cream | null / null | null / null | null |
| Jean&Len Sea Salt Spray | null / null | null / null | null |
| John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray | null / null | null / null | null |
| John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) | null / null | null / null | null |
| John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | null / null | null / null | null |
| John Frieda Frizz Ease Zauberformel Seiden-Finish Creme | null / null | null / null | null |
| John Frieda Traumlocken Belebender Wellenauffrischer | null / null | null / null | null |
| John Frieda Spray Volume Lift Pushed-up Dry Texture | null / null | null / null | null |
| Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray | null / null | null / null | null |
| Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) | 3 / 3 | 3 / 3 | 3 |
| KMS Thermashape Straightening Creme | null / null | null / null | null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft | null / null | null / null | null |
| LANGHAARMÄDCHEN Lockenspray Natur Lockenwunder | null / null | null / null | null |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt | 4 / 4 | 4 / 4 | 4 |
| L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt | 3 / 3 | 3 / 3 | 3 |
| L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | null / null | null / null | null |
| Maria Nila Curlicue Cream (Stylingcreme) | 2 / 2 | 2 / 2 | 2 |
| Moroccanoil Anti-Frizz Schild-Spray (Frizz Shield Spray) | null / null | null / null | null |
| Moroccanoil Trockenes Texturspray (Dry Texture Spray) | null / null | null / null | null |
| Moroccanoil Glättende Creme (Smoothing Lotion) | null / null | null / null | null |
| Moroccanoil Volumizing Spray (Volumizing Mist) | null / null | null / null | null |
| Redken Refreshing Curl Mist | null / null | null / null | null |
| Redken BEACH SPRAY BEACHY TEXTURE SPRAY | null / null | null / null | null |
| Redken Wax Spray (Redken Spray Wax) | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY | null / null | null / null | null |
| Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) | 1 / 1 | 1 / 1 | 1 |
| Schwarzkopf taft Haarspray CLASSIC Halt 3 | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf taft Haarspray GLANZ Halt 4 | 3 / 3 | 3 / 3 | 3 |
| Schwarzkopf taft Haarspray POWER Halt 5 | 4 / 4 | 4 / 4 | 4 |
| Schwarzkopf Taft Haargel MATT WAX Halt 5 | 4 / 4 | 4 / 4 | 4 |
| Schwarzkopf taft Haargel POWER Halt 5 | 4 / 4 | 4 / 4 | 4 |
| Schwarzkopf taft Schaumfestiger Volumen Halt 4, für feines Haar | 3 / 3 | 3 / 3 | 3 |
| Schwarzkopf taft Styling Balm LOCKEN Halt 3 | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf taft Texturspray Aloe Boost | null / null | null / null | null |
| Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine | null / null | null / null | null |
| syoss Curl Cream Gel | null / null | null / null | null |
| syoss Haarspray Max Hold | 4 / 4 | 4 / 4 | 4 |
| syoss KERATIN Heat HITZESCHUTZ-SPRAY | null / null | null / null | null |
| Syoss Max Hold Wax | 4 / 4 | 4 / 4 | 4 |
| Syoss Schaumfestiger Volume | 3 / 3 | 3 / 3 | 3 |
| Schwarzkopf taft taft x GLISS Lovely Long MULTITASKING HITZESCHUTZ-SPRAY | null / null | null / null | null |
| Wella Professionals EIMI Glam Mist Shinespray | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion) | null / null | null / null | 1 |
| Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) | null / null | null / null | 1 |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray | 3 / 3 | 3 / 3 | 3 |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm | 1 / 1 | 1 / 1 | 1 |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt | 2 / 2 | 2 / 2 | 2 |

Hold rules: `docs/research/styling-inci/v1.0/styling-classification-standard.md:900` (§7.2, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:897` (§7.2, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:901` (§7.2, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:909` (§7.3, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:913` (§7.3, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:917` (§7.3, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:926` (§7.4, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:929` (§7.4, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:941` (§7.4, pinned 0fab88de2b6d); `docs/research/styling-inci/v1.0/styling-classification-standard.md:624` (§4.7, pinned 0fab88de2b6d). All 89 records use their own C1/C2 claims and the profile-emission gate. Ungraded hold leaves the level null regardless of secondary-job strength.

## Latent ambiguities — non-blocking

8 registry-over-letter products (including Elnett 3 Tage Glatt), plus 2 other agreed-value concerns.

10 products fully agree while a lane reports an alternate interpretation or registry-over-letter route. These do not enter a/b/c/d disagreement counts.

- **Balea Leave-In Spray Sea Salt Care & Define** (`balea-leave-in-spray-sea-salt-care-define`): Lane A: Signals: name Sea Salt texture STRONG; lead „Texturgebendes Haarspray“ texture (primary); „Griffigkeit und Definition“ texture dup, Definition not a job (R7-Q2); „Beach-Looks mit mattem Finish“ texture dup; „pflegt … Ölphase“ care, no job. Finish „mattem Finish“ ⇒ matt. candidate_below_tail: Isopropyl Myristate r10 would make weight medium.; ["4.1 gate pass (house-brand C2)","4.2: name „Sea Salt“ texture; „Care“ beside it; „Define“ is not definition for a non-curl look (R7-Q2) ⇒ lead C2 „Texturgebendes Haarspray“ = texture","no definition half ⇒ not mixed; li_function no","letter: 3.4(ii) ⇒ committed salt_spray","registry D6 row (Balea Sea Salt Care & Define) keeps ruling: held salt_spray (§4.1 (d), R4-Q5)"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **BALI CURLS HYDRATING CURL CREAM** (`bali-curls-hydrating-curl-cream`): Lane A: Registry row matched by brand + pack name.; ["4.1 gate pass (C2 promise)","4.2 C2 „spendet … Feuchtigkeit, … definiert, stärkt“ = care + curl definition ⇒ mixed (R1-Q3)","D7: no fixative; (i′) no","registry BALI CURLS HYDRATING CURL CREAM = leave_in (§4.1 (c))"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **BALI CURLS Haargel Strong Hold Flaxseed** (`bali-curls-strong-hold-flaxseed-gel`): Lane A: §11.19. Signals: name Gel/Strong Hold hold_fix STRONG (primary); C2 „Extra-starker Halt für definierte, langanhaltende Locken“ definition STRONG (explicit defined-curls promise; gate ✓ natural_film); finish „schenkt natürlichen Glanz“ / duration „natürlichen Glanz“ shine ⇒ dropped by gate. Flex „Flexibler Halt ohne … Verhärten“ ⇒ beweglich. Finish „natürlicher Glanz“ ⇒ natürlich.; ["4.1 gate pass (C2)","4.2 step1 name „Haargel Strong Hold Flaxseed“: Gel + Strong qualifier ⇒ one job hold_fix","li_function no ⇒ letter 3.4(ii) committed gel","registry D6 row (BALI CURLS Strong Hold Flaxseed) keeps ruling ⇒ held gel (§4.1 (d), R4-Q5)"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **cantu SHEA BUTTER COCONUT CURLING CREAM** (`cantu-lockencreme-kokos`): Lane A: Registry row matched by brand + pack name.; ["4.1 gate pass (C1 promise)","4.2 C1 „defines, softens & moisturises“ = care (moisturises) + definition ⇒ mixed (R1-Q3)","D7: no fixative ⇒ no; (i′) no","letter: provisional_boundary (mixed_promise)","registry cantu Coconut Curling Cream = leave_in (§4.1 (c)) ⇒ leave_in"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **HASK curls defining cream** (`hask-lockencreme-curl-care`): Lane A: Registry row matched by brand + pack name (R4-Q6).; ["4.1 gate pass (C1 pack line)","4.2 C1 „MOISTURIZES & CONTROLS FRIZZ“ (care) + name „curls defining cream“ (definition half) ⇒ mixed (R1-Q3)","D7: no fixative-class polymer; (i′) no","registry HASK „curls defining cream“ = leave_in (§4.1 (c))"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme)** (`john-frieda-frizz-ease-traumlocken-lockencreme`): Lane A: T_S Caprylhydroxamic Acid r14 unresolved (booster above Phenoxyethanol r24) ⇒ R2 Tetrasodium Glutamate Diacetate r15; same values. hold_route ambiguous (Acrylates Copolymer r2 uncorroborated, Sodium Polystyrene Sulfonate r3 FX-U) ⇒ no neutral fact. Signals: name Lockencreme definition STRONG (primary); C1 „24-Stunden Halt“ hold_fix WEAK; humidity „Verhindert Frizz“ frizz_control STRONG (gate ✓ silicone_coat); flexibility „definierte, flexible Locken“ definition dup ⇒ secondaries [frizz_control (STRONG), hold_fix (WEAK, free slot; gate ✓ ambiguous hold_route)]. Flex „flexible“ ⇒ beweglich. Weight rich via LGN pair (Cocamidopropyl PG-Dimonium Chloride Phosphate r11 + Stearyl/Cetyl Alcohol).; ["4.1 gate pass (C1 promise, C3 directions)","4.2 step1 name „Lockencreme“ = definition (Traumlocken/Frizz Ease brand lines excluded)","li_function yes","aqueous","3.4(i) D7 limb1 cannot be established: generic Acrylates Copolymer r2 uncorroborated (aqueous cream, HEC RH-1) FX-2c","3.4(iii) LI G0 stops on the uncorroborated acrylates ⇒ letter li_g0_provisional","registry D7 row rules held curl_cream (§4.1 (d), R4-Q5)"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **John Frieda Frizz Ease Zauberformel Seiden-Finish Creme** (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`): Lane A: Signals: name Finish shine STRONG (primary); C2 „Glättet abstehende Haare, verleiht Glanz und bändigt Frizz“ frizz_control STRONG (taming flyaways), shine dup; „Natürliche Bewegung“ no job; feel lines no job ⇒ [frizz_control] (gate ✓ silicone_coat). Finish „Glanz“ ⇒ glänzend. Cream rubbed between palms and worked into dry hair ⇒ dry_restyle (RG3-7); emphasis on flyaways inside a whole-hair instruction ⇒ all (RG2-10). Ambiguity: if the name were read as job-less the lead would be „Glättet abstehende Haare“ ⇒ primary frizz_control (user-facing).; ["4.1 gate pass (C2 promise + directions); possible truncation only in the fragrance block ⇒ inci_tail_defect, no block","4.2 step1 name „Seiden-Finish Creme“ = one job finish/shine („Frizz Ease“ brand line, „Zauberformel“ no job)","anti-frizz/flyaways on dry hair by main directions ⇒ shine-finish job (R1-Q2) ⇒ li_function no","3.1 D2: not Öl/Serum","aqueous","3.4(ii) ⇒ styling","§5 shine/flyaway on dry hair ⇒ shine_finish"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme)** (`kevin-murphy-killer-curls`): Lane A: Signals: name Killer.Curls definition STRONG (R7-Q2) + Anti-Frizz frizz_control STRONG (two name jobs ⇒ lead line decides primary); C2 „starkem Halt“ hold_fix STRONG (primary); flexibility lines no job ⇒ [definition, frizz_control] (gates ✓ PU-14 film, lanolin wax). Flex „Flexibilität/Flexibler Halt“ ⇒ beweglich. Ambiguity (user-facing): primary hold_fix (two-job name ⇒ lead line) vs definition if „(Leave-in Anti-Frizz Creme)“ were read as a descriptor outside the name job count. Acrylates Copolymer r4 uncorroborated (cream) but PU-14 r5 keeps hold_route present.; ["4.1 gate pass (C2 brand storefront, A9; C3 verbatim directions)","4.2 name „Killer.Curls (Leave-in Anti-Frizz Creme)“ = definition + frizz (two jobs) ⇒ step3 first C2 line „ideale Balance zwischen starkem Halt …“ ⇒ hold_fix","li_function no ⇒ letter 3.4(ii) would commit","registry D7 row (Kevin.Murphy Killer.Curls) keeps ruling ⇒ held curl_cream (§4.1 (d), R4-Q5)"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt** (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`): Lane A: Signals: pack-front „GLATT 3 TAGE“ sleek (primary); „Schutz vor Frizz & Feuchtigkeit“ frizz_control STRONG (gate ✓ silicone_coat); „Starker Halt“ hold_fix STRONG ⇒ dropped by gate; „POWER-SHINE-TECHNOLOGIE“ technology label, no job/finish (RG4-10); C2 finish „seidig glatt“ sleek dup. Ambiguity (route, user-facing if lanes split): the letter now reads leave_in because the frozen S0 packet carries only C1 promise lines (no claim_conflict); the route rests on the PH1-14 registry row, as §11.7 records.; ["4.1 gate pass (C1 pack lines; C2 brand-article directions, R3-H3)","4.2 name „Stylingspray Hitzeschutz 3 Tage Glatt“ = two job words (R1-H1) ⇒ step2 C1 pack-front line „… HITZE STYLING-SPRAY \| GLATT 3 TAGE … \| Starker Halt“ ⇒ styling result (sleek)","li_function yes (smoothing)","aqueous","3.4(i) limb 3′ no fixative; (i′) no smoothing-film member","letter: 3.4(iii) LI G0 in_category, D6 not fired (Dimethicone r2, Stearyl Alcohol r3 above T_LI) ⇒ leave_in","registry PH1-14 names Elnett 3 Tage Glatt ⇒ smoothing_styler; LI letter would claim it ⇒ held (§11.7)"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.
- **Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz)** (`schwarzkopf-taft-gel-wax-glanz-halt-2`): Lane A: Primary hold_fix fails the formula gate (only Paraffinum Liquidum r5, non-structuring ⇒ no hold mechanism) ⇒ kept + job_formula_conflict. D8b flag carried internally as ruled (§7.5 letter would not fire on a level-1 molding). Signals: name Gel/Wax hold_fix STRONG (primary), Glanz qualifier no job; C2 „bietet ein glänzendes Finish mit langanhaltendem Halt“ shine STRONG (explicit finish promise; gate ✓ wax_lipid) + hold dup; hold line Haltegrad dup ⇒ [shine]. Ambiguity (user-facing): whether a claim-line shine signal should be emitted when the name qualifier Glanz already maps to the finish.; ["4.1 gate pass","4.2 step1 name „Gel Wax Glanz“: Gel + Wax one job (hold/molding), Glanz = finish qualifier (R4-Q7)","li_function no","aqueous","3.4(ii) ⇒ styling","§5 ⇒ molding"] Retain the agreed values and disclose the named registry/letter or alternate-reading trace. This is not an observed A/B user-facing disagreement and is non-blocking under the requested comparison.

### Secondary storage order only

- Wella Professionals EIMI Glam Mist Shinespray: A=["frizz_control","sleek"], B=["sleek","frizz_control"]. Non-blocking calculation log.

## User-facing agreement

| Field | Agree / all | Disagree | Agreement |
|---|---|---|---|
| route | 89/89 | 0 | 100% |
| subtype | 89/89 | 0 | 100% |
| hold_level | 89/89 | 0 | 100% |
| weight | 89/89 | 0 | 100% |
| finish | 89/89 | 0 | 100% |
| flexibility | 89/89 | 0 | 100% |
| target_zone | 89/89 | 0 | 100% |
| application_moment | 89/89 | 0 | 100% |
| primary_job | 89/89 | 0 | 100% |
| secondary_jobs | 85/89 | 4 | 95.51% |
| provides_heat_protection | 89/89 | 0 | 100% |
| heat_activated | 89/89 | 0 | 100% |
| alcohol_note | 89/89 | 0 | 100% |
| buildup_note | 89/89 | 0 | 100% |
| neutral_fact | 89/89 | 0 | 100% |

### Products fully agreeing

- ALCINA Ansatz Volumen Spray Aerosol (`alcina-ansatz-volumen-spray-aerosol`).
- ALCINA Föhn Lotion (`alcina-foehn-lotion`).
- ALCINA Styling Mousse Aerosol (`alcina-styling-mousse-aerosol`).
- alverde NATURKOSMETIK Beach Waves Spray Seaside Balance (`alverde-beach-waves-spray-seaside-balance`).
- alverde NATURKOSMETIK Locken Refresh-Spray (`alverde-locken-refresh-spray`).
- AUSSIE WORK THAT CURL LEAVE-IN CREAM (`aussie-leave-in-creme-work-that-curl`).
- Balea Föhnlotion Volume Effect (`balea-foehnlotion-volume-effect`).
- Balea Glattspray Anti-Frizz (`balea-glattspray-anti-frizz`).
- Balea Styling Glow Wax (`balea-haarwachs-glow-wax`).
- Balea Leave-In Spray Sea Salt Care & Define (`balea-leave-in-spray-sea-salt-care-define`).
- Balea Locken Revitalizing Spray (`balea-locken-revitalizing-spray`).
- Balea Overnight Wellenspray (`balea-overnight-wellenspray`).
- Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray) (`balea-professional-definier-spray-traumlocken`).
- Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray (`balea-professional-glow-und-shine-finishing-spray`).
- Balea Styling Spray Volumenpuder Pure Styling (`balea-pure-styling-volumenpuder-spray`).
- Balea Sea Salt Texture Spray (`balea-sea-salt-texture-spray`).
- Balea Styling Creme Power Flex (Forming Cream Power Flex) (`balea-styling-creme-power-flex`).
- Balea Styling Locken Lotion (`balea-styling-locken-lotion`).
- Balea Styling Spray Ultra Volumen (`balea-styling-spray-ultra-volumen`).
- BALI CURLS HYDRATING CURL CREAM (`bali-curls-hydrating-curl-cream`).
- BALI CURLS Leave-In Spray Curl Defining (Curl Defining Spray) (`bali-curls-leave-in-spray-curl-defining`).
- BALI CURLS Haargel Strong Hold Flaxseed (`bali-curls-strong-hold-flaxseed-gel`).
- BALI GENTS Sea Salt Spray (`bali-gents-sea-salt-spray`).
- cantu SHEA BUTTER COCONUT CURLING CREAM (`cantu-lockencreme-kokos`).
- Cantu Shea Butter for Natural Hair Firm Hold Edge Stay Gel (`cantu-shea-butter-extra-hold-edge-stay-gel`).
- GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray (`garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`).
- GARNIER FRUCTIS LOCKEN METHODE SHAPE REFRESH STEP 4 FEUCHTIGKEITS-BOOST SPRAY (`garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray`).
- got2b Anti-Frizz Lotion Schmusekatze (`got2b-anti-frizz-lotion-schmusekatze`).
- got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) (`got2b-gotgloss-glanz-spray`).
- got2b Schutz-engel Hitzeschutz Spray (`got2b-hitzeschutzspray-schutzengel`).
- got2b Kleber 4 Brows & Edges 2in1 Stylinggel (`got2b-kleber-4-brows-and-edges-2in1-stylinggel`).
- got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) (`got2b-lockenspray-refresher-curlz`).
- GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) (`guhl-foehn-spray-langzeit-volumen`).
- GUHL LOCKEN PFLEGE & STYLING 3in1 LOCKENCREME, KUR & SPÜLUNG (`guhl-locken-pflege-und-styling-3in1`).
- GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY (`guhl-styling-spray-locken-pflege-und-styling-2in1`).
- HASK curls defining cream (`hask-lockencreme-curl-care`).
- Jean&Len Sea Salt Spray (`jean-und-len-sea-salt-spray`).
- John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray (`john-frieda-frizz-ease-3-tage-glatt-styling-spray`).
- John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) (`john-frieda-frizz-ease-traumlocken-lockencreme`).
- John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray (`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray`).
- John Frieda Frizz Ease Zauberformel Seiden-Finish Creme (`john-frieda-frizz-ease-zauberformel-seiden-finish-creme`).
- John Frieda Traumlocken Belebender Wellenauffrischer (`john-frieda-traumlocken-belebender-wellenauffrischer`).
- John Frieda Spray Volume Lift Pushed-up Dry Texture (`john-frieda-volume-lift-pushed-up-dry-texture-spray`).
- Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray (`kerastase-curl-manifesto-refresh-absolu`).
- Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) (`kevin-murphy-killer-curls`).
- KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`).
- LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft (`langhaarmaedchen-lockenspray-halt-sprungkraft`).
- LANGHAARMÄDCHEN Lockenspray Natur Lockenwunder (`langhaarmaedchen-lockenspray-natur-lockenwunder`).
- L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt (`loreal-paris-elnett-haarspray-extra-starker-halt`).
- L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`).
- L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) (`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray`).
- Maria Nila Curlicue Cream (Stylingcreme) (`maria-nila-curlicue-cream`).
- Moroccanoil Anti-Frizz Schild-Spray (Frizz Shield Spray) (`moroccanoil-anti-frizz-schild-spray`).
- Moroccanoil Trockenes Texturspray (Dry Texture Spray) (`moroccanoil-dry-texture-spray`).
- Moroccanoil Glättende Creme (Smoothing Lotion) (`moroccanoil-glaettende-creme-smoothing-lotion`).
- Moroccanoil Volumizing Spray (Volumizing Mist) (`moroccanoil-volumizing-spray`).
- Redken Refreshing Curl Mist (`redken-refreshing-curl-mist`).
- Redken BEACH SPRAY BEACHY TEXTURE SPRAY (`redken-styling-beach-spray`).
- Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`).
- Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY (`schwarzkopf-professional-osis-curl-retouch`).
- Schwarzkopf taft Föhn-Spray VOLUMEN Halt 3 (`schwarzkopf-taft-foehn-spray-volumen-halt-3`).
- Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`).
- Schwarzkopf taft Haarspray CLASSIC Halt 3 (`schwarzkopf-taft-haarspray-classic-halt-3`).
- Schwarzkopf taft Haarspray GLANZ Halt 4 (`schwarzkopf-taft-haarspray-glanz-halt-4`).
- Schwarzkopf taft Haarspray POWER Halt 5 (`schwarzkopf-taft-haarspray-power-halt-5`).
- Schwarzkopf Taft Haargel MATT WAX Halt 5 (`schwarzkopf-taft-matt-wax-halt-5`).
- Schwarzkopf taft Haargel POWER Halt 5 (`schwarzkopf-taft-power-haargel-halt-5`).
- Schwarzkopf taft Schaumfestiger Volumen Halt 4, für feines Haar (`schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`).
- Schwarzkopf taft Styling Balm LOCKEN Halt 3 (`schwarzkopf-taft-styling-balm-locken-halt-3`).
- Schwarzkopf taft Texturspray Aloe Boost (`schwarzkopf-taft-texturspray-aloe-boost`).
- Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine (`schwarzkopf-taft-x-gliss-silky-shine-shine-coat`).
- syoss Curl Cream Gel (`syoss-curl-cream-gel-3in1`).
- syoss Haarspray Max Hold (`syoss-haarspray-max-hold`).
- syoss KERATIN Heat HITZESCHUTZ-SPRAY (`syoss-hitzeschutzspray-keratin-heat`).
- Syoss Max Hold Wax (`syoss-professional-performance-max-hold-power-wax`).
- Syoss Schaumfestiger Volume (`syoss-schaumfestiger-volume`).
- Schwarzkopf taft taft x GLISS Lovely Long MULTITASKING HITZESCHUTZ-SPRAY (`taft-x-gliss-hitzeschutzspray-lovely-long`).
- Wella Professionals EIMI Glam Mist Shinespray (`wella-eimi-glam-mist-shine-spray`).
- Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) (`wella-eimi-nutricurls-curl-shaper`).
- Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion) (`wella-eimi-smooth-perfect-me`).
- Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray) (`wella-eimi-smooth-thermal-image`).
- Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`).
- Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) (`wella-eimi-texture-ocean-spritz`).
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

842 calculation-log cells differ; none blocks. diff.json retains raw and normalized values, exclusions, traces, storage orders, input hashes and scope evidence.

## Lock predicate

| Criterion | Result |
|---|---|
| Every user-facing A/B disagreement is a proven lane error against a clear rule | FAIL |
| No unresolved user-facing rule gaps (b), packet issues (c), or owner questions (d) | FAIL |

**FAIL: 3 unresolved user-facing cells (2 rule-gap, 0 packet-issue, 1 owner-question); proven lane errors and calculation log never block.**

- Known-product targeted MINI r12, not new unseen validation or a full 143-product revalidation.
- Only cohort powders are checked: absent powders, including Redken Powder Grip, remain N/A.
- R11-Q1 named volume exclusion can pass while another secondary strength question remains unresolved.
- Registry-over-letter and alternate-reading concerns on agreed values are latent and non-blocking; no frozen input is corrected.
- Earlier lexicons are provenance; current v0.5 and governing ledger supply authority. No commit, rule amendment, lock activation, catalog or production action.

## Pinned governing quotations

`plans/styling-concept/02-rulings.md:170` (R11-Q1, pinned 0fab88de2b6d)

> | R11-Q1 | **Volume words are a STRONG signal only when volume itself is promised** („für mehr Volumen", „Fülle am Ansatz"); a description of curl quality („Locken voller Sprungkraft", „Sprungkraft" on a curl product) is a WEAK signal (owner). E.g. Balea Pro Styling Cream Traumlocken, Taft Styling Balm Locken ⇒ volume only fills a free secondary slot. |

`plans/styling-concept/02-rulings.md:171` (R11-Q2, pinned 0fab88de2b6d)

> | R11-Q2 | **A form word inside a compound name that already names the job is the form, not a second job** (owner): Wella EIMI Nutricurls „Curl Shaper (Defining Gel Cream)" ⇒ one job, primary `definition`; likewise „Curl Cream Gel". |

`plans/styling-concept/02-rulings.md:168` (R10-Q1, pinned 0fab88de2b6d)

> | R10-Q1 | **Secondary jobs are filled by signal strength (owner's design).** Every job mention in a C1/C2 line is a signal. **Strong signal:** an explicit job promise („für Volumen & Textur", „reduziert Frizz"), a strength word or brand number („starker Halt", „Halt 3"), or a job word in the product name. **Weak signal:** a passing mention without strength or emphasis („mit natürlichem Halt", „spürbarer Halt", „Halt für bis zu 24 Stunden", a look description). The two secondary slots are filled with strong signals first (claim order), then weak signals only if a slot is still free. Pure feel lines never count (R9-Q1). The hold LEVEL is unaffected (no strength ⇒ „keine Herstellerangabe"). E.g. got2b Puder Volumen Powderfull ⇒ primary volume, secondary hold_fix (weak, slot free). Refines RG3-16/R9-Q1. |

`plans/styling-concept/02-rulings.md:169` (R10-Q2, pinned 0fab88de2b6d)

> | R10-Q2 | **„Struktur"/„strukturiert" is a texture word** (owner); as a look description („natürlich strukturierter Look", Bali Gents Haarpuder) it is a weak texture signal under R10-Q1. |

`plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned 0fab88de2b6d)

> | R9-Q1 | **Secondary jobs may come from ANY C1/C2 claim line — promise, finish or other-typed — for every product** (owner); pure feel lines without a result („fühlt sich weich an") never count. Replaces the Puder-only „R9 clarification" written by Claude after round 9 without a ruling (flagged by the independent review) and widens RG2-16/RG4-17 accordingly. E.g. Balea Volumenpuder Pure Styling „griffige Textur direkt am Ansatz" ⇒ texture secondary. |

`plans/styling-concept/02-rulings.md:165` (R9-Q2, pinned 0fab88de2b6d)

> | R9-Q2 | **When several result adjectives stand together, the one matching the named look or subtype leads; otherwise the first** (owner). NEQI Diamond Glass All („intensiv glänzenden, glatten ‚Glass Hair'-Effekt", heat-activated smoothing styler) ⇒ primary `sleek`, secondary `shine`. Vocabulary note: `sleek` = smooth/straight overall look (shape); `shine` = gloss (surface). |

`plans/styling-concept/02-rulings.md:166` (R9-F, pinned 0fab88de2b6d)

> | R9-F | **got2b gotGloss Glanz Spray: capture gap fixed** — got2b.de (C2) states „Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle." (verified 2026-10-14); the line was missing from the claims packet ⇒ add as C2 promise ⇒ `frizz_control` secondary. Round 8's „lane error" on this cell was a packet issue (c). |

`plans/styling-concept/02-rulings.md:167` (R9-P, pinned 0fab88de2b6d)

> | R9-P | **Process fix (Claude, from the independent review):** scoring scripts quote rule text verbatim and broke on every doc edit (H1). From now on each scorer pins the exact doc/ledger git revision it scores against and reads quotes from that revision, so past rounds stay reproducible. round-8's PASS is annotated: its Big Hair Day (13) and Balea MEN Powder (2) cells were owner questions (d), later settled by R8-Q1/R8-Q2. |

`plans/styling-concept/02-rulings.md:161` (R8-Q1, pinned 0fab88de2b6d)

> | R8-Q1 | **L'Oréal Elvital Big Hair Day „Erfrischendes Volumen Spray" ⇒ Dry Shampoo (volume direction)** (owner, after an INCI comparison with the catalog's dry shampoos: same build — propellant + alcohol + oil-absorbing powders near the top (Cellulose r3, Perlite r4), no hold polymer, applied to dry roots; closest to got2b Trockenshampoo Extra Volumen; C1 „Bis zu 48h frischeres Haargefühl"). Reading: a refresh-between-washes promise in the Dry Shampoo sense next to volume is the refresh + volume tie (§4.2 tie precedence) even when the name leads with volume. The Claude-side check of round-8 reclassified this split from „lane error" to an owner question. |

`plans/styling-concept/02-rulings.md:162` (R8-Q2, pinned 0fab88de2b6d)

> | R8-Q2 | **The product noun „Puder"/„Powder" names the `volume` job** (owner, after a cohort check: all 10 hair powders promise volume, 7 also texture/grip, almost always alongside volume). Texture/grip counts as a secondary job where a C1/C2 line promises it; a name that itself names grip (Redken „Powder Grip") is a two-job name and falls to its lead line. Other product nouns keep their §4.2/R4-Q7 mapping. |

`plans/styling-concept/02-rulings.md:163` (R8-H, pinned 0fab88de2b6d)

> | R8-H | **Moroccanoil Glättende Creme: R7-Q2 governs over the stale §4.2 mixed example** — „Definition" for „krauses Haar" with a separate „Ideal für lockiges Haar" is not a curl-definition promise ⇒ not care + definition ⇒ the border rules route it (Leave-in); the stale example is removed (Claude housekeeping from R7-Q2). |

`plans/styling-concept/02-rulings.md:113` (R3-L, pinned 0fab88de2b6d)

> | R3-L | **Lock criterion „lanes agree" (PH1-11) means resolved, not identical.** Styling v1.0 may lock when every remaining A/B disagreement is resolved — either a lane error proven against a clear rule, or the rule gap behind it closed — **and** a final confirmation round shows only lane errors and no new rule gaps. Literal identity of both lanes on every value is not required. |

`plans/styling-concept/02-rulings.md:131` (R4-L, pinned 0fab88de2b6d)

> | R4-L | **Lock scope under R3-L: only differences in user-facing fields block the lock** — route/recommendability (incl. held vs committed, evidence gate), subtype, hold level, weight, finish, flexibility, target zone, application moment, primary and secondary jobs, heat protection, user-shown notes. Differences confined to the **calculation log** (reason code, rule path, internal review triggers, confidence, internal flags, lexicon placements that move no value) do not block: they are fixed in the text and documented, without a further round. Example: Bali Curls Sleek Stick — both lanes agree on every user field; only reason code and rule path differ. |

## Reproduction

Run `node data/research/styling-inci/v1.0/round-12/diff.js --summary` twice with unchanged inputs. Default rule revision is the literal SHA above, never HEAD. Replay override: `--rules-revision=0fab88de2b6de599589a0d63967320b9480154c2`. Only sibling diff.json/report.md are written; there are no timestamps or randomness.

diff.json SHA-256: `e38abb7530744520feb8f81f7d0bf6cd23aeddca8520b5c29500de34c6267b75`.
