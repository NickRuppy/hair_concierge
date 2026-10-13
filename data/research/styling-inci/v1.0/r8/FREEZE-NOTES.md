# FREEZE-NOTES — targeted Styling r8 re-check

Frozen 2026-10-13. R7 amendment packet stamp: `styling-inci-v0.5-r7amend`; lexicon `styling-lexicon-v0.5-r7amend`. LOCK-1 remains suspended pending this targeted re-check (LOCK-1-S).

## Scope

All **143** r6 records were screened case-insensitively. Definition/adjective tests use `/\bdefin\w*/i` over product name (including `product_name_as_captured`), variants and **every** C1/C2 claim type, with exact field/index/text in `scope-audit.json`. R7-F uses only C1/C2 `promise` lines, ordered C1 `pack_front`, other C1 packet order, then C2 packet order; typed finish/hold/free_from/etc. cannot become primary inputs. Only a no-stem first eligible promise lead triggers the later-promise candidate; a later no-job line cannot override a job-bearing lead. Bare curl/wave mentions and formula words are not treated as sentence jobs. The primary screen is conservative candidate capture, not classification: name and sentence semantics remain for the blind re-check. **76** records are selected.

Screen expressions (case-insensitive; full exact patterns also in `scope-audit.json`):

- Definition: `\bdefin\w*`
- Curl/wave names: `\b(?:curl\w*|lock\w*|wellen?\w*|wave\w*)\b`
- Known collections: `\b(?:frizz[-\s]*ease|traumlocken|volume\s*lift|diamond\s*sleek|glow\s*(?:&|und)\s*shine|nutricurls)\b`
- Additional line candidates: `\b(?:thermashape|curl\s*manifesto|locken\s*methode|locken\s*traum|lockenwunder|gotcurlz|glaze|eimi\s+(?:volume|texture))\b`
- Conservative primary candidate: `\b(?:halt|hold|fixier\w*|volum\w*|schwung|sprungkraft|spannkraft|fülle|textur\w*|struktur\w*|grip|griffig\w*|gl[aä]tt\w*|smooth\w*|sleek|anti[- ]?frizz|frizz|gl[aä]nz\w*|shine|gloss|defin\w*|form(?:t|en|ung)?|shap\w*|mold\w*|beach\w*|refresh\w*|auffrisch\w*|reviv\w*|reaktiv\w*)\b`

The R7-Q3 name inventory confirms Frizz Ease, Traumlocken, Volume Lift, Diamond Sleek, Glow & Shine and Nutricurls as multi-product collection names containing job words. The screen also retains additional conservative line candidates: Thermashape (explicit thermashape-collection URLs for two products in `capture/round3-smoothing-r5.json`), Curl Manifesto and Locken Methode (separate pack/header units in `capture/packnames-r7.json`), Locken Traum, Lockenwunder, gotCURLZ, Glaze and EIMI Volume/Texture. These candidates do not rule a product noun to be a collection name; they ensure R7-Q3 reach is checked without silently dropping possible line names or overriding R4-Q2/R4-Q7.

