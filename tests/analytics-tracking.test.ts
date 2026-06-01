import assert from "node:assert/strict"
import test from "node:test"

import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import { metaDestination } from "../src/lib/analytics/destinations/meta"
import { postHogDestination } from "../src/lib/analytics/destinations/posthog"
import type { AppEventMap, AppEventName } from "../src/lib/analytics/events"
import { eventRoutes } from "../src/lib/analytics/routes"
import { trackAppEvent } from "../src/lib/analytics/track-app-event"
import {
  clearCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"
import { posthog } from "../src/providers/posthog-provider"

type DestinationCall = {
  destination: "customerio" | "meta" | "posthog"
  eventName: AppEventName
  payload: AppEventMap[AppEventName]
}

function withDestinationSpies(fn: (calls: DestinationCall[]) => void) {
  const calls: DestinationCall[] = []
  const originalPostHog = postHogDestination.track
  const originalCustomerIo = customerIoDestination.track
  const originalMeta = metaDestination.track

  postHogDestination.track = ((eventName, payload) => {
    calls.push({ destination: "posthog", eventName, payload })
    return true
  }) as typeof postHogDestination.track
  customerIoDestination.track = ((eventName, payload) => {
    calls.push({ destination: "customerio", eventName, payload })
    return true
  }) as typeof customerIoDestination.track
  metaDestination.track = ((eventName, payload) => {
    calls.push({ destination: "meta", eventName, payload })
    return true
  }) as typeof metaDestination.track

  try {
    fn(calls)
  } finally {
    postHogDestination.track = originalPostHog
    customerIoDestination.track = originalCustomerIo
    metaDestination.track = originalMeta
  }
}

function createMetaDom() {
  const insertedScripts: Array<{ async?: boolean; id?: string; src?: string }> = []
  const scriptParent = {
    insertBefore(node: { async?: boolean; id?: string; src?: string }) {
      insertedScripts.push(node)
    },
  }
  const doc = {
    getElementById: (id: string) => insertedScripts.find((script) => script.id === id) ?? null,
    createElement: () => ({ async: false, id: "", src: "" }),
    getElementsByTagName: () => [{ parentNode: scriptParent }],
    head: {
      appendChild: (node: { async?: boolean; id?: string; src?: string }) =>
        insertedScripts.push(node),
    },
  } as unknown as Document

  return {
    doc,
    insertedScripts,
    win: {
      sessionStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    } as unknown as Window & { fbq?: ((...args: unknown[]) => void) & { queue?: unknown[][] } },
  }
}

function withGlobalBrowser<T>(win: Window, doc: Document, fn: () => T) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")

  Object.defineProperty(globalThis, "window", { configurable: true, value: win })
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc })

  try {
    return fn()
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, "window")
    }

    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument)
    } else {
      Reflect.deleteProperty(globalThis, "document")
    }
  }
}

test("quiz step views route to PostHog, Customer.io, and Meta", () => {
  withDestinationSpies((calls) => {
    trackAppEvent("quiz_step_viewed", {
      stepName: "hair_texture",
      stepNumber: 2,
    })

    assert.deepEqual(
      calls.map((call) => call.destination),
      ["posthog", "customerio", "meta"],
    )
  })
})

test("purchase completion browser event routes to PostHog and Meta", () => {
  withDestinationSpies((calls) => {
    trackAppEvent("purchase_completed", {
      checkoutSessionId: "cs_test_123",
      currency: "EUR",
      interval: "month",
      paymentMethodType: undefined,
      planId: "premium_month",
      value: 7.49,
    })

    assert.deepEqual(
      calls.map((call) => call.destination),
      ["posthog", "meta"],
    )
  })
})

test("browser revenue return events do not route to Customer.io", () => {
  assert.equal(eventRoutes.purchase_completed.customerio, false)
  assert.equal(eventRoutes.subscription_started.customerio, false)
  assert.equal(eventRoutes.purchase_completed.posthog, true)
  assert.equal(eventRoutes.subscription_started.posthog, true)
  assert.equal(eventRoutes.purchase_completed.meta, true)
  assert.equal(eventRoutes.subscription_started.meta, true)
})

test("browser quiz lead capture does not route to Customer.io", () => {
  assert.equal(eventRoutes.quiz_lead_captured.customerio, false)
  assert.equal(eventRoutes.quiz_lead_captured.posthog, true)
  assert.equal(eventRoutes.quiz_lead_captured.meta, true)

  withDestinationSpies((calls) => {
    trackAppEvent("quiz_lead_captured", {
      leadId: "lead-123",
      marketingConsent: false,
    })

    assert.deepEqual(
      calls.map((call) => call.destination),
      ["posthog", "meta"],
    )
  })
})

