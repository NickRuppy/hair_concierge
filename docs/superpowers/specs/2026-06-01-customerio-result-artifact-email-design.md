# Customer.io Result Artifact Email Design

## Goal

After a quiz user reaches the result/offer moment in the app, send them a transactional
Customer.io email that contains an email-safe version of the full result section and one
CTA back to the canonical result page.

The email is a service/artifact delivery email, not a marketing newsletter. It should send
to every completed lead once, regardless of marketing consent.

## Relationship To Existing Plans And Docs

This design supersedes the `/result/[leadId]` retirement portion of
`plans/2026-06-01-retire-quiz-analyze-share-results.md`. The old public sharing result
surface is still retired, but `/result/[leadId]` remains as the canonical original-user
return page for the artifact email and post-quiz routine flow.

This design also amends `docs/customerio-data-contract.md`: the Customer.io App API is no
longer reserved only for transactional auth emails. It is also the delivery path for
requested service/artifact emails such as `quiz_result_artifact`. Server-side person traits
and campaign/lifecycle events still use the Pipelines API.

## Non-Goals

- No PDF generation or attachment.
- No generated image preview.
- No free-trial or day-5 trial work.
- No PayPal-specific discount work.
- No individual coupon generation.
- No signed-token access for v1.
- No sharing/share-page optimization for v1.

## User Flow

1. User completes the quiz and reaches the result/offer screen in the app.
2. The client calls a backend "offer/result ready" endpoint with the `leadId`.
3. The backend verifies the lead, builds the result email payload from stored quiz answers,
   and sends a Customer.io transactional email.
4. The email shows the result section and one CTA: `Zur Routine`.
5. CTA opens `/result/[leadId]?focus=routine`.
6. The result page renders the canonical result + offer experience and scrolls to the
   plan/payment section when `focus=routine` is present.

## Customer.io Ownership

Customer.io owns the editable email HTML template. The app owns the data.

The app sends structured `message_data` to a Customer.io transactional template. The
template renders the data with Liquid. This keeps the email editable in Customer.io while
preventing Customer.io from reimplementing product/result logic.

Recommended transactional message id:

```text
quiz_result_artifact
```

The send should use `send_to_unsubscribed: true` because this is an expected artifact email
for a quiz the user completed.

Default envelope copy:

- Subject: `Deine Haaranalyse ist fertig`
- Preheader: `Öffne deine Ergebnisse und fahre mit deiner Routine fort.`

Transactional send details:

- Endpoint: `POST ${CUSTOMERIO_APP_API_URL ?? "https://api-eu.customer.io"}/v1/send/email`
- Auth: `Authorization: Bearer ${CUSTOMERIO_APP_API_KEY}`
- Body includes `transactional_message_id: "quiz_result_artifact"`.
- Body includes `identifiers: { "email": normalizedLeadEmail }`.
- Body includes `message_data` with the payload below.
- Body includes `send_to_unsubscribed: true`.
- Body includes `disable_message_retention: true`.
- Customer.io failures are logged and mark the lead email status as failed; they must not
  break the user's on-screen result/offer flow.

## Email Payload Shape

The backend should send a stable, email-oriented view model derived from the same
deterministic result narrative used by the app.

```json
{
  "lead_id": "uuid",
  "first_name": "Lea",
  "headline": "So kommen wir deinem Haarziel näher",
  "intro": "...",
  "rows": [
    {
      "label": "Haargefühl",
      "scope": "LÄNGEN",
      "before": "Frizz und unruhige Längen",
      "after": "ruhigere, glattere Längen"
    }
  ],
  "main_lever_title": "Frizz beruhigen, ohne zu beschweren.",
  "main_lever_why": "...",
  "routine_levers": [
    {
      "name": "Leave-in",
      "description": "..."
    }
  ],
  "cta_label": "Zur Routine",
  "result_url": "https://chaarlie.de/result/<leadId>?focus=routine"
}
```

The payload should avoid depending on deprecated `ai_insight` or `share_quote` fields.

Field mapping:

