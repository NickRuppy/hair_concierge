# Payment Production Cutover Operator Runbook

> **For agentic workers:** This is a human-operator runbook, not a fully automatable subagent plan. Agents may help with code edits, local verification, bundle checks, and log review, but provider dashboards, live secrets, Vercel Production env changes, and real payments must be performed or explicitly approved by the human operator. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Chaarlie production payments from Stripe test mode and PayPal sandbox to live Stripe plus native live PayPal subscriptions.

**Architecture:** Keep the current native provider split: Stripe remains responsible for card/SEPA embedded checkout, and PayPal remains a separate subscription integration through the PayPal JS SDK and PayPal REST APIs. Cut over in two production stages: first Stripe live with PayPal disabled, then PayPal live after Stripe checkout, webhooks, and entitlement activation are proven.

**Tech Stack:** Next.js App Router, Vercel Production env vars/deployments, Stripe Checkout/Billing/Webhooks, PayPal Subscriptions/JS SDK/Webhooks, Supabase billing tables, Customer.io lifecycle sync.

---

## References

- Stripe API keys: https://docs.stripe.com/keys
- Stripe go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Stripe webhooks: https://docs.stripe.com/webhooks
- PayPal production: https://developer.paypal.com/reference/production/
- PayPal subscriptions: https://developer.paypal.com/docs/subscriptions/integrate/
- PayPal subscription webhooks: https://developer.paypal.com/docs/subscriptions/reference/webhooks/
- PayPal webhook management/signature verification: https://developer.paypal.com/docs/api/webhooks/v1/

## Current Production State

- Production deployment is code-aligned with `origin/main` and this worktree branch: `codex/payments-production-cutover`.
- Production currently exposes a Stripe `pk_test_...` publishable key, so Stripe is still in test mode.
- Production currently loads a PayPal client ID whose SDK resolves to sandbox, so PayPal is still sandbox.
- Vercel Production already has the expected env var names for both providers, but the values need to be live values.
- PayPal endpoints and webhooks already exist in code:
  - `/api/paypal/create-subscription-intent`
  - `/api/paypal/approve-subscription`
  - `/api/paypal/webhook`
- Stripe endpoints and webhooks already exist in code:
  - `/api/stripe/create-checkout-session`
  - `/api/stripe/webhook`
  - `/api/stripe/portal-session`
- Legal/payment copy needs review before launch:
  - `src/app/agb/page.tsx` currently names Stripe as the payment processor.
  - `src/app/datenschutz/page.tsx` lists Stripe but not PayPal.
  - `src/app/widerruf/page.tsx` and the Stripe Checkout consent text should be reviewed together with the advertised money-back promise.

## File Map

- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/lib/paypal/client.ts`
  - Confirms `PAYPAL_ENVIRONMENT=live` switches server calls to `https://api-m.paypal.com`.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/lib/paypal/plans.ts`
  - Defines required live PayPal plan env vars and expected plan shapes.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/scripts/paypal/create-resources.ts`
  - Creates PayPal product, plans, and webhook for sandbox or live based on env.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/scripts/paypal/validate-plans.ts`
  - Retrieves configured PayPal plans and validates amount, currency, interval, and status.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/api/stripe/create-checkout-session/route.ts`
  - Uses Stripe price IDs, `STRIPE_DISCOUNT_COUPON_ID`, automatic tax, and embedded subscription checkout.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/api/stripe/webhook/route.ts`
  - Verifies raw Stripe webhook signatures and handles the events used by the app.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/api/paypal/webhook/route.ts`
  - Verifies PayPal webhook signatures using `PAYPAL_WEBHOOK_ID`.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/agb/page.tsx`
  - Needs processor wording updated for Stripe and PayPal before production PayPal is enabled.
- `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/datenschutz/page.tsx`
  - Needs PayPal privacy processor entry before production PayPal is enabled.

## Cutover Rules

