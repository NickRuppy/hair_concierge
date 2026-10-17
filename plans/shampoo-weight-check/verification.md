# Shampoo weight check — local verification receipt

Branch: `codex/shampoo-weight-check`. Base/HEAD: `10f2f9726978a18c52acb3ee12569d63023feabd`. Started 2026-10-13 13:24 UTC; completed approximately 13:46 UTC, within Nick's ~40-minute limit. All changes are uncommitted.

Coverage acknowledgement: Nick's explicit implementation request and full 2026-10-13 ruling (`weight-ruling.md`) settle the product behavior, copy, scope, source merge, and prohibition on network/DB access/publication. Current internal revalidation: confirmed; no new consequential decisions or material deviations. The implementation is in `authority/categories/shampoo.ts` (the actual repository path).

## Outcome and source

- Nullable spec weight with CHECK; all contextual rows of each product receive the same per-product merged weight.
- Exactly 73 Track A IDs plus A50: 41 light, 30 moderate, 3 heavy. Source table and full copy: [README.md](README.md).
- Scalp T7 row passes, cautions or stays unknown using researched weight. It contributes no verdict steps or required missing facts. Balanced behavior remains unchanged.
- Thickness cautions are excluded from supportive recommendation reasons, ranking coverage penalties, and caution-count tie-breakers in both authority and comparison ranking.
- Loader covers batch, fallback and scan paths; inconsistent/invalid weights remain unknown. Weight changes refresh fact fingerprints.

## Fresh checks

Final runner: `node --import ./tests/server-only-register.cjs --import tsx --test <files>`; **665 passed, 0 failed, 0 skipped**, across:

```text
tests/personal-plan/fit-verdict-categories.test.ts
tests/personal-plan/fit-evaluator.test.ts
tests/personal-plan/products/stage3-authority.test.ts
tests/personal-plan/products/stage3-fit-comparison.test.ts
tests/personal-plan/products/stage3-catalog-facts.test.ts
tests/personal-plan-catalog-facts-candidate-pool.test.ts
tests/personal-plan/products/candidate-ranking.test.ts
tests/personal-plan/products/budget-need-distances.test.ts
tests/shampoo-production-light-authority-contract.test.ts
tests/shampoo-production-light-calibration.test.ts
tests/shampoo-weight-migration.test.ts
tests/personal-plan/product-previews.test.ts
tests/scanner-catalog-coverage-readiness.test.ts
tests/scan-result-presentation.test.ts
```

`npm run -s typecheck`: exit 0, no diagnostics on final TypeScript content. Initial cold check exposed required fixture/type updates; these were repaired and the final check passed.

`npx --no-install eslint <all changed TS files>`: exit 0, no errors. Three existing catalog-facts warnings (unused import and two destructured thickness bindings); tests are ignored by repository lint configuration. Supplemental `--no-ignore`: 24 existing `no-explicit-any` errors in fit-verdict-categories and four existing warnings overall. A `git show HEAD:<test> | eslint --no-ignore --stdin --stdin-filename <test>` baseline reproduced the same 24 errors. No unrelated lint cleanup was made.

`git diff --check`: exit 0.

Red proof: initial focused run **276 pass / 11 fail**, with missing loader weight and hard-coded pass producing the intended failures. Mutation proof: restoring old ranking coverage/caution dependence failed both oily and dandruff ranking regressions; replacing the migration with a no-op failed on `column "weight" does not exist`. Restored source/migration rechecked green (**273/273**); the final complete selected run above passed after the additional oily unknown-weight case.

PGlite is local, ephemeral and in-process: **5 migration tests** independently merge sealed lane records, verify exact membership and every contextual row, outsider NULL, CHECK rejection, and atomic rollback for missing products, wrong product category, missing specs, and wrong spec category. No project/database connection was made.

Scanner evidence: tests call the real authority/scan projection, preserve ideal verdicts, check dimension relations, and server-render dandruff `!` and `?` rows with the exact German copy. No browser session or live/customer flow was exercised.

## Local review and remaining verification

No blocking findings in local correctness/data-integrity and structural review of the final diff. The shared ranking helper has two production callers and preserves all non-scalp caution behavior. SQL is one atomic migration with locks before target guards and post-assertions. No external counterpart review was invoked: this is an implementation-worker handoff with no network or push authorization.

No open product questions. Still unverified: the full migration chain with actual catalog triggers/data, multi-session locking, browser flow, CI and production state. PGlite uses the relevant minimal schema and does not prove those gates. The migration has not been applied. No commit, push, deployment, or production write.

## Files and disposition

Intended durable task files for later review/publication (publication is not authorized here):

- `plans/shampoo-weight-check/README.md`
- `src/lib/personal-plan/products/authority/catalog-facts.ts`
- `src/lib/personal-plan/products/authority/categories/shampoo.ts`
- `src/lib/personal-plan/products/authority/contracts.ts`
- `src/lib/personal-plan/products/comparison-dimensions.ts`
- `src/lib/personal-plan/products/fit-comparison.ts`
- `supabase/migrations/20261013170000_shampoo_weight.sql`
- `tests/personal-plan-catalog-facts-candidate-pool.test.ts`
- `tests/personal-plan/fit-verdict-categories.test.ts`
- `tests/personal-plan/product-previews.test.ts`
- `tests/personal-plan/products/stage3-authority.test.ts`
- `tests/personal-plan/products/stage3-fit-comparison.test.ts`
- `tests/scanner-catalog-coverage-readiness.test.ts`
- `tests/shampoo-production-light-authority-contract.test.ts`
- `tests/shampoo-production-light-calibration.test.ts`
- `tests/shampoo-weight-migration.test.ts`
- `plans/shampoo-weight-check/verification.md` (this receipt)

Temporary generator and diagnostic logs under `/private/tmp/shampoo-weight-*` are transient verification artifacts outside the repository. No unrelated worktree content was changed.

Payload fingerprint: `b84ad9edc3576db08f1cf4baafa52903090b4db3568e07a95156aaec98012d6f`. Computed as SHA-256 of a sorted `path<TAB>content-sha256<LF>` manifest for every listed payload file; excludes this self-referential receipt only. Staging/committing identical contents will preserve this fingerprint.
