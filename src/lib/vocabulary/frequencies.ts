export const WASH_FREQUENCIES = [
  "taeglich",
  "alle_2_tage",
  "2_mal_woche",
  "1_mal_woche",
  "seltener",
] as const
export type WashFrequency = (typeof WASH_FREQUENCIES)[number]

export const WASH_FREQUENCY_LABELS = {
  taeglich: "Täglich",
  alle_2_tage: "Alle 2 Tage",
  "2_mal_woche": "2x pro Woche",
  "1_mal_woche": "1x pro Woche",
  seltener: "Seltener",
} as const satisfies Record<WashFrequency, string>

export const WASH_FREQUENCY_OPTIONS = WASH_FREQUENCIES.map((value) => ({
  value,
  label: WASH_FREQUENCY_LABELS[value],
}))

export const HEAT_STYLING_LEVELS = [
  "taeglich",
  "mehrmals_woche",
  "1_mal_woche",
  "selten",
  "nie",
] as const
export type HeatStyling = (typeof HEAT_STYLING_LEVELS)[number]

export const HEAT_STYLING_LABELS = {
  taeglich: "Täglich",
  mehrmals_woche: "Mehrmals pro Woche",
  "1_mal_woche": "1x pro Woche",
  selten: "Selten",
  nie: "Nie",
} as const satisfies Record<HeatStyling, string>

export const HEAT_STYLING_OPTIONS = HEAT_STYLING_LEVELS.map((value) => ({
  value,
  label: HEAT_STYLING_LABELS[value],
}))
