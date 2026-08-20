import type { Stage3CriterionResult } from "@/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"

/**
 * Render-ready contract for the scan result sheet. Everything here is already
 * German and already bounded — the API route and the UI add no product logic.
 */

export type ScanVerdict = "ideal" | "supportive" | "mismatch" | "unknown"

/** Maps onto the `--status-*` design tokens the result banner is painted with. */
export type ScanStatusToken = "ok" | "pending" | "danger" | "neutral"

export type ScanDimensionState = "in_target" | "outside_target" | "no_target" | "unknown"

export type ScanDimensionStop = {
  stopId: string
  label: string
}

export type ScanDimension = {
  dimensionId: string
  label: string
  stops: ScanDimensionStop[]
  /** Empty when the profile has no target on this axis (always so for `not_needed`). */
  targetStopIds: string[]
  /**
   * Set-valued because catalog axes such as "Geeignete Haardicke" legitimately
   * cover several stops. Empty when the product value is not confirmed.
   */
  productStopIds: string[]
  state: ScanDimensionState
}

export type ScanAlternative = {
  productId: string
  displayName: string
  imageUrl: string | null
  priceLabel: string | null
  netContentLabel: string | null
  verdict: Extract<ScanVerdict, "ideal" | "supportive">
  verdictLabel: string
}

export type ScanCoveredByEntry = {
  /** What already covers the job, e.g. "Conditioner". */
  label: string
  /** The job it covers, e.g. "Repair-Pflege". */
  detail: string | null
}

export type ScanInCatalogVerdictPayload = {
  kind: "in_catalog"
  verdict: ScanVerdict
  verdictLabel: string
  verdictTitle: string
  status: ScanStatusToken
  subtitle: string
  evaluatedRole: PlanProductRole | null
  evaluatedRoleLabel: string | null
  dimensions: ScanDimension[]
  /** Criterion-row fallback for compact categories without dimensions. */
  criteria: Stage3CriterionResult[]
  coverage: { matches: number; total: number } | null
  fitNarrative: { productCriteria: string; fit: string } | null
  /** Empty on `ideal` (section hidden); at most three otherwise. */
  alternatives: ScanAlternative[]
}

export type ScanNotNeededVerdictPayload = {
  kind: "not_needed"
  status: Extract<ScanStatusToken, "neutral">
  headline: string
  subtitle: string
  reasons: string[]
  /** Product-only bars: no target exists for a category the profile does not need. */
  dimensions: ScanDimension[]
  coveredBy: ScanCoveredByEntry[]
}

export type ScanVerdictPayload = ScanInCatalogVerdictPayload | ScanNotNeededVerdictPayload
