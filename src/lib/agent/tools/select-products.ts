import {
  buildRecommendationEngineRuntimeForChat,
  getLeaveInMissingProfileFields,
  getOilMissingProfileFields,
  getShampooMissingProfileFields,
  selectBondbuilderProductsWithEngine,
  selectConditionerProductsWithEngine,
  selectDeepCleansingShampooProductsWithEngine,
  selectDryShampooProductsWithEngine,
  selectLeaveInProductsWithEngine,
  selectMaskProductsWithEngine,
  selectOilProductsWithEngine,
  selectPeelingProductsWithEngine,
  selectShampooProductsWithEngine,
} from "@/lib/recommendation-engine"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import type { RecommendationEngineRuntime } from "@/lib/recommendation-engine/runtime"
import type { CategoryDecision, EffectiveCareContext } from "@/lib/recommendation-engine/types"
import {
  buildCareBalanceToolContext,
  type CareBalanceToolContext,
  type CareBalanceToolRow,
} from "@/lib/agent/tools/care-balance-context"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { UserMemoryContext } from "@/lib/rag/user-memory"
import type {
  BondbuilderRecommendationMetadata,
  ConditionerRecommendationMetadata,
  DeepCleansingShampooRecommendationMetadata,
  DryShampooRecommendationMetadata,
  HairProfile,
  LeaveInRecommendationMetadata,
  MaskRecommendationMetadata,
  OilRecommendationMetadata,
  ShampooRecommendationMetadata,
} from "@/lib/types"
import type {
  ActiveProfileSignalField,
  AgentActiveProfileSignal,
  AgentConcern,
  AgentUserJob,
} from "@/lib/agent/orchestrator/route-packet"
import type { SelectableProductCategory } from "@/lib/agent/contracts"
import {
  CONDITIONER_REPAIR_LEVEL_LABELS,
  CONDITIONER_WEIGHT_LABELS,
} from "@/lib/conditioner/constants"
import { OIL_PURPOSE_LABELS, OIL_SUBTYPE_LABELS } from "@/lib/oil/constants"
import {
  LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS,
  LEAVE_IN_FORMAT_LABELS,
  LEAVE_IN_ROLE_LABELS,
  LEAVE_IN_WEIGHT_LABELS,
} from "@/lib/leave-in/constants"
import { SHAMPOO_BUCKET_LABELS } from "@/lib/shampoo/constants"
import {
  PRODUCT_BOND_PRODUCT_FORMAT_LABELS,
  PRODUCT_BOND_REPAIR_AXIS_LABELS,
  PRODUCT_BOND_TREATMENT_MODE_LABELS,
  PRODUCT_BOND_USAGE_PROTOCOL_LABELS,
  type DryShampooFormat,
  type DryShampooHairColorFit,
  type DryShampooPrimaryEffect,
  type DryShampooScalpSensitivityFit,
} from "@/lib/product-specs/constants"
import {
  HAIR_DENSITIES,
  HAIR_DENSITY_LABELS,
  HAIR_TEXTURE_LABELS,
  HAIR_TEXTURES,
  HAIR_THICKNESS_LABELS,
  HAIR_THICKNESSES,
  HEAT_STYLING_LEVELS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_CONDITIONS,
  SCALP_CONDITION_LABELS,
  SCALP_TYPES,
  SCALP_TYPE_LABELS,
  STYLING_TOOLS,
  type HeatStyling,
  type HairDensity,
  type HairTexture,
  type HairThickness,
  type ScalpCondition,
  type ScalpType,
  type StylingTool,
} from "@/lib/vocabulary"

export type { SelectableProductCategory } from "@/lib/agent/contracts"
export type SelectProductsDecision =
  | "recommended"
  | "needs_more_info"
  | "not_recommended"
  | "no_catalog_match"

export type ProductResponsePolicy =
  | "recommend"
  | "recommend_with_caveat"
  | "explain_then_recommend"
  | "redirect_to_better_lever"
  | "caution_without_products"
  | "needs_more_info"
  | "no_catalog_match"

export interface SelectProductsRouteContext {
  userJob?: AgentUserJob | null
  message?: string | null
  concerns?: AgentConcern[] | null
  requestedGoal?: "shine" | null
  activeProfileSignals?: AgentActiveProfileSignal[] | null
  requestedIngredientSignals?: RequestedIngredientSignal[] | null
  requestedHeatTemperatureSignals?: RequestedHeatTemperatureSignal[] | null
  originalHairProfile?: HairProfile | null
}

export interface RequestedIngredientSignal {
  value: string
  evidence: string
}

export interface RequestedHeatTemperatureSignal {
  value: string
  evidence: string
}

export type ProductClaimEvidence = "product_spec" | "category_decision" | "profile_match"

export const SUPPORTED_PRODUCT_CLAIM_FIELDS = [
  "shampoo_bucket",
  "scalp_route",
  "cleansing_intensity",
  "weight",
  "balance_direction",
  "repair_level",
  "concentration",
  "fit_status",
  "format",
  "heat_protection",
  "conditioner_relationship",
  "leave_in_role",
  "care_benefit",
  "oil_purpose",
  "oil_subtype",
  "reset_focus",
  "reset_intensity",
  "color_treated_suitability",
  "primary_effect",
  "hair_color_fit",
  "scalp_sensitivity_fit",
  "usage_hint",
  "bond_repair_axis",
  "treatment_mode",
  "usage_protocol",
  "product_format",
  "lifecycle_status",
  "primary_effect",
  "hair_color_fit",
  "scalp_sensitivity_fit",
] as const

export type StructuredProductClaimField = (typeof SUPPORTED_PRODUCT_CLAIM_FIELDS)[number]

export interface SupportedProductClaim {
  field: ActiveProfileSignalField | StructuredProductClaimField
  value: string
  evidence: ProductClaimEvidence
  label: string
}

export interface UnsupportedRequestedSignal {
  field: ActiveProfileSignalField | "ingredient_preference" | "heat_temperature"
  value: string
  reason: "no_structured_product_data" | "not_a_shampoo_fit_axis" | "safety_caution"
  user_message: string
}

export interface SelectedProductResult {
  rank: number
  product_id: string
  name: string
  brand: string | null
  price_eur: number | null
  currency: string | null
  fit_reason: string
  caveat: string | null
  supported_claims: SupportedProductClaim[]
  unsupported_requested_signals: UnsupportedRequestedSignal[]
}

export interface SelectedProductsMissingInfo {
  key:
    | "thickness"
    | "scalp_type"
    | "scalp_condition"
    | "hair_texture"
    | "density"
    | "care_signal"
    | "styling_signal"
    | "oil_purpose"
    | "protein_moisture_balance"
    | "recommendation_goal"
  label:
    | "Haardicke"
    | "Kopfhaut-Typ"
    | "Kopfhaut-Beschwerden"
    | "Haarmuster"
    | "Haardichte"
    | "Pflegebedarf"
    | "Styling-Kontext"
    | "Öl-Zweck"
    | "Protein-/Feuchtigkeitsbalance"
    | "Einsatzziel"
  blocking: boolean
  detail: string
}

export interface SelectedProductsProjection {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  product_response_policy: ProductResponsePolicy
  policy_reason: string
  profile_basis: string[]
  category_guidance: string
  products: SelectedProductResult[]
  comparison_facts: Record<string, string[]> | null
  care_balance_context?: ProductCareBalanceContext | null
  missing_info: SelectedProductsMissingInfo[]
  unsupported_requested_signals: UnsupportedRequestedSignal[]
}

export type ProductCareBalanceContext = CareBalanceToolContext
export type ProductCareBalanceRow = CareBalanceToolRow

export interface SelectProductsToolResult {
  projection: SelectedProductsProjection
  products: MatchedProduct[]
  effectiveHairProfile: HairProfile | null
  runtime: RecommendationEngineRuntime
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))]
}

function projectDisplayableProduct(
  product: MatchedProduct,
  rank: number,
  routeContext: SelectProductsRouteContext | null = null,
): SelectedProductResult {
  const meta = product.recommendation_meta
  const caveat = mapDisplayableCaveat(meta?.tradeoffs?.[0] ?? null)
  const supportedClaims = buildSupportedProductClaims(product)
  const unsupportedRequestedSignals = [
    ...buildUnsupportedRequestedSignals(routeContext?.activeProfileSignals ?? [], supportedClaims),
    ...(meta?.category === "shampoo" ||
    meta?.category === "conditioner" ||
    meta?.category === "leave_in" ||
    meta?.category === "mask" ||
    meta?.category === "oil"
      ? buildUnsupportedIngredientSignals(
          routeContext?.requestedIngredientSignals ?? [],
          meta.category,
        )
      : []),
  ]

  return {
    rank,
    product_id: product.id,
    name: product.name,
    brand: product.brand,
    price_eur: product.price_eur,
    currency: product.currency,
    fit_reason: buildDisplayableFitReason(product),
    caveat,
    supported_claims: supportedClaims,
    unsupported_requested_signals: unsupportedRequestedSignals,
  }
}

function mapDisplayableCaveat(caveat: string | null): string | null {
  if (!caveat) return null

  if (/^fallback:/i.test(caveat.trim())) {
    return "Nachgeordnet: nicht ganz so passend zum abgeleiteten Fokus; nur verwenden, wenn keine besseren Treffer verfügbar sind."
  }

  const normalized = caveat.trim().toLocaleLowerCase("de-DE")
  if (
    normalized === "weicht vom aktuellen kopfhaut-fokus ab." ||
    normalized === "weicht vom aktuellen kopfhaut-fokus ab" ||
    (/weicht.*kopfhaut-fokus/.test(normalized) && !/fallback/.test(normalized))
  ) {
    return "Passt nicht exakt zum abgeleiteten Shampoo-Fokus. Nur nachgeordnet zeigen, wenn keine ausreichend passenden Treffer verfügbar sind."
  }

  return caveat
}

function buildComparisonFacts(products: MatchedProduct[]): Record<string, string[]> | null {
  if (products.length < 2) {
    return null
  }

  if (products.every((product) => product.recommendation_meta?.category === "conditioner")) {
    return buildConditionerComparisonFactsForSet(products)
  }

  if (products.every((product) => product.recommendation_meta?.category === "leave_in")) {
    return buildLeaveInComparisonFactsForSet(products)
  }

  if (products.every((product) => product.recommendation_meta?.category === "mask")) {
    return buildMaskComparisonFactsForSet(products)
  }

  if (products.every((product) => product.recommendation_meta?.category === "oil")) {
    return buildOilComparisonFactsForSet(products)
  }

  if (products.every((product) => product.recommendation_meta?.category === "bondbuilder")) {
    return Object.fromEntries(
      products.map((product) => [product.id, buildBondbuilderComparisonFacts(product)]),
    )
  }

  if (products.every((product) => product.recommendation_meta?.category === "dry_shampoo")) {
    return Object.fromEntries(
      products.map((product) => [
        product.id,
        buildDryShampooComparisonFacts(
          product.recommendation_meta as DryShampooRecommendationMetadata,
        ),
      ]),
    )
  }

  if (
    products.every((product) => product.recommendation_meta?.category === "deep_cleansing_shampoo")
  ) {
    return Object.fromEntries(
      products.map((product) => {
        const meta = product.recommendation_meta
        return [
          product.id,
          uniqueNonEmpty([
            meta?.category === "deep_cleansing_shampoo" && meta.reset_focus
              ? `Reset-Fokus: ${DEEP_CLEANSING_RESET_FOCUS_LABELS[meta.reset_focus]}`
              : null,
            meta?.category === "deep_cleansing_shampoo" && meta.reset_intensity
              ? `Reset-Intensität: ${DEEP_CLEANSING_RESET_INTENSITY_LABELS[meta.reset_intensity]}`
              : null,
            meta?.category === "deep_cleansing_shampoo" &&
            meta.color_treated_suitability === "suitable"
              ? "Farbschutz: strukturiert geeignet"
              : null,
          ]).slice(0, 3),
        ]
      }),
    )
  }

  return Object.fromEntries(
    products.map((product) => [product.id, buildProductComparisonFacts(product)]),
  )
}

function buildProductCareBalanceContext(params: {
  runtime: RecommendationEngineRuntime | null
  category: SelectableProductCategory | null
}): ProductCareBalanceContext | null {
  const runtime = params.runtime
  if (!runtime || !params.category) return null

  const primaryRows = runtime.careBalance.rows.filter(
    (row) =>
      row.category === params.category ||
      (params.category === "leave_in" && row.category === "heat_protectant"),
  )
  const rowsWithActions = primaryRows.filter((row) => row.recommendation !== "no_action")
  const rows = rowsWithActions.length > 0 ? rowsWithActions : primaryRows
  if (rows.length === 0) return null

  return buildCareBalanceToolContext({ runtime, rows })
}

function buildConditionerComparisonFactsForSet(
  products: MatchedProduct[],
): Record<string, string[]> | null {
  const factRows = products.map((product) => {
    const meta = product.recommendation_meta as ConditionerRecommendationMetadata
    return {
      product,
      meta,
      candidates: [
        meta.product_balance_direction
          ? {
              key: "balance_direction",
              value: meta.product_balance_direction,
              text: `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`,
            }
          : null,
        meta.product_weight
          ? {
              key: "weight",
              value: meta.product_weight,
              text: `Gewicht: ${CONDITIONER_WEIGHT_LABELS[meta.product_weight]}`,
            }
          : null,
        meta.product_repair_level
          ? {
              key: "repair_level",
              value: meta.product_repair_level,
              text: `Pflegeintensität: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`,
            }
          : null,
        meta.fit_status
          ? {
              key: "fit_status",
              value: `${meta.fit_status}:${
                meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"
                  ? "nachgeordnet"
                  : "primary"
              }`,
              text:
                meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"
                  ? "Nachgeordnet: nicht ganz so passend"
                  : `Fit: ${CONDITIONER_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`,
            }
          : null,
        typeof product.price_eur === "number"
          ? {
              key: "price",
              value: String(product.price_eur),
              text: `Preis: ${product.price_eur.toFixed(2)} EUR`,
            }
          : null,
      ].filter((candidate): candidate is { key: string; value: string; text: string } =>
        Boolean(candidate),
      ),
    }
  })
  const valuesByKey = new Map<string, Set<string>>()
  for (const row of factRows) {
    for (const candidate of row.candidates) {
      const values = valuesByKey.get(candidate.key) ?? new Set<string>()
      values.add(candidate.value)
      valuesByKey.set(candidate.key, values)
    }
  }
  const result: Record<string, string[]> = {}

  for (const row of factRows) {
    const facts: string[] = []
    for (const candidate of row.candidates) {
      if (candidate.key === "price") continue
      const values = valuesByKey.get(candidate.key)
      if (!values || values.size <= 1) continue
      facts.push(candidate.text)
      if (facts.length >= 3) break
    }
    preferMismatchFitFact(facts, row.candidates)

    for (const candidate of row.candidates) {
      if (facts.length >= 2) break
      if (facts.includes(candidate.text) || candidate.key === "price") continue
      facts.push(candidate.text)
    }
    appendSecondaryPriceFact(facts, row.candidates)

    if (facts.length > 0) {
      result[row.product.id] = facts
      continue
    }

    const fallbackPrice = row.candidates.find((candidate) => candidate.key === "price")
    result[row.product.id] = fallbackPrice
      ? [fallbackPrice.text]
      : row.candidates.slice(0, 1).map((item) => item.text)
  }

  return result
}

