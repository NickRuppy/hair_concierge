# Product Identity Normalization

Phase 0 defines how Chaarlie names, matches, and reviews catalog products before any product-intake or assistant workflow uses those decisions. This is a developer-facing standard for catalog normalization data, not a database migration plan.

Phase 0 keeps the current production catalog shape compatible: existing `products.brand` and `products.category` stay in place, new identity tables are additive, and `product_lines` remain internal-only, optional, and forgiving. Product intake submissions and approval workflows are out of scope for this phase.

## Goals

- Make catalog product identity deterministic where the source data is clear.
- Preserve enough raw source language to audit future additions.
- Route ambiguous or weak matches to review instead of inventing canonical truth.
- Support expand/backfill/compatibility work without breaking the current 239-product production baseline.

## Production Baseline

The verified production baseline has 239 products and these current categories:

- `Bondbuilder`
- `Conditioner (Drogerie)`
- `Leave-in`
- `Maske`
- `Öle`
- `Shampoo`
- `Tiefenreinigungsshampoo`
- `Trockenshampoo`

Canonical category keys are internal stable keys for these existing category labels:

| Current category        | Canonical category key   |
| ----------------------- | ------------------------ |
| Bondbuilder             | `bondbuilder`            |
| Conditioner (Drogerie)  | `conditioner`            |
| Leave-in                | `leave_in`               |
| Maske                   | `mask`                   |
| Öle                     | `oil`                    |
| Shampoo                 | `shampoo`                |
| Tiefenreinigungsshampoo | `deep_cleansing_shampoo` |
| Trockenshampoo          | `dry_shampoo`            |

Do not introduce new category keys during Phase 0 unless the catalog owner explicitly approves the category split. New product submissions that do not fit one of these keys should be marked `review_status: "blocked"` with notes.

## Identity Fields

Each normalized catalog row should carry both current catalog values and canonical identity values.

- `product_id`: Existing catalog identifier. It anchors normalization data to the current product row.
- `current_brand`: The brand string currently stored in production.
- `current_name`: The product name currently stored in production.
- `current_category`: The category string currently stored in production.
- `canonical_category_key`: Stable internal category key from the table above.
- `canonical_brand`: The canonical consumer-facing brand owner/name for matching.
- `product_line`: Optional internal line/sub-brand string, or `null` when absent or uncertain.
- `clean_name`: Product name after removing duplicated brand and line prefixes while preserving the meaningful variant and product type.
- `aliases`: Brand or brand+line aliases that should resolve during matching.
- `known_titles`: Raw titles seen from retailers, spreadsheets, imports, or submitted product text.
- `identifiers`: Barcode, GTIN/EAN, retailer SKU, or retailer URL identifiers.
- `notes`: Human-readable normalization caveats, or `null`.
- `review_status`: `draft`, `reviewed`, or `blocked`.

## Canonical Rules

### Canonical Category Key

Map every product to exactly one `canonical_category_key`. The key is internal, lowercase, stable, and not translated at runtime. Matching logic may accept raw category labels, but persisted normalization data should use the canonical key.

When a raw title implies a different use than the current category, do not silently recategorize. Keep the current category in `current_category`, choose the best canonical key only when clear, and add a review note when the category needs catalog-owner confirmation.

### Canonical Brand

`canonical_brand` is the matching authority for brand identity. It should use the brand a customer reasonably recognizes, with punctuation and legal suffixes normalized consistently.

Rules:

- Normalize casing and punctuation, for example `LOreal`, `L'Oreal`, and `Loreal Paris` should resolve to `L'Oréal Paris` when that is the intended brand.
- Do not copy retailer noise such as pack size, promo wording, or product type into the brand.
- Do not treat raw extraction as canonical truth. Raw text is evidence, not the decision.
- If a raw brand could refer to multiple canonical brands, route to review.

### Product Line

`product_line` is optional, internal-only, and forgiving in Phase 0. It helps disambiguate common brand portfolios but must not become a hard user-facing requirement.

Rules:

- Use `product_line` for stable sub-brands or ranges such as `Pro-V Miracles`, `Fructis Hair Food`, `Wahre Schätze`, or `Elvital`.
- Use `null` when the line is absent, weakly evidenced, or not needed for matching.
- Accept aliases that resolve either to brand only or to brand+line.
- Backfill product lines only when they improve matching or auditability.
- Do not expose product-line uncertainty to users in Phase 0.

### Clean Product Name

