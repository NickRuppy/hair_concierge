# S6 — Curlsmith Hydrate & Plump Leave-In

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 6 · 237 ml · GTIN **not established** · `formulaFingerprintSha256` ff00c634…e367f

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `verified` for formula; **no reliable identifier** — GTIN not found (documented identity-research gap, §2.4) |
| Directions verbatim | "Start with a hazelnut-sized amount of the leave-in conditioner and distribute it in your hands. Work the conditioner into your wet hair, adjusting the amount used according to the length of your hair if necessary. Style your curls as usual to shape them and increase bounce. Use a gel and/or mousse to finish your styling routine." |
| Directions authority | **C3/C4** — lockenbox.com, an exact-pack German/EU curl specialty retailer, English-language. Curlsmith is not a lockenbox brand, so RC-1 does not apply; no manufacturer German/EU page was located, and a non-German manufacturer page would be C5 under RC-2 in any case. |
| Rinse test (R11) | **PASS** — application to wet hair, styled, no rinse step; explicitly a leave-in conditioner. |

## G0 — product form

`in_category`. Water leads; conditioning is primary; the directions leave the product on the hair. Not styling-first: a fixative-class polymer is present (PVP) but a substantive conditioning architecture plainly dominates, and the directions point the user at a *separate* gel/mousse for hold.

## Reading conventions applied

**Tail marker (§3.1.1):** `Phenoxyethanol`, **rank 36** of 40. Above the tail: ranks 1–35. This is an extremely **late** marker: it nominally places twelve botanical extracts, maltodextrin, cyclodextrin and PVP "above the tail". The boundary therefore carries almost no discriminating power on this list, and the limitation is decisive for one field (HOLD/curl focus) — recorded, and routed to review (§17.14).

Where rank alone is uninformative, the second prong of "present as architecture" was used as §3.1.1 defines it: *positioned such that it plausibly constitutes part of the product's structure rather than a token addition*.

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `lgn`, trace-only)
confidence **high** · E2. CETEARYL ALCOHOL (3) paired with BEHENTRIMONIUM CHLORIDE (6) — an LGN pair high in the list — carrying a substantial lipid phase: DICAPRYLYL CARBONATE (2), COCO-CAPRYLATE/CAPRATE (4), CASTOR SEED OIL (5), SHEA BUTTER (9), JOJOBA SEED OIL (10). Decision order: not anhydrous; not `two_phase` (a true emulsifying system is present); `emulsion` matches sub-type (a) and the order stops. review_status `approved`. `presentation_form`: Cream.

### 2. COND — `high`
confidence **moderately_high** (ceiling) · E2.
LGN pair above the tail (3 + 6) **plus** several further independent lubrication routes: rich-band lipids CASTOR SEED OIL (5) and SHEA BUTTER (9); medium/dry-feel emollients DICAPRYLYL CARBONATE (2), COCO-CAPRYLATE/CAPRATE (4), JOJOBA (10); and cationic polymers GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE (11) and POLYQUATERNIUM-10 (12).
`low` excluded (persistent non-volatiles above the tail); `moderate` excluded (a full LGN pair exists). Multiple observations, no material counter-signal, so the top value at E2 is permitted (§6 rule 3). shared_mechanism `M1`. Limitations: G4; "10-in-1"-style benefit stacking is not multiple mechanisms (FS-11). review_status `approved`.

### 3. SLIP — `high`, bias `unknown`
confidence moderate (ceiling) · E2. Two independent M1 contributors: the cationic route (BTAC 6, Guar HPTC 11, PQ-10 12) and a persistent lipid/emollient load (2, 4, 5, 9, 10). Bias `unknown` — `dry_biased` requires few water-phase slip agents but Glycerin (7) and Panthenol (8) are high; `wet_biased` requires no persistent film, and the cationic polymer film is present; `both` is defined through the wet route and is self-excluding here (§17.16). review_status `provisional`.

