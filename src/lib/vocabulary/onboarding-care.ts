/* ── Towel material ── */
export const TOWEL_MATERIALS = ["frottee", "mikrofaser", "tshirt", "turban_mikrofaser"] as const
export type TowelMaterial = (typeof TOWEL_MATERIALS)[number]

export const TOWEL_MATERIAL_LABELS = {
  frottee: "Frottee-Handtuch",
  mikrofaser: "Mikrofaser-Handtuch",
  tshirt: "T-Shirt / Baumwolltuch",
  turban_mikrofaser: "Turban (Mikrofaser)",
} as const satisfies Record<TowelMaterial, string>

export const TOWEL_MATERIAL_OPTIONS = TOWEL_MATERIALS.map((value) => ({
  value,
  label: TOWEL_MATERIAL_LABELS[value],
}))

/* ── Towel technique ── */
export const TOWEL_TECHNIQUES = ["rubbeln", "tupfen"] as const
export type TowelTechnique = (typeof TOWEL_TECHNIQUES)[number]

export const TOWEL_TECHNIQUE_LABELS = {
  rubbeln: "Rubbeln",
  tupfen: "Tupfen / Scrunchen",
} as const satisfies Record<TowelTechnique, string>

export const TOWEL_TECHNIQUE_OPTIONS = TOWEL_TECHNIQUES.map((value) => ({
  value,
  label: TOWEL_TECHNIQUE_LABELS[value],
}))

/* ── Drying method ── */
export const DRYING_METHODS = ["air_dry", "blow_dry", "blow_dry_diffuser"] as const
export type DryingMethod = (typeof DRYING_METHODS)[number]

export const DRYING_METHOD_LABELS = {
  air_dry: "Lufttrocknen",
  blow_dry: "Föhnen",
  blow_dry_diffuser: "Föhnen mit Diffusor",
} as const satisfies Record<DryingMethod, string>

export const DRYING_METHOD_OPTIONS = DRYING_METHODS.map((value) => ({
  value,
  label: DRYING_METHOD_LABELS[value],
}))

/* ── Brush type ── */
export const BRUSH_TYPES = [
  "wide_tooth_comb",
  "detangling",
  "paddle",
  "round",
  "boar_bristle",
  "fingers",
  "none_regular",
] as const
export type BrushType = (typeof BRUSH_TYPES)[number]

export const BRUSH_TYPE_LABELS = {
  wide_tooth_comb: "Grobzinkiger Kamm",
  detangling: "Detangling-Bürste",
  paddle: "Paddle-Bürste",
  round: "Rundbürste",
  boar_bristle: "Wildschweinborsten-Bürste",
  fingers: "Nur Finger",
  none_regular: "Keine regelmäßige Bürste",
} as const satisfies Record<BrushType, string>

export const BRUSH_TYPE_OPTIONS = BRUSH_TYPES.map((value) => ({
  value,
  label: BRUSH_TYPE_LABELS[value],
}))

/* ── Night protection ── */
export const NIGHT_PROTECTIONS = [
  "silk_satin_pillow",
  "silk_satin_bonnet",
  "loose_braid",
  "loose_bun",
  "pineapple",
  "tight_hairstyles",
] as const
export type NightProtection = (typeof NIGHT_PROTECTIONS)[number]

export const NIGHT_PROTECTION_LABELS = {
  silk_satin_pillow: "Seidenkissenbezug",
  silk_satin_bonnet: "Seidenhaube / Bonnet",
  loose_braid: "Lockerer Zopf",
  loose_bun: "Lockerer Dutt",
  pineapple: "Pineapple (hoher lockerer Dutt)",
  tight_hairstyles: "Enge Frisuren (Zöpfe, straffe Dutts)",
} as const satisfies Record<NightProtection, string>

export const NIGHT_PROTECTION_OPTIONS = NIGHT_PROTECTIONS.map((value) => ({
  value,
  label: NIGHT_PROTECTION_LABELS[value],
}))
