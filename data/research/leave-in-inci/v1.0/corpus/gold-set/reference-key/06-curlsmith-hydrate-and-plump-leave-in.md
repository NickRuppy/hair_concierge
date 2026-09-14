# Slot 6 — Curlsmith Hydrate & Plump Leave-In (237 ml)

- `category_standard_version`: `leave-in-inci-v0.1` · `engine_run`: `reference-key-2026-09-03`
- `archetype_role` (packet): Silicone-free cationic/polymeric
- `gtin`: **none found** (documented G1 identity gap) · `market`: DE · `identity_status`: `verified`
- `rawInciSha256` = `formulaFingerprintSha256`: `ff00c63494a7ff41c090a65fe8d29f87745577158ada42ccababa814434e367f`
- `review_routing`: **routed to human review** — absent exact-market identifier (§14: "an absent exact-market formula/identifier").

## Sources

| Ref | Tier | Content |
|---|---|---|
| `S6-dir` | T2 (lockenbox.com, exact-pack German/EU curl specialty retailer; carried in the packet) | „Start with a hazelnut-sized amount of the leave-in conditioner and distribute it in your hands. Work the conditioner into your **wet hair**, adjusting the amount used according to the length of your hair if necessary. **Style your curls as usual** to shape them and increase bounce. **Use a gel and/or mousse to finish** your styling routine." |

