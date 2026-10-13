import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ScanResultCard } from "../src/components/scan/scan-result-card"

import { SCAN_RESULT_CARD_PARITY_CASES } from "./scan-result-card.fixtures"

/**
 * Rendered DOM contract for the web scanner's full and masked verdict states.
 * fit-verdict spec §1/§7b, ruled 2026-10-12: the intentional label, reason-line and
 * footer changes replace the extraction's historical golden. Geometry and all other
 * sheet behavior remain covered by the complete rendered snapshots.
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
