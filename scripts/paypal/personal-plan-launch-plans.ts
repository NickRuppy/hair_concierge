import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"

export const PAYPAL_LAUNCH_PLAN_SPECS = [
  {
    interval: "monthly",
    displayName: "monatlich",
    runtimeInterval: "month",
    amount: "9.99",
    intervalCount: 1,
    intervalUnit: "MONTH",
  },
  {
    interval: "quarterly",
    displayName: "vierteljährlich",
    runtimeInterval: "quarter",
    amount: "19.99",
    intervalCount: 3,
    intervalUnit: "MONTH",
  },
  {
    interval: "annual",
    displayName: "jährlich",
    runtimeInterval: "year",
    amount: "69.99",
    intervalCount: 1,
    intervalUnit: "YEAR",
  },
] as const
type LaunchInterval = (typeof PAYPAL_LAUNCH_PLAN_SPECS)[number]["interval"]
type Plan = {
  id?: string
  product_id?: string
  status?: string
  taxes?: { percentage?: string }
  payment_preferences?: { setup_fee?: { value?: string; currency_code?: string } }
  billing_cycles?: Array<{
    tenure_type?: string
    total_cycles?: number
    frequency?: { interval_unit?: string; interval_count?: number }
    pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } }
  }>
}
type Manifest = { productId: string; plans: Partial<Record<LaunchInterval, string>> }

export function paypalLaunchEnvKey(interval: LaunchInterval): string {
  return `PAYPAL_PLAN_ID_PERSONAL_PLAN_LAUNCH_${interval.toUpperCase()}`
}
export function paypalRequestId(productId: string, interval: LaunchInterval): string {
  return `ppl-${createHash("sha256").update(`${productId}:${interval}`).digest("hex").slice(0, 32)}`
}
export function buildPayPalLaunchPlanPayload(
  spec: (typeof PAYPAL_LAUNCH_PLAN_SPECS)[number],
  productId: string,
) {
  return {
    product_id: productId,
    name: `Chaarlie Persönlicher Haarplan Launch ${spec.displayName}`,
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: { interval_unit: spec.intervalUnit, interval_count: spec.intervalCount },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: spec.amount, currency_code: "EUR" } },
      },
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: { value: "0", currency_code: "EUR" },
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3,
    },
  }
}
export function validatePayPalLaunchPlan(
  plan: Plan,
  spec: (typeof PAYPAL_LAUNCH_PLAN_SPECS)[number],
  productId: string,
): string[] {
  const cycle = plan.billing_cycles?.find((item) => item.tenure_type === "REGULAR")
  const issues: string[] = []
  if (plan.product_id !== productId) issues.push("product")
  if (plan.status !== "ACTIVE") issues.push("active")
  if (!cycle || cycle.total_cycles !== 0) issues.push("infinite_regular_cycle")
  if (
    cycle?.frequency?.interval_unit !== spec.intervalUnit ||
    cycle.frequency.interval_count !== spec.intervalCount
  )
    issues.push("cadence")
  if (
    cycle?.pricing_scheme?.fixed_price?.value !== spec.amount ||
    cycle.pricing_scheme.fixed_price.currency_code !== "EUR"
  )
    issues.push("amount_currency")
  if (
    Number(plan.payment_preferences?.setup_fee?.value) !== 0 ||
    plan.payment_preferences?.setup_fee?.currency_code !== "EUR"
  )
    issues.push("setup_fee")
  if (plan.taxes && Number(plan.taxes.percentage) !== 0) issues.push("taxes")
  return issues
}
export function formatPayPalLaunchEnv(ids: Record<LaunchInterval, string>): string {
  return PAYPAL_LAUNCH_PLAN_SPECS.map(
    (spec) => `${paypalLaunchEnvKey(spec.interval)}=${ids[spec.interval]}`,
  ).join("\n")
}

