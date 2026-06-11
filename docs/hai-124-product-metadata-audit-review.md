# HAI-124 Product Metadata Audit Review

Generated after applying schema migration `20260609203400_product_metadata_health_fields` to Supabase project `pqdkhefxsxkyeqelqegq` and running `npm run audit:products`.
Last refreshed after reviewed Shampoo updates on 2026-06-11.

## Summary

- Products audited: 239
- Active non-image metadata findings after reviewed fixes: 5 (`Davines SOLU Shampoo`, `got2b Trockenshampoo Liquid to Dry`, `Gliss Aqua Revive`, `Isana 3in1 Milchprotein & Mandel`, and `Nivea Volumen & Kraft`, intentionally active with `unavailable`)
- Inactive non-image metadata findings after reviewed fixes: 2 (`Maria Nila True Soft Leave-In` and `Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege`, intentionally inactive and `unavailable`)
- Product image gaps remain HAI-125 and are intentionally excluded below; the current audit reports 169 `missing_image` rows.
- The live-link proposal checker still overflags some OLAPLEX DE brand pages as unavailable because the pages contain generic unavailable/sold-out text outside the selected product state. Treat the reviewed DB `purchase_link_status` as the source of truth for those rows until the checker is made product-state aware.

## Source Policy

- Prefer an available buy link from desired sources.
- Desired source order: `dm`, `Rossmann`, `Müller`, `Douglas`, `Flaconi`, `Notino`, `Hagel`, then official brand shop.
- Store stable full/original prices where visible, for example UVP on German retailers, rather than temporary promo prices.
- Brand-direct is acceptable for premium/profi products when stable and available.
- Specialty shops such as Lockenbox, CurlySelection, Lookfantastic, and Shop Apotheke remain case-by-case fallbacks.
- `purchase_link_status` is intentionally binary: every reviewed product must become either `available` or `unavailable`; no `unknown` state should remain after review.
- If the currently stored product link cannot be used to buy the exact product online at review time, mark it `unavailable` unless an exact replacement from a preferred source is found.
- Unavailable products stay active when they are still relevant recommendations; the UI should expose `Shop-Link aktuell nicht verfügbar` and a concise drawer note that availability can change or differ by shop.
- Product image gaps stay out of scope for HAI-124 and are handled by HAI-125.

## Current Resume Checkpoint

This is the state to resume from if the thread is compacted.

- Worktree: `/Users/nick/AI_work/hair_conscierge/.worktrees/product-metadata-audit`
- Branch: `codex/product-metadata-audit`
- Supabase project: `pqdkhefxsxkyeqelqegq`
- Supabase CLI command shape that works in this environment: `npx supabase@latest db query --linked --dns-resolver https ...`
- Local Docker is unavailable, so local Supabase reset/lint cannot be used here.
- `supabase/migrations/20260609203400_product_metadata_health_fields.sql` and `supabase/migrations/20260609204000_hai_124_product_metadata_corrections.sql` are already recorded/applied in remote migration history. Later appended SQL in the corrections migration is a local audit trail and must also be manually run against production when approved.
- Completed and production-applied reviewed buckets: initial known fixes, Bucket 2, Bucket 3A, Bucket 3B, Bondbuilder null-status bucket, Tiefenreinigungsshampoo null-status bucket, Trockenshampoo null-status bucket, Maske null-status bucket, Leave-in null-status bucket, Öle null-status bucket, Conditioner null-status bucket, and Shampoo null-status bucket.
- Last verification after Shampoo: `npm run audit:products` completed on 239 products. Non-image findings are limited to intentionally unavailable active products plus the inactive Maria Nila and Head & Shoulders Sanfte Kopfhautpflege rows; product image gaps remain HAI-125.
- Remaining null-status buckets after Shampoo: none.
- Suggested next step: final review of the migration/doc diff, then HAI-125 image backfill or a separate high-end/profi catalog scope decision.

## Known Fix Batch For Your Review

