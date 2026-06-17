import type { ProductBondbuilderSpecs } from "@/lib/bondbuilder/constants"
import type { ProductDeepCleansingShampooSpecs } from "@/lib/deep-cleansing-shampoo/constants"
import type { ProductDryShampooSpecs } from "@/lib/dry-shampoo/constants"
import { createAdminClient } from "@/lib/supabase/admin"
import type {
  BondbuilderRecommendationMetadata,
  ConditionerBalanceNeed,
  ConditionerRecommendationMetadata,
  DeepCleansingShampooRecommendationMetadata,
  DryShampooRecommendationMetadata,
  HairProfile,
  LeaveInRecommendationMetadata,
  MaskRecommendationMetadata,
  MaskType,
  OilRecommendationMetadata,
  PeelingRecommendationMetadata,
  Product,
  ProductRelationshipType,
  ProductSummary,
  ShampooRecommendationMetadata,
} from "@/lib/types"
import { getBondbuilderUsageHint } from "@/lib/bondbuilder/usage-protocols"
import type { ProductConditionerRerankSpecs } from "@/lib/conditioner/constants"
import type {
  LeaveInFormat,
  LeaveInConditionerRelationship,
  LeaveInNeedBucket,
  ProductLeaveInSpecs,
} from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import { OIL_PURPOSE_LABELS, type OilPurpose, type OilSubtype } from "@/lib/oil/constants"
import type { ProductPeelingSpecs } from "@/lib/peeling/constants"
import { getProductConcernCodesForProfileSignals } from "@/lib/product-specs/concern-taxonomy"
import { SHAMPOO_BUCKET_LABELS } from "@/lib/shampoo/constants"
import {
  matchConditionerProducts,
  matchLeaveInProducts,
  matchOilProducts,
  matchShampooProducts,
  matchProducts,
  type MatchedProduct,
} from "@/lib/product-matching/matcher"
import {
  evaluateBondbuilderFit,
  evaluateConditionerFit,
  evaluateDeepCleansingShampooFit,
  evaluateDryShampooFit,
  evaluateLeaveInFit,
  evaluateMaskFit,
  evaluatePeelingFit,
  evaluateShampooFit,
  type BondbuilderFitSpec,
  type ConditionerFitSpec,
  type DeepCleansingShampooFitSpec,
  type DryShampooFitSpec,
  type LeaveInFitSpec,
  type MaskFitSpec,
  type PeelingFitSpec,
  type ShampooFitSpec,
} from "@/lib/recommendation-engine/categories"
import {
  buildRecommendationEngineRuntimeFromPersistence,
  type RecommendationEngineRuntime,
} from "@/lib/recommendation-engine/runtime"
import { buildRecommendationRequestContext } from "@/lib/recommendation-engine/request-context"
import type {
  BondbuilderCategoryDecision,
  CareBalanceRow,
  CategoryFitEvaluation,
  CategoryFitStatus,
  ConditionerCategoryDecision,
  DeepCleansingShampooCategoryDecision,
  DryShampooCategoryDecision,
  LeaveInCategoryDecision,
  MaskCategoryDecision,
  OilCategoryDecision,
  PeelingCategoryDecision,
  ShampooCategoryDecision,
} from "@/lib/recommendation-engine/types"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"

const DEEP_CLEANSING_RESET_INTENSITY_LABELS: Record<
  NonNullable<DeepCleansingShampooRecommendationMetadata["reset_intensity"]>,
  string
> = {
  gentle: "sanft",
  medium: "mittel",
  strong: "stark",
}

const SELECTION_LIMIT = 3
const CANDIDATE_COUNT = 10

type ScoredEngineProduct = MatchedProduct & {
  _engineScore: number
  _fitStatus?: CategoryFitStatus
}

interface ProductRelationshipRow {
  source_product_id: string
  target_product_id: string
  relationship_type: ProductRelationshipType
}

type RelatedProduct = ProductSummary & { similarity?: number; combined_score?: number }

export function isEligibleForPrimaryRecommendation(
  product: {
    is_active?: boolean | null
    lifecycle_status?: string | null
    is_chaarlie_recommended?: boolean | null
  },
  outgoingRelationshipTypes: ReadonlySet<ProductRelationshipType | string>,
): boolean {
  return (
    product.is_active !== false &&
    product.is_chaarlie_recommended !== false &&
    (product.lifecycle_status ?? "active") === "active" &&
    !outgoingRelationshipTypes.has("replaced_by") &&
    !outgoingRelationshipTypes.has("add_on_for")
  )
}

type ScoredConditionerProduct = ScoredEngineProduct & {
  _fitStatus: CategoryFitEvaluation["status"]
}

type ScoredShampooProduct = ScoredEngineProduct & {
  _fitStatus: CategoryFitEvaluation["status"]
}

type ScoredLeaveInProduct = ScoredEngineProduct & {
  _fitStatus: CategoryFitEvaluation["status"]
  _fitReasonCodes: string[]
}

type LeaveInSpecCandidateRow = ProductLeaveInSpecs & {
  products: Product | null
}

type ScoredMaskProduct = ScoredEngineProduct & {
  _fitStatus: CategoryFitEvaluation["status"]
  _fitReasonCodes: string[]
}

type ScoredDeepCleansingShampooProduct = ScoredEngineProduct & {
  _fitStatus: CategoryFitEvaluation["status"]
}

type LeaveInRerankSpec = ProductLeaveInSpecs

interface ProductShampooSpecRow extends ShampooFitSpec {
  product_id: string
  thickness: NonNullable<HairProfile["thickness"]>
}

interface ProductOilEligibilityRow {
  product_id: string
  thickness: NonNullable<HairProfile["thickness"]>
  oil_subtype: OilSubtype
  oil_purpose: OilPurpose | null
}

function toBaseScore(product: MatchedProduct): number {
  if (typeof product.combined_score === "number" && Number.isFinite(product.combined_score)) {
    return product.combined_score * 100
  }
  if (typeof product.similarity === "number" && Number.isFinite(product.similarity)) {
    return product.similarity * 100
  }
  return 0
}

function dedupeById(products: MatchedProduct[]): MatchedProduct[] {
  const byId = new Map<string, MatchedProduct>()

  for (const product of products) {
    const current = byId.get(product.id)
    if (!current) {
      byId.set(product.id, product)
      continue
    }

    if (toBaseScore(product) > toBaseScore(current)) {
      byId.set(product.id, product)
    }
  }

  return [...byId.values()]
}

function fitStatusAdjustment(fit: CategoryFitEvaluation["status"]): number {
  switch (fit) {
    case "ideal":
      return 28
    case "supportive":
      return 14
    case "unknown":
      return 2
    case "mismatch":
      return -20
    case "not_applicable":
      return -100
  }
}

function fitReasonAdjustment(fit: CategoryFitEvaluation): number {
  const exactMatches = fit.reasonCodes.filter((code) => code.includes("exact_match")).length
  const closeMatches = fit.reasonCodes.filter(
    (code) => code.includes("close_match") || code.includes("partial_match"),
  ).length
  const mismatches = fit.reasonCodes.filter((code) => code.includes("mismatch")).length

  return exactMatches * 4 + closeMatches * 2 - mismatches * 4 - fit.missingFields.length * 2
}

function compareScoredProducts(left: ScoredEngineProduct, right: ScoredEngineProduct): number {
  if (right._engineScore !== left._engineScore) {
    return right._engineScore - left._engineScore
  }

  const leftPrice = typeof left.price_eur === "number" ? left.price_eur : Number.MAX_SAFE_INTEGER
  const rightPrice = typeof right.price_eur === "number" ? right.price_eur : Number.MAX_SAFE_INTEGER
  return leftPrice - rightPrice
}

function getCareBalanceRow(
  runtime: RecommendationEngineRuntime | null | undefined,
  category: CareBalanceRow["category"],
): CareBalanceRow | null {
  return runtime?.careBalance.rows.find((row) => row.category === category) ?? null
}

function hasCareBalanceReason(row: CareBalanceRow | null, reasonCode: string): boolean {
  if (!row) return false
  return (
    row.decisiveReasonCodes.includes(reasonCode) ||
    row.contextReasonCodes.includes(reasonCode) ||
    row.selectionHints.some((hint) => hint.reasonCodes.includes(reasonCode))
  )
}

function appendCareBalanceMetaReason(
  reasons: string[],
  reason: string,
  position: "top_reason" | "tradeoff" = "top_reason",
): string[] {
  const next = position === "top_reason" ? [reason, ...reasons] : [...reasons, reason]
  return [...new Set(next)].slice(0, 3)
}

function stripScore<T extends ScoredEngineProduct>(products: T[]): MatchedProduct[] {
  return products.map((product) => {
    const clean = { ...product }
    Reflect.deleteProperty(clean, "_engineScore")
    Reflect.deleteProperty(clean, "_fitStatus")
    Reflect.deleteProperty(clean, "_fitReasonCodes")
    return clean
  })
}

function shampooSpecKey(
  productId: string,
  shampooBucket: ShampooFitSpec["shampoo_bucket"],
): string {
  return `${productId}:${shampooBucket ?? "unknown"}`
}

function mapShampooBucketToScalpRoute(
  bucket: ShampooFitSpec["shampoo_bucket"],
): NonNullable<ShampooRecommendationMetadata["matched_scalp_route"]> | null {
  switch (bucket) {
    case "dehydriert-fettig":
      return "oily"
    case "normal":
      return "balanced"
    case "trocken":
      return "dry"
    case "schuppen":
      return "dandruff"
    case "irritationen":
      return "irritated"
    default:
      return null
  }
}

function buildFitSummary(
  fit: CategoryFitEvaluation,
  idealText: string,
  supportText: string,
  unknownText: string,
  mismatchText: string,
): { positives: string[]; tradeoffs: string[] } {
  const positives: string[] = []
  const tradeoffs: string[] = []

  if (fit.status === "ideal") {
    positives.push(idealText)
  } else if (fit.status === "supportive") {
    positives.push(supportText)
  } else if (fit.status === "unknown") {
    tradeoffs.push(unknownText)
  } else if (fit.status === "mismatch") {
    tradeoffs.push(mismatchText)
  }

  if (fit.missingFields.length > 0) {
    tradeoffs.push("Ein Teil der strukturierten Produktdaten ist noch nicht gepflegt.")
  }

  return {
    positives: positives.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
  }
}

