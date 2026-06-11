# HAI-124 Product Metadata Overview

Date: 2026-06-09

Scope:

- Production `products` metadata health: names, prices, affiliate links, image URLs, suspicious special characters.
- Known beta-feedback rows: `Guhl Panthenol*`, `Gliss Ultimate Repair Spülung`, `Olaplex No.5 Leave-In`.
- First pass comparison against the Google Sheet `Produklisten`.
- No production changes or migrations were applied.

## Executive Summary

HAI-124 is not just three isolated data bugs. The current product catalog has two different metadata sources:

- Recommendation/classification source: generated product-list JSON and sheet-style matrices.
- Commercial/display source: production `products` rows enriched later with affiliate links, prices, and renamed retailer SKUs.

That split is not yet protected. The ingestion path still reads generated JSON and upserts commercial columns as `null` when the source rows do not include them. A casual rerun can wipe `affiliate_link`, `image_url`, and `price_eur`.

The immediate fixes should be id-based updates for the known product rows. The robust fix should be a recurring product metadata audit that checks URL quality, canonical product identity, current price, stored purchase-link buyability, image presence, and suspicious name markers.

## Aligned Decisions

- Treat the Google Sheet `Produklisten` as the updated product-list source of truth. Treat the old `data/products-from-excel/` files as legacy/generated input, not as an authority for current commercial metadata.
- Keep product display names clean and user-facing. Use exact retailer/official SKU names only when needed to disambiguate product identity. Track sheet-name aliases and successor substitutions in a markdown review document.
- Use default consumer size for prices when several sizes exist. Do not use temporary discount-code prices as canonical `price_eur`.
- Keep products active for recommendation continuity when only the stored purchase link is unavailable. Do not overload `lifecycle_status='discontinued'` for temporary retailer/link unavailability.
- Use binary purchase-link status only: `available` or `unavailable`. `available` means online-buyable at the stored link at audit time; store-only or online-unavailable pages count as `unavailable`.
- If the stored purchase link is unavailable and an exact same SKU/default-size replacement exists at a favored shop, generate a review proposal to replace the link. Do not auto-write replacements without review.
- In the product drawer, unavailable stored links remain clickable but use button text `Shop-Link aktuell nicht verfügbar` and helper text `Der hinterlegte Shop meldet den Artikel aktuell als online nicht verfügbar.`
- Treat missing `image_url` as product-metadata health, but leave image backfill/UI handling to HAI-125.
- Move the Gliss Ultimate Repair spray conditioner case into `Leave-in` instead of keeping it as a rinse-out `Conditioner (Drogerie)` row.

Shop policy:

- Product identity wins first: exact SKU, correct category/use type, correct default size, and current canonical product page.
- Use allowed retailers only; deny aggregators, marketplace search pages, and generic price-comparison pages.
- For drogerie products, prefer dm, Rossmann, or Müller. If more than one has the exact same SKU and default size, choose the lower non-discount current price.
- For high-end/profi products, prefer Douglas, Notino, Flaconi, official brand shops, then Amazon DE only when no better product page exists.

## Current Production Snapshot

Queried from production Supabase on 2026-06-09.

| Metric | Count |
| --- | ---: |
| Total product rows | 237 |
| Active product rows | 236 |
| Inactive product rows | 1 |
| Active rows missing `affiliate_link` | 0 |
| Active rows missing `image_url` | 236 |
| Active rows missing `price_eur` | 4 |
| Active rows with suspicious footnote marker (`*`, `†`, `‡`, `#`) | 1 |

Active categories:

| Category | Active rows |
| --- | ---: |
| Bondbuilder | 5 |
| Conditioner (Drogerie) | 43 |
| Leave-in | 41 |
| Maske | 35 |
| Shampoo | 51 |
| Tiefenreinigungsshampoo | 10 |
| Trockenshampoo | 10 |
| Öle | 41 |

Initial host distribution was mostly retailer/brand-direct, but one active row used a deny-listed aggregator host:

- `got2b Trockenshampoo Extra Volumen`, id `2b2161a2-6c09-435f-adbb-49da44d434ae`, links to `geizhals.de`.
- `geizhals.de` is explicitly deny-listed in `src/lib/affiliate-research/url-gate.ts`.
- Reviewed update on 2026-06-09: replaced with exact Rossmann product page, price `3.99 EUR`, status `available`.

## Known Product Cases

### Guhl Panthenol*

Production:

