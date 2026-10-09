# Parked Leave-in ↔ Styling border questions (5 `provisional_boundary` records)

Status: analysis for Nick's ruling, 2026-10-09. Read-only pass over the Leave-in standard v1.0 (`docs/research/leave-in-inci/v1.0/leave-in-classification-standard.md`), the rulings ledger (`plans/styling-concept/02-rulings.md`), `round2/G0-border-verdicts.json`, `calibration-set-r2.json`, the raw INCI in `samples/*.json` and `round2/G1-curls-refresh.json`, and the Leave-in gold set and unseen-test packets (`data/research/leave-in-inci/v1.0/`). Every rank below was recounted from the raw INCI. No record has been changed.

## 0. The five records and what actually blocks each

| Product | Blocker | Decided by |
|---|---|---|
| alverde Locken Refresh-Spray | All of its care sits below an early preservative | **Q1** |
| syoss Curl Control Hydrating Spray | Same as alverde, **plus** an identity gap: the INCI comes from dm.at, and F1 says the product is "likely discontinued or not sold in Germany" | Identity first, then **Q1** |
| Langhaarmädchen Lockenspray Natur Lockenwunder | **Not actually a Q1 case** (see 1.1). Its cationic is at r4, above the marker | Can be released now (see 2.4) |
| Balea PROFESSIONAL Definier Spray Traumlocken | Has oils but no cationic | **Q2** |
| BALI CURLS Leave-In Spray Curl Defining | Two different INCIs under GTIN 4262391990490 (dm.de vs bali-care.com) | **A pack photo**, not a ruling. Q2 also applies if the pack shows the brand formula |

---

## 1. Q1: Does care listed below an early preservative count?

### 1.1 Affected products, ranks recounted

| Product (source) | Early marker | Care ingredients and ranks | 2nd capped material above the care? |
|---|---|---|---|
| alverde Refresh (`samples/lane1-gel-curl.json`, dm.de 3100916) | Levulinic Acid **r6** | Helianthus Oil r12, PCA Glyceryl Oleate r14, Isoamyl Laurate r16, **Brassicyl Isoleucinate Esylate r17** (L1 cationic), Brassica Alcohol r21 (fatty alcohol). Above r6: only Aqua, Aloe juice, Propanediol, Glycerin, Caprylyl/Capryl Glucoside | **Yes.** Glyceryl Undecylenate r8 and Sodium Levulinate r9 (marker-eligible) both sit above the cationic |
| syoss Hydrating (`samples/lane1-gel-curl.json`, **dm.at** 1920069) | Sodium Benzoate **r4** | **Acrylamidopropyltrimonium Chloride/Acrylamide Copolymer r6** (cationic polymer). Macadamia Oil r11 is post-Parfum. Above r4: Aqua, Corn Starch r2, Glycerin r3 | **No.** The next capped material is Phenoxyethanol r14 |
| Langhaarmädchen Lockenwunder (`round2/G1-curls-refresh.json`, dm.de 1592107) | Sodium Benzoate **r23** of 30 | **Stearamidopropyl Dimethylamine r4** (L1 amidoamine), after Methyl Glucose Sesquistearate r3 (emulsifier). Dicaprylyl Carbonate r10 | n/a: the cationic is **above** the marker |

The brief grouped Langhaarmädchen under Q1. That is a mis-read. Its marker is r23, not r4. Its tail (r23–r30: Sodium Benzoate, Potassium Sorbate, four fragrance materials, Lactic Acid, Sodium Lactate) falls entirely in the §3.1.1 clause-6 closed set, so the marker is **vacuous**. The coherence read then governs: a cationic conditioner fourth in a 30-item list is a real L1 route.

### 1.2 What the standard literally says, and why it is ambiguous

- §3.1.1 clause 1: rank alone decides. Anything at or below the first capped preservative is tail and cannot count as architecture.
- §3.1.1 clause 5 (T16, Redken): a marker is **implausible**, and may not disqualify anything, "when the marker outranks one or more of" the ingredients that establish COND/WT. The record then routes to review.
- The gap: clause 5 is circular when **all** of a product's care sits below the marker. Read strictly, nothing "establishes COND" above the marker, so the marker is plausible. Read literally, the marker outranks the would-be care ingredients, so it is implausible. The G0 lane used the first reading for Balea Revitalizing ("nothing that could establish COND sits above it, and the lipids also sit after a second capped material") and left alverde and syoss open on the second (`G0-border-verdicts.json`, `d6.note`).
- Mandatory limit 3 says an early marker is a "strong counter-signal, not an automatic downgrade". It does not say which way the D6 border should then fall.

### 1.3 Options

