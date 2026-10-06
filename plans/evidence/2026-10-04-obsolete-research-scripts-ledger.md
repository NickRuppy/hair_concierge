# Historical research-script reachability — read-only ledger

Scope: three non-package, non-workflow legacy research/report scripts. Excluded: price audit, Product Intake current operations, migrations, and provider-write backfills. Read complete bodies: `research-leave-in-specs.ts` (571 lines), `research-shampoo-specs.ts` (214), and `export-leave-in-v1-canonical-specs.ts` (184). No test callbacks are directly owned by or import these scripts: **0 AST test declarations eligible; 0 proposed test deletions**.

## Candidate D1 — `scripts/research-leave-in-specs.ts`

- **Decision:** D source-only, conditional on the pinned closure below.
- **Current hash:** `8e8f05f564613f01d1b13e19e51c61b9c7815d89b128cfa21c45e1fe12bed695`.
- **Exact seam:** the unexported `main` at lines 405–568 reads active `products` using a service-role client, infers nine legacy fields from names and `data/products-from-excel/leave-in.json`, and writes three untracked local draft/upsert JSON files at 543–562. No symbol is exported.
- **Closure evidence:** no `package.json` script; no workflow, documentation, source, or test reference outside the file for its script name or its three output names. `git ls-files` finds none of those outputs. It is absent from `rg` across current package/workflow/docs/src/scripts/tests after excluding the file itself. History is only `02a16a59` (2026-03-14, “Commit current workspace updates”).
- **Why no keeper transfer is required:** this is dead local draft generation, not a current observable contract. Its heuristic inference cannot be moved into current research: current Leave-in authority is `projectLeaveInForProduction` (`src/lib/leave-in-research/production-adapter.ts:764`), package entry `research:leave-in:production-adapter` (`package.json:43`), and the active worker uses `leaveInResearchPromptContract` (`scripts/product-intake/codex-research-worker.ts:71,1723`). `docs/research/README.md:13` names that adapter as active.
- **Risk / limit:** external personal shell history cannot be disproved. Recheck literal command/doc/workflow references and hash before deletion. Do not delete current corpus, prompts, DB schemas, or the Production Adapter.
- **Focused post-edit check:** `node --import ./tests/server-only-register.cjs --import tsx --test tests/leave-in-production-adapter.test.ts tests/leave-in-product-intake-adapter.test.ts tests/leave-in-research-fixture.test.ts` (not run).

## Candidate D2 — `scripts/research-shampoo-specs.ts`

- **Decision:** D source-only, conditional.
- **Current hash:** `3d313f893d82315121ce324ba44e754416a7b78d7c404e82f19e255db7ffde04`.
- **Exact seam:** unexported `main` at 113–211 reads catalog rows, applies `normalizeShampooBucketPairs`, and writes the untracked review CSV `data/research/shampoo-specs-review-table.csv` at 122 and 202. It performs no ingestion or public route action.
- **Closure evidence:** no package/workflow/current doc/source/test reference to the script or CSV outside itself; `git ls-files` finds no CSV. The only historical-plan references explain it was a review CSV and not production ingestion (`plans/2026-06-24-shampoo-eligibility-cleanup.md:117`, `.claude-review.md:10`). History `2a6d21b6` (2026-03-21, “Canonicalize shampoo eligibility pairs”).
- **Why no keeper transfer is required:** exact shampoo eligibility is now an input contract through `normalizeShampooBucketPairs` and `src/lib/shampoo/production-light-adapter.ts:460`; the active package route is `research:shampoo:production-light` (`package.json:81`) and `docs/research/README.md:11` identifies it as active. Existing `tests/product-list-chunks.test.ts` validates explicit `shampoo_bucket_pairs`; Production Light suites validate the current outcome. Deleting an uncalled CSV generator drops no current public/storage protocol.
- **Risk / limit:** retain `src/lib/shampoo/eligibility.ts`, `scripts/ingest-products.ts`, product source JSON, and the explicit-pair tests; their use is live. Recheck aliases or out-of-repo runbooks before source deletion.
- **Focused post-edit check:** `node --import ./tests/server-only-register.cjs --import tsx --test tests/product-list-chunks.test.ts tests/shampoo-production-light-adapter.test.ts` (not run).

## Candidate D3 — `scripts/export-leave-in-v1-canonical-specs.ts`

- **Decision:** D source-only, conditional.
- **Current hash:** `aae4e31c840866309d681e66c897714e857ca49b51ab09c4ddee7c24db1e7fa3`.
- **Exact seam:** unexported `main` at lines 97–181 reads legacy `product_leave_in_specs`, collapses them to four derived benefits, and writes three untracked `data/research/leave-in-v1-canonical-specs.*` outputs at 160–171.
- **Closure evidence:** no package/workflow/document/source/test reference to this script or its outputs. `git ls-files` finds no generated output. It originated in `53e9f096` (2026-04-16, recommendation-engine v1). Its mapping is duplicated inside excluded provider-write `scripts/backfill-leave-in-fit-specs.ts:49–161`; that duplicate does not make either current operator-rooted.
- **Why no keeper transfer is required:** no direct tests or callers exercise this private report. Current Leave-in operation is the formula-first Production Adapter and Product Intake prompt/worker named in D1; the frozen current method documents seven dimensions, not this legacy four-benefit projection.
- **Risk / limit:** the excluded backfill is a provider-write path and is explicitly not proposed. Do not remove any active adapter, frozen research artifact, or database table.
- **Focused post-edit check:** `node --import ./tests/server-only-register.cjs --import tsx --test tests/leave-in-production-adapter.test.ts tests/leave-in-research-fixture.test.ts` (not run).

## Guarded source-only deletion shape

`/tmp/test-audit-research-script-delete.manifest.json` and `/tmp/test-audit-research-script-delete.cjs` pin all three paths and hashes; `/tmp/test-audit-research-script-delete.diff` is the prospective deletion diff. A main-only editor should fail if a current literal reference appears in `package.json`, `.github/`, `docs/`, `src/`, `scripts/`, or `tests/` outside the candidate paths; confirm each output remains untracked; snapshot files; parse no replacement because this batch deletes standalone scripts; then remove exactly these paths. It must not touch any provider-write backfill or data artifact. This is source cleanup only and has **zero campaign AST-test credit**.

Read limits: repository-local literals, tracked docs/workflows/package scripts, direct source/test imports, generated-output tracking, and Git history were checked. Dynamic commands held only in untracked external notes, CI secrets, or human shell history remain outside repository proof.
