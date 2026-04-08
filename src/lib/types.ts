/* ── Re-export shared vocabulary (single source of truth) ── */

import type {
  HairTexture,
  HairThickness,
  HairDensity,
  WashFrequency,
  HeatStyling,
  Concern,
  Goal,
  StylingTool,
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  PostWashAction,
  RoutinePreference,
  RoutineProduct,
  MechanicalStressFactor,
  TowelMaterial,
  TowelTechnique,
  DryingMethod,
  BrushType,
  NightProtection,
} from "@/lib/vocabulary"
import type {
  ProductLeaveInSpecs,
  LeaveInNeedBucket,
  LeaveInStylingContext,
  LeaveInConditionerRelationship,
  LeaveInWeight,
} from "@/lib/leave-in/constants"
import type { ProductMaskSpecs } from "@/lib/mask/constants"
import type {
  ProductConditionerSpecs,
  ConditionerWeight,
  ConditionerRepairLevel,
} from "@/lib/conditioner/constants"
import type {
  OilNoRecommendationReason,
  OilSubtype,
  OilUseMode,
} from "@/lib/oil/constants"
import type { ShampooBucket, ShampooBucketPair } from "@/lib/shampoo/constants"

export type {
  HairTexture,
  HairThickness,
  HairDensity,
  WashFrequency,
  HeatStyling,
  Concern,
  Goal,
  StylingTool,
  CuticleCondition,
  ProteinMoistureBalance,
  ScalpType,
  ScalpCondition,
  ChemicalTreatment,
  DesiredVolume,
  PostWashAction,
  RoutinePreference,
  RoutineProduct,
  ShampooBucket,
  ShampooBucketPair,
}

export {
  HAIR_TEXTURE_OPTIONS,
  HAIR_THICKNESS_OPTIONS,
  HAIR_DENSITY_OPTIONS,
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  CONCERN_LABELS,
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
  POST_WASH_ACTION_OPTIONS,
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
  created_at: string
  updated_at: string
}

export interface HairProfile {
  id: string
  user_id: string
  hair_texture: HairTexture | null
  thickness: HairThickness | null
  density: HairDensity | null
  concerns: Concern[]
  products_used: string | null
  wash_frequency: WashFrequency | null
  heat_styling: HeatStyling | null
  styling_tools: StylingTool[]
  goals: Goal[]
  cuticle_condition: CuticleCondition | null
  protein_moisture_balance: ProteinMoistureBalance | null
  scalp_type: ScalpType | null
  scalp_condition: ScalpCondition | null
  chemical_treatment: ChemicalTreatment[]
  desired_volume: DesiredVolume | null
  post_wash_actions: PostWashAction[]
  routine_preference: RoutinePreference | null
  current_routine_products: RoutineProduct[]
  mechanical_stress_factors: MechanicalStressFactor[]
  towel_material: TowelMaterial | null
  towel_technique: TowelTechnique | null
  drying_method: DryingMethod[]
  brush_type: BrushType | null
  night_protection: NightProtection[]
  uses_heat_protection: boolean
  additional_notes: string | null
  conversation_memory: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  brand: string | null
  description: string | null
  short_description: string | null
  tom_take: string | null
  category: string | null
  affiliate_link: string | null
  image_url: string | null
  price_eur: number | null
  currency: string
  tags: string[]
  suitable_thicknesses: string[]
  suitable_concerns: string[]
  shampoo_bucket_pairs?: ShampooBucketPair[] | null
  is_active: boolean
  sort_order: number
  conditioner_specs?: ProductConditionerSpecs | null
  leave_in_specs?: ProductLeaveInSpecs | null
  mask_specs?: ProductMaskSpecs | null
  recommendation_meta?: RecommendationMetadata | null
  created_at: string
  updated_at: string
}

export interface BaseRecommendationMetadata {
  category: "shampoo" | "conditioner" | "leave_in" | "mask" | "oil"
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
}

export interface OilMatchedProfile {
  thickness: HairThickness | null
}

export type OilProfileField = "thickness" | "oil_purpose"

export interface OilRecommendationMetadata extends BaseRecommendationMetadata {
  category: "oil"
  matched_profile: OilMatchedProfile
  matched_subtype: OilSubtype | null
  use_mode: OilUseMode | null
  adjunct_scalp_support: boolean
}

export type MaskType = "protein" | "moisture" | "performance"
export type MaskNeedStrength = 1 | 2 | 3
export type MaskSignal = "chemical_treatment" | "heat_styling" | "protein_moisture_balance" | "mechanical_stress"

export interface MaskRecommendationMetadata extends BaseRecommendationMetadata {
  category: "mask"
  mask_type: MaskType
  need_strength: MaskNeedStrength
}

export type RecommendationMetadata =
  | ShampooRecommendationMetadata
  | ConditionerRecommendationMetadata
  | LeaveInRecommendationMetadata
  | OilRecommendationMetadata
  | MaskRecommendationMetadata

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

export interface OilDecision {
  category: "oil"
  eligible: boolean
  missing_profile_fields: OilProfileField[]
  matched_profile: OilMatchedProfile
  matched_subtype: OilSubtype | null
  use_mode: OilUseMode | null
  adjunct_scalp_support: boolean
  candidate_count: number
  no_catalog_match: boolean
  no_recommendation: boolean
  no_recommendation_reason: OilNoRecommendationReason | null
}

export type CategoryDecision = ShampooDecision | ConditionerDecision | LeaveInDecision | OilDecision

export interface MaskDecision {
  needs_mask: boolean
  need_strength: 0 | MaskNeedStrength
  mask_type: MaskType | null
  active_signals: MaskSignal[]
  signal_weights?: Record<MaskSignal, number>
}

export interface MessageRagContext {
  sources: CitationSource[]
  category_decision?: CategoryDecision | null
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
  index: number          // 1-based, matches [1] markers
  source_type: string    // "book", "product_list", etc.
  label: string          // German: "Fachbuch", "Produktmatrix"
  source_name: string | null
  snippet: string        // First ~200 chars of chunk content
}

export type IntentType =
  | "product_recommendation"
  | "hair_care_advice"
  | "diagnosis"
  | "routine_help"
  | "ingredient_question"
  | "general_chat"
  | "followup"

export type ProductCategory = "shampoo" | "conditioner" | "mask" | "oil" | "leave_in" | "routine" | null

export type RetrievalMode = "faq" | "hybrid" | "hybrid_plus_graph" | "product_sql_plus_hybrid"

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
  needs_clarification: boolean
  clarification_reason?: string
  slot_completeness: number          // 0–1
  confidence: number
  policy_overrides: string[]         // e.g. ["low_confidence", "missing_slots"]
}

export interface ChatSSEEvent {
  type: "conversation_id" | "content_delta" | "product_recommendations" | "sources" | "confidence" | "retrieval_debug" | "done" | "error"
  data: unknown
}

/** Enriched citation source with optional hybrid retrieval metadata */
export interface EnrichedCitationSource extends CitationSource {
  confidence?: number
  retrieval_path?: "dense" | "lexical" | "hybrid"
}
