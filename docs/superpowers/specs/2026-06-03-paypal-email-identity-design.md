# PayPal Email Identity Design

## Reader Line

This spec defines how Chaarlie should separate the user's Chaarlie login email from the PayPal subscriber email, prevent duplicate subscriptions by Chaarlie account identity, and make the PayPal welcome flow understandable when the two emails differ.

## User Situation

A user can complete the Chaarlie quiz with one email and pay through PayPal with another email. Today the PayPal activation path creates or finds the app account by the PayPal subscriber email, even when the checkout intent already has the quiz/lead email. That can leave the user expecting access under the quiz email while the actual account exists under the PayPal email.

The concrete support case was:

- Quiz/lead email: `rikku-07@web.de`
- PayPal/app profile email created today: `scheer_stefanie@gmx.de`
- Billing subscription: active
- Lead and hair profile: linked
- Auth sign-in: never completed
- Onboarding: not completed

## Promised End-State

For future PayPal purchases, the Chaarlie account/login/contact email is the email Chaarlie already knows from the quiz lead or authenticated account. The PayPal subscriber email is stored only as payment-provider metadata for support/admin visibility. Normal checkout remains visually unchanged. If a duplicate active subscription is detected for the Chaarlie email, checkout is interrupted with a modal and a direct login link. If PayPal and Chaarlie emails differ, the welcome page shows the distinction briefly and uses the Chaarlie email for password creation and magic links.

## Terms

- **Chaarlie-E-Mail**: the app login, account, and Chaarlie communication email. Stored on `profiles.email` and in Supabase Auth.
- **PayPal-E-Mail**: the PayPal subscriber/account email returned by PayPal. Stored for support/billing reference only.
- **Chaarlie checkout email**: the checkout-context email, usually `paypal_checkout_intents.email` from the quiz lead or authenticated account.
- **Provider subscriber email**: provider-neutral storage field for payment-provider account email, planned as `billing_subscriptions.provider_subscriber_email`.

## Locked Decisions

- `profiles.email` remains the Chaarlie login/contact email.
- For PayPal checkout from a quiz lead, `paypal_checkout_intents.email` remains the Chaarlie/lead email.
- PayPal subscriber email is stored on `billing_subscriptions.provider_subscriber_email`.
- Chaarlie sends login, onboarding, support, and subscription emails only to the Chaarlie email.
- PayPal can send its own automatic receipts/subscription emails to the PayPal email; Chaarlie does not contact that email separately.
- PayPal email alone must not block checkout. One PayPal account may pay for multiple Chaarlie accounts.
- Duplicate active-subscription blocking is provider-neutral and based on the Chaarlie email/account, not PayPal email.
- If the same Chaarlie email somehow creates a second active PayPal subscription after approval, the duplicate can be canceled/marked duplicate.
- PayPal activation must use Chaarlie identity on both activation paths: the `/welcome` token path and the PayPal webhook-first path.
- Normal checkout/payment UI should not gain explanatory copy.
- The duplicate interruption is a modal/dialog overlay.
- `/auth?email=...` should prefill the auth email field but never auto-send a login link.
- The welcome page shows PayPal email only when it differs from the Chaarlie email.
- Users cannot edit the login email on the PayPal success/welcome page. Wrong-email cases route to support.
- Existing completed/onboarded users are not silently migrated. Support can manually fix users like Stefanie if needed.

## Current-State Audit Notes

Canceled PayPal rows with `cancel_at_period_end = true` and future `current_period_end` still have paid-through access. The real canceled users inspected had signed in, created passwords, completed onboarding, added routine products, and used conversations. They should not be bulk-migrated just because their subscription renewal was canceled.

Stefanie is the clear paid-but-not-activated case: no sign-in, no password, onboarding still at `welcome`, no routine products, and no conversations.

## Scope

In scope:

- Add provider subscriber email storage.
- Use Chaarlie/lead email for PayPal account activation when available, including webhook-first activation.
- Store PayPal subscriber email separately.
- Remove duplicate blocking/cancellation based only on PayPal subscriber email.
- Keep duplicate blocking by Chaarlie account/email.
- Add provider-neutral duplicate modal with login link.
- Preserve existing `/auth?email=` prefill and add regression coverage.
- Add minimal welcome page email distinction for PayPal mismatch cases.
- Add admin/support display for Chaarlie email and PayPal email.
- Include tests for duplicate guards, activation identity choice, and welcome/auth UI behavior.

Out of scope:

- Bulk migration of existing onboarded users.
- Allowing users to edit login email during PayPal welcome.
- Sending Chaarlie emails to PayPal subscriber email.
- New refund tooling beyond existing duplicate PayPal cancellation behavior for true same-Chaarlie-email duplicates.
- Rebuilding the full checkout/payment layout.

## UX Mockups

### Normal Checkout

No added explanatory copy.

```text
[ PayPal Button ]

[ Karte / SEPA anzeigen ]
```

### Provider-Neutral Duplicate Modal

Shown when the Chaarlie email/account already has active or paid-through access. Applies to Stripe, PayPal, and future providers.

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

Primary button:

```text
Einloggen -> /auth?email=rikku-07%40web.de
```

Fallback when email is unknown:

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

Primary button:

```text
Einloggen -> /auth
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

No extra paragraph is required in the normal state. If the design needs a tiny clarification below the PayPal line, keep it restrained:

```text
Die PayPal-E-Mail nutzen wir nur zur Zahlungszuordnung.
```

### Auth Page With Prefill

```text
Einloggen

E-Mail
rikku-07@web.de

[ Passwort ]

[ Einloggen ]

[ Login-Link per E-Mail senden ]
```

The page must not auto-send a link.

### Admin/Support Display

```text
Chaarlie-E-Mail
rikku-07@web.de

PayPal-E-Mail
scheer_stefanie@gmx.de

Abo
Aktiv bis 02.09.2026
```

For paid-through canceled access, do not show only `canceled`. Use:

```text
Verlängerung gekündigt, Zugang bis 03.07.2026
```

## Source Of Truth

- Account/login/contact identity: `profiles.email` plus Supabase Auth user email.
- Checkout-context identity before payment: `paypal_checkout_intents.email`.
- Payment-provider identity after payment: `billing_subscriptions.provider_subscriber_email`.
- Entitlement/access: `billing_subscriptions` current access logic plus `profiles` mirror.
- Quiz linkage: `paypal_checkout_intents.lead_id` and `leads.user_id`.

## Edge Cases

- Missing lead email: fallback to authenticated user email, then PayPal subscriber email only if no Chaarlie-side email exists.
- Existing Chaarlie email has active access: block checkout before provider opens where possible, show modal.
- Existing PayPal email has active access on another Chaarlie account: allow checkout; store/flag only for support.
- Same Chaarlie email races through two PayPal approvals: keep one entitlement and cancel/mark duplicate for the later true duplicate.
- PayPal webhook arrives before `/welcome`: use the bound checkout intent email as Chaarlie account email; do not create the account under PayPal email just because the webhook won the race.
- Existing onboarded mismatch users: leave login unchanged unless support explicitly decides to migrate.

## Open Risks

- Supabase Auth email updates for one-off support fixes need careful handling and should not be part of this feature's automatic runtime path.
- `provider_subscriber_email` backfill for existing PayPal subscriptions may require PayPal API retrieval if the email is not already present in current local records.
- Stripe may later want its own provider subscriber email semantics, but this plan only needs PayPal now.
- Later PayPal webhook payloads may omit `subscriber.email_address`; implementation must preserve an already stored `provider_subscriber_email` instead of overwriting it with null.
