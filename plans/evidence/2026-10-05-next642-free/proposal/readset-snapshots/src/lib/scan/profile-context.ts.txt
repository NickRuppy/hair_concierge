import type { SupabaseClient } from "@supabase/supabase-js"
import { loadSharedScannerContext } from "./scanner-context-supabase"

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
  /** Immutable scanner context version, consumed by the shared Stage-3 adapter. */
  refinedVersionId: string
  /** Hash includes current basic answers, explicit refinement, defaults and engine. */
  refinedInputHash: string
}

/** Shared native/web source precedence and revision-checked publication. */
export async function loadScanEvaluationContext(
  client: SupabaseClient,
  userId: string,
): Promise<ScanEvaluationContext | null> {
  const loaded = await loadSharedScannerContext(client, userId)
  return loaded?.prepared ?? null
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
