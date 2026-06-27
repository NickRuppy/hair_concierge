# Product Intake Research Ops

## Implementation Goal Contract

Build a repeatable operator workflow for product-intake research packages and approval. The workflow should let Codex run a scheduled, read-only daily research-prep job, while keeping all Supabase writes behind Nick's explicit approval.

## Source Context

- Master product-intake ledger: `plans/2026-06-10-product-intake-intelligence.md`
- Product image asset standard:
  - `docs/runbooks/product-image-pilot-runbook.md` from the product-image pilot worktree
  - `docs/product-image-background-removal.md` from the product-image pilot worktree
  - `scripts/product-images/*` from the product-image pilot worktree
- Current integration worktree: `.worktrees/product-intake-full-flow-smoke`
- Existing submission APIs:
  - `src/app/api/product-intake/chat/route.ts`
  - `src/app/api/product-intake/onboarding/route.ts`
  - `src/lib/product-intake/submissions.ts`
- Existing operator scripts:
  - `scripts/product-intake/queue.ts`
  - `scripts/product-intake/review.ts`
  - `scripts/product-intake/research.ts`
  - `scripts/product-intake/approve.ts`
  - `scripts/product-intake/approve-ready.ts`
  - `scripts/product-intake/link-existing.ts`
  - `scripts/product-intake/request-info.ts`
  - `scripts/product-intake/notify-pending.ts`
- Existing approval RPC boundary:
  - `product_intake_approve_reviewed_product`
  - `product_intake_link_existing_product`
  - `product_intake_request_more_info`
  - `product_intake_reject_submission`

## Chosen Direction

Use Approach A with Codex scheduling:

- A daily Codex automation reads the product-intake queue and prepares local research packages.
- The scheduled job may read Supabase and may write local files.
- The scheduled job must not write to Supabase.
- Nick reviews a local package.
- After Nick approves, one wrapper command applies the researched payload, approves the product, links it to the user's usage row, and sends the chat notification.

This keeps the risky intelligence and approval boundary human-controlled while making the repetitive research prep regular and inspectable.

## Non-Goals

- No fully unattended approval.
- No public recommendation promotion.
- No new admin UI.
- No automated production scheduler outside Codex automation.
- No broad rewrite of existing review scripts.

## Status Model

Daily research-prep lane:

- Include `pending_review`.
- Default limit: `5`.
- Limit must be configurable.
- Skip existing local packages by default.
- Allow explicit redo later through a flag such as `--new-attempt` or `--overwrite`.

Nick review lane:

- Default actionable statuses:
  - `ready_for_review`
  - `researching`
  - `needs_more_info`
- Allow filtering for all statuses, including:
  - `pending_review`
  - `approved`
  - `matched_existing`
  - `rejected`
- Closed statuses are visible only when explicitly requested.

## Local Package Shape

Research packages live under:

```text
ops/product-intake-research/YYYY-MM-DD/<submission-id>/
```

Each package should contain:

- `submission.json`: raw submission/review data, including signed image URL metadata when available.
- `research.md`: human-readable research notes.
- `payload.json`: machine-readable researched payload in the existing `ProductIntakeFinalReviewedPayload` shape.
- `validation.json`: result of a dry-run validation against the existing review validators.
- `approval.md`: human checklist with identity, category, specs, sources, metadata, warnings, and exact next command.
- Optional `image-candidates.json`: reviewed product-image candidates that the local app can render, with source page URL, original image URL, optional package-local `images/source/...` file, source type, and notes.
- Optional `images/` folder, created near the end of package completion when a product image is available:
  - `images/source/`: original reviewed source image candidates from brand/retailer/search.
  - `images/selected/`: the exact selected source image.
  - `images/selected-nobg/`: transparent RGBA cutout after the product-image background-removal workflow.
  - `images/final/`: normalized Chaarlie-ready final asset, ideally `1200x1200` WebP on the neutral product-image background.
  - `images/manifest.csv` or equivalent provenance metadata with source page URL, source image URL, quality confidence, processing method, hash, reviewer approval, and notes.

The normal path has one package per submission. Existing package folders are skipped by default so the daily job does not overwrite previous work. Explicit redo can be added through a flag.

Important image boundary: remote brand/retailer image URLs in `payload.json` are source evidence, not final database images. `products.image_url` should point to a reviewed, normalized Chaarlie-hosted asset in the public Supabase `product-images` bucket, or the package must carry an explicit reviewer decision to approve the product without an image for now.

