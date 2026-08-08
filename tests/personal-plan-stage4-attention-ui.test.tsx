import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"

import { RoutineAttentionIndicator } from "../src/components/routine/personal-plan/routine-attention-indicator"

test("renders an accessible, layout-independent dot only for a pending Routine proposal", () => {
  const pending = renderToStaticMarkup(<RoutineAttentionIndicator hasPendingProposal />)
  const clear = renderToStaticMarkup(<RoutineAttentionIndicator hasPendingProposal={false} />)

  assert.match(pending, /Routine hat Änderungen zur Prüfung/)
  assert.match(pending, /bg-red-500/)
  assert.match(pending, /absolute/)
  assert.equal(clear, "")
})
