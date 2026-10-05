# Preferred purchasable offers: NEQI and Cacay

Nick clarified the two pending choices: prioritize preferred shops, then accept the exact product's available package size and whole-package price, provided the product is purchasable. This settles the earlier supplier/size questions within the authorized catalog pricing pass. Different formulas remain separate product decisions.

The source order remains the [canonical intake contract](../../product-intake-research-ops.md): masks use dm > Rossmann > Müller > brand-direct > Amazon DE; oils use brand-direct > Amazon DE > dm > Rossmann. Package size or lower price does not outrank an available preferred source.

## Applied offers

| Product | Preferred source | Selected package | Current price | Previous catalog price |
| --- | --- | --- | --- | --- |
| NEQI Treatment Treasure Build Boost | [NEQI brand shop](https://neqi-hair.com/products/treatment-treasure-build-boost?variant=49565683122522) | 100 ml | €9.95 | €9.99 |
| NUTREEOIL Cacay Öl | [NUTREEOIL brand shop](https://www.nutreeoil.com/products/nutreeoil-cacay-ol-30ml?variant=39805169467440) | 15 ml | €24.99 | €34.99 |

Both selected manufacturer variants are available for a normal one-time purchase and publish the existing registered GTIN. Exact variant URLs keep the offered package unambiguous. Both missing purchase-size fields were filled; both links and price stamps were updated. No identifier, category, formula, recommendation, lifecycle, or known-size field was changed.

NEQI's shop has a €19.90 minimum basket. The €9.95 price is the single 100 ml package price, not a bundle-unit price or coupon price. Its direct offer outranks the Mapeja €8.80 supplier/PreOrder fallback. Fresh official dm MCP at 14:26 UTC did not return GTIN4063528086303 or article2972777, despite a stale indexed PDP saying “Lieferbar”. Rossmann's public response was a client challenge; Müller exact-code search returned no match. These limits are not proof of discontinuation or a claim that no physical store has stock. See [preferred-host evidence](neqi-preferred-host-checks.json) and [current dm check](neqi-current-dm-check.json).

Cacay's URL handle says `30ml`, but the explicitly selected variant39805169467440 is 15 ml / SKU002 / GTIN4260541540014 / €24.99 / available. The 30 ml variant is unavailable and has no published barcode. The previous 30 ml assumption came from a product-level page, not a proven variant-specific GTIN mapping; the database size was NULL. The current manufacturer assigns the existing catalog barcode to 15 ml, so no new recognition alias is needed. The shared manufacturer description identifies pure cold-pressed Cacay oil. See [fresh parent variant evidence](parent-current-brand-variants.json) and [source resolution](cacay-preferred-host-checks.json).

## Verification and remaining scope

The unchanged, previously exercised commerce-only SQL skeleton checks full expected-before product and complete identifier fingerprints, takes catalog/product/identifier locks, allows only current price/stamp/link and missing-size fills, and verifies all protected fields.

The actual dry run exercised both UPDATEs and triggers, rolled back, and passed an independent readback of all 371 products and identifiers. The apply committed at 14:30:29 UTC on 3 October 2026. [Independent post-apply verification](post-apply-verification.json) passed for both target rows, every identifier, all 371 protected product fingerprints, and all 369 untargeted rows.

Cumulative coverage is now **320 of 347 active rows**. The [27 remaining holds](remaining-holds.json) comprise 9 identity/formula, 17 availability/exact-offer, and 1 marketplace. Earlier receipts remain immutable. No intake-worker, queue, server, timer, schema, push, merge, or deployment operation was performed.

[Artifact SHA256 manifest](artifact-sha256.json) covers all other files in this directory. The commit hook performs repository typecheck.
