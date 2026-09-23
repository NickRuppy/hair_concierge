# Discovery-Call funnel

## Purpose

`discovery_call_v1` (`/lp/call`) recruits participants for the manual discovery-call program
(see `docs/superpowers/specs/2026-09-22-discovery-call-toolkit-design.md` for the fulfillment
side). The funnel's conversion goal is a **booked video consultation**, not a purchase:
the quiz collects the participant's hair data before the call, and the offer page is a
rebuilt version of Jonas' VSL draft whose only CTA is the Calendly booking.

| Package             | Channel | Entry      | Landing       | Quiz             | Offer               |
| ------------------- | ------- | ---------- | ------------- | ---------------- | ------------------- |
| `discovery_call_v1` | `meta`  | `/lp/call` | `call-direct` | `legacy-quiz-v1` | `discovery-call-v1` |

The same link is shared organically (friends, family, extended network); package identity
still belongs to the funnel session, and the page never infers channel from referrer data.

## Journey

1. `/lp/call` has **no landing page by design**: the proxy mints the funnel session, then the
   route redirects straight into `/quiz` (query params preserved for attribution).
2. The quiz runs unchanged. The first question's info strip and the lead-capture/commit copy
   swap to prep framing via `src/lib/quiz/funnel-copy.ts`: the ten answers are the preparation
   so the call is about the participant's situation, not basics.
3. The quiz lead stores name, e-mail, and all answers — that is the data basis for call prep.
   There is deliberately **no in-app registration step** in this funnel; accounts are created
   later through the discovery-call toolkit's intake path. Participants enter their e-mail
   twice (quiz lead + Calendly booking); the addresses are how a booking is matched to its
   quiz data.
4. `/result/<leadId>` renders the `discovery-call-v1` offer
   (`src/components/discovery-call-offer/discovery-call-offer.tsx`): hero, proof stats,
   call steps, inline Calendly embed (`https://calendly.com/nick-chaarlie/20min`, first name
   prefilled — never the e-mail, because the result URL is reachable by lead id alone),
   Trustpilot review excerpts, and the "Wieso ist das kostenlos?" honesty section. The
   `pricingSlot` is intentionally unused.

## Copy boundaries

- All UI text in German; the anglicism „Call" is deliberately avoided — the flow says
  „Gespräch" / „Video-Gespräch" / „Termin" (Nick, 2026-09-22).
- Jonas' draft claimed a "4,2/5 auf Trustpilot" TrustScore; the rebuilt page shows only the
  verbatim selected reviews from `src/lib/trustpilot-reviews.ts`, consistent with the
  existing offers' claim policy.
- The walkthrough video (Jonas builds his mother a routine) is pending; the section is
  hidden until `DISCOVERY_CALL_VIDEO_SRC` in the offer component gets the asset.

## Analytics

`offer_viewed` fires through the shared `OfferTrackingProvider` (revision
`discovery_call_v1`). A completed booking inside the Calendly embed fires
`discovery_call_booking_scheduled` (PostHog + Customer.io + Meta `Schedule`)
via Calendly's `calendly.event_scheduled` postMessage.

### Meta CAPI lane (webhook)

The browser pixel is lost to ad blockers, so bookings also reach Meta
server-side: the offer page mints one booking event id, gives it to the pixel
event AND to the Calendly embed as `utm_content` (plus
`utm_source=chaarlie_funnel`). Calendly's `invitee.created` webhook returns
it, and `POST /api/calendly/webhook` fires a Meta CAPI `Schedule` with the
same `event_id` — Meta dedupes the two copies. Bookings without the id
(directly shared Calendly links) are deliberately not reported to Meta.
Calendly retries count on Meta's `event_id` dedupe; no local idempotency
store.

**Setup (one-time, Nick). Order matters: the key and the deployed route come
FIRST, the subscription last — Calendly only retries failed deliveries for
about 24 hours and may disable a persistently failing webhook, so the
receiver must already work when the subscription goes live.**

1. Calendly webhooks need a paid Calendly plan (Standard or higher) and a
   personal access token. YOU generate the signing key — Calendly does not
   issue one for PAT-created subscriptions, it uses whatever `signing_key`
   the creation call supplies.
2. Generate and persist the key, then configure Vercel and redeploy so the
   route stops answering 503:
   `CALENDLY_WEBHOOK_SIGNING_KEY=<openssl rand -hex 32>`,
   `META_CAPI_SCHEDULE_ENABLED=true`, and optionally
   `CALENDLY_EVENT_TYPE_URI=<event-type URI of the 20min meeting>` so a
   user-scoped subscription's other meeting types are ignored (find the URI
   via `GET https://api.calendly.com/event_types?user=<user URI>`).
3. Create the subscription with that same key:

   ```bash
   curl -s -X POST https://api.calendly.com/webhook_subscriptions \
     -H "Authorization: Bearer $CALENDLY_PAT" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://chaarlie.de/api/calendly/webhook",
       "events": ["invitee.created"],
       "organization": "<organization URI from GET https://api.calendly.com/users/me>",
       "scope": "user",
       "user": "<user URI from GET https://api.calendly.com/users/me>",
       "signing_key": "<the key from step 2>"
     }'
   ```

4. Verify with Meta's Test Events (`META_CAPI_TEST_EVENT_CODE`) on a test
   booking before relying on it. If the webhook ever gets disabled after a
   long outage, recreate the subscription (same call) — the signing key can
   stay the same.

## Operational notes

- Attribution follows package status alone (`src/proxy.ts`): the funnel is live while the
  package is `active` — no separate env flag.
- `frame-src` in the report-only CSP (`next.config.ts`) allowlists `https://calendly.com`.
- Existing members with access who enter `/lp/call` fall into the normal member result flow
  and never see the booking page; send them the Calendly link directly instead.
