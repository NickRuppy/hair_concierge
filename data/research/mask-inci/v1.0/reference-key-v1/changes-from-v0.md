# reference-key-v1 — every changed cell against reference-key-v0

Standard of record: `mask-classification-standard.v0.1.md`, now at **v0.2** (R1–R9, Nick, 2026-09-14).
Lexicon: `02_evidence_lexicon.v0.1.md`, now at **v0.2** (R8 patches).
Ruling ledger: `plans/mask-inci/round1-rule-rulings.md`.

Records were **re-derived, not patched** (§12 G7, §15). `reference-key-v0/` is frozen provenance and is
untouched. Every unchanged value was carried verbatim; evidence text was rewritten only where the rule
it cites changed, and each such field says so in `assumptionNotes`.

---

## 1. Changed cells, per product

`—` = unchanged. Echo fields (7–9) are marked `[echo]`; they are annotations under R9, not separately
reviewed, and they move only when their driver moves.

| # | Product | Field | v0 → v1 | Ruling |
|---|---|---|---|---|
| 01 | HASK Argan Oil | `conditioning_level` | high → **moderate** | **R3** (tail-edge exclusion) ⚠ *not predicted — see §2.1* |
| 01 | | `projectedOutputs.concentration` | high → medium | consequent |
| 01 | | `weight_potential` | high → high (evidence rebuilt) | R4 + R8 (lanolin now lexicon-backed) |
| 01 | | `hinweise` | — → `protein_tail_only`, `claim_formula_mismatch` | R8 |
| 01 | | `tailMarker.plausible` | — → `true` | R2 |
| 02 | Gliss 7sec | `tailMarker` | resolved → **`unresolved`, plausible: false** | **R2** |
| 02 | | `weight_potential` | low → **moderate** | **R2 + R4** (`low` unavailable on an unreadable segment) |
| 02 | | `primary_focus` | lightness → **general** | consequent (lightness needs `weight_potential: low`) |
| 02 | | `hair_thickness_fit` `[echo]` | {fine, normal} → **{fine, normal, coarse}** | R9 echo of the moved driver |
| 02 | | `texture_fit` `[echo]` | {straight, wavy} → **{straight, wavy, curly}** | R9 echo of the moved driver |
| 02 | | `projectedOutputs.weight` | light → medium | consequent |
| 02 | | `projectedOutputs.suitable_thicknesses` | {fine, normal} → {fine, normal, coarse} | consequent |
| 02 | | `bond_route`, `repair_support_level`, `care_direction` | unchanged **values**, now conservative-with-review | R2 (both readings recorded in AP-02-BONDREADINGS) |
| 02 | | `hinweise` | — → `tail_marker`, `protein_tail_only`, `claim_formula_mismatch` | R8 |
| 03 | Bali Curls SOS | `conditioning_level` | high → **moderate** | **R3** (tail-edge exclusion) ⚠ *not predicted — see §2.1* |
| 03 | | `conditioning_level` confidence | high → moderate | consequent |
| 03 | | `damage_fit` confidence `[echo]` | high → moderate | echo cannot exceed its driver (§9.5E) |
| 03 | | `projectedOutputs.concentration` | high → medium | consequent |
| 03 | | `hinweise` | — → `protein_tail_only`, `claim_formula_mismatch` | R8 |
| 04 | Gliss Liquid Silk 4-in-1 | `care_direction` | balanced → **protein** | **R6** (lipid-leg path deleted) |
| 04 | | `balanced_reading` | (implicit) → **n/a (`null`)** | R6 |
| 04 | | `projectedOutputs.balance_direction` | balanced → protein | consequent |
| 04 | | `hinweise` | — → `multi_use`, `protein_payload`, `claim_formula_mismatch` | R8 |
| 05 | Isana Mandelmilch 3in1 | `care_direction` | balanced → **protein** | **R6** |
| 05 | | `balanced_reading` | (implicit) → **n/a (`null`)** | R6 |
| 05 | | `projectedOutputs.balance_direction` | balanced → protein | consequent |
| 05 | | `hinweise` | — → `multi_use`, `protein_payload` | R8 |
| 06 | MONDAY Smooth | `conditioning_level` | high → **moderate** | **R3** (S1 mandatory; no cationic above tail) |
| 06 | | `weight_potential` | moderate → **high** (`rich`) | **R4** (cationic gate removed) |
| 06 | | `hair_thickness_fit` `[echo]` | {fine, normal, coarse} → **{normal, coarse}** | R9 echo — `fine` drops |
| 06 | | `texture_fit` `[echo]` | {straight, wavy, curly} → unchanged | R9 echo — §9.8 `high` row's second condition is absent |
| 06 | | `projectedOutputs` | concentration high→medium, weight medium→rich, thicknesses → {normal, coarse} | consequent |
| 06 | | `hinweise` | — → 2 × `claim_formula_mismatch` (silicone-free claim) | R8 |
| 07 | Pantene Molecular Bond Repair | `care_direction` | moisture → **balanced** | **R6** reading (b) ⚠ *not predicted — see §2.3* |
| 07 | | `balanced_reading` | — → **`neither_dominant`** | R6 |
| 07 | | `care_direction` confidence | high → **moderate** | R6 (§9.3 sets a `moderate` ceiling for reading (b)) |
| 07 | | `projectedOutputs.balance_direction` | moisture → balanced | consequent |
| 07 | | `hinweise` | — → `claim_formula_mismatch` | R8 |
| 08 | Sante Intense Hydration | `primary_focus` | repair → **moisture** | **R7** (tie-break on a `dual_supported` verdict) |
| 08 | | `secondary_focus` | {moisture} → **{repair}** | R7 (same two values, swapped) |
| 08 | | `balanced_reading` | — → **`both_substantive`** (recorded, value unchanged) | R6 |
| 08 | | `hinweise` | — → `protein_payload` | R8 |
| 09 | Balea Aqua Hyaluron | **no value or confidence change** | — | R5 tested and correctly does NOT fire |
| 09 | | `hinweise` | — → `multi_use` | R8 |
| 10 | Bali Curls Deep Repair | `primary_focus` | general → **general** (now rule-backed) | **R5** limb (i) cited as the disqualifier |
| 10 | | `hinweise` | — → `claim_formula_mismatch` | R8 |
| 11 | Elvital Glycolic Gloss | `tail_index` | 7 (CI 17200) → **12 (HYDROXYCITRONELLAL)** | **R8** (colourants lose marker status) |
| 11 | | `above_tail_segment` | ranks 1–6 → **ranks 1–11** | consequent |
| 11 | | `weight_potential` | moderate → **high** (`rich`) | **R8 → R4** ⚠ *not predicted — see §2.2* |
| 11 | | `primary_focus` | shine → **smoothing** | **R8 → §9.5.4 criterion 1** ⚠ *not predicted — see §2.2* |
| 11 | | `hair_thickness_fit` `[echo]` | {fine, normal, coarse} → **{normal, coarse}** | R9 echo |
| 11 | | `projectedOutputs` | weight medium→rich, benefits {shine}→{smoothing_frizz_control}, thicknesses → {normal, coarse} | consequent |
| 11 | | `focus_care_verdict.claim_role` | corroborating → **not_applicable** | consequent (no route left to corroborate) |
| 11 | | 5 × §7 direct properties | `shine_potential` higher→moderate; `weight_deposition_potential` lower→moderate; `body_lightness_potential` likely_preserving→unknown; 2 × note rewritten | consequent |
| 11 | | blind-to-final change | v0.1's single cohort change (smoothing→shine) **withdrawn** | consequent |
| 11 | | `hinweise` | — → `claim_formula_mismatch` | R8 |
| 12 | Guhl Panthenol 2in1 | `g0` | in_category **⚠ provisional** → in_category, **official** | **R1** (charter corrected) |
| 12 | | `multi_use` | true (provisional) → **true, confirmed**; uncovered mode `conditioner` | R1 |
| 12 | | `tail_index` | 12 (PHENOXYETHANOL) → **7 (TETRASODIUM GLUTAMATE DIACETATE)** | **R8** (chelator lists reconciled) |
| 12 | | `above_tail_segment` | ranks 1–11 → **ranks 1–6** | consequent |
| 12 | | `conditioning_level` | high → **moderate** | **R3 and R8**, independently |
| 12 | | `projectedOutputs.concentration` | high → medium | consequent |
| 12 | | `weight_potential` | moderate → moderate (evidence rebuilt) | R4 |
| 12 | | 3 × §7 direct-property notes | rewritten against the shortened segment; no graded value moves | R8 |
| 12 | | `hinweise` | — → `multi_use`, `claim_formula_mismatch` | R8 |
| 13 | Olaplex No.3 | **excluded, unchanged** | — | — |
| 13 | | `tailMarker.plausible` | — → `true` (recorded for completeness only) | R2 |
| 13 | | `hinweise` | — → **empty `fired` array**, emitted not omitted | R8 §13.1 rule 1 |

