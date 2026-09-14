# S9 — Redken Extreme Anti-Snap Leave-In Treatment

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 9 · 250 ml · GTIN **unresolved** (884486453402 / 884486210777) · `formulaFingerprintSha256` 239f65c8…f100

---

## G1 — identity, directions and claims

| Item | Value |
|---|---|
| Identity status | `provisional_identity_conflict` |
| Preserved conflict (G5) | Two independently corroborated GTINs circulate; douglas.de exposes neither. Both recorded, not merged or guessed. A GTIN may survive reformulation and a formula may survive a GTIN change — the two are related but separate (§2.4). The conflict affects identity, not the readable architecture, so no property was blanked (G5 "lower the smallest affected scope"). |
| Packet directions | „Auf einzelne brüchige Haarstellen oder auf dem ganzen Haar verteilen und einmassieren. Ohne ausspülen, direkt die Haare wie gewohnt stylen." — douglas.de, **C3** |
| **C2 directions captured this pass** | „Nach dem Extreme Shampoo und Conditioner anwenden. Ins handtuchtrockenen Haar geben. Nicht ausspülen. Wie gewohnt stylen." — redken.eu/de-de, the manufacturer's German-market page, retrieved 2026-09-04 |
| Rinse test (R11) | **PASS** in both captures — „Ohne ausspülen" / „Nicht ausspülen". |

**Claim capture performed this pass.**

| Field | Tier | Verbatim | Source |
|---|---|---|---|
| HEAT | **C2** | „bietet gleichzeitig einen Hitzeschutz" (no temperature figure) | redken.eu/de-de, retrieved 2026-09-04 |
| marketing position | **C2** | The product is sold on **Proteinen**, named as *Hydrolyzed Soy Protein* and *Hydrolyzed Vegetable Protein PG-Propyl Silanetriol* | same |
| HUM | — | No anti-frizz or humidity claim on the C2 page (the brand's Frizz Dismiss line is separate) | same |

## G0 — product form

`in_category`. Aqua leads; C2 directions leave the product on the hair; conditioning/repair-lubrication is primary.

## Reading conventions applied

**Tail marker (§3.1.1):** `Phenoxyethanol`, **rank 3** of 24. This is the extreme case §3.1.1 rule 3 was written for — a capped preservative at rank 3 places the *entire* conditioning architecture nominally in the unordered sub-1 % tail. **Rule 3 applied throughout:** COND and WT were **not** mechanically collapsed to `low`; the ordinal observation is recorded as a strong counter-signal, values are held at the level the architecture supports, every affected field is marked uncertain, and confidence is lowered a step. Rank is effectively unusable as a discriminator on this list, so the ordinal read (how early and how many members of a family appear) was used instead, exactly as rule 2 prescribes for the no-marker case.

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `non_lgn`, trace-only)
confidence moderate · E2. POLYACRYLAMIDE (2) + C13-14 ISOPARAFFIN (7) + LAURETH-7 (10) — the pre-neutralised polyacrylamide/isoparaffin/laureth system named in §7.1's non-LGN sub-type (b) — with TRIDECETH-6 (13) as an additional solubiliser, carrying AMODIMETHICONE (4) and ISOPROPYL MYRISTATE (8).
**counter_signal:** an LGN pair *is* present in the list — CETYL ALCOHOL (15) with CETRIMONIUM CHLORIDE (16) and BEHENTRIMONIUM METHOSULFATE (17) — but deep in it. Under the rank-3 marker nothing can be positioned, so sub-type was assigned on which emulsifier system leads the list. `emulsion_subtype` is trace-only and not projected, so the choice has no downstream consequence.
**threshold_reasoning** Decision order: not anhydrous; not `two_phase` (true emulsifying systems are present); `emulsion` matches. review_status `provisional`. `presentation_form`: Cream/Lotion.

