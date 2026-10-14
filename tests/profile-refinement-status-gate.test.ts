import assert from "node:assert/strict"
import { mock, test } from "node:test"

import {
  REFINEMENT_STATUS_GATE_TIMEOUT_MS,
  armRefinementStatusGate,
} from "../src/lib/profile/refinement-status-gate"

/**
 * The Profil waits for the refinement status before choosing its cards, but never for good: after
 * three seconds the gate opens and today's cards show (fail open).
 */

test("the gate opens after three seconds when the status read has not resolved", () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    let opened = 0
    armRefinementStatusGate(() => (opened += 1))
    assert.equal(REFINEMENT_STATUS_GATE_TIMEOUT_MS, 3_000)
    mock.timers.tick(2_999)
    assert.equal(opened, 0, "still waiting just before the deadline")
    mock.timers.tick(1)
    assert.equal(opened, 1, "opens at the deadline")
  } finally {
    mock.timers.reset()
  }
})

test("a read that settles in time cancels the timer", () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    let opened = 0
    const cancel = armRefinementStatusGate(() => (opened += 1))
    mock.timers.tick(1_000)
    cancel()
    mock.timers.tick(10_000)
    assert.equal(opened, 0)
  } finally {
    mock.timers.reset()
  }
})

test("the profile page arms the gate around the status read and opens it in a finally", async () => {
  const { readFileSync } = await import("node:fs")
  const source = readFileSync("src/app/profile/page.tsx", "utf8")
  assert.match(
    source,
    /armRefinementStatusGate\(\(\) => \{\s*if \(active\) setRefinementStatusSettledKey\(settledKey\)/,
  )
  assert.match(
    source,
    /\} finally \{\s*cancelGate\(\)\s*if \(active\) setRefinementStatusSettledKey\(settledKey\)/,
  )
})
