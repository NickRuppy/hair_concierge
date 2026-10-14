import { normalizeReasonSalience } from "../reasons"
import type {
  PlanCategoryDecision,
  PlanCategoryTarget,
  PlanNeedAssessment,
  PlanProfile,
  PlanReasonFact,
} from "../types"

type DeepCleansingTarget = Extract<PlanCategoryTarget, { category: "deep_cleansing_shampoo" }>

function reason(
  id: string,
  salience: PlanReasonFact["salience"],
  source: PlanReasonFact["evidence"][number]["source"],
  key: string,
  values: PlanReasonFact["values"] = {},
): PlanReasonFact {
  return { id, salience, evidence: [{ source, key }], values }
}

export function computeDeepCleansingDecision(
  profile: PlanProfile,
  assessments: PlanNeedAssessment,
): PlanCategoryDecision {
  let resetLoad = assessments.resetLoad.knownScore
  const reasons: PlanReasonFact[] = []

  for (const sourceFact of assessments.resetLoad.sourceFacts) {
    if (!sourceFact.startsWith("deep_cleansing.load.")) continue
    reasons.push(reason(sourceFact, "secondary", "assessment", "resetLoadSource"))
  }

  if (profile.scalp.oiliness === "oily") {
    reasons.push(
      reason("deep_cleansing.load.oily_scalp", "primary", "quiz", "scalpOiliness", {
        points: 1,
      }),
    )
  }

  const hasOtherResetSignal = resetLoad > 0
  if (profile.concerns.includes("low_volume_or_weighed_down") && hasOtherResetSignal) {
    resetLoad += 1
    reasons.push(
      reason(
        "deep_cleansing.load.weighed_down_corroboration",
        "primary",
        "quiz",
        "currentConcerns",
        { points: 1 },
      ),
    )
  }

  const roles: Array<"residue_reset"> = resetLoad > 0 ? ["residue_reset"] : []
  const target: DeepCleansingTarget | null =
    resetLoad > 0 ? { category: "deep_cleansing_shampoo", roles } : null

  const loadUnknown = assessments.resetLoad.missingInputs.includes("current_product_load")
  const inclusion =
    resetLoad === 0 && loadUnknown
      ? { id: "deep_cleansing.inclusion.deferred_load", tier: null }
      : resetLoad === 0
        ? { id: "deep_cleansing.inclusion.none", tier: "not_needed" as const }
        : resetLoad === 1
          ? { id: "deep_cleansing.inclusion.optional", tier: "optional" as const }
          : resetLoad >= 4
            ? { id: "deep_cleansing.inclusion.high_load", tier: "basis" as const }
            : { id: "deep_cleansing.inclusion.basis", tier: "basis" as const }

  reasons.push(
    reason(inclusion.id, "primary", "assessment", "resetLoad", {
      resetLoad,
    }),
  )

  return {
    category: "deep_cleansing_shampoo",
    resolution:
      inclusion.tier === null
        ? "deferred_until_post_plan_onboarding"
        : loadUnknown
          ? "partially_resolved"
          : "resolved",
    needTier: inclusion.tier,
    roles,
    target,
    frequency:
      resetLoad === 0
        ? null
        : resetLoad === 1
          ? {
              kind: "unscheduled_as_needed",
              roles: ["residue_reset"],
              boundary: "bei_bedarf",
            }
          : {
              kind: "every_nth_wash",
              roles: ["residue_reset"],
              every: resetLoad >= 4 ? 3 : 4,
              substitutesRegularShampoo: true,
            },
    reasons: normalizeReasonSalience(reasons),
    executionState:
      inclusion.tier !== null &&
      inclusion.tier !== "not_needed" &&
      (profile.scalp.concerns.includes("irritated") ||
        profile.scalp.concerns.includes("dry_dandruff"))
        ? "paused"
        : "available",
    executionPauseReason:
      inclusion.tier !== null &&
      inclusion.tier !== "not_needed" &&
      (profile.scalp.concerns.includes("irritated") ||
        profile.scalp.concerns.includes("dry_dandruff"))
        ? reason("deep_cleansing.safety.scalp_pause", "primary", "quiz", "scalpConcerns")
        : null,
    deferredFacts: assessments.resetLoad.missingInputs,
  }
}
