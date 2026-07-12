import assert from "node:assert/strict"
import test from "node:test"
import { getUnauthenticatedRedirectTarget } from "../src/lib/auth/unauthenticated-redirect"

test("sends unauthenticated app routes to login even without returning cookie", () => {
  assert.equal(getUnauthenticatedRedirectTarget("/chat", "", false), "/auth?next=%2Fchat")
  assert.equal(getUnauthenticatedRedirectTarget("/routine", "", false), "/auth?next=%2Froutine")
  assert.equal(
    getUnauthenticatedRedirectTarget("/routine/current", "?view=week", false),
    "/auth?next=%2Froutine%2Fcurrent%3Fview%3Dweek",
  )
  assert.equal(
    getUnauthenticatedRedirectTarget("/api/routine/current", "", false),
    "/auth?next=%2Fapi%2Froutine%2Fcurrent",
  )
  assert.equal(
    getUnauthenticatedRedirectTarget("/profile", "?tab=routine", false),
    "/auth?next=%2Fprofile%3Ftab%3Droutine",
  )
  assert.equal(
    getUnauthenticatedRedirectTarget("/admin/products", "", false),
    "/auth?next=%2Fadmin%2Fproducts",
  )
})

test("keeps first-time protected routes outside the app prefixes on the quiz funnel", () => {
  assert.equal(getUnauthenticatedRedirectTarget("/api/billing/access", "", false), "/quiz")
})

test("matches auth-first routes on segment boundaries", () => {
  assert.equal(getUnauthenticatedRedirectTarget("/chatty", "", false), "/quiz")
  assert.equal(getUnauthenticatedRedirectTarget("/api/routines", "", false), "/quiz")
})

test("preserves session-expired copy for known returning users", () => {
  assert.equal(
    getUnauthenticatedRedirectTarget("/chat", "?conversation=1", true),
    "/auth?reason=session_expired&next=%2Fchat%3Fconversation%3D1",
  )
})
