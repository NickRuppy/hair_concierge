# S8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 8 · 200 ml · GTIN 4015100813494 · `formulaFingerprintSha256` 9adbf8cb…e7dd

---

## G1 — identity, directions and claims

| Item | Value |
|---|---|
| Identity status | `verified` |
| Directions verbatim | „Vor Gebrauch schütteln! Nach jeder Haarwäsche in das handtuchtrockene oder trockene Haar sprühen. Nicht ausspülen! Regelmäßig anwenden. Rückstände vom Boden entfernen. Nicht in die Augen sprühen!" |
| Directions authority | **C2** — schwarzkopf.de, the manufacturer's German page. |
| Rinse test (R11) | **PASS**, and this is the slot's designed trap: the brand's own naming is „Sprüh-Conditioner" / „Express-Repair-**Spülung**", but the directions say „**Nicht ausspülen!**". Product form, list architecture and marketing name never override an explicit rinse direction — and here they must not manufacture one either. |

**Claim capture performed this pass (the packet carries directions but no claims).**

| Field | Tier | Verbatim | Source |
|---|---|---|---|
| HEAT | **C2** | „Hitzeschutz bis zu 230 °C" | schwarzkopf.de, Gliss Ultimate Repair Express-Repair-Spülung product page, retrieved 2026-09-04 |
| marketing position | C2 | „flüssiges Keratin", Perlenextrakt; „Widerstandsfähigkeit & Glanz" | same |
| HUM | — | No anti-frizz, humidity or „Luftfeuchtigkeit" claim found on the C2 page | same |

## G0 — product form

`in_category`. Aqua leads; the C2 directions leave the product on the hair; conditioning is primary.

## Reading conventions applied

**Tail marker (§3.1.1):** `Sodium Benzoate`, **rank 14** of 21. Above the tail: ranks 1–13.

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `non_lgn`, trace-only)
confidence moderate · E2. **formula_observations** CETYL PEG/PPG-10/1 DIMETHICONE (10) — a silicone emulsifier named explicitly in §7.1's non-LGN sub-type (b) — carrying a persistent silicone and oil phase: DIMETHICONE (3), PRUNUS ARMENIACA KERNEL OIL (4), PHENYL TRIMETHICONE (5), DIMETHICONOL (8); TRISILOXANE (2) is the volatile carrier.
**threshold_reasoning** Decision order: not anhydrous; not `two_phase` (a true emulsifier is declared); `emulsion` matches sub-type (b) and the order stops there — which is decision-relevant, because a solubiliser-plus-silicone reading would otherwise have suggested `microemulsion`. Sub-type (b) tests the **emulsifier system**, and a silicone emulsifier is one.
**counter_signals** No LGN pair: Cetrimonium Chloride (11) has no long-chain fatty alcohol partner anywhere in the list. Confidence held at moderate because a `microemulsion` reading is not absurd (a silicone emulsifier can also be read as a solubiliser); the decision order settles it. review_status `provisional`. `presentation_form`: Sprüh-Conditioner (spray).

### 2. COND — `moderate`
confidence moderate · E2.
**formula_observations** A persistent silicone/emollient package above the tail: DIMETHICONE (3), PHENYL TRIMETHICONE (5), DIMETHICONOL (8), PRUNUS ARMENIACA KERNEL OIL (4); plus a cationic route: POLYQUATERNIUM-16 (9), CETRIMONIUM CHLORIDE (11).
**counter_signals (recorded)** More than one coherent route is present — a persistent silicone package **and** a cationic polymer film — yet `high` is unreachable because §7.2 gates it on an **LGN pair**, and no fatty alcohol is declared. This is the v0.2 limitation deliberately left unchanged (§21, BR §2.10). It moves `conditioning_level` and, through it, the `damage_fit` row.
**shared_mechanism_ids** `M1`
**threshold_reasoning** `low` excluded (persistent non-volatiles above the tail). `high` excluded (no LGN pair). TRISILOXANE (2) is a volatile carrier and contributes nothing to residue or conditioning persistence (M6, FS-4).
**limitations** G4. review_status `provisional`.

