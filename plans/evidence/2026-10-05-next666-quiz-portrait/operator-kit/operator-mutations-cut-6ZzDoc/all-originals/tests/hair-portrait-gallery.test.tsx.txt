import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import { HairPortraitGallery } from "../src/components/quiz/hair-portrait-gallery"

test("portrait lab keeps the development and Preview guard at the route boundary", () => {
  const source = readFileSync(new URL("../src/app/labs/portrait/page.tsx", import.meta.url), "utf8")

  assert.match(source, /isOfferPageLabEnabled\(process\.env\)/)
  assert.match(source, /notFound\(\)/)
})

test("portrait gallery runs all 20 personalized states plus generic through HairPortrait", () => {
  const html = renderToStaticMarkup(<HairPortraitGallery />)

  assert.equal((html.match(/data-portrait-gallery-cell=/g) ?? []).length, 21)
  assert.match(html, /data-portrait-gallery-cell="straight-very_short"/)
  assert.match(html, /data-portrait-gallery-cell="coily-very_long"/)
  assert.match(html, /data-portrait-gallery-cell="generic"/)
  assert.equal((html.match(/data-portrait-marker=/g) ?? []).length, 63)
  assert.match(html, /Dunklen Grund prüfen/)
  assert.match(html, /data-portrait-diagnostic-background="white"/)
})
