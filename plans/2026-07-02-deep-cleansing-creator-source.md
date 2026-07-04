# Deep Cleansing Creator-Source Catalog Plan

## Status

Finalized plan for the current deep-cleansing shampoo category cleanup. Nick approved
the naming convention, product-image standard, and NEQI brand/line split. The
product-addition/image process from `docs/product-intake-research-ops.md` is integrated
as a readiness gate before final implementation handoff.

## Goal

Ship a simple, trustworthy `Tiefenreinigungsshampoo` catalog slice based only on the
certified creator-source products we currently trust, without overclaiming color-safe,
medical scalp, or chelating benefits.

## Non-Goals

- Do not add high-end products in this pass.
- Do not keep older non-certified deep-cleansing products active.
- Do not add color-treated suitability as a deep-cleansing recommendation axis.
- Do not add a new provenance/source-line column if `is_chaarlie_recommended` already
  covers Chaarlie-approved creator-source products.
- Do not run production database mutations until Nick explicitly approves the guarded
  apply command.

## Product Scope

Seed exactly these five active products:

| Brand       | Product                                               | Category                |
| ----------- | ----------------------------------------------------- | ----------------------- |
| NEQI        | NEQI x @\_the.beautiful.people Deep Cleansing Shampoo | Tiefenreinigungsshampoo |
| Swiss-O-Par | Tiefenreinigung Shampoo                               | Tiefenreinigungsshampoo |
| Balea       | Balea Tiefenreinigung                                 | Tiefenreinigungsshampoo |
| ISANA       | Professional Shampoo Tiefenreinigung                  | Tiefenreinigungsshampoo |
| GLISS       | Scalp Balance Tiefenreinigung Shampoo                 | Tiefenreinigungsshampoo |

Do not seed Pantene Volumen Pur or Head & Shoulders DermaXPro Pure Hydration as
deep-cleansing products because they read as normal shampoos from the current review.

Before apply, normalize the catalog identity according to
`docs/product-catalog-identity-rules.md`:

| Final brand | Final product line         | Final product name                     | Source display                                         | Decision status                                                                                      |
| ----------- | -------------------------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| NEQI        | `x @_the.beautiful.people` | `Deep Cleansing Shampoo`               | `NEQI x @_the.beautiful.people Deep Cleansing Shampoo` | Approved by Nick                                                                                     |
| Swiss-O-Par | `null`                     | `Tiefenreinigung Shampoo`              | `Swiss-O-Par Tiefenreinigung Shampoo`                  | Approved by Nick                                                                                     |
| Balea       | `Professional`             | `Shampoo Tiefenreinigung`              | `Balea PROFESSIONAL Shampoo Tiefenreinigung`           | Approved by Nick; follows approved Balea Professional rule                                           |
| ISANA       | `null`                     | `Professional Shampoo Tiefenreinigung` | `ISANA PROFESSIONAL Shampoo Tiefenreinigung`           | Approved by Nick; adjusted after live `(name, category)` uniqueness check to avoid duplicating Balea |
| Gliss       | `Scalp Balance`            | `Tiefenreinigungs-Shampoo`             | `GLISS / Scalp Balance / Tiefenreinigungs-Shampoo`     | Approved by Nick; new Gliss line, normalized to existing brand case                                  |

The seed must check the exact live product rows before writing so it updates or links
existing rows instead of creating duplicates, including rows that are inactive or not
Chaarlie-recommended.

## Product Specs

Use the current spec table fields that still matter for recommendation behavior:

| Product     | `scalp_type_focus` | `reset_intensity` | `reset_focus`           |
| ----------- | ------------------ | ----------------- | ----------------------- |
| NEQI        | `balanced`         | `medium`          | `product_sebum_buildup` |
| Swiss-O-Par | `balanced`         | `medium`          | `broad_spectrum_detox`  |
| Balea       | `oily`             | `medium`          | `product_sebum_buildup` |
| ISANA       | `balanced`         | `medium`          | `product_sebum_buildup` |
| GLISS       | `oily`             | `medium`          | `product_sebum_buildup` |

Keep `color_treated_suitability` out of the deep-cleansing recommendation surface.
The existing DB column can remain for compatibility, but Chaarlie should not rank,
explain, compare, or caveat these products based on that property.

