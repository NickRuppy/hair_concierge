import assert from "node:assert/strict"
import test from "node:test"
import { formatBillingMembershipStatus } from "../src/lib/billing/display"

test("billing status labels canceled subscriptions with paid-through access", () => {
  const label = formatBillingMembershipStatus(
    {
      entitlement_status: "canceled",
      cancel_at_period_end: true,
      current_period_end: "2026-07-03T12:00:00.000Z",
    },
    null,
    new Date("2026-06-03T12:00:00.000Z"),
  )

  assert.equal(label, "Verlängerung gekündigt, Zugang bis 3.7.2026")
})

test("billing status falls back to the raw status when canceled access is already expired", () => {
  const label = formatBillingMembershipStatus(
    {
      entitlement_status: "canceled",
      cancel_at_period_end: true,
      current_period_end: "2026-05-03T12:00:00.000Z",
    },
    "active",
    new Date("2026-06-03T12:00:00.000Z"),
  )

  assert.equal(label, "canceled")
})
