import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import {
  PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE,
  resolvePersonalPlanFieldTestOfferAuthorization,
} from "@/lib/personal-plan-field-test"
import {
  activatePersonalPlanModeratorTestEnrollment,
  MODERATOR_INTENT_COOKIE,
  resolveModeratorIntent,
} from "@/lib/personal-plan-field-test/moderator"
import { checkRateLimit, type RateLimitConfig } from "@/lib/rate-limit"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export const MODERATOR_ACTIVATION_IP_RATE_LIMIT = {
  prefix: "personal-plan-moderator-activation-ip",
  limit: 20,
  windowMs: 60 * 60_000,
} satisfies RateLimitConfig

export const MODERATOR_ACTIVATION_SESSION_RATE_LIMIT = {
  prefix: "personal-plan-moderator-activation-session",
  limit: 8,
  windowMs: 10 * 60_000,
} satisfies RateLimitConfig

type ModeratorAuthUser = {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
}

type ModeratorSessionClient = {
  auth: {
    getUser: () => Promise<{ data: { user: ModeratorAuthUser | null } }>
  }
}

type ModeratorActivationDependencies = {
  packageKey: "meta_personal_plan_v1" | "default_organic"
  checkRateLimit: typeof checkRateLimit
  resolveFunnelCookieContext: typeof resolveFunnelCookieContext
  resolveModeratorIntent: typeof resolveModeratorIntent
  resolveAuthorization: typeof resolvePersonalPlanFieldTestOfferAuthorization
  activate: typeof activatePersonalPlanModeratorTestEnrollment
  createSession: (request: NextRequest, response: NextResponse) => ModeratorSessionClient
}

const DEFAULT_DEPENDENCIES: ModeratorActivationDependencies = {
  packageKey: "meta_personal_plan_v1",
  checkRateLimit,
  resolveFunnelCookieContext,
  resolveModeratorIntent,
  resolveAuthorization: resolvePersonalPlanFieldTestOfferAuthorization,
  activate: activatePersonalPlanModeratorTestEnrollment,
  createSession: createModeratorSession,
}

export function createPersonalPlanModeratorActivationHandler(
  overrides: Partial<ModeratorActivationDependencies> = {},
) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  return async function POST(request: NextRequest) {
    if (!isSameOriginPost(request)) return jsonError("Ungültige Anfrage", 403)

    const ipRateLimit = await dependencies.checkRateLimit(
      requestIp(request),
      MODERATOR_ACTIVATION_IP_RATE_LIMIT,
    )
    if (!ipRateLimit.allowed) return rateLimitResponse(ipRateLimit.error)

    const leadId = await readLeadId(request)
    if (!leadId) return jsonError("Ungültige Anfrage", 400)

    const response = NextResponse.json(
      { destination: `/plan-bereit?lead=${encodeURIComponent(leadId)}` },
      { headers: NO_STORE_HEADERS },
    )
    let session: ModeratorSessionClient
    try {
      session = dependencies.createSession(request, response)
    } catch {
      return jsonError("Testzugang konnte nicht aktiviert werden", 503)
    }
    let user: ModeratorAuthUser | null
    try {
      user = (await session.auth.getUser()).data.user
    } catch {
      return jsonError("Testzugang konnte nicht aktiviert werden", 503)
    }
    if (!user?.email || !user.email_confirmed_at) {
      return jsonError("Bitte melde dich mit deinem eingeladenen Konto an", 401)
    }

    const funnelContext = await dependencies
      .resolveFunnelCookieContext(request.cookies.get(FUNNEL_SESSION_COOKIE)?.value)
      .catch(() => null)
    if (!funnelContext || funnelContext.packageKey !== dependencies.packageKey) {
      return jsonError("Testzugang ist nicht verfügbar", 403)
    }

    const sessionRateLimit = await dependencies.checkRateLimit(
      funnelContext.sessionId,
      MODERATOR_ACTIVATION_SESSION_RATE_LIMIT,
    )
    if (!sessionRateLimit.allowed) return rateLimitResponse(sessionRateLimit.error)

    const intent = await dependencies
      .resolveModeratorIntent(
        request.cookies.get(MODERATOR_INTENT_COOKIE)?.value,
        user,
        { sessionId: funnelContext.sessionId, packageKey: funnelContext.packageKey },
        { leadId },
      )
      .catch(() => ({ kind: "unavailable" as const }))
    if (intent.kind !== "ready" && intent.kind !== "active") {
      return jsonError("Testzugang ist nicht verfügbar", intent.kind === "unavailable" ? 503 : 403)
    }

    const activationContext =
      intent.kind === "active"
        ? {
            campaignId: intent.intent.campaignId,
            funnelSessionId: intent.intent.funnelSessionId,
            leadId: intent.intent.leadId ?? leadId,
          }
        : await dependencies
            .resolveAuthorization({
              campaignCookieValue: request.cookies.get(PERSONAL_PLAN_FIELD_TEST_CAMPAIGN_COOKIE)
                ?.value,
              funnelSessionId: funnelContext.sessionId,
              leadId,
              allowEmailBound: true,
            })
            .catch(() => null)
    if (
      !activationContext ||
      activationContext.campaignId !== intent.intent.campaignId ||
      activationContext.funnelSessionId !== funnelContext.sessionId ||
      activationContext.leadId !== leadId
    ) {
      return jsonError("Testzugang ist nicht verfügbar", 403)
    }

    try {
      await dependencies.activate({
        campaignId: activationContext.campaignId,
        funnelSessionId: activationContext.funnelSessionId,
        leadId: activationContext.leadId,
        userId: user.id,
        confirmedEmail: user.email,
        eventId: crypto.randomUUID(),
      })
      return response
    } catch {
      return jsonError("Testzugang konnte nicht aktiviert werden", 503)
    }
  }
}

export const POST = createPersonalPlanModeratorActivationHandler()

function createModeratorSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Supabase auth is unavailable")
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) =>
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  }) as unknown as ModeratorSessionClient
}

function isSameOriginPost(request: NextRequest) {
  const origin = request.headers.get("origin")
  return !origin || origin === new URL(request.url).origin
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
