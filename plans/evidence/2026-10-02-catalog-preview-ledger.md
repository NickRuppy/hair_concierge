# Catalog preview seam audit ledger

Scope: read-only audit of the two exports in
`src/lib/product-intake/catalog-enrichment/index.ts` and their exclusive tests
in `tests/product-intake-catalog-enrichment.test.ts`, at worktree
`/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`.

## Verdict

**Source deletion is unlocked for both exports.** They are test-owned wrapper
APIs, rather than documented operator APIs. This conclusion is not based only
on a lack of imports: current operator entry points use their named
domain-preflight owners, which call `validateCatalogEnrichmentManifest` and
`orderCatalogEnrichmentOperations` directly; the research-ops rule specifies
preflight/final-handoff safety but does not name either wrapper; and the two
wrappers were introduced with the Heat cohort and remained unused outside tests
through deployed baseline `3abfe00a`.

## D/C/R table

| Declaration or test                                                                                       | Location                                                                  |                                                                   Count | Decision | Proof / remaining owner                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------: | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isCatalogEnrichmentManifestPath`                                                                         | `src/lib/product-intake/catalog-enrichment/index.ts:133-143`              |                                   1 source declaration, 11 source lines | **D**    | No non-test caller in current tree, introduction commit `2fd400c7` / `7df2d36f`, or deployed `3abfe00a`. No operator doc names it. Its path-traversal assertion is isolated from manifest validation, whose own image-path checks remain at `index.ts:157-164` and `:571-586`.                                                                 |
| `previewCatalogEnrichment`                                                                                | `src/lib/product-intake/catalog-enrichment/index.ts:684-733`              |                                   1 source declaration, 50 source lines | **D**    | No non-test caller in current tree, introduction commit, or deployed `3abfe00a`. Heat/Scalp preflight validates manifests directly (`heat.ts:470-490`; `scalp.ts:505-526`); Leave-In preflight validates and orders directly (`leave-in-research-calibration.ts:432-449`, `:623-639`). No operator document declares the preview-result shape. |
| import specifiers                                                                                         | `tests/product-intake-catalog-enrichment.test.ts:8,10`                    |                                                                       2 | **D**    | Required only by the two deleted exports.                                                                                                                                                                                                                                                                                                      |
| `new-product insert content fails closed on drift or resolved B1 fields and preview exposes the proposal` | `tests/product-intake-catalog-enrichment.test.ts:276-298`                 |     1 retained declaration; one 10-line preview assertion block removed | **C**    | Keep the direct validator drift/B1 rejection at lines 277-286. Remove only lines 288-297 and rename to match the retained validator contract.                                                                                                                                                                                                  |
| `preview reports planned deletes in execution order`                                                      | `tests/product-intake-catalog-enrichment.test.ts:630-649`                 |                                  1 exclusive test declaration, 20 lines | **D**    | The direct owner is `execution order runs the product row, then deletes, then upserts` at lines 609-628, plus Leave-In preflight's direct ordered-operation handling.                                                                                                                                                                          |
| `safe manifests reject traversal, user data, secrets, and signed URLs`                                    | `tests/product-intake-catalog-enrichment.test.ts:669-716`                 | 1 retained declaration; two wrapper assertions at lines 705-715 removed | **C**    | Keep the manifest secret/signed-URL tests at lines 675-704. The wrapper's repository-path predicate is not the manifest's payload-sanitization contract.                                                                                                                                                                                       |
| `preview is always non-writing and never plans user-side effects`                                         | `tests/product-intake-catalog-enrichment.test.ts:757-768`                 |                                  1 exclusive test declaration, 12 lines | **D**    | No write-capable preview command invokes the wrapper. Actual operator preflight command files construct read adapters: `heat-preflight.ts:17-27`, `scalp-preflight.ts:17-27`, and `leave-in-research-calibration-preflight.ts:8-25`.                                                                                                           |
| `preview exposes blockers instead of presenting a blocked manifest as handoff-ready`                      | `tests/product-intake-catalog-enrichment.test.ts:770-782`                 |                                  1 exclusive test declaration, 13 lines | **D**    | The actionable preflights own blocker reporting. `docs/product-intake-research-ops.md:374-376` requires approval validation/preflight before any write and explicit final handoff; it does not expose this wrapper response.                                                                                                                   |
| Direct validation/order/index tests                                                                       | `tests/product-intake-catalog-enrichment.test.ts:181-628,651-755,784-828` |                                                         21 declarations | **R**    | They test `validateCatalogEnrichmentManifest`, `orderCatalogEnrichmentOperations`, and `generateCatalogEnrichmentIndex`, which are directly consumed by live catalog cohort/preflight code.                                                                                                                                                    |

Exact removal inventory: **2 production declarations (61 source lines), 2 test
imports, 3 exclusive test declarations (45 lines), and 2 assertion-only
blocks**. The two C rows keep their declarations and their direct-validator
coverage.

## Execution path and operator boundary

1. `package.json:125-158` exposes cohort-specific test commands and named
   preflight/apply commands; no command names either preview wrapper.
2. `scripts/product-intake/catalog-enrichment/heat-preflight.ts:9-28` and
   `scalp-preflight.ts:9-28` call `preflightHeat` / `preflightScalp` with read
   adapters. Their domain modules validate each loaded manifest directly.
3. `scripts/product-intake/catalog-enrichment/leave-in-research-calibration-preflight.ts:8-28`
   calls `preflightLeaveInCalibration`; it directly validates manifests,
   establishes current target state, orders operations, and calculates delete/
   upsert data.
4. `docs/product-intake-research-ops.md:38-54,80-87,371-376` defines the
   documented safety model: preview artifacts and mandatory preflight before
   guarded handoff. It does not establish a generic `previewCatalogEnrichment`
   API or the repository-relative path predicate as an operator contract.

## History and deployed baseline

`2fd400c7` (merged as `7df2d36f`, 2026-08-10) introduced both functions with
the Heat catalog cohort. `git grep` at that commit and at deployed
`3abfe00a7843882f01009de701affa7b1dff697f` finds no non-test use. The wrapper
remains byte-identical across the deployed baseline and this worktree. Its
September changes only added delete projection to the already test-only preview
wrapper, while the actual Leave-In lane independently uses ordered operations.

## Risk and validation

Risk is low for the removal, with one review requirement: preserve the direct
validator assertions in the two C rows and ensure no generated/public export
surface is expected to import these symbols. The audit found no package export
barrel or documentation reference.

No tests, provider calls, or edits in the worktree were run. After the parent
applies this batch, run the smallest owning suite:

```bash
node scripts/run-vitest.mjs tests/product-intake-catalog-enrichment.test.ts
```

Then run the changed-file gate and inspect the diff. `test:node` includes this
top-level test file; the three catalog-specific test commands also include it.
