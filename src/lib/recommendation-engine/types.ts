import type {
  BrushType,
  ChemicalTreatment,
  ProfileConcern,
  CuticleCondition,
  DryingMethod,
  Goal,
  HairDensity,
  HairTexture,
  HairThickness,
  HeatStyling,
  NightProtection,
  ProductFrequency,
  ProteinMoistureBalance,
  ScalpCondition,
  ScalpType,
  StylingTool,
  TowelMaterial,
  TowelTechnique,
  WashFrequency,
} from "@/lib/vocabulary"
import type { ShampooBucket } from "@/lib/shampoo/constants"
import type { OilNoRecommendationReason, OilPurpose, OilSubtype } from "@/lib/oil/constants"
import type {
  BALANCE_DIRECTIONS,
  BOND_APPLICATION_MODES,
  BOND_BUILDER_PRIORITIES,
  BOND_REPAIR_INTENSITIES,
  CANONICAL_BALANCE_TARGETS,
  CANONICAL_CLEANSING_INTENSITIES,
  CANONICAL_REPAIR_LEVELS,
  CANONICAL_SCALP_ROUTES,
  CANONICAL_WEIGHTS,
  CATEGORY_FIT_STATUSES,
  CONFIDENCE_LEVELS,
  DAMAGE_LEVELS,
  ENGINE_CATEGORY_IDS,
  INVENTORY_CATEGORIES,
  LEAVE_IN_CARE_TARGETS,
  PEELING_TYPES,
  RECOMMENDATION_ACTIONS,
  REPAIR_PRIORITIES,
  SCALP_TYPE_FOCUSES,
} from "@/lib/recommendation-engine/contracts"

export type EngineCategoryId = (typeof ENGINE_CATEGORY_IDS)[number]
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number]
export type DamageLevel = (typeof DAMAGE_LEVELS)[number]
export type RepairPriority = (typeof REPAIR_PRIORITIES)[number]
export type BalanceDirection = (typeof BALANCE_DIRECTIONS)[number]
export type BondBuilderPriority = (typeof BOND_BUILDER_PRIORITIES)[number]
export type CategoryFitStatus = (typeof CATEGORY_FIT_STATUSES)[number]
export type CanonicalBalanceTarget = (typeof CANONICAL_BALANCE_TARGETS)[number]
export type CanonicalScalpRoute = (typeof CANONICAL_SCALP_ROUTES)[number]
export type CanonicalCleansingIntensity = (typeof CANONICAL_CLEANSING_INTENSITIES)[number]
export type CanonicalRepairLevel = (typeof CANONICAL_REPAIR_LEVELS)[number]
export type CanonicalWeight = (typeof CANONICAL_WEIGHTS)[number]
export type ScalpTypeFocus = (typeof SCALP_TYPE_FOCUSES)[number]
export type BondRepairIntensity = (typeof BOND_REPAIR_INTENSITIES)[number]
export type BondApplicationMode = (typeof BOND_APPLICATION_MODES)[number]
export type PeelingType = (typeof PEELING_TYPES)[number]
export type LeaveInCareTarget = (typeof LEAVE_IN_CARE_TARGETS)[number]
export type RecommendationAction = (typeof RECOMMENDATION_ACTIONS)[number]
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number]

export interface RecommendationRequestContext {
  requestedCategory: EngineCategoryId | null
  oilPurpose: OilPurpose | null
  oilNoRecommendationReason: OilNoRecommendationReason | null
}

export interface RawRoutineInventoryItem {
  category: InventoryCategory
  product_name: string | null
  frequency_range: ProductFrequency | null
}

export interface RawHairProfileInput {
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  concerns: ProfileConcern[]
  goals: Goal[]
  wash_frequency: WashFrequency | null
  heat_styling: HeatStyling | null
  styling_tools: StylingTool[] | null
  cuticle_condition: CuticleCondition | null
  protein_moisture_balance: ProteinMoistureBalance | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
  chemical_treatment: ChemicalTreatment[]
  towel_material: TowelMaterial | null
  towel_technique: TowelTechnique | null
  drying_method: DryingMethod | null
  brush_type: BrushType | null
  night_protection: NightProtection[] | null
  uses_heat_protection: boolean
}

export interface RawRecommendationInput {
  profile: RawHairProfileInput
  routineInventory: RawRoutineInventoryItem[]
}

export interface NormalizedRoutineInventoryItem {
  category: InventoryCategory
  present: boolean
  productName: string | null
  frequencyBand: ProductFrequency | null
}

export type RoutineInventory = Record<InventoryCategory, NormalizedRoutineInventoryItem | null>

export interface NormalizedProfile {
  hairTexture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  concerns: ProfileConcern[]
  goals: Goal[]
  washFrequency: WashFrequency | null
  heatStyling: HeatStyling | null
  stylingTools: StylingTool[] | null
  cuticleCondition: CuticleCondition | null
  proteinMoistureBalance: ProteinMoistureBalance | null
  scalpType: ScalpType | null
  scalpCondition: ScalpCondition | null
  chemicalTreatment: ChemicalTreatment[]
  towelMaterial: TowelMaterial | null
  towelTechnique: TowelTechnique | null
  dryingMethod: DryingMethod | null
  brushType: BrushType | null
  nightProtection: NightProtection[] | null
  usesHeatProtection: boolean
  routineInventory: RoutineInventory
}

export interface DamageAssessment {
  overallLevel: DamageLevel
  structuralLevel: DamageLevel
  heatLevel: DamageLevel
  mechanicalLevel: DamageLevel
  repairPriority: RepairPriority
  balanceDirection: BalanceDirection | null
  bondBuilderPriority: BondBuilderPriority
  activeDamageDrivers: string[]
  activeProtectiveFactors: string[]
  confidence: ConfidenceLevel
  missingInputs: string[]
}

