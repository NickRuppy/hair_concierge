import { evaluateGateCriteria } from "../fit-criteria"
import type { Stage3CriterionResult } from "../../contracts"
import type {
  Stage3AuthorityEvaluation,
  Stage3AuthorityInput,
  Stage3DeepCleansingFacts,
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

function recommendationFor(
  product: Stage3DeepCleansingFacts,
  role: Stage3AuthorityInput<"deep_cleansing_shampoo">["role"],
) {
  return {
    recommendationId: `recommendation:deep-cleansing:${role}:${product.productId}`,
    productId: product.productId,
    category: "deep_cleansing_shampoo" as const,
    role,
    displayName: product.displayName,
    reason: "Unterstützt die benötigte Reset-Rolle.",
    authorityRuleId: "deep_cleansing.stage3.validated_reset_role",
  }
}

function evaluateProduct(
  input: Stage3AuthorityInput<"deep_cleansing_shampoo">,
  product: Stage3DeepCleansingFacts,
) {
  const target = input.categoryDecision.target
  if (!target || target.category !== "deep_cleansing_shampoo") return null
  const criteria: Stage3CriterionResult[] = []
  if (product.knownReaction)
    criteria.push(
      criterion(
        "deep_cleansing.safety",
        "Verträglichkeit",
        "fail",
        "Eine bekannte Reaktion verhindert die Empfehlung.",
      ),
    )
  if (
    !product.isActive ||
    !product.recommendable ||
    (product.lifecycleStatus !== null && product.lifecycleStatus !== "active")
  )
    criteria.push(
      criterion(
        "deep_cleansing.lifecycle",
        "Produktstatus",
        "fail",
        "Das Produkt ist nicht aktiv.",
      ),
    )
  if (product.spec.supportedResetRoles === null)
    criteria.push(
      criterion(
        "deep_cleansing.reset_role",
        "Reset-Rolle",
        "unknown",
        "Die unterstützten Reset-Rollen sind nicht verifiziert.",
      ),
    )
  else
    criteria.push(
      criterion(
        "deep_cleansing.reset_role",
        "Reset-Rolle",
        product.spec.supportedResetRoles.includes(input.role) ? "pass" : "fail",
        product.spec.supportedResetRoles.includes(input.role)
          ? "Unterstützt die benötigte Reset-Rolle."
          : "Unterstützt die benötigte Reset-Rolle nicht.",
      ),
    )
  const protocol = product.protocols.find((entry) => entry.role === input.role)
  criteria.push(
    criterion(
      "deep_cleansing.protocol",
      "Anwendungsprotokoll",
      protocol?.status === "verified_complete" ? "pass" : "unknown",
      protocol?.status === "verified_complete"
        ? "Das Protokoll ist verifiziert."
        : "Das Protokoll ist nicht vollständig verifiziert.",
    ),
  )
  const missing = commonUnknownFacts(
    { ...input, productFacts: product },
    { requiresSuitableThickness: false },
  )
  missing.push(...criteria.filter((row) => row.result === "unknown").map((row) => row.criterionId))
  return evaluateGateCriteria(input, product, criteria, missing)
}

export function evaluateDeepCleansingAuthority(
  input: Stage3AuthorityInput<"deep_cleansing_shampoo">,
): Stage3AuthorityEvaluation {
  const sharedInput = input as Stage3AuthorityInput
  if (!hasValidTarget(sharedInput))
    return unsupportedEvaluation(sharedInput, "deep_cleansing_target_unavailable")
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
    const candidate = input.recommendationCandidates
      .filter((item) => item.recommendable && item.isActive && item.lifecycleStatus === "active")
      .find((item) => evaluateProduct(input, item)?.verdict === "ideal")
    return knownEvaluation(sharedInput, {
      // A recommendation can be ideal; an absent owned product cannot be.
      // Keep the uncovered state explicit when the catalog yields no candidate.
      verdict: candidate ? "ideal" : "unknown",
      criteria: [],
      allowedActions: candidate ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: candidate ? recommendationFor(candidate, input.role) : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: candidate?.factFingerprint ?? null,
    })
  }
  const assessment = evaluateProduct(input, input.productFacts)
  if (!assessment) return unsupportedEvaluation(sharedInput, "deep_cleansing_target_unavailable")
  if (assessment.verdict === "unknown") {
    return unknownEvaluation(sharedInput, assessment.missing, assessment.criteria)
  }
  const replacement =
    assessment.verdict === "mismatch"
      ? evaluateDeepCleansingAuthority({
          ...input,
          productFacts: null,
          capturedProductId: null,
          subjectIdentity: null,
        })
      : null
  const recommendation = replacement?.status === "known" ? replacement.recommendation : null
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
          : ["leave_uncovered"],
    recommendation,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint:
      replacement?.status === "known" ? replacement.recommendationFactFingerprint : null,
  })
}
