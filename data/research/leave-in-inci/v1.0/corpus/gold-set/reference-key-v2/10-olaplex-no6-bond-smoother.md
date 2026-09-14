# S10 — Olaplex N°.6 Bond Smoother

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 10 · 100 ml · GTIN **unresolved** (896364002602 / 896364002619) · `formulaFingerprintSha256` 297ac0d9…2aa3

---

## G1 — identity, directions and claims

| Item | Value |
|---|---|
| Identity status | `provisional_identity_conflict` |
| Preserved conflicts (G5) | (a) Two GTINs circulate (legacy vs "new packaging"); douglas.de exposes neither. (b) Ingredient-count variance 46 vs 47 between the packet's capture and the source lane report; the first 13 ingredients match the T2 capture exactly. Both preserved, not resolved. |
| Packet directions | "Apply one pump to clean, damp hair. Comb through & style as desired." — olaplex.com, region unconfirmed, **C5** under RC-2 |
| **C2 directions captured this pass** | „1. Einen Pumpstoß auf das saubere, feuchte Haar auftragen. 2. Durchkämmen und wie gewünscht stylen." — **olaplex.de**, the manufacturer's German page, retrieved 2026-09-04. Content-identical to the English text. |
| Rinse test (R11) | **PASS** — no rinse instruction in either capture; the manufacturer's own FAQ names it "an out-of-shower leave-in treatment and styling product". |

**Claim capture performed this pass.**

| Field | Tier | Verbatim | Source |
|---|---|---|---|
| HEAT | **C2** | „Hitzeschutz bei 450ºF/232ºC" | olaplex.de, retrieved 2026-09-04. Explicitly **not** conditioned on system use, so §2.4.1 rule 4 (`claim_scope: system_level`) does not apply |
| HUM | **C2** | „Bändigt krauses Haar bis zu 72 Stunden lang mit dieser feuchtigkeitsbeständigen Formel" | same |
| R3 (bond) | **C2** | The product is sold as a "Bond Smoother"; the bond chemistry Bis-Aminopropyl Diglycol Dimaleate is declared at rank 11 | same |

## G0 — product form

`in_category`. Water leads; the C2 directions leave the product on the hair; conditioning/smoothing is primary. Not styling-first (no L5 fixative-class polymer).

## Reading conventions applied

**Tail marker (§3.1.1):** `Phenoxyethanol`, **rank 14** of 46. Above the tail: ranks 1–13. Decisive consequence: **HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL at rank 24 is a tail member.**

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `lgn`, trace-only)
confidence **high** · E2. CETEARYL ALCOHOL (2) paired with BEHENTRIMONIUM CHLORIDE (7) — an LGN pair at the top of the list — carrying a substantial silicone, volatile and ester phase: DIMETHICONE (3), ISOHEXADECANE (4), COCO-CAPRYLATE (5), NEOPENTYL GLYCOL DIHEPTANOATE (6), ISODODECANE (8), PHENYL TRIMETHICONE (9); GLYCERYL STEARATE (15) is an additional emulsifier. Decision order: not anhydrous; not `two_phase` (a true emulsifying system is present); `emulsion` matches sub-type (a). review_status `approved`. `presentation_form`: Cream.

### 2. COND — `high`
confidence **moderately_high** (ceiling) · E2. LGN pair above the tail (2 + 7) plus several further independent lubrication routes: persistent silicones DIMETHICONE (3) and PHENYL TRIMETHICONE (9); dry-feel/medium esters COCO-CAPRYLATE (5) and NEOPENTYL GLYCOL DIHEPTANOATE (6); a second monomeric quat, CETRIMONIUM CHLORIDE (13). `low` excluded; `moderate` excluded (a full LGN pair exists). Multiple independent observations with no material counter-signal, so the top value at E2 is permitted (§6 rule 3).
**counter_signals** ISOHEXADECANE (4) and ISODODECANE (8) are **volatile hydrocarbons** — they aid spreading and dry-down and contribute **nothing** to residue or persistence (M6, FS-4). They were excluded from every deposit-based reading. COCOS NUCIFERA OIL sits at rank 46, the last position, and was not used: FS-19 explicitly bars the coconut-oil inference, and the Rele & Mohile protocol was a pre-/post-wash oil treatment barred by G8.
shared_mechanism `M1`. review_status `approved`.

