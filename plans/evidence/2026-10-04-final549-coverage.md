# Fully measured 549-removal checkpoint

Original AST baseline 11,892; current 11,343 (Node 10,818, Playwright 525): 549 net declaration removals, 4.6165%. The requested 2,379 target still needs 1,830. This is an intermediate checkpoint.

The original-pinned 1,090 native files ran 11,457 cases: 11,416 pass, the exact same 26 named baseline failures, 15 unchanged skips, zero cancellations. Native elapsed 279.890 seconds; whole c8 run 354.231 seconds. Typecheck, lint and build pass; five existing lint warnings remain. Formatting and git diff --check pass. Fresh membership and all SHA-256 hashes of the frozen 4,051-path repository readset match after both runners. This scope includes 635 explicit guarded inputs; it does not claim a full vendor or all-data freeze.

| Metric | Actual aggregate change | Conservative original denominator change |
|---|---:|---:|
| lines | +0.313838 pp | -1.085296 pp |
| statements | +0.313838 pp | -1.085296 pp |
| functions | +0.219726 pp | -1.503494 pp |
| branches | +0.032172 pp | -1.048023 pp |

Both aggregate two-percentage-point gates pass. Conservative accounting charges deleted source owners zero coverage and preserves the larger per-path denominator. Coverage paths remain 1,935 baseline versus 1,892 current, with the same 43 actual Git source deletions and no added paths.

Raw per-file diagnostics remain outside two points at 39 path/metric entries, exactly the previous set; this is not a per-file green claim. Since checkpoint 538, only mobile research-delivery-worker's summary changed: branches 70/85 →69/84, while lines 298/329 and functions 12/14 stayed unchanged. Its exact zero-count branch ranges are unchanged; one covered V8 range is no longer separately reported. Main inspected actual branch locations/counts, and three actual owner controls demonstrated emitted credential error tagging, retry delay and fifth-attempt refunded statistics. The historical per-file attribution remains separately bounded by its recorded source/control evidence.

This batch's full assertion-transfer and 21 intended-failure control receipts are in [focused proof](2026-10-04-next549/focused-receipt.md). All deliberate faults were restored byte-for-byte before the final runs. Net removed LOC is 18,097: application/tooling 8,908 (66 added, 8,974 deleted,117 paths), tests/support 9,189 (3,051 added,12,240 deleted,240 paths). Includes the untracked PayPal test fixture; excludes plans/docs.

No commit, push, PR, merge, deployment or remote/provider/DB write. Counterpart review remains open: Claude CLI previously returned Not logged in, and unchanged auth state is cached. Local verification is complete for this measured tree; the 20% campaign and publication gates remain unfinished.
