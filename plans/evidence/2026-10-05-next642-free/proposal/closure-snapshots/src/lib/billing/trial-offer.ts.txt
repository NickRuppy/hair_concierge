export type TrialStripeCatalog = {
  monthPriceId: string
  yearPriceId: string
  annualCouponId: string | null
}
export type TrialOfferSnapshot = {
  cohort: "trial_v1"
  offerVersion: "trial_launch_v1"
  interval: "month" | "year"
  currency: "EUR"
  trialDays: 7
  firstAmountMinor: number
  renewalAmountMinor: number
  taxBehavior: "inclusive"
  stripePriceId: string
  stripeCouponId: string | null
}

/** Public offer projection. Provider identifiers never cross this boundary. */
export type TrialOfferPricing = {
  trialDays: number
  monthlyAmountMinor: number
  annualFirstAmountMinor: number
  annualRenewalAmountMinor: number
}

export function toTrialOfferPricing(offers: {
  month: TrialOfferSnapshot
  year: TrialOfferSnapshot
}): Readonly<TrialOfferPricing> {
  const month = parseTrialOfferSnapshot(offers.month)
  const year = parseTrialOfferSnapshot(offers.year)
  if (!month || !year || month.interval !== "month" || year.interval !== "year") {
    throw new Error("A matching pair of validated trial offers is required")
  }
  return Object.freeze({
    trialDays: month.trialDays,
    monthlyAmountMinor: month.firstAmountMinor,
    annualFirstAmountMinor: year.firstAmountMinor,
    annualRenewalAmountMinor: year.renewalAmountMinor,
  })
}
function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 255 && !/\s/.test(value)
}

/** Server-created terms. Persist these with enrollment; never reconstruct accepted terms from current config. */
export function createTrialOfferSnapshot(
  interval: unknown,
  catalog: TrialStripeCatalog,
): Readonly<TrialOfferSnapshot> {
  if (interval !== "month" && interval !== "year") throw new Error("Unsupported trial interval")
  if (
    !catalog ||
    !isIdentifier(catalog.monthPriceId) ||
    !isIdentifier(catalog.yearPriceId) ||
    catalog.monthPriceId === catalog.yearPriceId ||
    (catalog.annualCouponId !== null && !isIdentifier(catalog.annualCouponId))
  ) {
    throw new Error("Incomplete trial Stripe catalog")
  }
  const annual = interval === "year"
  return Object.freeze({
    cohort: "trial_v1",
    offerVersion: "trial_launch_v1",
    interval,
    currency: "EUR",
    trialDays: 7,
    firstAmountMinor: annual ? (catalog.annualCouponId ? 6999 : 9999) : 999,
    renewalAmountMinor: annual ? 9999 : 999,
    taxBehavior: "inclusive",
    stripePriceId: annual ? catalog.yearPriceId : catalog.monthPriceId,
    stripeCouponId: annual ? catalog.annualCouponId : null,
  })
}

/**
 * Decodes immutable v1 terms, not current configuration. Never edit v1 monetary
 * rules for a new offer: introduce a new version and preserve this decoder.
 * This is neither client authorization nor a live catalog attestation.
 */
export function parseTrialOfferSnapshot(value: unknown): Readonly<TrialOfferSnapshot> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  if (
    item.cohort !== "trial_v1" ||
    item.offerVersion !== "trial_launch_v1" ||
    (item.interval !== "month" && item.interval !== "year") ||
    item.currency !== "EUR" ||
    item.trialDays !== 7 ||
    item.taxBehavior !== "inclusive" ||
    !isIdentifier(item.stripePriceId) ||
    (item.stripeCouponId !== null && !isIdentifier(item.stripeCouponId))
  )
    return null
  const annual = item.interval === "year"
  if (
    (!annual && item.stripeCouponId !== null) ||
    item.firstAmountMinor !== (annual ? (item.stripeCouponId ? 6999 : 9999) : 999) ||
    item.renewalAmountMinor !== (annual ? 9999 : 999)
  )
    return null
  return Object.freeze({
    cohort: "trial_v1",
    offerVersion: "trial_launch_v1",
    interval: item.interval,
    currency: "EUR",
    trialDays: 7,
    firstAmountMinor: item.firstAmountMinor as number,
    renewalAmountMinor: item.renewalAmountMinor as number,
    taxBehavior: "inclusive",
    stripePriceId: item.stripePriceId,
    stripeCouponId: item.stripeCouponId as string | null,
  })
}