- id: `11d42d9d-b8d8-42ae-a432-9a3d0f9d3504`
- current name: `Guhl Panthenol*`
- category: `Conditioner (Drogerie)`
- current link: `https://www.rossmann.de/de/pflege-und-duft-guhl-panthenol--reparatur-2in1-kur-und-spuelung/p/4072600703403`
- current price: `3.99 EUR`
- image: `null`

Retailer evidence:

- Rossmann product name: `Guhl Panthenol + Reparatur 2in1 Kur & Spülung`
- Rossmann price: `4.99 EUR`
- availability: online currently not available
- product type: 2in1 Kur & Spülung, with explicit rinse-out conditioner and mask usage
- Müller product page: `Guhl PANTHENOL+ Reparatur 2IN1 Kur & Spülung`, 200 ml
- Müller price: `4.95 EUR`
- Müller availability: online buyable, `Lieferbar in 2 - 3 Werktagen`
- sources:
  - https://www.rossmann.de/de/pflege-und-duft-guhl-panthenol--reparatur-2in1-kur-und-spuelung/p/4072600703403
  - https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/

Recommendation:

- Treat `*` as a data artifact, not user-facing content.
- Update by id to `Guhl Panthenol + Reparatur 2in1 Kur & Spülung`.
- Replace the unavailable Rossmann stored link with the buyable Müller exact-SKU page.
- Update `price_eur` to `4.95`.
- Set `purchase_link_status='available'` after the Müller link is verified online-buyable in the reviewed proposal.
- Keep in `Conditioner (Drogerie)` unless the product taxonomy later gains a separate 2in1 mask/conditioner handling path.

### Gliss Ultimate Repair Spülung

Production:

- id: `5dc2fae3-a0ca-4e6c-9c30-02dd192772f0`
- current name: `Gliss Ultimate Repair Spülung`
- category: `Conditioner (Drogerie)`
- current link: `https://www.dm.de/schwarzkopf-gliss-kur-spuelung-express-repair-ultimate-repair-p4015100339642.html`
- current price: `2.79 EUR`
- image: `null`

Retailer/brand evidence:

- dm currently resolves the relevant Ultimate Repair express-repair product as `Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair`.
- canonical dm URL: `https://www.dm.de/p/d/1430908/schwarzkopf-gliss-sprueh-conditioner-express-repair-ultimate-repair`
- dm price: `4.95 EUR`
- dm GTIN: `4015100813494`
- dm says deliverable.
- Schwarzkopf describes it as a spray conditioner with heat protection up to 230 C and `Nicht ausspülen`.
- sources:
  - https://www.dm.de/p/d/1430908/schwarzkopf-gliss-sprueh-conditioner-express-repair-ultimate-repair
  - https://www.schwarzkopf.de/marken/haarpflege/gliss/produktlinien/ultimate-repair/ultimate-repair-express-repair-spuelung.html

Recommendation:

- Treat this as the current Gliss Ultimate Repair spray-conditioner SKU, not as a rinse-out conditioner.
- Move/update the production row by id into `Leave-in`.
- Prefer the Rossmann SKU for the commercial metadata because it is an exact product page and has the lower current non-discount price:
  - name: `Gliss Ultimate Repair Express-Repair-Spülung` or cleaner display alias `Gliss Ultimate Repair Sprüh-Conditioner`
  - link: `https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-express-repair-spuelung/p/4015100813494`
  - price: `4.49 EUR`
- This row needs spec/category migration review, not only `products.category` and price/link changes.
- This is the clearest example where the audit must check product type and application instructions, not just HTTP status.

### Olaplex No.5 Leave-In

Production:

- id: `4827c174-92e9-4121-ab70-843d5c037ad0`
- current name: `Olaplex No.5 Leave-In`
- category: `Leave-in`
- current link: `https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner`
- current price: `19.65 EUR`
- image: `null`

Retailer evidence:

- official product name: `Original OLAPLEX N°5LEAVE-IN Conditioner`
- official price: `34 EUR`
- source: https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner

Recommendation:

- Update price to `34.00` if the official Olaplex shop remains canonical.
- Keep the current clean display name `Olaplex No.5 Leave-In`.

## Additional Price / Link Fix Candidates

These active rows currently have missing or risky commercial metadata and should be included in the same id-based correction batch after the shop-priority policy is confirmed.

