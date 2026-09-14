# Slot 8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Heat-protective primer

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Schwarzkopf GLISS — Sprüh-Conditioner Express-Repair Ultimate Repair |
| Pack / market | 200 ml · DE |
| GTIN | 4015100813494 |
| Formula source | dm.de (dm-Art. 1430908), DOM capture, 2026-09-03 |
| Identity status | `verified` |
| Directions status | `captured`, **C2** (schwarzkopf.de), rinse test PASS |
| Claims status | `present` (3 entries, all **C2**) |
| Fingerprint | `9adbf8cb1ae853784ca9a859537f7da4d0e1618f3ea5bee2e4d5090b2de7e7dd` |

**Claim authority — clean C2.** schwarzkopf.de is the manufacturer's genuine German-market page. This is the one slot
in the set where the claim-keyed fields rest on an unambiguous C2 source, so nothing here depends on the house-brand
clause or on rule 3.

**Frozen claims consumed (§2.4 rule 3):**
- **heat_protection, C2:** „Hitzeschutz bis zu 230 °C" (appears twice on the page; corroborated at C3 by a dm.de badge).
- **repair_bond, C2:** „Rekonstruktion der Haarstruktur durch flüssiges Keratin".
- **repair_bond, C2:** „Haarschäden werden zielgenau repariert und der Keratinbestand wieder aufgefüllt".

No lane-side claim research was performed; no claim was added, upgraded or re-tiered.

## G0 — product-form gate

`in_category`. Aqua leads; the C2 directions state „Nicht ausspülen!" explicitly (rinse test PASS) **despite the
brand's own „Sprüh-Conditioner" / „Spülung" naming** — the classic case for classifying by directions rather than by
name (§2.3, G0). The §2.3.2 architecture half is not established (HOLD = `none`).

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **SODIUM BENZOATE, rank 14 of 21**. Above the tail = ranks 1–13.

