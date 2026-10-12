# Styling v1.0 property set (v0 — Phase 2, pre-calibration)

Status: **Updated 2026-10-12 for standard v0.2 / lexicon v0.2 after blind round 1 (R1-Q1…R1-Q4, R1-T); next: round-2 re-captures and blind round 2.** Phase 2 ruled 2026-10-11 (PH2-1…12). Phase 1 ruled 2026-10-09 (PH1-1…16). Not locked. It formalises the property set presented to Nick on 2026-10-09 as ruled. The six former proposals PS1–PS6 are ruled (§8). The rulings change three properties: `drying_alcohol_load` becomes the trigger for the reused Leave-in alcohol note (`alcohol_note`, PH1-3), `washability` is removed (PH1-4), and `weight` uses the shared scale light · medium · rich (PH1-4). PH1-15 adds one property, `provides_heat_protection`. Everything else either encodes a ruling or is a mechanical v0 convention that the Phase-3 lexicon and Phase-4 calibration may adjust ("first set, then adjust", as in Mask). Items the Phase 2 rulings closed are marked with their PH2 ID in §9; items still open stay marked **Open**.
**Version note (2026-10-12, updated in place).** This file keeps its name and section numbers; the round-1 rulings change §2.2 (shine_finish job, R1-Q2), §2.3 (particulate count corrected to 11), §2.4 (PQ-69, R1-T), §2.10 („Kleber", name-derived words; RG-14, P-2), §2.11 (RG-10), §2.12 (RG-11, RG-12), §2.13 (RG-2, RG-8), §2.14 (RG-9), §2.15 (R1-Q4), §5.2–§5.4 and §5.6 (R1-Q1, RG-13, RG-19, P-1) and add §9 items 16–20. The standard v0.2 changelog lists every change with its ruling id; where this file and the standard differ, the standard's executable reading governs below the ledger.
Charter: `00_category_charter.md` (its former proposals are cited as charter P1–P4, now ruled as PH1-11, PH1-7, PH1-8, PH1-9). Governing order: `plans/styling-concept/02-rulings.md` (SD1–SD5, D1–D8b, PH1-1…PH1-16, PH2-1…PH2-12, R1-Q1…R1-Q4, R1-T) > charter > `plans/styling-concept/01-styling-concept.md` Rev. 2.
Inherited method: Leave-In Standard v1.0 (cited "LI §x"); Mask Standard (cited "Mask §x").
Evidence: `data/research/styling-inci/concept-v0/calibration-set-r2.json` (70 Styling records) with the raw INCI, claims and directions in `samples/*.json` and `round2/`. Every example names a real `sample_id`, re-read from the raw record on 2026-10-09. Counts marked **dry run** come from one scratch pass of the v0 rules over the 70 records. That pass is not committed; Phase 3 reproduces it under the versioned lexicon.
Stop condition: research artifact only (charter §16). No catalog, Supabase, intake or matcher change.

## 0. Conventions for every property

| Topic | Rule |
|---|---|
| Source kinds | **R** routing (S0 output) · **F** formula-blind (frozen INCI only) · **U** usage (frozen directions transcription) · **C** claim (C1/C2 only, LI §2.4.1) · **D** derived echo. |
| Evidence level | LI §3.1 ladder: identity facts and directions transcriptions are E1; any value read from the formula is E2; claims are E0 (charter §11). |
| Tail marker | "Above the tail" means strictly before the marker. **Ruled — PH1-1 (PS1):** for Styling's own properties the marker is Mask's `tail_index` (Mask §3.1), in the ledger's words "the first preservative or perfume, whichever comes first". Mask's marker classes are fragrance, declared allergen, preservative, booster-in-a-pair and chelator; **PH2-9 confirms the full Mask rule** (§9 item 11). The S0 / LI G0 border check keeps LI's own marker unchanged, and the D6 care test uses the first preservative and its own dose yardstick (PH1-13, charter §5). A load-bearing member at `tail_index − 1` still counts, but caps confidence at `moderate` (Mask E1). The plausibility tests (LI T16/T17, Mask E2) apply, with "establishing species" = the members that establish `result_mechanisms` and `weight`. Example: `loreal-paris-elnett-haarspray-extra-starker-halt` has Hydroxycitronellal r4 as its first tail-class member while Parfum is r28. Under Mask E2 that marker is `unresolved` ⇒ review. No value moves, because the fixative sits at r3 either way. |
| Conservative failure | LI §1.1. Every rule fails toward review or toward the anchor's conservative value, never toward a more favourable value. |
| Separation | Subtype, product name and format **never set an F value** (LI G9 parity). F never sets a C value, and C never sets an F value. The only permitted crossings are listed in §7. |
| Confidence | `high` / `moderate` / `low` per the category template §7. **Internal only, never user-facing.** |
| Format | `gel · spray_gel · jelly · cream · foam · pump_spray · aerosol · wax · paste · pomade · powder` is identity data (LI G1), not a researched property. |
| Presence vs architecture | `ingredient_flags` read the whole list. Every other F property reads only above the tail. |

## 1. Overview

| # | Property | Values (+ unknown state) | Kind | Decision | Main consumers |
|---|---|---|---|---|---|
| 1 | `route` | styling · leave_in · oil · heat_protectant · dry_shampoo · provisional_boundary | R | gated sequence (S0) | category assignment |
| 2 | `styling_subtype` | 12 keys | R | structured judgment | Stage-5 role, subtype choice |
| 3 | `result_mechanisms` | fixative_film · natural_film · wax_lipid · particulate · salt · silicone_coat · humectant_only · none | F | deterministic (lexicon) | subtype extras, D8b, job gate, cautions |
| 4 | `hold_route` | present · absent · ambiguous | F | deterministic | neutral fact, D6 border, D8b |
| 5 | `weight` | light · medium · rich · unknown | F | structured judgment (PH1-2, PH1-4) | thickness fit, buildup note |
| 6 | `alcohol_note` | fires · does_not_fire | F | deterministic (PH1-3) | the reused Leave-in alcohol note |
| 7 | *(removed: `washability`, PH1-4)* | — | — | — | replaced by the reused Leave-in buildup note (§4) |
| 8 | `ingredient_flags` | silicones · oils · fragrance · salt · propellant + `fixative_family[]` | F | deterministic presence | filters, neutral fact |
| 9 | `chaarlie_hold_level` | 0–4 · null („keine Herstellerangabe") · `review` | C | deterministic normalisation (§5) | hold band ranking in 6 subtypes |
| 10 | `flexibility` | beweglich · fest · unbekannt | C | lexicon (PH1-5) | flexibility preference |
| 11 | `finish` | matt · natürlich · glänzend · unbekannt | C + F sanity | lexicon (PH1-5) | finish preference |
| 12 | `primary_job` + `secondary_jobs` (≤ 2) | definition · volume · texture · sleek · hold_fix · shine · frizz_control · refresh | C + F gate | structured judgment | goal/problem matching |
| 13 | `application_moment` | damp_before_drying · before_heat · dry_finish · dry_restyle · second_day · unresolved | U | transcription with anchors | routine compiler slot |
| 14 | `target_zone` | all · roots · lengths · surface · hairline | U | transcription with anchors | root lift, edge branch, caution |
| 15 | `heat_activated` | yes · no · unresolved | U (+ C raise) | transcription | routine order |
| 16 | `captured_claims` | typed verbatim list | C | capture only | **nothing**: never selection |
| 17 | `provides_heat_protection` | true · false | C + F (L9 check) | deterministic (PH1-15, Leave-in HEAT rule) | Personal-Plan heat-protection step |

Subtype extras are in §3 and derived echo fields and notes in §4. Section numbers stay stable: §2.7 is kept as a removal stub, and the new property is §2.17.

## 2. Base properties

### 2.1 `route`

| Field | Definition |
|---|---|
| Values | `styling` · `leave_in` · `oil` · `heat_protectant` · `dry_shampoo` · `provisional_boundary` |
| Consumer meaning | Which engine profiles the product. `styling` receives the rest of this set; so does a record **held** under PH1-16 (`provisional_boundary`, reason `pending_leave_in_addendum`, lean route `styling`): **PH2-2** gives it the **complete** Styling profile, marked `provisional`, counted separately toward "≥ 5 per subtype" and **not matchable or recommendable** until the Leave-in addendum is approved. Every other `provisional_boundary` gets no Styling profile. |
| Source | R: the S0 gate (charter §5) reads the C1/C2 promise class, the directions and the LI G0 formula halves. Not blind. |
| Decision | Ordered gates. LI G0 is a structured judgment; D2 and D7 are the only name rules. |
| Counter-signals | A missing input, a C1/C2 conflict, a `mixed` promise, or a same-market formula conflict (LI T18) ⇒ `provisional_boundary`; the product stays in its current category. **Exception (PH1-12):** the D7 middle-band test runs before the `mixed` stop, so a middle-band curl/styling cream or balm is `styling` (`curl_cream`) even with a mixed promise (`balea-professional-styling-cream-traumlocken`). A refresh + volume/texture co-lead never reaches the stop: tie precedence assigns it the `refresh` class (tie ⇒ Dry Shampoo; standard §4.2). A product both engines could claim is held as `provisional_boundary` until the Leave-in addendum (PH1-16). **Hold scope ruled — PH2-2:** the hold covers every Styling route the unchanged Leave-in letter would also claim (all D6 and D7 moves and the owner-named routes); held records carry the complete Styling profile marked `provisional` (see Consumer meaning). *Superseded:* "scope open, charter §15.2" (Phase 1 text). |
| Claim boundary | The promise picks the boundary. Names route only under D2 („Öl"/„Serum" ⇒ Oil, **only for shine / finish / anti-frizz / smoothing-finish promises**; a protection-first „Serum" reaches the Heat Protectant rule) and D7 (middle band). |
| Confidence | Inherited from LI G0. |
| Fit consumers | Category assignment. The Stage-5 role comes via the subtype family. |
| Calibration | `maria-nila-curlicue-cream` ⇒ styling (T15 `excluded_styling_first`, PVP r4). `neqi-diamond-glass-ultimate-styling-spray` ⇒ leave_in (T15 `incidental_film`, D3). `balea-locken-revitalizing-spray` ⇒ styling (D6). `bali-curls-leave-in-spray-curl-defining` ⇒ provisional_boundary (two INCIs under one GTIN; only two captures, so LI T18 tier-1 convergence is not reachable ⇒ `formula_conflict` until a C1 pack capture; standard §2.2 A2). `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` ⇒ styling `smoothing_styler` (PH1-14). Ruled, not yet applied to the calibration file: `alverde-locken-refresh-spray` ⇒ styling `refresher` with a review flag (PH1-13); `syoss-curl-control-hydrating-spray` ⇒ leave_in, still identity-blocked (PH1-13); `balea-professional-definier-spray-traumlocken` ⇒ leave_in (PH1-10). |

### 2.2 `styling_subtype`

| Field | Definition |
|---|---|
| Values | `gel` Haargel · `curl_cream` Lockencreme · `mousse` Schaumfestiger · `blowdry_lotion` Föhnlotion & Föhnspray · `smoothing_styler` Glättungsstyler · `hairspray` Haarspray & Haarlack · `shine_finish` Glanz- & Anti-Frizz-Finish · `salt_spray` Salz- & Beach-Spray · `texture_spray` Texturspray · `hair_powder` Haarpuder · `molding` Wachs, Paste & Pomade · `refresher` Locken-Refresh. `null` unless `route = styling`. |
| Consumer meaning | How and when the product is used. The family maps to the Stage-5 role: `hairspray` and `shine_finish` ⇒ `finish`; all others ⇒ `styling`. |
| Source | R: the job and moment led by the C1/C2 promise and the directions (charter §3). |
| Decision | Structured judgment against the charter's core-job anchors. Where the job reading leaves two subtypes open, the product's form may break the tie: `balea-styling-creme-power-flex` is sold as „Styling Creme" but is a hydroalcoholic PVP/carbomer gel used damp or dry ⇒ `gel` (concept §2). |
| Counter-signals | A name never decides: Taft „Gel Wax" and got2b „Texture Clay" are both `molding`. |
| Claim boundary | D2 and D7 only. |
| Confidence | `high` when promise and directions agree; `moderate` when the form breaks a tie. |
| Fit consumers | Subtype choice (concept §5.2), D5 plan composition, routine slot. **Never an input to any F property.** |
| Calibration | `color-wow-dream-coat-supernatural-spray` ⇒ `smoothing_styler` (damp, before blow-drying; not „Öl"/„Serum"). `langhaarmaedchen-lockenspray-halt-sprungkraft` ⇒ `gel` (liquid curl-hold spray, spray-gel format). `bali-curls-sleek-stick-brows-and-edges` ⇒ `gel` with `target_zone: hairline` (D1). **R1-Q2:** anti-frizz / flyaway control on dry, finished hair (by the main directions) is the `shine_finish` job, `li_function` no, recommendable now: `balea-professional-glow-und-shine-finishing-spray` and `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` ⇒ `shine_finish`, not held (Feschi once its evidence gate passes); anti-frizz for damp hair or sold as care keeps the Leave-in check (standard §4.2). |

### 2.3 `result_mechanisms`

| Field | Definition |
|---|---|
| Values | A set of 1–n values, each carrying its members `[{inci, rank}]`:<br>• `fixative_film`: a fixative-class polymer (§2.4 list, PH1-6/PH1-16) above the tail.<br>• `natural_film`: hydrolysed or modified starch (Hydrolyzed Corn Starch, Hydroxypropyl Starch, Distarch Phosphate), chitosan, gum arabic/Acacia Senegal gum, in a water-based formula. **Unsettled members** (carrageenan, gellan, unmodified potato/corn/tapioca starch, flax extract) are credited with a `natural_film_unsettled` review note. This is where concept §3.1's "ambiguous" gel/starch cases now live (§9 item 1).<br>• `wax_lipid`: a non-volatile lipid system: waxes, hydrocarbons (petrolatum, paraffin, mineral oil, microcrystalline wax), butters, plant oils, non-volatile esters, lanolin, and fatty acids (stearic/palmitic as soap structure). Members are tagged `structuring` when they are a wax, a solid hydrocarbon, tribehenin or a fatty acid (used by §6).<br>• `particulate`: silica / silica silylate, kaolin and other clays, zeolite, calcium sodium borosilicate, nylon-12, cellulose powder (lexicon PT-1, T4), and starch powders in an anhydrous formula.<br>• `salt`: Maris Sal, Sea Salt or Magnesium Sulfate. **Sodium Chloride is excluded** as a rheology/process salt, mirroring the L5 rheology exclusion.<br>• `silicone_coat`: persistent silicones (Dimethicone, Dimethiconol, Amodimethicone, Phenyl Trimethicone, Polysilicone-29, Silicone Quaternium-18, Trimethylsiloxyphenyl Dimethicone). PEG/PPG-modified silicones are excluded (LI §7.6 `volatile_or_water_soluble`).<br>• `humectant_only`: none of the above, but at least one humectant above the tail.<br>• `none`: nothing above the tail. |
| Never a mechanism | The L5 rheology exclusions (carbomer, xanthan, guar, cellulose ethers, acrylates crosspolymers such as Acrylates/C10-30 Alkyl Acrylate Crosspolymer; Acrylates Crosspolymer-3 is the one unsettled exception, §2.4); volatile carriers (water, ethanol/IPA, propellants, isododecane, C11–13 isoparaffin, undecane/tridecane); emulsifiers and solubilisers (PEG-x, ceteth/oleth/laureth/steareth, polyglyceryl esters); cationic conditioners (they feed `weight` and the curl-cream co-load instead). |
| Consumer meaning | *How* the product makes its result. Feeds the gel film type, the shine base, the smoothing coating type, the refresher type and real salt vs salt-free (§3). |
| Source | F |
| Decision | Deterministic lexicon membership. The member list lives in `02_evidence_lexicon.v0.2.md` (v0.1 kept as the round-1 version). |
| Counter-signals | A load-bearing member at `tail_index − 1` ⇒ confidence `moderate`. An unsettled member, or a marker that is `none_visible`/`unresolved` ⇒ review. |
| Claim boundary | Claims never add or remove a mechanism. `got2b-styling-paste-istyler-texture-clay` („Clay") ⇒ `fixative_film` (VP/VA r3) + `wax_lipid` (Japan wax r2), with no `particulate`. |
| Confidence | `high`: plausible marker, decisive members clearly above it. `moderate`: boundary-position member, or `none_visible` marker. `low`: INCI source conflict (e.g. `wella-professionals-eimi-flowing-form`, INCI from a non-DE page). |
| Fit consumers | Subtype extras (§3), the D8b flag (§6), the job gate (§2.12), the salt and white-residue cautions (§4). |
| Calibration | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ `natural_film` (Potato Starch r2, unsettled ⇒ review); no synthetic polymer. `wella-eimi-sugar-lift` ⇒ `natural_film` (Hydrolyzed Corn Starch r2) + `fixative_film` (VP/VA r4, PVP r5). `balea-men-pomade-haar-bart-2in1` ⇒ `wax_lipid` (structuring: Petrolatum r2, Microcrystalline Wax r3, Paraffin r4) + `particulate` (Silica r7). `color-wow-dream-coat-supernatural-spray` ⇒ `silicone_coat` (Polysilicone-29 r3; Silicone Quaternium-18 r7 sits below the DMDM Hydantoin r4 marker). **Dry run (70 records):** fixative_film 39 (38 under the lexicon FX-2c condition; see §2.4) · wax_lipid 28 · natural_film 11 · **particulate 11** · silicone_coat 6 · salt 5 · humectant_only 3. *Corrected 2026-10-12 (node recount over the raw INCI):* this line said particulate **10**, because the v0 member list above has no cellulose; the lexicon (v0.1 and v0.2) places Cellulose in PT-1 (a T4 placement), which adds `schwarzkopf-taft-texturspray-aloe-boost` (Cellulose r7, above Parfum r13). The standard's 11 was right; this file was stale. The 11: Balea Volumenpuder Spray, Taft Texturspray Aloe Boost, Living Proof Full Dry Volume, Taft Haarpuder, got2b Powderfull, Balea Haarpuder, Kevin.Murphy Powder Puff, Balea MEN Pomade, NIVEA MEN Styling Cream, Moroccanoil Dry Texture, John Frieda Pushed-up Dry Texture (standard §6.1). |

### 2.4 `hold_route`

| Field | Definition |
|---|---|
| Values | `present` · `absent` · `ambiguous` |
| Consumer meaning | Whether a **fixative-class polymer film** is part of the formula. This is the D6 "real hold" sense (LI L5 / HOLD). It is **not a strength**. |
| Source | F |
| Decision | Deterministic. **Fixative-class list (ruled — PS2 → PH1-6, PH1-16):** the LI L5 list **plus** the four vinyl families LI L5 lacks: VA/Crotonates/Vinyl Neodecanoate, VP/DMAEMA, VCap/VP/DMAEMA and PVM/MA esters. The four families live in the **Styling standard's own list** until the Leave-in addendum after the Styling lock; LI L5 is not changed now (PH1-16).<br>• `present`: at least one fixative-class member above the tail.<br>• `absent`: none. Starch, salt, particles, waxes and silicones never count; Polysilicone-29 alone is HOLD `none` (LI L5 placement). A fixative found only at or below the tail ⇒ `absent` with a `fixative_below_tail` trace note.<br>• `ambiguous`: the only candidate is an unsettled synthetic polymer (Acrylates Crosspolymer-3, Polyacrylamide (LI §17.19), Sodium Polystyrene Sulfonate), or **PQ-11/-16/-46 — and, from v0.2, PQ-69 (R1-T, RG-16) — with no other fixative-class polymer** (PH1-6: hold_route review, not real hold), or a **generic `Acrylates Copolymer` without corroboration** (LI L5 lists acrylates copolymers only when "used as fixatives"; the same INCI name covers rheology modifiers — lexicon FX-2c), or a fixative's above-tail status rests on an `unresolved`/implausible marker ⇒ review. |
| Counter-signals | The L5 rheology exclusion. The LI anionic/cationic pairing check (an identity check only). |
| Claim boundary | Claims never set it. A captured hold level never moves it (LI T7). |
| Confidence | As `result_mechanisms`. |
| Fit consumers | The neutral fact „Enthält Stylingpolymere" (PH1-9), the D6 border reading, gel film type, refresher and shine extras, D8b (§6), the job gate. |
| Calibration | `present`: `schwarzkopf-taft-power-haargel-halt-5` (PVP r3). `absent`: `balea-locken-crunchgel` (Hydrolyzed Corn Starch r3 only ⇒ `natural_film`). `ambiguous`: `alcina-styling-mousse-aerosol` (PQ-11 r5 is its only film former). Trace: `got2b-lockenspray-refresher-curlz` (VCap/VP/DMAEMA r8 behind Parfum r7 ⇒ `absent` under PH1-1). **Dry run:** present 39 · ambiguous 1 · absent 30 (v0 reading). **Under the lexicon FX-2c condition (node, 2026-10-11):** present 38 · ambiguous 2 · absent 30 — `john-frieda-frizz-ease-traumlocken-lockencreme` (generic Acrylates Copolymer r2 in an aqueous HEC/NaOH cream, its only fixative candidate) moves to `ambiguous` + review; its D7 route is owner-named and unchanged. Three of the present records rest only on the four-family extension: `loreal-paris-elnett-haarspray-extra-starker-halt`, `loreal-men-expert-barber-club-styling-pomade`, `schwarzkopf-taft-x-gliss-silky-shine-shine-coat` (§8, PS2). |

### 2.5 `weight`

| Field | Definition |
|---|---|
| Values | `light` · `medium` · `rich` · `unknown`. This is the shared production scale (`CANONICAL_WEIGHTS` in `src/lib/recommendation-engine/contracts.ts`); the research trace uses LI's `low` · `moderate` · `high` (PH1-4). |
| Consumer meaning | The tendency to weigh down or coat. It drives the fine-hair downshift and the buildup note (§4). |
| Source | F |
| Decision | **Ruled — PH1-2 (PS3) and PH1-4:** judged from the ingredients with the **Leave-in WT rule** (LI §7.5), never from product form. v0 reading of that rule for Styling: persistent families above the tail are (a) oils and non-volatile esters; (b) waxes, hydrocarbons, butters, lanolin; (c) fatty alcohols; (d) persistent silicones; (e) polymeric cationic conditioners (non-fixative PQ-x, guar HPTC, Silicone Quaternium-18). Fixatives, natural films, particles, salts, humectants, monomeric quats and volatile carriers are not families (LI WT lists only the cationic-polymer film).<br>• `light` (LI `low`): no persistent family.<br>• `medium` (LI `moderate`): one family, or two or more with no rich member (the multi-family counter-signal is mandatory).<br>• `rich` (LI `high`): two or more families including at least one **rich** member (petrolatum, paraffin, mineral oil, microcrystalline wax, natural waxes, lanolin/lanolin wax, butters, castor/coconut/olive/avocado oil), or an **LGN pair** (a monomeric cationic and a fatty alcohol both above the tail, LI §7.5 `high` row).<br>• `unknown`: incomplete or conflicting INCI.<br>**Ruled — PH2-8:** the exact Leave-in WT rule, including the LGN-pair route to `high`/`rich`; the earlier "anhydrous base with a rich member" route is dropped (§9 item 12). **Ruled — PH2-12:** the rich-member list above (incl. waxes, paraffin, microcrystalline wax, lanolin) is adopted for Styling. |
| Counter-signals | A rich member at `tail_index − 1` ⇒ confidence `moderate`. A weight claim („ohne zu beschweren", „für feines Haar") against `medium`/`rich` ⇒ `weight_claim_conflict` tag + review (LI §10.1.2 parity); the value stays. |
| Claim boundary | Claims never move it. **Format and subtype never set it** (LI G9). |
| Confidence | `high`: plausible marker, families clearly above it. `moderate`: multi-family row, or a boundary member. |
| Fit consumers | `thickness_fit` echo (§4); the reused Leave-in buildup note (§4). |
| Calibration | `schwarzkopf-taft-power-haargel-halt-5` ⇒ light. `balea-professional-styling-cream-traumlocken` ⇒ **rich** (PH2-8): the LGN pair Cetearyl Alcohol r2 + Cetrimonium Chloride r9, both above the Sodium Benzoate r10 marker (families a, c, e: esters r4–r6, Cetearyl Alcohol r2, PQ-37 r8). *Superseded:* the v0 dry run read it `medium` ("no rich member") because it omitted LI's LGN row. `schwarzkopf-taft-styling-balm-locken-halt-3` ⇒ rich (esters r2/r3, PQ-37 r5, Shea r7 = rich at `tail_index − 1` ⇒ `moderate`). `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ medium (Guar HPTC r6), with a weight-claim conflict tag against its pack name „für feines Haar". **Current rule (PH2-8 + PH2-12; node recount over the raw INCI of the 70 Styling records, 2026-10-11):** light 32 · medium 23 · rich 15 (`molding` 10 of 11 rich; `john-frieda-frizz-ease-traumlocken-lockencreme` is the other LGN-pair `rich`). **Historical v0 dry run (2026-10-09, v0 reading: anhydrous route, no LGN row):** light 36 · medium 21 · rich 13 — superseded, kept for the record. |

### 2.6 `alcohol_note` (replaces `drying_alcohol_load`)

| Field | Definition |
|---|---|
| Values | `fires` · `does_not_fire`, with the triggering member and its rank recorded |
| Consumer meaning | **Ruled — PH1-3 (PS4):** the Leave-in alcohol note is reused unchanged: „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben.“ (LI §7.12 EXPO note, §18 string). **A note only, never an exclusion**: no „ohne Alkohol" filter, no ranking penalty. Never "damages hair" (charter §10). |
| Source | F |
| Decision | Deterministic. Members: Alcohol, Alcohol Denat., SD Alcohol (any number), Ethanol, **Isopropyl Alcohol**. Never members: fatty alcohols (cetyl, cetearyl, stearyl, behenyl, myristyl, lauryl, oleyl, arachidyl) and Benzyl Alcohol (preservative/fragrance). Other short-chain solvent alcohols (n-Butyl Alcohol) are recorded as observations.<br>• `fires`: a member among the **first 3** ingredients, counting every declared ingredient, water and propellants included.<br>• `does_not_fire`: otherwise. A member at rank 4 or later is recorded as an observation and triggers nothing. |
| Counter-signals | None move the value. |
| Claim boundary | Free-from claims and retailer filters never override it: `alverde-beach-waves-spray-seaside-balance` is filtered „ohne Alkohol" on dm, but has Alcohol denat. r3 ⇒ `fires`. |
| Confidence | `high` for any complete INCI; `low` on an INCI source conflict. |
| Fit consumers | The alcohol note (§4). Nothing else. |
| Calibration | `john-frieda-volume-lift-ansatz-booster` ⇒ fires (Alcohol Denat. r1). `schwarzkopf-taft-styling-balm-locken-halt-3` ⇒ does not fire (Isopropyl Alcohol r14, recorded). `american-crew-fiber` ⇒ does not fire (Alcohol Denat. r8, recorded). `balea-locken-crunchgel` ⇒ does not fire. **Count (node recount over the raw INCI of the 70 Styling records, 2026-10-11, origin marks `*`/`**` stripped per lexicon §0.4):** fires on **28**; **5** more carry a member at rank 4 or later (Balea Volumenpuder Alcohol denat. r4, American Crew Fiber r8, American Crew Pomade r9, Taft Styling Balm Isopropyl Alcohol r14, Elnett Stylingspray 3 Tage Glatt Isopropyl Alcohol r14); **37** carry none. `alverde-beach-waves-spray-seaside-balance` („Alcohol* denat." r3) fires once the origin mark is stripped. *Superseded:* the 2026-10-09 re-run reported 27 / 5 / 38 and said it superseded the v0 dry run's 28; that re-run missed the starred token, and 28 is correct. |

### 2.7 *(removed: `washability`)*

**Ruled — PH1-4 (PS5):** there is **no** „hard to wash" field. Instead (1) `weight` uses the shared light · medium · rich scale and the Leave-in WT rule (§2.5), and (2) the **Leave-in buildup note** (LI §8.5, Hinweise; §18 copy „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab.") is reused **unchanged, as a note, not a score** (§4). (3) Whether a `rich` Styling product used weekly adds +1 to the Deep-Cleansing reset load is **deferred to the Personal-Plan decision**; today Styling is not an input to it. The washability-specific worked examples (`balea-men-pomade-haar-bart-2in1`, `syoss-professional-performance-max-hold-power-wax`, `american-crew-fiber`) are retired with the field.

### 2.8 `ingredient_flags`

| Field | Definition |
|---|---|
| Values | `silicones` · `oils` · `fragrance` · `salt` · `propellant`, plus `fixative_family[]` ⊂ {`pvp_vp`, `acrylate`, `polyurethane`, `vinyl_acetate`, `pvm_ma`, `natural_film`} |
| Consumer meaning | Presence statements for preference filters (silikonfrei, parfumfrei, „lieber Pumpspray") and for naming the neutral fact („z. B. PVP"). They never predict tolerance (LI L8). |
| Source | F |
| Decision | Deterministic presence on the **full** normalised list, following the existing production pattern (`deriveConditionerIngredientFlags`).<br>• `silicones`: any silicone, including PEG-modified ones and tail members.<br>• `oils`: plant or mineral oil or butter, excluding fragrance oils (peel/leaf/wood oils) and ethoxylated derivatives (PEG-40 Hydrogenated Castor Oil).<br>• `fragrance`: Parfum / Fragrance / Aroma.<br>• `salt`: Maris Sal, Sea Salt, Magnesium Sulfate, **or Sodium Chloride**, anywhere. This matches the consumer meaning of „ohne Salz"; contrast the narrower `salt` mechanism.<br>• `propellant`: Butane, Propane, Isobutane, Dimethyl Ether, Nitrogen.<br>• `fixative_family[]`: the families of the fixative-class and natural-film members above the tail. |
| Counter-signals | None. |
| Claim boundary | Free-from claims never override a flag: `color-wow-dream-coat-supernatural-spray` is filtered „silikonfrei" on Douglas (C3), but Polysilicone-29 r3 ⇒ `silicones`. |
| Confidence | `high` for a complete INCI. |
| Fit consumers | Preference filters, the sensitive-scalp filter, the neutral fact. |
| Calibration | `got2b-styling-puder-volumen-powderfull` ⇒ no flags (Aqua, Silica Silylate, Sodium Benzoate, Citric Acid). `bali-curls-strong-hold-flaxseed-gel` ⇒ `salt` flag (Sodium Chloride r7) but no `salt` mechanism. `balea-ansatzvolumen-booster` ⇒ `fixative_family: [pvm_ma, pvp_vp]`. |

### 2.9 `chaarlie_hold_level`

| Field | Definition |
|---|---|
| Values | `0` Kein Halt · `1` Leichter Halt · `2` Mittlerer Halt · `3` Starker Halt · `4` Sehr starker Halt · `null` = „Halt: keine Herstellerangabe" · `review` (an unranked step on a brand ladder, §5.3). `0` only on an explicit „kein Halt" claim (D8). A C1 vs C2 (pack vs manufacturer page) hold conflict ⇒ `null`, „keine Herstellerangabe", with both claims kept in the trace (PH1-8). |
| Consumer meaning | The manufacturer-stated strength on one ladder: „laut Hersteller: Starker Halt". |
| Source | C: C1/C2 only, including house-brand C2 and `C2_cross_market_verified` (LI §2.4.1 rules 6–7). The record keeps the raw text, the scale as written, the tier, the source and the date. |
| Decision | Deterministic normalisation (§5). **Claim-only: never derived from formula, never borrowed from a similar formula** (D8, LI T7). |
| Counter-signals | D8b flags (§6). They **never change a level**. |
| Claim boundary | This property *is* a claim. C3 chips and C5 pages are traces and never assign. |
| Confidence | `high`: a number on a known scale, or an unambiguous strength word. `moderate`: house-brand C2 (ownership is confirmed in review), a mid-ladder step, or cross-market C2. |
| Fit consumers | The hold-band rank, **only** in `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray` and `molding` (D8). In the other six subtypes it is stored and not used. |
| Calibration | §5.6. Coverage: 34 of 70 records carry a level (1:4 · 2:9 · 3:11 · 4:10), 36 are null. In the hold-relevant subtypes, 30 of 44: gel 3/9 · curl_cream 3/5 · mousse 4/5 · blowdry_lotion 5/8 · hairspray 6/6 · molding 9/11. These are the calibration-file levels (2026-10-09). Round-1 rulings that touch them: R1-Q1 may move `schwarzkopf-taft-styling-balm-locken-halt-3` from 3 to 2 (open on the tier of its „Halt 3", standard §13.2 item 5); `schwarzkopf-taft-gel-wax-glanz-halt-2` already reads 1; `balea-styling-creme-power-flex` stays null (RG-13) until its dm attribute is captured. Re-derived in round 2. |

### 2.10 `flexibility`

| Field | Definition |
|---|---|
| Values | `beweglich` · `fest` · `unbekannt` |
| Consumer meaning | Movable/restylable vs set/stiff. For example, the concept's "flexible hairspray for fine hair" (concept §5.2, row 8). |
| Source | C: C1/C2 text only. |
| Decision | Lexicon. **Ruled — PH1-5 (PS6):** „ohne zu verkleben" is not a flexibility word; brand flex numbers are recorded and the words decide.<br>• `beweglich`: a flexibility word (flexibel, beweglich, elastisch, formbar, neu formbar/nachstylbar, variabel) or a negated rigidity word („ohne zu verhärten", „ohne steif zu wirken").<br>• `fest`: a rigidity word (Kleber, Freeze, betonhart, steif). **„Kleber" is a rigidity word only, never a strength word (RG-14).**<br>• Both ⇒ `unbekannt` + review. Neither ⇒ `unbekannt`.<br>• **Name words count (P-2):** a rigidity or flexibility word in the full confirmed pack name becomes a flexibility claim with `from_product_name: true` (standard §2.2 A3). |
| Counter-signals | None from formula. |
| Claim boundary | Flexibility words are never strength words, and vice versa (§5.5). Brand flex numbers (Alcina Flex-Faktor x/10) are recorded; words decide. |
| Confidence | `high` on an explicit C1/C2 word. |
| Fit consumers | Flexibility preference ranking. |
| Calibration | `nivea-men-styling-cream-active-craft-stylers` ⇒ beweglich (C1 „Flexible Hold", „ohne zu verhärten"). `wella-eimi-sugar-lift` ⇒ beweglich alongside level 3 („starker, dennoch beweglicher Halt"). `schwarzkopf-taft-power-haargel-halt-5` ⇒ unbekannt („ohne zu verkleben" only; PH1-5). `alcina-ansatz-volumen-spray-aerosol` ⇒ unbekannt (Flex-Faktor 6/10 and no word). No C1/C2 `fest` claim existed in the 70-record cohort. Round 1: `got2b-spruehkleber-freeze-haarlack` (unseen; pack „SPRÜH KLEBER Freeze Haarlack") ⇒ `fest` once the name words are captured (P-2). |

### 2.11 `finish`

| Field | Definition |
|---|---|
| Values | `matt` · `natürlich` · `glänzend` · `unbekannt` |
| Consumer meaning | The look: matt, natural or shiny. |
| Source | C: C1/C2 text, including the pack name once confirmed („Matt Wax", „Gel Wax Glanz"). The F sanity check runs afterwards. |
| Decision | Lexicon (**ruled — PH1-5**: „natürlicher Glanz" = `natürlich`; brand shine numbers are recorded and the words decide).<br>• `matt`: matt, mattierend, „kein Glanz".<br>• `glänzend`: Glanz, glänzend, Shine, Gloss, Brillanz, Wet Look.<br>• `natürlich`: „natürliches Finish", „Natural Look", „natürlicher Glanz".<br>Brand shine numbers (Taft Glanzstufe, American Crew Glanzfaktor) are recorded; words decide unless a scale maximum is published. **Unclaimed ⇒ `unbekannt`, never formula-derived.**<br>• **RG-10:** matt + natürlich ⇒ `matt`; glänzend + natürlich ⇒ `natürlich`. „natürlich" is a finish word only with Finish, Look or Glanz next to it; natürlich + a verb or another noun („natürlich gestylt aussehen", „natürlich strukturierter Look", „natürliches Haargefühl") ⇒ `unbekannt`. |
| Counter-signals | The F sanity check (concept §3): `matt` claimed on an oil/silicone-led formula with no particulate, wax or fatty-acid soap, or `glänzend` claimed on a particulate-led dry powder ⇒ `finish_formula_conflict` review. **The value never changes.** |
| Claim boundary | Claims set it; formula only flags it. |
| Confidence | `high` on an explicit C1/C2 word. |
| Fit consumers | Finish preference, asked only when `molding` or `texture_spray` is in play (concept §5.3). |
| Calibration | `schwarzkopf-taft-matt-wax-halt-5` ⇒ matt (C2 „mattes, nicht glänzendes Finish"; consistent with its wax/fatty-acid chassis). `american-crew-pomade` ⇒ glänzend (cross-market C2 „Mittlerer Halt – viel Glanz", Glanzfaktor 9). `schwarzkopf-taft-haarspray-classic-halt-3` ⇒ unbekannt (no finish claim; the calibration set currently says „natürlich", §9 item 4). |

### 2.12 `primary_job` + `secondary_jobs`

| Field | Definition |
|---|---|
| Values | One primary and ≤ 2 secondaries from `definition · volume · texture · sleek · hold_fix · shine · frizz_control · refresh` |
| Consumer meaning | Ties the product to the user's goals (`shape_definition`, `volume_balance`, `manageability_styling`, plus the new `texture`/`sleek` look goals). |
| Source | C: the C1/C2 primary promise and supporting claims. These always exist, because S0 requires a C1/C2 promise. |
| Decision | Structured judgment. Primary = the job the C1/C2 promise leads with. Secondaries = up to two further jobs the C1/C2 claims state explicitly. **Formula compatibility gate** (v0 convention; template §12, "claims cannot override incompatible input evidence"): each job needs one of these:<br>• `hold_fix` ⇒ the §6 hold-mechanism set;<br>• `volume` ⇒ fixative_film / natural_film / particulate / salt;<br>• `texture` ⇒ particulate / salt / structuring wax_lipid / a film;<br>• `sleek` ⇒ silicone_coat / wax_lipid / fixative_film;<br>• `shine` ⇒ wax_lipid / silicone_coat;<br>• `frizz_control` ⇒ silicone_coat / wax_lipid / a film;<br>• `definition` ⇒ any mechanism except humectant_only/none;<br>• `refresh` ⇒ any mechanism.<br>A failing **secondary** is dropped and recorded. A failing **primary** is kept and tagged `job_formula_conflict` ⇒ review.<br>**RG-11:** primary = the first job-bearing phrase of the lead promise (standard §4.2 order); product nouns (Gel, Gelee, Paste, Wachs) and strength phrases are not job-bearing unless nothing else is; shaping/forming ⇒ `hold_fix`.<br>**RG-12:** a C1/C2 hold claim with a strength word ⇒ `hold_fix`; anti-frizz/flyaway ⇒ `frizz_control`; shine ⇒ `shine`; curl definition ⇒ `definition`; in claim order, max two, after the primary; feel and ingredient lines never state a job. |
| Counter-signals | The gate above. |
| Claim boundary | Duration and humidity parts of a claim never make a job; they go to `captured_claims`. |
| Confidence | `high` when the promise names one job; `moderate` when the order of jobs is a judgment. |
| Fit consumers | Goal/problem matching; subtype choice. |
| Calibration | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ volume (C2 „sorgt für mehr Volumen und natürliche Bewegung") + hold_fix (C2 Haltegrad 4). `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` ⇒ sleek + shine + frizz_control (C2 „Glättungsspray für bis zu 100H brillanten Glanz. Anti-Frizz."); the „100H" goes to `captured_claims`. `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` ⇒ sleek. Its C1 „Starker Halt" fails the `hold_fix` gate (silicone_coat only) ⇒ dropped + review, the same product the D8b flag catches (its level 3 stays, PH1-14). |

### 2.13 `application_moment`

| Field | Definition |
|---|---|
| Values | `damp_before_drying` · `before_heat` · `dry_finish` · `dry_restyle` · `second_day` · `unresolved`. The primary value is the lead instruction; other permitted moments go in `also[]`. |
| Consumer meaning | The routine-compiler slot (the anchors `dry_pre_heat`, `heat_tool` and `dry_finish` exist) and the D5 day-2 instruction. |
| Source | U: the verbatim directions, sourced as LI T12 `application_stage`. The directions come from the G1 source hierarchy with their tier recorded. They are **not claim-gated**. |
| Decision | Transcription against anchors:<br>• `damp_before_drying`: wet or towel-dried hair, then any drying (air-dry allowed).<br>• `before_heat`: the directions make a heat step part of the application (blow-dry or iron named as the next step, not optional), or apply to dry hair before a hot tool.<br>• `dry_finish`: applied over the finished style, with no further shaping.<br>• `dry_restyle`: applied to dry hair, then shaped by hand or comb.<br>• `second_day`: the directions lead with refreshing styled hair between washes.<br>**RG-2:** spray-only directions (distance, evenness, optional strands; no moisture state, drying, heat or shaping step) ⇒ `dry_finish`, confidence `moderate`; missing or copied directions stay `unresolved`.<br>**RG-8:** equal alternatives („feucht oder trocken") ⇒ the first-named moment is primary, the others go to `also[]`. |
| Counter-signals | Missing, conflicting or ambiguous directions ⇒ `unresolved` + review (LI G5). The value is never taken from the formula or the name. |
| Claim boundary | None. Marketing copy is not directions. |
| Confidence | `high` on manufacturer/pack directions; `moderate` on retailer-only directions. |
| Fit consumers | Routine slot and order; the D5 refresh instruction. |
| Calibration | `balea-foehnlotion-volume-effect` ⇒ before_heat („vor dem Föhnen … auf trockenem Haar vor Glätteisen"). `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` ⇒ damp_before_drying („Föhnen oder an der Luft trocknen lassen"). `syoss-haarspray-max-hold` ⇒ dry_finish. `got2b-styling-mattpaste-strand-matte` ⇒ dry_restyle. `balea-locken-crunchgel` ⇒ damp_before_drying, also second_day („am Folgetag … auffrischen"). `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` was `unresolved` until its manufacturer directions were captured, then before_heat. |

### 2.14 `target_zone`

| Field | Definition |
|---|---|
| Values | `all` · `roots` · `lengths` · `surface` · `hairline` |
| Consumer meaning | Root lift (absorbs the old root-lift subtype, D1), the edge-control branch (concept §5.2, row 2), and the alcohol + roots caution. |
| Source | U, sourced as §2.13. |
| Decision | Transcription:<br>• `roots`: the directions lead with Ansatz/roots — the Ansatz is the only or the first-named application site, including an either/or that names it (RG-9); a later, optional Ansatz step ⇒ `all`.<br>• `lengths`: mid-lengths and ends only.<br>• `surface`: the outer layer or flyaways of a finished style only.<br>• `hairline`: edges, baby hair, brows.<br>• `all`: whole hair, or „ins Haar" with no zone.<br>No directions ⇒ empty + review; never guessed. |
| Counter-signals | As §2.13. |
| Claim boundary | None. |
| Confidence | As §2.13. |
| Fit consumers | Subtype choice (roots ⇒ blowdry_lotion), edge branch, caution. |
| Calibration | `alcina-ansatz-volumen-spray-aerosol` ⇒ roots („Ansatznah … sprühen"). `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` ⇒ lengths („in die trockenen Haarlängen"). `bali-curls-sleek-stick-brows-and-edges` ⇒ hairline. `gard-haarspray-extrastark-pumpspray` ⇒ all, also roots. No cohort product leads with `surface` yet. |

### 2.15 `heat_activated`

| Field | Definition |
|---|---|
| Values | `yes` · `no` · `unresolved` |
| Consumer meaning | Heat makes or strengthens the result, so the product goes before the heat step. **This is not heat protection**; that is `provides_heat_protection` (§2.17). |
| Source | U (directions). After unblinding, a C1/C2 activation statement may raise `no` to `yes` (§7). |
| Decision | • `yes`: **only when the product's own text says it is heat-activated or that heat makes it work** (R1-Q4) — „hitzeaktiviert", „aktiviert durch Wärme", „Föhnhitze verstärkt den Volumen-Effekt". A directions tip to blow-dry, even „für mehr Volumen", is an `application_moment` step and gives `no` (`balea-styling-spray-ultra-volumen`, `jean-und-len-sea-salt-spray`).<br>• `no`: directions exist and give heat no such role (heat optional or absent).<br>• `unresolved`: no directions, or activation stated only at C3/C5. |
| Counter-signals | None. |
| Claim boundary | Heat-protection claims go to `captured_claims` and are never read here; only §2.17 reads them. |
| Confidence | As §2.13. |
| Fit consumers | Routine order. |
| Calibration | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ yes (directions: „Föhnhitze verstärkt den Volumen-Effekt"). `guhl-foehn-spray-langzeit-volumen` ⇒ yes (C1 „aktiviert durch die Föhnhitze"). `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` ⇒ no. `color-wow-dream-coat-supernatural-spray` ⇒ unresolved („wärmeaktiviertes Polymer" appears only on Douglas, C3). |

### 2.16 `captured_claims`

| Field | Definition |
|---|---|
| Values | A list of `{type: heat · humidity · duration · hair_type · free_from · other, raw (verbatim DE), tier, source, date}` |
| Consumer meaning | **None for selection, ranking or copy.** Humidity follows LI T9. A heat claim acts only through `provides_heat_protection` (§2.17, PH1-15); a temperature („bis 230 °C") is never used. „bis zu 48 h" is never shown. Hair-type claims never set fit. Free-from claims never override flags. |
| Source | C: all tiers are recorded with their tier. |
| Decision | Capture only. |
| Fit consumers | None. Audit and future research only. |
| Calibration | `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`: heat „Hitzeschutz bis zu 230 °C"; humidity/duration „bis zu 72 Stunden gegen Frizz, selbst bei hoher Luftfeuchtigkeit". `guhl-foehn-spray-langzeit-volumen`: duration „48h Halt", which is also why it has no hold level. `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`: hair type „für feines Haar". |

### 2.17 `provides_heat_protection` (new, PH1-15)

| Field | Definition |
|---|---|
| Values | `true` · `false`. The research trace keeps the LI §13.2 state (`not_claimed` / `claim_only` / `formula_plausible` / `product_tested`). |
| Consumer meaning | Whether this Styling product may fill the **Personal-Plan heat-protection step** (e.g. a Föhnspray covering both jobs). It reports what the product is sold as, gated by a formula check; it never grades efficacy (LI §13.3). |
| Source | C + F: a C1/C2 heat-protection claim (LI §2.4.1, incl. `C2_cross_market_verified`) **and** the Leave-in heat check (LI HEAT §7.8, §13): a member of the closed **L9 list** (LI §5 L9) above the tail. |
| Decision | **Ruled — PH1-15**, the same rule as Leave-in:<br>• `true` only when the C1/C2 heat claim exists **and** an L9 member sits above the tail (trace `formula_plausible`).<br>• Otherwise `false`. A C1/C2 claim without the L9 pass is still **shown** („Hitzeschutz laut Hersteller“) but never fills the role. Retailer-only heat text (C3/C4) and C5 pages create no claim (LI §2.4.1).<br>• Generic silicone, generic protein, panthenol and oils never pass the L9 check (LI §13.3). No temperature, grade or percentage is ever used. |
| Counter-signals | The LI L9 tail-member rule: an L9 member at or below the tail earns nothing. |
| Claim boundary | The claim is necessary, never sufficient; the formula never manufactures a claim. |
| Confidence | As LI §13. |
| Fit consumers | The Personal-Plan heat-protection step only. **This amends `docs/personal-plan/categories/heat-protectant/decision.md`** (Styling was excluded from the heat role in V1) and supersedes the concept Rev. 2 line "Styling never fills the heat role"; the decision doc is amended in the Personal-Plan phase. |
| Calibration | Not yet calibrated. Most heat claims in the cohort come without an L9 member, e.g. `balea-foehnlotion-volume-effect` („Mit integriertem Hitzeschutz bis 200°C“) ⇒ `false`, shown as „Hitzeschutz laut Hersteller“ once the claim is confirmed at C1/C2. `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` („Mit Hitzeschutz bis zu 230 °C“) has Hydrolyzed Wheat Protein r12, an L9 member above both marker candidates (Caprylyl Glycol r13, Phenoxyethanol r17). It would read `true` once the claim is confirmed at C1/C2, but its marker is `unresolved` (§9 item 6) ⇒ review, and the LI L9 study-context limitation for hydrolyzed wheat protein applies. **Ruled — PH2-4:** the check reads Styling's own tail marker T_S (the Mask rule), the stricter side. `john-frieda-volume-lift-ansatz-booster` (heat polymer after Parfum) ⇒ `false`, claim still shown. LI `product_tested` without an L9 member stays `false` until ruled (§9 item 13). |

## 3. Subtype extras (only where they discriminate)

Most extras are **views of base properties**, not new fields. Four are new: three subtype fields (`cast_expected`, `conditioning_co_load`, `base`) and one identity label (`form_label`).

| Subtype | Extra | Carried by | Values / rule | Calibration |
|---|---|---|---|---|
| `gel` | film type | view of `hold_route` + `result_mechanisms` | `synthetic` (hold_route present) · `natural` (natural_film, no fixative) · `mixed` | `schwarzkopf-taft-power-haargel-halt-5` synthetic · `balea-locken-crunchgel` natural · `bali-curls-strong-hold-flaxseed-gel` natural (carrageenan, unsettled ⇒ review) |
| `gel` | crunch/cast expected | **new** `cast_expected` (C) | `yes` · `unbekannt`. Yes when C1/C2 text or the confirmed pack name promises a cast („Crunch", „Cast", „knusprig"). Usage guidance (knead out the cast), not strength; „Crunch" = a cast to knead out, never `fest` (PH1-5). | `balea-locken-crunchgel` yes (house-brand name „Crunchgel") |
| `curl_cream` | conditioning co-load | **new** `conditioning_co_load` (F) | `light` · `rich`. An echo of the LI G0 conditioning read used at S0: rich = substantive conditioning architecture (LI COND moderate/high); light = thin or absent. | `balea-professional-styling-cream-traumlocken` rich (D7 band) · `schwarzkopf-taft-styling-balm-locken-halt-3` rich (D7) · `maria-nila-curlicue-cream` light (T15) · `kevin-murphy-killer-curls` light (no cationic) |
| `mousse` | target zone, silicone flag | base §2.14, §2.8 | — | `balea-ansatzvolumen-booster` roots · `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` `silicones` |
| `blowdry_lotion` | target zone, heat_activated | base §2.14, §2.15 | — | `alcina-ansatz-volumen-spray-aerosol` roots · `guhl-foehn-spray-langzeit-volumen` heat yes |
| `smoothing_styler` | coating type | view of `result_mechanisms` | silicone_coat · fixative_film · wax_lipid | `color-wow-dream-coat-supernatural-spray` silicone (Polysilicone-29 r3) · `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` silicone (Dimethicone r2) · `wella-professionals-eimi-flowing-form` polymer (PVP r2) + lipid |
| `hairspray` | aerosol vs pump; flexibility; shine | identity `format`; §2.10; §2.11 | — | `gard-haarspray-extrastark-pumpspray` pump · `schwarzkopf-taft-haarspray-glanz-halt-4` aerosol, glänzend (C2 „Glänzendes Finish") |
| `shine_finish` | base; fixative present | views: `wax_lipid` vs `silicone_coat`; `hold_route` | — | `got2b-gotgloss-glanz-spray` ester base (CCT r4, Dicaprylyl Carbonate r5) · `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` silicone (Phenyl Trimethicone r6) · `balea-professional-glow-und-shine-finishing-spray` fixative (PU-14 r11) |
| `salt_spray` | real salt vs salt-free; alcohol note | view: `salt` mechanism; §2.6 | — | all 5 cohort salt sprays carry real salt; **no salt-free sample yet** · `jean-und-len-sea-salt-spray` alcohol note fires (r2) |
| `texture_spray` | particle type; fixative present | view: `particulate` members; `hold_route` | — | `living-proof-full-dry-volume-texture-spray` borosilicate + zeolite, VP/VA · `balea-pure-styling-volumenpuder-spray` starch powders + silica, no fixative |
| `hair_powder` | particle type; white-residue caution | view; caution in §4 | — | silica silylate in all 4 · `kevin-murphy-powder-puff-volume` adds VP/VA r3 |
| `molding` | form label | **new** identity `form_label` | `wax · paste · clay · fiber · pomade · cream`, from the confirmed pack name. Display only: never routes, never sets an F value. | `got2b-styling-paste-istyler-texture-clay` label „clay", no clay in the formula |
| `molding` | base | **new** `base` (F) | `anhydrous` (no water declared) · `water_based` | `balea-men-pomade-haar-bart-2in1` anhydrous, the only one of 11 |
| `molding` | shine | §2.11 | — | `schwarzkopf-taft-gel-wax-glanz-halt-2` glänzend (C2) |
| `refresher` | humectant-only vs light hold | view: `humectant_only` vs `hold_route: present` | — | `balea-locken-revitalizing-spray` humectant_only · `got2b-lockenspray-refresher-curlz` neither under PH1-1 (fixative in the tail; ester lipid) |

## 4. Derived echo fields (annotations, not reviewed per product)

These follow LI T8 / Mask R9: computed last, shown as annotations, never independently researched. Matching policy owns the final tables (charter §14). The mappings below are drafts; where they read `weight` they use the ruled light · medium · rich scale (PH1-2, PH1-4).

| Field | Draft rule |
|---|---|
| `thickness_fit` | From `weight`: light ⇒ fine · normal · coarse; medium ⇒ normal · coarse, fine ranked lower; rich ⇒ coarse, normal lower, fine last. **A ranking signal only, never an exclusion.** |
| `texture_fit` | `curl_cream`, `refresher` and products with primary `definition` ⇒ wavy · curly · coily. `salt_spray` ⇒ straight · wavy. Everything else ⇒ all. |
| `length_fit` | `molding` ⇒ very short · short (concept §5.2, row 1). Everything else ⇒ all. |
| Hold display | A level ⇒ „laut Hersteller: Starker Halt". Null ⇒ „Halt: keine Herstellerangabe", plus „Enthält Stylingpolymere (z. B. PVP)" when `hold_route = present` (PH1-9). |

**Notes reused from Leave-in (ruled; copy unchanged).**

| Note | Trigger | Copy (LI §18) |
|---|---|---|
| Alcohol note (PH1-3) | `alcohol_note = fires` (§2.6). A note only, never an exclusion. | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben.“ |
| Buildup note (PH1-4, LI §8.5) | LI §8.5 limb 2 as Styling can read it: `weight = rich` (which always has a persistent non-volatile family above the tail). **Limb 1 is reused literally (PH2-5):** permanently charged cationics are read internally from the LI §7.6 persistence enumeration only to feed the note; Styling stores no PERS field (§9 item 14). A note, not a score. | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab.“ |

Whether a `rich` Styling product used weekly adds +1 to the Deep-Cleansing reset load is **deferred to the Personal-Plan decision** (PH1-4).

**Cautions.** Cosmetic and medically adjacent cautions are separate layers (charter §10). The copy below is a draft; final wording belongs to the decision doc.

| Trigger | Layer | Draft copy |
|---|---|---|
| `salt` mechanism + profile bleached or highly damaged | cosmetic | „Bei blondiertem oder stark strapaziertem Haar sparsam verwenden." |
| `particulate` + dry application (`hair_powder`, `texture_spray`) | cosmetic | „Gut einarbeiten – auf dunklem Haar können Reste sichtbar bleiben." The profile has no hair-colour field today, so this is shown to everyone. |
| `molding` with weight `rich` or base `anhydrous`; or `wax_lipid` + `target_zone: hairline` | medically adjacent (pomade acne) | „Nicht direkt am Haaransatz oder auf der Stirn auftragen." |

## 5. Hold normalisation (`chaarlie_hold_level`)

### 5.1 Where hold is used (D8)

| Subtypes | Role of the level |
|---|---|
| `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray`, `molding` | A stated, fitting level ranks first. **No level ⇒ still eligible**, ranked after, shown as „Halt: keine Herstellerangabe". Never excluded. |
| `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler`, `refresher` | Captured and stored; **no part in selection**. Finish, weight and application decide. |

### 5.2 Assignment order

1. **Only C1/C2 counts.** That includes house-brand C2 (dm ↔ Balea/alverde, Rossmann ↔ Isana) and `C2_cross_market_verified`. Retailer copy, retailer filter chips (dm „Halt", Douglas „Haltgrad") and C5 pages are tier-stamped traces and **never assign a level**.
2. **Brand number on a known scale ⇒ table §5.3.** An illegible or self-contradicting number is not used: words decide, confidence `moderate`, review `hold_number_unreadable`, pack queued for re-capture (RG-19). Taft Styling Paste Forming („5+" beside 4 dots) stays here until its pack is re-read (R1-Q1).
3. **The number beats the word** on the same pack or page.
4. **Brand word ladders** (Elnett). A mid-ladder step gets confidence `moderate`.
5. **Strength words ⇒ lexicon §5.4.** Look and flexibility words are not strength words (§5.5).
6. **No strength claim ⇒ `null`** („keine Herstellerangabe"). Never `0` (D8), never derived from formula, never borrowed from a similar formula (Balea Haarpuder keeps its own „starker Halt"). The gap is queued for pack-photo fill.
7. **C1 vs C2 (pack vs manufacturer page) conflict ⇒ `null`, „Halt: keine Herstellerangabe"** (PH1-8). Both claims stay in the trace with a review note.

### 5.3 Normalisation tables (brand × format)

These match `TABLES` in `build-calibration-r2.js`. The tables grow per brand.

| Brand scale (formats) | ⇒ 1 | ⇒ 2 | ⇒ 3 | ⇒ 4 | Note |
|---|---|---|---|---|---|
| Henkel Haltegrad x/5 — Taft, Syoss, got2b: **every Henkel leave-on format except Taft gels** (R1-Q1: incl. pastes, waxes, balms) | 1–2 | 3 | 4 | 5 / 5+ („5+" = 5) | Numbers are shared across Henkel brands; the number wins over inflated words (Syoss calls 3 „starker Halt"). |
| Wellaflex dots x/5; Maria Nila x/5 | 1–2 | 3 | 4 | 5 / 5+ | |
| Printed 1–6 — NIVEA MEN, Gard, Taft 6 | 1–2 | 3 | 4 | 5–6 | |
| Alcina Hold-Faktor x/10 | 1–2 | 3–5 | 6–7 | 8–10 | The Flex-Faktor is recorded separately (§2.10). |
| Taft **gels** (scale 4–14, no legend) | — | — | — | — | The number is not comparable. Words only („maximal" ⇒ 4); no word ⇒ `null`. |
| Elnett word ladder | — | Normal | Stark | Extra stark | „Sehr stark" is unranked ⇒ `review`. |
| Wella EIMI Haltegrad; American Crew Haltfaktor (no maximum stated) | — | — | — | — | Words decide. |

### 5.4 Strength-word lexicon

| Words | Level |
|---|---|
| leicht, sanft, soft, weich | 1 |
| mittel, normal | 2 |
| stark | 3 |
| sehr / extra / ultra / mega / extrem stark, maximal, Max, Power | 4 |

„Kleber" was removed from this list (RG-14): it is a rigidity word only (§2.10). **Name words (RG-13):** a strength word in the product name counts only when it qualifies hold or the product as a whole (Taft POWER Haargel, „Extra Hold", „Max Hold"), never when it qualifies another result noun („Ultra Volumen", „Power Flex").

„Power" is in concept §4 and in the build-script `TABLES` word list (standard §7.4). *Superseded:* the earlier note that it was missing from the build script and needed aligning in Phase 3 — it has since been added; no task remains.

### 5.5 Not strength (⇒ `null` when nothing else is stated)

- **Flexibility words:** flexibel, elastisch, beweglich, variabel. These feed §2.10.
- **Look words:** natürlich, natürlich aussehend.
- **Unquantified words:** langanhaltend, perfekt.
- **Duration:** „bis zu 48 h". This goes to `captured_claims`.

### 5.6 Worked examples (all verified against `calibration-set-r2.json`)

| `sample_id` | Claim (tier) | Rule | Level |
|---|---|---|---|
| `schwarzkopf-taft-haarspray-glanz-halt-4` | Haltegrad 4 (C2); dm „Ultra starker Halt" (C3) | number beats word; chip is a trace | 3 |
| `syoss-schaumfestiger-volume` | „extra starken Halt (Haltegrad 4)" (C2) | number beats word | 3 |
| `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` | 3 of 5 dots; name „Starker Halt" (C1) | number beats word | 2 |
| `alcina-ansatz-volumen-spray-aerosol` | Hold-Faktor 6/10 (C2) | Alcina table | 3 |
| `nivea-men-styling-cream-active-craft-stylers` | 4 on printed 1–6 (C1) | x/6 table | 3 |
| `schwarzkopf-taft-power-haargel-halt-5` | „maximalen Halt von Taft" (C2) | gel number not comparable ⇒ word | 4 |
| `wella-eimi-sugar-lift` | Haltegrad 3, no maximum; „starker, dennoch beweglicher Halt" (C2) | words; flexibility separate | 3 |
| `wella-professionals-eimi-flowing-form` | Haltegrad 2, no maximum; „leichter, flexibler Halt" (C2) | words | 1 |
| `loreal-paris-elnett-haarspray-extra-starker-halt` | „Extra Starker Halt" (C1) | Elnett ladder | 4 |
| `got2b-styling-paste-istyler-texture-clay` | „ultra krassem Halt" (C2) | „ultra" ⇒ 4 | 4 |
| `american-crew-pomade` | „Mittlerer Halt" (C2 cross-market; Haltfaktor 7) | words | 2 |
| `balea-styling-spray-ultra-volumen` | dm attribute „sehr starker Halt" (house-brand C2) | house-brand rule; „Ultra" in the name qualifies „Volumen" and is never a hold claim (RG-13). Round 1's packet lacked the attribute, so it is re-captured (P-1) | 4 |
| `guhl-foehn-spray-langzeit-volumen` | „48h Halt" (C1) | duration only | null |
| `got2b-styling-puder-volumen-powderfull` | „natürlichem Halt" (C2) | look word | null |
| `loreal-men-expert-barber-club-styling-pomade` | „perfekten Halt" (C2); Douglas „starker Halt" (C3) | no strength; chip is a trace | null |
| `american-crew-fiber` | Haltfaktor 9 (C3 only) | C3 never assigns | null |
| `syoss-curl-cream-gel-3in1` | „hold 5" only on syoss.net (C5) | C5 never assigns | null |

## 6. D8b plausibility flag and neutral fact (pins charter §13, item 2)

**Hold-mechanism set** (the flag's "hold mechanism above the tail"): `hold_route` is `present` or `ambiguous`, **or** `result_mechanisms` contains `natural_film`, `particulate` or `salt`, **or** `wax_lipid` with at least one `structuring` member. Non-structuring oils, butters and esters, silicone coats and humectants are not hold mechanisms. Concept §3.1's broad `hold_route` is therefore retired, and its breadth lives here.

**Which claims the flag reads.** C1/C2 claims, plus hold words in the product name at any tier, because a confirmed pack name is a C1 claim (round-2 brief). **Never retailer filter chips.** This follows T7 and the D8b wording ("today this catches Cantu", whose „Extra Hold" is its product name).

**Flag (internal; never changes a level):**
1. A strength of ≥ „stark" claimed, or any hold claim on a `shine_finish`, `smoothing_styler` or `refresher` product, with **no** member of the hold-mechanism set ⇒ `claim_formula_conflict` review.
2. Same brand + identical INCI + different stated level ⇒ `d8b_identical_inci_sibling`: verify against the pack.

**Dry-run hits:**
- `cantu-shea-butter-extra-hold-edge-stay-gel`: name „Extra Hold"; only Shea r7 (non-structuring lipid). No level (C3).
- `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`: C1 „Starker Halt"; silicone_coat only. Level 3 kept, flag carried (PH1-14).
- Sibling rule: `schwarzkopf-taft-haarspray-classic-halt-3` (2) vs `schwarzkopf-taft-haarspray-glanz-halt-4` (3), with character-identical INCI.
- No flag for `color-wow-dream-coat-supernatural-spray` or `bumble-and-bumble-brilliantine`: they only have retailer chips.

**Neutral fact.** „Enthält Stylingpolymere (z. B. ‹first fixative-class member›)" is shown iff the level is `null` **and** `hold_route = present` (PH1-9 trigger, with the §2.4 fixative-class list). Dry run: 9 hold-relevant products qualified under the v0 reading; **8 under the lexicon FX-2c condition** (`john-frieda-frizz-ease-traumlocken-lockencreme` drops out: `hold_route: ambiguous`; standard §7.6), e.g. `balea-haargel-hair-jelly` (PVP r6) and `john-frieda-volume-lift-ansatz-booster` (PVP r3). Natural-film-only products with no level (`balea-locken-crunchgel`, `guhl-foehn-spray-langzeit-volumen`, `langhaarmaedchen-lockenspray-halt-sprungkraft`) show „Halt: keine Herstellerangabe" alone. D8b ruled only the polymer sentence; whether a „pflanzliche Filmbildner" variant is wanted stays open (`round2/hold-research-ingredients.md` §3.3) and is not proposed here.

**Comparability.** Levels compare only within a hold family: film (gel, curl_cream, mousse, blowdry_lotion, hairspray, salt and texture sprays), molding, or powder. The app never compares hold across families.

## 7. Blind classification packet (Phase 4)

This mirrors Mask §13 and LI §19.3: capture is kept separate from classification, two sealed blind lanes run, and the reference key is never shown to them.

**Two sealed packets per product (ruled — PH2-6; standard §10.2).** Both are frozen and hashed before unblinding.

1. **S0 packet (separate, sealed).** The normalised complete INCI with ranks, capture tier and date; identity `format`; the verbatim directions; the **confirmed product name**; the **C1/C2 promise and heat-protection claims with their tiers**. It **removes** prior routes and subtypes, hold levels, finish and flexibility words, retailer chips, prior calibration labels and price. **Each lane runs S0 itself from this packet** — promise class, Leave-in function tag, pair rule, D6/D7 readings, `route`, `boundary_reason` and (lean) `styling_subtype`. **No lane receives an existing S0 output** (no reference key, no calibration-file route, no other lane's route).
2. **F/U packet (sealed).** The normalised complete INCI with ranks, capture tier and date; identity `format`; the verbatim directions with brand, product name and strength/look adjectives replaced by `[CLAIM]`; and **the lane's own S0 output** from step 1. It **removes** brand, product name, all `claims[]`, retailer chips, prior calibration labels and price.

*Superseded (Phase 1 text):* a single packet that carried "the S0 outputs `route` and `styling_subtype` (just as the Mask packet carries the category)" — i.e. pre-computed S0 outputs handed to the lanes. PH2-6 replaced it: lanes never receive S0 outputs; each derives its own.

**Cohort independence.** The cohort must be disjoint from the products named as worked examples in this file. Any named product that is reused is reported as confirmation-grade only. This is the Mask round-1 lesson: blind independence broke on standard-named products.

| Classified by | Properties |
|---|---|
| **Two blind lanes (F + U), from the sealed F/U packet plus each lane's own S0 output** | `result_mechanisms` (with members, ranks and marker), `hold_route`, `weight`, `alcohol_note`, `ingredient_flags`, the L9-above-tail half of `provides_heat_protection`, molding `base`, curl-cream `conditioning_co_load`, `application_moment`, `target_zone`, `heat_activated` (directions half) |
| **Two blind lanes (S0), from the sealed S0 packet (PH2-6)** | promise class, `li_function`, pair rule, D6/D7 readings, `route`, `boundary_reason`, lean `styling_subtype`. Promise classification is part of each lane's own S0 run; it is **not** taken from claim capture or from any existing S0 output |
| **Authoritative claim capture (C; not blind; F-lane pattern of round 2)** | `chaarlie_hold_level` (raw, scale, tier, normalisation basis), `flexibility`, `finish`, `primary_job`/`secondary_jobs`, gel `cast_expected`, molding `form_label`, `captured_claims`, C1/C2 heat-activation statements, the C1/C2 heat-protection claim (claim half of `provides_heat_protection`) |
| **Derived last (D)** | `thickness_fit`, `texture_fit`, `length_fit`, the alcohol and buildup notes, cautions, hold display, neutral fact, `provides_heat_protection` (claim half AND L9 half) |

**Permitted crossings after unblinding (the complete list):**
1. A C1/C2 heat-activation statement may raise `heat_activated` from `no` to `yes`.
2. The job gate may drop an unsupported secondary job and tag a primary.
3. The D8b flag, the finish sanity check and the weight-claim conflict tag fire as review notes; **none moves a value**.

Every blind-to-final change is recorded with its reason.

**Agreement.**
- Report exact agreement per property.
- Deterministic F properties must reach **100 %**; any disagreement is a lexicon defect, fixed in the lexicon, never per product.
- U properties report agreement with coded causes (source ambiguity, rule ambiguity, legitimate uncertainty).
- Two independent claim normalisations must give identical levels (PH1-11, charter §15 P1 criterion c).

## 8. Phase 1 rulings on PS1–PS6 (2026-10-09)

Nick ruled the six former proposals in the PH1 bundle ("for now"). Where a ruling differs from the proposal, the ruling is encoded and the difference is stated.

| ID | Proposal (short) | Ruling | Encoded in |
|---|---|---|---|
| **PS1** | Tail marker: LI's preservative list (A) or Mask's `tail_index` (B) | **PH1-1 — B**, for Styling's own properties: "the first preservative or perfume, whichever comes first" (Mask rule). The LI G0 border check keeps its own rule. Evidence: under A, 14 of the 70 records had no readable marker; under B, 1 of 70 (`balea-pure-styling-volumenpuder-spray`). | §0 |
| **PS2** | Fixative-class list: (a) four vinyl families missing from LI L5; (b) PQ-11/-16/-46 alone | (a) **Adopted into the Styling list now. Not added to LI L5 now:** PH1-16 replaces the proposal's "add them to LI L5 in the D6/D7 overlay". The Leave-in addendum written right after the Styling lock carries them. Without (a), `loreal-paris-elnett-haarspray-extra-starker-halt` (VA/Crotonates only, r3) would read as "no styling polymer". (b) **PH1-6:** PQ-11/-16/-46 with no other fixative-class polymer ⇒ hold_route review, not real hold (`alcina-styling-mousse-aerosol`, PQ-11 only, gets no „Stylingpolymere" fact until reviewed). | §2.4 |
| **PS3** | Weight anchors from LI's weight rule; form never decides | **PH1-2:** judged from the ingredients the way Leave-in does it, never from product form. **PH1-4:** the shared production scale light · medium · rich (`CANONICAL_WEIGHTS`; research `low/moderate/high`) via the LI WT rule; the proposal's `heavy` is renamed `rich`. | §2.5, §4 |
| **PS4** | Alcohol load `high` / `present` / `none` | **PH1-3 — differs from the proposal:** no three-level load. The Leave-in alcohol note is reused („Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben.“), triggered by Alcohol / Alcohol Denat. / SD Alcohol / Ethanol / Isopropyl Alcohol among the first 3 ingredients. Fatty alcohols and benzyl alcohol never count. A note only, never an exclusion: the `present` level, the „ohne Alkohol" preference filter and the separate alcohol + roots caution are dropped. | §2.6, §4 |
| **PS5** | „Schwer auswaschbar" field | **PH1-4 — differs from the proposal:** no new field. `weight` on the shared scale; the Leave-in buildup note (LI §8.5, „Bleibt lange im Haar …") reused unchanged as a note, not a score. Whether a `rich` Styling product used weekly adds +1 to the Deep-Cleansing reset load is **deferred to the Personal-Plan decision**. | §2.7, §4 |
| **PS6** | Look-word lexicon | **PH1-5:** „ohne zu verkleben" is not a flexibility word; „Crunch" = a cast to knead out (`cast_expected`, never `fest`); „natürlicher Glanz" = `natürlich` finish; brand flex/shine numbers are recorded and the words decide. Consequence: `bali-curls-strong-hold-flaxseed-gel` („schenkt natürlichen Glanz") is `natürlich`, not the `glänzend` the calibration set shows today. | §2.10, §2.11, §3 |

Two further Phase 1 rulings act on this file: **PH1-15** adds `provides_heat_protection` (§2.17), and **PH1-14** keeps Elnett Stylingspray „3 Tage Glatt" in Styling `smoothing_styler` at level 3 with the D8b flag (§2.1, §6).

## 9. Conflicts, gaps and open items

1. **`hold_route` breadth — resolved.** Concept §3.1 (3b) counts natural film, wax, particulate and salt as a hold route. The D6 clarification and the ruled property set say fixative-class only. The broad sense lives in `result_mechanisms` and the §6 hold-mechanism set. Concept 3b's "ambiguous" cases (carrageenan/gellan gels, unmodified-starch products) surface as `natural_film_unsettled` review notes.
2. **Weight from form — resolved (PH1-2).** Concept §3 reads weight from "form + non-volatile load"; the ruling and LI G9 forbid form setting weight.
3. **Flexibility words — resolved (PH1-5).** Concept §3 lists „ohne zu verkleben" as a flexibility word; the ruling says it is not.
4. **Calibration data drift (open, data).** In `calibration-set-r2.json`, `proposed_finish` is not tier-gated: `schwarzkopf-taft-haarspray-classic-halt-3` reads „natürlich" from a "no finish claim" note, and `bali-curls-strong-hold-flaxseed-gel` still reads `glänzend` (PH1-5 says `natürlich`). The round-1 lane labels for `application_moment` predate the §2.13 anchors and are inconsistent: `alcina-foehn-lotion` is `damp_before_drying` while `balea-foehnlotion-volume-effect` is `before_heat`, although both directions say "spray into damp hair, then blow-dry". The border outcomes of PH1-10 and PH1-13 (charter §3) are not applied either. Re-label in the blind round; do not hand-edit frozen records.
5. **D8b reach.** The ruling says "today this catches Cantu". Under these rules it also catches Elnett Stylingspray 3 Tage Glatt, which concept §4 already lists and PH1-14 confirms. Not a contradiction; recorded so the count is not a surprise.
6. **Marker edge (open, product review).** `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` lists the booster Caprylyl Glycol (r13) above its preservative Phenoxyethanol (r17). Under PH1-1, Mask's booster limb makes that marker `unresolved` ⇒ review. Polysilicone-29 (r15) is not credited until a reviewer decides. PH2-1 routes this product to Leave-in (smoothing promise overlaps LI §2.1), so the Styling marker question is informational only.
7. **Untested values.** The cohort has no salt-free salt spray, no `target_zone: surface` product and no C1/C2 `fest` claim, and `provides_heat_protection` has not been run over the cohort. These values are ruled but uncalibrated.
8. **No hair-colour field** in the profile, so the white-residue caution cannot target dark hair.
9. **Lexicon edge.** Acrylates Crosspolymer-3 (`bali-curls-sleek-stick-brows-and-edges`, r2) is marketed as a film former, while the L5 rheology exclusion names acrylates crosspolymers. v0 treats it as unsettled (§2.4). It moves nothing today, because PVP r3 is present.
10. **S0 promise check for Elnett 3 Tage Glatt — resolved (PH1-14).** Its frozen C2 promise leads with heat protection, but the pack front leads with the styling result („Hitze Styling-Spray, glatt 3 Tage, starker Halt"), so it is Styling `smoothing_styler`.
11. **Resolved — PH2-9 (tail-marker wording, PH1-1).** The full Mask rule applies (preservative, perfume, declared allergens/aroma chemicals, boosters in a pair, chelators), as approved under PH1-1. Original note: The ledger's short form names only "the first preservative or perfume", while Mask's `tail_index` (which the ruling cites as "Mask rule") also counts declared allergens, boosters in a pair and chelators. This file follows the full Mask rule. The two readings differed on `loreal-paris-elnett-haarspray-extra-starker-halt` (allergen Hydroxycitronellal r4) and on item 6 (booster Caprylyl Glycol r13). Confirmed by PH2-9.
12. **Resolved in part — PH2-8 (weight reading vs LI §7.5; PH1-2, PH1-4).** PH2-8: weight = the exact Leave-in WT rule, including the LGN-pair route to `high`/`rich`; no extra anhydrous route (points (a) and (c) below are settled; two curl creams move to `rich`). Point (b), the rich-member list, is **ruled by PH2-12** (waxes, paraffin, microcrystalline wax, lanolin count as rich for Styling). Original note: Three points of the v0 reading in §2.5 go beyond LI §7.5's literal text: (a) the "anhydrous base with a rich member" route to `rich`; (b) the rich-member list adds paraffin, microcrystalline wax, natural waxes and lanolin to LI's L3 rich band (coconut/olive/castor/avocado oil, shea/mango/cocoa butter, petrolatum, heavy mineral oil); (c) LI's LGN-pair route to `high` is not listed. The dry-run counts in §2.5 use the v0 reading. To settle in the Phase-3 lexicon or by a ruling.
13. **Resolved in part — PH2-4 (heat check details, PH1-15).** (a) is ruled: the check reads Styling's own T_S (the Mask rule). (b) follows PH1-15's explicit text (claim **and** L9 pass). **Still open:** (c), LI `product_tested` without an L9 member stays `false` until ruled. Original note: (a) Which tail marker the L9 check reads: LI's (the ruling says "the same rule as Leave-in") or the PH1-1 Mask marker used for Styling's own properties. (b) LI §13.3 sets `true` on a C1/C2 claim alone (trace `claim_only`, review); PH1-15 makes `true` require the L9 pass. This file follows PH1-15's explicit text. (c) PH1-15 does not address LI's `product_tested` state (claim + exact-product test, no L9 member).
14. **Resolved — PH2-5 (buildup-note limb 1, PH1-4).** Limb 1 is reused literally, read internally from the LI §7.6 persistence enumeration only to feed the note; Styling still stores no PERS field. Original note: LI §8.5 fires on either `weight_potential: high` with a persistent family (limb 2, readable here as `weight = rich`) or PERS `permanent_cationic` (limb 1). Styling does not compute PERS, so limb 1 cannot fire as written.
15. **Resolved — PH2-11 (housekeeping): „ausbürstbar" stays a v0 convention, not a flexibility word.** PS6 also listed „ausbürstbar" as not a flexibility word; PH1-5 does not name it. It stays a v0 convention (confirmed by PH2-11).
16. **Round 1 — particulate count corrected (2026-10-12).** §2.3 said 10, the standard 11. Node recount over the raw INCI of the 70 records: **11**, the extra record being `schwarzkopf-taft-texturspray-aloe-boost` (Cellulose r7), which this file's v0 member list missed and the lexicon's PT-1 includes. This file was wrong; both now read 11.
17. **Round 1 — R1-Q1, R1-Q2, R1-Q3, R1-Q4 encoded** in §5.3, §2.2, the standard §4.2 and §2.15. R1-Q3 (care + curl definition ⇒ `mixed`, whatever the name) acts on `route` (§2.1 counter-signals: a `mixed` promise ⇒ `provisional_boundary`); PH1-12 still runs first.
18. **Round 1 — RG-16 (lexicon v0.2):** PQ-69 joins PQ-11/-16/-46 for `hold_route: ambiguous` (§2.4); Malic Acid is a PH-1 yardstick; Polysilicone-9 is SI-4 (no `silicone_coat`, no care). Whether Polysilicone-9 (CosIng: hair fixing) should make `hold_route` ambiguous is **open** (standard §13.2 item 3).
19. **Round 1 — packet rules (P-2, P-4, P-6):** name-derived flexibility words are flexibility claims (`from_product_name: true`); the house-brand stamp follows standard §2.2 A5; editor annotations are never claim text. The data re-captures themselves (P-1…P-8) are outside this file.
20. **Open after round 1:** see standard §13.2 (lead-promise name step vs PH1-14; R1-Q3 vs the „Pflegecreme" adjective clause; Polysilicone-9 and FX-U; RG-20 untested values — salt-free salt spray, `surface` zone and others remain uncalibrated, item 7 above; the tier of Taft Balm „Halt 3").
