# D6 care test: real care or a trace? (replaces Q1 option C)

Status: rule design and test for Nick's ruling, 2026-10-09. Read-only pass. Nick rejected the Q1 proposal in `parked-border-questions.md` ("care listed after ≥ 2 preservatives = trace") as too crude. This file proposes a replacement and tests it.

Inputs: rulings D3/T15, D6 (incl. clarification), D7 and PH1-10 (`plans/styling-concept/02-rulings.md`); Leave-in standard §3.1.1, §3.1.2, §5 L1–L4, §7.2; `G0-border-verdicts.json`; raw INCI in `samples/*.json`, `round2/G1-curls-refresh.json`, `round2/G2-finish-texture.json`, `round2/F3-salon-claims.json`; the Leave-in gold set (13) and unseen test (6) under `data/research/leave-in-inci/v1.0/corpus/`. A scratch script recounted every rank from the raw INCI (parentheses-aware split). No record was changed.

**Rank correction to `parked-border-questions.md`:** for OSiS Curl Retouch, „Aqua (Water, Eau)" is one ingredient. The correct ranks are Cetearyl Alcohol r3, Phenoxyethanol r4, SAPDMA r6, BTAC r7, Citric Acid r9 and Parfum r13 (the parked file says r4/r5/r7/r8). The order is unchanged, so no outcome moves.

---

## 1. Formulation facts: why "listed after the preservative" does not mean "does nothing"

| Class | Typical leave-on level | Ceiling or level that matters | Reading |
|---|---|---|---|
| Capped preservatives (the §3.1.1 marker) | 0.1–1 % | EU Annex V caps: phenoxyethanol ≤ 1.0 %; benzoic acid and its salts ≤ 0.5 % (as acid) in leave-on; sorbic acid and its salts ≤ 0.6 % [1] | Anything listed after a capped preservative is roughly ≤ 0.5–1 %. That bounds the amount, but it says nothing about whether the ingredient works. |
| Natural preservative systems (levulinic acid / levulinate, glyceryl undecylenate / caprylate) | blends dosed at about **1–3 %**, spread over 2–4 INCI entries | Not Annex V preservatives; often boosters [8][9] | These sit higher than a capped preservative and usually appear as several entries. "Counting preservatives" therefore penalises naturkosmetik for its preservation style. |
| Cationic surfactants: CTAC, BTAC, amidoamines, esterquats | about 0.25–1 % in leave-on | EU leave-on hair: CTAC (+ STAC) ≤ 1.0 %, BTAC ≤ 3.0 % [2]. CIR long held leave-on CTAC to 0.1 %, later **0.25 %** [3]. Supplier range for BTAC: 0.5–3 % [4] | **Effective at low dose.** Leave-in detanglers worked for years under a 0.1–0.25 % ceiling. A cationic just below a preservative is plausibly at a working dose. |
| Cationic polymers: PQ-10, guar HPTC, acrylamidopropyltrimonium copolymers | 0.1–1 % in leave-on [5][6] | — | **Effective at low dose**: a substantive film with no rinse-off loss (§5 L1). |
| Amino silicones and silicone quats | about 0.4–4 % of the emulsion, i.e. well under 1 % active at the low end [7] | ADM 6057 E is 35 % active | **Effective at low dose**: cationic charge drives deposition. |
| Plain silicones, oils, esters, butters | need a real load to leave a lubricating film (several %) | In clear mists, oil is carried by a solubiliser at roughly 1:1 to 5:1 solubiliser to oil, premixed [10] | **Needs a higher dose.** An oil listed after the preservative in a clear water mist is a solubilised claim ingredient. The Leave-in tail rule is right for this class. |
| pH adjusters: citric/lactic acid, NaOH, citrate | about 0.05–0.3 % in aqueous leave-ons | Formulator convention. No single source; treat it as a heuristic. | **A lower yardstick than the preservative.** Anything listed after the buffer is smaller still. |
| Perfume | about 0.2–1 % in hair leave-ons | Heuristic | A weak yardstick, used only as a fallback. |

Legal caveat (it limits every rank rule, including the rejected one): under EU 1223/2009 Art. 19(1)(g), ingredients below 1 % may be listed in any order after those above 1 % [11]. §3.1.1 limit 3 says the same ("the tail is unordered"). Any comparison inside the tail is therefore a listing convention, not proof. This is why every below-marker decision below carries a review flag.

**Conclusion:** "below the preservative" is a sound trace test for oils and plain silicones. It is unsound for cationic conditioners, cationic polymers and amino silicones, which work at 0.1–0.5 %. Counting preservatives conflates the two classes, and it also mis-reads natural preservative systems that are dosed higher and split over several entries.

