# Stripe Subscription — Design Spec

**Date:** 2026-04-19
**Status:** Approved during brainstorming; awaiting user sign-off before `writing-plans`
**Owner:** Nick
**Related:** `OVERVIEW.md` (Stripe listed as planned), `plans/business-plans.md` (outdated — superseded by this spec)

---

## 1. Context

Hair Concierge is about to gate its post-quiz experience behind a paid subscription. Today the app runs quiz → result → auth → onboarding → chat for free. After this change, access to onboarding and the AI chat requires an active subscription.

This spec defines the first Stripe integration: a hard paywall immediately after the quiz result, three billing intervals on one premium tier, Stripe-embedded Checkout on our domain, Supabase user creation on payment success, magic-link first login, and the Stripe Customer Portal for cancel/upgrade.

### Why now

- Marbella sprint (Apr 7–20) targets a web launch on 2026-04-20. A working paywall is required for launch.
- Tom's audience is warm (1.5M followers); conversion from the quiz funnel is the primary revenue mechanism.
- The existing `subscription_tiers` table and `profiles.subscription_tier_id` FK were scaffolded in `00001_initial_schema.sql` but never wired to a payment processor.

### Non-goals (explicitly out of scope for this spec)

- Free trial (deferred; MVP is paid-from-day-1).
- Freemium chat gating by message count (hard paywall only; no per-message caps).
- One-time purchases, affiliate payouts, Tom-branded bundles, or Plan 2/3/4 from `business-plans.md`.
- Progress photos, seasonal refresh, routine tracker as *entitlements* (those are future features; if built, they are all unlocked by the same `subscription_status='active'`).
- Referral credits, discount codes, promo flows.
- Accounts v2 migration (we stick with Customers v1 per Stripe's current default).
- Email receipts / invoicing PDFs beyond what Stripe sends by default.

---

## 2. User flow (end to end)

1. **Quiz** (existing, unchanged) — 7-question pre-auth flow. Email captured into `leads` table at the current step.
2. **Result card** (existing) — shareable. Adds a "Jetzt freischalten" CTA linking to `/pricing?lead=<leadId>`.
3. **Pricing page** `/pricing` — three cards:
   - **Monatlich** — €14.99 / Monat
   - **Quartal** — €34.99 / 3 Monate (~€11.66/mo, *22% sparen*)
   - **Jährlich** — €99.99 / Jahr (~€8.33/mo, *44% sparen*) — highlighted as "Beliebt"
   - Each card's primary CTA posts to `/api/stripe/create-checkout-session` with `{ priceId, leadId }`.
4. **Embedded Checkout** `/pricing/checkout` — server component creates a `checkout.Session` with `ui_mode: 'embedded'`, `mode: 'subscription'`, `customer_email` pre-filled from the lead's email and locked. Stripe's `<EmbeddedCheckoutProvider>` mounts the iframe. `consent_collection` includes the § 355 BGB withdrawal waiver via `custom_text`. Stripe handles SCA, VAT, dynamic payment methods.
5. **Payment success** — Stripe fires `checkout.session.completed` to our webhook (see §5). Browser redirects to `return_url = /welcome?session_id={CHECKOUT_SESSION_ID}`.
6. **`/welcome`** — server component retrieves session via `stripe.checkout.sessions.retrieve(id)`, gets `customer_details.email`, triggers `supabase.auth.admin.generateLink({ type: 'magiclink', email })`. Renders: "Zahlung erfolgreich – wir haben dir einen Login-Link an <email> gesendet."
7. **Magic link click** — Supabase signs the user in (user row was already created by the webhook), redirects to `/onboarding`.
8. **Onboarding → Chat** (existing, unchanged).

**Google OAuth is removed entirely from this build.** The existing Google button and handler in `src/components/auth/auth-form.tsx` are deleted. Auth surface after this change:

- **First sign-in for a new paid subscriber** — magic link via `/welcome` (see step 6 above). User lands directly in `/onboarding`; no password is set at this point.
- **Returning users** on `/auth` — email + password (existing flow) for users who have a password set, and the existing "Passwort vergessen?" reset-link flow for paid users who came in via magic link and never set one. Resetting effectively gives them a password.
- **Future** — a "Magic-Link senden" button on `/auth` can be added in a follow-up so paid users can sign in without ever setting a password. Out of scope for this spec.

Rationale: one fewer OAuth provider to test and reason about during the Marbella sprint; eliminates the Stripe-email-vs-Google-email mismatch risk class entirely.

### Failure / edge paths

- **User abandons Checkout** — lead remains in `leads`, no Supabase user created, no subscription. Retargeting email can be added later.
- **Webhook hasn't fired when `/welcome` loads** — `/welcome` still works (reads session from Stripe directly). Magic-link sign-in requires the Supabase user, which the webhook creates synchronously on the server path. If the user opens the magic link before the webhook completes, `/onboarding` shows a 2-second "Aktivierung läuft…" spinner that polls the profile for `subscription_status='active'`.
- **User types different email in Stripe than in their Google OAuth** — impossible here: `customer_email` is locked in the session and pre-filled from the lead. If they later try to Google-OAuth with a different address, they create a second (free) Supabase user. This is documented but not blocked in MVP; acceptable risk given magic link is the primary sign-in.

---

## 3. Stripe account setup (Sandbox / Test mode first)

All values are placeholders until captured in env.

- **1 Product:** "Hair Concierge Premium"
- **3 Prices (recurring, EUR):**
  - Monthly €14.99 → `STRIPE_PRICE_ID_MONTHLY` (sandbox: `price_1TNwPCK0IN8ErFegM1V54x0Q`)
  - Quarterly €34.99 → `STRIPE_PRICE_ID_QUARTERLY` (sandbox: `price_1TNwPyK0IN8ErFeggwGPBmgc`)
  - Annual €99.99 → `STRIPE_PRICE_ID_ANNUAL` (sandbox: `price_1TNwPyK0IN8ErFegLWCrHfPo`)
- **Payment methods enabled:** Card, Apple Pay, Google Pay, SEPA Direct Debit. Stripe auto-shows by country.
- **Stripe Tax:** enabled; Germany registered.
- **Customer Portal:** enabled with cancel-at-period-end, plan switching (all 3 prices), payment-method update, invoice history.
- **Webhook endpoint:** one Snapshot-payload destination, subscribed to exactly:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- **Live mode:** empty until launch. Live migration = re-create product/prices in live, swap env vars in Vercel, re-register live webhook endpoint.

### Env vars

```
STRIPE_SECRET_KEY                       sk_test_... (live: sk_live_...)
STRIPE_WEBHOOK_SECRET                   whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY      pk_test_... (live: pk_live_...)
STRIPE_PRICE_ID_MONTHLY                 price_...
STRIPE_PRICE_ID_QUARTERLY               price_...
STRIPE_PRICE_ID_ANNUAL                  price_...
```

Store in `.env.local` (gitignored) for dev and Vercel project envs for preview/prod. Never in code or chat.

---

## 4. Database schema

### New migration: `20260419_add_stripe_subscription_fields.sql`

```sql
ALTER TABLE profiles
  ADD COLUMN stripe_customer_id      text UNIQUE,
  ADD COLUMN stripe_subscription_id  text UNIQUE,
  ADD COLUMN subscription_status     text,        -- 'active' | 'past_due' | 'canceled' | 'incomplete' | NULL
  ADD COLUMN subscription_interval   text,        -- 'month' | 'quarter' | 'year'
  ADD COLUMN current_period_end      timestamptz;

CREATE INDEX idx_profiles_stripe_customer_id ON profiles (stripe_customer_id);
```

### Existing tables — behaviour

- `subscription_tiers` — kept as-is. Seed row `'Free'` and `'Premium'` stay. Pricing columns (`price_eur_monthly`, `price_eur_yearly`) become informational only; Stripe Prices are the source of truth. A follow-up can update the seed rows to match the new pricing if desired, but it's not functional.
- `profiles.subscription_tier_id` — flipped to the Premium tier row on activation, back to Free on cancel.
- `profiles.message_count_this_month` / `message_count_reset_at` — unused under hard paywall. Leave in place; remove in a later cleanup migration.
- `handle_new_user` trigger — unchanged. Webhook-driven user creation still goes through `auth.admin.createUser`, which inserts into `auth.users`, which fires the trigger, which inserts the `profiles` row. Stripe fields are set in a subsequent `UPDATE` within the same webhook.

### RLS

Stripe columns on `profiles` are read by the owner via existing `profiles_select_own` policy. No new policies needed. Webhook writes use the service-role key (bypasses RLS by design).

---

## 5. Webhook handler

**Location:** `src/app/api/stripe/webhook/route.ts`

### Verification

- Read raw body (Next.js route handler: `await req.text()`).
- Verify via `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`.
- Return 400 on signature failure. Return 200 as soon as fulfillment completes (or queue it; for MVP we execute synchronously — Stripe's 30s timeout is more than enough).

### `checkout.session.completed`

1. Parse `session.customer_details.email`, `session.customer` (Stripe customer ID), `session.subscription` (Stripe subscription ID).
2. Retrieve the full subscription: `stripe.subscriptions.retrieve(session.subscription, { expand: ['items.data.price'] })` to get the interval (`month` | `year` | for quarterly, `interval='month'` + `interval_count=3`).
3. Service-role Supabase client:
   - Look up `auth.users` by email.
   - If not found: `supabase.auth.admin.createUser({ email, email_confirm: true })`. The `handle_new_user` trigger auto-creates the `profiles` row.
4. `UPDATE profiles` where `id = user.id`:
   - `stripe_customer_id`, `stripe_subscription_id`
   - `subscription_status = 'active'`
   - `subscription_interval` = `'month'` | `'quarter'` | `'year'` (derived from `interval` + `interval_count`)
   - `current_period_end` = `to_timestamp(subscription.current_period_end)`
   - `subscription_tier_id` = Premium tier UUID
5. Idempotency: the handler is safe to replay. Upsert semantics, no side effects on duplicate calls.

### `customer.subscription.updated`

- Find profile by `stripe_customer_id`.
- Update `subscription_status`, `subscription_interval`, `current_period_end`.
- Handles plan switches (Monthly → Annual etc.) and `cancel_at_period_end` transitions (status remains `active`; client reads `current_period_end` to display "Abo endet am …").

### `customer.subscription.deleted`

- Find profile by `stripe_customer_id`.
- Set `subscription_status = 'canceled'`, `subscription_tier_id` = Free tier UUID.
- User's next request hits the middleware gate (§7) and is redirected to `/pricing`.

### `invoice.payment_failed`

- MVP: log only (Sentry breadcrumb). Stripe Smart Retries + default dunning emails handle the rest. Final retry failure fires `customer.subscription.deleted`.

---

## 6. Frontend components

### New

- `src/app/pricing/page.tsx` — three-card layout (Monatlich / Quartal / Jährlich). Annual highlighted. Reads `leadId` from query param and includes it in the POST.
- `src/app/pricing/checkout/page.tsx` — mounts `<EmbeddedCheckoutProvider>` with `fetchClientSecret` from `/api/stripe/create-checkout-session`.
- `src/app/welcome/page.tsx` — server component; retrieves session, triggers magic link, shows confirmation UI.
- `src/app/api/stripe/create-checkout-session/route.ts` — creates the Stripe Checkout Session, returns `client_secret`.
- `src/app/api/stripe/session/route.ts` — returns session status for `/welcome`.
- `src/app/api/stripe/portal-session/route.ts` — creates a Customer Portal session, redirects.
- `src/components/profile/manage-subscription-button.tsx` — "Abo verwalten" button on `/profile`.
- `src/lib/stripe/client.ts` — shared Stripe SDK init (`new Stripe(secret, { apiVersion })`).
- `src/lib/stripe/gating.ts` — `isSubscriptionActive(profile) => boolean`.

### Modified

- `src/app/result/[leadId]/page.tsx` — add "Jetzt freischalten" CTA.
- `src/lib/supabase/middleware.ts` — add subscription gate after session check (see §7).
- `src/app/profile/page.tsx` — add manage-subscription button, show `current_period_end`, show "Abo endet am …" when cancellation pending.
- `src/components/auth/auth-form.tsx` — remove Google OAuth button, `handleGoogleLogin`, the `"google"` loading state, and `googleButton` JSX from both login and signup tabs. Result: email + password only (forgot-password flow unchanged).
- `src/app/auth/actions.ts` / `src/app/api/auth/callback/route.ts` — audit for OAuth-specific branches; delete if any reference only the `provider: 'google'` code path.

### Copy (German, final)

- Pricing page title: "Dein personalisierter Haar-Concierge"
- Withdrawal waiver (Checkout `custom_text.after_submit`): "Ich stimme zu, dass der Zugriff auf das Abo sofort beginnt und ich damit mein 14-tägiges Widerrufsrecht verliere (§ 356 Abs. 4 BGB)."
- `/welcome`: "Zahlung erfolgreich – wir haben dir einen Login-Link an {email} gesendet."
- Re-sub banner: "Dein Abo ist abgelaufen — jetzt wieder freischalten."
- Cancel-pending banner on `/profile`: "Dein Abo endet am {date}. Du kannst bis dahin weiter nutzen."

---

## 7. Route gating

Extend `src/lib/supabase/middleware.ts`. Gate matrix:

| Route                          | Session? | Active sub? |
|--------------------------------|:--------:|:-----------:|
| `/`                            | no       | no          |
| `/quiz/*`                      | no       | no          |
| `/result/[leadId]`             | no       | no          |
| `/pricing`, `/pricing/*`       | no       | no          |
| `/welcome`                     | no       | no          |
| `/auth/*`                      | no       | no          |
| `/api/stripe/webhook`          | no       | no          |
| `/api/stripe/session`          | no       | no          |
| `/onboarding`, `/onboarding/*` | **yes**  | **yes**     |
| `/chat`, `/chat/*`             | **yes**  | **yes**     |
| `/api/chat`                    | **yes**  | **yes**     |
| `/profile`                     | yes      | no          |
| `/api/stripe/portal-session`   | yes      | yes         |

Unauthenticated hit on a session-required route → redirect `/auth?next=<path>` (existing behaviour preserved). Authenticated but `subscription_status !== 'active'` on a sub-required route → redirect `/pricing?reason=resubscribe`.

Subscription state is read from `profiles` via the existing server-side Supabase client — no extra DB round-trip beyond what middleware already does.

---

## 8. Customer Portal & cancellation

- On `/profile`, if `stripe_customer_id` is set: "Abo verwalten" button → server action → `stripe.billingPortal.sessions.create({ customer, return_url })` → redirect.
- Portal handles: plan switch, cancel-at-period-end, payment method update, invoice history. All state changes flow back via `customer.subscription.updated` / `.deleted` webhooks.
- Cancel lifecycle:
  1. User clicks Kündigen in Portal → Stripe sets `cancel_at_period_end=true`.
  2. Webhook updates profile; UI shows "Abo endet am {date}".
  3. On period end, Stripe fires `customer.subscription.deleted` → profile flips to canceled + Free tier.
  4. Next chat/onboarding request hits the middleware gate → redirect to `/pricing?reason=resubscribe`.
- Resubscribe: same pricing page. Creates a new subscription on the existing Stripe customer (reusing `stripe_customer_id` stored on the profile if the user is signed in).

---

## 9. EU / DACH compliance

- **§ 355 BGB 14-day withdrawal right** — waived by explicit unticked consent checkbox in Checkout via `consent_collection.terms_of_service = 'required'` + `custom_text`. Required because service starts immediately.
- **VAT** — handled entirely by Stripe Tax. Registration in Germany required before going live.
- **GDPR** — we do not create a Supabase user for non-payers. The `leads` row (email only, pre-consent marketing) remains for abandonment retargeting. Post-payment, Stripe handles PII per their DPA.
- **EU Directive 2023/2673 "Click to Cancel"** (effective June 2026) — satisfied by the Customer Portal cancel-at-period-end flow accessible in one click from `/profile`.
- **Invoicing** — Stripe sends invoice emails automatically on successful payments. No custom invoice generation needed for MVP.

---

## 10. Testing strategy

### Local dev

- `stripe listen --forward-to localhost:3000/api/stripe/webhook` — prints a **dev-only** `whsec_…` that you put in your local `.env.local`. This is *different* from the Dashboard webhook endpoint's signing secret, which goes in Vercel's env for preview/prod only. Do not mix the two.
- Test cards: `4242 4242 4242 4242` (success), `4000 0025 0000 3155` (3DS), `4000 0000 0000 0002` (decline). Any future expiry, any CVC, any postal code.
- SEPA test IBAN: `DE89370400440532013000` (success), `AT861904300235473202` (fails).

### Unit tests (Vitest)

Fixtures + tests in `src/app/api/stripe/webhook/__tests__/`:
- `checkout.session.completed` — new email → creates Supabase user + profile update.
- `checkout.session.completed` — existing email → only profile update.
- `customer.subscription.updated` — plan switch M→Q→A reflected in `subscription_interval`.
- `customer.subscription.updated` — `cancel_at_period_end=true` keeps status active.
- `customer.subscription.deleted` → profile flips to canceled + Free.
- `invoice.payment_failed` → logs, no state change.

### Playwright E2E

`tests/stripe-subscription.spec.ts`:
- Full golden path: quiz → pricing → Embedded Checkout test card → `/welcome` → magic-link intercept via Supabase admin API → `/onboarding` → `/chat` loads.
- Decline / 3DS / SEPA paths deferred to manual QA for MVP.

### Manual QA matrix (pre-launch)

- Card success, card 3DS, card decline
- SEPA success
- Apple Pay (Safari on macOS or iOS)
- Cancel in Portal → access persists → period end → access revoked
- Reactivate after cancel → new subscription on same `stripe_customer_id`
- Plan switch (M→A) → `subscription_interval` updated on profile within seconds
- Orphan cases: delete Stripe subscription directly in Dashboard → webhook fires → profile canceled

---

## 11. Known risks / open questions

- **Paid users without a password** — a user who signs up via Checkout + magic link has no password set. If they return later on `/auth`, they must use "Passwort vergessen?" to receive a reset link and set one. Acceptable for MVP; a "Magic-Link senden" button on `/auth` would make this frictionless and is a small follow-up.
- **Live mode cutover** — product/prices/webhook endpoint must be recreated in live mode before 2026-04-20. Add to the launch checklist.
- **Stripe Customer Portal copy localization** — portal UI is auto-localized by Stripe based on browser locale, but some fields (custom plan names) are taken from the product metadata. Confirm the product name "Hair Concierge Premium" renders acceptably in German; rename to a German-native name if desired.
- **Dunning email branding** — Stripe's default dunning emails are Stripe-branded. Acceptable for MVP; can be replaced later.
- **Refund self-service** — not in MVP. Manual via Dashboard. Document process in internal runbook before launch.

---

## 12. Out-of-scope follow-ups (later backlog)

- Promo / discount codes via Stripe Coupons.
- Retargeting email for abandoned Checkouts (using `leads` table).
- Progress photos, seasonal refresh, routine tracker as entitlements.
- "Magic-Link senden" sign-in option on `/auth` (so paid users never need a password).
- Re-introduction of Google OAuth (only worth it once a post-payment email-reconciliation UX is designed).
- Invoice PDF customization (company branding).
- Churn / LTV analytics to PostHog via webhook tap.
- Tier-based message caps (if we ever introduce a cheaper tier that isn't unlimited).

---

## Appendix A — Price ID mapping (sandbox)

| Interval   | Price ID (sandbox)                         | Amount |
|------------|--------------------------------------------|--------|
| monthly    | `price_1TNwPCK0IN8ErFegM1V54x0Q`           | €14.99 |
| quarterly  | `price_1TNwPyK0IN8ErFeggwGPBmgc`           | €34.99 |
| annual     | `price_1TNwPyK0IN8ErFegLWCrHfPo`           | €99.99 |

Live mode IDs will be captured in Vercel env at launch; this file does not track them.

---

## Appendix B — Files touched (summary)

**New:**
- `supabase/migrations/20260419_add_stripe_subscription_fields.sql`
- `src/lib/stripe/client.ts`
- `src/lib/stripe/gating.ts`
- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/stripe/create-checkout-session/route.ts`
- `src/app/api/stripe/session/route.ts`
- `src/app/api/stripe/portal-session/route.ts`
- `src/app/pricing/page.tsx`
- `src/app/pricing/checkout/page.tsx`
- `src/app/welcome/page.tsx`
- `src/components/profile/manage-subscription-button.tsx`
- `src/app/api/stripe/webhook/__tests__/webhook.test.ts`
- `tests/stripe-subscription.spec.ts`

**Modified:**
- `src/app/result/[leadId]/page.tsx`
- `src/lib/supabase/middleware.ts`
- `src/app/profile/page.tsx`
- `.env.local` / Vercel env (not committed)