### 3. SLIP — `high`, bias `dry_biased`
confidence moderate (ceiling) · E2. Two independent M1 contributors present as architecture: (i) a persistent silicone film/lubricant package (3, 5, 8) and (ii) a cationic route (PQ-16 at 9, Cetrimonium Chloride at 11). `moderate` would be one route.
**bias reasoning** `dry_biased`: a persistent film is present and water-phase slip agents are few — the only humectant, GLYCERIN, sits at rank 15, below the tail marker. `wet_biased` requires no persistent film. Confidence low on the qualifier itself (§17.16, §17.5). FS-22 checked: no instrumental combing figure is quoted as a consumer benefit. review_status `provisional`.

### 4. SFR — `high`
confidence moderate (ceiling) · E2. Continuous surface-film route: DIMETHICONOL (8) and PHENYL TRIMETHICONE (5), persistent silicone films, plus the substantive cationic-polymer film POLYQUATERNIUM-16 (9). Distinct lubricating species: DIMETHICONE (3) and PRUNUS ARMENIACA KERNEL OIL (4). Several distinct observations, so RC-4 is comfortably satisfied. `moderate` would be a single alignment route.
**counter_signal:** the film system here is **dedicated** — there is no LGN conditioning emulsion for it to be a by-product of — which is why the `smoothing` focus does qualify downstream (RC-5). Ambient smoothing only; no humidity statement (§7.4). review_status `approved`.

### 5. WT — `moderate` (multi-family row, §7.5)

confidence moderate (capped by the row) · E2.
**formula_observations** Three persistent non-volatile families above the tail: (1) **persistent silicones** — Dimethicone (3), Phenyl Trimethicone (5), Dimethiconol (8); (2) **liquid vegetable oil** — Prunus Armeniaca Kernel Oil (4); (3) **cationic-polymer film** — Polyquaternium-16 (9).
**counter_signals (MANDATORY, §4)** The multi-family observation itself: families (1) at ranks 3/5/8, (2) at rank 4, (3) at rank 9 — **none of them a rich/low-spreading band member**, and **no LGN pair**. Apricot kernel oil is an **unenumerated** liquid vegetable oil and is read in the **medium** band by the §7.5 convention, so it does not satisfy the rich-band test. **What holds the value below `high` is the absent rich-band member**: `high` is about occlusion, weight and transfer, and no butter, coconut, olive, castor, avocado, petrolatum or heavy mineral oil is declared. Multiple persistent families do raise residue above the single-family case, which is why the value is not `moderate` by the single-family route but by this row; dose remains the unmeasured term (§17.1).
**FS-13 double-check (required by §7.5):** this record pairs a `moderate` WT with a **`permanent_cationic` PERS and an emitted buildup caution** — it does not promise high persistence while presenting buildup as low.
**threshold_reasoning** `low` excluded (three persistent families above the tail; and FS-2 checked — the spray presentation contributed nothing). `high` excluded on both limbs. Confidence caps at `moderate` on this row and cannot rise to `moderately_high`.
**limitations** Fine-hair consequence is a product judgment call (§17.11); tail-marker heuristic. review_status `provisional`.

Transfer caution: not attached (no low-spreading non-volatile lipid above the tail).