**All 13 records additionally gained:** `standardVersion: "mask-inci-v0.2"`, `derivedFrom`, the mandatory
`tailMarker.plausible` prong (R2), the always-emitted `hinweise` record (R8), `derivedEcho: true` +
`echoDriver` on fields 7–9 (R9), a `v0AdjudicationPointStatus` ledger closing or carrying every v0
adjudication point, and `assumptionNotes` entries naming each re-derived field with its ruling.

---

## 2. Where this run's v0.2 application DISAGREES with the ledger's expected effects

Flagged, not forced. In each case the value recorded is the one the **standard as written** produces,
because the standard is the normative document (§12 G7: records are re-derived under it, not patched).

### 2.1 R3 drops FOUR conditioning `high` calls, not two — #01 Hask and #03 Bali Curls SOS also fall

*Ledger:* "#06 MONDAY + #12 Guhl high→moderate; **five evidence-backed highs stand**."
*This run:* #01, #03, #06, #12 drop; **three** stand (#04, #05, #10).

The extra two fall on R3's **tail-edge exclusion**, not on the S1-mandatory rule the ledger line
describes:

- **#01 Hask** — `QUATERNIUM-18` @5, `PARFUM` @6. The second cationic is exactly a `tail_index − 1`
  species; removing it leaves one cationic and S1 fails. §9.1's own text says the exclusion "closes the
  reading in which a mask reached `high` on a second cationic that sat one rank above the Parfum" — a
  sentence that describes this product and no other in the cohort.
- **#03 Bali Curls SOS** — `BEHENTRIMONIUM METHOSULFATE` @9, `PARFUM` @10. Same mechanism.

Both are clean applications of a rule written in the imperative ("recompute S1, S2 and S3 with every
`tail_index − 1` species removed; a signal counts only if it still fires"). The brief for this run also
listed #01 as "unchanged values". **For Nick:** either the ledger's arithmetic or §9.1's tail-edge text
governs; they cannot both. Escalated in-record as `AP-01-TAILEDGEDROP` and `AP-03-TAILEDGE`.

Side effect worth seeing: **#03 and #10 are near-twins that now diverge on field 1** purely because
#03's second cationic is one rank above its marker and #10's is two. That is the boundary-band width
question §9.1 leaves open, in its sharpest form.

### 2.2 R8 was recorded as "no value moves". On #11 Elvital it moves three — the run's largest unpredicted effect

Removing colourants from marker eligibility pushes #11's `tail_index` from 7 to 12, which brings
`COCOS NUCIFERA OIL` @9 into the credited segment. §5's R4b enumeration names Cocos Nucifera Oil among
the heavy triglycerides, so:

1. `weight_potential` **moderate → high** — the R4 anchor acquires its required heavy-lipid core, with
   `CETEARYL ALCOHOL` @2 as the dense-base completer;
2. `primary_focus` **shine → smoothing** — §9.5.4 criterion 1 requires an optical architecture with **no
   R4b heavy lipid above the tail**, so the shine threshold fails on its **formula** leg, and §9.5.1
   forbids the gloss claim from making up the difference;
3. `hair_thickness_fit` echoes to {normal, coarse}.

This is not a surprise reading — v0.1's own record predicted it one rank off, in its counter-signals.
But the outcome is uncomfortable in both directions: a five-minute gloss treatment now carries the
category's richest weight prior on one mid-list plant oil, and a product sold entirely on gloss carries
**no shine value anywhere in its profile**. Escalated as `AP-11-COCONUT`. Two candidate levers, neither
of which this lane may pull: (a) the lexicon's family-3 heavy band does **not** name coconut oil while
the standard's §5 does — the two files should be reconciled; (b) whether §9.5.4 criterion 1 should read
the lipid's rank rather than its bare presence.

### 2.3 R6's reading (b) fires once — on #07 Pantene, and **not** on #11, the product the rule was written around

§9.3 names L'Oréal Elsève Glycolic Gloss as reading (b)'s anchor case. On its real INCI it **fails
clause 4**: `AMODIMETHICONE` @6 must rank above every candidate leg species noted under clause 3, and
`PROPYLENE GLYCOL` @5 sits one rank higher. So #11 keeps `moisture`.

Meanwhile **#07 Pantene** satisfies all four clauses — no protein at any rank, one amino silicone as the
only species beyond the bare R1 base, zero humectants and zero lipids above the tail, and clause 4
vacuously satisfied because there is no leg species to outrank. `care_direction` moves
**moisture → balanced / `neither_dominant`**, with confidence stepped from `high` to the `moderate`
ceiling §9.3 sets. The ledger predicted nothing here. Escalated as `AP-07-READINGB`, with the one open
judgment named: is a single amino silicone a "substantive R2 silicone system" under clause 2? If not,
reading (b) is reached **nowhere** in this cohort.

### 2.4 R2 withdraws the cohort's only `lightness` selection — a second-order effect of #02's unresolved marker

The ledger's R2 line expects #02's "bond/repair/focus [to] become review-routed instead of
none/low/lightness", which is what happened — but by a route worth stating: `lightness` requires
`weight_potential: low`, and R4 makes `low` a **positive leanness test** that §9.2 declares unavailable
on an unreadable segment. So `weight_potential` moves **low → moderate** (a change the ledger does not
list) and `lightness` falls with it. §18 open question 4 asked whether `lightness` is ever selected in
this category; after v0.2 the answer on this cohort is **never**, and not because any architecture
failed the test.

### 2.5 R5's secondary-slot seam on #10 — a rule question, left open rather than settled

R5 states that the lipid-led disqualifier is headline-scoped and leaves the `moisture` **secondary**
slot available. #10's cluster does independently meet criterion 1 (`GLYCERIN` @3, `BETAINE` @9,
`PANTHENOL` @11). The secondary was **not** taken, on §9.5.2's own secondary bar — criterion 3's
secondary path is written for the case where a *richer special-purpose route won the primary*, and here
none did; the primary is the step-8 `general` fallback. The alternative reading is coherent. Left as
v0's value with the reasoning recorded (`AP-10-SECONDARYSLOT`) rather than changed silently.

