import type { SupabaseClient } from "@supabase/supabase-js"

import { capturePersonalPlanRoutineTerminalSource } from "@/lib/observability/personal-plan-application"

import { loadPersonalPlanRoutineView } from "./load-view"
import type { PersonalPlanRoutineReadClient } from "./repository"
import {
  createRoutineSourceSyncService,
  createSupabaseRoutineSourceSyncRepository,
} from "./source-sync-service"
import {
  createSupabaseRoutineCadenceAuthorityReader,
  type RoutineCadenceAuthorityReadClient,
} from "./cadence-authority"

type PlannedItem = { personalPlanId: string; category: string; productId: string }

export type RoutineAcquisitionRepository = {
  loadPlannedItem(userId: string, itemKey: string): Promise<PlannedItem | null>
  recordOwned(input: {
    userId: string
    personalPlanId: string
    category: string
    productId: string
  }): Promise<{ userProductId: string } | null>
  sync(userId: string): Promise<{ status: string; proposalStaged: boolean }>
}

export type RoutineAcquisitionResult =
  | { status: "not_found" }
  | { status: "temporarily_unavailable" }
  | { status: "recorded"; proposalStaged: boolean; needsRetry: boolean }

export function createRoutineAcquisitionService(input: {
  repository: RoutineAcquisitionRepository
}) {
  return {
    async acquire(request: { userId: string; itemKey: string }): Promise<RoutineAcquisitionResult> {
      const item = await input.repository.loadPlannedItem(request.userId, request.itemKey)
      if (!item) return { status: "not_found" }
      const recorded = await input.repository.recordOwned({
        userId: request.userId,
        personalPlanId: item.personalPlanId,
        category: item.category,
        productId: item.productId,
      })
      if (!recorded) return { status: "temporarily_unavailable" }

      // Ownership and Routine activation are intentionally separate. Once the
      // durable fact exists, a sync failure is retryable and must not invite a
      // misleading second ownership action.
      const synced = await input.repository.sync(request.userId)
      return {
        status: "recorded",
        proposalStaged: synced.proposalStaged,
        needsRetry: synced.status !== "processed",
      }
    },
  }
}

export function createSupabaseRoutineAcquisitionService(client: SupabaseClient) {
  const sync = createRoutineSourceSyncService({
    repository: createSupabaseRoutineSourceSyncRepository(client),
    reportTerminalSource: capturePersonalPlanRoutineTerminalSource,
    cadenceAuthorityReader: createSupabaseRoutineCadenceAuthorityReader(
      client as unknown as RoutineCadenceAuthorityReadClient,
    ),
  })
  return createRoutineAcquisitionService({
    repository: {
      async loadPlannedItem(userId, itemKey) {
        const view = await loadPersonalPlanRoutineView({
          client: client as unknown as PersonalPlanRoutineReadClient,
          userId,
          enabled: true,
        })
        if (view.status === "no_personal_plan") return null
        const payload = view.activeVersion?.payload ?? view.pendingProposal?.candidate
        const personalPlanId = payload?.planId
        const item = payload?.items.find((candidate) => candidate.itemKey === itemKey)
        return personalPlanId && item?.product.kind === "planned" && item.product.productId
          ? {
              personalPlanId,
              category: item.category,
              productId: item.product.productId,
            }
          : null
      },
      async recordOwned({ userId, personalPlanId, category, productId }) {
        const { data, error } = await client.rpc(
          "personal_plan_acquire_catalog_product_for_routine",
          {
            p_user_id: userId,
            p_personal_plan_id: personalPlanId,
            p_category: category,
            p_catalog_product_id: productId,
          },
        )
        if (error || !data || data.outcome !== "ready" || !data.userProduct?.id) return null
        return { userProductId: String(data.userProduct.id) }
      },
      async sync(userId) {
        const result = await sync.sync({ userId })
        return {
          status: result.status,
          proposalStaged: result.status === "processed" && result.proposalStaged,
        }
      },
    },
  })
}