### 6. PERS — `permanent_cationic`
confidence moderate · E2.
**formula_observations** POLYQUATERNIUM-16 (rank 9) — a **polymeric** quat, enumerated by INCI name in the v0.2 anchor, above the tail marker at rank 14 and architecturally placed. Supporting lower classes: Dimethicone/Dimethiconol/Phenyl Trimethicone and apricot oil → `neutral_non_volatile`; Cetrimonium Chloride (11) is a monomeric long-chain quat → `neutral_non_volatile`. Cetyl PEG/PPG-10/1 Dimethicone is a PEG-modified silicone → `volatile_or_water_soluble`, easily removed.
**threshold_reasoning** Highest class present as architecture wins. v0.2's repair matters here: under v0.1's "high-charge-density polyquaterniums" wording PQ-16 sat outside the enumeration; the class is now defined by label-visible polymeric quaternisation, which PQ-16 plainly is. `ph_dependent_cationic` requires amodimethicone or an amidoamine — none declared. Monomeric-quat rule not engaged (the polymeric quat is the class-setter).
**counter_signals** FS-12 checked: no amodimethicone selectivity argument is used. FS-3 checked: nothing is inferred from silicone presence or absence about buildup direction. Trisiloxane contributes nothing to persistence.
**limitations** G11 — no duration, wash count or clarification schedule; circulating removal percentages are banned. review_status `approved`.

**Buildup caution emitted.** Note for review: PERS `permanent_cationic` combined with a `refresh` usage role is an explicit §14 trigger, and this record has both.

### 7. HOLD — `none`
confidence moderate · E1 — no L5 fixative-class polymer is declared. Polyquaternium-16 is a conditioning polymer, not a fixative. review_status `approved`.

### 8. HEAT — trace `claim_only` → binary **`provides_heat_protection: true`**

confidence moderate · **E0** · scope product.
**claim authority (§2.4.1, G13)** A **C2** claim exists and was captured verbatim this pass: „Hitzeschutz bis zu 230 °C", on the manufacturer's German page. Retailer copy (dm.de carries the same figure) corroborates but did not create it.
**formula_observations** L9 closed-list check across all 21 ingredients: **no L9 member is present.** The closed list is VP/Acrylates/Lauryl Methacrylate Copolymer · Polyquaternium-55 · PVM/MA Copolymer + Polyquaternium-28 complex · PVP/DMAPA Acrylates Copolymer · Quaternium-70 · hydrolyzed wheat protein. This formula offers **Polyquaternium-16** (not PQ-55), **Hydrolyzed Keratin** and **Hydrolyzed Pearl** (not hydrolyzed wheat protein), and generic silicones — none of which is on the list.
**threshold_reasoning** §13.3: claim present, **no L9 member** ⇒ binary **`true`**, trace state **`claim_only`**, **and route the record to human review with a "claim looks formula-unsupported" note**. The standard does not silently drop the claim; review decides. `formula_plausible` would require an L9 member above the tail *and* a claim — the first half fails outright. Generic silicone and generic protein reach `claim_only` and no further (G10, FS-7). `product_tested` would need DSC, breakage-after-ironing or tryptophan-loss data on the exact product meeting §3.2 — none exists.
**Hard prohibitions observed.** No efficacy grade is emitted. The 230 °C figure is a marketing **use-condition** parameter, not a measured protection level, and is **not** promoted into any field — `heat_protection_max_c` does not exist in this model (ruling 6, FS-14). Published effect sizes in the two peer-reviewed anchors are on the order of 10–20 % damage reduction and are not expressed in °C.
**limitations** The binary is a **recommendation-policy** decision reporting what the product is sold as, not an efficacy statement; EU claim legality means a dossier exists somewhere, never that an instrumental finished-product test exists (§3.3, Reg. 655/2013). review_status `provisional`; **routed**.

### 9. HUM — `formula_plausible` (claim-free)
confidence **low** (no formula-only route above `low` exists) · E2.
**formula_observations** A hydrophobic, continuous film-forming route present as architecture: DIMETHICONE (3), PHENYL TRIMETHICONE (5), DIMETHICONOL (8) — a persistent hydrophobic silicone film with a plausible water-uptake-reduction mechanism.
**counter_signals (MANDATORY, §4)** Humectant observation: GLYCERIN is declared at rank 15, **below** the tail marker, so the humectant leg is not *dominant* and does not block the state (§7.9 step 1); it is materially declared, so it is recorded and **confidence is capped at `low`** (step 2). It never raises the state.
**counter_signals (claim)** No C1/C2 anti-frizz or humidity claim was found. The state is therefore a **claim-free** `formula_plausible`: it records that a hydrophobic film route is present, that the manufacturer makes no humidity claim, and that humidity response is measured, not inferred.
**projection consequence** Projects as the state and emits **no** user-facing string. §18 carries no string for a claim-free `formula_plausible` and none may be added (§7.9).
**threshold_reasoning** `not_claimed` requires both no claim *and* no route — the route exists. `claim_only` requires a claim. `product_tested` requires HHCR/DHCR, DVS or humidity-chamber imaging on the exact product with declared RH, temperature and equilibration time. review_status `provisional`.

