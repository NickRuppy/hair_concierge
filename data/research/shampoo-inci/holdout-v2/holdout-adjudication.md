# Shampoo holdout-v2 — result and adjudication

Status: **preliminary repeatability gate passed; internal research only**.

All ten new German-market shampoos have complete, structurally valid provisional records. The independent comparison agrees on **60/70 judgments (85.7%)**, versus **48/70 (68.6%)** in the first, different ten-product cohort. The unchanged bar is at least 75% overall and 60% per judged property. Cleansing meets the per-property bar exactly, not comfortably.

This is agreement, **not measured product accuracy or user-outcome validation**. The cohorts differ, so the comparison is exploratory rather than a controlled estimate of the rules' causal improvement.

## What changed in the engine

Use [the v1.4-draft amendment](../../../../docs/research/shampoo-inci/v1.4-draft/operational-amendment.md) and [operator runbook](../../../../docs/research/shampoo-inci/v1.3/new-product-research-runbook.md).

- Primary focus uses positioning only when a compatible formula route exists.
- Secondary focus is optional, normally empty, and needs a separate claim and independent mechanism.
- Regular use is the default; exceptions need explicit triggers.
- Weight uses distinct deposition-route kinds, not ingredient counts or automatic cancellation by strong cleansing.
- Every revised decision carries an inspectable trace; validators reject contradictory or incomplete traces.

## Independent agreement

| Property | Holdout-v1 | Holdout-v2 |
| --- | ---: | ---: |
| Cleansing strength | 80% | 60% |
| Conditioning | 90% | 90% |
| Weight potential | 70% | 90% |
| Primary focus | 60% | 100% |
| Secondary focus | 10% | 80% |
| Usage role | 70% | 80% |
| Scalp-comfort targeting | 100% | 100% |
| Dandruff ingredient-support rule (separate) | 100% | 100% |

The first labels have seven empty secondary focuses and nine regular-use roles. Second labels have nine empty secondary focuses and seven regular-use roles. Among the **three products where either label was non-default**, agreement is only **1/3** for secondary focus and **1/3** for usage role. Defaults improve consistency but do not resolve all exception boundaries.

No low-conditioning or low-weight product occurred in these final labels. This cohort therefore does not validate the low boundary. It also provides no alternating/reset-role coverage; explicit deep-cleansing products were excluded.

## First-label product overview

These are research previews, not approvals. Each linked analysis retains source IDs, formula architecture, confidence, counter-signals and reasoning. `blind-pass.json` in the same folder preserves the original formula-only judgment, its receipt and every post-unblind value change.

| Product | Cleansing | Conditioning | Weight | Primary | Secondary | Usage |
| --- | --- | --- | --- | --- | --- | --- |
| [Balea Professional Oil Repair Intensiv](./products/balea-professional-oil-repair-intensiv/analysis.json) | strong | high | high | repair | — | regular |
| [alverde Nutri Care](./products/alverde-nutri-care/analysis.json) | moderate | moderate | moderate | repair | — | regular |
| [ISANA Professional Plex](./products/isana-professional-plex/analysis.json) | strong | high | high | repair | — | regular |
| [Herbal Essences Fiji](./products/herbal-essences-fiji/analysis.json) | moderate | moderate | moderate | general | — | regular |
| [Garnier Fructis Kraft & Glanz](./products/garnier-fructis-kraft-glanz/analysis.json) | strong | moderate | moderate | repair | shine | regular |
| [GLISS Scalp Balance Sanft](./products/gliss-scalp-balance-sanft/analysis.json) | strong | moderate | moderate | gentle | shine | regular |
| [NIVEA Classic Care](./products/nivea-classic-care/analysis.json) | strong | high | high | gentle | shine | regular |
| [NIVEA MEN Anti Schuppen](./products/nivea-men-anti-schuppen/analysis.json) | strong | moderate | moderate | scalp_active | — | treatment |
| [GUHL Langzeit Volumen](./products/guhl-langzeit-volumen/analysis.json) | strong | moderate | moderate | volume | — | regular |
| [Jean&Len Repair Dattel & Vanille](./products/jean-len-repair-dattel-vanille/analysis.json) | strong | high | high | repair | — | regular |

Scalp-comfort targeting is `targeted` for GLISS Scalp Balance and `not_targeted` for the other nine. Dandruff ingredient support is `supported` for NIVEA MEN Anti Schuppen and GUHL Langzeit Volumen; the other eight are `not_supported`. GUHL remains volume-led rather than treatment-led because ingredient presence and intended product role are separate decisions.

