# Shampoo Eligibility Cleanup And Product-List Chunk Retirement

## Status

Finalized follow-up plan from the Clawpatch findings debug thread.

Claude plan review: `plans/2026-06-24-shampoo-eligibility-cleanup.claude-review.md`.

Implementation status: code/docs/tests implemented in the isolated Clawpatch worktree. Production DB deletion is still pending explicit approval.

## Goal

Retire deprecated Shampoo eligibility paths so Shampoo recommendations only use exact bucket specs, while keeping `suitable_thicknesses` as the live diameter field for non-Shampoo products. Include the production cleanup for retired `product_list` content chunks so old product-list content strings do not stay live.

## Current Evidence

- `suitable_thicknesses` is still a live product field for non-Shampoo categories. It means hair diameter: `fine`, `normal`, `coarse`.
- Live production Shampoo products are already covered by exact specs:
  - active Shampoo products: 49
  - active Shampoo products missing `product_shampoo_specs`: 0
  - invalid or null Shampoo bucket specs: 0
- `products.suitable_hair_textures` is not present in the live production schema.
- Production still has 50 `content_chunks` rows with `source_type = 'product_list'`.
- Current `/api/chat` uses AgentV2 production chat and does not retrieve product-list chunks; the old product-list chunk path is not a normal customer chat path.
- Live DB coverage is not enough to prove ingestion safety. `scripts/ingest-products.ts` can read local/generated source files such as `data/products.json` or `data/products-from-excel/*.json`; those sources must also be checked or migrated before removing the Shampoo fallback.
- Source audit during implementation found no generated product JSON in the isolated worktree. The root checkout had stale generated `data/products-from-excel/shampoo.json` rows with `0/51` Shampoo rows containing explicit `shampoo_bucket_pairs`; the generator was updated so regenerated Shampoo source JSON now emits exact pairs.
- Retrieval audit found no current `/api/chat` runtime path to `content_chunks` / `product_list`; remaining references are legacy ingestion, eval, labels, and admin/debug display.
- Review-loop audit found a second legacy product-list ingestion path through `scripts/ingest-markdown.ts`; that path now also requires `ALLOW_LEGACY_PRODUCT_LIST_CHUNKS=1` before ingesting `source_type = 'product_list'`.

## Product Decisions

- Keep `suitable_thicknesses` globally for non-Shampoo product fit.
- For Shampoo, exact eligibility belongs to `product_shampoo_specs` / `shampoo_bucket_pairs`.
- A Shampoo source row that only has `suitable_thicknesses + suitable_concerns` should fail loudly instead of silently generating bucket specs.
- `suitable_hair_textures` should not appear in current Shampoo/product-list runtime types as a compatibility field.
- Retired `product_list` chunks should be removed from production only with an explicit DB/data-operation step.
- `scripts/ingest-product-chunks.ts` should be guarded, not deleted, so there is still a rollback/regeneration path while product-list chunks are being retired.
- Implementation should stop after code/docs/test cleanup. Production deletion of `content_chunks where source_type = 'product_list'` requires a separate explicit approval from Nick.

## Non-Goals

- Do not remove `suitable_thicknesses` from non-Shampoo products.
- Do not redesign recommendation ranking.
- Do not delete non-`product_list` content chunks.
- Do not mutate the HAI-130 branch or worktree.
- Do not change German UI copy unless an affected admin/error string needs to explain the stricter Shampoo source rule.
- Do not edit non-Shampoo research fallbacks such as `scripts/research-leave-in-specs.ts` as part of this cleanup. They are not the Shampoo eligibility path and should be handled only by a separate source-data cleanup.

## Implementation Plan

### 1. Audit Source Files Before Removing Fallback

Files:

- `data/products.json` if present
- `data/products-from-excel/*.json` if present
- root/local generated product source snapshots, if the implementation worktree intentionally has access to them
- `scripts/ingest-products.ts`

Tasks:

