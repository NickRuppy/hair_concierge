# Styling v1.0 — TARGETED final re-check, cohort r7

**1028/1035 user-facing field cells agree (99.32%). 64/69 products fully agree (92.75%).** The denominator is 69 products × 15 user-facing fields. Route includes held/committed state and boundary reason; application moment compares primary only.

**Lock verdict: FAIL.** User-facing unresolved cells: neqi-diamond-glass-ultimate-styling-spray::primary_job (b). Only a disagreements are allowed by the targeted lock criterion.

7 disagreement cells on 5 products: **a=6, b=1, c=0, d=0**. Lane errors by wrong lane: A=4, B=2. Counts are field cells, not distinct policy issues; consequential secondary changes from a wrong primary remain separate cells.

Governing lock authority: `plans/styling-concept/02-rulings.md:113` (R3-L); `plans/styling-concept/02-rulings.md:131` (R4-L). The requested targeted-set criterion allows proven lane errors, requires zero b/c/d user-facing differences, and excludes calculation-log fields. Latent reports do not change this verdict.

## Ruling-effect check

6/6 named effects land in both lanes. This tests the specified ruling fields; it does not claim complete profile agreement on those products.

| Ruling | Product / slug | Expected | A actual | B actual | Landed A / B | Other user disagreements |
|---|---|---|---|---|---|---|
| R6-Q1 | John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray<br>`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | yes / yes | none |
| R6-Q1 | NEQI Diamond Glass Ultimate Styling Spray<br>`neqi-diamond-glass-ultimate-styling-spray` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | yes / yes | primary_job |
| R6-Q1 | NEQI Diamond Glass Styling Spray All<br>`neqi-diamond-glass-styling-spray-all` | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | {"route":{"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"},"subtype":"smoothing_styler"} | yes / yes | primary_job, secondary_jobs |
| R6-T (1) | Balea Styling Spray Volumenpuder Pure Styling<br>`balea-pure-styling-volumenpuder-spray` | {"target_zone":"roots"} | {"target_zone":"roots"} | {"target_zone":"roots"} | yes / yes | none |
| R6-T (2) | Redken Root Tease<br>`redken-root-tease` | {"target_zone":"all"} | {"target_zone":"all"} | {"target_zone":"all"} | yes / yes | none |
| R6-T (3) | alverde NATURKOSMETIK Beach Waves Spray Seaside Balance<br>`alverde-beach-waves-spray-seaside-balance` | {"secondary_jobs_excludes":"definition"} | {"secondary_jobs":[]} | {"secondary_jobs":[]} | yes / yes | none |

R6 sources: `plans/styling-concept/02-rulings.md:148` (R6-Q1); `plans/styling-concept/02-rulings.md:149` (R6-T). Ultimate retains its frozen FX-1 member; the named owner override governs its route without changing ingredient membership.

## Rule gaps (b)

### NEQI Diamond Glass Ultimate Styling Spray — primary_job

`neqi-diamond-glass-ultimate-styling-spray` · `sty-40b72cc1a3` · class **b**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | null | {"rule_path":["4.1 gate pass","4.2 name no job word -> first C2 line „kombiniert Styling mit intensivem Hitzeschutz\" joins styling + protection -> mixed (RG2-19)","PH1-12/R6-Q1: D7 no; (i′) general rule not met (FX-1 VP/Methacrylamide/Vinyl Imidazole Copolymer r8 present) -> letter stops at mixed_promise","registry R6-Q1 overrides the step-2 stop -> styling smoothing_styler","4.5 held"],"reason_code":"ruled_route_override (§4.1 (c), R6-Q1 owner-named route); PH1-16 hold","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 hold statement -> null (stored only)","notes":"Primary job left empty: no C1/C2 promise line carries a job word of the §6.10 vocabulary („Styling\", „Hitzeschutz\", „Wasserabweisend\", „Verkürzte Föhnzeit\"); sleek/shine appear only inside the typed finish claim („spiegelglatt, ultimativer Glanz\") and anti-frizz only in a C2 „other\" line. User-facing ambiguity: a lane may take sleek from the subtype job or the finish text. Finish glänzend (C2 finish claim). candidate_below_tail: Silicone Quaternium-18 r11 (buildup limb 1). No fragrance declared."} |
| B (Codex) | "review" | {"rule_path":"§4.1(c), §4.6:R6-Q1 Ultimate override → §4.5","reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No C1/C2 strength claim.","notes":["Full profile provisional; lean_route styling; not recommendable. Exact Ultimate owner override retains FX-1 r8. R2 marker Hydroxyacetophenone r10 changes no F value. Generic Styling plus heat protection supplies no unique closed-list primary job; see ambiguous_rules."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:748` (§6.10); `docs/research/styling-inci/v1.0/01_property-set-v0.md:217` (§2.12 source assumption); `plans/styling-concept/02-rulings.md:148` (R6-Q1). Exact cited clauses and full frozen evidence are retained in diff.json.

