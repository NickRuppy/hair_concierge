# Membership launch pricing: provider setup

This runbook is for the six dormant recurring launch resources identified by the technical catalog version `personal_plan_launch_v1`. The catalog version does not limit eligibility to the Personal Plan quiz: while the flag is active, it applies to every new recurring membership purchase surface. It neither creates Products nor updates, deactivates, or replaces any existing standard provider resource.

The six live launch Prices/Plans already exist under the current Products and their IDs are configured in Vercel Production. Do not rerun the create commands or create replacement resources for this rollout. The creation tooling remains available only for audited recovery work under separate explicit authorization.

## Release gates and manual operator actions

1. Confirm the launch offer flag is dark (`false`) in the target environment. Do not alter Vercel or environment state from these scripts.
2. Take and retain a provider snapshot: existing Product IDs, current Price/Plan IDs, active subscribers, and the current flag value.
3. Run the dry-runs (they perform no provider calls):

   ```bash
   npm run stripe:personal-plan-launch:dry-run
   npm run paypal:personal-plan-launch:dry-run
   ```

4. Confirm the six configured launch IDs resolve to the intended existing Product in each provider. Create nothing if ownership is uncertain or any configured ID is missing.
5. Do not run either create command during the rollout. If separately authorized recovery work is ever required, the Stripe tool lists active recurring Prices first, reuses exactly one matching tagged launch Price, and fails on a tagged conflict. It never creates a Product.

   ```bash
   STRIPE_SECRET_KEY=... npm run stripe:personal-plan-launch:create -- --product-id prod_...
   ```

6. For separately authorized PayPal recovery only, first create a local, access-controlled manifest containing exactly `{"productId":"PROD-...","plans":{}}`. The manifest is the resume record; it must match the Product ID. Stable, provider-safe `PayPal-Request-Id` values make a retry safe after an interrupted response, and every recorded Plan is retrieved and revalidated before reuse. Do not delete or edit the manifest during recovery.

   ```bash
   PAYPAL_ENVIRONMENT=live PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
     npm run paypal:personal-plan-launch:create -- --product-id PROD-... --manifest /secure/path/personal-plan-launch-plans.json
   ```

7. Confirm the six secret environment values remain configured:

   ```text
   STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_MONTHLY
   STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY
   STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_ANNUAL
   PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY
   PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY
   PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_ANNUAL
   ```

   Also supply the existing Product IDs as `STRIPE_PERSONAL_PLAN_LAUNCH_PRODUCT_ID` and `PAYPAL_PERSONAL_PLAN_LAUNCH_PRODUCT_ID` to the validators. These are operator-only inputs, not runtime configuration.

8. Validate read-only provider state. The validators require the existing Product ID and assert product ownership, EUR amount, cadence, active state, Stripe inclusive tax behavior, PayPal infinite regular cycles, zero setup fee, no plan tax, and recognition by the runtime interval-and-catalog resolver.

   ```bash
   STRIPE_SECRET_KEY=... STRIPE_PERSONAL_PLAN_LAUNCH_PRODUCT_ID=prod_... \
     npm run stripe:personal-plan-launch:validate

   PAYPAL_ENVIRONMENT=live PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
     PAYPAL_PERSONAL_PLAN_LAUNCH_PRODUCT_ID=PROD-... \
     npm run paypal:personal-plan-launch:validate
   ```

9. After dark deployment, inspect the catalog-aware PostHog experiment insight with its default dry run. Applying it is a separate external write and requires the exact project confirmation. Its distinct title creates or attaches the new catalog-segmented insight without mutating the historical arm-only insight.

   ```bash
   POSTHOG_PERSONAL_API_KEY=... npm run posthog:personal-plan-pricing-experiment-insight
   POSTHOG_PERSONAL_API_KEY=... npm run posthog:personal-plan-pricing-experiment-insight -- \
     --apply --confirm-project=126788
   ```

10. Choose and record a cutoff immediately before the first possible launch-price activation, then run the billing-subscription catalog inventory in read-only mode. Rows created before that explicit cutoff can be classified as pre-activation standard subscribers even when historic Stripe metadata lacks a Price ID. At or after the cutoff, any row whose provider resource cannot prove a known catalog remains a reconciliation item; do not assign it to the standard catalog by default.

    ```bash
    NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      npm run billing:launch-catalog:inventory -- \
      --preactivation-standard-before=2026-08-01T00:00:00.000Z
    ```

    Replace the example timestamp with the recorded operational cutoff. Applying the reviewed inventory is a separate production database write and requires explicit authorization, the same cutoff, `--apply`, and the dedicated gate. The apply command also refuses to run while `PERSONAL_PLAN_LAUNCH_PRICING_ENABLED=true`.

    ```bash
    BILLING_PRICING_CATALOG_BACKFILL_PRODUCTION_WRITE=1 \
      NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
      npm run billing:launch-catalog:apply -- \
      --confirm-project=pqdkhefxsxkyeqelqegq \
      --preactivation-standard-before=2026-08-01T00:00:00.000Z
    ```

    This repair changes only local billing metadata. It never changes a provider subscription, Price/Plan, interval, status, or amount. Each update also checks the row's inventoried `updated_at` value and refuses a stale write if a webhook or reconciliation changed the subscription after the inventory was read.

11. Complete a dark smoke with the flag still `false`; keep the six launch IDs configured and rerun both validators from the same checkout that will be deployed.
12. Verify the complete surface matrix with the flag off and on in a controlled environment:
    - Personal Plan recurring membership result;
    - legacy/default, guided-story, and app-value-stack results through their shared pricing slot;
    - expired/canceled customer reactivation;
    - active standard and launch subscribers' same-family profile plan management;
    - the separate €29.99 Personal Plan one-time arm, which must remain unchanged.
13. Obtain legal/compliance sign-off for the recurring offer and pricing before exposure.
14. Obtain separate explicit authorization to activate the flag. Set it true manually only after the previous gates pass.
15. Roll back new acquisition exposure by setting the flag false. Do not migrate existing subscribers, and do not deactivate or delete either catalog's Prices or Plans while any subscriber or in-flight checkout still references them. Retain their IDs and resources for subscription lifecycle support and rollback.

If standard Stripe Prices are ever rotated, retain the old IDs in the matching comma-separated `STRIPE_LEGACY_PRICE_IDS_MONTHLY`, `STRIPE_LEGACY_PRICE_IDS_QUARTERLY`, or `STRIPE_LEGACY_PRICE_IDS_ANNUAL` variable so existing subscribers can still change interval within the standard catalog.

Apply the same retention rule to rotated PayPal Plans with `PAYPAL_LEGACY_PLAN_IDS_MONTHLY`, `PAYPAL_LEGACY_PLAN_IDS_QUARTERLY`, and `PAYPAL_LEGACY_PLAN_IDS_ANNUAL`. The inventory and same-family plan-change guards require every provider resource still referenced by a subscriber to remain configured. If a Vercel environment pull redacts protected values, run the inventory from a trusted operator environment that has the real current and legacy IDs; do not interpret redacted empty strings as a valid catalog inventory.

## Exact resource shape

| Provider     | Monthly  | Every 3 months | Yearly    |
| ------------ | -------- | -------------- | --------- |
| Stripe Price | EUR 9.99 | EUR 19.99      | EUR 69.99 |
| PayPal Plan  | EUR 9.99 | EUR 19.99      | EUR 69.99 |

Stripe Prices are active recurring Prices with `tax_behavior=inclusive`. PayPal Plans are active, have one infinite `REGULAR` cycle, a zero EUR setup fee, and omit plan tax.
