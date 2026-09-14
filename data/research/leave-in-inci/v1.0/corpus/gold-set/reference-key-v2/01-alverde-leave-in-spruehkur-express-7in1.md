# S1 — alverde NATURKOSMETIK Leave-In Sprühkur Express 7in1

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, calibration round 2
Packet slot 1 · 75 ml · GTIN 4066447919387 · `formulaFingerprintSha256` cb08a99d…f212

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `verified` |
| Market | DE |
| Formula source | dm.de (T1, DOM/snippet capture), 2026-09-03 |
| Directions status | `captured` |
| Directions verbatim | „Je nach Bedarf aus ca. 30cm Entfernung in die Haarlängen und -spitzen sprühen. Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden. HINWEIS: Bitte vor Gebrauch schütteln. Kontakt mit den Augen vermeiden." |
| Directions authority | dm.de. Packet tier C3. **This lane reads it as C2-equivalent under reading convention RC-1**: alverde is dm's own brand, so dm.de is the brand owner's German product page, not third-party retailer copy. §2.4.1 defines tiers by source type and does not address private label. Record routes to review with a `claim_authority_gap` note. |
| Rinse test (R11) | **PASS** — no rinse, wash-out or contact-time-then-rinse instruction anywhere in the directions. |

**Identity observation raised this pass.** Current dm listings for this exact product carry GTIN 4067796199635 (dm-Art. 3090444 / a second dm page at `…-p4067796199635.html`); the packet's frozen GTIN 4066447919387 was not reproduced. Preserved as a conflict, not resolved (G5); routed to review.

## G0 — product form

`in_category`. Aqua leads; the directions leave the product on the hair; conditioning/detangling is primary. Not anhydrous (Aqua rank 1). Not styling-first (no L5 fixative present at all).

## Reading conventions applied

- **Tail marker (§3.1.1):** `Levulinic Acid`, **rank 9** of 32 (with `Sodium Levulinate` at rank 10 — the enumerated capped pair). Ranks 1–8 read "above the tail"; ranks 9–32 are tail members and are *unpositioned, not absent* (§3.1.1 rule 4).
- Heuristic limitation carried on every anchor below that turns on it: no published method validates the capped-preservative-rank convention against measured concentrations (§17.14).

---

## §7 dimensions

### 1. FORM — `two_phase`

- **decision_type** `direct_product_property` · **confidence** moderate · **E2** · **scope** formula
- **rationale** An unemulsified water-plus-oil architecture: a real oil load sits at rank 2 and there is no emulsifier and no solubiliser package anywhere in the list capable of carrying it.
- **formula_observations** AQUA (1); HELIANTHUS ANNUUS HYBRID OIL (2); ALCOHOL DENAT. (3); DICAPRYLYL ETHER (5); ISOAMYL LAURATE (8); RICINUS COMMUNIS SEED OIL (11). Absence pattern: no cationic surfactant, no fatty alcohol, no PEG-/polysorbate-/Trideceth-/Laureth-type solubiliser, no polyacrylamide or silicone emulsifier anywhere in 32 declared ingredients.
- **product_inferences** The oil phase is delivered unemulsified, so the delivered oil:water ratio per actuation depends on shake quality (SR §M.9).
- **supporting_signals** „Bitte vor Gebrauch schütteln" — corroboration only, not required (§7.1 v0.2).
- **counter_signals** Alcohol denat. at rank 3 could act as a partial co-solvent; that is not a solubiliser package and does not create an emulsion or microemulsion row.
- **derived_from** —
- **threshold_reasoning** Decision order tested in sequence: `anhydrous_serum_or_oil` fails (Aqua rank 1); `two_phase` matches (oil load above the tail, no emulsifier, no solubiliser package) and the order takes the first match, so `emulsion`, `microemulsion` and `aqueous_or_hydroalcoholic_solution` are not reached. `emulsion` would need a true O/W emulsifying system — none is declared. `aqueous_or_hydroalcoholic_solution` would need the oil load to be absent or unreadable — it is at rank 2.
- **limitations** Tail-marker heuristic (§17.14). FORM is a high-confidence architecture label and a **low**-confidence weight proxy (G9).
- **review_status** `provisional`

`presentation_form` metadata: Sprühkur (spray). `emulsion_subtype`: n/a. Both trace-only (§10.1.1).