---

## 2. Candidate rules

Shared definitions:

- **Marker** = the §3.1.1 tail marker: the first capped preservative.
- **Care species** = L1 cationics (including amino silicones and silicone quats), non-volatile oils, esters and butters (L3), persistent silicones (L2), and fatty alcohols.
- **Never care**, under every rule: volatile carriers (Isododecane, Isohexadecane, cyclomethicones, propellants), humectants and panthenol (L4), non-cationised proteins and amino acids, vitamins, extracts, starches, salts and solubilisers.

| ID | Rule (plain words) | Deterministic test |
|---|---|---|
| A | *(reference; parked option A)* Strict: only care above the first preservative counts | care species rank < marker |
| C | *(reference; rejected by Nick)* Care below the first preservative counts unless a second preservative is also above it | care species rank < second capped material |
| **R1 Care-system count** | Real care needs a coherent system above the marker: any cationic or persistent silicone, **or** ≥ 2 lipid/fatty-alcohol species. One lone lipid or fatty alcohol → review | count functions above the marker |
| **R2 Class-aware dose test** | Each class must clear the line of its own effective dose. Oils, esters, plain silicones and fatty alcohols must sit **above the first preservative**. Cationic conditioners, cationic polymers and amino silicones may sit below it, but **not below the first pH adjuster listed after the preservative** (fallback: Parfum; no yardstick → review) | two rank comparisons per species |
| **R3 Backbone vs decoration** | Care counts only if listed before the first "decoration" item (extracts, vitamins, panthenol, proteins, amino acids, pH adjusters) | rank < first decoration item |
| **R4 Architecture-first** | Use the §3.1.2 architecture read: an emulsion, a two-phase or a microemulsion (care phase above the tail) = real care. A plain solution = care only if a cationic sits above the marker; a cationic below the marker → review | §3.1.2 decision order |

---

## 3. Test results

Legend: **L** = real care, so D6 cannot fire and the product stays Leave-in. **S** = no real care, so D6 fires (when the promise is a styling look and there is no L5 hold) → Styling. **R** = review, the product stays put. ✗ = flips an already-ruled outcome.

### 3a. Styling calibration: mists, sprays and light leave-ons

| Product (file) | Key ranks (marker · yardstick) | Ruled / open | A | C | R1 | **R2** | R3 | R4 |
|---|---|---|---|---|---|---|---|---|
| Balea Locken Revitalizing (lane1) | no cationic; Coconut r13, Shea r14 · SB r4 · Lactic r12 | **S (D6)** | S | S | S | **S** | S | S |
| Balea Sea Salt Care & Define (lane4) | Isododecane r2 (volatile); IPM r10, Dicaprylyl Ether r14 · Phenoxy r7 · Lactic r16 | **S (D6)** | S | S | S | **S** | **L ✗** (IPM before Panthenol r11) | **L ✗** (water + isododecane reads `two_phase`) |
| alverde Locken Refresh (lane1) | oils r12/14/16; **Brassicyl Isoleucinate Esylate r17**, Brassica Alc. r21 · Levulinic r6 · **Lactic r13**, Arginine r15 | open | S | S | S | **S** + flag | L | R |
| syoss Curl Control Hydrating (lane1, dm.at) | **Acrylamidopropyltrimonium copolymer r6**; Macadamia r11 · SB r4 · Lactic r9 | open (identity) | S | L+R | S | **L + R** | L | R |
| Langhaarmädchen Lockenwunder (G1) | Methyl Glucose Sesquistearate r3, **SAPDMA r4**, Dicaprylyl Carb. r10 · SB r23 | lean L | L | L | L | **L** | L | L |
| OSiS Curl Retouch (G1) | Cetearyl r3 · Phenoxy r4 · SAPDMA r6, BTAC r7 · Citric r9 | **L** | R (lone FA) | L | R (one species) | **L + R** (T16 path) | L | L |
| Balea PRO Definier Spray (G1) | PEG-40 HCO r2; Wheat Germ r4, Camellia r5, CCT r6 · Caprylyl Glycol r7 | **L (PH1-10)** | L | L | L | **L** | L | L (microemulsion) |
| BALI Curls spray, dm INCI (lane1) | no care; Hydrolyzed Corn Starch r3 · SB r9 | open (pack photo) | S | S | S | **S** | S | S |
| BALI Curls spray, brand INCI (F3 notes, truncated) | Hydrog. Ethylhexyl Olivate r5, Cetyl r6, Sodium Stearoyl Glutamate r10 · no marker visible | open (pack photo) | R | R | R | **R** (ordinal read: emulsion → lean L) | S | L+R |
| Langhaarmädchen Halt & Sprungkraft (G1) | no care · SB r8 | S (D6) | S | S | S | **S** | S | S |
| Balea Sea Salt Texture · jean&len · alverde Beach Waves · Bumble Surf | no care species anywhere | S | S | S | S | **S** | S | S |
| got2b Curlz (lane1) | Aqua r13, propellant-led | S (G0 anhydrous; D6 never runs) | n/a | n/a | n/a | n/a | n/a | n/a |
| Bali Hydrating Curl Cream (lane1) | Cetearyl r2, Cetyl r4, Shea r6, Coconut r7 · Phenoxy r10 | **L (D6 named)** | L | L | L | **L** | L | L |
| Balea Anti-Frizz Serum (lane3) | Cetearyl r3, IPP r10 · EHG r11 · BTAC r12 · Citric r20 | **L (D6 named)** | L | L | L | **L** | **R ✗** (lone FA before Panthenol r4) | L |
| Redken One United (lane6) | Coconut r2, Amodimethicone r3, PQ-37 r4 · Phenoxy r5 | **L (D6 named)** | L | L | L | **L** | L | L |
| EVO Head Mistress (lane6 = gold 5) | Dimethicone r2, Dimethiconol r5 · Phenoxy r6 | **L (D6 named)** | L | L | L | **L** | L | L |

