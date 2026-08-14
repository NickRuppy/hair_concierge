import type { PlanCategoryTarget, PlanProductRole } from "@/lib/personal-plan/types"
import {
  deriveShampooBucket,
  primaryShampooScalpRoute,
  shampooCleansingIntensity,
  type ShampooBucket,
} from "@/lib/shampoo/constants"

import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3ShampooFacts,
} from "../contracts"
import type { Stage3CriterionResult } from "../../contracts"
import {
  commonUnknownFacts,
  criterion,
  hasValidTarget,
  isInactiveOrRetired,
  isPendingIdentity,
  knownEvaluation,
  pendingEvaluation,
  unknownEvaluation,
  unsupportedEvaluation,
} from "../shared"

type ShampooTarget = Extract<PlanCategoryTarget, { category: "shampoo" }>

export function recommendationForShampoo(
  candidate: Stage3ShampooFacts,
  input: Stage3AuthorityInput<"shampoo">,
  supportive = false,
) {
  return {
    recommendationId: `recommend:${candidate.productId}:${input.role}`,
    productId: candidate.productId,
    category: "shampoo" as const,
    role: input.role,
    displayName: candidate.displayName,
    reason: supportive
      ? "Rolle und Kopfhautroute passen; die Reinigungsintensität liegt nur außerhalb des Idealziels."
      : "Passt zur erforderlichen Shampoo-Aufgabe.",
    authorityRuleId: supportive
      ? "shampoo.selection.verified_supportive_intensity"
      : "shampoo.selection.verified_role_fit",
  }
}

export function expectedShampooBucket(input: {
  role: PlanProductRole
  target: ShampooTarget
}): ShampooBucket | null {
  if (input.role === "shampoo_dandruff") {
    return deriveShampooBucket(null, "dandruff")
  }
  if (input.role !== "shampoo_everyday") return null

  const condition = input.target.everydayConstraint.includes("irritation")
    ? "irritated"
    : input.target.everydayConstraint.includes("dry_scalp")
      ? "dry_flakes"
      : null
  return deriveShampooBucket(input.target.scalpRoute, condition)
}

export function expectedShampooSpecTarget(input: { role: PlanProductRole; target: ShampooTarget }) {
  const shampooBucket = expectedShampooBucket(input)
  if (!shampooBucket) return null
  return {
    shampooBucket,
    scalpRoute: primaryShampooScalpRoute(shampooBucket),
    cleansingIntensity: shampooCleansingIntensity(shampooBucket),
  }
}

