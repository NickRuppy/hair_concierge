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
    headerLabel: "Plan",
    title: "Dein Plan",
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

/**
 * The stages that still have a chapter screen. Stage 5 lost its chapter with
 * the Routine's "Anwendung ansehen" hero button (field test 26.08.2026): the
 * Bottom-Nav's Anwendung tab is the only route to that surface now, and a tab
 * does not get announced by a full-screen chapter. Stages 1 and 2 lost theirs
 * with the relic removal (28.08.2026): the `/plan-bereit` arrival screen
 * replaced chapter 1, and every Stage-2 entry is a module entry (or the legacy
 * linear question flow) with no invitation chapter. Chapters 3 and 4 remain
 * the legacy linear journeys' bridge/completion surfaces and the bridge's
 * handoff-error surface.
 */
export type PersonalPlanChapterStage = 3 | 4

export type PersonalPlanChapterContent = {
  stage: PersonalPlanChapterStage
  title: string
  description: string
  actionLabel: string
}

export const PERSONAL_PLAN_CHAPTERS = [
  {
    stage: 3,
    title: "Jetzt gleichen wir deine Produkte ab.",
    description: "So wird aus deinem Plan deine konkrete Produktauswahl.",
    actionLabel: "Produkte erfassen",
  },
  {
    stage: 4,
    title: "Deine Produktauswahl steht.",
    description: "Jetzt ordnen wir alles zu deiner persönlichen Routine.",
    actionLabel: "Routine ansehen",
  },
] as const satisfies readonly PersonalPlanChapterContent[]
