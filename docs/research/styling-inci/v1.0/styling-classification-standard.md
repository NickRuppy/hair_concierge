# Styling Research and Classification Standard v0.1

Status: **v0.1 — Phase 2 ruled 2026-10-11 (PH2-1…11); next: Phase 3 capture + blind calibration round 1.** Not calibrated, not locked. Executable procedures for a classification lane, in run order.
Document version: `v0.1` · Engine version: `styling-inci-v0.1` · Lexicon: `02_evidence_lexicon.v0.1.md` (`styling-lexicon-v0.1`)
Scope: leave-on styling products under the one category key `styling` with 12 subtypes (SD1, SD2, D1), German/EU market, plus the S0 boundary with Leave-in, Heat Protectant, Oil and Dry Shampoo.
Normative source: this Markdown file. Drafted 2026-10-10.
Governing inputs, in order of authority: `plans/styling-concept/02-rulings.md` (SD1–SD5, D1–D8b, PH1-1…PH1-16, PH2-1…PH2-11 — **governs**) > `00_category_charter.md` > `01_property-set-v0.md` > `plans/styling-concept/01-styling-concept.md` Rev. 2.
Inherited method (reused by reference, cited "LI §x"): `docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md` (Leave-In Standard v1.0). Structural precedent: `docs/research/mask-inci/v1.0/mask-classification-standard.md` (cited "Mask §x") and the engine template `docs/research/category-classification-engine-template.md`.
Evidence: `data/research/styling-inci/concept-v0/calibration-set-r2.json` (90 records), raw INCI/claims/directions in `samples/*.json` and `round2/`. Counts marked **(node)** were recomputed on 2026-10-10 by a scratch script over the raw INCI under lexicon v0.1; the script is not committed and no frozen record was edited.

## Version

**Status: v0.1 — Phase 2 ruled 2026-10-11 (PH2-1…11); next: Phase 3 capture + blind calibration round 1.**

**v0.1 (drafted 2026-10-10, ruled 2026-10-11) — first standard.** It operationalises the ruled property set and charter. It adds no property and reopens no ruling. On 2026-10-11 Nick ruled the six proposals P-S1…P-S6 as PH2-1…PH2-6 and five further points as PH2-7…PH2-11 (`plans/styling-concept/02-rulings.md`); the body below states the ruled rule, and §12 records the mapping.

**Marking convention.**
- `[D6]`, `[PH1-13]` … — the passage encodes that owner ruling.
- `[LI §x reused]` — a Leave-in rule adopted unchanged (PH1-8, PH1-2, PH1-3, PH1-4, PH1-15 tell us which ones).
- `[operational]` — a mechanical reading that follows directly from a ruled or reused rule (usually LI §1.1); calibration may test it.
- `[PH2-n]` — the passage encodes a Phase 2 ruling (2026-10-11). The six former proposals P-S1…P-S6 are ruled as PH2-1…PH2-6 (§12); no proposal is open.

**Superseded text, named so nobody applies it.** Property set v0's `drying_alcohol_load` (high/present/none) and `washability` are replaced by PH1-3 and PH1-4; the property-set file already reflects this. The charter's former step 5 ("Styling never fills the heat role") is superseded by PH1-15. The concept Rev. 2 still carries that line (charter §13 item 9); this standard follows PH1-15. Where the calibration file's `route`, `v1_subtype`, `application_moment` or `proposed_finish` disagree with a rule below, the rule governs and the record is re-derived in the blind round, never hand-edited (Mask rerun obligation).

**What this draft is not.** Not calibrated, no repeatability claim, no catalog, Supabase, intake, matcher or copy change (charter §16).

---

## 1. Purpose and the lane run order

This standard turns one exact German-market styling product (exact pack, exact formula version) into an auditable research record. A lane runs these steps in this order and never skips ahead:

| Step | What | Section | Inputs |
|---|---|---|---|
| 1 | Identity and formula freeze; directions and claim capture | §2 | sources |
| 2 | Read both tail markers | §3 | frozen INCI |
| 3 | S0 routing gate | §4 | frozen claims (C1/C2 only), directions, INCI |
| 4 | Subtype (only if `route = styling` or a held Styling lean, §4.5) | §5 | promise, directions, format |
| 5 | Properties (F, U, C kinds) | §6 | frozen packet |
| 6 | Hold level normalisation, D8b flag, neutral fact | §7 | frozen claims, F values |
| 7 | Derived echoes and cautions (computed last, never reviewed per product) | §6.16 | the above |
| 8 | Review triggers and the record envelope | §8, §10 | everything |

### 1.1 The conservative-failure invariant `[LI §1.1 reused]`

Every hard rule here — threshold, closed list, gate, marker convention — fails toward **human review** or toward **the anchor's conservative value**, never toward a recommendation, an upgrade or a value that reads better for the user than the evidence supports (LI §1.1, Mask §1.1). Consequences carried through this file:

1. An implausible or unresolved input can neither qualify nor disqualify (LI §3.1.1 clauses 5–6; Mask §3.1.1).
2. "Unresolved" always means review, never a default good answer.
3. S0 fails toward `provisional_boundary` and the product's current category, never toward a confident new route (charter §5).
4. Never encode unresolved uncertainty as an extreme (Mask §1.1): an unresolved reading never produces `weight: rich` or `light`, a hold level, or `provides_heat_protection: true`.

**Conformance of the Styling additions.** Every `[operational]` rule and every ruled proposal in §12 was checked against this bar: each one either fails to review / the conservative value, or resolves only on converging evidence.

### 1.2 Separation of evidence kinds (property set §0, §7)

| Kind | Source | May set |
|---|---|---|
| **R** routing | S0 (§4) | `route`, `styling_subtype` |
| **F** formula-blind | frozen INCI only | `result_mechanisms`, `hold_route`, `weight`, `alcohol_note`, `ingredient_flags`, the buildup note's formula limbs, the F half of `provides_heat_protection`, molding `base`, curl-cream `conditioning_co_load` |
| **U** usage | frozen directions transcription | `application_moment`, `target_zone`, `heat_activated` (directions half) |
| **C** claim | C1/C2 claims only (LI §2.4.1) | `chaarlie_hold_level`, `flexibility`, `finish`, `primary_job`/`secondary_jobs`, gel `cast_expected`, molding `form_label`, `captured_claims`, the C half of `provides_heat_protection` |
| **D** derived | the above | echo fields, cautions, hold display, neutral fact |

Subtype, product name and format **never set an F value** (LI G9 parity). F never sets a C value and C never sets an F value. The only crossings are the three in property set §7 (heat-activation raise; job gate; D8b / finish sanity / weight-claim conflict as review notes that move no value) plus PH1-15's two-part heat test (§6.7).

---

## 2. Identity, formula freeze and claim capture (lane step 1)

### 2.1 Reused unchanged `[PH1-8; LI §2.4, §2.4.1, §2.4.2 reused]`

| LI rule | What it fixes for Styling |
|---|---|
| LI §2.4 G1 checklist | exact product, brand, name, market, pack size, GTIN (or a documented gap), dated exact-market INCI, normalised fingerprint, **verbatim directions with tier**, `claims[]`, conflicts preserved |
| LI §2.4 mandatory directions capture | Verbatim, source-stamped, G1 source hierarchy (pack → DE manufacturer → exact-GTIN DE retailer → other DE/EU retailer). Missing directions are a documented gap: U fields go `unresolved`, never an INCI guess. **Directions are not claim-gated** (LI §2.4.1 last paragraph) — a C3 directions text is valid for U fields, with confidence `moderate` |
| LI §2.4 mandatory claim capture | `claims[]` is part of the freeze; "not captured" ≠ "does not exist"; lanes never re-research a claim; a claim found mid-classification reopens the freeze |
| LI §2.4.1 rules 1–7 | Only C1 (current DE pack) and C2 (manufacturer DE page) create a claim. **Rule 6:** a retailer's page for its **own** private label is C2 (named: dm ↔ Balea/alverde, Rossmann ↔ Isana), recorded `claim_tier_basis: house_brand`, routed to review for ownership confirmation. **Rule 7:** a non-German manufacturer page counts as `C2_cross_market_verified` only with identity verified (identical INCI or a DE-confirmed shared GTIN) **and** a DE retailer corroborating. Rule 2: C1 vs C2 conflict ⇒ preserve both, take the more conservative reading, review |
| LI §2.4.2 / T18 | Same-market INCI set conflicts: ≥ 3 identical lists incl. one GTIN-anchored DE retailer ⇒ convergent list is the record (`verified_with_minor_source_difference`, confidence −1, review); otherwise affected fields `unknown`, `formula_source_conflict`, no downstream use. Cross-market differences are identity questions (rule 7), never convergence counts |
| LI §2.4 packet requirements | Sources stamped C1–C5; normalisation never splits inside an ingredient name (lexicon §0.4) |

### 2.2 Styling additions

