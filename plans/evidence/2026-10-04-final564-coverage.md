# Fully measured 564-removal checkpoint

Original AST baseline11,892; current11,328 (Node10,804, Playwright524):564net declaration removals, 4.7427%. The requested2,379target still needs1,815. This is an intermediate checkpoint.

The original-pinned1,090native files ran11,443cases:11,402PASS, the exact same26named baseline failures,15unchanged skips,0cancellations. Native elapsed258.242seconds; whole c8 run297.937seconds. Typecheck, lint and production build pass; five existing lint warnings remain. Targeted formatting and git diff --check pass. Fresh membership, worktree identity and all SHA256 hashes of the frozen4,375paths match after focused/native/CI runs. This scope includes1,031explicit selected inputs/dependencies and fresh membership of two previously guarded research directories; it does not claim whole-vendor/all-data coverage or human source reading from hashes.

| Metric | Actual aggregate change | Conservative original denominator change |
|---|---:|---:|
| lines | +0.312677 pp | -1.089101 pp |
| statements | +0.312677 pp | -1.089101 pp |
| functions | +0.218387 pp | -1.511345 pp |
| branches | +0.031301 pp | -1.052690 pp |

Both aggregate two-percentage-point gates pass. Conservative accounting charges deleted source owners zero coverage and preserves the larger per-path denominator. Coverage paths remain1,935baseline versus1,892current: the same43actual Git source deletions, no added paths.

Raw per-file diagnostics remain outside two points at42path/metric entries, three more than549. All three new flags are readiness-export lines/statements/functions after removal of17covered compatibility-wrapper lines. The two removed covered V8 function records are the actual classifyCandidate wrapper and its generated export getter. All retained readiness function records and normalized zero-count branch locations stay covered/uncovered as before; all six tests now call the canonical classifier. This is covered retired-code removal, not a new zero-count surviving branch. Two unchanged owner files have covered-only V8 branch-shape changes: identifier-lookup32/39→31/38 and refined-routine228/233→229/234; their exact zero-count branch locations are identical. Main inspected the actual branch/function maps and preserved raw flags in [attribution](2026-10-04-final564-branch-attribution.json). This is not a per-file green claim; historical39flags retain their previous evidence scope.

The latest15removals and46actual-owner fault receipts are in [focused proof](2026-10-04-next564/focused-receipt.md). Main inspected every intended assertion error and restored each source byte for byte before final runs. Frozen fifteen-file native focused proof:117PASS, one unchanged opt-in PostgreSQL SKIP,0FAIL. Isolated memory Playwright10PASS,0skip/retry/unexpected. Current source-wrapper removal earns zero declaration credit. Exact HASK captured replay is consolidated into an existing semantically equivalent generic lost-zero/sole-owner fixture; no product-specific policy is retired.

Net removed LOC18,316: application/tooling8,925 (66added,8,991deleted,118paths), tests/support9,391 (3,120added,12,511deleted,249paths). Includes49lines of untracked PayPal support fixture; excludes plans/docs.

No commit, push, PR, merge, deployment or remote/provider/DB write. Counterpart review remains open: Claude CLI previously returned Not logged in; unchanged authentication unavailability is cached. Local checks are complete for this measured tree;20%campaign, current-main reconciliation and publication gates remain unfinished. Further scanner/invitation candidates are proposals only and have no removal credit here.
