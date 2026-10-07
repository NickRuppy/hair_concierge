# Cross-boundary test cutover

Current worktree: `codex/test-audit-pruning`, pinned original base `21e0e41fa996ec6a725c258ab3766971f0edb94d`. Whole181 is complete: 11,840 native cases, 11,799 pass, same 26 named baseline failures, 15 skip; typecheck/lint/build and both global coverage gates pass. The user's 2,379-declaration target remains unchanged and unmet. This is a bounded next batch, with no product, provider, storage, policy, environment, publication or production change.

The read-only [value ledger](2026-10-02-cross-cutting-value-ledger.md) is input, not automatic authorization to delete every apparent duplicate. The independent layer pass checks these three boundaries separately. Exact names and row maps are in that ledger; no whole-file deletion is proposed.

## Invoice owner

Transfer `customer: "cus_1"` and `attempt_count: 2` into existing Node keeper `Stripe invoice failure reports once without exposing an invoice reference` in `tests/customerio-stripe-webhook.test.ts`. Its actual dispatcher calls the actual invoice logging helper before reading the absent profile; the trial handler returns before any provider read because this invoice has neither a subscription id nor trial marker. Retain all existing telemetry/privacy assertions.

Strengthen this existing keeper with a scoped `console.warn` receipt, restored in `finally`. Require one actual warning emission, without asserting the private prefix spelling or argument shape. The valid invoice id/customer/attempt inputs are transferred into the event; no artificial log-byte protocol is introduced. This positively establishes the real logging path and valid input. Do not invent a profile-read ordering contract. A unique throw injected into the actual `handleInvoicePaymentFailed` must make this keeper fail for that sentinel; source must then be restored exactly and the keeper pass.

After transfer-only green, remove the pure Playwright declaration `invoice.payment_failed logs and returns (no throw)` and its exclusive test import from `tests/stripe-webhook-handlers.spec.ts`. The production export stays: the route still imports it. This is one declaration removal, not a browser journey removal. Separate local native Playwright before/after coverage must use `/tmp/test-audit-invoice-playwright.config.cjs`; it selects only this pure stub-backed handler file and does not load `.env.local`, start a browser/server, or write external state.

## Classifier owner

Remove only nineteen of the twenty literal `TYPE_FIXTURES` rows mapped to existing literal `ADVERSARIAL` type-plus-step cases in the ledger. The composed production owner always calls the direct classifier; null and omitted catalogue category normalize identically. The discarded exact T1–T12 diagnosis labels have no runtime/operator/storage consumer. The actual T13 branch discriminator, its direct input cases and every unique input stay. No source behavior or export changes. Historical `plans/discovery-flat-checklist/plan.md:235` intentionally requested rule-ID fixtures alongside adversarial behavior. This cut retires that diagnostic test shape under the current authorized audit; it does not claim those fixtures were accidental or never required. Actual branch/type/step behavior remains owned by the retained literal adversarial cases.

This removes nineteen real duplicate executions but **zero AST declaration sites**: the original loop remains. No regrouping or rows-to-declarations quota inflation. Demonstrate representative actual branch faults (Oil treatment, scalp treatment, unknown input) are caught by retained adversarial cases, then restore source bytes.

## Premium access owner

Repair existing `a premium tier never performs the keepsake read at all` in `tests/freemium-lapsed-user-matrix.test.ts`. Its current throwing sentinel is swallowed by the actual owner's failure handling, and the test discards the result. Replace it with an external monotonic read counter returning a valid boolean. Require returned `premium` and zero reads; do not change the shared fixture helper's type.

Temporarily make the actual premium branch perform the forbidden read while retaining its premium result. The new zero-read assertion must fail; then restore the owner exactly and rerun green. Keep existing tier/keepsake failure-direction and matrix positives. This repair earns no deletion credit.

## Scope and checks

Exactly four existing test files may change. There are no new test declarations, source edits or replacement seams. Every mutation is temporary, serialized outside any active runner, and restored byte-for-byte before another control. Main inspects the full diff, exact counts, native coverage and independent preservation.

Baseline focused results are already completed: native four files 181/181 and pure Playwright file 28/28. Exact expanded commands and source-mapped c8 reports are in `/tmp/test-audit-cross-boundary-before` and `/tmp/test-audit-invoice-playwright-before`. Apply transfers/repair first and run both keeper lanes; then cut and repeat. Use the repository's native Node/Playwright runners, not imported OpenClaw commands. Format only changed tests; run diff/type/lint checks. Finish with the final frozen whole-suite coverage/failure comparison and required read-only branch review.

Expected accounting: 181→182 net declaration removals; Node declaration count unchanged, Playwright 534→533. Native full-suite executions decrease by nineteen independently of that count. The 20% target is still unmet; no smaller-target approval or completion claim is requested.

Counterpart disposition: keep the single `Pre-Shampoo Öl` TYPE row, which is the sole exact T10 rule assertion, as recommended by the independent plan reviewer. This reduces the batch to nineteen runtime rows, still zero Node declaration credit. Invoice and premium changes were accepted; the audit authorization covers routine repairs and consolidation, so no renewed permission or smaller target is inferred. Parent decision coverage is unchanged. Baseline commands are recorded in the linked layer plan. No commit is authorized.
