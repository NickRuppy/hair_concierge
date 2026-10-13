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
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3LeaveInFacts,
} from "../contracts"
import {
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"
function supportsPostWashApplication(stages: readonly string[]) {
  return stages.some((stage) => stage === "towel_dry" || stage === "damp" || stage === "wet")
}

function evaluateFacts(input: Stage3AuthorityInput<"leave_in">, facts: Stage3LeaveInFacts) {
  const target = input.categoryDecision.target
  if (!target || target.category !== "leave_in") return evaluateCriteria(input, facts, [], [])
  const gates = commonFitGates(input, facts)
  const protocol = facts.protocols.find((item) => item.role === input.role)
  const requiredFunctions = target.functions
    .filter((item) => item.ownership === "required")
    .map((item) => item.function)
  gates.push(
    {
      id: "leave_in.role",
      label: "Leave-in-Rolle",
      outcome:
        facts.spec.roles === null
          ? "unknown"
          : facts.category !== "leave_in" || !facts.spec.roles.includes(input.role as never)
            ? "fail"
            : "pass",
      reason: "Das Produkt deckt die erforderliche Leave-in-Rolle nicht ab.",
    },
    {
      id: "leave_in.application",
      label: "Anwendungszeitpunkt",
      outcome:
        facts.spec.applicationStages === null
          ? "unknown"
          : input.role === "pre_heat_application"
            ? facts.spec.providesHeatProtection === null || protocol?.status !== "verified_complete"
              ? "unknown"
              : facts.spec.providesHeatProtection
                ? "pass"
                : "fail"
            : supportsPostWashApplication(facts.spec.applicationStages)
              ? "pass"
              : "fail",
      reason:
        input.role === "pre_heat_application"
          ? "Die Anwendung vor Hitze ist nicht bestätigt."
          : "Die Anwendung auf feuchtem Haar ist nicht bestätigt.",
    },
  )
  if (input.role === "pre_heat_application")
    gates.push({
      id: "leave_in.heat",
      label: "Hitzeschutz",
      outcome:
        facts.spec.providesHeatProtection === null
          ? "unknown"
          : facts.spec.providesHeatProtection
            ? "pass"
            : "fail",
      reason: "Der Hitzeschutz ist nicht verifiziert.",
    })
  if (requiredFunctions.length)
    gates.push({
      id: "leave_in.functions",
      label: "Pflegefunktionen",
      outcome:
        facts.spec.careBenefits === null
          ? "unknown"
          : requiredFunctions.some((required) => !facts.spec.careBenefits!.includes(required))
            ? "fail"
            : "pass",
      reason: "Das Produkt deckt eine erforderliche Leave-in-Funktion nicht ab.",
    })
  const axes: FitAxis[] = [
    {
      id: "leave_in.thickness",
      label: "Haarstärke",
      scale: THICKNESSES,
      productValues: facts.suitableThicknesses,
      targetValue: input.hairThickness ?? null,
      reason: thicknessReason,
    },
    {
      id: "leave_in.weight",
      label: "Gewicht",
      scale: WEIGHTS,
      productValues: facts.spec.weight ? [facts.spec.weight] : null,
      targetValue: target.weight,
      reason: weightReason,
    },
    {
      id: "leave_in.care_direction",
      label: "Pflegeausrichtung",
      scale: CARE_DIRECTIONS,
      productValues: facts.spec.careDirection ? [facts.spec.careDirection] : null,
      targetValue: target.careDirection,
      reason: careDirectionReason,
    },
    {
      id: "leave_in.repair_support",
      label: "Repair-Unterstützung",
      scale: ["low", "medium", "high"],
      productValues: facts.spec.repairSupportLevel ? [facts.spec.repairSupportLevel] : null,
      targetValue: target.repairSupportLevel,
      direction: "at_or_above_is_zero",
      reason: () => "Weniger Reparatur, als dein Haar braucht",
    },
  ]
  const result = evaluateCriteria(input, facts, gates, axes, {
    "leave_in.thickness": ["suitable_thicknesses"],
    "leave_in.weight": ["weight"],
    "leave_in.care_direction": ["care_direction"],
    "leave_in.repair_support": ["repair_support_level"],
    "leave_in.role": ["plan_roles"],
    "leave_in.application": ["application_stage"],
    "leave_in.heat": ["provides_heat_protection"],
    "leave_in.functions": ["care_benefits"],
  })
  if (result.verdict !== "mismatch")
    result.criteria.unshift(
      criterion(
        "leave_in.fit",
        "Leave-in-Passung",
        result.verdict === "supportive"
          ? "caution"
          : result.verdict === "unknown"
            ? "unknown"
            : "pass",
        result.verdict === "supportive"
          ? result.criteria.find((item) => item.result === "caution")!.explanation
          : result.verdict === "unknown"
            ? "Noch nicht geprüft."
            : "Rolle, Gewicht und Pflegeausrichtung passen.",
      ),
    )
  return result
}

export const evaluateLeaveInAuthority: Stage3CategoryAuthorityAdapter<"leave_in"> = (
  input: Stage3AuthorityInput<"leave_in">,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never))
    return unsupportedEvaluation(input as never, "leave_in_target_unavailable")
  if (!input.productFacts) {
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
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
    const selected = rankable[0]?.candidate
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
      recommendation: {
        recommendationId: `recommend:${selected.item.productId}:${input.role}`,
        productId: selected.item.productId,
        category: "leave_in",
        role: input.role,
        displayName: selected.item.displayName,
        reason:
          selected.result.verdict === "supportive"
            ? selected.result.criteria.find((item) => item.result === "caution")!.explanation
            : "Passt zur erforderlichen Leave-in-Rolle.",
        authorityRuleId: "leave_in.selection.role_fit",
      },
      productFactFingerprint: null,
      recommendationFactFingerprint: selected.item.factFingerprint,
    })
  }
  const result = evaluateFacts(input, input.productFacts)
  if (result.verdict === "unknown")
    return unknownEvaluation(input as never, result.missing ?? [], result.criteria)
  const replacement =
    result.verdict === "mismatch"
      ? evaluateLeaveInAuthority({
          ...input,
          productFacts: null,
          capturedProductId: null,
          subjectIdentity: null,
        })
      : null
  const recommendation = replacement?.status === "known" ? replacement.recommendation : null
  return knownEvaluation(input as never, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? recommendation
          ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
          : ["acknowledge_override", "leave_uncovered"]
        : result.verdict === "supportive"
          ? ["keep_owned", "leave_uncovered"]
          : ["keep_owned"],
    recommendation,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint:
      replacement?.status === "known" ? replacement.recommendationFactFingerprint : null,
  })
}
