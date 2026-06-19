export const HAIR_LENGTHS = ["very_short", "short", "medium", "long", "very_long"] as const
export type HairLength = (typeof HAIR_LENGTHS)[number]

export const HAIR_LENGTH_LABELS = {
  very_short: "Sehr kurz",
  short: "Kurz",
  medium: "Mittellang",
  long: "Lang",
  very_long: "Sehr lang",
} as const satisfies Record<HairLength, string>

export const HAIR_LENGTH_DESCRIPTIONS = {
  very_short: "Maschinenschnitt bis Pixie, etwa bis zu den Ohren.",
  short: "Bob-Länge, unter den Ohren bis knapp über die Schultern.",
  medium: "Schulterlänge bis Brusthöhe oder untere Schulterblätter.",
  long: "Unter Brust oder Schulterblättern bis ungefähr zur Taille.",
  very_long: "Taille oder länger.",
} as const satisfies Record<HairLength, string>

export const HAIR_LENGTH_OPTIONS = HAIR_LENGTHS.map((value) => ({
  value,
  label: HAIR_LENGTH_LABELS[value],
  description: HAIR_LENGTH_DESCRIPTIONS[value],
}))
