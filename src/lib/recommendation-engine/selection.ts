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
  ShampooRecommendationMetadata,
} from "@/lib/types"
import type { ProductConditionerSpecs } from "@/lib/conditioner/constants"
import type { LeaveInNeedBucket } from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import { OIL_PURPOSE_LABELS, type OilPurpose, type OilSubtype } from "@/lib/oil/constants"
import type { ProductPeelingSpecs } from "@/lib/peeling/constants"
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
import { buildRecommendationEngineRuntimeFromPersistence } from "@/lib/recommendation-engine/runtime"
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

type LeaveInRerankSpec = {
  product_id: string
} & LeaveInFitSpec

interface ProductLeaveInFitRow {
  product_id: string
  weight: "light" | "medium" | "rich"
  conditioner_relationship: "replacement_capable" | "booster_only"
  care_benefits: Array<"heat_protect" | "curl_definition" | "repair" | "detangle_smooth">
}

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
    return clean
  })
}

function mapCanonicalLeaveInFitRow(spec: ProductLeaveInFitRow): LeaveInRerankSpec {
  const roles: LeaveInFitSpec["roles"] =
    spec.conditioner_relationship === "replacement_capable"
      ? ["replacement_conditioner"]
      : ["extension_conditioner"]

  const careBenefits: LeaveInFitSpec["care_benefits"] = []
  const applicationStage: LeaveInFitSpec["application_stage"] = []

  if (spec.care_benefits.includes("heat_protect")) {
    applicationStage.push("pre_heat")
  }
  if (spec.care_benefits.includes("curl_definition")) {
    careBenefits.push("curl_definition")
  }
  if (spec.care_benefits.includes("repair")) {
    careBenefits.push("repair")
  }
  if (spec.care_benefits.includes("detangle_smooth")) {
    careBenefits.push("detangling")
  }

  return {
    product_id: spec.product_id,
    weight: spec.weight,
    roles,
    provides_heat_protection: spec.care_benefits.includes("heat_protect"),
    care_benefits: careBenefits,
    application_stage: applicationStage,
  }
}

