# S5 — EVO Head Mistress Cuticle Sealer

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 5 · 150 ml · GTIN 9349769013144 · `formulaFingerprintSha256` d7cccb0d…c4ea

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `verified` (GTIN second-sourced via haarspullen.nl) |
| Directions verbatim | "Apply to towel-dried hair and blow-dry for improved manageability and softness. Apply after styling to control frizz and fly-aways." |
| Directions authority | **C5** — evohair.com **/us**, a US-region storefront. §2.4.1 rule 3: "Non-German EU or non-EU market pages are C5, not C2: a claim made on a US page is not a claim made on the German market product." No German-language directions exist for this product. Lane convention RC-2 resolves the §2.4.1 C2-row/rule-3 conflict in favour of rule 3. |
| Rinse test (R11) | **PASS** — no rinse instruction; applied to towel-dried hair before blow-drying and again after styling. The exclusion test runs on captured directions at any tier. |
| Preserved conflict (G5) | A stray fetch of a differently-formed evohair.com URL returned an unrelated LGN-emulsion list for the same product name; discarded as a page-mismatch artifact against three mutually-agreeing sources, recorded for audit only. |

## G0 — product form

`in_category`. Aqua leads at rank 1; the directions leave the product on the hair; smoothing/conditioning is primary. Not styling-first — no L5 fixative-class polymer is declared.

## Reading conventions applied

**Tail marker (§3.1.1):** `Phenoxyethanol`, **rank 6** of 25. Above the tail: ranks 1–5 only — Aqua, Dimethicone, Cyclopentasiloxane, Polyacrylamide, Dimethiconol. This is an **early marker**, so §3.1.1 rule 3 governs: do **not** mechanically collapse COND and WT; record the ordinal observation as a strong counter-signal, hold values at what the architecture supports, mark affected fields uncertain and lower confidence. Ingredients below rank 6 are *unpositioned, not absent* (rule 4).

Decisive consequences: **QUATERNIUM-80 (rank 14, a silicone quat)**, **MACADAMIA TERNIFOLIA SEED OIL (13)** and **HYDROLYZED QUINOA (12)** are all tail members.

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `non_lgn`, trace-only)

confidence **moderately_high** · E2 · scope formula.
**formula_observations** POLYACRYLAMIDE (4) + C13-14 ISOPARAFFIN (9) + LAURETH-7 (10) — the pre-neutralised polyacrylamide/isoparaffin/laureth system named explicitly in §7.1's non-LGN sub-type (b) — carrying a persistent silicone phase: DIMETHICONE (2), CYCLOPENTASILOXANE (3), DIMETHICONOL (5).
**counter_signals** No LGN pair: no cationic surfactant is paired with a long-chain fatty alcohol; indeed no fatty alcohol is declared at all.
**threshold_reasoning** Decision order: not anhydrous (Aqua rank 1); not `two_phase` (a true emulsifying system is present, so the architecture is not unemulsified); `emulsion` matches sub-type (b) and the order stops there, so `microemulsion` is not reached — which matters, because a solubiliser (Laureth-7) plus a silicone load would otherwise have suggested it. Sub-type (b) is a *true emulsifier system*, not a solubiliser package.
**limitations** `emulsion_subtype` is trace-only and not projected. FS-17 double-check: nothing here reads clarity as lightness. review_status `approved`.
`presentation_form`: Cream.

### 2. COND — `moderate`

confidence moderate · E2.
**formula_observations** One coherent conditioning route: a persistent silicone package above the tail — DIMETHICONE (2), DIMETHICONOL (5) — with CYCLOPENTASILOXANE (3) as a volatile carrier that contributes nothing to residue.
**counter_signals** No LGN pair anywhere, which is what gates `high` (§7.2). Macadamia oil (13), Quaternium-80 (14) and Panthenol (8) are all below the tail marker at rank 6 and were not used. **Early-marker counter-signal (§3.1.1 rule 3):** with the marker at rank 6, everything except the silicone package is unpositioned; the value was held at what the architecture supports rather than collapsed.
**shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
**threshold_reasoning** `low` is excluded — persistent non-volatiles (two silicones) sit above the tail. `high` is excluded — it requires an LGN pair above the tail, which does not exist. This is the known v0.2 limitation deliberately left unchanged (§21, BR §2.10): a silicone-led product cannot reach COND `high`. Its worst consequence is removed elsewhere by R14's repair-film path, which this product cannot use either (R2 `none_visible`).
**limitations** G4; FS-4 — "contains a volatile silicone, therefore leaves no residue" is false; the residue is whatever the volatile was carrying. review_status `provisional`.

### 3. SLIP — `moderate`, bias `dry_biased`

