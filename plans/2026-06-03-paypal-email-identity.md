# PayPal Email Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PayPal checkout preserve the user's Chaarlie email as the login/contact identity, store the PayPal email only as support-visible provider metadata, and prevent duplicate subscriptions by Chaarlie account email across payment providers.

**Architecture:** Keep `profiles.email`, Supabase Auth email, and checkout-intent email as the Chaarlie identity. Add `billing_subscriptions.provider_subscriber_email` for PayPal's subscriber email. Update PayPal activation to choose the Chaarlie email from the checkout intent/lead when available, while still storing the PayPal email on the billing row. Move duplicate-prevention semantics to Chaarlie identity only and surface duplicate access through a reusable checkout modal that links to `/auth?email=...`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase Postgres/Auth, existing provider-neutral billing helpers, Stripe checkout, PayPal JS SDK and PayPal REST activation, existing `Dialog` UI component, node:test via `tsx`, existing Playwright/component test patterns where available.

**Spec link:** `docs/superpowers/specs/2026-06-03-paypal-email-identity-design.md`

**User situation:** A user can enter one email in the Chaarlie quiz and pay with a PayPal account that uses another email. Today PayPal activation can create the app login under the PayPal email, which surprises users and can block them from completing onboarding after payment.

**Promised end-state:** A future PayPal buyer logs in with the email they gave Chaarlie. If PayPal uses another email, support can see it, but the user receives Chaarlie access and communication only through the Chaarlie email. If a Chaarlie email already has active or paid-through access, Stripe/PayPal checkout is blocked with a modal and a direct login link.

**Branch:** `codex/paypal-email-identity-plan` in `.worktrees/paypal-email-identity-plan`.

---

## Locked Decisions

- Chaarlie login/contact email is `profiles.email` and Supabase Auth email.
- PayPal email is stored as `billing_subscriptions.provider_subscriber_email`.
- `paypal_checkout_intents.email` remains the Chaarlie/lead email.
- PayPal email never receives Chaarlie login, onboarding, or subscription communication.
- PayPal email alone does not block checkout and can pay for multiple Chaarlie accounts.
- Chaarlie email/account duplicate access blocks checkout across Stripe and PayPal.
- The duplicate interruption is a modal/dialog overlay with a login link.
- `/auth?email=...` pre-fills email only; it does not auto-send a login link.
- The normal checkout payment area gets no new explanatory copy.
- PayPal welcome shows PayPal email only when it differs from Chaarlie email.
- Users cannot edit login email on PayPal welcome. Wrong-email cases go to support.
- Existing onboarded users are not bulk-migrated.

## Scope Boundaries

In scope:

- Schema migration for provider subscriber email.
- PayPal activation identity selection.
- PayPal subscriber email persistence.
- Duplicate guard change to ignore PayPal email as a blocker.
- Provider-neutral duplicate modal and login redirect.
- Auth email query prefill.
- Minimal PayPal welcome email display.
- Admin/support display of Chaarlie email and PayPal email.
- Tests for the core identity and duplicate behavior.

Out of scope:

- Automatic migration of existing completed/onboarded users.
- User-editable login email on welcome.
- Email sends to PayPal subscriber email.
- New refund tooling beyond existing duplicate PayPal subscription cancellation.
- Full checkout redesign.

## Target File Map

