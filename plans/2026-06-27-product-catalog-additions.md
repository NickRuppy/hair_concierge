# Product Catalog Additions Plan

Date: 2026-06-27
Branch/worktree: `codex/product-catalog-additions` at `.worktrees/product-catalog-additions`

## Implementation Goal Contract

Objective: Add the approved upgraded-list products to the live product catalog with the same completeness as existing catalog rows: commercial metadata, images, links, suitability fields, normalized identity fields, and category-specific spec rows.

Execution mode: sequential in this worktree. No production database write until the dry-run output is reviewed and explicitly approved.

Write scope:
- New or updated product-addition script/migration under `scripts/` and/or `supabase/migrations/`
- Minimal product-image helper scripts under `scripts/product-images/` if not already present on this branch
- Focused tests or fixtures needed to validate duplicate/collision behavior
- This plan file

Stop line: stop before uploading images to Supabase storage, applying writes to
the live Supabase database, staging, committing, pushing, or opening a PR unless
explicitly approved.

## Chosen Direction

Use a dry-run-first product addition script, not a direct SQL paste into production.

Why: these rows need linked inserts across `products`, `brands`/`product_lines` identity, and category-specific spec tables. A script can print the exact payload, check duplicates, verify links/images, and only write with an explicit `--apply --confirm-project=pqdkhefxsxkyeqelqegq` command.

Base the writer on the existing `seed-*-products.ts` script pattern rather than
inventing a separate writer style. Add a mandatory live schema preflight because
this worktree's `origin/main` migration history can lag behind the production
schema. The script must introspect live `products`, `brands`, `brand_aliases`,
`product_lines`, and relevant spec tables before building payloads, then fail
early if required columns/tables are missing.

Adopt the product-intake research package standard for product images, but build
it now as a standalone internal catalog-addition workflow. This branch is based
on `origin/main`, which does not yet contain the `products:intake:*`
package/image scripts, so implementation should not depend on those commands.

Instead, create a small internal catalog-addition script that can:
- create package-local research/image folders for the four products;
- cache selected source images;
- use the minimal product-image helper scripts from the product-intake worktree
  (`removebg.swift`, `removebg-padded.swift`, `remove-baked-shadow.py`,
  `qa-composite.swift`) by porting them into this branch when absent;
- upload final Chaarlie-ready `1200x1200` WebP assets to the public
  `product-images` bucket only after explicit `--apply --confirm-project`;
- write the resulting Chaarlie-hosted public image URL into `products.image_url`.

The raw retailer or brand image URL is evidence only; the final product-card URL
must be the Chaarlie-hosted public `product-images` URL.

There must be one review/reuse stage before any upload or DB write. This stage
prepares local package files, candidate images, rendered final-image previews,
property/spec proposals, duplicate analysis, and the exact dry-run product
payload. Nick reviews those artifacts first. Only after explicit approval may the
script upload final images and write the catalog rows.

## Final Add Scope

Add exactly these products:

| Product | Brand | Category | Category key | Primary source |
| --- | --- | --- | --- | --- |
| `Gliss Ultimate Repair Spülung` | `Gliss` | `Conditioner (Drogerie)` | `conditioner` | `https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-spuelung/p/4015100812237` |
| `Syoss Intense Curls Haarmaske` | `Syoss` | `Maske` | `mask` | `https://www.dm.de/p/d/3099668/syoss-haarmaske-intense-curls` plus `https://www.syoss.net/care/mask/syoss-intense-curls-hair-mask.html` |
| `Garnier Wahre Schätze Haarmaske Aktivkohle` | `Garnier Wahre Schätze` | `Maske` | `mask` | `https://www.garnier.de/haarpflege/haarpflege-marken/wahre-schaetze/aktivkohle` plus retailer page if available |
| `Leave-In Moisturizing Mist` | `Neqi` with product line `NEQI x @_the.beautiful.people` | `Leave-in` | `leave_in` | `https://neqi-hair.com/products/neqi-x-the-beautiful-people-leave-in-mist` |

Do not add:
- `Garnier Wahre Schätze Aloe Vera Spülung`: already represented as active DB row `Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung`.
- `OGX Keratin & Protein`: already represented as active DB row `OGX Bond Protein Repair Conditioner`.
- `Head & Shoulders Derma X 0%`: not useful enough for current scope; do not add or remap now.
- Naming-only rows from the upgraded-list audit.

## Field Targets

### `products`

Every new product must have:
- `name`, `brand`, `description`, `short_description`, `tom_take`
- `category`, `category_key`
- `affiliate_link`, `image_url`, `price_eur`, `currency`
- `purchase_link_status = 'available'`, `purchase_link_checked_at`, `price_checked_at`
- `tags`
- `suitable_thicknesses`, `suitable_concerns`
- `is_active = true`, `lifecycle_status = 'active'`
- `brand_id`; `product_line_id` when a clear line exists
- `origin = 'curated'`
- `is_chaarlie_recommended = true`

