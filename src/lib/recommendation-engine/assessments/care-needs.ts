import type {
  CareNeedAssessment,
  DamageAssessment,
  NormalizedProfile,
} from "@/lib/recommendation-engine/types"
import { maxDamageLevel, scoreToDamageLevel } from "@/lib/recommendation-engine/utils/levels"

function deriveVolumeDirection(
  goals: NormalizedProfile["goals"],
): CareNeedAssessment["volumeDirection"] {
  if (goals.includes("volume")) return "volume"
  if (goals.includes("less_volume")) return "less_volume"
  return "neutral"
}

export function buildCareNeedAssessment(
  profile: NormalizedProfile,
  damage: DamageAssessment,
): CareNeedAssessment {
  let hydrationScore = 0
  let smoothingScore = 0
  let detanglingScore = 0
  let definitionScore = 0
  let thermalProtectionScore = 0

  if (damage.balanceDirection === "moisture") hydrationScore += 3
  if (damage.structuralLevel === "high" || damage.structuralLevel === "severe") {
    hydrationScore += 2
  }
  if (profile.concerns.includes("dryness")) hydrationScore += 2
  if (profile.goals.includes("moisture")) hydrationScore += 2
  if (profile.chemicalTreatment.includes("bleached")) hydrationScore += 1

  if (profile.concerns.includes("frizz")) smoothingScore += 2
  if (profile.goals.includes("less_frizz")) smoothingScore += 2
  if (damage.mechanicalLevel === "high" || damage.mechanicalLevel === "severe") {
    smoothingScore += 1
  }
  if (profile.cuticleCondition === "rough") smoothingScore += 1

  if (profile.concerns.includes("frizz")) detanglingScore += 1
  if (profile.concerns.includes("tangling")) detanglingScore += 2
  if (damage.repairPriority === "high") detanglingScore += 2
  if (profile.cuticleCondition === "slightly_rough") detanglingScore += 1
  if (profile.cuticleCondition === "rough") detanglingScore += 2
  if (
    profile.hairTexture === "wavy" ||
    profile.hairTexture === "curly" ||
    profile.hairTexture === "coily"
  ) {
    detanglingScore += 1
  }

  if (
    profile.goals.includes("curl_definition") &&
    (profile.hairTexture === "wavy" ||
      profile.hairTexture === "curly" ||
      profile.hairTexture === "coily")
  ) {
    definitionScore += 3
  }
  if (
    profile.hairTexture === "wavy" ||
    profile.hairTexture === "curly" ||
    profile.hairTexture === "coily"
  ) {
    definitionScore += 1
  }

  if (profile.heatStyling === "daily") thermalProtectionScore += 4
  if (profile.heatStyling === "several_weekly") thermalProtectionScore += 3
  if (profile.heatStyling === "once_weekly") thermalProtectionScore += 2
  if (profile.heatStyling === "rarely") thermalProtectionScore += 1
  if (profile.heatStyling && profile.heatStyling !== "never" && !profile.usesHeatProtection) {
    thermalProtectionScore += 2
  }
  if (damage.heatLevel === "high" || damage.heatLevel === "severe") {
    thermalProtectionScore += 1
  }

  const hydrationNeed = maxDamageLevel(
    damage.balanceDirection === "moisture" ? "moderate" : "none",
    scoreToDamageLevel(hydrationScore),
  )

  return {
    hydrationNeed,
    smoothingNeed: scoreToDamageLevel(smoothingScore),
    detanglingNeed: scoreToDamageLevel(detanglingScore),
    definitionSupportNeed: scoreToDamageLevel(definitionScore),
    thermalProtectionNeed: scoreToDamageLevel(thermalProtectionScore),
    volumeDirection: deriveVolumeDirection(profile.goals),
  }
}
