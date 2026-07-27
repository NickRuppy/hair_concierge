import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import test from "node:test"

import {
  MODAL_LAYER_PRIORITIES,
  registerModalLayer,
  resetModalLayerManagerForTests,
} from "../src/lib/ui/modal-layer-manager"

class FakeStyle {
  left = ""
  overflow = ""
  position = ""
  right = ""
  top = ""
  width = ""
}

class FakeElement {
  readonly children: FakeElement[] = []
  readonly style = new FakeStyle()
  readonly attributes = new Map<string, string>()
  inert = false
  parentElement: FakeElement | null = null
  tabIndex = 0

  constructor(readonly name: string) {}

  appendChild(child: FakeElement) {
    child.parentElement = this
    this.children.push(child)
  }

  contains(candidate: FakeElement): boolean {
    if (candidate === this) return true
    return this.children.some((child) => child.contains(candidate))
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  hasAttribute(name: string) {
    return this.attributes.has(name)
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  querySelectorAll() {
    return []
  }

  matches() {
    return false
  }

  closest() {
    return null
  }

  getClientRects() {
    return [{ width: 1, height: 1 }]
  }

  focus() {
    fakeDocument.activeElement = this
  }
}

let scrollToCalls: Array<[number, number]> = []
let fakeDocument: { activeElement: FakeElement | null; body: FakeElement }
const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document")
const originalHTMLElementDescriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement")
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window")

function installFakeDom(scrollX = 12, scrollY = 345) {
  scrollToCalls = []
  fakeDocument = { activeElement: null, body: new FakeElement("body") }

  Object.defineProperty(globalThis, "HTMLElement", {
    configurable: true,
    value: FakeElement,
  })
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: fakeDocument,
  })
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      getComputedStyle: () => ({ display: "block", visibility: "visible" }),
      scrollTo: (x: number, y: number) => {
        scrollToCalls.push([x, y])
      },
      scrollX,
      scrollY,
    },
  })

  resetModalLayerManagerForTests()

  return fakeDocument
}

function appendToBody(...elements: FakeElement[]) {
  for (const element of elements) fakeDocument.body.appendChild(element)
}

function modalRoot(element: FakeElement) {
  return element as unknown as HTMLElement
}

test.afterEach(() => {
  resetModalLayerManagerForTests()
  restoreGlobalDescriptor("document", originalDocumentDescriptor)
  restoreGlobalDescriptor("HTMLElement", originalHTMLElementDescriptor)
  restoreGlobalDescriptor("window", originalWindowDescriptor)
})

function restoreGlobalDescriptor(
  key: "document" | "HTMLElement" | "window",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(globalThis, key, descriptor)
  } else {
    Reflect.deleteProperty(globalThis, key)
  }
}

test("locks body on first layer and restores exact scroll on final release", () => {
  const document = installFakeDom(20, 640)
  const appRoot = new FakeElement("app")
  const sheetRoot = new FakeElement("sheet")
  appendToBody(appRoot, sheetRoot)

  const sheet = registerModalLayer({ root: modalRoot(sheetRoot) })

  assert.equal(document.body.style.position, "fixed")
  assert.equal(document.body.style.top, "-640px")
  assert.equal(document.body.style.left, "-20px")
  assert.equal(document.body.style.right, "0")
  assert.equal(document.body.style.width, "100%")
  assert.equal(document.body.style.overflow, "hidden")
  assert.equal(appRoot.getAttribute("aria-hidden"), "true")
  assert.equal(appRoot.inert, true)
  assert.equal(sheetRoot.getAttribute("aria-hidden"), null)

  sheet.release()

  assert.equal(document.body.style.position, "")
  assert.equal(document.body.style.top, "")
  assert.equal(document.body.style.left, "")
  assert.equal(document.body.style.right, "")
  assert.equal(document.body.style.width, "")
  assert.equal(document.body.style.overflow, "")
  assert.deepEqual(scrollToCalls, [[20, 640]])
  assert.equal(appRoot.getAttribute("aria-hidden"), null)
  assert.equal(appRoot.inert, false)
})

test("uses priority and registration order to isolate only the top layer", () => {
  installFakeDom()
  const appRoot = new FakeElement("app")
  const sheetRoot = new FakeElement("sheet")
  const dialogRoot = new FakeElement("dialog")
  appendToBody(appRoot, sheetRoot, dialogRoot)

  const sheetStates: boolean[] = []
  const dialogStates: boolean[] = []
  const sheet = registerModalLayer({
    root: modalRoot(sheetRoot),
    priority: MODAL_LAYER_PRIORITIES.bottomSheet,
    onTopLayerChange: (isTopLayer) => sheetStates.push(isTopLayer),
  })
  const dialog = registerModalLayer({
    root: modalRoot(dialogRoot),
    priority: MODAL_LAYER_PRIORITIES.dialog,
    onTopLayerChange: (isTopLayer) => dialogStates.push(isTopLayer),
  })

  assert.equal(sheet.isTopLayer(), false)
  assert.equal(dialog.isTopLayer(), true)
  assert.deepEqual(sheetStates, [true, false])
  assert.deepEqual(dialogStates, [true])
  assert.equal(sheetRoot.getAttribute("aria-hidden"), "true")
  assert.equal(sheetRoot.inert, true)
  assert.equal(dialogRoot.getAttribute("aria-hidden"), null)

  dialog.release()

  assert.equal(sheet.isTopLayer(), true)
  assert.deepEqual(sheetStates, [true, false, true])
  assert.equal(sheetRoot.getAttribute("aria-hidden"), null)
  assert.equal(sheetRoot.inert, false)
  assert.equal(appRoot.getAttribute("aria-hidden"), "true")

  sheet.release()
})