confidence low_moderate · E2.
One M1 contributor present as architecture: the persistent silicone film/lubricant package. `high` requires two or more independent contributors; the second candidate, Quaternium-80, is below the marker. `low` requires no persistent lubricant and no cationic species above the tail — the silicone package rules it out.
**bias reasoning** `dry_biased` is taken and is one of the few products here where the enum actually fits: a persistent film (Dimethicone/Dimethiconol) with few water-phase slip agents — the only humectant-type materials, Panthenol (8) and Butylene Glycol (18), sit below the marker. Confidence low; the bias qualifier remains the weaker half of the WET+DRY merge (§17.16, §17.5).
review_status `provisional`.

### 4. SFR — `high`

confidence moderate (at the §7.4 ceiling) · E2.
**formula_observations** Continuous surface-film route: DIMETHICONOL (5), a high-MW persistent silicone film former. Distinct lubricating species: DIMETHICONE (2). Both above the tail; CYCLOPENTASILOXANE (3) aids spreading and dry-down but contributes nothing to residue (M6).
**shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
**threshold_reasoning** The anchor is met: a persistent silicone film plus a lubrication route, as two distinct declared species rather than one observation read twice (RC-4). `moderate` would be a single alignment route.
**counter_signals** COND reads the same architecture at `moderate`; per RC-4 that is not a G3 violation, because SFR's top value rests on two separate species. A reviewer applying the stricter reading of §7.4's G3 note would return `moderate` here and the `smoothing` focus would disappear with it — recorded as a residual ambiguity.
**limitations** Ambient smoothing only. The word "frizz" is deliberately absent: humidity behaviour belongs to HUM (§7.4). review_status `provisional`.

### 5. WT — `moderate` (single-family row)

confidence moderate · E2 · **field marked uncertain**.
**formula_observations** Exactly one persistent non-volatile family present as architecture: persistent silicones — DIMETHICONE (2) and DIMETHICONOL (5). Both are members of the same L2 persistent-silicone family, not two families.
**counter_signals** (a) **Early-marker counter-signal:** the marker at rank 6 places the entire remaining formula in the unordered tail, so macadamia oil (13) and Quaternium-80 (14) are unpositioned rather than absent; §3.1.1 rule 3 was applied — the value was held, not collapsed, and confidence lowered. (b) Two persistent silicone species at ranks 2 and 5, immediately behind water, argue for more residue than a typical single-family case; rank is an ordinal read only and no percentage may be inferred (G4). (c) Polyacrylamide (4) is a non-volatile polymer but reads as part of the emulsifier system, not as a hero non-volatile; counting it would give the multi-family row and the same `moderate` value.
**threshold_reasoning** `low` is excluded — a persistent non-volatile family sits above the tail (FS-1/FS-3 checked: neither "water first" nor "silicone-free" reasoning was used). `high` is excluded — no LGN pair, and the two-or-more-families limb needs a rich/low-spreading band member; macadamia oil is both unenumerated (medium band by convention) and below the marker. Confidence does **not** rise to `moderately_high`, because §7.5 requires the non-volatile architecture to be fully readable above the tail and the rank-6 marker prevents that. G9 checked: the cream presentation contributed nothing (FS-2).
**limitations** Dose unmeasured (§17.1); fine-hair threshold is a product judgment call (§17.11); tail-marker heuristic decisive (§17.14). review_status `provisional`.

Transfer caution: not attached — the only low-spreading lipid (macadamia) is below the marker and unenumerated.

### 6. PERS — `neutral_non_volatile`

confidence **low** · E2 · **field marked uncertain**.
**formula_observations** Above the tail: DIMETHICONE (2), DIMETHICONOL (5) — neutral non-volatiles. C13-14 Isoparaffin (9) is a volatile hydrocarbon and contributes nothing (M6).
**counter_signals (decisive if reversed)** **QUATERNIUM-80 is declared at rank 14.** §7.6's v0.2 `permanent_cationic` anchor names it explicitly as a silicone-functional quat. It sits eight positions below the tail marker at rank 6. Under lane convention RC-3 (class anchors gated on rank above the marker) it does not promote the class; under §3.1.1's coherence prong — a silicone quat is entirely coherent with a silicone-film architecture — it would promote the record to `permanent_cationic` and the projection from `moderate` to `high`, carrying the buildup caution. **v0.2 does not say which reading governs.** Routed to review.
**counter_signals (second)** Amino-functional and quaternised silicones are marketed on wash resistance, and wash resistance and buildup are the same property (FS-13). Holding the class low here under-warns on buildup, which is the direction FS-20 and the v0.2 monomeric-quat repair exist to guard against. Recorded explicitly so the abstention is auditable.
**threshold_reasoning** `ph_dependent_cationic` requires amodimethicone/bis-aminopropyl dimethicone/an amidoamine — none declared. `volatile_or_water_soluble` is excluded because persistent silicones dominate. Monomeric-quat note not required (no monomeric long-chain quat is the dominant persistent species).
**limitations** G11 — no duration, wash count or clarification schedule; the circulating removal percentages are banned. review_status `provisional`.

