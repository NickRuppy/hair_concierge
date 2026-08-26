# Phase 1 existing-product identifier backfill v1

This is a **research-ready, production-pending** cohort: it adds scanner identifiers only to existing catalog rows. It creates no product rows, changes no recommendation facts, and does not treat retailer evidence as a purchase-offer update.

## Cohort

| Wave | Existing products | GTINs | Purpose | Batch fingerprint |
| --- | ---: | ---: | --- | --- |
| E1 | 20 | 22 | Current Phase 1 pilot, copied exactly from existing-pilot-research.json. | `2f4ad01a094e3e9ae46a0f8e3dcdd492fa4f8656cc19092749b4b3619258ba04` |
| E2 | 23 | 26 | Safe difference from the five researched cohorts after the three held product IDs are removed. | `289f684d92aeea79166efe739ebc2d8a081b1509725261ce6a9fdbb36fe8829f` |

Total: **43 existing products / 48 canonical GTIN-14 values**. Cohort fingerprint: `8e93919f835fb6d3014a345f7e2b17a2723699347f17bde96ec4ff56cdd267b4`.

## Origin of the waves

These are operational production batches, not separate discovery sources. E1 is the 20-product / 22-GTIN pilot already recorded in `existing-pilot-research.json`. E2 is the 23-product / 26-GTIN set difference from the five exact-product research documents, excluding held IDs `b000d235-1fc6-434c-9ba1-f1207d36cded`, `ea88a333-b11c-45c3-bbda-c51f912ee56f`, and `f212a8ff-0a03-404a-aad5-773d5bb6f7c9`. All expected product identities and lifecycle fields are copied from the live baseline.

## Evidence and identity rules

- Every identifier is an exact standalone package, type `ean`, with raw GTIN, zero-padded canonical GTIN-14, package size, market scope, and retained source URLs.
- The six refreshed dm PDP URLs are represented in the JSON evidence records.
- Refreshed evidence at `2026-08-26T14:18:37Z` recorded zero live owners (including inactive products) and zero open-submission overlaps.
- Both historical/market package codes are retained only where the original evidence ties the code to the same exact package; they remain distinct scan identities.

## Guarded application

Before any production apply, reopen every source URL, rerun global ownership across `ean|gtin|barcode` including inactive owners, rerun open-submission overlap detection, and compare both the reviewed Git head and exact cohort fingerprint. A preflight mismatch must fail closed; it is not permission to edit the manifest or guess an owner.

Fingerprint contract: item fingerprints hash stable key-sorted JSON of the full item without its own fingerprint. Wave approval fingerprints are SHA-256 values of the exact raw UTF-8 E1/E2 manifest files that the guarded executor loads. The cohort fingerprint hashes the documented cohort payload excluding timestamps and all fingerprint fields.

Source lineage: live baseline `cc84636c1986bf2fe6a7fa5811ec063e2607ad2655f308220ebf16be93f27332`; pilot research `scanner-phase1-existing-pilot-2026-08-26`; document commits e47bd926, 3b3dfc6d, e040867b, 3eba1830, and 555ac633.