- Do not paste live secrets into chat, git, or issue comments.
- Keep Vercel Preview and Development on Stripe test mode and PayPal sandbox unless there is a deliberate live-preview test window.
- Update Vercel Production env vars only after the live provider objects exist and have been validated.
- Redeploy after changing any `NEXT_PUBLIC_*` variable because those values are baked into the client bundle.
- Do not run live payment tests without confirming the exact plan, payer account, and refund/cancel path.
- Use real low-value transactions only; Stripe test cards and PayPal sandbox accounts do not prove live readiness.
- Stripe has no clean feature flag in the current implementation. Stripe rollback requires restoring previous Production env values and redeploying, so PayPal must stay disabled until Stripe live is verified.

---

### Task 1: Preflight and Local Verification

**Files:**
- Read: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/package.json`
- Read: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/lib/paypal/plans.ts`
- Read: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/api/stripe/webhook/route.ts`

- [x] **Step 1: Confirm worktree and branch**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
git status --short --branch
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```

Expected:

```text
## codex/payments-production-cutover...origin/main
codex/payments-production-cutover
075385c7d17983be8962ee5da8580ff07646507e
```

- [x] **Step 2: Run repo verification before changing provider state**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
npm run typecheck
npm run lint
npm run test:node
```

Expected:

```text
All commands complete with exit code 0.
```

- [x] **Step 3: Run payment-adjacent browser contract tests**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
npm run test:playwright:contracts
```

Expected:

```text
Playwright reports all listed contract specs passing.
This gives Stripe coverage through the existing contract specs; it is not a substitute for PayPal live validation.
```

- [x] **Step 4: Confirm PayPal expected live plan shapes**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
sed -n '1,120p' src/lib/paypal/plans.ts
```

Expected configured plan shapes:

```text
month:   7.49 EUR, MONTH x 1
quarter: 17.49 EUR, MONTH x 3
year:    49.99 EUR, YEAR x 1
```

---

### Task 2: Stripe Live Resource Setup

**Files:**
- Read: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/lib/stripe/pricing-plans.ts`
- Read: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/api/stripe/create-checkout-session/route.ts`
- External: Stripe Dashboard live mode

- [x] **Step 1: Switch Stripe Dashboard to live mode**

Open the Stripe Dashboard and confirm the account is in live mode before creating or copying any objects.

Expected:

```text
All copied IDs use live prefixes where applicable: pk_live_, sk_live_ or rk_live_, price_..., whsec_...
No test-mode objects are copied.
```

- [x] **Step 2: Create or verify live subscription prices**

Create or verify three recurring live Prices for the same product:

```text
Monthly anchor price:   14.99 EUR, recurring with interval=month, interval_count=1
Quarterly anchor price: 34.99 EUR, recurring with interval=month, interval_count=3
Annual anchor price:    99.99 EUR, recurring with interval=year, interval_count=1
```

Expected env mapping:

```text
STRIPE_PRICE_ID_MONTHLY=<live monthly price_...>
STRIPE_PRICE_ID_QUARTERLY=<live quarterly price_...>
STRIPE_PRICE_ID_ANNUAL=<live annual price_...>
```

- [x] **Step 3: Create or verify the live discount coupon**

The public pricing UI hard-codes anchor prices with discounted prices and describes the discounted price as the actual charged price. Keep the live coupon setup unless the UI/legal copy is intentionally changed before launch. Create a live Stripe coupon that makes Checkout charge exactly:

```text
Monthly charged price:   7.49 EUR
Quarterly charged price: 17.49 EUR
Annual charged price:    49.99 EUR
```

Expected:

```text
STRIPE_DISCOUNT_COUPON_ID=<live coupon id>
STRIPE_PRICE_ID_* values point to the live anchor prices from Step 2.
Live checkout totals exactly match 7.49 EUR, 17.49 EUR, and 49.99 EUR.
```

If one coupon cannot produce the exact advertised values for all three Prices because of rounding, stop the cutover. Either patch the pricing UI to remove the anchor/discount framing and use final-price Stripe Prices, or create a provider setup that keeps the advertised discount legally and numerically true.

Verification note: verify the first invoice preview without `preview_mode: "recurring"` when validating a once-duration coupon. A recurring preview can correctly show the undiscounted renewal price even when the first checkout invoice is discounted.

- [x] **Step 4: Confirm live automatic tax and payment methods**

In Stripe live mode, confirm:

```text
Automatic Tax is configured for live payments.
Card payments are enabled.
SEPA Direct Debit is enabled if it should remain available in the UI.
Customer Portal is configured for live subscriptions.
Branding and receipt email settings are production-ready.
```

Expected:

```text
No live checkout should fail because tax, payment method, portal, or branding configuration is incomplete.
```

- [x] **Step 5: Create the live Stripe webhook endpoint**

Create a live Stripe webhook endpoint:

```text
Endpoint URL: https://chaarlie.de/api/stripe/webhook
Events:
  checkout.session.completed
  customer.subscription.updated
  customer.subscription.deleted
  invoice.payment_failed
