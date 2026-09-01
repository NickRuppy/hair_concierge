# Customer.io Data Contract

## Purpose

Customer.io is the lifecycle and campaign destination. Browser tracking remains useful for behavior analytics, but campaign-critical lead and billing state must come from server-side app events after our own Supabase truth is written.

## Identity Rules

- Anonymous browsing uses the Customer.io browser SDK anonymous identity.
- Pre-auth quiz leads are identified by normalized `email`.
- Authenticated users and customers are identified by Supabase `user.id`.
- `email`, `lead_id`, `provider_customer_id`, and `stripe_customer_id` are linkage traits, not app primary keys.
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

Payment-support receipts and human-approved resolution emails use the same App API path with
message IDs from `CUSTOMERIO_PAYMENT_SUPPORT_RECEIPT_TRANSACTIONAL_MESSAGE_ID` and
`CUSTOMERIO_PAYMENT_SUPPORT_RESOLUTION_TRANSACTIONAL_MESSAGE_ID`. Their payload contains only the
`PAY-…` report code, a delivery-attempt ID, and, for resolutions, the approved short note. A valid
`delivery_id` is required before local state becomes `sent`; network failure or an invalid 200 body
is `delivery_uncertain` and must never be retried automatically.

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

## Personal Plan Lead Traits

Personal Plan leads use the same identity rules but a dedicated, versioned projection. Shared
attributes are reused only when their primitive type and raw vocabulary match the legacy quiz:

```txt
email
lead_id
quiz_kind
marketing_consent
consent_timestamp
personal_plan_completed_at
personal_plan_profile_version
funnel_session_id
funnel_package_key
profile_line
hair_texture
hair_texture_label
thickness
thickness_label
density
density_label
hair_length
hair_length_label
protein_moisture_balance
protein_moisture_balance_label
```

Answers whose cardinality or vocabulary differs from the legacy quiz stay in the Personal Plan
namespace so an email address that completed both quizzes cannot silently change an existing
Customer.io attribute from a scalar to an array or replace its vocabulary:

```txt
personal_plan_hair_surface
personal_plan_hair_surface_label
personal_plan_scalp_oiliness
personal_plan_scalp_oiliness_label
personal_plan_scalp_concerns
personal_plan_scalp_concern_labels
personal_plan_has_scalp_concern
personal_plan_chemical_treatments
personal_plan_chemical_treatment_labels
personal_plan_concerns
personal_plan_concern_labels
personal_plan_goals
personal_plan_goal_labels
personal_plan_routine_style
personal_plan_routine_style_label
personal_plan_routine_clarity
personal_plan_routine_clarity_label
```

Do not project `blockersOtherText` or any other free text. Do not persist or identify a
`plan_expires_at` attribute. If an email presents a seven-day marketing date, Customer.io derives
that display value from `personal_plan_completed_at`; it is not an application-access deadline.
The existing Customer.io plan identifier remains a display derivation from `lead_id`.

Customer.io operator snippets:

```liquid
HP-{{ customer.lead_id | slice: 0, 5 | upcase }}
{{ customer.personal_plan_completed_at | date: '%s' | plus: 0 | add_day: 7 | date: '%d.%m.%Y', 'Europe/Berlin' }}
```

