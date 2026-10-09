import { normalizeReasonSalience } from "../reasons"
import type {
  PlanCategoryDecision,
  PlanCategoryTarget,
  PlanNeedAssessment,
  PlanProfile,
  PlanReasonFact,
} from "../types"

type DryShampooTarget = Extract<PlanCategoryTarget, { category: "dry_shampoo" }>

function reason(
  id: string,
  salience: PlanReasonFact["salience"],
  key: string,
  values: PlanReasonFact["values"] = {},
): PlanReasonFact {
  return { id, salience, evidence: [{ source: "quiz", key }], values }
}

function optionalDecision(
  id: "dry_shampoo.inclusion.accepted_bridge" | "dry_shampoo.inclusion.existing_use",
): PlanCategoryDecision {
  const roles: DryShampooTarget["roles"] = ["root_refresh_bridge"]
  return {
    category: "dry_shampoo",
    resolution: "resolved",
    needTier: "optional",
    roles,
    target: {
      category: "dry_shampoo",
      roles,
      cadenceAdjustment: "keep",
    },
    frequency: {
      kind: "unscheduled_as_needed",
      roles,
      boundary: "between_washes_max_twice_before_next_wash",
    },
    reasons: normalizeReasonSalience([
      reason(id, "primary", "dryShampooBridgePreference"),
      reason("dry_shampoo.cadence.bridge_limit", "secondary", "shampooCadence"),
    ]),
    executionState: "available",
    executionPauseReason: null,
    deferredFacts: [],
  }
}

export function computeDryShampooDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  const bridgeApplies =
    profile.scalp.oiliness === "oily" && assessments.shampooCadence.preferred !== "daily_1x"

  if (!bridgeApplies) {
    return {
      category: "dry_shampoo",
      resolution: "resolved",
      needTier: "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons: [reason("dry_shampoo.inclusion.none", "primary", "scalpOiliness")],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    }
  }

  if (profile.routine.dryShampooBridgePreference.state === "unknown") {
    return {
      category: "dry_shampoo",
      resolution: "deferred_until_post_plan_onboarding",
      needTier: null,
      roles: [],
      target: null,
      frequency: null,
      reasons: [reason("dry_shampoo.inclusion.offer_bridge", "primary", "scalpOiliness")],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: ["dry_shampoo_bridge_preference"],
    }
  }

  if (profile.routine.dryShampooBridgePreference.value === "decline") {
    return {
      category: "dry_shampoo",
      resolution: "resolved",
      needTier: "not_needed",
      roles: [],
      target: null,
      frequency: null,
      reasons: [
        reason("dry_shampoo.inclusion.declined_bridge", "primary", "dryShampooBridgePreference"),
      ],
      executionState: "available",
      executionPauseReason: null,
      deferredFacts: [],
    }
  }

  return optionalDecision("dry_shampoo.inclusion.accepted_bridge")
}
