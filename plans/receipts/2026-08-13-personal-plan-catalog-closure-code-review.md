# Personal Plan catalog closure — Code Review

**Date:** 2026-08-13
**Branch:** `codex/personal-plan-catalog-closure`
**Base:** `origin/main` at `d0a4ca8cc2b25c3d0beb1d8456817c613a967fd6`
**Final scope fingerprint:** `e8aaaaccaa5104e50f050200f998c237b190b919e7389778a585ee8e668a2598`
**Scope:** all committed-base-to-working-tree changes plus task-owned untracked files; this receipt and the ready-check receipt are excluded from the fingerprint.

## Findings

No blocking findings.

### Residual release risk — migration runtime execution

The guarded migration is covered by source-contract tests but has not been executed against Postgres. It replaces the Product Intake approval wrapper and extends the curated-publication assertion, so the release gate must verify the legacy approval call, V1/V2 protocol insertion, and deferred publication assertion in their real transaction order. This is not evidence of a confirmed defect; it is the highest remaining uncertainty and is correctly held behind the unapplied-migration stop.

### Non-blocking maintainability note — wetting preparation semantics

The compiler recognizes the canonical Shampoo preparation by the typed `wet` step key on a `wet_cleanse` block. That convention is explicit and covered for both sides: ordinary family guidance suppresses the redundant compiler transition, while an exact workflow without the preparation retains the fallback. A copy-text heuristic would be more brittle and locale-coupled, so no change was made. A future family that prepares `wet_cleanse` under a new semantic key must extend this contract and its regression test.

### Non-blocking observability note — Product Intake blocker detail

Product Intake remains fail-closed when V2 derivation fails, but the current missing-field response does not expose the builder's precise typed reason. This does not weaken integrity and is outside the approved closure scope; retain as an operator-observability follow-up if rejection debugging becomes costly.

## Review lanes and rulings

- Normal correctness lens: full working tree inspected for runtime, validation, migration, data-integrity, and regression behavior.
- Structural lens: required because the task changes the Product Intake boundary, a migration/RPC wrapper, shared compiler behavior, and more than four source files.
- Read-only Claude counterpart review on fingerprint `556cec4fcf7cbe5196445619b4d7cee8aeb18753c0bd4b307c49471b477ea772`: no confirmed hard defect; raised the three residual notes above.
- Post-review delta to final fingerprint: the approved day summary was added to the existing detail header, its rendering test was added, the plan/ready-check were updated, and all affected plus repository-wide gates were refreshed. This delta does not alter the migration, Product Intake, or catalog architecture assumptions, so the structural lane was not rerun.
- Publication rebase: the task commit was replayed cleanly onto `d0a4ca8c`; the upstream retained-portfolio Stage 5 route regression remains present alongside this task's route coverage. The affected Personal Plan gates were refreshed after the rebase.

## Verification considered

- Focused instruction-composition red/green proofs.
- 202/202 Stage 5 tests on the rebased tree.
- 1,380/1,380 Personal Plan tests on the rebased tree.
- 3,695/3,695 Node tests on the rebased tree.
- Typecheck, lint with zero errors/four pre-existing warnings, production build, Prettier check for the mockup, and `git diff --check`.
- Nick's explicit review of the grouped instruction artifact and approved example-day hierarchy.

## Artifact disposition and bottom line

The plan, review artifacts, migration, runtime/data changes, tests, and these receipts belong to the task. Claude's temporary report and fingerprint manifests are transient. The local tree is review-ready. Commit/push/PR, base reconciliation, migration execution, deployment, and merge remain separate gates; production activation is not ready until the Postgres migration proof is clean and the failed preview latency SLO is resolved or explicitly re-decided.
