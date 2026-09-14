# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Shampoo Intense Keratin (syoss-intense-keratin)

## Production rows

| Thickness | Bucket | Scalp route | Cleansing |
| --- | --- | --- | --- |
| coarse | normal | balanced | regular |

Conditional thicknesses (not emitted): normal

Required roles: shampoo_everyday

## Projected rationale and confidence

| Field | Confidence | Rationale |
| --- | --- | --- |
| product.suitable_thicknesses | moderate | Ideal: coarse — High conditioning and repair positioning align with coarse hair, where the high deposition load is less likely to compromise useful movement. Conditional (not emitted): normal — The repair-care stack can help damaged normal hair, but high weight potential makes it situational rather than an ideal diameter-level default. |
| category_specs.product_shampoo_specs | high | The product is positioned for brittle hair repair rather than a named scalp concern; the ordinary balanced scalp route is the only supported target. |
| category_specs.product_shampoo_specs.cleansing_intensity | moderate | Moderate: SLES plus CAPB gives effective ordinary cleansing, but the early refatting/protein/silicone care stack prevents a strong-reset classification. Observed intensity: regular. |
| required_protocol_roles | high | Roles derived from reviewed buckets: shampoo_everyday. |

## Warnings

- None
