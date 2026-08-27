# Field-test access

This runbook operates the reusable, revocable Personal Plan and regular-quiz field-test links. It does not deploy either feature or create a production campaign by itself.

## Production prerequisites

Before a campaign can be activated separately:

1. Apply the reviewed Supabase migration before deploying the application. The application campaign reads intentionally require the new `flow_kind` column.
2. Configure `PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET` in the production server environment with an independent high-entropy secret. Never expose it to the browser or commit it.
3. Configure `REGULAR_QUIZ_FIELD_TEST_ENABLED=true` before issuing a regular-quiz link. Turning it off is the global runtime stop for that flow.
4. Confirm `/lp/haarplan` still presents the normal paid offer without a field-test cookie.
5. Confirm commercial analytics exclude `test_kind = field_test` and Customer.io workflows require `commercial_automation_eligible = true`.

## Operator command

The command is read-only unless every production write gate is present.

Preview the default Personal Plan campaign (30 days, 100 activations, seven-day access):

```sh
npm run personal-plan:field-test-campaign -- create
```

Preview the same defaults for the regular quiz funnel:

```sh
npm run personal-plan:field-test-campaign -- create --flow=regular-quiz
```

### Email-linked moderator campaign

The June moderator reset uses a distinct Personal Plan campaign mode. It is not a guest link: every member is bound to an existing, confirmed Chaarlie account and can return on another device after signing in.

Prepare a restricted JSON file outside the repository with at most five exact members. Do not commit it or copy it into tickets. Its shape is:

```json
[{ "user_id": "00000000-0000-4000-8000-000000000000", "email": "person@example.com" }]
```

Preview an email-bound campaign with its fixed 90-day access duration:

```sh
npm run personal-plan:field-test-campaign -- create --identity-mode=email-bound --roster-file=/restricted/moderator-roster.json
```

This mode is only available for the Personal Plan, has an exact capacity equal to the supplied roster, and requires 2,160 hours. It creates every roster member as `pending`; the link must not be distributed and no member can enter until an independently approved complete-reset receipt has marked that exact member ready.

After the separate production reset and rollout approval, the same explicit write gate creates the campaign and its pending roster:

```sh
ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE=1 npm run personal-plan:field-test-campaign -- create --identity-mode=email-bound --roster-file=/restricted/moderator-roster.json --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

The campaign token starts the account-bound flow but never proves account ownership. The server checks the signed-in account’s exact UUID and confirmed normalized email against the ready roster. A changed email, pending reset, expired/revoked membership, or unavailable access lookup must stop safely; it must not fall through to paid checkout or a guest session.

After Nick separately authorizes production activation, create it with:

```sh
ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE=1 npm run personal-plan:field-test-campaign -- create --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

The regular quiz uses the same explicit gates, with its flow selected in the command:

```sh
ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE=1 npm run personal-plan:field-test-campaign -- create --flow=regular-quiz --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

The raw link is printed once. Store it in the approved secret-sharing location; do not paste it into tickets, analytics, application logs, or source control.

Inspect a campaign without writing:

```sh
npm run personal-plan:field-test-campaign -- inspect --campaign=<campaign-uuid>
```

Pass `--flow=regular-quiz` to inspect a regular campaign. The default remains `personal-plan` for backwards-compatible operator behavior.

Preview revocation:

```sh
npm run personal-plan:field-test-campaign -- revoke --campaign=<campaign-uuid>
```

For a regular campaign, include `--flow=regular-quiz`. Revocation always uses the campaign's immutable stored flow and ends only the matching enrollment type and its tester grants.

After separate approval, revocation uses the same production gates and atomically revokes the campaign, active field-test enrollments, and their tester grants:

```sh
ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE=1 npm run personal-plan:field-test-campaign -- revoke --campaign=<campaign-uuid> --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

## Tester handoff

1. Open the secret test link in a fresh browser session on the participant's phone.
2. Confirm the banner says **„Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich“**.
3. Complete the normal quiz. Any deliverable email address can be entered; it is used for the result/contact flow, not as the login identity.
4. Review the personalized result and full offer. The offer must show `0 €`, no payment-provider UI, and **„Kostenlos mit Chaarlie fortfahren“** for the regular quiz (or **„Kostenlos mit meinem Plan fortfahren“** for Personal Plan).
5. Continue for free. The browser receives a seven-day guest session and opens the normal Personal Plan readiness/start flow, or `/onboarding?lead=...` for the regular quiz.
6. In Personal Plan, test Bedarf, refinement, exact products, Routine, and Anwendung. In the regular quiz, test the normal onboarding and app journey in the same browser.
7. For the next participant, use a fresh browser session. A prior participant's guest session is intentionally not reused.

Guest campaigns have no email allowlist, password handoff, payment, or cross-device recovery; if the browser session is lost, start a new guest journey with the campaign link. Email-bound moderator campaigns instead use the account-bound flow above and return through the same signed-in email identity.

## Recovery and stop conditions

- Invalid, expired, revoked, or exhausted links stop before the quiz with one neutral unavailable message.
- An existing Chaarlie login or a prior tester session is never overwritten; the UI asks for a separate browser session.
- A failed activation can be retried only for the exact campaign, funnel session, lead, and synthetic guest.
- Revocation ends existing field-test access as well as future entry.
- If the free card appears together with Stripe, PayPal, Apple Pay, a subscription selector, or purchase/refund claims, stop the test and revoke the campaign.
- An email-bound moderator whose 90-day access has ended or been revoked reaches the Personal Plan test-ended state (or receives a `403` from a gated API), unless a separately valid paid entitlement exists. A database access-check outage returns an unavailable response; it must never be presented as expiry or a subscription paywall.

Status of this implementation handoff: **NO_ACTIVATION**. No production campaign has been created and no production data has been changed.
