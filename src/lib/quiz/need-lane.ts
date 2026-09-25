import { getOrderedGoals } from "@/lib/onboarding/goal-flow"
import type { Goal, HairTexture } from "@/lib/vocabulary"
import { GOALS } from "@/lib/vocabulary"

import { QUIZ_CONCERN_VALUES } from "./normalization"
import {
  resolveStatedPrimaryConcern,
  toLegacyQuizConcern,
  type QuizAnswerConcern,
} from "./primary-concern"
import type { QuizAnswers } from "./types"

export type QuizConcern = (typeof QUIZ_CONCERN_VALUES)[number]
export type QuizChemicalStress = "none" | "moderate" | "high"
export type QuizNeedLane =
  | "scalp_focus"
  | "bond_repair"
  | "protein"
  | "deep_moisture"
  | "surface_support"
  | "ends_protection"
  | "base"

export interface QuizNeedResolution {
  primaryConcern: QuizConcern | null
  primaryGoal: Goal | null
  lane: QuizNeedLane
  chemicalStress: QuizChemicalStress
}

const CONCERN_TO_GOAL_PRIORITY: Record<QuizConcern, Goal[]> = {
  frizz: ["less_frizz", "moisture", "shine"],
  dryness: ["moisture", "healthier_hair", "shine"],
  breakage: ["anti_breakage", "strengthen", "healthier_hair"],
  split_ends: ["less_split_ends", "healthier_hair", "strengthen"],
  tangling: ["less_frizz", "moisture", "healthier_hair"],
  hair_damage: ["healthier_hair", "strengthen", "anti_breakage"],
}

const REPAIR_GOALS = new Set<Goal>(["anti_breakage", "strengthen", "healthier_hair"])
const SURFACE_GOALS = new Set<Goal>(["moisture", "less_frizz", "curl_definition"])

function isHairTexture(value: QuizAnswers["structure"]): value is HairTexture {
  return value === "straight" || value === "wavy" || value === "curly" || value === "coily"
}

export function deriveQuizChemicalStress(answers: QuizAnswers): QuizChemicalStress {
  if (answers.treatment?.includes("blondiert")) return "high"
  if (
    answers.treatment?.some(
      (treatment) =>
        treatment === "gefaerbt" ||
        treatment === "dauerwelle" ||
        treatment === "chemisch_geglaettet",
    )
  ) {
    return "moderate"
  }
  return "none"
}

function getOrderedSelectedGoals(answers: QuizAnswers): Goal[] {
  const selectedGoals = new Set(
    (answers.goals ?? []).filter((goal): goal is Goal => GOALS.includes(goal as Goal)),
  )
  if (selectedGoals.size === 0) return []

  const ordered = isHairTexture(answers.structure) ? getOrderedGoals(answers.structure) : GOALS
  return ordered.filter((goal) => selectedGoals.has(goal))
}

export function resolvePrimaryQuizGoal(
  answers: QuizAnswers,
  primaryConcern: QuizConcern | null,
): Goal | null {
  const selectedGoals = getOrderedSelectedGoals(answers)
  if (primaryConcern) {
    const concernMatch = CONCERN_TO_GOAL_PRIORITY[primaryConcern].find((goal) =>
      selectedGoals.includes(goal),
    )
    if (concernMatch) return concernMatch
  }
  return selectedGoals[0] ?? null
}

/**
 * `statedConcern` is her stated main problem resolved from the RAW answers
 * (`resolveStatedPrimaryConcern`). Callers that pass legacy-projected answers must hand
 * it in explicitly — the projection can collapse two raw concerns into one. Only a
 * legacy-mappable statement steers the lane; anything else runs the null-concern path.
 */
export function resolveQuizNeed(
  answers: QuizAnswers,
  statedConcern: QuizAnswerConcern | null = resolveStatedPrimaryConcern(answers),
): QuizNeedResolution {
  const primaryConcern = toLegacyQuizConcern(statedConcern)
  const primaryGoal = resolvePrimaryQuizGoal(answers, primaryConcern)
  const chemicalStress = deriveQuizChemicalStress(answers)
  const hasScalpCondition =
    answers.scalp_condition === "schuppen" ||
    answers.scalp_condition === "trockene_schuppen" ||
    answers.scalp_condition === "gereizt"
  const hasAbnormalPullTest = answers.pulltest === "stretches_stays" || answers.pulltest === "snaps"
  const hasRoughSurface = answers.fingertest === "rau"

  if (
    primaryGoal === "healthy_scalp" ||
    (!primaryConcern && (hasScalpCondition || answers.scalp_type === "trocken"))
  ) {
    return { primaryConcern, primaryGoal, chemicalStress, lane: "scalp_focus" }
  }

  const isDamageConcern = primaryConcern === "hair_damage" || primaryConcern === "breakage"
  const isDryEndsConcern = primaryConcern === "dryness" || primaryConcern === "split_ends"
  const qualifiesForBondRepair =
    (chemicalStress === "high" && (isDamageConcern || isDryEndsConcern)) ||
    (chemicalStress === "moderate" && isDamageConcern) ||
    (chemicalStress === "moderate" &&
      isDryEndsConcern &&
      (hasRoughSurface || hasAbnormalPullTest)) ||
    (chemicalStress === "none" && isDamageConcern && hasRoughSurface && hasAbnormalPullTest)

  if (qualifiesForBondRepair) {
    return { primaryConcern, primaryGoal, chemicalStress, lane: "bond_repair" }
  }
  if (
    answers.pulltest === "stretches_stays" &&
    (isDamageConcern || (primaryGoal !== null && REPAIR_GOALS.has(primaryGoal)))
  ) {
    return { primaryConcern, primaryGoal, chemicalStress, lane: "protein" }
  }
  if (
    answers.pulltest === "snaps" &&
    (primaryConcern === "dryness" || primaryGoal === "moisture")
  ) {
    return { primaryConcern, primaryGoal, chemicalStress, lane: "deep_moisture" }
  }
  if (
    primaryConcern === "dryness" ||
    primaryConcern === "frizz" ||
    primaryConcern === "tangling" ||
    (primaryGoal !== null && SURFACE_GOALS.has(primaryGoal))
  ) {
    return { primaryConcern, primaryGoal, chemicalStress, lane: "surface_support" }
  }
  if (
    primaryConcern === "split_ends" ||
    primaryGoal === "shine" ||
    primaryGoal === "less_split_ends"
  ) {
    return { primaryConcern, primaryGoal, chemicalStress, lane: "ends_protection" }
  }

  return { primaryConcern, primaryGoal, chemicalStress, lane: "base" }
}
