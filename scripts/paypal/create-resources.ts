import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { BillingInterval } from "../../src/lib/billing/types"
import { EXPECTED_PAYPAL_PLAN_SHAPES, type PayPalIntervalUnit } from "../../src/lib/paypal/plans"

type OAuthTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
}

type PayPalProductPayload = {
  name: string
  description: string
  type: "SERVICE"
}

type PayPalPlanPayload = {
  product_id: string
  name: string
  description: string
  status: "ACTIVE"
  billing_cycles: Array<{
    frequency: { interval_unit: PayPalIntervalUnit; interval_count: number }
    tenure_type: "REGULAR"
    sequence: 1
    total_cycles: 0
    pricing_scheme: {
      fixed_price: { value: string; currency_code: string }
    }
  }>
  payment_preferences: {
    auto_bill_outstanding: true
    setup_fee: { value: "0"; currency_code: string }
    setup_fee_failure_action: "CONTINUE"
    payment_failure_threshold: 3
  }
}

type PayPalWebhookPayload = {
  url: string
  event_types: Array<{ name: string }>
}

type PayPalProductResponse = {
  id?: string
}

type PayPalPlanResponse = {
  id?: string
}

type PayPalWebhookResponse = {
  id?: string
}

type CreatedResourceIds = {
  productId: string
  planIds: Record<BillingInterval, string>
  webhookId?: string
}

type CliOptions = {
  dryRun: boolean
  webhookOnly: boolean
  productId?: string
  webhookUrl?: string
}

const intervals: BillingInterval[] = ["month", "quarter", "year"]

const intervalLabels: Record<BillingInterval, string> = {
  month: "Monat",
  quarter: "Quartal",
  year: "Jahr",
}

export const DEFAULT_PAYPAL_WEBHOOK_EVENTS = [
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.CREATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.EXPIRED",
  "BILLING.SUBSCRIPTION.PAYMENT.FAILED",
  "PAYMENT.SALE.COMPLETED",
  "PAYMENT.SALE.REFUNDED",
  "PAYMENT.SALE.REVERSED",
] as const

export function buildPayPalProductPayload(
  input: {
    name?: string
    description?: string
  } = {},
): PayPalProductPayload {
  return {
    name: input.name ?? "Chaarlie Premium",
    description: input.description ?? "Chaarlie Premium membership",
    type: "SERVICE",
  }
}

export function buildPayPalPlanPayload(
  interval: BillingInterval,
  productId: string,
): PayPalPlanPayload {
  const expected = EXPECTED_PAYPAL_PLAN_SHAPES[interval]

  return {
    product_id: productId,
    name: `Chaarlie Premium ${intervalLabels[interval]}`,
    description: `Chaarlie Premium, ${intervalLabels[interval]}`,
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: {
          interval_unit: expected.intervalUnit,
          interval_count: expected.intervalCount,
        },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: {
            value: expected.amount,
            currency_code: expected.currency,
          },
        },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: "0", currency_code: expected.currency },
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  }
}

export function buildPayPalWebhookPayload(webhookUrl: string): PayPalWebhookPayload {
  return {
    url: webhookUrl,
    event_types: DEFAULT_PAYPAL_WEBHOOK_EVENTS.map((name) => ({ name })),
  }
}

