import { NextResponse } from "next/server"
import { z } from "zod"

import {
  recordModuleBannerDismissal,
  type PersonalPlanLifecycleClient,
} from "@/lib/personal-plan/lifecycle/repository"
import { STAGE2_MODULES } from "@/lib/personal-plan/refinement/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

/**
 * Dismisses the Routine refinement banner (Task 2.3, mockup v3 screens 1+3)
 * for one Stage-2 module. Per-module rows in `personal_plan_ui_lifecycle_marks`
 * give the "hidden until a DIFFERENT module becomes the next open one, then
 * once more" behavior documented in lifecycle/repository.ts — this route
 * only records the mark; the `refinement-status` GET route reads it back
 * into `banner.dismissed`.
 *
 * Writes to the lifecycle table THROW pre-migration (undefined_table) by
 * contract (see lifecycle/repository.ts's module doc comment). The Routine
 * client tolerates that by design: it hides the banner locally for the
 * session regardless of this route's response, so a 503 here never surfaces
 * an error to the user — it only means the dismissal does not persist past
 * this visit and the banner may return on the next full page load.
 */

const dismissBodySchema = z.object({ module: z.enum(STAGE2_MODULES) }).strict()

export type RefinementBannerDismissRouteDeps = {
  getUserId: () => Promise<string | null>
  client: () => PersonalPlanLifecycleClient
  now?: () => string
}

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export function createRefinementBannerDismissRouteHandlers(deps: RefinementBannerDismissRouteDeps) {
  const now = deps.now ?? (() => new Date().toISOString())
  return {
    async POST(request: Request) {
      const userId = await deps.getUserId()
      if (!userId) return response({ error: "unauthorized" }, 401)

      let rawBody: unknown
      try {
        rawBody = await request.json()
      } catch {
        return response({ error: "invalid_body" }, 400)
      }
      const parsed = dismissBodySchema.safeParse(rawBody)
      if (!parsed.success) return response({ error: "invalid_body" }, 400)

      try {
        await recordModuleBannerDismissal(deps.client(), {
          userId,
          module: parsed.data.module,
          dismissedAt: now(),
        })
        return response({ status: "dismissed", module: parsed.data.module })
      } catch {
        return response({ error: "temporarily_unavailable" }, 503)
      }
    },
  }
}

const handlers = createRefinementBannerDismissRouteHandlers({
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  client: () => createAdminClient() as unknown as PersonalPlanLifecycleClient,
})
export const POST = handlers.POST
