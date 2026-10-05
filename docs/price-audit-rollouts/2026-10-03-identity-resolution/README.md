# Exact identity and offer recovery

Nick authorized continuation of the pricing pass with “do it”. This pass examined all 34 remaining active rows, added evidenced recognition barcodes, and recovered exact current base offers. It did not authorize different-product replacement publication or formula/category/recommendation/lifecycle changes. One base offer remains one exact package, one whole-package EUR price, and one purchase URL; other barcodes remain recognition aliases.

## Applied and independently verified

At 14:06:34 UTC on 3 October 2026, one guarded transaction updated five products and added three recognition identifiers. Independent readback at 14:06:47 UTC verified all 371 product rows, every proposed field, preservation of existing identifiers, and all 366 untargeted rows.

| Product | Base package | Current price | Barcode action |
| --- | --- | --- | --- |
| Balea Sensitive dry-shampoo foam |150ml|€1.45|Add4066447989540; retain4067796069556|
| Balea Aqua Hyaluron conditioner |200ml|€1.25|Add4070765001662; retain4066447342055|
| Lavera Basis Sensitiv shampoo |250ml|€5.45, previously€4.95|Retain registered4021457666768|
| Jean & Len Rosemary/Ginger mask |200ml|€7.99|Add4262401735639; retain manufacturer SKU2900101127|
| MoriVeda Premium Moringaöl |100ml|€12.37, previously€16.99|Retain4251762160037|

All five links were corrected and five missing package fields filled. Two numeric prices changed; three were reconfirmed. No known package value was overwritten. The earlier 313 verified active entries remain unchanged: cumulative coverage is 318 of 347 active catalog rows, with 29 holds and 24 inactive rows outside this work.

The two Balea barcode bridges have identical complete declared INCI sequences on exact old-GTIN primary dm country pages and current German dm details, with the same article, name, and package. This supports recognition continuity; it is not proof of chemically identical batches. Jean & Len retains the exact manufacturer product number already registered in the catalog. Lavera uses its existing registered barcode, avoiding an unrelated candidate.

MoriVeda’s manufacturer shop offers the same named 100 ml product, sold by the same AMTEC brand owner, with German shipping. Its public unconditional sale is €12.37; €16.49 is the reference regular price. The direct page publishes SKU `moil-pre-100` but no GTIN. The registered barcode is retained from the earlier exact AMTEC marketplace evidence; no new barcode was inferred. See [direct-shop confirmation](moriveda-direct-confirmation.json).

## Verification and limits

[The actual dry run](dry-run-result.json) exercised five UPDATEs, three INSERTs, generated fields, and triggers, then rolled back. An independent 371-row readback confirmed no product or identifier changes. The apply repeats strict expected-before full-product and complete-identifier fingerprints, canonical GTIN ownership checks, advisory and row locks, a literal three-alias whitelist, and protected-field preservation checks. [Post-apply verification](post-apply-verification.json) passed independently.

The local Claude advisory SQL review timed out after 75 seconds without producing a verdict. It is not an approval receipt. The orchestrator inspected the SQL and verified its actual rollback/apply behavior. This is an operational data receipt with no application-code change; no push, PR, merge, deploy, server job, timer, or intake-worker operation was performed.

Primary indexed PDP excerpts and live German dm MCP evidence are distinguished in [parent comparisons](parent-primary-comparisons.json) and [current dm details](current-dm-details.json). Ordinary direct HTTP returned shell HTML for the dm country pages. Older catalog fact evidence is chiefly an internal provenance grandfather record, not a complete historic INCI ledger. Current primary source conflicts were kept unresolved rather than interpreted as proven chemical reformulation.

## Remaining decisions

All 29 held rows remain untouched: 9 identity/formula, 19 availability/exact-offer, and 1 marketplace. Of these, 26 are recommended. The three other rows are Balea 2-Phasen, alverde 4in1 Repair & Care, and alverde Hydro Mask. See [remaining holds](remaining-holds.json).

[Concrete next choices and candidate replacements](decisions-to-review.md) cover each unresolved offer. NEQI’s exact 100 ml / €8.80 supplier offer needs an availability-policy choice. NUTREEOIL’s 15 ml / €24.99 manufacturer offer needs an explicit base-package choice and exact selected-variant verification. Schaebens’ current 14 ml pack has materially different declared INCI from the old 20 ml pack, so it cannot inherit the old identity. Other distinct alternatives are proposals awaiting recommendation-profile review and user alignment; none was published or given the old product’s properties or barcodes. Absence from search is not proof of discontinuation.

The original 292-row and 21-row receipts are immutable. [SHA256 manifest](artifact-sha256.json) covers every artifact in this new directory except itself.