function buildLeaveInComparisonFactsForSet(
  products: MatchedProduct[],
): Record<string, string[]> | null {
  const factRows = products.map((product) => {
    const meta = product.recommendation_meta as LeaveInRecommendationMetadata
    return {
      product,
      candidates: [
        meta.product_format
          ? {
              key: "format",
              value: meta.product_format,
              text: `Format: ${LEAVE_IN_FORMAT_LABELS[meta.product_format]}`,
            }
          : null,
        meta.product_weight
          ? {
              key: "weight",
              value: meta.product_weight,
              text: `Gewicht: ${LEAVE_IN_WEIGHT_LABELS[meta.product_weight]}`,
            }
          : null,
        meta.product_balance_direction
          ? {
              key: "balance_direction",
              value: meta.product_balance_direction,
              text: `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`,
            }
          : null,
        typeof meta.provides_heat_protection === "boolean"
          ? {
              key: "heat_protection",
              value: String(meta.provides_heat_protection),
              text: `Hitzeschutz: ${meta.provides_heat_protection ? "ja" : "nein"}`,
            }
          : null,
        meta.fit_status
          ? {
              key: "fit_status",
              value: meta.fit_status,
              text: `Fit: ${LEAVE_IN_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`,
            }
          : null,
        typeof product.price_eur === "number"
          ? {
              key: "price",
              value: product.price_eur.toFixed(2),
              text: `Preis: ${product.price_eur.toFixed(2)} EUR`,
            }
          : null,
      ].filter((candidate): candidate is { key: string; value: string; text: string } =>
        Boolean(candidate),
      ),
    }
  })
  const result: Record<string, string[]> = {}

  for (const row of factRows) {
    const facts: string[] = []
    for (const candidate of row.candidates) {
      if (candidate.key === "price") continue
      const values = new Set(
        factRows.map((other) => other.candidates.find((item) => item.key === candidate.key)?.value),
      )
      if (values.size <= 1) continue
      facts.push(candidate.text)
      if (facts.length >= 3) break
    }
    preferMismatchFitFact(facts, row.candidates)

    for (const candidate of row.candidates) {
      if (facts.length >= 2) break
      if (facts.includes(candidate.text) || candidate.key === "price") continue
      facts.push(candidate.text)
    }
    appendSecondaryPriceFact(facts, row.candidates)

    result[row.product.id] =
      facts.length > 0 ? facts : row.candidates.slice(0, 1).map((item) => item.text)
  }

  return result
}

interface ComparisonFactCandidate {
  key: string
  value: string
  text: string
}

function preferMismatchFitFact(
  facts: string[],
  candidates: Array<{ key: string; value: string; text: string }>,
): void {
  const mismatchFit = candidates.find(
    (candidate) =>
      candidate.key === "fit_status" &&
      (candidate.value === "mismatch" || candidate.value.startsWith("mismatch:")),
  )
  if (!mismatchFit || facts.includes(mismatchFit.text)) return

  if (facts.length >= 3) {
    facts[facts.length - 1] = mismatchFit.text
    return
  }

  facts.push(mismatchFit.text)
}

function appendSecondaryPriceFact(
  facts: string[],
  candidates: Array<{ key: string; value: string; text: string }>,
): void {
  if (facts.length < 2 || facts.length >= 3) return
  const price = candidates.find((candidate) => candidate.key === "price")
  if (!price || facts.includes(price.text)) return
  facts.push(price.text)
}

function buildMaskComparisonFactsForSet(products: MatchedProduct[]): Record<string, string[]> {
  const factRows = products.map((product) => {
    const meta = product.recommendation_meta as MaskRecommendationMetadata
    const candidates: Array<ComparisonFactCandidate | null> = [
      meta.product_balance_direction
        ? {
            key: "balance_direction",
            value: meta.product_balance_direction,
            text: `Balance: ${MASK_BALANCE_LABELS[meta.product_balance_direction]}`,
          }
        : null,
      meta.product_concentration
        ? {
            key: "concentration",
            value: meta.product_concentration,
            text: `Intensität: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`,
          }
        : null,
      meta.product_weight
        ? {
            key: "weight",
            value: meta.product_weight,
            text: `Gewicht: ${MASK_WEIGHT_LABELS[meta.product_weight]}`,
          }
        : null,
      meta.fit_status
        ? {
            key: "fit_status",
            value: meta.fit_status,
            text: `Fit: ${MASK_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`,
          }
        : null,
      typeof product.price_eur === "number"
        ? {
            key: "price",
            value: product.price_eur.toFixed(2),
            text: `Preis: ${product.price_eur.toFixed(2)} EUR`,
          }
        : null,
    ]

    return {
      product,
      candidates: candidates.filter((candidate): candidate is ComparisonFactCandidate =>
        Boolean(candidate),
      ),
    }
  })
  const result: Record<string, string[]> = {}

  for (const row of factRows) {
    const facts: string[] = []
    for (const candidate of row.candidates) {
      if (candidate.key === "price") continue
      const values = new Set(
        factRows.map((other) => other.candidates.find((item) => item.key === candidate.key)?.value),
      )
      if (values.size <= 1) continue
      facts.push(candidate.text)
      if (facts.length >= 3) break
    }
    preferMismatchFitFact(facts, row.candidates)

    for (const candidate of row.candidates) {
      if (facts.length >= 2) break
      if (facts.includes(candidate.text) || candidate.key === "price") continue
      facts.push(candidate.text)
    }
    appendSecondaryPriceFact(facts, row.candidates)

    result[row.product.id] =
      facts.length > 0 ? facts : row.candidates.slice(0, 1).map((item) => item.text)
  }

  return result
}

function buildOilComparisonFactsForSet(products: MatchedProduct[]): Record<string, string[]> {
  const factRows = products.map((product) => {
    const meta = product.recommendation_meta as OilRecommendationMetadata
    const candidates: Array<ComparisonFactCandidate | null> = [
      meta.use_mode
        ? {
            key: "oil_purpose",
            value: meta.use_mode,
            text: `Öl-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}`,
          }
        : null,
      meta.matched_subtype
        ? {
            key: "oil_subtype",
            value: meta.matched_subtype,
            text: `Subtyp: ${OIL_SUBTYPE_LABELS[meta.matched_subtype]}`,
          }
        : null,
      meta.purpose_fit
        ? {
            key: "purpose_fit",
            value: meta.purpose_fit,
            text: `Fit: ${meta.purpose_fit === "exact" ? "exakt" : meta.purpose_fit === "bridge" ? "Finish-Bridge" : "Daten unvollständig"}`,
          }
        : null,
      typeof product.price_eur === "number"
        ? {
            key: "price",
            value: String(product.price_eur),
            text: `Preis: ${product.price_eur.toFixed(2)} EUR`,
          }
        : null,
    ]

    return {
      product,
      candidates: candidates.filter((candidate): candidate is ComparisonFactCandidate =>
        Boolean(candidate),
      ),
    }
  })
  const result: Record<string, string[]> = {}

  for (const row of factRows) {
    const facts: string[] = []
    for (const candidate of row.candidates) {
      const values = new Set(
        factRows.map((other) => other.candidates.find((item) => item.key === candidate.key)?.value),
      )
      if (values.size <= 1) continue
      facts.push(candidate.text)
      if (facts.length >= 2) break
    }

    result[row.product.id] =
      facts.length > 0 ? facts : row.candidates.slice(0, 1).map((item) => item.text)
  }

  return result
}

function isFallbackCaveat(caveat: string | null | undefined): boolean {
  return /^fallback:/i.test(caveat?.trim() ?? "")
}

const SHAMPOO_SCALP_ROUTE_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["matched_scalp_route"]>,
  string
> = {
  oily: "fettig/dehydriert",
  balanced: "ausgeglichen",
  dry: "trocken",
  dandruff: "Schuppen",
  dry_flakes: "trockene Schüppchen",
  irritated: "irritiert",
}

const SHAMPOO_CLEANSING_INTENSITY_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["cleansing_intensity"]>,
  string
> = {
  gentle: "sanft",
  regular: "normal",
  clarifying: "klärend",
}

const SHAMPOO_FIT_STATUS_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstützender Treffer",
  mismatch: "weicht ab",
  unknown: "Daten unvollständig",
  not_applicable: "nicht anwendbar",
}

const CONDITIONER_BALANCE_LABELS: Record<
  NonNullable<ConditionerRecommendationMetadata["matched_balance_need"]>,
  string
> = {
  moisture: "Feuchtigkeit",
  balanced: "ausgewogene Pflege",
  protein: "Protein",
}

const CONDITIONER_FIT_STATUS_LABELS: Record<
  NonNullable<ConditionerRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstützender Treffer",
  mismatch: "weicht etwas ab",
  unknown: "Daten unvollständig",
  not_applicable: "nicht anwendbar",
}

const LEAVE_IN_FIT_STATUS_LABELS: Record<
  NonNullable<LeaveInRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstützender Treffer",
  mismatch: "weicht etwas ab",
  unknown: "Daten unvollständig",
  not_applicable: "nicht anwendbar",
}

const MASK_BALANCE_LABELS: Record<
  NonNullable<MaskRecommendationMetadata["product_balance_direction"]>,
  string
> = {
  moisture: "Feuchtigkeit",
  balanced: "Ausgewogen",
  protein: "Protein",
}

const MASK_WEIGHT_LABELS: Record<
  NonNullable<MaskRecommendationMetadata["product_weight"]>,
  string
> = {
  light: "Leicht",
  medium: "Mittel",
  rich: "Reichhaltig",
}

const MASK_CONCENTRATION_LABELS: Record<
  NonNullable<MaskRecommendationMetadata["product_concentration"]>,
  string
> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
}

const MASK_FIT_STATUS_LABELS: Record<
  NonNullable<MaskRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstützender Treffer",
  mismatch: "weicht etwas ab",
  unknown: "Daten unvollständig",
  not_applicable: "nicht anwendbar",
}

const MASK_FIT_STATUS_PREFIXES: Record<
  NonNullable<MaskRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstützender Treffer",
  mismatch: "Schwächerer Treffer",
  unknown: "Treffer mit unvollständigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const OIL_FIT_STATUS_PREFIXES: Record<
  NonNullable<OilRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstützender Treffer",
  mismatch: "Schwächerer Treffer",
  unknown: "Treffer mit unvollständigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const DRY_SHAMPOO_PRIMARY_EFFECT_LABELS: Record<DryShampooPrimaryEffect, string> = {
  classic_refresh: "klassischer Frische-Effekt",
  sensitive_refresh: "sensibler Frische-Effekt",
  volume_texture: "Volumen/Textur",
}

const DRY_SHAMPOO_HAIR_COLOR_FIT_LABELS: Record<DryShampooHairColorFit, string> = {
  universal: "universell",
  blonde_light: "blond/hell",
  brown: "braun",
  dark: "dunkel",
}

const DRY_SHAMPOO_SCALP_SENSITIVITY_LABELS: Record<DryShampooScalpSensitivityFit, string> = {
  normal_only: "normale Kopfhaut",
  sensitive_ok: "sensible Kopfhaut geeignet",
}

const DRY_SHAMPOO_FORMAT_LABELS: Record<DryShampooFormat, string> = {
  aerosol_spray: "Spray",
  powder: "Puder",
  foam_or_liquid: "Schaum/Liquid",
}

const LEAVE_IN_FIT_STATUS_PREFIXES: Record<
  NonNullable<LeaveInRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstützender Treffer",
  mismatch: "Schwächerer Treffer",
  unknown: "Treffer mit unvollständigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const LEAVE_IN_CARE_BENEFIT_LABELS: Record<string, string> = {
  moisture: "Feuchtigkeit",
  protein: "Protein",
  repair: "Repair",
  detangling: "Entwirrung",
  anti_frizz: "Anti-Frizz",
  shine: "Glanz",
  curl_definition: "Definition",
  volume: "Volumen",
}

const CONDITIONER_FIT_STATUS_PREFIXES: Record<
  NonNullable<ConditionerRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstützender Treffer",
  mismatch: "Schwächerer Treffer",
  unknown: "Treffer mit unvollständigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const SHAMPOO_THICKNESS_FIT_PHRASES = {
  fine: "feines Haar",
  normal: "mitteldickes Haar",
  coarse: "kräftiges Haar",
} as const

const SHAMPOO_SCALP_ROUTE_FIT_PHRASES: Record<
  NonNullable<ShampooRecommendationMetadata["matched_scalp_route"]>,
  string
> = {
  oily: "schnell fettenden Kopfhaut-Fokus",
  balanced: "ausgeglichenen Kopfhaut-Fokus",
  dry: "trockenen Kopfhaut-Fokus",
  dandruff: "Schuppen-Fokus",
  dry_flakes: "trockene-Schüppchen-Fokus",
  irritated: "irritierten Kopfhaut-Fokus",
}

const DEEP_CLEANSING_RESET_FOCUS_LABELS: Record<
  NonNullable<DeepCleansingShampooRecommendationMetadata["reset_focus"]>,
  string
> = {
  product_sebum_buildup: "Produkt-, Styling- und Sebum-Aufbau",
  metal_mineral_hard_water: "Kalk-, Chlor-, Mineral- oder Metall-Kontext",
  broad_spectrum_detox: "breiter Styling-, Produkt- und Mineral-Reset",
}

const DEEP_CLEANSING_RESET_INTENSITY_LABELS: Record<
  NonNullable<DeepCleansingShampooRecommendationMetadata["reset_intensity"]>,
  string
> = {
  gentle: "sanft",
  medium: "mittel",
  strong: "stark",
}

const DEEP_CLEANSING_SCALP_FOCUS_LABELS: Record<
  NonNullable<DeepCleansingShampooRecommendationMetadata["scalp_type_focus"]>,
  string
> = {
  oily: "schnell fettender Ansatz",
  balanced: "ausgeglichene Kopfhaut",
  dry: "trockene Kopfhaut",
}

