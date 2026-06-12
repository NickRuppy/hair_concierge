# Product Image Pilot Runbook

This runbook documents the 20-product image pilot from June 10, 2026 and the
repeatable process we should use before scaling to the full catalog.

The goal is to publish exact single-product images for recommendation cards:
reviewed source image, transparent cutout, Chaarlie-neutral background, coherent
visual sizing, Supabase Storage asset, and an audit row that records provenance.

## Current Pilot State

- Batch id: `pilot-2026-06-10`
- Batch directory: `data/product-images/pilot-2026-06-10/`
- Published count: 20 products
- Storage bucket: `product-images`
- App field updated: `products.image_url`
- Audit table: `public.product_image_assets`
- Final asset format: `1200x1200` WebP
- Final background: neutral light beige `rgb(243, 239, 232)`
- Final visual sizing: transparent subject bounds centered and fit inside a
  `940x940` max side box with an additional visual-area cap on the
  `1200x1200` canvas

The pilot proved that public product pages can work, but source quality varies a
lot. User review remains required before publishing.

## Before Scaling Beyond the Pilot

Do not run a larger batch accidentally with the pilot defaults. The scripts now
support explicit scale-up flags, but default to the pilot for reproducibility:

- `--batch-id` controls immutable storage path prefix and
  `product_image_assets.manifest_batch_id`.
- `--expected-count` controls manifest/final-asset row validation.
- `--candidate-file` or `--candidate-files` controls which scrape/fallback
  `image-candidates.json` files feed source provenance.
- The review UI uses fixed localStorage keys, so browser state can carry across
  runs unless the JSON review-state file is treated as the source of truth.

For every non-pilot batch, pass those flags explicitly. Never publish a larger
batch until a dry-run shows the intended storage paths, batch id, and product
count.

The pilot defaults live in:

- `DEFAULT_PRODUCT_IMAGE_BATCH_ID` in `scripts/product-images/manifest.ts`
- `DEFAULT_PRODUCT_IMAGE_EXPECTED_COUNT` in
  `scripts/product-images/manifest.ts`
- default fallback source folders in
  `scripts/product-images/generate-pilot-manifest.ts`

Important: a new folder like `fallback5/` is ignored by manifest generation
unless it is passed with `--candidate-file=fallback5/image-candidates.json` or
included in `--candidate-files=...`.

## What Counts as a Good Image

Use these rules during review:

- The image must show the exact product and variant, not merely the same brand or
  category.
- Prefer a clean single-product packshot. Keep brand-provided props only when
  they are part of the official product arrangement and do not confuse the exact
  product.
- Front or recognizable packaging views are preferred. Top views are acceptable
  for tubs/masks when they are the exact product and there is no better source.
- Reject tiny, blurry, cropped, multi-product, outdated-packaging, or wrong-size
  candidates.
- Brand and retailer sources are preferred. Search-result or unknown sources need
  extra notes and should stay `medium` confidence at most.

The pilot used a practical publish threshold of 20/20 user-approved final
images. For larger batches, only publish rows with `user_approved=yes`; do not
publish low-confidence or unresolved rows.

## Local Batch Layout

Each batch should use one directory:

```text
data/product-images/<batch-id>/
  pilot-products.csv
  candidates/
  image-candidates.json
  review.html
  review-state.json
  fallback*/
  merged-review-decisions.json
  selected/
  selected-nobg/
  final/
  final-assets.json
  final-review.html
  final-review-state.json
  manifest.csv
```

`selected/` contains the reviewed original source images. `selected-nobg/`
contains the transparent PNG cutouts. `final/` contains the publishable WebP
assets.

## Step 1: Select Products

For the pilot, we selected a mixed 20-product set from active products without
`image_url`, spreading across categories before filling the remaining slots.

Preflight the selected CSV before scraping:

- every row has a product id that exists in Supabase
- every row has a usable public product page or source page URL
- products already published in a previous batch are excluded unless the goal is
  to replace their image
- the batch size matches the expected publish count

```bash
npx tsx scripts/product-images/select-pilot-products.ts \
  --out=data/product-images/pilot-2026-06-10/pilot-products.csv
```

For the next scale batch, keep the same idea but change the batch id and batch
size deliberately. The current validation scripts default to exactly 20; update
the expected count before publishing larger batches.

## Step 2: Scrape Candidates

Scrape public product pages from `pilot-products.csv`.

