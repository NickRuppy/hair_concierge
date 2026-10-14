# Final-268 local raw coverage diagnostic

## Inputs and limits

Read-only comparison of `/tmp/test-audit-baseline/coverage-final.json`,
`/tmp/test-audit-retirement-final239-proof/coverage-final.json`, and
`/tmp/test-audit-retirement-final268-proof/coverage-final.json`, plus their
summaries, source maps/function maps, the pruning-worktree diff, and current
owners.  The final artifacts identify
`.worktrees/test-audit-pruning` sources; this report maps to that source,
rather than the root checkout's unpruned copies.

Global 239 -> 268 is 440,890/307,781 -> 440,748/307,661
lines/statements (69.80% -> 69.80%), 25,071/20,866 -> 25,048/20,845
functions (83.22% -> 83.22%), and 84,856/69,196 -> 84,825/69,166
branches (81.54% -> 81.53%).  The four local flags exceed a 2pp *file*
threshold but do not change the stated global/conservative outcome.

## One real surviving coverage gap: repair before treating the display flag as harmless

`src/lib/billing/display.ts` was reduced from 45/44 lines, 10/9 functions,
23/18 branches in final239 to 3/1, 7/4, 6/4 in final268.  Removal of
`formatBillingMembershipStatus` and private `isFutureDate` accounts for
most denominator movement.  However, the sole remaining real owner,
`formatBillingDate` at `src/lib/billing/display.ts:1-3`, has **zero**
final268 function hits.

That function remains live: `src/app/profile/page.tsx:2241-2251` renders
`formatBillingDate(membershipState.renewalAt)` whenever a non-trial,
non-uncertain membership has `renewalAt`.  The old
`tests/billing-display.test.ts` only exercised the now-deleted membership
status formatter; it never supplied this profile render.  The inspected
profile tests are source/route/smoke or trial-membership paths, not an actual
owner render with `renewalAt`.

**Repair needed:** an existing or new profile-page owner test must render the
surviving membership branch with a literal `renewalAt` and assert the
German-formatted date.  A direct utility unit test would improve the raw
metric but would not prove the live profile call.  No such keeper was found
in the current final268 test bodies.

## Flags explained by removed units, not a surviving missed contract

| File | final239 -> final268 | Source/diff mapping | Verdict |
|---|---:|---|---|
| `src/lib/billing/personal-plan-one-time-consents.ts` | lines 111/285 -> 89/226; functions 27/42 -> 20/32; branches 47/59 -> 32/44 | Removed functions are the Stripe, PayPal, and lead/session lookup wrappers plus their private provider-reference helper. The diff deletes 59 source lines; no retained primary owner lost a direct function hit: consent creation (2), ID lookup (198), provider bind (6), user bind (30), confirmation (28), delivery evidence (26), and patch conversion (6) remain hit. | No repair indicated. The 15 branch-count reduction is entirely in removed wrapper paths; statement/function-map duplicate zero entries are generated coverage artifacts. |
| `src/lib/billing/purchases.ts` | lines 192/283 -> 171/277; functions 31/41 -> 30/39; branches 111/142 -> 110/141 | The only production deletion is `hasCurrentOneTimePurchaseAccess` (`old:21-25`), a pure active-state alias. Its single assertion/import was removed. Retained semantic owners have matching positive primary hits in both artifacts: `resolveOneTimePurchaseAccessState` 316 -> 315, RPC state reader 184 -> 184, entitlement lookup 125 -> 125, provider-transaction lookup 87 -> 87, upsert 39 -> 39, status update 4 -> 4, sorting 54 -> 54. | No surviving function needs a repair. The apparent 21 covered-line loss is V8's duplicate transformed function/statement locations after the six-line shift, not evidence that an active purchaser path stopped executing. |
| `src/components/quiz/quiz-analysis.tsx` | lines 162/230 unchanged; functions 19/23 -> 18/22; branches 47/50 -> 46/49 | `getCommitHeading` was removed. `getLoadingHeading` was made private, but remains called by `QuizAnalysisView` at `:140` and has final268 primary function hit 3. The retained markup tests cover trimmed-name and blank-name loading text at `tests/quiz-analysis.test.tsx:116-147`. | No repair indicated. The one function/branch denominator change is the removed export/instrumentation, while lines/statements stay equal. |

## Source-map caution

The V8 function maps include generated helpers (`__name`, `__export`,
`get`) and nested duplicate entries for the same TypeScript function.  A
line-number-only comparison across the deletion shifts mislabels retained
functions as zero-hit. I used the worktree diff and the primary declaration
entries above; only display's surviving primary `formatBillingDate` is zero.

No tests, runners, mutations, providers, DB, environment loading, or tracked
repository files were changed.


## Main verification and repair after this read-only report

The latest 268 full snapshot preserved the aggregate tolerance, but genuinely lost execution of the live German billing-date formatter. Main added one dedicated date-owner declaration to the existing billing-display file, charging it against the quota: current net reduction is **267**, not 268. Its input is a locally constructed noon renewal timestamp; expected output is literal `20.10.2026`, with literal dash checks for null/undefined/blank. No production seam or copied formatter was added. Native three-file focus passes18/18. Focused c8 shows the actual remaining formatter has four hits; date-locale and empty-placeholder faults both fail the intended literal assertions, restore source bytes exactly, and pass again. A full profile render was not added: this preserves the formatter's own contract previously observed indirectly through a dead helper. The report's stronger profile-render recommendation is a pre-existing integration gap, not a proven lost profile-render assertion.

Main also corrects the quiz attribution above. `getCommitHeading` was already absent in the239 artifact. The239→268 change is the removed generated `getLoadingHeading` export getter (line1,2hits before); the real function at line16 remains exercised5→3times by actual loading renders. No newly uncovered surviving quiz function is indicated.

The completed268 report is a frozen historical snapshot before the date-owner repair. Next full integration must include the new keeper and any later cuts. Neither the aggregate gate nor a source-map explanation alone establishes preservation; this real gap was repaired rather than dismissed.
