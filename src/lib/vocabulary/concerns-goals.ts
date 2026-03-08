export const CONCERNS = [
  "hair_loss",
  "dandruff",
  "dryness",
  "oily_scalp",
  "hair_damage",
  "colored",
  "split_ends",
  "frizz",
  "thinning",
] as const
export type Concern = (typeof CONCERNS)[number]

export const CONCERN_LABELS: Record<Concern, string> = {
  hair_loss: "Haarausfall",
  dandruff: "Schuppen",
  dryness: "Trockenheit",
  oily_scalp: "Fettige Kopfhaut",
  hair_damage: "Haarschaeden",
  colored: "Coloriert",
  split_ends: "Spliss",
  frizz: "Frizz",
  thinning: "Duenner werdendes Haar",
}

export const CONCERN_OPTIONS = CONCERNS.map((value) => ({
  value,
  label: CONCERN_LABELS[value],
}))

export const GOALS = [
  "volume",
  "healthier_hair",
  "hair_growth",
  "less_frizz",
  "color_protection",
  "moisture",
  "healthy_scalp",
  "shine",
  "curl_definition",
] as const
export type Goal = (typeof GOALS)[number]

export const GOAL_LABELS: Record<Goal, string> = {
  volume: "Mehr Volumen",
  healthier_hair: "Gesuenderes Haar",
  hair_growth: "Haarwachstum",
  less_frizz: "Weniger Frizz",
  color_protection: "Farbschutz",
  moisture: "Mehr Feuchtigkeit",
  healthy_scalp: "Gesunde Kopfhaut",
  shine: "Mehr Glanz",
  curl_definition: "Locken-Definition",
}

export const GOAL_OPTIONS = GOALS.map((value) => ({
  value,
  label: GOAL_LABELS[value],
}))
