import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("quiz card hover styles only apply on hover-capable pointers", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8")

  const hoverMedia = "@media (hover: hover) and (pointer: fine)"
  const mediaIndex = css.indexOf(hoverMedia)
  const hoverIndex = css.indexOf(".quiz-card:hover")

  assert.notEqual(mediaIndex, -1)
  assert.notEqual(hoverIndex, -1)
  assert.ok(hoverIndex > mediaIndex)
})
