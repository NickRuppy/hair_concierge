# Slot 9 — Redken Extreme Anti-Snap Leave-In Treatment

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: **Protein / surface-repair** — the set's designated R2 archetype

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | Redken — Extreme Anti-Snap Leave-In Treatment |
| Pack / market | 250 ml · DE |
| GTIN | **unresolved** — two independently corroborated codes circulate (884486453402, 884486210777) |
| Formula source | douglas.de (Art. 117080); hautschutzengel.de corroborates with minor tail variance |
| Identity status | **`provisional_identity_conflict`** |
| Directions status | `captured`, **C3** (douglas.de), rinse test PASS („Ohne ausspülen") |
| Claims status | `present` (4 entries: 2× **C2**, 2× C3) |
| Fingerprint | `ff9c329e18e2b241d246a71a4fd42d7882a03ae4b327574890318d341c8dc628` |

**Claim authority.** `redken.eu/de-de` is a **genuine German-market manufacturer page** — a German-language page
addressed to the German market — and is therefore **C2** under §2.4.1 rule 3 as reworded in v0.3, even though the
domain is `.eu`. douglas.de is **C3** and can only corroborate.

**Frozen claims consumed (§2.4 rule 3):**
- **C2, heat_protection:** „Es stärkt und glättet die Schuppenschicht. Außerdem reduziert es Haarbruch und Spliss und
  bietet gleichzeitig einen **Hitzeschutz**." — `creates_claim: true`. Generic; **no °C figure** anywhere on the C2 page.
- **C2, repair_bond:** „Das Haar sieht bis zu 96% stärker und gesunder aus." — `creates_claim: true`.
- C3, heat_protection (douglas.de): „verleiht deinem Haar einen effektiven Hitzeschutz…" — `creates_claim: false`,
  corroborating only.
- C3, humidity_frizz (douglas.de): „Anti-Frizz" attribute tag — `creates_claim: false`. **The C2 page makes no
  anti-frizz statement.**

**Preserved conflict (G5).** GTIN unresolved between two multiply-corroborated candidates; neither merged nor guessed.
Recorded; routes to review. It affects the identifier only, not the formula read.

## G0 — product-form gate

`in_category`. Aqua leads; directions state „Ohne ausspülen" explicitly (rinse test PASS). HOLD = `none`, so the
§2.3.2 architecture half is not established.

## Reading conventions — the decisive fact on this slot

**Tail marker (§3.1.1): PHENOXYETHANOL at rank 3 of 24.** Above the tail = **ranks 1–2 only** (Aqua, Polyacrylamide).

This is §3.1.1 **limit 3**'s paradigm case, verbatim: *"when the marker sits very high in the list — round 1 saw
Phenoxyethanol at rank 3, placing an entire conditioning architecture nominally in the unordered sub-1 % tail — do not
mechanically collapse COND and WT to `low`. Record the ordinal observation as a strong counter-signal, hold the value
at the level the architecture supports, mark the field uncertain, and lower confidence."*

**Reading applied, and the rule conflict it exposes.** v0.3 clause 1 makes rank the **single deterministic prong** of
"present as architecture", while limit 3 tells the reviewer to hold values at the level the architecture supports on a
very early marker. On this product the two instructions point in opposite directions for almost every dimension. This
lane resolves as follows and states it so it is diffable:

1. Where a §7 anchor has an **explicit above-tail requirement in its own text** (COND `high`'s "LGN pair present above
   the tail"; §7.4 clause 3; §7.10's `candidate_below_tail` rule; §5's L9 tail rule), the **rank prong governs** — the
   anchor's own words are the specific rule.
2. Where limit 3's "do not collapse" instruction applies (COND, WT and the classes derived from the same architecture),
   values are **held at the level the readable architecture supports without promotion**, the field is marked
   **uncertain**, and confidence is **lowered one step**.

The result is a set of middle-path values, every one of them uncertain. That is the honest state of v0.3 on this
product and it is the headline finding of this record.

Full list for reference: Aqua (1) · **Polyacrylamide (2)** · **Phenoxyethanol (3 — marker)** ·
**Amodimethicone (4)** · Arginine (5) · Citric Acid (6) · C13-14 Isoparaffin (7) · Isopropyl Myristate (8) ·
Parfum (9) · Laureth-7 (10) · Xylose (11) · **Hydrolyzed Soy Protein (12)** · Trideceth-6 (13) ·
**Hydrolyzed Vegetable Protein PG-Propyl Silanetriol (14)** · Cetyl Alcohol (15) · Cetrimonium Chloride (16) ·
Behentrimonium Methosulfate (17) · Benzyl Benzoate (18) · **Quaternium-33 (19)** · Limonene (20) ·
Benzyl Alcohol (21) · Linalool (22) · Potassium Sorbate (23) · 2-Oleamido-1,3-Octadecanediol (24).

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: non_lgn`, trace-only)
- `confidence` **moderate** (lowered for the marker) · **E1/E2** · formula
- Decision order: `anhydrous` no → `two_phase` no → **`emulsion` matched**, sub-type (b): the **pre-neutralised
  polyacrylamide / isoparaffin / laureth system** (Polyacrylamide 2, C13-14 Isoparaffin 7, Laureth-7 10) is explicitly
  enumerated in §7.1, carrying a lipid phase (Isopropyl Myristate 8) and a silicone (Amodimethicone 4).
- `counter_signals[]`: an **LGN pair also exists** — Cetyl Alcohol (15) with Cetrimonium Chloride (16) and
  Behentrimonium Methosulfate (17) — but all three sit far below the marker. The sub-type is trace-only and is not
  projected, so nothing downstream turns on which sub-type is named.

### COND — `moderate` *(uncertain)*
- `confidence` **low** (lowered one step under limit 3) · **E2** · formula
- `threshold_reasoning[]`: `high` requires *"an LGN pair present **above the tail**"* — an explicit above-tail
  requirement in the anchor's own text, so the rank prong governs and `high` is refused; the pair sits at ranks 15–17.
  `low` requires "no persistent non-volatile above the tail", which is technically true (only Polyacrylamide is above
  it) — but **limit 3 forbids mechanically collapsing to `low`** on a rank-3 marker, because a low-ranked non-volatile
  under such a marker is *unpositioned*, not *absent*. The readable architecture supports one coherent conditioning
  route: Amodimethicone (4) with the cationic package and Isopropyl Myristate (8). → **`moderate`**, marked uncertain.
- `counter_signals[]`: the rank-3 marker itself, recorded as a strong counter-signal on every dependent value.

### SLIP — `moderate` *(uncertain)*, bias `unknown`
- `confidence` **low** · **E2** · formula
- `high` needs two or more independent M1 contributors **present as architecture**; nothing conditioning-relevant is
  above the marker, so no promotion is available. Limit 3 prevents collapsing to `low`. → `moderate`.
- Bias `unknown`: a non-film lipid load plus a monomeric-quat architecture — the shape §17.16 records as having no
  matching bias value.

### SFR — `moderate` *(uncertain)* (`smoothing_shine_qualifier: present`)
- `confidence` **low** · **E2** · formula
- **§7.4 clause 3 is directly on point and governs:** *"Where the only candidate second route sits at or below the tail
  marker, it is not available (§3.1.1) and the value is `moderate`."* Both the film route (Amodimethicone 4) and every
  candidate lubrication route (Isopropyl Myristate 8, the LGN pair) sit below the rank-3 marker. → `moderate`.
- This is the conservative reading G3 requires; no promotion is attempted.

### WT — `moderate` *(uncertain)*, multi-family row
- `confidence` **low** · **E2** · formula
- `threshold_reasoning[]`: the `high` anchor needs an LGN pair **present as architecture** (below the marker here) or
  ≥2 persistent families **with an enumerated rich/low-spreading band member** — and there is **no rich-band member at
  any rank**: Isopropyl Myristate is a **dry-feel / high-spreading** ester, and no coconut/olive/castor/avocado oil,
  shea/mango/cocoa butter, petrolatum or heavy mineral oil is declared. `low` would be the mechanical rank answer and
  limit 3 forbids it. The readable architecture supports the **multi-family `moderate` row**.
- **Mandatory multi-family counter-signal (§4, R13):** the families are (a) persistent silicone — Amodimethicone (4);
  (b) dry-feel ester — Isopropyl Myristate (8); (c) the LGN/cationic deposit — Cetyl Alcohol (15), Cetrimonium
  Chloride (16), Behentrimonium Methosulfate (17). What holds the value **below `high`** is the absent rich/
  low-spreading band member, which is what the `high` anchor is about — occlusion, weight and transfer. Dose remains
  the unmeasured term (§17.1). Confidence caps at `moderate` by the row and is lowered a further step to `low` by
  limit 3.
- `counter_signals[]`: the rank-3 marker; every family named sits below it.
- **§10.1.2 weight conflict tag:** not applicable — condition 1 fails (WT is not `high`). No C1/C2 intended-finish
  statement exists in the freeze in any case.
- Transfer caution: **not** attached — IPM is high-spreading. IPM's known negative "grating/dry" sensory note (L3) is
  recorded as an observation, not scored.

### PERS — `ph_dependent_cationic` (projects `moderate`) *(uncertain)*
- `confidence` **low** · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` requires a polymeric or silicone-functional quat **enumerated by INCI
  name**. The only candidate is **Quaternium-33 (19)** — an opaque `Quaternium-x` number whose polymeric-vs-monomeric
  structure the INCI name does not settle. §7.6's unresolvable-quat rule: **it is not promoted**; record
  `quat_structure: unresolved` and route to review. Supplier substantivity claims are not used (that would be a
  charge-density inference by another route, G4). Polyacrylamide (2) is not a quat.
  Amodimethicone (4) is the dominant persistent cationic species and places the record in `ph_dependent_cationic`.
- `counter_signals[]`: Amodimethicone sits at rank 4, **below** the marker at rank 3 — the class rests on a
  below-marker species, recorded under §3.1.1 clause 3 with the review route. Also recorded: Behentrimonium
  Methosulfate and Cetrimonium Chloride, monomeric long-chain quats, would place the record in `neutral_non_volatile`
  with the §7.6 monomeric note if amodimethicone were disregarded — **both readings project `moderate`**, so the
  projected field is robust to this choice.
- **FS-12 observed:** amodimethicone's rinse-off selectivity argument is **not** used. In a leave-on there is no rinse
  to remove the non-selective fraction, and streaming-potential work shows deposition continues after surface-charge
  reversal — it does not self-limit.
- **G11:** no duration, wash count, applications-to-buildup or clarification schedule.

### HOLD — `none`
- `confidence` **moderate** · **E1/E2**
- Polyacrylamide (2) is the only candidate polymer and v0.3 **deliberately leaves it unenumerated** in L5 (§17.19);
  here it plainly serves the pre-neutralised emulsifier system it appears in. Treating it as a fixative would be an
  untraced rule extension. FS-25 observed.

### HEAT — trace **`claim_only`** · production binary **`provides_heat_protection: true`** · **routes to review**
- `confidence` **high** (on the claim) · **E0/E1**
- **§13.3 rule 1:** a **C1/C2** heat claim exists — „…bietet gleichzeitig einen Hitzeschutz" on redken.eu/de-de, a
  German-market manufacturer page (C2 under rule 3). ⇒ binary **`true`**. A policy decision, not an efficacy statement.
- **§13.3 rule 2 — formula sanity-check against the closed L9 list: no member is present at any rank.**
  - **Hydrolyzed Vegetable Protein PG-Propyl Silanetriol is not "hydrolyzed wheat protein."** The published result is
    for one specific protein at a defined concentration in a model system; a silanised vegetable hydrolysate does not
    inherit it. Hydrolyzed Soy Protein (12) is likewise not wheat.
  - **Quaternium-33 is not Quaternium-70.** The list is closed by exact species.
  - Polyacrylamide, amodimethicone and IPM are not on the list; generic silicone and generic protein explicitly stop at
    `claim_only` (G10, FS-7).
  ⇒ **`true`, trace state `claim_only`, route to review** with a "claim looks formula-unsupported" note.
- The C3 douglas.de heat text is recorded as corroboration with its tier. **No °C figure exists on the C2 page and none
  is used** (FS-14); `heat_protection_max_c` does not exist in this model; no efficacy grade is emitted.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- §7.9 clause 1: the only humidity/anti-frizz statement is the **C3** douglas.de „Anti-Frizz" attribute tag, and the
  C2 page makes **no** anti-frizz statement. Retailer copy never creates a claim (G13). ⇒ `not_claimed`.
- `counter_signals[]`: the C3 tag, recorded with its tier. Routes to review under **`claim_authority_gap`**.
- §7.9 clause 3: a hydrophobic film route (Amodimethicone 4) is present but **below the marker**; the observation is
  recorded in `supporting_signals[]` with the required sentence and the state stays `not_claimed`. Nothing user-facing
  is emitted either way.

### R2 — `none_visible` + **`candidate_below_tail`** *(uncertain)*
- `confidence` **low** · **E1** · formula
- **`candidate_below_tail` note (§7.10, v0.3 — mandatory `counter_signals[]` entry):** a §7.10-**qualifying** route is
  present — **Hydrolyzed Vegetable Protein PG-Propyl Silanetriol, a silane derivative, at rank 14** — sitting **below
  the tail marker, Phenoxyethanol, at rank 3**. The dimension takes its **rank-supported value, `none_visible`**, and
  the record **routes to human review**. The note is not a fourth state and never appears in the lean profile (G14).
- **Mandatory plain-hydrolysate note (§7.10 change 2):** Hydrolyzed Soy Protein (12) is observed and recorded; a plain
  hydrolysate is `none_visible` at any position.
- Arginine (5) and Xylose (11) are not R2 routes. 2-Oleamido-1,3-Octadecanediol (24) is a ceramide-analogue lipid, not
  a substantive protein/silane film route.
- **This is the round-3 headline.** The set's designated protein/surface-repair archetype carries a genuine qualifying
  silane route and still returns `none_visible`, because the marker sits at rank 3 and §7.10's below-tail rule takes
  the rank-supported value. §3.1.1 clause 4 states the trade openly: this is a determinism decision, not an accuracy
  claim, and its error direction is known. The review route is what carries the risk to a human — see the
  `damage_fit` and Focus consequences below.

### DOSE — `moderate` (derived) *(uncertain)*
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **low**
- WT `moderate` (multi-family row) ⇒ DOSE `moderate`; **not** separately re-argued upward on family count (§7.11,
  "DOSE follows WT"). No rich/low-spreading band member exists, so the `high` row does not fire. FORM contributes no
  value.

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **high** · **E1** · formula
- Parfum (9) plus a declared allergen block: Benzyl Benzoate (18), Limonene (20), Benzyl Alcohol (21), Linalool (22).
- **No alcohol note.** Benzyl Alcohol is declared as a preservative/allergen and sits **outside** the
  `Alcohol Denat.` / `Alcohol` enumeration §7.12 keys on (§17.21). Observation recorded; the enumeration is not
  silently widened.

### ROLE — `unknown` (`usage_role: []`)
- `confidence` **low** · directions held below authority
- The captured directions are **C3** (douglas.de). Redken is a third-party brand at Douglas, so the house-brand clause
  does not apply. §7.13 rule 1 permits role values only from C1/C2 directions. → `usage_role: []`, in
  `uncertain_fields`.
- `supporting_signals[]` (recorded with tier): „Auf einzelne brüchige Haarstellen oder auf dem ganzen Haar verteilen
  und einmassieren. **Ohne ausspülen**, direkt die Haare wie gewohnt stylen." At C1/C2 this text would still not have
  established `heat_styling` — it names no heat tool and positions nothing before heat styling — so the loss here is
  narrower than it looks, but it also costs `post_wash`.
- **Note the shape.** A **C2 manufacturer page exists** (redken.eu/de-de) and supplies the heat claim, but the packet
  captured directions only from the C3 retailer. §17.23 covers verified directions below C1/C2 authority; this slot
  additionally shows a case where a C2 source exists and simply was not the directions source. Recorded for the freeze,
  not resolved here — a lane may not re-research (§2.4 rule 3).

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only; the C2 „glättet die Schuppenschicht" positioning creates no independent value |
| CURL | not derived | §17.20; `curl_definition` also fails HOLD and the negative gate |
| R3 | **`none`** | Researched, negative: no C1/C2 **bond** claim (the C2 claims are heat and a strength percentage) and no recognised bond chemistry. No German string |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate`; the below-marker amodimethicone and the unresolved quat are the recorded under-warning direction |

## `care_direction` — `moisture` *(uncertain)*
- `confidence` **low** · **E2** · formula
- R2 is `none_visible` (by the rank rule), so `protein` and `balanced` are unreachable — **even though the product's
  entire positioning and its silanised protein are protein-side**. §9's `protein` anchor is defined over
  R2 ∈ {`candidate`, `tested`}, and that value did not survive the rank prong.
- The §9 silicone-led `unknown` rule does not fire: a material emollient leg exists (Isopropyl Myristate 8) — the
  under-firing shape recorded as open gap §17.22. L1 (cationic package) + L3 (IPM) ⇒ `moisture`.
- **Recorded as a v0.3 defect candidate:** a rank-3 marker on a silane-carrying repair product drives
  `care_direction` to `moisture` and `repair_surface_film` to `none_visible` at once. Both flow from the same
  unvalidated heuristic (§17.14, §17.18).

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `moderate` was established by Amodimethicone (4) with the cationic package
and Isopropyl Myristate (8) — all below the marker, held under limit 3.

*Step 1 — collect qualifying routes.*

| Route | Verdict |
|---|---|
| `repair` | **Not available.** Prong 1: R2 = `none_visible` (the qualifying silane is below the marker). Prong 2: the C2 page names **no protein or silane active** — „Es stärkt und glättet die Schuppenschicht", „reduziert Haarbruch und Spliss", „bis zu 96% stärker" is **generic repair naming**, which the row excludes. Neither prong fires |
| `smoothing` | Not available. SFR is `moderate` (§7.4 clause 3), not `high` |
| `curl_definition` | Not available. HOLD = `none`; the negative gate also fails |
| `heat_styling` | **Not available.** First half satisfied — HEAT ≥ `claim_only` under C1/C2 authority. Second half fails: ROLE is empty because the only captured directions are C3. Note this is an **authority** failure, not the tool-name failure the v0.3 `pre_heat` widening addressed |
| `detangling` | Not available. No C1/C2 detangler positioning; prong 2 requires WT `low` |
| `volume_lightness` | Not available. Requires WT `low` |
| `shine` | Not available |

*Steps 2–5.* No exact-product evidence; no qualifying route at all. ⇒ **`focus.primary: general`**, `secondary: []`.
`focus` is listed in `uncertain_fields`.

> **This is the clearest single finding of round 3.** The gold set's **protein / surface-repair archetype** projects
> `focus.primary: general`, `care_direction: moisture`, `repair_surface_film: none_visible` and
> `damage_fit.highly_damaged: conditional` — every one of them because the tail marker landed at rank 3 of 24. Round 2
> reported the mirror-image failure on this same archetype (a `smoothing` focus over a genuine repair route);
> v0.3's fixes moved the failure rather than removing it, and §3.1.1 clause 4 and §17.18 both predict exactly this.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "moisture",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": true, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": [
    "conditioning_level", "weight_potential", "persistence", "care_direction",
    "focus", "usage_role", "slip_bias"
  ]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: moderate` (row 2); fine value carries the §7.5 judgment-call limitation.
- `damage_fit` ← **row 2**. Row 3a needs COND `high`; row 3b — **R14's repair-film path** — needs
  R2 ∈ {candidate, tested}. The product carries a genuine silane route, but it is below the marker, so **the tier
  written for exactly this product is unreachable**. This is the consequence §7.10's review route exists to put in
  front of a human (§7.10 consequence 2, verbatim).
- `texture_fit` ← row 2 (WT `moderate`, any slip).
- `scalp_application_fit` ← **`unknown`** (the default): no occlusive/oil-led architecture; the narrowed v0.3
  irritant-load trigger needs an exposure flag **plus** a material `Alcohol Denat.`/`Alcohol` note, and Benzyl Alcohol
  is outside that enumeration; positive and `conditional` values both require C1/C2 directions, which are absent.

## German cautions (§18)

| Emitted by | String |
|---|---|
| HEAT claim without an L9 member (review route) | „Hitzeschutz ist ausgelobt; in der Rezeptur finden wir dafür keinen belegten Wirkstoff. Wir prüfen das." |
| `usage_role` unknown | „Dazu haben wir keine belastbare Information." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |

No anti-frizz string: the „Anti-Frizz" tag is C3 and „… ist ausgelobt" requires C1/C2 authority (§18, G13). No R2
string: R2 is `none_visible`, so neither §18 R2 row applies — the silane route is a trace observation only.

## Review routing (§14)

| Trigger | Basis |
|---|---|
| **`candidate_below_tail`** | Hydrolyzed Vegetable Protein PG-Propyl Silanetriol (silane) at rank 14 vs marker at rank 3 (§7.10, v0.3) |
| **Very early tail marker** | Rank 3 of 24 — §3.1.1 limit 3; decisive on COND, SLIP, SFR, WT, PERS, R2, `care_direction` and `focus` |
| **Heat claim with no L9 member** | §13.3 rule 2 — binary `true`, formula unsupported |
| `quat_structure: unresolved` | Quaternium-33 (§7.6) |
| `claim_authority_gap` | C3-only anti-frizz claim; the C2 page is silent |
| Identity conflict | GTIN unresolved between two corroborated candidates (G5) |
| Directions below C1/C2 authority | `usage_role` empty, although a C2 manufacture page exists (§17.23) |

`review_status`: `provisional` → routed. `out_of_category`: false.