### 2. COND — `moderate` — **uncertain**
confidence **low** (lowered a step under §3.1.1 rule 3) · E2.
**formula_observations** One coherent conditioning route read ordinally: AMODIMETHICONE (4), a persistent silicone, appears second among the functional ingredients, with ISOPROPYL MYRISTATE (8) as an emollient. The cationic/fatty-alcohol pair (15, 16, 17) appears late in a 24-item list.
**counter_signals** **Early-marker counter-signal:** Phenoxyethanol at rank 3 makes every architecture claim below it unpositioned rather than absent (§3.1.1 rules 3 and 4). A reviewer reading the LGN pair as architecture would return COND `high`, which changes the `damage_fit` row.
**threshold_reasoning** `high` requires an LGN pair **above the tail** plus a further route; the rank test cannot be met by anything, so the conservative read was taken. `low` is excluded: a persistent non-volatile (amodimethicone) appears very early.
**limitations** G4; §3.1.1 heuristic decisive; IPM carries a known negative "grating/dry" sensory note (§5 L3). review_status `provisional`.

### 3. SLIP — `moderate`, bias `unknown` — **uncertain**
confidence **low** · E2. One M1 contributor read ordinally as architecture: the amodimethicone/IPM package. The cationic species sit late. `high` requires two or more independent contributors present as architecture — defensible on a coherence reading, not on rank. Bias `unknown`: a persistent film plus late cationics plus a volatile isoparaffin fits no bias value cleanly (§17.16). review_status `provisional`.

### 4. SFR — `high` — **uncertain**
confidence **low** · E2. Continuous surface-film route: AMODIMETHICONE (4), a persistent (pH-dependent cationic) silicone film. Distinct lubricating species: ISOPROPYL MYRISTATE (8). Two distinct observations, so RC-4 is satisfied and `high` is taken; confidence lowered a step for the marker and the field marked uncertain.
**counter_signal (decision-relevant):** if a reviewer instead returns `moderate` here — defensible, since the whole architecture is unpositioned — the `smoothing` focus disappears and `repair` becomes the primary focus. This single value flips `focus.primary`. Recorded and routed.
**limitations** FS-12 checked explicitly: **amodimethicone's rinse-off selectivity argument does not transfer** to a leave-on and was not used; the film is read as a film, not as a self-limiting deposit. review_status `provisional`.

### 5. WT — `moderate` (multi-family row, §7.5) — **uncertain**
confidence **low_moderate** · E2.
**formula_observations** Persistent non-volatile families: (1) **silicone** — Amodimethicone (4); (2) **dry-feel ester** — Isopropyl Myristate (8); (3) **fatty alcohol + monomeric quats** — Cetyl Alcohol (15), Cetrimonium Chloride (16), Behentrimonium Methosulfate (17); (4) Polyacrylamide (2) as a non-volatile polymer within the emulsifier system.
**counter_signals (MANDATORY, §4)** The multi-family observation: at least three persistent non-volatile families, **none of them a rich/low-spreading band member** — no butter, coconut, olive, castor, avocado, petrolatum or heavy mineral oil is declared anywhere — and no LGN pair demonstrable above the tail. **The absent rich-band member is what holds the value below `high`**: `high` is about occlusion, weight and transfer. Dose remains the unmeasured term (§17.1).
**counter_signals (second)** Early-marker counter-signal: rank 3 marker; §3.1.1 rule 3 applied — value held, confidence lowered, field marked uncertain.
**FS-13 double-check:** the record pairs `moderate` WT with `ph_dependent_cationic` persistence projecting `moderate`; it makes no high-persistence/low-buildup pairing.
**threshold_reasoning** `low` excluded (multiple persistent families, however unpositioned). `high` excluded on both limbs. Confidence cannot reach `moderately_high`: §7.5 requires the non-volatile architecture to be fully readable above the tail, and the rank-3 marker forecloses that. review_status `provisional`.

