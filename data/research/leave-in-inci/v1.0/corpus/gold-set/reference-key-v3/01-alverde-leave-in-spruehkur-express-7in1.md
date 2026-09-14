# Slot 1 — alverde NATURKOSMETIK Leave-In Sprühkur Express 7in1

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Ultra-light detangling spray

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | alverde NATURKOSMETIK — Leave-In Sprühkur Express 7in1 |
| Pack / market | 75 ml · DE |
| GTIN | 4066447919387 |
| Formula source | dm.de (dm-Art. 3090444), captured 2026-09-03 |
| Identity status | `verified` |
| Directions status | `captured` |
| Claims status | `present` (1 entry) |
| Fingerprint | `cb08a99de094b760398f2fa7bcc5de19d6a0e2a47316e5ec94dcaa16be06f212` |

**Claim-tier correction applied at G1 (§2.4.1 rule 6, v0.3 house-brand clause).** The packet stamps the dm.de
directions and the finish claim as `C3` / `C2` respectively with the note that alverde is dm's own private label.
Under v0.3 the house-brand clause is explicit and names dm ↔ alverde: **dm.de is the brand owner's own German-market
page for this product and is `C2` for both the directions and the claims.** The record carries
`claim_tier_basis: house_brand` and **routes to human review** (§14, v0.3 trigger).

**Frozen claims consumed (§2.4 rule 3).** One C2 claim: „sorgt für ein geschmeidiges Haargefühl, ohne zu beschweren"
(`finish_weight`). The freeze records, actively checked: no heat claim, no humidity/anti-frizz claim, no repair/bond
claim, no curl claim, no fragrance-free claim. No claim was researched or re-tiered in this lane.

## G0 — product-form gate

`in_category`. Aqua leads (rank 1); C2 directions instruct spraying into the lengths and ends with no rinse step
(rinse test PASS); conditioning/detangling is primary. Neither exclusion row fires: the formula is aqueous-led
(not `excluded_anhydrous`), and the HOLD anchor returns `none`, so the §2.3.2 architecture half is not established
(not `excluded_styling_first`).

## Reading conventions

**Tail marker (§3.1.1).** First concentration-capped ingredient = **LEVULINIC ACID, rank 9** (Levulinic Acid /
Sodium Levulinate, enumerated). Above the tail = ranks 1–8. This is a heuristic and is recorded as one; every anchor
below that turns on it names it.

Above-tail architecture: Aqua (1) · Helianthus Annuus Hybrid Oil (2) · Alcohol Denat. (3) · Glycerin (4) ·
Dicaprylyl Ether (5) · Pentylene Glycol (6) · Inulin (7) · Isoamyl Laurate (8).
Below-tail, decision-relevant: Ricinus Communis Seed Oil (11, **rich band**) · Hydrolyzed Corn/Wheat/Soy Protein
(13/14/15) · Helianthus Annuus Seed Oil (18).

**Rank is the single deterministic prong (§3.1.1 clause 1).** Castor oil and the three plain hydrolysates sit below
the marker and are therefore not architecture, whatever their family coherence.

## Dimensions (§7)

### FORM — `two_phase`
- `decision_type` direct_product_property · `confidence` **moderate** · `evidence_level` **E1/E2** · `evidence_scope` formula
- Decision order run in full: `anhydrous_serum_or_oil` (Aqua rank 1 → no) → **`two_phase` matched**.
- `formula_observations[]`: no cationic surfactant + fatty-alcohol LGN pair; no true O/W emulsifier; no enumerated
  solubiliser-type material (no PEG-ester, PEG-HCO, polysorbate, Trideceth-x, Laureth-x, PPG-x-Buteth-x) anywhere in
  the list; an oil phase present as architecture — Helianthus Annuus Hybrid Oil (2), Dicaprylyl Ether (5),
  Isoamyl Laurate (8).
- `threshold_reasoning[]`: the `two_phase` row is decidable from architecture alone — an unemulsified water phase plus
  an oil phase with no emulsifier and no solubiliser package capable of carrying that load. The next row down
  (`emulsion`) fails for want of any emulsifying system; `microemulsion` fails test (i) for want of a solubiliser
  package. The C2 direction „Bitte vor Gebrauch schütteln" **corroborates** and is not required (§7.1).