function buildShampooUsageHint(): string {
  return "Im ersten Waschgang auf die Kopfhaut geben, gründlich einmassieren und danach sauber ausspülen."
}

function markShampooFallback(product: ScoredShampooProduct): ScoredShampooProduct {
  const fallbackTradeoff =
    "Fallback: Dieser Treffer passt nicht exakt zum abgeleiteten Shampoo-Fokus und erscheint nur, weil der Katalog nicht genug sichere Treffer geliefert hat."
  const meta = product.recommendation_meta as ShampooRecommendationMetadata | null | undefined

  if (!meta || meta.category !== "shampoo") {
    return product
  }

  return {
    ...product,
    recommendation_meta: {
      ...meta,
      tradeoffs: [
        fallbackTradeoff,
        ...meta.tradeoffs.filter((tradeoff) => tradeoff !== fallbackTradeoff),
      ].slice(0, 3),
    },
  }
}

function markLeaveInFallback(product: ScoredLeaveInProduct): ScoredLeaveInProduct {
  const fallbackTradeoff =
    "Fallback: Dieser Treffer weicht beim Leave-in-Zielprofil ab und erscheint nur, weil der Katalog nicht genug sichere Treffer geliefert hat."
  const meta = product.recommendation_meta as LeaveInRecommendationMetadata | null | undefined

  if (!meta || meta.category !== "leave_in") {
    return product
  }

  return {
    ...product,
    recommendation_meta: {
      ...meta,
      tradeoffs: [
        fallbackTradeoff,
        ...meta.tradeoffs.filter((tradeoff) => tradeoff !== fallbackTradeoff),
      ].slice(0, 3),
    },
  }
}

function isLeaveInFallbackEligible(reasonCodes: readonly string[]): boolean {
  const hardMismatchCodes = new Set([
    "leave_in_thickness_mismatch",
    "leave_in_relationship_mismatch",
    "leave_in_high_heat_protection_mismatch",
    "leave_in_heat_activation_without_heat_mismatch",
    "leave_in_styling_prep_mismatch",
  ])

  return !reasonCodes.some((code) => hardMismatchCodes.has(code))
}

function isLeaveInFormatFallbackEligible(reasonCodes: readonly string[]): boolean {
  return isLeaveInFallbackEligible(reasonCodes)
}

function shouldPreferIntegratedLeaveInHeatBonus(
  target: LeaveInCategoryDecision["targetProfile"],
): boolean {
  return target?.heatProtectionNeed === "moderate" && target.hasSeparateHeatProtectant
}

function hasIntegratedLeaveInHeatBonus(product: ScoredLeaveInProduct): boolean {
  const meta = product.recommendation_meta as LeaveInRecommendationMetadata | null | undefined
  return meta?.provides_heat_protection === true
}

function prioritizeIntegratedLeaveInHeatBonus(
  products: ScoredLeaveInProduct[],
  target: LeaveInCategoryDecision["targetProfile"],
): ScoredLeaveInProduct[] {
  if (!shouldPreferIntegratedLeaveInHeatBonus(target)) return products

  const heatBonusIndex = products.findIndex(hasIntegratedLeaveInHeatBonus)
  if (heatBonusIndex <= 0) return products

  const heatBonusProduct = products[heatBonusIndex]
  if (!heatBonusProduct) return products

  return [
    heatBonusProduct,
    ...products.slice(0, heatBonusIndex),
    ...products.slice(heatBonusIndex + 1),
  ]
}

function shampooBucketPriorityAdjustment(
  decision: ShampooCategoryDecision,
  matchedBucket: NonNullable<ShampooCategoryDecision["targetProfile"]>["shampooBucket"] | null,
): number {
  if (!decision.targetProfile || !matchedBucket) return 0
  if (matchedBucket === decision.targetProfile.shampooBucket) return 12
  if (matchedBucket === decision.targetProfile.secondaryBucket) return -6
  return 0
}

function buildShampooTopReasons(
  decision: ShampooCategoryDecision,
  fit: CategoryFitEvaluation,
  matchedBucket: NonNullable<ShampooCategoryDecision["targetProfile"]>["shampooBucket"] | null,
): { positives: string[]; tradeoffs: string[] } {
  const positives: string[] = []
  const tradeoffs: string[] = []

  if (matchedBucket && matchedBucket === decision.targetProfile?.secondaryBucket) {
    positives.push(
      "Eignet sich als rotierender Alltagsshampoo-Fit neben dem priorisierten Kopfhaut-Fokus.",
    )
  } else if (matchedBucket) {
    positives.push(
      `Die Auswahl folgt dem aktuellen Kopfhaut-Fokus ${SHAMPOO_BUCKET_LABELS[matchedBucket].toLowerCase()}.`,
    )
  }

  if (fit.status === "supportive" || fit.status === "ideal") {
    positives.push(
      matchedBucket && matchedBucket === decision.targetProfile?.secondaryBucket
        ? "Ergänzt den Hauptfokus sinnvoll über die geplante Rotation."
        : "Passt zum eingeordneten Kopfhaut-Fokus.",
    )
  }

  if (fit.status === "unknown") {
    tradeoffs.push(
      "Die Shampoo-Spezifikation ist noch nicht vollständig genug für eine feinere Fit-Einstufung.",
    )
  }
  if (fit.status === "mismatch") {
    tradeoffs.push("Weicht vom aktuellen Kopfhaut-Fokus ab.")
  }
  if (
    fit.status === "supportive" &&
    fit.reasonCodes.some((reasonCode) => reasonCode.includes("cleansing_intensity_mismatch"))
  ) {
    tradeoffs.push(
      "Passt zum Kopfhaut-Fokus; die Reinigungsintensität ist nur ein Vergleichspunkt.",
    )
  }

  return {
    positives: positives.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
  }
}

function mapConditionerBalanceNeed(
  balance: ConditionerCategoryDecision["targetProfile"] extends infer T
    ? T extends { balance: infer B }
      ? B
      : never
    : never,
): ConditionerBalanceNeed | null {
  return balance
}

function buildConditionerUsageHint(decision: ConditionerCategoryDecision): string {
  if (decision.targetProfile?.repairLevel === "high") {
    return "In die Längen und Spitzen geben, 2-3 Minuten einwirken lassen und gründlich ausspülen."
  }

  return "In die Längen und Spitzen geben, kurz einarbeiten und gründlich ausspülen."
}

function markConditionerFallback(product: ScoredConditionerProduct): ScoredConditionerProduct {
  const meta = product.recommendation_meta as ConditionerRecommendationMetadata | null | undefined
  if (!meta || meta.category !== "conditioner") return product

  const fallbackTradeoff = buildConditionerFallbackTradeoff(meta)

  return {
    ...product,
    recommendation_meta: {
      ...meta,
      tradeoffs: [
        fallbackTradeoff,
        ...meta.tradeoffs.filter((tradeoff) => tradeoff !== fallbackTradeoff),
      ].slice(0, 3),
    },
  }
}

function buildConditionerFallbackTradeoff(meta: ConditionerRecommendationMetadata): string {
  if (meta.fit_status === "unknown") {
    return "Hinweis: Zu diesem Conditioner fehlen noch einzelne sichere Produktangaben. Er erscheint nur, weil nicht genug sehr sichere Treffer verfügbar sind."
  }

  return "Fallback: Dieser Conditioner weicht beim abgeleiteten Conditioner-Fit sichtbar ab und erscheint nur, weil nicht genug sichere Treffer verfügbar sind."
}

export function rerankConditionerProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductConditionerRerankSpecs[]
  decision: ConditionerCategoryDecision
  hairProfile: HairProfile | null
  runtime?: RecommendationEngineRuntime
}): MatchedProduct[] {
  const { candidates, specs, decision, hairProfile, runtime } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile
  const careBalanceRow = getCareBalanceRow(runtime, "conditioner")

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredConditionerProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fitSpec: ConditionerFitSpec | null = spec
      ? {
          ...spec,
          suitable_thicknesses: product.suitable_thicknesses.filter(
            (thickness): thickness is NonNullable<HairProfile["thickness"]> =>
              thickness === "fine" || thickness === "normal" || thickness === "coarse",
          ),
        }
      : null
    const fit = evaluateConditionerFit(decision, fitSpec)
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zu deinem aktuellen Balance-, Repair- und Gewichtsbedarf.",
      "Passt weitgehend zu deinem aktuellen Conditioner-Zielprofil.",
      "Die Conditioner-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
      "Weicht beim Conditioner-Zielprofil sichtbar von deinem Bedarf ab.",
    )
    const preferLightLoadFit = hasCareBalanceReason(careBalanceRow, "conditioner_load_pressure")
    const lightLoadBonus = preferLightLoadFit && spec?.weight === "light" ? 18 : 0
    const score =
      toBaseScore(product) +
      fitStatusAdjustment(fit.status) +
      fitReasonAdjustment(fit) +
      lightLoadBonus
    const careBalanceReason =
      lightLoadBonus > 0
        ? "CareBalance-Hinweis: leichter Conditioner-Fit gegen Volumen- oder Beschwerungsdruck."
        : null

    const recommendationMeta: ConditionerRecommendationMetadata = {
      category: "conditioner",
      score: Math.round(score * 10) / 10,
      top_reasons: [
        careBalanceReason,
        ...positives,
        target.balance
          ? `Fokus auf ${target.balance === "balanced" ? "ausgewogene Pflege" : target.balance === "moisture" ? "Feuchtigkeit" : "Protein"} passt zu deinem Profil.`
          : "Passt gut zu deinem aktuellen Conditioner-Bedarf.",
      ]
        .filter((reason): reason is string => Boolean(reason))
        .slice(0, 3),
      tradeoffs: hasCareBalanceReason(careBalanceRow, "conditioner_below_shampoo_cadence")
        ? appendCareBalanceMetaReason(
            tradeoffs,
            "CareBalance-Kontext: Conditioner-Frequenz bleibt side-by-side und nicht autoritativ.",
            "tradeoff",
          )
        : tradeoffs,
      usage_hint: buildConditionerUsageHint(decision),
      matched_profile: {
        thickness: hairProfile?.thickness ?? null,
        density: hairProfile?.density ?? null,
        protein_moisture_balance: hairProfile?.protein_moisture_balance ?? null,
        cuticle_condition: hairProfile?.cuticle_condition ?? null,
        chemical_treatment: hairProfile?.chemical_treatment ?? [],
      },
      matched_weight: target.weight,
      matched_repair_level: target.repairLevel,
      matched_balance_need: mapConditionerBalanceNeed(target.balance),
      fit_status: fit.status,
      product_weight: spec?.weight ?? null,
      product_repair_level: spec?.repair_level ?? null,
      product_balance_direction: mapConditionerBalanceNeed(spec?.balance_direction ?? null),
      active_damage_drivers: target.activeDamageDrivers,
    }

    return {
      ...product,
      conditioner_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
      _fitStatus: fit.status,
    }
  })

  scored.sort(compareScoredProducts)

  const acceptable = scored.filter(
    (product) => product._fitStatus !== "mismatch" && product._fitStatus !== "unknown",
  )
  if (acceptable.length >= SELECTION_LIMIT) {
    return stripScore(acceptable.slice(0, SELECTION_LIMIT))
  }

  const fallback = scored
    .filter((product) => product._fitStatus === "mismatch" || product._fitStatus === "unknown")
    .map(markConditionerFallback)

  return stripScore([...acceptable, ...fallback].slice(0, SELECTION_LIMIT))
}

