# Product Intake Research Ops

This is the canonical operator runbook for adding products to Chaarlie from user
submissions or internal catalog work.

The goal is simple: every approved product should enter the catalog with the
same standard of identity, category properties, sources, image quality, user
linking, and chat notification. The workflow is intentionally local-first until
Nick explicitly approves a write to Supabase.

## Core Rule

Codex and the local review app may prepare and edit local package files. They
must not write researched products into Supabase.

Only this explicit approval command may write the reviewed product, upload the
final image, link it to the user, and send the chat notification:

```bash
npm run products:intake:approve-package -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id> --reviewed-by nick --apply --confirm
```

Never run this command without Nick explicitly approving that exact package.

## What This Workflow Covers

- User-submitted products from chat or onboarding.
- Internally added products that should follow the same review standard.
- Researching identity, category, product properties, sources, price/link data,
  and product images.
- Comparing user-uploaded photos with researched product images.
- Removing product-image backgrounds locally.
- Adding the Chaarlie product-image background and normalized sizing.
- Uploading the final asset to the public Supabase `product-images` bucket.
- Writing the approved product into `products` and category-specific spec
  tables.
- Linking the approved product back to `user_product_usage`.
- Sending the user a chat notification after approval.

## Safety Boundaries

- Local packages live under `ops/product-intake-research/YYYY-MM-DD/<submission-id>/`.
- `ops/product-intake-research/` is gitignored because packages can contain user
  submission data, signed image links, local review decisions, and source
  assets.
- The review app saves only package-local files such as `payload.json`,
  `image-review.json`, `property-review.json`, `image-finalization.json`, and
  `package-approval.json`.
- The review app must not call Supabase write APIs, approval commands, upload
  commands, or migrations.
- Approval commands must be dry-run first unless Nick explicitly chooses to
  apply.
- If a product may already exist, prefer linking the existing product over
  creating a duplicate.

## Required Environment