```

Expected:

```text
STRIPE_WEBHOOK_SECRET=whsec_<live endpoint signing secret>
```

---

### Task 3: PayPal Live Resource Setup

**Files:**
- Use: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/scripts/paypal/create-resources.ts`
- Use: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/scripts/paypal/validate-plans.ts`
- External: PayPal Developer Dashboard live mode

- [x] **Step 1: Create or select a live PayPal REST app**

In the PayPal Developer Dashboard, switch to **Live**, create/select the Chaarlie REST app, and copy:

```text
PAYPAL_CLIENT_ID=<live PayPal REST app client ID>
PAYPAL_CLIENT_SECRET=<live PayPal REST app secret>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<same live PayPal REST app client ID>
PAYPAL_ENVIRONMENT=live
```

Expected:

```text
The client ID is from Live, not Sandbox.
The backend PAYPAL_CLIENT_ID and frontend NEXT_PUBLIC_PAYPAL_CLIENT_ID refer to the same live app.
```

- [x] **Step 2: Dry-run the PayPal live resource payloads**

Run with live credentials loaded in the shell, without printing secrets:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
export PAYPAL_ENVIRONMENT=live
export PAYPAL_WEBHOOK_URL=https://chaarlie.de/api/paypal/webhook
npm run paypal:create-resources -- --dry-run
```

Expected dry-run plan:

```text
Product: Chaarlie Premium, SERVICE
Monthly plan:   7.49 EUR, MONTH x 1
Quarterly plan: 17.49 EUR, MONTH x 3
Annual plan:    49.99 EUR, YEAR x 1
Webhook URL: https://chaarlie.de/api/paypal/webhook
Webhook events:
  BILLING.SUBSCRIPTION.ACTIVATED
  BILLING.SUBSCRIPTION.CREATED
  BILLING.SUBSCRIPTION.UPDATED
  BILLING.SUBSCRIPTION.CANCELLED
  BILLING.SUBSCRIPTION.SUSPENDED
  BILLING.SUBSCRIPTION.EXPIRED
  BILLING.SUBSCRIPTION.PAYMENT.FAILED
  PAYMENT.SALE.COMPLETED
  PAYMENT.SALE.REFUNDED
  PAYMENT.SALE.REVERSED
```

- [x] **Step 3: Create live PayPal product, plans, and webhook**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
export PAYPAL_ENVIRONMENT=live
export PAYPAL_WEBHOOK_URL=https://chaarlie.de/api/paypal/webhook
npm run paypal:create-resources
```

Expected output:

```text
PAYPAL_PRODUCT_ID=PROD-...
PAYPAL_PLAN_ID_MONTHLY=P-...
PAYPAL_PLAN_ID_QUARTERLY=P-...
PAYPAL_PLAN_ID_ANNUAL=P-...
PAYPAL_WEBHOOK_ID=...
```

Store those IDs in the secure deployment/env workflow, not in chat or git.

- [x] **Step 4: Validate live PayPal plan shapes**

Run with the newly created live IDs loaded in the shell:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
export PAYPAL_ENVIRONMENT=live
npm run paypal:validate-plans
```

Expected:

