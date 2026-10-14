# Styling v1.0 — TARGETED final re-check, cohort r8

**1116/1140 user-facing field cells agree (97.89%). 68/76 products fully agree (89.47%).** The denominator is 76 products × 15 user-facing fields. Route includes held/committed state and boundary reason; application moment compares primary only.

Scope correction: step 1 says 69, the prior r7 cohort size. Frozen r8 and both lanes contain 76 records; this report scores all of them, with no seven-product exclusion. 231 frozen artifacts match their manifest hashes; the selected scope-audit entries and reasons match the cohort.

**Lock verdict: PASS.** Every user-facing difference is a proven lane error; no b/c/d user-facing cells remain.

24 disagreement cells on 8 products: **a=24, b=0, c=0, d=0**. Lane errors by wrong lane: A=4, B=20. Counts are field cells, not distinct policy issues; consequential secondary changes from a wrong primary remain separate cells.

Governing lock authority: `plans/styling-concept/02-rulings.md:113` (R3-L); `plans/styling-concept/02-rulings.md:131` (R4-L); `plans/styling-concept/02-rulings.md:156` (LOCK-1-S). The requested targeted-set criterion allows proven lane errors, requires zero b/c/d user-facing differences, and excludes calculation-log fields. Latent reports do not change this verdict.

## Ruling-effect check

27/27 present named outcome checks pass in both lanes. This tests the specified ruling fields; it does not claim complete profile agreement on those products. R7-Q3 checks that emitted jobs have independent own-name/claim evidence; collection-only jobs are forbidden. Suppressed profiles cannot establish hidden name parsing. The two R6-T zone exemplars absent from r8 are explicitly N/A.

| Ruling | Product / slug | Expected | A actual | B actual | Landed A / B | Other user disagreements / scope note |
|---|---|---|---|---|---|---|
| R7-Q1 | wellaflex Schaumfestiger Locken & Wellen, Starker Halt<br>`wellaflex-schaumfestiger-locken-und-wellen-starker-halt` | {"primary_job":"definition"} | {"primary_job":"definition"} | {"primary_job":"definition"} | yes / yes | none |
| R7-Q2 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme)<br>`kevin-murphy-killer-curls` | {"secondary_jobs_includes":"definition"} | {"secondary_jobs":["definition","frizz_control"]} | {"secondary_jobs":["definition","frizz_control"]} | yes / yes | none |
| R7-Q2 | BALI GENTS Sea Salt Spray<br>`bali-gents-sea-salt-spray` | {"secondary_jobs_excludes":"definition"} | {"secondary_jobs":[]} | {"secondary_jobs":[]} | yes / yes | none |
| R7-Q2 | Balea Leave-In Spray Sea Salt Care & Define<br>`balea-leave-in-spray-sea-salt-care-define` | {"secondary_jobs_excludes":"definition"} | {"secondary_jobs":[]} | {"secondary_jobs":[]} | yes / yes | none |
| R7-F | NEQI Diamond Glass Ultimate Styling Spray<br>`neqi-diamond-glass-ultimate-styling-spray` | {"primary_job":null} | {"primary_job":null} | {"primary_job":null} | yes / yes | none |
| M2 | Maria Nila Curlicue Cream (Stylingcreme)<br>`maria-nila-curlicue-cream` | {"secondary_jobs_includes":"hold_fix"} | {"secondary_jobs":["hold_fix","volume"]} | {"secondary_jobs":["hold_fix","volume"]} | yes / yes | none |
| M2 | Bumble and bumble brilliantine<br>`bumble-and-bumble-brilliantine` | {"primary_job":"shine"} | {"primary_job":"shine"} | {"primary_job":"shine"} | yes / yes | none |
| M2 | Balea MEN Pomade Haar & Bart 2in1<br>`balea-men-pomade-haar-bart-2in1` | {"secondary_jobs_excludes":"definition"} | {"secondary_jobs":[]} | {"secondary_jobs":[]} | yes / yes | none |
| R6-Q1 | John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray<br>`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | yes / yes | none |
| R6-Q1 | NEQI Diamond Glass Ultimate Styling Spray<br>`neqi-diamond-glass-ultimate-styling-spray` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | yes / yes | none |
| R6-Q1 | NEQI Diamond Glass Styling Spray All<br>`neqi-diamond-glass-styling-spray-all` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | yes / yes | primary_job, secondary_jobs |
| R6-T (1) | balea-pure-styling-volumenpuder-spray<br>`balea-pure-styling-volumenpuder-spray` | {"target_zone":"roots"} | null | null | N/A / N/A | none<br>Not present in frozen targeted r8; not scored or imported from r7. |
| R6-T (2) | redken-root-tease<br>`redken-root-tease` | {"target_zone":"all"} | null | null | N/A / N/A | none<br>Not present in frozen targeted r8; not scored or imported from r7. |
| R6-T (3) | alverde NATURKOSMETIK Beach Waves Spray Seaside Balance<br>`alverde-beach-waves-spray-seaside-balance` | {"secondary_jobs_excludes":"definition"} | {"secondary_jobs":[]} | {"secondary_jobs":[]} | yes / yes | none |
| R7-Q3 | Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray)<br>`balea-professional-definier-spray-traumlocken` | {"jobs_allowed":["definition"],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Definier Spray names definition; Leave-in suppresses the Styling profile.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | Balea PROFESSIONAL Styling Cream Traumlocken<br>`balea-professional-styling-cream-traumlocken` | {"jobs_allowed":["definition","frizz_control","shine"],"primary_job":"definition"} | {"primary_job":"definition","secondary_jobs":["frizz_control","shine"]} | {"primary_job":"definition","secondary_jobs":["frizz_control","shine"]} | yes / yes | none<br>Styling Cream is generic; explicit C1 defined curls leads.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme)<br>`john-frieda-frizz-ease-traumlocken-lockencreme` | {"jobs_allowed":["definition","frizz_control"],"primary_job":"definition"} | {"primary_job":"definition","secondary_jobs":["frizz_control"]} | {"primary_job":"definition","secondary_jobs":["frizz_control"]} | yes / yes | none<br>Own Lockencreme supplies definition; explicit Verhindert Frizz supplies secondary.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | John Frieda Traumlocken Belebender Wellenauffrischer<br>`john-frieda-traumlocken-belebender-wellenauffrischer` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Own Wellenauffrischer is refresh, but named mixed route suppresses profile.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | John Frieda Spray Volume Lift Pushed-up Dry Texture<br>`john-frieda-volume-lift-pushed-up-dry-texture-spray` | {"jobs_allowed":["texture","volume"],"primary_job":"texture"} | {"primary_job":"texture","secondary_jobs":["volume"]} | {"primary_job":"texture","secondary_jobs":["volume"]} | yes / yes | none<br>Own Dry Texture leads; explicit C1 Fülle und Volumen supplies volume.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | John Frieda Volume Lift Ansatz-Booster<br>`john-frieda-volume-lift-ansatz-booster` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Formula-conflict gate suppresses all Styling jobs before name parsing.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray<br>`garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Own Glättungsspray names sleek; substantive care routes Leave-in and suppresses Styling jobs.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray<br>`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | {"jobs_allowed":["frizz_control","shine","sleek"],"primary_job":"sleek"} | {"primary_job":"sleek","secondary_jobs":["frizz_control","shine"]} | {"primary_job":"sleek","secondary_jobs":["frizz_control","shine"]} | yes / yes | none<br>Own Smooth supplies sleek; separate C2 body promises frizz control and shine.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme<br>`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | {"jobs_allowed":["frizz_control","shine"],"primary_job_any_of":["shine","frizz_control"]} | {"primary_job":"shine","secondary_jobs":["frizz_control"]} | {"primary_job":"frizz_control","secondary_jobs":["shine"]} | yes / yes | application_moment, primary_job, secondary_jobs<br>Own Finish and explicit flyaway sentence supply jobs. Both exclude the collection; their name-versus-sentence order dispute is adjudicated separately.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray<br>`john-frieda-frizz-ease-3-tage-glatt-styling-spray` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Own 3-Tage-Glatt names sleek; li_g0_provisional suppresses Styling profile.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | John Frieda Frizz Ease DER BÄNDIGER EXTRA STRONG SERUM<br>`john-frieda-haarserum-frizz-ease-der-baendiger` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Own Serum plus explicit anti-frizz promise routes Oil, suppressing Styling jobs.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray<br>`balea-professional-glow-und-shine-finishing-spray` | {"jobs_allowed":["frizz_control","shine"],"primary_job":"shine"} | {"primary_job":"shine","secondary_jobs":["frizz_control"]} | {"primary_job":"shine","secondary_jobs":["frizz_control"]} | yes / yes | none<br>Own Finishing Spray supplies shine; explicit C2 anti-frizz supplies secondary.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | Balea PROFESSIONAL Haarserum Glow & Shine<br>`balea-professional-haarserum-glow-und-shine` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Own Haarserum plus explicit finish line reaches aqueous-conditioner Leave-in exception.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |
| R7-Q3 | Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream)<br>`wella-eimi-nutricurls-curl-shaper` | {"jobs_allowed":["definition","frizz_control","hold_fix"],"primary_job":"definition"} | {"primary_job":"definition","secondary_jobs":["frizz_control","hold_fix"]} | {"primary_job":"definition","secondary_jobs":["frizz_control","hold_fix"]} | yes / yes | none<br>Own Curl Shaper and C2 hold/anti-frizz supply jobs; collection adds none.<br>Allowed jobs have independent own-name/claim evidence; final order is scored separately. |
| R7-Q3 | Wella Professionals EIMI Nutricurls Fresh Up<br>`wella-eimi-nutricurls-fresh-up` | {"jobs_allowed":[],"primary_job":null} | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes | none<br>Explicit C2 curl refresh supplies positioning; substantive care routes Leave-in, suppressing Styling jobs.<br>No emitted Styling jobs; outcome confirms suppression, not hidden pre-gate name parsing. |

