# Final279 local coverage diagnostic

**Scope.** Read-only comparison of `/tmp/test-audit-retirement-final279-proof/{coverage-summary,coverage-final}.json`, final268 proof, original baseline, and `/tmp/test-audit-retirement-final279-comparison.json`. No source/test edits or runners were used.

## Canonical report correction

The initial raw final279 report was contaminated by generated `app/.next` artifacts. The canonical rerun excludes `**/.next/**`; its `coverage-final.json` has **1,909** files and **0** paths containing `/.next/`. The source-set guard passed. This is the report used below. It has 26 fewer source files than the 1,935-file baseline (the comparison lists 26 removed production modules), and one fewer than final268 (1,910). This means removed source is absent from the actual post-retirement denominator; it must not be described as still covered.

## Aggregate comparison

| Metric | Baseline | Final279 actual | Actual delta pp | Conservative original-denominator delta pp |
|---|---:|---:|---:|---:|
| Lines/statements | 69.79% (311,739/446,681) | 69.80% (307,402/440,372) | +0.015 | -0.972 |
| Functions | 83.07% (21,163/25,474) | 83.23% (20,828/25,024) | +0.155 | -1.315 |
| Branches | 81.54% (69,840/85,644) | 81.55% (69,119/84,748) | +0.011 | -0.890 |

Both aggregate and conservative original-denominator two-percentage-point guards pass. Conservative accounting charges retired units at their original totals: 4,383 lines/statements, 239 functions, and 603 branches; it gives deleted modules **zero** credit for covered hits.

The comparison records **83 changed entries**, **33 raw per-file >2pp flags**, down from 37 in final268, and explicitly reports **no new flags**. The 26 baseline failures exactly equal the final 26 (`sameFailures: true`); they are the pre-existing selectProducts failures, not a final279 regression.

## Surviving-owner checks

| Owner | Final279 hit evidence | Finding |
|---|---|---|
| `src/lib/billing/display.ts` | 3/3 lines, 7/7 functions, 9/11 branches | `formatBillingDate` at :1 now executes: its only body returns German formatted date for value and `—` for nullish input. Final268 was 1/3 lines and 4/7 functions; the prior four display flags improve rather than persist. |
| `src/components/chat/product-display-model.ts` | 48/51 functions, unchanged from final268 | Three zero functions are already-zero: line-1 source-map/export `isPurchaseLinkUnavailable`, `firstLeaveInCareBenefit` :520, `capitalize` :559. No newly zero function. |
| `src/lib/product-lines/display.ts` | 16/16 functions, 108/108 lines | Fully executed; branch counter changed 42/52 -> 39/49, a denominator/mapping change rather than a new zero function. |
| `src/lib/chat/product-lookup-selection-ui.ts` | 15/15 functions | Fully executed; no new zero function. |
| `src/lib/ui/modal-layer-manager.ts` | 25/29 functions, unchanged from final268 | Four line-1/old existing focus-trap export/map entries remain zero (`focusModalElement`, `getModalTabbableElements`; concrete duplicate locations :292/:313). No new zero function. |
| `src/lib/product-intake/category-validators.ts` | 39/40 functions, unchanged from final268 | The sole zero is pre-existing line-1 `PRODUCT_INTAKE_CATEGORY_APPROVAL_VALIDATORS` map/export entry. No newly zero real validator function. |

The changed UI/Product Intake owners therefore contain no newly zero surviving function or branch attributable to the 279 retirements. The remaining source-map line-1 entries and duplicate export counters cannot establish an uncovered product behavior without a matching real body hit change.

## Limits

This compares captured V8 maps and summaries only. The 33 raw flags are prior-attribution diagnostics, not per-file approval gates; no new flag appears in final279. I did not rerun native, browser, PGlite, provider, or mutation controls, and this diagnostic does not turn passing global coverage into proof of individual behavioral contracts.
