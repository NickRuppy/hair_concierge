# Styling v1.0 category charter

Status: **v0.5 amended (R6/R7/R8) — lock suspended; targeted re-check r9 pending (LOCK-1-S)**.
Version: 1.0 (artifact root; the classification standard is being drafted)
Market: Germany/EU
Date: 2026-10-09
Governing inputs: `plans/styling-concept/02-rulings.md` (owner rulings — **governs** where any other source differs), `plans/styling-concept/01-styling-concept.md` (concept Rev. 2), `plans/styling-concept/03-d5-evidence.md`, `data/research/styling-inci/concept-v0/round2/` (calibration round 2; for the D6 border also `round2/care-vs-trace-rule.md` and `round2/parked-border-questions.md`).
Inherited method: Leave-In Standard v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`, cited as "LI §x"), with the v1.1 overlay where it applies.

**R6-T application/job alignment:** `target_zone` reads the main required application; optional/conditional extra sites do not widen it, and required sequential sites give `all` (Balea Volumenpuder Spray ⇒ `roots`; Redken Root Tease ⇒ `all`). In descriptive sentences `definition` requires an explicit curl/wave define-or-shape promise (R7-Q2 separately admits curl/wave words in the product's own name); „definierter Look“ alone gives no definition job (alverde Beach Waves). Standard §6.10/§6.12 governs.

### Amendment (R8, 2026-10-14)

| Change | Ruling | Where |
|---|---|---|
| Refresh between washes in the Dry Shampoo sense alongside volume/texture triggers the Dry Shampoo tie even with a volume-first name; L'Oréal Elvital Big Hair Day ⇒ `dry_shampoo`. | R8, 2026-10-14 — R8-Q1 | standard §4.2 / §4.6 |
| Puder/Powder names `volume`; promised texture/grip is an eligible secondary. Redken Powder Grip is a two-job name and falls to its lead line. | R8, 2026-10-14 — R8-Q2 | standard §4.2 / §6.10; property set §2.12 |
| Moroccanoil Glättende Creme has no care + curl-definition tie under R7-Q2; the border rules route it to `leave_in`. Lock remains suspended, with targeted r9 pending. | R8, 2026-10-14 — R8-H | standard §4.2 / §4.6; header |

### Amendment (R7 rulings, 2026-10-13)

| Change | Ruling | Where |
|---|---|---|
| Lock suspended until review findings are closed and the targeted r8 re-check is confirmed. No catalog or production action follows from this amendment. | LOCK-1-S, L2 | header; standard §14.1 |
| Missing vocabulary jobs use `primary_job: null`; a later eligible C1/C2 promise line's job becomes primary when the lead has none. Adjectives do not create separate jobs; product-name curl/wave words count, while descriptive sentences need an explicit define/shape-curls-or-waves promise. Brand line / collection names never count as jobs. | R7-F, R7-Q1…R7-Q3 | standard §4.2 / §6.10; property set §2.12 |

## 1. Purpose and scope

This charter fixes **what the Styling research engine classifies, from which evidence, and where it stops**. It is the front page for the property set (Phase 2), evidence lexicon (Phase 3), classification standard and calibration (Phase 4) and logic lock (Phase 5).

Scope is every styling family plus the overlap types at the edges of Leave-in, Heat Protectant, Oil and Dry Shampoo (SD1), under **one category key `styling` with subtypes** (SD2).

The engine produces research artifacts only (§16). Matching, need tier and plan composition belong to the later Personal-Plan decision document (§14).

## 2. Category definition

A styling product is a **leave-on hair product whose primary promise is a visible styling result**: shape or hold, curl/wave definition, volume, texture, sleekness, or shine/finish.

It is **not** a styling product when the primary promise is care (conditioning, repair, moisture), protection (heat) or refresh/cleansing (dry shampoo).

**Promise first, formula inside each boundary.** No formula signal alone separates Styling from its neighbours: got2b Hitzeschutzspray Schutzengel has VP/VA at rank 2 but promises protection (Heat Protectant); Balea Föhnlotion Volume Effect has no fixative but is a volume styler (Styling). The promise picks the boundary; the formula and directions decide the hard cases inside it (§5).

The research unit is the exact market product, pack and formula version (§8).

## 3. Included forms: 5 families, 12 subtypes (D1)

Subtypes describe **how and when the product is used**. What the formula does is carried by properties (Phase 2), never by the subtype name. Each family maps to one existing Stage-5 semantic role (`styling` or `finish`, `src/lib/routines/personal-plan/application/contracts.ts`).

| Family → Stage-5 role | Subtype key | DE label | Core job | Cohort (r2) |
|---|---|---|---|---|
| **A · Formen** (damp, before drying) → `styling` | `gel` | Haargel | hold + definition, sleek looks; includes edge control as `target_zone: hairline` (D1) | 9 (+1 provisional) |
| | `curl_cream` | Lockencreme | soft definition + frizz control with a real hold route (membership via LI G0 and D7) | 5 |
| | `mousse` | Schaumfestiger | volume + hold, wave/curl lift | 5 |
| | `blowdry_lotion` | Föhnlotion & Föhnspray | volume/hold created by blow-drying; absorbs root lift as `target_zone: roots` (D1) | 8 |
| | `smoothing_styler` | Glättungsstyler | sleek result created with heat (spray, cream); products sold as „Serum" go to Oil (D2) | 4 |
| **B · Finish** (dry, at the end) → `finish` | `hairspray` | Haarspray & Haarlack | fixes the finished style | 6 |
| | `shine_finish` | Glanz- & Anti-Frizz-Finish | shine and flyaway control on dry hair, for products **not** sold as „Öl"/„Serum" (D2) | 6 |
| **C · Textur & Volumen** → `styling` | `salt_spray` | Salz- & Beach-Spray | beachy, piecey texture | 5 |
| | `texture_spray` | Texturspray | dry grip, airy volume, matte texture | 5 |
| | `hair_powder` | Haarpuder | root grip, matte volume | 4 |
| **D · Modellieren** (dry, mostly short hair) → `styling` | `molding` | Wachs, Paste & Pomade | restylable shape and separation; wax, paste, clay, fiber, pomade and men's cream are one subtype, `form` is a display label (D1) | 11 |
| **E · Auffrischen** → `styling` | `refresher` | Locken-Refresh | revive curls/waves between washes | 2 (+4 provisional) |

Cohort counts are the 70 Styling records and 5 `provisional_boundary` records in `data/research/styling-inci/concept-v0/calibration-set-r2.json` (90 records in total). Three subtypes are below five records today: `refresher` (2), `smoothing_styler` (4), `hair_powder` (4).

The border rulings PH1-10 and PH1-13 are **not yet applied** to `calibration-set-r2.json`, so the counts above still show four of the five records as provisional `refresher`. Under the rulings: alverde Locken Refresh → Styling `refresher` (review flag); syoss Curl Control Hydrating → Leave-in (still blocked on DE identity); Balea Professional Definier Spray → Leave-in. Langhaarmädchen Lockenwunder → Leave-in, **named by PH2-11** (PH1-13 R2 rule: cationic r4 above the preservative; `round2/care-vs-trace-rule.md` §5). *(Superseded Phase 1 text: "reads Leave-in under the R2 rule, but no ruling names it".)* PH2-11 also keeps `calibration-set-r2.json` frozen: ruled outcomes are re-derived in the Phase 3 blind round, never patched into the file. PH1-16's double-claim hold (§13 item 1) moves further records to `provisional_boundary (pending_leave_in_addendum)`; its scope is ruled by **PH2-2** (every Styling route the unchanged Leave-in letter would also claim; held records keep a complete Styling profile marked `provisional`), see §15.2.

## 4. Excluded and adjacent categories

| Excluded | Destination |
|---|---|
| Leave-on products whose primary promise is care, incl. curl creams **without** a fixative-class polymer (T15, D7) | Leave-in |
| Shine / finish / anti-frizz products sold as „Öl" or „Serum", whatever their formula (D2; the name rule is scoped to that promise) — except water-based „Serums" that are really leave-in conditioners, which follow LI G0 | Oil (or Leave-in) |
| Protection-first sprays, even with a fixative (Schutzengel) | Heat Protectant |
| Refresh / oil-absorption powders and sprays; ties | Dry Shampoo |
| Rinse-out products, color-depositing products, scalp/medicated products, perm/relaxer/salon chemistry | not Styling (their own categories, or out of scope) |

Excluded calibration rows stay on file as boundary stress cases and S0 negative controls; they are never forced through the Styling ontology.

Cross-category consequences, all ruled:
- **Oil** needs no amendment (D2 keeps everything sold as „Öl"/„Serum" in Oil, which keeps "immediate dry shine" in `docs/personal-plan/categories/oil/decision.md`; no Oil catalog re-sort).
- **Leave-in** gets one exception (D6) and one name rule in the middle band (D7); T15 is unchanged (D3). Per **PH1-16** the locked Leave-in standard stays unchanged until Styling locks: D6, D7 and the four added vinyl fixative families live in the Styling standard's own lists, and a Leave-in addendum follows right after the Styling lock (§13 item 1).
- **Heat Protectant:** PH1-15 lets a Styling product fill the Personal-Plan heat-protection step when it passes the Leave-in heat rule (§5 step 5). This **amends `docs/personal-plan/categories/heat-protectant/decision.md`**, which excluded Styling from the heat role in V1. The amendment itself is written in the Personal-Plan phase.

## 5. The S0 routing gate (as ruled)

S0 runs as ordered steps, not "first match wins". Every step fails toward review and the product's current category, never toward a confident new route (LI §1.1, conservative-failure invariant).

**Step 1 — Evidence gate.** S0 needs three inputs:
- a C1/C2 primary promise (German pack, manufacturer DE page, or a house brand on its own retailer page, LI §2.4.1 rule 6);
- captured directions;
- a complete INCI.

Any input missing or unreadable, or two C1/C2 sources conflicting ⇒ `provisional_boundary`: the product **stays in its current category** and routes to human review.

**Step 2 — Promise class** (C1/C2 only): `styling_result` · `care` · `heat_protection` · `refresh` · `mixed`. `mixed` ⇒ `provisional_boundary`, **with one exception (PH1-12):** the D7 middle-band test (step 3) runs **before** this stop. If it fires — a fixative-class polymer above the tail, a substantive conditioning system, and sold as a curl/styling cream or balm — the product is Styling `curl_cream` even when it also promises care or heat protection (e.g. Balea Pro Styling Cream Traumlocken). **R3-Q4** extends the band to products sold as a straightening/smoothing styler ⇒ Styling `smoothing_styler`, also before this stop and held until the Leave-in addendum. R6-Q1 also runs before this stop: a heat-activated smoothing-film blow-out spray/lotion with trace-only care and no fixative is held `smoothing_styler` (standard §4.3 3.4 (i′)); the three owner-named outcomes stand under §4.6, including NEQI Ultimate’s explicit override. The `mixed` stop still applies to every other product. **Tie precedence (standard §4.2):** a refresh (Dry Shampoo sense) + volume/texture tie is assigned the `refresh` class before the stop (tie ⇒ Dry Shampoo), so it never reaches `mixed`. R8-Q1 includes a C1/C2 refresh-between-washes promise alongside volume even when the name leads with volume (L'Oréal Elvital Big Hair Day ⇒ `dry_shampoo`). The class names which pair rule applies in step 3; it never routes on its own.

**Step 3 — One pair rule.** Exactly one applies:

| Neighbour | Rule |
|---|---|
| **Leave-in** (promise `styling_result` or `care`, aqueous leave-on) | **Only where the promise overlaps Leave-in's own definition (care, detangling, smoothing/anti-frizz, curl support, blow-dry/heat support; LI §2.1; PH2-1), run LI G0 unchanged**, both halves and the LI §2.3.2 precedence: `excluded_styling_first` (fixative-class route with thin conditioning **and** C1/C2 directions/positioning leading on durable hold or texture) ⇒ **Styling**; `in_category` (incl. T15's `incidental_film`: a conditioning film with a supporting fixative) ⇒ **Leave-in**, whatever the styling words say; LI G0's own `provisional_boundary` ⇒ stays put, review.<br>**PH2-1 — border scope:** a product whose C1/C2 promise is volume, hold, texture, shaping/molding or shine goes to **Styling directly**, with no Leave-in check (e.g. Balea Föhnlotion Volume Effect and the 9 "care + no polymer" volume/hold/molding products). Accepted consequences: Garnier Fructis „Leave-In Spray" Diamond Sleek ⇒ Leave-in; Wella EIMI Flowing Form ⇒ `provisional_boundary` (*superseded by R3-H2, 2026-10-13:* the D7 straightening limb routes it to held `smoothing_styler`, §5.1 table). **R1-Q2 — dry-hair anti-frizz:** flyaway/frizz control promised for dry, finished hair (by the product's main directions) is the `shine_finish` job, not a Leave-in function, so it goes to Styling directly; anti-frizz for damp hair or sold as care keeps the Leave-in check (standard §4.2). **D6 applies to any format** (PH2-3), e.g. Balea Locken Crunchgel ⇒ Styling.<br>**D7 — middle band, name decides:** a product with **both** a fixative-class polymer above the tail **and** a substantive conditioning system, sold as a curl/styling cream or balm („Lockencreme", „Curl Cream", „Styling Cream/Balm … Locken") ⇒ **Styling `curl_cream`**. Curl creams without a real fixative stay Leave-in under T15, even when named „Lockencreme". D7 runs before the step-2 `mixed` stop (PH1-12). **Extended by R3-Q4 (2026-10-12):** the same middle band sold as a straightening/smoothing styler („Straightening Creme", „Glättungscreme", lead „zur Glättung …") ⇒ **Styling `smoothing_styler`**, held under PH1-16/PH2-2 until the Leave-in addendum, which must carry the extension (reason: a straightening product routed as a care Leave-in could be recommended to curly users who do not want their curls straightened). Products with a leading fixative and care but no straightening sale keep their route. **R3-H2 (2026-10-13):** Wella EIMI Flowing Form („Glättungscreme / Anti-Frizz Smoothing Balm") has the straightening sale ⇒ held `smoothing_styler`; R3-Q4's „Wella Flowing Form ⇒ review" is withdrawn. **R3-H4 (e):** the fixative limb reads „above the tail" against T_S and conditioning by LI COND, so a vacuous T_LI blocks neither. **R4-Q4 (2026-10-13):** the straightening limb needs only the fixative above T_S, whatever the conditioning reads — a fixative-led smoothing spray with thin care is covered (Balea Glattspray Anti-Frizz ⇒ held `smoothing_styler`); the curl limb keeps both limbs.<br>**R6-Q1 — heat-activated smoothing coats:** an aqueous blow-out/smoothing spray or lotion whose main active is a heat-activated smoothing-film former (e.g. Polysilicone-29), with care actives only at/after the first preservative and no FX fixative, routes to held Styling `smoothing_styler` before LI G0/D6. JF Frizz Ease Unendlich Smooth Salon Blow-Out and NEQI Diamond Glass Ultimate/All are owner named; Ultimate retains FX-1 r8, so its explicit ruling does not relax the general no-fixative limb. This replaces D3’s NEQI outcome and R2-Q4, held under PH2-2/PH1-16 until the Leave-in addendum.<br>**D6 — exception:** a product with **neither** a fixative-class hold route (LI L5 / HOLD sense) **nor** real care, whose C1/C2 promise is a styling result ⇒ **Styling**. Salt, starch and particle mechanisms are not "real hold" here, so beach sprays and starch-only curl sprays qualify.<br>**Fixative-class list (PH1-16, PH1-6):** LI L5 **plus** the four vinyl families LI L5 lacks (VA/Crotonates/Vinyl Neodecanoate, VP/DMAEMA, VCap/VP/DMAEMA, PVM/MA esters). They sit in the Styling standard's own list, not in LI L5, until the Leave-in addendum. PQ-11/-16/-46 with no other fixative-class polymer ⇒ hold_route review, not real hold.<br>**"Real care" for D6 — the effective-amount rule (PH1-13, R2 in `round2/care-vs-trace-rule.md` §5):** "real care" means **any** care at a working dose, not COND ≥ moderate (a detangling spray counts). Oils count as care, as in Leave-in (PH1-10). Oils, esters, plain silicones and fatty alcohols count only **above the first preservative**. Cationic conditioners, cationic polymers and amino silicones may sit below it, but **not below the first pH adjuster listed after it** (fallback: Parfum; no yardstick ⇒ review). Humectants, panthenol, proteins, extracts, starch and volatile carriers never count. Any care decision made below the preservative carries a review flag. This test is scoped to D6 and, by R2-Q2, to the D2 water-based-serum exception (standard §4.3 step 3.1) only and **is never the T15 "thin" test**. The preservative-count rule (option C) is rejected. |
| **Heat Protectant** | Primary promise decides (`docs/personal-plan/categories/heat-protectant/decision.md`): protection-first ⇒ Heat Protectant, even with a fixative; result-with-heat-first ⇒ Styling. |
| **Dry Shampoo** | Directions and promise decide (`docs/personal-plan/categories/dry-shampoo/decision.md`): refresh / oil absorption ⇒ Dry Shampoo; texture/grip with no refresh positioning ⇒ Styling; tie ⇒ Dry Shampoo. The tie (refresh + volume/texture, including a volume-first name with a C1/C2 refresh-between-washes promise, R8-Q1) is assigned to the `refresh` class at step 2, **before** the `mixed` stop, so it is reachable (standard §4.2). |
| **Oil** (shine / finish / anti-frizz) | **Name rule (D2), scoped to products whose C1/C2 lead promise is shine, finish, anti-frizz or a smoothing finish:** sold as „Öl" or „Serum" ⇒ Oil, whatever the formula. Outside that scope the name does not route (a protection-first „Serum" reaches the Heat Protectant rule; standard §4.3 step 3.1). Shine/finish products under any other name (Glanzspray, Shine Spray, Finishing Spray, Brillantine, Anti-Frizz-Spray) ⇒ Styling `shine_finish`. A water-based „Serum" that is really a leave-in conditioner follows LI G0. D2 **replaces** the Rev. 1 lipid-vs-silicone rank test. |

**Step 4 — Names route in exactly two places:** D2 (Oil boundary) and D7 (the middle band: curl creams, and since R3-Q4 straightening/smoothing stylers). When neither the pack nor the brand's German page shows the name, the product-type noun of the retailer title stands in for the name in D2 and the step-2 lead (R3-Q2, review); other retailer-title words never count. A one-job name wins over a lead line that joins that job with care (R3-Q3), subject to the standard §4.2 ties. Puder/Powder names `volume` (R8-Q2); promised texture/grip is an eligible secondary, while „Powder Grip“ is a two-job name and falls to the lead line. **R6-Q1:** brand-line names (Frizz Ease, Glow & Shine, Nutricurls) are never job words. Everywhere else a name never routes on its own and is never formula evidence; its job word only counts as promise evidence for the lead promise (standard §4.2 step 1, RG2-21, R2-H3: Balea „Styling WAX STICK" ⇒ `molding`). Formula-type nouns are never read as ingredients: Taft „Gel Wax" contains neither gel former nor wax; got2b „Texture Clay" contains no clay; Taft Volumen Schaumfestiger „Halt 4" contains no synthetic polymer. Retailer filter facets are not evidence either (alverde Beach Waves is filtered „ohne Alkohol" with alcohol at rank 3; Color Wow is filtered „silikonfrei").

**Step 5 — Heat protection on a Styling product (PH1-15).** A Styling product carries the binary property `provides_heat_protection`, decided by the Leave-in heat rule (LI HEAT §7.8, §13): `true` only with a **C1/C2 heat-protection claim and** a closed-list **L9 polymer above the tail — Styling's own marker T_S, the Mask rule, the stricter side (PH2-4)**. LI `product_tested` without an L9 member stays `false` until ruled. Only then may it fill the Personal-Plan heat-protection step (e.g. a Föhnspray covering both jobs). Otherwise the C1/C2 claim is shown („Hitzeschutz laut Hersteller“) but never fills the role. This **supersedes** the earlier "Styling never fills the heat-protection role" rule (concept Rev. 2 and the previous draft of this charter) and amends `heat-protectant/decision.md` in the Personal-Plan phase.

### 5.1 Known boundary cases (calibration round 2 and Phase 1 rulings, 2026-10-09)

| Product | Route | Basis |
|---|---|---|
| Maria Nila Curlicue Cream | Styling `curl_cream` | T15 paradigm: PVP r4, no conditioning architecture ⇒ `excluded_styling_first` |
| John Frieda Frizz Ease Unendlich Smooth Salon Blow-Out Spray | held Styling `smoothing_styler` | R6-Q1: heat-activated smoothing film, trace care, no fixative; brand line is not a job; held until the Leave-in addendum |
| NEQI Diamond Glass Ultimate | held Styling `smoothing_styler` | R6-Q1 replaces D3: explicit owner-named heat-activated smoothing-film route. Ultimate retains FX-1 r8, so it does not widen the general no-fixative rule; held until the Leave-in addendum |
| NEQI Diamond Glass All | held Styling `smoothing_styler` | R6-Q1 replaces R2-Q4: heat-activated smoothing film, care only at/after the first-preservative cutoff, no fixative; R2-H4's complete-INCI evidence remains; held until the Leave-in addendum |
| GUHL Locken Pflege & Styling 3in1 (Lockencreme, Kur & Spülung) | stays in its current category (care product, not Styling) | R2-H2 (2026-10-12): a care cream that can also be left in as a curl cream stays care; only a fixative-class polymer or the D7 middle band makes it Styling |
| Balea Haarwachs Styling Stick („Styling WAX STICK") | Styling `molding` | R2-H3 (2026-10-12): the name step precedes the skip-a-job-less-line rule |
| Redken Refreshing Curl Mist | Styling `refresher`, held | R2-Q1 (2026-10-12): curl revival is refresh and „gepflegte Locken" is a result adjective, so not `mixed`; D6 + PH1-13 (humectants only; the cationic sits below the citric-acid yardstick) |
| Taft Styling Balm Locken · Balea Pro Styling Cream Traumlocken · John Frieda Lockencreme Traumlocken | Styling `curl_cream` | D7 middle band; for Balea Pro Styling Cream, D7 runs before the `mixed` stop (PH1-12) |
| Cantu Lockencreme Kokos · HASK Curl Care · Bali Curls Hydrating Curl Cream | Leave-in | no fixative ⇒ T15; D7 does not apply |
| Balea Locken Revitalizing Spray | Styling `refresher` | D6 |
| Balea Leave-In Spray Sea Salt Care & Define | Styling `salt_spray` | D6 (salt is not "real hold") |
| alverde Locken Refresh | Styling `refresher`, review flag | D6 + PH1-13: the cationic (r17) sits below the lactic acid (r13) that follows the preservative, and the oils sit below the preservative ⇒ traces only |
| syoss Curl Control Hydrating | Leave-in, review | PH1-13: the cationic polymer (r6) sits below the preservative (r4) but above the lactic acid (r9) ⇒ real care. Still blocked on DE identity (INCI from dm.at) |
| Balea Professional Definier Spray Traumlocken | Leave-in; „24 h" claim flagged | PH1-10: oils count as conditioning for D6 |
| Langhaarmädchen Lockenwunder | Leave-in (`provisional_boundary` in the calibration set) | PH1-13 R2: cationic r4 above the preservative; PH2-11 housekeeping |
| Garnier Fructis „Leave-In Spray" Diamond Sleek | Leave-in | PH2-1: smoothing promise overlaps LI §2.1, real care, no fixative (the calibration file shows Styling `smoothing_styler`; re-derived in Phase 3) |
| Wella Professionals EIMI Flowing Form | Styling `smoothing_styler`, held | R3-H2 (2026-10-13): covered by the D7 straightening extension — C2 name „Glättungscreme / Anti-Frizz Smoothing Balm", PVP r2 + substantive conditioning, blow-dry with a brush + flat iron. Replaces PH2-1's `provisional_boundary` and R3-Q4's „review" (standard §4.6, §13.3 item 1) |
| KMS Thermashape Straightening Creme | Styling `smoothing_styler`, held | R3-Q4 (2026-10-12): fixative (VP/VA r5) on a substantive emollient base, sold for straightening („zur Glättung von Locken mit Glätteisen oder Föhn") |
| taft Texturspray Aloe Boost | Styling `texture_spray` | R3-Q3 (2026-10-12): the one-job name „Texturspray" wins over the pack line „Textur und Pflege …" |
| syoss Hitzeschutzspray Keratin | Heat Protectant | R3-Q2 (2026-10-12): no pack or brand-page name; the dm title's product-type noun „Hitzeschutzspray" decides the lead (review `name_from_retailer_title`) |
| Kevin.Murphy Killer.Curls | `provisional_boundary (evidence_gate)` | PH2-10: C3 claims only until a C1/C2 German claim is captured |
| Balea Anti-Frizz Serum · Redken One United · EVO Cuticle Sealer | Leave-in | real care ⇒ D6 does not apply. For the Balea „Haarserum" the D2 water-based-serum exception reads its conditioner the D6 way (R2-Q2, 2026-10-12: Behentrimonium Chloride just below the preservative, above the pH-adjuster yardstick), so LI G0 decides |
| Elvital Öl Magique · John Frieda Frizz Ease Haarserum · Garnier Sleek & Stay Haarserum | Oil | D2 name rule |
| Bumble and bumble Brilliantine · Balea Glow & Shine Finishing Spray | Styling `shine_finish` | D2 name rule |
| Color Wow Dream Coat | Styling `smoothing_styler` | D2 (not Öl/Serum); subtype by job: damp, before blow-drying. Counted under the R3-Q1 market-size exception with KMS Thermashape 2-in-1 Spray (committed `smoothing_styler`) |
| L'Oréal Elnett Stylingspray „3 Tage Glatt" | Styling `smoothing_styler`; hold level 3 + D8b flag | PH1-14: the pack front leads with the styling result („Hitze Styling-Spray, glatt 3 Tage, starker Halt"); its „Starker Halt" = level 3, flagged because it has no fixative |
| got2b Schutzengel · Taft x Gliss Hitzeschutzspray | Heat Protectant | protection-first |
| got2b Trockenshampoo Extra Volumen | Dry Shampoo | refresh-first |
| Bali Curls Curl Defining Spray | `provisional_boundary` | two INCIs under one GTIN; styling promise C3-only. A data question: a C1 pack photo of the unit on sale decides, not a ruling |

**PH1-16 hold.** D6 and D7 routes are ones the locked Leave-in standard could also claim (§13 item 1). Until the Leave-in addendum, such a product is held as `provisional_boundary` on the Styling side. **Scope ruled — PH2-2:** the hold covers every Styling route the unchanged Leave-in letter would also claim (all D6/D7 moves and owner-named routes); held records get the complete Styling profile marked `provisional`, count toward "≥ 5 per subtype" (reported separately) and are not matchable until the Leave-in addendum is approved.

## 6. Market

- Germany/EU; the German market product is the research unit's market. Drugstore-first (dm, Rossmann, Müller), with salon/prestige products in scope. The current cohort is 48 drugstore, 6 premium-drugstore and 16 salon/prestige Styling records.
- **Claim authority is the German pack (C1) or the manufacturer's German-market page (C2)**, exactly as LI §2.4.1 (reused unchanged, PH1-8). A non-German manufacturer page is C5 unless LI §2.4.1 rule 7 (identity verified **and** a DE retailer corroborates) admits it as `C2_cross_market_verified`.
- **House brands (LI §2.4.1 rule 6):** a retailer's page for its **own** private label is C2 — named cases dm ↔ Balea/alverde and Rossmann ↔ Isana. The record carries `claim_tier_basis: house_brand` and routes to review for ownership confirmation. Any other retailer-exclusive brand is C3 until ownership is verified. Langhaarmädchen is therefore C3 (§13 item 5).
- Retailer copy (C3/C4), retailer filter chips (dm „Halt", Douglas „Haltgrad") and secondary sources (C5) **never create a claim**. They are recorded as tier-stamped traces. In round 2, retailer copy added claims no manufacturer source makes (dm on Taft: „bis zu 24 h", „Ultra starker Halt", „Föhnschutz"; Douglas gave L'Oréal Barber Club „starker Halt" where the brand page says only „perfekten Halt").

## 7. Input authority

| Input | Authority | Rule |
|---|---|---|
| Identity (brand, exact name, size, GTIN, format) | C1 pack > C2 manufacturer DE > exact-GTIN DE retailer > other DE/EU retailer | LI §2.4 G1, reused unchanged (PH1-8). A missing GTIN is a documented gap, never a guess. |
| INCI | dated exact-market capture; any G1 source tier | Complete list required. 64 of the 70 Styling INCIs were captured from retailer product pages, 6 from the manufacturer. |
| Directions | verbatim, source-stamped, LI §2.4 hierarchy | Mandatory (LI §2.4 G1). Missing directions ⇒ `application_moment: unresolved` and review — never an INCI guess (example: Elnett Stylingspray 3 Tage Glatt was `unresolved` until its manufacturer directions were captured). |
| Claims (`claims[]`: promise, hold, flexibility, finish, duration, humidity, heat, hair type, free-from) | **C1/C2 only create a claim** | LI §2.4 mandatory claim capture: verbatim, tier, URL/pack id, date. "Not captured" and "does not exist" are different states. Classification lanes consume frozen claims and never re-research them. |
| Product name on the pack („Haarspray POWER Halt 5") | C1 once confirmed by pack image or manufacturer page | Feeds hold capture and the two name rules (D2, D7) only. |

## 8. Research unit and formula identity

- The unit is the **exact market product, pack and formula version** — never a brand line or marketing name. Aerosol and pump versions are separate products; a pack-size variant shares a unit only when GTIN or formula evidence shows the same formula.
- **A GTIN can survive a reformulation.** Formula identity and product identity are related but separate (LI §2.4). A formula change reopens the record; frozen records are never rewritten. Round 2 found reformulations on Syoss Curl Cream Gel, Syoss Max Hold Wax, John Frieda Volume Lift Ansatz-Booster (three formulas in circulation) and Bali Curls Curl Defining Spray.
- **Two INCIs under one GTIN** (Bali Curls Curl Defining Spray: the manufacturer version adds conditioning) and other same-market formula conflicts follow LI §2.4.2 / T18 unchanged (PH1-8): convergence of ≥ 3 identical lists including one GTIN-anchored DE retailer, otherwise `unknown` + review + no catalog commit. Bali Curls stays `provisional_boundary` until a C1 pack photo identifies the formula on sale.
- **Cross-market formula differences** are identity questions, not conflicts (LI §2.4.1 rule 7): syoss.de lists a different, shorter INCI for Curl Cream Gel than the dm.at (Austria) list used in round 1, and the „hold 5" exists only on syoss.net (C5). The German-market formula is the record; the foreign claim creates nothing.
- **Possible duplicates** (Balea „Finishing Spray Glow & Care" vs „Glow&Shine Finishing Spray") are resolved by GTIN before calibration, never by name.

## 9. Conflict handling

- **C1 vs C2 disagree** ⇒ preserve both (G5), take the more conservative reading, route to review (LI §2.4.1 rule 2). For the S0 promise this is `provisional_boundary` (step 1). **For hold, conflicting C1/C2 strengths ⇒ the middle level, rounded up; never empty (R3-H, 2026-10-12, replacing PH1-8's „Halt: keine Herstellerangabe")** — pack vs manufacturer page, and two strength statements on one source (Bali Curls Strong Hold Flaxseed Gel: „Strong Hold" 3 vs „Extra-starker Halt" 4 ⇒ 4); both claims stay in the trace; the review stays internal; C3 never enters; no C1/C2 strength statement ⇒ „Halt: keine Herstellerangabe" as before.
- **Claim vs formula disagree** (a strength claim with no hold mechanism above the tail) ⇒ internal plausibility flag, review; the claim is still recorded and the level never changes (D8b).
- **Same brand, identical INCI, different stated level** (Taft Haarspray Classic „Halt 3" vs Glanz „Halt 4"; Elnett ladder) ⇒ verify against the pack (D8b). Neither level is borrowed from the other.
- **Retailer facet vs INCI** ⇒ the INCI governs; the facet is a C3 trace.

## 10. Population and medical boundary

Healthy, cosmetic population, all genders and hair lengths. The engine never diagnoses, treats or predicts tolerance. Cosmetic guidance stays separate from medically adjacent guidance:

| Medically adjacent item | Charter rule |
|---|---|
| Aerosol inhalation (hairspray, dry texture sprays, powders) | Usage caution only (wording belongs to the decision doc); an optional pump-spray preference is a convenience, never a health claim. |
| Pomade acne (forehead/hairline breakouts from anhydrous wax/petrolatum pomades) | Caution copy only (wording belongs to the decision doc). The reused Leave-in buildup note (PH1-4, LI §8.5) is a cosmetic washing hint, not a skin claim. |
| Traction and hairline thinning (tight sleek styles, edge control at the hairline) | Never addressed by Styling. Any hair-loss or thinning signal follows the **existing** `hair_loss_or_thinning` route and the shared assessment boundary (`docs/personal-plan/categories/scalp-care/decision.md`, "Hair-loss boundary"). Styling may not delay that route. |
| Alcohol and a sensitive scalp | **The Leave-in alcohol note, reused (PH1-3):** „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben.“ Trigger: Alcohol / Alcohol Denat. / SD Alcohol / Ethanol / Isopropyl Alcohol among the **first 3** ingredients. Fatty alcohols and benzyl alcohol never count. It is a note only, **never an exclusion**. Alcohol and salt are never said to "damage" hair (weak evidence; concept §6). |

**No health claims, ever:** no „schont die Kopfhaut", „verhindert Haarausfall/Haarbruch", „hautverträglich" or comparable statements, whether or not a pack makes them.

## 11. Evidence ceiling

- E0–E5 per LI §3.1. **Formula-only conclusions stop at E2.** A formula observation („PVP an Position 4") is E1; any value read from it (result mechanism, `hold_route`, weight) is E2. Ingredient presence proves a clue, not concentration, delivery or experience.
- EU Article 19 rank semantics: ordered above 1 %, arbitrary below; the boundary is invisible. This is why every D6 care decision made below the preservative carries a review flag (PH1-13).
- **Hold level is claim-only, never derived (D8, D8b; LI §7.7 T7).** The Chaarlie scale (SD5: 0–4, DE labels = dm's wording) normalises **C1/C2 manufacturer claims** onto one ladder. No level is ever derived from the formula, in either direction, and none is borrowed from a similar formula (Balea Haarpuder keeps its own „starker Halt" although got2b's identical base says „leicht"). Unclaimed strength is „Halt: keine Herstellerangabe", never 0. The evidence: identical INCI under different stated levels (Taft Classic/Glanz, Elnett ladder); the best formula-only rule tested was right 3 of 6 times (`round2/hold-research-ingredients.md`); brand scales are not comparable („Jeder Anbieter erfindet eigene Skalen", Stiftung Warentest, via `round2/hold-research-community.md`).
- Levels compare only within a hold family (film · molding · powder). The app never compares hold across families.
- **The one formula-to-hold-adjacent output** is the D8b neutral fact „Enthält Stylingpolymere (z. B. PVP)", shown only beside „Halt: keine Herstellerangabe". It is an E1 ingredient observation and never a rating. **Trigger (PH1-9):** a fixative-class polymer above the tail; starch, wax, salt and particles do not trigger it.
- A C1/C2 claim is still E0 (LI §2.4.1 rule 5): claim authority decides whether a claim exists, not how true it is. The same holds for `provides_heat_protection` (§5 step 5): it reports what the product is sold as, gated by the L9 formula check, and never grades efficacy (LI §13.3).

## 12. Explicit non-goals

- **No user-facing confidence** (existing rule; research uncertainty stays internal).
- **No hold estimate from formula** — no number, no band, no „eher leicht / eher stark" (D8b).
- **Humidity and duration claims are captured, never used** for selection, ranking or copy („bis zu 48 h", „Feuchtigkeitsschutz"), following LI T9. **Heat claims** are used only through `provides_heat_protection` (§5 step 5, PH1-15); a temperature („Hitzeschutz bis 230 °C") is never used and no heat-protection grade exists.
- No hold measurement, no efficacy claims, no performance ranking across brands.
- No user hold ratings — a separate, later feature idea (D8b).
- No catalog re-sort of Oil, Leave-in, Heat Protectant or Dry Shampoo rows (D2; LI ruling 4 pattern).
- No cross-category multi-row architecture: one product = one route (PH1-7, §15).
- No „schwer auswaschbar" / washability field (PH1-4); the Leave-in buildup note is reused instead.

## 13. Cross-engine dependencies and known source drift

1. **The locked Leave-in standard does not yet contain D6 or D7. Ruled — PH1-16.** LI v1.0/v1.1 G0 has no D6 exception, and LI §2.3 says "never by name", which D7 deliberately overrides for the middle band. Until a Leave-in addendum encodes both, the two engines could claim the same product — e.g. Taft Styling Balm Locken (round-2 G0 lane: `provisional_boundary`, Leave-in under the LI anchor letter; D7 ⇒ Styling) or Balea Locken Revitalizing Spray (LI G0 letter: `in_category`; D6 ⇒ Styling). **Ruling (option B):** the locked Leave-in standard stays unchanged for now. D6, D7 and the four added vinyl fixative families live in the Styling standard's own fixative list and border rules. Right after the Styling v1.0 lock, a Leave-in addendum is written (the T20-overlay pattern); every already-ruled Leave-in product that would move goes to Nick first. Until then, a product both engines could claim is held as `provisional_boundary` on the Styling side. The lock criterion is "Leave-in addendum **drafted and queued** for right after lock" (§15, P1). **Hold scope ruled — PH2-2** (§15.2).
2. **"Real hold" for D6 is the LI L5 / HOLD sense — resolved.** It is not the concept's broader `hold_route` property (concept §3.1, 3b), which also counts natural film, wax/lipid, particulate and salt. S0 reads the fixative-class list (§5 step 3); the Styling `hold_route` property uses the same fixative-class sense, and the broader hold-mechanism set that the D8b flag reads is pinned in the property set (`01_property-set-v0.md` §6). (The round-2 G0 verdict for Bali Curls Curl Defining Spray predates the D6 wording clarification and reads D6 as "undetermined".)
3. **D8 removes hold from selection** in `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler` and `refresher` — **resolved:** the cleanup lane removed the stale hold bands from the concept. Levels captured on those subtypes (Balea Volumenpuder 1, Balea Haarpuder 3, Wella EIMI Flowing Form 1, Elnett 3 Tage Glatt 3) are stored, not used.
4. **The D8b flag wording governs** — resolved: concept Rev. 2 now restates D8b, and the ledger wording (a strength claim of ≥ „stark", or any hold claim on a shine/smoothing/refresh product, with no hold mechanism above the tail ⇒ review) is encoded in the property set §6.
5. **Langhaarmädchen — resolved.** It is not a house brand under LI §2.4.1 rule 6 (which names only Balea/alverde and Isana). Both cohort records are now recorded as C3 in `calibration-set-r2.json`, which leaves `gel` at 7 of 9 records with C1/C2 claims.
6. **Tier labels (standing note):** the round-2 lane brief merged LI's C3 (exact-GTIN DE retailer) and C4 (other retailer) into one "C3". This charter uses the LI tiers unchanged.
7. **S0 step 2 (`mixed` ⇒ `provisional_boundary`) vs D7 — ruled, PH1-12.** D7 runs before the `mixed` stop, for the curl-cream middle band only (§5 step 2). Balea Pro Styling Cream Traumlocken, whose C2 house-brand promise mixes definition, „Verbesserte Geschmeidigkeit" and „Hitzeschutz bis zu 220 °C", is therefore Styling `curl_cream`. (R2-H5, 2026-10-12: „Verbesserte Geschmeidigkeit" is a feel line and never the care half; the outcome is unchanged.)
8. **Stale examples — resolved** by the cleanup lane: Garnier Sleek & Stay is no longer a `smoothing_styler` sample in the concept (D2 routes it to Oil), and the status string in `calibration-set-r2.json` now reads round 2 complete.
9. **Heat-role drift — open (other documents).** Concept Rev. 2 (§1 S0 step 5, §3.1 property 15) still says Styling never fills the heat-protection role, and `heat-protectant/decision.md` still excludes Styling. PH1-15 supersedes both. The concept is corrected in its next revision; the decision doc is amended in the Personal-Plan phase.

## 14. Relationship to the Personal Plan

- Stage-5 roles: families A, C, D, E ⇒ `styling`; family B ⇒ `finish` (both roles exist in `contracts.ts`). Routine order Leave-in → Styling → Finish reuses the Leave-in decision.
- **Need tier (SD4, D4)** — a matching problem or goal makes Styling `basis`; profile-based optional suggestions with a considerate note — and **plan composition (D5)** — one product per job, hairspray as default finisher for blow-dried and heat-styled looks, `curl_cream` + `gel` for curly/coily hair with normal–coarse or dry lengths, refresh as a day-2 instruction, ceiling of 3 styling products — are **matching policy**. They live in the later `docs/personal-plan/categories/styling/decision.md` and are only referenced here. The engine supplies product properties; it does not decide need, tier or count.
- D8's ranking behaviour (a stated, fitting level ranks first; no level stays eligible, ranks after and shows „Halt: keine Herstellerangabe") is likewise matching policy, built on the engine's claim-only level.
- **Heat-protection step (PH1-15):** a Styling product with `provides_heat_protection = true` may fill the heat-protection step. The Personal-Plan phase amends `heat-protectant/decision.md` accordingly.
- **Deep-Cleansing reset load — deferred (PH1-4).** Whether a `rich` Styling product used weekly adds +1 to the Deep-Cleansing reset load is decided in the Personal-Plan decision. Today Styling is not an input to it.

## 15. Phase 1 rulings on the former proposals

All four charter proposals were ruled on 2026-10-09 ("for now", PH1 bundle). The ruled text follows.

**P1 — v1.0 lock criteria. Ruled — PH1-11, adjusted by PH1-16, R3-L, R3-Q1 and R4-L.** Styling v1.0 is finished when:
- (a) every subtype has **≥ 5 products** (today short: `refresher` +3, `smoothing_styler` +1, `hair_powder` +1), each with a frozen packet: identity, INCI, verbatim directions, `claims[]` with tiers. **Market-size exception (R3-Q1, 2026-10-12):** `smoothing_styler` may lock below 5 — in the German market almost every smoothing product is sold care-, protection- or shine-first and routes elsewhere under the rules (the round-5 capture found 4 candidates); merging it into `blowdry_lotion` and further searching were considered and set aside. Counted: KMS Thermashape 2-in-1 Spray (committed), Color Wow Dream Coat (held), Elnett 3 Tage Glatt once its German directions are captured, and KMS Thermashape Straightening Creme (held, R3-Q4) once confirmed (standard §14.1). *Round 4:* five agreed (KMS 2-in-1 Spray committed; Color Wow, KMS Straightening Creme, Elnett 3 Tage Glatt, Wella Flowing Form held), so the exception is no longer needed on the incl.-held count; Balea Glattspray Anti-Frizz (held, R4-Q4) would be a sixth;
- (b) **two sealed blind lanes agree on all 90 routes and properties**, with no unresolved disagreements (method: capture separate from classification, two sealed blind lanes plus a reference key, diff, owner rulings, rerun). **„Agree" means resolved, not identical (R3-L, 2026-10-12):** v1.0 may lock when every remaining A/B disagreement is resolved — either a lane error proven against a clear rule, or the rule gap behind it closed — **and** a final confirmation round shows only lane errors and no new rule gaps; literal identity of both lanes on every value is not required. **Lock scope (R4-L, 2026-10-13): only differences in user-facing fields block the lock** — route and recommendability (incl. held vs committed and the evidence gate), subtype, hold level, weight, finish, flexibility, target zone, application moment, primary and secondary jobs, heat protection, and the user-shown notes. Differences confined to the calculation log (reason code, rule path, internal review triggers, confidence, internal flags, lexicon placements that move no value) do not block: they are fixed in the text and documented, without a further round (example: Bali Curls Sleek Stick — every user field agrees, only reason code and rule path differ; standard §14.1);
- (c) **two independent claim normalisations give identical hold levels** on every record — read since R3-H4 (c) like (b): „resolved, not identical" (every mismatch a proven lane error or a closed rule gap; standard §14.1 (c));
- (d) **≥ 6 unseen products, ≥ 2 of them boundary traps**, match pre-registered expectations;
- (e) a **Leave-in addendum for D6/D7 is drafted and queued** for right after the lock (PH1-16; it no longer has to exist before the lock); it must carry the R3-Q4 straightening extension of D7, as extended by R4-Q4, and release or re-rule the D6/D7 registry rows that hold records under R4-Q5.

The cohort is the 90 records of `calibration-set-r2.json`: 70 Styling, 5 `provisional_boundary` as stress cases, 15 non-Styling S0 negative controls.

**P2 — One route per product. Ruled — PH1-7.** S0 gives each product exactly one category; there is no split by use. A multi-use product is profiled once, in its routed category; its other uses are only recorded. Example: Balea MEN Pomade Haar & Bart 2in1 ⇒ one Styling `molding` record; its beard use is recorded only. Kevin.Murphy Killer.Curls, sold as „Leave-in Anti-Frizz Creme", was named here as Styling `curl_cream` with no second Leave-in profile; **PH2-10 refines this:** it has C3 claims only, so it is `provisional_boundary (evidence_gate)` until a C1/C2 German claim is captured (the one-route principle is unchanged). Mask's mode-scoped principle (R1) stays compatible; the multi-row architecture stays parked.

**P3 — Leave-in identity and conflict machinery. Ruled — PH1-8.** LI §2.4 (G1 identity gate), §2.4.1 rules 1–7 (claim authority) and §2.4.2 / T18 (same-market INCI conflicts) are reused unchanged. Styling addition: **a pack-vs-manufacturer-page hold conflict ⇒ „Halt: keine Herstellerangabe"** (§9) — **replaced by R3-H (2026-10-12):** conflicting C1/C2 strengths ⇒ the middle level, rounded up, never empty. Example: Bali Curls Curl Defining Spray, two INCIs under one GTIN ⇒ T18 fallback, stays `provisional_boundary` until a C1 pack photo identifies the formula on sale.

**P4 — Trigger for „Enthält Stylingpolymere". Ruled — PH1-9.** The neutral fact shows only for a **fixative-class polymer above the tail**, naming the first such polymer as the example. Starch, wax, salt and particles do not trigger it. Example: syoss Curl Cream Gel (PVP in its fixative core; no strength on syoss.de) ⇒ „Halt: keine Herstellerangabe · Enthält Stylingpolymere (z. B. PVP)". Balea Locken Crunchgel (hydrolysed corn starch only) ⇒ „Halt: keine Herstellerangabe" alone.

### 15.1 Other Phase 1 rulings reflected in this charter

PH1-3 (alcohol note, §10), PH1-4 (no washability field; buildup note reused; Deep-Cleansing load deferred, §12, §14), PH1-10 (oils count as care for D6, §5), PH1-12 (D7 before the `mixed` stop, §5), PH1-13 (effective-amount rule for D6, §5), PH1-14 (Elnett 3 Tage Glatt, §5.1), PH1-15 (`provides_heat_protection`, §5 step 5), PH1-16 (Leave-in addendum after lock, §4, §13). PH1-1, PH1-2, PH1-5 and PH1-6 are property-set rulings (`01_property-set-v0.md`).

### 15.2 Items closed by the Phase 2 rulings (2026-10-11), and what is still open

- **PH1-16 hold scope — ruled, PH2-2.** The hold covers every Styling route the unchanged Leave-in letter would also claim: all D6/D7 moves (Taft Styling Balm Locken, Balea Pro Styling Cream Traumlocken, John Frieda Lockencreme Traumlocken, Balea Locken Revitalizing, Balea Sea Salt Care & Define, alverde Locken Refresh, Balea Locken Crunchgel) and the owner-named routes. Held records get the complete Styling profile, marked `provisional`; they count toward the ≥ 5-per-subtype criterion, reported separately; they are not matchable until the Leave-in addendum is approved.
- **Langhaarmädchen Lockenwunder — ruled, PH2-11 (housekeeping).** Leave-in by the PH1-13 R2 rule (cationic r4 above the preservative).
- **Route agreement in the blind lanes — ruled, PH2-6.** The lanes get a separate sealed S0 packet (INCI, directions, confirmed name, C1/C2 promise and heat claims with tiers; no prior routes; hold strengths/numbers, flexibility words and finish grades masked, job nouns such as Glanz-Spray, Shine, Haarspray, Wachs, Puder kept — refined by R2-Q3, standard §10.2); each lane classifies F/U from the blind packet using its own S0 output.
- **Resolved after round 3 (2026-10-13, R3-H2…R3-H4)** — standard §13.3: Wella Flowing Form ⇒ held `smoothing_styler` (R3-H2); number-vs-word keeps „number beats word", R3-H covers word-vs-word and number-vs-number (R3-H4 (a)); three or more statements ⇒ the median, rounded up (b); „resolved, not identical" also governs criterion (c) (c); the shop-title fallback needs agreeing type nouns (d); the D7 limbs read T_S and LI COND, so a vacuous T_LI does not block them (e). Also: retailer-hosted pack photos count as C1 when GTIN or exact name and size match (f); Elnett's directions come from L'Oréal Paris's own article (R3-H3).
- **Ruled after round 4 (2026-10-13, R4-L, R4-Q1…R4-Q7, R4-T)** — standard v0.5: the lock scope (only user-facing differences block, R4-L); a one-job C1/C2 name meets the promise input of the evidence gate (R4-Q1); „Beach Waves" is the salt-spray look, „Glaze"/„Topcoat"/„Gloss" are shine words (R4-Q2); only care verbs and nouns make the care half (R4-Q3); the D7 straightening limb covers fixative-led smoothing sprays with thin care (R4-Q4); registry D6/D7 rows keep ruling their records until the Leave-in addendum (R4-Q5); three text fixes (R4-Q6); a product noun names the job, a qualifier is the finish or grade (R4-Q7). The open items it raised (standard §13.4: the `registry_row` pointer, the Taft Gel Wax Glanz D8b flag, promise lines with no recorded position, Brilliantine's C1 name under R4-Q1, typed hold lines) are **resolved by R4-H** (2026-10-13); Brilliantine's „brilliantine" is a one-job C1 name (shine). Wella EIMI „Haltegrad"/„Haltestufe" is a 1–4 scale (R3-H5: 1–2 ⇒ 1, 3 ⇒ 3, 4/4+ ⇒ 4).
- **Open — P1 items not carried into PH1-11.** The proposal also named a ≥ 80 % drugstore-shelf coverage target and "every pair rule exercised at least once". PH1-11 does not name them, so they are not lock criteria; PH2-11 records them as tracked-open.

## 16. Stop condition

This charter and all Styling engine phases produce **research artifacts only**. No catalog value, category re-sort, recommendation, Product Intake rule, Supabase row, user-facing copy or production matcher changes. A production adapter, if one is built, is a separate, explicitly approved step after the logic lock (`docs/research/README.md`, shared invariants).

### Next phases

| Phase | Artifact (planned path) | State |
|---|---|---|
| 2 · Property set | `v1.0/01_property-set-v0.md` | Ruled (PH1-1…6, PH1-15; Phase 2 items closed by PH2-1…12, 2026-10-11) |
| 3 · Evidence lexicon | `v1.0/02_evidence_lexicon.v0.5.md` (v0.4, v0.3, v0.2 and v0.1 kept as the round-4, round-3, round-2 and round-1 versions) | v0.1 drafted; Phase 2 ruled 2026-10-11 (PH2-4, 5, 8, 9 reflected); v0.2 after blind round 1 (2026-10-12: RG-1, RG-16); v0.3 after blind round 2 (2026-10-12: RG2-23, RG2-24); v0.4 after blind round 3 (2026-10-13: RG3-6, RG3-15, RG3-17); v0.5 after the confirmation round 4 (2026-10-13: RG4-24, RG4-27). Input: LI L5 list + the four vinyl families + rheology exclusion, natural film, wax/lipid, particulate, salt, silicone coat, alcohol-note members, L9 list |
| 4 · Standard + calibration | `v1.0/styling-classification-standard.md`, `data/research/styling-inci/v1.0/` | Standard v0.1 ruled 2026-10-11 (PH2-1…12); blind rounds 1–3 run 2026-10-12; blind rounds 1–3 and the confirmation round 4 run; standard v0.5 (`styling-inci-v0.5`, 2026-10-13) folds in R1-*, R2-*, R3-* and R4-*; next: the final confirmation round 6 (`r6/`, `build/freeze-cohort-r6.js`) under R3-L / R4-L; round 5 (`r5/`) was aborted after the Codex review and never scored. Calibration: the P1 cohort, frozen packets, blind lanes |
| 5 · Logic lock | lock receipt + artifact manifest | P1 lock criteria (PH1-11 as adjusted by PH1-16, R3-L, R3-Q1 and R4-L; standard §14.1) |