```
supabase/migrations/20260603120000_add_provider_subscriber_email.sql
  Add billing_subscriptions.provider_subscriber_email and optional comments.

src/lib/billing/types.ts
  Add provider_subscriber_email to billing input/row types.

src/lib/billing/subscriptions.ts
  Preserve/upsert provider_subscriber_email and return it in visible/current row helpers.

src/lib/paypal/subscription-shapes.ts
  Map PayPal subscriber.email_address into BillingSubscriptionInput.provider_subscriber_email.

src/lib/paypal/checkout-activation.ts
  Resolve Chaarlie account email from deps.accountEmail when available; store PayPal email separately.

src/lib/paypal/webhook-handlers.ts
  Pass bound PayPal checkout intent email into PayPal activation so webhook-first activation uses Chaarlie identity too.

src/lib/paypal/duplicate-guard.ts
src/app/api/paypal/approve-subscription/route.ts
src/app/api/paypal/create-subscription-intent/route.ts
  Keep duplicate checks by intent/user Chaarlie email; remove PayPal subscriber email as a blocker.

src/app/api/stripe/create-checkout-session/route.ts
src/components/checkout/payment-method-checkout.tsx
src/components/checkout/paypal-subscription-button.tsx
src/components/checkout/active-subscription-dialog.tsx
src/app/pricing/pricing-cards.tsx
src/components/quiz/result-offer-pricing.tsx
  Return/display provider-neutral duplicate modal with login link.

src/components/auth/auth-form.tsx
src/app/auth/page.tsx
  Existing /auth?email=... prefill is already implemented via defaultEmail; add regression coverage only.

src/app/welcome/page.tsx
src/app/welcome/welcome-client.tsx
  Pass Chaarlie email and PayPal email separately; show minimal mismatch display.

src/app/profile/page.tsx
src/app/admin/users/page.tsx
src/app/api/admin/users/route.ts
  Display provider subscriber email for support/admin where billing context is already shown.

tests/paypal-email-identity.test.ts
tests/billing-paypal-server.test.ts
tests/payment-duplicate-dialog.test.tsx
tests/auth-email-prefill.test.tsx
  Add focused coverage for identity choice, duplicate behavior, and UI states.
```

---

## UX Mockups

### Normal Checkout

No new copy.

```text
[ PayPal Button ]

[ Karte / SEPA anzeigen ]
```

### Duplicate Active Subscription Modal

Use existing `src/components/ui/dialog.tsx`.

```text
┌──────────────────────────────────────────────┐
│ Aktives Abo gefunden                         │
│                                              │
│ Für diese Chaarlie-E-Mail gibt es bereits    │
│ ein aktives Abo.                             │
│                                              │
│ rikku-07@web.de                              │
│                                              │
│ Bitte melde dich mit dieser E-Mail an,       │
│ um dein Abo zu nutzen.                       │
│                                              │
│ [Einloggen]                       [Schließen]│
└──────────────────────────────────────────────┘
```

Button target:

```text
/auth?email=rikku-07%40web.de
```

Fallback if the email is not known:

```text
┌──────────────────────────────────────────────┐
│ Aktives Abo gefunden                         │
│                                              │
│ Für dieses Konto gibt es bereits ein         │
│ aktives Abo.                                 │
│                                              │
│ Bitte melde dich an, um dein Abo zu nutzen.  │
│                                              │
│ [Einloggen]                       [Schließen]│
└──────────────────────────────────────────────┘
```

Button target:

```text
/auth
```

### PayPal Welcome, Same Email

```text
Zahlung erfolgreich

Konto aktivieren

Chaarlie-E-Mail
rikku-07@web.de

[ Passwort erstellen ]

[ Login-Link senden ]
```

### PayPal Welcome, Different Emails

```text
Zahlung erfolgreich

Konto aktivieren

Chaarlie-E-Mail
rikku-07@web.de

PayPal-E-Mail
scheer_stefanie@gmx.de

[ Passwort erstellen ]

[ Login-Link senden ]
```

Optional tiny helper only if needed after design review:

```text
Die PayPal-E-Mail nutzen wir nur zur Zahlungszuordnung.
```

### Auth Prefill

```text
Einloggen

E-Mail
rikku-07@web.de

[ Passwort ]

[ Einloggen ]

[ Login-Link per E-Mail senden ]
```

No auto-send.

### Admin/Support Email Display

```text
Chaarlie-E-Mail
rikku-07@web.de

PayPal-E-Mail
scheer_stefanie@gmx.de

Abo
Aktiv bis 02.09.2026
```

Paid-through canceled wording:

```text
Verlängerung gekündigt, Zugang bis 03.07.2026
```

---

## Task 1: Schema And Billing Types

**Files:**
- Create: `supabase/migrations/20260603120000_add_provider_subscriber_email.sql`
- Edit: `src/lib/billing/types.ts`
- Edit: `src/lib/billing/subscriptions.ts`
- Test: `tests/paypal-email-identity.test.ts`

- [ ] **Step 1: Add failing billing type/upsert tests**

Create a focused server test for `upsertBillingSubscription` proving:

