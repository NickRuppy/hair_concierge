# v1.6 calibration corpus (historical, byte-pinned)

Apart from this README and `research-combination-addendum.md` (both added after review, 2026-10-10), this folder is a byte-for-byte copy of `plans/shampoo-v16/calibration/` taken at the v1.6 lock, so the lock pins do not depend on `plans/`. Every file is pinned in `../artifact-manifest.json` and checked by `tests/shampoo-research-v1-6-lock.test.ts`. Historical files are never edited or regenerated; corrections are recorded in new files.

## The Python helpers are historical snapshots

The builders and comparators here were executed from `plans/shampoo-v16/calibration/`, not from this folder. Several resolve paths relative to that location and break when run here: `build_round2_kit.py` and `build_unseen_v2_kit.py` read `../v1.6-candidate/classification-standard.md`, and `round-2/compare.py` reads `../../gold-set/gold-set-proposal.json` and resolves the repository root four levels up. The builders also write their outputs (`packets/lane/`, `blind-mapping.json`, `round-2-mapping.json`, `unseen-v2/blind-mapping.json`) next to themselves. They are kept unchanged because their bytes are part of the evidence.

| Script | Committed in | Run | Standard revision used (lock receipt) |
| --- | --- | --- | --- |
| `build_lanes.py` | `7c8f6a1a` | lane packets for round 1 | candidate at `6edd1b14` |
| `round-1/compare.py` | `80463183` | round 1, 296/304 | candidate at `6edd1b14` |
| `build_round2_kit.py`, `round-2/compare.py` | `ed9076fe` | round 2, 202/208 | candidate at `ebe435c9` |
| `build_unseen_v2_kit.py`, `unseen-v2/compare.py` | `27b5e19d` | unseen check v2, 92/96 | candidate at `0d3bbe56` |

## Replay

Replay in a scratch checkout of the recorded commit, never in this folder:

```
git worktree add --detach /tmp/shampoo-v16-replay <commit>
cd /tmp/shampoo-v16-replay/plans/shampoo-v16/calibration
python3 round-1/compare.py          # at 80463183 or later
python3 round-2/compare.py          # at ed9076fe or later
python3 unseen-v2/compare.py        # at 27b5e19d or later
python3 build_round2_kit.py /tmp/r2-kit   # rebuilds the kit; writes round-2-mapping.json in the scratch checkout
git worktree remove /tmp/shampoo-v16-replay
```

The comparators only read lane records, so their agreement lines also reproduce from a current checkout run inside `plans/shampoo-v16/calibration/`. A builder replay must read the candidate standard at the revision in the table, which only the recorded commit provides.

## Not used for new runs

These helpers shipped one lane packet with product name, brand and claims together, delivered no completeness or source-tier evidence, and do not compare `researchCombinationTargets`. New runs use the two-stage kit and comparator in the runbook (`docs/research/shampoo-inci/v1.6/runbook.md`, steps 3–5): `scripts/shampoo-research/build-lane-kit.ts` and `scripts/shampoo-research/compare-lanes.ts`.
