import assert from "node:assert/strict"
import test from "node:test"
import { NextRequest } from "next/server"

import {
  createUpdateSession,
  isDiscoveryParticipant,
  isDiscoveryParticipantAllowedPath,
  type UpdateSessionDependencies,
} from "../src/lib/supabase/middleware"
import {
  DISCOVERY_ACCESS_KIND,
  DISCOVERY_CHECKLIST_PATH,
  DISCOVERY_ENROLLMENT_METADATA_KEY,
} from "../src/lib/discovery/participant"

const participantId = "00000000-0000-4000-8000-000000000001"
const enrollmentId = "3f1a6f2e-2b44-4a1e-9a1a-6f2e2b444a1e"

const participantMetadata = {
  access_kind: DISCOVERY_ACCESS_KIND,
  [DISCOVERY_ENROLLMENT_METADATA_KEY]: enrollmentId,
}

const completeHairProfile = {
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

/**
 * A middleware whose user is a claimed discovery participant by default, with a
 * deliberately hostile surrounding state: no subscription, no one-time purchase,
 * no hair profile, no completed onboarding. That is exactly what a real
 * participant looks like, and it is the state the ordinary paywall and the
 * legacy intake routing both bounce.
 */
function createMiddleware({
  discoveryEnabled = true,
  freemiumEnabled = false,
  currentAccess = false,
  appMetadata = participantMetadata as Record<string, unknown>,
  hairProfile = null as Record<string, unknown> | null,
  onboardingCompleted = false,
  billingCalls,
}: {
  discoveryEnabled?: boolean
  freemiumEnabled?: boolean
  currentAccess?: boolean
  appMetadata?: Record<string, unknown>
  hairProfile?: Record<string, unknown> | null
  onboardingCompleted?: boolean
  billingCalls?: { count: number }
} = {}) {
  process.env.DISCOVERY_CALL_TOOLKIT_ENABLED = discoveryEnabled ? "true" : "false"
  process.env.FREEMIUM_SCANNER_FIRST_ENABLED = freemiumEnabled ? "true" : "false"

  const fakeSupabase = {
    auth: {
      getUser: async () => ({
        data: {
          user: { id: participantId, email: "lea@example.test", app_metadata: appMetadata },
        },
      }),
    },
    from(table: string) {
      return {
        select(columns?: string) {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  if (table === "profiles") {
                    return columns === "is_admin"
                      ? { data: { is_admin: false } }
                      : { data: { onboarding_completed: onboardingCompleted } }
                  }
                  if (table === "hair_profiles") return { data: hairProfile }
                  return { data: null }
                },
                single: async () => ({ data: { is_admin: false } }),
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
    hasCurrentAppAccess: (async () => {
      if (billingCalls) billingCalls.count += 1
      return currentAccess
    }) as UpdateSessionDependencies["hasCurrentAppAccess"],
    hasCurrentPaidAppAccess: (async () =>
      currentAccess) as UpdateSessionDependencies["hasCurrentPaidAppAccess"],
    hasCurrentPartnerAccess: (async () =>
      false) as UpdateSessionDependencies["hasCurrentPartnerAccess"],
    hasTrialBillingHistory: async () => false,
    resolveOneTimeAccessState: (async () =>
      "none") as UpdateSessionDependencies["resolveOneTimeAccessState"],
    resolveModeratorAccess: (async () =>
      "none") as UpdateSessionDependencies["resolveModeratorAccess"],
    getRouteEnvironment: () => ({ nodeEnv: "test", localDevLoginEnabled: false }),
    loadPersonalPlanRoutingFrontier: async () => ({ kind: "legacy" }),
  }

  return createUpdateSession(dependencies)
}

function request(pathname: string, search = "") {
  return new NextRequest(`https://chaarlie.de${pathname}${search}`)
}

// --- Predicates --------------------------------------------------------------

test("only a fully stamped account is a participant", () => {
  assert.equal(isDiscoveryParticipant({ app_metadata: participantMetadata }), true)
  for (const app_metadata of [
    undefined,
    {},
    { access_kind: DISCOVERY_ACCESS_KIND },
    { [DISCOVERY_ENROLLMENT_METADATA_KEY]: enrollmentId },
    { access_kind: "partner", [DISCOVERY_ENROLLMENT_METADATA_KEY]: enrollmentId },
    { access_kind: DISCOVERY_ACCESS_KIND, [DISCOVERY_ENROLLMENT_METADATA_KEY]: 7 },
  ]) {
    assert.equal(isDiscoveryParticipant({ app_metadata }), false, JSON.stringify(app_metadata))
  }
})

test("the allow-list is exactly invite, intake, quiz and scan", () => {
  for (const pathname of [
    "/beratung",
    "/beratung/produkte",
    "/api/beratung/intake",
    "/quiz",
    "/quiz/return",
    "/api/quiz/lead",
    "/api/scan/search",
    "/api/scan/submit",
  ]) {
    assert.equal(isDiscoveryParticipantAllowedPath(pathname), true, pathname)
  }
  for (const pathname of [
    "/",
    "/auth",
    "/chat",
    "/anwendung",
    "/routine",
    "/profile",
    "/scan",
    "/tracker",
    "/reactivate",
    "/admin",
    "/api/chat",
    "/api/personal-plan/state",
  ]) {
    assert.equal(isDiscoveryParticipantAllowedPath(pathname), false, pathname)
  }
})

// --- The gate, flag on -------------------------------------------------------

test("a participant reaches every checklist-called path with no subscription and freemium off", async () => {
  const billingCalls = { count: 0 }
  const middleware = createMiddleware({ billingCalls })
  for (const pathname of [
    "/beratung/produkte",
    "/api/beratung/intake",
    "/quiz",
    "/api/quiz/lead",
    "/api/scan/search",
    "/api/scan/submit",
  ]) {
    const response = await middleware(request(pathname))
    assert.equal(response.status, 200, pathname)
    assert.equal(response.headers.get("location"), null, pathname)
  }
  // The gate returns before the paywall, so no billing lookup ever runs — that
  // is what keeps /api/scan open without a subscription and with freemium off.
  assert.equal(billingCalls.count, 0)
})

test("a participant on a member route lands on the checklist, and the checklist is terminal", async () => {
  const middleware = createMiddleware()
  for (const pathname of [
    "/chat",
    "/anwendung",
    "/routine",
    "/profile",
    "/scan",
    "/tracker",
    // The routes that would otherwise claim a participant on the way out of the
    // quiz: legacy intake, the purchase frontier, the paid result and the admin
    // area. None of them is allow-listed, so all four bounce.
    "/onboarding",
    "/plan-bereit",
    "/result/9a8b7c6d-0000-4000-8000-00000000000a",
    "/admin",
  ]) {
    const response = await middleware(request(pathname))
    assert.equal(response.status, 307, pathname)
    assert.equal(
      new URL(response.headers.get("location") ?? "").pathname,
      DISCOVERY_CHECKLIST_PATH,
      pathname,
    )
  }
  // No loop: the bounce target itself passes.
  assert.equal((await middleware(request(DISCOVERY_CHECKLIST_PATH))).status, 200)
})

test("/reactivate cannot loop with the flag on: it bounces once to the terminal checklist", async () => {
  const middleware = createMiddleware()
  const response = await middleware(request("/reactivate", "?reason=expired&next=%2Fchat"))
  assert.equal(response.status, 307)
  const location = new URL(response.headers.get("location") ?? "")
  assert.equal(location.pathname, DISCOVERY_CHECKLIST_PATH)
  // The stale reactivation query must not travel to the checklist.
  assert.equal(location.search, "")
  assert.equal((await middleware(request(DISCOVERY_CHECKLIST_PATH))).status, 200)
})

test("/reactivate cannot loop with the flag off either: the gate is inert", async () => {
  const middleware = createMiddleware({ discoveryEnabled: false })
  // /reactivate is not subscription-gated, so an enrolled account simply lands
  // there and stops — the documented flag-off destination.
  const response = await middleware(request("/reactivate", "?reason=expired"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("location"), null)
})

// --- Inertness ---------------------------------------------------------------

test("with the flag off a participant follows the ordinary paywall", async () => {
  const billingCalls = { count: 0 }
  const middleware = createMiddleware({ discoveryEnabled: false, billingCalls })
  const response = await middleware(request("/api/scan/search"))
  assert.equal(response.status, 403)
  assert.deepEqual(await response.json(), { error: "subscription_required" })
  assert.equal(billingCalls.count, 1)
})

test("with the flag on an unstamped user is untouched by the gate", async () => {
  const middleware = createMiddleware({ appMetadata: {} })
  // The paywall runs and denies, exactly as it does on main.
  const denied = await middleware(request("/api/scan/search"))
  assert.equal(denied.status, 403)
  assert.deepEqual(await denied.json(), { error: "subscription_required" })

  // And a paying member with a finished profile keeps their app.
  const member = createMiddleware({
    appMetadata: {},
    currentAccess: true,
    hairProfile: completeHairProfile,
    onboardingCompleted: true,
  })
  const allowed = await member(request("/chat"))
  assert.equal(allowed.status, 200)
  assert.equal(allowed.headers.get("location"), null)
})
