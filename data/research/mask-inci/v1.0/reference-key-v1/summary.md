# Reference key v1 — run summary (mask-gold-set-calibration-v0.1, Standard v0.2)

Generated 2026-09-14 by the proposed-key lane, **Standard v0.2** (R1–R9) and **lexicon v0.2** applied as
written. Baseline: `reference-key-v0/` (Standard v0.1), which stays frozen as provenance.

Records are **re-derived, not patched** (§12 G7, §15): R1–R9 are systemic, so no v0.1 field approval,
fingerprint, agreement figure or distribution statement carries forward. This run carries **no
repeatability claim** — the blind lane has not been re-run against v0.2, and the freeze gate (full rerun
plus an example-disjoint unseen set) is still ahead.

Standing policy this run: §3.1's cut decides above-tail membership; §3.1.1's plausibility test decides
whether the marker is read at all; R3's tail-edge exclusion removes `tail_index − 1` species from
*carrying* §9.1 signals and §9.2 base terms (and, as written, from nothing else).

## Results

| # | Product | G0 | cond | weight | care_dir | reading | repair | primary | secondary |
|---|---|---|---|---|---|---|---|---|---|
| 01 | HASK Argan Oil sachet | in | moderate | high | moisture | — | low | general | — |
| 02 | Gliss 7sec Express-Repair | in ⚠ marker unresolved | moderate | moderate | moisture | — | low | general | — |
| 03 | Bali Curls SOS Protein | in | moderate | high | moisture | — | low | general | — |
| 04 | Gliss Liquid Silk 4-in-1 | in (mode) | high | moderate | **protein** | n/a | high | repair | — |
| 05 | Isana Mandelmilch 3in1 | in (mode) | high | high | **protein** | n/a | medium | repair | — |
| 06 | MONDAY Smooth Anti-Frizz | in | moderate | **high** | moisture | — | low | smoothing | — |
| 07 | Pantene Molecular Bond Repair | in | moderate | moderate | **balanced** | neither_dominant | low | smoothing | — |
| 08 | Sante Intense Hydration | in | moderate | moderate | balanced | both_substantive | medium | **moisture** | **repair** |
| 09 | Balea Aqua Hyaluron 3in1 | in (mode) | moderate | moderate | moisture | — | low | moisture | — |
| 10 | Bali Curls Deep Repair | in | high | high | moisture | — | low | general | — |
| 11 | Elvital Glycolic Gloss | in | moderate | **high** | moisture | — | low | **smoothing** | — |
| 12 | Guhl Panthenol 2in1 | **in (mode), official** | moderate | moderate | moisture | — | low | general | — |
| 13 | Olaplex No.3 | EXCLUDED (refuse-test passed) | — | — | — | — | — | — | — |

Echo fields (7–9), annotated on their driving rows under R9 rather than separately reviewed:

| # | thickness `[echo of weight]` | damage `[echo of cond + repair]` | texture `[echo of weight]` |
|---|---|---|---|
| 01 | normal, coarse | healthy, moderately_damaged | wavy, curly, coily |
| 02 | fine, normal, coarse | healthy, moderately_damaged | straight, wavy, curly |
| 03 | normal, coarse | healthy, moderately_damaged | wavy, curly, coily |
| 04 | fine, normal, coarse | moderately_damaged, highly_damaged | straight, wavy, curly |
| 05 | normal, coarse | moderately_damaged, highly_damaged | wavy, curly, coily |
| 06 | normal, coarse | healthy, moderately_damaged | straight, wavy, curly † |
| 07 | fine, normal, coarse | healthy, moderately_damaged | straight, wavy, curly |
| 08 | fine, normal, coarse | healthy, moderately_damaged | straight, wavy, curly |
| 09 | fine, normal, coarse | healthy, moderately_damaged | straight, wavy, curly |
| 10 | normal, coarse | healthy, moderately_damaged | wavy, curly, coily |
| 11 | normal, coarse | healthy, moderately_damaged | straight, wavy, curly † |
| 12 | fine, normal, coarse | healthy, moderately_damaged | straight, wavy, curly |

† `weight_potential: high` but the §9.8 `high` row's **second** condition (a coherent high-slip R1/R3
route) is absent from the record, so §9.8's echo caveat sends the projection back to the balanced row.
Two live instances in twelve — see §18 open question 11 below.

## Distributions (12 classified products, 108 profile fields)