const DEEP_CLEANSING_FIT_STATUS_LABELS: Record<
  NonNullable<DeepCleansingShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstützender Treffer",
  mismatch: "kein sicherer Treffer",
  unknown: "Treffer mit unvollständigen Daten",
  not_applicable: "nicht anwendbarer Treffer",
}

const SHAMPOO_FIT_STATUS_PREFIXES: Record<
  NonNullable<ShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstützender Treffer",
  mismatch: "Schwächerer Treffer",
  unknown: "Treffer mit unvollständigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

function buildDisplayableFitReason(product: MatchedProduct): string {
  const meta = product.recommendation_meta

  if (meta?.category === "shampoo") {
    return buildShampooDisplayableFitReason(meta)
  }

  if (meta?.category === "conditioner") {
    return buildConditionerDisplayableFitReason(meta)
  }

  if (meta?.category === "leave_in") {
    return buildLeaveInDisplayableFitReason(meta)
  }

  if (meta?.category === "mask") {
    return buildMaskDisplayableFitReason(meta)
  }

  if (meta?.category === "oil") {
    return buildOilDisplayableFitReason(meta)
  }

  if (meta?.category === "bondbuilder") {
    const axis = meta.bond_repair_axis
      ? (PRODUCT_BOND_REPAIR_AXIS_LABELS[meta.bond_repair_axis] ?? meta.bond_repair_axis)
      : null
    const protocol = meta.usage_protocol
      ? (PRODUCT_BOND_USAGE_PROTOCOL_LABELS[meta.usage_protocol] ?? meta.usage_protocol)
      : null
    return `${uniqueNonEmpty(["Bondbuilder-Treffer", axis, protocol]).join("; ")}.`
  }

  if (meta?.category === "deep_cleansing_shampoo") {
    const focus =
      meta.reset_focus === "metal_mineral_hard_water"
        ? "Kalk-/Chlor-/Mineral-Reset"
        : meta.reset_focus === "broad_spectrum_detox"
          ? "breiter Styling- und Mineral-Reset"
          : "Produktaufbau-Reset"
    const intensity = meta.reset_intensity
      ? `; Intensität: ${DEEP_CLEANSING_RESET_INTENSITY_LABELS[meta.reset_intensity]}`
      : ""
    return `Reset-Treffer für ${focus}${intensity}.`
  }

  if (meta?.category === "dry_shampoo") {
    return buildDryShampooDisplayableFitReason(meta)
  }

  return meta?.top_reasons?.[0] ?? "Passt von den verfügbaren Optionen am besten."
}

function buildDryShampooDisplayableFitReason(meta: DryShampooRecommendationMetadata): string {
  const details = uniqueNonEmpty([
    meta.primary_effect
      ? `Effekt: ${DRY_SHAMPOO_PRIMARY_EFFECT_LABELS[meta.primary_effect]}`
      : null,
    meta.scalp_sensitivity_fit
      ? `Kopfhaut-Fit: ${DRY_SHAMPOO_SCALP_SENSITIVITY_LABELS[meta.scalp_sensitivity_fit]}`
      : null,
    meta.hair_color_fit
      ? `Farbfit: ${DRY_SHAMPOO_HAIR_COLOR_FIT_LABELS[meta.hair_color_fit]}`
      : null,
    meta.format ? `Format: ${DRY_SHAMPOO_FORMAT_LABELS[meta.format]}` : null,
  ])

  return details.length > 0
    ? `Trockenshampoo-Treffer; ${details.join("; ")}.`
    : "Trockenshampoo-Treffer als Between-Wash-Brücke."
}

