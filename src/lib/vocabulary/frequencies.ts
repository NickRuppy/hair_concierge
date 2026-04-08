export const WASH_FREQUENCIES = [
  "daily",
  "every_2_3_days",
  "once_weekly",
  "rarely",
] as const
export type WashFrequency = (typeof WASH_FREQUENCIES)[number]

export const WASH_FREQUENCY_LABELS = {
  daily: "Täglich",
  every_2_3_days: "Alle 2-3 Tage",
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

export const PRODUCT_FREQUENCIES = ['rarely','1_2x','3_4x','5_6x','daily'] as const
export type ProductFrequency = (typeof PRODUCT_FREQUENCIES)[number]

export const PRODUCT_FREQUENCY_LABELS = {
  rarely: "Seltener",
  "1_2x": "1-2x pro Woche",
  "3_4x": "3-4x pro Woche",
  "5_6x": "5-6x pro Woche",
  daily: "Täglich",
} as const satisfies Record<ProductFrequency, string>

export const PRODUCT_FREQUENCY_OPTIONS = PRODUCT_FREQUENCIES.map((value) => ({
  value,
  label: PRODUCT_FREQUENCY_LABELS[value],
}))
