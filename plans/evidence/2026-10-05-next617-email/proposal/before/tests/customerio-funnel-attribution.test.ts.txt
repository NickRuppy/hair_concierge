import assert from "node:assert/strict"
import test from "node:test"

import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import {
  clearCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
  type CustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"

test("Customer.io enriches cold funnel events and isolates queued dispatch failures", async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ eventName: string; properties?: Record<string, unknown> }> = []
  const client = {
    identify: () => undefined,
    page: () => undefined,
    reset: () => undefined,
    track: (eventName: string, properties?: Record<string, unknown>) => {
      calls.push({ eventName, properties })
      if (eventName === "pricing_viewed") throw new Error("synthetic Customer.io dispatch failure")
    },
  } as CustomerIoBrowserClient

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        funnelPackageKey: "default_organic",
        funnelSessionId: "20000000-0000-4000-8000-000000000002",
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    )) as typeof fetch
  try {
    assert.equal(
      customerIoDestination.track("pricing_viewed", {
        funnelEventId: "30000000-0000-4000-8000-000000000005",
        source: "pricing_page",
      }),
      true,
    )
    assert.equal(
      customerIoDestination.track("quiz_started", {
        funnelEventId: "30000000-0000-4000-8000-000000000006",
        stepName: "hair_texture",
        stepNumber: 2,
      }),
      true,
    )
    assert.equal(calls.length, 0)

    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(calls.length, 0)

    setCustomerIoBrowserClient(client)

    assert.deepEqual(calls, [
      {
        eventName: "pricing_viewed",
        properties: {
          funnel_event_id: "30000000-0000-4000-8000-000000000005",
          funnel_package_key: "default_organic",
          funnel_session_id: "20000000-0000-4000-8000-000000000002",
          source: "pricing_page",
        },
      },
      {
        eventName: "quiz_started",
        properties: {
          funnel_event_id: "30000000-0000-4000-8000-000000000006",
          funnel_package_key: "default_organic",
          funnel_session_id: "20000000-0000-4000-8000-000000000002",
          step_name: "hair_texture",
          step_number: 2,
        },
      },
    ])
  } finally {
    globalThis.fetch = originalFetch
    clearCustomerIoBrowserClient()
  }
})
