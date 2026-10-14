import type { PlanCategoryTarget, PlanProductRole } from "@/lib/personal-plan/types"

import type { Stage3AuthorityEvaluation, Stage3AuthorityInput, Stage3OilFacts } from "../contracts"
import { candidateDimensionCoverage } from "../../comparison-dimensions"
import { compareRankableCandidates, type RankableCandidate } from "../../candidate-ranking"
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
const OIL_WEIGHTS = ["light", "medium", "rich"] as const

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

function eligibleOilCandidates(input: OilInput): Stage3OilFacts[] {
  return input.recommendationCandidates.filter((candidate) => {
    const roleSupport = candidate.spec.roleSupport[input.role]
    return (
      candidate.isActive &&
      candidate.lifecycleStatus === "active" &&
      candidate.recommendable &&
      roleSupport === true &&
      candidate.spec.targetThicknessEligible === true &&
      commonUnknownFacts({ ...input, productFacts: candidate }).length === 0 &&
      hasCompleteProtocol(candidate, input)
    )
  })
}

// Weight verdict for a single candidate. Non-leave-on roles ignore weight
// entirely. Leave-on roles require an exact match for "ideal"; a candidate
// one step away on OIL_WEIGHTS from a known target is "supportive". A null
// candidate weight, a null target weight, or a distance greater than one
// excludes the candidate (returns null) -- preserving the prior behavior
// where a null targetWeight never yielded a leave-on recommendation.
function oilWeightVerdict(
  candidate: Stage3OilFacts,
  input: OilInput,
  targetWeight: string | null,
): "ideal" | "supportive" | null {
  if (!isLeaveOnRole(input.role)) return "ideal"
  if (candidate.spec.weight !== null && candidate.spec.weight === targetWeight) return "ideal"
  if (candidate.spec.weight === null || targetWeight === null) return null
  const candidateIndex = OIL_WEIGHTS.indexOf(candidate.spec.weight as (typeof OIL_WEIGHTS)[number])
  const targetIndex = OIL_WEIGHTS.indexOf(targetWeight as (typeof OIL_WEIGHTS)[number])
  if (candidateIndex < 0 || targetIndex < 0) return null
  return Math.abs(candidateIndex - targetIndex) === 1 ? "supportive" : null
}

function bestOilCandidate(
  input: OilInput,
  targetWeight: string | null,
): { candidate: Stage3OilFacts; verdict: "ideal" | "supportive" } | null {
  const rankable = eligibleOilCandidates(input)
    .map((candidate) => ({ candidate, verdict: oilWeightVerdict(candidate, input, targetWeight) }))
    .filter(
      (entry): entry is { candidate: Stage3OilFacts; verdict: "ideal" | "supportive" } =>
        entry.verdict !== null,
    )
    .map((entry) => ({
      entry,
      rank: {
        verdict: entry.verdict,
        targetMatchCount: candidateDimensionCoverage(input as never, entry.candidate, []).matches,
        cautionCount: entry.verdict === "supportive" ? 1 : 0,
        catalogSortOrder: entry.candidate.catalogSortOrder,
        priceEur: entry.candidate.priceEur ?? null,
        productId: entry.candidate.productId,
      } satisfies RankableCandidate,
    }))
    .sort((left, right) => compareRankableCandidates(left.rank, right.rank))
  return rankable[0]?.entry ?? null
}

export function recommendationForOil(
  candidate: Stage3OilFacts,
  input: OilInput,
  supportive = false,
) {
  return {
    recommendationId: `oil:${input.role}:${candidate.productId}`,
    productId: candidate.productId,
    category: candidate.category,
    role: input.role,
    displayName: candidate.displayName,
    reason: supportive
      ? "Verifiziert für diese Öl-Rolle; das Formelgewicht liegt nur angrenzend am Ziel."
      : "Verifiziert für diese Öl-Rolle mit vollständigem Anwendungsprotokoll.",
    authorityRuleId: supportive
      ? "oil.recommendation.role_verified_supportive_weight"
      : "oil.recommendation.role_verified",
  }
}

export function recommendationForSupportiveOil(candidate: Stage3OilFacts, input: OilInput) {
  const targetWeight = targetForRole(input)?.weight ?? null
  if (!candidate.spec.weight || !targetWeight) return null
  const candidateIndex = OIL_WEIGHTS.indexOf(candidate.spec.weight as (typeof OIL_WEIGHTS)[number])
  const targetIndex = OIL_WEIGHTS.indexOf(targetWeight as (typeof OIL_WEIGHTS)[number])
  if (candidateIndex < 0 || targetIndex < 0) return null
  const distance = Math.abs(candidateIndex - targetIndex)
  return distance === 1 ? recommendationForOil(candidate, input, true) : null
}

export function evaluateOilAuthority(input: OilInput): Stage3AuthorityEvaluation {
  if (!hasValidTarget(input)) return unsupportedEvaluation(input, "oil_target_unavailable")
  if (isPendingIdentity(input)) return pendingEvaluation(input)

  const roleTarget = targetForRole(input)
  if (!roleTarget) return unsupportedEvaluation(input, "oil_role_target_unavailable")
  const targetWeight = roleTarget.weight

  if (!input.productFacts) {
    const best = bestOilCandidate(input, targetWeight)
    return knownEvaluation(input, {
      verdict: "mismatch",
      criteria: [
        criterion("oil.role", "Öl-Rolle", "fail", "Für diese Rolle ist kein Produkt zugeordnet."),
      ],
      allowedActions: best ? ["plan_recommendation", "leave_uncovered"] : ["leave_uncovered"],
      recommendation: best
        ? recommendationForOil(best.candidate, input, best.verdict === "supportive")
        : null,
      productFactFingerprint: null,
      recommendationFactFingerprint: best?.candidate.factFingerprint ?? null,
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
    const best = bestOilCandidate(input, targetWeight)
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
      allowedActions: best
        ? ["acknowledge_override", "plan_recommendation", "leave_uncovered"]
        : ["acknowledge_override", "leave_uncovered"],
      recommendation: best
        ? recommendationForOil(best.candidate, input, best.verdict === "supportive")
        : null,
      productFactFingerprint: facts.factFingerprint,
      recommendationFactFingerprint: best?.candidate.factFingerprint ?? null,
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
