# Shampoo Production Light v1

Version: shampoo-production-light-v1

Status: property_lane_ready

Product: Anti-Schuppen Shampoo Classic Clean (head-shoulders-classic-clean)

## Production rows

| Thickness | Bucket | Scalp route | Cleansing |
| --- | --- | --- | --- |
| fine | schuppen | dandruff | regular |
| normal | schuppen | dandruff | regular |
| coarse | schuppen | dandruff | regular |
| fine | dehydriert-fettig | oily | regular |
| normal | dehydriert-fettig | oily | regular |
| coarse | dehydriert-fettig | oily | regular |

Conditional thicknesses (not emitted): none

Required roles: shampoo_dandruff, shampoo_everyday

## Projected rationale and confidence

| Field | Confidence | Rationale |
| --- | --- | --- |
| product.suitable_thicknesses | moderate | Ideal: fine — Moderate conditioning and weight offset some of the strong cleansing chassis without creating a heavy fine-hair default. normal — The treatment architecture combines recognized dandruff support with moderate conditioning and weight for normal-diameter hair. coarse — The anti-dandruff treatment role is diameter-independent, and the silicone/cationic care routes make the strong cleansing architecture usable for coarse hair. Conditional (not emitted): none. |
| category_specs.product_shampoo_specs | moderate | Exact anti-dandruff positioning and Piroctone Olamine at position 10 independently support the dandruff route. The exact manufacturer positioning separately names oily scalp, and SLES plus TEA-Dodecylbenzenesulfonate provide a cleansing route independent of Piroctone Olamine. |
| category_specs.product_shampoo_specs.cleansing_intensity | high | Strong: SLES is reinforced by a second anionic sulfonate route and an oily-scalp/problem-led architecture, while CAPB and care routes do not fully offset the reset chassis. Observed intensity: regular. |
| required_protocol_roles | moderate | Roles derived from reviewed buckets: shampoo_dandruff, shampoo_everyday. |

## Warnings

- None
