import type { PlanProductRole } from "@/lib/personal-plan/types"

import type {
  PersonalPlanCategory,
  Stage3CriterionResult,
  Stage3FitVerdict,
  Stage3ProductIdentity,
  Stage3Recommendation,
} from "./contracts"
import type {
  Stage3AuthorityInput,
  Stage3AuthorityEvaluation,
  Stage3CategoryProductFacts,
  Stage3KnownAuthorityEvaluation,
} from "./authority/contracts"
import { evaluateStage3Authority } from "./authority/evaluate"

export const STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT = 3

export type Stage3FitComparisonPresentationKind = "ordered" | "set" | "binary" | "categorical"

export type Stage3FitComparisonStop = {
  stopId: string
  label: string
}

export type Stage3FitComparisonPosition =
  | { kind: "position"; stopId: string }
  | { kind: "supported_stops"; stopIds: string[] }
  | { kind: "unknown" }

export type Stage3FitComparisonProduct = {
  productId: string
  displayName: string
  presentationImageUrl?: string | null
  presentation?: {
    priceLabel: string | null
    netContentLabel: string | null
  }
  category: PersonalPlanCategory
  role: PlanProductRole | null
  source: "current" | "alternative"
}

export type Stage3FitComparisonDimension = {
  dimensionId: string
  label: string
  presentationKind: Stage3FitComparisonPresentationKind
  stops: Stage3FitComparisonStop[]
  targetPosition: Stage3FitComparisonPosition | null
  productPositions: Array<{
    productId: string
    position: Stage3FitComparisonPosition
  }>
  reason: string
}

export type Stage3FitComparison =
  | {
      schemaVersion: 1
      mode: "comparison"
      category: PersonalPlanCategory
      role: PlanProductRole
      subjectKey: string
      sourceIdentity: Stage3ProductIdentity | null
      products: Stage3FitComparisonProduct[]
      alternatives: Stage3SelectedComparisonCandidate[]
      dimensions: Stage3FitComparisonDimension[]
    }
  | {
      schemaVersion: 1
      mode: "compact" | "unavailable"
      category: PersonalPlanCategory
      role: PlanProductRole
      subjectKey: string
      sourceIdentity: Stage3ProductIdentity | null
      products: Stage3FitComparisonProduct[]
      alternatives: Stage3SelectedComparisonCandidate[]
      dimensions: []
      reason: "specialist_category" | "no_exact_product"
    }

export type Stage3SelectedComparisonCandidate = {
  productId: string
  category: PersonalPlanCategory
  role: PlanProductRole | null
  verdict: Extract<Stage3FitVerdict, "ideal" | "supportive">
  criteria: Stage3CriterionResult[]
  recommendation: Stage3Recommendation
  factFingerprint: string
}

type CandidateAssessment = Stage3SelectedComparisonCandidate & {
  catalogSortOrder: number | null | undefined
  facts: Stage3CategoryProductFacts
}

type ComparisonProductEntry = {
  product: Stage3FitComparisonProduct
  facts: Stage3CategoryProductFacts
}

export function buildStage3FitComparison<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  subjectEvaluation?: Stage3AuthorityEvaluation,
): Stage3FitComparison {
  const authorityInput = input as unknown as Stage3AuthorityInput
  const authorityEvaluation = subjectEvaluation ?? evaluateStage3Authority(authorityInput)
  const selectedCandidates = boundedSelectedComparisonCandidateAssessments(
    authorityInput,
    authorityEvaluation,
  )
  const entries = [
    ...currentComparisonProductEntries(authorityInput, authorityEvaluation),
    ...alternativeProductEntries(selectedCandidates),
  ]
  const products = entries.map((entry) => entry.product)
  const alternatives = selectedCandidates.map(publicSelectedCandidate)
  const dimensions = comparisonDimensions(authorityInput, entries)

  if (dimensions.length > 0) {
    return {
      schemaVersion: 1,
      mode: "comparison",
      category: input.category,
      role: input.role,
      subjectKey: input.subjectKey,
      sourceIdentity: input.subjectIdentity,
      products,
      alternatives,
      dimensions,
    }
  }

  return {
    schemaVersion: 1,
    mode: products.length > 0 ? "compact" : "unavailable",
    category: input.category,
    role: input.role,
    subjectKey: input.subjectKey,
    sourceIdentity: input.subjectIdentity,
    products,
    alternatives,
    dimensions: [],
    reason: products.length > 0 ? "specialist_category" : "no_exact_product",
  }
}

