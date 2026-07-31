import { getStripe } from "../../src/lib/stripe/client"
import {
  getPersonalPlanOnceStripePriceId,
  validatePersonalPlanOnceStripePrice,
} from "../../src/lib/billing/offer-products"

async function main() {
  const priceId = getPersonalPlanOnceStripePriceId()
  if (!priceId) throw new Error("STRIPE_PRICE_ID_PERSONAL_PLAN_ONCE is not configured")
  const secretKey = process.env.STRIPE_SECRET_KEY ?? ""
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured")
  const price = await getStripe().prices.retrieve(priceId, { expand: ["product"] })
  const issues = validatePersonalPlanOnceStripePrice(
    price as Parameters<typeof validatePersonalPlanOnceStripePrice>[0],
    priceId,
  )
  if (price.livemode !== secretKey.startsWith("sk_live_")) issues.push("livemode")
  if (issues.length)
    throw new Error(`Personal-plan one-time Stripe Price is invalid: ${issues.join(", ")}`)
  console.info(
    JSON.stringify(
      {
        active: price.active,
        amount: price.unit_amount,
        currency: price.currency,
        livemode: price.livemode,
        priceId: price.id,
        type: price.type,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
