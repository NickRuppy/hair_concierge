import assert from "node:assert/strict"
import test from "node:test"

import { bondbuilderTimingFromSnapshot } from "@/lib/personal-plan/products/authority/bondbuilder-timing"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

function snapshotWith(routine: Record<string, unknown>): InitialNeedPlanSnapshot {
  return { profile: { routine } } as unknown as InitialNeedPlanSnapshot
}

test("a stated timing is read from the refined snapshot", () => {
  for (const value of ["before_wash", "after_wash", "no_preference"] as const) {
    assert.equal(
      bondbuilderTimingFromSnapshot(snapshotWith({ bondbuilderTiming: { state: "known", value } })),
      value,
    )
  }
})

test("an initial, pre-S4 or unknown snapshot means „Ist mir egal“", () => {
  assert.equal(bondbuilderTimingFromSnapshot(snapshotWith({})), "no_preference")
  assert.equal(
    bondbuilderTimingFromSnapshot(
      snapshotWith({ bondbuilderTiming: { state: "unknown", reason: "bondbuilder_timing" } }),
    ),
    "no_preference",
  )
  assert.equal(bondbuilderTimingFromSnapshot(null), "no_preference")
  assert.equal(bondbuilderTimingFromSnapshot(undefined), "no_preference")
})