export function formatPayPalSetupEnv(ids: CreatedResourceIds): string {
  const lines = [
    `PAYPAL_PRODUCT_ID=${ids.productId}`,
    `PAYPAL_PLAN_ID_MONTHLY=${ids.planIds.month}`,
    `PAYPAL_PLAN_ID_QUARTERLY=${ids.planIds.quarter}`,
    `PAYPAL_PLAN_ID_ANNUAL=${ids.planIds.year}`,
  ]

  if (ids.webhookId) lines.push(`PAYPAL_WEBHOOK_ID=${ids.webhookId}`)
  return lines.join("\n")
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2))

  if (options.dryRun) {
    printDryRun(options)
    return
  }

  if (options.webhookOnly) {
    if (!options.webhookUrl) {
      throw new Error("--webhook-only requires PAYPAL_WEBHOOK_URL or --webhook-url")
    }
    const webhook = await createWebhook(buildPayPalWebhookPayload(options.webhookUrl))
    if (!webhook.id) throw new Error("PayPal webhook creation response did not include id")
    console.log(`Created PayPal webhook: ${webhook.id}`)
    console.log("\nAdd this env var:\n")
    console.log(`PAYPAL_WEBHOOK_ID=${webhook.id}`)
    return
  }

  const productId = options.productId ?? (await createProduct()).id
  if (!productId) throw new Error("PayPal product creation response did not include id")

  const planIds = {} as Record<BillingInterval, string>
  for (const interval of intervals) {
    const plan = await createPlan(buildPayPalPlanPayload(interval, productId))
    if (!plan.id) throw new Error(`PayPal ${interval} plan creation response did not include id`)
    planIds[interval] = plan.id
    console.log(`Created PayPal ${interval} plan: ${plan.id}`)
  }

  let webhookId: string | undefined
  if (options.webhookUrl) {
    const webhook = await createWebhook(buildPayPalWebhookPayload(options.webhookUrl))
    if (!webhook.id) throw new Error("PayPal webhook creation response did not include id")
    webhookId = webhook.id
    console.log(`Created PayPal webhook: ${webhookId}`)
  } else {
    console.log("Skipped webhook creation because PAYPAL_WEBHOOK_URL / --webhook-url was not set.")
  }

  console.log("\nAdd these env vars:\n")
  console.log(formatPayPalSetupEnv({ productId, planIds, webhookId }))
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: args.includes("--dry-run"),
    webhookOnly: args.includes("--webhook-only"),
    productId: process.env.PAYPAL_PRODUCT_ID?.trim() || undefined,
    webhookUrl: process.env.PAYPAL_WEBHOOK_URL?.trim() || undefined,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }
    if (arg === "--product-id") {
      options.productId = requiredArgValue(args, index, arg)
      index += 1
    }
    if (arg === "--webhook-url") {
      options.webhookUrl = requiredArgValue(args, index, arg)
      index += 1
    }
  }

  return options
}

function requiredArgValue(args: string[], index: number, arg: string): string {
  const value = args[index + 1]?.trim()
  if (!value) throw new Error(`${arg} requires a value`)
  return value
}

function printDryRun(options: CliOptions) {
  const productId = options.productId ?? "PROD_CREATED_BY_PAYPAL"
  console.log("Product payload:")
  console.log(JSON.stringify(buildPayPalProductPayload(), null, 2))
  console.log("\nPlan payloads:")
  for (const interval of intervals) {
    console.log(`\n${interval}:`)
    console.log(JSON.stringify(buildPayPalPlanPayload(interval, productId), null, 2))
  }
  if (options.webhookUrl) {
    console.log("\nWebhook payload:")
    console.log(JSON.stringify(buildPayPalWebhookPayload(options.webhookUrl), null, 2))
  }
}

function printHelp() {
  console.log(`Create PayPal Sandbox or Live products, plans, and optionally a webhook.

Required env:
  PAYPAL_CLIENT_ID
  PAYPAL_CLIENT_SECRET

Optional env:
  PAYPAL_ENVIRONMENT=sandbox|live
  PAYPAL_PRODUCT_ID=PROD-...      Reuse an existing product and create only plans.
  PAYPAL_WEBHOOK_URL=https://...  Create a webhook for this URL.

Flags:
  --dry-run
  --webhook-only
  --product-id PROD-...
  --webhook-url https://.../api/paypal/webhook

After creation, run:
  npm run paypal:validate-plans`)
}

async function createProduct(): Promise<PayPalProductResponse> {
  const payload = buildPayPalProductPayload()
  const product = await paypalRequest<PayPalProductResponse>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  console.log(`Created PayPal product: ${product.id ?? "<missing id>"}`)
  return product
}

async function createPlan(payload: PayPalPlanPayload): Promise<PayPalPlanResponse> {
  return paypalRequest<PayPalPlanResponse>("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

async function createWebhook(payload: PayPalWebhookPayload): Promise<PayPalWebhookResponse> {
  return paypalRequest<PayPalWebhookResponse>("/v1/notifications/webhooks", {
    method: "POST",
    body: JSON.stringify(payload),
  })
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

const scriptPath = resolve(process.argv[1] ?? "")
if (scriptPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
