import assert from "node:assert/strict"
import test from "node:test"

import {
  initMetaPixel,
  isMetaPixelReady,
  grantMetaPixelConsent,
  revokeMetaPixelConsent,
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
    insertedScripts,
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
    } as unknown as Window & { fbq?: (...args: unknown[]) => void },
    doc,
  }
}

test("initMetaPixel injects fbevents and initializes the configured pixel once", () => {
  const dom = createMetaDom()

  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  assert.equal(isMetaPixelReady({ win: dom.win }), true)

  const fbq = dom.win.fbq as ((...args: unknown[]) => void) & { queue?: unknown[][] }
  assert.deepEqual(fbq.queue, [["init", "988892550357504"]])

  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })

  assert.equal(dom.insertedScripts.length, 1)
  assert.equal(dom.insertedScripts[0].async, true)
  assert.equal(dom.insertedScripts[0].src, "https://connect.facebook.net/en_US/fbevents.js")
  assert.deepEqual(dom.calls, [])
})

test("track helpers dispatch standard, custom, and page view events after initialization", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })

  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)
  grantMetaPixelConsent({ win: dom.win })

  assert.equal(trackMetaPageView({ win: dom.win }), true)
  assert.equal(trackMetaEvent("Lead", { content_name: "quiz" }, { win: dom.win }), true)
  assert.equal(trackMetaCustomEvent("QuizStarted", { step: 1 }, { win: dom.win }), true)

  assert.deepEqual(dom.calls, [
    ["consent", "grant"],
    ["track", "PageView"],
    ["track", "Lead", { content_name: "quiz" }],
    ["trackCustom", "QuizStarted", { step: 1 }],
  ])
})

test("standard events tracked before init and consent flush after both are ready", () => {
  const dom = createMetaDom()

  assert.equal(
    trackMetaEvent("ViewContent", { content_name: "pricing_page" }, { win: dom.win }),
    true,
  )
  assert.deepEqual(dom.calls, [])

  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  assert.deepEqual(dom.calls, [])
  assert.equal(grantMetaPixelConsent({ win: dom.win }), true)

  assert.deepEqual(dom.calls, [
    ["consent", "grant"],
    ["track", "ViewContent", { content_name: "pricing_page" }],
  ])
})

test("meta tracking stops after consent revoke and resumes after consent grant", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  grantMetaPixelConsent({ win: dom.win })
  assert.equal(trackMetaEvent("Lead", { content_name: "first" }, { win: dom.win }), true)

  assert.equal(revokeMetaPixelConsent({ win: dom.win }), true)
  assert.equal(trackMetaEvent("Lead", { content_name: "revoked" }, { win: dom.win }), false)

  assert.equal(grantMetaPixelConsent({ win: dom.win }), true)
  assert.equal(trackMetaEvent("Lead", { content_name: "second" }, { win: dom.win }), true)

  assert.deepEqual(dom.calls, [
    ["consent", "grant"],
    ["track", "Lead", { content_name: "first" }],
    ["consent", "revoke"],
    ["consent", "grant"],
    ["track", "Lead", { content_name: "second" }],
  ])
})

test("queued standard events are discarded after explicit consent revoke", () => {
  const dom = createMetaDom()

  assert.equal(
    trackMetaEvent("ViewContent", { content_name: "pricing_page" }, { win: dom.win }),
    true,
  )
  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  assert.equal(revokeMetaPixelConsent({ win: dom.win }), true)
  assert.equal(trackMetaEvent("Lead", { content_name: "after_revoke" }, { win: dom.win }), false)
  assert.equal(grantMetaPixelConsent({ win: dom.win }), true)

  assert.deepEqual(dom.calls, [
    ["consent", "revoke"],
    ["consent", "grant"],
  ])
})

test("subscription confirmation does not queue or dedupe before consent is usable", () => {
  const dom = createMetaDom()

  assert.equal(trackMetaSubscriptionConfirmed("cs_pending_subscription", { win: dom.win }), false)
  assert.equal(initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc }), true)
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)
  assert.equal(grantMetaPixelConsent({ win: dom.win }), true)

  assert.equal(trackMetaSubscriptionConfirmed("cs_pending_subscription", { win: dom.win }), true)
  assert.equal(trackMetaSubscriptionConfirmed("cs_pending_subscription", { win: dom.win }), false)

  assert.deepEqual(dom.calls, [
    ["consent", "grant"],
    ["track", "Subscribe", { content_name: "premium_subscription" }],
  ])
})

test("meta tracking does nothing without a pixel id or initialized fbq", () => {
  const dom = createMetaDom()

  assert.equal(initMetaPixel({ pixelId: "", win: dom.win, doc: dom.doc }), false)
  assert.equal(trackMetaEvent("Lead", undefined), false)
  assert.equal(trackMetaCustomEvent("QuizStarted", undefined, { win: dom.win }), false)
  assert.equal(trackMetaPageView(), false)
  assert.equal(dom.insertedScripts.length, 0)
})

test("purchase tracking fires with value metadata and event id even without consent", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  assert.equal(
    trackMetaPurchaseConfirmed(
      {
        contentId: "premium_quarter",
        currency: "EUR",
        eventId: "cs_test_purchase",
        interval: "quarter",
        paymentMethodType: "card",
        value: 34.99,
      },
      { doc: dom.doc, win: dom.win },
    ),
    true,
  )

  assert.deepEqual(dom.calls, [
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
        value: 34.99,
      },
      { eventID: "cs_test_purchase" },
    ],
    ["consent", "revoke"],
  ])
})

test("purchase tracking dedupes the same checkout session in browser storage", () => {
  const dom = createMetaDom()
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)

  const purchase = {
    contentId: "premium_month",
    currency: "EUR",
    eventId: "cs_test_dedupe",
    interval: "month",
    value: 14.99,
  } as const

  assert.equal(trackMetaPurchaseConfirmed(purchase, { doc: dom.doc, win: dom.win }), true)
  assert.equal(trackMetaPurchaseConfirmed(purchase, { doc: dom.doc, win: dom.win }), false)

  assert.equal(dom.calls.filter((call) => call[1] === "Purchase").length, 1)
})

test("subscription and purchase tracking remain best-effort when session storage throws", () => {
  const dom = createMetaDom({ storageThrows: true })
  initMetaPixel({ pixelId: "988892550357504", win: dom.win, doc: dom.doc })
  dom.win.fbq = (...args: unknown[]) => dom.calls.push(args)
  grantMetaPixelConsent({ win: dom.win })

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

  assert.equal(dom.calls.filter((call) => call[1] === "Subscribe").length, 1)
  assert.equal(dom.calls.filter((call) => call[1] === "Purchase").length, 1)
})
