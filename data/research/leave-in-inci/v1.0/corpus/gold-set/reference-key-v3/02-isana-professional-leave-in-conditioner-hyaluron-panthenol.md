# Slot 2 — ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Mainstream milk/lotion

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | ISANA PROFESSIONAL — Leave-In Conditioner Hyaluron & Panthenol |
| Pack / market | 100 ml · DE |
| GTIN | 4305615946733 |
| Formula source | rossmann.de (dan 124771), captured 2026-09-04; codecheck.info corroborates character-for-character |
| Identity status | `verified_with_minor_source_difference` |
| Directions status | `captured`, rinse test PASS |
| Claims status | `none_found_at_C1_C2` — a genuine negative, not a missed search |
| Fingerprint | `ae0cdabd5102dbe40748f9098b6ccb1de70ee4097329bcc064cda0b569bcf3a8` |

**Claim-tier resolution (§2.4.1 rule 6).** The packet recorded rossmann.de as "C2-equivalent (judgment)" and flagged
it for adjudication. v0.3 settles it: **Rossmann ↔ ISANA is a named house-brand case, so rossmann.de's page for its
own private label is `C2`** for both directions and claims. `claim_tier_basis: house_brand`; routes to review.

**Frozen claims consumed (§2.4 rule 3).** `claims[] = []`. The C2 house-brand page was fetched live and carries
„reichhaltige Pflege", „Hyaluron & Panthenol", „ohne Silikone", „trockenes Haar", „Hautverträglichkeit dermatologisch
bestätigt" — **no** heat, humidity/anti-frizz, repair/bond, curl, fragrance-free or lightness/finish claim. Because a
C1/C2 source **was** located and makes no claim, this is "the claim does not exist", not "not captured": **no
`claim_authority_gap` is raised** (§2.4 rule 2).

**Preserved source conflict (G5).** The same retailer page's body copy names the product „…Hyaluron & Care" while its
title, breadcrumb and every third-party aggregator say „…Hyaluron & Panthenol"; same GTIN and article number
throughout. Preserved, not resolved by preference; it affects the name field only and no property.

## G0 — product-form gate

`in_category`. Aqua leads; C2 directions apply the product to towel-dried lengths and ends and then style, with no
rinse instruction anywhere including the separate storage block (rinse test PASS). Conditioning is primary.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **SODIUM BENZOATE, rank 9**. Above the tail = ranks 1–8.

