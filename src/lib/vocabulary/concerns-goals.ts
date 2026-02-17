export const CONCERNS = [
  "Haarausfall",
  "Schuppen",
  "Trockenheit",
  "Fettige Kopfhaut",
  "Haarschaeden",
  "Coloriert",
  "Spliss",
  "Frizz",
  "Duenner werdendes Haar",
] as const
export type Concern = (typeof CONCERNS)[number]

export const CONCERN_OPTIONS: readonly Concern[] = CONCERNS

export const GOALS = [
  "Mehr Volumen",
  "Gesuenderes Haar",
  "Haarwachstum",
  "Weniger Frizz",
  "Farbschutz",
  "Mehr Feuchtigkeit",
  "Gesunde Kopfhaut",
  "Mehr Glanz",
  "Locken-Definition",
] as const
export type Goal = (typeof GOALS)[number]

export const GOAL_OPTIONS: readonly Goal[] = GOALS