export function rerankShampooProductsWithEngine(params: {
  candidates: MatchedProduct[]
  decision: ShampooCategoryDecision
  hairProfile: HairProfile | null
  bucketByProductId?: Map<
    string,
    NonNullable<ShampooCategoryDecision["targetProfile"]>["shampooBucket"]
  >
  specs?: ProductShampooSpecRow[]
}): MatchedProduct[] {
  const { candidates, decision, hairProfile, bucketByProductId, specs = [] } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const targetProfile = decision.targetProfile
  const specsByKey = new Map(
    specs.map((spec) => [shampooSpecKey(spec.product_id, spec.shampoo_bucket), spec] as const),
  )

  const scored: ScoredShampooProduct[] = candidates.map((product) => {
    const matchedBucket = bucketByProductId?.get(product.id) ?? null
    const spec =
      specsByKey.get(shampooSpecKey(product.id, matchedBucket ?? targetProfile.shampooBucket)) ??
      null
    const fit = evaluateShampooFit(
      decision,
      spec ?? {
        shampoo_bucket: matchedBucket,
        scalp_route: matchedBucket ? null : targetProfile.scalpRoute,
        cleansing_intensity: null,
      },
    )
    const { positives, tradeoffs } = buildShampooTopReasons(decision, fit, matchedBucket)
    const score =
      toBaseScore(product) +
      fitStatusAdjustment(fit.status) +
      fitReasonAdjustment(fit) +
      shampooBucketPriorityAdjustment(decision, matchedBucket)

    const recommendationMeta: ShampooRecommendationMetadata = {
      category: "shampoo",
      score: Math.round(score * 10) / 10,
      top_reasons: positives,
      tradeoffs,
      usage_hint: buildShampooUsageHint(),
      matched_profile: {
        thickness: hairProfile?.thickness ?? null,
        scalp_type: hairProfile?.scalp_type ?? null,
        scalp_condition: hairProfile?.scalp_condition ?? null,
      },
      matched_bucket: matchedBucket ?? targetProfile.shampooBucket,
      matched_concern_code: matchedBucket ?? targetProfile.shampooBucket,
      fit_status: fit.status,
      matched_scalp_route:
        spec?.scalp_route ??
        mapShampooBucketToScalpRoute(matchedBucket ?? targetProfile.shampooBucket),
      cleansing_intensity: spec?.cleansing_intensity ?? null,
    }

    return {
      ...product,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
      _fitStatus: fit.status,
    }
  })

  scored.sort(compareScoredProducts)

  const acceptable = scored.filter((product) => product._fitStatus !== "mismatch")
  if (acceptable.length >= SELECTION_LIMIT) {
    return stripScore(acceptable.slice(0, SELECTION_LIMIT))
  }

  const mismatches = scored
    .filter((product) => product._fitStatus === "mismatch")
    .map(markShampooFallback)

  return stripScore([...acceptable, ...mismatches].slice(0, SELECTION_LIMIT))
}

function buildOilUsageHint(decision: OilCategoryDecision): string {
  if (decision.targetProfile?.purpose === "pre_wash_oiling") {
    if (decision.targetProfile.adjunctScalpSupport) {
      return "Vor dem Waschen sparsam auf trockene Kopfhaut und Längen geben, 30-45 Minuten einwirken lassen und anschließend auswaschen. Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primäre Hebel."
    }

    return "Vor dem Waschen sparsam auf trockene Kopfhaut und/oder Längen geben, 30-45 Minuten einwirken lassen und anschließend auswaschen."
  }

  if (decision.targetProfile?.purpose === "light_finish") {
    return "Sehr sparsam in trockene Längen und Spitzen geben, damit das Haar leicht bleibt und nicht fettig wirkt."
  }

  return "Sparsam als Finish in trockene oder fast trockene Längen und Spitzen geben, um Frizz zu bändigen und Glanz zu geben."
}

function buildOilTopReasons(
  decision: OilCategoryDecision,
  params?: {
    exactPurposeMatch: boolean
    finishBridgeMatch: boolean
    classicSubtypeMatch: boolean
  },
): { positives: string[]; tradeoffs: string[] } {
  const positives: string[] = []
  const tradeoffs: string[] = []

  if (decision.targetProfile?.purpose) {
    positives.push(
      `Die Auswahl folgt dem angefragten Zweck ${OIL_PURPOSE_LABELS[decision.targetProfile.purpose].toLowerCase()}.`,
    )
  }

  if (decision.targetProfile?.adjunctScalpSupport) {
    tradeoffs.push(
      "Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primäre Hebel.",
    )
  }

  if (params?.exactPurposeMatch) {
    positives.push("Der hinterlegte Öl-Zweck passt auch in der Katalogpflege exakt zur Anfrage.")
  } else if (params?.finishBridgeMatch) {
    tradeoffs.push(
      "Der Fit kommt über die angrenzende Finish-Rolle, nicht über einen exakten Öl-Zweck-Match.",
    )
  } else if (params?.classicSubtypeMatch) {
    tradeoffs.push(
      "Der Katalogfit kommt über den klassischen Öl-Subtyp; ein eigener Öl-Zweck ist für diesen Treffer noch nicht hinterlegt.",
    )
  }

  return {
    positives: positives.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
  }
}

function getFinishBridgePurpose(purpose: OilPurpose | null): OilPurpose | null {
  if (purpose === "styling_finish") return "light_finish"
  if (purpose === "light_finish") return "styling_finish"
  return null
}

