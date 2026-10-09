import { NextResponse } from "next/server"

import { STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL } from "@/lib/personal-plan/product-preview-contract"
import {
  computeStage1ProductExamplePreviews,
  createSupabaseStage1ProductExamplePreviewCandidateLoader,
  type Stage1ProductExamplePreviewBudget,
  type Stage1ProductExamplePreviewCandidateLoader,
} from "@/lib/personal-plan/product-previews"
import {
  canAccessPersonalPlanJourneyStage,
  type PersonalPlanJourneyAccess,
} from "@/lib/personal-plan/journey-access"
import { loadPersonalPlanJourneyAccessForUser } from "@/lib/personal-plan/journey-access-loader"
import {
  createStage1PersistenceService,
  type Stage1PersistenceDependencies,
} from "@/lib/personal-plan/persistence/stage1-service"
import { createStage1SupabaseDependencies } from "@/lib/personal-plan/persistence/stage1-supabase"
import { createSupabaseStage3ProductionPersistence } from "@/lib/personal-plan/products/stage3-persistence-supabase"
import {
  isProductMarketSegmentDisplayEnabled,
  isShoppingBudgetEnabled,
} from "@/lib/personal-plan/release"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export type Stage1ProductExamplePreviewRouteDeps = {
  getAuthenticatedUser: () => Promise<{ id: string } | null>
  loadJourneyAccess: (userId: string) => Promise<PersonalPlanJourneyAccess>
  persistence: Stage1PersistenceDependencies
  loadCandidates: Stage1ProductExamplePreviewCandidateLoader
  /**
   * The saved budget the proposal is previewed under, or null when none applies. Wired only
   * while the shopping-budget gate is on; omitted means price-neutral previews, as before.
   */
  loadShoppingBudget?: (userId: string) => Promise<Stage1ProductExamplePreviewBudget | null>
  marketSegmentDisplayEnabled?: () => boolean
}

export async function GET() {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  const admin = createAdminClient()
  return toResponse(
    await handleStage1ProductExamplePreviews({
      getAuthenticatedUser: async () => (user ? { id: user.id } : null),
      loadJourneyAccess: loadPersonalPlanJourneyAccessForUser,
      persistence: createStage1SupabaseDependencies(admin as never),
      loadCandidates: createSupabaseStage1ProductExamplePreviewCandidateLoader(admin),
      ...(isShoppingBudgetEnabled()
        ? {
            loadShoppingBudget: async (userId: string) => {
              const shopping =
                await createSupabaseStage3ProductionPersistence(admin).loadShoppingContext(userId)
              return shopping.budget
                ? {
                    budget: shopping.budget,
                    statedConcerns: {
                      currentConcerns: shopping.currentConcerns,
                      primaryConcern: shopping.primaryConcern,
                    },
                  }
                : null
            },
          }
        : {}),
      marketSegmentDisplayEnabled: isProductMarketSegmentDisplayEnabled,
    }),
  )
}

export async function handleStage1ProductExamplePreviews(
  deps: Stage1ProductExamplePreviewRouteDeps,
) {
  if (!deps.persistence.isEnabled()) {
    return { status: 404, body: { error: "personal_plan_not_available" } }
  }
  const user = await deps.getAuthenticatedUser()
  if (!user) return { status: 401, body: { error: "unauthorized" } }

  try {
    const access = await deps.loadJourneyAccess(user.id)
    if (!canAccessPersonalPlanJourneyStage(access, "stage1")) {
      return access.kind === "paid_pending"
        ? { status: 409, body: { error: "activation_pending" } }
        : { status: 404, body: { error: "personal_plan_not_available" } }
    }
    const result = await createStage1PersistenceService(deps.persistence).loadOrCreate({
      userId: user.id,
    })
    if (result.status !== "completed") {
      return result.status === "activation_pending"
        ? { status: 409, body: { error: "activation_pending" } }
        : result.status === "invalid_source"
          ? { status: 409, body: { error: "invalid_source" } }
          : result.status === "temporarily_unavailable"
            ? { status: 503, body: { error: "temporarily_unavailable" } }
            : { status: 404, body: { error: "personal_plan_not_available" } }
    }
    // An unreadable budget fails the request (503) rather than previewing price-neutral
    // products that direct acceptance — which does read the budget — would then refuse.
    const budget = (await deps.loadShoppingBudget?.(user.id)) ?? null
    const marketSegmentDisplayEnabled = deps.marketSegmentDisplayEnabled?.() === true
    return {
      status: 200,
      body: await computeStage1ProductExamplePreviews({
        personalPlanId: result.personalPlanId,
        sourceNeedVersionId: result.needVersionId,
        snapshot: result.outputSnapshot as unknown as InitialNeedPlanSnapshot,
        loadCandidates: deps.loadCandidates,
        ...(budget ? { budget } : {}),
        ...(marketSegmentDisplayEnabled ? { marketSegmentDisplayEnabled } : {}),
      }),
    }
  } catch {
    return { status: 503, body: { error: "temporarily_unavailable" } }
  }
}

function toResponse(result: Awaited<ReturnType<typeof handleStage1ProductExamplePreviews>>) {
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL },
  })
}
