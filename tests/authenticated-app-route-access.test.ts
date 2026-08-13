import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveTrackerRouteAccess,
  type TrackerRouteAccessDependencies,
} from "../src/lib/auth/authenticated-app-route-access"

function dependencies(overrides: Partial<TrackerRouteAccessDependencies> = {}) {
  return {
    getUser: async () => ({ id: "user-1" }),
    ...overrides,
  } satisfies TrackerRouteAccessDependencies
}

test("tracker boundary only checks the authenticated user", async () => {
  const result = await resolveTrackerRouteAccess(dependencies())
  assert.deepEqual(result, { kind: "allow" })
})

test("tracker boundary fails closed without an authenticated user", async () => {
  const result = await resolveTrackerRouteAccess(dependencies({ getUser: async () => null }))
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})

test("tracker boundary fails closed when the authenticated-user read is unavailable", async () => {
  const result = await resolveTrackerRouteAccess(
    dependencies({
      getUser: async () => {
        throw new Error("auth unavailable")
      },
    }),
  )
  assert.deepEqual(result, { kind: "redirect", href: "/quiz" })
})