Use the product-intake worktree until this stack has merged:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke
```

Supabase project:

```text
pqdkhefxsxkyeqelqegq
```

Required database/storage prerequisites:

- product-intake submission tables
- identity tables for brands/product lines/categories
- review RPCs, including:
  - `product_intake_approve_reviewed_product`
  - `product_intake_link_existing_product`
  - `product_intake_request_more_info`
  - `product_intake_reject_submission`
- public `product-images` storage bucket
- private `product-intake` upload bucket for user-submitted photos

Before the first real approval in an environment, verify migrations through the
normal Supabase migration workflow. Do not write approvals against a database
that is missing the product-intake tables/RPCs or the `product-images` bucket.

## End-to-End Workflow

### 1. Check The Queue

```bash
npm run products:intake:queue -- --status pending_review --report
```

Use the review-focused queue when you need the daily operator view:

```bash
npm run products:intake:queue
```

Without `--status`, the queue defaults to actionable review-lane statuses.

Primary actionable statuses:

- `pending_review`: user submitted product; package can be prepared.
- `researching`: local package exists or research is in progress.
- `ready_for_review`: package has a complete payload and is ready for Nick.
- `needs_more_info`: user needs to provide missing/clearer information.

Closed statuses should be visible only when explicitly filtered:

- `approved`
- `matched_existing`
- `rejected`

### 2. Prepare Local Research Packages

```bash
npm run products:intake:prepare-research -- --limit=10
```

This creates package folders without writing to Supabase.

Package location:

```text
ops/product-intake-research/YYYY-MM-DD/<submission-id>/
```

Expected package files:

- `submission.json`: raw submission data and signed user-photo metadata.
- `research.md`: human-readable reasoning, source links, caveats, and open
  concerns.
- `payload.json`: final researched product payload in
  `ProductIntakeFinalReviewedPayload` shape.
- `validation.json`: dry-run validation result.
- `approval.md`: checklist plus exact approval commands.
- `image-candidates.json`: renderable product-image candidates.
- `image-review.json`: reviewer decision for image candidate.
- `property-review.json`: reviewer decisions for category properties.
- `image-finalization.json`: final image asset decision.
- `package-approval.json`: final local approval marker.
- `images/`: package-local image evidence and processed assets.

Fresh packages may start incomplete. That is expected. A first package can have
`validation.json` with `ok: false` until research is complete.

### 3. Research Product Identity First

Before adding a new product row, check whether the product already exists.

Search all active catalog products, including products with
`is_chaarlie_recommended = false`. This matters because user-submitted products
can already exist for one user and should not be duplicated for another.

Use these identity rules:

- Category is required because it tells us how the user uses the product.
- Brand, product line, clean product name, and category should be separated.
- Product line is optional and internal, but should be captured when real.
- User wording can be messy; do not force user-facing names into canonical
  schema fields without review.
- If one exact existing product is found, use the existing-product link flow.
- If multiple plausible products exist, keep the package in review instead of
  inventing a match.
- If the category is unsupported, do not create a product in this flow yet.

Existing-product link command:

```bash
npm run products:intake:link-existing -- --submission-id <submission-id> --product-id <product-id> --reviewed-by nick --review-notes "Existing catalog product confirmed"
```

Use this for cases like `Olaplex No.7 Bonding Oil`, where the catalog already
contains the exact product.

### 4. Research Product Properties

Research should be complete in one pass per product. Do not do partial category
research and leave the product half-usable.

For every product, fill:

- canonical brand
- optional product line
- clean product name
- category key
- `is_chaarlie_recommended = false` for user-submitted products
- origin, currently `user_submitted` or `curated`
- product URL and price when available
- final image URL only after image finalization
- category-specific properties and rerank specs
- source reasoning for every non-obvious property

For category-specific specs, the review app should show:

- current proposed value
- source or reasoning
- approve/reject action
- optional reviewer note

Nick can bulk-approve only when the table is clear and correct. If
`payload.json` changes after approval, approve changed rows again. The package
approval must be tied to the exact payload that will be imported.

### 5. Research Image Candidates

Preferred source order:

1. Brand product page.
2. Major retailer page such as dm, Rossmann, Douglas, Hagel, or other reputable
   shop.
3. Other search result only when source quality is clear and noted.

The review app must show:

- user-uploaded front photo, if available
- user-uploaded barcode/back photo, if available
- proposed product image candidate
- source page URL
- original image URL
- source type and quality confidence

The reviewer must be able to say:

- image fits
- find another image
- save comment

If images do not render, cache them into the package under `images/source/` and
update `image-candidates.json` to point at package-local files. The reviewer
must be able to visually inspect the image before approval.

### 6. Remove Background Locally

Product-image background removal is local and should follow this decision tree.

Scripts:

```text
scripts/product-images/removebg.swift
scripts/product-images/removebg-padded.swift
scripts/product-images/remove-baked-shadow.py
scripts/product-images/qa-composite.swift
```

Main directories inside a package:

```text
images/source/          original source candidates
images/selected/        exact selected source image
images/selected-nobg/   transparent product cutout PNG
images/qa/              magenta QA composites
images/final/           final Chaarlie-ready WebP
```

#### Step 6.1: Inspect Alpha First

Many brand/retailer product images already have usable transparency. Do not run
a model on good-alpha images; models can reintroduce shadows.

Use the package-local source folder:

```bash
/tmp/rembg-venv/bin/python3 - <<'EOF'
from PIL import Image
import numpy as np, glob
for f in sorted(glob.glob('ops/product-intake-research/YYYY-MM-DD/<submission-id>/images/selected/*')):
    im = Image.open(f)
    if 'A' in im.mode or im.mode == 'P':
        a = np.array(im.convert('RGBA'))[:,:,3]
        print(f, im.mode, f'transparent={(a==0).mean():.1%}')
    else:
        print(f, im.mode, '(no alpha)')