### 4. SFR — `high`
confidence moderate (ceiling) · E2. Continuous film route: GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE (11) and POLYQUATERNIUM-10 (12), substantive cationic-polymer films. Distinct lubricating species: Dicaprylyl Carbonate (2), Coco-Caprylate/Caprate (4). Two distinct observations, so RC-4 is satisfied and the §7.4 G3 gate is not breached. `moderate` would be a single alignment route.
**counter_signal:** the film here **is** part of the baseline conditioning architecture of an LGN emulsion, which is why the `smoothing` focus does not qualify downstream (RC-5, §10.2 rule 1). review_status `provisional`.

### 5. WT — `high`
confidence **moderately_high** · E2. Both `high` limbs satisfied independently: (a) an LGN pair present as architecture — Cetearyl Alcohol (3) + Behentrimonium Chloride (6); (b) two or more persistent non-volatile families with at least one **enumerated rich/low-spreading band member** — RICINUS COMMUNIS (CASTOR) SEED OIL (5) and BUTYROSPERMUM PARKII (SHEA) BUTTER (9), alongside dry-feel esters (2, 4), a wax ester (jojoba, 10) and two cationic polymer films (11, 12).
`moderate` excluded on both limbs. Confidence rises to `moderately_high`: FORM resolves definitely and the non-volatile architecture is readable — though the late tail marker is recorded as a limitation on "readable above the tail". G9 checked: the cream presentation contributed nothing (FS-2). Limitations: dose unmeasured (§17.1); fine-hair threshold is a product judgment call (§17.11). review_status `approved`.

**Transfer caution attached (qualitative):** castor oil (5) and shea butter (9) are low-spreading, non-volatile, non-film-forming lipids present as architecture. No published instrumental transfer method exists (§17.3) — qualitative only.

### 6. PERS — `permanent_cationic`
confidence moderate · E2.
**formula_observations** GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE (11) and POLYQUATERNIUM-10 (12) — both **polymeric** quats enumerated by INCI name in the v0.2 `permanent_cationic` anchor, and both well above the tail marker at rank 36 *and* plainly architectural (they sit at ranks 11 and 12 in a coherent cationic conditioning system, not among the botanical extracts). Supporting lower classes: BEHENTRIMONIUM CHLORIDE (6) is a monomeric long-chain quat → `neutral_non_volatile`; the lipids and fatty alcohol → `neutral_non_volatile`.
**threshold_reasoning** Highest class present as architecture wins. The class is set by label-visible **polymeric quaternisation**, not by charge density (G4). The monomeric-quat rule is not engaged: BTAC is not the dominant persistent species — two polymeric quats outrank it as class-setters.
**counter_signals** FS-20: silicone-free plus a cationic polymer is **not** low buildup; this formula is silicone-free and carries two high-substantivity polymers. FS-13: this record pairs the high class **with** the buildup caution, never against it.
**limitations** G11 — mechanism ordering, no duration, no wash count, no applications-to-buildup; the circulating removal percentages are banned. review_status `approved`.

**Buildup caution emitted.**

### 7. HOLD — `incidental_film`
confidence low_moderate · E1/E2.
**formula_observations** PVP (rank 32) — an L5 fixative-class polymer — declared behind twelve botanical extracts, isopropyl alcohol, pentylene glycol, tocopherol, maltodextrin and cyclodextrin.
**threshold_reasoning** `none` is excluded: a fixative-class polymer is genuinely declared. `meaningful_hold_route` is excluded: it requires **thin or absent** conditioning architecture behind the fixative, and this formula's conditioning architecture is an LGN emulsion with two cationic polymers and a rich lipid load — it dominates comprehensively. `incidental_film` is the anchor's own description of exactly this case.
**counter_signals** The directions tell the user to add a separate gel and/or mousse "to finish your styling routine" — the product does not supply the hold. Positioning corroborates the reading; it never creates a route.
**limitations** Hold *level* is not readable (§7.7); no grade is permitted. `hold_support` has no `unknown` member by design (§10). review_status `provisional`.

