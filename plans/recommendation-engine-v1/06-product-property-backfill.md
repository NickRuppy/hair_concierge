# Product Property Backfill

## Status

As of 2026-04-16, the V1 product-property backfill is complete in the live database for all categories that currently have live catalog products:

- `conditioner`
  - `product_conditioner_rerank_specs`: `43` rows
  - `balance_direction` populated on `43/43` rows
- `mask`
  - `product_mask_specs`: `35` rows
  - `balance_direction` populated on `35/35` rows
- `leave_in`
  - `product_leave_in_specs`: `42` rows
  - canonical mirror table `product_leave_in_fit_specs`: `42` rows
- `shampoo`
  - `product_shampoo_specs`: `53` rows
  - `scalp_route` populated on `53/53` rows
  - `cleansing_intensity` populated on `53/53` rows
- `oil`
  - `product_oil_eligibility`: `45` rows
  - `oil_purpose` populated on `45/45` rows

Structured storage is in place for these support categories, but the live catalog is still empty there:

- `bondbuilder`: `0` rows in `product_bondbuilder_specs`
- `deep_cleansing_shampoo`: `0` rows in `product_deep_cleansing_shampoo_specs`
- `dry_shampoo`: `0` rows in `product_dry_shampoo_specs`
- `peeling`: `0` rows in `product_peeling_specs`

Current engine behavior while those rows are still missing:
- support-category selection is already wired into the new engine path
- empty support-category spec tables do not break the app
- the selectors simply return no products until the catalog/spec rows are populated

## Goal

Define the minimum structured product properties required to drive deterministic `category_fit` in V1 and reduce `category_fit = unknown` as close to zero as possible.

## Guiding Rule

For V1, we only keep properties that materially affect:
- relevance
- fit
- conflict
- replacement vs keep decisions

Anything else stays secondary metadata or copy context.

## Where To Populate Them Today

Until we do the storage cleanup pass, populate these properties in the existing category-specific product spec rows:

- `conditioner`
  - table: `product_conditioner_rerank_specs`
  - current admin flow already writes: `weight`, `repair_level`
  - `balance_direction` is now live here too
- `leave_in`
  - table: `product_leave_in_specs`
  - source metadata still lives here
  - the engine can already derive most V1 fit signals from:
    - `weight`
    - `roles`
    - `care_benefits`
    - `provides_heat_protection`
    - `application_stage`
  - canonical mirror table also exists now:
    - `product_leave_in_fit_specs`
  - live engine selection now reads the canonical fit mirror for ranking
- `mask`
  - table: `product_mask_specs`
  - current admin flow already writes: `weight`, `concentration`
  - engine currently treats `concentration` as the temporary proxy for `repair_level`
  - `balance_direction` is now live here too
- `shampoo`
  - current structured routing lives in `product_shampoo_specs` / `shampoo_bucket_pairs`
  - shampoo remains source-managed for now
  - `scalp_route` and `cleansing_intensity` are now live on `product_shampoo_specs`
  - current engine selection still uses the bucket matcher path for candidate retrieval
  - live reranking now also reads backfilled `cleansing_intensity` from `product_shampoo_specs`
- `oil`
  - current logic is still partially derived from existing oil matcher structures
  - `oil_purpose` is now stored on `product_oil_eligibility`
  - live engine selection now uses `oil_purpose` as the primary fit signal when eligibility rows exist, with `oil_subtype` retained as a bridge/fallback
- `bondbuilder`
  - table: `product_bondbuilder_specs`
  - fields:
    - `bond_repair_intensity`
    - `application_mode`
- `deep_cleansing_shampoo`
  - table: `product_deep_cleansing_shampoo_specs`
  - fields:
    - `scalp_type_focus`
- `dry_shampoo`
  - table: `product_dry_shampoo_specs`
  - fields:
    - `scalp_type_focus`
- `peeling`
  - table: `product_peeling_specs`
  - fields:
    - `scalp_type_focus`
    - `peeling_type`

Working rule for the rewrite:
- if a category already has a dedicated spec table, add the V1 fit fields there first
- if a category does not yet have dedicated specs, that becomes a schema task before we can drive `category_fit` to zero

## Canonical V1 Fit Properties By Category

### Shampoo

Required structured properties:
- `scalp_route`
  - `oily`
  - `balanced`
  - `dry`
  - `dandruff`
  - `dry_flakes`
  - `irritated`
- `cleansing_intensity`
  - `gentle`
  - `regular`
  - `clarifying`

Current coverage:
- complete in storage
- current schema has:
  - `shampoo_bucket`
  - `scalp_route`
  - `cleansing_intensity`

Current code usage:
- integrated
- live engine selection still resolves shampoo candidate retrieval primarily through `shampoo_bucket`
- live reranking now uses `cleansing_intensity` from `product_shampoo_specs`

Backfill action:
- completed in storage
- completed in runtime integration

### Conditioner

