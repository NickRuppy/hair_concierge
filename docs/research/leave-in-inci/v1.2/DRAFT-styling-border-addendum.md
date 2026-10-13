# Leave-In Research and Classification Standard — Styling-border addendum (DRAFT overlay)

Status: **DRAFT — not in force; queued for after Styling v1.0 lock (PH1-16); every product move needs owner approval.**
Proposed document version: `v1.2` · proposed engine version: `leave-in-inci-v1.2` (both open, §6 item O-10)
Base: **Standard v1.1** = Standard v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`, sha256 `7ae5e882d9cba3e3fccdea3623d056efe802ff3bc3adbe554112e471da551ace`, 421855 bytes) + the T20 overlay (`docs/research/leave-in-inci/v1.1/leave-in-classification-overlay.v1.1.md`, sha256 `9c1340357b4c0cf38933340f4592250d10f2cccc1429b0e4d46508d47eee032b`, 21091 bytes). **Both byte-identical, not edited.**
Mirrors (owner rulings, not new rules): `plans/styling-concept/02-rulings.md` (sha256 `5d1d3a6f4809734436448ea7e8b8cc856a1d8047b6c358aaa12230919e247e68` at drafting) — D3, D6, D7, PH1-6, PH1-10, PH1-12, PH1-13, PH1-14, PH1-16, PH2-1, PH2-2, PH2-3, PH2-12, R1-Q2, R1-T (RG-16), R1-H3, R2-Q1, R2-H2, R3-Q4, R3-H2, R3-H3, R3-H4(e), R3-T (RG3-19, RG3-21). Styling-side wording: `docs/research/styling-inci/v1.0/styling-classification-standard.md` v0.4 as committed at `6c1e2b6c` (an uncommitted working-copy amendment folding R3-H2…R3-H4 was in progress in this worktree while this draft was written; it agrees with the ledger readings used here), lexicon `02_evidence_lexicon.v0.4.md` (sha256 `24216f16…`). Where the Styling standard and the ledger differ, **the ledger governs**, as it does for Styling.
Scope: the Leave-in ↔ Styling border only — G0 (§2.1–§2.3.2), the L5 fixative enumeration (§5), the Polysilicone-9 placement, the WT rich-member list (§5 L3, §7.5), and the dual-use directions clause for care creams (§2.4 rule 2).
Companion: `DRAFT-styling-border-affected-products.md` (this folder) — every product the addendum would move or newly classify.
Drafted: 2026-10-13. Not reviewed, not calibrated, not approved.

**Location.** The Leave-in standard has an overlay convention (README, „Versioning note"; the T20 overlay): `v1.0/` is byte-frozen and hash-pinned, and a policy change lands as an overlay in a **sibling version root** (`v1.1/` for T20). This draft therefore sits in `docs/research/leave-in-inci/v1.2/`, not in `v1.0/addenda/`. On approval it is renamed `leave-in-classification-overlay.v1.2.md` and gets its lock receipt and manifest under `data/research/leave-in-inci/v1.2/`.

---

## 0. How to read this overlay

Standard v1.2 would be **Standard v1.1 plus this file**. Where an amendment speaks, it **replaces or extends** the named v1.0/v1.1 text; everything it does not name stays exactly as v1.1 states it. Until the owner approves this draft, **v1.1 governs**, and every product both engines could claim stays held on the Styling side as `provisional_boundary (pending_leave_in_addendum)`, profiled but not matchable (PH1-16, PH2-2).

**What the addendum does.** The Styling owner rulings moved the Leave-in ↔ Styling border. PH1-16 kept the locked Leave-in letter unchanged and parked those border rules in the Styling standard's own lists. This addendum writes the same rules into Leave-in wording, so that both engines read **one** border: a product the Styling S0 routes to Styling is excluded at Leave-in G0, and a product Styling routes to Leave-in is still claimed here. It adds no rule the Styling rulings did not decide. Where the Leave-in wording of a Styling rule is not settled by the rulings, the point is listed in §6 instead of being decided.

**Approval protocol (PH1-16).**
1. Styling v1.0 locks (Styling §14.1 criterion (e) needs this draft to exist and be queued).
2. The owner reads the amendments and the §6 open items.
3. The owner reads every **already-ruled Leave-in product** that would move (companion file, part A). On today's corpus that list is empty: 29 ruled Leave-in products were checked, none moves.
4. On approval: rename to `leave-in-classification-overlay.v1.2.md`; write `data/research/leave-in-inci/v1.2/` (lock receipt, manifest; README row); the Styling lexicon cites the Leave-in L5 list instead of holding FX-4 itself (lexicon §7); the held Styling records are released (PH2-2). Approval of this text authorises no catalog, Supabase, matcher or Product Intake change.

**Amendment format.** Each amendment states the Styling ruling it mirrors, the Leave-in section it overlays, the new text (normative register), a worked example from frozen data, and the direction it fails in under LI §1.1.

**Tail markers.** „Above T_LI" means above the Leave-in marker of LI §3.1.1 (clauses 1–6 unchanged). Styling's own marker T_S (the Mask rule: preservative, perfume, declared allergens, boosters in a pair, chelators) appears in this file only where a ruling names it (A3/A4 limb 1, R3-H4(e)).

**Destination labels.** A product this addendum excludes is not Leave-in-claimable. Which G0 state label it carries is open (§6 O-1). The draft writes **„excluded (Styling)"** and records a `g0_basis` tag; the §2.3.1 emission contract for excluded records applies unchanged (identity block, rationale, formula record; no lean profile).

---

## 1. Amendments

### A1 — The function condition reads the C1/C2 lead promise (border scope)

- **Mirrors:** PH2-1 (the Leave-in border check applies only where the promise overlaps LI §2.1); R1-Q2 (anti-frizz on dry, finished hair is the shine-finish job); RG3-19 (R3-T: the Leave-in-function tag reads the lead promise only).
- **Overlays:** LI §2.1 (working definition: „primary or co-primary function"), LI §2.3 G0 table, `in_category` row („conditioning/detangling/smoothing/curl/heat-styling support is primary or co-primary").
- **New text (adds §2.3-A1):**

> **§2.3-A1 Function condition.** For the `in_category` row, whether a Leave-in function is primary or co-primary is read from the product's **C1/C2 lead promise**: the job word of the confirmed C1/C2 name when it names exactly one job; else the first C1 pack-front line that states a job; else the first C2 line that states a job (Styling §4.2 lead order). Later lines never set it (RG3-19).
>
> (a) The lead promise states a Leave-in function — conditioning/care, detangling, smoothing/anti-frizz, curl support (definition **or** revival of curls/waves), blow-dry or heat-styling support ⇒ G0 runs in full, including A2–A4 and §2.3.2.
>
> (b) The lead promise states **only** volume, hold, texture, shaping/molding or shine ⇒ the product is **not Leave-in-claimable**, whatever conditioning the formula carries: G0 = excluded (Styling), `g0_basis: promise_outside_leave_in_function`. No T15, A2, A3 or A4 test runs.
>
> (c) Anti-frizz or flyaway control promised for **dry, finished hair**, by the product's **main** directions, is the shine-finish job ⇒ (b). A side tip („bei krausem Haar vorher ins handtuchtrockene Haar") does not change the main directions. Anti-frizz promised for damp hair, or sold as care, stays (a).
>
> (d) Where no C1/C2 promise exists, (b) cannot be established; G0 runs on the v1.1 letter (§6 O-3).

- **Worked example.** `balea-foehnlotion-volume-effect` (Balea Föhnlotion Volume Effect): Aqua leads, no L5 member, C2 volume promise ⇒ (b) ⇒ excluded (Styling), `blowdry_lotion`. `balea-styling-finishing-stick`: C1 pack directions „Nach dem Frisurenstyling sanft über die abstehenden Härchen streichen" ⇒ flyaway control on dry, finished hair ⇒ (c) ⇒ excluded (Styling), `shine_finish`. Counter-example: `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` („Leave-In Spray … Glättungsspray": smoothing is a Leave-in function ⇒ (a); argan r6 + SAPDMA r7 = care, no fixative ⇒ `in_category`, as PH2-1 named).
- **Fails toward:** exclusion of a product whose own C1/C2 promise names no Leave-in job. It never creates a Leave-in claim; with no C1/C2 promise it changes nothing (d).

### A2 — The D6 exception: a styling-look product with neither real care nor real hold

- **Mirrors:** D6 (+ its 2026-10-09 clarification: „real hold" = fixative-class polymer, LI L5 / HOLD sense); PH1-10 (oils count as care); PH1-13 (effective-amount test, D6 border only); PH2-3 (any format); R1-H3 (Polysilicone-9 leaves the hold limb unresolved); R2-Q1 (curl revival is refresh, a styling look).
- **Overlays:** LI §2.3 G0 table (adds an exclusion that runs on an `in_category` result); LI §2.2 boundary table, „Exclude" row „Styling-first gels, mousses, hairsprays, waxes, clays and strong-hold creams" (extended by this exception).
- **New text (adds §2.3-A2):**

> **§2.3-A2 D6 exception.** A product G0 would place `in_category` (including T15 `incidental_film`) is **excluded (Styling)**, `g0_basis: d6_styling_look_without_care_or_hold`, when all three limbs hold:
>
> 1. **No real hold:** no L5 member (as amended by A5) above T_LI. Film-forming quats (PQ-11/-16/-46/-69, A7), natural films (starches, carrageenan, gums), salts, particles and Polysilicone-29 are not real hold. **Unresolved:** a generic `Acrylates Copolymer` whose fixative role is not corroborated (§6 O-4) or Polysilicone-9 (A6) above T_LI leaves the limb unresolved ⇒ the exception neither fires nor is excluded ⇒ `provisional_boundary` + review (`acrylates_copolymer_function_unresolved` / `hair_fixing_silicone_unresolved`).
> 2. **No real care, by the effective-amount rule:** oils (any spreading band), esters, butters/hydrocarbons, plain silicones and fatty alcohols count **only above T_LI**; cationic conditioners, cationic polymers (incl. PQ-11/-16/-46/-69) and amino silicones count above T_LI **or** below it down to — not including — the first pH adjuster listed after T_LI (fallback `Parfum`; no yardstick ⇒ review `care_yardstick_missing`). Humectants, panthenol, proteins, extracts, starch and volatile carriers never count. Care decided below T_LI carries `care_decided_below_preservative`; a cationic below the yardstick carries `care_below_dose_yardstick`. „Real care" is **any** care (a detangling spray counts). This test is **not** COND and is **never** the T15 „thin conditioning" test.
> 3. **A C1/C2 styling-look promise:** curl or wave definition, curl revival (refresh), a beach/texture look, hold.
>
> Format never decides: the exception applies to sprays, gels, creams and every other form.

- **Worked example.** `balea-locken-revitalizing-spray`: Aqua r1, Glycerin r2, Nitrogen r3, T_LI Sodium Benzoate r4; Cocos Nucifera Oil r13 and Shea Butter r14 below T_LI; no cationic; house-brand C2 lead „Locken Revitalizing" (revival) ⇒ limbs 1–3 hold ⇒ excluded (Styling), `refresher`. Format case: `balea-locken-crunchgel` (Hydrolyzed Corn Starch gel, no fixative, no care above T_LI Potassium Sorbate r8, „Haargel für definierte Locken") ⇒ excluded (Styling), `gel`. Yardstick case: `redken-refreshing-curl-mist` (Polyquaternium-6 r7 sits below the first pH adjuster Citric Acid r5 after T_LI Phenoxyethanol r4; jojoba r11 / squalane r12 below T_LI) ⇒ no real care ⇒ excluded (Styling), `refresher`. Counter-examples that stay Leave-in: `balea-professional-definier-spray-traumlocken` (oils above T_LI = real care, PH1-10; its „24 h" claim flagged); `langhaarmaedchen-lockenspray-natur-lockenwunder` (cationic r4 above the preservative, PH2-11).
- **Fails toward:** review whenever a limb is unresolved; the exception fires only when all three limbs are positively read. An unresolved fixative candidate never counts as „no real hold".

### A3 — The D7 middle band, curl sale: the name decides

- **Mirrors:** D7; PH1-12 (D7 runs before the „mixed" stop; Leave-in has no mixed stop, so here it runs before the §2.3.2 ordered rule); R2-H5; RG3-21 (sale examples); R3-H4(e) (limb readings).
- **Overlays:** LI §2.3.2 (the T15 worked-example pair and the dividing line); LI §2.2 boundary table, „Include" row „Curl creams when conditioning/definition is central and hold remains secondary"; LI §2.3 „Never by name (HO §4.2)" — overridden **for this band only**, as D7 rules.
- **New text (adds §2.3.2-A3, placed before the ordered rule):**

> **§2.3.2-A3 D7 middle band, curl sale.** A product that meets all three limbs is **excluded (Styling)**, `g0_basis: d7_middle_band_curl_sale`, Styling subtype `curl_cream`, even where T15 would read `incidental_film` and even where clause 2 would read `provisional_boundary`:
>
> 1. a **fixative-class polymer** (L5 as amended by A5) present as architecture. Per R3-H4(e) the limb reads the fixative against the Styling tail marker T_S, and a vacuous T_LI does not block it (§6 O-2). A generic `Acrylates Copolymer` without corroboration cannot establish this limb (§6 O-4);
> 2. a **substantive conditioning system**: LI COND ≥ `moderate` (the T15 reading of „not thin"). Never the A2 care test;
> 3. **sold as a curl or styling cream or balm**: the confirmed C1/C2 name says „Lockencreme", „Curl Cream", „Styling Cream/Balm … Locken", or „Curl Shaper", „Defining Cream", „Gel Cream" on a curl product.
>
> A curl cream **without** a fixative-class polymer stays under T15 and is Leave-in, even when named „Lockencreme". A product with a fixative and a conditioning film that is **not** sold as a curl cream stays under T15 (NEQI). Outside this band a name never routes; the classify-by-function rule of §2.3 stands.
>
> §2.2 „Include" row, curl creams, reads from v1.2: „Curl creams when conditioning/definition is central and hold remains secondary — **except the §2.3.2-A3 middle band**."

- **Worked example.** `schwarzkopf-taft-styling-balm-locken-halt-3` (Taft Styling Balm LOCKEN Halt 3): PVP r4 above T_LI Sodium Benzoate r10; COND high (Distearoylethyl Hydroxyethylmonium Methosulfate r6 + Cetearyl Alcohol r9 as an LGN pair above T_LI, esters r2–r3, Polyquaternium-37 r5); sold as „Styling Balm LOCKEN" ⇒ excluded (Styling), `curl_cream`. Under v1.1 the concept-phase G0 lane read it `provisional_boundary` (`data/research/styling-inci/concept-v0/round2/G0-border-verdicts.json`). Vacuous-marker case: `kevin-murphy-killer-curls` (Polyurethane-14 r5 above T_S Fragrance r10; T_LI Phenoxyethanol r39 vacuous) ⇒ excluded (Styling), `curl_cream`. Counter-examples staying Leave-in: `cantu-lockencreme-kokos`, `hask-lockencreme-curl-care`, `bali-curls-hydrating-curl-cream` (no fixative ⇒ T15); NEQI Diamond Glass Ultimate (one supporting fixative on a care film, not sold as a curl cream ⇒ T15/D3).
- **Fails toward:** the limb set is narrow (all three must be read positively); an uncorroborated fixative cannot establish limb 1, so such a product falls to the ordinary §2.3.2 reading and its review triggers.

### A4 — The D7 middle band, straightening sale

- **Mirrors:** R3-Q4 (D7 middle band extended to straightening/smoothing creams; the owner's reason: a straightening product routed as a care leave-in could be recommended to curly users who do not want their curls straightened); R3-H2 (Wella EIMI Flowing Form is covered); R3-H4(e).
- **Overlays:** the same places as A3; additionally LI §2.2 „Include" row „Blow-dry primers and heat-protective leave-ins when conditioning is meaningful" (a straightening/smoothing cream in the middle band leaves it).
- **New text (adds §2.3.2-A4, read with A3):**

> **§2.3.2-A4 D7 middle band, straightening sale.** Limbs 1 and 2 of A3, and limb 3′: **sold as a straightening/smoothing styler** — the confirmed C1/C2 name says „Straightening Creme", „Glättungscreme" (or the equivalent), or the C1/C2 lead says „zur Glättung …" ⇒ **excluded (Styling)**, `g0_basis: d7_middle_band_straightening_sale`, Styling subtype `smoothing_styler`. It runs at the same point as A3. A product with a leading fixative and care but no straightening sale is not touched by this limb.

- **Worked example.** `kms-thermashape-straightening-creme`: VP/VA Copolymer r5; Isoamyl Laurate r2 and Triheptanoin r3 (LI COND moderate); T_LI Benzoic Acid r16 vacuous (only Fragrance after it), which per R3-H4(e) does not block; C2 „ZUR GLÄTTUNG VON LOCKEN MIT GLÄTTEISEN ODER FÖHN" ⇒ excluded (Styling), `smoothing_styler`. In blind round 3 the two Styling lanes read it `leave_in` (lane A) and `li_g0_provisional` (lane B) under the v1.1 letter. Second case: `wella-professionals-eimi-flowing-form` (C2 name „… Glättungscreme / Anti-Frizz Smoothing Balm"; PVP r2, Polyquaternium-37 r3, Behentrimonium Chloride r5, Guar Hydroxypropyltrimonium Chloride r6 above T_LI Sodium Benzoate r7) ⇒ excluded (Styling), `smoothing_styler` (R3-H2; withdraws R3-Q4's „Flowing Form ⇒ review"). Not touched: `balea-glattspray-anti-frizz` (fixative with **thin** conditioning, so limb 2 fails; stays `provisional_boundary` under §2.3.2 clause 2).
- **Fails toward:** as A3. What exactly separates a straightening sale from a smoothing/anti-frizz balm was §13.3 item 1 on the Styling side; R3-H2 settled it for Flowing Form by naming the outcome („Glättungscreme" in the name counts).

### A5 — L5 gains the four vinyl fixative families

- **Mirrors:** PH1-16 (the four vinyl fixative families missing from LI L5 move into the Leave-in list after lock); Styling lexicon v0.4 FX-4.
- **Overlays:** LI §5 L5 „Evidence" list. Consumers that read L5 change with it: §7.7 HOLD, the §2.3.2 architecture half, A2 limb 1, A3/A4 limb 1.
- **New text (extends the L5 evidence list):**

> **L5 — added in v1.2 (PH1-16):** VA/Crotonates/Vinyl Neodecanoate Copolymer · VP/Dimethylaminoethylmethacrylate Copolymer (VP/DMAEMA) · Vinyl Caprolactam/VP/Dimethylaminoethyl Methacrylate Copolymer (VCap/VP/DMAEMA) · Butyl, Ethyl and Isopropyl Ester of PVM/MA Copolymer. Plain `PVM/MA Copolymer` (not an ester) is **not** a member. Each is a fixative-class film route exactly like the v1.0 members; the L5 rheology exclusion and the statement „confidence low that a particular leave-in delivers a particular hold level" apply unchanged.

- **Worked example.** `balea-ansatzvolumen-booster` (Aqua r1; Butyl Ester of PVM/MA Copolymer r5 and Ethyl Ester r8 above T_LI r13): v1.1 L5 sees no fixative here; from v1.2 it does. The product is out of Leave-in under A1 anyway (volume promise). `loreal-paris-elnett-haarspray-extra-starker-halt` (VA/Crotonates r3): non-aqueous, not Leave-in-claimable under either version. **No Leave-in corpus record contains an FX-4 member** (node scan of the 19 frozen INCI lists), so A5 moves no ruled Leave-in product.
- **Fails toward:** recognising a fixative where the v1.1 list was silent. In the border tests this can only remove a product from A2 (real hold present ⇒ D6 does not fire) or establish A3/A4 limb 1 together with the other limbs; HOLD gains a fixative read, never a hold level (T7).

### A6 — Polysilicone-9: not a fixative, not a conditioning silicone, hold unresolved

- **Mirrors:** R1-H3 (Polysilicone-9, CosIng function „hair fixing" ⇒ „maybe hold ⇒ review": SI-4 for the silicone flag, FX-U for hold, D6's hold limb unresolved); R1-T / RG-16 (lexicon placement).
- **Overlays:** LI §5 L5, table „Two families enumerated, with their HOLD consequences" (adds a row); LI §5 L2 (Polysilicone-9 is not read as an L2 persistent silicone for the border tests).
- **New text (adds a row to the L5 family table):**

> | **Polysilicone-9** | **Neither L5 fixative-class nor an L2 conditioning silicone.** A polyoxazoline-grafted aminopropyl silicone whose one CosIng function is hair fixing | In the border tests it is never care (A2 limb 2) and never real hold; where it is the only fixative candidate above T_LI it leaves A2 limb 1 **unresolved** ⇒ `provisional_boundary` + review `hair_fixing_silicone_unresolved`. Its HOLD 3-state value and whether COND/WT/PERS may read it as an L2 silicone are open (§6 O-5) |

- **Worked example.** `john-frieda-frizz-ease-3-tage-glatt-styling-spray`: Aqua r1, Alcohol r2, Polysilicone-9 r3, T_LI Benzyl Alcohol r4 (PR-1 above Parfum); Steartrimonium Chloride r8 below the first pH adjuster Malic Acid r7 ⇒ no care; limb 1 unresolved ⇒ `provisional_boundary`, review. Both round-3 Styling lanes read it so. Under v1.1, read as an L2 silicone, it would be real care and `in_category`.
- **Fails toward:** review; the species is credited to nothing that improves a value.

### A7 — Film-forming quats including PQ-69: clarification, no change

- **Mirrors:** PH1-6 (PQ-11/-16/-46 alone are not real hold); R1-T / RG-16 (PQ-69 joins that group).
- **Overlays:** LI §5 L5 (adds one sentence under the family table). No value changes: v1.1 L5 never listed a polyquaternium.
- **New text:**

> Polyquaternium-11, -16, -46 and -69 are **not** L5 members. They are L1 cationic polymers (PERS `permanent_cationic`, §7.6) and count as care in A2 limb 2. Alone they give HOLD `none`. (The Styling side flags such a product's own `hold_route` for review; that flag is Styling-only.)

- **Worked example.** `balea-styling-locken-lotion`: Polyquaternium-69 r4 and phenyl silicones r5–r6 above T_LI Phenoxyethanol r7 ⇒ real care ⇒ A2 does not fire; no L5 member ⇒ A3 does not fire ⇒ stays Leave-in (both round-3 Styling lanes: `leave_in`). `alcina-foehn-lotion` (Leave-in unseen-test u3, ruled `excluded_styling_first`): Polyquaternium-11 r4 sits beside VP/VA r3; the VP/VA decides, unchanged.
- **Fails toward:** nothing moves.

### A8 — WT rich members: waxes, paraffin, microcrystalline wax, lanolin

- **Mirrors:** PH2-12 (waxes, paraffin, microcrystalline wax and lanolin count as rich members for weight; Styling-local until it moves into the Leave-in addendum after lock).
- **Overlays:** LI §5 L3 band table, „Rich / low spreading" row; LI §7.5 WT `high` row (its parenthetical rich-member list) and the paragraph „Rich-band membership is a closed enumeration for anchor purposes". Consequence: §8.5 buildup caution limb 2 (WT `high`) can fire on these members.
- **New text:**

> L3 rich band, added in v1.2 (PH2-12): **waxes** (e.g. Cera Alba/Beeswax, Candelilla Cera, Cera Carnauba, Oryza Sativa Bran Wax, Lanolin Cera), **Paraffin**, **Cera Microcristallina (Microcrystalline Wax)**, **Lanolin**. They are rich/low-spreading members for the WT `high` anchor, enumerated like the v1.0 members. The exact member list (the Styling lexicon's WL-1/WL-2/WL-5 also hold fully hydrogenated plant oils, Tribehenin, Ozokerite, Ceresin and Acetylated Lanolin Alcohol) is open (§6 O-6).

- **Worked example.** `kevin-murphy-killer-curls` carries Lanolin Wax r2: it would count as a rich member, but the product leaves Leave-in under A3. Within the Leave-in corpus, `amika` The Shield (unseen u6) carries Ceresin r17, **below** its marker Ethylhexylglycerin r16, so nothing changes (it would at most be a below-marker note). **No ruled Leave-in record's WT moves** (node scan).
- **Fails toward:** a heavier weight reading and an added buildup caution — the conservative direction for fine-hair users (§1.1).

### A9 — A care cream that can also be left in stays care

- **Mirrors:** R2-H2 (GUHL Locken 3in1: a care cream that can also be left in as a curl cream stays care; only a fixative-class polymer or the D7 middle band makes it Styling; its leave-in use is recorded for this addendum); RG2-20 (R2-T: with leave-on and rinse-out directions, the first-named use decides).
- **Overlays:** LI §2.4, „Mandatory directions capture", rule 2, consequence 2 („A dual-use direction that offers leave-on use as an alternative to rinsing keeps the record in-category").
- **New text (adds an exception to consequence 2):**

> **Exception (v1.2, R2-H2).** A **care product** — conditioner, mask, Kur — whose directions name a **rinse-out use first** and also offer leaving it in (e.g. as a curl cream) **stays in its current category**: G0 `excluded_other_form`, both direction sentences captured, `dual_use_directions` recorded, review. Signals that identify the care product: the first-named use is rinse-out, the manufacturer shelves it with conditioners/masks, and any hold is stated to come from care. Only a fixative-class polymer above the tail or the A3/A4 middle band would make it Styling. Consequence 2 is otherwise unchanged: a leave-on-first dual-use product stays `in_category` with review.

- **Worked example.** `guhl-locken-pflege-und-styling-3in1` (GUHL Haarkur, Conditioner & Lockencreme Pflege & Styling 3in1): pack back „3in1 ANWENDUNG: 1 - Spülung … 2 - Kur … 3 - Lockencreme"; guhl.com files it under „Spülungen, Kuren & Seren" („Der Halt entsteht dabei durch Pflege, nicht durch Fixierung."); no fixative-class polymer ⇒ stays care (`excluded_other_form`). Under v1.1 consequence 2 it would have read `in_category` + review.
- **Fails toward:** the product stays where it is; the leave-in use is recorded and reviewed, never dropped. Scope of the general reading: §6 O-7.

### A10 — Owner-named routes at the border (registry)

- **Mirrors:** D2 (Color Wow Dream Coat, corrected example ⇒ Styling `smoothing_styler`); PH1-14 + R3-H3 (Elnett 3 Tage Glatt ⇒ Styling `smoothing_styler`; L'Oréal's German article counts as its C2 directions); D7 (John Frieda Lockencreme Traumlocken named); D6 owner ruling (Balea Leave-In Spray Sea Salt Care & Define); PH2-2 (owner-named routes are in the hold scope). In the other direction, owner rulings that name Leave-in: D3/T15, R2-Q4, D7 scope, PH1-10, PH1-13, PH2-1, PH2-11, R2-Q2, and the D6 examples.
- **Overlays:** LI §2.3.2 (adds a registry after the T15 worked-example pair).
- **New text (adds §2.3.2-A10):**

> **§2.3.2-A10 Owner-named border routes.** The products below are routed by owner ruling. A ruling answers only which category the product's promise belongs to; it **never** lifts an identity, INCI, directions or formula block (§2.4, §2.4.2), and it is never an F value (e.g. HOLD stays a formula read).
>
> | Product (`slug`) | Route | Ruling | Why the letter alone does not decide |
> |---|---|---|---|
> | COLOR WOW Dream Coat Supernatural Spray (`color-wow-dream-coat-supernatural-spray`) | excluded (Styling), `smoothing_styler` | D2 (corrected example) | v1.1 letter: `in_category` (Polysilicone-29 r3 + Silicone Quaternium-18 r7 film); Polysilicone-29 r3 above T_LI DMDM Hydantoin r4 is real care, so A2 does not fire; no fixative, so A3/A4 do not fire; C3 claims only |
> | L'ORÉAL PARiS Elnett Stylingspray Hitzeschutz 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`) | excluded (Styling), `smoothing_styler` | PH1-14, R3-H3 | no fixative; Dimethicone r2 above T_LI Phenoxyethanol r5 = care; v1.1 letter `in_category`; the pack front leads with the styling result |
> | John Frieda Lockencreme Traumlocken (`john-frieda-frizz-ease-traumlocken-lockencreme`) | excluded (Styling), `curl_cream` | D7 (named) | its only fixative candidate, generic Acrylates Copolymer r2 in an aqueous HEC/NaOH cream, is not corroborated (§6 O-4), so A3 limb 1 cannot be read |
> | Balea Leave-In Spray Sea Salt Care & Define (`balea-leave-in-spray-sea-salt-care-define`) | excluded (Styling), `salt_spray` | D6 (owner) | A2 reaches the same result on the letter; listed because the Styling side reads its promise as care + definition and overrides that by ruling |
> | NEQI Diamond Glass Ultimate Styling Spray; NEQI Diamond Glass Styling Spray All | Leave-in | D3/T15; R2-Q4 | unchanged |
> | cantu Lockencreme Kokos; HASK Lockencreme Curl Care; BALI CURLS Hydrating Curl Cream | Leave-in | D7 scope, T15 | no fixative |
> | Balea PROFESSIONAL Definier Spray Traumlocken | Leave-in | PH1-10 | oils above T_LI = care |
> | Balea Haarserum Anti-Frizz Glatt & Glossy | Leave-in | R2-Q2 | water-based „Serum" with a cationic conditioner |
> | Redken One United; EVO Head Mistress Cuticle Sealer | Leave-in | D6 examples | real care |
> | GARNIER FRUCTIS Leave-In Spray Diamond Sleek | Leave-in | PH2-1 | smoothing promise, real care, no fixative |
> | LANGHAARMÄDCHEN Lockenspray Natur Lockenwunder | Leave-in | PH2-11 (PH1-13) | cationic r4 above the preservative |
> | syoss Curl Control Hydrating Spray | Leave-in once its DE identity clears | PH1-13 | blocked on identity (dm.at INCI) |

