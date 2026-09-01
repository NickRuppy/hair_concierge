import { NextResponse, type NextRequest } from "next/server"

import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { sendPartnerAccountReadyEmailBestEffort } from "@/lib/partner-access/email"
import { activatePartnerOffer, resolvePartnerOfferAuthorization } from "@/lib/partner-access/offer"
import { findPersonalPlanEnrollmentForUser } from "@/lib/personal-plan/enrollment"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ActivateDependencies = {
  getUserId: () => Promise<string | null>
  resolveFunnelSessionId: (cookie: string | undefined) => Promise<string | null>
  authorize: typeof resolvePartnerOfferAuthorization
  activate: typeof activatePartnerOffer
  sendReadyEmail: typeof sendPartnerAccountReadyEmailBestEffort
  resolveDestinationLeadId: (userId: string, partnerLeadId: string) => Promise<string>
}

export function createPartnerActivateHandler(overrides: Partial<ActivateDependencies> = {}) {
  return async function POST(request: NextRequest) {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      return jsonError("Ungültige Anfrage.", 403)
    const leadId = await readLeadId(request)
    if (!leadId) return jsonError("Ungültige Anfrage.", 400)
    const [userId, funnelSessionId] = await Promise.all([
      overrides.getUserId?.() ?? defaultGetUserId(),
      (overrides.resolveFunnelSessionId ?? defaultResolveFunnelSessionId)(
        request.cookies.get(FUNNEL_SESSION_COOKIE)?.value,
      ),
    ])
    const authorization = await (overrides.authorize ?? resolvePartnerOfferAuthorization)({
      userId,
      funnelSessionId,
      leadId,
    })
    if (!authorization) return jsonError("Dein Zugang ist nicht verfügbar.", 403)
    try {
      const destinationLeadId = await (
        overrides.resolveDestinationLeadId ?? defaultResolveDestinationLeadId
      )(authorization.userId, leadId)
      const activation = await (overrides.activate ?? activatePartnerOffer)(authorization)
      if (!activation.reused) {
        await (overrides.sendReadyEmail ?? sendPartnerAccountReadyEmailBestEffort)(
          authorization.invitationId,
        )
      }
      return NextResponse.json(
        { destination: `/plan-bereit?lead=${encodeURIComponent(destinationLeadId)}` },
        { headers: NO_STORE_HEADERS },
      )
    } catch {
      return jsonError("Dein Zugang konnte nicht aktiviert werden.", 503)
    }
  }
}

export const POST = createPartnerActivateHandler()

async function defaultResolveDestinationLeadId(userId: string, partnerLeadId: string) {
  const enrollment = await findPersonalPlanEnrollmentForUser(
    createAdminClient(),
    userId,
    new Date(),
  )
  return resolvePartnerActivationDestinationLead(enrollment, partnerLeadId)
}

export function resolvePartnerActivationDestinationLead(
  enrollment: { accessState: string; artifactLeadId: string | null },
  partnerLeadId: string,
) {
  return enrollment.accessState === "active" && enrollment.artifactLeadId
    ? enrollment.artifactLeadId
    : partnerLeadId
}

async function defaultGetUserId() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return user?.id ?? null
}

async function defaultResolveFunnelSessionId(cookie: string | undefined) {
  const funnel = await resolveFunnelCookieContext(cookie)
  return funnel?.sessionId ?? null
}

async function readLeadId(request: Request) {
  try {
    const body: unknown = await request.json()
    const value =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).leadId
        : null
    return typeof value === "string" && UUID.test(value) ? value : null
  } catch {
    return null
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
