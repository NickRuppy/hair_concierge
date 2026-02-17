export const HAIR_TYPES = ["glatt", "wellig", "lockig", "kraus"] as const
export type HairType = (typeof HAIR_TYPES)[number]

export const HAIR_TEXTURES = ["fein", "mittel", "dick"] as const
export type HairTexture = (typeof HAIR_TEXTURES)[number]

export const HAIR_TYPE_LABELS = {
  glatt: "Glatt",
  wellig: "Wellig",
  lockig: "Lockig",
  kraus: "Kraus",
} as const satisfies Record<HairType, string>

export const HAIR_TEXTURE_LABELS = {
  fein: "Fein",
  mittel: "Mittel",
  dick: "Dick",
} as const satisfies Record<HairTexture, string>

export const HAIR_TYPE_OPTIONS = HAIR_TYPES.map((value) => ({
  value,
  label: HAIR_TYPE_LABELS[value],
}))

export const HAIR_TEXTURE_OPTIONS = HAIR_TEXTURES.map((value) => ({
  value,
  label: HAIR_TEXTURE_LABELS[value],
}))

export const HAIR_TYPE_ADJECTIVE = {
  glatt: "glattes",
  wellig: "welliges",
  lockig: "lockiges",
  kraus: "krauses",
} as const satisfies Record<HairType, string>

export const HAIR_TEXTURE_ADJECTIVE = {
  fein: "feines",
  mittel: "mittelstarkes",
  dick: "dickes",
} as const satisfies Record<HairTexture, string>