```text
PayPal month plan ok (PAYPAL_PLAN_ID_MONTHLY=P-...)
PayPal quarter plan ok (PAYPAL_PLAN_ID_QUARTERLY=P-...)
PayPal year plan ok (PAYPAL_PLAN_ID_ANNUAL=P-...)
```

If validation fails, do not update Vercel Production env vars. Create new live plans with the correct shape; PayPal plan pricing/interval mistakes should not be fixed by code at cutover time.

---

### Task 4: Legal and Public Copy Gate

**Files:**
- Modify if approved: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/agb/page.tsx`
- Modify if approved: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/datenschutz/page.tsx`
- Review: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/widerruf/page.tsx`
- Review: `/Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover/src/app/api/stripe/create-checkout-session/route.ts`

- [x] **Step 1: Review payment processor wording**

Check:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
rg -n "Stripe|PayPal|Zahlung|Widerruf|Geld-zurück|Datenschutz" src/app/agb src/app/datenschutz src/app/widerruf src/app/api/stripe/create-checkout-session/route.ts
```

Expected:

```text
AGB and Datenschutz mention both Stripe and PayPal where payment processors are listed.
Withdrawal and money-back wording is intentionally consistent with checkout consent.
```

- [x] **Step 2: Apply approved German copy updates**

If the business/legal owner approves the processor wording, update:

```text
src/app/agb/page.tsx:
  "Die Zahlung erfolgt ... über Stripe oder PayPal."

src/app/datenschutz/page.tsx:
  Add PayPal as a payment processor with purpose "Zahlungsabwicklung für Abonnements."
```

Expected:

```text
The public legal pages no longer imply Stripe is the only payment processor.
```

- [x] **Step 3: Verify legal page build**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
npm run ci:verify
```

Expected:

```text
The command completes with exit code 0.
```

---

### Task 5: Vercel Production Env Cutover

**Files:**
- External: Vercel project Production environment variables

- [ ] **Step 1: Confirm current env names exist**

Run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
vercel env ls
```

Expected names in Production:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_PRICE_ID_MONTHLY
STRIPE_PRICE_ID_QUARTERLY
STRIPE_PRICE_ID_ANNUAL
STRIPE_DISCOUNT_COUPON_ID
STRIPE_WEBHOOK_SECRET
PAYPAL_ENVIRONMENT
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
NEXT_PUBLIC_PAYPAL_CLIENT_ID
NEXT_PUBLIC_PAYPAL_ENABLED
PAYPAL_PRODUCT_ID
PAYPAL_PLAN_ID_MONTHLY
PAYPAL_PLAN_ID_QUARTERLY
PAYPAL_PLAN_ID_ANNUAL
PAYPAL_WEBHOOK_ID
```

- [ ] **Step 2: Save rollback material outside chat**

Before replacing Production env values, store the current Production payment env values in the team's secure password manager or deployment runbook:

```text
Stripe current values:
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_PRICE_ID_MONTHLY
  STRIPE_PRICE_ID_QUARTERLY
  STRIPE_PRICE_ID_ANNUAL
  STRIPE_DISCOUNT_COUPON_ID
  STRIPE_WEBHOOK_SECRET

PayPal current values:
  PAYPAL_ENVIRONMENT
  PAYPAL_CLIENT_ID
  PAYPAL_CLIENT_SECRET
  NEXT_PUBLIC_PAYPAL_CLIENT_ID
  NEXT_PUBLIC_PAYPAL_ENABLED
  PAYPAL_PRODUCT_ID
  PAYPAL_PLAN_ID_MONTHLY
  PAYPAL_PLAN_ID_QUARTERLY
  PAYPAL_PLAN_ID_ANNUAL
  PAYPAL_WEBHOOK_ID