## User-Facing Approval Flow

After Nick approves a package, the operator runs one wrapper command:

```bash
npm run products:intake:approve-package -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id> --reviewed-by nick --apply --confirm
```

The wrapper command should:

1. Read `submission.json` and `payload.json`.
2. Verify the package submission id matches the current Supabase submission.
3. Verify the package has completed the final image decision:
   - approved normalized Chaarlie-hosted image asset metadata, or
   - explicit `no_image_approved_for_now` reviewer decision.
4. Save the researched payload and mark it ready using the existing research workflow.
5. Approve through the existing approval workflow.
6. Rely on the approval RPC to link the approved product to `user_product_usage`.
7. Send the chat notification through the existing notification path.
8. Print the approved product id, image decision, notification result, and addition-record path.

Dry-run without `--apply --confirm` must show exactly what would happen without writing to Supabase.

Important invariant: the wrapper must not cache the pre-save submission row for approval. It should save the researched payload, then reload/validate through the existing approval path so optimistic locking and current status checks remain effective.

## Target File Map

Likely additions:

- `scripts/product-intake/prepare-research.ts`
- `scripts/product-intake/approve-package.ts`
- `scripts/product-intake/review-app.ts`
- shared research-save helper, likely in `scripts/product-intake/review-actions.ts`
- `tests/product-intake-research-package.test.ts`
- `tests/product-intake-approve-package.test.ts`
- `tests/product-intake-review-app.test.ts`

Likely updates:

- `package.json`
- `scripts/product-intake/queue-reporting.ts`
- `scripts/product-intake/review.ts`
- `scripts/product-intake/research.ts`
- `scripts/product-intake/review-actions.ts`
- `scripts/product-intake/approve.ts`
- `plans/2026-06-10-product-intake-intelligence.md`

Optional docs:

- `docs/product-intake-research-ops.md`

## Implementation Plan

### Task 1: Package Builder

- [x] Add tests for package path creation and skip-existing behavior.
- [x] Add `scripts/product-intake/prepare-research.ts`.
- [x] Load `pending_review` submissions through existing queue/review helpers.
- [x] Reuse `loadQueueRows` from `scripts/product-intake/queue.ts`.
- [x] Extract or reuse submission/image review helpers instead of duplicating broad review logic. `review.ts` currently keeps signed-url helpers module-local, so make any needed extraction explicit.
- [x] Create `ops/product-intake-research/YYYY-MM-DD/<submission-id>/`.
- [x] Write `submission.json`, `research.md`, `payload.json`, `validation.json`, and `approval.md`.
- [x] Make output deterministic enough for review.
- [x] Ensure the script never calls existing write paths and never passes `--apply`.
- [x] Fresh scaffolded packages are allowed to have `validation.json` with `ok: false` when `payload.json` is still an incomplete draft. That is expected for first-pass research prep, not a script failure.

### Task 2: Research Package Contract

- [x] Define a small TypeScript contract for the package manifest or package metadata.
- [x] Store `submission_id`, `created_at`, `source`, `category`, `brand_text`, `product_name_text`, and package status.
- [x] Include commands in `approval.md` for review, validation, and approval.
- [x] Add tests that a package is rejected if required files are missing.

### Task 3: Review Lane

- [x] Keep `queue.ts` as the review lane instead of adding a new subsystem.
- [x] Add only the missing behavior: a review-focused default/view that prioritizes `ready_for_review`, `researching`, and `needs_more_info`.
- [x] Preserve filters for every status.
- [x] Show `pending_review` count as backlog context when useful.
- [x] Keep closed statuses hidden unless explicitly requested.

### Task 4: Approval Wrapper

- [x] Add tests for dry-run behavior.
- [x] Add tests that mismatched package/submission ids are rejected.
- [x] Add tests that no write happens without both `--apply` and `--confirm`.
- [x] Extract the save portion of `scripts/product-intake/research.ts` into an importable helper, likely `saveResearchedPayload()` in `scripts/product-intake/review-actions.ts`.
- [x] Update `research.ts` to call the shared helper.
- [x] Add `scripts/product-intake/approve-package.ts`.
- [x] Reuse the shared research-save helper and `approveSubmissionById()` from `scripts/product-intake/approve.ts`.
- [x] Do not duplicate `approveReviewedSubmission`, notification, addition-record, or usage-linking behavior.
- [x] Ensure the wrapper writes to Supabase only after explicit approval flags.
- [x] Print a compact final result with product id, submission status, notification status, and addition record path.
- [x] Add npm aliases for `products:intake:prepare-research` and `products:intake:approve-package`.

