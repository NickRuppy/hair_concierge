import Stripe from "stripe"

export const STRIPE_LAUNCH_PRICE_SPECS = [
  {
    interval: "monthly",
    runtimeInterval: "month",
    amount: 999,
    intervalCount: 1,
    intervalUnit: "month",
  },
  {
    interval: "quarterly",
    runtimeInterval: "quarter",
    amount: 1999,
    intervalCount: 3,
    intervalUnit: "month",
  },
  {
    interval: "annual",
    runtimeInterval: "year",
    amount: 6999,
    intervalCount: 1,
    intervalUnit: "year",
  },
] as const

type LaunchInterval = (typeof STRIPE_LAUNCH_PRICE_SPECS)[number]["interval"]

export type StripeLaunchPriceShape = Pick<
  Stripe.Price,
  | "id"
  | "active"
  | "currency"
  | "unit_amount"
  | "recurring"
  | "tax_behavior"
  | "metadata"
  | "product"
  | "type"
  | "livemode"
>

export function stripeLaunchEnvKey(interval: LaunchInterval): string {
  return `STRIPE_PRICE_ID_PERSONAL_PLAN_LAUNCH_${interval.toUpperCase()}`
}

export function buildStripeLaunchPriceParams(
  spec: (typeof STRIPE_LAUNCH_PRICE_SPECS)[number],
  productId: string,
): Stripe.PriceCreateParams {
  return {
    currency: "eur",
    product: productId,
    unit_amount: spec.amount,
    recurring: { interval: spec.intervalUnit, interval_count: spec.intervalCount },
    tax_behavior: "inclusive",
    metadata: {
      pricing_catalog: "personal_plan_launch_v1",
      billing_interval: spec.runtimeInterval,
    },
  }
}

export function validateStripeLaunchPrice(
  price: StripeLaunchPriceShape,
  spec: (typeof STRIPE_LAUNCH_PRICE_SPECS)[number],
  productId: string,
): string[] {
  const actualProductId = typeof price.product === "string" ? price.product : price.product.id
  const product = typeof price.product === "string" ? null : price.product
  const activeProduct = product && !("deleted" in product) ? product : null
  const issues: string[] = []
  if (actualProductId !== productId) issues.push("product")
  if (activeProduct?.active !== true) issues.push("product_active")
  if (!activeProduct || activeProduct.livemode !== price.livemode) issues.push("livemode")
  if (!price.active) issues.push("active")
  if (price.currency.toLowerCase() !== "eur") issues.push("currency")
  if (price.unit_amount !== spec.amount) issues.push("amount")
  if (price.type !== "recurring") issues.push("type")
  if (
    price.recurring?.interval !== spec.intervalUnit ||
    price.recurring.interval_count !== spec.intervalCount
  )
    issues.push("cadence")
  if (price.tax_behavior !== "inclusive") issues.push("tax_behavior")
  if (
    price.metadata.pricing_catalog !== "personal_plan_launch_v1" ||
    price.metadata.billing_interval !== spec.runtimeInterval
  )
    issues.push("metadata")
  return issues
}

export function selectExistingStripeLaunchPrice(
  prices: readonly StripeLaunchPriceShape[],
  spec: (typeof STRIPE_LAUNCH_PRICE_SPECS)[number],
  productId: string,
): StripeLaunchPriceShape | null {
  const candidates = prices.filter(
    (price) => price.metadata.billing_interval === spec.runtimeInterval,
  )
  const exact = candidates.filter(
    (price) => validateStripeLaunchPrice(price, spec, productId).length === 0,
  )
  if (candidates.length !== exact.length || exact.length > 1) {
    throw new Error(
      `Stripe ${spec.interval} launch Price conflict: inspect existing tagged Prices before retrying`,
    )
  }
  return exact[0] ?? null
}

export function formatStripeLaunchEnv(ids: Record<LaunchInterval, string>): string {
  return STRIPE_LAUNCH_PRICE_SPECS.map(
    (spec) => `${stripeLaunchEnvKey(spec.interval)}=${ids[spec.interval]}`,
  ).join("\n")
}

function requiredOption(args: string[], name: string): string {
  const value = args[args.indexOf(name) + 1]?.trim()
  if (!value) throw new Error(`${name} requires an existing Product ID`)
  return value
}

async function main() {
  const args = process.argv.slice(2)
  const create = args.includes("--create")
  const productId = args.includes("--product-id") ? requiredOption(args, "--product-id") : undefined
  if (!create) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          requiredForCreate: ["--create", "--product-id prod_..."],
          prices: STRIPE_LAUNCH_PRICE_SPECS,
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
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set")
  const stripe = new Stripe(secretKey)
  const ids = {} as Record<LaunchInterval, string>
  const [activePrices, inactivePrices] = await Promise.all([
    stripe.prices.list({
      product: productId,
      active: true,
      type: "recurring",
      limit: 100,
      expand: ["data.product"],
    }),
    stripe.prices.list({
      product: productId,
      active: false,
      type: "recurring",
      limit: 100,
      expand: ["data.product"],
    }),
  ])
  if (activePrices.has_more || inactivePrices.has_more) {
    throw new Error("Stripe Product has more than 100 recurring Prices; inspect it manually")
  }
  const tagged = [...activePrices.data, ...inactivePrices.data].filter(
    (price) =>
      price.metadata.pricing_catalog === "personal_plan_launch_v1" ||
      Boolean(price.metadata.billing_interval),
  )
  const knownIntervals = new Set<string>(
    STRIPE_LAUNCH_PRICE_SPECS.map((spec) => spec.runtimeInterval),
  )
  if (
    tagged.some(
      (price) =>
        price.metadata.pricing_catalog !== "personal_plan_launch_v1" ||
        !knownIntervals.has(price.metadata.billing_interval),
    )
  ) {
    throw new Error("Stripe launch Price metadata conflict: inspect tagged Prices before retrying")
  }
  for (const spec of STRIPE_LAUNCH_PRICE_SPECS) {
    const existing = selectExistingStripeLaunchPrice(tagged, spec, productId)
    const created = existing
      ? null
      : await stripe.prices.create(buildStripeLaunchPriceParams(spec, productId), {
          idempotencyKey: `personal-plan-launch-price:${productId}:${spec.interval}`,
        })
    const price = existing ?? (await stripe.prices.retrieve(created!.id, { expand: ["product"] }))
    const issues = validateStripeLaunchPrice(price, spec, productId)
    if (issues.length) {
      throw new Error(`Stripe ${spec.interval} launch Price is invalid: ${issues.join(", ")}`)
    }
    ids[spec.interval] = price.id
  }
  console.log(formatStripeLaunchEnv(ids))
}

if (import.meta.url === `file://${process.argv[1]}`)
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
