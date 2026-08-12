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

There is no email allowlist wait, password handoff, payment, or cross-device recovery in this version. If the browser session is lost, start a new test journey with the campaign link.

## Recovery and stop conditions

- Invalid, expired, revoked, or exhausted links stop before the quiz with one neutral unavailable message.
- An existing Chaarlie login or a prior tester session is never overwritten; the UI asks for a separate browser session.
- A failed activation can be retried only for the exact campaign, funnel session, lead, and synthetic guest.
- Revocation ends existing field-test access as well as future entry.
- If the free card appears together with Stripe, PayPal, Apple Pay, a subscription selector, or purchase/refund claims, stop the test and revoke the campaign.

Status of this implementation handoff: **NO_ACTIVATION**. No production campaign has been created and no production data has been changed.
