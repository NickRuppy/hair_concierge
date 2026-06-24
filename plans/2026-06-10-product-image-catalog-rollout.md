# Product Image Catalog Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish reviewed, provenance-tracked product images for the remaining active catalog products that still have `products.image_url IS NULL`.

**Architecture:** Reuse the completed 20-product pilot pipeline, but run the catalog in controlled batches. Keep messy scraping, fallback sourcing, background removal, and visual review local; publish only reviewed final assets plus provenance rows to Supabase.

**Tech Stack:** TypeScript/Node scripts with `tsx`, Playwright scraping, local Vision/rembg cutouts, Sharp final compositing, Supabase Storage + Postgres RPC, Next.js image rendering.

---

## Source Inputs

- Pilot runbook: `docs/runbooks/product-image-pilot-runbook.md`
- Background-removal runbook: `docs/product-image-background-removal.md`
- Claude review: `docs/runbooks/product-image-pilot-runbook.claude-review.md`
- Current live count on 2026-06-10:
  - active products: 233
  - active products with images: 20
  - active products missing images: 213

## Promised End-State

- Every active product either has a reviewed product image in `products.image_url` or is recorded in a local unresolved backlog with the reason it could not be sourced safely.
- Supabase Storage contains immutable, hash-versioned final images grouped by batch id.
- `public.product_image_assets` contains one provenance row per published image.
- Product recommendation cards continue to render image assets where present and icon fallback where missing.

## Target File Map

- Modify `scripts/product-images/select-pilot-products.ts`
  - Add `--limit` and `--allow-partial` so the same selector can create 50-product batches and the final smaller batch.
  - Keep the existing default pilot behavior for reproducibility.
- Modify `docs/runbooks/product-image-pilot-runbook.md`
  - Add the selector command for non-pilot batches.
  - Add the concrete 213-product rollout cadence.
- Possibly create `data/product-images/catalog-YYYY-MM-DD-XX/`
  - One local batch folder per rollout batch.
  - These are working artifacts, not application source.
- Do not modify recommendation logic unless QA finds product-card rendering bugs.

## Scope Boundaries

- In scope: batch selection, scraping, review, fallback sourcing, cutout, final compositing, manifest generation, dry-run, publish, local app QA.
- In scope: script tweaks required to run non-pilot batches safely.
- Out of scope: admin UI upload flow, fully automatic background-removal approval, unreviewed auto-publish, changing recommendation ranking.
- Out of scope: replacing the local Vision/rembg cutout workflow with a third-party API unless local results clearly fail for a batch.

---

## Task 1: Make Batch Selection Scale-Safe

**Files:**

- Modify: `scripts/product-images/select-pilot-products.ts`
- Test/verify: shell command against Supabase, no DB mutation

- [x] **Step 1: Add selector flags**

Add:

```ts
const limit = Number(
  process.argv.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 20,
)
const allowPartial = process.argv.includes("--allow-partial")

if (!Number.isInteger(limit) || limit <= 0) {
  throw new Error(`--limit must be a positive integer, got ${limit}`)
}
```

- [x] **Step 2: Use `limit` instead of hardcoded 20**

Replace every selection cutoff and message that assumes 20 with `limit`.

Expected behavior:

```text
--limit=50
```

selects up to 50 active products with `image_url IS NULL`.

- [x] **Step 3: Allow the final smaller batch**

Replace the current strict failure:

```ts
if (selected.length < 20) {
  throw new Error(`Expected 20 eligible pilot products, found ${selected.length}`)
}
```

with:

```ts
if (selected.length < limit && !allowPartial) {
  throw new Error(
    `Expected ${limit} eligible products, found ${selected.length}. Use --allow-partial for the final batch.`,
  )
}
```

- [x] **Step 4: Verify selector output for the first catalog batch**

Run:

```bash
npx tsx scripts/product-images/select-pilot-products.ts \
  --out=data/product-images/catalog-2026-06-10-01/pilot-products.csv \
  --limit=50
```

Expected:

```text
Wrote 50 products to data/product-images/catalog-2026-06-10-01/pilot-products.csv
```

Open the CSV and confirm:

- 50 rows plus header
- all product ids are unique
- all rows have `affiliate_link`
- none of the 20 pilot products are included

---

## Task 2: Run Batch 01 as the Scale Trial

**Files/artifacts:**

- Create: `data/product-images/catalog-2026-06-10-01/`
- Read: `docs/runbooks/product-image-pilot-runbook.md`
- Read: `docs/product-image-background-removal.md`

