import { NextResponse } from "next/server"
import { z } from "zod"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import { createSupabaseRoutineAcquisitionService } from "@/lib/personal-plan/routine/acquisition"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const paramsSchema = z.object({ itemKey: z.string().min(1).max(256) }).strict()
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

type Service = ReturnType<typeof createSupabaseRoutineAcquisitionService>
export type PersonalPlanRoutineAcquireRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  service: () => Service
}

export function createPersonalPlanRoutineAcquireRouteHandlers(
  deps: PersonalPlanRoutineAcquireRouteDeps,
) {
  return {
    async POST(_request: Request, context: { params: Promise<{ itemKey: string }> }) {
      if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        const journey = await deps.loadJourneyAccess(userId)
        if (!canAccessPersonalPlanJourneyStage(journey, "stage4")) {
          return response({ error: "stage_not_ready" }, 409)
        }
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
      const params = paramsSchema.safeParse(await context.params)
      if (!params.success) return response({ error: "item_not_found" }, 404)
      try {
        const result = await deps.service().acquire({
          userId,
          itemKey: params.data.itemKey,
        })
        if (result.status === "not_found") return response({ error: "item_not_found" }, 404)
        if (result.status === "temporarily_unavailable")
          return response({ error: result.status }, 503)
        return response(result)
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createPersonalPlanRoutineAcquireRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
  service: () => createSupabaseRoutineAcquisitionService(createAdminClient()),
})
// Acquisition drains the same sync worker, whose self-heal lane runs the
// headless Stage-3 recompute inline (`routine/production-sync-service.ts`) —
// the same shape `accept-ideal-plan/route.ts` needs the raised ceiling for.
export const maxDuration = 60
export const POST = handlers.POST
