# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Shampoo Total Repair (gliss-total-repair)

## Production rows

| Thickness | Bucket | Scalp route | Cleansing |
| --- | --- | --- | --- |
| coarse | normal | balanced | regular |

Conditional thicknesses (not emitted): normal

Required roles: shampoo_everyday

## Projected rationale and confidence

| Field | Confidence | Rationale |
| --- | --- | --- |
| product.suitable_thicknesses | moderate | Ideal: coarse — Coarse hair is the best default fit for this high-conditioning/high-weight repair and shine profile. Conditional (not emitted): normal — The repair-care stack can help damaged normal hair, but high weight potential makes it situational rather than an ideal diameter-level default. |
| category_specs.product_shampoo_specs | high | The product is positioned for dry/damaged hair repair and shine rather than a named scalp concern; ordinary balanced scalp route is the only supported production target. |
| category_specs.product_shampoo_specs.cleansing_intensity | moderate | Moderate: SLES at position 2 and CAPB at position 3 provide effective ordinary cleansing, while early dimethicone, keratin and later amodimethicone/cationic guar keep the complete architecture from reading as strong reset. Observed intensity: regular. |
| required_protocol_roles | high | Roles derived from reviewed buckets: shampoo_everyday. |

## Warnings

- None
