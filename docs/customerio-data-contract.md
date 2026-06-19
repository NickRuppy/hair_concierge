# Customer.io Data Contract

## Purpose

Customer.io is the lifecycle and campaign destination. Browser tracking remains useful for behavior analytics, but campaign-critical lead and billing state must come from server-side app events after our own Supabase or Stripe truth is written.

## Identity Rules

- Anonymous browsing uses the Customer.io browser SDK anonymous identity.
- Pre-auth quiz leads are identified by normalized `email`.
- Authenticated users and customers are identified by Supabase `user.id`.
- `email`, `lead_id`, and `stripe_customer_id` are linkage traits, not app primary keys.
- `lead_id` is never the Customer.io person ID.
- Long-term app identity remains Supabase `user.id`, not email.

Customer.io workspace settings should keep both `email` and `id` identifiers enabled. Anonymous merge should remain enabled so browser activity can attach to the later identified person.

## API Choice

Server-side person traits and lifecycle events use the Customer.io Pipelines HTTP API in the EU region:

```txt
https://cdp-eu.customer.io/v1
```

All server calls use `CUSTOMERIO_SERVER_WRITE_KEY`, `X-Strict-Mode: 1`, ISO timestamps, and stable `messageId` values for dedupe where available. Customer.io documents strict mode for Pipelines; without it, validation errors can be logged while the API still returns `200`.

The Customer.io App API remains reserved for requested transactional/service emails, including
auth emails and quiz-result artifact delivery. It is not used for marketing campaigns.

## Quiz Lead Traits

After a successful quiz lead capture, Customer.io receives all structured quiz answers and German display labels regardless of the final quiz email-marketing consent choice:

```txt
email
first_name
lead_id
marketing_consent
consent_timestamp
quiz_completed_at
hair_texture
hair_texture_label
thickness
thickness_label
density
density_label
hair_length
hair_length_label
cuticle_condition
cuticle_condition_label
protein_moisture_balance
protein_moisture_balance_label
scalp_type
scalp_type_label
has_scalp_issue
scalp_condition
scalp_condition_label
concerns
concern_labels
chemical_treatment
chemical_treatment_labels
goals
goal_labels
```

`first_name` is the first whitespace-delimited token from the submitted quiz name. Do not send the full submitted name in V1 unless templates explicitly need it and privacy review approves it.

`marketing_consent` is the campaign and email-send gate, not the Customer.io ingestion gate. Campaigns that send marketing or lifecycle email must require `marketing_consent = true` in their trigger/entry criteria. If `marketing_consent` is `false`, Customer.io still receives the lead profile and `quiz_profile_submitted` event for operational lifecycle state, segmentation analysis, and requested/transactional flows.

`consent_timestamp` is only set when `marketing_consent` is `true`. Use `quiz_completed_at` as the lead/profile timestamp for both accepted and declined marketing consent.

Do not send raw free text such as `concerns_other_text`.

## Campaign Events

Customer.io campaigns should use server-source events for canonical triggers.

```txt
quiz_profile_submitted
purchase_completed
subscription_started
subscription_updated
subscription_cancelled
payment_failed
```

Browser events such as `quiz_lead_captured` remain analytics signals. Do not use browser `quiz_lead_captured` as the Customer.io campaign trigger when `quiz_profile_submitted` is available.

Marketing/lifecycle email campaigns that use `quiz_profile_submitted` must also filter for `marketing_consent = true`.

Requested service/artifact emails, such as the quiz result artifact email, are separate from
marketing/lifecycle campaigns. They may send without `marketing_consent` only when the email
delivers the artifact the user requested or just completed, avoids promotional email copy, and
uses the Customer.io App API transactional send path.

Browser `purchase_completed` and `subscription_started` must not be routed to Customer.io once server Stripe webhook events are live. PostHog and Meta can still receive the browser-return events.

## Event Source Rules

- `quiz_profile_submitted` uses `source: "quiz_lead_api"`.
- Stripe lifecycle events use `source: "stripe_webhook"`.
- Browser return events may use `source: "browser_return"` when sent to Customer.io.

## Stripe Payload Boundary

Customer.io may receive subscription and payment lifecycle details needed for campaigns:

```txt
stripe_event_id
checkout_session_id
stripe_customer_id
stripe_subscription_id
invoice_id
amount
amount_due
currency
interval
plan_id
subscription_status
attempt_count
```

Do not send payment instrument details, card brand, last4, billing address, tax IDs, bank details, or unnecessary Stripe internals.

## Failure Behavior

Customer.io sync is best-effort. Failures must never block quiz lead capture, payment fulfillment, auth email confirmation, or subscription activation. Log enough context to debug without logging secrets.

V1 uses logging only. Supabase remains the source of truth for manual backfills.

Manual replay should use Supabase rows as truth: rebuild the Customer.io payload from the lead/profile/subscription row and send it through the matching server-owned channel. Lifecycle events use the Pipelines API with stable `messageId` values; transactional/service artifacts such as `quiz_result_artifact` use the Customer.io App API after resetting their send status for replay. Do not replay from browser analytics events.

Use these stable message ID shapes for manual replay:

```txt
quiz_profile_submitted:<lead_id>
purchase_completed:<checkout_session_id>
subscription_started:<stripe_subscription_id_or_checkout_session_id>
subscription_updated:<stripe_subscription_id>:<stripe_event_id>
subscription_cancelled:<stripe_subscription_id>:<stripe_event_id>
payment_failed:<invoice_id>
```
