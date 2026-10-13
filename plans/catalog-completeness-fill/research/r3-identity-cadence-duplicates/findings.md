# R3 — Barcodes, Epres size, scalp cadences, duplicate pairs (research, 2026-10-09)

Read-only research lane (Sonnet); full detail incl. verbatim directions and impact counts in `findings.json`. The orchestrator persisted this summary and verified live: all 7 "missing" GTINs are owned by the sibling entry of a same-SKU pair, and `idx_product_identifiers_canonical_gtin14_owner` (migration `20260826142200`) allows one owner per GTIN.

## Headline

1. The 7 barcode gaps are duplicate-pair artefacts, not research gaps — each product's GTIN already sits on its same-SKU sibling.
2. Two more same-SKU pairs exist beyond the original five (shared purchase links): Pantene 7in1 oil `5827a3b9` vs leave-in `f8f3b51d`; Balea Aqua Hyaluron 3in1 mask `55727898` vs leave-in `c6e80f39`.
3. No scalp-care product states a usage frequency in an authoritative source → no canonical cadence can be set without inventing one.

## 1. Barcodes (GS1-valid, pack size matches)

| Product | GTIN | Owned by | Proposal |
|---|---|---|---|
| Garnier Macadamia conditioner `4c3e1a63` | 3600542511612 | leave-in `a72d630d` | keep both; add `retailer_sku dm:1676326` |
| Garnier Aloe leave-in `0307c903` | 3600542511049 | mask `52264c47` | keep both; add `retailer_sku dm:1676340` |
| Midnight Serum leave-in `6b01025d` | 3600524135805 | oil `21a94166` | keeper = leave-in; move GTIN in same tx |
| Pantene 7in1 leave-in `f8f3b51d` | 8700216178402 | oil `5827a3b9` | keeper = oil (retailer-only evidence, medium) |
| Balea Aqua 3in1 leave-in `c6e80f39` | 4066447668315 | mask `55727898` | keep both; set 150 ml (net content NULL today) |
| Guhl 2in1 mask `8ef172f7` | 4072600703403 | conditioner `11d42d9d` | keep both; add `retailer_sku dm:2977200` |
| Balea Tiefenreinigung shampoo `0f71ff9d` | 4070765001020 | deep-cleansing `375ee7a0` | keeper = deep-cleansing |

## 2. Epres `f8a63590`

net_content NULL → proposed 30 ml (2 × 15 ml concentrate vials, kit with empty 150 ml bottle; rawhair.com.au, Cosmoprof US, epres.com). Alternative 300 ml ready-to-use yield. Medium confidence.

## 3. Scalp-care cadences

Allowed scalp kinds: `daily`, `daily_or_twice_daily_as_needed`, `weekly_range`, `as_needed`, `label_schedule`; timing-only kinds (`label_timing`) never become a schedule.

| Product | Directions | Frequency? | Proposal |
|---|---|---|---|
| Balea Peeling `e51cfce0` | dm: auftragen, einmassieren, 15–20 Min., mit Shampoo ausspülen | no | stays generic |
| Isana Peeling `2544de60` | Rossmann blocked; secondary: 15–20 min, rinse with shampoo | no | stays generic (needs pack/Rossmann text) |
| H&S Leave-In Serum `c9b231ee` | headandshoulders.de: auf Kopfhaut, nicht ausspülen; dm: "nach und zwischen den Haarwäschen" | no (occasion only) | stays generic |
| Balea Serum Sensitive `35d2cc66` | dm: abends auftragen, morgens wie gewohnt waschen | no (timing only) | unchanged (falls back to generic) |

## 4. Same-SKU pairs — rule: keep both only if the manufacturer names both uses

| Pair | Stated uses | Verdict |
|---|---|---|
| Balea Tiefenreinigung shampoo `0f71ff9d` / deep-cleansing `375ee7a0` | "Tiefenreinigendes Shampoo … für die tägliche Anwendung geeignet" — one use | keep deep-cleansing; retire shampoo (medium) |
| Garnier Macadamia leave-in `a72d630d` / conditioner `4c3e1a63` | garnier.de: Spülung / Maske / Leave-In | keep both |
| Garnier Aloe mask `52264c47` / leave-in `0307c903` | garnier.de: Kopfmassage / Maske / Leave-In | keep both |
| Midnight Serum oil `21a94166` / leave-in `6b01025d` | loreal-paris.de "Haarserum", kein Ausspülen, water-first formula | keep leave-in; retire oil |
| Guhl 2in1 conditioner `11d42d9d` / mask `8ef172f7` | dm: Spülung / Kur | keep both |
| Pantene 7in1 oil `5827a3b9` / leave-in `f8f3b51d` | "Haaröl Spray", nicht ausspülen (manufacturer page gone) | keep oil; retire leave-in (1 owner, heat protocol; medium) |
| Balea Aqua 3in1 mask `55727898` / leave-in `c6e80f39` | dm: Haarmaske, Leave-in, Over-Night | keep both (neither recommended; "Nicht lieferbar") |

Retirement mechanism (docs/catalog-authority.md, existing tombstones): `is_chaarlie_recommended=false`, `lifecycle_status='discontinued'`, `is_active=false`, `product_relationships` `replaced_by` edge to keeper, move `user_products` owners + GTIN row to keeper; no deletes. Caveat: existing `replaced_by` edges are same-category; these are cross-category (schema/audit allow it; `src/lib/catalog-authority/repair.ts` slices are category-bounded).

## Open questions

1. Keep-both pairs can't both be barcode-scannable (one GTIN, one owner). Accept GTIN on current owner + dm `retailer_sku` on the sibling?
2. Pantene: confirm oil as keeper (leave-in has 1 owner + heat protocol)?
3. Balea Tiefenreinigung: confirm deep-cleansing as keeper?
4. Epres: 30 ml concentrate or 300 ml ready-to-use?
5. Scalp cadences: accept generic, or may occasion/timing statements become `label_schedule` (recommend no)?