### 3. SLIP — `high`, bias `unknown`
confidence moderate (ceiling) · E2. Two independent M1 contributors: the cationic LGN route (2 + 7 + 13) and a persistent silicone/ester lubricant package (3, 5, 6, 9). Bias `unknown`: the architecture combines volatile carriers (4, 8), a persistent film (3, 9), an LGN pair and a water-phase humectant (Propanediol 10) — `wet_biased` requires no persistent film, `dry_biased` requires few water-phase agents, and `both` is defined through the wet route. None fits (§17.16). review_status `provisional`.

### 4. SFR — `high`
confidence moderate (ceiling) · E2. Continuous surface-film route: DIMETHICONE (3) and PHENYL TRIMETHICONE (9), persistent silicones both above the tail. Distinct lubricating species: COCO-CAPRYLATE (5), NEOPENTYL GLYCOL DIHEPTANOATE (6) and the LGN phase. RC-4 satisfied on several distinct observations. `moderate` would be a single alignment route. The silicone package sits at rank 3 — ahead of the cationic surfactant — so it reads as a **dedicated** smoothing system rather than a by-product of the LGN conditioning (RC-5), which is why `smoothing` qualifies as a focus below. Ambient smoothing only (§7.4). review_status `approved`.

### 5. WT — `high`
confidence **moderately_high** · E2. `high` limb 1 satisfied: an **LGN pair present as architecture** — Cetearyl Alcohol (2) + Behentrimonium Chloride (7), plus Glyceryl Stearate (15) and a second quat.
**counter_signals** Limb 2 is **not** satisfied: no enumerated rich/low-spreading band member is present as architecture. Coconut oil is declared but at rank 46, the final position, deep in the tail; Vitis Vinifera Seed Oil (39) and Helianthus Annuus Seed Oil (35) are likewise tail members and are in any case **unenumerated** liquid vegetable oils read in the medium band by the §7.5 convention. The value rests entirely on the LGN limb.
**second counter-signal** Two volatile hydrocarbons at ranks 4 and 8 mean a material fraction of the applied product evaporates; M6 contributes nothing to WT, and the anchor was not softened for it — but the observation is recorded, since it is the honest reason a user may perceive this cream as lighter than a WT `high` suggests.
**threshold_reasoning** `moderate` excluded by the LGN pair. Confidence `moderately_high`: FORM resolves definitely and the non-volatile architecture is fully readable above the tail. G9 checked: neither the cream presentation nor the "Smoother" name contributed (FS-2). review_status `approved`.

Transfer caution: not attached — no low-spreading non-volatile lipid is present as architecture.

### 6. PERS — `neutral_non_volatile`
confidence moderate · E2.
**formula_observations** Above the tail: DIMETHICONE (3), PHENYL TRIMETHICONE (9), CETEARYL ALCOHOL (2), the esters (5, 6) — neutral non-volatiles — plus **BEHENTRIMONIUM CHLORIDE (7)** and **CETRIMONIUM CHLORIDE (13)**, monomeric long-chain quats.
**counter_signals** No `Polyquaternium-x`, no `Silicone Quaternium-x`, no Quaternium-80, no cationised protein is declared. HYDROXYPROPYL GUAR (18) is **not** quaternised — the `permanent_cationic` anchor names *Hydroxypropyl Guar Hydroxypropyltrimonium Chloride*, a different material — so it does not promote the class. No amodimethicone or amidoamine, so `ph_dependent_cationic` is unreachable.
**Monomeric-quat note (recorded).** Two monomeric long-chain quats are materially present at ranks 7 and 13. Dimethicone at rank 3 arguably outranks them as the dominant persistent species, so §7.6's note is not strictly mandatory; it is recorded anyway because the quats are co-dominant: *"Persistence rests in part on monomeric long-chain quats: permanently charged, so more substantive than a neutral deposit, but small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a duration (G11)."*
**threshold_reasoning** `volatile_or_water_soluble` is excluded — §7.6 forbids dropping a monomeric long-chain quat there when it is a materially persistent species, which was v0.1's damaging default.
**limitations** G11; banned removal percentages not used. review_status `approved`.

