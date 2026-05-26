import assert from "node:assert/strict"
import test from "node:test"

import {
  canUseCustomerIoBrowserTracking,
  clearCustomerIoBrowserClient,
  identifyCustomerIoUser,
  resetCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
  trackCustomerIoEvent,
  trackCustomerIoPage,
} from "../src/lib/customerio-tracking"

function createCustomerIoClient() {
  const calls: unknown[][] = []
  return {
    calls,
    client: {
      identify: (...args: unknown[]) => calls.push(["identify", ...args]),
      page: (...args: unknown[]) => calls.push(["page", ...args]),
      reset: () => calls.push(["reset"]),
      track: (...args: unknown[]) => calls.push(["track", ...args]),
    },
  }
}

test("browser tracking requires a write key and analytics consent", () => {
  assert.equal(canUseCustomerIoBrowserTracking(null, "write-key"), false)
  assert.equal(canUseCustomerIoBrowserTracking({ analytics: false }, "write-key"), false)
  assert.equal(canUseCustomerIoBrowserTracking({ analytics: true }, ""), false)
  assert.equal(canUseCustomerIoBrowserTracking({ analytics: true }, "write-key"), true)
})

test("browser helpers dispatch page, identify, and track calls with clean payloads", () => {
  const { calls, client } = createCustomerIoClient()

  setCustomerIoBrowserClient(client)

  assert.equal(trackCustomerIoPage("/quiz?step=goals", { referrer: undefined }), true)
  assert.equal(
    identifyCustomerIoUser("user-123", {
      email: "test@example.com",
      name: "Test User",
      unused: undefined,
    }),
    true,
  )
  assert.equal(
    trackCustomerIoEvent("quiz_lead_captured", {
      lead_id: "lead-123",
      marketing_consent: true,
      skipped: undefined,
    }),
    true,
  )
  assert.equal(resetCustomerIoBrowserClient(), true)

  assert.deepEqual(calls, [
    ["page", null, "/quiz?step=goals", {}],
    ["identify", "user-123", { email: "test@example.com", name: "Test User" }],
    ["track", "quiz_lead_captured", { lead_id: "lead-123", marketing_consent: true }],
    ["reset"],
  ])

  clearCustomerIoBrowserClient()
})

test("browser helpers do nothing until a client is installed", () => {
  clearCustomerIoBrowserClient()

  assert.equal(trackCustomerIoPage("/quiz"), false)
  assert.equal(identifyCustomerIoUser("user-123"), false)
  assert.equal(resetCustomerIoBrowserClient(), false)
  assert.equal(trackCustomerIoEvent("quiz_started"), false)
})
