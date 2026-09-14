# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Shampoo Repair & Pflege (schauma-repair-pflege)

## Production rows

| Thickness | Bucket | Scalp route | Cleansing |
| --- | --- | --- | --- |
| coarse | normal | balanced | regular |

Conditional thicknesses (not emitted): normal

Required roles: shampoo_everyday

## Projected rationale and confidence

| Field | Confidence | Rationale |
| --- | --- | --- |
| product.suitable_thicknesses | moderate | Ideal: coarse — Coarse hair is the best default fit for the high-conditioning/high-weight repair profile; the richer deposition is less likely to compromise useful movement. Conditional (not emitted): normal — The repair-care stack can help damaged normal hair, but high weight potential makes it situational rather than an ideal diameter-level default. |
| category_specs.product_shampoo_specs | high | The product is positioned for damaged/dry hair repair rather than a named scalp concern; the ordinary balanced scalp route is the only supported production target. |
| category_specs.product_shampoo_specs.cleansing_intensity | moderate | Moderate: SLES at position 2 and early sodium chloride make this an effective cleanser, but CAPB plus a very early cationic polymer/panthenol/oil/silicone care phase keeps the net architecture below a strong reset shampoo. Observed intensity: regular. |
| required_protocol_roles | high | Roles derived from reviewed buckets: shampoo_everyday. |

## Warnings

- None
