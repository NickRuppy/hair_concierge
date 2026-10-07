import assert from "node:assert/strict"
import test from "node:test"

import { MOTION_MS } from "../src/lib/motion"
import { createDelayedLoader } from "../src/lib/motion-loader"

/**
 * Batch 8 loader rule: no loader before 300 ms; once shown, at least 500 ms.
 * Fake timers + a fake clock drive the scheduler directly.
 */

function harness(t: test.TestContext) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] })
  const changes: boolean[] = []
  const loader = createDelayedLoader({ onChange: (visible) => changes.push(visible) })
  return { changes, loader, tick: (ms: number) => t.mock.timers.tick(ms) }
}

test("the tokens are the spec's numbers", () => {
  assert.equal(MOTION_MS.loaderDelay, 300)
  assert.equal(MOTION_MS.loaderMinimum, 500)
  assert.equal(MOTION_MS.settle, 200)
})

test("a wait that ends before 300 ms never shows a loader", (t) => {
  const { changes, loader, tick } = harness(t)
  loader.set(true)
  tick(299)
  loader.set(false)
  tick(1_000)
  assert.deepEqual(changes, [])
})

test("a longer wait shows the loader at 300 ms, not earlier", (t) => {
  const { changes, loader, tick } = harness(t)
  loader.set(true)
  tick(299)
  assert.deepEqual(changes, [])
  tick(1)
  assert.deepEqual(changes, [true])
})

test("once shown, the loader stays at least 500 ms", (t) => {
  const { changes, loader, tick } = harness(t)
  loader.set(true)
  tick(300)
  tick(50)
  loader.set(false)
  tick(449)
  assert.deepEqual(changes, [true], "still inside the 500 ms minimum")
  tick(1)
  assert.deepEqual(changes, [true, false])
})

test("a loader shown longer than the minimum hides at once", (t) => {
  const { changes, loader, tick } = harness(t)
  loader.set(true)
  tick(300)
  tick(800)
  loader.set(false)
  assert.deepEqual(changes, [true, false])
})

test("restarting the wait inside the minimum keeps the loader up without a blink", (t) => {
  const { changes, loader, tick } = harness(t)
  loader.set(true)
  tick(300)
  loader.set(false)
  tick(100)
  loader.set(true)
  tick(2_000)
  assert.deepEqual(changes, [true])
})

test("dispose cancels a pending show", (t) => {
  const { changes, loader, tick } = harness(t)
  loader.set(true)
  loader.dispose()
  tick(1_000)
  assert.deepEqual(changes, [])
})
