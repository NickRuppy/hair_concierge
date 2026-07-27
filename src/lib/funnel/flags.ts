export function isFunnelAttributionEnabled() {
  return process.env.FUNNEL_ATTRIBUTION_ENABLED === "true"
}

export function isGuidedStoryOfferExperimentEnabled() {
  return process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED === "true"
}

export function isBillingFunnelDeliveryEnabled() {
  return process.env.BILLING_FUNNEL_DELIVERY_ENABLED === "true"
}

export function isFunnelMetaCustomDataEnabled() {
  return process.env.FUNNEL_META_CUSTOM_DATA_ENABLED === "true"
}

export function isFunnelMetaBrowserCustomDataEnabled() {
  return process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED === "true"
}

export function isOfferPaymentOverlayEnabled() {
  return process.env.NEXT_PUBLIC_OFFER_PAYMENT_OVERLAY_ENABLED === "true"
}

export function isStripeExpressCheckoutEnabled() {
  return process.env.NEXT_PUBLIC_STRIPE_EXPRESS_CHECKOUT_ENABLED === "true"
}