| Field | v0.1 | **v0.2** |
|---|---|---|
| `conditioning_level` | high 7 / moderate 5 / low 0 | **high 3 / moderate 9 / low 0** |
| `weight_potential` | high 4 / moderate 7 / low 1 | **high 6 / moderate 6 / low 0** |
| `care_direction` | moisture 9 / balanced 3 / protein 0 | **moisture 8 / protein 2 / balanced 2** |
| `repair_support_level` | low 9 / medium 2 / high 1 | **low 9 / medium 2 / high 1** (unchanged) |
| `primary_focus` | general 4, repair 3, smoothing 2, moisture 1, shine 1, lightness 1 | **general 5, smoothing 3, repair 2, moisture 2** |
| `secondary_focus` | moisture ×1 | **repair ×1** |
| confidence | 20 high / 88 moderate / 0 low | **17 high / 91 moderate / 0 low** |

`bond_route`: `gluconamide` on #04 only (pair @8/@9 above a plausible marker @13); `none` elsewhere;
`maleate` visible on excluded #13 as boundary evidence only. #02 carries the identical gluconamide pair
at @11/@12 against an **unresolved** marker and is conservatively `none`, with both readings recorded.

`focus_care_verdict`: nonspecific 6 · repair_supported 2 · moisture_supported 1 · dual_supported 1 (#08)
· not_applicable 2. D4 overload fired on #04, #05, #08 (unchanged).

**Blind→final changes: zero.** v0.1 recorded exactly one across 108 fields (#11 smoothing → shine via
§9.5.4's claim-gated leg). Under v0.2 that leg is never reached, because criterion 1 fails on the
formula, so the blind value stands and the cohort's only unblinding change is withdrawn.

**Never selected across the cohort:** `conditioning_level: low` · `weight_potential: low` ·
`primary_focus` values `detangling`, `curl_support`, `color_care`, `lightness`, `shine`.

`hinweise` (§13.1, always emitted): 21 flags fired across 13 records — `claim_formula_mismatch` 10,
`multi_use` 4, `protein_tail_only` 3, `protein_payload` 3, `tail_marker` 1. **One record (#13) fired
nothing.**

## What moved, in one line each

Full cell-by-cell table in `changes-from-v0.md`.

- **R1** — #12 Guhl is eligible, mode-scoped, and its profile is now **official rather than provisional**;
  the charter's example was corrected, and its Conditioner-engine Spülung profile is untouched.
- **R2** — #02's marker is `unresolved` (both limbs fire); five fields capped and routed. Every other
  marker in the cohort assessed **plausible**.
- **R3** — four conditioning `high` calls drop (#01, #03, #06, #12), not the two the ledger predicted.
- **R4** — #06 and #11 reach `weight_potential: high`; #02 loses `low`; `low` is now selected nowhere.
- **R5** — #10's moisture headline is disqualified by a rule (limb (i)) instead of by judgment; #09, the
  D5 anchor, is untouched, exactly as ruled.
- **R6** — #04 and #05 move to `protein` (the field's first non-empty `protein` bucket); #07 becomes the
  cohort's only `neither_dominant`; #08 keeps `balanced` and records `both_substantive`.
- **R7** — #08's primary/secondary swap: `moisture` primary, `repair` secondary.
- **R8** — markers move on **two** records (#11 colourant, #12 chelator), which cascades into three
  further #11 values; `hinweise` emitted on all 13.
- **R9** — echo markers on fields 7–9 everywhere; seven reviewed rows per product.

## Which §18 open questions this run informs

| § | Question | What this run says |
|---|---|---|
| **1** | Does S1-mandatory-plus-one give a usable spread, or does field 1 collapse to `moderate`? | It collapses substantially: **9 of 12 `moderate`, 3 `high`, 0 `low`** (v0.1: 5/7/0). Reported as a finding about the scale, never as a target (R3). The three-step scale's `low` end remains completely untested — no product has ever reached it in either version. |
| **2** | Are the dense/thin fatty-base cuts right? Does `low` become reachable? | **`low` became *less* reachable**, 1 → 0. Both refusals are instructive: #02 loses it to the readability precondition, #12 to the thin-base test's surviving top-three rank cut. Since `CETEARYL ALCOHOL` at rank 2 is near-universal in this category (lexicon family 2: "presence carries no signal at all"), a conjunct that fails on it fails on the category baseline. Largest unruled judgment call in the document, and this run supports narrowing it. |
| **3** | Is the `care_direction: protein` two-species / rank-8 test the right bar? | Now testable: it produced **2 of 12**, both on the two-species leg. #04's rests on a species at `tail_index − 1` (AP-04-R5TAILEDGE) — the bar and R3's scope interact, and the scope question should be settled first. |
| **4** | How often is `balanced` reading (b) reachable? Does deleting the lipid shortcut move products to `protein`? | **Once in twelve — and not on the product the rule names as its anchor.** #07 Pantene reaches it; #11 Elvital fails clause 4 on a one-rank difference. The lipid-shortcut deletion moved exactly the two products the ruling predicted (#04, #05). Clause 3 is not too strict; **clause 4** is what decides, and it decided against the anchor case. |
| **6** | Do the gloss products clear the three-criterion `shine` threshold? Do they now read `balanced / neither_dominant`? | **Answered twice, both times "no", and in the opposite direction to v0.1.** #11 fails `shine` at criterion 1 (R8's marker move brings an R4b lipid above the tail) and fails reading (b) at clause 4. The cohort's one gloss product ends with no shine value anywhere. Escalated (AP-11-COCONUT); the other two gloss products named in §18 Q6 are not in this cohort. |
| **8** | How often does the marker fail, and does the low-water limb ever fire on a rinse-out mask? | `absent`: **0 of 13**. `unresolved`: **1 of 13** (#02), and **both** limbs fired on it — so the low-water/non-emulsion limb is **not** dead text inherited from a leave-on category; a solvent-continuous express Kur triggers it. The marker-absent "cap at moderate" rule was never exercised. |
| **9** | Upstream reconciliation gaps | This run adds a **fourth**: the standard's §5 names `Cocos Nucifera Oil` as an R4b heavy lipid while lexicon family 3 lists coconut oil in neither its heavy nor its mid band. Three cohort values (#11's weight, focus and thickness echo) turn on that reading. |
| **11** | Echo-field purity — should `texture_fit`'s `high` row and `damage_fit`'s legs (c)/(d) be removed? | **Two live instances in twelve** (#06, #11): `weight_potential: high` with no recorded high-slip R1/R3 route, where the second condition changes the answer. §9.8's "read, never re-judge" convention held cleanly both times and needed no new judgment — but the row is demonstrably not a pure projection. |
| **12** | `hinweise` volume — how many products fire nothing? | **One of 13**, and it is the excluded product. Every classified product fired at least one flag, and #02 and #04 fired three. The seventh reviewed row is therefore **not** the light-touch item T5 intended; `claim_formula_mismatch` alone fired 10 times. Splitting the record — or at least ordering it so value-moving flags (`protein_payload`, `tail_marker`) sit above the never-moving ones (`claim_formula_mismatch`, `protein_tail_only`, `multi_use`) — is worth considering. |

Not informed by this run: §18 **5** (`damage_fit` storage), **7** (pinning the gluconamide token — #04's
pair is nameable, so the enum behaved deterministically, but the underlying substantiation question is
untouched), **10** (§2.4.1 convergence reachability — no tier-1 or tier-2 conflict arose in this cohort).

## Four provisional defaults — behaviour under v0.2

- **`conditioning_level` moderate-fallback:** v0.1 FAILED it by inflation (`high` modal, 7/12). v0.2
  **holds**: `moderate` is modal at 9/12 and `high` is now earned only by formulas with genuine cationic
  breadth surviving the boundary band. The `low` end is still unreached and still untested.
- **`weight_potential` moderate:** **no longer absorbs both extremes at the top end** — R4 released #06
  and #11 into `high` — but it now absorbs the bottom end completely (`low` 1 → 0). The two anchors have
  swapped which one fails inward.
- **`care_direction` moisture default:** holds at 8/12, and the field finally uses its full vocabulary:
  `protein` 2 (was 0), `balanced` 2 across **both** readings.
- **`primary_focus` general:** holds cleanly at 5/12, with five of nine focus values used (down from six:
  `lightness` and `shine` both withdrawn, `moisture` gained a second).

**Priority recommendation, revised.** v0.1's recommendation was to fix the conditioning count before the
weight anchor; R3 and R4 did both. The next lever is neither: it is the **marker**. Two of the three
largest movements in this run (#11's three-field cascade, #12's conditioning drop) came from R8's
boundary patches, and two more (#01, #03) came from the width of the tail-edge band. Before the freeze
gate, settle (a) whether R3's tail-edge exclusion reaches §9.3 as well as §9.1/§9.2, (b) the band's
width, and (c) the coconut-oil lexicon/standard divergence. All three are marker-adjacent, all three
move values in this cohort, and none of them is a threshold inside a field.
