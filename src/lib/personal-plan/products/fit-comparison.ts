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
  Stage3EvaluationContext,
  Stage3KnownAuthorityEvaluation,
} from "./authority/contracts"
import {
  careDirectionAxisFitResult,
  orderedAxisFitResult,
  repairSupportAxisFitResult,
} from "./authority/categories/axis-fit"
import { evaluateStage3Authority } from "./authority/evaluate"
import { supportiveOwnedRecommendation } from "./authority/supportive-owned-recommendation"
import { expectedShampooSpecTarget } from "./authority/categories/shampoo"
import { compactCriterionSchema } from "./fit-comparison-schema"

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

export type Stage3FitEvidenceRelation =
  | "in_target"
  | "supportive"
  | "outside_target"
  | "unknown"
  | "no_target"

export type Stage3FitEvidenceRow = {
  rowId: string
  label: string
  target: {
    valueLabel: string
    rationale: string
    profileEvidenceLabels: string[]
  } | null
  productValues: Array<{
    productId: string
    valueLabel: string
    relation: Stage3FitEvidenceRelation
  }>
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
      evidenceRows?: Stage3FitEvidenceRow[]
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
      evidenceRows?: Stage3FitEvidenceRow[]
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

export function stage3FitComparisonForTransport(
  comparison: Stage3FitComparison,
): Stage3FitComparison {
  if (comparison.dimensions.length === 0) return comparison
  // evidenceRows is the complete UI projection. The raw rail model is only needed while
  // building that projection server-side and otherwise duplicates labels, targets, and values.
  return { ...comparison, dimensions: [] }
}

type CandidateAssessment = Stage3SelectedComparisonCandidate & {
  catalogSortOrder: number | null | undefined
  facts: Stage3CategoryProductFacts
  targetMatchCount: number
  targetCount: number
}

type ComparisonProductEntry = {
  product: Stage3FitComparisonProduct
  facts: Stage3CategoryProductFacts
}

export function buildStage3FitComparison<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  subjectEvaluation?: Stage3AuthorityEvaluation,
  context?: Stage3EvaluationContext,
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
  const evidenceRows =
    dimensions.length > 0
      ? evidenceRowsFromDimensions(
          authorityInput,
          dimensions,
          entries,
          authorityEvaluation,
          selectedCandidates,
          context,
        )
      : compactEvidenceRows(authorityInput, authorityEvaluation, entries, selectedCandidates)

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
      evidenceRows,
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
    evidenceRows,
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
    .filter((candidate) => candidate.targetCount > 0 && candidate.targetMatchCount > 0)
    .sort((left, right) => {
      const uncoveredRole = isUncoveredRoleInput(input)
      const recommendationOrder =
        Number(right.productId === currentRecommendationProductId) -
        Number(left.productId === currentRecommendationProductId)
      const verdictOrder = verdictRank(left.verdict) - verdictRank(right.verdict)
      const coverageOrder = right.targetMatchCount - left.targetMatchCount
      if (uncoveredRole) {
        if (recommendationOrder !== 0) return recommendationOrder
        if (verdictOrder !== 0) return verdictOrder
        if (coverageOrder !== 0) return coverageOrder
      } else {
        if (coverageOrder !== 0) return coverageOrder
        if (recommendationOrder !== 0) return recommendationOrder
        if (verdictOrder !== 0) return verdictOrder
      }
      return compareCatalogOrder(left, right)
    })
}

function isUncoveredRoleInput(input: Stage3AuthorityInput): boolean {
  return (
    input.productFacts === null &&
    input.capturedProductId === null &&
    input.subjectIdentity === null
  )
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
  const recommendation = recommendationForCandidate(input, candidate, detached)
  if (!recommendation) return null
  const coverage = candidateTargetCoverage(input, candidate, detached.criteria)
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
    targetMatchCount: coverage.matches,
    targetCount: coverage.total,
  }
}

