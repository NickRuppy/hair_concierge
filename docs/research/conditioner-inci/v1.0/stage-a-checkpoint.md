# Conditioner INCI research Stage A checkpoint

Status: v1.6 research logic locked; product-level Lab review continues and fresh de-novo repeatability validation remains future work
Date: 2026-09-02
Scope: German/EU rinse-out Conditioner shadow research only

## Decision status

Nick approved and locked the reusable v1.6 logic on 2026-09-02 after reviewing NEQI, OGX, and Guhl Bond+ as the discriminating care-direction and repair-support anchors. The next checkpoint is product-by-product pilot review. Stage A still does not authorize full-cohort shadow classification, Product Intake changes, Supabase writes, catalog mapping, commit/push, PR, merge, deployment, or production activation.

## What Stage A produced

- Canonical Drive/source manifest with duplicate reconciliation and SHA-256 hashes.
- Frozen read-only Supabase cohort receipt.
- Conditioner-specific evidence register, locked v1.6 classification standard, agent context, lean quick reference, integration contract, research prompt, and runbook.
- Baseline JSON Schema for the future Stage B executable contract; the authoritative Zod v4 implementation remains deferred.
- Twelve locked exact-product/formula packets and twelve direction packets (eleven eligible rinse-out products plus the leave-in exclusion), accepted direct-property calibration, two independent complete-profile classifications, adjudicated full-profile key, complete disagreement/uncertainty ledgers, and five stress tests.
- Review-format DOCX, PDF, and formula-driven calibration workbook.

## Cohort snapshot

- Supabase project: `pqdkhefxsxkyeqelqegq`
- Capture: `2026-08-23T11:11:30.427157+00:00`
- Active Conditioner rows: 49
- Eligible rinse-out candidates: 46
- Excluded product-form rows: 3
- Eligible rows already carrying an identifier: 6
- Eligible rows still needing identifier research: 40
- Estimated Stage B execution: 46 eligible products in 6 batches of up to 8 products.

Boundary exclusions:

| Product | Reason |
|---|---|
| Cantu Leave-In Repair Cream | Leave-in only; stopped by G0. |
| Garnier Hair Food Macadamia | 3-in-1 mask/conditioner/leave-in; stopped by G0. |
| Pantene Pro-V Miracles Bond Repair Conditioner | Exact GTIN has rinse-out and leave-on directions; stopped by G0. |

Guhl Panthenol + Reparatur 2in1 remains eligible because the captured directions describe immediate rinse-out use rather than a materially different mask or leave-in mode.

## Calibrated authority

The original calibration froze 16 direct properties before any contextual user fit. Formula-only evidence remains capped at E2. In v1.5, usage frequency is retained as protocol metadata rather than a research property. In particular:

- `rinse_behavior` is `unknown` without an exact finished-product protocol;
- `cumulative_residue_risk` is `indeterminate` without repeated apply/rinse/wash/removal evidence;
- repair is separated into lubrication/protection, temporary surface film, and bond-specific support;
- fragrance records exposure signals, not diagnosis or universal safety;
- one shared mechanism cannot be counted as several independent technologies.

Reviewed direct properties now project to nine comparison fields: `conditioning_level`, `weight_potential`, `care_direction`, `repair_support_level`, `primary_focus`, `secondary_focus`, `hair_thickness_fit`, `damage_fit`, and `texture_fit`. `rinseability`, `usage_role`, and `scalp_application_fit` are not projected: rinse behavior needs finished-product testing, while the latter two collapsed to category constants or wording differences in the conventional rinse-out cohort. Exact directions remain protocol metadata. `care_direction` is a product-formula direction, not a diagnosis of user deficiency; `repair_support_level` describes comparative temporary support rather than structural repair. The fit arrays are product priors, not universal suitability claims; final user matching remains contextual.

## Clean-room calibration

- Locked packets: 12
- Eligible formulas compared: 11
- Matched G0 exclusion: 1
- Direct-property cells: 176
- Exact agreement: 157 / 176 = 89.2%
- Ordinal adjacent agreement: 122 / 122 = 100.0%
- Ordinal mean absolute difference: 0.139
- Maximum ordinal difference: one band
- Material disagreements: 0
- Systemic scientific rule change: none

The first attempted blind run is rejected and preserved with `usable_for_agreement_metrics=false` because it inherited key context. The accepted Reviewer C run inherited zero turns, read only the standard and locked blank packet inputs, and attests that no prohibited file was accessed.

The comparison triggered evidence-firewall corrections for missing directions, R3-versus-R5 separation, generic rheology signals, and endpoint-specific anti-double-counting. Metrics were recomputed after those corrections without changing Reviewer C values. Every remaining non-exact cell is classified and retained in `calibration-agreement.json`.

## Historical seven-field calibration and v1.6 extension

