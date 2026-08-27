import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import {
  encodeFunnelContext,
  funnelSessionCookieOptions,
  FUNNEL_SESSION_COOKIE,
  FUNNEL_TOUCH_COOKIE,
} from "@/lib/funnel/cookie"
import { getFunnelPackageByKey } from "@/lib/funnel/packages"
import {
  createPersonalPlanFieldTestCampaignCookie,
  personalPlanFieldTestCampaignCookieOptions,
} from "@/lib/personal-plan-field-test/campaign-cookie"
import {
  createModeratorIntent,
  resolveModeratorIntent,
  resolveModeratorMember,
} from "@/lib/personal-plan-field-test/moderator"
import { MODERATOR_INTENT_COOKIE } from "@/lib/personal-plan-field-test/moderator-contract"
import { personalPlanFieldTestCookieSecret } from "@/lib/personal-plan-field-test/server"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { PERSONAL_PLAN_QUIZ_DRAFT_COOKIE } from "@/lib/personal-plan-quiz/server-draft"
import { PERSONAL_PLAN_RESULT_RETURN_COOKIE } from "@/lib/personal-plan-quiz/result-return"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

type ModeratorUser = { id: string; email?: string; email_confirmed_at?: string | null }
type StartDependencies = {
  getUser: () => Promise<ModeratorUser | null>
  resolveMember: typeof resolveModeratorMember
  createFunnelSession: (input: {
    campaignId: string
    userId: string
    visitorId: string
    now: number
  }) => Promise<string | null>
  createIntent: typeof createModeratorIntent
  resolveIntent: typeof resolveModeratorIntent
  resolveFunnelContext: typeof resolveFunnelCookieContext
  encodeFunnelContext: typeof encodeFunnelContext
  funnelSecret: () => string | undefined
  campaignCookieSecret: () => string | null
  moderatorIntentSecretConfigured: () => boolean
  enabled: () => boolean
  now: () => number
  randomUUID: () => string
}

const DEFAULT_DEPENDENCIES: StartDependencies = {
  async getUser() {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
      ? { id: user.id, email: user.email, email_confirmed_at: user.email_confirmed_at }
      : null
  },
  resolveMember: resolveModeratorMember,
  createFunnelSession: createModeratorFunnelSession,
  createIntent: createModeratorIntent,
  resolveIntent: resolveModeratorIntent,
  resolveFunnelContext: resolveFunnelCookieContext,
  encodeFunnelContext,
  funnelSecret: () => process.env.FUNNEL_COOKIE_SIGNING_SECRET,
  campaignCookieSecret: personalPlanFieldTestCookieSecret,
  moderatorIntentSecretConfigured: () =>
    Boolean(process.env.PERSONAL_PLAN_FIELD_TEST_COOKIE_SIGNING_SECRET),
  enabled: () => process.env.PERSONAL_PLAN_FIELD_TEST_ENABLED === "true",
  now: Date.now,
  randomUUID,
}

