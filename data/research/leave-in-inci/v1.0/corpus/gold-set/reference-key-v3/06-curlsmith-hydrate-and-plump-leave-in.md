# Slot 6 — Curlsmith Hydrate & Plump Leave-In

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Silicone-free cationic/polymeric

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Curlsmith — Hydrate & Plump Leave-In |
| Pack / market | 237 ml · DE |
| GTIN | **not found** — documented identity-research gap (§2.4) |
| Formula source | lockenbox.com (exact-pack DE/EU curl specialty retailer), full 40-ingredient list, 2026-09-03 |
| Identity status | `verified` (formula), with an open identifier gap |
| Directions status | `captured` (English retailer text), rinse test PASS |
| Claims status | `none_found_at_C1_C2` |
| Fingerprint | `ff00c63494a7ff41c090a65fe8d29f87745577158ada42ccababa814434e367f` |

**Claim and directions authority.** lockenbox.com is a retailer (**C3-equivalent**; the exact-GTIN wording cannot even
be confirmed, since no GTIN is established). `eu.curlsmith.com` is an English-language EU storefront, not a
German-market page, so it is **C5** under §2.4.1 rule 3. flaconi.de is **C4**. **No C1/C2 source exists.**

**Frozen claims consumed (§2.4 rule 3).** `claims[] = []`. Recorded as counter-signals with their tiers, never as
claims: C5 „Lightweight moisture with no weigh-down", „Long-lasting volume (up to 72h*)", „Fuller, thicker, bouncier
curls", „helps sealing cuticles and reducing frizz"; C4 (flaconi.de) attribute tag „Wirkung: Volumen". Routes to
review under **`claim_authority_gap`**.

## G0 — product-form gate

`in_category`. Water leads; the directions work the product into wet hair and style, with no rinse step, and the
product is explicitly a leave-in conditioner (rinse test PASS). The §2.3.2 architecture half is **not** established:
a fixative-class polymer (PVP) is present, but a substantive conditioning architecture dominates it decisively
(see HOLD), so the HOLD anchor returns `incidental_film`, not `meaningful_hold_route`.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **PHENOXYETHANOL, rank 36 of 40**. Above the tail = ranks 1–35.

**Very-late-marker limitation.** A marker at rank 36 of 40 means the above/below test separates almost nothing: 35 of
40 ingredients qualify as "above the tail". §3.1.1's limit 2 covers an **absent** marker and limit 3 covers a **very
early** one; **v0.3 covers no case for a marker this late**, and the standard records that as open gap §17.18 while
explicitly declining to fix it. Every anchor below that leans on the marker carries this limitation, and confidence is
held one step below what the anchor would otherwise support wherever the marker did the work.

