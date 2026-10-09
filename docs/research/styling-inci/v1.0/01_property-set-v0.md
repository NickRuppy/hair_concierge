# Styling v1.0 property set (v0 — Phase 2, pre-calibration)

Status: **draft for Nick's review, 2026-10-09 — not ruled, not locked.** It formalises the property set presented to Nick on 2026-10-09 and adds no property beyond it. Six choices are marked **Proposal — needs Nick's ruling** and collected in §8 (PS1–PS6). Everything else either encodes a ruling or is a mechanical v0 convention that the Phase-3 lexicon and Phase-4 calibration may adjust ("first set, then adjust", as in Mask).
Charter: `00_category_charter.md` (its proposals are cited as charter P1–P4). Governing order: `plans/styling-concept/02-rulings.md` (SD1–SD5, D1–D8b) > charter > `plans/styling-concept/01-styling-concept.md` Rev. 2.
Inherited method: Leave-In Standard v1.0 (cited "LI §x"); Mask Standard (cited "Mask §x").
Evidence: `data/research/styling-inci/concept-v0/calibration-set-r2.json` (70 Styling records) with the raw INCI, claims and directions in `samples/*.json` and `round2/`. Every example names a real `sample_id`, re-read from the raw record on 2026-10-09. Counts marked **dry run** come from one scratch pass of the v0 rules over the 70 records. That pass is not committed; Phase 3 reproduces it under the versioned lexicon.
Stop condition: research artifact only (charter §16). No catalog, Supabase, intake or matcher change.

## 0. Conventions for every property