export function findStage3SelectedComparisonCandidate<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  selectedProductId: string,
): Stage3SelectedComparisonCandidate | null {
  const authorityInput = input as unknown as Stage3AuthorityInput
  const candidate =
    boundedSelectedComparisonCandidateAssessments(authorityInput).find(
      (item) => item.productId === selectedProductId,
    ) ?? null
  return candidate ? publicSelectedCandidate(candidate) : null
}

function currentComparisonProductEntries(
  input: Stage3AuthorityInput,
  evaluation: Stage3AuthorityEvaluation,
): ComparisonProductEntry[] {
  if (
    evaluation.status !== "known" ||
    !input.productFacts ||
    !input.subjectIdentity ||
    input.subjectIdentity.kind !== "catalog_product"
  ) {
    return []
  }

  return [
    {
      product: {
        productId: input.productFacts.productId,
        displayName: input.productFacts.displayName,
        presentationImageUrl:
          input.subjectIdentity.kind === "catalog_product"
            ? (input.subjectIdentity.imageUrl ?? input.productFacts.presentationImageUrl ?? null)
            : (input.productFacts.presentationImageUrl ?? null),
        presentation: presentationFor(input.productFacts),
        category: input.category,
        role: input.role,
        source: "current",
      },
      facts: input.productFacts,
    },
  ]
}

function alternativeProductEntries(
  alternatives: readonly CandidateAssessment[],
): ComparisonProductEntry[] {
  return alternatives.map((candidate) => ({
    product: {
      productId: candidate.productId,
      displayName: candidate.recommendation.displayName,
      presentationImageUrl: candidate.facts.presentationImageUrl ?? null,
      presentation: presentationFor(candidate.facts),
      category: candidate.category,
      role: candidate.role,
      source: "alternative",
    },
    facts: candidate.facts,
  }))
}

const STAGE3_COMMERCE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function presentationFor(
  facts: Stage3CategoryProductFacts,
): Stage3FitComparisonProduct["presentation"] {
  return {
    priceLabel: freshPriceLabel(facts),
    netContentLabel:
      facts.netContentValue !== null &&
      facts.netContentValue !== undefined &&
      (facts.netContentUnit === "ml" || facts.netContentUnit === "g")
        ? `${formatNumber(facts.netContentValue)} ${facts.netContentUnit}`
        : null,
  }
}

function freshPriceLabel(facts: Stage3CategoryProductFacts): string | null {
  if (
    facts.priceEur === null ||
    facts.priceEur === undefined ||
    facts.purchaseLinkStatus !== "available" ||
    !facts.priceCheckedAt
  ) {
    return null
  }
  const checkedAt = Date.parse(facts.priceCheckedAt)
  if (!Number.isFinite(checkedAt) || Date.now() - checkedAt > STAGE3_COMMERCE_MAX_AGE_MS)
    return null
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(
    facts.priceEur,
  )
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)
}

function selectedComparisonCandidateAssessments(
  input: Stage3AuthorityInput,
  subjectEvaluation?: Stage3AuthorityEvaluation,
): CandidateAssessment[] {
  const currentProductId = input.productFacts?.productId ?? null
  const currentRecommendationProductId =
    currentRecommendation(input, subjectEvaluation)?.productId ?? null
  return input.recommendationCandidates
    .filter(
      (candidate) =>
        candidate.productId !== currentProductId &&
        candidate.isActive &&
        candidate.lifecycleStatus === "active" &&
        candidate.recommendable,
    )
    .map((candidate) => assessCandidate(input, candidate))
    .filter((candidate): candidate is CandidateAssessment => candidate !== null)
    .sort((left, right) => {
      const recommendationOrder =
        Number(right.productId === currentRecommendationProductId) -
        Number(left.productId === currentRecommendationProductId)
      if (recommendationOrder !== 0) return recommendationOrder
      const verdictOrder = verdictRank(left.verdict) - verdictRank(right.verdict)
      if (verdictOrder !== 0) return verdictOrder
      return compareCatalogOrder(left, right)
    })
}

function boundedSelectedComparisonCandidateAssessments(
  input: Stage3AuthorityInput,
  subjectEvaluation?: Stage3AuthorityEvaluation,
): CandidateAssessment[] {
  return selectedComparisonCandidateAssessments(input, subjectEvaluation).slice(
    0,
    STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT,
  )
}

