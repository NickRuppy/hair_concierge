import type Stripe from "stripe"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"
import { buildStripeCheckoutSessionParams } from "./checkout-session-params"

export type BuildTrialStripeCheckoutSessionParamsInput = Omit<
  Parameters<typeof buildStripeCheckoutSessionParams>[0],
  "checkoutKind" | "priceId"
> & {
  offer: TrialOfferSnapshot
}

export function buildTrialStripeCheckoutSessionParams(
  input: BuildTrialStripeCheckoutSessionParamsInput,
): Stripe.Checkout.SessionCreateParams {
  if (Object.hasOwn(input, "priceId") || Object.hasOwn(input, "checkoutKind")) {
    throw new Error("trial checkout price and kind are server-controlled")
  }
  const offer = parseTrialOfferSnapshot(input.offer)
  if (!offer) throw new Error("a valid trial offer snapshot is required")

  const callerMetadata = input.metadata
  const trialMetadata = {
    ...callerMetadata,
    trial_cohort: offer.cohort,
    trial_offer_version: offer.offerVersion,
    trial_offer_id: `${offer.cohort}:${offer.offerVersion}:${offer.interval}`,
  }
  const legacyParams = buildStripeCheckoutSessionParams({
    ...input,
    checkoutKind: "subscription",
    priceId: offer.stripePriceId,
    metadata: trialMetadata,
  })

  const params: Stripe.Checkout.SessionCreateParams = {
    ...legacyParams,
    // The Stripe lane collects cards (including card wallets); PayPal uses its
    // own recurring-authorization flow with its own identity verification.
    payment_method_types: ["card"],
    payment_method_collection: "always",
    ...(offer.stripeCouponId ? { discounts: [{ coupon: offer.stripeCouponId }] } : {}),
    subscription_data: {
      ...legacyParams.subscription_data,
      trial_period_days: offer.trialDays,
      billing_mode: { type: "flexible" },
      metadata: trialMetadata,
    },
  }
  delete params.excluded_payment_method_types
  return params
}