### 7. HOLD — `none`
confidence low_moderate · E1. No L5 fixative-class polymer from the §5 evidence list is declared. **Recorded open point:** POLYACRYLAMIDE (4) is not covered by §5's L5 rheology-exclusion enumeration (Carbomer, Xanthan, HEC, Acrylates/C10-30), and v0.2 §21 lists exactly this enumeration gap as "deliberately not changed". Here it reads unambiguously as part of the Sepigel-type emulsifier system, not as a fixative, so the gap is not decisive — but it is recorded. review_status `provisional`.

### 8. HEAT — `not_claimed` → binary `false`
confidence moderate · E0.
**Claim authority (§2.4.1, G13).** No C1/C2 heat claim exists: there is no German pack capture and no German/EU manufacturer page; evohair.com/us is C5 (RC-2). The US directions mention blow-drying but make no protection claim in any case.
**formula_observations** L9 closed-list check: **no L9 member is declared**. Generic silicone never reaches `formula_plausible` (G10, FS-7).
**threshold_reasoning** No claim and no L9 member ⇒ `not_claimed`; §13.3 rule 4 sets the binary `false`. review_status `provisional`.

### 9. HUM — `formula_plausible` (claim-free)

confidence **low** — and there is no formula-only route above `low` in any combination (§7.9) · E2.
**formula_observations** A hydrophobic, continuous film-forming route present as architecture: DIMETHICONE (2) and DIMETHICONOL (5), a persistent hydrophobic silicone film with a plausible water-uptake-reduction mechanism.
**counter_signals (MANDATORY, §4)** Humectant observation: PANTHENOL (8) and BUTYLENE GLYCOL (18) are declared. Both sit below the tail marker, so the humectant leg is not *dominant* and does not block the state (§7.9 step 1); it is materially declared, so its observation is recorded and **confidence is capped at `low`** (step 2). It never raises the state and never raises confidence.
**counter_signals (claim authority)** The US page's text "Apply after styling to control frizz and fly-aways" is a frizz claim at **C5**. Under §2.4.1 rule 1 it **does not create a claim**; it is recorded here with its tier and the record routes to review with a `claim_authority_gap` note so a human can decide whether a German manufacturer source was simply not found.
**threshold_reasoning** `not_claimed` requires *both* no claim and no qualifying route — the route exists, so it is not reachable. `claim_only` would require a C1/C2 claim, which does not exist. `product_tested` requires HHCR/DHCR, DVS or humidity-chamber imaging on the exact product with declared RH, temperature and equilibration time — none exists.
**Glycols-are-not-automatically-humectants check (§7.9 v0.2):** Butylene Glycol at rank 18 could read as a solvent; the formula does not settle it, so the **humectant** reading was taken (the conservative one — it lowers the state) and the field marked uncertain. Here it changes nothing, because the leg is not dominant either way.
**projection consequence** A claim-free `formula_plausible` projects as the state and emits **no** user-facing string (§7.9, §18). review_status `provisional`.

### 10. R2 — `none_visible`
confidence low_moderate · E1.
**Mandatory trace note (§7.10 v0.2):** HYDROLYZED QUINOA is declared at rank 12 — a **plain hydrolysate**, `none_visible` at any position, because what makes a protein an R2 route is cationisation or silane functionalisation, not rank. Recorded so the record does not read as if it were missed.
**Second trace note:** QUATERNIUM-80 (14) *is* on the §7.10 closed candidate list as a silicone quat, but `candidate` additionally requires the route to be **present as architecture (§3.1.1)** in a plausible film context, and it sits eight ranks below the tail marker. Held at `none_visible` under RC-3, field marked uncertain, routed. PANTHENOL (8) is a fibre-mechanics signal, not an R2 route and not a heat route (FS-24).
review_status `provisional`.

### 11. DOSE — `moderate` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. WT = `moderate` sets the row. No `high` trigger: FORM is not `two_phase`, and no rich/low-spreading lipid band member is present as architecture. FORM is not `microemulsion` either, so that additive trigger does not fire. review_status `approved`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (7) plus declared allergens LIMONENE (21), HEXYL CINNAMAL (22), LINALOOL (23), GERANIOL (24), CITRAL (25). No `Alcohol`/`Alcohol Denat.` note. Benzophenone-4 (11) is a UV filter, not an EXPO signal under L8. G6 applies; exposure statements never predict tolerance (§17.12). review_status `approved`.

