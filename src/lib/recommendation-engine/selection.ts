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
  ShampooRecommendationMetadata,
} from "@/lib/types"
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
} from "@/lib/rag/product-matcher"
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
  CategoryFitEvaluation,
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

const SELECTION_LIMIT = 3
const CANDIDATE_COUNT = 10

type ScoredEngineProduct = MatchedProduct & {
  _engineScore: number
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
  return "Im ersten Waschgang auf die Kopfhaut geben, gruendlich einmassieren und danach sauber ausspuelen."
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
        ? "Ergaenzt den Hauptfokus sinnvoll ueber die geplante Rotation."
        : "Passt zum eingeordneten Kopfhaut-Fokus.",
    )
  }

  if (fit.status === "unknown") {
    tradeoffs.push(
      "Die Shampoo-Spezifikation ist noch nicht vollstaendig genug fuer eine feinere Fit-Einstufung.",
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
      "Passt zum Kopfhaut-Fokus; die Reinigungsintensitaet ist nur ein Vergleichspunkt.",
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
    return "In die Laengen und Spitzen geben, 2-3 Minuten einwirken lassen und gruendlich ausspuelen."
  }

  return "In die Laengen und Spitzen geben, kurz einarbeiten und gruendlich ausspuelen."
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
    return "Fallback: Dieser Conditioner hat noch unvollstaendige strukturierte Fit-Daten und erscheint nur, weil nicht genug sichere Treffer verfuegbar sind."
  }

  return "Fallback: Dieser Conditioner weicht beim abgeleiteten Conditioner-Fit sichtbar ab und erscheint nur, weil nicht genug sichere Treffer verfuegbar sind."
}

export function rerankConditionerProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductConditionerRerankSpecs[]
  decision: ConditionerCategoryDecision
  hairProfile: HairProfile | null
}): MatchedProduct[] {
  const { candidates, specs, decision, hairProfile } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

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
      "Die Conditioner-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht beim Conditioner-Zielprofil sichtbar von deinem Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

    const recommendationMeta: ConditionerRecommendationMetadata = {
      category: "conditioner",
      score: Math.round(score * 10) / 10,
      top_reasons: [
        ...positives,
        target.balance
          ? `Fokus auf ${target.balance === "balanced" ? "ausgewogene Pflege" : target.balance === "moisture" ? "Feuchtigkeit" : "Protein"} passt zu deinem Profil.`
          : "Passt gut zu deinem aktuellen Conditioner-Bedarf.",
      ].slice(0, 3),
      tradeoffs,
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
      return "Vor dem Waschen sparsam auf trockene Kopfhaut und Laengen geben, 30-45 Minuten einwirken lassen und anschliessend auswaschen. Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primaere Hebel."
    }

    return "Vor dem Waschen sparsam auf trockene Kopfhaut und/oder Laengen geben, 30-45 Minuten einwirken lassen und anschliessend auswaschen."
  }

  if (decision.targetProfile?.purpose === "light_finish") {
    return "Sehr sparsam in trockene Laengen und Spitzen geben, damit das Haar leicht bleibt und nicht fettig wirkt."
  }

  return "Sparsam als Finish in trockene oder fast trockene Laengen und Spitzen geben, um Frizz zu baendigen und Glanz zu geben."
}

