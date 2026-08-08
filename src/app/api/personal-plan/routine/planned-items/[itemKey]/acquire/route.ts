import { NextResponse } from "next/server"
import { z } from "zod"

import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
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
  service: () => Service
}

export function createPersonalPlanRoutineAcquireRouteHandlers(
  deps: PersonalPlanRoutineAcquireRouteDeps,
) {
  return {
    async POST(_request: Request, context: { params: Promise<{ itemKey: string }> }) {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
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
  service: () => createSupabaseRoutineAcquisitionService(createAdminClient()),
})
export const POST = handlers.POST
