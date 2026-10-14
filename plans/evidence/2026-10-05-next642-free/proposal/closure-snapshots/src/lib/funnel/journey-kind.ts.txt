export type FunnelTestKind = "field_test" | "partner"

export function isNonCommercialFunnelTestKind(value: unknown): value is FunnelTestKind {
  return value === "field_test" || value === "partner"
}

export function isCustomerIoJourneyEligible(value: unknown) {
  return value !== "partner"
}