Buildup caution: not emitted (projection `moderate`).

### 7. HOLD — `none`
confidence moderate · E1. No L5 fixative-class polymer. HYDROXYETHYLCELLULOSE (17) and HYDROXYPROPYL GUAR (18) are named **rheology exclusions** under §5's L5 rule — bottle viscosity, not a hold route (FS-25). review_status `approved`.

### 8. HEAT — trace `claim_only` → binary **`provides_heat_protection: true`**
confidence moderate · E0.
**claim authority** A **C2** claim exists on olaplex.de: „Hitzeschutz bei 450ºF/232ºC", presented as a standalone product benefit, not conditioned on system use — so `claim_scope: system_level` and the §17.13 open item do **not** apply here.
**formula_observations** L9 closed-list check across all 46 ingredients: **no L9 member.** Not the bond active, not the silicones, not the silane protein, not panthenol.
**threshold_reasoning** §13.3: claim present, no L9 member ⇒ binary **`true`**, trace **`claim_only`**, route to review with a "claim looks formula-unsupported" note.
**Hard prohibitions observed.** The 232 °C / 450 °F figure is a marketing **use-condition** parameter and is **not** promoted into any field — `heat_protection_max_c` does not exist in this model (ruling 6). Reading it as a protection *strength* is FS-14; published effect sizes are on the order of 10–20 % damage reduction and are not expressed in °C. No efficacy grade of any kind is emitted (G10). review_status `provisional`; **routed**.

