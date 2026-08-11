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
  planResult = {
    data: { pending_routine_proposal_id: "proposal-1", active_routine_version_id: null },
    error: null,
  },
  throwsOnPlanLookup = false,
}: {
  currentAccess?: boolean
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