### Task 5: Scheduled Codex Automation

- [x] After the scripts exist and pass checks, create a Codex cron automation proposal.
- [x] Schedule: once daily.
- [x] Workspace: `.worktrees/product-intake-full-flow-smoke` or the eventual shipping worktree.
- [x] Prompt: run the read-only research prep flow, prepare packages for up to 5 `pending_review` rows, summarize created/skipped packages and blockers.
- [x] Automation must not run approval commands.
- [x] Automation output should tell Nick exactly what to review.

Automation proposal, pending explicit user approval before creation:

```text
Daily product-intake research prep

Workspace:
/Users/nick/AI_work/hair_conscierge/.worktrees/product-intake-full-flow-smoke

Command:
npm run products:intake:prepare-research -- --limit=5

Operator summary:
Report created package paths, skipped package paths, and any blockers. Do not run
approval, apply, confirm, migration, commit, push, or PR commands.
```

### Task 6: Full-Flow Test With Existing Submissions

- [x] Use current local pending submissions as test data.
- [x] Generate at least one package.
- [x] Review its generated files.
- [x] Run approval wrapper dry-run.
- [ ] Only with explicit approval, run apply/confirm on a selected test submission.
- [ ] Verify:
  - product row exists,
  - category spec rows exist,
  - `user_product_usage.product_id` is linked by the approval RPC,
  - submission status is closed,
  - user chat notification was inserted.

Dry-run evidence:

- `npm run products:intake:prepare-research -- --limit=1` created `ops/product-intake-research/2026-06-26/ec0b01c9-6f99-4340-b731-e8cc9110608b/`.
- `npm run products:intake:prepare-research -- --limit=5` created local packages for the remaining pending rows on 2026-06-26:
  - `b68dde13-312a-4db9-a3eb-2110a82017a5` (`OLAPLEX no5`, `Haaröl`, `oil`)
  - `d78bdc04-a817-4122-b4e4-2d554766c4ec` (`Codex Smoke`, `Codex Smoke Leave-in Mango`, `leave_in`)
  - `faf95e36-df25-45a1-8a5b-0f41309c9dba` (`Jean & Lean`, `Granatapfel Conditioner`, `conditioner`, front and barcode photos)
  - `2b34c3dc-6c2b-4b90-b6d2-a0fceaef176c` (`Syoss`, `Volumne Shampoo`, `shampoo`)
- The `faf95e36-df25-45a1-8a5b-0f41309c9dba/submission.json` package includes temporary signed front/barcode image review URLs.
- `npm run products:intake:approve-package -- --package ops/product-intake-research/2026-06-26/ec0b01c9-6f99-4340-b731-e8cc9110608b --reviewed-by nick` ran in dry-run mode and correctly planned `researching` as the next status because the scaffold payload is still missing `final`.
- Approval-wrapper dry-runs were run for all four newly generated packages and all correctly stayed in dry-run mode with `missingFields: ["final"]`.
- `npm run products:intake:queue -- --status pending_review --report --format json` reported 5 pending prep backlog rows in the current environment.

### Task 7: End-Of-Package Image Finalization Gate

- [x] Reuse the product-image pilot asset standard for product-intake packages instead of accepting arbitrary remote image URLs as final `products.image_url` values.
- [x] Port or reference the existing product-image scripts/runbooks so package completion can produce:
  - exact selected product image,
  - transparent cutout,
  - magenta QA/contact sheet or equivalent visual review artifact,
  - normalized final WebP asset,
  - provenance manifest,
  - final public Supabase `product-images` URL.
- [x] Update package validation so approval fails unless the package contains either:
  - approved final image metadata for a Chaarlie-hosted asset, or
  - an explicit reviewer-approved `no_image_approved_for_now` decision.
