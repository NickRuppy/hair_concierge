# Garnier Wahre Schätze Kokosmilch & Macadamia — 2026-10-02

Product: `8c3eda97-5009-40bb-959b-1a7d90f48b09`.

Nick approved the presented Rossmann 200 ml / €2.49 base offer, addition of its
barcode while preserving the existing 250 ml barcode, and correction of the stale
Hair Food description with “sounds good”.

## Applied and independently verified

| Field | Stored value |
| --- | --- |
| Product | Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung |
| Category | Conditioner / `conditioner` |
| Displayed package | 200 ml |
| Package price | €2.49 including VAT, excluding shipping; unchanged |
| Purchase source | [Rossmann exact 200 ml bottle](https://www.rossmann.de/de/pflege-und-duft-garnier-wahre-schaetze-spuelung-kokosmilch-und-macadamia-normales-und-trockenes-haar/p/3600542462327) |
| Additional 200 ml barcode | `3600542462327` / canonical `03600542462327` |
| Preserved 250 ml barcode | `3600542462839` / canonical `03600542462839` |
| Purchase status | `available` |
| Recommendation eligibility | `is_chaarlie_recommended=true`; unchanged |
| Description | Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung ist eine ausspülbare Pflegespülung für normales bis trockenes Haar. |

Before this correction, the catalog had the Rossmann 200 ml link and €2.49 price,
but only the 250 ml identifier and no explicit package size. This was a package-
identifier mismatch. It did not establish a dead purchase link or a price change.

## Current source evidence and shop preference

- Rossmann was rechecked on 2026-10-02: 200 ml / €2.49, with an online delivery window
  of 2026-10-06 to 2026-10-07. No coupon discount was assumed.
- [Budni's exact 200 ml listing](https://www.budni.de/sortiment/produkte/5399307000)
  independently identifies `3600542462327`.
- [dm's exact 250 ml listing](https://www.dm.de/p/d/1670338/wahre-schaetze-conditioner-kokosmilch-und-macadamia)
  identifies the retained `3600542462839` and lists €2.75. Its delivery status is
  “Nicht lieferbar”; branch availability requires a specific market check.
- The dm and Budni ingredient lists match, including formula reference
  `F.I.L. Z70019995/1`, supporting the two package sizes of this conditioner.
- The category-specific sourcing rule in `docs/product-intake-research-ops.md`
  prefers dm, then Rossmann. The approved Rossmann offer is the available delivery
  fallback; no unverified dm branch stock was assumed.

The old description incorrectly named “Garnier Hair Food Macadamia (Kokos)”.
The existing identity audit already distinguishes this Wahre Schätze row from the
separate Hair Food products (`docs/hai-124-product-metadata-audit-review.md:225`).
Only the description was corrected; no formula, suitability, category facts,
application instructions, image, or recommendation behavior was changed.

## Verification

The operator SQL validates the new EAN checksum, locks its canonical identity and
the product, refuses another owner or a changed product/identifier baseline, and
verifies every unrelated product field and existing identifier is preserved.
An exact replay returns without creating a duplicate.

Price and purchase-link verification dates are `2026-10-02T12:19:27.673Z`.
Independent production readback at `2026-10-02T12:20:15.890Z` confirmed the updated
metadata, the complete old identifier preserved, the additional identifier present,
and all six category/specification/eligibility/protocol rows unchanged.
The price, purchase URL, category, active state and recommendation flag are unchanged.
See the companion operator SQL and verification JSON.

No server files, worker configuration, or timers were changed.
