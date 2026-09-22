import assert from "node:assert/strict"
import test from "node:test"

import { customerIoDestination } from "../src/lib/analytics/destinations/customerio"
import { metaDestination } from "../src/lib/analytics/destinations/meta"
import { eventRoutes } from "../src/lib/analytics/routes"
import {
  createScannerQuizViewTracker,
  quizViewEventForPackage,
} from "../src/lib/analytics/scanner-quiz-view"
import {
  clearCustomerIoBrowserClient,
  setCustomerIoBrowserClient,
} from "../src/lib/customerio-tracking"
import { initMetaPixel, trackMetaBookingScheduled } from "../src/lib/meta-pixel"

function createMetaDom() {
  const calls: unknown[][] = []
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
    calls,
    doc,
    win: {
      sessionStorage: {
        getItem: () => null,
        setItem: () => undefined,
      },
    } as unknown as Window & { fbq?: ((...args: unknown[]) => void) & { queue?: unknown[][] } },
  }
}

test("booking-scheduled routes to every destination; the quiz snapshot stays PostHog-only", () => {
  assert.deepEqual(eventRoutes.discovery_call_booking_scheduled, {
    customerio: true,
    meta: true,
    posthog: true,
  })
  assert.deepEqual(eventRoutes.discovery_call_quiz_viewed, {
    customerio: false,
    meta: false,
    posthog: true,
  })
})

test("booking-scheduled fires the Meta Schedule standard event with its dedupe id", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  assert.equal(
    trackMetaBookingScheduled("booking-event-1", "discovery_call_v1", { win: dom.win }),
    true,
  )
  assert.deepEqual(dom.calls, [
    [
      "track",
      "Schedule",
      { content_name: "discovery_call_booking" },
      { eventID: "booking-event-1" },
    ],
  ])
})

test("the Meta destination maps booking-scheduled through the funnel-package resolver", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.win })
  try {
    dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)
    assert.equal(
      metaDestination.track("discovery_call_booking_scheduled", {
        funnelEventId: "booking-event-2",
        funnelPackageKey: "discovery_call_v1",
        funnelSessionId: "session-1",
        testKind: null,
        leadId: "lead-1",
        offerVariant: "discovery-call-v1",
      }),
      true,
    )
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
    else Reflect.deleteProperty(globalThis, "window")
  }

  assert.deepEqual(dom.calls, [
    [
      "track",
      "Schedule",
      { content_name: "discovery_call_booking" },
      { eventID: "booking-event-2" },
    ],
  ])
})

test("the Customer.io destination carries the booking's lead and funnel identity", () => {
  const calls: Array<{ eventName: string; properties?: Record<string, unknown> }> = []
  setCustomerIoBrowserClient({
    identify: () => undefined,
    page: () => undefined,
    track: (eventName: string, properties?: Record<string, unknown>) => {
      calls.push({ eventName, properties })
    },
  } as never)
  try {
    assert.equal(
      customerIoDestination.track("discovery_call_booking_scheduled", {
        funnelEventId: "booking-event-3",
        funnelPackageKey: "discovery_call_v1",
        funnelSessionId: "session-2",
        testKind: null,
        leadId: "lead-2",
        offerVariant: "discovery-call-v1",
      }),
      true,
    )
  } finally {
    clearCustomerIoBrowserClient()
  }

  assert.deepEqual(calls, [
    {
      eventName: "discovery_call_booking_scheduled",
      properties: {
        lead_id: "lead-2",
        offer_variant: "discovery-call-v1",
        funnel_event_id: "booking-event-3",
        funnel_session_id: "session-2",
        funnel_package_key: "discovery_call_v1",
      },
    },
  ])
})

test("the quiz-entry snapshot emits for the discovery-call package under its own event name", async () => {
  assert.equal(quizViewEventForPackage("scan_v1"), "scanner_quiz_viewed")
  assert.equal(quizViewEventForPackage("discovery_call_v1"), "discovery_call_quiz_viewed")
  assert.equal(quizViewEventForPackage("default_organic"), null)
  assert.equal(quizViewEventForPackage(null), null)

  const events: Array<{ eventName: string; payload: unknown }> = []
  const tracker = createScannerQuizViewTracker({
    bootstrap: async () => ({
      entryPath: "/lp/call",
      funnelPackageKey: "discovery_call_v1",
      funnelSessionId: "session-3",
      utmSource: "meta",
    }),
    createId: () => "view-call-1",
    now: () => "2026-09-22T10:00:00.000Z",
    track: ((eventName: string, payload: unknown) => events.push({ eventName, payload })) as never,
  })
  tracker({ displayedFunnelPackageKey: "discovery_call_v1", step: 2, resumed: false })
  await Promise.resolve()

  assert.deepEqual(events, [
    {
      eventName: "discovery_call_quiz_viewed",
      payload: {
        entryPath: "/lp/call",
        funnelEventId: "view-call-1",
        funnelPackageKey: "discovery_call_v1",
        funnelSessionId: "session-3",
        isResumed: false,
        quizStep: 2,
        quizViewId: "view-call-1",
        scannerTrackingVersion: 1,
        utmSource: "meta",
        viewedAt: "2026-09-22T10:00:00.000Z",
      },
    },
  ])
})

test("a scanner context resolving under a discovery mount never emits", async () => {
  const events: unknown[] = []
  createScannerQuizViewTracker({
    bootstrap: async () => ({ funnelPackageKey: "scan_v1", funnelSessionId: "session-4" }),
    track: ((_: string, payload: unknown) => events.push(payload)) as never,
  })({ displayedFunnelPackageKey: "discovery_call_v1", step: 2, resumed: false })
  await Promise.resolve()
  assert.deepEqual(events, [])
})
