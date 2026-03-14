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

/* ── Scalp type ── */

export const SCALP_TYPES = ["oily", "balanced", "dry"] as const
export type ScalpType = (typeof SCALP_TYPES)[number]

export const SCALP_TYPE_LABELS: Record<string, string> = {
  oily: "Schnell fettend",
  balanced: "Ausgeglichen",
  dry: "Trocken",
} satisfies Record<ScalpType, string>

/* ── Scalp condition ── */

export const SCALP_CONDITIONS = ["none", "dandruff", "dry_flakes", "irritated"] as const
export type ScalpCondition = (typeof SCALP_CONDITIONS)[number]

export const SCALP_CONDITION_LABELS: Record<string, string> = {
  none: "Keine Beschwerden",
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

/* ── Styling tools ── */

export const STYLING_TOOLS = [
  "blow_dryer",
  "flat_iron",
  "curling_iron",
  "hot_air_brush",
  "diffuser",
] as const
export type StylingTool = (typeof STYLING_TOOLS)[number]

export const STYLING_TOOL_LABELS: Record<string, string> = {
  blow_dryer: "Föhn",
  flat_iron: "Glätteisen",
  curling_iron: "Lockenstab",
  hot_air_brush: "Warmluftbürste",
  diffuser: "Diffusor",
} satisfies Record<StylingTool, string>

export const STYLING_TOOL_OPTIONS = STYLING_TOOLS.map((value) => ({
  value,
  label: STYLING_TOOL_LABELS[value],
}))