function currentRecommendation(
  input: Stage3AuthorityInput,
  subjectEvaluation?: Stage3AuthorityEvaluation,
): Stage3Recommendation | null {
  const evaluation = subjectEvaluation ?? evaluateStage3Authority(input)
  return evaluation.status === "known" ? evaluation.recommendation : null
}

function assessCandidate(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
): CandidateAssessment | null {
  const detached = evaluateDetachedCandidate(input, candidate)
  if (!detached || (detached.verdict !== "ideal" && detached.verdict !== "supportive")) return null
  const recommendation = recommendationForCandidate(input, candidate)
  if (!recommendation) return null
  return {
    productId: candidate.productId,
    category: candidate.category,
    role: recommendation.role,
    verdict: detached.verdict,
    criteria: detached.criteria,
    recommendation,
    factFingerprint: candidate.factFingerprint,
    catalogSortOrder: candidate.catalogSortOrder,
    facts: candidate,
  }
}

function evaluateDetachedCandidate(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
): Stage3KnownAuthorityEvaluation | null {
  const evaluation = evaluateStage3Authority({
    ...input,
    capturedProductId: null,
    subjectIdentity: {
      kind: "catalog_product",
      productId: candidate.productId,
      displayName: candidate.displayName,
      category: candidate.category,
    },
    productFacts: candidate as never,
    recommendationCandidates: [],
  })
  return evaluation.status === "known" ? evaluation : null
}

function recommendationForCandidate(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
): Stage3Recommendation | null {
  const evaluation = evaluateStage3Authority({
    ...input,
    capturedProductId: null,
    subjectIdentity: null,
    productFacts: null,
    recommendationCandidates: [candidate as never],
  })
  if (
    evaluation.status !== "known" ||
    evaluation.recommendation?.productId !== candidate.productId ||
    evaluation.recommendation.role !== input.role
  ) {
    return null
  }
  return evaluation.recommendation
}

function publicSelectedCandidate(
  candidate: CandidateAssessment,
): Stage3SelectedComparisonCandidate {
  return {
    productId: candidate.productId,
    category: candidate.category,
    role: candidate.role,
    verdict: candidate.verdict,
    criteria: candidate.criteria,
    recommendation: candidate.recommendation,
    factFingerprint: candidate.factFingerprint,
  }
}

function verdictRank(verdict: Extract<Stage3FitVerdict, "ideal" | "supportive">): number {
  return verdict === "ideal" ? 0 : 1
}

function compareCatalogOrder(left: CandidateAssessment, right: CandidateAssessment): number {
  const leftOrder = left.catalogSortOrder ?? Number.MAX_SAFE_INTEGER
  const rightOrder = right.catalogSortOrder ?? Number.MAX_SAFE_INTEGER
  return leftOrder - rightOrder || left.productId.localeCompare(right.productId)
}

function comparisonDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  if (entries.length === 0) return []
  switch (input.category) {
    case "shampoo":
      if (input.role === "shampoo_dandruff") return []
      return shampooDimensions(input, entries)
    case "conditioner":
      return conditionerDimensions(input, entries)
    case "leave_in":
      return leaveInDimensions(input, entries)
    case "mask":
      return maskDimensions(input, entries)
    case "oil":
      return oilDimensions(input, entries)
    case "heat_protectant":
    case "scalp_care":
    case "dry_shampoo":
    case "bondbuilder":
    case "deep_cleansing_shampoo":
      return []
  }
}

function shampooDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  return [
    dimension(
      "shampoo.cleansing_intensity",
      "Reinigungsintensität",
      "ordered",
      [
        { stopId: "gentle", label: "sanft" },
        { stopId: "regular", label: "regulaer" },
        { stopId: "clarifying", label: "klaerend" },
      ],
      null,
      entries,
      (facts) => (facts.category === "shampoo" ? facts.spec.cleansingIntensity : null),
      "Shampoo V1 zeigt gespeicherte Produktwerte ohne erfundenen Zielkorridor.",
    ),
    dimension(
      "shampoo.scalp_route",
      "Kopfhaut-Fokus",
      "categorical",
      [
        { stopId: "oily", label: "fettig" },
        { stopId: "balanced", label: "ausgeglichen" },
        { stopId: "dry", label: "trocken" },
      ],
      target?.category === "shampoo" ? target.scalpRoute : null,
      entries,
      (facts) => (facts.category === "shampoo" ? facts.spec.scalpRoute : null),
      "Der Kopfhaut-Fokus kommt aus dem bestätigten Shampoo-Ziel.",
    ),
    dimension(
      "shampoo.suitable_thicknesses",
      "Geeignete Haardicke",
      "set",
      THICKNESS_STOPS,
      null,
      entries,
      (facts) => facts.suitableThicknesses,
      "Die Haardicken-Eignung nutzt nur gespeicherte Katalogwerte.",
    ),
  ]
}

function conditionerDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  return [
    dimension(
      "conditioner.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      target?.category === "conditioner" ? target.weight : null,
      entries,
      (facts) => (facts.category === "conditioner" ? facts.spec.weight : null),
      "Das Pflegegewicht wird mit dem bestätigten Conditioner-Ziel abgeglichen.",
    ),
    dimension(
      "conditioner.care_direction",
      "Pflegerichtung",
      "categorical",
      CARE_DIRECTION_STOPS,
      target?.category === "conditioner" ? target.careDirection : null,
      entries,
      (facts) => (facts.category === "conditioner" ? facts.spec.proteinMoistureBalance : null),
      "Die Pflegerichtung kommt aus Zielprofil und exakten Produktfakten.",
    ),
    dimension(
      "conditioner.repair_support",
      "Repair-Unterstützung",
      "ordered",
      REPAIR_STOPS,
      target?.category === "conditioner" ? target.repairSupportLevel : null,
      entries,
      (facts) => (facts.category === "conditioner" ? facts.spec.repairSupportLevel : null),
      "Die Repair-Unterstützung bleibt eine explizite Katalogachse.",
    ),
  ]
}

function leaveInDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const includeHeatDimension =
    input.role === "pre_heat_application" &&
    entries.some(
      (entry) =>
        entry.facts.category === "leave_in" && entry.facts.spec.providesHeatProtection !== true,
    )
  const third = includeHeatDimension
    ? dimension(
        "leave_in.heat_protection",
        "Hitzeschutz",
        "binary",
        BINARY_STOPS,
        true,
        entries,
        (facts) => (facts.category === "leave_in" ? facts.spec.providesHeatProtection : null),
        "Hitzeschutz wird nur gezeigt, wenn die Hitzerolle tatsächlich gefordert ist.",
      )
    : dimension(
        "leave_in.repair_support",
        "Repair-Unterstützung",
        "ordered",
        REPAIR_STOPS,
        target?.category === "leave_in" ? target.repairSupportLevel : null,
        entries,
        (facts) => (facts.category === "leave_in" ? facts.spec.repairSupportLevel : null),
        "Die Repair-Unterstützung bleibt eine explizite Katalogachse.",
      )
  return [
    dimension(
      "leave_in.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      target?.category === "leave_in" ? target.weight : null,
      entries,
      (facts) => (facts.category === "leave_in" ? facts.spec.weight : null),
      "Das Pflegegewicht wird mit dem bestätigten Leave-in-Ziel abgeglichen.",
    ),
    dimension(
      "leave_in.care_direction",
      "Pflegerichtung",
      "categorical",
      CARE_DIRECTION_STOPS,
      target?.category === "leave_in" ? target.careDirection : null,
      entries,
      (facts) => (facts.category === "leave_in" ? facts.spec.careDirection : null),
      "Die Pflegerichtung kommt aus Zielprofil und exakten Produktfakten.",
    ),
    third,
  ]
}

function maskDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  return [
    dimension(
      "mask.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      target?.category === "mask" ? target.weight : null,
      entries,
      (facts) => (facts.category === "mask" ? facts.spec.weight : null),
      "Das Pflegegewicht wird mit dem bestätigten Masken-Ziel abgeglichen.",
    ),
    dimension(
      "mask.care_direction",
      "Pflegerichtung",
      "categorical",
      CARE_DIRECTION_STOPS,
      target?.category === "mask" ? target.careDirection : null,
      entries,
      (facts) => (facts.category === "mask" ? facts.spec.careDirection : null),
      "Die Pflegerichtung kommt aus Zielprofil und exakten Produktfakten.",
    ),
    dimension(
      "mask.repair_support",
      "Repair-Unterstützung",
      "ordered",
      REPAIR_STOPS,
      target?.category === "mask" ? target.repairSupportLevel : null,
      entries,
      (facts) => (facts.category === "mask" ? facts.spec.repairSupportLevel : null),
      "Die Repair-Unterstützung bleibt eine explizite Katalogachse.",
    ),
  ]
}

function oilDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const roleTarget =
    target?.category === "oil"
      ? (target.roleTargets.find((item) => item.role === input.role) ?? null)
      : null
  const application = dimension(
    "oil.role_support",
    "Unterstützte Einsätze",
    "binary",
    BINARY_STOPS,
    true,
    entries,
    (facts) => (facts.category === "oil" ? (facts.spec.roleSupport[input.role] ?? null) : null),
    "Die Rollenunterstützung bleibt ein expliziter Katalogwert.",
  )
  const thickness = dimension(
    "oil.suitable_thicknesses",
    "Geeignete Haardicke",
    "set",
    THICKNESS_STOPS,
    null,
    entries,
    (facts) => facts.suitableThicknesses,
    "Die Haardicken-Eignung nutzt nur gespeicherte Katalogwerte.",
  )
  if (input.role === "pre_wash_fibre_treatment") {
    return [application, thickness]
  }
  return [
    application,
    dimension(
      "oil.weight",
      "Pflegegewicht",
      "ordered",
      WEIGHT_STOPS,
      roleTarget?.weight ?? null,
      entries,
      (facts) => (facts.category === "oil" ? facts.spec.weight : null),
      "Das Öl-Gewicht wird nur für Leave-on-Rollen als Zielachse genutzt.",
    ),
    thickness,
  ]
}

function dimension(
  dimensionId: string,
  label: string,
  presentationKind: Stage3FitComparisonPresentationKind,
  stops: readonly Stage3FitComparisonStop[],
  target: string | boolean | null,
  entries: readonly ComparisonProductEntry[],
  valueFor: (facts: Stage3CategoryProductFacts) => string | boolean | readonly string[] | null,
  reason: string,
): Stage3FitComparisonDimension {
  return {
    dimensionId,
    label,
    presentationKind,
    stops: stops.map((stop) => ({ ...stop })),
    targetPosition:
      target === null
        ? null
        : presentationKind === "set"
          ? setPosition([String(target)], stops)
          : scalarPosition(target, stops),
    productPositions: entries.map((entry) => ({
      productId: entry.product.productId,
      position: positionForValue(valueFor(entry.facts), presentationKind, stops),
    })),
    reason,
  }
}

const WEIGHT_STOPS = [
  { stopId: "light", label: "leicht" },
  { stopId: "medium", label: "mittel" },
  { stopId: "rich", label: "reichhaltig" },
] as const

const CARE_DIRECTION_STOPS = [
  { stopId: "moisture", label: "Feuchtigkeit" },
  { stopId: "balanced", label: "ausgewogen" },
  { stopId: "protein", label: "Protein" },
] as const

const REPAIR_STOPS = [
  { stopId: "low", label: "niedrig" },
  { stopId: "medium", label: "mittel" },
  { stopId: "high", label: "hoch" },
] as const

const THICKNESS_STOPS = [
  { stopId: "fine", label: "fein" },
  { stopId: "normal", label: "mittel" },
  { stopId: "coarse", label: "dick" },
] as const

const BINARY_STOPS = [
  { stopId: "true", label: "ja" },
  { stopId: "false", label: "nein" },
] as const

function positionForValue(
  value: string | boolean | readonly string[] | null,
  presentationKind: Stage3FitComparisonPresentationKind,
  stops: readonly Stage3FitComparisonStop[],
): Stage3FitComparisonPosition {
  if (value === null) return { kind: "unknown" }
  if (presentationKind === "set") {
    return Array.isArray(value) ? setPosition(value, stops) : setPosition([String(value)], stops)
  }
  if (Array.isArray(value)) return { kind: "unknown" }
  return scalarPosition(value as string | boolean, stops)
}

function scalarPosition(
  value: string | boolean,
  stops: readonly Stage3FitComparisonStop[],
): Stage3FitComparisonPosition {
  const stopId = String(value)
  return stops.some((stop) => stop.stopId === stopId)
    ? { kind: "position", stopId }
    : { kind: "unknown" }
}

function setPosition(
  values: readonly string[],
  stops: readonly Stage3FitComparisonStop[],
): Stage3FitComparisonPosition {
  const knownStopIds = new Set(stops.map((stop) => stop.stopId))
  const stopIds = values.filter((value) => knownStopIds.has(value))
  return stopIds.length > 0 ? { kind: "supported_stops", stopIds } : { kind: "unknown" }
}
