# Meta Purchase tracking

**Spec link:** Current decision thread, May 26 2026. No separate product spec yet.

**User situation:** We already track lead, quiz, checkout start, and subscription confirmation with the browser Meta Pixel. We now need Meta to receive a value-bearing `Purchase` event after a paid Stripe checkout so Ads Manager can attribute paid subscriptions with amount and plan context.

**Promised end-state:** After a successful Stripe subscription checkout returns to `/welcome?session_id=...`, Meta receives one browser `Purchase` event per Checkout Session with numeric value, currency, selected plan, and a coarse payment method type when safely available. The implementation must be shaped so a later server-side Conversions API event can reuse the same event ID and dedupe cleanly.

**Branch:** `codex/meta-purchase-tracking` in `.worktrees/meta-purchase-tracking`.

---

## Decisions

- **Immediate tracking layer:** Browser Pixel only, fired from the successful checkout return flow. This is fastest to ship and easiest to verify in Meta Events Manager.
- **Purchase truth source:** Use a Stripe-verified Checkout Session on the server page, not client-side URL params or local plan state.
- **Event identity:** Use the Stripe Checkout Session ID as the Meta `eventID` for `Purchase`. This gives us a stable future dedupe key for CAPI.
- **Value/currency:** Use Stripe's actual first checkout total and currency from the verified session, normalized to a decimal value and uppercase ISO currency.
- **Plan:** Derive the subscription interval from the retrieved subscription price, then send a stable content ID such as `premium_month`, `premium_quarter`, or `premium_year`.
- **Payment method:** Send only a coarse payment method type if Stripe exposes it without fragile extra assumptions, e.g. `card`, `paypal`, or `sepa_debit`. Do not send card brand, last4, bank details, customer name, email, or any payment identifier to Meta. User approved this broad-only approach.
- **Purchase + Subscribe:** Keep both `Subscribe` and `Purchase`. `Subscribe` remains the subscription conversion marker; `Purchase` adds value-bearing revenue data for Meta optimization/reporting.
- **Purchase consent posture:** Fire `Purchase` regardless of marketing-cookie consent for the beta tracking phase. Keep all other Meta events on the existing marketing-consent gate.

## Why Browser Now vs CAPI Later

Browser `Purchase` now:

- **Pros:** Smallest change, quick feedback in Meta Test Events, no Meta access token/env setup, no server event schema or hashing decisions.
- **Cons:** Can be blocked by browsers/ad blockers, depends on the user reaching `/welcome`, and cannot help when the webhook confirms payment but the browser never returns.

Server-side Conversions API later:

- **Pros:** More reliable payment truth because it can run from Stripe webhook fulfillment, survives browser blockers and abandoned return flows, can improve event match quality when implemented carefully, and is the right long-term source for purchase attribution.
- **Cons:** Needs Meta access token configuration, server payload construction, user-data hashing policy, event dedupe discipline, test-event plumbing, and careful privacy review.

Chosen shape: ship browser `Purchase` now, but include `eventID: checkout_session_id` so CAPI can be added later without changing the event identity model.

## Target File Map

```
src/lib/meta-pixel.ts
  Add Purchase payload typing and a helper that sends `Purchase` with value/currency/plan/payment metadata and an eventID.

src/app/welcome/page.tsx
  Build verified purchase analytics data from the Stripe Checkout Session/subscription before rendering WelcomeClient.

src/app/welcome/welcome-client.tsx
  Fire `Purchase` once next to the existing `Subscribe` event.

src/lib/stripe/checkout-activation.ts
  Reuse or extract small helpers only if needed to derive interval/payment metadata without duplicating fragile Stripe parsing.

tests/meta-pixel.test.ts
  Assert Purchase sends value/currency/content IDs and passes Meta event options with eventID.

tests/stripe-webhook-handlers.spec.ts or new focused test
  Only if helper extraction touches Stripe subscription parsing.
```

## Scope Boundaries

In scope:

- Add browser Meta `Purchase` after verified successful Stripe checkout.
- Include amount, currency, plan interval/content ID, and coarse payment method type if available.
- Keep `Subscribe` as-is unless a tiny shared dedupe helper is needed.
- Add focused tests for the Meta helper and any extracted Stripe purchase-data helper.

Out of scope:

- Meta Conversions API.
- Hashing or sending email/name/IP/user-agent to Meta from the server.
- Changing cookie consent behavior.
- Changing Stripe checkout pricing, coupons, tax behavior, or entitlement logic.
- Sending detailed payment details such as card brand, last4, issuer, bank, wallet account, or customer identifiers.

