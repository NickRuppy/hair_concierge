import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3ConditionerFacts,
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
import {
  careDirectionAxisFitResult,
  orderedAxisFitResult,
  repairSupportAxisFitResult,
} from "./axis-fit"

const LEVELS = ["low", "medium", "high"] as const
const WEIGHTS = ["light", "medium", "rich"] as const

function evaluateFacts(input: Stage3AuthorityInput<"conditioner">, facts: Stage3ConditionerFacts) {
  const target = input.categoryDecision.target
  const criteria: Stage3CriterionResult[] = []
  const missing = commonUnknownFacts({ ...input, productFacts: facts })
  if (isInactiveOrRetired({ ...input, productFacts: facts }) || facts.knownReaction)
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "conditioner.safety",
          "Sicherheit",
          "fail",
          "Das Produkt ist nicht sicher aktiv einsetzbar.",
        ),
      ],
    }
  if (
    facts.suitableThicknesses?.length &&
    facts.spec.thickness !== null &&
    !facts.suitableThicknesses.includes(facts.spec.thickness ?? "")
  )
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "conditioner.thickness",
          "Haardicke",
          "fail",
          "Das Produkt passt nicht zur bestätigten Haardicke.",
        ),
      ],
    }
  if (!target || target.category !== "conditioner")
    return { verdict: "mismatch" as const, criteria }
  const protocol = facts.protocols.find((candidate) => candidate.role === input.role)
  if (!protocol || protocol.status !== "verified_complete") missing.push("verified_protocol")
  if (facts.spec.targetFit === "unknown") missing.push("conditioner.target_fit")
  if (facts.spec.targetFit === "known_mismatch" && missing.length === 0) {
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "conditioner.role",
          "Haardicke + Pflegerichtung",
          "fail",
          "Keine Produktvariante deckt deine Haardicke und Pflegerichtung gemeinsam ab.",
        ),
      ],
    }
  }
  for (const [key, value] of Object.entries({
    thickness: facts.spec.targetFit === "matched" ? facts.spec.thickness : "not_required",
    weight: facts.spec.weight,
    protein_moisture_balance:
      facts.spec.targetFit === "matched" ? facts.spec.proteinMoistureBalance : "not_required",
    repair_support_level: facts.spec.repairSupportLevel,
  }))
    if (value === null) missing.push(key)
  if (missing.length) return { verdict: "unknown" as const, criteria, missing }
  const weightResult = orderedAxisFitResult(
    facts.spec.weight as (typeof WEIGHTS)[number],
    target.weight,
    WEIGHTS,
  )
  if (weightResult === "fail")
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "conditioner.weight",
          "Gewicht",
          "fail",
          "Die Formel ist deutlich zu leicht oder zu reichhaltig.",
        ),
      ],
    }
  const careDirectionResult = careDirectionAxisFitResult(
    facts.spec.proteinMoistureBalance!,
    target.careDirection,
  )
  if (careDirectionResult === "fail")
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "conditioner.balance",
          "Pflegebalance",
          "fail",
          "Die Pflegeausrichtung ist entgegengesetzt.",
        ),
      ],
    }
  const repairResult = repairSupportAxisFitResult(
    facts.spec.repairSupportLevel as (typeof LEVELS)[number],
    target.repairSupportLevel,
    LEVELS,
  )
  if (repairResult === "fail")
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "conditioner.repair",
          "Repair-Unterstützung",
          "fail",
          "Die Repair-Unterstützung ist deutlich zu niedrig.",
        ),
      ],
    }
  // Balanced Conditioner direction is display-compatible, but it has never
  // changed decision authority. Preserve that boundary here.
  const supportive = weightResult === "caution" || repairResult === "caution"
  return {
    verdict: supportive ? ("supportive" as const) : ("ideal" as const),
    criteria: [
      criterion(
        "conditioner.fit",
        "Conditioner-Passung",
        supportive ? "caution" : "pass",
        supportive
          ? "Passt mit einer dokumentierten Einschränkung."
          : "Gewicht, Pflegebalance und Repair-Unterstützung passen.",
      ),
    ],
  }
}

export const evaluateConditionerAuthority: Stage3CategoryAuthorityAdapter<"conditioner"> = (
  input: Stage3AuthorityInput<"conditioner">,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never))
    return unsupportedEvaluation(input as never, "conditioner_target_unavailable")
  if (!input.productFacts) {
    if (input.capturedProductId) return unknownEvaluation(input as never, ["catalog_product_facts"])
    const candidates = input.recommendationCandidates
      .filter((item) => item.recommendable)
      .map((item) => ({ item, result: evaluateFacts(input, item) }))
    const selected =
      candidates.find(({ result }) => result.verdict === "ideal") ??
      candidates.find(({ result }) => result.verdict === "supportive")
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
        category: "conditioner",
        role: input.role,
        displayName: selected.item.displayName,
        reason: "Passt zum Conditioner-Zielprofil.",
        authorityRuleId: "conditioner.selection.core_fit",
      },
      productFactFingerprint: null,
      recommendationFactFingerprint: selected.item.factFingerprint,
    })
  }
  const result = evaluateFacts(input, input.productFacts)
  if (result.verdict === "unknown")
    return unknownEvaluation(input as never, result.missing ?? [], result.criteria)
  return knownEvaluation(input as never, {
    verdict: result.verdict,
    criteria: result.criteria,
    allowedActions:
      result.verdict === "mismatch"
        ? ["acknowledge_override", "leave_uncovered"]
        : result.verdict === "supportive"
          ? ["keep_owned", "leave_uncovered"]
          : ["keep_owned"],
    recommendation: null,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