| | **A: Strict** | **B: Generous** | **C: Second-preservative check (recommended)** |
|---|---|---|---|
| Rule in plain words | If no care ingredient sits above the first preservative, everything below it is a trace amount | Any care ingredient below an early preservative counts on its own merits | Care below the first preservative counts as trace **only when a second preservative also sits above it**. If only one preservative sits above it, the marker may be a listing quirk: read the care on its own merits and send the product to review (the T16 path) |
| alverde Refresh | **Styling `refresher`** | Leave-in | **Styling `refresher`** (three preservative-system members r6/r8/r9 sit above the cationic r17) |
| syoss Hydrating | Styling `refresher` (once identity is resolved) | Leave-in | **Leave-in + review** (only Sodium Benzoate r4 sits above the cationic r6). Still blocked on identity |
| Balea Locken Revitalizing (already Styling by D6) | unchanged | **flips to Leave-in** (Coconut r13 and Shea r14 below SB r4) | unchanged (Potassium Sorbate r8 also sits above the oils) |
| Balea Sea Salt Care & Define (already Styling by D6) | unchanged | **flips to Leave-in** (IPM r10, Dicaprylyl Ether r14 below Phenoxyethanol r7) | unchanged (SB r8 and K-Sorbate r13 also sit above) |
| OSiS Curl Retouch (Leave-in) | unchanged (Cetearyl Alcohol r4 is above Phenoxyethanol r5, so T16 applies) | unchanged | unchanged (only Phenoxyethanol r5 sits above SAPDMA r7 and BTAC r8, so they are read on their merits as a pair with Cetearyl r4) |
| Redken Anti-Snap (gold slot 9, T16) | **conflicts with T16's wording**: nothing caring sits above Phenoxyethanol r3, so A would call the marker plausible. No route change, because there is no styling promise | unchanged | **reproduces T16**: Amodimethicone r4 has only one preservative above it |
| Balea Anti-Frizz Serum (named in D6 as "real conditioning") | real care via Cetearyl r3 + IPP r10 | real care | real care. BTAC r12 is below Ethylhexylglycerin r11 but has no second preservative above it, so it counts and pairs with Cetearyl r3 |
| T15 / D6 fit | Fits D6. Contradicts T16's text | **Breaks D6**: refresh mists and beach sprays, both named by Nick, would return to Leave-in. Almost every light mist has trace oil somewhere below its preservative | Fits T15, T16 and both D6 examples |
| §1.1 conservative failure | Passes: fails toward COND `low`, the anchor's conservative value | **Fails** unless every such record goes to review: it raises COND on an unreadable rank | Passes: either strict (conservative value) or the T16 implausible path (review) |
| Current Leave-in catalog flips | none found | none in the reference data (no catalog spray in it promises a styling look) | none found |

**Recommendation: C.** It is deterministic, because it only reads the existing marker-eligible list twice. It reproduces T16 exactly (Redken, OSiS), keeps every D6 placement Nick has made, and is the reasoning the G0 lane already used informally for Balea Revitalizing and Sea Salt. Its one new outcome, syoss → Leave-in, goes to review, and syoss is identity-blocked anyway. If Nick prefers the simplest wording, A gives the same answers on all four D6 products. Its cost is a wording conflict with T16 that would need a footnote.

---

## 2. Q2: Does oil without a cationic count as "real care" for D6?

### 2.1 Affected products

| Product | Marker | Care above the tail | Cationic? | Hold route | C1/C2 promise |
|---|---|---|---|---|---|
| Balea PROFESSIONAL Definier Spray (`G1-curls-refresh.json`, dm.de 1639908) | Caprylyl Glycol **r7** (paired with Sodium Benzoate r19). If the pair is not accepted, SB r19 is vacuous and the coherence read gives the same answer | Wheat Germ Oil r4, Camellia Oil r5, Caprylic/Capric Triglyceride r6. Below: Cetearyl Nonanoate r8, Hydrolyzed Keratin r9. Solubiliser PEG-40 HCO r2 | none | none (no L5, no starch) | C2 house brand: „Für bis zu 24 Stunden definierte Locken", „Locken-Memory-Effekt", into damp hair, knead, do not rinse |
| BALI CURLS spray, **brand formula only** (`F3-salon-claims.json` notes, bali-care.com C2) | not readable (INCI truncated in the capture) | Hydrogenated Ethylhexyl Olivate, Cetyl Alcohol, hydrolysed proteins, Sodium Stearoyl Glutamate | none | none (Sclerotium Gum is rheology) | C2: „Definiert und formt … langanhaltenden Halt", heat 220 °C |

### 2.2 What the standard and rulings literally say

- Leave-in COND anchor (§7.2) `moderate`: "one coherent conditioning route: a cationic-polymer film route **or a persistent silicone/emollient package**". By letter, an oil package is real conditioning.
- T15's description of Maria Nila as "thin" lists what was missing: "no silicone, **no lipid emollient**, no cationic polymer, no LGN pair" (gold reference key v4, slot 7 `g0_rationale`). An emollient is one of the things that makes a product not thin.
- D6 and the concept (§1 S0) say "neither … a substantive conditioning architecture". "Substantive" is never defined. That is the gap.
- Nick's own D6 examples of products with "real conditioning" include three with **no cationic above the tail**:
  - Bali Hydrating Curl Cream: Cetearyl r2, Cetyl r4, Shea r6, Coconut r7, no cationic at all.
  - EVO Head Mistress: silicones r2–r5 above Phenoxyethanol r6. Quaternium-80 is at r14.
  - Balea Anti-Frizz Serum: Cetearyl r3 and IPP r10 above Ethylhexylglycerin r11.
