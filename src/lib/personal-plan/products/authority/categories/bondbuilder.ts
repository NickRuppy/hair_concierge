import type { PlanProductRole } from "@/lib/personal-plan/types"

import type { Stage3CriterionResult } from "../../contracts"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthorityInput,
  Stage3BondbuilderFacts,
} from "../contracts"
import {
  commonUnknownFacts,
  criterion,
  hasValidTarget,
  isPendingIdentity,
  knownEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

export function recommendationForBondbuilder(product: Stage3BondbuilderFacts, supportive = false) {
  return {
    recommendationId: `recommendation:bondbuilder:${product.productId}`,
    productId: product.productId,
    category: "bondbuilder" as const,
    role: "specialized_bond_treatment" as const,
    displayName: product.displayName,
    reason: supportive
      ? "Ist ein verifiziertes Ergänzungsprodukt und erfüllt die Bondbuilder-Rolle nicht allein."
      : "Erfüllt die eigenständige Bondbuilder-Rolle mit verifiziertem Protokoll.",
    authorityRuleId: supportive
      ? "bondbuilder.stage3.validated_add_on"
      : "bondbuilder.stage3.validated_standalone",
  }
}

/**
 * Single source of truth for the verified-application state. Authority uses it as the
 * `bondbuilder.protocol` criterion.
 */
export function bondbuilderApplicationVerified(
  product: Stage3BondbuilderFacts,
  role: PlanProductRole,
): boolean {
  const protocol = product.protocols.find((entry) => entry.role === role)
  return (
    protocol?.status === "verified_complete" &&
    product.spec.applicationMode !== null &&
    product.spec.treatmentMode !== null &&
    product.spec.usageProtocol !== null
  )
}

function evaluateProduct(
  input: Stage3AuthorityInput<"bondbuilder">,
  product: Stage3BondbuilderFacts,
) {
  const criteria: Stage3CriterionResult[] = []
  if (product.knownReaction)
    criteria.push(
      criterion(
        "bondbuilder.safety",
        "Verträglichkeit",
        "fail",
        "Eine bekannte Reaktion verhindert die Empfehlung.",
      ),
    )
  if (
    product.suitableThicknesses === null ||
    product.suitableThicknesses.length === 0 ||
    !input.hairThickness
  )
    criteria.push(
      criterion(
        "bondbuilder.thickness",
        "Haarstärke",
        "unknown",
        "Die Eignung für die Haarstärke ist nicht verifiziert.",
      ),
    )
  else if (!product.suitableThicknesses.includes(input.hairThickness))
    criteria.push(
      criterion(
        "bondbuilder.thickness",
        "Haarstärke",
        "fail",
        "Das Produkt ist für die bestätigte Haarstärke nicht geeignet.",
      ),
    )
  else
    criteria.push(
      criterion(
        "bondbuilder.thickness",
        "Haarstärke",
        "pass",
        "Die Eignung für die Haarstärke ist verifiziert.",
      ),
    )
  if (!product.isActive || product.lifecycleStatus !== "active")
    criteria.push(
      criterion("bondbuilder.lifecycle", "Produktstatus", "fail", "Das Produkt ist nicht aktiv."),
    )
  if (product.spec.relationship === null)
    criteria.push(
      criterion(
        "bondbuilder.relationship",
        "Rollenbeziehung",
        "unknown",
        "Die Rollenbeziehung fehlt.",
      ),
    )
  else
    criteria.push(
      criterion(
        "bondbuilder.relationship",
        "Rollenbeziehung",
        product.spec.relationship === "standalone" ? "pass" : "caution",
        product.spec.relationship === "standalone"
          ? "Kann die spezialisierte Rolle eigenständig erfüllen."
          : "Ist nur ein ergänzendes Produkt und kann die Rolle nicht allein erfüllen.",
      ),
    )
  const protocolComplete = bondbuilderApplicationVerified(product, input.role)
  criteria.push(
    criterion(
      "bondbuilder.protocol",
      "Kritisches Protokoll",
      protocolComplete ? "pass" : "unknown",
      protocolComplete
        ? "Das genaue Kursprotokoll ist verifiziert."
        : "Anwendungsmodus, Behandlung oder Kursprotokoll ist nicht vollständig verifiziert.",
    ),
  )
  const verdict = criteria.some((entry) => entry.result === "fail")
    ? ("mismatch" as const)
    : criteria.some((entry) => entry.result === "unknown")
      ? ("unknown" as const)
      : product.spec.relationship === "add_on"
        ? ("supportive" as const)
        : ("ideal" as const)
  return { criteria, verdict }
}

export function evaluateBondbuilderAuthority(
  input: Stage3AuthorityInput<"bondbuilder">,
): Stage3AuthorityEvaluation {
  const sharedInput = input as Stage3AuthorityInput
  if (!hasValidTarget(sharedInput))
    return unsupportedEvaluation(sharedInput, "bondbuilder_target_unavailable")
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
    const ideal = input.recommendationCandidates
      .filter(
        (candidate) =>
          candidate.recommendable && candidate.isActive && candidate.lifecycleStatus === "active",
      )
      .filter((candidate) => evaluateProduct(input, candidate).verdict === "ideal")
    const multiple = ideal.length > 1
    return knownEvaluation(sharedInput, {
      verdict: ideal.length === 0 ? "unknown" : "ideal",
      criteria: multiple
        ? [
            criterion(
              "bondbuilder.equal_shortlist",
              "Auswahl",
              "caution",
              "Mehrere gleich passende eigenständige Produkte brauchen eine Auswahl.",
            ),
          ]
        : [],
      allowedActions:
        ideal.length === 1 ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: ideal.length === 1 ? recommendationForBondbuilder(ideal[0]) : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: ideal.length === 1 ? ideal[0].factFingerprint : null,
    })
  }
  const missing = commonUnknownFacts(sharedInput)
  if (missing.length > 0) return unknownEvaluation(sharedInput, missing)
  const assessment = evaluateProduct(input, input.productFacts)
  if (assessment.verdict === "unknown") {
    return unknownEvaluation(sharedInput, ["bondbuilder_fit_or_protocol"], assessment.criteria)
  }
  return knownEvaluation(sharedInput, {
    verdict: assessment.verdict,
    criteria: assessment.criteria,
    allowedActions:
      assessment.verdict === "ideal"
        ? ["keep_owned"]
        : assessment.verdict === "mismatch"
          ? ["acknowledge_override"]
          : ["keep_owned", "leave_uncovered"],
    recommendation: null,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
