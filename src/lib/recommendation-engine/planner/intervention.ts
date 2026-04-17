import type {
  CareNeedAssessment,
  DamageAssessment,
  EngineCategoryId,
  InterventionPlan,
  InterventionStep,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import { isExplicitNoneArray } from "@/lib/profile/signal-derivations"
import {
  deriveBuildupResetNeed,
  getRoutineFrequencyBand,
  hasBetweenWashBridgeNeed,
  hasScalpDrynessOrIrritationRisk,
  isFrequencyAtLeast,
} from "@/lib/recommendation-engine/categories/shared"

function hasRoutineItem(
  profile: NormalizedProfile,
  category: Exclude<EngineCategoryId, "routine">,
): boolean {
  return profile.routineInventory[category] !== null
}

function buildBehaviorStep(reasonCodes: string[]): InterventionStep | null {
  if (reasonCodes.length === 0) return null

  return {
    category: "behavior",
    action: "behavior_change_only",
    reasonCodes,
  }
}

function buildConditionerSteps(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
): InterventionStep[] {
  const present = hasRoutineItem(profile, "conditioner")
  const steps: InterventionStep[] = []
  const meaningfulNeed =
    damage.repairPriority !== "low" ||
    careNeeds.hydrationNeed !== "none" ||
    careNeeds.smoothingNeed !== "none" ||
    careNeeds.detanglingNeed !== "none"

  if (!present) {
    steps.push({
      category: "conditioner",
      action: "add",
      reasonCodes: ["baseline_core_care", "missing_conditioner_inventory"],
    })
    return steps
  }

  if (damage.repairPriority === "high") {
    steps.push({
      category: "conditioner",
      action: "replace",
      reasonCodes: ["repair_need_present", "likely_need_stronger_conditioner_route"],
    })
    return steps
  }

  if (meaningfulNeed) {
    steps.push({
      category: "conditioner",
      action: "keep",
      reasonCodes: ["baseline_core_care", "conditioner_already_present"],
    })
  }

  return steps
}

function buildHeatProtectionSteps(
  profile: NormalizedProfile,
  careNeeds: CareNeedAssessment,
): InterventionStep[] {
  const steps: InterventionStep[] = []
  const relevant = profile.heatStyling !== null && profile.heatStyling !== "never"

  if (!relevant) return steps

  if (!hasRoutineItem(profile, "heat_protectant")) {
    steps.push({
      category: "heat_protectant",
      action: "add",
      reasonCodes: ["heat_events_present", "missing_heat_protectant_inventory"],
    })
    return steps
  }

  if (careNeeds.thermalProtectionNeed === "high" || careNeeds.thermalProtectionNeed === "severe") {
    steps.push({
      category: "heat_protectant",
      action: "keep",
      reasonCodes: ["heat_events_present", "heat_protection_inventory_present"],
    })
  }

  return steps
}

function buildMaskSteps(profile: NormalizedProfile, damage: DamageAssessment): InterventionStep[] {
  const steps: InterventionStep[] = []
  const relevant =
    damage.overallLevel === "high" ||
    damage.overallLevel === "severe" ||
    damage.repairPriority === "high"

  if (!relevant) return steps

  if (!hasRoutineItem(profile, "mask")) {
    steps.push({
      category: "mask",
      action: "add",
      reasonCodes: ["intensive_treatment_needed", "missing_mask_inventory"],
    })
    return steps
  }

  steps.push({
    category: "mask",
    action: "increase_frequency",
    reasonCodes: ["intensive_treatment_needed", "mask_inventory_present"],
  })

  return steps
}

function buildLeaveInSteps(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
): InterventionStep[] {
  const steps: InterventionStep[] = []
  const relevant =
    careNeeds.hydrationNeed !== "none" ||
    careNeeds.smoothingNeed !== "none" ||
    careNeeds.detanglingNeed !== "none" ||
    careNeeds.definitionSupportNeed !== "none" ||
    careNeeds.thermalProtectionNeed !== "none" ||
    damage.repairPriority === "high"

  if (!relevant) return steps

  if (!hasRoutineItem(profile, "leave_in")) {
    steps.push({
      category: "leave_in",
      action: "add",
      reasonCodes: ["after_wash_support_needed", "missing_leave_in_inventory"],
    })
    return steps
  }

  if (damage.repairPriority === "high" || careNeeds.thermalProtectionNeed === "severe") {
    steps.push({
      category: "leave_in",
      action: "replace",
      reasonCodes: ["after_wash_support_needed", "higher_support_route_needed"],
    })
    return steps
  }

  steps.push({
    category: "leave_in",
    action: "keep",
    reasonCodes: ["after_wash_support_needed", "leave_in_inventory_present"],
  })

  return steps
}

function buildBondBuilderPlan(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): Pick<InterventionPlan, "steps" | "deferredSteps"> {
  const steps: InterventionStep[] = []
  const deferredSteps: InterventionStep[] = []
  const frequencyBand = getRoutineFrequencyBand(profile, "bondbuilder")

  if (damage.bondBuilderPriority === "none") {
    if (hasRoutineItem(profile, "bondbuilder")) {
      steps.push({
        category: "bondbuilder",
        action: "decrease_frequency",
        reasonCodes: ["bond_builder_low_relevance_currently"],
      })
    }

    return { steps, deferredSteps }
  }

  if (!hasRoutineItem(profile, "bondbuilder")) {
    const step: InterventionStep = {
      category: "bondbuilder",
      action: "add",
      reasonCodes: [
        damage.bondBuilderPriority === "recommend"
          ? "bond_builder_recommend"
          : "bond_builder_consider",
        "missing_bondbuilder_inventory",
      ],
    }

    if (damage.bondBuilderPriority === "recommend") {
      steps.push(step)
    } else {
      deferredSteps.push(step)
    }

    return { steps, deferredSteps }
  }

  if (damage.bondBuilderPriority === "recommend" && !isFrequencyAtLeast(frequencyBand, "1_2x")) {
    steps.push({
      category: "bondbuilder",
      action: "increase_frequency",
      reasonCodes: ["bond_builder_recommend", "bondbuilder_inventory_too_sparse"],
    })
    return { steps, deferredSteps }
  }

  steps.push({
    category: "bondbuilder",
    action: "keep",
    reasonCodes: [
      damage.bondBuilderPriority === "recommend"
        ? "bond_builder_recommend"
        : "bond_builder_consider",
      "bond_builder_inventory_present",
    ],
  })

  return { steps, deferredSteps }
}

function buildDeepCleansingShampooSteps(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): InterventionStep[] {
  const steps: InterventionStep[] = []
  const resetNeed = deriveBuildupResetNeed(profile)
  const frequencyBand = getRoutineFrequencyBand(profile, "deep_cleansing_shampoo")
  const drynessRisk = hasScalpDrynessOrIrritationRisk(profile, damage)

  if (
    hasRoutineItem(profile, "deep_cleansing_shampoo") &&
    drynessRisk &&
    isFrequencyAtLeast(frequencyBand, "3_4x")
  ) {
    return [
      {
        category: "deep_cleansing_shampoo",
        action: "decrease_frequency",
        reasonCodes: ["deep_reset_overuse_risk", "dryness_or_damage_pressure"],
      },
    ]
  }

  if (resetNeed.level !== "moderate" && resetNeed.level !== "high") {
    return steps
  }

  const reasonCodes = ["buildup_reset_need_present", ...resetNeed.reasonCodes]

  if (!hasRoutineItem(profile, "deep_cleansing_shampoo")) {
    steps.push({
      category: "deep_cleansing_shampoo",
      action: "add",
      reasonCodes: [...reasonCodes, "missing_deep_cleansing_inventory"],
    })
    return steps
  }

  if (!isFrequencyAtLeast(frequencyBand, "1_2x")) {
    steps.push({
      category: "deep_cleansing_shampoo",
      action: "increase_frequency",
      reasonCodes: [...reasonCodes, "deep_reset_inventory_too_sparse"],
    })
    return steps
  }

  steps.push({
    category: "deep_cleansing_shampoo",
    action: "keep",
    reasonCodes: [...reasonCodes, "deep_reset_inventory_present"],
  })

  return steps
}

function buildDryShampooSteps(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): InterventionStep[] {
  const present = hasRoutineItem(profile, "dry_shampoo")
  const frequencyBand = getRoutineFrequencyBand(profile, "dry_shampoo")
  const bridgeNeed = hasBetweenWashBridgeNeed(profile)
  const drynessRisk = hasScalpDrynessOrIrritationRisk(profile, damage)

  if (present && (drynessRisk || isFrequencyAtLeast(frequencyBand, "5_6x"))) {
    return [
      {
        category: "dry_shampoo",
        action: "decrease_frequency",
        reasonCodes: ["dry_shampoo_overuse_risk"],
      },
    ]
  }

  if (!bridgeNeed) {
    return []
  }

  const reasonCodes = ["between_wash_bridge_needed"]
  if (profile.scalpType === "oily" || profile.concerns.includes("oily_scalp")) {
    reasonCodes.push("oily_scalp_between_wash_support")
  }

  if (!present) {
    return [
      {
        category: "dry_shampoo",
        action: "add",
        reasonCodes,
      },
    ]
  }

  return [
    {
      category: "dry_shampoo",
      action: "keep",
      reasonCodes: [...reasonCodes, "dry_shampoo_inventory_present"],
    },
  ]
}

function buildPeelingSteps(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): InterventionStep[] {
  const present = hasRoutineItem(profile, "peeling")
  const frequencyBand = getRoutineFrequencyBand(profile, "peeling")
  const resetNeed = deriveBuildupResetNeed(profile)
  const drynessRisk = hasScalpDrynessOrIrritationRisk(profile, damage)
  const scalpNeed =
    resetNeed.level === "high" ||
    (resetNeed.level === "moderate" &&
      (profile.scalpType === "oily" ||
        profile.concerns.includes("dandruff") ||
        profile.goals.includes("healthy_scalp")))

  if (present && (drynessRisk || isFrequencyAtLeast(frequencyBand, "3_4x"))) {
    return [
      {
        category: "peeling",
        action: "decrease_frequency",
        reasonCodes: ["peeling_overuse_risk"],
      },
    ]
  }

  if (!scalpNeed || drynessRisk) {
    return []
  }

  const reasonCodes = ["buildup_reset_need_present", ...resetNeed.reasonCodes]

  if (!present) {
    return [
      {
        category: "peeling",
        action: "add",
        reasonCodes: [...reasonCodes, "missing_peeling_inventory"],
      },
    ]
  }

  if (!isFrequencyAtLeast(frequencyBand, "1_2x")) {
    return [
      {
        category: "peeling",
        action: "increase_frequency",
        reasonCodes: [...reasonCodes, "peeling_inventory_too_sparse"],
      },
    ]
  }

  return [
    {
      category: "peeling",
      action: "keep",
      reasonCodes: [...reasonCodes, "peeling_inventory_present"],
    },
  ]
}

function buildShampooSteps(profile: NormalizedProfile): InterventionStep[] {
  if (hasRoutineItem(profile, "shampoo")) {
    return [
      {
        category: "shampoo",
        action: "keep",
        reasonCodes: ["baseline_cleansing_category", "shampoo_inventory_present"],
      },
    ]
  }

  return [
    {
      category: "shampoo",
      action: "add",
      reasonCodes: ["baseline_cleansing_category", "missing_shampoo_inventory"],
    },
  ]
}

export function buildInterventionPlan(
  profile: NormalizedProfile,
  damage: DamageAssessment,
  careNeeds: CareNeedAssessment,
): InterventionPlan {
  const steps: InterventionStep[] = []
  const deferredSteps: InterventionStep[] = []
  const behaviorReasons: string[] = []

  if (
    profile.heatStyling !== null &&
    profile.heatStyling !== "never" &&
    !profile.usesHeatProtection
  ) {
    behaviorReasons.push("frequent_heat_without_protection")
  }
  if (profile.towelTechnique === "rubbeln") {
    behaviorReasons.push("rough_towel_handling")
  }
  if (profile.brushType === "paddle" || profile.brushType === "round") {
    behaviorReasons.push("rough_brushing")
  }
  if (isExplicitNoneArray(profile.nightProtection)) {
    behaviorReasons.push("insufficient_night_protection")
  }

  const behaviorStep = buildBehaviorStep(behaviorReasons)
  if (behaviorStep) {
    steps.push(behaviorStep)
  }

  steps.push(...buildShampooSteps(profile))
  steps.push(...buildConditionerSteps(profile, damage, careNeeds))
  steps.push(...buildHeatProtectionSteps(profile, careNeeds))
  steps.push(...buildMaskSteps(profile, damage))
  steps.push(...buildLeaveInSteps(profile, damage, careNeeds))
  steps.push(...buildDeepCleansingShampooSteps(profile, damage))
  steps.push(...buildDryShampooSteps(profile, damage))
  steps.push(...buildPeelingSteps(profile, damage))

  const bondBuilderPlan = buildBondBuilderPlan(profile, damage)
  steps.push(...bondBuilderPlan.steps)
  deferredSteps.push(...bondBuilderPlan.deferredSteps)

  return {
    steps,
    deferredSteps,
    notes: [
      "Planner emits the full action set. Compression happens later in the category/output layer.",
    ],
  }
}