`clean_name` should contain the product variant and product type after removing duplicated canonical brand and product-line text.

Rules:

- Keep meaningful variant words, for example `Hydra Glow Conditioner`, `Aloe Vera Feuchtigkeitsspülung`, or `Ultra Sensitive Shampoo`.
- Keep product type words when they distinguish category or format.
- Remove repeated brand and line prefixes when they already live in `canonical_brand` and `product_line`.
- Preserve names in the language used by the catalog or the product packaging unless a catalog-owner decision says otherwise.

### Raw Extraction

Raw extraction is never canonical truth. Retailer titles, OCR output, user submissions, spreadsheet rows, and scraped pages are inputs to review.

Use raw fields to populate:

- `known_titles` for title evidence.
- `aliases` for repeated brand or brand+line variants.
- `identifiers` for exact identifier matching.
- `notes` when extraction conflicts with catalog identity.

Do not overwrite canonical fields solely because a raw title is longer, newer, translated, promotional, or formatted differently.

## Matching Rules

### Identifier Matching

Identifier matching is strongest when the identifier type is product-specific.

- `gtin`, `ean`, and `barcode` matches should resolve to the same product when the value is exact after trimming spaces and separators.
- `retailer_sku` matches are exact only within the same retailer/source. The same SKU string from different retailers is not automatically the same product.
- `retailer_url` matches should be normalized conservatively by removing tracking query parameters when possible, but never by guessing a different product page.
- If one identifier maps to multiple catalog products, mark the candidate `blocked` or route the match to manual review.
- If a known identifier conflicts with normalized brand+line+name+category, prefer review over automatic merge.

### Text Matching

Text matching is allowed only after normalization.

1. Normalize brand aliases to `canonical_brand`, or to `canonical_brand` plus `product_line` when the alias is line-specific.
2. Normalize the raw title into candidate `clean_name` text by removing resolved brand and line text.
3. Match only when normalized `canonical_brand`, `product_line` or accepted null-line fallback, `clean_name`, and `canonical_category_key` are exact.
4. Treat category mismatch as review unless an identifier gives a stronger exact match and the catalog owner approves the correction.

Exact normalized matching means all of these agree:

- `canonical_brand`
- `product_line` when present, with Phase 0 null-line compatibility when the product has no line
- `clean_name`
- `canonical_category_key`

Ambiguous matches go to review. Do not choose between two plausible products by popularity, retailer order, fuzzy score, or assistant confidence.

## Alias Rules

Aliases may resolve at two scopes:

- Brand scope: alias resolves to `canonical_brand` only.
- Brand+line scope: alias resolves to `canonical_brand` and `product_line`.

Examples:

- `Pantene`, `Pantene Pro V`, and `Pantene Pro-V` can resolve to canonical brand `Pantene`.
- `Pantene Pro-V Miracles` can resolve to brand `Pantene` plus line `Pro-V Miracles`.
- `Garnier Hair Food` can resolve to brand `Garnier` plus line `Fructis Hair Food` only when the product context supports the Fructis Hair Food range.
- `Elvital` should resolve to brand `L'Oréal Paris` plus line `Elvital` when used as the consumer-facing range.

Aliases should not hide uncertainty. If the same alias can reasonably mean two brands or lines in the catalog, keep both candidates out of automatic matching and document the conflict in `notes`.

## Examples

### Pantene Pro-V Miracles Hydra Glow Conditioner

```json
{
  "canonical_category_key": "conditioner",
  "canonical_brand": "Pantene",
  "product_line": "Pro-V Miracles",
  "clean_name": "Hydra Glow Conditioner",
  "aliases": [
    {
      "alias": "Pantene Pro-V",
      "resolves_to": "brand",
      "canonical_brand": "Pantene",
      "product_line": null
    },
    {
      "alias": "Pantene Pro-V Miracles",
      "resolves_to": "brand_line",
      "canonical_brand": "Pantene",
      "product_line": "Pro-V Miracles"
    }
  ]
}
```

### Garnier Fructis Hair Food Aloe Vera Feuchtigkeitsspülung

