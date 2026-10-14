// Independent examples of configured provider plans used by trial consumers.
// These literals exercise plan admission/management; they do not create PayPal plans.
const MONTHLY = {
  product_id: "PROD-owned",
  name: "Configured monthly trial plan fixture",
  status: "ACTIVE" as const,
  billing_cycles: [
    {
      tenure_type: "REGULAR" as const,
      sequence: 1,
      total_cycles: 0,
      frequency: { interval_unit: "MONTH" as const, interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "9.99", currency_code: "EUR" as const } },
    },
  ],
  payment_preferences: { setup_fee: { value: "0" as const, currency_code: "EUR" as const } },
}
const ANNUAL = {
  product_id: "PROD-owned",
  name: "Configured annual trial plan fixture",
  status: "ACTIVE" as const,
  billing_cycles: [
    {
      tenure_type: "TRIAL" as const,
      sequence: 1,
      total_cycles: 1,
      frequency: { interval_unit: "YEAR" as const, interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "69.99", currency_code: "EUR" as const } },
    },
    {
      tenure_type: "REGULAR" as const,
      sequence: 2,
      total_cycles: 0,
      frequency: { interval_unit: "YEAR" as const, interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "99.99", currency_code: "EUR" as const } },
    },
  ],
  payment_preferences: { setup_fee: { value: "0" as const, currency_code: "EUR" as const } },
}

export function paypalTrialProviderPlanFixture(input: {
  interval: "month" | "year"
  productId: string
}) {
  return {
    ...structuredClone(input.interval === "month" ? MONTHLY : ANNUAL),
    product_id: input.productId,
  }
}
