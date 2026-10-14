import type Stripe from "stripe"

/** Server-owned request snapshot. Never expose this record in checkout API responses. */
export type StripeCheckoutContextV1 = {
  version: 1
  stripe_account_id: string
  livemode: boolean
  user_id: string
  account_email: string
  profile_customer_id: string | null
  initial_params: Stripe.Checkout.SessionCreateParams
  recovery_params?: Stripe.Checkout.SessionCreateParams
  expires_at: number
}

const PARAM_KEYS = new Set([
  "mode",
  "ui_mode",
  "line_items",
  "customer",
  "customer_email",
  "return_url",
  "success_url",
  "cancel_url",
  "redirect_on_completion",
  "expires_at",
  "automatic_tax",
  "subscription_data",
  "payment_method_types",
  "payment_method_collection",
  "discounts",
  "excluded_payment_method_types",
  "consent_collection",
  "custom_text",
  "metadata",
])
const CONTEXT_KEYS = new Set([
  "version",
  "stripe_account_id",
  "livemode",
  "user_id",
  "account_email",
  "profile_customer_id",
  "initial_params",
  "recovery_params",
  "expires_at",
])

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`
  return JSON.stringify(value)
}

const SESSION_ONLY_METADATA_KEYS = new Set([
  "lead_id",
  "funnel_session_id",
  "funnel_package_key",
  "checkout_context",
  "return_destination",
  "reactivation_reservation_id",
])

function hasTrialMetadata(value: unknown): boolean {
  return record(value) && Object.keys(value).some((key) => key.startsWith("trial_"))
}

function subscriptionMetadataMatchesSession(
  metadata: Record<string, unknown>,
  subscriptionMetadata: Record<string, unknown>,
): boolean {
  const comparableSessionMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !SESSION_ONLY_METADATA_KEYS.has(key)),
  )
  return canonicalJson(subscriptionMetadata) === canonicalJson(comparableSessionMetadata)
}

function isTrialCheckoutRequest(params: Record<string, unknown>): boolean {
  const metadata = params.metadata
  const subscriptionData = params.subscription_data
  const subscriptionMetadata = record(subscriptionData) ? subscriptionData.metadata : undefined
  const hasTrialFields =
    "payment_method_types" in params ||
    "payment_method_collection" in params ||
    "discounts" in params ||
    hasTrialMetadata(metadata) ||
    (record(subscriptionData) &&
      ("trial_period_days" in subscriptionData ||
        "trial_end" in subscriptionData ||
        "billing_mode" in subscriptionData)) ||
    hasTrialMetadata(subscriptionMetadata)
  if (!hasTrialFields) return true

  const discounts = params.discounts
  const trialOfferId = record(metadata) ? metadata.trial_offer_id : undefined
  return (
    Array.isArray(params.payment_method_types) &&
    params.payment_method_types.length === 1 &&
    params.payment_method_types[0] === "card" &&
    params.payment_method_collection === "always" &&
    !("excluded_payment_method_types" in params) &&
    (trialOfferId === "trial_v1:trial_launch_v1:month"
      ? discounts === undefined
      : trialOfferId === "trial_v1:trial_launch_v1:year" &&
        (discounts === undefined ||
          (Array.isArray(discounts) &&
            discounts.length === 1 &&
            record(discounts[0]) &&
            typeof discounts[0].coupon === "string" &&
            !!discounts[0].coupon &&
            Object.keys(discounts[0]).every((key) => key === "coupon")))) &&
    record(metadata) &&
    metadata.trial_cohort === "trial_v1" &&
    metadata.trial_offer_version === "trial_launch_v1" &&
    (trialOfferId === "trial_v1:trial_launch_v1:month" ||
      trialOfferId === "trial_v1:trial_launch_v1:year") &&
    record(subscriptionData) &&
    Object.keys(subscriptionData).every((key) =>
      ["trial_period_days", "billing_mode", "metadata"].includes(key),
    ) &&
    subscriptionData.trial_period_days === 7 &&
    record(subscriptionData.billing_mode) &&
    Object.keys(subscriptionData.billing_mode).length === 1 &&
    subscriptionData.billing_mode.type === "flexible" &&
    record(subscriptionMetadata) &&
    Object.values(subscriptionMetadata).every((entry) => typeof entry === "string") &&
    subscriptionMetadataMatchesSession(metadata, subscriptionMetadata)
  )
}

export function parseStripeCheckoutContext(value: unknown): StripeCheckoutContextV1 {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !CONTEXT_KEYS.has(key)) ||
    value.version !== 1 ||
    typeof value.stripe_account_id !== "string" ||
    !/^acct_\w+$/.test(value.stripe_account_id) ||
    typeof value.livemode !== "boolean" ||
    typeof value.user_id !== "string" ||
    !value.user_id ||
    typeof value.account_email !== "string" ||
    !/^[^\s@]+@[^\s@]+$/.test(value.account_email) ||
    !(
      value.profile_customer_id === null ||
      (typeof value.profile_customer_id === "string" && /^cus_\w+$/.test(value.profile_customer_id))
    ) ||
    !Number.isSafeInteger(value.expires_at) ||
    !record(value.initial_params)
  ) {
    throw new Error("reactivation checkout context invalid")
  }
  const params = value.initial_params
  const hasCustomer = typeof params.customer === "string" && /^cus_\w+$/.test(params.customer)
  if (
    Object.keys(params).some((key) => !PARAM_KEYS.has(key)) ||
    params.mode !== "subscription" ||
    params.expires_at !== value.expires_at ||
    (hasCustomer
      ? params.customer_email !== undefined || params.customer !== value.profile_customer_id
      : params.customer !== undefined || params.customer_email !== value.account_email) ||
    !Array.isArray(params.line_items) ||
    params.line_items.length !== 1 ||
    !record(params.line_items[0]) ||
    typeof params.line_items[0].price !== "string" ||
    !params.line_items[0].price ||
    params.line_items[0].quantity !== 1 ||
    !record(params.metadata) ||
    params.metadata.checkout_context !== "membership_reactivation" ||
    typeof params.metadata.reactivation_reservation_id !== "string" ||
    Object.values(params.metadata).some((entry) => typeof entry !== "string") ||
    !isTrialCheckoutRequest(params)
  ) {
    throw new Error("reactivation checkout initial request invalid")
  }
  if (value.recovery_params !== undefined) {
    const expected: Record<string, unknown> = { ...params, customer_email: value.account_email }
    delete expected.customer
    if (!hasCustomer || canonicalJson(value.recovery_params) !== canonicalJson(expected)) {
      throw new Error("reactivation checkout recovery request invalid")
    }
  }
  return value as StripeCheckoutContextV1
}

export function buildStripeCheckoutContext(input: {
  stripeAccountId: string
  livemode: boolean
  userId: string
  accountEmail: string
  profileCustomerId: string | null
  initialParams: Stripe.Checkout.SessionCreateParams
  reservationExpiresAt: string
  nowSeconds?: number
}): StripeCheckoutContextV1 {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const expiry = Math.floor(Date.parse(input.reservationExpiresAt) / 1000)
  if (!Number.isSafeInteger(expiry) || expiry - now < 30 * 60 || expiry - now > 24 * 60 * 60) {
    throw new Error("reactivation checkout creation window unavailable")
  }
  // JSON round-trip detaches the provider request from mutable caller objects and
  // matches exactly what PostgREST persists (including omission of undefined).
  return parseStripeCheckoutContext(
    JSON.parse(
      JSON.stringify({
        version: 1,
        stripe_account_id: input.stripeAccountId,
        livemode: input.livemode,
        user_id: input.userId,
        account_email: input.accountEmail,
        profile_customer_id: input.profileCustomerId,
        initial_params: { ...input.initialParams, expires_at: expiry },
        expires_at: expiry,
      }),
    ),
  )
}

export function canCreateStripeReactivationCheckout(
  context: StripeCheckoutContextV1,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  return (
    context.expires_at - nowSeconds >= 30 * 60 && context.expires_at - nowSeconds <= 24 * 60 * 60
  )
}

export function getStripeReactivationCheckoutRequest(
  reservationId: string,
  context: StripeCheckoutContextV1,
): {
  params: Stripe.Checkout.SessionCreateParams
  idempotencyKey: string
} {
  const validated = parseStripeCheckoutContext(context)
  if (validated.initial_params.metadata?.reactivation_reservation_id !== reservationId) {
    throw new Error("reactivation checkout reservation context mismatch")
  }
  return {
    params: JSON.parse(JSON.stringify(validated.recovery_params ?? validated.initial_params)),
    idempotencyKey: `membership-reactivation:${reservationId}:v2:${validated.recovery_params ? "missing-customer" : "initial"}`,
  }
}