```json
{
  "canonical_category_key": "conditioner",
  "canonical_brand": "Garnier",
  "product_line": "Fructis Hair Food",
  "clean_name": "Aloe Vera Feuchtigkeitsspülung",
  "aliases": [
    {
      "alias": "Garnier Fructis",
      "resolves_to": "brand_line",
      "canonical_brand": "Garnier",
      "product_line": "Fructis"
    },
    {
      "alias": "Garnier Fructis Hair Food",
      "resolves_to": "brand_line",
      "canonical_brand": "Garnier",
      "product_line": "Fructis Hair Food"
    },
    {
      "alias": "Garnier Hair Food",
      "resolves_to": "brand_line",
      "canonical_brand": "Garnier",
      "product_line": "Fructis Hair Food"
    }
  ]
}
```

### Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung

```json
{
  "canonical_category_key": "conditioner",
  "canonical_brand": "Garnier",
  "product_line": "Wahre Schätze",
  "clean_name": "Kokosmilch & Macadamia Nährende Spülung",
  "aliases": [
    {
      "alias": "Garnier Wahre Schaetze",
      "resolves_to": "brand_line",
      "canonical_brand": "Garnier",
      "product_line": "Wahre Schätze"
    },
    {
      "alias": "Garnier Wahre Schätze",
      "resolves_to": "brand_line",
      "canonical_brand": "Garnier",
      "product_line": "Wahre Schätze"
    }
  ]
}
```

### L'Oréal Paris Elvital Fiber Booster Conditioner

```json
{
  "canonical_category_key": "conditioner",
  "canonical_brand": "L'Oréal Paris",
  "product_line": "Elvital",
  "clean_name": "Fiber Booster Conditioner",
  "aliases": [
    {
      "alias": "Loreal Paris",
      "resolves_to": "brand",
      "canonical_brand": "L'Oréal Paris",
      "product_line": null
    },
    {
      "alias": "L'Oreal Paris Elvital",
      "resolves_to": "brand_line",
      "canonical_brand": "L'Oréal Paris",
      "product_line": "Elvital"
    },
    {
      "alias": "Elvital",
      "resolves_to": "brand_line",
      "canonical_brand": "L'Oréal Paris",
      "product_line": "Elvital"
    }
  ]
}
```

### Balea Med Ultra Sensitive Shampoo

```json
{
  "canonical_category_key": "shampoo",
  "canonical_brand": "Balea",
  "product_line": "Med",
  "clean_name": "Ultra Sensitive Shampoo",
  "aliases": [
    {
      "alias": "Balea Med",
      "resolves_to": "brand_line",
      "canonical_brand": "Balea",
      "product_line": "Med"
    }
  ]
}
```

## Ongoing Product-Addition Playbook

Use this playbook for every future product addition file under `data/product-additions/`.

1. Capture raw evidence first: retailer title, submitted user text, source URL, visible barcode/GTIN/EAN, retailer SKU, and any package-size context.
2. Check identifiers before text. Exact `gtin`, `ean`, or `barcode` matches should attach to the existing product unless there is a catalog conflict.
3. Resolve brand aliases to canonical brand or brand+line. Keep the raw alias in `aliases` if it is likely to recur.
4. Assign one existing `canonical_category_key`. If none fits, mark the row blocked and write a note instead of creating a category.
5. Create or update `clean_name` by removing canonical brand and internal product-line text from the title.
6. Run exact normalized brand+line+name+category matching.
7. If exactly one product matches, link to that `product_id` and set `review_status` to `reviewed` after human confirmation.
8. If multiple products match, or if identifiers and text disagree, set `review_status` to `blocked` and document the conflict in `notes`.
9. Keep Phase 0 additive: do not remove existing `products.brand`, `products.category`, product rows, or production behavior as part of normalization.

## Phase 0 Ingestion And RAG Compatibility Audit

Phase 0 intentionally does not rename `products.name`. Current ingestion and chunking still have legacy name/category dependencies:

- `scripts/ingest-products.ts` upserts catalog products on `name,category`.
- `scripts/ingest-product-chunks.ts` rebuilds `content_chunks` from `data/products-from-excel/`.
- `src/lib/product-matching/product-list-chunks.ts` embeds product names and brands into product-list chunk text and metadata.

Because of those dependencies, `scripts/product-identity/apply-normalization.ts` only updates additive identity columns. Product-name cleanup is a later explicit phase after ingestion upserts are id-stable or updated to the canonical identity fields, and after product-list chunks can be refreshed from the cleaned names in the same release window.

## Phase 0 Non-Goals

- No onboarding or chat intake changes.
- No `product_submissions` table.
- No approval workflow.
- No assistant integration.
- No removal of `products.brand` or `products.category`.
- No assumption that new product identity tables already exist.
