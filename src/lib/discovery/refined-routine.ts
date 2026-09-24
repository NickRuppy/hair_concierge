import { CATEGORY_LABELS } from "@/lib/personal-plan/decision-presentation"
import { semanticHash } from "@/lib/personal-plan/routine/canonicalize"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import type { ScanCatalogPresentationRow } from "@/lib/scan/product-presentation"

import type { DiscoveryUsageRole } from "./classify"
import { discoveryProductTitle } from "./product-label"

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
  /**
   * Her USAGE (batch 5): the category she uses the product in. `null` = unknown („Weiß ich
   * nicht") — such an item binds to no step (`category_unknown`) and blocks finalising.
   * Legacy (tile-model) rows and every `none` row always carry one.
   */
  category: PersonalPlanCategory | null
  source: DiscoveryIntakeItemSource
  brandText: string | null
  productNameText: string | null
  barcodeIdentifier: string | null
  productId: string | null
  productSubmissionId: string | null
  createdAt: string
  /**
   * What the product IS when no catalog product carries it (batch 5, F1) — the research
   * submission is created from it, never from `category` (her usage). Present ONLY when the
   * row has one: item objects are part of `sourceHash`, and a key that legacy rows never had
   * must not move their fingerprint (F4).
   */
  productType?: PersonalPlanCategory
  /**
   * The routine role of her usage (R9: the oil step's three roles, scalp oil). Present ONLY
   * when set, for the same fingerprint reason as `productType` (F4).
   */
  usageRole?: DiscoveryUsageRole
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
 * - `category_unknown` — her usage is unknown („Weiß ich nicht", batch 5): nothing to bind
 *   it to until the cockpit sets it. The UI renders „Kategorie offen"; finalising is blocked
 *   while any item carries it.
 *
 * A typed state, never the German string: the copy lives in the surface, not the model.
 */
export type DiscoveryUnassignedReason = "research_pending" | "no_ideal_step" | "category_unknown"

export type DiscoveryUnassignedIntakeProduct = {
  item: DiscoveryIntakeItem
  reason: DiscoveryUnassignedReason
}

/** An unassigned product as the documents print it — the label is part of the fingerprint. */
export type DiscoveryLabeledUnassignedIntakeProduct = DiscoveryUnassignedIntakeProduct & {
  label: string
  /** „als Maske benutzt" — present ONLY when her usage differs from the product type (F6). */
  usageLabel?: string
}

/**
 * F6: „als Maske benutzt" — how the documents say that she uses a product differently from
 * what it is. Only a batch-5 row can say so: it carries the product type next to her usage.
 * A legacy (tile) row has no product type, so it never gets a note and its fingerprint stays
 * exactly as finalised (F4). Pure: `usageLabels` is the category wording the caller prints.
 */
export function discoveryItemUsageLabel(
  item: Pick<DiscoveryIntakeItem, "category" | "productType" | "source">,
  usageLabels: Readonly<Record<PersonalPlanCategory, string>>,
): string | null {
  if (item.source === "none" || !item.category || !item.productType) return null
  if (item.productType === item.category) return null
  return `als ${usageLabels[item.category]} benutzt`
}

/** „Gescanntes Produkt" — a `barcode_unknown` row carries no text at all, only the code. */
export const DISCOVERY_SCANNED_PRODUCT_LABEL = "Gescanntes Produkt"

/**
 * How the cockpit and the PDF name an intake product from the participant's own words.
 *
 * A `barcode_unknown` row carries NO brand and NO name — its identity is the barcode
 * (T3 handoff), so it reads „Gescanntes Produkt · <code>" rather than pretending to a
 * name nobody entered. `productLine` is the catalog line of the item's resolved product,
 * when there is one; it only joins a label that has a name to join.
 */
export function describeDiscoveryIntakeItem(
  item: DiscoveryIntakeItem,
  productLine: string | null = null,
): string {
  const text = discoveryProductTitle({
    brand: item.brandText,
    productLine: item.productNameText ? productLine : null,
    name: item.productNameText,
  })
  if (text) return text
  if (item.barcodeIdentifier) {
    return `${DISCOVERY_SCANNED_PRODUCT_LABEL} · ${item.barcodeIdentifier}`
  }
  return DISCOVERY_SCANNED_PRODUCT_LABEL
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
  /**
   * Categories with no row at all — the participant submitted without touching them.
   * Honestly unanswered, NOT „benutze ich nicht": their steps still show the Idealplan's
   * own pick (like a declined category), and the cockpit names them so the call can ask.
   */
  unansweredCategories: PersonalPlanCategory[]
}

/** Every checklist category with no row at all, in catalog order. */
export function missingDiscoveryIntakeCategories(
  items: ReadonlyArray<{ category: PersonalPlanCategory | null }>,
): PersonalPlanCategory[] {
  const answered = new Set(items.map((item) => item.category))
  return SUPPORTED_PRODUCT_CATEGORY_KEYS.filter((category) => !answered.has(category))
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
  const bindable: Array<DiscoveryIntakeItem & { category: PersonalPlanCategory }> = []
  const unassigned: DiscoveryUnassignedIntakeProduct[] = []

  for (const item of items) {
    if (item.source === "none") {
      // A `none` row always answers a category (migration CHECK).
      if (item.category) declined.add(item.category)
      continue
    }
    if (item.category === null) {
      unassigned.push({ item, reason: "category_unknown" })
      continue
    }
    if (item.productId === null) {
      unassigned.push({ item, reason: "research_pending" })
      continue
    }
    bindable.push(item as DiscoveryIntakeItem & { category: PersonalPlanCategory })
  }

  const ordered = [...bindable].sort(bindingOrder)
  const bound = new Map<number, DiscoveryIntakeItem>()
  const taken = new Set<string>()

  // An item with a usage role (R9) takes the step of exactly that (category, role) — or none.
  for (const item of ordered) {
    if (!item.usageRole) continue
    const index = steps.findIndex(
      (step, position) =>
        !bound.has(position) && step.category === item.category && step.role === item.usageRole,
    )
    if (index === -1) continue
    bound.set(index, item)
    taken.add(item.id)
  }

  // Everything else: positional per category, as before batch 5 — a legacy intake (no roles)
  // binds exactly as it always did.
  const queues = new Map<PersonalPlanCategory, DiscoveryIntakeItem[]>()
  for (const item of ordered) {
    if (item.usageRole) continue
    const queue = queues.get(item.category)
    if (queue) queue.push(item)
    else queues.set(item.category, [item])
  }

  const bindings = steps.map((step, index) => ({
    step,
    item: bound.get(index) ?? queues.get(step.category)?.shift() ?? null,
  }))
  for (const item of ordered) {
    if (item.usageRole && !taken.has(item.id)) unassigned.push({ item, reason: "no_ideal_step" })
  }
  for (const queue of queues.values()) {
    for (const item of queue) unassigned.push({ item, reason: "no_ideal_step" })
  }

  return {
    bindings,
    unassignedIntakeProducts: unassigned.sort((left, right) => bindingOrder(left.item, right.item)),
    declinedCategories: [...declined].sort(),
    unansweredCategories: missingDiscoveryIntakeCategories(items),
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
   * The Idealplan's recommendation exactly as the document prints it (brand + line + name),
   * set ONLY where it is printed (`ideal`). The preview's own name is often brandless, so
   * the brand is part of what the PDF renders — and the printed label, not the raw brand
   * spelling, is what `sourceHash` covers.
   */
  recommendationLabel: string | null
  /**
   * The participant's own product for this step, exactly as cockpit and PDF print it: the
   * catalog identity the verdict names (brand + line + name) when there is one, else their
   * own words. Hashed for the same reason as `recommendationLabel`.
   */
  ownedLabel: string | null
  /** The decided swap target as printed (brand + line + name); null when unreadable. */
  swapProductLabel: string | null
  /**
   * „als Haarmaske benutzt" next to her product (F6) — present ONLY when her usage differs
   * from the product type, so a legacy step object (and its fingerprint) is unchanged.
   */
  ownedUsageLabel?: string
}

export type DiscoveryRefinedRoutine = {
  steps: DiscoveryRefinedStep[]
  unassignedIntakeProducts: DiscoveryLabeledUnassignedIntakeProduct[]
  declinedCategories: PersonalPlanCategory[]
  /** See `DiscoveryIntakeReduction.unansweredCategories`. */
  unansweredCategories: PersonalPlanCategory[]
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
  /** The catalog identity each owned product's verdict names, by intake item id. */
  ownedProducts?: readonly { itemId: string; brand: string | null; name: string }[]
  /** Catalog product id → product line name, for every product a label names. */
  productLines?: ReadonlyMap<string, string>
}): DiscoveryRefinedRoutine {
  const reduction = reduceIntakeItemsToSteps(input.steps, input.items)
  const lineOf = (productId: string | null | undefined) =>
    (productId ? input.productLines?.get(productId) : null) ?? null
  const ownedByItemId = new Map((input.ownedProducts ?? []).map((row) => [row.itemId, row]))
  const ownedLabel = (item: DiscoveryIntakeItem | null) => {
    if (!item) return null
    const owned = ownedByItemId.get(item.id)
    return owned
      ? discoveryProductTitle({
          brand: owned.brand,
          productLine: lineOf(item.productId),
          name: owned.name,
        })
      : describeDiscoveryIntakeItem(item, lineOf(item.productId))
  }
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
    const swapProduct = swapProductId ? (swapProductsById.get(swapProductId) ?? null) : null
    const preview = step.preview
    const usageLabel = item ? discoveryItemUsageLabel(item, CATEGORY_LABELS) : null
    return {
      step,
      outcome,
      item,
      swapProductId,
      swapProduct,
      recommendationLabel:
        outcome === "ideal" && preview?.kind === "recommendation"
          ? discoveryProductTitle({
              brand: recommendationBrandsById.get(preview.productId) ?? null,
              productLine: lineOf(preview.productId),
              name: preview.productName,
            })
          : null,
      ownedLabel: ownedLabel(item),
      swapProductLabel: swapProduct
        ? discoveryProductTitle({
            brand: swapProduct.brand,
            productLine: lineOf(swapProduct.id),
            name: swapProduct.name,
          })
        : null,
      ...(usageLabel ? { ownedUsageLabel: usageLabel } : {}),
    }
  })
  const unassignedIntakeProducts = reduction.unassignedIntakeProducts.map(
    (entry): DiscoveryLabeledUnassignedIntakeProduct => {
      const usageLabel = discoveryItemUsageLabel(entry.item, CATEGORY_LABELS)
      return {
        ...entry,
        label: describeDiscoveryIntakeItem(entry.item, lineOf(entry.item.productId)),
        ...(usageLabel ? { usageLabel } : {}),
      }
    },
  )

  return {
    steps,
    unassignedIntakeProducts,
    declinedCategories: reduction.declinedCategories,
    unansweredCategories: reduction.unansweredCategories,
    // `unansweredCategories` is deliberately NOT hashed: it is the complement of the rows
    // the hash already covers (bound, unassigned and declined), so it cannot change
    // without them — and adding a key would flag every finalized document as drifted.
    // Every printed product label is part of `steps` / `unassignedIntakeProducts`, so a
    // label that changes (a catalog rename, a new product line) moves the hash with it.
    // The step's call-only `depth` is stripped: the paper does not print it, so a copy
    // change there must not flag every finalised document as drifted.
    sourceHash: semanticHash({
      steps: steps.map((entry) => ({ ...entry, step: { ...entry.step, depth: undefined } })),
      unassignedIntakeProducts,
      declinedCategories: reduction.declinedCategories,
    }),
  }
}

/** Every swap target the decisions reference, for one batched products-by-id select. */
/** The recommendations the document prints — only `ideal` steps show the Idealplan's pick. */
export function discoveryPrintedRecommendationIds(routine: DiscoveryRefinedRoutine): string[] {
  return [
    ...new Set(
      routine.steps.flatMap(({ outcome, step }) =>
        outcome === "ideal" && step.preview?.kind === "recommendation"
          ? [step.preview.productId]
          : [],
      ),
    ),
  ].sort()
}

export function discoverySwapProductIds(decisions: readonly DiscoveryCallDecision[]): string[] {
  return [
    ...new Set(
      decisions
        .map((entry) => entry.swapProductId)
        .filter((productId): productId is string => productId !== null),
    ),
  ].sort()
}