test("non-funnel lifecycle and engagement events stay out of Meta", () => {
  withDestinationSpies((calls) => {
    trackAppEvent("first_chat_message", {})

    assert.deepEqual(
      calls.map((call) => `${call.eventName}:${call.destination}`),
      ["first_chat_message:posthog", "first_chat_message:customerio"],
    )
  })
})

test("facade strips undefined payload values once before destination dispatch", () => {
  withDestinationSpies((calls) => {
    trackAppEvent("pricing_viewed", {
      leadId: undefined,
      source: "pricing_page",
    })

    assert.deepEqual(calls[0].payload, { source: "pricing_page" })
    assert.deepEqual(calls[1].payload, { source: "pricing_page" })
    assert.deepEqual(calls[2].payload, { source: "pricing_page" })
  })
})

test("destination failures are isolated and do not throw from the facade", () => {
  const originalPostHog = postHogDestination.track
  const originalCustomerIo = customerIoDestination.track
  const originalMeta = metaDestination.track
  const attempted: string[] = []

  postHogDestination.track = (() => {
    attempted.push("posthog")
    throw new Error("posthog unavailable")
  }) as typeof postHogDestination.track
  customerIoDestination.track = (() => {
    attempted.push("customerio")
    return true
  }) as typeof customerIoDestination.track
  metaDestination.track = (() => {
    attempted.push("meta")
    return true
  }) as typeof metaDestination.track

  try {
    trackAppEvent("quiz_step_viewed", {
      stepName: "hair_texture",
      stepNumber: 2,
    })

    assert.deepEqual(attempted, ["posthog", "customerio", "meta"])
  } finally {
    postHogDestination.track = originalPostHog
    customerIoDestination.track = originalCustomerIo
    metaDestination.track = originalMeta
  }
})

test("PostHog adapter strips undefined mapped properties", () => {
  const originalCapture = posthog.capture
  const calls: unknown[][] = []
  posthog.capture = ((...args: unknown[]) => {
    calls.push(args)
  }) as typeof posthog.capture

  try {
    postHogDestination.track("quiz_completed", {
      hairTexture: "wavy",
      scalpCondition: undefined,
      scalpType: null,
      thickness: undefined,
    })

    assert.deepEqual(calls, [["quiz_completed", { structure: "wavy", scalp_type: null }]])
  } finally {
    posthog.capture = originalCapture
  }
})

test("Customer.io adapter maps app payloads to snake_case vendor payloads", () => {
  const calls: unknown[][] = []

  setCustomerIoBrowserClient({
    identify: () => undefined,
    page: () => undefined,
    reset: () => undefined,
    track: (...args: unknown[]) => calls.push(args),
  })

  try {
    assert.equal(
      customerIoDestination.track("purchase_completed", {
        checkoutSessionId: "cs_test_123",
        currency: "eur",
        interval: "month",
        paymentMethodType: undefined,
        planId: "premium_month",
        value: 7.49,
      }),
      true,
    )

    assert.deepEqual(calls, [
      [
        "purchase_completed",
        {
          checkout_session_id: "cs_test_123",
          currency: "EUR",
          interval: "month",
          plan_id: "premium_month",
          value: 7.49,
        },
      ],
    ])
  } finally {
    clearCustomerIoBrowserClient()
  }
})

test("Meta adapter builds purchase payload from app-owned checkout fields", () => {
  const dom = createMetaDom()

  withGlobalBrowser(dom.win, dom.doc, () => {
    assert.equal(
      metaDestination.track("purchase_completed", {
        checkoutSessionId: "cs_test_purchase",
        currency: "eur",
        interval: "quarter",
        paymentMethodType: "card",
        planId: "premium_quarter",
        value: 17.49,
      }),
      true,
    )
  })

  assert.deepEqual(dom.win.fbq?.queue, [
    ["init", "988892550357504"],
    ["consent", "grant"],
    [
      "track",
      "Purchase",
      {
        content_ids: ["premium_quarter"],
        content_name: "premium_subscription",
        content_type: "product",
        currency: "EUR",
        payment_method_type: "card",
        subscription_interval: "quarter",
        value: 17.49,
      },
      { eventID: "cs_test_purchase" },
    ],
    ["consent", "revoke"],
  ])
})