### 10. R2 — `none_visible`
confidence moderate · E1.
**Mandatory trace note (§7.10 v0.2) — this is the v0.2 change working exactly as designed.** HYDROLYZED KERATIN is declared at **rank 6**, high in the list and above the tail, and HYDROLYZED PEARL at rank 7. Both are **plain hydrolysates**. Under v0.1 the `none_visible` anchor described a plain hydrolysate "sitting in the tail", which left rank-6 hydrolysates with no anchor at all; v0.2 resolves it: **what makes a protein an R2 route is cationisation or silane functionalisation, not rank**, so a plain hydrolysate is `none_visible` at any position. The observation, its rank and the reason it does not qualify are recorded here so the record does not read as if the protein were missed.
**Second trace note:** POLYQUATERNIUM-16 (9) is a non-silicone cationic polymer, removed from the `candidate` list in v0.2; it feeds PERS and SFR only.
**threshold_reasoning** `candidate` requires a cationised protein, a silane derivative or a silicone quat present as architecture — none of the three is declared. review_status `approved`.

### 11. DOSE — `moderate` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. WT = `moderate`, **including via the multi-family row**, sets `moderate` — §7.11 v0.2 is explicit that DOSE follows WT here and is **not** separately re-argued upward on family count. No `high` trigger (FORM is not `two_phase`; no rich-band lipid present as architecture). review_status `approved`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (12), TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES (16), CITRUS AURANTIUM PEEL OIL (17), LIMONENE (18), GERANYL ACETATE (21). No `Alcohol`/`Alcohol Denat.` note. G6 applies. review_status `approved`.

### 13. ROLE — `[post_wash, refresh]`
confidence moderate · E1 · scope directions · **C2 source**.
- `post_wash` ← „**Nach jeder Haarwäsche** in das **handtuchtrockene** oder trockene Haar sprühen." (schwarzkopf.de, C2, 2026-09-03)
- `refresh` ← the same sentence's „oder **trockene** Haar" limb — application to dry hair between washes.
**Not taken:** `heat_styling`. This is the sharpest ROLE finding in the set. §7.13 requires a direction sentence naming a heat tool, and adds explicitly that **"a temperature figure alone is a claim, not a direction"**. The product carries a C2 „Hitzeschutz bis zu 230 °C" claim and the archetype role is "heat-protective primer", yet **no direction sentence names a blow-dryer, straightener or curling iron**. `heat_styling` is therefore not established — and the `heat_styling` **focus**, which requires HEAT ≥ `claim_only` **and** ROLE including `heat_styling`, is unreachable for the set's designated heat product.
`ends_only` not taken (no placement restriction). „Vor Gebrauch schütteln!" is a handling instruction and establishes no role. review_status `approved`.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 consequence of the silicone/cationic film. „Glanz" is in the C2 positioning; that is E0 and does not create an independent value (§8.1) |
| CURL | `none` (low) | HOLD = `none` |
| R3 | `unknown` | No bond claim, no bond chemistry. The „flüssiges Keratin" positioning is protein marketing, not bond chemistry |
| LAYER | **string emitted** | A high-substantivity cationic polymer used before styling products — the §8.4 case. One string; no matrix, no score |
| Buildup caution | **emitted** | From the `permanent_cationic` evidence, non-quantitative, and required to be consistent with the WT reading (G3 rule 4) |

## §9 care_direction — `moisture` — **uncertain**

