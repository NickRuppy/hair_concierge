import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { resolveBottomSheetFocusAction } from "../src/components/ui/bottom-sheet"

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