- `provider_subscriber_email` is written on first insert.
- `provider_subscriber_email` is updated when provider data changes.
- Existing rows with no subscriber email remain valid.
- `findVisibleBillingSubscriptionForUser` returns `provider_subscriber_email`.

- [ ] **Step 2: Add migration**

Create the migration:

```sql
ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscriber_email text;

COMMENT ON COLUMN billing_subscriptions.provider_subscriber_email IS
  'Payment-provider subscriber/customer email for support reference only. Chaarlie login/contact email remains profiles.email.';
```

No index is required for V1 unless implementation later needs admin search by PayPal email.

- [ ] **Step 3: Update billing types**

Add `provider_subscriber_email: string | null` to `BillingSubscriptionRow`.

Add optional `provider_subscriber_email?: string | null` to `BillingSubscriptionInput`.

- [ ] **Step 4: Update billing helper upsert/selects**

In `src/lib/billing/subscriptions.ts`:

- Include `provider_subscriber_email` in the default row merge.
- Ensure it does not get dropped by `upsertBillingSubscription`.
- Add it to explicit select strings such as `findVisibleBillingSubscriptionForUser`.

- [ ] **Step 5: Run focused tests**

```bash
npx tsx --test tests/paypal-email-identity.test.ts
```

Expected: new billing tests pass.

---

## Task 2: PayPal Identity Selection And Subscriber Email Storage

**Files:**
- Edit: `src/lib/paypal/subscription-shapes.ts`
- Edit: `src/lib/paypal/checkout-activation.ts`
- Edit: `src/lib/paypal/webhook-handlers.ts`
- Edit: `src/lib/paypal/checkout-intents.ts` only if type naming needs clarification
- Test: `tests/paypal-email-identity.test.ts`

- [ ] **Step 1: Add failing activation tests**

Cover these cases:

- PayPal subscription email differs from checkout intent email.
- The auth/profile account is created or found using the checkout intent email.
- Webhook-first activation also creates/finds the auth/profile account using the checkout intent email.
- The billing row stores PayPal email as `provider_subscriber_email`.
- `paypal_checkout_intents.email` remains the Chaarlie/lead email.
- Missing checkout intent email falls back to any caller-supplied Chaarlie account email if available, then PayPal subscriber email.

- [ ] **Step 2: Map PayPal subscriber email into billing input**

In `toBillingSubscriptionInputFromPayPal`, set:

```ts
provider_subscriber_email: subscription.subscriber?.email_address?.toLowerCase() ?? null
```

Preserve existing `provider_customer_id`, status, interval, and metadata behavior.

Important: do not let later PayPal webhook payloads with no `subscriber.email_address` erase an existing stored subscriber email. Either omit `provider_subscriber_email` from the input when PayPal does not provide it, or preserve `existing.provider_subscriber_email` in `upsertBillingSubscription`.

- [ ] **Step 3: Resolve Chaarlie email inside PayPal activation**

Change `ensurePayPalCheckoutAccountForToken`, `ensurePayPalCheckoutAccount`, and the PayPal webhook caller so account lookup/creation uses a Chaarlie email resolved from:

1. `deps.accountEmail` when present.
2. PayPal subscriber email as last fallback.

Keep PayPal subscriber email for provider data only.

Add `accountEmail?: string | null` to `PayPalCheckoutActivationDeps`.

Token-return path:

```ts
const result = await ensurePayPalCheckoutAccount(subscription, {
  ...deps,
  activationKey: token,
  interval: intent.interval,
  leadId: intent.lead_id,
  accountEmail: intent.email ?? null,
})
```

Webhook-first path:

```ts
const activation = await ensurePayPalCheckoutAccount(subscription, {
  supabase: deps.supabase,
  premiumTierId: deps.premiumTierId,
  activationKey: boundIntent?.token,
  interval: boundIntent?.interval ?? intervalFromMetadata(subscription),
  leadId: boundIntent?.lead_id ?? null,
  accountEmail: boundIntent?.email ?? null,
  linkQuizToProfile: deps.linkQuizToProfile,
})
```

Inside `ensurePayPalCheckoutAccount`, after validating the PayPal subscription:

```ts
const accountEmail = deps.accountEmail?.trim().toLowerCase() || valid.email
```

