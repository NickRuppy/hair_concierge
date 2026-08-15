export type PersonalPlanJourneyStage = 1 | 2 | 3 | 4 | 5

export type PersonalPlanJourneyStageContent = {
  stage: PersonalPlanJourneyStage
  headerLabel: string
  title: string
  description: string
}

export const PERSONAL_PLAN_JOURNEY_STAGES = [
  {
    stage: 1,
    headerLabel: "Idealplan",
    title: "Dein Idealplan",
    description: "Aus deinem Quiz erstellt.",
  },
  {
    stage: 2,
    headerLabel: "Feinschliff",
    title: "Persönlicher Feinschliff",
    description: "An deinen Alltag angepasst.",
  },
  {
    stage: 3,
    headerLabel: "Produkte",
    title: "Dein Produkt-Check",
    description: "Mit deinen Produkten abgeglichen.",
  },
  {
    stage: 4,
    headerLabel: "Routine",
    title: "Deine Routine",
    description: "Konkrete Produkte für deine Ziele.",
  },
  {
    stage: 5,
    headerLabel: "Anwendung",
    title: "Anwendung",
    description: "So setzt du alles richtig um.",
  },
] as const satisfies readonly PersonalPlanJourneyStageContent[]