- `counter_signals[]`: Alcohol Denat. at rank 3 could act as a cosolvent producing a single-phase hydroalcoholic
  system; the standard does not enumerate ethanol as a solubiliser-type material, so this reading is recorded, not
  adopted. Confidence held at `moderate` for it.
- `limitations[]`: FORM is a high-confidence architecture label and a **low-confidence weight proxy** (G9).
- Trace-only: `presentation_form: Sprühkur/Spray`; `emulsion_subtype: n/a`.

### COND — `moderate`
- `confidence` **moderate** (ceiling moderately_high) · **E2** · formula
- `formula_observations[]`: persistent emollient package above the tail — Helianthus Annuus Hybrid Oil (2, high-oleic
  sunflower, read **medium band** by the §7.5 convention for unenumerated liquid vegetable oils), Dicaprylyl Ether (5),
  Isoamyl Laurate (8, dry-feel band).
- `threshold_reasoning[]`: `high` requires an LGN pair above the tail plus a further independent lubrication route —
  there is **no cationic surfactant in the formula at all**, so the LGN pair cannot exist and `high` is unreachable.
  `low` requires no persistent non-volatile above the tail; three are present. → `moderate`.
- `shared_mechanism_ids[]`: `M1_DEPOSITION_SURFACE_LUBRICATION`.
- `limitations[]`: concentration invisible (G4); tail-marker heuristic (§17.14).

### SLIP — `moderate`, bias `unknown`
- `confidence` **moderate** · **E2** · formula
- `threshold_reasoning[]`: `high` needs two or more **independent** M1 contributors present as architecture. Only one
  is present — the L3 emollient package. There is no cationic species anywhere in the formula and no persistent
  silicone. `low` is excluded by that same package. → `moderate`.
- Bias: the qualifier has no matching value for a **non-film persistent lipid load** — `wet_biased` requires "no
  persistent film" in a water/volatile-dominant architecture, `dry_biased` requires a persistent film. Neither holds.
  → `unknown`, per the standing open gap (§17.16), not a judgment.
- `shared_mechanism_ids[]`: `M1_…` — counted once with COND (G3).

### SFR — `moderate` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** · **E2** · formula
- `threshold_reasoning[]`: `high` requires a **continuous surface-film route** — a persistent silicone or a
  substantive cationic-polymer film — and there is neither. The two-observation anchor (§7.4 clause 1) is therefore
  never reached; the question of a second observation does not arise. `moderate` is carried by the medium/dry-feel
  emollient package (2, 5, 8). `low` is excluded (this is not water and humectants only).
- §8.1 qualifier `present`: shine here is the M3 optical consequence of the same alignment/deposition read, emitted as
  a qualifier on SFR and **never** as an independent value (G3 rule 5).
- `limitations[]`: humidity-driven frizz is not readable from formula and belongs entirely to HUM (FS-8, FS-15).

### WT — `moderate` (multi-family row, §7.5)
- `confidence` **moderate** (capped by the row) · **E2** · formula
- `formula_observations[]`: two persistent non-volatile families present as architecture — (a) **medium-band liquid
  vegetable oil**: Helianthus Annuus Hybrid Oil (rank 2); (b) **dry-feel / high-spreading emollients**: Dicaprylyl
  Ether (rank 5), Isoamyl Laurate (rank 8). No LGN pair. No rich/low-spreading band member above the tail.
- **Mandatory multi-family counter-signal (§4, R13):** the families are the medium-band vegetable oil at rank 2 and
  the dry-feel ester/ether pair at ranks 5 and 8. What holds the value **below `high`** is the absent rich/low-spreading
  band member — the `high` anchor is about occlusion, weight and transfer, and the only rich-band species in the
  formula, **Ricinus Communis Seed Oil, sits at rank 11, below the tail marker at rank 9**, so it is not architecture
  (§3.1.1 clause 1). Dose remains the unmeasured term (§17.1).