function buildOilTopReasons(
  decision: OilCategoryDecision,
  params?: {
    exactPurposeMatch: boolean
    finishBridgeMatch: boolean
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
      "Bei aktiven Kopfhautproblemen bleibt Shampoo oder ein Scalp-Treatment der primaere Hebel.",
    )
  }

  if (params?.exactPurposeMatch) {
    positives.push("Der hinterlegte Oel-Zweck passt auch in der Katalogpflege exakt zur Anfrage.")
  } else if (params?.finishBridgeMatch) {
    tradeoffs.push(
      "Der Fit kommt ueber die angrenzende Finish-Rolle, nicht ueber einen exakten Oel-Zweck-Match.",
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
}): MatchedProduct[] {
  const { candidates, decision, hairProfile, eligibilityRows = [] } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const targetProfile = decision.targetProfile
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
  const eligibleCandidates =
    eligibilityRows.length === 0
      ? candidates
      : exactPurposeProductIds.size >= SELECTION_LIMIT
        ? candidates.filter((product) => exactPurposeProductIds.has(product.id))
        : candidates.filter(
            (product) =>
              exactPurposeProductIds.has(product.id) || finishBridgeProductIds.has(product.id),
          )

  const scored: ScoredEngineProduct[] = eligibleCandidates.map((product) => {
    const productEligibility = eligibilityByProductId.get(product.id) ?? []
    const exactPurposeMatch = productEligibility.some(
      (row) => row.oil_purpose === targetProfile.purpose,
    )
    const finishBridgeMatch = productEligibility.some(
      (row) => bridgePurpose !== null && row.oil_purpose === bridgePurpose,
    )
    const { positives, tradeoffs } = buildOilTopReasons(decision, {
      exactPurposeMatch,
      finishBridgeMatch,
    })
    const score =
      toBaseScore(product) +
      (exactPurposeMatch ? 28 : finishBridgeMatch ? -8 : productEligibility.length > 0 ? -30 : 0)

    const recommendationMeta: OilRecommendationMetadata = {
      category: "oil",
      score: Math.round(score * 10) / 10,
      top_reasons:
        positives.length > 0
          ? positives
          : [
              targetProfile.purpose
                ? `Die Auswahl folgt dem Oel-Zweck ${OIL_PURPOSE_LABELS[targetProfile.purpose].toLowerCase()}.`
                : "Passt zum aktuellen Oel-Zweck.",
            ],
      tradeoffs,
      usage_hint: buildOilUsageHint(decision),
      matched_profile: {
        thickness: hairProfile?.thickness ?? null,
      },
      matched_subtype: targetProfile.matcherSubtype,
      use_mode: targetProfile.purpose,
      adjunct_scalp_support: targetProfile.adjunctScalpSupport,
      fit_status: exactPurposeMatch ? "ideal" : finishBridgeMatch ? "supportive" : "unknown",
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

function buildBondbuilderUsageHint(decision: BondbuilderCategoryDecision): string {
  if (decision.targetProfile?.applicationMode === "post_wash_leave_in") {
    return "Nach der Waesche oder im handtuchtrockenen Haar gemaess Produktanleitung sparsam einsetzen und nicht als Basispflege uebernutzen."
  }

  return "Vor dem Waschen als kurartige Bondbuilding-Behandlung gemaess Produktanleitung einsetzen und danach gruendlich ausspuelen."
}

export function rerankBondbuilderProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductBondbuilderSpecs[]
  decision: BondbuilderCategoryDecision
}): MatchedProduct[] {
  const { candidates, specs, decision } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateBondbuilderFit(decision, spec as BondbuilderFitSpec | null)
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zur benoetigten Bondbuilding-Intensitaet und zum geplanten Einsatzmodus.",
      "Passt weitgehend zum aktuellen Bondbuilding-Bedarf.",
      "Die Bondbuilder-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht bei Intensitaet oder Einsatzmodus zu deutlich vom aktuellen Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

    const recommendationMeta: BondbuilderRecommendationMetadata = {
      category: "bondbuilder",
      score: Math.round(score * 10) / 10,
      top_reasons: [
        ...positives,
        target.bondRepairIntensity === "intensive"
          ? "Unterstuetzt aktuell eher intensiven strukturellen Reparaturbedarf."
          : "Passt fuer eher konservative Bondbuilding-Unterstuetzung.",
      ].slice(0, 3),
      tradeoffs,
      usage_hint: buildBondbuilderUsageHint(decision),
      matched_intensity: target.bondRepairIntensity,
      application_mode: target.applicationMode,
    }

    return {
      ...product,
      bondbuilder_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
}

function buildDeepCleansingShampooUsageHint(): string {
  return "Als gelegentlichen Reset statt als Alltags-Shampoo nutzen und bei trockener oder empfindlicher Kopfhaut bewusst sparsam bleiben."
}

export function rerankDeepCleansingShampooProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductDeepCleansingShampooSpecs[]
  decision: DeepCleansingShampooCategoryDecision
}): MatchedProduct[] {
  const { candidates, specs, decision } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateDeepCleansingShampooFit(
      decision,
      spec as DeepCleansingShampooFitSpec | null,
    )
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zum aktuellen Reset-/Kopfhaut-Fokus.",
      "Passt weitgehend zum aktuellen Reset-Bedarf.",
      "Die Tiefenreinigungs-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht beim Kopfhaut-Fokus zu deutlich vom aktuellen Reset-Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

    const recommendationMeta: DeepCleansingShampooRecommendationMetadata = {
      category: "deep_cleansing_shampoo",
      score: Math.round(score * 10) / 10,
      top_reasons: positives.slice(0, 3),
      tradeoffs,
      usage_hint: buildDeepCleansingShampooUsageHint(),
      scalp_type_focus: target.scalpTypeFocus,
      reset_need_level: target.resetNeedLevel,
    }

    return {
      ...product,
      deep_cleansing_shampoo_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
}

function buildDryShampooUsageHint(): string {
  return "Nur als Between-Wash-Bruecke sparsam am Ansatz einsetzen und nicht als Ersatz fuer regulaeres Waschen mit Wasser nutzen."
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
      "Passt sehr gut zum geplanten Between-Wash-Kopfhaut-Fokus.",
      "Passt weitgehend zum Between-Wash-Bedarf.",
      "Die Trockenshampoo-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht beim Kopfhaut-Fokus zu deutlich vom Between-Wash-Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

    const recommendationMeta: DryShampooRecommendationMetadata = {
      category: "dry_shampoo",
      score: Math.round(score * 10) / 10,
      top_reasons: positives.slice(0, 3),
      tradeoffs,
      usage_hint: buildDryShampooUsageHint(),
      scalp_type_focus: target.scalpTypeFocus,
    }

    return {
      ...product,
      dry_shampoo_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
}

function buildPeelingUsageHint(decision: PeelingCategoryDecision): string {
  if (decision.targetProfile?.peelingType === "physical_scrub") {
    return "Als gelegentliches Kopfhaut-Reset vorsichtig verwenden und bei Sensibilitaet oder Trockenheit lieber seltener einsetzen."
  }

  return "Als sanfteres Kopfhaut-Peeling gemaess Produktanleitung einsetzen und die Frequenz bewusst konservativ halten."
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
      "Die Peeling-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
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
    return "Sparsam ins handtuchtrockene Haar geben und vor dem Foehnen oder Hitzestyling gleichmaessig verteilen."
  }

  if (decision.targetProfile?.conditionerRelationship === "replacement_capable") {
    return "Nach dem Waschen sparsam in die Laengen geben; bei feinem Haar kann es je nach Produkt auch den Conditioner ersetzen."
  }

  return "Nach dem Conditioner sparsam in die Laengen und Spitzen geben und als zusaetzlichen Booster nutzen."
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
}): MatchedProduct[] {
  const { candidates, specs, decision, hairProfile, requestedFormats = [] } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

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
      "Passt in grossen Teilen zu deinem Leave-in-Zielprofil.",
      "Die Leave-in-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht bei Nutzen, Hitzeschutz oder Conditioner-Rolle zu deutlich von deinem Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

    const recommendationMeta: LeaveInRecommendationMetadata = {
      category: "leave_in",
      score: Math.round(score * 10) / 10,
      top_reasons: [
        ...positives,
        target.needBucket === "heat_protect"
          ? "Bringt den fuer dein Styling benoetigten Hitzeschutz-Fokus mit."
          : "Passt gut zu deinem aktuellen Leave-in-Bedarf.",
      ].slice(0, 3),
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

  const acceptable = scored.filter(
    (product) => product._fitStatus !== "mismatch" && product._fitStatus !== "unknown",
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
    return "Nach dem Shampoo in die Laengen und Spitzen geben, gruendlich ausspuelen und danach Conditioner verwenden."
  }

  return "Nach dem Shampoo in die Laengen und Spitzen geben, gruendlich ausspuelen und danach Conditioner verwenden."
}

function buildMaskTradeoffs(fit: CategoryFitEvaluation): string[] {
  const tradeoffs: string[] = []
  const add = (message: string) => {
    if (!tradeoffs.includes(message)) tradeoffs.push(message)
  }

  if (fit.status === "unknown") {
    add(
      "Die Masken-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
    )
  }

  if (fit.status === "mismatch") {
    add("Weicht beim Masken-Zielprofil spuerbar von deinem Bedarf ab.")
  }

  if (fit.reasonCodes.includes("mask_optional_overcare_caveat")) {
    add(
      "Eine Maske ist hier eher optional; zu intensive Zusatzpflege kann sonst beschweren oder die Balance kippen.",
    )
  }

  if (fit.reasonCodes.includes("mask_high_intensity_use_sparingly_caveat")) {
    add("Wenn du sie testest, dann eher sparsam und nicht bei jeder Waesche.")
  }

  if (fit.reasonCodes.includes("mask_wrong_balance_stiff_dull_risk")) {
    add("Bei falscher Balance kann das Haar eher steif oder stumpf wirken.")
  }

  if (fit.reasonCodes.includes("mask_rich_weight_can_weigh_down_caveat")) {
    add("Die reichhaltige Textur kann feines oder wenig dichtes Haar beschweren.")
  }

  if (fit.reasonCodes.includes("mask_light_weight_may_be_underpowered_caveat")) {
    add("Die leichte Textur kann fuer sehr dichtes oder kraeftiges Haar etwas zu wenig sein.")
  }

  if (fit.reasonCodes.includes("mask_low_concentration_may_be_underpowered_caveat")) {
    add("Die niedrige Intensitaet kann fuer staerkeren Kur-Bedarf etwas zu wenig sein.")
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
    "Fallback: Diese Maske weicht beim abgeleiteten Masken-Fit sichtbar ab und erscheint nur, weil nicht genug sichere Treffer verfuegbar sind."

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
      "Passt sehr gut zu deinem Masken-Zielprofil fuer Balance, Repair und Gewicht.",
      "Passt weitgehend zu deinem aktuellen Maskenbedarf.",
      "Die Masken-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht beim Masken-Zielprofil spuerbar von deinem Bedarf ab.",
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
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
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
  })
}

export async function selectShampooProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
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
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const requestContext = buildRecommendationRequestContext({
    requestedCategory: "oil",
    message,
  })
  const runtime = buildRecommendationEngineRuntimeFromPersistence(
    hairProfile,
    routineItems,
    requestContext,
  )
  const decision = runtime.categories.oil
  if (
    !decision.relevant ||
    decision.clarificationNeeded ||
    decision.noRecommendationReason ||
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

    const prioritized = candidates.filter((candidate) =>
      candidate.suitable_concerns.includes(concernCode),
    )
    for (const candidate of prioritized) {
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
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
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

  return rerankBondbuilderProductsWithEngine({
    candidates,
    specs: (specs ?? []) as ProductBondbuilderSpecs[],
    decision,
  })
}

export async function selectDeepCleansingShampooProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
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
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
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
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
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