### 6. PERS — `ph_dependent_cationic`, `quat_structure: unresolved`
confidence low_moderate · E2.
**formula_observations** AMODIMETHICONE (4) — the anchor's own named species for this class. Supporting lower classes: Cetyl Alcohol, IPM, and the monomeric long-chain quats Cetrimonium Chloride (16) and Behentrimonium Methosulfate (17) → `neutral_non_volatile`.
**counter_signals** QUATERNIUM-33 (19) is a declared quat whose polymeric-vs-monomeric structure the INCI name does not settle. Per §7.6 it is **not promoted**; `quat_structure: unresolved` is recorded and the record routes to review. Structure may not be inferred from a supplier substantivity claim (G4). No `Polyquaternium-x`, `Silicone Quaternium-x` or Quaternium-80 is declared, so `permanent_cationic` is unreachable.
**Monomeric-quat note (recorded, not mandatory here):** two monomeric long-chain quats are present but neither is the dominant persistent species — amodimethicone sets the class — so §7.6's required note is recorded as supporting context rather than as the class rationale.
**threshold_reasoning** Highest class present as architecture wins; `ph_dependent_cationic` is the highest reachable. `neutral_non_volatile` would understate amodimethicone's mechanism.
**limitations** G11 — mechanism ordering, never a duration; FS-12 — amodimethicone does **not** self-limit, and in a leave-on there is no rinse to remove the non-selective fraction. review_status `provisional`.

Buildup caution: not emitted (projection `moderate`). The FS-12 note is carried in the trace, not projected (G14).

### 7. HOLD — `none`
confidence low_moderate · E1. No L5 fixative-class polymer from the §5 list. Same recorded open point as slot 5: POLYACRYLAMIDE (2) is outside §5's rheology-exclusion enumeration (v0.2 §21, left open); here it reads as the emulsifier system. review_status `provisional`.

### 8. HEAT — trace `claim_only` → binary **`provides_heat_protection: true`**
confidence moderate · E0.
**claim authority** A **C2** claim exists, captured verbatim this pass: „bietet gleichzeitig einen Hitzeschutz" on redken.eu/de-de. No temperature figure is given, which is if anything more honest; either way no °C figure may be used as a protection level (FS-14) and no such field exists in this model.
**formula_observations** L9 closed-list check across all 24 ingredients: **no L9 member.** Note carefully — HYDROLYZED SOY PROTEIN (12) is *not* the L9 member; the published McMullen & Jachowicz result is for **hydrolyzed wheat protein** at a defined concentration in a model system, and the list is closed (G10). Amodimethicone is supporting, weaker, non-peer-reviewed evidence at best (SR §G.1) and is not on the list.
**threshold_reasoning** §13.3: claim present, no L9 member ⇒ binary **`true`**, trace **`claim_only`**, **route to review** with a "claim looks formula-unsupported" note. Generic silicone and generic protein stop at `claim_only` (G10, FS-7).
**limitations** Claim-led policy, not efficacy; no grade, no percentage, no temperature (§13.3). review_status `provisional`; **routed**.

### 9. HUM — `formula_plausible` (claim-free)
confidence **low** · E2. Qualifying route: AMODIMETHICONE (4), a persistent hydrophobic silicone film present as architecture on the ordinal read.
**counter_signals (MANDATORY)** Humectant observation: **no glycerin, no glycol, no panthenol, no betaine is declared** — this formula has essentially no humectant leg. The mandatory humectant counter-signal therefore records an absence rather than a presence; confidence is capped at `low` by §7.9 regardless, since there is no formula-only route above `low`.
**counter_signals (claim)** No C1/C2 humidity or anti-frizz claim was found. Claim-free `formula_plausible` emits **no** user-facing string (§7.9, §18).
review_status `provisional`.

