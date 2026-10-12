# v1.6.1 test round — run log

- Kit: `plans/shampoo-v161/test/kit`, seed 20261012, prefix VT, standard = candidate (`--standard`). 23 products.
- Phase 1 complete for both lanes (4 Opus workers); reveals released 2026-10-12.

## Seal incidents

1. Stage-A `packSize` leak: VT11's packet (G05 Wahre Schätze Hafermilch, Track A freeze) carried a freeze note naming the brand, dm and two GTINs in `packSize`; both lanes saw it in phase 1 and report not using it. U4 carried a GTIN note too. Impact: identity hint only, formula and fingerprint unaffected. Fix (this branch): `blindPackSize()` reduces stage-A `packSize` to the bare size; test in `tests/shampoo-research-lane-tools.test.ts`. The running kit was not rebuilt (phase 1 already pinned).
2. Hash/validation loops with shell globs: lane-b VT01–12 worker globbed `out/formula-pass/VT*.json` (names + hashes of other workers' files, same lane, no contents); lane-a VT13–23 worker globbed only its own id range. No cross-lane access reported.
