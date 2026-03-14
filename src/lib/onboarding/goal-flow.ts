import type { HairTexture, Goal, DesiredVolume } from "@/lib/vocabulary"
import { ONBOARDING_GOALS } from "@/lib/vocabulary/onboarding-goals"

export function getOnboardingGoalCards(hairTexture: HairTexture) {
  return ONBOARDING_GOALS[hairTexture]
}

export function deriveOnboardingGoals(
  secondaryGoals: Goal[],
  desiredVolume: DesiredVolume | null
): Goal[] {
  const derived = new Set<Goal>(secondaryGoals)

  if (desiredVolume === "more") {
    derived.add("volume")
  }

  return [...derived]
}
