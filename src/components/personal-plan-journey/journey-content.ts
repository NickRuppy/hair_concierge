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

export type PersonalPlanChapterContent = {
  stage: PersonalPlanJourneyStage
  title: string
  description: string
  actionLabel: string
}

export const PERSONAL_PLAN_CHAPTERS = [
  {
    stage: 1,
    title: "Wir haben deinen Idealplan erstellt.",
    description: "Jetzt machen wir ihn mit deinem Alltag und deinen Produkten wirklich zu deinem.",
    actionLabel: "Idealplan ansehen",
  },
  {
    stage: 2,
    title: "Jetzt geben wir deinem Plan den Feinschliff.",
    description: "Ein paar kurze Fragen passen ihn an deinen Alltag an.",
    actionLabel: "Feinschliff starten",
  },
  {
    stage: 3,
    title: "Jetzt gleichen wir deine Produkte ab.",
    description: "So wird aus dem Idealplan deine konkrete Produktauswahl.",
    actionLabel: "Produkte erfassen",
  },
  {
    stage: 4,
    title: "Deine Produktauswahl steht.",
    description: "Jetzt ordnen wir alles zu deiner persönlichen Routine.",
    actionLabel: "Routine ansehen",
  },
  {
    stage: 5,
    title: "Deine Routine steht.",
    description: "Jetzt zeigen wir dir, wie du alles richtig anwendest.",
    actionLabel: "Anwendung ansehen",
  },
] as const satisfies readonly PersonalPlanChapterContent[]
