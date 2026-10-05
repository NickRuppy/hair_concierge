# Approved catalog corrections applied — 3 October 2026

Nick approved the 292 clear offers with: “Sounds good. Is there anything I should be reviewing first? I think you can apply otherwise.” The 55 exceptions and 24 inactive rows were excluded.

The atomic production apply completed at **2026-10-03 11:48:40 UTC**. Independent readback at **11:49:46 UTC** verified every approved field and preservation guard.

| Applied result | Catalog rows |
|---|---:|
| Approved offers applied and verified | 292 |
| Numeric prices changed | 71 |
| Existing numeric prices reconfirmed | 221 |
| Purchase links replaced | 131 |
| Missing base-package sizes filled | 193 |
| Price-check timestamps refreshed | 292 |
| Held active rows unchanged | 55 |
| Inactive rows unchanged | 24 |
| Complete identifier sets unchanged | 371 |
| Unrelated product properties unchanged | 371 |

The existing `updated_at` trigger ran as expected. Purchase-link statuses/check timestamps, names, categories, INCI/product properties, recommendations, activation/lifecycle and all recognition identifiers were preserved. No schema, deployment, worker, SSH or timer changes were made.

## Verification and evidence

- [Applied offers and final values](approved-applied-offers.csv).
- [Full independent verification](approved-post-apply-verification.json) and [post-apply database readback](approved-post-apply-readback.json).
- [Fresh pre-apply source checks for all 292 offers](approved-pre-apply-source-refresh.json). dm exact DAN/GTIN queries, hydrated Rossmann pages, direct specialist PDPs and targeted browser recoveries all resolved to the approved final price/package/stock tuple.
- [Before-state and complete identifiers](pre-apply-approved-readback.json).
- [Actual SQL rollback test result](approved-sql-dry-run-result.json): all 292 UPDATE paths and triggers exercised, then rolled back. [Independent rollback verification](approved-dry-run-rollback-verification.json) confirmed all 371 product and identifier fingerprints unchanged.
- [Guarded executed apply SQL](approved-catalog-corrections-apply.sql), [rollback-test SQL](approved-catalog-corrections-dry-run.sql) and [exact applied payload](approved-apply-payload.json).
- [Remaining 55 decisions and recommendations](decisions.md).

The source refresh uses captured per-item timestamps when available. For 46 Rossmann pages it conservatively uses the start of the recorded verification window, rather than inventing individual exact observation times. K18 has minute precision. Four truncated dm titles retained the independently verified same-DAN/GTIN package from the earlier 3 October check; current price and stock were rechecked against that exact identifier.

Two initial Rossmann hydration readings briefly showed lower prices; direct corroboration returned the approved €12.99 NEQI 330 ml and €3.99 Syoss Curls 440 ml offers without a coupon or reference-price condition. The final readings were used. API failures on dm-med and HTTP access failures on K18/Moroccanoil were resolved on hydrated primary pages, never treated as product absence.

The SQL locked the target products and existing identifiers, guarded the complete before-state, validated every row before updating, and verified every allowed field plus preservation inside the transaction. Final independent verification found zero discrepancies. No automatic GPT link writer or probe gate was bypassed: these were Nick-approved explicit catalog corrections.

The requested read-only Claude advisory SQL review timed out after 180 seconds without a verdict. No counterpart approval is claimed. The actual rollback test, independent restoration check, atomic apply checks and final readback all passed. The empty transient reviewer output was discarded; the timeout is recorded in the verification JSON.

The original README, ready manifest, review CSV and validation receipt remain immutable pre-approval research evidence from commit `254f93ce`. Their “pending/no writes” wording describes that earlier state; this apply receipt is the current operational outcome.

## Remaining alignment

The 18 price/retailer exceptions and 37 held rows were not applied. The four package decisions are Wella 140 ml versus the 95 ml candidate, Garnier Traube Hydraboost 250 ml versus 200 ml, Innersense 118 ml versus 29 ml, and Epres starter-kit content/display. Wella also needs exact product/formula continuity verified before promotion. Existing barcodes remain intact in every case.

The 17 identifier/formula holds require evidence of product continuity, not a guess from a matching name. The 13 unavailable results describe the checked sources; they do not prove global discontinuation. The two missing-price rows and one supplier-stock/preorder exception remain held.
