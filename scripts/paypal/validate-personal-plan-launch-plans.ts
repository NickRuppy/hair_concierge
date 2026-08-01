import {
  PAYPAL_LAUNCH_PLAN_SPECS,
  paypalLaunchEnvKey,
  validatePayPalLaunchPlan,
} from "./personal-plan-launch-plans"
import { resolvePayPalPlanId } from "../../src/lib/paypal/plans"

async function main() {
  const productId = process.env.PAYPAL_PERSONAL_PLAN_LAUNCH_PRODUCT_ID?.trim()
  if (!productId) throw new Error("PAYPAL_PERSONAL_PLAN_LAUNCH_PRODUCT_ID is not set")
  const environment = process.env.PAYPAL_ENVIRONMENT
  const baseUrl =
    environment === "live"
      ? "https://api-m.paypal.com"
      : environment === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : (() => {
            throw new Error("PAYPAL_ENVIRONMENT must be sandbox or live")
          })()
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret)
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required")
  const oauth = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  const token = ((await oauth.json()) as { access_token?: string }).access_token
  if (!oauth.ok || !token) throw new Error("PayPal OAuth failed")
  for (const spec of PAYPAL_LAUNCH_PLAN_SPECS) {
    const envKey = paypalLaunchEnvKey(spec.interval)
    const id = process.env[envKey]?.trim()
    if (!id) throw new Error(`${envKey} is not set`)
    const response = await fetch(`${baseUrl}/v1/billing/plans/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    })
    if (!response.ok) throw new Error(`${envKey} lookup failed: ${response.status}`)
    const issues = validatePayPalLaunchPlan(await response.json(), spec, productId)
    if (issues.length) throw new Error(`${envKey} is invalid: ${issues.join(", ")}`)
    const resolved = resolvePayPalPlanId(id)
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