export function rerankOilProductsWithEngine(params: {
  candidates: MatchedProduct[]
  decision: OilCategoryDecision
  hairProfile: HairProfile | null
  eligibilityRows?: ProductOilEligibilityRow[]
  runtime?: RecommendationEngineRuntime
}): MatchedProduct[] {
  const { candidates, decision, hairProfile, eligibilityRows = [], runtime } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const targetProfile = decision.targetProfile
  const careBalanceRow = getCareBalanceRow(runtime, "oil")
  const preferLightOil = hasCareBalanceReason(careBalanceRow, "daily_oil_use")
  const bridgePurpose = getFinishBridgePurpose(targetProfile.purpose)
  const eligibilityByProductId = new Map<string, ProductOilEligibilityRow[]>()

  for (const row of eligibilityRows) {
    eligibilityByProductId.set(row.product_id, [
      ...(eligibilityByProductId.get(row.product_id) ?? []),
      row,
    ])
  }

  const exactPurposeProductIds = new Set(
    eligibilityRows
      .filter((row) => row.oil_purpose === targetProfile.purpose)
      .map((row) => row.product_id),
  )
  const finishBridgeProductIds = new Set(
    eligibilityRows
      .filter((row) => bridgePurpose !== null && row.oil_purpose === bridgePurpose)
      .map((row) => row.product_id),
  )
  const classicSubtypeProductIds = new Set(
    eligibilityRows
      .filter((row) => row.oil_purpose === null && row.oil_subtype === targetProfile.matcherSubtype)
      .map((row) => row.product_id),
  )
  const eligibleCandidates =
    eligibilityRows.length === 0
      ? candidates
      : exactPurposeProductIds.size >= SELECTION_LIMIT
        ? candidates.filter((product) => exactPurposeProductIds.has(product.id))
        : candidates.filter(
            (product) =>
              exactPurposeProductIds.has(product.id) ||
              finishBridgeProductIds.has(product.id) ||
              classicSubtypeProductIds.has(product.id),
          )

  const scored: ScoredEngineProduct[] = eligibleCandidates.map((product) => {
    const productEligibility = eligibilityByProductId.get(product.id) ?? []
    const exactPurposeMatch = productEligibility.some(
      (row) => row.oil_purpose === targetProfile.purpose,
    )
    const finishBridgeMatch = productEligibility.some(
      (row) => bridgePurpose !== null && row.oil_purpose === bridgePurpose,
    )
    const classicSubtypeMatch = productEligibility.some(
      (row) => row.oil_purpose === null && row.oil_subtype === targetProfile.matcherSubtype,
    )
    const lightOilFit = productEligibility.some(
      (row) => row.oil_purpose === "light_finish" || row.oil_subtype === "trocken-oel",
    )
    const { positives, tradeoffs } = buildOilTopReasons(decision, {
      exactPurposeMatch,
      finishBridgeMatch,
      classicSubtypeMatch,
    })
    const careBalanceBonus = preferLightOil && lightOilFit ? 64 : 0
    const score =
      toBaseScore(product) +
      (exactPurposeMatch
        ? 28
        : finishBridgeMatch
          ? -8
          : classicSubtypeMatch
            ? -8
            : productEligibility.length > 0
              ? -30
              : 0) +
      careBalanceBonus
    const careBalanceReason =
      careBalanceBonus > 0
        ? "care_balance daily_oil_use: bei täglichem Öl oder Build-up-Druck leichter, nicht schwerer Öl-Fit."
        : null

    const recommendationMeta: OilRecommendationMetadata = {
      category: "oil",
      score: Math.round(score * 10) / 10,
      top_reasons:
        positives.length > 0 || careBalanceReason
          ? [...new Set([careBalanceReason, ...positives].filter(Boolean) as string[])].slice(0, 3)
          : [
              targetProfile.purpose
                ? `Die Auswahl folgt dem Öl-Zweck ${OIL_PURPOSE_LABELS[targetProfile.purpose].toLowerCase()}.`
                : "Passt zum aktuellen Öl-Zweck.",
            ],
      tradeoffs,
      usage_hint: buildOilUsageHint(decision),
      matched_profile: {
        thickness: hairProfile?.thickness ?? null,
      },
      matched_subtype: targetProfile.matcherSubtype,
      use_mode: targetProfile.purpose,
      adjunct_scalp_support: targetProfile.adjunctScalpSupport,
      fit_status: exactPurposeMatch
        ? "ideal"
        : finishBridgeMatch || classicSubtypeMatch
          ? "supportive"
          : "unknown",
      purpose_fit: exactPurposeMatch ? "exact" : finishBridgeMatch ? "bridge" : "unknown",
      scalp_caution: targetProfile.scalpCaution,
      density_weight_caution: targetProfile.densityWeightCaution,
      overload_caution: targetProfile.overloadRisk,
    }

    return {
      ...product,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
}

export function rerankBondbuilderProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductBondbuilderSpecs[]
  decision: BondbuilderCategoryDecision
  message?: string
  outgoingRelationshipsByProductId?: Map<string, ProductRelationshipRow[]>
  incomingRelationshipsByProductId?: Map<string, ProductRelationshipRow[]>
  relatedProductsById?: Map<string, RelatedProduct>
}): MatchedProduct[] {
  const {
    candidates,
    specs,
    decision,
    message = "",
    outgoingRelationshipsByProductId = new Map<string, ProductRelationshipRow[]>(),
    incomingRelationshipsByProductId = new Map<string, ProductRelationshipRow[]>(),
    relatedProductsById = new Map<string, RelatedProduct>(),
  } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const requestedBrands = deriveRequestedBondbuilderBrands(message)
  const eligibleCandidates = candidates.filter((product) => {
    const outgoingRelationshipTypes: Set<ProductRelationshipType> = new Set(
      (outgoingRelationshipsByProductId.get(product.id) ?? []).map(
        (relationship) => relationship.relationship_type,
      ),
    )
    return isEligibleForPrimaryRecommendation(product, outgoingRelationshipTypes)
  })
  const requestedBrandCandidates =
    requestedBrands.length > 0
      ? eligibleCandidates.filter((product) =>
          matchesRequestedBondbuilderBrand(product, requestedBrands),
        )
      : []
  const primaryCandidates =
    requestedBrandCandidates.length > 0 ? requestedBrandCandidates : eligibleCandidates

  const scored: Array<ScoredEngineProduct & { _bondRepairAxis: string | null }> =
    primaryCandidates.map((product) => {
      const spec = specsByProductId.get(product.id) ?? null
      const fit = evaluateBondbuilderFit(decision, spec as BondbuilderFitSpec | null)
      const { positives, tradeoffs } = buildFitSummary(
        fit,
        "Passt sehr gut zur benötigten Bondbuilding-Intensität.",
        "Passt weitgehend zum aktuellen Bondbuilding-Bedarf.",
        "Die Bondbuilder-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
        "Weicht bei der Intensität zu deutlich vom aktuellen Bondbuilding-Bedarf ab.",
      )
      const score =
        toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)
      const laneScore =
        spec?.bond_repair_axis === "disulfide_crosslink" && target.chemicalCrosslinkLane
          ? 7
          : spec?.bond_repair_axis === "peptide_chain" && target.peptideChainLane
            ? 7
            : 0
      const adjustedScore = score + laneScore
      const attachedAddOns = (incomingRelationshipsByProductId.get(product.id) ?? [])
        .filter((relationship) => relationship.relationship_type === "add_on_for")
        .map((relationship) => {
          const addOn = relatedProductsById.get(relationship.source_product_id)
          const addOnSpec = specsByProductId.get(relationship.source_product_id)
          if (!addOn) return null

          return {
            relationship_type: "add_on_for" as const,
            product_id: addOn.id,
            name: addOn.name,
            usage_protocol: addOnSpec?.usage_protocol ?? null,
            reason: "Optionaler Booster für sehr starke Schädigung vor No.3PLUS.",
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))

      const recommendationMeta: BondbuilderRecommendationMetadata = {
        category: "bondbuilder",
        score: Math.round(adjustedScore * 10) / 10,
        top_reasons: [
          ...positives,
          target.bondRepairIntensity === "intensive"
            ? "Unterstützt aktuell eher intensiven strukturellen Reparaturbedarf."
            : "Passt für eher konservative Bondbuilding-Unterstützung.",
        ].slice(0, 3),
        tradeoffs,
        usage_hint: getBondbuilderUsageHint(spec?.usage_protocol),
        matched_intensity: target.bondRepairIntensity,
        application_mode: target.applicationMode,
        bond_repair_axis: spec?.bond_repair_axis ?? null,
        treatment_mode: spec?.treatment_mode ?? null,
        product_format: spec?.product_format ?? null,
        usage_protocol: spec?.usage_protocol ?? null,
        lifecycle_status: product.lifecycle_status ?? "active",
        attached_add_ons:
          target.mixedOrSevereCombo && attachedAddOns.length > 0 ? attachedAddOns : undefined,
      }

      return {
        ...product,
        bondbuilder_specs: spec,
        recommendation_meta: recommendationMeta,
        _engineScore: adjustedScore,
        _bondRepairAxis: spec?.bond_repair_axis ?? null,
      }
    })

  scored.sort(compareScoredProducts)
  const limit = target.mixedOrSevereCombo ? SELECTION_LIMIT : 2
  const selected: typeof scored = []

  if (!target.mixedOrSevereCombo && target.chemicalCrosslinkLane && target.peptideChainLane) {
    const crosslink = scored.find((product) => product._bondRepairAxis === "disulfide_crosslink")
    const peptide = scored.find((product) => product._bondRepairAxis === "peptide_chain")
    if (crosslink) selected.push(crosslink)
    if (peptide && peptide.id !== crosslink?.id) selected.push(peptide)
  }

  for (const product of scored) {
    if (selected.some((selectedProduct) => selectedProduct.id === product.id)) continue
    selected.push(product)
    if (selected.length >= limit) break
  }

  return stripScore(selected).slice(0, limit)
}

type RequestedBondbuilderBrand = "k18" | "olaplex" | "epres"

function deriveRequestedBondbuilderBrands(message: string): RequestedBondbuilderBrand[] {
  const normalized = message.toLowerCase()
  const brands: RequestedBondbuilderBrand[] = []
  const addBrand = (brand: RequestedBondbuilderBrand) => {
    if (!brands.includes(brand)) brands.push(brand)
  }

  if (/\bk18\b|\bkr18\b/.test(normalized)) addBrand("k18")
  if (/\bolaplex\b/.test(normalized)) addBrand("olaplex")
  if (/\bepres\b/.test(normalized)) addBrand("epres")

  return brands
}

function matchesRequestedBondbuilderBrand(
  product: MatchedProduct,
  requestedBrands: readonly RequestedBondbuilderBrand[],
): boolean {
  const text = `${product.brand ?? ""} ${product.name}`.toLowerCase()
  return requestedBrands.some((brand) => text.includes(brand))
}

function buildDeepCleansingShampooUsageHint(): string {
  return "An Reset-Waschtagen statt des normalen Shampoos auf Kopfhaut/Ansatz nutzen, gründlich ausspülen und danach Conditioner in die Längen geben. Etwa alle 5-6 Wäschen, nicht bei jeder Wäsche."
}

function buildDeepCleansingTopReasons(params: {
  decision: DeepCleansingShampooCategoryDecision
  fit: CategoryFitEvaluation
  spec: ProductDeepCleansingShampooSpecs | null
}): { positives: string[]; tradeoffs: string[] } {
  const { decision, fit, spec } = params
  const positives: string[] = []
  const tradeoffs: string[] = []

  if (fit.status === "mismatch") {
    tradeoffs.push("Kein sicherer Match für den angefragten Reset-Fokus oder Farbschutz.")
  } else if (spec?.reset_focus === "metal_mineral_hard_water") {
    positives.push("Strukturiert für Kalk-, Mineral- oder Chlor-Kontext gepflegt.")
  } else if (spec?.reset_focus === "broad_spectrum_detox") {
    positives.push("Strukturiert als breiter Reset für Styling-/Pflegeaufbau plus Mineral-Kontext.")
  } else if (spec?.reset_focus === "product_sebum_buildup") {
    positives.push("Strukturiert für allgemeinen Produktaufbau und beschwertes Haar gepflegt.")
  } else {
    positives.push("Passt als gelegentlicher Reset bei Produktaufbau oder beschwertem Haar.")
  }

  if (spec?.reset_intensity) {
    positives.push(
      `Reset-Intensität: ${DEEP_CLEANSING_RESET_INTENSITY_LABELS[spec.reset_intensity]}.`,
    )
  }

  if (fit.status === "ideal") {
    positives.push("Die strukturierten Reset-Daten passen sehr gut zur Anfrage.")
  } else if (fit.status === "supportive") {
    positives.push("Die strukturierten Reset-Daten passen mit kleinen Caveats zur Anfrage.")
  } else if (fit.status === "unknown") {
    tradeoffs.push("Die Tiefenreinigungs-Spezifikation ist noch nicht vollständig gepflegt.")
  } else if (fit.status === "mismatch") {
    tradeoffs.push("Weicht beim Reset-Fokus oder bei Farbschutz-Anforderungen ab.")
  }

  if (decision.targetProfile?.colorTreatedCaution) {
    tradeoffs.push(
      "Bei gefärbtem oder blondiertem Haar konservativ dosieren und seltener einsetzen.",
    )
  }
  if (decision.targetProfile?.cautionFlags.includes("sensitive_or_irritated_scalp")) {
    tradeoffs.push("Nicht als Behandlung für gereizte Kopfhaut, Juckreiz oder Schuppen einordnen.")
  }
  if (decision.targetProfile?.colorSafeRequest && spec?.color_treated_suitability !== "suitable") {
    tradeoffs.push("Farbschonung ist für dieses Produkt nicht strukturiert belegt.")
  }

  return {
    positives: positives.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
  }
}

export function rerankDeepCleansingShampooProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductDeepCleansingShampooSpecs[]
  decision: DeepCleansingShampooCategoryDecision
  runtime?: RecommendationEngineRuntime
}): MatchedProduct[] {
  const { candidates, specs, decision, runtime } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile
  const careBalanceRow = getCareBalanceRow(runtime, "deep_cleansing_shampoo")
  const preferGentleReset = hasCareBalanceReason(careBalanceRow, "deep_cleansing_vulnerability")

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredDeepCleansingShampooProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateDeepCleansingShampooFit(
      decision,
      spec as DeepCleansingShampooFitSpec | null,
    )
    const { positives, tradeoffs } = buildDeepCleansingTopReasons({ decision, fit, spec })
    const careBalanceBonus =
      preferGentleReset && spec?.reset_intensity === "gentle"
        ? 40
        : preferGentleReset && spec?.color_treated_suitability === "suitable"
          ? 28
          : 0
    const score =
      toBaseScore(product) +
      fitStatusAdjustment(fit.status) +
      fitReasonAdjustment(fit) +
      (spec?.reset_focus === target.resetFocus
        ? 20
        : spec?.reset_focus === "broad_spectrum_detox"
          ? 10
          : 0) +
      (spec?.reset_intensity === target.targetIntensity ? 10 : 0) +
      (spec?.scalp_type_focus === target.scalpTypeFocus ? 16 : 0) +
      (target.colorSafeRequest && spec?.color_treated_suitability === "suitable" ? 12 : 0) +
      careBalanceBonus
    const careBalanceReason =
      careBalanceBonus > 0
        ? "CareBalance-Hinweis: vulnerable Reset-Nutzung, daher sanfter oder farbsicherer Reset-Fit bevorzugt."
        : null

    const recommendationMeta: DeepCleansingShampooRecommendationMetadata = {
      category: "deep_cleansing_shampoo",
      score: Math.round(score * 10) / 10,
      top_reasons: careBalanceReason
        ? appendCareBalanceMetaReason(positives, careBalanceReason)
        : positives.slice(0, 3),
      tradeoffs,
      usage_hint: buildDeepCleansingShampooUsageHint(),
      scalp_type_focus: target.scalpTypeFocus,
      reset_need_level: target.resetNeedLevel,
      reset_focus: spec?.reset_focus ?? target.resetFocus,
      reset_intensity: spec?.reset_intensity ?? target.targetIntensity,
      color_treated_suitability: spec?.color_treated_suitability ?? null,
      fit_status: fit.status,
      caution_flags: target.cautionFlags,
    }

    return {
      ...product,
      deep_cleansing_shampoo_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
      _fitStatus: fit.status,
    }
  })

  scored.sort(compareScoredProducts)

  const acceptable = scored.filter((product) => product._fitStatus !== "mismatch")
  const strictRequest =
    target.resetFocus === "metal_mineral_hard_water" ||
    target.resetFocus === "broad_spectrum_detox" ||
    target.colorSafeRequest

  if (acceptable.length > 0) {
    return stripScore(acceptable.slice(0, SELECTION_LIMIT))
  }

  if (strictRequest) {
    return []
  }

  return stripScore(scored).slice(0, SELECTION_LIMIT)
}

