import { expect, test } from "@playwright/test"
import { isSubscriptionActive } from "../src/lib/stripe/gating"

test("active status → true", () => {
  expect(isSubscriptionActive({ subscription_status: "active" })).toBe(true)
})

test("past_due status → true (grace period)", () => {
  expect(isSubscriptionActive({ subscription_status: "past_due" })).toBe(true)
})

test("canceled → false", () => {
  expect(isSubscriptionActive({ subscription_status: "canceled" })).toBe(false)
})

test("incomplete → false", () => {
  expect(isSubscriptionActive({ subscription_status: "incomplete" })).toBe(false)
})

test("null → false", () => {
  expect(isSubscriptionActive({ subscription_status: null })).toBe(false)
})

test("missing profile → false", () => {
  expect(isSubscriptionActive(null)).toBe(false)
})
