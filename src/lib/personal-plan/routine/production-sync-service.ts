import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { capturePersonalPlanRoutineTerminalSource } from "@/lib/observability/personal-plan-application"
import { createProductionRefinedNeedRecomputeLane } from "@/lib/personal-plan/refinement-recompute/production-deps"

import {
  createSupabaseRoutineCadenceAuthorityReader,
  type RoutineCadenceAuthorityReadClient,
} from "./cadence-authority"
import {
  createRoutineSourceSyncService,
  createSupabaseRoutineSourceSyncRepository,
} from "./source-sync-service"

/**
 * THE production construction of the Routine source-sync worker. Every caller
 * that claims from `personal_plan_routine_source_change_outbox` against a real
 * admin client must go through this one factory — the sync route and the
 * acquisition service both do.
 *
 * The self-heal lane is not optional in production: a worker built without it
 * terminalizes a healable module-driven `refined_need` claim at
 * `available_at = infinity`, which no later Routine visit can undo, and does so
 * invisibly (`terminal_refinement_pending_stage3` is suppressed in
 * terminal-source reporting).
 */
export function createProductionRoutineSourceSyncService(admin: SupabaseClient) {
  return createRoutineSourceSyncService({
    repository: createSupabaseRoutineSourceSyncRepository(admin),
    reportTerminalSource: capturePersonalPlanRoutineTerminalSource,
    cadenceAuthorityReader: createSupabaseRoutineCadenceAuthorityReader(
      admin as unknown as RoutineCadenceAuthorityReadClient,
    ),
    refinementRecompute: createProductionRefinedNeedRecomputeLane({ admin }),
  })
}