| Product | Current issue | Proposed source | Proposed price |
| --- | --- | --- | ---: |
| `Hair Cleansing Cream Shampoo` | missing `price_eur` | Douglas direct product page for Redken SKU | `26.99 EUR` |
| `Serie Expert Metal DX Shampoo` | missing `price_eur` | Douglas direct product page | `34.19 EUR` |
| `Hard Water Wellness Shampoo` | missing `price_eur` | Notino direct product page, default/current 1000 ml page | `32.20 EUR` |
| `Sunday Clarifying Shampoo` | missing `price_eur` | Notino default 250 ml size | `25.67 EUR` |
| `Moroccanoil Clarifying Shampoo` | link pointed to non-allowlisted `parfumdreams.de` | replaced with exact Notino product page | `29.00 EUR` |
| `got2b Trockenshampoo Extra Volumen` | active link pointed to deny-listed `geizhals.de` | replaced with exact Rossmann product page | `3.99 EUR` |

## Source And Ingestion Risks

The worktree created from `origin/main` does not contain `data/products-from-excel/`. The root checkout currently has generated local JSON files for:

- `conditioner-drogerie.json`
- `leave-in.json`
- `maske.json`
- `shampoo.json`
- `oele.json`

Those generated rows contain classification metadata but no commercial metadata. In the root checkout snapshot:

| Generated file | Rows | Suspicious name markers | Rows missing commercial metadata |
| --- | ---: | ---: | ---: |
| `conditioner-drogerie.json` | 43 | 1 | 43 |
| `leave-in.json` | 43 | 0 | 43 |
| `maske.json` | 38 | 0 | 38 |
| `shampoo.json` | 51 | 0 | 51 |
| `oele.json` | 41 | 0 | 41 |

The current ingestion workflow documents that `scripts/convert_sources.py` generates `data/products-from-excel/<slug>.json`, and `scripts/ingest-products.ts` reads that JSON into `products`. The ingestion script currently upserts:

- `affiliate_link: product.affiliate_link || null`
- `image_url: product.image_url || null`
- `price_eur: product.price_eur || null`

That means a rerun against classification-only source rows can erase production commercial metadata.

Recommended guard:

- Split classification ingestion from commercial metadata ingestion, or make `scripts/ingest-products.ts` preserve existing `affiliate_link`, `image_url`, and `price_eur` unless the source explicitly provides a non-empty replacement.
- Add a dry-run diff mode before any product ingestion touches production.
- Prefer id-based updates for renamed/retailer-backed products. Upsert by `name,category` is fragile when names are being corrected.
- Add an explicit source marker for commercial fields, for example `commercial_source_url`, `commercial_source_host`, `price_checked_at`, and `purchase_link_checked_at` or an equivalent audit-result table.
- Add `purchase_link_status` separate from `lifecycle_status`; current lifecycle only supports active/discontinued behavior and should not be used for temporary stored-link unavailability.

## Proposed Shop Policy

The previous enrichment code has an allowlist/denylist and ranks allowed hosts above generic hosts, but it does not encode a strict preferred-shop order among allowed retailers.

Recommended HAI-124 policy:

1. Product identity wins first: exact SKU, correct category/use type, correct size, and current canonical page.
2. Use allowed retailers only; deny `geizhals`, `idealo`, marketplace search pages, price aggregators, and generic search pages.
3. For drogerie products, prefer dm, Rossmann, or Müller. If more than one has the exact same SKU and default size, choose the lower non-discount current price unless a fixed retailer order is explicitly desired.
4. For high-end/profi products, prefer Douglas, Notino, Flaconi, official brand shops, then Amazon DE only when no better product page exists.
5. For multi-size products, use the default consumer size. If the stored URL is a large salon size only, flag for review instead of silently mixing price bases.
6. Keep stored-link unavailability as `purchase_link_status='unavailable'` and retain `lifecycle_status='active'` unless the product itself is discontinued or intentionally removed from recommendations.
7. If a stored link is unavailable, search favored shops for an online-buyable exact same SKU/default-size replacement and generate a review proposal. Apply the replacement only after human confirmation.

## Existing Link Tooling

The repo already has partial affiliate-link tooling:

- `scripts/export-missing-affiliate-links.ts` finds active products missing syntactically usable links.
- `src/lib/affiliate-research/url-gate.ts` has allow/deny host rules.
- `scripts/write-affiliate-links.ts` applies approved affiliate links with safety checks.

HAI-124 should extend this instead of creating a separate pipeline.

Current gap:

- `isUsableUrl` only validates parseable `http(s)` URLs.
- It does not check product page identity, canonical redirects, stale prices, stored-link buyability, product type, or blocked retailer pages.
- dm and Rossmann can return HTTP 200 while still requiring content-level extraction to know whether the product is actually the intended item.

## Proposed Recurring Audit

Add a script such as `scripts/audit-product-metadata.ts` with read-only default behavior.

Inputs:

