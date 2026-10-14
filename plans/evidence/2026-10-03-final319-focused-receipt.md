# Applied 319 checkpoint

The original 11,892 declarations are now 11,573: **319 net removals (2.68%)**. Node: 11,048; Playwright: 525. Original declarations removed: 322; meaningful owner declarations added: 3. Target 2,379 remains unfinished; **2,060 further removals required**. Whole-suite coverage is still the completed 299 checkpoint. No completion or exhaustive usefulness claim.

## Seven applied cuts

Five Stage 3 duplicates, one unused comparison helper callback, and one repeated Stage 5 source contract are removed. All transferred observations remain in existing callbacks; the unused comparison helper is deleted. Mixed comparison tests now inspect the actual returned alternatives. The application, API, scanner, recompute and operator consumers already use those alternatives.

Whole seven-file cohort: **367 before → 367 after transfer → 360 after cut**, all pass with zero skips. Actual receipts: `/tmp/test-audit-owner-seam-{before,transfer,after319}.tap`. AST recount: `/tmp/test-audit-final319-declarations.json`. Guarded main cut receipts: `/tmp/test-audit-stage3-persistence-main-cut.json`, `/tmp/test-audit-selected-comparison-main-cut.json`, `/tmp/test-audit-stage5-retry-main-cut.json`.

All **19 actual owner faults** produced the intended assertion failures, with 38 surrounding selected green invocations and exact source restoration. Main inspected every failure stack and value difference. Receipt: `/tmp/test-audit-owner-seam-mutations/receipt.json`. Stage 3 proof: `/tmp/test-audit-stage3-persistence-cut-proof.json`. In particular, stale decisions and completed keys were positively observed on the input and actual loaded draft before replacement; preserving them under fault fails the retained pruning assertions. No empty-seed vacuity. Static retry source proof remains static; no mounted retry-click claim. One Node assertion diagnostic displayed a stale expression for the criteria fault; the actual stack points to the transferred nonempty-criteria assertion and the valid owner fault empties that field.

Claude's read-only plan review found no hard technical blocker. Its donor/caller spot checks and C2 loaded-state caveat are accepted. Its inference that 2,379 is structurally unreachable extrapolates from seven current cuts and the old eight-test checkpoint; it is unsupported by an exhausted whole-inventory audit. The original target remains unchanged. Decision coverage follows existing explicit authorization; formatting and reviewer preferences create no new permission gate. Reviewer output stays outside the repo at `/tmp/test-audit-owner-seam-followup-plan-review.md`.

## Zero-credit isolation repair

The Stage 3 authority fixture shared its Mask target by reference. A mutating case made a later case exercise the one-step compatibility branch instead of exact equality. Current clean verdicts were correct in both orders, but a real exact-equality source fault was masked in the old two-case sequence: **2 pass under fault**, while the isolated later case failed `supportive !== ideal`. Cloning each fixture target makes that same two-case sequence fail the intended later assertion. Source restored byte-exact; three named cases pass and full authority **112/112** passes. All callback bodies and counts remain unchanged.

Main verified the current authority file differed from the reviewed cut only by exact repository Prettier formatting before refreshing its pinned snapshot. Driver `/tmp/test-audit-stage3-mask-fixture-formatted-edit.cjs`; actual receipt `/tmp/test-audit-stage3-mask-fixture-proof/receipt.json`. This is bounded order-sensitive fault proof, not a claim that the whole old suite passed under the fault. Expected values remain independent literals. [Judgment](2026-10-03-stage3-mask-fixture-judgment.md).

## Existing route-wiring gap

The retained Stage 3 preview test executes the factory POST handler. The actual checked-in route exports only GET/PATCH, while `http-gateway.previewDecisionBundles` sends POST to that URL. These facts were independently read in current source. The factory test protects its bounded behavior and does not prove Next route wiring. This separate existing issue is recorded for a product fix; no actual deployed HTTP outcome or production repair is claimed.

The controlled local dev server and proxy were stopped cleanly before compilation. Final integrated typecheck/lint/build, frozen native/c8 and whole-branch review remain pending. Native c8 does not measure browser execution; the completed 312 browser receipts remain separately valid. No commit, push, PR, merge, deployment or provider write.