function buildShampooDisplayableFitReason(meta: ShampooRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (SHAMPOO_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const thickness = meta.matched_profile.thickness
    ? (SHAMPOO_THICKNESS_FIT_PHRASES[meta.matched_profile.thickness] ??
      `${meta.matched_profile.thickness} Haar`)
    : null
  const scalp = meta.matched_scalp_route
    ? (SHAMPOO_SCALP_ROUTE_FIT_PHRASES[meta.matched_scalp_route] ?? null)
    : meta.matched_bucket
      ? `${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket} Kopfhaut-Fokus`
      : null
  const intensity = meta.cleansing_intensity
    ? (SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity)
    : null
  const fitParts = uniqueNonEmpty([thickness, scalp])
  const fitText = fitParts.length > 0 ? ` für ${fitParts.join(" und ")}` : ""
  const intensityText = intensity ? `; Reinigungsintensität: ${intensity}` : ""

  return `${prefix}${fitText}${intensityText}.`
}

function buildConditionerDisplayableFitReason(meta: ConditionerRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (CONDITIONER_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const balance = meta.product_balance_direction
    ? `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`
    : null
  const weight = meta.product_weight
    ? `Gewicht: ${CONDITIONER_WEIGHT_LABELS[meta.product_weight]}`
    : null
  const repair = meta.product_repair_level
    ? `Pflegeintensität: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`
    : null
  const targetRepair =
    meta.matched_repair_level && meta.active_damage_drivers && meta.active_damage_drivers.length > 0
      ? `abgeleiteter Pflegebedarf: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.matched_repair_level]}`
      : null
  const details = uniqueNonEmpty([balance, weight, repair, targetRepair])

  return details.length > 0 ? `${prefix}; ${details.join("; ")}.` : `${prefix}.`
}

function buildLeaveInDisplayableFitReason(meta: LeaveInRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (LEAVE_IN_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const weight = meta.product_weight
    ? `Gewicht: ${LEAVE_IN_WEIGHT_LABELS[meta.product_weight]}`
    : null
  const balance = meta.product_balance_direction
    ? `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`
    : null
  const heat =
    typeof meta.provides_heat_protection === "boolean"
      ? `Hitzeschutz: ${meta.provides_heat_protection ? "ja" : "nein"}`
      : null
  const role = meta.conditioner_relationship
    ? `Rolle: ${LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[meta.conditioner_relationship]}`
    : null
  const details = uniqueNonEmpty([weight, balance, heat, role])

  return details.length > 0 ? `${prefix}; ${details.join("; ")}.` : `${prefix}.`
}

function buildMaskDisplayableFitReason(meta: MaskRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (MASK_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const balance = meta.product_balance_direction
    ? `Balance: ${MASK_BALANCE_LABELS[meta.product_balance_direction]}`
    : null
  const concentration = meta.product_concentration
    ? `Intensität: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`
    : null
  const weight = meta.product_weight ? `Gewicht: ${MASK_WEIGHT_LABELS[meta.product_weight]}` : null
  const details = uniqueNonEmpty([balance, concentration, weight])

  return details.length > 0 ? `${prefix}; ${details.join("; ")}.` : `${prefix}.`
}

function buildOilDisplayableFitReason(meta: OilRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (OIL_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const purpose = meta.use_mode ? `Öl-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}` : null
  const subtype = meta.matched_subtype
    ? `Subtyp: ${OIL_SUBTYPE_LABELS[meta.matched_subtype]}`
    : null
  const fit =
    meta.purpose_fit === "bridge"
      ? "Fit: angrenzende Finish-Rolle"
      : meta.purpose_fit === "exact"
        ? "Fit: exakt"
        : null
  const details = uniqueNonEmpty([purpose, subtype, fit])

  return details.length > 0 ? `${prefix}; ${details.join("; ")}.` : `${prefix}.`
}

function buildProductComparisonFacts(product: MatchedProduct): string[] {
  const meta = product.recommendation_meta

  if (meta?.category === "shampoo") {
    return buildShampooComparisonFacts(meta)
  }

  if (meta?.category === "conditioner") {
    return buildConditionerComparisonFacts(product, meta)
  }

  if (meta?.category === "leave_in") {
    return buildLeaveInComparisonFacts(product, meta)
  }

  if (meta?.category === "mask") {
    return buildMaskComparisonFacts(product, meta)
  }

  if (meta?.category === "oil") {
    return buildOilComparisonFacts(product, meta)
  }

  if (meta?.category === "bondbuilder") {
    return buildBondbuilderComparisonFacts(product)
  }

  if (meta?.category === "dry_shampoo") {
    return buildDryShampooComparisonFacts(meta)
  }

  return uniqueNonEmpty(meta?.top_reasons ?? []).slice(0, 3)
}

function buildShampooComparisonFacts(meta: ShampooRecommendationMetadata): string[] {
  return uniqueNonEmpty([
    meta.matched_bucket
      ? `Kopfhaut-Fokus: ${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket}`
      : null,
    meta.matched_scalp_route
      ? `Kopfhaut-Route: ${
          SHAMPOO_SCALP_ROUTE_LABELS[meta.matched_scalp_route] ?? meta.matched_scalp_route
        }`
      : null,
    meta.cleansing_intensity
      ? `Reinigungsintensität: ${
          SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity
        }`
      : null,
    meta.fit_status
      ? `Fit: ${SHAMPOO_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
      : null,
  ])
}

function buildConditionerComparisonFacts(
  product: MatchedProduct,
  meta: ConditionerRecommendationMetadata,
): string[] {
  return uniqueNonEmpty([
    meta.product_balance_direction
      ? `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`
      : null,
    meta.product_weight ? `Gewicht: ${CONDITIONER_WEIGHT_LABELS[meta.product_weight]}` : null,
    meta.product_repair_level
      ? `Pflegeintensität: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`
      : null,
    meta.fit_status
      ? `Fit: ${CONDITIONER_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
      : null,
    meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"
      ? "Nachgeordnet: nicht ganz so passend"
      : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 3)
}

function buildLeaveInComparisonFacts(
  product: MatchedProduct,
  meta: LeaveInRecommendationMetadata,
): string[] {
  return uniqueNonEmpty([
    meta.product_weight ? `Gewicht: ${LEAVE_IN_WEIGHT_LABELS[meta.product_weight]}` : null,
    meta.product_balance_direction
      ? `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`
      : null,
    typeof meta.provides_heat_protection === "boolean"
      ? `Hitzeschutz: ${meta.provides_heat_protection ? "ja" : "nein"}`
      : null,
    meta.fit_status
      ? `Fit: ${LEAVE_IN_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
      : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 3)
}

function buildMaskComparisonFacts(
  product: MatchedProduct,
  meta: MaskRecommendationMetadata,
): string[] {
  return uniqueNonEmpty([
    meta.product_balance_direction
      ? `Balance: ${MASK_BALANCE_LABELS[meta.product_balance_direction]}`
      : null,
    meta.product_concentration
      ? `Intensität: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`
      : null,
    meta.product_weight ? `Gewicht: ${MASK_WEIGHT_LABELS[meta.product_weight]}` : null,
    meta.fit_status ? `Fit: ${MASK_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}` : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 3)
}

function buildOilComparisonFacts(
  product: MatchedProduct,
  meta: OilRecommendationMetadata,
): string[] {
  return uniqueNonEmpty([
    meta.use_mode ? `Öl-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}` : null,
    meta.matched_subtype ? `Subtyp: ${OIL_SUBTYPE_LABELS[meta.matched_subtype]}` : null,
    meta.purpose_fit
      ? `Fit: ${meta.purpose_fit === "exact" ? "exakt" : meta.purpose_fit === "bridge" ? "Finish-Bridge" : "Daten unvollständig"}`
      : null,
    meta.density_weight_caution ? "Caveat: sparsam dosieren" : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 2)
}

function buildBondbuilderComparisonFacts(product: MatchedProduct): string[] {
  const meta = product.recommendation_meta as BondbuilderRecommendationMetadata | undefined
  if (meta?.category !== "bondbuilder") return []

  return uniqueNonEmpty([
    meta.bond_repair_axis
      ? `Reparatur-Lane: ${
          PRODUCT_BOND_REPAIR_AXIS_LABELS[meta.bond_repair_axis] ?? meta.bond_repair_axis
        }`
      : null,
    buildBondbuilderLaneRole(meta.bond_repair_axis),
    meta.treatment_mode
      ? `Treatment-Modus: ${
          PRODUCT_BOND_TREATMENT_MODE_LABELS[meta.treatment_mode] ?? meta.treatment_mode
        }`
      : null,
    meta.product_format
      ? `Format: ${PRODUCT_BOND_PRODUCT_FORMAT_LABELS[meta.product_format] ?? meta.product_format}`
      : null,
    meta.usage_protocol
      ? `Protokoll: ${
          PRODUCT_BOND_USAGE_PROTOCOL_LABELS[meta.usage_protocol] ?? meta.usage_protocol
        }`
      : null,
    meta.lifecycle_status && meta.lifecycle_status !== "active"
      ? `Lifecycle: ${meta.lifecycle_status}`
      : null,
    (meta.attached_add_ons?.length ?? 0) > 0
      ? `Add-on: ${meta.attached_add_ons?.map((addOn) => addOn.name).join(", ")}`
      : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 3)
}

function buildDryShampooComparisonFacts(meta: DryShampooRecommendationMetadata): string[] {
  return uniqueNonEmpty([
    meta.primary_effect
      ? `Effekt: ${DRY_SHAMPOO_PRIMARY_EFFECT_LABELS[meta.primary_effect]}`
      : null,
    meta.scalp_sensitivity_fit
      ? `Kopfhaut-Fit: ${DRY_SHAMPOO_SCALP_SENSITIVITY_LABELS[meta.scalp_sensitivity_fit]}`
      : null,
    meta.hair_color_fit
      ? `Farbfit: ${DRY_SHAMPOO_HAIR_COLOR_FIT_LABELS[meta.hair_color_fit]}`
      : null,
    meta.format ? `Format: ${DRY_SHAMPOO_FORMAT_LABELS[meta.format]}` : null,
  ]).slice(0, 3)
}

function buildBondbuilderLaneRole(
  axis: BondbuilderRecommendationMetadata["bond_repair_axis"] | null | undefined,
): string | null {
  if (axis === "disulfide_crosslink") {
    return "Lane-Rolle: OLAPLEX/Epres eher bei Blondierung, Coloration oder chemischem Crosslink-Stress."
  }

  if (axis === "peptide_chain") {
    return "Lane-Rolle: K18 eher bei Bruch, Snapping, Hitze- oder Peptid-/Längsstruktur-Signalen."
  }

  return null
}

function buildClaim(
  field: SupportedProductClaim["field"],
  value: string | null | undefined,
  evidence: ProductClaimEvidence,
  label: string | null | undefined,
): SupportedProductClaim | null {
  if (!value) return null

  return {
    field,
    value,
    evidence,
    label: label ?? value,
  }
}

function buildSupportedProductClaims(product: MatchedProduct): SupportedProductClaim[] {
  const meta = product.recommendation_meta

  if (meta?.category === "conditioner") {
    return buildConditionerSupportedProductClaims(meta)
  }

  if (meta?.category === "leave_in") {
    return buildLeaveInSupportedProductClaims(meta)
  }

  if (meta?.category === "mask") {
    return buildMaskSupportedProductClaims(meta)
  }

  if (meta?.category === "oil") {
    return buildOilSupportedProductClaims(meta)
  }

  if (meta?.category === "deep_cleansing_shampoo") {
    return uniqueClaims([
      buildClaim(
        "reset_focus",
        meta.reset_focus ? DEEP_CLEANSING_RESET_FOCUS_LABELS[meta.reset_focus] : null,
        "product_spec",
        meta.reset_focus
          ? `Reset-Fokus: ${DEEP_CLEANSING_RESET_FOCUS_LABELS[meta.reset_focus]}`
          : null,
      ),
      buildClaim(
        "reset_intensity",
        meta.reset_intensity ? DEEP_CLEANSING_RESET_INTENSITY_LABELS[meta.reset_intensity] : null,
        "product_spec",
        meta.reset_intensity
          ? `Reset-Intensität: ${DEEP_CLEANSING_RESET_INTENSITY_LABELS[meta.reset_intensity]}`
          : null,
      ),
      buildClaim(
        "scalp_route",
        meta.scalp_type_focus ? DEEP_CLEANSING_SCALP_FOCUS_LABELS[meta.scalp_type_focus] : null,
        "product_spec",
        meta.scalp_type_focus
          ? `Kopfhaut-Fokus: ${DEEP_CLEANSING_SCALP_FOCUS_LABELS[meta.scalp_type_focus]}`
          : null,
      ),
      buildClaim(
        "color_treated_suitability",
        meta.color_treated_suitability === "suitable" ? "geeignet für coloriertes Haar" : null,
        "product_spec",
        meta.color_treated_suitability === "suitable"
          ? "Strukturiert als geeignet für coloriertes Haar gepflegt"
          : null,
      ),
      buildClaim(
        "fit_status",
        meta.fit_status ? DEEP_CLEANSING_FIT_STATUS_LABELS[meta.fit_status] : null,
        "category_decision",
        meta.fit_status ? `Fit: ${DEEP_CLEANSING_FIT_STATUS_LABELS[meta.fit_status]}` : null,
      ),
    ])
  }

  if (meta?.category === "dry_shampoo") {
    return uniqueClaims([
      buildClaim(
        "primary_effect",
        meta.primary_effect,
        "product_spec",
        meta.primary_effect
          ? `Effekt: ${DRY_SHAMPOO_PRIMARY_EFFECT_LABELS[meta.primary_effect]}`
          : null,
      ),
      buildClaim(
        "hair_color_fit",
        meta.hair_color_fit,
        "product_spec",
        meta.hair_color_fit
          ? `Farbfit: ${DRY_SHAMPOO_HAIR_COLOR_FIT_LABELS[meta.hair_color_fit]}`
          : null,
      ),
      buildClaim(
        "scalp_sensitivity_fit",
        meta.scalp_sensitivity_fit,
        "product_spec",
        meta.scalp_sensitivity_fit
          ? `Kopfhaut-Fit: ${DRY_SHAMPOO_SCALP_SENSITIVITY_LABELS[meta.scalp_sensitivity_fit]}`
          : null,
      ),
      buildClaim(
        "format",
        meta.format,
        "product_spec",
        meta.format ? `Format: ${DRY_SHAMPOO_FORMAT_LABELS[meta.format]}` : null,
      ),
    ])
  }

  if (meta?.category === "bondbuilder") {
    return uniqueClaims([
      buildClaim(
        "bond_repair_axis",
        meta.bond_repair_axis,
        "product_spec",
        meta.bond_repair_axis
          ? `Reparatur-Lane: ${
              PRODUCT_BOND_REPAIR_AXIS_LABELS[meta.bond_repair_axis] ?? meta.bond_repair_axis
            }`
          : null,
      ),
      buildClaim(
        "treatment_mode",
        meta.treatment_mode,
        "product_spec",
        meta.treatment_mode
          ? `Treatment-Modus: ${
              PRODUCT_BOND_TREATMENT_MODE_LABELS[meta.treatment_mode] ?? meta.treatment_mode
            }`
          : null,
      ),
      buildClaim(
        "usage_hint",
        meta.usage_hint,
        "product_spec",
        meta.usage_hint ? `Anwendung: ${meta.usage_hint}` : null,
      ),
      buildClaim(
        "lifecycle_status",
        meta.lifecycle_status && meta.lifecycle_status !== "active" ? meta.lifecycle_status : null,
        "product_spec",
        meta.lifecycle_status && meta.lifecycle_status !== "active"
          ? `Lifecycle: ${meta.lifecycle_status}`
          : null,
      ),
    ])
  }

  if (meta?.category !== "shampoo") {
    return []
  }

  return uniqueClaims([
    buildClaim(
      "thickness",
      meta.matched_profile.thickness,
      "product_spec",
      meta.matched_profile.thickness
        ? `Haardicke: ${
            HAIR_THICKNESS_LABELS[meta.matched_profile.thickness] ?? meta.matched_profile.thickness
          }`
        : null,
    ),
    buildClaim(
      "scalp_route",
      meta.matched_scalp_route,
      "product_spec",
      meta.matched_scalp_route
        ? `Kopfhaut-Route: ${
            SHAMPOO_SCALP_ROUTE_LABELS[meta.matched_scalp_route] ?? meta.matched_scalp_route
          }`
        : null,
    ),
    buildClaim(
      "shampoo_bucket",
      meta.matched_bucket,
      "product_spec",
      meta.matched_bucket
        ? `Kopfhaut-Fokus: ${SHAMPOO_BUCKET_LABELS[meta.matched_bucket] ?? meta.matched_bucket}`
        : null,
    ),
    buildClaim(
      "cleansing_intensity",
      meta.cleansing_intensity,
      "product_spec",
      meta.cleansing_intensity
        ? `Reinigungsintensität: ${
            SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity
          }`
        : null,
    ),
    buildClaim(
      "fit_status",
      meta.fit_status,
      "category_decision",
      meta.fit_status
        ? `Fit: ${SHAMPOO_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
        : null,
    ),
  ])
}

function buildConditionerSupportedProductClaims(
  meta: ConditionerRecommendationMetadata,
): SupportedProductClaim[] {
  return uniqueClaims([
    buildClaim(
      "weight",
      meta.product_weight,
      "product_spec",
      meta.product_weight ? `Gewicht: ${CONDITIONER_WEIGHT_LABELS[meta.product_weight]}` : null,
    ),
    buildClaim(
      "balance_direction",
      meta.product_balance_direction,
      "product_spec",
      meta.product_balance_direction
        ? `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`
        : null,
    ),
    buildClaim(
      "repair_level",
      meta.product_repair_level,
      "product_spec",
      meta.product_repair_level
        ? `Pflegeintensität: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`
        : null,
    ),
    buildClaim(
      "fit_status",
      meta.fit_status,
      "category_decision",
      meta.fit_status
        ? `Fit: ${CONDITIONER_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
        : null,
    ),
  ])
}

function buildLeaveInSupportedProductClaims(
  meta: LeaveInRecommendationMetadata,
): SupportedProductClaim[] {
  const primaryRole = meta.product_roles?.[0] ?? null
  const primaryBenefit = meta.product_care_benefits?.[0] ?? null

  return uniqueClaims([
    buildClaim(
      "format",
      meta.product_format,
      "product_spec",
      meta.product_format ? `Format: ${LEAVE_IN_FORMAT_LABELS[meta.product_format]}` : null,
    ),
    buildClaim(
      "weight",
      meta.product_weight,
      "product_spec",
      meta.product_weight ? `Gewicht: ${LEAVE_IN_WEIGHT_LABELS[meta.product_weight]}` : null,
    ),
    buildClaim(
      "balance_direction",
      meta.product_balance_direction,
      "product_spec",
      meta.product_balance_direction
        ? `Balance: ${CONDITIONER_BALANCE_LABELS[meta.product_balance_direction]}`
        : null,
    ),
    buildClaim(
      "fit_status",
      meta.fit_status,
      "category_decision",
      meta.fit_status
        ? `Fit: ${LEAVE_IN_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
        : null,
    ),
    buildClaim(
      "heat_protection",
      typeof meta.provides_heat_protection === "boolean"
        ? String(meta.provides_heat_protection)
        : null,
      "product_spec",
      typeof meta.provides_heat_protection === "boolean"
        ? `Hitzeschutz: ${meta.provides_heat_protection ? "ja" : "nein"}`
        : null,
    ),
    buildClaim(
      "conditioner_relationship",
      meta.conditioner_relationship,
      "product_spec",
      meta.conditioner_relationship
        ? `Rolle: ${LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[meta.conditioner_relationship]}`
        : null,
    ),
    buildClaim(
      "leave_in_role",
      primaryRole,
      "product_spec",
      primaryRole ? `Leave-in-Rolle: ${LEAVE_IN_ROLE_LABELS[primaryRole]}` : null,
    ),
    buildClaim(
      "care_benefit",
      primaryBenefit,
      "product_spec",
      primaryBenefit
        ? `Pflegefokus: ${LEAVE_IN_CARE_BENEFIT_LABELS[primaryBenefit] ?? primaryBenefit}`
        : null,
    ),
  ])
}

function buildMaskSupportedProductClaims(
  meta: MaskRecommendationMetadata,
): SupportedProductClaim[] {
  return uniqueClaims([
    buildClaim(
      "weight",
      meta.product_weight,
      "product_spec",
      meta.product_weight ? `Gewicht: ${MASK_WEIGHT_LABELS[meta.product_weight]}` : null,
    ),
    buildClaim(
      "balance_direction",
      meta.product_balance_direction,
      "product_spec",
      meta.product_balance_direction
        ? `Balance: ${MASK_BALANCE_LABELS[meta.product_balance_direction]}`
        : null,
    ),
    buildClaim(
      "concentration",
      meta.product_concentration,
      "product_spec",
      meta.product_concentration
        ? `Intensität: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`
        : null,
    ),
    buildClaim(
      "fit_status",
      meta.fit_status,
      "category_decision",
      meta.fit_status ? `Fit: ${MASK_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}` : null,
    ),
  ])
}

function buildOilSupportedProductClaims(meta: OilRecommendationMetadata): SupportedProductClaim[] {
  return uniqueClaims([
    buildClaim(
      "oil_purpose",
      meta.use_mode,
      "product_spec",
      meta.use_mode ? `Öl-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}` : null,
    ),
    buildClaim(
      "oil_subtype",
      meta.matched_subtype,
      "product_spec",
      meta.matched_subtype ? `Subtyp: ${OIL_SUBTYPE_LABELS[meta.matched_subtype]}` : null,
    ),
    buildClaim(
      "fit_status",
      meta.fit_status,
      "category_decision",
      meta.fit_status
        ? `Fit: ${OIL_FIT_STATUS_PREFIXES[meta.fit_status] ?? meta.fit_status}`
        : null,
    ),
  ])
}

function uniqueClaims(claims: Array<SupportedProductClaim | null>): SupportedProductClaim[] {
  const seen = new Set<string>()
  const result: SupportedProductClaim[] = []

  for (const claim of claims) {
    if (!claim) continue
    const key = `${claim.field}:${claim.value}:${claim.evidence}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(claim)
  }

  return result
}

function signalHasSupportedClaim(
  signal: AgentActiveProfileSignal,
  claims: readonly SupportedProductClaim[],
): boolean {
  if (signal.field === "thickness") {
    return claims.some((claim) => claim.field === "thickness" && claim.value === signal.value)
  }

  if (signal.field === "scalp_type") {
    return claims.some(
      (claim) =>
        claim.field === "scalp_route" &&
        ((signal.value === "balanced" && claim.value === "balanced") ||
          (signal.value === "oily" && claim.value === "oily") ||
          (signal.value === "dry" && claim.value === "dry")),
    )
  }

  if (signal.field === "scalp_condition" && signal.value === "irritated") {
    return claims.some(
      (claim) =>
        (claim.field === "scalp_route" && claim.value === "irritated") ||
        (claim.field === "shampoo_bucket" && claim.value === "irritationen"),
    )
  }

  if (signal.field === "scalp_condition" && signal.value === "dandruff") {
    return claims.some(
      (claim) =>
        (claim.field === "scalp_route" && claim.value === "dandruff") ||
        (claim.field === "shampoo_bucket" && claim.value === "schuppen"),
    )
  }

  return false
}

function userMessageForUnsupportedSignal(signal: AgentActiveProfileSignal): string {
  if (signal.field === "chemical_treatment" && signal.value === "colored") {
    return "Zum Farbschutz habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den sicheren Produktangaben."
  }

  if (signal.field === "chemical_treatment" && signal.value === "bleached") {
    return "Zu blondiertem Haar habe ich bei diesen Produkten aktuell keine sichere Spezialangabe. Ich bewerte sie deshalb nach den sicheren Produktangaben."
  }

  if (signal.field === "scalp_condition" && signal.value === "irritated") {
    return "Zur empfindlichen Kopfhaut habe ich bei diesen Produkten keine sichere Spezialangabe. Ich bewerte sie deshalb vor allem nach Kopfhaut-Fokus, Haardicke und Reinigungsintensität."
  }

  return "Zu einem Teil deiner Anfrage habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den sicheren Produktangaben."
}

function buildUnsupportedIngredientSignals(
  signals: readonly RequestedIngredientSignal[],
  category: "shampoo" | "conditioner" | "leave_in" | "mask" | "oil" = "conditioner",
): UnsupportedRequestedSignal[] {
  return uniqueUnsupportedSignals(
    signals.map((signal) => ({
      field: "ingredient_preference",
      value: signal.value,
      reason: "no_structured_product_data",
      user_message:
        category === "oil"
          ? "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Öl-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Öl-Zweck, Haardicke, Anwendung und Fit."
          : category === "shampoo"
            ? "Wünsche wie silikonfrei, kokosfrei oder proteinfrei sind in dieser Shampoo-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Kopfhaut-Fokus, Haardicke, Reinigungsintensität und Profil-Fit."
            : category === "leave_in"
              ? "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Leave-in-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Rolle, Hitzeschutz, Pflegefokus und Fit."
              : category === "mask"
                ? "Wünsche wie silikonfrei, kokosfrei, proteinfrei oder ölfrei sind in dieser Masken-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Intensität und Fit."
                : "Wünsche wie silikonfrei, kokosfrei oder proteinfrei sind in dieser Conditioner-Auswahl noch nicht sicher geprüft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Pflegeintensität und Fit.",
    })),
  )
}

function buildUnsupportedHeatTemperatureSignals(
  signals: readonly RequestedHeatTemperatureSignal[],
): UnsupportedRequestedSignal[] {
  return uniqueUnsupportedSignals(
    signals.map((signal) => ({
      field: "heat_temperature",
      value: signal.value,
      reason: "no_structured_product_data",
      user_message: `Exakte Hitzeschutz-Temperaturen wie ${signal.value} Grad sind in dieser Leave-in-Auswahl nicht sicher operationalisiert. Ich bewerte die Optionen deshalb nur danach, ob Hitzeschutz strukturiert erfasst ist.`,
    })),
  )
}

function buildUnsupportedRequestedSignals(
  activeSignals: readonly AgentActiveProfileSignal[],
  supportedClaims: readonly SupportedProductClaim[],
): UnsupportedRequestedSignal[] {
  const unsupported: UnsupportedRequestedSignal[] = []

  for (const signal of activeSignals) {
    if (signal.selection_effect !== "qualifier") continue
    if (signalHasSupportedClaim(signal, supportedClaims)) continue

    unsupported.push({
      field: signal.field,
      value: signal.value,
      reason: "no_structured_product_data",
      user_message: userMessageForUnsupportedSignal(signal),
    })
  }

  return uniqueUnsupportedSignals(unsupported)
}

function uniqueUnsupportedSignals(
  signals: readonly UnsupportedRequestedSignal[],
): UnsupportedRequestedSignal[] {
  const seen = new Set<string>()
  const result: UnsupportedRequestedSignal[] = []

  for (const signal of signals) {
    const key = `${signal.field}:${signal.value}:${signal.reason}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(signal)
  }

  return result
}

function buildShampooMissingInfo(
  field: ReturnType<typeof getShampooMissingProfileFields>[number],
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Shampoo-Auswahl nicht sinnvoll eingegrenzt werden.",
      }
    case "scalp_type":
      return {
        key: field,
        label: "Kopfhaut-Typ",
        blocking: true,
        detail: "Es fehlt noch dein Kopfhaut-Typ für die Shampoo-Auswahl.",
      }
    case "scalp_condition":
      return {
        key: field,
        label: "Kopfhaut-Beschwerden",
        blocking: true,
        detail: "Es fehlen noch aktuelle Kopfhaut-Beschwerden für die Shampoo-Auswahl.",
      }
  }
}

function buildConditionerMissingInfo(
  field: "thickness" | "protein_moisture_balance",
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Conditioner-Auswahl nicht sinnvoll eingegrenzt werden.",
      }
    case "protein_moisture_balance":
      return {
        key: field,
        label: "Protein-/Feuchtigkeitsbalance",
        blocking: true,
        detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance für die Conditioner-Auswahl.",
      }
  }
}

function buildMaskMissingInfo(
  field: "thickness" | "protein_moisture_balance",
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Masken-Auswahl nicht sinnvoll eingegrenzt werden.",
      }
    case "protein_moisture_balance":
      return {
        key: field,
        label: "Protein-/Feuchtigkeitsbalance",
        blocking: true,
        detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance für die Masken-Auswahl.",
      }
  }
}

function buildLeaveInMissingInfo(
  field: ReturnType<typeof getLeaveInMissingProfileFields>[number],
): SelectedProductsMissingInfo {
  switch (field) {
    case "hair_texture":
      return {
        key: field,
        label: "Haarmuster",
        blocking: true,
        detail: "Es fehlt noch dein Haarmuster für die Leave-in-Auswahl.",
      }
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Es fehlt noch deine Haardicke für die Leave-in-Auswahl.",
      }
    case "density":
      return {
        key: field,
        label: "Haardichte",
        blocking: true,
        detail: "Es fehlt noch deine Haardichte für die Leave-in-Auswahl.",
      }
    case "care_signal":
      return {
        key: field,
        label: "Pflegebedarf",
        blocking: false,
        detail: "Es fehlt noch dein Pflegebedarf für die Leave-in-Auswahl.",
      }
    case "styling_signal":
      return {
        key: field,
        label: "Styling-Kontext",
        blocking: false,
        detail: "Es fehlt noch dein Styling-Kontext für die Leave-in-Auswahl.",
      }
  }
}

