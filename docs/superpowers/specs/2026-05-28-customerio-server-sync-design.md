# Customer.io Server Sync Design

## Reader Line

Campaign-critical Customer.io data should come from the server after Supabase or Stripe truth is written. Browser Customer.io remains for behavior and anonymous activity; server sync owns durable lead traits and billing lifecycle events.

## User Situation

Customer.io browser tracking, the analytics facade, and transactional auth emails are live. The remaining gap is that Customer.io does not reliably receive rich quiz traits or durable Stripe lifecycle events when browser tracking is blocked, delayed, or skipped. Campaigns need stable person traits and server-canonical trigger events.

## Promised End State

After implementation, quiz lead capture updates Customer.io with structured quiz traits and emits `quiz_profile_submitted` from the server. Stripe webhooks emit best-effort Customer.io lifecycle events after core fulfillment. Operators have one short data contract that names identifiers, traits, events, campaign-canonical sources, and payload boundaries.

## Decisions

- Use a hybrid architecture: browser for behavior, server for lifecycle truth.
- Use Customer.io Pipelines HTTP API for server-side `identify` and `track`.
- Use EU base URL `https://cdp-eu.customer.io/v1`.
- Use `CUSTOMERIO_SERVER_WRITE_KEY` in Vercel server environments.
- Use `X-Strict-Mode: 1`; Customer.io documents this for Pipelines validation.
- Use stable `messageId` values for important server events.
- Use email as the pre-auth Customer.io identifier.
- Use Supabase `user.id` as the long-term authenticated/customer identifier.
- Send `email`, `lead_id`, and `stripe_customer_id` as linkage traits.
- Send all structured quiz answers plus German labels for every successful quiz lead capture.
- Treat `marketing_consent` as the Customer.io campaign/email-send gate, not the ingestion gate.
- Set `consent_timestamp` only when marketing consent is true; use `quiz_completed_at` for both consent outcomes.
- Do not send raw free text, chat text, card details, billing address, tax IDs, or payment method identifiers.
- Emit server `quiz_profile_submitted` instead of reusing browser `quiz_lead_captured`.
- Reuse lifecycle names for Stripe truth events: `purchase_completed`, `subscription_started`, `subscription_updated`, `subscription_cancelled`, `payment_failed`.
- Disable browser Customer.io routing for `purchase_completed` and `subscription_started` when server Stripe events are added, so Customer.io does not receive duplicate campaign-trigger events.
- Customer.io failures are best-effort and logging-only in V1.
- Do not add direct Stripe-to-Customer.io integration yet.
- Do not add a retry table or queue in V1.

## API Contract

Server identify:

```json
{
  "userId": "person-identifier",
  "traits": {
    "email": "lead@example.com"
  },
  "messageId": "identify:lead:<lead_id>"
}
```

Server track:

```json
{
  "userId": "person-identifier",
  "event": "quiz_profile_submitted",
  "properties": {
    "source": "quiz_lead_api",
    "lead_id": "..."
  },
  "messageId": "quiz_profile_submitted:<lead_id>"
}
```

## Quiz Data Rules

The canonical trait list lives in [customerio-data-contract.md](../../customerio-data-contract.md). This design doc owns architecture and routing decisions; the data contract owns exact trait/event names.

When `marketing_consent` is false, Customer.io still receives the quiz lead profile and `quiz_profile_submitted` event. Marketing or lifecycle email campaigns must include `marketing_consent = true` in their trigger/entry criteria. Requested/transactional messages are a separate product and legal path.

## Stripe Data Rules

The canonical Stripe trait and event-property list lives in [customerio-data-contract.md](../../customerio-data-contract.md). Server Stripe events must include `source: "stripe_webhook"` and stable `messageId` values. Browser checkout-return events must not route to Customer.io for `purchase_completed` or `subscription_started` after this ships.

## Scope Boundaries

In scope:

- Customer.io server helper for Pipelines HTTP API.
- Quiz trait builder with labels.
- Background Customer.io sync from `/api/quiz/lead`.
- Best-effort Stripe lifecycle sync from the existing Stripe webhook.
- Focused tests for payload mapping, consent gating, Customer.io API request shape, and webhook sync behavior.
- Short reusable data contract doc.

Out of scope:

- Direct Stripe-to-Customer.io integration.
- Customer.io Meta CAPI destination.
- Reverse ETL.
- PDF generation.
- Customer.io reporting webhooks back into Supabase/PostHog.
- Retry queue or failed-sync table.
- New cookie category or privacy copy changes, unless implementation discovers a behavior not already covered by the existing Customer.io analytics/lifecycle copy.
- Raw free-text quiz answers.

## Operator Tasks

- Add `CUSTOMERIO_SERVER_WRITE_KEY` to Vercel Preview and Production.
- Verify Customer.io workspace identifiers include both `email` and `id`.
- Verify anonymous merge is enabled.
- Tell campaign builders to use `quiz_profile_submitted` for lead campaign triggers.
- Tell campaign builders to prefer `source: "stripe_webhook"` for revenue and subscription campaigns.
- Verify Data Index and Activity Logs after a real lead and a test checkout.

## Verification

Automated verification should prove:

- Rich quiz traits include all structured answers and labels for both `marketing_consent: true` and `marketing_consent: false`.
- Customer.io quiz lead sync still identifies and tracks when marketing consent is false.
- `consent_timestamp` is omitted when marketing consent is false.
- `concerns_other_text` is never sent.
- Server Customer.io requests use EU Pipelines endpoints, strict mode, Basic auth, and stable `messageId`.
- `/api/quiz/lead` returns success even when Customer.io fails.
- Stripe webhook handlers keep Supabase fulfillment as source of truth and do not fail on Customer.io errors.

Manual verification should prove:

- A real quiz lead creates/updates a Customer.io person.
- `quiz_profile_submitted` appears once with `source: "quiz_lead_api"`.
- A test checkout emits `purchase_completed` and `subscription_started` with `source: "stripe_webhook"`.
- A payment failure or subscription cancellation emits the expected lifecycle event when simulated.