Before proposing any value, compare against live DB rows in the same product
family/category:
- image style and final Chaarlie-hosted image URL pattern
- affiliate link source preference
- price/currency conventions
- `description`, `short_description`, and `tom_take` tone/length
- `tags`, `suitable_thicknesses`, and `suitable_concerns`
- category-specific spec values and rerank/fit tables

### Category Specs

Conditioner:
- Insert `product_conditioner_specs`.
- Insert or update `product_conditioner_rerank_specs` if the table exists in prod and the selector uses it.
- Starting spec from existing local mapping: `Gliss Ultimate Repair Spülung` = medium weight, high repair, `ingredient_flags = ['silicones']`, protein direction.

Masks:
- Insert `product_mask_specs`.
- `Syoss Intense Curls Haarmaske`: likely moisture direction, medium weight, medium concentration, likely no silicone flag unless ingredient evidence says otherwise.
- `Garnier Wahre Schätze Haarmaske Aktivkohle`: likely moisture/balancing direction, light or medium weight, low/medium concentration, likely no silicone flag if source confirms silicone-free.

Leave-in:
- Insert `product_leave_in_specs`.
- Insert `product_leave_in_fit_specs` if required by current leave-in matching.
- `NEQI x @_the.beautiful.people Leave-In Moisturizing Mist`: likely spray, light weight, extension conditioner + styling prep, benefits moisture/detangling/anti_frizz/shine, likely ingredient flags humectants/proteins; heat protection should be `false` unless official source confirms heat protection.

### Image Package Files

For each product, create or reuse an internal package folder modelled on:

```text
ops/product-intake-research/YYYY-MM-DD/internal-<product-slug>/
```

Expected files for this internal catalog-addition use:
- `research.md`: source links, identity reasoning, commercial metadata, caveats
- `payload.json`: final product/spec payload
- `image-candidates.json`: source page/image candidates
- `image-review.json`: selected image decision
- `property-review.json`: category property decisions
- `image-finalization.json`: approved final Chaarlie-hosted image decision
- `package-approval.json`: local approval marker tied to the exact payload
- `images/source/`, `images/selected/`, `images/selected-nobg/`, `images/qa/`, `images/final/`

User-submission-specific files and behaviors are not needed here:
- no `submission.json` with user data
- no `user_product_usage` linking
- no chat notification
- no request-more-info or reject flow

## Research And Validation Checklist

- [ ] For each product, capture canonical SKU name, brand, size, GTIN if visible, price, purchase URL, image URL, and source URL.
- [ ] Run live schema preflight and fail early if required live tables/columns are missing.
- [ ] Compare each product against existing live DB rows in the same brand/category family before setting properties:
  - `Gliss Ultimate Repair Spülung` vs existing Gliss conditioners/repair products.
  - `Syoss Intense Curls Haarmaske` vs existing Syoss shampoo/conditioner/mask rows.
  - `Garnier Wahre Schätze Haarmaske Aktivkohle` vs existing Wahre Schätze shampoo/mask rows.
  - `NEQI x @_the.beautiful.people Leave-In Moisturizing Mist` vs existing Neqi leave-in/conditioner rows and `Neqi` identity tables.
- [ ] Cache the selected product image into the package under `images/source/` or `images/selected/`.
- [ ] Inspect whether the selected image already has good alpha before running background removal.
- [ ] Port or reuse the minimal product-image helper scripts from `.worktrees/product-intake-full-flow-smoke/scripts/product-images/` if absent on this branch.
- [ ] Remove background locally only when needed, using the product-image scripts (`removebg.swift`, `removebg-padded.swift`, `remove-baked-shadow.py`) and store transparent PNGs under `images/selected-nobg/`.
- [ ] Run magenta QA via `qa-composite.swift`; do not approve images that cannot be visually inspected.
- [ ] Generate final Chaarlie image with the product-intake finalizer when available; final output must be a `1200x1200` WebP under `images/final/`.
- [ ] Upload or verify final images through the `product-images` bucket flow; `payload.json` must use the public Chaarlie-hosted URL, not the raw source image URL.
- [ ] Compare each candidate against active and inactive `products` rows by normalized name and category.
- [ ] Confirm or create normalized brand/product-line rows:
  - `Gliss`
  - `Syoss`
  - `Garnier Wahre Schätze`
  - `Neqi`
  - optional line for `NEQI x @_the.beautiful.people` only if the existing identity model uses product lines for NEQI collections.
