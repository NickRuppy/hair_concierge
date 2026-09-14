import "server-only"

import type Stripe from "stripe"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"

export type StripeTrialAuthorizationInput = {
  session: Stripe.Checkout.Session
  subscription: Stripe.Subscription
  paymentMethod: Stripe.PaymentMethod
  pendingSetupIntent: Stripe.SetupIntent | null
  subscriptionDiscount: Stripe.Discount | null
  coupon: Stripe.Coupon | null
  expected: {
    enrollmentId: string
    offer: TrialOfferSnapshot
  }
  now: Date
  expectedLivemode: boolean
}

export type VerifiedStripeTrialAuthorization = {
  enrollmentId: string
  providerAgreementId: string
  authorizationSucceededAt: string
  trialEndAt: string
  customerId: string
  paymentMethodId: string
  cardFingerprint: string
  unverifiedFutureInvoiceObligations: readonly [
    "verify_first_paid_invoice_amount",
    "verify_renewal_invoice_amount",
  ]
}

export type StripeTrialAuthorizationClient = Pick<
  Stripe,
  "coupons" | "paymentMethods" | "setupIntents" | "subscriptions"
> & {
  checkout: Pick<Stripe["checkout"], "sessions">
}

const TRIAL_SECONDS = 7 * 24 * 60 * 60

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function expandableId(value: unknown): string | null {
  if (nonEmptyString(value)) return value
  if (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    nonEmptyString((value as { id?: unknown }).id)
  ) {
    return (value as { id: string }).id
  }
  return null
}

function hasTrialMetadata(metadata: Stripe.Metadata | null, enrollmentId: string): boolean {
  return metadata?.trial_cohort === "trial_v1" && metadata.trial_enrollment_id === enrollmentId
}

function hasExpectedSubscriptionDiscount(
  subscription: Stripe.Subscription,
  price: Stripe.Price,
  item: Stripe.SubscriptionItem,
  discount: Stripe.Discount | null,
  coupon: Stripe.Coupon | null,
  customerId: string,
  expectedCouponId: string | null,
  expectedLivemode: boolean,
): boolean {
  if (!Array.isArray(subscription.discounts) || !Array.isArray(item.discounts)) return false
  if (expectedCouponId === null) {
    return (
      subscription.discounts.length === 0 &&
      item.discounts.length === 0 &&
      discount === null &&
      coupon === null
    )
  }
  const priceProductId = expandableId(price.product)
  const appliesTo = coupon?.applies_to
  if (
    subscription.discounts.length !== 1 ||
    item.discounts.length !== 0 ||
    discount === null ||
    coupon === null ||
    coupon.id !== expectedCouponId ||
    coupon.livemode !== expectedLivemode ||
    coupon.duration !== "once" ||
    coupon.amount_off !== 3000 ||
    coupon.currency?.toUpperCase() !== "EUR" ||
    coupon.percent_off !== null ||
    !isRecord(appliesTo) ||
    !Array.isArray(appliesTo.products) ||
    appliesTo.products.length !== 1 ||
    !nonEmptyString(appliesTo.products[0]) ||
    appliesTo.products[0] !== priceProductId ||
    !subscription.discounts.some((candidate) => expandableId(candidate) === discount.id) ||
    !isRecord(discount.source) ||
    expandableId(discount.source.coupon) !== coupon.id ||
    expandableId(discount.customer) !== customerId ||
    discount.subscription !== subscription.id ||
    discount.subscription_item !== null
  ) {
    return false
  }
  return true
}

