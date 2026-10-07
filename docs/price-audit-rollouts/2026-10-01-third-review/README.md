# Third pricing batch — 2026-10-01

Current closure: [finalized subset, 2026-10-02](../2026-10-02-third-batch-finalization.md).
Nick finalized 46 completed products: 14 stored numeric price changes and 32
unchanged-price confirmations, all verified live. Five original holds are
resolved; Fino and 53 unsuccessful research results remain in the review queue.
The counts and hold states below describe earlier steps in this audit trail.

Nick approved the Cantu EUR 6.95 / 400 ml correction and continuing the next research batch. Cantu was separately applied and committed in f9697910; this receipt covers the subsequent research only.

The server dry run completed at 2026-10-01T09:20:42.572Z, exit 0: 347 candidates, 100 GPT research calls, 54 automatic proposals, 293 review proposals, no failed-recheck decisions, no writes. Research used gpt-6-luna with low effort. The 100 calls included repeat attempts on unresolved products; they are not 100 new confirmations. Answers: 47 price claims without an explicit unavailable flag, 41 unavailable claims, 12 not-found results.

## Reviewed subset

39 stale recommended products accepted for price and confirmation-stamp updates; 10 numeric changes (8 decreases, 2 increases), 29 prices reconfirmed unchanged. Price deltas remain within 30%; ordinary unconditional retail discounts are used as Nick requested. Existing product links, package fields, status dates, formulas, barcode aliases and recommendation settings stay unchanged.

| Changed product | Previous EUR | Reviewed EUR | Observed whole package |
| --- | ---: | ---: | --- |
| Maria Nila Coils & Curls Oil in Cream | 31.00 | 22.50 | 100 ml |
| NEQI Deep Cleansing Shampoo | 12.99 | 11.95 | 330 ml |
| NEQI Leave-In Moisturizing Mist | 12.99 | 11.95 | 180 ml |
| NEQI Moisture Mystery Conditioner | 9.95 | 8.99 | 250 ml |
| OGX Rosemary Mint Shampoo | 6.99 | 7.99 | 385 ml |
| Monday Moisture Conditioner | 5.95 | 5.75 | 354 ml |
| Pantene Hydra Glow Shampoo | 3.49 | 3.95 | 250 ml |
| Balea Med Anti-Schuppen | 2.65 | 2.45 | 250 ml |
| ISANA Professional Arganöl & Pflege Spülung | 1.39 | 1.29 | 200 ml |
| Syoss Intense Keratin Conditioner | 3.99 | 3.95 | 250 ml |

All ten numeric changes were independently checked on their retailer product pages. Where Rossmann does not expose a separate GTIN field, identity is supported by the unchanged stored product URL, its matching barcode suffix, brand/name and package. This is weaker than an explicitly displayed manufacturer EAN; `source-checks.json` preserves the distinction. Remaining unchanged-price confirmations rely on reviewed GPT evidence, with selected independent checks; this is not a claim that every research answer was independently verified.

Maria Nila's research answer used the manufacturer's EUR 31 and excluded Flaconi's ordinary discount. A live browser check instead confirmed EUR 22.50 / 100 ml, in stock, exact EAN 7391681403741. `independent-checks.json` records this reviewed override. Prices describe the retailer offers checked today, not a claim about when retailers changed their prices.

## Held back

- Curlsmith Multitasking Conditioner: proposed EUR 21.99 for 237 ml, whereas registered barcodes identify 59 ml and 946 ml. No price or freshness write.
- Garnier Wahre Schätze Kokosmilch & Macadamia Spülung: current source page barcode 3600542462327 differs from the sole registered 3600542462839. No write.
- head & shoulders Derma x Pro leave-in scalp serum: source GTIN 8006530455787 differs from the sole registered8700216495981. The counterpart reviewer identified this inconsistent acceptance; the main agent verified the note and removed the row before any write.
- OGX Argan weightless oil: alternate Hagel source confirms EUR 8.95 / 118 ml but an exact source GTIN was not independently visible and the stored dm page's buyability is unknown. No write.
- K18 professional mist: proposed EUR 62.95 / 150 ml differs from stored 300 ml; source EAN unconfirmed. This is a different product from the already corrected K18 mask. No write.
- Shiseido Fino oil: EUR 9.99 / 70 ml claim did not pass the existing source-URL gate. No write.
- Nine already-fresh Müller prices and two unchanged status-only proposals were skipped. No link-status changes are authorized by GPT evidence.

