import { NextResponse } from "next/server"

import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import { resolveDiscoveryJourney } from "@/lib/discovery/journey"

/**
 * The locked identity a discovery participant's quiz runs on: their enrollment's
 * name and e-mail, re-read from the table on every request so a revoked
 * participant stops being one even while their JWT still carries the stamp.
 *
 * The partner-access `quiz-context` analogue, with the same three outcomes. A
 * signed-in ordinary user answers `regular` without any database read.
 */

type DiscoveryQuizContextDependencies = {
  resolveDiscoveryJourney: typeof resolveDiscoveryJourney
  flagEnabled: () => boolean
}

const defaultDependencies: DiscoveryQuizContextDependencies = {
  resolveDiscoveryJourney,
  flagEnabled: isDiscoveryCallToolkitEnabled,
}

export function createDiscoveryQuizContextGetHandler(
  overrides: Partial<DiscoveryQuizContextDependencies> = {},
) {
  const dependencies = { ...defaultDependencies, ...overrides }

  return async function GET() {
    // With the kill switch off nobody is a participant, so the quiz keeps its
    // ordinary identity screens.
    if (!dependencies.flagEnabled()) return response({ status: "regular" })
    try {
      const discovery = await dependencies.resolveDiscoveryJourney()
      if (discovery.kind === "none") return response({ status: "regular" })
      if (discovery.kind === "unavailable") return response({ status: "unavailable" })
      return response({
        status: "participant",
        name: discovery.enrollment.name,
        email: discovery.enrollment.email,
      })
    } catch (error) {
      console.warn("Discovery quiz context lookup failed:", error)
      return response({ status: "unavailable" })
    }
  }
}

function response(body: Record<string, string>) {
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
}

export const GET = createDiscoveryQuizContextGetHandler()
