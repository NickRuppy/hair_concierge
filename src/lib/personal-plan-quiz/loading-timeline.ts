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
