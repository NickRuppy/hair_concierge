import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  bindMembershipReactivationProviderReference,
  prepareMembershipReactivationStripeCheckout,
  recoverMembershipReactivationStripeCheckout,
  type MembershipReactivationCheckoutReservation,
} from "./checkout-reservations"
import {
  buildStripeCheckoutContext,
  canCreateStripeReactivationCheckout,
  getStripeReactivationCheckoutRequest,
  parseStripeCheckoutContext,
} from "./stripe-checkout-context"

export function isMissingStripeCustomer(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: unknown; param?: unknown; type?: unknown }
  return (
    candidate.code === "resource_missing" &&
    candidate.param === "customer" &&
    candidate.type === "StripeInvalidRequestError"
  )
}

/** Configured price IDs are account-scoped: retrieving the exact trusted price
 * verifies that the credentials point at its account, before replacing any customer.
 * Key/public-key/price mode must agree; production is never allowed to use test mode.
 */
export async function verifyStripeReactivationProvider(stripe: Stripe, priceId: string) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim() ?? ""
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? ""
  const keyMode = /^(?:sk|rk)_live_/.test(secret)
    ? true
    : /^(?:sk|rk)_test_/.test(secret)
      ? false
      : null
  const publicMode = publishable.startsWith("pk_live_")
    ? true
    : publishable.startsWith("pk_test_")
      ? false
      : null
  if (
    keyMode === null ||
    keyMode !== publicMode ||
    (process.env.VERCEL_ENV === "production" && !keyMode)
  ) {
    throw new Error("reactivation Stripe configuration mismatch")
  }
  const [account, price] = await Promise.all([
    stripe.accounts.retrieve(null),
    stripe.prices.retrieve(priceId),
  ])
  if (
    !account.id.startsWith("acct_") ||
    price.id !== priceId ||
    price.livemode !== keyMode ||
    price.type !== "recurring"
  ) {
    throw new Error("reactivation Stripe provider identity mismatch")
  }
  return { stripeAccountId: account.id, livemode: keyMode }
}

export async function preflightStripeReactivationCustomer(
  stripe: Stripe,
  customerId: string | undefined,
  livemode: boolean,
): Promise<string | undefined> {
  if (!customerId) return undefined
  try {
    const customer = await stripe.customers.retrieve(customerId)
    if (customer.id !== customerId) throw new Error("reactivation Stripe customer mismatch")
    if (customer.deleted) return undefined
    if (customer.livemode !== livemode)
      throw new Error("reactivation Stripe customer mode mismatch")
    return customerId
  } catch (error) {
    if (isMissingStripeCustomer(error)) return undefined
    throw error
  }
}

export async function createDurableStripeReactivationCheckout(input: {
  stripe: Stripe
  client: Pick<SupabaseClient, "from" | "rpc">
  reservation: MembershipReactivationCheckoutReservation
  userId: string
  accountEmail: string
  profileCustomerId: string | null
  stripeAccountId: string
  livemode: boolean
  params: Stripe.Checkout.SessionCreateParams
}): Promise<Stripe.Checkout.Session> {
  const { stripe, client, userId } = input
  const candidate = input.reservation.stripe_checkout_context
    ? parseStripeCheckoutContext(input.reservation.stripe_checkout_context)
    : buildStripeCheckoutContext({
        ...input,
        initialParams: input.params,
        reservationExpiresAt: input.reservation.expires_at,
      })
  if (
    candidate.stripe_account_id !== input.stripeAccountId ||
    candidate.livemode !== input.livemode ||
    candidate.user_id !== userId
  ) {
    throw new Error("reactivation Stripe frozen provider mismatch")
  }
  const prepareCandidate = { ...candidate }
  delete prepareCandidate.recovery_params
  let reservation = await prepareMembershipReactivationStripeCheckout(client, {
    reservationId: input.reservation.id,
    userId,
    context: prepareCandidate,
  })
  let context = parseStripeCheckoutContext(reservation.stripe_checkout_context)
  if (reservation.provider_reference)
    return stripe.checkout.sessions.retrieve(reservation.provider_reference)
  if (!canCreateStripeReactivationCheckout(context))
    throw new Error("reactivation Stripe reconciliation required")
  let request = getStripeReactivationCheckoutRequest(reservation.id, context)
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(request.params, {
      idempotencyKey: request.idempotencyKey,
    })
  } catch (error) {
    const originalCustomerId = context.initial_params.customer
    if (
      context.recovery_params ||
      typeof originalCustomerId !== "string" ||
      !isMissingStripeCustomer(error)
    )
      throw error
    // Only a definitive rejection of this frozen customer permits a second key.
    reservation = await recoverMembershipReactivationStripeCheckout(client, {
      reservationId: reservation.id,
      userId,
      stripeAccountId: input.stripeAccountId,
      livemode: input.livemode,
      originalCustomerId,
    })
    context = parseStripeCheckoutContext(reservation.stripe_checkout_context)
    if (reservation.provider_reference)
      return stripe.checkout.sessions.retrieve(reservation.provider_reference)
    if (!canCreateStripeReactivationCheckout(context))
      throw new Error("reactivation Stripe reconciliation required")
    request = getStripeReactivationCheckoutRequest(reservation.id, context)
    session = await stripe.checkout.sessions.create(request.params, {
      idempotencyKey: request.idempotencyKey,
    })
    console.info("[stripe] reactivation customer recovery", { outcome: "session_created" })
  }
  await bindMembershipReactivationProviderReference(client, reservation.id, session.id)
  return session
}
