# Head & Shoulders Derma x Pro scalp serum — 2026-10-02

Product: `c9b231ee-77b5-45b7-8127-7a85d3ae7dd0` — catalog name `Kopfhaut-Feuchtigkeitspflege Leave-In Serum`.

Nick approved the presented dm 145 ml / €5.95 base offer, addition of its current
barcode, preservation of the existing barcode, explicit package size, and refreshed
price/link verification dates with “good yes”. Both barcode versions identify
145 ml scalp-hydration serum listings.

## Applied and independently verified

| Field | Stored value |
| --- | --- |
| Base offer | [dm, exact serum page](https://www.dm.de/p/d/2482723/head-und-shoulders-leave-in-serum-derma-x-pro-kopfhaut-feuchtigkeitspflege) |
| Package | 145 ml |
| Package price | €5.95 including VAT, excluding shipping; unchanged |
| Current barcode added | `8006530455787` / canonical `08006530455787` |
| Existing barcode preserved | `8700216495981` / canonical `08700216495981` |
| Existing retailer SKU preserved | `dm:2482723` |
| Category | `scalp_care`; unchanged |
| Purchase status | `available`; unchanged |
| Recommendation eligibility | `is_chaarlie_recommended=true`; unchanged |

The prior hold arose because the current dm GTIN differed from the registered
barcode. The stored price was already €5.95, and the package size was unspecified.
This correction adds current identifier coverage and explicit package metadata;
it does not change the numeric price or purchase URL.

## Evidence and limits

- dm was rechecked on 2026-10-02: 145 ml / €5.95, “Lieferbar”, GTIN
  `8006530455787`. No coupon discount was assumed.
- [Oh feliz's exact 145 ml serum listing](https://www.ohfeliz.de/head-shoulders/headshoulders-derma-x-pro-leave-in-serum-kopfhaut-feuchtigkeitspflege)
  independently corroborates the retained `8700216495981`.
- The current and older listings match the brand, product family, scalp-hydration
  use, no-rinse application and 145 ml size. Their ingredient lists share the core
  ingredients but differ in some fragrance declarations. Identical formulas or a
  manufacturer-confirmed barcode replacement were not established and were not
  claimed to Nick. He approved keeping both barcode versions under this catalog
  product after that limitation was presented.
- No formula, category facts, exact application protocol, recommendation status,
  image, name or description was changed.

## Verification

The guarded operator SQL validates the new GTIN checksum, serializes canonical
identifier ownership, locks the product, refuses another owner or a changed
product/identifier baseline, and verifies every unrelated product field and both
existing identifier rows are preserved. Its barcode-only aggregate excludes the
retailer SKU's null canonical GTIN while preserving that SKU's full row.
An exact replay returns without creating a duplicate.

Price and purchase-link verification dates are `2026-10-02T13:22:47.792Z`.
Independent production readback at `2026-10-02T13:23:53.612Z` confirmed the 145 ml
package, current barcode added, old barcode and retailer SKU unchanged, all other
product fields preserved, and both scalp specification/application protocol rows
unchanged. The product remains active and outside quarantine.

See the companion operator SQL and verification JSON. No server files, worker
configuration or timers were changed.
