# S11 — Balea Leichtkämmspray Pure Styling

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 11 · 200 ml · GTIN 4067796148855 · `formulaFingerprintSha256` eb638053…c685f

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `verified` |
| Directions verbatim | „Auf nasses Haar aufsprühen, kurz einwirken lassen, kämmen und wie gewohnt frisieren. Produkt muss nicht wieder ausgespült werden." |
| Directions authority | dm.de. Packet tier C3; **read as C2-equivalent under RC-1** (Balea is dm's own brand). Routed to review. |
| Rinse test (R11) | **PASS** — the directions state affirmatively „Produkt muss nicht wieder ausgespült werden." |
| Packet artifact recorded | The packet's `normalized_ingredients` array splits „1,2-Hexanediol" into two tokens, `"1"` and `"2-HEXANEDIOL"`, because the normalizer splits on commas. The `raw_inci` string is correct; the artifact does not change any anchor here (both fragments sit below the tail marker) but it is recorded, since a comma-containing INCI name would corrupt rank counts on another product. |

## G0 — product form

`in_category`. Aqua leads; the directions leave the product on the hair; detangling/combability is primary. Not styling-first despite the „Pure **Styling**" range name — no L5 fixative-class polymer exists anywhere in the eleven declared ingredients. Classify by function + directions + architecture, never by name (§2.3).

## Reading conventions applied

**Tail marker (§3.1.1):** `Hydroxyacetophenone`, **rank 7** of 11. Above the tail: Aqua (1), Betaine (2), Propylene Glycol (3), Cetrimonium Chloride (4), Inulin (5), Panthenol (6). This is the cleanest formula in the set: eleven ingredients, a mid-list marker, nothing ambiguous.

---

## §7 dimensions

### 1. FORM — `aqueous_or_hydroalcoholic_solution`
confidence **high** · E2. AQUA (1) leading with a glycol early — PROPYLENE GLYCOL (3) — **no long-chain fatty alcohol**, **no** true emulsifier and no solubiliser-type material of any kind. A short-chain-quat/cationic species is present (CETRIMONIUM CHLORIDE 4), which the row calls "typical but not required".
**threshold_reasoning** Decision order: not anhydrous; not `two_phase` (there is no oil or silicone phase to be unemulsified); not `emulsion` (no emulsifying system, no lipid or silicone phase); not `microemulsion` (neither a solubiliser package nor an oil/silicone load). The solution row matches on every clause, including the "no long-chain fatty alcohol" exclusion.
**note** This record exercises v0.2 rule change 3 in reverse: v0.1's solution row *required* a cationic polymer or short-chain quat; that requirement was dropped in v0.2. Here one is present anyway, so the change is not decisive. review_status `approved`. `presentation_form`: Spray.

### 2. COND — `low`
confidence moderate · E2.
**formula_observations** No cationic polymer, no persistent silicone, no emollient of any kind, no fatty alcohol. The only non-humectant functional species is CETRIMONIUM CHLORIDE (4), a monomeric long-chain quat. The rest of the above-tail list is BETAINE (2), PROPYLENE GLYCOL (3), INULIN (5), PANTHENOL (6) — a humectant/plasticiser leg.
**threshold_reasoning** `moderate` requires **either** a cationic-**polymer** film route (PQ-10/-7/-11/-55, Guar HPTC) **or** a persistent silicone/emollient **package**. Neither exists: a single monomeric quat is not a polymer film route, and there is no emollient at all. `high` requires an LGN pair — no fatty alcohol is declared.
**counter_signals** §7.2's `low` anchor reads "Only a **short-chain** quat, or a water/glycol solution with no persistent non-volatile above the tail", while §7.6 classifies Cetrimonium Chloride as a **monomeric long-chain** quat that is a materially persistent species. The two sections use different vocabulary for the same material, and this record sits exactly on that seam.
**Recorded contradiction (v0.2 §21, "deliberately not changed").** This record returns **COND `low` with SLIP `moderate`** on a single monomeric-quat observation — the contradiction v0.2 explicitly declined to repair, recording it "so round 2 can measure whether it still bites". **It still bites**, here and at slot 7. Resolving it requires deciding whether a monomeric quat is "a route" for COND — the same question C4 answered for PERS but was not asked to answer for COND.
**limitations** G4. Field marked uncertain in the profile on this ground. review_status `provisional`.

### 3. SLIP — `moderate`, bias `wet_biased`
confidence low_moderate · E2. One M1 contributor present as architecture: CETRIMONIUM CHLORIDE (4), a cationic species above the tail.
**threshold_reasoning** `low` requires "no persistent lubricant **and** no cationic species above the tail" — the second clause fails outright, so `low` is unreachable. `high` requires two or more independent contributors; there is exactly one.
**bias reasoning** `wet_biased` — this is one of the few records where the qualifier fits its definition cleanly: a **water-dominant architecture with no persistent film**. There is no silicone, no polymer film and no lipid deposit anywhere. Confidence low on the qualifier itself (§17.16, §17.5). FS-22 checked: no instrumental combing figure is quoted as a consumer benefit.
review_status `provisional`.

### 4. SFR — `low`
confidence moderate · E2. `low`'s anchor is met exactly: no persistent film; water phase and humectants only. No silicone, no cationic polymer, no emollient package, no film former. `moderate` would need a medium/dry-feel emollient package or a single film former — neither exists. review_status `approved`.

### 5. WT — `low`
confidence **moderately_high** · E2.
**formula_observations** A water/glycol-dominant architecture. **No persistent non-volatile family above the tail**: no light/medium-band emollient, no light silicone, no cationic-polymer film. No LGN pair. No rich-band lipid.
**counter_signals** CETRIMONIUM CHLORIDE (4) is a non-volatile cationic surfactant and does deposit. It is **not** one of the three families the `moderate` anchor enumerates (a light/medium-band emollient, a light silicone, or a cationic-polymer film), so it does not lift the value — recorded, because a reviewer could argue otherwise. INULIN (5) is a polysaccharide; it is water-soluble, not a persistent non-volatile family.
**threshold_reasoning** `moderate` requires exactly one persistent non-volatile family present as architecture, from the enumerated three — none is present. `high` requires an LGN pair or two-plus families with a rich-band member. Confidence rises to `moderately_high` because both §7.5 conditions hold: FORM resolves to a definite architecture, and the non-volatile architecture is fully readable above the tail — an eleven-ingredient list with a mid-list marker is as readable as this category gets. G9 checked in both directions: the spray form contributed nothing (FS-1, FS-2); the value rests on the absence of any persistent family in the ranks, not on the presentation.
**limitations** Dose remains the unmeasured term (§17.1). The `low` value feeds a `recommended` fine-hair prior, and **that prior is a product judgment call**, not a derived scientific constant (§7.5, §17.11). review_status `approved`.

Transfer caution: not attached (no lipid load at all).

### 6. PERS — `neutral_non_volatile` **with the mandatory monomeric-quat note**
confidence moderate · E2. **This record is the clearest exercise of v0.2 rule change 12 in the set.**
**formula_observations** The dominant — indeed the only — persistent species is **CETRIMONIUM CHLORIDE (4)**, a monomeric long-chain quat. Everything else above the tail is a humectant or a water-soluble polysaccharide.
**Required note (§7.6, mandatory — the record is invalid without it):** *"Persistence rests on a monomeric long-chain quat: permanently charged, so more substantive than a neutral deposit, but small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a duration (G11)."*
**threshold_reasoning** `permanent_cationic` is unreachable — no polymeric or silicone-functional quat is declared, and a monomeric quat **never** reaches that class on its own (§7.6). `ph_dependent_cationic` requires amodimethicone or an amidoamine. **`volatile_or_water_soluble` was v0.1's forced answer here** and is now explicitly excluded: v0.1 had no home for monomeric long-chain quats, so the class had to be dropped to `volatile_or_water_soluble`, which **under-states persistence and therefore under-warns on buildup** — the direction FS-20 exists to guard. v0.2 places it in `neutral_non_volatile` instead.
**counter_signals** The buildup caution is **not** emitted, because the projection is `moderate`, not `high`. FS-13 double-check: the record makes no high-persistence promise anywhere, so there is nothing for a low-buildup message to contradict.
**limitations** G11 — no duration, wash count, applications-to-buildup or clarification schedule; the circulating removal percentages are banned. review_status `approved`.

### 7. HOLD — `none`
confidence **high** · E1. No L5 fixative-class polymer, and not even a rheology-exclusion candidate, among eleven ingredients — despite the „Pure Styling" range name, which is E0 and decides nothing (§2.3). `hold_support` has no `unknown` member by design (§10), and `none` is the correct value, not an abstention. review_status `approved`.

### 8. HEAT — `not_claimed` → binary `false`
confidence moderate · E0. No heat claim: the brand-owner page positions the product as a fragrance-free detangling spray, and no „Hitzeschutz" or temperature figure appears. L9 closed-list check: **no L9 member.** §13.3 rule 4. review_status `provisional` (RC-1 only).

### 9. HUM — `not_claimed`
confidence moderate · E0/E2. No C1/C2 humidity or anti-frizz claim, **and** no qualifying route — there is no hydrophobic continuous film-forming route of any kind (no fixative, no silicone). The humectant leg is in any case **dominant**: BETAINE (2), PROPYLENE GLYCOL (3), INULIN (5), PANTHENOL (6) — four members occupying every functional position above the tail except the quat — which blocks `formula_plausible` outright (§7.9 step 1).
**Glycols check:** Propylene Glycol at rank 3 in a humectant-led water phase reads as a humectant, not a solvent; the conservative default would give the same answer.
FS-15/FS-6: humectants are a softness/plasticiser route and, for a humidity claim, a **counter-signal** — never support, in either direction. FS-16: no dew-point threshold is encoded. review_status `approved`.

### 10. R2 — `none_visible`
confidence **high** · E1. No protein of any kind, no silane derivative, no silicone quat, no peptide among eleven ingredients. PANTHENOL (6) is a fibre-mechanics signal, not a surface-film signal and not a heat signal (§5 L6, FS-24). review_status `approved`.

### 11. DOSE — `low` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2.
**threshold_reasoning** The `low` row requires WT `low` **and** a carrier that is volatile- or **water**-dominant with no persistent family above the tail. Both hold. **This row is v0.2 rule change 33 working:** under v0.1 the row additionally required `FORM = aqueous_or_hydroalcoholic_solution` *and* a "volatile-dominant carrier", and since water is not a volatile carrier in the M6 sense, a purely aqueous low-weight product like this one satisfied **no row at all**. It now returns `low` cleanly. review_status `approved`.
**limitations** No market-representative consumer dose figures exist for any leave-in form (§17.1).

### 12. EXPO — `no_listed_fragrance_signal`
confidence moderate · E1. No `Parfum`, no `Aroma`, none of the 26 declared EU allergens, no clearly aromatic essential oil among eleven ingredients; dm.de carries an „Ohne Parfüm" badge on the page (corroboration, E0).
**Hard limit restated in the record (§7.12, SR §M.12):** "no listed fragrance signal" is **not** fragrance-free, **not** allergy-safe and **not** hypoallergenic — labelling thresholds and incomplete formulas prevent those claims, and the EU technical document to Reg. 655/2013 addresses "free from" and "hypoallergenic" specifically. The §18 string carries that limit explicitly.
**notes** No `Alcohol`/`Alcohol Denat.`. G6 applies. review_status `approved`.

### 13. ROLE — `[post_wash]`
confidence moderate · E1 · scope directions.
- `post_wash` ← „**Auf nasses Haar** aufsprühen, kurz einwirken lassen, kämmen und wie gewohnt frisieren." (dm.de, RC-1 C2-equivalent, 2026-09-03) — application to wet hair.
**Not taken:** `ends_only` — the sentence states no placement restriction. `refresh` — nothing about dry hair between washes. `heat_styling` — „wie gewohnt frisieren" names no heat tool. `curl_styling` — nothing.
review_status `provisional` (RC-1).

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `absent` (moderate) | No alignment or deposition film; SFR is `low`. „Shiny product appearance" is not shine (§8.1) |
| CURL | `none` (low) | HOLD = `none` |
| R3 | `unknown` | No bond claim, no bond chemistry |
| LAYER | no string emitted | No cationic polymer and no substantive film; a single monomeric quat is not the §8.4 case |
| Buildup caution | not emitted | PERS projects `moderate`; no high-persistence promise is made anywhere |

## §9 care_direction — `moisture` (humectant-led minimum)

confidence **low** · E2 · shared_mechanism `M7_HUMECTANT_PLASTICISER`.
An L4 humectant leg is present as architecture — BETAINE (2), PROPYLENE GLYCOL (3), INULIN (5), PANTHENOL (6), four members above the tail — with **no** R2 route. An L1 leg exists but is thin (one monomeric quat) and there is **no** L3 leg at all, which is exactly the v0.2 humectant-led minimum row: `moisture` at **`low`** confidence, recorded, **with the thin-architecture observation as the required counter-signal**.
`protein` requires R2 ∈ {candidate, tested} — `none_visible`, and constraint 2 applies directly: **panthenol alone never sets `protein`**. `balanced` requires both halves. `unknown` (the silicone-led abstention) does not apply — no silicone is declared. Constraint 1 observed: this did not drive WT, PERS, HOLD or HEAT.

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "aqueous_solution",
  "conditioning_level": "low",
  "weight_potential": "low",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "detangling", "secondary": ["volume_lightness"] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "recommended", "medium": "recommended", "coarse": "conditional" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "conditional", "highly_damaged": "caution" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "conditional", "coily": "caution" },
  "scalp_application_fit": "unknown",
  "cautions": [
    "Bleibt leicht im Haar und beschwert kaum.",
    "Keine deklarierten Duftstoffe in der Liste. Das heißt nicht parfümfrei oder hypoallergen.",
    "Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
  ],
  "uncertain_fields": ["conditioning_level"],
  "assumption_notes": [
    "usage_role rests on reading convention RC-1 (dm.de as the brand owner's page for Balea).",
    "conditioning_level uncertain: the COND low / SLIP moderate seam on a single monomeric-quat observation is unrepaired in v0.2 §21."
  ]
}
```

**Focus selection (§10.2) — the one record in the set where the procedure has real work to do.**

- Step 1, qualifying routes. **`detangling`** qualifies on **both** prongs, independently: (i) *detangling-led C1/C2 positioning* — the product is literally named „**Leichtkämmspray**", which §10.2's anchor names verbatim as qualifying positioning — with SLIP `moderate` ≥ the required threshold; (ii) *a slip-dominant light architecture* — SLIP `moderate`, COND `low` ≤ `moderate`, WT `low`: slip is the product's whole point rather than a by-product of a rich conditioning load. Note the v0.2 guard that did **not** bite here: "SLIP `high` alone never sets it" — SLIP is `moderate`, and the route qualifies on positioning and architecture, not on a slip score. **`volume_lightness`** qualifies: WT `low` **and** no persistent film route — and, per the anchor's own caution, **not from FORM alone** (G9, FS-2); the value rests on the observed absence of any persistent non-volatile family, not on the spray presentation.
- Step 2, strength. `detangling` rests on two independent qualifying prongs; `volume_lightness` on one. `detangling` is stronger, so step 3's rank order (which would also put `detangling` above `volume_lightness`) is not needed.
- Secondary. `volume_lightness` clears the independent-moderate+ bar on its own endpoint-relevant observation — the absent persistent-family architecture — which is not a restatement of the positioning prong that carries the primary. Cap of two respected; `general` is never a secondary value.
⇒ **`primary: detangling`, `secondary: [volume_lightness]`.**

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `low`: `fine: recommended`, `medium: recommended`, `coarse: conditional`. The fine value carries the §7.5 judgment-call limitation, and the `low` DOSE emits no dosing caution (only `high` does).
- `damage_fit` ← **row 1** (`conditioning_level = low` and no qualifying repair route): `healthy: recommended`, `moderately_damaged: conditional`, `highly_damaged: caution`. Marked uncertain through `conditioning_level`.
- `texture_fit` ← **row 1** (`weight_potential = low`, light dry-down): `straight/wavy: recommended`, `curly: conditional`, `coily: caution`. Not row 4 or 5, so no §14 texture routing.
- `scalp_application_fit` ← ordered test: **no `avoid` trigger fires** — EXPO is `no_listed_fragrance_signal`, no material alcohol, WT is `low` with no rich-band member and no oil-led load, and no direction says to avoid the roots. `suitable_if_evidenced` requires directions **explicitly** directing the product at the scalp or roots — „Auf nasses Haar aufsprühen" does not. `conditional` requires a stated placement that is not the scalp — the sentence states no placement at all. → **`unknown`**, the default, with the fixed §18 string. G6 applies to the value: nothing here is a tolerance prediction, and a clean EXPO flag is an exposure statement, not a safety statement.

## §14 review routing

1. **`claim_authority_gap`** — ROLE rests on RC-1 (dm.de as the brand owner's page for Balea). If RC-1 is rejected, `usage_role` becomes `[]`; nothing else moves, since HEAT and HUM are `not_claimed` under either tier.
2. **COND `low` / SLIP `moderate`** on one monomeric-quat observation — the seam v0.2 §21 left unrepaired, reproduced here at the same slot the blind lane originally found it. `conditioning_level` also sets the `damage_fit` row, so the seam has a projected consequence.
3. **Packet artifact** — the `normalized_ingredients` comma-split of „1,2-Hexanediol"; harmless here, corrupting elsewhere.
