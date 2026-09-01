import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveFunnelCookieContext } from "@/lib/funnel/server"
import { resolvePartnerJourney } from "@/lib/partner-access/journey"

type CookieStore = { get: (name: string) => { value: string } | undefined }

type PartnerQuizContextDependencies = {
  cookies: () => Promise<CookieStore>
  resolveFunnelCookieContext: typeof resolveFunnelCookieContext
  resolvePartnerJourney: typeof resolvePartnerJourney
}

const defaultDependencies: PartnerQuizContextDependencies = {
  cookies,
  resolveFunnelCookieContext,
  resolvePartnerJourney,
}

export function createPartnerQuizContextGetHandler(
  overrides: Partial<PartnerQuizContextDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async function GET() {
    try {
      const cookieStore = await dependencies.cookies()
      const funnelContext = await dependencies.resolveFunnelCookieContext(
        cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
      )
      const partner = await dependencies.resolvePartnerJourney({
        cookies: cookieStore,
        funnelContext,
      })
      if (partner.kind === "none") return response({ status: "regular" })
      if (partner.kind === "unavailable") return response({ status: "unavailable" })
      return response({ status: "creator", name: partner.name, email: partner.email })
    } catch (error) {
      console.warn("Partner quiz context lookup failed:", error)
      return response({ status: "unavailable" })
    }
  }
}

function response(body: Record<string, string>) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  })
}

export const GET = createPartnerQuizContextGetHandler()