### 2.6 R4 did **not** make `low` reachable — #12 Guhl is refused it for the same reason as before

§18 open question 2 asks whether the thin-fatty-base test relocates v0.1's unreachability. On #12 it does
not relocate it at all: v0.1 refused `low` on the cetearyl conjunct, v0.2 refuses it on the thin-base
conjunct, which still contains a top-three rank cut, and `CETEARYL ALCOHOL` is still at rank 2. Across
the cohort `weight_potential: low` is now selected **zero** times (down from one). `AP-12-LOWSTILLUNREACHABLE`.

---

## 3. Fields whose confidence changed

| # | Field | v0 → v1 | Reason |
|---|---|---|---|
| 03 | `conditioning_level` | high → moderate | The value moved to the `moderate` bucket and realistic unknowns — principally the width of the boundary band — could move it back (§4.1). |
| 03 | `damage_fit` `[echo]` | high → moderate | An echo cannot be more confident than what it echoes (§9.5E). |
| 07 | `care_direction` | **high → moderate** | §9.3's confidence rule (R6) sets a `moderate` ceiling for `balanced` reading (b) where clauses 2–4 hold on ranks. Not stepped to `low`: the marker is resolved and plausible, and clause 4's ordering is not in doubt. |

**Held deliberately, and why** — these were re-checked and did not move:

- **#01 `weight_potential` stays `moderate`** although R8's lanolin entry closes the AP-01-LANOLIN hinge
  that caused the original cap. The single fallback-tier source is an independent material input gap
  (§4.1), so the cap survives its original reason.
- **#02: every affected field capped at `moderate`** by §3.1.1 clause 3. None was stepped to `low`,
  because no value on that record rests on the marker boundary *alone* — each has an independent ordinal
  basis. `low_confidence_field` therefore does not fire.
- **#04/#05 `care_direction` stay `moderate`** — the value moved to `protein` but D4's payload cap
  (§13 effect 2) binds it at `moderate` regardless of the value.
- **#11 stays `moderate` throughout** — the R8 marker move removes the v0.1 reviewer-judgment
  `tail_marker_anomaly` cap, but the retailer-aggregated source tier keeps the cap in place on its own.
- **#12 `care_direction` keeps `high`** — the formula contains no protein at any rank, so the route
  separation survives every marker reading, including the one R8 moved.

Cohort confidence: **17 high / 91 moderate / 0 low** across 108 profile fields (v0.1: 20 / 88 / 0).

---

## 4. Adjudication points: closed, carried, new

**Closed by a ruling (10):** AP-01-LANOLIN (R8) · AP-G0-PLACEMENT (R8) · AP-02-COUNTERSIGNAL (R3) ·
AP-04-BALANCEDBAR (R6) · AP-06-WEIGHTGATE (R4) · AP-06-NOCATIONIC (R3) · AP-08-TIEBREAK (R7) ·
AP-10-CRITERION2 (R5) · AP-11-COLOURANT (R8) · AP-12-CHARTERFLIP (R1) · AP-12-HIGHFLOOR (R3+R8) ·
AP-12-CHELATOR (R8).
**Partly closed (4):** AP-01-TAILSWING · AP-02-BONDTAIL · AP-02-VERDICTORDER · AP-07-LOWUNREACHABLE.
**Superseded (1):** AP-11-Q6ANSWERED — v0.1 answered §18 Q6 one way; v0.2 answers it the other.
**Still live, carried by reference (10):** AP-D4-BLINDSPOT · AP-02-MYRISTYL · AP-03-TWINS ·
AP-03-CURLBAR · AP-04-GLANZ · AP-05-AFTERCLEANSING · AP-05-NOGLYCERIN · AP-07-SMOOTHINGVGENERAL ·
AP-08-SPECIALISTGATE · AP-08-NATURKOSMETIK · AP-09-MODEASYMMETRY · AP-10-GLYCERINRANK · AP-11-ROOTS ·
AP-13-MALEATEVISIBLE · AP-13-OVERNIGHTMODE.

**New under v0.2 (9), all in-record:** AP-01-TAILEDGEDROP · AP-02-BONDREADINGS · AP-02-LIGHTNESSWITHDRAWN ·
AP-03-TAILEDGE · AP-04-R5TAILEDGE · AP-07-READINGB · AP-10-SECONDARYSLOT · AP-11-COCONUT ·
AP-12-LOWSTILLUNREACHABLE.

