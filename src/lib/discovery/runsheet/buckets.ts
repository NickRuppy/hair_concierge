import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

import type {
  DiscoveryCockpitStepView,
  DiscoveryCockpitUnassignedView,
  DiscoveryCockpitVerdictView,
  DiscoveryCockpitView,
} from "../cockpit"
import type { DiscoveryCallDecision, DiscoveryUnassignedReason } from "../refined-routine"

/**
 * The runsheet's Phase-3 product buckets (consult-runsheet T2, ruling R4): the cockpit view
 * re-sorted into „Behalten / Weglassen / Tauschen oder neu" plus „Klären".
 *
 * Pure and read-only. The view — above all its `unassigned` projection, which the finalize
 * gates and the PDF redirect read — is never mutated, filtered in place, re-bound or
 * re-homed: this returns a NEW structure for display and nothing else.
 *
 * Entries are per intake entry, never per category (batch 9: a step can hold several of her
 * products, each with its own verdict and its own decision), so every entry keeps its
 * `intakeItemId` and `decisionKey`.
 */

/** How the engine's verdict reads for the call, independent of any decision. */
export type RunsheetVerdictFit = "fits" | "does_not_fit" | "uncertain"

/**
 * The verdict → fit mapping, total over every state a cockpit step can carry.
 *
 * - `in_catalog`: `ideal` („Passt") and `supportive` („Passt mit Einschränkung") fit;
 *   `mismatch` does not; `unknown` („Unklar") is uncertain.
 * - `not_needed`: a settled „brauchst du nicht" does not fit; `deferred` is uncertain.
 * - `target_mismatch`: the catalog files the product under another category than her usage
 *   (and not a legitimate usage difference) — it does not fit the step.
 * - Every other non-verdict state (not sellable, quarantined, no decision for the category,
 *   transient failure) and a missing verdict row are uncertain.
 */
export function runsheetVerdictFit(
  verdict: DiscoveryCockpitVerdictView | null,
): RunsheetVerdictFit {
  if (!verdict) return "uncertain"
  switch (verdict.status) {
    case "verdict": {
      const payload = verdict.payload
      if (payload.kind === "not_needed") {
        return payload.mode === "not_needed" ? "does_not_fit" : "uncertain"
      }
      switch (payload.verdict) {
        case "ideal":
        case "supportive":
          return "fits"
        case "mismatch":
          return "does_not_fit"
        case "unknown":
          return "uncertain"
      }
      return assertNever(payload.verdict)
    }
    case "target_mismatch":
      return "does_not_fit"
    case "product_unavailable":
    case "quarantined":
    case "decision_missing":
    case "unavailable":
      return "uncertain"
  }
  return assertNever(verdict)
}

/** One of her products bound to an ideal step. */
export type RunsheetOwnedEntry = {
  kind: "owned"
  intakeItemId: string
  decisionKey: string
  /** The routine-category anchor: the step's category. */
  category: PersonalPlanCategory
  /** False when the call recorded a decision for this entry. */
  proposed: boolean
  /** The recorded call decision; null while undecided. */
  decision: DiscoveryCallDecision["decision"] | null
  verdictFit: RunsheetVerdictFit
  /** The decided swap target (only for a recorded swap). */
  swapProductId: string | null
  swapProductLabel: string | null
  /** The step as the cockpit renders it (read-only reference, for the UI join). */
  step: DiscoveryCockpitStepView
}

/** An ideal step she owns nothing for, filled by a new product. */
export type RunsheetNewEntry = {
  kind: "neu"
  intakeItemId: null
  decisionKey: string
  category: PersonalPlanCategory
  /** False when the call decided the swap target for the empty step. */
  proposed: boolean
  /** The decided swap target, or (proposed) the Idealplan's own recommendation. */
  productId: string | null
  label: string | null
  step: DiscoveryCockpitStepView
}

/** A captured product without a step (the `unassigned` projection, read only). */
export type RunsheetUnassignedEntry = {
  kind: "unassigned"
  intakeItemId: string
  decisionKey: null
  /** Her usage; null for `category_unknown` and styling. */
  category: PersonalPlanCategory | null
  proposed: true
  reason: DiscoveryUnassignedReason
  unassigned: DiscoveryCockpitUnassignedView
}

