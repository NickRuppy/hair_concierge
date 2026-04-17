import type { Goal, DesiredVolume, HairTexture } from "@/lib/vocabulary"
import { GOALS, GOAL_LABELS } from "@/lib/vocabulary/concerns-goals"
import { getOrderedGoals, getGoalLabel } from "@/lib/vocabulary/onboarding-goals"

export { getOrderedGoals, getGoalLabel } from "@/lib/vocabulary/onboarding-goals"

export function deriveVolumeFromGoals(goals: Goal[]): DesiredVolume {
  if (goals.includes("volume")) return "more"
  if (goals.includes("less_volume")) return "less"
  return "balanced"
}

export function getAvailableGoals(hairTexture: HairTexture | null): Goal[] {
  return hairTexture ? getOrderedGoals(hairTexture) : [...GOALS]
}

export function getAvailableGoalLabel(goal: Goal, hairTexture: HairTexture | null): string {
  return hairTexture ? getGoalLabel(goal, hairTexture) : GOAL_LABELS[goal]
}