| Topic | Rule |
|---|---|
| Source kinds | **R** routing (S0 output) · **F** formula-blind (frozen INCI only) · **U** usage (frozen directions transcription) · **C** claim (C1/C2 only, LI §2.4.1) · **D** derived echo. |
| Evidence level | LI §3.1 ladder: identity facts and directions transcriptions are E1; any value read from the formula is E2; claims are E0 (charter §11). |
| Tail marker | "Above the tail" means strictly before the marker. The marker convention is **PS1**. A load-bearing member at `tail_index − 1` still counts, but caps confidence at `moderate` (Mask E1). The plausibility tests (LI T16/T17, Mask E2) apply, with "establishing species" = the members that establish `result_mechanisms` and `weight`. Example: `loreal-paris-elnett-haarspray-extra-starker-halt` has Hydroxycitronellal r4 as its first tail-class member while Parfum is r28. Under Mask E2 that marker is `unresolved` ⇒ review. No value moves, because the fixative sits at r3 either way. |
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
| 5 | `weight` | light · medium · heavy · unknown | F | structured judgment (PS3) | thickness fit |
| 6 | `drying_alcohol_load` | high · present · none | F | deterministic (PS4) | scalp caution, preference filter |
| 7 | `washability` | normal · hard_to_wash | F | deterministic (PS5) | clarifying hint |
| 8 | `ingredient_flags` | silicones · oils · fragrance · salt · propellant + `fixative_family[]` | F | deterministic presence | filters, neutral fact |
| 9 | `chaarlie_hold_level` | 0–4 · null („keine Herstellerangabe") · `review` | C | deterministic normalisation (§5) | hold band ranking in 6 subtypes |
| 10 | `flexibility` | beweglich · fest · unbekannt | C | lexicon (PS6) | flexibility preference |
| 11 | `finish` | matt · natürlich · glänzend · unbekannt | C + F sanity | lexicon (PS6) | finish preference |
| 12 | `primary_job` + `secondary_jobs` (≤ 2) | definition · volume · texture · sleek · hold_fix · shine · frizz_control · refresh | C + F gate | structured judgment | goal/problem matching |
| 13 | `application_moment` | damp_before_drying · before_heat · dry_finish · dry_restyle · second_day · unresolved | U | transcription with anchors | routine compiler slot |
| 14 | `target_zone` | all · roots · lengths · surface · hairline | U | transcription with anchors | root lift, edge branch, caution |
| 15 | `heat_activated` | yes · no · unresolved | U (+ C raise) | transcription | routine order |
| 16 | `captured_claims` | typed verbatim list | C | capture only | **nothing**: never selection |

Subtype extras are in §3 and derived echo fields in §4.

## 2. Base properties

### 2.1 `route`

| Field | Definition |
|---|---|
| Values | `styling` · `leave_in` · `oil` · `heat_protectant` · `dry_shampoo` · `provisional_boundary` |
| Consumer meaning | Which engine profiles the product. Only `styling` receives the rest of this set. |
| Source | R: the S0 gate (charter §5) reads the C1/C2 promise class, the directions and the LI G0 formula halves. Not blind. |
| Decision | Ordered gates. LI G0 is a structured judgment; D2 and D7 are the only name rules. |
| Counter-signals | A missing input, a C1/C2 conflict, a `mixed` promise, or a same-market formula conflict (LI T18) ⇒ `provisional_boundary`; the product stays in its current category. |
| Claim boundary | The promise picks the boundary. Names route only under D2 („Öl"/„Serum" ⇒ Oil) and D7 (middle band). |
| Confidence | Inherited from LI G0. |
| Fit consumers | Category assignment. The Stage-5 role comes via the subtype family. |
| Calibration | `maria-nila-curlicue-cream` ⇒ styling (T15 `excluded_styling_first`, PVP r4). `neqi-diamond-glass-ultimate-styling-spray` ⇒ leave_in (T15 `incidental_film`, D3). `balea-locken-revitalizing-spray` ⇒ styling (D6). `bali-curls-leave-in-spray-curl-defining` ⇒ provisional_boundary (two INCIs under one GTIN). |

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
| Calibration | `color-wow-dream-coat-supernatural-spray` ⇒ `smoothing_styler` (damp, before blow-drying; not „Öl"/„Serum"). `langhaarmaedchen-lockenspray-halt-sprungkraft` ⇒ `gel` (liquid curl-hold spray, spray-gel format). `bali-curls-sleek-stick-brows-and-edges` ⇒ `gel` with `target_zone: hairline` (D1). |

### 2.3 `result_mechanisms`

| Field | Definition |
|---|---|
| Values | A set of 1–n values, each carrying its members `[{inci, rank}]`:<br>• `fixative_film`: a fixative-class polymer (PS2 list) above the tail.<br>• `natural_film`: hydrolysed or modified starch (Hydrolyzed Corn Starch, Hydroxypropyl Starch, Distarch Phosphate), chitosan, gum arabic/Acacia Senegal gum, in a water-based formula. **Unsettled members** (carrageenan, gellan, unmodified potato/corn/tapioca starch, flax extract) are credited with a `natural_film_unsettled` review note. This is where concept §3.1's "ambiguous" gel/starch cases now live (§9 item 1).<br>• `wax_lipid`: a non-volatile lipid system: waxes, hydrocarbons (petrolatum, paraffin, mineral oil, microcrystalline wax), butters, plant oils, non-volatile esters, lanolin, and fatty acids (stearic/palmitic as soap structure). Members are tagged `structuring` when they are a wax, a solid hydrocarbon, tribehenin or a fatty acid (used by §6).<br>• `particulate`: silica / silica silylate, kaolin and other clays, zeolite, calcium sodium borosilicate, nylon-12, and starch powders in an anhydrous formula.<br>• `salt`: Maris Sal, Sea Salt or Magnesium Sulfate. **Sodium Chloride is excluded** as a rheology/process salt, mirroring the L5 rheology exclusion.<br>• `silicone_coat`: persistent silicones (Dimethicone, Dimethiconol, Amodimethicone, Phenyl Trimethicone, Polysilicone-29, Silicone Quaternium-18, Trimethylsiloxyphenyl Dimethicone). PEG/PPG-modified silicones are excluded (LI §7.6 `volatile_or_water_soluble`).<br>• `humectant_only`: none of the above, but at least one humectant above the tail.<br>• `none`: nothing above the tail. |
| Never a mechanism | The L5 rheology exclusions (carbomer, xanthan, guar, cellulose ethers, acrylates crosspolymers such as Acrylates/C10-30 Alkyl Acrylate Crosspolymer; Acrylates Crosspolymer-3 is the one unsettled exception, §2.4); volatile carriers (water, ethanol/IPA, propellants, isododecane, C11–13 isoparaffin, undecane/tridecane); emulsifiers and solubilisers (PEG-x, ceteth/oleth/laureth/steareth, polyglyceryl esters); cationic conditioners (they feed `weight` and the curl-cream co-load instead). |
| Consumer meaning | *How* the product makes its result. Feeds the gel film type, the shine base, the smoothing coating type, the refresher type and real salt vs salt-free (§3). |
| Source | F |
| Decision | Deterministic lexicon membership. The member list lives in Phase-3 `02_evidence_lexicon.v0.1.md`. |
| Counter-signals | A load-bearing member at `tail_index − 1` ⇒ confidence `moderate`. An unsettled member, or a marker that is `none_visible`/`unresolved` ⇒ review. |
| Claim boundary | Claims never add or remove a mechanism. `got2b-styling-paste-istyler-texture-clay` („Clay") ⇒ `fixative_film` (VP/VA r3) + `wax_lipid` (Japan wax r2), with no `particulate`. |
| Confidence | `high`: plausible marker, decisive members clearly above it. `moderate`: boundary-position member, or `none_visible` marker. `low`: INCI source conflict (e.g. `wella-professionals-eimi-flowing-form`, INCI from a non-DE page). |
| Fit consumers | Subtype extras (§3), the D8b flag (§6), the job gate (§2.12), the salt and white-residue cautions (§4). |
| Calibration | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ `natural_film` (Potato Starch r2, unsettled ⇒ review); no synthetic polymer. `wella-eimi-sugar-lift` ⇒ `natural_film` (Hydrolyzed Corn Starch r2) + `fixative_film` (VP/VA r4, PVP r5). `balea-men-pomade-haar-bart-2in1` ⇒ `wax_lipid` (structuring: Petrolatum r2, Microcrystalline Wax r3, Paraffin r4) + `particulate` (Silica r7). `color-wow-dream-coat-supernatural-spray` ⇒ `silicone_coat` (Polysilicone-29 r3; Silicone Quaternium-18 r7 sits below the DMDM Hydantoin r4 marker). **Dry run (70 records):** fixative_film 39 · wax_lipid 28 · natural_film 11 · particulate 10 · silicone_coat 6 · salt 5 · humectant_only 3. |

### 2.4 `hold_route`

| Field | Definition |
|---|---|
| Values | `present` · `absent` · `ambiguous` |
| Consumer meaning | Whether a **fixative-class polymer film** is part of the formula. This is the D6 "real hold" sense (LI L5 / HOLD). It is **not a strength**. |
| Source | F |
| Decision | Deterministic.<br>• `present`: at least one fixative-class member (PS2) above the tail.<br>• `absent`: none. Starch, salt, particles, waxes and silicones never count; Polysilicone-29 alone is HOLD `none` (LI L5 placement). A fixative found only at or below the tail ⇒ `absent` with a `fixative_below_tail` trace note.<br>• `ambiguous`: the only candidate is an unsettled synthetic polymer (Acrylates Crosspolymer-3, Polyacrylamide (LI §17.19), Sodium Polystyrene Sulfonate, or PQ-11/-16/-46 per PS2), or a fixative's above-tail status rests on an `unresolved`/implausible marker ⇒ review. |
| Counter-signals | The L5 rheology exclusion. The LI anionic/cationic pairing check (an identity check only). |
| Claim boundary | Claims never set it. A captured hold level never moves it (LI T7). |
| Confidence | As `result_mechanisms`. |
| Fit consumers | The neutral fact „Enthält Stylingpolymere" (charter P4), the D6 border reading, gel film type, refresher and shine extras, D8b (§6), the job gate. |
| Calibration | `present`: `schwarzkopf-taft-power-haargel-halt-5` (PVP r3). `absent`: `balea-locken-crunchgel` (Hydrolyzed Corn Starch r3 only ⇒ `natural_film`). `ambiguous`: `alcina-styling-mousse-aerosol` (PQ-11 r5 is its only film former). Trace: `got2b-lockenspray-refresher-curlz` (VCap/VP/DMAEMA r8 behind Parfum r7 ⇒ `absent` under PS1). **Dry run:** present 39 · ambiguous 1 · absent 30. Three of the 39 rest only on the PS2 extension (§8). |

### 2.5 `weight`

| Field | Definition |
|---|---|
| Values | `light` · `medium` · `heavy` · `unknown` |
| Consumer meaning | The tendency to weigh down or coat. It drives the fine-hair downshift. |
| Source | F |
| Decision | Structured judgment on LI WT anchors (§7.5), relabelled. **Proposal — needs Nick's ruling (PS3).** Persistent families above the tail: (a) oils and non-volatile esters; (b) waxes, hydrocarbons, butters, lanolin; (c) fatty alcohols; (d) persistent silicones; (e) polymeric cationic conditioners (non-fixative PQ-x, guar HPTC, Silicone Quaternium-18). Fixatives, natural films, particles, salts, humectants, monomeric quats and volatile carriers are not families (LI WT lists only the cationic-polymer film).<br>• `light`: no persistent family.<br>• `medium`: one family, or two or more with no rich member (the multi-family counter-signal is mandatory).<br>• `heavy`: two or more families including at least one **rich** member (petrolatum, paraffin, mineral oil, microcrystalline wax, natural waxes, lanolin/lanolin wax, butters, castor/coconut/olive/avocado oil), or an anhydrous base with a rich member above the tail.<br>• `unknown`: incomplete or conflicting INCI. |
| Counter-signals | A rich member at `tail_index − 1` ⇒ confidence `moderate`. A weight claim („ohne zu beschweren", „für feines Haar") against `medium`/`heavy` ⇒ `weight_claim_conflict` tag + review (LI §10.1.2 parity); the value stays. |
| Claim boundary | Claims never move it. **Format and subtype never set it** (LI G9). |
| Confidence | `high`: plausible marker, families clearly above it. `moderate`: multi-family row, or a boundary member. |
| Fit consumers | `thickness_fit` echo (§4). |
| Calibration | `schwarzkopf-taft-power-haargel-halt-5` ⇒ light. `balea-professional-styling-cream-traumlocken` ⇒ medium (Cetearyl Alcohol r2, esters r4–r6, PQ-37 r8; no rich member). `schwarzkopf-taft-styling-balm-locken-halt-3` ⇒ heavy (esters r2/r3, PQ-37 r5, Shea r7 = rich at `tail_index − 1` ⇒ `moderate`). `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ medium (Guar HPTC r6), with a weight-claim conflict tag against its pack name „für feines Haar". **Dry run:** light 36 · medium 21 · heavy 13 (`molding` 10 of 11 heavy). |

### 2.6 `drying_alcohol_load`

| Field | Definition |
|---|---|
| Values | `high` · `present` · `none` |
| Consumer meaning | A sensitive-scalp caution when combined with root application, plus an optional „ohne Alkohol" preference (dm offers that filter). Never "damages hair" (charter §10). |
| Source | F |
| Decision | Deterministic. **Proposal — needs Nick's ruling (PS4).** Members: Alcohol, Alcohol Denat., SD Alcohol (any number), Ethanol, Isopropyl Alcohol. Never members: fatty alcohols (cetyl, cetearyl, stearyl, behenyl, myristyl, lauryl, oleyl, arachidyl) and Benzyl Alcohol (preservative/fragrance). Other short-chain solvent alcohols (n-Butyl Alcohol) are recorded as observations.<br>• `high`: a member at rank ≤ 3, counting every declared ingredient, water and propellants included.<br>• `present`: a member anywhere else, **tail included**.<br>• `none`: no member anywhere. |
| Counter-signals | None move the value. |
| Claim boundary | Free-from claims and retailer filters never override it: `alverde-beach-waves-spray-seaside-balance` is filtered „ohne Alkohol" on dm, but has Alcohol denat. r3 ⇒ `high`. |
| Confidence | `high` for any complete INCI; `low` on an INCI source conflict. |
| Fit consumers | The alcohol + roots caution (§4); the „ohne Alkohol" preference filter. |
| Calibration | `john-frieda-volume-lift-ansatz-booster` ⇒ high (Alcohol Denat. r1; root spray). `american-crew-fiber` ⇒ present (r8). `balea-locken-crunchgel` ⇒ none. **Dry run:** high 28 · present 5 · none 37. |

### 2.7 `washability`

| Field | Definition |
|---|---|
| Values | `normal` · `hard_to_wash` |
| Consumer meaning | A cosmetic clarifying-wash hint. It is not a skin claim (charter §10). |
| Source | F |
| Decision | Deterministic. **Proposal — needs Nick's ruling (PS5).** `hard_to_wash` when a solid hydrocarbon occlusive (Petrolatum, Paraffin, Microcrystalline Wax / Cera Microcristallina, Ozokerite, Ceresin) sits at rank ≤ 3, **or** the base is anhydrous (no water declared) with any hydrocarbon above the tail. Liquid mineral oil alone never fires. Lanolin or lanolin wax at rank ≤ 3 ⇒ `washability_unsettled` ⇒ review (the value stays `normal` until a reviewer decides). |
| Counter-signals | Recorded only. |
| Claim boundary | Brand wash-out claims („lässt sich problemlos auswaschen") never move it. |
| Confidence | `high` when the hydrocarbon is clearly placed. |
| Fit consumers | Clarifying hint (§4). |
| Calibration | `balea-men-pomade-haar-bart-2in1` ⇒ hard_to_wash (anhydrous, Petrolatum r2). `syoss-professional-performance-max-hold-power-wax` ⇒ hard_to_wash (Petrolatum r3). `loreal-men-expert-barber-club-styling-pomade` ⇒ normal (mineral oil r2 is liquid; Microcrystalline Wax only at r7). `american-crew-fiber` ⇒ review (Lanolin Wax r2). **Dry run:** 2 hard_to_wash, 2 review (`american-crew-fiber`, `kevin-murphy-killer-curls`). |

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
| Values | `0` Kein Halt · `1` Leichter Halt · `2` Mittlerer Halt · `3` Starker Halt · `4` Sehr starker Halt · `null` = „Halt: keine Herstellerangabe" · `review` (C1 vs C2 conflict, charter P3). `0` only on an explicit „kein Halt" claim (D8). |
| Consumer meaning | The manufacturer-stated strength on one ladder: „laut Hersteller: Starker Halt". |
| Source | C: C1/C2 only, including house-brand C2 and `C2_cross_market_verified` (LI §2.4.1 rules 6–7). The record keeps the raw text, the scale as written, the tier, the source and the date. |
| Decision | Deterministic normalisation (§5). **Claim-only: never derived from formula, never borrowed from a similar formula** (D8, LI T7). |
| Counter-signals | D8b flags (§6). They **never change a level**. |
| Claim boundary | This property *is* a claim. C3 chips and C5 pages are traces and never assign. |
| Confidence | `high`: a number on a known scale, or an unambiguous strength word. `moderate`: house-brand C2 (ownership is confirmed in review), a mid-ladder step, or cross-market C2. |
| Fit consumers | The hold-band rank, **only** in `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray` and `molding` (D8). In the other six subtypes it is stored and not used. |
| Calibration | §5.6. Coverage: 34 of 70 records carry a level (1:4 · 2:9 · 3:11 · 4:10), 36 are null. In the hold-relevant subtypes, 30 of 44: gel 3/9 · curl_cream 3/5 · mousse 4/5 · blowdry_lotion 5/8 · hairspray 6/6 · molding 9/11. |

### 2.10 `flexibility`

| Field | Definition |
|---|---|
| Values | `beweglich` · `fest` · `unbekannt` |
| Consumer meaning | Movable/restylable vs set/stiff. For example, the concept's "flexible hairspray for fine hair" (concept §5.2, row 8). |
| Source | C: C1/C2 text only. |
| Decision | Lexicon. **Proposal — needs Nick's ruling (PS6)** on the word list.<br>• `beweglich`: a flexibility word (flexibel, beweglich, elastisch, formbar, neu formbar/nachstylbar, variabel) or a negated rigidity word („ohne zu verhärten", „ohne steif zu wirken").<br>• `fest`: a rigidity word (Kleber, Freeze, betonhart, steif).<br>• Both ⇒ `unbekannt` + review. Neither ⇒ `unbekannt`. |
| Counter-signals | None from formula. |
| Claim boundary | Flexibility words are never strength words, and vice versa (§5.5). Brand flex numbers (Alcina Flex-Faktor x/10) are recorded; words decide. |
| Confidence | `high` on an explicit C1/C2 word. |
| Fit consumers | Flexibility preference ranking. |
| Calibration | `nivea-men-styling-cream-active-craft-stylers` ⇒ beweglich (C1 „Flexible Hold", „ohne zu verhärten"). `wella-eimi-sugar-lift` ⇒ beweglich alongside level 3 („starker, dennoch beweglicher Halt"). `schwarzkopf-taft-power-haargel-halt-5` ⇒ unbekannt („ohne zu verkleben" only; PS6). `alcina-ansatz-volumen-spray-aerosol` ⇒ unbekannt (Flex-Faktor 6/10 and no word). No C1/C2 `fest` claim exists in the cohort yet. |

### 2.11 `finish`

| Field | Definition |
|---|---|
| Values | `matt` · `natürlich` · `glänzend` · `unbekannt` |
| Consumer meaning | The look: matt, natural or shiny. |
| Source | C: C1/C2 text, including the pack name once confirmed („Matt Wax", „Gel Wax Glanz"). The F sanity check runs afterwards. |
| Decision | Lexicon (PS6).<br>• `matt`: matt, mattierend, „kein Glanz".<br>• `glänzend`: Glanz, glänzend, Shine, Gloss, Brillanz, Wet Look.<br>• `natürlich`: „natürliches Finish", „Natural Look", „natürlicher Glanz".<br>Brand shine numbers (Taft Glanzstufe, American Crew Glanzfaktor) are recorded; words decide unless a scale maximum is published. **Unclaimed ⇒ `unbekannt`, never formula-derived.** |
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
| Decision | Structured judgment. Primary = the job the C1/C2 promise leads with. Secondaries = up to two further jobs the C1/C2 claims state explicitly. **Formula compatibility gate** (v0 convention; template §12, "claims cannot override incompatible input evidence"): each job needs one of these:<br>• `hold_fix` ⇒ the §6 hold-mechanism set;<br>• `volume` ⇒ fixative_film / natural_film / particulate / salt;<br>• `texture` ⇒ particulate / salt / structuring wax_lipid / a film;<br>• `sleek` ⇒ silicone_coat / wax_lipid / fixative_film;<br>• `shine` ⇒ wax_lipid / silicone_coat;<br>• `frizz_control` ⇒ silicone_coat / wax_lipid / a film;<br>• `definition` ⇒ any mechanism except humectant_only/none;<br>• `refresh` ⇒ any mechanism.<br>A failing **secondary** is dropped and recorded. A failing **primary** is kept and tagged `job_formula_conflict` ⇒ review. |
| Counter-signals | The gate above. |
| Claim boundary | Duration and humidity parts of a claim never make a job; they go to `captured_claims`. |
| Confidence | `high` when the promise names one job; `moderate` when the order of jobs is a judgment. |
| Fit consumers | Goal/problem matching; subtype choice. |
| Calibration | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ volume (C2 „sorgt für mehr Volumen und natürliche Bewegung") + hold_fix (C2 Haltegrad 4). `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` ⇒ sleek + shine + frizz_control (C2 „Glättungsspray für bis zu 100H brillanten Glanz. Anti-Frizz."); the „100H" goes to `captured_claims`. `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` ⇒ sleek. Its C1 „Starker Halt" fails the `hold_fix` gate (silicone_coat only) ⇒ dropped + review, the same product the D8b flag catches. |

### 2.13 `application_moment`

| Field | Definition |
|---|---|
| Values | `damp_before_drying` · `before_heat` · `dry_finish` · `dry_restyle` · `second_day` · `unresolved`. The primary value is the lead instruction; other permitted moments go in `also[]`. |
| Consumer meaning | The routine-compiler slot (the anchors `dry_pre_heat`, `heat_tool` and `dry_finish` exist) and the D5 day-2 instruction. |
| Source | U: the verbatim directions, sourced as LI T12 `application_stage`. The directions come from the G1 source hierarchy with their tier recorded. They are **not claim-gated**. |
| Decision | Transcription against anchors:<br>• `damp_before_drying`: wet or towel-dried hair, then any drying (air-dry allowed).<br>• `before_heat`: the directions make a heat step part of the application (blow-dry or iron named as the next step, not optional), or apply to dry hair before a hot tool.<br>• `dry_finish`: applied over the finished style, with no further shaping.<br>• `dry_restyle`: applied to dry hair, then shaped by hand or comb.<br>• `second_day`: the directions lead with refreshing styled hair between washes. |
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
| Decision | Transcription:<br>• `roots`: the directions lead with Ansatz/roots.<br>• `lengths`: mid-lengths and ends only.<br>• `surface`: the outer layer or flyaways of a finished style only.<br>• `hairline`: edges, baby hair, brows.<br>• `all`: whole hair, or „ins Haar" with no zone.<br>No directions ⇒ empty + review; never guessed. |
| Counter-signals | As §2.13. |
| Claim boundary | None. |
| Confidence | As §2.13. |
| Fit consumers | Subtype choice (roots ⇒ blowdry_lotion), edge branch, caution. |
| Calibration | `alcina-ansatz-volumen-spray-aerosol` ⇒ roots („Ansatznah … sprühen"). `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` ⇒ lengths („in die trockenen Haarlängen"). `bali-curls-sleek-stick-brows-and-edges` ⇒ hairline. `gard-haarspray-extrastark-pumpspray` ⇒ all, also roots. No cohort product leads with `surface` yet. |

### 2.15 `heat_activated`

| Field | Definition |
|---|---|
| Values | `yes` · `no` · `unresolved` |
| Consumer meaning | Heat makes or strengthens the result, so the product goes before the heat step. **Never heat protection** (charter §5, step 5). |
| Source | U (directions). After unblinding, a C1/C2 activation statement may raise `no` to `yes` (§7). |
| Decision | • `yes`: the directions or a C1/C2 statement say heat (blow-dry or iron) activates, sets or strengthens the effect.<br>• `no`: directions exist and give heat no such role (heat optional or absent).<br>• `unresolved`: no directions, or activation stated only at C3/C5. |
| Counter-signals | None. |
| Claim boundary | Heat-protection claims go to `captured_claims` and are never read here. |
| Confidence | As §2.13. |
| Fit consumers | Routine order. |
| Calibration | `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` ⇒ yes (directions: „Föhnhitze verstärkt den Volumen-Effekt"). `guhl-foehn-spray-langzeit-volumen` ⇒ yes (C1 „aktiviert durch die Föhnhitze"). `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` ⇒ no. `color-wow-dream-coat-supernatural-spray` ⇒ unresolved („wärmeaktiviertes Polymer" appears only on Douglas, C3). |

### 2.16 `captured_claims`

| Field | Definition |
|---|---|
| Values | A list of `{type: heat · humidity · duration · hair_type · free_from · other, raw (verbatim DE), tier, source, date}` |
| Consumer meaning | **None for selection, ranking or copy.** Humidity follows LI T9. A heat claim never fills the heat role. „bis zu 48 h" is never shown. Hair-type claims never set fit. Free-from claims never override flags. |
| Source | C: all tiers are recorded with their tier. |
| Decision | Capture only. |
| Fit consumers | None. Audit and future research only. |
| Calibration | `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`: heat „Hitzeschutz bis zu 230 °C"; humidity/duration „bis zu 72 Stunden gegen Frizz, selbst bei hoher Luftfeuchtigkeit". `guhl-foehn-spray-langzeit-volumen`: duration „48h Halt", which is also why it has no hold level. `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`: hair type „für feines Haar". |

## 3. Subtype extras (only where they discriminate)

Most extras are **views of base properties**, not new fields. Four are new: three subtype fields (`cast_expected`, `conditioning_co_load`, `base`) and one identity label (`form_label`).

| Subtype | Extra | Carried by | Values / rule | Calibration |
|---|---|---|---|---|
| `gel` | film type | view of `hold_route` + `result_mechanisms` | `synthetic` (hold_route present) · `natural` (natural_film, no fixative) · `mixed` | `schwarzkopf-taft-power-haargel-halt-5` synthetic · `balea-locken-crunchgel` natural · `bali-curls-strong-hold-flaxseed-gel` natural (carrageenan, unsettled ⇒ review) |
| `gel` | crunch/cast expected | **new** `cast_expected` (C) | `yes` · `unbekannt`. Yes when C1/C2 text or the confirmed pack name promises a cast („Crunch", „Cast", „knusprig"). Usage guidance (knead out the cast), not strength. | `balea-locken-crunchgel` yes (house-brand name „Crunchgel") |
| `curl_cream` | conditioning co-load | **new** `conditioning_co_load` (F) | `light` · `rich`. An echo of the LI G0 conditioning read used at S0: rich = substantive conditioning architecture (LI COND moderate/high); light = thin or absent. | `balea-professional-styling-cream-traumlocken` rich (D7 band) · `schwarzkopf-taft-styling-balm-locken-halt-3` rich (D7) · `maria-nila-curlicue-cream` light (T15) · `kevin-murphy-killer-curls` light (no cationic) |
| `mousse` | target zone, silicone flag | base §2.14, §2.8 | — | `balea-ansatzvolumen-booster` roots · `wellaflex-schaumfestiger-locken-und-wellen-starker-halt` `silicones` |
| `blowdry_lotion` | target zone, heat_activated | base §2.14, §2.15 | — | `alcina-ansatz-volumen-spray-aerosol` roots · `guhl-foehn-spray-langzeit-volumen` heat yes |
| `smoothing_styler` | coating type | view of `result_mechanisms` | silicone_coat · fixative_film · wax_lipid | `color-wow-dream-coat-supernatural-spray` silicone (Polysilicone-29 r3) · `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` silicone (Dimethicone r2) · `wella-professionals-eimi-flowing-form` polymer (PVP r2) + lipid |
| `hairspray` | aerosol vs pump; flexibility; shine | identity `format`; §2.10; §2.11 | — | `gard-haarspray-extrastark-pumpspray` pump · `schwarzkopf-taft-haarspray-glanz-halt-4` aerosol, glänzend (C2 „Glänzendes Finish") |
| `shine_finish` | base; fixative present | views: `wax_lipid` vs `silicone_coat`; `hold_route` | — | `got2b-gotgloss-glanz-spray` ester base (CCT r4, Dicaprylyl Carbonate r5) · `feschi-smooth-and-shine-anti-frizz-spray-glanzspray` silicone (Phenyl Trimethicone r6) · `balea-professional-glow-und-shine-finishing-spray` fixative (PU-14 r11) |
| `salt_spray` | real salt vs salt-free; alcohol | view: `salt` mechanism; §2.6 | — | all 5 cohort salt sprays carry real salt; **no salt-free sample yet** · `jean-und-len-sea-salt-spray` alcohol high (r2) |
| `texture_spray` | particle type; fixative present | view: `particulate` members; `hold_route` | — | `living-proof-full-dry-volume-texture-spray` borosilicate + zeolite, VP/VA · `balea-pure-styling-volumenpuder-spray` starch powders + silica, no fixative |
| `hair_powder` | particle type; white-residue caution | view; caution in §4 | — | silica silylate in all 4 · `kevin-murphy-powder-puff-volume` adds VP/VA r3 |
| `molding` | form label | **new** identity `form_label` | `wax · paste · clay · fiber · pomade · cream`, from the confirmed pack name. Display only: never routes, never sets an F value. | `got2b-styling-paste-istyler-texture-clay` label „clay", no clay in the formula |
| `molding` | base | **new** `base` (F) | `anhydrous` (no water declared) · `water_based` | `balea-men-pomade-haar-bart-2in1` anhydrous, the only one of 11 |
| `molding` | shine | §2.11 | — | `schwarzkopf-taft-gel-wax-glanz-halt-2` glänzend (C2) |
| `refresher` | humectant-only vs light hold | view: `humectant_only` vs `hold_route: present` | — | `balea-locken-revitalizing-spray` humectant_only · `got2b-lockenspray-refresher-curlz` neither under PS1 (fixative in the tail; ester lipid) |

## 4. Derived echo fields (annotations, not reviewed per product)

These follow LI T8 / Mask R9: computed last, shown as annotations, never independently researched. Matching policy owns the final tables (charter §14). The mappings below are drafts, tied to PS3 where they read `weight`.

| Field | Draft rule |
|---|---|
| `thickness_fit` | From `weight` (PS3): light ⇒ fine · normal · coarse; medium ⇒ normal · coarse, fine ranked lower; heavy ⇒ coarse, normal lower, fine last. **A ranking signal only, never an exclusion.** |
| `texture_fit` | `curl_cream`, `refresher` and products with primary `definition` ⇒ wavy · curly · coily. `salt_spray` ⇒ straight · wavy. Everything else ⇒ all. |
| `length_fit` | `molding` ⇒ very short · short (concept §5.2, row 1). Everything else ⇒ all. |
| Hold display | A level ⇒ „laut Hersteller: Starker Halt". Null ⇒ „Halt: keine Herstellerangabe", plus „Enthält Stylingpolymere (z. B. PVP)" when `hold_route = present` (charter P4). |

**Cautions.** Cosmetic and medically adjacent cautions are separate layers (charter §10). The copy below is a draft; final wording belongs to the decision doc.

| Trigger | Layer | Draft copy |
|---|---|---|
| `salt` mechanism + profile bleached or highly damaged | cosmetic | „Bei blondiertem oder stark strapaziertem Haar sparsam verwenden." |
| `drying_alcohol_load: high` + `target_zone: roots` + sensitive/irritated scalp | medically adjacent | „Nicht direkt auf die Kopfhaut sprühen." |
| `washability: hard_to_wash` | cosmetic | „Lässt sich schwer auswaschen – ab und zu ein Tiefenreinigungsshampoo verwenden." |
| `particulate` + dry application (`hair_powder`, `texture_spray`) | cosmetic | „Gut einarbeiten – auf dunklem Haar können Reste sichtbar bleiben." The profile has no hair-colour field today, so this is shown to everyone. |
| `molding` with weight `heavy` or base `anhydrous`; or `wax_lipid` + `target_zone: hairline` | medically adjacent (pomade acne) | „Nicht direkt am Haaransatz oder auf der Stirn auftragen." |

## 5. Hold normalisation (`chaarlie_hold_level`)

### 5.1 Where hold is used (D8)

| Subtypes | Role of the level |
|---|---|
| `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray`, `molding` | A stated, fitting level ranks first. **No level ⇒ still eligible**, ranked after, shown as „Halt: keine Herstellerangabe". Never excluded. |
| `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler`, `refresher` | Captured and stored; **no part in selection**. Finish, weight and application decide. |

### 5.2 Assignment order

1. **Only C1/C2 counts.** That includes house-brand C2 (dm ↔ Balea/alverde, Rossmann ↔ Isana) and `C2_cross_market_verified`. Retailer copy, retailer filter chips (dm „Halt", Douglas „Haltgrad") and C5 pages are tier-stamped traces and **never assign a level**.
2. **Brand number on a known scale ⇒ table §5.3.**
3. **The number beats the word** on the same pack or page.
4. **Brand word ladders** (Elnett). A mid-ladder step gets confidence `moderate`.
5. **Strength words ⇒ lexicon §5.4.** Look and flexibility words are not strength words (§5.5).
6. **No strength claim ⇒ `null`** („keine Herstellerangabe"). Never `0` (D8), never derived from formula, never borrowed from a similar formula (Balea Haarpuder keeps its own „starker Halt"). The gap is queued for pack-photo fill.
7. **C1 vs C2 conflict ⇒ `review`.** Matching treats it like `null` (charter P3).

### 5.3 Normalisation tables (brand × format)

These match `TABLES` in `build-calibration-r2.js`. The tables grow per brand.

| Brand scale (formats) | ⇒ 1 | ⇒ 2 | ⇒ 3 | ⇒ 4 | Note |
|---|---|---|---|---|---|
| Henkel Haltegrad x/5 — Taft, Syoss, got2b sprays, mousses, Föhnspray | 1–2 | 3 | 4 | 5 / 5+ | Numbers are shared across Henkel brands; the number wins over inflated words (Syoss calls 3 „starker Halt"). |
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
| sehr / extra / ultra / mega / extrem stark, maximal, Max, Power, Kleber | 4 |

„Power" is in concept §4 but missing from the build-script word list; align them in Phase 3.

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
| `balea-styling-spray-ultra-volumen` | dm attribute „sehr starker Halt" (house-brand C2) | house-brand rule | 4 |
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
- `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`: C1 „Starker Halt"; silicone_coat only. Level 3 kept.
- Sibling rule: `schwarzkopf-taft-haarspray-classic-halt-3` (2) vs `schwarzkopf-taft-haarspray-glanz-halt-4` (3), with character-identical INCI.
- No flag for `color-wow-dream-coat-supernatural-spray` or `bumble-and-bumble-brilliantine`: they only have retailer chips.

**Neutral fact.** „Enthält Stylingpolymere (z. B. ‹first fixative-class member›)" is shown iff the level is `null` **and** `hold_route = present` (charter P4 trigger, with the PS2 list). Dry run: 9 hold-relevant products qualify, e.g. `balea-haargel-hair-jelly` (PVP r6) and `john-frieda-volume-lift-ansatz-booster` (PVP r3). Natural-film-only products with no level (`balea-locken-crunchgel`, `guhl-foehn-spray-langzeit-volumen`, `langhaarmaedchen-lockenspray-halt-sprungkraft`) show „Halt: keine Herstellerangabe" alone. D8b ruled only the polymer sentence; whether a „pflanzliche Filmbildner" variant is wanted stays open (`round2/hold-research-ingredients.md` §3.3) and is not proposed here.

**Comparability.** Levels compare only within a hold family: film (gel, curl_cream, mousse, blowdry_lotion, hairspray, salt and texture sprays), molding, or powder. The app never compares hold across families.

## 7. Blind classification packet (Phase 4)

This mirrors Mask §13 and LI §19.3: capture is kept separate from classification, two sealed blind lanes run, and the reference key is never shown to them.

**Packet (frozen; hash recorded before unblinding).** It contains:
- the normalised complete INCI with ranks, capture tier and date;
- identity `format`;
- the verbatim directions, with brand, product name and strength/look adjectives replaced by `[CLAIM]`;
- the S0 outputs `route` and `styling_subtype` (just as the Mask packet carries the category).

It **removes** brand, product name, all `claims[]`, retailer chips, prior calibration labels and price.

**Cohort independence.** The cohort must be disjoint from the products named as worked examples in this file. Any named product that is reused is reported as confirmation-grade only. This is the Mask round-1 lesson: blind independence broke on standard-named products.

| Classified by | Properties |
|---|---|
| **Two blind lanes (F + U)** | `result_mechanisms` (with members, ranks and marker), `hold_route`, `weight`, `drying_alcohol_load`, `washability`, `ingredient_flags`, molding `base`, curl-cream `conditioning_co_load`, `application_moment`, `target_zone`, `heat_activated` (directions half) |
| **Authoritative claim capture (C; not blind; F-lane pattern of round 2)** | `route` promise class, `chaarlie_hold_level` (raw, scale, tier, normalisation basis), `flexibility`, `finish`, `primary_job`/`secondary_jobs`, gel `cast_expected`, molding `form_label`, `captured_claims`, C1/C2 heat-activation statements |
| **Derived last (D)** | `thickness_fit`, `texture_fit`, `length_fit`, cautions, hold display, neutral fact |

**Permitted crossings after unblinding (the complete list):**
1. A C1/C2 heat-activation statement may raise `heat_activated` from `no` to `yes`.
2. The job gate may drop an unsupported secondary job and tag a primary.
3. The D8b flag, the finish sanity check and the weight-claim conflict tag fire as review notes; **none moves a value**.

Every blind-to-final change is recorded with its reason.

**Agreement.**
- Report exact agreement per property.
- Deterministic F properties must reach **100 %**; any disagreement is a lexicon defect, fixed in the lexicon, never per product.
- U properties report agreement with coded causes (source ambiguity, rule ambiguity, legitimate uncertainty).
- Two independent claim normalisations must give identical levels (charter P1, criterion c).

## 8. Proposals — need Nick's ruling

| ID | Decision | Plain-language example | Recommendation |
|---|---|---|---|
| **PS1** | **Tail-marker convention.** Option A: Leave-in's list (preservatives only). Option B: Mask's `tail_index` (fragrance, allergens, preservatives, boosters, chelators). | Many aerosols carry no preservative. Under A, 14 of the 70 records have no readable marker, and their fixatives can only be read loosely by position. Under B, 1 of 70 does (`balea-pure-styling-volumenpuder-spray`). `got2b-lockenspray-refresher-curlz`: its one styling polymer sits after the perfume, so B reads it as a trace and A cannot decide. | **B** for Styling's own properties. The S0/G0 border keeps running LI G0 with its own marker, unchanged. |
| **PS2** | **Which polymers count as "real hold" (fixative-class).** (a) Add four vinyl families missing from LI L5: VA/Crotonates/Vinyl Neodecanoate, VP/DMAEMA, VCap/VP/DMAEMA, PVM/MA esters. Add them to LI L5 too, in the D6/D7 overlay (charter §13, item 1), so both engines share one list. (b) The film-forming quats PQ-11/-16/-46 standing alone ⇒ `ambiguous` + review, not fixative-class, because in Leave-in they are conditioning quats. | (a) `loreal-paris-elnett-haarspray-extra-starker-halt` holds with VA/Crotonates only (r3). Without (a), a level-4 hairspray reads as "no styling polymer" and trips D8b. The same applies to `loreal-men-expert-barber-club-styling-pomade` and `schwarzkopf-taft-x-gliss-silky-shine-shine-coat`. (b) `alcina-styling-mousse-aerosol` (PQ-11 only, level 2) gets no „Stylingpolymere" fact until reviewed. | Adopt (a) and (b). |
| **PS3** | **Weight anchors.** Use Leave-in's weight rule unchanged in substance (count persistent oil/wax/silicone/conditioning families; heavy needs a rich member such as petrolatum, wax, butter or castor oil). Product form never decides weight. `thickness_fit` follows as a ranking signal only. | `schwarzkopf-taft-styling-balm-locken-halt-3` ⇒ heavy (shea + esters + conditioner). `balea-professional-styling-cream-traumlocken` ⇒ medium (no rich member). Taft Haarspray Classic ⇒ medium (Isopropyl Myristate r7), while `syoss-haarspray-max-hold` ⇒ light: a difference only a fine-hair ranking would notice. | Adopt. It reuses a locked rule; concept §3's "form + load" wording conflicts with LI G9. |
| **PS4** | **When alcohol counts as „high".** Ethanol or isopropyl alcohol in the first 3 ingredients (water and propellants counted) ⇒ high. Anywhere else, including the tail ⇒ present. Fatty alcohols and benzyl alcohol never count. | `alverde-beach-waves-spray-seaside-balance`: dm filters it „ohne Alkohol", yet alcohol is 3rd ⇒ high. `schwarzkopf-taft-styling-balm-locken-halt-3`: isopropyl alcohol at r14 ⇒ present, not none. | Adopt. Dry run: high 28 · present 5 · none 37. |
| **PS5** | **„Schwer auswaschbar".** A solid petroleum occlusive (petrolatum, paraffin, microcrystalline wax) in the top 3, or an anhydrous base with any of them above the tail. Liquid mineral oil alone never fires. Lanolin wax in the top 3 goes to review. | `syoss-professional-performance-max-hold-power-wax` (petrolatum r3) and `balea-men-pomade-haar-bart-2in1` (anhydrous) ⇒ hint. `loreal-men-expert-barber-club-styling-pomade` (mineral oil r2, an emulsion) ⇒ no hint. `american-crew-fiber` (lanolin wax r2) ⇒ review. | Adopt. It reproduces exactly the two products the concept names. |
| **PS6** | **Look-word lexicon** for `flexibility` and `finish`. (1) „ohne zu verkleben" (not sticky) and „ausbürstbar" are **not** flexibility words. (2) „Crunch" sets the gel `cast_expected`, not `fest`. (3) „natürlicher Glanz" reads `natürlich`, not `glänzend`. (4) Brand flex/shine numbers are recorded; words decide. | (1) Almost every Taft pack says „ohne zu verkleben"; under concept §3 even `schwarzkopf-taft-power-haargel-halt-5` („maximaler Halt") would read beweglich. (3) `bali-curls-strong-hold-flaxseed-gel` („schenkt natürlichen Glanz") is `glänzend` in the calibration set today and would become `natürlich`. | Adopt all four. |

## 9. Conflicts and gaps noticed

1. **`hold_route` breadth.** Concept §3.1 (3b) counts natural film, wax, particulate and salt as a hold route. The D6 clarification and the 2026-10-09 property set say fixative-class only. This file follows the ruling and the presented set; the broad sense moves to `result_mechanisms` and the §6 hold-mechanism set. Concept 3b's "ambiguous" cases (carrageenan/gellan gels, unmodified-starch products) now surface as `natural_film_unsettled` review notes.
2. **Weight from form.** Concept §3 reads weight from "form + non-volatile load"; LI G9 forbids form setting weight (PS3).
3. **Flexibility words.** Concept §3 lists „ohne zu verkleben" as a flexibility word (PS6).
4. **Calibration data drift.** In `calibration-set-r2.json`, `proposed_finish` is not tier-gated: `schwarzkopf-taft-haarspray-classic-halt-3` reads „natürlich" from a "no finish claim" note. The round-1 lane labels for `application_moment` predate the §2.13 anchors and are inconsistent: `alcina-foehn-lotion` is `damp_before_drying` while `balea-foehnlotion-volume-effect` is `before_heat`, although both directions say "spray into damp hair, then blow-dry". Re-label in the blind round; do not hand-edit frozen records.
5. **D8b reach.** The ruling says "today this catches Cantu". Under these rules it also catches Elnett Stylingspray 3 Tage Glatt, which concept §4 already lists. Not a contradiction; recorded so the count is not a surprise.
6. **Marker edge.** `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` lists the booster Caprylyl Glycol (r13) above its preservative Phenoxyethanol (r17). Under PS1, Mask's booster limb makes that marker `unresolved` ⇒ review. Polysilicone-29 (r15) is not credited until a reviewer decides.
7. **Untested values.** The cohort has no salt-free salt spray, no `target_zone: surface` product and no C1/C2 `fest` claim. These values are ruled but uncalibrated.
8. **No hair-colour field** in the profile, so the white-residue caution cannot target dark hair.
9. **Lexicon edge.** Acrylates Crosspolymer-3 (`bali-curls-sleek-stick-brows-and-edges`, r2) is marketed as a film former, while the L5 rheology exclusion names acrylates crosspolymers. v0 treats it as unsettled (§2.4). It moves nothing today, because PVP r3 is present.
10. **S0 promise check (outside this file's scope).** The frozen C2 primary promise of `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` leads with heat protection („Die 230° Hitzeschutz-Technologie ist speziell für das Stylen mit heißem Fön und Glätteisen entwickelt"). Under S0 step 2 that reads as `heat_protection` or `mixed`, not `styling_result`, yet the calibration set routes it to Styling `smoothing_styler`. Re-run S0 on it before calibration.
