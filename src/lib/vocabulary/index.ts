export {
  HAIR_TEXTURES,
  HAIR_THICKNESSES,
  HAIR_TEXTURE_LABELS,
  HAIR_THICKNESS_LABELS,
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_TEXTURE_ADJECTIVE,
  HAIR_THICKNESS_ADJECTIVE,
} from "./hair-types"
export type { HairTexture, HairThickness } from "./hair-types"

export {
  PROFILE_CONCERNS,
  PROFILE_CONCERN_LABELS,
  PROFILE_CONCERN_OPTIONS,
  GOALS,
  GOAL_LABELS,
  GOAL_OPTIONS,
} from "./concerns-goals"
export type { ProfileConcern, Goal } from "./concerns-goals"

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
  HAIR_DENSITIES,
  HAIR_DENSITY_LABELS,
  HAIR_DENSITY_OPTIONS,
  SCALP_TYPES,
  SCALP_TYPE_LABELS,
  SCALP_CONDITIONS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENTS,
  CHEMICAL_TREATMENT_LABELS,
  DESIRED_VOLUME_LEVELS,
  DESIRED_VOLUME_LABELS,
  DESIRED_VOLUME_OPTIONS,
  STYLING_TOOLS,
  STYLING_TOOL_LABELS,
  STYLING_TOOL_OPTIONS,
  MECHANICAL_STRESS_FACTORS,
  MECHANICAL_STRESS_FACTOR_LABELS,
  MECHANICAL_STRESS_FACTOR_OPTIONS,
  deriveMechanicalStressLevel,
} from "./profile-labels"
export type {
  CuticleCondition,
  ProteinMoistureBalance,
  HairDensity,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  StylingTool,
  MechanicalStressFactor,
  MechanicalStressLevel,
} from "./profile-labels"

export {
  POST_WASH_ACTIONS,
  POST_WASH_ACTION_LABELS,
  POST_WASH_ACTION_OPTIONS,
  ROUTINE_PREFERENCES,
  ROUTINE_PREFERENCE_LABELS,
  ROUTINE_PREFERENCE_OPTIONS,
  ROUTINE_PRODUCTS,
  ROUTINE_PRODUCT_LABELS,
  ROUTINE_PRODUCT_OPTIONS,
} from "../leave-in/constants"
export type { PostWashAction, RoutinePreference, RoutineProduct } from "../leave-in/constants"

export { SOURCE_TYPES, SOURCE_TYPE_LABELS } from "./source-labels"
export type { SourceType } from "./source-labels"

export { ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_INVALID_DATA, fehler } from "./errors"

export {
  TEXTURE_GOAL_PRIORITY,
  GOAL_LABEL_OVERRIDES,
  getOrderedGoals,
  getGoalLabel,
} from "./onboarding-goals"

export {
  PRODUCT_FREQUENCIES,
  PRODUCT_FREQUENCY_LABELS,
  PRODUCT_FREQUENCY_OPTIONS,
} from "./frequencies"
export type { ProductFrequency } from "./frequencies"

export {
  TOWEL_MATERIALS,
  TOWEL_MATERIAL_LABELS,
  TOWEL_MATERIAL_OPTIONS,
  TOWEL_TECHNIQUES,
  TOWEL_TECHNIQUE_LABELS,
  TOWEL_TECHNIQUE_OPTIONS,
  DRYING_METHODS,
  DRYING_METHOD_LABELS,
  DRYING_METHOD_OPTIONS,
  BRUSH_TYPES,
  BRUSH_TYPE_LABELS,
  BRUSH_TYPE_OPTIONS,
  NIGHT_PROTECTIONS,
  NIGHT_PROTECTION_LABELS,
  NIGHT_PROTECTION_OPTIONS,
} from "./onboarding-care"
export type {
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "./onboarding-care"
