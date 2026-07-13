import assert from "node:assert/strict"
import test from "node:test"

import {
  clearCustomerIoBrowserClient,
  disableCustomerIoBrowserClient,
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

test("browser helpers queue before readiness and flush clean payloads in order", () => {
  const { calls, client } = createCustomerIoClient()

  clearCustomerIoBrowserClient()

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
  assert.deepEqual(calls, [])

  setCustomerIoBrowserClient(client)

  assert.deepEqual(calls, [
    ["page", null, "/quiz?step=goals", {}],
    ["identify", "user-123", { email: "test@example.com", name: "Test User" }],
    ["track", "quiz_lead_captured", { lead_id: "lead-123", marketing_consent: true }],
    ["reset"],
  ])

  clearCustomerIoBrowserClient()
})

test("browser helpers stop accepting calls after loader failure disables the runtime", () => {
  clearCustomerIoBrowserClient()
  disableCustomerIoBrowserClient()

  assert.equal(trackCustomerIoPage("/quiz"), false)
  assert.equal(identifyCustomerIoUser("user-123"), false)
  assert.equal(resetCustomerIoBrowserClient(), false)
  assert.equal(trackCustomerIoEvent("quiz_started"), false)

  clearCustomerIoBrowserClient()
})
