# Catalogue authority lifecycle repair candidates

Status: approved and applied to production on 2026-08-15. The exact preflight reported 19/19 matching source rows, six valid canonical targets, zero drift, and zero conflicting relationships. The transaction completed with zero remaining recommendation/lifecycle conflicts.

## Proposed invariant

A product may be `is_chaarlie_recommended = true` only while `is_active = true` and `lifecycle_status = 'active'`. The current Stage 3 candidate query already requires all three conditions. The repair therefore aligns stored publication intent with current runtime behavior; it does not remove a product that the complete-category loader can currently select.

## Already discontinued

Clear `is_chaarlie_recommended`; preserve the existing discontinued lifecycle. `OLAPLEX No.3 Hair Perfector` is also still `is_active = true` and should be set inactive. Its existing `replaced_by` relationship remains untouched.

| Product ID                             | Product                                             |
| -------------------------------------- | --------------------------------------------------- |
| `917786d2-cf02-43d4-8a9f-7f872528d581` | OLAPLEX No.3 Hair Perfector                         |
| `d105d245-5993-4b89-b45d-1bf0a86650e3` | Living Proof Clarifying Detox Shampoo               |
| `caa94951-57d9-441d-bd46-5d7debbf365f` | Moroccanoil Clarifying Shampoo                      |
| `e937c8aa-fc99-4731-b848-e5bd988fcc17` | OUAI Detox Shampoo                                  |
| `a1d705b4-b973-486d-b853-2c795b6db681` | Redken Hair Cleansing Cream Shampoo                 |
| `6513692a-b54f-4acc-9c77-5799d3dd200c` | Malibu C Hard Water Wellness Shampoo                |
| `1a6e731e-8fb2-43b4-9f4c-2d7f6dd06dca` | OLAPLEX No.4C Bond Maintenance Clarifying Shampoo   |
| `3f9328d8-1f6a-44e9-affd-fc219d1e691a` | K18 PEPTIDE PREP Detox Shampoo                      |
| `514ffd65-e4a5-4f7f-96c5-0f194e3b3b36` | L'Oreal Professionnel Serie Expert Metal DX Shampoo |
| `d0936238-7412-40bc-ba7a-3c268f17d0f4` | Davines SOLU Shampoo                                |
| `6d6c3ff2-9d12-4f27-a56f-b5b72cf53318` | Bumble and bumble Sunday Clarifying Shampoo         |

## Reviewed duplicate identities

Clear `is_chaarlie_recommended`, set `lifecycle_status = 'discontinued'`, preserve `is_active = false`, and add a fingerprint-bound `replaced_by` relationship only after the target identity is rechecked immediately before execution.

| Duplicate ID                           | Canonical target ID                    | Product                                               |
| -------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `7bd5f94a-fb02-4505-a53a-2b100c265a5b` | `c2d7eb89-9a2e-4476-bb89-c0f33a2aa501` | OGX Renewing Argan Oil of Morocco Conditioner         |
| `7db2bb60-0af6-4198-adec-28fad13251a6` | `e3c4b607-8f81-462c-8a2b-e45c8b3a2976` | Cantu Leave-In Repair Cream                           |
| `996eaa2a-ea4c-4dfb-b455-2782e82d9a44` | `695414e1-3435-4304-943b-76677408980c` | Maria Nila Structure Repair Leave-In                  |
| `4417217b-2843-47aa-8815-04a125b08341` | `9d7141bf-bb7e-41e8-a206-38ee5c42fdc6` | Balea Professional Plex Care 2in1                     |
| `4e76bb70-b521-48e1-9708-4edc48b17c73` | `d9825ad6-f549-4b02-a62a-eaa3bf917936` | Gliss Liquid Silk 4-in-1 Bonding Haarmaske            |
| `686df4f6-4e8f-48e7-b823-5b1e89dd9cf2` | `088b1427-ed22-424e-8cfd-ea2578120ae6` | Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege |

## Inactive non-duplicates

Clear `is_chaarlie_recommended` and preserve the current inactive row. Do not invent a replacement relationship.

| Product ID                             | Product                                          | Current evidence decision                                                              |
| -------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `3c769f60-283f-48c3-9549-cf84b73115d7` | Maria Nila True Soft Leave-In                    | No exact current SKU was verified; remains inactive/unavailable.                       |
| `4fd5f4c3-83b2-4893-be8c-ada29b8ca718` | Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege | Reviewed retailer identity is a scalp mask/non-shampoo; remains excluded from Shampoo. |

## Execution gate

Before any write, the executable manifests must include the exact current lifecycle/relationship fingerprint, the intended fingerprint, the existing reviewed source, reviewer identity, review timestamp, and reviewed-content fingerprint. Any changed row, missing target, existing conflicting relationship, or category drift aborts the whole bounded slice. A fresh exhaustive audit follows every slice.