- **Fails toward:** the listed limits — a ruling never unblocks evidence, and every Styling-named row stays under owner review until this addendum is approved.

---

## 2. Order of application within G0 (v1.2)

The v1.1 G0 sequence is unchanged except where the amendments insert a step. For one product:

1. **G1 and directions** (§2.4) as v1.1; A9 applies inside rule 2.
2. **Form exclusions** as v1.1 (`excluded_other_form` for rinse-out-only directions; `excluded_anhydrous`). A non-aqueous styling product is excluded either way; which engine receives it is decided on the Styling side (Styling §4.3 3.5; D2 for „Öl"/„Serum").
3. **A10 registry**: if the product is named, record `ruled_route`; the route applies once steps 1–2 raise no block.
4. **A1 function condition**: (b)/(c) ⇒ excluded (Styling); stop.
5. **A3/A4 middle band**: all limbs ⇒ excluded (Styling); stop.
6. **§2.3.2 ordered rule** (T15), with L5 as amended by A5–A7: `excluded_styling_first`, `provisional_boundary` or `in_category`.
7. **A2 D6 exception** on an `in_category` result: fires ⇒ excluded (Styling); unresolved ⇒ `provisional_boundary` + review; otherwise `in_category`.

This mirrors Styling §4.3 (3.4 (ii) → (i) → (iii) → D6) and §4.5, so the two engines return complementary answers on the same frozen packet.