The source checks do not resolve the separate multiple-package architecture. Registered aliases remain product-level aliases; the audit still does not carry stored package size into its GPT prompt. These known limits require the separate architecture work, not silent identifier or runtime changes during this pricing pass.

## Verification and execution

The exact apply command is `apply-reviewed-prices.sql`: atomic guarded DML, not a schema migration. It locks each product, compares the observed price/stamp/link/package/status/recommendation baseline and full GTIN set, enforces the unchanged 30% guard, updates only price and stamp, and aborts the whole batch if a trigger changes any unrelated field. Replay requires the exact receipt timestamp and price.

Local PGlite checks passed for all 39 prices, unrelated-field preservation, replay and atomic refusal on concurrent price, link, timestamp, package or GTIN changes, an out-of-range price, and an unexpected formula-mutating trigger. Repository commit hooks run the typecheck. The read-only counterpart review found no SQL correctness defect and identified the head & shoulders mismatch above. That finding was verified and fixed by removing the row. Suggested identity-guard test gaps were also closed with refusal tests for name, brand, active/lifecycle state, status/date, recommendation flag, package unit and GTIN removal. The main agent reviewed the final39-row partition and reran the full focused PGlite checks; no second counterpart pass is claimed. Transient reviewer output is archived outside the repository with the operator exports.

Before any third-batch writes, live SQL confirmed 132/347 active products fresh and 131/238 recommended products fresh. The intake worker remained active with baseline PID 151026 after the dry run. The weekly price-audit timer remained active, next tick 2026-10-05T02:33:34Z. No worker, model configuration, probe approval or timer unit was changed for this batch.

Raw dry-run CSVs remain proposals (`applied=false`); `reviewed-proposals.json` records the selected subset and exclusions. Production execution must be assessed from the verification receipt, not those raw CSVs.

Production apply completed successfully using the final 39-row DML. Independent SQL verified 39/39 prices with receipt stamp 2026-10-01T09:27:10.901Z and 39/39 observed link/package/status/recommendation/identifier baselines preserved. The SQL's full-row check additionally protected every unrelated product column during the update. Fresh active coverage rose from 132/347 to 171/347; recommended coverage from 131/238 to 170/238. Separate SQL confirmed the held Curlsmith, K18 mist, Garnier mismatch, head & shoulders mismatch, Nivea and Monday Volume rows retain their previous prices and stamps. The intake worker remains active with PID151026 and the weekly timer is unchanged. See `production-verification.json`.

## Subsequently approved exceptions

Nick explicitly approved both remaining large price corrections in this chat. Current retailer pages were rechecked before applying: Nivea EUR 3.95 / 400 ml at dm, exact GTIN4006000193991; Monday Volume EUR 5.40 / 350 ml at Flaconi, exact EAN4897097266343, in stock. The original Luna quote of EUR5.60 for Monday remains historical evidence and was not applied.

`apply-approved-outliers.sql` applies these exact two prices only, with the same atomic identity/baseline/full-row guards as the earlier reviewed DML. It does not change the automatic30% policy. Package fields and links remain unchanged. PGlite checks passed for both prices, unrelated-field preservation, idempotent replay and atomic refusal on all existing drift/identity/status/GTIN/outlier/trigger scenarios. Independent production SQL verified both corrections at2026-10-01T09:36:33.748Z; see `approved-outliers-verification.json`.

The latest100-call batch now has41 applied price confirmations:12 numeric changes (9 decreases,3 increases),29 unchanged prices confirmed,59 no-write outcomes. Those59 consist of41 unavailable/broken-stored-link reports,12 no reliable exact match or price, and6 reviewed package/barcode/source holds. These research classifications are review signals, not verified availability-status changes.

Current active catalog coverage:173/347 prices confirmed within14days,174 still stale/unconfirmed. Recommended coverage:172/238 confirmed,66 stale/unconfirmed. The historic raw293-row review CSV includes already resolved exceptions and candidates outside the100-call budget; it is not the current outstanding-product count.

Prioritize the two package mismatches (Curlsmith, K18 mist), the two barcode mismatches (Garnier Kokosmilch, head&shoulders serum), and the two evidence holds (OGX oil, Shiseido oil). Several unavailable-at-stored-link reports have alternative-shop leads worth verifying separately, including OUAI leave-in, Sante Sensitive Care shampoo, Wella Ultimate Repair leave-in and Guhl Panthenol conditioner. No additional links, identifiers or status fields were changed in this pass.