- production `products` rows
- optional sheet export / source product list snapshot
- host-specific adapters for common retailers

Checks:

| Check | Why |
| --- | --- |
| URL parse + protocol | catches empty/malformed links |
| deny-listed/aggregator host | catches `geizhals`, `idealo`, etc. |
| HTTP status and final URL | catches redirects and obvious failures |
| canonical URL differs from stored URL | lets us update stale dm/Rossmann URLs |
| structured product name extraction | catches wrong SKU and old product pages |
| brand/name similarity | flags renamed or mismatched products |
| product type/application terms | catches rinse-out vs leave-in vs mask confusion |
| price extraction and delta | catches stale price values |
| purchase-link buyability extraction | flags stored links that are not online-buyable |
| `image_url` presence | health metric, UI handled by HAI-125 |
| suspicious name characters | catches `*` footnotes and similar artifacts |

Output:

- machine-readable JSON and CSV
- review proposal CSV for unavailable stored links and exact-SKU replacements
- summary grouped by status:
  - `ok`
  - `canonical_url_changed`
  - `stale_price`
  - `name_mismatch`
  - `product_type_mismatch`
  - `unavailable`
  - `missing_image`
  - `denylisted_host`
  - `needs_manual_review`

Safety:

- Audit is read-only by default.
- Updates happen through a reviewed CSV or id-based migration.
- Never auto-update when product type or category changes.

Suggested cadence:

- manual run before beta/release
- scheduled weekly or monthly once host adapters are stable
- required gate before product-list ingestion or catalog-affecting migrations

## Google Sheet Comparison

Sheet: `Produklisten`

Tab semantics:

- `HiE-*` means high-end / profi products.
- `D-*` means Drogerie / regular products.
- `Leave-in` and `Öle` are product tabs without a `HiE`/`D` split.
- Tool tabs (`Föhne`, `Bürsten`, `Heat-Tools`, `Frisuren-Tools`) were excluded from this product-catalog comparison.

Method:

- Exported the Google Sheet as `.xlsx`.
- Parsed product tabs.
- Split matrix cells on line breaks and commas.
- Normalized punctuation, accents, parenthetical silicone/coconut flags, and a few obvious typos.
- Compared against active production products.
- Classified rows as:
  - `included`: strong exact/near-exact match
  - `likely_match`: appears included under renamed/successor naming
  - `ambiguous`: plausible match but needs review
  - `missing`: no credible active catalog product found

This is a first-pass coverage audit, not a final migration list.

### Coverage Summary

| Sheet tab | Unique sheet products | Included | Likely renamed/successor | Ambiguous | Missing | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `D-Shampoo` | 51 | 43 | 1 | 4 | 3 | The 8 non-exact cases are mostly included under corrected production names. |
| `D-Conditioner` | 43 | 41 | 0 | 0 | 2 | Both misses are included under corrected successor names. |
| `D-Maske` | 39 | 34 | 4 | 1 | 0 | No clear true missing rows in the first pass. |
| `Leave-in` | 45 | 32 | 6 | 3 | 3 | Includes several intentional successor substitutions and one inactive/cut row. |
| `Öle` | 43 | 18 | 18 | 2 | 4 | Many natural-oil placeholders now map to canonical brand SKUs. |
| `HiE-Shampoo` | 49 | 0 | 5 | 3 | 41 | High-end shampoo coverage is largely absent from active catalog. |
| `HiE-Conditioner` | 53 | 4 | 10 | 6 | 33 | Mixed with leave-ins/masks; many high-end products absent. |
| `HiE-Maske` | 37 | 0 | 3 | 1 | 33 | High-end mask coverage is largely absent. |

### Drogerie Tabs: Non-Exact But Probably Covered

These rows should not be treated as true misses without review:

| Sheet product | Production row |
| --- | --- |
| `Head & Shoulders Derma X Aloe` | `Head & Shoulders Derma X Pro Beruhigende Pflege` |
| `Head & Shoulder Derma X 0%` | `Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege` |
| `Sebamed Everyday` | `Sebamed Every-Day Shampoo` |
| `Pantene Volume Pur` | `Pantene Pro-V Volumen Pur` |
| `Balea Professional Ultra Volume` | `Balea Professional Ultimate Volume` |
| `Monday Volume` | `Monday Haircare Volume Kraft & Fülle Shampoo` |
| `Cantu Lockenshampoo` | `Cantu Shampoo Locken Pflege` |
| `Shampoo Curl Care` | `Hask Curl Care Shampoo` |
| `Garnier Wahre Schätze Aloe Vera Spülung` | `Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung` |
| `OGX Keratin & Protein` | `OGX Bond Protein Repair Conditioner` |
| `Balic Curls Bond Repair` | `Bali Curls Deep Repair Mask` |
| `Nequi Build & Boost` | `Neqi Build Boost` |
| `Haarkur Lamination Intense Glaze` | `Syoss Haarkur Lamination Intense Glaze` |

