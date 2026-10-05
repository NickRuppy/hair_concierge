# Curlsmith barcode addition and approved base offer — 2026-10-02

Product: Curlsmith Multitasking Conditioner 3 in 1
(`2bafeb7e-6610-4efc-a8e8-a402071b2ed9`).

Nick explicitly asked to add the verified 237 ml barcode and present the recommended
base offer. The settled catalog rule is one displayed purchase link, package size,
and package price; barcodes from other sizes may identify the same product.

## Applied and verified

- Added UPC/GTIN `850005417637` (canonical GTIN-14 `00850005417637`).
- Source: [Hagel's exact 237 ml product page](https://www.hagel-shop.de/curlsmith-multi-tasking-conditioner-237ml-12128539.html).
- Preserved the existing 59 ml and 946 ml identifiers, including their metadata.
- The complete product row was unchanged by the barcode addition. The later approved
  commercial update is recorded separately below.
- Independent production readback verified at `2026-10-02T08:52:37.229Z`.
- Identifier ID: `d8028967-439a-46c0-ae32-24710bb6f121`.
- The receipt SQL validates the check digit, locks the canonical identifier and product,
  refuses another owner or unexpected existing identifiers, and verifies preservation.
  A matching replay does not create a duplicate.

## Approved displayed base offer — applied

| Field | Stored value |
| --- | --- |
| Product | Curlsmith Multi-Tasking Conditioner |
| Package | 237 ml |
| Package price | €17.85 including VAT, excluding shipping |
| Purchase link | [Hagel, exact 237 ml bottle](https://www.hagel-shop.de/curlsmith-multi-tasking-conditioner-237ml-12128539.html) |
| Barcode | 850005417637 |
| Existing catalog category | Leave-in (`leave_in`) |

Hagel currently lists this bottle at €17.85 (normal price €21.00) and delivery in
2–4 working days. Its product page includes a professional-product acknowledgement;
no acknowledgement or purchase was submitted. No extra coupon discount was assumed.

Directly selecting 237 ml at Douglas exposes the precise
[variant URL](https://www.douglas.de/de/p/5011693052?variant=1215523).
It shows €21.99 but “Demnächst wieder lieferbar”. The generic product page initially
selects the 59 ml bottle, whose available status must not be attributed to 237 ml.

Nick approved this exact presented offer with “sounds good”. The guarded operator
SQL applied €17.85, the exact Hagel purchase link, and 237 ml together, and refreshed
the price and purchase-link verification dates. Previously these fields held
€20.95, the generic Douglas URL, and no explicit package size.

Independent production readback at `2026-10-02T09:02:01.030Z` confirmed the new
offer, every identifier row unchanged, and all unrelated product fields preserved.
The purchase status remains `available`; category and recommendation state are
unchanged. See `2026-10-02-curlsmith-base-offer.sql` and its verification JSON.
The user's term “capa” is awaiting clarification; no classification change was made.

No server files, worker configuration, timers, catalog recommendation status,
or category specification rows were changed.
