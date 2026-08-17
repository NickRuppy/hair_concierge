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
import { compareRankableCandidates } from "./candidate-ranking"
import {
  candidateDimensionCoverage,
  comparisonDimensions,
  positionLabel,
  positionsOverlap,
  renderedDimensions,
  type ComparisonProductEntry,
  type Stage3FitComparisonDimension,
  type Stage3FitComparisonPosition,
  type Stage3FitComparisonProduct,
} from "./comparison-dimensions"
import { compactCriterionSchema } from "./fit-comparison-schema"

export type {
  ComparisonProductEntry,
  Stage3FitComparisonDimension,
  Stage3FitComparisonPosition,
  Stage3FitComparisonPresentationKind,
  Stage3FitComparisonProduct,
  Stage3FitComparisonStop,
} from "./comparison-dimensions"

export const STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT = 3

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
  cautionCount: number
  priceEur: number | null
}

export function buildStage3FitComparison<C extends PersonalPlanCategory>(
  input: Stage3AuthorityInput<C>,
  subjectEvaluation?: Stage3AuthorityEvaluation,
  context?: Stage3EvaluationContext,
): Stage3FitComparison {
  const authorityInput = input as unknown as Stage3AuthorityInput
  const authorityEvaluation = subjectEvaluation ?? evaluateStage3Authority(authorityInput)
  const selectedCandidates = boundedSelectedComparisonCandidateAssessments(authorityInput)
  const entries = [
    ...currentComparisonProductEntries(authorityInput, authorityEvaluation),
    ...alternativeProductEntries(authorityInput, selectedCandidates),
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
  input: Stage3AuthorityInput,
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
): CandidateAssessment[] {
  const currentProductId = input.productFacts?.productId ?? null
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
    .sort((left, right) =>
      compareRankableCandidates(toRankableCandidate(left), toRankableCandidate(right)),
    )
}

function toRankableCandidate(candidate: CandidateAssessment) {
  return {
    verdict: candidate.verdict,
    targetMatchCount: candidate.targetMatchCount,
    cautionCount: candidate.cautionCount,
    catalogSortOrder: candidate.catalogSortOrder,
    priceEur: candidate.priceEur,
    productId: candidate.productId,
  }
}

function boundedSelectedComparisonCandidateAssessments(
  input: Stage3AuthorityInput,
): CandidateAssessment[] {
  return selectedComparisonCandidateAssessments(input).slice(
    0,
    STAGE3_FIT_COMPARISON_ALTERNATIVE_LIMIT,
  )
}

function assessCandidate(
  input: Stage3AuthorityInput,
  candidate: Stage3CategoryProductFacts,
): CandidateAssessment | null {
  const detached = evaluateDetachedCandidate(input, candidate)
  if (!detached || (detached.verdict !== "ideal" && detached.verdict !== "supportive")) return null
  const recommendation = recommendationForCandidate(input, candidate, detached)
  if (!recommendation) return null
  const coverage = candidateDimensionCoverage(input, candidate, detached.criteria)
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
    cautionCount: detached.criteria.filter((criterion) => criterion.result === "caution").length,
    priceEur: candidate.priceEur ?? null,
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

function evidenceRowsFromDimensions(
  input: Stage3AuthorityInput,
  dimensions: readonly Stage3FitComparisonDimension[],
  entries: readonly ComparisonProductEntry[],
  evaluation: Stage3AuthorityEvaluation,
  candidates: readonly CandidateAssessment[],
  context?: Stage3EvaluationContext,
): Stage3FitEvidenceRow[] {
  const criteriaByProduct = criteriaByProductId(evaluation, entries, candidates)
  const dimensionRows = renderedDimensions(dimensions).map((dimension) => ({
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
  const leadingRow = bondbuilderApplicationEvidenceRow(input, entries)
  return leadingRow ? [leadingRow, ...dimensionRows] : dimensionRows
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
  if (
    criterion &&
    (input.category === "mask" || input.category === "oil" || input.category === "bondbuilder")
  )
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
  if (dimensionId === "bondbuilder.relationship")
    return "Ob ein Bondbuilder die Rolle eigenständig erfüllt, ist eine feste Produkteigenschaft – unabhängig von deinem Bedarfsprofil."
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

/**
 * The plan target for Bondbuilder is mechanism-neutral, so the application is a real product
 * difference without a profile target. It stays an explicit row instead of a dimension because
 * a targetless dimension would mark the whole review as not assessable.
 */
function bondbuilderApplicationEvidenceRow(
  input: Stage3AuthorityInput,
  entries: readonly ComparisonProductEntry[],
): Stage3FitEvidenceRow | null {
  if (input.category !== "bondbuilder") return null
  return {
    rowId: "bondbuilder.application",
    label: "Anwendung",
    target: {
      valueLabel: "beides möglich",
      rationale: "Beide Anwendungen erfüllen die Bond-Rolle. Entscheide nach deinem Alltag.",
      profileEvidenceLabels: [],
    },
    productValues: entries.map(({ product, facts }) => {
      const application =
        facts.category === "bondbuilder" ? bondbuilderApplication(facts.spec) : null
      return {
        productId: product.productId,
        valueLabel: application ?? "nicht bestätigt",
        relation: application ? ("in_target" as const) : ("unknown" as const),
      }
    }),
  }
}

type BondbuilderApplicationBucket = "pre_rinse" | "post_leave_in"

function bondbuilderApplicationModeBucket(
  mode: string | null,
): BondbuilderApplicationBucket | null {
  if (mode === "pre_shampoo") return "pre_rinse"
  if (mode === "post_wash_leave_in") return "post_leave_in"
  return null
}

function bondbuilderTreatmentModeBucket(mode: string | null): BondbuilderApplicationBucket | null {
  if (mode === "rinse_out") return "pre_rinse"
  if (mode === "leave_in") return "post_leave_in"
  return null
}

function bondbuilderApplication(spec: {
  applicationMode: string | null
  treatmentMode: string | null
}): string | null {
  const applicationBucket = bondbuilderApplicationModeBucket(spec.applicationMode)
  const treatmentBucket = bondbuilderTreatmentModeBucket(spec.treatmentMode)
  // Both axes are independent, unconstrained columns (see the admin form and migration CHECK
  // constraints) — nothing enforces they agree. Only assert the two-axis claim when they land in
  // the same bucket. When they disagree, fall back to the treatment axis alone (whether the
  // product is rinsed out or left in) instead of inventing a combined instruction.
  if (applicationBucket && treatmentBucket) {
    if (applicationBucket === treatmentBucket) {
      return applicationBucket === "pre_rinse" ? "Vorwäsche, ausspülen" : "Leave-in nach der Wäsche"
    }
    return treatmentBucket === "pre_rinse" ? "Ausspülen" : "Leave-in"
  }
  if (treatmentBucket) return treatmentBucket === "pre_rinse" ? "Ausspülen" : "Leave-in"
  if (applicationBucket) return applicationBucket === "pre_rinse" ? "Vorwäsche" : "Nach der Wäsche"
  return null
}
