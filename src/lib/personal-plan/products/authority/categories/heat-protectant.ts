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
  isInactiveOrRetired,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  protocolForRole,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

type HeatInput = Stage3AuthorityInput<"heat_protectant">

function hasCompleteProtocol(facts: Stage3HeatProtectantFacts, input: HeatInput): boolean {
  return facts.protocols.some(
    (protocol) => protocol.role === input.role && protocol.status === "verified_complete",
  )
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
    (candidate) =>
      candidate.isActive &&
      candidate.lifecycleStatus === "active" &&
      candidate.recommendable &&
      candidate.spec.providesHeatProtection === true &&
      commonUnknownFacts(
        { ...input, productFacts: candidate },
        { requiresSuitableThickness: false },
      ).length === 0 &&
      hasCompleteProtocol(candidate, input),
  )

  const candidates = [...sharedFit].sort(compareRecommendationCandidates)
  if (candidates.length === 0) return null
  if (candidates.length > 1 && compareRecommendationCandidates(candidates[0], candidates[1]) === 0) {
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
  const integratedCarrier =
    input.heatCarrierCoverage.carrierCategory !== null &&
    routes.every((route) => input.heatCarrierCoverage.verifiedRoutes.includes(route))

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
  const missingFacts = commonUnknownFacts(input, { requiresSuitableThickness: false })
  if (facts.spec.providesHeatProtection === null) missingFacts.push("provides_heat_protection")
  const protocol = protocolForRole(input)
  if (!protocol || protocol.status !== "verified_complete")
    missingFacts.push("application_protocol")
  if (missingFacts.length > 0) {
    return unknownEvaluation(input, missingFacts, [
      criterion(
        "heat_protectant.capability",
        "Verifizierter Hitzeschutz",
        "unknown",
        "Die Hitzeschutzfähigkeit oder das Anwendungsprotokoll ist noch nicht vollständig verifiziert.",
      ),
    ])
  }

  if (isInactiveOrRetired(input)) {
    return knownEvaluation(input, {
      verdict: "mismatch",
      criteria: [
        criterion(
          "heat_protectant.lifecycle",
          "Verfügbarkeit",
          "fail",
          "Das Produkt ist nicht aktiv.",
        ),
      ],
      allowedActions: ["leave_uncovered"],
      recommendation: null,
      productFactFingerprint: facts.factFingerprint,
      recommendationFactFingerprint: null,
    })
  }

  if (facts.spec.providesHeatProtection === false) {
    const candidate = recommendationCandidate(input)
    return knownEvaluation(input, {
      verdict: "mismatch",
      criteria: [
        criterion(
          "heat_protectant.capability",
          "Verifizierter Hitzeschutz",
          "fail",
          "Das Produkt besitzt keinen verifizierten Hitzeschutz und kann diese Rolle nicht abdecken.",
        ),
      ],
      allowedActions: candidate ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: candidate ? recommendation(candidate, input) : null,
      productFactFingerprint: facts.factFingerprint,
      recommendationFactFingerprint: candidate?.factFingerprint ?? null,
    })
  }

  return knownEvaluation(input, {
    verdict: "ideal",
    criteria: [
      criterion(
        "heat_protectant.capability",
        "Verifizierter Hitzeschutz",
        "pass",
        "Das Produkt deckt die Hitzeschutzrolle mit einem vollständigen Protokoll ab.",
      ),
    ],
    allowedActions: ["keep_owned"],
    recommendation: null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
