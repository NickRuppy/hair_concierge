import type { PlanProfile } from "../types"

export type PlanVolumeDirection = "more" | "less"

/**
 * The Personal-Plan styling direction from the profile, shared by the conditioner weight rule
 * and the Stage-3 dry-shampoo styling criterion: a low-volume concern always means "more"; a
 * volume goal means "less" on the control route (curly/coily, coarse, or wavy with a shape
 * goal/concern) and "more" otherwise; no goal and no concern means no direction.
 */
export function planVolumeDirection(profile: PlanProfile): PlanVolumeDirection | null {
  if (profile.concerns.includes("low_volume_or_weighed_down")) return "more"
  if (!profile.goals.includes("volume_balance")) return null
  const controlRoute =
    profile.hair.texture === "curly" ||
    profile.hair.texture === "coily" ||
    profile.hair.thickness === "coarse" ||
    (profile.hair.texture === "wavy" &&
      (profile.goals.includes("shape_definition") || profile.concerns.includes("lost_shape")))
  return controlRoute ? "less" : "more"
}
