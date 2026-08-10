import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import {
  activatePersonalPlanFieldTestEnrollment,
  createPersonalPlanFieldTestGuest,
  isPersonalPlanFieldTestGuestRetry,
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  resolvePersonalPlanFieldTestOfferAuthorization,
  type PersonalPlanFieldTestOfferAuthorization,
} from "@/lib/personal-plan-field-test"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export const FIELD_TEST_ACTIVATION_IP_RATE_LIMIT = {
  prefix: "personal-plan-field-test-activation-ip",
  limit: 20,
  windowMs: 60 * 60_000,
} satisfies RateLimitConfig

export const FIELD_TEST_ACTIVATION_SESSION_RATE_LIMIT = {
  prefix: "personal-plan-field-test-activation-session",
  limit: 8,
  windowMs: 10 * 60_000,
} satisfies RateLimitConfig

type FieldTestAuthUser = {
  id: string
  app_metadata?: Record<string, unknown>
}

type FieldTestSessionClient = {
  auth: {
    getUser: () => Promise<{ data: { user: FieldTestAuthUser | null } }>
    signInWithPassword: (input: { email: string; password: string }) => Promise<{ error: unknown }>
  }
}

type ActivationDependencies = {
  checkRateLimit: typeof checkRateLimit
  resolveFunnelCookieContext: typeof resolveFunnelCookieContext
  resolveAuthorization: typeof resolvePersonalPlanFieldTestOfferAuthorization
  createGuest: typeof createPersonalPlanFieldTestGuest
  isGuestRetry: typeof isPersonalPlanFieldTestGuestRetry
  activate: typeof activatePersonalPlanFieldTestEnrollment
  createSession: (request: NextRequest, response: NextResponse) => FieldTestSessionClient
}

const DEFAULT_DEPENDENCIES: ActivationDependencies = {
  checkRateLimit,
  resolveFunnelCookieContext,
  resolveAuthorization: resolvePersonalPlanFieldTestOfferAuthorization,
  createGuest: createPersonalPlanFieldTestGuest,
  isGuestRetry: isPersonalPlanFieldTestGuestRetry,
  activate: activatePersonalPlanFieldTestEnrollment,
  createSession: createFieldTestSession,
}

export function createPersonalPlanFieldTestActivationHandler(
  overrides: Partial<ActivationDependencies> = {},
) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  return async function POST(request: NextRequest) {
    const ipRateLimit = await dependencies.checkRateLimit(
      requestIp(request),
      FIELD_TEST_ACTIVATION_IP_RATE_LIMIT,
    )
    if (!ipRateLimit.allowed) return rateLimitResponse(ipRateLimit.error)

    const leadId = await readLeadId(request)
    if (!leadId) return jsonError("Ungültige Anfrage", 400)

    const funnelContext = await dependencies.resolveFunnelCookieContext(
      request.cookies.get(FUNNEL_SESSION_COOKIE)?.value,
    )
    if (!funnelContext) return jsonError("Testzugang ist nicht verfügbar", 403)

    const sessionRateLimit = await dependencies.checkRateLimit(
      funnelContext.sessionId,
      FIELD_TEST_ACTIVATION_SESSION_RATE_LIMIT,
    )
    if (!sessionRateLimit.allowed) return rateLimitResponse(sessionRateLimit.error)

    const authorization = await dependencies.resolveAuthorization({
      campaignCookieValue: request.cookies.get(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE)?.value,
      funnelSessionId: funnelContext.sessionId,
      leadId,
    })
    if (!authorization) return jsonError("Testzugang ist nicht verfügbar", 403)

    const response = NextResponse.json(
      { destination: `/plan-bereit?lead=${encodeURIComponent(leadId)}` },
      { headers: NO_STORE_HEADERS },
    )
    let session: FieldTestSessionClient
    try {
      session = dependencies.createSession(request, response)
    } catch {
      return jsonError("Testzugang konnte nicht aktiviert werden", 503)
    }

    const {
      data: { user },
    } = await session.auth.getUser()
    if (user && !(await mayReuseFieldTestGuest(user, authorization, dependencies))) {
      return jsonError("Bitte starte den Produkttest in einer separaten Browser-Sitzung", 409)
    }

    try {
      let userId = user?.id ?? null
      if (!userId) {
        const guest = await dependencies.createGuest(undefined, {
          campaignId: authorization.campaignId,
          funnelSessionId: authorization.funnelSessionId,
          leadId: authorization.leadId,
        })
        userId = guest.userId
        const { error } = await session.auth.signInWithPassword({
          email: guest.email,
          password: guest.password,
        })
        if (error) throw error
      }
      await dependencies.activate({
        campaignId: authorization.campaignId,
        funnelSessionId: authorization.funnelSessionId,
        leadId: authorization.leadId,
        userId,
        eventId: crypto.randomUUID(),
      })
      return response
    } catch {
      return copyResponseCookies(
        response,
        jsonError("Testzugang konnte nicht aktiviert werden", 503),
      )
    }
  }
}

export const POST = createPersonalPlanFieldTestActivationHandler()

async function mayReuseFieldTestGuest(
  user: FieldTestAuthUser,
  authorization: PersonalPlanFieldTestOfferAuthorization,
  dependencies: ActivationDependencies,
) {
  if (user.app_metadata?.access_kind !== "field_test") return false
  const claimMatches =
    user.app_metadata.field_test_campaign_id === authorization.campaignId &&
    user.app_metadata.field_test_funnel_session_id === authorization.funnelSessionId &&
    user.app_metadata.field_test_lead_id === authorization.leadId
  if (claimMatches) return true
  return dependencies.isGuestRetry({
    campaignId: authorization.campaignId,
    funnelSessionId: authorization.funnelSessionId,
    leadId: authorization.leadId,
    userId: user.id,
  })
}

function createFieldTestSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Supabase auth is unavailable")
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  }) as unknown as FieldTestSessionClient
}

async function readLeadId(request: Request) {
  try {
    const body: unknown = await request.json()
    const leadId =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).leadId
        : null
    return typeof leadId === "string" && UUID.test(leadId) ? leadId : null
  } catch {
    return null
  }
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

function rateLimitResponse(error?: string) {
  return jsonError(
    error === "service_unavailable"
      ? "Testzugang ist gerade nicht verfügbar"
      : "Zu viele Versuche. Bitte warte kurz.",
    error === "service_unavailable" ? 503 : 429,
  )
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie)
  return target
}
