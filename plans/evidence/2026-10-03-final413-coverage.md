# Final 413 full native and coverage proof

The frozen 413-removal tree ran all 1,091 surviving files from the original pinned native file list. TAP reports **11,599 runtime tests: 11,558 pass, the same 26 named baseline failures, 15 skips, zero cancellations**. Native execution took 321.979 seconds; native plus c8 reporting took 370.309 seconds. Exit 1 is the preserved baseline failure set, not a green full suite. The strict comparator verified failure identities, not only the failure count.

All four actual aggregate and conservative original-path metrics meet the two-percentage-point tolerance:

| Metric | Actual change (pp) | Conservative original denominator change (pp) |
| --- | ---: | ---: |
| lines | 0.1873 | -1.0840 |
| statements | 0.1873 | -1.0840 |
| functions | 0.2151 | -1.4917 |
| branches | 0.0368 | -1.0169 |

The conservative calculation includes retired paths and the larger of each original/current per-file denominator. Actual current line coverage is 69.97%, function coverage 83.29%, and branch coverage 81.58%. The worst conservative change is -1.4918 percentage points in functions.

Raw per-file diagnostics remain separate: **37 metric flags exceed two points, with no new flagged path/metric versus the 360 checkpoint**. They must not be described as a clean per-file guard. The earlier owner/body attribution for those existing flags remains in the 360 evidence. From 360 to 413, aggregate covered lines/statements/functions are identical; branch report shape changes in worktree-finish, thumbnail, scan-result-card, quiz scan-insert examples, and dm-mcp-client. Those changes do not create a new flagged metric. The thumbnail helper repair deliberately stops direct execution of its stateful hooks; it does not claim mounted image lifecycle coverage.

Post-run verification matched **all 3,470 frozen paths and byte hashes**, including file membership. No source or test changed during native/c8 execution. Typecheck, lint, and production build also passed before the freeze, with five existing lint warnings. Whole-branch counterpart review subsequently completed. Main resolved its three claims against existing actual-owner proof; see [review disposition](2026-10-03-final413-review-disposition.md).

Evidence: `/tmp/test-audit-retirement-final413-proof/{tests.tap,run.log,result.json,coverage-summary.json,coverage-final.json,lcov.info,files.json,command.json}`, `/tmp/test-audit-retirement-final413-comparison.json`, `/tmp/test-audit-final413-tested-tree.json`, and `/tmp/test-audit-final413-tree-verification.json`. Measured comparison and tree verification are archived alongside this receipt.

The target remains 2,379 net removals. This result verifies 413 (3.47%) and is not campaign completion. No commit, push, PR, merge, deployment, database, or provider write occurred.
