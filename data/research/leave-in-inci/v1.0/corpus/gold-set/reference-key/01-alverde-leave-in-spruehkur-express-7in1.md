# Slot 1 — alverde NATURKOSMETIK Leave-In Sprühkur Express 7in1 (75 ml)

- `category_standard_version`: `leave-in-inci-v0.1`
- `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Ultra-light detangling spray
- `gtin`: 4066447919387 · `market`: DE · `identity_status`: `verified`
- `rawInciSha256`: `5714663322e54cd914b5215027c999831b987c5e09251d4dbdc47182979ac9c3`
- `formulaFingerprintSha256`: `cb08a99de094b760398f2fa7bcc5de19d6a0e2a47316e5ec94dcaa16be06f212`
- `review_routing`: **routed to human review** — FORM/WT boundary (two-phase vs solubilised hydroalcoholic), §14 two-phase trigger, §10.1 weight projection conflict.

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S1-dir` | T2 (dm.de, dm-Art. 3090444, GTIN confirmed on page) | Verwendungshinweise, verbatim: „Je nach Bedarf aus ca. 30cm Entfernung in die Haarlängen und -spitzen sprühen. Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden. HINWEIS: Bitte vor Gebrauch schütteln. Kontakt mit den Augen vermeiden." |
| `S1-claim` | T2 (dm.de, same page) | E0 claims: „Spendet Feuchtigkeit und entwirrt das Haar"; „kann Spliss entgegenwirken"; „kann das Haar gekräftigt und vor Haarbruch geschützt werden"; „sorgt für ein geschmeidiges Haargefühl, ohne zu beschweren". **No Hitzeschutz claim. No Anti-Frizz claim. No hold claim.** |

Note: the directions text never says „nicht ausspülen"; leave-on status rests on the product name/category plus the absence of any rinse step. Recorded as a minor directions gap, not a conflict.

---

## G0 — product-form gate

**`in_category`** · decision_type `metadata` · confidence **moderately_high** · E1 (directions) + E2 (architecture) · scope `directions`

- Formula observations: `AQUA` #1; no rinse step anywhere in `S1-dir`; oils at #2/#11/#18.
- Product inference: an aqueous-led spray that stays on the fibre with conditioning/detangling as the declared primary function.
- Counter-signals: directions do not literally say „nicht ausspülen".
- threshold_reasoning: `excluded_anhydrous` fails because Aqua leads. `excluded_styling_first` fails because no fixative-class (L5) polymer is present at any position. `excluded_other_form` fails because no rinse instruction exists and the pack is declared a Leave-In. `provisional_boundary` is not needed: the ambiguity in this record is FORM (below), not category membership.

## 1. FORM — `two_phase`

confidence **moderate** · E2 · scope `formula` + `directions` · decision_type `direct_product_property`

- formula_observations: `AQUA` #1; `HELIANTHUS ANNUUS HYBRID OIL` #2; `ALCOHOL DENAT.` #3; `DICAPRYLYL ETHER` #5; `ISOAMYL LAURATE` #8; `RICINUS COMMUNIS SEED OIL` #11; `HELIANTHUS ANNUUS SEED OIL` #18. **Precise absence pattern: no emulsifier and no solubiliser anywhere in the 32-item list** — no PEG-ester, no polysorbate, no glucoside, no fatty-alcohol/quat pair, no cationic surfactant.
- directions observation: „Bitte vor Gebrauch schütteln" (`S1-dir`).
- product_inferences: a water phase and a lipid phase held apart, re-dispersed by shaking at each use; delivered oil:water ratio per actuation is set by shake quality.
- counter_signals: `ALCOHOL DENAT.` at #3 could co-solubilise part of the lipid load, which would make this a hydroalcoholic solution with a dispersed oil fraction rather than a clean two-phase system; the pack's visual appearance was not observed.
- threshold_reasoning: `two_phase` requires an oil phase with **no emulsifier at all** plus a shake direction — both are literally met. `aqueous_or_hydroalcoholic_solution` is the nearest alternative and fails on the "no emulsifier, or only solubiliser-type" limb only in the sense that it *also* has none; it is separated here by the shake direction plus a lipid at rank #2, which a solubilised system would not need. `microemulsion` fails: no PEG-esters/solubilisers at all. `emulsion` fails: no LGN pair.
- shared_mechanism_ids: `M6_VOLATILE_CARRIER` (alcohol), `M1_DEPOSITION_SURFACE_LUBRICATION`
- limitations: the two-phase-vs-solubilised call is the single largest uncertainty in this record and drives WT and DOSE. FS-18 applies in the affirming direction (no emulsifier ⇏ no lipid load); G9 forbids this label from setting WT by itself.
- review_status: `provisional`
- `presentation_form` (metadata): Sprühkur / spray.

