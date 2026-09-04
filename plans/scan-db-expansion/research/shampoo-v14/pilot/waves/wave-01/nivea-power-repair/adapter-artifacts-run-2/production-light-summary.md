# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Power Repair Reparatur Shampoo (nivea-power-repair)

## Production rows

| Thickness | Bucket | Scalp route | Cleansing |
| --- | --- | --- | --- |
| normal | normal | balanced | regular |
| coarse | normal | balanced | regular |

Conditional thicknesses (not emitted): fine

Required roles: shampoo_everyday

## Projected rationale and confidence

| Field | Confidence | Rationale |
| --- | --- | --- |
| product.suitable_thicknesses | moderate | Ideal: normal — Moderate cleansing with high repair conditioning and moderate weight is a good fit for normal damaged hair. coarse — Coarse hair can use the richer repair/oil/cationic care system without the same lift penalty. Conditional (not emitted): fine — High conditioning and moderate residue risk can reduce lift on fine hair, though the no-silicone and no-weigh-down counter-signals keep it conditional rather than excluded. |
| category_specs.product_shampoo_specs | moderate | The packet does not target sensitive, itchy, dry-feeling, oily or dandruff scalp; the supported production route is the ordinary balanced shampoo bucket. |
| category_specs.product_shampoo_specs.cleansing_intensity | moderate | Moderate: SLES at position 2 provides effective cleansing, but CAPB, two early glucosides and a substantial oil/refatting care phase keep the net architecture below strong. Observed intensity: regular. |
| required_protocol_roles | moderate | Roles derived from reviewed buckets: shampoo_everyday. |

## Warnings

- None