export type RunsheetBucketEntry = RunsheetOwnedEntry | RunsheetNewEntry | RunsheetUnassignedEntry

export type RunsheetBuckets = {
  behalten: RunsheetOwnedEntry[]
  /** Decided drops, then products whose category has no step in the Idealroutine. */
  weglassen: Array<RunsheetOwnedEntry | RunsheetUnassignedEntry>
  tauschenOderNeu: Array<RunsheetOwnedEntry | RunsheetNewEntry>
  /** Still in research, or her usage unknown — to be cleared before/in the call. */
  klaeren: RunsheetUnassignedEntry[]
  /** Styling products (never evaluated) — shown outside the decision buckets. */
  styling: RunsheetUnassignedEntry[]
}

const DECISION_BY_OUTCOME = {
  kept: "keep",
  swapped: "swap",
  dropped: "drop",
  undecided: null,
  ideal: null,
} as const satisfies Record<
  DiscoveryCockpitStepView["outcome"],
  DiscoveryCallDecision["decision"] | null
>

export function deriveBuckets(
  view: Pick<DiscoveryCockpitView, "steps" | "unassigned">,
): RunsheetBuckets {
  const buckets: RunsheetBuckets = {
    behalten: [],
    weglassen: [],
    tauschenOderNeu: [],
    klaeren: [],
    styling: [],
  }

  for (const step of view.steps) {
    const decision = DECISION_BY_OUTCOME[step.outcome]

    if (step.intakeItemId === null) {
      // An empty step: a decided swap names the new product; otherwise the Idealplan's own
      // recommendation is the proposal. A „kept" empty step (nothing new) or one without a
      // recommendation has no product to put anywhere.
      if (decision === "swap") {
        buckets.tauschenOderNeu.push(
          newEntry(step, false, step.swapProductId, step.swapProductLabel),
        )
      } else if (decision === null && step.idealRecommendation) {
        buckets.tauschenOderNeu.push(
          newEntry(
            step,
            true,
            step.idealRecommendation.productId,
            step.recommendationLabel ?? step.idealRecommendation.label,
          ),
        )
      }
      continue
    }

    const verdictFit = runsheetVerdictFit(step.verdict)
    const entry: RunsheetOwnedEntry = {
      kind: "owned",
      intakeItemId: step.intakeItemId,
      decisionKey: step.decisionKey,
      category: step.category,
      proposed: decision === null,
      decision,
      verdictFit,
      swapProductId: decision === "swap" ? step.swapProductId : null,
      swapProductLabel: decision === "swap" ? step.swapProductLabel : null,
      step,
    }
    switch (decision) {
      case "keep":
        buckets.behalten.push(entry)
        break
      case "swap":
        buckets.tauschenOderNeu.push(entry)
        break
      case "drop":
        buckets.weglassen.push(entry)
        break
      case null:
        if (verdictFit === "fits") buckets.behalten.push(entry)
        else buckets.tauschenOderNeu.push(entry)
        break
    }
  }

  for (const unassigned of view.unassigned) {
    const entry: RunsheetUnassignedEntry = {
      kind: "unassigned",
      intakeItemId: unassigned.itemId,
      decisionKey: null,
      category: unassigned.category,
      proposed: true,
      reason: unassigned.reason,
      unassigned,
    }
    switch (unassigned.reason) {
      case "research_pending":
      case "category_unknown":
        buckets.klaeren.push(entry)
        break
      case "no_ideal_step":
        buckets.weglassen.push(entry)
        break
      case "styling_not_evaluated":
        buckets.styling.push(entry)
        break
      default:
        assertNever(unassigned.reason)
    }
  }

  return buckets
}

function newEntry(
  step: DiscoveryCockpitStepView,
  proposed: boolean,
  productId: string | null,
  label: string | null,
): RunsheetNewEntry {
  return {
    kind: "neu",
    intakeItemId: null,
    decisionKey: step.decisionKey,
    category: step.category,
    proposed,
    productId,
    label,
    step,
  }
}

function assertNever(value: never): never {
  throw new Error(`runsheet: unexpected state ${JSON.stringify(value)}`)
}
