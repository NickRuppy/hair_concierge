# Chaarlie Styling — MINI re-check r11

**761/765 user-facing cells agree (99.48%); 48/51 products fully agree. Lock: FAIL.**

A/B field-cell classifications: **a=0, b=4, c=0, d=0** (3 distinct rule gaps). 4 unresolved user-facing disagreement cells (4 rule-gap cells, 0 packet-issue cells, 0 owner-question cells); clear lane errors and calculation-log differences do not block.

A = Claude Opus; B = Codex. No preference for B. The request lists 15 field columns and refers to 16 records; the explicit task and frozen cohort specify 51. r11 contains 51 records; all are scored. Route is one composite field preserving destination, held/committed state and boundary reason; application_moment is primary only.

Rules/quotes pinned at scoring time to HEAD **`16000a8061058e1a82ee457d67f82285d694508d`** (R9-P). 51/143 screened products selected; bijective cohort/id-map/packet/scope joins verified and 156 frozen artifact hashes checked. Inclusion reasons and exact screen evidence are retained per product in diff.json.

## Ruling effects

| Ruling | Product | Expected | A | B | A / B landed |
|---|---|---|---|---|---|
| R10-Q1 | got2b Styling Puder Volumen Powderfull | {"primary_job":"volume","secondary_jobs":["hold_fix"],"hold_level":null} | {"primary_job":"volume","secondary_jobs":["hold_fix"],"hold_level":null} | {"primary_job":"volume","secondary_jobs":["hold_fix"],"hold_level":null} | yes / yes |
| R10-Q2 | BALI GENTS VOLUMIZING STYLING POWDER | {"primary_job":"volume","secondary_jobs":["texture"]} | {"primary_job":"volume","secondary_jobs":["texture"]} | {"primary_job":"volume","secondary_jobs":["texture"]} | yes / yes |
| R9-Q1 | Balea Styling Spray Volumenpuder Pure Styling | {"required_secondary":"texture"} | {"secondary_jobs":["hold_fix","texture"]} | {"secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R9-Q2 | NEQI Diamond Glass Styling Spray All | {"primary_job":"sleek"} | {"primary_job":"sleek"} | {"primary_job":"sleek"} | yes / yes |
| R9-Q2 | NEQI Diamond Glass Styling Spray All | {"required_secondary":"shine"} | {"secondary_jobs":["frizz_control","shine"]} | {"secondary_jobs":["frizz_control","shine"]} | yes / yes |
| R9-F | got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | {"required_secondary":"frizz_control"} | {"secondary_jobs":["frizz_control"]} | {"secondary_jobs":["frizz_control"]} | yes / yes |
| R8-Q1 | L’Oréal Elvital Big Hair Day | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | N/A | N/A | not in cohort |
| R8-H | Moroccanoil Glättende Creme | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | N/A | N/A | not in cohort |
| R8-Q2 | Balea Haarpuder Volumen (Pomegranate) | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Balea Styling Spray Volumenpuder Pure Styling | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | BALI GENTS VOLUMIZING STYLING POWDER | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["texture"]} | {"primary_job":"volume","secondary_jobs":["texture"]} | yes / yes |
| R8-Q2 | got2b Styling Puder Volumen Powderfull | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | yes / yes |
| R8-Q2 | Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Schwarzkopf taft Haarpuder VOLUMEN | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | yes / yes |
| R8-Q2 | Redken Powder Grip | "The named two-job exception is absent from r11; no regression pass claimed." | N/A | N/A | not in cohort |

R10-Q1 Powerfull WEAK hold_fix: **PASS**. R10-Q2 Bali Gents WEAK texture: **PASS**. R9-Q1 Balea texture, R9-Q2 NEQI All sleek/shine, and R9-F gotGloss frizz: **PASS**. R8-Q1 Big Hair Day, R8-H Moroccanoil Glättende Creme and Redken Powder Grip: **not in r11; no regression pass inferred**.

R8-Q2: **6/6 applicable powder primaries** pass in both, **4/4 explicit texture/grip/structured-look secondaries** pass in both; 0 formula-blocked powder passes suppression only. 0 powders still have a secondary membership dispute. This is a pass for the tested powder-noun rule, not full powder-profile agreement.

R8-H expected behavior is not mixed (generic krauses-Haar definition is not curl definition), then the border-rule Leave-in route. Its absent-cohort observation remains N/A.

### Full screened ruling reach

| Ruling screen | Products | Primary agree | Secondary agree | a / b / c / d cells |
|---|---|---|---|---|
| R10-Q1 | 51 | 50/51 | 48/51 | 0 / 4 / 0 / 0 |
| R10-Q2 | 1 | 1/1 | 1/1 | 0 / 0 / 0 / 0 |
| R9-F | 0 | 0/0 | 0/0 | 0 / 0 / 0 / 0 |

Groups overlap. These are all reached records, including lexical false positives and suppressed profiles. Screen membership does not assign a job; the named oracle checks and individual adjudications decide the reported effects. Exact candidate lines/types and inclusion reasons are in diff.json.

## Every user-facing disagreement

Categories a/b/c/d classify observed field cells, not proposed amendments: a = clear-rule lane error; b = operational rule-text gap with section and fix; c = packet defect; d = an owner choice with no settled policy. The three gaps below concern how existing policy is expressed, so they are b. Their concrete owner questions and recommendations support clarification and do not imply approval.

### Balea PROFESSIONAL Styling Cream Traumlocken — secondary_jobs: b

`balea-professional-styling-cream-traumlocken` · `sty-2d06e6e4b6`. A=["frizz_control","hold_fix"]; B=["frizz_control","volume"]. **Both readings defensible; no lane declared right.**

The C1 phrase presents a leistungsstarke formula for curls voller Sprungkraft. A reads the bounce wording as a WEAK look description; B reads Sprungkraft as STRONG. Both have a basis in step 2: merely describing a result is WEAK, but an explicit emphasized job promise is STRONG. The rule does not decide whether this formula-for/result-noun construction, or the standalone SCHWUNGVOLL slogan, crosses that boundary. Both alternatives pass the same VP/VA r3 gate. If volume is STRONG, it precedes the later graded hold; if WEAK, STRONG frizz and hold fill both slots. Neither selected set is a proven lane error.

