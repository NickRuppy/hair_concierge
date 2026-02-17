/* ── Cuticle condition ── */

export const CUTICLE_CONDITIONS = ["glatt", "leicht_uneben", "rau"] as const
export type CuticleCondition = (typeof CUTICLE_CONDITIONS)[number]

export const CUTICLE_CONDITION_LABELS: Record<string, string> = {
  glatt: "Glatt (intakt)",
  leicht_uneben: "Leicht aufgeraut",
  rau: "Geschädigt",
} satisfies Record<CuticleCondition, string>

/* ── Protein-moisture balance ── */

export const PROTEIN_MOISTURE_LEVELS = ["elastisch", "ueberdehnt", "bricht"] as const
export type ProteinMoistureBalance = (typeof PROTEIN_MOISTURE_LEVELS)[number]

export const PROTEIN_MOISTURE_LABELS: Record<string, string> = {
  elastisch: "Ausgewogen",
  ueberdehnt: "Proteinmangel",
  bricht: "Feuchtigkeitsmangel",
} satisfies Record<ProteinMoistureBalance, string>

/* ── Scalp type ── */

export const SCALP_TYPES = ["fettig", "ausgeglichen", "trocken"] as const
export type ScalpType = (typeof SCALP_TYPES)[number]

export const SCALP_TYPE_LABELS: Record<string, string> = {
  fettig: "Schnell fettend",
  ausgeglichen: "Ausgeglichen",
  trocken: "Trocken",
} satisfies Record<ScalpType, string>

/* ── Scalp condition ── */

export const SCALP_CONDITIONS = ["keine", "schuppen", "gereizt"] as const
export type ScalpCondition = (typeof SCALP_CONDITIONS)[number]

export const SCALP_CONDITION_LABELS: Record<string, string> = {
  keine: "Keine Beschwerden",
  schuppen: "Schuppen",
  gereizt: "Gereizte Kopfhaut",
} satisfies Record<ScalpCondition, string>

/* ── Chemical treatment ── */

export const CHEMICAL_TREATMENTS = ["natur", "gefaerbt", "blondiert"] as const
export type ChemicalTreatment = (typeof CHEMICAL_TREATMENTS)[number]

export const CHEMICAL_TREATMENT_LABELS: Record<string, string> = {
  natur: "Naturhaar",
  gefaerbt: "Gefärbt",
  blondiert: "Blondiert",
} satisfies Record<ChemicalTreatment, string>

/* ── Styling tools ── */

export const STYLING_TOOL_OPTIONS = [
  "Föhn",
  "Glätteisen",
  "Lockenstab",
  "Warmluftbürste",
  "Diffusor",
] as const
