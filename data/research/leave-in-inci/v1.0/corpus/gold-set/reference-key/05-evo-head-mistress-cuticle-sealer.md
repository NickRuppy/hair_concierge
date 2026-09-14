# Slot 5 — EVO Head Mistress Cuticle Sealer (150 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Silicone-rich smoother
- `gtin`: 9349769013144 · `market`: DE · `identity_status`: `verified`
- `rawInciSha256`: `7f9d56ec8c3a5ca383746faf8284cc524e79f7b1eda4b610b2797b51cf0153bb`
- `formulaFingerprintSha256`: `d7cccb0d955a0544407fec4d5a864b9b3a3a6ee504ea13bb8721e146c0a2c4ea`
- `review_routing`: **routed to human review** — (a) **heat-protection claim with no L9 member** (§13.3, §14); (b) FORM anchor gap (a non-LGN polymeric-emulsifier silicone emulsion has no cell in §7.1); (c) COND ceiling forced by the LGN-necessity clause (rule-ambiguity, see below).

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S5-dir` | T1 (evohair.com) | „Apply to towel-dried hair and blow-dry for improved manageability and softness. Apply after styling to control frizz and fly-aways." |
| `S5-dir2` | T2 (haarspullen.nl, EU retailer, exact EAN) | „Apply to towel-dried hair before blow-drying to improve smoothness and manageability." · „Use as a cutting lotion for extra slip while cutting." · „Apply to dry locks after styling to tame frizz and flyaways." |
| `S5-claim` | T1 (evohair.com) | Benefit list, verbatim: **„heat protection"**, „uv protection", „reduces frizz", „improves condition", „improves styling"; tagline „a multi-purpose hair styling cream that seals the cuticle to reduce frizz, improve blow-drying, styling and manageability". |
| `S5-ing` | T3 (trade/INCI reference) | `QUATERNIUM-80` identified as a **silicone quat (silquat)**: a quaternised ammonium head with a polysiloxane tail, di-quaternary. Recorded as an ingredient-family identification only, not as performance evidence. |

Dosing guidance ("pea-sized", "avoiding the roots") circulated in secondary summaries could **not** be confirmed verbatim on T1 or T2 and is therefore **not** used.

---

## G0 — `in_category`

confidence **moderately_high** · E1 + E2 · scope `directions`

- `AQUA` #1 leads; no rinse step exists in `S5-dir`/`S5-dir2`; the declared function is cuticle-sealing/smoothing/manageability, i.e. conditioning co-primary with styling support.
- threshold_reasoning: `excluded_anhydrous` fails — Aqua leads. `excluded_styling_first` fails on its **necessary first limb**: there is no fixative-class (L5) polymer at any position. `POLYACRYLAMIDE` #4 is the L5 rheology exclusion (part of the Polyacrylamide / C13-14 Isoparaffin / Laureth-7 inverse-emulsion thickener system), not a fixative. The tagline word "styling cream" does not exclude — §2.3 forbids classifying by name and requires the HOLD anchor to be run instead.
- counter_signals: `S5-dir2` lists a professional in-salon use ("cutting lotion"); this is recorded but does **not** move the record, because it is an additional use, not the primary regime.

## 1. FORM — `emulsion` **(anchor gap — field uncertain)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: `AQUA` #1; `DIMETHICONE` #2; `CYCLOPENTASILOXANE` #3; the emulsifier/thickener triad `POLYACRYLAMIDE` #4 + `C13-14 ISOPARAFFIN` #9 + `LAURETH-7` #10. **Precise absence pattern: no fatty alcohol of any chain length, therefore no LGN pair; no PEG-ester battery; no shake direction.**
- product_inference: a silicone-in-water emulsion stabilised by a polymeric emulsifier system.
- threshold_reasoning: `emulsion` is chosen as the honest architecture label, but the §7.1 `emulsion` anchor is **LGN-specific** and is not literally met. `aqueous_or_hydroalcoholic_solution` fails — the emulsifier is doing real emulsification of a large silicone phase, not solubilisation. `microemulsion` fails — only one PEG-type surfactant, glycols not high in the list. `two_phase` fails — an emulsifier system is present. `unknown` was considered and rejected: the emulsifier pattern *is* resolvable; what the standard lacks is a cell for it.
- **Consequence carried forward:** because no LGN pair exists, the COND and WT anchors that key on an LGN pair cannot fire. This is load-bearing (see COND and WT).
- G9: never sets WT. `presentation_form` (metadata): Cream.
- review_status: `provisional`

## 2. COND — `moderate` **(ceiling forced by the LGN-necessity clause)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: `DIMETHICONE` #2 and `DIMETHICONOL` #5 (persistent silicone film route, L2); `QUATERNIUM-80` #14 (silicone quat, L1/L6, tail); `MACADAMIA TERNIFOLIA SEED OIL` #13 (medium-band emollient, L3); `PANTHENOL` #8 (L6 fibre-mechanics signal only).
- Volatile fraction explicitly excluded from this reading: `CYCLOPENTASILOXANE` #3 and `C13-14 ISOPARAFFIN` #9 evaporate and contribute nothing (FS-4).
- threshold_reasoning: **the `high` anchor requires "an LGN pair present above the tail plus at least one further independent lubrication route". No LGN pair exists, so `high` is unreachable by the literal anchor**, even though two-to-three independent lubrication routes are present at or near architecture level — which is normally the G3 rule 3 condition for a top value. `moderate` is therefore assigned: "a persistent silicone/emollient package — without a full LGN pair". `low` fails decisively (`DIMETHICONE` at rank #2).
- **Rule-ambiguity flag:** as written, no silicone-led leave-in can ever reach COND `high`, because silicone systems do not use LGN pairs. This lane applies the clause literally and consistently (slots 5, 8, 9, 13) and routes the question for adjudication. Downstream this also blocks the §10.3 `damage_fit` row-3 upgrade, which requires `conditioning_level = high`.
- shared_mechanism_ids: `M1_DEPOSITION_SURFACE_LUBRICATION`
- review_status: `provisional`

## 3. SLIP — `high`, bias `dry_biased`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- Two or more independent M1 contributors as architecture: a persistent silicone film (#2, #5) **and** a distinct emollient/silicone-quat route (#13, #14).
- Bias: `wet_biased` fails (a persistent film is present). `both` fails — the volatile fraction is a spreading carrier (M6), not a water-phase slip route, and M6 "contributes nothing to WT or PERS". `dry_biased` fits: a persistent film with few water-phase slip agents (only `BUTYLENE GLYCOL` #18).
- limitations: FS-22; the WET+DRY merge is provisional (SR §M.5).

## 4. SFR — `high` · SHN qualifier `present`

confidence **moderate** (ceiling) · E2 · scope `formula`

- formula_observations: a continuous persistent-silicone film route (`DIMETHICONE` #2, `DIMETHICONOL` #5, `QUATERNIUM-80` #14) **plus** a separate lubrication route (`MACADAMIA TERNIFOLIA SEED OIL` #13, with `C13-14 ISOPARAFFIN` aiding spread).
- threshold_reasoning: the `high` anchor's two limbs are met by **two different ingredient families**, which is the endpoint-relevant *additional* observation G3 demands rather than a restatement of the COND deposit. `moderate` would apply if only one alignment route existed.
- SHN `present`: emitted **as a qualifier on SFR only**, never as an independent value — the shine here is the M3 optical consequence of the same alignment film (§8.1, G3 rule 5). No goniophotometry exists; FS-23 bars cross-lab gloss comparison.
- limitations: §7.4 — the word "frizz" is deliberately absent from this dimension; the E0 „reduces frizz" claim belongs entirely to HUM.

## 5. WT — `moderate` **(anchor gap — field uncertain)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: persistent non-volatile families — (i) persistent silicone (`DIMETHICONE` #2, `DIMETHICONOL` #5), (ii) non-volatile emollient (`MACADAMIA TERNIFOLIA SEED OIL` #13), (iii) silicone quat (`QUATERNIUM-80` #14, tail). **Precise absence pattern: no LGN pair; no rich/low-spreading band member** — macadamia sits in the medium band, and none of coconut/olive/castor/avocado/shea/mango/cocoa/petrolatum/heavy mineral oil is present.
- counter_signals: `CYCLOPENTASILOXANE` #3 and `C13-14 ISOPARAFFIN` #9 are volatile and contribute zero residue (FS-4); dimethicone viscosity grade is invisible — 5 cSt and 1,000,000 cSt read identically (SR §C.2, G4).
- threshold_reasoning: **`high` requires either an LGN pair, or two-plus persistent non-volatile families *with at least one rich/low-spreading band member*, or a two-phase/microemulsion oil phase. None of the three limbs is met** — the family count clears, the rich-band qualifier does not. `moderate`'s "exactly one persistent non-volatile family" is also not literally met (there are two to three light/medium families). Between two cells that both misfit, this lane takes `moderate`, on the standard's own tie-break in §10.1: unresolved uncertainty must not be encoded as a restrictive `high` that silently removes fine hair from the fit prior.
- **This is the single most consequential judgment call in the gold set.** A cream with `DIMETHICONE` at rank #2 reading as *moderate* weight may be an anchor defect; the alternative reading (`high`) is preserved here and routed for adjudication.
- attached transfer caution: **not emitted** — the lipid load is medium-band and the silicone is film-forming; the caution's trigger ("low-spreading, non-volatile, **non-film-forming** lipid load") is not met. Recorded as a limitation rather than a caution.
- limitations: §17.11; G9 (the cream form word played no part).
- review_status: `provisional`

## 6. PERS — `neutral_non_volatile`

confidence **low** · E2 · scope `formula`

- formula_observations: `DIMETHICONE` #2, `DIMETHICONOL` #5 — unmodified persistent silicones requiring surfactant emulsification to remove. `QUATERNIUM-80` #14 — a silicone quat, i.e. a `permanent_cationic` family member, but at position 14 of 25 it is not present *as architecture*.
- threshold_reasoning: the ordinal rule is "highest class present **as architecture** wins; record the others as supporting". `permanent_cationic` is recorded as **supporting**, not as the value, on the architecture qualifier. `ph_dependent_cationic` fails (no amodimethicone/amidoamine). `volatile_or_water_soluble` fails — that class requires volatiles/humectants only, or PEG-modified silicones as the *only* silicone; here unmodified dimethicone leads.
- attached buildup caution: **yes**, non-quantitative and consistent with the class (G3 rule 4). Wash resistance and buildup are one property read from two ends (FS-13).
- limitations: G11 — no wash counts, no durations, and none of the banned circulating removal percentages.

## 7. HOLD — `none`

confidence **moderate** · E2 · scope `formula`

- Absence pattern: no PVP, VP/VA, VP/Acrylates, polyurethane or PVP/DMAPA. `POLYACRYLAMIDE` #4 is captured by the **L5 rheology exclusion** (it plausibly serves bottle rheology and emulsion stability, as its co-listing with C13-14 Isoparaffin and Laureth-7 indicates) — FS-25.
- The E0 phrase "styling cream" corroborates nothing here (FS-9: a hold polymer is not conditioning, and equally, styling language is not a hold polymer).

## 8. HEAT — `claim_only` · **`provides_heat_protection = true`** · **REVIEW**

confidence **low** · E0 + E1 · scope `product` + `formula`

- claim_observation (E0): „heat protection" in the manufacturer's own benefit list (`S5-claim`); repeated by the EU retailer.
- formula_observation: **no member of the closed L9 list.** `HYDROLYZED QUINOA` #12 is *not* the L9 member — the closed list names hydrolyzed **wheat** protein at a defined concentration in a model system, and G10 forbids generalising it. Generic silicone (#2, #3, #5), generic protein (#12) and panthenol (#8) are expressly barred (FS-7, FS-24).
- threshold_reasoning: `formula_plausible` is unreachable without an L9 member (G10). `not_claimed` fails — the manufacturer claims it. `product_tested` requires an exact-product thermal test with §3.2 metadata; none surfaced.
- production projection (§13.3): claim present, no L9 member → `true`, trace `claim_only`, **routed to human review**. Never grade efficacy; the accompanying "uv protection" claim (`BENZOPHENONE-4` #11) is out of this standard's scope and is recorded, not scored.
- review_status: `specialist_review_required`

## 9. HUM — `formula_plausible`

confidence **low** (the state's own ceiling) · E2 · scope `formula`

- formula_observations: a **persistent hydrophobic silicone film** — `DIMETHICONE` #2, `DIMETHICONOL` #5, plus the silicone quat #14 — with a plausible water-uptake-reduction mechanism.
- Mandatory humectant counter-signal check: `PANTHENOL` #8 and `BUTYLENE GLYCOL` #18 are present but do **not** constitute a dominant humectant architecture; no glycerin, no sodium PCA, no betaine.
- threshold_reasoning: `formula_plausible` is the highest state reachable without measurement. `product_tested` requires HHCR/DHCR, DVS or humidity-chamber imaging on the exact product with declared RH, temperature and equilibration time — the E0 „reduces frizz" claim is none of these (§3.3: EU legality implies a dossier, never a test). `claim_only`/`not_claimed` understate a genuine qualifying route.
- limitations: E2, low confidence by construction; never encode a dew-point threshold (FS-16). Humidity response is measured, not inferred.

## 10. R2 — `candidate`

confidence **low** · E2 · scope `formula`

- formula_observation: `QUATERNIUM-80` #14 — a **silicone quat**, explicitly named in the R2 `candidate` anchor as a substantive route, sitting in a plausible film-forming context (a silicone emulsion).
- counter_signals: position 14 of 25 places it in the sub-1 % region; `HYDROLYZED QUINOA` #12 is a plain hydrolysate and contributes nothing (it is the `none_visible` anchor); `PANTHENOL` #8 is expressly excluded.
- threshold_reasoning: `none_visible` would ignore a named substantive family. `tested` requires exact-product endpoint evidence meeting §3.2. Confidence is held **low** because the route rests on a single tail entry.
- Hard limit: never converts into structural repair, penetration, strength or a diagnosed "protein need". Ceiling low–moderate; the supporting evidence base is supplier-dominated (SR §K R2).

## 11. DOSE — `moderate` (derived)

confidence **moderate** · `derived_from: [WT=moderate, FORM=emulsion, L3 spreading class = medium band]`

- `high` fails on all three limbs (WT is not `high`; FORM is not `two_phase`; no rich/low-spreading band member). `low` fails (FORM is not an aqueous solution with a volatile-dominant carrier). G3: emits a caution, does not modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- `PARFUM` #7 plus `LIMONENE` #21, `HEXYL CINNAMAL` #22, `LINALOOL` #23, `GERANIOL` #24, `CITRAL` #25. No solvent-alcohol note. G6 applies; exposure ≠ tolerance.

## 13. ROLE — `["post_wash", "heat_styling", "refresh"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „Apply to towel-dried hair" → `post_wash` (damp, after washing). „and blow-dry" / „before blow-drying" → `heat_styling`, read directly from the directions, not from the claim. „Apply after styling / to dry locks after styling to tame frizz and flyaways" → `refresh`.
- `curl_styling` rejected (no curl technique described). `ends_only` rejected (no placement restriction confirmed verbatim).
- G2: ROLE is an input to fit derivation, never a substitute for one. Note the interaction the standard flags: a `refresh` role alongside a non-trivial persistence class raises the buildup caution without moving any score.

## Demoted flags

- `smoothing_shine_qualifier`: `present` (on SFR only).
- `curl_definition_focus`: **not set** — HOLD `none`.
- `R3`: `unknown`. LAYER caution: **not emitted** (no high-charge cationic species as architecture). Buildup caution: **emitted**. Transfer caution: **not emitted** (see WT).

## care_direction — `unknown`

confidence **moderate** · E2 · scope `formula`

- `protein` fails: R2 `candidate` rests on a **silicone quat, not a protein/peptide/silane**, and it is a tail entry, not "materially present, i.e. more than a tail entry". `HYDROLYZED QUINOA` is a tail hydrolysate. `moisture` fails: §9's anchor is a coherent **L1/L3/L4** conditioning + humectant + emollient architecture as the *material direction* — here the material direction is an **L2 silicone film**, with humectants minor and emollients secondary. `balanced` requires a substantive mixed architecture, which does not exist.
- `unknown` is the standard's deliberate conservative bucket ("keeps the standard conservative under mixed evidence instead of forcing a guess").
- **Systemic note:** §9 has no anchor for a silicone-led architecture. This lane returns `unknown` for slots 5, 8, 9 and 13 on the same reasoning; that is 4 of 10 in-category records and should be adjudicated.

## Lean matching profile

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "unknown",
  "focus": { "primary": "smoothing", "secondary": ["heat_styling"] },
  "usage_role": ["post_wash", "heat_styling", "refresh"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["product_form", "weight_potential", "care_direction", "specialist_functions.provides_heat_protection"]
}
```

**Focus derivation.** `smoothing` = SFR `high` (a continuous alignment/film route beyond baseline conditioning) — met, and it is the strongest architecture-level signal in the record. `heat_styling` = HEAT ≥ `claim_only` **and** ROLE includes `heat_styling` — both met, so it earns a secondary slot; it sets a *use context*, never a protection level. `repair` was considered (R2 `candidate`) and **rejected as a secondary**: it rests on one tail-level silicone quat and would add no useful matching information beyond the smoothing film, while risking the impression of a repair level the standard forbids. `shine` rejected under §8.1/G3 — it merely restates the smoothing film. `volume_lightness`, `detangling` (bias is `dry_biased`), `curl_definition` all fail.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=moderate, product_form=emulsion]`: formula (two light/medium non-volatile families, no rich band, no LGN) → product property (moderate coating potential) → fit. Fine = `conditional`, carrying the §17.11 judgment-call label and the WT anchor-gap caveat.
- `damage_fit` ← `[conditioning_level=moderate, repair_surface_film=candidate, bond_flag=none, product_evidence=none]` → row 2. **Row 3 is unreachable** because it requires `conditioning_level = high`, which the LGN-necessity clause blocks — an interaction worth adjudicating.
- `texture_fit` ← `[weight_potential=moderate, slip=high, hold_route_state=none]` → row 2.
- `scalp_application_fit` ← directions are silent about placement (the "avoiding the roots" line could not be verified) → `unknown`. G6 applies.

## German copy emitted (§18)

- HEAT claim without L9 member: „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das."
- PERS + buildup: „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
- R2 `candidate`: „Enthält einen Protein-Film-Baustein, der sich aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur." *(Copy-review note: the German pattern says „Protein-Film"; the route here is a silicone quat, so this string must be reworded before use.)*
- EXPO: „Enthält deklarierte Duftstoffe."
- `scalp_application_fit = unknown`: „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