### 9. HUM — `formula_plausible`
confidence **low** (no formula-only route above `low`) · E2.
**formula_observations** A hydrophobic, continuous film-forming route present as architecture: DIMETHICONE (3) and PHENYL TRIMETHICONE (9), both above the tail.
**counter_signals (MANDATORY, §4)** Humectant observation: PROPANEDIOL at **rank 10**, above the tail. Assessed against §7.9's two-step rule: it is a **single** humectant member, and the water phase's material direction is the emulsion and the silicone package rather than a humectant leg — so it is *materially present but not dominant*. It therefore does **not** block the state, its observation is recorded as required, and **confidence is capped at `low`**. It never raises the state and never raises confidence.
**Glycols-are-not-automatically-humectants check (§7.9 v0.2):** Propanediol at rank 10 sits immediately before the bond active at rank 11 and could plausibly be its solvent. The formula does not settle it, so the **conservative humectant reading was taken** (it lowers the state) and the field's reasoning records the choice. Under the solvent reading the humectant leg would be empty and the state would be unchanged.
**claim note** A **C2** anti-frizz/humidity claim exists („Bändigt krauses Haar bis zu 72 Stunden … feuchtigkeitsbeständigen Formel"). Under §7.9 the claim is **not** required for `formula_plausible` and does not raise it either; the route decides the state.
**projection consequence and a recorded gap.** §18 carries a German string for HUM `claim_only` and explicitly none for a *claim-free* `formula_plausible`. It carries **no string at all for a claimed `formula_plausible`**, which is this record's state — so a C2 72-hour anti-frizz claim reaches the user with no accompanying honesty string. Recorded as a §18 gap.
**threshold_reasoning** `not_claimed` requires no claim *and* no route — both fail. `claim_only` would be the state only without a qualifying route. `product_tested` requires HHCR/DHCR (~26 °C / 90 % RH over 24 h), DVS or humidity-chamber imaging on the exact product with declared RH, temperature and equilibration time — the "72 hours" figure is marketing, not a declared protocol, and is E0. review_status `provisional`.

### 10. R2 — `none_visible` — **uncertain**
confidence low_moderate · E1.
**formula_observations** HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL at **rank 24** — a silane derivative, and therefore on §7.10's closed `candidate` list — but **ten positions below the tail marker at rank 14**.
**threshold_reasoning** `candidate` requires the route to be "present as architecture (§3.1.1) **in a plausible film context**". The rank prong fails clearly here (unlike slot 9, where the marker was unusable): the marker sits at a sensible rank 14 in a 46-ingredient list, and the silane is a tail member among tocopherols, EDTA and fragrance allergens. The architecture prong also reads against it — nothing in the product's own C2 positioning names the silane; the named active is the bond chemistry.
**Recorded gap:** §7.10's `none_visible` anchor enumerates gums, starches, rheology polymers, panthenol, **plain** hydrolysates at any position, and non-silicone cationic polymers. It has **no row for a *qualifying* route sitting below the tail**. `none_visible` was taken with the observation recorded and the field marked uncertain; `unknown` is the defensible alternative.
**Consequence if reversed:** `candidate` would open `damage_fit` row 3b (highly_damaged `recommended`), make `repair` an available focus, set `care_direction` toward `protein`/`balanced`, and emit the §18 R2 string. Routed.
**Mandatory trace note:** PANTHENOL (41) is a fibre-mechanics signal, not an R2 route and not a heat route (FS-24). review_status `provisional`.

### 11. DOSE — `high` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. WT = `high` sets the row directly. review_status `approved`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (12) plus declared allergens HEXYL CINNAMAL (21), LIMONENE (22), CITRAL (23), LINALOOL (26), CITRONELLOL (27), HYDROXYCITRONELLAL (29), GERANIOL (32). ISOPROPYL ALCOHOL (16) is declared but is not the `Alcohol`/`Alcohol Denat.` of §7.12 and sits below the marker; no alcohol note emitted. IODOPROPYNYL BUTYLCARBAMATE (28) is a preservative, recorded, not an L8 signal. G6 applies. review_status `approved`.

### 13. ROLE — `[post_wash]`
confidence moderate · E1 · scope directions · **C2 source captured this pass**.
- `post_wash` ← „Einen Pumpstoß auf das **saubere, feuchte Haar** auftragen." (olaplex.de, C2, 2026-09-04)
**Not taken:** `heat_styling` — „wie gewünscht stylen" names no heat tool, and the C2 „Hitzeschutz bei 232 ºC" is a **claim, not a direction** (§7.13). `refresh` — the manufacturer FAQ's "can also be used on dry hair to refresh or touch up a style" would establish it, but the FAQ text captured in the packet is from the region-unconfirmed English site (**C5**), and the C2 German product page's numbered directions do not carry it; recorded in `supporting_signals[]` with its tier and **not** emitted. `ends_only`, `curl_styling` — nothing establishes them.
**Note on the pass:** capturing the C2 German page moved this field from `[]` (packet C5 only) to `[post_wash]`. review_status `approved`.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 consequence of the silicone alignment film; no independent value, no goniophotometry (FS-23) |
| CURL | `none` (low) | HOLD = `none` |
| **R3** | **`chemistry_candidate`** (moderate, E1) | BIS-AMINOPROPYL DIGLYCOL DIMALEATE at **rank 11**, above the tail, plus a C2 bond claim — a **recognised chemistry**, so the flag is `chemistry_candidate` and it opens an L7 **review flag**. It **never sets a repair level** from formula alone. Two independent reasons (§8.3): independent spectroscopy found **no** increase in cortical disulfide content after treatment with α,β-unsaturated Michael-acceptor repairing agents, and most supportive work is manufacturer-funded; and bond systems were characterised at salon concentrations and contact times, so a leave-in at consumer dose inherits **none** of that evidence (G8, FS-26). "Plex"/"Bond" naming is E0 |
| LAYER | no string emitted | No cationic polymer; the monomeric quats are the only cationics |
| Buildup caution | not emitted | PERS projects `moderate` |

## §9 care_direction — `moisture`

confidence moderate · E2. L1 (Behentrimonium Chloride 7, Cetrimonium Chloride 13), L3 (Coco-Caprylate 5, Neopentyl Glycol Diheptanoate 6) and L4 (Propanediol 10) are present as architecture above the tail, with no protein-film route (R2 `none_visible`). `protein` requires R2 ∈ {candidate, tested}. `balanced` requires both halves above the tail. `unknown` — the silicone-led abstention — was tested and **not** taken: silicones are prominent (ranks 3 and 9), but the LGN pair leads the formula and material L1/L3/L4 legs all sit above the tail, so §9's condition ("no R2 route **and** no material humectant/emollient leg") is not met.
**Constraint 3 exercised head-on:** the product is sold entirely on bond technology. **Marketing direction never sets the value**, and bond chemistry is not a protein/silane film route in §9's vocabulary — the positioning is recorded as a counter-signal, never as a route. Constraint 1 observed.

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
  "focus": { "primary": "smoothing", "secondary": [] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren.",
    "Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig.",
    "Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das.",
    "Enthält deklarierte Duftstoffe."
  ],
  "uncertain_fields": ["repair_surface_film"],
  "assumption_notes": [
    "R3 = chemistry_candidate is a review flag only; it is invisible to damage_fit and cannot set a repair focus (R14).",
    "§18 has no string for R3 = chemistry_candidate, so the C2 bond claim is not qualified to the user."
  ]
}
```

**Focus selection (§10.2).** Qualifying routes: `smoothing` — SFR `high` on a dedicated silicone film package at ranks 3 and 9, ahead of the cationic surfactant, so it is not merely the LGN emulsion's by-product (RC-5); two independent endpoint-relevant observations. `repair` — **not available.** R2 is `none_visible`; the marketing position names a bond chemistry, not a protein or silane active, so §10.2's second limb is not met either; and **R14 is explicit that `R3 = chemistry_candidate` alone may never set `repair` as primary**. As a *secondary*, R3 would require an independent moderate-or-better observation, which the below-tail silane is not. `heat_styling` — HEAT `claim_only` clears, but ROLE has no `heat_styling` sentence. `detangling`, `volume_lightness` — need WT `low`. `curl_definition` — HOLD `none`. `shine` — restates the film (G3).
⇒ **`primary: smoothing`**, secondary `[]`. Positioning („Bond **Smoother**") corroborates; it was not needed and never creates a route.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `high`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2**, and this is R14 working exactly as ruled. COND is `high`, but row 3a additionally requires a qualifying specialist route — a distinct L6 substantive film route or a §3.2-compliant exact-product test — and the only candidate silane is a tail member; row 3b requires R2 ∈ {candidate, tested}. **The R3 bond flag is invisible to this table**: "a product with an R3 flag and no R2 route sits in row 1 or row 2 on its conditioning level like any other product." The bond product therefore reaches `highly_damaged: conditional`, not `recommended`.
- `texture_fit` ← **row 3** (`weight_potential = high` **and** SLIP `high`).
- `scalp_application_fit` ← ordered test: **`avoid`** on the EXPO trigger `aromatic_or_allergen_exposure`. The C2 directions state no placement.

## §14 review routing

1. **Proprietary bond/repair claim — `R3 = chemistry_candidate`** (§14, L7).
2. **Heat-protection claim with no L9 member** (§13.3, §14).
3. **GTIN unresolved** — two candidates (§14); ingredient-count variance 46 vs 47 preserved.
4. **R2 below the tail** — §7.10 has no anchor row for a qualifying route sitting below the tail marker; `none_visible` taken and marked uncertain. Reversing it moves `damage_fit`, `care_direction`, the availability of a `repair` focus and one §18 string.
5. **§18 copy gap** — no German string exists for `R3 = chemistry_candidate`; §18 provides one only for `R3 = claim_only`. The product's C2 bond claim therefore reaches the user without the honesty qualifier §8.3's whole reasoning demands.
6. **§18 copy gap (second)** — no string exists for a *claimed* HUM `formula_plausible`; §18 covers `claim_only` and deliberately covers nothing for the claim-free case.
