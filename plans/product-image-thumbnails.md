# Stored product-image thumbnails

## Outcome and source context

Make product images in Personal Plan search appear quickly by serving a stored 144x144 derivative instead of downloading the 1200x1200 canonical image into a 48x48 card. Preserve the canonical image for larger presentation contexts.

Current evidence:

- Production has 278 products; 270 have a canonical `image_url`, including all 256 active products. A live read-only query verified that all 270 URLs point to the public Chaarlie `product-images` bucket; the remaining 8 have no canonical image.
- Stage 3 search currently returns `products.image_url`, the view-model passes only that URL, and the component renders it with a raw `<img>` in a 48x48 slot.
- The product-intake pipeline deliberately produces 1200x1200 WebP canonical files.
- Supabase's current Storage guidance recommends pre-generating common variants and using `cacheControl`; Smart CDN guidance recommends a new path when an asset changes.
- An earlier read-only probe reduced a representative Sante canonical image from 23,946 bytes to 1,295 bytes with a 96px transform, but the cold transform itself took about 0.5 seconds. That supports stored derivatives over first-view transforms, subject to the browser stop/go measurement below.
- Local planning evidence is recorded in [evidence/product-image-thumbnails/README.md](./evidence/product-image-thumbnails/README.md).

## Chosen direction

Keep two explicit assets:

1. `products.image_url` remains the canonical 1200x1200 presentation image.
2. `products.thumbnail_image_url` becomes the nullable fast-read projection for `search_thumbnail_v1`.

Do not add a second metadata table. The exact thumbnail path is `thumbnails/search-v1/<full-source-sha256>.webp`; it encodes the generator contract and canonical source identity, is knowable before a new product ID exists, and safely deduplicates identical canonical bytes. Product identity remains the database row holding the URL. Staleness is determined by hashing the current canonical bytes and comparing the expected path with `thumbnail_image_url`. Thumbnail bytes are checksum-verified during generation, upload, and the backfill manifest, but their checksum need not be duplicated in the database.

Generate with the root-workspace Sharp tool only: auto-orient, resize to 144x144 using explicit centered `fit: "cover"` to match the current card's `object-cover`, preserve alpha when present, and encode WebP quality 80/effort 5. `search_thumbnail_v1` owns these settings; a material algorithm change requires `search-v2` and a new path. Upload to the public `product-images` bucket with `cacheControl: "31536000"` and `upsert: false`, then download and verify format, dimensions, alpha behavior, and a sane size before updating the database. Encoder bytes may vary across Sharp/libvips platforms, so exact output checksum is recorded for the upload attempt but is not the reuse oracle. Here “immutable” describes the content-addressed path; Supabase emits a `max-age` value rather than `public, immutable` directives.

Keep canonical and thumbnail values separate in application state. `imageUrl` remains canonical and is the only image URL allowed in `Stage3ProductIdentity` and saved drafts. `thumbnailImageUrl` is ephemeral compact-card data. Search results and same-session selected products request `thumbnailImageUrl ?? imageUrl`; a failed thumbnail retries canonical once and then shows the existing placeholder. Restored captured products are enriched from the current catalog read without persisting the derivative.

Create `personal_plan_search_assessment_products_v3` as a small wrapper over v2: call v2 for all authorization, assessment, filtering, capping, and fail-closed JSON-role behavior; join `products.thumbnail_image_url`; then reapply v2's final ordering. This avoids dropping v2, duplicating its 340-line body, or drifting from its later role-shape hotfix. V2 remains the internal search authority intentionally, not as a temporary rollout copy.

Roll out behind server-side `PERSONAL_PLAN_STAGE3_THUMBNAILS_ENABLED`, following the existing persistence-adapter option pattern rather than reading environment state in the client component. When disabled, server/view-model mapping omits thumbnails and cards render canonical URLs only. This is the configuration kill switch; clearing database URLs is not the normal rollback.

Rejected alternatives:

