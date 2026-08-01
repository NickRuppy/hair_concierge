import Stripe from "stripe"
import {
  STRIPE_LAUNCH_PRICE_SPECS,
  stripeLaunchEnvKey,
  validateStripeLaunchPrice,
} from "./personal-plan-launch-prices"
import { resolveStripePriceId } from "../../src/lib/stripe/client"

async function main() {
  const productId = process.env.STRIPE_PERSONAL_PLAN_LAUNCH_PRODUCT_ID?.trim()
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!productId) throw new Error("STRIPE_PERSONAL_PLAN_LAUNCH_PRODUCT_ID is not set")
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set")
  const stripe = new Stripe(secretKey)
  for (const spec of STRIPE_LAUNCH_PRICE_SPECS) {
    const envKey = stripeLaunchEnvKey(spec.interval)
    const id = process.env[envKey]?.trim()
    if (!id) throw new Error(`${envKey} is not set`)
    const price = await stripe.prices.retrieve(id, { expand: ["product"] })
    const issues = validateStripeLaunchPrice(price, spec, productId)
    if (issues.length) throw new Error(`${envKey} is invalid: ${issues.join(", ")}`)
    const resolved = resolveStripePriceId(id)
    if (
      resolved?.pricingCatalog !== "personal_plan_launch_v1" ||
      resolved.interval !== spec.runtimeInterval
    ) {
      throw new Error(`${envKey} is not recognized by the runtime catalog resolver`)
    }
    console.log(`${envKey}=${id} ok`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
