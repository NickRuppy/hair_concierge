import "server-only"

import type Stripe from "stripe"
import { parseTrialOfferSnapshot, type TrialOfferSnapshot } from "../billing/trial-offer"

export type StripeTrialCatalogClient = Pick<Stripe, "accounts" | "coupons" | "prices">

export type StripeTrialCatalogAttestation = Readonly<{
  accountId: string
  priceId: string
  couponId: string | null
  offerVersion: "trial_launch_v1"
  interval: "month" | "year"
}>

function mismatch(): never {
  throw new Error("Stripe trial catalog mismatch")
}

function hasActiveProduct(value: unknown): value is { id: string; active: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id?: unknown }).id === "string" &&
    (value as { id: string }).id.length > 0 &&
    "active" in value &&
    typeof (value as { active?: unknown }).active === "boolean"
  )
}

function expectedPriceProductId(input: {
  offer: Readonly<TrialOfferSnapshot>
  price: Stripe.Price
  expectedLivemode: boolean
}): string | null {
  const { offer, price, expectedLivemode } = input
  const recurring = price.recurring
  if (
    price.id !== offer.stripePriceId ||
    price.active !== true ||
    price.livemode !== expectedLivemode ||
    price.currency.toUpperCase() !== offer.currency ||
    price.unit_amount !== offer.renewalAmountMinor ||
    price.tax_behavior !== offer.taxBehavior ||
    price.type !== "recurring" ||
    price.billing_scheme !== "per_unit" ||
    price.tiers_mode !== null ||
    price.custom_unit_amount !== null ||
    price.transform_quantity !== null ||
    recurring === null ||
    recurring.interval !== offer.interval ||
    recurring.interval_count !== 1 ||
    recurring.usage_type !== "licensed" ||
    !hasActiveProduct(price.product) ||
    price.product.active !== true
  ) {
    return null
  }
  return price.product.id
}

function hasExpectedCoupon(input: {
  coupon: Stripe.Coupon
  expectedCouponId: string
  expectedLivemode: boolean
  productId: string
}) {
  const { coupon, expectedCouponId, expectedLivemode, productId } = input
  const products = coupon.applies_to?.products
  return (
    coupon.id === expectedCouponId &&
    coupon.livemode === expectedLivemode &&
    coupon.valid === true &&
    coupon.currency?.toUpperCase() === "EUR" &&
    coupon.amount_off === 3000 &&
    coupon.percent_off === null &&
    coupon.duration === "once" &&
    Array.isArray(products) &&
    products.length === 1 &&
    products[0] === productId
  )
}

/**
 * Attests present sellability before creating a new trial checkout. It deliberately
 * does not validate old accepted agreements, whose callback proof stays in
 * `trial-authorization.ts` and must survive later catalog changes.
 */
export async function attestStripeTrialCatalog(input: {
  stripe: StripeTrialCatalogClient
  offer: unknown
  expectedAccountId: string
  expectedLivemode: boolean
}): Promise<StripeTrialCatalogAttestation> {
  const offer = parseTrialOfferSnapshot(input.offer)
  if (!offer || !input.expectedAccountId) mismatch()

  const [account, price] = await Promise.all([
    input.stripe.accounts.retrieve(null),
    input.stripe.prices.retrieve(offer.stripePriceId, { expand: ["product"] }),
  ])
  if (account.id !== input.expectedAccountId) mismatch()
  const productId = expectedPriceProductId({
    offer,
    price,
    expectedLivemode: input.expectedLivemode,
  })
  if (productId === null) mismatch()

  if (offer.stripeCouponId === null) {
    return Object.freeze({
      accountId: account.id,
      priceId: price.id,
      couponId: null,
      offerVersion: offer.offerVersion,
      interval: offer.interval,
    })
  }

  const coupon = await input.stripe.coupons.retrieve(offer.stripeCouponId, {
    expand: ["applies_to"],
  })
  if (
    !hasExpectedCoupon({
      coupon,
      expectedCouponId: offer.stripeCouponId,
      expectedLivemode: input.expectedLivemode,
      productId,
    })
  ) {
    mismatch()
  }

  return Object.freeze({
    accountId: account.id,
    priceId: price.id,
    couponId: coupon.id,
    offerVersion: offer.offerVersion,
    interval: offer.interval,
  })
}