Above-tail, decision-relevant: Water (1) · Dicaprylyl Carbonate (2) · **Cetearyl Alcohol (3)** ·
Coco-Caprylate/Caprate (4) · **Ricinus Communis (Castor) Seed Oil (5, rich band)** ·
**Behentrimonium Chloride (6)** · Glycerin (7) · Panthenol (8) ·
**Butyrospermum Parkii (Shea) Butter (9, rich band)** · Simmondsia Chinensis (Jojoba) Seed Oil (10) ·
**Guar Hydroxypropyltrimonium Chloride (11)** · **Polyquaternium-10 (12)** · Isopropyl Alcohol (27) ·
**PVP (32)**.

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: lgn`, trace-only)
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order: `anhydrous` no → `two_phase` no → **`emulsion` matched**, sub-type (a): the LGN pair
  Behentrimonium Chloride (6) + Cetearyl Alcohol (3), carrying a substantial lipid phase.

### COND — `high`
- `confidence` **moderately_high** (ceiling) · **E2** · formula
- (i) LGN pair above the tail — Cetearyl Alcohol (3) + Behentrimonium Chloride (6); (ii) at least one further
  independent lubrication route — the medium/rich emollient package (Dicaprylyl Carbonate 2, Coco-Caprylate/Caprate 4,
  castor oil 5, shea butter 9, jojoba 10). The cationic polymers (Guar HPTC 11, PQ-10 12) are a **third** available
  route.
- `limitations[]`: the very-late marker means "above the tail" is nearly vacuous here; the LGN pair sits at ranks 3 and
  6, so this particular reading would survive a much stricter marker, and confidence is not lowered for it.

### SLIP — `high`, bias `unknown`
- `confidence` **moderate** (ceiling) · **E2** · formula
- Two or more independent M1 contributors present as architecture: the cationic LGN route, the cationic-polymer film,
  and the emollient package — three distinct routes.
- Bias `unknown`: a persistent cationic-polymer film is present (so not `wet_biased`) alongside a materially present
  water/humectant phase — Glycerin (7), Panthenol (8) — so `dry_biased`'s "few water-phase slip agents" fails, and
  `both` would assert a separation §17.5 records as unresolved. Listed in `uncertain_fields`.

### SFR — `high` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** · **E2** · formula
- **§7.4 clause 1 satisfied on two distinct observations:** (i) continuous film route = the substantive
  cationic-polymer film, Guar Hydroxypropyltrimonium Chloride (11) with Polyquaternium-10 (12); (ii) lubrication route
  resting on ingredient observations **not** among those establishing the film — Dicaprylyl Carbonate (2) and
  Coco-Caprylate/Caprate (4).
- `limitations[]`: both halves rest on the near-vacuous above-tail test (§17.18).
- Carried to §10.2: SFR `high` is a dimension value; whether a `smoothing` **focus** follows is decided separately and
  here it does not (see Focus).

### WT — `high`
- `confidence` **moderate** · **E2** · formula
- **Both** prongs of the `high` anchor fire independently: (i) an LGN pair present as architecture (3 + 6); (ii) two or
  more persistent non-volatile families with at least one **enumerated rich/low-spreading band member** —
  Ricinus Communis (Castor) Seed Oil (5) and Butyrospermum Parkii (Shea) Butter (9), alongside the dry-feel esters
  (2, 4) and the medium-band jojoba wax ester (10).
- `threshold_reasoning[]`: the multi-family `moderate` row is explicitly **not** reached — it requires that **none** of
  the families is a rich-band member, and two are. `moderate`'s single-family row is far below the observed load.
- Ceiling: confidence is held at `moderate` rather than `moderately_high` because the "fully readable above the tail"
  condition is satisfied only trivially under a rank-36 marker.
- **§10.1.2 weight conflict tag — declined, condition named.** Condition 1 is satisfied (WT `high` from formula alone).
  **Condition 2 fails: the candidate lightness statement — „Lightweight moisture with no weigh-down" — is C5**
  (English-language EU storefront, not a German-market manufacturer page, §2.4.1 rule 3), and the C4 flaconi.de
  „Volumen" tag is not about the finish this product leaves. **A retailer, marketplace or secondary statement (C3–C5)
  never triggers the tag.** `weight_potential` projects `high`, and the contradicting positioning is preserved in the
  trace with its tier. A tag applied here would be invalid.
- **Transfer caution attached (qualitative):** castor oil and shea butter are low-spreading, non-volatile,
  non-film-forming lipids. No published instrumental transfer method exists (§17.3) — caution only, never a score.
- `limitations[]`: fine-hair residue threshold is a product judgment call (§17.11).

### PERS — `permanent_cationic` (projects `high`)
- `confidence` **moderate** (ceiling cap) · **E2** · formula
- **Guar Hydroxypropyltrimonium Chloride (11)** and **Polyquaternium-10 (12)** are both enumerated by INCI name in the
  `permanent_cationic` class — polymeric quaternisation, visible on the label, no charge-density inference (which G4
  forbids). Both sit above the marker.
- The monomeric long-chain quat (Behentrimonium Chloride 6) and the neutral lipids are recorded as supporting, lower
  classes; the §7.6 monomeric note is not required because a monomeric quat is **not** the dominant persistent species.
- **G3 rule 4 / FS-13:** persistence `high` travels with the buildup caution. FS-20 is directly on point and observed —
  "silicone-free plus a cationic polymer" is **not** low buildup, and this silicone-free product carries two of the
  most substantive materials in the category.
- **G11:** no duration, wash count, applications-to-buildup or clarification schedule.

### HOLD — `incidental_film`
- `confidence` **low** · **E1/E2** · formula
- **PVP (rank 32)** is a fixative-class L5 member and sits **above** the marker (rank 36), so the **rank prong** places
  it as architecture (§3.1.1 clause 1).
- `threshold_reasoning[]`: `meaningful_hold_route` requires **thin or absent** conditioning architecture behind the
  polymer. Here a substantive conditioning architecture dominates overwhelmingly — an LGN pair, two polymeric quats and
  a rich emollient package, all at ranks 2–12. → `incidental_film`. `none` is refused because a fixative-class polymer
  is genuinely present.
- **Coherence counter-signal (§3.1.1 clause 2):** PVP at rank 32 of 40, ahead of a marker at 36, reads as a token
  addition rather than a structural component. The observation is **recorded and lowers confidence by one step to
  `low`**; it may **not** lower a value the rank prong supports, so the value stands at `incidental_film`.
- No G0 styling review is triggered (that follows `meaningful_hold_route` only).
- FS-9 observed: the hold polymer is not read as conditioning or repair.

### HEAT — trace `not_claimed` · binary `provides_heat_protection: false` · **`claim_authority_gap`**
- `confidence` **high** · **E0/E1**
- §13.2 row 1: no C1/C2 heat claim, and **no L9 member** at any rank. **PVP is not on the closed L9 list** — the list
  contains PVP/**DMAPA Acrylates** Copolymer and VP/Acrylates/Lauryl Methacrylate Copolymer, not plain PVP, and adding
  a member requires new peer-reviewed evidence and a version bump. → binary `false`.
- Routes to review under `claim_authority_gap`: no German-market Curlsmith source exists at all.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- No C1/C2 humidity or anti-frizz claim → `not_claimed` (§7.9 clause 1). The C5 „reducing frizz" line is recorded in
  `counter_signals[]` with its tier.
- §7.9 clause 3 is **not** engaged: there is no hydrophobic continuous film route. The product is silicone-free, and
  PVP is **hygroscopic** — it loses film stiffness as RH rises (SR §F.1), which is the opposite of the
  water-uptake-reduction mechanism the state requires.
- Humectants (Glycerin 7, Panthenol 8, Pentylene Glycol 28) are a counter-signal for humidity, never support (FS-15).

### R2 — `none_visible`
- `confidence` **moderately_high** · **E1** · formula
- No cationised protein, no silane derivative, no silicone quat at any rank. Guar HPTC and PQ-10 are **non-silicone
  cationic polymers**, removed from the `candidate` list in v0.2; they feed PERS and SFR only. Panthenol is a
  fibre-mechanics signal, not an R2 route (FS-24). No hydrolysed protein is declared, so no plain-hydrolysate note; no
  qualifying route sits below the marker, so no `candidate_below_tail` note.

### DOSE — `high` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- Both `high` rows fire: WT `high`, and rich/low-spreading band members present as architecture. FORM contributes no
  value and attaches no variability note (`emulsion`).

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **moderate** · **E1** · formula
- **No `Parfum` is declared**, but two EU-labelled fragrance allergens are: Hydroxycitronellal (39) and Citronellol
  (40), alongside a large botanical-extract block. The `aromatic_or_allergen_exposure` value covers exactly this shape.
- **No alcohol note.** Isopropyl Alcohol (27) is materially present but sits **outside** the `Alcohol Denat.` /
  `Alcohol` enumeration that §7.12 keys on — this is open gap §17.21, named in v0.3 and deliberately not fixed. The
  observation is recorded; the enumeration is not silently widened.
- Hard limit: "no listed fragrance signal" is not claimed here in any case; flags never predict tolerance (§7.12,
  SR §M.12).

### ROLE — `unknown` (`usage_role: []`)
- `confidence` **low** · directions held below authority
- The only directions are on a **C3-equivalent retailer** page. §7.13 rule 1 permits role values only from C1/C2
  directions; retailer application copy corroborates but never creates one. → `usage_role: []`, in `uncertain_fields`.
- `supporting_signals[]` (recorded with tier): "Work the conditioner into your wet hair… Style your curls as usual to
  shape them and increase bounce. Use a gel and/or mousse to finish your styling routine." At C1/C2 this would have
  established `post_wash` and `curl_styling`. Withheld on authority — open gap §17.23.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only |
| CURL | not derived | §17.20 — no value vocabulary exists; and the `curl_definition` focus fails its v0.3 negative gate (below) |
| R3 | **`none`** | Researched, negative: no C1/C2 bond claim, no recognised bond chemistry. No German string |
| LAYER | not emitted | |
| Buildup caution | **emitted** | Travels with `persistence: high`; non-quantitative and consistent with PERS (G3 rule 4) |

## `care_direction` — `moisture`
- `confidence` **moderate** · **E2** · formula
- R2 `none_visible` ⇒ `protein`/`balanced` unreachable. Not silicone-led (the product is silicone-free). L1, L3 and L4
  are all present as architecture ⇒ `moisture` at up to `moderate` confidence.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `high` was established by the LGN pair (Cetearyl Alcohol 3 +
Behentrimonium Chloride 6) **plus a further independent lubrication route**. The anchor is **over-satisfied**: either
the emollient package (2/4/5/9/10) **or** the cationic-polymer film (11/12) can serve as that further route, and
§10.2.1 does not say which set to name when more than one admissible minimal set exists.

**Convention applied by this lane, stated so it is diffable:** a route is *beyond baseline conditioning* only if it is
beyond baseline under **every** admissible COND-establishing set. Under the set {LGN pair, cationic-polymer film}, the
SFR film route is inside baseline. → `smoothing` does **not** qualify.

| Route | Verdict |
|---|---|
| `repair` | Not available. R2 = `none_visible`; no C1/C2 marketing position exists at all, so the second prong is unreachable |
| `smoothing` | **Not available** under the convention above. Recorded as the single most consequential open reading on this slot: under the alternative COND set this product would project `focus.primary: smoothing` |
| `curl_definition` | **Not available.** HOLD is `incidental_film` and PVP is above the marker, so the positive half is met — but the **v0.3 negative gate fails**: the route is unavailable unless the product carries curl/wave positioning **or** texture-targeted directions **at C1/C2**, and there is no C1/C2 source for this product at all. The curl positioning that exists is C5 (brand EU storefront) and C3 (a curl-specialist retailer). The gate is negative only, so its failure disqualifies the route rather than creating anything |
| `heat_styling` | Not available. HEAT = `not_claimed`; ROLE is empty |
| `detangling` | Not available. Prong 1: no C1/C2 positioning. Prong 2 requires WT `low`; WT is `high` |
| `volume_lightness` | Not available. Requires WT `low` **and** no persistent film route; both fail. The C4 „Volumen" tag cannot create a route (principle 4) |
| `shine` | Not available |

**No qualifying route ⇒ `focus.primary: general`**, `secondary: []`. `focus` is listed in `uncertain_fields` because
the §10.2.1 over-satisfaction reading, not the evidence, decided it.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
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
  "uncertain_fields": ["usage_role", "focus", "slip_bias"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: high` (row 3); fine `caution` carries the §7.5 judgment-call limitation.
