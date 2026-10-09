# Final 413 focused verification

Original 11,892 declarations minus current 11,479 = **413 net removals** (416 original declarations removed and three meaningful owner tests added). The target is 2,379, leaving 1,966. Current inventory: 10,954 Node and 525 Playwright declarations. This is a progress checkpoint, not completion.

The quiz/scanner cohort passed all 194 runtime cases after assertion transfer with every donor retained, then all 175 after 19 proven deletions. No failures, skips, or cancellations occurred. The preceding guidance reduction passed all 95 cases across its six scanner suites.

Main executed and inspected 20 quiz source faults, 31 scanner assertion faults, and one deliberate verdict-section exception. Every selected test ran exactly once, failed for its intended assertion or explicit exception, and passed after byte-exact source restoration. Nine old-keeper false passes establish eight transferred observations and the swallowed-exception repair. Complete measured evidence is in [control receipts](2026-10-03-next413-control-receipts.json).

The first criteria fault exposed a CPU spin in Node 22 assertion diagnostic generation. Main stopped the affected processes, verified source restoration, and credited neither interrupted attempt. Adding an explicit message to that existing criteria assertion produced the intended assertion error on rerun. The staged manifest was rehashed; the guarded editor preserved all non-target callbacks. This changed no input, output expectation, or count.

Guarded quiz and scanner editors verified source hashes, staged syntax, exact donor/keeper membership, preserved fixture inputs, and saved before bytes. Typecheck, lint, and production build subsequently passed with five existing lint warnings. Full native/c8 and post-run frozen-tree verification also completed; see [measured 413 coverage](2026-10-03-final413-coverage.md). The full suite retains the same 26 named baseline failures. Whole-branch counterpart review also completed; see [review disposition](2026-10-03-final413-review-disposition.md).