test("keeps the body locked while a nested layer releases", () => {
  const document = installFakeDom(0, 222)
  const appRoot = new FakeElement("app")
  const sheetRoot = new FakeElement("sheet")
  const dialogRoot = new FakeElement("dialog")
  appendToBody(appRoot, sheetRoot, dialogRoot)

  const sheet = registerModalLayer({ root: modalRoot(sheetRoot) })
  const dialog = registerModalLayer({
    root: modalRoot(dialogRoot),
    priority: MODAL_LAYER_PRIORITIES.dialog,
  })

  dialog.release()

  assert.equal(document.body.style.position, "fixed")
  assert.deepEqual(scrollToCalls, [])

  sheet.release()

  assert.equal(document.body.style.position, "")
  assert.deepEqual(scrollToCalls, [[0, 222]])
})

test("restores original inert and aria-hidden attributes", () => {
  installFakeDom()
  const appRoot = new FakeElement("app")
  appRoot.setAttribute("aria-hidden", "legacy")
  appRoot.setAttribute("inert", "")
  appRoot.inert = true
  const sheetRoot = new FakeElement("sheet")
  appendToBody(appRoot, sheetRoot)

  const sheet = registerModalLayer({ root: modalRoot(sheetRoot) })
  assert.equal(appRoot.getAttribute("aria-hidden"), "true")

  sheet.release()

  assert.equal(appRoot.getAttribute("aria-hidden"), "legacy")
  assert.equal(appRoot.hasAttribute("inert"), true)
  assert.equal(appRoot.inert, true)
})

test("keeps exempt live feedback surfaces interactive above modal layers", () => {
  installFakeDom()
  const appRoot = new FakeElement("app")
  const toastRoot = new FakeElement("toasts")
  toastRoot.setAttribute("data-modal-layer-exempt", "")
  const sheetRoot = new FakeElement("sheet")
  appendToBody(appRoot, toastRoot, sheetRoot)

  const sheet = registerModalLayer({ root: modalRoot(sheetRoot) })

  assert.equal(appRoot.inert, true)
  assert.equal(toastRoot.inert, false)
  assert.equal(toastRoot.getAttribute("aria-hidden"), null)

  sheet.release()
})

test("uses newest registration when priorities match", () => {
  installFakeDom()
  const appRoot = new FakeElement("app")
  const firstRoot = new FakeElement("first")
  const secondRoot = new FakeElement("second")
  appendToBody(appRoot, firstRoot, secondRoot)

  const first = registerModalLayer({ root: modalRoot(firstRoot), priority: 50 })
  const second = registerModalLayer({ root: modalRoot(secondRoot), priority: 50 })

  assert.equal(first.isTopLayer(), false)
  assert.equal(second.isTopLayer(), true)
  assert.equal(firstRoot.getAttribute("aria-hidden"), "true")

  second.release()

  assert.equal(first.isTopLayer(), true)
  assert.equal(firstRoot.getAttribute("aria-hidden"), null)

  first.release()
})

test("bottom sheet and dialog primitives use the shared top-layer manager", () => {
  const bottomSheetSource = readFileSync(
    new URL("../src/components/ui/bottom-sheet.tsx", import.meta.url),
    "utf8",
  )
  const dialogSource = readFileSync(
    new URL("../src/components/ui/dialog.tsx", import.meta.url),
    "utf8",
  )

  assert.match(bottomSheetSource, /registerModalLayer/)
  assert.match(bottomSheetSource, /MODAL_LAYER_PRIORITIES\.bottomSheet/)
  assert.match(bottomSheetSource, /disableDrag/)
  assert.match(bottomSheetSource, /isTopLayer/)
  assert.match(bottomSheetSource, /restoreFocusRef\?: React\.RefObject<HTMLElement \| null>/)
  assert.match(bottomSheetSource, /requestedTarget\?\.isConnected === false/)
  assert.match(bottomSheetSource, /requestedTarget \?\? previousFocusRef\.current/)
  assert.doesNotMatch(bottomSheetSource, /document\.body\.style\.overflow/)

  assert.match(dialogSource, /registerModalLayer/)
  assert.match(dialogSource, /MODAL_LAYER_PRIORITIES\.dialog/)
  assert.match(dialogSource, /role="dialog"/)
  assert.match(dialogSource, /aria-modal="true"/)
  assert.match(dialogSource, /aria-labelledby=\{titleId\}/)
  assert.match(dialogSource, /isTopLayer/)
  assert.doesNotMatch(dialogSource, /document\.body\.style\.overflow/)
})

test("modal manager observes newly inserted body siblings while a layer is active", () => {
  const managerSource = readFileSync(
    new URL("../src/lib/ui/modal-layer-manager.ts", import.meta.url),
    "utf8",
  )

  assert.match(managerSource, /new MutationObserver/)
  assert.match(managerSource, /observe\(document\.body, \{ childList: true \}\)/)
  assert.match(managerSource, /releaseBodyChildrenObserver\(\)/)
})

test("existing dialog consumers provide the title required by the shared aria label", () => {
  for (const path of [
    "../src/components/checkout/active-subscription-dialog.tsx",
    "../src/components/cookie-consent/cookie-consent.tsx",
    "../src/components/feedback/feedback-widget.tsx",
  ]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8")
    assert.match(source, /<DialogTitle/)
  }
})

test("toast viewport remains portaled and exempt from modal background isolation", () => {
  const source = readFileSync(
    new URL("../src/providers/toast-provider.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /createPortal/)
  assert.match(source, /data-modal-layer-exempt/)
  assert.match(source, /z-\[130\]/)
})
