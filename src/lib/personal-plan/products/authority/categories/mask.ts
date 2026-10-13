import type { FitAxis } from "../fit-evaluator"
import {
  commonFitGates,
  evaluateCriteria,
  THICKNESSES,
  thicknessReason,
  WEIGHTS,
  weightReason,
  CARE_DIRECTIONS,
  careDirectionReason,
} from "../fit-criteria"
import type { Stage3AuthorityEvaluation, Stage3AuthorityInput, Stage3MaskFacts } from "../contracts"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import { maskAcceptedCareDirections } from "./axis-fit"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
import {
  hasValidTarget,
  isInactiveOrRetired,
  isPendingIdentity,
  knownEvaluation,
  protocolForRole,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

export function recommendationForMask(
  product: Stage3MaskFacts,
  supportive = false,
  supportiveReason?: string,
) {
  return {
    recommendationId: `recommendation:mask:${product.productId}`,
    productId: product.productId,
    category: "mask" as const,
    role: "intensive_conditioning_mask" as const,
    displayName: product.displayName,
    reason: supportive
      ? (supportiveReason ?? "Deckt die Masken-Rolle mit einer begrenzten Abweichung vom Ziel ab.")
      : "Deckt die bestätigten Masken-Ziele ab.",
    authorityRuleId: supportive
      ? "mask.stage3.validated_supportive_candidate"
      : "mask.stage3.validated_candidate",
  }
}

function evaluateProduct(input: Stage3AuthorityInput<"mask">, product: Stage3MaskFacts) {
  const target = input.categoryDecision.target
  if (!target || target.category !== "mask") return null
  const requiredBenefits = target.functionalNeeds
    .filter((need) => need.ownership === "required")
    .map((need) => need.need)
  const gates = commonFitGates(input, product).map((gate) =>
    gate.id === "verified_protocol"
      ? {
          ...gate,
          id: "mask.protocol",
          reason: "Kontaktzeit oder Conditioner-Reihenfolge ist nicht vollständig verifiziert.",
        }
      : gate,
  )
  gates.push({
    id: "mask.role",
    label: "Masken-Rolle",
    outcome:
      product.category === "mask" && input.role === "intensive_conditioning_mask" ? "pass" : "fail",
    reason: "Das Produkt deckt die Masken-Rolle nicht ab.",
  })
  if (requiredBenefits.length)
    gates.push({
      id: "mask.functional_benefits",
      label: "Funktionsnutzen",
      outcome:
        product.spec.functionalBenefits === null
          ? "unknown"
          : requiredBenefits.some((benefit) => !product.spec.functionalBenefits!.includes(benefit))
            ? "fail"
            : "pass",
      reason: "Das Produkt deckt eine erforderliche Masken-Funktion nicht ab.",
    })
  const axes: FitAxis[] = [
    {
      id: "mask.thickness",
      label: "Haarstärke",
      scale: THICKNESSES,
      productValues: product.suitableThicknesses,
      targetValue: input.hairThickness ?? null,
      reason: thicknessReason,
    },
    {
      id: "mask.weight",
      label: "Gewicht",
      scale: WEIGHTS,
      productValues: product.spec.weight ? [product.spec.weight] : null,
      targetValue: target.weight,
      reason: weightReason,
    },
    {
      id: "mask.care_direction",
      label: "Pflegerichtung",
      scale: CARE_DIRECTIONS,
      productValues: product.spec.careDirection ? [product.spec.careDirection] : null,
      acceptedTargets: maskAcceptedCareDirections(target),
      reason: careDirectionReason,
    },
    {
      id: "mask.repair_support",
      label: "Repair-Unterstützung",
      scale: ["low", "medium", "high"],
      productValues: product.spec.repairSupportLevel ? [product.spec.repairSupportLevel] : null,
      targetValue: target.repairSupportLevel,
      direction: "at_or_above_is_zero",
      reason: () => "Weniger Reparatur, als dein Haar braucht",
    },
  ]
  const result = evaluateCriteria(input, product, gates, axes, {
    "mask.thickness": product.suitableThicknesses?.length
      ? ["mask.thickness"]
      : ["suitable_thicknesses"],
  })
  return result
}

export function evaluateMaskAuthority(
  input: Stage3AuthorityInput<"mask">,
): Stage3AuthorityEvaluation {
  const sharedInput = input as Stage3AuthorityInput
  if (!hasValidTarget(sharedInput))
    return unsupportedEvaluation(sharedInput, "mask_target_unavailable")
  if (isPendingIdentity(sharedInput))
    return {
      status: "pending",
      category: input.category,
      subjectKey: input.subjectKey,
      reason: "product_intake_pending",
      allowedActions: ["keep_pending", "leave_uncovered"],
      coverageRuleIds: [],
    }
  if (!input.productFacts && input.capturedProductId)
    return unknownEvaluation(sharedInput, ["catalog_product_facts"])
  if (!input.productFacts) {
    const eligible = input.recommendationCandidates
      .filter(
        (candidate) =>
          candidate.recommendable &&
          candidate.isActive &&
          candidate.lifecycleStatus === "active" &&
          Boolean(candidate.presentationImageUrl?.trim()),
      )
      .map((candidate) => ({ candidate, assessment: evaluateProduct(input, candidate) }))
      .filter(
        (entry): entry is typeof entry & { assessment: { verdict: "ideal" | "supportive" } } =>
          entry.assessment?.verdict === "ideal" || entry.assessment?.verdict === "supportive",
      )
      .map((entry) => ({
        entry,
        rank: {
          verdict: entry.assessment.verdict,
          targetMatchCount: candidateDimensionCoverage(
            input as never,
            entry.candidate,
            entry.assessment.criteria,
          ).matches,
          cautionCount: entry.assessment.criteria.filter((c) => c.result === "caution").length,
          catalogSortOrder: entry.candidate.catalogSortOrder,
          priceEur: entry.candidate.priceEur ?? null,
          productId: entry.candidate.productId,
        } satisfies RankableCandidate,
      }))
      .sort((left, right) => compareRankableCandidates(left.rank, right.rank))[0]?.entry
    return knownEvaluation(sharedInput, {
      // A recommendation can be ideal; an absent owned product cannot be.
      // Keep the uncovered state explicit when the catalog yields no candidate.
      verdict: eligible?.assessment?.verdict ?? "unknown",
      criteria: eligible?.assessment?.criteria ?? [],
      allowedActions: eligible ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: eligible
        ? recommendationForMask(
            eligible.candidate,
            eligible.assessment?.verdict === "supportive",
            eligible.assessment.criteria.find((item) => item.result === "caution")?.explanation,
          )
        : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: eligible?.candidate.factFingerprint ?? null,
    })
  }
  const assessment = evaluateProduct(input, input.productFacts)
  if (!assessment) return unsupportedEvaluation(sharedInput, "mask_target_unavailable")
  if (assessment.verdict === "unknown") {
    return unknownEvaluation(sharedInput, assessment.missing, assessment.criteria)
  }
  const replacement =
    assessment.verdict === "mismatch"
      ? evaluateMaskAuthority({
          ...input,
          productFacts: null,
          capturedProductId: null,
          subjectIdentity: null,
        })
      : null
  const recommendation =
    replacement?.status === "known"
      ? replacement.recommendation
      : input.productFacts.recommendable &&
          !isInactiveOrRetired(sharedInput) &&
          (assessment.verdict === "ideal" || assessment.verdict === "supportive") &&
          protocolForRole(sharedInput)?.status === "verified_complete"
        ? recommendationForMask(
            input.productFacts,
            assessment.verdict === "supportive",
            assessment.criteria.find((item) => item.result === "caution")?.explanation,
          )
        : null
  return knownEvaluation(sharedInput, {
    verdict: assessment.verdict,
    criteria: assessment.criteria,
    allowedActions:
      assessment.verdict === "ideal"
        ? ["keep_owned"]
        : assessment.verdict === "mismatch"
          ? recommendation
            ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
            : ["acknowledge_override", "leave_uncovered"]
          : ["keep_owned", "leave_uncovered"],
    recommendation,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint:
      replacement?.status === "known"
        ? replacement.recommendationFactFingerprint
        : recommendation
          ? input.productFacts.factFingerprint
          : null,
  })
}