## Implementation Steps

- [x] Add a `MetaEventOptions` path to `trackMetaEvent` so a caller can pass `{ eventID }` as Meta's fourth `fbq` argument.
- [x] Add `trackMetaPurchaseConfirmed(purchase)` in `src/lib/meta-pixel.ts`.
  - Required fields: `eventId`, `value`, `currency`, `contentId`, `interval`.
  - Optional field: `paymentMethodType`.
  - Send standard event `Purchase`.
  - Payload:
    - `value`
    - `currency`
    - `content_name: "premium_subscription"`
    - `content_ids: [contentId]` if array payloads fit the current helper typing, otherwise `content_id` as a custom field and revisit when CAPI lands.
    - `content_type: "product"`
    - `subscription_interval`
    - `payment_method_type` only when present.
  - Use sessionStorage dedupe keyed by Checkout Session ID.
  - Intentionally initialize and fire even when marketing consent is absent; do not loosen the gate for other events.
- [x] Create a small server-side purchase analytics builder for the welcome page.
  - Input: verified Checkout Session plus Stripe client.
  - Use `session.amount_total` and `session.currency` when available.
  - Retrieve/inspect subscription price data to derive interval and content ID.
  - Best-effort payment method type:
    - Prefer the actual payment method type from an expanded payment intent/payment method when available.
    - Fall back to omitting the field rather than sending an allowed-method list as if it were the actual method.
- [x] Pass the purchase analytics object from `src/app/welcome/page.tsx` into `WelcomeClient`.
- [x] In `WelcomeClient`, fire `trackMetaSubscriptionConfirmed(sessionId)` and `trackMetaPurchaseConfirmed(purchase)` from the same mount effect.
- [x] Update tests.
  - Existing consent tests must continue to prove revoked consent blocks all events.
  - Add a test that Purchase includes numeric `value`, uppercase `currency`, product metadata, and the fourth fbq argument `{ eventID: sessionId }`.
  - Add a dedupe test that repeating the same session ID does not send a second Purchase in the same browser session.

## Verification

Automated:

- [x] `npx tsx --test tests/meta-pixel.test.ts tests/stripe-purchase-analytics.spec.ts`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`

Manual/browser:

- [ ] Run the app with `npm run dev:worktree`.
- [ ] Complete a Stripe test checkout from the quiz offer or pricing page.
- [ ] Confirm `/welcome?session_id=...` renders normally.
- [ ] In the browser console or Meta Pixel Helper, confirm one `Purchase` event fires with:
  - `value`
  - `currency: "EUR"`
  - `content_name: "premium_subscription"`
  - `content_ids` or equivalent stable content identifier
  - `subscription_interval`
  - `eventID` equal to the Checkout Session ID.
- [ ] Refresh `/welcome?session_id=...` and confirm no duplicate Purchase fires in the same browser session.
- [ ] In Meta Events Manager > Test Events, confirm `Purchase` appears after test checkout.

## Locked Grill Decisions

- Report actual Stripe `amount_total` because it includes discounts and tax and should reconcile better with revenue/ROAS.
- Send only broad payment method type when safely available.
- Keep both `Subscribe` and `Purchase`.
- Fire `Purchase` regardless of marketing-cookie consent, while leaving other Meta events consent-gated.

## CAPI Follow-Up Shape

When ready, add server-side CAPI from the Stripe fulfillment path:

- Fire from `checkout.session.completed` after `ensureCheckoutAccount` succeeds, and also handle delayed payment success if delayed payment methods are enabled.
- Send `event_name: "Purchase"` and `event_id: checkout_session_id`.
- Use the same value/currency/content ID model as browser Purchase.
- Include only approved customer matching fields, hashed where Meta requires it.
- Add env vars for Meta pixel ID/access token/test event code.
- Verify in Meta Test Events that browser and server Purchase arrive as one deduplicated conversion, not two purchases.

## Notes

- Stripe's Checkout fulfillment docs describe webhooks plus the return page as the recommended fulfillment pattern, and note delayed payment methods separately. Our current account activation already uses this pattern.
- Meta's Pixel/CAPI dedupe model depends on browser and server events sharing the same event name and event ID. Using the Checkout Session ID now avoids a future migration of purchase identity.

## Next Skill

Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` next, after the grill questions above are settled enough to implement.