- [x] Keep image processing at the end of the research package flow, after product identity/spec research is complete and before `approve-package --apply --confirm` can write to Supabase.
- [x] Record source image URLs and rationale in review artifacts, but do not treat raw retailer/brand URLs as the final DB image.
- [x] Add focused tests for the approval gate:
  - remote-only `image_url` is rejected as final image evidence,
  - approved Chaarlie-hosted image metadata passes,
  - explicit no-image reviewer decision passes,
  - dry-run output explains the current image decision clearly.
- [x] Add a package image upload/verification step before DB approval:
  - dry-run reports the target bucket/path/public URL without writing,
  - apply mode requires `--confirm`,
  - local final file SHA-256 must match `image-finalization.json`,
  - existing Supabase Storage object is accepted,
  - missing object is uploaded to `product-images` and downloaded again for verification.
- [x] Add `products:intake:upload-image` for explicit image upload/verify runs before final approval.
- [x] Keep `approve-package --apply --confirm` as the single safe final command; it now runs the image upload/verify gate before saving payload or approving the submission.

Implementation evidence:

- Added `scripts/product-intake/image-finalization.ts` as the small package-level image decision contract.
- Added `scripts/product-intake/upload-package-image.ts` as the Supabase Storage upload/verify gate for approved final package images.
- `prepare-research` now scaffolds `image-finalization.json` and adds image-finalization checklist copy to `approval.md`.
- `approve-package` dry-run now reports `image_finalization`; write mode blocks before saving/approval unless the image decision is valid.
- `approve-package --apply --confirm` now uploads or verifies the approved final image object before saving the reviewed payload or calling the existing approval path.
- `final.product.image_url` may be `null` only for the explicit no-image path; missing image data still fails the normal payload validator.
- Jean&Len package dry-run on 2026-06-26: product/spec research validates as `ready_for_review`, but approval is blocked with `Approve-package requires approved product image finalization before writes` until the final image asset decision is completed.
- Focused upload tests cover dry-run, upload+verify, and checksum mismatch rejection.

### Task 8: Local Package Review App

Chosen approach: local ops review server.

- [x] Add `scripts/product-intake/review-app.ts`.
- [x] Add `products:intake:review-app` npm script.
- [x] Serve a local-only dashboard for packages under `ops/product-intake-research/**`.
- [x] Show package list with submission id, category, brand/name, validation status, and image decision status.
- [x] Show package detail with:
  - raw submission summary,
  - product/spec payload,
  - sources and field rationales,
  - submitted front/barcode signed URLs when available,
  - renderable product-image candidates from `image-candidates.json`, preferring package-local `images/source/...` files over brittle remote hotlinks,
  - current `image-finalization.json`.
- [x] Save package-local decisions through buttons/forms:
  - approved Chaarlie-hosted final asset metadata,
  - approve without image for now,
  - needs more image work / pending notes.
- [x] When saving approved final asset, update both `image-finalization.json` and `payload.json.final.product.image_url` to the Chaarlie-hosted `public_url`.
- [x] When saving no-image approval, update `image-finalization.json`, set `payload.json.final.product.image_url = null`, and preserve/update `field_rationales.product.image_url`.
- [x] Path guard: the review app must reject writes outside `ops/product-intake-research`.
- [x] Local file guard: the review app may serve package-local review images only from the selected package's `images/` folder.
- [x] Do not call Supabase write APIs or approval commands from the app.
- [x] Add focused tests for package listing, safe path handling, and image-decision saves.
- [x] Add a durable operator runbook at `docs/product-intake-research-ops.md`.
- [x] Gitignore local `ops/product-intake-research/**` packages so user submission artifacts and review decisions do not enter PRs by accident.

Implementation evidence:

- Added `scripts/product-intake/review-app.ts` with importable package listing/detail/save helpers plus a local HTTP dashboard.
- Added `products:intake:review-app`.
- The app writes only package-local `image-finalization.json` and `payload.json`; it has no Supabase client, approval command, or apply endpoint.
- The app now prefers renderable local image candidates from `image-candidates.json` and serves package-local image files through a guarded `/api/package/file` route.
- Approved image saves require the Chaarlie-hosted product-images URL path and patch `payload.final.product.image_url`.
- No-image saves explicitly set `payload.final.product.image_url = null` and preserve the image rationale.
- The Jean&Len Granatapfel Rose review package now includes a cached 850x850 official Jean&Len source image under `images/source/` plus `image-candidates.json`; browser verification confirmed the candidate image renders instead of falling back to the dead remote payload URL.
- The workflow is now documented in `docs/product-intake-research-ops.md`. The documented regular setup is: queue pending submissions, prepare local packages, research package files, review locally, dry-run approval, then run `--apply --confirm` only after explicit approval.
- The runbook now documents the complete path: migration/readiness check, local package prep/research, review app approval, final image processing, image upload/verify, approval dry-run, and explicit final apply.
- `ops/product-intake-research/` is ignored in Git because packages can contain user submission data, signed URLs, image files, and local review decisions.
- Final local package approval now mirrors the production-write readiness boundary more closely: it requires valid image finalization, rejects stale property approvals when `payload.json` values change after review, and serves package images through real-path checks to block symlink escapes.

