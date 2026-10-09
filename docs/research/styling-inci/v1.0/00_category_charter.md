# Styling v1.0 category charter

Status: **Phase 1 draft — not ruled, not locked.** Encodes Nick's rulings SD1–SD5 and D1–D8b (2026-10-09); four items marked **Proposal — needs Nick's ruling** are open (§15), plus one ruling conflict (§13, item 7).
Version: 1.0 (artifact root; no classification standard exists yet)
Market: Germany/EU
Date: 2026-10-09
Governing inputs: `plans/styling-concept/02-rulings.md` (owner rulings — **governs** where any other source differs), `plans/styling-concept/01-styling-concept.md` (concept Rev. 2), `plans/styling-concept/03-d5-evidence.md`, `data/research/styling-inci/concept-v0/round2/` (calibration round 2).
Inherited method: Leave-In Standard v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`, cited as "LI §x"), with the v1.1 overlay where it applies.

## 1. Purpose and scope

This charter fixes **what the Styling research engine classifies, from which evidence, and where it stops**. It is the front page for the later property set (Phase 2), evidence lexicon (Phase 3), classification standard and calibration (Phase 4) and logic lock (Phase 5).

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

## 4. Excluded and adjacent categories

| Excluded | Destination |
|---|---|
| Leave-on products whose primary promise is care, incl. curl creams **without** a fixative-class polymer (T15, D7) | Leave-in |
| Products sold as „Öl" or „Serum", whatever their formula (D2) — except water-based „Serums" that are really leave-in conditioners, which follow LI G0 | Oil (or Leave-in) |
| Protection-first sprays, even with a fixative (Schutzengel) | Heat Protectant |
| Refresh / oil-absorption powders and sprays; ties | Dry Shampoo |
| Rinse-out products, color-depositing products, scalp/medicated products, perm/relaxer/salon chemistry | not Styling (their own categories, or out of scope) |

Excluded calibration rows stay on file as boundary stress cases and S0 negative controls; they are never forced through the Styling ontology.

Two cross-category consequences are already ruled: **Oil** needs no amendment (D2 keeps everything sold as „Öl"/„Serum" in Oil, which keeps "immediate dry shine" in `docs/personal-plan/categories/oil/decision.md`; no Oil catalog re-sort). **Leave-in** gets one exception (D6) and one name rule in the middle band (D7); T15 is unchanged (D3). See §13 for what this requires of the locked Leave-in standard.

## 5. The S0 routing gate (as ruled)

S0 runs as ordered steps, not "first match wins". Every step fails toward review and the product's current category, never toward a confident new route (LI §1.1, conservative-failure invariant).

**Step 1 — Evidence gate.** S0 needs three inputs:
- a C1/C2 primary promise (German pack, manufacturer DE page, or a house brand on its own retailer page, LI §2.4.1 rule 6);
- captured directions;
- a complete INCI.

Any input missing or unreadable, or two C1/C2 sources conflicting ⇒ `provisional_boundary`: the product **stays in its current category** and routes to human review.

**Step 2 — Promise class** (C1/C2 only): `styling_result` · `care` · `heat_protection` · `refresh` · `mixed`. `mixed` ⇒ `provisional_boundary`. The class names which pair rule applies in step 3; it never routes on its own.

**Step 3 — One pair rule.** Exactly one applies:

| Neighbour | Rule |
|---|---|
| **Leave-in** (promise `styling_result` or `care`, aqueous leave-on) | **Run LI G0 unchanged**, both halves and the LI §2.3.2 precedence: `excluded_styling_first` (fixative-class route with thin conditioning **and** C1/C2 directions/positioning leading on durable hold or texture) ⇒ **Styling**; `in_category` (incl. T15's `incidental_film`: a conditioning film with a supporting fixative) ⇒ **Leave-in**, whatever the styling words say; LI G0's own `provisional_boundary` ⇒ stays put, review.<br>**D7 — middle band, name decides:** a product with **both** a fixative-class polymer (LI L5) above the tail **and** a substantive conditioning system, sold as a curl/styling cream or balm („Lockencreme", „Curl Cream", „Styling Cream/Balm … Locken") ⇒ **Styling `curl_cream`**. Curl creams without a real fixative stay Leave-in under T15, even when named „Lockencreme".<br>**D6 — exception:** a product with **neither** a fixative-class hold route (LI L5 / HOLD sense) **nor** a substantive conditioning architecture, whose C1/C2 promise is a styling result ⇒ **Styling**. Salt, starch and particle mechanisms are not "real hold" here, so beach sprays and starch-only curl sprays qualify. |
| **Heat Protectant** | Primary promise decides (`docs/personal-plan/categories/heat-protectant/decision.md`): protection-first ⇒ Heat Protectant, even with a fixative; result-with-heat-first ⇒ Styling. |
| **Dry Shampoo** | Directions and promise decide (`docs/personal-plan/categories/dry-shampoo/decision.md`): refresh / oil absorption ⇒ Dry Shampoo; texture/grip with no refresh positioning ⇒ Styling; tie ⇒ Dry Shampoo. |
| **Oil** (shine / finish / anti-frizz) | **Name rule (D2):** sold as „Öl" or „Serum" ⇒ Oil, whatever the formula. Shine/finish products under any other name (Glanzspray, Shine Spray, Finishing Spray, Brillantine, Anti-Frizz-Spray) ⇒ Styling `shine_finish`. A water-based „Serum" that is really a leave-in conditioner follows LI G0. D2 **replaces** the Rev. 1 lipid-vs-silicone rank test. |

**Step 4 — Names route in exactly two places:** D2 (Oil boundary) and D7 (curl-cream middle band). Everywhere else a name never routes and never sets a subtype: Taft „Gel Wax" contains neither gel former nor wax; got2b „Texture Clay" contains no clay; Taft Volumen Schaumfestiger „Halt 4" contains no synthetic polymer. Retailer filter facets are not evidence either (alverde Beach Waves is filtered „ohne Alkohol" with alcohol at rank 3; Color Wow is filtered „silikonfrei").

**Step 5 — Styling never fills the Personal-Plan heat-protection role.** A heat claim on a Styling product is captured, never used (§11).

### 5.1 Known boundary cases (calibration round 2, 2026-10-09)

| Product | Route | Basis |
|---|---|---|
| Maria Nila Curlicue Cream | Styling `curl_cream` | T15 paradigm: PVP r4, no conditioning architecture ⇒ `excluded_styling_first` |
| NEQI Diamond Glass Ultimate | Leave-in | T15 paradigm: conditioning film + one supporting fixative (D3); not a curl cream, so D7 does not apply |
| Taft Styling Balm Locken · Balea Pro Styling Cream Traumlocken · John Frieda Lockencreme Traumlocken | Styling `curl_cream` | D7 middle band |
| Cantu Lockencreme Kokos · HASK Curl Care · Bali Curls Hydrating Curl Cream | Leave-in | no fixative ⇒ T15; D7 does not apply |
| Balea Locken Revitalizing Spray | Styling `refresher` | D6 |
| Balea Leave-In Spray Sea Salt Care & Define | Styling `salt_spray` | D6 (salt is not "real hold") |
| Balea Anti-Frizz Serum · Redken One United · EVO Cuticle Sealer | Leave-in | real conditioning ⇒ D6 does not apply |
| Elvital Öl Magique · John Frieda Frizz Ease Haarserum · Garnier Sleek & Stay Haarserum | Oil | D2 name rule |
| Bumble and bumble Brilliantine · Balea Glow & Shine Finishing Spray | Styling `shine_finish` | D2 name rule |
| Color Wow Dream Coat | Styling `smoothing_styler` | D2 (not Öl/Serum); subtype by job: damp, before blow-drying |
| got2b Schutzengel · Taft x Gliss Hitzeschutzspray | Heat Protectant | protection-first |
| got2b Trockenshampoo Extra Volumen | Dry Shampoo | refresh-first |
| Bali Curls Curl Defining Spray | `provisional_boundary` | two INCIs under one GTIN; styling promise C3-only |
| alverde Locken Refresh · syoss Curl Control Hydrating · Langhaarmädchen Lockenwunder | `provisional_boundary` | early tail marker above the only conditioning candidate (LI §3.1.1 clause 5 plausibility) |
| Balea Professional Definier Spray Traumlocken | `provisional_boundary` | open: does oil without a cationic count as "conditioning" for D6? |

The last three rows are open **standard-level** questions for Phase 4, not charter questions.

## 6. Market

- Germany/EU; the German market product is the research unit's market. Drugstore-first (dm, Rossmann, Müller), with salon/prestige products in scope. The current cohort is 48 drugstore, 6 premium-drugstore and 16 salon/prestige Styling records.
- **Claim authority is the German pack (C1) or the manufacturer's German-market page (C2)**, exactly as LI §2.4.1. A non-German manufacturer page is C5 unless LI §2.4.1 rule 7 (identity verified **and** a DE retailer corroborates) admits it as `C2_cross_market_verified`.
- **House brands (LI §2.4.1 rule 6):** a retailer's page for its **own** private label is C2 — named cases dm ↔ Balea/alverde and Rossmann ↔ Isana. The record carries `claim_tier_basis: house_brand` and routes to review for ownership confirmation. Any other retailer-exclusive brand is C3 until ownership is verified (see §13, item 5).
- Retailer copy (C3/C4), retailer filter chips (dm „Halt", Douglas „Haltgrad") and secondary sources (C5) **never create a claim**. They are recorded as tier-stamped traces. In round 2, retailer copy added claims no manufacturer source makes (dm on Taft: „bis zu 24 h", „Ultra starker Halt", „Föhnschutz"; Douglas gave L'Oréal Barber Club „starker Halt" where the brand page says only „perfekten Halt").

## 7. Input authority

| Input | Authority | Rule |
|---|---|---|
| Identity (brand, exact name, size, GTIN, format) | C1 pack > C2 manufacturer DE > exact-GTIN DE retailer > other DE/EU retailer | LI §2.4 G1. A missing GTIN is a documented gap, never a guess. |
| INCI | dated exact-market capture; any G1 source tier | Complete list required. 64 of the 70 Styling INCIs were captured from retailer product pages, 6 from the manufacturer. |
| Directions | verbatim, source-stamped, LI §2.4 hierarchy | Mandatory (LI §2.4 G1). Missing directions ⇒ `application_moment: unresolved` and review — never an INCI guess (example: Elnett Stylingspray 3 Tage Glatt). |
| Claims (`claims[]`: promise, hold, flexibility, finish, duration, humidity, heat, hair type, free-from) | **C1/C2 only create a claim** | LI §2.4 mandatory claim capture: verbatim, tier, URL/pack id, date. "Not captured" and "does not exist" are different states. Classification lanes consume frozen claims and never re-research them. |
| Product name on the pack („Haarspray POWER Halt 5") | C1 once confirmed by pack image or manufacturer page | Feeds hold capture and the two name rules (D2, D7) only. |

## 8. Research unit and formula identity

- The unit is the **exact market product, pack and formula version** — never a brand line or marketing name. Aerosol and pump versions are separate products; a pack-size variant shares a unit only when GTIN or formula evidence shows the same formula.
- **A GTIN can survive a reformulation.** Formula identity and product identity are related but separate (LI §2.4). A formula change reopens the record; frozen records are never rewritten. Round 2 found reformulations on Syoss Curl Cream Gel, Syoss Max Hold Wax, John Frieda Volume Lift Ansatz-Booster (three formulas in circulation) and Bali Curls Curl Defining Spray.
- **Two INCIs under one GTIN** (Bali Curls Curl Defining Spray: the manufacturer version adds conditioning) and other same-market formula conflicts: see Proposal P3 (§15).
- **Cross-market formula differences** are identity questions, not conflicts (LI §2.4.1 rule 7): syoss.de lists a different, shorter INCI for Curl Cream Gel than the dm.at (Austria) list used in round 1, and the „hold 5" exists only on syoss.net (C5). The German-market formula is the record; the foreign claim creates nothing.
- **Possible duplicates** (Balea „Finishing Spray Glow & Care" vs „Glow&Shine Finishing Spray") are resolved by GTIN before calibration, never by name.

## 9. Conflict handling

- **C1 vs C2 disagree** ⇒ preserve both (G5), take the more conservative reading, route to review (LI §2.4.1 rule 2). For the S0 promise this is `provisional_boundary` (step 1). For hold, see Proposal P3.
- **Claim vs formula disagree** (a strength claim with no hold mechanism above the tail) ⇒ internal plausibility flag, review; the claim is still recorded and the level never changes (D8b).
- **Same brand, identical INCI, different stated level** (Taft Haarspray Classic „Halt 3" vs Glanz „Halt 4"; Elnett ladder) ⇒ verify against the pack (D8b). Neither level is borrowed from the other.
- **Retailer facet vs INCI** ⇒ the INCI governs; the facet is a C3 trace.

## 10. Population and medical boundary

Healthy, cosmetic population, all genders and hair lengths. The engine never diagnoses, treats or predicts tolerance. Cosmetic guidance stays separate from medically adjacent guidance:

| Medically adjacent item | Charter rule |
|---|---|
| Aerosol inhalation (hairspray, dry texture sprays, powders) | Usage caution only (wording belongs to the decision doc); an optional pump-spray preference is a convenience, never a health claim. |
| Pomade acne (forehead/hairline breakouts from anhydrous wax/petrolatum pomades) | Caution copy only (wording belongs to the decision doc); `hard_to_wash` is a cosmetic washing hint, not a skin claim. |
| Traction and hairline thinning (tight sleek styles, edge control at the hairline) | Never addressed by Styling. Any hair-loss or thinning signal follows the **existing** `hair_loss_or_thinning` route and the shared assessment boundary (`docs/personal-plan/categories/scalp-care/decision.md`, "Hair-loss boundary"). Styling may not delay that route. |
| Sensitive or irritated scalp + high drying-alcohol load at the roots | Caution copy only („nicht auf die Kopfhaut sprühen"). Alcohol and salt are never said to "damage" hair (weak evidence; concept §6). |

**No health claims, ever:** no „schont die Kopfhaut", „verhindert Haarausfall/Haarbruch", „hautverträglich" or comparable statements, whether or not a pack makes them.

## 11. Evidence ceiling

- E0–E5 per LI §3.1. **Formula-only conclusions stop at E2.** A formula observation („PVP an Position 4") is E1; any value read from it (result mechanism, `hold_route`, weight) is E2. Ingredient presence proves a clue, not concentration, delivery or experience.
- EU Article 19 rank semantics: ordered above 1 %, arbitrary below; the boundary is invisible.
- **Hold level is claim-only, never derived (D8, D8b; LI §7.7 T7).** The Chaarlie scale (SD5: 0–4, DE labels = dm's wording) normalises **C1/C2 manufacturer claims** onto one ladder. No level is ever derived from the formula, in either direction, and none is borrowed from a similar formula (Balea Haarpuder keeps its own „starker Halt" although got2b's identical base says „leicht"). Unclaimed strength is „Halt: keine Herstellerangabe", never 0. The evidence: identical INCI under different stated levels (Taft Classic/Glanz, Elnett ladder); the best formula-only rule tested was right 3 of 6 times (`round2/hold-research-ingredients.md`); brand scales are not comparable („Jeder Anbieter erfindet eigene Skalen", Stiftung Warentest, via `round2/hold-research-community.md`).
- Levels compare only within a hold family (film · molding · powder). The app never compares hold across families.
- **The one formula-to-hold-adjacent output** is the D8b neutral fact „Enthält Stylingpolymere (z. B. PVP)", shown only beside „Halt: keine Herstellerangabe". It is an E1 ingredient observation and never a rating. Its trigger list is Proposal P4.
- A C1/C2 claim is still E0 (LI §2.4.1 rule 5): claim authority decides whether a claim exists, not how true it is.

## 12. Explicit non-goals

- **No user-facing confidence** (existing rule; research uncertainty stays internal).
- **No hold estimate from formula** — no number, no band, no „eher leicht / eher stark" (D8b).
- **Humidity, duration and heat claims are captured, never used** for selection, ranking or copy („bis zu 48 h", „Feuchtigkeitsschutz", „Hitzeschutz bis 230 °C"), following LI T9 and the heat-protection rule (§5 step 5).
- No hold measurement, no efficacy claims, no performance ranking across brands.
- No user hold ratings — a separate, later feature idea (D8b).
- No catalog re-sort of Oil, Leave-in, Heat Protectant or Dry Shampoo rows (D2; LI ruling 4 pattern).
- No cross-category multi-row architecture (see Proposal P2).

## 13. Cross-engine dependencies and known source drift

1. **The locked Leave-in standard does not yet contain D6 or D7.** LI v1.0/v1.1 G0 has no D6 exception, and LI §2.3 says "never by name", which D7 deliberately overrides for the middle band. Until a Leave-in overlay encodes both (a semantic bump under LI §16), the two engines could claim the same product — e.g. Taft Styling Balm Locken (round-2 G0 lane: `provisional_boundary`, Leave-in under the LI anchor letter; D7 ⇒ Styling) or Balea Locken Revitalizing Spray (LI G0 letter: `in_category`; D6 ⇒ Styling). This charter treats S0 as authoritative for the Styling side; the Leave-in overlay is a prerequisite for the Styling logic lock.
2. **"Real hold" for D6 is the LI L5 / HOLD sense.** It is not the concept's broader `hold_route` property (concept §3.1, 3b), which also counts natural film, wax/lipid, particulate and salt. The two must stay separate: S0 reads L5; `hold_route` is a Styling property for Phase 2. The D8b plausibility flag's "hold mechanism above the tail" must be pinned to one of them in Phase 2. (The round-2 G0 verdict for Bali Curls Curl Defining Spray predates the D6 wording clarification and reads D6 as "undetermined".)
3. **D8 removes hold from selection** in `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler` and `refresher`. Concept §3.2 and §5.2 still show hold bands for some of them (smoothing 0–1, shine 0, salt 1); the ledger governs. Levels captured on those subtypes (Balea Volumenpuder 1, Balea Haarpuder 3, Wella EIMI Flowing Form 1, Elnett 3 Tage Glatt 3) are stored, not used.
4. **The D8b flag wording governs** over concept §4 rule 6: a strength claim of ≥ „stark", or any hold claim on a shine/smoothing/refresh product, with no hold mechanism above the tail ⇒ review.
5. **Langhaarmädchen** is recorded as `C2_house_brand` on two cohort records (Lockenspray Halt & Sprungkraft, Lockenwunder). LI §2.4.1 rule 6 names only Balea/alverde and Isana. Until dm ownership is verified, these claims are C3 — which would leave `gel` at 7 of 9 records with C1/C2 claims instead of 8.
6. **Tier labels:** the round-2 lane brief merged LI's C3 (exact-GTIN DE retailer) and C4 (other retailer) into one "C3". This charter uses the LI tiers unchanged.
7. **S0 step 2 (`mixed` ⇒ `provisional_boundary`) vs D7. Open — needs Nick's ruling.** D7 names Balea Pro Styling Cream Traumlocken as moving to Styling. The round-2 G0 lane reads its C2 house-brand promise as `mixed` (definition + „Verbesserte Geschmeidigkeit" + „Hitzeschutz bis zu 220 °C"), which step 2 sends to `provisional_boundary` before any pair rule runs. This charter follows the ledger's named outcome. The general order is still open: does D7 apply before step 2's `mixed` stop for middle-band products? Recommendation: yes, for the D7 middle band only, because D7 already names this product.
8. **Stale examples in the concept:** Garnier Sleek & Stay still appears as a `smoothing_styler` sample (concept §2, §3.1 #10, §3.2) although D2 routes it to Oil, as the calibration set does. The status string inside `calibration-set-r2.json` still describes round 2 as pending.

## 14. Relationship to the Personal Plan

- Stage-5 roles: families A, C, D, E ⇒ `styling`; family B ⇒ `finish` (both roles exist in `contracts.ts`). Routine order Leave-in → Styling → Finish reuses the Leave-in decision.
- **Need tier (SD4, D4)** — a matching problem or goal makes Styling `basis`; profile-based optional suggestions with a considerate note — and **plan composition (D5)** — one product per job, hairspray as default finisher for blow-dried and heat-styled looks, `curl_cream` + `gel` for curly/coily hair with normal–coarse or dry lengths, refresh as a day-2 instruction, ceiling of 3 styling products — are **matching policy**. They live in the later `docs/personal-plan/categories/styling/decision.md` and are only referenced here. The engine supplies product properties; it does not decide need, tier or count.
- D8's ranking behaviour (a stated, fitting level ranks first; no level stays eligible, ranks after and shows „Halt: keine Herstellerangabe") is likewise matching policy, built on the engine's claim-only level.

## 15. Proposals — need Nick's ruling

**P1 — v1.0 coverage target, calibration cohort and lock criteria.** *Proposal — needs Nick's ruling.*
- **Coverage target:** ≥ 80 % of the German drugstore styling shelf (dm/Rossmann/Müller) reaches a non-provisional S0 route. (Calibration set today: 66 of 71 drugstore/premium-drugstore records; it is not a shelf sample, so this needs a shelf audit at Phase 4.)
- **Cohort:** the 70 Styling records, the 5 `provisional_boundary` records as stress cases, and the 15 non-Styling records as S0 negative controls (all 90). Fill every subtype to **≥ 5 in-category records** (today short: `refresher` +3, `smoothing_styler` +1, `hair_powder` +1), each with a frozen packet: identity, INCI, verbatim directions, `claims[]` with tiers.
- **Method:** capture (S0, claims, directions) separate from classification; **two sealed blind lanes** plus a reference key classify the formula-derived properties; diff; owner rulings; rerun.
- **Lock criteria:** (a) zero unresolved value disagreements on formula-derived cells; (b) both lanes reproduce the S0 route on all 90 records, with every pair rule exercised at least once (LI G0 both halves, D6, D7, Heat, Dry Shampoo, D2); (c) two independent normalisations of the frozen claims give identical hold levels on every record; (d) an unseen set of ≥ 6 fresh products against pre-registered expectations, with ≥ 2 boundary traps; (e) the Leave-in D6/D7 overlay exists (§13, item 1).

**P2 — One route per product in v1.0; no mode split.** *Proposal — needs Nick's ruling.* S0 gives each product exactly one category. A multi-use product is profiled once, in its routed category; its other uses are captured only. Beard use is not a Chaarlie use. Mask's mode-scoped principle (R1, "no MODE is profiled twice") stays compatible, but Styling does not open a second mode in v1.0. Example: Balea MEN Pomade Haar & Bart 2in1 ⇒ one Styling `molding` record; its beard use is captured only. Kevin.Murphy Killer.Curls, sold as „Leave-in Anti-Frizz Creme", routes to Styling `curl_cream` and gets no second Leave-in profile. Recommendation: adopt. The multi-row architecture stays parked, as in the Mask charter.

**P3 — Inherit the Leave-in identity and conflict machinery unchanged.** *Proposal — needs Nick's ruling.* LI §2.4 (G1 identity gate), §2.4.1 rules 1–7 (claim authority) and §2.4.2 / T18 (same-market formula conflicts: convergence of ≥ 3 identical lists including one GTIN-anchored DE retailer, otherwise `unknown` + review + no catalog commit). Plus one Styling addition: a C1 vs C2 conflict on hold strength sets the level to `review`. Matching then treats it like „keine Herstellerangabe", not like the lower of the two numbers, because the lower number would still be a level the brand does not consistently state. Example: Bali Curls Curl Defining Spray, two INCIs under one GTIN ⇒ T18 fallback, stays `provisional_boundary` until a C1 pack photo identifies the formula on sale.

**P4 — Trigger list for „Enthält Stylingpolymere".** *Proposal — needs Nick's ruling.* Show the D8b neutral fact only when a **closed LI L5 fixative-class polymer** sits **above the tail marker**, and name the first such polymer as the example. Natural films (hydrolysed starch, chitosan), waxes, salts and particles do not trigger it. Example: syoss Curl Cream Gel (PVP in its fixative core; no strength on syoss.de) ⇒ „Halt: keine Herstellerangabe · Enthält Stylingpolymere (z. B. PVP)". Balea Locken Crunchgel (hydrolysed corn starch only) ⇒ „Halt: keine Herstellerangabe" alone. Recommendation: adopt for v1.0. It is the conservative reading, because the fact is only shown where the ingredient term is unambiguous.

## 16. Stop condition

This charter and all Styling engine phases produce **research artifacts only**. No catalog value, category re-sort, recommendation, Product Intake rule, Supabase row, user-facing copy or production matcher changes. A production adapter, if one is built, is a separate, explicitly approved step after the logic lock (`docs/research/README.md`, shared invariants).

### Next phases

| Phase | Artifact (planned path) | Input |
|---|---|---|
| 2 · Property set | `v1.0/01_property-set-v0.md` | concept §3 (15 properties: formula / claim / usage kinds), §13 items 2–4 |
| 3 · Evidence lexicon | `v1.0/02_evidence_lexicon.v0.1.md` | LI L5 list + rheology exclusion, natural film, wax/lipid, particulate, salt, silicone coat, drying alcohols |
| 4 · Standard + calibration | `v1.0/styling-classification-standard.md`, `data/research/styling-inci/v1.0/` | P1 cohort, frozen packets, blind lanes |
| 5 · Logic lock | lock receipt + artifact manifest | P1 lock criteria |
