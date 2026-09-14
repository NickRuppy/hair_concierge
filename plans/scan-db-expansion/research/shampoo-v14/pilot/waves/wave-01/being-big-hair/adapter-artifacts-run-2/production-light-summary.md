# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Big Hair Shampoo (being-big-hair)

## Production rows

| Thickness | Bucket | Scalp route | Cleansing |
| --- | --- | --- | --- |
| fine | normal | balanced | regular |

Conditional thicknesses (not emitted): normal

Required roles: shampoo_everyday

## Projected rationale and confidence

| Field | Confidence | Rationale |
| --- | --- | --- |
| product.suitable_thicknesses | moderate | Ideal: fine — The volume positioning is explicitly for thin/fine hair and the silicone-free formula has enough cleanser/texture support to keep fine hair in the ideal set. Conditional (not emitted): normal — Normal hair may use it for volume, but the moderate conditioning/weight route and fine-hair targeting make it less central. |
| category_specs.product_shampoo_specs | moderate | The packet does not target sensitive, itchy, dry-feeling, oily or dandruff scalp; the supported production route is the ordinary balanced shampoo bucket. |
| category_specs.product_shampoo_specs.cleansing_intensity | moderate | Strong: CAPB leads the surfactant system after water, but olefin sulfonate at position 3 is reinforced by coco-glucoside, sodium cocoyl isethionate and later sulfosuccinate. The volume positioning is compatible with a stronger cleansing chassis. Observed intensity: regular. |
| required_protocol_roles | moderate | Roles derived from reviewed buckets: shampoo_everyday. |

## Warnings

- None