function candidateTargetCoverage(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
  criteria: readonly Stage3CriterionResult[],
): { matches: number; total: number } {
  const entry: ComparisonProductEntry = {
    product: {
      productId: candidate.productId,
      displayName: candidate.displayName,
      category: candidate.category,
      role: input.role,
      source: "alternative",
    },
    facts: candidate,
  }
  const dimensions = comparisonDimensions(input, [entry])
  if (dimensions.length > 0) {
    const targetDimensions = dimensions.filter(
      (dimension) => dimension.targetPosition && dimension.targetPosition.kind !== "unknown",
    )
    return {
      total: targetDimensions.length,
      matches: targetDimensions.filter((dimension) => {
        const position = dimension.productPositions[0]?.position ?? { kind: "unknown" as const }
        return positionsOverlap(position, dimension.targetPosition!)
      }).length,
    }
  }

  const schema = compactCriterionSchema(input.category, input.role)
  return {
    total: schema.length,
    matches: schema.filter(
      ({ criterionId }) =>
        criteria.find((criterion) => criterion.criterionId === criterionId)?.result === "pass",
    ).length,
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
  detached: Stage3KnownAuthorityEvaluation,
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
    return supportiveOwnedRecommendation(input, candidate, detached)
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

function evidenceRowsFromDimensions(
  input: Stage3AuthorityInput,
  dimensions: readonly Stage3FitComparisonDimension[],
  entries: readonly ComparisonProductEntry[],
  evaluation: Stage3AuthorityEvaluation,
  candidates: readonly CandidateAssessment[],
  context?: Stage3EvaluationContext,
): Stage3FitEvidenceRow[] {
  const criteriaByProduct = criteriaByProductId(evaluation, entries, candidates)
  const dimensionRows = dimensions.slice(0, 3).map((dimension) => ({
    rowId: dimension.dimensionId,
    label: dimension.label,
    target:
      dimension.targetPosition && dimension.targetPosition.kind !== "unknown"
        ? {
            valueLabel: positionLabel(dimension.targetPosition, dimension.stops),
            rationale: targetRationale(dimension.dimensionId),
            profileEvidenceLabels: profileEvidenceLabels(dimension.dimensionId, context).slice(
              0,
              2,
            ),
          }
        : null,
    productValues: dimension.productPositions.map(({ productId, position }) => {
      return {
        productId,
        valueLabel: positionLabel(position, dimension.stops),
        relation: dimensionRelation(
          input,
          dimension,
          position,
          criteriaByProduct.get(productId) ?? [],
        ),
      }
    }),
  }))
  const targetFit = conditionerTargetFitEvidenceRow(input, entries)
  return targetFit ? [targetFit, ...dimensionRows] : dimensionRows
}

function criteriaByProductId(
  evaluation: Stage3AuthorityEvaluation,
  entries: readonly ComparisonProductEntry[],
  candidates: readonly CandidateAssessment[],
): Map<string, readonly Stage3CriterionResult[]> {
  const result = new Map<string, readonly Stage3CriterionResult[]>()
  const currentProductId = entries.find((entry) => entry.product.source === "current")?.product
    .productId
  if (currentProductId && (evaluation.status === "known" || evaluation.status === "unknown"))
    result.set(currentProductId, evaluation.criteria)
  for (const candidate of candidates) result.set(candidate.productId, candidate.criteria)
  return result
}

function conditionerTargetFitEvidenceRow(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitEvidenceRow | null {
  if (input.category !== "conditioner" || !input.categoryDecision.target) return null
  return {
    rowId: "conditioner.target_fit",
    label: "Zielprofil-Eignung",
    target: {
      valueLabel: "abgedeckt",
      rationale: "Das Produkt muss das bestätigte Zielprofil vollständig abdecken.",
      profileEvidenceLabels: [],
    },
    productValues: entries.map(({ product, facts }) => {
      const targetFit = facts.category === "conditioner" ? facts.spec.targetFit : "unknown"
      return {
        productId: product.productId,
        valueLabel:
          targetFit === "matched"
            ? "abgedeckt"
            : targetFit === "known_mismatch"
              ? "nicht vollständig"
              : "nicht bestätigt",
        relation:
          targetFit === "matched"
            ? ("in_target" as const)
            : targetFit === "known_mismatch"
              ? ("outside_target" as const)
              : ("unknown" as const),
      }
    }),
  }
}

function dimensionRelation(
  input: Stage3AuthorityInput,
  dimension: Stage3FitComparisonDimension,
  position: Stage3FitComparisonPosition,
  criteria: readonly Stage3CriterionResult[],
): Stage3FitEvidenceRelation {
  if (position.kind === "unknown") return "unknown"
  if (!dimension.targetPosition || dimension.targetPosition.kind === "unknown") return "no_target"

  const criterionId =
    dimension.dimensionId === "oil.role_support" ? "oil.role" : dimension.dimensionId
  const criterion = criteria.find((item) => item.criterionId === criterionId)
  if (criterion && (input.category === "mask" || input.category === "oil"))
    return stage3CriterionEvidenceRelation(criterion.result)

  if (dimension.dimensionId.endsWith(".care_direction"))
    return positionAxisRelation(position, dimension.targetPosition, careDirectionAxisFitResult)

  if (
    dimension.dimensionId.endsWith(".weight") ||
    dimension.dimensionId === "shampoo.cleansing_intensity"
  )
    return positionAxisRelation(position, dimension.targetPosition, (product, target) =>
      orderedAxisFitResult(
        product,
        target,
        dimension.stops.map((stop) => stop.stopId),
      ),
    )

  if (dimension.dimensionId.endsWith(".repair_support"))
    return positionAxisRelation(position, dimension.targetPosition, (product, target) =>
      repairSupportAxisFitResult(
        product,
        target,
        dimension.stops.map((stop) => stop.stopId),
      ),
    )

  return relationToTarget(position, dimension.targetPosition)
}

function positionAxisRelation(
  product: Stage3FitComparisonPosition,
  target: Stage3FitComparisonPosition,
  resultFor: (product: string, target: string) => Stage3CriterionResult["result"],
): Stage3FitEvidenceRelation {
  if (product.kind === "unknown" || target.kind === "unknown") return "unknown"
  if (product.kind !== "position" || target.kind !== "position")
    return positionsOverlap(product, target) ? "in_target" : "outside_target"
  return stage3CriterionEvidenceRelation(resultFor(product.stopId, target.stopId))
}

function compactEvidenceRows(
  input: Stage3AuthorityInput,
  evaluation: Stage3AuthorityEvaluation,
  entries: readonly ComparisonProductEntry[],
  candidates: readonly CandidateAssessment[],
): Stage3FitEvidenceRow[] {
  const currentProductId = entries.find((entry) => entry.product.source === "current")?.product
    .productId
  const currentCriteria =
    evaluation.status === "known" || evaluation.status === "unknown" ? evaluation.criteria : []
  const criteriaByProduct = new Map<string, readonly Stage3CriterionResult[]>()
  if (currentProductId) criteriaByProduct.set(currentProductId, currentCriteria)
  for (const candidate of candidates) criteriaByProduct.set(candidate.productId, candidate.criteria)

  return compactCriterionSchema(input.category, input.role).map(({ criterionId, label }) => {
    return {
      rowId: criterionId,
      label,
      target: {
        valueLabel: "erfüllt",
        rationale: compactCriterionTargetRationale(),
        profileEvidenceLabels: [],
      },
      productValues: entries.map(({ product }) => {
        const criterion = criteriaByProduct
          .get(product.productId)
          ?.find((item) => item.criterionId === criterionId)
        return {
          productId: product.productId,
          valueLabel: criterionResultLabel(criterion?.result),
          relation: stage3CriterionEvidenceRelation(criterion?.result),
        }
      }),
    }
  })
}

function relationToTarget(
  product: Stage3FitComparisonPosition,
  target: Stage3FitComparisonPosition | null,
): Stage3FitEvidenceRelation {
  if (product.kind === "unknown") return "unknown"
  if (!target || target.kind === "unknown") return "no_target"
  return positionsOverlap(product, target) ? "in_target" : "outside_target"
}

function positionsOverlap(
  left: Stage3FitComparisonPosition,
  right: Stage3FitComparisonPosition,
): boolean {
  if (left.kind === "unknown" || right.kind === "unknown") return false
  const leftStops = left.kind === "position" ? [left.stopId] : left.stopIds
  const rightStops = new Set(right.kind === "position" ? [right.stopId] : right.stopIds)
  return leftStops.some((stopId) => rightStops.has(stopId))
}

function positionLabel(
  position: Stage3FitComparisonPosition,
  stops: readonly Stage3FitComparisonStop[],
): string {
  if (position.kind === "unknown") return "nicht bestätigt"
  const ids = position.kind === "position" ? [position.stopId] : position.stopIds
  const labels = ids.map((id) => stops.find((stop) => stop.stopId === id)?.label ?? id)
  return labels.join(", ")
}

export function stage3CriterionEvidenceRelation(
  result: Stage3CriterionResult["result"] | undefined,
): Stage3FitEvidenceRelation {
  switch (result) {
    case "pass":
      return "in_target"
    case "caution":
      return "supportive"
    case "fail":
      return "outside_target"
    case "unknown":
    case undefined:
      return "unknown"
  }
}

function criterionResultLabel(result: Stage3CriterionResult["result"] | undefined): string {
  switch (result) {
    case "pass":
      return "erfüllt"
    case "caution":
      return "passt mit Einschränkung"
    case "fail":
      return "nicht erfüllt"
    default:
      return "nicht bestätigt"
  }
}

function targetRationale(dimensionId: string): string {
  if (dimensionId.endsWith(".weight"))
    return "Dieses Pflegegewicht deckt deinen Bedarf ab, ohne dein Haar unnötig zu beschweren."
  if (dimensionId.endsWith(".care_direction"))
    return "Diese Pflegerichtung passt zu deinem aktuellen Feuchtigkeits- und Strukturbedarf."
  if (dimensionId.endsWith(".repair_support"))
    return "Diese Repair-Stufe entspricht der aktuell bestätigten Belastung deines Haares."
  if (dimensionId === "shampoo.scalp_route")
    return "Dieser Fokus passt zum bestätigten Zustand deiner Kopfhaut."
  if (dimensionId.endsWith(".heat_protection"))
    return "Vor Hitze ist ein bestätigter Schutz für diese Anwendung erforderlich."
  if (dimensionId === "oil.role_support")
    return "Das Produkt muss die ausgewählte Anwendung in deiner Routine ausdrücklich unterstützen."
  return "Dieser Zielwert stammt aus deinem bestätigten Bedarfsprofil."
}

function compactCriterionTargetRationale(): string {
  return "Für eine passende Produktempfehlung muss dieser Prüfpunkt erfüllt sein."
}

function profileEvidenceLabels(dimensionId: string, context?: Stage3EvaluationContext): string[] {
  if (!context) return []
  const profile = context.refinedNeedSnapshot.profile
  if (dimensionId.endsWith(".weight")) {
    const labels = [`${thicknessLabel(context.hairThickness)}es Haar`]
    if (profile.concerns?.includes("low_volume_or_weighed_down"))
      labels.push("wird schnell beschwert")
    return labels
  }
  if (dimensionId.endsWith(".care_direction")) {
    const labels: string[] = []
    if (profile.goals?.includes("moisture")) labels.push("Ziel: mehr Feuchtigkeit")
    if (profile.goals?.includes("strength_ends")) labels.push("Ziel: stärkere Längen")
    if (profile.hair.surface === "rough") labels.push("raue Haaroberfläche")
    return labels.length > 0 ? labels : ["bestätigtes Pflegeziel"]
  }
  if (dimensionId.endsWith(".repair_support")) {
    const labels: string[] = []
    if (profile.hair.chemicalTreatments?.some((treatment) => treatment !== "natural"))
      labels.push("chemisch behandeltes Haar")
    if (profile.concerns?.includes("breakage") || profile.concerns?.includes("split_ends"))
      labels.push("Bruch oder Spliss")
    return labels.length > 0 ? labels : ["aktuelle Belastung bestätigt"]
  }
  if (dimensionId === "shampoo.scalp_route")
    return profile.scalp?.oiliness
      ? [`${scalpOilinessLabel(profile.scalp.oiliness)}e Kopfhaut`]
      : []
  if (dimensionId.endsWith(".heat_protection")) return ["Hitzeanwendung bestätigt"]
  return []
}

function thicknessLabel(thickness: Stage3EvaluationContext["hairThickness"]): string {
  return thickness === "fine" ? "fein" : thickness === "coarse" ? "dick" : "mitteldick"
}

function scalpOilinessLabel(oiliness: "dry" | "balanced" | "oily"): string {
  return oiliness === "dry" ? "trocken" : oiliness === "oily" ? "fettig" : "ausgeglichen"
}

function shampooDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const completeTarget =
    target?.category === "shampoo" ? expectedShampooSpecTarget({ role: input.role, target }) : null
  const scalpRouteStops = [
    { stopId: "oily", label: "fettig" },
    { stopId: "balanced", label: "ausgeglichen" },
    { stopId: "dry", label: "trocken" },
    { stopId: "dandruff", label: "Schuppen" },
    { stopId: "dry_flakes", label: "trockene Schuppen" },
    { stopId: "irritated", label: "gereizt" },
  ]
  return [
    dimension(
      "shampoo.cleansing_intensity",
      "Reinigungsintensität",
      "ordered",
      [
        { stopId: "gentle", label: "sanft" },
        { stopId: "regular", label: "regulär" },
        { stopId: "clarifying", label: "klärend" },
      ],
      completeTarget?.cleansingIntensity ?? null,
      entries,
      (facts) =>
        facts.category === "shampoo"
          ? (facts.comparisonObservations?.cleansingIntensity ?? facts.spec.cleansingIntensity)
          : null,
      "Shampoo V1 zeigt gespeicherte Produktwerte ohne erfundenen Zielkorridor.",
    ),
    dimension(
      "shampoo.scalp_route",
      "Kopfhaut-Fokus",
      "set",
      scalpRouteStops,
      completeTarget?.scalpRoute ?? (target?.category === "shampoo" ? target.scalpRoute : null),
      entries,
      (facts) =>
        facts.category === "shampoo"
          ? facts.comparisonObservations?.supportedScalpRoutes.length
            ? facts.comparisonObservations.supportedScalpRoutes
            : facts.spec.scalpRoute
          : null,
      "Der Kopfhaut-Fokus kommt aus dem bestätigten Shampoo-Ziel.",
    ),
    dimension(
      "shampoo.suitable_thicknesses",
      "Geeignete Haardicke",
      "set",
      THICKNESS_STOPS,
      input.hairThickness ?? null,
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
      // The comparison rail intentionally uses the rerank observation. Authority continues to
      // evaluate proteinMoistureBalance against the selected target; these are separate facts.
      (facts) =>
        facts.category === "conditioner"
          ? canonicalCareDirection(facts.spec.balanceDirection)
          : null,
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

function canonicalCareDirection(value: string | null): "moisture" | "balanced" | "protein" | null {
  if (value === "moisture" || value === "snaps") return "moisture"
  if (value === "balanced" || value === "stretches_bounces") return "balanced"
  if (value === "protein" || value === "stretches_stays") return "protein"
  return null
}

function leaveInDimensions(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitComparisonDimension[] {
  const target = input.categoryDecision.target
  const includeHeatDimension = input.role === "pre_heat_application"
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
    input.hairThickness ?? null,
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
  { stopId: "balanced", label: "ausgeglichen" },
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
