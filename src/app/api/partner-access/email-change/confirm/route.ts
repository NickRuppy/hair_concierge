import { NextResponse } from "next/server"

import { consumePartnerEmailChange } from "@/lib/partner-access/email-change"
import { projectPartnerInvitationCredential } from "@/lib/partner-access/token"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

type ConfirmDependencies = {
  consume: typeof consumePartnerEmailChange
  projectCredential: typeof projectPartnerInvitationCredential
  secret: () => string | undefined
}

export function createPartnerEmailChangeConfirmHandler(
  overrides: Partial<ConfirmDependencies> = {},
) {
  return async function POST(request: Request) {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      return jsonError("Ungültige Anfrage.", 403)
    const token = await readToken(request)
    const secret = overrides.secret?.() ?? process.env.PARTNER_ACCESS_INVITATION_SIGNING_SECRET
    if (!token || !secret) return jsonError("Dieser Bestätigungslink ist nicht verfügbar.", 410)
    try {
      const corrected = await (overrides.consume ?? consumePartnerEmailChange)(token)
      const credential = (overrides.projectCredential ?? projectPartnerInvitationCredential)(
        corrected,
        secret,
      )
      return NextResponse.json(
        { destination: `/partner/einladung?bestaetigt=1#code=${encodeURIComponent(credential)}` },
        { headers: NO_STORE_HEADERS },
      )
    } catch {
      return jsonError("Dieser Bestätigungslink ist nicht verfügbar.", 410)
    }
  }
}

export const POST = createPartnerEmailChangeConfirmHandler()

async function readToken(request: Request) {
  try {
    const body: unknown = await request.json()
    const token =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).token
        : null
    return typeof token === "string" && token.length <= 256 ? token : null
  } catch {
    return null
  }
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS })
}
