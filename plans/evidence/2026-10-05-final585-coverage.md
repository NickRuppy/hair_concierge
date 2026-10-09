# Measured 585-removal checkpoint

Original AST11,892; current11,307 (10,783 Node,524 Playwright). Net585 removals,4.9193%; target2,379 still needs1,794. This is an intermediate checkpoint.

The original-pinned1,090 native files ran11,422 runtime cases:11,381 passed, the exact same26 named baseline failures,15 unchanged skips, zero cancellations/todo. Native duration307.227 seconds; complete c8 command381.419 seconds. This full run executes the current corrected scanner TypeScript bytes anew; it does not reuse the earlier575 type-only runtime equivalence. Runtime duration is recorded without a speedup claim.

Fresh ci:verify passes typecheck, lint and production build, with five existing lint warnings and221 static pages. Formatting preservation and git diff --check pass. All5,558 freshly frozen paths match identity, membership and SHA256 after both commands close, including2,430 explicitly selected inputs/dependencies and two guarded research directories. This is not an all-vendor/all-data freeze or human source-reading claim. [Focused ten-cut proof](2026-10-05-next585/focused-receipt.md) includes all15 intended actual-owner faults and exact source restorations.

| Metric | Actual aggregate change | Conservative original denominator change |
|---|---:|---:|
| Lines/statements | +0.311926 pp | -1.091564 pp |
| Functions | +0.217717 pp | -1.515270 pp |
| Branches | +0.032795 pp | -1.055023 pp |

Both aggregate two-percentage-point gates pass. Conservative accounting charges retired owners zero coverage and preserves the larger per-path denominator. Source coverage remains1,935 baseline paths versus1,892 current: the same43 actual Git source deletions and no added paths. [Actual comparison](2026-10-05-next585/comparison.json).

Raw per-file diagnostics remain42 path/metric flags; no new flags versus575. Auth alias removal retires11 previously covered lines and one covered export getter/branch record; the same uncovered locations remain after the exact approved line-offset mapping. Unchanged trial-admission loses one covered V8 branch record with all exact zero-count locations unchanged. Unchanged dm-mcp-client covers two previously zero-count locations, with no new zeros. [Attribution](2026-10-05-next585/branch-attribution.json) records all actual summary/location differences; this is not a per-file green claim. Earlier retirement attribution retains its documented limits.

Net code removal18,557 lines: application/tooling8,936 (66 added,9,002 deleted,118 paths) and tests/support9,621 (3,157 added,12,778 deleted,262 paths). Test support includes49 added untracked PayPal fixture lines; plans/docs excluded. [LOC receipt](2026-10-05-next585/loc.json).

No commit, push, PR, merge, deployment or provider/remote-DB write. Claude counterpart authentication remains unavailable and cached; no new endorsement/publication readiness. Current-main reconciliation and20% campaign remain unfinished. Stripe, partner-access, reactivation and one-time fulfillment proposals are uncredited at this checkpoint.