- On-demand or pre-warmed transforms: the representative cold transform added about 0.5 seconds. Pre-warming all 270 origins deliberately consumes 270 transformation units each billing cycle even if many products are never searched; current Supabase guidance describes a 100-origin Pro/Team quota and package billing above it. Nick has chosen stored derivatives for predictable first-view behavior and one-time generation.
- Only change `width`, `height`, or `decoding`: the existing fixed 48x48 container already prevents layout shift, and these attributes do not remove the 1200px transfer. Task 1 still measures this cheap control before schema work.
- Change canonical `cacheControl`: a longer browser TTL helps later visits but does not shrink or accelerate the first cold transfer; rewriting existing objects is a broader Storage mutation. Canonical upload caching remains unchanged in this plan.
- A derivative metadata table: source identity and version are recoverable from the content-addressed URL, so the extra table, RLS, grants, and publishing function do not buy enough integrity here.
- Extend all small-image surfaces: this change is limited to the reported Stage 3 search/captured list. Chat and Routine 40–48px surfaces can reuse this derivative later; 64–80px comparison surfaces require a separately decided larger variant.

## Scope and non-goals

In scope:

- Nullable `products.thumbnail_image_url`.
- One deterministic 144x144 derivative generator shared by backfill and future intake.
- Dry-run-first backfill of all 270 products with canonical images; 8 rows remain explicitly `not_applicable`.
- V3 search wrapper and thumbnail-first Stage 3 search/captured-card rendering with canonical fallback.
- Future product-intake generation, upload, review, and atomic product creation with both URLs.
- One-year browser TTL for new thumbnail objects only.
- A feature flag, measured browser baseline/after proof, tests, and runbook updates.

Non-goals:

- Recompressing or re-uploading existing canonical assets.
- Medium/large responsive variants or changes outside the Stage 3 search/captured-product surface.
- Layout or German copy changes.
- Repairing missing legacy `product_image_assets` provenance rows.
- Deleting orphaned or superseded objects; cleanup is a separate destructive-action review.
- Applying production migrations, running the production backfill, enabling the flag, deploying, or publishing without separate authorization.

## Target map

- `supabase/migrations/<timestamp>_product_image_thumbnails.sql`: add the nullable column plus a trigger that clears it whenever canonical `image_url` changes; use the repository's rename-current-function-and-wrap pattern to validate reviewed `canonical_image_sha256`/thumbnail metadata and update the new product inside the same `product_intake_approve_reviewed_product` transaction; create service-role-only v3 as a thin v2 wrapper with `SECURITY DEFINER`, `SET search_path = ''`, fully qualified names, and explicit final ordering.
- `scripts/product-intake/product-thumbnail.ts` plus focused tests: root-only Sharp generation and checksum/path contract. The review app never imports Sharp; it receives and uploads pre-generated bytes.
- `scripts/product-intake/finalize-package-image.ts`, `scripts/product-intake/image-finalization.ts`, and `scripts/product-intake/upload-package-image.ts`: create, describe, upload, and verify both assets.
- `apps/product-intake-review/app/api/submissions/[submissionId]/publish/final-image-handoff.ts`, `scripts/product-intake/codex-research-worker.ts`, and `apps/product-intake-review/app/submissions/[submissionId]/review-property-rows.ts`: carry the pre-generated derivative through both real handoff paths and hardcoded reviewed-field gates.
- `scripts/product-intake/backfill-product-thumbnails.ts`: inventory, dry-run manifest, guarded apply, compare-and-set database update, idempotent reuse, and refusal reporting.
- `src/lib/personal-plan/products/stage3-persistence-supabase.ts` and ephemeral catalog-search types: call v3 and map canonical plus nullable thumbnail URLs.
- `src/lib/personal-plan/products/inventory-search.ts`: keep lab/fixture candidates shape-compatible.
- `src/components/personal-plan-products/stage3-products-flow.tsx`: carry thumbnails to search results and same-session `localCatalogCaptures`; maintain an ephemeral current-catalog thumbnail lookup for restored captured products without adding it to the draft.
- `src/lib/personal-plan/products/production-persistence-gateway.ts` and Stage 3 Zod contracts: preserve and test the canonical-only persistence boundary.
- `src/components/personal-plan-products/index.tsx`: thumbnail-first request, canonical retry, placeholder, explicit dimensions, and async decoding for both 48px call sites.
- Personal Plan release/persistence configuration: add server-side `PERSONAL_PLAN_STAGE3_THUMBNAILS_ENABLED` with disabled-by-default behavior and test coverage.
- `src/lib/personal-plan/products/stage3-analytics.ts` and the flow bridge: emit privacy-safe counters only for `thumbnail_fallback` and `thumbnail_total_failure`, enabling rollback decisions without logging product names or customer data.
- Existing product-intake, migration-contract, persistence, flow, gateway, lab-source, and component tests; `docs/product-intake-research-ops.md` for the two-asset operational contract.

