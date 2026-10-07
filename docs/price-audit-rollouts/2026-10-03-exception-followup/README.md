# Approved pricing exception followup — 3 October 2026

Nick authorized the prior recommendations: “go with your recco; do it for the other steps yes.” This follows the completed [292-row apply](../2026-10-02-full-catalog-verification/APPLY-RECEIPT.md). Its evidence and SQL receipts remain unchanged.

## Reviewed scope

21 active catalog rows have fresh exact primary offers. They contain 18 numeric price changes, 19 changed links, 18 package updates (17 missing-size fills plus the explicitly approved Garnier 250 ml → 200 ml correction), and 21 fresh check stamps. Wella gets one additional recognition EAN 4068359081183; its existing 140 ml EAN 4064666580098 remains unchanged. The original 292 applied rows, 34 remaining held active rows and 24 inactive rows are excluded.

- Garnier Traube Hydraboost: Douglas, 200 ml / €2.89. Registered 3600542656412 is corroborated as 200 ml; no new barcode. The browser source receipt has an incorrect UUID; [manifest](approved-manifest.json) maps its exact PDP 5012008156 / SKU 1274094 to catalog 314d9881-4fcc-47b5-81e1-58e41779081e. No write uses the source receipt UUID.
- Wella Ultimate Repair Protective Leave-In: Hagel, 95 ml / €19.38. [Manufacturer continuity and EAN evidence](package-identity-evidence.json) explicitly bridges old 140 ml and new 95 ml as the same formula. Its price is a public unconditional sale.
- Epres: retain official €48 starter kit and numeric package NULL; no fictitious150 ml content.
- Olaplex No. 7: Hagel, 30 ml / €20.95 matches registered 850045076085, avoiding the alternate brand barcode. No formula or recognition change.
- Langhaarmädchen Beautiful Curls Conditioner: dm, 250 ml / €4.95 matches its existing registered 4070765004663. The earlier mismatching candidate is discarded.
- GLISS Sealing Miracle is a shampoo in this catalog. The first followup browser brief incorrectly called it a conditioner. Its fresh final canonical 200 ml / registered GTIN 4015100895025 offer confirms €4.99. Initial unhydrated €5.99 is excluded.

[All 21 approved offers](approved-offers.csv) list whole-package prices, exact selected sizes, links and evidence times. No coupon, subscription, bulk-unit or unit-of-measure price is used as the product price. Preferred sources were checked under [the intake source contract](../../product-intake-research-ops.md). Direct fallbacks and large changes were explicitly approved; two marketplace offers remain held.

## Additional evidence holds

[34 held rows](remaining-holds.md): 16 stock/missing-exact-offer holds, 16 identity/formula holds, 2 marketplaces. These rows receive no production changes. Store-only availability, supplier/preorder and a different package are not normal exact stock recoveries.

Innersense’s approved 29 ml / €29 Hagel offer is real, but Hagel’s ingredient list differs materially from the current manufacturer and Belladonna’s registered 118 ml list. Hagel’s own 118 ml list matches its 29 ml list, which may reflect stale retailer data or regional/version differences; neither explanation is proven. Hold the package/link/price change and new barcode until the exact supplied formula is reconciled. Nick need not guess a barcode or INCI list. Formula/property/category changes require separate intake evidence; this pricing pass does not approve them.

## Transaction verification

The [manifest](approved-manifest.json) and [payload](approved-apply-payload.json) use full before-product and complete identifier fingerprints from an independent 371-row readback. The SQL locks target products and identifiers, takes the catalog apply lock and the new GTIN ownership lock, checks the canonical unique owner constraint, preserves every old identifier, and validates only the five approved commerce columns plus the normal updated_at trigger. The known-size overwrite is allowed for the single approved Garnier transition only; the identifier insert is restricted to the single approved Wella value/owner/source.

The [actual dry-run SQL](approved-dry-run.sql) executed all 21 UPDATE paths and the 1 INSERT inside a subtransaction, then intentionally rolled them back. [SQL result](sql-dry-run-result.json) and [independent 371-row rollback verification](dry-run-rollback-verification.json) pass with zero product or identifier drift. The [actual apply](sql-apply-result.json) committed all 21 product updates and the one Wella alias at 13:27:52 UTC. The [independent post-apply readback and verification](post-apply-verification.json) at 13:28:04 UTC pass: all proposed values match; every old identifier and all unrelated product facts remain unchanged; the previous 292 applied rows, 34 held active rows and 24 inactive rows are untouched. The result is 313 of 347 active catalog rows verified with current offers, with 34 still held.

No schema, code, formula, category, recommendation, lifecycle, intake worker, queue, timer or SSH changes are included. The [bounded external Claude advisory review](advisory-review-attempt.json) timed out after 180 seconds without a verdict. No external approval is claimed. The orchestrator inspected the SQL, exercised the actual rolled-back transaction, and verified its committed result independently.

Repository verification: `git diff --check` and the required `npm run typecheck` commit hook passed. This receipt is a local commit; no push, PR, merge or deployment was performed.
