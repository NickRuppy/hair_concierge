import assert from "node:assert/strict"
import test from "node:test"
import {
  EXPIRED_ENTITLEMENT_GRACE_MS,
  hasCurrentBillingAccess,
  hasCurrentLegacyProfileAccess,
} from "../src/lib/billing/subscriptions"
import type { BillingSubscriptionRow } from "../src/lib/billing/types"

const NOW = new Date("2026-08-22T12:00:00.000Z")
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isoOffset(ms: number): string {
  return new Date(NOW.getTime() + ms).toISOString()
}

function billingRow(overrides: Partial<BillingSubscriptionRow> = {}): BillingSubscriptionRow {
  return {
    id: "sub-1",
    user_id: "user-1",
    provider: "stripe",
    provider_customer_id: "cus-1",
    provider_subscriber_email: null,
    provider_subscription_id: "sub_1",
    provider_status: "active",
    entitlement_status: "active",
    interval: "month",
    current_period_end: isoOffset(ONE_DAY_MS),
    cancel_at_period_end: false,
    cancel_scheduled_at: null,
    cancelled_at: null,
    metadata: {},
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  }
}

test("EXPIRED_ENTITLEMENT_GRACE_MS is exactly 1 day, matching the SQL grace window", () => {
  assert.equal(EXPIRED_ENTITLEMENT_GRACE_MS, ONE_DAY_MS)
})

test("hasCurrentBillingAccess: active row with period end 2 days past has no access", () => {
  const row = billingRow({
    entitlement_status: "active",
    current_period_end: isoOffset(-2 * ONE_DAY_MS),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), false)
})

test("hasCurrentBillingAccess: active row 12 hours past is within the grace window", () => {
  const row = billingRow({
    entitlement_status: "active",
    current_period_end: isoOffset(-12 * 60 * 60 * 1000),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), true)
})

test("hasCurrentBillingAccess: active row with period end in the future has access", () => {
  const row = billingRow({
    entitlement_status: "active",
    current_period_end: isoOffset(ONE_DAY_MS),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), true)
})

test("hasCurrentBillingAccess: past_due row exactly at the grace boundary has access", () => {
  const row = billingRow({
    entitlement_status: "past_due",
    current_period_end: isoOffset(-ONE_DAY_MS),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), true)
})

test("hasCurrentBillingAccess: past_due row just past the grace boundary has no access", () => {
  const row = billingRow({
    entitlement_status: "past_due",
    current_period_end: isoOffset(-ONE_DAY_MS - 1),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), false)
})

test("hasCurrentBillingAccess: canceled row with cancel_at_period_end until a future period end has access", () => {
  const row = billingRow({
    entitlement_status: "canceled",
    cancel_at_period_end: true,
    current_period_end: isoOffset(ONE_DAY_MS),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), true)
})

test("hasCurrentBillingAccess: canceled row past its period end has no access (existing behavior preserved)", () => {
  const row = billingRow({
    entitlement_status: "canceled",
    cancel_at_period_end: true,
    current_period_end: isoOffset(-1),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), false)
})

test("hasCurrentBillingAccess: canceled row without cancel_at_period_end has no access regardless of period end", () => {
  const row = billingRow({
    entitlement_status: "canceled",
    cancel_at_period_end: false,
    current_period_end: isoOffset(ONE_DAY_MS),
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), false)
})

test("hasCurrentBillingAccess: active row with null current_period_end keeps existing (grantsaccess) behavior", () => {
  // current_period_end null on an open-entitlement row is treated as
  // legacy/incomplete billing_subscriptions data (e.g. rows backfilled from
  // profiles before a first webhook populated the period). Grace-window
  // enforcement only applies once we have a real period_end to measure
  // against, so null rows fall back to the pre-existing status-only check.
  const row = billingRow({
    entitlement_status: "active",
    current_period_end: null,
  })
  assert.equal(hasCurrentBillingAccess(row, NOW), true)
})

test("hasCurrentLegacyProfileAccess: active profile 2 days past period end has no access", () => {
  const profile = {
    subscription_status: "active",
    current_period_end: isoOffset(-2 * ONE_DAY_MS),
  }
  assert.equal(hasCurrentLegacyProfileAccess(profile, NOW), false)
})

test("hasCurrentLegacyProfileAccess: active profile 12 hours past period end is within grace", () => {
  const profile = {
    subscription_status: "active",
    current_period_end: isoOffset(-12 * 60 * 60 * 1000),
  }
  assert.equal(hasCurrentLegacyProfileAccess(profile, NOW), true)
})

test("hasCurrentLegacyProfileAccess: active profile with null period end keeps existing (grants access) behavior", () => {
  const profile = { subscription_status: "active", current_period_end: null }
  assert.equal(hasCurrentLegacyProfileAccess(profile, NOW), true)
})

test("hasCurrentLegacyProfileAccess: canceled profile past period end has no access (existing behavior preserved)", () => {
  const profile = { subscription_status: "canceled", current_period_end: isoOffset(-1) }
  assert.equal(hasCurrentLegacyProfileAccess(profile, NOW), false)
})

test("hasCurrentLegacyProfileAccess: canceled profile before a future period end has access", () => {
  const profile = { subscription_status: "canceled", current_period_end: isoOffset(ONE_DAY_MS) }
  assert.equal(hasCurrentLegacyProfileAccess(profile, NOW), true)
})
