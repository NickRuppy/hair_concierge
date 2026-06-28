import assert from "node:assert/strict"
import test from "node:test"

import { mapWithConcurrency } from "../scripts/eval-chat/concurrency"

test("mapWithConcurrency preserves input order while bounding active workers", async () => {
  let active = 0
  let maxActive = 0
  const seen: number[] = []

  const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    seen.push(value)
    await new Promise((resolve) => setTimeout(resolve, value === 1 ? 20 : 1))
    active -= 1
    return value * 10
  })

  assert.deepEqual(results, [10, 20, 30, 40])
  assert.equal(maxActive, 2)
  assert.deepEqual(seen.slice(0, 2), [1, 2])
})

test("mapWithConcurrency treats invalid concurrency as serial", async () => {
  let active = 0
  let maxActive = 0

  await mapWithConcurrency([1, 2, 3], 0, async () => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 1))
    active -= 1
  })

  assert.equal(maxActive, 1)
})
