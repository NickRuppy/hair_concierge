import type { PlanCategoryTarget, PlanProductRole } from "@/lib/personal-plan/types"

import type { Stage3AuthorityEvaluation, Stage3AuthorityInput, Stage3OilFacts } from "../contracts"
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

type OilRole = Extract<
  PlanProductRole,
  "pre_wash_fibre_treatment" | "leave_on_fibre_conditioning" | "dry_finish"
>
type OilInput = Stage3AuthorityInput<"oil">

function targetForRole(input: OilInput) {
  const target = input.categoryDecision.target as Extract<
    PlanCategoryTarget,
    { category: "oil" }
  > | null
  return target?.roleTargets.find((roleTarget) => roleTarget.role === input.role) ?? null
}

function hasCompleteProtocol(facts: Stage3OilFacts, input: OilInput): boolean {
  return facts.protocols.some(
    (protocol) => protocol.role === input.role && protocol.status === "verified_complete",
  )
}

function isLeaveOnRole(
  role: PlanProductRole,
): role is Exclude<OilRole, "pre_wash_fibre_treatment"> {
  return role === "leave_on_fibre_conditioning" || role === "dry_finish"
}

function candidateForRole(input: OilInput, targetWeight: string | null): Stage3OilFacts | null {
  return (
    input.recommendationCandidates.find((candidate) => {
      const roleSupport = candidate.spec.roleSupport[input.role]
      return (
        candidate.isActive &&
        candidate.lifecycleStatus === "active" &&
        candidate.recommendable &&
        roleSupport === true &&
        candidate.spec.targetThicknessEligible === true &&
        commonUnknownFacts({ ...input, productFacts: candidate }).length === 0 &&
        hasCompleteProtocol(candidate, input) &&
        (!isLeaveOnRole(input.role) ||
          (candidate.spec.weight !== null && candidate.spec.weight === targetWeight))
      )
    }) ?? null
  )
}

function recommendation(candidate: Stage3OilFacts, input: OilInput) {
  return {
    recommendationId: `oil:${input.role}:${candidate.productId}`,
    productId: candidate.productId,
    category: candidate.category,
    role: input.role,
    displayName: candidate.displayName,
    reason: "Verifiziert für diese Öl-Rolle mit vollständigem Anwendungsprotokoll.",
    authorityRuleId: "oil.recommendation.role_verified",
  }
}

export function evaluateOilAuthority(input: OilInput): Stage3AuthorityEvaluation {
  if (!hasValidTarget(input)) return unsupportedEvaluation(input, "oil_target_unavailable")
  if (isPendingIdentity(input)) return pendingEvaluation(input)

  const roleTarget = targetForRole(input)
  if (!roleTarget) return unsupportedEvaluation(input, "oil_role_target_unavailable")
  const targetWeight = roleTarget.weight

  if (!input.productFacts) {
    const candidate = candidateForRole(input, targetWeight)
    return knownEvaluation(input, {
      verdict: "mismatch",
      criteria: [
        criterion("oil.role", "Öl-Rolle", "fail", "Für diese Rolle ist kein Produkt zugeordnet."),
      ],
      allowedActions: candidate ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: candidate ? recommendation(candidate, input) : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: candidate?.factFingerprint ?? null,
    })
  }

  const facts = input.productFacts
  const missingFacts = commonUnknownFacts(input)
  const roleSupport = facts.spec.roleSupport[input.role]
  if (roleSupport === null || roleSupport === undefined) missingFacts.push("oil.role_support")
  if (facts.spec.targetThicknessEligible === null) missingFacts.push("oil.thickness_eligibility")
  if (isLeaveOnRole(input.role) && facts.spec.weight === null) missingFacts.push("oil.weight")
  const protocol = protocolForRole(input)
  if (!protocol || protocol.status !== "verified_complete")
    missingFacts.push("application_protocol")
  if (missingFacts.length > 0) {
    return unknownEvaluation(input, missingFacts, [
      criterion(
        "oil.role",
        "Öl-Rolle",
        "unknown",
        "Rollen-, Gewichts- oder Protokollfakten sind noch nicht vollständig verifiziert.",
      ),
    ])
  }

  if (
    isInactiveOrRetired(input) ||
    roleSupport === false ||
    facts.spec.targetThicknessEligible === false
  ) {
    const candidate = candidateForRole(input, targetWeight)
    return knownEvaluation(input, {
      verdict: "mismatch",
      criteria: [
        criterion(
          "oil.role",
          "Öl-Rolle",
          "fail",
          isInactiveOrRetired(input)
            ? "Das Produkt ist nicht aktiv."
            : roleSupport === false
              ? "Das Produkt unterstützt die zugeordnete Öl-Rolle nicht."
              : "Das Produkt ist nicht für die bestätigte Haardicke verifiziert.",
        ),
      ],
      allowedActions: candidate
        ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
        : ["acknowledge_override", "leave_uncovered"],
      recommendation: candidate ? recommendation(candidate, input) : null,
      productFactFingerprint: facts.factFingerprint,
      recommendationFactFingerprint: candidate?.factFingerprint ?? null,
    })
  }

  const weightMatches = !isLeaveOnRole(input.role) || facts.spec.weight === targetWeight
  return knownEvaluation(input, {
    verdict: weightMatches ? "ideal" : "supportive",
    criteria: [
      criterion(
        "oil.role",
        "Öl-Rolle",
        "pass",
        "Das Produkt unterstützt die zugeordnete Öl-Rolle.",
      ),
      ...(isLeaveOnRole(input.role)
        ? [
            criterion(
              "oil.weight",
              "Formelgewicht",
              weightMatches ? "pass" : "caution",
              weightMatches
                ? "Das Formelgewicht passt zum Rollen-Ziel."
                : "Das Formelgewicht ist für diese Rollen-Zuordnung nur angrenzend.",
            ),
          ]
        : []),
    ],
    allowedActions: weightMatches
      ? ["keep_owned"]
      : ["keep_owned", "acknowledge_override", "leave_uncovered"],
    recommendation: null,
    productFactFingerprint: facts.factFingerprint,
    recommendationFactFingerprint: null,
  })
}
