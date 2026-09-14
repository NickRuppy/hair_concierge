# Slot 8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair (200 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Heat-protective primer
- `gtin`: 4015100813494 · `market`: DE · `identity_status`: `verified`
- `rawInciSha256`: `010d7b04d4b62f22900ec0b42880167776b19297c6a155c53ccea4eadc7ff256`
- `formulaFingerprintSha256`: `9adbf8cb1ae853784ca9a859537f7da4d0e1618f3ea5bee2e4d5090b2de7e7dd`
- `review_routing`: **routed to human review** — (a) **heat-protection claim („Hitzeschutz bis zu 230 °C") with no L9 member** — the flagship §13.3 review case; (b) FORM anchor gap (non-LGN silicone emulsion vs microemulsion unresolved); (c) COND ceiling forced by the LGN-necessity clause.

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S8-dir` | T1 (schwarzkopf.de) | „Vor Gebrauch schütteln! Nach jeder Haarwäsche in das handtuchtrockene oder trockene Haar sprühen. **Nicht ausspülen!** Regelmäßig anwenden. Rückstände vom Boden entfernen. Nicht in die Augen sprühen!" |
| `S8-claim` | T1 (schwarzkopf.de) + T2 (dm.de, GTIN 4015100813494 / dm-Art. 1430908 confirmed on page) | **„Hitzeschutz bis zu 230 °C"** (T1, three occurrences) / **„Hitzeschutz bis 230 Grad"** (T2); „bis zu 20 mal mehr Widerstandskraft"; „Rekonstruktion der Haarstruktur durch flüssiges Keratin"; „Haarschäden werden zielgenau repariert"; „gesunden Glanz". No anti-frizz/humidity claim, no hold claim. |

---

## G0 — `in_category`

confidence **high** · **E1 (directions)** · scope `directions`

- `AQUA` #1; „Nicht ausspülen!" is explicit and comes from the manufacturer's own page; the declared function is conditioning („leichte Kämmbarkeit").
- threshold_reasoning: `excluded_other_form` fails despite the name „Sprüh-Conditioner"/„Spülung" appearing in the brand's own copy — **the directions, not the name, decide** (G0), and they say do not rinse. `excluded_anhydrous` fails (Aqua leads). `excluded_styling_first` fails (no L5 member at any position). This slot is a useful demonstration that the word "Conditioner"/"Spülung" does not settle the exposure regime in either direction — cf. slot 2, where the same word class went the other way.

## 1. FORM — `emulsion` **(anchor gap — field uncertain)**

confidence **moderate** · E2 · scope `formula` + `directions`

- formula_observations: `AQUA` #1; `TRISILOXANE` #2 (volatile silicone carrier); `DIMETHICONE` #3, `PHENYL TRIMETHICONE` #5, `DIMETHICONOL` #8 (persistent silicone phase); emulsifier `CETYL PEG/PPG-10/1 DIMETHICONE` #10 (a dedicated silicone emulsifier); `POLYQUATERNIUM-16` #9; `CETRIMONIUM CHLORIDE` #11. **Absence pattern: no fatty alcohol → no LGN pair; no PEG-ester battery; glycerin sits at #15, not high.**
- directions_observation: „Vor Gebrauch schütteln!" (`S8-dir`).
- threshold_reasoning: `two_phase` is **rejected despite the shake direction**, because the anchor requires "no emulsifier at all" and a dedicated silicone emulsifier is present at #10 — the shake instruction here is consistent with a low-viscosity emulsion that can cream, not with a phase-separated system. `microemulsion` cannot be excluded on formula alone (a clear silicone microemulsion spray is a real possibility and would carry the same solubiliser-light pattern) — the discriminator is visual clarity, which this lane did not observe, so the field is marked **uncertain** with `microemulsion` recorded as the live alternative. `aqueous_or_hydroalcoholic_solution` fails: the emulsifier is doing real work on a large silicone phase. `emulsion` is chosen with the same anchor caveat as slot 5 — the §7.1 `emulsion` cell is LGN-specific and does not literally cover a polymeric/silicone-emulsifier system.
- **Practical consequence is bounded**: G9 means FORM never sets WT, and both candidate values are in-category; the only downstream difference is the DOSE derivation, where `microemulsion` would also give `moderate`. FS-17 is the governing false signal if the product turns out to be clear: transparent ⇏ light.
- `presentation_form` (metadata): Sprüh-Conditioner / spray.
- review_status: `provisional`

## 2. COND — `moderate` **(ceiling forced by the LGN-necessity clause)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: persistent silicone package `DIMETHICONE` #3 + `PHENYL TRIMETHICONE` #5 + `DIMETHICONOL` #8; cationic route `POLYQUATERNIUM-16` #9 + `CETRIMONIUM CHLORIDE` #11; emollient `PRUNUS ARMENIACA KERNEL OIL` #4 (medium band).
- Volatile fraction excluded from the reading: `TRISILOXANE` #2 evaporates and contributes nothing to residue or persistence (FS-4, M6). `CETYL PEG/PPG-10/1 DIMETHICONE` #10 is a PEG-modified, easily removed silicone.
- threshold_reasoning: three independent routes are present at architecture level, which would ordinarily satisfy G3 rule 3 for a top value — but **the `high` anchor makes an LGN pair a necessary condition, and no fatty alcohol exists in this formula**. Assigned `moderate` ("a persistent silicone/emollient package — without a full LGN pair"). `low` fails decisively.
- **Rule-ambiguity flag** (same as slots 5, 9, 13): the LGN-necessity clause caps every silicone-led leave-in at `moderate` and, through §10.3, blocks the `damage_fit` row-3 upgrade for a product explicitly sold for „extrem geschädigtes Haar".
- review_status: `provisional`

## 3. SLIP — `high`, bias `both`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- Two or more independent M1 contributors as architecture: a persistent silicone film (#3, #5, #8) **and** a cationic route (#9, #11), plus an emollient (#4).
- Bias `both`: a volatile carrier is materially present at rank #2 (`TRISILOXANE`, M6 — spreading and dry-down) **and** a persistent film is materially present (#3, #5, #8). `wet_biased` fails (a persistent film exists); `dry_biased` fails (a spreading carrier is materially present at #2).
- limitations: FS-22; SR §M.5 — the WET+DRY merge is provisional. M6 contributes to SLIP bias only and to **nothing** in WT or PERS.

## 4. SFR — `high` · SHN qualifier `present`

confidence **moderate** (ceiling) · E2 · scope `formula`

- A continuous persistent-silicone film route (#3, #5, #8) **plus** a separate lubrication route (`PRUNUS ARMENIACA KERNEL OIL` #4, aided in spreading by `TRISILOXANE` #2) — two different ingredient families, which is the endpoint-relevant additional observation G3 requires.
- SHN `present`, **as a qualifier on SFR only**. `PHENYL TRIMETHICONE` #5 is a high-refractive-index silicone, but it is already counted inside the M1/M3 film; §8.1 permits an independent shine value only for a distinct gloss route not already counted, or exact-product goniophotometry. Neither applies, so the E0 „gesunden Glanz" claim is recorded and not scored (FS-23).
- §7.4 discipline: "frizz" is deliberately absent from this dimension; any humidity statement belongs to HUM alone.

## 5. WT — `moderate` **(anchor gap — field uncertain)**

confidence **moderate** · E2 · scope `formula`

- formula_observations: persistent non-volatile families — (i) persistent silicone (#3, #5, #8), (ii) non-volatile emollient (`PRUNUS ARMENIACA KERNEL OIL` #4, **medium** band), (iii) cationic polymer film (`POLYQUATERNIUM-16` #9). **Absence pattern: no LGN pair; no rich/low-spreading band member anywhere.**
- counter_signals: `TRISILOXANE` at #2 is volatile — a large slice of what the rank order suggests simply evaporates (FS-4); dimethicone viscosity grade is invisible (G4, SR §C.2).
- threshold_reasoning: `high` requires one of three limbs — an LGN pair (absent), two-plus persistent non-volatile families **with a rich/low-spreading band member** (family count clears, rich-band qualifier does not), or a two-phase/microemulsion oil phase (FORM is unresolved but the emulsion read is preferred). None fires. `moderate`'s "exactly one persistent non-volatile family" is also not literally met. Between two misfitting cells this lane takes `moderate`, on §10.1's own tie-break against encoding unresolved uncertainty as a restrictive `high`.
- **Same anchor gap as slot 5, flagged for adjudication:** the anchors have no cell for "several *light/medium* persistent non-volatile families".
- attached transfer caution: **not emitted** (no low-spreading non-film-forming lipid load).
- limitations: §17.11; G9 — the "spray" form word played no part (FS-2).
- review_status: `provisional`

## 6. PERS — `permanent_cationic`

confidence **low** · E2 · scope `formula`

- formula_observations: `POLYQUATERNIUM-16` #9 — a permanently quaternised **polymer** present as architecture. Supporting lower classes: `DIMETHICONE`/`DIMETHICONOL` (`neutral_non_volatile`, and unmodified, so they require surfactant emulsification); `CETRIMONIUM CHLORIDE` #11 (monomeric quat).
- counter_signals: `CETYL PEG/PPG-10/1 DIMETHICONE` #10 is a PEG-modified, water-dispersible silicone that leaves easily; `TRISILOXANE` #2 contributes nothing.
- threshold_reasoning: highest class present **as architecture** wins. `ph_dependent_cationic` fails (no amodimethicone/amidoamine). Confidence **low** — charge density is the actual lever and is unreadable from an INCI name (G4).
- attached buildup caution: **yes**, non-quantitative, consistent with the class. FS-13: wash resistance and buildup are one property from two ends; the directions' „Regelmäßig anwenden" (`S8-dir`) raises the routine-level consideration without licensing any number.
- limitations: **G11 — no duration, wash count, applications-to-buildup or clarification frequency, and none of the banned circulating removal percentages.** The E0 claim „bis zu 20 mal mehr Widerstandskraft" is a marketing number about resistance, not about persistence, and is recorded only.

## 7. HOLD — `none`

confidence **moderately_high** · E1/E2 · scope `formula`

- Precise absence pattern: no PVP, VP/VA, VP/Acrylates, polyurethane, PVP/DMAPA or acrylates fixative in the 21-item list. `POLYQUATERNIUM-16` is a conditioning cationic polymer (L1), not a fixative-class polymer (L5).

## 8. HEAT — `claim_only` · **`provides_heat_protection = true`** · **REVIEW** — the flagship case

confidence **low** · E0 (claim) + E1 (formula absence) · scope `product` + `formula`

- claim_observation (E0): „Hitzeschutz bis zu 230 °C", on the manufacturer's own page and on the retailer page for the exact GTIN (`S8-claim`).
- formula_observation: **no member of the closed L9 list.** Checked individually: `POLYQUATERNIUM-16` is *not* Polyquaternium-55; `HYDROLYZED KERATIN` #6 is *not* the specific hydrolyzed **wheat** protein of McMullen & Jachowicz; `HYDROLYZED PEARL` #7, the silicones and the apricot oil are all generic and expressly barred (FS-7, G10).
- threshold_reasoning: `formula_plausible` is unreachable without an L9 member (G10) — this is precisely the case the closed list exists to catch. `not_claimed` fails. `product_tested` requires an exact-product DSC / breakage-after-ironing / tryptophan-loss result with the §3.2 metadata (dose, damp vs dry, drying method, ambient RH); none surfaced, and §3.3 is explicit that EU claim legality means a dossier exists, not that an instrumental finished-product test does.
- production projection (§13.3, claim-led with a formula sanity-check): claim present, no L9 member → `provides_heat_protection = true`, trace `claim_only`, **and the record is routed to human review with a "claim looks formula-unsupported" note.** The standard does not silently drop the claim.
- **Hard prohibitions honoured.** No efficacy grade. **No `heat_protection_max_c`** — the 230 °C figure is a marketing *use-condition* parameter, not a measured protection level, and must never be promoted to one (FS-14, ruling 6). Published effect sizes in the anchor studies are on the order of 10–20 % damage reduction and are not expressed in °C at all.
- review_status: `specialist_review_required`

## 9. HUM — `formula_plausible`

confidence **low** (the state's own ceiling) · E2 · scope `formula`

- formula_observations: a **persistent hydrophobic silicone film** (`DIMETHICONE` #3, `PHENYL TRIMETHICONE` #5, `DIMETHICONOL` #8) with a plausible water-uptake-reduction mechanism.
- Mandatory counter-signal check: the only humectant is `GLYCERIN` at #15 of 21 — not a dominant humectant architecture.
- threshold_reasoning: `not_claimed` fails because a qualifying route exists (the state is not gated on a claim, and there is no humidity claim here — the route alone lifts it). `product_tested` requires HHCR/DHCR, DVS or humidity-chamber imaging on the exact product with declared RH, temperature and equilibration time.
- limitations: E2, low confidence by construction; humidity response is measured, not inferred; never encode a dew-point threshold (FS-16).

## 10. R2 — `none_visible`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `HYDROLYZED KERATIN` #6 and `HYDROLYZED PEARL` #7 are **plain hydrolysates — not cationised, not silane-modified**, so they are not a *substantive* route regardless of their favourable rank. `POLYQUATERNIUM-16` #9 is a generic cationic polymer whose charge density is unreadable (G4), and §10.2/§10.3 bar a generic cationic polymer from setting a repair focus or a damage upgrade.
- threshold_reasoning: `candidate` requires a substantive route — cationised protein, silane derivative, silicone quat or *high-charge* cationic polymer. None is demonstrable.
- The E0 claims „Rekonstruktion der Haarstruktur durch flüssiges Keratin" and „Haarschäden werden zielgenau repariert" are recorded and cannot set this value or a repair focus (§10.2; FS-5).

## 11. DOSE — `moderate` (derived)

confidence **moderate** · `derived_from: [WT=moderate, FORM=emulsion, L3 spreading class = medium band]`

- `high` fails on all three limbs. `low` fails (FORM is not an aqueous solution with a volatile-dominant carrier — the volatile is present but the architecture is an emulsion). If FORM resolves to `microemulsion`, DOSE stays `moderate` by the second rule. G3: emits a caution, does not modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- `PARFUM` #12 plus `TETRAMETHYL ACETYLOCTAHYDRONAPHTHALENES` #16, `CITRUS AURANTIUM PEEL OIL` #17, `LIMONENE` #18, `GERANYL ACETATE` #21. No solvent-alcohol note.
- G6 applies; exposure ≠ tolerance (SR §M.12).

## 13. ROLE — `["post_wash", "refresh"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „Nach jeder Haarwäsche in das handtuchtrockene … Haar sprühen" → `post_wash`. „oder trockene Haar" → `refresh`. „Regelmäßig anwenden" is a frequency statement recorded against the buildup caution.
- **`heat_styling` is deliberately NOT set.** The 230 °C claim is E0 marketing; ROLE is read only from the authoritative directions, and `S8-dir` contains **no heat tool, no Föhn, no Glätteisen**. Downstream this blocks the `heat_styling` focus, whose anchor requires HEAT ≥ `claim_only` **and** ROLE ∋ `heat_styling`. The product therefore ships `provides_heat_protection = true` with a focus that is not heat styling — an interaction worth adjudicating.
- `curl_styling` and `ends_only` rejected: no curl technique, no placement restriction in the directions.

## Demoted flags

- `smoothing_shine_qualifier`: `present`.
- `curl_definition_focus`: **not set** — HOLD `none`.
- `R3`: `unknown` — the „Rekonstruktion" language names no chemistry, so not even `claim_only` bond support arises.
- LAYER caution: **emitted** — a high-substantivity cationic polymer is present and the product is positioned for daily use before styling. Caution string only (§8.4).
- Buildup caution: **emitted**. Transfer caution: **not emitted**.

## care_direction — `unknown`

confidence **moderate** · E2 · scope `formula`

- `protein` fails: R2 is `none_visible`, so no substantive protein/peptide/silane film route exists — the two hydrolysates are plain, and §9 requires a substantive route, not a protein *name*. `moisture` fails: §9's anchor is a coherent **L1/L3/L4** architecture as the material direction; here the material direction is an **L2 silicone film**, with a single humectant at #15. `balanced` requires a substantive mixed architecture.
- One of four in-category records returning `unknown` on this axis for the same structural reason — see the summary's systemic notes.

## Lean matching profile

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "high",
  "hold_support": "none",
  "care_direction": "unknown",
  "focus": { "primary": "smoothing", "secondary": [] },
  "usage_role": ["post_wash", "refresh"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["product_form", "weight_potential", "care_direction", "specialist_functions.provides_heat_protection"]
}
```

**Focus derivation.** `smoothing` = SFR `high` — met, on a continuous alignment/film route beyond baseline conditioning. `heat_styling` **fails on its second limb** (ROLE does not include `heat_styling`) despite HEAT clearing the first — see ROLE above. `repair` fails: R2 `none_visible`, R3 `unknown`, and §10.2 states generic silicone/protein/repair naming cannot set it, which directly overrules the product's „Ultimate Repair" name. `detangling` fails (SLIP is `high` and the bias is `both`, which would qualify — but SFR `high` is the richer special-purpose route and §10.2 rule 3 evaluates special-purpose routes first; `detangling` is additionally excluded by rule 1, which keeps baseline conditioning out of the hierarchy). `volume_lightness` fails (WT not `low`). `shine` fails (§8.1). `curl_definition` fails (HOLD `none`).

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=moderate, product_form=emulsion]`: formula (two-to-three light/medium persistent families, a volatile at #2, no rich band, no LGN) → product property (moderate coating potential) → fit. Fine = `conditional`, carrying the §17.11 judgment-call label and the WT anchor-gap caveat.
- `damage_fit` ← `[conditioning_level=moderate, repair_surface_film=none_visible, bond_flag=none, product_evidence=none]` → row 2. **Row 3 unreachable** — it needs `conditioning_level = high`, blocked by the LGN clause, plus a qualifying specialist route, blocked by the plain hydrolysates.
- `texture_fit` ← `[weight_potential=moderate, slip=high, hold_route_state=none]` → row 2.
- `scalp_application_fit` ← directions specify no placement → `unknown`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- HEAT claim without L9 member: „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das."
- PERS `high` + buildup: „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
- LAYER: „Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen."
- EXPO: „Enthält deklarierte Duftstoffe."
- `scalp_application_fit = unknown`: „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
- Uncertain fields: „Dazu haben wir keine belastbare Information."