### 10. R2 — `candidate` — **uncertain**
confidence **low** · E2 · **the pivotal value of this record.**
**formula_observations** HYDROLYZED VEGETABLE PROTEIN PG-PROPYL SILANETRIOL at **rank 14** of 24 — a **silane derivative**, one of the three routes on §7.10's closed `candidate` list. Context: a second protein, Hydrolyzed Soy Protein, at rank 12, and a film-forming emulsion architecture.
**threshold_reasoning** `candidate` requires the route "present as architecture (§3.1.1) in a plausible film context". The **rank** prong is unusable here — the tail marker is at rank 3, so nothing in the formula is above the tail and the prong would return `none_visible` for the entire architecture, including the amodimethicone that plainly leads it. §3.1.1 rule 3 forbids that mechanical collapse and instructs holding the value the architecture supports. The **architecture** prong is met: the silane is a functional active in a product whose C2 marketing position names it explicitly, alongside a second protein, in a coherent film-forming context. `candidate` was taken at `low` confidence, uncertain and routed. `unknown` ("formula or context unresolved") is the defensible alternative.
**Mandatory trace note:** HYDROLYZED SOY PROTEIN (12) is a **plain hydrolysate** and is `none_visible` at any position — it does **not** contribute to this value. The `candidate` rests solely on the silane.
**limitations** The R2 evidence base is supplier-dominated; molecular-weight and substantivity figures come from datasheets, not independent measurement (§7.10 ceiling). R2 never converts into structural repair, penetration, strength or a diagnosed "protein need" (G2, §7.10). review_status `provisional`.

### 11. DOSE — `moderate` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence low_moderate · E2. WT = `moderate` (multi-family row) sets `moderate`, and §7.11 v0.2 forbids re-arguing it upward on family count. No `high` trigger. review_status `provisional`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (9) plus declared allergens BENZYL BENZOATE (18), LIMONENE (20), BENZYL ALCOHOL (21), LINALOOL (22). No `Alcohol Denat.` note. G6 applies. review_status `approved`.

### 13. ROLE — `[post_wash]`
confidence moderate · E1 · scope directions · **C2 source captured this pass**.
- `post_wash` ← „**Nach dem Extreme Shampoo und Conditioner** anwenden. **Ins handtuchtrockenen Haar** geben." (redken.eu/de-de, C2, 2026-09-04)
**Not taken:** `heat_styling` — „Wie gewohnt stylen" names no heat tool, and the C2 heat *claim* is a claim, not a direction (§7.13). `ends_only` — the C2 sentence states no placement restriction; the C3 douglas.de text („auf einzelne brüchige Haarstellen") does mention placement but **C3 corroborates and never creates a role**, so it is recorded in `supporting_signals[]` only. `refresh`, `curl_styling` — nothing establishes them.
**Note on the pass:** capturing the C2 page moved this field from `[]` (packet C3 only) to `[post_wash]`. review_status `approved`.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 consequence of the amodimethicone film |
| CURL | `none` (low) | HOLD = `none` |
| R3 | `unknown` | No bond claim and no recognised bond chemistry. „Anti-Snap"/anti-breakage naming is E0 and is **not** a bond claim |
| LAYER | no string emitted | No cationic polymer; the monomeric quats sit late |
| Buildup caution | not emitted | PERS projects `moderate` |

## §9 care_direction — `protein` — **uncertain**

