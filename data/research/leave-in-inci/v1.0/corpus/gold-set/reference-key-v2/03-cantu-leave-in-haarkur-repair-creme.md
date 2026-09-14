# S3 — Cantu Leave-In Haarkur Repair Creme

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 3 · 453 g · GTIN 810006945430 · `formulaFingerprintSha256` acb2659a…a21e

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `provisional_formula_conflict` |
| Preserved conflict (G5) | A genuinely different US-market formula (Dicetyldimonium Chloride / Diheptyl Succinate / Silk Amino Acids) circulates under GTIN 810006943405. The DE pack (Version A, dm.de) is authoritative for this record; the US variant is recorded, not merged. The conflict does not make the dominant architecture unreadable, so it lowers no field's scope beyond identity (G5 "lower the smallest affected scope"). |
| Directions verbatim | „Großzügig und gleichmäßig auf die feuchten Haarspitzen auftragen und in Richtung Ansatz einarbeiten und durchkämmen. Nicht ausspülen. Damit sich die Wirkung noch mehr entfalten kann, über Nacht unter einer Haube einziehen lassen. Für das anschließende Styling und maximale Definition, je nach Bedarf die Coconut Curling Cream oder die Moisturizing Curl Activator Cream verwenden." |
| Directions authority | **C3** — dm.de, an exact-GTIN German retailer. Cantu is **not** a dm brand, so reading convention RC-1 does not apply and no C1/C2 source was located. |
| Rinse test (R11) | **PASS** — directions state „Nicht ausspülen". The rinse test runs on the captured directions at any tier; only *positive* role values require C1/C2 (§2.4 item 2 vs §7.13 rule 1). |

## G0 — product form

`in_category`. Aqua leads; the directions explicitly leave the product on the hair.

## Reading conventions applied

**Tail marker (§3.1.1):** `Phenoxyethanol`, **rank 28** of 51 — the first enumerated capped ingredient in the list (Leuconostoc/Radish Root Ferment Filtrate at rank 15 is a preservative-adjacent material but is **not** on §3.1.1's enumeration and was not used as the marker). Above the tail: ranks 1–27. This is a **late** marker, so "above the tail" is a permissive test here; the limitation is carried on every anchor that turns on it (§17.14).

Consequential consequence: **POLYQUATERNIUM-10 at rank 30 and CETRIMONIUM CHLORIDE at rank 35 are tail members**, two and seven positions below the marker.

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `lgn`, trace-only)

confidence **high** · E2 · scope formula.
**formula_observations** CETEARYL ALCOHOL (3) paired with BEHENTRIMONIUM METHOSULFATE (5) — the classic LGN pair, both well above the tail; carrying a substantial lipid phase: CANOLA OIL (2), BUTYROSPERMUM PARKII (SHEA) BUTTER (6), OLEA EUROPAEA FRUIT OIL (7).
**threshold_reasoning** Decision order: not anhydrous; not `two_phase` (a true emulsifying system is present); `emulsion` matches sub-type (a) and the order stops. **limitations** LGN/non-LGN is trace-only. review_status `approved`.
`presentation_form`: Creme.

### 2. COND — `high`

confidence **moderately_high** (ceiling) · E2.
**formula_observations** LGN pair above the tail: Cetearyl Alcohol (3) + Behentrimonium Methosulfate (5). Further independent lubrication routes: rich-band lipids — Shea Butter (6), Olive Oil (7) — and a medium-band vegetable oil, Canola Oil (2). Also Hydrogenated Ethylhexyl Olivate (25) and Hydrogenated Olive Oil Unsaponifiables (26).
**counter_signals** POLYQUATERNIUM-10 (30) and CETRIMONIUM CHLORIDE (35) are below the marker; they are *unpositioned, not absent* (§3.1.1 rule 4) and were **not** used to reach `high` — the value rests on the LGN pair plus the lipid package alone.
**shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
**threshold_reasoning** `high` needs an LGN pair above the tail plus one further independent lubrication route; both hold, from two separate observations. `moderate` would apply only without a full LGN pair.
**limitations** G4 concentration cap; the marketing „Repair" name is E0 and contributed nothing (FS-5). review_status `approved`.

