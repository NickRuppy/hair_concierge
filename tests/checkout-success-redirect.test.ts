import assert from "node:assert/strict"
import test from "node:test"

import {
  getAuthenticatedCheckoutSuccessRedirect,
  resolveCheckoutFirstTimeDestination,
} from "../src/lib/billing/checkout-success-redirect"

test("onboarded reactivation users return to their verified destination", () => {
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(true, "/profile"), "/profile")
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(true, "/tracker"), "/tracker")
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(true), "/profile?membership=reactivated")
})

test("new and unresolved users continue through onboarding", () => {
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(false), "/onboarding")
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(null), "/onboarding")
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(undefined), "/onboarding")
})

test("first-time personal-plan purchasers use the protected plan transition", () => {
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(false, null, "/plan-bereit"), "/plan-bereit")
  assert.equal(getAuthenticatedCheckoutSuccessRedirect(null, null, "/plan-bereit"), "/plan-bereit")
})

test("onboarded and reactivating purchasers keep their existing destinations", () => {
  assert.equal(
    getAuthenticatedCheckoutSuccessRedirect(true, "/routine", "/plan-bereit"),
    "/routine",
  )
  assert.equal(
    getAuthenticatedCheckoutSuccessRedirect(true, null, "/plan-bereit"),
    "/profile?membership=reactivated",
  )
})

test("checkout destination is derived from the server-side lead kind", async () => {
  const calls: Array<[string, string]> = []
  const supabase = {
    from(table: string) {
      calls.push(["from", table])
      return {
        select(columns: string) {
          calls.push(["select", columns])
          return {
            eq(column: string, value: string) {
              calls.push([column, value])
              return {
                async maybeSingle() {
                  return { data: { quiz_kind: "personal_plan" }, error: null }
                },
              }
            },
          }
        },
      }
    },
  }

  assert.equal(
    await resolveCheckoutFirstTimeDestination(supabase as never, "lead-v2"),
    "/plan-bereit?lead=lead-v2",
  )
  assert.deepEqual(calls, [
    ["from", "leads"],
    ["select", "quiz_kind"],
    ["id", "lead-v2"],
  ])
})

test("reactivation never enters the personal-plan transition", async () => {
  let queried = false
  const supabase = {
    from() {
      queried = true
      throw new Error("should not query")
    },
  }

  assert.equal(
    await resolveCheckoutFirstTimeDestination(
      supabase as never,
      "lead-v2",
      "membership_reactivation",
    ),
    "/onboarding",
  )
  assert.equal(queried, false)
})
