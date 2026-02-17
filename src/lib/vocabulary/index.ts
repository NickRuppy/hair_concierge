export {
  HAIR_TYPES,
  HAIR_THICKNESSES,
  HAIR_TYPE_LABELS,
  HAIR_THICKNESS_LABELS,
  HAIR_TYPE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_TYPE_ADJECTIVE,
  HAIR_THICKNESS_ADJECTIVE,
} from "./hair-types"
export type { HairType, HairThickness } from "./hair-types"

export {
  CONCERNS,
  CONCERN_OPTIONS,
  GOALS,
  GOAL_OPTIONS,
} from "./concerns-goals"
export type { Concern, Goal } from "./concerns-goals"

export {
  WASH_FREQUENCIES,
  WASH_FREQUENCY_LABELS,
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_LEVELS,
  HEAT_STYLING_LABELS,
  HEAT_STYLING_OPTIONS,
} from "./frequencies"
export type { WashFrequency, HeatStyling } from "./frequencies"

export {
  CUTICLE_CONDITIONS,
  CUTICLE_CONDITION_LABELS,
  PROTEIN_MOISTURE_LEVELS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_TYPES,
  SCALP_TYPE_LABELS,
  SCALP_CONDITIONS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENTS,
  CHEMICAL_TREATMENT_LABELS,
  STYLING_TOOL_OPTIONS,
} from "./profile-labels"
export type {
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
} from "./profile-labels"

export {
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
} from "./source-labels"
export type { SourceType } from "./source-labels"

export {
  ERR_UNAUTHORIZED,
  ERR_FORBIDDEN,
  ERR_INVALID_DATA,
  fehler,
} from "./errors"
