# Slot 10 — Olaplex N°.6 Bond Smoother (100 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Bond-repair claim
- `gtin`: **unresolved** — candidates 896364002602 and 896364002619 · `market`: DE · `identity_status`: **`provisional_identity_conflict`**
- `rawInciSha256`: `3eb793e5789da28d80295f59c6625793f3260c45f1af255221a9f0faf22bad86`
- `formulaFingerprintSha256`: `297ac0d9541987b0d988781f61fbb05fc01e6e966fd150cca4c1bba96fb12aa3`
- `review_routing`: **routed to human review** — (a) identity/GTIN conflict plus a T3-only source for positions 14–46 (§14); (b) **R3 `chemistry_candidate` — proprietary bond/repair chemistry** (§14); (c) **heat-protection claim with no L9 member** (§13.3).

## Sources added by this lane

| Ref | Tier | Content |
|---|---|---|
| `S10-dir` | T1 (olaplex.com) | „Apply one pump to clean, damp hair. Comb through & style as desired." FAQ, verbatim: „Nº.6 Bond Smoother® is an **out-of-shower leave-in treatment** and styling product."; „You can use Nº.6 Bond Smoother® on **either damp or dry hair**."; „…great when used **before air drying or blow drying**. It can also be used on dry hair to refresh or touch up a style." |
| `S10-dir2` | T2 (douglas.de, Art. 1111439 confirmed) | „Einen Pumpstoß auf das saubere, feuchte Haar auftragen. Kämme es durch und style es nach Belieben. … Kann auf trockenes Haar aufgetragen werden, um krauses Haar zu kontrollieren…" |
| `S10-claim` | T1 + T2 | „An anti-frizz styling cream to smooth, hydrate, and reduce breakage."; **„450ºF/232ºC heat protection"**; „72H frizz control + humidity resistance"; „91% easier detangling"; „71% reduction in breakage during styling and brushing"; DE: „bis zu einer Hitze von 232 °C vor Stylingschäden geschützt". **Notable negative finding:** neither the manufacturer page nor the retailer listing makes an explicit **bond-repair** claim for N°.6 — the FAQ answers "Will it repair my hair?" with „strengthen, hydrate, and protect". The bond claim for this SKU is carried by the **product name**, which is E0. |

---

## G0 — `in_category`

confidence **high** · **E1 (directions)** · scope `directions`

- `WATER` #1; the manufacturer states outright it is an out-of-shower leave-in; conditioning/smoothing is primary.
- `excluded_anhydrous` fails (water leads). `excluded_styling_first` fails: no L5 fixative-class polymer exists at any position — `HYDROXYETHYLCELLULOSE` #17 and `HYDROXYPROPYL GUAR` #18 are the named L5 rheology exclusions (FS-25). `excluded_other_form` fails. The self-description "styling product" does not exclude (§2.3: run the HOLD anchor, not the word).

## 1. FORM — `emulsion`

confidence **high** · E2 · scope `formula`

- **LGN pair**: `CETEARYL ALCOHOL` #2 **plus** `BEHENTRIMONIUM CHLORIDE` #7, both far above the tail; supported by `GLYCERYL STEARATE` #15 and `CETRIMONIUM CHLORIDE` #13, which is the anchor's "often" list verbatim.
- threshold_reasoning: the cationic-surfactant + fatty-alcohol lamellar pair is the exact anchor. `microemulsion` fails (an LGN pair is present; no PEG-ester battery). `two_phase` fails (an emulsifier system exists; no shake direction). `aqueous_or_hydroalcoholic_solution` fails.
- G9: never sets WT. `presentation_form` (metadata): Cream.

## 2. COND — `high`

confidence **moderately_high** (ceiling) · E2 · scope `formula`