---

## 3. What stays unchanged

- **T15 for clear cases (D3).** „A fixative system with thin conditioning behind it is styling; a conditioning film with a supporting fixative is a leave-in." The Maria Nila / NEQI pair and §2.3.2 clauses 1–4 stand. A3/A4 carve out only the named middle band.
- **NEQI.** Diamond Glass Ultimate stays Leave-in (D3, T15; reopening D3 was declined under R2-Q4); Diamond Glass All is Leave-in by R2-Q4 (INCI complete, R2-H4). Its T20 `care_direction` (balanced, low, `glycol_only_leg`) is untouched.
- **L5 v1.0 members, the rheology exclusion, the VP/Methacrylamide/Vinyl Imidazole and Polysilicone-29 placements, Polyacrylamide's open gap (§17.19).** Styling's FX-U reading of Polyacrylamide is not mirrored.
- **HOLD (§7.7).** The 3-state anchors and T7 (a stated hold level is captured, never derived) are unchanged. A product excluded by A3/A4 keeps whatever HOLD the formula reads; the exclusion comes from the sale limb, not from HOLD.
- **COND, WT anchors other than A8's member list, PERS, R2/`repair_support_level`, HEAT §13, EXPO, `hinweise`, §9 and the T20 overlay.** PH1-15's stricter heat rule (claim **and** L9 pass against T_S) is a Styling-side rule and is not mirrored; Leave-in §13.3 stands.
- **Claim authority (§2.4.1, T14), formula conflicts (§2.4.2, T18), the tail marker (§3.1.1 clauses 1–6)** — except the R3-H4(e) reading inside A3/A4 limb 1 (§6 O-2).
- **The R2 effective-amount test is never the T15 „thin" test** (PH1-13). COND keeps deciding „thin vs substantive".
- **„Mixed" promises are not mirrored.** The Styling side stops a care + curl-definition promise at manual review (R1-Q3, R2-Q1) and keeps the product in its current category. The Leave-in letter keeps classifying such products as before (§6 O-8).
- **D2 and the Heat Protectant / Dry Shampoo borders** are not part of this addendum (§6 O-9).
- **Alcohol.** Styling's PH1-3 trigger (adds Isopropyl Alcohol) is a Styling note; Leave-in §7.12 and its open gap §17.21 are unchanged.

