# PayPal orders, email identity, and trial management — bounded audit

Current AST scope is **81**: orders 40, email identity 22, trial management 19. Exact current line/title marks are in `/tmp/test-audit-paypal-orders-email-management-sites.json`; hashes are orders `4cd3cfdc532fbe3ff40fb2b723e3ac22d00af7930ff75680ece3a65b84a2ca35`, email `5f75fda7998e63bbaf3f3fb661721d69339fd1c2a14f8a32a3169a8b917b9a6b`, management `e2ea97cb4880cf6b5ba278e9f7610223e0f4f418abc187bdf850a880779d8749`.

I consulted the prior complete PayPal runtime ledger (orders 43 historical sites) and deferred-plan closure documents before tracing current ASTs, current imports and overlaps. The three suites are provider boundary contracts, not generic fixture replays.

**R81 / F0 / C0 / D0.**

- **Orders R40:** distinct create/capture idempotency keys; full-representation/status/identity/amount/currency validation; noncharging recovery; pending/declined/provider-error partitions; webhook order/refund/dispute correlation; persistence-before-activation; durable retry and stale binding; sanitized operator recovery; entitlement/reservation/analytics and legacy route exclusions. Webhook tests start from a signed provider event while orders tests own capture/intent/recovery state; neither is a full-input keeper for the other.
- **Email identity R22:** subscription email persistence/null handling, provider metadata normalization, account-email precedence, foreign/duplicate owner rejection, checkout token/reservation binding and browser/webhook first ordering. `billing-paypal-server` overlaps generic activation but does not cover the full accountEmail-vs-subscriber-vs-intent provenance matrix or each mismatch outcome.
- **Trial management R19:** frozen provider schedule/request body, verified trial/billing boundary, payer reapproval, lost revision/create response exact retry, CAS cancellation/payment races, repair projection, foreign ownership/app rejection and no-future-interval query. These are not webhook replay duplicates: management owns outbound create/cancel/replacement and persistent freeze/CAS state.

The prior deferred-trial-plan source closure found only a non-credit fixture-builder decoupling: management’s four plan-builder imports produce subscription-plan fixture data, while each callback keeps a separate provider operation contract. That is already handled by the parent’s broader seam work and does not justify deleting any of these 81 declarations.

Current callers/overlaps include `src/lib/paypal/order-intents.ts`, `src/lib/paypal/trial-management.ts`, checkout recovery/activation, `tests/paypal-webhook-handlers.test.ts`, and `tests/billing-paypal-server.test.ts`. History shows deliberate retry/immutability hardening in `501769ff`, `b1d0de34`, `22af7e23`, `6f17e90f`, and the current provider recovery correction `f865a897`.

No provider, DB, runner, mutation, source fault or repository write was performed. The scoped native command if an implementation is later approved is `node --import ./tests/server-only-register.cjs --import tsx --test tests/paypal-orders.test.ts tests/paypal-email-identity.test.ts tests/paypal-trial-management.test.ts tests/paypal-webhook-handlers.test.ts tests/billing-paypal-server.test.ts`.
