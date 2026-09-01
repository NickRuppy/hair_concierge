import { NextResponse, type NextRequest } from "next/server"

import { issuePartnerEmailChange } from "@/lib/partner-access/email-change"
import {
  decodePartnerAccessIntent,
  PARTNER_ACCESS_INTENT_COOKIE,
} from "@/lib/partner-access/intent"
import { createAdminClient } from "@/lib/supabase/admin"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Intent = NonNullable<ReturnType<typeof decodePartnerAccessIntent>>
type Invitation = {
  display_name: string
  normalized_email: string
  token_version: number
  claimed_user_id: string | null
  revoked_at: string | null
}
type EmailChangeDependencies = {
  decodeIntent: typeof decodePartnerAccessIntent
  loadInvitation: (intent: Intent) => Promise<Invitation | null>
  issue: typeof issuePartnerEmailChange
  secret: () => string | undefined
}

export function createPartnerEmailChangeHandler(overrides: Partial<EmailChangeDependencies> = {}) {
  return async function POST(request: NextRequest) {
    if (request.headers.get("origin") !== request.nextUrl.origin)
      return jsonError("Ungültige Anfrage.", 403)
    const secret = overrides.secret?.() ?? process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET
    const intent = secret
      ? (overrides.decodeIntent ?? decodePartnerAccessIntent)(
          request.cookies.get(PARTNER_ACCESS_INTENT_COOKIE)?.value,
          secret,
        )
      : null
    if (!intent) return jsonError("Diese Einladung ist nicht verfügbar.", 410)
    const email = await readEmail(request)
    if (!email) return jsonError("Bitte gib eine gültige E-Mail-Adresse ein.", 400)

    const invitation = await (overrides.loadInvitation ?? loadInvitation)(intent).catch(() => null)
    if (
      !invitation ||
      invitation.revoked_at ||
      invitation.claimed_user_id ||
      invitation.token_version !== intent.tokenVersion
    ) {
      return jsonError("Diese Einladung ist nicht verfügbar.", 410)
    }
    if (invitation.normalized_email === email)
      return jsonError("Diese E-Mail ist bereits eingetragen.", 400)

    try {
      await (overrides.issue ?? issuePartnerEmailChange)({
        invitationId: intent.invitationId,
        tokenVersion: intent.tokenVersion,
        name: invitation.display_name,
        email,
        siteUrl: request.nextUrl.origin,
      })
      return NextResponse.json({ accepted: true }, { headers: NO_STORE_HEADERS })
    } catch (error) {
      if (hasErrorCode(error, "55P03")) {
        return jsonError("Bitte warte kurz und versuche es dann noch einmal.", 429)
      }
      return jsonError("Der Bestätigungslink konnte nicht gesendet werden.", 503)
    }
  }
}

export const POST = createPartnerEmailChangeHandler()

async function loadInvitation(intent: Intent): Promise<Invitation | null> {
  const { data, error } = await createAdminClient()
    .from("partner_access_invitations")
    .select("display_name,normalized_email,token_version,claimed_user_id,revoked_at")
    .eq("id", intent.invitationId)
    .maybeSingle()
  if (error) throw error
  return (data as Invitation | null) ?? null
}

async function readEmail(request: Request) {
  try {
    const body: unknown = await request.json()
    const value =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).email
        : null
    if (typeof value !== "string") return null
    const email = value.trim().toLowerCase()
    return EMAIL.test(email) && email.length <= 320 ? email : null
  } catch {
    return null
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}

function hasErrorCode(error: unknown, code: string) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === code)
}
