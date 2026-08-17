import assert from "node:assert/strict"
import test from "node:test"

import {
  computeRoutineRefinementNudgeDismissedUntil,
  ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS,
  shouldShowRoutineRefinementNudge,
} from "../src/lib/personal-plan/routine/nudge"

const NOW = Date.parse("2026-08-16T12:00:00.000Z")

test("nudge stays hidden once the Routine is no longer an unrefined direct accept", () => {
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: false,
      nudgeDismissedUntil: null,
      now: NOW,
    }),
    false,
  )
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: false,
      nudgeDismissedUntil: new Date(NOW - 1).toISOString(),
      now: NOW,
    }),
    false,
  )
})

test("nudge shows for an unrefined direct accept with no prior dismissal", () => {
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: null,
      now: NOW,
    }),
    true,
  )
})

test("nudge stays hidden while now is before the dismissed-until instant", () => {
  const dismissedUntil = new Date(NOW + 60_000).toISOString()
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW,
    }),
    false,
  )
})

test("nudge reappears once now reaches or passes the dismissed-until instant", () => {
  const dismissedUntil = new Date(NOW).toISOString()
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW,
    }),
    true,
  )
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW + 1,
    }),
    true,
  )
})

test("a malformed dismissed-until value is treated as not dismissed", () => {
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: "not-a-date",
      now: NOW,
    }),
    true,
  )
})

test("computeRoutineRefinementNudgeDismissedUntil snoozes exactly one day from the injected clock", () => {
  const dismissedUntil = computeRoutineRefinementNudgeDismissedUntil(NOW)
  assert.equal(Date.parse(dismissedUntil), NOW + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS)
  assert.equal(ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS, 24 * 60 * 60 * 1000)

  // Round-tripping the computed value back through the visibility check
  // reproduces the dismiss/reappear boundary without any real time passing.
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS - 1,
    }),
    false,
  )
  assert.equal(
    shouldShowRoutineRefinementNudge({
      unrefinedDirectAccept: true,
      nudgeDismissedUntil: dismissedUntil,
      now: NOW + ROUTINE_REFINEMENT_NUDGE_SNOOZE_MS,
    }),
    true,
  )
})