### 2. COND — `moderate`

- **confidence** moderate · **E2** · **scope** formula
- **rationale** One coherent conditioning route: a persistent emollient package above the tail, with no LGN pair and no cationic species at all.
- **formula_observations** HELIANTHUS ANNUUS HYBRID OIL (2, high-oleic sunflower — medium band by the §7.5 unenumerated-oil convention); DICAPRYLYL ETHER (5, dry-feel/high-spreading); ISOAMYL LAURATE (8, dry-feel/high-spreading). Absent: any quat, any cationic polymer, any silicone.
- **product_inferences** Leave-on lubrication from a lipid deposit; the whole applied dose stays, so deposition efficiency is not the bottleneck (SR §B.1).
- **counter_signals** Castor oil (rank 11) and three plain hydrolysates (ranks 13–15) sit below the tail marker and cannot be read as architecture on rank alone. „7in1" naming is FS-11 and contributes nothing.
- **shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
- **threshold_reasoning** `low` is excluded because a persistent non-volatile (sunflower oil, rank 2) sits above the tail — the `low` anchor requires none. `high` is excluded because it requires an LGN pair above the tail plus a further independent route, and there is no cationic surfactant/fatty-alcohol pair anywhere in the list.
- **limitations** Concentration invisible (G4); tail-marker heuristic.
- **review_status** `provisional`

### 3. SLIP — `moderate`, bias `unknown`

- **confidence** low_moderate · **E2**
- **rationale** One M1 contributor present as architecture — a lipid deposit. Two or more *independent* contributors would be needed for `high`.
- **formula_observations** As COND.
- **counter_signals** Three lipid species are present, but they are three members of one mechanism (M1 lipid deposit), not three mechanisms (§6 rule 1, FS-11).
- **threshold_reasoning** `high` requires two or more independent M1 contributors — the anchor's own example is "cationic route + persistent lubricant"; here every contributor is a lipid. `low` requires no persistent lubricant, which is false.
- **bias reasoning** The §7.3 bias enum has no value that fits a non-film persistent lipid load: `wet_biased` requires no persistent film (there is a persistent lipid deposit), `dry_biased` requires a persistent *film* (a lipid deposit is discontinuous), `both` requires the wet route which is defined by the absence of the persistent film. Returned `unknown` per open gap §17.16.
- **review_status** `provisional`

### 4. SFR — `moderate`

- **confidence** low_moderate · **E2**
- **rationale** One alignment route: a dry-feel/medium emollient package. No continuous film route of any kind.
- **formula_observations** DICAPRYLYL ETHER (5), ISOAMYL LAURATE (8), HELIANTHUS ANNUUS HYBRID OIL (2).
- **counter_signals** No persistent silicone and no substantive cationic-polymer film anywhere in the list.
- **shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
- **threshold_reasoning** `high` requires a continuous surface-film route (persistent silicone or substantive cationic-polymer film) plus a lubrication route; neither film type is present. `low` requires no persistent film *and* water phase plus humectants only — the emollient package rules it out.
- **limitations** SFR is ambient smoothing only; humidity behaviour belongs entirely to HUM (§7.4).
- **review_status** `provisional`

### 5. WT — `moderate` (multi-family row, §7.5)

- **confidence** moderate (capped by the row) · **E2**
- **rationale** Two persistent non-volatile families above the tail, neither of them a rich/low-spreading band member, and no LGN pair.
- **formula_observations** Family 1 — liquid vegetable oil: HELIANTHUS ANNUUS HYBRID OIL (rank 2). Family 2 — dry-feel ester/ether emollients: DICAPRYLYL ETHER (rank 5), ISOAMYL LAURATE (rank 8).
- **counter_signals (MANDATORY, §4)** The multi-family observation itself: the families are (1) an unenumerated liquid vegetable oil at rank 2, read in the **medium** band by the §7.5 convention rather than the rich band, and (2) dry-feel high-spreading esters at ranks 5 and 8. **What holds the value below `high` is the absent rich/low-spreading band member** — no coconut, olive, castor, avocado, shea, mango, cocoa, petrolatum or heavy mineral oil sits above the tail. Castor oil is declared, but at rank 11, below the marker. `high` is about occlusion, weight and transfer, and none of those is evidenced here.
- **counter_signals (second)** A single-family reading is also defensible (all three are emollients); it returns the same value via the plain `moderate` row, so the anchor choice is not decision-relevant here.
- **shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
- **threshold_reasoning** `low` is excluded: persistent non-volatile families sit above the tail. `high` is excluded: no LGN pair, and the two-or-more-families route requires at least one rich-band member. G9 was checked in both directions — the `two_phase` FORM label contributed nothing to this value, and the value rests only on the observed ranks of the oil/ester load.
- **limitations** Dose remains the unmeasured term (§17.1). No evidence establishes a residue load at which fine hair reads as limp — any fine-hair consequence downstream is a **product judgment call** (§7.5, §17.11). Tail-marker heuristic.
- **review_status** `provisional`