function buildDryShampooUsageHint(): string {
  return "Nur als kurze Between-Wash-Brücke am Ansatz verwenden, später auswaschen und nicht als Ersatz für Shampoo/Wasser nutzen."
}

export function rerankDryShampooProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductDryShampooSpecs[]
  decision: DryShampooCategoryDecision
}): MatchedProduct[] {
  const { candidates, specs, decision } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateDryShampooFit(decision, spec as DryShampooFitSpec | null)
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zur Notfall-/Between-Wash-Brücke.",
      "Passt weitgehend zum kurzen Ansatz-Refresh.",
      "Die Trockenshampoo-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
      "Weicht bei Effekt, Farbfit, Sensitivität oder Format zu deutlich vom Bedarf ab.",
    )
    const score =
      toBaseScore(product) +
      fitStatusAdjustment(fit.status) +
      fitReasonAdjustment(fit) +
      (spec?.primary_effect === target.primaryEffectTarget ? 16 : 0) +
      (spec?.hair_color_fit === target.hairColorFitTarget ? 12 : 0) +
      (spec?.hair_color_fit === "universal" ? 6 : 0) +
      (target.requiresSensitiveFit && spec?.scalp_sensitivity_fit === "sensitive_ok" ? 14 : 0) +
      (target.preferredFormat && spec?.format === target.preferredFormat ? 10 : 0)

    const recommendationMeta: DryShampooRecommendationMetadata = {
      category: "dry_shampoo",
      score: Math.round(score * 10) / 10,
      top_reasons: positives.slice(0, 3),
      tradeoffs,
      usage_hint: buildDryShampooUsageHint(),
      primary_effect: spec?.primary_effect ?? target.primaryEffectTarget,
      hair_color_fit: spec?.hair_color_fit ?? target.hairColorFitTarget,
      scalp_sensitivity_fit: spec?.scalp_sensitivity_fit ?? null,
      format: spec?.format ?? target.preferredFormat,
      fit_status: fit.status,
    }

    return {
      ...product,
      dry_shampoo_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
      _fitStatus: fit.status,
    }
  })

  scored.sort(compareScoredProducts)
  const acceptable = scored.filter((product) => product._fitStatus !== "mismatch")
  return stripScore(acceptable).slice(0, SELECTION_LIMIT)
}

function buildPeelingUsageHint(decision: PeelingCategoryDecision): string {
  if (decision.targetProfile?.peelingType === "physical_scrub") {
    return "Als gelegentliches Kopfhaut-Reset vorsichtig verwenden und bei Sensibilität oder Trockenheit lieber seltener einsetzen."
  }

  return "Als sanfteres Kopfhaut-Peeling gemäß Produktanleitung einsetzen und die Frequenz bewusst konservativ halten."
}