```bash
npx tsx scripts/product-images/scrape-pilot-images.ts \
  --batch-dir=data/product-images/pilot-2026-06-10
```

The scraper uses:

- static HTML candidates: Open Graph, Twitter image, JSON-LD, image tags, srcset
- browser-rendered candidates via Playwright for pages that hydrate images
- score heuristics for product-looking URLs and usable dimensions
- filters for SVGs, logos, tiny assets, and non-image downloads

Expected failure modes:

- product page blocks requests with 403
- candidate image download returns 404
- page image is a thumbnail
- source is wrong variant or old packaging
- image is embedded behind shop-specific scripts and needs a fallback search

## Step 3: Review Candidates

Serve the batch review UI:

```bash
npx tsx scripts/product-images/serve-review.ts \
  --batch-dir=data/product-images/pilot-2026-06-10 \
  --port=3357
```

Open:

```text
http://127.0.0.1:3357/review.html
```

Review each product:

- mark the best candidate `Good`, `Maybe`, or `Bad`
- select the candidate image
- mark product decision as approved, needs work, or rejected
- add a comment when the match is uncertain, wrong, or manually fixed

The review UI stores state in browser localStorage and posts a JSON copy beside
the review page as `review-state.json`. Use the JSON file as the source of
truth for later merge steps.

For a new batch, verify that `review-state.json` exists and contains the current
review before merging. If the browser was used for an older batch, do not trust
the localStorage badge alone.

## Step 4: Fallback Search Rounds

Do fallback rounds for unresolved products only. Keep each round in its own
folder, for example:

```text
fallback/
fallback2/
fallback3/
fallback4/
```

Each fallback should produce its own `review.html`, `image-candidates.json`, and
`review-state.json`. The pilot used these rounds for products where the first
scrape found broken images, wrong variants, or no usable source.

If a product is sourced manually outside the scraper, record enough provenance
for manifest generation:

- source page URL
- direct source image URL
- local selected file path
- source type and confidence
- reviewer note explaining why the manual source was accepted

If that manual source does not appear in an `image-candidates.json` file, edit
the manifest after generation. Otherwise `generate-pilot-manifest.ts` may fall
back to the product affiliate page as `source_page_url`, which is wrong for a
manually sourced image.

Merge review decisions after the main and fallback rounds:

```bash
npx tsx scripts/product-images/merge-review-decisions.ts \
  --batch-dir=data/product-images/pilot-2026-06-10
```

For non-pilot folders, pass every review source that should participate in the
merge:

```bash
npx tsx scripts/product-images/merge-review-decisions.ts \
  --batch-dir=data/product-images/catalog-2026-06-11 \
  --review-source=main:review-state.json:image-candidates.json \
  --review-source=fallback:fallback/review-state.json:fallback/image-candidates.json \
  --review-source=manual:manual/review-state.json:manual/image-candidates.json
```

The merged output should contain exactly the products approved for final image
processing.

## Step 5: Background Removal

The final pilot cutouts were not produced by the rough Sharp edge-removal
heuristic. The good results came from the local cutout workflow documented in:

[Product-Image Background Removal](../product-image-background-removal.md)

Use that document as the authoritative cutout step. In short:

1. Check whether the source already has a useful alpha channel.
2. Use macOS Vision subject-lift first for normal packshots.
3. Use the padded Vision variant for tight crops.
4. QA every cutout on magenta.
5. Use `rembg` for haze/gradient failures.
6. Use `remove-baked-shadow.py` plus the second-pass workflow for baked-in
   shadows, especially brand assets with opaque drop shadows.

Place final transparent PNG cutouts in:

```text
data/product-images/<batch-id>/selected-nobg/
```

Each file name must include the product id, because the final compositor matches
files by product id.

Important: do not run the old local Sharp background-removal heuristic as the
final cutout method. It was useful as an early prototype, but it produced worse
edges than the Vision/rembg workflow.

## Step 6: Composite and Normalize Final Assets

Once `selected-nobg/` contains one transparent PNG per approved product,
generate the final assets:

```bash
npx tsx scripts/product-images/process-selected-images.ts \
  --batch-dir=data/product-images/pilot-2026-06-10 \
  --input-dir=data/product-images/pilot-2026-06-10/selected-nobg \
  --expected-count=20
```

When `--input-dir` is provided, the script skips background removal and treats
the files as already-cut transparent assets. It then:

