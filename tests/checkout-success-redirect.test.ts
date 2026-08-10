import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import {
  getAuthenticatedCheckoutSuccessRedirect,
  getCheckoutFirstTimeDestination,
  resolvePersonalPlanCheckoutReadiness,
  resolveCheckoutFirstTimeDestination,
} from "../src/lib/billing/checkout-success-redirect"

const welcomeSource = readFileSync("src/app/welcome/page.tsx", "utf8")

test("post-payment Personal Plan routing uses owner-scoped rollout eligibility", () => {
  assert.match(welcomeSource, /isPersonalPlanAppV1AllowedForUser\(input\.userId, admin as never\)/)
})

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

test("a verified, enabled, prepared new-buyer Personal Plan activation enters plan-start", () => {
  assert.equal(
    getCheckoutFirstTimeDestination("personal_plan", "lead-v2", null, {
      personalPlanActivationReady: true,
    }),
    "/plan-start",
  )
  assert.equal(
    getCheckoutFirstTimeDestination("personal_plan", "lead-v2"),
    "/plan-bereit?lead=lead-v2",
  )
})

test("checkout readiness keeps provisioning pending and preserves legacy before the cutoff", () => {
  const base = {
    appEnabled: true,
    accessState: "active" as const,
    paidAt: "2026-08-08T10:00:00.000Z",
    artifactLeadId: "lead-v2",
    preparedArtifactAttached: true,
    cohortCutoff: new Date("2026-08-08T00:00:00.000Z"),
  }
  assert.deepEqual(resolvePersonalPlanCheckoutReadiness(base), {
    activationReady: true,
    legacy: false,
  })
  assert.deepEqual(
    resolvePersonalPlanCheckoutReadiness({ ...base, preparedArtifactAttached: false }),
    { activationReady: false, legacy: false },
  )
  assert.deepEqual(
    resolvePersonalPlanCheckoutReadiness({ ...base, paidAt: "2026-08-07T23:59:59.999Z" }),
    { activationReady: false, legacy: true },
  )
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

test("an existing-account Personal Plan buyer keeps the server-derived destination for Stripe and PayPal", () => {
  for (const provider of ["stripe", "paypal"]) {
    assert.equal(
      getAuthenticatedCheckoutSuccessRedirect(true, null, "/plan-start"),
      "/plan-start",
      `${provider} ready buyer`,
    )
    assert.equal(
      getAuthenticatedCheckoutSuccessRedirect(true, null, "/plan-bereit?lead=lead-v2"),
      "/plan-bereit?lead=lead-v2",
      `${provider} delayed buyer`,
    )
  }
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