Use `accountEmail` for:

- `findProfileByEmail`
- `createPayPalCheckoutUser`
- `upsertSubscriptionProfile(... email: accountEmail ...)`
- returned activation `email`
- `linkQuizToProfile(userId, accountEmail, leadId)`

Use PayPal subscriber email only through `toBillingSubscriptionInputFromPayPal` and `provider_subscriber_email`.

Also update the message in `assertNoDifferentCurrentSubscription`; after this change it is guarding the Chaarlie account, not the PayPal subscriber email.

- [ ] **Step 4: Keep password activation tied to token**

Ensure `canSetPasswordForPayPalSubscription` still validates `checkout_activation_session_hash` by token, not by email.

- [ ] **Step 5: Run focused tests**

```bash
npx tsx --test tests/paypal-email-identity.test.ts
```

---

## Task 3: Provider-Neutral Duplicate Blocking And Modal

**Files:**
- Edit: `src/lib/paypal/duplicate-guard.ts`
- Edit: `src/app/api/paypal/create-subscription-intent/route.ts`
- Edit: `src/app/api/paypal/approve-subscription/route.ts`
- Edit: `src/app/api/stripe/create-checkout-session/route.ts`
- Edit: `src/components/checkout/payment-method-checkout.tsx`
- Edit: `src/components/checkout/paypal-subscription-button.tsx`
- Create: `src/components/checkout/active-subscription-dialog.tsx`
- Edit: `src/app/pricing/pricing-cards.tsx`
- Edit: `src/components/quiz/result-offer-pricing.tsx`
- Test: `tests/paypal-email-identity.test.ts`
- Test: `tests/billing-paypal-server.test.ts`
- Test: `tests/payment-duplicate-dialog.test.tsx`

- [ ] **Step 1: Add duplicate guard tests**

Cover:

- Existing Chaarlie intent email access blocks PayPal checkout intent creation.
- Existing PayPal subscriber email access does not block.
- Post-approval duplicate for the same Chaarlie email can mark/cancel duplicate.
- Post-approval same PayPal email with different Chaarlie email is allowed.

- [ ] **Step 2: Remove PayPal subscriber email blocker**

In `src/lib/paypal/duplicate-guard.ts`, remove the branch that returns duplicate solely because `subscription.subscriber.email_address` already has access.

Keep:

- `intent.user_id` already has access.
- `intent.email` already has access.

Update `tests/billing-paypal-server.test.ts` at the existing PayPal duplicate guard coverage so it no longer expects `paypal_email_already_has_access`. Add the inverse assertion: same PayPal email plus different Chaarlie intent email is allowed unless the Chaarlie email/user already has current access.

- [ ] **Step 3: Return duplicate error with context email**

For provider-neutral checkout-start endpoints, return a structured `409` body:

```json
{
  "error": "checkout_access_already_exists",
  "email": "rikku-07@web.de"
}
```

Only include email that is already in checkout context:

- authenticated user's email
- lead/intent email

Do not disclose a broad lookup result that the browser did not already know.

Concrete route expectations:

- `src/app/api/paypal/create-subscription-intent/route.ts`: return the authenticated user email or lead email already used to create/check the intent.
- `src/app/api/stripe/create-checkout-session/route.ts`: return `user.email` for authenticated-user conflicts and `customerEmail` for lead/customer-email conflicts.
- `src/app/api/paypal/approve-subscription/route.ts`: for same-Chaarlie-email duplicate after approval, return the bound intent email when available.

- [ ] **Step 4: Create active subscription dialog**

Create `src/components/checkout/active-subscription-dialog.tsx` using existing `Dialog` and `Button`.

Props:

```ts
type ActiveSubscriptionDialogProps = {
  open: boolean
  email?: string | null
  onOpenChange: (open: boolean) => void
}
```

Dialog behavior:

- If `email` exists, show the known-email copy and link to `/auth?email=${encodeURIComponent(email)}`.
- Else show fallback copy and link to `/auth`.
- Secondary action closes the dialog.

- [ ] **Step 5: Wire modal into checkout UI**

In PayPal and Stripe checkout start handlers:

