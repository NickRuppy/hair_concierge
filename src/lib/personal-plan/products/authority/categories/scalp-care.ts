import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3ScalpCareFacts,
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

type ScalpCareInput = Stage3AuthorityInput<"scalp_care">

function coverageSuppressesPurchase(input: ScalpCareInput): boolean {
  return input.coverage.some(
    (fact) =>
      fact.outcome === "duplicate_purchase_suppressed" &&
      (fact.job === "scalp_flake_or_comfort" || fact.job === "scalp_root_reset"),
  )
}

function productMissingFacts(input: ScalpCareInput, facts: Stage3ScalpCareFacts): string[] {
  const missing = commonUnknownFacts(input)
  if (facts.spec.primaryRole === null) missing.push("primary_role")
  if (facts.spec.presentationFormat === null || facts.spec.presentationFormat === "unknown") {
    missing.push("presentation_format")
  }
  if (facts.spec.rinseMode === null) missing.push("rinse_mode")
  const protocol = protocolForRole(input)
  if (protocol?.status !== "verified_complete") missing.push("application_protocol")
  return [...new Set(missing)].sort()
}

function isRecommendableForRole(
  facts: Stage3ScalpCareFacts,
  role: ScalpCareInput["role"],
): boolean {
  const protocol = facts.protocols.find((candidateProtocol) => candidateProtocol.role === role)
  return (
    facts.isActive &&
    facts.lifecycleStatus === "active" &&
    facts.recommendable &&
    facts.knownReaction === false &&
    facts.suitableThicknesses !== null &&
    facts.suitableThicknesses.length > 0 &&
    facts.spec.primaryRole === role &&
    facts.spec.presentationFormat !== null &&
    facts.spec.presentationFormat !== "unknown" &&
    facts.spec.rinseMode !== null &&
    protocol?.status === "verified_complete"
  )
}

function recommendationFor(input: ScalpCareInput) {
  if (coverageSuppressesPurchase(input)) return null
  const candidate = [...input.recommendationCandidates]
    .filter((facts) => isRecommendableForRole(facts, input.role))
    .sort((left, right) => left.productId.localeCompare(right.productId))[0]
  if (!candidate) return null

  return {
    recommendationId: `stage3:${input.subjectKey}:${candidate.productId}`,
    productId: candidate.productId,
    category: "scalp_care" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason: "Verifizierte Rolle, Format, Ausspülart und Anwendungshinweise passen.",
    authorityRuleId: "scalp_care.selection.verified_role_protocol",
  }
}

export const evaluateScalpCareAuthority: Stage3CategoryAuthorityAdapter<"scalp_care"> = (input) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never)) {
    return unsupportedEvaluation(input as never, "scalp_care_target_unavailable")
  }

  const facts = input.productFacts
  if (!facts) {
    const recommendation = recommendationFor(input)
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    return knownEvaluation(input as never, {
      verdict: "unknown",
      criteria: [
        criterion(
          "scalp_care.selection.uncovered_role",
          "Offene Kopfhautpflege-Rolle",
          "caution",
          recommendation
            ? "Eine verifizierte, empfehlbare Option ist verfügbar."
            : "Keine verifizierte, empfehlbare Option ist verfügbar.",
        ),
      ],
      allowedActions: recommendation
        ? ["plan_recommendation", "leave_uncovered"]
        : ["leave_uncovered"],
      recommendation,
      productFactFingerprint: null,
      recommendationFactFingerprint: recommendation
        ? (input.recommendationCandidates.find(
            (candidate) => candidate.productId === recommendation.productId,
          )?.factFingerprint ?? null)
        : null,
    })
  }

  const missingFacts = productMissingFacts(input, facts)
  if (missingFacts.length > 0) {
    return unknownEvaluation(input as never, missingFacts, [
      criterion(
        "scalp_care.protocol.readiness",
        "Verifizierte Anwendung",
        "unknown",
        "Rolle, Format, Ausspülart und sicherheitskritische Anwendungshinweise müssen vollständig verifiziert sein.",
      ),
    ])
  }

  if (
    isInactiveOrRetired(input as never) ||
    facts.knownReaction === true ||
    facts.spec.primaryRole !== input.role
  ) {
    const recommendation = recommendationFor(input)
    return knownEvaluation(input as never, {
      verdict: "mismatch",
      criteria: [
        criterion(
          "scalp_care.role.exact_match",
          "Exakte Kopfhautpflege-Rolle",
          facts.spec.primaryRole === input.role ? "pass" : "fail",
          facts.spec.primaryRole === input.role
            ? "Die Rolle ist verifiziert."
            : "Die verifizierte Produktrolle deckt diese Planrolle nicht ab.",
        ),
      ],
      allowedActions: ["acknowledge_override", "leave_uncovered"],
      recommendation,
      productFactFingerprint: facts.factFingerprint,
      recommendationFactFingerprint: recommendation
        ? (input.recommendationCandidates.find(
            (candidate) => candidate.productId === recommendation.productId,
          )?.factFingerprint ?? null)
        : null,
    })
  }

  return knownEvaluation(input as never, {
    verdict: "ideal",
    criteria: [
      criterion(
        "scalp_care.role.exact_match",
        "Exakte Kopfhautpflege-Rolle",
        "pass",
        "Die Rolle ist verifiziert.",
      ),
      criterion(
        "scalp_care.format.verified",
        "Verifiziertes Format",
        "pass",
        "Das Produktformat ist geprüft.",
      ),
      criterion(
        "scalp_care.rinse_mode.verified",
        "Verifizierte Ausspülart",
        "pass",
        "Die Ausspülart ist geprüft.",
      ),
      criterion(
        "scalp_care.protocol.verified",
        "Verifizierte Anwendung",
        "pass",
        "Das Rollenprotokoll ist vollständig geprüft.",
      ),
    ],
    allowedActions: ["keep_owned"],
    recommendation: null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