- Eligible profiles completed: 11 / 11
- Matched leave-in boundary exclusion: 1 / 1
- Profile cells compared: 99
- Composite pre-adjudication baseline: frozen Reviewer F on the historical seven fields plus Reviewer G on the two new fields, 94 / 99 = 94.9%
- Historical nine-field human-approved key before the v1.5 Damage Fit change: 92 / 99 = 92.9%
- Historical seven-field accepted-key comparison: 63 / 77 overall; 46 / 55 non-focus
- Remaining differences: 5 focus-label cells across 3 special-purpose products
- Five named recalibration products: primary and secondary focus exact
- Historical systemic rule change: v1.5 Damage Fit boundary; its metrics remain provenance only.
- Current v1.6 extension: independent Reviewer G completed `care_direction` and `repair_support_level` for all 11 eligible formulas with `22 / 22` exact agreement against the accepted key. The composite comparison preserves frozen Reviewer F values for the historical seven fields and adds only Reviewer G's two new fields: `94 / 99` pre-adjudication and `85 / 99 = 85.9%` post-adjudication, with `68 / 77` non-focus. This is evidence for the two new fields, not a fresh de-novo nine-property blind rerun or full v1.6 repeatability claim. The two fields still require Nick's local Lab review before whole-product approval.

Bali Curls is recalibrated from the producer formula confirmed for exact EAN `4262391991626`: high conditioning, high weight, `curl_support` primary, and `detangling` plus `smoothing` secondary. The divergent dm text is retained only as a source-history outlier; Flaconi EAN `4262391990056` is a different identity and not a same-GTIN conflict.

The remaining differences are useful rather than blocking. Reviewer F agrees on Hair Food, NEQI, John Frieda, Guhl Panthenol, and OGX focus. The five focus alternatives concern Cantu and Bali curl-support hierarchy plus one Colorglow shine slot; Nick approved the accepted rules. Two additional NEQI differences document the later conservative matching override rather than a formula-authority problem.

The review-facing uncertainty list is in `conditioner-full-profile-uncertainty-review.md`. It gives one complete answer per product and identifies only the fields worth Nick's attention.

## Stress-test result

Five adversarial cases passed:

| Case | Gate behavior |
|---|---|
| Gliss Aqua Revive | Light-hydration branding did not override deposition-rich architecture. |
| Garnier Macadamia 3in1 | Hero-oil multi-use product stopped at G0. |
| Pantene Bond Repair dual-use | Bond-branded dual-use product stopped at G0. |
| L'Oreal Anti-Haarverlust | Hair-loss claims quarantined by G6; cosmetic properties only. |
| Syoss Intense Keratin | Keratin stayed temporary film support, not structural repair. |

## Remaining uncertainty

- Formula-only higher/moderate thresholds for softness, smoothing, shine, weight, and body remain directional and product-specific; they are not measured performance.
- Rinse behavior and cumulative residue cannot be resolved from the ingredient list. Rinseability is therefore absent from the lean profile, while detailed `rinse_behavior` remains `unknown` for untested products.
- The five named focus hierarchies remain calibrated. v1.5 narrows Damage Fit: eight pilot products map to `healthy` + `moderately_damaged`; only NEQI (oat peptide), OGX (hydrolyzed collagen), and Bond+ (named bond pair) map to `moderately_damaged` + `highly_damaged`. No low-conditioning pilot profile was observed. A fresh blind rerun is required before claiming v1.5 repeatability.
- Bali Curls formula authority is resolved for the 75 ml exact-EAN product; curl-support versus smoothing remains a focus-only hierarchy judgment.
- Full-cohort directions remain necessary for exact routine protocols, but not for comparison-profile completion.
- Evidence specific to textured/coily hair, damaged substrates, use frequency, and cumulative cycles remains limited.
- The full cohort still contains 40 eligible products needing identifier research or a documented identity gap.
- Formula-source conflicts may create product-level or property-level unknowns during Stage B.
- Hair-loss/scalp-disease claims remain specialist-review territory and cannot enter cosmetic suitability logic.

## Stage B preconditions

1. Nick explicitly authorizes Stage B after reviewing the complete-profile workbook and uncertainty review.
2. Resolve a review-stable Shampoo engine source: merged on `main`, or a clean reviewed commit/receipt with an exact content fingerprint. The current dirty sibling worktree is not imported or copied.
3. Implement and verify the strict Zod v4 authority plus generated JSON Schema/document/workbook vocabulary checks.
4. Keep all 46 classifications shadow-only; no catalog, recommendation, or production write authority is granted.
5. Coordinate any future graduation through the existing catalog-authority identity/provenance program, with exact identifier collision checks and a separately approved deterministic write batch.

## Decision options

- **Approve Stage B:** authorize Tasks 6-9 for the 46-product shadow cohort under the preconditions above.
- **Revise:** request named changes to the standard, property vocabulary, thresholds, or artifact set before Stage B.
- **Narrow:** authorize a smaller named cohort or only the Stage B executable validator/replay layer.
- **Stop:** retain Stage A as the reviewable Conditioner research authority without further execution.
