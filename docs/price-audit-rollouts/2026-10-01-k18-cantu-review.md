# K18 and Cantu pricing decisions

Decision status: Nick approved both corrections separately. K18 was applied and independently verified at 2026-10-01T08:43:50.443239Z; Cantu at 2026-10-01T08:53:41.89225Z. Current offers are EUR 56.25 / 50 ml at Flaconi and EUR 6.95 / 400 ml at dm respectively.

Checked on 2026-10-01 against the live catalog and retailer pages in the browser.

| Product | Stored offer | Verified proposed offer | Identity |
| --- | --- | --- | --- |
| Cantu Shampoo Locken Pflege | EUR 4.99; package unset; legacy dm link | EUR 6.95 / 400 ml, current dm link, deliverable | GTIN 810006945461 exactly matches the catalog identifier |
| K18 Leave-In Molecular Repair Hair Mask | EUR 75.00; package unset; broken Douglas link | EUR 56.25 / 50 ml, Flaconi variant 80074805-50, in stock | EAN 858511001128 exactly matches the catalog identifier |

## Recommendation

Apply both commercial corrections: price, price confirmation date, package size and link. Preserve product names, formulas, barcode mappings, recommendation rules, images and link-status fields. Recording a new link-status confirmation is outside this proposed correction.

Cantu's difference is +39.3%, above the unchanged automatic 30% guard. dm states its EUR 6.95 price has not increased since 2022-09-28; this supports correcting a stale catalog value, not claiming a recent retailer increase.

K18's verified price is 25% below EUR 75 UVP. The old Douglas EUR 49.99 claim appears in cached search evidence; opening that exact URL in the live browser returned Douglas's 404 page. Easycosmetic's live 50 ml offer was EUR 51.99 but unavailable, so it was not selected. Flaconi's default variant was 15 ml; selecting 50 ml changed the URL, price, stock and manufacturer EAN to the exact proposed offer. No coupon, membership or delivery charge is included in the proposed bottle price.

## Sources

- Cantu: https://www.dm.de/p/d/1675020/cantu-shampoo-cream-cleanse
- Proposed K18: https://www.flaconi.de/haare/k18/leave-in-molecular/k18-leave-in-molecular-repair-hair-mask-haarkur.html?variant=80074805-50
- Rejected stale K18 link: https://www.douglas.de/de/p/5010334127
- Rejected unavailable K18 offer: https://www.easycosmetic.de/k18/hair/k18-hair-leave-in-molecular-repair-hair-mask.aspx?variant=87730

## Execution boundary

The original two-row companion SQL is retained as a historical proposal. Exact separately approved/applied commands: [K18 Flaconi correction](2026-10-01-k18-flaconi-correction.sql) and [Cantu dm correction](2026-10-01-cantu-dm-correction.sql). Each locks its row, requires the observed baseline and exact identifier, and rolls back if any noncommercial product field changes.

Local PGlite validation passed: exact EUR 56.25 / 50 ml Flaconi offer, preservation of all unrelated product fields, idempotent replay, and refusal without changes on price, link or timestamp drift. Independent post-write production SQL verified the price, fresh stamp, package, exact variant URL and unchanged barcode mapping; purchase-link status and its earlier confirmation date remain unchanged. No schema, application runtime, server worker or pricing policy changed. This is guarded DML, not a migration-history entry.

Cantu's local PGlite validation passed for the exact EUR 6.95 / 400 ml current dm offer, preservation of unrelated fields, idempotent replay and refusal of a concurrent price change without modifications. Independent production SQL verified the resulting price, package, current dm URL, fresh stamp and unchanged GTIN 810006945461. Purchase-link status and its earlier confirmation date stayed unchanged. Commit hooks include the repository typecheck.

After the decision, continue pricing research using the approved existing budget and bring unresolved identity, package, source or large price differences back to Nick. The separate package architecture work remains planning-only. The known audit limitation around selecting a package must not be described as resolved by these two data corrections.
