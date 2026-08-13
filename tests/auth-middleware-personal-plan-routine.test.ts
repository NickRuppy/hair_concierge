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
const fieldTestUserId = "00000000-0000-4000-8000-000000000001"

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
  useDefaultFrontier = false,
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
  useDefaultFrontier?: boolean
} = {}) {
  const fakeSupabase = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: fieldTestUserId,
            email: "field-test@example.com",
            app_metadata: { access_kind: "field_test" },
          },
        },
      }),
      admin: {
        async getUserById() {
          return { data: { user: null }, error: { status: 403, message: "forbidden" } }
        },
      },
    },
    rpc: async () => ({
      data: {
        qualified_at: "2026-08-12T12:00:00.000Z",
        quiz_source_kind: "personal_plan",
        plan: {
          current_initial_need_version_id: "initial-1",
          current_refined_need_version_id: null,
          pending_routine_proposal_id: null,
          active_routine_version_id: null,
        },
      },
      error: null,
    }),
    from(table: string) {
      return {
        select(columns?: string) {
          return {
            eq() {
              if (table === "personal_plan_test_enrollments") {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: null, error: null }),
                    }
                  },
                }
              }
              return {
                maybeSingle: async () => {
                  if (table === "profiles") {
                    return {
                      data:
                        columns === "is_admin"
                          ? { is_admin: false }
                          : { onboarding_completed: false },
                    }
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
    ...(useDefaultFrontier
      ? {}
      : {
          loadPersonalPlanRoutingFrontier: async () => {
            if (frontierResult.error) throw frontierResult.error
            const data = frontierResult.data
            if (!data?.eligible) return { kind: "legacy" }
            if (!data.source_ready) return { kind: "recovery", nextHref: "/plan-bereit" }
            if (!data.plan)
              return { kind: "personal_plan", frontier: "stage1", nextHref: "/plan-start" }
            if (data.plan.active_routine_version_id) {
              return { kind: "personal_plan", frontier: "stage5", nextHref: "/anwendung" }
            }
            if (data.plan.pending_routine_proposal_id) {
              return { kind: "personal_plan", frontier: "stage4", nextHref: "/routine" }
            }
            return { kind: "personal_plan", frontier: "stage3", nextHref: "/plan-start" }
          },
        }),
  }

  return createUpdateSession(dependencies)
}

test("released routing ignores obsolete internal rollout environment", async () => {
  const originalFetch = globalThis.fetch
  const environment = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PERSONAL_PLAN_APP_V1_ENABLED",
    "PERSONAL_PLAN_APP_V1_ROLLOUT",
    "PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS",
    "PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF",
  ] as const
  const previous = new Map(environment.map((key) => [key, process.env[key]]))
  const requests: Array<{ url: string; authorization: string | null }> = []

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  process.env.PERSONAL_PLAN_APP_V1_ENABLED = "false"
  process.env.PERSONAL_PLAN_APP_V1_ROLLOUT = "internal"
  process.env.PERSONAL_PLAN_APP_V1_INTERNAL_EMAILS = "field-test@example.com"
  process.env.PERSONAL_PLAN_APP_V1_NEW_BUYER_CUTOFF = "2026-08-12T12:00:00.000Z"
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    requests.push({ url, authorization: new Headers(init?.headers).get("Authorization") })
    if (url.includes("/rest/v1/profiles")) {
      return Response.json([{ is_admin: false }])
    }
    if (url.includes("/rest/v1/personal_plan_test_enrollments")) {
      return Response.json([])
    }
    if (url.includes(`/auth/v1/admin/users/${fieldTestUserId}`)) {
      return Response.json({
        user: {
          id: fieldTestUserId,
          email: "field-test@example.com",
          email_confirmed_at: "2026-08-12T12:00:00.000Z",
        },
      })
    }
    throw new Error(`unexpected server eligibility request: ${url}`)
  }) as typeof fetch

  try {
    const response = await createMiddleware({ useDefaultFrontier: true })(
      new NextRequest("https://chaarlie.de/chat"),
    )

    assert.equal(response.status, 307)
    assert.equal(response.headers.get("location"), "https://chaarlie.de/plan-start")
    assert.ok(requests.every(({ url }) => !url.includes(`/auth/v1/admin/users/${fieldTestUserId}`)))
    assert.ok(requests.every(({ url }) => !url.includes("/rest/v1/profiles")))
    assert.ok(
      requests.every(({ authorization }) => authorization === "Bearer test-service-role-key"),
    )
  } finally {
    globalThis.fetch = originalFetch
    for (const key of environment) {
      const value = previous.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

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
