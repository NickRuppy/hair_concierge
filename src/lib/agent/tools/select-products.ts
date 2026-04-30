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
import type { CategoryDecision } from "@/lib/recommendation-engine/types"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import type { MatchedProduct } from "@/lib/rag/product-matcher"
import type { UserMemoryContext } from "@/lib/rag/user-memory"
import type {
  ConditionerRecommendationMetadata,
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
  | "explain_then_recommend"
  | "redirect_to_better_lever"
  | "caution_without_products"
  | "needs_more_info"
  | "no_catalog_match"

export interface SelectProductsRouteContext {
  userJob?: AgentUserJob | null
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
    | "Oel-Zweck"
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
  missing_info: SelectedProductsMissingInfo[]
  unsupported_requested_signals: UnsupportedRequestedSignal[]
}

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
    ...(meta?.category === "conditioner" ||
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
    fit_reason: buildDisplayableFitReason(product),
    caveat,
    supported_claims: supportedClaims,
    unsupported_requested_signals: unsupportedRequestedSignals,
  }
}

function mapDisplayableCaveat(caveat: string | null): string | null {
  if (!caveat) return null

  if (/^fallback:/i.test(caveat.trim())) {
    return caveat
  }

  const normalized = caveat.trim().toLocaleLowerCase("de-DE")
  if (
    normalized === "weicht vom aktuellen kopfhaut-fokus ab." ||
    normalized === "weicht vom aktuellen kopfhaut-fokus ab" ||
    (/weicht.*kopfhaut-fokus/.test(normalized) && !/fallback/.test(normalized))
  ) {
    return "Passt nicht exakt zum abgeleiteten Shampoo-Fokus. Nur als Fallback zeigen, wenn keine ausreichenden sicheren Treffer verfuegbar sind."
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

  return Object.fromEntries(
    products.map((product) => [product.id, buildProductComparisonFacts(product)]),
  )
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
              text: `Pflegeintensitaet: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`,
            }
          : null,
        meta.fit_status
          ? {
              key: "fit_status",
              value: `${meta.fit_status}:${
                meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"
                  ? "fallback"
                  : "primary"
              }`,
              text:
                meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"
                  ? "Caveat: Fallback"
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
      const values = valuesByKey.get(candidate.key)
      if (!values || values.size <= 1) continue
      facts.push(candidate.text)
      if (facts.length >= 2) break
    }

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
      ].filter((candidate): candidate is { key: string; value: string; text: string } =>
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

interface ComparisonFactCandidate {
  key: string
  value: string
  text: string
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
            text: `Intensitaet: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`,
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

function buildOilComparisonFactsForSet(products: MatchedProduct[]): Record<string, string[]> {
  const factRows = products.map((product) => {
    const meta = product.recommendation_meta as OilRecommendationMetadata
    const candidates: Array<ComparisonFactCandidate | null> = [
      meta.use_mode
        ? {
            key: "oil_purpose",
            value: meta.use_mode,
            text: `Oel-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}`,
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
            text: `Fit: ${meta.purpose_fit === "exact" ? "exakt" : meta.purpose_fit === "bridge" ? "Finish-Bridge" : "Daten unvollstaendig"}`,
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
  dry_flakes: "trockene Schueppchen",
  irritated: "irritiert",
}

const SHAMPOO_CLEANSING_INTENSITY_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["cleansing_intensity"]>,
  string
> = {
  gentle: "sanft",
  regular: "normal",
  clarifying: "klaerend",
}

const SHAMPOO_FIT_STATUS_LABELS: Record<
  NonNullable<ShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstuetzender Treffer",
  mismatch: "weicht ab",
  unknown: "Daten unvollstaendig",
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
  supportive: "unterstuetzender Treffer",
  mismatch: "Fallback-Abweichung",
  unknown: "Daten unvollstaendig",
  not_applicable: "nicht anwendbar",
}

const LEAVE_IN_FIT_STATUS_LABELS: Record<
  NonNullable<LeaveInRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "idealer Treffer",
  supportive: "unterstuetzender Treffer",
  mismatch: "Fallback-Abweichung",
  unknown: "Daten unvollstaendig",
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
  supportive: "unterstuetzender Treffer",
  mismatch: "Fallback-Abweichung",
  unknown: "Daten unvollstaendig",
  not_applicable: "nicht anwendbar",
}

const MASK_FIT_STATUS_PREFIXES: Record<
  NonNullable<MaskRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstuetzender Treffer",
  mismatch: "Fallback-Treffer",
  unknown: "Treffer mit unvollstaendigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const OIL_FIT_STATUS_PREFIXES: Record<
  NonNullable<OilRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstuetzender Treffer",
  mismatch: "Fallback-Treffer",
  unknown: "Treffer mit unvollstaendigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const LEAVE_IN_FIT_STATUS_PREFIXES: Record<
  NonNullable<LeaveInRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstuetzender Treffer",
  mismatch: "Fallback-Treffer",
  unknown: "Treffer mit unvollstaendigen Daten",
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
  supportive: "Unterstuetzender Treffer",
  mismatch: "Fallback-Treffer",
  unknown: "Treffer mit unvollstaendigen Daten",
  not_applicable: "Nicht anwendbarer Treffer",
}

const SHAMPOO_THICKNESS_FIT_PHRASES = {
  fine: "feines Haar",
  normal: "mitteldickes Haar",
  coarse: "kraeftiges Haar",
} as const

const SHAMPOO_SCALP_ROUTE_FIT_PHRASES: Record<
  NonNullable<ShampooRecommendationMetadata["matched_scalp_route"]>,
  string
> = {
  oily: "schnell fettenden Kopfhaut-Fokus",
  balanced: "ausgeglichenen Kopfhaut-Fokus",
  dry: "trockenen Kopfhaut-Fokus",
  dandruff: "Schuppen-Fokus",
  dry_flakes: "trockene-Schueppchen-Fokus",
  irritated: "irritierten Kopfhaut-Fokus",
}

const SHAMPOO_FIT_STATUS_PREFIXES: Record<
  NonNullable<ShampooRecommendationMetadata["fit_status"]>,
  string
> = {
  ideal: "Idealer Treffer",
  supportive: "Unterstuetzender Treffer",
  mismatch: "Schwaecherer Treffer",
  unknown: "Treffer mit unvollstaendigen Daten",
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

  return meta?.top_reasons?.[0] ?? "Passt von den verfuegbaren Optionen am besten."
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
  const fitText = fitParts.length > 0 ? ` fuer ${fitParts.join(" und ")}` : ""
  const intensityText = intensity ? `; Reinigungsintensitaet: ${intensity}` : ""

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
    ? `Pflegeintensitaet: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`
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
    ? `Intensitaet: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`
    : null
  const weight = meta.product_weight ? `Gewicht: ${MASK_WEIGHT_LABELS[meta.product_weight]}` : null
  const details = uniqueNonEmpty([balance, concentration, weight])

  return details.length > 0 ? `${prefix}; ${details.join("; ")}.` : `${prefix}.`
}

function buildOilDisplayableFitReason(meta: OilRecommendationMetadata): string {
  const prefix = meta.fit_status
    ? (OIL_FIT_STATUS_PREFIXES[meta.fit_status] ?? "Treffer")
    : "Treffer"
  const purpose = meta.use_mode ? `Oel-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}` : null
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

  return uniqueNonEmpty(meta?.top_reasons ?? []).slice(0, 3)
}

function buildShampooComparisonFacts(meta: ShampooRecommendationMetadata): string[] {
  const fallback = meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"

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
      ? `Reinigungsintensitaet: ${
          SHAMPOO_CLEANSING_INTENSITY_LABELS[meta.cleansing_intensity] ?? meta.cleansing_intensity
        }`
      : null,
    meta.fit_status
      ? `Fit: ${SHAMPOO_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
      : null,
    `Fallback: ${fallback ? "ja" : "nein"}`,
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
      ? `Pflegeintensitaet: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`
      : null,
    meta.fit_status
      ? `Fit: ${CONDITIONER_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}`
      : null,
    meta.tradeoffs.some(isFallbackCaveat) || meta.fit_status === "mismatch"
      ? "Caveat: Fallback"
      : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 2)
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
  ]).slice(0, 2)
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
      ? `Intensitaet: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`
      : null,
    meta.product_weight ? `Gewicht: ${MASK_WEIGHT_LABELS[meta.product_weight]}` : null,
    meta.fit_status ? `Fit: ${MASK_FIT_STATUS_LABELS[meta.fit_status] ?? meta.fit_status}` : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 2)
}

function buildOilComparisonFacts(
  product: MatchedProduct,
  meta: OilRecommendationMetadata,
): string[] {
  return uniqueNonEmpty([
    meta.use_mode ? `Oel-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}` : null,
    meta.matched_subtype ? `Subtyp: ${OIL_SUBTYPE_LABELS[meta.matched_subtype]}` : null,
    meta.purpose_fit
      ? `Fit: ${meta.purpose_fit === "exact" ? "exakt" : meta.purpose_fit === "bridge" ? "Finish-Bridge" : "Daten unvollstaendig"}`
      : null,
    meta.density_weight_caution ? "Caveat: sparsam dosieren" : null,
    typeof product.price_eur === "number" ? `Preis: ${product.price_eur.toFixed(2)} EUR` : null,
  ]).slice(0, 2)
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
        ? `Reinigungsintensitaet: ${
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
        ? `Pflegeintensitaet: ${CONDITIONER_REPAIR_LEVEL_LABELS[meta.product_repair_level]}`
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
        ? `Intensitaet: ${MASK_CONCENTRATION_LABELS[meta.product_concentration]}`
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
      meta.use_mode ? `Oel-Zweck: ${OIL_PURPOSE_LABELS[meta.use_mode]}` : null,
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
    return "Zum Farbschutz habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den belegten Fit-Daten."
  }

  if (signal.field === "chemical_treatment" && signal.value === "bleached") {
    return "Zu blondiertem Haar habe ich bei diesen Produkten aktuell keine sichere Spezialangabe. Ich bewerte sie deshalb nach den belegten Fit-Daten."
  }

  if (signal.field === "scalp_condition" && signal.value === "irritated") {
    return "Zur empfindlichen Kopfhaut habe ich bei diesen Produkten keine sichere Spezialangabe. Ich bewerte sie deshalb vor allem nach Kopfhaut-Fokus, Haardicke und Reinigungsintensitaet."
  }

  return "Zu einem Teil deiner Anfrage habe ich aktuell keine sichere Produktangabe. Ich bewerte die Optionen deshalb nach den belegten Fit-Daten."
}

function buildUnsupportedIngredientSignals(
  signals: readonly RequestedIngredientSignal[],
  category: "conditioner" | "leave_in" | "mask" | "oil" = "conditioner",
): UnsupportedRequestedSignal[] {
  return uniqueUnsupportedSignals(
    signals.map((signal) => ({
      field: "ingredient_preference",
      value: signal.value,
      reason: "no_structured_product_data",
      user_message:
        category === "oil"
          ? "Wuensche wie silikonfrei, kokosfrei, proteinfrei oder oelfrei sind in dieser Oel-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Oel-Zweck, Haardicke, Anwendung und Fit."
          : category === "leave_in"
            ? "Wuensche wie silikonfrei, kokosfrei, proteinfrei oder oelfrei sind in dieser Leave-in-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Rolle, Hitzeschutz, Pflegefokus und Fit."
            : category === "mask"
              ? "Wuensche wie silikonfrei, kokosfrei, proteinfrei oder oelfrei sind in dieser Masken-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Intensitaet und Fit."
              : "Wuensche wie silikonfrei, kokosfrei oder proteinfrei sind in dieser Conditioner-Auswahl noch nicht sicher geprueft. Ich bewerte die Optionen deshalb nach Gewicht, Balance, Pflegeintensitaet und Fit.",
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
        detail: "Es fehlt noch dein Kopfhaut-Typ fuer die Shampoo-Auswahl.",
      }
    case "scalp_condition":
      return {
        key: field,
        label: "Kopfhaut-Beschwerden",
        blocking: true,
        detail: "Es fehlen noch aktuelle Kopfhaut-Beschwerden fuer die Shampoo-Auswahl.",
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
        detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance fuer die Conditioner-Auswahl.",
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
        detail: "Es fehlt noch deine Protein-/Feuchtigkeitsbalance fuer die Masken-Auswahl.",
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
        detail: "Es fehlt noch dein Haarmuster fuer die Leave-in-Auswahl.",
      }
    case "thickness":
      return {
        key: field,
        label: "Haardicke",
        blocking: true,
        detail: "Es fehlt noch deine Haardicke fuer die Leave-in-Auswahl.",
      }
    case "density":
      return {
        key: field,
        label: "Haardichte",
        blocking: true,
        detail: "Es fehlt noch deine Haardichte fuer die Leave-in-Auswahl.",
      }
    case "care_signal":
      return {
        key: field,
        label: "Pflegebedarf",
        blocking: false,
        detail: "Es fehlt noch dein Pflegebedarf fuer die Leave-in-Auswahl.",
      }
    case "styling_signal":
      return {
        key: field,
        label: "Styling-Kontext",
        blocking: false,
        detail: "Es fehlt noch dein Styling-Kontext fuer die Leave-in-Auswahl.",
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
        detail: "Es fehlt noch deine Haardicke fuer die Oel-Auswahl.",
      }
    case "oil_purpose":
      return {
        key: field,
        label: "Oel-Zweck",
        blocking: true,
        detail: "Es fehlt noch dein Oel-Zweck fuer die Oel-Auswahl.",
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
        ? `Masken-Intensitaet: ${
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
        ? `Oel-Zweck: ${OIL_PURPOSE_LABELS[oilDecision.targetProfile.purpose]}`
        : null,
      oilDecision?.targetProfile?.densityWeightCaution
        ? "Gewichts-Caveat: sehr sparsam dosieren."
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

  if (isDryLengthOnlyShampooQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (
    isScalpSymptomShampooQuestion(category, routeContext) ||
    isShineShampooQuestion(category, routeContext) ||
    isFrizzShampooQuestion(category, routeContext)
  ) {
    return "not_recommended"
  }

  if (isScalpOnlyConditionerQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (isScalpOnlyMaskQuestion(category, routeContext)) {
    return "not_recommended"
  }

  if (isOilNoRecommendationDecision(category, categoryDecision)) {
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
  const { category, decision, routeContext } = params

  if (decision === "needs_more_info") {
    return {
      product_response_policy: "needs_more_info",
      policy_reason: "Fuer diese Produktauswahl fehlt noch eine entscheidende Profilinformation.",
    }
  }

  if (decision === "no_catalog_match") {
    return {
      product_response_policy: "no_catalog_match",
      policy_reason:
        "Die Kategorie kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer.",
    }
  }

  if (category === "shampoo" && isScalpSymptomShampooQuestion(category, routeContext)) {
    return {
      product_response_policy: "caution_without_products",
      policy_reason:
        "Juckreiz, Reizung oder wiederkehrende Schuppen brauchen eine vorsichtige Einordnung; danach koennen passende Anti-Schuppen- oder empfindliche-Kopfhaut-Optionen ausgewaehlt werden.",
    }
  }

  if (
    category === "shampoo" &&
    (isDryLengthOnlyShampooQuestion(category, routeContext) ||
      isShineShampooQuestion(category, routeContext) ||
      isFrizzShampooQuestion(category, routeContext))
  ) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Anfrage betrifft vor allem Laengen, Haaroberflaeche oder Stylingtechnik; Shampoo ist nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist.",
    }
  }

  if (category === "conditioner" && isScalpOnlyConditionerQuestion(category, routeContext)) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Conditioner-Anfrage betrifft nur Kopfhaut, Ansatz oder Schuppen. Conditioner ist dafuer nicht der richtige Produkthebel; passender sind Kopfhaut- oder Shampoo-Einordnung.",
    }
  }

  if (category === "mask" && isScalpOnlyMaskQuestion(category, routeContext)) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Diese Masken-Anfrage betrifft nur Kopfhaut, Ansatz oder Schuppen. Eine Haarmaske ist dafuer nicht der richtige Produkthebel; passender sind Kopfhaut- oder Shampoo-Einordnung.",
    }
  }

  if (isOilNoRecommendationDecision(category, params.categoryDecision ?? null)) {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason:
        "Die Oel-Entscheidung unterdrueckt Produkte bewusst und leitet zu einem besseren Hebel oder zu weniger Oel-Nutzung um.",
    }
  }

  if (category === "shampoo" && hasConcern(routeContext, "oily_roots")) {
    return {
      product_response_policy: "explain_then_recommend",
      policy_reason:
        "Ein schnell fettender Ansatz ist kopfhautnah; Shampoo kann helfen, aber Auftrag, Menge und optionaler zweiter Waschgang gehoeren zur Antwort.",
    }
  }

  if (decision === "not_recommended") {
    return {
      product_response_policy: "redirect_to_better_lever",
      policy_reason: "Diese Kategorie ist fuer die aktuelle Anfrage nicht der wichtigste Hebel.",
    }
  }

  return {
    product_response_policy: "recommend",
    policy_reason:
      category === "shampoo"
        ? "Shampoo wird primaer ueber Kopfhaut-Fokus und Haardicke entschieden."
        : category === "conditioner"
          ? "Conditioner wird ueber Haardicke, Haardichte, Gewicht, Protein-/Feuchtigkeitsbalance und Pflegeintensitaet entschieden."
          : "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten.",
  }
}

function buildCategoryGuidance(params: {
  category: SelectableProductCategory | null
  decision: SelectProductsDecision
  categoryDecision: CategoryDecision | null
  routeContext?: SelectProductsRouteContext | null
}): string {
  const { category, decision, categoryDecision, routeContext } = params

  if (category === "shampoo") {
    if (isScalpSymptomShampooQuestion(category, routeContext)) {
      return "Juckreiz, Reizung oder wiederkehrende Schuppen sind nicht nur ein normales kosmetisches Shampoo-Thema. Wenn es stark ist oder anhaelt, sollte es professionell oder dermatologisch abgeklaert werden. Stelle Shampoo nicht als medizinische Loesung dar; frage knapp, ob der Fokus eher Schuppen-Reduktion oder gereizte/empfindliche Kopfhaut ist, und sage, dass danach passende Shampoo-Optionen ausgewaehlt werden koennen."
    }

    if (isDryLengthOnlyShampooQuestion(category, routeContext)) {
      return "Trockene Laengen sind meist kein Shampoo-first Problem. Shampoo sollte vor allem die Kopfhaut reinigen; die Laengen brauchen eher Schutz, Conditioner oder Leave-in."
    }

    if (isShineShampooQuestion(category, routeContext)) {
      return "Mehr Glanz entsteht meist ueber Pflege, Oberflaeche und Stylingtechnik. Shampoo ist dafuer nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (isFrizzShampooQuestion(category, routeContext)) {
      return "Frizz ist meist ein Laengen-, Pflege- oder Stylingthema. Shampoo ist dafuer nicht der erste Hebel, solange die Kopfhaut ausgeglichen ist."
    }

    if (decision === "not_recommended") {
      return "Shampoo ist fuer diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Fuer eine Shampoo-Auswahl brauchen wir mindestens Haardicke und einen Kopfhaut-Fokus."
    }

    if (decision === "no_catalog_match") {
      return "Shampoo passt als Kategorie, aber der aktuelle Katalog liefert keinen sicheren Treffer fuer diesen Kopfhaut-Fokus."
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
      : "Shampoo ist hier der richtige Hebel, gesteuert ueber Kopfhaut-Fokus und Haardicke."
  }

  if (category === "conditioner") {
    if (isScalpOnlyConditionerQuestion(category, routeContext)) {
      return "Conditioner ist fuer reine Kopfhaut-, Ansatz-, Schuppen- oder Juckreiz-Anfragen nicht der richtige Hebel. Keine Conditioner-Produkte empfehlen; zu Kopfhaut- oder Shampoo-Einordnung umleiten und Conditioner nicht als Behandlung fuer Kopfhautreizung framen."
    }

    if (decision === "not_recommended") {
      return "Conditioner ist fuer diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Fuer eine Conditioner-Auswahl sind Haardicke, Haardichte und Protein-/Feuchtigkeitsbalance normalerweise Profil-Invarianten. Fehlende Angaben defensiv behandeln, nicht als normalen Chat-Pfad aufblasen."
    }

    if (decision === "no_catalog_match") {
      return "Conditioner passt als Kategorie, aber der aktuelle Katalog liefert keinen sicheren Treffer fuer dieses Zielprofil."
    }

    return "Conditioner ist hier ein Laengenhebel: Die Auswahl folgt Haardicke, Haardichte, Ziel-Gewicht, Protein-/Feuchtigkeitsbalance und Pflegeintensitaet. Dichte und Damage-Kontext duerfen die Profilableitung erklaeren, sind aber keine Produktclaims."
  }

  if (category === "leave_in") {
    const leaveInDecision = categoryDecision?.category === "leave_in" ? categoryDecision : null
    if (
      leaveInDecision?.targetProfile?.hasSeparateHeatProtectant &&
      leaveInDecision.targetProfile.heatProtectionNeed === "moderate"
    ) {
      return "Der Nutzer hat bereits separaten Hitzeschutz. Fuer Foehnen ist integrierter Leave-in-Hitzeschutz ein Bonus, kein Muss. Sage im Einstieg ausdruecklich, dass diese Zwei-in-eins-Route ein Produkt weniger in der Routine bedeuten kann: Leave-in-Pflege plus Foehnschutz in einem Produkt. Sage auch, dass der Nutzer den separaten Hitzeschutz behalten kann; dann sind Leave-ins ohne eigenen Hitzeschutz weiterhin normale Pflege-Booster."
    }
  }

  if (category === "mask") {
    if (isScalpOnlyMaskQuestion(category, routeContext)) {
      return "Masken sind Zusatzpflege fuer Laengen und Spitzen, nicht der richtige Hebel fuer reine Kopfhaut-, Ansatz-, Schuppen- oder Juckreiz-Anfragen. Keine Masken-Produkte empfehlen; zu Kopfhaut- oder Shampoo-Einordnung umleiten."
    }

    if (decision === "not_recommended") {
      return "Eine Maske ist fuer diese Anfrage gerade nicht der wichtigste Hebel."
    }

    if (decision === "needs_more_info") {
      return "Fuer eine Masken-Auswahl sind Haardicke, Haardichte und Protein-/Feuchtigkeitsbalance normalerweise Profil-Invarianten. Fehlende Angaben defensiv behandeln, nicht als normalen Chat-Pfad aufblasen."
    }

    if (decision === "no_catalog_match") {
      return "Eine Maske kann als Zusatzpflege passen, aber der aktuelle Katalog liefert keinen sicheren Treffer fuer dieses Zielprofil."
    }

    return "Maske ist hier Zusatzpflege fuer Laengen und Spitzen: Die Auswahl folgt Gewicht, Protein-/Feuchtigkeitsbalance, Intensitaet und Fit. Nicht als Conditioner-Ersatz, Kopfhautbehandlung oder Schadenspraevention framen."
  }

  if (category === "oil" && categoryDecision?.category === "oil") {
    if (categoryDecision.noRecommendationReason === "overload_risk") {
      return "Ein neues Oel ist hier nicht der richtige Hebel: Die aktuelle Logik sieht ein Beschwerungs- oder Build-up-Risiko. Keine Oel-Produkte empfehlen; stattdessen weniger Oel, weniger Layering oder Reset-Pflege erklaeren."
    }

    if (categoryDecision.noRecommendationReason === "scalp_treatment_needed") {
      return "Oel ist hier nicht als Kopfhautbehandlung zu empfehlen. Keine Oel-Produkte empfehlen; zu Kopfhaut- oder Shampoo-Einordnung umleiten."
    }

    if (categoryDecision.noRecommendationReason === "therapy_oil_missing") {
      return "Fuer Wachstums-, Haarverlust- oder Therapie-Oel-Anfragen gibt es in dieser Produktauswahl keinen sicheren kosmetischen Produktpfad. Keine Oel-Produkte empfehlen und keine medizinischen Versprechen machen."
    }

    if (categoryDecision.noRecommendationReason === "better_non_oil_category") {
      return "Oel ist fuer diese Anfrage nicht der beste Produkthebel. Keine Oel-Produkte empfehlen; zu Leave-in, Conditioner, Maske oder passender Kopfhautpflege umleiten."
    }
  }

  if (decision === "not_recommended") {
    return "Diese Kategorie ist fuer die aktuelle Anfrage wahrscheinlich nicht der beste Hebel."
  }

  if (decision === "needs_more_info") {
    return "Fuer diese Produktauswahl fehlt noch eine wirklich entscheidende Information."
  }

  if (decision === "no_catalog_match") {
    return "Die Kategorie kann passen, aber der aktuelle Katalog liefert keinen sicheren Treffer."
  }

  return "Die Auswahl folgt den aktuell verfuegbaren Profil- und Produktdaten."
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
    ...(resolvedCategory === "conditioner" ||
    resolvedCategory === "leave_in" ||
    resolvedCategory === "mask" ||
    resolvedCategory === "oil"
      ? buildUnsupportedIngredientSignals(
          routeContext?.requestedIngredientSignals ?? [],
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
      return selectConditionerProductsWithEngine({ message, hairProfile, routineItems })
    case "leave_in":
      return selectLeaveInProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "mask":
      return selectMaskProductsWithEngine({ message, hairProfile, routineItems, runtime })
    case "oil":
      return selectOilProductsWithEngine({ message, hairProfile, routineItems })
    case "bondbuilder":
      return selectBondbuilderProductsWithEngine({ message, hairProfile, routineItems })
    case "deep_cleansing_shampoo":
      return selectDeepCleansingShampooProductsWithEngine({ message, hairProfile, routineItems })
    case "dry_shampoo":
      return selectDryShampooProductsWithEngine({ message, hairProfile, routineItems })
    case "peeling":
      return selectPeelingProductsWithEngine({ message, hairProfile, routineItems })
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
        concerns,
        requestedGoal,
        activeProfileSignals,
        requestedIngredientSignals:
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