No manufacturer-page claim capture was added by this lane; the product name („Hydrate & Plump") and the retailer directions are the only positioning evidence, and both are corroboration only.

---

## G0 — `in_category`

confidence **high** · E1 + E2 · scope `directions`

- `WATER (AQUA/EAU)` #1; the directions describe application to wet hair with no rinse step and explicitly name it a leave-in conditioner; conditioning is primary and curl styling is a follow-up with **separate** products.
- threshold_reasoning: `excluded_styling_first` fails on its second limb — although a fixative-class polymer is present (`PVP` #32), the conditioning architecture is not thin: an LGN pair leads the formula. §2.2 includes "curl creams when conditioning/definition is central and hold remains secondary", which is exactly this record.

## 1. FORM — `emulsion`

confidence **high** · E2 · scope `formula`

- **LGN pair**: `CETEARYL ALCOHOL` #3 **plus** `BEHENTRIMONIUM CHLORIDE` #6, both far above the tail.
- threshold_reasoning: the cationic-surfactant + fatty-alcohol lamellar pair is the exact anchor. `aqueous_or_hydroalcoholic_solution` fails (LGN pair present). `microemulsion` fails (no PEG-ester battery; an LGN pair is present). `two_phase` fails (an emulsion system exists; no shake direction).
- G9: never sets WT. `presentation_form` (metadata): Leave-in cream/lotion.

## 2. COND — `high`

confidence **moderately_high** (ceiling) · E2 · scope `formula`

- formula_observations: LGN pair (#3 + #6) **plus** multiple further independent lubrication routes — `DICAPRYLYL CARBONATE` #2 and `COCO-CAPRYLATE/CAPRATE` #4 (dry-feel band), `RICINUS COMMUNIS (CASTOR) SEED OIL` #5 and `BUTYROSPERMUM PARKII (SHEA) BUTTER` #9 (rich/low-spreading band), `SIMMONDSIA CHINENSIS (JOJOBA) SEED OIL` #10 (medium band), and cationic polymers `GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE` #11 + `POLYQUATERNIUM-10` #12.
- threshold_reasoning: the `high` anchor's necessary LGN limb is met and the "at least one further independent lubrication route" limb is met several times over at architecture level (#2, #4, #5, #9). G3 rule 3's condition for a top value at E2 — multiple independent, endpoint-relevant observations with no material counter-signal — is satisfied.
- Fatty-alcohol discipline: `CETEARYL ALCOHOL` is consumed by the L1 lamellar pair and is **not** counted again as a hero emollient.
- limitations: G4; R1 folded in.

## 3. SLIP — `high`, bias `dry_biased`

confidence **moderate** (value) / **low** (bias) · E2 · scope `formula`

- Two or more independent M1 contributors as architecture: the cationic LGN deposit, the emollient package, and two cationic polymers.
- Bias: `wet_biased` fails (a persistent lamellar/polymer deposit exists). `both` fails — **no volatile carrier of any kind** is present. `dry_biased` fits by elimination; confidence low because the directions place application on wet hair, where cationic wet-slip is classically strongest and the formula-only bias rule cannot see it.
- limitations: SR §M.5 — the WET+DRY merge is provisional and this record is a good example of why.

## 4. SFR — `moderate` · SHN qualifier `absent`

confidence **moderate** · E2 · scope `formula`

- Absence pattern: **no silicone at any position**. The candidate continuous film is the cationic-polymer pair `GUAR HPTC` #11 / `POLYQUATERNIUM-10` #12 — but these are **L1 route members feeding the same `M1_DEPOSITION_SURFACE_LUBRICATION` mechanism** already counted at maximum in COND and SLIP.
- threshold_reasoning: G3 requires the top SFR value to rest on an endpoint-relevant *additional* observation, not a restatement of the M1 deposit. None exists. `low` fails (a real emollient alignment route is present). → `moderate`.
- SHN `absent`.

## 5. WT — `high`

confidence **moderately_high** · E2 · scope `formula`

- formula_observations: **LGN pair** `CETEARYL ALCOHOL` #3 + `BEHENTRIMONIUM CHLORIDE` #6 → the anchor's first limb fires on its own; independently, two or more persistent non-volatile families are present **with rich/low-spreading band members**: `RICINUS COMMUNIS (CASTOR) SEED OIL` #5 and `BUTYROSPERMUM PARKII (SHEA) BUTTER` #9.
- threshold_reasoning: both `high` limbs fire. `moderate` is explicitly excluded by "no LGN pair combined with rich-band lipids".
- Ceiling raised to **moderately_high**: FORM is a definite architecture and the non-volatile architecture is fully readable above the 1 % tail (#2–#12).
- counter_signals: `DICAPRYLYL CARBONATE` #2 and `COCO-CAPRYLATE/CAPRATE` #4 are dry-feel/high-spreading and soften the perceived weight; they do not lower the residue load.
- attached transfer caution: **yes** — castor oil and shea butter are the textbook low-spreading, non-volatile, non-film-forming load (SR §D.3, qualitative only).
- limitations: §17.11 fine-hair judgment call. FS-3 explicitly rejected: silicone-free does **not** mean low weight.

## 6. PERS — `permanent_cationic`

confidence **low** · E2 · scope `formula`

- formula_observations: `GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE` #11 and `POLYQUATERNIUM-10` #12 — permanently quaternised **cationic polymers** present as architecture (ahead of every botanical extract in a 40-item list). Supporting lower classes: the LGN lamellar deposit and the non-volatile lipids (`neutral_non_volatile`); `BEHENTRIMONIUM CHLORIDE` #6 (monomeric quat).
- threshold_reasoning: "highest class present as architecture wins". This lane treats **polymeric** permanent quats as `permanent_cationic` (the anchor's family), while monomeric quats alone do not reach it (see the slot-2 anchor-gap note). `ph_dependent_cationic` fails — no amodimethicone/amidoamine. Confidence is **low** because charge density is the actual lever and is not readable from an INCI name (G4).
- attached buildup caution: **yes**, non-quantitative, and it must not contradict PERS (G3 rule 4). **FS-20 is the governing false signal here: silicone-free plus a cationic polymer is not low buildup** — high-charge-density polyquaterniums are among the most substantive materials in the category.
- limitations: G11 — no wash counts, durations or applications-to-buildup; none of the banned circulating removal percentages.

## 7. HOLD — `incidental_film`

confidence **moderate** · E2 · scope `formula`

- formula_observations: `PVP` #32 — a genuine L5 fixative-class polymer — sitting behind an LGN pair, five emollients and two cationic polymers. `CYAMOPSIS TETRAGONOLOBA (GUAR) GUM` #33 is captured by the L5 rheology exclusion (FS-25).
- threshold_reasoning: `none` fails because a real fixative is present. `meaningful_hold_route` requires **thin or absent** conditioning architecture behind the polymer — the opposite is true here, and COND is `high`. `incidental_film` is the exact anchor: "a fixative-class polymer is present but a substantive conditioning architecture dominates". No G0 styling review is triggered.
- FS-9 honoured: the hold polymer is not read as conditioning or repair, and the conditioning architecture is not read as hold.
- Hold **level** is not readable and no graded value is emitted (§7.7).

## 8. HEAT — `not_claimed` · `provides_heat_protection = false`

confidence **moderate** · E0/E1 · scope `product` + `formula`

- No heat claim surfaced. No member of the closed L9 list: **plain `PVP` is not on it** (the list carries VP/Acrylates/Lauryl Methacrylate Copolymer and PVP/DMAPA Acrylates Copolymer — different polymers), and `PANTHENOL` #8 is expressly barred (FS-24).
- `formula_plausible` unreachable (G10). A formula never manufactures a claim (§13.3). Confidence held at moderate because the claim search for this SKU was less complete than for the retailer-listed German products.

## 9. HUM — `not_claimed`

confidence **moderate** · E1/E2 · scope `formula` + `product`

- No humidity/anti-frizz claim surfaced. Mandatory counter-signal: `GLYCERIN` #7 and `PANTHENOL` #8 are materially present.
- `formula_plausible` additionally fails on mechanism: there is **no hydrophobic continuous film route** (no silicone, no hydrophobic fixative), and `PVP` is the *worst* candidate — it is hygroscopic and loses film stiffness as RH rises (SR §F.1). Never encode a dew-point threshold (FS-16).

## 10. R2 — `none_visible`

confidence **moderate** · E2 · scope `formula`

- Precise absence pattern: **no protein, peptide, silane derivative or silicone quat anywhere in the 40-item list.** `PANTHENOL` #8 is explicitly excluded by the panthenol rule.
- The only candidates are the cationic polymers `GUAR HPTC` #11 / `POLYQUATERNIUM-10` #12, whose charge density is unreadable from INCI (G4). §10.2 and §10.3 both state that a **generic cationic polymer alone** cannot set a repair focus or a damage-fit upgrade; recording `candidate` here would manufacture a downstream signal the standard forbids elsewhere in the same document.
- **Rule tension surfaced:** §7.10's `candidate` anchor lists "high-charge cationic polymer", but "high-charge" is precisely the unreadable property. This lane resolves it conservatively toward `none_visible` and flags it.

## 11. DOSE — `high` (derived)

confidence **moderate** · `derived_from: [WT=high, FORM=emulsion, L3 spreading class = rich band present]`

- Two limbs fire (WT `high`; castor/shea materially present). The directions' own dosing language („a hazelnut-sized amount, adjusting … according to the length of your hair") corroborates a dose-sensitive product but does not set the value.
- G3: emits a dosing caution; does not modify `hair_thickness_fit`.

## 12. EXPO — `aromatic_or_allergen_exposure`

confidence **moderate** · E1 · scope `formula`

- **No `PARFUM` entry exists**, yet two EU-labelled fragrance allergens are declared: `HYDROXYCITRONELLAL` #39 and `CITRONELLOL` #40. Plus clearly aromatic botanicals (`CITRUS LIMON (LEMON) PEEL EXTRACT` #19, `ROSMARINUS OFFICINALIS` #24, `PINUS SYLVESTRIS BUD EXTRACT` #23).
- threshold_reasoning: `no_listed_fragrance_signal` is **wrong** here despite the missing Parfum line — declared allergens are exactly the aromatic exposure the L8 route exists to record. `fragrance_declared` understates it.
- notes: `ISOPROPYL ALCOHOL` #27 is present but deep in the list; no material solvent-alcohol note emitted.
- G6 applies; exposure ≠ tolerance.

## 13. ROLE — `["post_wash", "curl_styling"]`

confidence **moderately_high** · **E1 (directions)** · scope `directions`

- „Work the conditioner into your wet hair" → `post_wash`. „Style your curls as usual to shape them and increase bounce" → `curl_styling`.
- `refresh` rejected — no dry-hair use is described. `heat_styling` rejected — no heat tool appears; the directions name a gel/mousse finish instead. `ends_only` rejected — no placement restriction.
- G2: ROLE is an input to fit derivation, never a substitute for one.

## Demoted flags

- `smoothing_shine_qualifier`: `absent`.
- `curl_definition_focus`: **derived and set** — from HOLD (`incidental_film`) + COND (`high`) + WT (`high`). Confidence from formula alone is **low** by construction: no formula → curl-definition mapping exists in the literature, and technique (scrunching, plopping, diffusing) is a large uncontrolled term (SR §K CURL, §M.6). The curl branding corroborates only.
- `R3`: `unknown`.
- **LAYER caution: emitted** — the directions instruct finishing with a gel and/or mousse, which are commonly anionic, over a formula carrying two high-substantivity cationic polymers. Caution string only; **no compatibility matrix, no numeric score, no product-to-product verdict** (§8.4, SR §M.4).
- Buildup caution: **emitted**. Transfer caution: **emitted**.

## care_direction — `moisture`

confidence **moderate** · E2 · scope `formula`

- A coherent L1 (LGN + cationic polymers) + L3 (five emollients) + L4 (glycerin, panthenol) architecture is the material direction, with **no** dominant protein-film route (R2 `none_visible`).
- Constraints honoured: panthenol alone never sets `protein`; a humectant name alone did not set `moisture` — the route did. `care_direction` does not drive weight, persistence, hold or heat here.

## Lean matching profile

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "high",
  "hold_support": "incidental",
  "care_direction": "moisture",
  "focus": { "primary": "curl_definition", "secondary": [] },
  "usage_role": ["post_wash", "curl_styling"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": []
}
```

**Focus derivation.** `curl_definition` = HOLD ∈ {`incidental_film`, `meaningful_hold_route`} **plus** compatible COND/WT — met: `incidental_film` with COND `high` and WT `high` is a conditioning-led definition architecture, and the ROLE read (`curl_styling`, from directions at E1) plus the curl positioning corroborate. It is set on the route, not on the branding (§10.2 rule 4). `detangling` fails (SLIP is `high` but the bias is `dry_biased`). `smoothing` fails (SFR `moderate` under G3). `volume_lightness` fails (WT `high`). `repair`, `heat_styling`, `shine` all fail. No secondary adds useful matching information beyond `curl_definition`.

**Fit chains.**
- `hair_thickness_fit` ← `[weight_potential=high, product_form=emulsion]`: formula (LGN pair + castor/shea above the tail) → product property (high residue/coating potential) → fit. Fine = `caution`, carrying the §17.11 judgment-call label.
- `damage_fit` ← `[conditioning_level=high, repair_surface_film=none_visible, bond_flag=none, product_evidence=none]` → row 2, **not** row 3: the third row explicitly refuses a "cationic polymer" as a qualifying specialist route.
- `texture_fit` ← `[weight_potential=high, slip=high, hold_route_state=incidental_film]` → row 3. Note `hold_route_state` did **not** raise curly/coily on its own (§10.3).
- `scalp_application_fit` ← directions are silent about placement → `unknown`. Never from an ingredient read; G6 applies.

## German copy emitted (§18)

- WT `high`: „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren."
- DOSE `high`: „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig."
- PERS `high` + buildup: „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab."
- LAYER: „Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen."
- EXPO: „Enthält deklarierte Duftstoffe."
- `scalp_application_fit = unknown`: „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
