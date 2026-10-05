# Link-only correction and unresolved package-price checks

**Subsequent approved correction, 2026-10-01:** Nick requested the confirmed olive-oil price and accepted the smaller Moroccanoil pack. Applied and verified EUR 6.95 / 750 ml for olive oil and EUR 16.00 / 50 ml for Moroccanoil at 2026-10-01T07:58:06.119913Z. This supersedes the earlier unchanged-price dispositions below. Both changes set only price_eur, price_checked_at, net_content_value and net_content_unit, plus automatic updated_at. Product names, formulation/specs, links, recommendation/application rules, scanner identifiers and link-status fields stayed unchanged. Exact atomic guarded DML: [package-price SQL](2026-10-01-confirmed-package-prices.sql).

Nick requested changing only the dmBio olive-oil link and keeping the rest unchanged. Live product_identifiers inspection found the existing olive row already carries canonical GTIN 04066447918687, matching the current dm PDP GTIN 4066447918687. The old link redirects to that PDP. This resolves the earlier identity concern for the requested link correction.

## Applied olive link-only change

- Product: 9bfe0a67-72ad-4951-bb99-9f2f5d5c724a, dmBio natives Olivenöl extra.
- Old link: https://www.dm.de/dmbio-natives-olivenoel-extra-p4066447423761.html
- New link: https://www.dm.de/p/d/1459848/dmbio-natives-olivenoel-extra
- Existing catalog price remains EUR 3.75 and its price_checked_at remains 2026-06-10. The current retailer bottle is 750 ml at EUR 6.95, online deliverable; the link change is not a fresh price confirmation.
- Executed as guarded DML via Supabase execute_sql on pqdkhefxsxkyeqelqegq; no schema/migration-history change.
- Atomic row lock, exact identity/current GTIN and old-link preconditions; idempotent if already corrected. Full before/after product-row comparison raises and rolls back if any field other than affiliate_link or automatic updated_at changes.
- Post-write SQL confirmed the canonical link, preserved price/date, available status and 2026-06-10 link-status date, and unchanged null net-content fields. Identifiers, images, specs and recommendation/application rules were not edited.
- Exact guarded command: [link-only SQL](2026-10-01-olive-link-only.sql).

## K18 clarification

The blocked price refers specifically to K18 Leave-In Molecular Repair Hair Mask, research-observed 50 ml, catalog row 38dace91-0fba-49ee-a93f-ac36e488fe4b. Stored EUR 75 remains unchanged. The research worker reported EUR 49.99 from indexed Douglas evidence and explicitly noted direct-fetch failure; prior independent browser verification returned 404 and this follow-up direct web fetch still fails. This is not a currently verified purchasable EUR 49.99 offer. It does not refer to the separate K18 Professional Molecular Repair Hair Mist row.

## Moroccanoil package ambiguity

The stored Douglas link https://www.douglas.de/de/p/5011481841 currently confirms All In One Leave-In Conditioner **50 ml - Mini at EUR 16.00**, online in stock. The live catalog row 7a3d1d99-2ff4-49b9-b021-d5ec2bdb0fe6 has EUR 28.80 and null net_content_value/unit. Both 7290113142954 (50 ml) and 7290113142947 (160 ml) are attached identifiers. Their size mapping is recorded in the August scanner-coverage evidence, so the row cannot establish which package the old price represented.

The separate 160 ml Douglas page https://www.douglas.de/de/p/5010867062 displayed EUR 28.99 on direct follow-up and “Demnächst wieder lieferbar”; search-index evidence still showed EUR 25.99 and is not the accepted direct-page observation. No Moroccanoil price, size, identifier or link was changed. EUR 16 is a verified mini-package price, not evidence that the 160 ml bottle became cheaper.

## Existing size precedents and current limitation

Live catalog evidence confirms OLAPLEX No.3PLUS Complete Repair Treatment (3dc24d67-e6c0-4239-a273-058a87d13553) maps both 810177860273 and 810177860266 to one product. The August scanner research maps these to 100 ml and 250 ml respectively. Curlsmith Multitasking Conditioner 3 in 1 likewise maps 0850005417781 and 0850005417804; recorded package sizes are 59 ml and 946 ml. Those rows have one price each and currently null net-content fields, not a set of individually priced offers. Other live rows already pair one price with a size: e.g. Plantur 39 EUR 9.95 / 250 ml, Garnier Honig Schätze EUR 3.45 / 400 ml.

The present model is one formula/product with multiple scanner identifiers, plus one linked commercial offer represented by price_eur and net_content_value/unit. The Personal Plan start detail sheet and product comparison consume these fields separately and can render package price alongside package size. This correction chooses the linked 50 ml Moroccanoil offer; it does not claim a price reduction for 160 ml and does not split scanner/formula identity.

Known follow-up: scripts/price-audit/run.ts does not fetch net-content fields, and src/lib/price-audit/adapters/llm.ts asks for the default consumer size. Multiple barcode aliases do not themselves select the advertised pack. Future automated research should be bound to the chosen commercial package; this data correction does not implement that runtime change or a multi-offer/size-selector feature. The generic 30% price-delta guard remains unchanged.
