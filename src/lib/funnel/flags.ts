export function isFunnelAttributionEnabled() {
  return process.env.FUNNEL_ATTRIBUTION_ENABLED === "true"
}

export function isGuidedStoryOfferExperimentEnabled() {
  return process.env.GUIDED_STORY_OFFER_EXPERIMENT_ENABLED === "true"
}

export function isPersonalPlanPricingExperimentEnabled() {
  return process.env.PERSONAL_PLAN_PRICING_EXPERIMENT_ENABLED === "true"
}

export function isPersonalPlanLaunchPricingEnabled() {
  return process.env.PERSONAL_PLAN_LAUNCH_PRICING_ENABLED === "true"
}

export function isPersonalPlanOneTimeQaEnabled() {
  return process.env.PERSONAL_PLAN_ONE_TIME_QA_ENABLED === "true"
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

export function isPersonalPlanQuizV1Enabled() {
  return process.env.PERSONAL_PLAN_QUIZ_V1_ENABLED === "true"
}

/** Server-backed, cross-browser recovery for the Meta personal-plan quiz. */
export function isPersonalPlanQuizCrossBrowserResumeEnabled() {
  return process.env.PERSONAL_PLAN_QUIZ_CROSS_BROWSER_RESUME_ENABLED === "true"
}