| Product | Reason class(es) |
|---|---|
| alverde NATURKOSMETIK Beach Waves Spray Seaside Balance | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-F-later-primary |
| alverde NATURKOSMETIK Locken Refresh-Spray | R7-Q2-curl-wave-name |
| AUSSIE WORK THAT CURL LEAVE-IN CREAM | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| Balea Finishing Spray Glow & Care | R7-F-unresolved-primary |
| Balea Haargel Hair Jelly (Styling Hair Jelly) | R7-F-later-primary |
| Balea Leave-In Spray Sea Salt Care & Define | mandatory-r7-m2, R7-Q2-definition-define-screen |
| Balea Locken Crunchgel | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Balea Locken Revitalizing Spray | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job, R7-F-later-primary |
| Balea MEN Pomade Haar & Bart 2in1 | mandatory-r7-m2, R7-Q2-definition-define-screen, R7-F-unresolved-primary |
| Balea MEN Styling Powder | R7-F-later-primary |
| Balea Overnight Wellenspray | R7-Q2-curl-wave-name, R7-F-later-primary |
| Balea PROFESSIONAL Definier Spray Traumlocken (Traum Locken Definierende Spray) | R7-Q3-brand-line, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray | R7-Q3-brand-line |
| Balea PROFESSIONAL Haarserum Glow & Shine | R7-Q3-brand-line, R7-F-later-primary |
| Balea PROFESSIONAL Styling Cream Traumlocken | R7-Q3-brand-line, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Balea Styling Creme Power Flex (Forming Cream Power Flex) | R7-F-unresolved-primary |
| Balea Fixierungsbürste Styling Finishing Stick | R7-F-later-primary |
| Balea Styling Locken Lotion | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job, R7-F-later-primary |
| BALI CURLS HYDRATING CURL CREAM | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| BALI CURLS Leave-In Spray Curl Defining (Curl Defining Spray) | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| BALI CURLS Haargel Strong Hold Flaxseed | R7-Q2-definition-define-screen |
| BALI CURLS Volumizing Curl Spray | R7-Q2-curl-wave-name |
| BALI GENTS Sea Salt Spray | mandatory-r7-m2, R7-Q2-definition-define-screen |
| Bumble and bumble brilliantine | mandatory-r7-m2 |
| cantu SHEA BUTTER COCONUT CURLING CREAM | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER | R7-Q2-curl-wave-name |
| GARNIER FRUCTIS Leave-In Spray Diamond Sleek Glättungsspray | R7-Q3-brand-line |
| GARNIER FRUCTIS LOCKEN METHODE SHAPE REFRESH STEP 4 FEUCHTIGKEITS-BOOST SPRAY | R7-Q3-line-candidate, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| got2b Anti-Frizz Lotion Schmusekatze | R7-F-later-primary |
| got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | R7-F-unresolved-primary |
| got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) | R7-Q3-line-candidate, R7-Q2-curl-wave-name |
| got2b SPRÜH KLEBER Freeze Haarlack | R7-F-later-primary |
| GUHL LOCKEN PFLEGE & STYLING 3in1 LOCKENCREME, KUR & SPÜLUNG | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job, R7-F-later-primary |
| GUHL LOCKEN PFLEGE & STYLING 2in1 STYLING-SPRAY | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| HASK curls defining cream | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| ISANA PROFESSIONAL Styling Creme Locken Traum | R7-Q3-line-candidate, R7-Q2-curl-wave-name |
| John Frieda Frizz Ease 3-Tage-Glatt Styling-Spray | R7-Q3-brand-line |
| John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) | R7-Q3-brand-line, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | R7-Q3-brand-line, R7-F-later-primary |
| John Frieda Frizz Ease Zauberformel Seiden-Finish Creme | R7-Q3-brand-line |
| John Frieda Frizz Ease DER BÄNDIGER EXTRA STRONG SERUM | R7-Q3-brand-line |
| John Frieda Traumlocken Belebender Wellenauffrischer | R7-Q3-brand-line, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-F-later-primary |
| John Frieda Volume Lift Ansatz-Booster | R7-Q3-brand-line |
| John Frieda Spray Volume Lift Pushed-up Dry Texture | R7-Q3-brand-line |
| Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray | R7-Q3-line-candidate, R7-Q2-curl-wave-name |
| Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme) | mandatory-r7-m2, R7-Q2-curl-wave-name |
| KMS Thermashape 2-in-1 Spray | R7-Q3-line-candidate |
| KMS Thermashape Straightening Creme | R7-Q3-line-candidate |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft | R7-Q2-curl-wave-name |
| LANGHAARMÄDCHEN Lockenspray Natur Lockenwunder | R7-Q3-line-candidate, R7-Q2-curl-wave-name, R7-F-unresolved-primary |
| L'Oréal Men Expert Barber Club Styling Pomade Bart & Haar mit ätherischem Zedernholzöl | R7-F-unresolved-primary |
| L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | R7-F-later-primary |
| Maria Nila Curlicue Cream (Stylingcreme) | mandatory-r7-m2, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Moroccanoil Trockenes Texturspray (Dry Texture Spray) | R7-F-unresolved-primary |
| Moroccanoil Glättende Creme (Smoothing Lotion) | R7-Q2-definition-define-screen |
| NEQI Diamond Glass Styling Spray All | mandatory-r7-m2 |
| NEQI Diamond Glass Ultimate Styling Spray | mandatory-r7-m2, R7-F-unresolved-primary |
| Redken One United All-in-One Multi-Benefit Treatment | R7-F-unresolved-primary |
| Redken Refreshing Curl Mist | R7-Q2-curl-wave-name |
| Redken BEACH SPRAY BEACHY TEXTURE SPRAY | R7-Q2-curl-wave-name |
| Schwarzkopf Professional OSiS+ CURL RETOUCH CURL ENHANCING SPRAY | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| Schwarzkopf taft Haarspray POWER Halt 5 | R7-F-unresolved-primary |
| Schwarzkopf taft Styling Balm LOCKEN Halt 3 | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine | R7-F-later-primary |
| syoss Curl Cream Gel | R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Syoss Glaze Glanz & Schutz Primer | R7-Q3-line-candidate |
| Syoss Glaze Topcoat | R7-Q3-line-candidate |
| Schwarzkopf taft FORMING STYLING PASTE | R7-F-unresolved-primary |
| Schwarzkopf taft taft x GLISS Lovely Long MULTITASKING HITZESCHUTZ-SPRAY | R7-F-unresolved-primary |
| Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | R7-Q3-brand-line, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |
| Wella Professionals EIMI Nutricurls Fresh Up | R7-Q3-brand-line, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen |
| Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion) | R7-F-unresolved-primary |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray | R7-Q3-line-candidate |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray) | R7-Q3-line-candidate |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo) | R7-Q3-line-candidate |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt | mandatory-r7-m2, R7-Q2-curl-wave-name, R7-Q2-definition-define-screen, R7-Q1-adjective-before-job |

## Freeze and verification

The unmodified r6 builder rebuilt **432** historical artifacts byte-identically in memory. r8 emits **76** S0, F/U, and claims packets with a fresh opaque salt (`styling-inci-v1.0-cohort-8/r7-owner-amendment/opaque-id/`); id overlap with r1-r7 is zero. It preserves r6 S0 masking, reuses the exact r7 directions-only F/U grading mask (including its inherited-mask sentinel), and adds `strongly` to the strength-grade mask and a non-stateful leak regex. INCI is byte-identical to r6 and is never passed through the general grading mask. All S0/FU string fields were scanned: S0 **4180**, F/U **2750**; unauthorized leaks: **0**. Re-run `node data/research/styling-inci/v1.0/build/freeze-cohort-r8.js` twice and compare `r8/artifact-manifest.json` SHA-256 for determinism.
