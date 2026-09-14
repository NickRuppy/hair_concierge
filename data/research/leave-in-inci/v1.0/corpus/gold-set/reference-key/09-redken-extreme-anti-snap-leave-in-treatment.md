# Slot 9 — Redken Extreme Anti-Snap Leave-In Treatment (250 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Protein/surface-repair
- `gtin`: **unresolved** — candidates 884486453402 and 884486210777 · `market`: DE · `identity_status`: **`provisional_identity_conflict`**
- `rawInciSha256`: `2f2fb1d8c62ea11ed91781923a056d3ceac38a210cb2484d0fdd857ec5768dfe`
- `formulaFingerprintSha256`: `239f65c85fea4997b2df1be0570c42f4b50858e465d6cfb0d4304468e5e50f00`
- `review_routing`: **routed to human review** — (a) identity/GTIN conflict (§14); (b) **heat-protection claim with no L9 member** (§13.3); (c) COND ceiling forced by the LGN-necessity clause, which blocks the `damage_fit` upgrade on the one gold-set product with a genuine substantive-film route.

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S9-dir` | T2 (douglas.de, Art. 117080 confirmed on page) | „Auf einzelne brüchige Haarstellen oder auf dem ganzen Haar verteilen und einmassieren. **Ohne ausspülen**, direkt die Haare wie gewohnt stylen. Einfache Kämmbarkeit und geschmeidige Haare genießen!" |
| `S9-dir2` | T1 (redken.com) | „Apply to fragile or damaged areas of hair, or all over **while damp**. **Do not rinse out.** Style as usual." |
| `S9-claim` | T1 + T2 | „verleiht deinem Haar einen **effektiven Hitzeschutz** und legt sich wie eine schützende Glanzschicht um die Haarfasern" (T2); T2 attribute tags incl. „Anti-Frizz, Hitzeschutz"; „5-in-1 damage protection power against: chemical damage, heat damage from hot hairstyling tools, mechanical damage, surface damage, and hair breakage" (T1); „Reduces breakage by 73%*" **with the manufacturer's own asterisk: "when used as a system of Extreme Shampoo, Conditioner and Anti-Snap"** (T1). |

---

## G0 — `in_category`

confidence **high** · **E1 (directions)** · scope `directions`

- `AQUA` #1; „Ohne ausspülen" / „Do not rinse out" is explicit in both languages; conditioning and breakage-prevention are the declared primary functions.
- `excluded_anhydrous`, `excluded_styling_first` (no L5 member; `POLYACRYLAMIDE` #2 is the rheology exclusion) and `excluded_other_form` all fail.

## 1. FORM — `emulsion` **(anchor gap — field uncertain)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: the inverse-emulsion thickener/emulsifier triad `POLYACRYLAMIDE` #2 + `C13-14 ISOPARAFFIN` #7 + `LAURETH-7` #10, with `TRIDECETH-6` #13 as an additional nonionic. A **fatty-alcohol/quat pattern does exist** — `CETYL ALCOHOL` #15 + `CETRIMONIUM CHLORIDE` #16 + `BEHENTRIMONIUM METHOSULFATE` #17 — but at positions 15–17 of 25 it sits in the sub-1 % region.
- threshold_reasoning: the `emulsion` anchor requires an LGN pair **above the tail**; here the pair is *present but tail-level*, so it cannot be the structuring architecture — the polymeric emulsifier system is. `emulsion` is still the honest label (this is a real emulsion), with the same §7.1 anchor-gap caveat as slots 5 and 8. `aqueous_or_hydroalcoholic_solution` fails (real emulsification of a silicone/ester phase). `microemulsion` fails (no PEG-ester battery, glycols absent from the top). `two_phase` fails (emulsifiers present, no shake direction).
- **Load-bearing consequence:** because the LGN pair is not above the tail, the COND `high` anchor cannot fire. This is a finer-grained version of the slots 5/8/13 problem and is flagged with them.
- G9: never sets WT. `presentation_form` (metadata): Leave-in treatment lotion.
- review_status: `provisional`

## 2. COND — `moderate`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `AMODIMETHICONE` #4 (persistent, pH-dependent cationic silicone film); `ISOPROPYL MYRISTATE` #8 (dry-feel/high-spreading ester); `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #14 (silane film route); the tail-level quats/fatty alcohol (#15–#17); `QUATERNIUM-33` #19.
- threshold_reasoning: `high` requires an LGN pair **above the tail** — not met (see FORM). `moderate` = "a persistent silicone/emollient package — without a full LGN pair". `low` fails decisively.
- counter_signals: `ISOPROPYL MYRISTATE` carries a known negative "grating/dry" sensory note (SR §D.1) — recorded, not scored.
- **Rule-ambiguity flag:** this is the clearest case in the set where the LGN clause distorts the outcome. See `damage_fit` below.
- limitations: G4; R1 folded in — the „Anti-Snap"/anti-breakage frame is an explanation derived from COND (lubrication reduces grooming fracture), never a separate score (SR §H.1 point 1: this is damage *prevention*, not repair).