function evaluateFacts(input: Stage3AuthorityInput<"shampoo">, facts: Stage3ShampooFacts) {
  const target = input.categoryDecision.target
  const criteria: Stage3CriterionResult[] = []
  const missing = commonUnknownFacts({ ...input, productFacts: facts })
  const protocol = facts.protocols.find((candidate) => candidate.role === input.role) ?? null
  const hasVerifiedShampooProtocol = facts.protocols.some(
    (candidate) =>
      (candidate.role === "shampoo_everyday" || candidate.role === "shampoo_dandruff") &&
      candidate.status === "verified_complete",
  )

  if (isInactiveOrRetired({ ...input, productFacts: facts })) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "shampoo.lifecycle",
          "Verfügbarkeit",
          "fail",
          "Das Produkt ist nicht aktiv verfügbar.",
        ),
      ],
    }
  }
  if (facts.knownReaction) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "shampoo.safety",
          "Verträglichkeit",
          "fail",
          "Für dieses Produkt ist eine Unverträglichkeit bekannt.",
        ),
      ],
    }
  }
  if (
    facts.suitableThicknesses?.length &&
    facts.spec.thickness !== null &&
    !facts.suitableThicknesses.includes(facts.spec.thickness ?? "")
  ) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "shampoo.thickness",
          "Haardicke",
          "fail",
          "Das Produkt ist nicht für die bestätigte Haardicke geeignet.",
        ),
      ],
    }
  }
  if (!target || target.category !== "shampoo") return { verdict: "mismatch" as const, criteria }

  if (
    facts.spec.targetFit === "known_mismatch"
      ? !hasVerifiedShampooProtocol
      : !protocol || protocol.status !== "verified_complete"
  ) {
    missing.push("verified_protocol")
  }
  const requiredBucket = expectedShampooBucket({ role: input.role, target })
  if (requiredBucket === null) missing.push("shampoo_bucket_target")
  if (facts.spec.targetFit === "unknown") missing.push("shampoo.target_fit")
  if (facts.spec.targetFit === "known_mismatch" && missing.length === 0) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "shampoo.role",
          "Reinigungsaufgabe",
          "fail",
          "Das Produkt deckt die erforderliche Shampoo-Aufgabe nicht ab.",
        ),
      ],
    }
  }
  if (facts.spec.targetFit === "matched") {
    if (facts.spec.thickness === null) missing.push("shampoo.thickness")
    if (facts.spec.shampooBucket === null) missing.push("shampoo_bucket")
    if (facts.spec.scalpRoute === null) missing.push("scalp_route")
    if (facts.spec.cleansingIntensity === null) missing.push("cleansing_intensity")
  }
  if (missing.length) return { verdict: "unknown" as const, criteria, missing }

  if (facts.spec.shampooBucket !== requiredBucket) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "shampoo.role",
          "Reinigungsaufgabe",
          "fail",
          "Das Produkt deckt die erforderliche Shampoo-Aufgabe nicht ab.",
        ),
      ],
    }
  }
  const expectedScalpRoute =
    input.candidateCatalogComplete === true
      ? expectedShampooSpecTarget({ role: input.role, target })?.scalpRoute
      : target.scalpRoute
  if (!expectedScalpRoute || facts.spec.scalpRoute !== expectedScalpRoute) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "shampoo.scalp_route",
          "Kopfhautroute",
          "fail",
          "Die bestätigte Kopfhautroute passt nicht.",
        ),
      ],
    }
  }
  const expectedCleansingIntensity =
    input.candidateCatalogComplete === true
      ? expectedShampooSpecTarget({ role: input.role, target })?.cleansingIntensity
      : null
  if (expectedCleansingIntensity && facts.spec.cleansingIntensity !== expectedCleansingIntensity) {
    return {
      verdict: "supportive" as const,
      criteria: [
        criterion(
          "shampoo.fit",
          "Shampoo-Passung",
          "caution",
          "Rolle und Kopfhautroute passen, die Reinigungsintensität liegt aber außerhalb des Ziels.",
        ),
      ],
    }
  }

  return {
    verdict: "ideal" as const,
    criteria: [
      criterion(
        "shampoo.fit",
        "Shampoo-Passung",
        "pass",
        "Rolle, Kopfhautroute und Protokoll sind bestätigt.",
      ),
    ],
  }
}

export const evaluateShampooAuthority: Stage3CategoryAuthorityAdapter<"shampoo"> = (
  input: Stage3AuthorityInput<"shampoo">,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never))
    return unsupportedEvaluation(input as never, "shampoo_target_unavailable")
  if (!input.productFacts) {
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    const candidate = input.recommendationCandidates.find((item) => {
      if (!item.recommendable) return false
      const result = evaluateFacts(input, item)
      return result.verdict === "ideal"
    })
    if (!candidate)
      return knownEvaluation(input as never, {
        verdict: "unknown",
        criteria: [],
        allowedActions: ["leave_uncovered"],
        recommendation: null,
        productFactFingerprint: null,
        recommendationFactFingerprint: null,
      })
    return knownEvaluation(input as never, {
      verdict: "ideal",
      criteria: [
        criterion(
          "shampoo.recommendation",
          "Empfehlung",
          "pass",
          "Eine passende aktive Empfehlung ist verifiziert.",
        ),
      ],
      allowedActions: ["plan_recommendation", "leave_uncovered"],
      recommendation: recommendationForShampoo(candidate, input),
      productFactFingerprint: null,
      recommendationFactFingerprint: candidate.factFingerprint,
    })
  }

  const result = evaluateFacts(input, input.productFacts)
  if (result.verdict === "unknown")
    return unknownEvaluation(input as never, result.missing ?? [], result.criteria)
  return knownEvaluation(input as never, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "ideal"
        ? ["keep_owned"]
        : ["keep_owned", "acknowledge_override", "leave_uncovered"],
    recommendation: null,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