function buildOilMissingInfo(
  field: ReturnType<typeof getOilMissingProfileFields>[number],
): SelectedProductsMissingInfo {
  switch (field) {
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Es fehlt noch deine Haardicke für die Öl-Auswahl.",
      }
    case "oil_purpose":
      return {
        key: field,
        label: "Öl-Zweck",
        blocking: true,
        detail: "Es fehlt noch dein Öl-Zweck für die Öl-Auswahl.",
      }
  }
}

function deriveGenericMissingInfo(hairProfile: HairProfile | null): SelectedProductsMissingInfo[] {
  if (!hairProfile?.thickness) {
    return [
      {
        key: "thickness",
        label: "Haardicke",
        blocking: true,
        detail: "Ohne Haardicke kann die Auswahl nicht sinnvoll eingegrenzt werden.",
      },
    ]
  }

  return []
}

function deriveConditionerMissingProfileFields(
  hairProfile: HairProfile | null,
): Array<"thickness" | "protein_moisture_balance"> {
  const missing: Array<"thickness" | "protein_moisture_balance"> = []

  if (!hairProfile?.thickness) {
    missing.push("thickness")
  }

  if (!hairProfile?.protein_moisture_balance) {
    missing.push("protein_moisture_balance")
  }

  return missing
}

function deriveMissingInfoForEmptySelection(params: {
  category: SelectableProductCategory | null
  explicitCategoryProvided: boolean
  hairProfile: HairProfile | null
  runtime: RecommendationEngineRuntime | null
}): SelectedProductsMissingInfo[] {
  const { category, explicitCategoryProvided, hairProfile, runtime } = params

  switch (category) {
    case "shampoo":
      return getShampooMissingProfileFields(hairProfile).map(buildShampooMissingInfo)
    case "conditioner":
      return deriveConditionerMissingProfileFields(hairProfile).map(buildConditionerMissingInfo)
    case "leave_in":
      if (!runtime) {
        return deriveGenericMissingInfo(hairProfile)
      }

      return getLeaveInMissingProfileFields({ runtime, hairProfile }).map(buildLeaveInMissingInfo)
    case "mask":
      return deriveConditionerMissingProfileFields(hairProfile).map(buildMaskMissingInfo)
    case "oil":
      if (!runtime) {
        return deriveGenericMissingInfo(hairProfile)
      }

      if (runtime.categories.oil.noRecommendationReason) {
        return []
      }

      return getOilMissingProfileFields({ runtime, hairProfile }).map(buildOilMissingInfo)
    default:
      return explicitCategoryProvided ? [] : deriveGenericMissingInfo(hairProfile)
  }
}

function isOilNoRecommendationDecision(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): boolean {
  return (
    category === "oil" &&
    categoryDecision?.category === "oil" &&
    Boolean(categoryDecision.noRecommendationReason)
  )
}

function isDeepCleansingScalpTreatmentDecision(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): boolean {
  return (
    category === "deep_cleansing_shampoo" &&
    categoryDecision?.category === "deep_cleansing_shampoo" &&
    categoryDecision.notes.includes("scalp_treatment_needed")
  )
}

const DRY_SHAMPOO_CAUTION_WITHOUT_PRODUCTS_REASONS = new Set([
  "dry_shampoo_scalp_issue_hard_no",
  "dry_shampoo_dry_breakage_hard_no",
  "dry_shampoo_respiratory_aerosol_caution",
  "dry_shampoo_child_context_hard_no",
])

const DRY_SHAMPOO_REDIRECT_REASONS = new Set([
  "dry_shampoo_buildup_hard_no",
  "dry_shampoo_frequent_use_reset_needed",
])

function dryShampooDecisionNotes(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): string[] {
  if (category !== "dry_shampoo" || categoryDecision?.category !== "dry_shampoo") return []

  return [...categoryDecision.notes, ...(categoryDecision.targetProfile?.cautionReasonCodes ?? [])]
}

function isDryShampooResetRedirectDecision(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): boolean {
  return dryShampooDecisionNotes(category, categoryDecision).some((reason) =>
    DRY_SHAMPOO_REDIRECT_REASONS.has(reason),
  )
}

function isDryShampooCautionDecision(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): boolean {
  return dryShampooDecisionNotes(category, categoryDecision).some((reason) =>
    DRY_SHAMPOO_CAUTION_WITHOUT_PRODUCTS_REASONS.has(reason),
  )
}

function isDryShampooNotRecommendedDecision(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): boolean {
  return (
    category === "dry_shampoo" &&
    categoryDecision?.category === "dry_shampoo" &&
    !categoryDecision.relevant
  )
}

function isOptionalBondbuilderDecision(
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null,
): boolean {
  return (
    category === "bondbuilder" &&
    categoryDecision?.category === "bondbuilder" &&
    categoryDecision.targetProfile?.role === "optional"
  )
}

function getCategoryDecision(
  runtime: RecommendationEngineRuntime | null,
  category: SelectableProductCategory | null,
): CategoryDecision | null {
  if (!runtime || !category) return null

  switch (category) {
    case "shampoo":
      return runtime.categories.shampoo
    case "conditioner":
      return runtime.categories.conditioner
    case "leave_in":
      return runtime.categories.leaveIn
    case "mask":
      return runtime.categories.mask
    case "oil":
      return runtime.categories.oil
    case "bondbuilder":
      return runtime.categories.bondbuilder
    case "deep_cleansing_shampoo":
      return runtime.categories.deepCleansingShampoo
    case "dry_shampoo":
      return runtime.categories.dryShampoo
    case "peeling":
      return runtime.categories.peeling
  }
}

function buildProfileBasis(
  hairProfile: HairProfile | null,
  category: SelectableProductCategory | null,
  categoryDecision: CategoryDecision | null = null,
  routeContext: SelectProductsRouteContext | null = null,
): string[] {
  if (!hairProfile) return []

  if (category === "shampoo") {
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.scalp_type
        ? `Kopfhaut: ${SCALP_TYPE_LABELS[hairProfile.scalp_type] ?? hairProfile.scalp_type}`
        : null,
      hairProfile.scalp_condition
        ? `Kopfhaut-Beschwerden: ${
            SCALP_CONDITION_LABELS[hairProfile.scalp_condition] ?? hairProfile.scalp_condition
          }`
        : null,
    ])
  }

  if (category === "conditioner") {
    const conditionerDecision =
      categoryDecision?.category === "conditioner" ? categoryDecision : null
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.density
        ? `Haardichte: ${HAIR_DENSITY_LABELS[hairProfile.density] ?? hairProfile.density}`
        : null,
      hairProfile.protein_moisture_balance
        ? `Protein-/Feuchtigkeitsbalance: ${
            PROTEIN_MOISTURE_LABELS[hairProfile.protein_moisture_balance] ??
            hairProfile.protein_moisture_balance
          }`
        : null,
      conditionerDecision?.targetProfile?.weight
        ? `Ziel-Gewicht: ${CONDITIONER_WEIGHT_LABELS[conditionerDecision.targetProfile.weight]}`
        : null,
      conditionerDecision?.targetProfile?.repairLevel
        ? `Pflegebedarf: ${
            CONDITIONER_REPAIR_LEVEL_LABELS[conditionerDecision.targetProfile.repairLevel]
          }`
        : null,
      ...(conditionerDecision?.targetProfile?.activeDamageDrivers ?? []).map(
        (driver) => `Damage-Kontext: ${driver}`,
      ),
    ])
  }

  if (category === "leave_in") {
    const leaveInDecision = categoryDecision?.category === "leave_in" ? categoryDecision : null
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.hair_texture
        ? `Haarmuster: ${HAIR_TEXTURE_LABELS[hairProfile.hair_texture] ?? hairProfile.hair_texture}`
        : null,
      hairProfile.density
        ? `Haardichte: ${HAIR_DENSITY_LABELS[hairProfile.density] ?? hairProfile.density}`
        : null,
      leaveInDecision?.targetProfile?.heatProtectionNeed &&
      leaveInDecision.targetProfile.heatProtectionNeed !== "none"
        ? `Hitzeschutz-Bedarf: ${
            leaveInDecision.targetProfile.heatProtectionNeed === "high" ? "Hoch" : "Moderat"
          }`
        : null,
      leaveInDecision?.targetProfile?.hasSeparateHeatProtectant &&
      leaveInDecision.targetProfile.heatProtectionNeed === "moderate"
        ? "Separater Hitzeschutz vorhanden: Leave-in-Hitzeschutz ist Bonus, kein Muss."
        : null,
      leaveInDecision?.targetProfile?.conditionerRelationship
        ? `Leave-in-Rolle im Profil: ${
            LEAVE_IN_CONDITIONER_RELATIONSHIP_LABELS[
              leaveInDecision.targetProfile.conditionerRelationship
            ]
          }`
        : null,
    ])
  }

  if (category === "mask") {
    const maskDecision = categoryDecision?.category === "mask" ? categoryDecision : null
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.density
        ? `Haardichte: ${HAIR_DENSITY_LABELS[hairProfile.density] ?? hairProfile.density}`
        : null,
      hairProfile.protein_moisture_balance
        ? `Protein-/Feuchtigkeitsbalance: ${
            PROTEIN_MOISTURE_LABELS[hairProfile.protein_moisture_balance] ??
            hairProfile.protein_moisture_balance
          }`
        : null,
      maskDecision?.targetProfile?.weight
        ? `Ziel-Gewicht: ${MASK_WEIGHT_LABELS[maskDecision.targetProfile.weight]}`
        : null,
      maskDecision?.targetProfile?.balance
        ? `Ziel-Balance: ${MASK_BALANCE_LABELS[maskDecision.targetProfile.balance]}`
        : null,
      maskDecision?.targetProfile?.repairLevel
        ? `Masken-Intensität: ${
            CONDITIONER_REPAIR_LEVEL_LABELS[maskDecision.targetProfile.repairLevel]
          }`
        : null,
      maskDecision?.targetProfile?.role
        ? `Masken-Rolle: ${maskDecision.targetProfile.role === "optional" ? "Optional" : "Zusatzpflege"}`
        : null,
    ])
  }

  if (category === "oil") {
    const oilDecision = categoryDecision?.category === "oil" ? categoryDecision : null
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.density
        ? `Haardichte: ${HAIR_DENSITY_LABELS[hairProfile.density] ?? hairProfile.density}`
        : null,
      oilDecision?.targetProfile?.purpose
        ? `Öl-Zweck: ${OIL_PURPOSE_LABELS[oilDecision.targetProfile.purpose]}`
        : null,
      oilDecision?.targetProfile?.densityWeightCaution
        ? "Gewichts-Caveat: sehr sparsam dosieren."
        : null,
    ])
  }

  if (category === "bondbuilder") {
    const bondbuilderDecision =
      categoryDecision?.category === "bondbuilder" ? categoryDecision : null
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.chemical_treatment?.length
        ? `Chemischer Kontext: ${hairProfile.chemical_treatment.join(", ")}`
        : null,
      bondbuilderDecision?.targetProfile?.role === "optional"
        ? "Bondbuilder-Check: Optional, kein Pflichtschritt"
        : bondbuilderDecision?.relevant
          ? "Bondbuilder-Check: Empfohlener Strukturpflege-Schritt"
          : "Bondbuilder-Check: Gerade nicht notwendig",
      bondbuilderDecision?.targetProfile?.bondRepairIntensity
        ? `Bondbuilder-Intensität: ${
            bondbuilderDecision.targetProfile.bondRepairIntensity === "intensive"
              ? "Intensiv"
              : "Erhaltung"
          }`
        : null,
      bondbuilderDecision?.targetProfile?.chemicalCrosslinkLane
        ? "Bondbuilder-Lane: Disulfid-/Crosslink"
        : null,
      bondbuilderDecision?.targetProfile?.peptideChainLane
        ? "Bondbuilder-Lane: Peptid-/Längsstruktur"
        : null,
      bondbuilderDecision?.targetProfile &&
      !bondbuilderDecision.targetProfile.chemicalCrosslinkLane &&
      !bondbuilderDecision.targetProfile.peptideChainLane
        ? "Bondbuilder-Lane: kein klarer K18-vs-OLAPLEX-Treiber"
        : null,
    ])
  }

  if (category === "dry_shampoo") {
    const dryShampooDecision =
      categoryDecision?.category === "dry_shampoo" ? categoryDecision : null
    return uniqueNonEmpty([
      ...buildProfileDeviationNotices({
        originalHairProfile: routeContext?.originalHairProfile ?? null,
        effectiveHairProfile: hairProfile,
        activeSignals: routeContext?.activeProfileSignals ?? [],
      }),
      hairProfile.thickness
        ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
        : null,
      hairProfile.scalp_type
        ? `Kopfhaut: ${SCALP_TYPE_LABELS[hairProfile.scalp_type] ?? hairProfile.scalp_type}`
        : null,
      dryShampooDecision?.targetProfile?.primaryEffectTarget
        ? `Trockenshampoo-Fokus: ${
            DRY_SHAMPOO_PRIMARY_EFFECT_LABELS[dryShampooDecision.targetProfile.primaryEffectTarget]
          }`
        : null,
      dryShampooDecision?.targetProfile?.hairColorFitTarget
        ? `Farbfit: ${
            DRY_SHAMPOO_HAIR_COLOR_FIT_LABELS[dryShampooDecision.targetProfile.hairColorFitTarget]
          }`
        : null,
    ])
  }

  return uniqueNonEmpty([
    hairProfile.thickness
      ? `Haardicke: ${HAIR_THICKNESS_LABELS[hairProfile.thickness] ?? hairProfile.thickness}`
      : null,
  ])
}

