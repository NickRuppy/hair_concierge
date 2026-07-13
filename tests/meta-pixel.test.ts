import assert from "node:assert/strict"
import test from "node:test"

import {
  initMetaPixel,
  isMetaPixelReady,
  trackMetaCustomEvent,
  trackMetaEvent,
  trackMetaPageView,
  trackMetaPurchaseConfirmed,
  trackMetaSubscriptionConfirmed,
} from "../src/lib/meta-pixel"

function createMetaDom(options: { storageThrows?: boolean } = {}) {
  const calls: unknown[][] = []
  const insertedScripts: Array<{ async?: boolean; id?: string; src?: string }> = []
  const storage = new Map<string, string>()
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
    insertedScripts,
    storage,
    win: {
      sessionStorage: {
        getItem: (key: string) => {
          if (options.storageThrows) throw new Error("storage unavailable")
          return storage.get(key) ?? null
        },
        setItem: (key: string, value: string) => {
          if (options.storageThrows) throw new Error("storage unavailable")
          storage.set(key, value)
        },
      },
    } as unknown as Window & { fbq?: ((...args: unknown[]) => void) & { queue?: unknown[][] } },
  }
}

test("initMetaPixel injects fbevents and initializes the configured pixel once", () => {
  const dom = createMetaDom()

  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  assert.equal(isMetaPixelReady({ win: dom.win }), true)
  assert.deepEqual(dom.win.fbq?.queue, [["init", "988892550357504"]])

  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })

  assert.equal(dom.insertedScripts.length, 1)
  assert.equal(dom.insertedScripts[0].async, true)
  assert.equal(dom.insertedScripts[0].src, "https://connect.facebook.net/en_US/fbevents.js")
  assert.deepEqual(dom.calls, [])
})

test("page, standard, and custom events queue before readiness and flush in FIFO order", () => {
  const dom = createMetaDom()

  assert.equal(trackMetaPageView({ win: dom.win }), true)
  assert.equal(
    trackMetaEvent("Lead", { content_name: "quiz" }, { eventID: "lead-1", win: dom.win }),
    true,
  )
  assert.equal(
    trackMetaCustomEvent("QuizStarted", { step: 1 }, { eventID: "quiz-1", win: dom.win }),
    true,
  )

  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  assert.deepEqual(dom.win.fbq?.queue, [
    ["init", "988892550357504"],
    ["track", "PageView"],
    ["track", "Lead", { content_name: "quiz" }, { eventID: "lead-1" }],
    ["trackCustom", "QuizStarted", { step: 1 }, { eventID: "quiz-1" }],
  ])
})

test("events dispatch immediately after initialization without consent commands", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  assert.equal(trackMetaPageView({ win: dom.win }), true)
  assert.equal(trackMetaEvent("Lead", { content_name: "quiz" }, { win: dom.win }), true)
  assert.equal(trackMetaCustomEvent("QuizStarted", { step: 1 }, { win: dom.win }), true)

  assert.deepEqual(dom.calls, [
    ["track", "PageView"],
    ["track", "Lead", { content_name: "quiz" }],
    ["trackCustom", "QuizStarted", { step: 1 }],
  ])
})

test("subscription queues once and writes its marker only after actual dispatch", () => {
  const dom = createMetaDom()
  const storageKey = "chaarlie_meta_subscribe_tracked:cs_pending_subscription"

  assert.equal(trackMetaSubscriptionConfirmed("cs_pending_subscription", { win: dom.win }), true)
  assert.equal(trackMetaSubscriptionConfirmed("cs_pending_subscription", { win: dom.win }), false)
  assert.equal(dom.storage.get(storageKey), undefined)

  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  assert.equal(dom.storage.get(storageKey), "1")
  assert.equal(trackMetaSubscriptionConfirmed("cs_pending_subscription", { win: dom.win }), false)
  assert.deepEqual(dom.win.fbq?.queue, [
    ["init", "988892550357504"],
    ["track", "Subscribe", { content_name: "premium_subscription" }],
  ])
})

test("purchase immediately initializes Meta and flushes Subscribe before Purchase", () => {
  const dom = createMetaDom()

  assert.equal(trackMetaSubscriptionConfirmed("cs_checkout", { win: dom.win }), true)
  assert.equal(
    trackMetaPurchaseConfirmed(
      {
        contentId: "premium_quarter",
        currency: "EUR",
        eventId: "cs_checkout",
        interval: "quarter",
        paymentMethodType: "card",
        value: 34.99,
      },
      { doc: dom.doc, win: dom.win },
    ),
    true,
  )

  assert.deepEqual(dom.win.fbq?.queue, [
    ["init", "988892550357504"],
    ["track", "Subscribe", { content_name: "premium_subscription" }],
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
      { eventID: "cs_checkout" },
    ],
  ])
  assert.equal(dom.storage.get("chaarlie_meta_subscribe_tracked:cs_checkout"), "1")
  assert.equal(dom.storage.get("chaarlie_meta_purchase_tracked:cs_checkout"), "1")
})

test("purchase tracking dedupes the same checkout session", () => {
  const dom = createMetaDom()
  const purchase = {
    contentId: "premium_month",
    currency: "EUR",
    eventId: "cs_test_dedupe",
    interval: "month",
    value: 14.99,
  } as const

  assert.equal(trackMetaPurchaseConfirmed(purchase, { doc: dom.doc, win: dom.win }), true)
  assert.equal(trackMetaPurchaseConfirmed(purchase, { doc: dom.doc, win: dom.win }), false)
  assert.equal(dom.win.fbq?.queue?.filter((call) => call[1] === "Purchase").length, 1)
})

test("tracking remains best effort when session storage throws", () => {
  const dom = createMetaDom({ storageThrows: true })

  assert.equal(trackMetaSubscriptionConfirmed("cs_storage_blocked", { win: dom.win }), true)
  assert.equal(
    trackMetaPurchaseConfirmed(
      {
        contentId: "premium_month",
        currency: "EUR",
        eventId: "cs_storage_blocked",
        interval: "month",
        value: 14.99,
      },
      { doc: dom.doc, win: dom.win },
    ),
    true,
  )

  assert.equal(dom.win.fbq?.queue?.filter((call) => call[1] === "Subscribe").length, 1)
  assert.equal(dom.win.fbq?.queue?.filter((call) => call[1] === "Purchase").length, 1)
})

test("initialization requires a pixel id and browser targets", () => {
  const dom = createMetaDom()

  assert.equal(initMetaPixel({ pixelId: "", win: dom.win, doc: dom.doc }), false)
  assert.equal(trackMetaEvent("Lead", undefined), false)
  assert.equal(trackMetaCustomEvent("QuizStarted", undefined), false)
  assert.equal(trackMetaPageView(), false)
  assert.equal(dom.insertedScripts.length, 0)
})
