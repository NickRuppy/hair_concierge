import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createInitialRoutineCandidateCompiler } from "@/lib/personal-plan/routine-candidate-compiler"
import {
  createRoutineProposalStagerRpcAdapter,
  type RoutineProposalRpcClient,
} from "@/lib/personal-plan/routine-proposal-stager"
import {
  createSupabaseRoutineCadenceAuthorityReader,
  type RoutineCadenceAuthorityReadClient,
} from "@/lib/personal-plan/routine/cadence-authority"
import { routinePayloadV1Schema } from "@/lib/personal-plan/routine/contracts"
import {
  loadOwnerRoutinePlan,
  loadOwnerRoutineVersion,
  type PersonalPlanRoutineReadClient,
} from "@/lib/personal-plan/routine/repository"
import { createProductionStage3ProductsGateway } from "@/lib/personal-plan/products/production-persistence-gateway"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"

import type { RoutineRefinedNeedRecomputeLane } from "@/lib/personal-plan/routine/source-sync-service"

import {
  classifyModuleDrivenRefinedVersion,
  type RoutineRefinedNeedClassificationClient,
} from "./module-driven-classification"
import { recomputeRoutineAfterHabitsCompletion } from "./orchestrator"
import {
  reactivateRoutineForProductDraft,
  type RoutineReactivationClient,
} from "./routine-reactivation"
import type { Stage3RecomputeActiveRoutineVersion, Stage3RecomputeDeps } from "./types"

/**
 * Production wiring for `recomputeRoutineAfterHabitsCompletion`'s deps.
 *
 * - `gateway` / `persistence` are built exactly like
 *   `accept-ideal-plan/route.ts` builds the real Stage-3 authority gateway
 *   and its raw persistence port.
 * - `routineState` is composed from the existing routine repository reads
 *   (`loadOwnerRoutinePlan` + `loadOwnerRoutineVersion`) per the T1.3 report's
 *   handover note: no existing repository function returns exactly the
 *   `Stage3RecomputeActiveRoutineVersion` shape, so this adapter joins the two
 *   rows and translates `undefined` -> `null` on the source-draft fields.
 *
 * One admin client is shared across every read/write this makes; callers
 * (the Stage-2 route today, the T1.5 sync worker next) build one per
 * request/run and pass it in.
 */
export function createProductionStage3RecomputeDeps(input: {
  userId: string
  admin: SupabaseClient
}): Stage3RecomputeDeps {
  const { userId, admin } = input
  const persistence = createSupabaseStage3ProductionPersistence(admin)
  const routineReadClient = admin as unknown as PersonalPlanRoutineReadClient

  return {
    gateway: createProductionStage3ProductsGateway({
      userId,
      persistence,
      compiler: createInitialRoutineCandidateCompiler(),
      cadenceAuthorityReader: createSupabaseRoutineCadenceAuthorityReader(
        admin as unknown as RoutineCadenceAuthorityReadClient,
      ),
      stager: createRoutineProposalStagerRpcAdapter({
        client: admin as unknown as RoutineProposalRpcClient,
      }),
    }),
    persistence,
    routineState: {
      async loadActiveRoutineVersion({
        userId: ownerId,
        personalPlanId,
      }): Promise<Stage3RecomputeActiveRoutineVersion | null> {
        const plan = await loadOwnerRoutinePlan(routineReadClient, ownerId)
        if (!plan?.active_routine_version_id) return null
        const version = await loadOwnerRoutineVersion(
          routineReadClient,
          ownerId,
          personalPlanId,
          plan.active_routine_version_id,
        )
        if (!version) return null
        if (typeof version.source_refined_need_version_id !== "string") {
          throw new Error("personal_plan_routine_version_source_refined_need_version_id_missing")
        }
        return {
          routineVersionId: version.id,
          payload: routinePayloadV1Schema.parse(version.payload),
          source: {
            refinedVersionId: version.source_refined_need_version_id,
            productDraftId: version.source_product_draft_id ?? null,
            productDraftRevision: version.source_product_draft_revision ?? null,
          },
        }
      },
    },
    // A→B→A only: the target refined version's Routine already exists and is
    // just not active, so nothing new is compiled — the existing one is staged
    // as a successor of the current active Routine and confirmed.
    routineReactivator: {
      reactivateRoutineForProductDraft: (reactivation) =>
        reactivateRoutineForProductDraft({
          client: admin as unknown as RoutineReactivationClient,
          ...reactivation,
        }),
    },
  }
}

/**
 * Production wiring of the sync worker's self-heal lane (T1.5).
 *
 * Every construction of `createRoutineSourceSyncService` that runs against a
 * real admin client must pass this — the sync route AND the acquisition
 * service, which claims from the same outbox. A worker without the lane
 * terminalizes a healable module-driven `refined_need` claim at
 * `available_at = infinity`, which no later visit can undo.
 */
export function createProductionRefinedNeedRecomputeLane(input: {
  admin: SupabaseClient
}): RoutineRefinedNeedRecomputeLane {
  return {
    classify: (lineage) =>
      classifyModuleDrivenRefinedVersion({
        client: input.admin as unknown as RoutineRefinedNeedClassificationClient,
        ...lineage,
      }),
    // Fresh deps per invocation: the Stage-3 gateway memoizes the draft it
    // loaded, so a recompute must never inherit another one's snapshot.
    recompute: (lineage) =>
      recomputeRoutineAfterHabitsCompletion(
        createProductionStage3RecomputeDeps({ userId: lineage.userId, admin: input.admin }),
        lineage,
      ),
  }
}
