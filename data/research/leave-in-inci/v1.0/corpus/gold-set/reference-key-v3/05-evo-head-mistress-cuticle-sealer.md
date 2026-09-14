# Slot 5 — EVO Head Mistress Cuticle Sealer

Engine: `leave-in-inci-v0.3` · Key: `reference-key-2026-09-04-r3` · Lane: category-developer reference key, round 3
Archetype role: Silicone-rich smoother

## Identity (G1)

| Field | Value |
|---|---|
| Brand / product | EVO — Head Mistress Cuticle Sealer |
| Pack / market | 150 ml · DE (EU availability confirmed) |
| GTIN | 9349769013144 |
| Formula source | evohair.com/us (manufacturer, SKU 39268); haarspullen.nl confirms EAN + declared order |
| Identity status | `verified` |
| Directions status | `captured` (English, US-region manufacturer page), rinse test PASS |
| Claims status | `none_found_at_C1_C2` |
| Fingerprint | `d7cccb0d955a0544407fec4d5a864b9b3a3a6ee504ea13bb8721e146c0a2c4ea` |

**Claim and directions authority (§2.4.1 rule 3, as governing in v0.3).** `evohair.com/us` is a **US-region** page.
Rule 3 governs and the C2 row is worded to match: a non-German-market manufacturer page is **C5**, whether or not it is
in the EU. The packet's "C2-equivalent (judgment)" stamp is therefore **not adopted**. EVO has no German-market page
(no `/de/` region, no evohair.de) — so **no C1/C2 source exists for this product**.

**Frozen claims consumed (§2.4 rule 3).** `claims[] = []`. Recorded as counter-signals, never as claims:
- C5 (evohair.com/us, English): „heat protection", „uv protection", „reduces frizz", „improves condition".
- C4 (nicebeauty.com, German, ships to DE): „Darüber hinaus wirkt die Multifunktionscreme auch als UV- und Hitzeschutz";
  „Reduziert Frizz".
Retailer copy never creates a claim, and a non-German manufacturer page is C5 (§2.4.1, G13). Both heat and humidity
therefore take their no-claim values, and the record routes to review under **`claim_authority_gap`** — a human decides
whether a manufacturer source was simply not found (here, the search establishes that none exists).

**Preserved observation (G5).** A stray fetch of a region-less evohair.com URL returned an unrelated LGN-emulsion
list attributed to the same product name; discarded as a page-mismatch artifact against three mutually-agreeing
sources, recorded for audit, not merged.

## G0 — product-form gate

`in_category`. Aqua leads (rank 1); the captured directions apply the product to towel-dried hair before blow-drying
and after styling, with no rinse instruction (rinse test PASS). The §2.3.2 architecture half is not established:
the only candidate hold polymer is **Polyacrylamide**, which v0.3 deliberately leaves **unenumerated** in L5
(§17.19) and which plausibly serves the emulsifier/rheology function here; HOLD returns `none`.

## Reading conventions

**Tail marker (§3.1.1):** first capped ingredient = **PHENOXYETHANOL, rank 6 of 25**. Above the tail = ranks 1–5:
Aqua · Dimethicone · Cyclopentasiloxane · Polyacrylamide · Dimethiconol.

**§3.1.1 limit 3 — early marker.** A marker at rank 6 places most of the list nominally in the unordered sub-1 % tail.
That is recorded as a **strong counter-signal** on every dependent anchor; values are held at the level the readable
architecture supports and are **not** mechanically collapsed, and confidence is lowered where the marker decided the
answer. This does not license promoting a value the rank prong cannot place (§3.1.1 clause 1).

Below-tail, decision-relevant: Panthenol (8) · C13-14 Isoparaffin (9) · Laureth-7 (10) · **Hydrolyzed Quinoa (12)** ·
Macadamia Ternifolia Seed Oil (13) · **Quaternium-80 (14)** · Butylene Glycol (18).

## Dimensions (§7)