function option(args: string[], name: string): string | undefined {
  const value = args[args.indexOf(name) + 1]?.trim()
  return args.includes(name) && value ? value : undefined
}
function requireOption(args: string[], name: string): string {
  return (
    option(args, name) ??
    (() => {
      throw new Error(`${name} is required`)
    })()
  )
}
async function token(baseUrl: string): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID?.trim()
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  if (!id || !secret) throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required")
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })
  if (!response.ok) throw new Error(`PayPal OAuth failed: ${response.status}`)
  const body = (await response.json()) as { access_token?: string }
  if (!body.access_token) throw new Error("PayPal OAuth response did not include access_token")
  return body.access_token
}

async function fetchPlan(baseUrl: string, accessToken: string, planId: string): Promise<Plan> {
  const response = await fetch(`${baseUrl}/v1/billing/plans/${encodeURIComponent(planId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  })
  if (!response.ok) throw new Error(`PayPal Plan ${planId} lookup failed: ${response.status}`)
  return (await response.json()) as Plan
}

async function main() {
  const args = process.argv.slice(2)
  const create = args.includes("--create")
  const productId = option(args, "--product-id")
  if (!create) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          requiredForCreate: [
            "--create",
            "--product-id PROD-...",
            "--manifest /secure/path/launch-plans.json",
          ],
          plans: PAYPAL_LAUNCH_PLAN_SPECS,
        },
        null,
        2,
      ),
    )
    return
  }
  if (!productId)
    throw new Error(
      "Creation requires --product-id for an existing Product; this tool never creates Products",
    )
  const manifestPath = requireOption(args, "--manifest")
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest
  if (manifest.productId !== productId || !manifest.plans)
    throw new Error("Manifest productId must match --product-id and include plans")
  const baseUrl =
    process.env.PAYPAL_ENVIRONMENT === "live"
      ? "https://api-m.paypal.com"
      : process.env.PAYPAL_ENVIRONMENT === "sandbox"
        ? "https://api-m.sandbox.paypal.com"
        : (() => {
            throw new Error("PAYPAL_ENVIRONMENT must be sandbox or live")
          })()
  const accessToken = await token(baseUrl)
  const ids = { ...manifest.plans } as Record<LaunchInterval, string>
  for (const spec of PAYPAL_LAUNCH_PLAN_SPECS) {
    const recordedPlanId = ids[spec.interval]
    if (recordedPlanId) {
      const recordedPlan = await fetchPlan(baseUrl, accessToken, recordedPlanId)
      const issues = validatePayPalLaunchPlan(recordedPlan, spec, productId)
      if (recordedPlan.id !== recordedPlanId || issues.length) {
        throw new Error(
          `PayPal ${spec.interval} manifest Plan is invalid: ${issues.join(", ") || "id mismatch"}`,
        )
      }
      continue
    }
    const response = await fetch(`${baseUrl}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": paypalRequestId(productId, spec.interval),
      },
      body: JSON.stringify(buildPayPalLaunchPlanPayload(spec, productId)),
    })
    if (!response.ok)
      throw new Error(
        `PayPal ${spec.interval} plan creation failed: ${response.status} ${await response.text()}`,
      )
    const createdPlan = (await response.json()) as Plan
    if (!createdPlan.id) throw new Error(`PayPal ${spec.interval} response is missing a Plan ID`)
    const plan = await fetchPlan(baseUrl, accessToken, createdPlan.id)
    const issues = validatePayPalLaunchPlan(plan, spec, productId)
    if (plan.id !== createdPlan.id || issues.length)
      throw new Error(
        `PayPal ${spec.interval} returned an invalid plan: ${issues.join(", ") || "id mismatch"}`,
      )
    ids[spec.interval] = createdPlan.id
    await writeFile(manifestPath, `${JSON.stringify({ productId, plans: ids }, null, 2)}\n`, "utf8")
  }
  console.log(formatPayPalLaunchEnv(ids))
}
if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
