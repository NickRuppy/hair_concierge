# Shampoo classification v1.6.1

Status: **LOCKED v1.6.1 (2026-10-12, Nick's decision after the test round: "lets goo"). Active research method. Not production-active.**

| Field | Value |
| --- | --- |
| Policy ID | `shampoo-classification-v1.6.1` |
| Analysis model version | `shampoo-inci-v1.6.1` |
| Lock receipt | [`data/research/shampoo-inci/v1.6.1/v1.6.1-logic-lock-receipt.json`](../../../../data/research/shampoo-inci/v1.6.1/v1.6.1-logic-lock-receipt.json) |
| Artifact manifest | [`data/research/shampoo-inci/v1.6.1/artifact-manifest.json`](../../../../data/research/shampoo-inci/v1.6.1/artifact-manifest.json) (bytes + SHA-256 of every locked file) |
| CI pin check | `tests/shampoo-research-v1-6-1-lock.test.ts` (runs in `npm run test:node`) |
| Base | [v1.6](../v1.6/README.md), locked 2026-10-10, byte-frozen and unchanged; still guarded by `tests/shampoo-research-v1-6-lock.test.ts` |

## Files

| File | Purpose |
| --- | --- |
| [`classification-standard.md`](./classification-standard.md) | The normative locked standard: the full v1.6 text plus the v1.6.1 changes (marked "(v1.6.1)"), with stable rule IDs. Self-contained; a classifier does not need to read v1.6. |
| [`rule-changes.md`](./rule-changes.md) | Every rule change from v1.6, rows 116–137, each with its source and whether it could change a live value. Rows 1–115 stay in [`../v1.6/rule-changes.md`](../v1.6/rule-changes.md). |
| [`runbook.md`](./runbook.md) | How to research a new German shampoo under v1.6.1: the v1.6 procedure with version and path references updated. |

## Authority

- The standard in this directory is the only normative v1.6.1 text. It is byte-frozen; a rule change is a new version with its own test round and lock receipt.
- v1.6 is not edited. It stays the frozen base and the record of the v1.6 calibration.
- Locking approves the research method only. Product Intake reconciliation, catalog or Supabase writes, recommendation changes and user-facing copy each need their own approval (standard Section 16).
- The shipped Production Light adapter (`src/lib/shampoo/production-light-adapter.ts`) is still pinned to v1.4. Re-pinning it to v1.6.1 is a separate, reviewed change.
- The candidate working record (`plans/shampoo-v161/candidate/`) and the plan (`plans/shampoo-v161/plan.md`) show how the standard got here. They are not normative; the receipt pins a snapshot of the rulings (`data/research/shampoo-inci/v1.6.1/rulings-ledger.md`) and copies of the evidence and the test round.

## What changed vs v1.6

Four rulings (S1–S4):

- **S1, selenium sulfide.** `Selenium Sulfide` and `Selenium Disulfide` now count as anti-dandruff actives, next to piroctone olamine and climbazole. A product with one of them and a dandruff claim goes on the dandruff path. The EU label warning is recorded as a fact only.
- **S2, the weight line (W-LINE).** An oil, butter or other lipid makes a shampoo heavier only when it is listed early enough to be there in a meaningful amount: before the first plausible small-dose marker (fragrance or one of the classic 26 allergens, a preservative or capped active, a typical sub-1 % active, or an alphabetical tail). A lipid after that line no longer pushes the weight up. The line applies to lipids only; silicones and conditioning polymers are judged as in v1.6, because they deposit even at low dose. The line is never later than the Parfum point, and C2 and the scalp gates keep the v1.6 reading.
- **S3, oily-hair wording.** "fettiges Haar", "fettige Haare" and "fettendes Haar" count as an oily-scalp claim, like "schnell fettendes Haar". Length wording, "fettet nicht" and "Haartyp" fields do not.
- **S4, four surfactants.** Sulfolaurates are mild anionics; sulfated castor oil is not a cleansing surfactant; cocamidopropylamine oxide is a mild helper (buffer), never the main cleanser; laureth-8 sulfates stay strong. Where one of them decides the value, its confidence is capped, because the evidence is thin.

Six pre-registration fixes (D1–D6):

- **D1** A claim on the pack counts at its pack grade in any language; English "dandruff" and "oily scalp" wording is read like the German.
- **D2** Only the classic 26 fragrance allergens are line markers; the 2023 additions are not.
- **D3** The Parfum marker is itself a line marker; the two fallback codes are kept for the rare cases they describe.
- **D4** A synonym that a source splits in two is merged before positions are counted.
- **D5** `Capryloyl Glycine` is not a line marker.
- **D6** Sulfated castor oil has no weight family.

Four clarifications before any lane ran (R1–R4):

- **R1** Silicones and conditioning polymers are judged exactly as in v1.6; a late trace is never stronger evidence than before.
- **R2** An ingredient outside every surfactant class (for example `Capryloyl Glycine`) does not count as a surfactant for the line test.
- **R3** Which ingredients are lipids stays as in v1.6.
- **R4** "oily dandruff" is a dandruff claim, not an oily one.

## Test-round evidence

All under [`data/research/shampoo-inci/v1.6.1/test-round/`](../../../../data/research/shampoo-inci/v1.6.1/test-round/) (copied from `plans/shampoo-v161/test/` at lock so the pins do not depend on `plans/`). Two sealed Opus lanes, the two-stage kit (blind formula pass first, claims released only after it), frozen packets under blind ids, no web. Expected outcomes were pre-registered before any lane ran.

| Run | Products | Lane agreement | Evidence |
| --- | --- | --- | --- |
| v1.6.1 test round | 23 (the weight products of the comparison and the S1/S3/S4-affected products) | 379/391 = 96.9% | `pre-registration.md`, `compare-output.txt`, `run-log.md` |

Every pre-registered movement happened: P01 weight `high`; P31 and P05 on the dandruff path through selenium sulfide; P29 an oily target through S3 and cleansing `moderate` through S4; P34 cleansing `moderate`; the S4 rows for P39, P06, P35 and P36 as registered. Adjudication (Nick, 2026-10-12), cause-coded, no rule change:

| Product | Finding | Cause | Outcome |
| --- | --- | --- | --- |
| P40 Moroccanoil Clarifying | Lane A `high`, lane B `moderate`; lane A counted two trace cationics (@26/@30) as a full W-RICH partner, against R1 (both v1.6 lanes `moderate`) | Product correction | `moderate` (lane B). It is ruled a deep cleanser in the profi wave anyway. |
| U4 Wahre Schätze Aktivkohle | Registered `low`, both lanes `moderate` (guar + Nigella oil @5, material either way) | Baseline artifact: the `low` record is from round 1, before the full weight method was merged | No rule action |
| A13 Hair Biology | Both lanes `moderate` (`high` reachable, not reached), against the Aug-26 approved `high` (the v1.4 rerun-v3 was also `moderate`) | Not a v1.6.1 question | Goes to Nick's flagged review in the Track A re-check |

The other disagreements are research-only properties (focus, secondary focus, comfort, combination); the cautious value applies (P0), with no live effect.

Known limits are in the receipt: three seal incidents (an identity note in one stage-A pack size and a lower-case brand slug in the lane standard, both since fixed in the kit; a same-lane hash glob), and that lane agreement measures repeatability, not product accuracy.

## Open after lock

1. **v1.6.2: the closed-list batch** (E4 comfort and humectant lists, C2 humectants, CSA), after the Track A/B `unlisted_route_candidate` collection (R16.4).
2. **Production Light re-pin** to v1.6.1 (the shipped adapter is pinned to v1.4).
3. **App weight PR**: the live `weight` column and shampoo authority rule (v1.6 R2), with the two live-display questions from v1.6 (how `weight` turns into green or amber, T7; Monday Volume under X1).
4. **v1.7 idea**: outcome-calibrated weight (retailer review mining) and a shared concentration-bounds / deposition-potency module across engines (Nick, 2026-10-12; separate exploration).

Also outside this package: re-projection of the affected profi and Track A products, A13 in the Track A flagged review, and the N1 no-gap preflight before any apply.
