import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ScanResultCard } from "../src/components/scan/scan-result-card"

import { SCAN_RESULT_CARD_PARITY_CASES } from "./scan-result-card.fixtures"

/**
 * Rendered-DOM parity for the `ScanVerdictSections` / `ScanAlternativesList` extraction.
 *
 * The golden file was captured from `ScanResultCard` as it stood BEFORE the extraction
 * (at `0e8d57e3`) and is committed with it. Afterwards, the card composes the two
 * extracted pieces — and every byte of its markup must still match, in every state. A
 * fragment that became a wrapper `div`, a lost class, a reordered section or a dropped
 * attribute all fail here rather than in Nick's hand on the next scan.
 *
 * Regenerating the golden is not a way to make this pass: a diff here means the scan
 * sheet changed, which this branch is not allowed to do. There is deliberately no
 * regeneration script — a re-capture is a one-off, taken from the pre-extraction
 * component and never from the current one: check `src/components/scan/scan-result-card`
 * out at the reference commit, replace the body of `renderCase` below with a loop that
 * writes `{ [name]: renderCase(name) }` for every case to `GOLDEN_PATH`, run this file
 * once, then restore both.
 */

const GOLDEN_PATH = path.join(process.cwd(), "tests/fixtures/scan-result-card-parity.json")

const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as Record<string, string>

const noop = () => {}

function renderCase(caseName: string): string {
  const fixture = SCAN_RESULT_CARD_PARITY_CASES.find((entry) => entry.name === caseName)
  assert.ok(fixture, `unknown parity case ${caseName}`)
  return renderToStaticMarkup(
    <ScanResultCard
      onRescan={noop}
      onOpenAlternative={noop}
      onBuyAlternative={noop}
      onReveal={noop}
      onPremiumAlternatives={noop}
      {...fixture.props}
    />,
  )
}

test("the golden covers every parity case, and every case covers a distinct rendering", () => {
  const names = SCAN_RESULT_CARD_PARITY_CASES.map((entry) => entry.name)
  assert.deepEqual(Object.keys(golden).sort(), [...names].sort())
  // A fixture that renders identically to another one proves nothing, so the branch
  // coverage is asserted rather than assumed.
  const markups = new Set(names.map((name) => golden[name]))
  assert.equal(markups.size, names.length)
})

for (const fixture of SCAN_RESULT_CARD_PARITY_CASES) {
  test(`rendered DOM is unchanged: ${fixture.name}`, () => {
    assert.equal(renderCase(fixture.name), golden[fixture.name])
  })
}
