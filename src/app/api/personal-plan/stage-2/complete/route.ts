import { NextResponse } from "next/server"
import { z } from "zod"
import { isPersonalPlanToolsEnabledForUser } from "@/lib/personal-plan/rollout-access"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { createPersistedStage2RefinementGateway } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import {
  loadPersonalPlanStage2AccessForUser,
  type PersonalPlanStage2Access,
} from "@/lib/personal-plan/journey-access-loader"
import {
  Stage2RefinementError,
  type Stage2RefinementGateway,
} from "@/lib/personal-plan/refinement/gateway"

const completeRequestSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict()

export type Stage2CompleteRouteDeps = {
  enabled: () => boolean
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage2RefinementGateway
  loadStage2Access: (userId: string) => Promise<PersonalPlanStage2Access>
}

function response(body: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  })
}

function serverTiming(phases: Record<string, number>) {
  return Object.entries(phases)
    .map(([name, duration]) => `${name};dur=${Math.max(0, Math.round(duration * 100) / 100)}`)
    .join(", ")
}

function errorResponse(error: unknown, started: number) {
  const code = error instanceof Stage2RefinementError ? error.code : "temporarily_unavailable"
  const status =
    code === "revision_conflict"
      ? 409
      : code === "invalid_answer" ||
          code === "question_not_current" ||
          code === "incomplete_refinement"
        ? 422
        : 503
  console.info("personal_plan_stage2_api", {
    event: status === 409 ? "conflict" : status === 503 ? "unavailable" : "validation_failed",
    code,
    duration_ms: Date.now() - started,
  })
  return response({ error: code }, status)
}

export function createStage2CompleteRouteHandler(deps: Stage2CompleteRouteDeps) {
  return async function POST(request: Request) {
    const started = Date.now()
    const phases: Record<string, number> = {}
    if (!deps.enabled()) return response({ error: "personal_plan_not_available" }, 404)
    let phaseStarted = Date.now()
    const userId = await deps.getUserId()
    phases.auth = Date.now() - phaseStarted
    if (!userId) return response({ error: "unauthorized" }, 401)
    try {
      phaseStarted = Date.now()
      if (!(await deps.loadStage2Access(userId)).allowed) {
        return response({ error: "stage_not_ready" }, 409)
      }
      phases.journey = Date.now() - phaseStarted
    } catch {
      return response({ error: "temporarily_unavailable" }, 503)
    }
    const parsed = completeRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return response({ error: "invalid_request" }, 400)
    try {
      phaseStarted = Date.now()
      const result = await deps.gatewayFor(userId).complete(parsed.data)
      phases.operation = Date.now() - phaseStarted
      console.info("personal_plan_stage2_api", {
        event: "complete",
        duration_ms: Date.now() - started,
      })
      return response(result, 200, { "Server-Timing": serverTiming(phases) })
    } catch (error) {
      return errorResponse(error, started)
    }
  }
}

export const POST = createStage2CompleteRouteHandler({
  enabled: isPersonalPlanAppV1Enabled,
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadStage2Access: loadPersonalPlanStage2AccessForUser,
  gatewayFor: (userId) =>
    createPersistedStage2RefinementGateway({
      userId,
      persistence: createSupabaseStage2RefinementPersistence(createAdminClient(), {
        toolsEnabled: (userId) =>
          isPersonalPlanToolsEnabledForUser(
            userId,
            createAdminClient() as unknown as Parameters<
              typeof isPersonalPlanToolsEnabledForUser
            >[1],
          ),
      }),
    }),
})
