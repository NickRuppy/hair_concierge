# Payment support checker brief

This is a separate post-deploy task. It is not installed or authorized by the payment-feedback
implementation.

## Required behavior

- Read open/resolving `payment_support_cases` and compare with the prior checkpoint.
- Alert on new cases and stale receipt states: `pending` beyond 10 minutes or `sending` beyond 15
  minutes.
- Correlate only safe `PAY-…`, checkout-attempt, Sentry-event, provider, billing, and access fields.
- Start an investigation summary for Nick; do not contact the customer.
- Never send/retry a receipt or resolution, re-arm ambiguous delivery, finalize delivery, resolve a
  case, or delete data automatically.

## Activation gate

Keep `PAYMENT_SUPPORT_ENABLED` and `NEXT_PUBLIC_PAYMENT_SUPPORT_ENABLED` off until the checker has a
reviewed schedule, a controlled stale-state exercise, an alert receipt, and a rollback/disable
receipt. Customer-specific resolution still requires Nick's approval and the guarded exact-code
command.
