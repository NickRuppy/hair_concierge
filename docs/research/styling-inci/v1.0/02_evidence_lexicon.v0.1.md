# Styling evidence lexicon — v0.1

Status: **v0.1 — Phase 2 ruled 2026-10-11 (PH2-1…11); next: Phase 3 capture + blind calibration round 1.** Drafted 2026-10-10. Not calibrated, not locked. No product classification lives here; the standard owns every anchor, threshold and outcome.
Lexicon version: `styling-lexicon-v0.1` (consumed by `styling-classification-standard.md` v0.1, engine `styling-inci-v0.1`).
Scope: leave-on styling products (12 subtypes), German/EU market, plus the boundary families the S0 gate reads at the edges of Leave-in, Heat Protectant, Oil and Dry Shampoo.
Governing order: `plans/styling-concept/02-rulings.md` (SD1–SD5, D1–D8b, PH1-1…PH1-16, PH2-1…PH2-11) **governs**; then `00_category_charter.md`; then `01_property-set-v0.md`; then `plans/styling-concept/01-styling-concept.md` Rev. 2. Where the charter or the property set still lag a PH1 ruling, the ledger governs and this file follows the ledger.
Inherited method and lists: Leave-In Standard v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`, cited "LI §x"), Mask lexicon v0.2 and Mask Standard v1.0 (cited "Mask lex §x", "Mask §x").
Evidence used to test the entries: the 90 records of `data/research/styling-inci/concept-v0/calibration-set-r2.json`, with the raw INCI from `samples/*.json` and `round2/G1–G2`. Every count marked **(node)** was recomputed with a scratch script on 2026-10-10 over the raw INCI (parentheses-aware split, §0.4 repairs). No record was changed.

**What this file is.** One versioned table (§1) that says, for every ingredient family the Styling engine recognises: which INCI names belong to it, what the family may support at E2, which property or S0 rule reads it, what it must never be read as, and how well the placement is evidenced. Plus the two tail markers (§0.2), because every "above the tail" reading in the standard depends on them.

**What it is not.** No hold strength, no weight from product form, no dose, no performance. The lexicon names families; the standard decides values.

---

## 0. Reading rules (apply before any entry)

### 0.1 Evidence ceiling and the assignment ladder

Reused unchanged from LI §3.1 (assignment ladder) and charter §11:

| The read is | Level |
|---|---|
| An ingredient present, at a literal rank (an INCI observation); a verbatim directions transcription | **E1** |
| Any value read from the frozen formula (a mechanism, `hold_route`, `weight`, a family membership used as evidence, a marker reading) | **E2** — the formula-only ceiling |
| A C1/C2 claim, including a hold level | **E0** (LI §2.4.1 rule 5) — authority decides whether a claim exists, never whether it is true |

EU 1223/2009 Art. 19: ingredients above 1 % are listed in descending order; below 1 % in any order; the boundary is invisible. No entry below may be read as a concentration, a dose or a performance level (LI G4).

### 0.2 The two tail markers (PH1-1, PH2-9)

PH1-1 rules two markers, one per purpose. Every record states both. **PH2-9 rules that T_S is the full Mask rule** — preservative, perfume, declared allergens/aroma chemicals, preservative boosters in a pair, chelators (the classes below) — as approved under PH1-1, not the ledger's short form „first preservative or perfume“.

| Marker | Used by | Marker-eligible classes (the **earliest** member sets the marker) | Never marker-eligible |
|---|---|---|---|
| **T_S** — Styling marker ("Mask rule") | Every Styling-owned property: `result_mechanisms`, `hold_route`, `weight`, the buildup note, the neutral fact (PH1-9), `provides_heat_protection` (standard §6.7; the heat check reads T_S, PH2-4), subtype extras | (a) fragrance: `Parfum` / `Fragrance` / `Aroma`; (b) declared fragrance allergens and named aroma chemicals declared in their own right (EU Annex III list incl. the 2023/1545 additions; e.g. Limonene, Linalool, Hydroxycitronellal, Tetramethyl Acetyloctahydronaphthalenes); (c) preservatives — PR-1 (§1); (d) preservative boosters — PR-2, **only when a PR-1 preservative is declared anywhere on the same list**; (e) trace chelators — CH-1 | CI colourants (Mask R8 precedence), Citric Acid, Sodium Hydroxide, Sodium Chloride, other pH adjusters (PH-1), botanical essential oils named as oils (peel/leaf/wood/flower/bark oils) |
| **T_LI** — Leave-in border marker | Only the S0 border rules that run Leave-in logic: LI G0 (both halves, T15), the D6 care test (PH1-13 R2), the D7 middle-band test, and the "both engines could claim" check (PH1-16) | The LI §3.1.1 concentration-capped list: Phenoxyethanol, Sodium Benzoate, Potassium Sorbate, Benzyl Alcohol (as preservative), Hydroxyacetophenone, Ethylhexylglycerin, Levulinic Acid / Sodium Levulinate, Chlorphenesin, Dehydroacetic Acid, Caprylyl Glycol (in a preservative pair); **plus any other EU Annex V preservative** (LI's own "chiefly the common preservatives … at or below ~1 %"; e.g. DMDM Hydantoin, parabens, Benzoic Acid, Piroctone Olamine, Benzalkonium Chloride, Diazolidinyl Urea, Salicylic Acid) | Fragrance and the declared allergens (LI T17 removed them), chelators, colourants, pH adjusters |

"Above the tail" means **strictly before** the marker (LI §3.1.1; Mask §3.1). Within-list only: marker positions are never compared across products (LI mandatory limit 5).

**T_S plausibility (Mask §3.1.1, E2/E13, adopted unchanged with PH1-1).**
- *Establishing species* = the members that establish the record's `result_mechanisms` and `weight` (property set §0). A below-marker extra never makes the marker implausible; where crediting it would change a value it carries `candidate_below_tail` and routes to review (Mask E13).
- *Third limb (ordinal inconsistency)*: the marker is `unresolved` when the species chosen as T_S is (i) a declared allergen ranked above the list's own `Parfum`, or (ii) a booster ranked above every PR-1 preservative on the list (Mask round-2 triage note: the limb tests only orderings that involve the marker species itself).
- *Absent*: no T_S class anywhere ⇒ `tail_marker: absent`, the whole list is read as above-tail, confidence ≤ `moderate`, review (Mask §3.1).
- What an `unresolved` T_S does to a value is the standard's rule (standard §3.3), not the lexicon's.

**Cohort check (node, 70 Styling records).** T_S plausible 61 · unresolved 8 (7 booster-above-preservative, 1 allergen-above-Parfum: `loreal-paris-elnett-haarspray-extra-starker-halt`, Hydroxycitronellal r4 vs Parfum r28 — the Mask E2 worked shape) · absent 1 (`balea-pure-styling-volumenpuder-spray`). On all 8 unresolved records the two readings (marker as listed vs. the next ordinally consistent marker) give the **same** `hold_route` and `weight`, so no value rests on the limb today.

### 0.3 "Aqueous" (used by the S0 pair rules and two entries)

A formula is **aqueous** when `Aqua`/`Water` is declared **above T_S** — LI G0's "Aqua leads or is materially present", made rank-readable. Water declared only in the tail (got2b Curlz r13, got2b gotGloss r9, taft x Gliss Shine Coat r10) or not at all (Elnett Haarspray, Balea MEN Pomade, Feschi) is **non-aqueous**. This is distinct from the molding extra `base` (property set §3: `anhydrous` = no water declared anywhere), which is display data only.

### 0.4 Normalisation, aliases and transcription repair

1. Match on normalised INCI: case-folded; parentheticals stripped (`Butyrospermum Parkii (Shea) Butter` → `butyrospermum parkii butter`); `*`/`**` origin marks stripped; whitespace around `/` and `-` collapsed. Latin binomials retained.
2. List separators are `,`, `•` and `·` at bracket depth 0. A comma **inside** an ingredient name is not a separator (LI §2.4 packet requirement: `1,2-Hexanediol` is one token).
3. **Transcription repair, recorded never silent.** A fragment that is not itself an INCI name and that forms a known INCI name with its neighbour is re-joined, and the repair is logged in the record's `formula_observations[]`. Cohort cases: `balea-locken-crunchgel` „HYDRO, LYZED CORN STARCH" and „POLYGLYCERYL, 6 CAPRYLATE"; `balea-leave-in-spray-sea-salt-care-define` „TETRAMETHYL, ACETYLOCTAHYDRONAPHTHALENES"; `balea-professional-definier-spray-traumlocken` „ALPHA, ISOMETHYL IONONE"; `langhaarmaedchen-lockenspray-halt-sprungkraft` „…FERMENT, FILTRATE"; `cantu-lockencreme-kokos` „SIMMONDSIA CHINENSIS (JOJOBA), SEED OIL". A **missing** separator is not repaired by guesswork: `balea-locken-revitalizing-spray` „CITRONELLOL SODIUM CHLORIDE" is logged as one unreadable token plus a `transcription_defect` note (tail position; it moves no F value, but it hides a `salt` flag — standard §6.6). A repair that would move a rank above T_S needs a second capture (LI T18).
4. **Typos are aliases only when unambiguous**: `GLYERIN` → Glycerin, `BETANE` → Betaine, `PAPKII` → Parkii, `VITAMNIN` → vitamin.
5. **Names, marketing words and retailer chips are never aliases** and never enter the match: „Gel Wax", „Texture Clay", „Fiber", „Haaröl", „Lockencreme", „Hitzeschutz", „ohne Alkohol", „silikonfrei", „vegan". They are identity or claim data (standard §2, §9).

### 0.5 Evidence tiers for lexicon entries

| Tier | Basis |
|---|---|
| **T1** | An owner ruling (ledger) or a list adopted unchanged from a locked engine (LI v1.0, Mask v1.0) |
| **T2** | Regulation or peer-reviewed evidence (EU 1223/2009 Annex V, Art. 19; Zhou et al. 2011; McMullen & Jachowicz 1998) |
| **T3** | Supplier / trade / formulator convention, consistent with the INCI function name |
| **T4** | v0.1 lexicon placement with no external anchor — **calibration-testable**; a blind-lane disagreement on a T4 placement is fixed here, never per product |

### 0.6 What the lexicon must not become

- **No family sets a hold strength** (D8, D8b, LI T7, FS-9). `fixative_film` says a hold *route* exists, nothing about *how much*.
- **No family sets weight from form** (LI G9; PH1-2). A spray, a mousse or a "cream" weighs what its above-tail families weigh.
- **No single ingredient is a verdict.** Only the closed fixative-class list (FX-1…FX-4), the closed L9 list (HP-1) and the PH1-3 alcohol trigger (AL-1) are deterministic memberships; every other family feeds a rule the standard owns.
- Every counter-signal, confidence note and review flag stays internal (research uncertainty is never user-facing).

---

## 1. The lexicon table (v0.1)

Column key — **Consumed by**: S0 = routing gate (standard §4); RM = `result_mechanisms`; HR = `hold_route`; WT = `weight` (LI §7.5 family count; PH1-2, PH1-4); BU = buildup note (LI §8.5 via PH1-4); AN = alcohol note (PH1-3); IF = `ingredient_flags`; NF = neutral fact „Enthält Stylingpolymere" (PH1-9); D6/R2 = D6 care test (PH1-13); D7 = curl-cream middle band; HEAT = `provides_heat_protection` (PH1-15); D8b = plausibility-flag hold-mechanism set; MK = tail marker; JG = job-formula gate.

### 1A. Film formers and the rheology exclusion

| ID | Family | Normalised members (aliases) | Supported function (permitted E2 statement) | Consumed by | Never / false positives | Tier |
|---|---|---|---|---|---|---|
| **FX-1** | Fixative-class: PVP / VP family (LI L5) | PVP (Pvp) · VP/VA Copolymer · VP/Acrylates/Lauryl Methacrylate Copolymer · VP/Methacrylamide/Vinyl Imidazole Copolymer · PVP/DMAPA Acrylates Copolymer (= VP/DMAPA Acrylates Copolymer) | "Contains a fixative-class film route" — fibre-to-fibre welding film (LI L5) | S0 (LI G0 architecture half, D6 "real hold", D7), RM `fixative_film`, HR `present`, NF, IF `fixative_family: pvp_vp`, JG, D8b | Never a hold level (FS-9, LI T7). PVP's humidity sensitivity is chemistry, not a product claim. VP/DMAPA Acrylates also sits in HP-1 — the two memberships are independent | T1 |
| **FX-2** | Fixative-class: acrylate fixatives (LI L5 "acrylates copolymers used as fixatives", enumerated) | Acrylates Copolymer · AMP-Acrylates Copolymer · Acrylates/t-Butylacrylamide Copolymer · Octylacrylamide/Acrylates/Butylaminoethyl Methacrylate Copolymer · Acrylates/Hydroxyesters Acrylates Copolymer | As FX-1 | As FX-1; IF `fixative_family: acrylate` | **Copolymer ≠ Crosspolymer**: every acrylates *cross*polymer is RH-1 (rheology). Acrylates Copolymer stays FX-2 even beside a neutraliser (Sodium Hydroxide, AMP): D7 names John Frieda Lockencreme Traumlocken (Acrylates Copolymer r2, NaOH r8) as having "a real fixative" | T1 (L5 phrase) · T3 (the five names) |
| **FX-3** | Fixative-class: polyurethane (LI L5) | Polyurethane-14 (usually declared with AMP-Acrylates Copolymer) | As FX-1 | As FX-1; IF `fixative_family: polyurethane` | Other Polyurethane-n are **not** members in v0.1 → FX-U (review) | T1 |
| **FX-4** | Fixative-class: the four vinyl families added by PH1-16 (Styling list only until the Leave-in addendum) | VA/Crotonates/Vinyl Neodecanoate Copolymer · VP/Dimethylaminoethylmethacrylate Copolymer (VP/DMAEMA) · Vinyl Caprolactam/VP/Dimethylaminoethyl Methacrylate Copolymer (VCap/VP/DMAEMA) · Butyl / Ethyl / Isopropyl Ester of PVM/MA Copolymer | As FX-1 | As FX-1; IF `fixative_family: vinyl_acetate` (VA/Crotonates) · `pvp_vp` (VP/DMAEMA, VCap) · `pvm_ma` (PVM/MA esters). **S0: a Styling route that rests only on an FX-4 member, where LI L5 would see no fixative, is a "both engines could claim" case (PH1-16, standard §4.6)** | Plain `PVM/MA Copolymer` (non-ester) is not FX-4; in a complex with PQ-28 it is HP-1. Cohort (node): `hold_route: present` rests on FX-4 alone in 3 records — `loreal-paris-elnett-haarspray-extra-starker-halt` (VA/Crotonates r3), `loreal-men-expert-barber-club-styling-pomade` (VP/DMAEMA r8), `schwarzkopf-taft-x-gliss-silky-shine-shine-coat` (VCap/VP/DMAEMA r5) | T1 (PH1-16) |
| **FX-R** | Film-forming quats: PQ-11, PQ-16, PQ-46 | Polyquaternium-11 · Polyquaternium-16 · Polyquaternium-46 | "A film-forming cationic polymer"; in Leave-in it is a conditioning quat (LI L1) | HR: `ambiguous` + review **when no FX member is above T_S** (PH1-6); D6/R2 counts it as cationic care (it is CA-3); WT counts it as a cationic-polymer family; BU (LI §7.6 `permanent_cationic`) | **Never fixative-class on its own** (PH1-6). Never triggers NF. Cohort: `alcina-styling-mousse-aerosol` (PQ-11 r5, its only film former) is the one `ambiguous` record | T1 |
| **FX-U** | Unsettled synthetic film formers | Acrylates Crosspolymer-3 · Polyacrylamide (LI §17.19 open gap) · Sodium Polystyrene Sulfonate · Acrylates/Stearyl Methacrylate Copolymer · **any** vinyl/acrylate/urethane copolymer not named in FX-1…FX-4 or RH-1 | "A possible film former; class unsettled" | HR `ambiguous` + review when it is the only candidate above T_S; never NF | Never credited as fixative-class until a lexicon bump names it. Cohort: Acrylates Crosspolymer-3 (`bali-curls-sleek-stick-brows-and-edges` r2) moves nothing because PVP r3 is present | T4 |
| **NF-1** | Natural film formers, settled | Hydrolyzed Corn Starch · Hydroxypropyl Starch · Distarch Phosphate · Chitosan · Acacia Senegal Gum (Gum Arabic, Acacia Senegal Gum Extract) | "A water-borne natural film (starch/chitosan/gum) that can set a shape" | RM `natural_film` (aqueous formulas only, §0.3); IF `fixative_family: natural_film`; D8b hold-mechanism set; JG | **Not "real hold" for D6** (D6 clarification) and **not a trigger for NF** (PH1-9): „Halt: keine Herstellerangabe" stands alone. Never a hold level | T1 (D6, PH1-9) · T3 (members) |
| **NF-U** | Natural film formers, unsettled | Carrageenan · Gellan Gum · unmodified starches (Solanum Tuberosum / Zea Mays / Tapioca / Oryza Sativa Starch) · Linum Usitatissimum (Flax) Seed Extract | As NF-1, but gelling/thickening is the likelier job | RM `natural_film` **with** a `natural_film_unsettled` review note (property set §2.3) | In a **non-aqueous** formula an unmodified starch is PT-2, not NF. Cohort: `bali-curls-strong-hold-flaxseed-gel` (Carrageenan r3), `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar` (Potato Starch r2) | T4 |
| **RH-1** | Rheology-only (LI L5 rheology exclusion; FS-25) | Carbomer · Xanthan Gum · Guar Gum (non-cationic) · Sclerotium Gum · Hydroxyethylcellulose and other cellulose ethers · Cellulose Gum · Acrylates/C10-30 Alkyl Acrylate Crosspolymer · Acrylates/Steareth-20 Methacrylate Crosspolymer · every other acrylates *cross*polymer except Acrylates Crosspolymer-3 (FX-U) · PEG-150/Decyl Alcohol/SMDI Copolymer · Hydroxypropyl Starch Phosphate | "Bottle viscosity / gel body" | Recorded E1 only | **Never a mechanism, never HR, never weight, never NF** (LI L5 exclusion). A gel's body is not its hold | T1 |

### 1B. Lipids, waxes, particulates, salts, silicones

| ID | Family | Normalised members (aliases) | Supported function | Consumed by | Never / false positives | Tier |
|---|---|---|---|---|---|---|
| **WL-1** | Waxes (structuring) | Cera Alba (Beeswax) · Candelilla Cera · Cera Carnauba (Copernicia Cerifera Cera) · Oryza Sativa (Rice) Bran Wax · Rhus Verniciflua Peel Cera · Lanolin Cera (Lanolin Wax) · Tribehenin · Hydrogenated Castor Oil · Hydrogenated Coconut Oil | "A solid wax network that holds shape and separates strands" | RM `wax_lipid` tagged **structuring**; D8b set; JG; WT family (b), **rich member**; BU (via WT) | PEG-n Beeswax is an emulsifier (EM-1), not WL-1 | T1 (rich list: PH1-2 via property set §2.5) · T3 |
| **WL-2** | Solid hydrocarbons (structuring) | Petrolatum · Paraffin · Cera Microcristallina (Microcrystalline Wax) · Ozokerite · Ceresin | As WL-1, occlusive | As WL-1 (structuring; rich) | „Pomade" in the name is not WL-2 | T1 · T3 |
| **WL-3** | Liquid / polymeric hydrocarbons | Paraffinum Liquidum (Mineral Oil) · Polybutene | "A persistent non-volatile lipid film" | RM `wax_lipid` (not structuring); WT family (b); Paraffinum Liquidum is a **rich** member (LI L3 "heavy mineral oil" — the grade is not INCI-readable, so every declared mineral oil reads rich) | Never structuring, so never a D8b hold mechanism (Taft Gel Wax rests on Mineral Oil r5 only) | T1 · T4 (Polybutene) |
| **WL-4** | Butters | Butyrospermum Parkii (Shea) Butter · Theobroma Cacao Seed Butter · Mangifera Indica Seed Butter | "A rich lipid deposit" | RM `wax_lipid` (not structuring); WT family (b), rich; R2 care (above T_LI) | „Mit Sheabutter" on a pack with Shea in the tail is a false signal (Mask lex §0.2) | T1 |
| **WL-5** | Lanolin and derivatives | Lanolin · Acetylated Lanolin Alcohol · (Lanolin Cera → WL-1) | "A rich, tacky lipid" | RM `wax_lipid`; WT family (b), rich (Mask R8 placement) | PEG-75 Lanolin is an emulsifier (EM-1) | T1 |
| **WL-6** | Plant oils | Rich band: Cocos Nucifera (Coconut) · Ricinus Communis (Castor) · Olea Europaea (Olive) · Persea Gratissima (Avocado) oils. Other band: every other declared *seed / kernel / fruit / nut / germ / bran* oil (Argan, Sunflower, Macadamia, Camelina, Apricot Kernel, Wheat Germ, Camellia, Canola, Safflower, Rice Bran, Rosa Canina, Jojoba) | "A persistent lipid film" | RM `wax_lipid`; WT family (a) (rich band = rich member); IF `oils`; R2 care **only above T_LI** (PH1-13); D6 "real care" (PH1-10) | **Essential oils are not WL-6**: peel, leaf, wood, bark and flower oils (Citrus, Eucalyptus, Cedrus, Pogostemon Cablin, Juniperus, Lavandula, Cananga, bergamot fruit oil) are fragrance materials — no mechanism, no `oils` flag. Ethoxylated oils (PEG-40 Hydrogenated Castor Oil, PEG-25 Hydrogenated Castor Oil) are EM-1. „Haaröl" in a name is not an oil | T1 (LI L3 rich band) · T3 |
| **WL-7** | Non-volatile esters and emollients | Isopropyl Myristate / Palmitate · Dicaprylyl Carbonate · Dicaprylyl Ether · C12-15 Alkyl Benzoate · Caprylic/Capric Triglyceride · Cetyl Ethylhexanoate · Ethylhexyl Stearate / Palmitate · Pentaerythrityl Tetraisostearate · Tridecyl Stearate · Tridecyl Trimellitate · Dipentaerythrityl Hexacaprylate/Hexacaprate · Diisopropyl Dimer Dilinoleate · Hydrogenated Ethylhexyl Olivate · Hydrogenated Olive Oil Unsaponifiables · Cetyl Acetate · Propylene Glycol Dicaprylate/Dicaprate · Isononyl Isononanoate · Hexyl Laurate · Isoamyl Laurate · Triheptanoin · Cetearyl Nonanoate · PCA Glyceryl Oleate · Coco-Caprylate · Oleyl Erucate | "A persistent emollient film; slip and shine" | RM `wax_lipid`; WT family (a); R2 care above T_LI | Dry-feel esters still count (LI WT: "a light/medium-band emollient" is a family). Never a rich member | T1 (LI L3) · T3 |
| **WL-8** | Fatty acids (soap structure) | Stearic Acid · Palmitic Acid · Hydroxystearic Acid | "Part of a wax/soap structuring system" (with AMP/NaOH) | RM `wax_lipid` tagged **structuring**; D8b set; JG | **Not a WT family** (an emulsifier/soap role; property set §2.5 families a–e). Not care for R2 | T4 |
| **PT-1** | Particulates | Silica · Silica Silylate · Kaolin and other clays (Bentonite, Montmorillonite) · Zeolite · Calcium Sodium Borosilicate · Nylon-12 · Cellulose (powder) | "Dry grip, matte volume, separation" | RM `particulate`; D8b set; JG; white-residue caution (property set §4) | „Clay"/„Fiber" in a name is not PT-1 (got2b Texture Clay has no clay). Mica and Titanium Dioxide are CO-1. Cellulose is a T4 placement | T3 · T4 (Cellulose) |
| **PT-2** | Starch powders | Aluminum Starch Octenylsuccinate · Corn Starch Modified · Oryza Sativa / Zea Mays / Tapioca / Potato Starch | "Oil-absorbing, matte powder" | RM `particulate` **only in a non-aqueous formula** (§0.3); in an aqueous formula an unmodified starch is NF-U | Starch powder plus refresh/oil-absorption positioning is the Dry Shampoo boundary (standard §4.3 step 3.2) — the formula never decides it | T3 |
| **SA-1** | Salt mechanism | Maris Sal (Sea Salt) · Magnesium Sulfate | "Salt crystals give grip and beachy texture" | RM `salt`; D8b set; JG; IF `salt`; salt caution (property set §4) | **Not "real hold" for D6** (D6 clarification). Never a hold level | T1 (D6) · T3 |
| **SA-2** | Process salts | Sodium Chloride | Rheology / process electrolyte | IF `salt` only („ohne Salz" is a consumer reading) | **Never RM `salt`** (property set §2.3, mirrors the L5 rheology exclusion). Cohort: `bali-curls-strong-hold-flaxseed-gel` Sodium Chloride r7 ⇒ flag yes, mechanism no | T1 |
| **SI-1** | Persistent silicones | Dimethicone · Dimethiconol · Phenyl Trimethicone · Trimethylsiloxyphenyl Dimethicone · Amodimethicone · Bis-Aminopropyl Dimethicone · Bis-Cetearyl Amodimethicone · Silicone Quaternium-18 · **Polysilicone-29** | "A persistent silicone surface film (slip, sleekness, shine)" | RM `silicone_coat`; WT family (d); IF `silicones`; R2 care: plain silicones above T_LI; amino silicones and silicone quats are also CA-4 | **Polysilicone-29 is never fixative-class** (LI L5 placement): alone it gives `hold_route: absent`. Its "heat-activated" marketing (Color Wow, C3 „wärmeaktiviertes Polymer") is a claim, not an E2 read (standard §6.13) | T1 |
| **SI-2** | PEG/PPG-modified silicones | Any `PEG-n` / `PEG/PPG-x/y` / `Cetyl PEG/PPG` **Dimethicone**; Dimethicone PEG-7 Phosphate | Water-dispersible, easily removed (LI §7.6) | IF `silicones` only | Never RM `silicone_coat`, never WT. `PEG/PPG-15/15 Allyl Ether Acetate` is **not** a silicone | T1 |
| **SI-3** | Volatile silicones | Cyclopentasiloxane · Cyclohexasiloxane · Trisiloxane · Disiloxane | Carrier, evaporates (LI L2) | IF `silicones`; no mechanism, no WT | "Volatile ⇒ no residue" is FS-4. Rules key on function, not on D5 (LI G12, FS-21) | T1 |
| **SI-4** | Other silicone-family tokens | Polysilicone-15 (a UV filter) · Bis-(Morpholinomethyl C1-4 Dialkoxysiloxy) Dimethicone · silanetriols (Hydrolyzed … PG-Propyl Silanetriol) | Polysilicone-15: UV filter. Silanes: LI L6 surface-film candidate | IF `silicones`; no Styling mechanism in v0.1 | Polysilicone-15 is never a coat or a heat polymer. A silane is never a heat protectant (FS-7) | T1 (L6) · T3 |

### 1C. Cationics, fatty alcohols, humectants, carriers

| ID | Family | Normalised members (aliases) | Supported function | Consumed by | Never / false positives | Tier |
|---|---|---|---|---|---|---|
| **CA-1** | Monomeric cationic surfactants | Cetrimonium Chloride · Behentrimonium Chloride / Methosulfate · Steartrimonium Chloride · Distearoylethyl Hydroxyethylmonium Methosulfate · Hydroxypropyl Bisstearyldimonium Chloride · Laurtrimonium Chloride · Cocamidopropyl PG-Dimonium Chloride Phosphate · Brassicyl Isoleucinate Esylate · Quaternium-80 (silicone-functional, LI §7.6) | "A leave-on cationic conditioning route" (LI L1) | WT: a CA-1/CA-2 **and** an FA-1 above T_S form the LI **LGN pair** (WT `rich` row); R2 care (may sit below T_LI down to the yardstick, PH1-13); D7 "substantive conditioning" input (via LI COND, never via R2); BU (Quaternium-80 only, as silicone-functional) | **Not a WT family on its own** (LI WT counts the cationic-*polymer* film; monomeric quats enter WT only through the LGN pair). **Opaque `Quaternium-n` numbers are not members** — `quat_structure: unresolved`, never promoted, never an LGN partner, review (LI §7.6): Quaternium-95 (`maria-nila-curlicue-cream` r11). Benzalkonium / Benzethonium Chloride are preservatives (PR-1), not conditioners | T1 |
| **CA-2** | Amidoamines | Stearamidopropyl Dimethylamine · Behenamidopropyl Dimethylamine · Brassicamidopropyl Dimethylamine | As CA-1 (acid-activated) | As CA-1 | An accompanying Lactic/Citric Acid is its neutraliser (Mask lex §1), not an active | T1 |
| **CA-3** | Cationic polymers | Any declared Polyquaternium-n (incl. FX-R) · Guar Hydroxypropyltrimonium Chloride · Hydroxypropyl Guar Hydroxypropyltrimonium Chloride · Acrylamidopropyltrimonium Chloride/Acrylamide Copolymer · Starch/Cellulose Hydroxypropyltrimonium Chloride | "A substantive cationic-polymer film" | WT family (e); BU limb 1 (`permanent_cationic`, LI §7.6) above T_S; R2 care; D7 input via LI COND | Never fixative-class (FX-R rule). "Silicone-free + cationic polymer = low buildup" is FS-20 | T1 |
| **CA-4** | Amino silicones and silicone quats | Amodimethicone · Bis-Aminopropyl Dimethicone · Bis-Cetearyl Amodimethicone · Silicone Quaternium-n | Cationic silicone film | SI-1 roles plus R2's cationic dose rule; Silicone Quaternium-n is BU `permanent_cationic` | — | T1 |
| **CA-5** | Cationised proteins | Hydroxypropyltrimonium / Laurdimonium Hydroxypropyl Hydrolyzed *x* Protein | Substantive protein film (LI L6) | BU `permanent_cationic`; R2 care | **Not HP-1**: only plain `Hydrolyzed Wheat Protein` is an L9 member | T1 |
| **FA-1** | Fatty alcohols | Cetyl · Cetearyl · Stearyl · Behenyl · Myristyl · Lauryl · Oleyl · Arachidyl · Brassica Alcohol · C12-15 / C14-22 Alcohols | Structurant + emollient | WT family (c); LGN partner with CA-1/CA-2; R2 care **only above T_LI** | **Never drying alcohols** — never fire the PH1-3 note (Mask lex §2). `Cetyl Esters` / `Cetyl Acetate` are WL-7 | T1 |
| **HU-1** | Humectants and plasticising polyols | Glycerin · Propanediol · Propylene Glycol · Butylene / Pentylene Glycol · Methylpropanediol · Sorbitol · Xylitol · Lactitol · Sucrose · Glucose · Hydrogenated Starch Hydrolysate · Maltodextrin · Betaine · Sodium PCA / PCA · Sodium Lactate · Panthenol · PEG-8 · PEG-32 | "Water association, film plasticising" (LI L4) | RM `humectant_only` (only when nothing else is above T_S) | **Never care for D6** (PH1-13). **Never anti-frizz or humidity resistance** (FS-6, FS-15). Never a hold mechanism | T1 |
| **SO-1** | Solvent glycols | Dipropylene Glycol | Solvent (Mask E15) | Nothing | Not a humectant leg | T1 |
| **PL-1** | Fixative plasticisers | Triethyl Citrate · Acetyl Triethyl Citrate · Propylene Glycol Dibenzoate | "Softens a fixative film" | Recorded E1 only | Not a WT family, not a lipid. Cohort (node): present in 6 Styling records, above T_S in 5; no value moves on the placement | T4 |
| **EM-1** | Emulsifiers and solubilisers | PEG-n (castor, stearate, hydrogenated castor oil, lanolin, beeswax) · Ceteth-n · Ceteareth-n · Oleth-n · Laureth-n · Steareth-n · Trideceth-n · Isoceteth-n · PPG-n-Ceteth-n · Polysorbate n · Polyglyceryl-n esters · Glyceryl Stearate · Sorbitan esters · Sucrose (Di)stearate · Methyl Glucose Sesquistearate · Glycol (Di)stearate · Cocamidopropyl Betaine · Coco-Betaine · alkyl glucosides · Sodium Cetearyl Sulfate · Dicetyl / Ceteth-10 Phosphate | Emulsify, solubilise | Nothing (E1 only) | Never a lipid family, never care, never weight (property set §2.3 "never a mechanism") | T1 |
| **AL-1** | Short-chain alcohols — PH1-3 trigger | Alcohol · Alcohol Denat. · SD Alcohol n (e.g. SD Alcohol 40-B) · Ethanol · Isopropyl Alcohol | Volatile carrier and solvent | **AN: fires when any AL-1 member is among the first 3 declared ingredients** (water and propellants counted); no mechanism, no WT | Never an exclusion, never "damages hair" (charter §10). Retailer „ohne Alkohol" chips never override it (`alverde-beach-waves-spray-seaside-balance`: Alcohol denat. r3). Cohort (node): fires on 28 of 70 | T1 (PH1-3) |
| **AL-X** | Alcohol-named non-triggers | Fatty alcohols (FA-1) · Benzyl Alcohol (PR-1) · Phenylpropanol (PR-2) · Anise Alcohol (fragrance) · n-Butyl Alcohol (solvent, recorded as an observation) | — | Nothing for AN | **Never fire the PH1-3 note** | T1 |
| **VC-1** | Propellants | Butane · Propane · Isobutane · Dimethyl Ether · Nitrogen | Aerosol carrier | IF `propellant`; counted in AN's "first 3" | Never a mechanism, never WT | T1 |
| **VC-2** | Volatile hydrocarbons | Isododecane · Isohexadecane · C11-13 / C13-14 Isoparaffin · Undecane · Tridecane | Dry-down carrier (LI L2/L3) | Nothing (zero weight and persistence, LI M6) | "Isododecane = oil" is false; Balea Sea Salt Care & Define's Isododecane r2 is not care (care-vs-trace §3a) | T1 |

### 1D. Tail classes, pH adjusters, heat polymers, never-care tokens

| ID | Family | Normalised members (aliases) | Supported function | Consumed by | Never / false positives | Tier |
|---|---|---|---|---|---|---|
| **PR-1** | Preservatives | Phenoxyethanol · Sodium Benzoate · Potassium Sorbate · Potassium Benzoate · Benzoic Acid · Sorbic Acid · Benzyl Alcohol · Dehydroacetic Acid / Sodium Dehydroacetate · Chlorphenesin · DMDM Hydantoin · Diazolidinyl Urea · Sodium Hydroxymethylglycinate · Iodopropynyl Butylcarbamate · Methyl-/Ethyl-/Propyl-/Butylparaben · Methylisothiazolinone / Methylchloroisothiazolinone · Benzalkonium Chloride · Benzethonium Chloride · Salicylic Acid · Formic Acid · Piroctone Olamine · Hydroxyacetophenone · Levulinic Acid / Sodium Levulinate · Sodium Anisate · Leuconostoc/Radish Root Ferment Filtrate | Preservation | MK: T_S class (c); T_LI (LI list + other Annex V) | No care, no mechanism. Hydroxyacetophenone and Levulinic Acid/Levulinate are T_S members by LI precedent although they are not Annex V; natural preservation systems are dosed nearer 1–3 % (care-vs-trace §1), so a T_S on them produces more `candidate_below_tail` notes (open item §5.3) | T1 (Mask/LI lists) · T2 (Annex V) · T4 (Sodium Anisate) |
| **PR-2** | Preservative boosters | Ethylhexylglycerin · Caprylyl Glycol · 1,2-Hexanediol · Glyceryl Caprylate · Caprylhydroxamic Acid · Phenylpropanol · Glyceryl Undecylenate | Boost preservation | MK: T_S class (d) only **when a PR-1 is declared on the list**; T_LI: Ethylhexylglycerin outright, Caprylyl Glycol in a pair (LI list) | Not humectants (Mask lex §0.2). A booster set as T_S **above every PR-1** fires the Mask third limb ⇒ `unresolved` | T1 |
| **FR-1** | Fragrance | Parfum · Fragrance · Aroma | Scent | MK T_S class (a); IF `fragrance` | „Parfumfrei" chips never override it | T1 |
| **FR-2** | Declared allergens and named aroma chemicals | EU Annex III allergens (Limonene, Linalool, Citronellol, Geraniol, Citral, Coumarin, Hexyl Cinnamal, Benzyl Salicylate / Benzoate, Alpha-Isomethyl Ionone, Eugenol, Hydroxycitronellal, Amyl Cinnamal, …) and named synthetic aroma chemicals (Tetramethyl Acetyloctahydronaphthalenes, Hexamethylindanopyran, …) | Scent | MK T_S class (b) only | **Never T_LI** (LI T17). An allergen chosen as T_S above its own Parfum ⇒ `unresolved` (Mask E2) | T1 |
| **CH-1** | Trace chelators | Disodium / Tetrasodium EDTA · EDTA · Tetrasodium Glutamate Diacetate · Trisodium Ethylenediamine Disuccinate · Etidronic Acid · Phytic Acid / Sodium Phytate | Chelation | MK T_S class (e) only | Never T_LI. No care | T1 |
| **PH-1** | pH adjusters, neutralisers, buffers | Citric · Lactic · Glycolic · Phosphoric Acid · Sodium Hydroxide · Aminomethyl Propanol (AMP) · Triethanolamine · Tetrahydroxypropyl Ethylenediamine · Sodium Citrate · Sodium Lactate · Sodium Bicarbonate · Arginine · Disodium / Sodium / Potassium Phosphate | pH; neutralise fixatives and carbomer | **R2 yardstick**: the first PH-1 member listed after T_LI bounds how far below T_LI a cationic may sit and still count as care (PH1-13; fallback `Parfum`; no yardstick ⇒ review) | **Never a marker** (Mask §3.1; LI clause 6 (d)). Never a care or acid-gloss property. „pH-balanced" is FS-27 | T1 |
| **HP-1** | Evidenced heat-protection polymers (LI L9, **closed**) | VP/Acrylates/Lauryl Methacrylate Copolymer · Polyquaternium-55 · PVM/MA Copolymer + Polyquaternium-28 (complex) · PVP/DMAPA Acrylates Copolymer · Quaternium-70 · Hydrolyzed Wheat Protein | Published thermal-protection data (Zhou 2011; McMullen & Jachowicz 1998) | HEAT: `provides_heat_protection: true` needs a C1/C2 heat claim **and** an HP-1 member above **T_S** (PH1-15; marker = T_S, PH2-4) | **Closed.** Generic silicones, Polysilicone-29, generic or cationised proteins, panthenol and oils are never HP-1 (FS-7, FS-24). Adding a member is a semantic lexicon bump (LI §13.3) | T1 · T2 |
| **CO-1** | Colourants and opacifiers | CI nnnnn · Mica · Titanium Dioxide · Iron Oxides · Caramel | Colour / opacity | Recorded E1 only | Never a marker (Mask R8), never a particulate mechanism | T1 |
| **NC-1** | Never-care, never-mechanism tokens | Plant extracts and juices (Aloe Barbadensis Leaf Juice, …) · vitamins (Niacinamide, Tocopherol, Pyridoxine) · free amino acids · non-cationised hydrolysed proteins (except HP-1's one) · UV filters (Benzophenone-4, Ethylhexyl Methoxycinnamate, Polysilicone-15) · antioxidants (BHT, Pentaerythrityl Tetra-Di-T-Butyl Hydroxyhydrocinnamate) · Cyclodextrin | Claim ingredients, stabilisers | Recorded E1 only | **Never care for D6** (PH1-13: "humectants, panthenol, proteins, extracts, starch and volatile carriers never count"). A hero ingredient in the tail is a false signal | T1 |

---

## 2. Consumer index (which families each property or rule reads)

| Property / rule | Reads | Marker |
|---|---|---|
| S0 LI G0 architecture half (T15) | FX-1, FX-2, FX-3 (LI L5) — plus FX-4 on the Styling side (PH1-16); RH-1 exclusion; conditioning via LI COND (CA-1…CA-5, FA-1, WL-*, SI-1) | T_LI |
| S0 D6 "real hold" | FX-1…FX-4 above T_LI (FX-R and FX-U are not real hold; NF, PT, SA never) | T_LI |
| S0 D6 "real care" (PH1-13 R2) | WL-2…WL-7, SI-1, FA-1 above T_LI; CA-1…CA-5 (incl. FX-R) above the PH-1 yardstick | T_LI + PH-1 |
| S0 D7 middle band | FX-1…FX-4 above T_LI **and** LI COND not thin (never R2) | T_LI |
| `result_mechanisms` | FX-1…4, NF-1/NF-U, WL-1…WL-8, PT-1/PT-2, SA-1, SI-1, HU-1 | T_S |
| `hold_route` | FX-1…4 (present); FX-R, FX-U (ambiguous) | T_S |
| `weight` (LI WT; PH2-8: the exact LI rule incl. the LGN pair, no anhydrous route) | families (a) WL-6, WL-7 · (b) WL-1…WL-5 · (c) FA-1 · (d) SI-1 · (e) CA-3 and the polymeric CA-4; LGN pair CA-1/CA-2 + FA-1; rich members = WL-1, WL-2, Paraffinum Liquidum, WL-4, WL-5, the WL-6 rich band | T_S |
| Buildup note (LI §8.5; PH2-5) | CA-3, silicone quats (CA-4), CA-5, Quaternium-80 above T_S (limb 1: the **LI §7.6 persistence enumeration** read internally, only to feed the note, no stored PERS field); `weight: rich` (limb 2) | T_S |
| Alcohol note (PH1-3) | AL-1 in the first 3 | none (rank ≤ 3) |
| `ingredient_flags` | SI-1…SI-4; WL-3 mineral oil, WL-4, WL-6 (oils); FR-1; SA-1/SA-2; VC-1; fixative families | whole list (`fixative_family[]`: above T_S) |
| Neutral fact (PH1-9) | FX-1…FX-4 above T_S | T_S |
| `provides_heat_protection` (PH1-15, PH2-4) | HP-1 | T_S (PH2-4) |
| D8b hold-mechanism set | HR present/ambiguous, NF-1/NF-U, PT-1/PT-2, SA-1, structuring WL-1/WL-2/WL-8 | T_S |
| Job-formula gate | RM values | T_S |

---

## 3. Cross-family false-positive register

| Reading | Why it is wrong | Correct reading |
|---|---|---|
| A thick gel ⇒ strong hold | Carbomer/xanthan make bottle body (RH-1, FS-25) | Hold route only from FX-1…FX-4 |
| PQ-11 in a mousse ⇒ fixative | PH1-6 | FX-R ⇒ `ambiguous` + review when alone |
| Starch / salt / silica ⇒ "real hold" for D6 | D6 clarification | Mechanisms (NF/SA/PT), never D6 hold |
| Polysilicone-29 ⇒ hold polymer or heat polymer | LI L5 placement; L9 closed | SI-1 coat only |
| Hydrolysed protein ⇒ heat protection | Only plain Hydrolyzed Wheat Protein is HP-1, and only above the marker with a C1/C2 claim | HP-1 rule |
| Cetearyl / Stearyl / Behenyl Alcohol ⇒ drying alcohol | Fatty alcohols (FA-1) | Never the PH1-3 note |
| Isododecane / propellant ⇒ oil or weight | Volatile (VC) | Zero weight |
| Lactic / Citric Acid beside an amidoamine ⇒ active | Neutraliser (PH-1) | R2 yardstick only |
| „Mit Arganöl" / „mit Sheabutter" on the pack | Tail position decides (T_S) | `candidate_below_tail` only where it would move a value |
| „Gel Wax" ⇒ wax; „Texture Clay" ⇒ clay; „Fiber" ⇒ fibre | Names are never aliases (§0.4) | Read the INCI: Taft Gel Wax = Mineral Oil r5 lipid only; got2b Texture Clay = VP/VA r3 + Rhus wax r2, no clay |
| „Haaröl" / „Serum" in a name ⇒ an oil formula | D2 routes by name to Oil; the lexicon never reads names | Identity data for S0 step 3.1 only |
| Retailer chip „ohne Alkohol" / „silikonfrei" | C3 trace (LI §2.4.1) | INCI governs: alverde Beach Waves Alcohol denat. r3; Color Wow Polysilicone-29 r3 |

---

## 4. Cohort coverage (node, 70 Styling records)

| Family | Records with a member anywhere | … above T_S |
|---|---|---|
| FX-1…FX-3 (LI L5) | 36 | 36 |
| FX-4 (PH1-16 vinyl) | 8 | 6 |
| FX-R (PQ-11/-16/-46) | 6 | 4 |
| FX-U | 4 | 3 |
| NF-1 / NF-U | 9 / 6 | 8 / 4 |
| RH-1 | 16 | 7 |
| WL-1 + WL-8 (structuring) | 10 | 10 |
| WL-2/WL-3 hydrocarbons | 7 | 7 |
| WL-6 plant oils | 16 | 10 |
| WL-7 esters | 23 | 21 |
| FA-1 | 16 | 11 |
| SI-1 | 10 | 6 |
| CA-1 / CA-3 | 13 / 15 | 9 / 10 |
| PT-1 / PT-2 | 12 / 4 | 11 / 4 |
| SA-1 | 7 | 5 |
| AL-1 (any rank / first 3) | 33 | 28 in the first 3 |
| VC-1 propellants | 23 | 23 |
| HP-1 | 3 | 1 (`garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`, Hydrolyzed Wheat Protein r12) |

**Uncalibrated entries (no cohort member):** SI-3 volatile silicones; CA-5 in a Styling-routed record; WL-2 Ozokerite/Ceresin; HP-1 Polyquaternium-55, Quaternium-70, VP/Acrylates/Lauryl Methacrylate; FX-3 beyond Polyurethane-14; PT-1 Bentonite. They are ruled or inherited, but no Styling record has tested them.

---

## 5. Open items and weak evidence

1. **FX-2 enumeration is trade knowledge (T3).** The five acrylate fixatives close LI L5's open phrase; D7 confirms one case (Acrylates Copolymer beside NaOH). Any new acrylate copolymer name lands in FX-U until a lexicon bump.
2. **NF-U and Cellulose (PT-1) are T4.** Whether carrageenan, gellan, unmodified starch or flax extract form a styling film in a given gel is not INCI-readable; every such credit carries `natural_film_unsettled` and goes to review.
3. **Natural preservation systems as T_S.** Levulinic Acid / Sodium Levulinate and Hydroxyacetophenone set T_S by LI precedent, but they are dosed nearer 1–3 % (care-vs-trace §1). On naturkosmetik lists this puts real lipids below the marker (`alverde-locken-refresh-spray`: Levulinic Acid r6; oils r12–r16 and the Brassicyl Isoleucinate Esylate r17 + Brassica Alcohol r21 pair are tail). The record carries `candidate_below_tail` and goes to review; no rule changes on one product.
4. **Essential oils are not marker-eligible in v0.1.** A list whose first scent material is an essential oil keeps the next eligible marker.
5. **Opaque quats** (Quaternium-95) stay unresolved until a supplier identity is documented; they never form an LGN pair (LI §7.6).
6. **HP-1 is mechanism evidence on model systems**, not product evidence (LI §5 L9 rule 4). A `true` heat binary is a recommendation-policy outcome under PH1-15 (read against T_S, PH2-4), never an efficacy statement.
7. **Rich-member list — resolved by PH2-12.** WL-1, WL-2, Paraffinum Liquidum, WL-4, WL-5 and the WL-6 rich band are the Styling rich members (waxes, paraffin, microcrystalline wax and lanolin are a Styling-local addition to the LI L3 rich band; they move into the Leave-in addendum after lock).

## 6. Source register

- Owner rulings: `plans/styling-concept/02-rulings.md` (D6 clarification, PH1-1, PH1-3, PH1-6, PH1-9, PH1-13, PH1-15, PH1-16, PH2-4, PH2-5, PH2-8, PH2-9).
- LI v1.0: §3.1 ladder, §3.1.1 marker and clauses 5–6, §5 L1–L9 (L5 list and rheology exclusion, Polysilicone-29 placement, L9 closed list), §7.5 WT, §7.6 PERS, §8.5 buildup, §12 false signals.
- Mask v1.0 / lexicon v0.2: §3.1 tail classes, §3.1.1 E2/E13, R8 colourant precedence, booster pair rule, E15 solvent glycols.
- Care-vs-trace evidence (dose classes, pH yardstick): `data/research/styling-inci/concept-v0/round2/care-vs-trace-rule.md` §1 (EU Annex V; Reg. (EU) 866/2014; CIR; supplier sheets).
- Hold evidence (why no family sets strength): `round2/hold-research-ingredients.md`, `round2/hold-research-community.md`.
- Heat: Zhou et al., *J Cosmet Sci* 2011;62(2):265–282; McMullen & Jachowicz, *J Cosmet Sci* 1998;49(4):245–256 (via LI §13.1).

## 7. Change control

- **Patch (v0.1.x):** a new alias or transcription repair for an existing member; a new member of a non-deterministic family (WL-7, EM-1, NC-1). Re-run the deterministic F properties on the frozen cohort and record any moved value.
- **Semantic bump (v0.2):** any change to FX-1…FX-4, FX-R, RH-1, HP-1, AL-1, the marker classes (PR-1/PR-2/FR-2/CH-1) or the rich-member list. Every record whose value reads the changed family is re-derived, never patched (Mask rerun obligation).
- After the Styling v1.0 lock, FX-4 moves into the Leave-in addendum (PH1-16); this file then cites the shared list instead of holding its own.
