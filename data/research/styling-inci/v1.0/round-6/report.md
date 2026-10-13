# Styling v1.0 — final confirmation round 6

The lanes agree on **2131/2145 user-facing field cells (99.35%)**. **130/143 products (90.91%) agree on every user-facing field.** Route includes held versus committed and the evidence/boundary reason; secondary jobs are fully included.

**Lock verdict: FAIL.** There are **14 user-facing differences on 13 products**: **a=10 proven lane errors, b=3 rule-gap cells, c=0 packet/data issues, d=1 owner-ruling cells**. The gaps concern a defined beach-look secondary and the primary target zone across multiple application instructions. The John Frieda route still needs a decision about counting the Frizz Ease range prefix. These unresolved items fail R3-L/R4-L; high agreement does not close them.

All **46 products with a hold level in either lane agree**. **12/12 subtypes reach five agreed committed + held records.** The round-2 unseen gate is inherited, not retested. The Leave-in addendum draft exists; existence does not release held products.

Lane errors occur in both lanes: A is wrong in 6 cells, B is wrong in 4 cells. Agreement counts above retain those errors. Frozen lanes, rules and packets were not changed.

## Owner questions (d)

### John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray — route

`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` · `sty-bd5e4f61d3` · class **d**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | {"destination":"leave_in","boundary_reason":null} | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Frizz Ease Unendlich Smooth Salon Blow-Out Spray\" — „Frizz Ease\" is the line name, „Salon Blow-Out\" a slogan (RG2-17, R4-Q2) ⇒ one job word „Smooth\" ⇒ smoothing lead ⇒ styling_result, li_function yes","3.1 in scope, not Öl/Serum ⇒ continue; aqueous","3.4 (i) no FX-1…FX-4 member","3.4 (iii) LI G0 in_category (Polysilicone-29 conditioning film)","D6 limb 2 fails: Polysilicone-29 r3 above T_LI Sodium Benzoate r7 = plain silicone care ⇒ leave_in"],"pair_rule":"3.4(iii)","reason_code":"pair_rule_3.4iii_li_g0_in_category_d6_not_fired","boundary_reason":null,"hold_basis":null,"notes":"AMBIGUOUS (user-facing route): if „Frizz Ease … Smooth\" counts as two job words, the lead falls to the first C2 job line „Styling-Spray mit Schutz vor Hitze und Luftfeuchtigkeit …\" — styling joined with protection could read heat_protection (RG2-19) or mixed. Formula: no fixative, silicone film ⇒ under every non-mixed reading the Styling route is not reachable except as heat_protectant."} |
| B (Codex) | {"destination":"heat_protectant","boundary_reason":null} | {"rule_path":"§4.2:skip_slogan/RG2-19>§4.3.3.3","pair_rule":null,"reason_code":"protection_first","boundary_reason":null,"hold_basis":null,"notes":["Salon Blow-Out slogan states no job. First job-bearing C2 line leads with protection from heat and humidity; no Styling profile."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:415-430 (§4.2 name job counting / slogan rule; §4.3 3.3).

A treats Frizz Ease as a product-line prefix and Smooth as the sole sleek job, reaching Leave-in. B counts/skips the name differently and takes the first job-bearing C2 line, protection from heat and humidity, reaching Heat Protectant. The standard exempts Salon Blow-Out slogans and Nutri- from care ties, but never settles whether a functional line prefix such as Frizz Ease counts as a job.

**Owner question:** For John Frieda “Frizz Ease Unendlich Smooth Salon Blow-Out Spray”, does the range name Frizz Ease count as an anti-frizz job alongside Smooth, or should it be ignored as a range prefix?

**Proposed wording:** Confirmed-name job counting includes functional words in a product-range prefix unless an explicit range exemption is listed; Frizz Ease states anti-frizz, Smooth states sleek, and Salon Blow-Out names no job. A dispensing/form noun such as Styling-Spray does not itself make a protection lead mixed.

**Recommendation:** Count explicit job-bearing line wording consistently unless the standard expressly exempts that named range. Frizz Ease plus Smooth then gives two jobs; the protection-leading sentence routes Heat Protectant (B). Generic Styling-Spray alone is a form noun, not an independent coequal styling job. This proposed owner decision is not a proven B-correct lane error.

**Frozen evidence:** “Frizz Ease Unendlich Smooth Salon Blow-Out Spray”; “Salon Blow-Out Spray”; “Styling-Spray mit Schutz vor Hitze und Luftfeuchtigkeit für den perfekten Blow-Out.”; “Dieses Styling-Spray verwandelt Frizz in seidig-glattes, hochglänzendes Haar – ganz ohne zu beschweren. Mit Hitzeschutz bis 230 °C bilden Keratin und unser Humidity Shield Complex einen leichten Schutzfilm um jede einzelne Haarsträhne, der Feuchtigkeit abhält und dein Styling bis zu drei Haarwäschen lang geschmeidig hält. Das Ergebnis: ein glänzender, müheloser Blowout, wie frisch aus dem Salon.”. Packets: `r6/packets/s0/sty-bd5e4f61d3.json`, `r6/packets/claims/sty-bd5e4f61d3.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

## Rule gaps (b)

### alverde NATURKOSMETIK Beach Waves Spray Seaside Balance — secondary_jobs

`alverde-beach-waves-spray-seaside-balance` · `sty-4b7edf496f` · class **b**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["definition"] | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Beach Waves Spray\" names the salt-spray texture look (R4-Q2) ⇒ texture","styling_result, li_function no","aqueous","§4.3 3.4 (ii) ⇒ styling, committed","§5 ⇒ salt_spray"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"„natürlich definierten Look\" is a look phrase (RG-10 ⇒ no finish); its „definiert\" read as a definition job word (ambiguous). Alcohol denat. r3 ⇒ alcohol note (retailer „ohne Alkohol\" ignored)."} |
| B (Codex) | [] | {"rule_path":"§4.2:R4-Q2>§4.3.3.4(ii)>§5","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Beach Waves is texture, not curl definition. Natürlich definierten Look is not a finish word. Also dry_restyle."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)); plans/styling-concept/02-rulings.md:133 (R4-Q2).

The beach name is unambiguously texture, but the later “natürlich definierten Look, wie frisch vom Strand” remains under-specified: an adjectival defined-look result can be read as a definition job or as a texture/look description. R4-Q2 settles Beach Waves, and §6.8 excludes it as a finish grade, but neither settles this secondary-job adjective.

**Proposed wording:** In §6.10, definiert/definierende states definition only as an explicit promise to define or shape curls/waves. A generic adjectival result phrase such as “definierter Look” alone states no definition job.

**Recommendation:** B empty secondary list under the proposed wording; retain the texture primary.

**Frozen evidence:** “Haarstyling-Spray für lässige Strandwellen”; “Zertifizierte Naturkosmetik”; “Rezeptur mit Bio-Kiefer & Bio-Meersalz”; “Mit erfrischendem, maritimem Duft”; “natürlich definierten Look, wie frisch vom Strand”. Packets: `r6/packets/s0/sty-4b7edf496f.json`, `r6/packets/claims/sty-4b7edf496f.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Balea Styling Spray Volumenpuder Pure Styling — target_zone

`balea-pure-styling-volumenpuder-spray` · `sty-cdd2b606d2` · class **b**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | "roots" | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Styling Spray Volumenpuder\" names one job (volume)","styling_result, li_function no","no water ⇒ non-aqueous ⇒ 3.5 ⇒ styling","§5 powder dispensed as an aerosol spray ⇒ texture_spray (RG4-13)"],"pair_rule":"3.5","reason_code":"pair_rule_3.5_non_aqueous","boundary_reason":null,"hold_basis":null,"notes":"No T_S class anywhere ⇒ whole list above tail (§3.3 item 4). Directions: dry roots first-named, „wie gewohnt stylen\" ⇒ dry_restyle; lengths optional ⇒ roots (RG-9)."} |
| B (Codex) | "all" | {"rule_path":"§4.3.3.5>§5:RG4-13","pair_rule":null,"reason_code":"styling_non_aqueous","boundary_reason":null,"hold_basis":null,"notes":["Powder dispensed as aerosol is texture_spray. Whole list above-tail with confidence capped moderate. Roots and lengths are both instructed. Alcohol r4 does not fire note."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:732 (§6.12 RG-9 / RG2-10 / RG3-20).

Directions first prescribe roots, then a conditional lengths application for more texture. The first-named rule supports A roots; the concluding only-application-site sentence supports B all. Pair/range examples do not resolve a separate conditional use.

**Proposed wording:** Required application across multiple sites, including sequential roots then whole hair, is all. A distinct optional or conditional use for a different effect does not widen the primary target zone: classify the primary instruction and record the alternative separately. First-named applies to independent alternatives, not a required multi-site sequence.

**Recommendation:** Under this proposed clarification, A roots is the primary zone for this packet.

**Frozen evidence:** “Dose vor jedem Gebraucht kräftig schütteln, um ein Verstopfen der Düse zu vermeiden. Auf trockenen Haaransatz sprühen und wie gewohnt stylen. Für mehr Textur und Griffigkeit sparsam in die Haarlängen sprühen.”. Packets: `r6/packets/s0/sty-cdd2b606d2.json`, `r6/packets/claims/sty-cdd2b606d2.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Redken Root Tease — target_zone

`redken-root-tease` · `sty-e4747513f5` · class **b**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | "roots" | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Root Tease\" names one job (root volume by teasing)","styling_result, li_function no","Dimethyl Ether r1 ⇒ non-aqueous ⇒ 3.5 ⇒ styling","§5 volume/texture lead with a teasing step ⇒ texture_spray, not hairspray (RG4-13)"],"pair_rule":"3.5","reason_code":"pair_rule_3.5_non_aqueous","boundary_reason":null,"hold_basis":null,"notes":"Directions: spray at roots, tease, then spray over all hair ⇒ dry_restyle (RG2-9 case); roots first-named ⇒ roots (RG-9). hold_fix from „Kontrolle\" (ambiguous). T_S Linalool r7 unresolved, R2 Parfum r11."} |
| B (Codex) | "all" | {"rule_path":"§4.3.3.5>§5:RG4-13","pair_rule":null,"reason_code":"styling_non_aqueous","boundary_reason":null,"hold_basis":null,"notes":["Volume lead plus teasing instruction is texture_spray, not hairspray. Main sequence applies to roots then entire hair."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:732 (§6.12 RG-9 / RG2-10 / RG3-20).

The main sequence applies first to roots and then to the whole hair. B all is the stronger reading, but §6.12 also expressly assigns roots to the first-named site. Its exception covers sites named together and ranges, not sequential steps; the final only-site sentence contradicts the opening first-named sentence. This is the same target-zone rule gap as the conditional Balea use, not a proven lane error.

**Proposed wording:** Determine the zone across the main required application sequence. Roots followed by application across the whole hair is all. A separate conditional or optional use does not broaden the selected main-use zone. First-named applies to genuine alternative uses, not required sequential sites. Apply the only-site requirement within the selected main use.

**Recommendation:** B all under the proposed clarification.

**Frozen evidence:** “Schritt 1: Auf den Ansatz sprühen, um Volumen zu erhalten. Schritt 2 Anschliessend toupieren und auf das gesamte Haar sprühen, um die Frisur zu fixieren und ihr ein modernes, [CLAIM] Finish zu verleihen. Bei Kontakt mit den Augen diese sofort gründlich ausspülen. Außer Reichweite von Kindern aufbewahren.”. Packets: `r6/packets/s0/sty-e4747513f5.json`, `r6/packets/claims/sty-e4747513f5.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

The 2 target-zone cells share one underlying §6.12 gap. Counts are disagreement cells, not distinct policy issues. Proposed wording is review material and has not been approved or applied.

## Packet/data issues (c)

None.

Existing evidence-gated/formula-conflicted products are counted with their frozen blocked state. An agreed evidence block is not a new packet defect causing a disagreement.

## Proven lane errors (a)

### Balea Haargel Hair Jelly (Styling Hair Jelly) — secondary_jobs

`balea-haargel-hair-jelly` · `sty-771e26ae22` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["sleek"] | {"rule_path":["§4.1 gate pass (house-brand C2 lines, C1 pack directions)","§4.2 step 1: name „Haargel Hair Jelly\" — two product nouns of one job (hold) ⇒ one job","styling_result, li_function no","aqueous","§4.3 3.4 (ii) ⇒ styling","§5 jelly/gel form ⇒ gel"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Neutral fact shown (PVP r6). „natürliches Haargefühl\" is a feel line. Gel film type synthetic; cast_expected unbekannt."} |
| B (Codex) | ["definition","sleek"] | {"rule_path":"§4.3.3.4(ii)>§5","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Natural hair feel is not a finish. Also dry_restyle."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)).

Sleek-Looks explicitly supplies sleek. Bare “Locken” is an application target without the required shaping/setting verb; B incorrectly adds definition.

**Correct lane: A.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Styling-Gelee für das Haar”; “Für ein natürliches Haargefühl”; “Ideal für Sleek-Looks & Locken”; “leichte, geleeartige Textur”; “flexiblen Halt”. Packets: `r6/packets/s0/sty-771e26ae22.json`, `r6/packets/claims/sty-771e26ae22.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Bali Curls Sleek Stick Brows & Edges — primary_job

`bali-curls-sleek-stick-brows-and-edges` · `sty-9d658b43a0` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | "sleek" | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Sleek Stick Brows & Edges\" names one job (sleeking edges/baby hair)","RG4-26: sleeking edges, baby hair or brows on dry hair is a styling look ⇒ li_function no","aqueous","§4.3 3.4 (ii) ⇒ styling, committed","§5 step 2: edges/brows lead, gel-type shaping product ⇒ gel; brow use recorded (RG2-27)"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Ambiguity (user-facing primary_job): RG2-7 limits `sleek` to a whole-style result; sleeking edges could instead map to frizz_control („Babyhaare\") or hold_fix (lead line „Präziser Halt … in Form\"). Acrylates Crosspolymer-3 r2 FX-U recorded; PVP r3 present."} |
| B (Codex) | "frizz_control" | {"rule_path":"§4.2:RG4-26>§4.3.3.4(ii)>§5:D1","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Edges-only sleekness maps to frizz_control under §6.10. PVP r3 establishes hold; Crosspolymer-3 is unsettled and earns no fixative credit."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)).

§6.10 explicitly reserves sleek for the whole style and maps baby-hair/flyaway taming to frizz_control. This is an edges/brows-only product. B primary frizz_control is correct; its only secondary is hold_fix. A uses forbidden local sleek as primary and consequently retains the true primary as a secondary.

**Correct lane: B.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Sleek Stick Brows & Edges”; “Präziser Halt für Brows & Babyhaare - bringt selbst feine Härchen zuverlässig in Form”; “starken, langanhaltenden Halt”. Packets: `r6/packets/s0/sty-9d658b43a0.json`, `r6/packets/claims/sty-9d658b43a0.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Bali Curls Sleek Stick Brows & Edges — secondary_jobs

`bali-curls-sleek-stick-brows-and-edges` · `sty-9d658b43a0` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["frizz_control","hold_fix"] | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Sleek Stick Brows & Edges\" names one job (sleeking edges/baby hair)","RG4-26: sleeking edges, baby hair or brows on dry hair is a styling look ⇒ li_function no","aqueous","§4.3 3.4 (ii) ⇒ styling, committed","§5 step 2: edges/brows lead, gel-type shaping product ⇒ gel; brow use recorded (RG2-27)"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Ambiguity (user-facing primary_job): RG2-7 limits `sleek` to a whole-style result; sleeking edges could instead map to frizz_control („Babyhaare\") or hold_fix (lead line „Präziser Halt … in Form\"). Acrylates Crosspolymer-3 r2 FX-U recorded; PVP r3 present."} |
| B (Codex) | ["hold_fix"] | {"rule_path":"§4.2:RG4-26>§4.3.3.4(ii)>§5:D1","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Edges-only sleekness maps to frizz_control under §6.10. PVP r3 establishes hold; Crosspolymer-3 is unsettled and earns no fixative credit."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)).

§6.10 explicitly reserves sleek for the whole style and maps baby-hair/flyaway taming to frizz_control. This is an edges/brows-only product. B primary frizz_control is correct; its only secondary is hold_fix. A uses forbidden local sleek as primary and consequently retains the true primary as a secondary.

**Correct lane: B.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Präziser Halt für Brows & Babyhaare - bringt selbst feine Härchen zuverlässig in Form”; “starken, langanhaltenden Halt”. Packets: `r6/packets/s0/sty-9d658b43a0.json`, `r6/packets/claims/sty-9d658b43a0.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### got2b (Schwarzkopf) Styling Mattpaste Strand Matte — secondary_jobs

`got2b-styling-mattpaste-strand-matte` · `sty-30fb662771` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | [] | {"rule_path":["§4.1 gate pass (C2 line, C3 verbatim directions)","§4.2 step 1: name „Styling …paste Strand …\" — product noun Paste ⇒ one job (molding/hold)","styling_result, li_function no","aqueous","§4.3 3.4 (ii) ⇒ styling","§5 ⇒ molding"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"form_label paste; base water_based. Stearic/Palmitic Acid r8–r9 below T_S Parfum r7 (no value moves; already structuring wax). Directions „Auf trockenem oder feuchtem Haar … zerzausen, zwirbeln\" ⇒ dry first-named, shaping act ⇒ dry_restyle."} |
| B (Codex) | ["texture"] | {"rule_path":"§4.3.3.4(ii)>§5","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Structuring waxes and ester establish rich. Also damp_before_drying."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)); plans/styling-concept/02-rulings.md:133 (R4-Q2).

“Surfer-Styles” is not an explicit texture job or a named Beach Waves/Strandwellen/beachy phrase. A empty list is correct; B extrapolates texture from a style association. The name/hold job already supplies the primary.

**Correct lane: A.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “kreiert matte Surfer-Styles mit mittlerem Halt”; “mittlerem Halt”. Packets: `r6/packets/s0/sty-30fb662771.json`, `r6/packets/claims/sty-30fb662771.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### got2b Styling Puder Volumen Powderfull — secondary_jobs

`got2b-styling-puder-volumen-powderfull` · `sty-3b9f5cbf4c` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["hold_fix"] | {"rule_path":["§4.1 gate pass (C2 line, C3 verbatim directions)","§4.2 name „Styling Puder Volumen Powderfull\": product noun + Volumen ⇒ lead = first C2 line „Für sichtbar volleres Haar …\" ⇒ volume","styling_result, li_function no","aqueous (Aqua r1 above T_S Sodium Benzoate r3)","§4.3 3.4 (ii) ⇒ styling","§5 powder form ⇒ hair_powder"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Powder worked into dry hair by hand ⇒ dry_restyle (RG3-7); „vom Ansatz bis in die Spitzen\" ⇒ all. T_LI Sodium Benzoate r3 vacuous, not read on this path. hold_fix secondary from „mit … Halt\" (Halt stated without a strength word; ambiguous)."} |
| B (Codex) | [] | {"rule_path":"§4.3.3.4(ii)>§5","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Roots-to-tips range is all. T_LI is not used on direct route."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)); docs/research/styling-inci/v1.0/styling-classification-standard.md:804-823 (§7.4).

The captured hold text has no strength word or brand number: perceptible/natural hold, duration and flexibility are not hold-strength evidence (§7.4). No fixing verb supplies an alternative candidate. The lane adding hold_fix is wrong.

**Correct lane: B.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Für sichtbar volleres Haar mit natürlichem Halt.”; “natürlichem Halt”. Packets: `r6/packets/s0/sty-3b9f5cbf4c.json`, `r6/packets/claims/sty-3b9f5cbf4c.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### KMS Thermashape 2-in-1 Spray — secondary_jobs

`kms-thermashape-2-in-1-spray` · `sty-00f038f912` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["hold_fix"] | {"rule_path":["§4.1 gate pass (C2 lines, C2 directions, verified)","§4.2 name names no single job ⇒ first C2 line; RG3-4 first job sentence „Ideal zum Glätten…\" ⇒ sleek ⇒ styling_result","§4.3 3.1 in scope but not sold as Öl/Serum ⇒ continue","Dimethyl Ether r2 leads Water r9 ⇒ non-aqueous (lexicon §0.3) ⇒ 3.5 ⇒ styling","§4.5 3.5 never held","§5 job sleek + before_heat ⇒ smoothing_styler","registry row KMS 2-in-1 Spray: same"],"pair_rule":"3.5","reason_code":"pair_rule_3.5_non_aqueous","boundary_reason":null,"hold_basis":null,"notes":"heat_activated raised to yes by C2 „Hitzereaktives Spray\" (RG4-18). Acrylates Copolymer r3 corroborated by FX-2c (i) non-aqueous. Polysilicone-9 r8 FX-U recorded, not sole candidate. „Lockenstylings mit Hot Tools\" not read as a definition job (ambiguous)."} |
| B (Codex) | ["definition","hold_fix"] | {"rule_path":"§4.1>§4.2>§4.3.3.5>§5","pair_rule":null,"reason_code":"styling_non_aqueous","boundary_reason":null,"hold_basis":null,"notes":["Hitzeschutz laut Hersteller","Secondary shine dropped by formula gate.","Also dry_finish."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)).

“Lockenstylings mit Hot Tools” names a usage/look without a curl-shaping or setting verb. §6.10 RG2-5 requires that verb for definition. A retains hold_fix; B adds unsupported definition.

**Correct lane: A.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Hitzereaktives Spray für schnelles, einfaches und lang anhaltendes Styling auf trockenem Haar. Ideal zum Glätten und für Lockenstylings mit Hot Tools. Reduziert Hitzeschädigungen und Haarbruch. Verleiht zusätzlichen Halt und Glanz als Finish-Spray.”; “Gibt dem Haar Form für vielseitige Looks von glatt bis lockig beim Styling mit Hitze-Tools.”; “Sorgt für extra Halt und Styles, die bis zu 72 Stunden halten.”; “Sorgt für extra Halt und Styles, die bis zu 72 Stunden halten.”. Packets: `r6/packets/s0/sty-00f038f912.json`, `r6/packets/claims/sty-00f038f912.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Maria Nila Curlicue Cream (Stylingcreme) — secondary_jobs

`maria-nila-curlicue-cream` · `sty-b952062591` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["volume"] | {"rule_path":["§4.1 gate pass","§4.2 C2 „Definierende Pflegecreme …\": a care noun in a C2 descriptor line is not a care job (RG3-12) ⇒ styling_result, li_function yes (definition)","aqueous","3.4 (i): PVP r4 above T_S but LI COND thin ⇒ D7 not met","3.4 (iii) LI G0 = T15 paradigm excluded_styling_first ⇒ styling curl_cream, not held"],"pair_rule":"3.4(iii)","reason_code":"pair_rule_3.4iii_li_g0_excluded_styling_first","boundary_reason":null,"hold_basis":null,"notes":"As §11.3. conditioning_co_load light. Quaternium-95 opaque ⇒ no LGN pair."} |
| B (Codex) | ["hold_fix","volume"] | {"rule_path":"§4.2:RG3-12>§4.3.3.4(iii):T15>§5","pair_rule":null,"reason_code":"li_g0_excluded_styling_first","boundary_reason":null,"hold_basis":null,"notes":["Descriptor Pflegecreme is not a care job. T15 names thin-care exclusion. Quaternium-95 r11 is not an LGN partner."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)); docs/research/styling-inci/v1.0/styling-classification-standard.md:804-823 (§7.4).

A captured C1/C2 brand-number hold claim explicitly qualifies for the §6.10 hold_fix secondary and the formula gate passes. The lane omitting hold_fix is wrong.

**Correct lane: B.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Definierende Pflegecreme, die natürlich lockigem und welligem Haar lebendige Sprungkraft verleiht.”; “Halt 3/5”. Packets: `r6/packets/s0/sty-b952062591.json`, `r6/packets/claims/sty-b952062591.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Moroccanoil Root Boost — secondary_jobs

`moroccanoil-root-boost` · `sty-842cfcdb07` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["texture"] | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Root Boost\" names one job (root volume)","styling_result, li_function no","aqueous (Water r1 above the propellant)","§4.3 3.4 (ii) ⇒ styling","§5 root lift before blow-drying ⇒ blowdry_lotion (D1)"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Neutral fact shown (VP/VA Copolymer r3). Finish C2 „natürlich aussehendes Finish\". candidate_below_tail: Polyquaternium-7 r12 below T_S Fragrance r6 (buildup limb 1). Blow-dry with round brush required ⇒ before_heat."} |
| B (Codex) | ["frizz_control","texture"] | {"rule_path":"§4.3.3.4(ii)>§5","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["PQ-7 r12 is below T_S. Required brush blow-dry determines moment; no product activation statement."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)).

The static-charge-control line is typed humidity and contains no explicit anti-frizz/flyaway job word. Humidity lines do not state jobs unless explicit anti-frizz wording is present; B adds frizz_control without it.

**Correct lane: A.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Großes Volumen dank Fülle vom Ansatz an: Vor dem Föhnstyling sorgt Moroccanoil® Root Boost für eine starke Textur an den Haaransätzen und erzeugt so mühelos großes Volumen. Angereichert mit antioxidantienreichem Arganöl, verleiht dieser Ansatz-Booster normalem bis feinem Haar lang anhaltende Textur, Fülle und Bewegung. Unsere hochwirksame Formel kontrolliert statische Aufladung und sorgt für ein natürlich aussehendes Finish.”; “kontrolliert statische Aufladung”. Packets: `r6/packets/s0/sty-842cfcdb07.json`, `r6/packets/claims/sty-842cfcdb07.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) — secondary_jobs

