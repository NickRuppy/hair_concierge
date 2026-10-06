import "server-only"
import { createHash } from "node:crypto"

import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import { UNSELECTED_SHAMPOO_PRODUCT_NAME } from "@/lib/product-usage/shampoo-fallback"
import { STAGE2_PRODUCT_CATEGORIES, type Stage2ProductCategory } from "../refinement/types"

import {
  PERSONAL_PLAN_PRODUCT_CATEGORIES,
  type PersonalPlanCategory,
  type Stage3AuthoritySnapshotV1,
  type Stage3CategoryRequirement,
  type Stage3LegacyPrefillHintsV1,
} from "./contracts"
import { createStage3Draft } from "./state-machine"

/**
 * Storage-agnostic inventory input. Callers authenticate usage rows to the current user and
 * revalidate catalog matches against current publication/category authority.
 */
export type LegacyInventoryPrefillInput = {
  usageRows: readonly LegacyProductUsageRow[]
}

export type LegacyCatalogMatch = {
  productId: string
  displayName: string
  category: string
  /** The caller's current catalog-authority check; historical match status is not authority. */
  eligible: boolean
}

export type LegacyProductUsageRow = {
  id: string
  category: string
  productName: string | null
  frequencyRange: string | null
  catalogMatch?: LegacyCatalogMatch | null
}

export type LegacyExactInventorySeed = {
  usageId: string
  productId: string
  displayName: string
  category: Stage2ProductCategory
  frequencyRange: ProductFrequency
}

/** A UI-only prefill, not a captured product or an intake submission. */
export type LegacyProductHint =
  | {
      kind: "catalog_frequency_required"
      usageId: string
      productId: string
      displayName: string
      category: Stage2ProductCategory
    }
  | {
      kind: "search_name"
      usageId: string
      category: Stage2ProductCategory
      productName: string
    }

export type LegacyInventoryPrefill = {
  mappingVersion: "legacy-prefill-v1"
  /** Exact, currently eligible inventory with a usable observed frequency. */
  exactInventory: LegacyExactInventorySeed[]
  /** Unresolved UI hints that must pass the normal search/frequency flow. */
  productHints: LegacyProductHint[]
  /** Stable input-row IDs for the receipt/audit layer; this module does not write that receipt. */
  sourceIds: string[]
  sourceFingerprint: string
}

const productCategorySet = new Set<string>(STAGE2_PRODUCT_CATEGORIES)
const frequencySet = new Set<string>(PRODUCT_FREQUENCIES)

const stage3CategorySet = new Set<string>(PERSONAL_PLAN_PRODUCT_CATEGORIES)

export function isStage3LegacyInventoryCategory(value: string): value is PersonalPlanCategory {
  return stage3CategorySet.has(value)
}

export function filterStage3ExactInventory(input: {
  prefill: LegacyInventoryPrefill
  orderedCategories: readonly PersonalPlanCategory[]
}): LegacyExactInventorySeed[] {
  const allowed = new Set(input.orderedCategories)
  return input.prefill.exactInventory.filter(
    (item) => isStage3LegacyInventoryCategory(item.category) && allowed.has(item.category),
  )
}

export function buildStage3LegacyPrefillHints(input: {
  prefill: LegacyInventoryPrefill
  orderedCategories: readonly PersonalPlanCategory[]
}): Stage3LegacyPrefillHintsV1 {
  const allowed = new Set(input.orderedCategories)
  const categories: Stage3LegacyPrefillHintsV1["categories"] = {}
  for (const hint of input.prefill.productHints) {
    if (!isStage3LegacyInventoryCategory(hint.category) || !allowed.has(hint.category)) continue
    const stage3Hint = hint as LegacyProductHint & { category: PersonalPlanCategory }
    const current = categories[stage3Hint.category] ?? []
    categories[stage3Hint.category] = [...current, stage3Hint]
  }
  return {
    schemaVersion: 1,
    sourceFingerprint: input.prefill.sourceFingerprint,
    categories,
  }
}

export function createStage3OptionalInventorySeedDraft(input: {
  draftId: string
  userId: string
  personalPlanId: string
  refinedVersionId: string
  requirements: Stage3CategoryRequirement[]
  authoritySnapshot?: Stage3AuthoritySnapshotV1
  prefill: LegacyInventoryPrefill
  now: string
}) {
  return {
    ...createStage3Draft({
      draftId: input.draftId,
      userId: input.userId,
      personalPlanId: input.personalPlanId,
      refinedVersionId: input.refinedVersionId,
      requirements: input.requirements,
      authoritySnapshot: input.authoritySnapshot,
      now: input.now,
    }),
    legacyPrefillHints: buildStage3LegacyPrefillHints({
      prefill: input.prefill,
      orderedCategories: input.requirements.map((requirement) => requirement.category),
    }),
  }
}