---

## 4. Consequences on the corpus

Computed by a scratch node script over the frozen inputs (not committed): the 19 Leave-in corpus records (`data/research/leave-in-inci/v1.1/lab-fixture.json`), the Styling round-3 cohort (`data/research/styling-inci/v1.0/r3/cohort.json`, 143 records) and both round-3 lane outputs. Details per product: companion file.

| Group | Products | Outcome under v1.2 |
|---|---|---|
| (a) Already-ruled Leave-in products | **29 checked** (19 corpus records + 10 further products owner-ruled Leave-in on the Styling side) | **0 move.** Closest cases: Curlsmith Hydrate & Plump (PVP r32 + rich conditioning, not sold as a curl cream ⇒ A3 limb 3 fails); NEQI Ultimate (D3); Alcina Föhn Lotion (already excluded; A1 adds a second basis, state unchanged) |
| (b) Held Styling products | **17** (14 held by one or both round-3 lanes + KMS Thermashape Straightening Creme (R3-Q4), Wella EIMI Flowing Form (R3-H2), Elnett 3 Tage Glatt (PH1-14/R3-H3)) | excluded at Leave-in G0 ⇒ released to their Styling subtype on approval: A2 ×7, A3 ×4, A4 ×2, A10 ×3, A2 + A10 ×1 |
| (c) Others newly classified | **45** (43 products Styling routes directly under PH2-1, no Leave-in ruling; John Frieda Frizz Ease 3-Tage-Glatt (A6); GUHL 3in1 (A9)) | Leave-in status stated for the first time; no Styling route moves |