## All ten disagreements, preserved without tuning

| Product | Disagreements | Interpretation and next research action |
| --- | --- | --- |
| GLISS Scalp Balance Sanft | Cleansing strong vs moderate; secondary shine vs empty | The SLES/betaine/glucoside/refatting balance needs a clearer moderate/strong anchor. Researchers also differ on whether the explicit shine claim is an independent role beside gentle/scalp care. |
| NIVEA Classic Care | Cleansing strong vs moderate; conditioning high vs moderate; weight high vs moderate; secondary shine vs empty; usage regular vs frequent | The richest boundary case. Clarify when an early oil/refatting system counts as substantive alongside cationic guar, and how a mild-positioned SLES blend is scored. The usage disagreement follows the cleansing disagreement; it is not an unrelated cadence problem. |
| GUHL Langzeit Volumen | Cleansing strong vs moderate; usage regular vs frequent | The manufacturer permits daily washing, but the v1.4 frequent trigger also requires non-strong cleansing. Resolve the cleansing boundary first. Piroctone presence and volume positioning are agreed. |
| Jean&Len Repair Dattel & Vanille | Cleansing strong vs moderate | Same SLES-blend boundary; both labelers agree on high conditioning/weight and repair positioning. Source identity remains independently weaker. |

Outcome types: systematic rule/calibration gap for cleansing and substantive lipid-route strength; researcher-process ambiguity for secondary-route independence. No product value was changed to improve agreement after second labels were revealed. The next useful calibration is these boundaries, not another indiscriminate expansion of product count.

## Sources and identity

- Seven canonical manufacturer/brand-owner formulas, one manufacturer-hosted exact-pack formula, two documented preferred-retailer fallbacks.
- Identity confidence: one high, eight moderate, one low; no unresolved material formula conflicts.
- Herbal Essences Fiji uses corroborated German retailer INCI because no crawlable German manufacturer formula was located.
- Jean&Len uses the selected German dm GTIN's complete textual INCI with lower confidence. A separately inspected retailer back-pack image shows a different barcode (4262401731594); it was **not** substituted for selected GTIN 4260702181865 or added as an alias. Exact formula-generation identity deserves stronger corroboration before catalog promotion.
- Current manufacturer evidence remains canonical for Garnier despite retained retailer differences.
- The read-only live-catalog overlap check found no selected exact-name or GTIN matches among 54 active Shampoo rows. No database writes occurred.

## Replay and process evidence

All ten records replayed against the existing **18 de-identified profiles** (180 candidate/profile evaluations), with zero systematic identity/conflict/approval-state abstentions. Legitimate preference or role abstentions remain visible in [the machine-readable report](./holdout-report.json).

Preview mode deliberately supplies in-memory approved state after validation to exercise fit logic. It does not record human approval. There is no legacy product baseline for these new namespaced products.

Ten blind passes and 18 blind-to-final value changes are retained. Frozen receipts survive unblinding; hashes prove payload consistency, not independent timestamps.

Process limitations/deviations:

- The source packets were shared between labelers; source discovery itself was not an independent experiment.
- Fresh no-context labelers did not see one another's answers, but share model lineage.
- Second labeling ran concurrently after source packets were fixed, rather than strictly after every first audit file was materialized. First judgments were produced independently and were not tuned against second labels.
- An over-scoped source worker generated an alternative batch; its extra products, labels, agreement and adjudication were discarded, and the original ten-product manifest restored from the pre-run transcript before evaluation.
- One audit assembly worker wrote a file into the root checkout by mistake. That exact new file was moved into the assigned worktree and removed from the root; no other root files were changed.
- These deviations are retained here rather than describing this run as a flawless preregistered experiment.

## Verification and boundary

- v1 and v2 validators pass; all ten v2 audits pass the semantic audit.
- 167 Shampoo tests pass, including old-report golden stability, version isolation, trace rules and malformed-input regressions.
- Typecheck and production build pass. Lint: zero errors, four pre-existing warnings. Diff whitespace check passes.
- Frozen v1.3 cohort plus generated index hash: `d4aa21113485e89833e2595b023ba1a34a27c46c3177e0e334b3ca14974edfc7`.
- Frozen holdout-v1 tree hash: `b6235a95c760f29d945df3e4600dfe811db6ed7d2c058427627523a70bed9489`.
- Report hash: `19a1359a3fb55a4f18c05c21255094342621be3de997d3d1977cb489e90bbe83`.

The engine changes and test are complete for local research. No new product approval, catalog creation, database import, production recommendation change, commit, push or deployment is implied.
