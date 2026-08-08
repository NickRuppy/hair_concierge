import { NextResponse } from "next/server"

import { loadPersonalPlanRoutineView } from "@/lib/personal-plan/routine/load-view"
import type { PersonalPlanRoutineReadClient } from "@/lib/personal-plan/routine/repository"
import {
  isPersonalPlanAppV1Enabled,
  isPersonalPlanStage4Enabled,
} from "@/lib/personal-plan/release"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type PersonalPlanRoutineRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  client: () => PersonalPlanRoutineReadClient
}
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createPersonalPlanRoutineRouteHandlers(deps: PersonalPlanRoutineRouteDeps) {
  return {
    async GET() {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)
      try {
        return response(
          await loadPersonalPlanRoutineView({
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

const handlers = createPersonalPlanRoutineRouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled() && isPersonalPlanStage4Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  client: () => createAdminClient() as unknown as PersonalPlanRoutineReadClient,
})
export const GET = handlers.GET