export function rerankPeelingProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductPeelingSpecs[]
  decision: PeelingCategoryDecision
}): MatchedProduct[] {
  const { candidates, specs, decision } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluatePeelingFit(decision, spec as PeelingFitSpec | null)
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zum aktuellen Kopfhaut-Fokus und Peeling-Typ.",
      "Passt weitgehend zum aktuellen Kopfhaut-Reset-Bedarf.",
      "Die Peeling-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
      "Weicht bei Kopfhaut-Fokus oder Peeling-Typ zu deutlich vom aktuellen Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

    const recommendationMeta: PeelingRecommendationMetadata = {
      category: "peeling",
      score: Math.round(score * 10) / 10,
      top_reasons: positives.slice(0, 3),
      tradeoffs,
      usage_hint: buildPeelingUsageHint(decision),
      scalp_type_focus: target.scalpTypeFocus,
      peeling_type: target.peelingType,
    }

    return {
      ...product,
      peeling_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
}

function mapEngineLeaveInNeedToLegacy(
  need: LeaveInCategoryDecision["targetProfile"] extends infer T
    ? T extends { needBucket: infer B }
      ? B
      : never
    : never,
): LeaveInNeedBucket | null {
  switch (need) {
    case "heat_protect":
      return "heat_protect"
    case "curl_definition":
      return "curl_definition"
    case "repair":
      return "repair"
    case "detangle_smooth":
      return "moisture_anti_frizz"
    default:
      return null
  }
}

function buildLeaveInUsageHint(decision: LeaveInCategoryDecision): string {
  if (decision.targetProfile?.stylingContext === "heat_style") {
    return "Sparsam ins handtuchtrockene Haar geben und vor dem Föhnen oder Hitzestyling gleichmäßig verteilen."
  }

  if (decision.targetProfile?.conditionerRelationship === "replacement_capable") {
    return "Nach dem Waschen sparsam in die Längen geben; bei feinem Haar kann es je nach Produkt auch den Conditioner ersetzen."
  }

  return "Nach dem Conditioner sparsam in die Längen und Spitzen geben und als zusätzlichen Booster nutzen."
}

function productToLeaveInSpecCandidate(product: Product | null): MatchedProduct | null {
  if (!product || product.is_active === false) return null

  return {
    ...product,
    similarity: 0,
    combined_score: 0,
  }
}

async function loadLeaveInSpecDrivenCandidates(params: {
  supabase: ReturnType<typeof createAdminClient>
  decision: LeaveInCategoryDecision
}): Promise<MatchedProduct[]> {
  const targetThickness = params.decision.targetProfile?.thickness
  if (!targetThickness) return []

  const { data, error } = await params.supabase
    .from("product_leave_in_specs")
    .select("*, products:product_id(*)")

  if (error) {
    console.error("Failed to load leave-in spec candidates:", error)
    return []
  }

  return ((data ?? []) as LeaveInSpecCandidateRow[]).flatMap((row) => {
    const product = productToLeaveInSpecCandidate(row.products)
    if (!product) return []
    if (!product.suitable_thicknesses.includes(targetThickness)) return []
    return [product]
  })
}

function deriveLeaveInSpecConditionerRelationship(
  spec: LeaveInRerankSpec | null,
): LeaveInConditionerRelationship | null {
  if (!spec) return null
  return spec.roles.includes("replacement_conditioner") ? "replacement_capable" : "booster_only"
}

function deriveLeaveInProductBalanceDirection(
  spec: LeaveInRerankSpec | null,
): "moisture" | "protein" | "balanced" | null {
  if (!spec) return null
  const benefits = new Set(spec.care_benefits)
  const proteinSignals = benefits.has("protein")
  const moistureSignals =
    benefits.has("moisture") ||
    benefits.has("anti_frizz") ||
    benefits.has("detangling") ||
    benefits.has("shine")

  if (proteinSignals && !moistureSignals) return "protein"
  if (moistureSignals && !proteinSignals && !benefits.has("repair")) return "moisture"
  return "balanced"
}

export function rerankLeaveInProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: LeaveInRerankSpec[]
  decision: LeaveInCategoryDecision
  hairProfile: HairProfile | null
  requestedFormats?: readonly LeaveInFormat[]
  runtime?: RecommendationEngineRuntime
}): MatchedProduct[] {
  const { candidates, specs, decision, hairProfile, requestedFormats = [], runtime } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile
  const careBalanceHeatRow = getCareBalanceRow(runtime, "heat_protectant")
  const preferStrongHeatProtection =
    hasCareBalanceReason(careBalanceHeatRow, "heat_protectant_missing") ||
    hasCareBalanceReason(careBalanceHeatRow, "heat_protectant_below_heat_cadence")

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredLeaveInProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fitSpec: LeaveInFitSpec | null = spec
      ? {
          ...spec,
          suitable_thicknesses: product.suitable_thicknesses.filter(
            (thickness): thickness is NonNullable<HairProfile["thickness"]> =>
              thickness === "fine" || thickness === "normal" || thickness === "coarse",
          ),
        }
      : null
    const fit = evaluateLeaveInFit(decision, fitSpec)
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zu deinem Leave-in-Zielprofil inklusive Nutzen, Beziehung zum Conditioner und Gewicht.",
      "Passt in großen Teilen zu deinem Leave-in-Zielprofil.",
      "Die Leave-in-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
      "Weicht bei Nutzen, Hitzeschutz oder Conditioner-Rolle zu deutlich von deinem Bedarf ab.",
    )
    const strongHeatBonus =
      preferStrongHeatProtection &&
      spec?.provides_heat_protection &&
      (spec.heat_protection_max_c ?? 0) >= 220
        ? 24
        : 0
    const score =
      toBaseScore(product) +
      fitStatusAdjustment(fit.status) +
      fitReasonAdjustment(fit) +
      strongHeatBonus
    const integratedHeatBonusReason =
      shouldPreferIntegratedLeaveInHeatBonus(target) && spec?.provides_heat_protection
        ? "Kann ein Produkt weniger in der Routine bedeuten: Leave-in-Pflege plus Föhnhitzeschutz in einem Produkt."
        : null
    const careBalanceHeatReason =
      strongHeatBonus > 0
        ? `CareBalance-Hinweis: stärkerer Hitzeschutz-Fit (${spec?.heat_protection_max_c} C) bei hoher oder kumulativer Hitze.`
        : null

    const recommendationMeta: LeaveInRecommendationMetadata = {
      category: "leave_in",
      score: Math.round(score * 10) / 10,
      top_reasons: [
        careBalanceHeatReason,
        ...positives,
        integratedHeatBonusReason,
        target.needBucket === "heat_protect"
          ? "Bringt den für dein Styling benötigten Hitzeschutz-Fokus mit."
          : "Passt gut zu deinem aktuellen Leave-in-Bedarf.",
      ]
        .filter((reason): reason is string => Boolean(reason))
        .slice(0, 3),
      tradeoffs,
      usage_hint: buildLeaveInUsageHint(decision),
      matched_profile: {
        hair_texture: hairProfile?.hair_texture ?? null,
        thickness: hairProfile?.thickness ?? null,
        density: hairProfile?.density ?? null,
        cuticle_condition: hairProfile?.cuticle_condition ?? null,
        chemical_treatment: hairProfile?.chemical_treatment ?? [],
      },
      need_bucket: mapEngineLeaveInNeedToLegacy(target.needBucket),
      styling_context: target.stylingContext,
      conditioner_relationship: deriveLeaveInSpecConditionerRelationship(spec),
      matched_weight: target.weight,
      fit_status: fit.status,
      product_format: spec?.format ?? null,
      product_weight: spec?.weight ?? null,
      product_roles: spec?.roles ?? [],
      product_care_benefits: spec?.care_benefits ?? [],
      provides_heat_protection: spec?.provides_heat_protection ?? null,
      product_application_stage: spec?.application_stage ?? [],
      heat_protection_need: target.heatProtectionNeed,
      styling_prep_need: target.stylingPrepNeed,
      product_balance_direction: deriveLeaveInProductBalanceDirection(spec),
    }

    return {
      ...product,
      leave_in_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
      _fitStatus: fit.status,
      _fitReasonCodes: fit.reasonCodes,
    }
  })

  scored.sort(compareScoredProducts)

  const acceptable = prioritizeIntegratedLeaveInHeatBonus(
    scored.filter(
      (product) => product._fitStatus !== "mismatch" && product._fitStatus !== "unknown",
    ),
    target,
  )
  const formatPicks = selectRequestedLeaveInFormatPicks(scored, requestedFormats)
  if (formatPicks.length > 0) {
    const selected = [...formatPicks]
    const seen = new Set(selected.map((product) => product.id))
    const fallback = scored
      .filter(
        (product) =>
          product._fitStatus === "mismatch" && isLeaveInFallbackEligible(product._fitReasonCodes),
      )
      .map(markLeaveInFallback)

    for (const product of [...acceptable, ...fallback]) {
      if (seen.has(product.id)) continue
      selected.push(product)
      seen.add(product.id)
      if (selected.length >= SELECTION_LIMIT) break
    }

    return stripScore(selected.slice(0, SELECTION_LIMIT))
  }

  if (acceptable.length >= SELECTION_LIMIT) {
    return stripScore(acceptable.slice(0, SELECTION_LIMIT))
  }

  const fallback = scored
    .filter(
      (product) =>
        product._fitStatus === "mismatch" && isLeaveInFallbackEligible(product._fitReasonCodes),
    )
    .map(markLeaveInFallback)

  return stripScore([...acceptable, ...fallback].slice(0, SELECTION_LIMIT))
}

function selectRequestedLeaveInFormatPicks(
  scored: ScoredLeaveInProduct[],
  requestedFormats: readonly LeaveInFormat[],
): ScoredLeaveInProduct[] {
  const formats = Array.from(new Set(requestedFormats))
  if (formats.length === 0) return []

  const selected: ScoredLeaveInProduct[] = []
  const seen = new Set<string>()

  for (const format of formats) {
    const matchingFormat = scored.filter((product) => {
      const meta = product.recommendation_meta as LeaveInRecommendationMetadata | undefined
      return meta?.product_format === format
    })
    const primary = matchingFormat.find(
      (product) => product._fitStatus !== "mismatch" && product._fitStatus !== "unknown",
    )
    const fallback = matchingFormat.find(
      (product) =>
        product._fitStatus === "mismatch" &&
        isLeaveInFormatFallbackEligible(product._fitReasonCodes),
    )
    const pick = primary ?? (fallback ? markLeaveInFallback(fallback) : null)

    if (!pick || seen.has(pick.id)) continue
    selected.push(pick)
    seen.add(pick.id)
  }

  return selected
}

function mapBalanceToMaskType(
  balance: MaskCategoryDecision["targetProfile"] extends infer T
    ? T extends { balance: infer B }
      ? B
      : never
    : never,
): MaskType | null {
  switch (balance) {
    case "protein":
      return "protein"
    case "moisture":
      return "moisture"
    case "balanced":
      return "performance"
    default:
      return null
  }
}

function buildMaskUsageHint(spec: ProductMaskSpecs | null): string {
  if (!spec) {
    return "Nach dem Shampoo in die Längen und Spitzen geben, gründlich ausspülen und danach Conditioner verwenden."
  }

  return "Nach dem Shampoo in die Längen und Spitzen geben, gründlich ausspülen und danach Conditioner verwenden."
}

function buildMaskTradeoffs(fit: CategoryFitEvaluation): string[] {
  const tradeoffs: string[] = []
  const add = (message: string) => {
    if (!tradeoffs.includes(message)) tradeoffs.push(message)
  }

  if (fit.status === "unknown") {
    add(
      "Die Masken-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
    )
  }

  if (fit.status === "mismatch") {
    add("Weicht beim Masken-Zielprofil spürbar von deinem Bedarf ab.")
  }

  if (fit.reasonCodes.includes("mask_optional_overcare_caveat")) {
    add(
      "Eine Maske ist hier eher optional; zu intensive Zusatzpflege kann sonst beschweren oder die Balance kippen.",
    )
  }

  if (fit.reasonCodes.includes("mask_high_intensity_use_sparingly_caveat")) {
    add("Wenn du sie testest, dann eher sparsam und nicht bei jeder Wäsche.")
  }

  if (fit.reasonCodes.includes("mask_wrong_balance_stiff_dull_risk")) {
    add("Bei falscher Balance kann das Haar eher steif oder stumpf wirken.")
  }

  if (fit.reasonCodes.includes("mask_rich_weight_can_weigh_down_caveat")) {
    add("Die reichhaltige Textur kann feines oder wenig dichtes Haar beschweren.")
  }

  if (fit.reasonCodes.includes("mask_light_weight_may_be_underpowered_caveat")) {
    add("Die leichte Textur kann für sehr dichtes oder kräftiges Haar etwas zu wenig sein.")
  }

  if (fit.reasonCodes.includes("mask_low_concentration_may_be_underpowered_caveat")) {
    add("Die niedrige Intensität kann für stärkeren Kur-Bedarf etwas zu wenig sein.")
  }

  if (fit.missingFields.length > 0) {
    add("Ein Teil der strukturierten Produktdaten ist noch nicht gepflegt.")
  }

  return tradeoffs.slice(0, 3)
}

function isMaskFallbackEligible(reasonCodes: string[]): boolean {
  return reasonCodes.includes("mask_rich_weight_can_weigh_down_caveat")
}

function markMaskFallback(product: ScoredMaskProduct): ScoredMaskProduct {
  const meta = product.recommendation_meta as MaskRecommendationMetadata | null | undefined
  if (!meta || meta.category !== "mask") return product

  const fallbackTradeoff =
    "Fallback: Diese Maske weicht beim abgeleiteten Masken-Fit sichtbar ab und erscheint nur, weil nicht genug sichere Treffer verfügbar sind."

  return {
    ...product,
    recommendation_meta: {
      ...meta,
      tradeoffs: [
        fallbackTradeoff,
        ...meta.tradeoffs.filter((tradeoff) => tradeoff !== fallbackTradeoff),
      ].slice(0, 3),
    },
  }
}

