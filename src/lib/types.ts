/* ── Re-export shared vocabulary (single source of truth) ── */

import type {
  HairTexture,
  HairThickness,
  HairLength,
  HairDensity,
  ProductFrequency,
  HeatStyling,
  ProfileConcern,
  Goal,
  StylingTool,
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  RoutinePreference,
  RoutineProduct,
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "@/lib/vocabulary"
import type {
  LeaveInApplicationStage,
  LeaveInCareBenefit,
  ProductLeaveInSpecs,
  LeaveInNeedBucket,
  LeaveInRole,
  LeaveInStylingContext,
  LeaveInConditionerRelationship,
  LeaveInFormat,
  LeaveInWeight,
} from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import type {
  ProductConditionerSpecs,
  ConditionerWeight,
  ConditionerRepairLevel,
} from "@/lib/conditioner/constants"
import type { ProductBondbuilderSpecs } from "@/lib/bondbuilder/constants"
import type { ProductDeepCleansingShampooSpecs } from "@/lib/deep-cleansing-shampoo/constants"
import type { ProductDryShampooSpecs } from "@/lib/dry-shampoo/constants"
import type { OilSubtype, OilUseMode } from "@/lib/oil/constants"
import type { ProductPeelingSpecs } from "@/lib/peeling/constants"
import type {
  ProductBondApplicationMode,
  ProductBondProductFormat,
  ProductBondRepairAxis,
  ProductBondRepairIntensity,
  ProductBondTreatmentMode,
  ProductBondUsageProtocol,
  DryShampooFormat,
  DryShampooHairColorFit,
  DryShampooPrimaryEffect,
  DryShampooScalpSensitivityFit,
  ProductPeelingType,
  ProductScalpTypeFocus,
} from "@/lib/product-specs/constants"
import type {
  CareNeedAssessment as RecommendationEngineCareNeedAssessment,
  CareBalanceLegacyComparison as RecommendationEngineCareBalanceLegacyComparison,
  CareBalanceSet as RecommendationEngineCareBalanceSet,
  CategoryDecision as RecommendationEngineCategoryDecision,
  BondbuilderCategoryDecision as RecommendationEngineBondbuilderCategoryDecision,
  ConditionerCategoryDecision as RecommendationEngineConditionerCategoryDecision,
  DamageAssessment as RecommendationEngineDamageAssessment,
  DeepCleansingShampooCategoryDecision as RecommendationEngineDeepCleansingShampooCategoryDecision,
  DryShampooCategoryDecision as RecommendationEngineDryShampooCategoryDecision,
  EffectiveCareContext as RecommendationEngineEffectiveCareContext,
  InterventionPlan as RecommendationEngineInterventionPlan,
  LeaveInCategoryDecision as RecommendationEngineLeaveInCategoryDecision,
  MaskCategoryDecision as RecommendationEngineMaskCategoryDecision,
  OilCategoryDecision as RecommendationEngineOilCategoryDecision,
  PeelingCategoryDecision as RecommendationEnginePeelingCategoryDecision,
  RecommendationRequestContext as RecommendationEngineRequestContext,
  ResetAssessment as RecommendationEngineResetAssessment,
  ResetFocus,
  ResetIntensity,
  ResetLevel,
  ShampooCategoryDecision as RecommendationEngineShampooCategoryDecision,
  ShampooCadenceAssessment as RecommendationEngineShampooCadenceAssessment,
} from "@/lib/recommendation-engine/types"
import type { ShampooBucket, ShampooBucketPair } from "@/lib/shampoo/constants"

export type {
  HairTexture,
  HairThickness,
  HairLength,
  HairDensity,
  ProductFrequency,
  HeatStyling,
  ProfileConcern,
  Goal,
  StylingTool,
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  RoutinePreference,
  RoutineProduct,
  ShampooBucket,
  ShampooBucketPair,
}

export {
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_DENSITY_OPTIONS,
  PROFILE_CONCERN_OPTIONS,
  GOAL_OPTIONS,
  PRODUCT_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  PROFILE_CONCERN_LABELS,
  GOAL_LABELS,
  STYLING_TOOL_LABELS,
  CUTICLE_CONDITION_LABELS,
  PROTEIN_MOISTURE_LABELS,
  HAIR_DENSITY_LABELS,
  SCALP_TYPE_LABELS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENT_LABELS,
  DESIRED_VOLUME_LABELS,
  DESIRED_VOLUME_OPTIONS,
  ROUTINE_PREFERENCE_OPTIONS,
  ROUTINE_PRODUCT_OPTIONS,
} from "@/lib/vocabulary"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  onboarding_completed: boolean
  onboarding_step: string
  has_seen_completion_popup: boolean
  locale: string
  subscription_tier_id: string | null
  message_count_this_month: number
  message_count_reset_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: "active" | "past_due" | "canceled" | "incomplete" | null
  subscription_interval: "month" | "quarter" | "year" | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface HairProfile {
  id: string
  user_id: string
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  hair_length: HairLength | null
  density: HairDensity | null
  concerns: ProfileConcern[]
  products_used: string | null
  shampoo_frequency: ProductFrequency | null
  heat_styling: HeatStyling | null
  styling_tools: StylingTool[] | null
  goals: Goal[]
  cuticle_condition: CuticleCondition | null
  protein_moisture_balance: ProteinMoistureBalance | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
  chemical_treatment: ChemicalTreatment[]
  desired_volume: DesiredVolume | null
  routine_preference: RoutinePreference | null
  current_routine_products: RoutineProduct[] | null
  towel_material: TowelMaterial | null
  towel_technique: TowelTechnique | null
  drying_method: DryingMethod | null
  brush_type: BrushType | null
  night_protection: NightProtection[] | null
  uses_heat_protection: boolean
  additional_notes: string | null
  conversation_memory: string | null
  created_at: string
  updated_at: string
}

export type UserMemoryKind =
  | "preference"
  | "routine"
  | "product_experience"
  | "hair_history"
  | "progress"
  | "sensitivity"
  | "medical_context"
  | "legacy_summary"
  | "other"

export type UserMemorySource = "chat" | "manual" | "legacy"
export type UserMemoryStatus = "active" | "archived"

export interface UserMemorySettings {
  user_id: string
  memory_enabled: boolean
  created_at: string
  updated_at: string
}

export interface UserMemoryEntry {
  id: string
  user_id: string
  kind: UserMemoryKind
  content: string
  normalized_key: string
  source: UserMemorySource
  source_conversation_id: string | null
  evidence: string | null
  confidence: number | null
  metadata: Record<string, unknown>
  status: UserMemoryStatus
  superseded_by: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
}

export const PRODUCT_LIFECYCLE_STATUSES = ["active", "discontinued"] as const

export type ProductLifecycleStatus = (typeof PRODUCT_LIFECYCLE_STATUSES)[number]

export const PRODUCT_RELATIONSHIP_TYPES = ["replaced_by", "add_on_for"] as const

export type ProductRelationshipType = (typeof PRODUCT_RELATIONSHIP_TYPES)[number]

export interface ProductRelationship {
  id: string
  source_product_id: string
  target_product_id: string
  relationship_type: ProductRelationshipType
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  brand: string | null
  description: string | null
  short_description: string | null

  category: string | null
  affiliate_link: string | null
  purchase_link_status?: "available" | "unavailable" | null
  purchase_link_checked_at?: string | null
  price_checked_at?: string | null
  image_url: string | null
  price_eur: number | null
  currency: string
  tags: string[]
  suitable_thicknesses: string[]
  suitable_concerns: string[]
  shampoo_bucket_pairs?: ShampooBucketPair[] | null
  is_active: boolean
  lifecycle_status?: ProductLifecycleStatus | null
  is_chaarlie_recommended?: boolean | null
  sort_order: number
  conditioner_specs?: ProductConditionerSpecs | null
  leave_in_specs?: ProductLeaveInSpecs | null
  mask_specs?: ProductMaskSpecs | null
  bondbuilder_specs?: ProductBondbuilderSpecs | null
  deep_cleansing_shampoo_specs?: ProductDeepCleansingShampooSpecs | null
  dry_shampoo_specs?: ProductDryShampooSpecs | null
  peeling_specs?: ProductPeelingSpecs | null
  recommendation_meta?: RecommendationMetadata | null
  created_at: string
  updated_at: string
}

export type ProductSummary = Pick<
  Product,
  | "id"
  | "name"
  | "brand"
  | "description"
  | "short_description"
  | "category"
  | "affiliate_link"
  | "purchase_link_status"
  | "purchase_link_checked_at"
  | "price_checked_at"
  | "image_url"
  | "price_eur"
  | "currency"
  | "tags"
  | "suitable_thicknesses"
  | "suitable_concerns"
  | "is_active"
  | "lifecycle_status"
  | "sort_order"
  | "created_at"
  | "updated_at"
>

export type CanonicalProductCategoryKey =
  | "shampoo"
  | "conditioner"
  | "mask"
  | "leave_in"
  | "oil"
  | "dry_shampoo"
  | "deep_cleansing_shampoo"
  | "bondbuilder"
  | "heat_protectant"
  | "serum"
  | "scrub"
  | "peeling"
  | "styling_gel"
  | "styling_mousse"
  | "styling_cream"
  | "hairspray"

export type ProductIntakeCategoryKey =
  | "shampoo"
  | "conditioner"
  | "mask"
  | "leave_in"
  | "oil"
  | "dry_shampoo"
  | "deep_cleansing_shampoo"
  | "bondbuilder"

export type ProductIntakeMethod = "manual" | "photo"
export type ProductUsageSource = "onboarding" | "chat" | "profile" | "script"
export type ProductSubmissionSource = Extract<ProductUsageSource, "onboarding" | "chat">
export type ProductUsageMatchStatus = "text_only" | "matched" | "pending_review" | "needs_more_info"

export type ProductSubmissionStatus =
  | "pending_review"
  | "researching"
  | "ready_for_review"
  | "needs_more_info"
  | "matched_existing"
  | "approved"
  | "rejected"
  | "cancelled_by_user"

export type ProductFrontImageValidationStatus =
  | "valid_product_front"
  | "uncertain"
  | "not_a_product_photo"
  | "unsafe_or_inappropriate"

export type ProductBarcodeImageValidationStatus =
  | "valid_barcode"
  | "uncertain"
  | "not_a_product_photo"
  | "unsafe_or_inappropriate"

export interface UserProductUsage {
  id: string
  user_id: string
  category: CanonicalProductCategoryKey
  product_name: string | null
  frequency_range: ProductFrequency | null
  brand_text: string | null
  product_id: string | null
  product_submission_id: string | null
  match_status: ProductUsageMatchStatus
  intake_method: ProductIntakeMethod | null
  source: ProductUsageSource | null
  front_image_path: string | null
  created_at: string
  updated_at: string
}

export interface ProductSubmission {
  id: string
  user_id: string
  user_product_usage_id: string | null
  source: ProductSubmissionSource
  source_conversation_id: string | null
  intake_method: ProductIntakeMethod
  category: ProductIntakeCategoryKey
  brand_text: string | null
  product_name_text: string | null
  frequency_range: ProductFrequency
  front_image_path: string | null
  barcode_image_path: string | null
  front_image_validation_status: ProductFrontImageValidationStatus | null
  front_image_validation_metadata: Record<string, unknown>
  barcode_image_validation_status: ProductBarcodeImageValidationStatus | null
  barcode_image_validation_metadata: Record<string, unknown>
  previous_product_id: string | null
  previous_product_snapshot: Record<string, unknown>
  status: ProductSubmissionStatus
  researched_payload: Record<string, unknown>
  intake_history: Array<Record<string, unknown>>
  approved_product_id: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  review_notes: string | null
  user_facing_resolution_reason: string | null
  user_facing_next_step: string | null
  user_facing_missing_fields: string[]
  notification_sent_at: string | null
  cleanup_after: string | null
  photos_deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface BaseRecommendationMetadata {
  category:
    | "shampoo"
    | "conditioner"
    | "leave_in"
    | "mask"
    | "oil"
    | "bondbuilder"
    | "deep_cleansing_shampoo"
    | "dry_shampoo"
    | "peeling"
  score: number
  top_reasons: string[]
  tradeoffs: string[]
  usage_hint: string
}

export interface ShampooMatchedProfile {
  thickness: HairThickness | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
}

export type ShampooProfileField = "thickness" | "scalp_type" | "scalp_condition"

export interface ShampooRecommendationMetadata extends BaseRecommendationMetadata {
  category: "shampoo"
  matched_profile: ShampooMatchedProfile
  matched_bucket: ShampooBucket | null
  matched_concern_code: string | null
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
  matched_scalp_route?: "oily" | "balanced" | "dry" | "dandruff" | "dry_flakes" | "irritated" | null
  cleansing_intensity?: "gentle" | "regular" | "clarifying" | null
}

export interface ConditionerMatchedProfile {
  thickness: HairThickness | null
  density: HairDensity | null
  protein_moisture_balance: ProteinMoistureBalance | null
  cuticle_condition: CuticleCondition | null
  chemical_treatment: ChemicalTreatment[]
}

export type ConditionerProfileField = "thickness" | "protein_moisture_balance"
export type ConditionerBalanceNeed = "moisture" | "balanced" | "protein"

export interface ConditionerRecommendationMetadata extends BaseRecommendationMetadata {
  category: "conditioner"
  matched_profile: ConditionerMatchedProfile
  matched_weight: ConditionerWeight | null
  matched_repair_level: ConditionerRepairLevel | null
  matched_balance_need: ConditionerBalanceNeed | null
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
  product_weight?: ConditionerWeight | null
  product_repair_level?: ConditionerRepairLevel | null
  product_balance_direction?: ConditionerBalanceNeed | null
  active_damage_drivers?: string[]
}

export interface LeaveInMatchedProfile {
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  cuticle_condition: CuticleCondition | null
  chemical_treatment: ChemicalTreatment[]
}

export type LeaveInProfileField =
  | "hair_texture"
  | "thickness"
  | "density"
  | "care_signal"
  | "styling_signal"

export interface LeaveInRecommendationMetadata extends BaseRecommendationMetadata {
  category: "leave_in"
  matched_profile: LeaveInMatchedProfile
  need_bucket: LeaveInNeedBucket | null
  styling_context: LeaveInStylingContext | null
  conditioner_relationship: LeaveInConditionerRelationship | null
  matched_weight: LeaveInWeight | null
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
  product_format?: LeaveInFormat | null
  product_weight?: LeaveInWeight | null
  product_roles?: LeaveInRole[]
  product_care_benefits?: LeaveInCareBenefit[]
  provides_heat_protection?: boolean | null
  product_application_stage?: LeaveInApplicationStage[]
  heat_protection_need?: "none" | "moderate" | "high"
  styling_prep_need?: "none" | "definition" | "smooth_control" | "heat_style"
  product_balance_direction?: "moisture" | "balanced" | "protein" | null
}

export interface OilMatchedProfile {
  thickness: HairThickness | null
}

export interface OilRecommendationMetadata extends BaseRecommendationMetadata {
  category: "oil"
  matched_profile: OilMatchedProfile
  matched_subtype: OilSubtype | null
  use_mode: OilUseMode | null
  adjunct_scalp_support: boolean
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
  purpose_fit?: "exact" | "bridge" | "unknown"
  scalp_caution?: boolean
  density_weight_caution?: boolean
  overload_caution?: boolean
}

export type MaskType = "protein" | "moisture" | "performance"
export type MaskNeedStrength = 1 | 2 | 3
export type MaskSignal =
  | "chemical_treatment"
  | "heat_styling"
  | "protein_moisture_balance"
  | "mechanical_stress"

export interface MaskRecommendationMetadata extends BaseRecommendationMetadata {
  category: "mask"
  mask_type: MaskType
  need_strength: MaskNeedStrength
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
  role?: "fixed" | "optional"
  product_weight?: ProductMaskSpecs["weight"] | null
  product_concentration?: ProductMaskSpecs["concentration"] | null
  product_balance_direction?: ProductMaskSpecs["balance_direction"] | null
}

export interface BondbuilderRecommendationMetadata extends BaseRecommendationMetadata {
  category: "bondbuilder"
  matched_intensity: ProductBondRepairIntensity | null
  application_mode: ProductBondApplicationMode | null
  bond_repair_axis?: ProductBondRepairAxis | null
  treatment_mode?: ProductBondTreatmentMode | null
  product_format?: ProductBondProductFormat | null
  usage_protocol?: ProductBondUsageProtocol | null
  lifecycle_status?: ProductLifecycleStatus | null
  replacement_target?: {
    product_id: string
    name?: string | null
  } | null
  attached_add_ons?: Array<{
    relationship_type: "add_on_for"
    product_id: string
    name: string
    usage_protocol: ProductBondUsageProtocol | null
    reason: string
  }>
}

export interface DeepCleansingShampooRecommendationMetadata extends BaseRecommendationMetadata {
  category: "deep_cleansing_shampoo"
  scalp_type_focus: ProductScalpTypeFocus | null
  reset_need_level: ResetLevel
  reset_focus?: ResetFocus | null
  reset_intensity?: ResetIntensity | null
  color_treated_suitability?: ProductDeepCleansingShampooSpecs["color_treated_suitability"] | null
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
  caution_flags?: string[]
}

export interface DryShampooRecommendationMetadata extends BaseRecommendationMetadata {
  category: "dry_shampoo"
  primary_effect: DryShampooPrimaryEffect | null
  hair_color_fit: DryShampooHairColorFit | null
  scalp_sensitivity_fit: DryShampooScalpSensitivityFit | null
  format: DryShampooFormat | null
  fit_status?: "ideal" | "supportive" | "mismatch" | "unknown" | "not_applicable"
}

export interface PeelingRecommendationMetadata extends BaseRecommendationMetadata {
  category: "peeling"
  scalp_type_focus: ProductScalpTypeFocus | null
  peeling_type: ProductPeelingType | null
}

export type RecommendationMetadata =
  | ShampooRecommendationMetadata
  | ConditionerRecommendationMetadata
  | LeaveInRecommendationMetadata
  | OilRecommendationMetadata
  | MaskRecommendationMetadata
  | BondbuilderRecommendationMetadata
  | DeepCleansingShampooRecommendationMetadata
  | DryShampooRecommendationMetadata
  | PeelingRecommendationMetadata

export interface ShampooDecision {
  category: "shampoo"
  eligible: boolean
  missing_profile_fields: ShampooProfileField[]
  matched_profile: ShampooMatchedProfile
  matched_bucket: ShampooBucket | null
  /** Secondary bucket for dandruff rotation (scalp-type-based gentle shampoo) */
  secondary_bucket: ShampooBucket | null
  matched_concern_code: string | null
  retrieval_filter: {
    thickness: HairThickness | null
    concern: string | null
  }
  candidate_count: number
  no_catalog_match: boolean
}

export interface ConditionerDecision {
  category: "conditioner"
  eligible: boolean
  missing_profile_fields: ConditionerProfileField[]
  matched_profile: ConditionerMatchedProfile
  matched_concern_code: string | null
  matched_weight: ConditionerWeight | null
  matched_repair_level: ConditionerRepairLevel | null
  matched_balance_need: ConditionerBalanceNeed | null
  candidate_count: number
  no_catalog_match: boolean
  used_density: boolean
}

export interface LeaveInDecision {
  category: "leave_in"
  eligible: boolean
  missing_profile_fields: LeaveInProfileField[]
  matched_profile: LeaveInMatchedProfile
  need_bucket: LeaveInNeedBucket | null
  styling_context: LeaveInStylingContext | null
  conditioner_relationship: LeaveInConditionerRelationship | null
  matched_weight: LeaveInWeight | null
  candidate_count: number
  no_catalog_match: boolean
}

export type CategoryDecision = ShampooDecision | ConditionerDecision | LeaveInDecision

export type ChatCategoryDecision = CategoryDecision | RecommendationEngineCategoryDecision

export interface RecommendationEngineTrace {
  request_context: RecommendationEngineRequestContext
  effective_context: RecommendationEngineEffectiveCareContext
  damage: RecommendationEngineDamageAssessment
  care_needs: RecommendationEngineCareNeedAssessment
  reset: RecommendationEngineResetAssessment
  shampoo_cadence_assessment: RecommendationEngineShampooCadenceAssessment | null
  intervention_plan: RecommendationEngineInterventionPlan
  care_balance: RecommendationEngineCareBalanceSet
  legacy_plan_comparison: RecommendationEngineCareBalanceLegacyComparison | null
  categories: {
    shampoo: RecommendationEngineShampooCategoryDecision
    conditioner: RecommendationEngineConditionerCategoryDecision
    mask: RecommendationEngineMaskCategoryDecision
    leave_in: RecommendationEngineLeaveInCategoryDecision
    oil: RecommendationEngineOilCategoryDecision
    bondbuilder: RecommendationEngineBondbuilderCategoryDecision
    deep_cleansing_shampoo: RecommendationEngineDeepCleansingShampooCategoryDecision
    dry_shampoo: RecommendationEngineDryShampooCategoryDecision
    peeling: RecommendationEnginePeelingCategoryDecision
  }
  unsupported_routine_categories: string[]
}

export interface MaskDecision {
  needs_mask: boolean
  need_strength: 0 | MaskNeedStrength
  mask_type: MaskType | null
  active_signals: MaskSignal[]
  signal_weights?: Record<MaskSignal, number>
}

export type RoutineTopicId =
  | "routine_glatt"
  | "routine_locken"
  | "locken_wellen"
  | "tiefenreinigung"
  | "hair_oiling"
  | "bond_builder"
  | "brush_tools"
  | "lockenrefresh"
  | "cwc"
  | "owc"

export type RoutineFocusKind = "goal" | "concern" | "topic" | "pattern" | "scalp"
export type RoutineSlotAction = "keep" | "adjust" | "add" | "upgrade" | "avoid"
export type RoutinePlanPhase = "base_wash" | "maintenance" | "occasional"
export type RoutineSlotKind = "product_slot" | "instruction"
export type RoutineProductCategory = Exclude<ProductCategory, "routine" | null>
export type RoutinePriorityLeverSource = "care_risk" | "stated_goal" | "inferred_need"
export type RoutineLayer = "basics" | "goals" | "problems" | "deep_dive"

export interface RoutineFocus {
  kind: RoutineFocusKind
  code: string
  label: string
}

export interface RoutineContext {
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  shampoo_frequency: ProductFrequency | null
  heat_styling: HeatStyling | null
  styling_tools: StylingTool[] | null
  drying_method: DryingMethod | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
  cuticle_condition: CuticleCondition | null
  protein_moisture_balance: ProteinMoistureBalance | null
  concerns: ProfileConcern[]
  goals: Goal[]
  chemical_treatment: ChemicalTreatment[]
  current_routine_products: RoutineProduct[]
  products_used: string | null
  explicit_topic_ids: RoutineTopicId[]
  primary_focuses: RoutineFocus[]
  organizer_complete: boolean
  cadence_complete: boolean
  inventory_complete: boolean
  has_between_wash_days: boolean
  has_buildup_signals: boolean
  has_scalp_clarify_signals: boolean
  has_hair_reset_signals: boolean
  has_hard_reset_signals: boolean
  has_sensitive_scalp_signals: boolean
  has_dryness_damage_signals: boolean
  has_damage_signals: boolean
  has_bond_builder_signals: boolean
  has_oil_weight_risk: boolean
  has_wash_protection_need: boolean
  uses_heat_protection: boolean
}

export interface RoutineTopicActivation {
  id: RoutineTopicId
  label: string
  reason: string
  priority: number
  instruction_only: boolean
}

export interface RoutineSlotAdvice {
  id: string
  kind: RoutineSlotKind
  phase: RoutinePlanPhase
  label: string
  action: RoutineSlotAction
  category: RoutineProductCategory | null
  cadence: string | null
  rationale: string[]
  caveats: string[]
  topic_ids: RoutineTopicId[]
  product_linkable: boolean
  product_query: string | null
  attachment_priority: number
  attached_products?: Product[]
}

export interface RoutinePriorityLever {
  id:
    | "reset-blockage"
    | "care-product-first"
    | "mechanical-guardrail"
    | "exposure-protection"
    | "scalp-safety"
    | "dryness-frizz-control"
    | "stated-goal"
    | "inferred-need"
  source: RoutinePriorityLeverSource
  slot_id: string
  label: string
  reason: string
  score: number
  topic_ids: RoutineTopicId[]
  supporting_slot_ids: string[]
}

export interface RoutineLayerProjection {
  layer: RoutineLayer
  visible_slot_ids: string[]
  priority_lever: RoutinePriorityLever | null
  requested_category: RoutineProductCategory | null
  requested_topic_id: RoutineTopicId | null
}

export interface RoutinePlanSection {
  phase: RoutinePlanPhase
  title: string
  summary: string
  slots: RoutineSlotAdvice[]
}

export interface RoutineDecisionContext {
  shampoo: RecommendationEngineShampooCategoryDecision
  conditioner: RecommendationEngineConditionerCategoryDecision
  leave_in: RecommendationEngineLeaveInCategoryDecision
  mask: RecommendationEngineMaskCategoryDecision
}

export interface RoutinePlan {
  base_topic_id: RoutineTopicId | null
  primary_focuses: RoutineFocus[]
  active_topics: RoutineTopicActivation[]
  compare_cwc_owc: boolean
  sections: RoutinePlanSection[]
  priority_lever?: RoutinePriorityLever | null
  layer_projections?: Record<RoutineLayer, RoutineLayerProjection>
  decision_context: RoutineDecisionContext
}

export interface MessageRagContext {
  sources: CitationSource[]
  category_decision?: ChatCategoryDecision | null
  engine_trace?: RecommendationEngineTrace | null
  response_mode?: ResponseMode | null
  product_intake_offer?: ProductIntakeOffer | null
  product_intake_review?: {
    submission_id: string
    status: string
    approved_product_id: string | null
    category?: ProductIntakeCategoryKey | null
    brand_text?: string | null
    product_name_text?: string | null
  } | null
  product_lookup_clarification?: ProductLookupClarification | null
  product_lookup_selection?: ProductLookupSelectionContext | null
}

export type MessageDecisionContext = MessageRagContext

export interface ProductLookupClarification {
  id: string
  kind: "variant_selection" | "category_mismatch"
  source: "chat"
  original_user_message?: string | null
  query: {
    brand_text: string | null
    product_name_text: string | null
    category: ProductIntakeCategoryKey | null
  }
  copy: {
    prompt_de: string
  }
  candidates: ProductLookupClarificationCandidate[]
  none_action: {
    label_de: string
    product_intake_offer: ProductIntakeOffer
  }
}

export interface ProductLookupClarificationCandidate {
  product_id: string
  name: string
  category: ProductIntakeCategoryKey | string | null
  category_label_de: string
  reason: "same_brand_same_category" | "category_mismatch"
}

export interface ProductLookupSelectionContext {
  source: "product_lookup_clarification"
  clarification_id: string
  source_assistant_message_id: string
  selected_product_id: string
  selected_product_name: string
}

export interface ProductIntakeOffer {
  id: string
  source: "chat"
  reason: "product_lookup_not_found" | "needs_more_info"
  category?: ProductIntakeCategoryKey | null
  frequency_range?: ProductFrequency | null
  intake_method?: ProductIntakeMethod | null
  submission_id?: string
  submitted_status?: "pending_review" | "matched" | null
  existing_usage_id?: string | null
  committed_front_image_path?: string | null
  committed_barcode_image_path?: string | null
  missing_fields?: string[]
  extracted_identity?: {
    brand_text?: string
    product_name_text?: string
  }
}

export interface ChatPromptMessageSnapshot {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LangfusePromptReference {
  name: string
  version: number | null
  label: string
  is_fallback: boolean
}

export type ChatPromptKind =
  | "legacy_synth_prompt"
  | "response_plan_render"
  | "agent_final_render"
  | "agentic_tool_loop"
  | "agent_v2_responses"
export type ResponseCompositionPath =
  | "legacy_synthesizer"
  | "response_plan"
  | "agent_final_render"
  | "agentic_tool_loop"
  | "agent_v2_responses"
export type TraceFailureBucket =
  | "product_fit_mismatch"
  | "routine_logic_mismatch"
  | "missing_clarification"
  | "unnecessary_clarification"
  | "retrieval_grounding_gap"
  | "response_wording_gap"
  | "overclaim_or_missing_caveat"
  | "memory_or_profile_miss"
  | "technical_or_trace_gap"
  | "positive_reference"

export interface ResponseCompositionTrace {
  path: ResponseCompositionPath
  migration_mode: "legacy_only" | "planner_preferred" | "tool_loop" | "agent_v2_care_balance"
  fallback_reason: string | null
  rendering_path: string | null
  plan_type: string | null
  attachment_mode: "text_only" | "cards" | null
}

export interface ChatPromptSnapshot {
  kind: ChatPromptKind
  model: string
  temperature: number
  prompt_ref: LangfusePromptReference
  system_prompt: string
  messages: ChatPromptMessageSnapshot[]
}

export interface ChatRetrievedChunkTrace {
  chunk_id: string
  source_type: string
  source_name: string | null
  retrieval_path?: "dense" | "lexical" | "hybrid"
  weighted_similarity: number
  similarity: number
  dense_score?: number
  lexical_score?: number
  fused_score?: number
  content_preview: string
}

export interface ChatMatchedProductTrace {
  id: string
  name: string
  brand: string | null
  category: string | null
  score: number | null
  top_reasons: string[]
  tradeoffs: string[]
  usage_hint: string | null
  recommendation_meta: RecommendationMetadata | null
}

export interface ChatTraceLatencyBreakdown {
  classification_ms: number
  hair_profile_load_ms: number
  routine_inventory_load_ms?: number
  memory_load_ms: number
  routine_planning_ms: number
  history_load_ms: number
  router_ms: number
  conversation_create_ms: number
  retrieval_ms: number
  product_matching_ms: number
  prompt_build_ms: number
  stream_setup_ms: number
  agent_runtime_ms?: number
  agent_turn_gate_ms?: number | null
  agent_model_ms?: number | null
  agent_tool_ms?: number | null
  stream_read_ms?: number
  total_ms?: number
}

export type ChatAgentEngine = "classic" | "tool_loop" | "agent_v2_care_balance"

export type AgenticTerminalTopic =
  | "routine"
  | "shampoo"
  | "conditioner"
  | "leave_in"
  | "mask"
  | "oil"
  | "bondbuilder"
  | "deep_cleansing_shampoo"
  | "dry_shampoo"
  | "peeling"
  | null

export type AgenticTerminalProductCategory = Exclude<AgenticTerminalTopic, "routine">

export type AgenticTerminalRoutineLayer = RoutineConversationLayer

export type AgenticTopicRelation =
  | "same_topic"
  | "category_switch"
  | "refinement"
  | "recap"
  | "unclear"

export interface AgenticTerminalStatePatch {
  active_topic: AgenticTerminalTopic
  routine_layer: AgenticTerminalRoutineLayer
  last_product_category: AgenticTerminalProductCategory
  last_assistant_action: string
  topic_relation: AgenticTopicRelation
  reason: string
}

export interface AgenticTerminalAnswer {
  answer: string
  state_patch: AgenticTerminalStatePatch
}

export interface AgenticToolLoopModelStepTrace {
  step_index: number
  type: "tool_calls" | "message"
  finish_reason: string | null
  status?: string | null
  tool_call_names: string[]
}

export interface AgenticToolLoopToolCallTrace {
  id: string | null
  name: string
  status: "executed" | "blocked" | "failed"
  latency_ms?: number | null
  input_summary?: string | null
  output_summary?: string | null
}

export interface AgenticToolLoopBlockedToolCallTrace {
  id: string | null
  name: string
  reason: string
}

export interface AgenticToolLoopTokenUsageTrace {
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
}

export type AgenticAnswerCompositionModeTrace = "inline_context" | "composer_context" | "baseline"

export type AgenticToolLoopFailureStageTrace =
  | "missing_terminal_answer"
  | "multiple_terminal_answers"
  | "terminal_with_other_tool_calls"
  | "max_executable_tool_calls"
  | "max_model_steps"
  | "repair_failed"
  | null

export interface AgenticToolLoopTrace {
  engine_variant: "tool_loop"
  answer_composition_mode: AgenticAnswerCompositionModeTrace
  loaded_guidance_ids: string[]
  answer_context_capsule_ids: string[]
  consultation_brief_summary: Record<string, unknown> | null
  repair_attempts: Array<{
    reason: Exclude<AgenticToolLoopFailureStageTrace, null>
    instruction_label: string
  }>
  failure_stage: AgenticToolLoopFailureStageTrace
  visible_failure: boolean
  model_steps: AgenticToolLoopModelStepTrace[]
  tool_calls: AgenticToolLoopToolCallTrace[]
  blocked_tool_calls: AgenticToolLoopBlockedToolCallTrace[]
  guardrails: string[]
  latency_ms?: number | null
  token_usage?: AgenticToolLoopTokenUsageTrace | null
}

export interface ChatTurnTrace {
  trace_version: number
  request_id: string
  started_at: string
  completed_at: string
  status: "completed" | "failed"
  engine_variant?: ChatAgentEngine
  user_message: string
  conversation_id: string | null
  intent: IntentType
  product_category: ProductCategory
  conversation_history_count: number
  classification: ClassificationResult
  router_decision: RouterDecision
  conversation_state: ConversationTurnStateTransition
  conversation_state_persistence: ConversationStatePersistenceTrace
  clarification_questions: string[]
  hair_profile_snapshot: HairProfile | null
  memory_context: string | null
  retrieval: {
    requested_count: number
    source_types: string[] | null
    metadata_filter: Record<string, string> | null
    subqueries: string[]
    candidate_count_before_rerank: number
    reranked_count: number
    fallback_used: boolean
    final_context_count: number
    chunks: ChatRetrievedChunkTrace[]
  }
  decision_context: {
    should_plan_routine: boolean
    routine_plan: RoutinePlan | null
    category_decision: ChatCategoryDecision | null
    engine_trace: RecommendationEngineTrace | null
    matched_products: ChatMatchedProductTrace[]
  }
  prompt_refs: {
    classification: LangfusePromptReference
    synthesis: LangfusePromptReference
  }
  prompt: ChatPromptSnapshot
  response_composition: ResponseCompositionTrace
  agentic_tool_loop?: AgenticToolLoopTrace
  agent_v2_trace?: import("@/lib/agent-v2/contracts").AgentV2Trace
  response: {
    assistant_content: string
    sources: CitationSource[]
    product_count: number
  }
  latencies_ms: ChatTraceLatencyBreakdown
  error: string | null
}

export type ConversationProductTopic = Exclude<ProductCategory, "routine" | null>
export type ConversationStateTopic = "routine" | ConversationProductTopic | null

export type RoutineConversationLayer = "basics" | "goals" | "problems" | "deep_dive" | null

export type ConversationPendingOffer =
  | "routine_goals_or_problems"
  | "routine_other_layer"
  | "routine_deep_dive"
  | null

export interface ConversationState {
  version: 1
  active_topic: ConversationStateTopic
  routine_layer: RoutineConversationLayer
  pending_offer: ConversationPendingOffer
  answered_slots: string[]
  last_assistant_action: string | null
  last_product_category: ConversationStateTopic
  agent_v2_routine_thread_context?:
    | import("@/lib/agent-v2/contracts").AgentV2RoutineThreadContext
    | null
  agent_v2_prior_selected_product_projections?: Array<
    Partial<
      import("@/lib/agent-v2/tools/select-products-projection").AgentV2SelectProductsProjection
    >
  >
  agent_v2_session_memory?: import("@/lib/agent-v2/contracts").AgentV2SessionMemoryWrite[]
}

export interface ConversationStateTransition {
  previous_state: ConversationState
  next_state: ConversationState
  reason: string
  changed_fields: string[]
  classifier_override: string | null
  updated_by_engine?: ChatAgentEngine
}

export type AgentV2ConversationStateV2 =
  import("@/lib/agent-v2/production/persisted-session-state").AgentV2ConversationStateV2

export type AgentV2ConversationStateTransition =
  import("@/lib/agent-v2/production/persisted-session-state").AgentV2ConversationStateTransition

export type ConversationTurnStateTransition =
  | ConversationStateTransition
  | AgentV2ConversationStateTransition

export interface ConversationStatePersistenceTrace {
  status: "persisted" | "failed" | "skipped"
  error: string | null
}

export interface ConversationTurnTrace {
  id: string
  conversation_id: string | null
  user_id: string
  user_message_id: string | null
  assistant_message_id: string | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  status: "completed" | "failed"
  trace: ChatTurnTrace
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  is_active: boolean
  message_count: number
  memory_extracted_at_count: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system"
  content: string | null
  product_recommendations: Product[] | null
  rag_context: MessageRagContext | null
  token_usage: Record<string, number> | null
  langfuse_trace_id: string | null
  langfuse_trace_url: string | null
  user_feedback_score: -1 | 1 | null
  user_feedback_at: string | null
  created_at: string
}

export interface DailyQuote {
  id: string
  quote_text: string
  author: string | null
  display_date: string | null
  is_active: boolean
  created_at: string
}

export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  cover_image_url: string | null
  category: string | null
  tags: string[]
  is_published: boolean
  published_at: string | null
  author_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentChunk {
  id: string
  source_type: string
  source_name: string | null
  chunk_index: number | null
  content: string
  token_count: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface CitationSource {
  index: number // 1-based, matches [1] markers
  source_type: string // "book", "product_list", etc.
  label: string // German: "Fachbuch", "Produktmatrix"
  source_name: string | null
  snippet: string // First ~200 chars of chunk content
}

export type IntentType =
  | "product_recommendation"
  | "hair_care_advice"
  | "diagnosis"
  | "routine_help"
  | "ingredient_question"
  | "general_chat"
  | "followup"

export type ProductCategory =
  | "shampoo"
  | "conditioner"
  | "mask"
  | "oil"
  | "leave_in"
  | "bondbuilder"
  | "deep_cleansing_shampoo"
  | "dry_shampoo"
  | "peeling"
  | "routine"
  | null

export type RetrievalMode =
  | "faq"
  | "hybrid"
  | "hybrid_plus_graph"
  | "product_sql_plus_hybrid"
  | "agent_engine"
  | "agentic_tool_loop"
  | "agent_v2_responses"

export type ResponseMode = "clarify_only" | "recommend_and_refine" | "answer_direct"

export interface ClassificationResult {
  intent: IntentType
  product_category: ProductCategory
  /** Query complexity level */
  complexity: "simple" | "multi_constraint" | "multi_hop"
  /** LLM suggestion: whether clarification is needed (policy may override) */
  needs_clarification: boolean
  /** LLM suggestion: retrieval path (policy may override) */
  retrieval_mode: RetrievalMode
  /** Normalized filter values extracted from query */
  normalized_filters: Record<string, string | string[] | null>
  /** Router confidence score (0-1) */
  router_confidence: number
}

export interface RouterDecision {
  retrieval_mode: RetrievalMode
  response_mode: ResponseMode
  clarification_reason?: string
  slot_completeness: number // 0–1
  confidence: number
  policy_overrides: string[] // e.g. ["low_confidence", "missing_slots"]
}

export interface ChatSSEEvent {
  type:
    | "conversation_id"
    | "content_delta"
    | "product_recommendations"
    | "product_intake_offer"
    | "product_lookup_clarification"
    | "product_lookup_selection"
    | "assistant_message"
    | "langfuse_trace"
    | "sources"
    | "confidence"
    | "retrieval_debug"
    | "done"
    | "error"
  data: unknown
}

/** Enriched citation source with optional hybrid retrieval metadata */
export interface EnrichedCitationSource extends CitationSource {
  confidence?: number
  retrieval_path?: "dense" | "lexical" | "hybrid"
}