```

Expected:

```text
Rollback does not depend on Vercel revealing old secret values later.
```

- [ ] **Step 3: Stage 1 - replace Stripe Production env values and keep PayPal disabled**

Set Vercel Production:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_... or rk_live_...
STRIPE_PRICE_ID_MONTHLY=<live monthly price>
STRIPE_PRICE_ID_QUARTERLY=<live quarterly price>
STRIPE_PRICE_ID_ANNUAL=<live annual price>
STRIPE_DISCOUNT_COUPON_ID=<live coupon id>
STRIPE_WEBHOOK_SECRET=whsec_<live webhook endpoint secret>
NEXT_PUBLIC_PAYPAL_ENABLED=false
```

Expected:

```text
No Stripe Production env value starts with pk_test_, sk_test_, rk_test_, uses a test webhook secret, or points at a test coupon.
PayPal remains hidden while Stripe live is verified.
```

- [ ] **Step 4: Stage 2 - replace PayPal Production env values only after Stripe live is verified**

Set Vercel Production:

```text
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=<live PayPal client ID>
PAYPAL_CLIENT_SECRET=<live PayPal client secret>
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<live PayPal client ID>
NEXT_PUBLIC_PAYPAL_ENABLED=true
PAYPAL_PRODUCT_ID=PROD-...
PAYPAL_PLAN_ID_MONTHLY=P-...
PAYPAL_PLAN_ID_QUARTERLY=P-...
PAYPAL_PLAN_ID_ANNUAL=P-...
PAYPAL_WEBHOOK_ID=<live webhook ID>
```

Expected:

```text
No PayPal Production env value is copied from the sandbox app, sandbox product, sandbox plans, or sandbox webhook.
```

- [ ] **Step 5: Keep Preview/Development isolated**

Confirm Preview and Development still use test/sandbox values:

```text
Stripe Preview/Development: pk_test_, sk_test_ or rk_test_, test price IDs, test webhook secret
PayPal Preview/Development: PAYPAL_ENVIRONMENT=sandbox, sandbox client, sandbox plans, sandbox webhook
```

Expected:

```text
Preview deployments cannot accidentally create real subscriptions.
```

---

### Task 6: Deploy Production in Two Stages

**Files:**
- External: Vercel Production deployment
- Modify if legal copy changed: files from Task 4

- [ ] **Step 1: If legal copy changed, merge/deploy that code first**

If Task 4 changed repository files, stage and commit the legal copy changes:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
git status --short
git add src/app/agb/page.tsx src/app/datenschutz/page.tsx src/app/widerruf/page.tsx src/app/api/stripe/create-checkout-session/route.ts
git commit -m "docs: update payment processor legal copy"
```

Expected:

```text
Commit succeeds, or there are no file changes to commit because legal approved the existing text.
```

- [ ] **Step 2: Redeploy Stage 1 after Stripe env changes**

Use the Vercel Dashboard to redeploy the latest production deployment, or run:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
vercel --prod
```

Expected:

```text
The new deployment reaches Ready state and receives the https://chaarlie.de production alias.
Production has live Stripe env values and NEXT_PUBLIC_PAYPAL_ENABLED=false.
```

- [ ] **Step 3: Confirm live envs are in the client bundle**

Run:

```bash
node <<'NODE'
const origin = "https://chaarlie.de"
const html = await (await fetch(`${origin}/pricing`)).text()
const chunkUrls = [...html.matchAll(/(?:src|href)="([^"]+\.js[^"]*)"/g)]
  .map((match) => new URL(match[1], origin).href)
const chunks = await Promise.all(
  [...new Set(chunkUrls)].map(async (url) => {
    const response = await fetch(url)
    return response.ok ? response.text() : ""
  }),
)
const text = [html, ...chunks].join("\n")
console.log({
  hasStripeTestKey: text.includes("pk_test_"),
  hasStripeLiveKey: text.includes("pk_live_"),
  hasPayPalSandboxUrl: text.includes("sandbox.paypal.com"),
  hasPayPalSdk: text.includes("paypal.com/sdk/js"),
})
NODE
```

Expected:

```text
{
  hasStripeTestKey: false,
  hasStripeLiveKey: true,
  hasPayPalSandboxUrl: false,
  hasPayPalSdk: false
}
```

- [ ] **Step 4: Redeploy Stage 2 after PayPal env changes**

