# v1.6.2 test round — run log

- Kit: `plans/shampoo-v162/test/kit`, seed 20261013, prefix VS, standard = candidate (`--standard plans/shampoo-v162/candidate/classification-standard.md`). 9 Track A products. Two sealed Opus lanes, two-stage kit.
- Kit rebuilt once before any lane ran: the first build's stage-A `normalization` carried a freeze-worker note naming a retailer ("dm"); fixed in the builder (`STAGE_A_NORMALIZATION`, red-first test) and rebuilt. The leaky first build was never shown to a lane.
- Phase 1 complete for both lanes (formula pass pinned, commit c3adc93d); reveals released 2026-10-12; phase 2 complete.

## Result

- Lane agreement 150/153 = 98.0% over 9 products (`compare-output.txt`). Diffs: VS07 focusPrimary (repair vs general, research-only), VS08 conditioningLevel (moderate vs high) and VS08 fit.coarse (acceptable vs ideal, follows from conditioning).
- Pre-registration (`preregistration-check.txt`, script `check-preregistration.py`):
  - **G03 Sebamed Every-Day moved exactly as registered in both lanes**: `scalpComfortTarget` targeted via MB only (Decyl Glucoside@2, Disodium Laureth Sulfosuccinate@3, Sodium Lauryl Sulfoacetate@4), primary target `sensitive`, rows fine/normal/coarse × `irritationen` × `gentle`, `review_specialist_gate_failed` gone, focus `scalp_active`.
  - **A40** records `Laureth-9`@3 as the listed Polidocanol in both lanes; no value change.
  - **Controls held**: A43, A24, A21 stay ordinary with `review_specialist_gate_failed` (MB excluded by Sodium Coco-Sulfate@2 / SLES@2); A05, A03 pass via listed routes; G01, A06 keep the dandruff path and the `sensitive` combination.
  - **Two departures from the v1.6 baseline, neither touching a v1.6.2 rule (MB, E4, CSA, S-SENSITIVE):**
    1. A21 ISANA MED Totes Meer (VS08): `weightPotential` low → moderate in both lanes (v1.6 lanes: low, neighbor moderate; v1.6.2 lanes: moderate, neighbor high), so fine fit ideal → acceptable. Same evidence set (guar@5 + Lauryl Lactate@4 under an SLES/CAPB reset); lane B additionally reads Lauryl Lactate as `payload_lipid` (conditioning high). A genuine low/moderate weight boundary. Not recommended live.
    2. A43 Sante Sensitive Care (VS07): `conditioningLevel` low → moderate in both lanes (protein cluster + PCA Ethyl Cocoyl Arginate read as a cationic conditioner); weight, fits and every projected value unchanged. Lane A focus `repair` (research-only).

## Adjudication (pending Nick)

Proposed cause codes: A21 = boundary variance, not a v1.6.2 question → resolved in the Track A re-check (all 73 products re-run on locked v1.6.2), cautious `moderate` per the R14 precedent if it stays split; A43 = research-only variance, no live effect, no action.
