# S7 — Maria Nila Curlicue Cream

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 7 · 100 ml · GTIN **not found** · `formulaFingerprintSha256` f7c3be7b…db3a

> **G0 = `provisional_boundary`.** This record is **not** an exclusion. It stays in-category, the full record is completed, and **every affected field is marked uncertain** (§2.3). It routes to human review by definition (§14).

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `verified` for formula; GTIN not found (documented gap) |
| Directions verbatim | "Apply to damp hair just at the ends for a textured look or apply throughout the lengths for a more controlled look. To avoid flyaways and allow curls to find their natural wave, use the product from root to top." |
| Directions authority | **C5** — marianila.com, region not confirmed DE/EU, English-language; no German directions could be captured (flaconi.de's accordion did not render). RC-2 applies: a non-German manufacturer page creates neither a claim nor a role. |
| Rinse test (R11) | **PASS** — application to damp hair, styling directions only, no rinse instruction. |

## G0 — product-form gate: `provisional_boundary`

The two halves of §2.3 give different answers for this product, which is precisely what `provisional_boundary` is for.

- **Pointing to `excluded_styling_first`:** §2.3's named trap 3 says "Run the HOLD anchor; `meaningful_hold_route` with thin conditioning is what excludes, not the word." HOLD is `meaningful_hold_route` (below): PVP sits at **rank 4**, above the tail, in a film-forming context, and the conditioning architecture behind it is genuinely thin — one long-chain fatty alcohol with **no** cationic partner, no oil, no silicone, no cationic polymer, and one opaque quat whose structure the INCI name does not settle.
- **Pointing to `in_category`:** the G0 table's `excluded_styling_first` row requires **both** that architecture **and** that "directions/positioning lead on durable hold or texture". The captured directions lead on *look* and *natural wave* — "a textured look", "a more controlled look", "allow curls to find their natural wave" — and never mention hold, fixation or durability. The charter includes curl creams "when conditioning/definition is central and hold remains secondary". Those directions are also C5, so they cannot carry much weight in either direction.

Neither reading is safely dominant, so the record is retained as a **boundary stress case**: the full record is completed and every affected field is marked uncertain. Routed to review as the G0 decision it is.

## Reading conventions applied

**Tail marker (§3.1.1):** `Ethylhexylglycerin`, **rank 13** of 17 (Phenoxyethanol follows at 16). Above the tail: ranks 1–12.

---

## §7 dimensions

### 1. FORM — `aqueous_or_hydroalcoholic_solution` — **uncertain**

confidence **low_moderate** · E2 · scope formula.
**formula_observations** AQUA (1) leading, PROPYLENE GLYCOL (2), GLYCERIN (3), BUTYLENE GLYCOL (9), PROPANEDIOL (12) — a glycol-heavy water phase. POLYSORBATE 20 (8) is a solubiliser-type material. **No oil and no silicone is declared anywhere in the list.** CARBOMER (10) + TRIETHANOLAMINE (14) is a bottle-rheology system. CETYL ALCOHOL (5) is a long-chain fatty alcohol with **no** cationic partner above it.
**counter_signals (decisive, recorded)** §7.1's solution row anchor states "**no long-chain fatty alcohol**" — and Cetyl Alcohol is declared at rank 5. The same section's own note says: "A long-chain fatty alcohol without a cationic partner is not an LGN pair. Read it as an emollient/consistency factor and **classify on the rest of the architecture**; it does not by itself create the `emulsion` row." **The anchor row and the note contradict each other for exactly this formula.** The note was followed (it is the more specific v0.2 addition and it names this case), so the row is taken as `aqueous_or_hydroalcoholic_solution`; the alternative under the literal anchor is `unknown`. Field marked uncertain and routed.
**threshold_reasoning** Decision order: not anhydrous; not `two_phase` (there is no oil phase to be unemulsified); not `emulsion` (no true O/W emulsifying system, and no lipid or silicone phase for one to carry — the sub-type (b) test is the emulsifier system, and Polysorbate 20 alone is a solubiliser, not an emulsifier); not `microemulsion` (the row requires **both** a solubiliser package **and** a real oil or silicone load present as architecture — the second condition fails outright, and §7.1's threshold rule sends "solubiliser present but no oil/silicone load above the tail" to the solution row).
**limitations** FS-25 checked: Carbomer is bottle rheology and was not read as performance. review_status `provisional`.
`presentation_form`: Cream.

### 2. COND — `low` — **uncertain**

confidence **low** · E2.
**formula_observations** No cationic polymer. No persistent silicone. **No oil or emollient package of any kind.** CETYL ALCOHOL (5) is a single fatty alcohol acting as a consistency factor. QUATERNIUM-95 (11) is a declared quat whose polymeric-vs-monomeric structure the INCI name does not settle.
**counter_signals** Cetyl Alcohol at rank 5 and a quat at rank 11 are both above the tail; a reviewer could read them together as "one coherent conditioning route" and return `moderate`. Field marked uncertain.
**threshold_reasoning** `moderate` requires **either** a cationic-polymer film route **or** a persistent silicone/emollient *package*. Neither exists: the quat is unresolved and monomeric at best, and one fatty alcohol is not a package. `high` requires an LGN pair — no cationic surfactant is paired with Cetyl Alcohol above it.
**Recorded contradiction (v0.2 §21, "deliberately not changed"):** this record returns **COND `low` with SLIP `moderate`** on a single quat observation, because §7.2's `low` anchor and §7.3's `low` anchor draw the line in different places — §7.3's `low` is excluded by *any* cationic species above the tail, while §7.2's `moderate` needs a *route*. v0.2 recorded this as unrepaired so round 2 could measure whether it still bites. **It still bites**, here and at slot 11.
**limitations** G4; §7.2's `low` anchor says "only a **short-chain** quat" while §7.6 classifies Cetrimonium-type materials as **monomeric long-chain** quats — the two sections use different vocabulary for the same materials, and Quaternium-95 fits neither cleanly. review_status `provisional`.

### 3. SLIP — `moderate`, bias `unknown` — **uncertain**
confidence **low** · E2. One M1 contributor present as architecture: a cationic species (Quaternium-95, rank 11). `low` is excluded because its anchor requires **no** cationic species above the tail. `high` requires two independent contributors — there is no persistent lubricant at all. Bias `unknown`: with no persistent film and no lipid load, none of `wet_biased`/`dry_biased`/`both` describes this architecture (§17.16). review_status `provisional`.

### 4. SFR — `moderate` — **uncertain**
confidence **low** · E2. `moderate`'s anchor admits "a single film former", and PVP (4) is one. `high` requires a *continuous surface-film route* — a persistent silicone or a substantive cationic-polymer film — plus a lubrication route; neither exists. `low` requires no persistent film with water phase and humectants only, which PVP rules out.
**counter_signal:** PVP is a **fixative** film, not an alignment/conditioning film; §7.4's `moderate` anchor does not distinguish them, so the value rests on a route whose user-facing effect is stiffness rather than smoothing (FS-9). Recorded; marked uncertain. review_status `provisional`.

### 5. WT — `moderate` (multi-family row)

confidence moderate (capped by the row) · E2.
**formula_observations** Family 1 — fixative film former: PVP (4). Family 2 — fatty alcohol/consistency factor: CETYL ALCOHOL (5). Family 3 — cationic species: QUATERNIUM-95 (11). All above the tail marker at rank 13.
**counter_signals (MANDATORY, §4)** The multi-family observation: three persistent non-volatile families at ranks 4, 5 and 11, **none of them a rich/low-spreading band member** — indeed no lipid of any kind is declared — and **no LGN pair** (Cetyl Alcohol has no cationic partner above it). **What holds the value below `high` is the absent rich-band member**: the `high` anchor is about occlusion, weight and transfer, and this formula offers none of those. Dose remains the unmeasured term (§17.1).
**counter_signals (second)** WT measures the net tendency to "flatten, grease, **stiffen** or coat"; a fixative film contributes to the stiffen limb rather than the grease limb. The anchor rows do not distinguish them. Recorded.
**threshold_reasoning** `low` is excluded — three persistent non-volatile families sit above the tail (a purely water/glycol-dominant architecture with none of them is what `low` describes). `high` is excluded on both limbs.
**limitations** Fine-hair consequence is a product judgment call (§17.11). review_status `provisional`.

### 6. PERS — `neutral_non_volatile`, `quat_structure: unresolved` — **uncertain**

confidence **low** · E2.
**formula_observations** QUATERNIUM-95 (11) — a declared quat. **Its polymeric-vs-monomeric structure cannot be established from the INCI name alone**; the `Quaternium-x` numbering is opaque. Other persistent species: PVP (4), Cetyl Alcohol (5).
**threshold_reasoning** §7.6's unresolvable-quat rule is explicit and was applied verbatim: the quat is **not promoted**; the record takes `neutral_non_volatile` with the monomeric note, records `quat_structure: unresolved` in `limitations[]`, and routes to human review. Structure may **not** be inferred from a supplier datasheet claim about substantivity — that would be a charge-density inference by another route (G4).
**Required monomeric-quat note (mandatory):** *"Persistence rests on a monomeric long-chain quat: permanently charged, so more substantive than a neutral deposit, but small-molecule and surfactant-removable, so below the polymeric/silicone-quat class. The ordinal class is a mechanism ordering, not a duration (G11)."*
**counter_signals** Film cohesion modifies within a class: a PVP film resists water less than a crosslinked fixative and is hygroscopic (SR §F.1); it does not raise the class.
**limitations** G11; `quat_structure: unresolved`. review_status `provisional`.

### 7. HOLD — `meaningful_hold_route`

confidence moderate · E2. **This is the record's pivotal value.**
**formula_observations** PVP at **rank 4** — an L5 fixative-class polymer, above the tail marker at rank 13, in a film-forming context (a glycol/water vehicle with Carbomer/TEA rheology). Conditioning architecture behind it: one fatty alcohol with no cationic partner, one unresolved quat, no oil, no silicone, no cationic polymer.
**threshold_reasoning** `none` is excluded — PVP is a named L5 member, and the L5 rheology exclusion covers Carbomer, not PVP. `incidental_film` requires **either** that a substantive conditioning architecture dominates (it does not — see COND `low`) **or** that the polymer plausibly serves bottle rheology (Carbomer and Triethanolamine already do that job; PVP at rank 4 is not a thickener). `meaningful_hold_route` is what remains: a fixative-class polymer in a film-forming context with thin conditioning architecture behind it.
**Consequences (both applied):** → **G0 styling review** (§7.7), which is one half of the `provisional_boundary` verdict above; → §14 human review (styling-boundary decision).
**limitations** **Hold *level* is not readable** — polymer level and plasticiser load are invisible — so no grade of any kind is emitted (§7.7, SR §K HOLD). FS-9 checked: a hold polymer is not conditioning and not repair. review_status `provisional`.

### 8. HEAT — `not_claimed` → binary `false`
confidence moderate · E0. No C1/C2 source exists (marianila.com is C5 under RC-2), so under §2.4.1 rule 1 the claim does not exist. L9 closed-list check: **plain PVP is not an L9 member** — the list contains *PVP/DMAPA Acrylates Copolymer*, a different material, and the list is closed (G10). §13.3 rule 4. review_status `provisional`; routed with `claim_authority_gap`.

### 9. HUM — `not_claimed`
confidence moderate · E0/E2. No C1/C2 claim, and no qualifying route. (a) There is no hydrophobic continuous film-forming route: PVP is **hygroscopic and loses film stiffness as RH rises** — the opposite of the water-uptake-reduction mechanism the state requires (SR §F.1); no VP/VA-class hydrophobic copolymer and no silicone is declared. (b) The humectant leg is **dominant** by any reading: Propylene Glycol (2), Glycerin (3), Butylene Glycol (9), Propanediol (12) — four members, three of them in the top three functional positions.
**Glycols-are-not-automatically-humectants check (§7.9 v0.2):** Propylene Glycol at rank 2 could plausibly be a solvent for the PVP rather than a humectant. The formula does not settle it, so the **conservative humectant reading was taken** (it lowers the state) and the field marked uncertain. Either way the state is `not_claimed`, since no claim exists.
FS-16: no dew-point threshold is encoded. review_status `provisional`.

### 10. R2 — `none_visible`
confidence moderate · E1. No protein of any kind, no silane derivative, no silicone quat, no peptide. Quaternium-95 is **not promoted** to a silicone-quat reading — the name does not establish it and G4 forbids inferring structure from substantivity claims. review_status `provisional`.

### 11. DOSE — `moderate` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. WT = `moderate` sets the row. No `high` trigger: FORM is not `two_phase`, no rich-band lipid is present (none at all). The `low` row fails because persistent non-volatile families sit above the tail. review_status `provisional`.

### 12. EXPO — `fragrance_declared`
confidence moderate · E1 — PARFUM (17) is declared; **no** individual allergens from the 26-allergen list appear, so the stronger `aromatic_or_allergen_exposure` value is not reached. No `Alcohol`/`Alcohol Denat.` note. G6 applies; flags never predict tolerance (§17.12). review_status `approved`.

### 13. ROLE — `[]` (`usage_role` unknown)
confidence moderate in the *abstention* · E1. The directions source is C5 under RC-2, and §7.13 rule 1 permits role values only from C1/C2. The text would have established `post_wash` ("Apply to damp hair"), `ends_only` ("just at the ends") and `curl_styling` ("allow curls to find their natural wave") — **none may be emitted**; all three are recorded in `supporting_signals[]` with their tier. `usage_role` = `[]`, listed in `uncertain_fields`. review_status `provisional`; routed.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `absent` (low) | No alignment/deposition film beyond a fixative; no gloss route, no goniophotometry |
| CURL | `derived_candidate` (low) | HOLD = `meaningful_hold_route` feeds the HOLD+COND+WT derivation. Confidence from formula alone is **low**: there is no formula → curl-definition mapping in the literature and technique is a large uncontrolled term (§8.2, §17.6) |
| R3 | `unknown` | No bond claim, no bond chemistry |
| LAYER | no string emitted | One unresolved quat; not the cationic-polymer case §8.4 describes |
| Buildup caution | not emitted | PERS projects `moderate` |

## §9 care_direction — `moisture` (humectant-led minimum) — **uncertain**

confidence **low** · E2 · shared_mechanism `M7_HUMECTANT_PLASTICISER`.
The v0.2 humectant-led minimum row applies literally: an L4 humectant leg is present as architecture — PROPYLENE GLYCOL (2), GLYCERIN (3), BUTYLENE GLYCOL (9), PROPANEDIOL (12) — with **no** R2 route, even though the emollient and cationic legs are thin or absent. Confidence `low`, recorded, with the thin-architecture observation as the required counter-signal. `protein` needs R2 ∈ {candidate, tested}. `balanced` needs both halves. `unknown` (the silicone-led abstention) does not apply — no silicone is declared.
**Counter-signal, recorded:** the product's material direction is arguably neither protein nor moisture but a **fixative film**, for which §9's vocabulary has no home. The humectant-led minimum row nonetheless returns `moisture`, so a styling-leaning cream projects as a moisture product. Recorded as an ambiguity; field marked uncertain. Constraint 1 observed.

---

## §10 lean matching profile

> A `provisional_boundary` record is not an exclusion: it **keeps** its lean profile (§2.3.1), with affected fields marked uncertain.

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "aqueous_solution",
  "conditioning_level": "low",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "meaningful",
  "care_direction": "moisture",
  "focus": { "primary": "curl_definition", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "conditional", "highly_damaged": "caution" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "cautions": [
    "Bringt Halt über ein Styling-Polymer – das ist etwas anderes als Pflege.",
    "Enthält deklarierte Duftstoffe.",
    "Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe."
  ],
  "uncertain_fields": ["product_form", "conditioning_level", "persistence", "focus", "care_direction", "usage_role"],
  "assumption_notes": [
    "G0 = provisional_boundary: §2.3's trap-3 sentence and the excluded_styling_first row disagree for this product.",
    "quat_structure: unresolved (Quaternium-95)."
  ]
}
```

**Focus selection (§10.2).** `curl_definition` qualifies: `HOLD ∈ {incidental_film, meaningful_hold_route}` **present as architecture** — PVP at rank 4 is unambiguously architectural, not a tail addition — plus compatible COND/WT (COND `low`, WT `moderate`; §8.2's derivation is HOLD + COND + WT and neither value is disqualifying for curl definition). One qualifying route, so step 2 returns it directly; positioning („Curlicue") corroborates and was not needed. `smoothing` — SFR `moderate`. `repair` — R2 `none_visible`. `detangling` — no C1/C2 positioning; the slip-dominant prong needs WT `low`. `volume_lightness` — needs WT `low`. `heat_styling` — HEAT `not_claimed`. `shine` — no gloss route. **`primary: curl_definition`, marked uncertain** because the G0 verdict is itself unresolved. Secondary: none.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `moderate`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 1** (`conditioning_level = low` and no qualifying repair route): `healthy: recommended`, `moderately_damaged: conditional`, `highly_damaged: caution`. Marked uncertain through `conditioning_level`.
- `texture_fit` ← **row 2** (`weight_potential = moderate`, any slip). §10.3 explicitly: `HOLD = meaningful_hold_route` **does not by itself raise curly/coily** — it triggers the G0 styling review instead, which it did. Curl branding never determines the result.
- `scalp_application_fit` ← ordered test: no `avoid` trigger fires (EXPO is `fragrance_declared` with **no** allergen block and no material alcohol note; WT is not `high`; no oil-led load; no direction says to avoid the scalp). The positive value `suitable_if_evidenced` requires C1/C2 directions explicitly directing the product at the scalp — the "from root to top" sentence is **C5** and cannot be used. `conditional` likewise requires a C1/C2 placement statement. → **`unknown`**, the default, with the fixed §18 string.

## §14 review routing

1. **G0 `provisional_boundary`** — every such record routes to review (§14). The specific question for the reviewer: does §2.3's trap-3 sentence ("meaningful_hold_route with thin conditioning is what excludes") override the `excluded_styling_first` row's requirement that directions/positioning lead on durable hold or texture?
2. **`HOLD = meaningful_hold_route`** — styling-boundary decision (§14).
3. **`quat_structure: unresolved`** — Quaternium-95 (§7.6, §14).
4. **Directions authority** — C5 only; `usage_role` `[]` and `scalp_application_fit` `unknown` are both consequences.
5. **`claim_authority_gap`** — HEAT and HUM take no-claim values because no C1/C2 source exists.
6. **§7.1 internal conflict** — the solution row excludes a long-chain fatty alcohol while §7.1's own note instructs classifying on the rest of the architecture; FORM would be `unknown` under the literal anchor.
7. **COND `low` / SLIP `moderate`** on one quat observation — the contradiction v0.2 §21 left unrepaired, reproduced here.