Four of the 17 still need the Styling confirmation round 4 before their route is final (KMS Straightening Creme, Flowing Form, Elnett 3 Tage Glatt, BALI CURLS Volumizing Curl Spray).

---

## 5. Conformance

- **§1.1 conservative-failure invariant.** Each amendment states its failure direction above. Every unresolved limb (A2 limb 1 on FX-2c or Polysilicone-9; A2 limb 2 without a yardstick) routes to `provisional_boundary` + review; no amendment creates a Leave-in claim or raises a value on an unresolved read. Moving a product out of Leave-in makes it recommendable as Styling. That is an owner product call (D6, D7, R3-Q4, PH2-1), not a formula inference, and it takes effect only on owner approval.
- **G4 evidence ceiling.** Only rank comparisons on one list and closed enumerations; no percentage, ratio or dose. A2 limb 2's yardstick is an ordinal position, as in PH1-13.
- **Authority clause.** The v1.0 standard admits no science absent from SR/HO. A1–A4, A9 and A10 are owner product calls with T15 as precedent (an adjudicated boundary, not a science claim). A5–A7 are enumerations of trade-named film formers with a CosIng basis (Styling lexicon T1/T3/T4 tiers). A8 rests on PH1-2/PS3 and Mask R8, **not on SR** — §6 O-6.
- **Calibration honesty.** This draft has **not** been run by two sealed Leave-in lanes. The corpus check in §4 is one scripted pass plus a reading of the Styling lanes' own §4.5 re-runs of the v1.1 letter. The Styling side's calibration (rounds 1–3, confirmation round 4 pending) tested these border rules from the Styling direction only.

