# Personal-plan launch pricing: provider setup

This runbook is for the six dormant recurring launch resources only. It neither creates Products nor updates, deactivates, or replaces any existing standard provider resource.

## Release gates and manual operator actions

1. Confirm the launch offer flag is dark (`false`) in the target environment. Do not alter Vercel or environment state from these scripts.
2. Take and retain a provider snapshot: existing Product IDs, current Price/Plan IDs, active subscribers, and the current flag value.
3. Run the dry-runs (they perform no provider calls):

   ```bash
   npm run stripe:personal-plan-launch:dry-run
   npm run paypal:personal-plan-launch:dry-run
   ```

4. Obtain separate explicit authorization to create live resources. Creation is not authorized by this runbook or by a dry run.
5. Manually identify the existing, intended Product ID in each provider. Create nothing if ownership is uncertain.
6. Stripe only after authorization: run the create command with that existing Product ID. The tool lists active recurring Prices first, reuses exactly one matching tagged launch Price, and fails on a tagged conflict. It never creates a Product.

   ```bash
   STRIPE_SECRET_KEY=... npm run stripe:personal-plan-launch:create -- --product-id prod_...
   ```

7. PayPal only after authorization: first create a local, access-controlled manifest containing exactly `{"productId":"PROD-...","plans":{}}`. Then run the create command. The manifest is the resume record; it must match the Product ID. Stable, provider-safe `PayPal-Request-Id` values make a retry safe after an interrupted response, and every recorded Plan is retrieved and revalidated before reuse. Do not delete or edit the manifest during the release.

   ```bash
   PAYPAL_ENVIRONMENT=live PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
     npm run paypal:personal-plan-launch:create -- --product-id PROD-... --manifest /secure/path/personal-plan-launch-plans.json
   ```

8. Configure the six secret environment values manually from the commands’ output:

   ```text
   STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_MONTHLY
   STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY
   STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_ANNUAL
   PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_MONTHLY
   PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_QUARTERLY
   PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_ANNUAL
   ```

   Also supply the existing Product IDs as `STRIPE_PERSONAL_PLAN_LAUNCH_PRODUCT_ID` and `PAYPAL_PERSONAL_PLAN_LAUNCH_PRODUCT_ID` to the validators. These are operator-only inputs, not runtime configuration.

9. Validate read-only provider state. The validators require the existing Product ID and assert product ownership, EUR amount, cadence, active state, Stripe inclusive tax behavior, PayPal infinite regular cycles, zero setup fee, no plan tax, and recognition by the runtime interval-and-catalog resolver.

   ```bash
   STRIPE_SECRET_KEY=... STRIPE_PERSONAL_PLAN_LAUNCH_PRODUCT_ID=prod_... \
     npm run stripe:personal-plan-launch:validate

   PAYPAL_ENVIRONMENT=live PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
     PAYPAL_PERSONAL_PLAN_LAUNCH_PRODUCT_ID=PROD-... \
     npm run paypal:personal-plan-launch:validate
   ```

10. After dark deployment, inspect the catalog-aware PostHog experiment insight with its default dry run. Applying it is a separate external write and requires the exact project confirmation. Its distinct title creates or attaches the new catalog-segmented insight without mutating the historical arm-only insight.

    ```bash
    POSTHOG_PERSONAL_API_KEY=... npm run posthog:personal-plan-pricing-experiment-insight
    POSTHOG_PERSONAL_API_KEY=... npm run posthog:personal-plan-pricing-experiment-insight -- \
      --apply --confirm-project=126788
    ```

11. Complete a dark smoke with the flag still `false`; keep the six launch IDs configured and rerun both validators from the same checkout that will be deployed.
12. Obtain legal/compliance sign-off for the recurring offer and pricing before exposure.
13. Obtain separate explicit authorization to activate the flag. Set it true manually only after the previous gates pass.
14. Roll back exposure by setting the flag false. Do not deactivate/delete these Prices or Plans while launch subscribers remain; retain their IDs and resources for subscription lifecycle support.

If standard Stripe Prices are ever rotated, retain the old IDs in the matching comma-separated `STRIPE_LEGACY_PRICE_IDS_MONTHLY`, `STRIPE_LEGACY_PRICE_IDS_QUARTERLY`, or `STRIPE_LEGACY_PRICE_IDS_ANNUAL` variable so existing subscribers can still change interval within the standard catalog.

## Exact resource shape

| Provider     | Monthly  | Every 3 months | Yearly    |
| ------------ | -------- | -------------- | --------- |
| Stripe Price | EUR 9.99 | EUR 19.99      | EUR 69.99 |
| PayPal Plan  | EUR 9.99 | EUR 19.99      | EUR 69.99 |

Stripe Prices are active recurring Prices with `tax_behavior=inclusive`. PayPal Plans are active, have one infinite `REGULAR` cycle, a zero EUR setup fee, and omit plan tax.
