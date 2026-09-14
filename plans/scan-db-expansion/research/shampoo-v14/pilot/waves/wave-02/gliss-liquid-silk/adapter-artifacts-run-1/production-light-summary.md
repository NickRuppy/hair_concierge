# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Shampoo Liquid Silk (gliss-liquid-silk)

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
| product.suitable_thicknesses | moderate | Ideal: normal — High rinse-off smoothness with only moderate weight is a strong shine/silk fit for normal hair. coarse — Coarse hair can use the high-conditioning shine/smoothing profile, while moderate weight avoids an overly light-only fit. Conditional (not emitted): fine — High conditioning and moderate residue potential can reduce lift on fine hair, even without a silicone stack, so fine fit is conditional rather than ideal. |
| category_specs.product_shampoo_specs | high | The exact product targets gloss, surface smoothing and manageability rather than a named scalp concern; ordinary balanced scalp route is supported. |
| category_specs.product_shampoo_specs.cleansing_intensity | moderate | Moderate: SLES at position 2 gives effective cleansing, but CAPB, later coco-glucoside and early silk/lipid/polymer care routes keep the net formula below strong. Observed intensity: regular. |
| required_protocol_roles | high | Roles derived from reviewed buckets: shampoo_everyday. |

## Warnings

- None
