export const WASH_FREQUENCIES = [
  "daily",
  "every_2_days",
  "twice_weekly",
  "once_weekly",
  "rarely",
] as const
export type WashFrequency = (typeof WASH_FREQUENCIES)[number]

export const WASH_FREQUENCY_LABELS = {
  daily: "Täglich",
  every_2_days: "Alle 2 Tage",
  twice_weekly: "2x pro Woche",
  once_weekly: "1x pro Woche",
  rarely: "Seltener",
} as const satisfies Record<WashFrequency, string>

export const WASH_FREQUENCY_OPTIONS = WASH_FREQUENCIES.map((value) => ({
  value,
  label: WASH_FREQUENCY_LABELS[value],
}))

export const HEAT_STYLING_LEVELS = [
  "daily",
  "several_weekly",
  "once_weekly",
  "rarely",
  "never",
] as const
export type HeatStyling = (typeof HEAT_STYLING_LEVELS)[number]

export const HEAT_STYLING_LABELS = {
  daily: "Täglich",
  several_weekly: "Mehrmals pro Woche",
  once_weekly: "1x pro Woche",
  rarely: "Selten",
  never: "Nie",
} as const satisfies Record<HeatStyling, string>

export const HEAT_STYLING_OPTIONS = HEAT_STYLING_LEVELS.map((value) => ({
  value,
  label: HEAT_STYLING_LABELS[value],
}))