- [ ] Confirm product category labels and `category_key` values match live `product_categories`.
- [ ] Fill category specs from source evidence plus neighboring catalog patterns, not product names alone.
- [ ] Generate review artifacts before any upload/write:
  - `research.md`
  - `payload.json`
  - `property-review.json`
  - `image-candidates.json`
  - `image-review.json`
  - local final-image preview files under `images/final/`
  - duplicate/collision report
- [ ] Pause for Nick to review product properties and images.
- [ ] Generate dry-run output showing all `products` and spec table payloads.
- [ ] Run duplicate/collision checks before writes:
  - active exact same `(name, category)`
  - inactive same/near-same category row that should be reactivated instead
  - same brand and product-line alias conflicts
- [ ] Upload images only after Nick approves the local image previews.
- [ ] Apply DB writes only after Nick approves the dry-run payload.
- [ ] Re-query live rows after apply and verify non-null commercial metadata.
- [ ] Run targeted tests for product selection/spec table assumptions.

## Decisions To Align Before Apply

1. Exact NEQI display naming:
   - Settled: brand `Neqi`, product line `NEQI x @_the.beautiful.people`, name `Leave-In Moisturizing Mist`.
   - Reason: keeps canonical brand stable, treats the collaboration as the product line, and keeps the clean SKU name focused.

2. NEQI identity modeling:
   - Settled: use a `product_line` under `Neqi` for `NEQI x @_the.beautiful.people` because live DB has `brands`, `product_lines`, and `brand_aliases`.

3. `is_chaarlie_recommended` for all four:
   - Settled: `true`, because these came from the curated upgraded list.

4. Product image policy:
   - Settled: `image_url` is required for all four products and should be a Chaarlie-hosted `product-images` public URL after local image finalization/upload. Raw retailer/brand image URLs are source evidence, not final product-card URLs.

5. Apply path:
   - Settled: review/reuse stage first, then dry-run, then explicit apply command. Do not apply through Supabase Studio manually.

6. Product-intake dependency:
   - Settled: do not wait for the user-facing product-intake flow to merge. Build the internal catalog-addition script now, reusing the same image quality standard without depending on `products:intake:*` commands.

7. Reviewer approval gates:
   - Settled: Nick must review the proposed properties and local final-image previews before any image upload.
   - Settled: Nick must review the exact dry-run payload before any DB write.

8. Live schema drift:
   - Settled: trust live DB introspection for production payload shape, not only this branch's migration files. The script must print the live schema preflight result in `--prepare-review` and `--dry-run`.

## Verification

Before apply:
- `npx tsx scripts/<new-product-addition-script>.ts --prepare-review`
- Nick reviews generated package files, property proposals, and local final-image previews.
- `npx tsx scripts/<new-product-addition-script>.ts --dry-run`
- Live schema preflight passes for `products`, identity tables, and spec tables.
- Duplicate/collision report prints zero blocking conflicts.
- The dry-run output includes all commercial and spec fields for the four rows.
- No image upload has happened before the local image-preview approval.

After apply:
- Re-query `products` for all four names and assert:
  - active row exists
  - `affiliate_link`, Chaarlie-hosted `image_url`, `price_eur`, `purchase_link_status`, `category_key`, `brand_id`, and spec rows are present
  - `image_url` renders and points to `https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/...`
- Run relevant targeted tests:
  - conditioner spec/rerank tests if present
  - mask spec tests if present
  - leave-in selection/spec tests if present
  - product selection smoke for the affected categories

## Out Of Scope

- Adding the full NEQI x THE BEAUTIFUL PEOPLE line beyond the one Leave-In Mist found in the upgraded-list `Leave-in` tab.
- Reopening the `Head & Shoulders Derma X 0%` question.
- Bulk-cleaning legacy names or inactive duplicates unrelated to these four rows.
- Changing recommendation ranking logic beyond adding complete product/spec data.

## Review Status

Claude review completed on 2026-06-27 via a direct constrained `claude --print`
prompt after the wrapper `/reviewing-plans` route repeatedly stayed silent and
produced empty artifacts. Review file:
`plans/2026-06-27-product-catalog-additions.claude-review.md`.

Accepted findings incorporated:
- Add mandatory live schema preflight because this branch can lag behind the live DB schema.
- Explicitly port/reuse the minimal product-image helper scripts before image work.
- Base the writer on existing `seed-*-products.ts` conventions.

Rejected/qualified finding:
- Claude's claim that identity/product columns do not exist is true for local branch search but false for live DB; live Supabase introspection confirmed `category_key`, `brand_id`, `product_line_id`, `origin`, `is_chaarlie_recommended`, `brands`, `brand_aliases`, and `product_lines`.