### Leave-In / Oil Rows Needing Human Review

| Sheet product | Current catalog state |
| --- | --- |
| `Maria Nila True Soft Leave-In` | inactive, intentionally cut previously because no viable leave-in SKU was found |
| `Pantene Pro-V Keratin Protect 10-in-1 Spray` | active successor is `Pantene Pro-V Miracles 7in1 Haaröl Spray` |
| `Pantene Hydra Glow Leave-In` | active successor is `Pantene Miracles Milk-to-Water Leave-In Serum` |
| `Living Proof Restore Instant Repair` | active renamed row is `Living Proof Restore Repair Leave-In` |
| `Curlsmith Weightless Protein Leave-In Conditioner` | active successor is `Curlsmith Weightless Air Dry Cream` |
| `Urban Alchemy Smooth Serum` | active successor is `Urban Alchemy Smooth Supreme Öl Serum` in `Öle` |
| `Balea Natural Beauty Bio-Argan Haaröl` | active successor is `Balea Natural Beauty Pflegeöl Bio` |
| `Shiseido Fino Oil` | active full SKU is `Shiseido Fino Premium Touch Penetrating Hair Oil Essence` |
| `Garnier Fructis Sleek & Stay Öl` | active successor is `Garnier Fructis Sleek & Stay Heat-Activated Serum` |

### High-End Tabs

The high-end tabs are mostly not represented in the active product catalog. This appears expected if the current production catalog is intentionally drogerie-heavy plus selected leave-in/oil/professional rows, but it should be made explicit.

Examples of high-end products not found as active catalog rows:

- `Lóreal Professional Absolut Repair Molecular`
- `Money Mask`
- `Kevin Murphy Hydrate Me Masque`
- `Kerastase Nutritive Masquintense`
- `Goldwell Dual Senses Rich Repair`
- `Olaplex No.8`
- `Maria Nila Heal`
- `Vichy Dercos Anti-Schuppen`
- `Paul Mitchell Tea Tree Special Shampoo`
- `Wella SP P4 Purify Anti-Schuppen & Peeling`
- `Kerastase Blond Absolue`
- `KMS Moist Repair`

Scope decision:

- If high-end/profi recommendations are in current beta scope, these tabs represent a large catalog expansion gap.
- If beta scope is mostly drogerie, mark `HiE-*` tabs out of scope for HAI-124 product inclusion and use them only as future backlog input.
- Current HAI-124 decision: `HiE-*` products are not part of this correction batch unless beta scope explicitly expands to high-end/profi recommendations.

## Recommended Next Work

1. Apply immediate id-based fixes after product-type decisions:
   - Guhl name/price.
   - Olaplex price/name.
   - Gliss only after deciding whether spray leave-in/conditioner is acceptable for that row.
2. Add an ingestion guard so commercial metadata is preserved unless explicitly supplied.
3. Add the read-only audit script and CSV output.
4. Create a reviewed alias/successor table for sheet names versus production names.
5. Decide whether `HiE-*` tabs are in product-catalog scope now or later.
6. Keep `image_url` in the audit output, but leave image display/UI behavior to HAI-125.

## Sources

- Production Supabase `products` table, queried 2026-06-09.
- Google Sheet `Produklisten`, exported as `.xlsx` on 2026-06-09.
- Local root generated JSON snapshot under `/Users/nick/AI_work/hair_conscierge/data/products-from-excel/`.
- `docs/excel-ingestion.md`
- `scripts/ingest-products.ts`
- `scripts/export-missing-affiliate-links.ts`
- `src/lib/affiliate-research/url-gate.ts`
- Rossmann Guhl page: https://www.rossmann.de/de/pflege-und-duft-guhl-panthenol--reparatur-2in1-kur-und-spuelung/p/4072600703403
- Müller Guhl page: https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/
- dm Gliss page: https://www.dm.de/p/d/1430908/schwarzkopf-gliss-sprueh-conditioner-express-repair-ultimate-repair
- Schwarzkopf Gliss page: https://www.schwarzkopf.de/marken/haarpflege/gliss/produktlinien/ultimate-repair/ultimate-repair-express-repair-spuelung.html
- Olaplex page: https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner
