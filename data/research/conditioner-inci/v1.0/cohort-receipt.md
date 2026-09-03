# Frozen Conditioner cohort receipt

- Project: `pqdkhefxsxkyeqelqegq`
- Capture: `2026-08-23T11:11:30.427157+00:00`
- Query version: `conditioner-stage-a-cohort-v1`
- Predicate: `category_key = conditioner AND is_active = true AND lifecycle_status = active`
- Starting rows: 49
- Eligible rinse-out candidates: 46
- Excluded product form: 3
- Rows with stored EAN/GTIN/barcode: 6
- Eligible rows still needing identifier research: 40
- Canonical rows SHA-256: `ce051c01abbdbccd4b483e508e60da47e5442b7ec3379285a9a0e2b533b0c69f`
- Full artifact SHA-256 before this receipt: `1aecb7e341c1c8f4c79b7abad157dfbfb3b2510a175f136c027142e162315a6b`

The capture was read-only. Current Conditioner specs and rerank values are preserved only as historical comparison facts. No production row or identifier was changed.

## Boundary exclusions

| Product | Reason | Authority |
|---|---|---|
| Cantu Leave-In Repair Cream | Leave-in only; official directions say do not rinse | Cantu official product page |
| Garnier Hair Food Macadamia | Official 3-in-1 mask with conditioner, mask, and leave-in modes | Garnier Germany |
| Pantene Pro-V Miracles Bond Repair Conditioner | Exact GTIN offers rinse-out and leave-on use | dm exact-GTIN page |

Guhl Panthenol + Reparatur 2in1 remains eligible because its official directions describe one immediate rinse-out use without a separate leave-on or mask dwell-time mode.