Ultimate is correctly held smoothing_styler in both lanes, but its C1/C2 promise lines state generic Styling plus heat protection, heat-activated polymers, water repellence and shorter drying time. None supplies a primary from the eight-job vocabulary. §6.10 requires one primary but specifies no representation when an eligible lead supplies none. The no-C1/C2-promise exception does not apply: promise lines exist. A null and B review both express the missing job differently; neither is proven correct by a clear no-job convention. B review is outside the closed vocabulary, but that alone does not prove A null against an existing rule. Typed finish/other lines and the subtype do not authorize replacing the lead.

**Proposed fix (not approved):** In §6.10 and property set §2.12: when the eligible C1/C2 lead supplies no job in the primary-job vocabulary, emit primary_job: null and an internal primary_job_unresolved review trigger. Do not infer a primary from subtype, formula, or typed finish/other lines. Keep the owner-ruled held route and independently score eligible secondaries. Correct the assumption that a C1/C2 promise always supplies a closed-list job.

**Recommendation:** Use null for the absent user-facing job and keep review in the calculation log. This is proposed contract wording, not an approved correction to frozen lane B. Synchronize the consuming guidance and re-check this affected case after the gap is resolved.

**Frozen evidence:** “Es kombiniert Styling mit intensivem Hitzeschutz bis 230°” (C2, promise). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-40b72cc1a3.json`.

## Owner questions (d)

None.

## Packet issues (c)

None.

## Proven lane errors (a)

### John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) — secondary_jobs

`john-frieda-frizz-ease-traumlocken-lockencreme` · `sty-edc4dad3b3` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | [] | {"rule_path":["4.1 gate pass (C1 name + line, C3 verbatim directions, C1 pack INCI)","4.2 step 1 name „Lockencreme Traumlocken\" one job (definition) -> styling_result, li_function yes","aqueous","3.4(i) D7 limb 1: only generic Acrylates Copolymer r2 (aqueous cream with HEC, NaOH -> FX-2c not corroborated) and Sodium Polystyrene Sulfonate r3 (FX-U) -> limb cannot be established","3.4(iii) LI G0 -> li_g0_provisional (acrylates_copolymer_function_unresolved)","registry D7 row rules the route -> held curl_cream"],"reason_code":"ruled_route_override (§4.1 (d), R4-Q5: D7 registry row); letter stops at LI G0 (uncorroborated FX-2c); PH1-16 hold","boundary_reason":"pending_leave_in_addendum","hold_basis":"C1 „24-Stunden Halt\" is a duration without strength -> null („Halt: keine Herstellerangabe\")","notes":"Weight rich via LGN pair (Cocamidopropyl PG-Dimonium Chloride Phosphate r11 CA-1 + Stearyl/Cetyl/Behenyl Alcohol FA-1 above T_S). Buildup limb 1 (Silicone Quaternium-18 r13) + limb 2. No neutral fact (hold_route ambiguous). Flex from C1 „definierte, flexible Locken\". T_S: Caprylhydroxamic Acid r14 is a booster above every PR-1 (Phenoxyethanol r24) -> unresolved; R2 marker the chelator r15; no species between, values identical."} |
| B (Codex) | ["frizz_control"] | {"rule_path":"§4.1(d), §4.6:D7/R4-Q5 → §4.5","reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"24-Stunden Halt is duration, not strength.","notes":["Full profile provisional; lean_route styling; not recommendable. Exact Lockencreme Traumlocken D7 registry overrides the unresolved letter route. Generic acrylates in an HEC cream remains ambiguous; no Stylingpolymer fact. LGN pair and silicone quat give rich/buildup. R2 marker chelator r15 changes no F value."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `plans/styling-concept/02-rulings.md:148` (R6-Q1). Exact cited clauses and full frozen evidence are retained in diff.json.

C1 “Verhindert Frizz für definierte, flexible Locken” explicitly promises frizz control. The written anti-frizz exception admits it even in a typed humidity line; silicone_coat/wax_lipid passes the gate and a slot is free. B {frizz_control} is correct; A omits it. R6-Q1 bars Frizz Ease as a brand-line job, but does not erase this separate explicit pack claim.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Frozen evidence:** “Verhindert Frizz für definierte, flexible Locken” (C1, humidity). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-edc4dad3b3.json`.

### Maria Nila Curlicue Cream (Stylingcreme) — secondary_jobs