Required structured properties:
- `balance_direction`
  - `protein`
  - `moisture`
  - `balanced`
- `repair_level`
  - `low`
  - `medium`
  - `high`
- `weight`
  - `light`
  - `medium`
  - `rich`

Current coverage:
- complete
- current schema now has:
  - `repair_level`
  - `weight`
- `balance_direction`

Backfill action:
- completed

### Leave-in

Required structured properties:
- `weight`
  - `light`
  - `medium`
  - `rich`
- `conditioner_relationship`
  - `replacement_capable`
  - `booster_only`
- `care_benefits`
  - `heat_protect`
  - `curl_definition`
  - `repair`
  - `detangle_smooth`

Current coverage:
- complete in storage
- current schema already has:
  - `product_leave_in_specs` with the broader source vocabulary
  - `product_leave_in_fit_specs` with the canonical V1 vocabulary

Current code usage:
- integrated
- the live engine now reads `product_leave_in_fit_specs` for ranking
- `product_leave_in_specs` remains the broader source metadata table

Backfill action:
- completed in storage
- completed in runtime integration

### Mask

Required structured properties:
- `balance_direction`
  - `protein`
  - `moisture`
  - `balanced`
- `repair_level`
  - `low`
  - `medium`
  - `high`
- `weight`
  - `light`
  - `medium`
  - `rich`

Current coverage:
- complete
- current schema already has:
  - `weight`
  - `concentration`
  - `balance_direction`
  - richer secondary metadata
- current `concentration` should be renamed conceptually to `repair_level`

Backfill action:
- completed for storage
- engine still conceptually maps `concentration` to `repair_level`

### Bondbuilder

Required structured properties:
- `bond_repair_intensity`
  - `maintenance`
  - `intensive`
- `application_mode`
  - `pre_shampoo`
  - `post_wash_leave_in`

Current coverage:
- storage in place, catalog rows still missing

Backfill action:
- populate `product_bondbuilder_specs`

### Heat protectant

Required structured properties:
- `application_stage`
  - `damp`
  - `dry`
  - `both`

Current coverage:
- none as a dedicated category schema
- some leave-ins already contain adjacent heat/application metadata, but not as heat-protectant product specs

Backfill action:
- introduce dedicated heat-protectant specs

### Deep-cleansing shampoo

Required structured properties:
- `scalp_type_focus`
  - `oily`
  - `balanced`
  - `dry`

Current coverage:
- storage in place, catalog rows still missing

Backfill action:
- populate `product_deep_cleansing_shampoo_specs`

### Peeling

Required structured properties:
- `scalp_type_focus`
  - `oily`
  - `balanced`
  - `dry`
- `peeling_type`
  - `acid_serum`
  - `physical_scrub`

Current coverage:
- storage in place, catalog rows still missing

Backfill action:
- populate `product_peeling_specs`
- map legacy `serum` / `scrub` intake into this category on the user-inventory side

### Dry shampoo

Required structured properties:
- `scalp_type_focus`
  - `oily`
  - `balanced`

Current coverage:
- storage in place, catalog rows still missing

Backfill action:
- populate `product_dry_shampoo_specs`

### Oil

Required structured properties:
- `oil_purpose`
  - `pre_wash_oiling`
  - `styling_finish`
  - `light_finish`

Current coverage:
- complete in storage for `oil_purpose`
- current oil logic already has compatible concepts:
  - `OilUseMode`
- current candidate matching still keeps subtype-based eligibility as a bridge underneath

Backfill action:
- completed on `product_oil_eligibility`
- completed in runtime integration with purpose-first selection when exact-purpose eligibility rows exist
- a future cleanup could still remove the subtype bridge entirely

## Priority Order For Backfill

To reduce `unknown` quickly, the highest-value order is:
1. conditioner
2. mask
3. leave-in
4. shampoo
5. oil
6. heat protectant
7. bondbuilder
8. deep-cleansing shampoo
9. peeling
10. dry shampoo

Reason:
- these first five categories are the earliest V1 consumer targets
- reducing `unknown` there matters most for the first useful end-to-end engine behavior

## Zero-Unknown Strategy

To drive `category_fit = unknown` down toward zero:

1. Lock the canonical property set above.
2. Backfill structured product specs for all active products in those categories.
3. Build a deterministic mapping layer from current broader schemas into canonical V1 fit fields.
4. Treat missing product metadata as a content/backfill issue, not as a logic excuse.

Important implementation rule:
- `unknown` should mostly mean:
  - product metadata not yet backfilled
- not:
  - the engine does not know how to reason about the category

## Practical Working Split

Use this split while implementing:

- engine code owns:
  - the canonical property names
  - fit logic
  - fallback behavior when metadata is missing

- product backfill work owns:
  - populating the canonical fields for the catalog
  - cleaning existing broader metadata into the canonical shape

That split lets engine implementation continue while catalog backfill happens in parallel.