Out of D6 scope, listed so nobody re-routes them by accident:

- **NEQI** and **Maria Nila** carry an L5 fixative, so T15 governs, not D6.
- **Garnier Diamond Sleek**, **Elnett 3 Tage glatt** and **Color Wow Dream Coat** are routed by the Heat-Protectant pair rule.

All five read **L** under R2. If R2 were reused as T15's "thin" test, Maria Nila (Cetyl r5 + Quaternium-95 r11 above EHG r13) would flip to Leave-in. **R2 must stay scoped to D6.**

### 3b. Leave-in reference (13 gold + 6 unseen, frozen outcomes)

| Record | Ranks | Gold G0 / COND | A | C | R1 | **R2** | R3 | R4 |
|---|---|---|---|---|---|---|---|---|
| g1 alverde Sprühkur 7in1 | Sunflower r2, Dicaprylyl Ether r5 · Levulinic r9 | in / moderate | L | L | L | **L** | L | L |
| g2 ISANA Hyaluron (milk) | Cetearyl r2, Guar r5, CTAC r7 · SB r9 | in / high | L | L | L | **L** | L | L |
| g4 alverde 2-Phasen | Soy r2, Argan r7 · no marker | in / moderate | R | R | R | **R** (ordinal: L) | L | L |
| g8 GLISS Sprüh-Conditioner | Dimethicone r3, Apricot r4 · SB r14 | in / moderate | L | L | L | **L** | L | L |
| g9 Redken Anti-Snap | Phenoxy r3 · **Amodimethicone r4** · Citric r6 | in / T16 implausible marker | **no care** (contradicts T16) | L+R | **no care** | **L + R** (reproduces T16 without a special clause) | L | L |
| g11 Balea Leichtkämmspray | **CTAC r4** · Hydroxyacetophenone r7 | in / COND **low** | L | L | L | **L** | L | L |
| g13 NEQI | Polysilicone-29 r7 · EHG r9 | in (T15) | L | L | L | **L** | **no care** | L |
| g3, g5, g6, g10, u1, u4, u5, u6 (creams, milks, sprays) | care species far above the marker | in / moderate–high | L | L | L | **L** | L | L |
| g7 Maria Nila, g12 KM Oil, u2 Öl Magique, u3 Alcina Föhn | excluded (T15 / anhydrous / styling-first) | excluded | n/a, not D6 | | | | | |

No gold or unseen record makes a styling-look promise, so none of them can move under D6 under any rule. The flip check is therefore about consistency: does the rule read these ruled records the way the standard does?

### 3c. Where the rules differ: four trap formulas (constructed, not catalog products)

On the 21 real products, R2 and C give **identical routes**. R2 is better because it is right for the right reason. These traps show where the two diverge:

