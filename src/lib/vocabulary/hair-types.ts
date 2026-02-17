export const HAIR_TYPES = ["glatt", "wellig", "lockig", "kraus"] as const
export type HairType = (typeof HAIR_TYPES)[number]

export const HAIR_THICKNESSES = ["fine", "normal", "coarse"] as const
export type HairThickness = (typeof HAIR_THICKNESSES)[number]

export const HAIR_TYPE_LABELS = {
  glatt: "Glatt",
  wellig: "Wellig",
  lockig: "Lockig",
  kraus: "Kraus",
} as const satisfies Record<HairType, string>

export const HAIR_THICKNESS_LABELS = {
  fine: "Fein",
  normal: "Mittel",
  coarse: "Dick",
} as const satisfies Record<HairThickness, string>

export const HAIR_TYPE_OPTIONS = HAIR_TYPES.map((value) => ({
  value,
  label: HAIR_TYPE_LABELS[value],
}))

export const HAIR_THICKNESS_OPTIONS = HAIR_THICKNESSES.map((value) => ({
  value,
  label: HAIR_THICKNESS_LABELS[value],
}))

export const HAIR_TYPE_ADJECTIVE = {
  glatt: "glattes",
  wellig: "welliges",
  lockig: "lockiges",
  kraus: "krauses",
} as const satisfies Record<HairType, string>

export const HAIR_THICKNESS_ADJECTIVE = {
  fine: "feines",
  normal: "mittelstarkes",
  coarse: "dickes",
} as const satisfies Record<HairThickness, string>