| # | Rule | Basis | Example |
|---|---|---|---|
| A1 | **Pack vs manufacturer-page hold conflict ⇒ `chaarlie_hold_level: null`** („Halt: keine Herstellerangabe"), both claims kept in the trace, review `hold_claim_conflict`. Not the lower number, not `review` | PH1-8 | — (none in cohort) |
| A2 | **Two INCIs under one GTIN ⇒ `identity_status: provisional_formula_conflict`, S0 `provisional_boundary` (`boundary_reason: formula_conflict`) until a C1 pack capture identifies the unit on sale.** T18 tier 1 cannot be met by two disagreeing lists; tier 2 governs. No Styling value is committed | PH1-8 (P3 example), LI T18 | `bali-curls-leave-in-spray-curl-defining`: dm.de list (Hydrolyzed Corn Starch r3, no care) vs bali-care.com list (olivate, Cetyl Alcohol, proteins) |
| A3 | **Typed claim capture.** Each `claims[]` entry carries `type` ∈ {promise, hold, flexibility, finish, cast, duration, humidity, heat_protection, heat_activation, hair_type, free_from, other}, `raw` (verbatim DE), `tier`, `source`, `date`; hold entries add `number`, `scale_as_written`, `words`. The confirmed **product name is a C1/C2 claim** once a pack image or the manufacturer page shows it (charter §7) | charter §7, property set §2.16 | `wellaflex-schaumfestiger-locken-und-wellen-starker-halt`: name „Starker Halt" (C1) + 3 of 5 dots (C1) |
| A4 | **House-brand structured attributes.** On a house brand's own retailer page (rule 6), the retailer's structured product fields („Halt: sehr starker Halt") are the brand owner's product data ⇒ C2 `house_brand`, review `[PH2-7]`. **Filter chips and attributes on third-party products are C3/C4 traces and never create a claim** | LI §2.4.1 rule 6; charter §6 | `balea-styling-spray-ultra-volumen` dm attribute ⇒ C2 house-brand; `color-wow-dream-coat-supernatural-spray` Douglas „Haltgrad" chip ⇒ C3 trace |
| A5 | Retailer-exclusive brands are **not** house brands unless ownership is documented | charter §13 item 5 | Langhaarmädchen ⇒ C3 |
| A6 | A reformulation reopens the record; frozen records are never rewritten. The GTIN may survive it | charter §8 | Syoss Curl Cream Gel, Syoss Max Hold Wax, John Frieda Volume Lift (three formulas) |
| A7 | Possible duplicates are resolved by GTIN before calibration, never by name | charter §8 | Balea „Finishing Spray Glow & Care" vs „Glow&Shine Finishing Spray" |
| A8 | One product = one route; other uses are recorded only | PH1-7 | `balea-men-pomade-haar-bart-2in1`: beard use recorded, one Styling `molding` record |

### 2.3 Identity states

`verified` · `verified_with_minor_source_difference` · `provisional_formula_conflict` · `provisional_identity_conflict` · `insufficient_information` (LI §2.4). A conflict affecting one property makes **that property** `unknown`; it blocks the whole record only when the dominant architecture is unreadable (LI §2.4). Any state other than the two `verified` ones sends S0 to `provisional_boundary` (§4.1).

---

## 3. Evidence scale and the two tail markers (lane step 2)

### 3.1 Scale `[LI §3.1 reused]`

E0 claim · E1 formula observation or directions transcription · E2 any value read from the formula (the ceiling) · E3–E5 exact-product testing (reachable, unobserved). The assignment ladder of LI §3.1 binds every field (lexicon §0.1). Confidence (`high`/`moderate`/`low`, Mask §4.1) is **internal only** — never projected, never user-facing (LI G14).

### 3.2 Markers `[PH1-1, PH2-9]`

Every record states **T_S** (Styling marker: Mask §3.1 classes — fragrance, declared allergens/aroma chemicals, preservatives, boosters in a pair, chelators) and **T_LI** (LI §3.1.1 capped-preservative list plus other Annex V preservatives). Exact class lists: lexicon §0.2. **T_S is the full Mask rule `[PH2-9]`**, as approved under PH1-1 — the earliest of preservative, perfume, declared allergens/aroma chemicals, preservative boosters in a pair and chelators; not the ledger's short form „first preservative or perfume“. **T_S feeds every Styling property; T_LI feeds only the S0 border rules** (LI G0/T15, D6/R2, D7, the PH1-16 double-claim check). Each record carries `tail_marker: {T_S: {inci, rank, status}, T_LI: {inci, rank, status}}` with `status` ∈ `plausible · unresolved · absent` for T_S and LI's `plausible · implausible · vacuous · none_visible` for T_LI.

### 3.3 Unresolved or absent T_S `[operational — Mask §3.1.1 consequences + §1.1]`

Mask §3.1.1 says an unresolved marker may neither qualify nor disqualify, caps confidence and routes to review. The deterministic reading for a lane:

1. Read the list twice: **R1** with the marker as listed, **R2** with the next ordinally consistent T_S member.
2. Species ranked between the two markers are `unpositioned`. They are recorded (E1) and credited to **nothing** that improves a value: not to `result_mechanisms`, not to `hold_route: present`, not to the neutral fact, not to the heat test.
3. Each F property is computed under R1 and R2. **Same value ⇒ that value**, confidence ≤ `moderate`, trigger `tail_marker_unresolved`. **Different values ⇒** `hold_route: ambiguous`; `weight: unknown`; mechanisms = the R1 set with the `unpositioned` members listed; review.
4. **Absent** (no T_S class anywhere) ⇒ the whole list is above-tail, confidence ≤ `moderate`, trigger `tail_marker_absent` (Mask §3.1).

Cohort (node): 9 of 70 Styling records have a non-plausible T_S (8 unresolved, 1 absent). On all of them R1 and R2 give the same `hold_route` and `weight`; no value rests on this rule today.

T_LI keeps LI §3.1.1 clauses 1–6 **unchanged**, including clause 5 (implausible marker cannot disqualify) and clause 6 (vacuous marker cannot qualify).

### 3.4 Below-marker candidates `[Mask E13; LI §3.1.1 clause 3 reused]`

A species at or below T_S never makes the marker implausible and earns nothing. Where crediting it would change a value, the record carries `candidate_below_tail` (species, rank, marker, marker rank) and routes to review. A species that would change nothing is recorded as E1 only. Cohort (node): 17 of 70 Styling records carry at least one value-changing candidate (e.g. `balea-locken-revitalizing-spray`: Coconut r13 + Shea r14 behind Sodium Benzoate r4 would turn `light` into `rich`).

### 3.5 Boundary position `[Mask E1 reused]`

A load-bearing member at `T_S − 1` counts normally but caps that value's confidence at `moderate`.

---

## 4. The S0 routing gate (lane step 3)

### 4.0 Outputs

`route` ∈ `styling · leave_in · oil · heat_protectant · dry_shampoo · provisional_boundary`. A `provisional_boundary` carries exactly one `boundary_reason`:

| `boundary_reason` | Meaning | Remedy |
|---|---|---|
| `evidence_gate` | A step-1 input is missing (no C1/C2 promise, no directions, incomplete INCI) | evidence work (a fresh capture), never a ruling — Mask's `insufficient_information` distinction |
| `claim_conflict` | Two C1/C2 sources disagree on the lead promise | review |
| `formula_conflict` | T18 tier 2, or two INCIs under one GTIN (§2.2 A2) | a C1 pack capture |
| `mixed_promise` | Step 2 `mixed`, D7 did not fire | review |
| `li_g0_provisional` | LI G0's own `provisional_boundary` (LI §2.3.2 clauses 2/4) | review |
| `pending_leave_in_addendum` | The PH1-16 hold (§4.5): Styling S0 says `styling`, the locked Leave-in G0 would also claim the product | released by the Leave-in addendum |

Every `provisional_boundary` **stays in its current category** and routes to review (charter §5).

### 4.1 Step 1 — Evidence gate

S0 runs only when all three hold:
1. a **C1/C2 primary promise** (pack, manufacturer DE page, house brand on its own retailer page, or `C2_cross_market_verified`);
2. **captured directions** (any G1 tier, verbatim);
3. a **complete INCI** with `identity_status` `verified` or `verified_with_minor_source_difference`.

Any input missing ⇒ `provisional_boundary (evidence_gate)`; two C1/C2 sources leading with different promise classes ⇒ `provisional_boundary (claim_conflict)`; a formula conflict ⇒ `provisional_boundary (formula_conflict)`. **Exception:** a product whose route an owner ruling names (§4.6 registry) takes that route; its claim-keyed fields still take their no-claim values and it carries `claim_authority_gap`.

### 4.2 Step 2 — Promise class and the Leave-in-function tag

**Promise class** (structured judgment, C1/C2 only; the confirmed product name is C1/C2 positioning):

| Class | Anchor |
|---|---|
| `styling_result` | The lead promise is a visible styling result: shape/hold, curl or wave definition, volume, texture, sleekness, shine/finish (charter §2) — **including** reviving curls or a style between washes (the `refresher` job) |
| `care` | The lead promise is conditioning, repair or moisture |
| `heat_protection` | The lead promise is protection from heat (e.g. „Hitzeschutzspray") |
| `refresh` | The lead promise is **hair freshness / oil absorption / cleansing** between washes (the Dry Shampoo sense; charter §2 "refresh/cleansing (dry shampoo)") — never curl revival |
| `mixed` | The lead claim states two classes as **co-equal jobs** („Styling und Schutz in einem"). An adjective (a „Pflegecreme" that defines curls), a secondary bullet („Hitzeschutz bis 220 °C" under a volume promise) or an ingredient call-out („mit Arganöl") does **not** make a promise mixed |

**Leave-in-function tag** (input to step 3.4 (ii)): `li_function: yes` when the C1/C2 lead promise or confirmed name states one of LI §2.1's own functions — **conditioning/care, detangling, smoothing/anti-frizz, curl support (definition or revival of curls/waves), heat-styling support** — and `no` when it states only hold, volume, texture, molding/shaping, or shine/finish. **`li_function` is what scopes the Leave-in border check `[PH2-1]`** (step 3.4 (ii)).

**`mixed` stop, with the PH1-12 exception.** If the class is `mixed`, run the D7 middle-band test (step 3.4 (i)) **first**. If it fires ⇒ `styling`, subtype `curl_cream`, even with a care or heat co-promise. Otherwise ⇒ `provisional_boundary (mixed_promise)`. `[PH1-12]`

### 4.3 Step 3 — Pair rules, in fixed order

The charter's "exactly one pair rule applies" is implemented as an ordered selection, so a product with a secondary heat claim and an aqueous formula is not tested twice. `[operational]`

**3.1 Oil — name rule `[D2]`.** Sold as „Öl" or „Serum" (confirmed C1/C2 name) ⇒ `oil`, whatever the formula. Exception: a water-based „Serum" that is really a leave-in conditioner ⇒ go to 3.4 (LI G0 decides). Every other shine/finish/anti-frizz name (Glanzspray, Shine Spray, Finishing Spray, Brilliantine, Anti-Frizz-Spray) continues.

**3.2 Dry Shampoo `[charter §5; dry-shampoo/decision.md]`.** Class `refresh`, **or** directions/promise positioned on oil absorption or cleansing ⇒ `dry_shampoo`. Texture/grip with no refresh positioning ⇒ continue. A tie (refresh and volume co-lead) ⇒ `dry_shampoo`. The formula (starch powder, silica) never decides this boundary.

**3.3 Heat Protectant `[charter §5; heat-protectant/decision.md]`.** Class `heat_protection` ⇒ `heat_protectant` (protection-first, even with a fixative: got2b Schutzengel, VP/VA r2). A heat claim that is **not** the lead promise does not select this pair; it is captured and handled by PH1-15 (§6.7).

**3.4 Leave-in** — class `styling_result` or `care`, formula **aqueous** (lexicon §0.3). Sub-steps in order:

- **(i) D7 middle band `[D7, PH1-12]`.** All three ⇒ `styling`, subtype `curl_cream`:
  1. a fixative-class polymer (lexicon FX-1…FX-4) **above T_LI**;
  2. a **substantive conditioning system** — LI G0's conditioning half reads not thin (LI COND ≥ `moderate`, the T15 reading). **Never the R2 care test** (PH1-13: R2 "is not to be used as the T15 thin test");
  3. sold as a curl or styling cream or balm („Lockencreme", „Curl Cream", „Styling Cream/Balm … Locken"). Scope: the curl-cream middle band only. A curl cream **without** a fixative stays under T15 ⇒ Leave-in, even when named „Lockencreme" (Cantu Kokos, HASK, Bali Hydrating).
- **(ii) Border scope: the Leave-in check applies only where the promise overlaps Leave-in's own definition `[PH2-1]`.** Class `styling_result` with `li_function: no` — the C1/C2 promise is volume, hold, texture, shaping/molding or shine ⇒ `styling` **directly, with no Leave-in check** (no T15, D6 or D7). Leave-in's own definition (LI §2.1: care, detangling, smoothing/anti-frizz, curl support, blow-dry/heat support) does not cover such a product, whatever conditioning the formula carries (e.g. Balea Föhnlotion Volume Effect and the 9 "care + no polymer" volume/hold/molding products). Promises that overlap Leave-in (`li_function: yes`) keep the full check: (i), (iii), D6. **Accepted consequences (PH2-1):** Garnier Fructis „Leave-In Spray" Diamond Sleek ⇒ `leave_in` (smoothing promise, real care, no fixative); Wella EIMI Flowing Form ⇒ `provisional_boundary` (D7 covers curl creams only).
- **(iii) LI G0 unchanged `[D3, T15; LI §2.3, §2.3.2 reused]`**, read with the **Styling** fixative-class list (FX-1…FX-4, PH1-16), T_LI, and LI §2.3.2's precedence (positioning half C1/C2 only):
  - `excluded_styling_first` (fixative-class route, thin conditioning, C1/C2 positioning on durable hold or texture) ⇒ `styling`;
  - `in_category` (incl. T15 `incidental_film`: a conditioning film with a supporting fixative — NEQI) ⇒ run **D6** below; if D6 does not fire ⇒ `leave_in`;
  - LI G0 `provisional_boundary` ⇒ `provisional_boundary (li_g0_provisional)`.
- **D6 — the exception `[D6, PH1-10, PH1-13]`.** All three ⇒ `styling`:
  1. **no real hold**: no FX-1…FX-4 member above T_LI. PQ-11/-16/-46, FX-U, natural films, salts and particles are not real hold (D6 clarification, PH1-6);
  2. **no real care** by the PH1-13 effective-amount rule (R2): oils, esters, butters/hydrocarbons, plain silicones and fatty alcohols count **only above T_LI**; cationic conditioners, cationic polymers (incl. PQ-11/-16/-46) and amino silicones count above T_LI **or** below it down to — not including — the first pH adjuster (lexicon PH-1) listed after T_LI (fallback `Parfum`; no yardstick ⇒ review `care_yardstick_missing`). Humectants, panthenol, proteins, extracts, starch and volatile carriers never count. Any care decided below T_LI carries `care_decided_below_preservative`; a cationic below the yardstick carries `care_below_dose_yardstick`. "Real care" = any care, not COND ≥ moderate (a detangling spray counts). Oils count, as in Leave-in (PH1-10);
  3. a C1/C2 **styling-look promise**.
  - Format `[PH2-3]`: D6 applies to **any format**, not only sprays; format never routes. Example: Balea Locken Crunchgel (starch gel, no real care, no fixative, „Haargel für definierte Locken") ⇒ `styling`.

**3.5 Non-aqueous, not „Öl"/„Serum" `[operational — LI G0 + D2]`.** Class `styling_result`, water absent or only in the tail ⇒ `styling`. LI G0 could only return `excluded_anhydrous` (oil/serum destination), and D2 reserves the Oil boundary for products sold as „Öl"/„Serum" (Balea MEN Pomade, Elnett Haarspray, got2b Curlz, taft x Gliss Shine Coat).

**3.6 Anything else** (class `care` with no Leave-in claim, an unforeseen combination) ⇒ `provisional_boundary`, review. Never a confident route by default.

### 4.4 Step 4 — Names route in exactly two places `[D2, D7]`

D2 (Oil) and D7 (curl-cream middle band). Nowhere else does a name route or set a subtype: Taft „Gel Wax" has no wax or gel former; got2b „Texture Clay" has no clay; Taft Volumen Schaumfestiger „Halt 4" has no synthetic polymer. Retailer facets are never evidence (alverde Beach Waves „ohne Alkohol" with Alcohol denat. r3; Color Wow „silikonfrei" with Polysilicone-29 r3).

### 4.5 Step 5 — The PH1-16 double-claim hold `[PH1-16, PH2-2]`

After steps 1–4 say `styling`, run the **locked** Leave-in G0 letter once more: LI L5 only (no FX-4), no D6, no D7, T_LI. If it would return `in_category` or `provisional_boundary` — i.e. the Leave-in engine could also claim the product — the S0 output is `provisional_boundary (pending_leave_in_addendum)` with `lean_route: styling` and the lean subtype. Products that reach `styling` through LI G0 `excluded_styling_first` (with LI L5), through 3.4 (ii), or through 3.5 are not double-claimed and are not held.

Under PH2-1, a product whose promise names no Leave-in function (`li_function: no`) is never Leave-in-claimable: LI's `in_category` needs an LI §2.1 function, and LI's `provisional_boundary` is reserved for genuine evidence conflicts (LI §2.3.2 clause 4), which a hold or volume promise is not.

What reaches the hold: every D6 route, every D7 route, every Styling route that rests on an FX-4 member alone where LI L5 sees none, and every owner-named Styling route that the Leave-in letter would claim (§4.6).

**Scope `[PH2-2]`.** The hold covers **every Styling route the unchanged Leave-in letter would also claim** — all D6 and D7 moves and the owner-named routes — decided by re-running the locked letter as described above; it is not limited to the products charter §13 item 1 names.

**Carriage `[PH2-2]`.** A held record gets the **complete** Styling profile (every F, U, C and D field), marked `provisional`, with its lean subtype. It **counts toward the PH1-11 "≥ 5 per subtype" criterion, reported separately** from committed records. It is **not matchable or recommendable** until the Leave-in addendum is approved.

### 4.6 Registry of owner-named routes (they override the procedure where it would differ)

| Product (`sample_id`) | Ruled route | Ruling | S0 letter without the ruling | Held (PH1-16)? |
|---|---|---|---|---|
| Maria Nila Curlicue (`maria-nila-curlicue-cream`) | styling `curl_cream` | T15, D3 | same (LI G0 `excluded_styling_first`) | no |
| NEQI Diamond Glass Ultimate (`neqi-diamond-glass-ultimate-styling-spray`) | leave_in | T15, D3 | same | — |
| Taft Styling Balm Locken · Balea Pro Styling Cream Traumlocken · John Frieda Lockencreme Traumlocken | styling `curl_cream` | D7 (+ PH1-12 for Balea) | same via 3.4 (i); John Frieda has no C1/C2 promise (C3 only) | **yes** |
| Cantu Lockencreme Kokos · HASK Curl Care · Bali Curls Hydrating Curl Cream | leave_in | D7 scope, T15 | same | — |
| Balea Locken Revitalizing Spray · Balea Leave-In Spray Sea Salt Care & Define | styling `refresher` · `salt_spray` | D6 | same | **yes** |
| alverde Locken Refresh-Spray | styling `refresher` + review | PH1-13 | same (D6; `care_below_dose_yardstick`) | **yes** |
| syoss Curl Control Hydrating Spray | leave_in, review (identity-blocked) | PH1-13 | evidence gate (C3, dm.at INCI) | — |
| Balea Pro Definier Spray Traumlocken | leave_in; „24 h" flagged | PH1-10 | same (oils above T_LI = real care) | — |
| Balea Anti-Frizz Serum · Redken One United · EVO Cuticle Sealer | leave_in | D6 examples | same | — |
| Elvital Öl Magique · Frizz Ease Haarserum · Garnier Sleek & Stay Haarserum | oil | D2 | same | — |
| Bumble and bumble Brilliantine · Balea Glow & Shine Finishing Spray | styling `shine_finish` | D2 | Brilliantine: evidence gate (C3 only); Balea: same | no |
| Color Wow Dream Coat (`color-wow-dream-coat-supernatural-spray`) | styling `smoothing_styler` | D2 (corrected example) | evidence gate (C3 only); LI letter `in_category` | **yes** |
| Elnett Stylingspray 3 Tage Glatt (`loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`) | styling `smoothing_styler`, level 3 + D8b flag | PH1-14 | `claim_conflict` (C1 pack front leads with result, C2 article with protection); LI letter `in_category` | **yes** |
| Balea MEN Pomade Haar & Bart 2in1 | styling `molding` (one route) | PH1-7 | same (3.5) | no |
| Balea Föhnlotion Volume Effect (`balea-foehnlotion-volume-effect`) and the 9 "care + no polymer" volume/hold/molding products | styling directly (3.4 (ii), no Leave-in check) | PH2-1 | same | no |
| Balea Locken Crunchgel (`balea-locken-crunchgel`) · Bali Curls Strong Hold Flaxseed Gel (same reading) | styling `gel` | D6 any format (PH2-3) | same | **yes** (PH2-2) |
| Garnier Fructis „Leave-In Spray" Diamond Sleek (`garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray`) | leave_in | PH2-1 (smoothing promise overlaps LI §2.1; real care, no fixative) | same | — |
| Wella Professionals EIMI Flowing Form (`wella-professionals-eimi-flowing-form`) | `provisional_boundary` (`li_g0_provisional`) | PH2-1 (D7 covers curl creams only) | same | — |
| Kevin.Murphy Killer.Curls (`kevin-murphy-killer-curls`) | `provisional_boundary` (`evidence_gate`) until a C1/C2 German claim is captured (C3 claims only) | PH2-10 | same | — |
| Langhaarmädchen Lockenwunder (`langhaarmaedchen-lockenspray-natur-lockenwunder`) | leave_in | PH1-13 R2 (cationic r4 above the preservative), PH2-11 | same | — |
| got2b Schutzengel · taft x Gliss Hitzeschutzspray | heat_protectant | charter §5.1 | same | — |
| got2b Trockenshampoo Extra Volumen | dry_shampoo | charter §5.1 | evidence gate (C3) ⇒ stays in its current category, Dry Shampoo | — |

### 4.7 Emission contract `[LI §2.3.1 reused]`

| Outcome | Emitted |
|---|---|
| `styling` | full record (§10) |
| `leave_in` · `oil` · `heat_protectant` · `dry_shampoo` | identity block, formula record, `route` + rationale, both markers; Styling properties **optional and marked `informational_and_non_authoritative: true`**; no subtype, no fit, no cautions |
| `provisional_boundary (evidence_gate / formula_conflict)` | identity block, formula record, the missing input, a capture work order |
| `provisional_boundary (claim_conflict / mixed_promise / li_g0_provisional)` | as `leave_in` above, plus both readings |
| `provisional_boundary (pending_leave_in_addendum)` | `[PH2-2]` the complete Styling profile marked `provisional`, `lean_route` and lean subtype; not matchable until the Leave-in addendum is approved (§4.5) |

### 4.8 Cohort dry run (lexicon v0.1, node; annotations of promise class and Leave-in function by hand)

| S0 path | Records | Calibration-file Styling records it covers |
|---|---|---|
| Evidence gate (no C1/C2 promise), not named in a ruling | 15 | 12: `bumble-and-bumble-surf-spray`, `living-proof-full-dry-volume-texture-spray`, `american-crew-fiber`, `cantu-shea-butter-extra-hold-edge-stay-gel`, `kevin-murphy-killer-curls` (PH2-10), `langhaarmaedchen-lockenspray-halt-sprungkraft`, `got2b-gotgloss-glanz-spray`, `feschi-smooth-and-shine-anti-frizz-spray-glanzspray`, `john-frieda-volume-lift-pushed-up-dry-texture-spray`, `jean-und-len-sea-salt-spray`, `schwarzkopf-taft-texturspray-aloe-boost` (C5), `kevin-murphy-powder-puff-volume` (C5). Plus 3 already-provisional records |
| 3.5 non-aqueous ⇒ styling | 6 | Elnett Haarspray, Balea MEN Pomade, Balea Volumenpuder, got2b Curlz, taft x Gliss Shine Coat, Moroccanoil Dry Texture |
| 3.4 (ii) promise outside Leave-in functions ⇒ styling (PH2-1) | 37 | all mousses/Föhn-sprays/powders/hairsprays/water-based molding with a C1/C2 volume, hold, texture, molding or shine promise |
| 3.4 (iii) LI G0 `excluded_styling_first` ⇒ styling | 3 | syoss Curl Cream Gel, Wellaflex Locken & Wellen, Maria Nila |
| D2-named ⇒ styling (not held) | 1 | Brilliantine |
| Held, PH1-16 (`pending_leave_in_addendum`) | 10 | D6: Balea Revitalizing, Balea Sea Salt Care & Define, alverde Locken Refresh, Balea Locken Crunchgel (PH2-3), Bali Curls Flaxseed Gel (PH2-3); D7: Taft Balm, Balea Pro Traumlocken, John Frieda Traumlocken; named: Elnett 3 Tage Glatt, Color Wow |
| LI G0 `provisional_boundary` (PH2-1) | 1 | `wella-professionals-eimi-flowing-form` (PVP r2 + PQ-37 r3 + ester + BTAC r5: middle band, but a smoothing balm, not a curl cream, so D7 does not apply) |
| ⇒ leave_in (PH2-1) | 11 | 1 calibration-Styling: `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` (sold as „Leave-In Spray … Glättungsspray": smoothing is a Leave-in function, argan r6 + SAPDMA r7 = care, no fixative ⇒ `in_category`; no ruling names it) |
| oil / heat_protectant / dry_shampoo | 3 / 2 / 1 | — |

**Committed Styling routes: 47.** Per subtype (node): hairspray 6 · molding 10 · blowdry_lotion 8 · mousse 5 · gel 5 · shine_finish 4 · hair_powder 3 · texture_spray 2 · salt_spray 2 · refresher 1 · curl_cream 1 · **smoothing_styler 0**. Held: curl_cream 3 · refresher 2 · gel 2 · smoothing_styler 2 · salt_spray 1. This is the PH1-11 coverage picture under the rules as ruled; held records are reported separately from committed ones (PH2-2; §13 item 1).

**Counts note.** The table was annotated by hand (promise class and Leave-in function), not by script, and it already assumed the readings later ruled as PH2-1…PH2-3 and PH2-10. It has **not** been re-derived after the Phase 2 rulings; the per-path and per-subtype counts, and the routing of `langhaarmaedchen-lockenspray-natur-lockenwunder` (Leave-in under PH1-13 R2 / PH2-11; a `provisional_boundary` stress case in the calibration file, so outside the 70 Styling records), are **to be re-derived in Phase 3 under PH2-1/PH2-2**. No count here is a result.

---

## 5. Subtype assignment (lane step 4)

Subtypes describe **how and when** a product is used (charter §3). They never set an F value (§1.2). Run in order; the first rule that decides, decides.

1. **D7 fired ⇒ `curl_cream`** (§4.3, 3.4 (i)). `[D7]`
2. **Directions lead with edges, baby hair or brows (`target_zone: hairline`) and the product is a gel-type shaping product ⇒ `gel`.** Edge control is a zone, not a subtype. `[D1]`
3. Otherwise match the **job** (from the C1/C2 lead promise) and the **moment** (from the directions, §6.11) against the anchor table. Where the job and moment leave two subtypes open, the **product form breaks the tie** (property set §2.2). A name never decides (`[D1]`, step 4 of S0).

| Family → Stage-5 role | Subtype | DE label | Job anchor | Moment anchor | Tie-breaks |
|---|---|---|---|---|---|
| A Formen → `styling` | `gel` | Haargel | hold + definition, sleek looks; edges (`hairline`) | damp or dry, shaped by hand | vs `curl_cream`: gel/jelly/spray-gel form ⇒ `gel` (`balea-styling-creme-power-flex`: sold as „Styling Creme", a hydroalcoholic PVP/carbomer gel ⇒ `gel`; `langhaarmaedchen-lockenspray-halt-sprungkraft`: liquid curl-hold spray-gel ⇒ `gel`) |
| | `curl_cream` | Lockencreme | soft definition + frizz control with a real hold route | damp | membership only via LI G0 `excluded_styling_first` (T15) or D7; a curl cream with no fixative is Leave-in |
| | `mousse` | Schaumfestiger | volume + hold, wave/curl lift | damp, before drying | vs `blowdry_lotion`: foam form ⇒ `mousse` (`balea-ansatzvolumen-booster`) |
| | `blowdry_lotion` | Föhnlotion & Föhnspray | volume/hold created by blow-drying; root lift (`target_zone: roots`) | damp, before drying (usually `before_heat`) | absorbs Föhnspray and root lift (D1) |
| | `smoothing_styler` | Glättungsstyler | sleek result made with heat | damp or before heat | vs `shine_finish`: a pre-heat/damp moment ⇒ `smoothing_styler` (`color-wow-dream-coat-supernatural-spray`); not sold as „Öl"/„Serum" (D2) |
| B Finish → `finish` | `hairspray` | Haarspray & Haarlack | fixes the finished style | `dry_finish` | vs `shine_finish`: a hold lead ⇒ `hairspray` even with a shine word (`schwarzkopf-taft-haarspray-glanz-halt-4`) |
| | `shine_finish` | Glanz- & Anti-Frizz-Finish | shine, flyaway control on dry hair | `dry_finish` / `dry_restyle` | D2: not „Öl"/„Serum" |
| C Textur & Volumen → `styling` | `salt_spray` | Salz- & Beach-Spray | beachy, piecey texture | damp or dry, scrunched | a salt-free beach spray is still `salt_spray` (the salt mechanism is an extra, §6.15) |
| | `texture_spray` | Texturspray | dry grip, airy volume, matte texture | `dry_restyle` | vs `hair_powder`: spray form ⇒ `texture_spray` |
| | `hair_powder` | Haarpuder | root grip, matte volume | dry, roots | powder form |
| D Modellieren → `styling` | `molding` | Wachs, Paste & Pomade | restylable shape, separation; men's creams | `dry_restyle` | wax, paste, clay, fiber, pomade, cream are one subtype; `form_label` is display only (D1) |
| E Auffrischen → `styling` | `refresher` | Locken-Refresh | revive curls/waves between washes | the lead promise is revival; directions on dry hair | D5: refresh is a day-2 *instruction* reusing the gel; a `refresher` product is an optional extra (matching policy, not S0) |

Confidence: `high` when promise and directions agree; `moderate` when the form broke a tie or directions are retailer-only. A held record (§4.5) carries its **lean** subtype.

---

## 6. Properties (lane step 5)

Every property object carries the LI §4 / Mask §4 evidence record: `value`, `decision_type` (`deterministic` · `structured_judgment` · `claim_gated` · `transcription`), `confidence` (internal), `evidence_level`, `formula_observations[]` (with ranks and both markers), `supporting_signals[]`, `counter_signals[]`, `review_status`. Section numbers follow the property set's order.

### 6.1 `result_mechanisms` (F)

| Field | Rule |
|---|---|
| Values | Set of `fixative_film · natural_film · wax_lipid · particulate · salt · silicone_coat · humectant_only · none`, each with members `[{inci, rank}]` |
| Decision | **Deterministic lexicon membership above T_S** (lexicon §1, §2): FX-1…FX-4 ⇒ `fixative_film`; NF-1, NF-U (aqueous only) ⇒ `natural_film` (NF-U adds `natural_film_unsettled`); WL-1…WL-8 ⇒ `wax_lipid` (WL-1, WL-2, WL-8 tagged `structuring`); PT-1, PT-2 (non-aqueous only) ⇒ `particulate`; SA-1 ⇒ `salt`; SI-1 ⇒ `silicone_coat`; HU-1 alone ⇒ `humectant_only`; nothing ⇒ `none` |
| Never | RH-1 rheology, VC carriers, EM-1 emulsifiers, CA-1/CA-2 monomeric cationics, FX-R and FX-U (they act through `hold_route`), SA-2 Sodium Chloride, SI-2/SI-3 |
| Counter-signals | §3.3 (unresolved T_S), §3.4 (`candidate_below_tail`), §3.5 (boundary position), NF-U |
| Evidence / confidence | E2. `high`: plausible T_S, members clearly above it; `moderate`: boundary member, unresolved/absent marker, NF-U; `low`: INCI source conflict |
| False signals | Names („Clay", „Wax", „Fiber"); retailer chips; tail heroes |
| Consumers | subtype extras (§6.15), D8b set (§7.5), job gate (§6.10), cautions |
| Cohort (node, 70) | fixative_film 39 · wax_lipid 28 · natural_film 11 · particulate 11 · silicone_coat 6 · salt 5 · humectant_only 3 |

### 6.2 `hold_route` (F)

| Field | Rule |
|---|---|
| Values | `present` · `absent` · `ambiguous` — the D6 "real hold" sense (fixative-class film), **never a strength** |
| Decision | Deterministic, above T_S. `present`: ≥ 1 FX-1…FX-4 member. `ambiguous`: no FX member, but an FX-R member (PQ-11/-16/-46, PH1-6) or an FX-U member; or an FX member that is `unpositioned` under §3.3. `absent`: otherwise. An FX member only at/below T_S ⇒ `absent` + `fixative_below_tail` note |
| Never | Starch, salt, particles, waxes, silicones (Polysilicone-29 alone = absent, LI L5 placement); a captured hold level never moves it (LI T7) |
| Counter-signals | LI L5 anionic/cationic pairing check — an identity check only |
| Evidence / confidence | E2 on every record (LI §7.7 freeze note), as §6.1 |
| Consumers | neutral fact (§7.6), gel film type, refresher/shine extras, D8b, job gate |
| Cohort (node) | present 39 (3 rest on FX-4 alone: Elnett Haarspray, Barber Club Pomade, taft x Gliss Shine Coat) · ambiguous 1 (`alcina-styling-mousse-aerosol`, PQ-11 r5) · absent 30 |

### 6.3 `weight` (F) `[PH1-2, PH1-4, PH2-8; LI §7.5 reused]`

| Field | Rule |
|---|---|
| Values | production scale `light · medium · rich · unknown` (research trace LI `low · moderate · high`) |
| Decision | Structured judgment on the **LI WT anchors, unchanged in substance**, above T_S. Persistent families: (a) WL-6 oils + WL-7 esters; (b) WL-1 waxes, WL-2/WL-3 hydrocarbons, WL-4 butters, WL-5 lanolin; (c) FA-1 fatty alcohols; (d) SI-1 persistent silicones; (e) CA-3 cationic polymers and the polymeric CA-4.<br>• `light` (LI `low`): no persistent family above T_S and no LGN pair.<br>• `medium` (LI `moderate`): exactly one family; **or** ≥ 2 families with no rich member (the multi-family counter-signal is mandatory: name every family and its rank).<br>• `rich` (LI `high`): **an LGN pair** — a CA-1/CA-2 monomeric cationic **and** an FA-1 fatty alcohol both above T_S (LI §7.5 `high` row) — **and/or** ≥ 2 families with ≥ 1 rich member (lexicon WL-1, WL-2, Paraffinum Liquidum, WL-4, WL-5, the WL-6 rich band).<br>• `unknown`: incomplete INCI, T18 tier 2, or §3.3 readings that disagree |
| Ruled — PH2-8 (settles property set §9 item 12) | **Weight = the exact Leave-in WT rule, including the LGN-pair route to `high`/`rich`; no extra anhydrous route `[PH2-8]`.** (a) The property set's extra "anhydrous base with a rich member ⇒ rich" route is **not carried**: LI §7.5 has no such row, and dropping it moves no cohort value (node). (b) **Ruled — PH2-12:** the rich-member list keeps waxes, paraffin, microcrystalline wax and lanolin (Styling-local; moves into the Leave-in addendum after lock): PH1-2 adopted PS3, whose text names "petrolatum, wax, butter or castor oil", and Mask R8 placed lanolin heavy. (c) **The LI LGN-pair route to `high` is carried** (PH2-8), because PH1-4 reuses "the Leave-in WT rule" and that row is part of it. Consequence vs the property-set dry run: `balea-professional-styling-cream-traumlocken` (Cetearyl Alcohol r2 + Cetrimonium Chloride r9) and `john-frieda-frizz-ease-traumlocken-lockencreme` read `rich`, not `medium` |
| Never | form, subtype or name (LI G9; FS-1, FS-2, FS-17, FS-18); fixatives, natural films, particles, salts, humectants, volatiles; an **unresolved quat** never forms an LGN pair (LI §7.6: `maria-nila-curlicue-cream`, Quaternium-95 r11 ⇒ `medium`, review `quat_structure_unresolved`) |
| Counter-signals | rich member at `T_S − 1` ⇒ `moderate`; a C1/C2 weight claim („ohne zu beschweren", „für feines Haar") against `medium`/`rich` ⇒ `weight_claim_conflict` + review, value unchanged (LI §10.1.2 parity: `schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`, `medium` via Guar HPTC r6) |
| Evidence / confidence | E2; ceiling `moderate` unless the families are fully readable above a plausible T_S (LI §7.5 ceiling) |
| Consumers | `thickness_fit` echo (a ranking signal, never an exclusion); buildup note limb 2 |
| Cohort (node) | light 32 · medium 23 · rich 15 (`molding` 10 of 11 `rich`) |

### 6.4 Buildup note (Hinweise) `[PH1-4, PH2-5; LI §8.5 reused]`

| Field | Rule |
|---|---|
| Values | entry in the `hinweise` record (LI §8.6): fired / not fired. **A note, not a score.** No „schwer auswaschbar" field exists (PH1-4) |
| Decision | LI §8.5 unchanged: fires when **limb 1** — LI §7.6 `permanent_cationic` above T_S (any Polyquaternium-n incl. PQ-11/-16/-46, Guar HPTC, Hydroxypropyl Guar HPTC, Silicone Quaternium-n, Quaternium-80, cationised proteins) — **or limb 2** — `weight: rich` (which always has a persistent family above T_S). **Limb 1 is reused literally `[PH2-5]`:** the lane reads the LI §7.6 persistence enumeration (`permanent_cationic`) internally, **only to feed the note**; Styling gets no PERS field and no persistence value is stored or shown. Example: Alcina Styling Mousse (PQ-11 r5) gets the note |
| Copy (LI §18, reused) | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |
| Never | a duration, wash count or clarification schedule (LI G11); never an exclusion; never a skin claim |
| Deferred | Whether a `rich` Styling product used weekly adds +1 to the Deep-Cleansing reset load: Personal-Plan decision (PH1-4) |
| Cohort (node) | fires on 22 of 70: 10 via limb 1 (Taft Balm, Balea Pro Traumlocken, Taft Volumen Schaumfestiger, Syoss Schaumfestiger, Alcina Mousse, Alcina Föhn Lotion, Alcina Ansatz Volumen, Taft Texturspray, Wella Flowing Form, John Frieda Traumlocken) and 12 more via limb 2 only |

### 6.5 `alcohol_note` (F) `[PH1-3]`

| Field | Rule |
|---|---|
| Values | `fires` · `does_not_fire` |
| Decision | Deterministic: fires when an AL-1 member (Alcohol, Alcohol Denat., SD Alcohol n, Ethanol, Isopropyl Alcohol) is among the **first 3 declared ingredients** (water and propellants counted). Fatty alcohols and Benzyl Alcohol never count (lexicon AL-X) |
| Copy (LI alcohol note, reused) | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| Never | an exclusion, a ranking penalty, an „ohne Alkohol" filter, or "damages hair" (charter §10). Retailer „ohne Alkohol" chips never override it |
| Evidence / confidence | E1 observation driving a note; `high` on a complete INCI, `low` on a source conflict |
| Cohort (node) | fires on 28 of 70 (e.g. `john-frieda-volume-lift-ansatz-booster`, Alcohol Denat. r1; `alverde-beach-waves-spray-seaside-balance`, Alcohol denat. r3 despite the dm chip). Isopropyl Alcohol beyond rank 3 (`schwarzkopf-taft-styling-balm-locken-halt-3` r14) does not fire |

### 6.6 `ingredient_flags` (F)

As property set §2.8, on the **whole** list: `silicones` (any silicone incl. PEG-modified, volatile, Polysilicone-15; lexicon SI-1…SI-4), `oils` (WL-6 non-fragrance oils, WL-4 butters, WL-3 mineral oil; never essential oils or ethoxylated oils), `fragrance` (FR-1), `salt` (SA-1 or Sodium Chloride), `propellant` (VC-1); `fixative_family[]` ⊂ {`pvp_vp`, `acrylate`, `polyurethane`, `vinyl_acetate`, `pvm_ma`, `natural_film`} from members **above T_S**. Free-from claims and chips never override a flag (`color-wow-dream-coat-supernatural-spray` „silikonfrei" on Douglas ⇒ `silicones: true`, Polysilicone-29 r3). An unreadable token (lexicon §0.4 item 3) sets `flags_incomplete` + review (`balea-locken-revitalizing-spray` „CITRONELLOL SODIUM CHLORIDE" hides a `salt` flag). Flags never predict tolerance (LI L8). Cohort (node): fragrance 66 · propellant 23 · oils 22 · silicones 12 · salt 10.

### 6.7 `provides_heat_protection` (C + F) `[PH1-15, PH2-4; LI §7.8, §13 reused]`

| Field | Rule |
|---|---|
| Values | `true` · `false` (binary). Research trace: LI's `not_claimed · claim_only · formula_plausible · product_tested` |
| Decision | `true` **only** when (1) a **C1/C2 heat-protection claim** exists (LI §2.4.1; `C2_cross_market_verified` allowed) **and** (2) a closed-list **HP-1 (LI L9) member sits above T_S** (trace `formula_plausible`). **The heat check reads Styling's own tail marker T_S (the Mask rule), the stricter side `[PH2-4]`**, not T_LI. Otherwise `false`; a C1/C2 claim without the L9 pass is still **shown** („Hitzeschutz laut Hersteller") but never fills the Personal-Plan heat role. No claim + L9 member ⇒ `false`, `not_claimed` (a formula never manufactures a claim) |
| Differences from LI, encoded as ruled | LI §13.3 sets `true` on a claim alone (trace `claim_only`, review); PH1-15 requires the L9 pass, so Styling's `true` is narrower. LI's `product_tested` (claim + exact-product test) is reachable in the trace but, under PH1-15's text, sets `true` only with the L9 pass as well; `product_tested` without an L9 member stays `false` until ruled (PH2-4; §13 item 5) |
| What is a heat claim | Protection from heat damage („Hitzeschutz bis 230 °C", „schützt vor Föhnschäden", „schützt vor Sprödigkeit und Haarbruch, die durch das Föhnen entstehen"). **Not** a heat claim: activation („Föhnhitze verstärkt den Volumen-Effekt", „wärmeaktiviertes Polymer") — that is §6.13 |
| Never | a grade, temperature or percentage (LI G10, FS-14); generic silicone, Polysilicone-29, generic/cationised protein, panthenol, oils (FS-7, FS-24) |
| Cohort (node) | 11 committed or held Styling records carry a C1/C2 heat claim; **0 reach `true`**. `john-frieda-volume-lift-ansatz-booster` (C2 „bis zu 220 °C") has VP/DMAPA Acrylates Copolymer (HP-1) at r10, behind T_S (Parfum r6) but ahead of T_LI (Benzalkonium Chloride r11) — it is the case PH2-4 decided: heat polymer after Parfum ⇒ `provides_heat_protection = false` (the claim is still shown). `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` (C1 „Hitzeschutz bis 230° C", Hydrolyzed Wheat Protein r12 above both markers) would be `true` but routes `leave_in` (§4.8) |

### 6.8 `finish` (C, F sanity) `[PH1-5]`

| Field | Rule |
|---|---|
| Values | `matt · natürlich · glänzend · unbekannt` |
| Decision | Lexicon on C1/C2 text incl. the confirmed name: `matt` (matt, mattierend, „kein Glanz"); `glänzend` (Glanz, glänzend, Shine, Gloss, Brillanz, Wet Look); `natürlich` („natürliches Finish", „Natural Look", **„natürlicher Glanz"**, PH1-5). Brand shine numbers are recorded; words decide. Both a matt and a shine word ⇒ `unbekannt` + review. **Unclaimed ⇒ `unbekannt`, never formula-derived** |
| Not finish words | movement or texture words („natürlicher Haarschwung", „Sprungkraft", „geschmeidig", „seidig") |
| Counter-signal (F sanity, property set §2.11) | `matt` on an oil/silicone-led formula with no particulate, structuring wax or fatty-acid soap, or `glänzend` on a particulate-led dry powder ⇒ `finish_formula_conflict` review; **the value never changes** |
| Evidence / confidence | E0 claim; `high` on an explicit C1/C2 word |
| Consumers | finish preference, asked only when `molding` or `texture_spray` is in play |

### 6.9 `flexibility` (C) `[PH1-5]`

| Field | Rule |
|---|---|
| Values | `beweglich · fest · unbekannt` |
| Decision | `beweglich`: flexibel, beweglich, elastisch, formbar, neu formbar/nachstylbar, variabel, or a negated rigidity word („ohne zu verhärten", „ohne steif zu wirken"). `fest`: Kleber, Freeze, betonhart, steif. Both ⇒ `unbekannt` + review; neither ⇒ `unbekannt`. Brand flex numbers (Alcina Flex-Faktor x/10) are recorded; words decide |
| Not flexibility words | „ohne zu verkleben" (PH1-5); „ausbürstbar" (v0 convention, property set §9 item 15); „Crunch" (a cast to knead out ⇒ gel `cast_expected`, never `fest`, PH1-5) |
| Never | a strength word, and vice versa (§7.4) |

### 6.10 `primary_job` + `secondary_jobs` (C + F gate)

| Field | Rule |
|---|---|
| Values | one primary, ≤ 2 secondaries from `definition · volume · texture · sleek · hold_fix · shine · frizz_control · refresh` |
| Decision | Structured judgment: primary = the job the C1/C2 lead promise states; secondaries = up to two further jobs the C1/C2 claims state explicitly. **Formula gate** (property set §2.12): `hold_fix` ⇒ the D8b hold-mechanism set (§7.5); `volume` ⇒ fixative_film / natural_film / particulate / salt; `texture` ⇒ particulate / salt / structuring wax_lipid / a film; `sleek` ⇒ silicone_coat / wax_lipid / fixative_film; `shine` ⇒ wax_lipid / silicone_coat; `frizz_control` ⇒ silicone_coat / wax_lipid / a film; `definition` ⇒ any mechanism except humectant_only/none; `refresh` ⇒ any. A failing secondary is **dropped and recorded**; a failing primary is **kept** and tagged `job_formula_conflict` + review |
| Never | duration or humidity wording as a job („bis zu 48 h", „100H" ⇒ `captured_claims`) |
| No C1/C2 promise | only for a ruling-named route (§4.1 exception): jobs empty + `claim_authority_gap` |

### 6.11 `application_moment` (U)

| Field | Rule |
|---|---|
| Values | `damp_before_drying · before_heat · dry_finish · dry_restyle · second_day · unresolved`; primary = the lead instruction, others in `also[]` |
| Decision | Transcription against the property-set anchors (§2.13), from the verbatim directions (any G1 tier; not claim-gated). **Reading the two damp anchors `[operational — property set §2.13 anchor text]`:** `before_heat` when the directions make a heat step a **required** next step (blow-dry or iron named, no air-dry option) or apply to dry hair before a hot tool; `damp_before_drying` when air-drying is allowed, drying is unspecified, or blow-drying is offered as optional („für optimales Ergebnis föhnen"). This resolves property set §9 item 4: `alcina-foehn-lotion` and `balea-foehnlotion-volume-effect` both read `before_heat` if their directions require the blow-dry. `second_day` only when the **directions** lead with refreshing between washes — marketing copy („ideal zum Auffrischen") is not directions |
| Counter-signals | missing, conflicting or copied directions ⇒ `unresolved` + review (LI G5). Never from the formula or the name |
| Confidence | `high` on pack or manufacturer directions; `moderate` on retailer-only directions |

### 6.12 `target_zone` (U)

As property set §2.14: `roots` (directions lead with Ansatz), `lengths`, `surface`, `hairline` (edges, baby hair, brows), `all`; no directions ⇒ empty + review. Feeds the subtype tie-break (§5), the edge branch and the cautions.

### 6.13 `heat_activated` (U, C raise)

As property set §2.15: `yes` when the directions or a C1/C2 statement say heat activates, sets or strengthens the effect (`schwarzkopf-taft-schaumfestiger-volumen-halt-4-feines-haar`: „Föhnhitze verstärkt den Volumen-Effekt"); `no` when directions give heat no such role; `unresolved` when activation appears only at C3/C5 (`color-wow-dream-coat-supernatural-spray`, Douglas „wärmeaktiviertes Polymer"). After unblinding, a C1/C2 activation statement may raise `no` to `yes` (property set §7 crossing 1). **Never heat protection** (§6.7).

### 6.14 `captured_claims` (C)

Typed verbatim list (§2.2 A3), all tiers recorded with their tier. **Consumers: none** for selection, ranking or copy, except that a C1/C2 heat claim feeds §6.7 and its display line. Humidity follows LI T9; „bis zu 48 h" is never shown; hair-type claims never set fit; free-from claims never override flags; health-adjacent claims („Sanft zu Haar und Kopfhaut", „Dermatologisch bestätigte Hautverträglichkeit") are recorded and never repeated (charter §10).

### 6.15 Subtype extras

As property set §3; four are new fields, the rest are views:

| Subtype | Extra | Rule |
|---|---|---|
| `gel` | film type (view) | `synthetic` (hold_route present) · `natural` (natural_film, no FX) · `mixed` |
| `gel` | `cast_expected` (C) | `yes` when C1/C2 text or the confirmed name promises a cast („Crunch", „Cast", „knusprig"), else `unbekannt` |
| `curl_cream` | `conditioning_co_load` (F) | `rich` = LI COND ≥ moderate (the D7 read); `light` = thin/absent (the T15 `excluded_styling_first` read) |
| `molding` | `form_label` (identity) | `wax · paste · clay · fiber · pomade · cream` from the confirmed name; display only |
| `molding` | `base` (F) | `anhydrous` (no water declared anywhere) · `water_based` |
| `smoothing_styler` | coating type (view) | silicone_coat · fixative_film · wax_lipid |
| `shine_finish` | base; fixative present (views) | wax_lipid vs silicone_coat; hold_route |
| `salt_spray` | real salt vs salt-free (view) | `salt` mechanism present or not |
| `texture_spray` / `hair_powder` | particle type (view) | PT members |
| `refresher` | type (view) | `humectant_only` vs `hold_route: present` vs lipid |
| `mousse`, `blowdry_lotion`, `hairspray` | views of `target_zone`, `heat_activated`, format, §6.8/§6.9 | — |

### 6.16 Derived echoes and cautions (D; computed last)

As property set §4 (LI T8 / Mask R9: annotations, never independently reviewed): `thickness_fit` from `weight` (ranking only), `texture_fit`, `length_fit`, the hold display and neutral fact (§7.6), the alcohol note (§6.5), the buildup note (§6.4) and the cosmetic / medically adjacent cautions, kept in separate layers (charter §10). The PH1-3 ruling drops the former alcohol + roots caution (property set §8, PS4). Matching policy owns the final tables (charter §14).

---

## 7. Hold level normalisation, D8b flag, neutral fact (lane step 6) `[SD5, D8, D8b, PH1-8, PH1-9]`

### 7.1 Where the level is used (D8)

| Subtypes | Role |
|---|---|
| `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray`, `molding` | A stated, fitting level ranks first; **no level ⇒ still eligible**, ranked after, shown „Halt: keine Herstellerangabe". Never excluded |
| `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler`, `refresher` | Captured and stored; **no part in selection** (finish, weight and application decide) |

### 7.2 Assignment order (deterministic, claim-only)

1. **Only C1/C2 counts**, including house-brand C2 (§2.2 A4; the dm „Halt" attribute on Balea/alverde, PH2-7) and `C2_cross_market_verified`. Retailer copy, retailer filter chips and attributes on third-party products (dm „Halt", Douglas „Haltgrad") and C5 pages are tier-stamped traces and **never assign** (LI §2.4.1 rule 1; LI T7).
2. **Brand number on a known scale ⇒ table §7.3.**
3. **The number beats the word** on the same pack or page (Henkel words inflate: Syoss calls Haltegrad 4 „extra stark").
4. **Brand word ladders** ⇒ table §7.3. An unranked step ⇒ `review`.
5. **Strength words ⇒ §7.4.** Flexibility, look and unquantified words are not strength words.
6. **No strength claim ⇒ `null`** („Halt: keine Herstellerangabe"). **Never `0`** unless the product claims „kein Halt" (D8); **never derived from the formula** in either direction; **never borrowed** from a similar formula or a sibling (Balea Haarpuder keeps its own „starker Halt" although got2b's near-identical base says „natürlicher Halt"). The gap is queued for pack-photo fill.
7. **Pack (C1) vs manufacturer page (C2) disagree on hold ⇒ `null`**, both claims kept, review `hold_claim_conflict` (PH1-8).

Confidence: `high` for a number on a known scale or an unambiguous word; `moderate` for house-brand C2 (ownership confirmed in review), cross-market C2, or a mid-ladder step. Internal only.

### 7.3 Normalisation tables (brand × format; mirror `TABLES` in `build-calibration-r2.js`)

| Brand scale (formats) | ⇒ 1 | ⇒ 2 | ⇒ 3 | ⇒ 4 | Note |
|---|---|---|---|---|---|
| Henkel Haltegrad x/5 — Taft, Syoss, got2b sprays, mousses, Föhnspray | 1–2 | 3 | 4 | 5 / 5+ | numbers shared across Henkel brands; number beats inflated words |
| Wellaflex dots x/5; Maria Nila x/5 | 1–2 | 3 | 4 | 5 / 5+ | |
| Printed 1–6 — NIVEA MEN, Gard, Taft 6 | 1–2 | 3 | 4 | 5–6 | |
| Alcina Hold-Faktor x/10 | 1–2 | 3–5 | 6–7 | 8–10 | Flex-Faktor recorded separately (§6.9) |
| **Taft gels** (scale 4–14, no legend) | — | — | — | — | **number not comparable ⇒ words only** („maximal" ⇒ 4); no word ⇒ `null` |
| Elnett word ladder | — | Normal | Stark | Extra stark | „Sehr stark" unranked ⇒ `review` |
| Brands with no stated maximum — Wella EIMI Haltegrad, American Crew Haltfaktor | — | — | — | — | **words decide**; the number is recorded |

New brand scales are added only with a published legend and maximum; until then the brand is words-only.

### 7.4 Word lexicon

| Strength words | Level |
|---|---|
| leicht, sanft, soft, weich | 1 |
| mittel, normal | 2 |
| stark | 3 |
| sehr / extra / ultra / mega / extrem stark, maximal, Max, Power, Kleber | 4 |

„Power" is present in both concept §4 and the build-script `TABLES` word list (the property set's earlier note that it was missing is obsolete).

**Never strength (⇒ `null` when nothing else is stated):** flexibility words (§6.9); look words („natürlich", „natürlich aussehend", „natürlicher Halt"); unquantified words („langanhaltend", „perfekt", „zuverlässig", „kraftvoll"); duration („bis zu 48 h", „24 h definierte Locken", „3 Tage") ⇒ `captured_claims`.

### 7.5 D8b plausibility flag (internal; **never changes a level**)

**Hold-mechanism set:** `hold_route` `present` or `ambiguous`, **or** `natural_film`, `particulate` or `salt` in `result_mechanisms`, **or** `wax_lipid` with ≥ 1 `structuring` member (lexicon WL-1, WL-2, WL-8). Non-structuring oils, butters, esters, mineral oil, silicone coats and humectants are not hold mechanisms (property set §6).

**Claims it reads:** C1/C2 claims, plus hold words in the product name **at any tier** (a confirmed name is C1; D8b names Cantu „Extra Hold"). Never retailer chips.

1. A strength claim of ≥ „stark", or **any** hold claim on a `shine_finish`, `smoothing_styler` or `refresher`, with **no** member of the hold-mechanism set above T_S ⇒ `claim_formula_conflict`, review.
2. Same brand + character-identical INCI + different stated level ⇒ `d8b_identical_inci_sibling`, verify against the pack. Neither level is borrowed.

Cohort (node): rule 1 fires on `cantu-shea-butter-extra-hold-edge-stay-gel` (name „Extra Hold", only Shea r7) and `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt` (C1 „Starker Halt", silicone_coat only; level 3 kept, PH1-14). Rule 2 fires on `schwarzkopf-taft-haarspray-classic-halt-3` (2) vs `schwarzkopf-taft-haarspray-glanz-halt-4` (3). Duration-only claims (`balea-locken-revitalizing-spray` „bis zu 24 Stunden definierte Locken") are not hold claims and do not fire it.

### 7.6 Neutral fact `[PH1-9, D8b]`

„Enthält Stylingpolymere (z. B. ‹first FX member above T_S›)" is shown **iff** the subtype is one of the six hold-relevant subtypes (§7.1), the level is `null`, and `hold_route = present`. FX-R alone (`ambiguous`), natural films, waxes, salts and particles never trigger it. It is an E1 ingredient observation, never a rating. Cohort (node): 9 records — `syoss-curl-cream-gel-3in1` (PVP r2), `john-frieda-volume-lift-ansatz-booster` (PVP r3), `balea-ansatzvolumen-booster` (Butyl Ester of PVM/MA Copolymer r5), `american-crew-fiber` (PVP r4), `loreal-men-expert-barber-club-styling-pomade` (VP/DMAEMA r8), `balea-styling-creme-power-flex` (PVP r3), `john-frieda-frizz-ease-traumlocken-lockencreme` (Acrylates Copolymer r2), `kevin-murphy-killer-curls` (Acrylates Copolymer r4), `balea-haargel-hair-jelly` (PVP r6). Whether a „pflanzliche Filmbildner" variant is wanted stays open (property set §6).

### 7.7 Comparability

Levels compare only within a hold family — film (gel, curl_cream, mousse, blowdry_lotion, hairspray, salt and texture sprays), molding, powder. The app never compares hold across families (charter §11).

### 7.8 Worked normalisations

The 17 worked rows of property set §5.6 are binding examples of this section and are not repeated here. Two additions: `alcina-styling-mousse-aerosol` C2 „Starker, flexibler Halt" + Hold-Faktor 5/10 ⇒ number beats word ⇒ **2**, flexibility `beweglich`; `balea-men-pomade-haar-bart-2in1` house-brand dm attribute „mittlerer Halt" ⇒ **2** (moderate, house-brand review), „langanhaltenden Halt" is unquantified.

---

## 8. Review triggers

Each trigger is a named id. A record lists every trigger that fired; none of them changes a value unless its own rule says so.

| Trigger | Fires when | Section |
|---|---|---|
| `s0_evidence_gate` | no C1/C2 promise, no directions, or incomplete INCI | §4.1 |
| `s0_claim_conflict` | C1 and C2 lead with different promise classes | §4.1 |
| `formula_source_conflict` / `formula_or_identity_conflict` | LI T18 tier 2 / tier 1 residual; two INCIs under one GTIN | §2.2 A2 |
| `s0_mixed_promise` | step 2 `mixed` and D7 did not fire | §4.2 |
| `li_g0_provisional` | LI G0 returns `provisional_boundary` | §4.3 |
| `pending_leave_in_addendum` | PH1-16 hold | §4.5 |
| `ruled_route_override` | a §4.6 registry route differs from the S0 letter | §4.6 |
| `claim_authority_gap` | a claim-keyed field had no C1/C2 source (LI §2.4.1 rule 1) | §2.1 |
| `house_brand_ownership` | a C2 claim rests on LI rule 6 | §2.2 A4 |
| `care_decided_below_preservative` · `care_below_dose_yardstick` · `care_yardstick_missing` | the D6 care test decided below T_LI, below the yardstick, or found no yardstick | §4.3 D6 |
| `tail_marker_unresolved` · `tail_marker_absent` | T_S third limb or no T_S class | §3.3 |
| `tail_marker_implausible` · `tail_marker_vacuous` | T_LI clauses 5 / 6 (LI §3.1.1) | §3.3 |
| `candidate_below_tail` | a below-marker species would change a value | §3.4 |
| `natural_film_unsettled` | an NF-U member was credited | §6.1 |
| `pq_only_film_former` | `hold_route: ambiguous` via FX-R | §6.2 |
| `unsettled_film_former` | `hold_route: ambiguous` via FX-U | §6.2 |
| `quat_structure_unresolved` | an opaque Quaternium-n | §6.3 |
| `weight_claim_conflict` | C1/C2 weight claim vs `medium`/`rich` | §6.3 |
| `flags_incomplete` · `transcription_defect` | an unreadable INCI token | §6.6 |
| `heat_claim_without_l9` | C1/C2 heat claim, no HP-1 above the marker (shown, not used) | §6.7 |
| `finish_formula_conflict` | §6.8 sanity check | §6.8 |
| `finish_word_conflict` · `flex_word_conflict` | both a matt and a shine word; both a flex and a rigidity word | §6.8, §6.9 |
| `job_formula_conflict` | the primary job fails the formula gate | §6.10 |
| `directions_unresolved` | missing / conflicting / copied directions | §6.11 |
| `hold_claim_conflict` | pack vs page hold conflict | §7.2 |
| `hold_ladder_unranked` | an unranked brand step („Sehr stark") | §7.3 |
| `claim_formula_conflict` · `d8b_identical_inci_sibling` | D8b rules 1 / 2 | §7.5 |
| `species_reading_conflict` | one species at one rank read as architecture by one rule and as trace by another (LI §2.3.2 cross-rule clause) | §3 |
| `low_confidence` | any value at `low` | §3.1 |

---

## 9. False-signal register

LI FS-1…FS-27 (LI §12) apply unchanged where relevant (FS-1/2/17/18 form ≠ weight; FS-3/20 silicone-free ≠ low buildup; FS-4 volatile ≠ no residue; FS-6/15 humectants ≠ anti-frizz; FS-7/14/24 heat; FS-9 hold polymer ≠ care; FS-25 bottle rheology). Styling-specific false signals (SFS) — producing one is a rule violation:

| ID | False signal | Correct reading |
|---|---|---|
| SFS-1 | A name decides the formula or the subtype: „Gel Wax" = wax, „Texture Clay" = clay, „Fiber" = fibres, „Haaröl" = oil formula | Names route only under D2 and D7 (§4.4); the INCI decides mechanisms |
| SFS-2 | A retailer filter chip or attribute is a claim: dm „ohne Alkohol", Douglas „silikonfrei", dm/Douglas „Halt"/„Haltgrad" on a third-party product | C3/C4 trace; INCI governs flags; only C1/C2 (incl. house brand) assigns a level |
| SFS-3 | A duration is a strength: „bis zu 48 h Halt", „24 h definierte Locken", „3 Tage glatt" | `captured_claims`; never a level, never a job |
| SFS-4 | A thick gel or a high carbomer rank means strong hold | RH-1 is never a hold route |
| SFS-5 | Starch, salt or silica is "real hold" for D6 | D6 clarification: fixative-class only |
| SFS-6 | PQ-11/-16/-46 alone is a fixative | PH1-6: `ambiguous` + review |
| SFS-7 | A strength can be estimated from the formula („PVP rank 3 ⇒ starker Halt") | D8/D8b: never; best formula rule tested was right 3 of 6 (`round2/hold-research-ingredients.md`) |
| SFS-8 | Brand numbers compare across brands (Taft gel „Halt 14" > Syoss „Haltegrad 5") | §7.3: tables per brand; Taft gels words-only |
| SFS-9 | „Hitzeschutz bis 230 °C" is a protection grade, or any heat claim fills the heat role | PH1-15: binary, claim **and** L9 pass; temperatures never used |
| SFS-10 | Heat activation („wärmeaktiviert", „Föhnhitze verstärkt") is heat protection | §6.13 vs §6.7 |
| SFS-11 | Fatty alcohols trigger the alcohol note | PH1-3: AL-1 only |
| SFS-12 | „Natürlicher Glanz" is a shine finish; „ohne zu verkleben" is flexibility; „Crunch" is `fest` | PH1-5 |
| SFS-13 | Marketing "refresh" copy is a second-day direction | §6.11: only directions set `second_day` |
| SFS-14 | A "Leave-In" word in a name makes a product Leave-in (Balea „Leave-In Glow&Shine Finishing Spray") | the promise class and LI G0 decide (§4.2–§4.3) |
| SFS-15 | A care or ingredient call-out („mit pflegendem Camelinaöl") makes a promise `mixed` or `care` | §4.2: only co-equal lead jobs make `mixed` |
| SFS-16 | A heat claim on a curl cream turns it into a heat protectant | primary promise decides (3.3); PH1-12 for the D7 band |

---

## 10. Record and blind-lane envelope

### 10.1 Record (one per product; JSON shape, field ownership in brackets)

```jsonc
{
  "sample_id": "…", "standard_version": "styling-inci-v0.1", "lexicon_version": "styling-lexicon-v0.1",
  "identity": { "brand": "…", "product_name": "…", "gtin": "…", "size": "…", "format": "gel|spray_gel|jelly|cream|foam|pump_spray|aerosol|wax|paste|pomade|powder",
                "identity_status": "verified|…", "inci_raw": "…", "inci_normalised": [{"rank":1,"inci":"…","lexicon_id":"…"}],
                "inci_source": {"tier":"C1|C2|C3|C4|C5","url":"…","date":"…"}, "transcription_repairs": [] },          // [capture]
  "directions": { "verbatim": "…", "tier": "…", "source": "…", "date": "…" },                                     // [capture, U input]
  "claims": [ { "type": "promise|hold|flexibility|finish|cast|duration|humidity|heat_protection|heat_activation|hair_type|free_from|other",
                "raw": "…", "tier": "C1|C2|C2_house_brand|C2_cross_market_verified|C3|C4|C5", "source": "…", "date": "…",
                "number": null, "scale_as_written": null, "words": null } ],                                       // [capture, C]
  "tail_marker": { "T_S": {"inci":"…","rank":0,"status":"plausible|unresolved|absent","alt":null},
                   "T_LI": {"inci":"…","rank":0,"status":"plausible|implausible|vacuous|none_visible"} },       // [F]
  "s0": { "route": "…", "boundary_reason": null, "lean_route": null, "promise_class": "…", "li_function": "yes|no",
          "pair_rule": "3.1|3.2|3.3|3.4(i)|3.4(ii)|3.4(iii)|3.5", "li_g0_state": null, "d6": null, "d7": null,
          "ruled_route": null, "rationale": "…" },                                                               // [R]
  "styling_subtype": "…|null",                                                                                    // [R]
  "properties": {
    "result_mechanisms": [{"value":"fixative_film","members":[{"inci":"PVP","rank":3}]}],                          // [F]
    "hold_route": "present|absent|ambiguous", "weight": "light|medium|rich|unknown", "alcohol_note": "fires|does_not_fire",
    "ingredient_flags": {"silicones":false,"oils":false,"fragrance":true,"salt":false,"propellant":false,"fixative_family":["pvp_vp"]},
    "provides_heat_protection": {"value": false, "trace": "not_claimed|claim_only|formula_plausible|product_tested"}, // [C+F]
    "chaarlie_hold_level": {"value": 4, "raw": "…", "scale": "…", "tier": "C2", "basis": "…"},                   // [C]
    "flexibility": "…", "finish": "…", "primary_job": "…", "secondary_jobs": [], "dropped_jobs": [],               // [C]
    "application_moment": {"primary":"…","also":[]}, "target_zone": "…", "heat_activated": "yes|no|unresolved",    // [U]
    "captured_claims": [], "subtype_extras": {}                                                                   // [C]/[F]/[view]
  },
  "hinweise": { "fired": [ {"flag":"buildup|alcohol_note","basis":"…","note":"…"} ] },                         // [D] always emitted, may be empty
  "derived": { "thickness_fit": "…", "texture_fit": "…", "length_fit": "…", "hold_display": "…", "neutral_fact": null, "cautions": [] }, // [D]
  "evidence": { "<property>": {"decision_type":"…","confidence":"high|moderate|low","evidence_level":"E0|E1|E2","formula_observations":[],"counter_signals":[]} },
  "review_triggers": [], "uncertain_fields": [], "blind_to_final_changes": []
}
```

### 10.2 Blind lanes (PH1-11 (b)) — separate sealed S0 packet `[PH2-6]`

| Lane input | Contents | Classifies |
|---|---|---|
| **S0 packet** (sealed, PH2-6) | normalised INCI with ranks and tiers; verbatim directions; the confirmed product name; the C1/C2 **promise and heat-protection** claims with tiers; format. **Removes** prior routes, subtypes, hold levels, finish/flexibility words, retailer chips, prices, calibration labels | `route`, `boundary_reason`, `promise_class`, `li_function`, pair rule, D6/D7 readings, lean subtype |
| **F/U packet** (sealed; property set §7). Each lane classifies F/U from the blind packet using **its own** S0 output (PH2-6) | normalised INCI; format; verbatim directions with brand, name and strength/look adjectives replaced by `[CLAIM]`; **the lane's own S0 output** | every F and U field (§1.2) |
| **Claim normalisation** (two independent passes; PH1-11 (c)) | frozen `claims[]` | `chaarlie_hold_level`, flexibility, finish, jobs, `cast_expected`, `form_label`, `captured_claims`, the C half of heat |
| **Derived last** | — | echoes, cautions, hold display, neutral fact |

Agreement: deterministic F fields must reach 100 %; a disagreement is a lexicon defect, fixed in the lexicon, never per product. U fields report agreement with coded causes. Routes report agreement per pair rule. Every blind-to-final change is recorded with its reason (property set §7). Cohort independence: products named in this file, the property set or the charter are confirmation-grade only (Mask round-1 lesson); the unseen set (PH1-11 (d)) compensates.

---

## 11. Worked examples (full procedure, expected outputs)

All twelve are real calibration records; ranks re-read from the raw INCI with lexicon v0.1 (node). They are named in this standard, so in calibration they are **confirmation-grade only** (§10.2). Where a value rests on a Phase 2 ruling, the cell cites its PH2 ID.

### 11.1 Schwarzkopf Taft Haargel POWER Halt 5 — `schwarzkopf-taft-power-haargel-halt-5`

| Step | Output |
|---|---|
| Identity | C2 schwarzkopf.de (promise, hold); INCI dm.de (retailer, complete); directions C3 dm.de (the brand page's Anwendung is empty) |
| Markers | T_S Phenoxyethanol r4, plausible · T_LI Phenoxyethanol r4 |
| S0 | step 1 pass · class `styling_result` („maximalen langanhaltenden Halt von Taft"), `li_function: no` · aqueous · 3.4 (ii) ⇒ **`styling`** (PH2-1). Cross-check without PH2-1: 3.4 (iii) LI G0 — PVP r3 (FX-1) above T_LI, no conditioning ⇒ `excluded_styling_first` with C2 hold positioning ⇒ `styling`. Not held (LI L5 sees PVP; Leave-in excludes it) |
| Subtype | `gel` (gel form; hold job; damp or dry) |
| F | mechanisms `fixative_film` [PVP r3] · hold_route `present` · weight `light` (no family: Carbomer RH-1, PEG-32/PEG-40 HCO EM-1, Panthenol HU-1) · buildup no · alcohol_note **fires** (Alcohol denat. r2) · flags fragrance; fixative_family [pvp_vp] |
| Heat | no heat claim ⇒ `false` (`not_claimed`) |
| Hold | Taft gel scale is not comparable (4–14) ⇒ words: „maximalen … Halt" (C2), name „POWER" ⇒ **4**, confidence high. D8b: no flag. Neutral fact: n/a (level stated) |
| C | finish `unbekannt` · flexibility `unbekannt` („ohne zu verkleben", PH1-5) · primary_job `hold_fix` (gate ✓) · gel film type `synthetic`, cast_expected `unbekannt` |
| U | application_moment `dry_restyle`, also `damp_before_drying` (moderate, retailer directions) · target_zone `all` · heat_activated `no` |
| Captured | duration „für bis zu 48 Stunden Halt" (C2) · humidity „schützt die Frisur vor Feuchtigkeit" (C2) · free-from „ohne Silikone" (C3). „Sanft zu Haar und Kopfhaut" (C3) is never repeated |
| Triggers | none |

### 11.2 Balea Professional Styling Cream Traumlocken — `balea-professional-styling-cream-traumlocken`

| Step | Output |
|---|---|
| Identity | house-brand C2 (dm ↔ Balea, LI rule 6) ⇒ `house_brand_ownership`; INCI dm.de; directions house-brand C2 |
| Markers | T_S Sodium Benzoate r10, plausible · T_LI Sodium Benzoate r10 |
| S0 | class **`mixed`** (definition + „Verbesserte Geschmeidigkeit" + „Hitzeschutz bis zu 220 °C", round-2 G0 lane) ⇒ PH1-12: D7 first — VP/VA Copolymer r3 above T_LI ✓; substantive conditioning (LI COND high: LGN pair Cetearyl Alcohol r2 + Cetrimonium Chloride r9, esters r4–r6, Polyquaternium-37 r8) ✓; sold as „Styling Cream Traumlocken" ✓ ⇒ **`styling` `curl_cream`**. PH1-16: the locked LI G0 letter reads `provisional_boundary` (G0 lane, LI §2.3.2 clause 2) ⇒ Leave-in could claim it ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `styling`/`curl_cream`** |
| F | mechanisms `fixative_film` [VP/VA r3] + `wax_lipid` [Isopropyl Palmitate r4, Dicaprylyl Carbonate r5, Caprylic/Capric Triglyceride r6] · hold_route `present` · weight **`rich`** (LGN pair; families a, c, e) — the property-set dry run said `medium` because it omitted LI's LGN row (§6.3) · buildup **fires** (limb 1: Polyquaternium-37 r8; limb 2: rich) · alcohol_note no · flags silicones (Dimethicone r12, tail), oils (Shea r17, tail), fragrance; candidate_below_tail: Dimethicone r12/Trimethylsiloxyphenyl Dimethicone r13 would add `silicone_coat` ⇒ review |
| Heat | house-brand C2 „Hitzeschutz bis zu 220 °C"; no HP-1 member ⇒ **`false`** (`claim_only`), shown „Hitzeschutz laut Hersteller", `heat_claim_without_l9` |
| Hold | house-brand dm attribute „mittlerer Halt" ⇒ **2**, confidence moderate; the round-2 G0 lane read that attribute as a C3 trace; PH2-7 rules it C2 `house_brand` ⇒ `house_brand_ownership` review (§13 item 6) |
| C | finish `glänzend` („perfekt definierte und glänzende Locken") · flexibility `unbekannt` · primary `definition` (gate ✓), secondary `frizz_control` („Schützt effektiv vor Frizz"; gate ✓) · conditioning_co_load `rich` |
| U | `damp_before_drying` („in handtuchtrockenes oder trockenes Haar einarbeiten"), also `dry_restyle` · `all` · heat_activated `no` |
| Triggers | `pending_leave_in_addendum`, `house_brand_ownership`, `heat_claim_without_l9`, `candidate_below_tail` |

### 11.3 Maria Nila Curlicue Cream — `maria-nila-curlicue-cream`

| Step | Output |
|---|---|
| Identity | C2 marianila.de (German shop, GTIN = round-1 EAN); INCI identical across sources; directions C2 |
| Markers | T_S Ethylhexylglycerin r13 **unresolved** (booster above Phenoxyethanol r16) ⇒ R2 marker Phenoxyethanol r16; `unpositioned`: Triethanolamine r14, antioxidant r15 (nothing that moves a value) · T_LI Ethylhexylglycerin r13 (on LI's list outright) |
| S0 | class `styling_result` („Definierende Pflegecreme … Sprungkraft": „Pflege-" is an attribute, not a co-equal job, §4.2), `li_function: yes` (curl definition) · aqueous · 3.4 (i) D7 not met (conditioning thin per T15) · 3.4 (iii) LI G0 = **T15 paradigm `excluded_styling_first`** (PVP r4 ahead of the fatty alcohol, no conditioning architecture) ⇒ **`styling` `curl_cream`** [T15, D3]. Not held (Leave-in excludes it). R2 would read Cetyl r5 + Quaternium-95 r11 as care — irrelevant, R2 is never the T15 test (PH1-13) |
| F | mechanisms `fixative_film` [PVP r4] · hold_route `present` · weight **`medium`** (family c: Cetyl Alcohol r5; Quaternium-95 r11 is an opaque quat ⇒ no LGN pair, `quat_structure_unresolved`) · buildup no · alcohol_note no · flags fragrance |
| Heat | no claim ⇒ `false` |
| Hold | C2 „Halt 3/5" ⇒ x/5 table ⇒ **2**, high |
| C | finish `unbekannt` („Betont und definiert Locken" names no finish) · flexibility `unbekannt` · primary `definition` · conditioning_co_load `light` |
| U | `damp_before_drying` (C2: towel-dried, „für optimales Ergebnis föhnen" = optional heat) · `all` · `no` |
| Triggers | `tail_marker_unresolved` (values agree under both readings), `quat_structure_unresolved` |

### 11.4 NEQI Diamond Glass Ultimate Styling Spray — `neqi-diamond-glass-ultimate-styling-spray`

| Step | Output |
|---|---|
| S0 | D3 names the route (§4.6), so the promise-class reading (styling and heat protection both lead: „Es kombiniert Styling mit intensivem Hitzeschutz") cannot stop it at `mixed`. Letter: `li_function: yes` (anti-frizz, smoothing film, heat-styling support) · aqueous · 3.4 (i) not a curl cream · 3.4 (iii) LI G0 = **T15 `incidental_film`** (Silicone Quaternium-18 + Polysilicone-29 conditioning film with one supporting fixative, VP/Methacrylamide/Vinyl Imidazole Copolymer r8) ⇒ `in_category` · D6 does not fire (real hold and real care) ⇒ **`leave_in`** [T15, D3] |
| Emission | identity, formula, route + rationale; Styling observations informational only: T_S Ethylhexylglycerin r9 unresolved; FX-1 r8 above T_LI; no Styling profile, no subtype |

### 11.5 Balea Locken Revitalizing Spray — `balea-locken-revitalizing-spray`

| Step | Output |
|---|---|
| Identity | house-brand C2; INCI dm.de with typos (`GLYERIN`, `BETANE` aliased) and one missing separator („CITRONELLOL SODIUM CHLORIDE", `transcription_defect`) |
| Markers | T_S Sodium Benzoate r4, plausible · T_LI Sodium Benzoate r4 |
| S0 | class `styling_result` („Revitalisierendes Lockenspray", „Für definierte Locken mit Sprungkraft"), `li_function: yes` (curl revival) · aqueous · (i) no fixative · (iii) LI G0 letter `in_category` (curl support, no L5) ⇒ **D6**: no FX above T_LI ✓; no real care (nothing above T_LI but Glycerin and Nitrogen; Coconut r13 and Shea r14 are below T_LI; no cationic; Cocamidopropyl Betaine is EM-1) ✓; styling-look promise ✓ ⇒ **`styling` `refresher`** [D6]. PH1-16: LI letter claims it ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `refresher`** |
| F | mechanisms `humectant_only` [Glycerin r2] · hold_route `absent` · weight `light`; `candidate_below_tail`: Coconut r13 + Shea r14 would make it `rich` ⇒ review · buildup no · alcohol_note no · flags oils, fragrance, propellant; salt unreadable ⇒ `flags_incomplete` |
| Heat / Hold | no heat claim ⇒ `false` · no hold claim ⇒ **`null`**; „bis zu 24 Stunden definierte Locken" is duration, not hold ⇒ no D8b flag (the calibration file's `claim_formula_conflict` predates §7.5) |
| C | primary `refresh` (gate ✓); `definition` and `frizz_control` claimed but **dropped** by the gate (humectant_only) and recorded · finish/flexibility `unbekannt` · refresher type `humectant_only` |
| U | **`dry_restyle`** („auf trockenes Haar sprühen, sanft einkneten"); not `second_day` — „Ideal zum Auffrischen" is marketing, not directions (the calibration file says `second_day`; re-label) · `all` · heat_activated `no` („ggf. diffusen" = optional) |
| Triggers | `pending_leave_in_addendum`, `house_brand_ownership`, `candidate_below_tail`, `flags_incomplete`, `transcription_defect` |

### 11.6 alverde Locken Refresh-Spray — `alverde-locken-refresh-spray`

| Step | Output |
|---|---|
| Markers | T_S Levulinic Acid r6 (PR-1), plausible · T_LI Levulinic Acid r6 |
| S0 | class `styling_result` („Spray zur Auffrischung von Locken & Wellen"), `li_function: yes` · aqueous · (iii) LI G0 letter `in_category` ⇒ **D6**: no FX ✓; R2 care test — oils r12, r14, r16 and Brassica Alcohol r21 sit below T_LI ⇒ not care; Brassicyl Isoleucinate Esylate r17 (CA-1) sits below the yardstick Lactic Acid r13 (first PH-1 after T_LI) ⇒ not care, `care_below_dose_yardstick` ✓; styling-look promise ✓ ⇒ **`styling` `refresher`** with review [PH1-13]. PH1-16 ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `refresher`** |
| F | mechanisms `humectant_only` [Propanediol r3, Glycerin r4] · hold_route `absent` · weight `light`; `candidate_below_tail`: the oils plus the Esylate/Brassica Alcohol pair would make it `rich` ⇒ review (lexicon §5.3) · buildup no · alcohol_note no · flags oils, fragrance |
| Heat / Hold | `false` · **`null`** |
| C | primary `refresh`; „geschmeidige Locken voller Sprungkraft" ⇒ `definition` dropped by the gate · free-from „Ohne Silikone & Sulfate" captured |
| U | `dry_finish` (sprayed strand by strand, no shaping), also `damp_before_drying` · `all` · `no` |
| Triggers | `pending_leave_in_addendum`, `care_decided_below_preservative`, `care_below_dose_yardstick`, `candidate_below_tail`, `house_brand_ownership` |

### 11.7 L'Oréal Elnett Stylingspray Hitzeschutz 3 Tage Glatt — `loreal-paris-elnett-stylingspray-hitzeschutz-3-tage-glatt`

| Step | Output |
|---|---|
| Identity | C1 pack front (dm image) + C2 L'Oréal article (real directions) + C2 archived product page; possibly delisted at the manufacturer |
| Markers | T_S Phenoxyethanol r5, plausible · T_LI Phenoxyethanol r5 |
| S0 | step 1: C1 pack front leads with the result („Hitze Styling-Spray, glatt 3 Tage, starker Halt"), C2 article leads with protection ⇒ letter `claim_conflict`. **PH1-14 names the route ⇒ `styling` `smoothing_styler`.** Letter without PH1-14 even past step 1: smoothing is a Leave-in function, Dimethicone r2 + Stearyl Alcohol r3 above T_LI = care, no fixative ⇒ LI `in_category` ⇒ Leave-in could claim it ⇒ PH1-16 ⇒ **`provisional_boundary (pending_leave_in_addendum)`, lean `smoothing_styler`**, `ruled_route_override` |
| F | mechanisms `silicone_coat` [Dimethicone r2] · hold_route `absent` · weight `medium` (families d, c; no rich member); `candidate_below_tail`: Behentrimonium Chloride r7 would form an LGN pair with Stearyl Alcohol ⇒ `rich` ⇒ review · buildup no · alcohol_note no (Isopropyl Alcohol r14) · flags silicones, fragrance |
| Heat | C1 „230 °C Hitze-Schutz-Technologie"; no HP-1 member ⇒ **`false`**, shown „Hitzeschutz laut Hersteller", `heat_claim_without_l9` |
| Hold | C1 „Starker Halt" ⇒ **3** (PH1-14), stored, not used (`smoothing_styler`). D8b rule 1 **fires** (≥ stark, no hold mechanism: silicone_coat only, Stearyl Alcohol is not structuring) |
| C | primary `sleek` (gate ✓); `hold_fix` dropped (gate fails) and recorded; secondary `frizz_control` („Schutz vor Frizz & Feuchtigkeit", C1; gate ✓) · finish `unbekannt` („glatt und geschmeidig, seidig" are not finish words) · flexibility `unbekannt` · coating type `silicone_coat` |
| U | **`before_heat`** (C2: towel-dried, then blow-dry, optional flat iron — heat is a required next step) · `all` · heat_activated `no` |
| Captured | duration „GLATT 3 TAGE" · humidity „Schutz vor Frizz & Feuchtigkeit" · heat „bis zu 230 Grad" (temperature never used) |
| Triggers | `pending_leave_in_addendum`, `ruled_route_override`, `claim_formula_conflict`, `heat_claim_without_l9`, `candidate_below_tail` |

### 11.8 Bumble and bumble Brilliantine — `bumble-and-bumble-brilliantine`

| Step | Output |
|---|---|
| Identity | No German manufacturer site; Douglas (C3) and a US page (C5) only |
| Markers | T_S Ethylhexylglycerin r11 **unresolved** (booster above Phenoxyethanol r28) ⇒ R2 marker Tetrasodium EDTA r18; `unpositioned` r12–r17 (PEG-40 Castor Oil, Carbomer, Acetylated Lanolin Alcohol, Arachidyl/Myristyl Alcohol, AMP) · T_LI Ethylhexylglycerin r11 |
| S0 | step 1 **fails** (no C1/C2 promise). **D2 names it ⇒ `styling` `shine_finish`** (§4.1 exception), `claim_authority_gap`. Not held: with no C1/C2 promise, the Leave-in function conjunct cannot be established, and the C3 promise („Definition & Glanz für lebendige Styles") names no Leave-in function |
| F | mechanisms `wax_lipid` [Caprylic/Capric Triglyceride r3, Castor Oil r4, Polybutene r6, Cetyl Acetate r7] (none structuring) · hold_route `absent` · weight **`rich`** under both readings (families a, b, c; Castor Oil rich), confidence moderate · buildup **fires** (limb 2) · alcohol_note no · flags oils, fragrance |
| Heat / Hold | `false` · **`null`** (Douglas „Haltgrad leicht" is a C3 trace) · D8b: no C1/C2 hold claim ⇒ no flag |
| C | finish `unbekannt` (C3 „fantastischen Glanz" is a trace) · jobs empty + `claim_authority_gap` · shine base `wax_lipid` |
| U | `dry_restyle`, also `damp_before_drying` (C3 directions: fingers or comb) · `all` · `no` |
| Triggers | `claim_authority_gap`, `ruled_route_override` (evidence gate vs D2), `tail_marker_unresolved` |

### 11.9 Balea MEN Pomade Haar & Bart 2in1 — `balea-men-pomade-haar-bart-2in1`

| Step | Output |
|---|---|
| Markers | T_S Parfum r8, plausible · T_LI none visible (no preservative declared) |
| S0 | class `styling_result` („Formt & festigt individuelle Styles", house-brand C2), `li_function: no` · **non-aqueous** (no water declared) ⇒ 3.5 ⇒ **`styling` `molding`**. One route; beard use recorded only [PH1-7]. Not held (Leave-in could only say `excluded_anhydrous`) |
| F | mechanisms `wax_lipid` [structuring: Petrolatum r2, Cera Microcristallina r3, Paraffin r4; Ethylhexyl Stearate r1, Shea r5, Macadamia r6] + `particulate` [Silica r7] · hold_route `absent` · weight **`rich`** (families a, b; rich members) · buildup **fires** (limb 2) · alcohol_note no · flags oils, fragrance |
| Heat / Hold | `false` · house-brand dm attribute „mittlerer Halt" ⇒ **2** (moderate); „langanhaltenden Halt" unquantified · D8b no (structuring wax) |
| C | primary `hold_fix` (gate ✓), secondary `definition` · finish/flexibility `unbekannt` · form_label `pomade` · base `anhydrous` |
| U | `dry_restyle`, also `damp_before_drying` · `all` · `no` |
| Derived | the medically adjacent pomade caution (molding + rich/anhydrous; property set §4). „Dermatologisch bestätigte Hautverträglichkeit" is never repeated |
| Triggers | `house_brand_ownership` |

### 11.10 got2b Trockenshampoo Extra Volumen — `got2b-trockenshampoo-extra-volumen` (negative control)

| Step | Output |
|---|---|
| S0 | step 1 **fails**: the claims are dm.de copy for a third-party brand (C3) ⇒ **`provisional_boundary (evidence_gate)`, stays in its current category: Dry Shampoo.** With a C1/C2 capture, the same answer follows from 3.2: class `refresh` („schnelle Reinigung", „Bis zu 48 Stunden Frische") co-leading with volume ⇒ tie ⇒ `dry_shampoo` |
| Formula note | Oryza Sativa (Rice) Starch r4 in a non-aqueous formula (Aqua r10, tail) is PT-2 `particulate` — informational; the formula never decides the Dry Shampoo boundary |
| Emission | identity, formula, route; no Styling profile |

### 11.11 Schwarzkopf Taft Föhn-Spray VOLUMEN Halt 3 — `schwarzkopf-taft-foehn-spray-volumen-halt-3`

| Step | Output |
|---|---|
| Markers | T_S Parfum r6, plausible · T_LI Benzyl Alcohol r8 |
| S0 | class `styling_result` (C2 „verleiht Volumen und einen natürlichen Haarschwung"), `li_function: no` · aqueous · 3.4 (ii) ⇒ **`styling`** (PH2-1). Cross-check: VP/VA r3 (FX-1) above T_LI, lone Cetrimonium Chloride r5 = thin ⇒ LI G0 `excluded_styling_first` with C2 positioning „Haltegrad 3 … Halt" ⇒ `styling`. Not held. The C2 heat sentence is secondary ⇒ 3.3 does not apply |
| Subtype | `blowdry_lotion` |
| F | mechanisms `fixative_film` [VP/VA r3] · hold_route `present` · weight `light` (Cetrimonium Chloride r5 is monomeric with no fatty alcohol ⇒ no family, no LGN) · buildup no · alcohol_note **fires** (Alcohol denat. r2) · flags fragrance; fixative_family [pvp_vp] |
| Heat | C2 „hilft dabei, das Haar vor Sprödigkeit und Haarbruch zu schützen, die durch das Föhnen entstehen" = a heat-protection claim; no HP-1 ⇒ **`false`**, shown „Hitzeschutz laut Hersteller" |
| Hold | C2 Haltegrad 3 ⇒ Henkel x/5 ⇒ **2**, high |
| C | primary `volume` (gate ✓), secondary `hold_fix` (✓) · finish `unbekannt` („natürlicher Haarschwung" is movement) · flexibility `unbekannt` |
| U | **`before_heat`** (C3 dm: „in das handtuchtrockene Haar sprühen, Haare trocken föhnen") · `all` · heat_activated `no` |
| Triggers | `heat_claim_without_l9` |

### 11.12 Alcina Styling Mousse Aerosol — `alcina-styling-mousse-aerosol` (PH1-6 and PH2-5 case)

| Step | Output |
|---|---|
| Markers | T_S Caprylyl Glycol r11 **unresolved** (booster above Phenoxyethanol r13) ⇒ R2 marker Phenoxyethanol r13; `unpositioned`: Citric Acid r12 · T_LI Caprylyl Glycol r11 (in a pair) |
| S0 | class `styling_result` (C2 „Starker, flexibler Halt"), `li_function: no` · aqueous · 3.4 (ii) ⇒ **`styling`** (PH2-1). **Without PH2-1 no Leave-in state fits:** PQ-11 is LI L1, not L5, so no architecture half; and a hold promise fails `in_category`'s function conjunct |
| Subtype | `mousse` (foam) |
| F | mechanisms `humectant_only` [Panthenol r6, Propylene Glycol r10] · hold_route **`ambiguous`** (Polyquaternium-11 r5 alone, PH1-6) ⇒ `pq_only_film_former` · weight `medium` (family e: PQ-11 r5; Cetrimonium Chloride r9 without a fatty alcohol) · buildup: **fires** (limb 1 reused literally, PH2-5: PQ-11 = LI `permanent_cationic`), not under a limb-2-only reading · alcohol_note no · flags propellant, fragrance |
| Hold | C2 Hold-Faktor 5/10 ⇒ Alcina table ⇒ **2** (number beats „Starker") · D8b: no flag (`ambiguous` is in the hold-mechanism set) · neutral fact: n/a (level stated; `ambiguous` never triggers it) |
| C | flexibility `beweglich` („flexibler Halt") · finish `glänzend` (C2 „intensiven Glanz") · primary `hold_fix` (gate ✓ via `ambiguous`); `shine` claimed but dropped (no wax_lipid/silicone_coat) |
| U | `damp_before_drying` (C2: „im feuchten Haar verteilen"; blow-drying not required) · `all` · `no` |
| Triggers | `pq_only_film_former`, `tail_marker_unresolved` |

---

## 12. Ruled (PH2-1…PH2-6)

The six proposals of the 2026-10-10 draft (P-S1…P-S6) were ruled by Nick on 2026-10-11 as PH2-1…PH2-6 (`plans/styling-concept/02-rulings.md`, "Phase 2 research-engine rulings"). None is open; the body of this standard states each ruled rule. Five further rulings (PH2-7…PH2-11) closed ledger ambiguities (§13).

| Ruling | Former proposal | What was ruled | Where it lives | Real example |
|---|---|---|---|---|
| **PH2-1** | P-S1 | The Leave-in border check applies **only where the promise overlaps Leave-in's own definition** (care, detangling, smoothing/anti-frizz, curl support, blow-dry/heat support; LI §2.1). A C1/C2 promise of volume, hold, texture, shaping/molding or shine goes to **Styling directly**, with no Leave-in check. Overlapping promises keep the full check (T15/D6/D7). Accepted consequences: Garnier Fructis „Leave-In Spray" Diamond Sleek ⇒ Leave-in; Wella EIMI Flowing Form ⇒ `provisional_boundary` | §4.2, §4.3 (ii), §4.5, §4.6 | Balea Föhnlotion Volume Effect and the 9 "care + no polymer" volume/hold/molding products ⇒ Styling directly |
| **PH2-2** | P-S2 | The PH1-16 hold covers **every Styling route the unchanged Leave-in letter would also claim** (all D6/D7 moves and owner-named routes). Held records get the **complete** Styling profile, marked `provisional`; they count toward "≥ 5 per subtype" (reported separately) and are **not matchable/recommendable** until the Leave-in addendum is approved | §4.5, §4.7, §4.8 | Balea Locken Revitalizing Spray: profiled as a `refresher` now, live only after the addendum |
| **PH2-3** | P-S3 | **D6 applies to any format**, not only sprays (format never routes) | §4.3 D6 | Balea Locken Crunchgel ⇒ Styling `gel` (held) |
| **PH2-4** | P-S4 | The heat check (PH1-15) reads Styling's own tail marker **T_S** (the Mask rule), the stricter side. `provides_heat_protection = true` needs a C1/C2 heat claim **and** an L9 member above T_S. LI `product_tested` without an L9 member stays `false` until ruled | §6.7 | John Frieda Ansatz-Booster: heat polymer after Parfum ⇒ `false` (claim still shown) |
| **PH2-5** | P-S5 | The buildup note is reused literally, **including limb 1**: permanently charged cationics, read internally from the LI §7.6 persistence enumeration only to feed the note | §6.4 | Alcina Styling Mousse (PQ-11) gets the note |
| **PH2-6** | P-S6 | Blind lanes get a **separate sealed S0 packet** (INCI, directions, confirmed name, C1/C2 promise and heat claims with tiers; no prior routes, no hold/finish/flexibility words). Each lane classifies F/U from the blind packet using its own S0 output | §10.2 | Balea Pro Styling Cream Traumlocken: the lane sees name and C2 promise for PH1-12/D7, never the dm „mittlerer Halt" attribute |

Also ruled on 2026-10-11 (not former proposals): **PH2-7** (dm „Halt" attribute on house-brand products = C2 `house_brand`, §2.2 A4, §7.2) · **PH2-8** (weight = the exact LI WT rule, §6.3) · **PH2-9** (T_S = the full Mask rule, §3.2) · **PH2-10** (Killer.Curls ⇒ `provisional_boundary (evidence_gate)`, §4.6) · **PH2-11** (housekeeping: Langhaarmädchen Lockenwunder ⇒ Leave-in; „ausbürstbar" stays a v0 convention; the charter's dropped P1 extras are tracked as open; the calibration file stays frozen, §13).

---

## 13. Ledger ambiguities and conflicts noticed (for the record)

Each item is marked with the ruling that resolved it, or stays marked **Open**.

1. **PH1-16 vs PH1-11 coverage. Resolved in part — PH2-2.** Held records are profiled completely, counted toward "≥ 5 per subtype" and reported separately; committed counts per subtype are curl_cream 1, smoothing_styler 0, refresher 1, salt_spray 2, texture_spray 2, hair_powder 3 (§4.8, hand-annotated, to be re-derived in Phase 3). **Open:** 12 cohort records fail the S0 evidence gate (C3/C5 claims only); only more captures close that, and PH1-11's "≥ 5 per subtype" may still fall short on `smoothing_styler` (held 2).
2. **Evidence gate vs owner-named examples. Resolved — PH2-10 for Killer.Curls.** Brilliantine and Color Wow (D2) and John Frieda Lockencreme Traumlocken (D7) have no C1/C2 promise; this standard routes them by their rulings (§4.1 exception). Kevin.Murphy Killer.Curls (C3 claims only) is `provisional_boundary (evidence_gate)` until a C1/C2 German claim is captured (PH2-10).
3. **Routes the literal rules change versus the calibration file. Resolved — PH2-1.** `garnier-fructis-leave-in-spray-diamond-sleek-glaettungsspray` ⇒ `leave_in`; `wella-professionals-eimi-flowing-form` ⇒ `provisional_boundary (li_g0_provisional)`. The calibration file has both as Styling `smoothing_styler`; it stays frozen and is re-derived in Phase 3 (PH2-11).
4. **PH1-1 wording. Resolved — PH2-9.** T_S is the full Mask rule (preservative, perfume, declared allergens, boosters in a pair, chelators), as approved under PH1-1. It decides the marker on 8 of 70 records (all unresolved via the third limb); no value moves.
5. **PH1-15 vs LI §13.3. Resolved in part — PH2-4.** The heat binary follows PH1-15's explicit text (C1/C2 claim **and** L9 pass, read against T_S); LI §13.3's claim-alone `true` is not used. **Open:** LI's `product_tested` state (claim + exact-product test, no L9 member) stays `false` until ruled.
6. **House-brand structured attributes. Resolved — PH2-7.** dm's „Halt" attribute on Balea/alverde products is C2 `house_brand` (LI rule 6, routes to review). Levels kept: Balea Ultra Volumen 4, Pro Traumlocken 2, MEN Pomade 2, Haarpuder 3, Volumenpuder 1. The round-2 G0 lane's C3 reading of the Traumlocken attribute is superseded.
7. **Leave-in WT rule vs the property-set dry run. Resolved — PH2-8.** Weight is the exact Leave-in WT rule including the LGN-pair route to `high`/`rich`; no extra anhydrous route (§6.3). Net cohort change: two curl creams move to `rich`; no other value moves.
8. **D6 wording "sprays". Resolved — PH2-3.** D6 applies to any format.
9. **Mixed-promise detection. Not a ruling item.** The round-2 G0 lane read Balea Pro Traumlocken as `mixed` from a definition claim, a softness claim and a heat bullet. §4.2 reads `mixed` only for co-equal lead jobs; under that reading Traumlocken would be `styling_result` and reach D7 anyway. The outcome is the same either way; the definition matters for future products.
10. **"Exactly one pair rule applies"** (charter §5 step 3) does not hold for products with a secondary heat claim and an aqueous formula (11 cohort records). §4.3 selects the pair by promise class in a fixed order. Not a ruling item.
11. **Booster-above-preservative limb.** Mask's third limb fires on 7 of 70 Styling records (common in L'Oréal and salon lists). It is part of the full Mask rule ruled in PH2-9, moves no value today (§3.3), but will keep producing `tail_marker_unresolved` reviews.
12. **Calibration-file labels to re-derive, not edit. PH2-11.** `calibration-set-r2.json` stays frozen: ruled outcomes are re-derived in the Phase 3 blind round, never patched. Known labels: `balea-locken-revitalizing-spray` `application_moment` (`second_day` ⇒ `dry_restyle`), the `claim_formula_conflict` flag on the same record (duration is not hold), the stale `proposed_finish` values (property set §9 item 4), and every route listed in item 3.
13. **Langhaarmädchen Lockenwunder. Resolved — PH2-11.** Leave-in by the PH1-13 R2 rule (cationic r4 above the preservative); no longer an unnamed edge case.
14. **„ausbürstbar". Resolved — PH2-11 (convention).** Stays a v0 convention: not a flexibility word. It is not a rule of the ledger beyond that housekeeping ruling.
15. **Resolved — PH2-12 (rich-member list for `weight`).** Waxes, paraffin, microcrystalline wax and lanolin are rich members for Styling (Styling-local; they move into the Leave-in addendum after lock).
16. **Open (tracked, not lock criteria) — charter P1 extras.** The charter's dropped P1 extras (≥ 80 % shelf coverage, every pair rule exercised at least once) are tracked as open, not as lock criteria (PH2-11).

---

## 14. What this standard does not do, and what comes next

- It approves no product and authorises no catalog, Supabase, intake, matcher or copy change (charter §16). User-facing strings appear only where a ruling already fixed them (PH1-3, PH1-4 copy reused from Leave-in; „Hitzeschutz laut Hersteller", „Halt: keine Herstellerangabe", „Enthält Stylingpolymere" from PH1-15/D8/D8b).
- It sets no need tier, plan composition or ranking (SD4, D4, D5, D8 ranking are matching policy, charter §14).
- Rerun obligation: any change to a deterministic rule here or to a deterministic lexicon family re-derives every affected record (Mask rerun obligation); agreement statements never carry across a systemic change.

**Next (Phase 3):** capture fills the evidence-gate gaps (Killer.Curls needs a C1/C2 German claim, PH2-10) and the short subtypes (charter §15 P1 (a)); re-derive the §4.8 counts and every route in §13 item 3 under PH2-1/PH2-2; freeze the S0 packet (PH2-6) and the F/U packets; blind calibration round 1 with two sealed lanes plus two claim normalisations; diff; owner rulings on disagreements; ≥ 6 unseen products with ≥ 2 boundary traps (candidates: a salt-free beach spray, a `target_zone: surface` product, a C1/C2 `fest` claim — the three ruled-but-uncalibrated values, property set §9 item 7); draft and queue the Leave-in addendum (PH1-16).