function maskWeightPriorityAdjustment(
  target: NonNullable<MaskCategoryDecision["targetProfile"]>,
  spec: ProductMaskSpecs | null,
): number {
  if (!target.weight || !spec?.weight) return 0

  if (target.weight === "light") {
    return spec.weight === "light" ? 22 : -8
  }

  return spec.weight === target.weight ? 6 : 0
}

export function rerankMaskProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductMaskSpecs[]
  decision: MaskCategoryDecision
}): MatchedProduct[] {
  const { candidates, specs, decision } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredMaskProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateMaskFit(decision, spec as MaskFitSpec | null)
    const { positives } = buildFitSummary(
      fit,
      "Passt sehr gut zu deinem Masken-Zielprofil für Balance, Repair und Gewicht.",
      "Passt weitgehend zu deinem aktuellen Maskenbedarf.",
      "Die Masken-Spezifikation ist noch nicht vollständig genug für eine sichere Idealeinstufung.",
      "Weicht beim Masken-Zielprofil spürbar von deinem Bedarf ab.",
    )
    const score =
      toBaseScore(product) +
      fitStatusAdjustment(fit.status) +
      fitReasonAdjustment(fit) +
      maskWeightPriorityAdjustment(target, spec)
    const tradeoffs = buildMaskTradeoffs(fit)

    const recommendationMeta: MaskRecommendationMetadata = {
      category: "mask",
      score: Math.round(score * 10) / 10,
      top_reasons: [
        ...positives,
        target.needStrength >= 2
          ? "Deckt einen aktuell eher intensiven Kur-Bedarf ab."
          : "Passt gut zu deinem aktuellen Maskenbedarf.",
      ].slice(0, 3),
      tradeoffs,
      usage_hint: buildMaskUsageHint(spec),
      mask_type: mapBalanceToMaskType(target.balance) ?? "performance",
      need_strength: target.needStrength === 0 ? 1 : target.needStrength,
      fit_status: fit.status,
      role: target.role,
      product_weight: spec?.weight ?? null,
      product_concentration: spec?.concentration ?? null,
      product_balance_direction: spec?.balance_direction ?? null,
    }

    return {
      ...product,
      mask_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
      _fitStatus: fit.status,
      _fitReasonCodes: fit.reasonCodes,
    }
  })

  scored.sort(compareScoredProducts)
  const acceptable = scored.filter(
    (product) => product._fitStatus !== "mismatch" && product._fitStatus !== "unknown",
  )
  if (acceptable.length >= SELECTION_LIMIT) {
    return stripScore(acceptable.slice(0, SELECTION_LIMIT))
  }

  const fallback = scored
    .filter(
      (product) =>
        product._fitStatus === "mismatch" && isMaskFallbackEligible(product._fitReasonCodes),
    )
    .map(markMaskFallback)

  return stripScore([...acceptable, ...fallback].slice(0, SELECTION_LIMIT))
}

function mapBalanceTargetToConcernCodes(
  balance: ConditionerCategoryDecision["targetProfile"] extends infer T
    ? T extends { balance: infer B }
      ? B
      : never
    : never,
): string[] {
  switch (balance) {
    case "moisture":
      return ["feuchtigkeit"]
    case "protein":
      return ["protein"]
    default:
      return []
  }
}

function mergeConcernSearchCodes(...lists: Array<readonly string[]>): string[] {
  return [...new Set(lists.flatMap((list) => list).filter(Boolean))]
}

function buildMaskConcernSearchOrderFromEngine(
  decision: MaskCategoryDecision,
  hairProfile: HairProfile | null,
): string[] {
  const profileConcernCodes = getProductConcernCodesForProfileSignals(
    "mask",
    hairProfile?.concerns ?? [],
  )

  if (!decision.targetProfile?.balance || decision.targetProfile.balance === "balanced") {
    return mergeConcernSearchCodes(profileConcernCodes, ["performance"])
  }

  return decision.targetProfile.balance === "moisture"
    ? mergeConcernSearchCodes(profileConcernCodes, ["feuchtigkeit", "performance"])
    : mergeConcernSearchCodes(profileConcernCodes, ["protein", "performance"])
}

export async function loadRoutineItemsForEngine(
  userId: string | null | undefined,
): Promise<PersistenceRoutineItemRow[]> {
  if (!userId) return []

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("user_product_usage")
    .select("category, product_name, frequency_range")
    .eq("user_id", userId)

  if (error) {
    console.error("Failed to load routine inventory for recommendation engine:", error)
    return []
  }

  return (data ?? []) as PersistenceRoutineItemRow[]
}

export async function selectConditionerProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime =
    params.runtime ??
    buildRecommendationEngineRuntimeFromPersistence(
      hairProfile,
      routineItems,
      buildRecommendationRequestContext({
        requestedCategory: "conditioner",
        message,
      }),
    )
  const decision = runtime.categories.conditioner
  if (!decision.relevant || !decision.targetProfile) return []

  const exactConcernCodes = mergeConcernSearchCodes(
    mapBalanceTargetToConcernCodes(decision.targetProfile.balance),
    getProductConcernCodesForProfileSignals("conditioner", hairProfile?.concerns ?? []),
  )

  const genericCandidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: exactConcernCodes,
    category: "conditioner",
    count: CANDIDATE_COUNT,
  })

  let strictCandidates: MatchedProduct[] = []
  if (hairProfile?.thickness && hairProfile.protein_moisture_balance) {
    strictCandidates = await matchConditionerProducts({
      query: message,
      thickness: hairProfile.thickness,
      proteinMoistureBalance: hairProfile.protein_moisture_balance,
      count: CANDIDATE_COUNT,
    })
  }

  const candidates = dedupeById([...strictCandidates, ...genericCandidates])
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_conditioner_rerank_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load conditioner specs for recommendation engine:", error)
    return []
  }

  return rerankConditionerProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductConditionerRerankSpecs[],
    decision,
    hairProfile,
    runtime,
  })
}

export async function selectShampooProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    hairProfile,
    routineItems,
    buildRecommendationRequestContext({
      requestedCategory: "shampoo",
      message,
    }),
  )
  const decision = runtime.categories.shampoo
  if (!decision.relevant || !decision.targetProfile?.shampooBucket || !hairProfile?.thickness) {
    return []
  }

  const primaryCandidates = await matchShampooProducts({
    query: message,
    thickness: hairProfile.thickness,
    shampooBucket: decision.targetProfile.shampooBucket,
    count: decision.targetProfile.secondaryBucket ? 2 : 3,
  })
  const bucketByProductId = new Map<
    string,
    NonNullable<ShampooCategoryDecision["targetProfile"]>["shampooBucket"]
  >()
  for (const product of primaryCandidates) {
    bucketByProductId.set(product.id, decision.targetProfile.shampooBucket)
  }

  let secondaryCandidates: MatchedProduct[] = []
  if (
    decision.targetProfile.secondaryBucket &&
    decision.targetProfile.secondaryBucket !== decision.targetProfile.shampooBucket
  ) {
    secondaryCandidates = await matchShampooProducts({
      query: message,
      thickness: hairProfile.thickness,
      shampooBucket: decision.targetProfile.secondaryBucket,
      count: 1,
    })
    for (const product of secondaryCandidates) {
      ;(product as unknown as { shampoo_role?: string }).shampoo_role = "daily"
      bucketByProductId.set(product.id, decision.targetProfile.secondaryBucket)
    }
    for (const product of primaryCandidates) {
      ;(product as unknown as { shampoo_role?: string }).shampoo_role = "treatment"
    }
  }

  const candidates = dedupeById([...primaryCandidates, ...secondaryCandidates])
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_shampoo_specs")
    .select("product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity")
    .eq("thickness", hairProfile.thickness)
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load shampoo specs for recommendation engine:", error)
  }

  return rerankShampooProductsWithEngine({
    candidates,
    decision,
    hairProfile,
    bucketByProductId,
    specs: (specs ?? []) as ProductShampooSpecRow[],
  })
}

export async function selectOilProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message,
  })
  const runtime =
    params.runtime ??
    buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems, requestContext)
  const decision = runtime.categories.oil
  const caveatedOverloadSelection =
    decision.noRecommendationReason === "overload_risk" && decision.targetProfile !== null

  if (
    !decision.relevant ||
    decision.clarificationNeeded ||
    (decision.noRecommendationReason && !caveatedOverloadSelection) ||
    !decision.targetProfile?.matcherSubtype ||
    !hairProfile?.thickness
  ) {
    return []
  }
  const targetPurpose = decision.targetProfile.purpose

  const subtypeCandidates = await matchOilProducts({
    query: message,
    thickness: hairProfile.thickness,
    oilSubtype: decision.targetProfile.matcherSubtype,
    count: CANDIDATE_COUNT,
  })

  const genericCandidates = await matchProducts({
    query: message,
    thickness: hairProfile.thickness,
    category: "oil",
    count: CANDIDATE_COUNT * 2,
  })

  let candidates = dedupeById([...subtypeCandidates, ...genericCandidates])
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: eligibilityRows, error } = await supabase
    .from("product_oil_eligibility")
    .select("product_id, thickness, oil_subtype, oil_purpose")
    .eq("thickness", hairProfile.thickness)
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load oil eligibility for recommendation engine:", error)
    return rerankOilProductsWithEngine({
      candidates,
      decision,
      hairProfile,
      runtime,
    })
  }

  const typedEligibilityRows = (eligibilityRows ?? []) as ProductOilEligibilityRow[]
  const exactPurposeProductIds = new Set(
    typedEligibilityRows
      .filter((row) => row.oil_purpose === targetPurpose)
      .map((row) => row.product_id),
  )

  if (exactPurposeProductIds.size >= SELECTION_LIMIT) {
    const exactPurposeCandidates = candidates.filter((candidate) =>
      exactPurposeProductIds.has(candidate.id),
    )
    if (exactPurposeCandidates.length > 0) {
      candidates = exactPurposeCandidates
    }
  }

  return rerankOilProductsWithEngine({
    candidates,
    decision,
    hairProfile,
    eligibilityRows: typedEligibilityRows,
    runtime,
  })
}