Transfer caution: **not** attached. The low-spreading, non-film-forming lipid (castor oil) sits below the tail; the above-tail load is medium- and high-spreading.

### 6. PERS — `neutral_non_volatile`

- **confidence** low_moderate · **E2**
- **rationale** The persistent species are oils and esters. No quat of any kind, no polymer, no silicone.
- **formula_observations** Vegetable oils (2, 11, 18), esters/ethers (5, 8), Tocopherol (17). Absence: no `Polyquaternium-x`, no `Silicone Quaternium-x`, no Quaternium-80, no Guar HPTC, no cationised protein, no amodimethicone, no amidoamine.
- **counter_signals** Alcohol denat. is volatile and contributes nothing to persistence (M6).
- **threshold_reasoning** `permanent_cationic` and `ph_dependent_cationic` require enumerated species that are absent. `volatile_or_water_soluble` is excluded because non-volatile lipids are the dominant persistent species. Monomeric-quat rule not engaged (no quats).
- **limitations** G11 — the class is a mechanism ordering, never a duration, a wash count or an applications-to-buildup figure.
- **review_status** `provisional`

Buildup caution: not emitted (projection is `moderate`, not `high`).

### 7. HOLD — `none`
- **confidence** moderate · **E1** — no L5 fixative-class polymer is declared. Inulin (rank 7) is a polysaccharide, not a fixative and not on the L5 list. No rheology-exclusion candidates either. `review_status` `approved`.

### 8. HEAT — `not_claimed` → binary `provides_heat_protection: false`

- **confidence** moderate · **E0** · **scope** product
- **claim authority (§2.4.1, G13)** No heat claim exists. The benefit set carried on the brand-owner page is moisture, split-end counteraction, shine, detangling, surface protection and lightness — verified this pass via dm.de search-result product copy for dm-Art. 3090444 / GTIN 4067796199635. No „Hitzeschutz" and no temperature figure anywhere.
- **formula_observations** L9 closed-list check: HYDROLYZED WHEAT PROTEIN is declared — an L9 member — at **rank 14, below the tail marker at rank 9**.
- **threshold_reasoning** Two independent v0.2 rules each stop any upgrade, and they compose (§5 L9 tail-member rule 3): (a) the L9 member is not above the tail, so it is not "a plausible film-forming context" and earns no state upgrade; (b) there is no C1/C2 claim, and **a formula does not manufacture a claim** — trace state stays `not_claimed` and the binary stays `false` (§13.3 rule 4). `claim_only` would require a C1/C2 claim; `formula_plausible` would require the L9 member above the tail **and** a claim.
- **limitations** The McMullen & Jachowicz result for hydrolyzed wheat protein is one specific protein at a defined concentration in a model system — a concentration the INCI list cannot confirm (§5 L9 rule 4).
- **review_status** `provisional` — routed for the RC-1 authority question only.

### 9. HUM — `not_claimed`
- **confidence** moderate · **E0/E2** — no C1/C2 humidity or anti-frizz claim (verified as above) **and** no qualifying route: there is no hydrophobic continuous film-forming route (no VP/VA-class fixative, no persistent hydrophobic silicone). Humectant leg present and material — GLYCERIN (4), PENTYLENE GLYCOL (6), INULIN (7) — which is a counter-signal for humidity resistance in any case and never support in either direction (SR §E.1, FS-15). `formula_plausible` is unreachable without a route. `review_status` `provisional`.