R6/R7 sources: `plans/styling-concept/02-rulings.md:148` (R6-Q1); `plans/styling-concept/02-rulings.md:149` (R6-T); `plans/styling-concept/02-rulings.md:157` (R7-F); `plans/styling-concept/02-rulings.md:158` (R7-Q1); `plans/styling-concept/02-rulings.md:159` (R7-Q2); `plans/styling-concept/02-rulings.md:160` (R7-Q3). Ultimate retains its frozen FX-1 member; the named owner override governs its route without changing ingredient membership.

## Rule gaps (b)

None.

## Owner questions (d)

None.

## Packet issues (c)

None.

## Proven lane errors (a)

### Balea MEN Styling Powder — primary_job

`balea-men-styling-powder` · `sty-394c070222` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "volume" | {"rule_path":["§4.1 gate passed (house-brand C2)","§4.2 step1: name „Styling Powder\" one product noun (Puder) ⇒ styling_result; promise volume/texture ⇒ li_function no","aqueous (Aqua r3 above T_S) ⇒ 3.4(ii) ⇒ styling directly, no Leave-in check, not held","§5 hair_powder (powder form, dry, roots/grip)"],"reason_code":"pair_3.4ii_no_leave_in_function","boundary_reason":null,"hold_basis":"house-brand C2 dm attribute „starker Halt\" ⇒ 3 (PH2-7); stored only (hair_powder)","notes":"Lead (name) supplies no vocabulary job; first job-bearing C1/C2 line „Für Volumen & Textur\" ⇒ primary volume (R7-F), texture next; hold_fix from the typed house-brand hold line (RG3-16). Gates ✓ (particulate, natural_film). Carrageenan NF-U (aqueous) ⇒ natural_film + natural_film_unsettled. Finish matt (C2 „Matt-Effekt\", „mattes Finish\"). Flexibility beweglich (C2 „flexibles Styling\"). Directions: worked into dry hair (einarbeiten) ⇒ dry_restyle; Ansatz step is conditional („Für maximales Volumen\") ⇒ zone all (R6-T(1))."} |
| B (Codex) | "hold_fix" | {"rule_path":["§4.1","§4.2: Styling Powder","3.4(ii)","§5"],"reason_code":"3.4(ii)","boundary_reason":null,"hold_basis":"C2_house_brand starker Halt → 3.","notes":["Silica Silylate r2; aqueous Carrageenan r4. Required whole-hair application controls zone; direct roots application is optional."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:441` (§4.2 name jobs); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `plans/styling-concept/02-rulings.md:157` (R7-F); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

§4.2 explicitly includes Puder as a job-bearing product-type noun; §6.10 maps a product noun to hold_fix. The short illustrative molding-noun list is not an exception to this generic rule. Styling Powder therefore supplies a vocabulary job and R7-F cannot skip it. B hold_fix is primary; the C2 promise supplies volume then texture, both passing particulate/natural_film gates. A incorrectly falls through to the later volume promise and moves the real primary hold_fix into secondary jobs.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Frozen evidence:** “Für Volumen & Textur” (C2_house_brand, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-394c070222.json`.

### Balea MEN Styling Powder — secondary_jobs

`balea-men-styling-powder` · `sty-394c070222` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["hold_fix","texture"] | {"rule_path":["§4.1 gate passed (house-brand C2)","§4.2 step1: name „Styling Powder\" one product noun (Puder) ⇒ styling_result; promise volume/texture ⇒ li_function no","aqueous (Aqua r3 above T_S) ⇒ 3.4(ii) ⇒ styling directly, no Leave-in check, not held","§5 hair_powder (powder form, dry, roots/grip)"],"reason_code":"pair_3.4ii_no_leave_in_function","boundary_reason":null,"hold_basis":"house-brand C2 dm attribute „starker Halt\" ⇒ 3 (PH2-7); stored only (hair_powder)","notes":"Lead (name) supplies no vocabulary job; first job-bearing C1/C2 line „Für Volumen & Textur\" ⇒ primary volume (R7-F), texture next; hold_fix from the typed house-brand hold line (RG3-16). Gates ✓ (particulate, natural_film). Carrageenan NF-U (aqueous) ⇒ natural_film + natural_film_unsettled. Finish matt (C2 „Matt-Effekt\", „mattes Finish\"). Flexibility beweglich (C2 „flexibles Styling\"). Directions: worked into dry hair (einarbeiten) ⇒ dry_restyle; Ansatz step is conditional („Für maximales Volumen\") ⇒ zone all (R6-T(1))."} |
| B (Codex) | ["texture","volume"] | {"rule_path":["§4.1","§4.2: Styling Powder","3.4(ii)","§5"],"reason_code":"3.4(ii)","boundary_reason":null,"hold_basis":"C2_house_brand starker Halt → 3.","notes":["Silica Silylate r2; aqueous Carrageenan r4. Required whole-hair application controls zone; direct roots application is optional."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:441` (§4.2 name jobs); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `plans/styling-concept/02-rulings.md:157` (R7-F); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

§4.2 explicitly includes Puder as a job-bearing product-type noun; §6.10 maps a product noun to hold_fix. The short illustrative molding-noun list is not an exception to this generic rule. Styling Powder therefore supplies a vocabulary job and R7-F cannot skip it. B hold_fix is primary; the C2 promise supplies volume then texture, both passing particulate/natural_film gates. A incorrectly falls through to the later volume promise and moves the real primary hold_fix into secondary jobs.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Frozen evidence:** “Für Volumen & Textur” (C2_house_brand, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-394c070222.json`.

### BALI CURLS Volumizing Curl Spray — secondary_jobs

`bali-curls-volumizing-curl-spray-refreshing` · `sty-84a5d409d7` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["texture","volume"] | {"rule_path":["§4.1 gate passed (C2)","§4.2: name „Volumizing Curl Spray\" has two job words (volume + curl) ⇒ step 3 first C2 line: „… erfrischt deine Locken und verleiht einen … Beachlook\" ⇒ curl revival (refresh) ⇒ styling_result, li_function yes","3.4 aqueous; (i) no FX; (i′) no","3.4(iii) LI G0 in_category","D6: no FX ✓; no real care above T_LI (Magnesium Sulfate, polyglyceryl esters, Glycerin) and no cationic ✓; styling-look ✓ ⇒ styling refresher","§4.5 held"],"reason_code":"d6_fired_pending_leave_in_addendum","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 hold claim ⇒ null","notes":"Provisional profile. Secondaries: name word „Volumizing\" ⇒ volume (gate ✓ salt); „Curl\" reads as revival (same job as primary); C2 „Beachlook\" ⇒ texture (R4-Q2; „voluminösen\" is an adjective, R7-Q1); gate ✓ salt. Maris Sal r10 below T_S. Directions: equal alternatives nass/trocken ⇒ damp primary; spray from ends to Ansatz = range ⇒ all."} |
| B (Codex) | ["volume"] | {"rule_path":["§4.1","§4.2: C2 revival lead","3.4(iii)/D6","§4.5"],"reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["provisional; lean_route=styling; not recommendable.","Magnesium Sulfate r2 supplies salt. Curl revival is refresh; also=dry_finish. Required tips-to-roots range gives all."]} |

**Rules:** `plans/styling-concept/02-rulings.md:133` (R4-Q2); `docs/research/styling-inci/v1.0/styling-classification-standard.md:441` (§4.2 beach look); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed Volumizing Curl Spray name supplies volume after the curl-revival refresh primary. The explicit C2 Beachlook is the ruled beach texture look, not curl definition; it supplies the next texture candidate. Magnesium Sulfate r2 supplies salt, passing both gates. B omits the explicit texture candidate.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Das vegane VOLUMIZING CURL SPRAY mit Reisprotein und Ylang-Ylang-Extrakt erfrischt deine Locken und verleiht einen wundervollen und voluminösen Beachlook. Der einzigartige Duft bringt dir das Sommergefühl aus Bali direkt nach Hause in dein Badezimmer.” (C2, promise); “wundervollen und voluminösen Beachlook” (C2, finish). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-84a5d409d7.json`.

### cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER — finish

`cantu-lockenspray-comeback-curl-next-day` · `sty-0f1a6f7913` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "glänzend" | {"rule_path":["§4.1 gate passed (C1 pack line + C1 name; C3 directions verbatim; INCI complete)","§4.2 step1: C1 name „COMEBACK CURL NEXT DAY CURL REVITALIZER\": curl + revitalizer + next day = one job, curl revival (refresh); „Shea Butter\" line/ingredient word ⇒ styling_result, li_function yes","3.4 aqueous; (i) no fixative; (i′) no","3.4(iii) LI G0 in_category (curl support, no L5)","D6: no FX ✓; no real care above T_LI (Glycerin HU-1, Polysorbate 20 EM-1; Shea r10 below T_LI; no cationic) ✓; C1 „refreshes curls & adds shine\" styling-look ✓ ⇒ styling refresher","§4.5 LI letter in_category ⇒ held"],"reason_code":"d6_fired_pending_leave_in_addendum","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 strength statement ⇒ null","notes":"candidate_below_tail: Magnesium Sulfate r7 (salt mechanism) and Shea r10 (weight family) below T_S r4. Directions C3 (dm): sprayed strand by strand to revive, no shaping act ⇒ dry_finish (RG2-8, alverde precedent), feucht ⇒ also. Finish glänzend from C1 „adds shine\" (English pack text C1, RG4-23)."} |
| B (Codex) | "unbekannt" | {"rule_path":["§4.1","§4.2: curl revival","3.4(iii)","D6","§4.5"],"reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["provisional; lean_route=styling; not recommendable.","also=damp_before_drying. C1 shine secondary fails humectant-only gate; magnesium sulfate and Shea are below T_S."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:729` (§6.8); `docs/research/styling-inci/v1.0/styling-classification-standard.md:335` (§2.2 A13). Exact cited clauses and full frozen evidence are retained in diff.json.

The frozen German-market pack claim is C1 even though it is English: adds shine explicitly sets glänzend. The secondary shine job fails the humectant_only formula gate in both lanes; that gate does not suppress the independent claim-only finish. B omits the finish evidence.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “refreshes curls & adds shine” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-0f1a6f7913.json`.

### got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) — secondary_jobs

`got2b-gotgloss-glanz-spray` · `sty-17208daac3` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | [] | {"rule_path":["§4.1 gate passed (verified_with_minor_source_difference: captures differ only in the fragrance block)","§4.2 step1: name „Glanz Spray got Gloss\": Glanz + Gloss = one job (shine) ⇒ styling_result, li_function no","3.1 shine lead, not Öl/Serum ⇒ continue","non-aqueous: Butane r1, Aqua r9 below T_S ⇒ 3.5 ⇒ styling, not held","§5 shine lead ⇒ shine_finish whatever the moment (RG2-15)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 strength statement ⇒ null (stored only)","notes":"Alcohol denat. r3 in first 3. Weight medium: one family (a) esters r4–r5; Isododecane VC-2. Benzyl Alcohol r14 after Parfum ⇒ allergen, never T_LI. Directions C3 (dm): applied to dry hair, then flat iron ⇒ before_heat; optional finishing re-spray ⇒ also dry_finish; „Glätten um den Glanz zu verstärken\" is a usage step, not heat activation (R1-Q4). Finish from C2 „spiegelglänzendes Haar\". Humidity line „Bis zu 48h Frizz-Effekt\" is typed humidity (not a promise line) and has no explicit anti-frizz word ⇒ no secondary."} |
| B (Codex) | ["frizz_control"] | {"rule_path":["§4.1","§4.2: Glanz Spray","3.5","§5"],"reason_code":"3.5","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["One ester family r4/r5. Explicit Frizz wording in C2 humidity claim supplies secondary; differences confined to fragrance tail."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

The typed humidity line says Frizz-Effekt, without anti-frizz, reduction, taming or protection against frizz. The exception requires an explicit anti-frizz direction, not bare Frizz. B adds a direction not stated in the frozen packet. There is no evidence that the captured quotation is wrong, so this is a lane error, not a packet issue.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Bis zu 48h Frizz-Effekt” (C2, humidity). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-17208daac3.json`.

### John Frieda Frizz Ease Zauberformel Seiden-Finish Creme — application_moment

`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` · `sty-a51348aa76` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "dry_finish" | {"rule_path":["§4.1 gate passed (C2); in-name spacing repaired, possible truncation only in the fragrance block ⇒ inci_tail_defect, no block","§4.2 step1: „Frizz Ease\" brand line (R7-Q3), „Zauberformel\" a formula label (RG4-10); „Seiden-Finish Creme\" ⇒ one job, finish/shine ⇒ styling_result","flyaway/frizz control on dry, finished hair by the main directions („Im trockenen Haar verteilen … abstehende Härchen\") ⇒ shine-finish job, li_function no (R1-Q2)","3.1 not Öl/Serum ⇒ continue; aqueous ⇒ 3.4(ii) ⇒ styling, not held","§5 shine_finish"],"reason_code":"pair_3.4ii_no_leave_in_function","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"Weight rich: family a (Avocado r3 rich band + esters) and family d (Phenyl Trimethicone r4) ⇒ ≥2 families with a rich member; buildup limb2. Secondary frizz_control from C2 „Glättet abstehende Haare … bändigt Frizz\" (gate ✓). Ambiguity: if „Seiden-Finish\" were read as a finish grade only, the name would name no job and the first C2 line would lead ⇒ primary frizz_control, secondary shine. Directions: distributed in dry hair, emphasis on flyaways/ends inside a whole-hair instruction ⇒ dry_finish, all (RG2-10)."} |
| B (Codex) | "dry_restyle" | {"rule_path":["§4.1: tail-only defect","R7-Q3","§4.2: explicit flyaway control","3.4(ii)/R1-Q2","§5"],"reason_code":"3.4(ii)/R1-Q2","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["§6.10 anchors Glättet abstehende Haare to frizz_control; Seiden is feel. Rich Avocado Oil r3 plus silicone r4.","Whole-hair hand application with flyaway/tip emphasis stays all; tail-only truncation passes."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:759` (§6.11). Exact cited clauses and full frozen evidence are retained in diff.json.

The required directions say to rub between the palms and distribute in dry hair. This is the express cream-worked-in-by-hand dry_restyle case; a finishing purpose does not override that required act. A dry_finish misses the specific rule.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Frozen evidence:** “Glättet abstehende Haare, verleiht Glanz und bändigt Frizz.” (C2, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-a51348aa76.json`.

### John Frieda Frizz Ease Zauberformel Seiden-Finish Creme — primary_job

`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` · `sty-a51348aa76` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "shine" | {"rule_path":["§4.1 gate passed (C2); in-name spacing repaired, possible truncation only in the fragrance block ⇒ inci_tail_defect, no block","§4.2 step1: „Frizz Ease\" brand line (R7-Q3), „Zauberformel\" a formula label (RG4-10); „Seiden-Finish Creme\" ⇒ one job, finish/shine ⇒ styling_result","flyaway/frizz control on dry, finished hair by the main directions („Im trockenen Haar verteilen … abstehende Härchen\") ⇒ shine-finish job, li_function no (R1-Q2)","3.1 not Öl/Serum ⇒ continue; aqueous ⇒ 3.4(ii) ⇒ styling, not held","§5 shine_finish"],"reason_code":"pair_3.4ii_no_leave_in_function","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"Weight rich: family a (Avocado r3 rich band + esters) and family d (Phenyl Trimethicone r4) ⇒ ≥2 families with a rich member; buildup limb2. Secondary frizz_control from C2 „Glättet abstehende Haare … bändigt Frizz\" (gate ✓). Ambiguity: if „Seiden-Finish\" were read as a finish grade only, the name would name no job and the first C2 line would lead ⇒ primary frizz_control, secondary shine. Directions: distributed in dry hair, emphasis on flyaways/ends inside a whole-hair instruction ⇒ dry_finish, all (RG2-10)."} |
| B (Codex) | "frizz_control" | {"rule_path":["§4.1: tail-only defect","R7-Q3","§4.2: explicit flyaway control","3.4(ii)/R1-Q2","§5"],"reason_code":"3.4(ii)/R1-Q2","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["§6.10 anchors Glättet abstehende Haare to frizz_control; Seiden is feel. Rich Avocado Oil r3 plus silicone r4.","Whole-hair hand application with flyaway/tip emphasis stays all; tail-only truncation passes."]} |

**Rules:** `plans/styling-concept/02-rulings.md:160` (R7-Q3); `docs/research/styling-inci/v1.0/styling-classification-standard.md:441` (§4.2 shine nouns); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

Frizz Ease is excluded, Seiden is a feel modifier and Zauberformel a formula label; Finish remains the product own shine job noun. The one-job confirmed name leads before C2 sentences. Thus A shine is primary and Glättet abstehende Haare/bändigt Frizz supplies frizz_control secondary, passing wax_lipid/silicone_coat. The §6.10 flyaway example maps that sentence to frizz_control but does not name it the primary or override name precedence. B wrongly promotes the later sentence over the name.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Glättet abstehende Haare, verleiht Glanz und bändigt Frizz.” (C2, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-a51348aa76.json`.

### John Frieda Frizz Ease Zauberformel Seiden-Finish Creme — secondary_jobs

`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` · `sty-a51348aa76` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["frizz_control"] | {"rule_path":["§4.1 gate passed (C2); in-name spacing repaired, possible truncation only in the fragrance block ⇒ inci_tail_defect, no block","§4.2 step1: „Frizz Ease\" brand line (R7-Q3), „Zauberformel\" a formula label (RG4-10); „Seiden-Finish Creme\" ⇒ one job, finish/shine ⇒ styling_result","flyaway/frizz control on dry, finished hair by the main directions („Im trockenen Haar verteilen … abstehende Härchen\") ⇒ shine-finish job, li_function no (R1-Q2)","3.1 not Öl/Serum ⇒ continue; aqueous ⇒ 3.4(ii) ⇒ styling, not held","§5 shine_finish"],"reason_code":"pair_3.4ii_no_leave_in_function","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"Weight rich: family a (Avocado r3 rich band + esters) and family d (Phenyl Trimethicone r4) ⇒ ≥2 families with a rich member; buildup limb2. Secondary frizz_control from C2 „Glättet abstehende Haare … bändigt Frizz\" (gate ✓). Ambiguity: if „Seiden-Finish\" were read as a finish grade only, the name would name no job and the first C2 line would lead ⇒ primary frizz_control, secondary shine. Directions: distributed in dry hair, emphasis on flyaways/ends inside a whole-hair instruction ⇒ dry_finish, all (RG2-10)."} |
| B (Codex) | ["shine"] | {"rule_path":["§4.1: tail-only defect","R7-Q3","§4.2: explicit flyaway control","3.4(ii)/R1-Q2","§5"],"reason_code":"3.4(ii)/R1-Q2","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["§6.10 anchors Glättet abstehende Haare to frizz_control; Seiden is feel. Rich Avocado Oil r3 plus silicone r4.","Whole-hair hand application with flyaway/tip emphasis stays all; tail-only truncation passes."]} |

**Rules:** `plans/styling-concept/02-rulings.md:160` (R7-Q3); `docs/research/styling-inci/v1.0/styling-classification-standard.md:441` (§4.2 shine nouns); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

Frizz Ease is excluded, Seiden is a feel modifier and Zauberformel a formula label; Finish remains the product own shine job noun. The one-job confirmed name leads before C2 sentences. Thus A shine is primary and Glättet abstehende Haare/bändigt Frizz supplies frizz_control secondary, passing wax_lipid/silicone_coat. The §6.10 flyaway example maps that sentence to frizz_control but does not name it the primary or override name precedence. B wrongly promotes the later sentence over the name.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Glättet abstehende Haare, verleiht Glanz und bändigt Frizz.” (C2, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-a51348aa76.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — route

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | {"destination":"styling","state":"committed","boundary_reason":null} | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:476` (§4.3 3.2). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — subtype

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "texture_spray" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:636` (§5). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — weight

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "light" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:679` (§6.3). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — finish

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "unbekannt" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:729` (§6.8). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — flexibility

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "unbekannt" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:740` (§6.9). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — target_zone

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "roots" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:765` (§6.12). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — application_moment

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "dry_restyle" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:759` (§6.11). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — primary_job

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "volume" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — secondary_jobs

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | [] | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — provides_heat_protection

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | false | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:718` (§6.7). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — heat_activated

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "no" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:771` (§6.13). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — alcohol_note

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "fires" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:703` (§6.5). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) — buildup_note

`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` · `sty-72c03a9dc5` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "does_not_fire" | {"rule_path":["§4.1 gate passed (C1 name/lines; C3 directions; C3 INCI)","§4.2 step1: name „Volumenspray Big Hair Day (Erfrischendes Volumen Spray)\": „Big Hair Day\" slogan (no job); „Erfrischendes\" is an adjective before the job phrase (R7-Q1) ⇒ one job, volume ⇒ styling_result, li_function no","no refresh-class lead and no oil-absorption/cleansing positioning ⇒ 3.2 does not apply","non-aqueous: Aqua r24 below leading Dimethyl Ether r1 ⇒ 3.5 ⇒ styling, not held","§5 texture_spray: volume lead, dry, worked in by hand, particles dispensed as aerosol (RG4-13)"],"reason_code":"pair_3.5_non_aqueous","boundary_reason":null,"hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"AMBIGUOUS ROUTE: if „ERFRISCHENDES\" + C1 „Bis zu 48h frischeres Haargefühl\" were read as a co-equal Dry-Shampoo freshness job, tie precedence would give class refresh ⇒ 3.2 ⇒ dry_shampoo; R7-Q1 (adjective ≠ own job) and „Haargefühl\" = feel line led to volume. T_S: Dimethyl Phenethyl Acetate r10 is an aroma chemical above the list's own Parfum r29 ⇒ unresolved; Limonene/Linalool r11–r12 also allergens above Parfum; next consistent marker Benzyl Alcohol r13 (PR-1 above Parfum); R1/R2 give the same values. Perlite r4 and Stearalkonium Hectorite r6 not lexicon members (recorded E1). Directions: dry, Ansatz, „mit den Fingern einmassieren\" ⇒ dry_restyle; second Ansatz spray „für mehr Volumen\" optional ⇒ roots."} |
| B (Codex) | null | {"rule_path":["§4.1","§4.2: freshness-plus-volume tie","3.2"],"reason_code":"3.2","boundary_reason":null,"hold_basis":null,"notes":["Erfrischendes Volumen Spray joins hair freshness and volume; Dry Shampoo tie wins. Big Hair Day supplies no job.","R2 marker Benzyl Alcohol r13; Parfum r29."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:451` (§4.2 lead precedence); `docs/research/styling-inci/v1.0/styling-classification-standard.md:584` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:692` (§6.4). Exact cited clauses and full frozen evidence are retained in diff.json.

The confirmed ERFRISCHENDES VOLUMEN SPRAY has volume as its job phrase; the preceding adjective is not an independent freshness job under governing R7-Q1. Big Hair Day is a slogan. The later frischeres Haargefühl is a feel/duration line, not a co-equal name lead. No independent oil-absorption/cleansing positioning triggers 3.2. Non-aqueous aerosol volume/particles gives committed texture_spray. Cellulose r3 is particulate; no persistent weight family or buildup limb is present. Alcohol Denat. r2 fires alcohol_note. Required dry-root finger massage gives roots/dry_restyle; no C1/C2 heat claim, activation, finish, flexibility or gated secondary job exists. A matches the derived profile; B suppresses this field as a consequence of its wrong Dry Shampoo route.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “ERFRISCHENDES VOLUMEN SPRAY” (C1, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-72c03a9dc5.json`.

### Moroccanoil Glättende Creme (Smoothing Lotion) — route

`moroccanoil-glaettende-creme-smoothing-lotion` · `sty-3176986dee` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | {"destination":"provisional_boundary","state":"blocked:mixed_promise","boundary_reason":"mixed_promise"} | {"rule_path":["§4.1 gate passed (C2)","§4.2: name „Glättende Creme (Smoothing Lotion)\" names smoothing; C2 lead „pflegende … Stylingcreme bändigt … verleiht … Geschmeidigkeit und Definition … um trockenes Haar zu pflegen … Ideal für lockiges … Haar\": care job „pflegen\" + Definition for curly hair ⇒ mixed (R1-Q3 wins over R3-Q3; §4.2 names this record as mixed)","mixed stop: D7 straightening limb 3′ needs FX-1…FX-4 above T_S — none (PQ-70 CA-3, PQ-11 FX-R) ⇒ no; (i′) no Polysilicone-29/SiQ-18","⇒ provisional_boundary (mixed_promise), stays in current category"],"reason_code":"mixed_promise","boundary_reason":"mixed_promise","hold_basis":null,"notes":"No Styling values (§4.7). Ambiguity: whether „Definition\" here is curl definition under R7-Q2/R6-T(3) (krauses Haar; „Ideal für lockiges Haar\"); §4.2 still lists this record as mixed."} |
| B (Codex) | {"destination":"leave_in","state":"route:leave_in","boundary_reason":null} | {"rule_path":["R7-Q2","§4.2: one-job smoothing name","3.4(iii)","D6: real care"],"reason_code":"3.4(iii)","boundary_reason":null,"hold_basis":null,"notes":["Generic hair Definition plus curl suitability is not an explicit curl-definition promise under R7-Q2; older mixed example is superseded.","Smoothing name leads; real care without a fixative retains Leave-in."]} |

**Rules:** `plans/styling-concept/02-rulings.md:159` (R7-Q2); `docs/research/styling-inci/v1.0/styling-classification-standard.md:7` (authority); `docs/research/styling-inci/v1.0/styling-classification-standard.md:459` (§4.2 definition half); `docs/research/styling-inci/v1.0/styling-classification-standard.md:493` (§4.3 3.4(iii)). Exact cited clauses and full frozen evidence are retained in diff.json.

Generic hair Definition followed by a separate suitability statement Ideal für lockiges Haar does not explicitly promise to define/shape curls or waves. Governing R7-Q2 removes the old care-plus-definition mixed reading. With substantive care and no qualifying fixative the border routes Leave-in. B follows the ledger; A follows the stale specific mixed example. The hierarchy is explicit and no owner registry exception names this product, so the stale example is a documentation correction rather than an unresolved policy choice.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Stale worked example:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:460` (§4.2 stale example); the explicit current rule and governing ledger take precedence.

**Frozen evidence:** “Diese pflegende und dennoch leichte Stylingcreme bändigt krauses und widerspenstiges Haar und verleiht ihm den ganzen Tag lang Geschmeidigkeit und Definition. Sie ist mit Arganöl, Arganbutter, Vitamin E und essentiellen Fettsäuren angereichert, um trockenes Haar zu pflegen und es fühlbar weich und spürbar glatt zu machen. Ideal für lockiges, mittelstarkes und grobes Haar.” (C2, promise). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-3176986dee.json`.

### NEQI Diamond Glass Styling Spray All — primary_job

`neqi-diamond-glass-styling-spray-all` · `sty-f3c09d13ab` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "sleek" | {"rule_path":["§4.1 gate passed (C2; complete 14-item INCI, R2-H4)","§4.2: „Diamond Glass\" line, „Styling Spray All\" no job ⇒ name decides nothing; first C2 line „… verleiht dem Haar einen [intensiv glänzenden,] glatten „Glass Hair\"-Effekt\" ⇒ sleek (the shine adjective before the job phrase is not its own job, R7-Q1) ⇒ styling_result, li_function yes","3.4 aqueous; (i) no FX; (i′) Polysilicone-29 r7 main active ✓, no care above the first preservative/LI cutoff Ethylhexylglycerin r8 ✓, no FX ✓ ⇒ smoothing_styler","§4.5 held (R6-Q1)"],"reason_code":"r6q1_heat_activated_smoothing_film_pending_leave_in_addendum","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"Provisional profile. T_S EHG r8 booster above the only PR-1 Hydroxyacetophenone r9 ⇒ unresolved; no species between ⇒ same values. Weight medium (family d). candidate_below_tail: Silicone Quaternium-18 r10 (buildup limb1). No fragrance declared. heat_activated yes (C2 „hitzeaktivierten Polymere\"). Finish glänzend (C2 „intensiv glänzenden\"). frizz_control from C2 „reduziert Frizz\" (gate ✓). Ambiguity: primary sleek vs shine depends on R7-Q1 applied to „intensiv glänzenden, glatten „Glass Hair\"-Effekt\"."} |
| B (Codex) | "shine" | {"rule_path":["§4.1","§4.2","3.4(i′)/R6-Q1","§4.6","§4.5"],"reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["provisional; lean_route=styling; not recommendable.","R2 marker Hydroxyacetophenone r9. Polysilicone-29 r7 supplies one persistent family; Silicone Quaternium-18 r10 is below both readings.","First unblinded C2 promise supplies shine then sleek and frizz_control; explicit hitzeaktivierte Polymere raises activation."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

R7-Q1 is written as a general adjective-before-job-phrase rule, not a Wellaflex-only exception. In the C2 lead intensiv glänzenden qualifies the following glatten Glass Hair-Effekt job phrase; it does not supply a separate earlier shine job. The smooth whole-style result supplies sleek; reduziert Frizz supplies the eligible frizz_control secondary via silicone_coat. Shine remains finish evidence under §6.8. B repeats the superseded pre-R7 separate-adjective job reading; A applies the governing amendment.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Das NEQI Diamond Glass All Styling Spray verleiht dem Haar einen intensiv glänzenden, glatten „Glass Hair“-Effekt. Es kombiniert Styling-Unterstützung mit Hitzeschutz, reduziert Frizz und schützt das Haar vor Feuchtigkeit – ohne es zu beschweren. Es ist also perfekt geeignet, für alle die ein minimalistisches Styling-Setup bevorzugen.” (C2, promise); “intensiv glänzenden, glatten „Glass Hair"-Effekt” (C2, finish). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-f3c09d13ab.json`.

### NEQI Diamond Glass Styling Spray All — secondary_jobs

`neqi-diamond-glass-styling-spray-all` · `sty-f3c09d13ab` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["frizz_control"] | {"rule_path":["§4.1 gate passed (C2; complete 14-item INCI, R2-H4)","§4.2: „Diamond Glass\" line, „Styling Spray All\" no job ⇒ name decides nothing; first C2 line „… verleiht dem Haar einen [intensiv glänzenden,] glatten „Glass Hair\"-Effekt\" ⇒ sleek (the shine adjective before the job phrase is not its own job, R7-Q1) ⇒ styling_result, li_function yes","3.4 aqueous; (i) no FX; (i′) Polysilicone-29 r7 main active ✓, no care above the first preservative/LI cutoff Ethylhexylglycerin r8 ✓, no FX ✓ ⇒ smoothing_styler","§4.5 held (R6-Q1)"],"reason_code":"r6q1_heat_activated_smoothing_film_pending_leave_in_addendum","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 hold claim ⇒ null (stored only)","notes":"Provisional profile. T_S EHG r8 booster above the only PR-1 Hydroxyacetophenone r9 ⇒ unresolved; no species between ⇒ same values. Weight medium (family d). candidate_below_tail: Silicone Quaternium-18 r10 (buildup limb1). No fragrance declared. heat_activated yes (C2 „hitzeaktivierten Polymere\"). Finish glänzend (C2 „intensiv glänzenden\"). frizz_control from C2 „reduziert Frizz\" (gate ✓). Ambiguity: primary sleek vs shine depends on R7-Q1 applied to „intensiv glänzenden, glatten „Glass Hair\"-Effekt\"."} |
| B (Codex) | ["frizz_control","sleek"] | {"rule_path":["§4.1","§4.2","3.4(i′)/R6-Q1","§4.6","§4.5"],"reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No eligible C1/C2 strength claim.","notes":["provisional; lean_route=styling; not recommendable.","R2 marker Hydroxyacetophenone r9. Polysilicone-29 r7 supplies one persistent family; Silicone Quaternium-18 r10 is below both readings.","First unblinded C2 promise supplies shine then sleek and frizz_control; explicit hitzeaktivierte Polymere raises activation."]} |

**Rules:** `plans/styling-concept/02-rulings.md:158` (R7-Q1); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

R7-Q1 is written as a general adjective-before-job-phrase rule, not a Wellaflex-only exception. In the C2 lead intensiv glänzenden qualifies the following glatten Glass Hair-Effekt job phrase; it does not supply a separate earlier shine job. The smooth whole-style result supplies sleek; reduziert Frizz supplies the eligible frizz_control secondary via silicone_coat. Shine remains finish evidence under §6.8. B repeats the superseded pre-R7 separate-adjective job reading; A applies the governing amendment.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Das NEQI Diamond Glass All Styling Spray verleiht dem Haar einen intensiv glänzenden, glatten „Glass Hair“-Effekt. Es kombiniert Styling-Unterstützung mit Hitzeschutz, reduziert Frizz und schützt das Haar vor Feuchtigkeit – ohne es zu beschweren. Es ist also perfekt geeignet, für alle die ein minimalistisches Styling-Setup bevorzugen.” (C2, promise); “intensiv glänzenden, glatten „Glass Hair"-Effekt” (C2, finish). Packet: `data/research/styling-inci/v1.0/r8/packets/claims/sty-f3c09d13ab.json`.

## Hold check

**76/76 raw hold values agree**, including 60 null/null pairs. **16/16 agree where either lane emits a level; 0 mismatches.** Raw hold_level on every cohort record, including null, held profiles and non-Styling routes. Agreement is not an independent claim-to-level oracle; captured C1/C2 hold claims and both bases are retained for every record. No formula or grade is manufactured.

| Value | Lane A count | Lane B count |
|---|---|---|
| 1 | 3 | 3 |
| 2 | 5 | 5 |
| 3 | 3 | 3 |
| 4 | 5 | 5 |
| null | 60 | 60 |

Mismatch list: none. Per-product levels, routes, captured hold claims and lane bases are in diff.json.

## Latent user-facing ambiguities — non-blocking

6 lane reports on 6 products agree in the reported fields. These observations are preserved without elevating them into demonstrated disagreement gaps. A latent secondary observation may coexist with an independently disputed primary on the same product.

| Lane | Product / slug | Fields with agreed values | Lane-reported concern / applied reading |
|---|---|---|---|
| A | John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray<br>`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"primary_job":"sleek"} | Provisional profile. Weight medium: one family (d) Polysilicone-29. candidate_below_tail: Cetrimonium Chloride r18, Hydroxypropyltrimonium Hyaluronate r21, Silicone Quaternium-18 r22 (buildup limb1). Secondaries from the C2 body line „verwandelt Frizz in seidig-glattes, [hochglänzendes] Haar" ⇒ frizz_control, shine (gates ✓ silicone_coat). Finish glänzend („hochglänzendes", „verleiht Glanz"). Blow-dry required ⇒ before_heat. Ambiguity: if „Unendlich Smooth" were a line name, the name would name no job and the lead would fall to a protection line (heat_protection class); the registry R6-Q1 route stands either way. |
| A | Syoss Glaze Topcoat<br>`syoss-glaze-topcoat` | {"secondary_jobs":["frizz_control","sleek"]} | Alcohol denat. r3. Weight medium (family a). Secondaries from C2 „Reduziert Frizz bis zu 24h für seidig glattes Haar …" ⇒ frizz_control, then sleek („glattes Haar" = smooth result of the whole hair); gates ✓ wax_lipid. Ambiguity: „seidig glattes Haar" read as sleek (could be read as a frizz-control result phrase only). Directions: dry hair, before flat iron/curling wand ⇒ before_heat; after styling to boost shine ⇒ also dry_finish. |
| B | NEQI Diamond Glass Ultimate Styling Spray<br>`neqi-diamond-glass-ultimate-styling-spray` | {"secondary_jobs":[]} | §6.10 secondary-candidate scope: The broad introductory wording refers to further jobs stated by C1/C2 claims, while the executable candidate order enumerates name jobs and promise lines, with explicit hold and anti-frizz exceptions. Applied the narrower enumeration; typed finish/other lines do not independently add secondary jobs. |
| B | Balea Locken Crunchgel<br>`balea-locken-crunchgel` | {"secondary_jobs":["frizz_control","hold_fix"]} | §6.10 secondary-candidate scope: The broad introductory wording refers to further jobs stated by C1/C2 claims, while the executable candidate order enumerates name jobs and promise lines, with explicit hold and anti-frizz exceptions. Applied the narrower enumeration; typed finish/other lines do not independently add secondary jobs. |
| B | BALI CURLS Haargel Strong Hold Flaxseed<br>`bali-curls-strong-hold-flaxseed-gel` | {"secondary_jobs":["definition"]} | §6.10 secondary-candidate scope: The broad introductory wording refers to further jobs stated by C1/C2 claims, while the executable candidate order enumerates name jobs and promise lines, with explicit hold and anti-frizz exceptions. Applied the narrower enumeration; typed finish/other lines do not independently add secondary jobs. |
| B | Moroccanoil Trockenes Texturspray (Dry Texture Spray)<br>`moroccanoil-dry-texture-spray` | {"secondary_jobs":[]} | §6.10 secondary-candidate scope: The broad introductory wording refers to further jobs stated by C1/C2 claims, while the executable candidate order enumerates name jobs and promise lines, with explicit hold and anti-frizz exceptions. Applied the narrower enumeration; typed finish/other lines do not independently add secondary jobs. |

B's 4 explicitly calculation-log ambiguity report(s) are retained separately. A's legitimate hold_route ambiguous enum is not counted as a new rule report. Moroccanoil's stale mixed example is adjudicated above against governing R7-Q2. Lane B labels that concern calculation-log, but the actual route difference is independently counted user-facing. Reported concerns on disputed fields are retained in reported_ambiguities and are not latent.

## Agreement and normalization

### User-facing fields

| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |
|---|---|---|---|---|---|
| route | 74/76 | 97.37 | 2 | 74/76 | 97.37 |
| subtype | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| hold_level | 76/76 | 100 | 0 | 16/16 | 100 |
| weight | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| finish | 74/76 | 97.37 | 2 | 44/46 | 95.65 |
| flexibility | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| target_zone | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| application_moment | 74/76 | 97.37 | 2 | 44/46 | 95.65 |
| primary_job | 72/76 | 94.74 | 4 | 41/45 | 91.11 |
| secondary_jobs | 70/76 | 92.11 | 6 | 40/46 | 86.96 |
| provides_heat_protection | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| heat_activated | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| alcohol_note | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| buildup_note | 75/76 | 98.68 | 1 | 45/46 | 97.83 |
| neutral_fact | 76/76 | 100 | 0 | 5/5 | 100 |

### Products fully agreeing

- `alverde-beach-waves-spray-seaside-balance`
- `alverde-locken-refresh-spray`
- `aussie-leave-in-creme-work-that-curl`
- `balea-finishing-spray-glow-und-care`
- `balea-haargel-hair-jelly`
- `balea-leave-in-spray-sea-salt-care-define`
- `balea-locken-crunchgel`
- `balea-locken-revitalizing-spray`
- `balea-men-pomade-haar-bart-2in1`
- `balea-overnight-wellenspray`
- `balea-professional-definier-spray-traumlocken`
- `balea-professional-glow-und-shine-finishing-spray`
- `balea-professional-haarserum-glow-und-shine`
- `balea-professional-styling-cream-traumlocken`
- `balea-styling-creme-power-flex`
- `balea-styling-finishing-stick`
- `balea-styling-locken-lotion`
- `bali-curls-hydrating-curl-cream`
- `bali-curls-leave-in-spray-curl-defining`
- `bali-curls-strong-hold-flaxseed-gel`
- `bali-gents-sea-salt-spray`
- `bumble-and-bumble-brilliantine`
- `cantu-lockencreme-kokos`
- `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`
- `garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray`
- `got2b-anti-frizz-lotion-schmusekatze`
- `got2b-lockenspray-refresher-curlz`
- `got2b-spruehkleber-freeze-haarlack`
- `guhl-locken-pflege-und-styling-3in1`
- `guhl-styling-spray-locken-pflege-und-styling-2in1`
- `hask-lockencreme-curl-care`
- `isana-professional-styling-creme-locken-traum`
- `john-frieda-frizz-ease-3-tage-glatt-styling-spray`
- `john-frieda-frizz-ease-traumlocken-lockencreme`
- `john-frieda-frizz-ease-unendlich-smooth-blow-out-spray`
- `john-frieda-haarserum-frizz-ease-der-baendiger`
- `john-frieda-traumlocken-belebender-wellenauffrischer`
- `john-frieda-volume-lift-ansatz-booster`
- `john-frieda-volume-lift-pushed-up-dry-texture-spray`
- `kerastase-curl-manifesto-refresh-absolu`
- `kevin-murphy-killer-curls`
- `kms-thermashape-2-in-1-spray`
- `kms-thermashape-straightening-creme`
- `langhaarmaedchen-lockenspray-halt-sprungkraft`
- `langhaarmaedchen-lockenspray-natur-lockenwunder`
- `loreal-men-expert-barber-club-styling-pomade`
- `maria-nila-curlicue-cream`
- `moroccanoil-dry-texture-spray`
- `neqi-diamond-glass-ultimate-styling-spray`
- `redken-one-united-all-in-one-multi-benefit-treatment`
- `redken-refreshing-curl-mist`
- `redken-styling-beach-spray`
- `schwarzkopf-professional-osis-curl-retouch`
- `schwarzkopf-taft-haarspray-power-halt-5`
- `schwarzkopf-taft-styling-balm-locken-halt-3`
- `schwarzkopf-taft-x-gliss-silky-shine-shine-coat`
- `syoss-curl-cream-gel-3in1`
- `syoss-glaze-glanz-und-schutz-primer`
- `syoss-glaze-topcoat`
- `taft-styling-paste-forming-halt-5plus`
- `taft-x-gliss-hitzeschutzspray-lovely-long`
- `wella-eimi-nutricurls-curl-shaper`
- `wella-eimi-nutricurls-fresh-up`
- `wella-eimi-smooth-perfect-me`
- `wella-eimi-sugar-lift`
- `wella-eimi-texture-ocean-spritz`
- `wella-eimi-volume-dry-me`
- `wellaflex-schaumfestiger-locken-und-wellen-starker-halt`

### Normalization

- route is compared as {destination,state,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.
- application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not research-trace wrappers.
- buildup/alcohol notes: {fired:false}, not_fired and does_not_fire -> does_not_fire; {fired:true}, fired and fires -> fires. null remains null.
- Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.
- neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.
- Empty secondary_jobs/d8b_flags collections and null are equivalent only when no Styling profile exists (§4.7). Only explicitly informational_and_non_authoritative historical properties are masked. Any unmarked forbidden value remains scoreable.
- confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.

### Calculation-log fields — non-blocking

783/1520 cells agree (51.51%). This mechanical diagnostic compares free-text traces and asymmetric schemas; it is not a behavioral quality score. All log discrepancies are retained in diff.json.

| Field | Agree / all | Disagree |
|---|---|---|
| reason_code | 9/76 | 67 |
| rule_path | 0/76 | 76 |
| review_triggers | 58/76 | 18 |
| confidence | 0/76 | 76 |
| tail_T_S | 75/76 | 1 |
| tail_T_LI | 64/76 | 12 |
| ingredient_flags | 75/76 | 1 |
| d8b_flags | 75/76 | 1 |
| notes | 0/76 | 76 |
| identity_status | 76/76 | 0 |
| promise_class | 71/76 | 5 |
| result_mechanisms | 45/76 | 31 |
| hold_route | 75/76 | 1 |
| dropped_jobs | 30/76 | 46 |
| held | 0/76 | 76 |
| hold_basis | 30/76 | 46 |
| lean_route | 59/76 | 17 |
| li_function | 4/76 | 72 |
| pair_rule | 4/76 | 72 |
| ruled_route | 33/76 | 43 |

## Targeted lock criteria

| Criterion | Result |
|---|---|
| Every user-facing disagreement is a proven lane error under a clear rule | **PASS** |
| No user-facing rule gaps (b), packet issues (c), or owner questions (d) | **PASS** |

**PASS:** Every user-facing difference is a proven lane error; no b/c/d user-facing cells remain.

## Scope and reproduction

- Targeted known-product confirmation; not a full new cohort, new unseen validation, catalog activation or live-app proof.
- Human interpretation and proposed contract text are explicit. Joins, normalization, field/product counts, classifications tallies, ruling pass flags, hold counts, manifests and verdict are computed.
- This scores lock readiness; it does not rewrite LOCK-1-S, owner approvals, frozen lane values or engine status.
- Calculation-log differences and lane-reported latent ambiguities do not block. No subtype minimum or historical unseen gate is added to the user-specified targeted lock rule.
- Agreement is not proof against shared mistakes. Named ruling effects are checked separately; hold_check is a raw A/B agreement check with frozen claim traces, not a newly implemented independent hold classifier.

The script rejects duplicate/missing/extra IDs, broken slug joins, packet binding/version mismatches, absent quoted rule evidence and unadjudicated new user-facing differences. Fixed input SHA-256 values are recorded in diff.json. It writes only sibling diff.json and report.md.

Run `node data/research/styling-inci/v1.0/round-8/diff.js --summary` twice, then compare `shasum -a 256 data/research/styling-inci/v1.0/round-8/diff.json`. No timestamps, randomness or absolute paths enter generated output.

diff.json SHA-256: `91cfa6c2ad6993fa3f892a4ea6b85934b6ca8a2d8ff4c5572444a7c468d7c0a1`.
