export const HAIR_TEXTURES = ["straight", "wavy", "curly", "coily"] as const
export type HairTexture = (typeof HAIR_TEXTURES)[number]

export const HAIR_THICKNESSES = ["fine", "normal", "coarse"] as const
export type HairThickness = (typeof HAIR_THICKNESSES)[number]

export const HAIR_TEXTURE_LABELS = {
  straight: "Glatt",
  wavy: "Wellig",
  curly: "Lockig",
  coily: "Kraus",
} as const satisfies Record<HairTexture, string>

export const HAIR_THICKNESS_LABELS = {
  fine: "Fein",
  normal: "Mittel",
  coarse: "Dick",
} as const satisfies Record<HairThickness, string>

export const HAIR_TEXTURE_OPTIONS = HAIR_TEXTURES.map((value) => ({
  value,
  label: HAIR_TEXTURE_LABELS[value],
}))

export const HAIR_THICKNESS_OPTIONS = HAIR_THICKNESSES.map((value) => ({
  value,
  label: HAIR_THICKNESS_LABELS[value],
}))

export const HAIR_TEXTURE_ADJECTIVE = {
  straight: "glattes",
  wavy: "welliges",
  curly: "lockiges",
  coily: "krauses",
} as const satisfies Record<HairTexture, string>

export const HAIR_THICKNESS_ADJECTIVE = {
  fine: "feines",
  normal: "mittelstarkes",
  coarse: "dickes",
} as const satisfies Record<HairThickness, string>
