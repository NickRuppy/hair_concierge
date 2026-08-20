import { CATEGORY_COPY } from "@/components/personal-plan-products/stage3-product-copy"
import type {
  PersonalPlanCategory,
  Stage3CriterionResult,
} from "@/lib/personal-plan/products/contracts"

import type { ScanSavedState } from "./saved-state"
import type {
  ScanDimension,
  ScanDimensionState,
  ScanNeedMode,
  ScanProductHeader,
  ScanStatusToken,
  ScanVerdict,
} from "./types"

/**
 * Every non-trivial render decision the scan result sheet makes, as pure functions.
 * The components stay thin JSX over these; the German here is fixed UI chrome only —
 * anything describing the user's own verdict comes from the payload verbatim.
 */

/* ------------------------------------------------------------------ footer */

export type ScanFooterTone = "coral-solid" | "coral-outline" | "plum-solid" | "plum-outline"

export type ScanFooterAction =
  | {
      kind: "buy"
      label: string
      tone: Extract<ScanFooterTone, "coral-solid" | "coral-outline">
      url: string
    }
  | { kind: "save"; label: string; tone: Extract<ScanFooterTone, "plum-solid" | "plum-outline"> }

export type ScanFooterInput = {
  kind: "in_catalog" | "not_needed"
  /** `null` on the `not_needed` branch, which reaches no fit verdict. */
  verdict: ScanVerdict | null
  product: ScanProductHeader
  savedState: ScanSavedState
}

const SAVE_LABELS: Record<"none" | NonNullable<ScanSavedState>, string> = {
  none: "Speichern",
  routine: "✓ In deiner Routine",
  merkliste: "✓ Gemerkt",
}

export function scanSaveButtonLabel(savedState: ScanSavedState): string {
  return SAVE_LABELS[savedState ?? "none"]
}

/**
 * Spec §3: identical geometry in every state, honest labels. Only an unbuyable product
 * collapses to a single slot — a dead "Kaufen" button would be worse than none.
 */
export function scanFooterActions(input: ScanFooterInput): ScanFooterAction[] {
  const save: ScanFooterAction = {
    kind: "save",
    label: scanSaveButtonLabel(input.savedState),
    tone: input.kind === "not_needed" ? "plum-solid" : "plum-outline",
  }
  const url = input.product.purchaseUrl
  if (!url) return [save]

  const ideal = input.kind === "in_catalog" && input.verdict === "ideal"
  const buy: ScanFooterAction = ideal
    ? {
        kind: "buy",
        label: input.product.priceLabel ? `Kaufen · ${input.product.priceLabel}` : "Kaufen",
        tone: "coral-solid",
        url,
      }
    : { kind: "buy", label: "Trotzdem kaufen", tone: "coral-outline", url }

  return input.kind === "not_needed" ? [save, buy] : [buy, save]
}

/* -------------------------------------------------------------- dimensions */

export type ScanDimensionSegment = {
  stopId: string
  label: string
  isTarget: boolean
  /**
   * Set-valued axes (e.g. "Geeignete Haardicke" covering several thicknesses) render a
   * dot on every covered stop; the first one in stop order carries full weight and the
   * rest are shown reduced, so the bar reads as one product, not several.
   */
  dot: "primary" | "secondary" | null
}

export function scanDimensionSegments(dimension: ScanDimension): ScanDimensionSegment[] {
  const targets = new Set(dimension.targetStopIds)
  const covered = new Set(dimension.productStopIds)
  let primaryPlaced = false
  return dimension.stops.map((stop) => {
    let dot: ScanDimensionSegment["dot"] = null
    if (covered.has(stop.stopId)) {
      dot = primaryPlaced ? "secondary" : "primary"
      primaryPlaced = true
    }
    return { stopId: stop.stopId, label: stop.label, isTarget: targets.has(stop.stopId), dot }
  })
}