| Trap INCI (abridged) | C (rejected) | R2 | Formulation reality |
|---|---|---|---|
| T1 Aqua, Glycerin, Sodium Benzoate, Potassium Sorbate, **Behentrimonium Chloride**, Parfum, Citric Acid | S: two preservatives above, so "trace" | **L + R** | Benzoate ≤ 0.5 % and sorbate ≤ 0.6 % leave plenty of room for 0.3–0.5 % BTAC, a working detangler dose. C would confidently move a real conditioner. |
| T2 Aqua, Propanediol, Phenoxyethanol, **Argania Spinosa Oil**, Parfum, Citric Acid | L: only one preservative above | **S** | A lone oil at ≤ 1 % solubilised in a mist is a claim ingredient. C loosens the Leave-in tail rule for oils. |
| T3 Aqua, Glycerin, Phenoxyethanol, Lactic Acid, Sodium Lactate, **Cetrimonium Chloride**, Parfum | L | **S + flag** | The cationic is listed after the buffer pair, so it is below the buffer level. |
| T4 Aqua, Aloe Juice, Glycerin, Sodium Levulinate, Sodium Anisate, Glyceryl Caprylate, **Brassicamidopropyl Dimethylamine**, Lactic Acid, Parfum | S: three preservation entries above | **L + R** | A natural preservation system dosed at 1–3 % over three entries says nothing about a cationic listed above its own acid. |

---

## 4. Verdict on each candidate

| Rule | Flips a ruled outcome? | Decides alverde? | Problem |
|---|---|---|---|
| A | No route flip. Sends OSiS to review and contradicts T16's wording on Redken Anti-Snap | yes (S) | Ignores the potency of cationics: syoss → S on rank alone |
| C | no | yes (S) | Nick: too crude. Counts preservatives, not care. Wrong on T1, T2 and T4 |
| R1 | Sends OSiS to review; Redken Anti-Snap reads no care | yes (S) | Position only, so the same blind spot as A. syoss → confident S |
| **R2** | **none** | **yes (S, flagged)** | Rests on a tail-order convention below 1 % (shared by every rank rule) |
| R3 | **Sea Salt → L ✗**, Anti-Frizz → R | yes (L) | Decoration levels vary: panthenol is often 0.5–1 % |
| R4 | **Sea Salt → L ✗** unless volatile carriers are excluded | no (R) | Cannot place a below-marker cationic, so it needs R2's yardstick anyway |

---

## 5. Recommendation: R2, the class-aware dose test

**Exact wording (proposed D6 clause; scope = D6 only, i.e. aqueous leave-ons with no L5 fixative above the tail; it changes no COND anchor, nothing in T15 and nothing in §3.1.1):**

> **D6 care test.** A product has *real care* when at least one conditioning species clears the dose line of its class:
> (a) **Oils, butters, emollient esters, non-cationic persistent silicones and fatty alcohols** count only above the §3.1.1 tail marker. A fatty alcohol counts only with a partner that also counts (a cationic, an emulsifier or a lipid). Volatile carriers (L2 volatile list, Isododecane, Isohexadecane, propellants) never count.
> (b) **Cationic conditioners** (L1: long-chain quats, amidoamines, esterquats, cationic polymers incl. guar HPTC, silicone quats, amino-functional silicones) count above the marker, **or** below it when they sit above the **dose yardstick**. The yardstick is the first pH adjuster listed after the marker (Citric/Lactic Acid, Sodium/Potassium Hydroxide, Sodium Citrate, Triethanolamine, Aminomethyl Propanol). If no pH adjuster is listed after the marker, the yardstick is Parfum when it is listed after the marker. If there is neither, the cationic cannot be placed → review.
> (c) Humectants, panthenol, non-cationised proteins and amino acids, vitamins, extracts, starches, salts and solubilisers never count.
> **Outcome.** A species counted above the marker → real care. Real care that rests only on a cationic credited below the marker → real care + review `care_credited_below_marker` (the T16 path). No species counted → no real care, and D6 may fire if its other halves hold. If a cationic sits below the yardstick, add the review flag `care_below_dose_yardstick` and cap confidence at moderate. No visible marker → §3.1.1 limit 2 (ordinal read, review). No record states or implies a percentage (G4).

**Expected outcomes:**

| Outcome | Products |
|---|---|
| Styling (D6) | Balea Revitalizing, Balea Sea Salt Care & Define, Langhaarmädchen Halt & Sprungkraft, the salt sprays, and **alverde Locken Refresh** (`refresher`, moderate confidence, flag `care_below_dose_yardstick` plus the existing house-brand trigger) |
| Leave-in | Langhaarmädchen Lockenwunder, Balea Definier (24 h claim flagged per PH1-10), Bali Hydrating, Balea Anti-Frizz, Redken One United, EVO |
| Leave-in + review | OSiS, and syoss (still blocked on identity) |
| Unchanged pending a pack photo | Bali Curls spray (dm INCI → S; brand INCI → review, lean L) |
| Gold / unseen | All unchanged. Redken Anti-Snap gets its T16 reading from the rule itself |

