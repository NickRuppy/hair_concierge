import assert from "node:assert/strict"
import test from "node:test"
import { renderToStaticMarkup } from "react-dom/server"

import DiscoveryChecklistLoading from "../src/app/beratung/produkte/loading"
import { DiscoveryProductsScreen } from "../src/components/discovery/intake/discovery-products-screen"

/**
 * Batch 8, plan item 3: `/beratung/produkte` gets a loading boundary that IS the empty
 * products screen, so the quiz → checklist hand-off lands on the finished layout. Pinned
 * against the real screen rendered with no items: same text in the same order, the same
 * layout classes — only without interactive controls.
 */

const textSequence = (html: string) =>
  html
    .replace(/<[^>]+>/g, "|")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)

const classes = (html: string) => [...html.matchAll(/class="([^"]*)"/g)].map((m) => m[1])

function realEmptyScreen() {
  const noop = () => {}
  return renderToStaticMarkup(
    <DiscoveryProductsScreen
      items={[]}
      busy={false}
      error={null}
      cameraBlocked={false}
      landedItemId={null}
      onSearch={noop}
      onScan={noop}
      onEdit={noop}
      onFrequency={noop}
      onRemove={noop}
      onContinue={noop}
    />,
  )
}

test("the loading screen reads exactly like the empty products screen", () => {
  const loading = renderToStaticMarkup(<DiscoveryChecklistLoading />)
  assert.deepEqual(textSequence(loading), textSequence(realEmptyScreen()))
  assert.deepEqual(textSequence(loading).slice(0, 3), [
    "Deine Produkte",
    "Produkt suchen",
    "Scannen",
  ])
})

test("the loading screen reuses the real screen's layout classes and has no controls", () => {
  const loading = renderToStaticMarkup(<DiscoveryChecklistLoading />)
  const realClasses = new Set(classes(realEmptyScreen()))
  for (const layoutClass of [
    "flex min-h-dvh flex-col bg-[#faf8f6]",
    "flex-1 px-4 pb-8 pt-10",
    "grid grid-cols-2 gap-2.5 [grid-auto-flow:row_dense]",
  ]) {
    assert.ok(realClasses.has(layoutClass), `real screen still uses ${layoutClass}`)
    assert.ok(classes(loading).includes(layoutClass), `loading uses ${layoutClass}`)
  }
  assert.doesNotMatch(loading, /<button|<input/)
  assert.match(loading, /aria-busy="true"/)
})