## Designed user journey

### End user

1. A user reaches the existing Personal Plan product search and enters at least two characters.
2. The server returns the same ordered matches with canonical `image_url` and optional `thumbnail_image_url`.
3. With the feature enabled, each 48x48 result card requests the 144x144 thumbnail, covering up to 3x displays. Text and selection remain available independently of image success.
4. If the thumbnail is absent, the card starts with canonical. If its HTTP request fails, the card retries canonical exactly once; if both fail, the existing placeholder appears.
5. After selection, the 48px “Ausgewählte Produkte” card keeps using the same thumbnail in the current session, avoiding a second canonical download. After restoration, current catalog enrichment supplies the current thumbnail ephemerally; only canonical remains in the saved draft.
6. Selecting, adding another product, and continuing behave exactly as before.

Meaningful variants: warm browser/CDN cache serves the same content-addressed URL; cold requests fetch only the stored small object. Replacing a canonical image changes its hash and therefore its thumbnail path, so long browser caching cannot mask the replacement. Turning the feature flag off returns every compact card to canonical display without changing stored data.

### Operator and integration journey

1. Future intake finalization creates canonical and thumbnail files plus checksums in one local package.
2. Dry-run reports both exact paths and all validation results without Storage or database writes.
3. Apply verifies local checksums, uploads each missing object without overwrite, downloads both to verify, then calls the existing guarded approval transaction; that transaction inserts the product with both URLs.
4. If either upload fails, approval does not run. If approval fails, product URLs remain unchanged; already-uploaded content-addressed objects are safe to reuse on retry.
5. Backfill dry-run accounts for every product. Apply requires the project confirmation, uploads/verifies the thumbnail, then compare-and-set updates `thumbnail_image_url` only where both `id` and the original `image_url` still match.
6. `product_id` is the work-unit/resume key. A complete rerun reuses rows whose expected checksum-addressed URL already matches and writes nothing.

Completion means all 270 image-bearing rows have a verified URL, all 256 active products return it through v3, and the 8 products without canonical images are reported without fabrication. Any `refuse` blocks completion until repaired or explicitly accepted by Nick; there is no silent remainder budget.

## Planning evidence

Six representative 1200x1200 packshots—bottles, tubes, spray cans, and jars—retained visual parity at 144x144 and fell from 16.5–36.1 KB to 522–1,276 bytes, a 95.7–97.0% reduction. This covers a 48 CSS pixel slot through 3x density.

- Evidence: [comparison.png](./evidence/product-image-thumbnails/comparison.png)
- Metrics/method: [evidence README](./evidence/product-image-thumbnails/README.md)
- Evidence review: confirmed by Nick on 2026-08-15 after the Task 1 timing report.
- User-journey sign-off: confirmed by Nick on 2026-08-15 when authorizing implementation of the reviewed two-asset journey.

## Ordered tasks

### 1. Measure the current journey and the cheap control

Consumes: the exact authenticated Stage 3 search journey and current production runtime.

Under one named mobile throttle, run the same query three times in a fresh cold profile and three times warm. Record search-response-to-image-visible lag for each visible card, aggregate image bytes, TTFB/download timing, cache headers, and URLs. Repeat locally with only explicit image dimensions and `decoding="async"` as a temporary control; discard that control if it does not settle the decision.

Produces: the before baseline and stop/go decision used again in Task 7.

Completion criterion: proceed only if the median slowest-visible image completes at least 300 ms after result text, or any reproducible cold run exceeds 1 second, and the attribute-only control does not remove that gap. Otherwise stop before schema work and return with the measured cause.

### 2. Build one versioned root-workspace generator

Consumes: canonical bytes and the authoritative `search_thumbnail_v1` settings.

Implement a pure root-script generator returning bytes, source/attempt-output SHA-256, version, and exact path. Auto-orient; resize with centered `fit: "cover"`; preserve source alpha; encode 144x144 WebP quality 80/effort 5; and reject unreadable, animated, or non-image input and invalid output. Current and legacy input dimensions are accepted and normalized. The review app never imports Sharp.

