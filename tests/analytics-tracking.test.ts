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
import { posthog } from "../src/lib/analytics/runtime/posthog"
import { initMetaPixel } from "../src/lib/meta-pixel"

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

async function withGlobalBrowserAsync<T>(win: Window, doc: Document, fn: () => Promise<T>) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")

  Object.defineProperty(globalThis, "window", { configurable: true, value: win })
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc })

  try {
    return await fn()
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

test("purchase completion browser event routes to Meta only", () => {
  withDestinationSpies((calls) => {
    trackAppEvent("purchase_completed", {
      checkoutSessionId: "cs_test_123",
      currency: "EUR",
      interval: "month",
      paymentMethodType: undefined,
      planId: "premium_month",
      value: 14.99,
    })

    assert.deepEqual(
      calls.map((call) => call.destination),
      ["meta"],
    )
  })
})

test("browser revenue return events only route to Meta", () => {
  assert.equal(eventRoutes.purchase_completed.customerio, false)
  assert.equal(eventRoutes.subscription_started.customerio, false)
  assert.equal(eventRoutes.purchase_completed.posthog, false)
  assert.equal(eventRoutes.subscription_started.posthog, false)
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

test("quiz completed analytics payload includes hair length when present", () => {
  withDestinationSpies((calls) => {
    trackAppEvent("quiz_completed", {
      hairLength: "medium",
      hairTexture: "wavy",
      leadId: "lead-123",
      scalpCondition: "gereizt",
      scalpType: "trocken",
      thickness: "fine",
    })

    const funnelEventId = (calls[0].payload as { funnelEventId?: string }).funnelEventId
    assert.equal(typeof funnelEventId, "string")
    assert.deepEqual(
      calls.map((call) => call.payload),
      [
        {
          funnelEventId,
          hairLength: "medium",
          hairTexture: "wavy",
          leadId: "lead-123",
          scalpCondition: "gereizt",
          scalpType: "trocken",
          thickness: "fine",
        },
        {
          funnelEventId,
          hairLength: "medium",
          hairTexture: "wavy",
          leadId: "lead-123",
          scalpCondition: "gereizt",
          scalpType: "trocken",
          thickness: "fine",
        },
        {
          funnelEventId,
          hairLength: "medium",
          hairTexture: "wavy",
          leadId: "lead-123",
          scalpCondition: "gereizt",
          scalpType: "trocken",
          thickness: "fine",
        },
      ],
    )
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
        value: 14.99,
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
          value: 14.99,
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
        value: 34.99,
      }),
      true,
    )
  })

  assert.deepEqual(dom.win.fbq?.queue, [
    ["init", "988892550357504"],
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
        value: 34.99,
      },
      { eventID: "cs_test_purchase" },
    ],
  ])
})

test("Meta purchase includes the package key behind the browser custom-data flag", () => {
  const previous = process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED
  const dom = createMetaDom()

  try {
    process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED = "true"
    withGlobalBrowser(dom.win, dom.doc, () => {
      assert.equal(
        metaDestination.track("purchase_completed", {
          checkoutSessionId: "cs_test_package_purchase",
          currency: "eur",
          funnelPackageKey: "scalp_check_placeholder",
          interval: "month",
          planId: "premium_month",
          value: 14.99,
        }),
        true,
      )
    })
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED
    else process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED = previous
  }

  const purchasePayload = dom.win.fbq?.queue?.find((call) => call[1] === "Purchase")?.[2] as Record<
    string,
    unknown
  >
  assert.equal(purchasePayload.funnel_package_key, "scalp_check_placeholder")
})

test("Meta adapter gates package keys and never sends funnel session IDs", () => {
  const previous = process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED
  const calls: unknown[][][] = []

  try {
    for (const enabled of [undefined, "true"]) {
      if (enabled) process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED = enabled
      else delete process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED

      const dom = createMetaDom()
      withGlobalBrowser(dom.win, dom.doc, () => {
        initMetaPixel({ win: dom.win, doc: dom.doc })
        metaDestination.track("checkout_started", {
          provider: "stripe",
          source: "pricing_page",
          funnelEventId: "30000000-0000-4000-8000-000000000003",
          funnelPackageKey: "scalp_check_placeholder",
          funnelSessionId: "20000000-0000-4000-8000-000000000002",
        })
      })
      calls.push(dom.win.fbq?.queue ?? [])
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED
    else process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED = previous
  }

  const disabledPayload = calls[0][1][2] as Record<string, unknown>
  const enabledPayload = calls[1][1][2] as Record<string, unknown>
  assert.equal(disabledPayload.funnel_package_key, undefined)
  assert.equal(enabledPayload.funnel_package_key, "scalp_check_placeholder")
  assert.equal(JSON.stringify(calls).includes("20000000-0000-4000-8000-000000000002"), false)
})

test("Meta waits for the sticky funnel package before dispatching an early quiz start", async () => {
  const previousFlag = process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED
  const originalFetch = globalThis.fetch
  const dom = createMetaDom()

  try {
    process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED = "true"
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          funnelPackageKey: "default_organic",
          funnelSessionId: "20000000-0000-4000-8000-000000000002",
        }),
        { headers: { "Content-Type": "application/json" }, status: 200 },
      )) as typeof fetch

    await withGlobalBrowserAsync(dom.win, dom.doc, async () => {
      assert.equal(
        metaDestination.track("quiz_started", {
          funnelEventId: "30000000-0000-4000-8000-000000000003",
          stepName: "hair_texture",
          stepNumber: 1,
        }),
        true,
      )

      await new Promise((resolve) => setTimeout(resolve, 0))
      initMetaPixel({ win: dom.win, doc: dom.doc })
    })
  } finally {
    globalThis.fetch = originalFetch
    if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED
    else process.env.NEXT_PUBLIC_FUNNEL_META_CUSTOM_DATA_ENABLED = previousFlag
  }

  const quizStartedPayload = dom.win.fbq?.queue?.find(
    (call) => call[1] === "QuizStarted",
  )?.[2] as Record<string, unknown>
  assert.equal(quizStartedPayload.funnel_package_key, "default_organic")
})