- reads the alpha bounds
- crops to product content with a small margin
- resizes the product into a `940x940` max box
- centers it on a `1200x1200` canvas
- paints the neutral Chaarlie background
- writes WebP at quality 88
- writes `final-assets.json`
- writes `final-review.html`

The important sizing decision from the pilot: do allow upscaling into the
`940x940` box. Without upscaling, small source files stay visually tiny next to
larger products.

The first 50-product catalog batch added one more sizing rule: cap visual area,
not only max side length. Wide tubs, masks, and squat jars can look much larger
than tall bottles when everything is normalized only by the longest side. The
compositor now uses both:

- max product side: `940px`
- target visual alpha area: `460000px`

This keeps tall bottles readable while preventing wide products from dominating
the card.

Review the final page:

```text
http://127.0.0.1:3357/final-review.html
```

Only proceed when the final images look coherent together.

## Step 7: Generate the Publish Manifest

Generate the manifest from the final assets and reviewed source metadata:

```bash
npx tsx scripts/product-images/generate-pilot-manifest.ts \
  --batch-dir=data/product-images/pilot-2026-06-10
```

For a larger batch, be explicit:

```bash
npx tsx scripts/product-images/generate-pilot-manifest.ts \
  --batch-dir=data/product-images/catalog-2026-06-11 \
  --expected-count=50 \
  --candidate-files=image-candidates.json,fallback/image-candidates.json,fallback2/image-candidates.json
```

The manifest captures:

- product id, brand, name, category
- source page URL
- source image URL
- source type: `brand`, `retailer`, `marketplace`, `search_result`, `unknown`
- quality confidence: `high` or `medium`
- processing method: `local`, `third_party`, or `manual`
- final file path
- SHA-256 hash
- user approval
- notes

The publish code validates:

- exact expected row count
- no duplicate product ids
- approved rows only
- no `low` confidence rows
- hash matches local file
- final file stays inside the batch directory
- search-result/unknown sources include notes

These validations are covered by `tests/product-images-manifest.test.ts`, which
should run through `npm run test:node`.

After generation, manually scan `manifest.csv` before dry-run. Pay special
attention to rows from fallback or manual sourcing: `source_page_url`,
`source_image_url`, `source_type`, `quality_confidence`, and `notes` must
describe the actual image that was used, not just the original product page.

## Step 8: Publish to Supabase

Before publishing, make sure the storage bucket, audit table, and RPC exist via:

```text
supabase/migrations/20260610120000_product_image_assets.sql
```

The migration creates:

- public storage bucket `product-images`
- `public.product_image_assets`
- one audit row per product image
- `public.publish_product_image_asset(...)`

Do not run a broad `supabase db push` if migration history is divergent. For the
pilot, this migration was applied surgically and then marked applied.

For future batches, check whether the migration is already applied before
publishing. The current publisher preflights products, storage bucket, and the
audit table. It does not currently preflight the RPC before the first upload; a
missing RPC is surfaced during publish, with cleanup for objects uploaded in the
same run.

The audit table has RLS enabled without client read policies. That is
intentional: publishing uses the service role, and the app reads the final public
URL from `products.image_url`.

Dry-run first:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=data/product-images/pilot-2026-06-10 \
  --batch-id=pilot-2026-06-10 \
  --expected-count=20 \
  --dry-run
```

Publish only after dry-run passes:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=data/product-images/pilot-2026-06-10 \
  --batch-id=pilot-2026-06-10 \
  --expected-count=20
```

For a larger batch, change all three values deliberately:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=data/product-images/catalog-2026-06-11 \
  --batch-id=catalog-2026-06-11 \
  --expected-count=50 \
  --dry-run