Produces: the typed derivative result shared by intake and backfill; the review app only consumes its files/metadata.

Completion criterion: unit fixtures cover current square and legacy non-square inputs, orientation, explicit centered crop matching the existing card, alpha preservation, exact full-source-hash paths, dimensions/format, a reasonable size band, and corrupt/animated refusal. Tests do not assert cross-platform byte identity. Planning samples reproduce the recorded range.

### 3. Add the column, transactional intake insert, and thin v3 wrapper

Consumes: the column/path contract, current `product_intake_approve_reviewed_product`, and v2 search authority.

Add the nullable URL with a production-URL check accepting versioned paths matching `thumbnails/search-v[0-9]+/<64-lowercase-hex>.webp`. Add a trigger that sets the thumbnail column to null whenever an existing row's canonical `image_url` changes, preventing stale derivatives until regeneration. Rename the current approval function to `_before_thumbnail_image`, create a thin same-signature wrapper, validate newly threaded `canonical_image_sha256` and thumbnail URL metadata, call the prior function, then update the returned product ID inside the same transaction. Create v3 by selecting from v2, joining the thumbnail column by `product_id`, and explicitly restoring `ORDER BY sort_order NULLS LAST, product_name, product_id`; retain service-role-only execution and empty search path. Do not duplicate or drop v2.

Produces: backward-compatible database contracts for new and old app instances.

Completion criterion: focused SQL tests assert the versioned URL check, canonical-change clearing trigger, rename/wrapper approval pattern, reviewed checksum field, v3 delegation to v2, ordering, grants, and security posture. `npx supabase db reset` replays the full local migration chain; local probes use production-shaped public URLs and prove approval writes both URLs, malformed metadata is refused, canonical replacement clears the derivative, and v2/v3 return identical IDs/status/order. No generated `Database` type is claimed because the repo has none.

### 4. Backfill every existing image-bearing product safely

Consumes: generator and additive column.

Default to read-only dry-run. Process every product, download its canonical Chaarlie object, generate/verify the expected path, and emit a manifest keyed by `product_id`. Apply requires `--apply --confirm-project=pqdkhefxsxkyeqelqegq`, bounded concurrency/retries, `upsert: false`, one-year TTL, verification of an existing/uploaded object's dimensions/format/alpha behavior/size, and compare-and-set update by product ID plus unchanged canonical URL. An object already present at the source-hash path is the canonical derivative even if a different platform would emit different bytes. A full rerun is the resume mechanism.

Produces: reviewed manifest and, only after separate authorization, full URL coverage.

Completion criterion: fixture integration tests cover create/reuse/not-applicable/refuse, upload-without-pointer retry, database-failure retry, source-change race, and full-rerun resume. Production dry-run accounts for 278 = 270 Chaarlie-hosted image rows + 8 not applicable. Apply may publish all valid rows while returning non-zero and reporting refusals; full completion and flag enablement still require zero unresolved refusals.

### 5. Wire thumbnail-first compact cards without draft pollution or double download

Consumes: v3 response and feature flag.

Read the flag server-side in the persistence/gateway setup and omit thumbnails from mapped candidates when disabled. Map nullable URLs through production and lab candidates, the flow view-model, search results, same-session selected candidates, and ephemeral restored-product enrichment. Keep the derivative out of `Stage3ProductIdentity`, its Zod schema, and serialized drafts. Name and preserve `resolveOwnedCatalogProduct` as canonical identity resolution; its ephemeral companion data must not reintroduce a canonical request after same-session selection. In `ProductImage`, key error reset on `(thumbnailUrl, imageUrl)`, retry canonical once, then show placeholder; add explicit 48x48 dimensions and async decoding. Emit privacy-safe analytics only on fallback and total failure.

Produces: both 48px Stage 3 card call sites use the small object without changing durable identity.

Completion criterion: persistence, flow, gateway, lab-source, analytics, and component tests prove the value reaches both card lists, selecting a result does not trigger a canonical download, restored products use current ephemeral thumbnails, the server-side feature-off path is canonical-only, fallback/failure counters contain no product/customer text, total failure shows placeholder, URL-pair changes reset errors, and draft round-trips remain canonical-only.

### 6. Make future intake create and upload both files

Consumes: generator, updated approval transaction, and current manual-review gates.

