import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3DryShampooFacts,
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

type DryShampooInput = Stage3AuthorityInput<"dry_shampoo">

function productMissingFacts(input: DryShampooInput, facts: Stage3DryShampooFacts): string[] {
  const missing = commonUnknownFacts(input, { requiresSuitableThickness: false })
  if (facts.spec.primaryEffect === null) missing.push("styling_effect")
  if (facts.spec.hairColorFit === null) missing.push("hair_color_fit")
  if (facts.spec.scalpSensitivityFit === null) missing.push("scalp_sensitivity_fit")
  if (facts.spec.format === null) missing.push("format")
  if (protocolForRole(input)?.status !== "verified_complete") missing.push("application_protocol")
  return [...new Set(missing)].sort()
}

function isRecommendable(facts: Stage3DryShampooFacts, role: DryShampooInput["role"]): boolean {
  const protocol = facts.protocols.find((candidateProtocol) => candidateProtocol.role === role)
  return (
    facts.isActive &&
    facts.lifecycleStatus === "active" &&
    facts.recommendable &&
    facts.knownReaction === false &&
    facts.spec.primaryEffect !== null &&
    facts.spec.hairColorFit !== null &&
    facts.spec.scalpSensitivityFit !== null &&
    facts.spec.format !== null &&
    protocol?.status === "verified_complete"
  )
}

function recommendationFor(input: DryShampooInput) {
  // Candidate order is the shared stable first-entered fallback for this category.
  const candidate = input.recommendationCandidates.find((facts) =>
    isRecommendable(facts, input.role),
  )
  if (!candidate) return null

  return {
    recommendationId: `stage3:${input.subjectKey}:${candidate.productId}`,
    productId: candidate.productId,
    category: "dry_shampoo" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason: "Verifizierte Auffrischungs-, Farb-, Kopfhaut- und Formatangaben liegen vor.",
    authorityRuleId: "dry_shampoo.selection.stable_first_entered_verified",
  }
}

export const evaluateDryShampooAuthority: Stage3CategoryAuthorityAdapter<"dry_shampoo"> = (
  input,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never)) {
    return unsupportedEvaluation(input as never, "dry_shampoo_target_unavailable")
  }

  const facts = input.productFacts
  if (!facts) {
    const recommendation = recommendationFor(input)
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    return knownEvaluation(input as never, {
      verdict: "unknown",
      criteria: [
        criterion(
          "dry_shampoo.selection.uncovered_role",
          "Offene Ansatzauffrischung",
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

  if (isInactiveOrRetired(input as never) || facts.knownReaction === true) {
    const recommendation = recommendationFor(input)
    return knownEvaluation(input as never, {
      verdict: "mismatch",
      criteria: [
        criterion(
          "dry_shampoo.identity.active",
          "Aktive, verträgliche Produktidentität",
          "fail",
          "Das Produkt ist nicht als aktive, verträgliche Trockenshampoo-Option verfügbar.",
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

  const missingFacts = productMissingFacts(input, facts)
  if (missingFacts.length > 0) {
    return unknownEvaluation(input as never, missingFacts, [
      criterion(
        "dry_shampoo.fit.verified_facts",
        "Verifizierte Trockenshampoo-Fakten",
        "unknown",
        "Auffrischung, Farbpassung, Kopfhautsensitivität, Format und Anwendung müssen geprüft sein.",
      ),
    ])
  }

  return knownEvaluation(input as never, {
    verdict: "ideal",
    criteria: [
      criterion(
        "dry_shampoo.identity.active",
        "Aktive Produktidentität",
        "pass",
        "Das Produkt ist aktiv und verträglich.",
      ),
      criterion(
        "dry_shampoo.sensitivity.verified",
        "Kopfhautverträglichkeit",
        "pass",
        "Die Sensitivitätspositionierung ist geprüft.",
      ),
      criterion("dry_shampoo.tint.verified", "Farbpassung", "pass", "Die Farbpassung ist geprüft."),
      criterion(
        "dry_shampoo.format.verified",
        "Verifiziertes Format",
        "pass",
        "Das Format ist geprüft.",
      ),
      criterion(
        "dry_shampoo.protocol.verified",
        "Verifizierte Anwendung",
        "pass",
        "Das Anwendungsprotokoll ist vollständig geprüft.",
      ),
    ],
    allowedActions: ["keep_owned"],
    recommendation: null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