### Task 9: Duplicate-Prevention Lookup Correction

- [x] Reproduce the OLAPLEX No.7 miss from the local package:
  - submission input was `brand_text = "OLAPLEX no5"` and `product_name_text = "Haaröl"` in category `oil`,
  - research later corrected the product to existing-style identity `OLAPLEX No.7 Bonding Oil`,
  - the catalog already contains `Olaplex No.7 Bonding Oil` under canonical category key `oil`.
- [x] Confirm the issue was lookup behavior, not a real duplicate oil category:
  - the DB/category key is `oil`,
  - the review app display label has been normalized separately,
  - the matcher missed the existing product because generic `Haaröl` did not overlap with `No.7 Bonding Oil`.
- [x] Patch the lookup path narrowly:
  - treat German generic oil tokens as low-value identity tokens,
  - when brand and supported category resolve but the product name is generic, and exactly one same-brand/same-category active catalog product exists, return `needs_variant_selection` instead of offering intake.
- [x] Add a regression for `OLAPLEX no5` + `Haaröl` resolving to a No.7 confirmation candidate rather than a duplicate intake offer.
- [x] Record the review outcome for the existing OLAPLEX test package:
  - do not approve `b68dde13-312a-4db9-a3eb-2110a82017a5` as a new product,
  - use `products:intake:link-existing` with product id `7d8c0150-778d-4cb9-abf5-bfc16ad93b12` if this test submission should be closed,
  - the dry-run link-existing command reported `next_status: matched_existing` and `notification.will_send: true`.

## Accepted Deviations

- No additional review UI was added. The existing `queue.ts` remains the review lane, with an explicit `--status pending_review --report` backlog view.
- No Codex automation was created yet. This plan records the proposed daily read/prep command in `docs/product-intake-research-ops.md`; creation still needs explicit user approval.
- No Supabase apply/confirm write was run. The wrapper was only exercised in dry-run mode.
- Product image finalization is now explicitly placed at the end of package completion. The current Jean&Len-style remote `image_url` is acceptable as source evidence during research, but not enough for final approval under the product-image asset standard.

## Review Patch Notes

Fresh subagent code review found four issues, all addressed:

- `approve-package` now rejects incomplete package folders before reading/applying them.
- `approve-package` now rejects package metadata submission-id mismatches.
- `approve-package --apply --confirm` now refuses to write unless the dry-run already validates as `ready_for_review`.
- `prepare-research` now includes image-review metadata with temporary signed image URLs when image paths are available.
- The review-app shipping pass patched final-approval integrity after focused review:
  - app-level final approval now validates `image-finalization.json`, not only the informal image candidate decision,
  - property approvals are tied to the reviewed value and become stale if `payload.json` changes,
  - package-local image serving now blocks symlink escapes with real-path checks.

## Verification Log

```bash
npx tsx --test tests/product-intake-approve-package.test.ts tests/product-intake-research-package.test.ts tests/product-intake-review-scripts.test.ts
npx tsx --test tests/product-intake-review-scripts.test.ts tests/product-intake-research-package.test.ts tests/product-intake-approve-package.test.ts tests/product-intake-review-workflow.test.ts
npx tsx --test tests/product-intake-review-app.test.ts
npx tsx --test tests/product-intake-review-scripts.test.ts tests/product-intake-research-package.test.ts tests/product-intake-approve-package.test.ts tests/product-intake-review-workflow.test.ts tests/product-intake-review-app.test.ts
npm run typecheck
git diff --check
npm run products:intake:prepare-research -- --limit=1
npm run products:intake:approve-package -- --package ops/product-intake-research/2026-06-26/ec0b01c9-6f99-4340-b731-e8cc9110608b --reviewed-by nick
npm run products:intake:approve-package -- --package ops/product-intake-research/2026-06-26/faf95e36-df25-45a1-8a5b-0f41309c9dba --reviewed-by nick
npm run products:intake:queue -- --status pending_review --report --format json
```

