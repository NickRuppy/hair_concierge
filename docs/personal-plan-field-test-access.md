# Personal Plan field-test access

This runbook operates the reusable, revocable Personal Plan field-test link. It does not deploy the feature or create a production campaign by itself.

## Production prerequisites

Before a campaign can be activated separately:

1. Deploy the reviewed application and Supabase migration.
2. Configure `PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET` in the production server environment with an independent high-entropy secret. Never expose it to the browser or commit it.
3. Confirm `/lp/haarplan` still presents the normal paid offer without a field-test cookie.
4. Confirm commercial analytics exclude `test_kind = field_test` and Customer.io workflows require `commercial_automation_eligible = true`.

## Operator command

The command is read-only unless every production write gate is present.

Preview the default 30-day, 100-activation, seven-day-access campaign:

```sh
npm run personal-plan:field-test-campaign -- create
```

After Nick separately authorizes production activation, create it with:

```sh
ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE=1 npm run personal-plan:field-test-campaign -- create --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

The raw link is printed once. Store it in the approved secret-sharing location; do not paste it into tickets, analytics, application logs, or source control.

Inspect a campaign without writing:

```sh
npm run personal-plan:field-test-campaign -- inspect --campaign=<campaign-uuid>
```

Preview revocation:

```sh
npm run personal-plan:field-test-campaign -- revoke --campaign=<campaign-uuid>
```

After separate approval, revocation uses the same production gates and atomically revokes the campaign, active field-test enrollments, and their tester grants:

```sh
ALLOW_PERSONAL_PLAN_FIELD_TEST_PRODUCTION_WRITE=1 npm run personal-plan:field-test-campaign -- revoke --campaign=<campaign-uuid> --apply --confirm-project=pqdkhefxsxkyeqelqegq
```

## Tester handoff

1. Open the secret test link in a fresh browser session on the participant's phone.
2. Confirm the banner says **„Kostenloser Chaarlie Produkttest · keine Zahlung erforderlich“**.
3. Complete the normal quiz. Any deliverable email address can be entered; it is used for the result/contact flow, not as the login identity.
4. Review the personalized result and full offer. The offer must show `0 €`, no payment-provider UI, and **„Kostenlos mit meinem Plan fortfahren“**.
5. Continue for free. The browser receives a seven-day guest session and opens the normal Personal Plan readiness/start flow.
6. Test Bedarf, refinement, exact products, Routine, and Anwendung in the same browser.
7. For the next participant, use a fresh browser session. A prior participant's guest session is intentionally not reused.

There is no email allowlist wait, password handoff, payment, or cross-device recovery in this version. If the browser session is lost, start a new test journey with the campaign link.

## Recovery and stop conditions

- Invalid, expired, revoked, or exhausted links stop before the quiz with one neutral unavailable message.
- An existing Chaarlie login or a prior tester session is never overwritten; the UI asks for a separate browser session.
- A failed activation can be retried only for the exact campaign, funnel session, lead, and synthetic guest.
- Revocation ends existing field-test access as well as future entry.
- If the free card appears together with Stripe, PayPal, Apple Pay, a subscription selector, or purchase/refund claims, stop the test and revoke the campaign.

Status of this implementation handoff: **NO_ACTIVATION**. No production campaign has been created and no production data has been changed.
