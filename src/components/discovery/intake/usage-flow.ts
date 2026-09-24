import {
  classifyDiscoveryProduct,
  discoveryUsageStepFor,
  DISCOVERY_UNKNOWN_TYPE_LABEL,
  type DiscoveryUsage,
  type DiscoveryUsageOption,
  type DiscoveryUsageOptionKey,
  type DiscoveryUsageQuestion,
  type DiscoveryUsageRole,
} from "@/lib/discovery/classify"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { composeProductIdentityTitle } from "@/lib/product-identity/display-title"

import { DISCOVERY_INTAKE_CATEGORY_COPY, DISCOVERY_INTAKE_GROUP_KEYS } from "./categories"
import type {
  DiscoveryIntakeItemView,
  DiscoveryIntakeProductBody,
  DiscoveryIntakeProductCaptureInput,
  DiscoveryIntakeUsagePatchBody,
} from "./types"

/**
 * The flat checklist's decisions, free of React (batch 5, Variante A): what a pill says,
 * which sheet a capture or a pill tap opens, and which ONE request an answer turns into.
 *
 * Product type and usage stay two answers (plan Rev. 2 „identity ≠ usage"): the type
 * decides WHICH usage question is asked (`discoveryUsageStepFor`), the usage is what the
 * pill shows and the review groups by.
 */

const UNNAMED_PRODUCT = "Gescanntes Produkt"

/** The whole checklist's categories in shelf order — the review's and the chips' order. */
export const DISCOVERY_CATEGORY_ORDER: readonly PersonalPlanCategory[] =
  DISCOVERY_INTAKE_GROUP_KEYS.flatMap((group) => group.keys)

// --- Display ---------------------------------------------------------------------------

/**
 * A captured row always has SOMETHING to show. A named product reads like the search
 * row it was picked from and like the routine names it — brand, product line and name
 * as one de-duplicated title; an unnamed scan falls back to „Gescanntes Produkt".
 */
export function itemDisplayName(item: DiscoveryIntakeItemView): string {
  if (!item.productNameText) return UNNAMED_PRODUCT
  return (
    composeProductIdentityTitle({
      brand: item.brandText,
      productLine: item.productLine,
      name: item.productNameText,
    }) || UNNAMED_PRODUCT
  )
}

/** Only an unnamed scan needs a second line: the barcode it was read from. */
export function itemDisplaySubline(item: DiscoveryIntakeItemView): string | null {
  return item.productNameText ? null : item.barcodeIdentifier
}

/** The oil roles say WHEN; the scalp oil keeps saying it is an oil. */
const ROLE_LABELS: Record<DiscoveryUsageRole, string> = {
  pre_wash_fibre_treatment: "Öl · vor der Wäsche",
  leave_on_fibre_conditioning: "Öl · ins feuchte Haar",
  dry_finish: "Öl · als Finish",
  scalp_flake_oil_adjunct: "Öl · Kopfhaut",
}

export function categoryLabel(category: PersonalPlanCategory): string {
  return DISCOVERY_INTAKE_CATEGORY_COPY[category].label
}

/**
 * The coral pill: her usage. „Weiß ich nicht" while the usage is unknown. Legacy (tile)
 * rows carry only a category, which was their usage all along.
 */
export function usagePillLabel(item: Pick<DiscoveryIntakeItemView, "category" | "usageRole">) {
  if (item.usageRole) return ROLE_LABELS[item.usageRole]
  if (!item.category) return DISCOVERY_UNKNOWN_TYPE_LABEL
  return categoryLabel(item.category)
}

export function isProductItem(item: DiscoveryIntakeItemView): boolean {
  return item.source !== "none"
}

// --- Flow ------------------------------------------------------------------------------

/** What the sheets show about the product being asked about. */
export type DiscoveryFlowSubject = {
  title: string
  imageUrl: string | null
  /** The name the classifier and the oil preselection read. */
  name: string | null
}

export type DiscoveryFlowTarget =
  | { kind: "add"; capture: DiscoveryIntakeProductCaptureInput; subject: DiscoveryFlowSubject }
  | { kind: "change"; item: DiscoveryIntakeItemView; subject: DiscoveryFlowSubject }

export type DiscoveryFlowSheet =
  | {
      kind: "what_is_it"
      target: DiscoveryFlowTarget
      /** Plum: the current answer — „Weiß ich nicht" on a type-open item, nothing at add. */
      current: PersonalPlanCategory | "unknown" | null
    }
  | {
      kind: "usage"
      target: DiscoveryFlowTarget
      question: DiscoveryUsageQuestion
      /** Plum: the detected answer at add time, her current one on a change. */
      highlighted: DiscoveryUsageOptionKey | null
      productType: PersonalPlanCategory | null
      /** The type was answered in THIS flow („Was ist das?") and travels with the usage. */
      typeChosen: boolean
    }

export type DiscoveryFlowNext =
  | { kind: "sheet"; sheet: DiscoveryFlowSheet }
  | { kind: "add"; body: DiscoveryIntakeProductBody }
  | { kind: "patch"; itemId: string; body: DiscoveryIntakeUsagePatchBody }
  | { kind: "close" }

