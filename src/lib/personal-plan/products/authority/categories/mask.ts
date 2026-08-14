import type {
  MaskFunctionalNeed,
  PlanCareDirection,
  PlanCareWeight,
  PlanRepairSupportLevel,
} from "@/lib/personal-plan/types"

import type { Stage3CriterionResult } from "../../contracts"
import type { Stage3AuthorityEvaluation, Stage3AuthorityInput, Stage3MaskFacts } from "../contracts"
import {
  commonUnknownFacts,
  criterion,
  hasValidTarget,
  isInactiveOrRetired,
  isPendingIdentity,
  knownEvaluation,
  protocolForRole,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

const WEIGHTS: PlanCareWeight[] = ["light", "medium", "rich"]
const REPAIR_LEVELS: PlanRepairSupportLevel[] = ["low", "medium", "high"]

export function recommendationForMask(product: Stage3MaskFacts, supportive = false) {
  return {
    recommendationId: `recommendation:mask:${product.productId}`,
    productId: product.productId,
    category: "mask" as const,
    role: "intensive_conditioning_mask" as const,
    displayName: product.displayName,
    reason: supportive
      ? "Deckt die Masken-Rolle mit einer begrenzten Abweichung vom Ziel ab."
      : "Deckt die bestätigten Masken-Ziele ab.",
    authorityRuleId: supportive
      ? "mask.stage3.validated_supportive_candidate"
      : "mask.stage3.validated_candidate",
  }
}

function axisResult<T extends string>(
  criterionId: string,
  label: string,
  product: T,
  target: T,
  values?: readonly T[],
) {
  if (product === target)
    return criterion(criterionId, label, "pass", "Stimmt mit dem Ziel überein.")
  if (criterionId === "mask.care_direction") {
    const supportive = product === "balanced" || target === "balanced"
    return criterion(
      criterionId,
      label,
      supportive ? "caution" : "fail",
      supportive
        ? "Die ausgewogene Richtung ist eine begrenzte Brücke."
        : "Die Pflegerichtungen stehen sich direkt gegenüber.",
    )
  }
  const distance = Math.abs(values!.indexOf(product) - values!.indexOf(target))
  if (criterionId === "mask.repair_support") {
    if (product === "high" && target !== "high")
      return criterion(criterionId, label, "caution", "Unterstützt stärker als erforderlich.")
    return criterion(
      criterionId,
      label,
      distance === 1 ? "caution" : "fail",
      distance === 1
        ? "Liegt eine Stufe unter dem Ziel."
        : "Liegt mindestens zwei Stufen unter dem Ziel.",
    )
  }
  return criterion(
    criterionId,
    label,
    distance === 1 ? "caution" : "fail",
    distance === 1 ? "Liegt eine Stufe neben dem Ziel." : "Liegt zwei Stufen neben dem Ziel.",
  )
}

function evaluateProduct(input: Stage3AuthorityInput<"mask">, product: Stage3MaskFacts) {
  const target = input.categoryDecision.target
  if (!target || target.category !== "mask") return null
  const criteria: Stage3CriterionResult[] = []
  if (product.knownReaction)
    criteria.push(
      criterion(
        "mask.safety",
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
        "mask.thickness",
        "Haarstärke",
        "unknown",
        "Die Eignung für die Haarstärke ist nicht verifiziert.",
      ),
    )
  else if (!product.suitableThicknesses.includes(input.hairThickness))
    criteria.push(
      criterion(
        "mask.thickness",
        "Haarstärke",
        "fail",
        "Das Produkt ist für die bestätigte Haarstärke nicht geeignet.",
      ),
    )
  else
    criteria.push(
      criterion(
        "mask.thickness",
        "Haarstärke",
        "pass",
        "Die Eignung für die Haarstärke ist verifiziert.",
      ),
    )
  if (!product.isActive || product.lifecycleStatus !== "active")
    criteria.push(
      criterion("mask.lifecycle", "Produktstatus", "fail", "Das Produkt ist nicht aktiv."),
    )
  if (product.spec.weight === null)
    criteria.push(criterion("mask.weight", "Gewicht", "unknown", "Das Formelgewicht fehlt."))
  else
    criteria.push(
      axisResult(
        "mask.weight",
        "Gewicht",
        product.spec.weight as PlanCareWeight,
        target.weight,
        WEIGHTS,
      ),
    )
  if (product.spec.careDirection === null)
    criteria.push(
      criterion("mask.care_direction", "Pflegerichtung", "unknown", "Die Pflegerichtung fehlt."),
    )
  else
    criteria.push(
      axisResult(
        "mask.care_direction",
        "Pflegerichtung",
        product.spec.careDirection as PlanCareDirection,
        target.careDirection,
      ),
    )
  if (product.spec.repairSupportLevel === null)
    criteria.push(
      criterion(
        "mask.repair_support",
        "Repair-Unterstützung",
        "unknown",
        "Die kanonische Repair-Unterstützung ist noch nicht geprüft.",
      ),
    )
  else
    criteria.push(
      axisResult(
        "mask.repair_support",
        "Repair-Unterstützung",
        product.spec.repairSupportLevel as PlanRepairSupportLevel,
        target.repairSupportLevel,
        REPAIR_LEVELS,
      ),
    )
  const requiredBenefits = target.functionalNeeds
    .filter((need) => need.ownership === "required")
    .map((need) => need.need)
  if (requiredBenefits.length > 0 && product.spec.functionalBenefits === null) {
    criteria.push(
      criterion(
        "mask.functional_benefits",
        "Funktionsnutzen",
        "unknown",
        "Die kanonischen Masken-Funktionen sind noch nicht geprüft.",
      ),
    )
  } else if (
    requiredBenefits.some(
      (benefit) => !product.spec.functionalBenefits?.includes(benefit as MaskFunctionalNeed),
    )
  ) {
    criteria.push(
      criterion(
        "mask.functional_benefits",
        "Funktionsnutzen",
        "fail",
        "Das Produkt deckt eine erforderliche Masken-Funktion nicht ab.",
      ),
    )
  } else if (requiredBenefits.length > 0) {
    criteria.push(
      criterion(
        "mask.functional_benefits",
        "Funktionsnutzen",
        "pass",
        "Die erforderlichen Masken-Funktionen sind verifiziert.",
      ),
    )
  }
  const protocol = product.protocols.find((entry) => entry.role === input.role)
  criteria.push(
    criterion(
      "mask.protocol",
      "Anwendungsprotokoll",
      protocol?.status === "verified_complete" ? "pass" : "unknown",
      protocol?.status === "verified_complete"
        ? "Das kritische Protokoll ist verifiziert."
        : "Kontaktzeit oder Conditioner-Reihenfolge ist nicht vollständig verifiziert.",
    ),
  )
  const result = criteria.some((entry) => entry.result === "fail")
    ? ("mismatch" as const)
    : criteria.some((entry) => entry.result === "unknown")
      ? ("unknown" as const)
      : criteria.some((entry) => entry.result === "caution")
        ? ("supportive" as const)
        : ("ideal" as const)
  return { criteria, verdict: result }
}

export function evaluateMaskAuthority(
  input: Stage3AuthorityInput<"mask">,
): Stage3AuthorityEvaluation {
  const sharedInput = input as Stage3AuthorityInput
  if (!hasValidTarget(sharedInput))
    return unsupportedEvaluation(sharedInput, "mask_target_unavailable")
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
    const eligible = input.recommendationCandidates
      .filter(
        (candidate) =>
          candidate.recommendable && candidate.isActive && candidate.lifecycleStatus === "active",
      )
      .map((candidate) => ({ candidate, assessment: evaluateProduct(input, candidate) }))
      .find(({ assessment }) => assessment?.verdict === "ideal")
    return knownEvaluation(sharedInput, {
      // A recommendation can be ideal; an absent owned product cannot be.
      // Keep the uncovered state explicit when the catalog yields no candidate.
      verdict: eligible ? "ideal" : "unknown",
      criteria: [],
      allowedActions: eligible ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: eligible ? recommendationForMask(eligible.candidate) : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: eligible?.candidate.factFingerprint ?? null,
    })
  }
  const missing = commonUnknownFacts(sharedInput)
  if (missing.length > 0) return unknownEvaluation(sharedInput, missing)
  const assessment = evaluateProduct(input, input.productFacts)
  if (!assessment) return unsupportedEvaluation(sharedInput, "mask_target_unavailable")
  if (assessment.verdict === "unknown") {
    return unknownEvaluation(
      sharedInput,
      assessment.criteria
        .filter((entry) => entry.result === "unknown")
        .map((entry) => entry.criterionId),
      assessment.criteria,
    )
  }
  const recommendation =
    input.productFacts.recommendable &&
    !isInactiveOrRetired(sharedInput) &&
    assessment.verdict === "ideal" &&
    protocolForRole(sharedInput)?.status === "verified_complete"
      ? recommendationForMask(input.productFacts)
      : null
  return knownEvaluation(sharedInput, {
    verdict: assessment.verdict,
    criteria: assessment.criteria,
    allowedActions:
      assessment.verdict === "ideal"
        ? ["keep_owned"]
        : assessment.verdict === "mismatch"
          ? ["acknowledge_override"]
          : ["keep_owned", "leave_uncovered"],
    recommendation,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: recommendation ? input.productFacts.factFingerprint : null,
  })
}