### FORM — `emulsion` (`emulsion_subtype: non_lgn`, trace-only)
- `confidence` **moderately_high** · **E1/E2** · formula
- Decision order: `anhydrous` no → `two_phase` no (a true emulsifying system is present) → **`emulsion` matched**,
  sub-type (b): the **pre-neutralised polyacrylamide / isoparaffin / laureth system** (Polyacrylamide 4,
  C13-14 Isoparaffin 9, Laureth-7 10) is explicitly enumerated in §7.1, carrying a silicone phase (Dimethicone 2,
  Dimethiconol 5).
- `threshold_reasoning[]`: no LGN pair (no fatty alcohol at all), so sub-type (a) is not the read. `microemulsion` is
  not reached in the decision order.

### COND — `moderate`
- `confidence` **moderate** (ceiling moderately_high) · **E2** · formula
- One coherent conditioning route: a **persistent silicone package** above the tail — Dimethicone (2), Dimethiconol (5).
  Cyclopentasiloxane (3) is a **volatile carrier** and contributes nothing to residue or persistence (M6, FS-4).
- `threshold_reasoning[]`: `high` is gated on an LGN pair, which is absent. This is the **carried-open COND cap** on
  silicone-led products (BR §2.10, §21.1 "deliberately not changed") — recorded, not worked around.
- `counter_signals[]`: Quaternium-80 (silicone quat) and macadamia oil sit below the marker and are not counted.

### SLIP — `moderate`, bias `dry_biased`
- `confidence` **moderate** · **E2** · formula
- `threshold_reasoning[]`: `high` needs **two or more independent** M1 contributors present as architecture. Only one
  is present — the persistent silicone film. Counting Dimethicone and Dimethiconol as two contributors would be the
  same architecture read twice, which G3 forbids. The candidate second contributors (Quaternium-80 14, macadamia oil 13)
  are below the marker. → `moderate`.
- Bias `dry_biased`: a persistent film is present and the water-phase slip agents (Panthenol 8, Butylene Glycol 18) are
  all below the marker — the `dry_biased` row's shape.

### SFR — `moderate` (`smoothing_shine_qualifier: present`)
- `confidence` **moderate** · **E2** · formula
- **§7.4 clause 2 is directly on point:** "A Dimethicone/Dimethiconol pair … counted once as film and once as lubricant
  is **one** observation. It supports `moderate`, not `high`." The film route and the only available lubrication read
  rest on the same two species.
- **§7.4 clause 3:** the only candidate second routes — Quaternium-80 (14) and Macadamia Ternifolia Seed Oil (13) —
  sit **below the tail marker at rank 6**, so they are not available, and the value is `moderate`.
- This is the conservative reading G3 requires and is exactly the change v0.3 made in G3's favour.

### WT — `moderate`
- `confidence` **moderate** · **E2** · formula
- `formula_observations[]`: **exactly one** persistent non-volatile family present as architecture — the persistent
  silicone (Dimethicone 2, Dimethiconol 5). Cyclopentasiloxane (3) is volatile and contributes nothing (M6).
  Polyacrylamide (4) is an emulsifier polymer and is **not** one of the §7.5 enumerated families (light/medium-band
  emollient, light silicone, cationic-polymer film); it is recorded, not counted.
- `threshold_reasoning[]`: `high` needs an LGN pair (absent) or ≥2 families with a rich-band member (macadamia oil is
  below the marker and is medium-band in any case). `low` needs **no** persistent non-volatile family above the tail;
  the silicone is at ranks 2 and 5. → `moderate`.
- `counter_signals[]`: the early marker at rank 6 — the entire remainder of the list is nominally unpositioned, so a
  low-ranked non-volatile here is *unpositioned*, not *absent* (§3.1.1 limit 3). Confidence is therefore held at
  `moderate` and does **not** rise to `moderately_high` even though FORM resolves to a definite architecture.
- **§10.1.2 weight conflict tag:** not applicable — condition 1 fails (WT is not `high`), and no C1/C2 statement of any
  kind exists for this product.
- **G9:** "clear/cream/spray" reasoning is not used in either direction; FS-4 observed — the volatile silicone does not
  make the formula residue-free, since the residue is whatever the volatile was carrying.

