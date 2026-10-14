import { evaluateGateCriteria } from "../fit-criteria"
import type { PlanCategoryTarget } from "@/lib/personal-plan/types"

import type {
  Stage3AuthorityEvaluation,
  Stage3AuthorityInput,
  Stage3HeatProtectantFacts,
} from "../contracts"
import {
  commonUnknownFacts,
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  protocolForRole,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

type HeatInput = Stage3AuthorityInput<"heat_protectant">

function evaluateFacts(input: HeatInput, facts: Stage3HeatProtectantFacts) {
  const missing = commonUnknownFacts(
    { ...input, productFacts: facts },
    { requiresSuitableThickness: false },
  )
  if (facts.spec.providesHeatProtection === null) missing.push("provides_heat_protection")
  if (protocolForRole({ ...input, productFacts: facts })?.status !== "verified_complete")
    missing.push("application_protocol")
  const capability =
    facts.spec.providesHeatProtection === null
      ? "unknown"
      : facts.spec.providesHeatProtection
        ? "pass"
        : "fail"
  const criteria = [
    criterion(
      "heat_protectant.capability",
      "Verifizierter Hitzeschutz",
      capability,
      capability === "pass"
        ? "Das Produkt deckt die Hitzeschutzrolle mit einem vollständigen Protokoll ab."
        : capability === "fail"
          ? "Das Produkt besitzt keinen verifizierten Hitzeschutz und kann diese Rolle nicht abdecken."
          : "Die Hitzeschutzfähigkeit oder das Anwendungsprotokoll ist noch nicht vollständig verifiziert.",
    ),
  ]
  // Keep the existing unknown capability row for incomplete application facts.
  if (missing.length > 0 && capability === "pass")
    criteria[0] = criterion(
      "heat_protectant.capability",
      "Verifizierter Hitzeschutz",
      "unknown",
      "Die Hitzeschutzfähigkeit oder das Anwendungsprotokoll ist noch nicht vollständig verifiziert.",
    )
  return evaluateGateCriteria(input, facts, criteria, missing)
}

function stableCandidateName(candidate: Stage3HeatProtectantFacts): string {
  return candidate.displayName
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("de-DE")
}

function compareRecommendationCandidates(
  left: Stage3HeatProtectantFacts,
  right: Stage3HeatProtectantFacts,
): number {
  const leftCatalogOrder = left.catalogSortOrder ?? Number.MAX_SAFE_INTEGER
  const rightCatalogOrder = right.catalogSortOrder ?? Number.MAX_SAFE_INTEGER
  return (
    leftCatalogOrder - rightCatalogOrder ||
    stableCandidateName(left).localeCompare(stableCandidateName(right), "de-DE")
  )
}

function recommendationCandidate(input: HeatInput): Stage3HeatProtectantFacts | null {
  const sharedFit = input.recommendationCandidates.filter(
    (candidate) => candidate.recommendable && evaluateFacts(input, candidate).verdict === "ideal",
  )

  const candidates = [...sharedFit].sort(compareRecommendationCandidates)
  if (candidates.length === 0) return null
  if (
    candidates.length > 1 &&
    compareRecommendationCandidates(candidates[0], candidates[1]) === 0
  ) {
    return null
  }
  return candidates[0]
}

function recommendation(candidate: Stage3HeatProtectantFacts, input: HeatInput) {
  return {
    recommendationId: `heat-protectant:${input.role}:${candidate.productId}`,
    productId: candidate.productId,
    category: candidate.category,
    role: input.role,
    displayName: candidate.displayName,
    reason: "Verifizierter Hitzeschutz mit vollständigem Anwendungsprotokoll.",
    authorityRuleId: "heat_protectant.recommendation.verified_carrier",
  }
}

export function evaluateHeatProtectantAuthority(input: HeatInput): Stage3AuthorityEvaluation {
  if (!hasValidTarget(input)) {
    return unsupportedEvaluation(input, "heat_protectant_target_unavailable")
  }
  if (isPendingIdentity(input)) return pendingEvaluation(input)

  const target = input.categoryDecision.target as Extract<
    PlanCategoryTarget,
    { category: "heat_protectant" }
  > | null
  const routes = target?.qualifyingRoutes ?? []
  const qualifyingEventIds = input.heatCarrierCoverage.qualifyingEventIds
  const integratedCarrier =
    input.heatCarrierCoverage.carrierCategory !== null &&
    (qualifyingEventIds && qualifyingEventIds.length > 0
      ? qualifyingEventIds.every((eventId) =>
          input.heatCarrierCoverage.verifiedEventIds?.includes(eventId),
        )
      : routes.every((route) => input.heatCarrierCoverage.verifiedRoutes.includes(route)))

  if (!input.productFacts) {
    if (integratedCarrier) {
      return knownEvaluation(input, {
        verdict: "ideal",
        criteria: [
          criterion(
            "heat_protectant.carrier.verified",
            "Verifizierter Träger",
            "pass",
            "Ein bereits passender Träger deckt alle qualifizierenden Hitzeereignisse ab.",
          ),
        ],
        allowedActions: ["leave_uncovered"],
        recommendation: null,
        productFactFingerprint: null,
        recommendationFactFingerprint: null,
      })
    }

    const candidate = recommendationCandidate(input)
    return knownEvaluation(input, {
      verdict: "mismatch",
      criteria: [
        criterion(
          "heat_protectant.carrier.uncovered",
          "Hitzeschutz",
          "fail",
          "Für die qualifizierenden Hitzeereignisse ist kein verifizierter Träger zugeordnet.",
        ),
      ],
      allowedActions: candidate ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: candidate ? recommendation(candidate, input) : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: candidate?.factFingerprint ?? null,
    })
  }

  const facts = input.productFacts
  const result = evaluateFacts(input, facts)
  if (result.verdict === "unknown") return unknownEvaluation(input, result.missing, result.criteria)
  const candidate = result.verdict === "mismatch" ? recommendationCandidate(input) : null
  return knownEvaluation(input, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? candidate
          ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
          : ["acknowledge_override", "leave_uncovered"]
        : ["keep_owned"],
    recommendation: candidate ? recommendation(candidate, input) : null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: candidate?.factFingerprint ?? null,
  })
}