Of these, **five need Nick**: AP-01-TAILEDGEDROP + AP-03-TAILEDGE (ledger vs §9.1 tail-edge text),
AP-11-COCONUT (the R8 → R4/§9.5.4 cascade), AP-07-READINGB (is one amino silicone a substantive film
system?), and AP-04-R5TAILEDGE (does R3's tail-edge exclusion reach §9.3, or only §9.1 and §9.2?).
The last is a **scope question about R3 itself** and should be answered once for the standard rather
than per record — it is the only new point that can move a value in a second product later.

---

# Part II — the round-1b escalation rulings (E1–E4), applied 2026-09-14

Standard of record is now **`mask-classification-standard.v0.1.md` at v0.3** (E1–E4 applied on top of R1–R9).
Ruling ledger: `plans/mask-inci/round1-rule-rulings.md`, section **"Escalation rulings (round-1b)"**.

Part I above records the v0 → v1 (Standard v0.1 → v0.2) pass and is **unchanged**: it is the provenance for
what the escalations were ruled on. This part records **v1 → v1.1** (Standard v0.2 → v0.3) and touches
**four records only** — `01`, `03`, `11`, `12` — plus this file. Records `02`, `04`–`10` and `13` were
checked against E1–E4 and are **out of this pass's write scope**; where a check suggests one of them
*would* move, it is flagged in §5 rather than applied.

---

## 5.1 What each ruling did to the standard

| Ruling | Standard change | Section |
|---|---|---|
| **E1** | R3's tail-edge **exclusion** (recompute the signals with every `tail_index − 1` species removed) is **withdrawn**. A boundary-position species **counts normally** in every field; any value whose threshold **depends** on it is capped at `moderate` confidence and carries a `hinweise` note. Rationale recorded in full: relative order above the marker is Art. 19-reliable, only the invisible 1 % line is uncertain, and ~1 % of a co-conditioner is a functional dose. **Field-uniform (E5 folded in)** — which moots the open scope question `AP-04-R5TAILEDGE`, since nothing is struck anywhere | §9.1 (rule replaced), §9.1 confidence rule, §9.2 base terms + confidence rule, §13.1 (new `boundary_position_ingredient` flag), §16, §18.1 |
| **E2** | Third implausibility limb in §3.1.1: a marker whose **class ordering is internally inconsistent** with the rest of the list. Worked case: a declared fragrance allergen ranked far **above `Parfum` itself** (allergens are constituents of the compound, therefore trace). R8's colourant demotion **stands** and is explicitly not reopened — the two rules are separate and neither is a fallback for the other | §3.1.1 |
| **E3** | No rule text. Recorded as §9.3's **worked example** for `balanced` reading (b): Pantene #07 is the accepted `neither_dominant` case, and the `moisture` value it displaced was a convention, not evidence | §9.3 gloss/film paragraph |
| **E4** | The structural fatty-alcohol conjunct is **deleted** from the `low` leanness test, and the `thin fatty base` term is deleted with it. New test: **no R4b heavy lipid above the marker** AND **no occlusive silicone stack** AND **a single cationic species**. Confidence rules kept | §9.2 `low` anchor, base-terms table, counter-signals, §16, §18.2 |

**One derived standard edit, called out because it was not itemized in the rulings.** E1 says the capped value
"carries a `hinweise` note", but §13.1's flag list is a closed enum. A new flag
**`boundary_position_ingredient`** was added to it rather than overloading `tail_marker` (which fires only on
`absent`/`unresolved`). Like every other flag it moves no value; the confidence consequence is imposed by §9.1
and §9.2, and the flag reports it.

**One rule tension, recorded rather than resolved silently.** R4 put cationic count on §9.2's counter-signal
list — "neither a weight signal nor a weight counter-signal, in either direction" — and E4's new `low` test
contains a **single-cationic conjunct**. The standard now states the carve-out explicitly: cationic count stays
outside the **`high`** anchor in both directions, and functions only as one of three *leanness observations* at
the **`low`** end. It can withhold `low`; it can never produce `high`. If Nick reads that as a genuine conflict
rather than a scoped exception, the conjunct is the piece to revisit.

---

## 5.2 Changed cells, per product (v1 → v1.1)

| # | Product | Field | v1 → v1.1 | Ruling |
|---|---|---|---|---|
| 01 | HASK Argan Oil | `conditioning_level` | moderate → **high** | **E1** (strike withdrawn; S1 fires on QUATERNIUM-18 @5) |
| 01 | | `conditioning_level` confidence | moderate → moderate (**held, new reason**) | E1 — the boundary cap replaces the v0.2 value move |
| 01 | | `projectedOutputs.concentration` | medium → **high** | consequent |
| 01 | | `damage_fit` `[echo]` | {healthy, moderately_damaged} → **unchanged** | echo re-derived via §9.7 **row 3** instead of row 2; the two rows have identical outputs |
| 01 | | `hinweise` | +`boundary_position_ingredient` | E1 (+§13.1) |
| 01 | | `weight_potential` | **unchanged** (`high`/`rich`) | E4 checked: `low` fails at conjunct 1 on LANOLIN @3 |
| 03 | Bali Curls SOS | `conditioning_level` | moderate → **high** | **E1** (S1 fires on BEHENTRIMONIUM METHOSULFATE @9) |
| 03 | | `projectedOutputs.concentration` | medium → **high** | consequent |
| 03 | | `damage_fit` `[echo]` | unchanged, re-derived via §9.7 row 3 | echo |
| 03 | | `care_direction` | **unchanged** (`moisture`) | E1 field-uniform re-check: both R5 species sit 5 and 7 ranks *inside* the tail, not at its edge |
| 03 | | `hinweise` | +`boundary_position_ingredient` | E1 |
| 11 | Elvital Glycolic Gloss | `tailMarker` | plausible → **`unresolved`, `plausible: false`** | **E2** (allergen @12 vs `Parfum` @30) |
| 11 | | `weight_potential` | high → **moderate** (rich → medium) | **E2** §3.1.1 clause 2 — the coconut oil's above-tail credit is withheld |
| 11 | | `primary_focus` | smoothing → **shine** | **E2** — §9.5.4 criterion 1 is no longer defeated |
| 11 | | `hair_thickness_fit` `[echo]` | {normal, coarse} → **{fine, normal, coarse}** | echo of the reverted driver |
| 11 | | `texture_fit` `[echo]` | unchanged, now via §9.8 **row 2** directly | echo — was reached via the `high` row's second condition |
| 11 | | `focus_care_verdict.claim_role` | not_applicable → **corroborating** | consequent (there is a route to corroborate again) |
| 11 | | blind-to-final change | v0.1's single cohort change (smoothing → shine) **RESTORED** | consequent |
| 11 | | `projectedOutputs` | weight rich→medium, benefits {smoothing_frizz_control}→**{shine}**, thicknesses → {fine, normal, coarse} | consequent |
| 11 | | `hinweise` | {claim_formula_mismatch} → **+`tail_marker`** (unresolved) | E2 + §13.1 rule 2 |
| 11 | | `conditioning_level`, `care_direction`, `repair_support_level`, `damage_fit` | **unchanged values**, now capped by rule | E2 — §9.1 material counter-signal (a) now fires |
| 12 | Guhl Panthenol 2in1 | `weight_potential` | moderate → **low** (medium → **light**) | **E4** (all three conjuncts positively observed) |
| 12 | | `primary_focus` | general → **lightness** | **consequent via §9.5.2 step 3** ⚠ *not in the ruling's scope — see §5.4* |
| 12 | | `hair_thickness_fit` `[echo]` | {fine, normal, coarse} → **{fine, normal}** | echo of the moved driver |
| 12 | | `texture_fit` `[echo]` | {straight, wavy, curly} → **{straight, wavy}** | echo of the moved driver |
| 12 | | `focus_care_verdict.value` | nonspecific → **not_applicable** | consequent (the focus is no longer a repair/moisture decision) |
| 12 | | `projectedOutputs` | weight medium→**light**, thicknesses → {fine, normal} | consequent |
| 12 | | `conditioning_level` | **unchanged** (`moderate`) | E1 checked: the `tail_index − 1` species is PANTHENOL @6, which carries no signal — nothing was struck, nothing is restored. S1 still fails on the formula's single cationic, exactly as the ledger predicted |
| 12 | | `uncertainFields` | {conditioningLevel, weightPotential} → **{conditioningLevel, primaryFocus}** | `weight_potential` is now positively established rather than a residual; `primary_focus` is escalated |

**All four records additionally gained:** `standardVersion: "mask-inci-v0.3"`, an updated `derivedFrom` chain,
E-marked `assumptionNotes` naming every re-derived field with its ruling, and a v0.3 adjudication point
replacing the v0.2 one it closes.

---

## 5.3 The four flagged v0.2 escalations — all now closed

| v0.2 adjudication point | Outcome under v0.3 |
|---|---|
| `AP-01-TAILEDGEDROP` | **CLOSED by E1.** The ledger's "five evidence-backed highs stand" arithmetic governs; the strike mechanism was wrong. `conditioning_level` returns to `high` at capped confidence |
| `AP-03-TAILEDGE` | **CLOSED by E1.** Same mechanism. The twin divergence with #10 disappears — both now read `high`, and the only difference is that #03 carries the boundary cap, which is the honest statement of the two-rank difference |
| `AP-11-COCONUT` | **SUPERSEDED by `AP-11-MARKERUNRESOLVED` (E2).** The whole cascade is reverted. Its two secondary items survive and travel with the re-fetch: the lexicon-vs-§5 gap on Cocos Nucifera Oil, and whether §9.5.4 criterion 1 should read the lipid's *rank* rather than its presence |
| `AP-12-LOWSTILLUNREACHABLE` | **CLOSED by E4.** The first `weight_potential: low` in the cohort |
| `AP-04-R5TAILEDGE` | **MOOT under E1** — the scope question ("does the exclusion reach §9.3?") has no subject, because nothing is excluded anywhere. Record `04` is out of this pass's write scope and still carries the point; its **value does not change** (see §5.5) |

**Ledger arithmetic, now reconciled.** R3's expected effect was "#06 MONDAY + #12 Guhl high→moderate; five
evidence-backed highs stand." After E1 the cohort has exactly **five** `conditioning_level: high` records —
`04`, `05`, `10`, and `01` and `03` restored — and exactly the two predicted drops. The divergence §2.1 of
Part I escalated is gone.

---

## 5.4 ⚠ FLAG 1 — E4 also moves `primary_focus` on #12, which the ruling does not mention

**E4's stated expectation is "#12 Guhl 2in1 → light", which names the weight field only.** Applying the
standard as written moves a second field with it, and the mechanism is not in §9.2 at all:

- §9.5.2 **step 3** tests `lightness` **before** moisture, shine and smoothing, on **two conditions only** —
  `weight_potential: low` **plus** a likely-preserving body.
- E4 makes the first reachable. The second, `body_lightness_potential: likely_preserving`, has been on this
  record since v0.1 and is unchanged.
- A candidate clearing at step 3 stops the hierarchy, so step 8's `general` fallback is never reached.
  `primary_focus` therefore reads **`lightness`**.

The v0.2 record predicted this in its own threshold reasoning ("`lightness` does not apply, but is worth
flagging … only the weight anchor's cetearyl conjunct blocks it"). **Recorded as the standard produces it and
flagged rather than forced**, the same treatment `AP-01-TAILEDGEDROP` and `AP-11-COCONUT` received.

Three things worth weighing, all in `AP-12-LIGHTNESSUNLOCKED`: (1) the route is reached on **formula evidence
alone** — this pack carries no lightness, volume or "ohne zu beschweren" positioning, so nothing here is
claim-driven, and the blind lane reaches it too; (2) **watch-list item 2** recorded an expectation that
`lightness` would go unused in this category, but that expectation was formed while `low` was unreachable, so
E4 falsifies its *premise*, not its conclusion; (3) the focus value is a **strict function** of the weight
value — hold weight at `moderate` and the focus returns to `general`, so approving one approves the other.
Carried into the standard as new **§18 open question 13**.

---

## 5.5 ⚠ FLAG 2 — E4's new `low` test plausibly reaches THREE further records, all outside this pass's write scope

This is the larger flag. E4 deleted the conjunct that was refusing `low` to lean formulas, and that conjunct
was refusing it to more than one product. Checking the new test (no R4b above the marker **AND** no occlusive
silicone stack **AND** a single cationic species) against the cohort's recorded above-tail segments:

| # | Product | Conjunct 1 (no R4b above marker) | Conjunct 2 (no occlusive stack) | Conjunct 3 (single cationic) | Reads |
|---|---|---|---|---|---|
| **07** | Pantene Molecular Bond Repair | ✓ no lipid of **any** class above the tail | ✓ `Bis-Aminopropyl Dimethicone` @5 is a **single** silicone | ✓ `Stearamidopropyl Dimethylamine` @3 only | **`low`** (was `moderate`) |
| **08** | Sante Intense Hydration | ✓ `Helianthus Annuus Seed Oil` @17 is R4a, not R4b | ✓ no silicone (Naturkosmetik) | ✓ `Distearoylethyl Dimonium Chloride` @4 only | **`low`** (was `moderate`) |
| **09** | Balea Aqua Hyaluron | ✓ `Helianthus Annuus Hybrid Oil` @8 is mid/light, not R4b | ✓ no silicone | ✓ `Distearoylethyl Hydroxyethylmonium Methosulfate` @4 only above the tail | **`low`** (was `moderate`) |
| 02 | Gliss 7sec | — | — | — | stays `moderate`: marker `unresolved`, so §9.2 makes `low` **unavailable** |
| 04 | Gliss Liquid Silk | — | — | ✗ three distinct cationics above the tail | stays `moderate` |
| 01, 03, 05, 06, 10 | — | ✗ R4b heavy lipid above the marker | — | — | stay `high` |
| 11 | Elvital Glycolic Gloss | (would hold) | (would hold) | (would hold) | stays `moderate`: `low` **unavailable** on E2's unresolved marker |

**If those three move, `weight_potential: low` goes from 0 to 4 of 12** — and on `08` and `09` the cascade does
not stop at weight. Both carry `body_lightness_potential: likely_preserving`, so §9.5.2 step 3 would displace
their **`moisture` headline** with `lightness`, exactly as on `12`. (`07` would **not**: its body reads
`balanced`, so step 3's second condition fails and `primary_focus` stays `smoothing`.)

**Nothing was applied to those records** — they are outside the write scope of this pass, and a distribution
shift of that size should be seen before it is executed, not after. **Two things Nick needs to decide before
the next pass:** (a) whether the checks above are right and those three records should be re-derived; and
(b) whether four `low` calls out of twelve is the reachability E4 intended against the catalog's ten curated
light masks, or evidence that the test now over-selects. Per §15 and the product-truth-≠-distribution
invariant, **prevalence is a finding, never a threshold to re-tune** — this is recorded as an observation
about reach, not as an argument for tightening anything.

---

## 5.6 Fields whose confidence changed (v1 → v1.1)

| # | Field | v1 → v1.1 | Reason |
|---|---|---|---|
| 01 | `conditioning_level` | moderate → moderate (**held, new basis**) | The v0.2 cap came from the `moderate` bucket's own uncertainty; the v0.3 cap is §9.1's E1 rule — S1 is load-bearing on `QUATERNIUM-18` @5. Same level, different and now explicit reason, with `boundary_position_ingredient` emitted |
| 03 | `conditioning_level` | moderate → moderate (**held, new basis**) | As above, on `BEHENTRIMONIUM METHOSULFATE` @9. The sub-drugstore sourcing tier would hold the cap independently |
| 11 | every affected field | moderate → **moderate, now capped by rule** | §3.1.1 clause 3. **Not** stepped to `low`: clause 3's step-down applies where a value rests on the marker boundary *alone*, and each value here follows from clause 2 applied **positively** (nothing credited solely by outranking), with its competing reading recorded. `low_confidence_field` therefore does not fire |
| 12 | `weight_potential` | moderate → moderate | §9.2's confidence rule is retained unchanged by E4. The value is newly *reachable*, not newly *certain*; the single fallback-tier source caps it independently |
| 12 | `primary_focus` | moderate → moderate | Two conditions and no more, the second a graded §7 reading rather than a threshold |

**Cohort confidence is unchanged at 17 high / 91 moderate / 0 low** across 108 profile fields. No field moved
to or from `low` confidence in this pass, and `low_confidence_field` fires nowhere.

---

## 5.7 Final cohort distributions after E1–E4 (12 profiled records; #13 Olaplex excluded at G0)

| Field | Distribution |
|---|---|
| `conditioning_level` | **high 5** (01, 03, 04, 05, 10) · **moderate 7** (02, 06, 07, 08, 09, 11, 12) · low 0 |
| `weight_potential` | **high 5** (01, 03, 05, 06, 10) · **moderate 6** (02, 04, 07, 08, 09, 11) · **low 1** (12) |
| `care_direction` | **moisture 8** (01, 02, 03, 06, 09, 10, 11, 12) · **protein 2** (04, 05) · **balanced 2** (07 `neither_dominant`, 08 `both_substantive`) |
| `primary_focus` | **general 4** (01, 02, 03, 10) · **repair 2** (04, 05) · **smoothing 2** (06, 07) · **moisture 2** (08, 09) · **shine 1** (11) · **lightness 1** (12) |
| `secondary_focus` | one only: 08 `{repair}` |
| `damage_fit` `[echo]` | {healthy, moderately_damaged} 10 · {moderately_damaged, highly_damaged} 2 (04, 05) · {healthy} 0 |

Read against the standard's own expectations: `conditioning_level: low` is **never** selected (§9.7's mask
delta predicted it would be rare); `weight_potential: low` is selected **once**, for the first time (§5.5 flags
that it plausibly reaches three more); `lightness` is selected **once**, against watch-list item 2's
expectation of never; `balanced` reading (b) is reached **once**, on #07, and **not** on the gloss product the
rule was written around — which under E2 is now review-routed rather than decided. **Every one of these is a
finding to report at the calibration gate, and none is a threshold to tune** (§15).

---

## 5.8 Rerun obligation

E1 and E4 are **systemic** — they change rules every record's fields 1 and 2 read — so §15's rerun
obligation runs again from v0.2 to v0.3, and it is recorded in the standard's header. **No agreement,
repeatability or distribution statement made under v0.2 carries into v0.3.** The eight records not touched by
this pass (`02`, `04`–`10`, `13`) still carry `standardVersion: "mask-inci-v0.2"` and are, strictly, derived
under a superseded standard — they were checked against E1–E4 and only §5.5's three are expected to move, but
**the cohort is not internally consistent until they are re-derived and re-stamped.** That re-derivation, the
§5.5 decision, and the §5.4 focus question are the three things standing between this cohort and a
freeze-gate rerun.

---

# Part III — the E6 ruling and the uniform application of E4, applied 2026-09-14

Standard of record remains **`mask-classification-standard.v0.1.md` at v0.3**; E6 is folded into it without a
version bump, marked `(E6, 2026-09-14)` throughout.
Ruling ledger: `plans/mask-inci/round1-rule-rulings.md`, section **"Escalation rulings (round-1b)"**, row E6.

Parts I and II above are **unchanged** and are the provenance for what E6 was ruled on — §5.4 raised the focus
move E6 answers, and §5.5 raised the three records E6 rules must be re-derived. This part records that pass,
which touches **four records** — `07`, `08`, `09`, `12` — plus this file. Records `01`–`06`, `10`, `11` and
`13` are **not** in this pass's write scope; §5.5's checks for them are unchanged and none of them reaches
`low` (`01`, `03`, `05`, `06`, `10` fail conjunct 1 on an R4b heavy lipid above the marker; `04` fails
conjunct 3 on three above-tail cationics; `02` and `11` have unresolved markers, which makes the leanness test
unavailable rather than failed). **They do, however, still carry `standardVersion: "mask-inci-v0.2"`** — see
§6.7.

## 6.1 What E6 ruled, and what it did to the standard

| Half of the ruling | Effect |
|---|---|
| **`lightness` leaves the focus vocabulary** | §9.5's vocabulary drops from nine values to **eight** — `moisture` · `detangling` · `smoothing` · `repair` · `shine` · `curl_support` · `color_care` · `general`. §9.5.2 **step 3's fourth leg is deleted**, so step 3 tests three special-purpose routes; step 4's ordering sentence and §9.5.3 criterion 3's list drop `lightness` with it. §9.8's row-1 label is restated ("Low-weight architecture") with **no mapping change**. §7.1 gains a note that `body_lightness_potential` survives with no §9 consumer. §15's priority item 4 withdraws its `lightness` half; §16.1 gains row **7a** as a conditioner-parity delta; §18's open question 13 moves to the closed table |
| **E4's leanness test applies uniformly** | Every record satisfying the three conjuncts reads `low`, not only the one record E4's expected-effects column named. §5.5's flagged three are re-derived accordingly |

**Nick's ground, recorded as the rule's own reasoning:** masks are not bought for lightness. The forced headline
exists to name the job a product is chosen for; "light" is a deposition and dosage property, and
`weight_potential: low` already owns it and already projects it into both echo fields. A `lightness` focus
therefore said nothing new at the cost of the one field meant to say something new. **The value is removed
rather than re-thresholded** — the objection is not that step 3's two-condition test was too easy.

**Why the two halves are one ruling.** E4 applied uniformly reaches four lean masks. Three of them
(`08`, `09`, `12`) carry `body_lightness_potential: likely_preserving`, so under the pre-E6 text their headlines
would have been rewritten by a **weight** ruling, with no focus evidence moving. E6 is what stops that.

## 6.2 Per-record conjunct verification (E4's three conjuncts, checked against each record's own INCI)

| # | Conjunct 1 — no R4b heavy lipid above the marker | Conjunct 2 — no occlusive silicone stack | Conjunct 3 — single cationic species | Verdict |
|---|---|---|---|---|
| **07** Pantene Molecular Bond Repair (marker `PARFUM` @7) | **PASS**, strongest form: no lipid of **any** class, R4a or R4b, at any rank of 23 | **PASS**: `Bis-Aminopropyl Dimethicone` @5 is a single silicone; no second species and no dimethicone/dimethiconol pair | **PASS on the above-tail segment** — `Stearamidopropyl Dimethylamine` @3 only. ⚠ `Behentrimonium Methosulfate` @11 is a second cationic **tail-side** | **`low`**, confidence `moderate` |
| **08** Sante Intense Hydration (marker `Potassium Sorbate` @18) | **PASS**: `Helianthus Annuus Seed Oil` @17 is the sole lipid and is a conventional plant triglyceride — lexicon family 3 **mid** band, therefore R4a. No butter, hydrogenated fat or occlusive hydrocarbon at any rank | **PASS, absolutely**: no silicone at any rank (NATRUE Naturkosmetik) | **PASS on the full list** — `Distearoylethyl Dimonium Chloride` @4 is the only S1-family species anywhere; the tail holds only the preservative, `Parfum` and two allergens | **`low`**, confidence **`high`** |
| **09** Balea Aqua Hyaluron (marker `PARFUM` @9) | **PASS**: `Helianthus Annuus Hybrid Oil` @8 is the sole lipid, mid band, R4a. No heavy lipid at any rank of 15 | **PASS, absolutely**: no silicone at any rank | **PASS on the above-tail segment** — `Distearoylethyl Hydroxyethylmonium Methosulfate` @4 only. ⚠ `Behentrimonium Chloride` @11 **and** `Cetrimonium Chloride` @12 are tail-side: **three** cationics on the full list | **`low`**, confidence `moderate` |
| **12** Guhl Panthenol 2in1 (marker `Tetrasodium Glutamate Diacetate` @7) | **PASS** (unchanged from §5.2): `Cetyl Esters` @5 is a wax ester, `Avena Sativa Kernel Oil` @11 light/mid and tail-side | **PASS**: no silicone at any rank | **PASS on the full list** — `Behentrimonium Chloride` @3 is the only cationic anywhere | **`low`** (already applied under E4), confidence `moderate` |

**No record was forced.** Every conjunct above is a positive observation on a readable above-tail segment with a
resolved, plausible marker, which §9.2 requires before `low` is available at all. **E1 boundary check on each:**
the `tail_index − 1` species is `Glutamic Acid` @6 (`07`), `Helianthus Annuus Seed Oil` @17 (`08`),
`Helianthus Annuus Hybrid Oil` @8 (`09`) and `Panthenol` @6 (`12`) — **none load-bearing** for the weight value
under §9.2's four named terms, so no mandatory `moderate` cap and no `boundary_position_ingredient` flag fires
from that route on any of the four.

## 6.3 ⚠ FLAG — two of the four `low` calls rest on the above-tail counting scope, which §9.2 marks as unruled

`07` and `09` pass conjunct 3 **only because their further cationics sit below the marker**: two species on the
full list for `07`, three for `09`. `08` and `12` pass it on the full list and do not depend on the cut at all.

This is not a rule violation — §9.2 counts the conjunct on the above-tail segment, as it counts every term in
that section — but §9.2's own `[judgment call — review]` says in terms that after E4 the three conjuncts are
ruled and "what remains this standard's addition there is the **counting scope**", listing it **first** among the
anchors most likely to move on first contact with real formulas (§15, §18.2). Two observations sharpen it:

- On `09` the same §3.1 marker cut is doing **two** headline jobs — it is also what makes the credited segment
  humectant-led rather than cationic-led, which is why this is the D5 guard's ruled anchor product. Not double
  counting in the §6 rule 1 sense, but one reading of §3.1 moves both findings.
- E4's own reasoning says "a formula running one deposition species is structurally lean in a way a formula
  running three is not". `09` runs three — just not above the marker.

Recorded, not acted on. Both values are recorded as the standard produces them, at `moderate` confidence, which
is the honest statement that a neighbouring value is reachable on a rule reading, and both carry an adjudication
point (**`AP-07-CATIONICSCOPE`**, **`AP-09-CATIONICSCOPE`**) plus `weightPotential` in `uncertainFields`. **If
the calibration set moves the counting scope to the full list, `07` and `09` return to `moderate` and the
cohort's `low` count drops from 4 to 2.**

## 6.4 Changed cells, per product (v1.1 → v1.2)

| # | Product | Field | v1.1 → v1.2 | Ruling |
|---|---|---|---|---|
| 07 | Pantene Molecular Bond Repair | `weight_potential` | moderate → **low** (medium → **light**) | **E4 applied uniformly per E6** |
| 07 | | `hair_thickness_fit` `[echo]` | {fine, normal, coarse} → **{fine, normal}** | echo of the moved driver |
| 07 | | `texture_fit` `[echo]` | {straight, wavy, curly} → **{straight, wavy}** | echo of the moved driver |
| 07 | | `projectedOutputs` | weight medium → **light**, thicknesses → {fine, normal} | consequent |
| 07 | | `primary_focus` | **unchanged** (`smoothing`) | verified against every rule that reads weight; `body_lightness_potential` is `balanced`, so even the deleted route would have failed |
| 07 | | `uncertainFields` | **`weightPotential` retained** | counting-scope caveat (§6.3) |
| 07 | | adjudication points | +**`AP-07-CATIONICSCOPE`**; `AP-07-LOWUNREACHABLE` **CLOSED** | E4/E6 |
| 08 | Sante Intense Hydration | `weight_potential` | moderate → **low** (medium → **light**), confidence moderate → **high** | **E4 applied uniformly per E6** |
| 08 | | `hair_thickness_fit` `[echo]` | {fine, normal, coarse} → **{fine, normal}**, confidence → high | echo, confidence tracking its driver |
| 08 | | `texture_fit` `[echo]` | {straight, wavy, curly} → **{straight, wavy}**, confidence → high | echo |
| 08 | | `projectedOutputs` | weight medium → **light**, thicknesses → {fine, normal} | consequent |
| 08 | | `primary_focus` | **unchanged** (`moisture`) — **E6 is load-bearing here** | without E6 the `likely_preserving` body plus the new `low` weight would have displaced the headline |
| 08 | | `uncertainFields` | `weightPotential` **removed** | positively established, conjuncts hold on the full list |
| 08 | | `body_lightness_potential` note | stale cross-reference corrected | the weight field no longer contradicts the graded reading; **value unchanged** |
| 09 | Balea Aqua Hyaluron | `weight_potential` | moderate → **low** (medium → **light**) | **E4 applied uniformly per E6** |
| 09 | | `hair_thickness_fit` `[echo]` | {fine, normal, coarse} → **{fine, normal}** | echo |
| 09 | | `texture_fit` `[echo]` | {straight, wavy, curly} → **{straight, wavy}** | echo |
| 09 | | `projectedOutputs` | weight medium → **light**, thicknesses → {fine, normal} | consequent |
| 09 | | `primary_focus` | **unchanged** (`moisture`, `high` confidence) — **E6 is load-bearing here** | the D5 guard's own ruled anchor product would otherwise have lost its headline to a weight ruling |
| 09 | | `uncertainFields` | +**`weightPotential`** | counting-scope caveat (§6.3) |
| 09 | | adjudication points | +**`AP-09-CATIONICSCOPE`** | E4/E6 |
| 12 | Guhl Panthenol 2in1 | `primary_focus` | lightness → **general** | **E6** — §9.5.2 step 3's route deleted; step 8 reached, as under v0.1 and v0.2 |
| 12 | | `focus_care_verdict.value` | not_applicable → **nonspecific** (restored) | consequent — the focus is a repair/moisture decision again |
| 12 | | `uncertainFields` | {conditioningLevel, primaryFocus} → **{conditioningLevel}** | `primaryFocus` was listed only for the escalation E6 closes |
| 12 | | `weight_potential` | **unchanged** (`low`/`light`) | E6 confirms E4 rather than narrowing it |
| 12 | | adjudication points | `AP-12-LIGHTNESSUNLOCKED` **CLOSED**; list now empty | E6 |

**All four records additionally carry:** `standardVersion: "mask-inci-v0.3"` (new on `07`, `08`, `09`), an
updated `derivedFrom` chain, E-marked `assumptionNotes` naming every moved and every re-checked field, and — on
`12` — the superseded pre-E6 notes retained verbatim and labelled as provenance rather than rewritten.

## 6.5 Headline verification — no focus value moved except the one E6 moved

Requested explicitly and done exhaustively, because a weight move on a lean record is exactly where a headline
can drift unnoticed. The rules that could read `weight_potential`, and their state on the moved records:

| Rule | Reads weight? | Effect on 07 / 08 / 09 |
|---|---|---|
| §9.5.2 step 3 `lightness` | **Did** — `weight_potential: low` was one of its two conditions | **Deleted by E6.** No route, no effect |
| §9.5.2 step 3 `curl_support` | Reads "high slip **plus** compatible weight/body architecture" | Blocked on all three before reaching weight: single credited cationic, no polymer, no curl positioning |
| §9.5.4 criterion 1 (`shine`) | **No** — reads *lipid load* ("no R4b heavy lipid above the tail"), not the weight value | `07` still fails criteria 2 and 3; `08` and `09` still fail criterion 1 outright for want of any alignment-oriented R2/R3 route |
| §9.5.3 moisture guard | No | `08` and `09` clear on their clusters exactly as before; `07` still fails at zero cluster members |
| §9.5.2 steps 6–8 | No | architecture-only |

**Result: `07` stays `smoothing`, `08` stays `moisture` (+ `repair` secondary), `09` stays `moisture`.** On `07`
the headline is stable for two independent reasons — the route is gone, and `body_lightness_potential: balanced`
would have failed its second condition anyway. On `08` and `09` E6 is the only thing holding it.

## 6.6 Fields whose confidence changed (v1.1 → v1.2)

| # | Field | v1.1 → v1.2 | Reason |
|---|---|---|---|
| 07 | `weight_potential` | moderate → **moderate** (held, new basis) | The old cap came from the residual `moderate` bucket; the new one is the §6.3 counting-scope question. Identity and formula inputs are the cohort's best (direct retailer verbatim fetch), so the cap rests on the rule question alone |
| 08 | `weight_potential` | moderate → **high** | §4.1's bar met: brand-direct verbatim fetch of the exact SKU, a 17-entry credited segment, three conjuncts each holding on the full list, positioning corroborating rather than conflicting, and the one identified unknown (the sunflower oil's weight band) lexicon-settled. **The cohort's only `high`-confidence weight value** |
| 08 | `hair_thickness_fit`, `texture_fit` `[echo]` | moderate → **high** | §9.5E: an echo cannot exceed its driver's confidence; it is not required to fall below it |
| 09 | `weight_potential` | moderate → **moderate** (held, two new grounds) | (a) the §6.3 counting-scope question; (b) the fallback-tier INCI source (`hautschutzengel.de`, dm.de JS-blocked, identityState `verified_with_minor_source_difference`) — the same sourcing cap that independently holds `12` |
| 12 | `primary_focus` | moderate → **moderate** | Different value, same level: `general` is a step-8 fallback rather than a positively earned route, and the moisture near-miss below is one counted species away |

**Cohort confidence after this pass: 20 high / 88 moderate / 0 low** across 108 profile fields (from 17/91/0).
All three moves are on `08` — `weight_potential` plus the two echoes that track it, each counted as its own
field on the 12 × 9 basis §5.6 used. No other record's confidence moves, and `low_confidence_field` still fires
nowhere.

## 6.7 Final cohort distributions after E1–E4 + E6

| Field | Distribution |
|---|---|
| `conditioning_level` | **high 5** (01, 03, 04, 05, 10) · **moderate 7** (02, 06, 07, 08, 09, 11, 12) · low 0 — *unchanged by this pass* |
| `weight_potential` | **high 5** (01, 03, 05, 06, 10) · **moderate 3** (02, 04, 11) · **low 4** (07, 08, 09, 12) |
| `primary_focus` | **general 5** (01, 02, 03, 10, 12) · **repair 2** (04, 05) · **smoothing 2** (06, 07) · **moisture 2** (08, 09) · **shine 1** (11) · **`lightness` 0 — the value no longer exists** |
| `secondary_focus` | one only: 08 `{repair}` — *unchanged* |
| `care_direction` | **moisture 8** · **protein 2** (04, 05) · **balanced 2** (07 `neither_dominant`, 08 `both_substantive`) — *unchanged* |
| `hair_thickness_fit` `[echo]` | **{fine, normal} 4** (07, 08, 09, 12) · {fine, normal, coarse} 3 (02, 04, 11) · {normal, coarse} 5 (01, 03, 05, 06, 10) |
| `texture_fit` `[echo]` | **{straight, wavy} 4** (07, 08, 09, 12) · {straight, wavy, curly} 3 (02, 04, 11) · {wavy, curly, coily} 5 |
| `damage_fit` `[echo]` | {healthy, moderately_damaged} 10 · {moderately_damaged, highly_damaged} 2 (04, 05) — *unchanged* |

**Read against the standard's own expectations, as findings and never as thresholds to tune (§15):**
`weight_potential: low` goes from **1 to 4 of 12**, which is §5.5's projection executed rather than a new
result — and **§5.5's question (b) is still open**: is four in twelve the reachability E4 intended against the
catalog's ten curated light masks, or does the test over-select? §6.3 adds the sharper version: **two of those
four rest on an unruled counting scope**, so the defensible range is 2–4 depending on a cut the calibration set
has yet to settle. `lightness` is now **structurally** zero rather than observed-zero, so watch-list item 2 is
moot rather than confirmed. `conditioning_level: low` is still never selected.

## 6.8 Rerun obligation and what is still outstanding

E6 is **systemic** — it removes a value from field 5's vocabulary and deletes a step from the hierarchy every
record's fields 5 and 6 run — so §15's rerun obligation runs again, and the standard's header records it. **No
agreement, repeatability or distribution statement made before E6 carries past it.**

Still outstanding, and unchanged in kind by this pass:

1. **Eight records still carry `standardVersion: "mask-inci-v0.2"`** — `01`–`06`, `10`, `11`, `13`. They were
   checked against E1–E4 and again against E6, and **none of them moves**: none reaches `low` (§6.2's opening
   note), and none carried a `lightness` focus to lose. But they are strictly derived under a superseded
   standard and **the cohort is not internally consistent until they are re-derived and re-stamped.**
2. **§6.3's counting-scope question** — a calibration item, carried on `AP-07-CATIONICSCOPE` and
   `AP-09-CATIONICSCOPE`, and the one thing that could still move two of this pass's four values.
3. **`12`'s moisture near-miss, newly un-blocked.** With step 3 now clearing nothing on that record,
   §9.5.3 criterion 3 no longer blocks the moisture headline, so the two-versus-three humectant count
   (`Dipropylene Glycol` @4, `Panthenol` @6, with `Glycine` @10 not counted) is the **only** thing between it
   and `moisture`. Under v0.2 that near-miss was doubly blocked; it is now singly blocked. Recorded, not acted
   on — the count is the rule and the rule is applied as written.
