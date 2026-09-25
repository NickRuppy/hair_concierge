import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  resolveBottomSheetFocusAction,
  resolveFocusTrapTarget,
} from "../src/components/ui/bottom-sheet"

/**
 * Batch 8, plan item 9: the sheet places initial focus once per open, never again on a
 * content/step change (that used to land on the close X, with a ring), and shows the X's
 * focus ring only for keyboard focus.
 */

test("initial focus only on the first open", () => {
  assert.equal(
    resolveBottomSheetFocusAction({
      initialFocusDone: false,
      regainedTopLayer: true,
      focusInsidePanel: false,
    }),
    "initial",
  )
})

test("a content or step change inside the open sheet moves focus nowhere", () => {
  for (const focusInsidePanel of [true, false]) {
    assert.equal(
      resolveBottomSheetFocusAction({
        initialFocusDone: true,
        regainedTopLayer: false,
        focusInsidePanel,
      }),
      "none",
    )
  }
})

test("back on top after a nested layer: restore only when focus left the sheet", () => {
  assert.equal(
    resolveBottomSheetFocusAction({
      initialFocusDone: true,
      regainedTopLayer: true,
      focusInsidePanel: false,
    }),
    "restore",
  )
  assert.equal(
    resolveBottomSheetFocusAction({
      initialFocusDone: true,
      regainedTopLayer: true,
      focusInsidePanel: true,
    }),
    "none",
  )
})

test("the close X shows its ring for keyboard focus only", () => {
  const source = readFileSync(
    new URL("../src/components/ui/bottom-sheet.tsx", import.meta.url),
    "utf8",
  )
  const closeButton = source.slice(source.indexOf("ref={closeButtonRef}"))
  const className = closeButton.match(/className="([^"]+)"/)?.[1] ?? ""
  assert.match(className, /focus-visible:ring-2/)
  assert.doesNotMatch(className, /(^|\s)focus:ring/)
})

test("the focus trap wraps from an element outside the tabbable list (tap-open title)", () => {
  const [x, input, done] = ["x", "input", "done"]
  const list = [x, input, done]
  const title = "title (tabindex=-1)"
  assert.equal(resolveFocusTrapTarget(list, title, "backward"), done, "Shift+Tab → last")
  assert.equal(resolveFocusTrapTarget(list, title, "forward"), x, "Tab → first")
  assert.equal(resolveFocusTrapTarget(list, "body", "backward"), done)
  // A close-button-free sheet (e.g. the routine editor's discard sheet): same rule.
  assert.equal(resolveFocusTrapTarget([input, done], title, "backward"), done)
})

test("the focus trap wraps at both ends and leaves the middle to the browser", () => {
  const list = ["a", "b", "c"]
  assert.equal(resolveFocusTrapTarget(list, "a", "backward"), "c")
  assert.equal(resolveFocusTrapTarget(list, "c", "forward"), "a")
  assert.equal(resolveFocusTrapTarget(list, "b", "forward"), null)
  assert.equal(resolveFocusTrapTarget(list, "b", "backward"), null)
  assert.equal(resolveFocusTrapTarget([], "a", "forward"), null)
})
