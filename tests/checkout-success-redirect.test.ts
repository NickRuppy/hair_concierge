import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

import {
  getAuthenticatedCheckoutSuccessRedirect,
  getCheckoutFirstTimeDestinationOptionsFromAccount,
  getCheckoutFirstTimeDestination,
  resolvePersonalPlanCheckoutReadiness,
  isCheckoutFirstTimeDestination,
  resolveCheckoutFirstTimeDestination,
  type CheckoutFirstTimeDestinationOptions,
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

test("a legacy-quiz buyer enters readiness only with server-provided future-purchase eligibility", () => {
  assert.equal(getCheckoutFirstTimeDestination("legacy", "legacy lead"), "/onboarding")
  assert.equal(
    getCheckoutFirstTimeDestination("legacy", "legacy lead", null, {
      legacyQuizFuturePurchaseEligible: true,
    }),
    "/plan-bereit?lead=legacy%20lead",
  )
  assert.equal(
    getCheckoutFirstTimeDestination("unsupported", "foreign lead", null, {
      legacyQuizFuturePurchaseEligible: true,
    }),
    "/onboarding",
  )
})

test("activation-account eligibility ignores non-boolean values", () => {
  assert.deepEqual(
    getCheckoutFirstTimeDestinationOptionsFromAccount({ legacyQuizFuturePurchaseEligible: true }),
    { legacyQuizFuturePurchaseEligible: true, funnelPackageKey: null },
  )
  assert.deepEqual(
    getCheckoutFirstTimeDestinationOptionsFromAccount({ legacyQuizFuturePurchaseEligible: "true" }),
    { legacyQuizFuturePurchaseEligible: false, funnelPackageKey: null },
  )
})

test("activation-account options carry the server-resolved funnel package", () => {
  assert.deepEqual(
    getCheckoutFirstTimeDestinationOptionsFromAccount({
      legacyQuizFuturePurchaseEligible: true,
      funnelPackageKey: "scan_v1",
    }),
    { legacyQuizFuturePurchaseEligible: true, funnelPackageKey: "scan_v1" },
  )
  for (const value of [undefined, null, 42, { key: "scan_v1" }]) {
    assert.deepEqual(
      getCheckoutFirstTimeDestinationOptionsFromAccount({ funnelPackageKey: value }),
      { legacyQuizFuturePurchaseEligible: false, funnelPackageKey: null },
      `funnelPackageKey ${JSON.stringify(value)}`,
    )
  }
})

test("a scan_v1 buyer takes the same eligibility-gated provisioning step as any legacy buyer", () => {
  // The scanner hand-over happens on /plan-bereit, not here: this package must not
  // create a destination of its own, and must not bypass the cutover eligibility gate.
  assert.equal(
    getCheckoutFirstTimeDestination("legacy", "scan-lead", null, {
      legacyQuizFuturePurchaseEligible: true,
      funnelPackageKey: "scan_v1",
    }),
    "/plan-bereit?lead=scan-lead",
  )
  assert.equal(
    getCheckoutFirstTimeDestination("legacy", "scan-lead", null, {
      legacyQuizFuturePurchaseEligible: false,
      funnelPackageKey: "scan_v1",
    }),
    "/onboarding",
  )
  assert.equal(
    getCheckoutFirstTimeDestination("legacy", "scan-lead", null, { funnelPackageKey: "scan_v1" }),
    "/onboarding",
  )
})

test("the funnel package never changes a destination any other option already decided", () => {
  const cases: Array<[string | null, string | null, CheckoutFirstTimeDestinationOptions]> = [
    ["legacy", "lead-1", {}],
    ["legacy", "lead-1", { legacyQuizFuturePurchaseEligible: true }],
    ["legacy", null, { legacyQuizFuturePurchaseEligible: true }],
    ["personal_plan", "lead-1", {}],
    ["personal_plan", "lead-1", { personalPlanActivationReady: true }],
    ["personal_plan", "lead-1", { personalPlanLegacy: true }],
    ["unsupported", "lead-1", { legacyQuizFuturePurchaseEligible: true }],
    [null, "lead-1", {}],
  ]
  for (const [quizKind, leadId, options] of cases) {
    assert.equal(
      getCheckoutFirstTimeDestination(quizKind, leadId, null, {
        ...options,
        funnelPackageKey: "scan_v1",
      }),
      getCheckoutFirstTimeDestination(quizKind, leadId, null, options),
      `${quizKind} / ${leadId} / ${JSON.stringify(options)}`,
    )
  }
})

test("reactivation keeps precedence over the scan_v1 package", () => {
  assert.equal(
    getCheckoutFirstTimeDestination("legacy", "scan-lead", "membership_reactivation", {
      legacyQuizFuturePurchaseEligible: true,
      funnelPackageKey: "scan_v1",
    }),
    "/onboarding",
  )
  assert.equal(
    getCheckoutFirstTimeDestination("personal_plan", "scan-lead", "membership_reactivation", {
      personalPlanActivationReady: true,
      funnelPackageKey: "scan_v1",
    }),
    "/onboarding",
  )
})

test("the destination union stays closed — /scan is reached from plan-bereit, not from here", () => {
  assert.equal(isCheckoutFirstTimeDestination("/scan?welcome=scan"), false)
  assert.equal(isCheckoutFirstTimeDestination("/scan"), false)
  assert.equal(isCheckoutFirstTimeDestination("/onboarding"), true)
  assert.equal(isCheckoutFirstTimeDestination("/plan-start"), true)
  assert.equal(isCheckoutFirstTimeDestination("/plan-bereit?lead=scan-lead"), true)
})

test("a proven eligible legacy purchase keeps readiness recovery when quiz-kind reload fails", async () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: null, error: { message: "temporarily unavailable" } }),
  }
  assert.equal(
    await resolveCheckoutFirstTimeDestination(
      { from: () => builder } as never,
      "legacy lead",
      null,
      { legacyQuizFuturePurchaseEligible: true },
    ),
    "/plan-bereit?lead=legacy%20lead",
  )
})

test("Stripe and PayPal share the exact first-time quiz destination matrix", () => {
  for (const provider of ["stripe", "paypal"]) {
    assert.equal(
      getCheckoutFirstTimeDestination("personal_plan", "personal-lead"),
      "/plan-bereit?lead=personal-lead",
      `${provider} personal plan buyer`,
    )
    assert.equal(
      getCheckoutFirstTimeDestination("legacy", "legacy-lead", null, {
        legacyQuizFuturePurchaseEligible: true,
      }),
      "/plan-bereit?lead=legacy-lead",
      `${provider} eligible legacy buyer`,
    )
    assert.equal(
      getCheckoutFirstTimeDestination("legacy", "legacy-lead"),
      "/onboarding",
      `${provider} cutover-off legacy buyer`,
    )
  }
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
