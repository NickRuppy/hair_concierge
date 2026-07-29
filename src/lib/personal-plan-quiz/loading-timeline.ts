export const PERSONAL_PLAN_LOADING_STAGES = [
  { id: "evaluate_profile", label: "Dein Haarprofil wird ausgewertet", endProgress: 34 },
  {
    id: "compare_goals",
    label: "Deine Ziele und Herausforderungen werden abgeglichen",
    endProgress: 67,
  },
  {
    id: "fit_everyday",
    label: "Dein persönlicher Plan wird auf deinen Alltag abgestimmt",
    endProgress: 100,
  },
] as const

export type PersonalPlanLoadingStageId = (typeof PERSONAL_PLAN_LOADING_STAGES)[number]["id"]

export function getPersonalPlanLoadingProgress(
  completedStages: readonly PersonalPlanLoadingStageId[],
  activeProgress = 0,
): number {
  const completedCount = PERSONAL_PLAN_LOADING_STAGES.filter((stage) =>
    completedStages.includes(stage.id),
  ).length
  const completedProgress =
    completedCount === 0 ? 0 : PERSONAL_PLAN_LOADING_STAGES[completedCount - 1].endProgress
  const nextLimit = PERSONAL_PLAN_LOADING_STAGES[completedCount]?.endProgress ?? 100
  return Math.max(completedProgress, Math.min(nextLimit, Math.max(0, activeProgress)))
}