### 3. SLIP — `high`, bias `unknown`

confidence moderate (ceiling) · E2.
Two independent M1 contributors present as architecture: the cationic LGN route (3 + 5) and a rich persistent lipid load (2, 6, 7). `moderate` would be one route; `low` requires no persistent lubricant and no cationic species above the tail, both false.
**bias reasoning** `unknown` — a rich lipid deposit plus an LGN pair matches neither `wet_biased` (which requires no persistent film) nor `dry_biased` (which requires a persistent *film*, not a discontinuous lipid deposit); open gap §17.16. review_status `provisional`.

### 4. SFR — `moderate`

confidence moderate · E2.
**formula_observations** One alignment route: a medium/rich emollient package (2, 6, 7, 25, 26).
**counter_signals** No persistent silicone anywhere in 51 ingredients. The one substantive cationic-polymer film candidate, POLYQUATERNIUM-10, sits at **rank 30, below the tail marker at rank 28** — it cannot be read as a continuous film route as architecture on rank alone.
**threshold_reasoning** `high` requires a continuous surface-film route above the tail plus a lubrication route (RC-4). The film limb fails on rank. `low` requires no persistent film and water phase plus humectants only, which the lipid package rules out. review_status `provisional`.

### 5. WT — `high`

confidence **moderately_high** · E2.
**rationale** Both limbs of the `high` anchor are independently satisfied.
**formula_observations** Limb 1 — LGN pair present as architecture: Cetearyl Alcohol (3) + Behentrimonium Methosulfate (5). Limb 2 — two or more persistent non-volatile families with at least one **rich/low-spreading band member**: BUTYROSPERMUM PARKII (SHEA) BUTTER (6) and OLEA EUROPAEA FRUIT OIL (7) are both enumerated L3 rich-band members, alongside a medium-band vegetable oil (Canola, rank 2) and the fatty-alcohol/quat phase.
**counter_signals** Canola oil is an **unenumerated liquid vegetable oil** and is read in the **medium** band by the §7.5 convention, not the rich band — it counts as a persistent family but does not itself satisfy the rich-band test. Shea and olive do, independently.
**threshold_reasoning** `moderate` (single-family or multi-family) is excluded by both the LGN pair and the presence of enumerated rich-band members. Confidence rises to `moderately_high` because FORM resolves definitely and the non-volatile architecture is fully readable above the tail. G9 checked: the "cream" presentation contributed nothing (FS-2); the value rests on observed ranks.
**limitations** Dose is the unmeasured term (§17.1); the fine-hair consequence is a **product judgment call** (§17.11). review_status `approved`.

**Transfer caution attached (qualitative).** A low-spreading, non-volatile, non-film-forming lipid load is present as architecture (shea butter rank 6, olive oil rank 7): transfer to skin, collar, pillow and phone is plausible. **No published instrumental transfer method for hair leave-ons surfaced** (SR §D.3, §17.3) — qualitative only, never a scored dimension.

### 6. PERS — `neutral_non_volatile`

confidence low_moderate · E2 · **field marked uncertain**.
**formula_observations** Dominant persistent species above the tail: rich and medium lipids (2, 6, 7), Cetearyl Alcohol (3), and BEHENTRIMONIUM METHOSULFATE (5) — a **monomeric long-chain quat**.
**counter_signals (recorded, decisive if reversed)** POLYQUATERNIUM-10 — a polymeric quat, enumerated in the v0.2 `permanent_cationic` anchor — is declared at **rank 30, two positions below the tail marker at rank 28**. Under lane convention RC-3 (class anchors gated on rank above the marker) it does not promote the class. Under the alternative reading — §3.1.1's "present as architecture" coherence prong, since a cationic polymer is coherent with a cationic conditioning architecture — it would promote the record to `permanent_cationic` and the projection from `moderate` to `high`, carrying the buildup caution with it. **v0.2 does not say which reading governs.** Routed to review.
**Required monomeric-quat note (§7.6, mandatory):** *"Persistence rests on a monomeric long-chain quat: permanently charged, so more substantive than a neutral deposit, but small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a duration (G11)."*
**threshold_reasoning** `permanent_cationic` requires a polymeric or silicone-functional quat present as architecture — the only candidate is below the marker. `ph_dependent_cationic` requires amodimethicone or an amidoamine, both absent. `volatile_or_water_soluble` is excluded because the monomeric quat is a materially persistent species and §7.6 forbids dropping it there.
**limitations** G11; banned removal percentages not used; tail-marker heuristic decisive here. review_status `provisional`.

