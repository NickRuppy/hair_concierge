import { NextResponse } from "next/server"
import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { createSupabaseStage2RefinementPersistence } from "@/lib/personal-plan/persistence/stage2-refinement-supabase"
import { createPersistedStage2RefinementGateway } from "@/lib/personal-plan/refinement/production-persistence-gateway"
import {
  loadPersonalPlanStage2AccessForUser,
  type PersonalPlanStage2Access,
} from "@/lib/personal-plan/journey-access-loader"
import { reportPersonalPlanTransitionTiming } from "@/lib/personal-plan/transition-performance"
import {
  Stage2RefinementError,
  type Stage2RefinementGateway,
  type Stage2SaveAnswerInput,
} from "@/lib/personal-plan/refinement/gateway"
import { STAGE2_MODULES } from "@/lib/personal-plan/refinement/types"

export type Stage2RouteDeps = {
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage2RefinementGateway
  enabled: () => boolean
  loadStage2Access: (userId: string) => Promise<PersonalPlanStage2Access>
}

const saveRequestSchema = z
  .object({
    questionId: z.string().min(1).max(96),
    answer: z.unknown(),
    expectedRevision: z.number().int().nonnegative(),
    completeAfterSave: z.literal(true).optional(),
    /** Module completion after the save; the module-scoped sibling of `completeAfterSave`. */
    completeModuleAfterSave: z.enum(STAGE2_MODULES).optional(),
  })
  .strict()
  .refine((value) => !(value.completeAfterSave && value.completeModuleAfterSave), {
    message: "completeAfterSave and completeModuleAfterSave are mutually exclusive",
  })

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
  if (error instanceof Stage2InvalidRequestError) {
    return response({ error: "invalid_request" }, 400)
  }
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

class Stage2InvalidRequestError extends Error {}

export function createStage2RouteHandlers(deps: Stage2RouteDeps) {
  const run = async (
    event: "load" | "save",
    operation: (gateway: Stage2RefinementGateway) => Promise<unknown>,
  ) => {
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
    try {
      phaseStarted = Date.now()
      const result = await operation(deps.gatewayFor(userId))
      phases.operation = Date.now() - phaseStarted
      console.info("personal_plan_stage2_api", {
        event,
        duration_ms: Date.now() - started,
        auth_duration_ms: phases.auth,
        journey_duration_ms: phases.journey,
        operation_duration_ms: phases.operation,
      })
      const timing = serverTiming(phases)
      if (result instanceof Response) {
        result.headers.set("Server-Timing", timing)
        return result
      }
      return response(result, 200, { "Server-Timing": timing })
    } catch (error) {
      return errorResponse(error, started)
    }
  }
  return {
    GET: () => run("load", (gateway) => gateway.load()),
    PATCH: (request: Request) =>
      run("save", async (gateway) => {
        const parsed = saveRequestSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) throw new Stage2InvalidRequestError()
        const { completeAfterSave, completeModuleAfterSave, ...saveInput } = parsed.data
        let phaseStarted = performance.now()
        const savedSession = await gateway.saveAnswer(saveInput as Stage2SaveAnswerInput)
        reportPersonalPlanTransitionTiming({
          layer: "server",
          operation: completeModuleAfterSave
            ? "stage2_module_answer_save"
            : completeAfterSave
              ? "stage2_final_answer_save"
              : "stage2_answer_save",
          outcome: "success",
          durationMs: performance.now() - phaseStarted,
        })
        if (!completeAfterSave && !completeModuleAfterSave) return savedSession
        try {
          phaseStarted = performance.now()
          if (completeModuleAfterSave) {
            if (!gateway.completeModule) {
              throw new Stage2RefinementError("temporarily_unavailable")
            }
            const moduleCompletion = await gateway.completeModule({
              module: completeModuleAfterSave,
              expectedRevision: savedSession.revision,
            })
            reportPersonalPlanTransitionTiming({
              layer: "server",
              operation: "stage2_module_completion",
              outcome: "success",
              durationMs: performance.now() - phaseStarted,
            })
            return { session: savedSession, moduleCompletion }
          }
          const handoff = await gateway.complete({ expectedRevision: savedSession.revision })
          reportPersonalPlanTransitionTiming({
            layer: "server",
            operation: "stage2_final_completion",
            outcome: "success",
            durationMs: performance.now() - phaseStarted,
          })
          return { session: savedSession, handoff }
        } catch (error) {
          const code =
            error instanceof Stage2RefinementError ? error.code : "temporarily_unavailable"
          const status =
            code === "revision_conflict"
              ? 409
              : code === "invalid_answer" ||
                  code === "question_not_current" ||
                  code === "incomplete_refinement"
                ? 422
                : 503
          console.info("personal_plan_stage2_api", {
            event: "completion_after_save_failed",
            code,
            ...(completeModuleAfterSave ? { module: completeModuleAfterSave } : {}),
          })
          reportPersonalPlanTransitionTiming({
            layer: "server",
            operation: completeModuleAfterSave
              ? "stage2_module_completion"
              : "stage2_final_completion",
            outcome: code,
            durationMs: performance.now() - phaseStarted,
          })
          return response({ error: code, savedSession }, status)
        }
      }),
  }
}

const handlers = createStage2RouteHandlers({
  enabled: () => isPersonalPlanAppV1Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadStage2Access: loadPersonalPlanStage2AccessForUser,
  gatewayFor: (userId) =>
    createPersistedStage2RefinementGateway({
      userId,
      persistence: createSupabaseStage2RefinementPersistence(createAdminClient()),
    }),
})
export const GET = handlers.GET
export const PATCH = handlers.PATCH