**Failure cases (known, all routed to review, never to a confident new route):**

1. **The tail below 1 % is legally unordered** (Art. 19(1)(g)). The yardstick comparison is a listing convention, so every below-marker credit or denial carries a flag.
2. **Amidoamine listed just after its own acid** (the acid is needed in proportion). The rule reads trace. This only matters when the styling-look promise also holds. A reviewer sees `care_below_dose_yardstick`.
3. **A cationic just below the buffer** (e.g. CTAC at about 0.2 %) may still give mild slip. It is called trace, with the same flag.
4. **No yardstick** (fragrance-free and buffer-free, like NEQI) → review.
5. **Vocabulary gap for Nick to confirm:** D6 "real care" (a working dose of any care class) is **not** COND ≥ `moderate`. Gold g11 Balea Leichtkämmspray is COND `low` but is plainly real care, a detangler. Tying D6 to COND would call the archetypal detangling spray "no care". It moves no route today because g11 makes no styling promise. Only Langhaarmädchen Lockenwunder is sensitive to this choice (A18).

**For Nick, in one sentence:**

> „Pflege zählt, wenn sie in wirksamer Menge drin ist: Öle und Silikone müssen vor dem ersten Konservierungsstoff stehen; kationische Pflegestoffe wirken schon in kleinsten Mengen und dürfen dahinter stehen – aber nicht noch hinter der Säure, die nur den pH-Wert einstellt."

- **syoss Curl Control Hydrating Spray:** the care polymer (r6) is listed after the preservative (sodium benzoate, r4) but before the lactic acid (r9) → real care → stays Leave-in (to review).
- **alverde Locken Refresh-Spray:** the cationic care ingredient (r17) is listed only after lactic acid (r13) and arginine, and the oils come after the preservative → only traces → Styling `refresher`.

---

## Sources

1. EU 1223/2009 Annex V (phenoxyethanol, benzoic acid, sorbic acid): https://legislation.gov.uk/eur/2009/1223/annex/V
2. Commission Regulation (EU) 866/2014 (CTAC/STAC/BTAC limits): https://www.legislation.gov.uk/eur/2014/866/data.html
3. Rose Sheet, "CIR changing allowable concentrations of cetrimonium chloride" (0.1 % → 0.25 % leave-on): https://hbw.pharmaintelligence.informa.com/RS000869/CIR-CHANGING-ALLOWABLE-CONCENTRATIONS-OF-CETRIMONIUM-CHLORIDE
4. MakingCosmetics BTAC fact sheet (0.5–3 %): https://www.makingcosmetics.com/on/demandware.static/-/Sites-makingcosmetics-master/default/dw76ce73b6/fact-sheets/fact-sheet-behentrimonium1.pdf
5. MakingCosmetics PQ-10 fact sheet (leave-on 0.1–1.0 %): https://makingcosmetics.com/on/demandware.static/-/Sites-makingcosmetics-master/default/dwdc52f139/fact-sheets/fact-sheet-polyquaternium-10.pdf
6. Cosmetics & Toiletries, ingredient profile guar HPTC (leave-in use): https://www.cosmeticsandtoiletries.com/cosmetic-ingredients/moisturizing/article/21834854/ingredient-profileguar-hydroxypropyltrimonium-chloride
7. Wacker BELSIL ADM 6057 E (35 % active) and DADM 3240 E (0.4–4 %): https://wacker.com/h/en-gb/silicone-fluids-emulsions/silicone-fluid-emulsions-functional/belsil-adm-6057-e/p/000004626 · https://wacker.com/h/en-pk/c/belsil-dadm-3240-e/p/000098228
8. Teknoscienze, "The development of self-preserving gels" (levulinates are not Annex-listed preservatives): https://www.teknoscienze.com/tks_article/the-development-of-self-preserving-gels/
9. SpecialChem, Vercatech Levulinate 25 TDS: https://www.specialchem.com/cosmetics/product/jover-scientech-vercatech-levulinate25
10. SpecialChem, Lamberti Alpicare COH 40 (PEG-40 HCO; premix the oil for a clear aqueous solution): https://www.specialchem.com/cosmetics/product/lamberti-alpicare-coh-40
11. EU 1223/2009 Art. 19(1)(g) (ingredients < 1 % in any order): https://www.legislation.gov.uk/eur/2009/1223/article/19

pH-adjuster and perfume levels are formulator convention; no single published source was found. They are used only as rank yardsticks, never as percentages.