function buildProfileDeviationNotices(params: {
  originalHairProfile: HairProfile | null
  effectiveHairProfile: HairProfile | null
  activeSignals: readonly AgentActiveProfileSignal[]
}): string[] {
  const { originalHairProfile, effectiveHairProfile, activeSignals } = params
  if (!originalHairProfile || !effectiveHairProfile) return []

  const notices: string[] = []

  for (const signal of activeSignals) {
    if (signal.selection_effect !== "override") continue

    if (signal.field === "thickness") {
      const original = originalHairProfile.thickness
      const effective = effectiveHairProfile.thickness
      if (!original || !effective || original === effective) continue

      notices.push(
        buildProfileDeviationNotice({
          label: "Haardicke",
          current: HAIR_THICKNESS_LABELS[effective] ?? effective,
          stored: HAIR_THICKNESS_LABELS[original] ?? original,
        }),
      )
    }

    if (signal.field === "hair_texture") {
      const original = originalHairProfile.hair_texture
      const effective = effectiveHairProfile.hair_texture
      if (!original || !effective || original === effective) continue

      notices.push(
        buildProfileDeviationNotice({
          label: "Haarmuster",
          current: HAIR_TEXTURE_LABELS[effective] ?? effective,
          stored: HAIR_TEXTURE_LABELS[original] ?? original,
        }),
      )
    }

    if (signal.field === "density") {
      const original = originalHairProfile.density
      const effective = effectiveHairProfile.density
      if (!original || !effective || original === effective) continue

      notices.push(
        buildProfileDeviationNotice({
          label: "Haardichte",
          current: HAIR_DENSITY_LABELS[effective] ?? effective,
          stored: HAIR_DENSITY_LABELS[original] ?? original,
        }),
      )
    }

    if (signal.field === "scalp_type") {
      const original = originalHairProfile.scalp_type
      const effective = effectiveHairProfile.scalp_type
      if (!original || !effective || original === effective) continue

      notices.push(
        buildProfileDeviationNotice({
          label: "Kopfhaut",
          current: SCALP_TYPE_LABELS[effective] ?? effective,
          stored: SCALP_TYPE_LABELS[original] ?? original,
        }),
      )
    }

    if (signal.field === "scalp_condition") {
      const original = originalHairProfile.scalp_condition
      const effective = effectiveHairProfile.scalp_condition
      if (!original || !effective || original === effective) continue

      notices.push(
        buildProfileDeviationNotice({
          label: "Kopfhaut-Beschwerden",
          current: SCALP_CONDITION_LABELS[effective] ?? effective,
          stored: SCALP_CONDITION_LABELS[original] ?? original,
        }),
      )
    }
  }

  return notices
}

function buildProfileDeviationNotice(params: {
  label: string
  current: string
  stored: string
}): string {
  return `Profil-Hinweis: aktuelle Angabe ${params.label} ${params.current} statt gespeichert ${params.stored}`
}

function deriveDecision(params: {
  products: MatchedProduct[]
  category: SelectableProductCategory | null
  categoryDecision: CategoryDecision | null
  missingInfo: SelectedProductsMissingInfo[]
  routeContext?: SelectProductsRouteContext | null
}): SelectProductsDecision {
  const { products, category, categoryDecision, missingInfo, routeContext } = params
  const hasBlockingMissingInfo = missingInfo.some((item) => item.blocking)

  if (isScalpSymptomShampooQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (
    isSafeWeakLeverShampooQuestion(category, routeContext) &&
    !isExplicitProductSelectionJob(routeContext)
  ) {
    return "not_recommended"
  }

  if (isScalpOnlyConditionerQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (isScalpOnlyMaskQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (
    isOilNoRecommendationDecision(category, categoryDecision) &&
    !(
      products.length > 0 &&
      allowsCaveatedOilProductRecommendation({ category, categoryDecision, routeContext })
    )
  ) {
    return "not_recommended"
  }

  if (isDeepCleansingScalpTreatmentDecision(category, categoryDecision)) {
    return "not_recommended"
  }

  if (isDryShampooNotRecommendedDecision(category, categoryDecision)) {
    return "not_recommended"
  }

  if (
    category === "shampoo" &&
    categoryDecision &&
    !categoryDecision.relevant &&
    !(routeContext?.userJob === "product_pick" && hasBlockingMissingInfo)
  ) {
    return "not_recommended"
  }

  if (hasBlockingMissingInfo) {
    return "needs_more_info"
  }

  if (products.length === 0) {
    return "no_catalog_match"
  }

  return "recommended"
}

function hasConcern(
  routeContext: SelectProductsRouteContext | null | undefined,
  concern: AgentConcern,
): boolean {
  return routeContext?.concerns?.includes(concern) ?? false
}

function isDryLengthOnlyShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  if (category !== "shampoo" || !hasConcern(routeContext, "dry_lengths")) {
    return false
  }

  return !(
    hasConcern(routeContext, "oily_roots") ||
    hasConcern(routeContext, "dandruff_or_flakes") ||
    hasConcern(routeContext, "irritation")
  )
}

function isShineShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  return category === "shampoo" && routeContext?.requestedGoal === "shine"
}

function isFrizzShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  if (category !== "shampoo" || !hasConcern(routeContext, "frizz")) {
    return false
  }

  return !(
    hasConcern(routeContext, "oily_roots") ||
    hasConcern(routeContext, "dandruff_or_flakes") ||
    hasConcern(routeContext, "irritation")
  )
}

function isExplicitProductSelectionJob(routeContext?: SelectProductsRouteContext | null): boolean {
  if (routeContext?.userJob === "product_pick") {
    return true
  }

  return hasExplicitProductAskSignal(routeContext?.message ?? "")
}

function hasExplicitProductAskSignal(message: string): boolean {
  const normalized = normalizeRouteMessage(message)

  return /\b(welch(?:e|es|en|er|em)?|empfehl\w*|kaufen|produkt|produkte|pick|auswahl|option|optionen|a oder b|besser|nimm|nehmen)\b/.test(
    normalized,
  )
}

function allowsCaveatedOilProductRecommendation(params: {
  category: SelectableProductCategory | null
  categoryDecision: CategoryDecision | null
  routeContext?: SelectProductsRouteContext | null
}): boolean {
  const { category, categoryDecision, routeContext } = params

  return (
    category === "oil" &&
    categoryDecision?.category === "oil" &&
    categoryDecision.noRecommendationReason === "overload_risk" &&
    categoryDecision.targetProfile !== null &&
    isExplicitProductSelectionJob(routeContext)
  )
}

function normalizeRouteMessage(message: string): string {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function isSafeWeakLeverShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext?: SelectProductsRouteContext | null,
): boolean {
  return (
    category === "shampoo" &&
    !isScalpSymptomShampooQuestion(category, routeContext) &&
    (isDryLengthOnlyShampooQuestion(category, routeContext) ||
      isShineShampooQuestion(category, routeContext) ||
      isFrizzShampooQuestion(category, routeContext))
  )
}

function isScalpSymptomShampooQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  return (
    category === "shampoo" &&
    (hasConcern(routeContext, "dandruff_or_flakes") || hasConcern(routeContext, "irritation"))
  )
}

function isScalpOnlyConditionerQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  if (category !== "conditioner") return false

  const hasScalpConcern =
    hasConcern(routeContext, "oily_roots") ||
    hasConcern(routeContext, "dandruff_or_flakes") ||
    hasConcern(routeContext, "irritation")
  if (!hasScalpConcern) return false

  return !(
    hasConcern(routeContext, "dry_lengths") ||
    hasConcern(routeContext, "frizz") ||
    routeContext?.requestedGoal === "shine"
  )
}

function isScalpOnlyMaskQuestion(
  category: SelectableProductCategory | null,
  routeContext: SelectProductsRouteContext | null | undefined,
): boolean {
  if (category !== "mask") return false

  const hasScalpConcern =
    hasConcern(routeContext, "oily_roots") ||
    hasConcern(routeContext, "dandruff_or_flakes") ||
    hasConcern(routeContext, "irritation")
  if (!hasScalpConcern) return false

  return !(
    hasConcern(routeContext, "dry_lengths") ||
    hasConcern(routeContext, "frizz") ||
    routeContext?.requestedGoal === "shine"
  )
}

function buildProductResponsePolicy(params: {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  categoryDecision: CategoryDecision | null
  routeContext?: SelectProductsRouteContext | null
}): { product_response_policy: ProductResponsePolicy; policy_reason: string } {
  const { category, decision, categoryDecision, routeContext } = params

  if (decision === "needs_more_info") {
    return {
      product_response_policy: "needs_more_info",
      policy_reason: "Für diese Produktauswahl fehlt noch eine entscheidende Profilinformation.",
    }
  }

  if (decision === "no_catalog_match") {
    return {
      product_response_policy: "no_catalog_match",
      policy_reason:
        "Die Kategorie kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer.",
    }
  }

  if (isDryShampooResetRedirectDecision(category, categoryDecision)) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Trockenshampoo-Nutzung oder Build-up spricht für Reduktion, Auswaschen und Reset-/Tiefenreinigungslogik statt für weiteres Trockenshampoo.",
    }
  }

  if (isDryShampooCautionDecision(category, categoryDecision)) {
    return {
      product_response_policy: "caution_without_products",
      policy_reason:
        "Diese Trockenshampoo-Anfrage enthält Kopfhaut-, Haarbruch-, Aerosol-/Atemwegs- oder Kind-Kontext; deshalb keine Trockenshampoo-Produkte empfehlen.",
    }
  }

  if (category === "shampoo" && isScalpSymptomShampooQuestion(category, routeContext)) {
    return {
      product_response_policy: "caution_without_products",
      policy_reason:
        "Juckreiz, Reizung oder wiederkehrende Schuppen brauchen eine vorsichtige Einordnung; danach können passende Anti-Schuppen- oder empfindliche-Kopfhaut-Optionen ausgewählt werden.",
    }
  }

  if (isSafeWeakLeverShampooQuestion(category, routeContext)) {
    if (isExplicitProductSelectionJob(routeContext) && decision === "recommended") {
      return {
        product_response_policy: "recommend_with_caveat",
        policy_reason:
          "Der Nutzer fragt explizit nach Shampoo-Produkten; empfehle passende Shampoo-Optionen, aber erkläre knapp, dass Conditioner, Leave-in, Maske oder Technik für dieses Ziel oft der stärkere Hebel sind.",
      }
    }

    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Anfrage betrifft vor allem Längen, Haaroberfläche oder Stylingtechnik; Shampoo ist nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist.",
    }
  }

  if (category === "conditioner" && isScalpOnlyConditionerQuestion(category, routeContext)) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Conditioner-Anfrage betrifft nur Kopfhaut, Ansatz oder Schuppen. Conditioner ist dafür nicht der richtige Produkthebel; passender sind Kopfhaut- oder Shampoo-Einordnung.",
    }
  }

  if (category === "mask" && isScalpOnlyMaskQuestion(category, routeContext)) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Masken-Anfrage betrifft nur Kopfhaut, Ansatz oder Schuppen. Eine Haarmaske ist dafür nicht der richtige Produkthebel; passender sind Kopfhaut- oder Shampoo-Einordnung.",
    }
  }

  if (isOilNoRecommendationDecision(category, params.categoryDecision ?? null)) {
    if (
      decision === "recommended" &&
      allowsCaveatedOilProductRecommendation({
        category,
        categoryDecision: params.categoryDecision,
        routeContext,
      })
    ) {
      return {
        product_response_policy: "recommend_with_caveat",
        policy_reason:
          "Der Nutzer fragt explizit nach Öl-Produkten; empfehle passende Optionen, aber rahme sie mit Reduktions- und Build-up-Caveat.",
      }
    }

    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Die Öl-Entscheidung unterdrückt Produkte bewusst und leitet zu einem besseren Hebel oder zu weniger Öl-Nutzung um.",
    }
  }

  if (isDeepCleansingScalpTreatmentDecision(category, params.categoryDecision ?? null)) {
    return {
      product_response_policy: "caution_without_products",
      policy_reason:
        "Tiefenreinigung ist kein Behandlungshebel für Schuppen, Juckreiz oder gereizte Kopfhaut.",
    }
  }

  if (category === "shampoo" && hasConcern(routeContext, "oily_roots")) {
    return {
      product_response_policy: "explain_then_recommend",
      policy_reason:
        "Ein schnell fettender Ansatz ist kopfhautnah; Shampoo kann helfen, aber Auftrag, Menge und optionaler zweiter Waschgang gehören zur Antwort.",
    }
  }

  if (
    decision === "recommended" &&
    isOptionalBondbuilderDecision(category, params.categoryDecision)
  ) {
    return {
      product_response_policy: "explain_then_recommend",
      policy_reason:
        "Der Engine-Check sieht: kein zwingender Bondbuilder-Bedarf; Empfehlungen sind optionale Vergleichsoptionen, kein Pflichtschritt.",
    }
  }

  if (decision === "not_recommended") {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason: "Diese Kategorie ist für die aktuelle Anfrage nicht der wichtigste Hebel.",
    }
  }

  return {
    product_response_policy: "recommend",
    policy_reason:
      category === "shampoo"
        ? "Shampoo wird primär über Kopfhaut-Fokus und Haardicke entschieden."
        : category === "conditioner"
          ? "Conditioner wird über Haardicke, Haardichte, Gewicht, Protein-/Feuchtigkeitsbalance und Pflegeintensität entschieden."
          : category === "deep_cleansing_shampoo"
            ? "Tiefenreinigung wird nur bei Reset-Signalen empfohlen und über Reset-Fokus, Intensität, Kopfhaut-Fokus und Farbschutz-Metadaten entschieden."
            : category === "bondbuilder"
              ? "Bondbuilder wird über strukturellen Damage-Bedarf, Einsatzmodus und Bondbuilding-Lane entschieden."
              : category === "dry_shampoo"
                ? "Trockenshampoo wird als Between-Wash-Brücke über Frische-Effekt, Farbfit, Format und Kopfhaut-Sensitivität entschieden."
                : "Die Auswahl folgt den aktuell verfügbaren Profil- und Produktdaten.",
  }
}