`moroccanoil-textur-und-volumenpuder` · `sty-abaf4e0ca0` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["hold_fix","texture"] | {"rule_path":["§4.1 gate pass","§4.2 name „Textur- & Volumenpuder\" names two jobs ⇒ first C2 line „… sorgt für sofortiges Volumen …\" ⇒ volume","styling_result, li_function no","aqueous","§4.3 3.4 (ii) ⇒ styling","§5 powder (pump-dispensed powder, not a spray) at dry roots ⇒ hair_powder"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Finish „Natürlich aussehendes, halbmattes Finish\": halbmatt ⇒ matt (RG2-11), matt + natürlich ⇒ matt (RG-10). Tie hair_powder vs texture_spray broken by form (powder from a pump bottle)."} |
| B (Codex) | ["texture"] | {"rule_path":"§4.3.3.4(ii)>§5","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["Powder pump dispenses powder, not aerosol spray. Halbmatt beats compatible natural finish. Negated steif states flexibility."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)); docs/research/styling-inci/v1.0/styling-classification-standard.md:804-823 (§7.4).

The captured hold text has no strength word or brand number: perceptible/natural hold, duration and flexibility are not hold-strength evidence (§7.4). No fixing verb supplies an alternative candidate. The lane adding hold_fix is wrong.

**Correct lane: B.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Das Moroccanoil Textur- & Volumenpuder sorgt für sofortiges Volumen, hebt die Strähnen an und verbessert jeden Style am Ansatz. Dieser leistungsstarke Puder verleiht Grip und Textur für müheloses Styling, maximales, konzentriertes Volumen und lang anhaltenden, flexiblen Halt.”; “Um die Vorteile des Volumens während des Tages zu reaktivieren, kannst du das Haar einfach zerzausen. Dadurch bleibt das Haar auch nach der ersten Anwendung des Produkts den ganzen Tag über voluminös und sieht toll aus. Es beschwert das Haar nicht und hinterlässt kein klebriges Gefühl, was es zu einem idealen Produkt für feines, dünnes oder plattes Haar macht.”; “• Leichte Formel für fühlbare Ergebnisse”; “• Natürlich aussehendes, halbmattes Finish”; “• Aufbauende Ergebnisse”; “• Haare zur Reaktivierung zerzausen”; “• Desodorier, hinterlässt den typischen Moroccanoil-Duft”; “Die Ergebnisse basieren auf Verbraucher- und Instrumententests nach einmaliger Anwendung:”; “• 48 Stunden lang anhaltender Lift1”; “• 98 % stimmen zu, dass das Haar sofort mehr Fülle und Volumen an der Haarwurzel erhält²”; “• 98 % stimmen zu, dass sich das Haar nicht klebrig, spröde oder steif anfühlt²”; “• 93 % stimmen zu, dass dieses Produkt kraftloses und plattes Haar wiederbelebt²”; “lang anhaltenden, flexiblen Halt”. Packets: `r6/packets/s0/sty-abaf4e0ca0.json`, `r6/packets/claims/sty-abaf4e0ca0.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

### Moroccanoil Volumizing Spray (Volumizing Mist) — secondary_jobs

`moroccanoil-volumizing-spray` · `sty-1a57b5b336` · class **a**

| Lane | Normalized value | Emitted rule path and rationale |
|---|---|---|
| A (Claude Opus) | ["hold_fix","texture"] | {"rule_path":["§4.1 gate pass","§4.2 step 1: name „Volumizing Spray (Volumizing Mist)\" names one job (volume)","styling_result, li_function no","aqueous (Water r2 above T_S Fragrance r36)","§4.3 3.4 (ii) ⇒ styling","§5 damp volume spray ⇒ blowdry_lotion (RG3-18)"],"pair_rule":"3.4(ii)","reason_code":"pair_rule_3.4ii_no_li_function","boundary_reason":null,"hold_basis":null,"notes":"Algin r17, Pullulan r19 NF-U (lexicon v0.5) ⇒ natural_film + unsettled; Acacia r9, Chitosan r18 NF-1. PQ-11 r30 / PQ-16 r31 above T_S ⇒ buildup limb 1. T_LI Sodium Benzoate r39 vacuous (no border rule on 3.4 (ii) path reads it)."} |
| B (Codex) | ["texture"] | {"rule_path":"§4.3.3.4(ii)>§5:RG3-18","pair_rule":null,"reason_code":"styling_non_li_promise","boundary_reason":null,"hold_basis":null,"notes":["WT families a@6,34 and e@30,31; no rich member or LGN pair. T_LI is not used on this direct route."]} |

**Governing rule:** docs/research/styling-inci/v1.0/styling-classification-standard.md:716-719 (§6.10; RG2-5/7, RG3-16, RG4-17; R4-H(5)); docs/research/styling-inci/v1.0/styling-classification-standard.md:804-823 (§7.4).

The captured hold text has no strength word or brand number: perceptible/natural hold, duration and flexibility are not hold-strength evidence (§7.4). No fixing verb supplies an alternative candidate. The lane adding hold_fix is wrong.

**Correct lane: B.** Resolve the wrong lane to that value; frozen records remain unchanged.

**Frozen evidence:** “Bringen Sie Leben in feines, stumpfes Haare mit dem Volumizing Spray. Dieser schwerelose, körperbildende Nebel hebt die Haare für einen Look, der bis zu 50% voller ist, während er Bewegung und spürbaren Halt vom Ansatz bis zur Spitze aufrecht erhält. Die Arganöl-infundierte Formel enthält Reis-Aminosäuren, um das Haar zu stärken, sowie Totes Meersalz, um Volumen mit sprungkräftiger Textur aufzubauen. Anhaltendes Volumen bis zu 72 Stunden.”; “spürbaren Halt vom Ansatz bis zur Spitze”. Packets: `r6/packets/s0/sty-1a57b5b336.json`, `r6/packets/claims/sty-1a57b5b336.json` (relative to this engine's data root). Full typed evidence is retained in diff.json.

## Latent user-facing ambiguities

20 lane-reported observations on 18 products did not produce a difference in the reported field. They do not block under R3-L/R4-L. Observations on a product with another disputed field are retained when this specific field agrees. The stale Brilliantine and Pomade worked rows are already governed by R4-Q1/R4-H; they need text alignment, not a new ruling.

| Lane | Product (slug) | Fields and agreed values | Reported concern | Handling |
|---|---|---|---|---|
| A | Balea Glattspray Anti-Frizz<br>`balea-glattspray-anti-frizz` | {"target_zone":"lengths"} | Blow-dry and flat iron optional ⇒ damp_before_drying. „dabei den Ansatz aussparen" ⇒ lengths (ambiguous: could be read as all). Finish house-brand C2 „natürlicher Glanz" (PH1-5). T_LI Phenoxyethanol r11 vacuous — read by the PH1-16 re-run. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Balea Styling WAX STICK<br>`balea-haarwachs-styling-stick` | {"secondary_jobs":["shine","sleek"]} | Directions: stroke over dry hair to fix flyaways, no shaping act ⇒ dry_finish (RG4-14), surface. Secondaries from house-brand C2 „Für ein glattes & glänzendes Finish" (glatt read as sleek — ambiguous; else shine + frizz_control „Babyhaare"). form_label wax; base anhydrous. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Balea Locken Crunchgel<br>`balea-locken-crunchgel` | {"flexibility":"beweglich"} | cast_expected yes (name „Crunch"); gel film type natural. Flex from house-brand C2 „flexible Struktur" (an `other` line; ambiguous). candidate_below_tail: Magnesium Sulfate r11 below T_S Parfum r7 would add salt mechanism. Directions „Am nächsten Tag … auffrischen" ⇒ also second_day. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Balea MEN Pomade Haar & Bart 2in1<br>`balea-men-pomade-haar-bart-2in1` | {"secondary_jobs":[]} | form_label pomade; base anhydrous. §11.9 lists secondary `definition`; in this packet „Definition" sits only in the typed hold line and „Formt & festigt" is an `other` claim, so under R4-H (5) no secondary is taken (ambiguity — user-facing secondary_jobs). Medically adjacent pomade caution (derived). | Settled by R4-Q1/R4-H; stale worked example, align text without another confirmation round. |
| A | Balea MEN Styling Powder<br>`balea-men-styling-powder` | {"flexibility":"beweglich"} | Carrageenan r4 NF-U ⇒ natural_film + fixative_family natural_film (RG4-27). „flexibles Styling" read as flexibility word flexibel ⇒ beweglich (ambiguous: describes versatility). hold_fix secondary from „nach Wunsch modelliert" / hold line. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Balea Fixierungsbürste Styling Finishing Stick<br>`balea-styling-finishing-stick` | {"primary_job":"frizz_control"} | „perfektes Finish" names no finish grade. RG4-14: stroking over flyaways on dry hair ⇒ dry_finish, surface. Brow use recorded only. If a lane reads the name as one job (Finishing ⇒ shine) the primary would be shine (gate fails ⇒ job_formula_conflict) — ambiguity noted. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | BALI CURLS Volumizing Curl Spray<br>`bali-curls-volumizing-curl-spray-refreshing` | {"application_moment":"damp_before_drying"} | Secondaries: name job word Volumizing ⇒ volume; „voluminösen Beachlook" ⇒ texture (R4-Q2). Directions „auf nassem oder trockenem Haar" (first-named nass) + „beginnend an den Spitzen … zum Ansatz" range ⇒ all. Not second_day: directions apply to wet/damp hair (ambiguous: first sentence frames use as daily refresh). | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Bumble and bumble brilliantine<br>`bumble-and-bumble-brilliantine` | {"primary_job":"shine","secondary_jobs":[]} | Name alone meets the gate ⇒ primary = name job (§6.10 R4-Q1 row; §11.8 C row still says „jobs empty" — ambiguity). T_S Ethylhexylglycerin r11 unresolved, R2 Tetrasodium EDTA r18; weight rich under both. | Settled by R4-Q1/R4-H; stale worked example, align text without another confirmation round. |
| A | got2b (Schwarzkopf/Henkel) Glanz Spray got Gloss (gotGloss Glanz Spray)<br>`got2b-gotgloss-glanz-spray` | {"secondary_jobs":[]} | Directions: on dry hair, then flat iron ⇒ before_heat; re-spray as finish ⇒ also dry_finish. Humidity line „Bis zu 48h Frizz-Effekt" lacks an explicit anti-frizz word ⇒ no frizz_control (ambiguous). | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray)<br>`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` | {"route":{"destination":"dry_shampoo","boundary_reason":null}} | promise_tie: refresh_plus_volume_texture. AMBIGUOUS (user-facing route): if „Erfrischendes" is read as a qualifier, the name names one job (volume) ⇒ styling via 3.5 (non-aqueous) ⇒ texture_spray (dry roots, aerosol). Cellulose/Perlite/rice-starch powder formula supports the refresh reading but the formula never decides 3.2. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Redken Powder Grip (03 Mattifying Hair Powder)<br>`redken-powder-grip-03` | {"flexibility":"beweglich"} | Directions: sprinkle, knead with fingers, no moisture state ⇒ dry_restyle (RG2-9 case). Flex from „fühlt sich … flexibler an" (a feel phrase; ambiguous). Finish „mattierendes … ultra-matten Finish" ⇒ matt. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Redken Root Tease<br>`redken-root-tease` | {"secondary_jobs":["hold_fix","texture"]} | Directions: spray at roots, tease, then spray over all hair ⇒ dry_restyle (RG2-9 case); roots first-named ⇒ roots (RG-9). hold_fix from „Kontrolle" (ambiguous). T_S Linalool r7 unresolved, R2 Parfum r11. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Schwarzkopf Taft Haargel MATT WAX Halt 5<br>`schwarzkopf-taft-matt-wax-halt-5` | {"hold_level":4} | Claims name „Haargel MATT WAX Halt 5"; form wax ⇒ form_label wax, base water_based. Ambiguity: „Haargel" in a wax name — Taft-gel words-only row vs Henkel x/5 row; both give 4. Finish „mattes, nicht glänzendes Finish" ⇒ matt. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Syoss Glaze Glanz & Schutz Primer<br>`syoss-glaze-glanz-und-schutz-primer` | {"route":{"destination":"provisional_boundary","boundary_reason":"mixed_promise"}} | Ambiguity: if the name were read as one shine job (Glaze/Glanz; „Schutz Primer" a call-out), R3-Q3 would make it styling_result ⇒ aqueous ⇒ 3.1 not Öl/Serum ⇒ 3.4 (ii) shine_finish. „3in1 Style, Care, Shine" supports mixed. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Syoss Glaze Topcoat<br>`syoss-glaze-topcoat` | {"secondary_jobs":["frizz_control","sleek"]} | Directions: dry hair before flat iron/curling wand ⇒ before_heat; after styling ⇒ also dry_finish. Secondary sleek from „seidig glattes Haar" (ambiguous whether a whole-style sleek result). | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Wella Professionals EIMI Glam Mist Shinespray<br>`wella-eimi-glam-mist-shine-spray` | {"secondary_jobs":["frizz_control","sleek"]} | D8b rule 1: hold claim on a shine_finish with no hold mechanism ⇒ flag, level unchanged. Spray-only directions ⇒ dry_finish (RG-2). sleek from „glattes … Finish" (ambiguous). | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream)<br>`wella-eimi-nutricurls-curl-shaper` | {"primary_job":"definition"} | Primary from the name (Curl + Defining + Shaper count once, RG2-21 example). Ambiguity: under R4-Q7 „Gel Cream" + Curl could be read as two jobs ⇒ lead = C2 „bändigt Frizz" ⇒ primary frizz_control. conditioning_co_load rich (LI COND ≥ moderate). | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| A | Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion)<br>`wella-eimi-smooth-perfect-me` | {"route":{"destination":"leave_in","boundary_reason":null}} | Ambiguity: the line could be read as styling + care co-equal ⇒ mixed_promise (D7 would not fire: no fixative). §4.2 says this record's route does not move under R4-Q3. | Same user-facing value in both lanes. Preserve the observation; a reported alternative is not itself a new demonstrated rule gap under R3-L/R4-L. |
| B | Balea MEN Pomade Haar & Bart 2in1<br>`balea-men-pomade-haar-bart-2in1` | {"secondary_jobs":[]} | The older Pomade worked row assigns secondary definition from a typed hold entry, whereas the amended candidate procedure admits typed hold entries through hold_fix only. | Settled by the cited owner ruling; residual worked-example wording should be synchronized, without another blind round. |
| B | Bumble and bumble brilliantine<br>`bumble-and-bumble-brilliantine` | {"primary_job":"shine"} | Brilliantine's worked C row still says jobs empty, but R4-Q1 and §6.10 assign the sole confirmed-name job when the name meets the evidence gate. | Settled by the cited owner ruling; residual worked-example wording should be synchronized, without another blind round. |

Lane B's 2 explicitly calculation-log ambiguities are retained in diff.json. A's legitimate hold_route “ambiguous” labels are not treated as reports of a new rule ambiguity.

## Agreement tables and method

The scorer adapts the round-4 join, normalization, per-field agreement, hold, subtype coverage and historical comparison method, but promotes secondary_jobs to the user-facing denominator and keeps internal diagnostics in a separate table. The user-facing denominator is 143 products × 15 fields. Null/null agrees; the emitted-value columns disclose absent values. No conclusion or observed count is preset. Normative example expectations and evidence-conditioned analyst interpretations are explicit in diff.js.

- route is compared as {destination,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.
- application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not evidence wrappers; claim-only display is checked separately against captured C1/C2 heat claims.
- buildup/alcohol notes: {fired:false}, not_fired and does_not_fire -> does_not_fire; {fired:true}, fired and fires -> fires. null remains null.
- Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.
- neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.
- Empty secondary_jobs/d8b_flags collections and null are equivalent only when no Styling profile exists (§4.7). Only explicitly informational_and_non_authoritative historical properties are masked. Any unmarked forbidden value remains scoreable.
- confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.

### User-facing field agreement

| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |
|---|---|---|---|---|---|
| route | 142/143 | 99.3 | 1 | 142/143 | 99.3 |
| subtype | 143/143 | 100 | 0 | 91/91 | 100 |
| hold_level | 143/143 | 100 | 0 | 46/46 | 100 |
| weight | 143/143 | 100 | 0 | 91/91 | 100 |
| finish | 143/143 | 100 | 0 | 91/91 | 100 |
| flexibility | 143/143 | 100 | 0 | 91/91 | 100 |
| target_zone | 141/143 | 98.6 | 2 | 89/91 | 97.8 |
| application_moment | 143/143 | 100 | 0 | 91/91 | 100 |
| primary_job | 142/143 | 99.3 | 1 | 89/90 | 98.89 |
| secondary_jobs | 133/143 | 93.01 | 10 | 81/91 | 89.01 |
| provides_heat_protection | 143/143 | 100 | 0 | 91/91 | 100 |
| heat_activated | 143/143 | 100 | 0 | 91/91 | 100 |
| alcohol_note | 143/143 | 100 | 0 | 91/91 | 100 |
| buildup_note | 143/143 | 100 | 0 | 91/91 | 100 |
| neutral_fact | 143/143 | 100 | 0 | 9/9 | 100 |

Aggregate: 2131/2145 (99.35%). 

### Calculation log field agreement

| Field | Agree / all | % | Disagree | Agree / emitted by either | Emitted % |
|---|---|---|---|---|---|
| reason_code | 21/143 | 14.69 | 122 | 21/143 | 14.69 |
| rule_path | 0/143 | 0 | 143 | 0/143 | 0 |
| review_triggers | 122/143 | 85.31 | 21 | 122/143 | 85.31 |
| confidence | 0/143 | 0 | 143 | 0/143 | 0 |
| tail_T_S | 143/143 | 100 | 0 | 143/143 | 100 |
| tail_T_LI | 143/143 | 100 | 0 | 143/143 | 100 |
| ingredient_flags | 142/143 | 99.3 | 1 | 90/91 | 98.9 |
| d8b_flags | 142/143 | 99.3 | 1 | 90/91 | 98.9 |
| notes | 0/143 | 0 | 143 | 0/143 | 0 |
| identity_status | 140/143 | 97.9 | 3 | 140/143 | 97.9 |
| promise_class | 141/143 | 98.6 | 2 | 141/143 | 98.6 |
| result_mechanisms | 143/143 | 100 | 0 | 91/91 | 100 |
| hold_route | 143/143 | 100 | 0 | 91/91 | 100 |
| dropped_jobs | 52/143 | 36.36 | 91 | 0/91 | 0 |
| hold_basis | 52/143 | 36.36 | 91 | 0/91 | 0 |
| lean_route | 125/143 | 87.41 | 18 | 0/18 | 0 |
| lean_subtype | 125/143 | 87.41 | 18 | 0/18 | 0 |
| li_function | 12/143 | 8.39 | 131 | 0/131 | 0 |
| pair_rule | 17/143 | 11.89 | 126 | 0/126 | 0 |
| provisional | 0/143 | 0 | 143 | 0/143 | 0 |
| ruled_route | 81/143 | 56.64 | 62 | 0/62 | 0 |

Aggregate: 1744/3003 (58.08%). This is a mechanical diagnostic measure: free-prose traces, omitted lane-A-only fields and confidence schema differences dominate it. It is not a behavioural quality score and cannot block the lock.

### Cohort roles

| Role | Records | User cells agree | Fully user-agreeing products | Log cells agree |
|---|---|---|---|---|
| calibration | 128 | 1906/1920 | 115/128 | 1541/2688 |
| negative_control | 15 | 225/225 | 15/15 | 203/315 |

### Hold check

Raw, unmasked hold_level values are checked wherever either lane emits one: **46/46 identical; 0 mismatches**.

Mismatch list: none.

### Subtype coverage

Coverage requires agreement on committed/held state **and** subtype. It does not imply agreement on all other user fields; that stricter count is shown separately. Held means pending_leave_in_addendum, with a profile but no release for recommendation.

| Subtype | Committed | Held | Total | Every user field agrees | Round 4 total | <5 flag |
|---|---|---|---|---|---|---|
| gel | 7 | 2 | 9 | 7 | 9 | no |
| curl_cream | 1 | 5 | 6 | 5 | 6 | no |
| mousse | 5 | 0 | 5 | 5 | 5 | no |
| blowdry_lotion | 9 | 0 | 9 | 7 | 9 | no |
| smoothing_styler | 1 | 5 | 6 | 5 | 5 | no |
| hairspray | 7 | 0 | 7 | 7 | 7 | no |
| shine_finish | 10 | 0 | 10 | 10 | 9 | no |
| salt_spray | 5 | 1 | 6 | 5 | 6 | no |
| texture_spray | 6 | 0 | 6 | 4 | 6 | no |
| hair_powder | 8 | 0 | 8 | 6 | 8 | no |
| molding | 13 | 0 | 13 | 12 | 11 | no |
| refresher | 1 | 5 | 6 | 6 | 6 | no |

Exact committed and held slug lists are stored in diff.json. The R3-Q1 smoothing market-size exception is unnecessary when its measured total already reaches five.

### Round-4 rulings: product-level landing

“Landed” evaluates only the cited settled outcome, not every property of that product. R4-Q2 landed on alverde’s route/subtype/primary, while its later definition secondary remains disputed.

| Ruling | Product | Expected ruled fields | A actual | B actual | Landed A / B | Other user disagreements |
|---|---|---|---|---|---|---|
| R4-Q1 | American Crew FIBER<br>`american-crew-fiber` | {"route":"styling","subtype":"molding","primary_job":"hold_fix"} | {"route":"styling","subtype":"molding","primary_job":"hold_fix"} | {"route":"styling","subtype":"molding","primary_job":"hold_fix"} | yes / yes | none |
| R4-Q1 | Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray<br>`kerastase-curl-manifesto-refresh-absolu` | {"route":"leave_in"} | {"route":"leave_in"} | {"route":"leave_in"} | yes / yes | none |
| R4-Q1/P4-1 | American Crew Styling Pomade<br>`american-crew-pomade` | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | yes / yes | none |
| R4-Q1 | LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | yes / yes | none |
| R4-Q1/P4-1 | Redken BEACH SPRAY BEACHY TEXTURE SPRAY<br>`redken-styling-beach-spray` | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | {"route":"provisional_boundary","boundary_reason":"evidence_gate"} | yes / yes | none |
| R4-Q2 | alverde NATURKOSMETIK Beach Waves Spray Seaside Balance<br>`alverde-beach-waves-spray-seaside-balance` | {"route":"styling","subtype":"salt_spray","primary_job":"texture"} | {"route":"styling","subtype":"salt_spray","primary_job":"texture"} | {"route":"styling","subtype":"salt_spray","primary_job":"texture"} | yes / yes | secondary_jobs |
| R4-Q2 | Syoss Glaze Topcoat<br>`syoss-glaze-topcoat` | {"route":"styling","subtype":"shine_finish","primary_job":"shine"} | {"route":"styling","subtype":"shine_finish","primary_job":"shine"} | {"route":"styling","subtype":"shine_finish","primary_job":"shine"} | yes / yes | none |
| R4-Q2/RG4-4 (slogan context) | L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray)<br>`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` | {"route":"dry_shampoo"} | {"route":"dry_shampoo"} | {"route":"dry_shampoo"} | yes / yes | none |
| R4-Q3 | AUSSIE WORK THAT CURL LEAVE-IN CREAM<br>`aussie-leave-in-creme-work-that-curl` | {"route":"leave_in"} | {"route":"leave_in"} | {"route":"leave_in"} | yes / yes | none |
| R4-Q3 (unchanged example) | Redken One United All-in-One Multi-Benefit Treatment<br>`redken-one-united-all-in-one-multi-benefit-treatment` | {"route":"leave_in"} | {"route":"leave_in"} | {"route":"leave_in"} | yes / yes | none |
| R4-Q3 (unchanged example) | Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion)<br>`wella-eimi-smooth-perfect-me` | {"route":"leave_in"} | {"route":"leave_in"} | {"route":"leave_in"} | yes / yes | none |
| R4-Q3 (unchanged example) | Wella Professionals EIMI Nutricurls Fresh Up<br>`wella-eimi-nutricurls-fresh-up` | {"route":"leave_in"} | {"route":"leave_in"} | {"route":"leave_in"} | yes / yes | none |
| R4-Q4 | Balea Glattspray Anti-Frizz<br>`balea-glattspray-anti-frizz` | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"smoothing_styler"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"smoothing_styler"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"smoothing_styler"} | yes / yes | none |
| R4-Q5 | BALI CURLS Haargel Strong Hold Flaxseed<br>`bali-curls-strong-hold-flaxseed-gel` | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"gel"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"gel"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"gel"} | yes / yes | none |
| R4-Q5 | Kevin.Murphy Killer.Curls (Leave-in Anti-Frizz Creme)<br>`kevin-murphy-killer-curls` | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"curl_cream"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"curl_cream"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"curl_cream"} | yes / yes | none |
| R4-Q5 | John Frieda Lockencreme Traumlocken (Frizz Ease Traumlocken Definierende Locken-Creme)<br>`john-frieda-frizz-ease-traumlocken-lockencreme` | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"curl_cream"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"curl_cream"} | {"route":"provisional_boundary","boundary_reason":"pending_leave_in_addendum","subtype":"curl_cream"} | yes / yes | none |
| R4-Q6 | HASK curls defining cream<br>`hask-lockencreme-curl-care` | {"route":"leave_in"} | {"route":"leave_in"} | {"route":"leave_in"} | yes / yes | none |
| R4-Q6 | L'Oréal Men Expert Barber Club Styling Pomade Bart & Haar mit ätherischem Zedernholzöl<br>`loreal-men-expert-barber-club-styling-pomade` | {"route":"styling","subtype":"molding"} | {"route":"styling","subtype":"molding"} | {"route":"styling","subtype":"molding"} | yes / yes | none |
| R4-Q6 | Redken Wax Spray (Redken Spray Wax)<br>`redken-wax-spray` | {"route":"styling","subtype":"texture_spray"} | {"route":"styling","subtype":"texture_spray"} | {"route":"styling","subtype":"texture_spray"} | yes / yes | none |
| R4-Q6 | Schwarzkopf taft (taft x GLISS) Glanz-Spray taft x Gliss Silky Shine<br>`schwarzkopf-taft-x-gliss-silky-shine-shine-coat` | {"route":"styling","subtype":"shine_finish"} | {"route":"styling","subtype":"shine_finish"} | {"route":"styling","subtype":"shine_finish"} | yes / yes | none |
| R4-Q6 | Balea Finishing Spray Glow & Care<br>`balea-finishing-spray-glow-und-care` | {"route":"styling","subtype":"shine_finish"} | {"route":"styling","subtype":"shine_finish"} | {"route":"styling","subtype":"shine_finish"} | yes / yes | none |
| R4-Q6 | John Frieda Traumlocken Belebender Wellenauffrischer<br>`john-frieda-traumlocken-belebender-wellenauffrischer` | {"route":"provisional_boundary","boundary_reason":"mixed_promise"} | {"route":"provisional_boundary","boundary_reason":"mixed_promise"} | {"route":"provisional_boundary","boundary_reason":"mixed_promise"} | yes / yes | none |
| R4-Q7 | Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz)<br>`schwarzkopf-taft-gel-wax-glanz-halt-2` | {"route":"styling","subtype":"molding","primary_job":"hold_fix","finish":"glänzend"} | {"route":"styling","subtype":"molding","primary_job":"hold_fix","finish":"glänzend"} | {"route":"styling","subtype":"molding","primary_job":"hold_fix","finish":"glänzend"} | yes / yes | none |
| R4-Q7 | got2b (Schwarzkopf) Styling Paste iStyler Texture Clay<br>`got2b-styling-paste-istyler-texture-clay` | {"route":"styling","subtype":"molding","primary_job":"hold_fix","secondary_jobs":["texture"]} | {"route":"styling","subtype":"molding","primary_job":"hold_fix","secondary_jobs":["texture"]} | {"route":"styling","subtype":"molding","primary_job":"hold_fix","secondary_jobs":["texture"]} | yes / yes | none |
| R4-Q7 (compound qualifier) | Balea Styling Glow Wax<br>`balea-haarwachs-glow-wax` | {"route":"styling","subtype":"molding","primary_job":"hold_fix"} | {"route":"styling","subtype":"molding","primary_job":"hold_fix"} | {"route":"styling","subtype":"molding","primary_job":"hold_fix"} | yes / yes | none |
| R4-H(4)/R4-Q1 | Bumble and bumble brilliantine<br>`bumble-and-bumble-brilliantine` | {"route":"styling","subtype":"shine_finish","primary_job":"shine"} | {"route":"styling","subtype":"shine_finish","primary_job":"shine"} | {"route":"styling","subtype":"shine_finish","primary_job":"shine"} | yes / yes | none |
| R4-H(5) | Balea MEN Pomade Haar & Bart 2in1<br>`balea-men-pomade-haar-bart-2in1` | {"primary_job":"hold_fix","secondary_jobs":[]} | {"primary_job":"hold_fix","secondary_jobs":[]} | {"primary_job":"hold_fix","secondary_jobs":[]} | yes / yes | none |

The R4-Q2/RG4-4 slogan context also named John Frieda Blow-Out as unchanged Leave-in. That effect note was not a named registry route ruling; R4-Q2 resolves slogans, not the Frizz Ease prefix. Its new route difference is therefore shown as an owner question, not hidden as “Q2 landed”.

| Housekeeping | Result | Evidence and limit |
|---|---|---|
| R4-H(1) | confirmed in stated scope (text/schema check; outcome example HASK in ruling table) | No opaque registry_row introduced. HASK matches by brand + confirmed name in both lanes. This does not independently prove every registry-match mechanism. |
| R4-H(2) | confirmed in stated scope (internal flag present; not a user-facing lock field) | Annotation suffix differs in A, but both retain the internal conflict flag; user-facing molding/finish outcome is checked under R4-Q7. |
| R4-H(3) | confirmed in stated scope (operational confirmation; no isolated counterfactual) | Unknown-position promise lines retain packet order. Both lanes use the first job-bearing sentence for these examples; registry/tie rules also contribute, so this is application evidence rather than proof of a uniquely H3-caused change. |
| R4-H(4) | confirmed in stated scope (product output checked in ruling table) | Brilliantine primary shine in both; §11.8 C row still says jobs empty (latent editorial residue). |
| R4-H(5) | confirmed in stated scope (product output checked in ruling table) | Balea MEN Pomade excludes definition from a typed hold entry in both lanes; §11.9 worked row still has definition (latent editorial residue). |

H1–H3 include text/schema or operational checks; they are not represented as isolated product-behaviour experiments. H3 example values and paths are in diff.json.

### R3-H5 Wella EIMI scale

All 9 C1/C2 Haltegrad/Haltestufe cases are discovered from the frozen claims. 5 have Styling/held profiles. The remaining 4 correctly withhold Styling hold_level under §4.7. Claim normalization uses the governing 1–2 → 1, 3 → 3, 4/4+ → 4 table, not prior lane labels.

| Product | Captured scale text | Normalized claim level | Expected emitted level | A | B | Landed A / B | Scope |
|---|---|---|---|---|---|---|---|
| Wella Professionals EIMI Glam Mist Shinespray<br>`wella-eimi-glam-mist-shine-spray` | Vollende deinen glamourösen Style mit diesem Glanzspray. Entwickelt auch zum Schutz des Haares vor Auswirkung von Feuchtigkeit und UV-Strahlen. Haltegrad 1; HALTEGRAD 1; Haltegrad 1 | 1 | 1 | 1 | 1 | yes / yes | Emitted Styling/held profile level must use R3-H5. |
| Wella Professionals EIMI Nutricurls Curl Shaper (Defining Gel Cream)<br>`wella-eimi-nutricurls-curl-shaper` | Haltestufe: 2 | 1 | 1 | 1 | 1 | yes / yes | Emitted Styling/held profile level must use R3-H5. |
| Wella Professionals EIMI Nutricurls Fresh Up<br>`wella-eimi-nutricurls-fresh-up` | Haltegrad 1 | 1 | null | null | null | yes / yes | No Styling profile: §4.7 withholds Styling hold_level. Captured scale can be normalized for audit, but cannot fabricate an emitted Styling value. |
| Wella Professionals EIMI Smooth Perfect Me (Balsam-Lotion)<br>`wella-eimi-smooth-perfect-me` | Haltegrad: 1 | 1 | null | null | null | yes / yes | No Styling profile: §4.7 withholds Styling hold_level. Captured scale can be normalized for audit, but cannot fabricate an emitted Styling value. |
| Wella Professionals EIMI Smooth Thermal Image (2-Phasen-Spray)<br>`wella-eimi-smooth-thermal-image` | Unser EIMI Thermal Image 2-Phasen-Spray schützt Ihr Haar bei der Verwendung von heißen Geräten. Phase 1 pflegt das Haar und schützt es vor Hitze bis zu 220°C. Phase 2 glättet Ihr Haar für ein makelloses, glänzendes Ergebnis. Haltegrad: 2; Haltegrad: 2 | 1 | null | null | null | yes / yes | No Styling profile: §4.7 withholds Styling hold_level. Captured scale can be normalized for audit, but cannot fabricate an emitted Styling value. |
| Wella Professionals EIMI Volume Sugar Lift Volumenspray<br>`wella-eimi-sugar-lift` | Haltegrad: 3 | 3 | 3 | 3 | 3 | yes / yes | Emitted Styling/held profile level must use R3-H5. |
| Wella Professionals EIMI Texture Ocean Spritz (Texturizing Salt Spray)<br>`wella-eimi-texture-ocean-spritz` | Kreiere mit EIMI Ocean Spritz, einem natürlichen Mineralsalzspray, das das Haar vor Austrocknung und UV-Schäden schützt, eine lockere, strandähnliche Textur. Haltegrad: 2; Haltegrad: 2 | 1 | 1 | 1 | 1 | yes / yes | Emitted Styling/held profile level must use R3-H5. |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo)<br>`wella-eimi-volume-dry-me` | Erreiche Deinen Look mit Dry Me, einem Trockenshampoo, das Volumen und eine handhabbare, matte Textur schafft. Die Formel des Trockenshampoos mit Tapiokastärke erfrischt Ihr Haar und absorbiert Öl. Haltegrad: 1; Haltegrad: 1 | 1 | null | null | null | yes / yes | No Styling profile: §4.7 withholds Styling hold_level. Captured scale can be normalized for audit, but cannot fabricate an emitted Styling value. |
| Wella Professionals EIMI Flowing Form (Smooth Flowing Form) Glättungscreme / Anti-Frizz Smoothing Balm<br>`wella-professionals-eimi-flowing-form` | Haltegrad: 2 | 1 | 1 | 1 | 1 | yes / yes | Emitted Styling/held profile level must use R3-H5. |

### Round 4 → round 6

R4 lane bytes are re-normalized with the same primary-only, boundary-aware r6 scorer; source_slug joins verified via r6 id_map.round4_sample_id and r4 cohort. Original r4 register entries are also preserved below, including its formerly supplementary secondary_jobs. Field persistence means same product+field, not necessarily same values or root cause.

On the common normalized user-facing definition: **65 round-4 disagreement cells → 61 gone, 4 persisting**; **10 new cells in r6**. “Persisting” is the same product/field, even if the candidate values or explanation changed.

| Round-4 product | Field | R4 A / B | Status in r6 | R6 A / B |
|---|---|---|---|---|
| alverde NATURKOSMETIK Beach Waves Spray Seaside Balance<br>`alverde-beach-waves-spray-seaside-balance` | primary_job | "definition" / "texture" | gone | "texture" / "texture" |
| alverde NATURKOSMETIK Beach Waves Spray Seaside Balance<br>`alverde-beach-waves-spray-seaside-balance` | secondary_jobs | ["texture"] / [] | **persists** | ["definition"] / [] |
| American Crew FIBER<br>`american-crew-fiber` | alcohol_note | null / "does_not_fire" | gone | "does_not_fire" / "does_not_fire" |
| American Crew FIBER<br>`american-crew-fiber` | application_moment | null / "damp_before_drying" | gone | "damp_before_drying" / "damp_before_drying" |
| American Crew FIBER<br>`american-crew-fiber` | buildup_note | null / "fires" | gone | "fires" / "fires" |
| American Crew FIBER<br>`american-crew-fiber` | finish | null / "unbekannt" | gone | "unbekannt" / "unbekannt" |
| American Crew FIBER<br>`american-crew-fiber` | flexibility | null / "unbekannt" | gone | "unbekannt" / "unbekannt" |
| American Crew FIBER<br>`american-crew-fiber` | heat_activated | null / "no" | gone | "no" / "no" |
| American Crew FIBER<br>`american-crew-fiber` | neutral_fact | null / "enthält stylingpolymere (z. b. pvp)" | gone | "enthält stylingpolymere (z. b. pvp)" / "enthält stylingpolymere (z. b. pvp)" |
| American Crew FIBER<br>`american-crew-fiber` | primary_job | null / "hold_fix" | gone | "hold_fix" / "hold_fix" |
| American Crew FIBER<br>`american-crew-fiber` | provides_heat_protection | null / false | gone | false / false |
| American Crew FIBER<br>`american-crew-fiber` | route | {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} / {"destination":"styling","boundary_reason":null} | gone | {"destination":"styling","boundary_reason":null} / {"destination":"styling","boundary_reason":null} |
| American Crew FIBER<br>`american-crew-fiber` | secondary_jobs | null / [] | gone | [] / [] |
| American Crew FIBER<br>`american-crew-fiber` | subtype | null / "molding" | gone | "molding" / "molding" |
| American Crew FIBER<br>`american-crew-fiber` | target_zone | null / "all" | gone | "all" / "all" |
| American Crew FIBER<br>`american-crew-fiber` | weight | null / "rich" | gone | "rich" / "rich" |
| American Crew Styling Pomade<br>`american-crew-pomade` | alcohol_note | null / "does_not_fire" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | application_moment | null / "damp_before_drying" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | buildup_note | null / "fires" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | finish | null / "unbekannt" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | flexibility | null / "unbekannt" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | heat_activated | null / "no" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | neutral_fact | null / "enthält stylingpolymere (z. b. pvp)" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | primary_job | null / "hold_fix" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | provides_heat_protection | null / false | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | route | {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} / {"destination":"styling","boundary_reason":null} | gone | {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} / {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} |
| American Crew Styling Pomade<br>`american-crew-pomade` | secondary_jobs | null / [] | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | subtype | null / "molding" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | target_zone | null / "all" | gone | null / null |
| American Crew Styling Pomade<br>`american-crew-pomade` | weight | null / "rich" | gone | null / null |
| AUSSIE WORK THAT CURL LEAVE-IN CREAM<br>`aussie-leave-in-creme-work-that-curl` | route | {"destination":"provisional_boundary","boundary_reason":"mixed_promise"} / {"destination":"leave_in","boundary_reason":null} | gone | {"destination":"leave_in","boundary_reason":null} / {"destination":"leave_in","boundary_reason":null} |
| Balea Finishing Spray Glow & Care<br>`balea-finishing-spray-glow-und-care` | secondary_jobs | ["frizz_control"] / ["frizz_control","sleek"] | gone | ["frizz_control"] / ["frizz_control"] |
| Balea MEN Pomade Haar & Bart 2in1<br>`balea-men-pomade-haar-bart-2in1` | secondary_jobs | ["definition"] / [] | gone | [] / [] |
| Balea Sea Salt Texture Spray<br>`balea-sea-salt-texture-spray` | secondary_jobs | ["definition"] / [] | gone | [] / [] |
| Bali Curls Sleek Stick Brows & Edges<br>`bali-curls-sleek-stick-brows-and-edges` | secondary_jobs | ["frizz_control","hold_fix"] / ["hold_fix"] | **persists** | ["frizz_control","hold_fix"] / ["hold_fix"] |
| BALI CURLS Volumizing Curl Spray<br>`bali-curls-volumizing-curl-spray-refreshing` | secondary_jobs | ["volume"] / ["texture","volume"] | gone | ["texture","volume"] / ["texture","volume"] |
| COLOR WOW Dream Coat Supernatural Spray<br>`color-wow-dream-coat-supernatural-spray` | heat_activated | "no" / "unresolved" | gone | "unresolved" / "unresolved" |
| got2b (Schwarzkopf) Styling Mattpaste Strand Matte<br>`got2b-styling-mattpaste-strand-matte` | secondary_jobs | [] / ["texture"] | **persists** | [] / ["texture"] |
| got2b (Schwarzkopf) Styling Paste iStyler Texture Clay<br>`got2b-styling-paste-istyler-texture-clay` | primary_job | "texture" / "hold_fix" | gone | "hold_fix" / "hold_fix" |
| got2b (Schwarzkopf) Styling Paste iStyler Texture Clay<br>`got2b-styling-paste-istyler-texture-clay` | secondary_jobs | ["hold_fix"] / ["texture"] | gone | ["texture"] / ["texture"] |
| GUHL Föhn-Spray Langzeit Volumen (Föhn-Aktiv Styling Spray)<br>`guhl-foehn-spray-langzeit-volumen` | heat_activated | "no" / "yes" | gone | "yes" / "yes" |
| HASK curls defining cream<br>`hask-lockencreme-curl-care` | route | {"destination":"leave_in","boundary_reason":null} / {"destination":"provisional_boundary","boundary_reason":"mixed_promise"} | gone | {"destination":"leave_in","boundary_reason":null} / {"destination":"leave_in","boundary_reason":null} |
| Kérastase CURL MANIFESTO REFRESH ABSOLU Second day curl refreshing spray<br>`kerastase-curl-manifesto-refresh-absolu` | route | {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} / {"destination":"leave_in","boundary_reason":null} | gone | {"destination":"leave_in","boundary_reason":null} / {"destination":"leave_in","boundary_reason":null} |
| KMS Thermashape 2-in-1 Spray<br>`kms-thermashape-2-in-1-spray` | heat_activated | "no" / "yes" | gone | "yes" / "yes" |
| KMS Thermashape 2-in-1 Spray<br>`kms-thermashape-2-in-1-spray` | secondary_jobs | ["definition"] / ["definition","hold_fix"] | **persists** | ["hold_fix"] / ["definition","hold_fix"] |
| KMS Thermashape Straightening Creme<br>`kms-thermashape-straightening-creme` | heat_activated | "no" / "yes" | gone | "yes" / "yes" |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | alcohol_note | null / "does_not_fire" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | application_moment | null / "damp_before_drying" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | buildup_note | null / "does_not_fire" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | finish | null / "unbekannt" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | flexibility | null / "unbekannt" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | heat_activated | null / "no" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | primary_job | null / "definition" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | provides_heat_protection | null / false | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | route | {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} / {"destination":"provisional_boundary","boundary_reason":"pending_leave_in_addendum"} | gone | {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} / {"destination":"provisional_boundary","boundary_reason":"evidence_gate"} |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | secondary_jobs | null / ["hold_fix","volume"] | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | subtype | null / "gel" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | target_zone | null / "all" | gone | null / null |
| LANGHAARMÄDCHEN LOCKENHALT SPRAY Halt & Sprungkraft<br>`langhaarmaedchen-lockenspray-halt-sprungkraft` | weight | null / "light" | gone | null / null |
| L'ORÉAL PARiS Elnett Haarspray Extra Starker Halt<br>`loreal-paris-elnett-haarspray-extra-starker-halt` | secondary_jobs | ["volume"] / [] | gone | [] / [] |
| L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt<br>`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | finish | "glänzend" / "unbekannt" | gone | "unbekannt" / "unbekannt" |
| L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt<br>`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` | secondary_jobs | ["frizz_control","shine"] / ["frizz_control"] | gone | ["frizz_control"] / ["frizz_control"] |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz)<br>`schwarzkopf-taft-gel-wax-glanz-halt-2` | primary_job | "shine" / "hold_fix" | gone | "hold_fix" / "hold_fix" |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz)<br>`schwarzkopf-taft-gel-wax-glanz-halt-2` | secondary_jobs | [] / ["shine"] | gone | ["shine"] / ["shine"] |
| Schwarzkopf Taft Gel Wax Glanz (Strahlender Glanz)<br>`schwarzkopf-taft-gel-wax-glanz-halt-2` | subtype | "shine_finish" / "molding" | gone | "molding" / "molding" |

