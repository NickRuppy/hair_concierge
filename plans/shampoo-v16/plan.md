# Shampoo v1.6 program — plan (phase 1)

Status: phase 1 in progress (2026-10-05). Research and docs only — no production writes, no migrations.

Governing rulings: Nick's decisions D1–D9 (2026-09-30 / 2026-10-05), recorded in the program handover. Summary:

- D1 Research projects into the existing live fields (`product_shampoo_specs` thickness / shampoo_bucket / scalp_route / cleansing_intensity) via Production Light. Matcher code unchanged.
- D2 Full calibration round before lock: ~12-product gold set, two sealed lanes, cause-coded disagreement log, Nick adjudicates, ≥90% agreement and no disagreement that errs toward recommending a product, then an unseen-product re-run.
- D3 All existing products: 50 parked-candidate + 4 never-researched legacy + 14 already-live (D8) = 68.
- D4 Every row that contradicts the live value is flagged; Nick decides each one.
- D5 Scalp-condition rows (dandruff / irritated / dry) are in scope and listed first in Nick's review.
- D6 Merge v1.4 core + v1.5 focus overlay, calibrate, lock as v1.6. Rules v1.4 explicitly rejected (route-count logic, "polymer means moderate") return only if they pass calibration.
- D7 The 38 paused new products run in parallel (Track B, scan-expansion lane); re-checked against v1.6 after lock.
- D9 No thickness × scalp cell may lose its last recommended product without Nick's ruling.

## Phase 1 (this branch)

| Unit | Owner | Writes | Output |
| --- | --- | --- | --- |
| A. v1.6 candidate standard | subagent (Opus) | `plans/shampoo-v16/v1.6-candidate/` | merged standard incl. projection-assessment rules, changelog vs v1.4, open questions |
| B. Gold set + unseen set proposal | subagent (Sonnet) | `plans/shampoo-v16/gold-set/` | ~12 gold products + unseen set, coverage table, rationale |
| C. Track B inventory | subagent (Sonnet) | `plans/shampoo-v16/track-b/` | the paused new products, admin-data readiness, batches of ≤5, duplicates vs prod |

Inputs: `plans/shampoo-v16/inputs/prod-shampoo-specs-2026-10-05.tsv` (read-only prod snapshot; cohorts C50 / X14 / L4).

Gate at end of phase 1: Nick signs off the gold set and reviews the v1.6 changelog + open questions. No calibration lanes run before that.

Note: the candidate lives under `plans/` on purpose. `npm run research:shampoo:validate-parked-v14` fingerprints all of `docs/research/shampoo-inci/`, so nothing may be added there until the lock step deliberately creates `docs/research/shampoo-inci/v1.6/` and re-pins the archive.

## Later phases (not started)

2. Calibration round(s) → adjudication → unseen re-run → lock v1.6 (receipt, manifest, CI pin test) → re-pin Production Light.
3. Track A research + projections for 68 → diff, coverage matrix, recommendation replay → Nick's flagged review.
4. Apply lane (executor migration, PGlite harness, runbook) → Codex review → ship → gated applies → verify.
5. Track B batches through the scan-expansion lane, each with its own gates.