- [x] **Step 1: Scrape candidates**

Run:

```bash
npx tsx scripts/product-images/scrape-pilot-images.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01
```

Expected:

```text
data/product-images/catalog-2026-06-10-01/review.html
data/product-images/catalog-2026-06-10-01/image-candidates.json
```

- [x] **Step 2: Start review server**

Run:

```bash
npx tsx scripts/product-images/serve-review.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01 \
  --port=3357
```

Open:

```text
http://127.0.0.1:3357/review.html
```

- [x] **Step 3: Review candidates**

Approve only exact product matches. Mark unresolved rows as needs work with a short comment.

Expected artifact:

```text
data/product-images/catalog-2026-06-10-01/review-state.json
```

- [x] **Step 4: Run fallback rounds only for unresolved rows**

Use folders such as:

```text
fallback/
fallback2/
manual/
```

Every fallback/manual source must have enough provenance to populate:

- source page URL
- source image URL
- source type
- confidence
- review note

- [x] **Step 5: Merge decisions**

Run:

```bash
npx tsx scripts/product-images/merge-review-decisions.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01 \
  --review-source=main:review-state.json:image-candidates.json \
  --review-source=fallback:fallback/review-state.json:fallback/image-candidates.json \
  --review-source=manual:manual/review-state.json:manual/image-candidates.json
```

Expected:

```text
data/product-images/catalog-2026-06-10-01/merged-review-decisions.json
```

---

## Task 3: Cut Out and Finalize Batch 01

**Files/artifacts:**

- Create: `data/product-images/catalog-2026-06-10-01/selected/`
- Create: `data/product-images/catalog-2026-06-10-01/selected-nobg/`
- Create: `data/product-images/catalog-2026-06-10-01/final/`

- [x] **Step 1: Copy selected originals**

Use `merged-review-decisions.json` to create `selected/` with one reviewed source image per approved product.

Expected:

```text
data/product-images/catalog-2026-06-10-01/selected/
```

contains one original source image per approved product.

- [x] **Step 2: Remove backgrounds using the documented local workflow**

Follow:

```text
docs/product-image-background-removal.md
```

Use Vision first, padded Vision for tight crops, rembg for haze, and baked-shadow removal only where needed.

Expected:

```text
data/product-images/catalog-2026-06-10-01/selected-nobg/
```

contains RGBA PNGs, one per approved product, with product ids in filenames.

- [x] **Step 3: QA cutouts on magenta**

Run from the batch directory:

```bash
swift scripts/product-images/qa-composite.swift \
  /tmp/catalog-2026-06-10-01-magenta \
  data/product-images/catalog-2026-06-10-01/selected-nobg/*.png
```

Expected:

- no obvious halos
- no beige/gray shadow smears
- label text preserved
- product edges not eaten

- [x] **Step 4: Composite final assets**

Run:

```bash
npx tsx scripts/product-images/process-selected-images.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01 \
  --input-dir=data/product-images/catalog-2026-06-10-01/selected-nobg \
  --expected-count=50
```

Expected:

```text
data/product-images/catalog-2026-06-10-01/final/
data/product-images/catalog-2026-06-10-01/final-assets.json
data/product-images/catalog-2026-06-10-01/final-review.html
```

- [x] **Step 5: Final visual review**

Open:

```text
http://127.0.0.1:3357/final-review.html
```

Approve only if the batch looks coherent in size, clean on the neutral background, and exact-product correct.

---

## Task 4: Manifest, Dry-Run, Publish Batch 01

**Files/artifacts:**

- Create: `data/product-images/catalog-2026-06-10-01/manifest.csv`
- Mutates: Supabase Storage and `public.products.image_url` only after publish

- [x] **Step 1: Generate manifest**

Run:

```bash
npx tsx scripts/product-images/generate-pilot-manifest.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01 \
  --expected-count=50 \
  --candidate-files=image-candidates.json,fallback/image-candidates.json,fallback2/image-candidates.json,manual/image-candidates.json
```

If fewer than 50 products are approved, either complete fallback sourcing first or intentionally reduce `--expected-count` and record unresolved rows in a backlog CSV.

- [x] **Step 2: Spot-check manifest**

Open:

```text
data/product-images/catalog-2026-06-10-01/manifest.csv
```

Check every fallback/manual row:

- `source_page_url` points to the actual source
- `source_image_url` points to the actual image
- `source_type` is plausible
- `quality_confidence` is not inflated
- `notes` explain uncertainty or manual sourcing