## 2. COND — `moderate`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `HELIANTHUS ANNUUS HYBRID OIL` #2 (high-oleic, medium spreading band), `DICAPRYLYL ETHER` #5 and `ISOAMYL LAURATE` #8 (dry-feel/high-spreading band), `RICINUS COMMUNIS SEED OIL` #11 (rich/low-spreading band). Absence pattern: **no quat, no cationic polymer, no silicone anywhere**.
- product_inferences: one coherent lubrication route — a persistent emollient package spanning three spreading bands.
- supporting_signals: `GLYCERIN` #4, `PENTYLENE GLYCOL` #6, `INULIN` #7 (L4 softness component of COND only).
- counter_signals: no L1 route at all, which is the usual backbone of leave-on conditioning; the three hydrolyzed proteins (#13–#15) are not cationised and add nothing here.
- threshold_reasoning: `high` fails on its necessary condition — no LGN pair exists. `low` fails because persistent non-volatiles (sunflower oil, dicaprylyl ether, isoamyl laurate) sit far above the tail. `moderate` is the exact anchor: "a persistent silicone/emollient package — without a full LGN pair".
- shared_mechanism_ids: `M1_DEPOSITION_SURFACE_LUBRICATION`, `M7_HUMECTANT_PLASTICISER`
- limitations: G4 — concentration invisible; R1 grooming-breakage framing is folded in here and must not be scored separately.
- review_status: `draft`

## 3. SLIP — `moderate`, bias `unknown`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- formula_observations: as COND. One M1 route present as architecture.
- counter_signals: no cationic species anywhere; a shake-dependent delivery makes the deposit itself variable.
- threshold_reasoning: `high` requires two or more independent M1 contributors; only the emollient route exists. `low` fails because persistent lubricants are present above the tail. Bias: `wet_biased` requires "no persistent film" — persistent lipids are present; `dry_biased` requires "few water-phase slip agents" — glycerin/inulin/sugars are materially present; `both` requires both routes materially present as architecture, which the absence of a persistent *film* (as opposed to a lipid deposit) does not support. `unknown` is the standard's stated default for an ambiguous architecture.
- shared_mechanism_ids: `M1_DEPOSITION_SURFACE_LUBRICATION`
- limitations: SR §M.5 — whether wet and dry slip separate from formula in leave-on is unresolved; FS-22.
- review_status: `draft`

## 4. SFR — `moderate` · SHN qualifier `absent`

confidence **moderate** · E2 · scope `formula`

- formula_observations: medium/dry-feel emollient package (#2, #5, #8); absence pattern: no persistent silicone, no substantive cationic-polymer film.
- threshold_reasoning: `high` requires a continuous surface-film route — none exists. `low` fails because the alignment route is more than water plus humectants. `moderate` = "one alignment route: a medium/dry-feel emollient package".
- SHN: `absent` — no distinct gloss route beyond M1/M2, and no goniophotometry. The E0 claim „verleiht dem Haar einen schönen Glanz" is recorded and does not set the qualifier (§8.1, FS-23).
- shared_mechanism_ids: `M1_DEPOSITION_SURFACE_LUBRICATION`, `M3_OPTICAL_ALIGNMENT_FILM`
- review_status: `draft`

## 5. WT — trace `high` · **projected `moderate`** (§10.1)

confidence **moderate** · E2 · scope `formula` + `directions`

- formula_observations: `HELIANTHUS ANNUUS HYBRID OIL` #2 — a non-volatile lipid at rank two; `RICINUS COMMUNIS SEED OIL` #11, a rich/low-spreading band member; no emulsifier.
- product_inferences: a two-phase spray delivers a lipid phase directly, without a rinse and without emulsifier-mediated dilution.
- counter_signals: E0 lightness claim „ohne zu beschweren" (`S1-claim`); most of the lipid load sits in the dry-feel/medium bands; the FORM call that carries the `high` verdict is itself only moderate-confidence.
- threshold_reasoning: trace `high` is reached on the anchor's third limb — "a two-phase … carrying a substantial oil/silicone phase" — evidenced by the lipid at rank #2, not by the form word (G9). `moderate` would require exactly one persistent non-volatile family with no two-phase architecture; the family count is arguably one (lipid emollients), which is why the projection rule below bites rather than a clean `high`.
- **Projection (§10.1):** the formula-only `high` is conflict-tagged (FORM provisional), the exact product's intended finish materially contradicts it, and no finished-product evidence resolves the conflict → `weight_potential = moderate`, field marked uncertain, trace `high` preserved.
- attached transfer caution: **yes** — castor oil is a low-spreading, non-volatile, non-film-forming lipid. Qualitative only; no instrumental method exists (SR §D.3).
- limitations: §17.11 — no evidence establishes a residue load at which fine hair reads as limp; every fine-hair value downstream is a product judgment call.
- review_status: `provisional`

## 6. PERS — `neutral_non_volatile`

confidence **low** · E2 · scope `formula`

- formula_observations: non-volatile vegetable oils and esters (#2, #5, #8, #11, #18); `ALCOHOL DENAT.` #3 (volatile, contributes nothing); no cationic species, no silicone.
- threshold_reasoning: `permanent_cationic` and `ph_dependent_cationic` fail — no quat, no cationic polymer, no cationised protein, no amodimethicone/amidoamine. `volatile_or_water_soluble` fails because the lipid deposit is neither. `neutral_non_volatile` is the exact anchor ("esters, oils").
- attached buildup caution: **yes**, non-quantitative. A lipid deposit requires surfactant emulsification to remove.
- limitations: G11 — no duration, wash count, applications-to-buildup or clarification schedule. SR §I: no finished-product accumulation study exists.
- review_status: `draft`

## 7. HOLD — `none`

confidence **moderately_high** · E1/E2 · scope `formula`

- Precise absence pattern: no PVP, no VP/VA, no acrylates copolymer, no polyurethane, no PVP/DMAPA — no L5 member at any position. `INULIN` is a prebiotic polysaccharide, not a fixative.
- threshold_reasoning: `incidental_film` requires a fixative-class polymer to be present at all; none is. `meaningful_hold_route` therefore cannot arise, and no G0 styling review is triggered on this axis.
- review_status: `approved`

## 8. HEAT — `not_claimed` · `provides_heat_protection = false`

confidence **moderately_high** · E0/E1 · scope `product` + `formula`

- Claim observation: **no heat-protection claim** anywhere on `S1-claim`.
- Formula observation: no member of the closed L9 list.
- threshold_reasoning: `claim_only` requires a claim — absent. `formula_plausible` requires an L9 member — absent (G10; FS-7 bars the generic proteins from qualifying). Production binary is `false` because a formula never manufactures a claim (§13.3).
- review_status: `approved`

## 9. HUM — `not_claimed`

confidence **moderate** · E1/E2 · scope `formula` + `product`

- Claim observation: no humidity or Anti-Frizz claim.
- Counter-signal (mandatory): `GLYCERIN` #4, `PENTYLENE GLYCOL` #6, `INULIN` #7, plus `GLUCOSE`/`FRUCTOSE`/`SUCROSE` — a materially present humectant architecture, which lowers this state and can never raise it (SR §E.1, FS-15).
- threshold_reasoning: `formula_plausible` fails twice over — no hydrophobic continuous film route, and a humectant architecture is present. Never encode a dew-point threshold (FS-16).
- review_status: `approved`

## 10. R2 — `none_visible`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `HYDROLYZED CORN PROTEIN` #13, `HYDROLYZED WHEAT PROTEIN` #14, `HYDROLYZED SOY PROTEIN` #15 — plain hydrolysates, not cationised, not silane-modified, sitting in the sub-1 % region of a 32-item list.
- threshold_reasoning: `candidate` requires a **substantive** route (cationised protein, silane derivative, silicone quat, high-charge cationic polymer); a plain hydrolyzed protein in the tail is the explicit `none_visible` anchor. The E0 claims „pflanzliches Keratin" and „vor Haarbruch geschützt" do not create a route (FS-5).
- review_status: `approved`

## 11. DOSE — `high` (derived)

confidence **moderate** · derived · `derived_from: [WT(trace high), FORM(two_phase), L3 spreading class(rich-band castor present)]`

- threshold_reasoning: all three disjunctive limbs of the `high` rule fire independently. `moderate` would need WT `moderate` **and** a non-two-phase form.
- G3: DOSE does **not** additionally modify `hair_thickness_fit`; it emits a German dosing caution instead.
- limitations: SR §M.1/§M.9 — no market-representative consumer dose figures exist, and shake quality makes two-phase the least dose-predictable form.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- formula_observations: `PARFUM` #23 plus `GERANIOL`, `LIMONENE`, `TERPINEOL`, `GERANYL ACETATE`, `CITRUS AURANTIUM BERGAMIA PEEL OIL`, `LINALYL ACETATE`, `VANILLIN`, `CITRUS LIMON PEEL OIL`, `JUNIPERUS VIRGINIANA OIL` (#24–#32).
- notes: `ALCOHOL DENAT.` at #3 is materially present → alcohol exposure note emitted.
- Hard limit: this is an exposure statement only; tolerance is not derivable from an INCI list (SR §M.12). G6 applies.
- review_status: `approved`

## 13. ROLE — `["post_wash", "refresh"]`

confidence **moderate** · **E1 (directions)** · scope `directions`

- directions observations: „in die Haarlängen und -spitzen sprühen"; „sowohl in das trockene als auch in das feuchte Haar".
- threshold_reasoning: damp-hair use is read as `post_wash`; dry-hair use is read as `refresh`. `ends_only` is rejected because the directions name Längen **and** Spitzen. `heat_styling` and `curl_styling` are rejected: neither heat tools nor curl technique appear anywhere in the directions (ROLE is never guessed from formula).
- counter_signals: „post_wash" is inferred from „feuchtes Haar" rather than stated; hence confidence is held at moderate, below the dimension's ceiling.
- G2: ROLE is an input to fit derivation, never a substitute for one.

## Demoted flags

- `smoothing_shine_qualifier`: `absent`
- `curl_definition_focus` (derived from HOLD+COND+WT): **not set** — HOLD `none` removes the anchor; no curl positioning exists. Confidence low by construction (SR §M.6).
- `R3`: `unknown` — no bond chemistry, no bond claim.
- LAYER caution: **not emitted** — no high-charge cationic species to complex with anionic styling polymers.
- Buildup caution: **emitted**, non-quantitative.
- Transfer caution: **emitted** (castor oil).

## care_direction — `moisture`

confidence **moderate** · E2 · scope `formula`

- The material direction is an emollient (L3) plus humectant (L4) architecture; there is no substantive protein/peptide/silane film route (R2 = `none_visible`), so `protein` is unavailable, and `balanced` requires a substantive mixed architecture that is not present.
- Constraint honoured: `care_direction` does not drive weight, persistence, hold or heat here.

## Lean matching profile (`leave-in-matching-v0.1`)

```jsonc
{
  "product_form": "two_phase",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",          // projected; trace = high (§10.1)
  "persistence": "moderate",               // neutral_non_volatile → moderate
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["post_wash", "refresh"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "uncertain_fields": ["product_form", "weight_potential", "texture_fit"]
}
```

**Focus derivation.** `volume_lightness` fails (WT is not `low`). `detangling` fails (SLIP is `moderate`, not `high`). `smoothing` fails (SFR `moderate`). `curl_definition` fails (HOLD `none`). `heat_styling` fails (HEAT `not_claimed`). `repair` fails (R2 `none_visible`; the E0 Spliss/Haarbruch claims cannot set it). `shine` fails (§8.1). → `general`.

**Fit chains.**
- `hair_thickness_fit` ← `derived_from: [weight_potential=moderate, product_form=two_phase]` → formula observation (lipid at #2, no emulsifier) → product property (moderate projected residue) → fit. Fine-hair value carries the §7.5/§17.11 judgment-call limitation.
- `damage_fit` ← `derived_from: [conditioning_level=moderate, repair_surface_film=none_visible, bond_flag=none, product_evidence=none]` → row 2 of §10.3.
- `texture_fit` ← `derived_from: [weight_potential=moderate, slip=moderate, hold_route_state=none]` → row 2. Marked uncertain because the trace WT is `high`, which would move the row.
- `scalp_application_fit` ← `derived_from: [directions placement = "Haarlängen und -spitzen", EXPO alcohol note]`. Never from an ingredient read. G6 applies.

## German copy emitted (§18 patterns)

- DOSE `high`: „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig."
- FORM `two_phase`: „Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark."
- EXPO alcohol: „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben."
- EXPO `fragrance_declared`: „Enthält deklarierte Duftstoffe."
- Uncertain field: „Dazu haben wir keine belastbare Information."