## Recommendation Behavior

- Deep-cleansing matching uses reset focus, reset intensity, and scalp focus.
- Deep-cleansing recommendation metadata does not include color-treated suitability.
- Product cards and supported claims do not show Farbschutz/color-safe facts for this
  category.
- Color-safe wording in a user message should not create an empty result by itself.
- Mineral/hard-water requests remain strict: do not recommend product/sebum-only
  products as if they support Kalk, Chlor, Mineral, or Metall claims.
- Scalp symptom requests such as Schuppen, Juckreiz, irritation, seborrhoic topics, or
  hair loss remain guidance-only and should not produce deep-cleansing product cards.

## Database Plan

No new category schema migration is required for this pass.

The existing database already has:

- `products`
- `product_deep_cleansing_shampoo_specs`
- `scalp_type_focus`
- `reset_intensity`
- `reset_focus`
- legacy compatibility column `color_treated_suitability`

The production database action remains a guarded seed/apply command, but it must not
run until the product-intake readiness gates below are complete:

```bash
npx tsx scripts/seed-deep-cleansing-products.ts --apply --deactivate-stale --confirm-project=pqdkhefxsxkyeqelqegq --confirm-reviewed-images
```

Expected effects:

- Upsert the five creator-source products.
- Write their deep-cleansing specs.
- Set internal curated catalog provenance where supported by the live schema:
  `origin = "curated"` and `is_chaarlie_recommended = true`.
- Write the catalog identity split: canonical brand, product line when approved, and
  clean product-specific name.
- Write commercial metadata from the selected purchase PDP:
  `affiliate_link`, `price_eur`, `currency`, `purchase_link_status`,
  `purchase_link_checked_at`, and `price_checked_at`.
- Write `image_url` only after the final processed Chaarlie asset exists in the public
  Supabase `product-images` bucket.
- Update/reactivate existing matching rows if they already exist.
- Deactivate active deep-cleansing rows outside the seed matrix.
- Verify final active deep-cleansing product count equals the seed count.

Do not run this apply command until Nick explicitly approves it.

## Product Addition And Image Process

Use the canonical product-intake research ops standard for these internally curated
products. The newer review cockpit/package flow may not be the publishing vehicle for
this category seed, but the readiness standard still applies.

### Source And Purchase URL Rules

- Resolve product identity first: canonical brand, optional product line, clean product
  name, category key, identifiers when available, and source URLs.
- Evidence priority: official brand/manufacturer page first; reputable German/EU
  retailer PDPs second; barcode/GTIN lookup third; secondary listings only when primary
  sources are missing.
- Purchase URL order for deep-cleansing shampoo:
  `dm > Rossmann > Müller > brand-direct > Amazon DE`.
- The final `affiliate_link` must be a concrete product detail page, not search,
  listing, price-comparison, marketplace-only, or non-German/non-EU fallback pages.
- `price_eur`, `purchase_link_status`, `purchase_link_checked_at`, and
  `price_checked_at` should come from the same current commercial evidence whenever
  possible.

### Required Product Fields

Each product must have a reviewed final payload equivalent to the intake contract:

- product fields: canonical brand, product line, clean product name, category,
  affiliate link, final image URL, price, currency, purchase-link status, purchase
  checked timestamp, price checked timestamp
- identifiers when available: `ean`, `gtin`, `barcode`, `retailer_sku`, or
  `retailer_url`
- source list and field rationales for product fields and every deep-cleansing spec
- `product_deep_cleansing_shampoo_specs` only for category specs
- manual review marker after Nick has approved final image and properties

For this internal creator-source batch, rows should be treated as curated products:

- `origin = "curated"`
- `is_chaarlie_recommended = true`

User-submitted products remain different: `origin = "user_submitted"` and
`is_chaarlie_recommended = false`.

### Image Rules

- The raw candidate must be the exact product and variant, front-facing, full product,
  one saleable unit, high enough resolution for label review, and preferably transparent
  or on a clean light background.
- Reject box-only photos, bundles, lifestyle photos, shelves, hands/models, watermarks,
  sale overlays, dark backgrounds, heavy shadows, strong reflections, or cropped
  products.
- Cache the approved raw candidate locally before review; do not rely on a remote image
  URL that may not render.
