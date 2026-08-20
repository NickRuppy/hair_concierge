import type {
  PersonalPlanCategory,
  Stage3CriterionResult,
} from "@/lib/personal-plan/products/contracts"
import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { ScanIdentifierType } from "./identifier-lookup"
import type { ScanOpenSubmissionStatus } from "./pending-submission"
import type { ScanSnapshotSource } from "./profile-context"
import type { ScanSavedState } from "./saved-state"

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

/**
 * `not_needed` is a settled "you don't need this"; `deferred` is "we haven't decided
 * yet" — the same payload shape, but the headline must not claim a need verdict the
 * decision has not reached.
 */
export type ScanNeedMode = "not_needed" | "deferred"

export type ScanNotNeededVerdictPayload = {
  kind: "not_needed"
  mode: ScanNeedMode
  status: Extract<ScanStatusToken, "neutral">
  headline: string
  subtitle: string
  reasons: string[]
  /** Product-only bars: no target exists for a category the profile does not need. */
  dimensions: ScanDimension[]
  coveredBy: ScanCoveredByEntry[]
}

export type ScanVerdictPayload = ScanInCatalogVerdictPayload | ScanNotNeededVerdictPayload

/**
 * The three shapes `POST /api/scan/resolve` can return. The two verdict payloads above
 * gain `snapshotSource` (which profile snapshot the verdict was evaluated against — see
 * `ScanEvaluationContext`) and `savedState` (merkliste/routine/neither — see
 * `saved-state.ts`); the other two branches short-circuit before a verdict exists at all.
 */
export type ScanResolvedVerdictResult = ScanVerdictPayload & {
  snapshotSource: ScanSnapshotSource
  savedState: ScanSavedState
}

export type ScanPendingSubmissionResult = {
  kind: "pending_submission"
  submissionId: string
  headline: string
  status: ScanOpenSubmissionStatus
}

export type ScanUnknownProductResult = {
  kind: "unknown_product"
  identifier: { type: ScanIdentifierType; value: string }
  categories: Array<{ key: PersonalPlanCategory; label: string }>
}

export type ScanResolveResult =
  | ScanResolvedVerdictResult
  | ScanPendingSubmissionResult
  | ScanUnknownProductResult