All tests and typecheck passed. The live package approval commands were dry-run only and did not write to Supabase.

## Verification

Required before implementation handoff:

```bash
npx tsx --test tests/product-intake-research-package.test.ts
npx tsx --test tests/product-intake-approve-package.test.ts
npx tsx --test tests/product-intake-image-finalization.test.ts
npm run typecheck
```

Recommended if touched surfaces expand:

```bash
npm run product-intake:check-readiness
npm run test:agent
npm run ci:verify
```

Manual dry-runs:

```bash
npm run products:intake:queue -- --format=json --limit=10
npm run products:intake:prepare-research -- --limit=1
npm run products:intake:approve-package -- --package ops/product-intake-research/YYYY-MM-DD/<submission-id>
```

Latest focused checks/dry-runs:

```bash
npx tsx --test tests/product-intake-approve-package.test.ts
npx tsx --test tests/product-intake-lookup.test.ts
npx tsx --test tests/product-intake-review-scripts.test.ts
npm run typecheck
git diff --check
npm run products:intake:upload-image -- --package ops/product-intake-research/2026-06-26/faf95e36-df25-45a1-8a5b-0f41309c9dba
npm run products:intake:upload-image -- --package ops/product-intake-research/2026-06-26/b68dde13-312a-4db9-a3eb-2110a82017a5
npm run products:intake:upload-image -- --package ops/product-intake-research/2026-06-26/2b34c3dc-6c2b-4b90-b6d2-a0fceaef176c
npm run products:intake:approve-package -- --package ops/product-intake-research/2026-06-26/faf95e36-df25-45a1-8a5b-0f41309c9dba --reviewed-by nick
npm run products:intake:approve-package -- --package ops/product-intake-research/2026-06-26/b68dde13-312a-4db9-a3eb-2110a82017a5 --reviewed-by nick
npm run products:intake:approve-package -- --package ops/product-intake-research/2026-06-26/2b34c3dc-6c2b-4b90-b6d2-a0fceaef176c --reviewed-by nick
npm run products:intake:link-existing -- --submission-id b68dde13-312a-4db9-a3eb-2110a82017a5 --product-id 7d8c0150-778d-4cb9-abf5-bfc16ad93b12 --reviewed-by nick --review-notes "Existing catalog match: user submitted OLAPLEX no5 Haaröl, reviewed as Olaplex No.7 Bonding Oil."
```

## Stop Lines

- Do not approve or write a researched payload to Supabase without explicit user approval.
- Do not run `--apply --confirm` in the scheduled job.
- Do not create the Codex automation until the scripts have passed local verification.
- Do not commit, push, open a PR, apply migrations, or clean up worktrees without explicit user approval.

## Open Risks

- Research quality is still the hardest part. The first version may scaffold packages but still require Codex/manual editing of `payload.json`.
- Image quality is a separate final approval concern. Product fact/spec research may be complete while image finalization is still blocked on exact-source selection, background removal, or reviewer approval.
- Signed image URLs expire; package files should store paths and notes, not depend on long-lived signed URLs.
- The wrapper must reuse existing approval validation so it does not become a second approval implementation. The intended reuse surface is `review-actions.ts` plus `approveSubmissionById()`, not a reimplementation of the approval RPC sequence.
- If the daily job runs in a long-lived dirty worktree, package output can become noisy. The automation should eventually target the clean shipping worktree or a dedicated ops worktree.

## Claude Review Findings

Claude reviewed this plan in `plans/2026-06-26-product-intake-research-ops.claude-review.md`.

Accepted:

- Removed the separate `user_product_usage` linking step from the wrapper; the approval RPC already owns that write.
- Added an explicit shared `saveResearchedPayload()` extraction because `research.ts` currently has inline, non-importable save logic.
- Repointed wrapper reuse toward `review-actions.ts` and `approveSubmissionById()`.
- Narrowed the review-lane task because `queue.ts` already provides most of that surface.
- Clarified that first-pass research packages may fail validation until Codex/manual research fills `payload.json`.

No rejected blocker findings.