- Inspect alpha first. Use Apple Vision/rembg only when needed.
- Run magenta QA after background removal and reject visible haze, halos, shadow tails,
  broken caps/bottles, or product damage.
- Final image must be a reviewed `1200x1200` WebP on the neutral Chaarlie product
  background.
- NEQI uses the official single-bottle source cutout, rotated into an upright catalog
  render because the official raw product asset is angled and no exact upright
  single-product packshot was available.
- Final catalog `products.image_url` must point to the uploaded public Supabase
  `product-images` asset. Do not write raw retailer/brand image URLs into final catalog
  rows.
- No-image v1 is not acceptable for this batch. Images must match the standard of the
  existing catalog images before activation.

### Workflow For This Deep-Cleansing Batch

1. Recheck live DB for existing matching products, including inactive products and rows
   where `is_chaarlie_recommended = false`.
2. Normalize identity and add/propose missing product-line registry entries before the
   DB apply.
3. Recheck source and purchase PDPs in the preferred order for all five products.
4. Fill or update prices, purchase-link status, and checked-at timestamps.
5. Find and process final product images for all five products, or capture explicit
   no-image approval if Nick chooses that for v1.
6. Update the seed script so dry-run output shows the full publish-relevant matrix:
   identity split, source URL, affiliate URL, price/status/check timestamps, image
   status, curated/recommended flags, and deep-cleansing specs.
7. Run dry-run validation before production apply.
8. Run production apply only after Nick approves the exact final matrix.

## Implementation Checklist

- [x] Use isolated worktree `codex/deep-cleansing-creator-source`.
- [x] Replace older 10-product deep-cleansing seed with five creator-source rows.
- [x] Keep stale deactivation guarded behind `--deactivate-stale`.
- [x] Remove deep-cleansing color suitability from ranking, metadata, comparison facts,
      supported claims, and category policy copy.
- [x] Keep DB/admin compatibility for the existing color column.
- [x] Integrate Nick's product-addition/image process into this plan.
- [x] Update the seed script to include curated/recommended flags where supported by the
      live schema.
- [x] Update the seed script to include purchase-link status and checked-at metadata.
- [x] Update the seed script to require reviewed final `product-images` URLs before apply.
- [x] Normalize identity split and product-line handling for the five products after Nick
      reviews the final identity matrix.
- [x] Keep Swiss-O-Par as `broad_spectrum_detox` for this pass; a narrower hard-water
      taxonomy can be handled in a separate schema cleanup if needed later.
- [x] Run the guarded production apply after explicit approval.
- [x] Replace the NEQI image object with the upright reviewed render.

## Verification

Already run in the worktree:

```bash
npx tsx scripts/seed-deep-cleansing-products.ts
npx tsx --test tests/seed-deep-cleansing-products.test.ts
npx tsx --test tests/seed-deep-cleansing-products.test.ts tests/recommendation-engine-selection.test.ts tests/recommendation-engine-categories.test.ts
npx tsx --test --test-name-pattern "projectSelectedProducts labels deep-cleansing reset facts without raw enum copy" tests/agent-select-products-tool.spec.ts
npm run typecheck
git diff --check
```

Known verification note:

- Full `tests/agent-select-products-tool.spec.ts` currently includes env-dependent
  integration cases and failed locally with `supabaseUrl is required`; the touched
  projection test passed with `--test-name-pattern`.

## Review Gates

- Nick reviews the five-product seed matrix.
- Nick reviews the normalized brand/line/name split.
- Nick approves missing product-line registry additions, especially GLISS Scalp
  Balance. NEQI line is approved as `x @_the.beautiful.people`; ISANA does not
  need a separate line for this seed after the live uniqueness repair.
- Nick reviews final product images, which must match the existing catalog image
  standard before activation.
- Nick reviews the final commercial metadata matrix: purchase URLs, price values,
  purchase-link status, and checked-at dates.
- Optional plan review after the image process is integrated.
- Production DB apply requires explicit approval.

## Decisions Needed

None before shipping this batch. Remaining Swiss-O-Par taxonomy refinement is
non-blocking and deferred to a separate schema cleanup if needed later.

## Stop Line

Stop before staging, committing, pushing, or opening a PR unless Nick explicitly asks
for that step.
