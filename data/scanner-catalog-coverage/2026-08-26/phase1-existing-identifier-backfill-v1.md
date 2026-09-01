# Phase 1 existing-product identifier backfill v1

This is a **research-ready, production-pending** cohort: it adds scanner identifiers only to existing catalog rows. It creates no product rows, changes no recommendation facts, and does not treat retailer evidence as a purchase-offer update.

## Cohort

| Wave | Existing products | GTINs | Purpose                                                                                                                                | Batch fingerprint                                                  |
| ---- | ----------------: | ----: | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| E1   |                20 |    22 | Current Phase 1 pilot, copied exactly from existing-pilot-research.json.                                                               | `2f4ad01a094e3e9ae46a0f8e3dcdd492fa4f8656cc19092749b4b3619258ba04` |
| E2   |                22 |    24 | Safe difference from the five researched cohorts after the held product IDs and authority-blocked Balea Med Anti Schuppen are removed. | `b59cc597c1aec6a37e58ec1d88ec5dbdb2e1ef4f4d92206ac33cd3765cec746a` |

Historical total: **42 existing products / 46 canonical GTIN-14 values**. These v1 snapshots are superseded for execution by the August 28 v2 manifests (41 products / 43 GTINs); see `plans/2026-08-28-existing-gtin-enrichment-receipt.md`. The executor rejects these old fingerprints.

## Origin of the waves

These are operational production batches, not separate discovery sources. E1 is the 20-product / 22-GTIN pilot already recorded in `existing-pilot-research.json`. E2 is the 22-product / 24-GTIN safe set difference from the five exact-product research documents, excluding held IDs `b000d235-1fc6-434c-9ba1-f1207d36cded`, `ea88a333-b11c-45c3-bbda-c51f912ee56f`, and `f212a8ff-0a03-404a-aad5-773d5bb6f7c9`, plus authority-blocked `f184aef4-d8f9-4956-bcd6-ba1bf1ebeace`. All expected product identities and lifecycle fields are copied from the live baseline.

## Evidence and identity rules

- Every identifier is an exact standalone package, type `ean`, with raw GTIN, zero-padded canonical GTIN-14, package size, market scope, and retained source URLs.
- The six refreshed dm PDP URLs are represented in the JSON evidence records.
- Refreshed evidence at `2026-08-26T14:18:37Z` recorded zero live owners (including inactive products) and zero open-submission overlaps.
- Both historical/market package codes are retained only where the original evidence ties the code to the same exact package; they remain distinct scan identities.

## Guarded application

Before any production apply, reopen every source URL, rerun global ownership across `ean|gtin|barcode` including inactive owners, rerun open-submission overlap detection, and compare both the reviewed Git head and exact cohort fingerprint. A preflight mismatch must fail closed; it is not permission to edit the manifest or guess an owner.

Fingerprint contract: item fingerprints hash stable key-sorted JSON of the full item without its own fingerprint. Wave approval fingerprints are SHA-256 values of the exact raw UTF-8 E1/E2 manifest files that the guarded executor loads.

Source lineage: refreshed live baseline `e19b78d13cfe949744eaf9eceb85e0351f23953a0cddde75e46633e0075ed1f7`; pilot research `scanner-phase1-existing-pilot-2026-08-26`; document commits e47bd926, 3b3dfc6d, e040867b, 3eba1830, and 555ac633.
