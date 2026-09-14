# Slot 4 — alverde NATURKOSMETIK Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan (75 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Two-phase spray
- `gtin`: 4066447105032 · `market`: DE · `identity_status`: **`provisional_identity_conflict`**
- `rawInciSha256`: `fb69f16595227a4ac0224e65b0425f30db71ea4454d97546a96dcd23f95aa33e`
- `formulaFingerprintSha256`: `146560146b739a07dd6bb7a265b5e5f0e3541b4fad193be5050320cc62ba7840`
- `review_routing`: **routed to human review** — (a) **two-phase product** (§14, least dose-predictable form); (b) identity: the SKU is now **delisted at dm.de**, INCI rests on three T3 aggregators; (c) `texture_fit` table gap (high weight without high slip has no row).

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S4-dir` | T2 archived (Wayback capture of the dm.de page for GTIN 4066447105032, dm-Art. 1545345) | „Je nach Bedarf aus ca. 30 cm Entfernung in die Haarlängen und -spitzen sprühen. Kontakt mit den Augen vermeiden. Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden. HINWEIS: Bitte vor Gebrauch schütteln!" |
| `S4-claim` | T2 archived (same page) | „Für sofortige Haarpflege"; „Verbessert die Kämmbarkeit"; „Entwirrt und bändigt das Haar spürbar"; „umhüllt die Haaroberfläche mit einem samtweichen Gefühl". **No heat-protection claim. No anti-frizz/humidity claim. No hold claim. No lightness claim.** |
| `S4-id` | T2 live | dm.de on-site search no longer surfaces this SKU — **delisting confirmed**, consistent with the packet's `remaining_gap`. |

**Minor source difference preserved, not resolved (G5):** the packet records the shake direction as „Vor Gebrauch gut schütteln."; the archived retailer page reads „Bitte vor Gebrauch schütteln!". Same instruction, different wording — recorded as a source variance, not merged.

---

## G0 — `in_category`

confidence **moderately_high** · E1 + E2 · scope `directions`

- `AQUA` #1; no rinse step in `S4-dir`; the declared function is conditioning/detangling („Verbessert die Kämmbarkeit", „Entwirrt und bändigt").
- threshold_reasoning: §2.3 states explicitly that **a two-phase spray is in-category when conditioning is primary, even though it has no emulsifier at all**. `excluded_anhydrous` fails (Aqua leads). `excluded_styling_first` fails (no L5 member at any position). `excluded_other_form` fails (no rinse).
- counter_signals: the directions never say „nicht ausspülen"; leave-on status rests on the Sprühkur category plus the absence of a rinse step.

## 1. FORM — `two_phase`

confidence **moderately_high** · E1 (directions) + E2 (formula) · scope `formula` + `directions`

- formula_observations: `AQUA` #1; `GLYCINE SOJA OIL` #2; `ALCOHOL` #3; `ARGANIA SPINOSA KERNEL OIL` #7. Absence pattern: **no LGN pair, no PEG-ester battery, no cationic surfactant**; the only surfactant-class entry is `CAPRYLYL/CAPRYL GLUCOSIDE` #10.
- directions_observation: „Bitte vor Gebrauch schütteln!" — the anchor's own directions marker.
- counter_signals: the `two_phase` anchor says "**no emulsifier at all**"; a nonionic alkyl glucoside is present at #10. Its position — behind both oils and behind three glycol/humectant entries — is consistent with a fragrance/extract solubiliser rather than an emulsion-forming surfactant, but this is an inference, not an observation.
- threshold_reasoning: the shake direction plus a lipid at rank #2 with no emulsion system is the `two_phase` anchor. `aqueous_or_hydroalcoholic_solution` fails: a stable solubilised system would not need shaking, and ethanol at #3 cannot solubilise a lipid load that leads at #2. `microemulsion` fails: no PEG-ester battery. `emulsion` fails: no LGN pair.
- G9: never sets WT. `presentation_form` (metadata): 2-Phasen-Sprühkur.
- limitations: SR §M.9 — shake quality changes the delivered oil:water ratio per actuation, and that variability is unmeasured.
- review_status: `provisional`

## 2. COND — `moderate`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `GLYCINE SOJA OIL` #2 and `ARGANIA SPINOSA KERNEL OIL` #7 — a medium-spreading-band emollient package. Absence: no quat, no cationic polymer, no silicone, no fatty alcohol.
- supporting_signals: `GLYCERIN` #4, `SODIUM LACTATE` #5, `BETAINE` #6 (L4 softness component of COND only).
- threshold_reasoning: `high` fails on its necessary LGN limb. `low` fails — persistent lipids sit at #2 and #7. `moderate` = "a persistent … emollient package — without a full LGN pair".
- limitations: G4; the delivered dose per actuation is variable, so the *architecture* is moderate while the *delivered* conditioning is the least predictable in the gold set.

## 3. SLIP — `moderate`, bias `unknown`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- One M1 route present as architecture (the lipid package). `high` requires two or more independent M1 contributors — no cationic and no persistent film route exists.
- Bias: `wet_biased` requires "no persistent film" — a non-volatile lipid deposit is present; `dry_biased` requires "few water-phase slip agents" — glycerin/sodium lactate/betaine are materially present; `both` requires both routes present as architecture. Ambiguous → `unknown`, the standard's stated default.
- limitations: FS-22; SR §M.5.

## 4. SFR — `moderate` · SHN qualifier `absent`

confidence **moderate** · E2 · scope `formula`

- One alignment route: a medium-band emollient package (#2, #7). Absence: no persistent silicone, no substantive cationic-polymer film → `high` unreachable. `low` fails because the route is more than water plus humectants.
- SHN `absent`: no distinct gloss route; no goniophotometry (§8.1, FS-23).

## 5. WT — `high`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `GLYCINE SOJA OIL` at rank #2 — a non-volatile lipid second only to water; `ARGANIA SPINOSA KERNEL OIL` #7; no emulsifier to mediate delivery.
- threshold_reasoning: the `high` anchor's third limb — "a two-phase … carrying a substantial oil/silicone phase" — is met, and the substantiating observation is the **lipid rank**, not the form word (G9). `moderate` would require exactly one persistent non-volatile family *and* the absence of a two-phase oil phase; the second condition fails. FS-18 applies in the affirming direction: no emulsifier ⇏ no meaningful lipid load — a two-phase spray carries an oil phase by design.
- counter_signals: both oils sit in the **medium** spreading band, not the rich band, so the greasiness/occlusion character is milder than the value alone implies; the delivered ratio varies with shake.
- **§10.1 projection check:** not triggered — the exact product makes **no lightness claim** (`S4-claim` contains none), so there is no contradicting intended finish. `weight_potential` projects as `high`.
- Ceiling held at **moderate** (not moderately_high) because the delivered non-volatile fraction is shake-dependent, so "the non-volatile architecture is fully readable" is only half true.
- attached transfer caution: **not emitted** — the trigger requires a *low-spreading* lipid load; soy and argan are medium-band. Recorded as a limitation instead.
- limitations: §17.1 and §17.9 — no consumer dose figures, and two-phase dose variability is unmeasured; §17.11 fine-hair judgment call.

## 6. PERS — `neutral_non_volatile`

confidence **low** · E2 · scope `formula`

- Non-volatile vegetable oils (#2, #7) and `TOCOPHERYL ACETATE` #11; `ALCOHOL` #3 is volatile and contributes nothing.
- `permanent_cationic` and `ph_dependent_cationic` both fail — **no cationic species of any kind** in the formula. `volatile_or_water_soluble` fails — the lipid deposit is neither.
- attached buildup caution: **yes**, non-quantitative. G11: no wash counts, no durations, none of the banned percentages.

## 7. HOLD — `none`

confidence **moderately_high** · E1/E2 · scope `formula`

- Absence pattern: no PVP, VP/VA, acrylates fixative, polyurethane or PVP/DMAPA in the 16-item list. No rheology polymers either.

## 8. HEAT — `not_claimed` · `provides_heat_protection = false`

confidence **moderately_high** · E0/E1 · scope `product` + `formula`

- No heat claim on `S4-claim`; no member of the closed L9 list. `formula_plausible` unreachable (G10); a formula never manufactures a claim (§13.3).

## 9. HUM — `not_claimed`

confidence **moderate** · E1/E2 · scope `formula` + `product`

- No humidity/anti-frizz claim. Mandatory counter-signal: `GLYCERIN` #4, `SODIUM LACTATE` #5, `BETAINE` #6 — a materially present humectant architecture that lowers this state and can never raise it (SR §E.1, FS-15). No hydrophobic continuous film route exists. Never encode a dew-point threshold (FS-16).

## 10. R2 — `none_visible`

confidence **moderately_high** · E2 · scope `formula`

- Precise absence pattern: **no protein, peptide, silane, silicone quat or cationic polymer anywhere in the list.** The botanical extracts (#8, #9) are not a substantive film route (FS-5). Rele & Mohile's coconut-oil result is irrelevant here — no coconut oil is present, and it would in any case be E2 mechanism only, from a pre-/post-wash oil protocol (FS-19, G8).

## 11. DOSE — `high` (derived)

confidence **moderate** · `derived_from: [WT=high, FORM=two_phase, L3 spreading class = medium band]`

- Two of three limbs fire independently (WT `high`; FORM `two_phase`). This is the archetypal high-DOSE record: without a rinse and without an emulsifier, finish moves directly with both the amount applied and the shake quality.
- G3: emits a dosing caution; does **not** modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- `PARFUM` #13 plus `LINALOOL` #14, `LIMONENE` #15, `COUMARIN` #16. `ALCOHOL` at #3 is materially present → alcohol exposure note emitted.
- G6 applies; exposure ≠ tolerance (SR §M.12). "Zertifizierte Naturkosmetik" is not a tolerance statement.

## 13. ROLE — `["post_wash", "refresh"]`

confidence **moderate** · **E1 (directions)** · scope `directions`

- „sowohl in das trockene als auch in das feuchte Haar" → damp use read as `post_wash`, dry use read as `refresh`. „in die Haarlängen und -spitzen" restricts placement.
- `ends_only` rejected — Längen **and** Spitzen. `heat_styling` and `curl_styling` rejected — neither appears in the directions; ROLE is never guessed from formula.
- Confidence held at moderate (below the ceiling) because `post_wash` is inferred from „feuchtes Haar" rather than stated, and the directions source is an **archived** retailer page for a now-delisted SKU.

## Demoted flags

- `smoothing_shine_qualifier`: `absent`.
- `curl_definition_focus`: **not set** — HOLD `none`, no curl positioning.
- `R3`: `unknown`. LAYER caution: **not emitted** (no cationic species to complex).
- Buildup caution: **emitted**. Transfer caution: **not emitted** (medium-band lipids).

## care_direction — `moisture`

confidence **moderate** · E2 · scope `formula`

- L3 emollient (#2, #7) plus L4 humectant (#4, #5, #6) is the material direction; no protein/peptide/silane route exists at all, so `protein` is unavailable and `balanced` has nothing to balance.
- Constraint honoured: does not drive weight, persistence, hold or heat.

## Lean matching profile

```jsonc
{
  "product_form": "two_phase",
  "conditioning_level": "moderate",
  "weight_potential": "high",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["post_wash", "refresh"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "conditional", "curly": "conditional", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "uncertain_fields": ["texture_fit", "product_form"]
}
```

**Focus derivation.** `volume_lightness` fails (WT `high`). `detangling` fails — this is the notable one: the product's declared purpose is detangling („Verbessert die Kämmbarkeit", „Entwirrt und bändigt"), but the anchor requires SLIP `high` **with a `wet_biased` or `both` bias**, and a single-route lipid architecture reaches only `moderate` with an `unknown` bias. Positioning corroborates but never creates a route (§10.2 rule 4). `smoothing`, `curl_definition`, `heat_styling`, `repair`, `shine` all fail. → `general`.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=high, product_form=two_phase]`: formula (lipid at rank #2, no emulsifier) → product property (a directly delivered, shake-variable oil phase) → fit. Fine = `caution`, carrying the §17.11 judgment-call label.
- `damage_fit` ← `[conditioning_level=moderate, repair_surface_film=none_visible, bond_flag=none, product_evidence=none]` → row 2.
- `texture_fit` ← `[weight_potential=high, slip=moderate, hold_route_state=none]` → **no row of §10.3 matches**: row 3 requires high weight **and** high slip; rows 1 and 2 require lower weight. This lane assigns `conditional` across all four textures and marks the field uncertain rather than borrowing a row. **Table gap surfaced for adjudication.**
- `scalp_application_fit` ← `[directions placement = "Haarlängen und -spitzen"; EXPO = alcohol + allergen exposure]` → `avoid`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- WT `high`: „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren."
- DOSE `high`: „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig."
- FORM `two_phase`: „Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark."
- EXPO alcohol: „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben."
- EXPO: „Enthält deklarierte Duftstoffe."
- Uncertain field: „Dazu haben wir keine belastbare Information."
