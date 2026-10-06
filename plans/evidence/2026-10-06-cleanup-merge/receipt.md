# Cleanup merge verification — 2026-10-06

The user authorized merging the applied cleanup, then reporting further levers. Further pruning remains paused. This receipt supersedes the historical 676 checkpoint for publication.

## Identity and outcome

Implementation tested and reviewed: `721d3664cd8a57430a6a576fd1472488346cc1c3`, base `ad50c18fd2dc1603d358afc4a7ed1c05d567cfba`. Implementation manifest SHA-256: `f0146c19d7522c0348d7c2cb9a5390827d8a981101ef547b6a3520f818b92735`. Subsequent changes are metadata only; final ready/review receipts and canonical manifest are archived at `/Users/nick/AI_work/test-audit-evidence/2026-10-06-cleanup-merge`.

Fresh-main inventory: 12,834 → 12,162 test declarations, 672 net removed (5.236%). Net code reduction: 9,382 application/tooling plus 10,751 test/support lines = 20,133. The original 20% target remains unfinished. All 963 new upstream test callbacks survive unchanged; 42 revised callbacks survive, with one free-shell navigation case combining upstream and existing cleanup assertions.

## Verification

- `npm run ci:verify`: typecheck, lint and production build passed.
- Conflict-focused native checks: 61/61 passed.
- `npm run test:playwright:contracts`: 212/212 passed, including browser auth/recovery and stubbed request journeys.
- `npm run funnel:check`: passed.
- Full fixed-source native/c8: main 13,138 cases, 13,096 passed, 27 failed, 15 skipped; integrated 12,452 cases, 12,411 passed, 26 failed, 15 skipped. Both closed with identical HEAD, tracked membership and source/test/tooling/config hashes. Declarations differ from expanded native runtime cases.
- The same 26 failures require a Supabase constructor URL in a credential-free run. All 88 agent-select tests pass with an inert local constructor fixture. One extra main-only ingestion failure reproduces against ignored old catalog JSON; the unchanged script and test pass 11/11 in the task, which has no old optional catalog. Catalog hashes/counts are recorded separately; this is an environment limitation, not a claimed owner repair.
- Actual coverage: lines/statements 70.67% → 71.08%, functions 83.52% → 83.71%, branches 81.98% → 82.01%. Original-source conservative denominator (deleted paths charged zero, shortened-path denominator never reduced) has losses 1.1204pp, 1.5470pp and 1.1195pp respectively. All aggregate metrics satisfy the 2pp budget.
- 75 metric/path pairs across 43 surviving files decline by more than 2pp; these are reported, not hidden or certified as per-file preservation. The requested budget is aggregate. Prior focused owner/fault controls remain archived; coverage is corroboration and does not itself prove behavior.

## Review and boundaries

No blocking findings. Claude's terminal second opinion covers the tested implementation against the stated base, with high-risk auth/billing/source samples and static caller checks; it is not an exhaustive semantic reread. The main session verified its findings and the heat-suite shared manifest/fingerprint guards. Typechecking bounds static imports, not computed runtime imports. The broad structural lens finds deletion of dead exports/paths without new architecture or branching. Large files remain existing debt rather than an expansion introduced by this cleanup.

Deleted routine retrieval/autofill and product-attachment helpers have only test/deleted-helper callers on main. No active chat route or evaluation script changes; local chat evaluation is outside this dead-code seam and would create production fixture rows. No manual production writes performed. There are no migration changes. The deletion of the unused final-image upload helper is recoverable from Git history. New product/UX decisions remain outside this merge.

## Artifact disposition

Commit: existing chosen plans, audit evidence and this compact fresh-main receipt. Archive: full fresh canonical TAP, coverage JSON/LCOV, commands, freezes, comparison scripts, CI and reviewer output outside Git at the archive path above; all copies hash checked. 278 ignored proof JSON files were archived and verified before removing duplicate worktree copies. Discard: only owned raw V8 caches, invalid partial-run caches and reproducible build outputs. Historical accepted evidence remains committed; invalid attempts retain diagnostic records outside the repository and receive no acceptance credit. Bulk evidence is separate from the 20,133-line implementation reduction.

Publication remains gated by required GitHub checks and exact-head merge validation. Deployment and provider changes are separate.