export function createModeratorFieldTestStartHandler(overrides: Partial<StartDependencies> = {}) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  return async function POST(request: Request) {
    if (!isSameOrigin(request)) return jsonError("Ungültige Anfrage", 403)
    const campaignId = await readCampaignId(request)
    if (!campaignId) return jsonError("Ungültige Anfrage", 400)

    let user: ModeratorUser | null
    try {
      user = await dependencies.getUser()
    } catch {
      return jsonError("Testzugang ist gerade nicht verfügbar", 503)
    }
    if (!user) return jsonError("Bitte melde dich zuerst an", 401)

    let member: Awaited<ReturnType<typeof dependencies.resolveMember>>
    try {
      member = await dependencies.resolveMember({ campaignId, user })
    } catch {
      return jsonError("Testzugang ist gerade nicht verfügbar", 503)
    }
    if (member.kind === "forbidden")
      return jsonError("Dieses Konto kann diese Einladung nicht nutzen", 403)
    if (member.kind === "ended") return jsonError("Dieser Produkttest ist beendet", 410)
    if (member.kind === "active")
      return NextResponse.json({ destination: "/plan-start" }, { headers: NO_STORE_HEADERS })
    if (member.kind !== "ready") return jsonError("Testzugang ist gerade nicht verfügbar", 503)
    if (!dependencies.enabled())
      return jsonError("Dieser Produkttest ist gerade nicht verfügbar", 404)

    const now = dependencies.now()
    const funnelSecret = dependencies.funnelSecret()
    const campaignCookieSecret = dependencies.campaignCookieSecret()
    if (!funnelSecret || !campaignCookieSecret || !dependencies.moderatorIntentSecretConfigured())
      return jsonError("Testzugang ist gerade nicht verfügbar", 503)

    const existing = await resolveExistingOrganicStart({
      request,
      user,
      campaignId: member.campaign.id,
      resolveIntent: dependencies.resolveIntent,
      resolveFunnelContext: dependencies.resolveFunnelContext,
    })
    if (existing) {
      return NextResponse.json(
        { destination: "/quiz", funnelSessionId: existing, freshStart: false },
        { headers: NO_STORE_HEADERS },
      )
    }

    const visitorId = dependencies.randomUUID()
    let funnelSessionId: string | null
    try {
      funnelSessionId = await dependencies.createFunnelSession({
        campaignId: member.campaign.id,
        userId: user.id,
        visitorId,
        now,
      })
    } catch {
      return jsonError("Testzugang ist gerade nicht verfügbar", 503)
    }
    if (!funnelSessionId) return jsonError("Testzugang ist gerade nicht verfügbar", 503)

    const intent = dependencies.createIntent({
      campaignId: member.campaign.id,
      userId: user.id,
      funnelSessionId,
      issuedAt: now,
      expiresAt: member.campaign.expiresAt,
    })
    const campaignCookie = createPersonalPlanFieldTestCampaignCookie(
      {
        campaignId: member.campaign.id,
        accessDurationHours: member.campaign.accessDurationHours,
        issuedAt: now,
        expiresAt: member.campaign.expiresAt,
      },
      campaignCookieSecret,
    )
    const funnelCookie = await dependencies.encodeFunnelContext(
      {
        visitorId,
        sessionId: funnelSessionId,
        packageKey: "default_organic",
        issuedAt: now,
      },
      funnelSecret,
    )
    if (!intent || !campaignCookie || !funnelCookie)
      return jsonError("Testzugang ist gerade nicht verfügbar", 503)

    const response = NextResponse.json(
      { destination: "/quiz", funnelSessionId, freshStart: true },
      { headers: NO_STORE_HEADERS },
    )
    response.cookies.set(MODERATOR_INTENT_COOKIE, intent, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.max(1, Math.floor((member.campaign.expiresAt - now) / 1000)),
    })
    response.cookies.set(
      "chaarlie_personal_plan_field_test",
      campaignCookie,
      personalPlanFieldTestCampaignCookieOptions,
    )
    response.cookies.set(FUNNEL_SESSION_COOKIE, funnelCookie, funnelSessionCookieOptions)
    response.cookies.set(FUNNEL_TOUCH_COOKIE, "", { path: "/", maxAge: 0 })
    response.cookies.set(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE, "", { path: "/", maxAge: 0 })
    response.cookies.set(PERSONAL_PLAN_RESULT_RETURN_COOKIE, "", { path: "/", maxAge: 0 })
    return response
  }
}

async function resolveExistingOrganicStart(input: {
  request: Request
  user: ModeratorUser
  campaignId: string
  resolveIntent: typeof resolveModeratorIntent
  resolveFunnelContext: typeof resolveFunnelCookieContext
}): Promise<string | null> {
  const intent = readCookie(input.request, MODERATOR_INTENT_COOKIE)
  const funnelCookie = readCookie(input.request, FUNNEL_SESSION_COOKIE)
  if (!intent || !funnelCookie) return null

  try {
    const funnelContext = await input.resolveFunnelContext(funnelCookie)
    if (!funnelContext || funnelContext.packageKey !== "default_organic") return null
    const resolved = await input.resolveIntent(intent, input.user, funnelContext)
    return resolved.kind === "ready" &&
      resolved.intent.campaignId === input.campaignId &&
      resolved.intent.funnelSessionId === funnelContext.sessionId
      ? funnelContext.sessionId
      : null
  } catch {
    return null
  }
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=")
    if (key === name) return value.join("=") || null
  }
  return null
}

export const POST = createModeratorFieldTestStartHandler()

type FunnelSessionInsertClient = {
  from: (table: "funnel_sessions") => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>
  }
}

export async function createModeratorFunnelSession(
  input: {
    campaignId: string
    userId: string
    visitorId: string
    now: number
  },
  client: FunnelSessionInsertClient = createAdminClient() as unknown as FunnelSessionInsertClient,
  createId: () => string = randomUUID,
): Promise<string | null> {
  const funnelPackage = getFunnelPackageByKey("default_organic")
  if (!funnelPackage) return null
  const id = createId()
  const { error } = await client.from("funnel_sessions").insert({
    id,
    visitor_id: input.visitorId,
    user_id: input.userId,
    package_key: funnelPackage.key,
    channel: funnelPackage.channel,
    landing_variant: funnelPackage.landingVariant,
    offer_variant: funnelPackage.offerVariant,
    quiz_variant: funnelPackage.quizVariant,
    first_seen_at: new Date(input.now).toISOString(),
    test_kind: "field_test",
    field_test_campaign_id: input.campaignId,
  })
  return error ? null : id
}

async function readCampaignId(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json()
    const campaignId =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).campaignId
        : null
    return typeof campaignId === "string" && UUID.test(campaignId) ? campaignId : null
  } catch {
    return null
  }
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  return origin === new URL(request.url).origin
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
