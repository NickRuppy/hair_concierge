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
import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3ConditionerFacts,
} from "../contracts"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
import {
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"
function evaluateFacts(input: Stage3AuthorityInput<"conditioner">, facts: Stage3ConditionerFacts) {
  const target = input.categoryDecision.target
  if (!target || target.category !== "conditioner") return evaluateCriteria(input, facts, [], [])
  const gates = commonFitGates(input, facts)
  gates.push({
    id: "conditioner.target_fit",
    label: "Conditioner-Passung",
    outcome: facts.spec.targetFit === "unknown" ? "unknown" : "pass",
  })
  const axes: FitAxis[] = [
    {
      id: "conditioner.thickness",
      label: "Haardicke",
      scale: THICKNESSES,
      productValues:
        facts.spec.thicknesses === undefined
          ? facts.spec.thickness
            ? [facts.spec.thickness]
            : null
          : facts.spec.thicknesses,
      targetValue: input.hairThickness ?? null,
      reason: thicknessReason,
    },
    {
      id: "conditioner.weight",
      label: "Gewicht",
      scale: WEIGHTS,
      productValues: facts.spec.weight ? [facts.spec.weight] : null,
      targetValue: target.weight,
      reason: weightReason,
    },
    {
      id: "conditioner.balance",
      label: "Pflegebalance",
      scale: CARE_DIRECTIONS,
      productValues: facts.spec.proteinMoistureBalance ? [facts.spec.proteinMoistureBalance] : null,
      targetValue: target.careDirection,
      reason: careDirectionReason,
    },
    {
      id: "conditioner.repair",
      label: "Repair-Unterstützung",
      scale: ["low", "medium", "high"],
      productValues: facts.spec.repairSupportLevel ? [facts.spec.repairSupportLevel] : null,
      targetValue: target.repairSupportLevel,
      direction: "at_or_above_is_zero",
      reason: () => "Weniger Reparatur, als dein Haar braucht",
    },
  ]
  const result = evaluateCriteria(input, facts, gates, axes, {
    "conditioner.thickness": ["thickness"],
    "conditioner.weight": ["weight"],
    "conditioner.balance": ["protein_moisture_balance"],
    "conditioner.repair": ["repair_support_level"],
  })
  if (result.verdict !== "mismatch")
    result.criteria.unshift(
      criterion(
        "conditioner.fit",
        "Conditioner-Passung",
        result.verdict === "supportive"
          ? "caution"
          : result.verdict === "unknown"
            ? "unknown"
            : "pass",
        result.verdict === "supportive"
          ? result.criteria.find((item) => item.result === "caution")!.explanation
          : result.verdict === "unknown"
            ? "Noch nicht geprüft."
            : "Gewicht, Pflegebalance und Repair-Unterstützung passen.",
      ),
    )
  return result
}

function recommendationForConditioner(
  candidate: Stage3ConditionerFacts,
  input: Stage3AuthorityInput<"conditioner">,
  supportive = false,
) {
  return {
    recommendationId: `recommend:${candidate.productId}:${input.role}`,
    productId: candidate.productId,
    category: "conditioner" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason: supportive
      ? evaluateFacts(input, candidate).criteria.find((item) => item.result === "caution")!
          .explanation
      : "Passt zum Conditioner-Zielprofil.",
    authorityRuleId: "conditioner.selection.core_fit",
  }
}

function bestCandidate(input: Stage3AuthorityInput<"conditioner">) {
  const candidates = input.recommendationCandidates
    .filter((item) => item.recommendable)
    .map((item) => ({ item, result: evaluateFacts(input, item) }))
  const rankable = candidates
    .filter(
      (
        candidate,
      ): candidate is typeof candidate & { result: { verdict: "ideal" | "supportive" } } =>
        candidate.result.verdict === "ideal" || candidate.result.verdict === "supportive",
    )
    .map((candidate) => ({
      candidate,
      rank: {
        verdict: candidate.result.verdict,
        targetMatchCount: candidateDimensionCoverage(
          input as never,
          candidate.item,
          candidate.result.criteria,
        ).matches,
        cautionCount: candidate.result.criteria.filter((c) => c.result === "caution").length,
        catalogSortOrder: candidate.item.catalogSortOrder,
        priceEur: candidate.item.priceEur ?? null,
        productId: candidate.item.productId,
      } satisfies RankableCandidate,
    }))
    .sort((left, right) => compareRankableCandidates(left.rank, right.rank))
  return rankable[0]?.candidate
}

export const evaluateConditionerAuthority: Stage3CategoryAuthorityAdapter<"conditioner"> = (
  input: Stage3AuthorityInput<"conditioner">,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never))
    return unsupportedEvaluation(input as never, "conditioner_target_unavailable")
  if (!input.productFacts) {
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    const selected = bestCandidate(input)
    if (!selected)
      return knownEvaluation(input as never, {
        verdict: "unknown",
        criteria: [],
        allowedActions: ["leave_uncovered"],
        recommendation: null,
        productFactFingerprint: null,
        recommendationFactFingerprint: null,
      })
    return knownEvaluation(input as never, {
      verdict: selected.result.verdict,
      criteria: selected.result.criteria,
      allowedActions: ["plan_recommendation", "leave_uncovered"],
      recommendation: recommendationForConditioner(
        selected.item,
        input,
        selected.result.verdict === "supportive",
      ),
      productFactFingerprint: null,
      recommendationFactFingerprint: selected.item.factFingerprint,
    })
  }
  const result = evaluateFacts(input, input.productFacts)
  if (result.verdict === "unknown")
    return unknownEvaluation(input as never, result.missing ?? [], result.criteria)
  const best = result.verdict === "mismatch" ? bestCandidate(input) : null
  return knownEvaluation(input as never, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? best
          ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
          : ["acknowledge_override", "leave_uncovered"]
        : result.verdict === "supportive"
          ? ["keep_owned", "leave_uncovered"]
          : ["keep_owned"],
    recommendation: best
      ? recommendationForConditioner(best.item, input, best.result.verdict === "supportive")
      : null,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: best?.item.factFingerprint ?? null,
  })
}
