export const PROFILE_CONCERNS = [
  "hair_loss",
  "dandruff",
  "dryness",
  "oily_scalp",
  "hair_damage",
  "split_ends",
  "breakage",
  "frizz",
  "tangling",
  "thinning",
] as const
export type ProfileConcern = (typeof PROFILE_CONCERNS)[number]

export const PROFILE_CONCERN_LABELS: Record<ProfileConcern, string> = {
  hair_loss: "Haarausfall",
  dandruff: "Schuppen",
  dryness: "Trockenheit",
  oily_scalp: "Fettige Kopfhaut",
  hair_damage: "Haarschaeden",
  split_ends: "Spliss",
  breakage: "Haarbruch",
  frizz: "Frizz",
  tangling: "Verknotungen",
  thinning: "Duenner werdendes Haar",
}

export const PROFILE_CONCERN_OPTIONS = PROFILE_CONCERNS.map((value) => ({
  value,
  label: PROFILE_CONCERN_LABELS[value],
}))

export const GOALS = [
  "volume",
  "healthier_hair",
  "less_frizz",
  "color_protection",
  "moisture",
  "healthy_scalp",
  "shine",
  "curl_definition",
  "less_split_ends",
  "less_volume",
  "strengthen",
  "anti_breakage",
] as const
export type Goal = (typeof GOALS)[number]

export const GOAL_LABELS: Record<Goal, string> = {
  volume: "Mehr Volumen",
  healthier_hair: "Gesünderes Haar",
  less_frizz: "Weniger Frizz",
  color_protection: "Farbschutz",
  moisture: "Mehr Feuchtigkeit",
  healthy_scalp: "Gesunde Kopfhaut",
  shine: "Mehr Glanz",
  curl_definition: "Locken-Definition",
  less_split_ends: "Weniger Spliss",
  less_volume: "Weniger Volumen",
  strengthen: "Haare stärken",
  anti_breakage: "Anti-Haarbruch",
}

export const GOAL_OPTIONS = GOALS.map((value) => ({
  value,
  label: GOAL_LABELS[value],
}))