```

The publisher:

- validates the manifest
- checks the products exist
- checks the storage bucket exists
- checks the audit table exists
- uploads immutable hash-versioned files to Supabase Storage
- calls `publish_product_image_asset` to update `products.image_url` and upsert
  the audit row atomically
- removes any just-uploaded object if the DB publish step fails

Re-running a publish with the same manifest is expected to converge: storage
paths include the asset hash, existing objects are skipped, and the audit row is
upserted by product id.

## Step 9: Verify in the App

Run the local app:

```bash
LOCAL_DEV_LOGIN_ENABLED=1 npm run dev:worktree
```

Log in locally:

```text
http://localhost:<port>/api/dev/login?next=/chat
```

Then trigger a recommendation flow that returns products from the pilot set.
Check:

- image renders in the recommendation card
- image and text fit on mobile
- fallback icon still renders for products without `image_url`
- product image URLs are loaded from the Supabase public storage bucket

The current app allowlists the Supabase public storage host in `next.config.ts`.
If the Supabase project ref or storage host changes, update the image
`remotePatterns` and CSP image sources before expecting product images to render.

## Scaling Recommendation

Scale in controlled batches, not in one blind publish.

Recommended next batch:

- 50 products
- same scrape/review/cutout/publish pipeline
- manual review only for uncertain scrape results and every final contact sheet
- publish only approved rows

Before moving beyond 50-product batches, preserve every batch manifest and
review-state file as the provenance record for future audits.

## Next Batch Recipe

Use this as the short operational recipe for the next 50-product batch. Replace
`catalog-YYYY-MM-DD-NN` once at the top and keep the same value through every
command.

```bash
export BATCH_ID=catalog-YYYY-MM-DD-NN
export BATCH_DIR=data/product-images/$BATCH_ID
```

1. Select the next products after the previous batch is published:

```bash
npx tsx scripts/product-images/select-pilot-products.ts \
  --limit=50 \
  --allow-partial \
  --out=$BATCH_DIR/pilot-products.csv
```

2. Scrape raw candidates:

```bash
npx tsx scripts/product-images/scrape-pilot-images.ts \
  --batch-dir=$BATCH_DIR \
  --pilot=$BATCH_DIR/pilot-products.csv
```

3. Do not send the raw scrape straight to review. First apply the source
   learnings from batches 01-05:

- Prefer exact retailer/brand hero or meta images over page `img` tags.
- On DM pages, `browser-meta` is often the exact product hero. Related-product
  carousel thumbnails can share brand/category words but be the wrong SKU.
- Compare image URL slugs against the product page slug. If the URL slug points
  at another product, drop it.
- Drop banners, lifestyle panels, recommendation-grid images, logos, icons,
  ingredient/texture detail shots, and back-of-pack-only candidates unless they
  are the only exact source and the reviewer explicitly accepts them.
- For hard cases, make a small rescue review folder rather than expanding the
  full review set with noise. Good rescue sources so far: official brand CDN,
  DM/Rossmann/Mueller/Hagel product images, YesStyle/Lyko/Walmart/Incidecoder
  originals when they show the exact single product.

Create learned review folders as needed, for example:

```text
$BATCH_DIR/learned/
$BATCH_DIR/learned2/
$BATCH_DIR/learned3/
```

Each review folder must contain its own `image-candidates.json`, `review.html`,
and `review-state.json`. Keep the final reviewer work small: first show the
high-confidence learned set, then only show rejected rows in rescue rounds.

4. Serve review pages locally:

```bash
npx tsx scripts/product-images/serve-review.ts \
  --batch-dir=$BATCH_DIR \
  --port=3357
```

Review URLs then follow the folder names:

```text
http://127.0.0.1:3357/learned/review.html
http://127.0.0.1:3357/learned2/review.html
http://127.0.0.1:3357/learned3/review.html
```

5. Merge every approved review source into `selected/`. Pass the final set of
   review folders explicitly:

```bash
npx tsx scripts/product-images/merge-review-decisions.ts \
  --batch-dir=$BATCH_DIR \
  --review-source=learned:learned/review-state.json:learned/image-candidates.json \
  --review-source=learned2:learned2/review-state.json:learned2/image-candidates.json \
  --review-source=learned3:learned3/review-state.json:learned3/image-candidates.json
```

Only continue when this reports exactly 50 approved rows and `selected/` has 50
files whose names include product ids.

6. Remove backgrounds and QA the transparent cutouts.

Use [Product-Image Background Removal](../product-image-background-removal.md)
as the authoritative cutout procedure. The short operational rule is:

- Check source alpha first. If the source already has clean transparency, pass
  it through as RGBA PNG; do not run a segmentation model over good alpha.
- For flat packshots without alpha, use macOS Vision subject-lift
  (`removebg.swift`) first.
- If Vision reports no subject because the product fills the frame, use
  `removebg-padded.swift`.
- If Vision leaves haze/gradients, try `rembg` with `isnet-general-use`.
- For fully opaque baked-in shadows inside brand alpha assets, use
  `remove-baked-shadow.py`; for vividly colored products, try flattened
  BiRefNet first because it can separate gray shadow from the product body.
- For sachets or boxes whose printed artwork includes people, do not let
  Vision lift the person out of the package art. If the product is the full
  rectangle, use full-opacity passthrough instead.
- QA every output on magenta with `qa-composite.swift`. White preview
  backgrounds hide halos, haze, and shadow remnants.

If the cutout work is outsourced, keep the same acceptance bar: returned files
must be transparent PNG/RGBA cutouts, visually QA'd on a colored background, and
saved in:

```text
$BATCH_DIR/selected-nobg/
```

Keep product ids in the filenames. The compositor matches by product id, not by
file order. Before compositing, verify file count, product-id coverage, and that
the returned files are PNG/RGBA.

7. Composite final assets from the returned cutouts:

```bash
npx tsx scripts/product-images/process-selected-images.ts \
  --batch-dir=$BATCH_DIR \
  --input-dir=$BATCH_DIR/selected-nobg \
  --expected-count=50