confidence **low** · E2 · shared_mechanism `M2_SUBSTANTIVE_FILM_SUPPORT`.
R2 is `candidate` and the route is a silane derivative — a substantive protein/silane film route, which is exactly what the `protein` anchor describes. The anchor's "above the tail" wording cannot be satisfied by anything in this formula (marker at rank 3), so §3.1.1 rule 3 was applied and the value held at `low` confidence, uncertain.
`balanced` was tested and rejected: it requires an R2 route **and** a material moisture leg, both above the tail — and this formula has **no humectant leg at all** (no glycerin, no glycol, no panthenol), so the moisture half is genuinely absent rather than merely unpositioned. `moisture` would require the L1/L3/L4 legs to be the material direction, which they are not. `unknown` is the defensible alternative if a reviewer declines the R2 `candidate`.
**G3 note:** `care_direction` shares M2 with R2 and PERS and is **not** presented as independent corroboration of either. Constraint 1 observed — it did not drive WT, PERS, HOLD or HEAT.

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "protein",
  "focus": { "primary": "smoothing", "secondary": ["repair"] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "conditional", "moderately_damaged": "recommended", "highly_damaged": "recommended" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das.",
    "Enthält einen Protein-Baustein, der sich als Film aufs Haar legen kann. Das ist Pflege an der Oberfläche, keine Reparatur.",
    "Enthält deklarierte Duftstoffe."
  ],
  "uncertain_fields": ["conditioning_level", "weight_potential", "focus", "care_direction", "repair_surface_film"],
  "assumption_notes": [
    "Tail marker at rank 3: §3.1.1 rule 3 applied across COND, WT, SFR, R2 and care_direction.",
    "focus.primary is knife-edge: SFR high vs moderate flips it between smoothing and repair."
  ]
}
```

**Focus selection (§10.2) — and the strength-ordering problem this record exposes.**

- Step 1, qualifying routes. **`repair`** qualifies twice over: R2 ∈ {`candidate`} (§10.2's first limb) **and** protein/silane actives in the product's C1/C2 marketing position — verified this pass, the C2 page names *Hydrolyzed Vegetable Protein PG-Propyl Silanetriol* as what the product is sold on. **`smoothing`** qualifies: SFR `high` on a dedicated amodimethicone film in a non-LGN emulsion (RC-5). Others fail: `heat_styling` (HEAT `claim_only` clears, but ROLE has no `heat_styling` sentence), `detangling`, `curl_definition`, `volume_lightness`, `shine`.
- Step 2, strength. `smoothing` rests on **two** independent endpoint-relevant formula observations (amodimethicone rank 4, IPM rank 8). `repair` rests on **one** (the silane at rank 14) — the plain soy hydrolysate does not count (§7.10), and the C2 marketing position is positioning, not a formula observation. Two beats one, so `smoothing` is the primary.
- Step 3 is never reached. Its rank order is `repair > smoothing`, and its precondition ("a dedicated repair route exists — R2 ∈ {candidate, tested}, **or** protein/silane actives in the marketing position") is fully satisfied here. **But step 3 only applies "when two routes tie on strength", and step 2 has already resolved.** The result is that the gold set's designated protein/surface-repair archetype — with an R2 `candidate`, a `protein` care direction and a C2 protein marketing position — projects `focus.primary: smoothing`. **Recorded as a v0.2 defect, not as a judgment about this product.**
- `primary` is marked **uncertain** under §10.2 rule 5 and routed.
- Secondary: `repair`, which clears the independent-moderate+ bar on its own endpoint-relevant observation (the silane, an M2 route distinct from the primary's M1 film) and is not a restatement of the primary's mechanism. Cap of two respected.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `moderate`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 3b, the v0.2 repair-film path (R14)** — `R2 ∈ {candidate, tested}` at `conditioning_level ≥ moderate`. This is R14 working exactly as intended: under v0.1 the tier was gated on COND `high`, which was itself gated on an LGN pair, so a specialist leave-in built for damaged hair on a silicone/silane architecture could not reach the tier written for it. It now can, **without** needing COND `high`. Result: `healthy: conditional`, `moderately_damaged: recommended`, `highly_damaged: recommended`.
- `texture_fit` ← **row 2** (`weight_potential = moderate`, any slip).
- `scalp_application_fit` ← ordered test: **`avoid`** on the EXPO trigger `aromatic_or_allergen_exposure`. The C2 directions state no placement.

## §14 review routing

1. **Heat-protection claim with no L9 member** (§13.3, §14).
2. **GTIN unresolved** — two independently corroborated candidates (§14).
3. **`quat_structure: unresolved`** — Quaternium-33 (§7.6, §14).
4. **Tail marker at rank 3** — §3.1.1 rule 3 was applied across five fields; the marker is unusable on this list and every value that leaned on it is uncertain (§17.14).
5. **`focus.primary` uncertain** — the §10.2 step-2 observation count puts `smoothing` ahead of the product's own repair route; step 3's rank order never applies.
6. **R2 `candidate` under an unusable marker** — this one value drives `care_direction: protein`, the `damage_fit` row-3b upgrade, the secondary `repair` focus and the §18 R2 copy string. If a reviewer returns `none_visible` or `unknown`, four projected fields move together.