### 8. HEAT — `not_claimed` → binary `false`
confidence moderate · E0. No C1/C2 source exists (retailer page only; a non-German manufacturer page would be C5), so under §2.4.1 rule 1 **the claim does not exist**. L9 closed-list check: **PVP is not an L9 member** — the closed list contains *PVP/DMAPA Acrylates Copolymer*, a different material; plain PVP has no published protection data and adding it would require new peer-reviewed evidence and a version bump (G10). §13.3 rule 4. review_status `provisional`; routed with `claim_authority_gap`.

### 9. HUM — `not_claimed`
confidence moderate · E0/E2. No C1/C2 claim, **and** no qualifying route. Two independent bars: (a) no hydrophobic continuous film-forming route — PVP is **hygroscopic and loses film stiffness as RH rises** (SR §F.1), i.e. mechanistically the wrong direction, and the cationic guar/cellulose films are polyelectrolytes, not hydrophobic films; no silicone is declared at all. (b) The humectant leg is **dominant** — GLYCERIN (7) and PANTHENOL (8) sit at ranks 7–8, high in the list, blocking `formula_plausible` outright (§7.9 step 1). FS-15/FS-6: humectants are never support for a humidity claim in either direction, and no dew-point threshold may be encoded (FS-16). review_status `approved`.

### 10. R2 — `none_visible`
confidence moderate · E1. No cationised protein, no silane derivative, no silicone quat is declared. **Trace note:** GUAR HPTC (11) and PQ-10 (12) are cationic polymers but v0.2 removed non-silicone cationic polymers from the `candidate` list, because that route rested on a charge-density property G4 forbids inferring; they feed PERS and SFR only. PANTHENOL (8) is a fibre-mechanics signal, not an R2 route (FS-24). review_status `approved`.

### 11. DOSE — `high` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. Two triggers: WT = `high`, and rich/low-spreading band members (castor, shea) present as architecture. review_status `approved`.

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1. No `Parfum` is declared, but two of the 26 EU-labelled fragrance allergens are: HYDROXYCITRONELLAL (39) and CITRONELLOL (40). Declared allergens are an exposure signal under L8 regardless of whether a `Parfum` entry accompanies them.
**notes** ISOPROPYL ALCOHOL (27) is declared. §7.12's alcohol note is keyed to `Alcohol Denat.` / `Alcohol`; isopropyl alcohol is neither, and at rank 27 in a 40-ingredient list it reads as a trace formulation solvent. Observation recorded, **no** alcohol note emitted — recorded as a small ambiguity in §7.12's enumeration.
G6 applies. review_status `provisional`.

### 13. ROLE — `[]` (`usage_role` unknown)
confidence moderate in the *abstention* · E1 · scope directions. The captured directions are C3/C4 retailer copy; §7.13 rule 1 permits role values only from C1/C2. The text would have established `post_wash` ("into your wet hair") and `curl_styling` ("Style your curls as usual to shape them") — **neither may be emitted**. Both recorded in `supporting_signals[]` with their tier. `usage_role` = `[]`, listed in `uncertain_fields`. review_status `provisional`; routed.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 consequence of the M1/M2 film |
| CURL | `derived_candidate` (low) | HOLD is `incidental_film`, so the HOLD+COND+WT derivation returns a candidate — but it was **not** selected as a focus (see below). Confidence from formula alone is low; there is no formula → curl-definition mapping in the literature and technique is a large uncontrolled term (§8.2, §17.6) |
| R3 | `unknown` | No bond claim, no bond chemistry |
| LAYER | **string emitted** | Two high-substantivity cationic polymers plus a monomeric quat; the directions explicitly instruct the user to layer a gel and/or mousse on top — the §8.4 case. One string only; no matrix, no score (§17.4) |
| Buildup caution | **emitted** | From the `permanent_cationic` evidence, non-quantitative |

## §9 care_direction — `moisture`

