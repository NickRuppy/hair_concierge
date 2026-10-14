import "server-only"
import { createHash } from "node:crypto"

import {
  NIGHT_PROTECTIONS,
  normalizeNightProtectionValues,
  normalizeTowelTechniqueValue,
  TOWEL_MATERIALS,
  type TowelMaterial,
} from "@/lib/vocabulary/onboarding-care"
import { PRODUCT_FREQUENCIES, type ProductFrequency } from "@/lib/vocabulary/frequencies"
import { UNSELECTED_SHAMPOO_PRODUCT_NAME } from "@/lib/product-usage/shampoo-fallback"
import {
  STAGE2_PRODUCT_CATEGORIES,
  type AdditionalHeatTool,
  type DryingRoute,
  type PersonalPlanRefinementAnswersV1,
  type Stage2ProductCategory,
} from "./refinement/types"

/**
 * Pure, storage-agnostic input for the one-time optional legacy prefill. Callers must provide
 * rows already authenticated to the current user and catalog matches already revalidated against
 * current publication/category authority. This module neither queries nor mutates persistence.
 */
export type LegacyRefinementPrefillInput = {
  profile: LegacyPrefillProfile
  usageRows: readonly LegacyProductUsageRow[]
}

export type LegacyPrefillProfile = {
  shampooFrequency?: string | null
  towelMaterial?: string | null
  towelTechnique?: string | null
  dryingMethod?: string | readonly string[] | null
  stylingTools?: readonly string[] | null
  nightProtection?: readonly string[] | null
  /**
   * Independent evidence that an old optional-array question was submitted. Empty historical
   * arrays are otherwise indistinguishable from the former database defaults.
   */
  submittedFields?: readonly ("styling_tools" | "night_protection")[]
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

export type LegacyRefinementPrefill = {
  mappingVersion: "legacy-prefill-v1"
  /** Overlay only these user-origin facts into an explicitly prepared optional Stage 2 draft. */
  stage2Answers: PersonalPlanRefinementAnswersV1
  /** Exact, currently eligible inventory with a usable observed frequency. */
  exactInventory: LegacyExactInventorySeed[]
  /** Unresolved UI hints that must pass the normal search/frequency flow. */
  productHints: LegacyProductHint[]
  /** Stable input-row IDs for the receipt/audit layer; this module does not write that receipt. */
  sourceIds: string[]
  sourceFingerprint: string
}

const productCategorySet = new Set<string>(STAGE2_PRODUCT_CATEGORIES)
const towelMaterialSet = new Set<string>(TOWEL_MATERIALS)
const dryingRouteMap: Record<string, DryingRoute> = {
  air_dry: "air_dry",
  blow_dry: "ordinary_blow_dry",
  blow_dry_diffuser: "diffuser_or_airflow_shaping",
}
const additionalHeatToolMap: Record<string, AdditionalHeatTool> = {
  hot_air_brush: "dryer_brush",
  flat_iron: "straightener",
  curling_iron: "curling_or_wave_iron",
  wave_iron: "curling_or_wave_iron",
  thermal_rollers: "thermal_rollers",
}
const frequencySet = new Set<string>(PRODUCT_FREQUENCIES)

function asProductCategory(value: string): Stage2ProductCategory | null {
  return productCategorySet.has(value) ? (value as Stage2ProductCategory) : null
}

function asFrequency(value: string | null | undefined): ProductFrequency | null {
  return value && frequencySet.has(value) ? (value as ProductFrequency) : null
}

function unique<T>(values: readonly T[]): T[] {
  return Array.from(new Set(values))
}

function mapDryingMethods(value: LegacyPrefillProfile["dryingMethod"]): DryingRoute[] | undefined {
  const values = Array.isArray(value) ? value : value ? [value] : []
  const mapped = unique(
    values.flatMap((method) => {
      const route = dryingRouteMap[method]
      return route ? [route] : []
    }),
  )
  return mapped.length > 0 ? mapped : undefined
}

function mapStylingTools(profile: LegacyPrefillProfile): AdditionalHeatTool[] | undefined {
  const tools = profile.stylingTools
  if (!tools) return undefined
  if (tools.length === 0) {
    return profile.submittedFields?.includes("styling_tools") ? [] : undefined
  }
  const mapped = unique(
    tools.flatMap((tool) => {
      const mappedTool = additionalHeatToolMap[tool]
      return mappedTool ? [mappedTool] : []
    }),
  )
  return mapped.length > 0 ? mapped : undefined
}

function mapStage2Answers(input: LegacyRefinementPrefillInput): PersonalPlanRefinementAnswersV1 {
  const answers: PersonalPlanRefinementAnswersV1 = {}
  const categories = unique(
    input.usageRows.flatMap((row) => {
      if (isUnselectedShampooFallback(row)) return []
      const category = asProductCategory(row.category)
      return category ? [category] : []
    }),
  )
  if (categories.length > 0) answers.currentProductCategories = categories

  const shampooFrequency = asFrequency(input.profile.shampooFrequency)
  if (shampooFrequency) answers.wetWashFrequency = shampooFrequency

  const towelMaterial = input.profile.towelMaterial
  if (towelMaterial && towelMaterialSet.has(towelMaterial)) {
    const material = towelMaterial as TowelMaterial
    const technique =
      material === "no_towel" ? null : normalizeTowelTechniqueValue(input.profile.towelTechnique)
    answers.towel = technique ? { material, technique } : { material }
  }

  const dryingRoutes = mapDryingMethods(input.profile.dryingMethod)
  if (dryingRoutes) answers.dryingRoutes = dryingRoutes

  const additionalHeatTools = mapStylingTools(input.profile)
  if (additionalHeatTools) answers.additionalHeatTools = additionalHeatTools

  const nightProtection = input.profile.nightProtection
  if (
    nightProtection &&
    (nightProtection.length > 0 || input.profile.submittedFields?.includes("night_protection"))
  ) {
    const normalized = normalizeNightProtectionValues(nightProtection)
    if (
      normalized &&
      (normalized.length > 0 ||
        (nightProtection.length === 0 &&
          input.profile.submittedFields?.includes("night_protection")))
    ) {
      answers.nightProtection = normalized.filter((value) => NIGHT_PROTECTIONS.includes(value))
    }
  }

  return answers
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
  input: LegacyRefinementPrefillInput,
): Pick<LegacyRefinementPrefill, "exactInventory" | "productHints"> {
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

function stableFingerprint(input: LegacyRefinementPrefillInput): string {
  const serialized = canonicalJson({
    profile: input.profile,
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

export function mapLegacyRefinementPrefill(
  input: LegacyRefinementPrefillInput,
): LegacyRefinementPrefill {
  const inventory = mapInventory(input)
  return {
    mappingVersion: "legacy-prefill-v1",
    stage2Answers: mapStage2Answers(input),
    ...inventory,
    sourceIds: unique(input.usageRows.map((row) => row.id)).sort(),
    sourceFingerprint: stableFingerprint(input),
  }
}