export interface CareNeedAssessment {
  hydrationNeed: DamageLevel
  smoothingNeed: DamageLevel
  detanglingNeed: DamageLevel
  definitionSupportNeed: DamageLevel
  thermalProtectionNeed: DamageLevel
  volumeDirection: "volume" | "less_volume" | "neutral"
}

export interface InterventionStep {
  category: EngineCategoryId | "behavior"
  action: RecommendationAction
  reasonCodes: string[]
}

export interface InterventionPlan {
  steps: InterventionStep[]
  deferredSteps: InterventionStep[]
  notes: string[]
}

export interface CategoryFitEvaluation {
  status: CategoryFitStatus
  reasonCodes: string[]
  missingFields: string[]
}

interface CategoryDecisionBase<
  TCategory extends
    | "conditioner"
    | "mask"
    | "leave_in"
    | "shampoo"
    | "oil"
    | "bondbuilder"
    | "deep_cleansing_shampoo"
    | "dry_shampoo"
    | "peeling",
  TTargetProfile,
> {
  category: TCategory
  relevant: boolean
  action: RecommendationAction | null
  planReasonCodes: string[]
  currentInventory: NormalizedRoutineInventoryItem | null
  targetProfile: TTargetProfile | null
  notes: string[]
}

export interface ConditionerTargetProfile {
  balance: CanonicalBalanceTarget | null
  repairLevel: CanonicalRepairLevel | null
  weight: CanonicalWeight | null
}

export type ConditionerCategoryDecision = CategoryDecisionBase<
  "conditioner",
  ConditionerTargetProfile
>

export interface MaskTargetProfile {
  balance: CanonicalBalanceTarget | null
  repairLevel: CanonicalRepairLevel | null
  weight: CanonicalWeight | null
  needStrength: 0 | 1 | 2 | 3
}

export type MaskCategoryDecision = CategoryDecisionBase<"mask", MaskTargetProfile>

export type LeaveInStylingContext = "air_dry" | "heat_style"
export type LeaveInConditionerRelationship = "replacement_capable" | "booster_only"

export interface LeaveInTargetProfile {
  needBucket: LeaveInCareTarget | null
  stylingContext: LeaveInStylingContext | null
  conditionerRelationship: LeaveInConditionerRelationship | null
  weight: CanonicalWeight | null
  careBenefits: LeaveInCareTarget[]
}

export type LeaveInCategoryDecision = CategoryDecisionBase<"leave_in", LeaveInTargetProfile>

export interface ShampooTargetProfile {
  scalpRoute: CanonicalScalpRoute | null
  shampooBucket: ShampooBucket | null
  secondaryBucket: ShampooBucket | null
  cleansingIntensity: CanonicalCleansingIntensity | null
}

export type ShampooCategoryDecision = CategoryDecisionBase<"shampoo", ShampooTargetProfile>

export type OilPurposeSource = "request" | "missing"

export interface OilTargetProfile {
  purpose: OilPurpose | null
  matcherSubtype: OilSubtype | null
  adjunctScalpSupport: boolean
  purposeSource: OilPurposeSource
}

export interface OilCategoryDecision extends CategoryDecisionBase<"oil", OilTargetProfile> {
  clarificationNeeded: boolean
  noRecommendationReason: OilNoRecommendationReason | null
}

export interface BondbuilderTargetProfile {
  bondRepairIntensity: BondRepairIntensity | null
  applicationMode: BondApplicationMode | null
}

export type BondbuilderCategoryDecision = CategoryDecisionBase<
  "bondbuilder",
  BondbuilderTargetProfile
>

export interface DeepCleansingShampooTargetProfile {
  scalpTypeFocus: ScalpTypeFocus | null
  resetNeedLevel: DamageLevel
}

export type DeepCleansingShampooCategoryDecision = CategoryDecisionBase<
  "deep_cleansing_shampoo",
  DeepCleansingShampooTargetProfile
>

export interface DryShampooTargetProfile {
  scalpTypeFocus: Exclude<ScalpTypeFocus, "dry"> | null
}

export type DryShampooCategoryDecision = CategoryDecisionBase<
  "dry_shampoo",
  DryShampooTargetProfile
>

export interface PeelingTargetProfile {
  scalpTypeFocus: ScalpTypeFocus | null
  peelingType: PeelingType | null
}

export type PeelingCategoryDecision = CategoryDecisionBase<"peeling", PeelingTargetProfile>

export type CategoryDecision =
  | ShampooCategoryDecision
  | ConditionerCategoryDecision
  | MaskCategoryDecision
  | LeaveInCategoryDecision
  | OilCategoryDecision
  | BondbuilderCategoryDecision
  | DeepCleansingShampooCategoryDecision
  | DryShampooCategoryDecision
  | PeelingCategoryDecision

export interface CategoryRecommendationSet {
  shampoo: ShampooCategoryDecision
  conditioner: ConditionerCategoryDecision
  mask: MaskCategoryDecision
  leaveIn: LeaveInCategoryDecision
  oil: OilCategoryDecision
  bondbuilder: BondbuilderCategoryDecision
  deepCleansingShampoo: DeepCleansingShampooCategoryDecision
  dryShampoo: DryShampooCategoryDecision
  peeling: PeelingCategoryDecision
}

export interface EngineTrace {
  damage: DamageAssessment
  missingInputs: string[]
  notes: string[]
}
