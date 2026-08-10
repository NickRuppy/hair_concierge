import { NextResponse } from "next/server"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { createClient } from "@/lib/supabase/server"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"

export type PersonalPlanRoutineAttentionRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPersonalPlanRoutineAttentionRouteHandlers(
  deps: PersonalPlanRoutineAttentionRouteDeps,
) {
  return {
    async GET() {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      if (!deps.enabled()) return response({ hasPendingProposal: false })
      try {
        const journey = await deps.loadJourneyAccess(userId)
        if (!canAccessPersonalPlanJourneyStage(journey, "stage4")) {
          return response({ hasPendingProposal: false })
        }
        return response({
          hasPendingProposal:
            journey.kind === "personal_plan" && journey.hasPendingRoutineProposal === true,
        })
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createPersonalPlanRoutineAttentionRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
})
export const GET = async () => {
  const startedAt = performance.now()
  const result = await handlers.GET()
  const durationMs = performance.now() - startedAt
  result.headers.set("Server-Timing", `personal_plan_attention;dur=${durationMs.toFixed(2)}`)
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "routine_attention_read",
    outcome: result.ok ? "ok" : "error",
    status: result.status,
    durationMs,
  })
  return result
}