- [x] **Step 3: Dry-run publish**

Run:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01 \
  --batch-id=catalog-2026-06-10-01 \
  --expected-count=50 \
  --dry-run
```

Expected:

- validates 50 approved payloads
- storage bucket preflight passed
- database preflight passed
- storage paths start with `catalog-2026-06-10-01/`

- [x] **Step 4: Publish**

Run only after dry-run and final review pass:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=data/product-images/catalog-2026-06-10-01 \
  --batch-id=catalog-2026-06-10-01 \
  --expected-count=50
```

Expected:

- `OK product=... url=...` for each approved product
- Supabase `products.image_url` updated for the batch
- `product_image_assets.manifest_batch_id = catalog-2026-06-10-01`

- [x] **Step 5: Verify database counts**

Run:

```bash
npx supabase db query --linked "
select
  count(*) filter (where is_active and image_url is null) as active_missing_images,
  count(*) filter (where is_active and image_url is not null) as active_with_images
from public.products;
"
```

Expected after a full 50-product publish:

```text
active_missing_images decreases by 50
active_with_images increases by 50
```

Actual Batch 01 result on 2026-06-11:

- 49 product images published for `catalog-2026-06-10-01`
- 1 catalog duplicate intentionally excluded: `OGX Renewing` duplicates
  `OGX Renewing Argan Oil`
- Post-publish verification found 49 manifest rows, 49 matching
  `products.image_url` values, 49 matching audit rows, and 0 missing products or
  mismatches

---

## Task 5: Local App QA for Batch 01

**Files:**

- Existing UI: `src/components/chat/product-card.tsx`
- Existing UI: `src/components/chat/product-image.tsx`

- [x] **Step 1: Run local app with dev login**

Run:

```bash
LOCAL_DEV_LOGIN_ENABLED=1 npm run dev:worktree
```

Open:

```text
http://localhost:<port>/api/dev/login?next=/chat
```

- [x] **Step 2: Trigger recommendation cards**

Ask for categories/products represented in the new batch.

Check:

- product image renders
- mobile card layout remains stable
- fallback icon still works for products without images
- no distorted or tiny product images

- [x] **Step 3: Capture unresolved issues**

If a product image is wrong, too small, or ugly, do not patch the UI first. Fix the source asset and republish that product with a new hash-versioned asset.

Batch 01 local app QA notes:

- Product cards rendered real Supabase image URLs in chat on mobile width.
- The fallback icon path remains in place for products without `image_url`.
- The Sante conditioner wrong-candidate issue was fixed at source and
  republished before considering the batch complete.
- Final sizing was regenerated with area-based normalization after visual QA
  showed wide products could look too large against tall bottles.

---

## Task 6: Repeat Remaining Batches

**Batch cadence based on 213 missing active images on 2026-06-10:**

- `catalog-2026-06-10-01`: 50 products
- `catalog-2026-06-10-02`: 50 products
- `catalog-2026-06-10-03`: 50 products
- `catalog-2026-06-10-04`: 50 products
- `catalog-2026-06-10-05`: final 13 products with `--allow-partial` and `--expected-count=13`

- [ ] **Step 1: Repeat selection after each publish**

Because published products no longer have `image_url IS NULL`, rerun selection after each batch instead of precomputing all five batches up front.

- [ ] **Step 2: Use the same review/publish gates**

Do not publish a batch unless:

- final review is approved
- manifest has been spot-checked
- dry-run passes
- local app QA passes for a sample of products

- [ ] **Step 3: Track unresolved products**

Create:

```text
data/product-images/catalog-unresolved-products.csv
```

Columns:

```text
product_id,brand,name,category,reason,last_checked_at,notes
```

Use this only for products that cannot be confidently sourced after fallback/manual search.

---

## Verification Checklist

Automated:

- [x] `npx tsx --test tests/product-images-manifest.test.ts`
- [x] `npm run test:node`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] Publish dry-run for Batch 01

Manual:

- [x] Candidate review UI checked for every Batch 01 product
- [x] Magenta cutout QA checked for every Batch 01 cutout
- [x] Final review page checked for every Batch 01 final asset
- [x] Manifest fallback/manual rows spot-checked for Batch 01
- [x] Local chat recommendation cards checked on mobile width after publish

Shipping gates:

- [ ] Run `autoreview` after final code/script/doc changes
- [ ] Ask for explicit approval before commit/push/PR
- [ ] Before merge, confirm Supabase migration state and live PR CI