Above-tail architecture: Aqua (1) · **Trisiloxane (2, volatile)** · **Dimethicone (3)** ·
Prunus Armeniaca Kernel Oil (4, unenumerated → **medium band**) · **Phenyl Trimethicone (5)** ·
Hydrolyzed Keratin (6) · Hydrolyzed Pearl (7) · **Dimethiconol (8)** · **Polyquaternium-16 (9)** ·
Cetyl PEG/PPG-10/1 Dimethicone (10) · Cetrimonium Chloride (11) · Parfum (12) · Lactic Acid (13).
Below-tail: Glycerin (15) · Limonene (18) · Phenoxyethanol (20) · Geranyl Acetate (21).

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: non_lgn`, trace-only)
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order: `anhydrous` no → `two_phase` no (a silicone emulsifier is present) → **`emulsion` matched**,
  sub-type (b): **Cetyl PEG/PPG-10/1 Dimethicone (10)** is explicitly enumerated in §7.1's non-LGN row, carrying a
  silicone and oil phase (2/3/4/5/8).
- No LGN pair: Cetrimonium Chloride (11) is present but **no long-chain fatty alcohol** is declared anywhere.

### COND — `moderate`
- `confidence` **moderate** (ceiling moderately_high) · **E2** · formula
- One coherent conditioning route: the **persistent silicone package** above the tail — Dimethicone (3),
  Phenyl Trimethicone (5), Dimethiconol (8). Trisiloxane (2) is a **volatile carrier** contributing nothing to residue
  or persistence (M6, FS-4).
- `threshold_reasoning[]`: `high` is gated on an LGN pair, which cannot exist without a long-chain fatty alcohol. This
  is the **carried-open COND cap on silicone-led products** (BR §2.10) — recorded, not worked around.
- `counter_signals[]`: the cationic route (PQ-16 9, Cetrimonium Chloride 11) and the medium-band apricot oil (4) are
  additional above-tail routes; under the `high` anchor they cannot substitute for the missing LGN pair.

### SLIP — `high`, bias `dry_biased`
- `confidence` **moderate** (ceiling) · **E2** · formula
- Two or more genuinely independent M1 contributors present as architecture: (a) the persistent silicone film
  (3/5/8); (b) the cationic route — Polyquaternium-16 (9) with Cetrimonium Chloride (11); (c) the medium-band
  apricot kernel oil (4).
- Bias `dry_biased`: a persistent film is present and the water-phase slip agents are thin — Glycerin sits at rank 15,
  below the marker.
- FS-22 observed: no instrumental combing figure is quoted as a consumer benefit.

### SFR — `high` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** (ceiling) · **E2** · formula
- **§7.4 clause 1 satisfied on two distinct observations:** (i) continuous film route = the persistent silicone system
  (Dimethicone 3, Phenyl Trimethicone 5, Dimethiconol 8); (ii) lubrication route resting on an ingredient observation
  **not** among those establishing the film — **Prunus Armeniaca Kernel Oil (4)**.
- `threshold_reasoning[]`: clause 2's failure mode is avoided — the silicones are counted once, as the film, and the
  lubrication half rests on a separate species. Clause 3 does not bite: the apricot oil is above the marker.

### WT — `moderate` (multi-family row, §7.5)
- `confidence` **moderate** (capped by the row) · **E2** · formula
- `formula_observations[]`: **three** persistent non-volatile families present as architecture — (a) persistent
  silicone: Dimethicone (3), Phenyl Trimethicone (5), Dimethiconol (8); (b) medium-band vegetable oil: Prunus
  Armeniaca Kernel Oil (4); (c) cationic-polymer film: Polyquaternium-16 (9).
- **Mandatory multi-family counter-signal (§4, R13):** the families and ranks are named above. What holds the value
  **below `high`** is the **absent rich/low-spreading band member** — no coconut, olive, castor or avocado oil, no
  shea/mango/cocoa butter, no petrolatum or heavy mineral oil appears at any rank, and apricot kernel oil is an
  unenumerated liquid vegetable oil read in the **medium** band by the §7.5 convention. The `high` anchor is about
  occlusion, weight and transfer, and that member is exactly what is missing. Dose remains the unmeasured term
  (§17.1). There is no LGN pair either, so the anchor's first prong also fails.
- **FS-13 double-check:** this `moderate` WT is **not** paired with a persistence reading that quietly promises high
  wash resistance and low buildup — PERS is `permanent_cationic` and projects `high` **with** the buildup caution.
- **§10.1.2 weight conflict tag:** not applicable — condition 1 fails (WT is not `high`). No C1/C2 intended-finish
  statement exists in the freeze in any case; all three C2 claims are heat and repair claims.
- Transfer caution: not attached (no low-spreading rich-band lipid).
- G9 observed: „Spray ⇒ leicht" is not used; the form label sets nothing here.

### PERS — `permanent_cationic` (projects `high`)
- `confidence` **moderate** (ceiling cap) · **E2** · formula
- **Polyquaternium-16, rank 9**, above the marker — a declared `Polyquaternium-x`, enumerated by INCI name in the
  `permanent_cationic` class. No charge-density inference is used (G4 forbids it); FS-20 explicitly names PQ-16 among
  the most substantive materials in the category.
- Lower classes recorded as supporting: the persistent silicones and apricot oil (`neutral_non_volatile`), Cetrimonium
  Chloride (a monomeric long-chain quat — not the dominant persistent species here, so the §7.6 monomeric note is not
  required), Trisiloxane (volatile, contributes nothing).
- **G3 rule 4 / FS-13:** buildup caution travels with the projected `high`.
- **G11:** no duration, wash count, applications-to-buildup or clarification schedule; the banned circulating removal
  percentages are not used.

### HOLD — `none`
- `confidence` **moderately_high** · **E1** · formula. No fixative-class L5 polymer is declared. Polyquaternium-16 is a
  cationic conditioning polymer, not a fixative (FS-9).

### HEAT — trace **`claim_only`** · production binary **`provides_heat_protection: true`** · **routes to review**
- `confidence` **high** (on the claim) · **E0** for the claim, **E1** for the formula check · product+formula
- **§13.3 rule 1 — the claim leads:** a **C1/C2 heat-protection claim** exists („Hitzeschutz bis zu 230 °C",
  schwarzkopf.de). ⇒ `provides_heat_protection = true`. This is a **recommendation-policy decision, not an efficacy
  statement**: the app reports what the product is sold as, and the claim's EU legality means a dossier exists, not
  that a test does (§3.3).
- **§13.3 rule 2 — the formula sanity-check runs anyway.** Against the **closed L9 list**
  (VP/Acrylates/Lauryl Methacrylate Copolymer · Polyquaternium-**55** · PVM/MA Copolymer + Polyquaternium-28 ·
  PVP/DMAPA Acrylates Copolymer · Quaternium-70 · hydrolyzed wheat protein): **no member is present at any rank.**
  - **Polyquaternium-16 is not Polyquaternium-55.** The list is closed; adding a member requires new peer-reviewed
    evidence and a standard-version bump. Membership is by exact species, not by family resemblance.
  - **Hydrolyzed Keratin is not hydrolyzed wheat protein.** McMullen & Jachowicz tested one specific protein at a
    defined concentration in a model system; a different hydrolysate does not inherit that result.
  - Generic silicone, generic protein, panthenol and oils are explicitly **not** on the list (G10, FS-7).
  ⇒ **Claim present, no L9 member → `true`, trace state `claim_only`, and route the record to human review** with a
  "claim looks formula-unsupported" note. Review decides; the standard does not silently drop the claim.
- **Hard prohibitions observed.** No efficacy grade is emitted — no "strong/moderate/weak", no score, no percentage.
  **The 230 °C figure is never used as a protection level** (FS-14): it is a marketing use-condition parameter, and
  `heat_protection_max_c` does not exist in this model. Published effect sizes are modest (10–20 % in the classic
  study) and are not expressed in °C.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- §7.9 clause 1: **no C1/C2 humidity or anti-frizz claim** — the three frozen C2 claims are heat and repair claims, and
  the page's other lines („leichte Kämmbarkeit", „gesunden Glanz", „mehr Widerstandskraft") make no humidity statement.
  ⇒ `not_claimed`, whatever the formula shows.
- **§7.9 clause 3 applies:** a qualifying route *is* present — a persistent hydrophobic silicone film (3/5/8) present as
  architecture, with no dominant humectant architecture (Glycerin is the only humectant and sits below the marker).
  Recorded in `supporting_signals[]` with the required sentence: *"a hydrophobic film route is present; the
  manufacturer makes no humidity claim; humidity response is measured, not inferred."* The state stays `not_claimed`
  and **nothing user-facing is emitted**.

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1** · formula
- No route from the closed §7.10 list is present. **Mandatory plain-hydrolysate trace note (§7.10 change 2):**
  **Hydrolyzed Keratin at rank 6** and **Hydrolyzed Pearl at rank 7** are observed and recorded — both high in the
  list, both **above** the marker. A plain (non-cationised, non-silanised) hydrolysate is `none_visible` **at any
  position**: what makes a protein an R2 route is cationisation or silane functionalisation, not rank. The note exists
  precisely so this record does not read as if the keratin was missed — it is the product's headline active and it
  still does not qualify.
- Polyquaternium-16 is a **non-silicone cationic polymer**, removed from `candidate` in v0.2; Cetyl PEG/PPG-10/1
  Dimethicone is a silicone **emulsifier**, not a silicone quat.
- No qualifying route sits below the marker, so no `candidate_below_tail` note.
- Never converts into structural repair, penetration, strength or a diagnosed "protein need" (§7.10 gates).

### DOSE — `moderate` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT `moderate` — **including via the multi-family row** — ⇒ DOSE `moderate` (§7.11, "DOSE follows WT"). It is **not**
  separately re-argued upward on family count; any DOSE value disagreeing with its WT input would be a G3 violation.
  No rich/low-spreading band member is present as architecture, so the `high` row does not fire. FORM contributes no
  value.

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **high** · **E1** · formula
- Parfum (12), Tetramethyl Acetyloctahydronaphthalenes (16), Citrus Aurantium Peel Oil (17, a clearly aromatic
  essential oil), Limonene (18), Geranyl Acetate (21). No `Alcohol Denat.`/`Alcohol` → **no alcohol note**.

### ROLE — `[post_wash]`
- `confidence` **moderate** · **E1** · directions · tier **C2** (schwarzkopf.de)
- `post_wash` ← „Nach jeder Haarwäsche in das handtuchtrockene oder trockene Haar sprühen." — application to freshly
  washed, towel-dried hair.
- **`refresh` deliberately not emitted.** The same sentence's dry-hair option is still bound to „Nach jeder
  Haarwäsche", so it is a post-wash variant rather than application to dry hair **between washes** or re-application
  during the day. The reading is recorded so it is diffable (compare slots 1 and 4, where the dry-hair option stands in
  a sentence with no wash anchor).
- **`heat_styling` deliberately not emitted — and this is the load-bearing call on this slot.** §7.13 requires either a
  **named heat tool** or a direction sentence that positions the application **before heat styling as a stage of the
  routine** („vor dem Föhnen", „vor dem Hitzestyling", „auftragen und föhnen"). The C2 directions name no tool and
  establish no such stage — „Nach jeder Haarwäsche … sprühen. Nicht ausspülen! Regelmäßig anwenden." The heat claim
  lives on the same page but **a temperature figure is a claim, not a direction**, and a heat claim whose directions
  are silent about *when* to apply does not create the role. The v0.3 `pre_heat` widening does not reach this shape.
- `ends_only`: not emitted — no placement restriction is stated. `curl_styling`: nothing.
- „Vor Gebrauch schütteln!" is a handling instruction and establishes no role. „Rückstände vom Boden entfernen." is a
  safety instruction.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only; „gesunder Glanz" positioning does not create an independent value (§8.1, G3 rule 5) |
| CURL | not derived | §17.20; `curl_definition` also fails HOLD and the negative gate |
| R3 | **`none`** | Researched, negative: the two C2 claims are **repair** claims, not bond claims, and no recognised bond chemistry (no Bis-Aminopropyl Diglycol Dimaleate or comparable) is present. Emits no German string |
| LAYER | not emitted | |
| Buildup caution | **emitted** | Travels with `persistence: high` |

## `care_direction` — `moisture`
- `confidence` **moderate** · **E2** · formula
- R2 `none_visible` ⇒ `protein` and `balanced` are unreachable, **whatever the marketing says**. §9 constraint 3 is
  directly on point: *a product sold entirely on keratin repair whose only protein is a plain hydrolysate is `moisture`
  or `unknown` on its architecture, exactly as the formula reads*. The two C2 keratin claims are recorded as
  counter-signals.
- The §9 silicone-led `unknown` rule does **not** fire: it requires no R2 route **and** no material humectant or
  emollient leg, and a material emollient leg is present — Prunus Armeniaca Kernel Oil at rank 4, above the marker.
  L1 (PQ-16, Cetrimonium Chloride) + L3 (apricot oil) ⇒ `moisture` at up to `moderate` confidence.
- `limitations[]`: **this is open gap §17.22** — §9 is a protein-versus-moisture vocabulary with no value for a
  film-led architecture, and its silicone-led `unknown` rule is gated too narrowly to catch one. A thin emollient leg
  beside a dominant silicone system returns `moisture`. Recorded, not worked around.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `moderate` was established by the **persistent silicone package**
(Dimethicone 3, Phenyl Trimethicone 5, Dimethiconol 8). That set is not uniquely determined — the cationic route
(PQ-16 9 + Cetrimonium Chloride 11) could equally have carried COND `moderate` — so this lane applies its stated
convention: **a route is beyond baseline only if it is beyond baseline under every admissible COND-establishing set.**

**Selection procedure (§10.2, as rewritten in v0.3 — rank order binds before observation counting).**

*Step 1 — collect qualifying routes.*

| Route | Verdict |
|---|---|
| `repair` | **Qualifies.** R2 is `none_visible`, so the first prong fails — but the row's **second prong** is met: **protein actives are named in the product's C1/C2 marketing position**. The C2 German-market page states „Rekonstruktion der Haarstruktur durch **flüssiges Keratin**" and „der **Keratinbestand** wieder aufgefüllt", naming a protein active as what the product is *for*. The row's exclusion list bars generic silicone, oil, panthenol, ceramide, a non-silicone cationic polymer and *generic* repair naming; naming keratin as the active is none of those. Beyond baseline conditioning: the route rests on the C2 keratin position and on Hydrolyzed Keratin (6) / Hydrolyzed Pearl (7), none of which is in the COND set under any admissible reading |
| `smoothing` | **Not available.** SFR is `high`, but §10.2's row requires the **continuous alignment/film route** to be beyond baseline conditioning, and the persistent silicone film is inside the COND set under at least one admissible reading. §10.2.1's second bullet: a film that is what makes the product a conditioner at all is baseline conditioning, not a smoothing route |
| `curl_definition` | Not available. HOLD = `none`; the v0.3 negative gate also fails (no C1/C2 curl/wave positioning, no texture-targeted directions) |
| `heat_styling` | **Not available — and this is the notable near-miss.** The first half is satisfied cleanly: HEAT ≥ `claim_only` under C1/C2 claim authority. The second half fails: **ROLE does not include `heat_styling`**, because the C2 directions name no heat tool and establish no `pre_heat` application stage. A C1/C2 heat claim alone does not create the focus |
| `detangling` | Not available. Prong 1: no detangling-led C1/C2 positioning (the page's „leichte Kämmbarkeit" is one benefit in a repair-led description, not the positioning; the product is not sold as a „Leichtkämmspray"). Prong 2 requires WT `low`; WT is `moderate` |
| `volume_lightness` | Not available. Requires WT `low` **and** no persistent film route; both fail |
| `shine` | Not available. Would restate the M3 consequence of the same film (§8.1, G3) |

*Step 2 — exact-product evidence first.* None exists; no route rests on `tested` or E3+ endpoint evidence.

*Step 3 — the rank order binds.* `repair` > `smoothing` > `curl_definition` > `heat_styling` > `detangling` >
`volume_lightness` > `shine`. The only qualifying route is `repair`, and it is the highest-ranked in any case. Its
precondition is met: **`repair` outranks `smoothing` only when a dedicated repair route exists**, and here the
marketing-position prong supplies it.

*Step 4 — observation counting never promotes a lower-ranked route*, and it is not used to move `primary` here.

⇒ **`focus.primary: repair`**, `focus.secondary: []` (no remaining qualifying route clears the independent-moderate+
bar).

> **Recorded contradiction — the most consequential open reading in this record.** §10.2 principle 4 says *"Official
> positioning may corroborate but never creates a route"*, and §9 constraint 3 says marketing direction never sets a
> value — yet the `repair` row and §10.2 step 3 both name "protein/silane actives in the product's C1/C2 marketing
> position" as an **independent** qualifying prong, and the row's exclusion list only makes sense if that prong can
> fire without a formula route. This lane applies the specific rule over the general principle: the row's second prong
> is independent, so `repair` qualifies. The consequence is stark and should be seen by a human: **this product's
> primary user-facing purpose is set by a C2 keratin claim over a formula whose only protein is a plain hydrolysate
> that §7.10 rules `none_visible`** — while `care_direction` reads `moisture` on that same formula. The record routes
> to review on exactly this point.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "high",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "repair", "secondary": [] },
  "usage_role": ["post_wash"],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["focus"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: moderate` (row 2). The fine value carries the §7.5 judgment-call
  limitation. DOSE does not additionally modify this table (G3).
