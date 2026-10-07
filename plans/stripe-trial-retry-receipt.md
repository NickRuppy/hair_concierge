# Stripe trial retry verification and review receipt

## Verdict and identity
**No blocking findings. Ready for publication when authorized.** Main correctness/structural review and independent Claude review approve. Publication remains pending.

- Branch: `codex/stripe-trial-retry`
- Base: `f865a89713ca20d26ad1fdf32c916e0ee7ba6efe`
- Scope: all six unstaged/untracked task files below; no committed changes.
- Canonical fingerprint: `c8db353e7b26fe1d87a0ba5f5c0a8a498a0d386285dbce4cdfc99b2fa4cd5d53`
- Algorithm: SHA-256 of sorted `path<TAB>content-SHA256<NEWLINE>` manifest. This receipt is excluded to avoid self-reference.

```text
plans/stripe-trial-retry.md	7baffea112dc5c60c4e70ac86ebb0d041a11f8cee351a1feed3e61ade43c147e
src/app/api/stripe/webhook/route.ts	caa6457d33c5014b46f0852fd472e24779b2f213859e50148e3aa65b9694b179
src/lib/stripe/trial-invoice.ts	85e094f3d91b771acecddca5ed9468fa170807836399baea9b560294ed35f8c2
src/lib/stripe/webhook-failure.ts	cf04b21cf458d1008d3376fc7e24aba08772fff6a9c9d078002ad9097407a667
tests/stripe-trial-invoice.test.ts	4e801d34fe02adbb862106f9c328c7404eef12113c5ee591107f7b6175b13d51
tests/stripe-webhook-failure.test.ts	a4434646b8c5ab1c360b9c7dd29490e76cef486f3a09e665f42d80e30af4cea6
```

## Outcome and decision coverage
Confirmed: Nick requested this observability follow-up with “good idea for the follow up, pls do”. Current internal revalidation finds no open consequential assumptions. The two-minute grace is a reporting default; failed handling still releases its claim and returns HTTP500. No successful-payment, billing, entitlement, provider, migration or customer-facing behavior changed.

Observed in tests: genuine absent initial links produce a typed reporting reason; a restored binding resumes normal zero-value invoice handling without recording a payment. Only matching successful paid EUR0 initial trial invoice events aged 0–120 seconds warn without generic payment-failure capture. Stale/nonzero/malformed/mismatched/continuation/recovery cases continue to alert. Release happens before reporting and the response remains HTTP500.

## Verification
- Valid behavioral red: isolated scratch copy with both new typed throws replaced by the original reconciliation error, keeping the class/export available: **47 passed, 3 assertion failures**. Log `/tmp/stripe-trial-producer-behavior-red.log`. Original source was never changed by this proof.
- Valid classifier red: warning classification disabled: **34 passed, 5 assertion failures**, restored afterward. Log `/tmp/stripe-webhook-failure-behavior-red.log`.
- Earlier `/tmp/stripe-trial-retry-red.log` failed because the new class was absent. Rejected as behavioral proof and superseded by the isolated proof above.
- `node --import ./tests/server-only-register.cjs --import tsx --test tests/stripe-trial-invoice.test.ts tests/stripe-webhook-failure.test.ts tests/payment-observability.test.ts tests/stripe-trial-subscription-lifecycle.test.ts`: **119 passed**, final source. `/tmp/stripe-trial-retry-final-node.log`.
- `npx playwright test tests/stripe-webhook-handlers.spec.ts --project=chromium --reporter=line`: **27 passed**. `/tmp/stripe-trial-retry-playwright.log`.
- `npm run typecheck`: **passed**, main and worker. Main log `/tmp/stripe-trial-retry-typecheck-main.log`.
- `npm run lint`: **passed, zero errors, five warnings in unchanged files**. `/tmp/stripe-trial-retry-full-lint.log`. Affected source ESLint also passed; test files are ignored by repository ESLint configuration.
- `npm run build`: **passed**. `/tmp/stripe-trial-retry-build.log`. Initial local setup failure was Turbopack rejecting an external node_modules symlink; replaced only that symlink with local dependencies using locked `npm ci`, then reran successfully.
- `git diff --check`: **passed**.
- One initial Node command mistakenly included a Playwright spec; discarded as a runner mistake, then rerun with the correct separate runners above.
- No browser journey check or live webhook replay: no UI or provider behavior change. Prior read-only provider evidence is in the plan. No live payment/refund/data write in this follow-up.

## Review
Normal correctness review plus structural maintainability lens: typed producer/consumer boundary, reporting conditions, existing resolver and catch behavior, failure ordering, privacy, missing/legacy/null data and regression evidence. Structural lens applies because the webhook route exceeds 1,000 lines and the change adds a shared failure-response module. The small module isolates a testable catch boundary without broad route refactoring. No blocking findings from main review.

Claude plan review: accepted contract/seam/age-source clarifications; design preferences and reporting-default decision disposition are recorded in the plan. First whole-change Claude review hit its 900-second timeout without a verdict; this is not approval. Bounded code-only retry `/tmp/stripe-trial-retry-code-review-retry.md`: **APPROVE, no hard defects**. Main reviewed all three residual notes: the immutable age cutoff intentionally applies to every delivery (the observed automatic retry succeeded after 16 seconds; do not rely on a fixed retry schedule); missing invoice markers intentionally retain alerts; the generic post-grace signal is unchanged. No source revisions required. Main reviewed the final null-invoice logging guard and corresponding test as a narrow delta.

## Artifacts and remaining risk
Commit candidates: six manifest files and this receipt. No files staged, committed, pushed, merged or deployed for this follow-up. Root main preserved.

Archive outside repository: `/tmp/stripe-trial-retry-*` logs/manifests/reviews, `/tmp/stripe-webhook-failure-behavior-red.log`, `/tmp/stripe-trial-producer-behavior-red.log` and isolated scratch `/tmp/stripe-producer-red-qjk_kr6n`; transient and not PR content. Local ignored dependencies, `.env.local`, `.next` and test output are not commit candidates. No persistent source generated by checks.

Residual risk: a real missing initial billing link has warning-level reporting for up to two minutes. It still returns HTTP500 and becomes an error on a stale failed redelivery. The grace is anchored to the immutable event creation time; retries cannot extend it. This reduces the observed misleading alert and does not claim every historical Sentry payment error has the same cause.