function shampooSpecKey(
  productId: string,
  shampooBucket: ShampooFitSpec["shampoo_bucket"],
): string {
  return `${productId}:${shampooBucket ?? "unknown"}`
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

export function rerankConditionerProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductConditionerSpecs[]
  decision: ConditionerCategoryDecision
  hairProfile: HairProfile | null
}): MatchedProduct[] {
  const { candidates, specs, decision, hairProfile } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateConditionerFit(decision, spec as ConditionerFitSpec | null)
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
    }

    return {
      ...product,
      conditioner_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
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

  const scored: ScoredEngineProduct[] = candidates.map((product) => {
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
    subtypeBridgeMatch: boolean
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
  } else if (params?.subtypeBridgeMatch) {
    tradeoffs.push(
      "Der Fit kommt aktuell noch ueber den Subtyp-Bridge und nicht ueber einen exakten Oel-Zweck-Match.",
    )
  }

  return {
    positives: positives.slice(0, 3),
    tradeoffs: tradeoffs.slice(0, 3),
  }
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
  const eligibilityByProductId = new Map<string, ProductOilEligibilityRow[]>()

  for (const row of eligibilityRows) {
    eligibilityByProductId.set(row.product_id, [
      ...(eligibilityByProductId.get(row.product_id) ?? []),
      row,
    ])
  }

  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const productEligibility = eligibilityByProductId.get(product.id) ?? []
    const exactPurposeMatch = productEligibility.some(
      (row) => row.oil_purpose === targetProfile.purpose,
    )
    const subtypeBridgeMatch = productEligibility.some(
      (row) => row.oil_subtype === targetProfile.matcherSubtype,
    )
    const { positives, tradeoffs } = buildOilTopReasons(decision, {
      exactPurposeMatch,
      subtypeBridgeMatch,
    })
    const score =
      toBaseScore(product) +
      (exactPurposeMatch ? 28 : subtypeBridgeMatch ? 6 : productEligibility.length > 0 ? -10 : 0)

    const recommendationMeta: OilRecommendationMetadata = {
      category: "oil",
      score: Math.round(score * 10) / 10,
      top_reasons: positives,
      tradeoffs,
      usage_hint: buildOilUsageHint(decision),
      matched_profile: {
        thickness: hairProfile?.thickness ?? null,
      },
      matched_subtype: targetProfile.matcherSubtype,
      use_mode: targetProfile.purpose,
      adjunct_scalp_support: targetProfile.adjunctScalpSupport,
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

export function rerankLeaveInProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: LeaveInRerankSpec[]
  decision: LeaveInCategoryDecision
  hairProfile: HairProfile | null
}): MatchedProduct[] {
  const { candidates, specs, decision, hairProfile } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateLeaveInFit(decision, spec as LeaveInFitSpec | null)
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
      conditioner_relationship: target.conditionerRelationship,
      matched_weight: target.weight,
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

export function rerankMaskProductsWithEngine(params: {
  candidates: MatchedProduct[]
  specs: ProductMaskSpecs[]
  decision: MaskCategoryDecision
}): MatchedProduct[] {
  const { candidates, specs, decision } = params
  if (!decision.relevant || !decision.targetProfile) return []
  const target = decision.targetProfile

  const specsByProductId = new Map(specs.map((spec) => [spec.product_id, spec]))
  const scored: ScoredEngineProduct[] = candidates.map((product) => {
    const spec = specsByProductId.get(product.id) ?? null
    const fit = evaluateMaskFit(decision, spec as MaskFitSpec | null)
    const { positives, tradeoffs } = buildFitSummary(
      fit,
      "Passt sehr gut zu deinem Masken-Zielprofil fuer Balance, Repair und Gewicht.",
      "Passt weitgehend zu deinem aktuellen Maskenbedarf.",
      "Die Masken-Spezifikation ist noch nicht vollstaendig genug fuer eine sichere Idealeinstufung.",
      "Weicht beim Masken-Zielprofil spuerbar von deinem Bedarf ab.",
    )
    const score = toBaseScore(product) + fitStatusAdjustment(fit.status) + fitReasonAdjustment(fit)

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
    }

    return {
      ...product,
      mask_specs: spec,
      recommendation_meta: recommendationMeta,
      _engineScore: score,
    }
  })

  scored.sort(compareScoredProducts)
  return stripScore(scored).slice(0, SELECTION_LIMIT)
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

function buildMaskConcernSearchOrderFromEngine(decision: MaskCategoryDecision): string[] {
  if (!decision.targetProfile?.balance || decision.targetProfile.balance === "balanced") {
    return ["performance"]
  }

  return decision.targetProfile.balance === "moisture"
    ? ["feuchtigkeit", "performance"]
    : ["protein", "performance"]
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

  const genericCandidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: mapBalanceTargetToConcernCodes(decision.targetProfile.balance),
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
    specs: (specs ?? []) as ProductConditionerSpecs[],
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

  if (exactPurposeProductIds.size > 0) {
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
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
  const decision = runtime.categories.leaveIn
  if (!decision.relevant || !decision.targetProfile) return []

  const legacyNeedBucket = mapEngineLeaveInNeedToLegacy(decision.targetProfile.needBucket)
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
    concerns: legacyNeedBucket ? [legacyNeedBucket] : [],
    category: "leave_in",
    count: CANDIDATE_COUNT,
  })

  const candidates = dedupeById([...strictCandidates, ...genericCandidates])
  if (candidates.length === 0) return []

  const supabase = createAdminClient()
  const { data: specs, error } = await supabase
    .from("product_leave_in_fit_specs")
    .select("*")
    .in(
      "product_id",
      candidates.map((candidate) => candidate.id),
    )

  if (error) {
    console.error("Failed to load leave-in fit specs for recommendation engine:", error)
    return []
  }

  return rerankLeaveInProductsWithEngine({
    candidates,
    specs: ((specs ?? []) as ProductLeaveInFitRow[]).map(mapCanonicalLeaveInFitRow),
    decision,
    hairProfile,
  })
}

export async function selectMaskProductsWithEngine(params: {
  message: string
  hairProfile: HairProfile | null
  routineItems: PersistenceRoutineItemRow[]
}): Promise<MatchedProduct[]> {
  const { message, hairProfile, routineItems } = params
  const runtime = buildRecommendationEngineRuntimeFromPersistence(hairProfile, routineItems)
  const decision = runtime.categories.mask
  if (!decision.relevant || !decision.targetProfile) return []

  const supabase = createAdminClient()

  for (const concernCode of buildMaskConcernSearchOrderFromEngine(decision)) {
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
    if (prioritized.length === 0) continue

    const { data: specs, error } = await supabase
      .from("product_mask_specs")
      .select("*")
      .in(
        "product_id",
        prioritized.map((candidate) => candidate.id),
      )

    if (error) {
      console.error("Failed to load mask specs for recommendation engine:", error)
      return []
    }

    const reranked = rerankMaskProductsWithEngine({
      candidates: prioritized,
      specs: (specs ?? []) as ProductMaskSpecs[],
      decision,
    })

    if (reranked.length > 0) {
      return reranked
    }
  }

  return []
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

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: ["repair"],
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

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: ["healthy_scalp"],
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

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: ["oily_scalp"],
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

  const candidates = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: ["healthy_scalp"],
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
