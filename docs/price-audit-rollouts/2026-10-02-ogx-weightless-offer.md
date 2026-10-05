# OGX Argan Weightless oil offer — 2026-10-02

Product: `aa349c07-1add-44d4-9161-d99190182e5c` — catalog name `OGX Argan weightless Öl`.

Nick approved the presented Hagel 118 ml / €8.95 offer with “Okay sounds good”.
That settles the retailer choice. The stored barcode matches the exact Hagel
listing, so no barcode addition or identity change is needed.

## Applied and independently verified

| Field | Stored value |
| --- | --- |
| Base offer | [Hagel, exact Weightless Reviving Dry Oil](https://www.hagel-shop.de/ogx-renewing-argan-oil-of-morocco-oil-weightless-reviving-dry-oil-118-ml.html) |
| Package | 118 ml; previously unspecified |
| Package price | €8.95; unchanged |
| Existing barcode preserved | `3574661563350` / canonical `03574661563350` |
| Category | `oil`; unchanged |
| Purchase status | `available`; unchanged |
| Recommendation eligibility | `is_chaarlie_recommended=true`; unchanged |

The previous purchase link was
`https://www.dm.de/ogx-haaroel-moroccan-argan-oil-weightless-dry-out-oil-p22796976208.html`.
The correction replaces that link, records the package size, and refreshes both
price and purchase-link verification dates. It does not change the numeric price.

## Evidence and limits

- Hagel was rechecked on 2026-10-02. Its product details table explicitly gives
  EAN `3574661563350`, matching the existing catalog identifier.
- Its JSON-LD Product/Offer confirms the exact Weightless Reviving Dry Oil title,
  118 ml package, €8.95 EUR offer and `InStock` status. The rendered page also
  showed the purchase button and delivery estimate.
- The old dm URL could not be verified in the browser tool. Targeted dm and
  Rossmann searches did not return a matching listing. This does not establish
  a dead link or universal product unavailability.
- This is the Weightless Reviving Dry Oil, not the separate Penetrating Oil.
  No formula, category facts, application guidance or recommendation state changed.

## Verification

The guarded operator SQL locks the product, verifies the exact prior offer and
all unrelated product fields, checks the complete existing identifier row, and
refuses changed baselines or quarantine. It updates only the approved link,
package size and check dates. In-transaction checks preserve all other product
fields, the identifier and related category/application rows. An exact replay
returns without another update.

Price and purchase-link verification dates are `2026-10-02T13:36:01.722Z`.
Independent production readback at `2026-10-02T13:36:43.846Z` confirmed all
11 checks, including the unchanged €8.95 price, existing barcode and all five
oil specification, eligibility and application-protocol rows.

See the companion operator SQL and verification JSON.
