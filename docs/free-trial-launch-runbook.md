# Free-trial launch runbook

Status: implementation reviewed and verified; additive schema and historical eligibility import applied. **Application deployment and public activation pending.** See the [verification record](../plans/free-trial-launch/release-verification.md); the production receipt records the actual commit and deployment after execution.

## Authority and contract

Nick explicitly authorized the full Stripe and PayPal production release and public enrollment on 14 September. This includes scoped catalog/environment changes and the additive schema. No separate app, sandbox, isolated transaction experiment or repeated deployment approval is required. Nick personally completes payer authorization. The [canonical plan](../plans/free-trial-launch/plan.md) and its original journey acknowledgement remain controlling.

Both intervals have seven days from verified authorization. Monthly costs EUR 9.99; annual costs EUR 69.99 for the first paid year, then EUR 99.99. These are final inclusive customer totals. Nick owns the tax-treatment follow-up with his co-founder; it is not an engineering publication blocker. Never invent a tax registration or tax rate.

Preserve existing subscriptions and historic one-time fulfillment. Only new one-time checkout and waitlist signup are retired. Refinement locks and detailed year-two annual termination/refund automation remain explicitly deferred; deliver the latter before the earliest affected renewal.

## Release sequence

1. Finish verified review findings and refresh affected checks. Keep the full Opus 5/high review plus bounded fix review outside source; retain a sanitized disposition and canonical content fingerprint.
2. Verify current production schema and provider identity. Apply only the reviewed additive trial migrations, in order, before new callers. Preserve legacy rows and exact migration history.
3. Configure the service-only identity key-version registry (`keys --versions=1 --apply`) before the first claim writer. Use the necessity/retention and executable rights procedure in [operations](trial-notices-and-claims-operations.md).
4. Backfill provider-verified prior paid history with canonical ownership, current verified Auth email and actual payment-method proof. Exclude explicit internal test records using the repository predicate. Preserve unresolved ownership/refund cases as review; never invent owners or infer them from an email match.
5. Set the scoped production environment from the ignored owner-supplied credentials and prepared secrets. Enable public enrollment only with the complete reviewed deployment. Keep existing unrelated environment values.
6. Publish the reviewed commit and deploy to the existing production project. Verify the production alias, public offer, both provider entry paths, protected callbacks and required-notice worker configuration. A successful page render is not proof of authorization or future collection.
7. Nick completes any real payer step in the provider screen. Record observed authorization/entitlement/cancellation evidence separately from catalog and synthetic evidence. Do not create a charge or refund on his behalf.

## Provider catalog and environment

Stripe live merchant: `acct_1TH0lOGiGHTGZcKB`.

- Monthly: `price_1TzMhZGiGHTGZcKBhtcZkGSk`, EUR 9.99/month, inclusive.
- Annual: `price_1TNw7QGiGHTGZcKBv8jPk1MJ`, EUR 99.99/year, inclusive.
- Annual first-year coupon: `8KSV9CZz`, EUR 30 once, no expiry. Existing legacy prices remain unchanged.

PayPal uses the existing app `APP-2VJ86968MU803542T` and product `PROD-1DJ37758SY227805K`:

- Monthly: `P-4Y805027TR818725DNKT773Q`.
- First annual year then full renewal: `P-926549353Y177680VNKT773Y`.
- Full-price annual continuation: `P-66386833F45479158NKUAJKI`.

All three deferred-start schedules were created and retrieved ACTIVE in the existing app. See [catalog receipt](../plans/free-trial-launch/paypal-live-deferred-catalog-2026-09-14.md). The abandoned free-week catalog drafts and legacy repeating EUR 69.99 plan are unchanged.

Required server settings: `TRIAL_IDENTITY_PROCESSING_APPROVED`, `TRIAL_ENROLLMENT_MODE`, `TRIAL_STRIPE_ACCOUNT_ID`, `TRIAL_STRIPE_LIVEMODE`, `TRIAL_STRIPE_PRICE_MONTHLY`, `TRIAL_STRIPE_PRICE_ANNUAL`, `TRIAL_STRIPE_ANNUAL_COUPON`, `TRIAL_IDENTITY_HMAC_KEYS`, `TRIAL_CANCELLATION_SIGNING_SECRET`, `TRIAL_PAYPAL_APP_ID`, `TRIAL_PAYPAL_PRODUCT_ID`, `TRIAL_PAYPAL_PLAN_MONTHLY`, `TRIAL_PAYPAL_PLAN_ANNUAL`, `TRIAL_PAYPAL_RENEWAL_PLAN_ANNUAL`. Existing PayPal client/secret/environment and public client ID must match the same live app. Never commit or print secret values.

An explicit empty annual coupon means no discount for new contracts; a missing value is invalid. Accepted enrollment snapshots retain their price progression. `TRIAL_QA_EMAILS` applies only to restricted mode; the release is authorized as public.

## Required communications and operations

Only required notices are enabled. The implementation reuses the verified existing Customer.io sender `Chaarlie <info@chaarlie.de>` and an inline transactional trigger. No optional trial reminder campaign or new onboarding email is introduced. Queue acknowledgement is recorded as queued, never delivered.

The minute workers handle trial notices and public declaration receipts. Five-minute workers handle cancellation, pending PayPal approval expiry, Stripe continuation and paid recovery. All worker routes require the configured server bearer secret. Public cancellation/withdrawal routes record a durable receipt before provider work; unmatched declarations require trusted matching through the service-only resolution CLI. No unauthenticated submission directly mutates an account.

Operator commands (Node 22, explicitly loaded service environment):

- `scripts/billing/trial-identity-rights.ts`: inspect/restrict/release/correct/erase source-linked claims; key registry and rights changes require `--apply`.
- `scripts/billing/trial-history-backfill.ts`: verified prior-paid history, dry-run by default.
- `scripts/billing/trial-payment-reconciliation.ts --list`: unresolved payment/continuation work, read-only.
- `scripts/billing/public-contract-declarations.ts --list`: receipt matching and trusted resolution; follow its guarded operation arguments.

The required-notice dispatcher currently claims one message per invocation (one-minute cron plus event dispatches). Admission/rights transactions share a short database advisory lock. Both are known launch-volume capacity limits, not unbounded background processing.

## Evidence limits and rollback

Local tests and provider catalog reads do not prove real approval or future collection. Still requires observation after deployment: PayPal post-approval start-time adjustment, Stripe coupon redemption against the first nonzero invoice, provider continuation period shape, real required-notice delivery and owner authorization. Nick expressly chose production verification in the existing integration; do not revive the canceled isolated experiment.

Historical credentials exposure was already flagged to Nick. Never reproduce the value; keep credential maintenance scoped to the existing app and secret configuration.

Rollback disables **new enrollment only** with `TRIAL_ENROLLMENT_MODE=disabled` and a deployment. Retain runtime/provider settings, HMAC versions and signing material for accepted contracts, webhooks, cancellation, receipts and recovery. Do not shorten existing trials or rewrite their accepted prices. Do not roll back additive schema or delete claim/history records.