### PERS — `neutral_non_volatile` (projects `moderate`)
- `confidence` **moderate** · **E2** · formula
- `threshold_reasoning[]`: `permanent_cationic` would be reached by **Quaternium-80**, which is enumerated by name in
  the silicone-functional group — but it sits at **rank 14, below the marker at rank 6**, so the rank prong does not
  place it as architecture and it cannot set the class (§3.1.1 clauses 1 and 3). `ph_dependent_cationic` needs an
  amino silicone or amidoamine; none is declared. The highest class present as architecture is the neutral
  non-volatile silicone deposit.
- **Below-marker counter-signal (§3.1.1 clause 3):** Quaternium-80, rank 14; marker Phenoxyethanol, rank 6. The known
  error direction is that strict rank **under-states** persistence and therefore under-warns on buildup (FS-20). The
  record **routes to human review** so that risk is carried by a person, not by a rank heuristic.
- No monomeric long-chain quat is the dominant persistent species, so the §7.6 monomeric note does not apply.
- G11: no duration, wash count or clarification schedule; the banned removal percentages are not used.

### HOLD — `none`
- `confidence` **moderate** · **E1/E2** · formula
- Polyacrylamide (4) is the only candidate polymer. v0.3 **deliberately leaves it unenumerated** in L5 (§17.19,
  §21.2 "deliberately not changed"), and it plausibly serves the emulsifier/rheology function in the
  polyacrylamide/isoparaffin/laureth system it appears in. Treating it as a hold polymer would be an untraced rule
  extension. → `none`, with the observation recorded and the open gap named.
- FS-25 observed: bottle rheology is not read as hair performance.

### HEAT — trace `not_claimed` · binary `provides_heat_protection: false` · **`claim_authority_gap`**
- `confidence` **high** · **E0/E1**
- §13.2 row 1: **no C1/C2 heat claim** — the only heat statements are C5 (US manufacturer page) and C4 (German
  retailer), neither of which can create one (§2.4.1, G13). No L9 member is present at any rank. → binary `false`
  (§13.3 rule 1), retailer text recorded in `counter_signals[]`, record routed to review.
- FS-7 observed: generic silicone does not prove heat protection.

### HUM — `not_claimed`
- `confidence` **high** · **E0**
- §7.9 clause 1 (v0.3 claim-led ladder): **no C1/C2 humidity or anti-frizz claim ⇒ `not_claimed`, whatever the formula
  shows.** The C4 „Reduziert Frizz" and C5 „reduces frizz" are recorded in `counter_signals[]` with their tiers.
- **§7.9 clause 3 applies:** a qualifying route *is* present — a persistent hydrophobic silicone film (Dimethicone 2,
  Dimethiconol 5) present as architecture, with no dominant humectant architecture (Butylene Glycol 18 is below the
  marker). Recorded in `supporting_signals[]` with the required sentence: *"a hydrophobic film route is present; the
  manufacturer makes no humidity claim; humidity response is measured, not inferred."* The state stays `not_claimed`
  and **nothing user-facing is emitted** — this is an observation, not a state.
- This slot is the clearest demonstration of the v0.3 reversal: under v0.2 this record would have projected
  `formula_plausible` into a matching field that no §18 string was permitted to explain.

### R2 — `none_visible` + **`candidate_below_tail`**
- `confidence` **moderate** · **E1** · formula
- **`candidate_below_tail` note (§7.10, v0.3 — mandatory `counter_signals[]` entry):** a §7.10-**qualifying** route is
  present — **Quaternium-80, a silicone quat, at rank 14** — sitting **below the tail marker, Phenoxyethanol, at
  rank 6**. The dimension takes its **rank-supported value, `none_visible`**, and the record **routes to human review**.
  The note is not a fourth state between `none_visible` and `candidate`, and no downstream consumer may read it as one
  (G14). It never appears in the lean profile.
- **Mandatory plain-hydrolysate note (§7.10 change 2):** Hydrolyzed Quinoa (12) is observed and recorded. A plain
  hydrolysate is `none_visible` at any position; what makes a protein an R2 route is cationisation or silane
  functionalisation, not rank.
- Panthenol (8) is a fibre-mechanics signal, not an R2 route and not a heat route (FS-24).

### DOSE — `moderate` (derived)
- `derived_from`: `[WT, FORM, L3 spreading class]` · **E2** · `confidence` **moderate**
- WT `moderate` ⇒ DOSE `moderate`. FORM contributes no value; `emulsion` attaches no variability note.