- Leave-in gold precedent: slot 1 (alverde Sprühkur Express 7in1, oils + alcohol, no cationic) and slot 4 (alverde 2-Phasen-Sprühkur, soy + argan, no cationic) are both `in_category`, COND `moderate`.

### 2.3 Options

| | **A: Oil counts (recommended)** | **B: Only cationic care counts** | **C: Oil counts unless it is only "dissolved in"** |
|---|---|---|---|
| Rule in plain words | Any real care route above the tail counts: cationic, cationic polymer, persistent silicone, or oils/emollients | Real care for D6 needs a cationic conditioner above the tail | Oils count, except when a solubiliser (e.g. PEG-40 HCO) outranks every oil, read as "oil only dissolved into a water mist" |
| Balea Definier | **Leave-in**, with the claim-vs-formula gap flagged („24 h"/„Memory" with no hold mechanism, the D8b-style review flag) | Styling `refresher` | Styling `refresher` (PEG-40 HCO r2 outranks oils r4–r6) |
| Bali spray, if the pack shows the brand formula | Leave-in | Styling | Leave-in (no solubiliser outranks the olivate) |
| Langhaarmädchen Lockenwunder | Leave-in | Leave-in (amidoamine r4) | Leave-in |
| Fit with D6 named examples | **Matches all four** | Contradicts the wording for Bali Hydrating Curl Cream and EVO. No route moves, because both are creams without a styling-spray promise | Matches |
| Fit with the Leave-in standard | Equals COND ≥ `moderate`: one definition of care across both engines | Creates a second, D6-only definition of care | Contradicts §3.1.2, where solubiliser + oil above the tail is a legitimate leave-in `microemulsion`. A solubiliser normally outweighs the oil it carries, so this would sweep up most clear oil mists. No evidence base |
| §1.1 | Passes. Ambiguity still goes to review via the claim-formula flag | Passes (fails toward thin) | Passes formally, but is an unevidenced hard rule |
| Existing flips | none | none today. Gold slots 1 and 4 only stay because their promise is care, not a look; any future oil curl-mist would move | none found |

**Recommendation: A.** It is the definition the Leave-in engine already uses, it matches every product Nick named in D6, and it keeps one border for both engines (D3). The real problem with Definier is a claim that its formula cannot support, not a border problem. That is handled by flagging the claim, not by moving the product: in Leave-in it shows as curl-support care, and the „24 h Definition" claim is never repeated as a fact.

### 2.4 Langhaarmädchen Lockenwunder (released under any Q1/Q2 option)

Stearamidopropyl Dimethylamine r4 is an L1 route (§5 L1, with Lactic Acid r29 as its acid). The marker is vacuous, so the coherence read governs. → **Leave-in**, review trigger `tail_marker_vacuous`. Residual caveat: the gold set reads a lone monomeric quat without fatty alcohol as COND `low` (slot 11, Balea Leichtkämmspray). That vocabulary conflict (§7.2 vs §7.6, ref A18) is still carried open. Langhaarmädchen also has an emulsifier and Dicaprylyl Carbonate r10, so it reads as real care under options A and B.

---

## 3. BALI CURLS spray: a data question, not a ruling

Same GTIN 4262391990490, two INCIs:

- **dm.de** (`samples/lane1-gel-curl.json`): Hydrolyzed Corn Starch r3, no care. Starch does not count as hold (D6 clarification), so D6 applies → Styling (gel in spray format, or `refresher`).
- **bali-care.com C2**: olivate + Cetyl Alcohol + proteins → Q2.

Both versions also carry a heat claim (220 °C at the brand, 230 °C at dm), which makes the promise mixed. What is needed: **one pack photo** (INCI + claims) of the unit on shelf.

## 4. Limits of this pass

- The live catalog (44 Leave-in rows, 41 active, `data/product-catalog-snapshot.json`) stores no INCI. Supabase holds only `product_leave_in_specs.ingredient_flags`. The flip check therefore covers the 13 gold-set and 6 unseen-test records (8 of them catalog products) and the 9 Leave-in-routed calibration records. D6 only touches sprays that promise a styling look. None of the checked catalog products does, so no flip is expected, but sprays such as Color WOW Money Mist and Pantene 7in1 Haaröl Spray were not checked against INCI.
- Option 1C's "second preservative" test is a new reading convention, not existing standard text. Adopting it means adding one clause to §3.1.1 (or to the styling concept's D6 text), with Redken, OSiS, alverde and Balea Revitalizing as its worked examples.
