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
    Object.values(params.metadata).some((entry) => typeof entry !== "string")
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
