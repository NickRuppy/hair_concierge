# HAI-124 Sheet Alias Review

Date: 2026-06-11

Purpose:

- Capture where the Google Sheet `Produklisten` uses short, typo-prone, or legacy product names that differ from production product names.
- Treat the sheet as the updated product-list source of truth, while avoiding accidental duplicate products when production already contains the intended SKU under a corrected name.
- Keep this as a human review artifact. It is not a migration by itself.

## Naming Policy

- Prefer clean user-facing production names.
- Use exact retailer/official SKU names when needed to disambiguate the product.
- Preserve common sheet aliases in review docs or an alias table instead of forcing every display name to match the sheet wording.
- If a sheet row points to a successor product rather than the literal old product, mark that explicitly.

## Drogerie Rows: Probably Covered Under Different Names

| Sheet product | Production row | Review note |
| --- | --- | --- |
| `Head & Shoulders Derma X Aloe` | `Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege` | user-confirmed alias for the Beruhigende Pflege shampoo |
| `Head & Shoulders Derma X Pro Beruhigend` | `Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege` | same actual product as `Derma X Aloe`; merged into one active Shampoo row |
| `Head& Shoulder Derma X Pro Sensitive` | `Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege` | sheet spacing/brand typo; separate Sensitive Pflege shampoo |
| `Sebamed Everyday` | `Sebamed Every-Day Shampoo` | spelling/style deviation |
| `Pantene Volume Pur` | `Pantene Pro-V Volumen Pur` | brand line added |
| `Balea Professional Ultra Volume` | `Balea Professional Ultimate Volume` | likely sheet shorthand/typo |
| `Monday Volume` | `Monday Haircare Volume Kraft & Fülle Shampoo` | production has fuller German SKU |
| `Cantu Lockenshampoo` | `Cantu Shampoo Locken Pflege` | production has retailer-style SKU |
| `Shampoo Curl Care` | `Hask Curl Care Shampoo` | sheet omitted brand |
| `Garnier Wahre Schätze Aloe Vera Spülung` | `Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung` | reviewed substitution; current exact Hair Food Aloe Vera conditioner exists at Rossmann |
| `OGX Keratin & Protein` | `OGX Bond Protein Repair Conditioner` | reviewed substitution; current exact OGX Bond Protein Repair conditioner exists at dm |
| `Balic Curls Bond Repair` | `Bali Curls Haarkur Bonding Repair Overnight Elixir` | sheet typo; reviewed Maske decision uses the current dm bonding-repair SKU and omits size from the display name |
| `Nequi Build & Boost` | `Neqi Build Boost` | spelling/style deviation |
| `Haarkur Lamination Intense Glaze` | `Syoss Haarkur Lamination Intense Glaze` | sheet omitted brand |

## Reviewed Leave-In / Oil Alias Decisions