export function verifyStripeTrialAuthorization(
  input: StripeTrialAuthorizationInput,
): VerifiedStripeTrialAuthorization | null {
  const offer = parseTrialOfferSnapshot(input.expected.offer)
  const nowAt = input.now.getTime()
  if (!offer || !nonEmptyString(input.expected.enrollmentId) || !Number.isFinite(nowAt)) return null

  const { session, subscription, paymentMethod, pendingSetupIntent, subscriptionDiscount, coupon } =
    input
  const customerId = expandableId(subscription.customer)
  const sessionCustomerId = expandableId(session.customer)
  const sessionSubscriptionId = expandableId(session.subscription)
  const defaultPaymentMethodId = expandableId(subscription.default_payment_method)
  if (
    session.mode !== "subscription" ||
    session.status !== "complete" ||
    // Stripe can settle the zero-value trial invoice as `paid`. That status
    // does not prove a paid period: require zero total and the trial proof below.
    (session.payment_status !== "no_payment_required" && session.payment_status !== "paid") ||
    session.amount_total !== 0 ||
    session.livemode !== input.expectedLivemode ||
    subscription.livemode !== input.expectedLivemode ||
    paymentMethod.livemode !== input.expectedLivemode ||
    subscription.status !== "trialing" ||
    !nonEmptyString(subscription.id) ||
    sessionSubscriptionId !== subscription.id ||
    customerId === null ||
    sessionCustomerId !== customerId ||
    !hasTrialMetadata(session.metadata, input.expected.enrollmentId) ||
    !hasTrialMetadata(subscription.metadata, input.expected.enrollmentId) ||
    subscription.billing_mode?.type !== "flexible" ||
    defaultPaymentMethodId === null ||
    paymentMethod.id !== defaultPaymentMethodId ||
    expandableId(paymentMethod.customer) !== customerId ||
    paymentMethod.type !== "card" ||
    !nonEmptyString(paymentMethod.card?.fingerprint)
  ) {
    return null
  }

  const items = Array.isArray(subscription.items?.data) ? subscription.items.data : null
  const item = items?.length === 1 ? items[0] : null
  const price = item?.price
  const recurring = price?.recurring
  if (
    item === null ||
    item === undefined ||
    price === null ||
    price === undefined ||
    typeof price.currency !== "string" ||
    item.quantity !== 1 ||
    price.id !== offer.stripePriceId ||
    price.currency.toUpperCase() !== offer.currency ||
    price.unit_amount !== offer.renewalAmountMinor ||
    price.tax_behavior !== offer.taxBehavior ||
    recurring?.interval !== offer.interval ||
    recurring.interval_count !== 1
  ) {
    return null
  }

  // Applied objects prove accepted terms. `active` and `valid` describe whether
  // Stripe will sell them prospectively, so they cannot invalidate a retry.
  if (
    !hasExpectedSubscriptionDiscount(
      subscription,
      price,
      item,
      subscriptionDiscount,
      coupon,
      customerId,
      offer.stripeCouponId,
      input.expectedLivemode,
    )
  ) {
    return null
  }

  const trialStart = subscription.trial_start
  const trialEnd = subscription.trial_end
  if (
    typeof trialStart !== "number" ||
    typeof trialEnd !== "number" ||
    !Number.isSafeInteger(trialStart) ||
    !Number.isSafeInteger(trialEnd) ||
    trialEnd - trialStart !== TRIAL_SECONDS ||
    nowAt < trialStart * 1000 ||
    nowAt >= trialEnd * 1000
  ) {
    return null
  }

  const pendingSetupIntentId = expandableId(subscription.pending_setup_intent)
  if (subscription.pending_setup_intent !== null && pendingSetupIntentId === null) return null
  if (pendingSetupIntentId === null) {
    if (pendingSetupIntent !== null) return null
  } else if (
    pendingSetupIntent === null ||
    pendingSetupIntent.id !== pendingSetupIntentId ||
    pendingSetupIntent.livemode !== input.expectedLivemode ||
    pendingSetupIntent.status !== "succeeded" ||
    expandableId(pendingSetupIntent.customer) !== customerId ||
    expandableId(pendingSetupIntent.payment_method) !== paymentMethod.id
  ) {
    return null
  }

  return {
    enrollmentId: input.expected.enrollmentId,
    providerAgreementId: subscription.id,
    authorizationSucceededAt: new Date(trialStart * 1000).toISOString(),
    trialEndAt: new Date(trialEnd * 1000).toISOString(),
    customerId,
    paymentMethodId: paymentMethod.id,
    cardFingerprint: paymentMethod.card.fingerprint,
    unverifiedFutureInvoiceObligations: [
      "verify_first_paid_invoice_amount",
      "verify_renewal_invoice_amount",
    ],
  }
}

export async function retrieveVerifiedStripeTrialAuthorization(
  stripe: StripeTrialAuthorizationClient,
  sessionId: string,
  expected: StripeTrialAuthorizationInput["expected"],
  now: Date,
  expectedLivemode: boolean,
): Promise<VerifiedStripeTrialAuthorization | null> {
  return (
    (
      await retrieveStripeTrialAuthorizationEvidence(
        stripe,
        sessionId,
        expected,
        now,
        expectedLivemode,
      )
    )?.authorization ?? null
  )
}

/** Keep the exact retrieved identity objects with the proof for account activation. */
export async function retrieveStripeTrialAuthorizationEvidence(
  stripe: StripeTrialAuthorizationClient,
  sessionId: string,
  expected: StripeTrialAuthorizationInput["expected"],
  now: Date,
  expectedLivemode: boolean,
): Promise<{
  authorization: VerifiedStripeTrialAuthorization
  session: Stripe.Checkout.Session
  subscription: Stripe.Subscription
} | null> {
  if (!nonEmptyString(sessionId)) return null

  // A provider read failure must propagate for retry/reconciliation; it is not
  // evidence that authorization was denied or that this customer used a trial.
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const subscriptionId = expandableId(session.subscription)
  if (subscriptionId === null) return null

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["default_payment_method", "pending_setup_intent", "discounts", "items.data.price"],
  })
  const paymentMethodId = expandableId(subscription.default_payment_method)
  if (paymentMethodId === null) return null
  const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

  const pendingSetupIntentId = expandableId(subscription.pending_setup_intent)
  if (subscription.pending_setup_intent !== null && pendingSetupIntentId === null) return null
  const pendingSetupIntent =
    pendingSetupIntentId === null ? null : await stripe.setupIntents.retrieve(pendingSetupIntentId)

  let subscriptionDiscount: Stripe.Discount | null = null
  let coupon: Stripe.Coupon | null = null
  if (expected.offer.stripeCouponId !== null) {
    if (!Array.isArray(subscription.discounts) || subscription.discounts.length !== 1) return null
    const candidate = subscription.discounts[0]
    if (!isRecord(candidate)) return null
    subscriptionDiscount = candidate as Stripe.Discount
    const couponId = isRecord(subscriptionDiscount.source)
      ? expandableId(subscriptionDiscount.source.coupon)
      : null
    if (couponId === null) return null
    coupon = await stripe.coupons.retrieve(couponId, { expand: ["applies_to"] })
  }

  const authorization = verifyStripeTrialAuthorization({
    session,
    subscription,
    paymentMethod,
    pendingSetupIntent,
    subscriptionDiscount,
    coupon,
    expected,
    now,
    expectedLivemode,
  })
  return authorization ? { authorization, session, subscription } : null
}
