# S2 — ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol

Engine run `reference-key-2026-09-04` · Standard `leave-in-inci-v0.2` · Lane: category-developer reference key, round 2
Packet slot 2 · 100 ml · GTIN 4305615946733 · `formulaFingerprintSha256` ae0cdabd…f3a8

---

## G1 — identity and directions

| Item | Value |
|---|---|
| Identity status | `verified_with_minor_source_difference` |
| Formula source | rossmann.de product-detail JSON for the exact GTIN, 2026-09-04; INCI matched character-for-character by codecheck.info (T3) |
| Directions verbatim | „Den Conditioner auf die handtuchtrockenen Längen und Spitzen verteilen und einmassieren. Anschließend die Haare wie gewohnt stylen." |
| Directions authority | rossmann.de. **C2-equivalent under RC-1**: ISANA PROFESSIONAL is Rossmann's own brand (Dirk Rossmann GmbH is named as manufacturer), sold only through rossmann.de, with no independent manufacturer domain. This is the brand owner's own German product page, not third-party retailer copy. Routed to review. |
| Rinse test (R11) | **PASS** — no rinse instruction in the application text or the separate storage block; applied to towel-dried (not rinsed) hair and left in while the hair is styled. |
| Preserved conflict (G5) | The same rossmann.de page's body copy calls the product „…Hyaluron & Care" while its title/name field and every third-party aggregator call it „…Hyaluron & Panthenol". Same GTIN and Artikelnummer throughout — an internal retailer copy inconsistency, preserved, not resolved. |

## G0 — product form

`in_category`. Aqua leads; conditioning is the primary function; the directions leave the product on the hair.

## Reading conventions applied

**Tail marker (§3.1.1):** `Sodium Benzoate`, **rank 9** of 21. Above the tail: ranks 1–8 — Aqua, Cetearyl Alcohol, Glycerin, Dicaprylyl Ether, Guar Hydroxypropyltrimonium Chloride, Betaine, Cetrimonium Chloride, Distearoylethyl Hydroxyethylmonium Methosulfate. The marker sits in a sensible mid-list position, so the boundary is comparatively informative here. Heuristic limitation carried throughout (§17.14).

---

## §7 dimensions

### 1. FORM — `emulsion` (subtype `lgn`, trace-only)

- confidence **high** · E2 · scope formula
- **rationale** A cationic-surfactant + long-chain-fatty-alcohol lamellar gel network pair sits at the top of the list.
- **formula_observations** CETEARYL ALCOHOL (2) paired with CETRIMONIUM CHLORIDE (7) and DISTEAROYLETHYL HYDROXYETHYLMONIUM METHOSULFATE (8, an esterquat cationic surfactant); all four within ranks 1–8, above the tail marker. DICAPRYLYL ETHER (4) is the carried lipid phase.
- **threshold_reasoning** Decision order: not anhydrous (Aqua rank 1); not `two_phase` (a true emulsifying system is present, so the architecture is not unemulsified); `emulsion` matches on sub-type (a) and the order stops there, so `microemulsion` and `aqueous_or_hydroalcoholic_solution` are not reached.
- **limitations** The LGN/non-LGN distinction is trace-only and is not projected (§7.1, §10.1). Thin-lotion-vs-milk is rheological and carries no decision weight.
- review_status `approved`

### 2. COND — `high`