| Sheet product | Current catalog state | Review note |
| --- | --- | --- |
| `Maria Nila True Soft Leave-In` | inactive | intentionally cut previously because no viable leave-in SKU was found |
| `Gliss Ultimate Repair Spülung` | `Gliss Ultimate Repair Sprüh-Conditioner` in `Leave-in` | moved from conditioner to leave-in using the current spray conditioner SKU |
| `Pantene Pro-V Keratin Protect 10-in-1 Spray` | not added | outdated/hard-to-find product; existing `Pantene Pro-V Keratin Protect Öl` remains in `Öle`, but no close-enough Leave-in substitute was forced |
| `Pantene Hydra Glow Leave-In` | `Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW` | old `Milk-to-Water` row was not deliverable; reviewed replacement uses current dm Heat & Glow leave-in |
| `Living Proof Restore Instant Repair` | `Living Proof Restore Repair Leave-In` | renamed row |
| `Curlsmith Weightless Protein Leave-In Conditioner` | `Curlsmith Weightless Air Dry Cream` | successor/substitution |
| `Urban Alchemy Smooth Serum` | `Urban Alchemy Smooth Supreme Öl Serum` | production row lives in `Öle` |
| `NEQI x @_the.beautiful.people Leave-In` | `Neqi Build Boost Leave-In Balm` | new product added from NEQI brand shop; exact collection/product title differs from sheet alias |
| `Cantu Leave-In Conditioning Repair Cream` / `Cantu Leave-In Repair Cream` | `Cantu Leave-In Repair Cream` | reviewed as successor/duplicate; one active dm row kept, legacy duplicate inactive |
| `Maria Nila Structure Repair` / `Maria Nila Structure Repair Leave-In` | `Maria Nila Structure Repair Leave-In` | duplicate row merged into one active canonical Flaconi row |
| `Balea Natural Beauty Bio-Argan Haaröl` | `Balea Pflegeöl Natural Beauty` | successor/substitution; current dm name no longer contains Bio-Argan |
| `Shiseido Fino Oil` | `Shiseido Fino Premium Touch Penetrating Hair Oil Essence` | fuller canonical SKU |
| `Garnier Fructis Sleek & Stay Öl` | `Garnier Fructis Sleek & Stay Heat-Activated Serum` | successor/substitution; category semantics need review |
| pure oil names such as `Rizinusöl`, `Mandelöl`, `Kokosöl` | reviewed dm/Rossmann/Müller pure-oil SKUs | sheet names oil type rather than brand; approved workflow chooses one stable preferred-shop SKU per oil type |
| `Balea Traumlocken Öl (Silikone)` | `Balea Traumlocken Öl` | sheet silicone marker removed from production metadata because dm currently states `Ohne Silikone` |

## Reviewed Conditioner Alias Decisions

| Sheet product | Current catalog state | Review note |
| --- | --- | --- |
| `Cantu Repair Cream (Kokos)` | `Cantu Leave-In Repair Cream` in `Conditioner (Drogerie)` and `Leave-in` | same dm 3in1 SKU can be used as leave-in, mask, or conditioner; keep separate category rows because products have one primary category |
| `Cantu Conditioner Cream (Kokos)` | `Cantu Conditioner Cream` | separate rinse-out conditioner SKU; do not merge with the 3in1 repair cream |
| `OGX Renewing Argan Oil (Silikone / Kokos)` / `OGX Renewing (Silikone / Kokos)` | `OGX Renewing Argan Oil of Morocco Conditioner` | same SKU; one active Conditioner row now covers normal and thick hair placements, duplicate row inactive |
| `Niveal Volumen & Kraft` | `Nivea Volumen & Kraft` | sheet typo; exact conditioner kept active but marked shop-link unavailable |
| `Guhl Bond+ (Silikone)` | `Guhl Bond+ Reparatur Spülung` | exact Guhl product confirmed; preferred shops unavailable, user approved exact Amazon backup link |
| `OGC\`X Biozon /\`& Collagen` | `OGX Biotin & Collagen Conditioner` | sheet typo; canonical dm product name used |
| `Isana Professinal Argan` | `Isana Professional Arganöl & Pflege Spülung` | sheet typo; canonical Rossmann product name used |
| `Garnier Hair Food Macadamia (Kokos)` | `Garnier Hair Food Macadamia` in `Conditioner (Drogerie)` and `Leave-in` | exact dm 3in1 product can be used as Spülung, Maske, or Leave-In; keep separate category rows and do not merge with `Wahre Schätze Kokosmilch & Macadamia` |

## High-End Scope

The `HiE-*` tabs are mostly absent from the active production catalog. This should be treated as a scope decision, not an alias issue:

- If high-end/profi products are in current beta scope, this is a large catalog expansion gap.
- If current beta scope is drogerie-first, the `HiE-*` rows should become future backlog input.

## Review Workflow

1. Compare each relevant sheet tab against active production products.
2. Classify each non-exact name as `alias`, `successor`, `category_move`, `inactive_cut`, or `missing`.
3. Add reviewed aliases here before applying data migrations.
4. Use id-based updates for existing products.
5. Create new product rows only when no active or inactive production row represents the intended product.
