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
  "low_shine",
  "lost_shape",
  "low_volume_or_weighed_down",
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
  // Existing quiz labels (quiz-data.ts, default/wavy concern options).
  low_shine: "Wenig Glanz",
  lost_shape: "Meine Wellen verlieren schnell ihre Form",
  low_volume_or_weighed_down: "Mein Ansatz wirkt flach oder meine Längen schnell beschwert",
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

/** Engine/legacy columns retain a neutral goal; quiz-result Goal and its copy stay unchanged. */
export const ENGINE_GOALS = [...GOALS, "volume_balance"] as const
export type EngineGoal = (typeof ENGINE_GOALS)[number]

export const GOAL_LABELS: Record<EngineGoal, string> = {
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
  volume_balance: "Ausgewogenes Volumen",
}

export const GOAL_OPTIONS = GOALS.map((value) => ({
  value,
  label: GOAL_LABELS[value],
}))
