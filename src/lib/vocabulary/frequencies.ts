export const PRODUCT_FREQUENCIES = [
  "less_than_monthly",
  "monthly_1x",
  "biweekly_1x",
  "weekly_1x",
  "weekly_2x",
  "weekly_3_4x",
  "weekly_5_6x",
  "daily_1x",
] as const
export type ProductFrequency = (typeof PRODUCT_FREQUENCIES)[number]

const LEGACY_PRODUCT_FREQUENCY_ALIASES = {
  rarely: "less_than_monthly",
  "1_2x": "weekly_1x",
  "3_4x": "weekly_3_4x",
  "5_6x": "weekly_5_6x",
  daily: "daily_1x",
} as const

const LEGACY_PROFILE_FREQUENCY_ALIASES = {
  once_weekly: "weekly_1x",
  every_4_5_days: "weekly_2x",
  every_2_3_days: "weekly_3_4x",
} as const

const PRODUCT_FREQUENCY_SET = new Set<string>(PRODUCT_FREQUENCIES)

export type ProductFrequencyInput =
  | ProductFrequency
  | keyof typeof LEGACY_PRODUCT_FREQUENCY_ALIASES
  | keyof typeof LEGACY_PROFILE_FREQUENCY_ALIASES

export interface ProductFrequencyMetadata {
  value: ProductFrequency
  label: string
  sortOrder: number
  minPerWeek: number
  maxPerWeek: number
  midpointPerWeek: number
  comparable: boolean
}

export type ProductFrequencyComparison = -1 | 0 | 1 | null

export const PRODUCT_FREQUENCY_METADATA = {
  less_than_monthly: {
    value: "less_than_monthly",
    label: "Seltener als 1x/Monat",
    sortOrder: 0,
    minPerWeek: 0,
    maxPerWeek: 0.249,
    midpointPerWeek: 0.125,
    comparable: true,
  },
  monthly_1x: {
    value: "monthly_1x",
    label: "Ca. 1x/Monat",
    sortOrder: 1,
    minPerWeek: 0.25,
    maxPerWeek: 0.25,
    midpointPerWeek: 0.25,
    comparable: true,
  },
  biweekly_1x: {
    value: "biweekly_1x",
    label: "Ca. alle 2 Wochen",
    sortOrder: 2,
    minPerWeek: 0.5,
    maxPerWeek: 0.5,
    midpointPerWeek: 0.5,
    comparable: true,
  },
  weekly_1x: {
    value: "weekly_1x",
    label: "1x/Woche",
    sortOrder: 3,
    minPerWeek: 1,
    maxPerWeek: 1,
    midpointPerWeek: 1,
    comparable: true,
  },
  weekly_2x: {
    value: "weekly_2x",
    label: "2x/Woche",
    sortOrder: 4,
    minPerWeek: 2,
    maxPerWeek: 2,
    midpointPerWeek: 2,
    comparable: true,
  },
  weekly_3_4x: {
    value: "weekly_3_4x",
    label: "3-4x/Woche",
    sortOrder: 5,
    minPerWeek: 3,
    maxPerWeek: 4,
    midpointPerWeek: 3.5,
    comparable: true,
  },
  weekly_5_6x: {
    value: "weekly_5_6x",
    label: "5-6x/Woche",
    sortOrder: 6,
    minPerWeek: 5,
    maxPerWeek: 6,
    midpointPerWeek: 5.5,
    comparable: true,
  },
  daily_1x: {
    value: "daily_1x",
    label: "Täglich",
    sortOrder: 7,
    minPerWeek: 7,
    maxPerWeek: 7,
    midpointPerWeek: 7,
    comparable: true,
  },
} as const satisfies Record<ProductFrequency, ProductFrequencyMetadata>

export const PRODUCT_FREQUENCY_LABELS = Object.fromEntries(
  PRODUCT_FREQUENCIES.map((value) => [value, PRODUCT_FREQUENCY_METADATA[value].label]),
) as Record<ProductFrequency, string>

export const PRODUCT_FREQUENCY_OPTIONS = PRODUCT_FREQUENCIES.map((value) => ({
  value,
  label: PRODUCT_FREQUENCY_LABELS[value],
}))

export function normalizeProductFrequency(
  frequency: ProductFrequencyInput | string | null | undefined,
): ProductFrequency | null {
  if (frequency == null) return null
  if (PRODUCT_FREQUENCY_SET.has(frequency)) return frequency as ProductFrequency

  return (
    LEGACY_PRODUCT_FREQUENCY_ALIASES[frequency as keyof typeof LEGACY_PRODUCT_FREQUENCY_ALIASES] ??
    LEGACY_PROFILE_FREQUENCY_ALIASES[frequency as keyof typeof LEGACY_PROFILE_FREQUENCY_ALIASES] ??
    null
  )
}

export function getProductFrequencyMetadata(
  frequency: ProductFrequencyInput,
): ProductFrequencyMetadata {
  const normalized = normalizeProductFrequency(frequency)
  if (!normalized) {
    throw new Error(`Unknown product frequency: ${frequency}`)
  }

  return PRODUCT_FREQUENCY_METADATA[normalized]
}

export function compareProductFrequencies(
  left: ProductFrequency | null | undefined,
  right: ProductFrequency | null | undefined,
): ProductFrequencyComparison {
  if (left == null || right == null) return null

  const leftMetadata = getProductFrequencyMetadata(left)
  const rightMetadata = getProductFrequencyMetadata(right)

  if (leftMetadata.sortOrder === rightMetadata.sortOrder) return 0
  return leftMetadata.sortOrder < rightMetadata.sortOrder ? -1 : 1
}

export function isProductFrequencyAtLeast(
  frequency: ProductFrequency | null | undefined,
  threshold: ProductFrequency,
): boolean {
  const comparison = compareProductFrequencies(frequency, threshold)
  return comparison !== null && comparison >= 0
}

export function chooseHigherProductFrequency(
  current: ProductFrequency | null | undefined,
  incoming: ProductFrequency | null | undefined,
): ProductFrequency | null {
  if (incoming == null) return current ?? null
  if (current == null) return incoming

  return compareProductFrequencies(current, incoming) === -1 ? incoming : current
}

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
