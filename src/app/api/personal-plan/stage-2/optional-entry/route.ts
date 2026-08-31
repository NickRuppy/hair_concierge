import { NextResponse } from "next/server"
import { z } from "zod"

import {
  loadPersonalPlanStage2AccessForUser,
  type PersonalPlanStage2Access,
} from "@/lib/personal-plan/journey-access-loader"
import { openOptionalRefinement } from "@/lib/personal-plan/persistence/stage2-optional-entry"
import {
  stage2SessionFromPersistedDraft,
  type Stage2PersistedDraft,
} from "@/lib/personal-plan/persistence/stage2-refinement-service"
import { isPersonalPlanAppV1Enabled } from "@/lib/personal-plan/release"
import { Stage2RefinementError } from "@/lib/personal-plan/refinement/gateway"
import { STAGE2_MODULES, type Stage2Module } from "@/lib/personal-plan/refinement/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type Stage2OptionalEntryRouteDeps = {
  getUserId: () => Promise<string | null>
  enabled: () => boolean
  loadStage2Access: (userId: string) => Promise<PersonalPlanStage2Access>
  openOptionalRefinement: (input: {
    userId: string
    module: Stage2Module
  }) => Promise<Stage2PersistedDraft>
}

const requestSchema = z.object({ module: z.enum(STAGE2_MODULES) }).strict()

class Stage2OptionalEntryInvalidRequestError extends Error {}

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
  if (error instanceof Stage2OptionalEntryInvalidRequestError) {
    return response({ error: "invalid_request" }, 400)
  }
  const message = error instanceof Error ? error.message : ""
  const code =
    error instanceof Stage2RefinementError
      ? error.code
      : message === "revision_conflict"
        ? "revision_conflict"
        : "temporarily_unavailable"
  const status =
    code === "revision_conflict"
      ? 409
      : code === "invalid_answer" || code === "question_not_current"
        ? 422
        : 503
  console.info("personal_plan_stage2_optional_entry_api", {
    event: status === 409 ? "conflict" : status === 503 ? "unavailable" : "validation_failed",
    code,
    duration_ms: Date.now() - started,
  })
  return response({ error: code }, status)
}

export function createStage2OptionalEntryRouteHandler(deps: Stage2OptionalEntryRouteDeps) {
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

    try {
      const parsed = requestSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success) throw new Stage2OptionalEntryInvalidRequestError()
      phaseStarted = Date.now()
      const draft = await deps.openOptionalRefinement({
        userId,
        module: parsed.data.module,
      })
      phases.operation = Date.now() - phaseStarted
      console.info("personal_plan_stage2_optional_entry_api", {
        event: "opened",
        module: parsed.data.module,
        duration_ms: Date.now() - started,
        auth_duration_ms: phases.auth,
        journey_duration_ms: phases.journey,
        operation_duration_ms: phases.operation,
      })
      return response(stage2SessionFromPersistedDraft(draft), 200, {
        "Server-Timing": serverTiming(phases),
      })
    } catch (error) {
      return errorResponse(error, started)
    }
  }
}

export const POST = createStage2OptionalEntryRouteHandler({
  enabled: () => isPersonalPlanAppV1Enabled(),
  getUserId: async () => (await (await createClient()).auth.getUser()).data.user?.id ?? null,
  loadStage2Access: loadPersonalPlanStage2AccessForUser,
  openOptionalRefinement: ({ userId, module }) =>
    openOptionalRefinement({ userId, module, client: createAdminClient() }),
})
