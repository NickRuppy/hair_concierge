# OpenAI Ads measurement

## Implemented locally; activation pending

The integration adds a consent-aware landing Pixel, private session attribution, and an OpenAI destination in the existing billing outbox. The cookie banner and Meta, Customer.io and PostHog behavior remain unchanged. See [the implementation plan](../plans/openai-ads-conversions.md) for verification and boundaries.

| Chaarlie event | OpenAI event | Role |
| --- | --- | --- |
| Provider-confirmed free trial | `trial_started` / `plan_enrollment` | Primary |
| First successful paid purchase | `order_created` / `contents` | Secondary |
| Permitted public landing view | `page_viewed` / `contents` | Browser measurement |

The saved Pixel ID is `HQtJsN7wjuS5gYccnqd3vd`; trial and purchase definitions were created in Ads Manager on 2026-09-15. Recheck their current status before activation. The campaign currently uses a Clicks objective; selecting a primary reporting conversion does not change that objective.

## Configuration

Provision through deployment configuration. These are placeholders, not a command to enable production:

```dotenv
NEXT_PUBLIC_OPENAI_ADS_ENABLED=false
OPENAI_ADS_ENABLED=false
NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID=HQtJsN7wjuS5gYccnqd3vd
OPENAI_ADS_PIXEL_ID=HQtJsN7wjuS5gYccnqd3vd
OPENAI_ADS_CAPI_KEY=<server-only secret>
```

Both IDs must match. Public variables require a rebuild. The integration also uses the existing `FUNNEL_COOKIE_SIGNING_SECRET`, signed funnel session and production funnel attribution bootstrap. Never expose the CAPI key in a public variable, source, chat or logs. The flags control rollout; they never supply consent.

## Delivery behavior

- Browser reads the existing marketing choice; server stores its acknowledged revision in service-only tables. Missing, denied, expired or mismatched context prevents conversion delivery. Consent and raw attribution expire after 90 days. Background cleanup runs in the existing analytics reconciliation branch (`BILLING_ANALYTICS_RETRY_ENABLED=true`).
- Checkout gives context synchronization at most one second; advertising failure does not block payment. A context write arriving after the conversion can cause undercount; late context does not revive that event. Context binds the exact signed funnel session and visitor, without a latest-user fallback.
- Server sends only fresh canonical trial/first-purchase events. No renewal, zero-value paid conversion, internal/field/partner test, historical backfill or browser success-page duplicate. Retry IDs and original timestamps remain stable.
- `skipped` is terminal and distinct from `delivered` and retryable failure. Delivery reads current consent immediately before sending. Already sent/in-flight reports cannot be recalled, and an offline browser cannot immediately update the server.
- Payloads use raw `__oppref` and optional `__obref`, safe source paths without queries/fragments, and `opt_out: true`. No contact hashes, profile, quiz, hair or chat data are added. Verify automatic advanced matching is disabled in the provider settings before activation.
- An explicit integer `amount_minor` is authoritative. Fallback `value` supports two-decimal currencies only, matching the existing billing producers. Invalid values and events older than seven days are skipped, not rewritten.
- HTTP acceptance does not prove attribution or Ads Manager visibility. Production payloads use `validate_only: false`; automated tests intercept outbound requests.

## Activation steps

1. Review the finished provider disclosure/permission coverage and verify automatic advanced matching is disabled. The unchanged banner is not evidence that this review is complete.
2. Provision the server-only CAPI key securely and confirm the Pixel IDs and funnel signing/attribution configuration **before enabling either flag**. Missing/mismatched configuration produces terminal skips; fixing configuration does not replay those events.
3. After publication and production authorization, apply `20260915141251_openai_ads_consent_context.sql` then `20260915141328_openai_ads_billing_delivery.sql` through the established migration process. Deploy with both OpenAI flags off first.
4. Enable both flags in a new deployment. Verify a controlled, permitted trial and purchase against received events in Ads Manager; separately verify attribution. No live conversion has been sent by this local work.
5. Nick completes account payment recovery and business verification; these can still prevent ad delivery independently of measurement.

Rollback: disable both flags and rebuild/redeploy. Existing deliveries remain subject to current consent and timestamp limits; disabled attempts become terminal skipped. Do not blindly delete consent tables or replay historical conversions.

## Sources

Official [Measurement Pixel](https://developers.openai.com/ads/measurement-pixel), [Conversions API](https://developers.openai.com/ads/conversions-api), and [supported events](https://developers.openai.com/ads/supported-events), checked 2026-09-15. The installed OpenAI conversions skill is available in this task. Its static scanners supplement behavioral verification.

## Local verification

Node 22 checks cover payloads/transport, browser consent races, exact-session context, billing routing and Stripe/PayPal SQL producers. Real PostgreSQL tests verify multiconnection locks/privileges in a disposable schema; Chromium tests execute the actual browser helper with intercepted API/SDK responses. Neither proves production provider receipt.

Run the Chromium fixture explicitly with `OPENAI_ADS_BROWSER_TEST_ENABLED=true node --import ./tests/server-only-register.cjs --import tsx --test tests/openai-ads-browser-integration.test.ts` after installing Playwright Chromium. The generic Node suite skips this browser-dependent test.

The static setup scanner passes with configured-ID detection. Its literal-ID option intentionally finds no hardcoded ID in application source. The secret scanner flags one synthetic unit-test placeholder assignment; manual review confirms it is not a credential. No real CAPI key is included.

Optional events outside this chosen scope: checkout, lead, registration, subscription, content and custom events. Cart, appointment and native-app events have no selected flow here. User matching enrichment is omitted under the approved reference-only policy.