- If response status is `409` with `checkout_access_already_exists`, open modal instead of showing inline error.
- Preserve existing non-duplicate errors.
- Keep normal checkout UI unchanged.

Required wiring:

- PayPal: `PayPalSubscriptionButton` must parse `409` bodies from both create-intent and approve-subscription responses, surface the known context email, and open the modal instead of redirecting to the old duplicate welcome screen.
- Stripe: the `fetchClientSecret` callbacks in `src/app/pricing/pricing-cards.tsx` and `src/components/quiz/result-offer-pricing.tsx` must parse `409` bodies and lift duplicate modal state. `PaymentMethodCheckout` receives `fetchClientSecret`, so it cannot see Stripe 409s without callback plumbing from both parents.
- The Stripe modal triggers only after the user opens the collapsed card/SEPA checkout when PayPal is enabled; document that in manual verification.
- The old PayPal approval duplicate redirect to `/welcome?provider=paypal&token=...` should be replaced by the modal for true same-Chaarlie-email duplicates. Keep the full-page duplicate welcome only as a defensive fallback for direct stale duplicate links.

- [ ] **Step 6: Run duplicate/modal tests**

```bash
npx tsx --test tests/paypal-email-identity.test.ts tests/payment-duplicate-dialog.test.tsx
```

---

## Task 4: Auth Prefill Regression Coverage

**Files:**
- Test: `tests/auth-email-prefill.test.tsx`

- [ ] **Step 1: Confirm existing implementation**

`/auth?email=...` is already implemented:

- `src/app/auth/page.tsx` reads `useSearchParams()` client-side and passes `defaultEmail={searchParams.get("email") ?? undefined}`.
- `src/components/auth/auth-form.tsx` accepts `defaultEmail?: string` and initializes local email state from it.
- Magic link sending still requires an explicit button click.

Do not add a second prop such as `initialEmail`.

- [ ] **Step 2: Add auth prefill regression tests**

Cover:

- `/auth?email=rikku-07%40web.de` renders email input prefilled.
- No magic link request is sent automatically.
- User can still edit the email.

- [ ] **Step 3: Run auth prefill tests**

```bash
npx tsx --test tests/auth-email-prefill.test.tsx
```

---

## Task 5: PayPal Welcome Email Display

**Files:**
- Edit: `src/app/welcome/page.tsx`
- Edit: `src/app/welcome/welcome-client.tsx`
- Test: `tests/paypal-email-identity.test.ts`
- Optional UI/component test if welcome already has a test harness

- [ ] **Step 1: Add failing welcome tests**

Cover:

- Same Chaarlie/PayPal email: only Chaarlie email is shown.
- Different emails: Chaarlie email and PayPal email are shown.
- Password creation and login link requests still send to Chaarlie email only.

- [ ] **Step 2: Pass both emails from server welcome**

From PayPal activation, pass:

```ts
email={activation.email} // Chaarlie email
providerSubscriberEmail={activation.providerSubscriberEmail}
```

If the activation result does not currently expose provider subscriber email, extend the result type.

- [ ] **Step 3: Update welcome client display**

Replace the single "E-Mail aus deinem Checkout" label with:

```text
Chaarlie-E-Mail
```

Show a second read-only field only if normalized emails differ:

```text
PayPal-E-Mail
```

Keep layout compact and avoid adding normal-checkout explanatory copy.

- [ ] **Step 4: Keep account actions Chaarlie-email-only**

Ensure `handleCreatePassword` signs in using the Chaarlie email returned by `/api/auth/set-checkout-password`.

Ensure `handleMagicLink` calls `/api/auth/send-magic-link` with token/session only, and that the route resolves to the Chaarlie email.

- [ ] **Step 5: Run welcome tests**

```bash
npx tsx --test tests/paypal-email-identity.test.ts
```

---

## Task 6: Admin And Support Visibility

**Files:**
- Edit: `src/app/api/admin/users/route.ts`
- Edit: `src/app/admin/users/page.tsx`
- Edit: `src/app/profile/page.tsx` if billing section should show provider email for admins/users
- Test: existing admin/user tests if present, otherwise add focused component/server tests

- [ ] **Step 1: Decide display surface during implementation**

Minimum required: admin/support user list or detail surface should show both:

