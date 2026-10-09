# Measured 628-removal checkpoint

The frozen 628-removal tree passes both aggregate coverage guards. This is an intermediate checkpoint: 11,892 → 11,264 registrations (5.28%), leaving 1,751 of the original 2,379-removal target. Net LOC removed: 19,235; application/tooling 9,176 and tests/support 10,059. Plans/docs are excluded.

Full native/c8 ran 1,090 files: 11,379 executed cases, 11,338 pass, exactly the same 26 named baseline failures and 15 skips, zero cancellation/todo. Exit 1 records those retained failures; this is not a wholly green suite. Typecheck, lint and production build pass; lint retains the original five warnings. The 9,234-path freeze verifies exact identity, membership, hashes and guarded research directories after both runners.

| Metric | Actual delta, percentage points | Conservative delta, percentage points |
| --- | ---: | ---: |
| Lines/statements | +0.355639 | −1.086415 |
| Functions | +0.207689 | −1.544500 |
| Branches | +0.035004 | −1.075594 |

The conservative calculation retains original paths, charges deleted covered owners as lost, and uses the larger original/current per-path denominator. Both guards remain within 2 percentage points. Raw per-file diagnostics still have 44 flags; none is new versus the 607 diagnostic. The two flags added since 585 are the independently attributed Stripe mixed-coordinate records and Partner adjacent-range coalescing; see the [prior attribution](../2026-10-05-next607-authorization/post-integration-followups/test-audit-607-coverage-attribution.md). Stripe still has 77 covered functions; its raw denominator is now 103 versus 105 in that earlier attempt. Raw metrics are reported unchanged, not corrected away.

Additional 607-to-628 map observations are bounded: two Discovery positive numerator/denominator pairs each decrease by one, with only the synthetic first-line record losing its matching hit; the dm SDK RequestTimeout classifier's two branch records are zero in the original baseline and this run, positive in the 607 attempt. These are not new original-baseline losses or deletion credit. Stripe line/branch comparisons span the subsequent metadata/private-wrapper repair and mixed mapped/VM coordinates. This receipt does not certify all possible live behavior from raw percentages.

All 15 newly affected test paths were formatted with exact TypeScript AST shapes preserved. Native/fault receipts for the six focused cohorts remain linked in the main plan. Later proposals and edits are outside this frozen checkpoint and require their own integration proof. No whole-inventory semantic completion, commit, push, PR, merge, deployment or production write.

The artifact index contains 38 files, 70,878,016 bytes; SHA256 `99745b4623d309a327e06d3ed530c7a952d9585f194dfcd1ae7914290be08372`. It includes full Istanbul JSON/LCOV/TAP, exact commands/results, CI logs, freeze, comparison, census, LOC and formatting receipts. Raw multi-process V8 temporary files remain in `/tmp/test-audit-retirement-final628-proof/tmp`; they are not included in this bounded archive. The Markdown receipt is written after indexing and is not part of that index.