| Email field | Source |
| --- | --- |
| `lead_id` | `leads.id` |
| `first_name` | first sanitized token from `leads.name`; fallback `""` |
| `headline` | `QuizResultNarrative.heroHeadline` if used by the current result UI; otherwise current result heading copy |
| `intro` | `QuizResultNarrative.intro` |
| `rows[]` | `QuizResultNarrative.rows` with `label`, `scope`, `before`, `after` |
| `main_lever_title` | `QuizResultNarrative.needs.mainLeverTitle` |
| `main_lever_why` | `QuizResultNarrative.needs.mainLeverWhy` |
| `routine_levers[]` | `QuizResultNarrative.needs.products` mapped to `name`, `description` |
| `cta_label` | constant `Zur Routine` |
| `result_url` | absolute site URL plus `/result/${leadId}?focus=routine` |

Do not send raw free text fields such as `concerns_other_text`.

## Email Content

The email should include the full result section, adapted for email:

- first-name personalization
- result headline
- intro/result explanation
- three transformation rows
- "größter Hebel" section
- routine/product lever rows
- one CTA: `Zur Routine`

The email should not include the pricing/checkout block. Pricing belongs on the result page
after the CTA.

Transactional copy constraints:

- No discount-code copy.
- No price or pricing table.
- No countdown/urgency language.
- No "offer activated" language inside the email.
- No hard-sell copy that would make the message read like a marketing campaign.
- The CTA can be `Zur Routine` and may land on a page that contains the routine/plan/payment
  section, because the email itself is delivering the requested result artifact.

Customer.io template constraints:

- Use Liquid defaults for optional values.
- Escape rendered user-derived values in the template.
- Do not render full submitted names; use `first_name` only.
- The backend sanitizes first name to letters/numbers/spaces/apostrophe/hyphen and strips
  other raw user input.

## Result Page

`/result/[leadId]` becomes the canonical return page for this flow.

For v1, do not optimize around sharing. The page should prioritize the original user
returning from email:

- render the same result + offer experience the user sees after the quiz
- include plan selection/payment section
- accept `?focus=routine`
- scroll/animate to plan selection when `focus=routine` is present
- show a small neutral status when `focus=routine` is present: `Weiter mit deiner Routine`
- use concise routine-context copy near the next-step section when needed:
  `Wir schauen uns an, was du aktuell verwendest, damit Chaarlie gezielter empfehlen kann.`

## Offer Behavior

Use the same auto-applied offer in the email and on the result page. Do not introduce
manual coupon codes or unique per-lead coupons in v1.

The checkout path should continue to apply the configured Stripe offer automatically. If
future offer variants are needed, add a campaign-level offer key such as `welcome_email`
and map it server-side.

## Idempotency

Send once per lead. A genuine retake that creates a new lead can send another artifact
email.

Store these fields on `leads`:

```txt
artifact_email_status text null -- sending | sent | failed
artifact_email_claimed_at timestamptz null
artifact_email_sent_at timestamptz null
artifact_email_failed_at timestamptz null
artifact_email_error text null
```

The ready endpoint must atomically claim a lead before sending:

1. Verify the lead exists, has a normalized email, and has complete quiz answers.
2. Rate-limit by IP and by lead id.
3. Run a guarded update from `artifact_email_status IS NULL` to
   `artifact_email_status = 'sending'` and `artifact_email_claimed_at = now()`.
4. If no row is claimed, return success without sending.
5. Send Customer.io transactional email for the claimed lead.
6. On success, set `artifact_email_status = 'sent'` and `artifact_email_sent_at = now()`.
7. On failure, set `artifact_email_status = 'failed'`, `artifact_email_failed_at = now()`,
   and a sanitized `artifact_email_error`.

For v1, retry is manual: an operator/developer can reset a failed row to `NULL` and then
move it back through the endpoint, or build a dedicated operator replay tool later.
Automatic stale-`sending` reclaim is deliberately deferred to avoid hidden replay behavior.

The endpoint never trusts email/name/result content from the client. It only accepts `leadId`
and rebuilds everything from Supabase.

## Verification

- Unit test the email payload builder from representative quiz answers.
- Test that missing optional data gets safe fallbacks.
- Test idempotency: the ready endpoint sends once per lead.
- Test race safety: two concurrent ready requests claim only one send.
- Test Customer.io payload shape and `send_to_unsubscribed: true`.
- Test `disable_message_retention: true`.
- Test name sanitization and Liquid-template-safe fallbacks.
- Test `/result/[leadId]?focus=routine` scrolls to the plan selection section.
- Manually preview the Customer.io template with fixture payloads.
