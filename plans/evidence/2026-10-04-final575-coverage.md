# Measured 575-removal runtime checkpoint

Original AST 11,892; current 11,317 (10,793 Node, 524 Playwright). Net 575 removals, 4.8352%. The original 2,379 target still needs 1,804. This is an intermediate checkpoint.

The original-pinned 1,090 native files ran 11,432 runtime cases: 11,391 passed, the exact same 26 named baseline failures, 15 unchanged skips, no cancellations. Native elapsed 679.645 seconds; whole c8 run 754.011 seconds. Targeted scanner/invitation proof and all 12 intended owner faults are in [focused preservation](2026-10-04-next575/focused-receipt.md).

The first typecheck found that the transferred defaults assertion narrowed two later-mutated fields to null. The correction supplies the existing `ScanSessionState` as an explicit generic expected type. It changes no runtime assertion, input or call. The entire emitted test JavaScript is byte-identical before and after in CJS and ESM at both Node22 and esnext targets; [equivalence receipt](2026-10-04-final575-type-only-equivalence.json) records all four matching hashes. All other frozen bytes remain identical. The corrected scanner cohort was rerun: 143 passed, no skips or failures. Fresh `ci:verify` passes typecheck, lint and production build, with five existing lint warnings and all 221 static pages generated. Formatting and `git diff --check` pass.

Full native/source coverage evidence is reused across that erased type-only correction; this is not a claim that the full native command reran on the corrected TypeScript bytes. Source-map bytes for the test are excluded from runtime equivalence; production owner sources/maps are unchanged. The fresh corrected 4,502-path freeze records this reuse explicitly and verifies identity, membership, SHA256 and the two previously guarded research directories after the corrected checks. Scope includes 1,185 explicit selected inputs/dependencies, not a whole-vendor or all-data freeze. Hashes do not imply human source-reading credit.

| Metric | Actual aggregate change | Conservative original denominator change |
|---|---:|---:|
| Lines/statements | +0.312677 pp | -1.089101 pp |
| Functions | +0.218387 pp | -1.511345 pp |
| Branches | +0.030865 pp | -1.055023 pp |

Both aggregate two-percentage-point gates pass. Conservative accounting charges retired source owners zero coverage and preserves the larger per-path denominator. Coverage paths remain 1,935 baseline versus 1,892 current: the same 43 actual Git source deletions and no added paths.

Raw per-file diagnostics still flag 42 path/metric entries; there are no new flags versus 564. The only source-summary change since 564 is scanner-session branch records 122/128→120/126. Its lines, functions and exact zero-count mapped branch/function/statement locations remain unchanged. [Attribution](2026-10-04-final575-branch-attribution.json) preserves the actual diagnostic evidence. This is a covered V8 branch-shape change, not a per-file green claim or proof that every individual branch count is stable. Earlier retirement attribution keeps its documented scope.

Net code removal: 18,403 lines, comprising application/tooling 8,925 (66 added, 8,991 deleted, 118 paths) and tests/support 9,478 (3,136 added, 12,614 deleted, 253 paths). The test figure includes 49 lines of untracked PayPal support fixture; plans and evidence are excluded.

No commit, push, PR, merge, deployment or provider/remote-DB write. Claude counterpart authentication remains unavailable and cached; no new endorsement or publication readiness is claimed. Current-main reconciliation and the 20% campaign remain unfinished. Further telemetry, PDF and recompute candidates are uncredited proposals at this checkpoint.
