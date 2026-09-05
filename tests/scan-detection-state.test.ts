import assert from "node:assert/strict"
import test from "node:test"

import {
  REARM_EMPTY_DETECTIONS,
  isSameDetectionState,
  mapBoxToCover,
  nextDetectionState,
  normalizeDetectionBox,
  unrotateDetectionBox,
  type ScanDetectionState,
} from "../src/lib/scan/scanner-session"

/**
 * The pure half of the viewfinder-feedback seam (plan 2026-09-05, Task 1): what the
 * detection loop reports to the UI, and where the reported box lands on screen. None of
 * it touches the detection lifecycle — these helpers only translate what the loop
 * already knows into something the viewfinder can draw.
 */

// --- normalizeDetectionBox --------------------------------------------------

test("normalizeDetectionBox: a quarter-frame box becomes 0..1 fractions of the frame", () => {
  const box = normalizeDetectionBox({ x: 160, y: 120, width: 320, height: 240 }, 640, 480)
  assert.deepEqual(box, { x: 0.25, y: 0.25, width: 0.5, height: 0.5 })
})

test("normalizeDetectionBox: a box hanging over the frame edge is clamped into 0..1", () => {
  const box = normalizeDetectionBox({ x: -40, y: 400, width: 720, height: 200 }, 640, 480)
  assert.deepEqual(box, { x: 0, y: 400 / 480, width: 1, height: 1 - 400 / 480 })
})

test("normalizeDetectionBox: a frame with no intrinsic size yields a zero box", () => {
  assert.deepEqual(normalizeDetectionBox({ x: 10, y: 10, width: 10, height: 10 }, 0, 0), {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  })
})

// --- unrotateDetectionBox ---------------------------------------------------

test("unrotateDetectionBox: maps a box detected in the 90°-rotated retry frame back to the video", () => {
  // Video 640×480 -> rotated canvas 480×640. The video box {100,50,200,80} lands at
  // {350,100,80,200} in canvas coordinates (cx = videoHeight - y, cy = x).
  assert.deepEqual(unrotateDetectionBox({ x: 350, y: 100, width: 80, height: 200 }, 480), {
    x: 100,
    y: 50,
    width: 200,
    height: 80,
  })
})

test("unrotateDetectionBox: a full-frame rotated box maps back to the full frame", () => {
  assert.deepEqual(unrotateDetectionBox({ x: 0, y: 0, width: 480, height: 640 }, 480), {
    x: 0,
    y: 0,
    width: 640,
    height: 480,
  })
})

// --- mapBoxToCover ----------------------------------------------------------