---

## 6. Open for the owner

Points where putting a Styling ruling into Leave-in wording is not settled by the rulings. The draft text marks each where it touches.

- **O-1 G0 state label for the new exclusions.** Reuse `excluded_styling_first` with a `g0_basis` tag (`promise_outside_leave_in_function`, `d6_styling_look_without_care_or_hold`, `d7_middle_band_curl_sale`, `d7_middle_band_straightening_sale`, `owner_named_styling_route`), or add a new state. v1.0 defines `excluded_styling_first` as a fixative route with thin conditioning, which A1, A2 and A3/A4 products do not have. The emission contract (§2.3.1) is the same either way.
- **O-2 Marker for A3/A4 limb 1.** R3-H4(e) reads the fixative against **T_S** (the Mask rule) and says a vacuous T_LI does not block the D7 limbs. Leave-in has no T_S, and §3.1.1 clause 6 says a vacuous marker cannot establish „present as architecture" by rank alone. Options: import T_S for this limb only, or read T_LI with the clause-6 ordinal read. KMS Straightening Creme and Killer.Curls (vacuous T_LI) depend on it; their outcomes are also named by R3-Q4 / RG-21.
- **O-3 A1 without a C1/C2 promise.** The Styling side stops such a product at its evidence gate (it stays in its current category). Leave-in has no promise gate. The draft keeps the v1.1 letter in that case (A1 (d)).
- **O-4 Generic `Acrylates Copolymer` and the FX-U film formers.** LI L5 says „acrylates copolymers used as fixatives". The Styling lexicon makes the generic name conditional (FX-2c corroboration: non-aqueous, or a thin spray/foam with no rheology modifier) and parks Polyurethane-34/-48 and AMP-Acrylates/Allyl Methacrylate Copolymer in FX-U. PH1-16 names only the four vinyl families. Carry FX-2c and FX-U into L5, or not? Only John Frieda Lockencreme Traumlocken turns on it today, and A10 covers it.
- **O-5 Polysilicone-9 inside Leave-in.** Which HOLD 3-state value it gives (Leave-in has no `ambiguous`), and whether COND/WT/PERS may still read it as an L2 silicone outside the border tests.
- **O-6 PH2-12 member list and authority.** PH2-12 names „waxes, paraffin, microcrystalline wax and lanolin". The Styling lexicon's rich families also hold fully hydrogenated plant oils, Tribehenin, Ozokerite, Ceresin and Acetylated Lanolin Alcohol. Carry the four named groups or the full enumeration? PH2-12's basis is PS3 and Mask R8, not SR; the Leave-in authority clause may need an SR/HO check first.
- **O-7 Scope of the R2-H2 reading.** A9 limits the exception to care products whose **first-named** use is rinse-out. R2-H2's „general reading" may be meant more broadly (any care cream that can also be left in), which would also narrow consequence 2 for leave-on-first care creams.
- **O-8 Mixed promises.** Should Leave-in also route a C1/C2 care + curl-definition promise to review (R1-Q3), or keep classifying it as now? Affected today: GUHL Locken Pflege & Styling 2in1, Garnier Fructis Locken Methode Pflege-Spray, John Frieda Traumlocken Belebender Wellenauffrischer, Moroccanoil Glättende Creme, Syoss Glaze Primer (companion file, part D).
- **O-9 D2 for aqueous „Serums".** Under D2 (read by RG-15 / R2-Q2) an aqueous „Serum" with a shine/anti-frizz lead and **no** cationic conditioner or LGN pair goes to Oil by name, while Leave-in §2.3 trap 1 keeps a verified water-based serum in category. This is an Oil ↔ Leave-in border question outside PH1-16's list. No Leave-in corpus record is affected.
- **O-10 Version and ledger identity.** `v1.2` and engine `leave-in-inci-v1.2` are assumed. The ruling ID for the ledger row (T21 or a Styling-ID reference) is to be assigned. Two-lane calibration before the lock, or the T20 standard (one machine-checked lane, „implemented, not yet calibrated")?
- **O-11 Live catalog.** The current catalog category of the 17 held products and the 45 others was **not** checked (Supabase not queried; the Styling cohort carries no catalog field). If any is live as `leave_in`, approval implies a catalog move, which goes to the owner separately.
- **O-12 The PH-1 yardstick list.** A2 limb 2 needs a closed list of pH adjusters (Styling lexicon PH-1, incl. Malic Acid since v0.2). Import it with the addendum, or cite the Styling lexicon?

---

## 7. Rule-change ledger — proposed v1.2 block

The v1.0 ledger (`v1.0/rule-changes.md`) and the v1.1 block (T20 overlay §8) are frozen. Proposed:

### The Leave-in ↔ Styling border follows the Styling owner rulings (ID to be assigned, O-10)

**22. G0 gains the Styling border rules; L5 gains the four vinyl families; Polysilicone-9 is placed; WT gains four rich-member groups; a rinse-out-first care cream stays care.** What changed: the function condition reads the C1/C2 lead promise, and a volume/hold/texture/shaping/shine-only promise is not Leave-in-claimable (A1; PH2-1, R1-Q2). A styling-look product with neither real care (effective-amount rule) nor real hold is Styling (A2; D6, PH1-10, PH1-13, PH2-3). A fixative + substantive-conditioning product sold as a curl cream or as a straightening/smoothing styler is Styling — the name decides in this band only (A3, A4; D7, PH1-12, R3-Q4, R3-H2). L5 adds VA/Crotonates, VP/DMAEMA, VCap/VP/DMAEMA and the PVM/MA esters (A5; PH1-16). Polysilicone-9 leaves the hold limb unresolved (A6; R1-H3). PQ-11/-16/-46/-69 are confirmed non-L5 (A7). Waxes, paraffin, microcrystalline wax and lanolin are WT rich members (A8; PH2-12). A care product whose first use is rinse-out stays care (A9; R2-H2). Owner-named border routes are listed (A10). **Consequence:** no already-ruled Leave-in product moves (29 checked); 17 Styling records held under PH1-16 are released; 45 further products get an explicit Leave-in status. *Traces to:* PH1-16 (option B), PH2-2, the rulings above.

**README index row (proposed):** `T21? | Styling border | G0 follows the Styling border rulings (PH2-1, D6, D7 incl. the R3-Q4 straightening extension); L5 + four vinyl families; Polysilicone-9 unresolved; WT rich + waxes/lanolin; rinse-out-first care creams stay care. No ruled Leave-in product moves.`

---

## 8. Source anchors

- Rulings: `plans/styling-concept/02-rulings.md` (D2, D3, D6, D7, PH1-6, PH1-10, PH1-12, PH1-13, PH1-14, PH1-16, PH2-1, PH2-2, PH2-3, PH2-12, R1-Q2, R1-T, R1-H3, R2-Q1, R2-Q2, R2-Q4, R2-H2, R2-H4, R3-Q4, R3-H2, R3-H3, R3-H4, R3-T).
- Styling standard v0.4: §3.2 (markers), §4.1 (owner-named limits, R2-H2), §4.2 (lead order, `li_function`, R1-Q2), §4.3 (3.1 exception test, 3.4 (i)–(iii), D6), §4.5 (double-claim hold), §4.6 (registry), §13.3 items 1 and 6.
- Styling lexicon v0.4: §0.2 (T_LI, T_S), §1A FX-1…FX-4, FX-R, FX-U, RH-1; §1B WL-1…WL-6, SI-1, SI-4; §2 consumer index (S0 rows); §5 items 7–9; §7.
- Leave-in standard v1.0: §1.1, §2.1, §2.2, §2.3, §2.3.1, §2.3.2, §2.4 rule 2, §3.1.1, §5 L2/L3/L5, §7.5, §7.6, §7.7, §8.5, §13.3, §17.19, §17.21. T20 overlay v1.1 §0, §8 (overlay pattern).
- Data: `data/research/leave-in-inci/v1.1/lab-fixture.json` (19 records); `data/research/styling-inci/v1.0/r3/cohort.json`; `…/blind-lane-A-r3/results.json`; `…/blind-lane-B-r3/results.json`; `…/round-3/diff.json`; `data/research/styling-inci/concept-v0/round2/G0-border-verdicts.json` (concept-phase Leave-in G0 letter reads, research only).
