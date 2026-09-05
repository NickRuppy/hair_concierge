import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_TICK_DELTA_MS,
  advanceLoopClock,
  bumpLoopGeneration,
  createScanLoopController,
  isDetectionCurrent,
  isLoopPaused,
  nextLoopAction,
  setPauseReason,
  type ScanLoopController,
} from "../src/lib/scan/scanner-loop"
import { SCAN_TIMEOUT_MS, createScanSessionState } from "../src/lib/scan/scanner-session"

/** A controller in the state the hook leaves it in once `start()` has succeeded. */
function runningController(): ScanLoopController {
  const controller = createScanLoopController()
  controller.running = true
  return controller
}

/**
 * Stand-in for the browser side of `syncLoop`: applies `nextLoopAction` and tracks how
 * many frame callbacks are outstanding, so the "at most one" invariant is observable.
 */
function createFakeScheduler(controller: ScanLoopController) {
  let outstanding = 0
  let maxOutstanding = 0
  return {
    get outstanding() {
      return outstanding
    },
    get maxOutstanding() {
      return maxOutstanding
    },
    sync() {
      const action = nextLoopAction(controller)
      if (action === "schedule") {
        outstanding += 1
        maxOutstanding = Math.max(maxOutstanding, outstanding)
        controller.frameScheduled = true
      } else if (action === "cancel") {
        outstanding -= 1
        controller.frameScheduled = false
      }
      return action
    },
    /** The scheduled frame fires: the handle is consumed before `tick` runs. */
    deliver() {
      outstanding -= 1
      controller.frameScheduled = false
    },
  }
}

// ---------------------------------------------------------------------------
// Scheduling: exactly one owner, at most one outstanding frame (F10)
// ---------------------------------------------------------------------------

test("createScanLoopController: starts stopped, unpaused and unscheduled", () => {
  const controller = createScanLoopController()

  assert.equal(controller.running, false)
  assert.equal(controller.frameScheduled, false)
  assert.equal(controller.lastTickAt, null)
  assert.equal(controller.pauseReasons.size, 0)
  // Not running yet, so nothing may be scheduled before `start()` succeeds.
  assert.equal(isLoopPaused(controller), true)
  assert.equal(nextLoopAction(controller), "noop")
})

test("nextLoopAction: schedules only when running, unpaused and nothing is outstanding", () => {
  const controller = runningController()
  assert.equal(nextLoopAction(controller), "schedule")

  controller.frameScheduled = true
  assert.equal(nextLoopAction(controller), "noop")

  setPauseReason(controller, "sheet", true)
  assert.equal(nextLoopAction(controller), "cancel")

  controller.frameScheduled = false
  assert.equal(nextLoopAction(controller), "noop")
})

test("nextLoopAction: never lets a second frame become outstanding, however often it is called", () => {
  const controller = runningController()
  const scheduler = createFakeScheduler(controller)

  // Every caller that used to reach for `scheduleFrame()` now calls `syncLoop()`.
  scheduler.sync()
  scheduler.sync()
  scheduler.sync()

  assert.equal(scheduler.outstanding, 1)
  assert.equal(scheduler.maxOutstanding, 1)
})

test("nextLoopAction: pause → unpause → continuation keeps exactly one frame outstanding", () => {
  const controller = runningController()
  const scheduler = createFakeScheduler(controller)

  scheduler.sync()
  assert.equal(scheduler.outstanding, 1)

  // Sheet opens: the outstanding frame is cancelled, and a redundant sync is a no-op.
  setPauseReason(controller, "sheet", true)
  assert.equal(scheduler.sync(), "cancel")
  assert.equal(scheduler.sync(), "noop")
  assert.equal(scheduler.outstanding, 0)

  // Tab hides and comes back while the sheet is still open: still nothing scheduled.
  setPauseReason(controller, "hidden", true)
  scheduler.sync()
  setPauseReason(controller, "hidden", false)
  assert.equal(scheduler.sync(), "noop")
  assert.equal(scheduler.outstanding, 0)

  // Sheet closes: one frame, and the post-detection continuation replaces it 1:1.
  setPauseReason(controller, "sheet", false)
  scheduler.sync()
  assert.equal(scheduler.outstanding, 1)
  scheduler.deliver()
  scheduler.sync()

  assert.equal(scheduler.outstanding, 1)
  assert.equal(scheduler.maxOutstanding, 1)
})

test("setPauseReason: the two reasons are independent and never clear each other", () => {
  const controller = runningController()

  setPauseReason(controller, "hidden", true)
  setPauseReason(controller, "sheet", true)
  setPauseReason(controller, "hidden", false)

  // Closing a sheet in a hidden tab must not restart the loop, and vice versa.
  assert.equal(isLoopPaused(controller), true)
  setPauseReason(controller, "sheet", false)
  assert.equal(isLoopPaused(controller), false)
})

test("setPauseReason: reports whether the pause set actually changed", () => {
  const controller = runningController()

  assert.equal(setPauseReason(controller, "sheet", true), true)
  assert.equal(setPauseReason(controller, "sheet", true), false)
  assert.equal(setPauseReason(controller, "sheet", false), true)
  assert.equal(setPauseReason(controller, "sheet", false), false)
})

