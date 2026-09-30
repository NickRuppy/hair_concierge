import type { Goal } from "./concerns-goals"
import { GOALS } from "./concerns-goals"
import type { HairTexture } from "./hair-types"

export const TEXTURE_GOAL_PRIORITY: Record<HairTexture, Goal[]> = {
  straight: ["volume", "shine", "less_frizz", "healthy_scalp", "less_split_ends"],
  wavy: ["less_frizz", "curl_definition", "moisture", "shine", "volume"],
  curly: ["curl_definition", "moisture", "less_frizz", "strengthen", "less_split_ends"],
  coily: ["moisture", "strengthen", "anti_breakage", "healthy_scalp", "healthier_hair"],
}

export function getOrderedGoals(texture: HairTexture): Goal[] {
  const priority = TEXTURE_GOAL_PRIORITY[texture]
  const rest = GOALS.filter((g) => !priority.includes(g))
  return [...priority, ...rest]
}
