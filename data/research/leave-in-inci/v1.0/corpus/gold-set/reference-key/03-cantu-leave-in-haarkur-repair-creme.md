# Slot 3 — Cantu Leave-In Haarkur Repair Creme (453 g)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Rich cream dry/damaged
- `gtin`: 810006945430 · `market`: DE · `identity_status`: **`provisional_formula_conflict`** (a genuinely different US formula circulates under GTIN 810006943405; the DE pack is authoritative here)
- `rawInciSha256`: `e49df19e2b99c5773b6b812b2c54d694e214901f58f8601ca6a383a9ca66ee12`
- `formulaFingerprintSha256`: `acb2659ab5068218f40c60aa550f49950dd25477f314dc6b4ca61600cc9ba21e`
- `review_routing`: **routed to human review** — (a) formula-source conflict (§14); (b) **heat-protection claim with no L9 member** (§13.3, §14).

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S3-dir` | T2 (dm.de, GTIN 810006945430 confirmed on page, dm-Art. 1685686) | „Großzügig und gleichmäßig auf die feuchten Haarspitzen auftragen und in Richtung Ansatz einarbeiten und durchkämmen. **Nicht ausspülen.** Damit sich die Wirkung noch mehr entfalten kann, über Nacht unter einer Haube einziehen lassen. Für das anschließende Styling und maximale Definition, je nach Bedarf die Coconut Curling Cream oder die Moisturizing Curl Activator Cream verwenden." |
| `S3-claim` | T2 (same page) | „Kann Spliss und Haarbruch reduzieren"; „Die reichhaltige Formel mit Sheabutter und natürlichen Ölen spendet dem Haar tiefenwirksame Feuchtigkeit"; **„Zudem bietet sie einen Schutz vor Hitzeschäden, die durch das Styling entstehen können."** No Anti-Frizz claim, no lightness claim, no hold claim for this product itself. |

---

## G0 — `in_category`

confidence **high** · E1 (directions) + E2 (architecture) · scope `directions`

- `AQUA` #1; „Nicht ausspülen" is explicit; conditioning is the declared primary function. `excluded_anhydrous`, `excluded_styling_first` (no L5 member at any position) and `excluded_other_form` all fail.

## 1. FORM — `emulsion`

confidence **high** · E2 · scope `formula`

- formula_observations: **LGN pair** — `CETEARYL ALCOHOL` #3 **plus** `BEHENTRIMONIUM METHOSULFATE` #5, both far above the tail; supported by `AQUA` #1 and `CETRIMONIUM CHLORIDE` #35.
- threshold_reasoning: the cationic-surfactant + fatty-alcohol lamellar pair is the exact `emulsion` anchor. `aqueous_or_hydroalcoholic_solution` fails (an LGN pair is present, and the emulsifier is not solubiliser-type). `microemulsion` fails (no PEG-ester battery, an LGN pair is present). `two_phase` fails (an emulsifier system is present; no shake direction).
- G9: this label must not set WT; WT is set below from the non-volatile architecture.
- `presentation_form` (metadata): Creme.
- review_status: `approved`

## 2. COND — `high`

confidence **moderately_high** (ceiling) · E2 · scope `formula`

- formula_observations: LGN pair (#3 + #5) **plus** three further independent lubrication routes — `CANOLA OIL` #2 (medium band), `BUTYROSPERMUM PARKII (SHEA) BUTTER` #6 and `OLEA EUROPAEA FRUIT OIL` #7 (rich/low-spreading band), and `POLYQUATERNIUM-10` #30 (cationic polymer, tail).
- threshold_reasoning: `high` requires an LGN pair above the tail **plus** at least one further independent lubrication route — met three times over, at architecture level (#2, #6, #7), with no material counter-signal, which is what G3 rule 3 requires before a top value may be reached at E2. `moderate` is excluded because a full LGN pair is present.
- shared_mechanism_ids: `M1_DEPOSITION_SURFACE_LUBRICATION`
- limitations: G4; R1 folded in (the „Haarbruch reduzieren" claim is an explanation frame derived from COND, never a separate score).
- review_status: `draft`

## 3. SLIP — `high`, bias `dry_biased`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- Two or more independent M1 contributors as architecture: cationic LGN deposit + rich emollient package.
- Bias reasoning: `wet_biased` requires a volatile- or water-dominant architecture with **no** persistent film — a rich lamellar deposit is present. `both` requires a volatile/water-phase route materially present — there is **no volatile carrier at all** in this formula. `dry_biased` therefore fits by elimination; confidence is held low because glycerin and the aqueous phase are substantial.
- limitations: FS-22; SR §M.5 (the WET+DRY merge is provisional).

## 4. SFR — `moderate` · SHN qualifier `absent`

confidence **moderate** · E2 · scope `formula`

- Absence pattern: **no silicone at any position**; `POLYQUATERNIUM-10` sits at #30 of 51, i.e. in the sub-1 % tail, so no substantive cationic-polymer film exists as architecture.
- threshold_reasoning: `high` requires a continuous surface-film route **plus** a lubrication route. The only candidate film is the LGN/emollient deposit already counted in COND and SLIP; **G3 forbids restating one M1 observation as a third independent maximum**. The endpoint-relevant *additional* observation the anchor demands is absent. `low` fails because a medium/rich emollient alignment route exists. → `moderate`.
- SHN `absent`: no distinct gloss route; the E0 „Glanz" claim does not set it (§8.1).

## 5. WT — `high`

confidence **moderately_high** · E2 · scope `formula`

- formula_observations: LGN pair `CETEARYL ALCOHOL` #3 + `BEHENTRIMONIUM METHOSULFATE` #5; **rich/low-spreading band members** `CANOLA OIL` #2, `BUTYROSPERMUM PARKII (SHEA) BUTTER` #6, `OLEA EUROPAEA FRUIT OIL` #7; plus `HYDROGENATED ETHYLHEXYL OLIVATE` #25 and `PENTAERYTHRITYL TETRACAPRYLATE/TETRACAPRATE` #32.
- threshold_reasoning: the `high` anchor fires on **both** available limbs — an LGN pair is present, and two or more persistent non-volatile families are present with rich-band members among them. `moderate` requires exactly one persistent non-volatile family and explicitly excludes an LGN pair combined with rich-band lipids.
- Ceiling raised to **moderately_high** because both §7.5 conditions hold: FORM resolves to a definite architecture, and the non-volatile architecture is fully readable above the 1 % tail (positions 2–7).
- attached transfer caution: **yes** — shea butter and olive oil are the textbook low-spreading, non-volatile, non-film-forming load. Qualitative only (SR §D.3).
- counter_signals: none material. The directions' overnight-under-a-cap option (`S3-dir`) increases, not decreases, expected residue.
- limitations: §17.11 fine-hair judgment call.
- review_status: `draft`

## 6. PERS — `neutral_non_volatile`

confidence **low** · E2 · scope `formula`

- formula_observations: non-volatile oils, butter and fatty alcohols at #2, #3, #6, #7; `BEHENTRIMONIUM METHOSULFATE` #5 and `CETRIMONIUM CHLORIDE` #35 (monomeric quats); `POLYQUATERNIUM-10` #30 (tail).
- threshold_reasoning: "highest class present **as architecture** wins". `permanent_cationic` is recorded as *supporting* only: PQ-10 is a permanently quaternised polymer but sits at #30 of 51, which is not architecture, and its charge density is not readable from an INCI name (G4). The monomeric quats fall under this lane's stated anchor-gap rule (see slot 2). `ph_dependent_cationic` fails — no amodimethicone, no amidoamine. `volatile_or_water_soluble` fails — the deposit is a lipid/lamellar residue.
- attached buildup caution: **yes**, non-quantitative, and consistent with (not contradicting) the PERS class (G3 rule 4).
- limitations: G11; SR §I; FS-20 (silicone-free plus a cationic polymer is **not** low buildup).
- review_status: `provisional` (anchor gap).

## 7. HOLD — `none`

confidence **moderately_high** · E1/E2 · scope `formula`

- Precise absence pattern: no PVP, VP/VA, acrylates fixative, polyurethane or PVP/DMAPA anywhere in 51 ingredients. No L5 rheology exclusions are needed because no fixative candidate exists.
- The directions point to **separate** companion products for styling and definition (`S3-dir`) — corroborating, never creating, this value.

## 8. HEAT — `claim_only` · **`provides_heat_protection = true`** · **REVIEW**

confidence **low** · E0 (claim) + E1 (formula absence) · scope `product` + `formula`

- claim_observation (E0): „Zudem bietet sie einen Schutz vor Hitzeschäden, die durch das Styling entstehen können." (`S3-claim`)
- formula_observation: **no member of the closed L9 list** at any position. `PANTHENOL` #16 is expressly barred (FS-24); the botanical oils and butters are expressly barred (FS-7, G10).
- threshold_reasoning: `formula_plausible` requires an L9 member — absent, so G10 stops this at `claim_only`. `not_claimed` fails because a claim exists. `product_tested` requires an exact-product DSC / breakage-after-ironing / tryptophan-loss test with §3.2 metadata — none surfaced.
- production projection (§13.3): claim present, no L9 member → `provides_heat_protection = true`, **and the record is routed to human review with a "claim looks formula-unsupported" note.** The standard does not silently drop the claim; review decides.
- Hard prohibitions honoured: no efficacy grade, no °C figure, no `heat_protection_max_c` (FS-14).
- review_status: `specialist_review_required`

## 9. HUM — `not_claimed`

confidence **moderate** · E1/E2 · scope `formula` + `product`

- No humidity or Anti-Frizz claim on `S3-claim`.
- Mandatory counter-signal: `GLYCERIN` #4, `PANTHENOL` #16, `SODIUM HYALURONATE` #24, `PROPYLENE GLYCOL` #47 — a materially present humectant architecture (SR §E.1, FS-15).
- `formula_plausible` additionally fails on its own terms: there is no hydrophobic **continuous film-forming** route. Botanical oils are an occlusive lipid load, not a water-uptake-reducing film, and no silicone or hydrophobic fixative is present.

## 10. R2 — `none_visible`

confidence **moderately_high** · E2 · scope `formula`

- Precise absence pattern: no cationised protein, no silane derivative, no silicone quat, and no protein of any kind in the list. `PANTHENOL` #16 is explicitly not an R2 route (§7.10 panthenol rule). `POLYQUATERNIUM-10` #30 is a generic cationic polymer whose charge density is unreadable, and §10.2/§10.3 explicitly bar a generic cationic polymer from setting a repair focus or a damage upgrade — recording it as an R2 `candidate` would manufacture a downstream signal the standard forbids.
- The product's own „Repair" name and „Spliss und Haarbruch" claim are E0 and cannot set this (FS-5).

## 11. DOSE — `high` (derived)

confidence **moderate** · `derived_from: [WT=high, FORM=emulsion, L3 spreading class = rich band present]`

- `high` fires on two limbs (WT `high`; rich/low-spreading band materially present at #2/#6/#7). G3: emits a dosing caution, does **not** modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- `PARFUM` #27 plus `BENZYL ALCOHOL` #36, `BENZYL SALICYLATE` #37, `CITRAL` #38, `COUMARIN` #39, `HEXYL CINNAMAL` #40, `LIMONENE` #41, `LINALOOL` #42, `TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES` #51.
- No `Alcohol`/`Alcohol Denat.` note (the alcohols present are fatty and functional, not solvent ethanol).
- G6 applies; exposure ≠ tolerance (SR §M.12).

## 13. ROLE — `["post_wash"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „auf die feuchten Haarspitzen auftragen … in Richtung Ansatz einarbeiten … Nicht ausspülen" → damp application after washing, left on.
- `refresh` is rejected: no dry-hair use is described. `heat_styling` is rejected: **no heat tool appears anywhere in the directions**, despite the heat-damage claim — the claim is E0 marketing and never populates ROLE. `curl_styling` is rejected: curl definition is attributed to two **separate companion products**, not to this one (FS-11 discipline). `ends_only` is rejected: application deliberately extends toward the Ansatz.
- The overnight-under-a-cap option is recorded as a directions fact that raises expected residue and dose variability.

## Demoted flags

- `smoothing_shine_qualifier`: `absent`
- `curl_definition_focus`: **not set** — HOLD `none`; the curl language in the directions belongs to companion products.
- `R3`: `unknown` — no named bond chemistry, no bond claim.
- LAYER caution: **emitted** — the directions instruct layering with two further styling creams and a high-charge cationic polymer is present. Caution string only; no matrix, no score (§8.4).
- Buildup caution: **emitted**. Transfer caution: **emitted**.

## care_direction — `moisture`

confidence **moderate** · E2 · scope `formula`

- Coherent L1 (LGN cationic) + L3 (canola/shea/olive) + L4 (glycerin/panthenol/hyaluronate) architecture is the material direction, with **no** protein-film route (R2 `none_visible`). `protein` is unavailable; `balanced` requires a substantive mixed architecture that does not exist here.
- Constraint honoured: does not drive weight, persistence, hold or heat.

## Lean matching profile

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "conditional",
  "uncertain_fields": ["specialist_functions.provides_heat_protection"]
}
```

**Focus derivation — the notable one.** `repair` fails despite the product being named "Repair Creme": R2 is `none_visible` and R3 is `unknown`, and §10.2 states that generic oil, panthenol or repair naming cannot set it. `smoothing` fails (SFR `moderate` by G3). `detangling` fails (SLIP is `high` but the bias is `dry_biased`, not `wet_biased`/`both`). `curl_definition` fails (HOLD `none`). `heat_styling` fails — HEAT is `claim_only`, which clears the first limb, but ROLE does **not** include `heat_styling`, and both limbs are required. `volume_lightness` fails (WT `high`). → `general`.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=high, product_form=emulsion]`: formula (LGN pair + shea/olive/canola above the tail) → product property (high residue/coating potential) → fit. Fine = `caution` carries the §17.11 judgment-call label.
- `damage_fit` ← `[conditioning_level=high, repair_surface_film=none_visible, bond_flag=none, product_evidence=none]` → row 2 ("`high` with **no** qualifying specialist route"), **not** row 3.
- `texture_fit` ← `[weight_potential=high, slip=high, hold_route_state=none]` → row 3.
- `scalp_application_fit` ← `[directions: application worked "in Richtung Ansatz" but never onto the scalp; EXPO = allergen exposure]` → `conditional`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- WT `high`: „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren."
- DOSE `high`: „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig."
- HEAT claim without L9 member: „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das."
- LAYER: „Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen."
- EXPO: „Enthält deklarierte Duftstoffe."
