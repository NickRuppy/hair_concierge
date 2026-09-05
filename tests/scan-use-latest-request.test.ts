import assert from "node:assert/strict"
import test from "node:test"

import { createLatestRequestGuard } from "../src/lib/scan/use-latest-request"

test("createLatestRequestGuard: the first token is current", () => {
  const guard = createLatestRequestGuard()

  const token = guard.begin()

  assert.equal(guard.isCurrent(token), true)
})

test("createLatestRequestGuard: begin() hands out strictly increasing tokens", () => {
  const guard = createLatestRequestGuard()

  const first = guard.begin()
  const second = guard.begin()
  const third = guard.begin()

  assert.ok(second > first)
  assert.ok(third > second)
})

test("createLatestRequestGuard: starting a newer request invalidates the older one", () => {
  const guard = createLatestRequestGuard()
  const stale = guard.begin()

  const fresh = guard.begin()

  assert.equal(guard.isCurrent(stale), false)
  assert.equal(guard.isCurrent(fresh), true)
})

test("createLatestRequestGuard: invalidateAll drops every outstanding token", () => {
  const guard = createLatestRequestGuard()
  const inFlight = guard.begin()

  guard.invalidateAll()

  assert.equal(guard.isCurrent(inFlight), false)
})

test("createLatestRequestGuard: a request started after invalidateAll is current again", () => {
  const guard = createLatestRequestGuard()
  guard.begin()
  guard.invalidateAll()

  const fresh = guard.begin()

  assert.equal(guard.isCurrent(fresh), true)
})

test("createLatestRequestGuard: a token never issued is not current", () => {
  const guard = createLatestRequestGuard()
  guard.begin()

  assert.equal(guard.isCurrent(0), false)
  assert.equal(guard.isCurrent(999), false)
})

test("createLatestRequestGuard: two guards keep independent counters", () => {
  const resolves = createLatestRequestGuard()
  const submits = createLatestRequestGuard()

  const resolveToken = resolves.begin()
  submits.begin()
  submits.begin()

  // The submit guard moving on must not invalidate the resolve guard's outstanding token.
  assert.equal(resolves.isCurrent(resolveToken), true)
})
