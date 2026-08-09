import type {
  Stage3AuthorityInput,
  Stage3CategoryAuthorityAdapter,
  Stage3LeaveInFacts,
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

const WEIGHTS = ["light", "medium", "rich"] as const

function evaluateFacts(input: Stage3AuthorityInput<"leave_in">, facts: Stage3LeaveInFacts) {
  const target = input.categoryDecision.target
  const criteria: Stage3CriterionResult[] = []
  const missing = commonUnknownFacts({ ...input, productFacts: facts })
  if (isInactiveOrRetired({ ...input, productFacts: facts }) || facts.knownReaction)
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "leave_in.safety",
          "Sicherheit",
          "fail",
          "Das Produkt ist nicht sicher aktiv einsetzbar.",
        ),
      ],
    }
  // There is no per-subject thickness fact at this boundary. Do not compare a
  // catalog label to formula weight and fabricate a profile mismatch.
  if (!target || target.category !== "leave_in") return { verdict: "mismatch" as const, criteria }
  for (const [key, value] of Object.entries({
    weight: facts.spec.weight,
    care_direction: facts.spec.careDirection,
    roles: facts.spec.roles,
    application_stages: facts.spec.applicationStages,
  }))
    if (value === null) missing.push(key)
  const requiredFunctions = target.functions
    .filter((functionTarget) => functionTarget.ownership === "required")
    .map((functionTarget) => functionTarget.function)
  if (requiredFunctions.length && facts.spec.careBenefits === null) missing.push("care_benefits")
  const protocol = facts.protocols.find((candidate) => candidate.role === input.role)
  if (!protocol || protocol.status !== "verified_complete") missing.push("verified_protocol")
  if (input.role === "pre_heat_application" && facts.spec.providesHeatProtection === null)
    missing.push("provides_heat_protection")
  if (missing.length) return { verdict: "unknown" as const, criteria, missing }
  if (input.role === "post_wash_leave_in" && !facts.spec.roles?.includes("post_wash_leave_in"))
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "leave_in.role",
          "Pflege nach der Wäsche",
          "fail",
          "Das Produkt deckt die Pflege-Rolle nicht ab.",
        ),
      ],
    }
  if (
    input.role === "post_wash_leave_in" &&
    requiredFunctions.some((required) => !facts.spec.careBenefits?.includes(required))
  )
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "leave_in.functions",
          "Pflegefunktionen",
          "fail",
          "Das Produkt deckt eine erforderliche Leave-in-Funktion nicht ab.",
        ),
      ],
    }
  if (input.role === "pre_heat_application" && !facts.spec.providesHeatProtection)
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion("leave_in.heat", "Hitzeschutz", "fail", "Der Hitzeschutz ist nicht verifiziert."),
      ],
    }
  if (
    input.role === "post_wash_leave_in" &&
    !facts.spec.applicationStages?.some(
      (stage) => stage === "damp" || stage === "wet" || stage === "either",
    )
  )
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "leave_in.application",
          "Anwendungszeitpunkt",
          "fail",
          "Die Anwendung auf feuchtem Haar ist nicht bestätigt.",
        ),
      ],
    }
  const weightDistance = Math.abs(
    WEIGHTS.indexOf(facts.spec.weight as (typeof WEIGHTS)[number]) - WEIGHTS.indexOf(target.weight),
  )
  if (weightDistance >= 2)
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "leave_in.weight",
          "Gewicht",
          "fail",
          "Die Formel ist deutlich zu leicht oder zu reichhaltig.",
        ),
      ],
    }
  const opposite = new Set(["moisture:protein", "protein:moisture"])
  if (opposite.has(`${facts.spec.careDirection}:${target.careDirection}`))
    return {
      verdict: "mismatch" as const,
      criteria: [
        criterion(
          "leave_in.care_direction",
          "Pflegeausrichtung",
          "fail",
          "Die Pflegeausrichtung ist entgegengesetzt.",
        ),
      ],
    }
  const supportive =
    weightDistance === 1 ||
    facts.spec.careDirection === "balanced" ||
    target.careDirection === "balanced"
  return {
    verdict: supportive ? ("supportive" as const) : ("ideal" as const),
    criteria: [
      criterion(
        "leave_in.fit",
        "Leave-in-Passung",
        supportive ? "caution" : "pass",
        supportive
          ? "Passt mit einer dokumentierten Einschränkung."
          : "Rolle, Gewicht und Pflegeausrichtung passen.",
      ),
    ],
  }
}

export const evaluateLeaveInAuthority: Stage3CategoryAuthorityAdapter<"leave_in"> = (
  input: Stage3AuthorityInput<"leave_in">,
) => {
  if (isPendingIdentity(input as never)) return pendingEvaluation(input as never)
  if (!hasValidTarget(input as never))
    return unsupportedEvaluation(input as never, "leave_in_target_unavailable")
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
      allowedActions: ["plan_recommendation"],
      recommendation: {
        recommendationId: `recommend:${selected.item.productId}:${input.role}`,
        productId: selected.item.productId,
        category: "leave_in",
        role: input.role,
        displayName: selected.item.displayName,
        reason: "Passt zur erforderlichen Leave-in-Rolle.",
        authorityRuleId: "leave_in.selection.role_fit",
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
      result.verdict === "mismatch" ? ["acknowledge_override", "leave_uncovered"] : ["keep_owned"],
    recommendation: null,
    productFactFingerprint: input.productFacts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