### 13. ROLE — `[]` (`usage_role` unknown)
confidence moderate in the *abstention* · E1 · scope directions.
Directions are captured and rinse-tested, but the source is **C5** under RC-2. §7.13 rule 1 permits role values **only** from C1/C2 directions. The US text would have established `post_wash` ("Apply to towel-dried hair"), `heat_styling` ("and blow-dry" — a named heat tool) and `refresh` ("Apply after styling") — **none may be emitted**. All three are recorded in `supporting_signals[]` with their tier.
`usage_role` emitted as `[]` and listed in `uncertain_fields`. Downstream consequence: the `heat_styling` focus is doubly unreachable (HEAT is `not_claimed` and ROLE is empty). review_status `provisional`; routed.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 optical consequence of the silicone alignment film; no independent value and no goniophotometry (§8.1, FS-23) |
| CURL | `none` (low) | HOLD = `none` |
| R3 | `unknown` | No bond claim, no recognised bond chemistry |
| LAYER | no string emitted | No cationic polymer above the tail |
| Buildup caution | not emitted | PERS projects `moderate` — but see the PERS counter-signal; if Quaternium-80 promotes the class on review, this caution becomes mandatory |

## §9 care_direction — `unknown`

confidence moderate in the *abstention* · E2.
This is the §9 v0.2 **silicone-led rule** applied directly: conditioning is led by DIMETHICONE (2) and DIMETHICONOL (5); there is **no R2 route** (`none_visible`) and **no material humectant or emollient leg** — Panthenol (8), macadamia oil (13) and Butylene Glycol (18) all sit below the tail marker at rank 6. L2 appears in neither the `protein` nor the `moisture` definition and is not to be interpolated away, so the value is **`unknown`**, not `moisture` and not `balanced`. The silicone architecture is recorded here so the `unknown` reads as a deliberate abstention rather than a missing analysis. Constraint 1 observed.

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
  "care_direction": "unknown",
  "focus": { "primary": "smoothing", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "formula_plausible" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "cautions": ["Enthält deklarierte Duftstoffe."],
  "uncertain_fields": ["persistence", "care_direction", "usage_role", "repair_surface_film", "weight_potential"],
  "assumption_notes": [
    "PERS and R2 held low under RC-3; Quaternium-80 sits eight ranks below the tail marker.",
    "usage_role empty because the only directions source is a US-region page (C5)."
  ]
}
```

**Focus selection (§10.2).** Step 1 — qualifying routes: `smoothing` qualifies. SFR is `high`, and the film route is a **dedicated silicone film system** rather than a by-product of an LGN conditioning emulsion — there is no LGN pair, COND is only `moderate`, and the smoothing film is what the product *is* (RC-5). It rests on two independent endpoint-relevant observations (Dimethicone rank 2, Dimethiconol rank 5). `detangling` — no detangling-led C1/C2 positioning (no C1/C2 source exists) and the slip-dominant prong needs WT `low`. `heat_styling` — HEAT `not_claimed` and ROLE empty. `repair` — R2 `none_visible`; a silicone quat below the tail cannot set it and generic silicone is excluded by name. `curl_definition` — HOLD `none`. `volume_lightness` — needs WT `low`. `shine` — excluded: it would merely restate the smoothing film (§8.1, G3), and no goniophotometry exists.
Step 2 — one qualifying route ⇒ **`primary: smoothing`**. Secondary: none clears the independent-moderate+ bar.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `moderate`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2** (COND `moderate`, no qualifying repair route). Row 3b (R14's repair-film path) is unreachable because R2 is `none_visible`.
- `texture_fit` ← **row 2** (`weight_potential = moderate`, any slip). Not row 4 or 5.
- `scalp_application_fit` ← ordered test: **`avoid`** on the EXPO trigger `aromatic_or_allergen_exposure`. No directions-based value was available in any case (C5 source, and §10.3.1 positives require C1/C2 directions).

## §14 review routing

1. **`claim_authority_gap`** — the product's own frizz/fly-away text exists only at C5 (US-region manufacturer page). HUM's state was reached from the formula route alone, and `provides_heat_protection` is `false` by rule. A human should decide whether a German source exists (§2.4.1 rule 1).
2. **Directions authority** — no C1/C2 directions, so `usage_role` is `[]` despite a clear captured direction text (§7.13 rule 1; routed by analogy to §2.4 rule 3).
3. **PERS / R2 tail-gating** — Quaternium-80 at rank 14 against a marker at rank 6 decides `persistence` `moderate` vs `high`, the buildup caution, R2 `none_visible` vs `candidate`, and through R2 the `damage_fit` row (2 vs 3b) and the availability of a `repair` focus. This single unresolved reading moves five projected fields (RC-3).
4. **Early tail marker** — `Phenoxyethanol` at rank 3 of the *functional* list places the whole formula behind the silicones into the unordered tail (§3.1.1 rule 3 applied).
5. **L5 enumeration** — Polyacrylamide is outside §5's rheology-exclusion list (v0.2 §21, left open).
