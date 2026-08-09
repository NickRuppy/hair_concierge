import { NextResponse } from "next/server"

import { loadPersonalPlanRoutineAttention } from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type PersonalPlanRoutineAttentionRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  client: () => PersonalPlanRoutineReadClient
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
        return response(
          await loadPersonalPlanRoutineAttention({
            client: deps.client(),
            userId,
            enabled: deps.enabled(),
          }),
        )
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
  client: () => createAdminClient() as unknown as PersonalPlanRoutineReadClient,
})
export const GET = handlers.GET
