import { NextResponse, type NextRequest } from "next/server"

import {
  createPartnerAccessIntent,
  decodePartnerAccessIntent,
  PARTNER_ACCESS_INTENT_COOKIE,
  PARTNER_ACCESS_INTENT_TTL_SECONDS,
  partnerAccessIntentCookieOptions,
} from "@/lib/partner-access/intent"
import {
  resolvePartnerInvitation,
  resolvePartnerInvitationByIntent,
} from "@/lib/partner-access/service"
import { decodePartnerInvitationCredential } from "@/lib/partner-access/token"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

type ResolveDependencies = {
  resolveInvitation: typeof resolvePartnerInvitation
  resolveByIntent: typeof resolvePartnerInvitationByIntent
  decodeCredential: typeof decodePartnerInvitationCredential
  decodeIntent: typeof decodePartnerAccessIntent
  createIntent: typeof createPartnerAccessIntent
  now: () => number
}

const DEFAULT_DEPENDENCIES: ResolveDependencies = {
  resolveInvitation: resolvePartnerInvitation,
  resolveByIntent: resolvePartnerInvitationByIntent,
  decodeCredential: decodePartnerInvitationCredential,
  decodeIntent: decodePartnerAccessIntent,
  createIntent: createPartnerAccessIntent,
  now: Date.now,
}

export function createPartnerAccessResolveHandler(overrides: Partial<ResolveDependencies> = {}) {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides }
  return async function POST(request: NextRequest) {
    if (!isSameOrigin(request)) return jsonError("Ungültige Anfrage.", 403)
    const input = await readResolveInput(request)
    if (!input) return jsonError("Ungültige Anfrage.", 400)
    const secret = process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET ?? ""
    const now = dependencies.now()
    const decoded =
      input.kind === "credential"
        ? dependencies.decodeCredential(input.credential, secret)
        : dependencies.decodeIntent(
            request.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value,
            secret,
            now,
          )
    if (!decoded) return jsonError("Diese Einladung ist nicht verfügbar.", 410)
    const resolution =
      input.kind === "credential"
        ? await dependencies.resolveInvitation(input.credential)
        : await dependencies.resolveByIntent(decoded)
    if (!resolution || resolution.invitationId !== decoded.invitationId) {
      return jsonError("Diese Einladung ist nicht verfügbar.", 410)
    }

    let intent: string
    try {
      intent = dependencies.createIntent(
        {
          invitationId: decoded.invitationId,
          tokenVersion: decoded.tokenVersion,
          issuedAt: now,
          expiresAt: now + PARTNER_ACCESS_INTENT_TTL_SECONDS * 1000,
        },
        secret,
      )
    } catch {
      return jsonError("Diese Einladung ist gerade nicht verfügbar.", 503)
    }
    const response = NextResponse.json(
      { name: resolution.name, email: resolution.email, state: resolution.state },
      { headers: NO_STORE_HEADERS },
    )
    response.cookies.set(PARTNER_ACCESS_INTENT_COOKIE, intent, partnerAccessIntentCookieOptions)
    return response
  }
}

export const POST = createPartnerAccessResolveHandler()

async function readResolveInput(request: Request) {
  try {
    const body: unknown = await request.json()
    const bodyRecord =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null
    const credential = bodyRecord?.credential
    if (typeof credential === "string" && credential.length <= 512) {
      return { kind: "credential" as const, credential }
    }
    return bodyRecord?.resume === true ? { kind: "resume" as const } : null
  } catch {
    return null
  }
}

function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
