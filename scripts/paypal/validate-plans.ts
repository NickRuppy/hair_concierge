import type { BillingInterval } from "../../src/lib/billing/types"
import { getPayPalPlanEnvKey, getPayPalPlanId } from "../../src/lib/paypal/plans"
import { type PayPalPlan, validatePayPalPlanShape } from "../../src/lib/paypal/subscription-shapes"

type OAuthTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
}

const intervals: BillingInterval[] = ["month", "quarter", "year"]

async function main() {
  for (const interval of intervals) {
    const envKey = getPayPalPlanEnvKey(interval)
    const planId = getPayPalPlanId(interval)
    const plan = await retrievePayPalPlan(planId)
    validatePayPalPlanShape(plan, interval)
    console.log(`PayPal ${interval} plan ok (${envKey}=${planId})`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

async function retrievePayPalPlan(planId: string): Promise<PayPalPlan> {
  return paypalRequest<PayPalPlan>(`/v1/billing/plans/${encodeURIComponent(planId)}`)
}

async function paypalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getPayPalAccessToken()
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  })

  if (!response.ok) {
    throw new Error(
      `PayPal request failed (${response.status} ${response.statusText}): ${await readBody(response)}`,
    )
  }

  return (await response.json()) as T
}

async function getPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId) throw new Error("PAYPAL_CLIENT_ID is not set")
  if (!clientSecret) throw new Error("PAYPAL_CLIENT_SECRET is not set")

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  })

  if (!response.ok) {
    throw new Error(
      `PayPal OAuth failed (${response.status} ${response.statusText}): ${await readBody(response)}`,
    )
  }

  const token = (await response.json()) as OAuthTokenResponse
  if (!token.access_token) throw new Error("PayPal OAuth response did not include access_token")
  return token.access_token
}

function getPayPalBaseUrl(): string {
  const environment = (process.env.PAYPAL_ENVIRONMENT ?? "sandbox").toLowerCase()
  if (environment === "live") return "https://api-m.paypal.com"
  if (environment === "sandbox") return "https://api-m.sandbox.paypal.com"
  throw new Error("PAYPAL_ENVIRONMENT must be either sandbox or live")
}

async function readBody(response: Response): Promise<string> {
  const text = await response.text()
  return text || "<empty body>"
}
