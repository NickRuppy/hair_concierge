# v1.6.1 test round — run log

- Kit: `plans/shampoo-v161/test/kit`, seed 20261012, prefix VT, standard = candidate (`--standard`). 23 products.
- Phase 1 complete for both lanes (4 Opus workers); reveals released 2026-10-12.

## Seal incidents

1. Stage-A `packSize` leak: VT11's packet (G05 Wahre Schätze Hafermilch, Track A freeze) carried a freeze note naming the brand, dm and two GTINs in `packSize`; both lanes saw it in phase 1 and report not using it. U4 carried a GTIN note too. Impact: identity hint only, formula and fingerprint unaffected. Fix (this branch): `blindPackSize()` reduces stage-A `packSize` to the bare size; test in `tests/shampoo-research-lane-tools.test.ts`. The running kit was not rebuilt (phase 1 already pinned).
2. Hash/validation loops with shell globs: lane-b VT01–12 worker globbed `out/formula-pass/VT*.json` (names + hashes of other workers' files, same lane, no contents); lane-a VT13–23 worker globbed only its own id range. No cross-lane access reported.

## Result and adjudication (Nick, 2026-10-12: "Sounds good. lets goo")

- Lane agreement 379/391 = 96.9% over 23 products (`compare-output.txt`); all pre-registered movements happened (P01 weight high; P31/P05 dandruff path via DS1; P29 oily target via S3 and cleansing moderate via S4; P34 cleansing moderate; S4 rows for P39/P06/P35/P36 as registered); everything registered SAME stayed same.
- P40 Moroccanoil Clarifying (VT09): lane A `high` vs lane B `moderate`. Cause: lane A counted two trace cationics (@26/@30) as a full W-RICH partner, contradicting row 137 ("nothing in v1.6.1 makes a late silicone or cationic stronger than v1.6 did"; both v1.6 lanes `moderate`). Cause code: product correction → **`moderate`** (lane B). Product is ruled a deep cleanser in the profi wave anyway.
- P40 (VT09), the other lane diffs: `conditioningLevel` high vs moderate and `focusPrimary` moisture vs general have the same cause as the weight diff (lane A read the trace cationics @26/@30 as material). Resolved with the weight ruling to lane B: **`moderate`** / **`general`**; the fits follow from `weight` moderate (lane B). Not a rule question.
- U4 Wahre Schätze Aktivkohle: registered `low`, both lanes `moderate`. Driver: guar + Nigella oil @5 (material under both readings) — not a v1.6.1 effect; the `low` baseline is a round-1 record from before the full weight method was merged (round 2). Cause code: baseline artifact; no rule action.
- A13 Hair Biology: both lanes `moderate` (`high` reachable, not reached). Conflicts with the Aug-26 approved `high` (v1.4 rerun-v3 was also `moderate`) → goes to Nick's flagged review in the Track A re-check, not a v1.6.1 question.
- Remaining diffs are research-only properties (focus/secondary/comfort/combination) → cautious value (P0), no live effect.
- Pass: yes. Proceed to lock.