`add_day` and the timezone-aware `date` filter are documented in the official
[Customer.io Liquid syntax list](https://docs.customer.io/messaging/liquid/tag-list/).

Consented Personal Plan leads emit the stable server event `personal_plan_profile_submitted` only
after their identify call succeeds. A later consent change from false to true can request the event
once. Marketing campaigns using this event must also require `marketing_consent = true` as a
second gate and should be configured for one entry with re-entry disabled. The delivery uses a
stable message ID, but Customer.io delivery and the local delivered marker cannot be committed in
one transaction, so the campaign-level entry guard is the final duplicate-email safeguard.
Historical backfill requests profile identify delivery only and must never emit this event.
Before a live backfill, audit active Customer.io campaigns and pause or guard every segment- or
attribute-triggered flow that these identify updates could enter. Excluding the completion event
prevents entry into the new event-triggered campaign; it cannot by itself suppress an unrelated
campaign that reacts to changed person attributes. The backfill CLI therefore requires the
explicit `--confirm-campaigns-safe` preflight flag in live mode.

Cut over the Personal Plan automation from the existing `quiz_kind` / Segment 21 entry rule to
`personal_plan_profile_submitted`; do not leave both entry paths active for new leads. Activate the
event-triggered path only after the segment-triggered path is disabled or otherwise made mutually
exclusive.

## Campaign Events

Customer.io campaigns should use server-source events for canonical triggers.

```txt
quiz_profile_submitted
personal_plan_profile_submitted
purchase_completed
payment_completed
subscription_started
subscription_updated
subscription_cancelled
subscription_expired
payment_failed
refund_completed
```

Browser events such as `quiz_lead_captured` remain analytics signals. Do not use browser `quiz_lead_captured` as the Customer.io campaign trigger when `quiz_profile_submitted` is available.

Marketing/lifecycle email campaigns that use `quiz_profile_submitted` must also filter for `marketing_consent = true`.

Requested service/artifact emails, such as the quiz result artifact email, are separate from
marketing/lifecycle campaigns. They may send without `marketing_consent` only when the email
delivers the artifact the user requested or just completed, avoids promotional email copy, and
uses the Customer.io App API transactional send path.

Browser `purchase_completed` and `subscription_started` must not be routed to Customer.io once server billing outbox events are live. PostHog billing events should also come from the server outbox, while Meta can still receive browser-return events for Pixel/CAPI dedupe.

## Event Source Rules

- `quiz_profile_submitted` uses `source: "quiz_lead_api"`.
- `personal_plan_profile_submitted` uses `source: "personal_plan_lead_api"`.
- Billing lifecycle events use `source: "billing_analytics_outbox"` and include `billing_provider`.
- Browser return events may use `source: "browser_return"` when sent to Customer.io.

## Billing Payload Boundary

Customer.io may receive subscription and payment lifecycle details needed for campaigns:

```txt
source_event_id
checkout_session_id
provider_customer_id
provider_subscription_id
billing_provider
stripe_customer_id
stripe_subscription_id
invoice_id
amount
amount_due
value
currency
interval
plan_id
subscription_status
current_period_end
cancel_at_period_end
attempt_count
```

During the transition, Stripe events continue writing `stripe_customer_id`, `stripe_subscription_id`, and `subscription_interval` alongside provider-neutral traits. Do not remove those Stripe-specific traits until live Customer.io segments/campaigns have been audited and migrated.

Do not send payment instrument details, card brand, last4, billing address, tax IDs, bank details, raw provider webhook bodies, provider signatures, or unnecessary provider internals.

## Failure Behavior

Customer.io sync is best-effort. Failures must never block quiz lead capture, payment fulfillment, auth email confirmation, or subscription activation. Billing delivery failures are recorded in `billing_analytics_deliveries` with attempts and `last_error`; log enough context to debug without logging secrets.

Supabase remains the source of truth for manual replay. Billing replay should use `billing_analytics_outbox` and `billing_analytics_deliveries`.

Personal Plan profile delivery uses `customerio_profile_sync_outbox`. The outbox stores the lead
ID and delivery state only; the worker reloads current profile and funnel data from Supabase on
every attempt. Its monotonic `profile_revision` gives each changed profile a new identify message
ID while keeping retries of that revision idempotent. Only leads inserted after the outbox exists are event-eligible. Consented eligible
leads request the completion event once, including a later consent change from false to true.
Profile updates preserve an already delivered event marker. Historical backfill and later updates
to historical rows remain profile-only. Failed rows retry asynchronously and never make quiz
completion depend on Customer.io availability.

The lead route attempts the new row immediately after the response. The Vercel fallback cron runs
once daily because the current Hobby plan does not accept more frequent cron schedules; operators
can use `npm run customerio:profile-sync:retry` for an earlier manual retry. This daily cadence
affects failures only, not the normal first delivery attempt.

Manual replay should use Supabase rows as truth: rebuild the Customer.io payload from the lead/profile/subscription/outbox row and send it through the matching server-owned channel. Lifecycle events use the Pipelines API with stable `messageId` values; transactional/service artifacts such as `quiz_result_artifact` use the Customer.io App API after resetting their send status for replay. Do not replay from browser analytics events.

Use these stable message ID shapes for manual replay:

```txt
quiz_profile_submitted:<lead_id>
identify:personal_plan_lead:<lead_id>:<profile_revision>
personal_plan_profile_submitted:<lead_id>
<canonical_event_name>:<billing_analytics_event_key>
```

# Partner transactional messages

Partner access uses three optional transactional message IDs documented in
`docs/partner-access-operations.md`. Partner quiz and offer traffic carries
`test_kind=partner` to PostHog but is excluded from commercial Customer.io automation.
Transactional partner sends use message retention disabled and contain only the
recipient email, first name, and the purpose-specific link.