function asProductCategory(value: string): Stage2ProductCategory | null {
  return productCategorySet.has(value) ? (value as Stage2ProductCategory) : null
}

function asFrequency(value: string | null | undefined): ProductFrequency | null {
  return value && frequencySet.has(value) ? (value as ProductFrequency) : null
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function isUnselectedShampooFallback(row: LegacyProductUsageRow): boolean {
  return (
    row.category === "shampoo" &&
    row.productName === UNSELECTED_SHAMPOO_PRODUCT_NAME &&
    row.frequencyRange === "less_than_monthly"
  )
}

function isEligibleExactMatch(
  row: LegacyProductUsageRow,
  category: Stage2ProductCategory,
): boolean {
  const match = row.catalogMatch
  return Boolean(
    match &&
    match.eligible &&
    match.category === category &&
    match.productId.length > 0 &&
    match.displayName.trim().length > 0,
  )
}

function mapInventory(
  input: LegacyInventoryPrefillInput,
): Pick<LegacyInventoryPrefill, "exactInventory" | "productHints"> {
  const exactInventory: LegacyExactInventorySeed[] = []
  const productHints: LegacyProductHint[] = []
  const exactKeys = new Set<string>()
  const hintKeys = new Set<string>()
  const exactGroups = new Map<
    string,
    Array<{
      row: LegacyProductUsageRow
      category: Stage2ProductCategory
      frequencyRange: ProductFrequency | null
    }>
  >()

  const rows = [...input.usageRows]
  for (const row of rows) {
    if (isUnselectedShampooFallback(row)) continue
    const category = asProductCategory(row.category)
    if (!category) continue
    const frequencyRange = asFrequency(row.frequencyRange)

    if (isEligibleExactMatch(row, category)) {
      const match = row.catalogMatch!
      const exactKey = `${category}:${match.productId}`
      exactGroups.set(exactKey, [
        ...(exactGroups.get(exactKey) ?? []),
        { row, category, frequencyRange },
      ])
      continue
    }

    const name = row.productName?.trim() || null

    if (name) {
      const hintKey = `name:${category}:${name.toLocaleLowerCase("de-DE")}`
      if (!hintKeys.has(hintKey)) {
        hintKeys.add(hintKey)
        productHints.push({ kind: "search_name", usageId: row.id, category, productName: name })
      }
    }
  }

  for (const [exactKey, group] of exactGroups) {
    const first = group[0]
    const match = first.row.catalogMatch!
    const frequencies = unique(group.map(({ frequencyRange }) => frequencyRange))
    if (frequencies.length === 1 && frequencies[0] && !exactKeys.has(exactKey)) {
      exactKeys.add(exactKey)
      exactInventory.push({
        usageId: first.row.id,
        productId: match.productId,
        displayName: match.displayName,
        category: first.category,
        frequencyRange: frequencies[0],
      })
      continue
    }

    const hintKey = `catalog:${exactKey}`
    if (!hintKeys.has(hintKey)) {
      hintKeys.add(hintKey)
      productHints.push({
        kind: "catalog_frequency_required",
        usageId: first.row.id,
        productId: match.productId,
        displayName: match.displayName,
        category: first.category,
      })
    }
  }

  const hintPosition = new Map(rows.map((row, index) => [row.id, index]))
  productHints.sort(
    (left, right) =>
      (hintPosition.get(left.usageId) ?? Number.MAX_SAFE_INTEGER) -
      (hintPosition.get(right.usageId) ?? Number.MAX_SAFE_INTEGER),
  )
  return { exactInventory, productHints }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value)
  }
  if (typeof value === "string") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`
  }
  return "null"
}

function stableFingerprint(input: LegacyInventoryPrefillInput): string {
  const serialized = canonicalJson({
    usageRows: [...input.usageRows]
      .map((row) => ({
        id: row.id,
        category: row.category,
        productName: row.productName,
        frequencyRange: row.frequencyRange,
        catalogMatch: row.catalogMatch ?? null,
      }))
      .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
  })
  return `legacy-prefill-v1:sha256:${createHash("sha256").update(serialized).digest("hex")}`
}

export function mapLegacyInventoryPrefill(
  input: LegacyInventoryPrefillInput,
): LegacyInventoryPrefill {
  const inventory = mapInventory(input)
  return {
    mappingVersion: "legacy-prefill-v1",
    ...inventory,
    sourceIds: unique(input.usageRows.map((row) => row.id)).sort(),
    sourceFingerprint: stableFingerprint(input),
  }
}
