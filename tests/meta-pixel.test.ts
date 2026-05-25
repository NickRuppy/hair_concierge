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
} from "../src/lib/meta-pixel"

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
    insertedScripts,
    win: {} as Window & { fbq?: (...args: unknown[]) => void },
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

test("meta tracking does nothing without a pixel id or initialized fbq", () => {
  const dom = createMetaDom()

  assert.equal(initMetaPixel({ pixelId: "", win: dom.win, doc: dom.doc }), false)
  assert.equal(trackMetaEvent("Lead", undefined, { win: dom.win }), false)
  assert.equal(trackMetaCustomEvent("QuizStarted", undefined, { win: dom.win }), false)
  assert.equal(trackMetaPageView({ win: dom.win }), false)
  assert.equal(dom.insertedScripts.length, 0)
})
