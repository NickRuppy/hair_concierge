import assert from "node:assert/strict"
import test from "node:test"
import {
  createTrialOfferSnapshot,
  parseTrialOfferSnapshot,
  toTrialOfferPricing,
} from "../src/lib/billing/trial-offer"

const catalog = {
  monthPriceId: "price_month",
  yearPriceId: "price_year",
  annualCouponId: "coupon_launch",
}

test("public offer prices derive from validated interval snapshots without provider identifiers", () => {
  const month = createTrialOfferSnapshot("month", catalog)
  const year = createTrialOfferSnapshot("year", catalog)
  assert.deepEqual(toTrialOfferPricing({ month, year }), {
    trialDays: 7,
    monthlyAmountMinor: 999,
    annualFirstAmountMinor: 6999,
    annualRenewalAmountMinor: 9999,
  })
  const fullPriceYear = createTrialOfferSnapshot("year", { ...catalog, annualCouponId: null })
  assert.equal(toTrialOfferPricing({ month, year: fullPriceYear }).annualFirstAmountMinor, 9999)
  assert.throws(() => toTrialOfferPricing({ month: year, year: month }))
  assert.throws(() => toTrialOfferPricing({ month, year: { ...year, firstAmountMinor: 7999 } }))
})

test("pins approved first and renewal prices without adding tax", () => {
  const annual = createTrialOfferSnapshot("year", catalog)
  assert.equal(annual.firstAmountMinor, 6999)
  assert.equal(annual.renewalAmountMinor, 9999)
  assert.equal(annual.stripeCouponId, "coupon_launch")
  assert.equal(annual.trialDays, 7)
  assert.equal(annual.taxBehavior, "inclusive")
  const monthly = createTrialOfferSnapshot("month", catalog)
  assert.equal(monthly.firstAmountMinor, 999)
  assert.equal(monthly.renewalAmountMinor, 999)
  assert.equal(monthly.stripeCouponId, null)
})

test("removing the launch coupon changes new offers, preserving accepted snapshots", () => {
  const accepted = createTrialOfferSnapshot("year", catalog)
  const later = createTrialOfferSnapshot("year", { ...catalog, annualCouponId: null })
  assert.equal(later.firstAmountMinor, 9999)
  assert.equal(later.stripeCouponId, null)
  assert.equal(accepted.firstAmountMinor, 6999)
  assert.deepEqual(parseTrialOfferSnapshot(JSON.parse(JSON.stringify(accepted))), accepted)
  assert.equal(Object.isFrozen(accepted), true)
})

test("rejects unsupported intervals and incomplete or ambiguous provider configuration", () => {
  for (const interval of ["quarter", "week", null, undefined]) {
    assert.throws(() => createTrialOfferSnapshot(interval, catalog))
  }
  for (const invalid of [
    { ...catalog, monthPriceId: "" },
    { ...catalog, yearPriceId: " price_year" },
    { ...catalog, yearPriceId: "price_month" },
    { ...catalog, annualCouponId: "" },
    { ...catalog, annualCouponId: undefined },
  ])
    assert.throws(() => createTrialOfferSnapshot("year", invalid as typeof catalog))
})

test("stored offer parsing fails closed on inconsistent financial or trial terms", () => {
  const accepted = createTrialOfferSnapshot("year", catalog)
  for (const changed of [
    { trialDays: 14 },
    { currency: "USD" },
    { firstAmountMinor: 6990 },
    { renewalAmountMinor: 6999 },
    { stripeCouponId: null },
    { taxBehavior: "exclusive" },
    { cohort: "legacy" },
    { offerVersion: "unknown" },
    { stripePriceId: "" },
    { interval: "quarter" },
  ])
    assert.equal(parseTrialOfferSnapshot({ ...accepted, ...changed }), null)
  assert.equal(parseTrialOfferSnapshot(null), null)
  assert.equal(parseTrialOfferSnapshot([]), null)
  assert.equal(
    parseTrialOfferSnapshot({
      ...createTrialOfferSnapshot("month", catalog),
      stripeCouponId: "launch",
    }),
    null,
  )
})
