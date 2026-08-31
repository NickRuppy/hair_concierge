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
import { recomputeRoutineAfterHabitsCompletion } from "@/lib/personal-plan/refinement-recompute/orchestrator"
import { createProductionStage3RecomputeDeps } from "@/lib/personal-plan/refinement-recompute/production-deps"
import type { Stage3RecomputeResult } from "@/lib/personal-plan/refinement-recompute/types"

export type Stage2RouteDeps = {
  getUserId: () => Promise<string | null>
  gatewayFor: (userId: string) => Stage2RefinementGateway
  enabled: () => boolean
  loadStage2Access: (userId: string) => Promise<PersonalPlanStage2Access>
  /**
   * Runs the headless habits-recompute lane after a Verhalten (habits) module
   * completion. Returns `null` when the plan has no active routine yet — the
   * cheap gate this dep applies BEFORE doing any Stage-3 work, so the caller
   * knows to omit the response field entirely rather than report a no-op
   * outcome. Never expected to throw (the production wiring's own gate read
   * and the orchestrator itself are both defensive), but the route wraps the
   * call in its own try/catch regardless — a failure here must never fail
   * the habits module completion that triggered it.
   */
  runHabitsRecompute: (input: {
    userId: string
    refinedVersionId: string
  }) => Promise<Stage3RecomputeResult | null>
}

/** The client-visible shape added to `moduleCompletion.recompute` — no reasons or retryability. */
type HabitsRecomputeClientOutcome = { outcome: "applied" | "unchanged" | "unavailable" }

/**
 * Runs the habits-recompute lane and reports it via the same telemetry idiom
 * as the rest of this route: a `reportPersonalPlanTransitionTiming` entry
 * (outcome carries the unavailable reason, e.g. `unavailable:decision_blocked`,
 * for server-side comparison) plus a matching `console.info` line. Any
 * failure — from the dep itself, not just from the orchestrator it wraps —
 * is caught here and reported as a retryable `unexpected_error`, so this
 * function itself never throws.
 */
async function runHabitsRecomputeLane(
  deps: Stage2RouteDeps,
  userId: string,
  refinedVersionId: string,
): Promise<HabitsRecomputeClientOutcome | null> {
  const phaseStarted = performance.now()
  let outcome: HabitsRecomputeClientOutcome["outcome"]
  let reason: string | undefined
  let retryable: boolean | undefined
  let cause: unknown
  try {
    const result = await deps.runHabitsRecompute({ userId, refinedVersionId })
    if (result === null) return null
    if (result.status === "unavailable") {
      outcome = "unavailable"
      reason = result.reason
      retryable = result.retryable
      cause = result.cause
    } else {
      outcome = result.status
    }
  } catch (error) {
    outcome = "unavailable"
    reason = "unexpected_error"
    retryable = true
    cause = error
  }
  reportPersonalPlanTransitionTiming({
    layer: "server",
    operation: "stage2_habits_recompute",
    outcome: reason ? `unavailable:${reason}` : outcome,
    durationMs: performance.now() - phaseStarted,
  })
  console.info("personal_plan_stage2_api", {
    event: "habits_recompute",
    outcome,
    ...(reason ? { reason } : {}),
    ...(retryable !== undefined ? { retryable } : {}),
    ...(cause !== undefined
      ? { cause: cause instanceof Error ? cause.message : String(cause) }
      : {}),
  })
  return { outcome }
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
    operation: (gateway: Stage2RefinementGateway, userId: string) => Promise<unknown>,
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
      const result = await operation(deps.gatewayFor(userId), userId)
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
      run("save", async (gateway, userId) => {
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
            if (completeModuleAfterSave !== "habits") {
              return { session: savedSession, moduleCompletion }
            }
            const recompute = await runHabitsRecomputeLane(
              deps,
              userId,
              moduleCompletion.refinedVersionId,
            )
            return {
              session: savedSession,
              moduleCompletion: recompute ? { ...moduleCompletion, recompute } : moduleCompletion,
            }
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
  runHabitsRecompute: async ({ userId, refinedVersionId }) => {
    const admin = createAdminClient()
    // Cheapest existing read that exposes `active_routine_version_id` (see
    // `journey-access-loader.ts`'s `loadPlan` / `accept-ideal-plan/route.ts`'s
    // `planState.loadActiveRoutineVersionId`): a single-column-pair lookup on
    // the owner's one `personal_plans` row. No active routine ⇒ skip the
    // headless Stage-3 pass entirely rather than let the orchestrator's own
    // gate discover the same thing after constructing its deps.
    const { data, error } = await admin
      .from("personal_plans")
      .select("id, active_routine_version_id")
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw error
    const personalPlanId = typeof data?.id === "string" ? data.id : null
    const activeRoutineVersionId =
      typeof data?.active_routine_version_id === "string" ? data.active_routine_version_id : null
    if (!personalPlanId || !activeRoutineVersionId) return null
    return recomputeRoutineAfterHabitsCompletion(
      createProductionStage3RecomputeDeps({ userId, admin }),
      { userId, personalPlanId, refinedVersionId },
    )
  },
})
// A habits-module completion runs the headless Stage-3 recompute inline, the
// same shape `accept-ideal-plan/route.ts` needs the raised ceiling for.
export const maxDuration = 60
export const GET = handlers.GET
export const PATCH = handlers.PATCH