- Before changing fallback behavior, inspect all product source files that `scripts/ingest-products.ts` would read.
- For every Shampoo source row, verify it has explicit `shampoo_bucket_pairs` with valid `thickness + shampoo_bucket` values.
- Confirm whether any non-Shampoo source row still has `suitable_hair_textures` as its only diameter source.
- If Shampoo source rows lack explicit pairs, migrate the source data or stop and report the missing rows. Do not remove the fallback while source files would fail re-ingestion.
- If source files are intentionally absent from the worktree, record that limitation and require an explicit source-data verification step before implementation is considered ship-ready.
- Implementation result: `scripts/convert_sources.py` now writes `shampoo_bucket_pairs` for Shampoo matrices. Existing generated snapshots must be regenerated before the strict ingestion path is used against local source JSON.

Expected result:

- Active live Shampoo DB coverage remains `0` missing specs.
- Shampoo source files also have `0` rows missing explicit `shampoo_bucket_pairs`, or the plan is blocked until source data is migrated.

### 2. Make Shampoo Eligibility Strict

Files:

- `src/lib/shampoo/eligibility.ts`
- `src/lib/product-matching/product-list-chunks.ts`
- `tests/product-list-chunks.test.ts`

Tasks:

- Remove `suitable_hair_textures` from `ShampooEligibilitySource`.
- Remove the fallback that derives Shampoo bucket pairs from `suitable_thicknesses + suitable_concerns`.
- Make `normalizeShampooBucketPairs()` require explicit `shampoo_bucket_pairs` for Shampoo categories.
- Keep returning `[]` for non-Shampoo categories.
- Use a deterministic German error for missing pairs, for example:

  ```text
  Shampoo "<name>" braucht explizite shampoo_bucket_pairs.
  ```

- Update tests so these cases are covered:
  - Shampoo with explicit `shampoo_bucket_pairs` succeeds.
  - Shampoo with only `suitable_thicknesses + suitable_concerns` throws with the new explicit-pairs error.
  - Shampoo with `suitable_hair_textures` does not become eligible and throws with the new explicit-pairs error.
  - Non-Shampoo product-list chunks still group by `suitable_thicknesses`.

### 3. Tighten Product Ingestion Boundaries

Files:

- `scripts/ingest-products.ts`
- `docs/excel-ingestion.md`

Tasks:

- Scope `suitable_hair_textures` removal to current production/ingestion types only:
  - `ShampooEligibilitySource`
  - `ProductListChunkProduct`
  - `scripts/ingest-products.ts` `ProductInput`, but only after the source-file audit confirms no non-Shampoo source depends on the compatibility fallback.
- Require Shampoo import sources to provide exact `shampoo_bucket_pairs`.
- Validate Shampoo source rows before generating embeddings or writing/upserting product rows, so stale sources fail before partial catalog mutation.
- Keep `suitable_thicknesses` import behavior for non-Shampoo categories.
- Update Shampoo ingestion docs to say Shampoo source data must include exact `thickness + shampoo_bucket` pairs.
- Leave `scripts/research-shampoo-specs.ts` out of the implementation unless typecheck or direct import fallout requires a narrow type adjustment. It writes a review CSV and is not a production ingestion path.

### 4. Guard Product-List Chunk Workflow

Files:

- `scripts/ingest-product-chunks.ts`
- `src/lib/product-matching/product-list-chunks.ts`
- `docs/excel-ingestion.md`
- `docs/codex-review-map.md`
- `tests/product-list-chunks.test.ts`

Tasks:

- Guard `scripts/ingest-product-chunks.ts` behind an explicit environment flag such as `ALLOW_LEGACY_PRODUCT_LIST_CHUNKS=1`.
- Guard `scripts/ingest-markdown.ts` for `source_type = 'product_list'` with the same flag so legacy product-list markdown cannot reintroduce retired chunks through the generic ingestion pipeline.
- Without the flag, the script should fail early with a clear message that product-list chunks are retired and current chat does not use them.
- Keep the script callable with the flag for rollback/regeneration until production deletion is complete and the team explicitly decides to archive it.
- Update docs so product-list chunks are not described as the current recommendation path.
- Keep focused test coverage for the guarded behavior if there is an existing script test pattern.
- Update review-map references so product-list chunk work is labeled legacy/guarded rather than current recommendation infrastructure.
- Do not touch transcript/book/community content chunk ingestion.
- Before production deletion, confirm the retrieval gold set does not rely on `product_list` targets.

