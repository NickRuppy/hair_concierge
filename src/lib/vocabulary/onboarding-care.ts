/* ── Towel material ── */
export const TOWEL_MATERIALS = [
  "frottee",
  "mikrofaser",
  "tshirt",
  "turban_mikrofaser",
  "no_towel",
] as const
export type TowelMaterial = (typeof TOWEL_MATERIALS)[number]

export const TOWEL_MATERIAL_LABELS = {
  frottee: "Frottee-Handtuch",
  mikrofaser: "Mikrofaser-Handtuch",
  tshirt: "T-Shirt / Baumwolltuch",
  turban_mikrofaser: "Turban (Mikrofaser)",
  no_towel: "Kein Handtuch: Ich lasse meine Haare tropfnass trocknen",
} as const satisfies Record<TowelMaterial, string>

export const TOWEL_MATERIAL_OPTIONS = TOWEL_MATERIALS.map((value) => ({
  value,
  label: TOWEL_MATERIAL_LABELS[value],
}))

/* ── Towel technique ── */
export const TOWEL_TECHNIQUES = ["rough_rubbing", "gentle_press"] as const
export type TowelTechnique = (typeof TOWEL_TECHNIQUES)[number]

export const TOWEL_TECHNIQUE_LABELS = {
  rough_rubbing: "Rubbeln",
  gentle_press: "Sanft ausdrücken / scrunchen",
} as const satisfies Record<TowelTechnique, string>

const TOWEL_TECHNIQUE_CANONICAL_VALUES = new Set<string>(TOWEL_TECHNIQUES)

export function normalizeTowelTechniqueValue(
  value: string | null | undefined,
): TowelTechnique | null {
  if (!value) return null
  const normalized =
    value === "rubbeln" ? "rough_rubbing" : value === "tupfen" ? "gentle_press" : value

  return TOWEL_TECHNIQUE_CANONICAL_VALUES.has(normalized) ? (normalized as TowelTechnique) : null
}

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
] as const
export type BrushType = (typeof BRUSH_TYPES)[number]

export const BRUSH_TYPE_LABELS = {
  wide_tooth_comb: "Grobzinkiger Kamm",
  detangling: "Detangling-Bürste",
  paddle: "Paddle-Bürste",
  round: "Rundbürste",
  boar_bristle: "Wildschweinborsten-Bürste",
  fingers: "Nur Finger",
} as const satisfies Record<BrushType, string>

export const BRUSH_TYPE_OPTIONS = BRUSH_TYPES.map((value) => ({
  value,
  label: BRUSH_TYPE_LABELS[value],
}))

/* ── Night protection ── */
export const NIGHT_PROTECTIONS = [
  "silk_satin_pillow",
  "silk_satin_bonnet",
  "loose_tied",
  "pineapple",
  "length_tip_accessory",
] as const
export type NightProtection = (typeof NIGHT_PROTECTIONS)[number]

export const NIGHT_PROTECTION_LABELS = {
  silk_satin_pillow: "Seidenkissenbezug",
  silk_satin_bonnet: "Bonnet / Schlafhaube",
  loose_tied: "Locker zusammengebunden",
  pineapple: "Pineapple",
  length_tip_accessory: "Längen-/Spitzenschutz (z. B. HairHOMIE)",
} as const satisfies Record<NightProtection, string>

const NIGHT_PROTECTION_CANONICAL_VALUES = new Set<string>(NIGHT_PROTECTIONS)

export function normalizeNightProtectionValues(
  values: readonly string[] | null | undefined,
): NightProtection[] | null {
  if (!values) return null

  const normalized = values
    .map((value) => (value === "loose_braid" || value === "loose_bun" ? "loose_tied" : value))
    .filter((value): value is NightProtection => NIGHT_PROTECTION_CANONICAL_VALUES.has(value))

  return Array.from(new Set(normalized))
}

export const NIGHT_PROTECTION_OPTIONS = NIGHT_PROTECTIONS.map((value) => ({
  value,
  label: NIGHT_PROTECTION_LABELS[value],
}))
