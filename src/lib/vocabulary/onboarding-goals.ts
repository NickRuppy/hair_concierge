import type { Goal } from "./concerns-goals"
import { GOALS, GOAL_LABELS } from "./concerns-goals"
import type { HairTexture } from "./hair-types"

export const TEXTURE_GOAL_PRIORITY: Record<HairTexture, Goal[]> = {
  straight: ["volume", "shine", "less_frizz", "healthy_scalp", "less_split_ends"],
  wavy: ["less_frizz", "curl_definition", "moisture", "shine", "volume"],
  curly: ["curl_definition", "moisture", "less_frizz", "strengthen", "less_split_ends"],
  coily: ["moisture", "strengthen", "anti_breakage", "healthy_scalp", "healthier_hair"],
}

export const GOAL_LABEL_OVERRIDES: Record<HairTexture, Partial<Record<Goal, string>>> = {
  straight: {
    healthy_scalp: "Weniger schnell nachfetten",
    less_frizz: "Anti-Frizz & Geschmeidigkeit",
  },
  wavy: {
    curl_definition: "Wellen-Definition",
    moisture: "Leichte Feuchtigkeit",
  },
  curly: {
    curl_definition: "Locken-Clumping",
    moisture: "Intensive Feuchtigkeit",
  },
  coily: {
    moisture: "Feuchtigkeit versiegeln",
    healthy_scalp: "Kopfhaut beruhigen",
  },
}

export function getOrderedGoals(texture: HairTexture): Goal[] {
  const priority = TEXTURE_GOAL_PRIORITY[texture]
  const rest = GOALS.filter((g) => !priority.includes(g))
  return [...priority, ...rest]
}

export function getGoalLabel(goal: Goal, texture: HairTexture): string {
  return GOAL_LABEL_OVERRIDES[texture]?.[goal] ?? GOAL_LABELS[goal]
}
