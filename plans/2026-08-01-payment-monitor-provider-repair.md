# Payment monitor provider repair

## Outcome

The production payment-integrity endpoint can list Stripe invoices without requesting an unsupported expansion. This is backend/operator-only work and changes no checkout UI, payment authorization, webhook behavior, billing state, or entitlement state.

## Confirmed cause

Stripe rejects the invoice-list expansion `data.parent.subscription_details.subscription`; the unexpanded response already carries the subscription ID required by the monitor.

## Repair

1. Remove the unsupported Stripe invoice-list expansion.
2. Preserve a regression test for the exact request contract and the modern parent subscription reference.
3. Verify the focused monitor suite, typecheck, lint, and build.
4. Deploy separately from customer payment-flow changes and confirm the authenticated production monitor response before loading its LaunchAgent.

## Residual operational check

This patch removes the confirmed Stripe request failure. A production run must still establish whether PayPal historical rows reconcile under the currently configured merchant account. Do not silently skip active rows or load the LaunchAgent until the full endpoint returns `200 completed`.