test("mapBoxToCover: matching aspect ratios need no crop", () => {
  const rect = mapBoxToCover(
    { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    { width: 480, height: 640 },
    { width: 300, height: 400 },
  )
  assert.deepEqual(rect, { left: 75, top: 100, width: 150, height: 200 })
})

test("mapBoxToCover: a portrait video in a 3:4 element crops top and bottom", () => {
  // 480×800 scaled by max(300/480, 400/800) = 0.625 -> 300×500, so 50px is cropped
  // off each of the top and bottom.
  const rect = mapBoxToCover(
    { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    { width: 480, height: 800 },
    { width: 300, height: 400 },
  )
  assert.deepEqual(rect, { left: 75, top: 75, width: 150, height: 250 })
})

test("mapBoxToCover: a landscape video crops on the long axis", () => {
  // 1280×720 scaled by max(300/1280, 400/720) = 5/9 -> 711.1×400, cropped left/right.
  const rect = mapBoxToCover(
    { x: 0.5, y: 0, width: 0.25, height: 0.5 },
    { width: 1280, height: 720 },
    { width: 300, height: 400 },
  )
  const scale = 400 / 720
  const displayedWidth = 1280 * scale
  assert.equal(rect.left, (300 - displayedWidth) / 2 + 0.5 * displayedWidth)
  assert.equal(rect.top, 0)
  assert.equal(rect.width, 0.25 * displayedWidth)
  assert.equal(rect.height, 200)
  // The left edge really is inside the element: the crop is what puts it there.
  assert.equal(rect.left, 150)
})

test("mapBoxToCover: an unmeasured video or element yields a zero rect instead of NaN", () => {
  const box = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }
  const zero = { left: 0, top: 0, width: 0, height: 0 }
  assert.deepEqual(mapBoxToCover(box, { width: 0, height: 0 }, { width: 300, height: 400 }), zero)
  assert.deepEqual(mapBoxToCover(box, { width: 480, height: 640 }, { width: 0, height: 0 }), zero)
})

// --- nextDetectionState -----------------------------------------------------

const searching: ScanDetectionState = { kind: "searching" }
const boxA = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
const boxB = { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }

test("nextDetectionState: a raw hit spots the barcode", () => {
  assert.deepEqual(nextDetectionState(searching, { kind: "raw", box: boxA }, 0), {
    kind: "spotted",
    box: boxA,
  })
})

test("nextDetectionState: a raw hit follows the barcode while already spotted", () => {
  const previous: ScanDetectionState = { kind: "spotted", box: boxA }
  assert.deepEqual(nextDetectionState(previous, { kind: "raw", box: boxB }, 0), {
    kind: "spotted",
    box: boxB,
  })
})

test("nextDetectionState: an accepted decode reads the barcode", () => {
  const previous: ScanDetectionState = { kind: "spotted", box: boxA }
  assert.deepEqual(nextDetectionState(previous, { kind: "read", box: boxB }, 0), {
    kind: "read",
    box: boxB,
  })
})

test("nextDetectionState: empty attempts below the re-arm threshold hold the outline", () => {
  const previous: ScanDetectionState = { kind: "spotted", box: boxA }
  for (let streak = 1; streak < REARM_EMPTY_DETECTIONS; streak += 1) {
    assert.deepEqual(nextDetectionState(previous, { kind: "empty" }, streak), previous)
  }
})

test("nextDetectionState: the re-arm threshold clears the outline back to searching", () => {
  const previous: ScanDetectionState = { kind: "spotted", box: boxA }
  assert.deepEqual(
    nextDetectionState(previous, { kind: "empty" }, REARM_EMPTY_DETECTIONS),
    searching,
  )
})

test("nextDetectionState: a read outline is cleared by the same re-arm streak", () => {
  const previous: ScanDetectionState = { kind: "read", box: boxA }
  assert.deepEqual(nextDetectionState(previous, { kind: "empty" }, 1), previous)
  assert.deepEqual(
    nextDetectionState(previous, { kind: "empty" }, REARM_EMPTY_DETECTIONS),
    searching,
  )
})

test("nextDetectionState: a custom re-arm threshold is honoured", () => {
  const previous: ScanDetectionState = { kind: "spotted", box: boxA }
  assert.deepEqual(nextDetectionState(previous, { kind: "empty" }, 1, 1), searching)
})

test("nextDetectionState: an attempt restart always returns to searching", () => {
  const previous: ScanDetectionState = { kind: "read", box: boxA }
  assert.deepEqual(nextDetectionState(previous, { kind: "restart" }, 0), searching)
})

// --- isSameDetectionState ---------------------------------------------------

test("isSameDetectionState: two searching states are the same", () => {
  assert.equal(isSameDetectionState(searching, { kind: "searching" }), true)
})

test("isSameDetectionState: a different kind is a change", () => {
  assert.equal(isSameDetectionState(searching, { kind: "spotted", box: boxA }), false)
  assert.equal(
    isSameDetectionState({ kind: "spotted", box: boxA }, { kind: "read", box: boxA }),
    false,
  )
})

test("isSameDetectionState: jitter below the half-percent tolerance is not a change", () => {
  const jittered = { x: 0.1015, y: 0.0988, width: 0.2, height: 0.2 }
  assert.equal(
    isSameDetectionState({ kind: "spotted", box: boxA }, { kind: "spotted", box: jittered }),
    true,
  )
})

test("isSameDetectionState: a move past the tolerance is a change", () => {
  const moved = { x: 0.109, y: 0.1, width: 0.2, height: 0.2 }
  assert.equal(
    isSameDetectionState({ kind: "spotted", box: boxA }, { kind: "spotted", box: moved }),
    false,
  )
})

test("isSameDetectionState: a real move is a change", () => {
  assert.equal(
    isSameDetectionState({ kind: "spotted", box: boxA }, { kind: "spotted", box: boxB }),
    false,
  )
})
