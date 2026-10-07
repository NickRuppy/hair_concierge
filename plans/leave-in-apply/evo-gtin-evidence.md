# EVO Head Mistress Cuticle Sealer — GTIN identity evidence

Task: resolve the GTIN mismatch blocking gold-slot-05 (`plans/leave-in-apply/apply-package.md` §5,
row 5 of the mapping table) before the leave-in-inci apply. Read-only prod SELECTs only, no writes.

## 1. What the two records say

| Source | GTIN | Pack size | Provenance |
|---|---|---|---|
| Research packet (`data/research/leave-in-inci/v1.0/corpus/gold-set/calibration-packet.json`, `entries[4]`, slot 5) | `9349769013144` | 150 ml | T1 evohair.com/us (SKU 39268, US-region manufacturer page) as the primary capture source; T2 haarspullen.nl "explicitly shows EAN 9349769013144 and an ingredient list matching the manufacturer order exactly. Second GTIN source, closing the named gap"; T3 skinsafeproducts.com (INCI corroboration, no GTIN); T2 amazon.de (identity/DE-availability corroboration only, "ASIN-to-EAN mapping not independently confirmed"). `identity_status: verified`. |
| Catalog (`products` id `118ebae1-b7a9-4a89-a2ff-6c31df28c4dc`, name "EVO Head Mistress") | `9349769020791` | 150 ml | `product_identifiers` row: `source = scanner-catalog-coverage-2026-08-26`, added 2026-08-28. Backing `scanner_identifier_backfill_items` payload: single source `https://www.bellaffair.com/evo-head-mistress-cuticle-sealer`, `size: "150 ml"`, `market_scope: "DE/EU"`, checked 2026-08-28. Catalog's own `affiliate_link` (douglas.de/de/p/5010334174) is dead (404) and carries no GTIN of its own. `net_content_value`/`net_content_unit` on the `products` row are both NULL — pack size isn't independently recorded on the catalog row itself, only in the identifier backfill payload. |

Both records already agree on: brand EVO, exact product name "Head Mistress Cuticle Sealer", pack size 150 ml. The only disagreement is the barcode.

## 2. Web verification (live, 2026-09-14)

- **bellaffair.com** (DE/AT specialty retailer, the catalog's own source): product page confirms "Content: 150 ml", "EAN: 9349769020791", product number 49173. Matches the catalog GTIN exactly.
- **haarspullen.nl** (NL specialty retailer, the packet's second GTIN source): page offers two variants via a size selector. Pulled the embedded schema.org `ProductGroup`/`hasVariant` JSON-LD directly:
  - 150 ml variant: `"gtin": "9349769013144"` — matches the research packet's GTIN exactly.
  - 30 ml Travelsize variant: `"gtin": "9349769006979"` — a third, distinct code, confirming the packet's GTIN is specifically the **150 ml** SKU, not a travel-size mixup.
- **ean-search.org** independently resolves both codes to the same product name and market:
  - `9349769013144` → "Evo Head Mistress Cuticle Sealer 150ml", issuing country **AU**.
  - `9349769020791` → "Evo Head Mistress Cuticle Sealer (150ml)", issuing country **AU**.
  Both are legitimate, independently-indexed GTINs for the same 150 ml product, not a typo or a lookup-database error.
- **amazon.de** (ASIN B07CJVDBTR, sold by New Flag GmbH — EVO's long-standing EU/DE distributor; "Item model number: 39268" matches the packet's manufacturer SKU 39268 exactly; listed since 2018-04-18, 199 reviews, many in German): the page's own product-details table shows yet a **third** EAN, `9349769006603` (GTIN-14 `09349769006603`), for the same 150 ml product.
- douglas.de (catalog's own affiliate link) and evohair.com/us (packet's T1 source) are both currently dead (404 / page moved) — no additional signal from those, consistent with normal retailer link rot rather than a product mixup.
- evohair.com's own "About Evo" family-line copy (surfaced verbatim on the Amazon manufacturer panel) confirms "head mistress cuticle sealer" is a single, unchanged SKU concept in EVO's lineup (Finishing hair cream, 150 ml, one product per family) — no separate "cuticle sealer" variant exists at 150 ml other than this one.

## 3. Verdict

**Same formula, same 150 ml pack — this is an EVO/distributor multi-GTIN situation, not a real identity mismatch.** At least three different, independently-verifiable EAN/GTIN codes (`9349769013144`, `9349769020791`, `9349769006603`) are in live retailer use across NL, DE/AT, and DE-via-Amazon(New Flag GmbH) storefronts for the identical product: EVO, "Head Mistress Cuticle Sealer", 150 ml, AU-origin, manufacturer SKU/model 39268. This is consistent with an AU manufacturer whose EU distributors each relabel with their own GS1 batch/run barcode (common for smaller import brands); it is not a 30 ml-vs-150 ml confusion (that travel size has its own fourth code, `9349769006979`, ruled out above) and not a different-formula SKU (no competing INCI turned up anywhere in this pass).

Confidence: **high** that the two GTINs denote the same formula/pack (three independent, live retailer sources agree on name+size+brand+country-of-origin; the packet's INCI identity was already independently verified across T1/T2/T3 sources unrelated to either barcode). Confidence is **not** high enough to say which single GTIN is "the" canonical German-market code — the evidence instead shows there isn't one; German-reachable retailers alone already split across two of the three codes.

## 4. Recommended catalog action

1. **Unblock the apply**: treat gold-slot-05 as identity-confirmed for spec-application purposes. The research packet's INCI/formula is the anchor per task scope, and formula identity (name, brand, pack size, ingredients) is corroborated independently of either GTIN. Clear the `GTIN_MISMATCH_BLOCKS_APPLY` / `identity_must_be_confirmed_before_apply` risk flags for this row.
2. **Don't "correct" the catalog GTIN to the packet's GTIN** — both are genuine, live, in-market codes; overwriting one with the other would just trade one valid barcode for another and could break scanner matching against whichever retailer's stock a German user actually scans.
3. **Do** add the research packet's GTIN (`9349769013144`) as a second `product_identifiers` row on `118ebae1-b7a9-4a89-a2ff-6c31df28c4dc` (type `ean`, e.g. `source: leave-in-inci-gtin-evidence-2026-09-14`), rather than replacing the existing `scanner-catalog-coverage-2026-08-26` row — this is a multi-identifier product, and the scan-hardening/scanner-coverage program (see MEMORY.md `project_scan_hardening_program.md`) already has precedent and infrastructure for multiple identifiers per product. Optionally also record `9349769006603` (Amazon.de/New Flag GmbH) as a third identifier while this is being looked at, since it turned up live in this pass.
4. No packet correction needed — the packet's GTIN, pack size, and formula capture stand as recorded.
