import { NextResponse } from "next/server"

import { resolvePartnerJourney } from "@/lib/partner-access/journey"

type PartnerQuizContextDependencies = {
  resolvePartnerJourney: typeof resolvePartnerJourney
}

const defaultDependencies: PartnerQuizContextDependencies = {
  resolvePartnerJourney,
}

export function createPartnerQuizContextGetHandler(
  overrides: Partial<PartnerQuizContextDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async function GET() {
    try {
      const partner = await dependencies.resolvePartnerJourney()
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