- confidence **moderately_high** (at the §7.2 ceiling) · E2
- **rationale** An LGN pair above the tail plus a further independent lubrication route.
- **formula_observations** LGN pair: CETEARYL ALCOHOL (2) + CETRIMONIUM CHLORIDE (7) / DISTEAROYLETHYL HYDROXYETHYLMONIUM METHOSULFATE (8). Further independent route: GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE (5), a cationic polymer film route. Third contributor: DICAPRYLYL ETHER (4), dry-feel emollient.
- **product_inferences** Leave-on lubrication at full applied dose; deposition efficiency is not a hidden variable here (SR §B.1).
- **counter_signals** Panthenol (11) and Sodium Hyaluronate (12) sit below the tail and contribute nothing to the anchor. Silicone-free positioning is not a weight or buildup statement (FS-3, FS-20).
- **shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`
- **threshold_reasoning** `high` requires an LGN pair above the tail **plus** at least one further independent lubrication route — both are satisfied, by two separate observations (a cationic polymer and a dry-feel ether), so this is not one observation counted twice. `moderate` would apply only without a full LGN pair; the pair is present at ranks 2/7/8.
- **limitations** Concentration invisible (G4). E2 cap.
- review_status `approved`

### 3. SLIP — `high`, bias `unknown`

- confidence moderate (at the §7.3 ceiling) · E2
- **formula_observations** Contributor 1 — cationic route: Guar HPTC (5), Cetrimonium Chloride (7), esterquat (8). Contributor 2 — persistent lubricant: LGN fatty-alcohol phase (2) and Dicaprylyl Ether (4).
- **threshold_reasoning** `high` requires two or more *independent* M1 contributors present as architecture; a cationic route plus a persistent lubricant is the anchor's own example. `moderate` would be a single route.
- **bias reasoning** `unknown`. `dry_biased` requires a persistent film with **few water-phase slip agents**, and Glycerin (3) and Betaine (6) sit above the tail; `wet_biased` requires **no** persistent film, and the Guar HPTC film is present; `both` is defined via the wet route, which is defined by the film's absence — so the enum is self-excluding for an LGN emulsion with a cationic polymer. Open gap §17.16; returned `unknown` rather than guessing.
- review_status `provisional`

### 4. SFR — `high`

- confidence moderate (ceiling) · E2
- **formula_observations** Continuous film route: GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE (5), a substantive cationic-polymer film, above the tail. Distinct lubricating species: DICAPRYLYL ETHER (4) and the LGN fatty-alcohol phase (2).
- **shared_mechanism_ids** `M1_DEPOSITION_SURFACE_LUBRICATION`, `M2_SUBSTANTIVE_FILM_SUPPORT`
- **threshold_reasoning** The anchor is met literally: a substantive cationic-polymer film plus a lubrication route. The §7.4 G3 gate is read as barring a *single* observation from being counted twice, not as barring COND and SFR from reading the same architecture — the film (M2) and the lubricating ether (M1) are two distinct observations (lane convention RC-4). `moderate` would be a single alignment route.
- **counter_signals** The film here **is** the product's baseline conditioning architecture, not something beyond it. That is decision-relevant downstream: it is why the `smoothing` focus does **not** qualify (§10.2 rule 1, lane convention RC-5).
- **limitations** Ambient smoothing only; no humidity statement (§7.4).
- review_status `provisional`

### 5. WT — `high`

- confidence **moderately_high** · E2
- **rationale** An LGN pair present as architecture. That alone satisfies the `high` anchor.
- **formula_observations** CETEARYL ALCOHOL (2) + CETRIMONIUM CHLORIDE (7) + esterquat (8), all above the tail marker at rank 9; supported by the cationic polymer film (5) and Dicaprylyl Ether (4).
- **counter_signals** No rich/low-spreading band member is declared anywhere in the list — the `high` value rests entirely on the LGN limb of the anchor, not the multi-family limb.
- **threshold_reasoning** `high` = "an LGN pair present as architecture **and/or** two or more persistent non-volatile families with at least one rich-band member" — the first limb is satisfied. `moderate` (single family or multi-family) is excluded by the LGN pair. G9 checked: FORM contributed nothing; the value rests on observed ranks. The confidence rises to `moderately_high` because both §7.5 conditions hold — FORM resolves to a definite architecture and the non-volatile architecture is fully readable above the tail.
- **limitations** Dose is the unmeasured term (§17.1). The fine-hair consequence in the fit table is a **product judgment call**, not a derived scientific constant (§7.5, §17.11).
- review_status `approved`

Transfer caution: not attached (no low-spreading non-volatile non-film-forming lipid load).

### 6. PERS — `permanent_cationic`

- confidence moderate (at the low–moderate ceiling's top) · E2
- **formula_observations** GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE (5) — a **polymeric** quat, enumerated by INCI name in the v0.2 `permanent_cationic` anchor, above the tail. Supporting, lower classes present: CETRIMONIUM CHLORIDE (7) and the esterquat (8) are monomeric long-chain quats → `neutral_non_volatile`; Cetearyl Alcohol → `neutral_non_volatile`.
- **threshold_reasoning** Highest class present as architecture wins. The class is set by **structure visible on the label** (polymeric quaternisation), not by charge density, which G4 forbids inferring (§7.6 v0.2). The monomeric-quat rule is not engaged, because a monomeric quat is not the dominant persistent species here — the polymeric quat outranks it as the class-setting species. `ph_dependent_cationic` requires an amodimethicone or amidoamine, both absent.
- **counter_signals** FS-20 double-check: silicone-free plus a cationic polymer is **not** low buildup. FS-13 double-check: this record pairs `permanent_cationic` with the buildup caution, not against it.
- **limitations** G11 — mechanism ordering only; no duration, wash count, applications-to-buildup or clarification schedule. The circulating removal percentages are banned (§7.6).
- review_status `approved`

**Buildup caution emitted** (from the same evidence, non-quantitative, G3 rule 4).

### 7. HOLD — `none`
confidence moderate · E1 — no L5 fixative-class polymer is declared. review_status `approved`.

### 8. HEAT — `not_claimed` → binary `false`
confidence moderate · E0. No C1/C2 heat claim: the brand-owner page positions the product as „feuchtigkeitsspendend, silikonfrei, trockenes Haar"; no „Hitzeschutz" and no temperature figure was found. L9 closed-list check: **no L9 member is declared**. §13.3 rule 4 — no claim ⇒ `false`. review_status `provisional` (RC-1).

### 9. HUM — `not_claimed`
confidence moderate · E0/E2. No C1/C2 humidity or anti-frizz claim, **and** no qualifying route. Two independent bars: (a) there is no hydrophobic continuous film-forming route — the Guar HPTC film is a cationic polyelectrolyte, not a hydrophobic film, and no persistent silicone is present; (b) the humectant architecture is **dominant** — GLYCERIN (3) and BETAINE (6) above the tail plus PANTHENOL (11) and SODIUM HYALURONATE (12), which blocks `formula_plausible` outright (§7.9 step 1). Glycol-as-solvent question does not arise (glycerin is not plausibly a solvent here). review_status `approved`.

### 10. R2 — `none_visible`
confidence moderate · E1. Trace note: GUAR HYDROXYPROPYLTRIMONIUM CHLORIDE is a cationic polymer but **not** a cationised protein, silane derivative or silicone quat, and v0.2 removed non-silicone cationic polymers from the `candidate` list because they rested on a charge-density property G4 forbids inferring. PANTHENOL (11) is a fibre-mechanics signal, not an R2 route (FS-24). No protein of any kind is declared. review_status `approved`.

### 11. DOSE — `high` (derived)
derived_from `[WT, FORM, L3 spreading class]` · confidence moderate · E2. WT = `high` fires the `high` row directly. review_status `approved`. Limitation: no market-representative consumer dose figures exist (§17.1).

### 12. EXPO — `aromatic_or_allergen_exposure`
confidence moderate · E1 — PARFUM (10) plus declared allergens HEXYL CINNAMAL (15), ALPHA-ISOMETHYL IONONE (17), GERANIOL (18), CITRONELLOL (19). No `Alcohol`/`Alcohol Denat.` note (Cetearyl Alcohol is a fatty alcohol, not an exposure alcohol). G6 applies. review_status `approved`.

### 13. ROLE — `[post_wash, ends_only]`
confidence moderate · E1 · scope directions. Both values from the single RC-1 C2-equivalent sentence dated 2026-09-04:
- `post_wash` ← „Den Conditioner auf die **handtuchtrockenen** Längen und Spitzen verteilen und einmassieren."
- `ends_only` ← the same sentence's placement restriction, „**Längen und Spitzen**".
`heat_styling` not taken — „Anschließend die Haare wie gewohnt stylen" names no heat tool. `refresh` not taken — nothing about dry hair between washes. `curl_styling` not taken. One sentence establishing two roles is permitted (§7.13). review_status `provisional` (RC-1).

---

## §8 demoted flags

| Flag | Value | Basis |
|---|---|---|
| SHN | `present` (low) | M3 optical consequence of the M1/M2 film; no independent value (§8.1) |
| CURL | `none` (low) | HOLD = `none` |
| R3 | `unknown` | No bond claim, no recognised bond chemistry; the enum has no negative member |
| LAYER | **string emitted** | A high-charge cationic polymer film plus two monomeric quats is the layering-interaction case §8.4 describes. One string only; no matrix, no score (§8.4, §17.4) |
| Buildup caution | **emitted** | From the `permanent_cationic` evidence, non-quantitative |

## §9 care_direction — `moisture`

confidence moderate · E2 · shared_mechanism_ids `M1`, `M7`.
L1 (Cetrimonium Chloride 7, esterquat 8, Guar HPTC 5), L3 (Dicaprylyl Ether 4) and L4 (Glycerin 3, Betaine 6) are all present as architecture above the tail, with no protein-film route. `protein` requires R2 ∈ {candidate, tested} — absent. `balanced` requires both an R2 route and a moisture leg above the tail — the R2 half is absent, and `balanced` is not an uncertainty bucket. `unknown` (the silicone-led abstention) does not apply: this is not a silicone-led architecture — no silicone is declared at all. Three legs above the tail supports up to `moderate` confidence. Counter-signal: the „Hyaluron & Panthenol" positioning is recorded, never used as a route (§9 constraint 3); Panthenol alone never sets `protein` (constraint 2). Constraint 1 observed: `care_direction` did not drive WT, PERS, HOLD or HEAT.

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
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["post_wash", "ends_only"],
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
  "uncertain_fields": [],
  "assumption_notes": ["usage_role rests on reading convention RC-1 (rossmann.de as the brand owner's page for ISANA)."]
}
```

