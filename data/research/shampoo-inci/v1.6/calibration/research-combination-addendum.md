# Addendum: lane agreement with `researchCombinationTargets` (review fix, 2026-10-10)

Standard Section 14 counts `researchCombinationTargets` (R12) toward raw agreement as a research judgment that is never `toward_recommending`. The historical comparators (`round-1/compare.py`, `round-2/compare.py`, `unseen-v2/compare.py`) predate the field and do not compare it. The historical reports are left unchanged; this addendum recomputes the totals with the field included where the lane records carry it.

Method: `scripts/shampoo-research/compare-lanes.ts` (the same 16 decisions per product as the historical comparators, plus `researchCombinationTargets` as a sorted list; counted when either lane's record carries the field, not counted when neither does). Pinned by `tests/shampoo-research-lane-tools.test.ts`.

| Run | Records carry the field | Recorded (historical comparator) | Recomputed with the field | Change |
| --- | --- | --- | --- | --- |
| Round 1 | no lane record (field predates R12) | 296/304 = 97.4% | 296/304 = 97.4% | none |
| Round 2 | no lane record (field predates R12) | 202/208 = 97.1% | 202/208 = 97.1% | none |
| Unseen check v2 | all 12 records (both lanes, 6 products), every value `[]` | 92/96 = 95.8% | 98/102 = 96.1% | +6 decisions, all agreeing |

The disagreements are the same as recorded in each report; no `researchCombinationTargets` disagreement exists. The D2 lock bar (at least 90% raw agreement) holds either way. Rounds 1 and 2 never exercised the field, and the unseen check exercised it only as the empty value, so the `sensitive`, `dry` and `oily` combination values have no calibrated agreement record (lock receipt, known limits).

Replay from the repository root:

```
npx tsx scripts/shampoo-research/compare-lanes.ts data/research/shampoo-inci/v1.6/calibration/round-1/lane-a data/research/shampoo-inci/v1.6/calibration/round-1/lane-b
npx tsx scripts/shampoo-research/compare-lanes.ts data/research/shampoo-inci/v1.6/calibration/round-2/lane-a data/research/shampoo-inci/v1.6/calibration/round-2/lane-b
npx tsx scripts/shampoo-research/compare-lanes.ts data/research/shampoo-inci/v1.6/calibration/unseen-v2/lane-a data/research/shampoo-inci/v1.6/calibration/unseen-v2/lane-b
```