- `damage_fit` ← **row 2**. Row 3a needs COND `high` (it is `moderate`) **plus** a qualifying specialist route.
  **Row 3b — R14's repair-film path — needs R2 ∈ {candidate, tested}, and R2 is `none_visible`.** Note the deliberate
  asymmetry this produces and its justification: `focus` may be set by a C1/C2 marketing position, but the
  **highly-damaged tier may not** — R14 opens the tier only for a genuine repair-film **route**, and a keratin claim
  over a plain hydrolysate is not one. A product sold on repair therefore reaches `conditional`, not `recommended`,
  for highly damaged hair.
- `texture_fit` ← row 2 (WT `moderate`, any slip).
- `scalp_application_fit` ← **`unknown`** (the default), ordered test: `avoid` does not fire — the architecture is
  neither heavy-occlusive nor oil-led, and the narrowed v0.3 irritant-load trigger needs an exposure flag **plus** a
  material alcohol note, which is absent. **This is the v0.3 narrowing working:** under v0.2 the fragrance flag alone
  would have fired `avoid` here. No explicit scalp direction (not `suitable_if_evidenced`); no non-scalp placement
  stated (not `conditional`).

## German cautions (§18)

| Emitted by | String |
|---|---|
| HEAT claim without an L9 member (review route) | „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das." |
| PERS → `high` + buildup | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |

**String selection recorded.** Two §18 rows match a `claim_only` heat state on this product — the generic
`HEAT trace claim_only` string and the more specific "claim without L9 member (review route)" string. §18 does not say
which fires when both match; this lane emits **only the more specific one**, because emitting both would state the
same thing twice and the specific string already carries the honest limit. Recorded as a residual ambiguity.

No repair string is emitted: R2 is `none_visible`, so neither §18 R2 row applies, and R3 is `none`, which emits
nothing by design. The user is therefore told nothing that presents the keratin claim as substantiated.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| **Heat claim with no L9 member** | §13.3 rule 2 — standing trigger; the binary is `true` and the formula does not support it |
| `focus.primary` set by a marketing position | §10.2 repair row vs principle 4 (see the recorded contradiction above) |
| `care_direction` under-firing on a film-led architecture | Open gap §17.22 |
| Tail-marker dependence | WT, SFR, PERS and HEAT all turn on the rank-14 marker (§17.14) |

`review_status`: `draft` → routed. `out_of_category`: false.
