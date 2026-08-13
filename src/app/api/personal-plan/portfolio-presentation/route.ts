import { NextResponse } from "next/server"

import {
  loadOwnerPortfolioPresentation,
  type PortfolioPresentationReadClient,
} from "@/lib/personal-plan/routine/portfolio-presentation"
import {
  loadOwnerRoutinePlan,
  loadOwnerRoutineVersion,
  type PersonalPlanRoutineReadClient,
} from "@/lib/personal-plan/routine/repository"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

type ReadClient = PersonalPlanRoutineReadClient & PortfolioPresentationReadClient

export type PortfolioPresentationRouteDeps = {
  getUserId: () => Promise<string | null>
  client: () => ReadClient
}

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPortfolioPresentationRouteHandlers(deps: PortfolioPresentationRouteDeps) {
  return {
    async GET() {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        const client = deps.client()
        const plan = await loadOwnerRoutinePlan(client, userId)
        if (!plan?.active_routine_version_id) return response({ presentation: null })
        const version = await loadOwnerRoutineVersion(
          client,
          userId,
          plan.id,
          plan.active_routine_version_id,
        )
        if (!version?.source_portfolio_version_id) return response({ presentation: null })
        return response({
          presentation: await loadOwnerPortfolioPresentation(
            client,
            userId,
            plan.id,
            version.source_portfolio_version_id,
          ),
        })
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createPortfolioPresentationRouteHandlers({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  client: () => createAdminClient() as unknown as ReadClient,
})

export const GET = () => handlers.GET()