```text
Chaarlie-E-Mail
PayPal-E-Mail
```

If `src/app/admin/users/page.tsx` remains list-only, keep the list compact and add PayPal email only where a billing detail surface already exists. Do not make the user table unreadably wide.

- [ ] **Step 2: Include billing subscription data in admin response**

Extend admin query to include current/visible billing subscription rows, including `provider_subscriber_email`.

Be explicit about PostgREST embedding. If `profiles` cannot embed `billing_subscriptions` cleanly in `src/app/api/admin/users/route.ts`, fetch current/visible billing rows separately by user IDs and merge them in the route response.

- [ ] **Step 3: Show paid-through canceled wording**

Where subscription status appears, display:

```text
Verlängerung gekündigt, Zugang bis {date}
```

when `entitlement_status = canceled`, `cancel_at_period_end = true`, and `current_period_end` is future.

- [ ] **Step 4: Run admin/profile tests or manual checks**

Use tests if available; otherwise include browser/manual verification in Task 8.

---

## Task 7: Existing Data Backfill And Support Handling

**Files:**
- Create optional: `scripts/paypal/audit-email-identity.ts`
- Create optional: `supabase/manual-test-backfills/20260603_provider_subscriber_email_backfill.sql`
- Do not modify production data automatically from application runtime.

- [ ] **Step 1: Add audit script or documented SQL**

Produce a dry-run report for PayPal rows:

```text
user_id
profile.email
linked lead email
provider_subscription_id
provider_subscriber_email
onboarding_completed
last_sign_in_at
current_access
recommended action
```

- [ ] **Step 2: Backfill provider_subscriber_email where safely known**

For newly processed PayPal subscriptions, runtime writes the field.

For existing rows, either:

- retrieve PayPal subscription details and write `subscriber.email_address`, or
- leave null until the next webhook/activation touch if API backfill is not worth the risk.

Do not infer PayPal email from `profiles.email` for mismatched rows without a PayPal API confirmation.

- [ ] **Step 3: Document support handling for Stefanie-like cases**

Support/manual fix path:

- If user never signed in and lead email has no existing auth/profile conflict, support may change Supabase Auth email and `profiles.email` to the lead email.
- Preserve billing subscription, hair profile, lead link, and access state.
- Send magic login link to the Chaarlie email.

No automatic migration for completed/onboarded users.

---

## Task 8: Verification

**Automated checks:**

- [ ] Run focused tests:

```bash
npx tsx --test tests/paypal-email-identity.test.ts tests/payment-duplicate-dialog.test.tsx tests/auth-email-prefill.test.tsx
```

- [ ] Run broader payment/auth tests relevant to touched files:

```bash
npm run test:node
npm run test:playwright:contracts
```

If full contract suite is too broad for the execution branch, at minimum run existing Stripe/PayPal/billing/auth focused tests and document skipped suites.

**Manual/browser checks:**

- [ ] Quiz lead email equals PayPal email: PayPal welcome shows only Chaarlie-E-Mail and activation works.
- [ ] Quiz lead email differs from PayPal email: account is created under lead email, PayPal email is shown only on welcome, and login link/password activation uses lead email.
- [ ] Existing Chaarlie email has active access: PayPal checkout start shows modal and does not open PayPal.
- [ ] Existing Chaarlie email has active access: Stripe checkout start shows the same modal and does not start Stripe checkout.
- [ ] `/auth?email=rikku-07%40web.de` pre-fills email and does not auto-send.
- [ ] Admin/support can see Chaarlie email and PayPal email.
- [ ] Paid-through canceled subscription displays "Verlängerung gekündigt, Zugang bis ..." instead of a bare canceled state.

**Readiness gate:**

- [ ] Run `ready-check` before shipping because this touches checkout, auth, onboarding, copy, and trust.
- [ ] Request Claude review against this plan and the mockups before implementation or before PR, per user request.

## Implementation Notes

- Keep the normal checkout page visually unchanged.
- Do not add an email chooser on welcome.
- Do not disclose broad matched-account emails in duplicate responses.
- Do not block checkout merely because PayPal subscriber email has access elsewhere.
- Treat `billing_subscriptions` as the entitlement source of truth; `profiles` remains the access mirror.