### 10. R2 — `none_visible`
- **confidence** moderate · **E1**
- **Mandatory trace note (§7.10 v0.2):** three plain hydrolysates are declared — HYDROLYZED CORN PROTEIN (13), HYDROLYZED WHEAT PROTEIN (14), HYDROLYZED SOY PROTEIN (15). They were observed and do not qualify: what makes a protein an R2 route is **cationisation or silane functionalisation**, not rank, and none of the three carries either. They are `none_visible` at any position. Arginine (12) is an amino acid, not a film route.
- **threshold_reasoning** `candidate` requires the closed list — cationised protein, silane derivative, or silicone quat — present as architecture. None is declared. `unknown` is not taken: the formula is complete and the context is resolved.
- **review_status** `approved`

### 11. DOSE — `high` (derived)
- **derived_from** `[WT, FORM, L3 spreading class]` · **confidence** low_moderate · **E2**
- **threshold_reasoning** The `high` row fires on `FORM = two_phase` independently of WT, and §7.5's G9 resolution clause 3 confirms this is the one place the form label legitimately carries information: it is a **dose-variability** statement, not a weight statement. WT is `moderate`, which alone would give `moderate`.
- **counter_signals** §7.11's "DOSE follows WT" paragraph says any DOSE value disagreeing with its WT input is a G3 violation, which conflicts with the explicit `two_phase` trigger in the same table. Read the paragraph as scoped to the multi-family WT row it was written for; recorded as a residual ambiguity.
- **limitations** No published market-representative consumer dose figures exist for any leave-in form (§17.1); two-phase products are the least dose-predictable form and the variability is unmeasured (§17.9).
- **review_status** `provisional`

### 12. EXPO — `aromatic_or_allergen_exposure`
- **confidence** moderate · **E1** — PARFUM (23) plus a declared allergen block: GERANIOL, LIMONENE, TERPINEOL, GERANYL ACETATE, LINALYL ACETATE, VANILLIN (24–31), plus clearly aromatic essential oils: CITRUS AURANTIUM BERGAMIA PEEL OIL, CITRUS LIMON PEEL OIL, JUNIPERUS VIRGINIANA OIL.
- **notes** `ALCOHOL DENAT.` at **rank 3** — materially present; recorded as an additional exposure note (L8).
- **limitations** G6 — exposure statements only. Sensitive-scalp tolerance is not derivable from an INCI list (§17.12).
- **review_status** `approved`

### 13. ROLE — `[ends_only, post_wash, refresh]`
- **confidence** low_moderate · **E1** · **scope** directions
- One verbatim direction sentence per value (§7.13 rule 2), all from the RC-1 C2-equivalent source dated 2026-09-03:
  - `ends_only` ← „Je nach Bedarf aus ca. 30cm Entfernung in die Haarlängen und -spitzen sprühen."
  - `post_wash` ← „Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden." (damp-hair application)
  - `refresh` ← same sentence (dry-hair application between washes)
- **counter_signals** One sentence carries both `post_wash` and `refresh`, which §7.13 permits but which makes each value weaker than a dedicated sentence would; „feuchtes Haar" is not explicitly „frisch gewaschen". „Bitte vor Gebrauch schütteln" is a handling instruction and establishes **no** role. Confidence held at low_moderate on both counts.
- **threshold_reasoning** `heat_styling` not taken — no heat tool is named. `curl_styling` not taken — no curl-forming instruction.
- **review_status** `provisional` — the whole ROLE read depends on RC-1.

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `smoothing_shine_qualifier: present` (low) | Optical consequence (M3) of the emollient alignment route; no independent value, no gloss route, no goniophotometry (§8.1, FS-23) |
| CURL | `none` (low) | HOLD = `none`, so the HOLD+COND+WT derivation returns nothing |
| R3 | `unknown` (moderate) | No bond claim and no recognised bond chemistry. The §8.3 enum has no negative member, so `unknown` is the only available value — recorded as a small standard gap |
| LAYER | no string emitted | No cationic polymer or substantive film that would meet an anionic styler; §8.4 permits at most one string and none is warranted |
| Buildup caution | not emitted | PERS projects `moderate` |

## §9 care_direction — `moisture`