Above-tail architecture: Aqua (1) · Cetearyl Alcohol (2) · Glycerin (3) · Dicaprylyl Ether (4) ·
**Guar Hydroxypropyltrimonium Chloride (5)** · Betaine (6) · **Cetrimonium Chloride (7)** ·
**Distearoylethyl Hydroxyethylmonium Methosulfate (8)**.
Below-tail: Parfum (10) · Panthenol (11) · Sodium Hyaluronate (12) · allergen block (15–19) · Phenoxyethanol (21).

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: lgn`, trace-only)
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order: `anhydrous` no (Aqua rank 1) → `two_phase` no (a true emulsifying system is present) →
  **`emulsion` matched**.
- `formula_observations[]`: LGN pair present as architecture — Cetearyl Alcohol (2) paired with two cationic
  surfactants, Cetrimonium Chloride (7) and Distearoylethyl Hydroxyethylmonium Methosulfate (8), all above the marker.
- `threshold_reasoning[]`: sub-type (a), the cationic-surfactant + fatty-alcohol lamellar gel network. The
  `microemulsion` row is not reached (decision order) and would fail test (i) anyway — no solubiliser-type material is
  declared. G9: this label may never set WT.

### COND — `high`
- `confidence` **moderately_high** (ceiling) · **E2** · formula
- `formula_observations[]`: (i) LGN pair above the tail — Cetearyl Alcohol (2) + Cetrimonium Chloride (7) +
  Distearoylethyl Hydroxyethylmonium Methosulfate (8); (ii) a further **independent** lubrication route —
  Guar Hydroxypropyltrimonium Chloride (5), a cationic polymer.
- `threshold_reasoning[]`: the `high` anchor requires exactly this shape. `moderate` would apply only "without a full
  LGN pair"; the pair is present and above the marker, so `moderate` is the strictly lower alternative and is refused.
- `limitations[]`: E2 cap — concentration, deposited amount and lamellar phase are not inferable (G4). Removing the
  rinse removes deposition efficiency, which is why COND is more formula-readable here than in the rinse-out standard;
  it does not make it measured.
- `shared_mechanism_ids[]`: `M1_DEPOSITION_SURFACE_LUBRICATION`, `M2_SUBSTANTIVE_FILM_SUPPORT`.

### SLIP — `high`, bias `unknown`
- `confidence` **moderate** (ceiling) · **E2** · formula
- Two or more independent M1 contributors present as architecture: the cationic LGN route (2/7/8) and the cationic
  polymer film (5); Dicaprylyl Ether (4) is a third, emollient contributor.
- Bias `unknown`: `dry_biased` requires a persistent film with **few** water-phase slip agents, but Glycerin (3) and
  Betaine (6) are both above the marker; `wet_biased` requires **no** persistent film, and a substantive cationic
  polymer is present. Neither row fits and `both` overstates a merge the standard itself calls provisional
  (§17.5, §17.16). Listed in `uncertain_fields`.
- G3: the M1 observation is not scored again as an independent maximum for SFR, WT or PERS.

### SFR — `high` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** (ceiling) · **E2** · formula
- **Two distinct observations under §7.4 clause 1 (v0.3):** (i) continuous film route = the substantive
  cationic-polymer film, Guar Hydroxypropyltrimonium Chloride (5); (ii) lubrication route resting on an ingredient
  observation **not** among those establishing the film — Dicaprylyl Ether (4).
- `threshold_reasoning[]`: clause 2's failure mode does not apply — the film and the lubricant are different species,
  not one architecture read twice. Clause 3 does not bite: the second route is above the marker.
- Note carried forward to §10.2: SFR `high` is a **dimension** value. Whether it yields a `smoothing` focus is decided
  separately by the baseline-conditioning test, and here it does not (see Focus).

### WT — `high`
- `confidence` **moderate** · **E2** · formula
- `formula_observations[]`: **LGN pair present as architecture** — Cetearyl Alcohol (2) with Cetrimonium Chloride (7)
  and the esterquat (8). This alone satisfies the `high` anchor's first prong.
- `threshold_reasoning[]`: the anchor's second prong (≥2 persistent families **with** a rich/low-spreading band member)
  is **not** satisfied — no coconut/olive/castor/avocado oil, no shea/mango/cocoa butter, no petrolatum or heavy
  mineral oil appears anywhere in the list. The value rests on the LGN prong only, which is why confidence stays at
  `moderate` rather than rising to `moderately_high`.
- **§10.1.2 weight conflict tag — declined, condition named.** Condition 1 is satisfied (WT `high` from formula alone,
  E2). **Condition 2 fails: there is no C1/C2 intended-finish or positioning statement at all** — `claims[]` is empty
  and the C2 page's „reichhaltige Pflege" points the other way if anything. A tag applied without a recorded C1/C2
  statement would be invalid (§10.1.2). `weight_potential` projects `high` unchanged.
- Transfer caution: **not** attached — the residue is a lamellar cationic/fatty-alcohol deposit, not a low-spreading
  non-film-forming lipid load.
- `limitations[]`: fine-hair residue threshold is a product judgment call (§17.11).

### PERS — `permanent_cationic` (projects `high`)
- `confidence` **moderate** (ceiling low–moderate ⇒ cap `moderate`) · **E2** · formula
- `formula_observations[]`: **Guar Hydroxypropyltrimonium Chloride, rank 5**, above the marker — enumerated by INCI
  name in the `permanent_cationic` class (polymeric quaternisation, visible on the label). The v0.2 repair means this
  no longer requires an inference about charge density, which G4 forbids.
- `threshold_reasoning[]`: the class is ordinal and the highest class present as architecture wins. The monomeric
  long-chain quats (7, 8) and the neutral ether (4) are recorded as supporting, lower classes.
- **G3 rule 4 / FS-13 double-check:** persistence `high` is paired with the buildup caution, not against it. WT `high`
  and PERS `high` point the same way; nothing here promises high wash resistance with low buildup.
- **G11:** no duration, wash count or clarification schedule; the circulating removal percentages are not used.

### HOLD — `none`
- `confidence` **moderately_high** · **E1** · formula. No fixative-class L5 polymer is declared.

### HEAT — trace `not_claimed` · binary `provides_heat_protection: false`
- `confidence` **high** · **E0/E1**
- §13.2 row 1: no C1/C2 heat claim **and** no L9 member anywhere in the list. Binary `false` (§13.3 rule 4).
  No review trigger: the C2 source exists and is silent.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- No C1/C2 humidity or anti-frizz claim → `not_claimed` (§7.9 clause 1). §7.9 clause 3 is not engaged: there is no
  hydrophobic continuous film route to record — the film here is a hydrophilic cationic polymer.
- Humectants (Glycerin 3, Betaine 6, Panthenol 11) are a counter-signal for humidity, never support (FS-15).

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1** · formula
- No cationised protein, no silane derivative, no silicone quat at any rank. Guar Hydroxypropyltrimonium Chloride is a
  **non-silicone cationic polymer**, removed from the `candidate` list in v0.2 because it rested on a charge-density
  inference G4 forbids; it contributes to PERS and SFR only. Panthenol is a fibre-mechanics signal, not an R2 route
  (FS-24). No protein of any kind is declared, so the plain-hydrolysate note does not arise, and no
  `candidate_below_tail` note applies.

### DOSE — `high` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT = `high` ⇒ DOSE = `high` (§7.11 row 1). FORM contributes no value (v0.3 change 18) and attaches no variability
  note here (the form is `emulsion`, not `two_phase`).
- G3: DOSE does **not** additionally modify `hair_thickness_fit`; it emits a German dosing caution instead.

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **high** · **E1** · formula
- Parfum (10) plus a declared allergen block: Hexyl Cinnamal (15), Alpha-Isomethyl Ionone (17), Geraniol (18),
  Citronellol (19). No `Alcohol Denat.` / `Alcohol` — **no alcohol note**.
- Exposure statement only; no tolerance prediction (§7.12, G6).

### ROLE — `[post_wash, ends_only]`
- `confidence` **moderate** · **E1** · directions · tier **C2 (house_brand)**
- `post_wash` and `ends_only` both ← „Den Conditioner auf die handtuchtrockenen Längen und Spitzen verteilen und
  einmassieren." (one sentence may establish more than one role when it states both — towel-dried hair, and a placement
  restricted to lengths and ends).
- Not emitted: `heat_styling` — „Anschließend die Haare wie gewohnt stylen." names no heat tool and does not position
  the application before heat styling as a stage of the routine, so neither the named-tool nor the `pre_heat` shape is
  established (§7.13, v0.3). `refresh`: nothing. `curl_styling`: nothing.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only |
| CURL | not derived | §17.20 — no value vocabulary; and the §10.2 negative gate fails (no C1/C2 curl positioning) |
| R3 | **`none`** | Researched, negative: no C1/C2 bond claim, no recognised bond chemistry. No German string (§8.3) |
| LAYER | not emitted | |
| Buildup caution | **emitted** | Travels with `persistence: high`; non-quantitative, must not contradict PERS (G3 rule 4) |

## `care_direction` — `moisture`
- `confidence` **moderate** · **E2** · formula
- R2 `none_visible` ⇒ `protein` and `balanced` unreachable. The architecture is **not** silicone-led (no silicone is
  declared), so the §9 `unknown` rule does not fire. L1 (cationic conditioning), L3 (Dicaprylyl Ether) and L4
  (Glycerin, Betaine) are all present as architecture — L1+L3+L4 ⇒ `moisture` at up to `moderate` confidence.
- Constraint 1 observed: `care_direction` drives none of weight, persistence, hold or heat matching here.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `high` was established by the LGN pair (2/7/8) **and** the cationic polymer
film (5). Both are therefore inside the baseline set.

| Route | Verdict |
|---|---|
| `repair` | Not available. R2 = `none_visible`; `claims[]` is empty, so there is no C1/C2 marketing position naming a protein or silane active |
| `smoothing` | **Not available.** SFR is `high`, but §10.2's row requires the **continuous alignment/film route** to be beyond baseline conditioning, and the film route here — Guar Hydroxypropyltrimonium Chloride (5) — is one of the two observations that established COND `high`. §10.2.1's second bullet governs: where the film is what makes the product a conditioner at all and there is no separate alignment observation, it is baseline conditioning. Dicaprylyl Ether is a lubricant, not an alignment route, so it cannot supply the missing observation |
| `curl_definition` | Not available. HOLD = `none`; the v0.3 negative gate also fails |
| `heat_styling` | Not available. HEAT = `not_claimed` |
| `detangling` | Not available. Prong 1: no detangling-led C1/C2 positioning (`claims[]` empty). Prong 2 requires COND ≤ `moderate` and WT `low`; COND is `high` and WT is `high` |
| `volume_lightness` | Not available. Requires WT `low` |
| `shine` | Not available. Would restate the film (§8.1) |

**No qualifying route ⇒ `focus.primary: general`**, `secondary: []`.

*Recorded ambiguity (carried to summary.md):* the COND `high` anchor was **over-satisfied** here — either the emollient
or the cationic polymer could be named as the "further independent route". This lane applies the conservative
convention that a route is beyond baseline only if it is beyond baseline under **every** admissible COND-establishing
set; §10.2.1 does not state which set to name when the anchor is over-satisfied.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
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
  "scalp_application_fit": "conditional",
  "uncertain_fields": ["slip_bias"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: high` (row 3). Fine-hair `caution` carries the §7.5 judgment-call
  limitation explicitly: no evidence establishes a residue load at which fine hair reads as limp.