Extend finalization metadata and the reviewed payload with `canonical_image_sha256`, thumbnail URL, and attempt checksum; update hardcoded reviewed-field lists, CLI, and review-app handoffs. Generate only in root scripts; review-app code uploads pre-generated bytes. Dry-run reports both. Apply uses no-overwrite upload, one-year thumbnail TTL, and post-upload format/dimension/size verification before approval. Preserve no-image and manual review decisions. Keeping this in the same change prevents every newly approved product from opening a recurring backfill gap.

Produces: every future image-bearing intake publication starts with both URLs.

Completion criterion: tests cover both real handoff paths, checksum metadata threading, field gates, no-write dry-run, source checksum mismatch, existing valid-object reuse, partial upload, retry after transaction failure, and no-image packages.

### 7. Verify the measured journey and document operation

Consumes: local migrated flow, dry-run manifest, Task 1 profiles, and reviewed evidence.

Repeat the exact cold/warm queries and throttle. Capture request dimensions, headers, bytes, visible timing, canonical fallback, placeholder, flag-off behavior, same-session selection, and fallback/failure analytics. Update the canonical product-intake and canonical-image-correction runbooks so every image replacement clears/regenerates the derivative, and document generation, apply, retry, partial-refusal, and recovery rules.

Produces: review-ready before/after and operator evidence.

Completion criterion: layout/copy/selection are unchanged; covered compact cards request 144x144 checksum-addressed URLs with `max-age=31536000`; selecting does not add a canonical download; no on-demand transform is used; median slowest-visible completion improves by at least 200 ms and no reproducible run regresses. If the threshold is missed, keep the flag off and do not claim the performance outcome.

## Verification

Automated:

- Generator unit tests and product-intake paired-asset tests.
- SQL migration/approval/v3 wrapper tests plus `npx supabase db reset` and local SQL probes.
- Stage 3 persistence, flow, gateway, lab-source, release-flag, and component tests.
- `npm run test:personal-plan`, `npm run test:node`, `npm run test:playwright:personal-plan-stage3`, `npm run typecheck`, `npm run lint`, and `npm run ci:verify` as required by ready-check scope.

Manual/browser:

- Exact supplied desktop journey plus mobile viewport, matched cold/warm profiles, and attribute-only control.
- Visual comparison against approved evidence; feature-on/off, missing thumbnail, broken thumbnail, and total-failure states.
- Confirm response header actually contains `max-age=31536000`; do not claim `public` or `immutable` directives Supabase does not emit.

Migration/live-state:

- Local reset/probes first; after separately authorized non-production or production migration, inspect the column, v3 definition/grants, approval function, RLS/advisors, and v2/v3 parity.
- Before production write, rerun read-only inventory and review the manifest.
- After separately authorized backfill, require 270 verified URLs, 256/256 active coverage, 8 not applicable, zero refusals, and a zero-write idempotent rerun.

Evidence-sensitive:

- Byte reduction alone is not a latency result. Use Task 1/7's matched timing thresholds before claiming user-visible improvement.

## Review and handoff

- Worktree: `.worktrees/product-image-thumbnails` on `codex/product-image-thumbnails`.
- Plan, evidence report/comparison, and sample inputs/outputs: `commit`.
- Counterpart reports: `discard` after supported findings are incorporated; the plan retains the resulting decisions.
- Task 1 temporary attribute-only control: `discard`; its numeric results: `commit` as evidence if implementation proceeds.
- Backfill dry-run manifest: `commit` when privacy-safe, otherwise `archive` outside the repo with checksum and PR summary.
- Implementation uses `implementation-loop`, including `ready-check` and `request-code-review` before review-ready handoff.
- Migration, uploads, production backfill, deploy, flag enablement, and cleanup remain separate approval gates.
- Rollout: additive migration/v3 -> feature-off runtime -> authorized backfill and coverage proof -> enable flag -> observe. V2 remains v3's search authority. Kill switch: disable `PERSONAL_PLAN_STAGE3_THUMBNAILS_ENABLED`.
- Accepted cost: blob-first writes can leave safe unreferenced objects after database failure. No reaper is added; deletion remains separately reviewed.
- Stop point now: Nick reviews the visual evidence and explicitly confirms this journey. No implementation or production write begins before sign-off.