Buildup caution: **not** emitted, because the projection is `moderate`. FS-13 double-check: this record does not pair a high-persistence promise with a low-buildup message — it makes neither.

### 7. HOLD — `none`
confidence moderate · E1 — no L5 fixative-class polymer is declared. Polyquaternium-10 is a conditioning polymer, not a fixative. review_status `approved`.

### 8. HEAT — `not_claimed` → binary `false`
confidence low_moderate · E0. **No C1/C2 source exists for this product** — Cantu has no German manufacturer page and dm.de is C3. Per §2.4.1 rule 1, **the claim does not exist** and the field takes its no-claim value. L9 closed-list check: no L9 member is declared. review_status `provisional`; routed with a `claim_authority_gap` note so a human can decide whether a manufacturer source was simply not found.

### 9. HUM — `not_claimed`
confidence low_moderate · E0/E2. No C1/C2 claim (as above) **and** no qualifying route: no VP/VA-class hydrophobic fixative and no persistent silicone anywhere. The humectant leg — GLYCERIN (4) above the tail, plus Panthenol (16), Sodium Hyaluronate (24), Propylene Glycol (47) — is **dominant**, which blocks `formula_plausible` outright (§7.9 step 1). Humectants are never support for a humidity claim in either direction (FS-15, FS-6). review_status `approved`.

### 10. R2 — `none_visible`
confidence moderate · E1. No cationised protein, no silane derivative, no silicone quat is declared. Trace note: no plain hydrolysate is present either — the "repair" positioning rests on vitamins (Riboflavin, Niacin, Pantothenic Acid, Pyridoxine, Folic Acid, Cyanocobalamin, Biotin, ranks 8–14) and botanical extracts, none of which is an R2 route. PANTHENOL (16) is a fibre-mechanics signal, not an R2 route and not a heat route (FS-24). Botanical oil and butter do **not** mean deep repair (FS-5); coconut-oil penetration does not generalise to other botanicals and its study was a pre-/post-wash oil treatment barred from product evidence by G8 (FS-19). review_status `approved`.

### 11. DOSE — `high` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. Two independent triggers: WT = `high`, and a rich/low-spreading lipid band member present as architecture. review_status `approved`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (27) plus declared allergens BENZYL SALICYLATE (37), CITRAL (38), COUMARIN (39), HEXYL CINNAMAL (40), LIMONENE (41), LINALOOL (42), and TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES (51). No `Alcohol`/`Alcohol Denat.` note — Benzyl Alcohol (36) is declared in a preservative role and is not the §7.12 exposure alcohol. G6 applies; flags never predict tolerance (§17.12). review_status `approved`.

### 13. ROLE — `[]` (`usage_role` unknown)
confidence moderate in the *abstention* · E1 · scope directions.
**Directions exist and are captured, but only at C3.** §7.13 rule 1 is binding: role values may be read **only** from C1/C2 directions; retailer application copy corroborates but never creates a role. The dm.de text is therefore recorded in `supporting_signals[]` with its tier and would have established `post_wash` (feuchte Haarspitzen), `ends_only` (Haarspitzen … in Richtung Ansatz) and arguably an overnight-treatment variant — **none of which may be emitted**.
`usage_role` is emitted as `[]` and listed in `uncertain_fields` (§10.1). review_status `provisional`; routed.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 consequence of the emollient alignment route |
| CURL | `none` (low) | HOLD = `none`. The directions point the user at two *other* Cantu curl creams for definition — positioning, never a route (§10.2 rule 4) |
| R3 | `unknown` | No bond claim, no recognised bond chemistry |
| LAYER | no string emitted | The only cationic polymer sits below the tail; a caution here would rest on the same unpositioned observation the PERS record already flags |
| Buildup caution | not emitted | PERS projects `moderate` |

