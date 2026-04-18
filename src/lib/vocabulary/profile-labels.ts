/* ── Cuticle condition ── */

export const CUTICLE_CONDITIONS = ["smooth", "slightly_rough", "rough"] as const
export type CuticleCondition = (typeof CUTICLE_CONDITIONS)[number]

export const CUTICLE_CONDITION_LABELS: Record<string, string> = {
  smooth: "Glatt (intakt)",
  slightly_rough: "Leicht aufgeraut",
  rough: "Geschädigt",
} satisfies Record<CuticleCondition, string>

/* ── Protein-moisture balance ── */

export const PROTEIN_MOISTURE_LEVELS = ["snaps", "stretches_bounces", "stretches_stays"] as const
export type ProteinMoistureBalance = (typeof PROTEIN_MOISTURE_LEVELS)[number]

export const PROTEIN_MOISTURE_LABELS: Record<string, string> = {
  snaps: "Feuchtigkeitsmangel",
  stretches_bounces: "Ausgewogen",
  stretches_stays: "Proteinmangel",
} satisfies Record<ProteinMoistureBalance, string>

/* ── Hair density ── */

export const HAIR_DENSITIES = ["low", "medium", "high"] as const
export type HairDensity = (typeof HAIR_DENSITIES)[number]

export const HAIR_DENSITY_LABELS: Record<string, string> = {
  low: "Wenig Haare",
  medium: "Mittlere Dichte",
  high: "Viele Haare",
} satisfies Record<HairDensity, string>

export const HAIR_DENSITY_OPTIONS = HAIR_DENSITIES.map((value) => ({
  value,
  label: HAIR_DENSITY_LABELS[value],
}))

/* ── Scalp type ── */

export const SCALP_TYPES = ["oily", "balanced", "dry"] as const
export type ScalpType = (typeof SCALP_TYPES)[number]

export const SCALP_TYPE_LABELS: Record<string, string> = {
  oily: "Schnell fettend",
  balanced: "Ausgeglichen",
  dry: "Trocken",
} satisfies Record<ScalpType, string>

/* ── Scalp condition ── */

export const SCALP_CONDITIONS = ["dandruff", "dry_flakes", "irritated"] as const
export type ScalpCondition = (typeof SCALP_CONDITIONS)[number]

export const SCALP_CONDITION_LABELS: Record<string, string> = {
  dandruff: "Schuppen",
  dry_flakes: "Trockene Schuppen",
  irritated: "Gereizte Kopfhaut",
} satisfies Record<ScalpCondition, string>

/* ── Chemical treatment ── */

export const CHEMICAL_TREATMENTS = ["natural", "colored", "bleached"] as const
export type ChemicalTreatment = (typeof CHEMICAL_TREATMENTS)[number]

export const CHEMICAL_TREATMENT_LABELS: Record<string, string> = {
  natural: "Naturhaar",
  colored: "Gefärbt",
  bleached: "Blondiert",
} satisfies Record<ChemicalTreatment, string>

/* ── Desired volume ── */

export const DESIRED_VOLUME_LEVELS = ["less", "balanced", "more"] as const
export type DesiredVolume = (typeof DESIRED_VOLUME_LEVELS)[number]

export const DESIRED_VOLUME_LABELS: Record<string, string> = {
  less: "Weniger",
  balanced: "Ausgeglichen",
  more: "Mehr",
} satisfies Record<DesiredVolume, string>

export const DESIRED_VOLUME_OPTIONS = DESIRED_VOLUME_LEVELS.map((value) => ({
  value,
  label: DESIRED_VOLUME_LABELS[value],
}))

/* ── Styling tools ── */

export const STYLING_TOOLS = [
  "blow_dryer",
  "flat_iron",
  "curling_iron",
  "wave_iron",
  "hot_air_brush",
  "multi_tool",
  "diffuser",
] as const
export type StylingTool = (typeof STYLING_TOOLS)[number]

export const STYLING_TOOL_LABELS: Record<string, string> = {
  blow_dryer: "Föhn",
  flat_iron: "Glätteisen",
  curling_iron: "Lockenstab",
  wave_iron: "Welleneisen",
  hot_air_brush: "Warmluftbürste",
  multi_tool: "Multi-Tool",
  diffuser: "Diffusor",
} satisfies Record<StylingTool, string>

export const STYLING_TOOL_OPTIONS = STYLING_TOOLS.map((value) => ({
  value,
  label: STYLING_TOOL_LABELS[value],
}))

/* ── Mechanical stress factors ── */

export const MECHANICAL_STRESS_FACTORS = [
  "tight_hairstyles",
  "rough_brushing",
  "towel_rubbing",
] as const
export type MechanicalStressFactor = (typeof MECHANICAL_STRESS_FACTORS)[number]

export const MECHANICAL_STRESS_FACTOR_LABELS: Record<string, string> = {
  tight_hairstyles: "Enge Frisuren (Zoepfe, Dutts, Extensions)",
  rough_brushing: "Haeufiges oder grobes Buersten",
  towel_rubbing: "Handtuch-Rubbeln statt Tupfen",
} satisfies Record<MechanicalStressFactor, string>

export const MECHANICAL_STRESS_FACTOR_OPTIONS = MECHANICAL_STRESS_FACTORS.map((value) => ({
  value,
  label: MECHANICAL_STRESS_FACTOR_LABELS[value],
}))

export type MechanicalStressLevel = "low" | "medium" | "high"

export function deriveMechanicalStressLevel(
  factors: MechanicalStressFactor[],
): MechanicalStressLevel {
  if (factors.length === 0) return "low"
  if (factors.length === 1) return "medium"
  return "high"
}