confidence moderate · E2. L1 (BTAC 6, Guar HPTC 11, PQ-10 12), L3 (2, 4, 5, 9, 10) and L4 (Glycerin 7, Panthenol 8) are all present as architecture, with no protein-film route. `protein` requires R2 ∈ {candidate, tested} — `none_visible`, and no protein of any kind is declared. `balanced` requires both halves and is not an uncertainty bucket. `unknown` (the silicone-led abstention) does not apply — no silicone is declared. Constraint 2: Panthenol alone never sets `protein`. Constraint 1 observed.

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "emulsion",
  "conditioning_level": "high",
  "weight_potential": "high",
  "persistence": "high",
  "hold_support": "incidental",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "caution", "medium": "conditional", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "conditional", "wavy": "recommended", "curly": "recommended", "coily": "recommended" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren.",
    "Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig.",
    "Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab.",
    "Kann mit stark anionischen Stylingprodukten flocken oder pillen. Belegt ist das nicht – im Zweifel erst an einer kleinen Partie testen.",
    "Enthält deklarierte Duftstoffe."
  ],
  "uncertain_fields": ["usage_role"],
  "assumption_notes": [
    "curl_definition declined: PVP at rank 32 is nominally above a rank-36 tail marker but was judged a token addition, not architecture."
  ]
}
```

**Focus selection (§10.2) — and the near-miss this record exists to expose.**

- `curl_definition` requires `HOLD ∈ {incidental_film, meaningful_hold_route}` **present as architecture (§3.1.1)** plus compatible COND/WT, with curl positioning corroborating only. HOLD is `incidental_film`. On the **rank** prong, PVP at rank 32 is above the tail marker at rank 36, so a literal reading would qualify the route — and rank order would then make `curl_definition` the primary focus of a curl-brand curl leave-in. On the **architecture** prong of the same §3.1.1 definition, PVP sits behind twelve botanical extracts, maltodextrin and cyclodextrin, with no plasticiser or fixative package around it: that is a token addition, not part of the product's structure. **The architecture prong was taken and the route declined.** The whole difference is an artifact of the tail marker landing at rank 36 of 40.
- `smoothing` — SFR is `high`, but the film route is the LGN emulsion's own cationic-polymer conditioning, not a dedicated film system beyond baseline conditioning (RC-5, §10.2 rule 1). Declined.
- `detangling` — no detangling-led C1/C2 positioning (no C1/C2 source exists at all); the slip-dominant prong requires WT `low`, which is `high`.
- `volume_lightness` — needs WT `low`. `heat_styling` — HEAT `not_claimed`, ROLE empty. `repair` — R2 `none_visible`, no protein/silane active. `shine` — restates the film (G3).
- Step 5: no qualifying route ⇒ **`general`**. Recorded plainly: a curl-brand leave-in projects `focus: general`, and the reason is two independent v0.2 rules (the tail marker's degeneracy and RC-5), not a judgment about the product.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `high`; fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2**. Row 3a needs COND `high` **plus** a qualifying specialist route, and §10.3 excludes a non-silicone cationic polymer and oil by name; row 3b needs R2 ∈ {candidate, tested}.
- `texture_fit` ← **row 3** (`weight_potential = high` **and** SLIP `high`). `HOLD = incidental_film` does not enter the table.
- `scalp_application_fit` ← ordered test: **`avoid`** fires twice — (a) heavy-occlusive/oil-led architecture (WT `high` with castor and shea present as architecture); (b) EXPO `aromatic_or_allergen_exposure`.

## §14 review routing

1. **No reliable identifier** — GTIN not established (§2.4, §14).
2. **Directions authority** — no C1/C2 source, so `usage_role` is `[]` (§7.13 rule 1).
3. **`claim_authority_gap`** — HEAT and HUM take their no-claim values because no C1/C2 source exists, not because the brand is silent.
4. **Tail-marker degeneracy** — the marker at rank 36 of 40 makes "above the tail" nearly vacuous and is the sole reason the `curl_definition` route had to be settled on the architecture prong. This one reading moves `focus.primary` between `curl_definition` and `general` (§3.1.1, §17.14).