### EXPO — `aromatic_or_allergen_exposure`
- `confidence` **high** · **E1** · formula
- Parfum (7) plus a declared allergen block: Limonene (21), Hexyl Cinnamal (22), Linalool (23), Geraniol (24),
  Citral (25). No `Alcohol Denat.` / `Alcohol` → **no alcohol note**.
- Benzophenone-4 (11) is recorded as an observation; it is a UV filter, not a fragrance or scalp-exposure signal, and
  no UV property is inferred from it (the C5 „uv protection" line is not a claim under G13 and sets nothing).

### ROLE — `unknown` (`usage_role: []`)
- `confidence` **low** · directions held below authority
- The only directions available are on the **US-region** manufacturer page, which is **C5** under §2.4.1 rule 3.
  §7.13 rule 1 permits role values only from C1/C2 directions. → `usage_role: []`, listed in `uncertain_fields`.
- `supporting_signals[]`, recorded with tier: "Apply to towel-dried hair and blow-dry for improved manageability and
  softness. Apply after styling to control frizz and fly-aways." Read at C1/C2 this text would have established
  `post_wash` and, under the v0.3 `pre_heat` widening, `heat_styling` — it is withheld on **authority**, not on the
  tool-name test. Recorded so the cost of rule 3 is visible in the diff.
- The rinse test still ran on this text and passed; only the role assignment is withheld.

## Demoted flags (§8)

| Flag | Value | Note |
|---|---|---|
| SHN | `present` | Qualifier on SFR only |
| CURL | not derived | §17.20; and `curl_definition` fails HOLD and the negative gate |
| R3 | **`none`** | Researched, negative: no C1/C2 bond claim, no recognised bond chemistry. No German string |
| LAYER | not emitted | |
| Buildup caution | not emitted | `persistence` projects `moderate` — see the below-marker counter-signal for why that is the under-warning direction |

## `care_direction` — `unknown`
- `confidence` **moderate** · **E2** · formula
- **§9's silicone-led rule fires cleanly here.** Conditioning is led by Dimethicone/Dimethiconol; there is **no R2
  route** and **no material humectant or emollient leg** — Panthenol (8), Macadamia Ternifolia Seed Oil (13) and
  Butylene Glycol (18) all sit below the tail marker at rank 6 and are therefore not present as architecture.
- `protein` is defined over L6/R2 and `moisture` over L1/L3/L4; **L2, the silicone route, appears in neither**, and
  that is not an oversight to be interpolated away. The silicone architecture is recorded in the trace so the
  `unknown` reads as a deliberate abstention rather than a missing analysis.
- **T19 supersession (2026-09-12, Nick's binding ruling — §9 amended, gap §17.22 closed): the value is now
  `balanced`.** The reasoning above stays correct as far as it goes — the record reads as neither moisture- nor
  protein-directed — but under amended §9 that reading has a name: directional neutrality, `balanced`
  (row `film_led_neutral`). All four clauses of the film-led rule hold on this record: no R2 as architecture
  (Quaternium-80 sits at r14, below the r6 marker), a substantive L2 film above the marker (Dimethicone r2,
  Cyclopentasiloxane r3, Dimethiconol r5), no L1/L3/L4 species above the marker at all, and every film species
  outranks every subordinate leg candidate. `unknown` is reserved for genuine evidence failure from T19 on.
  See reference-key-v4/transform-notes.md §22 and §21.3 ledger row 19.

## Focus (§10.2)

**Baseline conditioning (§10.2.1).** COND `moderate` was established by the persistent silicone film (Dimethicone 2,
Dimethiconol 5) — and by nothing else.

| Route | Verdict |
|---|---|
| `repair` | Not available. R2 = `none_visible`; no C1/C2 marketing position of any kind exists |
| `smoothing` | **Not available on two independent grounds.** (i) SFR is `moderate`, not `high` (§7.4 clauses 2 and 3). (ii) §10.2.1's second bullet: the persistent silicone **is** the COND read — the film is what makes the product a conditioner at all, and there is no separate alignment observation above the marker — so it is baseline conditioning, not a route. A film that is a by-product of the conditioning architecture is not a smoothing route |
| `curl_definition` | Not available. HOLD = `none`; the negative gate also fails |
| `heat_styling` | Not available. HEAT = `not_claimed`, and ROLE is empty |
| `detangling` | Not available. Prong 1: no C1/C2 positioning. Prong 2 requires WT `low`; WT is `moderate` |
| `volume_lightness` | Not available. Requires WT `low` and no persistent film route; both fail |
| `shine` | Not available. Would merely restate the smoothing film (§8.1, G3) |

**No qualifying route ⇒ `focus.primary: general`**, `secondary: []`.

*Worth stating plainly:* this is the set's "silicone-rich smoother" archetype and it projects `general`. That is the
designed consequence of v0.3's two-observation SFR anchor plus §10.2.1's second bullet, and it is recorded as a
deliberate outcome rather than a miss.

## Lean matching profile (`leave-in-matching-v0.3`)

```jsonc
{
  "product_form": "emulsion",
  "conditioning_level": "moderate",
  "weight_potential": "moderate",
  "persistence": "moderate",
  "hold_support": "none",
  "care_direction": "unknown",
  "focus": { "primary": "general", "secondary": [] },
  "usage_role": [],
  "specialist_functions": { "provides_heat_protection": false, "humidity_resistance": "not_claimed" },
  "hair_thickness_fit": { "fine": "conditional", "medium": "recommended", "coarse": "recommended" },
  "damage_fit": { "healthy": "recommended", "moderately_damaged": "recommended", "highly_damaged": "conditional" },
  "texture_fit": { "straight": "recommended", "wavy": "recommended", "curly": "recommended", "coily": "conditional" },
  "scalp_application_fit": "unknown",
  "uncertain_fields": ["usage_role", "care_direction"]
}
```

**Fit derivations.**
- `hair_thickness_fit` ← `weight_potential: moderate` (row 2).
- `damage_fit` ← row 2 (COND `moderate`, no qualifying repair route — R2 is `none_visible`, so row 3b is unreachable
  **even though a silicone quat is present**, because it is below the marker; that consequence is exactly what the
  `candidate_below_tail` review route exists to put in front of a human).
- `texture_fit` ← row 2 (WT `moderate`, any slip).
- `scalp_application_fit` ← **`unknown`** (the default), ordered test: `avoid` does not fire — the architecture is
  neither heavy-occlusive nor oil-led (WT `moderate`, no rich-band member as architecture), and the narrowed v0.3
  irritant-load trigger needs an exposure flag **plus** a material alcohol note, which is absent. Positive values
  require C1/C2 directions, which do not exist. No non-scalp placement is stated at C1/C2 either, so `conditional` is
  not reachable.

## German cautions (§18)

| Emitted by | String |
|---|---|
| `care_direction` = `unknown` | „Dazu haben wir keine belastbare Information." |
| `usage_role` unknown | „Dazu haben wir keine belastbare Information." |
| `scalp_application_fit = unknown` | „Zur Anwendung an der Kopfhaut macht der Hersteller keine Angabe." |

**Nothing is emitted about heat or frizz.** Both are claimed on non-authoritative sources only, and „… ist ausgelobt"
requires C1/C2 authority (§18, G13). The `not_claimed` HUM state emits nothing, and the recorded hydrophobic-film
observation is a trace artifact that never reaches the user (§7.9 clause 3, G14).

## Review routing (§14)

| Trigger | Basis |
|---|---|
| `claim_authority_gap` | Heat and frizz claims exist only at C4/C5; no German-market manufacturer source exists |
| `candidate_below_tail` | Quaternium-80 (silicone quat) at rank 14 vs marker at rank 6 (§7.10, v0.3) |
| Below-marker persistence route | Same species, same ranks — PERS under-states and therefore under-warns (FS-20) |
| Early tail marker | Rank 6 of 25 — §3.1.1 limit 3, strong counter-signal on WT, SFR, PERS, R2 and `care_direction` |
| Directions below C1/C2 authority | `usage_role` empty; open gap §17.23 |
| Polyacrylamide L5 placement | Unenumerated (§17.19); HOLD `none` rests on that non-decision |

`review_status`: `draft` → routed. `out_of_category`: false.
