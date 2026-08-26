import assert from "node:assert/strict"
import test from "node:test"

import {
  ROUTINE_PLAN_UPDATED_PARAM,
  hasRoutinePlanUpdatedSignal,
  withoutRoutinePlanUpdatedSignal,
  withRoutinePlanUpdatedSignal,
} from "../src/lib/personal-plan/routine/plan-updated-signal"

test("withRoutinePlanUpdatedSignal appends the signal to a bare path", () => {
  assert.equal(withRoutinePlanUpdatedSignal("/routine"), "/routine?planUpdated=1")
  assert.equal(ROUTINE_PLAN_UPDATED_PARAM, "planUpdated")
})

test("withRoutinePlanUpdatedSignal preserves an existing query string", () => {
  assert.equal(withRoutinePlanUpdatedSignal("/routine?foo=bar"), "/routine?foo=bar&planUpdated=1")
})

test("hasRoutinePlanUpdatedSignal reads the param from a URLSearchParams-like object", () => {
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("planUpdated=1")), true)
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("")), false)
  // Any other value is not the signal — only the exact "1" the writer emits.
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("planUpdated=0")), false)
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams("planUpdated=true")), false)
})

test("round-trips through a real href", () => {
  const href = withRoutinePlanUpdatedSignal("/routine")
  const [, query] = href.split("?")
  assert.equal(hasRoutinePlanUpdatedSignal(new URLSearchParams(query)), true)
})

test("withoutRoutinePlanUpdatedSignal strips only the signal, keeping other params (consume-once half)", () => {
  assert.equal(
    withoutRoutinePlanUpdatedSignal("/routine", new URLSearchParams("planUpdated=1")),
    "/routine",
  )
  assert.equal(
    withoutRoutinePlanUpdatedSignal("/routine", new URLSearchParams("foo=bar&planUpdated=1")),
    "/routine?foo=bar",
  )
})

test("consume-once: reading the signal, stripping it, then reading again from the stripped URL never re-signals", () => {
  const initial = new URLSearchParams("planUpdated=1")
  assert.equal(hasRoutinePlanUpdatedSignal(initial), true)

  const strippedHref = withoutRoutinePlanUpdatedSignal("/routine", initial)
  assert.equal(strippedHref, "/routine")

  // Simulates a reload/remount reading the URL the browser is now at.
  const [, query = ""] = strippedHref.split("?")
  const afterReload = new URLSearchParams(query)
  assert.equal(hasRoutinePlanUpdatedSignal(afterReload), false)
})
