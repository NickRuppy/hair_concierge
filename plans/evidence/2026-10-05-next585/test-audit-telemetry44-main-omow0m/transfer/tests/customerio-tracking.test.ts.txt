import assert from "node:assert/strict"
import test from "node:test"

import {
  clearCustomerIoBrowserClient,
  createCustomerIoTracker,
  disableCustomerIoBrowserClient,
  identifyCustomerIoUser,
  resetCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
  trackCustomerIoEvent,
  trackCustomerIoPage,
  type CustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"
import { buildSafeAnalyticsPageContext } from "../src/lib/analytics/page-url"

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
    ["page", undefined, "/quiz?step=goals", {}],
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

test("Customer.io calls override production SDK page enrichment with a credential-free context", () => {
  const livePage = {
    path: "/auth",
    referrer: "https://chaarlie.de/welcome?session_id=stripe-secret",
    search: "?email=person%40example.com&code=recovery-secret",
    title: "Anmelden",
    url: "https://chaarlie.de/auth?email=person%40example.com&code=recovery-secret",
  }
  const safePage = buildSafeAnalyticsPageContext({
    href: livePage.url,
    pathname: livePage.path,
    referrer: livePage.referrer,
    search: livePage.search,
    title: livePage.title,
  })
  const dispatched: Array<{
    context: { page: typeof safePage }
    properties?: Record<string, unknown>
    type: string
  }> = []
  const enrichLikeProductionSdk = (
    type: string,
    properties: Record<string, unknown> | undefined,
    options: { context: { page: typeof safePage } } | undefined,
  ) => {
    dispatched.push({
      context: { page: { ...livePage, ...options?.context.page } },
      properties: type === "page" ? { ...livePage, ...properties } : properties,
      type,
    })
  }
  const client: CustomerIoBrowserClient = {
    identify: (_userId, traits, options) => enrichLikeProductionSdk("identify", traits, options),
    page: (_category, _name, properties, options) =>
      enrichLikeProductionSdk("page", properties, options),
    reset: () => undefined,
    track: (_eventName, properties, options) =>
      enrichLikeProductionSdk("track", properties, options),
  }
  const tracker = createCustomerIoTracker({ getPageContext: () => safePage })

  tracker.page("/auth", { url: livePage.url })
  tracker.identify("user-123", { plan: "monthly" })
  tracker.track("quiz_started", { source: "landing" })
  tracker.setClient(client)

  assert.deepEqual(
    dispatched.map(({ context, type }) => ({ context, type })),
    ["page", "identify", "track"].map((type) => ({ context: { page: safePage }, type })),
  )
  assert.deepEqual(dispatched[0]?.properties, safePage)
  const serialized = JSON.stringify(dispatched)
  assert.doesNotMatch(serialized, /person%40example\.com|person@example\.com/)
  assert.doesNotMatch(serialized, /recovery-secret|stripe-secret/)
})