EOF
```

Interpretation:

- Good alpha and clean magenta QA: passthrough is allowed.
- Around 0-5% transparent can still be a legitimate tight crop; inspect it.
- Palette mode with no transparency should be treated as flat.
- No alpha means use Vision/rembg.

#### Step 6.2: Use macOS Vision For Flat Packshots

Default:

```bash
swift scripts/product-images/removebg.swift <output-dir> <input-file...>
```

Example:

```bash
swift scripts/product-images/removebg.swift \
  ops/product-intake-research/YYYY-MM-DD/<submission-id>/images/selected-nobg \
  ops/product-intake-research/YYYY-MM-DD/<submission-id>/images/selected/*.webp
```

If Vision says no subject found because the product fills the frame, use:

```bash
swift scripts/product-images/removebg-padded.swift <input-file> <output-file.png>
```

For packets/boxes where printed artwork contains a person, Vision may lift the
person inside the label instead of the product. In those cases, a full-opacity
passthrough can be correct if the product itself is the full rectangle.

#### Step 6.3: QA On Magenta

This is mandatory. White-background previews hide shadows.

```bash
swift scripts/product-images/qa-composite.swift /tmp/qa-magenta \
  ops/product-intake-research/YYYY-MM-DD/<submission-id>/images/selected-nobg/*.png
```

Look for:

- gray or beige smudges beside the product
- bottom reflections
- background haze
- halos
- missing label areas
- damaged transparent caps/bottles

Also check every cutout is RGBA:

```bash
python3 - <<'EOF'
from PIL import Image
import glob
for f in sorted(glob.glob('ops/product-intake-research/YYYY-MM-DD/<submission-id>/images/selected-nobg/*.png')):
    im = Image.open(f)
    assert im.mode == 'RGBA', f'{f}: {im.mode}'
print('all RGBA ok')
EOF
```

#### Step 6.4: Use rembg When Vision Leaves Haze

One-time local setup:

```bash
brew install python@3.13
python3.13 -m venv /tmp/rembg-venv
/tmp/rembg-venv/bin/pip install "rembg[cpu,cli]" scipy
```

Use `isnet-general-use` for haze or gradients:

```bash
/tmp/rembg-venv/bin/rembg i -m isnet-general-use <input-file> <output-file.png>
```

Do not use `@imgly/background-removal-node` for final output. It can write
palette-mode PNGs with degraded alpha.

#### Step 6.5: Handle Baked Shadows

Some brand assets bake shadows into the product image as opaque pixels.

For white/light products, use the geometry script:

```bash
/tmp/rembg-venv/bin/python3 scripts/product-images/remove-baked-shadow.py <input-with-alpha> <output.png>
```

If a shadow touches a dark badge or label, add a saturation gate after checking
the image:

```bash
/tmp/rembg-venv/bin/python3 scripts/product-images/remove-baked-shadow.py <input-with-alpha> <output.png> 10
```

For vividly colored products, flattening and BiRefNet can sometimes work better:

```bash
python3 - <<'EOF'
from PIL import Image
im = Image.open('deshadowed.png').convert('RGBA')
bg = Image.new('RGBA', im.size, (255,255,255,255))
Image.alpha_composite(bg, im).convert('RGB').save('deshadowed-white.png')
EOF
/tmp/rembg-venv/bin/rembg i -m birefnet-general deshadowed-white.png final.png
```

Always run magenta QA again after shadow work.

### 7. Generate The Final Chaarlie Image

After the reviewer approves an image candidate and
`images/selected-nobg/` contains the clean cutout, generate the final image:

```bash
npm run products:intake:finalize-image -- ops/product-intake-research/YYYY-MM-DD/<submission-id>
```

The finalizer:

- uses the selected approved candidate
- verifies or uses the transparent cutout
- crops the product bounds
- normalizes object size
- composites onto Chaarlie's neutral product background
- writes a magenta QA preview
- writes a final `1200x1200` WebP under `images/final/`
- writes `image-finalization.json`
- computes SHA-256
- prepares the public `product-images` URL

If the quality gate returns `needs_image_work`, do not approve the image. Find a
better source or fix the cutout.

The reviewer must inspect the generated final image beside existing DB images
before approving it.

### 8. Approve The Final Image Decision

The image decision is valid only when `image-finalization.json` has:

```json
{
  "status": "approved_asset",
  "storage_bucket": "product-images",
  "storage_path": "product-intake/YYYY-MM-DD/<submission-id>/<file>.webp",
  "public_url": "https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/...",
  "source_page_url": "...",
  "source_image_url": "...",
  "source_type": "brand",
  "quality_confidence": "high",
  "processing_method": "local",
  "final_file": "images/final/<file>.webp",
  "asset_sha256": "...",
  "user_approved": true,
  "reviewed_by": "nick",
  "reviewed_at": "..."
}
```

For `search_result` or `unknown` source types, notes are required.

No-image approval is allowed only by explicit reviewer decision:

```json
{
  "status": "no_image_approved_for_now",
  "reason": "not_needed_for_v1",
  "notes": "Approved by Nick without final image for now.",
  "reviewed_by": "nick",
  "reviewed_at": "..."
}
```

Use no-image sparingly. The default standard is a reviewed Chaarlie-hosted image.

### 9. Upload Or Verify The Image

Dry-run:

```bash
npm run products:intake:upload-image -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id>
```

Apply only after explicit approval:

```bash
npm run products:intake:upload-image -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id> --apply --confirm
```

`approve-package --apply --confirm` also runs this upload/verification gate
before any database approval. The separate upload command is useful when Nick
wants to inspect the uploaded image URL before final product approval.

### 10. Dry-Run Package Approval

```bash
npm run products:intake:approve-package -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id> --reviewed-by nick
```

The dry-run must show:

- package submission id matches Supabase submission id
- researched payload is complete
- next status is `ready_for_review`
- image finalization is valid
- final image will be uploaded or verified before DB write
- approval will reload the submission after saving research payload
- apply requires `--confirm`

If dry-run fails, fix package files. Do not bypass dry-run failures.

### 11. Apply The Approval

Only after Nick approves the exact package:

```bash
npm run products:intake:approve-package -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id> --reviewed-by nick --apply --confirm
```

This command:

1. Verifies/uploads the final image asset.
2. Saves the researched payload.
3. Marks the submission ready for review.
4. Approves through the existing approval workflow.
5. Creates or links the `products` row.
6. Writes category-specific spec rows.
7. Links the approved product to the user's `user_product_usage` row.
8. Sends the chat notification through the existing notification path.
9. Writes the daily product-addition record under `data/product-additions/`.

User-submitted products should enter the catalog as:

```text
is_chaarlie_recommended = false
origin = user_submitted
```

They are available for the submitting user after approval, but should not become
globally recommended until the team promotes them later.

### 12. Verify After Approval

After approval, check:

- submission status is `approved` or `matched_existing`
- `approved_product_id` is set
- `user_product_usage.product_id` points to the approved product
- `user_product_usage.match_status = matched`
- product image URL renders
- category-specific specs exist
- chat notification exists in the origin conversation
- no duplicate product was created when an existing product should have been
  linked

## Daily Codex Operation

The recurring Codex job should do only the read/prep side:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke
npm run products:intake:queue -- --status pending_review --report
npm run products:intake:prepare-research -- --limit=5
```

The daily job should report:

- created package paths
- skipped existing packages
- blockers
- submissions needing more user information
- packages ready for review

The daily job must not run:

- `products:intake:upload-image --apply`
- `products:intake:approve-package --apply`
- migrations
- any Supabase write command

Once this stack is merged, move the automation from the integration worktree to
the final shipping/mainline worktree.

## What To Do When Research Finds An Existing Product

If research finds an existing exact product:

1. Do not create a new product row.
2. Use `link-existing`.
3. Notify the user through the existing review-result flow.
4. If the existing product has a weaker image or stale properties, create a
   separate catalog-quality follow-up instead of mixing it into this approval.

This avoids duplicate rows like a new `No.7 Bonding Oil` when `Olaplex No.7
Bonding Oil` already exists.

## What To Do When More Info Is Needed

Use the request-more-info path when identity cannot be established:

```bash
npm run products:intake:request-info -- --submission-id <submission-id> --reviewed-by nick --reason "Bitte lade ein klareres Foto der Vorderseite hoch." --next-step "Bitte lade ein scharfes Foto der Vorderseite hoch, auf dem Marke und Produktname lesbar sind."
```

The reason should tell the user what to change. Avoid vague reasons such as
`unclear`.

## What To Do When Rejecting

Reject only when the submission cannot become a supported product in this flow:

```bash
npm run products:intake:request-info -- --submission-id <submission-id> --reviewed-by nick --reason "..." --reject
```

Use precise reasons:

- unsupported category
- not a hair product
- duplicate spam/junk
- image/text does not identify a product
- user did not provide required details after follow-up

The product slot should be cleared or left unmatched according to the current
review action, and the user should receive a chat notification with the reason.

## Troubleshooting

### Images Do Not Render In The Review App

- Refresh signed links by regenerating the package.
- Prefer package-local cached images under `images/source/`.
- Update `image-candidates.json` so candidates point to local renderable files.
- Do not approve an image you cannot see.

### Finalizer Says The Image Needs Work

- Inspect the magenta QA file.
- If there is haze, try `rembg` with `isnet-general-use`.
- If there is a baked shadow, use `remove-baked-shadow.py`.
- If reflection/shadow remains too strong, find a cleaner source image.
- Re-run finalization after fixing `images/selected-nobg/`.

### Approval Dry-Run Fails

- Fix the local package first.
- Common causes:
  - missing `payload.json`
  - payload does not validate for the category
  - missing property approvals
  - missing image finalization
  - `image-finalization.json` public URL does not match `payload.json`
  - final image hash changed after approval
  - package submission id does not match folder id

### Duplicate Product Risk

- Search existing products before approval.
- Include non-Chaarlie user-submitted products in duplicate checks.
- If same brand/category/name is plausible, ask for review instead of creating.
- Use `link-existing` when exact identity is confirmed.

### User Notification Looks Wrong

- Verify the approved product canonical name.
- Notification copy should use the reviewed canonical product name, not raw
  user typo text, unless intentionally showing the submitted wording.
- If notification fails, capture it in Sentry and retry through the existing
  notification script after fixing the root cause.

## Agent Checklist

Before preparing a package:

- [ ] Confirm current worktree and branch.
- [ ] Confirm migrations/storage prerequisites.
- [ ] Run queue report.
- [ ] Prepare local package without Supabase writes.

Before asking Nick to review:

- [ ] Product identity checked against existing catalog.
- [ ] Sources are included and credible.
- [ ] Category-specific properties have reasoning.
- [ ] User photos and product image candidate render.
- [ ] Final image is generated and QA-visible.
- [ ] Package dry-run passes or blockers are clearly listed.

Before approval:

- [ ] Nick approved properties.
- [ ] Nick approved image or no-image decision.
- [ ] `approve-package` dry-run passes.
- [ ] Explicit approval was given for `--apply --confirm`.

After approval:

- [ ] Product row exists or existing product was linked.
- [ ] Category spec rows exist.
- [ ] User usage row is matched.
- [ ] Product image URL renders.
- [ ] User notification was sent.
- [ ] Daily product-addition record was written.