## 3. SLIP — `high`, bias `dry_biased`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- Two or more independent M1 contributors as architecture: a persistent amino-silicone film (#4) and a distinct emollient ester route (#8), with the cationic pair supporting from the tail.
- Bias: `wet_biased` fails (a persistent film exists); `both` fails (no volatile carrier — `C13-14 ISOPARAFFIN` here is part of the polymer delivery system, not a declared volatile spreading phase). `dry_biased` by elimination, confidence low.
- **FS-12 recorded explicitly**: amodimethicone's "selective deposition, therefore no buildup" argument is a *rinse-off* argument that over-reads the deposition data even there, and streaming-potential work shows deposition continues after surface-charge reversal. In a leave-on there is no rinse to remove the non-selective fraction. It must not be used to soften anything in this record.
- limitations: FS-22; SR §M.5.

## 4. SFR — `high` · SHN qualifier `present`

confidence **moderate** (ceiling) · E2 · scope `formula`

- A continuous persistent-film route (`AMODIMETHICONE` #4) **plus** a separate lubrication route (`ISOPROPYL MYRISTATE` #8) — two different families, satisfying G3's demand for an additional endpoint-relevant observation rather than a restatement.
- SHN `present`, qualifier only. The E0 „schützende Glanzschicht" claim corroborates and does not set it (§8.1, FS-23).
- §7.4 discipline: the T2 „Anti-Frizz" attribute tag is a **humidity** statement and belongs entirely to HUM; it makes no contribution here.

## 5. WT — `moderate` **(anchor gap — field uncertain)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: persistent non-volatile families — (i) amino silicone (#4), (ii) dry-feel ester (#8), plus tail-level fatty alcohol/quats (#15–#17). **Absence pattern: no LGN pair above the tail; no rich/low-spreading band member; no oil or butter of any kind.**
- threshold_reasoning: none of the three `high` limbs fires — the rich-band qualifier is absent and the LGN pair is tail-level. `moderate`'s "exactly one persistent non-volatile family" is not literally met either (there are two light families), but `moderate` is the closer and less restrictive cell, per §10.1's tie-break. Of the three records affected by this anchor gap (5, 8, 9), this is the one where `moderate` sits most comfortably: both families are in the light/dry-feel end of the spreading scale.
- attached transfer caution: **not emitted** — the lipid is a high-spreading ester and the silicone is film-forming; the caution's trigger is a low-spreading, non-film-forming load.
- limitations: §17.11; G4 (amodimethicone level and MW invisible).

## 6. PERS — `ph_dependent_cationic`

confidence **low** · E2 · scope `formula`

- formula_observations: `AMODIMETHICONE` #4 — the anchor's named exemplar, present as architecture. Supporting lower class: `ISOPROPYL MYRISTATE` (`neutral_non_volatile`). `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #14 is a silane, not a cationised protein, and sits in the tail; `QUATERNIUM-33` #19 and the monomeric quats are tail-level.
- threshold_reasoning: `permanent_cationic` fails — no silicone quat, no polyquaternium, no cationised protein at architecture level. `neutral_non_volatile` understates the charge-substantive amino-silicone mechanism. `volatile_or_water_soluble` fails.
- attached buildup caution: **yes**, non-quantitative, and it must not be softened by the amodimethicone selectivity argument (FS-12, FS-13). G3 rule 4: PERS and buildup are one property from two ends.
- limitations: G11; SR §I — no finished-product accumulation study exists.

## 7. HOLD — `none`

confidence **moderately_high** · E1/E2 · scope `formula`

- Absence pattern: no PVP, VP/VA, VP/Acrylates, polyurethane or PVP/DMAPA. `POLYACRYLAMIDE` #2 is captured by the L5 rheology exclusion (FS-25), as its co-listing with C13-14 Isoparaffin and Laureth-7 shows.

## 8. HEAT — `claim_only` · **`provides_heat_protection = true`** · **REVIEW**

confidence **low** · E0 + E1 · scope `product` + `formula`

- claim_observation (E0): „effektiven Hitzeschutz" (T2, German market) and "heat damage from hot hairstyling tools" within the 5-in-1 claim (T1).
- formula_observation: **no member of the closed L9 list.** Checked individually: `HYDROLYZED SOY PROTEIN` #12 is *not* the hydrolyzed **wheat** protein named by McMullen & Jachowicz; `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #14 is a silane derivative, not an L9 member; `QUATERNIUM-33` is *not* Quaternium-70; `AMODIMETHICONE` is a generic silicone (FS-7). G10 stops all of these at `claim_only`.
- The „73 % less breakage" figure is **explicitly a system result** (shampoo + conditioner + this product, per the manufacturer's own asterisk). §14 routes "multi-product or routine-level efficacy evidence being offered for a single leave-in" to review; it cannot support any value here.
- production projection (§13.3): claim present, no L9 member → `true`, trace `claim_only`, **routed to human review**. Never grade efficacy; no `heat_protection_max_c`; FS-7 and FS-14 both govern.
- review_status: `specialist_review_required`

## 9. HUM — `formula_plausible`

confidence **low** (state ceiling) · E2 · scope `formula`

- formula_observations: a **persistent hydrophobic amino-silicone film** (`AMODIMETHICONE` #4) with a plausible water-uptake-reduction mechanism.
- Mandatory humectant counter-signal check: **no glycerin, no propanediol, no glycol, no sodium PCA, no betaine anywhere in the formula.** This is the cleanest qualifying case in the gold set — the usual counter-signal is entirely absent.
- threshold_reasoning: `claim_only` would understate a genuine route (a T2 „Anti-Frizz" tag exists, but the route, not the claim, sets this state). `product_tested` requires HHCR/DHCR, DVS or humidity-chamber imaging on the exact product with declared RH, temperature and equilibration time.
- limitations: E2, low confidence by construction; humidity response is measured, not inferred; FS-16.

## 10. R2 — `candidate`

confidence **low** · E2 · scope `formula`

- formula_observation: `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #14 — a **silane derivative**, named explicitly in the L6 evidence list and in the R2 `candidate` anchor, sitting in a plausible film-forming context alongside an amino silicone and cationic species.
- counter_signals: position 14 of 25 places it in the sub-1 % region; `HYDROLYZED SOY PROTEIN` #12 is a plain hydrolysate and contributes nothing (`none_visible` anchor); `ARGININE` #5 is a free amino acid, not a film route.
- threshold_reasoning: `none_visible` would ignore a named substantive family that is genuinely present. `tested` requires exact-product endpoint evidence meeting §3.2. Confidence **low** — the route rests on a single tail entry and the underlying evidence base is supplier-dominated, with molecular-weight and substantivity figures from datasheets rather than independent measurement (SR §K R2).
- **Hard limits.** Moderately supported for film/feel/body effects; **not supported** for structural repair. Never converts into penetration, strength or a diagnosed "protein need". The „Anti-Snap" name and the „repariert" language are E0.

## 11. DOSE — `moderate` (derived)

confidence **moderate** · `derived_from: [WT=moderate, FORM=emulsion, L3 spreading class = dry-feel/high-spreading]`

- `high` fails on all three limbs; `low` fails (FORM is not an aqueous solution with a volatile-dominant carrier). G3: emits a caution, does not modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- `PARFUM` #9 plus `BENZYL BENZOATE` #18, `LIMONENE` #20, `BENZYL ALCOHOL` #21, `LINALOOL` #22. No solvent-alcohol note. G6 applies; exposure ≠ tolerance.

## 13. ROLE — `["post_wash"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „while damp" + „Ohne ausspülen" → `post_wash`; the T1 text additionally directs prior use of the line's shampoo and conditioner.
- `heat_styling` **not set**: „Style as usual" / „wie gewohnt stylen" names **no heat tool**. The heat claim is E0 and never populates ROLE. `refresh` not set (no dry-hair use described). `ends_only` not set — the directions offer targeted application to brittle areas **or** all over, which is a damage-targeted instruction, not a placement restriction.
- G2: ROLE is an input to fit derivation, never a substitute for one.

## Demoted flags

- `smoothing_shine_qualifier`: `present`.
- `curl_definition_focus`: **not set** — HOLD `none`.
- `R3`: `unknown` — no named bond chemistry and no bond claim (the „5-in-1 damage protection" language names no chemistry).
- LAYER caution: **not emitted** — no high-charge cationic polymer at architecture level.
- Buildup caution: **emitted**. Transfer caution: **not emitted**.

## care_direction — `unknown`

confidence **moderate** · E2 · scope `formula`

- `protein` fails on the **materiality** clause, not on the route: §9 requires a substantive protein/peptide/silane film route (R2 `candidate` — satisfied) that is *"materially present, i.e. more than a tail entry"*. The silanetriol sits at #14 of 25. This is the closest any gold-set record comes to `protein`, and it fails by position alone — a good calibration probe.
- `moisture` fails hard: there is **no humectant in the formula at all**, so the L1/L3/L4 architecture the anchor describes does not exist. `balanced` requires a substantive mixed architecture.
- Constraint honoured: `care_direction` does not drive weight, persistence, hold or heat.

## Lean matching profile

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "unknown",
  "focus": { "primary": "smoothing", "secondary": ["repair"] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["product_form", "weight_potential", "care_direction", "focus.primary", "specialist_functions.provides_heat_protection"]
}
```

**Focus derivation — `primary` marked uncertain (§10.2 rule 5).** Two plausible purposes remain: `smoothing` (SFR `high`, resting on `AMODIMETHICONE` at #4 — architecture level) and `repair` (R2 `candidate`, resting on a silane at #14 — tail level). This lane takes `smoothing` as primary on **evidence strength and rank**, and `repair` as secondary because it adds genuinely distinct matching information (a named substantive film route that generic silicone/oil/panthenol cannot supply). The product's own anti-breakage positioning corroborates `repair` but never creates it (§10.2 rule 4). `detangling` is excluded by rule 1 (baseline conditioning is not the distinctive purpose) and by the `dry_biased` bias; `heat_styling` fails its ROLE limb; `volume_lightness`, `curl_definition` and `shine` all fail.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=moderate, product_form=emulsion]`: formula (two light non-volatile families, no rich band, tail-level LGN) → product property (moderate coating potential) → fit. Fine = `conditional`, carrying the §17.11 judgment-call label.
- `damage_fit` ← `[conditioning_level=moderate, repair_surface_film=candidate, bond_flag=none, product_evidence=none]` → **row 2**. **This is the most questionable derived value in the whole gold set:** the §10.3 third row would upgrade `highly_damaged` to `recommended` for a product with "a distinct L6 substantive film route" — which this record *has*, uniquely — but the row also requires `conditioning_level = high`, which the LGN-necessity clause makes unreachable for a silicone-led formula. A leave-in explicitly built for extremely damaged hair therefore lands on `highly_damaged: conditional`. Flagged for adjudication.
- `texture_fit` ← `[weight_potential=moderate, slip=high, hold_route_state=none]` → row 2.
- `scalp_application_fit` ← directions specify targeted or all-over application without a scalp statement → `unknown`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- HEAT claim without L9 member: „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das."
- R2 `candidate`: „Enthält einen Protein-Film-Baustein, der sich aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur."
- PERS + buildup: „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
- EXPO: „Enthält deklarierte Duftstoffe."
- `scalp_application_fit = unknown`: „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
