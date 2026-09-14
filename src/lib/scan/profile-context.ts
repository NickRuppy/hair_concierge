import type { SupabaseClient } from "@supabase/supabase-js"

import {
  loadStage3HeatCarrierCoverage,
  type Stage3AuthorityFactBundle,
} from "@/lib/personal-plan/products/authority/catalog-facts"
import type { Stage3ProductDraft } from "@/lib/personal-plan/products/contracts"
import type { InitialNeedPlanSnapshot } from "@/lib/personal-plan/types"

export type ScanSnapshotSource = "refined" | "initial"

export type ScanEvaluationContext = {
  snapshot: InitialNeedPlanSnapshot
  snapshotSource: ScanSnapshotSource
  /**
   * Refined case: `personal_plans.current_refined_need_version_id`. Initial-fallback
   * case: no refined version exists yet, so the initial need version id stands in —
   * mirrors `product-previews.ts`'s Stage-1 preview authority input, which passes the
   * initial `sourceNeedVersionId` through this same field.
   */
  refinedVersionId: string
  /**
   * Refined case: the refined snapshot's own `inputHash`. Initial-fallback case: the
   * initial snapshot's own `inputHash` — again mirroring `product-previews.ts`.
   */
  refinedInputHash: string
}

type PersonalPlanRow = {
  id: string
  current_initial_need_version_id: string | null
  current_refined_need_version_id: string | null
}

export async function loadScanEvaluationContext(
  client: SupabaseClient,
  userId: string,
): Promise<ScanEvaluationContext | null> {
  const { data: plan, error: planError } = await client
    .from("personal_plans")
    .select("id, current_initial_need_version_id, current_refined_need_version_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (planError) throw new Error("scan_profile_context_unavailable")
  if (!plan) return null

  const row = plan as PersonalPlanRow

  if (row.current_refined_need_version_id) {
    const refined = await loadNeedVersionSnapshot(client, {
      id: row.current_refined_need_version_id,
      personalPlanId: row.id,
      userId,
      kind: "refined",
    })
    if (refined) {
      return {
        snapshot: refined,
        snapshotSource: "refined",
        refinedVersionId: row.current_refined_need_version_id,
        refinedInputHash: refined.inputHash,
      }
    }
  }

  if (!row.current_initial_need_version_id) return null
  const initial = await loadNeedVersionSnapshot(client, {
    id: row.current_initial_need_version_id,
    personalPlanId: row.id,
    userId,
    kind: "initial",
  })
  if (!initial) return null
  return {
    snapshot: initial,
    snapshotSource: "initial",
    refinedVersionId: row.current_initial_need_version_id,
    refinedInputHash: initial.inputHash,
  }
}

async function loadNeedVersionSnapshot(
  client: SupabaseClient,
  input: { id: string; personalPlanId: string; userId: string; kind: "refined" | "initial" },
): Promise<InitialNeedPlanSnapshot | null> {
  const { data, error } = await client
    .from("personal_plan_need_versions")
    .select("output_snapshot")
    .eq("id", input.id)
    .eq("personal_plan_id", input.personalPlanId)
    .eq("user_id", input.userId)
    .eq("kind", input.kind)
    .maybeSingle()
  if (error) throw new Error("scan_profile_context_unavailable")
  return (data?.output_snapshot as InitialNeedPlanSnapshot | undefined) ?? null
}

/**
 * Thin delegate for `loadStage3HeatCarrierCoverage` — only meaningful, and only ever
 * invoked by the caller, when the scanned category is `heat_protectant`. Kept separate so
 * the route can skip it entirely for every other category.
 */
export async function loadScanHeatCarrierCoverage(
  client: SupabaseClient,
  draft: Stage3ProductDraft,
  heatRoutes: string[],
  heatEvents: InitialNeedPlanSnapshot["assessments"]["heatExposure"]["events"],
): Promise<Stage3AuthorityFactBundle["heatCarrierCoverage"]> {
  return loadStage3HeatCarrierCoverage(client, draft, heatRoutes, heatEvents)
}