New user-facing cells:

| Product | Field | A / B | Class |
|---|---|---|---|
| Balea Haargel Hair Jelly (Styling Hair Jelly)<br>`balea-haargel-hair-jelly` | secondary_jobs | ["sleek"] / ["definition","sleek"] | a |
| Balea Styling Spray Volumenpuder Pure Styling<br>`balea-pure-styling-volumenpuder-spray` | target_zone | "roots" / "all" | b |
| Bali Curls Sleek Stick Brows & Edges<br>`bali-curls-sleek-stick-brows-and-edges` | primary_job | "sleek" / "frizz_control" | a |
| got2b Styling Puder Volumen Powderfull<br>`got2b-styling-puder-volumen-powderfull` | secondary_jobs | ["hold_fix"] / [] | a |
| John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray<br>`john-frieda-frizz-ease-unendlich-smooth-blow-out-spray` | route | {"destination":"leave_in","boundary_reason":null} / {"destination":"heat_protectant","boundary_reason":null} | d |
| Maria Nila Curlicue Cream (Stylingcreme)<br>`maria-nila-curlicue-cream` | secondary_jobs | ["volume"] / ["hold_fix","volume"] | a |
| Moroccanoil Root Boost<br>`moroccanoil-root-boost` | secondary_jobs | ["texture"] / ["frizz_control","texture"] | a |
| Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder)<br>`moroccanoil-textur-und-volumenpuder` | secondary_jobs | ["hold_fix","texture"] / ["texture"] | a |
| Moroccanoil Volumizing Spray (Volumizing Mist)<br>`moroccanoil-volumizing-spray` | secondary_jobs | ["hold_fix","texture"] / ["texture"] | a |
| Redken Root Tease<br>`redken-root-tease` | target_zone | "roots" / "all" | b |

