"use client"

import { useState } from "react"

import { ConditionerCalibrationClient } from "./calibration-client"
import { ConditionerResearchQueueAuditClient } from "./queue-audit-client"

export type ConditionerResearchSummary = {
  completeProfiles: number
  sourceConflicts: number
  excluded: number
  reviewCounts?: {
    approved: number
    reworkOpen: number
    needsReview: number
    excluded: number
  }
}

export type ConditionerResearchQueueItem = {
  productId: string
  productName?: string
  brandName?: string
  exactName?: string
  brand?: string
  market?: string | null
  packSize?: string | null
  statusLabel?: string | null
  summary?: string | null
  uncertainFields?: string[]
  sourceConflict?: boolean
  excluded?: boolean
  formulaStatus?: string | null
  profileStatus?: string | null
  categoryBoundaryStatus?: "eligible" | "excluded_product_form"
  formulaFingerprint?: string | null
  profileComplete?: boolean
  uncertaintyCount?: number
  reviewStatus?: string | null
  priorityGroup?: string | null
  staleReview?: boolean
  lastReviewDecision?: ConditionerReviewDecision | null
}

export type ConditionerProfileField = {
  path: string
  label: string
  value: string
  reviewStatus?: string | null
  rationale?: string | null
  evidenceBasis?:
    | "formula_inference"
    | "formula_inference_with_policy_fallback"
    | "policy_derivation"
  evidenceSignals?: string[]
  derivation?: string | null
  thresholdReasoning?: string[]
  limitations?: string[]
  acceptedValue?: string | null
  blindValue?: string | null
  humanReviewStatus?: ConditionerPropertyReviewStatus
}

export type ConditionerPropertyReviewStatus = "unreviewed" | "rework_open" | "approved"

export type ConditionerReviewDecision = {
  action?: string
  propertyPath?: string | null
  comment?: string | null
  createdAt?: string
} | null

export type ConditionerResearchSource = {
  id?: string | null
  type?: string | null
  market?: string | null
  locator: string
}

export type ConditionerResearchDetail = {
  productId: string
  productName?: string
  brandName?: string
  exactName?: string
  brand?: string
  sourceConflict?: boolean
  excluded?: boolean
  categoryBoundaryStatus?: "eligible" | "excluded_product_form"
  uncertainFields?: string[]
  uncertaintyCount?: number
  profileComplete?: boolean
  conflictExplanation?: string | null
  boundaryExplanation?: string | null
  identity?: {
    gtinEan?: string | null
    market?: string | null
    packSize?: string | null
    formulaVersion?: string | null
    formulaStatus?: string | null
  } | null
  market?: string | null
  packSize?: string | null
  formula?: {
    rawInci?: string | null
    normalizedInci?: string[] | string | null
  } | null
  rawInci?: string | null
  normalizedInci?: string[] | string | null
  formulaStatus?: string | null
  formulaFingerprint?: string | null
  directions?: {
    summary?: string | null
    applicationArea?: string | null
    contactTime?: string | null
    rinseOut?: boolean | null
    raw?: string | null
    normalized?: string | null
    uncertainFields?: string[]
    conflicts?: string[]
  } | null
  sources?: ConditionerResearchSource[]
  source?: Record<string, unknown> | null
  profile: {
    conditioningLevel?: string
    weightPotential?: string
    careDirection?: string
    repairSupportLevel?: string
    primaryFocus?: string
    secondaryFocus?: string[]
    hairThicknessFit?: string[]
    damageFit?: string[]
    textureFit?: string[]
    assumptionNotes?: string[]
    statusLabel?: string | null
    uncertainFields?: string[]
    fields?: ConditionerProfileField[]
  } | null
  blindComparison?: {
    profile?: ConditionerResearchDetail["profile"]
    semanticDifferences?: Array<Record<string, unknown>>
    remainingDifferences?: Array<Record<string, unknown>>
  }
  uncertaintyNotes?: string[]
  profileFingerprint?: string | null
  standardVersion?: string | null
  propertyStatuses?: Record<string, ConditionerPropertyReviewStatus | string>
  canApproveProduct?: boolean
  canApproveBoundary?: boolean
  reviewBlockers?: string[]
  staleReview?: boolean
  lastReviewDecision?: ConditionerReviewDecision
}

export type ConditionerCalibration = {
  preAdjudication: { exactCells: number; totalCells: number }
  postAdjudication: { exactCells: number; totalCells: number }
  nonFocusAgreement: { exactCells: number; totalCells: number }
  damageFitDistribution: {
    healthyOnly: number
    healthyModerate: number
    moderateHigh: number
  }
  semanticDifferences: string[]
  remainingDifferences: string[]
  focusDecisions: string[]
  evidenceCaveats: string[]
  stress: string
}

export type ConditionerResearchLabData = {
  summary: ConditionerResearchSummary
  queueItems: ConditionerResearchQueueItem[]
  initialDetail: ConditionerResearchDetail | null
  calibration: ConditionerCalibration
}

type LabView = "audit" | "calibration"

export function ConditionerResearchLabClient({ data }: { data: ConditionerResearchLabData }) {
  const [view, setView] = useState<LabView>("audit")

  function switchView(nextView: LabView) {
    setView(nextView)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }))
  }

  return (
    <div className="min-h-screen bg-[#f5eee5] text-stone-950">
      <nav
        aria-label="Conditioner Research Lab Bereiche"
        className="sticky top-0 z-10 border-b border-stone-200 bg-[#fffaf4]/95 px-4 py-3 backdrop-blur sm:px-6"
      >
        <div className="mx-auto flex max-w-7xl gap-2">
          <button
            type="button"
            aria-pressed={view === "audit"}
            onClick={() => switchView("audit")}
            className="flex-1 rounded-full px-3 py-2 text-sm font-semibold aria-pressed:bg-stone-950 aria-pressed:text-white sm:flex-none sm:px-4"
          >
            Research Queue & Produkt-Audit
          </button>
          <button
            type="button"
            aria-pressed={view === "calibration"}
            onClick={() => switchView("calibration")}
            className="flex-1 rounded-full px-3 py-2 text-sm font-semibold aria-pressed:bg-stone-950 aria-pressed:text-white sm:flex-none sm:px-4"
          >
            Kalibrierung & Unsicherheiten
          </button>
        </div>
      </nav>

      <div hidden={view !== "audit"}>
        <ConditionerResearchQueueAuditClient
          initialDetail={data.initialDetail}
          queueItems={data.queueItems}
          summary={data.summary}
        />
      </div>
      <div hidden={view !== "calibration"}>
        <ConditionerCalibrationClient calibration={data.calibration} />
      </div>
    </div>
  )
}
