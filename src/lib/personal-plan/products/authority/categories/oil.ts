import type { FitAxis } from "../fit-evaluator"
import {
  commonFitGates,
  evaluateCriteria,
  THICKNESSES,
  thicknessReason,
  WEIGHTS,
  weightReason,
} from "../fit-criteria"
import type { PlanCategoryTarget, PlanProductRole } from "@/lib/personal-plan/types"

import type { Stage3AuthorityEvaluation, Stage3AuthorityInput, Stage3OilFacts } from "../contracts"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
import {
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

type OilRole = Extract<
  PlanProductRole,
  "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
>
type OilInput = Stage3AuthorityInput<"oil">

function targetForRole(input: OilInput) {
  const target = input.categoryDecision.target as Extract<
    PlanCategoryTarget,
    { category: "oil" }
  > | null
  return target?.roleTargets.find((roleTarget) => roleTarget.role === input.role) ?? null
}

function isLeaveOnRole(
  role: PlanProductRole,
): role is Exclude<OilRole, "pre_wash_fibre_treatment"> {
  return role === "leave_on_fibre_conditioning" || role === "dry_finish"
}

function evaluateFacts(input: OilInput, facts: Stage3OilFacts) {
  const roleSupport = facts.spec.roleSupport[input.role]
  const gates = commonFitGates(input, facts)
  gates.push({
    id: "oil.role",
    label: "Öl-Rolle",
    outcome: roleSupport == null ? "unknown" : roleSupport ? "pass" : "fail",
    reason: "Das Produkt unterstützt die zugeordnete Öl-Rolle nicht.",
  })
  const roleTarget = targetForRole(input)
  const axes: FitAxis[] = [
    {
      id: "oil.thickness",
      label: "Haardicke",
      scale: THICKNESSES,
      productValues:
        facts.spec.thicknesses === undefined ? facts.suitableThicknesses : facts.spec.thicknesses,
      targetValue: input.hairThickness ?? null,
      reason: thicknessReason,
    },
    ...(isLeaveOnRole(input.role)
      ? [
          {
            id: "oil.weight",
            label: "Formelgewicht",
            scale: WEIGHTS,
            productValues: facts.spec.weight ? [facts.spec.weight] : null,
            acceptedTargets:
              roleTarget?.acceptedTargets ?? (roleTarget?.weight ? [roleTarget.weight] : []),
            reason: weightReason,
          } satisfies FitAxis,
        ]
      : []),
  ]
  const result = evaluateCriteria(input, facts, gates, axes, {
    "oil.role": ["oil.role_support"],
    "oil.thickness": ["oil.thickness_eligibility"],
    verified_protocol: ["application_protocol"],
  })
  const roleCriterion = result.criteria.find((row) => row.criterionId === "oil.role")!
  if (roleCriterion.result === "pass")
    roleCriterion.explanation = "Das Produkt unterstützt die zugeordnete Öl-Rolle."
  return result
}

function bestOilCandidate(
  input: OilInput,
): { candidate: Stage3OilFacts; verdict: "ideal" | "supportive" } | null {
  const rankable = input.recommendationCandidates
    .filter((candidate) => candidate.recommendable)
    .map((candidate) => ({ candidate, verdict: evaluateFacts(input, candidate).verdict }))
    .filter(
      (entry): entry is { candidate: Stage3OilFacts; verdict: "ideal" | "supportive" } =>
        entry.verdict === "ideal" || entry.verdict === "supportive",
    )
    .map((entry) => ({
      entry,
      rank: {
        verdict: entry.verdict,
        targetMatchCount: candidateDimensionCoverage(input as never, entry.candidate, []).matches,
        cautionCount: entry.verdict === "supportive" ? 1 : 0,
        catalogSortOrder: entry.candidate.catalogSortOrder,
        priceEur: entry.candidate.priceEur ?? null,
        productId: entry.candidate.productId,
      } satisfies RankableCandidate,
    }))
    .sort((left, right) => compareRankableCandidates(left.rank, right.rank))
  return rankable[0]?.entry ?? null
}

export function recommendationForOil(
  candidate: Stage3OilFacts,
  input: OilInput,
  supportive = false,
) {
  return {
    recommendationId: `oil:${input.role}:${candidate.productId}`,
    productId: candidate.productId,
    category: candidate.category,
    role: input.role,
    displayName: candidate.displayName,
    reason: supportive
      ? evaluateFacts(input, candidate).criteria.find((item) => item.result === "caution")!
          .explanation
      : "Verifiziert für diese Öl-Rolle mit vollständigem Anwendungsprotokoll.",
    authorityRuleId: supportive
      ? "oil.recommendation.role_verified_supportive_weight"
      : "oil.recommendation.role_verified",
  }
}

export function recommendationForSupportiveOil(candidate: Stage3OilFacts, input: OilInput) {
  return evaluateFacts(input, candidate).verdict === "supportive"
    ? recommendationForOil(candidate, input, true)
    : null
}

export function evaluateOilAuthority(input: OilInput): Stage3AuthorityEvaluation {
  if (!hasValidTarget(input)) return unsupportedEvaluation(input, "oil_target_unavailable")
  if (isPendingIdentity(input)) return pendingEvaluation(input)

  const roleTarget = targetForRole(input)
  if (!roleTarget) return unsupportedEvaluation(input, "oil_role_target_unavailable")

  if (!input.productFacts) {
    if (input.capturedProductId) return unknownEvaluation(input, ["catalog_product_facts"])
    const best = bestOilCandidate(input)
    return knownEvaluation(input, {
      verdict: best?.verdict ?? "unknown",
      criteria: best ? evaluateFacts(input, best.candidate).criteria : [],
      allowedActions: best ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: best
        ? recommendationForOil(best.candidate, input, best.verdict === "supportive")
        : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: best?.candidate.factFingerprint ?? null,
    })
  }

  const facts = input.productFacts
  const result = evaluateFacts(input, facts)
  if (result.verdict === "unknown") return unknownEvaluation(input, result.missing, result.criteria)
  const best = result.verdict === "mismatch" ? bestOilCandidate(input) : null
  return knownEvaluation(input, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? best
          ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
          : ["acknowledge_override", "leave_uncovered"]
        : result.verdict === "supportive"
          ? ["keep_owned", "acknowledge_override", "leave_uncovered"]
          : ["keep_owned"],
    recommendation: best
      ? recommendationForOil(best.candidate, input, best.verdict === "supportive")
      : null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: best?.candidate.factFingerprint ?? null,
  })
}