The complete original round-4 register (95 cells, including formerly supplementary secondary_jobs) is retained in diff.json with gone/persists status: 85 gone, 10 persist. Calculation-log history is also retained. It is excluded from lock blocking under R4-L.

### Lock criteria

| Criterion | Result | Computed evidence |
|---|---|---|
| (a) Every normative subtype >=5, committed + held where route state and subtype agree | **PASS** | 12/12; below 5: none |
| (b) Every user-facing difference resolved; final confirmation has only proven lane errors and no new user-facing rule gap (R3-L/R4-L) | **FAIL** | a=10, b=3, c=0, d=1; b+c+d=4, required 0 |
| (c) Hold levels resolved (raw identical levels where either lane emits, or proven error/closed gap) | **PASS** | 46/46; 0 mismatches |
| (d) Unseen criterion already met in round 2; not retested in r6 | **PASS** | computed: 7 slots match all firm values in both lanes (A 8/8, B 7/8); 7 trap slots with route+reason matched by both lanes (1, 2, 3, 4, 5, 6, 7). Analyst note: 8 unseen, 8/8 traps caught by both lanes; firm A 148/148, B 147/148 (one pair-rule code); 7 UNDETERMINED values not scorable (rule gaps); NOT retested |
| (e) Leave-in addendum draft exists at the requested path | **PASS** | docs/research/leave-in-inci/v1.2/DRAFT-styling-border-addendum.md: exists=true; DRAFT, not in force |

**Overall: FAIL.** Close the user-facing rule gaps and owner question, synchronize the standard/examples, and run a fresh confirmation for the changed behaviour. Calculation-log differences and already-settled latent editorial corrections alone do not require another round.

### Scope and reproduction

- Known-product final confirmation, not new unseen validation or deployed-app testing.
- Human rule interpretation is recorded explicitly; counts, joins, agreement, coverage, history and verdict are computed. Ambiguous behaviour is not repaired or treated as approved by this score.
- Shared errors are outside a disagreement-only lock criterion; ruling-example checks and latent reports expose sampled shared-output risks.
- Draft existence passes criterion (e); R4-H requests updating the addendum after lock. This audit does not claim that its old v0.4 wording is approved or current.

Run `node data/research/styling-inci/v1.0/round-6/diff.js --summary` twice, then compare `shasum -a 256 data/research/styling-inci/v1.0/round-6/diff.json`. Fixed input hashes are recorded in diff.json; no timestamps, randomness, input run_at metadata or absolute paths enter the output.

Current diff.json SHA-256: `12bc05771f0e11c155f75a44a13b9aced67895c3b5c288a45cd8b4cb90e2f9dc`.