test("setPauseReason: a real change bumps the generation and drops the clock anchor", () => {
  const controller = runningController()
  controller.lastTickAt = 1_000
  const generation = controller.generation

  assert.equal(setPauseReason(controller, "hidden", true), true)
  assert.notEqual(controller.generation, generation)
  assert.equal(controller.lastTickAt, null)

  // A no-op call leaves both alone, so redundant prop syncs cannot invalidate a
  // detection that is legitimately in flight.
  const afterChange = controller.generation
  controller.lastTickAt = 2_000
  setPauseReason(controller, "hidden", true)
  assert.equal(controller.generation, afterChange)
  assert.equal(controller.lastTickAt, 2_000)
})

// ---------------------------------------------------------------------------
// Generation guard: a late `detect()` never touches a loop that moved on (F3)
// ---------------------------------------------------------------------------

test("isDetectionCurrent: a detection started before a pause is dropped on arrival", () => {
  const controller = runningController()
  const generation = controller.generation
  assert.equal(isDetectionCurrent(controller, generation), true)

  // The sheet opened while `detect()` was in flight.
  setPauseReason(controller, "sheet", true)

  assert.equal(isDetectionCurrent(controller, generation), false)
  // Even the current generation is not current while the loop is paused: the results
  // describe a frame from before the sheet covered the viewfinder.
  assert.equal(isDetectionCurrent(controller, controller.generation), false)
})

test("isDetectionCurrent: an epoch restart invalidates an in-flight detection", () => {
  const controller = runningController()
  const generation = controller.generation

  bumpLoopGeneration(controller)

  assert.equal(isDetectionCurrent(controller, generation), false)
  assert.equal(isDetectionCurrent(controller, controller.generation), true)
})

test("isDetectionCurrent: a stale continuation after teardown is a no-op", () => {
  const controller = runningController()
  const scheduler = createFakeScheduler(controller)
  scheduler.sync()
  const generation = controller.generation

  // Teardown: `active` went false or the component unmounted.
  controller.running = false
  bumpLoopGeneration(controller)

  assert.equal(isDetectionCurrent(controller, generation), false)
  assert.equal(isDetectionCurrent(controller, controller.generation), false)
  // The continuation's `syncLoop()` cancels rather than re-arming the loop.
  assert.equal(scheduler.sync(), "cancel")
  assert.equal(scheduler.sync(), "noop")
  assert.equal(scheduler.outstanding, 0)
})

// ---------------------------------------------------------------------------
// Active clock: the 3s fallback measures scanning time, not wall time (F2)
// ---------------------------------------------------------------------------

test("advanceLoopClock: the first tick anchors the clock without accruing anything", () => {
  const controller = runningController()
  const session = createScanSessionState()

  assert.equal(advanceLoopClock(controller, session, 1_000).timedOut, false)

  assert.equal(session.activeMs, 0)
  assert.equal(controller.lastTickAt, 1_000)
})

test("advanceLoopClock: accrues the gap between consecutive running ticks", () => {
  const controller = runningController()
  const session = createScanSessionState()

  advanceLoopClock(controller, session, 1_000)
  advanceLoopClock(controller, session, 1_016)
  advanceLoopClock(controller, session, 1_032)

  assert.equal(session.activeMs, 32)
})

test("advanceLoopClock: a single gap is capped so one long stall cannot burn the budget", () => {
  const controller = runningController()
  const session = createScanSessionState()

  advanceLoopClock(controller, session, 0)
  advanceLoopClock(controller, session, 30_000)

  assert.equal(session.activeMs, MAX_TICK_DELTA_MS)
})

test("advanceLoopClock: paused ticks accrue nothing and drop the anchor", () => {
  const controller = runningController()
  const session = createScanSessionState()

  advanceLoopClock(controller, session, 1_000)
  advanceLoopClock(controller, session, 1_100)
  assert.equal(session.activeMs, 100)

  // 30s behind an open sheet: the loop is not ticking, and a stray tick that does land
  // must neither accrue nor leave an anchor the resumed loop would measure against.
  setPauseReason(controller, "sheet", true)
  assert.equal(advanceLoopClock(controller, session, 31_000).timedOut, false)
  assert.equal(session.activeMs, 100)
  assert.equal(controller.lastTickAt, null)

  setPauseReason(controller, "sheet", false)
  advanceLoopClock(controller, session, 31_100)
  advanceLoopClock(controller, session, 31_200)

  assert.equal(session.activeMs, 200)
})

test("advanceLoopClock: reports the search fallback exactly once, at 3000ms of active time", () => {
  const controller = runningController()
  const session = createScanSessionState()
  let now = 0
  let fired = 0

  // 6s of wall time with the sheet open for the middle 3s.
  for (let i = 0; i < 60; i += 1) {
    if (i === 20) setPauseReason(controller, "sheet", true)
    if (i === 50) setPauseReason(controller, "sheet", false)
    now += 100
    if (isLoopPaused(controller)) continue
    if (advanceLoopClock(controller, session, now).timedOut) fired += 1
  }

  assert.equal(fired, 0)
  assert.ok(session.activeMs < SCAN_TIMEOUT_MS)

  for (let i = 0; i < 60; i += 1) {
    now += 100
    if (advanceLoopClock(controller, session, now).timedOut) fired += 1
  }

  assert.equal(fired, 1)
})

test("advanceLoopClock: a decoded session never reports the fallback", () => {
  const controller = runningController()
  const session = createScanSessionState()
  session.hasDecoded = true

  let now = 0
  for (let i = 0; i < 100; i += 1) {
    now += 100
    assert.equal(advanceLoopClock(controller, session, now).timedOut, false)
  }
})