**Focus selection (§10.2).** Step 1: `smoothing` — SFR is `high`, but the film route **is** the baseline conditioning architecture (an LGN emulsion's own cationic polymer), so it does not rest on evidence distinct from baseline conditioning and fails step 1 (RC-5). `detangling` — no detangling-led C1/C2 positioning (the product is sold as a moisturising leave-in conditioner) and the slip-dominant prong requires WT `low`, which is `high`. `volume_lightness` — needs WT `low`. `curl_definition` — HOLD `none`. `heat_styling` — HEAT `not_claimed`. `repair` — R2 `none_visible` and no protein/silane active in the marketing position. `shine` — would restate the smoothing film (G3). Step 5: no qualifying route ⇒ **`general`**.

**Fit derivations.**
- `hair_thickness_fit` ← weight-led row `high`. The fine-hair `caution` carries the §7.5 judgment-call limitation. DOSE does not modify this table (G3).
- `damage_fit` ← **row 2**. Row 3a requires COND `high` **plus** a qualifying specialist route, and §10.3 states explicitly that a **non-silicone cationic polymer does not qualify** — Guar HPTC is exactly that. Row 3b requires R2 ∈ {candidate, tested} — `none_visible`. So a `high`-conditioning product sits at `highly_damaged: conditional`.
- `texture_fit` ← **row 3** (`weight_potential = high` **and** SLIP `high`). Not row 4, so no §14 texture routing.
- `scalp_application_fit` ← ordered test: `avoid` fires on `aromatic_or_allergen_exposure`. The directions' „Längen und Spitzen" placement would otherwise give `conditional`; the avoid trigger beats it. G6 applies.

## §14 review routing

1. **`claim_authority_gap`** — the ROLE read and both claim reads depend on RC-1 (rossmann.de as the brand owner's page). If RC-1 is rejected, `usage_role` becomes `[]` and moves to `uncertain_fields`; HEAT and HUM are unchanged.
2. **Identity** — the retailer-internal name conflict („Hyaluron & Care" vs „Hyaluron & Panthenol") is preserved under G5.
3. Not routed for `PERS = permanent_cationic` + `refresh`: the role set does not include `refresh`.