confidence **low** · E2.
**Reasoning.** R2 is `none_visible`, so `protein` is unreachable — and §9 constraint 3 is exercised head-on: the product is sold on „flüssiges Keratin", but its only protein is a plain hydrolysate, so on its architecture it is not a protein product. **Marketing direction never sets the value.** An L3 emollient leg (apricot kernel oil, rank 4) and an L1 cationic leg (PQ-16 at 9, Cetrimonium Chloride at 11) are present as architecture, and §9's "any one leg present as architecture is sufficient" rule returns `moisture`.
**Counter-signal (decisive, recorded).** The **material direction of this formula is silicone** — ranks 2, 3, 5, 8 and 10 are all silicones. §9's v0.2 silicone-led rule sends a silicone-led architecture to `unknown`, but only when there is *no* R2 route **and** *no* material humectant/emollient leg. Here a thin emollient leg exists at rank 4, so the rule's literal conditions are not met and it does not fire — yet the product is plainly silicone-led. **v0.2 does not say what to do when silicone leads and a thin L1/L3 leg also exists.** `moisture` was taken at `low` confidence and the field marked uncertain; `unknown` is the defensible alternative. Routed.

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "high",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "smoothing", "secondary": [] },
  "usage_role": ["post_wash", "refresh"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab.",
    "Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das.",
    "Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen.",
    "Enthält deklarierte Duftstoffe."
  ],
  "uncertain_fields": ["care_direction"],
  "assumption_notes": [
    "provides_heat_protection = true is claim-led policy (C2 claim), not an efficacy statement; no L9 member exists in the formula."
  ]
}
```

**Focus selection (§10.2).** Qualifying routes: `smoothing` — SFR `high` on a **dedicated** silicone/cationic film system with no LGN emulsion behind it (RC-5), resting on four independent endpoint-relevant observations (ranks 3, 5, 8, 9). `heat_styling` — HEAT is `claim_only` under C2 authority, which clears the first half, but ROLE does **not** include `heat_styling` (no direction sentence names a heat tool), so the route **fails**. `repair` — R2 is `none_visible`; the alternative limb, "protein/silane actives in the product's C1/C2 marketing position", *is* arguably met („flüssiges Keratin" is named on the C2 page as what the product does), but a marketing position is not a formula observation, so under step 2's strength scale it ranks below `smoothing`'s four observations and step 3's rank order (repair > smoothing) is never reached. `repair` also fails the secondary bar, which requires an independent endpoint-relevant observation at moderate or better — a plain hydrolysate is not one (§7.10). `detangling`, `volume_lightness`, `curl_definition`, `shine` — all fail their anchors.
⇒ **`primary: smoothing`, secondary `[]`.**

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `moderate`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2** (COND `moderate`, no qualifying repair route). Row 3a needs COND `high`; row 3b needs R2 ∈ {candidate, tested}. An „Ultimate Repair" product therefore sits at `highly_damaged: conditional` — which is the intended behaviour: generic repair naming and a plain hydrolysate cannot buy the tier.
- `texture_fit` ← **row 2** (`weight_potential = moderate`, any slip).
- `scalp_application_fit` ← ordered test: **`avoid`** on the EXPO trigger `aromatic_or_allergen_exposure`. Note the tension with the directions, which instruct spraying into the hair after every wash without any placement restriction.

## §14 review routing

1. **Heat-protection claim with no L9 member** (§13.3, §14) — the binary is `true` by claim-led policy while the formula offers nothing from the closed evidenced list. The §18 review string is emitted.
2. **`PERS = permanent_cationic` combined with a `refresh` usage role** (§14) — both present; the buildup caution travels with the `high` persistence projection.
3. **`care_direction`** — silicone-led architecture with a thin emollient leg; §9's silicone-led rule does not resolve it.
4. **ROLE / focus interaction** — the set's designated heat-protective primer cannot reach the `heat_styling` focus, because its C2 directions name no heat tool and §7.13 forbids reading a role from the temperature claim.