Rules: `plans/styling-concept/02-rulings.md:168` (R10-Q1, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:795` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:792` (§6.10, pinned 16000a806105). Affected section: §6.10 procedure step 2 (explicit/emphasized promise versus look description). Frozen C1/C2 evidence: “Schützt effektiv vor Frizz” (C2_house_brand, promise); “LEISTUNGSSTARKE FORMEL FÜR DEFINIERTE, LEBENDIGE LOCKEN VOLLER SPRUNGKRAFT UND NATÜRLICHEM GLANZ” (C1, promise); “SCHWUNGVOLL. DEFINIERT. VERWÖHNT.” (C1, promise); “Halt: mittlerer Halt” (C2_house_brand, hold).

| Exact phrase | Job | A strength | B strength | Trace basis |
|---|---|---|---|---|
| Schützt effektiv vor Frizz | frizz_control | STRONG | STRONG | A explicitly says STRONG; B calls this a strong Frizz promise. |
| LEISTUNGSSTARKE FORMEL FÜR DEFINIERTE, LEBENDIGE LOCKEN VOLLER SPRUNGKRAFT UND NATÜRLICHEM GLANZ | volume | WEAK | STRONG (source not specified) | A explicitly treats fuller bounce as a look description; B explicitly calls Sprungkraft strong but does not identify which of the two Sprungkraft/Schwung lines supplies it. This line is the plausible early strong candidate, not an invented exact B trace. |
| SCHWUNGVOLL. DEFINIERT. VERWÖHNT. | volume | WEAK | NOT_RECORDED | B does not identify the source line of its strong bounce reading. |
| Halt: mittlerer Halt | hold_fix | STRONG | NOT_RECORDED | Strength word clearly makes this STRONG under the rule; B omits this job; its stated strong-volume reading is compatible with volume taking the earlier slot, but B does not give a per-signal trace for this hold line. |

NOT_RECORDED means the lane supplied no explicit strength label; output alone is not treated as proof of its classification.

**Owner question:** For Balea PROFESSIONAL Styling Cream Traumlocken, should “LEISTUNGSSTARKE FORMEL FÜR … LOCKEN VOLLER SPRUNGKRAFT” count as a strong volume promise, so volume takes the second slot, or as a weak look description, so hold takes it?

**Recommendation:** Treat an explicit formula-for result promise as STRONG volume here; retain purely descriptive curl adjectives and isolated slogans as WEAK unless the rule gives them a result-promising construction. This is a proposed amendment, not the scoring oracle.

**Fix:** Clarify §6.10 step 2 and property set §2.12 with a general rule for formula-for result nouns (FÜR … VOLLER SPRUNGKRAFT) and standalone emphatic job slogans, including whether emphasis transfers from FORMEL to the result. Add contrasting examples and replay every reached record; do not use upper-case typography alone as strength.

### Schwarzkopf taft Styling Balm LOCKEN Halt 3 — secondary_jobs: b

`schwarzkopf-taft-styling-balm-locken-halt-3` · `sty-324483ca6e`. A=["frizz_control","hold_fix"]; B=["hold_fix","volume"]. **Both readings defensible; no lane declared right.**

A makes isolated Sprungkraft WEAK and Anti-Frizz-Effekt STRONG. B selects the earlier Sprungkraft with hold, but does not expose strength labels. The standard expressly admits Sprungkraft from a flexibility line, without settling its strength; it distinguishes explicit job promises from passing mentions, without deciding bare Anti-Frizz-Effekt in a comma-separated finish description. Reading that effect noun as an explicit result promise is defensible; reading both bare result nouns as passing mentions is also defensible. The latter puts earlier volume before frizz among WEAK signals. PVP r4 passes both gates. The older r10 Taft lane-error conclusion used chronological order before the new strength procedure and cannot decide r11.

Rules: `plans/styling-concept/02-rulings.md:168` (R10-Q1, pinned 16000a806105); `plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:795` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:792` (§6.10, pinned 16000a806105). Affected section: §6.10 procedure step 2 (bare job labels and result nouns). Frozen C1/C2 evidence: “Halt 3” (C2, hold); “Sprungkraft” (C2, flexibility); “definierte Locken, Anti-Frizz-Effekt” (C2, finish).

| Exact phrase | Job | A strength | B strength | Trace basis |
|---|---|---|---|---|
| Halt 3 | hold_fix | STRONG | STRONG | Both identify confirmed-name/brand-number hold; the unmasked name itself is also recorded. |
| Sprungkraft | volume | WEAK | NOT_RECORDED | A explicitly says WEAK. B records that this flexibility line precedes other secondary candidates, but gives no STRONG/WEAK label. Its selected set is compatible with either volume promoted to STRONG, or volume and frizz both treated WEAK. No unsupported label is attributed to B. |
| definierte Locken, Anti-Frizz-Effekt | frizz_control | STRONG | NOT_RECORDED | A explicitly says STRONG. B has no strength trace for this line; its omission cannot prove whether B treated it WEAK or overlooked it. |

NOT_RECORDED means the lane supplied no explicit strength label; output alone is not treated as proof of its classification.

**Owner question:** For Schwarzkopf taft Styling Balm LOCKEN Halt 3, should the bare “Anti-Frizz-Effekt” be stronger than the earlier bare “Sprungkraft”, so anti-frizz gets the remaining secondary slot?

**Recommendation:** Treat an explicit anti-frizz effect label as STRONG frizz_control and isolated Sprungkraft as WEAK volume; that selects hold_fix + frizz_control. Approve this general wording distinction before applying it as a lane-error oracle.

**Fix:** Clarify §6.10 step 2 and property set §2.12: classify standalone result nouns such as Sprungkraft and Anti-Frizz-Effekt with examples independent of packet type; state whether an effect label alone is an explicit promise or needs an action/benefit construction. Require per-signal strength traces and replay the reached products.

### Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) — primary_job: b

`wella-eimi-nutricurls-curl-shaper` · `sty-44a72edd06`. A="definition"; B="frizz_control". **Both readings defensible; no lane declared right.**

B has the stronger literal R4-Q7 reading: Gel names hold and Curl/Defining/Shaper names definition, so two jobs send primary selection to the first C2 promise, bändigt Frizz. A has a defensible basis in the same §4.2 paragraph’s retained statement that a product noun used as a form in a compound with another product noun supplies no job; A applies this to Gel Cream. The later dispensing-form restriction has spray examples but no defined form vocabulary or explicit Gel Cream decision. D7 separately names Gel Cream as a curl-cream sale, which decides subtype, not the number of name jobs. Under the required both-defensible ceiling, this textual scope ambiguity is a rule gap, not a proven lane error. The secondary cell shares the same cause: excluding definition versus frizz_control as primary changes the selected set; STRONG frizz, name-definition and numbered hold are otherwise supported and VP/VA r3 passes the gate.

Rules: `plans/styling-concept/02-rulings.md:138` (R4-Q7, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:469` (§4.2, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:792` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:795` (§6.10, pinned 16000a806105). Affected section: §4.2 step 1 (RG3-1 form-compound exception versus R4-Q7 product-noun rule); §6.10 primary exclusion. Frozen C1/C2 evidence: “Die Formel bändigt Frizz und schließt Feuchtigkeit ein” (C2, promise); “Haltestufe: 2” (C2, hold); “Das Styling-Gel sorgt für definierte Locken, Kontrolle und Sprungkraft” (C2, other).

| Exact phrase | Job | A strength | B strength | Trace basis |
|---|---|---|---|---|
| Die Formel bändigt Frizz und schließt Feuchtigkeit ein | frizz_control | STRONG | STRONG | Explicit taming promise: A secondary, B primary. |
| Haltestufe: 2 | hold_fix | STRONG | STRONG | Brand-number hold is strong in both readings. |

NOT_RECORDED means the lane supplied no explicit strength label; output alone is not treated as proof of its classification.

Confirmed-name analysis: {"name":"EIMI Nutricurls Curl Shaper (Defining Gel Cream)","A":{"definition":"STRONG / primary","Gel":"form-only; no hold job"},"B":{"definition":"STRONG / secondary","Gel":"STRONG hold job"},"rule":"Curl/Defining/Shaper denotes one definition job and Nutricurls is a collection. Dispute: whether Gel in Gel Cream retains its hold job or is part of the form-only compound exception."}.

**Owner question:** For Wella EIMI Nutricurls Curl Shaper (Defining Gel Cream), does Gel still add a hold job beside Curl, so the first Frizz promise supplies the primary, or does Gel Cream describe only the form, leaving definition primary?

**Recommendation:** Keep Gel as a STRONG hold job in Gel Cream and restrict the form-only exception to explicitly defined dispensing forms. That selects primary frizz_control and secondary definition + hold_fix, matching B; it is a proposed clarification, not a present-rule lane-error finding.

**Fix:** Clarify §4.2’s general compound sentence and R4-Q7 exception together: define dispensing-form scope, expressly classify Gel Cream and Cream Gel, and synchronize §6.10 name vocabulary / property set §2.12. Then replay all compound names reached by that general rule. Count these two cells separately but retain one shared issue_key.

### Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) — secondary_jobs: b

`wella-eimi-nutricurls-curl-shaper` · `sty-44a72edd06`. A=["frizz_control","hold_fix"]; B=["definition","hold_fix"]. **Both readings defensible; no lane declared right.**

B has the stronger literal R4-Q7 reading: Gel names hold and Curl/Defining/Shaper names definition, so two jobs send primary selection to the first C2 promise, bändigt Frizz. A has a defensible basis in the same §4.2 paragraph’s retained statement that a product noun used as a form in a compound with another product noun supplies no job; A applies this to Gel Cream. The later dispensing-form restriction has spray examples but no defined form vocabulary or explicit Gel Cream decision. D7 separately names Gel Cream as a curl-cream sale, which decides subtype, not the number of name jobs. Under the required both-defensible ceiling, this textual scope ambiguity is a rule gap, not a proven lane error. The secondary cell shares the same cause: excluding definition versus frizz_control as primary changes the selected set; STRONG frizz, name-definition and numbered hold are otherwise supported and VP/VA r3 passes the gate.

Rules: `plans/styling-concept/02-rulings.md:138` (R4-Q7, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:469` (§4.2, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:792` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:795` (§6.10, pinned 16000a806105). Affected section: §4.2 step 1 (RG3-1 form-compound exception versus R4-Q7 product-noun rule); §6.10 primary exclusion. Frozen C1/C2 evidence: “Die Formel bändigt Frizz und schließt Feuchtigkeit ein” (C2, promise); “Haltestufe: 2” (C2, hold); “Das Styling-Gel sorgt für definierte Locken, Kontrolle und Sprungkraft” (C2, other).

| Exact phrase | Job | A strength | B strength | Trace basis |
|---|---|---|---|---|
| Die Formel bändigt Frizz und schließt Feuchtigkeit ein | frizz_control | STRONG | STRONG | Explicit taming promise: A secondary, B primary. |
| Haltestufe: 2 | hold_fix | STRONG | STRONG | Brand-number hold is strong in both readings. |

NOT_RECORDED means the lane supplied no explicit strength label; output alone is not treated as proof of its classification.

Confirmed-name analysis: {"name":"EIMI Nutricurls Curl Shaper (Defining Gel Cream)","A":{"definition":"STRONG / primary","Gel":"form-only; no hold job"},"B":{"definition":"STRONG / secondary","Gel":"STRONG hold job"},"rule":"Curl/Defining/Shaper denotes one definition job and Nutricurls is a collection. Dispute: whether Gel in Gel Cream retains its hold job or is part of the form-only compound exception."}.

**Owner question:** For Wella EIMI Nutricurls Curl Shaper (Defining Gel Cream), does Gel still add a hold job beside Curl, so the first Frizz promise supplies the primary, or does Gel Cream describe only the form, leaving definition primary?

**Recommendation:** Keep Gel as a STRONG hold job in Gel Cream and restrict the form-only exception to explicitly defined dispensing forms. That selects primary frizz_control and secondary definition + hold_fix, matching B; it is a proposed clarification, not a present-rule lane-error finding.

**Fix:** Clarify §4.2’s general compound sentence and R4-Q7 exception together: define dispensing-form scope, expressly classify Gel Cream and Cream Gel, and synchronize §6.10 name vocabulary / property set §2.12. Then replay all compound names reached by that general rule. Count these two cells separately but retain one shared issue_key.

## Hold check

**51/51 authoritative hold values agree**; 21 numeric levels emitted and 30 null/null. Raw storage: 51/51 agree. Independent packet-derived claim/scale/suppression oracle: **51/51 correct in both**, 0 failures. Ungraded hold can leave hold_level null regardless of the secondary signal-strength question.

C1/C2 claim-only scales/words, numbers before words, conflicting strengths median rounded up, then lane-specific profile-emission gate. No number from formula or duration. Strength vocabulary does not decide secondary eligibility.

| Product | A / B | Packet-derived expected A / B | Captured level |
|---|---|---|---|
| ALCINA Ansatz Volumen Spray Aerosol | 3 / 3 | 3 / 3 | 3 |
| ALCINA Styling Mousse Aerosol | 2 / 2 | 2 / 2 | 2 |
| Balea Finishing Spray Glow & Care | null / null | null / null | null |
| Balea Föhnlotion Volume Effect | null / null | null / null | null |
| Balea Glattspray Anti-Frizz | null / null | null / null | null |
| Balea Haargel Hair Jelly (Styling Hair Jelly) | null / null | null / null | null |
| Balea Haarpuder Volumen (Pomegranate) | 3 / 3 | 3 / 3 | 3 |
| Balea Styling Glow Wax | null / null | null / null | null |
| Balea Styling WAX STICK | null / null | null / null | null |
| Balea Locken Crunchgel | null / null | null / null | null |
| Balea Locken Revitalizing Spray | null / null | null / null | null |
| Balea Overnight Wellenspray | null / null | null / null | null |
| Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray | null / null | null / null | null |
| Balea PROFESSIONAL Styling Cream Traumlocken | 2 / 2 | 2 / 2 | 2 |
| Balea Styling Spray Volumenpuder Pure Styling | 1 / 1 | 1 / 1 | 1 |
| Balea Sea Salt Texture Spray | null / null | null / null | null |
| Balea Styling Spray Ultra Volumen | 4 / 4 | 4 / 4 | 4 |
| Bali Curls Sleek Stick Brows & Edges | 3 / 3 | 3 / 3 | 3 |
| BALI CURLS Haargel Strong Hold Flaxseed | 4 / 4 | 4 / 4 | 4 |
| BALI CURLS Volumizing Curl Spray | null / null | null / null | null |
| BALI GENTS VOLUMIZING STYLING POWDER | null / null | null / null | null |
| cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER | null / null | null / null | null |
| got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) | null / null | null / null | null |
| got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) | null / null | null / null | null |
| got2b Styling Puder Volumen Powderfull | null / null | null / null | null |
| GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) | null / null | null / null | null |
| John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) | null / null | null / null | null |
| John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | null / null | null / null | null |
| John Frieda Spray Volume Lift Pushed-up Dry Texture | null / null | null / null | null |
| KMS Thermashape 2-in-1 Spray | 4 / 4 | 4 / 4 | 4 |
| KMS Thermashape Straightening Creme | null / null | null / null | null |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt | 4 / 4 | 4 / 4 | 4 |
| L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt | 3 / 3 | 3 / 3 | 3 |
| Moroccanoil Trockenes Texturspray (Dry Texture Spray) | null / null | null / null | null |
| Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | null / null | null / null | null |
| Moroccanoil Volumizing Spray (Volumizing Mist) | null / null | null / null | null |
| NEQI Diamond Glass Styling Spray All | null / null | null / null | null |
| NEQI Diamond Glass Ultimate Styling Spray | null / null | null / null | null |
| Redken Root Tease | null / null | null / null | null |
| Redken Wax Spray (Redken Spray Wax) | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) | 1 / 1 | 1 / 1 | 1 |
| Schwarzkopf taft Haarpuder VOLUMEN | null / null | null / null | null |
| Schwarzkopf taft Haarspray GLANZ Halt 4 | 3 / 3 | 3 / 3 | 3 |
| Schwarzkopf taft Styling Balm LOCKEN Halt 3 | 2 / 2 | 2 / 2 | 2 |
| Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine | null / null | null / null | null |
| Syoss Max Hold Wax | 4 / 4 | 4 / 4 | 4 |
| Wella Professionals EIMI Glam Mist Shinespray | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream) | 1 / 1 | 1 / 1 | 1 |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray | 3 / 3 | 3 / 3 | 3 |
| Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm | 1 / 1 | 1 / 1 | 1 |
| wellaflex Schaumfestiger Locken & Wellen, Starker Halt | 2 / 2 | 2 / 2 | 2 |

Rules: `docs/research/styling-inci/v1.0/styling-classification-standard.md:889` (§7.2, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:886` (§7.2, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:890` (§7.2, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:898` (§7.3, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:902` (§7.3, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:906` (§7.3, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:915` (§7.4, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:918` (§7.4, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:930` (§7.4, pinned 16000a806105); `docs/research/styling-inci/v1.0/styling-classification-standard.md:615` (§4.7, pinned 16000a806105). All cohort hold values are checked from their own C1/C2 claims and profile-emission state; no hold grade is inferred from job signal strength or formula. Full claim traces are retained in diff.json.

## Latent ambiguities and reported concerns — non-blocking

10 lane-A hypothetical alternatives concern products with complete user-facing agreement. These are not added to a/b/c/d disagreement counts. They need no owner answer to score this comparison.

- **Balea Finishing Spray Glow & Care:** Lane-A note: AMP-Acrylates r11 below T_S. Signals: name Finishing shine (primary); C2 'Finishing Spray' dup; 'Mit pflegendem Camelinaöl' callout; 'seidiges Haargefühl' feel; finish 'beeindruckenden Glanz' shine dup; humidity 'Mit einem effektiven Anti-Frizz Effekt bleibt das Haar ... glatt und kontrolliert' -> frizz_control STRONG, sleek WEAK ('glatt' look), 'kontrolliert' hold WEAK; other 'perfektes Finish' none. STRONG: frizz_control; WEAK fill: sleek (first weak; gate wax_lipid ok). AMBIGUITY (user-facing): weak 'glatt' read as sleek; alternative second slot hold_fix ('kontrolliert') or none. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Balea Styling WAX STICK:** Lane-A note: Structuring wax_lipid: Carnauba r6, Hydrogenated Rapeseed r7, Hydrogenated Palm r8. Weight rich (families a, b, c with rich members). form_label wax, base anhydrous. Directions: stroke stick over dry hair to fix flyaways -> dry_finish, surface (RG4-14). Signals: name Wax hold_fix (primary); C2 'Haarwachs-Stift' dup; C2 'glattes & glänzendes Finish' -> sleek WEAK, shine WEAK (look description); C2 'Bändigt abstehende Babyhaare' -> frizz_control STRONG; C2 paragraph 'Sleek-Look' sleek WEAK, Babyhaare frizz dup; C1 'einfache Fixierung' hold_fix STRONG dup (RG4-12); C1 'glattes, glänzendes Finish', 'Sleek-Look' WEAK dup; C1 headline 'auch gegen Babyhaare' frizz dup. STRONG: frizz_control; WEAK fills: sleek (first weak in packet order). AMBIGUITY (user-facing): if 'Für ein glattes & glänzendes Finish' were read as an explicit (STRONG) promise, the list would be [sleek, shine]. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Balea Overnight Wellenspray:** Lane-A note: Sodium Bisulfite r7 is NC-1 (not a marker). Neutral fact: gel, level null, VP/VA r5. cast_expected unbekannt. Directions damp or dry, wind/braid overnight -> damp_before_drying, also dry_restyle. Signals: name Wellen definition (primary); C2 'für Locken über Nacht' dup; 'Schonendes Styling ohne Hitze' none; 'Flexibler Halt' hold WEAK; paragraph 'verleiht Wellen und Locken eine tolle Sprungkraft' -> volume STRONG (explicit, emphasised), 'fixiert die Frisur zuverlässig' -> hold_fix STRONG (RG4-12); hold line WEAK dup. STRONG text order: volume, hold_fix. AMBIGUITY (user-facing order only): if 'tolle Sprungkraft' is read WEAK -> [hold_fix, volume]. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Bali Curls Sleek Stick Brows & Edges:** Lane-A note: Acrylates Crosspolymer-3 r2 is FX-U; moves nothing because PVP r3 is present. Brow use recorded; target hairline (first-named Augenbrauen; edges product). AMBIGUITY (user-facing): primary from the name word 'Sleek' (sleek) — the vocabulary reserves sleek for a whole-style smooth look and maps taming Babyhaare to frizz_control; the lead C2 line 'Präziser Halt für Brows & Babyhaare' would give hold_fix if the name were judged not to decide. Signals: name 'Sleek' sleek (primary); C2 'Präziser Halt ... bringt ... zuverlässig in Form' -> hold_fix STRONG (explicit fixing/shaping promise); 'Babyhaare' -> frizz_control WEAK; C2 hold 'starken ... Halt' hold_fix STRONG dup; finish line none; duration none. Result [hold_fix, frizz_control]; gates pass (fixative_film). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **BALI CURLS Volumizing Curl Spray:** Lane-A note: Directions: daily on wet or dry hair; main instruction spray into damp/wet hair from ends to roots (range -> all). 'Mit natürlichen & pflegenden Inhaltsstoffen' is a call-out, no care job. Signals: name 'Volumizing' -> volume STRONG (name); name 'Curl' read as revival (refresh, dup); C2 'erfrischt deine Locken' refresh dup; 'voluminösen Beachlook' -> volume dup, 'Beachlook' -> texture WEAK (beachy look, R4-Q2); finish 'voluminösen Beachlook' dup. Gates: volume and texture pass via salt. AMBIGUITY (user-facing): reading 'Beachlook' as the R4-Q2 beachy texture look; if not, secondaries = [volume]. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray:** Lane-A note: Argan r13, Silicone Quaternium-18 r22 etc. below T_S would add families / buildup limb 1 -> candidate_below_tail. Duplicate Sclerocarya r14/r26 and typo r29 sit below T_S -> inci_tail_defect. heat_activated no (no C1/C2 activation statement). Directions towel-dried, comb, blow-dry with tension -> before_heat. AMBIGUITY (user-facing): primary from 'Smooth' in 'Unendlich Smooth' (sleek); if 'Unendlich Smooth' is a line name the lead falls to C2 'verwandelt Frizz in seidig-glattes ... Haar' -> frizz_control primary, and secondaries would become [sleek, shine]. Signals: C2 'Styling-Spray mit Schutz vor Hitze und Luftfeuchtigkeit' no vocab job; 'verwandelt Frizz in seidig-glattes, hochglänzendes Haar' -> frizz_control STRONG, sleek dup, shine STRONG; 'glänzender ... Blowout' shine; 'Bändigt Frizz und verleiht Glanz' frizz/shine STRONG dup. Result [frizz_control, shine]; gates pass (silicone_coat). Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **KMS Thermashape 2-in-1 Spray:** Lane-A note: Generic Acrylates Copolymer r3 corroborated by FX-2c (non-aqueous). Polysilicone-9 r8 SI-4/FX-U: silicones flag only. heat_activated yes ('Hitzereaktives Spray'). Heat claim 'Reduziert Hitzeschädigungen und Haarbruch' -> claim_only. Finish C2 'Halt und Glanz als Finish-Spray' -> glänzend. Directions: dry hair before hot tools; re-spray to fix -> before_heat, also dry_finish. Signals: C2 line 1 'Glätten' sleek (primary); 'für Lockenstylings mit Hot Tools' = use suitability, not an explicit define promise (no definition); 'Verleiht zusätzlichen Halt und Glanz' -> hold_fix STRONG (explicit), shine STRONG -> fails gate (no wax_lipid/silicone_coat) dropped; line 2 'Gibt dem Haar Form' hold dup; line 3 'extra Halt' hold dup. Result [hold_fix]. AMBIGUITY (user-facing): if 'Lockenstylings' were read as a definition promise, secondaries = [definition, hold_fix]; primary could also be argued null-then-sleek. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **NEQI Diamond Glass Styling Spray All:** Lane-A note: T_S booster Ethylhexylglycerin r8 above PR-1 r9 -> unresolved, same values both readings. Silicone Quaternium-18 r10 below T_S would fire buildup limb 1 -> candidate_below_tail. heat_activated yes (C2 'hitzeaktivierten Polymere'). No Parfum -> fragrance false. Signals: line 1 'intensiv glänzenden, glatten Glass Hair-Effekt' -> sleek (primary, R9-Q2), shine STRONG (emphasised 'intensiv'); same line 'reduziert Frizz' -> frizz_control STRONG; 'seidig glatte', 'spiegelglatten', 'Glättung' sleek dup; 'Verbesserte Kämmbarkeit' care/feel; C1 heat line 'unglaublichem Glanz' shine dup. STRONG text order: shine, frizz_control. Gates pass via silicone_coat. AMBIGUITY (user-facing order only): if 'glänzenden' is read WEAK the list is [frizz_control, shine]. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **NEQI Diamond Glass Ultimate Styling Spray:** Lane-A note: T_S booster Ethylhexylglycerin r9 above PR-1 Hydroxyacetophenone r10 -> unresolved; both readings same values. VP/Methacrylamide r8 at T_S-1 (boundary, moderate). No Parfum in list -> fragrance false. Silicone Quaternium-18 r11 below T_S would fire buildup limb 1 -> candidate_below_tail. heat_activated yes: C2 'hitzeaktivierte Polymere'. Primary null (R7-F, standard example) + primary_job_unresolved. Signals: promise lines none (styling/heat/polymers/water repellence/Föhnzeit); C2 finish 'glänzend (Glass-Hair-Effekt, spiegelglatt, ultimativer Glanz)' -> shine STRONG (emphasis 'ultimativer'), sleek WEAK (spiegelglatt); C2 other 'Starker Anti-Frizz-Effekt' -> frizz_control STRONG; 'Ultra-leichte Textur' = product consistency, no job. STRONG in packet order: shine (finish line) then frizz_control (other line). AMBIGUITY (user-facing order only): if the finish line is read WEAK the list becomes [frizz_control, shine]. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.
- **Wella Professionals EIMI Glam Mist Shinespray:** Lane-A note: D8b rule 1: hold claim on shine_finish with no hold mechanism (silicone_coat only) -> flag, level unchanged (RG2-22). Signals: name Shinespray shine (primary); C2 promise 1 'Glanzspray' dup, 'Haltegrad 1' -> hold_fix STRONG (brand number) -> fails gate -> dropped; C2 promise 2 'Glanzpomade für ein glattes und glänzendes Finish' -> sleek WEAK (look), shine dup; C2 promise 3 'Anti-Frizz-Effekt und Schutz vor Luftfeuchtigkeit' -> frizz_control STRONG; promise 4/hold line hold dup. STRONG compatible: frizz_control; WEAK fills: sleek (gate silicone_coat ok). AMBIGUITY (user-facing): 'glattes ... Finish' as a sleek look description; if not counted, secondaries = [frizz_control]. Recommendation: Keep the agreed result. This is a lane-reported hypothetical alternate reading, not a demonstrated A/B rule gap; check the relevant existing named/operational ruling before any amendment.


Latent alternatives are recorded independently of actual disagreements. Storage order compares selected members as the same unordered set; it is a calculation-log difference only. Exact raw ordered arrays are retained below and in diff.json.

- **NEQI Diamond Glass Ultimate Styling Spray:** A=["shine","frizz_control"]; B=["frizz_control","shine"]. Same selected set; non-blocking.

## User-facing agreement

| Field | Agree / all | Disagree | Agreement |
|---|---|---|---|
| route | 51/51 | 0 | 100% |
| subtype | 51/51 | 0 | 100% |
| hold_level | 51/51 | 0 | 100% |
| weight | 51/51 | 0 | 100% |
| finish | 51/51 | 0 | 100% |
| flexibility | 51/51 | 0 | 100% |
| target_zone | 51/51 | 0 | 100% |
| application_moment | 51/51 | 0 | 100% |
| primary_job | 50/51 | 1 | 98.04% |
| secondary_jobs | 48/51 | 3 | 94.12% |
| provides_heat_protection | 51/51 | 0 | 100% |
| heat_activated | 51/51 | 0 | 100% |
| alcohol_note | 51/51 | 0 | 100% |
| buildup_note | 51/51 | 0 | 100% |
| neutral_fact | 51/51 | 0 | 100% |

### Products fully agreeing

- ALCINA Ansatz Volumen Spray Aerosol (`alcina-ansatz-volumen-spray-aerosol`).
- ALCINA Styling Mousse Aerosol (`alcina-styling-mousse-aerosol`).
- Balea Finishing Spray Glow & Care (`balea-finishing-spray-glow-und-care`).
- Balea Föhnlotion Volume Effect (`balea-foehnlotion-volume-effect`).
- Balea Glattspray Anti-Frizz (`balea-glattspray-anti-frizz`).
- Balea Haargel Hair Jelly (Styling Hair Jelly) (`balea-haargel-hair-jelly`).
- Balea Haarpuder Volumen (Pomegranate) (`balea-haarpuder-volumen-pomegranate`).
- Balea Styling Glow Wax (`balea-haarwachs-glow-wax`).
- Balea Styling WAX STICK (`balea-haarwachs-styling-stick`).
- Balea Locken Crunchgel (`balea-locken-crunchgel`).
- Balea Locken Revitalizing Spray (`balea-locken-revitalizing-spray`).
- Balea Overnight Wellenspray (`balea-overnight-wellenspray`).
- Balea PROFESSIONAL Leave-In Glow&Shine Finishing Spray (`balea-professional-glow-und-shine-finishing-spray`).
- Balea Styling Spray Volumenpuder Pure Styling (`balea-pure-styling-volumenpuder-spray`).
- Balea Sea Salt Texture Spray (`balea-sea-salt-texture-spray`).
- Balea Styling Spray Ultra Volumen (`balea-styling-spray-ultra-volumen`).
- Bali Curls Sleek Stick Brows & Edges (`bali-curls-sleek-stick-brows-and-edges`).
- BALI CURLS Haargel Strong Hold Flaxseed (`bali-curls-strong-hold-flaxseed-gel`).
- BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`).
- BALI GENTS VOLUMIZING STYLING POWDER (`bali-gents-haarpuder-volumizing-styling-powder`).
- cantu SHEA BUTTER COMEBACK CURL NEXT DAY CURL REVITALIZER (`cantu-lockenspray-comeback-curl-next-day`).
- got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray) (`got2b-gotgloss-glanz-spray`).
- got2b Lockenspray Refresher Curlz (gotCURLZ Locken Refresher Spray) (`got2b-lockenspray-refresher-curlz`).
- got2b Styling Puder Volumen Powderfull (`got2b-styling-puder-volumen-powderfull`).
- GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray) (`guhl-foehn-spray-langzeit-volumen`).
- John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme) (`john-frieda-frizz-ease-traumlocken-lockencreme`).
- John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray (`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray`).
- John Frieda Spray Volume Lift Pushed-up Dry Texture (`john-frieda-volume-lift-pushed-up-dry-texture-spray`).
- KMS Thermashape 2-in-1 Spray (`kms-thermashape-2-in-1-spray`).
- KMS Thermashape Straightening Creme (`kms-thermashape-straightening-creme`).
- L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt (`loreal-paris-elnett-haarspray-extra-starker-halt`).
- L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`).
- Moroccanoil Trockenes Texturspray (Dry Texture Spray) (`moroccanoil-dry-texture-spray`).
- Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) (`moroccanoil-textur-und-volumenpuder`).
- Moroccanoil Volumizing Spray (Volumizing Mist) (`moroccanoil-volumizing-spray`).
- NEQI Diamond Glass Styling Spray All (`neqi-diamond-glass-styling-spray-all`).
- NEQI Diamond Glass Ultimate Styling Spray (`neqi-diamond-glass-ultimate-styling-spray`).
- Redken Root Tease (`redken-root-tease`).
- Redken Wax Spray (Redken Spray Wax) (`redken-wax-spray`).
- Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz) (`schwarzkopf-taft-gel-wax-glanz-halt-2`).
- Schwarzkopf taft Haarpuder VOLUMEN (`schwarzkopf-taft-haarpuder-volumen`).
- Schwarzkopf taft Haarspray GLANZ Halt 4 (`schwarzkopf-taft-haarspray-glanz-halt-4`).
- Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine (`schwarzkopf-taft-x-gliss-silky-shine-shine-coat`).
- Syoss Max Hold Wax (`syoss-professional-performance-max-hold-power-wax`).
- Wella Professionals EIMI Glam Mist Shinespray (`wella-eimi-glam-mist-shine-spray`).
- Wella Professionals EIMI Volume Sugar Lift Volumenspray (`wella-eimi-sugar-lift`).
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

Calculation log: 476/765 cells agree; 289 differences, none blocking. Raw/normalized user fields, all exclusions, log differences and secondary storage-order differences are retained in diff.json. No held profile is masked.

## Lock predicate

| Criterion | Result |
|---|---|
| Every user-facing A/B disagreement is a proven lane error against a clear rule | FAIL |
| No unresolved user-facing rule gaps (b), packet issues (c), or owner questions (d) | FAIL |

**FAIL: 4 unresolved user-facing disagreement cells (4 rule-gap cells, 0 packet-issue cells, 0 owner-question cells); clear lane errors and calculation-log differences do not block.**

- Known-product targeted MINI r11, not new unseen validation or a full 143-product revalidation.
- R8-Q1 Big Hair Day, R8-H Moroccanoil Glättende Creme and Redken Powder Grip are absent; no two-lane regression pass is inferred for absent records.
- Agreement and passing named effects do not resolve the explicit-promise versus look-description strength threshold. Both-defensible readings are b/d, never fabricated lane errors.
- Reported hypothetical alternatives on agreed values are separate non-blocking observations under the requested lock comparison.
- Older lexicons are pinned and fingerprinted as provenance; v0.5 and the governing ledger are the current authority.
- No frozen inputs corrected, no lock reinstated, no commit, no catalog or production action.

## Pinned governing quotations

`plans/styling-concept/02-rulings.md:168` (R10-Q1, pinned 16000a806105)

> | R10-Q1 | **Secondary jobs are filled by signal strength (owner's design).** Every job mention in a C1/C2 line is a signal. **Strong signal:** an explicit job promise („für Volumen & Textur", „reduziert Frizz"), a strength word or brand number („starker Halt", „Halt 3"), or a job word in the product name. **Weak signal:** a passing mention without strength or emphasis („mit natürlichem Halt", „spürbarer Halt", „Halt für bis zu 24 Stunden", a look description). The two secondary slots are filled with strong signals first (claim order), then weak signals only if a slot is still free. Pure feel lines never count (R9-Q1). The hold LEVEL is unaffected (no strength ⇒ „keine Herstellerangabe"). E.g. got2b Puder Volumen Powderfull ⇒ primary volume, secondary hold_fix (weak, slot free). Refines RG3-16/R9-Q1. |

`plans/styling-concept/02-rulings.md:169` (R10-Q2, pinned 16000a806105)

> | R10-Q2 | **„Struktur"/„strukturiert" is a texture word** (owner); as a look description („natürlich strukturierter Look", Bali Gents Haarpuder) it is a weak texture signal under R10-Q1. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:793` (§6.10, pinned 16000a806105)

> 2. **Classify each signal, not the whole line.** **STRONG** = an explicit job promise, a strength word or brand number attached to the job, or an eligible job word in the confirmed product name. **WEAK** = a passing job mention without strength/emphasis, or a look description. A look description remains WEAK when merely describing a result; an explicit emphasized job promise is STRONG. A line may contain both classes. Duration or flexibility alone does not provide hold strength. **RG3-16's “hold_fix needs a strength word or number” now defines a STRONG hold signal; a bare hold mention is a WEAK hold signal**, rather than being excluded. An explicit fixing promise still supplies STRONG `hold_fix` without a grade (RG4-12). A masked strength/number still identifies a hold job, but determine its strength from the unmasked C claim packet; a generic mask is not itself strength evidence. Signal strength is an ordering label, never a hold level: no qualifying hold strength/number still gives `chaarlie_hold_level: null` under §7.2.

`docs/research/styling-inci/v1.0/styling-classification-standard.md:795` (§6.10, pinned 16000a806105)

> 4. **Fill at most two secondary slots.** Exclude the primary's job. Stable-partition the collected signals into STRONG first, then WEAK: within STRONG, confirmed-name jobs retain name order before claim signals; within each strength class, claim order means packet order and then text order within a line (RG4-17). Walk all STRONG candidates before any WEAK candidate, deduplicating jobs as they are considered (a later STRONG mention therefore takes precedence over an earlier WEAK mention of the same job). Apply the unchanged formula gate to every candidate; drop and record failures, and continue to refill from the next candidate. Only when fewer than two compatible STRONG jobs remain may WEAK jobs fill free slots, in their original order. A primary formula conflict retains the primary and flags review. No third secondary is emitted.

`plans/styling-concept/02-rulings.md:138` (R4-Q7, pinned 16000a806105)

> | R4-Q7 | **A product-type noun in the name names the job; a shine/strength qualifier is the finish/grade** (as „Haarspray Glanz"): Taft Gel Wax Glanz ⇒ `molding`, finish „glänzend", D8b flag kept internally; got2b Texture Clay ⇒ main job hold. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:469` (§4.2, pinned 16000a806105)

> 1. the **job word of the confirmed product name**, when it names exactly one (Lockencreme ⇒ definition; Hitzeschutzspray ⇒ heat protection; Finishing-Spray / Glanzspray ⇒ finish). **A name with two or more job words does not decide; go to step 2** `[R1-H1]` (Elnett „Stylingspray Hitzeschutz 3 Tage Glatt" ⇒ pack front „Hitze Styling-Spray, glatt 3 Tage, starker Halt" ⇒ styling result, as PH1-14 rules). **Product noun Puder/Powder `[R8-Q2]`:** Puder/Powder names `volume`, including Haarpuder and Volumenpuder; it never defaults to `hold_fix` or `texture`. Texture/grip promised in a C1/C2 line is an eligible secondary under §6.10. Redken „Powder Grip“ itself names two jobs — Powder = `volume`, Grip = `texture` — so step 2/3 decides the lead; other product nouns retain their mappings. **Counting the name's job words `[RG2-21, RG2-5]`:** the product-type noun (Haarspray, Gel, Wachs, Puder, Schaumfestiger) names the job when it is the only job noun, and a shine or strength qualifier in the same name is not a second job (`schwarzkopf-taft-haarspray-glanz-halt-4` „Haarspray Glanz Halt 4" ⇒ one job, hold, so `hairspray`, as §5 says); name job words that name the same job count as one (Curl + Defining + Shaper on a curl product; „Glanz-Spray … Silky Shine"). **Which name words are job words `[RG3-1]`:** a **curl or wave word** in the product's own name (Locken-, Curl, Curls, Wellen-, Wave/Waves) is a curl job word `[R7-Q2]` — definition, or refresh when the product revives curls; a **salt noun** (Salzspray, Sea Salt Spray) names texture; a **product noun used as a form in a compound with another product noun** (Wax Spray, Spray Wax, Sprühwachs, Gel-Spray) names the form, not a job — go to step 2/3. Round-3 outcomes (historical, subject to the R7 amendment above): `bali-curls-volumizing-curl-spray-refreshing` („Volumizing Curl Spray": two job words ⇒ first C2 line, revival ⇒ held `refresher`); `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` (name has hold + definition; the C1 phrase „für schwungvolle, definierte Locken“ ⇒ primary `definition` under R7-Q1 ⇒ 3.4 (iii)); `kevin-murphy-killer-curls` (two job words ⇒ the C2 hold line leads ⇒ primary `hold_fix`; the route stays D7 `curl_cream`, held); `jean-und-len-sea-salt-spray` (salt noun ⇒ texture); `redken-wax-spray` (Wax Spray names the form ⇒ first C2 line „Texturierendes Sprühwachs" ⇒ texture ⇒ `texture_spray`, §5). **Product noun vs qualifier, also inside a compound `[R4-Q7]`:** a product-type noun in the name (Wachs/Wax, Paste, Clay, Gel, Pomade, Fiber, Haarspray) names the job (molding or hold); a **shine or strength qualifier** in the name (Glanz, Glow, Shine, Strong, Power) is the finish or the grade, **never a second job — also inside a compound** (as „Haarspray Glanz"). Two product nouns of the same job count once. A **true job word naming a different job** beside the product noun (Texture, Volume, Curl; Grip beside Powder) makes two jobs ⇒ the name decides nothing ⇒ the lead line decides (step 2/3). The RG3-1 form compound stays for a product noun joined with a dispensing-form noun (Wax Spray, Sprühwachs, Gel-Spray: the spray is the form). Cases: `schwarzkopf-taft-gel-wax-glanz-halt-2` („Gel Wax Glanz": Gel and Wax name one job, Glanz is the finish) ⇒ `molding`, primary `hold_fix`, finish `glänzend`, and its D8b flag is kept internally (R4-Q7; §7.5); `got2b-styling-paste-istyler-texture-clay` („Styling Paste … Texture Clay": Paste/Clay + the job word Texture ⇒ two jobs) ⇒ the C2 line „… ultra krassem Halt" leads ⇒ primary `hold_fix`, `texture` secondary; `balea-haarwachs-glow-wax` (Glow is a qualifier) ⇒ `hold_fix`. **Look names and shine nouns `[R4-Q2]`:** „Beach Waves", „Strandwellen", „beachy" name the **salt-spray texture look** ⇒ `texture` (`li_function: no`), not curl definition; RG3-1's wave nouns cover curl/wave definition and revival products („Wellen-Spray", „Wellenauffrischer"), not beach-look names (`alverde-beach-waves-spray-seaside-balance` ⇒ texture ⇒ 3.4 (ii) ⇒ committed `salt_spray`). „Glaze", „Topcoat" and „Gloss" are shine job nouns (with the R2-Q3 list: Glanz, Shine, Gloss, Finish) ⇒ `syoss-glaze-topcoat` („Glaze Topcoat": one job, shine; R3-Q3 lets the one-job name win) ⇒ `styling_result` ⇒ 3.5 ⇒ committed `shine_finish`. Slogans in a name („Big Hair Day", „Salon Blow-Out") name no job and are skipped (RG2-17). **Shop-title fallback `[R3-Q2]`:** the confirmed name is the pack name (C1) or the brand's German-page name (C2). When **neither** shows the product name, the **product-type noun of the retailer's product title** (Hitzeschutzspray, Öl, Serum, Haarspray, Gel, Wachs …; dm „syoss **Hitzeschutzspray** Keratin") serves as the confirmed-name job word for this step and for D2 (§4.3 3.1), with review `name_from_retailer_title`, **provided the type noun agrees across the retailer titles captured `[R3-H4 (d)]`** — two titles with different type nouns (e.g. „Hitzeschutzspray" vs „Haarspray") give no fallback: the name decides nothing, the lead falls to steps 2–3, review `retailer_title_type_noun_conflict` (R1-H1's two-job-word rule covers two nouns in **one** name). **Every other word of a retailer title never counts** (R2-H1, the C3 rule): qualifiers, variant names, ingredient words and any second noun stay C3 traces. The real pack names of the products concerned are captured (29 confirmed names were retailer-title only in round 3, node, `round-3/diff.json` `packet_checks.confirmed_name_tier_C3`; P3-7, R3-T), and a captured pack or brand-page name replaces the fallback (the round-4 freeze replaces it from `capture/packnames-r7.json` wherever A3/A11 confirm a name, §4.6). Cases: `syoss-hitzeschutzspray-keratin-heat` ⇒ heat protection ⇒ 3.3 (§11.21); `loreal-elvital-haaroel-oel-magique-alle-haartypen`, `john-frieda-haarserum-frizz-ease-der-baendiger`, `garnier-fructis-sleek-and-stay-heat-activated-serum` ⇒ „Öl"/„Serum" ⇒ D2 by the letter (§4.6);

`plans/styling-concept/02-rulings.md:164` (R9-Q1, pinned 16000a806105)

> | R9-Q1 | **Secondary jobs may come from ANY C1/C2 claim line — promise, finish or other-typed — for every product** (owner); pure feel lines without a result („fühlt sich weich an") never count. Replaces the Puder-only „R9 clarification" written by Claude after round 9 without a ruling (flagged by the independent review) and widens RG2-16/RG4-17 accordingly. E.g. Balea Volumenpuder Pure Styling „griffige Textur direkt am Ansatz" ⇒ texture secondary. |

`plans/styling-concept/02-rulings.md:165` (R9-Q2, pinned 16000a806105)

> | R9-Q2 | **When several result adjectives stand together, the one matching the named look or subtype leads; otherwise the first** (owner). NEQI Diamond Glass All („intensiv glänzenden, glatten ‚Glass Hair'-Effekt", heat-activated smoothing styler) ⇒ primary `sleek`, secondary `shine`. Vocabulary note: `sleek` = smooth/straight overall look (shape); `shine` = gloss (surface). |

`plans/styling-concept/02-rulings.md:166` (R9-F, pinned 16000a806105)

> | R9-F | **got2b gotGloss Glanz Spray: capture gap fixed** — got2b.de (C2) states „Gleichzeitig bietet es bis zu 48 h Frizz-Kontrolle." (verified 2026-10-14); the line was missing from the claims packet ⇒ add as C2 promise ⇒ `frizz_control` secondary. Round 8's „lane error" on this cell was a packet issue (c). |

`plans/styling-concept/02-rulings.md:167` (R9-P, pinned 16000a806105)

> | R9-P | **Process fix (Claude, from the independent review):** scoring scripts quote rule text verbatim and broke on every doc edit (H1). From now on each scorer pins the exact doc/ledger git revision it scores against and reads quotes from that revision, so past rounds stay reproducible. round-8's PASS is annotated: its Big Hair Day (13) and Balea MEN Powder (2) cells were owner questions (d), later settled by R8-Q1/R8-Q2. |

`plans/styling-concept/02-rulings.md:161` (R8-Q1, pinned 16000a806105)

> | R8-Q1 | **L'Oréal Elvital Big Hair Day „Erfrischendes Volumen Spray" ⇒ Dry Shampoo (volume direction)** (owner, after an INCI comparison with the catalog's dry shampoos: same build — propellant + alcohol + oil-absorbing powders near the top (Cellulose r3, Perlite r4), no hold polymer, applied to dry roots; closest to got2b Trockenshampoo Extra Volumen; C1 „Bis zu 48h frischeres Haargefühl"). Reading: a refresh-between-washes promise in the Dry Shampoo sense next to volume is the refresh + volume tie (§4.2 tie precedence) even when the name leads with volume. The Claude-side check of round-8 reclassified this split from „lane error" to an owner question. |

`plans/styling-concept/02-rulings.md:162` (R8-Q2, pinned 16000a806105)

> | R8-Q2 | **The product noun „Puder"/„Powder" names the `volume` job** (owner, after a cohort check: all 10 hair powders promise volume, 7 also texture/grip, almost always alongside volume). Texture/grip counts as a secondary job where a C1/C2 line promises it; a name that itself names grip (Redken „Powder Grip") is a two-job name and falls to its lead line. Other product nouns keep their §4.2/R4-Q7 mapping. |

`plans/styling-concept/02-rulings.md:163` (R8-H, pinned 16000a806105)

> | R8-H | **Moroccanoil Glättende Creme: R7-Q2 governs over the stale §4.2 mixed example** — „Definition" for „krauses Haar" with a separate „Ideal für lockiges Haar" is not a curl-definition promise ⇒ not care + definition ⇒ the border rules route it (Leave-in); the stale example is removed (Claude housekeeping from R7-Q2). |

`plans/styling-concept/02-rulings.md:140` (R4-H, pinned 16000a806105)

> | R4-H | **Housekeeping for v0.5 §13.4 (Claude, from the rulings' own logic; all calculation-log or already-ruled):** (1) no opaque `registry_row` pointer is added — registry rows are matched by brand + pack name (R4-Q6); (2) the Taft Gel Wax D8b flag is internal only (R4-L) and follows §7.5 as written; (3) where a promise line has no recorded position, §4.2 step 2 reads packet order; (4) Bumble and bumble „brilliantine" is a one-job C1 name under R4-Q1 (shine) — consistent with its registry row; (5) typed hold lines are secondary-job candidates only through the §6.10 hold_fix rule (RG3-16). The Leave-in addendum draft (v1.2) is updated after lock for R4-Q4 and the §4.1(d) rows. |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:785` (§6.10, pinned 16000a806105)

> | Secondary decision | Follow the numbered R10 procedure below; RG-12 / RG2-16 / RG3-16 / RG4-17 / R4-H (5) are refined by it. A fixing verb without strength („fixiert die Frisur zuverlässig“) supplies an explicit `hold_fix` promise and no hold level (RG4-12). Technology/formula/complex labels never supply a job („POWER-SHINE-TECHNOLOGIE“, RG4-10). |

`docs/research/styling-inci/v1.0/styling-classification-standard.md:786` (§6.10, pinned 16000a806105)

> | Worked example (R9-Q1) | Balea Styling Spray Volumenpuder Pure Styling ⇒ primary `volume`, secondary `texture`: the C1/C2 line „griffige Textur direkt am Ansatz“, typed `other` in the claims packet, promises a texture result and therefore counts. |

`plans/styling-concept/02-rulings.md:113` (R3-L, pinned 16000a806105)

> | R3-L | **Lock criterion „lanes agree" (PH1-11) means resolved, not identical.** Styling v1.0 may lock when every remaining A/B disagreement is resolved — either a lane error proven against a clear rule, or the rule gap behind it closed — **and** a final confirmation round shows only lane errors and no new rule gaps. Literal identity of both lanes on every value is not required. |

`plans/styling-concept/02-rulings.md:131` (R4-L, pinned 16000a806105)

> | R4-L | **Lock scope under R3-L: only differences in user-facing fields block the lock** — route/recommendability (incl. held vs committed, evidence gate), subtype, hold level, weight, finish, flexibility, target zone, application moment, primary and secondary jobs, heat protection, user-shown notes. Differences confined to the **calculation log** (reason code, rule path, internal review triggers, confidence, internal flags, lexicon placements that move no value) do not block: they are fixed in the text and documented, without a further round. Example: Bali Curls Sleek Stick — both lanes agree on every user field; only reason code and rule path differ. |

## Reproduction

Run `node data/research/styling-inci/v1.0/round-11/diff.js --summary` twice with unchanged inputs; the default rule revision is the full pinned SHA, not HEAD. Compare SHA-256 of diff.json and report.md. Later replay: add `--rules-revision=16000a8061058e1a82ee457d67f82285d694508d`. Only the sibling diff.json/report.md are written; no timestamps/randomness/absolute paths. Script/input hashes and every quoted source revision are recorded.

diff.json SHA-256: `da563c6f5ceb2ee7ac2d468601dd311c8f3ea654fca169b926f19d2861b9d7c7`.
