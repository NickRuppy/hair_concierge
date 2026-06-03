# Stripe SEPA Renewal Migration

## Current Policy

New Stripe Checkout Sessions exclude SEPA Debit in code with `excluded_payment_method_types: ["sepa_debit"]`. This prevents new purchases from choosing SEPA while leaving Stripe Dashboard payment method settings unchanged for now.

Existing active SEPA subscriptions are grandfathered temporarily. They should continue through normal renewal behavior while we audit the affected subscription set and decide whether each subscription should be migrated, grandfathered, or canceled after a deadline.

Do not globally disable SEPA in the Stripe Dashboard until the audit confirms that existing SEPA subscriptions have either been migrated to a non-SEPA payment method or are intentionally grandfathered.

Renewal failures for existing SEPA subscriptions should use the normal failed-payment path. No special access behavior is needed solely because the renewal payment method is SEPA.

## Audit Fields

For each potentially affected Stripe subscription, collect:

- Stripe customer ID
- Stripe subscription ID
- Customer email
- Subscription status
- Current period end
- Whether `subscription.default_payment_method` is SEPA Debit
- Whether `customer.invoice_settings.default_payment_method` is SEPA Debit

The audit must distinguish subscription-level payment methods from customer-level invoice defaults because Stripe payment method priority can cause a SEPA subscription default to keep taking precedence even after the customer invoice default is updated.

## Migration Choice

If `subscription.default_payment_method` is SEPA Debit, prefer a subscription-specific payment update link or a setup-mode card flow that updates `subscription.default_payment_method`. Updating only `customer.invoice_settings.default_payment_method` may not change the payment method used for that subscription.

If only `customer.invoice_settings.default_payment_method` is SEPA Debit, and the subscription does not have a SEPA `subscription.default_payment_method`, a generic Customer Portal `payment_method_update` flow may be sufficient.

For a small number of affected users, use Stripe Dashboard links or manual Dashboard-assisted migration. For larger numbers, build or use a setup-mode card collection flow that explicitly attaches the new card and updates the correct Stripe default based on the audit result.

## Recommended Rollout

Keep existing renewals active while auditing. Do not contact every user preemptively; contact affected users only when the audit shows that migration is needed or when a renewal failure requires normal failed-payment recovery.

Recommended sequence:

1. Audit active and relevant past-due subscriptions for SEPA defaults.
2. Classify each subscription by whether SEPA is set at `subscription.default_payment_method`, `customer.invoice_settings.default_payment_method`, or both.
3. Choose the migration path based on Stripe payment method priority.
4. Contact affected users only when a payment method update is needed.
5. Use Dashboard links for small affected groups, or a setup-mode card flow for larger groups.
6. Set an operational deadline for deciding whether remaining SEPA subscriptions are grandfathered, canceled, or required to migrate.
7. Re-audit before changing global Stripe Dashboard payment method settings.

## Do Not Do Yet

Do not globally disable SEPA in the Stripe Dashboard until the audit confirms that existing SEPA subscriptions are migrated or intentionally grandfathered.

Do not assume a generic customer-level payment method update fixes subscriptions that have `subscription.default_payment_method` set to SEPA Debit.

Do not add special renewal failure handling for SEPA-only failures unless a separate product decision requires it. Existing SEPA renewal failures should continue through the normal failed-payment path.
