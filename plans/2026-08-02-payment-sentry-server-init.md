# Payment server Sentry initialization hotfix

## Outcome

Server-side payment failures initialize and use the Node Sentry client before capture. The payment
monitor fails closed when no configured client or transport flush is available.

## Evidence and root cause

- Production deployment `97e5cff5` returned the expected controlled PayPal monitor failure at
  `2026-08-02T09:27:47Z`, but no Vercel event appeared in Sentry.
- The same PII-free payment signal reached the configured project through an explicitly initialized
  `@sentry/node` transport and was retrievable by event ID.
- The shared reporter currently depends on ambient `@sentry/nextjs` initialization. An uninitialized
  server bundle can still return a generated event ID and an empty successful flush, so the monitor
  can incorrectly treat telemetry as delivered.

## Implementation

1. Add a guarded server-only payment observability boundary that checks for a client with a DSN,
   lazily initializes the directly declared `@sentry/node` dependency from the runtime environment,
   and returns false when configuration is absent.
2. Separate SDK-free payment payload and scrubbing logic from thin browser (`@sentry/nextjs`) and
   server (`@sentry/node`) adapters. Route server-side payment monitoring, reconciliation, webhook,
   and activation failures through the server boundary; client checkout behavior remains unchanged.
3. Keep the existing receipt-count and flush checks; the server boundary makes those checks refer to
   an actual configured client.
4. Prove the original production failure reaches Sentry, then classify only the confirmed internal
   pre-cutover PayPal test and require a clean monitor result before loading the LaunchAgent.

There is no user-facing surface, copy, checkout-flow, or payment-state behavior change. No mockup is
required; the operator journey remains the reviewed payment-monitor rollout journey.