| Product | Current DB state | Proposed correction |
| --- | --- | --- |
| Guhl Guhl Panthenol* (Conditioner (Drogerie)) [11d42d9d-b8d8-42ae-a432-9a3d0f9d3504] | Price 3.99; [Link](https://www.rossmann.de/de/pflege-und-duft-guhl-panthenol--reparatur-2in1-kur-und-spuelung/p/4072600703403) | Name to `Guhl Panthenol + Reparatur 2in1 Kur & Spülung`; Müller link; 4.95 EUR; status `available`. |
| Gliss Gliss Ultimate Repair Spülung (Conditioner (Drogerie)) [5dc2fae3-a0ca-4e6c-9c30-02dd192772f0] | Price 2.79; [Link](https://www.dm.de/schwarzkopf-gliss-kur-spuelung-express-repair-ultimate-repair-p4015100339642.html) | Move to `Leave-in`; name `Gliss Ultimate Repair Sprüh-Conditioner`; Rossmann link; 4.49 EUR; status `available`; remove conditioner specs; add leave-in specs. |
| Olaplex Olaplex No.5 Leave-In (Leave-in) [4827c174-92e9-4121-ab70-843d5c037ad0] | Price 19.65; [Link](https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner) | Keep clean display name; price 34 EUR; status `available`. |
| Redken Hair Cleansing Cream Shampoo (Tiefenreinigungsshampoo) [a1d705b4-b973-486d-b853-2c795b6db681] | Price missing; [Link](https://www.douglas.de/de/p/5010218791) | Set price 26.99 EUR from Douglas; status `available`. |
| L'Oreal Professionnel Serie Expert Metal DX Shampoo (Tiefenreinigungsshampoo) [514ffd65-e4a5-4f7f-96c5-0f194e3b3b36] | Price missing; [Link](https://www.douglas.de/de/p/5011380000) | Set price 34.19 EUR from Douglas; status `available`. |
| Malibu C Hard Water Wellness Shampoo (Tiefenreinigungsshampoo) [6513692a-b54f-4acc-9c77-5799d3dd200c] | Price missing; [Link](https://www.notino.de/malibu-c/hard-water-wallness-tiefenreinigendes-shampoo/) | Set price 32.2 EUR from Notino; status `available`. |
| Bumble and bumble Sunday Clarifying Shampoo (Tiefenreinigungsshampoo) [6d6c3ff2-9d12-4f27-a56f-b5b72cf53318] | Price missing; [Link](https://www.notino.de/bumble-and-bumble/bb-sunday-shampoo-reinigendes-detox-shampoo/) | Set price 25.67 EUR from Notino; status `available`. |

## Reviewed Bucket 2 Outcome

| Product | Decision |
| --- | --- |
| K18 K18 Leave-In Molecular Repair Hair Mask [38dace91-0fba-49ee-a93f-ac36e488fe4b] | Brand-direct source approved; `k18hair.com` and `www.k18hair.com` added to URL gate allowlist. |
| Urban Alchemy Repair & Revive Leave-In Spray [45f4fe15-c439-476d-8a86-3b2aac5053bd] | Brand-direct source approved; `urban-alchemy.com` and `www.urban-alchemy.com` added to URL gate allowlist. |
| Urban Alchemy Smooth Supreme Öl Serum [5ad6c978-fd27-469e-9f26-ff3f05b9f67a] | Brand-direct source approved through the same Urban Alchemy allowlist update. |
| Wella Ultimate Repair Protective Leave-In [94cf6959-a53b-421b-9f0f-05efc239171c] | Brand-direct source approved; `wella.com` and `www.wella.com` added to URL gate allowlist. |
| Maria Nila True Soft Leave-In [3c769f60-283f-48c3-9549-cf84b73115d7] | No exact current buyable SKU found; row remains inactive and is marked `purchase_link_status = unavailable` rather than replaced with an already-existing Structure Repair duplicate. |
| Moroccanoil Clarifying Shampoo [caa94951-57d9-441d-bd46-5d7debbf365f] | Replaced Parfumdreams link with exact Notino shop link; price set to 29.00 EUR; status `available`. |
| got2b Trockenshampoo Extra Volumen [2b2161a2-6c09-435f-adbb-49da44d434ae] | Replaced deny-listed Geizhals link with exact Rossmann shop link; price set to 3.99 EUR; status `available`. |

## Reviewed Bucket 3A Outcome

| Product | Decision |
| --- | --- |
| OLAPLEX No.0 Intensive Bond Building Treatment [aadbbab5-bcf5-4b46-b38a-5533648bcb1d] | Switched to OLAPLEX DE brand-direct link; store regular brand price `30.00 EUR`; status `available`. |
| OLAPLEX No.3PLUS Complete Repair Treatment [3dc24d67-e6c0-4239-a273-058a87d13553] | Switched to OLAPLEX DE brand-direct link; store regular brand price `34.00 EUR`; status `available`. |
| Olaplex No.5 Leave-In [4827c174-92e9-4121-ab70-843d5c037ad0] | Keep OLAPLEX DE brand-direct link; store regular brand price `34.00 EUR` rather than temporary retailer sale price; status `available`. |
| Olaplex No.6 Bond Smoother [4e99706a-2232-4ee6-ba1b-9ca1029a7364] | Keep OLAPLEX DE brand-direct link; store regular brand price `32.00 EUR`; status `available`. |
| Olaplex No.7 Bonding Oil [7d8c0150-778d-4cb9-abf5-bfc16ad93b12] | Switched to OLAPLEX DE brand-direct link; store regular brand price `32.00 EUR`; status `available`. |
| Innersense Harmonic Treatment Oil [7f5207e6-d281-416e-922c-3135dd9a8cc8] | Switched to Douglas product page; price `29.99 EUR`; status `available`. |
| Davines SOLU Shampoo [d0936238-7412-40bc-ba7a-3c268f17d0f4] | Keep Davines DE brand-direct link and regular price `25.00 EUR`; mark `unavailable` because the brand page currently says `Ausverkauft`. |

## Reviewed Bucket 3B Outcome

| Product | Decision |
| --- | --- |
| Maria Nila Coils & Curls Oil in Cream [50951ef2-e16a-4a51-85c5-a709aa64c03a] | Switched to Flaconi product page; store Flaconi UVP `31.00 EUR`; status `available`. |
| Maria Nila Structure Repair Leave-In [695414e1-3435-4304-943b-76677408980c] | Switched to Flaconi product page; store Flaconi UVP `32.00 EUR`; status `available`. |
| Curlsmith Hydrate & Plump Leave-In [648ba537-5180-440e-81ad-2b310b447d87] | Switched to Curlsmith EU product page; store `25.00 EUR`; status `available`. |
| Curlsmith Weightless Air Dry Cream [8715f0f5-9104-46ec-b450-e73f1441c1fa] | Normalized to Curlsmith EU product page; store `25.00 EUR`; status `available`. |
| Nuxe Huile Prodigieuse Öl [5767f7a6-757c-40fa-b990-8e0a1abaea17] | Kept exact Nuxe DE brand-direct page; store `38.90 EUR`; status `available`. |
| Neqi Moisture Mystery [a7ff335a-7e81-4cf4-9c20-9209bff4386b] | Switched to exact Rossmann product page; store `8.99 EUR`; status `available`. |

## Reviewed Bondbuilder Null-Status Bucket

| Product | Decision |
| --- | --- |
| K18 Leave-In Molecular Repair Hair Mask [38dace91-0fba-49ee-a93f-ac36e488fe4b] | Switched to Douglas product page; store UVP `75.00 EUR`; status `available`. |
| OLAPLEX No.3 Hair Perfector [917786d2-cf02-43d4-8a9f-7f872528d581] | Switched from legacy OLAPLEX `.com` page to Douglas product page; store UVP `30.00 EUR`; status `available`. |
| Epres Bond Repair Treatment [f8a63590-9d80-454a-8008-e2a56321e64c] | Switched to exact German Epres starter-kit page; store `48.00 EUR`; status `available`. |

## Reviewed Tiefenreinigungsshampoo Null-Status Bucket

| Product | Decision |
| --- | --- |
| K18 PEPTIDE PREP Detox Shampoo [3f9328d8-1f6a-44e9-affd-fc219d1e691a] | Kept Douglas product page; store UVP `44.00 EUR`; status `available`. |
| Living Proof Clarifying Detox Shampoo [d105d245-5993-4b89-b45d-1bf0a86650e3] | Kept Douglas product page; store UVP `36.00 EUR`; status `available`. |
| OLAPLEX No.4C Bond Maintenance Clarifying Shampoo [1a6e731e-8fb2-43b4-9f4c-2d7f6dd06dca] | Kept Douglas product page; store OLAPLEX regular price `34.00 EUR`; status `available`. |
| OUAI Detox Shampoo [e937c8aa-fc99-4731-b848-e5bd988fcc17] | Kept Douglas product page; store 300 ml UVP `32.00 EUR`; status `available`. |

## Reviewed Trockenshampoo Null-Status Bucket

| Product | Decision |
| --- | --- |
| Balea Trockenshampoo Kopfhaut Sensitive [41e09958-5a1f-4997-b99b-f8384b7a8c0c] | Kept exact dm product page; store dm Dauerpreis `1.95 EUR`; status `available`. |
| Balea Trockenshampoo Schaum Kopfhaut Sensitive [27fe4310-c1b8-4b02-a59e-cb9aa1f3314a] | Kept exact dm product page; store dm Dauerpreis `1.45 EUR`; status `available`. |
| Batiste Trockenshampoo Blond [ff309c8a-ecd5-415c-9016-1b726c9fb3a4] | Kept exact dm product page; store dm Dauerpreis `3.95 EUR`; status `available`. |
| Batiste Trockenshampoo Bruenett [d28643c8-c340-4514-826a-6c1ac8419fe9] | Kept exact dm product page; store dm Dauerpreis `3.95 EUR`; status `available`. |
| Batiste Trockenshampoo dunkel [6a1116a0-731f-46bb-9dd6-a0db89de5a13] | Kept exact dm product page; store dm Dauerpreis `3.95 EUR`; status `available`. |
| Batiste Trockenshampoo Original [786a1396-914e-4739-a32c-1c3ead39a3d1] | Kept exact dm product page; store dm Dauerpreis `3.75 EUR`; status `available`. |
| Batiste Trockenshampoo Sensible Kopfhaut [57ec7a8e-aa1b-4260-81d6-7ec3dbc899b8] | Kept exact dm product page; store dm Dauerpreis `3.95 EUR`; status `available`. |
| got2b Trockenshampoo Liquid to Dry [dc8b8d4a-8ca9-452c-8d04-03b785b63275] | Kept exact dm page and store `3.95 EUR`; mark `unavailable` because dm and Mueller currently report not deliverable and Rossmann redirects away from the product. |
| ISANA Trockenshampoo Jedes Haar [b5b595d2-9ba3-4c99-8f99-b2b79d29eb56] | Kept exact Rossmann product page; store `1.99 EUR`; status `available`. |

## Reviewed Maske Null-Status Bucket

| Product | Decision |
| --- | --- |
| Alterra Haarkur Bio-Granatapfel & Bio-Aloe Vera [1568b623-f411-4ed6-a89f-e797bb1b48f5] | Replaced outdated Rossmann link with available Rossmann successor/exact-near product; store `2.79 EUR`; status `available`. |
| Balea 3 in 1 Intensivmaske [d5d67009-7aac-4299-938b-7218b8635a0c] | Kept dm product page; store `1.95 EUR`; status `available`. |
| Balea Natural Beauty 3in1 Locken [f212a8ff-0a03-404a-aad5-773d5bb6f7c9] | Kept dm product page; update stale price to `2.45 EUR`; status `available`. |
| Balea Natural Beauty reparierend [29fc985e-3b7e-4567-b7bc-b416583139fe] | Kept dm product page; store `2.45 EUR`; status `available`. |
| Balea Professional Plex Care 2in1 [9d7141bf-bb7e-41e8-a206-38ee5c42fdc6] | Normalized to canonical dm page/name; update price to `2.75 EUR`; status `available`. |
| Balea Professionel Plexcare [4417217b-2843-47aa-8815-04a125b08341] | Confirmed same product as Balea Professional Plex Care 2in1; marked inactive as merged duplicate, kept legacy name to satisfy the DB unique name/category constraint, set canonical dm link and `available`. |
| Balea Professional Glow & Shine [1f3920fe-c91e-4298-a40e-99dccd13ea30] | Kept dm product page; store `2.75 EUR`; status `available`. |
| Balea Aqua Hyaluron 3 in 1 [55727898-2a5e-4f01-ace1-bd91521d98ab] | Kept dm product page; update stale price to `2.75 EUR`; status `available`. |
| Bali Curls Deep Hydration Mask [d0e4bc78-2aeb-4e88-8abf-08aa28fbfba4] | Switched to exact Rossmann Deep Hydration product page matching the sheet name; store `8.99 EUR`; status `available`. |
| Bali Curls SOS Protein Treatment [43232fe6-28b6-4f45-a09f-b1354e47b0be] | Kept Rossmann product page; store `2.79 EUR`; status `available`. |
| Bali Curls Haarkur Bonding Repair Overnight Elixir [c4b9eaef-dfeb-41ea-9d28-9901660406b7] | Repurposed former extra Deep Repair row to match sheet alias `Balic Curls Bond Repair`; store dm price `9.95 EUR`; status `available`; product name intentionally omits size. |
| Fructis Hair Food Aloe Vera [52264c47-f339-49db-9fb2-207d1ad3b470] | Kept dm product page; store `5.95 EUR`; status `available`. |
| Fructis Hair Food Papaya [9e1442c9-4ab8-4819-a851-66859a98ed80] | Kept dm product page; store `5.95 EUR`; status `available`. |
| Gliss Aqua Revive [7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9] | No acceptable preferred-source replacement found; kept active and marked `unavailable`. |
| Gliss Liquid Silk Glanz 4-in-1 Bonding Haarmaske [d9825ad6-f549-4b02-a62a-eaa3bf917936] | Confirmed `Gliss`/`Glisskur` sheet names are the same product; kept one active canonical dm row at `5.75 EUR`, status `available`, and preserved silicone flag on the active row. |
| Glisskur Liquid Silk [4e76bb70-b521-48e1-9708-4edc48b17c73] | Marked inactive as merged duplicate, kept legacy name to satisfy the DB unique name/category constraint, set canonical dm link and `available`. |
| Guhl 30 sec. Feuchtigkeit [c7326c6b-6175-4ec2-865f-68baf476c986] | Kept dm product page; store `2.95 EUR`; status `available`. |
| Guhl Panthenol + Reparatur 2in1 Kur & Spülung [8ef172f7-8e95-4ac7-a6a9-235ad760155b] | Replaced currently unavailable dm link with preferred Mueller link; store `4.95 EUR`; status `available`. |
| Hask Argan Oil Repairing Deep Conditioner [7c057f58-3e9b-4347-b4c1-f04cc4213f94] | Replaced store-only Rossmann link with exact Hagel product page; store `2.95 EUR`; status `available`. |
| Isana 3in1 Milchprotein & Mandel [47795618-40e7-4ef6-8034-0fd8eb747575] | Fixed typo from `Michprotein`; Rossmann link is not a clean online buy state, so row stays active and is marked `unavailable`. |
| Remaining Maske rows | Existing dm/Rossmann preferred-source links were kept; prices/statuses were checked and set to binary `available`. |

## Reviewed Leave-in Null-Status Bucket

| Product | Decision |
| --- | --- |
| Alcina Hyaluron 2.0 [9b664b11-fd11-47e3-9b7e-76e34736b43e] | Sheet typo `Acina` is treated as alias; replaced Amazon link with exact Hagel product page; store Hagel normal price `14.90 EUR`; status `available`. |
| alverde Leave-In Sprühkur Express 7in1 [f9595d2c-d86d-4bdb-9758-c98d1e213f3c] | Kept exact dm product page; store `2.95 EUR`; status `available`. |
| Authentic Beauty Concept Hydrate Spray [43cb9fbf-4b04-4554-a86a-7cb168536233] | Replaced brand info page with exact Hagel product page; store `36.60 EUR`; status `available`. |
| Balea Aqua Hyaluron 3in1 [c6e80f39-20ba-401e-b041-6ee7c89a5996] | Kept dm 3in1 product page; update stale price to `2.75 EUR`; status `available`. |
| Cantu Leave-In Repair Cream [e3c4b607-8f81-462c-8a2b-e45c8b3a2976] | Confirmed as successor to `Leave-In Conditioning Repair Cream`; normalized active row to dm successor page; store `6.95 EUR`; status `available`. |
| Cantu Leave-In Repair Cream (legacy duplicate) [7db2bb60-0af6-4198-adec-28fad13251a6] | Marked inactive as merged duplicate; points at canonical dm successor link and `available` status to document the approved successor mapping without double-recommending it. |
| Color WOW Money Mist [11a099f7-eabe-4bdb-bfd3-995f35cb6ee4] | Kept Douglas product page; status `available`. |
| Curlsmith Multitasking Conditioner 3 in 1 [2bafeb7e-6610-4efc-a8e8-a402071b2ed9] | Kept Douglas product page and accepted user-confirmed available state; status `available`. |
| Elvital Öl Magique Midnight Serum [6b01025d-9e72-4514-b42e-bbb6065fbe1c] | Sheet alias `Elvital Öl Magique Serum` maps to current DB product; kept dm page; status `available`. |
| EVO Day of Grace Leave-In [b139d4e8-6f26-4096-a1b9-d9efcb02d2ec] | Replaced Amazon link with exact Hagel page; store Hagel normal price `28.00 EUR`; status `available`. |
| EVO Happy Campers [42b9eba7-d0e3-4d02-ae2b-7a1612a561fe] | Kept Douglas product page; status `available`. |
| EVO Head Mistress [118ebae1-b7a9-4a89-a2ff-6c31df28c4dc] | Kept Douglas product page; status `available`. |
| Garnier Hair Food Aloe Vera [0307c903-84f9-46b4-8f1f-a51c2b1f38ff] | Kept dm 3in1 product page; status `available`. |
| Garnier Hair Food Macadamia [a72d630d-547a-465f-9846-3006b38af0a2] | Kept dm 3in1 product page; status `available`. |
| HASK Keratin 5-in-1 Spray [5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3] | Replaced stale dm link with exact Hagel product page; store `7.95 EUR`; status `available`. |
| Isana Feuchtigkeits Leave-In (Hyaluron) [0b21f996-bb42-4b10-89bd-4881c4346d53] | Kept Rossmann product page; status `available`. |
| It’s a 10 Miracle Leave-In [696401be-16b5-4261-836f-28b57c1ecd59] | Replaced Amazon link with exact Hagel page; only regular exact Hagel SKU found was `295.7 ml`; store normal price `44.00 EUR`; status `available`. |
| It’s a 10 Miracle Leave-In Lite [7d65ed50-898c-40c3-8865-ebe5688774c8] | Replaced Amazon link with exact Hagel page; store normal price `23.00 EUR`; status `available`. |
| K18 Hair Professional Molecular Repair Hair Mist [8f84eae5-222d-4bbf-9ab0-f30361882a95] | Kept Douglas product page; status `available`. |
| Kevin Murphy Young Again [6ad82861-d68e-4e70-a976-78c0f35d087b] | Replaced Amazon link with exact Hagel `Young.Again. Leave-In Treatment 100 ml`; store `43.00 EUR`; status `available`. |
| Living Proof Restore Repair Leave-In [0756a919-5fab-4b6c-a5da-8cb810869b6f] | Sheet alias `Restore Instant Repair` maps to current Douglas product row; status `available`. |
| Maria Nila Structure Repair [996eaa2a-ea4c-4dfb-b455-2782e82d9a44] | Confirmed duplicate of `Maria Nila Structure Repair Leave-In`; marked inactive and pointed at the canonical Flaconi source with `32.00 EUR`, status `available`. |
| Maria Nila Structure Repair Leave-In [695414e1-3435-4304-943b-76677408980c] | Existing canonical Flaconi row stays active and `available`. |
| Maria Nila True Soft Leave-In [3c769f60-283f-48c3-9549-cf84b73115d7] | Still no exact buyable SKU found; remains inactive and `unavailable`. |
| Moroccanoil All In One Leave In Conditioner [7a3d1d99-2ff4-49b9-b021-d5ec2bdb0fe6] | Kept Douglas product page; status `available`. |
| Neqi Build Boost Leave-In Balm [9f94c225-61ec-455d-b303-f39e885e222a] | Added as new Sheet product for `NEQI x @_the.beautiful.people Leave-In`; exact NEQI brand-shop title is `Build Boost Leave-In Balm`; store `9.95 EUR`; status `available`; `neqi-hair.com` allowlisted as reviewed brand source. |
| Neqi Moisture Mystery [e6896862-523b-42b3-967d-41cbd16acf64] | Existing Leave-in row remains active with dm page and status `available`; it is not the same as the new `NEQI x THE BEAUTIFUL PEOPLE` product. |
| OUAI Leave In Conditioner [993f0e55-2450-4557-853d-e6e23ec0d1a9] | Kept Douglas product page; status `available`. |
| Pantene Bonding Leave-In [35a372b6-c7ef-45cb-be0b-99cef476f247] | Kept dm product page; status `available`. |
| Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW [e781ca9e-886d-40a1-bfe1-48177cfbf381] | Replaced old not-deliverable `Milk-to-Water` row as the current practical match for Sheet alias `Pantene Hydra Glow Leave-In`; kept preferred dm page; store `8.95 EUR`; status `available`. |
| Pantene Pro-V Miracles 7in1 Haaröl Spray [f8f3b51d-8e64-487d-bad5-4a47c58862ed] | Replaced not-deliverable dm link with exact Rossmann product page; store `8.99 EUR`; status `available`. |
| Pantene Pro-V Keratin Protect 10-in-1 Spray | Sheet deviation only; not added because it appears outdated and no close-enough exact German replacement was found. Existing `Pantene Pro-V Keratin Protect Öl` remains in `Öle`. |
| Paul Mitchell Full Circle Leave-In [915aa362-6479-41f2-bb59-0260493b3d58] | Replaced Amazon link with exact Hagel product page; store `26.45 EUR`; status `available`. |
| Redken Acidic Color Gloss Leave-In [a3b21686-fe35-46f1-b560-b8a563dc96ae] | Kept Douglas product page; status `available`. |
| Redken All Soft Mega Curls Leave-In [0d5a4af5-d046-4378-b608-515c9d1d66ec] | Kept Douglas product page; status `available`. |
| Redken Extreme Anti-Snap [2b7db7e3-2058-4178-8a03-7d05f4a1d447] | Kept Douglas product page; status `available`. |
| Redken One United [39ec1b2d-4aa0-4c4e-b581-9b6d5efea530] | Kept Douglas product page; status `available`. |
| Urban Alchemy Repair & Revive Leave-In Spray [45f4fe15-c439-476d-8a86-3b2aac5053bd] | Kept exact brand-shop product page because Hagel did not surface the exact SKU; status `available`. |
| Urban Alchemy Smooth Supreme Öl Serum [5ad6c978-fd27-469e-9f26-ff3f05b9f67a] | Sheet lists it under Leave-in, but product stays in `Öle`; do not duplicate across categories in this pass. |
| Wella Ultimate Repair Protective Leave-In [94cf6959-a53b-421b-9f0f-05efc239171c] | Kept approved Wella brand page; status `available`. |

## Reviewed Öle Null-Status Bucket

| Product | Decision |
| --- | --- |
| Balea Pflegeöl Natural Beauty [4f373d4f-fef8-4434-91c7-055133d8427f] | Sheet alias `Balea Natural Beauty Bio-Argan Haaröl` maps to current dm product name; switched to canonical dm page; store `2.45 EUR`; status `available`. |
| Balea Oil Repair Haaröl [1c43bc07-e3c6-4b8a-9b62-943147052e07] | Switched to canonical dm page; store `2.75 EUR`; status `available`. |
| Balea Traumlocken Öl [fd83b493-f7be-4071-9642-3d5b92e30dc2] | Switched to canonical dm page; store `2.75 EUR`; status `available`; removed silicone flag because dm currently states `Ohne Silikone`. |
| Generic pure oils | Approved workflow: when the sheet names only the oil type, choose one stable preferred-source SKU rather than preserving arbitrary old Amazon brands. |
| Cacayöl [78e6f1b2-7262-46af-b689-a92af6702739] | Replaced Amazon with NUTREEOIL brand-direct `Cacay Öl`; store `34.99 EUR`; status `available`. |
| Rizinusöl, Aprikosenkernöl, Mandelöl, Macadamiaöl | Replaced Amazon rows with corresponding benecos/Müller pure-oil SKUs; store normal full prices; status `available`. |
| Avocadoöl [ff13bc3a-8bc6-49df-85a0-7a67add26926] | Replaced Amazon with Rossmann `NANOIL Avocadoöl`; store `12.99 EUR`; status `available`. |
| Arganöl [70ea52bc-2194-4bb3-82a8-3f4a2aede041] | Replaced Amazon with Müller `Dr. Scheller Reines Arganöl`; store `8.95 EUR`; status `available`. |
| Moringaöl [38886b62-2c45-4b34-9a24-7d831e97946e] | Replaced Amazon with exact Shop Apotheke `MoriVeda Premium Moringaöl`; store `16.99 EUR`; status `available`; `shop-apotheke.com` approved as rare-oil fallback and allowlisted. |
| Traubenkernöl [517dca50-5d55-4038-ba1d-f9b745708327] | Replaced Amazon with Müller `Allgäuer Ölmühle Bio Traubenkernöl`; store `7.99 EUR`; status `available`. |
| Distelöl [29e36443-93ff-4b62-9cf0-55ad9f89f530] | Replaced Amazon with Müller `BioGourmet Distelöl`; store `5.99 EUR`; status `available`. |
| Kokosöl [acf9d5cd-76e4-49c7-9c04-0af1f20506ad] | Replaced Amazon with dmBio Kokosöl nativ; store `2.85 EUR`; status `available`. |
| HASK Argan Oil Repairing Shine Oil [b916efff-8b80-47d4-82cf-d8148d1eff53] | Replaced Amazon with exact Hagel product page; store `2.95 EUR`; status `available`. |
| Maria Nila True Soft Argan Oil [7b5ff358-1b3b-411d-9220-5e6d30543235] | Replaced brand global link with exact Hagel 100 ml product page; store normal full price `37.00 EUR`; status `available`. |
| OGX Bond Protein Repair [c320750f-6a1e-420d-8594-409f04e05319] | No preferred-source exact replacement found; user approved keeping exact Amazon link; status `available`. |
| Shiseido Fino Premium Touch Penetrating Hair Oil Essence [663acf09-7090-40d8-9411-71154b9d60f3] | No preferred-source exact replacement found; user approved keeping exact Amazon link; status `available`. |
| Remaining Öle rows | Existing dm/Rossmann/Müller/Douglas/brand-direct links were kept or canonicalized; prices/statuses were checked and set to binary `available`. |

## Reviewed Conditioner Null-Status Bucket

| Product | Decision |
| --- | --- |
| Cantu Leave-In Repair Cream [7539ab79-f4f6-49d7-9269-08034ef4de96] | Kept active in `Conditioner (Drogerie)` because the exact dm product is a 3in1 leave-in/mask/conditioner; the already-reviewed `Leave-in` row stays active too. Updated to the canonical dm page, `6.95 EUR`, status `available`. |
| Cantu Conditioner Cream [d8ac8909-91a1-46b3-9fa6-2ff66b78fb66] | Kept as the separate rinse-out conditioner SKU; updated to canonical dm page, `6.95 EUR`, status `available`. |
| OGX Renewing Argan Oil of Morocco Conditioner [c2d7eb89-9a2e-4476-bb89-c0f33a2aa501] | Merged the normal-hair and thick-hair sheet placements into one active Conditioner row with `suitable_thicknesses = ['normal', 'coarse']`; updated to canonical dm page, `6.95 EUR`, status `available`. |
| OGX Renewing Argan Oil of Morocco Conditioner (legacy duplicate) [7bd5f94a-fb02-4505-a53a-2b100c265a5b] | Marked inactive as merged duplicate so the same SKU does not double-recommend inside Conditioner; retained canonical link/status for audit traceability. |
| Nivea Volumen & Kraft [26985fdd-1b41-46e3-9c9a-94b98f92310a] | No exact currently buyable dm/Rossmann/Müller/Hagel replacement found for the conditioner; kept active but marked `purchase_link_status = unavailable`. |
| Guhl Bond+ Reparatur Spülung [9f8da740-87b6-45e0-ab86-d77d63f2e22b] | Exact product confirmed on Guhl; preferred shops did not surface a current buyable page, so user approved exact Amazon backup link. Store stable reference price `5.99 EUR`; status `available`. |
| Guhl Panthenol + Reparatur 2in1 Kur & Spülung [11d42d9d-b8d8-42ae-a432-9a3d0f9d3504] | Already corrected earlier; refreshed description to remove the literal sheet marker `*` and keep Müller link/status. |
| Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung [5516009a-eecb-42dd-87f6-07c560161136] | Sheet alias `Garnier Wahre Schätze Aloe Vera Spülung` treated as reviewed substitution; switched to Rossmann exact Hair Food Aloe Vera conditioner page, `3.99 EUR`, status `available`. |
| Garnier Hair Food Macadamia [4c3e1a63-4696-406a-be67-f2aacc678b0c] | Added as a separate `Conditioner (Drogerie)` row because the exact dm 3in1 product can be used as `Spülung`, `Maske`, or `Leave-In`; existing `Leave-in` row [a72d630d-547a-465f-9846-3006b38af0a2] stays active. Store `5.95 EUR`; status `available`. |
| Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung [8c3eda97-5009-40bb-959b-1a7d90f48b09] | Kept existing product row but switched from brand info page to exact Rossmann shop page, `2.49 EUR`, status `available`; not merged with `Garnier Hair Food Macadamia` because it is a different line/SKU. |
| Remaining Conditioner rows | Existing preferred dm/Rossmann links were kept or canonicalized; prices/statuses were checked and set to binary `available`. |

## Reviewed Shampoo Null-Status Bucket

| Product | Decision |
| --- | --- |
| Sebamed Every-Day Shampoo [e7bfd306-b128-4735-a9f8-0eeacdbd5013] | Replaced Amazon link with exact Rossmann 200 ml page; store `3.99 EUR`; status `available`. |
| Balea Ultra Sensitive [a79513be-e34b-4a1e-b7eb-b3d4b58160be] | Kept dm product page; refreshed price to `1.75 EUR`; status `available`. |
| Balea Aqua Hyaluron [ead1333b-6839-464d-b272-673d39bb95a4] | Switched to canonical dm product id page; refreshed price to `1.25 EUR`; status `available`. |
| Balea Professional Ultimate Volume [d01de47e-e360-4b31-9924-e3e5bc31ccdc] | Sheet alias `Balea Professional Ultra Volume` maps to this current production row; refreshed price to `1.25 EUR`; status `available`. |
| Balea Tiefenreinigung [0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c] | Kept dm product page; refreshed price to `1.25 EUR`; status `available`. |
| Balea Kopfhaut Sensitive Shampoo [eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d] | Kept canonical dm product id page; refreshed price to `1.25 EUR`; status `available`. |
| Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege [088b1427-ed22-424e-8cfd-ea2578120ae6] | User-confirmed sheet aliases `Derma X Aloe` and `Derma X Pro Beruhigend` represent the same actual shampoo; kept one active dm row, `4.95 EUR`, status `available`, covering fine and thick hair schuppen placements. |
| Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege [4fd5f4c3-83b2-4893-be8c-ada29b8ca718] | Reviewed retailer identifier maps to a scalp mask / non-shampoo product; marked inactive and `unavailable` rather than recommending it from the Shampoo matrix. |
| Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege [d408aca9-cd16-4cb0-90e7-bab26a698000] | Switched from currently unavailable dm page to exact Rossmann product page; store `4.99 EUR`; status `available`; covers the separate user-confirmed sheet alias `Derma X Pro Sensitive`. |
| Guhl Kraft & Fülle [9bfad335-a086-45a0-9af7-f26b36b4ecff] | Switched to canonical dm product id page; store `4.99 EUR`; status `available`. |
| Monday Haircare Volume Kraft & Fülle Shampoo [6dc65df2-2466-43e4-bdc2-3a05803f305c] | Kept Flaconi preferred-shop page; store stable Flaconi UVP `8.95 EUR` instead of temporary promo price; status `available`. |
| Head & Shoulders Anti Schuppen Sensitive [716a4f4e-6ba4-4742-a1cf-75e90ae1da3f] | Switched to canonical dm product id page; refreshed price to `3.95 EUR`; status `available`. |
| Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege (legacy duplicate) [686df4f6-4e8f-48e7-b823-5b1e89dd9cf2] | Marked inactive as a duplicate after domain review confirmed `Derma X Aloe` and `Derma X Pro Beruhigend` are the same actual product; retained canonical dm link/status for audit traceability. |
| Remaining Shampoo rows | Existing preferred dm/Rossmann links were kept; prices/statuses were checked and set to binary `available`. |

## Initial Other Non-Image Findings

| Finding | Product | Current link | Price | Detail |
| --- | --- | --- | --- | --- |
| unapproved_host | K18 K18 Leave-In Molecular Repair Hair Mask (Bondbuilder) [38dace91-0fba-49ee-a93f-ac36e488fe4b] | [Link](https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-50-ml) | 75 | Unapproved host `www.k18hair.com`: host www.k18hair.com is not on allowlist and does not match brand-direct rule |
| suspicious_name_marker, stale_price | Guhl Guhl Panthenol* (Conditioner (Drogerie)) [11d42d9d-b8d8-42ae-a432-9a3d0f9d3504] | [Link](https://www.rossmann.de/de/pflege-und-duft-guhl-panthenol--reparatur-2in1-kur-und-spuelung/p/4072600703403) | 3.99 | Name contains marker `*`; Stored 3.99 EUR vs expected 4.95 EUR ([source](https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/)) |
| stale_price | Gliss Gliss Ultimate Repair Spülung (Conditioner (Drogerie)) [5dc2fae3-a0ca-4e6c-9c30-02dd192772f0] | [Link](https://www.dm.de/schwarzkopf-gliss-kur-spuelung-express-repair-ultimate-repair-p4015100339642.html) | 2.79 | Stored 2.79 EUR vs expected 4.49 EUR ([source](https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-express-repair-spuelung/p/4015100813494)) |
| missing_affiliate_link | Maria Nila Maria Nila True Soft Leave-In (Leave-in) [3c769f60-283f-48c3-9549-cf84b73115d7] |  | 22 | Missing or invalid affiliate link |
| unapproved_host | Urban Alchemy Urban Alchemy Repair & Revive Leave-In Spray (Leave-in) [45f4fe15-c439-476d-8a86-3b2aac5053bd] | [Link](https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml) | 22.9 | Unapproved host `urban-alchemy.com`: host urban-alchemy.com is not on allowlist and does not match brand-direct rule |
| stale_price | Olaplex Olaplex No.5 Leave-In (Leave-in) [4827c174-92e9-4121-ab70-843d5c037ad0] | [Link](https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner) | 19.65 | Stored 19.65 EUR vs expected 34 EUR ([source](https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner)) |
| unapproved_host | Wella Professionals Wella Ultimate Repair Protective Leave-In (Leave-in) [94cf6959-a53b-421b-9f0f-05efc239171c] | [Link](https://www.wella.com/professional/de-DE/products/haarpflege/ultimate-repair/ultimate-repair-protective-leave-in) | 18.51 | Unapproved host `www.wella.com`: host www.wella.com is not on allowlist and does not match brand-direct rule |
| unapproved_host | Urban Alchemy Urban Alchemy Smooth Supreme Öl Serum (Öle) [5ad6c978-fd27-469e-9f26-ff3f05b9f67a] | [Link](https://urban-alchemy.com/products/smooth-supreme-ol-serum-75ml) | 22.9 | Unapproved host `urban-alchemy.com`: host urban-alchemy.com is not on allowlist and does not match brand-direct rule |
| missing_price | L'Oreal Professionnel Serie Expert Metal DX Shampoo (Tiefenreinigungsshampoo) [514ffd65-e4a5-4f7f-96c5-0f194e3b3b36] | [Link](https://www.douglas.de/de/p/5011380000) |  | Missing price |
| missing_price | Malibu C Hard Water Wellness Shampoo (Tiefenreinigungsshampoo) [6513692a-b54f-4acc-9c77-5799d3dd200c] | [Link](https://www.notino.de/malibu-c/hard-water-wallness-tiefenreinigendes-shampoo/) |  | Missing price |
| missing_price | Bumble and bumble Sunday Clarifying Shampoo (Tiefenreinigungsshampoo) [6d6c3ff2-9d12-4f27-a56f-b5b72cf53318] | [Link](https://www.notino.de/bumble-and-bumble/bb-sunday-shampoo-reinigendes-detox-shampoo/) |  | Missing price |
| missing_price | Redken Hair Cleansing Cream Shampoo (Tiefenreinigungsshampoo) [a1d705b4-b973-486d-b853-2c795b6db681] | [Link](https://www.douglas.de/de/p/5010218791) |  | Missing price |
| unapproved_host | Moroccanoil Clarifying Shampoo (Tiefenreinigungsshampoo) [caa94951-57d9-441d-bd46-5d7debbf365f] | [Link](https://www.parfumdreams.de/Moroccanoil/Haarpflege/Pflege/Clarifying-Shampoo/index_42428.aspx) | 23.49 | Unapproved host `www.parfumdreams.de`: host www.parfumdreams.de is not on allowlist and does not match brand-direct rule |
| denylisted_host | got2b Trockenshampoo Extra Volumen (Trockenshampoo) [2b2161a2-6c09-435f-adbb-49da44d434ae] | [Link](https://geizhals.de/got2b-trockenwaesche-extra-volumen-trockenshampoo-a2375994.html) | 3.95 | Denylisted host `geizhals.de`: host geizhals.de is denylisted (aggregator or wrong marketplace) |

## Fetch-Classified Unavailable Links

These are not automatically corrected yet. They need manual confirmation or replacement-source lookup before a binary full-catalog backfill.

| Product | Current link | Price |
| --- | --- | --- |
| OLAPLEX OLAPLEX No.3PLUS Complete Repair Treatment (Bondbuilder) [3dc24d67-e6c0-4239-a273-058a87d13553] | [Link](https://olaplex.com/products/n-3plus-complete-repair-treatment) | 34 |
| OLAPLEX OLAPLEX No.0 Intensive Bond Building Treatment (Bondbuilder) [aadbbab5-bcf5-4b46-b38a-5533648bcb1d] | [Link](https://olaplex.com/products/olaplex-n-0-intensive-bond-building-treatment-us) | 34 |
| Maria Nila Maria Nila True Soft Leave-In (Leave-in) [3c769f60-283f-48c3-9549-cf84b73115d7] |  | 22 |
| Olaplex Olaplex No.5 Leave-In (Leave-in) [4827c174-92e9-4121-ab70-843d5c037ad0] | [Link](https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner) | 19.65 |
| Olaplex Olaplex No.6 Bond Smoother (Leave-in) [4e99706a-2232-4ee6-ba1b-9ca1029a7364] | [Link](https://olaplex.de/products/olaplex-no-6-bond-smoother) | 24 |
| Maria Nila Maria Nila Coils & Curls Oil in Cream (Leave-in) [50951ef2-e16a-4a51-85c5-a709aa64c03a] | [Link](https://marianila.com/products/coils-curls-oil-in-cream) | 22.15 |
| Curlsmith Curlsmith Hydrate & Plump Leave-In (Leave-in) [648ba537-5180-440e-81ad-2b310b447d87] | [Link](https://curlsmith.com/products/hydrate-plump-leave-in) | 24.95 |
| Maria Nila Maria Nila Structure Repair Leave-In (Leave-in) [695414e1-3435-4304-943b-76677408980c] | [Link](https://marianila.com/products/structure-repair-leave-in-cream-200-ml) | 31 |
| Curlsmith Curlsmith Weightless Air Dry Cream (Leave-in) [8715f0f5-9104-46ec-b450-e73f1441c1fa] | [Link](https://de.curlsmith.com/products/weightless-air-dry-cream) | 24.95 |
| Nuxe Nuxe Huile Prodigieuse Öl (Öle) [5767f7a6-757c-40fa-b990-8e0a1abaea17] | [Link](https://de.nuxe.com/products/wichtiger-ol%C2%AE-1) | 26.94 |
| Maria Nila Maria Nila True Soft Argan Oil (Öle) [7b5ff358-1b3b-411d-9220-5e6d30543235] | [Link](https://marianila.com/products/true-soft-argan-oil-100-ml) | 14.88 |
| Olaplex Olaplex No.7 Bonding Oil (Öle) [7d8c0150-778d-4cb9-abf5-bfc16ad93b12] | [Link](https://olaplex.com/products/no-7-bonding-oil) | 23.99 |
| Innersense Innersense Harmonic Treatment Oil (Öle) [7f5207e6-d281-416e-922c-3135dd9a8cc8] | [Link](https://innersensebeauty.com/products/harmonic-treatment-oil) | 30 |
| Neqi Neqi Moisture Mystery (Shampoo) [a7ff335a-7e81-4cf4-9c20-9209bff4386b] | [Link](https://en.neqi-hair.com/products/moisture-mystery-shampoo) | 9.95 |
| Davines SOLU Shampoo (Tiefenreinigungsshampoo) [d0936238-7412-40bc-ba7a-3c268f17d0f4] | [Link](https://de.davines.com/products/solu-shampoo) | 25 |

## Workflow Implication

The current lightweight fetch audit is good for surfacing obvious issues and known-price drift, but it is not enough to classify the full catalog into binary `available`/`unavailable`: 216 of 237 link checks were inconclusive because retailer/brand pages often return JS-heavy, bot-protected, or non-decisive content. For the full binary backfill we need either manual review of the proposal rows or a stronger retailer-specific/browser/API check step.

## Generated Raw Files

- `tmp/product-metadata-audit/product-metadata-audit.json`
- `tmp/product-metadata-audit/product-metadata-audit.csv`
- `tmp/product-metadata-audit/purchase-link-review-proposal.json`
- `tmp/product-metadata-audit/purchase-link-review-proposal.csv`