- formula_observations: LGN pair (#2 + #7) **plus** several further independent lubrication routes — `DIMETHICONE` #3 and `PHENYL TRIMETHICONE` #9 (persistent silicone film), `COCO-CAPRYLATE` #5 and `NEOPENTYL GLYCOL DIHEPTANOATE` #6 (dry-feel band esters).
- Volatile fraction excluded: `ISOHEXADECANE` #4 and `ISODODECANE` #8 are volatile hydrocarbons that evaporate and contribute nothing to residue or persistence (FS-4, M6) — a large slice of the visually impressive top of this list.
- threshold_reasoning: the LGN limb is met above the tail and the "further independent route" limb is met several times over at architecture level, with no material counter-signal — G3 rule 3's condition for a top value at E2. `moderate` is excluded because a full LGN pair is present.
- Fatty-alcohol discipline: `CETEARYL ALCOHOL` is consumed by the L1 pair and is not counted again as a hero emollient.

## 3. SLIP — `high`, bias `both`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- Two or more independent M1 contributors as architecture: cationic LGN deposit, persistent silicone film, dry-feel ester package.
- Bias `both`: volatile carriers are materially present at #4 and #8 (M6 — spreading and dry-down) **and** a persistent film is materially present (#2/#3/#7/#9). `wet_biased` fails (a persistent film exists); `dry_biased` fails (two volatile spreading agents sit in the top eight).
- The E0 „91% easier detangling" figure is a brand-run result with no §3.2 protocol and does not upgrade this value; FS-22 applies to any instrumental combing figure regardless.

## 4. SFR — `high` · SHN qualifier `present`

confidence **moderate** (ceiling) · E2 · scope `formula`

- A continuous persistent-silicone film route (`DIMETHICONE` #3, `PHENYL TRIMETHICONE` #9) **plus** separate lubrication routes (the LGN deposit and the ester package) — different families, so this is an additional endpoint-relevant observation, not a restatement (G3).
- SHN `present`, qualifier only: `PHENYL TRIMETHICONE` is a high-refractive-index silicone, but it is already counted inside the M1/M3 film, and §8.1 permits an independent shine value only for a distinct uncounted gloss route or exact-product goniophotometry (FS-23).
- §7.4 discipline: the „anti-frizz" positioning is a humidity statement and is handled exclusively by HUM.

## 5. WT — `high`

confidence **moderately_high** · E2 · scope `formula`

- formula_observations: **LGN pair** `CETEARYL ALCOHOL` #2 + `BEHENTRIMONIUM CHLORIDE` #7 → the first `high` limb fires on its own. Independently, two-plus persistent non-volatile families are present (silicone film #3/#9; ester package #5/#6; LGN lamellar deposit).
- counter_signals: the rich/low-spreading band is essentially absent — `COCOS NUCIFERA OIL` sits at **#46 of 46**, i.e. the very end of the tail, and `VITIS VINIFERA SEED OIL` #39 and `HELIANTHUS ANNUUS SEED OIL` #34 are likewise tail entries. `ISOHEXADECANE` #4 and `ISODODECANE` #8 evaporate. So the value rests on the LGN limb, not on a rich lipid load.
- threshold_reasoning: `moderate` is explicitly excluded once an LGN pair is present as architecture. Ceiling raised to **moderately_high**: FORM is definite and the non-volatile architecture is readable above the 1 % tail (#2–#9).
- attached transfer caution: **not emitted** — the trigger requires a *low-spreading, non-film-forming* lipid load; here the lipids are dry-feel esters and the coconut oil is a tail entry. Recorded as a limitation instead.
- Rele & Mohile explicitly **not** invoked for the tail-level coconut oil: that result is specific to coconut oil, came from a pre-/post-wash **oil treatment** protocol, and enters a leave-in record only at E2 as mechanism (FS-19, G8) — it says nothing about weight in any case.
- limitations: §17.11 fine-hair judgment call.

## 6. PERS — `neutral_non_volatile`

confidence **low** · E2 · scope `formula`

- formula_observations: `DIMETHICONE` #3 and `PHENYL TRIMETHICONE` #9 — unmodified persistent silicones requiring surfactant emulsification; the LGN lamellar deposit; `NEOPENTYL GLYCOL DIHEPTANOATE` #6 and `COCO-CAPRYLATE` #5 (esters). Supporting higher classes, all **tail-level**: `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #24 (silane) and the monomeric quats #7/#13.
- threshold_reasoning: "highest class present **as architecture** wins". `permanent_cationic` fails on the architecture qualifier (no silicone quat, no polyquaternium, no cationised protein above the tail) and on this lane's monomeric-quat rule (slot 2). `ph_dependent_cationic` fails (no amodimethicone/amidoamine). `volatile_or_water_soluble` fails — the volatiles are real but the persistent silicone/lamellar residue is what remains.
- attached buildup caution: **yes**, non-quantitative, consistent with the class (G3 rule 4, FS-13).
- limitations: **G11** — the E0 „72H frizz control" figure is a *duration claim* and must not be reused as a persistence duration; no wash counts, no applications-to-buildup, none of the banned circulating removal percentages.

## 7. HOLD — `none`

confidence **moderately_high** · E1/E2 · scope `formula`

- Precise absence pattern: no PVP, VP/VA, VP/Acrylates, polyurethane, PVP/DMAPA or acrylates fixative in 46 ingredients. `HYDROXYETHYLCELLULOSE` #17, `HYDROXYPROPYL GUAR` #18 and `SODIUM STEAROYL LACTYLATE` #19 are rheology/emulsion materials, expressly excluded by the L5 rheology exclusion.
- The self-description "styling cream" does not create a hold route (FS-9 in reverse).

## 8. HEAT — `claim_only` · **`provides_heat_protection = true`** · **REVIEW**

confidence **low** · E0 + E1 · scope `product` + `formula`

- claim_observation (E0): „450ºF/232ºC heat protection" (T1) / „bis zu einer Hitze von 232 °C vor Stylingschäden geschützt" (T2).
- formula_observation: **no member of the closed L9 list.** `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #24 is a silane derivative, not the specific hydrolyzed **wheat** protein of McMullen & Jachowicz; the silicones and `PANTHENOL` #41 are expressly barred (FS-7, FS-24).
- threshold_reasoning: G10 stops this at `claim_only`. `product_tested` requires an exact-product DSC / breakage-after-ironing / tryptophan-loss result with §3.2 metadata; the brand's clinical-results banner declares no dose, damp-vs-dry state, drying method or ambient RH, so under §3.2 it is **downgraded to E2** and cannot reach `product_tested`.
- production projection (§13.3): claim present, no L9 member → `true`, trace `claim_only`, **routed to human review**.
- **FS-14 is the governing false signal.** "232 °C" is a use-condition parameter, not a protection strength; published effect sizes in the anchor studies run at roughly 10–20 % damage reduction and are never expressed in °C. **No `heat_protection_max_c` field exists in this model** (ruling 6) — the 232 °C figure is recorded as a claim string and must not be promoted to a legacy catalog field.
- review_status: `specialist_review_required`

## 9. HUM — `formula_plausible`

confidence **low** (state ceiling) · E2 · scope `formula`

- formula_observations: a **persistent hydrophobic silicone film** (`DIMETHICONE` #3, `PHENYL TRIMETHICONE` #9) with a plausible water-uptake-reduction mechanism.
- Mandatory humectant counter-signal check: `PROPANEDIOL` #10 is present but is a single glycol at moderate rank; `PANTHENOL` #41 and `ALOE BARBADENSIS LEAF JUICE` #40 are tail entries. No dominant humectant architecture.
- threshold_reasoning: `claim_only` would understate a genuine route. `product_tested` requires HHCR/DHCR (high-humidity curl retention at ~26 °C / 90 % RH over 24 h), DVS (0 %→90 % RH weight gain) or humidity-chamber tress imaging **with declared RH, temperature and equilibration time**. The „72H frizz control + humidity resistance" banner declares none of these and is E0 (§3.3: legality implies a dossier, never a test).
- limitations: E2, low confidence; never encode a dew-point threshold (FS-16).

## 10. R2 — `candidate`

confidence **low** · E2 · scope `formula`

- formula_observation: `HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL` #24 — a **silane derivative**, named in the L6 evidence list and in the R2 `candidate` anchor, in a plausible film-forming context.
- counter_signals: position 24 of 46 is well into the sub-1 % region; `PANTHENOL` #41 is expressly excluded by the panthenol rule.
- Hard limits: never converts into structural repair, penetration, strength or a diagnosed "protein need"; ceiling low–moderate, on a supplier-dominated evidence base.

## 11. DOSE — `high` (derived)

confidence **moderate** · `derived_from: [WT=high, FORM=emulsion, L3 spreading class = dry-feel/medium]`

- Fires on the WT limb alone; the rich-band limb does **not** fire (coconut oil is a #46 tail entry). The directions' own „Apply one pump… Mit einem Pumpstoß beginnen. Bei Bedarf mehr verwenden" corroborates a dose-managed product but does not set the value.
- G3: emits a dosing caution, does not modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- `PARFUM` #12 plus `HEXYL CINNAMAL` #21, `LIMONENE` #22, `CITRAL` #23, `LINALOOL` #26, `CITRONELLOL` #27, `HYDROXYCITRONELLAL` #29, `GERANIOL` #32.
- notes: `ISOPROPYL ALCOHOL` #16 is present but mid-list; no material solvent-alcohol note emitted. `IODOPROPYNYL BUTYLCARBAMATE` #28 is recorded as a preservative observation only — **this standard makes no tolerance or sensitisation statement** (§7.12, SR §M.12, G6).

## 13. ROLE — `["post_wash", "refresh", "heat_styling"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „Apply one pump to clean, damp hair" → `post_wash`. „can also be used on dry hair to refresh or touch up a style" → `refresh`. „great when used before air drying or **blow drying**" → `heat_styling` — read from the manufacturer's own authoritative usage guidance, not from the 232 °C claim.
- `curl_styling` not set (the „define air-dried styles" line is a claim, not a technique instruction). `ends_only` not set (the "mid-length to end" phrasing appears in the description, not in the how-to).
- G2: ROLE is an input to fit derivation, never a substitute for one.

## Demoted flags

- `smoothing_shine_qualifier`: `present`.
- `curl_definition_focus`: **not set** — HOLD `none`; the air-dried-definition claim is corroboration with no route behind it (§8.2, FS-8: anti-frizz and curl definition are not the same property).
- **`R3`: `chemistry_candidate` — review flag OPEN.** `BIS-AMINOPROPYL DIGLYCOL DIMALEATE` #11, materially present above the tail, plus the product's own "Bond" naming. **This never sets a repair level from formula alone.** Two independent problems justify the demotion: independent spectroscopy found that **none** of the investigated α,β-unsaturated Michael-acceptor repairing agents increased disulfide content in the hair cortex, and most supportive published work is manufacturer-funded; and bond systems were characterised at salon concentration and contact time, so a leave-in at consumer dose inherits none of that evidence (G8, FS-26). "Bond"/"Plex" naming is E0. Ceiling: flag only.
- LAYER caution: **not emitted** — no high-charge cationic polymer at architecture level.
- Buildup caution: **emitted**. Transfer caution: **not emitted**.

## care_direction — `moisture`

confidence **moderate** · E2 · scope `formula`

- A coherent L1 (LGN cationic) + L3 (dry-feel and medium esters) + L4 (`PROPANEDIOL` #10) architecture is the material direction. `protein` fails on materiality — the silane sits at #24, i.e. more than a tail entry is not satisfied. `balanced` requires a substantive mixed architecture in both directions.
- Constraint honoured: `care_direction` does **not** drive weight, persistence, hold or heat here — and specifically does not soften the R3 review flag.

## Lean matching profile

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "smoothing", "secondary": ["repair", "heat_styling"] },
  "usage_role": ["post_wash", "refresh", "heat_styling"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "conditional", "moderately_damaged": "recommended", "highly_damaged": "recommended" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["focus.primary", "specialist_functions.provides_heat_protection"]
}
```

**Focus derivation — `primary` marked uncertain (§10.2 rule 5).** `smoothing` (SFR `high`, resting on `DIMETHICONE` #3 and the LGN deposit — architecture level) and `repair` (R3 `chemistry_candidate` at #11 with its review flag open, plus R2 `candidate` at #24) are both plausible purposes. This lane takes `smoothing` as primary on rank and evidence strength, and `repair` as a secondary that carries the open bond-review flag rather than a repair level. `heat_styling` takes the second secondary slot: HEAT ≥ `claim_only` **and** ROLE ∋ `heat_styling` are both met, and it sets a use context only. `curl_definition`, `detangling`, `volume_lightness` and `shine` all fail.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=high, product_form=emulsion]`: formula (LGN pair above the tail) → product property (high residue/coating potential, tempered by a volatile-heavy top of list) → fit. Fine = `caution`, carrying the §17.11 judgment-call label.
- `damage_fit` ← `[conditioning_level=high, repair_surface_film=candidate, bond_flag=chemistry_candidate (review flag open), product_evidence=none]` → **row 3**, on the "named bond chemistry with an open review flag" limb, which the standard grants explicitly. This is the **only** row-3 record in the gold set. Note the asymmetry worth adjudicating: an unproven bond chemistry unlocks the damage upgrade, while slot 9's genuine silane film route does not — because slot 9 cannot reach `conditioning_level = high`.
- `texture_fit` ← `[weight_potential=high, slip=high, hold_route_state=none]` → row 3.
- `scalp_application_fit` ← the how-to specifies no placement → `unknown`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- WT `high`: „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren."
- DOSE `high`: „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig."
- HEAT claim without L9 member: „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das."
- R3 `claim_only`/`chemistry_candidate`: „Bond-Technologie ist ausgelobt. Unabhängige Belege für einen Struktureffekt im Haar fehlen."
- R2 `candidate`: „Enthält einen Protein-Film-Baustein, der sich aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur."
- PERS + buildup: „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
- EXPO: „Enthält deklarierte Duftstoffe."
