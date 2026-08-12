import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import { createUpdateSession, type UpdateSessionDependencies } from "../src/lib/supabase/middleware"

const completeQuizProfile = {
  hair_texture: "wavy",
  thickness: "normal",
  density: "medium",
  cuticle_condition: "slightly_rough",
  protein_moisture_balance: "balanced",
  scalp_type: "normal",
  scalp_condition: null,
  chemical_treatment: ["none"],
  concerns: [],
}

type RoutinePlanResult =
  | {
      data: { pending_routine_proposal_id: string | null; active_routine_version_id: string | null }
      error: null
    }
  | { data: null; error: { message: string } }

function createMiddleware({
  currentAccess = true,
  frontierResult = { data: { eligible: false, source_ready: false, plan: null }, error: null },
  planResult = {
    data: { pending_routine_proposal_id: "proposal-1", active_routine_version_id: null },
    error: null,
  },
  throwsOnPlanLookup = false,
}: {
  currentAccess?: boolean
  frontierResult?: {
    data: {
      eligible: boolean
      source_ready: boolean
      plan: null | {
        current_initial_need_version_id: string | null
        current_refined_need_version_id: string | null
        pending_routine_proposal_id: string | null
        active_routine_version_id: string | null
      }
    } | null
    error: null | { message: string }
  }
  planResult?: RoutinePlanResult
  throwsOnPlanLookup?: boolean
} = {}) {
  const fakeSupabase = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: "field-test-user",
            email: "field-test@example.com",
            app_metadata: { access_kind: "field_test" },
          },
        },
      }),
    },
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  if (table === "profiles") {
                    return { data: { onboarding_completed: false } }
                  }
                  if (table === "hair_profiles") {
                    return { data: completeQuizProfile }
                  }
                  if (table === "personal_plans") {
                    if (throwsOnPlanLookup) throw new Error("personal plan lookup unavailable")
                    return planResult
                  }
                  throw new Error(`unexpected table: ${table}`)
                },
              }
            },
          }
        },
      }
    },
  }

  const dependencies: UpdateSessionDependencies = {
    createServerClient: (() =>
      fakeSupabase) as unknown as UpdateSessionDependencies["createServerClient"],
    hasCurrentAppAccess: (async () =>
      currentAccess) as UpdateSessionDependencies["hasCurrentAppAccess"],
    resolveOneTimeAccessState: (async () =>
      "none") as UpdateSessionDependencies["resolveOneTimeAccessState"],
    getRouteEnvironment: () => ({ nodeEnv: "test", localDevLoginEnabled: false }),
    loadPersonalPlanRoutingFrontier: async () => {
      if (frontierResult.error) throw frontierResult.error
      const data = frontierResult.data
      if (!data?.eligible) return { kind: "legacy" }
      if (!data.source_ready) return { kind: "recovery", nextHref: "/plan-bereit" }
      if (!data.plan) return { kind: "personal_plan", frontier: "stage1", nextHref: "/plan-start" }
      if (data.plan.active_routine_version_id) {
        return { kind: "personal_plan", frontier: "stage5", nextHref: "/anwendung" }
      }
      if (data.plan.pending_routine_proposal_id) {
        return { kind: "personal_plan", frontier: "stage4", nextHref: "/routine" }
      }
      return { kind: "personal_plan", frontier: "stage3", nextHref: "/plan-start" }
    },
  }

  return createUpdateSession(dependencies)
}

test("field-test user with current access and a pending proposal reaches /routine", async () => {
  const response = await createMiddleware()(new NextRequest("https://chaarlie.de/routine"))

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})

test("a pending proposal does not grant /anwendung before an active routine exists", async () => {
  const response = await createMiddleware()(new NextRequest("https://chaarlie.de/anwendung"))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/onboarding")
})

test("field-test access fails closed when the app-access check is false", async () => {
  const response = await createMiddleware({ currentAccess: false })(
    new NextRequest("https://chaarlie.de/routine"),
  )

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/test/haarplan/beendet")
})

test("a personal-plan lookup error preserves legacy onboarding protection", async () => {
  const response = await createMiddleware({
    planResult: { data: null, error: { message: "database unavailable" } },
  })(new NextRequest("https://chaarlie.de/routine"))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/onboarding")
})

test("a thrown personal-plan lookup preserves legacy onboarding protection", async () => {
  const response = await createMiddleware({ throwsOnPlanLookup: true })(
    new NextRequest("https://chaarlie.de/routine"),
  )

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/onboarding")
})

test("an eligible new buyer follows the Personal Plan frontier instead of legacy onboarding", async () => {
  const response = await createMiddleware({
    frontierResult: {
      data: { eligible: true, source_ready: true, plan: null },
      error: null,
    },
  })(new NextRequest("https://chaarlie.de/chat"))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/plan-start")
})

test("an eligible buyer with an unready source stays in readiness recovery", async () => {
  const response = await createMiddleware({
    frontierResult: {
      data: { eligible: true, source_ready: false, plan: null },
      error: null,
    },
  })(new NextRequest("https://chaarlie.de/routine"))

  assert.equal(response.status, 307)
  assert.equal(response.headers.get("location"), "https://chaarlie.de/plan-bereit")
})

test("a routing-frontier outage cannot silently fall through to legacy onboarding", async () => {
  const response = await createMiddleware({
    frontierResult: {
      data: null,
      error: { message: "routing source unavailable" },
    },
  })(new NextRequest("https://chaarlie.de/chat"))

  assert.equal(response.status, 503)
  assert.equal(response.headers.get("location"), null)
  assert.equal(response.headers.get("cache-control"), "private, no-store")
  assert.match(await response.text(), /Bitte versuche es gleich noch einmal/)
})

test("explicit legacy onboarding edits are not intercepted by the Personal Plan frontier", async () => {
  const response = await createMiddleware({
    frontierResult: {
      data: { eligible: true, source_ready: true, plan: null },
      error: null,
    },
  })(
    new NextRequest(
      "https://chaarlie.de/onboarding?step=products&editMode=profile&returnTo=%2Fprofile",
    ),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})