export async function selectLeaveInProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime =
    params.runtime ??
    buildRecommendationEngineRuntimeFromPersistence(
      hairProfile,
      routineItems,
      buildRecommendationRequestContext({
        requestedCategory: "leave_in",
        message,
      }),
    )
  const decision = runtime.categories.leaveIn
  if (!decision.relevant || !decision.targetProfile) return []

  const legacyNeedBucket = mapEngineLeaveInNeedToLegacy(decision.targetProfile.needBucket)
  const exactConcernCodes = mergeConcernSearchCodes(
    legacyNeedBucket ? [legacyNeedBucket] : [],
    getProductConcernCodesForProfileSignals("leave_in", hairProfile?.concerns ?? []),
  )
  const strictCandidates =
    hairProfile?.thickness && legacyNeedBucket && decision.targetProfile.stylingContext
      ? await matchLeaveInProducts({
          query: message,
          thickness: hairProfile.thickness,
          needBucket: legacyNeedBucket,
          stylingContext: decision.targetProfile.stylingContext,
          count: CANDIDATE_COUNT,
        })
      : []

  const genericCandidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: exactConcernCodes,
    category: "leave_in",
    count: CANDIDATE_COUNT,
  })

  const supabase = createAdminClient()
  const specDrivenCandidates = await loadLeaveInSpecDrivenCandidates({ supabase, decision })
  const candidates = dedupeById([
    ...strictCandidates,
    ...genericCandidates,
    ...specDrivenCandidates,
  ])
  if (candidates.length === 0) return []

  const { data: specs, error } = await supabase
    .from("product_leave_in_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load leave-in specs for recommendation engine:", error)
    return []
  }

  return rerankLeaveInProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductLeaveInSpecs[],
    decision,
    hairProfile,
    requestedFormats: runtime.requestContext.leaveInRequestedFormats,
  })
}

export async function selectMaskProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime =
    params.runtime ??
    buildRecommendationEngineRuntimeFromPersistence(
      hairProfile,
      routineItems,
      buildRecommendationRequestContext({
        requestedCategory: "mask",
        message,
      }),
    )
  const decision = runtime.categories.mask
  if (!decision.relevant || !decision.targetProfile) return []

  const supabase = createAdminClient()
  const candidatesById = new Map<string, MatchedProduct>()

  for (const concernCode of buildMaskConcernSearchOrderFromEngine(decision, hairProfile)) {
    const candidates = await matchProducts({
      query: message,
      thickness: hairProfile?.thickness ?? undefined,
      concerns: [concernCode],
      category: "mask",
      count: CANDIDATE_COUNT,
    })

    for (const candidate of candidates) {
      const existing = candidatesById.get(candidate.id)
      if (!existing || toBaseScore(candidate) > toBaseScore(existing)) {
        candidatesById.set(candidate.id, candidate)
      }
    }
  }

  const candidates = [...candidatesById.values()]
  if (candidates.length === 0) return []

  const { data: specs, error } = await supabase
    .from("product_mask_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load mask specs for recommendation engine:", error)
    return []
  }

  return rerankMaskProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductMaskSpecs[],
    decision,
  })
}

export async function selectBondbuilderProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime =
    params.runtime ??
    buildRecommendationEngineRuntimeFromPersistence(
      hairProfile,
      routineItems,
      buildRecommendationRequestContext({
        requestedCategory: "bondbuilder",
        message,
      }),
    )
  const decision = runtime.categories.bondbuilder
  if (!decision.relevant || !decision.targetProfile) return []

  const exactConcernCodes = mergeConcernSearchCodes(
    ["repair"],
    getProductConcernCodesForProfileSignals("bondbuilder", hairProfile?.concerns ?? []),
  )

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: exactConcernCodes,
    category: "bondbuilder",
    count: CANDIDATE_COUNT,
  })
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_bondbuilder_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load bondbuilder specs for recommendation engine:", error)
    return []
  }

  if (!specs || specs.length === 0) {
    return []
  }

  const candidateIds = candidates.map((candidate) => candidate.id)
  const { data: outgoingRelationships, error: outgoingRelationshipsError } = await supabase
    .from("product_relationships")
    .select("source_product_id,target_product_id,relationship_type")
    .in("source_product_id", candidateIds)

  if (outgoingRelationshipsError) {
    console.error(
      "Failed to load outgoing product relationships for recommendation engine:",
      outgoingRelationshipsError,
    )
  }

  const { data: incomingRelationships, error: incomingRelationshipsError } = await supabase
    .from("product_relationships")
    .select("source_product_id,target_product_id,relationship_type")
    .in("target_product_id", candidateIds)

  if (incomingRelationshipsError) {
    console.error(
      "Failed to load incoming product relationships for recommendation engine:",
      incomingRelationshipsError,
    )
  }

  const outgoingRelationshipsByProductId = new Map<string, ProductRelationshipRow[]>()
  for (const relationship of (outgoingRelationships ?? []) as ProductRelationshipRow[]) {
    const current = outgoingRelationshipsByProductId.get(relationship.source_product_id) ?? []
    current.push(relationship)
    outgoingRelationshipsByProductId.set(relationship.source_product_id, current)
  }

  const incomingRelationshipsByProductId = new Map<string, ProductRelationshipRow[]>()
  for (const relationship of (incomingRelationships ?? []) as ProductRelationshipRow[]) {
    const current = incomingRelationshipsByProductId.get(relationship.target_product_id) ?? []
    current.push(relationship)
    incomingRelationshipsByProductId.set(relationship.target_product_id, current)
  }

  const relatedProductIds = [
    ...new Set(
      ((incomingRelationships ?? []) as ProductRelationshipRow[]).map(
        (relationship) => relationship.source_product_id,
      ),
    ),
  ]
  const relatedProductsById = new Map<string, RelatedProduct>()
  let relatedSpecs: ProductBondbuilderSpecs[] = []
  if (relatedProductIds.length > 0) {
    const { data: relatedProducts, error: relatedProductsError } = await supabase
      .from("products")
      .select(
        "id,name,brand,description,short_description,category,affiliate_link,image_url,price_eur,currency,purchase_link_status,tags,suitable_thicknesses,suitable_concerns,is_active,lifecycle_status,is_chaarlie_recommended,sort_order,created_at,updated_at",
      )
      .in("id", relatedProductIds)
      .eq("is_chaarlie_recommended", true)
      .eq("lifecycle_status", "active")

    if (relatedProductsError) {
      console.error(
        "Failed to load related products for recommendation engine:",
        relatedProductsError,
      )
    }

    for (const product of (relatedProducts ?? []) as RelatedProduct[]) {
      relatedProductsById.set(product.id, product)
    }

    const { data: relatedSpecRows, error: relatedSpecsError } = await supabase
      .from("product_bondbuilder_specs")
      .select("*")
      .in("product_id", relatedProductIds)

    if (relatedSpecsError) {
      console.error(
        "Failed to load related bondbuilder specs for recommendation engine:",
        relatedSpecsError,
      )
    }

    relatedSpecs = (relatedSpecRows ?? []) as ProductBondbuilderSpecs[]
  }

  return rerankBondbuilderProductsWithEngine({
    candidates,
    specs: [...((specs ?? []) as ProductBondbuilderSpecs[]), ...relatedSpecs],
    decision,
    message,
    outgoingRelationshipsByProductId,
    incomingRelationshipsByProductId,
    relatedProductsById,
  })
}

export async function selectDeepCleansingShampooProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime =
    params.runtime ??
    buildRecommendationEngineRuntimeFromPersistence(
      hairProfile,
      routineItems,
      buildRecommendationRequestContext({
        requestedCategory: "deep_cleansing_shampoo",
        message,
      }),
    )
  const decision = runtime.categories.deepCleansingShampoo
  if (!decision.relevant || !decision.targetProfile) return []

  const exactConcernCodes = mergeConcernSearchCodes(
    ["healthy_scalp"],
    getProductConcernCodesForProfileSignals("deep_cleansing_shampoo", hairProfile?.concerns ?? []),
  )

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: exactConcernCodes,
    category: "deep_cleansing_shampoo",
    count: CANDIDATE_COUNT,
  })
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_deep_cleansing_shampoo_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load deep-cleansing shampoo specs for recommendation engine:", error)
    return []
  }

  if (!specs || specs.length === 0) {
    return []
  }

  return rerankDeepCleansingShampooProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductDeepCleansingShampooSpecs[],
    decision,
  })
}

export async function selectDryShampooProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems, runtime: providedRuntime } = params
  const runtime =
    providedRuntime ??
    buildRecommendationEngineRuntimeFromPersistence(
      hairProfile,
      routineItems,
      buildRecommendationRequestContext({
        requestedCategory: "dry_shampoo",
        message,
      }),
    )
  const decision = runtime.categories.dryShampoo
  if (!decision.relevant || !decision.targetProfile) return []

  const exactConcernCodes = mergeConcernSearchCodes(
    ["oily_scalp"],
    getProductConcernCodesForProfileSignals("dry_shampoo", hairProfile?.concerns ?? []),
  )

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: exactConcernCodes,
    category: "dry_shampoo",
    count: CANDIDATE_COUNT,
  })
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_dry_shampoo_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load dry shampoo specs for recommendation engine:", error)
    return []
  }

  if (!specs || specs.length === 0) {
    return []
  }

  return rerankDryShampooProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductDryShampooSpecs[],
    decision,
  })
}

export async function selectPeelingProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
  runtime?: RecommendationEngineRuntime
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime =
    params.runtime ?? buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
  const decision = runtime.categories.peeling
  if (!decision.relevant || !decision.targetProfile) return []

  const exactConcernCodes = mergeConcernSearchCodes(
    ["healthy_scalp"],
    getProductConcernCodesForProfileSignals("peeling", hairProfile?.concerns ?? []),
  )

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: exactConcernCodes,
    category: "peeling",
    count: CANDIDATE_COUNT,
  })
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_peeling_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load peeling specs for recommendation engine:", error)
    return []
  }

  if (!specs || specs.length === 0) {
    return []
  }

  return rerankPeelingProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductPeelingSpecs[],
    decision,
  })
}
