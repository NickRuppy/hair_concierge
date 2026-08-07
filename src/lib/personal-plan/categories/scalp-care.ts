import { normalizeReasonSalience } from "../reasons"
import type {
  PlanCategoryDecision,
  PlanCategoryTarget,
  PlanCoverageOwnership,
  PlanNeedAssessment,
  PlanProductRole,
  PlanProfile,
  PlanReasonFact,
} from "../types"

type ScalpCareTarget = Extract<PlanCategoryTarget, { category: "scalp_care" }>
type ScalpCareRole = ScalpCareTarget["roles"][number]

const ROLE_ORDER: ScalpCareRole[] = [
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
  "scalp_exfoliant",
]

function reason(
  id: string,
  salience: PlanReasonFact["salience"],
  source: PlanReasonFact["evidence"][number]["source"],
  key: string,
  values: PlanReasonFact["values"] = {},
): PlanReasonFact {
  return { id, salience, evidence: [{ source, key }], values }
}

function addRole(roles: Set<ScalpCareRole>, role: ScalpCareRole) {
  roles.add(role)
}

function coverage(role: ScalpCareRole): PlanCoverageOwnership {
  if (role === "scalp_comfort" || role === "scalp_flake_oil_adjunct") return "supporting"
  return "primary"
}

function cadence(role: ScalpCareRole) {
  if (role === "scalp_exfoliant") return "occasional_according_to_product" as const
  if (role === "scalp_comfort") return "as_needed_according_to_product" as const
  return "regular_according_to_product" as const
}

export function computeScalpCareDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const scalpConcerns = new Set(profile.scalp.concerns)
  const currentConcerns = new Set(profile.concerns)
  const reasons: PlanReasonFact[] = [
    reason("scalp_care.inclusion.never_basis", "detail", "assessment", "categoryBoundary"),
  ]

  if (
    profile.scalp.irritationState.state === "known" &&
    profile.scalp.irritationState.value === "burning_painful_or_inflamed"
  ) {
    const pause = reason(
      "scalp_care.safety.pause_all",
      "primary",
      "post_plan_onboarding",
      "scalpIrritationState",
    )
    return {
      category: "scalp_care",
      resolution: "resolved",
      needTier: "optional",
      roles: [],
      target: null,
      frequency: null,
      reasons: normalizeReasonSalience([...reasons, pause]),
      executionState: "paused",
      executionPauseReason: pause,
      deferredFacts: [],
    }
  }

  if (scalpConcerns.has("irritated") && profile.scalp.irritationState.state === "unknown") {
    const pause = reason("scalp_care.clarification.irritation", "primary", "quiz", "scalpConcerns")
    return {
      category: "scalp_care",
      resolution: "deferred_until_post_plan_onboarding",
      needTier: null,
      roles: [],
      target: null,
      frequency: null,
      reasons: normalizeReasonSalience([...reasons, pause]),
      executionState: "paused",
      executionPauseReason: pause,
      deferredFacts: ["scalp_irritation_detail"],
    }
  }

  const roles = new Set<ScalpCareRole>()

  if (
    profile.scalp.oiliness === "dry" ||
    (profile.scalp.irritationState.state === "known" &&
      profile.scalp.irritationState.value === "mild_sensitive_or_itchy")
  ) {
    addRole(roles, "scalp_comfort")
    reasons.push(reason("scalp_care.role.comfort", "primary", "quiz", "scalpOiliness"))
  }

  if (
    profile.scalp.oiliness === "oily" ||
    scalpConcerns.has("oily_dandruff") ||
    scalpConcerns.has("dry_dandruff")
  ) {
    addRole(roles, "scalp_flake_oil_adjunct")
    reasons.push(reason("scalp_care.role.flake_oil_adjunct", "primary", "quiz", "scalpConcerns"))
  }

  if (scalpConcerns.has("dry_dandruff")) {
    addRole(roles, "scalp_comfort")
    reasons.push(reason("scalp_care.role.dry_flake_comfort", "primary", "quiz", "scalpConcerns"))
  }

  if (currentConcerns.has("hair_loss_or_thinning")) {
    addRole(roles, "density_claim_tonic")
    reasons.push(reason("scalp_care.role.density_claim", "primary", "quiz", "currentConcerns"))
    reasons.push(
      reason("scalp_care.evidence.limited_density", "secondary", "assessment", "hairLossBoundary"),
    )
  }

  if (assessments.scalpBuildup.state === "present") {
    addRole(roles, "scalp_exfoliant")
    reasons.push(
      reason("scalp_care.role.exfoliant", "primary", "assessment", "scalpBuildup", {
        sourceFacts: assessments.scalpBuildup.sourceFacts.join(","),
      }),
    )
  }

  const orderedRoles = ROLE_ORDER.filter((role) => roles.has(role))
  const buildupUnknown = assessments.scalpBuildup.state === "unknown"

  if (orderedRoles.length === 0) {
    return {
      category: "scalp_care",
      resolution: buildupUnknown ? "deferred_until_post_plan_onboarding" : "resolved",
      needTier: buildupUnknown ? null : "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons: normalizeReasonSalience([
        ...reasons,
        reason(
          buildupUnknown ? "scalp_care.inclusion.buildup_deferred" : "scalp_care.inclusion.none",
          "primary",
          buildupUnknown ? "assessment" : "quiz",
          buildupUnknown ? "scalpBuildup" : "scalpOiliness",
        ),
      ]),
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: buildupUnknown ? ["current_product_load"] : [],
    }
  }

  return {
    category: "scalp_care",
    resolution: buildupUnknown ? "partially_resolved" : "resolved",
    needTier: "optional",
    roles: orderedRoles,
    target: {
      category: "scalp_care",
      roles: orderedRoles,
      roleTargets: orderedRoles.map((role) => ({
        role,
        coverage: coverage(role),
        ...(role === "density_claim_tonic" ? { evidenceLevel: "limited_evidence" as const } : {}),
      })),
    },
    frequency: {
      kind: "role_keyed_product_protocol",
      roleFrequencies: orderedRoles.map((role) => ({
        role,
        cadence: cadence(role),
      })),
    },
    reasons: normalizeReasonSalience([
      ...reasons,
      reason("scalp_care.inclusion.optional_union", "primary", "assessment", "scalpCareRoles", {
        roles: orderedRoles.join(","),
      }),
    ]),
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: buildupUnknown ? ["current_product_load"] : [],
  }
}

export type { ScalpCareRole as PlanScalpCareRole, PlanProductRole }
