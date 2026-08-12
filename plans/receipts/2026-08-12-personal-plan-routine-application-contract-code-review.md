# Personal Plan Routine and Anwendung Contract — Code Review

**Date:** 2026-08-12
**Branch:** `codex/personal-plan-routine-application-contract`
**Base:** `origin/main` at merged Routine PR #378, `19e05f4c6330a7e805db26e028830dc2d664a275`
**Reviewed scope fingerprint:** `5b8e1a9b9a10dae81ba2cf7cbe704529c5bc5900874229ef47116ad637ccd3bb`
**Scope:** committed base plus all modified and task-owned untracked paths; receipt files excluded from the canonical fingerprint.

## Findings

No blocking findings.

## Review lanes

- **Normal correctness lens:** contracts, generation isolation, compiler ordering and recovery, auth/privacy boundary, additive migration, deterministic artifact, preflight drift protection, observability payload, UI recovery, and regression coverage.
- **Structural maintainability lens:** required because this adds a versioned content architecture, migration, new resolver flag, compiler recovery semantics, and more than four shared source files.
- **Independent counterpart:** Claude Opus 4.8, `high`, read-only whole-worktree review. It found no hard defect and reported three low-risk consistency/observability items plus one rendered-state test gap.

## Findings integrated

1. **Generation coupling:** resolved the V2 contract version once per request and passed it to both the accepted-product adapter and family repository. A partial configuration cannot silently mix V1 pointers with V2 templates.
2. **Repeated anchor conflicts:** the compiler now repeatedly isolates each involved anchor set, deterministically recompiles the remainder, and returns a partial day instead of discarding the second isolated set.
3. **Expected unresolved guidance severity:** typed unresolved-product events are warning-level; database/schema/page failures remain error-level. Events contain stable IDs and reason codes only, never names, instructions, or profile data.
4. **Unresolved-only rendered state:** added direct adapter/UI coverage proving the day is labelled partial and shows the bounded product-review message rather than claiming complete instructions.

Focused post-review regression: 40/40. After stacking, full Stage 5: 186/186, full Personal Plan: 1,254/1,254, database contract: 18 files / 411 assertions, both Chromium journey suites: 2/2, and final serial `ci:verify`: PASS.

## Rejected or deferred items

- Per-product unresolved warning aggregation is not required for correctness. Stable issue-code fingerprinting and warning severity prevent these expected composition gaps from masquerading as availability errors; volume can be reassessed with real rollout telemetry.
- The offline generator's bounded name/UUID transforms are acceptable because the committed artifact is immutable input to review, `--check` detects regeneration drift, and live preflight binds every row to current product/category/source fingerprints. It is not a runtime parser.
- Exact-preview 30-navigation performance proof is a publication/preview gate, not evidence that can be truthfully produced from an uncommitted, undeployed tree.

## Residual risk

- V2 data is intentionally absent from production and the flag is default-off. Activation must preserve the expand/backfill/verify order and pass the read-only preview latency gate.
- OLAPLEX No.0 intentionally remains one explicit runtime blocker until its real companion identity is verified.

## Bottom line

No blocking findings. The exact local tree is ready for the separate ship gate; it is not authorized or ready for production activation yet.
