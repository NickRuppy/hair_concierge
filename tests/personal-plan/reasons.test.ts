import assert from "node:assert/strict"
import test from "node:test"

import { normalizeReasonSalience } from "../../src/lib/personal-plan/reasons"
import type { PlanReasonFact } from "../../src/lib/personal-plan/types"

const reason = (id: string, salience: PlanReasonFact["salience"]): PlanReasonFact => ({
  id,
  salience,
  evidence: [{ source: "quiz", key: id }],
  values: {},
})

test("reason salience keeps no more than two primary facts without dropping detail", () => {
  assert.deepEqual(
    normalizeReasonSalience([
      reason("first", "primary"),
      reason("second", "primary"),
      reason("third", "primary"),
      reason("detail", "detail"),
    ]),
    [
      reason("first", "primary"),
      reason("second", "primary"),
      reason("third", "secondary"),
      reason("detail", "detail"),
    ],
  )
})

test("reason normalization is stable and removes duplicate IDs", () => {
  assert.deepEqual(
    normalizeReasonSalience([
      reason("same", "secondary"),
      reason("same", "primary"),
      reason("other", "primary"),
    ]),
    [reason("same", "secondary"), reason("other", "primary")],
  )
})