function buildCategoryGuidance(params: {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  categoryDecision: CategoryDecision | null
  routeContext?: SelectProductsRouteContext | null
}): string {
  const { category, decision, categoryDecision, routeContext } = params

  if (category === "dry_shampoo") {
    if (isDryShampooResetRedirectDecision(category, categoryDecision)) {
      return "Kein weiteres Trockenshampoo empfehlen: häufige Nutzung oder belegte/coated Roots sollen in Reduktion, Auswaschen und Reset-/Tiefenreinigungslogik führen. Trockenshampoo reinigt die Kopfhaut nicht und sollte später ausgewaschen werden."
    }

    if (isDryShampooCautionDecision(category, categoryDecision)) {
      return "Trockenshampoo nicht als Produkt empfehlen: bei Juckreiz, Schuppen, gereizter oder schmerzender Kopfhaut, Haarverlust-/Bruchdominanz, Atem-/Aerosol-Caution oder Kind-Kontext guidance-only bleiben und zu Kopfhaut-, Shampoo- oder Reset-Einordnung umleiten. Trockenshampoo reinigt die Kopfhaut nicht und sollte später ausgewaschen werden."
    }

    if (decision === "not_recommended") {
      return "Trockenshampoo ist kein normaler Routinebaustein und hier kein guter Produkthebel. Es passt nur als konkrete kosmetische Between-Wash-Brücke, nicht als Pflege, Behandlung oder Reinigung. Trockenshampoo reinigt die Kopfhaut nicht und sollte später ausgewaschen werden."
    }

    if (decision === "needs_more_info") {
      return "Für Trockenshampoo nur eine gezielte Rückfrage stellen, wenn die kurze Between-Wash-Brücke unklar ist. Nicht als Pflege, Behandlung oder Reinigung framen."
    }

    if (decision === "no_catalog_match") {
      return "Trockenshampoo passt als kurze kosmetische Between-Wash-Brücke, aber der aktuelle Katalog liefert keinen sicheren Treffer. Keine Produkte oder Ersatzprodukte wie Babypuder erfinden; trotzdem sagen, dass Trockenshampoo die Kopfhaut nicht reinigt und später ausgewaschen werden sollte."
    }

    return "Trockenshampoo nur als kurze kosmetische Between-Wash-Brücke am Ansatz framen, nicht als Pflege, Behandlung oder Reinigung. Immer sagen: Trockenshampoo reinigt die Kopfhaut nicht und sollte später ausgewaschen werden."
  }

  if (category === "shampoo") {
    if (isScalpSymptomShampooQuestion(category, routeContext)) {
      return "Juckreiz, Reizung oder wiederkehrende Schuppen sind nicht nur ein normales kosmetisches Shampoo-Thema. Wenn es stark ist oder anhält, sollte es professionell oder dermatologisch abgeklärt werden. Stelle Shampoo nicht als medizinische Lösung dar; frage knapp, ob der Fokus eher Schuppen-Reduktion oder gereizte/empfindliche Kopfhaut ist, und sage, dass danach passende Shampoo-Optionen ausgewählt werden können."
    }

    if (isDryLengthOnlyShampooQuestion(category, routeContext)) {
      return isExplicitProductSelectionJob(routeContext)
        ? "Du kannst Shampoo-Produkte empfehlen, weil der Nutzer explizit danach fragt. Caveat: Shampoo ist für trockene Längen nicht der stärkste Hebel; Conditioner, Leave-in oder Maske beeinflussen sie meist stärker. Shampoo bleibt vor allem Kopfhaut-/Reinigungshebel."
        : "Trockene Längen sind meist kein Shampoo-first Problem. Shampoo sollte vor allem die Kopfhaut reinigen; die Längen brauchen eher Schutz, Conditioner oder Leave-in."
    }

    if (isShineShampooQuestion(category, routeContext)) {
      return isExplicitProductSelectionJob(routeContext)
        ? "Du kannst Shampoo-Produkte empfehlen, weil der Nutzer explizit danach fragt. Caveat: Shampoo ist für mehr Glanz nicht der stärkste Hebel; Pflege, Oberfläche und Stylingtechnik wirken meist stärker."
        : "Mehr Glanz entsteht meist über Pflege, Oberfläche und Stylingtechnik. Shampoo ist dafür nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (isFrizzShampooQuestion(category, routeContext)) {
      return isExplicitProductSelectionJob(routeContext)
        ? "Du kannst Shampoo-Produkte empfehlen, weil der Nutzer explizit danach fragt. Caveat: Shampoo ist für Frizz nicht der stärkste Hebel; Frizz ist meist ein Längen-, Pflege- oder Stylingthema. Shampoo bleibt vor allem Kopfhaut-/Reinigungshebel."
        : "Frizz ist meist ein Längen-, Pflege- oder Stylingthema. Shampoo ist dafür nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (decision === "not_recommended") {
      return "Shampoo ist für diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Für eine Shampoo-Auswahl brauchen wir mindestens Haardicke und einen Kopfhaut-Fokus."
    }

    if (decision === "no_catalog_match") {
      return "Shampoo passt als Kategorie, aber der aktuelle Katalog liefert keinen sicheren Treffer für diesen Kopfhaut-Fokus."
    }

    const shampooDecision = categoryDecision?.category === "shampoo" ? categoryDecision : null
    const bucket = shampooDecision?.targetProfile?.shampooBucket
    const label = bucket ? SHAMPOO_BUCKET_LABELS[bucket] : null

    if (hasConcern(routeContext, "oily_roots")) {
      return label
        ? `Ein fettender Ansatz ist ein Shampoo-Thema: Die Auswahl folgt dem Kopfhaut-Fokus ${label} und deiner Haardicke.`
        : "Ein fettender Ansatz ist ein Shampoo-Thema; die Auswahl folgt Kopfhaut-Fokus und Haardicke."
    }

    return label
      ? `Shampoo ist hier der richtige Hebel: Die Auswahl folgt dem Kopfhaut-Fokus ${label} und deiner Haardicke.`
      : "Shampoo ist hier der richtige Hebel, gesteuert über Kopfhaut-Fokus und Haardicke."
  }

  if (category === "conditioner") {
    if (isScalpOnlyConditionerQuestion(category, routeContext)) {
      return "Conditioner ist für reine Kopfhaut-, Ansatz-, Schuppen- oder Juckreiz-Anfragen nicht der richtige Hebel. Keine Conditioner-Produkte empfehlen; zu Kopfhaut- oder Shampoo-Einordnung umleiten und Conditioner nicht als Behandlung für Kopfhautreizung framen."
    }

    if (decision === "not_recommended") {
      return "Conditioner ist für diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Für eine Conditioner-Auswahl sind Haardicke, Haardichte und Protein-/Feuchtigkeitsbalance normalerweise Profil-Invarianten. Fehlende Angaben defensiv behandeln, nicht als normalen Chat-Pfad aufblasen."
    }

    if (decision === "no_catalog_match") {
      return "Conditioner passt als Kategorie, aber der aktuelle Katalog liefert keinen sicheren Treffer für dieses Zielprofil."
    }

    return "Conditioner ist hier ein Längenhebel: Die Auswahl folgt Haardicke, Haardichte, Ziel-Gewicht, Protein-/Feuchtigkeitsbalance und Pflegeintensität. Dichte und Damage-Kontext dürfen die Profilableitung erklären, sind aber keine Produktclaims."
  }

  if (category === "deep_cleansing_shampoo") {
    if (isDeepCleansingScalpTreatmentDecision(category, categoryDecision)) {
      return "Tiefenreinigung nicht als Behandlung für Schuppen, Juckreiz, gereizte Kopfhaut oder seborrhoische Themen framen. Keine Produktkarten zeigen; zu Kopfhaut- oder Shampoo-Einordnung umleiten und bei anhaltenden/starken Beschwerden professionelle Abklärung empfehlen."
    }

    if (decision === "no_catalog_match") {
      return "Tiefenreinigung kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer mit gepflegten Reset-Spezifikationen. Keine Kalk-, Chlor-, Metall- oder Farbschutzclaims ohne strukturierte Felder erfinden."
    }

    if (decision === "not_recommended") {
      return "Tiefenreinigung ist hier nicht der erste Hebel, solange keine Build-up-, Styling-, Kalk-/Chlor- oder Reset-Signale vorliegen."
    }

    return "Tiefenreinigung ist ein gelegentlicher Reset, kein Alltags-Shampoo und keine Kopfhautbehandlung. Erst Reset-Rolle erklären, dann Anwendung: an Reset-Waschtagen statt normalem Shampoo, danach Conditioner in die Längen, etwa alle 5-6 Wäschen beziehungsweise alle 2-3 Wochen und bei trockener, empfindlicher, colorierter, lockiger oder stark beanspruchter Struktur seltener."
  }

  if (category === "leave_in") {
    const leaveInDecision = categoryDecision?.category === "leave_in" ? categoryDecision : null
    if (
      leaveInDecision?.targetProfile?.hasSeparateHeatProtectant &&
      leaveInDecision.targetProfile.heatProtectionNeed === "moderate"
    ) {
      return "Der Nutzer hat bereits separaten Hitzeschutz. Für Föhnen ist integrierter Leave-in-Hitzeschutz ein Bonus, kein Muss. Sage im Einstieg ausdrücklich, dass diese Zwei-in-eins-Route ein Produkt weniger in der Routine bedeuten kann: Leave-in-Pflege plus Föhnschutz in einem Produkt. Sage auch, dass der Nutzer den separaten Hitzeschutz behalten kann; dann sind Leave-ins ohne eigenen Hitzeschutz weiterhin normale Pflege-Booster."
    }
  }

  if (category === "mask") {
    if (isScalpOnlyMaskQuestion(category, routeContext)) {
      return "Masken sind Zusatzpflege für Längen und Spitzen, nicht der richtige Hebel für reine Kopfhaut-, Ansatz-, Schuppen- oder Juckreiz-Anfragen. Keine Masken-Produkte empfehlen; zu Kopfhaut- oder Shampoo-Einordnung umleiten."
    }

    if (decision === "not_recommended") {
      return "Eine Maske ist für diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Für eine Masken-Auswahl sind Haardicke, Haardichte und Protein-/Feuchtigkeitsbalance normalerweise Profil-Invarianten. Fehlende Angaben defensiv behandeln, nicht als normalen Chat-Pfad aufblasen."
    }

    if (decision === "no_catalog_match") {
      return "Eine Maske kann als Zusatzpflege passen, aber der aktuelle Katalog liefert keinen sicheren Treffer für dieses Zielprofil."
    }

    return "Maske ist hier Zusatzpflege für Längen und Spitzen: Die Auswahl folgt Gewicht, Protein-/Feuchtigkeitsbalance, Intensität und Fit. Nicht als Conditioner-Ersatz, Kopfhautbehandlung oder Schadensprävention framen."
  }

  if (category === "bondbuilder") {
    if (isOptionalBondbuilderDecision(category, categoryDecision)) {
      return "Der Engine-Check sieht keinen zwingenden Bondbuilder-Bedarf. Wenn der Nutzer trotzdem vergleichen will, als optionaler Zusatz framen: erst sagen, dass es kein Pflichtschritt ist, dann sparsame oder kurweise Nutzung und die passendsten Optionen nennen. Bei K18 vs OLAPLEX/Epres erklären: OLAPLEX/Epres = Disulfid-/Crosslink-Lane eher bei Blondierung, Coloration oder chemischem Stress; K18 = Peptid-/Leave-in-Lane eher bei Bruch, Snapping, starker Hitze oder Peptid-/Längsstruktur-Signalen. Wenn profile_basis keinen klaren Lane-Treiber zeigt, genau das offen sagen."
    }

    if (decision === "not_recommended") {
      return "Bondbuilder ist für dieses Profil gerade kein notwendiger Hebel. Keine Pflicht oder Schadensangst aufbauen; eher zu Basis-Pflege, Hitzeschutz oder Verhalten umleiten."
    }

    if (decision === "no_catalog_match") {
      return "Bondbuilder kann als Strukturpflege passen, aber der aktuelle Katalog liefert keinen sicheren Treffer mit gepflegten Bondbuilder-Spezifikationen."
    }

    return "Bondbuilder ist hier strukturelle Zusatzpflege: erst den abgeleiteten Bedarf nennen, dann zwischen Disulfid-/Crosslink- und Peptid-/Längsstruktur-Lane unterscheiden und nicht als normale Feuchtigkeitspflege framen. Bei K18 vs OLAPLEX/Epres gilt: Crosslink-Lane eher OLAPLEX/Epres, Peptid-/Längsstruktur-Lane eher K18; wenn beide Lane-Signale vorliegen, beide Rollen kurz gegenüberstellen."
  }

  if (category === "oil" && categoryDecision?.category === "oil") {
    if (categoryDecision.noRecommendationReason === "overload_risk") {
      if (
        decision === "recommended" &&
        allowsCaveatedOilProductRecommendation({ category, categoryDecision, routeContext })
      ) {
        return "Der Nutzer fragt explizit nach Öl-Produkten; vorhandene Produkttreffer dürfen gezeigt werden. CareBalance/Planner-Caveat: wegen Beschwerungs- oder Build-up-Risiko sparsam, leichter Fit, eher Frequenz senken und nicht als Pflichtschritt framen."
      }

      return "Ein neues Öl ist hier nicht der richtige Hebel: Die aktuelle Logik sieht ein Beschwerungs- oder Build-up-Risiko. Keine Öl-Produkte empfehlen; stattdessen weniger Öl, weniger Layering oder Reset-Pflege erklären."
    }

    if (categoryDecision.noRecommendationReason === "scalp_treatment_needed") {
      return "Öl ist hier nicht als Kopfhautbehandlung zu empfehlen. Keine Öl-Produkte empfehlen; zu Kopfhaut- oder Shampoo-Einordnung umleiten."
    }

    if (categoryDecision.noRecommendationReason === "therapy_oil_missing") {
      return "Für Wachstums-, Haarverlust- oder Therapie-Öl-Anfragen gibt es in dieser Produktauswahl keinen sicheren kosmetischen Produktpfad. Keine Öl-Produkte empfehlen und keine medizinischen Versprechen machen."
    }

    if (categoryDecision.noRecommendationReason === "better_non_oil_category") {
      return "Öl ist für diese Anfrage nicht der beste Produkthebel. Keine Öl-Produkte empfehlen; zu Leave-in, Conditioner, Maske oder passender Kopfhautpflege umleiten."
    }
  }

  if (decision === "not_recommended") {
    return "Diese Kategorie ist für die aktuelle Anfrage wahrscheinlich nicht der beste Hebel."
  }

  if (decision === "needs_more_info") {
    return "Für diese Produktauswahl fehlt noch eine wirklich entscheidende Information."
  }

  if (decision === "no_catalog_match") {
    return "Die Kategorie kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer."
  }

  return "Die Auswahl folgt den aktuell verfügbaren Profil- und Produktdaten."
}