```

Review:

```text
http://127.0.0.1:3357/final-review.html
```

8. Generate and validate the manifest. Include every candidate file that
   contributed approved sources:

```bash
npx tsx scripts/product-images/generate-pilot-manifest.ts \
  --batch-dir=$BATCH_DIR \
  --expected-count=50 \
  --candidate-files=learned/image-candidates.json,learned2/image-candidates.json,learned3/image-candidates.json
```

If the background removal was outsourced, set `processing_method` to
`third_party` in all manifest rows before publishing. Use a real CSV parser or
regenerate the manifest before editing; product image URLs can contain commas,
so a naive `split(",")` corrupts the manifest.

9. Dry-run publish:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=$BATCH_DIR \
  --batch-id=$BATCH_ID \
  --expected-count=50 \
  --dry-run
```

Only publish after the dry-run shows exactly 50 payloads, bucket/database
preflight passes, and storage paths use the intended batch id.

10. Publish and verify:

```bash
npx tsx scripts/product-images/publish-pilot-images.ts \
  --batch-dir=$BATCH_DIR \
  --batch-id=$BATCH_ID \
  --expected-count=50
```

After publishing, verify:

- 50 `products.image_url` values point to `/product-images/$BATCH_ID/`
- 50 `product_image_assets` rows exist for `manifest_batch_id = $BATCH_ID`
- product URLs match audit public URLs
- one sampled public asset returns `200 image/webp`
- local chat recommendation cards still render on mobile width

## Catalog Batch 01 Learnings

Batch `catalog-2026-06-10-01` published 49 reviewed assets and intentionally
excluded one duplicate product (`OGX Renewing` duplicated `OGX Renewing Argan
Oil` by product code `3574661799162`). Reuse these lessons for later batches:

- Duplicate detection should happen before review. If two catalog rows share a
  GTIN/product code or clearly resolve to the same retailer product, pick one
  canonical row and leave the duplicate for catalog cleanup.
- DM and Rossmann product pages often gave the cleanest exact packshots. Prefer
  those retailer product images when they match exactly, even when a brand page
  exists but has lifestyle, multi-product, or wrong-variant imagery.
- Brand assets with alpha are useful, but still require magenta QA. A transparent
  PNG can still contain baked shadows or graphic overlays inside the alpha.
- Hagel-style pages can fail through Node/browser fetch because of very large
  headers. If that happens, manual `curl`/HTML extraction is acceptable, but the
  fallback `image-candidates.json`, review note, and manifest provenance must
  record the real source page and direct image URL.
- Similar product names are risky. The Sante correction showed why final review
  must check exact product form, not just brand/category/name similarity; a mask
  sachet can look plausible for a conditioner unless the package is inspected.
- Top views are acceptable for tubs/masks when the reviewer confirms they are
  exact products. Do not reject them only because they are not front-facing.
- If one asset looks too big after max-side normalization, regenerate with the
  area-capped compositor instead of shrinking the image in the UI.

For the first 50-product batch, run the full local pipeline but publish only
after:

- final review page is approved
- `manifest.csv` is manually spot-checked for every fallback/manual row
- publish dry-run shows exactly 50 payloads
- at least a few published images are verified in the local chat UI on mobile
  width

## Known Follow-Ups

- Generalize `PRODUCT_IMAGE_BATCH_ID` and expected manifest count for larger
  batches.
- Add a source-search helper for unresolved products instead of creating
  fallback folders manually.
- Add a final contact sheet command to make visual QA faster.
- Decide whether rejected/needs-work rows should be saved in a separate backlog
  CSV for later manual sourcing.
- Consider a small admin/internal page later, but keep messy scraping and image
  processing local for now. Supabase should receive only the clean final assets
  and provenance rows.
