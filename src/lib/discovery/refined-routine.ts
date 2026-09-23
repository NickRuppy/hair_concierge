import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import type { ScanCatalogPresentationRow } from "@/lib/scan/product-presentation"

import type { DiscoveryIdealStep } from "./load-ideal-routine"

/**
 * The deterministic half of the discovery-call read model: how a participant's captured
 * inventory binds to the Idealplan's routine steps, and what the call's keep/swap
 * decisions make of each step.
 *
 * Everything here is pure. The cockpit (T5) and the PDF (T6) render what this returns and
 * decide nothing of their own, so two readers of the same intake can never disagree.
 */

/** Mirrors the `source` CHECK on `public.discovery_intake_items`. */
export const DISCOVERY_INTAKE_SOURCES = [
  "catalog_search",
  "barcode",
  "barcode_unknown",
  "dm_search",
  "name_research",
  "none",
] as const

export type DiscoveryIntakeItemSource = (typeof DISCOVERY_INTAKE_SOURCES)[number]

/**
 * One row of `public.discovery_intake_items` as the READ model sees it. T3 owns the write
 * models (`intake.ts`); this type deliberately does not import from there so the cockpit's
 * projection cannot be reshaped by a validation change on the participant side.
 */
export type DiscoveryIntakeItem = {
  id: string
  category: PersonalPlanCategory
  source: DiscoveryIntakeItemSource
  brandText: string | null
  productNameText: string | null
  barcodeIdentifier: string | null
  productId: string | null
  productSubmissionId: string | null
  createdAt: string
}

/**
 * Deterministic tie-break rank for the binding order (§4: barcode before name before
 * submission). A scanned barcode is the strongest identity the participant gave us, a
 * catalog pick the next, and anything still being researched last — so when a category
 * has fewer steps than products, the best-identified products take the steps.
 */
export const DISCOVERY_INTAKE_SOURCE_RANK: Record<DiscoveryIntakeItemSource, number> = {
  barcode: 0,
  barcode_unknown: 1,
  catalog_search: 2,
  dm_search: 3,
  name_research: 4,
  none: 5,
}

/**
 * Why an intake product carries no routine step.
 *
 * - `research_pending` — no catalog product resolved yet (controller ruling: such an item
 *   gets no verdict and no binding). The UI renders this as „Noch in Recherche".
 * - `no_ideal_step` — resolved, but its category's ideal steps are already taken (or the
 *   Idealplan has no step for that category at all). The UI renders „kein Schritt im
 *   Idealplan".
 *
 * A typed state, never the German string: the copy lives in the surface, not the model.
 */
export type DiscoveryUnassignedReason = "research_pending" | "no_ideal_step"

export type DiscoveryUnassignedIntakeProduct = {
  item: DiscoveryIntakeItem
  reason: DiscoveryUnassignedReason
}

export type DiscoveryStepBinding = {
  step: DiscoveryIdealStep
  item: DiscoveryIntakeItem | null
}

export type DiscoveryIntakeReduction = {
  bindings: DiscoveryStepBinding[]
  unassignedIntakeProducts: DiscoveryUnassignedIntakeProduct[]
  /** Categories the participant explicitly answered „benutze ich nicht" for. */
  declinedCategories: PersonalPlanCategory[]
}