### 5. Production Data Cleanup

Scope:

- `content_chunks where source_type = 'product_list'`

Tasks:

- Before deletion, run a read-only count and sample query and record the result.
- Delete only `product_list` rows after explicit approval for the DB operation.
- Re-run the count and confirm zero `product_list` rows remain.
- Leave all other `content_chunks` source types untouched.

Execution boundary:

- This step is not part of the automatic implementation pass.
- The implementation handoff must stop before deletion and ask Nick for explicit approval with the latest count/sample evidence.
- If approval is not given, leave production data unchanged and report the pending cleanup clearly.

Suggested SQL shape:

```sql
select count(*) from content_chunks where source_type = 'product_list';
delete from content_chunks where source_type = 'product_list';
select count(*) from content_chunks where source_type = 'product_list';
```

Use the app's existing Supabase admin/script pattern rather than running ad hoc SQL in production without logging the operation.

## Verification

Primary gates:

- `npx tsx --test tests/product-list-chunks.test.ts`
- `npm run typecheck`
- `npm run lint`

Source-data gates:

- Run/read the source-file audit from Step 1.
- Confirm Shampoo source rows have explicit `shampoo_bucket_pairs`, or document that source files were unavailable and block shipping until verified.
- Confirm no non-Shampoo source would lose its only diameter metadata when `suitable_hair_textures` compatibility is removed from `scripts/ingest-products.ts`.

Regression checks:

- `npx tsx --test tests/product-matcher.spec.ts tests/recommendation-engine-selection.test.ts`
  - These are broad recommendation regression checks, not the primary proof for the strict Shampoo cleanup.

Live/read-only checks before data deletion:

- Count active Shampoo rows missing `product_shampoo_specs`; expected `0`.
- Count invalid/null Shampoo bucket specs; expected `0`.
- Count `content_chunks where source_type = 'product_list'`; currently expected `50`.
- Confirm retrieval eval/gold-set references do not require `product_list` chunks.

Implemented verification:

- `npx tsx --test tests/product-list-chunks.test.ts`

Live checks after data deletion:

- Count `content_chunks where source_type = 'product_list'`; expected `0`.
- Smoke `/api/chat` or a local chat test to confirm current AgentV2 chat still returns no product-list retrieval sources.

## Review Gates

- Run the source-file audit and focused tests before broader checks.
- Request code review after implementation because this touches ingestion and recommendation-adjacent boundaries.
- Treat either of these as blockers:
  - active Shampoo products without exact live specs
  - Shampoo source rows without explicit `shampoo_bucket_pairs`
- Stop before production DB deletion for explicit approval.
- Do not create a PR, commit, push, or run production deletion unless Nick explicitly asks.

## Handoff Notes

- This plan should be implemented in the existing isolated Clawpatch findings worktree or a fresh worktree from `origin/main`.
- Keep the HAI-130 worktree untouched.
- The code cleanup and the production data cleanup can be shipped separately if needed. The code cleanup is low risk once active Shampoo spec coverage remains zero-missing; the production deletion needs explicit approval because it mutates live data.
- If splitting delivery, ship the strict Shampoo/source-code cleanup first. Ship product-list chunk deletion only after the guarded-script rollback path and explicit DB approval are in place.
- Current aligned implementation scope: code/docs/tests only. Production DB deletion is a follow-up approval gate.

## Claude Review Findings Disposition

- Accepted: source-file audit must gate fallback removal; live DB coverage alone is insufficient.
- Accepted: specify the new missing-pairs error string so tests update deterministically.
- Accepted: scope `suitable_hair_textures` removal narrowly and leave non-Shampoo research fallback out of scope.
- Accepted: guard `scripts/ingest-product-chunks.ts` instead of deleting it immediately.
- Accepted: promote typecheck and focused product-list chunk tests as primary gates; keep broader recommendation tests as regression coverage.
