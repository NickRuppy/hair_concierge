# The Ordinary Scalp image correction

**Status:** approved for implementation and production application by Nick on 2026-08-11
**Base:** refreshed `origin/main` at `6b6ad789`
**Outcome:** replace the single live The Ordinary Scalp product image with the reviewed shadow-free asset while preserving the immutable eight-product Scalp launch package and every non-image product field.

## Approved evidence and exact scope

- Product ID: `58aa2f19-b23a-4e09-ab0f-68c359371c9e`.
- Product key: `the-ordinary-multi-peptide-hair-density-serum`.
- Current asset SHA-256: `6bb9be89b327984d4fe8f95c8009896bfec386f04dbf544a208e78268079dd5c`.
- Reviewed replacement SHA-256: `1a79af996795ea031e0a28b0220d37109950e0aed1a1175bb358e944efdbbc66`.
- The replacement is a deterministic crop/mask of the official The Ordinary product image. Its label pixels are preserved; the right-side baked shadow and background are removed.
- Nick reviewed the final image in the rendered review sheet and confirmed “looks good” on 2026-08-11.
- The other seven Scalp products and their images remain unchanged. Product identity, availability, recommendation state, commercial data, specs, and application protocols remain unchanged.
- The frozen `personal-plan-scalp-launch-v1` manifests, package fingerprint, and applied ledger remain historical release evidence and must not be rewritten.

This changes no application layout, copy, interaction, or state. The final-image review sheet is the applicable rendered design evidence; a separate UI mockup is not applicable.

## Architecture

Create a one-product correction package and executor instead of reusing the original eight-product Scalp executor or the generic Product Intake image RPC.

- Store the reviewed WebP at a new immutable content-addressed path ending in `1a79af996795.webp`; retain the old local and remote object.
- Add a dedicated service-role-only SQL RPC with an exact product UUID/key, old URL/path/hash, new URL/path/hash, and correction-fingerprint allowlist.
- The RPC takes an advisory lock, asserts the exact old persisted state, updates only `products.image_url` and the existing `product_image_assets` row, and writes a dedicated correction-ledger receipt in the same transaction.
- Exact replay with the same fingerprint is a no-op; partial, divergent, or unexpected state fails closed.
- The CLI is dry-run by default. Apply requires `--apply --confirm`, reviewer `nick`, the exact reviewed Git head, a clean worktree, linked project `pqdkhefxsxkyeqelqegq`, and the expected migration state.
- Before the RPC, upload the new object with `upsert: false`, then download and hash it. If the RPC fails after upload, report the immutable orphan path and do not silently delete it.
- Verification proves the product URL, the single provenance row, correction ledger, new remote SHA, and unchanged old remote SHA.

## Implementation and verification

1. Add a deterministic correction descriptor and the reviewed final WebP without altering the Scalp launch manifests.
2. Write focused red tests for exact constants, dry-run defaults, release gates, old-state drift, absent-or-identical upload behavior, exact replay, divergent replay, orphan reporting, and exact verification.
3. Generate a new Supabase migration through the CLI; add the correction ledger/RPC and pgTAP contract covering security, target isolation, transaction rollback, idempotency, and divergent state.
4. Add narrow preflight/apply/verify commands and package scripts. Do not expose generic table writes.
5. Run focused tests, database contracts, typecheck, lint/build as applicable, image hash checks, ready-check, and one whole-branch counterpart review.
6. Commit, push, open the PR, refresh all merge gates, and squash-merge the reviewed head.
7. From merged `main`, apply only the new migration, run read-only preflight, upload/apply the one correction, and run the independent verifier.
8. Render the live image/product card at desktop and mobile sizes, compare its bytes to the approved SHA, then run guarded task-worktree cleanup.

## Operator journey and recovery

The operator first sees a read-only report containing the exact product, old/new hashes, linked project, Git head, migration state, database state, and Storage state. Any mismatch stops with no writes. After the migration is applied, the operator reruns preflight and explicitly confirms apply. The executor uploads the immutable object, verifies its bytes, performs the transactional database switch, and prints a receipt. The independent verifier must pass before completion is claimed. A database failure after upload leaves at most one named, unreferenced immutable object for a separately authorized cleanup; an unexpected database state is never overwritten automatically.

The accepted rollback is a separately authorized guarded repoint to the retained old immutable object. There is deliberately no automatic reverse write or object deletion in this correction.

## Acceptance and stop condition

- Exactly one allowlisted product changes, and only its image URL/provenance changes.
- The reviewed replacement and remote object hash to `1a79af996795ea031e0a28b0220d37109950e0aed1a1175bb358e944efdbbc66`.
- The old object remains byte-identical and the original Scalp launch package remains unchanged.
- The migration/RPC is service-role-only, transactional, replay-safe, and fail-closed.
- Unit, database, release-gate, and rendered live verification all pass.
- Stop after the authorized merge, migration, one-product apply, production verification, and exact task-worktree cleanup. Do not deploy unrelated application code, activate flags, or modify any other product.