## §9 care_direction — `moisture`

confidence moderate · E2 · shared_mechanism_ids `M1`, `M7`.
L1 (Behentrimonium Methosulfate 5), L3 (Canola 2, Shea 6, Olive 7) and L4 (Glycerin 4, Panthenol 16) are present as architecture, with no protein-film route. `protein` requires R2 ∈ {candidate, tested} — `none_visible`. `balanced` requires an R2 route plus a moisture leg, both above the tail — the R2 half is absent. `unknown` does not apply: the architecture is neither silicone-led (no silicone at all) nor unreadable. **Constraint 3 exercised explicitly:** the product is sold as a „Repair Creme" and the marketing direction is repair — *marketing direction never sets the value*, and on its architecture this is a moisture product. Constraint 2: Panthenol alone never sets `protein`.

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren.",
    "Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig.",
    "Enthält deklarierte Duftstoffe."
  ],
  "uncertain_fields": ["persistence", "usage_role"],
  "assumption_notes": [
    "PERS held at neutral_non_volatile under RC-3; PQ-10 sits two ranks below the tail marker.",
    "usage_role empty because captured directions are C3 only."
  ]
}
```

**Focus selection (§10.2).** `repair` — R2 `none_visible`, and „Repair Creme" is **generic repair naming**, which the row excludes explicitly; no protein or silane active exists in any marketing position because no C1/C2 position exists at all. `smoothing` — SFR is `moderate`, not `high`. `curl_definition` — HOLD `none`. `detangling` — no detangling-led C1/C2 positioning; slip-dominant prong needs WT `low`. `volume_lightness` — needs WT `low`. `heat_styling` — HEAT `not_claimed`. `shine` — no distinct gloss route. Step 5: **`general`**.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `high`; fine-hair value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2**. This is the archetype's headline result and it is deliberate: COND is `high`, but row 3a additionally requires a qualifying specialist route (a distinct L6 substantive film route or a §3.2-compliant exact-product test), and §10.3 states that generic silicone, **oil**, panthenol, ceramide, a non-silicone cationic polymer or repair naming does not qualify — this formula offers only those. Row 3b requires R2 ∈ {candidate, tested}. A rich cream sold for dry/damaged hair therefore lands at `highly_damaged: conditional`.
- `texture_fit` ← **row 3** (`weight_potential = high` **and** SLIP `high`).
- `scalp_application_fit` ← ordered test: **`avoid` fires twice over** — (a) a heavy-occlusive/oil-led architecture, WT `high` with rich/low-spreading band members present as architecture; (b) an EXPO-flagged irritant load, `aromatic_or_allergen_exposure`. The directions' „Haarspitzen … in Richtung Ansatz" placement would otherwise give `conditional`.

## §14 review routing

1. **Formula-source conflict** — DE pack vs US variant under a different GTIN (§14, preserved under G5).
2. **`claim_authority_gap`** — no C1/C2 source exists for a US brand sold through a German retailer; HEAT and HUM both take their no-claim values by rule, not by evidence.
3. **Directions authority** — captured directions are C3, so `usage_role` is forced empty even though a clear, verbatim, rinse-tested direction text exists. v0.2 routes *absent* directions to review (§2.4 rule 3) but has no explicit route for *insufficiently authoritative* directions; routed here by analogy.
4. **PERS tail-gating** — PQ-10 at rank 30 versus a marker at rank 28 decides `persistence` `moderate` vs `high` and the buildup caution with it (RC-3).