After Stripe live checkout and webhook activation pass in Task 7, update PayPal Production env values and redeploy again:

```bash
cd /Users/nick/AI_work/hair_conscierge/.worktrees/payments-production-cutover
vercel --prod
```

Expected:

```text
The new deployment reaches Ready state and receives the https://chaarlie.de production alias.
Production has live Stripe values and live PayPal values with NEXT_PUBLIC_PAYPAL_ENABLED=true.
```

- [ ] **Step 5: Confirm PayPal SDK resolves live**

Using the live `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, run:

```bash
curl -s "https://www.paypal.com/sdk/js?client-id=${NEXT_PUBLIC_PAYPAL_CLIENT_ID}&components=buttons&currency=EUR&intent=subscription&vault=true" | rg "sandbox|api-m\\.sandbox|paypal\\.com"
```

Expected:

```text
No sandbox endpoint is present.
Live paypal.com references are present.
```

---

### Task 7: Live Smoke Tests

**Files:**
- External: Chaarlie production site, Stripe Dashboard live mode, PayPal Dashboard live mode, Supabase production project, Customer.io workspace

- [ ] **Step 1: Smoke-test Stripe monthly checkout with SCA/3DS**

Use a real payment method on production:

```text
Open https://chaarlie.de/pricing
Select the monthly plan.
Choose "Karte / SEPA".
Complete live Stripe Checkout with a payment method/account that exercises a 3DS/SCA challenge when possible.
Return to /welcome?session_id=...
Set password or complete the welcome flow.
```

Expected:

```text
Stripe Checkout succeeds.
User reaches the Chaarlie welcome/account activation flow.
Supabase profile has premium entitlement.
billing_subscriptions has provider='stripe' and entitlement_status='active' or 'past_due' according to Stripe status.
Stripe Dashboard shows the live subscription and customer.
Stripe Checkout total matches the advertised discounted price.
```

- [ ] **Step 2: Confirm Stripe webhook idempotency and Customer.io propagation**

From the Stripe Dashboard live webhook delivery view, resend the successful `checkout.session.completed` event for the smoke-test subscription once.

Expected:

```text
The resent event returns 2xx.
Supabase still has one Stripe billing_subscriptions row for the provider subscription.
The user's entitlement remains correct and is not duplicated.
Customer.io receives or already contains the expected live checkout/subscription lifecycle event for the smoke-test user.
```

- [ ] **Step 3: Enable PayPal only after Stripe live is proven**

Proceed to Task 5 Step 4 and Task 6 Step 4 only after Stripe checkout, Stripe webhook activation, idempotency, and Customer.io checks pass.

Expected:

```text
PayPal is not exposed to production customers until Stripe live has passed its smoke test.
```

- [ ] **Step 4: Smoke-test PayPal monthly checkout**

Use a real PayPal payer account that is not the merchant account:

```text
Open https://chaarlie.de/pricing
Select the monthly plan.
Choose PayPal.
Approve the live PayPal subscription.
Return to /welcome?provider=paypal&token=...
Set password or complete the welcome flow.
```

Expected:

```text
PayPal approval succeeds in paypal.com, not sandbox.paypal.com.
User reaches the Chaarlie welcome/account activation flow.
Supabase profile has premium entitlement.
paypal_checkout_intents row is approved or activated.
billing_subscriptions has provider='paypal' and entitlement_status='active' after activation/webhook processing.
PayPal Dashboard shows the live subscription.
```

- [ ] **Step 5: Confirm webhooks are being delivered**

Check provider dashboards:

```text
Stripe live webhook endpoint https://chaarlie.de/api/stripe/webhook:
  checkout.session.completed delivered with 2xx.
  customer.subscription.updated delivered with 2xx if emitted.

PayPal live webhook endpoint https://chaarlie.de/api/paypal/webhook:
  BILLING.SUBSCRIPTION.CREATED delivered with 2xx if emitted.
  BILLING.SUBSCRIPTION.ACTIVATED or PAYMENT.SALE.COMPLETED delivered with 2xx if emitted.
