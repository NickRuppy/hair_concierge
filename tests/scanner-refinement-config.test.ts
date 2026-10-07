import assert from "node:assert/strict"
import test from "node:test"
import { isScannerFunnelRefinementEnabled } from "../src/lib/funnel/scanner-refinement"

test("scanner refinement stays off unless the owner explicitly enables it", () => {
  const previous = process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED
  try {
    for (const value of [undefined, "", "false", "1", "TRUE"]) {
      if (value === undefined) delete process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED
      else process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED = value
      assert.equal(isScannerFunnelRefinementEnabled(), false)
    }
    process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED = "true"
    assert.equal(isScannerFunnelRefinementEnabled(), true)
  } finally {
    if (previous === undefined) delete process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED
    else process.env.SCANNER_FUNNEL_REFINEMENT_ENABLED = previous
  }
})
