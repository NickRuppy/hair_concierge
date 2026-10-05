# Third pricing batch finalized subset — 2026-10-02

Nick approved finalizing the completed products with “lets finalize the rest”.
The finalized subset contains **46 products**, all already applied under their
individual or reviewed-batch approvals. Independent production readback at
`2026-10-02T14:12:02.653Z` verified **46/46 prices and their exact receipt timestamps**.

| Outcome in the 100-product research cohort | Count |
| --- | ---: |
| Finalized products | 46 |
| Stored numeric prices changed | 14 |
| Unchanged prices reconfirmed | 32 |
| Held Fino oil offer | 1 |
| Other unresolved research results | 53 |
| Total unresolved, excluded from the finalized subset | 54 |

The 14 numeric changes include the separately approved Curlsmith and K18 base
offer/package corrections. They are changes to stored catalog values, not a claim
that all retailers changed like-for-like prices over time.

## Resolved holds and audit trail

Five of the six original identity/package/source holds are resolved:

- [Curlsmith, 237 ml / €17.85](2026-10-02-curlsmith-barcode.md).
- [K18 professional mist, 150 ml / €62.95, Leave-in](2026-10-02-k18-mist.md).
- [Garnier Kokosmilch & Macadamia conditioner, 200 ml / €2.49](2026-10-02-garnier-kokos.md).
- [Head & Shoulders scalp serum, 145 ml / €5.95](2026-10-02-head-shoulders-serum.md).
- [OGX Weightless Dry Oil, 118 ml / €8.95](2026-10-02-ogx-weightless-offer.md).

The [original batch receipt](2026-10-01-third-review/README.md) documents the
39 approved price confirmations and two subsequently approved outliers.
Original CSVs and earlier receipt states remain historical evidence; this
finalization receipt and its companion verification are the current closure.

`2026-10-02-third-batch-finalized-products.csv` lists every completed product,
previous and final stored price, current purchase link, package and check date.
`2026-10-02-third-batch-pending-review.csv` retains all 54 unresolved products
with product IDs, research reasons, evidence URLs and their unchanged current
price/check date. The 53 unsuccessful research results comprise 41 unavailable
reports and 12 no-reliable-match/price results. Reports are not independently
verified availability changes, dead links or discontinuations.

## Fino preferred-retailer check

The owning policy is [Source And Purchase URL Priority](../product-intake-research-ops.md#source-and-purchase-url-priority).
Preferred sources were checked with the product identity/name and stored EAN
`4550516493590` on 2026-10-02 before considering another retailer:

- dm, Rossmann, Müller, Douglas, Hagel and Flaconi: targeted searches did not
  return a matching oil PDP; universal absence is not established.
- [Notino FINO brand page](https://www.notino.de/fino/): one listed product,
  the 230 g mask, with no oil offer on that page.
- [Otto exact 70 ml oil](https://www.otto.de/p/shiseido-haarserum-fino-premium-touch-penetrating-essence-hair-oil-70-ml-j-beauty-S0DED0WY/):
  matches stored EAN, €18.95, “leider ausverkauft”, sold by Alpine Trading
  Mittenwald. The third-party offer is not selected. Its separate Airy Smooth
  listing is a different variant.
- Amazon DE: stored PDP remains unreadable and no current exact offer was verified.
- [Official FineToday oil page](https://brand.finetoday.com/jp/fino/oil/):
  identity evidence only; no German direct checkout verified.
- [Glow Up 70 ml / €9.99](https://www.glowup.de/products/shiseido-fino-premium-touch-penetration-essence-haarol):
  public variant JSON and Product JSON-LD expose EAN `4901872471997`, differing
  from the catalog. The retailer change and barcode alias are not approved.

Fino retains its existing €11 catalog price, Amazon link and old check stamp.
No claim about current availability of that stored offer is made.
Search queries and primary-page observations are retained in the verification.

The price-audit prompt's shop-priority gap remains a separate code follow-up;
the canonical retailer policy is not changed by this operational receipt.

## Scope of closure

This step makes no additional production writes: the approved changes were
already saved, and their final state was verified. It records completion and
preserves the review queue. Finalization is confined to catalog commercial
corrections; it is not a new global-recommendation readiness audit.