- `damage_fit` ← row 2. Row 3a needs a **qualifying specialist route** (a distinct L6 substantive film route or an
  exact-product test) — a non-silicone cationic polymer explicitly does not qualify. Row 3b needs
  R2 ∈ {candidate, tested}.
- `texture_fit` ← **row 3**: WT `high` **and** SLIP `high`. `HOLD = incidental_film` does not by itself raise
  curly/coily, and curl branding never determines the result (§10.3).
- `scalp_application_fit` ← **`avoid`**: the architecture trigger fires on its own — WT `high` with rich/low-spreading
  band members present as architecture (castor 5, shea 9). The narrowed v0.3 fragrance rule is not needed and would not
  have fired (no `Alcohol Denat.`/`Alcohol` note).

## German cautions (§18)

| Emitted by | String |
|---|---|
| WT = `high` | „Legt sich spürbar aufs Haar – bei feinem Haar sparsam dosieren." |
| DOSE = `high` | „Reagiert empfindlich auf die Menge: zu viel beschwert, zu wenig bringt wenig." |
| PERS → `high` + buildup | „Bleibt lange im Haar. Bei häufiger Anwendung kann ein kräftigeres Shampoo nötig sein – wie schnell sich etwas aufbaut, hängt von Menge, Häufigkeit und Shampoo ab." |
| `usage_role` unknown | „Dazu haben wir keine belastbare Information." |
| `scalp_application_fit = avoid` | „Nicht für die Kopfhaut gedacht – bitte nur in die Längen und Spitzen geben." |

No „… ist ausgelobt" string: no C1/C2 claim exists. `HOLD = incidental_film` has no §18 string (only
`meaningful_hold_route` does) and none is substituted.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| Absent exact-market identifier | No GTIN established — documented identity-research gap (§2.4, §14) |
| `claim_authority_gap` | No German-market Curlsmith source exists; heat, frizz, curl and lightness statements are all C3–C5 |
| Very late tail marker | Rank 36 of 40 — the above/below test separates almost nothing (§17.18) |
| Directions below C1/C2 authority | `usage_role` empty; open gap §17.23 |
| `focus.primary` decided by a reading, not evidence | §10.2.1 COND over-satisfaction (see Focus) |
| `scalp_application_fit = avoid` | Most restrictive placement value |

`review_status`: `draft` → routed. `out_of_category`: false.