export type ScanDimensionSummary = {
  marker: "✓" | "✕" | null
  text: string
  state: ScanDimensionState
}

const NO_PRODUCT_VALUE_TEXT = "Keine Angabe"

export function scanDimensionSummary(dimension: ScanDimension): ScanDimensionSummary {
  const labels = dimension.stops
    .filter((stop) => dimension.productStopIds.includes(stop.stopId))
    .map((stop) => stop.label)
  const text = labels.length > 0 ? labels.join(" · ") : NO_PRODUCT_VALUE_TEXT
  const marker =
    dimension.state === "in_target" ? "✓" : dimension.state === "outside_target" ? "✕" : null
  return { marker, text, state: dimension.state }
}

/* ----------------------------------------------------------------- criteria */

export function scanCriterionMarker(result: Stage3CriterionResult["result"]): {
  marker: string
  tone: ScanStatusToken
} {
  switch (result) {
    case "pass":
      return { marker: "✓", tone: "ok" }
    case "caution":
      return { marker: "!", tone: "pending" }
    case "fail":
      return { marker: "✕", tone: "danger" }
    case "unknown":
      return { marker: "?", tone: "neutral" }
  }
}

/* -------------------------------------------------------------- why labels */

/**
 * Accusative negation per category, so "Warum du keine Maske brauchst" and "Warum du
 * keinen Conditioner brauchst" are both correct. Mirrors `verdict-labels.ts`'s
 * `CATEGORY_NEGATION`, which is private to that module's headline copy.
 */
const CATEGORY_ACCUSATIVE_NEGATION: Record<PersonalPlanCategory, string> = {
  shampoo: "kein",
  conditioner: "keinen",
  leave_in: "kein",
  heat_protectant: "keinen",
  oil: "kein",
  mask: "keine",
  scalp_care: "kein",
  dry_shampoo: "kein",
  bondbuilder: "keinen",
  deep_cleansing_shampoo: "keine",
}

const VERDICT_REASON_LABELS: Record<ScanVerdict, string> = {
  ideal: "Warum das zu deinem Haar passt",
  supportive: "Warum das nur eingeschränkt passt",
  mismatch: "Warum nicht",
  unknown: "Warum wir uns nicht sicher sind",
}

export type ScanReasonsLabelInput =
  | { kind: "in_catalog"; verdict: ScanVerdict }
  | { kind: "not_needed"; mode: ScanNeedMode; category: PersonalPlanCategory }

export function scanReasonsLabel(input: ScanReasonsLabelInput): string {
  if (input.kind === "in_catalog") return VERDICT_REASON_LABELS[input.verdict]
  if (input.mode === "deferred") return "Warum das noch offen ist"
  return `Warum du ${CATEGORY_ACCUSATIVE_NEGATION[input.category]} ${CATEGORY_COPY[input.category].label} brauchst`
}

/* ------------------------------------------------- not_needed section flags */

export type ScanNotNeededSections = {
  reasons: boolean
  goodToKnow: boolean
  coveredBy: boolean
}

/**
 * Which of the `not_needed` body sections may render. "Gut zu wissen" qualifies the
 * verdict's reasoning, so it only appears next to reasoning: with neither reasons nor
 * coverage the sheet deliberately stops after headline + subtitle, rather than showing
 * a lone context-less card that reads like something failed to load.
 */
export function scanNotNeededSections(payload: {
  reasons: readonly string[]
  coveredBy: readonly unknown[]
}): ScanNotNeededSections {
  const reasons = payload.reasons.length > 0
  const coveredBy = payload.coveredBy.length > 0
  return { reasons, goodToKnow: reasons || coveredBy, coveredBy }
}

/* ------------------------------------------------------------ alternatives */

export function scanAlternativeMetaLine(input: {
  brand: string | null
  priceLabel: string | null
}): string | null {
  const parts = [input.brand, input.priceLabel].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  )
  return parts.length > 0 ? parts.join(" · ") : null
}
