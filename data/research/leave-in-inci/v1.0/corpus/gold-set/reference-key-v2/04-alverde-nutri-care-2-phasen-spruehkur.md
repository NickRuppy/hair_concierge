# S4 — alverde NATURKOSMETIK Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 4 · 75 ml · GTIN 4066447105032 · `formulaFingerprintSha256` 14656014…7840

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `provisional_identity_conflict` |
| Preserved gap (G5) | INCI is corroborated by three independent T3 aggregators, exact match, but could not be upgraded to T1/T2 this pass: the exact GTIN-bearing dm.de URL returned 404 and dm.de site search no longer surfaces the SKU. Current-market availability under this GTIN is in doubt; the formula content is not. |
| Directions verbatim | „Je nach Bedarf aus ca. 30 cm Entfernung in die Haarlängen und -spitzen sprühen. Kontakt mit den Augen vermeiden. Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden. HINWEIS: Bitte vor Gebrauch schütteln!" |
| Directions authority | dm.de (Wayback capture). Packet tier C3; **read as C2-equivalent under RC-1** (alverde is dm's own brand). Routed to review. |
| Rinse test (R11) | **PASS** — no rinse instruction. |

## G0 — product form

`in_category`. Aqua leads; the product stays on the hair; conditioning is primary.

## Reading conventions applied

**Tail marker (§3.1.1):** the first enumerated capped ingredient is the **declared allergen block**, `LINALOOL` at **rank 14** of 16. No preservative from the §3.1.1 list is declared at all. The marker therefore sits two positions from the end and separates almost nothing: ranks 1–13 are all "above the tail". This is recorded as a **material limitation** — the heuristic degenerates on short naturkosmetik lists whose only capped materials are the fragrance allergens (§17.14). `tail_marker: none_visible` was not taken, because §3.1.1's enumeration explicitly includes the allergen block.

---

## §7 dimensions

### 1. FORM — `two_phase`

confidence **moderately_high** · E2 · scope formula.
**formula_observations** AQUA (1) with an unemulsified oil phase: GLYCINE SOJA OIL (2), ARGANIA SPINOSA KERNEL OIL (7), plus ALCOHOL (3). The only surfactant-type material in 16 ingredients is CAPRYLYL/CAPRYL GLUCOSIDE (10), a single mild alkyl polyglucoside deep in the list.
**product_inferences** Delivered oil:water ratio per actuation depends on shake quality; unmeasured (SR §M.9, §17.9).
**supporting_signals** „2-Phasen" in the product name and „Bitte vor Gebrauch schütteln!" in the directions — both corroboration only; the row is decidable from architecture alone (§7.1 v0.2).
**counter_signals** A single APG at rank 10 is present. It is **not** a solubiliser package capable of carrying a bulk oil at rank 2, and §7.1's `two_phase` row requires "no emulsifier and no solubiliser package **capable of carrying that load**" — the capability test, not mere absence.
**threshold_reasoning** Decision order: not anhydrous (Aqua rank 1); `two_phase` matches and the order takes the first match. `emulsion` would need a true O/W emulsifying system — a lone APG with a bulk oil is not one. `microemulsion` would need a solubiliser *package* (two or more solubiliser-type materials, or one plus glycols high in the list) — only one is declared.
**limitations** FORM is a low-confidence weight proxy (G9). review_status `provisional`.
`presentation_form`: 2-Phasen-Sprühkur.

### 2. COND — `moderate`

confidence moderate · E2.
**formula_observations** One coherent route: a persistent emollient package — GLYCINE SOJA OIL (2), ARGANIA SPINOSA KERNEL OIL (7), with TOCOPHERYL ACETATE (11). Absent: any quat, any cationic polymer, any silicone, any fatty alcohol.
**shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
**threshold_reasoning** `low` is excluded — persistent non-volatiles (two vegetable oils) sit above the tail. `high` is excluded — it requires an LGN pair, and no cationic surfactant exists anywhere in the list.
**counter_signals** Prunus Amygdalus Dulcis Seed **Extract** (8) and Hippophae Rhamnoides Fruit Extract (9) are extracts, not oils, and were not read as lipid load; the „Bio-Mandel" naming is E0 (FS-5).
**limitations** G4; the degenerate tail marker (see above). review_status `provisional`.

### 3. SLIP — `moderate`, bias `unknown`

confidence low_moderate · E2. One M1 contributor present as architecture (a lipid deposit). `high` requires two or more **independent** contributors — two vegetable oils are two members of one mechanism, not two mechanisms (§6 rule 1). `low` requires no persistent lubricant, which is false.
**bias reasoning** `unknown` — a non-film lipid load matches no bias value (open gap §17.16). Alcohol (3) is a volatile solvent but not an M6 volatile carrier in the §5 sense (M6 covers volatile silicones and hydrocarbons), so it does not make the architecture "volatile-dominant" for `wet_biased`. review_status `provisional`.

### 4. SFR — `moderate`
confidence low_moderate · E2. One alignment route: a medium-band emollient package (soybean and argan oil, both unenumerated liquid vegetable oils read in the **medium** band by the §7.5 convention). `high` requires a continuous film route — no persistent silicone and no substantive cationic-polymer film exists. `low` requires water phase and humectants only. review_status `provisional`.

### 5. WT — `moderate` (single-family row)

confidence moderate · E2 · **field marked uncertain**.
**formula_observations** Exactly one persistent non-volatile family present as architecture: liquid vegetable oils — GLYCINE SOJA OIL (2) and ARGANIA SPINOSA KERNEL OIL (7). No LGN pair. No enumerated rich/low-spreading band member.
**counter_signals (decisive, recorded)** Soybean and argan are **unenumerated** liquid vegetable oils, read in the **medium** band by the §7.5 v0.2 convention — they count as a persistent family but do not satisfy the rich-band test. Separately: **§7.5's G9-resolution clause 1 says a two-phase product carrying "a bulk oil above the tail" reaches `high` "through the observed rank of its oil/silicone load"** — soybean oil is at rank 2 in an unemulsified system, which reads as a bulk oil. That clause and the `high` anchor row (which requires an LGN pair, or two-plus families with a rich-band member) give **different answers for this product**. The anchor table was taken as governing, because §10.1.1/G14 requires a projected value to be exactly what its anchor says. Field marked uncertain and routed.
**threshold_reasoning** `low` is excluded — a persistent family sits above the tail. `high` is excluded on the anchor rows as written. The multi-family `moderate` row was tested and not used: both oils are one family, so the plain single-family `moderate` row applies and its mandatory multi-family counter-signal is not triggered.
**limitations** Dose is the unmeasured term and is *especially* unmeasured for a two-phase product (§17.1, §17.9). Fine-hair consequence is a product judgment call (§17.11). Degenerate tail marker.
review_status `provisional`.

Transfer caution: not attached — the above-tail load is medium-band, not low-spreading.

### 6. PERS — `neutral_non_volatile`
confidence moderate · E2. Persistent species are vegetable oils and tocopheryl acetate. No quat, no polymer, no silicone anywhere in 16 ingredients. Alcohol is volatile and contributes nothing (M6). `permanent_cationic` and `ph_dependent_cationic` require enumerated species that are absent; `volatile_or_water_soluble` is excluded because non-volatile lipids dominate. Monomeric-quat rule not engaged. **G11**: mechanism ordering only, never a duration. review_status `approved`.

### 7. HOLD — `none`
confidence high · E1 — no L5 fixative-class polymer of any kind. review_status `approved`.

### 8. HEAT — `not_claimed` → binary `false`
confidence moderate · E0. No heat claim on the brand-owner page; the product's positioning is nourishing care („Nutri-Care", almond and argan). L9 closed-list check: **no L9 member declared**. §13.3 rule 4. review_status `provisional` (RC-1).

### 9. HUM — `not_claimed`
confidence moderate · E0/E2. No C1/C2 humidity or anti-frizz claim **and** no qualifying route (no hydrophobic continuous film former; vegetable oils are not a film-forming route in the L2/L5 sense). The humectant leg is in any case **dominant** — GLYCERIN (4), SODIUM LACTATE (5), BETAINE (6), three members clustered above the tail — which blocks `formula_plausible` outright (§7.9 step 1). **Glycols-are-not-automatically-humectants check (§7.9 v0.2):** no glycol is declared; glycerin/sodium lactate/betaine are unambiguously humectants, so the conservative default did not need to be invoked. Humectants never support a humidity claim in either direction (FS-15, FS-6). review_status `approved`.

### 10. R2 — `none_visible`
confidence **high** · E1. No protein of any kind, no silane derivative, no silicone quat, no peptide is declared. review_status `approved`.

### 11. DOSE — `high` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence low_moderate · E2. Fires on `FORM = two_phase`, the one place §7.5's G9 resolution clause 3 lets the form label carry information — a **dose-variability** statement, not a weight statement. WT `moderate` alone would give `moderate`. Same §7.11 internal tension as slot 1 (the "DOSE follows WT" paragraph vs the explicit `two_phase` trigger); recorded. Two-phase is the least dose-predictable form (§17.9). review_status `provisional`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (13) plus declared allergens LINALOOL (14), LIMONENE (15), COUMARIN (16).
**notes** `ALCOHOL` at **rank 3** — materially present; recorded as an additional exposure note (L8). G6 applies. review_status `approved`.

### 13. ROLE — `[ends_only, post_wash, refresh]`
confidence low_moderate · E1 · scope directions. Verbatim sentences, RC-1 C2-equivalent source dated 2026-09-03:
- `ends_only` ← „Je nach Bedarf aus ca. 30 cm Entfernung in die Haarlängen und -spitzen sprühen."
- `post_wash` ← „Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden." (damp application)
- `refresh` ← same sentence (dry-hair application)
„Bitte vor Gebrauch schütteln!" is a handling instruction and establishes **no** role (§7.13). `heat_styling` and `curl_styling` not taken — no heat tool, no curl instruction. Confidence held low_moderate: one sentence carries two roles and „feuchtes Haar" is not explicitly „frisch gewaschen". review_status `provisional` (RC-1).

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 consequence of the emollient alignment route |
| CURL | `none` (low) | HOLD = `none` |
| R3 | `unknown` | No bond claim, no bond chemistry |
| LAYER | no string emitted | No cationic species and no substantive film |
| Buildup caution | not emitted | PERS projects `moderate` |

## §9 care_direction — `moisture`

confidence moderate · E2. L3 (soybean 2, argan 7) and L4 (glycerin 4, sodium lactate 5, betaine 6) are both present as architecture; L1 absent; no protein-film route. `protein` needs R2 ∈ {candidate, tested} — `none_visible`, and no protein is declared at all. `balanced` needs both halves. `unknown` does not apply (not silicone-led, architecture readable). Two legs above the tail supports up to `moderate`. Constraint 1 observed: this did not drive WT, PERS, HOLD or HEAT.

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "two_phase",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["ends_only", "post_wash", "refresh"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig.",
    "Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark.",
    "Enthält deklarierte Duftstoffe.",
    "Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben."
  ],
  "uncertain_fields": ["weight_potential"],
  "assumption_notes": [
    "WT held at moderate on the anchor table; §7.5's G9-resolution clause 1 arguably supports high for a two-phase bulk oil at rank 2.",
    "usage_role rests on reading convention RC-1."
  ]
}
```

**Focus selection (§10.2).** `volume_lightness` — needs WT `low`; WT is `moderate`, and the anchor adds "never from FORM alone" (G9, FS-2), so the spray form buys nothing. `detangling` — no detangling-led C1/C2 positioning („Nutri-Care 2-Phasen-Sprühkur" is nourishing-care positioning) and the slip-dominant prong needs WT `low`. `smoothing` — SFR `moderate`. `curl_definition` — HOLD `none`. `heat_styling` — HEAT `not_claimed`. `repair` — R2 `none_visible`, no protein/silane active. `shine` — no distinct gloss route. Step 5: **`general`**.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `moderate`; fine value carries the §7.5 judgment-call limitation; DOSE does not modify the table (G3).
- `damage_fit` ← **row 2** (COND `moderate`, no qualifying repair route).
- `texture_fit` ← **row 2** (`weight_potential = moderate`, any slip).
- `scalp_application_fit` ← ordered test: **`avoid`** on the EXPO trigger — `aromatic_or_allergen_exposure`, independently reinforced by `fragrance_declared` combined with a materially present `Alcohol` note. The ends-only placement would otherwise give `conditional`.

## §14 review routing

1. **Two-phase product** — least dose-predictable form (§14).
2. **Absent exact-market identifier** — the GTIN-bearing dm.de URL 404s and the SKU is no longer surfaced by dm.de search; possible delisting (§14).
3. **`claim_authority_gap`** — ROLE and the claim reads depend on RC-1.
4. **WT anchor conflict** — §7.5's G9-resolution clause 1 vs the `high` anchor row for a two-phase bulk oil above the tail.
5. **Degenerate tail marker** — the marker is the allergen block at rank 14 of 16; no preservative from §3.1.1's enumeration is declared. Every anchor that leaned on the boundary here effectively leaned on nothing.