function bindingOrder(left: DiscoveryIntakeItem, right: DiscoveryIntakeItem): number {
  const resolved = Number(right.productId !== null) - Number(left.productId !== null)
  if (resolved !== 0) return resolved
  const rank =
    DISCOVERY_INTAKE_SOURCE_RANK[left.source] - DISCOVERY_INTAKE_SOURCE_RANK[right.source]
  if (rank !== 0) return rank
  if (left.createdAt !== right.createdAt) return left.createdAt < right.createdAt ? -1 : 1
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

/**
 * Positional binding, per category (§4 step-binding rule).
 *
 * Steps keep their Idealplan order (renderedOrder × allowedRoles); items are ordered by
 * `bindingOrder` and handed to the steps of their own category one by one. A step with no
 * item left stays open; an item with no step left — and every item still in research —
 * surfaces as unassigned instead of disappearing.
 */
export function reduceIntakeItemsToSteps(
  steps: readonly DiscoveryIdealStep[],
  items: readonly DiscoveryIntakeItem[],
): DiscoveryIntakeReduction {
  const declined = new Set<PersonalPlanCategory>()
  const bindable: DiscoveryIntakeItem[] = []
  const unassigned: DiscoveryUnassignedIntakeProduct[] = []

  for (const item of items) {
    if (item.source === "none") {
      declined.add(item.category)
      continue
    }
    if (item.productId === null) {
      unassigned.push({ item, reason: "research_pending" })
      continue
    }
    bindable.push(item)
  }

  const queues = new Map<PersonalPlanCategory, DiscoveryIntakeItem[]>()
  for (const item of [...bindable].sort(bindingOrder)) {
    const queue = queues.get(item.category)
    if (queue) queue.push(item)
    else queues.set(item.category, [item])
  }

  const bindings = steps.map((step) => ({ step, item: queues.get(step.category)?.shift() ?? null }))
  for (const queue of queues.values()) {
    for (const item of queue) unassigned.push({ item, reason: "no_ideal_step" })
  }

  return {
    bindings,
    unassignedIntakeProducts: unassigned.sort((left, right) => bindingOrder(left.item, right.item)),
    declinedCategories: [...declined].sort(),
  }
}

/** One row of `public.discovery_call_decisions` as the read model sees it. */
export type DiscoveryCallDecision = {
  decisionKey: string
  decision: "keep" | "swap"
  swapProductId: string | null
  intakeItemId: string | null
}

/**
 * What the call made of one ideal step.
 *
 * - `kept` — Nick kept the participant's product for this step.
 * - `swapped` — Nick replaced it with `swapProduct`.
 * - `undecided` — the participant owns a product here and the call has not ruled yet.
 * - `ideal` — no owned product and no ruling: the Idealplan's own recommendation stands.
 */
export type DiscoveryStepOutcome = "kept" | "swapped" | "ideal" | "undecided"

export type DiscoveryRefinedStep = {
  step: DiscoveryIdealStep
  outcome: DiscoveryStepOutcome
  item: DiscoveryIntakeItem | null
  /**
   * The decided swap target's id, independent of whether its catalog row could be read.
   * Carried separately from `swapProduct` because `sourceHash` must move when the decision
   * points at a different product even while BOTH rows are missing — otherwise
   * swap→A and swap→B would fingerprint identically and the PDF's drift banner would stay
   * silent on a real change.
   */
  swapProductId: string | null
  swapProduct: ScanCatalogPresentationRow | null
  /**
   * The catalog brand of the Idealplan's recommendation, set ONLY where the document prints
   * that recommendation (`ideal`). The preview's own name is often brandless, so the brand
   * is part of what the PDF renders — and therefore of `sourceHash`.
   */
  recommendationBrand: string | null
}

export type DiscoveryRefinedRoutine = {
  steps: DiscoveryRefinedStep[]
  unassignedIntakeProducts: DiscoveryUnassignedIntakeProduct[]
  declinedCategories: PersonalPlanCategory[]
  /**
   * Fingerprint of everything this routine renders — ideal steps and their previews, the
   * bound products, the decisions and the swapped catalog rows. „Finalisieren" stores it
   * (`discovery_intakes.finalized_source_hash`) and the PDF warns when a freshly computed
   * hash no longer matches, i.e. the profile or the catalog drifted since the call.
   */
  sourceHash: string
}

export function composeDiscoveryRefinedRoutine(input: {
  steps: readonly DiscoveryIdealStep[]
  items: readonly DiscoveryIntakeItem[]
  decisions: readonly DiscoveryCallDecision[]
  swapProducts: readonly ScanCatalogPresentationRow[]
  /** Catalog rows of the Idealplan's recommendations — read for their brand only. */
  recommendationProducts?: readonly ScanCatalogPresentationRow[]
}): DiscoveryRefinedRoutine {
  const reduction = reduceIntakeItemsToSteps(input.steps, input.items)
  const decisionsByKey = new Map(input.decisions.map((entry) => [entry.decisionKey, entry]))
  const swapProductsById = new Map(input.swapProducts.map((row) => [row.id, row]))
  const recommendationBrandsById = new Map(
    (input.recommendationProducts ?? []).map((row) => [row.id, row.brand] as const),
  )

  const steps = reduction.bindings.map(({ step, item }): DiscoveryRefinedStep => {
    const decision = decisionsByKey.get(step.decisionKey) ?? null
    // A decision may legitimately exist without a bound item (migration comment on
    // `discovery_call_decisions.intake_item_id`): the step is still decided, it just
    // replaces nothing the participant owns.
    const outcome: DiscoveryStepOutcome = decision
      ? decision.decision === "swap"
        ? "swapped"
        : "kept"
      : item
        ? "undecided"
        : "ideal"
    const swapProductId = decision?.swapProductId ?? null
    const preview = step.preview
    return {
      step,
      outcome,
      item,
      swapProductId,
      swapProduct: swapProductId ? (swapProductsById.get(swapProductId) ?? null) : null,
      recommendationBrand:
        outcome === "ideal" && preview?.kind === "recommendation"
          ? (recommendationBrandsById.get(preview.productId) ?? null)
          : null,
    }
  })

  return {
    steps,
    unassignedIntakeProducts: reduction.unassignedIntakeProducts,
    declinedCategories: reduction.declinedCategories,
    sourceHash: semanticHash({
      steps,
      unassignedIntakeProducts: reduction.unassignedIntakeProducts,
      declinedCategories: reduction.declinedCategories,
    }),
  }
}

/** Every swap target the decisions reference, for one batched products-by-id select. */
export function discoverySwapProductIds(decisions: readonly DiscoveryCallDecision[]): string[] {
  return [
    ...new Set(
      decisions
        .map((entry) => entry.swapProductId)
        .filter((productId): productId is string => productId !== null),
    ),
  ].sort()
}