- `damage_fit` ← **row 2**. COND is `high`, but row 3a additionally needs a **qualifying specialist route** — a distinct
  L6 substantive film route or an exact-product test — and a non-silicone cationic polymer explicitly does not qualify
  for either path. Row 3b needs R2 ∈ {candidate, tested}; R2 is `none_visible`.
- `texture_fit` ← **row 3**: `weight_potential = high` **and** SLIP `high`. Not row 4 or 5, so the §14 texture trigger
  does not fire.
- `scalp_application_fit` ← **`conditional`**, ordered test: `avoid` does not fire — the architecture trigger needs WT
  `high` **with a rich/low-spreading band member present as architecture** and there is none, and the narrowed v0.3
  irritant-load trigger needs an exposure flag **plus** a material `Alcohol Denat.`/`Alcohol` note, which is absent.
  No explicit scalp direction ⇒ not `suitable_if_evidenced`. Directions state a **placement that is not the scalp**
  („Längen und Spitzen") ⇒ `conditional`. Nothing is asserted about tolerance.

## German cautions (§18)

| Emitted by | String |
|---|---|
| WT = `high` | „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." |
| DOSE = `high` | „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig." |
| PERS → `high` + buildup | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |

No „… ist ausgelobt" string: the product carries no C1/C2 claim. **Gap recorded:** `EXPO = aromatic_or_allergen_exposure`
has no §18 string although `fragrance_declared` does; nothing is emitted rather than substituting a neighbouring string.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| `claim_tier_basis: house_brand` | Rossmann ↔ ISANA (§2.4.1 rule 6, v0.3) |
| Identity conflict (G5) | Retailer-internal product-name inconsistency, preserved |
| Tail-marker dependence | Every above-tail anchor turns on the rank-9 marker (§17.14) |

`review_status`: `draft` → routed. `out_of_category`: false.