- `threshold_reasoning[]`: `high` needs an LGN pair (absent) or ≥2 persistent families **with** a rich-band member
  (the only candidate is below the marker). `moderate` single-family row would also land here on the alternative
  reading that the whole L3 load is one family — **both readings give `moderate`**, so the value is robust to the
  family-count question.
- `counter_signals[]`: the below-marker castor oil, recorded with its rank; the alternative single-family reading.
- **§10.1.2 weight conflict tag — declined, condition named.** A candidate C2 intended-finish statement exists
  („…ohne zu beschweren", dm.de house-brand page, C2). **Condition 1 fails: WT did not resolve to `high` from formula
  alone**, so the tag is not available. Conditions 2–4 are not reached. Nothing moves.
- Attached qualitative **transfer caution**: not attached — the low-spreading, non-film-forming lipid (castor) is below
  the marker; the above-tail load is medium/dry-feel.
- `limitations[]`: no evidence establishes a residue load at which fine hair reads as limp — the fine-hair prior below
  is a **product judgment call**, labelled as one (§7.5, §17.11).

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** (ceiling low–moderate ⇒ cap `moderate`) · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` requires a polymeric or silicone-functional quat by INCI name — none
  declared. `ph_dependent_cationic` requires amodimethicone / bis-aminopropyl dimethicone / an amidoamine — none.
  The highest class present as architecture is the neutral non-volatile lipid deposit (ranks 2, 5, 8).
  `volatile_or_water_soluble` is excluded because that package is neither volatile nor water-soluble.
- No monomeric long-chain quat is present, so the §7.6 monomeric note does not apply.
- **G11:** no duration, wash count, applications-to-buildup or clarification schedule is stated; the banned circulating
  removal percentages are not used.
- Buildup caution: not emitted (the caution travels with a projected `high`).

### HOLD — `none`
- `confidence` **moderately_high** · **E1** · formula
- No fixative-class L5 polymer is declared. Inulin (7) is a polysaccharide serving prebiotic/film-quality roles, not an
  L5 member; it is not read as hold (FS-25, L5 rheology exclusion reasoning).

### HEAT — trace `not_claimed` · production binary `provides_heat_protection: false`
- `confidence` **high** · **E0/E1** · product+formula
- `threshold_reasoning[]`: §13.2 row 2 — **no C1/C2 heat claim** (the C2 house-brand page was fetched and the freeze
  records the absence explicitly), and an L9 member **is** present: Hydrolyzed Wheat Protein at **rank 14**, below the
  tail marker at rank 9. Two independent rules bar an upgrade: the L9 tail-member rule (§5 rule 1 — a tail-position
  member is not "a plausible film-forming context") and §5 rule 2 (no C1/C2 claim ⇒ no upgrade and no binary change).
  The observation is recorded and stops there. Binary `false` per §13.3 rule 4.
- `counter_signals[]`: Hydrolyzed Wheat Protein at rank 14 (L9 member, below marker) — recorded, earns nothing.
- Not a `claim_authority_gap`: the C2 source was located and makes no heat claim. "Not captured" and "does not exist"
  are different states (§2.4 rule 2) and this is the latter.

### HUM — `not_claimed`
- `confidence` **high** · **E0** · product
- No C1/C2 humidity or anti-frizz claim exists → `not_claimed` whatever the formula shows (§7.9 clause 1, v0.3
  claim-led ladder). §7.9 clause 3 does not apply either: there is no hydrophobic continuous film route to record.
- Humectants are materially present (Glycerin 4, Pentylene Glycol 6) and are a **counter-signal** for humidity, never
  support (L4, FS-15). No dew-point threshold is encoded (FS-16).

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1** · formula
- No route from the closed §7.10 list (cationised protein · silane derivative · silicone quat) is present at any rank.
- **Mandatory plain-hydrolysate trace note (§7.10 change 2):** Hydrolyzed Corn Protein (13), Hydrolyzed Wheat Protein
  (14) and Hydrolyzed Soy Protein (15) are observed and recorded. A plain (non-cationised, non-silanised) hydrolysate
  is `none_visible` **at any position** — what makes a protein an R2 route is cationisation or silane
  functionalisation, not rank. The note exists so the record does not read as if the proteins were missed.
- No `candidate_below_tail` note: none of the below-marker species is a §7.10-**qualifying** route.

### DOSE — `moderate` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · `confidence` **moderate** · **E2**
- WT = `moderate` ⇒ DOSE = `moderate` (§7.11). No rich/low-spreading band member is present as architecture, so the
  `high` row does not fire.
- **`FORM = two_phase` attaches a mandatory dose-variability note, not a higher value (v0.3 change 18):** shake quality
  changes the delivered oil:water ratio per actuation and that variability is unmeasured (§17.9). Variability and
  magnitude are different properties; encoding this as DOSE `high` would overstate the residue.
- Carries the §18 shake caution and the §14 two-phase review trigger.

### EXPO — `aromatic_or_allergen_exposure` (+ alcohol note)
- `confidence` **high** · **E1** · formula
- Parfum (23) plus a declared allergen block (Geraniol, Limonene, Terpineol, Geranyl Acetate, Linalyl Acetate,
  Vanillin) and clearly aromatic essential oils (Citrus Aurantium Bergamia Peel Oil, Citrus Limon Peel Oil,
  Juniperus Virginiana Oil).
- `notes[]`: **Alcohol Denat. materially present at rank 3** → alcohol exposure note emitted.
- Hard limit: flags are exposure statements. Sensitive-scalp tolerance is **not** derivable from an INCI list
  (§7.12, SR §M.12). G6 applies.

### ROLE — `[post_wash, refresh, ends_only]`
- `confidence` **moderate** (ceiling moderately_high) · **E1** · directions · tier **C2 (house_brand)**
- `post_wash` ← „Die Pflegekur kann sowohl in das trockene als auch in das feuchte Haar gesprüht werden." (damp-hair
  application).
- `refresh` ← same sentence, dry-hair half. Recorded reading: the sentence *permits* dry-hair application without
  tying it to the interval between washes. Whether a merely permissive dry-hair sentence establishes `refresh` is a
  **carried-open item** (blind A11, §21.2 "deliberately not changed"); the reading is applied here and named so it is
  diffable rather than silent.
- `ends_only` ← „Je nach Bedarf aus ca. 30cm Entfernung in die Haarlängen und -spitzen sprühen."
- Not emitted: `heat_styling` (no named heat tool and no `pre_heat` application stage in the directions);
  `curl_styling` (nothing).
- „HINWEIS: Bitte vor Gebrauch schütteln." is a **handling instruction and establishes no role** (§7.13).

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `smoothing_shine_qualifier: present` | Qualifier on SFR only; no independent value (G3 rule 5) |
| CURL | not derived | `curl_definition_focus` has no value vocabulary anywhere in the standard (§17.20); the derived-focus route is unavailable and `curl_definition` fails its §10.2 negative gate regardless |
| R3 | **`none`** | Researched and negative: no C1/C2 bond claim and no recognised bond chemistry. Emits no German string (§8.3, v0.3) |
| LAYER | caution not emitted | No anionic-styling-layer interaction is asserted; the standard permits at most one string and none is warranted here |
| Buildup caution | not emitted | Travels with a projected `persistence: high`; this record projects `moderate` |

## `care_direction` — `moisture`
- `confidence` **moderate** (ceiling moderate) · **E2** · formula
- R2 is `none_visible`, so `protein` and `balanced` are both unreachable. The architecture is not silicone-led, so the
  §9 silicone-led `unknown` rule does not fire. A coherent **L3 emollient + L4 humectant** direction is present above
  the tail (Glycerin 4, Pentylene Glycol 6; oils/esters 2, 5, 8) — "any one leg present as architecture is
  sufficient", and two are.
- `counter_signals[]`: the C2 page positions the product on „pflanzliches Keratin" and „vor Haarbruch geschützt".
  **Marketing direction never sets the value** (§9 constraint 3): the only proteins are plain hydrolysates below the
  marker, so the architecture reads `moisture`.
- G3: shares M2 with R2 and PERS and is not presented as independent corroboration of either.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** The observations that established COND `moderate` are the L3 emollient package:
Helianthus Annuus Hybrid Oil (2), Dicaprylyl Ether (5), Isoamyl Laurate (8). Any route claiming to be distinctive must
name an endpoint-relevant observation outside that set.

| Route | Verdict |
|---|---|
| `repair` | **Not available.** R2 = `none_visible`. Positioning prong: the frozen C2 claim capture records **no repair/bond claim**; the page's „pflanzliches Keratin" language sits over three plain hydrolysates below the marker and is generic repair naming, which the row excludes |
| `smoothing` | Not available. SFR is `moderate`, not `high`; there is no continuous film route at all |
| `curl_definition` | Not available. HOLD = `none`; and the v0.3 negative gate finds no curl/wave positioning or texture-targeted directions at C1/C2 |
| `heat_styling` | Not available. HEAT = `not_claimed` |
| `detangling` | Not available. Prong 1: the product is a 7-in-1 Sprühkur, not sold as a detangler / „Leichtkämmspray" / „Entwirrungsspray"; detangling is one of several benefits in the C2 copy, not the positioning. Prong 2 requires WT `low` — WT is `moderate` |
| `volume_lightness` | Not available. Requires WT `low` |
| `shine` | Not available. Would restate the M3 consequence of the same emollient alignment (§8.1, G3) |

**No qualifying route ⇒ `focus.primary: general`** (§10.2 step 5). `focus.secondary: []`.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "two_phase",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": ["post_wash", "refresh", "ends_only"],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "avoid",
  "uncertain_fields": ["slip_bias"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: moderate` (row 2 of §10.3). DOSE does not additionally modify this table
  (G3); the `moderate` DOSE emits no string. Every fine-hair value carries the §7.5 judgment-call limitation.
- `damage_fit` ← row 2: `conditioning_level ∈ {moderate, high}` with **no qualifying repair route** (R2 =
  `none_visible`, so row 3b is unreachable; COND is not `high`, so row 3a is unreachable).
- `texture_fit` ← row 2: `weight_potential = moderate`, any slip. Not a row-4 or row-5 record, so the §14 texture
  trigger does not fire.
- `scalp_application_fit` ← **`avoid`**, ordered test, two independent triggers fire and either alone suffices:
  (i) an **oil-led two-phase load** — `FORM = two_phase` with Helianthus Annuus Hybrid Oil at rank 2, above the marker;
  (ii) a **scalp-relevant irritant load** under the narrowed v0.3 trigger — `aromatic_or_allergen_exposure` **plus** a
  materially present `Alcohol Denat.` note (rank 3). The directions' ends-only placement would give `conditional`, but
  `avoid` is tested first and wins. No tolerance is predicted; this is a placement statement (§7.12, G6).

## German cautions (§18)

| Emitted by | String |
|---|---|
| FORM = `two_phase` | „Vor Gebrauch gut schütteln – sonst schwankt die Dosierung stark." |
| EXPO alcohol note | „Enthält Alkohol – bei empfindlicher Kopfhaut lieber nur in die Längen geben." |
| `scalp_application_fit = avoid` | „Nicht für die Kopfhaut gedacht – bitte nur in die Längen und Spitzen geben." |

No „… ist ausgelobt" string is emitted: the product carries no C1/C2 heat, humidity or bond claim. No string expresses
confidence or a counter-signal (G14).

## Review routing (§14)

| Trigger | Basis |
|---|---|
| `claim_tier_basis: house_brand` | dm ↔ alverde; a human confirms the ownership relation (§2.4.1 rule 6, v0.3) |
| Two-phase product | Least dose-predictable form (SR §M.9) |
| Tail-marker dependence | WT, COND, SFR, HEAT and R2 all turn on the rank-9 marker; the heuristic is unvalidated (§17.14) |
| `scalp_application_fit = avoid` | Most restrictive placement value in the model |

`review_status`: `draft` → routed. `out_of_category`: false.