export function projectSelectedProducts(
  products: MatchedProduct[],
  hairProfile: HairProfile | null = null,
  category: SelectableProductCategory | null = null,
  runtime: RecommendationEngineRuntime | null = null,
  routeContext: SelectProductsRouteContext | null = null,
): SelectedProductsProjection {
  const topProduct = products[0] ?? null
  const resolvedCategory: SelectableProductCategory | null =
    category ?? topProduct?.recommendation_meta?.category ?? null
  const categoryDecision = getCategoryDecision(runtime, resolvedCategory)
  const missing_info = deriveMissingInfoForEmptySelection({
    category: resolvedCategory,
    explicitCategoryProvided: category !== null,
    hairProfile,
    runtime,
  }).filter((item) => item.blocking)
  const decision = deriveDecision({
    products,
    category: resolvedCategory,
    categoryDecision,
    missingInfo: missing_info,
    routeContext,
  })
  const productPolicy = buildProductResponsePolicy({
    category: resolvedCategory,
    decision,
    categoryDecision,
    routeContext,
  })
  const displayableProducts = decision === "recommended" ? products.slice(0, 3) : []
  const projectedProducts = displayableProducts.map((product, index) =>
    projectDisplayableProduct(product, index + 1, routeContext),
  )
  const packetUnsupportedSignals = uniqueUnsupportedSignals([
    ...buildUnsupportedRequestedSignals(
      routeContext?.activeProfileSignals ?? [],
      projectedProducts.flatMap((product) => product.supported_claims),
    ),
    ...projectedProducts.flatMap((product) => product.unsupported_requested_signals),
    ...(resolvedCategory === "shampoo" ||
    resolvedCategory === "conditioner" ||
    resolvedCategory === "leave_in" ||
    resolvedCategory === "mask" ||
    resolvedCategory === "oil"
      ? buildUnsupportedIngredientSignals(
          routeContext?.requestedIngredientSignals ?? [],
          resolvedCategory === "shampoo" ||
            resolvedCategory === "leave_in" ||
            resolvedCategory === "mask" ||
            resolvedCategory === "oil"
            ? resolvedCategory
            : "conditioner",
        )
      : []),
    ...(resolvedCategory === "leave_in"
      ? buildUnsupportedHeatTemperatureSignals(routeContext?.requestedHeatTemperatureSignals ?? [])
      : []),
  ])

  return {
    category: resolvedCategory,
    decision,
    product_response_policy: productPolicy.product_response_policy,
    policy_reason: productPolicy.policy_reason,
    profile_basis: buildProfileBasis(hairProfile, resolvedCategory, categoryDecision, routeContext),
    category_guidance: buildCategoryGuidance({
      category: resolvedCategory,
      decision,
      categoryDecision,
      routeContext,
    }),
    products: projectedProducts,
    comparison_facts: buildComparisonFacts(displayableProducts),
    care_balance_context: buildProductCareBalanceContext({
      runtime,
      category: resolvedCategory,
    }),
    missing_info,
    unsupported_requested_signals: packetUnsupportedSignals,
  }
}

function unsupportedCategory(category: string): never {
  throw new Error(`Unsupported product category: ${category}`)
}

async function runCategoryEngine(params: {
  category: SelectableProductCategory
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { category, message, hairProfile, routineItems, runtime } = params

  switch (category) {
    case "shampoo":
      return selectShampooProductsWithEngine({ message, hairProfile, routineItems })
    case "conditioner":
      return selectConditionerProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "leave_in":
      return selectLeaveInProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "mask":
      return selectMaskProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "oil":
      return selectOilProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "bondbuilder":
      return selectBondbuilderProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "deep_cleansing_shampoo":
      return selectDeepCleansingShampooProductsWithEngine({
        message,
        hairProfile,
        routineItems,
        runtime,
      })
    case "dry_shampoo":
      return selectDryShampooProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "peeling":
      return selectPeelingProductsWithEngine({ message, hairProfile, routineItems, runtime })
    default:
      unsupportedCategory(String(category))
  }
}

function applyShampooActiveOverrides(
  hairProfile: HairProfile | null,
  activeSignals: readonly AgentActiveProfileSignal[],
): HairProfile | null {
  if (!hairProfile) return null

  const next: HairProfile = { ...hairProfile }

  for (const signal of activeSignals) {
    applyPhysicalProfileOverride(next, signal)
  }

  return next
}

function applyConditionerActiveOverrides(
  hairProfile: HairProfile | null,
  activeSignals: readonly AgentActiveProfileSignal[],
): HairProfile | null {
  if (!hairProfile) return null

  const next: HairProfile = { ...hairProfile }

  for (const signal of activeSignals) {
    applyPhysicalProfileOverride(next, signal)
  }

  return next
}

function isStylingTool(value: string): value is StylingTool {
  return (STYLING_TOOLS as readonly string[]).includes(value)
}

function isHeatStyling(value: string): value is HeatStyling {
  return (HEAT_STYLING_LEVELS as readonly string[]).includes(value)
}

function isHairThickness(value: string): value is HairThickness {
  return (HAIR_THICKNESSES as readonly string[]).includes(value)
}

function isHairTexture(value: string): value is HairTexture {
  return (HAIR_TEXTURES as readonly string[]).includes(value)
}

function isHairDensity(value: string): value is HairDensity {
  return (HAIR_DENSITIES as readonly string[]).includes(value)
}

function isScalpType(value: string): value is ScalpType {
  return (SCALP_TYPES as readonly string[]).includes(value)
}

function isScalpCondition(value: string): value is ScalpCondition {
  return (SCALP_CONDITIONS as readonly string[]).includes(value)
}

function shouldApplyProfileOverride(signal: AgentActiveProfileSignal): boolean {
  return signal.selection_effect === "override" || signal.selection_effect === "caution"
}

function applyPhysicalProfileOverride(next: HairProfile, signal: AgentActiveProfileSignal): void {
  if (!shouldApplyProfileOverride(signal)) return

  if (signal.field === "thickness" && isHairThickness(signal.value)) {
    next.thickness = signal.value
  }

  if (signal.field === "hair_texture" && isHairTexture(signal.value)) {
    next.hair_texture = signal.value
  }

  if (signal.field === "density" && isHairDensity(signal.value)) {
    next.density = signal.value
  }

  if (signal.field === "scalp_type" && isScalpType(signal.value)) {
    next.scalp_type = signal.value
    if (signal.selection_effect === "override") {
      next.scalp_condition = null
    }
  }

  if (signal.field === "scalp_condition" && isScalpCondition(signal.value)) {
    next.scalp_condition = signal.value
  }
}

function applyLeaveInActiveOverrides(
  hairProfile: HairProfile | null,
  activeSignals: readonly AgentActiveProfileSignal[],
): HairProfile | null {
  if (!hairProfile) return null

  const next: HairProfile = {
    ...hairProfile,
    styling_tools: hairProfile.styling_tools ? [...hairProfile.styling_tools] : [],
  }

  for (const signal of activeSignals) {
    applyPhysicalProfileOverride(next, signal)

    if (signal.field === "styling_tools" && isStylingTool(signal.value)) {
      const tools = new Set(next.styling_tools ?? [])
      tools.add(signal.value)
      next.styling_tools = [...tools]
    }

    if (signal.field === "heat_styling" && isHeatStyling(signal.value)) {
      next.heat_styling = signal.value
    }
  }

  return next
}

function applyActiveProfileOverrides(params: {
  category: SelectableProductCategory
  hairProfile: HairProfile | null
  activeSignals: readonly AgentActiveProfileSignal[]
}): HairProfile | null {
  if (params.category === "shampoo") {
    return applyShampooActiveOverrides(params.hairProfile, params.activeSignals)
  }

  if (
    params.category === "conditioner" ||
    params.category === "mask" ||
    params.category === "oil"
  ) {
    return applyConditionerActiveOverrides(params.hairProfile, params.activeSignals)
  }

  if (params.category === "leave_in") {
    return applyLeaveInActiveOverrides(params.hairProfile, params.activeSignals)
  }

  return params.hairProfile
}

function deriveRequestedIngredientSignals(message: string): RequestedIngredientSignal[] {
  const normalized = message
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  const signals: RequestedIngredientSignal[] = []
  const add = (value: string, evidence: string) => {
    if (!signals.some((signal) => signal.value === value)) {
      signals.push({ value, evidence })
    }
  }

  if (/\bsilikon(?:e|frei|frei\w*)\b|\bsilicone[-\s]?free\b/.test(normalized)) {
    add("silicone_free", "silikonfrei")
  }
  if (/\bkokos(?:frei|oel|ol|nuss)?\b|\bcoconut[-\s]?free\b/.test(normalized)) {
    add("coconut_free", "kokosfrei")
  }
  if (/\b(?:protein(?:frei|arm)|ohne\s+protein\w*|protein[-\s]?free)\b/.test(normalized)) {
    add("protein_free", "proteinfrei")
  }
  if (/\boel(?:frei|e)?\b|\boil[-\s]?free\b/.test(normalized)) {
    add("oil_free", "oelfrei")
  }
  if (/\bhumectant\w*\b|\bfeuchthaltemittel\b/.test(normalized)) {
    add("humectant_preference", "Humectants")
  }

  return signals
}

function deriveRequestedHeatTemperatureSignals(message: string): RequestedHeatTemperatureSignal[] {
  const normalized = message
    .toLocaleLowerCase("de-DE")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  const signals: RequestedHeatTemperatureSignal[] = []

  for (const match of normalized.matchAll(/\b(\d{2,3})\s*(?:grad|°\s*c|celsius)\b/g)) {
    const value = match[1]
    if (value && !signals.some((signal) => signal.value === value)) {
      signals.push({ value, evidence: match[0] })
    }
  }

  return signals
}

export function createSelectProductsTool(
  options: {
    onResult?: (result: SelectProductsToolResult) => void
    runCategoryEngine?: typeof runCategoryEngine
  } = {},
) {
  return async function selectProductsTool(params: {
    category: SelectableProductCategory
    message: string
    hairProfile: HairProfile | null
    memoryContext: UserMemoryContext
    routineItems: PersistenceRoutineItemRow[]
    effectiveCareContext?: EffectiveCareContext | null
    userJob?: AgentUserJob | null
    concerns?: AgentConcern[] | null
    requestedGoal?: "shine" | null
    activeProfileSignals?: AgentActiveProfileSignal[] | null
  }): Promise<SelectedProductsProjection> {
    const {
      category,
      message,
      hairProfile,
      memoryContext,
      routineItems,
      effectiveCareContext = null,
      userJob,
      concerns,
      requestedGoal,
      activeProfileSignals,
    } = params
    const effectiveHairProfile = applyActiveProfileOverrides({
      category,
      hairProfile,
      activeSignals: activeProfileSignals ?? [],
    })
    const runtime = buildRecommendationEngineRuntimeForChat({
      hairProfile: effectiveHairProfile,
      routineItems,
      productCategory: category,
      message,
      effectiveCareContext,
    })
    const products = await (options.runCategoryEngine ?? runCategoryEngine)({
      category,
      message,
      hairProfile: effectiveHairProfile,
      routineItems,
      runtime,
    })
    const constrainedProducts = applyProductMemoryConstraints(products, memoryContext)
    const projection = projectSelectedProducts(
      constrainedProducts,
      effectiveHairProfile,
      category,
      runtime,
      {
        userJob,
        message,
        concerns,
        requestedGoal,
        activeProfileSignals,
        requestedIngredientSignals:
          category === "shampoo" ||
          category === "conditioner" ||
          category === "leave_in" ||
          category === "mask" ||
          category === "oil"
            ? deriveRequestedIngredientSignals(message)
            : [],
        requestedHeatTemperatureSignals:
          category === "leave_in" ? deriveRequestedHeatTemperatureSignals(message) : [],
        originalHairProfile: hairProfile,
      },
    )

    options.onResult?.({
      projection,
      products: constrainedProducts,
      effectiveHairProfile,
      runtime,
    })

    return projection
  }
}
