type TrialInterval = "month" | "year"

export type PayPalTrialTaxProjection = {
  percentage: string
  inclusive: true
}

type PayPalTrialCycle = {
  tenure_type: "TRIAL" | "REGULAR"
  sequence: number
  total_cycles: number
  frequency: { interval_unit: "MONTH" | "YEAR"; interval_count: number }
  pricing_scheme: { fixed_price: { value: string; currency_code: "EUR" } }
}

export type PayPalTrialPlanRequest = {
  product_id: string
  name: string
  status: "ACTIVE"
  billing_cycles: PayPalTrialCycle[]
  payment_preferences: { setup_fee: { value: "0"; currency_code: "EUR" } }
  taxes?: PayPalTrialTaxProjection
}

export type PayPalTrialPlanShapeInput = {
  interval: TrialInterval
  productId: string
  tax?: PayPalTrialTaxProjection
}

function cycle(
  tenure_type: "TRIAL" | "REGULAR",
  sequence: number,
  interval_unit: "MONTH" | "YEAR",
  interval_count: number,
  value: string,
  total_cycles: number,
): PayPalTrialCycle {
  return {
    tenure_type,
    sequence,
    total_cycles,
    frequency: { interval_unit, interval_count },
    pricing_scheme: { fixed_price: { value, currency_code: "EUR" } },
  }
}

function assertTrialInput(input: PayPalTrialPlanShapeInput): void {
  if (input.interval !== "month" && input.interval !== "year") {
    throw new Error("PayPal trial plans support monthly or annual intervals only")
  }
  if (typeof input.productId !== "string" || input.productId.trim() === "") {
    throw new Error("PayPal trial plan requires a server-owned product id")
  }
  if (input.tax && (!isValidTaxPercentage(input.tax.percentage) || input.tax.inclusive !== true)) {
    throw new Error("PayPal trial tax projection must be explicit and inclusive")
  }
}

function euroMinorUnits(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value)
  if (!match) return null
  const whole = Number(match[1])
  if (!Number.isSafeInteger(whole)) return null
  const minor = whole * 100 + Number((match[2] ?? "").padEnd(2, "0"))
  return Number.isSafeInteger(minor) ? minor : null
}

function isValidTaxPercentage(value: unknown): boolean {
  const minor = euroMinorUnits(value)
  return minor !== null && minor >= 0 && minor <= 10_000
}

/** Initial authorization uses a future start and an app trial, so this schedule has no free cycle. */
export function buildPayPalDeferredTrialPlanRequest(
  input: PayPalTrialPlanShapeInput,
): PayPalTrialPlanRequest {
  assertTrialInput(input)
  return {
    product_id: input.productId,
    status: "ACTIVE",
    name:
      input.interval === "month"
        ? "Chaarlie monatlich – Start nach Freigabe"
        : "Chaarlie jährlich – Launch, Start nach Freigabe",
    billing_cycles:
      input.interval === "month"
        ? [cycle("REGULAR", 1, "MONTH", 1, "9.99", 0)]
        : [cycle("TRIAL", 1, "YEAR", 1, "69.99", 1), cycle("REGULAR", 2, "YEAR", 1, "99.99", 0)],
    payment_preferences: { setup_fee: { value: "0", currency_code: "EUR" } },
    ...(input.tax ? { taxes: input.tax } : {}),
  }
}
