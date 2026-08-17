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

/**
 * K18 Leave-In Molecular Repair Hair Mask — Nick's explicit product decision
 * (2026-08-17): when several Bondbuilder candidates evaluate equally ideal,
 * this is the default pick. Production carries a permanent three-way ideal tie
 * (Olaplex No.3, Epres, K18), and without a default the category stayed
 * uncovered for every Stage-1 preview and every direct acceptance.
 *
 * It is a default among equals, NOT a superiority claim: the tie keeps its
 * `bondbuilder.equal_shortlist` caution and the recommendation carries its own
 * rule id (`bondbuilder.stage3.tie_default`) so nothing reads as "verified
 * best".
 *
 * Note for analytics: the same situation persists two different honest rule
 * ids — picking this product interactively in Stage 3 persists
 * `validated_standalone` (that path evaluates the chosen product on its own),
 * while a direct acceptance persists `tie_default`. Anything keyed on
 * `tie_default` therefore sees only the direct-accept half of the cohort.
 */
export const BONDBUILDER_TIE_DEFAULT_PRODUCT_ID = "38dace91-0fba-49ee-a93f-ac36e488fe4b"

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
 * The same recommendation, relabelled for the tie case. The reason line stays
 * deliberately modest — it names a house default, not a better product.
 */
function tieDefaultRecommendationForBondbuilder(product: Stage3BondbuilderFacts) {
  return {
    ...recommendationForBondbuilder(product),
    reason: "Unsere Standardwahl, wenn mehrere Produkte gleich gut passen.",
    authorityRuleId: "bondbuilder.stage3.tie_default",
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
    // A tie resolves to the house default only when that exact product is on
    // the shortlist; any other tie keeps the need uncovered.
    const tieDefault = multiple
      ? (ideal.find((candidate) => candidate.productId === BONDBUILDER_TIE_DEFAULT_PRODUCT_ID) ??
        null)
      : null
    const selected = ideal.length === 1 ? ideal[0] : tieDefault
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
      allowedActions: selected ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: !selected
        ? null
        : tieDefault
          ? tieDefaultRecommendationForBondbuilder(tieDefault)
          : recommendationForBondbuilder(selected),
      productFactFingerprint: null,
      recommendationFactFingerprint: selected?.factFingerprint ?? null,
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