```

Expected:

```text
No signature verification failures.
No 500 handler errors.
No repeated retries after successful processing.
```

- [ ] **Step 6: Confirm PayPal webhook idempotency and Customer.io impact**

From the PayPal live webhook event/delivery view, resend one successful subscription activation or payment event if PayPal exposes resend for that event. If resend is unavailable, use the production logs and `billing_webhook_events` row for the smoke-test event to confirm idempotent claim behavior.

Expected:

```text
The repeated PayPal event does not create a duplicate billing_subscriptions row.
The user's entitlement remains correct and is not duplicated.
Customer.io does not receive duplicate customer-facing lifecycle messages for the smoke-test user.
```

- [ ] **Step 7: Cancel/refund smoke-test subscriptions**

After confirming activation:

```text
Cancel the live PayPal test subscription from the app or PayPal Dashboard.
Cancel/refund the live Stripe test subscription from Stripe Dashboard.
Confirm access state is acceptable after cancellation according to current product policy.
```

Expected:

```text
No paid test subscription remains unintentionally active.
Provider dashboards and Supabase billing state agree.
```

---

### Task 8: Monitoring and Rollback

**Files:**
- External: Vercel logs, Stripe Dashboard, PayPal Dashboard, Supabase production

- [ ] **Step 1: Monitor production logs for 60 minutes after cutover**

Watch for:

```text
[stripe] handler error
[stripe:webhook] handled
[paypal:webhook] handled
PayPal webhook verification failed
PayPal request failed
Stripe signature verification failed
checkout_access_already_exists spikes
```

Expected:

```text
Only successful webhook handling appears during smoke tests.
Any 4xx/5xx is explainable and not repeated by real customers.
```

- [ ] **Step 2: Monitor provider dashboards**

Check:

```text
Stripe:
  Live payments, subscriptions, failed payments, webhook retries, disputes.

PayPal:
  Live subscriptions, webhook event deliveries, failed payments, duplicate cancellations.
```

Expected:

```text
No unexpected payment method failures, webhook retry storms, or duplicate active subscriptions.
```

- [ ] **Step 3: Roll back PayPal if PayPal fails**

Set Vercel Production:

```text
NEXT_PUBLIC_PAYPAL_ENABLED=false
```

Redeploy production.

Expected:

```text
PayPal button disappears from pricing and quiz offer checkout.
Stripe remains available.
Existing PayPal webhook handling remains in place for subscriptions already created.
```

- [ ] **Step 4: Roll back Stripe if Stripe fails**

Set Vercel Production Stripe env vars back to the secure rollback values captured in Task 5, then redeploy:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<previous production value>
STRIPE_SECRET_KEY=<previous production value>
STRIPE_PRICE_ID_MONTHLY=<previous production value>
STRIPE_PRICE_ID_QUARTERLY=<previous production value>
STRIPE_PRICE_ID_ANNUAL=<previous production value>
STRIPE_DISCOUNT_COUPON_ID=<previous production value, if previously set>
STRIPE_WEBHOOK_SECRET=<previous production value>
```

Expected:

```text
Production stops sending customers through the broken live Stripe configuration.
Any live subscriptions already created are cancelled/refunded manually in Stripe as needed.
```

---

## Final Acceptance Criteria

- Production client bundle contains `pk_live_...` and no `pk_test_...`.
- Production PayPal JS SDK uses live PayPal, not sandbox.
- Stripe live checkout creates a real subscription and activates access.
- PayPal live checkout creates a real subscription and activates access.
- Stripe live webhook endpoint receives and verifies expected events.
- PayPal live webhook endpoint receives and verifies expected events.
- Stripe live is verified before PayPal is enabled in production.
- Replayed webhook events do not duplicate entitlements or subscription rows.
- Customer.io receives the expected live lifecycle events without duplicate customer-facing sends.
- Legal pages do not claim Stripe is the only payment processor once PayPal is enabled.
- Preview and Development remain on test/sandbox payment systems.
- Rollback values and tested rollback steps exist outside chat.
