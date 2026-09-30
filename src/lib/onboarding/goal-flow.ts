import type { Goal, DesiredVolume } from "@/lib/vocabulary"

export { getOrderedGoals } from "@/lib/vocabulary/onboarding-goals"

export function deriveVolumeFromGoals(goals: Goal[]): DesiredVolume {
  if (goals.includes("volume")) return "more"
  if (goals.includes("less_volume")) return "less"
  return "balanced"
}