`maria-nila-curlicue-cream` · `sty-1518a25736` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["volume"] | {"rule_path":["4.1 gate pass","4.2 name „Curlicue Cream\" -> C2 „Definierende Pflegecreme …\" : care product noun in a descriptor line is not a care job (RG3-12) -> styling_result, definition -> li_function yes","aqueous","3.4(i) D7: LI COND thin -> no","3.4(iii) LI G0 excluded_styling_first (PVP r4 ahead of fatty alcohol, thin conditioning) -> styling","4.5 not held","5 curl_cream (T15 membership)"],"reason_code":"3.4(iii) LI G0 excluded_styling_first (T15 paradigm); registry letter = same","boundary_reason":null,"hold_basis":"C2 „Halt 3/5\" Maria Nila x/5 => 2","notes":"Matches §11.3. Weight medium (Cetyl Alcohol r5 only; Quaternium-95 r11 opaque, no LGN pair). Values agree under R1/R2 marker readings."} |
| B (Codex) | ["hold_fix","volume"] | {"rule_path":"§4.2:RG3-12 → §4.3 3.4(iii):T15 → §5","reason_code":"excluded_styling_first","boundary_reason":null,"hold_basis":"Maria Nila 3/5 → 2.","notes":["Curlicue is the T15 styling-first paradigm. Cetyl alcohol r5 supplies medium weight; opaque Quaternium-95 cannot form an LGN pair. R2 marker Phenoxyethanol r16 gives the same F values. Secondary hold follows §6.10; see ambiguous_rules."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `plans/styling-concept/02-rulings.md:140` (R4-H (5)). Exact cited clauses and full frozen evidence are retained in diff.json.

Volume occurs in the C2 lead (“lebendige Sprungkraft”), then C2 “Halt 3/5” supplies the explicit numeric-hold exception. Both pass via PVP/fixative_film; two slots are available. B {volume, hold_fix} is correct. A follows the stale §11.3 worked row and omits the current explicit §6.10/R4-H(5) candidate. The worked row is an editorial correction, not an unresolved policy choice.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Stale worked example:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:1081` (§11.3 worked example); the explicit current rule and ledger exception govern.

**Frozen evidence:** “Halt 3/5” (C2, hold). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-1518a25736.json`.

### NEQI Diamond Glass Styling Spray All — primary_job

`neqi-diamond-glass-styling-spray-all` · `sty-35ec6930dc` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "sleek" | {"rule_path":["4.1 gate pass (C2 lines, C2 directions, complete 14-item INCI)","4.2 name names no job -> first C2 line, first sentence „… glatten „Glass Hair\"-Effekt\" -> sleek -> styling_result, li_function yes (smoothing)","aqueous","3.4(i) D7: no FX-1…FX-4 -> no","3.4(i′): main active Polysilicone-29 r7 (SI-1 heat-activated film), care only at/after first preservative cutoff Ethylhexylglycerin r8 (Silicone Quaternium-18 r10), no fixative -> styling smoothing_styler","4.5 held (R6-Q1 routes always held)"],"reason_code":"3.4(i′) R6-Q1 heat-activated smoothing-film route (registry letter = same); PH1-16 hold","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 hold statement -> null (stored only)","notes":"No Parfum on the list -> fragrance flag false. candidate_below_tail: Silicone Quaternium-18 r10 (permanent cationic) would fire buildup limb 1. heat_activated yes from C2 „hitzeaktivierten Polymere\". Heat claim C2/C1 shown „Hitzeschutz laut Hersteller\", no HP-1. Primary: S0 lead reads „[…] glatten Glass-Hair-Effekt\" -> sleek; the unmasked line starts „intensiv glänzenden\" — if a lane reads that adjective as the first job-bearing phrase, primary becomes shine (user-facing ambiguity). Secondaries: shine (glänzend), frizz_control („reduziert Frizz\"). Values identical under R1/R2 marker readings."} |
| B (Codex) | "shine" | {"rule_path":"§4.3 3.4(i′):R6-Q1 → §4.5","reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No C1/C2 strength claim.","notes":["Full profile provisional; lean_route styling; not recommendable. No fixative; Polysilicone-29 r7 is the main film. R2 marker Hydroxyacetophenone r9 changes no F value; Silicone Quaternium-18 r10 remains below-tail. Claims lead with shine before sleek."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:1024` (§10.2 claim normalisation); `docs/research/styling-inci/v1.0/01_property-set-v0.md:465` (§7 C fields). Exact cited clauses and full frozen evidence are retained in diff.json.

The authoritative unmasked C2 lead states shine (“intensiv glänzenden”) before sleek (“glatten”). §10.2 assigns jobs to claim normalisation, not masked S0. B shine is correct. A explicitly uses S0 “[CLAIM] glatten” and therefore skips the first unmasked job. R6-Q1 fixes route/subtype, not this independent C field.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Frozen evidence:** “Das NEQI Diamond Glass All Styling Spray verleiht dem Haar einen intensiv glänzenden, glatten „Glass Hair“-Effekt. Es kombiniert Styling-Unterstützung mit Hitzeschutz, reduziert Frizz und schützt das Haar vor Feuchtigkeit – ohne es zu beschweren. Es ist also perfekt geeignet, für alle die ein minimalistisches Styling-Setup bevorzugen.” (C2, promise). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-35ec6930dc.json`.

### NEQI Diamond Glass Styling Spray All — secondary_jobs

`neqi-diamond-glass-styling-spray-all` · `sty-35ec6930dc` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["frizz_control","shine"] | {"rule_path":["4.1 gate pass (C2 lines, C2 directions, complete 14-item INCI)","4.2 name names no job -> first C2 line, first sentence „… glatten „Glass Hair\"-Effekt\" -> sleek -> styling_result, li_function yes (smoothing)","aqueous","3.4(i) D7: no FX-1…FX-4 -> no","3.4(i′): main active Polysilicone-29 r7 (SI-1 heat-activated film), care only at/after first preservative cutoff Ethylhexylglycerin r8 (Silicone Quaternium-18 r10), no fixative -> styling smoothing_styler","4.5 held (R6-Q1 routes always held)"],"reason_code":"3.4(i′) R6-Q1 heat-activated smoothing-film route (registry letter = same); PH1-16 hold","boundary_reason":"pending_leave_in_addendum","hold_basis":"no C1/C2 hold statement -> null (stored only)","notes":"No Parfum on the list -> fragrance flag false. candidate_below_tail: Silicone Quaternium-18 r10 (permanent cationic) would fire buildup limb 1. heat_activated yes from C2 „hitzeaktivierten Polymere\". Heat claim C2/C1 shown „Hitzeschutz laut Hersteller\", no HP-1. Primary: S0 lead reads „[…] glatten Glass-Hair-Effekt\" -> sleek; the unmasked line starts „intensiv glänzenden\" — if a lane reads that adjective as the first job-bearing phrase, primary becomes shine (user-facing ambiguity). Secondaries: shine (glänzend), frizz_control („reduziert Frizz\"). Values identical under R1/R2 marker readings."} |
| B (Codex) | ["frizz_control","sleek"] | {"rule_path":"§4.3 3.4(i′):R6-Q1 → §4.5","reason_code":"pending_leave_in_addendum","boundary_reason":null,"hold_basis":"No C1/C2 strength claim.","notes":["Full profile provisional; lean_route styling; not recommendable. No fixative; Polysilicone-29 r7 is the main film. R2 marker Hydroxyacetophenone r9 changes no F value; Silicone Quaternium-18 r10 remains below-tail. Claims lead with shine before sleek."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:1024` (§10.2 claim normalisation); `docs/research/styling-inci/v1.0/01_property-set-v0.md:465` (§7 C fields). Exact cited clauses and full frozen evidence are retained in diff.json.

After primary shine, the same unmasked promise supplies sleek then frizz_control (“reduziert Frizz”). Both pass via silicone_coat. B {sleek, frizz_control} is correct. A retains the erroneous sleek primary and repeats the true shine primary as a secondary.

**Correct lane: B; wrong lane: A.** Frozen lane values remain unchanged.

**Frozen evidence:** “Das NEQI Diamond Glass All Styling Spray verleiht dem Haar einen intensiv glänzenden, glatten „Glass Hair“-Effekt. Es kombiniert Styling-Unterstützung mit Hitzeschutz, reduziert Frizz und schützt das Haar vor Feuchtigkeit – ohne es zu beschweren. Es ist also perfekt geeignet, für alle die ein minimalistisches Styling-Setup bevorzugen.” (C2, promise). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-35ec6930dc.json`.

### wellaflex Schaumfestiger Locken & Wellen, Starker Halt — primary_job

`wellaflex-schaumfestiger-locken-und-wellen-starker-halt` · `sty-08596bade4` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | "volume" | {"rule_path":["4.1 gate pass (C1 name+line, C3 verbatim directions)","4.2 name: product noun Schaumfestiger + curl nouns Locken & Wellen = two jobs (R4-Q7) -> first C1 line „schwungvolle, definierte Locken\" -> styling_result, curl definition stated -> li_function yes","aqueous (Aqua r1 leads propellants)","3.4(i) D7: not a curl/straightening sale -> no","3.4(iii) LI G0: PVP r4 + VP/VA r5 above T_LI, no conditioning above T_LI (thin), C1 hold positioning („Starker Halt\" in name) -> excluded_styling_first -> styling","4.5 not held (excluded_styling_first)","5 foam -> mousse"],"reason_code":"3.4(iii) LI G0 excluded_styling_first","boundary_reason":null,"hold_basis":"C1 Wellaflex dots 3/5 => 2; number beats word (C1 name „Starker Halt\" => 3)","notes":"Primary: first job-bearing phrase of the C1 lead „schwungvolle, definierte Locken\" is „schwungvolle\" (Schwung => volume, RG2-6); definition and hold_fix enter as name job words (Schaumfestiger = hold product noun; Locken & Wellen = definition). Ambiguous whether „schwungvolle\" or „definierte Locken\" is the first job-bearing phrase (user-facing: primary_job). candidate_below_tail: Polyquaternium-16 r10 (CA-3) would fire buildup limb 1 / add a weight family. Flex: „kein Verkleben\", „leicht ausbürsten\" are not flex words. Finish: „natürlich gestylt aussehen\" -> unbekannt."} |
| B (Codex) | "definition" | {"rule_path":"§4.3 3.4(iii):LI G0/T15 → §5","reason_code":"excluded_styling_first","boundary_reason":null,"hold_basis":"Wellaflex 3/5 → 2; number beats Starker Halt.","notes":["PVP r4 and VP/VA r5 with thin care. Tail PQ-16, chitosan, silicones and oil earn no above-tail credit. Air-drying is explicitly allowed."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

The C1 lead begins “schwungvolle” before “definierte Locken”. Schwung maps to volume under RG2-6; its adjective expresses the same stated job. RG-11 selects the first job-bearing phrase, so A volume is correct and B definition skips the earlier volume phrase.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Genieße schwungvolle, definierte Locken für bis zu 24 Stunden” (C1, promise). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-08596bade4.json`.

### wellaflex Schaumfestiger Locken & Wellen, Starker Halt — secondary_jobs

`wellaflex-schaumfestiger-locken-und-wellen-starker-halt` · `sty-08596bade4` · class **a**

| Lane | Normalized value | Emitted trace |
|---|---|---|
| A (Claude Opus) | ["definition","hold_fix"] | {"rule_path":["4.1 gate pass (C1 name+line, C3 verbatim directions)","4.2 name: product noun Schaumfestiger + curl nouns Locken & Wellen = two jobs (R4-Q7) -> first C1 line „schwungvolle, definierte Locken\" -> styling_result, curl definition stated -> li_function yes","aqueous (Aqua r1 leads propellants)","3.4(i) D7: not a curl/straightening sale -> no","3.4(iii) LI G0: PVP r4 + VP/VA r5 above T_LI, no conditioning above T_LI (thin), C1 hold positioning („Starker Halt\" in name) -> excluded_styling_first -> styling","4.5 not held (excluded_styling_first)","5 foam -> mousse"],"reason_code":"3.4(iii) LI G0 excluded_styling_first","boundary_reason":null,"hold_basis":"C1 Wellaflex dots 3/5 => 2; number beats word (C1 name „Starker Halt\" => 3)","notes":"Primary: first job-bearing phrase of the C1 lead „schwungvolle, definierte Locken\" is „schwungvolle\" (Schwung => volume, RG2-6); definition and hold_fix enter as name job words (Schaumfestiger = hold product noun; Locken & Wellen = definition). Ambiguous whether „schwungvolle\" or „definierte Locken\" is the first job-bearing phrase (user-facing: primary_job). candidate_below_tail: Polyquaternium-16 r10 (CA-3) would fire buildup limb 1 / add a weight family. Flex: „kein Verkleben\", „leicht ausbürsten\" are not flex words. Finish: „natürlich gestylt aussehen\" -> unbekannt."} |
| B (Codex) | ["hold_fix","volume"] | {"rule_path":"§4.3 3.4(iii):LI G0/T15 → §5","reason_code":"excluded_styling_first","boundary_reason":null,"hold_basis":"Wellaflex 3/5 → 2; number beats Starker Halt.","notes":["PVP r4 and VP/VA r5 with thin care. Tail PQ-16, chitosan, silicones and oil earn no above-tail credit. Air-drying is explicitly allowed."]} |

**Rules:** `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:750` (§6.10). Exact cited clauses and full frozen evidence are retained in diff.json.

With the ruled-by-text primary volume, exclude volume from secondary candidates. The confirmed name supplies Schaumfestiger/hold_fix then Locken & Wellen/definition (R4-Q7, §4.2 RG3-1); both pass via fixative_film. A {hold_fix, definition} is correct. B retains its erroneous primary definition and repeats the true primary volume as a secondary.

**Correct lane: A; wrong lane: B.** Frozen lane values remain unchanged.

**Frozen evidence:** “Genieße schwungvolle, definierte Locken für bis zu 24 Stunden” (C1, promise). Packet: `data/research/styling-inci/v1.0/r7/packets/claims/sty-08596bade4.json`.

## Hold check

**69/69 raw hold values agree**, including 49 null/null pairs. **20/20 agree where either lane emits a level; 0 mismatches.** Raw hold_level on every cohort record, including null, held profiles and non-Styling routes. Agreement is not an independent claim-to-level oracle; captured C1/C2 hold claims and both bases are retained for every record. No formula or grade is manufactured.

| Value | Lane A count | Lane B count |
|---|---|---|
| 1 | 3 | 3 |
| 2 | 4 | 4 |
| 3 | 4 | 4 |
| 4 | 9 | 9 |
| null | 49 | 49 |

Mismatch list: none. Per-product levels, routes, captured hold claims and lane bases are in diff.json.

## Latent user-facing ambiguities — non-blocking

14 lane reports on 14 products agree in the reported fields. These observations are preserved without elevating them into demonstrated disagreement gaps. A latent secondary observation may coexist with an independently disputed primary on the same product.

| Lane | Product / slug | Fields with agreed values | Lane-reported concern / applied reading |
|---|---|---|---|
| A | Balea Locken Crunchgel<br>`balea-locken-crunchgel` | {"secondary_jobs":["frizz_control","hold_fix"]} | Salt flag from Magnesium Sulfate r11 (whole list); as SA-1 below T_S it would add a salt mechanism -> candidate_below_tail. Flex from house-brand C2 „flexible Struktur"; finish from C2 „schönen Glanz". Secondaries: name product noun Gel -> hold_fix (R4-Q7 names rule; gate natural_film ok), then C2 „Anti-Frizz-Effekt" -> frizz_control (gate: a film). Ambiguity: whether the product noun in a two-job name yields a hold_fix secondary (user-facing). cast_expected yes from „Crunch" in the name. Neutral fact n/a (hold_route absent). |
| A | Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray<br>`balea-professional-glow-und-shine-finishing-spray` | {"primary_job":"shine"} | Secondary frizz_control from house-brand C2 „Wirkt einem Anti-Frizz-Effekt entgegen" / C1 „ANTI-FRIZZ-EFFEKT" (gate wax_lipid). Finish from C2 „seidiges und glänzendes Finish". Lead read from the name; had a lane taken the C1 pack-front line, primary would be frizz_control (user-facing ambiguity). |
| A | Balea Styling Spray Ultra Volumen<br>`balea-styling-spray-ultra-volumen` | {"application_moment":"before_heat"} | Zone: „feuchten Haaransatz … bis in die Längen verteilen" is a range -> all (RG4-14). Moment: „Vor dem Föhnen" + blow-dry with round brush, no air-dry option -> before_heat (ambiguous vs damp_before_drying, user-facing); in-between use on dry hair -> also dry_finish. heat_activated no (blow-dry tip only, R1-Q4). Secondaries: C1 „Anti-Frizz" -> frizz_control (gate: film), then house-brand hold line with strength -> hold_fix. |
| A | BALI CURLS Volumizing Curl Spray<br>`bali-curls-volumizing-curl-spray-refreshing` | {"application_moment":"damp_before_drying"} | Secondaries: name job word Volumizing -> volume (gate salt), then C2 „voluminösen Beachlook" -> texture (beachy look, R4-Q2; gate salt). Moment: operative instruction sprays into wet/damp hair (first-named nass) -> damp_before_drying; directions open with daily refresh use but give no between-washes lead step, so not second_day (ambiguous). Zone: „beginnend an den Spitzen … zum Ansatz" range -> all. |
| A | Bumble and bumble brilliantine<br>`bumble-and-bumble-brilliantine` | {"primary_job":"shine"} | Primary shine per §6.10 R4-Q1 (name alone meets the gate -> primary = the name's one job, gate wax_lipid ok). CONFLICT: §11.8 C row still says „jobs empty + claim_authority_gap" (user-facing ambiguity, primary_job). Weight rich under both marker readings (WL-6 rich Castor + WL-7 + WL-3 + FA-1). Equal alternatives feucht/trocken -> first-named damp primary (§11.8). |
| A | cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER<br>`cantu-lockenspray-comeback-curl-next-day` | {"application_moment":"dry_finish"} | Finish glänzend from C1 „adds shine". candidate_below_tail: Shea r10 (WL-4) would move weight light->medium; Magnesium Sulfate r7 would add a salt mechanism. Moment: strand-by-strand spraying to revive, no shaping act -> dry_finish (first-named trocken), as alverde Locken Refresh; second_day not set because the directions do not lead with a between-washes instruction (ambiguous, user-facing). |
| A | John Frieda Frizz Ease Zauberformel Seiden-Finish Creme<br>`john-frieda-frizz-ease-zauberformel-seiden-finish-creme` | {"primary_job":"shine"} | Secondary frizz_control from C2 „Glättet abstehende Haare … bändigt Frizz" (RG2-7). Moment: a cream rubbed between the palms and worked into dry hair by hand -> dry_restyle (RG3-7); emphasis on flyaways inside a whole-hair instruction -> all (RG2-10). Ambiguity: if a lane reads „Finish" in the name as not a job word, the lead becomes C2 „Glättet abstehende Haare" (frizz_control, li_function yes under R1-Q2 still dry-hair -> same route) — primary_job would differ (user-facing). |
| A | Redken Powder Grip (03 Mattifying Hair Powder)<br>`redken-powder-grip-03` | {"flexibility":"beweglich"} | Finish matt („mattierendes", „ultra-matten Finish"). Flex from C2 „fühlt sich … flexibler an" (flexibel word; could be read as a feel line — user-facing ambiguity). Alcohol denat. r4 outside first 3. No fragrance declared. |
| A | Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz)<br>`schwarzkopf-taft-gel-wax-glanz-halt-2` | {"secondary_jobs":["shine"]} | Weight medium: one persistent family (WL-3 Paraffinum Liquidum r5, a rich member, but only one family). Secondary shine from C2 „glänzendes Finish" (shine word, gate wax_lipid) — ambiguous whether a finish-grade adjective in a claim line also states the shine job (user-facing). |
| A | Syoss Glaze Glanz & Schutz Primer<br>`syoss-glaze-glanz-und-schutz-primer` | {"route":{"destination":"provisional_boundary","state":"blocked:mixed_promise","boundary_reason":"mixed_promise"}} | Ambiguous (route, user-facing): if a lane reads the lead as care (pflege, repariere) the path is 3.4(iii) with real care (Polyglyceryl-3 Betainate Acetate r2, CA-1) -> leave_in; if as shine (Glaze) -> 3.1/3.4 with li_function no. I read the „3in1 Style, Care" co-equal phrasing as mixed. No Styling profile. |
| B | NEQI Diamond Glass Ultimate Styling Spray<br>`neqi-diamond-glass-ultimate-styling-spray` | {"secondary_jobs":[]} | §6.10 secondary candidate scope / R4-H(5): The opening rule admits explicitly promised C1/C2 jobs, while the ordered candidate rule specifically names promise lines. Numeric/strength hold and explicit anti-frizz humidity lines have written exceptions; finish/other typed lines are not expressly reconciled. Applied: Use confirmed-name jobs and promise lines, plus the written hold and anti-frizz humidity exceptions. Other typed lines do not become secondary candidates. |
| B | Balea Styling Spray Volumenpuder Pure Styling<br>`balea-pure-styling-volumenpuder-spray` | {"secondary_jobs":["hold_fix"]} | §6.10 secondary candidate scope / R4-H(5): The opening rule admits explicitly promised C1/C2 jobs, while the ordered candidate rule specifically names promise lines. Numeric/strength hold and explicit anti-frizz humidity lines have written exceptions; finish/other typed lines are not expressly reconciled. Applied: Use confirmed-name jobs and promise lines, plus the written hold and anti-frizz humidity exceptions. Other typed lines do not become secondary candidates. |
| B | Schwarzkopf taft Styling Balm LOCKEN Halt 3<br>`schwarzkopf-taft-styling-balm-locken-halt-3` | {"secondary_jobs":["hold_fix"]} | §6.10 secondary candidate scope / R4-H(5): The opening rule admits explicitly promised C1/C2 jobs, while the ordered candidate rule specifically names promise lines. Numeric/strength hold and explicit anti-frizz humidity lines have written exceptions; finish/other typed lines are not expressly reconciled. Applied: Use confirmed-name jobs and promise lines, plus the written hold and anti-frizz humidity exceptions. Other typed lines do not become secondary candidates. |
| B | got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray)<br>`got2b-gotgloss-glanz-spray` | {"secondary_jobs":[]} | §6.10 explicit anti-frizz promise: The captured humidity line says Frizz-Effekt without Anti, reduction or control wording. It does not unambiguously promise frizz_control. Applied: No frizz_control secondary is inferred from that line. |

B's 1 explicitly calculation-log ambiguity report(s) are retained separately. A's legitimate hold_route ambiguous enum is not counted as a new rule report. Curlicue's worked-example inconsistency produced a disagreement and is adjudicated above, rather than counted latent.

## Agreement and normalization

### User-facing fields

| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |
|---|---|---|---|---|---|
| route | 69/69 | 100 | 0 | 69/69 | 100 |
| subtype | 69/69 | 100 | 0 | 45/45 | 100 |
| hold_level | 69/69 | 100 | 0 | 20/20 | 100 |
| weight | 69/69 | 100 | 0 | 45/45 | 100 |
| finish | 69/69 | 100 | 0 | 45/45 | 100 |
| flexibility | 69/69 | 100 | 0 | 45/45 | 100 |
| target_zone | 69/69 | 100 | 0 | 45/45 | 100 |
| application_moment | 69/69 | 100 | 0 | 45/45 | 100 |
| primary_job | 66/69 | 95.65 | 3 | 41/44 | 93.18 |
| secondary_jobs | 65/69 | 94.2 | 4 | 41/45 | 91.11 |
| provides_heat_protection | 69/69 | 100 | 0 | 45/45 | 100 |
| heat_activated | 69/69 | 100 | 0 | 45/45 | 100 |
| alcohol_note | 69/69 | 100 | 0 | 45/45 | 100 |
| buildup_note | 69/69 | 100 | 0 | 45/45 | 100 |
| neutral_fact | 69/69 | 100 | 0 | 2/2 | 100 |

### Products fully agreeing

- `alverde-beach-waves-spray-seaside-balance`
- `alverde-locken-refresh-spray`
- `balea-haarpuder-volumen-pomegranate`
- `balea-locken-crunchgel`
- `balea-locken-revitalizing-spray`
- `balea-men-styling-powder`
- `balea-professional-definier-spray-traumlocken`
- `balea-professional-glow-und-shine-finishing-spray`
- `balea-professional-haarserum-glow-und-shine`
- `balea-professional-styling-cream-traumlocken`
- `balea-pure-styling-volumenpuder-spray`
- `balea-sea-salt-texture-spray`
- `balea-styling-locken-lotion`
- `balea-styling-spray-ultra-volumen`
- `bali-curls-hydrating-curl-cream`
- `bali-curls-leave-in-spray-curl-defining`
- `bali-curls-strong-hold-flaxseed-gel`
- `bali-curls-volumizing-curl-spray-refreshing`
- `bumble-and-bumble-brilliantine`
- `cantu-lockencreme-kokos`
- `cantu-lockenspray-comeback-curl-next-day`
- `color-wow-dream-coat-supernatural-spray`
- `feschi-smooth-and-shine-anti-frizz-spray-glanzspray`
- `gard-haarspray-extrastark-pumpspray`
- `garnier-fructis-locken-methode-feuchtigkeitsboost-pflege-spray`
- `got2b-anti-frizz-lotion-schmusekatze`
- `got2b-gotgloss-glanz-spray`
- `got2b-spruehkleber-freeze-haarlack`
- `guhl-locken-pflege-und-styling-3in1`
- `john-frieda-frizz-ease-3-tage-glatt-styling-spray`
- `john-frieda-frizz-ease-unendlich-smooth-blow-out-spray`
- `john-frieda-frizz-ease-zauberformel-seiden-finish-creme`
- `john-frieda-haarserum-frizz-ease-der-baendiger`
- `langhaarmaedchen-lockenspray-halt-sprungkraft`
- `langhaarmaedchen-lockenspray-natur-lockenwunder`
- `living-proof-full-dry-volume-texture-spray`
- `moroccanoil-glaettende-creme-smoothing-lotion`
- `moroccanoil-root-boost`
- `moroccanoil-textur-und-volumenpuder`
- `nivea-men-styling-cream-active-craft-stylers`
- `osis-dust-it`
- `osis-flatliner`
- `redken-one-united-all-in-one-multi-benefit-treatment`
- `redken-powder-grip-03`
- `redken-refreshing-curl-mist`
- `redken-root-tease`
- `redken-styling-beach-spray`
- `schwarzkopf-professional-osis-curl-retouch`
- `schwarzkopf-taft-gel-wax-glanz-halt-2`
- `schwarzkopf-taft-haarpuder-volumen`
- `schwarzkopf-taft-matt-wax-halt-5`
- `schwarzkopf-taft-power-haargel-halt-5`
- `schwarzkopf-taft-styling-balm-locken-halt-3`
- `schwarzkopf-taft-x-gliss-silky-shine-shine-coat`
- `syoss-curl-cream-gel-3in1`
- `syoss-glaze-glanz-und-schutz-primer`
- `syoss-glaze-topcoat`
- `syoss-haarspray-max-hold`
- `syoss-hitzeschutzspray-keratin-heat`
- `syoss-professional-performance-max-hold-power-wax`
- `taft-styling-paste-forming-halt-5plus`
- `taft-x-gliss-hitzeschutzspray-lovely-long`
- `wella-eimi-nutricurls-curl-shaper`
- `wella-eimi-nutricurls-fresh-up`

### Normalization

- route is compared as {destination,state,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.
- application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not research-trace wrappers.
- buildup/alcohol notes: {fired:false}, not_fired and does_not_fire -> does_not_fire; {fired:true}, fired and fires -> fires. null remains null.
- Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.
- neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.
- Empty secondary_jobs/d8b_flags collections and null are equivalent only when no Styling profile exists (§4.7). Only explicitly informational_and_non_authoritative historical properties are masked. Any unmarked forbidden value remains scoreable.
- confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.

### Calculation-log fields — non-blocking

806/1380 cells agree (58.41%). This mechanical diagnostic compares free-text traces and asymmetric schemas; it is not a behavioral quality score. All log discrepancies are retained in diff.json.

| Field | Agree / all | Disagree |
|---|---|---|
| reason_code | 0/69 | 69 |
| rule_path | 0/69 | 69 |
| review_triggers | 50/69 | 19 |
| confidence | 0/69 | 69 |
| tail_T_S | 69/69 | 0 |
| tail_T_LI | 58/69 | 11 |
| ingredient_flags | 69/69 | 0 |
| d8b_flags | 68/69 | 1 |
| notes | 0/69 | 69 |
| identity_status | 69/69 | 0 |
| promise_class | 68/69 | 1 |
| result_mechanisms | 69/69 | 0 |
| hold_route | 69/69 | 0 |
| dropped_jobs | 65/69 | 4 |
| hold_basis | 24/69 | 45 |
| lean_route | 54/69 | 15 |
| li_function | 5/69 | 64 |
| provisional | 0/69 | 69 |
| ruled_route | 38/69 | 31 |
| subtype_extras | 31/69 | 38 |

## Targeted lock criteria

| Criterion | Result |
|---|---|
| Every user-facing disagreement is a proven lane error under a clear rule | **FAIL** |
| No user-facing rule gaps (b), packet issues (c), or owner questions (d) | **FAIL** |

**FAIL:** User-facing unresolved cells: neqi-diamond-glass-ultimate-styling-spray::primary_job (b). Only a disagreements are allowed by the targeted lock criterion.

## Scope and reproduction

- Targeted known-product confirmation; not a full new cohort, new unseen validation, catalog activation or live-app proof.
- Human interpretation and proposed contract text are explicit. Joins, normalization, field/product counts, classifications tallies, ruling pass flags, hold counts, manifests and verdict are computed.
- Calculation-log differences and lane-reported latent ambiguities do not block. No subtype minimum or historical unseen gate is added to the user-specified targeted lock rule.
- Agreement is not proof against shared mistakes. Named ruling effects are checked separately; hold_check is a raw A/B agreement check with frozen claim traces, not a newly implemented independent hold classifier.

The script rejects duplicate/missing/extra IDs, broken slug joins, packet binding/version mismatches, absent quoted rule evidence and unadjudicated new user-facing differences. Fixed input SHA-256 values are recorded in diff.json. It writes only sibling diff.json and report.md.

Run `node data/research/styling-inci/v1.0/round-7/diff.js --summary` twice, then compare `shasum -a 256 data/research/styling-inci/v1.0/round-7/diff.json`. No timestamps, randomness or absolute paths enter generated output.

diff.json SHA-256: `04b1cb8e68351bb2325cde93f34ae7fadd820ac907529aec3eb4bff973e207ab`.