function commit(
  target: DiscoveryFlowTarget,
  productType: PersonalPlanCategory | null,
  usage: DiscoveryUsage | null,
  typeChosen: boolean,
): DiscoveryFlowNext {
  if (target.kind === "add") {
    return { kind: "add", body: { capture: target.capture, productType, usage } }
  }
  return {
    kind: "patch",
    itemId: target.item.id,
    body: typeChosen && productType ? { usage, productType } : { usage },
  }
}

function continueWithType(
  target: DiscoveryFlowTarget,
  productType: PersonalPlanCategory | null,
  typeChosen: boolean,
): DiscoveryFlowNext {
  const step = discoveryUsageStepFor(productType, target.subject.name)
  if (step.kind === "what_is_it") {
    return { kind: "sheet", sheet: { kind: "what_is_it", target, current: null } }
  }
  if (step.kind === "fixed") return commit(target, productType, step.usage, typeChosen)
  return {
    kind: "sheet",
    sheet: {
      kind: "usage",
      target,
      question: step.question,
      highlighted: step.preselected,
      productType,
      typeChosen,
    },
  }
}

/**
 * A fresh capture (search, dm, scan or typed): the catalog's category decides the type when
 * there is one, the name otherwise; then the usage question, or straight to the add.
 */
export function beginAdd(
  capture: DiscoveryIntakeProductCaptureInput,
  subject: DiscoveryFlowSubject,
  catalogCategory?: string | null,
): DiscoveryFlowNext {
  const { productType } = classifyDiscoveryProduct({ catalogCategory, name: subject.name })
  return continueWithType({ kind: "add", capture, subject }, productType, false)
}

function currentOptionKey(
  question: DiscoveryUsageQuestion,
  item: DiscoveryIntakeItemView,
): DiscoveryUsageOptionKey | null {
  const role = item.usageRole ?? null
  return (
    question.options.find(
      (option) => option.usage.category === item.category && option.usage.role === role,
    )?.key ?? null
  )
}

export function subjectOf(item: DiscoveryIntakeItemView): DiscoveryFlowSubject {
  return {
    title: itemDisplayName(item),
    imageUrl: item.imageUrl ?? null,
    name: item.productNameText,
  }
}

/**
 * A pill (or review row) tap. `null` = nothing she can change here: a product type with no
 * usage question (heat protectant, dry shampoo, bondbuilder, scalp care) is fixed.
 *
 * Type-open („Weiß ich nicht" at capture) → „Was ist das?". Any other product → its type's
 * usage question with her current answer in plum; a legacy row has no type, so its
 * category stands in for it.
 */
export function beginChange(item: DiscoveryIntakeItemView): DiscoveryFlowSheet | null {
  if (!isProductItem(item)) return null
  const target: DiscoveryFlowTarget = { kind: "change", item, subject: subjectOf(item) }
  const type = item.productType ?? item.category
  if (!type) return { kind: "what_is_it", target, current: "unknown" }
  const step = discoveryUsageStepFor(type, item.productNameText)
  if (step.kind !== "ask") return null
  return {
    kind: "usage",
    target,
    question: step.question,
    highlighted: currentOptionKey(step.question, item),
    productType: item.productType ?? null,
    typeChosen: false,
  }
}

/** A „Was ist das?" chip; `null` = „Weiß ich nicht". */
export function chooseType(
  sheet: Extract<DiscoveryFlowSheet, { kind: "what_is_it" }>,
  productType: PersonalPlanCategory | null,
): DiscoveryFlowNext {
  if (productType === null) {
    // Stored without type, usage or research (F1) — and on a type-open item nothing changes.
    return sheet.target.kind === "add" ? commit(sheet.target, null, null, false) : { kind: "close" }
  }
  return continueWithType(sheet.target, productType, true)
}

/** A usage option — always the last tap: exactly one request follows. */
export function chooseUsage(
  sheet: Extract<DiscoveryFlowSheet, { kind: "usage" }>,
  option: DiscoveryUsageOption,
): DiscoveryFlowNext {
  return commit(sheet.target, sheet.productType, option.usage, sheet.typeChosen)
}

// --- Review ----------------------------------------------------------------------------

export type DiscoveryReviewGroup = {
  key: PersonalPlanCategory | "unknown"
  label: string
  items: DiscoveryIntakeItemView[]
}

/** Her products by usage, in shelf order; „Weiß ich nicht" last. */
export function reviewGroups(items: DiscoveryIntakeItemView[]): DiscoveryReviewGroup[] {
  const products = items.filter(isProductItem)
  const groups: DiscoveryReviewGroup[] = DISCOVERY_CATEGORY_ORDER.map((key) => ({
    key,
    label: categoryLabel(key),
    items: products.filter((item) => item.category === key),
  }))
  groups.push({
    key: "unknown",
    label: DISCOVERY_UNKNOWN_TYPE_LABEL,
    items: products.filter((item) => item.category === null),
  })
  return groups.filter((group) => group.items.length > 0)
}

/** „Nichts eingetragen für: …" — every category without a product of hers. */
export function missingCategoryLabels(items: DiscoveryIntakeItemView[]): string[] {
  const used = new Set(items.filter(isProductItem).map((item) => item.category))
  return DISCOVERY_CATEGORY_ORDER.filter((key) => !used.has(key)).map(categoryLabel)
}
