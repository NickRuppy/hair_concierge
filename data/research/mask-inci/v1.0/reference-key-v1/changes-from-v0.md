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