- **confidence** moderate · **E2** · **shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`, `M7_HUMECTANT_PLASTICISER`
- **rationale** An L3 emollient leg and an L4 humectant leg are both present as architecture above the tail, with no protein-film route.
- **formula_observations** L3: sunflower oil (2), dicaprylyl ether (5), isoamyl laurate (8). L4: glycerin (4), pentylene glycol (6), inulin (7). L1: absent.
- **threshold_reasoning** `protein` requires R2 ∈ {candidate, tested} above the tail — R2 is `none_visible`. `balanced` requires both an R2 route and a moisture leg above the tail — the R2 half is absent, and `balanced` is explicitly not an uncertainty bucket. `unknown` is not taken: the architecture is neither silicone-led nor unreadable, and §9's "any one leg present as architecture is sufficient" rule is met by two legs (L3 + L4), which supports up to `moderate` confidence.
- **counter_signals** Marketing position („7in1", plant keratin, three hydrolysates) points at protein. **Positioning never sets the value** (§9 constraint 3): the only proteins are plain hydrolysates below the tail.
- **limitations** `care_direction` may not drive weight, persistence, hold or heat matching (§9 constraint 1).

---

## §10 lean matching profile

```jsonc
{
  "model_version": "leave-in-matching-v0.2",
  "category_standard_version": "leave-in-inci-v0.2",
  "product_form": "two_phase",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["ends_only", "post_wash", "refresh"],
  "specialist_functions": {
    "provides_heat_protection": false,
    "humidity_resistance": "not_claimed"
  },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "cautions": [
    "Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig.",
    "Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark.",
    "Enthält deklarierte Duftstoffe.",
    "Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben."
  ],
  "uncertain_fields": ["weight_potential", "persistence"],
  "assumption_notes": [
    "usage_role rests on reading convention RC-1 (dm.de as the brand owner's page for alverde)."
  ]
}
```

**Focus selection (§10.2 procedure).** Step 1 — collect qualifying routes: `volume_lightness` fails (needs WT `low`; WT is `moderate`); `detangling` fails both prongs (no detangling-led C1/C2 positioning — detangling is one of seven listed benefits, which is FS-11, not a positioning; and the slip-dominant prong needs WT `low`); `smoothing` fails (needs SFR `high`); `curl_definition` fails (HOLD `none`); `heat_styling` fails (HEAT `not_claimed`); `repair` fails (R2 `none_visible`, and generic repair/keratin naming cannot set it); `shine` fails (no distinct gloss route — adding it would restate the M1 film, G3). Step 5 — no qualifying route ⇒ **`general`**. Secondary: none; `general` is never a secondary value.

**Fit derivations.**
- `hair_thickness_fit` ← `[weight_potential, product_form]`, weight-led row `moderate`. Every fine-hair value carries the §7.5 judgment-call limitation: no evidence establishes a residue load at which fine hair reads as limp (§17.11). DOSE does **not** additionally modify this table (G3, §7.11) — the `high` DOSE emits a dosing caution string instead.
- `damage_fit` ← `[conditioning_level, repair_surface_film, bond_flag, product_evidence]`, **row 2** (`conditioning_level ∈ {moderate, high}` with no qualifying repair route). Row 3a is unreachable (COND is not `high`, and no distinct L6 substantive film route exists); row 3b is unreachable (R2 = `none_visible`).
- `texture_fit` ← `[weight_potential, slip_combability_potential, hold_route_state]`, **row 2** (`weight_potential = moderate`, any slip). Not row 4 or 5, so no §14 texture routing.
- `scalp_application_fit` ← `[directions, fragrance_scalp_exposure]`, ordered test: **`avoid` fires first** on the EXPO trigger — `aromatic_or_allergen_exposure`, reinforced by `fragrance_declared` combined with a materially present Alcohol denat. note. The directions' ends-only placement would otherwise give `conditional`; an `avoid` trigger beats a directions-based value (§10.3.1 ordering). G6 applies: this is an exposure statement, not a tolerance prediction.

## §14 review routing

1. **Two-phase product** — the least dose-predictable form (§14, SR §M.9).
2. **`claim_authority_gap`** — the whole claim and ROLE read depends on reading convention RC-1 (dm.de treated as the brand owner's page). If a reviewer rejects RC-1, `usage_role` becomes `[]` and moves to `uncertain_fields`; HEAT and HUM are unchanged (both are `not_claimed` either way).
3. **Identity** — GTIN discrepancy raised this pass (packet 4066447919387 vs current listings 4067796199635); preserved, not resolved (G5).
